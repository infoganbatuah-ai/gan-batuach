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
import { classifyBoundedOutputRescueRejection, classifyContainedOwnerRecovery,
  evaluateHlsRenewalContinuity, evaluateShadowMeasurementReadiness
} from "./push38-shadow-qualification-policy.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const built = buildPush38GatewayRoutineConfirmationManifest({ signingKeyId: "observer-kms-release-v1",
  artifactOrigin: origin, releasedAt: new Date().toISOString() }).document;
assert.equal(built.release_id, item.releaseId);
assert.equal(built.version, "0.2.65-p38-health");
assert.equal(built.build_sha, item.buildSha);
assert.equal(built.artifact_sha256, item.digest);
assert.equal(built.artifact_size, item.size);
assert.equal(built.compatibility.minimum_current_version, "0.2.64-p38-health");
assert.equal(built.compatibility.maximum_current_version, "0.2.64-p38-health");
assert.equal(item.supersedesReleaseId,
  "qa-p38-health-gateway-health-serialization-dee178ab7c45");
assert.equal(item.supersedesVersion, "0.2.64-p38-health");
assert.equal(item.failedLiveCanaryReleaseId,
  "qa-p38-health-gateway-health-serialization-dee178ab7c45");
assert.equal(item.failedLiveCanaryVersion, "0.2.64-p38-health");
assert.equal(item.failedHealthSerializationPredecessorReleaseId,
  "qa-p38-health-gateway-finite-owner-exit-79141a089f25");
assert.equal(item.failedHealthSerializationPredecessorVersion, "0.2.63-p38-health");
assert.equal(item.quarantinedRuntimeReleaseId,
  "qa-p38-health-gateway-exclusive-reuse-8b32513d7591");
assert.equal(item.quarantinedRuntimeVersion, "0.2.58-p38-health");
assert.equal(item.failedCandidateReleaseId,
  "qa-p38-health-gateway-rescue-probation-direct-9a9a29bfb861");
assert.equal(item.failedCandidateVersion, "0.2.57-p38-health");
assert.equal(item.failedHealthCandidateReleaseId,
  "qa-p38-health-gateway-body-blocked-reuse-55a5a7a7f8bd");
assert.equal(item.failedHealthCandidateVersion, "0.2.59-p38-health");
assert.equal(item.failedContinuityCandidateReleaseId,
  "qa-p38-health-gateway-handoff-health-4fd9e7b95e77");
assert.equal(item.failedContinuityCandidateVersion, "0.2.60-p38-health");
assert.equal(item.failedAcquisitionCandidateReleaseId,
  "qa-p38-health-gateway-exclusive-reopen-9053fd23eb8e");
assert.equal(item.failedAcquisitionCandidateVersion, "0.2.61-p38-health");
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
  version: "0.2.46-p38-health" } }), false,
"the quarantined bridge remains historical and cannot authorize activation");
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
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-rescue-backoff-52ada54c94f6",
  version: "0.2.52-p38-health" } }), false,
"the bridge-pinned draft remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-rescue-backoff-direct-58fcb000d83e",
  version: "0.2.53-p38-health" } }), false,
"the failed HLS-deadline shadow release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-hls-deadline-direct-0ccacdfadd8a",
  version: "0.2.54-p38-health" } }), false,
"the scheduler-deadline shadow release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-hls-scheduler-direct-a8dec0815521",
  version: "0.2.55-p38-health" } }), false,
"the fallback-window regression release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-hls-window-direct-59572f35f8cc",
  version: "0.2.56-p38-health" } }), false,
"the superseded clipped-probation release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-rescue-probation-direct-9a9a29bfb861",
  version: "0.2.57-p38-health" } }), false,
"the failed exclusive reacquisition release remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-exclusive-reuse-8b32513d7591",
  version: "0.2.58-p38-health" } }), false,
"the failed canary release remains historical and cannot authorize a new activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-body-blocked-reuse-55a5a7a7f8bd",
  version: "0.2.59-p38-health" } }), false,
"the failed health-aggregation Shadow remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-handoff-health-4fd9e7b95e77",
  version: "0.2.60-p38-health" } }), false,
"the failed exclusive-continuity Shadow remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-exclusive-reopen-9053fd23eb8e",
  version: "0.2.61-p38-health" } }), false,
"the failed acquisition-boundary Shadow remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-exclusive-acquisition-retry-from-hls-window-86fa5a9253a9",
  version: "0.2.62-p38-health" } }), false,
"the failed finite-owner-exit canary remains historical and cannot authorize activation");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-finite-owner-exit-79141a089f25",
  version: "0.2.63-p38-health" } }), false,
