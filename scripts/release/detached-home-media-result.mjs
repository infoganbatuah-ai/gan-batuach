import { constants, createHash, createPublicKey, privateDecrypt, publicEncrypt } from "node:crypto";
import { canonicalEdgeUpdateManifest, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { prepareHomeMediaRecovery } from "./issue-home-media-recovery.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const padding = constants.RSA_PKCS1_OAEP_PADDING;
const label = Buffer.from("observer-home-media-recovery-detached-v1");
const cipherOptions = { padding, oaepHash: "sha256", oaepLabel: label };

export function detachedResultKey(encoded, expectedDigest) {
  if (typeof encoded !== "string" || encoded.length > 1200) throw new Error("HOME_MEDIA_RETURN_KEY_INVALID");
  const bytes = Buffer.from(encoded, "base64");
  if (digest(bytes) !== expectedDigest) throw new Error("HOME_MEDIA_RETURN_KEY_PIN_MISMATCH");
  const key = createPublicKey({ key: bytes, format: "der", type: "spki" });
  if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength !== 4096)
    throw new Error("HOME_MEDIA_RETURN_KEY_INVALID");
  return key;
}

export function encryptDetachedHomeMediaResult(document, key) {
  const detached = { profile: document.profile, signed_at: document.released_at,
    payload_sha256: digest(canonicalEdgeUpdateManifest(document)), signature: document.signature };
  return publicEncrypt({ key, ...cipherOptions }, Buffer.from(JSON.stringify(detached))).toString("base64url");
}

// Only the operator holding the local return key and the exact archive can
// recover a usable manifest. A ciphertext alone creates no install authority.
export function recoverDetachedHomeMediaResult({ encrypted, privateKey, ...input }) {
  if (typeof encrypted !== "string" || !/^[A-Za-z0-9_-]{683}$/.test(encrypted))
    throw new Error("HOME_MEDIA_RETURN_ENVELOPE_INVALID");
  const result = JSON.parse(privateDecrypt({ key: privateKey, ...cipherOptions }, Buffer.from(encrypted, "base64url")));
  if (result.profile !== input.profile) throw new Error("HOME_MEDIA_RETURN_PROFILE_MISMATCH");
  const document = prepareHomeMediaRecovery({ ...input, releasedAt: result.signed_at });
  if (result.payload_sha256 !== digest(canonicalEdgeUpdateManifest(document))) throw new Error("HOME_MEDIA_RETURN_DIGEST_MISMATCH");
  const recovered = { ...document, signature: result.signature };
  if (!verifyEdgeUpdateManifest(recovered, input.trustedPublicKeys).ok) throw new Error("HOME_MEDIA_RETURN_SIGNATURE_INVALID");
  return recovered;
}
