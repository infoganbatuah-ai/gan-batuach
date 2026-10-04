import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeRealHomeSoak } from
  "../../lib/domain/digital-observer/reliability-qualification.mjs";
import { classifyBoundedOutputRescueRejection, classifyContainedOwnerRecovery,
  classifyContinuousSessionRenewal, evaluateHlsRenewalContinuity } from
  "./push38-shadow-qualification-policy.mjs";
import { classifyRelayExit } from
  "../../services/video-gateway/relay-failure-reason.mjs";
import { HLS_PLAYBACK_HOLDBACK_SEGMENTS, inspectHlsPlaybackPlaylist, nextHlsPlaybackOffset,
  projectHlsPlaybackPlaylist, summarizeRelayAvailability } from
  "../../services/video-gateway/hls-playback-continuity.mjs";
import { nextRelayRecovery, relayRecoveryIsStable, relayRecoveryShouldResume,
  relayRetryDelayMs } from
  "../../services/video-gateway/relay-recovery-policy.mjs";
import { awaitRelayTransportRelease } from
  "../../services/video-gateway/relay-transport-release.mjs";
import { PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS,
  PRIVATE_NVR_MAX_ROUTINE_PROBATIONS,
  PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
  PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_RETRY_BACKOFF_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS,
  PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS,
  PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS,
  PRIVATE_NVR_RELAY_HANDOFF_TICK_MS,
  PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED,
  PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_GRACE_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES,
  PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS,
  comparePrivateNvrHandoffPriority,
  privateNvrHandoffCapacityAllowed,
  privateNvrHandoffProbationDeadline,
  privateNvrHandoffMediaContinuity,
  privateNvrHardwareOutputStalled,
  privateNvrRelayHandoffMode,
  privateNvrRetainedHlsContinuity,
  privateNvrExclusiveRescueContinuationStalled,
  privateNvrOutputRescueStillRequired,
  privateNvrOutputRescueRetryAllowed,
  privateNvrProvisionalHandoffAllowed,
  privateNvrRoutineHandoffConfirmed,
  privateNvrRoutineHandoffSchedule } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const server = readFileSync("services/video-gateway/server.mjs", "utf8");
assert.match(server,
  /const current = relays\.get\(streamId\);[\s\S]*if \(current && current === replacement\)/,
  "deferred HLS cleanup must not treat two absent owners as the same relay");

test("exclusive DVR replacement waits for input and FFmpeg closure", async () => {
  let releaseInput;
  let releaseProcess;
  const relay = {
    inputCompletion: new Promise(resolve => { releaseInput = resolve; }),
    processClosed: new Promise(resolve => { releaseProcess = resolve; })
  };
  let settled = false;
  const waiting = awaitRelayTransportRelease(relay, { timeoutMs: 1_000 })
    .then(result => { settled = true; return result; });
  await Promise.resolve();
  releaseInput();
  await Promise.resolve();
  assert.equal(settled, false, "the new DVR response must wait for FFmpeg closure too");
  releaseProcess();
  assert.equal((await waiting).released, true);
  assert.match(server,
    /await stopRelayForExclusiveReplacement\(streamId, previous,[\s\S]*SESSION_SWEEP_OWNER_RELEASE/,
    "exclusive session replacement must await transport release before opening a new response");
});

test("exclusive DVR replacement fails closed when transport release times out", async () => {
  const result = await awaitRelayTransportRelease({
    inputCompletion: new Promise(() => {}),
    processClosed: new Promise(() => {})
  }, { timeoutMs: 5 });
  assert.equal(result.released, false);
  assert.match(server, /OWNER_TRANSPORT_RELEASE_TIMEOUT/);
  assert.match(server, /exclusiveOwnerReleaseTimeouts/);
});

test("health counts a renewing and progressing handoff as one available source", () => {
  assert.deepEqual(summarizeRelayAvailability([
    ["camera-1", { progressing: true, renewing: true }],
    ["camera-2", { progressing: false, renewing: true }],
    ["camera-3", { progressing: false, renewing: false }]
  ]), {
    progressingRelays: 1,
    renewingRelays: 2,
    availableRelays: 2,
    stalledRelays: 1
  });
});

test("handoff capacity reserves a routine lane only while routine handoff is enabled", () => {
  assert.equal(PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS, 2);
  assert.equal(PRIVATE_NVR_MAX_ROUTINE_PROBATIONS, 1);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 0 }), true);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1 }), false);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1,
    handoffMode: "OUTPUT_RESCUE" }), true);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 2,
    handoffMode: "OUTPUT_RESCUE" }), false);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1,
    replacingExistingProbation: true }), false);
  assert.equal(privateNvrHandoffCapacityAllowed({
    activeProbations: 1, activeRoutineProbations: 0,
    activeRescueProbations: 1, handoffMode: "OUTPUT_RESCUE"
  }), true, "the second bounded rescue lane must remain usable when routine handoff is off");
  assert.equal(privateNvrHandoffCapacityAllowed({
    activeProbations: 2, activeRoutineProbations: 0,
    activeRescueProbations: 2, handoffMode: "OUTPUT_RESCUE"
  }), false, "the recorder-safe global two-candidate cap remains authoritative");
  assert.equal(privateNvrHandoffCapacityAllowed({
    activeProbations: 1, activeRoutineProbations: 0,
    activeRescueProbations: 1, handoffMode: "OUTPUT_RESCUE",
    routineAgeHandoffEnabled: true
  }), false, "routine mode reserves the other bounded lane");
  assert.equal(privateNvrHandoffCapacityAllowed({
    activeProbations: 1, activeRoutineProbations: 1,
    activeRescueProbations: 0, handoffMode: "ROUTINE_FINITE_RESPONSE"
  }), false, "routine candidates remain serialized");
  assert.equal(privateNvrHandoffCapacityAllowed({
    activeProbations: 1, activeRoutineProbations: 0,
    activeRescueProbations: 1, handoffMode: "OUTPUT_RESCUE",
    replacingExistingProbation: true
  }), false, "a retained candidate cannot recursively replace itself");
  assert.match(server, /let expectedCurrent = previous/);
  assert.doesNotMatch(server, /WARM_HANDOFF_CHAIN_ADVANCED/);
});

