import { createHash } from "node:crypto";
import type { DigitalObserverFeedbackLabel } from "./feedback-calibration";

export const QUALITY_BENCHMARK_CONTRACT = "observer-quality-benchmark-v1" as const;
export const QUALITY_DATASET_KINDS = ["DETERMINISTIC_QA", "REVIEWED_REAL_PRODUCT", "PILOT", "SYNTHETIC"] as const;
export type QualityDatasetKind = typeof QUALITY_DATASET_KINDS[number];

export type BenchmarkDataset = {
  id: string; version: string; kind: QualityDatasetKind; tenantId: string | null; siteIds: string[];
  provenance: string; eventTypes: string[]; cameraIds: string[]; sceneScopes: string[];
  startsAt: string | null; endsAt: string | null; sampleCount: number; groundTruthStatus: "REVIEWED" | "PARTIAL" | "NONE";
  inclusionPolicy: string; exclusionPolicy: string; modelVersions: string[]; createdAt: string; reviewedAt: string | null;
  sealed: boolean;
};

export type BenchmarkExample = {
  id: string; tenantId: string | null; siteId: string; cameraId: string | null; eventType: string;
  datasetKind: QualityDatasetKind;
  observedAt: string; detectedAt?: string | null; eventAt?: string | null; incidentAt?: string | null;
  riskAt?: string | null; verificationAt?: string | null; decisionAt?: string | null; actionAt?: string | null;
  modelVersion: string; modelConfidence: number | null; verificationConfidence?: number | null; riskScore?: number | null;
  baselineMaturity?: number | null; learningCoverage?: number | null;
  label: DigitalObserverFeedbackLabel | "FALSE_NEGATIVE"; reviewState: "REVIEWED" | "CORRECTED";
  falsePositiveCategory?: "DETECTOR" | "DUPLICATE_EVENT" | "WRONG_EVENT_TYPE" | "WRONG_DIRECTION" | "FALSE_INCIDENT" | "FALSE_IDENTITY" | null;
  expectedOpportunityId?: string | null;
};

export type BenchmarkConfiguration = {
  datasetId: string; datasetVersion: string; modelVersion: string; eventTypes?: string[];
  cameraIds?: string[]; siteIds?: string[]; confidenceThreshold?: number; falseNegativeCoverageComplete: boolean;
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const ratio = (numerator: number, denominator: number) => ({ value: denominator ? numerator / denominator : null, numerator, denominator });
const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))];
};
const elapsed = (start: string | null | undefined, end: string | null | undefined) => {
  const a = start ? Date.parse(start) : Number.NaN; const b = end ? Date.parse(end) : Number.NaN;
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
};
const wilson95 = (successes: number, total: number) => {
  if (!total) return null;
  const z = 1.959963984540054; const p = successes / total; const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return { lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), method: "WILSON_95" as const };
};
const latency = (values: Array<number | null>) => {
  const measured = values.filter(finite);
  return { medianMs: percentile(measured, 0.5), p95Ms: percentile(measured, 0.95), sampleSize: measured.length };
};
function groupedQuality(samples: BenchmarkExample[], key: (sample: BenchmarkExample) => string) {
  return [...new Set(samples.map(key))].sort().map(scope => {
    const scoped = samples.filter(item => key(item) === scope);
    const tp = scoped.filter(item => ["TRUE_SECURITY_EVENT", "TRUE_EXPECTED_ACTIVITY"].includes(item.label)).length;
    const fp = scoped.filter(item => item.label === "FALSE_DETECTION").length;
    const fn = scoped.filter(item => item.label === "FALSE_NEGATIVE").length;
    return { scope, sampleSize: scoped.length, precision: ratio(tp, tp + fp), knownFalseNegatives: fn };
  });
}

