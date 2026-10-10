export type RecruitmentTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

const applicationStates: Record<string, { label: string; tone: RecruitmentTone; step: number }> = {
  draft: { label: "טיוטה", tone: "muted", step: 0 },
  submitted: { label: "הוגשה", tone: "info", step: 1 },
  under_review: { label: "בבדיקה", tone: "primary", step: 2 },
  information_required: { label: "נדרש מידע", tone: "warning", step: 2 },
  resubmitted: { label: "נשלחה השלמה", tone: "info", step: 2 },
  approved: { label: "אושרה", tone: "success", step: 3 },
  awaiting_candidate_acceptance: { label: "ממתינה לאישור שלך", tone: "warning", step: 3 },
  accepted: { label: "התקבלה", tone: "success", step: 4 },
  employed: { label: "העסקה הופעלה", tone: "success", step: 4 },
  rejected: { label: "לא המשיכה", tone: "danger", step: 4 },
  withdrawn: { label: "נמשכה על ידך", tone: "muted", step: 4 },
  cancelled: { label: "בוטלה", tone: "muted", step: 4 }
};

export function recruitmentApplicationState(status?: string | null) {
  return applicationStates[String(status ?? "")] ?? { label: "ממתינה לעדכון", tone: "muted" as const, step: 1 };
}

export function recruitmentBlockerLabel(value: string) {
  const labels: Record<string, string> = {
    professional_profile_missing: "פרופיל מקצועי",
    full_name_missing: "שם מלא",
    city_missing: "עיר",
    professional_role_missing: "תפקיד מבוקש",
    qualification_missing: "הסמכה מקצועית",
    availability_missing: "זמינות",
    required_documents_pending: "מסמך הסמכה"
  };
  return labels[value] ?? "פרט נדרש";
}

export function recruitmentMatchReason(value: string) {
  const labels: Record<string, string> = {
    profession_match: "התפקיד מתאים",
    qualification_match: "ההסמכה מתאימה",
    missing_required_qualification: "נדרשת הסמכה נוספת",
    same_city: "באותה עיר",
    preferred_age_group: "קבוצת גיל מועדפת",
    location_unavailable: "מיקום טרם הוגדר"
  };
  return labels[value] ?? "התאמה לפי פרטי המשרה";
}

export function recruitmentQualificationLabel(value: string) {
  const labels: Record<string, string> = {
    early_childhood: "חינוך לגיל הרך",
    teacher_certificate: "תעודת הוראה",
    caregiver_training: "הכשרת מטפלות",
    first_aid: "עזרה ראשונה"
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

export function recruitmentDocumentState(status?: string | null) {
  const states: Record<string, { label: string; tone: RecruitmentTone }> = {
    missing: { label: "חסר", tone: "danger" },
    uploaded: { label: "הועלה · ממתין לבדיקה", tone: "warning" },
    pending: { label: "בבדיקה", tone: "warning" },
    verified: { label: "אומת", tone: "success" },
    rejected: { label: "נדחה", tone: "danger" },
    expired: { label: "פג תוקף", tone: "danger" },
    replacement_required: { label: "נדרש מסמך חלופי", tone: "warning" }
  };
  return states[String(status ?? "missing")] ?? states.missing;
}

export const recruitmentTimelineSteps = ["הוגשה", "בדיקה", "הצעה", "הפעלה"];
