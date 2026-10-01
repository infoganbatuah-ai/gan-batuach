import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPush38GatewayRoutineConfirmationManifest,
  gatewayRoutineConfirmationBaselineSessionAcceptable,
  gatewayRoutineConfirmationLegacyRuntimeAcceptable,
  PUSH38_GATEWAY_ROUTINE_CONFIRMATION as item } from
  "../../services/video-gateway/push38-home-qa-gateway-routine-confirmation.mjs";
import { issuePush38GatewayRoutineConfirmation } from
  "../release/issue-push38-home-qa-gateway-routine-confirmation.mjs";
import { HOME_QA_PHASE, homeQaManagedPhaseAllows } from
  "../../services/video-gateway/home-qa-transition-phase.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayRoutineConfirmationManifest({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.47-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.46-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.46-p38-health");
assert.equal(built.rollout.cohort_percent, 0);
assert.deepEqual(built.rollout.explicit_device_ids, [item.deviceId]);
const enrollment = { identity_scheme: "ED25519_V1", credential_version: 1,
  gateway_id: item.deviceId, deployment_profile: item.profile,
  metadata: { home_qa_phase: HOME_QA_PHASE.VERIFIED,
    home_qa_proof_sha256: "c".repeat(64),
    home_qa_known_good_release_id: "qa-legacy-gateway-91bf6814075f" } };
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: built }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-routine-confirmation-5cdf47d35b44",
  version: "0.2.46-p38-health" } }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: { ...enrollment,
  gateway_id: "wrong-gateway" }, manifest: built }), false);

const healthySession = { rotations: 1, last_rotation_reason: "proactive_nonexclusive_renewal",
  login_attempts: 2, login_succeeded: 2, proactive_attempts: 1, proactive_succeeded: 1,
  active_sessions: 1, responses_ok: 421, consecutive_failures: 0, authentication_rejected: 0 };
assert.equal(gatewayRoutineConfirmationBaselineSessionAcceptable(healthySession), true);
assert.equal(gatewayRoutineConfirmationBaselineSessionAcceptable({ ...healthySession,
  proactive_succeeded: 0 }), false);
assert.equal(gatewayRoutineConfirmationBaselineSessionAcceptable({ ...healthySession,
  authentication_rejected: 1 }), false);
assert.equal(gatewayRoutineConfirmationBaselineSessionAcceptable({ ...healthySession,
  active_sessions: 2 }), false);
assert.equal(gatewayRoutineConfirmationBaselineSessionAcceptable({ ...healthySession,
  rotations: 0, last_rotation_reason: null, login_attempts: 1, login_succeeded: 1,
  proactive_attempts: 0, proactive_succeeded: 0 }), true);
const boundedLegacyRuntime = { ...healthySession, status: "degraded", assigned: 10,
  connected: 7, failed: 3, empty: 6, progressing: 8, stalled: 1,
  reason_codes: ["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"] };
assert.equal(gatewayRoutineConfirmationLegacyRuntimeAcceptable(boundedLegacyRuntime), true);
assert.equal(gatewayRoutineConfirmationLegacyRuntimeAcceptable({ ...boundedLegacyRuntime,
  progressing: 7 }), false);
assert.equal(gatewayRoutineConfirmationLegacyRuntimeAcceptable({ ...boundedLegacyRuntime,
  connected: 6, failed: 4, progressing: 9 }), false);
assert.equal(gatewayRoutineConfirmationLegacyRuntimeAcceptable({ ...boundedLegacyRuntime,
  reason_codes: [...boundedLegacyRuntime.reason_codes, "UNEXPECTED_INTEGRITY_FAILURE"] }), false);

const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-routine-confirmation-test-"));
try {
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", GITHUB_SHA: "a".repeat(40),
    PUSH38_CANDIDATE_SHA: item.buildSha, RUNNER_TEMP: temporary,
    HOME_QA_OUTPUT_DIR: join(temporary, "signed"), HOME_QA_R2_ORIGIN: origin,
    SIGNER_KEY_ARN: "arn:aws:kms:il-central-1:123456789012:key/test",
    SIGNER_KEY_ID: "observer-kms-release-v1", SIGNER_PUBLIC_KEY_SHA256: "b".repeat(64) };
  await assert.rejects(issuePush38GatewayRoutineConfirmation({ env: { ...env,
    GITHUB_REF: "refs/heads/main" }, call: async () => ({}) }),
  /P38_GATEWAY_ROUTINE_CONFIRMATION_SIGNING_CONTEXT_INVALID/);
  const registration = readFileSync("scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const activation = readFileSync("scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
  const publisher = readFileSync("scripts/release/publish-push38-gateway-finite-stream-handoff-r2.mjs", "utf8");
  const retry = readFileSync(
    "scripts/qa/retry-push38-homeqa-gateway-routine-confirmation-after-diagnostic-isolation.mjs", "utf8");
  for (const source of [registration, activation, publisher])
    assert.match(source, /--gateway-routine-confirmation/);
  assert.match(publisher, /observer-push38-gateway-routine-confirmation-r2-publication-v1/);
  assert.match(activation, /if \(recoveryContinuity \|\| routineConfirmation\)/);
  assert.match(activation, /P38_GATEWAY_ROUTINE_CONFIRMATION_FAILED_PRE_SOAK_PROOF_INVALID/);
  assert.match(activation, /FAILED_PRE_SOAK_ROUTINE_CONFIRMATION_SUCCESSOR_QUALIFIED/);
  assert.match(activation, /activeRetriedPredecessorState = routineConfirmation/);
  assert.doesNotMatch(activation, /routine_confirmation_budget_fault_reproduced/);
  assert.match(activation,
    /confirmedWarmHandoff:[^\n]+handoffOwnerContinuity,[\s\S]*boundedWarmupFailure:[\s\S]*routineConfirmation/);
  assert.doesNotMatch(activation,
    /confirmedWarmHandoff:[^\n]+routineConfirmation/);
  assert.match(activation, /mediaContinuity: recoveryContinuity \|\| routineConfirmation/);
  for (const token of ["authorizeQuarantinedReleaseRetry", "CONTROLLED_GATEWAY_PAUSE_FOR_SIGNED_SHADOW_DIAGNOSTIC",
    "prior_healthy_duration_ms", "gatewayRetryBaselineSafe", "recorderSessionLifecycle",
    "recorderSessionHeartbeat", "camera_runtime_writes_by_command: 0", "ota_agent_owns_install: true"])
    assert.match(retry, new RegExp(token));
  assert.match(retry, /healthyDurationMs < 60 \* 60_000/);
  assert.match(retry, /rollout\.retry_status !== "ACTIVE"/);
  assert.match(retry, /\["DRAFT", "PAUSED"\]\.includes\(rollout\.successor_status\)/);
  assert.doesNotMatch(retry, /launchctl[^\n]+bootout|adapter\.restart|manager\.apply/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId }));
