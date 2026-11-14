import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createServerClient } from "@supabase/ssr";
import { config } from "./local-database.mjs";
import { localCredentials } from "./local-client.mjs";

const app = "http://127.0.0.1:3000";
const orgA = "00000000-0000-4000-8000-000000000d41";
const orgB = "00000000-0000-4000-8000-000000000d42";
const noWrite = process.argv.includes("--no-write");
const keys = localCredentials();
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const expected = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const version = await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit, expected); assert.equal(version.production, false); assert.equal(version.backend, "LOCAL_SUPABASE");

const identity = identities.users.find((user) => user.email === "observer-a@integration.qa.invalid");
assert.ok(identity);
const jar = new Map();
const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: {
  getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
} });
const login = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
assert.equal(login.error, null);
const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
const checks = [];
async function probe({ path, method = "GET", body, cookieHeader = cookie, expectedStatus, label, headers = {} }) {
  const response = await fetch(`${app}${path}`, { method, headers: { ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    ...(body ? { "Content-Type": "application/json", Origin: app } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined,
    redirect: "manual", signal: AbortSignal.timeout(120000) });
  const raw = await response.text(); let payload = null; try { payload = raw ? JSON.parse(raw) : null; } catch {}
  const check = { path, method, actor: label, status: response.status, expected: expectedStatus, pass: response.status === expectedStatus,
    serverError: raw.includes("NEXT_HTTP_ERROR_FALLBACK;500") };
  checks.push(check); console.log(JSON.stringify(check));
  assert.equal(response.status, expectedStatus, `${method} ${path}: ${raw.slice(0, 500)}`); assert.equal(check.serverError, false); return payload;
}

await probe({ path: "/digital-observer/enterprise", expectedStatus: 200, label: "observer-a enterprise UI" });
const enterprise = await probe({ path: `/api/digital-observer/enterprise?organization_id=${orgA}`, expectedStatus: 200, label: "observer-a own organization" });
assert.equal(enterprise.data.organization.id, orgA);
assert.equal(enterprise.data.authenticationPolicy.smsAuthentication, false);
assert.equal(enterprise.data.authenticationPolicy.automaticSmsFallback, false);
assert.equal(enterprise.data.authenticationPolicy.twilioSmsAuthentication, false);
assert.equal(enterprise.data.externalProof.sso, "pending");
await probe({ path: `/api/digital-observer/enterprise?organization_id=${orgB}`, expectedStatus: 403, label: "observer-a forbidden other organization" });
await probe({ path: `/api/digital-observer/enterprise?organization_id=${orgA}`, cookieHeader: null, expectedStatus: 401, label: "unauthenticated enterprise" });
await probe({ path: "/api/digital-observer/enterprise/scim/v2/Users", method: "POST", cookieHeader: null, expectedStatus: 401,
  label: "SCIM missing credential", body: { operation: "create_user", event_id: "event-123456", external_id: "external-a", profile_id: identity.id, group: "viewer", site_ids: [] } });
await probe({ path: "/api/digital-observer/notifications?observer_site_id=00000000-0000-4000-8000-000000000e01", expectedStatus: 200, label: "PUSH39 regression" });
await probe({ path: "/api/digital-observer/billing?observer_site_id=00000000-0000-4000-8000-000000000e01", expectedStatus: 200, label: "PUSH40 regression" });

await client.auth.signOut();
const status = checks.every((check) => check.pass && !check.serverError) ? "PASS" : "FAIL";
const receipt = { observedAt: new Date().toISOString(), status, environment: config.environment, integrationCommit: expected, version, checks,
  productionAccess: false, externalIdpContact: false, paidProviderContact: false,
  proofClassification: { deterministicContract: "PASS", localFullStack: "PASS", ssoProvider: "NOT_AVAILABLE", scimProvider: "NOT_AVAILABLE", productionScale: "NOT_CLAIMED" },
  limitations: ["Synthetic isolated Development identities and two organizations", "No external SSO/SCIM/WhatsApp provider", "No Production environment or real enterprise customer"] };
if (!noWrite) writeFileSync("development/database/push41-local-product-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status, checks: checks.length, integrationCommit: expected, noWrite }));
if (status !== "PASS") process.exitCode = 1;
