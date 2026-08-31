import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createPersistentLearningCycle } from "../../services/video-gateway/persistent-learning-cycle.mjs";

const channel = id => ({ camera_source_id: id, gateway_stream_id: `stream-${id}`, status: "connected", private_data: "SYNTHETIC_PRIVATE_VALUE" });
const sources = [channel("a"), channel("b"), { ...channel("offline"), status: "offline" }];
const grant = ids => ({ consentVerified: true, sourceIds: ids, expiresAt: Date.now() + 60000,
  physical_actions_allowed: false, biometric_matching_allowed: false });
const insight = (detections = [], sampled_at = new Date().toISOString(), stream_id = "stream-a") => ({
  stream_id,
  local_processing: true, no_raw_video_returned: true, private_data: "SYNTHETIC_PRIVATE_VALUE",
  insight: { motion_score: 0.1, luminance_score: 0.4, sample_frames: 2, sampled_at,
    object_detection: { status: "sampled", detections } }
});
const person = { label: "person", confidence: 0.9, face: "SYNTHETIC_PRIVATE_VALUE" };
const setup = overrides => createPersistentLearningCycle({
  authorize: async ids => grant(ids), analyze: async () => insight(),
  publishSamples: async () => ({ submitted: true }), publishEvent: async () => ({ submitted: true }),
  schedulerOptions: { timeoutMs: 20, roundBudgetMs: 100, concurrency: 2 }, ...overrides
});

let calls = 0;
for (const authorize of [
  async () => { throw new Error("SYNTHETIC_PRIVATE_VALUE"); },
  async ids => ({ ...grant(ids), consentVerified: false }),
  async ids => ({ ...grant(ids), expiresAt: Date.now() - 1 }),
  async ids => ({ ...grant(ids), expiresAt: Date.now() + 100000 }),
  async ids => ({ ...grant(ids), physical_actions_allowed: true }),
  async ids => ({ ...grant(ids), biometric_matching_allowed: true }),
  async () => grant(["another-site-source"])
]) {
  const result = await setup({ authorize, analyze: async () => { calls++; }, publishSamples: async () => { calls++; }, publishEvent: async () => { calls++; } }).run(sources);
  assert.equal(result.state, "policy_unavailable");
  assert.equal(result.attempted, 0);
  assert.equal(result.reports[0].state, "consent_unavailable");
  assert.equal(result.reports[2].state, "offline");
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
}
assert.equal(calls, 0, "No local sampling or upload without fresh scoped permission");
assert.equal((await setup({ authorize: async () => { throw new Error("must not authorize empty sources"); } }).run([])).state, "no_mapped_sources");

// A failed model, stale result or unavailable media must never be counted as no-event.
for (const data of [
  { state: "no_media" },
  { ...insight(), stream_id: "different-source" },
  { ...insight(), no_raw_video_returned: false },
  { ...insight(), insight: { ...insight().insight, object_detection: { status: "unavailable", detections: [] } } },
  { ...insight(), insight: { ...insight().insight, sample_frames: 0 } },
  { ...insight(), insight: { ...insight().insight, motion_score: "0.1" } },
  insight([{ label: "person", confidence: "invalid" }]),
  insight([], new Date(Date.now() - 60000).toISOString()),
  insight([], new Date(Date.now() + 60000).toISOString())
]) {
  const result = await setup({ analyze: async () => data, publishSamples: async () => { calls++; } }).run([sources[0]]);
  assert.equal(result.reports[0].state, data.state === "no_media" ? "no_media" : "processing_failed");
  assert.equal(result.reports[0].last_analyzed_at, null);
}
assert.equal(calls, 0);

