import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import ts from "typescript";
import { createPreprocessingEngine, normalizePreprocessingSignal, PREPROCESSING_CONTRACT } from "../../services/video-gateway/preprocessing-policy.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const url = new URL(`${specifier}.ts`, context.parentURL); if (existsSync(url)) return { url: url.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const { runQualityBenchmark } = await import("../../lib/domain/digital-observer/quality-benchmark.ts");
const { comparePreprocessingQuality } = await import("../../lib/domain/digital-observer/preprocessing-quality.ts");
const { aggregatePreprocessingCapabilities } = await import("../../lib/domain/digital-observer/connection-intelligence.ts");
const siteId = "00000000-0000-4000-8000-000000000029", sourceId = "00000000-0000-4000-8000-000000000129";
let clock = Date.parse("2026-09-10T10:00:00.000Z");
const camera = { camera_id: sourceId, site_id: siteId, channel_assignment: "ASSIGNED", physical_camera_attached: true };
const signal = index => ({ signal_id: `native-signal-${index}`, site_id: siteId, source_id: sourceId, vendor: "verified-fixture",
  type: "NATIVE_MOTION", observed_at: new Date(clock).toISOString(), confidence: 0.8, trust: "INTEGRATION_TESTED" });

const normalized = normalizePreprocessingSignal(signal(1), { siteId, sourceId }, clock);
assert.equal(normalized.contract, PREPROCESSING_CONTRACT);
assert.equal(normalized.verification_status, "CANDIDATE_ONLY", "vendor signal must never become canonical truth");
assert.throws(() => normalizePreprocessingSignal({ ...signal(1), site_id: "00000000-0000-4000-8000-000000000999" }, { siteId, sourceId }, clock), /SCOPE_DENIED/);

const engine = createPreprocessingEngine({ now: () => clock, motionThreshold: 0.1, coalesceWindowMs: 2_000, maxQuietIntervalMs: 10_000 });
const empty = engine.evaluate({ camera: { ...camera, channel_assignment: "CHANNEL_EMPTY", physical_camera_attached: false }, policy: "ADAPTIVE" });
assert.equal(empty.decision, "SKIP_EMPTY");
assert.equal(engine.snapshot().frames_available, 0, "empty channel creates zero AI denominator/work");
const first = engine.evaluate({ camera, policy: "ADAPTIVE", signal: signal(1), health: { source: "ONLINE", frame_fresh: true } });
assert.equal(first.request_ai, true);
const duplicate = engine.evaluate({ camera, policy: "ADAPTIVE", signal: signal(1), health: { source: "ONLINE", frame_fresh: true } });
assert.equal(duplicate.decision, "SUPPRESS_DUPLICATE");
clock += 1_000;
const coalesced = engine.evaluate({ camera, policy: "ADAPTIVE", signal: signal(2), health: { source: "ONLINE", frame_fresh: true } });
assert.equal(coalesced.decision, "COALESCE");
clock += 2_000;
assert.equal(engine.evaluate({ camera, policy: "ADAPTIVE", motion_score: 0.01, observed_at: new Date(clock).toISOString(), health: { source: "ONLINE", frame_fresh: true } }).decision, "SKIP_QUIET");
clock += 10_000;
const fallback = engine.evaluate({ camera, policy: "ADAPTIVE", health: { source: "ONLINE", frame_fresh: null } });
assert.equal(fallback.reason, "PERIODIC_NEVER_BLIND_FALLBACK");
assert.equal(fallback.request_ai, true);
clock += 1_000;
const missingMetadata = engine.evaluate({ camera, policy: "ADAPTIVE", metadata_available: false, health: { source: "ONLINE", frame_fresh: null } });
assert.equal(missingMetadata.reason, "SIGNAL_UNAVAILABLE_FALLBACK");
assert.equal(missingMetadata.request_ai, true, "missing cheap metadata must increase work rather than make monitoring blind");
assert.equal(engine.evaluate({ camera, policy: "ADAPTIVE", active_watch_rule: true, health: { source: "ONLINE", frame_fresh: true } }).reason, "WATCH_RULE_PRIORITY");
assert.equal(engine.evaluate({ camera, policy: "ADAPTIVE", health: { source: "OFFLINE", frame_fresh: false } }).reason, "SOURCE_HEALTH_NOT_QUIET");

const dataset = { id: "push29", version: "v1", kind: "DETERMINISTIC_QA", tenantId: null, siteIds: [siteId], provenance: "deterministic fixture",
  eventTypes: ["person_detected"], cameraIds: [sourceId], sceneScopes: [], startsAt: new Date(clock).toISOString(), endsAt: new Date(clock).toISOString(),
  sampleCount: 1, groundTruthStatus: "REVIEWED", inclusionPolicy: "fixed", exclusionPolicy: "none", modelVersions: ["model-a"], createdAt: new Date(clock).toISOString(), reviewedAt: new Date(clock).toISOString(), sealed: true };