test("two-source Shadow preserves both media paths through a bounded rescue rejection", () => {
  const playback = suffix => ({ status: 200, playlist_status: 200,
    segment_status: 200, segment_bytes: 1024, playlist_sha256: suffix.repeat(64),
    segment_sha256: suffix.repeat(64), media_sequence: 1,
    latest_segment_sequence: 3, target_duration_seconds: 2 });
  const point = (sequence, failures) => ({ sequence,
    observed_at: new Date(sequence * 60_000).toISOString(),
    renewals: [{ channel: 1, playback: playback("a") },
      { channel: 4, playback: playback("b") }],
    shadow: { media: { progressing: 2, stalled: 0,
      inputs: [{ owner_state: "CURRENT", canonical_owner_progressing: true },
        { owner_state: "WARMING_CONTINUITY", candidate_progressing: true }],
      lifecycle: { warmHandoffFailures: failures } } } });
  const result = classifyBoundedOutputRescueRejection([
    point(1, 0), point(2, 1), point(3, 1)
  ], { warmHandoffFailures: 1, warmHandoffConfirmationFailures: 1,
    warmHandoffRollbacks: 0, staleInput: 0, stalePlaylist: 0,
    staleOnRequest: 0, inputSocketError: 0, upstreamFailed: 0,
    startsByReason: { recovery: 0 }, warmHandoffs: 2,
    warmHandoffFailuresByMode: { outputRescue: 1 } }, { expectedProgressing: 2 });
  assert.equal(result.pass, true);
});

test("proactive session renewal passes only with an exact continuous epoch drain", () => {
  const playback = { status: 200, playlist_status: 200, segment_status: 200,
    segment_bytes: 1024 };
  const checkpoints = [1, 2, 3].map(sequence => ({ sequence,
    renewals: [{ channel: 1, playback }, { channel: 4, playback }],
    shadow: { http: 200, media: { progressing: 2, stalled: 0 } } }));
  const lifecycle = { startsByReason: { sessionSweep: 4, recovery: 0 },
    warmHandoffsByMode: { sessionSweep: 4 },
    warmHandoffFailuresByMode: { sessionSweep: 0 }, inputSocketError: 0,
    staleInput: 0, stalePlaylist: 0, staleOnRequest: 0 };
  const session = { rotations: 2, login_succeeded: 3, proactive_attempts: 2,
    proactive_succeeded: 2, logout_succeeded: 2, logout_failed: 0,
    retired_session_backlog: 0,
    last_rotation_reason: "proactive_nonexclusive_renewal" };
  assert.equal(classifyContinuousSessionRenewal(checkpoints, lifecycle, session,
    { expectedProgressing: 2 }).pass, true);
  assert.equal(classifyContinuousSessionRenewal(checkpoints, {
    ...lifecycle, startsByReason: { sessionSweep: 3, recovery: 0 }
  }, session, { expectedProgressing: 2 }).reason, "SESSION_SWEEP_COUNTERS_INVALID");
  assert.equal(classifyContinuousSessionRenewal(checkpoints, lifecycle, {
    ...session, logout_succeeded: 1, retired_session_backlog: 1
  }, { expectedProgressing: 2 }).reason, "SESSION_SWEEP_COUNTERS_INVALID");
  assert.equal(classifyContinuousSessionRenewal([
    ...checkpoints.slice(0, 1), { ...checkpoints[1], shadow: { http: 200,
      media: { progressing: 1, stalled: 1 } } }, ...checkpoints.slice(2)
  ], lifecycle, session, { expectedProgressing: 2 }).reason, "SESSION_SWEEP_MEDIA_GAP");
});

test("session-sweep replacements require sustained media before promotion", () => {
  assert.match(server,
    /\["ROUTINE_FINITE_RESPONSE", "OUTPUT_RESCUE", "SESSION_SWEEP",\s+"SESSION_SWEEP_EXCLUSIVE"\]\.includes\(handoffMode\)[\s\S]*minimumConfirmationMs: PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS[\s\S]*minimumOutputAdvances: PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES/,
  "session sweeps must use the same sustained-output promotion proof as bounded rescue");
  assert.match(server,
    /if \(!replacement \|\| !observation\.outputConfirmed \|\| !relayIsProgressing\(replacement\)/,
  "no handoff mode may promote an unconfirmed replacement");
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: 1_000,
    outputAdvanced: true,
    outputAdvanceCount: PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES - 1,
    lastOutputAt: 8_000,
    now: 8_000,
    minimumConfirmationMs: PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
    maximumOutputIdleMs: PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS
  }), false, "brief session-sweep output must remain in probation");
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: 1_000,
    outputAdvanced: true,
    outputAdvanceCount: PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES,
    lastOutputAt: 8_000,
    now: 8_000,
    minimumConfirmationMs: PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
    maximumOutputIdleMs: PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS
  }), true, "four advances across the bounded window may promote");
});

test("finite recorder-response renewal passes only with retained HLS continuity", () => {
  const playback = { status: 200, playlist_status: 200, segment_status: 200,
    segment_bytes: 1024 };
  const checkpoints = [
    { progressing: 1, renewing: 0 },
    { progressing: 0, renewing: 1 },
    { progressing: 1, renewing: 0 }
  ].map((media, sequence) => ({ sequence: sequence + 1,
    renewals: [{ channel: 1, playback: { ...playback } }],
    shadow: { http: 200, media: { ...media, stalled: 0 } } }));
  const lifecycle = { upstreamEnded: 1, inputSocketError: 1,
    startsByReason: { sessionSweep: 0, recovery: 1 },
    warmHandoffsByMode: { sessionSweep: 0 },
    warmHandoffFailuresByMode: { sessionSweep: 0 },
    staleInput: 0, stalePlaylist: 0, staleOnRequest: 0 };
  const session = { rotations: 1, login_succeeded: 2,
    proactive_attempts: 0, proactive_succeeded: 0,
    logout_succeeded: 1, logout_failed: 0, retired_session_backlog: 0,
    last_rotation_reason: "finite_response_body_retired" };
  const result = classifyContinuousSessionRenewal(checkpoints, lifecycle, session,
    { expectedProgressing: 1 });
  assert.equal(result.pass, true);
  assert.equal(result.warning, "FINITE_RESPONSE_RENEWAL_WITH_CONTINUOUS_MEDIA");
  const broken = structuredClone(checkpoints);
  broken[1].renewals[0].playback.segment_status = 503;
  assert.equal(classifyContinuousSessionRenewal(broken, lifecycle, session,
    { expectedProgressing: 1 }).reason, "SESSION_SWEEP_MEDIA_GAP");
});

