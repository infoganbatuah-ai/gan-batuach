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
  drowning_hazard: { label: "חשד לסכנת טביעה", summary: "גלאי הבריכה דיווח על חשד לסכנת טביעה; נדרשת בדיקה מיידית של הבריכה." },
  unsupervised_child: { label: "חשד לילד ללא השגחה", summary: "כלל ההשגחה בבריכה הופעל; יש לבדוק מיידית את מצב ההשגחה." },
  person_near_pool_off_hours: { label: "אדם ליד הבריכה מחוץ לשעות", summary: "זוהתה נוכחות ליד הבריכה מחוץ לשעות שהוגדרו באתר." },
  pool_entry_off_hours: { label: "כניסה לבריכה מחוץ לשעות", summary: "זוהתה כניסה לבריכה מחוץ לשעות שהוגדרו באתר." },
  water_breach: { label: "חריגת מים בבריכה", summary: "גלאי הבריכה דיווח על חריגת מים; נדרשת בדיקה במקום." },
  lpr_unauthorized: { label: "לוחית רישוי לא מורשית", summary: "זיהוי לוחית הרישוי לא תאם לרשימת הרכבים המורשים; נדרשת בדיקה." },
  blocked_driveway: { label: "חשד לחסימת מעבר רכבים", summary: "כלל החניה זיהה חסימה אפשרית במעבר שהוגדר." },
  unauthorized_parking: { label: "חשד לחניה לא מורשית", summary: "כלל החניה זיהה חניה שאינה תואמת להרשאות האתר." },
  face_identification: { label: "התאמת זהות בכניסה", summary: "התקבלה התאמת זהות מהגלאי המאושר; יש לבדוק את הראיה במקרה של ספק." },
  pose_breach: { label: "חריגת תנוחה בכניסה", summary: "כלל ניטור התנוחה בכניסה הופעל; נדרשת בדיקה." },
  door_open: { label: "דלת נפתחה", summary: "זוהה מעבר של הדלת למצב פתוח." },
  door_close: { label: "דלת נסגרה", summary: "זוהה מעבר של הדלת למצב סגור." },
  gate_or_door_open: { label: "שער או דלת פתוחים", summary: "כלל הכניסה דיווח על שער או דלת שנותרו פתוחים." },
  unrecognized_standing_visitor: { label: "מבקר לא מוכר ממתין", summary: "זוהה מבקר ממתין שאינו תואם להרשאות שהוגדרו; נדרשת בדיקה." },
  fence_scaling: { label: "חשד לטיפוס על גדר", summary: "גלאי ההיקף דיווח על דפוס שעשוי להתאים לטיפוס על גדר." },
  unauthorized_night_motion: { label: "תנועה לא מורשית בלילה", summary: "כלל ההיקף זיהה תנועה בשעות הלילה שאינה תואמת להרשאות האתר." },
  fall_suspected: { label: "חשד לנפילה", summary: "גלאי הנפילות דיווח על דפוס שדורש בדיקה מיידית." },
  distress_suspected: { label: "חשד למצוקה", summary: "גלאי המצוקה דיווח על דפוס שדורש בדיקה מיידית." },
  camera_obstruction_suspected: { label: "חשד להסתרת מצלמה", summary: "זוהה שינוי חריג בתמונה שעשוי להעיד על הסתרה; נדרשת בדיקה." },
  restricted_area_entry: { label: "כניסה לאזור מוגבל", summary: "כלל האזור המוגבל זיהה כניסה הדורשת בדיקה." },
  camera_reconnected: { label: "המצלמה חזרה לשדר", summary: "התקבלה שוב דגימת וידאו מהמצלמה." },
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
  vehicle_detected: { label: "זוהה רכב — זיהוי קודם", summary: "דווח בעבר על נוכחות רכב; דיווח זה אינו מאמת כניסה, יציאה או הרשאה." },
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