"the evidence-bound health-serialization predecessor remains eligible as the exact signed rollback base");
assert.equal(homeQaManagedPhaseAllows({ enrollment, manifest: { ...built,
  release_id: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  version: "0.2.64-p38-health" } }), true,
"the failed owner-recovery canary predecessor remains historical and cannot authorize activation");
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
const readinessPoint = (observedAt, sequence) => ({
  observed_at: observedAt,
  renewals: [{ channel: 1, playback: {
    status: 200, playlist_status: 200, segment_status: 200, segment_bytes: 1024,
    media_sequence: sequence, latest_segment_sequence: sequence + 10,
    target_duration_seconds: 1,
    playlist_sha256: `${sequence + 1}`.padStart(64, "a").slice(-64),
    segment_sha256: `${sequence + 1}`.padStart(64, "b").slice(-64)
  } }],
  shadow: {
    http: 200,
    discovery: { assigned: 1, connected: 1 },
    media: { progressing: 1, renewing: 0, stalled: 0,
      candidate_handoffs: 0, provisional_handoffs: 0 }
  }
});
const readyWindow = [
  readinessPoint("2026-10-03T00:00:00.000Z", 1),
  readinessPoint("2026-10-03T00:00:15.000Z", 2),
  readinessPoint("2026-10-03T00:00:30.000Z", 3)
];
assert.equal(evaluateShadowMeasurementReadiness(readyWindow).pass, true);
const recoveringWindow = readyWindow.map((point, index) => index === 1
  ? { ...point, shadow: { ...point.shadow,
    media: { ...point.shadow.media, progressing: 0, renewing: 1 } } } : point);
assert.equal(evaluateShadowMeasurementReadiness(recoveringWindow).reason,
  "COMPONENT_NOT_STABLE");
assert.equal(evaluateShadowMeasurementReadiness([
  readinessPoint("2026-10-03T00:00:00.000Z", 1),
  readinessPoint("2026-10-03T00:00:15.000Z", 1),
  readinessPoint("2026-10-03T00:00:30.000Z", 1)
]).reason, "PLAYLIST_FRESHNESS_EXCEEDED");
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
const containedAcquisitionLifecycle = { ...containedLifecycle,
  warmHandoffConfirmationFailures: 0 };
assert.equal(classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), continuityPoint(2, 1, 3),
  continuityPoint(3, 1, 4, "PROMOTED")], containedAcquisitionLifecycle).pass, true,
"a bounded pre-confirmation candidate rejection is safe only with preserved media");
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
assert.equal(classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), lostContinuity], containedAcquisitionLifecycle).pass, false,
"an acquisition rejection with a media gap remains a hard failure");
const multipleContainedLifecycle = { ...containedLifecycle, warmHandoffFailures: 2,
  warmHandoffConfirmationFailures: 2, warmHandoffs: 5,
  warmHandoffFailuresByMode: { outputRescue: 2 } };
assert.equal(classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), continuityPoint(2, 1, 3),
  continuityPoint(7, 1, 4, "PROMOTED"), continuityPoint(14, 2, 4),
  continuityPoint(15, 2, 5, "PROMOTED")], multipleContainedLifecycle).pass, true,
"multiple contained rejections remain bounded only with preserved media and more successful promotions");
const batchedContained = classifyBoundedOutputRescueRejection([
  continuityPoint(1, 0, 3), continuityPoint(14, 2, 4),
  continuityPoint(15, 2, 5, "PROMOTED")], multipleContainedLifecycle);
assert.equal(batchedContained.pass, true,
"multiple contained rejections sampled together retain their exact counter cardinality");
assert.deepEqual(batchedContained.failure_checkpoints, [{ sequence: 14, count: 2 }]);
const ownerRecoveryPoint = continuityPoint(2, 0, 0);
ownerRecoveryPoint.shadow.media.lifecycle = { staleInput: 0, stalePlaylist: 0,
  staleOnRequest: 0, startsByReason: { recovery: 0 } };
ownerRecoveryPoint.shadow.media.source_diagnostics[0] = { channel: 4,
  last_handoff_result: "OWNER_RECOVERED",
  last_failure_reason: "OUTPUT_RESCUE_OWNER_RECOVERED",
  last_failure_at: ownerRecoveryPoint.observed_at };
