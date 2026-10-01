import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayRecoveryContinuityManifest,
  PUSH38_GATEWAY_RECOVERY_CONTINUITY as item } from
  "../../services/video-gateway/push38-home-qa-gateway-recovery-continuity.mjs";
import { issuePush38GatewayRecoveryContinuity } from
  "../release/issue-push38-home-qa-gateway-recovery-continuity.mjs";
import { HOME_QA_PHASE, homeQaManagedPhaseAllows } from
  "../../services/video-gateway/home-qa-transition-phase.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayRecoveryContinuityManifest({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.42-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.41-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.41-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);
const enrollment = { identity_scheme: "ED25519_V1", credential_version: 1,
  gateway_id: item.deviceId, deployment_profile: item.profile,
  metadata: { home_qa_phase: HOME_QA_PHASE.VERIFIED,
    home_qa_proof_sha256: "c".repeat(64),
    home_qa_known_good_release_id: "qa-legacy-gateway-91bf6814075f" } };
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: built }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: { ...enrollment,
  gateway_id: "wrong-gateway" }, manifest: built }), false);

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-recovery-continuity-test-"));
try {
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:il-central-1:123456789012:key/test",
    SIGNER_KEY_ID: "observer-kms-release-v1", SIGNER_PUBLIC_KEY_SHA256: "b".repeat(64) };
  await assert.rejects(issuePush38GatewayRecoveryContinuity({ env: { ...env,
    GITHUB_REF: "refs/heads/main" }, call: async () => ({}) }),
  /P38_GATEWAY_RECOVERY_CONTINUITY_SIGNING_CONTEXT_INVALID/);
  const registration = readFileSync("scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const activation = readFileSync("scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const publisher = readFileSync("scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", "utf8");
  for (const source of [registration, activation, publisher])
    assert.match(source, /--gateway-recovery-continuity/);
  assert.match(publisher, /observer-push38-gateway-recovery-continuity-r2-publication-v1/);
  assert.match(activation, /P38_GATEWAY_RECOVERY_CONTINUITY_FAILED_PROOF_INVALID/);
  assert.match(activation, /mediaContinuity: recoveryContinuity/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId }));
