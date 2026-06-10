export type InspectionTone = "good" | "warn" | "bad";

export function inspectionTone(scoreOrStatus: number | string): InspectionTone {
  if (typeof scoreOrStatus === "number") {
    if (scoreOrStatus >= 82) return "good";
    if (scoreOrStatus >= 62) return "warn";
    return "bad";
  }
  const value = scoreOrStatus.toLowerCase();
  if (["critical", "urgent", "overdue", "open_high", "bad", "failed"].includes(value)) return "bad";
  if (["high", "medium", "planned", "assigned", "in_progress", "warn"].includes(value)) return "warn";
  return "good";
}

export function clampInspectionScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildInspectionRiskScore(input: {
  incidents: number;
  complaints: number;
  unresolvedFindings: number;
  observerAlerts: number;
  overdueInspections: number;
  complianceScore?: number | null;
}) {
  const compliancePenalty = input.complianceScore == null ? 8 : Math.max(0, 80 - Number(input.complianceScore)) * 0.55;
  return clampInspectionScore(
    input.incidents * 9 +
    input.complaints * 8 +
    input.unresolvedFindings * 10 +
    input.observerAlerts * 7 +
    input.overdueInspections * 12 +
    compliancePenalty
  );
}

export function buildNationalInspectionReadiness(input: {
  totalInspections: number;
  completedInspections: number;
  overdueInspections: number;
  unresolvedFindings: number;
  activeInspectors: number;
  overloadedInspectors: number;
  urgentRecommendations: number;
}) {
  const completionRate = input.totalInspections
    ? clampInspectionScore((input.completedInspections / input.totalInspections) * 100)
    : 100;
  const overdueScore = clampInspectionScore(100 - input.overdueInspections * 9);
  const findingsScore = clampInspectionScore(100 - input.unresolvedFindings * 5);
  const workloadScore = input.activeInspectors
    ? clampInspectionScore(100 - (input.overloadedInspectors / input.activeInspectors) * 100)
    : 65;
  const observerScore = clampInspectionScore(100 - input.urgentRecommendations * 8);
  const readinessScore = clampInspectionScore(
    completionRate * 0.28 +
    overdueScore * 0.24 +
    findingsScore * 0.2 +
    workloadScore * 0.16 +
    observerScore * 0.12
  );
  return {
    completionRate,
    overdueScore,
    findingsScore,
    workloadScore,
    observerScore,
    readinessScore,
    tone: inspectionTone(readinessScore)
  };
}

export const inspectionLifecycle = [
  "planned",
  "assigned",
  "in_progress",
  "completed",
  "follow_up",
  "verified"
] as const;
