import { createHash } from "node:crypto";
import { z } from "zod";

export const DIGITAL_OBSERVER_WATCH_RULE_SCHEMA_VERSION = "do-watch-rule-v1";
export const DIGITAL_OBSERVER_WATCH_RULE_COMPILER_VERSION = "do-watch-compiler-v1";

export const WATCH_RULE_EVENT_TYPES = ["person_detected", "person_entered", "person_exited"] as const;
export const WATCH_RULE_DECISIONS = ["LOG_ONLY", "PRESERVE_EVIDENCE", "VERIFY", "NOTIFY_IN_APP"] as const;
export const WATCH_RULE_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type WatchRuleEventType = typeof WATCH_RULE_EVENT_TYPES[number];
export type WatchRuleDecision = typeof WATCH_RULE_DECISIONS[number];
export type WatchRuleDay = typeof WATCH_RULE_DAYS[number];
export type WatchRuleCompileStatus =
  | "READY_FOR_CONFIRMATION"
  | "NEEDS_CLARIFICATION"
  | "UNSUPPORTED_CAPABILITY"
  | "UNSUPPORTED_ACTION"
  | "INVALID";

export type WatchRuleCameraResource = {
  id: string;
  observerSiteId: string;
  name: string;
  locationLabel?: string | null;
  sourceMode?: string | null;
  zoneType?: string | null;
};

export type WatchRuleZoneResource = {
  id: string;
  observerSiteId: string;
  cameraSourceId?: string | null;
  name: string;
  zoneType?: string | null;
};

export type WatchRuleCompilerResources = {
  observerSiteId: string;
  timezone: string;
  cameras: WatchRuleCameraResource[];
  zones: WatchRuleZoneResource[];
  environment: "PRODUCTION" | "STAGING" | "TEST" | "DEMO";
};

export type CanonicalWatchRule = {
  schemaVersion: typeof DIGITAL_OBSERVER_WATCH_RULE_SCHEMA_VERSION;
  environment: WatchRuleCompilerResources["environment"];
  observerSiteId: string;
  intent: "ENTRY" | "EXIT" | "PRESENCE";
  target: {
    cameraSourceIds: string[];
    cameraLabels: string[];
    zoneIds: string[];
    zoneLabels: string[];
    objectType: "PERSON";
  };
  conditions: {
    eventTypes: WatchRuleEventType[];
    days: WatchRuleDay[];
    time: {
      mode: "ALWAYS" | "RANGE" | "AFTER" | "BEFORE" | "SITE_OFF_HOURS";
      start: string | null;
      end: string | null;
      timezone: string;
    };
    minimumDurationSeconds: number | null;
    direction: "ENTRY" | "EXIT" | "ANY";
    minimumDetectionConfidence: number | null;
  };
  policyIntent: {
    minimumDecision: WatchRuleDecision;
    minimumRiskBand: null;
    riskContribution: number;
    preserveEvidenceRequested: boolean;
    priority: "INFO" | "NORMAL" | "HIGH";
  };
  safety: {
    externalExecutionEnabled: false;
    recordingPolicyAuthoritative: true;
    requiresUserConfirmation: true;
    realCameraEventsOnly: true;
  };
};

export type WatchRuleCompileResult = {
  status: WatchRuleCompileStatus;
  originalText: string;
  candidate: CanonicalWatchRule | null;
  candidateFingerprint: string | null;
  compilerVersion: typeof DIGITAL_OBSERVER_WATCH_RULE_COMPILER_VERSION;
  validation: { valid: boolean; errors: string[] };
  clarification: { question: string; options: Array<{ id: string; label: string }> } | null;
  unsupported: { capability: string; explanation: string } | null;
  preview: {
    camera: string;
    event: string;
    time: string;
    days: string;
    duration: string;
    action: string;
    warning: string;
  } | null;
};

