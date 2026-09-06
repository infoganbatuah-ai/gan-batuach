import { z } from "zod";

export const DIGITAL_OBSERVER_INVESTIGATION_SCHEMA_VERSION = "do-investigation-query-v1";
export const DIGITAL_OBSERVER_INVESTIGATION_COMPILER_VERSION = "do-investigation-compiler-v1";

export const INVESTIGATION_EVENT_TYPES = ["person_detected", "person_entered", "person_exited", "camera_offline", "camera_reconnected"] as const;
export const INVESTIGATION_RISK_BANDS = ["LOW", "GUARDED", "ELEVATED", "HIGH", "CRITICAL"] as const;
export const INVESTIGATION_DECISIONS = ["IGNORE", "LOG_ONLY", "PRESERVE_EVIDENCE", "VERIFY", "NOTIFY_IN_APP", "ESCALATION_CANDIDATE"] as const;
export const INVESTIGATION_VERIFICATION_STATES = ["UNVERIFIED", "LIKELY", "CONFIRMED", "UNCERTAIN", "REJECTED_FALSE_POSITIVE", "RESOLVED"] as const;
export const INVESTIGATION_FEEDBACK_LABELS = ["TRUE_SECURITY_EVENT", "TRUE_EXPECTED_ACTIVITY", "FALSE_DETECTION", "FALSE_CORRELATION", "FALSE_SPATIAL_EVENT", "UNCERTAIN", "OTHER"] as const;
export const INVESTIGATION_EVIDENCE_STATES = ["AVAILABLE", "NO_RECORDING_BY_POLICY", "EXPIRED", "FAILED", "UNAVAILABLE"] as const;
export const INVESTIGATION_PROVENANCE = ["REAL_CAMERA_AI", "CAMERA_NATIVE_EVENT"] as const;

export type InvestigationCameraResource = {
  id: string;
  observerSiteId: string;
  name: string;
  locationLabel?: string | null;
  streamId?: string | null;
  aliases?: readonly string[];
  zones?: readonly { id?: string | null; name: string; aliases?: readonly string[] }[];
};

export type InvestigationCompilerContext = {
  observerSiteId: string;
  timeZone: string;
  cameras: readonly InvestigationCameraResource[];
  now?: Date;
};

const querySchema = z.object({
  schemaVersion: z.literal(DIGITAL_OBSERVER_INVESTIGATION_SCHEMA_VERSION),
  observerSiteId: z.string().uuid(),
  timeZone: z.string().min(1).max(100),
  fromInclusive: z.string().datetime({ offset: true }),
  toExclusive: z.string().datetime({ offset: true }),
  dailyTimeWindow: z.object({ fromMinute: z.number().int().min(0).max(1439), toMinute: z.number().int().min(1).max(1440), overnight: z.boolean() }).strict().nullable(),
  cameraSourceIds: z.array(z.string().uuid()).max(25),
  zoneNames: z.array(z.string().min(1).max(200)).max(25),
  eventTypes: z.array(z.enum(INVESTIGATION_EVENT_TYPES)).max(INVESTIGATION_EVENT_TYPES.length),
  detectionConfidenceMin: z.number().min(0).max(1).nullable(),
  incidentStatuses: z.array(z.enum(["open", "acknowledged", "resolved", "closed"])).max(4),
  riskBands: z.array(z.enum(INVESTIGATION_RISK_BANDS)).max(INVESTIGATION_RISK_BANDS.length),
  riskScore: z.object({ min: z.number().int().min(0).max(100), max: z.number().int().min(0).max(100) }).strict().nullable(),
  verificationStates: z.array(z.enum(INVESTIGATION_VERIFICATION_STATES)).max(INVESTIGATION_VERIFICATION_STATES.length),
  decisions: z.array(z.enum(INVESTIGATION_DECISIONS)).max(INVESTIGATION_DECISIONS.length),
  evidenceStates: z.array(z.enum(INVESTIGATION_EVIDENCE_STATES)).max(INVESTIGATION_EVIDENCE_STATES.length),
  feedbackLabels: z.array(z.enum(INVESTIGATION_FEEDBACK_LABELS)).max(INVESTIGATION_FEEDBACK_LABELS.length),
  trackId: z.string().uuid().nullable(),
  watchRuleMatched: z.boolean().nullable(),
  scopes: z.array(z.enum(["EVENTS", "INCIDENTS"])).min(1).max(2),
  provenance: z.array(z.enum(INVESTIGATION_PROVENANCE)).min(1).max(2),
  latestOnly: z.boolean(),
  pagination: z.object({ cursor: z.number().int().min(0).max(500), limit: z.number().int().min(1).max(25) }).strict(),
  ranking: z.literal("EXACT_FILTERS_THEN_RECENCY"),
  readOnly: z.literal(true),
  rawSqlAllowed: z.literal(false)
}).strict();

