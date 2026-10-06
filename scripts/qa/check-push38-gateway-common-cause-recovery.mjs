import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildPush38GatewayCommonCauseRecoveryManifest,
  PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY } from
  "../../services/video-gateway/push38-home-qa-gateway-common-cause-recovery.mjs";
import { buildPush38GatewayFiniteStreamHandoffManifest,
  PUSH38_GATEWAY_FINITE_STREAM_HANDOFF } from
  "../../services/video-gateway/push38-home-qa-gateway-finite-stream-handoff.mjs";
import { PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES,
  PRIVATE_NVR_EXCLUSIVE_SESSION_SWEEP_BUDGET_MS,
  PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS,
  PRIVATE_NVR_MAX_ROUTINE_PROBATIONS,
  PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS,
  PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS,
  PRIVATE_NVR_RESPONSE_RETIREMENT_PRIME_MINIMUM_MS,
  PRIVATE_NVR_OBSERVED_MEDIA_RESPONSE_RETIREMENT_MS,
  PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS,
  PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS,
  PRIVATE_NVR_PROACTIVE_RENEWAL_MS,
  PRIVATE_NVR_RELAY_HANDOFF_TICK_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_GRACE_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES,
  PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED,
  PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS,
  PRIVATE_NVR_SESSION_SWEEP_CONTROL_MARGIN_MS,
  PRIVATE_NVR_WARM_HANDOFF_REQUEST_GRACE_MS,
  privateNvrHealthEffectiveRelay,
  privateNvrLogoutResponseRetired,
  privateNvrOutputRescueStillRequired,
  privateNvrRetiredSessionReady,
  privateNvrProvisionalHandoffAllowed, privateNvrRelayHandoffMode,
  privateNvrRoutineHandoffConfirmed, privateNvrRoutineHandoffRetryAllowed,
  privateNvrRoutineHandoffSchedule,
  relayMaySurvivePrivateNvrRenewal,
  shouldDeferPrivateNvrStaleOwnerTeardown,
  shouldDeferPrivateNvrOutputRescueForSessionRenewal,
  shouldPrimePrivateNvrSessionForResponseRetirement,
  shouldRetainPrivateNvrOwnerOnDemand,
  shouldRetryPrivateNvrExclusiveRescueAfterCandidateExit,
  shouldRetryPrivateNvrExclusiveRescueAfterAcquisitionRejection,
  shouldUsePrivateNvrExclusiveOutputRescue,
  shouldUsePrivateNvrExclusiveSessionSweep,
  shouldProactivelyHandoffPrivateNvrRelay,
  shouldPrioritizePrivateNvrSessionHandoff,
  shouldProactivelyRefreshPrivateNvrSession, shouldRefreshPrivateNvrSession } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";
import { shouldQuarantineHardwareTranscoder } from
  "../../services/video-gateway/hardware-transcoder.mjs";

const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
const registration = readFileSync("scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");
const gateway = readFileSync("services/video-gateway/server.mjs", "utf8");
const installedAdapter = readFileSync("services/video-gateway/edge-macos-installed-adapter.mjs", "utf8");
const persistentInstaller = readFileSync("scripts/install-persistent-home-gateway.mjs", "utf8");
const activation = readFileSync("scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs", "utf8");

test("Gateway common-cause recovery is an immutable exact-device release", () => {
  const manifest = buildPush38GatewayCommonCauseRecoveryManifest({ signingKeyId: "fixture-release-key",
    artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    releasedAt: new Date().toISOString() }).document;
  assert.equal(manifest.release_id, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.releaseId);
  assert.equal(manifest.artifact_sha256, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.digest);
  assert.equal(manifest.artifact_size, PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.size);
  assert.equal(manifest.compatibility.minimum_current_version,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.rollbackVersion);
  assert.equal(manifest.compatibility.maximum_current_version,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.rollbackVersion);
  assert.equal(manifest.rollout.cohort_percent, 0);
  assert.deepEqual(manifest.rollout.explicit_device_ids,
    [PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.deviceId]);
});

test("Gateway finite-stream handoff is a new immutable release over signed 0.2.11", () => {
  const manifest = buildPush38GatewayFiniteStreamHandoffManifest({ signingKeyId: "fixture-release-key",
    artifactOrigin: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    releasedAt: new Date().toISOString() }).document;
  assert.equal(manifest.release_id, PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.releaseId);
  assert.equal(manifest.version, "0.2.13-p38-health");
  assert.equal(manifest.artifact_sha256, PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.digest);
  assert.equal(manifest.artifact_size, PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.size);
  assert.equal(manifest.compatibility.minimum_current_version,
    PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.rollbackVersion);
  assert.equal(manifest.compatibility.maximum_current_version,
    PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.rollbackVersion);
  assert.equal(manifest.rollout.cohort_percent, 0);
  assert.deepEqual(manifest.rollout.explicit_device_ids,
    [PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.deviceId]);
  assert.notEqual(PUSH38_GATEWAY_FINITE_STREAM_HANDOFF.releaseId,
    PUSH38_GATEWAY_COMMON_CAUSE_RECOVERY.releaseId);
});

test("session rotation requires auth, common-cause, or a proven finite-response reopen boundary", () => {
  assert.equal(shouldRefreshPrivateNvrSession("authentication_rejected"), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media",
    { loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER }), false);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    loginExclusivity: false, sessionAgeMs: Number.MAX_SAFE_INTEGER,
    heartbeatConsecutiveFailures: 3, commonCauseSourceFailures: 8
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    previousRelayExitReason: "SOURCE_STREAM_ENDED"
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    previousRelayExitReason: "SOURCE_RESPONSE_RETIRED"
  }), true);
  assert.equal(shouldRefreshPrivateNvrSession("source_not_media", {
    previousRelayExitReason: "UPSTREAM_UND_ERR_SOCKET"
  }), false);
  assert.equal(shouldRefreshPrivateNvrSession("source_transport_error"), false);
});

