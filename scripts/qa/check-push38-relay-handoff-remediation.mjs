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
  PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
  PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES,
  privateNvrProvisionalHandoffAllowed,
  privateNvrRoutineHandoffConfirmed } from
  "../../services/video-gateway/private-nvr-session-policy.mjs";

const server = readFileSync("services/video-gateway/server.mjs", "utf8");

test("a handoff has one canonical owner and one candidate", () => {
  assert.equal(PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS, 1);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 0 }), true);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1 }), false);
  assert.equal(privateNvrProvisionalHandoffAllowed({ activeProbations: 1,
    replacingExistingProbation: true }), false);
  assert.match(server, /const expectedCurrent = previous/);
  assert.doesNotMatch(server, /WARM_HANDOFF_CHAIN_ADVANCED/);
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
