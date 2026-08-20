export const kindergartenAgeGroups = [
  {
    key: "INFANT",
    label: "תינוקות",
    range: "3-15 חודשים",
    maxChildrenPerClass: 15,
    staffRatio: 6,
    rule: "איש צוות אחד לכל 6 תינוקות"
  },
  {
    key: "TODDLER_YOUNG",
    label: "פעוטות צעירים",
    range: "16-24 חודשים",
    maxChildrenPerClass: 22,
    staffRatio: 9,
    rule: "איש צוות אחד לכל 9 פעוטות"
  },
  {
    key: "TODDLER_MATURE",
    label: "פעוטות בוגרים",
    range: "25-36 חודשים",
    maxChildrenPerClass: 27,
    staffRatio: 11,
    rule: "איש צוות אחד לכל 11 ילדים"
  },
  {
    key: "KINDERGARTEN",
    label: "גן",
    range: "3+ שנים",
    maxChildrenPerClass: 35,
    staffRatio: 17.5,
    rule: "2 אנשי צוות לכיתה מלאה"
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

export function calculateRequiredStaff(ageGroupKey: string, childCount: number) {
  const group = kindergartenAgeGroups.find((item) => item.key === ageGroupKey);
  if (!group) return 0;
  if (group.key === "KINDERGARTEN") return childCount > 0 ? Math.max(1, Math.ceil((childCount / group.maxChildrenPerClass) * 2)) : 0;
  return Math.ceil(childCount / group.staffRatio);
}

export function validateClassCapacity(ageGroupKey: string, childCount: number) {
  const group = kindergartenAgeGroups.find((item) => item.key === ageGroupKey);
  if (!group) return { ok: false, message: "קבוצת גיל לא מוכרת" };
  if (childCount > group.maxChildrenPerClass) {
    return { ok: false, message: `בקבוצת ${group.label} ניתן להגדיר עד ${group.maxChildrenPerClass} ילדים בכיתה.` };
  }
  return { ok: true, message: "הקיבולת עומדת בכלל הבסיסי." };
}

export function calculateGanBatuachMonthlyPrice(classCount: number) {
  if (classCount <= 0) return 0;
  return 700 + Math.max(0, classCount - 1) * 200;
}