test("exclusive session sweep serves only a fresh retained HLS generation", () => {
  const now = 100_000;
  assert.equal(privateNvrRetainedHlsContinuity({ handoffInFlight: true,
    handoffMode: "SESSION_SWEEP_EXCLUSIVE", retainedOutputAt: now - 6_000,
    relayStaleMs: 20_000, now }), true);
  assert.equal(privateNvrRetainedHlsContinuity({ handoffInFlight: true,
    handoffMode: "SESSION_SWEEP_EXCLUSIVE", retainedOutputAt: now - 20_000,
    relayStaleMs: 20_000, now }), false, "hard-stale HLS must fail closed");
  assert.equal(privateNvrRetainedHlsContinuity({ handoffInFlight: false,
    handoffMode: "SESSION_SWEEP_EXCLUSIVE", retainedOutputAt: now - 1_000,
    relayStaleMs: 20_000, now }), false, "completed handoff cannot retain authority");
  assert.equal(privateNvrRetainedHlsContinuity({ handoffInFlight: false,
    recoveryInFlight: true, handoffMode: "SESSION_SWEEP_EXCLUSIVE",
    retainedOutputAt: now - 11_000, relayStaleMs: 20_000, now }), true,
  "the same fresh generation bridges one canonical recovery after a failed sweep");
  assert.equal(privateNvrRetainedHlsContinuity({ handoffInFlight: true,
    handoffMode: "OUTPUT_RESCUE", retainedOutputAt: now - 1_000,
    relayStaleMs: 20_000, now }), false, "other recovery modes stay fail-closed");
  assert.match(server, /const relayRetainedPlayback = new Map\(\)/);
  assert.match(server,
    /relayStreamIds = new Set\(\[\.\.\.relays\.keys\(\), \.\.\.relayCandidates\.keys\(\),\s+\.\.\.relayRecovery\.keys\(\), \.\.\.relayRetainedPlayback\.keys\(\)\]\)/,
  "retained-only streams must remain visible to the health contract");
  assert.match(server,
    /retainExclusivePlayback\(streamId, previous, "SESSION_SWEEP_EXCLUSIVE"\);[\s\S]*SESSION_SWEEP_OWNER_RELEASE/);
  assert.match(server, /playbackEffective: effective \|\|/);
  assert.match(server,
    /if \(!\(continuity\.renewing && relay\)\) relay = await ensureRelay\(match\[1\]\)/,
  "retained playback must not bypass or replace the canonical recovery timer");
});

