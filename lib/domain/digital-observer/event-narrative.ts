import { z } from "zod";

export type ObserverEventLike = {
  signal_type?: unknown;
  recommended_action?: unknown;
  confidence?: unknown;
  severity?: unknown;
  review_status?: unknown;
  metadata?: unknown;
};

const reportedSeveritySchema = z.enum(["info", "low", "medium", "high", "urgent", "critical", "unknown"]);
export const observerEventNarrativeSchema = z.object({
  label: z.string().max(240), summary: z.string().max(500), action: z.string().max(500),
  reason: z.string().max(500), conclusion: z.string().max(300), anomalyAssessment: z.string().max(300),
  confidence: z.number().min(0).max(1).nullable(),
  narrativeVersion: z.literal("evidence-narrative-v1"), narrativeBasis: z.literal("reported_evidence_only"),
  identityStatus: z.literal("not_verified"), identityLabel: z.string().max(160),
  executiveSummary: z.string().max(500), observedFacts: z.array(z.string().max(500)).max(5),
  reportedSeverity: reportedSeveritySchema, urgency: z.string().max(160),
  baselineStatus: z.literal("not_verified"), baselineContext: z.string().max(300),
  uncertainty: z.string().max(300), impactAssessment: z.string().max(300),
  followUpStatus: z.enum(["needs_review", "reviewing", "confirmed", "dismissed", "resolved", "escalated", "unknown"]),
  physicalActionExecuted: z.literal(false)
}).strict();

type EventDescriptor = {
  label: string;
  summary: string;
};

