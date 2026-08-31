import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { cameraReportsLocalEventInsights } from "../../lib/domain/digital-observer/edge-ai-policy.ts";

function load(file, modules) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { assert.ok(name in modules, name); return modules[name]; } });
  return exports;
}
const { observerAnalysisRoundPolicy } = load("lib/domain/digital-observer/analysis-round-policy.ts", { "./edge-ai-policy": { cameraReportsLocalEventInsights } });
const { recordHomeActivityMetrics, sampleConsentedHomeLearning } = load("lib/domain/digital-observer/home-learning-sampler.ts", {
  "@/lib/domain/digital-observer/analysis-round-policy": { observerAnalysisRoundPolicy }
});
let now = Date.now();
const siteId = randomUUID(), gatewayId = "synthetic-gateway", a = randomUUID(), b = randomUUID(), c = randomUUID();
const camera = (id, stream, gateway = gatewayId) => ({ id, observer_site_id: siteId, status: "connected", health_status: "healthy", metadata: {
  gateway_id: gateway, gateway_stream_id: stream, private_endpoint: "SYNTHETIC_PRIVATE_VALUE",
  edge_policy: { monitoring_consent_verified: true, object_detection_enabled: true },
  edge_capability_contract: { version: 1, issued_at: new Date(now - 1000).toISOString(), gateway: { connected: true }, runtime: { available: true },
    hardware: { acceleration_available: true }, capability_test: { passed: true }, capabilities: { object_detection: true },
    models: { loaded: true, approved_inventory: [{ capability: "object_detection", loaded: true, self_test_passed: true }] } }
} });
const sample = (stream, motion = 0.2, light = 0.3, time = now) => ({ stream_id: stream, motion_score: motion, luminance_score: light, sampled_at: new Date(time).toISOString(), sample_frames: 2 });
const legacy = () => ({ id: randomUUID(), observer_site_id: siteId, baseline_type: "normal_camera_activity", updated_at: new Date(now - 1000).toISOString(),
  metadata: { local_pixel_processing: true, owner_note: "preserve" }, confidence_level: 1,
  baseline_value: { sample_count: 288, status: "baseline_ready", average_motion_score: 0.5, average_luminance_score: 0.5 } });

function database({ baseline = legacy(), sources = [camera(a, "a"), camera(b, "b"), camera(c, "c", "other-gateway")], consent = true, sourceError = false, baselineError = false, saveError = null } = {}) {
  const state = { baseline, reads: [], writes: [] };
  const db = { from(table) {
    const q = { table, filters: [], value: null, action: null }; state.reads.push(q);
    const matches = row => q.filters.every(([key, value]) => row[key] === value);
    function result() {
      if (q.value) {
        assert.equal(table, "site_behavior_baselines", "Metrics may not write signals, consent, profiles, camera linkage or AI runtime state");
        state.writes.push(q);
        if (saveError) return { data: null, error: { code: saveError, message: "SYNTHETIC_PRIVATE_VALUE" } };
        if (q.action === "update" && (!state.baseline || !matches(state.baseline))) return { data: null, error: null };
        if (q.action === "insert" && state.baseline) return { data: null, error: { code: "23505" } };
        state.baseline = { ...q.value, id: state.baseline?.id ?? randomUUID() };
        return { data: { id: state.baseline.id }, error: null };
      }
      if (table === "observer_sites") return { data: { id: siteId, active: true, monitoring_enabled: consent, metadata: { observer_monitoring_consent: consent } }, error: null };
      if (table === "observer_monitoring_schedules") return { data: { observer_site_id: siteId, schedule_mode: "event_only", status: "draft" }, error: null };
      if (table === "digital_observer_camera_sources") return { data: sources, error: sourceError ? {} : null };
      if (table === "site_behavior_baselines") return { data: structuredClone(state.baseline), error: baselineError ? {} : null };
      throw new Error(`Unexpected table: ${table}`);
    }
    const chain = { select: () => chain, eq: (key, value) => { q.filters.push([key, value]); return chain; }, limit: () => chain,
      update: value => { q.value = value; q.action = "update"; return chain; }, insert: value => { q.value = value; q.action = "insert"; return chain; },
      single: async () => result(), maybeSingle: async () => result(), then: done => Promise.resolve(result()).then(done) };
    return chain;
  } };
  return { db, state };
}
let fixture = database();
const ingest = (f, samples, gateway = gatewayId) => recordHomeActivityMetrics(f.db, siteId, samples, gateway, now);
let result = await ingest(fixture, [sample("a", 0.1, 0.2), sample("b", 0.9, 0.8)]);
assert.equal(result.sampled, 2); assert.equal(result.confidence, 0); assert.equal(result.calibration_verified, false);
let saved = fixture.state.baseline;
assert.equal(saved.baseline_value.source_metrics[a].average_motion_score, 0.1);
assert.equal(saved.baseline_value.source_metrics[b].average_motion_score, 0.9);
assert.equal(saved.baseline_value.sample_count, 2, "Legacy aggregate count must not be assigned to a camera");
assert.equal(saved.baseline_value.legacy_unattributed_metrics.sample_count, 288);
assert.equal(saved.metadata.owner_note, "preserve");
assert.equal(saved.anomaly_readiness_score, 0); assert.equal(saved.last_calibrated_at, null);
assert.equal(JSON.stringify({ result, saved }).includes("SYNTHETIC_PRIVATE_VALUE"), false);
assert.ok(fixture.state.reads.every(q => q.value || q.filters.some(([key, value]) => ["id", "observer_site_id"].includes(key) && value === siteId)));
now += 1000;
await ingest(fixture, [sample("a", 0.3, 0.4)]);
assert.equal(fixture.state.baseline.baseline_value.source_metrics[a].average_motion_score, 0.2);
assert.equal(fixture.state.baseline.baseline_value.source_metrics[b].sample_count, 1);
const writes = fixture.state.writes.length;
result = await ingest(fixture, [sample("a", 0.3, 0.4)]);
assert.equal(result.sampled, 0); assert.equal(result.skipped, 1); assert.equal(fixture.state.writes.length, writes);
assert.ok(fixture.state.writes.filter(q => q.action === "update").every(q => q.filters.some(([key]) => key === "updated_at")));