export type CanonicalInvestigationQuery = z.infer<typeof querySchema>;
export type InvestigationCompileStatus = "READY" | "NEEDS_CLARIFICATION" | "UNSUPPORTED_CAPABILITY" | "UNSAFE_QUERY" | "INVALID";
export type InvestigationCompileResult = {
  status: InvestigationCompileStatus;
  compilerVersion: string;
  originalQuestion: string;
  query: CanonicalInvestigationQuery | null;
  preview: { scope: string; cameras: string; period: string; filters: string } | null;
  clarification: { question: string; choices: { id: string; label: string }[] } | null;
  limitation: { code: string; explanation: string } | null;
  validation: { valid: boolean; errors: string[] };
};

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("he-IL").replace(/[־–—]/g, "-").replace(/\s+/g, " ").trim();
}

function result(status: InvestigationCompileStatus, question: string, values: Partial<InvestigationCompileResult> = {}): InvestigationCompileResult {
  return {
    status,
    compilerVersion: DIGITAL_OBSERVER_INVESTIGATION_COMPILER_VERSION,
    originalQuestion: question,
    query: null,
    preview: null,
    clarification: null,
    limitation: null,
    validation: { valid: status === "READY", errors: [] },
    ...values
  };
}

function localFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

function localParts(formatter: Intl.DateTimeFormat, instant: number) {
  const values = Object.fromEntries(formatter.formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute };
}

function dateString(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 2100 || date.toISOString().slice(0, 10) !== value) throw new Error("INVESTIGATION_INVALID_DATE");
  return { year, month, day };
}