export function assertBenchmarkDataset(dataset: BenchmarkDataset) {
  if (!dataset.id || !dataset.version || !QUALITY_DATASET_KINDS.includes(dataset.kind)) throw new Error("QUALITY_DATASET_INVALID");
  if (!dataset.provenance || !dataset.inclusionPolicy || !dataset.exclusionPolicy) throw new Error("QUALITY_DATASET_POLICY_REQUIRED");
  if (dataset.sampleCount < 0 || !Number.isInteger(dataset.sampleCount)) throw new Error("QUALITY_DATASET_SAMPLE_COUNT_INVALID");
  if (dataset.kind === "REVIEWED_REAL_PRODUCT" && dataset.groundTruthStatus === "NONE") throw new Error("QUALITY_REAL_DATASET_REVIEW_REQUIRED");
  return dataset;
}

function selectedExamples(examples: BenchmarkExample[], config: BenchmarkConfiguration) {
  return examples.filter((item) => (!config.eventTypes?.length || config.eventTypes.includes(item.eventType))
    && (!config.cameraIds?.length || (item.cameraId != null && config.cameraIds.includes(item.cameraId)))
    && (!config.siteIds?.length || config.siteIds.includes(item.siteId))
    && item.modelVersion === config.modelVersion);
}

export function runQualityBenchmark(dataset: BenchmarkDataset, examples: BenchmarkExample[], config: BenchmarkConfiguration) {
  assertBenchmarkDataset(dataset);
  if (dataset.id !== config.datasetId || dataset.version !== config.datasetVersion) throw new Error("QUALITY_DATASET_VERSION_MISMATCH");
  const selected = selectedExamples(examples, config);
  if (selected.some(item => item.datasetKind !== dataset.kind)) throw new Error("QUALITY_DATASET_KIND_CONTAMINATION");
  if (dataset.kind === "REVIEWED_REAL_PRODUCT" && selected.some(item => !["REVIEWED", "CORRECTED"].includes(item.reviewState))) throw new Error("QUALITY_UNREVIEWED_REAL_SAMPLE");
  const positives = selected.filter(item => ["TRUE_SECURITY_EVENT", "TRUE_EXPECTED_ACTIVITY"].includes(item.label));
  const detectorFalsePositives = selected.filter(item => item.label === "FALSE_DETECTION");
  const falsePositives = selected.filter(item => ["FALSE_DETECTION", "FALSE_CORRELATION", "FALSE_SPATIAL_EVENT"].includes(item.label));
  const falseNegatives = selected.filter(item => item.label === "FALSE_NEGATIVE");
  const precision = ratio(positives.length, positives.length + detectorFalsePositives.length);
  const recall = config.falseNegativeCoverageComplete
    ? { ...ratio(positives.length, positives.length + falseNegatives.length), measurable: true as const, reason: null }
    : { value: null, numerator: positives.length, denominator: 0, measurable: false as const, reason: "FALSE_NEGATIVE_GROUND_TRUTH_INCOMPLETE" };
  const stages = {
    observationToDetection: latency(selected.map(item => elapsed(item.observedAt, item.detectedAt))),
    detectionToEvent: latency(selected.map(item => elapsed(item.detectedAt, item.eventAt))),
    eventToIncident: latency(selected.map(item => elapsed(item.eventAt, item.incidentAt))),
    incidentToRisk: latency(selected.map(item => elapsed(item.incidentAt, item.riskAt))),
    riskToVerification: latency(selected.map(item => elapsed(item.riskAt, item.verificationAt))),
    verificationToDecision: latency(selected.map(item => elapsed(item.verificationAt, item.decisionAt))),
    decisionToAction: latency(selected.map(item => elapsed(item.decisionAt, item.actionAt)))
  };
  const calibrationSamples = selected.filter(item => finite(item.modelConfidence) && item.label !== "FALSE_NEGATIVE");
  const bins = Array.from({ length: 10 }, (_, index) => {
    const lower = index / 10; const upper = (index + 1) / 10;
    const items = calibrationSamples.filter(item => item.modelConfidence! >= lower && (index === 9 ? item.modelConfidence! <= upper : item.modelConfidence! < upper));
    const correct = items.filter(item => ["TRUE_SECURITY_EVENT", "TRUE_EXPECTED_ACTIVITY"].includes(item.label)).length;
    return { lower, upper, sampleSize: items.length, averageConfidence: items.length ? items.reduce((sum, item) => sum + item.modelConfidence!, 0) / items.length : null, observedAccuracy: items.length ? correct / items.length : null };
  });
  const ece = calibrationSamples.length ? bins.reduce((sum, bin) => sum + (bin.sampleSize / calibrationSamples.length) * Math.abs((bin.averageConfidence ?? 0) - (bin.observedAccuracy ?? 0)), 0) : null;
  const runIdentity = JSON.stringify({ contract: QUALITY_BENCHMARK_CONTRACT, datasetId: dataset.id, datasetVersion: dataset.version, modelVersion: config.modelVersion, eventTypes: [...(config.eventTypes ?? [])].sort(), cameraIds: [...(config.cameraIds ?? [])].sort(), siteIds: [...(config.siteIds ?? [])].sort(), confidenceThreshold: config.confidenceThreshold ?? null, falseNegativeCoverageComplete: config.falseNegativeCoverageComplete, exampleIds: selected.map(item => item.id).sort() });
  const runId = `qbr_${createHash("sha256").update(runIdentity).digest("hex").slice(0, 24)}`;
  const coverage = { samples: selected.length, cameras: new Set(selected.map(item => item.cameraId).filter(Boolean)).size, sites: new Set(selected.map(item => item.siteId)).size, eventTypes: [...new Set(selected.map(item => item.eventType))].sort(), startsAt: selected.map(item => item.observedAt).sort()[0] ?? null, endsAt: selected.map(item => item.observedAt).sort().at(-1) ?? null };
  return {
    contract: QUALITY_BENCHMARK_CONTRACT, runId, dataset: { id: dataset.id, version: dataset.version, kind: dataset.kind }, modelVersion: config.modelVersion,
    coverage, groundTruth: { reviewed: selected.length, eligible: null, unreviewed: null, correctedOrDisputed: selected.filter(item => item.reviewState === "CORRECTED").length, reviewRate: null, reviewCoverageReason: "ELIGIBLE_EVENT_POPULATION_NOT_BOUND_TO_DATASET", falseNegativeCoverageComplete: config.falseNegativeCoverageComplete },
    precision: { ...precision, confidenceInterval95: precision.value == null ? null : wilson95(precision.numerator, precision.denominator) }, recall,
    falsePositives: { count: falsePositives.length, categories: Object.fromEntries(falsePositives.map(item => item.falsePositiveCategory ?? "UNCLASSIFIED").map(category => [category, falsePositives.filter(item => (item.falsePositiveCategory ?? "UNCLASSIFIED") === category).length])) },
    falseNegatives: { count: config.falseNegativeCoverageComplete ? falseNegatives.length : null, measurable: config.falseNegativeCoverageComplete },
    latency: stages,
    calibration: { measurable: calibrationSamples.length >= 20, sampleSize: calibrationSamples.length, expectedCalibrationError: calibrationSamples.length >= 20 ? ece : null, reason: calibrationSamples.length >= 20 ? null : "INSUFFICIENT_SAMPLE", bins },
    breakdowns: { byEventType: groupedQuality(selected, item => item.eventType), byCamera: groupedQuality(selected, item => item.cameraId ?? "NO_CAMERA"), bySite: groupedQuality(selected, item => item.siteId) },
    limitations: [!config.falseNegativeCoverageComplete ? "Recall is not measurable because expected-but-missing events are not comprehensively reviewed." : null, selected.length < 30 ? "Small reviewed sample; rates are not representative Product-wide quality." : null].filter(Boolean)
  };
}

