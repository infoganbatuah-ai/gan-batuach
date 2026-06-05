export type LearningReviewOutcome = "confirmed" | "dismissed" | "false_positive" | "escalated" | "valid_detection" | "needs_more_data";
export type LearningMaturity = "new" | "learning" | "calibrated" | "mature";

export type LearningCalibrationInput = {
  currentConfidence?: number | null;
  currentReadiness?: number | null;
  existingFeedbackCount?: number;
  reviewOutcome: LearningReviewOutcome;
};

export type LearningCalibrationResult = {
  confidenceDelta: number;
  confidenceAfter: number;
  anomalyReadinessAfter: number;
  maturityAfter: LearningMaturity;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function outcomeDelta(outcome: LearningReviewOutcome) {
  switch (outcome) {
    case "confirmed":
    case "valid_detection":
      return 0.04;
    case "escalated":
      return 0.05;
    case "needs_more_data":
      return 0.01;
    case "dismissed":
      return -0.025;
    case "false_positive":
      return -0.06;
    default:
      return 0;
  }
}

export function calculateLearningCalibration(input: LearningCalibrationInput): LearningCalibrationResult {
  const currentConfidence = clamp(Number(input.currentConfidence ?? 0.12));
  const currentReadiness = clamp(Number(input.currentReadiness ?? 0.08));
  const confidenceDelta = outcomeDelta(input.reviewOutcome);
  const confidenceAfter = clamp(currentConfidence + confidenceDelta);
  const anomalyReadinessAfter = clamp(currentReadiness + Math.max(confidenceDelta, -0.03) + 0.01);
  const feedbackCount = Number(input.existingFeedbackCount ?? 0) + 1;
  let maturityAfter: LearningMaturity = "new";
  if (feedbackCount >= 40 && confidenceAfter >= 0.72) maturityAfter = "mature";
  else if (feedbackCount >= 16 && confidenceAfter >= 0.48) maturityAfter = "calibrated";
  else if (feedbackCount >= 4 || confidenceAfter >= 0.22) maturityAfter = "learning";
  return {
    confidenceDelta,
    confidenceAfter,
    anomalyReadinessAfter,
    maturityAfter
  };
}

export const baselineLabels: Record<string, string> = {
  normal_occupancy_patterns: "דפוסי תפוסה רגילים",
  normal_movement_patterns: "דפוסי תנועה רגילים",
  normal_activity_levels: "רמות פעילות רגילות",
  normal_active_hours: "שעות פעילות רגילות",
  normal_pickup_patterns: "דפוסי איסוף רגילים",
  normal_staff_presence: "נוכחות צוות רגילה",
  normal_camera_activity: "פעילות מצלמות רגילה",
  normal_zone_usage: "שימוש רגיל באזורים"
};

export const anomalyReadinessLabels: Record<string, string> = {
  unusual_activity: "פעילות חריגה",
  unusual_absence: "היעדר פעילות חריג",
  unusual_occupancy: "תפוסה חריגה",
  unusual_movement: "תנועה חריגה",
  unusual_pickup_behavior: "איסוף חריג",
  unusual_audio_patterns: "דפוסי שמע חריגים"
};