function shiftDate(value: string, days: number) {
  const { year, month, day } = dateParts(value);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Resolve one local wall-clock instant. DST gaps and repeated times fail rather than guess. */
function wallTime(dateValue: string, minuteOfDay: number, formatter: Intl.DateTimeFormat) {
  const { year, month, day } = dateParts(dateValue);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set<number>();
  for (const deltaHours of [-36, -12, 0, 12, 36]) {
    const instant = target + deltaHours * 3_600_000;
    const local = localParts(formatter, instant);
    offsets.add(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - instant);
  }
  const matches = [...offsets].map((offset) => target - offset).filter((instant) => {
    const local = localParts(formatter, instant);
    return local.year === year && local.month === month && local.day === day && local.hour === hour && local.minute === minute;
  });
  if (matches.length !== 1) throw new Error(matches.length ? "INVESTIGATION_AMBIGUOUS_LOCAL_TIME" : "INVESTIGATION_NONEXISTENT_LOCAL_TIME");
  return matches[0];
}

function minuteValue(raw: string) {
  const [hour, minute = "0"] = raw.split(":");
  const value = Number(hour) * 60 + Number(minute);
  if (!Number.isInteger(value) || value < 0 || value >= 1440) throw new Error("INVESTIGATION_INVALID_TIME");
  return value;
}

function parseTimes(text: string) {
  return [...text.matchAll(/(?:^|[^\d])(\d{1,2})(?::([0-5]\d))(?=$|[^\d])/gu)].map((match) => minuteValue(`${match[1]}:${match[2]}`));
}

function parseRelativeHours(text: string) {
  if (/בשעתיים האחרונות|last two hours/u.test(text)) return 2;
  if (/בשעה האחרונה|last hour/u.test(text)) return 1;
  const match = text.match(/(?:ב|במהלך )?(\d{1,2})\s*שעות?\s*האחרונות|last\s+(\d{1,2})\s+hours?/u);
  const value = Number(match?.[1] ?? match?.[2]);
  return Number.isInteger(value) && value >= 1 && value <= 168 ? value : null;
}

function periodFor(text: string, context: InvestigationCompilerContext) {
  const now = context.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("INVESTIGATION_INVALID_NOW");
  const formatter = localFormatter(context.timeZone);
  const today = dateString(localParts(formatter, now.getTime()));
  const latestOnly = /(?:תקרית|אירוע)?\s*(?:האחרונ|האחרונה|האחרון)|latest/u.test(text);
  const hours = parseRelativeHours(text);
  const explicitDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/u)?.[1] ?? null;
  const times = parseTimes(text);
  if (!times.length && /(?:הבוקר|בבוקר|morning)/u.test(text)) times.push(6 * 60, 12 * 60);
  if (!times.length && /(?:אחר הצהריים|afternoon)/u.test(text)) times.push(12 * 60, 17 * 60);
  if (!times.length && /(?:בערב|הערב|evening)/u.test(text)) times.push(17 * 60, 20 * 60);
  if (!times.length && /(?:הלילה|בלילה|night)/u.test(text) && !/אתמול בלילה|last night/u.test(text)) times.push(20 * 60, 6 * 60);
  let from: number;
  let to: number;
  let dailyTimeWindow: CanonicalInvestigationQuery["dailyTimeWindow"] = null;
  let periodLabel: string;

  if (hours) {
    from = now.getTime() - hours * 3_600_000;
    to = now.getTime() + 1;
    periodLabel = `${hours} השעות האחרונות`;
  } else if (/אתמול בלילה|last night/u.test(text)) {
    const yesterday = shiftDate(today, -1);
    from = wallTime(yesterday, 20 * 60, formatter);
    to = wallTime(today, 6 * 60, formatter);
    periodLabel = "אתמול בלילה (20:00–06:00)";
  } else {
    let startDate: string;
    let endDate: string;
    const week = /השבוע|this week/u.test(text);
    if (explicitDate) {
      startDate = explicitDate;
      endDate = shiftDate(explicitDate, 1);
      periodLabel = explicitDate;
    } else if (/אתמול|yesterday/u.test(text)) {
      startDate = shiftDate(today, -1);
      endDate = today;
      periodLabel = "אתמול";
    } else if (week) {
      const local = dateParts(today);
      const dayOfWeek = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
      startDate = shiftDate(today, -dayOfWeek);
      endDate = shiftDate(today, 1);
      periodLabel = "השבוע";
    } else if (/היום|today/u.test(text) || times.length) {
      startDate = today;
      endDate = shiftDate(today, 1);
      periodLabel = "היום";
    } else if (latestOnly) {
      startDate = shiftDate(today, -31);
      endDate = shiftDate(today, 1);
      periodLabel = "31 הימים האחרונים";
    } else {
      from = now.getTime() - 24 * 3_600_000;
      to = now.getTime() + 1;
      periodLabel = "24 השעות האחרונות";
      return { from, to, dailyTimeWindow, latestOnly, periodLabel };
    }

    if (times.length > 2 || (/(בין|from)/u.test(text) && times.length !== 2)) throw new Error("INVESTIGATION_INVALID_TIME_RANGE");
    const after = /אחרי\s+\d|after\s+\d/u.test(text);
    if (after && times.length !== 1) throw new Error("INVESTIGATION_INVALID_TIME_RANGE");
    if (week && times.length) {
      const startMinute = times[0];
      const endMinute = after ? 1440 : times[1];
      if (endMinute == null || startMinute === endMinute) throw new Error("INVESTIGATION_INVALID_TIME_RANGE");
      dailyTimeWindow = { fromMinute: startMinute, toMinute: endMinute, overnight: endMinute < startMinute };
      from = wallTime(startDate, 0, formatter);
      to = Math.min(wallTime(endDate, 0, formatter), now.getTime() + 1);
      periodLabel += ` · ${after ? `אחרי ${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}` : "חלון שעות יומי"}`;
    } else if (times.length) {
      const startMinute = times[0];
      const endMinute = after ? 1440 : times[1];
      if (endMinute == null || startMinute === endMinute) throw new Error("INVESTIGATION_INVALID_TIME_RANGE");
      from = wallTime(startDate, startMinute, formatter);
      const overnight = endMinute < startMinute;
      const effectiveEndDate = overnight || endMinute === 1440 ? shiftDate(startDate, 1) : startDate;
      to = wallTime(effectiveEndDate, endMinute === 1440 ? 0 : endMinute, formatter);
      periodLabel += ` · ${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}–${endMinute === 1440 ? "24:00" : `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`}`;
    } else {
      from = wallTime(startDate, 0, formatter);
      to = week ? Math.min(wallTime(endDate, 0, formatter), now.getTime() + 1) : wallTime(endDate, 0, formatter);
    }
  }
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 32 * 86_400_000) throw new Error("INVESTIGATION_INVALID_WINDOW");
  return { from, to, dailyTimeWindow, latestOnly, periodLabel };
}

