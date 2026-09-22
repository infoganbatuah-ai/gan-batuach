// Real isolated QA route negatives. No runtime install, no R2 binary download,
// no Product mutation, no credential or capability logging.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { deriveHomeQaLegacyProofKey, signHomeQaLegacyProof } from "../../services/video-gateway/home-qa-legacy-proof.mjs";

const token = readFileSync("/Users/danielderi/Library/Application Support/Digital Observer/Tapo Connector/secrets/gateway_signing_secret", "utf8").trim();
const binding = { device_id: "db267b52-6282-4944-bcee-5d4857698fb0",
  enrollment_id: "d7ee3c9f-0b2e-4943-947b-c410c6bc2a41",
  site_id: "cc1673b8-3eb0-4785-a12c-1fb88f425a41",
  tenant_id: "cc1673b8-3eb0-4785-a12c-1fb88f425a41", profile: "SOFTWARE_CONNECTOR" };
const proof = deriveHomeQaLegacyProofKey({ ...binding, localSigningSecret: token });
if (!process.env.NODE_EXTRA_CA_CERTS ||
  realpathSync(process.env.NODE_EXTRA_CA_CERTS) !==
    realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38t-ota-loopback-20260920.crt"))
  throw new Error("P38_HOME_QA_TLS_PIN_REQUIRED");
const endpoint = "https://127.0.0.1:3101/api/video-gateway/home-qa-legacy-download";
const claim = () => ({ ...binding, platform: "darwin", architecture: "arm64", channel: "HOME_QA",
  current_version: "0.1.0-legacy", config_version: 4,
  release_id: "qa-connector-legacy-transition-v2-6e7988808b05",
  timestamp: new Date().toISOString(), nonce: randomBytes(32).toString("base64url") });
async function request(body, privateKey = proof.privateKey, signed = true, signingClaim = body) {
  const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json",
    ...(signed ? { "x-observer-home-qa-legacy-signature": signHomeQaLegacyProof(signingClaim, privateKey) } : {}) },
    body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(30_000) });
  await response.body?.cancel();
  return response.status;
}
if (process.argv.includes("--positive-only")) {
  assert.equal(await request(claim(), proof.privateKey, false), 401, "anonymous request accepted");
  const early = await request({ ...claim(), release_id: "qa-p38-health-connector-pidfix-1b9e9499ffa7" });
  assert.ok(early >= 400 && early < 500, "Connector remediation available before transition");
  assert.equal(await request(claim()), 200, "exact device authorization failed");
  console.log(JSON.stringify({ status: "PASS", correct_device: "ACCEPT", anonymous: "DENY",
    remediation_early: "DENY", scope: "FRESH_SINGLE_GRANT", runtime_writes: 0, production_writes: 0 }));
  process.exit(0);
}
const cases = [
  ["wrong_device", { device_id: "62df97e2-3c0b-427f-9108-bde029bc10e7" }],
  ["wrong_site", { site_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
  ["wrong_tenant", { tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }],
  ["wrong_profile", { profile: "PHYSICAL_GATEWAY" }],
  ["wrong_architecture", { architecture: "x64" }],
  ["wrong_channel", { channel: "PRODUCTION" }],
  ["wrong_config", { config_version: 5 }],
  ["wrong_release", { release_id: "qa-non-target-release" }],
  ["remediation_before_transition", { release_id: "qa-p38-health-connector-pidfix-1b9e9499ffa7" }],
  ["superseded_remediation", { release_id: "qa-p38-health-connector-1b076f596574" }],
  ["expired_proof", { timestamp: new Date(Date.now() - 180_000).toISOString() }]
];
const denied = [];
for (const [name, overrides] of cases) {
  const body = { ...claim(), ...overrides };
  const signingClaim = name === "wrong_architecture" || name === "wrong_channel" ?
    { ...body, architecture: "arm64", channel: "HOME_QA" } : body;
  const status = await request(body, proof.privateKey, true, signingClaim);
  assert.ok(status >= 400 && status < 500, `${name} unexpectedly accepted (${status})`);
  denied.push({ case: name, status });
}
assert.equal(await request(claim(), proof.privateKey, false), 401, "anonymous request accepted");
const valid = claim();
assert.equal(await request(valid), 200, "exact device authorization failed");
assert.equal(await request(valid), 401, "nonce replay accepted");
console.log(JSON.stringify({ status: "PASS", correct_device: "ACCEPT", denied,
  anonymous: "DENY", replay: "DENY", remediation_early: "DENY",
  runtime_writes: 0, production_writes: 0 }));
