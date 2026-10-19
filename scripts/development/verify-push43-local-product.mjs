import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { createServerClient } from "@supabase/ssr";
import { DigitalObserverServerClient } from "../../packages/digital-observer-sdk/src/index.ts";
import { DigitalObserverEmbeddedClient } from "../../packages/digital-observer-sdk/src/browser.ts";
import { loadAuthorizedPartnerCustomer } from "../../examples/digital-observer-partner-app/server.mjs";
import { config, sql } from "./local-database.mjs";
import { localCredentials } from "./local-client.mjs";

const app = "http://127.0.0.1:3000";
const externalApi = `${app}/api/digital-observer/external/v1`;
const partnerApi = `${app}/api/digital-observer/partner/v1`;
const embedApi = `${app}/api/digital-observer/embed/v1/dashboard`;
const orgA = "00000000-0000-4000-8000-000000000d41";
const orgB = "00000000-0000-4000-8000-000000000d42";
const siteB = "00000000-0000-4000-8000-000000000e02";
const siteC = "00000000-0000-4000-8000-000000004305";
const customerB = "00000000-0000-4000-8000-000000004302";
const noWrite = process.argv.includes("--no-write");
const expected = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const version = await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit, expected); assert.equal(version.production, false); assert.equal(version.backend, "LOCAL_SUPABASE");

const serverSecrets = parseEnv(readFileSync(resolve(config.runtimeRoot, "push42-api.private.env"), "utf8"));
const sdkSecrets = parseEnv(readFileSync(resolve(config.runtimeRoot, "push43-sdk.private.env"), "utf8"));
const control = new DigitalObserverServerClient({ baseUrl: externalApi, partnerBaseUrl: partnerApi, credential: serverSecrets.DIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL });
const customer = new DigitalObserverServerClient({ baseUrl: externalApi, partnerBaseUrl: partnerApi, credential: sdkSecrets.DIGITAL_OBSERVER_PUSH43_CUSTOMER_CREDENTIAL });
const checks = [];
async function check(label, execute, expectedStatus = 200) {
  try { const value = await execute(); checks.push({ label, status: 200, expected: expectedStatus, pass: expectedStatus === 200 }); return value; }
  catch (error) { checks.push({ label, status: error.status, expected: expectedStatus, pass: error.status === expectedStatus }); if (error.status !== expectedStatus) throw error; return error.payload; }
}

const keys = localCredentials();
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = identities.users.find((user) => user.email === "observer-a@integration.qa.invalid");
assert.ok(identity);
const jar = new Map();
const auth = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: {
  getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
} });
assert.equal((await auth.auth.signInWithPassword({ email: identity.email, password: identity.password })).error, null);
const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
async function sessionProbe(path, expectedStatus) {
  const response = await fetch(`${app}${path}`, { headers: { Cookie: cookie }, redirect: "manual" });
  checks.push({ label: path, status: response.status, expected: expectedStatus, pass: response.status === expectedStatus });
  assert.equal(response.status, expectedStatus); return response;
}

await sessionProbe("/digital-observer/partners", 200);
await sessionProbe(`/api/digital-observer/partners?organization_id=${orgA}`, 200);
await sessionProbe(`/api/digital-observer/partners?organization_id=${orgB}`, 403);
const anonymous = await fetch(`${app}/api/digital-observer/partners?organization_id=${orgA}`);
checks.push({ label: "anonymous partner administration denied", status: anonymous.status, expected: 401, pass: anonymous.status === 401 }); assert.equal(anonymous.status, 401);

const profile = await check("partner authentication/profile", () => control.partnerProfile());
assert.equal(profile.partner.partner_status, "sandbox"); assert.equal(profile.brand.product_name, "Sentinel Home"); assert.equal(profile.brand.platform_brand_exposed, false);
const customers = await check("partner customer inventory", () => control.partnerCustomers()); assert.equal(customers.data.length, 2);
const replay = await check("idempotent customer provisioning", () => control.provisionPartnerCustomer({
  customer_organization_id: orgB, external_customer_reference: "qa-customer-b", site_ids: [siteB],
  entitlement_grant_ids: ["00000000-0000-4000-8000-00000000430a"], idempotency_key: "push43-customer-b"
}));
assert.equal(replay.idempotentReplay, true);

