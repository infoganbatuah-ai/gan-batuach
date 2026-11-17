// One-time HOME_QA transition proof for an installed LEGACY_HMAC component.
// The QA verifier receives only this domain-separated public key. The installed
// local signing secret remains in its existing protected store, and this key
// is NEVER the final managed Ed25519 device identity.
import { createPrivateKey, createPublicKey, hkdfSync, sign, verify } from "node:crypto";

const protocol = "observer-home-qa-legacy-transition-proof-v1";
const pkcs8Ed25519SeedPrefix = Buffer.from("302e020100300506032b657004220420", "hex");
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const fields = ["device_id", "enrollment_id", "site_id", "tenant_id", "profile", "platform",
  "architecture", "channel", "current_version", "config_version", "release_id", "timestamp", "nonce"];

function validBinding(binding) {
  return [binding?.device_id, binding?.enrollment_id, binding?.site_id, binding?.tenant_id].every(id => uuid.test(id || "")) &&
    ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"].includes(binding.profile);
}
export function deriveHomeQaLegacyProofKey({ localSigningSecret, device_id, enrollment_id, site_id, tenant_id, profile }) {
  const binding = { device_id, enrollment_id, site_id, tenant_id, profile };
  if (!validBinding(binding) || typeof localSigningSecret !== "string" ||
    !/^[A-Za-z0-9_-]{43,160}$/.test(localSigningSecret)) throw new Error("HOME_QA_LEGACY_PROOF_INPUT_INVALID");
  const salt = Buffer.from([protocol, enrollment_id, device_id, site_id, tenant_id, profile].join("\n"));
  const seed = Buffer.from(hkdfSync("sha256", Buffer.from(localSigningSecret, "utf8"), salt,
    Buffer.from("public-key-only-qa-transition-proof"), 32));
  try {
    const privateKey = createPrivateKey({ key: Buffer.concat([pkcs8Ed25519SeedPrefix, seed]),
      format: "der", type: "pkcs8" });
    const publicKeySpki = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64url");
    return { privateKey, publicKeySpki };
  } finally { seed.fill(0); }
}
export function canonicalHomeQaLegacyProof(claim) {
  if (!claim || typeof claim !== "object" || Object.keys(claim).sort().join("|") !== fields.toSorted().join("|") ||
    !validBinding(claim) || claim.channel !== "HOME_QA" || claim.platform !== "darwin" ||
    claim.architecture !== "arm64" || !Number.isSafeInteger(claim.config_version) || claim.config_version < 1 ||
    typeof claim.current_version !== "string" || claim.current_version.length > 80 ||
    typeof claim.release_id !== "string" || !/^[A-Za-z0-9._:-]{3,160}$/.test(claim.release_id) ||
    typeof claim.timestamp !== "string" || !Number.isFinite(Date.parse(claim.timestamp)) ||
    typeof claim.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(claim.nonce))
    throw new Error("HOME_QA_LEGACY_PROOF_CLAIM_INVALID");
  return [protocol, ...fields.map(field => String(claim[field]))].join("\n");
}
export function signHomeQaLegacyProof(claim, privateKey) {
  return sign(null, Buffer.from(canonicalHomeQaLegacyProof(claim)), privateKey).toString("base64url");
}
export function verifyHomeQaLegacyProof(claim, signature, publicKeySpki, now = Date.now()) {
  try {
    const timestamp = Date.parse(claim.timestamp);
    if (Math.abs(now - timestamp) > 120_000 || typeof signature !== "string" ||
      !/^[A-Za-z0-9_-]{86}$/.test(signature) || typeof publicKeySpki !== "string" ||
      !/^[A-Za-z0-9_-]{40,256}$/.test(publicKeySpki)) return false;
    const key = createPublicKey({ key: Buffer.from(publicKeySpki, "base64url"), format: "der", type: "spki" });
    return key.asymmetricKeyType === "ed25519" && verify(null,
      Buffer.from(canonicalHomeQaLegacyProof(claim)), key, Buffer.from(signature, "base64url"));
  } catch { return false; }
}