function phrasePresent(text: string, phrase: string) {
  const key = normalized(phrase);
  if (!key) return false;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])[בהלמ]?${escaped}(?=$|[^\\p{L}\\p{N}])`, "u").test(text);
}

function resolveCameras(text: string, context: InvestigationCompilerContext, explicitCameraSourceId?: string | null) {
  const cameras = context.cameras.filter((camera) => camera.observerSiteId === context.observerSiteId);
  if (explicitCameraSourceId) {
    const camera = cameras.find((item) => item.id === explicitCameraSourceId);
    if (!camera) throw new Error("INVESTIGATION_CAMERA_OUTSIDE_SITE");
    return { selected: [camera], zoneNames: [] as string[] };
  }
  if (/כל (?:מצלמות|המצלמות)|all cameras/u.test(text)) return { selected: cameras, zoneNames: [] as string[] };
  const matches = cameras.flatMap((camera) => {
    const aliases = [camera.name, camera.locationLabel, camera.streamId, ...(camera.aliases ?? []), ...(camera.zones ?? []).flatMap((zone) => [zone.name, ...(zone.aliases ?? [])])]
      .filter((value): value is string => Boolean(value));
    return aliases.filter((alias) => phrasePresent(text, alias)).map((alias) => ({ camera, alias, length: normalized(alias).length }));
  });
  if (!matches.length) {
    if (/(מצלמ|camera|באזור|בחצר|במחסן|בכניסה)/u.test(text)) throw new Error("INVESTIGATION_UNKNOWN_RESOURCE");
    return { selected: [] as InvestigationCameraResource[], zoneNames: [] as string[] };
  }
  const longest = Math.max(...matches.map((match) => match.length));
  const strongest = matches.filter((match) => match.length === longest);
  const selected = [...new Map(strongest.map((match) => [match.camera.id, match.camera])).values()];
  if (selected.length > 1) throw Object.assign(new Error("INVESTIGATION_AMBIGUOUS_RESOURCE"), { choices: selected });
  const zoneNames = selected[0].zones?.filter((zone) => phrasePresent(text, zone.name)).map((zone) => zone.name) ?? [];
  return { selected, zoneNames };
}

function parseEventTypes(text: string) {
  const types: CanonicalInvestigationQuery["eventTypes"] = [];
  if (/(נכנס|כניסות|כניסה|entered|entries|entry)/u.test(text)) types.push("person_entered");
  if (/(יצא|יציאות|יציאה|exited|exits|exit)/u.test(text)) types.push("person_exited");
  if (!types.length && /(אדם|אנשים|מישהו|person|people|זוהה|detected|מי היה)/u.test(text)) types.push("person_detected");
  if (/(מצלמ\S* (?:מנותקת|לא מקוונת)|camera offline)/u.test(text)) types.push("camera_offline");
  if (/(מצלמ\S* (?:חזרה|התחברה)|camera reconnected)/u.test(text)) types.push("camera_reconnected");
  return [...new Set(types)] as CanonicalInvestigationQuery["eventTypes"];
}

function parseFilters(text: string) {
  const incidentStatuses: CanonicalInvestigationQuery["incidentStatuses"] = [];
  if (/(פתוח|פתוחות|open)/u.test(text)) incidentStatuses.push("open");
  if (/(נסגר|סגורות|closed)/u.test(text)) incidentStatuses.push("closed");
  if (/(נפתר|טופל|resolved)/u.test(text)) incidentStatuses.push("resolved");
  const riskBands = INVESTIGATION_RISK_BANDS.filter((band) => new RegExp(`(?:^|[^A-Z])${band}(?:$|[^A-Z])`, "u").test(text.toUpperCase())) as CanonicalInvestigationQuery["riskBands"];
  if (/סיכון גבוה/u.test(text) && !riskBands.includes("HIGH")) riskBands.push("HIGH");
  const riskMinimumMatch = text.match(/(?:סיכון|risk)\s*(?:מעל|לפחות|>=?|at least)\s*(\d{1,3})/u);
  const riskMaximumMatch = text.match(/(?:סיכון|risk)\s*(?:מתחת|לכל היותר|<=?|at most)\s*(\d{1,3})/u);
  const riskMin = riskMinimumMatch ? Number(riskMinimumMatch[1]) : 0;
  const riskMax = riskMaximumMatch ? Number(riskMaximumMatch[1]) : 100;
  const riskScore = riskMinimumMatch || riskMaximumMatch ? { min: riskMin, max: riskMax } : null;
  const confidenceMatch = text.match(/(?:ביטחון|confidence)\s*(?:מעל|לפחות|>=?|at least)\s*(\d{1,3})\s*%?/u);
  const detectionConfidenceMin = confidenceMatch ? Number(confidenceMatch[1]) / 100 : null;
  const decisions: CanonicalInvestigationQuery["decisions"] = [];
  if (/(?:החלטת|ביקש|נדרש|decision).*?(?:verify|אימות)|\bverify\b/u.test(text)) decisions.push("VERIFY");
  if (/notify_in_app|עדכון באפליקציה/u.test(text)) decisions.push("NOTIFY_IN_APP");
  if (/log_only|תיעוד בלבד/u.test(text)) decisions.push("LOG_ONLY");
  const verificationStates: CanonicalInvestigationQuery["verificationStates"] = [];
  if (/(לא אומת|לא אומתו|unverified)/u.test(text)) verificationStates.push("UNVERIFIED");
  else if (/(אומת|אומתו|confirmed)/u.test(text)) verificationStates.push("CONFIRMED");
  if (/(לא ודאי|uncertain)/u.test(text)) verificationStates.push("UNCERTAIN");
  const feedbackLabels = INVESTIGATION_FEEDBACK_LABELS.filter((label) => text.toUpperCase().includes(label)) as CanonicalInvestigationQuery["feedbackLabels"];
  if (/אמיתי(?:ת)? אבל צפוי|פעילות צפויה/u.test(text)) feedbackLabels.push("TRUE_EXPECTED_ACTIVITY");
  if (/זיהוי שגוי/u.test(text)) feedbackLabels.push("FALSE_DETECTION");
  if (/קיבוץ (?:תקרית )?שגוי/u.test(text)) feedbackLabels.push("FALSE_CORRELATION");
  if (/אירוע אבטחה אמיתי/u.test(text)) feedbackLabels.push("TRUE_SECURITY_EVENT");
  if (/לא בטוח|משוב לא ודאי/u.test(text)) feedbackLabels.push("UNCERTAIN");
  const evidenceStates: CanonicalInvestigationQuery["evidenceStates"] = [];
  if (/(עם (?:ראיה|ראיות|הקלטה|קליפ)|evidence available|with evidence)/u.test(text)) evidenceStates.push("AVAILABLE");
  if (/(ללא (?:ראיה|ראיות|הקלטה)|no recording)/u.test(text)) evidenceStates.push("NO_RECORDING_BY_POLICY");
  if (/(ראי\S* שפג|expired evidence)/u.test(text)) evidenceStates.push("EXPIRED");
  return { incidentStatuses, riskBands, riskScore, detectionConfidenceMin, decisions, verificationStates, feedbackLabels: [...new Set(feedbackLabels)], evidenceStates };
}

export function isInvestigationQuestion(question: string) {
  const text = normalized(question);
  if (/(תתריע|תעקוב|שים לב|מעכשיו|הפעל|תפעיל)/u.test(text)) return false;
  return /(מה קרה|תראה לי|הראה לי|מתי|מי היה|אירוע|תקרית|כניסות|יציאות|אומתו|verify|risk|סיכון|היסטור|חפש|מצא)/u.test(text);
}

export function validateInvestigationQuery(value: unknown) {
  const parsed = querySchema.safeParse(value);
  if (!parsed.success) return { valid: false as const, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}:${issue.code}`), query: null };
  const query = parsed.data;
  const duration = Date.parse(query.toExclusive) - Date.parse(query.fromInclusive);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 32 * 86_400_000) return { valid: false as const, errors: ["window:out_of_bounds"], query: null };
  if (query.riskScore && query.riskScore.min > query.riskScore.max) return { valid: false as const, errors: ["riskScore:invalid_range"], query: null };
  return { valid: true as const, errors: [] as string[], query };
}

