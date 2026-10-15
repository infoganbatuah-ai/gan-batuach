import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38ManagedAuthContinuityManifest, push38ManagedAuthActivationStateAllows,
  PUSH38_MANAGED_AUTH_CONTINUITY } from
  "../../services/video-gateway/push38-home-qa-managed-auth-continuity.mjs";
import { canonicalEdgeUpdateManifest, verifyEdgeUpdateManifest } from
  "../../services/video-gateway/edge-update-contract.mjs";
import { homeQaManagedPhaseAllows } from
  "../../services/video-gateway/home-qa-transition-phase.mjs";
import { issuePush38ManagedAuthContinuity } from
  "../release/issue-push38-home-qa-managed-auth-continuity.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
for (const component of ["connector", "gateway"]) {
  const item = PUSH38_MANAGED_AUTH_CONTINUITY[component];
  const built = buildPush38ManagedAuthContinuityManifest({ component,
    signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
    releasedAt: new Date().toISOString() }).document;
  assert.equal(built.release_id, item.releaseId);
  assert.equal(built.version, item.version);
  assert.equal(built.build_sha, item.buildSha);
  assert.equal(built.artifact_sha256, item.digest);
  assert.equal(built.artifact_size, item.size);
  assert.equal(built.compatibility.minimum_current_version, item.rollbackVersion);
  assert.equal(built.compatibility.maximum_current_version, item.rollbackVersion);
  assert.equal(built.rollout.cohort_percent, 0);
  assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);
}
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.version, "0.2.41-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.buildSha,
  "c14ac38bf7b1e2313b8509a5204aee23c8c4e9aa");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.digest,
  "d612f4855281fd7aeadf02b283db3c7f64c5c2585503530140abd6876a8b8790");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.size, 147512735);
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.rollbackVersion, "0.2.40-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.role,
  "CONNECTOR_RTSP_RECOVERY_CONTINUITY");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.recoverablePriorFailure, null);
assert.equal(push38ManagedAuthActivationStateAllows("connector", { state: "ROLLED_BACK" }), true);
assert.equal(push38ManagedAuthActivationStateAllows("connector", { state: "UPDATE_FAILED",
  current_unchanged: true }), false);
assert.equal(push38ManagedAuthActivationStateAllows("gateway", { state: "HEALTHY" }), true);
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.version, "0.2.100-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.buildSha,
  "133a8ac6dfe8e71952807bf5949db8e31c517f6e");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.digest,
  "2ea87aca47a1cf28fbc63f7186df6b0adc90d6bd12ce11fb9c9f6a4657a59201");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.size, 135902672);
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.rollbackVersion, "0.2.99-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.role,
  "GATEWAY_STALE_EPOCH_FINITE_SWEEP");
const gateway = PUSH38_MANAGED_AUTH_CONTINUITY.gateway;
const gatewayManifest = buildPush38ManagedAuthContinuityManifest({ component: "gateway",
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString() }).document;
assert.equal(homeQaManagedPhaseAllows({ enrollment: {
  gateway_id: gateway.deviceId,
  deployment_profile: gateway.profile,
  identity_scheme: "ED25519_V1",
  credential_version: 1,
  metadata: { home_qa_phase: "MANAGED_IDENTITY_VERIFIED",
    home_qa_proof_sha256: "a".repeat(64),
    home_qa_known_good_release_id: "qa-legacy-gateway-91bf6814075f" }
}, manifest: gatewayManifest }), true);

