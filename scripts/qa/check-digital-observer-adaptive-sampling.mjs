import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createAdaptiveSamplingScheduler, ADAPTIVE_SAMPLING_CONTRACT } from "../../services/video-gateway/adaptive-sampling-scheduler.mjs";
import { AI_JOB_CONTRACT } from "../../services/video-gateway/ai-job-contract.mjs";

let clock = Date.parse("2026-09-10T12:00:00.000Z");
const camera = (id, extra = {}) => ({ camera_id: id, site_id: "site-30", status: "ONLINE", channel_assignment: "ASSIGNED", physical_camera_attached: true, ...extra });
const decision = (plan, id) => plan.decisions.find(item => item.camera_id === id);

const scheduler = createAdaptiveSamplingScheduler({ now: () => clock, normalIntervalMs: 1_000, highIntervalMs: 500,
  criticalIntervalMs: 250, neverBlindFloorMs: 8_000, learningIntervalMs: 2_000 });
let quiet = decision(scheduler.plan([camera("quiet")]), "quiet");
assert.equal(quiet.request_sample, true); assert.equal(quiet.reason, "QUIET_SCENE_DECAY");
clock += 1_000; quiet = decision(scheduler.plan([camera("quiet")]), "quiet");
assert.equal(quiet.request_sample, false, "quiet sampling must decay gradually");
clock += 1_000; assert.equal(decision(scheduler.plan([camera("quiet")]), "quiet").request_sample, true);
clock += 4_000; assert.equal(decision(scheduler.plan([camera("quiet")]), "quiet").request_sample, true);
clock += 8_000; quiet = decision(scheduler.plan([camera("quiet")]), "quiet");
assert.equal(quiet.request_sample, true); assert.equal(quiet.priority, "LOW");
assert.equal(quiet.reason, "QUIET_SCENE_FRESHNESS_FLOOR", "quiet camera retains never-blind floor");

clock += 500;
const motion = decision(scheduler.plan([camera("motion", { candidate_activity: true })]), "motion");
assert.equal(motion.priority, "HIGH"); assert.equal(motion.reason, "PREPROCESSING_ACTIVITY");
assert.equal(motion.candidate.contract, "observer-ai-candidate-v2"); assert.equal(motion.candidate.canonical_event, false);
assert.equal(scheduler.candidateIsFresh(motion.candidate), true);
assert.equal(scheduler.candidateIsFresh({ ...motion.candidate, expires_at: new Date(clock - 1).toISOString() }), false);
clock += 1_000;
const repeatedMotion = decision(scheduler.plan([camera("motion", { candidate_activity: true })]), "motion");
assert.equal(repeatedMotion.request_sample, true); assert.equal(repeatedMotion.candidate, null);
assert.ok(scheduler.snapshot().candidates_deduplicated >= 1);
clock += 100;
assert.equal(decision(scheduler.plan([camera("watch", { active_watch_rule: true })]), "watch").reason, "ACTIVE_WATCH_RULE");
assert.equal(decision(scheduler.plan([camera("incident", { active_incident: true })]), "incident").priority, "CRITICAL");
assert.equal(decision(scheduler.plan([camera("track", { active_track: true })]), "track").purpose, "TRACKING_CONTINUITY");

const empty = decision(scheduler.plan([camera("empty", { channel_assignment: "CHANNEL_EMPTY", physical_camera_attached: false })]), "empty");
assert.equal(empty.request_sample, false); assert.equal(empty.reason, "CHANNEL_EMPTY");

const learning = decision(scheduler.plan([camera("learn", { learning_under_covered: true })], { purpose: "SITE_LEARNING" }), "learn");
assert.equal(learning.request_sample, true); assert.equal(learning.priority, "LEARNING"); assert.equal(learning.eligible_for_ai, false);

const fairness = createAdaptiveSamplingScheduler({ now: () => clock, normalIntervalMs: 500, neverBlindFloorMs: 2_000 });
const fairIds = new Set();
for (let i = 0; i < 3; i++) {
  const plan = fairness.plan([camera("busy", { candidate_activity: true }), camera("normal-a"), camera("normal-b")], { budget: 1 });
  for (const item of plan.decisions) if (item.request_sample) fairIds.add(item.camera_id);
  clock += 500;
}
assert.deepEqual([...fairIds].sort(), ["busy", "normal-a", "normal-b"], "busy camera cannot starve the Site");

const pressure = createAdaptiveSamplingScheduler({ now: () => clock, normalIntervalMs: 500, neverBlindFloorMs: 8_000 });
pressure.plan([camera("low")]); clock += 1_000;
const pressurePlan = pressure.plan([camera("critical", { active_incident: true }), camera("low")], { resourcePressure: "CRITICAL", budget: 2 });
assert.equal(decision(pressurePlan, "critical").request_sample, true);
assert.equal(decision(pressurePlan, "low").reason, "RESOURCE_PRESSURE_DEFERRED");

const recovery = decision(scheduler.plan([camera("recovered", { recovering: true })]), "recovered");
assert.equal(recovery.reason, "SOURCE_RECOVERING"); assert.equal(recovery.priority, "HIGH");

const manifest = readFileSync(new URL("../../app/api/video-gateway/event-manifest/route.ts", import.meta.url), "utf8");
const journal = readFileSync(new URL("../../services/video-gateway/journal-loop.mjs", import.meta.url), "utf8");
const runner = readFileSync(new URL("../../scripts/run-persistent-home-gateway.mjs", import.meta.url), "utf8");
for (const token of [ADAPTIVE_SAMPLING_CONTRACT, "active_incident", "learning_under_covered", "cycle_budget", "candidate_contract"]) assert.ok(manifest.includes(token));
for (const token of ["createAdaptiveSamplingScheduler", "active_track", "adaptive_sampling", "resourcePressure()", "scheduler.recordActivity", "preprocessing.evaluate", "tracker.observe"]) assert.ok(journal.includes(token));
for (const token of ["createDurableAiJobQueue", "createPortableInferenceWorker", "aiQueue.enqueue"]) assert.ok(journal.includes(token));
assert.equal(AI_JOB_CONTRACT, "observer-ai-job-v1");
assert.ok(runner.includes("/activity`")); assert.ok(!runner.slice(runner.indexOf("async function learn"), runner.indexOf("await waitForGateway")).includes("/insights`"));

const snapshot = scheduler.snapshot();
assert.equal(snapshot.contract, ADAPTIVE_SAMPLING_CONTRACT);
console.log(JSON.stringify({ status: "PASS", adaptive_scheduler: "READY", never_blind_floor: "VERIFIED", watch_rule_priority: "VERIFIED",
  incident_track_priority: "VERIFIED", fairness: "VERIFIED", resource_pressure: "VERIFIED", empty_channel_work: 0,
  learning_priority: "VERIFIED", candidate_contract: "observer-ai-candidate-v2", push31_queue: AI_JOB_CONTRACT, recall: "NOT_MEASURABLE" }));
