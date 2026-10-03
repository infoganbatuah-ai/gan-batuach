import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayPlaybackSweepSerializationManifest,
  PUSH38_GATEWAY_PLAYBACK_SWEEP_SERIALIZATION as release } from
  "../../services/video-gateway/push38-home-qa-gateway-playback-sweep-serialization.mjs";
import { issuePush38GatewayPlaybackSweepSerialization } from
  "../release/issue-push38-home-qa-gateway-playback-sweep-serialization.mjs";
import { verifyEdgeUpdateManifest } from
  "../../services/video-gateway/edge-update-contract.mjs";
import { homeQaManagedPhaseAllows } from
  "../../services/video-gateway/home-qa-transition-phase.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayPlaybackSweepSerializationManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString()
}).document;
assert.equal(built.release_id, "qa-p38-health-gateway-playback-sweep-a3d66994bb01");
assert.equal(built.version, "0.2.69-p38-health");
assert.equal(built.build_sha, "bc6cdbc26fbc55fc3ff0927bb5dba96ea9420727");
assert.equal(built.artifact_sha256,
  "a3d66994bb014c94c8915c71bc179b40505ab3fd664e3f054b3d4e8a3f4e4fc7");
assert.equal(built.artifact_size, 135863386);
assert.equal(built.compatibility.minimum_current_version, "0.2.64-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.64-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [release.deviceId]);
const managedGateway = {
  gateway_id: release.deviceId,
  deployment_profile: release.profile,
  identity_scheme: "ED25519_V1",
  credential_version: 1,
  metadata: {
    home_qa_phase: "MANAGED_IDENTITY_VERIFIED",
    home_qa_proof_sha256: "a".repeat(64),
    home_qa_known_good_release_id: "qa-legacy-gateway-91bf6814075f"
  }
};
assert.equal(homeQaManagedPhaseAllows({ enrollment: managedGateway, manifest: built }), true);
assert.equal(homeQaManagedPhaseAllows({
  enrollment: { ...managedGateway, gateway_id: "00000000-0000-4000-8000-000000000000" },
  manifest: built
}), false);

for (const [path, required] of [
  ["scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", [
    "--gateway-playback-sweep",
    "observer-push38-gateway-playback-sweep-serialization-r2-publication-v1"
  ]],
  ["scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-playback-sweep",
    "gateway_remediation_playback_sweep_serialization.json",
    "failedShadowReleaseId"
  ]],
  ["scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-playback-sweep",
    "gateway_remediation_playback_sweep_serialization.json",
    "FAILED_SIGNED_SHADOW_PLAYBACK_SWEEP_SUCCESSOR_QUALIFIED"
  ]]
]) {
  const source = readFileSync(path, "utf8");
  for (const value of required) assert.match(source, new RegExp(value));
}

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-playback-sweep-test-"));
try {
  const output = join(temporary, "signed");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicDer = publicKey.export({ type: "spki", format: "der" });
  const { createHash } = await import("node:crypto");
  const keyArn = "arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001";
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: release.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: output, HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: keyArn,
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicDer).digest("hex") };
  const call = async (operation, input) => {
    if (operation === "describe-key") return { KeyMetadata: { Arn: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY", KeyState: "Enabled",
      KeyManager: "CUSTOMER", Origin: "AWS_KMS" } };
    if (operation === "get-public-key") return { KeyId: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      SigningAlgorithms: ["ED25519_SHA_512"], PublicKey: publicDer.toString("base64") };
    if (operation === "sign") return { KeyId: keyArn,
      SigningAlgorithm: "ED25519_SHA_512",
      Signature: sign(null, Buffer.from(input.Message, "base64"), privateKey).toString("base64") };
    throw new Error("unexpected operation");
  };
  await assert.rejects(issuePush38GatewayPlaybackSweepSerialization({
    env: { ...env, GITHUB_REF: "refs/heads/main" }, call }),
  /P38_GATEWAY_PLAYBACK_SWEEP_SIGNING_CONTEXT_INVALID/);
  const issued = await issuePush38GatewayPlaybackSweepSerialization({ env, call });
  assert.equal(issued.release_id, release.releaseId);
  const manifest = JSON.parse(readFileSync(join(output,
    "gateway_remediation_playback_sweep_serialization.json"), "utf8"));
  assert.equal(verifyEdgeUpdateManifest(manifest,
    { [env.SIGNER_KEY_ID]: publicDer.toString("base64url") }).ok, true);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

console.log("PUSH 38 Gateway playback/session-sweep serialization release QA: PASS");
