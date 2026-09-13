export const kindergartenAgeGroups = [
  {
    key: "INFANT",
    label: "תינוקות",
    range: "3-15 חודשים",
  },
  {
    key: "TODDLER_YOUNG",
    label: "פעוטות צעירים",
    range: "16-24 חודשים",
  },
  {
    key: "TODDLER_MATURE",
    label: "פעוטות בוגרים",
    range: "25-36 חודשים",
  },
  {
    key: "KINDERGARTEN",
    label: "גן",
    range: "3+ שנים",
  }
] as const;

export type KindergartenAgeGroupKey = (typeof kindergartenAgeGroups)[number]["key"];

export const israeliCityStreetMap: Record<string, string[]> = {
  "תל אביב-יפו": ["דיזנגוף", "אבן גבירול", "ויצמן", "יהודה הלוי", "אלנבי"],
  "ירושלים": ["יפו", "עמק רפאים", "הרצל", "קרן היסוד", "דרך חברון"],
  "חיפה": ["מוריה", "הרצל", "הנשיא", "דרך הים", "חלוצי התעשייה"],
  "ראשון לציון": ["הרצל", "רוטשילד", "ז'בוטינסקי", "הכרמל", "שדרות ירושלים"],
  "פתח תקווה": ["חיים עוזר", "ז'בוטינסקי", "רוטשילד", "ההסתדרות", "העצמאות"],
  "באר שבע": ["רגר", "העצמאות", "טוביהו", "המשחררים", "התקווה"],
  "נתניה": ["הרצל", "ויצמן", "בן צבי", "שדרות בנימין", "סמילנסקי"],
  "רמת גן": ["ביאליק", "ז'בוטינסקי", "הרא\"ה", "בן גוריון", "קריניצי"],
  "אשדוד": ["הרצל", "בני ברית", "שדרות ירושלים", "הציונות", "רוגוזין"],
  "הרצליה": ["סוקולוב", "בן גוריון", "הנשיא", "מדינת היהודים", "משכית"]
};

export const operationalDistricts = ["צפון", "חיפה", "מרכז", "תל אביב", "ירושלים", "דרום", "אחר", "לא ידוע"] as const;

const cityDistrictMap: Record<string, (typeof operationalDistricts)[number]> = {
  "תל אביב-יפו": "תל אביב",
  "רמת גן": "תל אביב",
  "הרצליה": "תל אביב",
  "ירושלים": "ירושלים",
  "חיפה": "חיפה",
  "ראשון לציון": "מרכז",
  "פתח תקווה": "מרכז",
  "נתניה": "מרכז",
  "אשדוד": "דרום",
  "באר שבע": "דרום"
};

export function knownKindergartenCities() {
  return Object.keys(israeliCityStreetMap);
}

export function operationalDistrictForCity(city?: string | null) {
  const normalized = String(city ?? "").trim();
  if (!normalized) return "לא ידוע";
  return cityDistrictMap[normalized] ?? "לא ידוע";
}

export const regulatoryAcceptanceItems = [
  { key: "platform_terms", label: "תנאי שימוש במערכת" },
  { key: "privacy_terms", label: "תנאי פרטיות ושמירת מידע" },
  { key: "camera_rules", label: "כללי מצלמות, ללא שמע ובהרשאות בלבד" },
  { key: "child_safety_terms", label: "כללי בטיחות ילדים וחובת דיווח" },
  { key: "regulatory_declaration", label: "הצהרה רגולטורית ואחריות מנהלת" },
  { key: "service_charter", label: "אמנת השירות של גן בטוח" }
] as const;

export const activationWizardSteps = [
  "garden_details",
  "groups_and_staff",
  "trial_and_payment_readiness",
  "children_and_parent_invitations_optional",
  "activation_confirmation"
] as const;

export const managerRegistrationSteps = [
  { key: "garden_details", label: "פרטי הגן" },
  { key: "groups_and_staff", label: "קבוצות וצוות" },
  { key: "trial_and_payment_readiness", label: "סיכום ותשלום" },
  { key: "children_and_parent_invitations_optional", label: "ילדים והורים" },
  { key: "activation_confirmation", label: "השלמת הקמה" }
] as const;

export const ganBatuachTrialDays = 14;

export const requiredKindergartenDocumentCategories = [
  "ownership_legal_entity",
  "legal_management_authorization",
  "first_aid_22_hours",
  "safe_conduct_course",
  "educational_mentor_agreement",
  "building_yard_safety_report",
  "minimum_space_confirmation",
  "local_authority_operating_permit",
  "fire_department_approval",
  "shelter_approval",
  "cctv_installation_declaration",
  "no_audio_declaration",
  "camera_coverage_declaration"
] as const;