let published = [], events = [];
const cycle = setup({
  analyze: async source => {
    if (source.camera_source_id === "a") throw new Error("SYNTHETIC_PRIVATE_VALUE");
    assert.notEqual(source.status, "offline");
    return insight([person], new Date().toISOString(), source.gateway_stream_id);
  },
  publishSamples: async samples => { published.push(samples); return { submitted: true }; },
  publishEvent: async (source, detection, signal) => { events.push({ source: source.camera_source_id, detection }); assert.equal(signal.aborted, false); return { submitted: true }; }
});
let result = await cycle.run(sources);
assert.equal(result.reports[0].state, "processing_failed");
assert.equal(result.reports[1].state, "event_detected");
assert.equal(result.reports[2].state, "offline");
assert.equal(result.events_submitted, 1);
assert.equal(result.metrics_submitted, true);
assert.equal(published[0][0].stream_id, "stream-b");
assert.deepEqual(Object.keys(published[0][0]).sort(), ["luminance_score", "motion_score", "sample_frames", "sampled_at", "stream_id"]);
assert.equal(events[0].source, "b");
assert.equal(JSON.stringify({ result, published, events }).includes("PRIVATE"), false);
await cycle.run(sources);
assert.equal(events.length, 1, "Only successful event publication starts the source/label cooldown");

let tries = 0;
const retry = setup({ analyze: async () => insight([person]),
  publishSamples: async () => { throw new Error("metrics unavailable"); },
  publishEvent: async () => ({ submitted: ++tries > 1 }) });
result = await retry.run([sources[0]]);
assert.equal(result.event_failures, 1); assert.equal(result.metrics_submitted, false);
result = await retry.run([sources[0]]);
assert.equal(result.events_submitted, 1, "Failed media upload can retry despite metrics failure");
result = await retry.run([sources[0]]);
assert.equal(result.events_submitted, 0); assert.equal(tries, 2);

let clock = Date.now(), captures = 0;
const expiredDuringUpload = setup({ now: () => clock, authorize: async ids => ({ ...grant(ids), expiresAt: clock + 100 }),
  analyze: async () => insight([person], new Date(clock).toISOString()),
  publishSamples: async () => { clock += 101; return { submitted: true }; },
  publishEvent: async () => { captures++; } });
result = await expiredDuringUpload.run([sources[0]]);
assert.equal(result.events_deferred, 1); assert.equal(captures, 0, "No capture after the authorization window");

// Single-flight covers authorization and publication, not just inference.
let approve, upload, started = 0;
const approved = new Promise(resolve => { approve = resolve; });
const uploaded = new Promise(resolve => { upload = resolve; });
let enteredUpload;
const uploadStarted = new Promise(resolve => { enteredUpload = resolve; });
const serialized = setup({ authorize: async ids => { started++; await approved; return grant(ids); },
  publishSamples: async () => { enteredUpload(); await uploaded; return { submitted: true }; } });
const running = serialized.run([sources[0]]);
assert.equal(serialized.run([sources[0]]), running);
approve(); await uploadStarted;
assert.equal(serialized.run([sources[0]]), running);
upload(); await running;
assert.equal(started, 1);

// An abort-ignoring worker keeps its slot and cannot emit late data after timeout.
let finish, jobs = 0, uploads = 0;
const stalled = setup({ schedulerOptions: { concurrency: 1, timeoutMs: 5, roundBudgetMs: 20 },
  analyze: () => { jobs++; return new Promise(resolve => { finish = resolve; }); },
  publishSamples: async () => { uploads++; } });
result = await stalled.run([sources[0]]);
assert.equal(result.reports[0].state, "processing_failed");
result = await stalled.run([sources[0]]);
assert.equal(result.reports[0].state, "deferred_budget"); assert.equal(jobs, 1);
finish(insight([person])); await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(uploads, 0);

// Integration guards inspect the runner, never execute its Keychain/DVR startup.
const runner = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
for (const required of ["createPersistentLearningCycle", 'operation: "authorize_round"', "payload.policy?.request_id !== requestId", "learningCycle.run(channels)", "AbortSignal.any"]) assert.ok(runner.includes(required), required);
assert.equal(runner.includes("Promise.all(channels.filter"), false);
console.log("PASS: pre-sampling authorization, failure/offline isolation, fresh evidence, safe payloads, media retry, whole-cycle single-flight and abort containment (synthetic only)");
