export type TimelineTone = "good" | "warn" | "bad" | "default";

export function timelineTone(category?: string | null, relevance?: string | null): TimelineTone {
  if (relevance === "incident" || category === "incidents") return "bad";
  if (relevance === "attention" || relevance === "health" || category === "health" || category === "pickup") return "warn";
  if (category === "attendance" || category === "meals" || category === "activities" || category === "sleep") return "good";
  return "default";
}

export function timelineCategoryLabel(category?: string | null) {
  switch (category) {
    case "attendance":
      return "נוכחות";
    case "meals":
      return "ארוחות";
    case "sleep":
      return "שינה";
    case "activities":
      return "פעילות";
    case "health":
      return "בריאות";
    case "incidents":
      return "אירועים";
    case "pickup":
      return "איסוף";
    case "documents":
      return "מסמכים";
    case "messages":
      return "הודעות";
    case "ai_summaries":
      return "סיכום";
    case "observer_approved_events":
      return "בטיחות מאושרת";
    case "registration":
      return "רישום";
    default:
      return "עדכון";
  }
}

export function eventTimeText(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
}

export function eventDateText(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("he-IL");
}

export const childTimelinePrivacyRules = [
  "זהו תיק תפעולי ובטיחותי, לא פרופיל אישי",
  "הורים רואים רק אירועים שאושרו לשיתוף",
  "אירועים פנימיים וחקירות נשארים מוגנים",
  "סיכומי AI משתמשים רק בנתוני ציר הזמן",
  "אין תיוג, דירוג או מסקנות אוטומטיות על ילד"
];

export const childTimelineQuestions = [
  "מה קרה היום?",
  "האם הילד/ה אכל/ה?",
  "האם הייתה הערת בריאות?",
  "האם היה אירוע שדורש תשומת לב?"
];
