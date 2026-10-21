import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";

// Pure, bounded comparator for an independently authorized READ-ONLY snapshot.
// The caller must obtain the exact enrollment through a scoped read-only role;
// this function never fetches a verifier, authenticates, rotates, or logs data.
export function compareLegacyCredentialReadonly({ rows, expected, localCredential }) {
  if (!Array.isArray(rows) || rows.length !== 1 || !expected ||
    typeof localCredential !== "string" || localCredential.length < 32 || localCredential.length > 512) return "UNKNOWN";
  const row = rows[0];
  if (!row || row.status !== "delivered" || row.lifecycle_state !== "ACTIVE" ||
    row.identity_scheme !== "LEGACY_HMAC" ||
    !["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(expected.deployment_profile) ||
    !["id", "gateway_id", "observer_site_id", "tenant_id", "deployment_profile"].every(key =>
      typeof expected[key] === "string" && expected[key].length > 0 && row[key] === expected[key]) ||
    !Number.isInteger(expected.config_version) || expected.config_version < 1 ||
    row.config_version !== expected.config_version ||
    typeof row.refresh_token_hash !== "string" || !/^[a-f0-9]{64}$/.test(row.refresh_token_hash)) return "UNKNOWN";
  const candidate = createHash("sha256").update(localCredential, "utf8").digest();
  const verifier = Buffer.from(row.refresh_token_hash, "hex");
  return timingSafeEqual(candidate, verifier) ? "MATCH" : "MISMATCH";
}

// Verification primitive for a future owner-controlled same-enrollment upgrade.
// Only a trusted Product record may supply the expected hash and binding.
export async function verifyLegacyIdentityUpgrade({ enrollment, claim, legacyRefreshToken, consumeNonce, now = Date.now() }) {
  if (!enrollment || !claim || typeof consumeNonce !== "function" || typeof legacyRefreshToken !== "string") return false;
  if (enrollment.status !== "delivered" || enrollment.lifecycle_state !== "ACTIVE"
    || enrollment.identity_scheme !== "LEGACY_HMAC" || !["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(enrollment.deployment_profile)) return false;
  if (!enrollment.id || claim.device_id !== enrollment.id) return false;
  for (const key of ["gateway_id", "observer_site_id", "tenant_id", "deployment_profile"])
    if (!enrollment[key] || claim[key] !== enrollment[key]) return false;
  if (!/^[a-f0-9]{64}$/.test(enrollment.refresh_token_hash || "") || legacyRefreshToken.length < 32) return false;
  const received = createHash("sha256").update(legacyRefreshToken, "utf8").digest();
  const stored = Buffer.from(enrollment.refresh_token_hash, "hex");
  if (!timingSafeEqual(received, stored)) return false;
  if (typeof claim.nonce !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(claim.nonce)
    || !Number.isInteger(claim.expires_at) || claim.expires_at < now || claim.expires_at > now + 120_000
    || typeof claim.public_key_spki !== "string" || claim.public_key_spki.length > 256
    || typeof claim.signature !== "string") return false;
  const canonical = ["observer-legacy-identity-upgrade-v1", claim.device_id, claim.gateway_id,
    claim.observer_site_id, claim.tenant_id, claim.deployment_profile, claim.public_key_spki,
    claim.nonce, String(claim.expires_at)].join("\n");
  try {
    const key = createPublicKey({ key: Buffer.from(claim.public_key_spki, "base64url"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519" || !verify(null, Buffer.from(canonical), key, Buffer.from(claim.signature, "base64url"))) return false;
  } catch { return false; }
  // Persistent, atomic nonce consumption belongs to the trusted control plane.
  return (await consumeNonce(enrollment.id, claim.nonce, claim.expires_at)) === true;
}
