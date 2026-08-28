export const digitalObserverEdgeAiPolicy = {
  version: "local-insights-v1",
  processingLocation: "local_gateway",
  cloudPayload: "structured_insights_only",
  activeCapabilities: [
    "שידור ו-Playback דרך Gateway מקומי",
    "דגימת תנועה ותאורה מקומית",
    "יצירת thumbnail וקליפ לאירוע מאומת",
    "זיהוי עצמים מקומי רק לאחר חוזה Gateway והסכמת ניטור מאומתים",
    "AI Shadow עם ביקורת אנושית"
  ],
  unavailableCapabilities: [
    "זיהוי זהות פנים והתאמה ביומטרית כבויים עד מודל ייעודי, הסכמה לכל אדם וביקורת",
    "זיהוי שמע טרם הותקן או אומת ב-Edge",
    "Push חיצוני טרם הוגדר",
    "Voice וחיוג חירום אינם פעילים"
  ],
  retention: {
    frames: "פריימים לדגימה נשמרים בזיכרון בלבד ונמחקים מיד לאחר החישוב",
    clips: "קליפים ותמונות אירוע נשמרים רק לאירוע עם הסכמה ולכל היותר לפי חלון השמירה של האתר (עד 48 שעות)",
    insights: "לענן נשלחות תובנות מובנות ומדדי אמינות בלבד; וידאו גולמי אינו נשלח כנתון למידה"
  },
  consent: {
    monitoring: "נדרשת הסכמת ניטור מפורשת באתר",
    eventMedia: "העלאת מדיית אירוע דורשת הסכמה ומדיניות שמירה פעילה",
    biometrics: "זיהוי ביומטרי כבוי עד הסכמה נפרדת לכל אדם"
  }
} as const;

export function cameraReportsLocalEventInsights(camera: Record<string, any>) {
  const contract = camera.metadata?.edge_capability_contract;
  if (!contract || contract.version !== 1 || contract.gateway?.connected !== true) return false;
  if (contract.runtime?.available !== true || contract.models?.loaded !== true) return false;
  if (contract.hardware?.acceleration_available !== true || contract.capability_test?.passed !== true) return false;
  const policy = camera.metadata?.edge_policy;
  if (policy?.monitoring_consent_verified !== true || policy?.object_detection_enabled !== true) return false;
  return contract.capabilities?.object_detection === true;
}
