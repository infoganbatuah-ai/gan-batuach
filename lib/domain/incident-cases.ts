export function caseSeverityTone(value?: string | number | null): "good" | "warn" | "bad" | "default" {
  const text = String(value ?? "").toLowerCase();
  if (text === "critical" || text === "high") return "bad";
  if (text === "medium" || text === "under_review" || text === "investigating" || text === "evidence_collection" || text === "pending_decision") return "warn";
  if (text === "resolved" || text === "closed" || text === "low") return "good";
  return "default";
}

export function caseStatusLabel(status?: string | null) {
  switch (status) {
    case "reported":
      return "דווח";
    case "under_review":
      return "בבדיקה";
    case "investigating":
      return "חקירה";
    case "evidence_collection":
      return "איסוף ראיות";
    case "pending_decision":
      return "ממתין להחלטה";
    case "resolved":
      return "טופל";
    case "closed":
      return "נסגר";
    default:
      return "לא ידוע";
  }
}

export function caseTypeLabel(type?: string | null) {
  switch (type) {
    case "injury":
      return "פציעה";
    case "safety_concern":
      return "חשש בטיחות";
    case "complaint":
      return "תלונה";
    case "pickup_incident":
      return "אירוע איסוף";
    case "health_incident":
      return "בריאות";
    case "observer_alert":
      return "תצפיתן";
    case "camera_incident":
      return "מצלמה";
    case "staff_incident":
      return "צוות";
    case "compliance_incident":
      return "ציות";
    default:
      return "אירוע";
  }
}

export function evidenceTypeLabel(type?: string | null) {
  switch (type) {
    case "photo":
      return "תמונה";
    case "document":
      return "מסמך";
    case "video":
      return "וידאו";
    case "camera_clip":
      return "קטע מצלמה";
    case "camera_snapshot":
      return "צילום מצלמה";
    case "observer_event":
      return "תצפיתן";
    case "inspection_report":
      return "דוח פיקוח";
    case "witness_note":
      return "עדות";
    case "timeline_note":
      return "רישום";
    default:
      return "ראיה";
  }
}

export const caseSafetyRules = [
  "אין מסקנות אוטומטיות",
  "אין שיוך אשמה אוטומטי",
  "אין החלטה משמעתית בלי אדם",
  "הורים רואים רק סטטוס מאושר",
  "ראיות פנימיות נשארות מוגנות"
];

export const investigationAssistantPrompts = [
  "סכמי את ציר הזמן בלי להסיק מסקנה",
  "אילו ראיות חסרות בתיק?",
  "אילו פעולות תיקון ממתינות?",
  "איזה תיק דורש הסלמה היום?"
];
