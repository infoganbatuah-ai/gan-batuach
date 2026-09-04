import { z } from "zod";
import { GUARD_EVENT_TYPES } from "./guard-event-types";

/** Pure query planning only: never reads a frame, calls a detector or executes a command. */
export type GuardQueryCamera = { id: string; observerSiteId: string; name: string; zoneName?: string | null; aliases?: readonly string[] };
export type GuardQueryContext = { observerSiteId: string; timeZone: string; cameras: readonly GuardQueryCamera[]; now?: Date };
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const windowSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("relative"), day: z.enum(["today", "yesterday"]), fromTime: timeSchema.optional(), toTime: timeSchema.optional() }).strict(),
  z.object({ kind: z.literal("date"), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), fromTime: timeSchema.optional(), toTime: timeSchema.optional() }).strict(),
  z.object({ kind: z.literal("instant"), from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).strict()
]);
export const guardJournalQuerySchema = z.object({
  cameraSourceId: z.string().uuid().optional(), cameraZoneName: z.string().trim().min(1).max(200).optional(),
  window: windowSchema,
  eventTypes: z.array(z.enum(GUARD_EVENT_TYPES)).max(GUARD_EVENT_TYPES.length).optional(),
  reviewStatuses: z.array(z.enum(["needs_review", "reviewing", "escalated", "confirmed", "resolved", "dismissed"])).max(6).optional(),
  limit: z.number().int().min(1).max(100).default(20)
}).strict();
export type GuardJournalQueryInput = z.input<typeof guardJournalQuerySchema>;
export type GuardJournalQuery = {
  observerSiteId: string; cameraSourceId: string | null; cameraZoneName: string | null;
  fromInclusive: string; toExclusive: string; timeZone: string;
  eventTypes: readonly string[]; reviewStatuses: readonly string[]; limit: number;
  historicalOnly: true; hardwareActions: 0;
};

function aliasKey(value: string) { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("he-IL"); }
function formatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}
function localParts(format: Intl.DateTimeFormat, instant: number) {
  const parts = Object.fromEntries(format.formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return [parts.year, parts.month, parts.day, parts.hour, parts.minute];
}
function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 2000 || year > 2100 || date.toISOString().slice(0, 10) !== value) throw new Error("GUARD_QUERY_INVALID_DATE");
  return [year, month, day];
}
function dayString(parts: number[]) { return `${parts[0]}-${String(parts[1]).padStart(2, "0")}-${String(parts[2]).padStart(2, "0")}`; }
function nextDate(date: string, delta: number) {
  const [year, month, day] = dateParts(date);
  return new Date(Date.UTC(year, month - 1, day + delta)).toISOString().slice(0, 10);
}

/** Resolve wall-clock times by validating candidate UTC offsets. Nonexistent or
 * repeated DST times require an explicit ISO offset instead of a silent guess. */
function wallTime(date: string, time: string, format: Intl.DateTimeFormat) {
  const [year, month, day] = dateParts(date);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const offsets = new Set<number>();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const instant = target + hours * 3_600_000;
    const [y, m, d, h, min] = localParts(format, instant);
    offsets.add(Date.UTC(y, m - 1, d, h, min) - instant);
  }
  const wanted = [year, month, day, hour, minute];
  const matches = [...offsets].map((offset) => target - offset)
    .filter((instant) => localParts(format, instant).every((value, index) => value === wanted[index]));
  if (matches.length !== 1) throw new Error(matches.length ? "GUARD_QUERY_AMBIGUOUS_LOCAL_TIME" : "GUARD_QUERY_NONEXISTENT_LOCAL_TIME");
  return matches[0];
}

export function buildGuardJournalQuery(input: GuardJournalQueryInput, context: GuardQueryContext): GuardJournalQuery {
  const parsed = guardJournalQuerySchema.parse(input);
  z.string().uuid().parse(context.observerSiteId);
  z.string().trim().min(1).parse(context.timeZone);
  const format = formatter(context.timeZone); // Invalid server tenant timezone fails closed.
  const now = context.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("GUARD_QUERY_INVALID_NOW");
  // The caller must fetch cameras under an authenticated site scope. Recheck that
  // scope here before any alias is considered, even when a shared list is passed.
  const scoped = context.cameras.filter((camera) => camera.observerSiteId === context.observerSiteId);
  let camera: GuardQueryCamera | undefined;
  if (parsed.cameraSourceId) {
    camera = scoped.find((item) => item.id === parsed.cameraSourceId);
    if (!camera) throw new Error("GUARD_QUERY_CAMERA_OUTSIDE_SITE");
  }
  if (parsed.cameraZoneName) {
    const key = aliasKey(parsed.cameraZoneName);
    const matches = scoped.filter((item) => [item.name, item.zoneName, ...(item.aliases ?? [])].some((name) => name && aliasKey(name) === key));
    if (!matches.length) throw new Error("GUARD_QUERY_UNKNOWN_ZONE");
    if (camera) {
      if (!matches.some((item) => item.id === camera!.id)) throw new Error("GUARD_QUERY_CAMERA_ZONE_MISMATCH");
    } else {
      if (new Set(matches.map((item) => item.id)).size !== 1) throw new Error("GUARD_QUERY_AMBIGUOUS_ZONE");
      camera = matches[0];
    }
  }
  if (camera) z.string().uuid().parse(camera.id);
  let from: number, to: number;
  if (parsed.window.kind === "instant") {
    from = Date.parse(parsed.window.from); to = Date.parse(parsed.window.to);
  } else {
    let date = parsed.window.kind === "date" ? parsed.window.date : dayString(localParts(format, now.getTime()));
    if (parsed.window.kind === "relative" && parsed.window.day === "yesterday") date = nextDate(date, -1);
    from = wallTime(date, parsed.window.fromTime ?? "00:00", format);
    to = wallTime(parsed.window.toTime ? date : nextDate(date, 1), parsed.window.toTime ?? "00:00", format);
  }
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 31 * 86_400_000) throw new Error("GUARD_QUERY_INVALID_WINDOW");
  return {
    observerSiteId: context.observerSiteId, cameraSourceId: camera?.id ?? null, cameraZoneName: camera?.zoneName || camera?.name || null,
    fromInclusive: new Date(from).toISOString(), toExclusive: new Date(to).toISOString(), timeZone: context.timeZone,
    eventTypes: [...new Set(parsed.eventTypes ?? [])], reviewStatuses: [...new Set(parsed.reviewStatuses ?? [])], limit: parsed.limit,
    historicalOnly: true, hardwareActions: 0
  };
}

export function guardQueryClarification(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "GUARD_QUERY_AMBIGUOUS_ZONE") return "יש כמה מצלמות בשם הזה. צריך לבחור מצלמה מסוימת.";
  if (code === "GUARD_QUERY_UNKNOWN_ZONE") return "לא נמצא אזור בשם הזה באתר שנבחר. אפשר לבחור מצלמה מהרשימה.";
  if (code.includes("LOCAL_TIME")) return "השעה שביקשת אינה חד־משמעית בגלל החלפת שעון. צריך לציין זמן עם היסט UTC מפורש.";
  if (code.includes("CAMERA")) return "המצלמה והאזור אינם תואמים לאתר שנבחר.";
  return "צריך לציין מצלמה או אזור וטווח זמנים תקין. שאילתת יומן אינה מאשרת מי נמצא שם כרגע.";
}
