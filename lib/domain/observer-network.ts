export type ObserverNetworkTone = "good" | "warn" | "bad";

export function observerNetworkTone(value: number | string): ObserverNetworkTone {
  if (typeof value === "number") {
    if (value >= 82) return "good";
    if (value >= 62) return "warn";
    return "bad";
  }
  const status = value.toLowerCase();
  if (["critical", "urgent", "high", "needs_review", "escalated", "offline", "bad"].includes(status)) return "bad";
  if (["medium", "reviewing", "degraded", "warn"].includes(status)) return "warn";
  return "good";
}

export function clampObserverNetworkScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildObserverReadinessScore(input: {
  totalCameras: number;
  activeCameras: number;
  unhealthyCameras: number;
  totalSignals: number;
  reviewedSignals: number;
  falsePositiveSignals: number;
  unresolvedSignals: number;
  complianceSignals: number;
}) {
  const cameraCoverageScore = input.totalCameras ? clampObserverNetworkScore((input.activeCameras / input.totalCameras) * 100) : 55;
  const cameraHealthScore = input.totalCameras ? clampObserverNetworkScore(100 - (input.unhealthyCameras / input.totalCameras) * 100) : 55;
  const reviewRateScore = input.totalSignals ? clampObserverNetworkScore((input.reviewedSignals / input.totalSignals) * 100) : 65;
  const falsePositiveScore = input.reviewedSignals ? clampObserverNetworkScore(100 - (input.falsePositiveSignals / input.reviewedSignals) * 100) : 72;
  const unresolvedSignalScore = clampObserverNetworkScore(100 - input.unresolvedSignals * 4);
  const complianceIntegrationScore = input.complianceSignals ? 88 : 68;
  const readinessScore = clampObserverNetworkScore(
    cameraCoverageScore * 0.18 +
    cameraHealthScore * 0.2 +
    reviewRateScore * 0.2 +
    falsePositiveScore * 0.14 +
    unresolvedSignalScore * 0.18 +
    complianceIntegrationScore * 0.1
  );
  return {
    readinessScore,
    cameraCoverageScore,
    cameraHealthScore,
    reviewRateScore,
    falsePositiveScore,
    unresolvedSignalScore,
    complianceIntegrationScore,
    tone: observerNetworkTone(readinessScore)
  };
}

export function buildSignalRiskScore(input: {
  severity: string;
  confidence?: number | null;
  repeatedCount?: number | null;
  unresolvedFindings?: number;
  recentComplaints?: number;
  cameraReliabilityPenalty?: number;
  compliancePenalty?: number;
}) {
  const severityBase: Record<string, number> = { info: 10, low: 24, medium: 44, high: 66, urgent: 78, critical: 88 };
  return clampObserverNetworkScore(
    (severityBase[input.severity] ?? 40) +
    Number(input.confidence ?? 0) * 16 +
    Math.min(18, Number(input.repeatedCount ?? 1) * 3) +
    Number(input.unresolvedFindings ?? 0) * 4 +
    Number(input.recentComplaints ?? 0) * 4 +
    Number(input.cameraReliabilityPenalty ?? 0) +
    Number(input.compliancePenalty ?? 0)
  );
}

export const parentObserverBoundary = [
  "הורים לא רואים סימני תצפיתן גולמיים.",
  "הורים רואים רק סיכום שאושר בבדיקה אנושית.",
  "אין הודעות פאניקה להורים מתוך מצלמה, שמע או AI.",
  "אירוע רגיש עובר קודם בדיקת מנהל, אדמין או פקח."
] as const;

export const safeObserverRecommendations = [
  "לבדוק הקלטה או שידור",
  "לפנות למנהלת הגן",
  "לקבוע ביקורת המשך",
  "לאמת נוכחות צוות",
  "לבקש עדכון מסמך",
  "לבדוק הקשר של תלונה",
  "לבדוק בריאות מצלמה"
] as const;
