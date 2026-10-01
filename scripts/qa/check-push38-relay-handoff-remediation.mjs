import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeRealHomeSoak } from
  "../../lib/domain/digital-observer/reliability-qualification.mjs";
import { classifyRelayExit } from
  "../../services/video-gateway/relay-failure-reason.mjs";
import { nextRelayRecovery, relayRecoveryIsStable, relayRecoveryShouldResume,
  relayRetryDelayMs } from
  "../../services/video-gateway/relay-recovery-policy.mjs";
import { PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS,
  PRIVATE_NVR_MAX_ROUTINE_PROBATIONS,
  PRIVATE_NVR_FINITE_RESPONSE_END_IDLE_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS,
  PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS,
  PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_GRACE_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES,
  PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS,
  comparePrivateNvrHandoffPriority,
  privateNvrHandoffProbationDeadline,
  privateNvrHandoffMediaContinuity,
  privateNvrProvisionalHandoffAllowed,
  privateNvrRoutineHandoffConfirmed,
  privateNvrRoutineHandoffSchedule } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const server = readFileSync("services/video-gateway/server.mjs", "utf8");

test("one routine owner lane leaves one bounded output-rescue lane", () => {
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
  assert.match(server, /const expectedCurrent = previous/);
  assert.doesNotMatch(server, /WARM_HANDOFF_CHAIN_ADVANCED/);
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
  }), startedAt + 13_329,
  "the measured rescue candidate receives the same bounded HLS cadence grace");
  assert.equal(privateNvrHandoffProbationDeadline({
    handoffMode: "OUTPUT_RESCUE", probationStartedAt: startedAt,
    firstOutputObservedAt: startedAt + 20_000
  }), startedAt + 21_000);
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
    /candidate\?\.directory, \.\.\.\(candidate\?\.previousDirectories \|\| \[\]\)/);
  assert.match(server,
    /cleanupRelayDirectories\(streamId, relays\.get\(streamId\), \[replacement\.directory\]\)/);
  assert.match(server, /last_handoff_first_output_latency_ms/);
  assert.match(server, /last_handoff_output_advances/);
});

test("playlist continuity requires four distinct advances over six seconds", () => {
  const now = 100_000;
  assert.equal(PRIVATE_NVR_FINITE_RESPONSE_END_IDLE_MS, 4_000);
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
    /if \(outputAt > lastObservedOutputAt\)[\s\S]*const confirmed = minimumConfirmationMs/);
});

test("a progressing candidate preserves health without early ownership promotion", () => {
  assert.deepEqual(privateNvrHandoffMediaContinuity({
    currentProgressing: true, candidateProgressing: true
  }), { progressing: true, owner: "CURRENT" });
  assert.deepEqual(privateNvrHandoffMediaContinuity({
    currentProgressing: false, candidateProgressing: true
  }), { progressing: true, owner: "WARMING_CONTINUITY" });
  assert.deepEqual(privateNvrHandoffMediaContinuity({
    currentProgressing: false, candidateProgressing: false
  }), { progressing: false, owner: "NONE" });
  assert.match(server, /const relayCandidates = new Map\(\)/);
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
    /evidence\.final_health = await health[\s\S]*HANDOFF_NOT_SETTLED/,
  "shadow qualification must sample a settled final owner after its last interval");
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