export function formatBenchmarkReport(run: ReturnType<typeof runQualityBenchmark>) {
  const rate = (value: number | null) => value == null ? "NOT MEASURABLE" : `${(value * 100).toFixed(2)}%`;
  return [
    `# Digital Observer Quality Benchmark ${run.runId}`,
    "",
    `- Dataset: ${run.dataset.id} / ${run.dataset.version} (${run.dataset.kind})`,
    `- Model: ${run.modelVersion}`,
    `- Reviewed sample size: ${run.coverage.samples}`,
    `- Coverage: ${run.coverage.cameras} camera(s), ${run.coverage.sites} Site(s), ${run.coverage.eventTypes.join(", ") || "no event type"}`,
    `- Precision: ${rate(run.precision.value)} (${run.precision.numerator}/${run.precision.denominator})`,
    `- Recall: ${run.recall.measurable ? `${rate(run.recall.value)} (${run.recall.numerator}/${run.recall.denominator})` : `NOT MEASURABLE — ${run.recall.reason}`}`,
    `- False positives: ${run.falsePositives.count}`,
    `- False negatives: ${run.falseNegatives.measurable ? run.falseNegatives.count : "NOT MEASURABLE"}`,
    `- Observation→detection latency: median ${run.latency.observationToDetection.medianMs ?? "NOT MEASURED"} ms; p95 ${run.latency.observationToDetection.p95Ms ?? "NOT MEASURED"} ms; n=${run.latency.observationToDetection.sampleSize}`,
    `- Confidence calibration: ${run.calibration.measurable ? `ECE ${run.calibration.expectedCalibrationError}` : `INSUFFICIENT SAMPLE (n=${run.calibration.sampleSize})`}`,
    "",
    "## Limitations",
    "",
    ...run.limitations.map(item => `- ${item}`),
    "",
    "This engineering report is evidence-scoped and is not a marketing accuracy claim."
  ].join("\n");
}

