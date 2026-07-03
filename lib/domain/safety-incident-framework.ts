export const safetyIncidentTypes = [
  "distress_suspected",
  "violence_indicator",
  "aggressive_behavior_indicator",
  "prolonged_crying_indicator",
  "child_left_alone_indicator",
  "staff_absence_indicator",
  "unusual_crowding",
  "fall_suspected",
  "emergency_behavior_indicator"
] as const;

export type SafetyIncidentType = (typeof safetyIncidentTypes)[number];
export type SafetySeverity = "low" | "medium" | "high" | "critical";

export type SafetyIncidentAssessment = {
  event_type: SafetyIncidentType;
  safety_category: "distress" | "violence" | "supervision" | "crowding" | "fall" | "emergency";
  severity: SafetySeverity;
  review_priority: 1 | 2 | 3 | 4;
  confidence: number;
  title: string;
  description: string;
  recommended_action: string;
  parent_notification_policy: "confirmed_workflow_only";
  metadata: Record<string, unknown>;
};

const config: Record<SafetyIncidentType, Omit<SafetyIncidentAssessment, "event_type" | "confidence" | "metadata" | "parent_notification_policy">> = {
  distress_suspected: {
    safety_category: "distress",
    severity: "high",
    review_priority: 2,
    title: "חשד למצוקה - דורש בדיקת אדם",
    description: "אינדיקציה ניסיונית למצוקה אפשרית. אין מסקנה אוטומטית ואין הודעה להורים לפני review.",
    recommended_action: "פתחי review, בדקי הקשר, תיעוד צוות ומצב הילד."
  },
  violence_indicator: {
    safety_category: "violence",
    severity: "critical",
    review_priority: 1,
    title: "אינדיקציה לתנועה חריגה - review דחוף",
    description: "אינדיקציה בלבד לתנועה חריגה, לא האשמה ולא מסקנה משמעתית. נדרש review אנושי לפני כל הסלמה.",
    recommended_action: "בדקי את האירוע עם מנהלת/אדמין ושמרי תיעוד פנימי בלבד."
  },
  aggressive_behavior_indicator: {
    safety_category: "violence",
    severity: "high",
    review_priority: 2,
    title: "אינדיקציה להתנהגות אגרסיבית",
    description: "סימן אפשרי להתנהגות חריגה. אין קביעה לגבי אדם או ילד.",
    recommended_action: "בדקי הקשר, נוכחות צוות ותיעוד אירועים סמוכים."
  },
  prolonged_crying_indicator: {
    safety_category: "distress",
    severity: "medium",
    review_priority: 3,
    title: "אינדיקציה לבכי ממושך",
    description: "אינדיקציה עתידית בלבד לבכי ממושך. אין ניתוח שמע אמיתי בשלב זה.",
    recommended_action: "בדקי מול הצוות אם נדרש רישום אירוע או עדכון הורה לאחר review."
  },
  child_left_alone_indicator: {
    safety_category: "supervision",
    severity: "critical",
    review_priority: 1,
    title: "אינדיקציה לילד ללא השגחה",
    description: "חשד תפעולי רגיש מאוד. אין קביעה אוטומטית, נדרש review מיידי.",
    recommended_action: "בדקי נוכחות צוות, מצלמה, אזור ושעת פעילות לפני כל פעולה."
  },
  staff_absence_indicator: {
    safety_category: "supervision",
    severity: "high",
    review_priority: 2,
    title: "אינדיקציה לחוסר נוכחות צוות",
    description: "ייתכן שאזור מוגדר ללא צוות בפרק זמן חריג. נדרש אימות אנושי.",
    recommended_action: "בדקי שיבוץ צוות, אזור מצלמה ושגרת היום."
  },
  unusual_crowding: {
    safety_category: "crowding",
    severity: "medium",
    review_priority: 3,
    title: "צפיפות חריגה לבדיקה",
    description: "אינדיקציה לצפיפות ביחס לשגרה. אין מסקנה בטיחותית ללא review.",
    recommended_action: "בדקי את האזור, יחס צוות-ילדים והקשר פעילות."
  },
  fall_suspected: {
    safety_category: "fall",
    severity: "high",
    review_priority: 2,
    title: "חשד לנפילה",
    description: "אינדיקציה לנפילה אפשרית. נדרש review אנושי ותיעוד צוות.",
    recommended_action: "בדקי אם נדרש טיפול רפואי/אירוע פנימי ועדכון הורה אחרי אישור."
  },
  emergency_behavior_indicator: {
    safety_category: "emergency",
    severity: "critical",
    review_priority: 1,
    title: "אינדיקציה להתנהגות חירום",
    description: "אינדיקציה חריגה הדורשת בדיקה מהירה. אין הסלמה אוטומטית.",
    recommended_action: "בדקי מיד מול מנהלת/צוות והחליטי אם להסלים לאדמין/פיקוח."
  }
};

export function isSafetyIncidentType(value: string): value is SafetyIncidentType {
  return (safetyIncidentTypes as readonly string[]).includes(value);
}

export function assessSafetyIncident(eventType: string, confidence = 0.72): SafetyIncidentAssessment | null {
  if (!isSafetyIncidentType(eventType)) return null;
  const base = config[eventType];
  return {
    event_type: eventType,
    confidence,
    ...base,
    parent_notification_policy: "confirmed_workflow_only",
    metadata: {
      safety_framework: true,
      automatic_accusation: false,
      disciplinary_conclusion: false,
      human_review_required: true,
      parent_visible: false,
      parent_notification_policy: "confirmed_workflow_only",
      kindergarten_level_scoring_only: true,
      child_scoring: false
    }
  };
}

export function severityForSafetyIncident(eventType: string, fallback: string = "medium") {
  const assessment = assessSafetyIncident(eventType);
  return assessment?.severity ?? fallback;
}
