import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayHardwareRescueDeadlineManifest,
  gatewayHardwareRescueDeadlineBaselineAcceptable,
  PUSH38_GATEWAY_HARDWARE_RESCUE_DEADLINE as release } from
  "../../services/video-gateway/push38-home-qa-gateway-hardware-rescue-deadline.mjs";
import { issuePush38GatewayHardwareRescueDeadline } from
  "../release/issue-push38-home-qa-gateway-hardware-rescue-deadline.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { homeQaManagedPhaseAllows } from "../../services/video-gateway/home-qa-transition-phase.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayHardwareRescueDeadlineManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString()
}).document;
assert.equal(built.release_id, release.releaseId);
assert.equal(built.version, "0.2.80-p38-health");
assert.equal(built.build_sha, "a4bd57769d92e8abba4a9e89d8cc762b8ef83ba6");
assert.equal(built.artifact_sha256,
  "d8b7adb3f815b91ae186034a6c3dabb54cebad410c3df796ae1a6f120b1f0d94");
assert.equal(built.artifact_size, 135875494);
assert.equal(built.compatibility.minimum_current_version, "0.2.77-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.77-p38-health");
assert.equal(release.supersedesVersion, "0.2.79-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [release.deviceId]);
const managedGateway = { gateway_id: release.deviceId, deployment_profile: release.profile,
  identity_scheme: "ED25519_V1", credential_version: 1,
  metadata: { home_qa_phase: "MANAGED_IDENTITY_VERIFIED",
    home_qa_proof_sha256: "a".repeat(64),
    home_qa_known_good_release_id: "qa-legacy-gateway-91bf6814075f" } };
assert.equal(homeQaManagedPhaseAllows({ enrollment: managedGateway, manifest: built }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: { ...managedGateway,
  gateway_id: "00000000-0000-4000-8000-000000000000" }, manifest: built }), false);
const baseline = { status: "degraded", assigned: 10, connected: 9, failed: 1, empty: 6,
  progressing: 9, stalled: 0,
  reason_codes: ["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"],
  rotations: 0, last_rotation_reason: null, active_sessions: 1,
  authentication_rejected: 0, consecutive_failures: 0, responses_ok: 5,
  login_attempts: 1, login_succeeded: 1, proactive_attempts: 0, proactive_succeeded: 0 };
assert.equal(gatewayHardwareRescueDeadlineBaselineAcceptable(baseline), true);
assert.equal(gatewayHardwareRescueDeadlineBaselineAcceptable({ ...baseline,
  authentication_rejected: 1 }), false);

for (const [path, required] of [
  ["scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", [
    "--gateway-hardware-rescue-deadline",
    "observer-push38-gateway-hardware-rescue-deadline-r2-publication-v1"
  ]],
  ["scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-hardware-rescue-deadline", "gateway_remediation_hardware_rescue_deadline.json"
  ]],
  ["scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", [
    "--gateway-hardware-rescue-deadline", "gateway_remediation_hardware_rescue_deadline.json",
    "failedCanaryResultSha256"
  ]]
]) {
  const source = readFileSync(path, "utf8");
  for (const value of required) assert.ok(source.includes(value), `${path}:${value}`);
}

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-hardware-rescue-release-test-"));
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
    SIGNER_KEY_ARN: keyArn, SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicDer).digest("hex") };
  const call = async (operation, input) => {
    if (operation === "describe-key") return { KeyMetadata: { Arn: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY", KeyState: "Enabled",
      KeyManager: "CUSTOMER", Origin: "AWS_KMS" } };
    if (operation === "get-public-key") return { KeyId: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      SigningAlgorithms: ["ED25519_SHA_512"], PublicKey: publicDer.toString("base64") };
    if (operation === "sign") return { KeyId: keyArn, SigningAlgorithm: "ED25519_SHA_512",
      Signature: sign(null, Buffer.from(input.Message, "base64"), privateKey).toString("base64") };
    throw new Error("unexpected operation");
  };
  const issued = await issuePush38GatewayHardwareRescueDeadline({ env, call });
  assert.equal(issued.release_id, release.releaseId);
  const manifest = JSON.parse(readFileSync(join(output,
    "gateway_remediation_hardware_rescue_deadline.json"), "utf8"));
  assert.equal(verifyEdgeUpdateManifest(manifest,
    { [env.SIGNER_KEY_ID]: publicDer.toString("base64url") }).ok, true);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log("PUSH 38 Gateway hardware-rescue deadline release QA: PASS");
