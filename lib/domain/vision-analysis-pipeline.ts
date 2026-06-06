import { calibrateConfidenceFromReview, combineVisionConfidence, getVisionProductionReadiness, getVisionProvider, type VisionDetection, type VisionFrameAnalysisInput } from "@/lib/domain/vision-provider";

export type VisionPipelineSummary = {
  providerStatus: ReturnType<typeof getVisionProductionReadiness>;
  detectionVolume: number;
  falsePositiveRate: number;
  averageLatencyMs: number;
  averageProcessingTimeMs: number;
  averageConfidence: number;
  healthyProviders: number;
  degradedProviders: number;
};

export async function runMockVisionFrameAnalysis(input: VisionFrameAnalysisInput) {
  const provider = getVisionProvider(input.metadata?.provider ? String(input.metadata.provider) : undefined);
  const result = await provider.analyzeFrame(input);
  return {
    ...result,
    detections: result.detections.map((detection) => ({
      ...detection,
      combinedConfidence: combineVisionConfidence({
        model: detection.modelConfidence,
        learning: Number(input.learningContext?.confidence_level ?? 0),
        correlation: Number(input.correlationContext?.confidence ?? 0)
      })
    }))
  };
}

export function buildVisionDiagnosticsSummary(diagnostics: any[] = [], detectionResults: any[] = [], calibrationFeedback: any[] = []): VisionPipelineSummary {
  const readiness = getVisionProductionReadiness();
  const latencyValues = diagnostics.map((item) => Number(item.average_latency_ms ?? item.latency_ms ?? 0)).filter((value) => value > 0);
  const processingValues = diagnostics.map((item) => Number(item.average_processing_time_ms ?? item.processing_time_ms ?? 0)).filter((value) => value > 0);
  const confidenceValues = detectionResults.map((item) => Number(item.combined_confidence ?? item.model_confidence ?? 0)).filter((value) => value > 0);
  const falsePositiveCount = calibrationFeedback.filter((item) => item.review_outcome === "false_positive").length;
  const reviewedCount = calibrationFeedback.length;
  return {
    providerStatus: readiness,
    detectionVolume: detectionResults.length,
    falsePositiveRate: reviewedCount ? round(falsePositiveCount / reviewedCount) : 0,
    averageLatencyMs: average(latencyValues),
    averageProcessingTimeMs: average(processingValues),
    averageConfidence: average(confidenceValues),
    healthyProviders: diagnostics.filter((item) => ["healthy", "mock"].includes(String(item.model_health))).length,
    degradedProviders: diagnostics.filter((item) => ["degraded", "offline"].includes(String(item.model_health))).length
  };
}

export function buildReviewedManagerDetection(event: any, detection?: VisionDetection) {
  const baseConfidence = Number(event?.combined_confidence ?? event?.confidence_score ?? detection?.modelConfidence ?? 0);
  const calibration = calibrateConfidenceFromReview(baseConfidence, event?.review_outcome ?? event?.status);
  return {
    title: event?.title ?? detection?.title ?? "זיהוי חזותי לבדיקה",
    status: event?.status ?? "reviewing",
    confidence: calibration.confidenceAfter,
    recommendedAction: event?.recommended_action ?? detection?.recommendedAction ?? "מומלץ לבדוק ולסמן תוצאה.",
    reviewed: ["confirmed", "dismissed", "escalated"].includes(String(event?.status)) || Boolean(event?.review_outcome)
  };
}

function average(values: number[]) {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}