const eventDescriptors: Record<string, EventDescriptor> = {
  ai_camera: { label: "אירוע מצלמה", summary: "המצלמה יצרה אירוע שממתין לבדיקה אנושית." },
  camera_health: { label: "בריאות מצלמה", summary: "זוהה שינוי במצב החיבור או בתקינות המצלמה." },
  camera_media_readiness: { label: "בדיקת מדיית מצלמה", summary: "נוצר תיעוד מדיה מאומת מה-Gateway לצורך בדיקה." },
  person_detected: { label: "זוהה אדם", summary: "זוהתה נוכחות של אדם; הזיהוי אינו קובע זהות ללא הסכמה וביקורת." },
  known_person_detected: { label: "זוהה אדם מוכר", summary: "הזיהוי מוצג כהערכה על בסיס אדם מורשה שהוגדר באתר." },
  unknown_person_detected: { label: "זוהה אדם לא מוכר", summary: "זוהה אדם שאינו תואם לאדם מורשה שהוגדר באתר." },
  person_entered: { label: "אדם נכנס", summary: "זוהתה כניסה באזור המצולם." },
  person_exited: { label: "אדם יצא", summary: "זוהתה יציאה מהאזור המצולם." },
  authorized_entry: { label: "כניסה של אדם מורשה", summary: "הזיהוי תאם אדם מורשה שהוגדר באתר; יש לבדוק את הראיה במקרה של ספק." },
  unauthorized_entry: { label: "כניסה של אדם לא מורשה", summary: "זוהתה כניסה שאינה תואמת לאדם מורשה שהוגדר באתר." },
  vehicle_entered: { label: "רכב נכנס", summary: "זוהתה כניסת רכב לאזור המצולם." },
  vehicle_exited: { label: "רכב יצא", summary: "זוהתה יציאת רכב מהאזור המצולם." },
  unrecognized_vehicle: { label: "רכב לא מוכר", summary: "זוהה רכב שאינו תואם לרכב שהוגדר כמוכר באתר." },
  vehicle_tampering: { label: "חשד לפגיעה או פריצה לרכב", summary: "זוהתה פעילות חריגה ליד רכב; נדרשת בדיקה אנושית של הראיה." },
  unknown_person_near_vehicle: { label: "אדם לא מוכר ליד רכב", summary: "זוהתה נוכחות חריגה ליד רכב; אין להסיק כוונה ללא בדיקה אנושית." },
  vehicle_started_by_unknown_person: { label: "הנעת רכב דורשת בדיקה", summary: "זוהתה פעילות שעשויה להתאים להנעת רכב על ידי אדם לא מוכר; נדרשת בדיקה אנושית." },
  suspected_theft: { label: "חשד לגניבה", summary: "זוהה דפוס שעשוי להתאים לגניבה; אין לקבוע עובדה ללא בדיקה אנושית." },
  animal_detected: { label: "זוהה בעל חיים", summary: "זוהתה נוכחות של בעל חיים באזור המצולם." },
  vehicle_detected: { label: "זוהה רכב", summary: "דווחה נוכחות רכב באזור המצולם; אין בכך זיהוי בעלות או כוונה." },
  distress_detected: { label: "סימן מצוקה דורש בדיקה", summary: "זוהה דפוס שעשוי להצביע על מצוקה; נדרשת בדיקה אנושית מיידית של הראיה." },
  child_distress_detected: { label: "סימן מצוקה של ילד", summary: "זוהה דפוס שעשוי להצביע על מצוקה; נדרשת בדיקה אנושית מיידית של הראיה." },
  animal_distress_detected: { label: "סימן מצוקה של בעל חיים", summary: "זוהה דפוס שעשוי להצביע על מצוקה של בעל חיים; נדרשת בדיקה אנושית." },
  suspected_violence: { label: "חשד לעימות או אלימות", summary: "זוהה דפוס חריג שעשוי להצביע על עימות; אין לקבוע עובדה ללא בדיקה אנושית." },
  suspected_robbery: { label: "חשד לשוד", summary: "זוהה דפוס חריג שעשוי להתאים לשוד; אין לקבוע עובדה ללא בדיקה אנושית." },
  fire_detected: { label: "חשד לשריפה", summary: "זוהה דפוס חזותי שעשוי להתאים לאש; יש לבדוק מיידית את הראיה ואת מצב האתר." },
  smoke_detected: { label: "חשד לעשן", summary: "זוהה דפוס חזותי שעשוי להתאים לעשן; יש לבדוק מיידית את הראיה ואת מצב האתר." },
  stove_left_on: { label: "מכשיר חום דורש בדיקה", summary: "זוהה מכשיר חום פעיל לאורך זמן לפי כלל האתר; נדרשת בדיקה אנושית." },
  light_left_on: { label: "אור נשאר דולק", summary: "זוהה אור פעיל לאורך זמן לפי כלל האתר; נדרשת בדיקה מול נוכחות אנשים." },
  television_left_on: { label: "טלוויזיה פעילה ללא נוכחות", summary: "זוהתה תצוגה פעילה לאורך זמן לפי כלל האתר; נדרשת בדיקה מול נוכחות אנשים." },
  long_room_occupancy: { label: "שהייה ממושכת בחדר", summary: "זוהתה שהייה ממושכת לפי כלל האתר; נדרשת בדיקה אנושית ולא קביעה אוטומטית." },
  room_entry: { label: "כניסה לחדר", summary: "זוהתה כניסה לחדר." },
  room_exit: { label: "יציאה מחדר", summary: "זוהתה יציאה מחדר." },
  perimeter_entry: { label: "כניסה לשטח", summary: "זוהתה כניסה לשטח המוגדר באתר." },
  perimeter_exit: { label: "יציאה מהשטח", summary: "זוהתה יציאה מהשטח המוגדר באתר." },
  door_left_open: { label: "דלת נשארה פתוחה", summary: "הדלת נראית פתוחה מעבר לזמן שהוגדר בכלל האתר." },
  motion_after_hours: { label: "תנועה מחוץ לשעות", summary: "זוהתה תנועה מחוץ לשעות שנקבעו בכלל האתר." },
  restricted_area: { label: "תנועה באזור מוגבל", summary: "זוהתה תנועה באזור שהוגדר כמוגבל; נדרשת בדיקה אנושית." },
  camera_offline: { label: "מצלמה נותקה", summary: "המצלמה אינה מחזירה שידור חי ולכן התצפיתן אינו פעיל עליה." },
  camera_obstruction: { label: "ייתכן שהמצלמה מכוסה", summary: "זוהה שינוי חריג בתמונה; נדרשת בדיקה של המצלמה והסביבה." },
  pattern: { label: "דפוס חריג", summary: "זוהה שינוי ביחס לדפוס שנלמד באתר; נדרשת בדיקה אנושית." },
  system: { label: "אירוע מערכת", summary: "נרשמה פעילות תפעולית במערכת." }
};

