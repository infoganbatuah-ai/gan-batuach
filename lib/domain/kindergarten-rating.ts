export type RatingTone = "good" | "warn" | "bad";

export const ratingWeights = [
  { key: "safety", label: "בטיחות", weight: 28 },
  { key: "compliance", label: "ציות", weight: 22 },
  { key: "inspection", label: "פיקוח", weight: 20 },
  { key: "parent_satisfaction", label: "שביעות רצון", weight: 12 },
  { key: "observer", label: "תצפיתן", weight: 18 }
] as const;

export function ratingTone(value: number | string): RatingTone {
  if (typeof value === "number") {
    if (value >= 80) return "good";
    if (value >= 60) return "warn";
    return "bad";
  }
  const normalized = value.toLowerCase();
  if (["excellent", "strong", "stable", "improving", "good"].includes(normalized)) return "good";
  if (["needs_attention", "declining", "warn", "new"].includes(normalized)) return "warn";
  return "bad";
}

export function ratingBandLabel(value?: string | null) {
  const labels: Record<string, string> = {
    excellent: "מצוין",
    strong: "חזק",
    stable: "יציב",
    needs_attention: "דורש שיפור",
    critical: "דורש טיפול",
    new: "חדש"
  };
  return labels[value ?? "new"] ?? "חדש";
}

export function ratingTrendLabel(value?: string | null) {
  const labels: Record<string, string> = {
    improving: "משתפר",
    stable: "יציב",
    declining: "בירידה",
    new: "חדש"
  };
  return labels[value ?? "new"] ?? "חדש";
}

export function categoryScoreRows(profile: any) {
  return [
    { key: "safety", label: "בטיחות", value: Number(profile?.safety_score ?? 0), description: "אירועים, ליקויים ותיקונים" },
    { key: "compliance", label: "ציות", value: Number(profile?.compliance_score ?? 0), description: "מסמכים, תעודות ונהלים" },
    { key: "inspection", label: "פיקוח", value: Number(profile?.inspection_score ?? 0), description: "תוצאות ביקורת וסגירת ממצאים" },
    { key: "parent_satisfaction", label: "שביעות רצון", value: Number(profile?.parent_satisfaction_score ?? 0), description: "פידבק, תלונות ומעורבות" },
    { key: "observer", label: "תצפיתן", value: Number(profile?.observer_score ?? 0), description: "מצלמות, בדיקה אנושית וכיול" }
  ];
}

export function cleanRatingReasons(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export const publicRatingBoundary = [
  "הדירוג הציבורי כבוי כברירת מחדל.",
  "אין פרסום תלונות, אירועים או מידע אישי.",
  "כל ציון חייב להיות מוסבר לפי קטגוריות ומשקלים.",
  "מנהל ואדמין יכולים לראות מה צריך לשפר לפני פרסום."
] as const;