export type WatchRuleEventFacts = {
  observerSiteId: string;
  cameraSourceId: string;
  eventId: string;
  incidentId?: string | null;
  eventType: string;
  zoneId?: string | null;
  zoneType?: string | null;
  occurredAt: string;
  confidence?: number | null;
  incidentDurationSeconds?: number | null;
  withinExpectedHours?: boolean | null;
  provenance: string;
  validated: boolean;
};

export type WatchRuleEvaluation = {
  matched: boolean;
  matchedConditions: string[];
  nonMatchReasons: string[];
  inputFingerprint: string;
};

const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const canonicalWatchRuleSchema: z.ZodType<CanonicalWatchRule> = z.object({
  schemaVersion: z.literal(DIGITAL_OBSERVER_WATCH_RULE_SCHEMA_VERSION),
  environment: z.enum(["PRODUCTION", "STAGING", "TEST", "DEMO"]),
  observerSiteId: z.string().uuid(),
  intent: z.enum(["ENTRY", "EXIT", "PRESENCE"]),
  target: z.object({
    cameraSourceIds: z.array(z.string().uuid()).min(1).max(100),
    cameraLabels: z.array(z.string().min(1).max(160)).min(1).max(100),
    zoneIds: z.array(z.string().uuid()).max(100),
    zoneLabels: z.array(z.string().min(1).max(160)).max(100),
    objectType: z.literal("PERSON")
  }).strict(),
  conditions: z.object({
    eventTypes: z.array(z.enum(WATCH_RULE_EVENT_TYPES)).min(1).max(3),
    days: z.array(z.enum(WATCH_RULE_DAYS)).max(7),
    time: z.object({
      mode: z.enum(["ALWAYS", "RANGE", "AFTER", "BEFORE", "SITE_OFF_HOURS"]),
      start: z.string().regex(timePattern).nullable(),
      end: z.string().regex(timePattern).nullable(),
      timezone: z.string().min(1).max(80)
    }).strict(),
    minimumDurationSeconds: z.number().int().min(1).max(86_400).nullable(),
    direction: z.enum(["ENTRY", "EXIT", "ANY"]),
    minimumDetectionConfidence: z.number().min(0).max(1).nullable()
  }).strict(),
  policyIntent: z.object({
    minimumDecision: z.enum(WATCH_RULE_DECISIONS),
    minimumRiskBand: z.null(),
    riskContribution: z.number().int().min(0).max(20),
    preserveEvidenceRequested: z.boolean(),
    priority: z.enum(["INFO", "NORMAL", "HIGH"])
  }).strict(),
  safety: z.object({
    externalExecutionEnabled: z.literal(false),
    recordingPolicyAuthoritative: z.literal(true),
    requiresUserConfirmation: z.literal(true),
    realCameraEventsOnly: z.literal(true)
  }).strict()
}).strict();

