import assert from "node:assert/strict";
import { QUALIFICATION_STAGE_MINIMUM_MS, assertQualificationStageResult,
  summarizeRealHomeSoak } from "../../lib/domain/digital-observer/reliability-qualification.mjs";

const start = Date.parse("2026-09-12T00:00:00.000Z");
const channels = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];
function point(minute, { stalledChannel = null, tapoDown = false, deepProbeError = false } = {}) {
  return {
    sampled_at: new Date(start + minute * 60_000).toISOString(), interval_ms: 60_000,
    empty_dvr_slots: 6,
    dvr: { health_ok: true, progressing: stalledChannel === null ? 10 : 9,
      inputs: channels.map(channel => ({ channel, progressing: channel !== stalledChannel })) },
    tapo: { health_ok: true, progressing: tapoDown ? 0 : 1,
      inputs: [{ channel: 1, progressing: !tapoDown }] },
    resources: { gateway: { runtime_pid: 11, supervisor_pid: 1 }, connector: { runtime_pid: 22, supervisor_pid: 2 } },
    ...(deepProbeError ? { deep_probe_error: "TimeoutError" } : {})
  };
}

const clean = summarizeRealHomeSoak([point(0), point(1)], { startedAt: start, endedAt: start + 120_000, requiredDurationMs: 120_000 });
assert.equal(clean.status, "PASS");
assert.equal(clean.checkpoint_coverage.expected_checkpoints, 2);
assert.equal(clean.checkpoint_coverage.missing_checkpoints, 0);
assert.equal(clean.per_camera["dvr-1"].availability, 1);

const stall = summarizeRealHomeSoak([point(0), point(1, { stalledChannel: 1 })], { startedAt: start, endedAt: start + 120_000, requiredDurationMs: 120_000 });
assert.equal(stall.per_camera["dvr-1"].availability, 0.5);
assert.equal(stall.per_camera["dvr-2"].availability, 1);
assert.ok(stall.gate_failures.includes("EXPECTED_CAMERA_AVAILABILITY_BELOW_100_PERCENT"));

const missing = summarizeRealHomeSoak([point(0), point(4)], { startedAt: start, endedAt: start + 300_000, requiredDurationMs: 300_000 });
assert.equal(missing.checkpoint_coverage.expected_checkpoints, 5);
assert.equal(missing.checkpoint_coverage.missing_checkpoints, 3);
assert.ok(missing.gate_failures.includes("CHECKPOINT_COVERAGE_GAP"));

const probe = summarizeRealHomeSoak([point(0), point(1, { deepProbeError: true })], { startedAt: start, endedAt: start + 120_000, requiredDurationMs: 120_000 });
assert.ok(probe.gate_failures.includes("DEEP_PROBE_MONITOR_FAILURE"));

const legacy = point(0);
delete legacy.dvr.inputs[0].progressing;
const unproven = summarizeRealHomeSoak([legacy], { startedAt: start, endedAt: start + 60_000, requiredDurationMs: 60_000 });
assert.equal(unproven.per_camera["dvr-1"].availability, null);
assert.equal(unproven.per_camera["dvr-1"].unknown_samples, 1);
assert.ok(unproven.gate_failures.includes("PER_CAMERA_PROGRESSION_EVIDENCE_MISSING"));

const available = [1, 3, 4, 5, 6, 7, 10, 11];
const upstreamPoint = minute => ({ ...point(minute),
  source_available_physical_cameras: 9,
  dvr: { health_ok: false, classification: "PASS", component_status: "degraded", expected: 10, source_available: 8,
    known_upstream_unavailable: [2, 8], progressing: 8,
    inputs: available.map(channel => ({ channel, progressing: true })) },
  playback: { verified: 9, failed: 0 } });
const knownUpstream = summarizeRealHomeSoak([upstreamPoint(0), upstreamPoint(1)], {
  startedAt: start, endedAt: start + 120_000, requiredDurationMs: 120_000,
  dvrSourceAvailable: 8, dvrKnownUpstreamUnavailable: [2, 8] });
assert.equal(knownUpstream.status, "PASS");
assert.equal(knownUpstream.camera_sample_availability, 1);
assert.equal(knownUpstream.gateway.unavailable_checkpoints, 0);
assert.ok(!knownUpstream.gate_failures.includes("COMPONENT_HEALTH_CHECK_FAILED"));
assert.equal(knownUpstream.per_camera["dvr-2"].upstream_unavailable, true);
assert.equal(knownUpstream.per_camera["dvr-2"].qualification_denominator, false);
const hiddenUpstream = summarizeRealHomeSoak([{ ...upstreamPoint(0), dvr: {
  ...upstreamPoint(0).dvr, component_status: "healthy" } }, upstreamPoint(1)], {
  startedAt: start, endedAt: start + 120_000, requiredDurationMs: 120_000,
  dvrSourceAvailable: 8, dvrKnownUpstreamUnavailable: [2, 8] });
assert.ok(hiddenUpstream.gate_failures.includes("DVR_SOURCE_AVAILABILITY_EXCEPTION_MISREPORTED"));

const canaryPoints = Array.from({ length: 15 }, (_, minute) => upstreamPoint(minute));
const canary = summarizeRealHomeSoak(canaryPoints, {
  startedAt: start, endedAt: start + QUALIFICATION_STAGE_MINIMUM_MS.CANARY,
  requiredDurationMs: QUALIFICATION_STAGE_MINIMUM_MS.CANARY,
  dvrSourceAvailable: 8, dvrKnownUpstreamUnavailable: [2, 8] });
assert.equal(canary.status, "PASS");
assert.equal(assertQualificationStageResult({ ...canary, qualification_stage: "CANARY" }, "CANARY"), true);
assert.throws(() => assertQualificationStageResult({ ...canary, elapsed_ms: canary.elapsed_ms - 1 }, "CANARY"), /canary_gate_failed/);
assert.throws(() => assertQualificationStageResult(canary, "UNKNOWN"), /stage_invalid/);

console.log("PUSH38B_MONITOR_ACCURACY_PASS");
