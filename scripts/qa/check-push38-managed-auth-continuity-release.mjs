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
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.version, "0.2.40-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.buildSha,
  "d80fb794f0dac331191ff7620b757449dc260b74");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.digest,
  "2537bbb1007fd8698b059985888c5a1a7d613944cec79b5e72d7ae22165e5566");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.size, 147508278);
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.rollbackVersion, "0.2.36-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.role,
  "CONNECTOR_STARTUP_DISCOVERY_RECOVERY");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.connector.recoverablePriorFailure, null);
assert.equal(push38ManagedAuthActivationStateAllows("connector", { state: "ROLLED_BACK" }), true);
assert.equal(push38ManagedAuthActivationStateAllows("connector", { state: "UPDATE_FAILED",
  current_unchanged: true }), false);
assert.equal(push38ManagedAuthActivationStateAllows("gateway", { state: "HEALTHY" }), true);
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.version, "0.2.91-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.buildSha,
  "17439a2dea1d7c9b9386f2bc1a3b0e10ebdb24af");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.digest,
  "e9244d50c7251b0010ea1af656a690b4da477eb1e580c5a2e0f2b4f1c28944c6");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.size, 135897285);
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.rollbackVersion, "0.2.90-p38-health");
assert.equal(PUSH38_MANAGED_AUTH_CONTINUITY.gateway.role,
  "GATEWAY_MEDIA_ACQUISITION_CONTINUITY");
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
    "--connector-startup-recovery-upgrade", "--gateway-media-acquisition-upgrade",
    PUSH38_MANAGED_AUTH_CONTINUITY.connector.releaseId,
    PUSH38_MANAGED_AUTH_CONTINUITY.gateway.releaseId,
    "qa-p38-health-gateway-session-age-stability-26644a5e5900",
    "connector_managed_auth_continuity.json", "gateway_managed_auth_continuity.json"
  ]]
]) {
  const source = readFileSync(path, "utf8");
  for (const value of required) assert.ok(source.includes(value), `${path}:${value}`);
}

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
