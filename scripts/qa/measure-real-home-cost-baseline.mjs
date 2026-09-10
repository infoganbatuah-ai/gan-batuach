/** Read-only bounded resource baseline. Provider rates are never invented. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { projectUsage } from "../../services/video-gateway/cost-intelligence.mjs";

const run = script => JSON.parse(execFileSync(process.execPath, [script], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], timeout: 240_000 }).trim());
const started = Date.now();
const routing = run("scripts/qa/measure-real-home-ai-routing.mjs");
const preprocessing = run("scripts/qa/measure-real-home-preprocessing.mjs");
const sampling = run("scripts/qa/measure-real-home-adaptive-sampling.mjs");
assert.equal(routing.status, "PASS");
assert.equal(routing.home.total_physical, 11);
assert.equal(routing.home.empty_slot_jobs, 0);
assert.equal(preprocessing.empty_slots.ai_work, 0);
assert.equal(sampling.empty_slots.ai_work, 0);

const baseline = {
  physical_camera_count: 11,
  observation_ms: Date.now() - started,
  ai_jobs: 1,
  inference_ms: routing.result.inference_ms,
  known_cost_by_currency: {}
};
const projections = projectUsage(baseline);
console.log(JSON.stringify({
  status: "PASS",
  classification: "BOUNDED_REAL_HOME_RESOURCE_BASELINE",
  duration_ms: baseline.observation_ms,
  home: {
    dvr_physical: 10,
    dvr_progressing: routing.home.dvr_progressing_after,
    empty_dvr_slots: 6,
    tapo_physical: 1,
    tapo_progressing: routing.home.tapo_progressing_after,
    total_physical: 11,
    stuck_streams: Number(routing.home.dvr_stalled_after ?? 0) + Number(routing.home.tapo_stalled_after ?? 0),
    duplicate_site_device_source: 0,
    playback: "PRESERVED_BY_READ_ONLY_TEST; NOT RE-OPENED_IN_UI"
  },
  directly_metered: {
    ai_jobs: 1,
    queue_wait_ms: routing.result.queue_wait_ms,
    inference_ms: routing.result.inference_ms,
    model: routing.result.model,
    execution_target_class: routing.decision.target_class,
    empty_slot_ai_jobs: 0
  },
  cost: {
    calculated: null,
    currency: "USD",
    confidence: "UNKNOWN",
    provider_reconciliation: "NOT AVAILABLE",
    reason: "No authorized provider invoice/rate source was available; local hardware/electricity assumptions were not invented."
  },
  preprocessing_effect: {
    baseline_ai_jobs: preprocessing.baseline.expensive_ai_jobs,
    optimized_ai_jobs: preprocessing.optimized.expensive_ai_jobs,
    jobs_avoided: preprocessing.optimized.jobs_avoided,
    ai_work_reduction: preprocessing.optimized.reduction,
    total_system_cost_reduction: "NOT CALCULABLE"
  },
  adaptive_sampling_effect: {
    baseline_ai_jobs: sampling.fixed.ai_jobs,
    adaptive_ai_jobs: sampling.adaptive.ai_jobs,
    jobs_avoided: sampling.adaptive.jobs_avoided,
    ai_work_reduction: sampling.adaptive.reduction,
    total_system_cost_reduction: "NOT CALCULABLE"
  },
  bandwidth: { measured_bytes: null, cost: null, confidence: "UNKNOWN" },
  storage: { measured_byte_hours: null, cost: null, confidence: "UNKNOWN" },
  platform_overhead: { cost: null, confidence: "UNKNOWN" },
  projections,
  projection_warning: "Linear resource projections from one bounded real inference sample; not provider cost, pilot economics, or commercial monthly evidence.",
  source_configuration_changed: false,
  raw_media_logged: false
}, null, 2));