for (const options of [
  { consent: false }, { sourceError: true }, { baselineError: true },
  { sources: [camera(a, "a", "another-gateway")] },
  { sources: [{ ...camera(a, "a"), observer_site_id: randomUUID() }] },
  { sources: [camera(a, "a"), camera(b, "a")] },
  { sources: [{ ...camera(a, "a"), metadata: {} }] },
  { baseline: { ...legacy(), metadata: { human_calibrated: true } } }
]) {
  const f = database(options); await assert.rejects(ingest(f, [sample("a")])); assert.equal(f.state.writes.length, 0);
}
for (const samples of [[sample("unknown")], [sample("a"), sample("c")], [sample("a"), sample("a")], [sample("a", 0.2, 0.3, now + 1)],
  [sample("a", 0.2, 0.3, now - 300001)], [{ ...sample("a"), motion_score: "0.5" }], [{ ...sample("a"), sample_frames: 0 }]]) {
  const f = database(); await assert.rejects(ingest(f, samples)); assert.equal(f.state.writes.length, 0);
}
const noIdentity = database(); await assert.rejects(ingest(noIdentity, [sample("a")], "")); assert.equal(noIdentity.state.writes.length, 0);
const isolated = database({ sources: [camera(a, "a"), { ...camera(b, "b"), status: "offline" }] });
result = await ingest(isolated, [sample("a"), sample("b")]);
assert.equal(result.sampled, 1); assert.equal(result.skipped, 1);
assert.equal(isolated.state.baseline.baseline_value.source_metrics[b], undefined);
const offlineOnly = database({ sources: [{ ...camera(a, "a"), status: "offline" }] });
assert.equal((await ingest(offlineOnly, [sample("a")])).sampled, 0); assert.equal(offlineOnly.state.writes.length, 0);

// Thresholds are sample counters only, never calibration or anomaly readiness.
saved = structuredClone(fixture.state.baseline);
saved.baseline_value.source_metrics[a].sample_count = 287;
now += 1000;
const threshold = database({ baseline: saved });
await ingest(threshold, [sample("a", 0.9, 0.9)]);
assert.equal(threshold.state.baseline.baseline_value.source_metrics[a].sample_count, 288);
assert.equal(threshold.state.baseline.learning_maturity, "learning");
assert.equal(threshold.state.baseline.confidence_level, 0);
assert.equal(threshold.state.baseline.anomaly_readiness_score, 0);
assert.equal(threshold.state.baseline.baseline_value.status, "collecting");

// Two authenticated Gateways cannot silently lose each other's updates.
now += 1000;
fixture = database({ baseline: structuredClone(fixture.state.baseline) });
const concurrent = await Promise.allSettled([ingest(fixture, [sample("a")]), ingest(fixture, [sample("c")], "other-gateway")]);
assert.equal(concurrent.filter(item => item.status === "fulfilled").length, 1);
assert.match(concurrent.find(item => item.status === "rejected").reason.message, /concurrently/);
await ingest(fixture, [sample("c")], "other-gateway");
assert.ok(fixture.state.baseline.baseline_value.source_metrics[a]); assert.ok(fixture.state.baseline.baseline_value.source_metrics[c]);
for (const code of ["23505", "synthetic_write_error"]) {
  const f = database({ baseline: null, saveError: code });
  await assert.rejects(ingest(f, [sample("a")]), error => !error.message.includes("PRIVATE"));
}
const fresh = database({ baseline: null }); assert.equal((await ingest(fresh, [sample("a")])).sampled, 1);
await assert.rejects(sampleConsentedHomeLearning({ from: () => assert.fail("legacy sampler must never read or contact a camera") }), /Server-initiated sampling is disabled/);

const page = readFileSync("app/digital-observer/rules/page.tsx", "utf8");
const ast = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const summary = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "baselineSummary");
assert.ok(summary);
const summaryFn = runInNewContext(ts.transpileModule(`(${summary.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText);
assert.match(summaryFn(fresh.state.baseline), /מקורות בנפרד/);
assert.match(summaryFn(legacy()), /סיכום היסטורי משולב/);
assert.match(summaryFn({ baseline_type: "normal_camera_activity", baseline_value: {} }), /טרם נשמרו/);
assert.match(summaryFn({ baseline_type: "normal_camera_activity", baseline_value: { sample_count: 288 } }), /טרם נשמרו/);
assert.ok(page.includes('metricsOnlyProfile ? "שגרה טרם אומתה"'));
assert.equal(page.includes("התקדמות למידה"), false, "Elapsed calendar time cannot be announced as learning progress");
console.log("PASS: per-source authenticated descriptive metrics, no calibration/events from counts, legacy preservation, duplicate/stale/tenant rejection, optimistic conflict handling and truthful summaries (synthetic only)");