function normalizeText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("he-IL")
    .replace(/[\u0591-\u05c7]/g, "")
    .replace(/[׳’`]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/[^\p{L}\p{N}:.'\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]));
  }
  return value;
}

export function watchRuleFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function hasAny(text: string, values: string[]) {
  return values.some((value) => text.includes(normalizeText(value)));
}

function hhmm(hourValue: string, minuteValue?: string) {
  let hour = Number(hourValue);
  const minute = Number(minuteValue ?? "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  if (hour === 24 && minute === 0) hour = 0;
  if (hour < 0 || hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseWatchRuleDuration(textValue: string) {
  const text = normalizeText(textValue);
  const match = text.match(/(?:יותר מ|מעל|למשך|for more than|for)\s*([0-9]{1,4})\s*(שניות?|שניה|דקות?|דקה|שעות?|שעה|seconds?|minutes?|hours?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = /שעה|שעות|hour/.test(unit) ? 3600 : /דקה|דקות|minute/.test(unit) ? 60 : 1;
  const seconds = amount * multiplier;
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 86_400 ? seconds : null;
}

function parseTime(text: string, timezone: string): CanonicalWatchRule["conditions"]["time"] {
  if (hasAny(text, ["בשעות שהעסק סגור", "מחוץ לשעות הפעילות", "outside business hours", "off hours"])) {
    return { mode: "SITE_OFF_HOURS", start: null, end: null, timezone };
  }
  const between = text.match(/(?:בין|מ|from)\s*(\d{1,2})(?::(\d{2}))?\s*(?:ל|עד|to|-)\s*(\d{1,2})(?::(\d{2}))?/);
  if (between) {
    const start = hhmm(between[1], between[2]);
    const end = hhmm(between[3], between[4]);
    if (start && end && start !== end) return { mode: "RANGE", start, end, timezone };
  }
  if (/מחצות\s*(?:עד|ל)\s*(\d{1,2})(?::(\d{2}))?/.test(text)) {
    const match = text.match(/מחצות\s*(?:עד|ל)\s*(\d{1,2})(?::(\d{2}))?/)!;
    const end = hhmm(match[1], match[2]);
    if (end) return { mode: "RANGE", start: "00:00", end, timezone };
  }
  const after = text.match(/(?:אחרי|החל מ|after)\s*(חצות|\d{1,2})(?::(\d{2}))?/);
  if (after) {
    const start = after[1] === "חצות" ? "00:00" : hhmm(after[1], after[2]);
    if (start) return { mode: "AFTER", start, end: null, timezone };
  }
  const before = text.match(/(?:לפני|עד|before)\s*(\d{1,2})(?::(\d{2}))?/);
  if (before) {
    const end = hhmm(before[1], before[2]);
    if (end) return { mode: "BEFORE", start: null, end, timezone };
  }
  return { mode: "ALWAYS", start: null, end: null, timezone };
}

function parseDays(text: string): WatchRuleDay[] {
  const days = new Set<WatchRuleDay>();
  const mapping: Array<[WatchRuleDay, string[]]> = [
    ["sun", ["יום ראשון", "בימי ראשון", "sunday"]],
    ["mon", ["יום שני", "בימי שני", "monday"]],
    ["tue", ["יום שלישי", "בימי שלישי", "tuesday"]],
    ["wed", ["יום רביעי", "בימי רביעי", "wednesday"]],
    ["thu", ["יום חמישי", "בימי חמישי", "thursday"]],
    ["fri", ["יום שישי", "בימי שישי", "friday"]],
    ["sat", ["יום שבת", "בשבת", "saturday"]]
  ];
  if (hasAny(text, ["סוף שבוע", "סופי שבוע", "weekend"])) ["fri", "sat"].forEach((day) => days.add(day as WatchRuleDay));
  for (const [day, aliases] of mapping) if (hasAny(text, aliases)) days.add(day);
  return [...days];
}

function cameraAliases(camera: WatchRuleCameraResource) {
  const values = [camera.name, camera.locationLabel ?? ""];
  const channel = `${camera.name} ${camera.locationLabel ?? ""}`.match(/(?:ערוץ|channel)\s*(\d{1,3})/i)?.[1];
  if (channel) values.push(`ערוץ ${channel}`, `channel ${channel}`);
  return [...new Set(values.map(normalizeText).filter((value) => value.length >= 2))];
}

function resolveCameras(text: string, resources: WatchRuleCompilerResources, explicitCameraSourceId?: string | null) {
  if (explicitCameraSourceId) {
    const camera = resources.cameras.find((item) => item.id === explicitCameraSourceId && item.observerSiteId === resources.observerSiteId);
    return camera ? { matches: [camera], explicit: true } : { matches: [], explicit: true };
  }
  if (hasAny(text, ["כל המצלמות", "בכל המצלמות", "כל מצלמה", "all cameras"])) {
    return { matches: resources.cameras, explicit: true };
  }
  const exact = resources.cameras.filter((camera) => cameraAliases(camera).some((alias) => alias.length >= 4 && text.includes(alias)));
  if (exact.length) return { matches: exact, explicit: true };
  const genericTokens = ["כניסה", "חניה", "חנייה", "מחסן", "משרד", "entrance", "parking", "storage", "office"];
  const referenced = genericTokens.filter((token) => text.includes(normalizeText(token)));
  if (referenced.length) {
    const generic = resources.cameras.filter((camera) => {
      const aliases = cameraAliases(camera);
      return referenced.some((token) => aliases.some((alias) => alias.includes(normalizeText(token))));
    });
    return { matches: generic, explicit: true };
  }
  return { matches: [], explicit: false };
}

function resolveZones(text: string, resources: WatchRuleCompilerResources, cameraIds: string[]) {
  const matches = resources.zones.filter((zone) => {
    if (zone.observerSiteId !== resources.observerSiteId) return false;
    if (zone.cameraSourceId && !cameraIds.includes(zone.cameraSourceId)) return false;
    const aliases = [zone.name, zone.zoneType ?? ""].map(normalizeText).filter((value) => value.length >= 3);
    return aliases.some((alias) => text.includes(alias));
  });
  return matches;
}

function explicitZoneReference(text: string) {
  const match = text.match(/(?:באזור|בתוך אזור|in zone)\s+([\p{L}\p{N}_-]{2,40})/u);
  return match?.[1] ?? null;
}

function result(status: WatchRuleCompileStatus, originalText: string, options: Partial<WatchRuleCompileResult> = {}): WatchRuleCompileResult {
  return {
    status,
    originalText,
    candidate: options.candidate ?? null,
    candidateFingerprint: options.candidateFingerprint ?? null,
    compilerVersion: DIGITAL_OBSERVER_WATCH_RULE_COMPILER_VERSION,
    validation: options.validation ?? { valid: false, errors: [] },
    clarification: options.clarification ?? null,
    unsupported: options.unsupported ?? null,
    preview: options.preview ?? null
  };
}

function previewFor(rule: CanonicalWatchRule): NonNullable<WatchRuleCompileResult["preview"]> {
  const event = rule.conditions.eventTypes[0] === "person_entered" ? "אדם נכנס"
    : rule.conditions.eventTypes[0] === "person_exited" ? "אדם יוצא" : "אדם מזוהה";
  const time = rule.conditions.time.mode === "ALWAYS" ? "בכל שעה"
    : rule.conditions.time.mode === "SITE_OFF_HOURS" ? "מחוץ לשעות הפעילות שהוגדרו באתר"
    : rule.conditions.time.mode === "AFTER" ? `אחרי ${rule.conditions.time.start}`
    : rule.conditions.time.mode === "BEFORE" ? `לפני ${rule.conditions.time.end}`
    : `${rule.conditions.time.start}–${rule.conditions.time.end}`;
  const decision = ({ LOG_ONLY: "שמירה ביומן", PRESERVE_EVIDENCE: "בקשה לשימור ראיה בכפוף למדיניות", VERIFY: "אימות", NOTIFY_IN_APP: "אימות ועדכון באפליקציה" } as const)[rule.policyIntent.minimumDecision];
  return {
    camera: rule.target.cameraLabels.join(", "),
    event,
    time,
    days: rule.conditions.days.length ? rule.conditions.days.join(", ") : "כל הימים",
    duration: rule.conditions.minimumDurationSeconds ? `${rule.conditions.minimumDurationSeconds} שניות לפחות` : "ללא תנאי משך",
    action: decision,
    warning: "הכלל טרם פעיל. הפעלה דורשת אישור מפורש ואינה מפעילה פעולה חיצונית."
  };
}

export function validateCanonicalWatchRule(ruleValue: unknown, resources: WatchRuleCompilerResources) {
  const parsed = canonicalWatchRuleSchema.safeParse(ruleValue);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`), rule: null };
  const rule = parsed.data;
  const errors: string[] = [];
  if (rule.observerSiteId !== resources.observerSiteId || rule.environment !== resources.environment) errors.push("RULE_SCOPE_MISMATCH");
  const cameraIds = new Set(resources.cameras.filter((camera) => camera.observerSiteId === resources.observerSiteId).map((camera) => camera.id));
  if (rule.target.cameraSourceIds.some((id) => !cameraIds.has(id))) errors.push("UNAUTHORIZED_CAMERA_REFERENCE");
  const zoneIds = new Set(resources.zones.filter((zone) => zone.observerSiteId === resources.observerSiteId).map((zone) => zone.id));
  if (rule.target.zoneIds.some((id) => !zoneIds.has(id))) errors.push("UNAUTHORIZED_ZONE_REFERENCE");
  if (rule.conditions.time.mode === "RANGE" && (!rule.conditions.time.start || !rule.conditions.time.end)) errors.push("INVALID_TIME_RANGE");
  if (rule.conditions.time.mode === "AFTER" && !rule.conditions.time.start) errors.push("INVALID_AFTER_TIME");
  if (rule.conditions.time.mode === "BEFORE" && !rule.conditions.time.end) errors.push("INVALID_BEFORE_TIME");
  if (rule.intent === "ENTRY" && !rule.conditions.eventTypes.includes("person_entered")) errors.push("INTENT_EVENT_MISMATCH");
  if (rule.intent === "EXIT" && !rule.conditions.eventTypes.includes("person_exited")) errors.push("INTENT_EVENT_MISMATCH");
  return { valid: errors.length === 0, errors, rule: errors.length ? null : rule };
}

