export const observerConversationCatalog = [
  { id: "read_status", label: "מצב המקורות והכיסוי", effect: "read" },
  { id: "search_events", label: "חיפוש באירועים השמורים", effect: "read" },
  { id: "guide_navigation", label: "פתיחת המסך המתאים", effect: "read" },
  { id: "save_watch", label: "שמירת הנחיית תצפית", effect: "save" },
  { id: "prepare_camera_action", label: "הכנת פעולת מצלמה לאישור מיידי", effect: "confirmation_only" }
] as const;

export type ObserverConversationIntent = (typeof observerConversationCatalog)[number]["id"] | "clarify_action";
export type CameraActionOffer = { action_type: string; capability: string; label: string; parameters: Record<string, string | number> };

export function parseObserverConversationIntent(input: string): { intent: ObserverConversationIntent; physical: CameraActionOffer | null } {
  const text = input.trim().toLowerCase().replace(/^(?:בבקשה|אנא)\s+/, "");
  if (/^(?:איך|איפה|כיצד|פתח|הצג)(?:\s|$)/.test(text) && /הגדר|הסכמ|מאושר|דייר|כלל|מצלמ|מקליט|dvr|nvr|מחק|איפוס/.test(text)) return { intent: "guide_navigation", physical: null };
  if (/^(?:שים לב|תעקוב|עקוב|תתריע|התרע|תבדוק מעכשיו|שמור הנחיה)(?:\s|$)/.test(text)) return { intent: "save_watch", physical: null };
  const command = /^(?:הפעל|תפעיל|כבה|תכבה|הזז|תזיז|סובב|פתח דיבור)(?:\s|$)/.test(text);
  if (command) {
    // Compound/automatic instructions require clarification, not an inferred
    // direction or a physical action hidden inside a natural-language question.
    if (/[?？]|אוטומטי|בכל פעם|אם |כאשר |כש|בעוד|מחר| וגם | ואז | ולאחר/.test(text)) return { intent: "clarify_action", physical: null };
    const off = /^(?:כבה|תכבה)/.test(text);
    const kinds = [/(?:סירנה|אזעקה)/.test(text), /(?:אור|תאורה)/.test(text), /(?:דיבור|כריזה)/.test(text), /(?:מצלמה|ptz)/.test(text) && /^(?:הזז|תזיז|סובב)/.test(text)];
    if (kinds.filter(Boolean).length !== 1) return { intent: "clarify_action", physical: null };
    if (kinds[0]) return { intent: "prepare_camera_action", physical: { action_type: off ? "siren_off" : "siren_on", capability: "siren", label: off ? "כיבוי סירנה" : "הפעלת סירנה ל-5 שניות", parameters: off ? {} : { duration_seconds: 5 } } };
    if (kinds[1]) return { intent: "prepare_camera_action", physical: { action_type: off ? "light_off" : "light_on", capability: "light", label: off ? "כיבוי תאורה" : "הפעלת תאורה", parameters: {} } };
    if (kinds[2] && !off) return { intent: "prepare_camera_action", physical: { action_type: "talkback", capability: "talkback", label: "פתיחת דיבור דו-כיווני", parameters: {} } };
    const directions = [["שמאלה", "left"], ["ימינה", "right"]].filter(([word]) => text.includes(word));
    if (kinds[3] && directions.length === 1) return { intent: "prepare_camera_action", physical: { action_type: "ptz_pan", capability: "ptz", label: `הזזת המצלמה ${directions[0][0]}`, parameters: { direction: directions[0][1], duration_ms: 350 } } };
    return { intent: "clarify_action", physical: null };
  }
  return { intent: /מצב|סטטוס|הכול בסדר|כיסוי/.test(text) ? "read_status" : "search_events", physical: null };
}

export function observerConversationLinks(siteId: string, cameraId: string | undefined, eventIds: string[]) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(siteId) || (cameraId && !uuid.test(cameraId))) return [];
  const site = encodeURIComponent(siteId);
  const camera = cameraId ? `&camera=${encodeURIComponent(cameraId)}` : "";
  return [
    { label: cameraId ? "פתיחת המצלמה" : "כל המצלמות", href: `/digital-observer/cameras?site=${site}${camera}` },
    { label: "יומן האירועים", href: `/digital-observer/alerts?site=${site}${camera}` },
    ...eventIds.filter((id) => uuid.test(id)).slice(0, 3).map((id, index) => ({ label: `ראיה לאירוע ${index + 1}`, href: `/digital-observer/alerts?site=${site}&event=${encodeURIComponent(id)}` })),
    { label: "התצפיתן וההנחיות", href: `/digital-observer/rules?site=${site}` },
    { label: "אנשים והסכמות זיהוי", href: `/digital-observer/people?site=${site}` },
    { label: "הגדרות והסכמות", href: `/digital-observer/settings?site=${site}` },
    { label: "הוספת מצלמות או מקליט", href: `/digital-observer/cameras/add?site=${site}` }
  ];
}

export function verifiedConversationActionEvidence(camera: Record<string, any>, capability: string, now = Date.now()) {
  if (!["connected", "healthy"].includes(String(camera.status ?? camera.health_status))) return null;
  const evidence = camera.capabilities?.capability_evidence?.[capability] ?? camera.metadata?.channel_capabilities?.[capability];
  const testedAt = Date.parse(String(evidence?.tested_at ?? ""));
  return evidence?.supported === true && Boolean(evidence.adapter) && Boolean(evidence.method)
    && evidence.method !== "not_tested" && Number.isFinite(testedAt)
    && testedAt <= now && now - testedAt <= 24 * 60 * 60 * 1000 ? evidence : null;
}