const independent = await check("independent sample partner application", () => loadAuthorizedPartnerCustomer({ baseUrl: externalApi,
  credential: sdkSecrets.DIGITAL_OBSERVER_PUSH43_CUSTOMER_CREDENTIAL, siteId: siteB, fetch }));
assert.equal(independent.privateModulesImported, false); assert.ok(Array.isArray(independent.cameras));
await check("cross-customer Site denied", () => customer.cameras(siteC), 403);

const issued = await check("short-lived embedded session", () => control.issueEmbeddedSession({ partner_customer_id: customerB, site_id: siteB,
  audience: "qa-partner-dashboard", allowed_origin: app, scopes: ["cameras.read", "camera_health.read", "events.read", "incidents.read", "evidence.read"], ttl_minutes: 15 }, `push43-embed-${randomUUID()}`));
assert.match(issued.token, /^doemb_/); assert.equal(issued.oneTimeSecret, true);
const originFetch = (input, init = {}) => fetch(input, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers).entries()), origin: app } });
const embedded = await check("embedded branded UI contract", () => new DigitalObserverEmbeddedClient({ endpoint: embedApi, token: issued.token,
  audience: "qa-partner-dashboard", fetch: originFetch }).dashboard());
assert.equal(embedded.contract, "digital-observer-embedded-v1"); assert.equal(embedded.brand.product_name, "Sentinel Home");
assert.equal(embedded.brand.platform_brand_exposed, false); assert.equal(embedded.private_credentials_exposed, false); assert.equal(embedded.biometric_features_enabled, false);
const wrongOrigin = await fetch(embedApi, { headers: { authorization: `Bearer ${issued.token}`, "x-do-audience": "qa-partner-dashboard", origin: "https://wrong.example" } });
checks.push({ label: "embedded origin denial", status: wrongOrigin.status, expected: 403, pass: wrongOrigin.status === 403 }); assert.equal(wrongOrigin.status, 403);

sql(`update public.digital_observer_embedded_sessions set revoked_at=now(),revocation_reason='push43 deterministic revocation proof' where id='${issued.session.id}';`);
const revoked = await fetch(embedApi, { headers: { authorization: `Bearer ${issued.token}`, "x-do-audience": "qa-partner-dashboard", origin: app } });
checks.push({ label: "embedded session revocation", status: revoked.status, expected: 403, pass: revoked.status === 403 }); assert.equal(revoked.status, 403);
const usage = Number(sql("select coalesce(sum(request_count),0) from public.digital_observer_external_api_usage_buckets where observer_site_id='00000000-0000-4000-8000-000000000e02';").trim());
assert.ok(usage >= 3); checks.push({ label: "partner customer usage attribution", status: 200, expected: 200, pass: true, measuredRequests: usage });

await auth.auth.signOut();
assert.deepEqual(checks.filter((item) => !item.pass), []);
const receipt = {
  observedAt: new Date().toISOString(), status: "PASS", environment: config.environment, integrationCommit: expected, version, checks,
  productionAccess: false, providerContact: false, realCustomerData: false, longLivedBrowserSecret: false,
  proofClassification: { deterministicContract: "PASS", independentPartnerApp: "PASS", syntheticMultiCustomerIsolation: "PASS", realOemPartner: "NOT_AVAILABLE", production: "NOT_CLAIMED" },
  limitations: ["Independent app and two partner customers use isolated synthetic Development data", "No real OEM, VMS, custom domain, provider or Production system"]
};
if (!noWrite) writeFileSync("development/database/push43-local-product-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", checks: checks.length, integrationCommit: expected, noWrite }));