export function compileNaturalLanguageWatchRule(input: {
  text: string;
  resources: WatchRuleCompilerResources;
  explicitCameraSourceId?: string | null;
}): WatchRuleCompileResult {
  const originalText = input.text.trim();
  if (originalText.length < 3 || originalText.length > 1200) return result("INVALID", originalText, { validation: { valid: false, errors: ["INVALID_TEXT_LENGTH"] } });
  const text = normalizeText(originalText);
  if (hasAny(text, ["ignore all previous", "ignore previous instructions", "system prompt", "developer message", "drop table", "select * from", "curl ", "fetch(", "api key", "service role", "עקוף הרשאות", "התעלם מכל ההוראות", "הצג מצלמות של משתמש אחר"]) || /https?:\/\//i.test(originalText)) {
    return result("UNSUPPORTED_ACTION", originalText, { unsupported: { capability: "PROMPT_OR_COMMAND_INJECTION", explanation: "הטקסט יכול למלא רק שדות בכלל ניטור מוגבל; פקודות, כתובות URL וגישה למידע אחר אינן מורשות." } });
  }
  const unsafeAction = [
    ["PHYSICAL_CONTROL", ["תפתח את הדלת", "פתח את הדלת", "תחסום את המעלית", "unlock the door", "open the door", "stop the elevator"]],
    ["EXTERNAL_EMERGENCY_ACTION", ["תחייג למשטרה", "תתקשר למשטרה", "call the police", "call emergency"]],
    ["ARBITRARY_WEBHOOK", ["webhook", "שלח לכתובת", "post to"]]
  ] as const;
  for (const [capability, aliases] of unsafeAction) if (hasAny(text, [...aliases])) {
    return result("UNSUPPORTED_ACTION", originalText, { unsupported: { capability, explanation: "הפעולה המבוקשת אינה פעולה מאושרת של כלל ניטור ואינה תבוצע מהטקסט." } });
  }
  const unsupportedCapabilities = [
    ["EMOTION_OR_INTENT", ["עצבני", "כועס", "חשוד", "suspicious", "angry", "nervous"]],
    ["FACE_RECOGNITION", ["זהה פנים", "מי האדם", "face recognition", "recognize face"]],
    ["LICENSE_PLATE_RECOGNITION", ["לוחית רישוי", "מספר רכב", "license plate"]],
    ["WEAPON_DETECTION", ["נשק", "אקדח", "weapon", "gun"]],
    ["AUDIO_SEMANTICS", ["צעקה", "שמע", "audio", "scream"]],
    ["VEHICLE_EVENT", ["רכב", "מכונית", "אופנוע", "vehicle", "car", "motorcycle"]]
  ] as const;
  for (const [capability, aliases] of unsupportedCapabilities) if (hasAny(text, [...aliases])) {
    return result("UNSUPPORTED_CAPABILITY", originalText, { unsupported: { capability, explanation: "אין כרגע Event קנוני מאומת שמסוגל לבצע את הבקשה הזאת ב־Production, ולכן לא נוצר כלל מדומה." } });
  }

  const intent: CanonicalWatchRule["intent"] = hasAny(text, ["יוצא", "יצא", "יציאה", "עוזב", "exits", "leaves"]) ? "EXIT"
    : hasAny(text, ["נכנס", "כניסה", "מגיע דרך", "enters", "entry"]) ? "ENTRY"
    : hasAny(text, ["אדם", "מישהו", "person", "someone"]) ? "PRESENCE" : "PRESENCE";
  if (!hasAny(text, ["אדם", "מישהו", "person", "someone", "נכנס", "יוצא", "כניסה", "יציאה"])) {
    return result("UNSUPPORTED_CAPABILITY", originalText, { unsupported: { capability: "UNKNOWN_EVENT_INTENT", explanation: "אפשר כרגע להגדיר כללים עבור אדם שזוהה, נכנס או יצא בלבד." } });
  }
  const duration = parseWatchRuleDuration(text);
  if (hasAny(text, ["נשאר", "שהייה", "dwell", "remains"]) && duration) {
    return result("UNSUPPORTED_CAPABILITY", originalText, { unsupported: { capability: "LIVE_DWELL_EVENT", explanation: "המערכת יודעת לחשב משך בתקרית, אך עדיין אין Event חי קנוני שמפעיל כלל שהייה בזמן אמת. המשך זוהה אך הכלל לא יופעל באופן מדומה." } });
  }
  if (intent === "PRESENCE") {
    return result("UNSUPPORTED_CAPABILITY", originalText, { unsupported: { capability: "PERSON_PRESENCE_WITHOUT_CANONICAL_INCIDENT", explanation: "זיהוי אדם נשמר כאירוע עובדתי, אך עדיין אינו Event מפעיל-תקרית עבור כלל Production. אפשר כרגע להגדיר כלל כניסה או יציאה בלבד." } });
  }

  const cameraResolution = resolveCameras(text, input.resources, input.explicitCameraSourceId);
  if (cameraResolution.explicit && cameraResolution.matches.length === 0) {
    return result("INVALID", originalText, { validation: { valid: false, errors: ["UNAUTHORIZED_OR_UNKNOWN_CAMERA"] } });
  }
  if (!cameraResolution.explicit) {
    return result("NEEDS_CLARIFICATION", originalText, {
      clarification: { question: "באיזו מצלמה תרצו להפעיל את הכלל?", options: input.resources.cameras.map((camera) => ({ id: camera.id, label: camera.name })) }
    });
  }
  if (cameraResolution.matches.length > 1 && !hasAny(text, ["כל המצלמות", "בכל המצלמות", "all cameras"])) {
    return result("NEEDS_CLARIFICATION", originalText, {
      clarification: { question: "מצאתי יותר ממצלמה אחת שמתאימה לתיאור. באיזו מצלמה מדובר?", options: cameraResolution.matches.map((camera) => ({ id: camera.id, label: camera.name })) }
    });
  }
  const cameras = cameraResolution.matches;
  const zones = resolveZones(text, input.resources, cameras.map((camera) => camera.id));
  const requestedZone = explicitZoneReference(text);
  if (requestedZone && zones.length === 0) {
    const available = input.resources.zones
      .filter((zone) => zone.observerSiteId === input.resources.observerSiteId && (!zone.cameraSourceId || cameras.some((camera) => camera.id === zone.cameraSourceId)))
      .map((zone) => ({ id: zone.id, label: zone.name }));
    return result("NEEDS_CLARIFICATION", originalText, {
      clarification: {
        question: `לא נמצא אזור מורשה בשם “${requestedZone}”. איזה אזור התכוונתם?`,
        options: available
      }
    });
  }
  const time = parseTime(text, input.resources.timezone);
  const days = parseDays(text);
  const minimumDecision: WatchRuleDecision = hasAny(text, ["תודיע", "תתריע", "התראה", "notify", "alert"]) ? "NOTIFY_IN_APP"
    : hasAny(text, ["שמור ראיה", "שמור הקלטה", "preserve evidence"]) ? "PRESERVE_EVIDENCE"
    : hasAny(text, ["בדוק", "תבדוק", "אמת", "verify", "watch"]) ? "VERIFY" : "LOG_ONLY";
  const priority = hasAny(text, ["דחוף", "urgent", "חשוב מאוד"]) ? "HIGH" : minimumDecision === "LOG_ONLY" ? "INFO" : "NORMAL";
  const eventType: WatchRuleEventType = intent === "ENTRY" ? "person_entered" : intent === "EXIT" ? "person_exited" : "person_detected";
  const candidate: CanonicalWatchRule = {
    schemaVersion: DIGITAL_OBSERVER_WATCH_RULE_SCHEMA_VERSION,
    environment: input.resources.environment,
    observerSiteId: input.resources.observerSiteId,
    intent,
    target: {
      cameraSourceIds: cameras.map((camera) => camera.id),
      cameraLabels: cameras.map((camera) => camera.name),
      zoneIds: zones.map((zone) => zone.id),
      zoneLabels: zones.map((zone) => zone.name),
      objectType: "PERSON"
    },
    conditions: {
      eventTypes: [eventType],
      days,
      time,
      minimumDurationSeconds: duration,
      direction: intent === "ENTRY" ? "ENTRY" : intent === "EXIT" ? "EXIT" : "ANY",
      minimumDetectionConfidence: null
    },
    policyIntent: {
      minimumDecision,
      minimumRiskBand: null,
      riskContribution: minimumDecision === "LOG_ONLY" ? 3 : 8,
      preserveEvidenceRequested: minimumDecision === "PRESERVE_EVIDENCE",
      priority
    },
    safety: {
      externalExecutionEnabled: false,
      recordingPolicyAuthoritative: true,
      requiresUserConfirmation: true,
      realCameraEventsOnly: true
    }
  };
  const validation = validateCanonicalWatchRule(candidate, input.resources);
  if (!validation.valid) return result("INVALID", originalText, { candidate, validation: { valid: false, errors: validation.errors } });
  return result("READY_FOR_CONFIRMATION", originalText, {
    candidate,
    candidateFingerprint: watchRuleFingerprint(candidate),
    validation: { valid: true, errors: [] },
    preview: previewFor(candidate)
  });
}

