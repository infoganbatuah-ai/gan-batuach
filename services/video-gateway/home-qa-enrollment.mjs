import { createHash, createPublicKey } from "node:crypto";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const profiles = new Set(["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"]);
const fields = ["enrollment_id", "device_id", "site_id", "tenant_id", "profile", "credential_version", "config_version"];

function normalizedRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("QA_ENROLLMENT_RECORD_INVALID");
  const allowed = new Set([...fields, "public_key_spki"]);
  if (Object.keys(value).some(field => !allowed.has(field))) throw new Error("QA_ENROLLMENT_UNEXPECTED_FIELD");
  for (const field of fields.slice(0, 4)) if (!uuid.test(value[field] || "")) throw new Error(`QA_ENROLLMENT_${field.toUpperCase()}_INVALID`);
  if (!profiles.has(value.profile)) throw new Error("QA_ENROLLMENT_PROFILE_INVALID");
  for (const field of ["credential_version", "config_version"])
    if (!Number.isSafeInteger(value[field]) || value[field] < 1) throw new Error(`QA_ENROLLMENT_${field.toUpperCase()}_INVALID`);
  if (typeof value.public_key_spki !== "string" || !/^[A-Za-z0-9_-]{40,256}$/.test(value.public_key_spki))
    throw new Error("QA_ENROLLMENT_PUBLIC_KEY_INVALID");
  const key = createPublicKey({ key: Buffer.from(value.public_key_spki, "base64url"), format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "ed25519") throw new Error("QA_ENROLLMENT_PUBLIC_KEY_NOT_ED25519");
  const der = key.export({ format: "der", type: "spki" });
  const fingerprint = createHash("sha256").update(der).digest("hex");
  return { ...Object.fromEntries(fields.map(field => [field, value[field]])),
    public_key_spki: der.toString("base64url"), public_key_sha256: fingerprint };
}

// Capture comes from the device's public-key-only export. Approval comes from
// an independently authenticated Product/admin read. Neither may supply a
// private key, HMAC secret, service credential or arbitrary extra device.
export function reconcileHomeQaEnrollment(capture, approval) {
  if (capture?.environment !== "HOME_QA" || approval?.environment !== "HOME_QA" ||
    approval?.provenance !== "AUTHENTICATED_PRODUCT_ADMIN_READ_ONLY" ||
    !Array.isArray(capture.devices) || !Array.isArray(approval.devices) ||
    capture.devices.length !== 2 || approval.devices.length !== 2)
    throw new Error("QA_ENROLLMENT_EVIDENCE_INCOMPLETE");
  const captured = capture.devices.map(normalizedRecord);
  const approved = approval.devices.map(normalizedRecord);
  if (new Set(captured.map(row => row.profile)).size !== 2 ||
    new Set(captured.map(row => row.device_id)).size !== 2 ||
    new Set(captured.map(row => row.enrollment_id)).size !== 2 ||
    new Set(captured.map(row => row.public_key_sha256)).size !== 2)
    throw new Error("QA_ENROLLMENT_NOT_EXACT_HOME_PAIR");
  for (const row of captured) {
    const witness = approved.find(candidate => candidate.profile === row.profile);
    if (!witness || fields.some(field => witness[field] !== row[field]) ||
      witness.public_key_sha256 !== row.public_key_sha256 ||
      witness.public_key_spki !== row.public_key_spki)
      throw new Error("QA_ENROLLMENT_OWNER_WITNESS_MISMATCH");
  }
  if (captured[0].site_id !== captured[1].site_id || captured[0].tenant_id !== captured[1].tenant_id)
    throw new Error("QA_ENROLLMENT_HOME_BOUNDARY_MISMATCH");
  return captured.sort((a, b) => a.profile.localeCompare(b.profile));
}