test("health remains serializable while a finite owner has exited before candidate media", () => {
  const current = { id: "current" }, candidate = { id: "candidate" };
  assert.equal(privateNvrHealthEffectiveRelay({ current, candidate,
    mediaOwner: "CURRENT" }), current);
  assert.equal(privateNvrHealthEffectiveRelay({ current, candidate,
    mediaOwner: "WARMING_CONTINUITY" }), candidate);
  assert.equal(privateNvrHealthEffectiveRelay({ current: null, candidate,
    mediaOwner: "NONE" }), null);
  assert.equal(privateNvrHealthEffectiveRelay({ current: null, candidate,
    mediaOwner: "CURRENT" }), null);
  assert.match(gateway,
    /inputs: relayContinuity\.flatMap[\s\S]*const relay = continuity\.effective;[\s\S]*if \(!relay\) return \[\{[\s\S]*playback_continuity: continuity\.playbackContinuity[\s\S]*RETAINED_HLS/,
  "finite-response renewal and stalled-source truth must remain serializable");
});

test("intentional relay handoff never quarantines the hardware encoder", () => {
  assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: null }), false);
  assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: 0 }), false);
  assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: 9,
    stopReason: "WARM_HANDOFF" }), false);
  assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: 9,
    stopReason: "STALE_INPUT" }), false);
  assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: 1,
    inputFailed: true }), false);
  assert.equal(shouldQuarantineHardwareTranscoder({ exitCode: 1 }), true);
});

test("measured finite-response session renewal owns one exclusive epoch sweep", () => {
  const now = Date.now();
  assert.equal(PRIVATE_NVR_PROACTIVE_RENEWAL_MS, 2 * 60 * 1000);
  assert.equal(PRIVATE_NVR_EXCLUSIVE_SESSION_SWEEP_BUDGET_MS,
    PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS * 10,
  "nine sources include one concurrent observation plus nine exclusive acquisitions");
  assert.ok(PRIVATE_NVR_OBSERVED_MEDIA_RESPONSE_RETIREMENT_MS
    - PRIVATE_NVR_PROACTIVE_RENEWAL_MS
    - PRIVATE_NVR_EXCLUSIVE_SESSION_SWEEP_BUDGET_MS
    - PRIVATE_NVR_SESSION_SWEEP_CONTROL_MARGIN_MS >= 17_000,
  "renewal must fit the complete serialized sweep before measured response retirement");
  const eligible = { loginExclusivity: false,
    updatedAt: now - PRIVATE_NVR_PROACTIVE_RENEWAL_MS };
  const idleAfterHeartbeatLoss = { activeProgressingRelays: 0,
    heartbeatConsecutiveFailures: PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES };
  assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible,
    idleAfterHeartbeatLoss, now), true);
  const activeBeforeHardExpiry = { activeProgressingRelays: 9,
    heartbeatConsecutiveFailures: 0, heartbeatResponsesOk: 1 };
  assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible,
    activeBeforeHardExpiry, now), true,
  "the measured finite-response boundary and healthy heartbeat authorize one bounded epoch sweep");
  for (const blocked of [
    { pendingRetiredSessions: 1 },
    { staleEpochRelays: 1 },
    { activeHandoffs: 1 },
    { recoveryBacklog: 1 }
  ]) {
    assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible, {
      ...activeBeforeHardExpiry, ...blocked
    }, now), false,
    "another renewal must wait for complete prior-epoch drain and retirement");
  }
  assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible, {
    activeProgressingRelays: 0, heartbeatConsecutiveFailures: 0
  }, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession(eligible, {
    activeProgressingRelays: 9, heartbeatConsecutiveFailures: 0,
    heartbeatResponsesOk: 0
  }, now), false,
  "active media without a proven heartbeat cannot authorize a shared-login renewal");
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    loginExclusivity: true }, idleAfterHeartbeatLoss, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    loginExclusivity: null }, idleAfterHeartbeatLoss, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    updatedAt: now - PRIVATE_NVR_PROACTIVE_RENEWAL_MS + 1 },
  idleAfterHeartbeatLoss, now), false);
  assert.equal(shouldProactivelyRefreshPrivateNvrSession({ ...eligible,
    refreshPromise: Promise.resolve() }, idleAfterHeartbeatLoss, now), false);
  assert.match(gateway,
    /activeProgressingRelays[\s\S]*shouldProactivelyRefreshPrivateNvrSession\(session, \{[\s\S]*activeProgressingRelays,[\s\S]*heartbeatConsecutiveFailures:[\s\S]*heartbeatResponsesOk:[\s\S]*pendingRetiredSessions:[\s\S]*staleEpochRelays, activeHandoffs, recoveryBacklog/,
  "live renewal must be gated by media and heartbeat evidence");
  assert.match(gateway,
    /requiresExclusiveMediaHandoff: proactive[\s\S]*preserveRelayEpochsThrough: proactive[\s\S]*\? null/,
  "a proactive renewal must immediately drain the stale epoch through the proven exclusive boundary");
});

