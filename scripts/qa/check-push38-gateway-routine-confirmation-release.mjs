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
import { classifyBoundedOutputRescueRejection, evaluateHlsRenewalContinuity
} from "./push38-shadow-qualification-policy.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayRoutineConfirmationManifest({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.52-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.46-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.46-p38-health");
assert.equal(item.supersedesReleaseId,
  "qa-p38-health-gateway-freshness-continuity-6bfd6f957cd2");
assert.equal(item.supersedesVersion, "0.2.51-p38-health");
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
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-exclusive-rescue-1364e15a3eb5",
  version: "0.2.48-p38-health" } }), false,
"the failed shadow release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-native-end-2609b946f06b",
  version: "0.2.49-p38-health" } }), false,
"the failed native-end shadow release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-prestale-rescue-7c7f559bcd91",
  version: "0.2.50-p38-health" } }), false,
"the superseded pre-stale shadow release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-freshness-continuity-6bfd6f957cd2",
  version: "0.2.51-p38-health" } }), false,
"the rejected freshness-continuity shadow release remains historical and cannot authorize activation");
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

const renewal = (sequence, seconds, hash) => ({ observed_at: new Date(seconds * 1_000).toISOString(),
  renewal: { status: 200, playlist_status: 200, segment_status: 200, segment_bytes: 1024,
    media_sequence: Math.max(0, sequence - 3), latest_segment_sequence: sequence,
    target_duration_seconds: 6, playlist_sha256: `${hash}`.repeat(64),
    segment_sha256: `${hash}`.repeat(64) } });
assert.equal(evaluateHlsRenewalContinuity([
  renewal(10, 0, "a"), renewal(10, 5, "a"), renewal(11, 10, "b")]).pass, true);
assert.equal(evaluateHlsRenewalContinuity([
  renewal(10, 0, "a"), renewal(10, 15, "a"), renewal(11, 20, "b")]).reason,
"PLAYLIST_FRESHNESS_EXCEEDED");
assert.equal(evaluateHlsRenewalContinuity([
  renewal(10, 0, "a"), renewal(9, 5, "b")]).reason, "SEQUENCE_REGRESSION");
const continuityPoint = (sequence, failures, handoffs, result = null) => ({ sequence,
  observed_at: new Date(sequence * 10_000).toISOString(),
  renewal: { status: 200, playlist_status: 200, segment_status: 200, segment_bytes: 1024 },
  shadow: { media: { progressing: 1, stalled: 0,
    inputs: [{ owner_state: "CURRENT", canonical_owner_progressing: true }],
    lifecycle: { warmHandoffFailures: failures, warmHandoffs: handoffs },
    source_diagnostics: [{ last_handoff_result: result }] } } });
const containedLifecycle = { warmHandoffFailures: 1, warmHandoffConfirmationFailures: 1,
  warmHandoffs: 4, warmHandoffRollbacks: 0, staleInput: 0, stalePlaylist: 0, staleOnRequest: 0,
  inputSocketError: 0, upstreamFailed: 0, startsByReason: { recovery: 0 },
  warmHandoffFailuresByMode: { outputRescue: 1 } };
assert.equal(classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), continuityPoint(2, 1, 3),
  continuityPoint(3, 1, 4, "PROMOTED")], containedLifecycle).pass, true);
const candidateContinuity = continuityPoint(2, 1, 3);
candidateContinuity.shadow.media.inputs[0] = { owner_state: "WARMING_CONTINUITY",
  canonical_owner_progressing: false, candidate_progressing: true };
assert.equal(classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), candidateContinuity,
  continuityPoint(3, 1, 4, "PROMOTED")], containedLifecycle).pass, true);
const lostContinuity = continuityPoint(2, 1, 3);
lostContinuity.shadow.media.progressing = 0;
lostContinuity.shadow.media.stalled = 1;
lostContinuity.shadow.media.inputs[0] = { owner_state: "NONE",
  canonical_owner_progressing: false, candidate_progressing: false };
assert.equal(classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), lostContinuity], containedLifecycle).pass, false);
const multipleContainedLifecycle = { ...containedLifecycle, warmHandoffFailures: 2,
  warmHandoffConfirmationFailures: 2, warmHandoffs: 5,
  warmHandoffFailuresByMode: { outputRescue: 2 } };
assert.equal(classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), continuityPoint(2, 1, 3),
  continuityPoint(7, 1, 4, "PROMOTED"), continuityPoint(14, 2, 4),
  continuityPoint(15, 2, 5, "PROMOTED")], multipleContainedLifecycle).pass, true,
"multiple contained rejections remain bounded only with preserved media and more successful promotions");

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
