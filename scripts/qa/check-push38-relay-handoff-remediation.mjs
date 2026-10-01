import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { summarizeRealHomeSoak } from
  "../../lib/domain/digital-observer/reliability-qualification.mjs";
import { classifyRelayExit } from
  "../../services/video-gateway/relay-failure-reason.mjs";
import { nextRelayRecovery, relayRecoveryIsStable, relayRetryDelayMs } from
  "../../services/video-gateway/relay-recovery-policy.mjs";
import { PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS,
  PRIVATE_NVR_MAX_ROUTINE_PROBATIONS,
  PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES,
  comparePrivateNvrHandoffPriority,
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
  assert.equal(PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS, 12_000);
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

test("failed handoff probation cannot outlive the scheduler slot budget", () => {
  assert.match(server,
    /const deadline = Date\.now\(\) \+ Math\.max\(PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS,\s*minimumConfirmationMs \+ 5_000\)/);
  assert.doesNotMatch(server,
    /minimumConfirmationMs \+ \(maximumOutputIdleMs \?\? 0\) \+ 5_000/);
});

test("playlist continuity requires four distinct advances over six seconds", () => {
  const now = 100_000;
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
  assert.match(server, /if \(relayRetryDelayMs\(relayRecovery\.get\(streamId\)\) > 0\) return null/);
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