test("superseded recorder login retires only after every media epoch drains", () => {
  assert.equal(privateNvrRetiredSessionReady({ retiredEpoch: 4,
    activeRelayEpochs: [5, 5, 5] }), true);
  assert.equal(privateNvrRetiredSessionReady({ retiredEpoch: 4,
    activeRelayEpochs: [5, 4, 5] }), false);
  assert.equal(privateNvrRetiredSessionReady({ retiredEpoch: 4,
    activeRelayEpochs: [3, 5] }), false);
  assert.equal(privateNvrRetiredSessionReady({ retiredEpoch: null,
    activeRelayEpochs: [] }), false);
  assert.equal(privateNvrLogoutResponseRetired({ httpStatus: 200,
    result: "success" }), true);
  assert.equal(privateNvrLogoutResponseRetired({ httpStatus: 400,
    errorCode: "logout" }), true,
  "the verified repeated-Logout response means the old session is already retired");
  assert.equal(privateNvrLogoutResponseRetired({ httpStatus: 400,
    errorCode: "expired" }), true,
  "the verified post-migration response means the old session is already retired");
  assert.equal(privateNvrLogoutResponseRetired({ httpStatus: 400,
    errorCode: "another_error" }), false);
  assert.equal(privateNvrLogoutResponseRetired({ httpStatus: 200,
    result: "failed" }), false);
  assert.match(gateway,
    /retireDrainedPrivateNvrSessions[\s\S]*privateNvrRetiredSessionReady[\s\S]*privateNvrLogout/,
  "live maintenance must close a drained superseded recorder login");
  assert.match(gateway,
    /retiredSessions = \[\.\.\.\(current\.retiredSessions \|\| \[\]\), \{[\s\S]*epoch: current\.epoch/,
  "rotation must retain in-memory authority to retire the prior login");
  assert.match(gateway,
    /shutdownGateway[\s\S]*SERVICE_SHUTDOWN[\s\S]*privateNvrLogout[\s\S]*SIGTERM/,
  "service shutdown must close media before retiring DVR logins");
});

test("proactive renewal serializes rescue and session-sweep ownership", () => {
  const pending = { refreshPending: true, relayEpoch: 4, currentEpoch: 4 };
  assert.equal(shouldDeferPrivateNvrOutputRescueForSessionRenewal(pending), true);
  assert.equal(shouldDeferPrivateNvrOutputRescueForSessionRenewal({
    ...pending, refreshPending: false
  }), false, "a failed or completed refresh restores ordinary rescue");
  assert.equal(shouldDeferPrivateNvrOutputRescueForSessionRenewal({
    ...pending, relayEpoch: 3
  }), false, "an older epoch must enter SESSION_SWEEP instead of deferral");
  assert.match(gateway,
    /const sessionRenewalPending =[^;]*shouldDeferPrivateNvrOutputRescueForSessionRenewal\([\s\S]*if \(handoffMode === "OUTPUT_RESCUE"\) \{[\s\S]*if \(sessionRenewalPending\) continue;/,
  "scheduler output rescue must not race a proactive Login refresh");
  assert.match(gateway,
    /const requestRescueEligible =[\s\S]*&& !sessionRenewalPending[\s\S]*privateNvrOutputRescueRetryAllowed/,
  "playback and AI demand must not open a competing rescue during refresh");
});

test("proactive renewal preserves only progressing relays from the same recorder", () => {
  const priorRelay = { sameToken: false, sameSessionKey: true,
    relayProgressing: true, relayEpoch: 3, currentEpoch: 4,
    preserveRelayEpochsThrough: 3 };
  assert.equal(relayMaySurvivePrivateNvrRenewal(priorRelay), true);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    relayProgressing: false }), false);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    sameSessionKey: false }), false);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    preserveRelayEpochsThrough: null }), false);
  assert.equal(relayMaySurvivePrivateNvrRenewal({ ...priorRelay,
    sameToken: true, sameSessionKey: false }), true);
});

test("healthy recorder responses are not replaced from age alone", () => {
  const now = Date.now();
  const eligible = { progressing: true, recoveryStable: true, warming: false,
    startedAt: now - PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS };
  assert.equal(PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS, 2 * 60 * 1000);
  assert.equal(PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED, false);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay(eligible, now), false);
  assert.equal(privateNvrRelayHandoffMode(eligible, now), null,
    "the live nine-source canary disproved age as a finite-response signal");
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    startedAt: now - PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS + 1 }, now), false);
  assert.equal(PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS, 12_000);
  assert.equal(PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS, 3_000);
  assert.equal(PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS, 4_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS, 6_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES, 4);
  assert.equal(PRIVATE_NVR_WARM_HANDOFF_REQUEST_GRACE_MS, 8_000);
  assert.equal(PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS, 10_000);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now,
    lastOutputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS }, now), false);
  assert.equal(privateNvrRelayHandoffMode({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now,
    lastOutputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS }, now),
  null, "fresh input suppresses a cadence-only rescue probe");
  assert.equal(privateNvrRelayHandoffMode({ ...eligible,
    startedAt: now - PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS,
    lastInputAt: now,
    lastOutputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS }, now),
  null, "rendered-output cadence alone is not a recorder-response failure");
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastOutputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS + 1 }, now), false);
  assert.equal(privateNvrRelayHandoffMode({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now - PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS,
    lastOutputAt: now - PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS }, now),
  null,
  "joint soft idle is not proof that the recorder response retired");
  assert.equal(privateNvrRelayHandoffMode({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    nativeInputEnded: true,
    lastInputAt: now - PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS,
    lastOutputAt: now - PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS }, now),
  "OUTPUT_RESCUE", "an observed body end plus bounded output drain triggers rescue");
  assert.equal(privateNvrRelayHandoffMode({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now,
    lastOutputAt: now - PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS }, now),
  null,
  "current recorder input suppresses a soft rendered-output cadence probe");
  assert.equal(privateNvrRelayHandoffMode({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now - PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS,
    lastOutputAt: now }, now), null,
  "current rendered output suppresses the early finite-response detector");
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now - 30_000,
    lastOutputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS }, now), false,
  "joint soft idle cannot start a replacement without an authoritative boundary");
  assert.equal(privateNvrRelayHandoffMode({ ...eligible,
    progressing: false,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now, lastOutputAt: now - 20_000,
    relayStaleMs: 20_000 }, now), null,
  "hard-stale output alone cannot replace a response while native input remains current");
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    progressing: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastOutputAt: now - PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS }, now), false,
  "a non-progressing owner remains untouched until an observed body end");
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    recoveryStable: false,
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now,
    lastOutputAt: now }, now), false,
  "bursty recorder input must not replace a relay while HLS output is current");
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    progressing: false }, now), false);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    recoveryStable: false, startedAt: now,
    lastOutputAt: now - PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS }, now), false);
  assert.equal(shouldProactivelyHandoffPrivateNvrRelay({ ...eligible,
    warming: true }, now), false);
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - 2_000, outputAdvanced: true,
    outputAdvanceCount: 4, lastOutputAt: now, now }), false,
  "four rapid HLS writes without the confirmation interval must not promote a replacement");
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
    outputAdvanced: true, outputAdvanceCount: 3,
    lastOutputAt: now, now }), false,
  "three playlist advances are not sustained replacement evidence");
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
    outputAdvanced: true, outputAdvanceCount: 4,
    lastOutputAt: now - PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS - 1,
    now }), false,
  "a replacement that survived the window without fresh output must not promote");
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
    outputAdvanced: true, outputAdvanceCount: 4,
    lastOutputAt: now - PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS,
    now }), true);
  assert.match(gateway,
    /recorder's media response ends before[\s\S]*warmReplacePrivateNvrRelay/);
  assert.match(gateway,
    /if \(outputAt > lastObservedOutputAt\)[\s\S]*outputConfirmed = minimumConfirmationMs/,
  "probation confirmation must be re-evaluated between HLS writes");
});

