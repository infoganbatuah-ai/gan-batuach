import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const { runQualityBenchmark, analyzeThresholds, compareBenchmarkRuns, evaluateQualityGates, formatBenchmarkReport } = await import("../../lib/domain/digital-observer/quality-benchmark.ts");
const { learningCameraCoverage, learningMetricMeaning } = await import("../../lib/domain/digital-observer/learning-coverage.ts");
const dataset = { id: "qa", version: "v1", kind: "DETERMINISTIC_QA", tenantId: "tenant-a", siteIds: ["site-a"], provenance: "deterministic reviewed QA", eventTypes: ["person_entered"], cameraIds: ["camera-a"], sceneScopes: ["entry"], startsAt: "2026-09-10T00:00:00Z", endsAt: "2026-09-10T00:01:00Z", sampleCount: 3, groundTruthStatus: "REVIEWED", inclusionPolicy: "reviewed fixtures", exclusionPolicy: "all other records", modelVersions: ["model-a", "model-b"], createdAt: "2026-09-10T00:00:00Z", reviewedAt: "2026-09-10T00:02:00Z", sealed: true };
const example = (id, label, confidence, extra = {}) => ({ id, tenantId: "tenant-a", siteId: "site-a", cameraId: "camera-a", eventType: "person_entered", datasetKind: "DETERMINISTIC_QA", observedAt: "2026-09-10T00:00:00Z", detectedAt: "2026-09-10T00:00:00.100Z", eventAt: "2026-09-10T00:00:00.300Z", incidentAt: "2026-09-10T00:00:00.600Z", modelVersion: "model-a", modelConfidence: confidence, label, reviewState: "REVIEWED", ...extra });
const examples = [example("tp-1", "TRUE_EXPECTED_ACTIVITY", .9), example("tp-2", "TRUE_SECURITY_EVENT", .8), example("fp-1", "FALSE_DETECTION", .7, { falsePositiveCategory: "DETECTOR" })];
const run = runQualityBenchmark(dataset, examples, { datasetId: "qa", datasetVersion: "v1", modelVersion: "model-a", falseNegativeCoverageComplete: false });
assert.equal(run.precision.numerator, 2); assert.equal(run.precision.denominator, 3); assert.equal(run.recall.measurable, false); assert.equal(run.falseNegatives.count, null);
assert.equal(run.latency.observationToDetection.medianMs, 100); assert.equal(run.latency.observationToDetection.p95Ms, 100); assert.equal(run.latency.observationToDetection.sampleSize, 3);
assert.equal(run.calibration.measurable, false); assert.equal(run.calibration.expectedCalibrationError, null);
assert.equal(run.groundTruth.reviewRate, null); assert.equal(run.breakdowns.byCamera[0].sampleSize, 3);
const repeated = runQualityBenchmark(dataset, [...examples].reverse(), { datasetId: "qa", datasetVersion: "v1", modelVersion: "model-a", falseNegativeCoverageComplete: false });
assert.equal(run.runId, repeated.runId, "run identity must be deterministic independent of row order");
const withMiss = runQualityBenchmark(dataset, [...examples, example("fn-1", "FALSE_NEGATIVE", null)], { datasetId: "qa", datasetVersion: "v1", modelVersion: "model-a", falseNegativeCoverageComplete: true });
assert.equal(withMiss.recall.numerator, 2); assert.equal(withMiss.recall.denominator, 3);
assert.throws(() => runQualityBenchmark(dataset, [example("synthetic", "TRUE_EXPECTED_ACTIVITY", .8, { datasetKind: "SYNTHETIC" })], { datasetId: "qa", datasetVersion: "v1", modelVersion: "model-a", falseNegativeCoverageComplete: false }), /CONTAMINATION/);
assert.equal(analyzeThresholds(examples, [.5])[0].productionMutationAllowed, false);
const modelB = runQualityBenchmark({ ...dataset, modelVersions: ["model-b"] }, examples.map(item => ({ ...item, modelVersion: "model-b" })), { datasetId: "qa", datasetVersion: "v1", modelVersion: "model-b", falseNegativeCoverageComplete: false });
const comparison = compareBenchmarkRuns(run, modelB); assert.equal(comparison.autoPromotionAllowed, false);
assert.equal(evaluateQualityGates(comparison, { minimumRecallDelta: 0 }).passed, false, "unmeasurable recall must fail a configured recall gate closed");
assert.match(formatBenchmarkReport(run), /NOT MEASURABLE/);