assert.equal(classifyContainedOwnerRecovery([
  continuityPoint(1, 0, 0), ownerRecoveryPoint]).pass, true,
"a contained owner recovery is valid only when the canonical owner and playback stay current");
const ownerRecoveryGap = structuredClone(ownerRecoveryPoint);
ownerRecoveryGap.renewal.segment_bytes = 0;
assert.equal(classifyContainedOwnerRecovery([
  continuityPoint(1, 0, 0), ownerRecoveryGap]).pass, false,
"an owner recovery with a playback gap remains rejected");

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
  const healthSerializationRetry = readFileSync(
    "scripts/qa/retry-push38-homeqa-gateway-health-serialization-after-shadow-isolation.mjs", "utf8");
  for (const source of [registration, activation, publisher])
    assert.match(source, /--gateway-routine-confirmation/);
  assert.match(publisher, /observer-push38-gateway-routine-confirmation-r2-publication-v1/);
  assert.match(activation, /const proactiveSuccessor = playbackSweep \|\| proactiveExclusive/);
  assert.match(activation, /if \(playbackSweep\) \{/);
  assert.match(activation, /P38_GATEWAY_PLAYBACK_SWEEP_FAILED_CANARY_PROOF_INVALID/);
  assert.match(activation,
    /if \(recoveryContinuity \|\| routineConfirmation \|\| sessionRenewal \|\| proactiveExclusive\)/);
  assert.match(activation, /P38_GATEWAY_ROUTINE_CONFIRMATION_FAILED_PRE_SOAK_PROOF_INVALID/);
  assert.match(activation, /FAILED_PRE_SOAK_ROUTINE_CONFIRMATION_SUCCESSOR_QUALIFIED/);
  assert.match(activation,
    /activeRetriedPredecessorState = \(routineConfirmation \|\| sessionRenewal \|\| proactiveSuccessor\)/);
  assert.doesNotMatch(activation, /routine_confirmation_budget_fault_reproduced/);
  assert.match(activation,
    /confirmedWarmHandoff:[^\n]+handoffOwnerContinuity,[\s\S]*boundedWarmupFailure:[\s\S]*routineConfirmation/);
  assert.doesNotMatch(activation,
    /confirmedWarmHandoff:[^\n]+routineConfirmation/);
  assert.match(activation,
    /mediaContinuity: recoveryContinuity \|\| routineConfirmation \|\| sessionRenewal \|\| proactiveSuccessor/);
  assert.match(activation, /expectedRelease: item, expectedChannel: shadowChannel/);
  assert.match(activation, /qualifiedOwnerContinuity/);
  assert.match(activation, /qualified_shadow_channel: shadowChannel/);
  assert.match(activation,
    /final_verification\?\.terminal_verification === true[\s\S]*value\.final_verification/,
  "activation must count the runner's terminal playback and health verification");
  assert.match(registration,
    /item\.failedCandidateReleaseId/,
  "registration must disable the failed 0.2.57 candidate before publishing its successor");
  assert.match(activation,
    /Math\.ceil\(value\.duration_ms \/ \(mediaContinuity \? 30_000 : 60_000\)\) \+ 2/,
  "media-continuity successors use their explicit renewal budget instead of the legacy warmup budget");
  assert.match(registration,
    /: routineConfirmation[\s\S]*item\.rollbackReleaseId/);
  assert.match(registration, /item\.failedHealthCandidateReleaseId/);
  assert.match(registration, /item\.failedContinuityCandidateReleaseId/);
  assert.match(registration, /item\.failedAcquisitionCandidateReleaseId/);
  assert.match(registration, /item\.quarantinedRuntimeReleaseId/);
  assert.match(registration, /item\.quarantinedBridgeReleaseId/);
  assert.match(registration,
    /r\.release_id in \(\$\{rolloutReleaseIdsToPauseSql\}\) and o\.status<>'PAUSED'/);
  for (const token of ["authorizeQuarantinedReleaseRetry", "CONTROLLED_GATEWAY_PAUSE_FOR_SIGNED_SHADOW_DIAGNOSTIC",
    "prior_healthy_duration_ms", "gatewayRetryBaselineSafe", "recorderSessionLifecycle",
    "recorderSessionHeartbeat", "camera_runtime_writes_by_command: 0", "ota_agent_owns_install: true"])
    assert.match(retry, new RegExp(token));
  assert.match(retry, /healthyDurationMs < 60 \* 60_000/);
  assert.match(retry, /rollout\.retry_status !== "ACTIVE"/);
  assert.match(retry, /\["DRAFT", "PAUSED"\]\.includes\(rollout\.successor_status\)/);
  assert.doesNotMatch(retry, /launchctl[^\n]+bootout|adapter\.restart|manager\.apply/);
  for (const token of ["CONTROLLED_GATEWAY_AND_OTA_PAUSE_FOR_SIGNED_SHADOW",
    "AUTHORIZE_ONE_TIME_EXACT_0_2_64_RETRY", "ACTIVATE_EXACT_0_2_64_ROLLOUT",
    "authorizeQuarantinedReleaseRetry", "ota_agent_owns_install: true"])
    assert.match(healthSerializationRetry, new RegExp(token));
  assert.match(healthSerializationRetry, /successor\.rollbackReleaseId/);
  assert.match(healthSerializationRetry,
    /successor\.failedHealthSerializationPredecessorReleaseId/);
  assert.match(healthSerializationRetry, /rollout\.retry_status !== "PAUSED"/);
  assert.doesNotMatch(healthSerializationRetry,
    /launchctl[^\n]+bootout|adapter\.restart|manager\.apply/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, cohort_percent: 0, protected_signing_contract: true,
  rollback_release_id: item.rollbackReleaseId }));