test("sustained recorder response retirement primes one replacement login", () => {
  const eligible = {
    sourceKind: "private_nvr_http_mp4", inputErrorCode: "UND_ERR_SOCKET",
    sustainedMedia: true, ownerCurrent: true, warming: false,
    relayAgeMs: PRIVATE_NVR_RESPONSE_RETIREMENT_PRIME_MINIMUM_MS
  };
  assert.equal(shouldPrimePrivateNvrSessionForResponseRetirement(eligible), true);
  assert.equal(shouldPrimePrivateNvrSessionForResponseRetirement({ ...eligible,
    inputErrorCode: null, sourceEnded: true }), true,
  "a clean sustained response end primes the same bounded replacement login");
  assert.equal(shouldPrimePrivateNvrSessionForResponseRetirement({ ...eligible,
    relayAgeMs: PRIVATE_NVR_RESPONSE_RETIREMENT_PRIME_MINIMUM_MS - 1 }), false,
  "an early socket loss must not rotate recorder authentication");
  assert.equal(shouldPrimePrivateNvrSessionForResponseRetirement({ ...eligible,
    ownerCurrent: false }), false);
  assert.equal(shouldPrimePrivateNvrSessionForResponseRetirement({ ...eligible,
    warming: true }), false);
  assert.equal(shouldPrimePrivateNvrSessionForResponseRetirement({ ...eligible,
    inputErrorCode: "ECONNRESET",
    relayAgeMs: PRIVATE_NVR_OBSERVED_MEDIA_RESPONSE_RETIREMENT_MS }), false,
  "ECONNRESET must first fail exact-channel reopen before it may rotate a login");
  assert.match(gateway,
    /shouldPrimePrivateNvrSessionForResponseRetirement[\s\S]*finite_response_socket_retired/);
});

test("consumer demand retains one healthy private DVR response owner", () => {
  const evidence = { sourceKind: "private_nvr_http_mp4", ownerRunning: true,
    belongsToCurrentSession: true, nativeInputEnded: false,
    inputFailed: false, heartbeatConsecutiveFailures: 0 };
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand(evidence), true);
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand({ ...evidence,
    heartbeatConsecutiveFailures: PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES }), false);
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand({ ...evidence,
    nativeInputEnded: true }), false);
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand({ ...evidence,
    inputFailed: true }), false);
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand({ ...evidence,
    sourceKind: "rtsp" }), false);
  const sweepBoundary = { ...evidence, belongsToCurrentSession: false,
    sessionSweepPending: true };
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand(sweepBoundary), true,
    "consumer demand must retain the prior progressing owner while the canonical session sweep takes ownership");
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand({ ...sweepBoundary,
    sessionSweepPending: false }), false,
  "an arbitrary stale epoch cannot bypass normal bounded recovery");
  assert.equal(shouldRetainPrivateNvrOwnerOnDemand({ ...sweepBoundary,
    nativeInputEnded: true }), false,
  "a genuinely ended prior response cannot masquerade as sweep continuity");
  assert.match(gateway,
    /sessionSweepPending[\s\S]*shouldRetainPrivateNvrOwnerOnDemand\(\{[\s\S]*sessionSweepPending[\s\S]*privateNvrHeartbeat\.status\(\)\.consecutive_failures[\s\S]*\}\)\) return existing;/,
  "all demand must retain the canonical or pending-sweep owner until a boundary or corroborated heartbeat loss");
});

