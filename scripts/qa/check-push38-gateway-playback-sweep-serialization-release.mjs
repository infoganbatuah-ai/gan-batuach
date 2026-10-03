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
import { hasQualifiedHandoffEncoderState } from
  "./push38-shadow-qualification-policy.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayPlaybackSweepSerializationManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString()
}).document;
assert.equal(built.release_id, "qa-p38-health-gateway-hardware-output-rescue-f43358023c15");
assert.equal(built.version, "0.2.74-p38-health");
assert.equal(built.build_sha, "d6403447eded40e341f01b2067ccacf8d564a657");
assert.equal(built.artifact_sha256,
  "f43358023c15d975003fa86a41cdd53ced8f2f70294f65ff4b9ddb98f01e06b4");
assert.equal(built.artifact_size, 135864508);
assert.equal(built.compatibility.minimum_current_version, "0.2.73-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.73-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [release.deviceId]);
assert.equal(release.failedV8Version, "0.2.73-p38-health");
assert.equal(release.failedV8ResultSha256,
  "3ace610558222f06c694defbeb316a64f262a9c5f5ceb31db185b968a7bc9fc9");
assert.equal(release.failedV8CheckpointsSha256,
  "80c5bba8ab1f22790656735ca6b2168352f3e617d12c8e99e18960f965b6afbc");
const retainedHlsCheckpoint = {
  shadow: { media: { progressing: 0, renewing: 1, available: 1, stalled: 0,
    inputs: [{ encoder: null, renewing: true, playback_continuity: true,
      owner_state: "RENEWING", media_owner_state: "RETAINED_HLS" }] } },
  renewal: { status: 200, playlist_status: 200, segment_status: 200, segment_bytes: 1 }
};
assert.equal(hasQualifiedHandoffEncoderState(retainedHlsCheckpoint), true);
assert.equal(hasQualifiedHandoffEncoderState({ ...retainedHlsCheckpoint,
  renewal: { ...retainedHlsCheckpoint.renewal, segment_status: 500 } }), false);
assert.equal(hasQualifiedHandoffEncoderState({ shadow: { media: { inputs: [
  { encoder: "videotoolbox" }
] } } }), true);
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
    "failedV8ReleaseId"
  ]],
  ["scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-playback-sweep",
    "gateway_remediation_playback_sweep_serialization.json",
    "P38_GATEWAY_PLAYBACK_SWEEP_FAILED_V8_PROOF_INVALID",
    "failed-v8-evidence",
    "failed-v8-checkpoints"
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