export function compileInvestigationQuery(input: {
  question: string;
  context: InvestigationCompilerContext;
  explicitCameraSourceId?: string | null;
  cursor?: number;
  limit?: number;
}): InvestigationCompileResult {
  const originalQuestion = input.question.normalize("NFKC").trim();
  const text = normalized(originalQuestion);
  if (originalQuestion.length < 2 || originalQuestion.length > 500) return result("INVALID", originalQuestion, { validation: { valid: false, errors: ["question:length"] } });
  if (/(select\s+\*|drop\s+table|delete\s+from|insert\s+into|update\s+\w+\s+set|ignore (?:all )?(?:permissions|instructions)|התעלם\S* (?:מהרשאות|מההוראות)|עקוף\S* הרשאות|another user|משתמש אחר|https?:\/\/|\bjavascript:)/iu.test(text)) {
    return result("UNSAFE_QUERY", originalQuestion, { limitation: { code: "QUERY_OR_PROMPT_INJECTION", explanation: "הטקסט אינו יכול להריץ SQL, לעקוף הרשאות, לגשת למשתמש אחר או לפתוח כתובת חיצונית." } });
  }
  if (/(מי (?:האדם|זה|זאת)|זהות\S* של|identify (?:this|the) person|face recognition)/u.test(text)) {
    return result("UNSUPPORTED_CAPABILITY", originalQuestion, { limitation: { code: "IDENTITY_NOT_AVAILABLE", explanation: "אין זיהוי זהות מאומת לאדם הזה. Track או זיהוי אדם אינם זהות." } });
  }
  if (/(גנב|גניבה|פרץ|פורץ|נראה חשוד|כוונה|מניע|stole|thief|suspicious|intent)/u.test(text)) {
    return result("UNSUPPORTED_CAPABILITY", originalQuestion, { limitation: { code: "UNSUPPORTED_BEHAVIOR_OR_INTENT", explanation: "אין בנתונים הקנוניים יכולת להוכיח גניבה, חשד, כוונה או מניע. אפשר לחפש אירועי כניסה, יציאה וזיהוי ולבדוק ראיות קיימות." } });
  }

  try {
    const scoped = input.context.cameras.filter((camera) => camera.observerSiteId === input.context.observerSiteId);
    const resolution = resolveCameras(text, input.context, input.explicitCameraSourceId);
    const period = periodFor(text, input.context);
    const filters = parseFilters(text);
    const eventTypes = parseEventTypes(text);
    const trackMatch = text.match(/(?:track|מסלול)\s*[:#]?\s*([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})/iu);
    const scopes: CanonicalInvestigationQuery["scopes"] = /תקרית|incident/u.test(text)
      ? ["INCIDENTS"]
      : /אירוע|events?/u.test(text) && !/תקרית|incident/u.test(text)
        ? ["EVENTS"]
        : ["INCIDENTS", "EVENTS"];
    const query: CanonicalInvestigationQuery = {
      schemaVersion: DIGITAL_OBSERVER_INVESTIGATION_SCHEMA_VERSION,
      observerSiteId: input.context.observerSiteId,
      timeZone: input.context.timeZone,
      fromInclusive: new Date(period.from).toISOString(),
      toExclusive: new Date(period.to).toISOString(),
      dailyTimeWindow: period.dailyTimeWindow,
      cameraSourceIds: resolution.selected.map((camera) => camera.id),
      zoneNames: resolution.zoneNames,
      eventTypes,
      ...filters,
      trackId: trackMatch?.[1] ?? null,
      watchRuleMatched: /(?:כלל|watch rule).*(?:התאים|matched)/u.test(text) ? true : null,
      scopes,
      provenance: ["REAL_CAMERA_AI", "CAMERA_NATIVE_EVENT"],
      latestOnly: period.latestOnly,
      pagination: { cursor: Math.max(0, Math.min(500, input.cursor ?? 0)), limit: Math.max(1, Math.min(25, input.limit ?? 20)) },
      ranking: "EXACT_FILTERS_THEN_RECENCY",
      readOnly: true,
      rawSqlAllowed: false
    };
    const validation = validateInvestigationQuery(query);
    if (!validation.valid) return result("INVALID", originalQuestion, { validation });
    const cameraLabels = query.cameraSourceIds.length
      ? query.cameraSourceIds.map((id) => scoped.find((camera) => camera.id === id)?.name ?? id).join(", ")
      : "כל המצלמות המורשות באתר";
    const filterLabels = [
      ...query.eventTypes,
      ...query.riskBands.map((value) => `risk:${value}`),
      ...(query.riskScore ? [`risk:${query.riskScore.min}-${query.riskScore.max}`] : []),
      ...(query.detectionConfidenceMin == null ? [] : [`confidence>=${Math.round(query.detectionConfidenceMin * 100)}%`]),
      ...query.verificationStates.map((value) => `verification:${value}`),
      ...query.decisions.map((value) => `decision:${value}`),
      ...query.evidenceStates.map((value) => `evidence:${value}`)
    ];
    return result("READY", originalQuestion, {
      query: validation.query,
      preview: { scope: query.scopes.join(" + "), cameras: cameraLabels, period: period.periodLabel, filters: filterLabels.join(", ") || "ללא מסנן נוסף" },
      validation: { valid: true, errors: [] }
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVESTIGATION_INVALID";
    const choices = error && typeof error === "object" && "choices" in error && Array.isArray(error.choices)
      ? (error.choices as InvestigationCameraResource[]).map((camera) => ({ id: camera.id, label: camera.name }))
      : [];
    if (code === "INVESTIGATION_AMBIGUOUS_RESOURCE") return result("NEEDS_CLARIFICATION", originalQuestion, { clarification: { question: "נמצאו כמה מצלמות מתאימות. באיזו מצלמה לחפש?", choices } });
    if (["INVESTIGATION_UNKNOWN_RESOURCE", "INVESTIGATION_CAMERA_OUTSIDE_SITE"].includes(code)) return result("NEEDS_CLARIFICATION", originalQuestion, { clarification: { question: "המצלמה או האזור לא נמצאו באתר המורשה. יש לבחור מצלמה מהרשימה.", choices: input.context.cameras.filter((camera) => camera.observerSiteId === input.context.observerSiteId).map((camera) => ({ id: camera.id, label: camera.name })) } });
    const explanation = code.includes("LOCAL_TIME")
      ? "השעה אינה חד-משמעית בגלל מעבר שעון. יש לציין טווח אחר או זמן עם היסט מפורש."
      : "לא ניתן לבנות טווח חיפוש תקין ובטוח מהשאלה. יש לציין יום או טווח זמן ברור.";
    return result("INVALID", originalQuestion, { limitation: { code, explanation }, validation: { valid: false, errors: [code] } });
  }
}

export function minuteOfDayAt(iso: string, timeZone: string) {
  const formatter = localFormatter(timeZone);
  const parts = localParts(formatter, Date.parse(iso));
  return parts.hour * 60 + parts.minute;
}

export function matchesDailyWindow(iso: string, query: CanonicalInvestigationQuery) {
  if (!query.dailyTimeWindow) return true;
  const minute = minuteOfDayAt(iso, query.timeZone);
  const window = query.dailyTimeWindow;
  return window.overnight ? minute >= window.fromMinute || minute < window.toMinute : minute >= window.fromMinute && minute < window.toMinute;
}
