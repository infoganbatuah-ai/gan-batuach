type ScheduleRow = Record<string, any> | null | undefined;

function clockMinutes(value: unknown): number | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Fail-closed quiet-hours evaluation in the site's explicit timezone. */
export function scheduleIsOffHours(schedule: ScheduleRow, at = new Date()): boolean {
  const quiet = schedule?.schedule?.quiet_hours;
  const start = clockMinutes(quiet?.start);
  const end = clockMinutes(quiet?.end);
  if (start === null || end === null || start === end || Number.isNaN(at.getTime())) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: typeof schedule?.timezone === "string" ? schedule.timezone : "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(at);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return false;
    const now = hour * 60 + minute;
    return start < end ? now >= start && now < end : now >= start || now < end;
  } catch {
    return false;
  }
}
