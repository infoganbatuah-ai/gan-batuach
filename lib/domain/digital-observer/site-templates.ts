export const observerSiteTemplateKeys = [
  "home",
  "kiosk",
  "retail",
  "office",
  "warehouse",
  "clinic",
  "restaurant",
  "child_education",
  "custom"
] as const;

export type ObserverSiteTemplateKey = (typeof observerSiteTemplateKeys)[number];

export type ObserverSiteTemplate = {
  key: ObserverSiteTemplateKey;
  label: string;
  description: string;
  defaultTargets: string[];
  childPrivacyRequired: boolean;
  policy: {
    humanReviewRequired: true;
    automaticEmergencyAction: false;
    highRiskEventsAreSuspicions: true;
  };
};

const sharedSafetyPolicy = {
  humanReviewRequired: true,
  automaticEmergencyAction: false,
  highRiskEventsAreSuspicions: true
} as const;

export const observerSiteTemplates: ObserverSiteTemplate[] = [
  { key: "home", label: "בית", description: "כניסה, חצר, אזור רגיש, בעלי חיים ובריאות מצלמה", defaultTargets: ["person", "unknown_person", "entry_exit", "vehicle", "animal", "distress", "camera_obstruction", "door_left_open"], childPrivacyRequired: false, policy: sharedSafetyPolicy },
  { key: "kiosk", label: "קיוסק", description: "ספקים, כניסה ויציאה, רכב חוסם, אזור סגור ושינוי בשגרה", defaultTargets: ["person", "unknown_person", "entry_exit", "vehicle", "restricted_area", "after_hours", "camera_obstruction", "suspected_theft", "suspected_violence", "suspected_robbery"], childPrivacyRequired: false, policy: sharedSafetyPolicy },
  { key: "retail", label: "חנות", description: "כניסות, אזורים, צפיפות וחשד לאירוע חריג", defaultTargets: ["person", "unknown_person", "entry_exit", "restricted_area", "crowding", "after_hours", "camera_obstruction", "suspected_theft", "suspected_violence"], childPrivacyRequired: false, policy: sharedSafetyPolicy },
  { key: "office", label: "משרד", description: "כניסה מורשית, אזורים רגישים ופעילות מחוץ לשעות", defaultTargets: ["person", "unknown_person", "entry_exit", "restricted_area", "after_hours", "camera_obstruction", "door_left_open"], childPrivacyRequired: false, policy: sharedSafetyPolicy },
  { key: "warehouse", label: "מחסן", description: "רכב, אזור מוגבל, פעילות לילה ובריאות מצלמות", defaultTargets: ["person", "unknown_person", "vehicle", "vehicle_tampering", "restricted_area", "after_hours", "camera_obstruction", "suspected_theft"], childPrivacyRequired: false, policy: sharedSafetyPolicy },
  { key: "clinic", label: "מרפאה", description: "כניסה, אזורים רגישים ומצוקה, ללא קביעה רפואית", defaultTargets: ["person", "unknown_person", "entry_exit", "restricted_area", "distress", "camera_obstruction"], childPrivacyRequired: false, policy: sharedSafetyPolicy },
  { key: "restaurant", label: "מסעדה", description: "כניסה, צפיפות, אזורים סגורים ופעילות לאחר שעות", defaultTargets: ["person", "unknown_person", "entry_exit", "crowding", "restricted_area", "after_hours", "camera_obstruction", "suspected_violence"], childPrivacyRequired: false, policy: sharedSafetyPolicy },
  { key: "child_education", label: "מסגרת ילדים", description: "שלד ותנועה בלבד, ללא זיהוי פנים או אודיו", defaultTargets: ["person", "entry_exit", "distress", "restricted_area", "crowding", "camera_obstruction", "door_left_open"], childPrivacyRequired: true, policy: sharedSafetyPolicy },
  { key: "custom", label: "עסק אחר", description: "בחירה ידנית של יעדי ניטור ומדיניות האתר", defaultTargets: ["person", "unknown_person", "entry_exit", "after_hours", "camera_obstruction"], childPrivacyRequired: false, policy: sharedSafetyPolicy }
];

export function getObserverSiteTemplate(key?: string | null) {
  return observerSiteTemplates.find((template) => template.key === key) ?? observerSiteTemplates.at(-1)!;
}

export function observerSiteTemplateLabel(key?: string | null) {
  return getObserverSiteTemplate(key).label;
}
