export type PreventionTone = "good" | "warn" | "bad";

export function preventionTone(value: number | string): PreventionTone {
  if (typeof value === "number") {
    if (value >= 78) return "good";
    if (value >= 55) return "warn";
    return "bad";
  }
  const normalized = value.toLowerCase();
  if (["critical", "high", "rising", "overdue", "failed"].includes(normalized)) return "bad";
  if (["medium", "warning", "needs_review", "reviewing", "open", "in_progress"].includes(normalized)) return "warn";
  return "good";
}

export function avg(rows: any[], key: string) {
  const values = rows.map((row) => Number(row?.[key] ?? 0)).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function warningTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    rising_complaint_trend: "תלונות בעלייה",
    repeated_safety_events: "אירועי בטיחות חוזרים",
    repeated_staffing_issues: "דפוסי צוות חוזרים",
    declining_compliance: "ציות בירידה",
    increasing_observer_alerts: "התראות תצפיתן בעלייה",
    camera_outage_pattern: "ניתוקי מצלמה חוזרים",
    attendance_anomaly_pattern: "חריגות נוכחות",
    unresolved_findings_pattern: "ממצאים לא סגורים"
  };
  return labels[value ?? ""] ?? "אזהרה מוקדמת";
}

export function accuracyLabel(value?: string | null) {
  const labels: Record<string, string> = {
    pending: "ממתין",
    accurate: "מדויק",
    inaccurate: "לא מדויק",
    inconclusive: "לא חד משמעי"
  };
  return labels[value ?? "pending"] ?? "ממתין";
}

export function recommendationLabel(value?: string | null) {
  const labels: Record<string, string> = {
    schedule_inspection: "לתאם ביקורת",
    increase_supervision: "להגביר השגחה",
    review_staffing: "לבדוק צוות",
    complete_compliance_actions: "להשלים ציות",
    review_safety_procedures: "לעבור על נהלי בטיחות",
    follow_up_inspection: "ביקורת המשך",
    urgent_review: "בדיקה דחופה",
    compliance_review: "בדיקת ציות",
    management_action: "פעולת הנהלה"
  };
  return labels[value ?? ""] ?? "פעולה מונעת";
}

export function buildPreventionReadiness(profile: any) {
  const compliance = Math.max(0, 100 - Number(profile?.compliance_risk ?? 0));
  const inspections = Math.max(0, 100 - Number(profile?.safety_risk ?? 0));
  const incidents = Math.max(0, 100 - Number(profile?.operational_risk ?? 0));
  const observer = Math.max(0, 100 - Number(profile?.observer_risk ?? 0));
  const corrective = profile?.risk_trend === "declining" ? 88 : profile?.risk_trend === "rising" ? 48 : 72;
  return Math.round(compliance * 0.24 + inspections * 0.22 + incidents * 0.2 + observer * 0.18 + corrective * 0.16);
}

export function regionalRisk(rows: any[]) {
  const map = rows.reduce<Record<string, { region: string; total: number; count: number; high: number; rising: number }>>((acc, row) => {
    const region = row.gardens?.region ?? row.gardens?.city ?? "אזור לא צוין";
    acc[region] ??= { region, total: 0, count: 0, high: 0, rising: 0 };
    acc[region].total += Number(row.overall_risk_score ?? 0);
    acc[region].count += 1;
    if (["high", "critical"].includes(String(row.risk_level))) acc[region].high += 1;
    if (row.risk_trend === "rising") acc[region].rising += 1;
    return acc;
  }, {});
  return Object.values(map).map((item) => ({
    ...item,
    averageRisk: item.count ? Math.round(item.total / item.count) : 0
  })).sort((a, b) => b.averageRisk - a.averageRisk);
}

export const parentSafetyBoundary = [
  "הורים לא רואים תחזיות סיכון גולמיות.",
  "הורים לא רואים מודלים פנימיים או אזהרות מוקדמות.",
  "תקשורת להורים יוצאת רק לאחר בדיקה ואישור אנושי.",
  "אין הודעות פאניקה, האשמות או מסקנות אוטומטיות."
] as const;

export const preventionSafeguards = [
  "כל תחזית היא המלצה לבדיקה בלבד.",
  "אין אכיפה אוטומטית.",
  "אין החלטות משמעתיות.",
  "אין תיוג ילדים או צוות.",
  "אדם חייב לאשר כל הסלמה."
] as const;
