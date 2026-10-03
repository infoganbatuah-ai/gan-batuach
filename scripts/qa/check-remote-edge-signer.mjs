import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { signRemoteEdgeDocument } from "../release/remote-ed25519-signer.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { verifyEdgeTrustRegistry } from "../../services/video-gateway/edge-release-trust.mjs";

// Ephemeral fixtures test protocol compatibility, never real release custody.
const root = generateKeyPairSync("ed25519"), release = generateKeyPairSync("ed25519");
const publicBytes = key => key.publicKey.export({ format: "der", type: "spki" });
const arn = "arn:aws:kms:us-east-1:111122223333:key/11111111-2222-3333-4444-555555555555";
const config = (key, role, keyId) => ({ keyArn: arn, keyId, role,
  publicKeySha256: createHash("sha256").update(publicBytes(key)).digest("hex") });
const releaseConfig = config(release, "RELEASE_MANIFEST", "fixture-release");
const rootConfig = config(root, "ROOT_REGISTRY", "fixture-root");
function transport(key, changes = {}) {
  const calls = [];
  const call = async (operation, input) => {
    calls.push({ operation, input });
    assert.equal(input.KeyId, arn);
    if (operation === "describe-key") return { KeyMetadata: { Arn: arn, KeySpec: "ECC_NIST_EDWARDS25519",
      KeyUsage: "SIGN_VERIFY", KeyState: "Enabled", KeyManager: "CUSTOMER", Origin: "AWS_KMS", ...changes.meta } };
    if (operation === "get-public-key") return { KeyId: arn, KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      SigningAlgorithms: ["ED25519_SHA_512"], PublicKey: publicBytes(key).toString("base64"), ...changes.public };
    assert.equal(operation, "sign"); assert.equal(input.MessageType, "RAW"); assert.equal(input.SigningAlgorithm, "ED25519_SHA_512");
    return { KeyId: arn, SigningAlgorithm: "ED25519_SHA_512",
      Signature: sign(null, Buffer.from(input.Message, "base64"), key.privateKey).toString("base64"), ...changes.signature };
  };
  return { call, calls };
}
const manifest = { protocol: "observer-edge-update-v1", release_id: "fixture-home-release", version: "1.0.1",
  build_sha: "a".repeat(40), channel: "INTERNAL", platform: "darwin", architecture: "arm64", profile: "SOFTWARE_CONNECTOR",
  artifact_url: "https://example.test/fixture.tar.gz", artifact_sha256: "b".repeat(64), artifact_size: 123,
  signing_key_id: "fixture-release", compatibility: { minimum_current_version: "1.0.0", maximum_current_version: null,
    minimum_config_version: 1, maximum_config_version: 1, security_floor_version: "1.0.0" },
  released_at: new Date().toISOString(), rollout: { stage: "INTERNAL_QA", cohort_seed: "fixture-home",
    cohort_percent: 0, explicit_device_ids: ["fixture-device"] }, signature: "" };
const registry = { protocol: "observer-edge-trust-registry-v1", epoch: 1, issued_at: new Date().toISOString(),
  root_key_id: "fixture-root", keys: [{ key_id: "fixture-release", state: "TRUSTED", public_key: publicBytes(release).toString("base64url") }], signature: "" };
let cases = 0;
const good = transport(release);
const signed = await signRemoteEdgeDocument({ document: manifest, config: releaseConfig, call: good.call });
assert.equal(verifyEdgeUpdateManifest(signed.document, { "fixture-release": publicBytes(release).toString("base64url") }).ok, true);
assert.equal(good.calls.filter(x => x.operation === "sign").length, 1); cases++;
const trust = await signRemoteEdgeDocument({ document: registry, config: rootConfig, call: transport(root).call });
assert.equal(verifyEdgeTrustRegistry(trust.document, { pinnedRootKeyId: "fixture-root", pinnedRootPublicKey: publicBytes(root).toString("base64url") }).ok, true); cases++;
async function reject(document, cfg, provider, code, noSign = true) {
  await assert.rejects(signRemoteEdgeDocument({ document, config: cfg, call: provider.call }), new RegExp(code));
  if (noSign) assert.equal(provider.calls.some(x => x.operation === "sign"), false);
  cases++;
}
await reject(manifest, { ...releaseConfig, keyArn: "alias/mutable-alias" }, transport(release), "CONFIG_INVALID");
await reject(manifest, { ...releaseConfig, publicKeySha256: "0".repeat(64) }, transport(release), "PIN_MISMATCH");
await reject(manifest, releaseConfig, transport(release, { meta: { Origin: "EXTERNAL" } }), "CUSTODY_INVALID");
await reject(manifest, releaseConfig, transport(release, { meta: { KeyState: "Disabled" } }), "CUSTODY_INVALID");
await reject(manifest, releaseConfig, transport(release, { public: { SigningAlgorithms: ["ED25519_PH_SHA_512"] } }), "PUBLIC_KEY_INVALID");
await reject(manifest, releaseConfig, transport(release, { signature: { KeyId: arn.replace("555555555555", "666666666666") } }), "RESPONSE_INVALID", false);
await reject(manifest, releaseConfig, transport(release, { signature: { Signature: Buffer.alloc(64).toString("base64") } }), "SIGNATURE_INVALID", false);
await reject({ ...manifest, rollout: { ...manifest.rollout, cohort_percent: 100 } }, releaseConfig, transport(release), "TARGET_NOT_EXACT");
await reject({ ...manifest, artifact_url: `https://example.test/${"x".repeat(4096)}` }, releaseConfig, transport(release), "MESSAGE_SIZE_INVALID");
await reject({ ...registry, keys: [{ key_id: "fixture-root", public_key: publicBytes(root).toString("base64url"), state: "TRUSTED" }] }, rootConfig, transport(root), "SEPARATION_INVALID");
await reject({ ...registry, epoch: 0 }, rootConfig, transport(root), "REGISTRY_INVALID");
await assert.rejects(signRemoteEdgeDocument({ document: manifest, config: releaseConfig, call: async () => { throw new Error("provider-sensitive-detail"); } }), /^Error: REMOTE_SIGNER_PROVIDER_FAILED$/); cases++;
console.log(JSON.stringify({ result: "PASS", cases, evidence_level: "DETERMINISTIC_CONTRACT_TESTS", live_kms: "NOT_TESTED", private_release_keys_created: false }));