const cameras = [
  ...Array.from({ length: 10 }, (_, index) => ({ id: `dvr-${index}`, metadata: { channel_assignment: "ASSIGNED", physical_camera_attached: true } })),
  ...Array.from({ length: 6 }, (_, index) => ({ id: `empty-${index}`, metadata: { channel_assignment: "CHANNEL_EMPTY", physical_camera_attached: false } })),
  { id: "tapo", metadata: { channel_assignment: "ASSIGNED", physical_camera_attached: true } }
];
const coverage = learningCameraCoverage(cameras, [{ baseline_type: "normal_camera_activity", baseline_value: { camera_baselines: { tapo: { samples: 1000 } }, sample_count: 500 } }]);
assert.equal(coverage.expectedCameraCount, 11); assert.equal(coverage.sampledCameraCount, 1); assert.equal(coverage.coverage, 1 / 11);
assert.match(learningMetricMeaning({ baseline_type: "normal_camera_activity", baseline_value: { sample_count: 10 } }).explanation, /samples\/288/);
assert.equal(learningMetricMeaning({ baseline_type: "normal_zone_usage", baseline_value: {} }).measurable, false);

for (const [path, needles] of Object.entries({
  "app/api/digital-observer/admin/quality/route.ts": ["hasObserverAdminClaim", "private, no-store", "loadCurrentQualityBenchmark", "formatBenchmarkReport"],
  "app/digital-observer/admin/quality/page.tsx": ["Benchmark ניתן לשחזור", "עדיין לא ניתן למדידה", "Run ID"],
  "app/digital-observer/rules/page.tsx": ["כיסוי למידה", "מצלמות פיזיות צפויות", "learningMetricMeaning"],
  "lib/domain/digital-observer/learning-coverage.ts": ["samples/288", "אינו דיוק AI", "עדיין לא ניתן למדידה"],
  "supabase/migrations/20260910010000_digital_observer_quality_benchmark.sql": ["SEALED_BENCHMARK_DATASET_IMMUTABLE", "REVIEWED_REAL_PRODUCT", "revoke all"]
  ,"DIGITAL_OBSERVER_BENCHMARK_DATASET_CONTRACT.md": ["DETERMINISTIC_QA", "REVIEWED_REAL_PRODUCT", "Recall"]
  ,"DIGITAL_OBSERVER_QUALITY_METRIC_CATALOG.md": ["Model confidence", "NOT YET MEASURABLE", "median"]
  ,"DIGITAL_OBSERVER_MODEL_QUALITY_GATES.md": ["HUMAN APPROVAL", "Automatic model or threshold promotion is prohibited"]
  ,"DIGITAL_OBSERVER_LEARNING_COVERAGE_AUDIT.md": ["1/11", "samples/288", "NOT YET MEASURABLE"]
})) { const source = readFileSync(path, "utf8"); for (const needle of needles) assert.ok(source.includes(needle), `${path} missing ${needle}`); }

const matrix = readFileSync("DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md", "utf8");
const allowed = new Set(["DONE + REAL PROOF", "IMPLEMENTED — NEEDS REAL PROOF", "FOUNDATION", "PARTIAL", "NOT STARTED", "EXTERNAL COVERAGE GAP"]);
const capabilityRows = matrix.split("\n").filter(line => line.startsWith("| ") && allowed.has(line.split("|")[2]?.trim()));
assert.equal(capabilityRows.length, 190); assert.equal(capabilityRows.filter(line => line.split("|")[4]?.trim()).length, 190);

console.log(JSON.stringify({ status: "PASS", precision: run.precision, recall: run.recall, latency: run.latency.observationToDetection, deterministic_run_id: run.runId, synthetic_isolation: true, threshold_auto_promotion: false, home_learning_coverage: "1/11" }));