function localParts(timestamp: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestamp));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const day = value("weekday").slice(0, 3).toLowerCase() as WatchRuleDay;
  return { day, minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}

function timeMinutes(value: string | null) {
  if (!value || !timePattern.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function evaluateCanonicalWatchRule(rule: CanonicalWatchRule, event: WatchRuleEventFacts): WatchRuleEvaluation {
  const matchedConditions: string[] = [];
  const nonMatchReasons: string[] = [];
  if (rule.environment === "PRODUCTION" && (event.provenance !== "REAL_CAMERA_AI" || !event.validated)) nonMatchReasons.push("UNTRUSTED_PRODUCTION_PROVENANCE");
  else if (rule.environment === "PRODUCTION") matchedConditions.push("REAL_CAMERA_AI");
  if (rule.observerSiteId !== event.observerSiteId) nonMatchReasons.push("WRONG_SITE"); else matchedConditions.push("SITE");
  if (!rule.target.cameraSourceIds.includes(event.cameraSourceId)) nonMatchReasons.push("WRONG_CAMERA"); else matchedConditions.push("CAMERA");
  if (!rule.conditions.eventTypes.includes(event.eventType as WatchRuleEventType)) nonMatchReasons.push("EVENT_TYPE_INCOMPATIBLE"); else matchedConditions.push("EVENT_TYPE");
  if (rule.target.zoneIds.length && (!event.zoneId || !rule.target.zoneIds.includes(event.zoneId))) nonMatchReasons.push("WRONG_ZONE");
  else if (rule.target.zoneIds.length) matchedConditions.push("ZONE");
  if (rule.conditions.minimumDetectionConfidence != null && (event.confidence == null || event.confidence < rule.conditions.minimumDetectionConfidence)) nonMatchReasons.push("CONFIDENCE_BELOW_FLOOR");
  else if (rule.conditions.minimumDetectionConfidence != null) matchedConditions.push("CONFIDENCE");
  if (rule.conditions.minimumDurationSeconds != null && (event.incidentDurationSeconds == null || event.incidentDurationSeconds < rule.conditions.minimumDurationSeconds)) nonMatchReasons.push("DURATION_TOO_SHORT");
  else if (rule.conditions.minimumDurationSeconds != null) matchedConditions.push("DURATION");
  if (!Number.isFinite(Date.parse(event.occurredAt))) nonMatchReasons.push("INVALID_EVENT_TIME");
  else {
    const local = localParts(event.occurredAt, rule.conditions.time.timezone);
    if (rule.conditions.days.length && !rule.conditions.days.includes(local.day)) nonMatchReasons.push("WRONG_DAY");
    else if (rule.conditions.days.length) matchedConditions.push("DAY");
    const start = timeMinutes(rule.conditions.time.start);
    const end = timeMinutes(rule.conditions.time.end);
    const timeMatches = rule.conditions.time.mode === "ALWAYS"
      || (rule.conditions.time.mode === "SITE_OFF_HOURS" && event.withinExpectedHours === false)
      || (rule.conditions.time.mode === "AFTER" && start != null && local.minutes >= start)
      || (rule.conditions.time.mode === "BEFORE" && end != null && local.minutes < end)
      || (rule.conditions.time.mode === "RANGE" && start != null && end != null
        && (start < end ? local.minutes >= start && local.minutes < end : local.minutes >= start || local.minutes < end));
    if (!timeMatches) nonMatchReasons.push(rule.conditions.time.mode === "SITE_OFF_HOURS" ? "WITHIN_EXPECTED_HOURS" : "OUTSIDE_RULE_TIME");
    else if (rule.conditions.time.mode !== "ALWAYS") matchedConditions.push("TIME");
  }
  const inputFingerprint = watchRuleFingerprint({ rule: watchRuleFingerprint(rule), event: event.eventId, facts: event });
  return { matched: nonMatchReasons.length === 0, matchedConditions, nonMatchReasons, inputFingerprint };
}

export function watchRequestPriority(rule: CanonicalWatchRule) {
  return rule.policyIntent.priority === "HIGH" ? 8 : rule.policyIntent.priority === "NORMAL" ? 5 : 3;
}

export function watchRequestType(rule: CanonicalWatchRule) {
  if (rule.conditions.time.mode === "SITE_OFF_HOURS" && rule.intent === "ENTRY") return "after_hours_activity";
  return rule.intent === "ENTRY" ? "restricted_area_entry" : "movement_in_area";
}

export function isCanonicalCompiledRule(value: unknown): value is CanonicalWatchRule {
  return canonicalWatchRuleSchema.safeParse(value).success;
}

export function isUuid(value: string) {
  return uuidPattern.test(value);
}
