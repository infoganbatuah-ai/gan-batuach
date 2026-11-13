export type StaffShiftSummaryRow = {
  shift_date?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  total_minutes?: number | null;
};

export type StaffPeriodSummary = {
  minutes: number;
  state: "complete" | "partial" | "unavailable";
};

export function staffRowsRead<T>(result: { data: T[] | null; error?: unknown }):
  { state: "available"; rows: T[] } | { state: "unavailable"; rows: [] } {
  if (result.error || !Array.isArray(result.data)) return { state: "unavailable", rows: [] };
  return { state: "available", rows: result.data };
}

export function staffSingleRead<T>(result: { data: T | null; error?: unknown }):
  { state: "available"; value: T | null } | { state: "unavailable"; value: null } {
  if (result.error) return { state: "unavailable", value: null };
  return { state: "available", value: result.data };
}

function dateOrdinal(key: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? time / 86400000 : null;
}

export function verifiedShiftMinutes(row: StaffShiftSummaryRow): number | null {
  if (!row.actual_start || !row.actual_end) return null;
  const start = Date.parse(row.actual_start);
  const end = Date.parse(row.actual_end);
  const minutes = row.total_minutes;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return typeof minutes === "number" && Number.isSafeInteger(minutes) && minutes >= 0 ? minutes : null;
}

export function formatStaffMinutes(minutes: number): { hours: string; remainder: string } | null {
  if (!Number.isSafeInteger(minutes) || minutes < 0) return null;
  return { hours: `${Math.floor(minutes / 60)} ש׳`, remainder: `${minutes % 60} דק׳` };
}

export function staffShiftTimeLabel(row: StaffShiftSummaryRow): string {
  const minutes = verifiedShiftMinutes(row);
  if (minutes === null) return "שעות עבודה טרם אומתו";
  const value = formatStaffMinutes(minutes)!;
  return `סה״כ ${value.hours} ${value.remainder}`;
}

export function summarizeStaffPeriod(
  rows: StaffShiftSummaryRow[],
  period: "lastSevenDays" | "month",
  todayKey: string,
  rowLimit = 45
): StaffPeriodSummary {
  const today = dateOrdinal(todayKey);
  if (today === null) return { minutes: 0, state: "unavailable" };
  const start = period === "month" ? dateOrdinal(`${todayKey.slice(0, 7)}-01`)! : today - 6;
  let minutes = 0;
  let invalid = false;
  for (const row of rows) {
    const day = dateOrdinal(row.shift_date ?? "");
    if (day === null) { invalid = true; continue; }
    if (day < start || day > today) continue;
    if (!row.actual_end) continue;
    const verified = verifiedShiftMinutes(row);
    if (verified === null) invalid = true;
    else minutes += verified;
  }
  if (invalid || !Number.isSafeInteger(minutes)) return { minutes: 0, state: "unavailable" };
  const oldest = rows.length ? dateOrdinal(rows[rows.length - 1].shift_date ?? "") : null;
  return { minutes, state: rows.length >= rowLimit && (oldest === null || oldest >= start) ? "partial" : "complete" };
}
