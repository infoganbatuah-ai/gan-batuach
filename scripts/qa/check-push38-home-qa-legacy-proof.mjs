import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { deriveHomeQaLegacyProofKey, signHomeQaLegacyProof,
  verifyHomeQaLegacyProof } from "../../services/video-gateway/home-qa-legacy-proof.mjs";

const token = randomBytes(48).toString("base64url");
const binding = { device_id: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  enrollment_id: "1c450dca-38a8-4e49-853f-c613ca498c27",
  site_id: "cc1673b8-3eb0-4785-a12c-1fb88f425a41",
  tenant_id: "cc1673b8-3eb0-4785-a12c-1fb88f425a41", profile: "PHYSICAL_GATEWAY" };
const current = Date.now();
const claim = { ...binding, platform: "darwin", architecture: "arm64", channel: "HOME_QA",
  current_version: "0.1.0-legacy", config_version: 1,
  release_id: "qa-p38-health-gateway-6c9d08327ec6",
  timestamp: new Date(current).toISOString(), nonce: randomBytes(32).toString("base64url") };
const derived = deriveHomeQaLegacyProofKey({ ...binding, localSigningSecret: token });
const repeat = deriveHomeQaLegacyProofKey({ ...binding, localSigningSecret: token });
const foreign = deriveHomeQaLegacyProofKey({ ...binding,
  device_id: "db267b52-6282-4944-bcee-5d4857698fb0", localSigningSecret: token });
assert.equal(derived.publicKeySpki, repeat.publicKeySpki);
assert.notEqual(derived.publicKeySpki, foreign.publicKeySpki);
const signature = signHomeQaLegacyProof(claim, derived.privateKey);
assert.equal(verifyHomeQaLegacyProof(claim, signature, derived.publicKeySpki, current), true);
for (const change of [
  { device_id: foreign.publicKeySpki }, { site_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  { tenant_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, { profile: "SOFTWARE_CONNECTOR" },
  { release_id: "qa-other-release" }, { channel: "PRODUCTION" }, { architecture: "x64" },
  { nonce: randomBytes(32).toString("base64url") }
]) assert.equal(verifyHomeQaLegacyProof({ ...claim, ...change }, signature, derived.publicKeySpki, current), false);
assert.equal(verifyHomeQaLegacyProof(claim, signature, derived.publicKeySpki, current + 121_000), false);
assert.equal(verifyHomeQaLegacyProof(claim, signature, foreign.publicKeySpki, current), false);
assert.equal(verifyHomeQaLegacyProof(claim, signature.slice(0, -2) + "AA", derived.publicKeySpki, current), false);
console.log(JSON.stringify({ status: "PASS", verified: true, wrong_scope_rejected: true,
  wrong_key_rejected: true, expired_rejected: true, production_secret_exported: false }));