test("simultaneous finite-response recovery retains every fresh DVR source", () => {
  const now = 100_000;
  const states = Array.from({ length: 9 }, (_, index) => ({
    progressing: false,
    renewing: privateNvrRetainedHlsContinuity({
      handoffInFlight: false,
      recoveryInFlight: true,
      handoffMode: "FINITE_RESPONSE_RECOVERY",
      retainedOutputAt: now - 2_000 - index,
      relayStaleMs: 20_000,
      now
    })
  }));
  assert.deepEqual(summarizeRelayAvailability(states), {
    progressingRelays: 0,
    renewingRelays: 9,
    availableRelays: 9,
    stalledRelays: 0
  });
  assert.equal(privateNvrRetainedHlsContinuity({
    recoveryInFlight: true,
    handoffMode: "FINITE_RESPONSE_RECOVERY",
    retainedOutputAt: now - 20_000,
    relayStaleMs: 20_000,
    now
  }), false, "finite-response continuity still fails closed at hard stale");
  assert.equal(privateNvrRetainedHlsContinuity({
    recoveryInFlight: false,
    handoffMode: "FINITE_RESPONSE_RECOVERY",
    retainedOutputAt: now - 1_000,
    relayStaleMs: 20_000,
    now
  }), false, "retained media without canonical recovery is not availability");
  assert.match(server,
    /retainFiniteResponsePlayback\(streamId, relay, exitReason\);[\s\S]*relays\.delete\(streamId\)/,
  "finite media must be retained before canonical ownership is removed");
  assert.match(server,
    /if \(!relay\) return \[\{[\s\S]*playback_continuity: continuity\.playbackContinuity[\s\S]*media_owner_state:/,
  "health must report both retained renewal and explicit stalled source rows");
});

test("fresh recorder input with stalled VideoToolbox output enters one exclusive software rescue", () => {
  const now = 100_000;
  const stalledHardware = {
    startedAt: now - PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS,
    lastInputAt: now - 100,
    lastOutputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS,
    nativeInputEnded: false,
    encoder: "videotoolbox",
    progressing: true,
    recoveryStable: true,
    warming: false
  };
  assert.equal(privateNvrHardwareOutputStalled(stalledHardware, now), true);
  assert.equal(privateNvrRelayHandoffMode(stalledHardware, now), "OUTPUT_RESCUE");
  assert.equal(privateNvrHardwareOutputStalled({
    ...stalledHardware, encoder: "libx264"
  }, now), false, "software output idle remains on the established transport path");
  assert.equal(privateNvrHardwareOutputStalled({
    ...stalledHardware,
    lastInputAt: now - PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS
  }, now), false, "stale input must not be misclassified as an encoder-only failure");
  assert.equal(privateNvrRetainedHlsContinuity({
    handoffInFlight: true, handoffMode: "OUTPUT_RESCUE_EXCLUSIVE",
    retainedOutputAt: now - 1_000, relayStaleMs: 20_000, now
  }), true, "fresh retained HLS bridges the bounded exclusive encoder rescue");
  assert.equal(privateNvrRetainedHlsContinuity({
    handoffInFlight: false, recoveryInFlight: false,
    handoffMode: "OUTPUT_RESCUE_EXCLUSIVE",
    retainedOutputAt: now - 1_000, relayStaleMs: 20_000, now
  }), false, "retained output cannot outlive the canonical handoff/recovery");
  assert.match(server,
    /hardwareOutputStalled[\s\S]*hardwareTranscoder\.failed\(streamId\)/,
  "the affected hardware path must be quarantined before replacement starts");
  assert.match(server,
    /forcedHardwareOutputRescue[\s\S]*retainExclusivePlayback\(streamId, previous, "OUTPUT_RESCUE_EXCLUSIVE"\)[\s\S]*HARDWARE_OUTPUT_STALL_OWNER_RELEASE/,
  "the DVR's one-response boundary requires retained HLS before releasing the failed owner");
  assert.match(server,
    /rmSync\(join\(HLS_ROOT, "\.generations"\), \{ recursive: true, force: true \}\)/,
  "interrupted candidate generations must be scavenged on service startup");
  assert.match(server,
    /gan-batuach-video-gateway-hls-\$\{PORT\}/,
  "Gateway, Connector and deterministic QA must not share one HLS namespace");
});

test("qualification counts bounded retained playback without inventing frame progression", () => {
  const startedAt = Date.parse("2026-10-03T00:00:00.000Z");
  const channels = [1, 2, 3, 4, 5, 6, 7, 10, 11];
  const point = (minute, renewing = null) => ({
    sampled_at: new Date(startedAt + minute * 60_000).toISOString(),
    interval_ms: 60_000, empty_dvr_slots: 6,
    dvr: { liveness: { ok: true }, classification: "PASS", component_status: "degraded",
      expected: 10, source_available: 9, known_upstream_unavailable: [8],
      progressing: renewing ? 8 : 9, available: 9,
      inputs: channels.map(channel => ({ channel,
        progressing: channel !== renewing,
        renewing: channel === renewing,
        playback_continuity: channel === renewing })) },
    tapo: { liveness: { ok: true }, classification: "PASS", progressing: 1,
      inputs: [{ channel: 1, progressing: true }] },
    resources: { gateway: { runtime_pid: 11, supervisor_pid: 1 },
      connector: { runtime_pid: 22, supervisor_pid: 2 } }
  });
  const result = summarizeRealHomeSoak([point(0), point(1, 6)], {
    startedAt, endedAt: startedAt + 120_000, requiredDurationMs: 120_000,
    dvrSourceAvailable: 9, dvrKnownUpstreamUnavailable: [8]
  });
  assert.equal(result.camera_sample_availability, 1);
  assert.equal(result.per_camera["dvr-6"].availability, 1);
  assert.ok(!result.gate_failures.includes("EXPECTED_CAMERA_AVAILABILITY_BELOW_100_PERCENT"));
});

test("session renewal accepts retained-HLS availability only with live playback", () => {
  const playback = { status: 200, playlist_status: 200, segment_status: 200,
    segment_bytes: 1 };
  const checkpoints = [1, 2].map(sequence => ({ sequence,
    shadow: { http: 200, media: { progressing: sequence === 1 ? 1 : 0,
      renewing: 0, available: 1, stalled: 0 } },
    renewals: [{ playback: { ...playback } }] }));
  const lifecycle = { startsByReason: { sessionSweep: 1, recovery: 0 },
    warmHandoffsByMode: { sessionSweep: 1 },
    warmHandoffFailuresByMode: { sessionSweep: 0 }, staleInput: 0,
    stalePlaylist: 0, staleOnRequest: 0, inputSocketError: 0 };
  const session = { rotations: 1, proactive_attempts: 1, proactive_succeeded: 1,
    login_succeeded: 2, logout_succeeded: 1, logout_failed: 0,
    retired_session_backlog: 0, last_rotation_reason: "proactive_nonexclusive_renewal" };
  assert.equal(classifyContinuousSessionRenewal(checkpoints, lifecycle, session,
    { expectedProgressing: 1 }).pass, true);
  const brokenPlayback = structuredClone(checkpoints);
  brokenPlayback[1].renewals[0].playback.segment_status = 503;
  assert.equal(classifyContinuousSessionRenewal(brokenPlayback, lifecycle, session,
    { expectedProgressing: 1 }).reason, "SESSION_SWEEP_MEDIA_GAP");
  const missingAvailability = structuredClone(checkpoints);
  delete missingAvailability[1].shadow.media.available;
  assert.equal(classifyContinuousSessionRenewal(missingAvailability, lifecycle, session,
    { expectedProgressing: 1 }).reason, "SESSION_SWEEP_MEDIA_GAP");
});

test("live multi-source evidence disables age-only relay churn", () => {
  assert.equal(PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED, false);
  assert.match(readFileSync("services/video-gateway/private-nvr-session-policy.mjs", "utf8"),
    /PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED[\s\S]*recoveryStable/);
  assert.match(server,
    /Real rendered-output loss continues through the bounded rescue lane/);
  const shadow = readFileSync("scripts/qa/run-push38-dvr-shadow.mjs", "utf8");
  assert.match(shadow,
    /DVR_SHADOW_EXPECT_REACTIVE_ONLY[\s\S]*AGE_ONLY_ROUTINE_HANDOFF_OBSERVED/);
  assert.match(shadow,
    /!expectReactiveOnly && durationMs >= 2 \* 60_000/,
  "reactive-only proof must not fabricate a handoff merely to satisfy the old fixture");
  assert.match(shadow, /DVR_SHADOW_CHANNELS/);
  assert.match(shadow,
    /DVR_SHADOW_HIGH_RESOLUTION_PLAYBACK_CONTINUITY[\s\S]*minimumIntervalMs[\s\S]*requestedSignedArtifact[\s\S]*requestedSignedBundle/,
  "one signed channel may sample HLS every second without widening the general Shadow surface");
  assert.match(shadow, /DVR_SHADOW_ISOLATED_LIVE_GATEWAY_MUST_BE_STOPPED/);
  assert.match(shadow, /VIDEO_GATEWAY_SHADOW_ALLOWED_CHANNELS/);
  assert.match(shadow,
    /pre_validation_settling[\s\S]*finalRenewals[\s\S]*final_verification[\s\S]*qualificationCheckpoints/,
  "terminal Shadow evidence must include post-settlement playback and lifecycle counters");
  assert.match(shadow, /terminal_verification: true/);
  assert.match(server,
    /ordinaryFilterValid[\s\S]*filter\.length === 1[\s\S]*isolatedFilterValid[\s\S]*SHADOW_ALLOWED_CHANNELS/,
  "all Shadow modes stay on their exact explicitly bounded read-only channel set");
  assert.match(server,
    /HOME_SOURCE_AVAILABLE_SHADOW_CHANNELS = \[1, 2, 3, 4, 5, 6, 7, 10, 11\][\s\S]*boundedIsolatedShadowChannels/,
  "the isolated multi-source proof may use only the nine physically source-available Home channels");
});

test("a synchronized nine-source sweep starts before the finite deadline", () => {
  const startedAt = 1_000_000;
  const latestSafeStartAt = startedAt + PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS
    - 9 * PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS;
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS, 18_000);
  assert.deepEqual(privateNvrRoutineHandoffSchedule(
    Array(9).fill(startedAt), latestSafeStartAt - 1), {
    ready: false, latestSafeStartAt, nextStartedAt: startedAt, queued: 9
  });
  assert.deepEqual(privateNvrRoutineHandoffSchedule(
    Array(9).fill(startedAt), latestSafeStartAt), {
    ready: true, latestSafeStartAt, nextStartedAt: startedAt, queued: 9
  });
  assert.match(server, /const relayWarmupModes = new Map\(\)/);
  assert.match(server,
    /privateNvrRoutineHandoffSchedule\([\s\S]*void warmReplacePrivateNvrRelay/);
  assert.match(server,
    /if \(relayWarmups\.has\(streamId\)\) continue;[\s\S]*const candidateRows = \[[\s\S]*\.\.\.outputRescues,[\s\S]*routine\.slice\(0, 1\)/,
  "an in-flight source cannot be selected twice and a rescue backlog cannot starve the routine lane");
});

test("routine scheduling serves the least-fresh output before an older but fresh relay", () => {
  assert.ok(comparePrivateNvrHandoffPriority(
    { startedAt: 2_000, lastOutputAt: 8_000 },
    { startedAt: 1_000, lastOutputAt: 9_000 }) < 0);
  assert.ok(comparePrivateNvrHandoffPriority(
    { startedAt: 1_000, lastOutputAt: 9_000 },
    { startedAt: 2_000, lastOutputAt: 8_000 }) > 0);
  assert.equal(comparePrivateNvrHandoffPriority(
    { startedAt: 1_000, lastOutputAt: 9_000 },
    { startedAt: 2_000, lastOutputAt: 9_000 }), -1_000);
  assert.match(server, /routine\.sort\(\(left, right\) => comparePrivateNvrHandoffPriority/);
});

test("routine probation stays scheduler-bounded while rescue has its own bounded lane", () => {
  const startedAt = 500_000;
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS, 9_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS, 18_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_GRACE_MS, 2_000);
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "ROUTINE_FINITE_RESPONSE", probationStartedAt: startedAt
  }), startedAt + 9_000);
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "ROUTINE_FINITE_RESPONSE", probationStartedAt: startedAt,
    firstOutputObservedAt: startedAt + 7_700
  }), startedAt + 15_700);
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "ROUTINE_FINITE_RESPONSE", probationStartedAt: startedAt,
    firstOutputObservedAt: startedAt + 12_000
  }), startedAt + 18_000);
  assert.equal(PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS, 14_000);
  assert.equal(PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS, 21_000);
  assert.equal(PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS, 16_000);
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "OUTPUT_RESCUE", probationStartedAt: startedAt
  }), startedAt + 14_000);
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "OUTPUT_RESCUE", probationStartedAt: startedAt,
    firstOutputObservedAt: startedAt + 13_000
  }), startedAt + 21_000);
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "OUTPUT_RESCUE", probationStartedAt: startedAt,
    firstOutputObservedAt: startedAt + 5_329
  }), startedAt + 21_000,
  "first output unlocks the existing total rescue probation, not a clipped cadence sub-deadline");
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "OUTPUT_RESCUE", probationStartedAt: startedAt,
    firstOutputObservedAt: startedAt + 20_000
  }), startedAt + 21_000);
  const measuredFirstOutputAt = startedAt + 3_256;
  const measuredFourthAdvanceAt = startedAt + 15_000;
  assert.ok(privateNvrHandoffProbationDeadline({
    handoffMode: "OUTPUT_RESCUE", probationStartedAt: startedAt,
    firstOutputObservedAt: measuredFirstOutputAt
  }) >= measuredFourthAdvanceAt,
  "the CH10 cadence has time to produce its fourth distinct advance inside the unchanged total bound");
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: measuredFirstOutputAt,
    outputAdvanced: true, outputAdvanceCount: 3,
    lastOutputAt: startedAt + 11_000, now: startedAt + 11_000
  }), false,
  "three advances remain insufficient even while probation stays open");
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: measuredFirstOutputAt,
    outputAdvanced: true, outputAdvanceCount: 4,
    lastOutputAt: measuredFourthAdvanceAt, now: measuredFourthAdvanceAt
  }), true,
  "the fourth fresh advance confirms the measured rescue without relaxing continuity evidence");
  assert.match(server, /privateNvrHandoffProbationDeadline\(\{ handoffMode,/);
  assert.match(server,
    /relayWarmupModes\.get\(streamId\) === "OUTPUT_RESCUE"[\s\S]*PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS/);
});

