export type RiskTone = "good" | "warn" | "bad";

export function riskTone(value: number | string): RiskTone {
  if (typeof value === "number") {
    if (value >= 70) return "bad";
    if (value >= 38) return "warn";
    return "good";
  }
  const normalized = value.toLowerCase();
  if (["critical", "high", "rising", "bad"].includes(normalized)) return "bad";
  if (["medium", "new", "stable", "needs_review", "reviewing", "warn"].includes(normalized)) return "warn";
  return "good";
}

export function riskLevelLabel(value?: string | null) {
  const labels: Record<string, string> = {
    low: "נמוך",
    medium: "בינוני",
    high: "גבוה",
    critical: "קריטי"
  };
  return labels[value ?? "low"] ?? "נמוך";
}

export function riskTrendLabel(value?: string | null) {
  const labels: Record<string, string> = {
    rising: "עולה",
    stable: "יציב",
    declining: "יורד",
    new: "חדש"
  };
  return labels[value ?? "new"] ?? "חדש";
}

export function riskCategoryRows(profile: any) {
  return [
    { key: "safety", label: "בטיחות", value: Number(profile?.safety_risk ?? 0), description: "אירועים, איסוף וליקויים" },
    { key: "compliance", label: "ציות", value: Number(profile?.compliance_risk ?? 0), description: "מסמכים, נהלים והתראות" },
    { key: "operational", label: "תפעול", value: Number(profile?.operational_risk ?? 0), description: "תלונות, מצלמות ושגרה" },
    { key: "staffing", label: "צוות", value: Number(profile?.staffing_risk ?? 0), description: "נוכחות ושיבוץ" },
    { key: "observer", label: "תצפיתן", value: Number(profile?.observer_risk ?? 0), description: "סימנים פתוחים ובריאות מצלמות" }
  ];
}

export function cleanRiskReasons(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export const predictiveRiskSafeguards = [
  "אין האשמות אוטומטיות.",
  "אין החלטות משמעתיות.",
  "אין הודעות פאניקה להורים.",
  "אין תוויות לילדים או ניקוד ציבורי לצוות.",
  "כל המלצה דורשת בדיקה אנושית."
] as const;

export const riskAssistantQuestions = [
  "אילו גנים הופכים למסוכנים יותר?",
  "אילו סיכונים עולים?",
  "אילו נושאים חוזרים הכי הרבה?",
  "איפה כדאי לבצע בדיקה מונעת?"
] as const;
