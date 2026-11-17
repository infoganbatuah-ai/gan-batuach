import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config } from "./local-database.mjs";
import { localCredentials } from "./local-client.mjs";

const app = "http://127.0.0.1:3000";
const endpoint = `${app}/api/digital-observer/privacy-compliance`;
const siteA = "00000000-0000-4000-8000-000000000e01";
const siteB = "00000000-0000-4000-8000-000000000e02";
const noWrite = process.argv.includes("--no-write");
const expected = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const version = await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit, expected);
assert.equal(version.production, false);
assert.equal(version.backend, "LOCAL_SUPABASE");

const checks = [];
async function probe({ label, url = endpoint, method = "GET", cookie, body, expectedStatus }) {
  const response = await fetch(url, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined, redirect: "manual", signal: AbortSignal.timeout(120_000) });
  const payload = await response.json().catch(() => ({}));
  const record = { label, status: response.status, expected: expectedStatus, pass: response.status === expectedStatus };
  checks.push(record); console.log(JSON.stringify(record)); assert.equal(response.status, expectedStatus); return payload;
}

await probe({ label: "anonymous privacy center denied", url: `${endpoint}?site_id=${siteA}`, expectedStatus: 401 });
const keys = localCredentials();
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = identities.users.find((user) => user.email === "observer-a@integration.qa.invalid");
assert.ok(identity);
const jar = new Map();
const auth = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false },
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
assert.equal((await auth.auth.signInWithPassword({ email: identity.email, password: identity.password })).error, null);
const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

const state = await probe({ label: "authorized privacy center", url: `${endpoint}?site_id=${siteA}`, cookie, expectedStatus: 200 });
assert.equal(state.data.externalLegalApproval, "PENDING");
assert.equal(state.data.guarantees.consent_is_not_legal_approval, true);
assert.equal(state.data.guarantees.child_biometrics_enabled, false);
await probe({ label: "cross-Site privacy center denied", url: `${endpoint}?site_id=${siteB}`, cookie, expectedStatus: 403 });
const denied = await probe({ label: "sensitive activation fails closed", method: "POST", cookie, expectedStatus: 200,
  body: { action: "evaluate_sensitive_activation", site_id: siteA, capability: "FACE_RECOGNITION", context: "HOME", purpose: "authorized household access" } });
assert.equal(denied.data.allowed, false);
assert.ok(
  ["POLICY_INACTIVE", "EXTERNAL_APPROVAL_REQUIRED"].includes(denied.data.reason),
  `Expected a fail-closed policy or approval gate, received ${denied.data.reason}`,
);

await auth.auth.signOut();
const receipt = { observedAt: new Date().toISOString(), status: "PASS", environment: config.environment, integrationCommit: expected,
  version, checks, productionAccess: false, externalLegalApproval: "PENDING", sensitiveActivation: "DENIED",
  limitations: ["Synthetic isolated Development identities only", "No legal approval, provider, real customer, biometric, child-monitoring or Production proof"] };
if (!noWrite) writeFileSync("development/database/push45-local-product-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", checks: checks.length, integrationCommit: expected, noWrite }));