test("playback can use a progressing rescue candidate without promoting ownership", () => {
  assert.match(server,
    /const continuity = relayMediaContinuity\(streamId, promoted\);[\s\S]*const available = continuity\.playbackEffective/);
  assert.match(server,
    /let continuity = relayMediaContinuity\(match\[1\]\);\s+let relay = continuity\.playbackEffective/);
  assert.match(server,
    /\[relay, current, candidate\]\.flatMap\(relayGenerationDirectories\)/);
  assert.match(server,
    /cleanupRelayDirectories\(streamId, relays\.get\(streamId\), \[[\s\S]*replacement\?\.directory[\s\S]*\]\.filter\(Boolean\)\)/);
  assert.match(server, /last_handoff_first_output_latency_ms/);
  assert.match(server, /last_handoff_output_advances/);
});

test("an exclusive rescue reopens only a stranded retained response", () => {
  assert.match(server,
    /hardStaleWaitMs[\s\S]*PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS[\s\S]*hardStaleWaitMs \+ 25/,
  "the acquired request stays bounded until the old owner reaches hard stale");
  assert.equal(privateNvrExclusiveRescueContinuationStalled({
    lastAdvanceObservedAt: 10_000, now: 12_999, maximumNoAdvanceMs: 3_000
  }), false);
  assert.equal(privateNvrExclusiveRescueContinuationStalled({
    lastAdvanceObservedAt: 10_000, now: 13_000, maximumNoAdvanceMs: 3_000
  }), true);
  assert.match(server,
    /maximumNoAdvanceMs: PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS[\s\S]*observation\.continuationStalled[\s\S]*EXCLUSIVE_RESCUE_REOPEN/,
  "the retained response gets the existing freshness budget before one exclusive reopen");
  assert.match(server,
    /exclusiveRescueReopens \+= 1[\s\S]*previousDirectories[\s\S]*previousGenerations/,
  "the exclusive reopen preserves both prior HLS generations");
  assert.match(server,
    /observeWarmReplacement\(replacement,[\s\S]*minimumConfirmationMs,[\s\S]*minimumOutputAdvances/,
  "the reopened response must satisfy the unchanged promotion contract");
});

test("a recovered owner wins over an early confirmed rescue candidate", () => {
  const now = Date.now();
  assert.equal(privateNvrOutputRescueStillRequired({ ownerRunning: true,
    ownerCurrent: true, ownerProgressing: true,
    ownerOutputAt: now - 250, candidateOutputAt: now - 50, now }), false);
  assert.match(server,
    /last_handoff_result: "OWNER_RECOVERED"[\s\S]*lastOutputRescueFailureAt = Date\.now\(\)[\s\S]*OUTPUT_RESCUE_OWNER_RECOVERED/);
});

test("Shadow accepts an explicitly contained owner recovery only with media continuity", () => {
  const playback = { status: 200, playlist_status: 200, segment_status: 200,
    segment_bytes: 4096 };
  const checkpoint = (sequence, recovered = false, eventAt = sequence * 10_000 - 1_000) => ({ sequence,
    observed_at: new Date(sequence * 10_000).toISOString(),
    renewals: [{ channel: 4, playback }],
    shadow: { media: { progressing: 1, stalled: 0,
      inputs: [{ owner_state: "CURRENT", canonical_owner_progressing: true }],
      lifecycle: { staleInput: 0, stalePlaylist: 0, staleOnRequest: 0,
        startsByReason: { recovery: 0 } },
      source_diagnostics: recovered ? [{ channel: 4,
        last_handoff_result: "OWNER_RECOVERED",
        last_failure_reason: "OUTPUT_RESCUE_OWNER_RECOVERED",
        last_failure_at: new Date(eventAt).toISOString() }] : [] } } });
  const contained = classifyContainedOwnerRecovery([
    checkpoint(1), checkpoint(2, true, 19_000), checkpoint(3, true, 19_000)
  ]);
  assert.equal(contained.pass, true);
  assert.equal(contained.events, 1, "repeated health projections must not double-count one recovery");
  const broken = checkpoint(2, true);
  broken.shadow.media.progressing = 0;
  assert.equal(classifyContainedOwnerRecovery([checkpoint(1), broken]).reason,
    "OWNER_RECOVERY_MEDIA_GAP");
});

test("playlist continuity requires four distinct advances over six seconds", () => {
  assert.equal(PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS, 3_000);
  assert.equal(PRIVATE_NVR_RELAY_HANDOFF_TICK_MS, 1_000);
  assert.ok(PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS
    + PRIVATE_NVR_RELAY_HANDOFF_TICK_MS + 5_329 < 10_000,
  "trigger, scheduler detection and measured rescue acquisition must fit inside the unchanged HLS freshness proof");
  const now = 100_000;
  assert.equal(PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS, 4_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS, 6_000);
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES, 4);
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - 6_000, outputAdvanced: true,
    outputAdvanceCount: 3, lastOutputAt: now, now }), false);
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - 5_999, outputAdvanced: true,
    outputAdvanceCount: 4, lastOutputAt: now, now }), false);
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - 6_000, outputAdvanced: true,
    outputAdvanceCount: 4, lastOutputAt: now, now }), true);
  assert.equal(privateNvrRoutineHandoffConfirmed({
    confirmationStartedAt: now - 6_000, outputAdvanced: true,
    outputAdvanceCount: 5, lastOutputAt: now - 500, now }), true,
  "a proven candidate confirms when time matures between playlist writes");
  assert.match(server,
    /if \(outputAt > lastObservedOutputAt\)[\s\S]*outputConfirmed = minimumConfirmationMs/);
});

