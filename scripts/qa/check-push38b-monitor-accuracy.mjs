import assert from "node:assert/strict";
import { summarizeRealHomeSoak } from "../../lib/domain/digital-observer/reliability-qualification.mjs";

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

console.log("PUSH38B_MONITOR_ACCURACY_PASS");