const examples = [{ id: "sample-1", tenantId: null, siteId, cameraId: sourceId, eventType: "person_detected", datasetKind: "DETERMINISTIC_QA",
  observedAt: new Date(clock).toISOString(), modelVersion: "model-a", modelConfidence: 0.9, verificationConfidence: null, riskScore: null,
  label: "TRUE_EXPECTED_ACTIVITY", reviewState: "REVIEWED", falsePositiveCategory: null }];
const baselineQuality = runQualityBenchmark(dataset, examples, { datasetId: "push29", datasetVersion: "v1", modelVersion: "model-a", falseNegativeCoverageComplete: false });
const optimizedQuality = runQualityBenchmark(dataset, examples, { datasetId: "push29", datasetVersion: "v1", modelVersion: "model-a", falseNegativeCoverageComplete: false });
const comparison = comparePreprocessingQuality({ baselineWorkload: { mode: "FIXED_BASELINE", framesAvailable: 10, framesCheaplyEvaluated: 0, candidatesProduced: 10, expensiveAiJobsRequested: 10, canonicalEventsProduced: 1 },
  optimizedWorkload: { mode: "PREPROCESSING_ENABLED", framesAvailable: 10, framesCheaplyEvaluated: 10, candidatesProduced: 4, expensiveAiJobsRequested: 4, canonicalEventsProduced: 1 },
  baselineQuality, optimizedQuality, approvedGate: { minimumPrecisionDelta: 0 } });
assert.equal(comparison.aiJobsAvoided, 6); assert.equal(comparison.aiWorkReduction, 0.6);
assert.equal(comparison.recallDelta, null); assert.equal(comparison.humanApprovalRequired, true); assert.equal(comparison.productionThresholdMutationAllowed, false);

const intelligence = aggregatePreprocessingCapabilities([{ observationId: "00000000-0000-4000-8000-000000000229", siteId, sourceId, family: "generic-recorder",
  signalType: "LOCAL_FRAME_DIFF", technicalCapability: "INTEGRATION_TESTED", digitalObserverCoverage: "IMPLEMENTED", outcome: "RELIABLE", firmware: null,
  observedAt: new Date(clock).toISOString(), provenance: "CONTROLLED_TEST" }]);
assert.equal(intelligence.length, 1); assert.equal("siteId" in intelligence[0], false); assert.equal("sourceId" in intelligence[0], false);

const journal = readFileSync(new URL("../../services/video-gateway/journal-loop.mjs", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../../app/api/video-gateway/event-manifest/route.ts", import.meta.url), "utf8");
const connection = readFileSync(new URL("../../lib/domain/digital-observer/camera-connection-layer.ts", import.meta.url), "utf8");
const sampleStage = journal.indexOf("let activity = null");
const activityRequest = journal.indexOf("/activity`)", sampleStage);
const queueRequest = journal.indexOf("aiQueue.enqueue", sampleStage);
const workerDetectionRequest = journal.indexOf("/detections`)");
assert.ok(sampleStage >= 0 && activityRequest >= sampleStage && queueRequest > activityRequest && workerDetectionRequest >= 0,
  "cheap activity evaluation must precede durable expensive-inference scheduling");
for (const token of ["preprocessing.evaluate", "preprocessing.recordCanonicalEvents", "tracker.observe"]) assert.ok(journal.includes(token));
for (const token of ["active_watch_rule", "critical_policy", "CHANNEL_EMPTY", "native_events_are_candidates_only", "HUMAN_APPROVAL_REQUIRED", "preprocessing_quality_gate_approved"]) assert.ok(manifest.includes(token));
for (const token of ["NATIVE_MOTION_EVENTS", "NATIVE_PERSON_EVENTS", "NATIVE_VEHICLE_EVENTS", "SCENE_CHANGE_EVENTS", "LOCAL_FRAME_DIFF"]) assert.ok(connection.includes(token));

console.log(JSON.stringify({ status: "PASS", native_signal_truth: "CANDIDATE_ONLY", empty_channel_ai_work: 0,
  deterministic_baseline_jobs: 10, deterministic_optimized_jobs: 4, deterministic_jobs_avoided: 6, deterministic_reduction: 0.6,
  recall: "NOT_MEASURABLE", fallback: "VERIFIED", watch_rule_priority: "VERIFIED", canonical_event_pipeline: "PRESERVED" }));
