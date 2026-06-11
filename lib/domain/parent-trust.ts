export type ParentTrustTone = "good" | "warn" | "bad";

export function parentTrustTone(value: number | string): ParentTrustTone {
  if (typeof value === "number") {
    if (value >= 82) return "good";
    if (value >= 62) return "warn";
    return "bad";
  }
  const normalized = value.toLowerCase();
  if (["certified", "monitored", "resolved", "closed", "good"].includes(normalized)) return "good";
  if (["probation", "received", "under_review", "new", "assigned", "in_progress", "waiting_garden", "warn"].includes(normalized)) return "warn";
  return "bad";
}

export function trustBadgeLabel(status?: string | null) {
  const labels: Record<string, string> = {
    certified: "Gan Batuach Certified",
    monitored: "במעקב פעיל",
    probation: "בתהליך שיפור",
    suspended: "מושעה מאמון ציבורי"
  };
  return labels[status ?? "monitored"] ?? "במעקב פעיל";
}

export function complaintParentStatus(status?: string | null) {
  const labels: Record<string, string> = {
    new: "התקבלה",
    assigned: "בבדיקה",
    in_progress: "בבדיקה",
    waiting_garden: "ממתין לעדכון",
    closed: "נסגרה",
    received: "התקבלה",
    under_review: "בבדיקה",
    resolved: "טופלה"
  };
  return labels[status ?? "new"] ?? "בבדיקה";
}

export function trustFeedLabel(type?: string | null) {
  const labels: Record<string, string> = {
    inspection_completed: "ביקורת",
    compliance_improved: "ציות",
    safety_milestone: "בטיחות",
    resolved_finding: "תיקון",
    trust_badge_updated: "תג אמון",
    important_safety_update: "עדכון חשוב"
  };
  return labels[type ?? "safety_milestone"] ?? "עדכון";
}

export const parentTrustVisibilityRules = [
  "לא מוצגים אירועי AI גולמיים.",
  "לא מוצגות חקירות פנימיות.",
  "לא מוצג מידע אישי על ילדים, הורים או צוות.",
  "מוצגים רק סיכומים שאושרו לשקיפות הורים."
] as const;

export const trustScoreWeights = [
  { label: "בטיחות", weight: 26 },
  { label: "ציות", weight: 20 },
  { label: "פיקוח", weight: 20 },
  { label: "מוכנות תצפיתן", weight: 16 },
  { label: "סגירת נושאים", weight: 10 },
  { label: "תגובה לפניות", weight: 8 }
] as const;
