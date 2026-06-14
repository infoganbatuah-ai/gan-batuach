export const observerPilotSafetyRules = [
  "Shadow mode only",
  "Human review required",
  "No automatic parent notifications",
  "No automatic incidents or discipline",
  "No audio or face recognition in Gan Batuach Israel mode",
  "Raw AI and skeleton signals are parent-hidden"
];

export type ObserverPilotCounts = {
  detections: number;
  pendingReview: number;
  reviewed: number;
  falsePositive: number;
  falseNegative: number;
  uncertain: number;
  cameras: number;
  stableCameras: number;
};

export function pct(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

export function statusTone(status?: string | null): "good" | "warn" | "bad" | "default" {
  const value = String(status ?? "");
  if (["running", "completed", "calibrated", "satisfied", "test_mode", "configured", "registered", "connected", "confirmed", "correct_detection"].includes(value)) return "good";
  if (["draft", "reviewing", "collecting", "collecting_data", "needs_review", "pending_review", "detected", "uncertain", "needs_more_context", "paused"].includes(value)) return "warn";
  if (["blocked", "failed", "false_positive", "false_negative", "missed_detection", "disabled", "offline"].includes(value)) return "bad";
  return "default";
}

export function calculateObserverPilotReadiness(counts: ObserverPilotCounts) {
  const reviewedRatio = counts.detections ? counts.reviewed / counts.detections : 0;
  const falsePositiveRate = counts.reviewed ? counts.falsePositive / counts.reviewed : 0;
  const falseNegativeRate = counts.reviewed ? counts.falseNegative / counts.reviewed : 0;
  const cameraStability = counts.cameras ? counts.stableCameras / counts.cameras : 0;
  const readiness = Math.round(
    Math.min(100,
      reviewedRatio * 30 +
      Math.max(0, 1 - falsePositiveRate) * 20 +
      Math.max(0, 1 - falseNegativeRate) * 20 +
      cameraStability * 20 +
      (counts.falseNegative >= 0 ? 10 : 0)
    )
  );
  const calibration = Math.round(Math.min(100, reviewedRatio * 40 + Math.max(0, 1 - falsePositiveRate - falseNegativeRate) * 40 + cameraStability * 20));
  return {
    readiness,
    calibration,
    reviewedRatio,
    falsePositiveRate,
    falseNegativeRate,
    cameraStability,
    productionBlocked: readiness < 85 || counts.reviewed < 100 || falsePositiveRate > 0.15 || falseNegativeRate > 0.1,
    blockerReason: counts.reviewed < 100
      ? "נדרשים יותר אירועים שנבדקו ידנית"
      : readiness < 85
        ? "ציון הפיילוט עדיין לא מספיק להפעלה"
        : falsePositiveRate > 0.15
          ? "שיעור false positive גבוה מדי"
          : falseNegativeRate > 0.1
            ? "שיעור false negative דורש כיול"
            : null
  };
}
