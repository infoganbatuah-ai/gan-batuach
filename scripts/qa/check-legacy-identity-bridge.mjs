import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { verifyLegacyIdentityUpgrade } from "../../services/video-gateway/legacy-identity-bridge.mjs";

const token = "fixture-only-refresh-token-that-is-never-a-live-secret";
const pair = generateKeyPairSync("ed25519");
const enrollment = {
  id: "enrollment-fixture", gateway_id: "gateway-fixture",
  observer_site_id: "site-fixture", tenant_id: "tenant-fixture", deployment_profile: "SOFTWARE_CONNECTOR",
  status: "delivered", lifecycle_state: "ACTIVE", identity_scheme: "LEGACY_HMAC",
  refresh_token_hash: createHash("sha256").update(token).digest("hex")
};
const now = Date.now();
const claim = {
  device_id: enrollment.id, gateway_id: enrollment.gateway_id, observer_site_id: enrollment.observer_site_id,
  tenant_id: enrollment.tenant_id, deployment_profile: enrollment.deployment_profile,
  public_key_spki: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url"),
  nonce: "a".repeat(32), expires_at: now + 60_000
};
const canonical = ["observer-legacy-identity-upgrade-v1", claim.device_id, claim.gateway_id,
  claim.observer_site_id, claim.tenant_id, claim.deployment_profile, claim.public_key_spki,
  claim.nonce, String(claim.expires_at)].join("\n");
claim.signature = sign(null, Buffer.from(canonical), pair.privateKey).toString("base64url");
const used = new Set();
const consumeNonce = async (id, nonce) => {
  const key = `${id}:${nonce}`;
  if (used.has(key)) return false;
  used.add(key); return true;
};
const valid = { enrollment, claim, legacyRefreshToken: token, consumeNonce, now };
assert.equal(await verifyLegacyIdentityUpgrade(valid), true);
assert.equal(await verifyLegacyIdentityUpgrade(valid), false, "replay accepted");
for (const input of [
  { ...valid, legacyRefreshToken: "x".repeat(48) },
  { ...valid, enrollment: { ...enrollment, lifecycle_state: "REVOKED" } },
  { ...valid, enrollment: { ...enrollment, identity_scheme: "ED25519_V1" } },
  { ...valid, claim: { ...claim, tenant_id: "other-tenant" } },
  { ...valid, claim: { ...claim, observer_site_id: "other-site" } },
  { ...valid, claim: { ...claim, signature: "x".repeat(86) } },
  { ...valid, now: claim.expires_at + 1 }
]) assert.equal(await verifyLegacyIdentityUpgrade(input), false);
console.log("Legacy identity bridge primitive QA PASS (synthetic only; no live enrollment)");