for (const [path, required] of [
  ["scripts/release/publish-push38-managed-auth-continuity-r2.mjs", [
    "observer-push38-managed-auth-continuity-r2-publication-v1",
    "anonymous_access_denied: true", "expiresIn: 120"
  ]],
  ["scripts/qa/register-push38-homeqa-managed-auth-continuity.mjs", [
    "MANAGED_AUTH_CONTINUITY_REGISTERED_DRAFT", "cohort_percent<>0",
    "MANAGED_IDENTITY_VERIFIED", "status='PAUSED' and cohort_percent=0",
    "target_filters->'explicit_device_ids'=jsonb_build_array"
  ]],
  ["scripts/qa/activate-push38-homeqa-managed-auth-continuity.mjs", [
    "ota_agent_owns_install: true", "EXACT_MANAGED_AUTH_CONTINUITY_ROLLOUT_ACTIVE",
    "rollback_release_id"
  ]],
  ["scripts/qa/install-push38-homeqa-ota-agent.mjs", [
    "--connector-rtsp-recovery-continuity-upgrade", "--gateway-stale-epoch-finite-sweep-upgrade",
    PUSH38_MANAGED_AUTH_CONTINUITY.connector.releaseId,
    PUSH38_MANAGED_AUTH_CONTINUITY.gateway.releaseId,
    "qa-p38-health-gateway-session-age-stability-26644a5e5900",
    "connector_managed_auth_continuity.json", "gateway_managed_auth_continuity.json"
  ]]
]) {
  const source = readFileSync(path, "utf8");
  for (const value of required) assert.ok(source.includes(value), `${path}:${value}`);
}
const installerSource = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const staleEpochPrior = installerSource.slice(
  installerSource.indexOf("priorManagement: gatewayStaleEpochFiniteSweepUpgrade ? {"),
  installerSource.indexOf("gatewayFiniteExitClassificationUpgrade ? {",
    installerSource.indexOf("priorManagement: gatewayStaleEpochFiniteSweepUpgrade ? {")));
assert.ok(staleEpochPrior.includes(
  'release_id: "qa-p38-health-gateway-exclusive-handoff-retention-1fb10cf04dd4"'));
assert.ok(staleEpochPrior.includes(
  'artifact_sha256: "1fb10cf04dd4d4e4273c7fd92d40a1351e22ff59ab40449503f84a40d2d1e3ac"'));

const pair = generateKeyPairSync("ed25519");
const publicDer = pair.publicKey.export({ format: "der", type: "spki" });
const keyArn =
  "arn:aws:kms:us-east-1:111122223333:key/00000000-0000-4000-8000-000000000001";
const temporary = mkdtempSync(join(tmpdir(), "observer-p38-managed-auth-release-test-"));
try {
  const result = await issuePush38ManagedAuthContinuity({ env: {
    GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing",
    GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: PUSH38_MANAGED_AUTH_CONTINUITY.gateway.buildSha,
    HOME_QA_COMPONENT: "gateway",
    RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "out"),
    SIGNER_KEY_ARN: keyArn,
    SIGNER_KEY_ID: "observer-kms-release-v1",
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicDer).digest("hex"),
    HOME_QA_R2_ORIGIN: origin
  }, call: async (operation, input) => {
    if (operation === "describe-key") return { KeyMetadata: { Arn: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      KeyState: "Enabled", KeyManager: "CUSTOMER", Origin: "AWS_KMS" } };
    if (operation === "get-public-key") return { KeyId: keyArn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY",
      SigningAlgorithms: ["ED25519_SHA_512"], PublicKey: publicDer.toString("base64") };
    if (operation === "sign") return { KeyId: keyArn,
      Signature: sign(null, Buffer.from(input.Message, "base64"), pair.privateKey).toString("base64"),
      SigningAlgorithm: "ED25519_SHA_512" };
    throw new Error("unexpected operation");
  } });
  assert.equal(result.length, 1);
  assert.equal(result[0].component, "gateway");
  assert.ok(result.every(item => item.signature_verified));
  assert.equal(lstatSync(join(temporary, "out")).isDirectory(), true);
  for (const component of ["gateway"]) {
    const document = buildPush38ManagedAuthContinuityManifest({ component,
      signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
      releasedAt: new Date().toISOString() }).document;
    document.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(document)), pair.privateKey)
      .toString("base64url");
    assert.equal(verifyEdgeUpdateManifest(document,
      { "observer-kms-release-v1": publicDer.toString("base64url") }).ok, true);
  }
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", exact_devices: 2, broad_cohort: false,
  protected_aws_signing_required: true, rollback_bound: true }));
