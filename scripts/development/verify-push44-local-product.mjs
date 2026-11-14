import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config } from "./local-database.mjs";
import { localCredentials } from "./local-client.mjs";

const app = "http://127.0.0.1:3000";
const endpoint = `${app}/api/digital-observer/mobile/runtime`;
const siteA = "00000000-0000-4000-8000-000000000e01";
const siteB = "00000000-0000-4000-8000-000000000e02";
const noWrite = process.argv.includes("--no-write");
const expected = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const version = await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit, expected);
assert.equal(version.production, false);
assert.equal(version.backend, "LOCAL_SUPABASE");

const checks = [];
async function probe({ label, method = "GET", cookie, body, expectedStatus }) {
  const response = await fetch(endpoint, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(120_000)
  });
  const payload = await response.json().catch(() => ({}));
  const record = { label, status: response.status, expected: expectedStatus, pass: response.status === expectedStatus };
  checks.push(record);
  console.log(JSON.stringify(record));
  assert.equal(response.status, expectedStatus);
  return payload;
}

await probe({ label: "anonymous mobile runtime denied", expectedStatus: 401 });

const keys = localCredentials();
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
assert.equal(identities.environment, config.environment);
const identity = identities.users.find((user) => user.email === "observer-a@integration.qa.invalid");
assert.ok(identity);
const jar = new Map();
const auth = createServerClient(keys.url, keys.anon, {
  cookieOptions: { path: "/", sameSite: "lax", secure: false },
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
  }
});
assert.equal((await auth.auth.signInWithPassword({ email: identity.email, password: identity.password })).error, null);
const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

const runtime = await probe({ label: "authorized mobile runtime", cookie, expectedStatus: 200 });
assert.equal(runtime.data.contract, "digital-observer-mobile-runtime-v1");
assert.equal(runtime.data.session.active, true);
assert.equal(runtime.data.sms_authentication, "disabled");
assert.equal(runtime.data.sensitive_local_cache, false);
assert.ok(runtime.data.sites.some((site) => site.id === siteA));
assert.ok(!runtime.data.sites.some((site) => site.id === siteB));

const authorized = await probe({
  label: "authorized investigation deep link",
  method: "POST",
  cookie,
  body: { url: `digitalobserver://investigation?site=${siteA}` },
  expectedStatus: 200
});
assert.equal(authorized.data.authorized, true);
assert.equal(authorized.data.kind, "investigation");
assert.match(authorized.data.destination, /^\/digital-observer\/investigation\?/);

await probe({
  label: "cross-Site deep link denied",
  method: "POST",
  cookie,
  body: { url: `digitalobserver://investigation?site=${siteB}` },
  expectedStatus: 403
});
await probe({
  label: "forged HTTPS deep link denied",
  method: "POST",
  cookie,
  body: { url: `https://attacker.invalid/digital-observer/open/investigation?site=${siteA}` },
  expectedStatus: 400
});

await auth.auth.signOut();
assert.deepEqual(checks.filter((check) => !check.pass), []);
const receipt = {
  observedAt: new Date().toISOString(),
  status: "PASS",
  environment: config.environment,
  integrationCommit: expected,
  version,
  checks,
  productionAccess: false,
  externalProviderContact: false,
  realDeviceUsed: false,
  realRemotePlaybackUsed: false,
  proofClassification: {
    deterministicContract: "PASS",
    localFullStack: "PASS",
    nativeBuild: "BLOCKED_TOOLCHAIN_UNAVAILABLE",
    signedRealDevice: "NOT_AVAILABLE",
    providerReceipt: "NOT_AVAILABLE",
    production: "NOT_CLAIMED"
  },
  limitations: [
    "Synthetic isolated Development identity and data only",
    "No Android SDK or full Xcode on the validation host",
    "No signed real device, external Push receipt, real remote playback or store review"
  ]
};
if (!noWrite) writeFileSync("development/database/push44-local-product-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", checks: checks.length, integrationCommit: expected, noWrite }));
