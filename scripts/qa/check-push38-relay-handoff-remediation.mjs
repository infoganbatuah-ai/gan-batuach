import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeRealHomeSoak } from
  "../../lib/domain/digital-observer/reliability-qualification.mjs";
import { classifyBoundedOutputRescueRejection } from
  "./push38-shadow-qualification-policy.mjs";
import { classifyRelayExit } from
  "../../services/video-gateway/relay-failure-reason.mjs";
import { inspectHlsPlaybackPlaylist, nextHlsPlaybackOffset,
  projectHlsPlaybackPlaylist } from
  "../../services/video-gateway/hls-playback-continuity.mjs";
import { nextRelayRecovery, relayRecoveryIsStable, relayRecoveryShouldResume,
  relayRetryDelayMs } from
  "../../services/video-gateway/relay-recovery-policy.mjs";
import { PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS,
  PRIVATE_NVR_MAX_ROUTINE_PROBATIONS,
  PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_RETRY_BACKOFF_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS,
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
  privateNvrOutputRescueRetryAllowed,
  privateNvrProvisionalHandoffAllowed,
  privateNvrRoutineHandoffConfirmed,
  privateNvrRoutineHandoffSchedule } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const server = readFileSync("services/video-gateway/server.mjs", "utf8");

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
  assert.match(shadow, /READ_ONLY_TWO_CHANNEL_SHADOW/);
  assert.match(shadow,
    /pre_validation_settling[\s\S]*finalRenewals[\s\S]*final_verification[\s\S]*qualificationCheckpoints/,
  "terminal Shadow evidence must include post-settlement playback and lifecycle counters");
  assert.match(shadow, /terminal_verification: true/);
  assert.match(server, /filter\.length < 1 \|\| filter\.length > 2/,
  "bounded Shadow may exercise both recorder-safe rescue lanes without broad access");
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
    /const continuity = relayMediaContinuity\(streamId, promoted\);[\s\S]*const available = continuity\.effective/);
  assert.match(server,
    /let relay = relayMediaContinuity\(match\[1\]\)\.effective/);
  assert.match(server,
    /\[relay, current, candidate\]\.flatMap\(relayGenerationDirectories\)/);
  assert.match(server,
    /cleanupRelayDirectories\(streamId, relays\.get\(streamId\), \[[\s\S]*replacement\?\.directory[\s\S]*\]\.filter\(Boolean\)\)/);
  assert.match(server, /last_handoff_first_output_latency_ms/);
  assert.match(server, /last_handoff_output_advances/);
});

test("a body-blocked rescue reuses its acquired candidate after hard stale", () => {
  assert.match(server,
    /hardStaleWaitMs[\s\S]*PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS[\s\S]*hardStaleWaitMs \+ 25/,
  "the acquired request stays bounded until the old owner reaches hard stale");
  assert.match(server,
    /exclusiveRescueColdTakeovers \+= 1[\s\S]*OUTPUT_RESCUE_OWNER_RELEASE/,
  "live evidence distinguishes candidates that could not output before owner release");
  assert.doesNotMatch(server,
    /candidateFirstOutputObserved: Number\.isFinite\(observation\.firstOutputAt\)/,
  "a recorder body blocked by its stale owner must not force a third media request");
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
  assert.match(server, /\["-readrate", "1", "-i", "pipe:0"\]/,
    "private DVR MP4 input must be paced at its native timestamps");
  assert.match(server, /projectPlaybackPlaylist\(match\[1\], relay/);
  assert.match(server, /requestedGeneration[\s\S]*relayGenerationDirectories/);
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
  assert.match(server, /effective: state\.mediaOwner === "WARMING_CONTINUITY" \? candidate : current/);
  assert.match(server,
    /const relayStreamIds = new Set\(\[\.\.\.relays\.keys\(\), \.\.\.relayCandidates\.keys\(\)\]\)/,
  "health must enumerate candidate-only continuity during exclusive rescue");
  assert.match(server,
    /activeRelays: relayContinuity\.filter\(\(\[, state\]\) =>\s*relayIsRunning\(state\.effective\)\)\.length/,
  "active media health must count the effective relay without promoting ownership");
  assert.match(server, /relayRunning: relayIsRunning\(continuity\.effective\)/,
  "supervision must observe the effective relay during candidate-only continuity");
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
    /stopRelay\(streamId, existing, "STALE_ON_REQUEST"\);\s+\}\s+return startRelayAfterRecoveryDelay\(streamId\)/);
  assert.match(server,
    /waitForRelayHandoffMedia\(streamId, requestGraceMs\)/);
  assert.match(server,
    /relayMediaContinuity\(streamId\)\.progressing/);
  assert.match(server,
    /requestRescueEligible[\s\S]*privateNvrHandoffCapacityAvailable\(streamId, "OUTPUT_RESCUE", existing\)[\s\S]*warmReplacePrivateNvrRelay\(streamId, existing, "OUTPUT_RESCUE"\)/,
  "a stale playback request must reuse the bounded output-rescue lane before destructive recovery");
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