export function analyzeThresholds(examples: BenchmarkExample[], thresholds: number[]) {
  return thresholds.map(threshold => {
    const eligible = examples.filter(item => finite(item.modelConfidence));
    const retained = eligible.filter(item => item.modelConfidence! >= threshold);
    const tp = retained.filter(item => ["TRUE_SECURITY_EVENT", "TRUE_EXPECTED_ACTIVITY"].includes(item.label)).length;
    const fp = retained.filter(item => ["FALSE_DETECTION", "FALSE_CORRELATION", "FALSE_SPATIAL_EVENT"].includes(item.label)).length;
    return { threshold, ...ratio(tp, tp + fp), retained: retained.length, recommendationOnly: true, productionMutationAllowed: false };
  });
}

export function compareBenchmarkRuns(current: ReturnType<typeof runQualityBenchmark>, candidate: ReturnType<typeof runQualityBenchmark>) {
  if (current.dataset.id !== candidate.dataset.id || current.dataset.version !== candidate.dataset.version) throw new Error("QUALITY_MODEL_COMPARISON_DATASET_MISMATCH");
  return { dataset: current.dataset, currentModel: current.modelVersion, candidateModel: candidate.modelVersion, precisionDelta: current.precision.value == null || candidate.precision.value == null ? null : candidate.precision.value - current.precision.value, recallDelta: current.recall.value == null || candidate.recall.value == null ? null : candidate.recall.value - current.recall.value, humanApprovalRequired: true, autoPromotionAllowed: false };
}

export function evaluateQualityGates(comparison: ReturnType<typeof compareBenchmarkRuns>, gates: { minimumPrecisionDelta?: number; minimumRecallDelta?: number }) {
  const failures: string[] = [];
  if (gates.minimumPrecisionDelta != null && (comparison.precisionDelta == null || comparison.precisionDelta < gates.minimumPrecisionDelta)) failures.push("PRECISION_GATE_FAILED_OR_UNMEASURABLE");
  if (gates.minimumRecallDelta != null && (comparison.recallDelta == null || comparison.recallDelta < gates.minimumRecallDelta)) failures.push("RECALL_GATE_FAILED_OR_UNMEASURABLE");
  return { passed: failures.length === 0, failures, humanApprovalRequired: true, autoPromotionAllowed: false };
}
