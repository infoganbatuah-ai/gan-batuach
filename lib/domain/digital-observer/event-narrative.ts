export type ObserverEventLike = {
  signal_type?: unknown;
  recommended_action?: unknown;
  metadata?: unknown;
};

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
  const descriptor = eventDescriptors[observerEventType(event)] ?? { label: "אירוע לבדיקה", summary: "נקלט אירוע שממתין לבדיקה אנושית." };
  const summary = conciseText(metadata.event_summary)
    || conciseText(metadata.event_description)
    || conciseText(metadata.summary)
    || descriptor.summary;
  const action = conciseText(event?.recommended_action) || "מומלץ לבדוק את הראיה לפני פעולה.";
  return { label: descriptor.label, summary, action };
}
