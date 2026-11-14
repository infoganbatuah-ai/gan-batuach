const blockerLabels: Record<string, string> = {
  garden_name: "שם הגן",
  address: "כתובת הגן",
  phone: "טלפון הגן",
  identity_verification: "אימות פרטי הקשר הנדרש",
  age_groups: "בחירת קבוצת גיל",
  documents: "סיכום מצב מסמכים",
  platform_terms: "אישור תנאי השימוש ומדיניות הפרטיות",
  privacy_terms: "אישור תנאי השימוש ומדיניות הפרטיות"
};

const optionalFieldLabels: Record<string, string> = {
  logo: "לוגו",
  profile_image: "תמונת גן",
  contact_details: "פרטי קשר נוספים",
  business_information: "פרטי עסק",
  operating_hours: "שעות פעילות",
  subscription_details: "פרטי מסלול",
  age_group_pricing: "מחירי קבוצות גיל",
  class_capacity_setup: "קיבולת כיתות",
  staff_setup: "הזמנת צוות",
  children_setup: "הוספת ילדים",
  parent_invitations: "הזמנת הורים",
  vacation_calendar: "לוח חופשות",
  weekly_schedule: "תוכנית שבועית",
  manager_profile: "פרופיל מנהלת",
  payment: "הסדרת מנוי",
  camera_readiness: "מוכנות מצלמות"
};

const requiredProgressFields = new Set(["kindergarten_name", "address", "phone", "documents"]);
const consentBlockers = new Set(["platform_terms", "privacy_terms"]);

export function onboardingReviewRequirements(blockers: string[], missingFields: string[], confirmed: boolean) {
  const unresolved = blockers.filter((blocker) => !confirmed || !consentBlockers.has(blocker));
  const required = [...new Set(unresolved.map((blocker) => blockerLabels[blocker] ?? "דרישת הפעלה נוספת"))];
  const optional = [...new Set(missingFields.filter((field) => !requiredProgressFields.has(field))
    .map((field) => optionalFieldLabels[field]).filter((label): label is string => Boolean(label)))];
  return { required, optional, canSubmit: confirmed && required.length === 0 };
}
