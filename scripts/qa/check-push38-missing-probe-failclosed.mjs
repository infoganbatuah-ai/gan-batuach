import assert from "node:assert/strict";
import { test } from "node:test";
import { REAL_SOAK_MINIMUM_MS, assertQualificationResult, summarizeRealHomeSoak } from "../../lib/domain/digital-observer/reliability-qualification.mjs";

const end = Date.parse("2026-11-17T12:00:00Z");
const sample = {
  sampled_at: new Date(end).toISOString(), interval_ms: 60_000, sequence: 1,
  dvr: { health_ok: true, classification: "PASS", auth: "ready", available: 10,
    inputs: Array.from({ length: 10 }, (_, index) => ({ channel: index === 9 ? 11 : index + 1, progressing: true })) },
  tapo: { health_ok: true, classification: "PASS", auth: "ready", available: 1,
    inputs: [{ progressing: true }] },
  empty_dvr_slots: 6,
  resources: { gateway: { runtime_pid: 11 }, connector: { runtime_pid: 22 } }
};
const summary = (point) => summarizeRealHomeSoak([point], {
  startedAt: end - 60_000, endedAt: end, requiredDurationMs: 0
});

test("missing playback and AI observations stay explicit qualification failures", () => {
  const missing = summary(sample);
  assert.equal(missing.status, "NOT_DONE");
  assert.ok(missing.gate_failures.includes("PLAYBACK_PROBE_FAILED"));
  assert.ok(missing.gate_failures.includes("AI_PROGRESS_PROBE_FAILED"));
  const withProbes = summary({ ...sample, playback: { verified: 11 }, ai: { ok: true } });
  assert.ok(!withProbes.gate_failures.includes("PLAYBACK_PROBE_FAILED"));
  assert.ok(!withProbes.gate_failures.includes("AI_PROGRESS_PROBE_FAILED"));
});

test("result validator cannot accept PASS with any unresolved gate", () => {
  const forged = { contract: "observer-reliability-qualification-v1", evidence: ["REAL_HOME"],
    elapsed_ms: REAL_SOAK_MINIMUM_MS, required_elapsed_complete: true,
    status: "PASS", gate_failures: ["PLAYBACK_PROBE_FAILED"] };
  assert.throws(() => assertQualificationResult(forged), /qualification_pass_has_gate_failures/);
  assert.equal(assertQualificationResult({ ...forged, gate_failures: [] }), true);
});

test("invalid, reversed, or out-of-window checkpoint times fail coverage", () => {
  const first = { ...sample, sampled_at: new Date(end - 60_000).toISOString(),
    playback: { verified: 11 }, ai: { ok: true } };
  const second = { ...first, sequence: 2, sampled_at: new Date(end).toISOString() };
  const summarize = points => summarizeRealHomeSoak(points, {
    startedAt: end - 60_000, endedAt: end, requiredDurationMs: 0
  });
  const valid = summarize([first, second]);
  assert.ok(!valid.gate_failures.includes("CHECKPOINT_COVERAGE_GAP"));
  const invalid = summarize([first, { ...second, sampled_at: "not-a-date" }]);
  assert.equal(invalid.checkpoint_coverage.invalid_timestamps, 1);
  assert.ok(invalid.gate_failures.includes("CHECKPOINT_COVERAGE_GAP"));
  const reversed = summarize([second, first]);
  assert.equal(reversed.checkpoint_coverage.non_increasing_checkpoints, 1);
  assert.ok(reversed.gate_failures.includes("CHECKPOINT_COVERAGE_GAP"));
  const outside = summarize([first, { ...second, sampled_at: new Date(end + 1).toISOString() }]);
  assert.equal(outside.checkpoint_coverage.out_of_window_checkpoints, 1);
  assert.ok(outside.gate_failures.includes("CHECKPOINT_COVERAGE_GAP"));
});
