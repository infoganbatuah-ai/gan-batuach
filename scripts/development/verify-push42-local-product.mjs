import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import { config } from "./local-database.mjs";
import { DigitalObserverExternalClient } from "../../examples/digital-observer-external-api/client.mjs";

const app = "http://127.0.0.1:3000";
const api = `${app}/api/digital-observer/external/v1`;
const siteA = "00000000-0000-4000-8000-000000000e01";
const siteB = "00000000-0000-4000-8000-000000000e02";
const noWrite = process.argv.includes("--no-write");
const expected = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const version = await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit, expected); assert.equal(version.production, false); assert.equal(version.backend, "LOCAL_SUPABASE");
const secrets = parseEnv(readFileSync(resolve(config.runtimeRoot, "push42-api.private.env"), "utf8"));
const client = new DigitalObserverExternalClient({ baseUrl: api, credential: secrets.DIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL });
const checks = [];
async function check(label, execute, expectedStatus = 200) {
  try { const value = await execute(); checks.push({ label, status: 200, expected: expectedStatus, pass: expectedStatus === 200 }); return value; }
  catch (error) { checks.push({ label, status: error.status, expected: expectedStatus, pass: error.status === expectedStatus }); if (error.status !== expectedStatus) throw error; return error.response; }
}

const openapi = await (await fetch(`${api}/openapi.json`)).json();
assert.equal(openapi.info.version, "2026-10-19.v1"); checks.push({ label: "public OpenAPI", status: 200, expected: 200, pass: true });
const cameras = await check("independent camera list", () => client.cameras(siteA)); assert.ok(Array.isArray(cameras.data));
const events = await check("independent Event list", () => client.events(siteA)); assert.ok(Array.isArray(events.data));
const incidents = await check("independent Incident list", () => client.incidents(siteA)); assert.ok(Array.isArray(incidents.data));
const capabilities = await check("truthful integration capabilities", () => client.integrationCapabilities(siteA));
assert.equal(capabilities.universal_compatibility_claimed, false); assert.ok(capabilities.data.some((row) => row.connection_status === "configured_inactive"));
await check("cross-organization Site denied", () => client.cameras(siteB), 403);
const unauthenticated = await fetch(`${api}/cameras?site_id=${siteA}`); checks.push({ label: "anonymous denied", status: unauthenticated.status, expected: 401, pass: unauthenticated.status === 401 }); assert.equal(unauthenticated.status, 401);
await check("Gan Batuach scoped contract", () => client.request(`gan-batuach/contract?site_id=${siteA}`));

const verificationRunId = randomUUID().replaceAll("-", "");
const nonce = `push42_first_${verificationRunId}`;
const idempotencyKey = `push42-local-investigation-${verificationRunId}`;
await check("first idempotent investigation", () => client.request("investigations/search", { method: "POST", body: { site_id: siteA, question: "Show recent observations" }, idempotencyKey, nonce }));
await check("repeated effect prevented", () => client.request("investigations/search", { method: "POST", body: { site_id: siteA, question: "Show recent observations" }, idempotencyKey, nonce: `push42_second_${verificationRunId}` }), 409);

const failedChecks = checks.filter((item) => !item.pass);
assert.deepEqual(failedChecks, [], `PUSH 42 conformance failures: ${JSON.stringify(failedChecks)}`);
const receipt = { observedAt: new Date().toISOString(), status: "PASS", environment: config.environment, integrationCommit: expected, version, checks,
  productionAccess: false, providerContact: false, customerData: false, rawCredentialPrinted: false,
  proofClassification: { deterministicContract: "PASS", independentLocalConsumer: "PASS", externalConsumer: "NOT_AVAILABLE", externalWebhookReceipt: "NOT_AVAILABLE", externalVms: "NOT_AVAILABLE", production: "NOT_CLAIMED" },
  limitations: ["Independent client exercised isolated synthetic Development data", "No external partner, VMS/NVR/DVR, webhook receiver, customer data or Production system"] };
if (!noWrite) writeFileSync("development/database/push42-local-product-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", checks: checks.length, integrationCommit: expected, noWrite }));
