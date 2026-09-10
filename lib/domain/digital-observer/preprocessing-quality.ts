import type { runQualityBenchmark } from "./quality-benchmark";

type BenchmarkRun = ReturnType<typeof runQualityBenchmark>;
export type PreprocessingWorkload = {
  mode: "FIXED_BASELINE" | "PREPROCESSING_ENABLED";
  framesAvailable: number;
  framesCheaplyEvaluated: number;
  candidatesProduced: number;
  expensiveAiJobsRequested: number;
  canonicalEventsProduced: number;
};

function validWorkload(input: PreprocessingWorkload) {
  const values = [input.framesAvailable, input.framesCheaplyEvaluated, input.candidatesProduced, input.expensiveAiJobsRequested, input.canonicalEventsProduced];
  if (values.some(value => !Number.isSafeInteger(value) || value < 0) || input.expensiveAiJobsRequested > input.framesAvailable) {
    throw new Error("PREPROCESSING_WORKLOAD_INVALID");
  }
  return input;
}

export function comparePreprocessingQuality(input: {
  baselineWorkload: PreprocessingWorkload;
  optimizedWorkload: PreprocessingWorkload;
  baselineQuality: BenchmarkRun;
  optimizedQuality: BenchmarkRun;
  approvedGate?: { minimumPrecisionDelta?: number; minimumRecallDelta?: number } | null;
}) {
  const baseline = validWorkload(input.baselineWorkload);
  const optimized = validWorkload(input.optimizedWorkload);
  if (baseline.mode !== "FIXED_BASELINE" || optimized.mode !== "PREPROCESSING_ENABLED") throw new Error("PREPROCESSING_COMPARISON_MODE_INVALID");
  if (input.baselineQuality.dataset.id !== input.optimizedQuality.dataset.id
    || input.baselineQuality.dataset.version !== input.optimizedQuality.dataset.version) throw new Error("PREPROCESSING_QUALITY_DATASET_MISMATCH");
  const avoided = Math.max(0, baseline.expensiveAiJobsRequested - optimized.expensiveAiJobsRequested);
  const denominator = baseline.expensiveAiJobsRequested;
  const precisionDelta = input.baselineQuality.precision.value == null || input.optimizedQuality.precision.value == null ? null
    : input.optimizedQuality.precision.value - input.baselineQuality.precision.value;
  const recallDelta = input.baselineQuality.recall.value == null || input.optimizedQuality.recall.value == null ? null
    : input.optimizedQuality.recall.value - input.baselineQuality.recall.value;
  const failures: string[] = [];
  if (input.approvedGate?.minimumPrecisionDelta != null && (precisionDelta == null || precisionDelta < input.approvedGate.minimumPrecisionDelta)) failures.push("PRECISION_GATE_FAILED_OR_UNMEASURABLE");
  if (input.approvedGate?.minimumRecallDelta != null && (recallDelta == null || recallDelta < input.approvedGate.minimumRecallDelta)) failures.push("RECALL_GATE_FAILED_OR_UNMEASURABLE");
  return { baseline, optimized, aiJobsAvoided: avoided, aiWorkReduction: denominator ? avoided / denominator : null,
    denominator, precisionDelta, recallDelta, qualityGateConfigured: Boolean(input.approvedGate),
    qualityGatePassed: input.approvedGate ? failures.length === 0 : null, failures,
    humanApprovalRequired: true as const, productionThresholdMutationAllowed: false as const };
}
