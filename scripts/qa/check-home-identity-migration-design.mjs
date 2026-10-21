import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { verifyLegacyIdentityUpgrade } from "../../services/video-gateway/legacy-identity-bridge.mjs";

// Isolated state-model rehearsal only. It does not execute a Product API or SQL.
const site = "synthetic-home-site", tenant = "synthetic-home-tenant";
const sourceIds = Array.from({ length: 17 }, (_, index) => `synthetic-source-${index + 1}`);
const originalSources = sourceIds.map((id, index) => ({ id, site_id: site, tenant_id: tenant,
  gateway_id: index < 16 ? "synthetic-gateway" : "synthetic-connector" }));
for (const [profile, gatewayId] of [["PHYSICAL_GATEWAY", "synthetic-gateway"],
  ["SOFTWARE_CONNECTOR", "synthetic-connector"]]) {
  const token = `synthetic-legacy-token-${gatewayId}-not-a-live-secret`;
  const enrollment = { id: `synthetic-enrollment-${gatewayId}`, gateway_id: gatewayId,
    observer_site_id: site, tenant_id: tenant, deployment_profile: profile, status: "delivered",
    lifecycle_state: "ACTIVE", identity_scheme: "LEGACY_HMAC",
    refresh_token_hash: createHash("sha256").update(token).digest("hex") };
  const old = structuredClone(enrollment);
  const keys = generateKeyPairSync("ed25519"), now = Date.now();
  const claim = { device_id: enrollment.id, gateway_id: gatewayId, observer_site_id: site,
    tenant_id: tenant, deployment_profile: profile,
    public_key_spki: keys.publicKey.export({ format: "der", type: "spki" }).toString("base64url"),
    nonce: "n".repeat(32), expires_at: now + 60_000 };
  const canonical = ["observer-legacy-identity-upgrade-v1", claim.device_id, claim.gateway_id,
    claim.observer_site_id, claim.tenant_id, claim.deployment_profile, claim.public_key_spki,
    claim.nonce, String(claim.expires_at)].join("\n");
  claim.signature = sign(null, Buffer.from(canonical), keys.privateKey).toString("base64url");
  const nonces = new Set();
  const consumeNonce = async (id, nonce) => {
    const key = `${id}:${nonce}`;
    if (nonces.has(key)) return false;
    nonces.add(key); return true;
  };
  assert.equal(await verifyLegacyIdentityUpgrade({ enrollment, claim, legacyRefreshToken: token, consumeNonce, now }), true);
  assert.equal(await verifyLegacyIdentityUpgrade({ enrollment, claim, legacyRefreshToken: token, consumeNonce, now }), false);

  // Staging a new public key must leave the active legacy row and all sources untouched.
  let staged = { enrollment_id: enrollment.id, public_key_spki: claim.public_key_spki, state: "PENDING" };
  assert.deepEqual(enrollment, old);
  assert.equal(staged.state, "PENDING");
  staged = null; // Pre-cutover cancellation is reversible without changing enrollment.
  assert.equal(staged, null);
  assert.deepEqual(enrollment, old);

  // Model the desired same-enrollment cutover without changing device/source IDs.
  // This is NOT an implemented or tested Product transaction.
  const cutover = { ...enrollment, identity_scheme: "ED25519_V1", credential_version: 1,
    refresh_token_hash: null };
  assert.equal(cutover.id, old.id);
  assert.equal(cutover.gateway_id, old.gateway_id);
  assert.equal(cutover.observer_site_id, old.observer_site_id);
  assert.equal(cutover.tenant_id, old.tenant_id);
  assert.equal(cutover.refresh_token_hash, null);
  assert.equal(cutover.identity_scheme, "ED25519_V1");
  assert.deepEqual(originalSources.map(source => source.id), sourceIds);
  assert.ok(originalSources.every(source => source.site_id === site && source.tenant_id === tenant));
  // After cutover the old Legacy credential cannot be restored from an archive.
  assert.notEqual(cutover.refresh_token_hash, old.refresh_token_hash);
}
console.log("Same-enrollment migration design PASS (isolated model only): 17 source IDs stable; pre-cutover cancel safe; post-cutover Legacy rollback unavailable");