test("HLS playback numbering remains monotonic across relay generations", () => {
  const oldPlaylist = "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:15\nsegment-000025.ts\nsegment-000026.ts\n";
  const candidatePlaylist = "#EXTM3U\n#EXT-X-MEDIA-SEQUENCE:14\nsegment-000024.ts\nsegment-000025.ts\n";
  assert.deepEqual(inspectHlsPlaybackPlaylist(oldPlaylist), {
    mediaSequence: 15, segmentCount: 2, lastSequence: 16
  });
  const projected = projectHlsPlaybackPlaylist(candidatePlaylist, {
    offset: 3, generation: "11111111-1111-4111-8111-111111111111",
    revision: 1, token: "playback-token"
  });
  assert.equal(projected.firstSequence, 17);
  assert.equal(projected.lastSequence, 18);
  assert.match(projected.playlist, /#EXT-X-MEDIA-SEQUENCE:17/);
  assert.equal(HLS_PLAYBACK_HOLDBACK_SEGMENTS, 6);
  assert.match(projected.playlist,
    /#EXT-X-START:TIME-OFFSET=-6,PRECISE=YES/,
  "the signed Gateway advertises a six-segment playback holdback across exclusive renewal");
  assert.match(projected.playlist,
    /segment-000024\.ts\?generation=11111111-1111-4111-8111-111111111111&revision=1&token=playback-token/);
  const candidate = { mediaSequence: 0, segmentCount: 2, lastSequence: 1 };
  const candidateOffset = nextHlsPlaybackOffset(candidate, {
    currentOffset: 0, lastExternalFirstSequence: 14,
    lastExternalLastSequence: 25, generationChanged: true
  });
  assert.equal(candidate.mediaSequence + candidateOffset, 25);
  assert.equal(candidate.lastSequence + candidateOffset, 26);
  const fallback = { mediaSequence: 18, segmentCount: 12, lastSequence: 29 };
  const fallbackOffset = nextHlsPlaybackOffset(fallback, {
    currentOffset: 0, lastExternalFirstSequence: 25,
    lastExternalLastSequence: 26, generationChanged: true
  });
  assert.equal(fallback.mediaSequence + fallbackOffset, 25,
    "candidate rejection cannot move the fallback playlist window backwards");
  assert.equal(fallback.lastSequence + fallbackOffset, 36,
    "candidate rejection advances the external tail across generations");
  assert.match(server, /directRtsp \? rtspInput\.args : \["-i", "pipe:0"\]/,
    "an already-live private DVR response must be consumed without an artificial readrate throttle");
  assert.doesNotMatch(server, /\["-readrate", "1", "-i", "pipe:0"\]/,
    "FFmpeg warns that readrate throttling an actual live stream can lose packets");
  assert.match(server, /projectPlaybackPlaylist\(match\[1\], relay/);
  assert.match(server, /requestedGeneration[\s\S]*relayGenerationDirectories/);
});

test("retained HLS may bridge only its explicitly advertised playback buffer", () => {
  const point = (seconds, sequence, ownerState = "CURRENT") => ({
    observed_at: new Date(seconds * 1_000).toISOString(), channel: 1,
    renewal: { status: 200, playlist_status: 200, segment_status: 200,
      segment_bytes: 1024, media_sequence: sequence - 11,
      latest_segment_sequence: sequence, target_duration_seconds: 1,
      start_time_offset_seconds: -6, segment_count: 12,
      playlist_sha256: `${sequence}`.padStart(64, "a").slice(-64),
      segment_sha256: `${sequence}`.padStart(64, "b").slice(-64) },
    shadow: { media: { inputs: [{ channel: 1, owner_state: ownerState,
      media_owner_state: ownerState === "RENEWING" ? "RETAINED_HLS" : "CURRENT",
      playback_continuity: ownerState === "RENEWING" }] } }
  });
  const buffered = evaluateHlsRenewalContinuity([
    point(0, 20), point(1, 21), point(5.5, 21, "RENEWING"), point(6, 22)
  ]);
  assert.equal(buffered.pass, true);
  assert.equal(buffered.buffered_handoffs, 1);
  assert.equal(evaluateHlsRenewalContinuity([
    point(0, 20), point(1, 21), point(7.1, 21, "RENEWING")
  ]).reason, "PLAYLIST_FRESHNESS_EXCEEDED",
  "retained playback must still fail closed after its advertised buffer is exhausted");
});

test("a progressing candidate preserves health without early ownership promotion", () => {
  assert.deepEqual(privateNvrHandoffMediaContinuity({
    currentProgressing: true, candidateProgressing: true
  }), { progressing: true, owner: "CURRENT", mediaOwner: "CURRENT" });
  assert.deepEqual(privateNvrHandoffMediaContinuity({
    currentProgressing: true, candidateProgressing: true,
    handoffMode: "OUTPUT_RESCUE", currentOutputAt: 80_000,
    candidateOutputAt: 99_000, now: 100_000,
    mediaTakeoverIdleMs: PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS
  }), { progressing: true, owner: "CURRENT", mediaOwner: "WARMING_CONTINUITY" },
  "fresh rescue media is served without promoting canonical ownership");
  assert.deepEqual(privateNvrHandoffMediaContinuity({
    currentProgressing: false, candidateProgressing: true
  }), { progressing: true, owner: "WARMING_CONTINUITY",
    mediaOwner: "WARMING_CONTINUITY" });
  assert.deepEqual(privateNvrHandoffMediaContinuity({
    currentProgressing: false, candidateProgressing: false
  }), { progressing: false, owner: "NONE", mediaOwner: "NONE" });
  assert.match(server, /const relayCandidates = new Map\(\)/);
  assert.match(server,
    /const effective = privateNvrHealthEffectiveRelay\(\{ current, candidate,[\s\S]*mediaOwner: state\.mediaOwner \}\)/,
  "health must select only the relay named by continuity and tolerate a bounded no-owner interval");
  assert.match(server,
    /const relayStreamIds = new Set\(\[\.\.\.relays\.keys\(\), \.\.\.relayCandidates\.keys\(\),[\s\S]*\.\.\.relayRecovery\.keys\(\), \.\.\.relayRetainedPlayback\.keys\(\)\]\)/,
  "health must enumerate candidate-only, recovery, and retained-HLS continuity");
  assert.match(server,
    /activeRelays: relayContinuity\.filter\(\(\[, state\]\) =>\s*relayIsRunning\(state\.effective\)\)\.length/,
  "active media health must count the effective relay without promoting ownership");
  assert.match(server,
    /relayRunning: relayIsRunning\(continuity\.effective\) \|\| continuity\.renewing/,
  "supervision must observe candidate media and bounded retained-HLS renewal continuity");
  assert.match(server, /media_owner_state: continuity\.mediaOwner/);
  assert.match(server, /replacement\.warming = false;\s+relays\.set\(streamId, replacement\);\s+relayCandidates\.delete\(streamId\)/);
});

test("consumer demand cannot bypass relay recovery backoff", () => {
  const now = 200_000;
  const first = nextRelayRecovery(null, now);
  assert.equal(first.failures, 1);
  assert.equal(relayRetryDelayMs(first, now), 500);
  assert.equal(relayRetryDelayMs(first, now + 499), 1);
  assert.equal(relayRetryDelayMs(first, now + 500), 0);
  assert.match(server, /if \(retryDelayMs > maximumWaitMs\) return null/);
  assert.match(server,
    /await new Promise\(resolve => setTimeout\(resolve, retryDelayMs \+ 10\)\)/);
});

test("a contained output-rescue rejection cannot create an immediate retry storm", () => {
  const now = 400_000;
  assert.equal(PRIVATE_NVR_OUTPUT_RESCUE_RETRY_BACKOFF_MS, 60_000);
  assert.equal(privateNvrOutputRescueRetryAllowed(now - 59_999, now), false);
  assert.equal(privateNvrOutputRescueRetryAllowed(now - 60_000, now), true);
  assert.equal(privateNvrOutputRescueRetryAllowed(now - 1, now,
    { hardStale: true }), true, "hard-stale media must bypass the contained-failure delay");
  assert.match(server, /lastOutputRescueFailureAt/);
  assert.match(server,
    /privateNvrOutputRescueRetryAllowed\(relay\.lastOutputRescueFailureAt/);
});

test("recovery does not require a playback lease that cannot exist yet", () => {
  assert.equal(relayRecoveryShouldResume({ hasPlaybackLease: false,
    sourceRegistered: true }), true);
  assert.equal(relayRecoveryShouldResume({ hasPlaybackLease: true,
    sourceRegistered: false }), true);
  assert.equal(relayRecoveryShouldResume({ hasPlaybackLease: false,
    sourceRegistered: false }), false);
  assert.match(server,
    /relayRecoveryShouldResume\(\{ hasPlaybackLease: hasActivePlaybackLease\(streamId\),\s+sourceRegistered: streamSources\.has\(streamId\) \}\)/);
});

test("stale request waits through bounded backoff and handoff media wakes demand", () => {
  assert.match(server,
    /shouldRetainPrivateNvrOwnerOnDemand\(\{[\s\S]*\}\)\) return existing;[\s\S]*STALE_ON_REQUEST/,
  "consumer demand must retain an open private DVR response while heartbeat remains healthy");
  assert.match(server,
    /stopRelay\(streamId, existing, "STALE_ON_REQUEST"\);\s+\}\s+return startRelayAfterRecoveryDelay\(streamId\)/);
  assert.match(server,
    /waitForRelayHandoffMedia\(streamId, requestGraceMs\)/);
  assert.match(server,
    /relayMediaContinuity\(streamId\)\.playbackContinuity/);
  assert.match(server,
    /requestHardwareOutputStalled[\s\S]*requestRescueEligible[\s\S]*existing\.nativeInputEnded === true \|\| requestHardwareOutputStalled[\s\S]*privateNvrHandoffCapacityAvailable\(streamId, "OUTPUT_RESCUE", existing\)[\s\S]*warmReplacePrivateNvrRelay\(streamId, existing, "OUTPUT_RESCUE"\)/,
  "a playback request may reuse the rescue lane after a response end or isolated hardware-output failure");
  assert.match(server, /last_handoff_failure: "CANDIDATE_ACQUISITION_FAILED"/,
  "failed candidate acquisition must be visible in source diagnostics");
  const shadow = readFileSync("scripts/qa/run-push38-dvr-shadow.mjs", "utf8");
  assert.match(shadow,
    /evidence\.settling = await waitForSettledHandoff\(\)[\s\S]*!evidence\.settling\.settled[\s\S]*HANDOFF_NOT_SETTLED/,
  "shadow qualification must allow an in-flight handoff to settle within its existing bounded probation");
  assert.match(shadow,
    /PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS \+ 2_000[\s\S]*consecutiveSettled >= 2/,
  "shadow settlement must remain bounded and require consecutive settled observations");
});

test("brief progress cannot clear recovery history", () => {
  const now = 300_000;
  assert.equal(relayRecoveryIsStable({ startedAt: now - 59_999 }, now), false);
  assert.equal(relayRecoveryIsStable({ startedAt: now - 60_000 }, now), true);
});

test("clean native end is distinct from authentication and transport failure", () => {
  assert.equal(classifyRelayExit({ code: 0 }), "SOURCE_STREAM_ENDED");
  assert.equal(classifyRelayExit({ code: 0, inputErrorCode: "UND_ERR_SOCKET" }),
    "SOURCE_STREAM_ENDED",
  "a recorder response-boundary close with a successful decoder exit is a finite stream end");
  assert.equal(classifyRelayExit({ code: null, inputErrorCode: "UND_ERR_SOCKET",
    sustainedMedia: true }), "SOURCE_RESPONSE_RETIRED");
  assert.equal(classifyRelayExit({ code: null, inputErrorCode: "UND_ERR_SOCKET",
    sustainedMedia: false }), "UPSTREAM_UND_ERR_SOCKET",
  "an early socket loss remains a transport failure");
  assert.equal(classifyRelayExit({ code: null, inputErrorCode: "ECONNRESET",
    sustainedMedia: true, responseRetirementEligible: true }),
  "SOURCE_RESPONSE_RETIRED",
  "an age-bound recorder ECONNRESET is the observed finite-response boundary");
  assert.equal(classifyRelayExit({ code: null, inputErrorCode: "ECONNRESET",
    sustainedMedia: true, responseRetirementEligible: false }),
  "UPSTREAM_ECONNRESET",
  "an ordinary reset cannot rotate shared recorder authentication");
  assert.equal(classifyRelayExit({ code: 1, stderr: "timed out" }), "SOURCE_TIMEOUT");
  assert.equal(classifyRelayExit({ code: 1, stderr: "401 unauthorized" }),
    "SOURCE_AUTH_REJECTED");
});

test("source degradation does not falsely mark the Gateway component offline", () => {
  const startedAt = Date.parse("2026-10-01T00:00:00.000Z");
  const channels = [1, 2, 3, 4, 5, 6, 7, 10, 11];
  const point = (minute, failed = null) => ({
    sampled_at: new Date(startedAt + minute * 60_000).toISOString(),
    interval_ms: 60_000, empty_dvr_slots: 6,
    dvr: { liveness: { ok: true }, classification: failed ? "PRODUCT_FAILURE" : "PASS",
      progressing: failed ? 8 : 9,
      inputs: channels.map(channel => ({ channel, progressing: channel !== failed })) },
    tapo: { liveness: { ok: true }, classification: "PASS", progressing: 1,
      inputs: [{ channel: 1, progressing: true }] },
    resources: { gateway: { runtime_pid: 11, supervisor_pid: 1 },
      connector: { runtime_pid: 22, supervisor_pid: 2 } }
  });
  const result = summarizeRealHomeSoak([point(0), point(1, 3)], {
    startedAt, endedAt: startedAt + 120_000, requiredDurationMs: 120_000,
    dvrSourceAvailable: 9, dvrKnownUpstreamUnavailable: [8]
  });
  assert.equal(result.gateway.unavailable_checkpoints, 0);
  assert.equal(result.gateway.source_degraded_checkpoints, 1);
  assert.equal(result.health_dimensions.component.gateway_unavailable_checkpoints, 0);
  assert.equal(result.health_dimensions.source.gateway_degraded_checkpoints, 1);
  assert.ok(result.gate_failures.includes("EXPECTED_CAMERA_AVAILABILITY_BELOW_100_PERCENT"));
  assert.ok(!result.gate_failures.includes("COMPONENT_HEALTH_CHECK_FAILED"));
});

test("a missing runtime sample is not reported as a process restart", () => {
  const startedAt = Date.parse("2026-10-01T01:00:00.000Z");
  const point = (minute, runtimePid) => ({
    sampled_at: new Date(startedAt + minute * 60_000).toISOString(),
    interval_ms: 60_000, empty_dvr_slots: 6,
    dvr: { liveness: { ok: true }, classification: "PASS", component_status: "degraded",
      expected: 10, source_available: 9, known_upstream_unavailable: [8], progressing: 9,
      inputs: [1, 2, 3, 4, 5, 6, 7, 10, 11].map(channel => ({ channel, progressing: true })) },
    tapo: { liveness: { ok: true }, classification: "PASS", progressing: 1,
      inputs: [{ channel: 1, progressing: true }] },
    resources: { gateway: { supervisor_pid: 101, runtime_pid: runtimePid, pid: 101 },
      connector: { supervisor_pid: 201, runtime_pid: 202, pid: 201 } }
  });
  const result = summarizeRealHomeSoak([point(0, 102), point(1, null), point(2, 102)], {
    startedAt, endedAt: startedAt + 180_000, requiredDurationMs: 180_000,
    dvrSourceAvailable: 9, dvrKnownUpstreamUnavailable: [8]
  });
  assert.equal(result.gateway.runtime_restarts, 0);
});