test("a progressing warm candidate keeps its owner until bounded confirmation", () => {
  const now = Date.now();
  const stale = { handoffInFlight: true, candidateProgressing: false,
    currentOutputAt: now - 28_001, relayStaleMs: 20_000, now };
  assert.equal(shouldDeferPrivateNvrStaleOwnerTeardown({ ...stale,
    candidateProgressing: true }), true,
  "real candidate continuity must survive beyond the old owner's grace boundary");
  assert.equal(shouldDeferPrivateNvrStaleOwnerTeardown({ ...stale,
    currentOutputAt: now - 27_999 }), true,
  "the existing bounded request grace remains valid while handoff is active");
  assert.equal(shouldDeferPrivateNvrStaleOwnerTeardown(stale), false);
  assert.equal(shouldDeferPrivateNvrStaleOwnerTeardown({ ...stale,
    preserveOwnerUntilHandoffSettles: true }), true,
  "a bounded output-rescue promise keeps the identity owner until it settles");
  assert.equal(shouldDeferPrivateNvrStaleOwnerTeardown({ ...stale,
    handoffInFlight: false, candidateProgressing: true }), false,
  "an orphan candidate may never preserve a stale owner");
  assert.match(gateway,
    /const warmingCandidate = relayCandidates\.get\(streamId\);[\s\S]*shouldDeferPrivateNvrStaleOwnerTeardown\([\s\S]*candidateProgressing: relayIsProgressing\(warmingCandidate\)[\s\S]*preserveOwnerUntilHandoffSettles:[\s\S]*if \(awaitingWarmReplacement\) return;/,
  "the live monitor must consult candidate media before tearing down its owner");
});

test("private DVR idle waits for authoritative body or socket termination", () => {
  assert.match(gateway,
    /if \(!directRtsp\) return;[\s\S]*armRelayRecovery\(streamId, relay\)[\s\S]*stopRelay\(streamId, relay,/,
  "private DVR monitoring must let the authoritative body/socket close own recovery classification");
  assert.match(gateway,
    /const requestRescueEligible = source\?\.kind === "private_nvr_http_mp4"[\s\S]*existing\.nativeInputEnded === true[\s\S]*privateNvrOutputRescueRetryAllowed/,
  "consumer demand must not open a private DVR replacement from output idle alone");
});

test("a hard-stale private DVR owner permits one strict exclusive rescue", () => {
  const now = Date.now();
  const evidence = { handoffMode: "OUTPUT_RESCUE",
    sourceKind: "private_nvr_http_mp4", ownerRunning: true,
    ownerCurrent: true, ownerOutputAt: now - 20_000, relayStaleMs: 20_000,
    candidateRunning: true, candidateFirstOutputObserved: true,
    candidateConfirmed: false, now };
  assert.equal(shouldUsePrivateNvrExclusiveOutputRescue(evidence), true);
  assert.equal(shouldUsePrivateNvrExclusiveOutputRescue({ ...evidence,
    candidateFirstOutputObserved: false }), true,
  "an acquired candidate may be body-blocked by the proven hard-stale owner");
  assert.equal(shouldUsePrivateNvrExclusiveOutputRescue({ ...evidence,
    ownerRunning: false, ownerCurrent: false, ownerMissing: true }), true,
  "a naturally ended finite owner must not make the bounded candidate look like an ownership conflict");
  for (const override of [
    { handoffMode: "ROUTINE_FINITE_RESPONSE" },
    { sourceKind: "rtsp" },
    { ownerRunning: false, ownerCurrent: true },
    { ownerRunning: false, ownerCurrent: false, ownerMissing: false },
    { ownerRunning: true, ownerCurrent: false, ownerMissing: true },
    { candidateRunning: false },
    { ownerOutputAt: now - 19_999 },
    { candidateConfirmed: true }
  ]) assert.equal(shouldUsePrivateNvrExclusiveOutputRescue({ ...evidence, ...override }), false);
  assert.match(gateway,
    /hardStaleWaitMs[\s\S]*shouldUsePrivateNvrExclusiveOutputRescue\(\{ handoffMode,[\s\S]*ownerMissing: relays\.get\(streamId\) === undefined,[\s\S]*candidateRunning: relayIsRunning\(replacement\)[\s\S]*OUTPUT_RESCUE_OWNER_RELEASE[\s\S]*maximumNoAdvanceMs: PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS/,
  "exclusive fallback must first reuse the acquired candidate after releasing only the stale owner");
  assert.match(gateway,
    /observation\.continuationStalled[\s\S]*EXCLUSIVE_RESCUE_REOPEN[\s\S]*startRelay\(streamId, \{ warming: true/,
  "only a measured post-release stall may open one fresh exclusive response");
  assert.match(gateway,
    /if \(relayWarmups\.has\(streamId\)\) return null;/,
  "consumer demand must fail closed instead of opening a competing relay during owner release");
  assert.match(gateway,
    /if \(exclusiveRescue\) armRelayRecovery\(streamId, replacement \|\| previous\)/,
  "exclusive rescue failure must enter the existing recovery machinery exactly once");
  assert.match(gateway,
    /exclusiveRescueTakeovers:[\s\S]*exclusiveRescueColdTakeovers:[\s\S]*exclusiveRescueReopens:[\s\S]*exclusiveRescueReopenFailures:[\s\S]*exclusiveRescueConcurrentProbeRejections:[\s\S]*exclusiveRescueFailures:/,
  "health evidence must expose the bounded exclusive path");
});

test("a hard-stale owner can reopen once after the recorder rejects the concurrent probe", () => {
  const now = Date.now();
  const evidence = { handoffMode: "OUTPUT_RESCUE",
    sourceKind: "private_nvr_http_mp4", acquisitionFailure: "source_not_media",
    canonicalOwnerUnchanged: true, ownerOutputAt: now - 20_000,
    relayStaleMs: 20_000, now };
  assert.equal(shouldRetryPrivateNvrExclusiveRescueAfterAcquisitionRejection(evidence), true);
  for (const override of [
    { handoffMode: "ROUTINE_FINITE_RESPONSE" },
    { sourceKind: "rtsp" },
    { acquisitionFailure: "authentication_rejected" },
    { canonicalOwnerUnchanged: false },
    { ownerOutputAt: now - 19_999 }
  ]) assert.equal(shouldRetryPrivateNvrExclusiveRescueAfterAcquisitionRejection({
    ...evidence, ...override }), false);
  assert.match(gateway,
    /candidateStartFailure[\s\S]*shouldRetryPrivateNvrExclusiveRescueAfterAcquisitionRejection\([\s\S]*canonicalOwnerUnchanged:[\s\S]*exclusiveRescueColdTakeovers \+= 1[\s\S]*OUTPUT_RESCUE_OWNER_RELEASE[\s\S]*startRelay\(streamId, \{ warming: true/,
  "the rejected concurrent probe must continue through one bounded exclusive response");
  assert.match(gateway,
    /replacement\.previousDirectories = \[\.\.\.new Set\([\s\S]*previous\.directory[\s\S]*observeWarmReplacement\(replacement/,
  "the exclusive response must retain old HLS while proving fresh output");
  assert.match(gateway,
    /EXCLUSIVE_RESCUE_ACQUISITION_FAILED[\s\S]*armRelayRecovery\(streamId, previous\)/,
  "a failed exclusive continuation must fall back to the existing recovery machinery");
});

test("an ended candidate at hard stale reuses the bounded exclusive rescue", () => {
  const now = Date.now();
  const evidence = { handoffMode: "OUTPUT_RESCUE",
    sourceKind: "private_nvr_http_mp4", candidateRunning: false,
    candidateConfirmed: false, canonicalOwnerUnchanged: true,
    ownerOutputAt: now - 20_000, relayStaleMs: 20_000, now };
  assert.equal(shouldRetryPrivateNvrExclusiveRescueAfterCandidateExit(evidence), true);
  for (const override of [
    { handoffMode: "ROUTINE_FINITE_RESPONSE" }, { sourceKind: "rtsp" },
    { candidateRunning: true }, { candidateConfirmed: true },
    { canonicalOwnerUnchanged: false }, { ownerOutputAt: now - 19_999 }
  ]) assert.equal(shouldRetryPrivateNvrExclusiveRescueAfterCandidateExit({
    ...evidence, ...override }), false);
  assert.match(gateway,
    /shouldRetryPrivateNvrExclusiveRescueAfterCandidateExit\(\{ handoffMode,[\s\S]*OUTPUT_RESCUE_OWNER_RELEASE[\s\S]*previousRelay: endedCandidate/,
  "an ended concurrent candidate must continue through one existing exclusive rescue");
});

test("an early rescue probe cannot replace an owner that recovered", () => {
  const now = Date.now();
  const recovered = { ownerRunning: true, ownerCurrent: true,
    ownerProgressing: true, ownerOutputAt: now - 500,
    candidateOutputAt: now - 100, now };
  assert.equal(privateNvrOutputRescueStillRequired(recovered), false);
  assert.equal(privateNvrOutputRescueStillRequired({ ...recovered,
    ownerOutputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS,
    candidateOutputAt: now }), true);
  assert.equal(privateNvrOutputRescueStillRequired({ ...recovered,
    ownerRunning: false }), true);
  assert.equal(privateNvrOutputRescueStillRequired({ ...recovered,
    ownerCurrent: false }), true);
  assert.equal(privateNvrOutputRescueStillRequired({ ...recovered,
    ownerProgressing: false }), true);
  assert.match(gateway,
    /const ownerRecovered = handoffMode === "OUTPUT_RESCUE"[\s\S]*privateNvrOutputRescueStillRequired[\s\S]*OUTPUT_RESCUE_OWNER_RECOVERED/,
  "a recovered canonical owner must survive the non-destructive probe");
});

test("heartbeat, login renewal, and media handoffs use independent bounded schedulers", () => {
  assert.match(gateway, /privateNvrHeartbeatRun = privateNvrHeartbeat\.tick\(\)/);
  assert.match(gateway,
    /privateNvrSessionRenewalRun = maintainPrivateNvrSessionRenewals\(\)/);
  assert.match(gateway,
    /privateNvrRelayHandoffRun = maintainPrivateNvrRelayHandoffs\(\)/);
  assert.equal(PRIVATE_NVR_RELAY_HANDOFF_TICK_MS, 1_000);
  assert.ok(PRIVATE_NVR_RELAY_HANDOFF_TICK_MS * 16 < 50_000,
    "a one-at-a-time full recorder sweep must fit inside the observed prior-login overlap");
  assert.match(gateway,
    /\}, PRIVATE_NVR_RELAY_HANDOFF_TICK_MS\)\.unref\(\)/);
  assert.equal(shouldPrioritizePrivateNvrSessionHandoff({ relayEpoch: 3,
    currentEpoch: 4 }), true);
  assert.equal(shouldPrioritizePrivateNvrSessionHandoff({ relayEpoch: 3,
    currentEpoch: 4, relayProgressing: true,
    preserveRelayEpochsThrough: 3 }), false,
  "a progressing prior-epoch owner migrates lazily instead of joining a recorder-wide sweep");
  assert.equal(shouldPrioritizePrivateNvrSessionHandoff({ relayEpoch: 4,
    currentEpoch: 4 }), false);
  const sessionSweepBoundary = { handoffMode: "SESSION_SWEEP",
    sourceKind: "private_nvr_http_mp4", ownerRunning: true,
    ownerCurrent: true, candidateRunning: true, candidateConfirmed: false,
    relayEpoch: 19, currentEpoch: 20 };
  assert.equal(shouldUsePrivateNvrExclusiveSessionSweep(sessionSweepBoundary), true,
    "a withheld stale-epoch candidate proves the per-channel exclusive boundary");
  assert.equal(shouldUsePrivateNvrExclusiveSessionSweep({ ...sessionSweepBoundary,
    candidateConfirmed: true }), false,
  "a productive concurrent candidate must retain the ordinary warm path");
  assert.equal(shouldUsePrivateNvrExclusiveSessionSweep({ ...sessionSweepBoundary,
    relayEpoch: 20 }), false,
  "the exclusive sweep may never replace a current-epoch owner");
  assert.equal(shouldUsePrivateNvrExclusiveSessionSweep({ ...sessionSweepBoundary,
    handoffMode: "SESSION_SWEEP_EXCLUSIVE", candidateRunning: false,
    exclusiveBoundaryObserved: true }), true,
  "an observed recorder boundary applies immediately to later stale-epoch channels");
  assert.equal(shouldUsePrivateNvrExclusiveSessionSweep({ ...sessionSweepBoundary,
    candidateRunning: false, candidateAcquisitionFailed: true,
    candidateFailure: "source_timeout", ownerProgressing: true }), true,
  "a bounded concurrent timeout beside a progressing stale owner proves the same boundary");
  assert.equal(shouldUsePrivateNvrExclusiveSessionSweep({ ...sessionSweepBoundary,
    candidateRunning: false, candidateAcquisitionFailed: true,
    candidateFailure: "host_network_unreachable", ownerProgressing: true }), false,
  "network reachability failure must never authorize an exclusive takeover");
  assert.equal(shouldUsePrivateNvrExclusiveSessionSweep({ ...sessionSweepBoundary,
    candidateRunning: false, candidateAcquisitionFailed: true,
    candidateFailure: "source_timeout", ownerProgressing: false }), false,
  "a failed owner plus timeout is recovery evidence, not an exclusive-boundary proof");
  assert.match(gateway,
    /if \(sessionSweep\.length\)[\s\S]*for \(const \[streamId, relay\] of sessionSweep\)[\s\S]*requiresExclusiveMediaHandoff[\s\S]*await warmReplacePrivateNvrRelay\(streamId, relay, handoffMode\)/,
    "a renewed-session sweep drains stale epochs and reuses the proven exclusive boundary");
  assert.match(gateway,
    /shouldUsePrivateNvrExclusiveSessionSweep\([\s\S]*SESSION_SWEEP_OWNER_RELEASE[\s\S]*requiresExclusiveMediaHandoff = true/,
    "the first withheld candidate must teach the serialized sweep without opening a third response");
  assert.match(gateway,
    /candidateAcquisitionFailed: true[\s\S]*candidateFailure: candidateStartFailure[\s\S]*SESSION_SWEEP_OWNER_RELEASE/,
    "a bounded concurrent acquisition timeout must retry once after exact owner release");
  assert.match(gateway,
    /privateNvrRoutineHandoffSchedule\([\s\S]*privateNvrHandoffCapacityAvailable\(candidateId, mode, candidate\)[\s\S]*void warmReplacePrivateNvrRelay\(streamId, relay, handoffMode\)/,
    "ordinary finite-response maintenance is deadline- and process-budgeted per recorder");
  assert.doesNotMatch(gateway,
    /maintainPrivateNvrSessionRenewals[\s\S]{0,1000}warmReplacePrivateNvrRelays/,
    "a slow media sweep must not block heartbeat or login renewal");
  assert.match(gateway,
    /!relayIsProgressing\(previous\)[\s\S]*!relayEligibleForHandoff\(streamId, previous\)/,
    "a warm handoff must satisfy the shared stability or output-rescue gate");
  assert.match(gateway,
    /startRelay\(streamId, \{ warming: true,[\s\S]*previousRelay: previous, handoffMode \}\)/);
  assert.match(gateway,
    /async function observeWarmReplacement[\s\S]*let firstOutputAt = null;[\s\S]*outputAt > lastObservedOutputAt[\s\S]*outputConfirmed = minimumConfirmationMs/,
  "a warm replacement must advance HLS after its first playlist write before promotion");
  assert.match(gateway,
    /\["ROUTINE_FINITE_RESPONSE", "OUTPUT_RESCUE", "SESSION_SWEEP",\s+"SESSION_SWEEP_EXCLUSIVE"\]\.includes\(handoffMode\)[\s\S]*minimumConfirmationMs: PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS[\s\S]*maximumOutputIdleMs: PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS/,
  "routine, output-rescue, and session-sweep replacements must survive the hard-stale confirmation window");
  assert.match(gateway,
    /let outputAdvanceCount = 0;[\s\S]*outputAdvanceCount \+= 1;[\s\S]*privateNvrRoutineHandoffConfirmed\(\{ confirmationStartedAt,[\s\S]*outputAdvanceCount/,
  "a replacement must prove four distinct playlist advances before ownership changes");
  assert.match(gateway,
    /let expectedCurrent = previous;[\s\S]*relays\.set\(streamId, replacement\);[\s\S]*stopRelay\(streamId, previous, "WARM_HANDOFF"\)/,
  "the old relay remains canonical until normal promotion or explicit hard-stale owner release");
  assert.doesNotMatch(gateway, /WARM_HANDOFF_CHAIN_ADVANCED|scheduleOutputRescueProbation/,
  "an unconfirmed replacement cannot advance a handoff chain");
  assert.equal(PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS, 2);
  assert.equal(PRIVATE_NVR_MAX_ROUTINE_PROBATIONS, 1);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS, 18_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_GRACE_MS, 2_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS, 180_000);
  assert.equal(privateNvrRoutineHandoffRetryAllowed(null, 100_000), true);
  assert.equal(privateNvrRoutineHandoffRetryAllowed(90_000, 100_000), false,
  "a rejected routine candidate cannot create an immediate retry storm");
  assert.equal(privateNvrRoutineHandoffRetryAllowed(0, 179_999), false,
  "a rejected source cannot re-enter before a full finite-response horizon");
  assert.equal(privateNvrRoutineHandoffRetryAllowed(0, 180_000), true);
  assert.equal(privateNvrRoutineHandoffRetryAllowed(null, Number.NaN), false);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 0 }), true);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1 }), false,
  "the recorder may have only one routine candidate replacement at a time");
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1,
    handoffMode: "OUTPUT_RESCUE" }), true,
  "one output-rescue candidate remains available beside the routine lane");
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 2,
    handoffMode: "OUTPUT_RESCUE" }), false);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1,
    replacingExistingProbation: true }), false,
  "a candidate may never replace its own chain before confirmation");
  assert.match(gateway,
    /liveRelayProcesses:[\s\S]*candidateHandoffs:[\s\S]*provisionalHandoffs:[\s\S]*maximumConcurrentProbations:[\s\S]*maximumRoutineProbations:/,
  "live health must expose the process-budget evidence used by qualification");
  assert.match(gateway,
    /warmHandoffsByMode:[\s\S]*warmHandoffFailuresByMode:/,
  "live health must classify successful and failed handoffs by lifecycle mode");
  const synchronized = privateNvrRoutineHandoffSchedule(Array(9).fill(100_000),
    58_000);
  assert.equal(synchronized.ready, true);
  assert.equal(synchronized.latestSafeStartAt, 58_000);
  assert.match(gateway,
    /outputRescues\.sort\([\s\S]*privateNvrRoutineHandoffSchedule\([\s\S]*relayWarmupModes/,
  "urgent rescue and the deadline-aware routine lane must use explicit bounded ownership");
  assert.match(gateway,
    /privateNvrRoutineHandoffRetryAllowed\(relay\.lastRoutineHandoffAttemptAt,[\s\S]*relay\.lastRoutineHandoffAttemptAt = observedAt/,
  "a failed routine handoff must retain a bounded per-owner retry backoff");
  assert.match(gateway,
    /const handoff = relayWarmups\.get\(streamId\);[\s\S]*waitForRelayHandoffMedia\(streamId, requestGraceMs\)[\s\S]*const continuity = relayMediaContinuity\(streamId, promoted\);[\s\S]*return available;/,
  "a playback request must await an in-flight bounded replacement and may use proven candidate media without promoting ownership");
  assert.match(gateway,
    /awaitingWarmReplacement[\s\S]*shouldDeferPrivateNvrStaleOwnerTeardown[\s\S]*relayStaleMs: RELAY_STALE_MS[\s\S]*return;/,
  "the stale monitor must allow the same bounded replacement grace");
  assert.match(gateway,
    /if \(!replacement \|\| !observation\.outputConfirmed \|\| !relayIsProgressing\(replacement\)[\s\S]*WARM_HANDOFF_ABORTED/,
  "an unconfirmed warm replacement must be rejected while the old relay remains authoritative");
  assert.match(gateway, /startsByReason:[\s\S]*routineFiniteResponse:[\s\S]*outputRescue:/,
  "relay starts must be attributable by lifecycle cause");
  assert.match(gateway, /staleByOwner:[\s\S]*current:[\s\S]*warming:/,
  "stale observations must distinguish the canonical owner from a candidate");
  assert.match(gateway, /relayLifecycle\.warmHandoffs/);
  assert.match(gateway, /previousDirectories/);
  assert.match(gateway, /const liveRelays = new Set\(\)/);
  assert.match(gateway, /\.\.\.\[\.\.\.liveRelays\]\.flatMap/);
  assert.match(gateway,
    /Private DVR HTTP responses are bursty:[\s\S]*if \(!progressing \|\| directRtsp && inputStale\)/);
  assert.match(gateway,
    /function relayEligibleForHandoff\(streamId, relay\)[\s\S]*!relayRecovery\.has\(streamId\) \|\| relayRecoveryIsStable\(relay\)/,
  "normal handoff remains subject to the sixty-second recovery stability window");
  assert.match(gateway,
    /function relayEligibleForHandoff\(streamId, relay\)[\s\S]*Date\.now\(\) - outputAt >= outputIdleMs/,
  "a frozen HLS output may use the bounded rescue exception before hard stale");
  assert.match(gateway,
    /relay_age_ms:[\s\S]*output_idle_ms:/,
  "health evidence must expose bounded relay age and rendered-output idle time");
  assert.match(gateway, /"-start_number", String\(firstEvidenceSequence\)/);
  assert.match(gateway, /function readEvidenceSegment[\s\S]*relay\.previousDirectories/);
});

test("the supervised Site Edge prevents idle sleep for its exact lifetime", () => {
  for (const source of [installedAdapter, persistentInstaller]) {
    assert.match(source, /\/usr\/bin\/caffeinate/);
    for (const option of ["-i", "-m", "-s"]) {
      assert.equal(source.includes(`"${option}"`) || source.includes(`<string>${option}</string>`), true);
    }
  }
  assert.doesNotMatch(installedAdapter, /CAFFEINATE_OPTIONS = \[[^\]]*"-d"/);
});

test("managed crash-loop supervision tracks the launchd service PID, not workload children", () => {
  assert.match(installedAdapter,
    /resolve\(runner\)\.startsWith\(`\$\{join\(root, "slots"\)\}\/`\)[\s\S]*return owner\.pid/);
  assert.doesNotMatch(installedAdapter,
    /source\.ProgramArguments\?\.\[0\] !== CAFFEINATE_PATH[\s\S]*ppid === owner\.pid/);
});

test("common-cause recovery is pinned to the signed 0.2.11 known-good release", () => {
  assert.match(installer, /--gateway-common-cause-recovery-upgrade/);
  assert.match(installer, /qa-p38-health-gateway-common-cause-189e548bc104/);
  assert.match(installer, /qa-p38-health-gateway-session-e354546bdbf8/);
  assert.match(installer, /e354546bdbf8a222f98b9af5166de1b91ee353ff7d5e54111b4c5c931901cd0a/);
});

test("finite-stream handoff upgrades management and remains pinned to signed 0.2.11", () => {
  assert.match(installer, /--gateway-finite-stream-handoff-upgrade/);
  assert.match(installer, /qa-p38-health-gateway-finite-handoff-76781a8e0832/);
  assert.match(installer, /qa-p38-health-gateway-session-e354546bdbf8/);
  assert.match(installer, /qa-p38-health-gateway-common-cause-189e548bc104/);
  assert.match(installer, /189e548bc10428ac49615fd2e9f6da60553df24e9da960db9afe40678c15b6eb/);
  assert.match(activation, /FINITE_STREAM_COMMON_CAUSE_SHADOW_QUALIFIED/);
  assert.match(activation, /P38_GATEWAY_FINITE_HANDOFF_SHADOW_EVIDENCE_REQUIRED/);
  assert.match(activation, /warmHandoffFailures/);
});

test("registration requires verified managed identity and disables broad cohorts", () => {
  assert.match(registration, /MANAGED_IDENTITY_VERIFIED/);
  assert.match(registration, /cohort_percent<>0/);
  assert.match(registration, /deployment_profile='PHYSICAL_GATEWAY'/);
  assert.match(registration, /runtime_writes: 0/);
});
