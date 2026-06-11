export type KosTone = "default" | "good" | "warn" | "bad";

export type OperationalHealthInput = {
  attendanceCompletion: number;
  complianceReadiness: number;
  inspectionReadiness: number;
  incidentReadiness: number;
  communicationReadiness: number;
  observerReadiness: number;
};

export function clampKosScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function kosTone(value: number): KosTone {
  if (value >= 85) return "good";
  if (value >= 65) return "warn";
  return "bad";
}

export function countTone(count: number): KosTone {
  return count > 0 ? "warn" : "good";
}

export function buildOperationalHealthScore(input: OperationalHealthInput) {
  const components = {
    attendance: clampKosScore(input.attendanceCompletion),
    compliance: clampKosScore(input.complianceReadiness),
    inspections: clampKosScore(input.inspectionReadiness),
    incidents: clampKosScore(input.incidentReadiness),
    communication: clampKosScore(input.communicationReadiness),
    observer: clampKosScore(input.observerReadiness)
  };
  const score = clampKosScore(
    components.attendance * 0.18 +
    components.compliance * 0.18 +
    components.inspections * 0.16 +
    components.incidents * 0.18 +
    components.communication * 0.14 +
    components.observer * 0.16
  );
  return { score, tone: kosTone(score), components };
}

export function statusLabel(value?: string | null) {
  const map: Record<string, string> = {
    open: "פתוח",
    in_progress: "בטיפול",
    approved: "אושר",
    completed: "הושלם",
    done: "הושלם",
    pending: "ממתין",
    pending_review: "לבדיקה",
    needs_review: "דורש בדיקה",
    reviewing: "בבדיקה",
    identified: "זוהה",
    assigned: "שויך",
    ready_for_verification: "מוכן לאימות",
    escalated: "הוסלם",
    resolved: "נסגר",
    closed: "נסגר",
    overdue: "באיחור"
  };
  return map[String(value ?? "")] ?? "פתוח";
}

export function sourceLabel(value?: string | null) {
  const map: Record<string, string> = {
    inspections: "פיקוח",
    compliance: "ציות",
    ai_recommendations: "המלצה חכמה",
    incidents: "אירוע",
    documents: "מסמכים",
    communications: "תקשורת",
    observer: "תצפיתן",
    payments: "תשלומים",
    children: "ילדים",
    staff: "צוות",
    parents: "הורים"
  };
  return map[String(value ?? "")] ?? "תפעול";
}

export const kosAssistantQuestions = [
  "מה דורש טיפול היום?",
  "אילו משימות עדיין פתוחות?",
  "אילו ביקורות קרובות?",
  "אילו נושאי ציות פתוחים?",
  "אילו ילדים צריכים עדכון?"
];

export const kosWorkflowExamples = [
  {
    event: "ליקוי בפיקוח",
    task: "פעולת תיקון",
    notification: "עדכון מנהלת",
    review: "אימות מפקח",
    closure: "סגירת ליקוי"
  },
  {
    event: "מסמך פג תוקף",
    task: "חידוש מסמך",
    notification: "תזכורת לאחראי",
    review: "בדיקת מסמך",
    closure: "אישור תוקף"
  },
  {
    event: "אזהרת תצפיתן",
    task: "בדיקה אנושית",
    notification: "סימון לטיפול",
    review: "מנהל/מפקח בודק",
    closure: "אישור או דחייה"
  }
];
