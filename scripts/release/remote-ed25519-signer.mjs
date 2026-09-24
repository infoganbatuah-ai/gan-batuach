// Release tooling only. Private signing material stays in the remote key service.
import { createHash, createPublicKey, verify } from "node:crypto";
import { canonicalEdgeUpdateManifest, validateEdgeUpdateManifest, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { canonicalEdgeTrustRegistry, verifyEdgeTrustRegistry } from "../../services/video-gateway/edge-release-trust.mjs";

const ALGORITHM = "ED25519_SHA_512";
const SPEC = "ECC_NIST_EDWARDS25519";
const PLACEHOLDER = Buffer.alloc(64).toString("base64url");
const fail = code => { throw new Error(code); };
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export function validateRemoteSignerConfig(config) {
  if (!config || Object.keys(config).sort().join(",") !== "keyArn,keyId,publicKeySha256,role" ||
    !/^arn:aws:kms:[a-z0-9-]+:\d{12}:key\/[a-f0-9-]{36}$/.test(config.keyArn) ||
    !/^[A-Za-z0-9._:-]{3,160}$/.test(config.keyId) || !/^[a-f0-9]{64}$/.test(config.publicKeySha256) ||
    !["ROOT_REGISTRY", "RELEASE_MANIFEST"].includes(config.role)) fail("REMOTE_SIGNER_CONFIG_INVALID");
}

// call(operation, input) is an authenticated KMS transport. It must return AWS's
// JSON response; no provider exception body is propagated into release logs.
export async function signRemoteEdgeDocument({ document, config, call }) {
  validateRemoteSignerConfig(config);
  const payload = { ...structuredClone(document), signature: PLACEHOLDER };
  if (config.role === "RELEASE_MANIFEST") {
    validateEdgeUpdateManifest(payload);
    if (payload.signing_key_id !== config.keyId) fail("REMOTE_SIGNER_KEY_ID_MISMATCH");
    if (["INTERNAL", "HOME_QA"].includes(payload.channel) && (payload.rollout.stage !== "INTERNAL_QA" ||
      payload.rollout.cohort_percent !== 0 || payload.rollout.explicit_device_ids.length !== 1))
      fail("REMOTE_SIGNER_HOME_QA_TARGET_NOT_EXACT");
  } else if (payload.root_key_id !== config.keyId) fail("REMOTE_SIGNER_ROOT_ID_MISMATCH");
  const canonical = config.role === "ROOT_REGISTRY" ? canonicalEdgeTrustRegistry(payload) : canonicalEdgeUpdateManifest(payload);
  const message = Buffer.from(canonical);
  // Pure Ed25519 is the existing on-device protocol. Never silently prehash or
  // use Ed25519ph to work around the KMS RAW-message size limit.
  if (message.length < 1 || message.length > 4096) fail("REMOTE_SIGNER_MESSAGE_SIZE_INVALID");
  const invoke = async (operation, input) => {
    try { return await call(operation, input); } catch { fail("REMOTE_SIGNER_PROVIDER_FAILED"); }
  };
  const { KeyMetadata: meta } = await invoke("describe-key", { KeyId: config.keyArn });
  if (!meta || meta.Arn !== config.keyArn || meta.KeySpec !== SPEC || meta.KeyUsage !== "SIGN_VERIFY" ||
    meta.KeyState !== "Enabled" || meta.KeyManager !== "CUSTOMER" || meta.Origin !== "AWS_KMS")
    fail("REMOTE_SIGNER_KEY_CUSTODY_INVALID");
  const publicResult = await invoke("get-public-key", { KeyId: config.keyArn });
  if (publicResult.KeyId !== config.keyArn || publicResult.KeySpec !== SPEC ||
    publicResult.KeyUsage !== "SIGN_VERIFY" || !publicResult.SigningAlgorithms?.includes(ALGORITHM) ||
    typeof publicResult.PublicKey !== "string") fail("REMOTE_SIGNER_PUBLIC_KEY_INVALID");
  const publicBytes = Buffer.from(publicResult.PublicKey, "base64");
  if (digest(publicBytes) !== config.publicKeySha256) fail("REMOTE_SIGNER_PUBLIC_KEY_PIN_MISMATCH");
  let publicKey;
  try { publicKey = createPublicKey({ key: publicBytes, format: "der", type: "spki" }); }
  catch { fail("REMOTE_SIGNER_PUBLIC_KEY_INVALID"); }
  if (publicKey.asymmetricKeyType !== "ed25519") fail("REMOTE_SIGNER_ALGORITHM_INVALID");
  const publicValue = publicBytes.toString("base64url");
  const rootOptions = { pinnedRootKeyId: config.keyId, pinnedRootPublicKey: publicValue };
  if (config.role === "ROOT_REGISTRY") {
    const preflight = verifyEdgeTrustRegistry(payload, rootOptions);
    if (preflight.reason !== "EDGE_TRUST_SIGNATURE_INVALID") fail("REMOTE_SIGNER_REGISTRY_INVALID");
    for (const entry of payload.keys) {
      let key;
      try { key = createPublicKey({ key: Buffer.from(entry.public_key, "base64url"), format: "der", type: "spki" }); }
      catch { fail("REMOTE_SIGNER_REGISTRY_KEY_INVALID"); }
      if (key.asymmetricKeyType !== "ed25519" || entry.public_key === publicValue || entry.key_id === config.keyId)
        fail("REMOTE_SIGNER_ROOT_RELEASE_SEPARATION_INVALID");
    }
  }
  const response = await invoke("sign", { KeyId: config.keyArn, Message: message.toString("base64"),
    MessageType: "RAW", SigningAlgorithm: ALGORITHM });
  if (response.KeyId !== config.keyArn || response.SigningAlgorithm !== ALGORITHM || typeof response.Signature !== "string")
    fail("REMOTE_SIGNER_RESPONSE_INVALID");
  const signature = Buffer.from(response.Signature, "base64");
  if (signature.length !== 64 || !verify(null, message, publicKey, signature)) fail("REMOTE_SIGNER_SIGNATURE_INVALID");
  payload.signature = signature.toString("base64url");
  const checked = config.role === "ROOT_REGISTRY" ? verifyEdgeTrustRegistry(payload, rootOptions)
    : verifyEdgeUpdateManifest(payload, { [config.keyId]: publicValue });
  if (!checked.ok) fail("REMOTE_SIGNER_PROTOCOL_VERIFY_FAILED");
  return { document: payload, evidence: { protocol: "observer-remote-signing-evidence-v1", role: config.role,
    signing_key_id: config.keyId, public_key_sha256: config.publicKeySha256, payload_sha256: digest(message),
    signed_document_sha256: digest(Buffer.from(JSON.stringify(payload))), algorithm: ALGORITHM,
    provider_signature_verified: true } };
}