// Event names/metadata are not proof of consent, enrollment or an identity match.
// Until a trusted matching result is joined server-side, never name/authorize a person.
const identityDependentEvents = new Set([
  "known_person_detected", "unknown_person_detected", "authorized_entry", "unauthorized_entry",
  "unknown_person_near_vehicle", "vehicle_started_by_unknown_person"
]);

function metadataOf(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function conciseText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 500) : null;
}

export function observerEventType(event: ObserverEventLike | null | undefined) {
  const metadata = metadataOf(event?.metadata);
  return conciseText(metadata.event_type) || conciseText(event?.signal_type) || "system";
}

export function observerEventNarrative(event: ObserverEventLike | null | undefined) {
  const metadata = metadataOf(event?.metadata);
  const type = observerEventType(event);
  const identityUnverified = identityDependentEvents.has(type) || metadata.identity_recognition_used === true;
  const descriptor = identityUnverified
    ? { label: "נוכחות אדם לבדיקה", summary: "דווחה נוכחות אדם. אין התאמת זהות מאומתת, ולכן לא נקבע אם הוא דייר או מורשה כניסה." }
    : eventDescriptors[type] ?? { label: "אירוע לבדיקה", summary: "נקלט אירוע שממתין לבדיקה אנושית." };
  const summary = (identityUnverified ? null : conciseText(metadata.event_summary)
    || conciseText(metadata.event_description)
    || conciseText(metadata.summary))
    || descriptor.summary;
  const action = (identityUnverified ? null : conciseText(event?.recommended_action)) || "מומלץ לבדוק את הראיה לפני פעולה.";
  const reason = (identityUnverified ? null : conciseText(metadata.event_reason)) || summary;
  const confidence = typeof event?.confidence === "number" && Number.isFinite(event.confidence)
    && event.confidence >= 0 && event.confidence <= 1 ? event.confidence : null;
  const conclusion = identityUnverified
    ? "יש לבדוק את האירוע. אדם שלא זוהה אינו בהכרח אדם שאסור לו להיכנס."
    : ["person_detected", "vehicle_detected", "animal_detected"].includes(type)
      ? "דווחה נוכחות בלבד. אין בכך הוכחה לכניסה, יציאה, כוונה או סכנה."
      : "האירוע דורש אימות מול הראיה. לא הופעלה פעולה פיזית או קריאת חירום.";
  const anomalyAssessment = type === "camera_media_readiness"
    ? "זו בדיקת מדיה טכנית, לא זיהוי חריגה או סכנה. אין להסיק ממנה מה התרחש במקום."
    : ["person_detected", "vehicle_detected", "animal_detected"].includes(type)
      ? "נוכחות בלבד אינה מעידה על חריגה. לא נמסרה ראיה מספקת להפרת כלל, כניסה או סכנה."
      : "אין די מידע מאומת לקבוע אם זו חריגה. יש להשוות את התיאור לתמונה, לסרטון ולכללי המקום.";
  const reportedSeverity = reportedSeveritySchema.safeParse(event?.severity);
  const followUp = observerEventNarrativeSchema.shape.followUpStatus.safeParse(event?.review_status);
  return observerEventNarrativeSchema.parse({ label: descriptor.label, summary, action, reason, conclusion, anomalyAssessment, confidence,
    narrativeVersion: "evidence-narrative-v1" as const, narrativeBasis: "reported_evidence_only" as const,
    identityStatus: "not_verified", identityLabel: "זהות והרשאת כניסה לא אומתו",
    executiveSummary: summary, observedFacts: [summary], reportedSeverity: reportedSeverity.success ? reportedSeverity.data : "unknown",
    urgency: ["critical", "urgent", "high"].includes(String(event?.severity)) ? "דווחה דחיפות גבוהה; נדרשת בדיקה אנושית בהקדם" : "בדיקת הראיה לפני פעולה",
    baselineStatus: "not_verified", baselineContext: "לא צורפה השוואה לשגרת המקום המבוססת על הסכמה ונתונים מאומתים.",
    uncertainty: confidence === null ? "לא נמסרה רמת ביטחון. אין די מידע לקבוע זהות, כוונה או חריגה." : "רמת הביטחון היא של הדיווח בלבד; היא אינה הוכחה לזהות, כוונה או סכנה.",
    impactAssessment: "לא אומתו נזק, פגיעה או כוונה. יש לבדוק את הראיה ואת המצב במקום.",
    followUpStatus: followUp.success ? followUp.data : "unknown", physicalActionExecuted: false });
}
