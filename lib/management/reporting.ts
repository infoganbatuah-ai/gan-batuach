export const REPORT_PAGE_SIZE_DEFAULT = 50;
export const REPORT_PAGE_SIZE_MAX = 200;
export const REPORT_EXPORT_ROW_MAX = 2_000;
export const REPORT_RANGE_MAX_DAYS = 366;

export type ReportingRole = "owner" | "manager" | "staff" | "parent" | "inspector" | "admin";
export type ReportType =
  | "dashboard"
  | "attendance"
  | "pickup"
  | "staff_hours"
  | "tuition"
  | "subscription"
  | "inspections"
  | "corrective_actions"
  | "complaints"
  | "tasks"
  | "documents"
  | "enrollment"
  | "capacity"
  | "parent_summary"
  | "staff_summary"
  | "inspector_portfolio"
  | "platform_summary"
  | "network_summary";

const roleReports: Record<ReportingRole, readonly ReportType[]> = {
  owner: ["dashboard", "attendance", "pickup", "staff_hours", "tuition", "subscription", "inspections", "corrective_actions", "complaints", "tasks", "documents", "enrollment", "capacity", "network_summary"],
  manager: ["dashboard", "attendance", "pickup", "staff_hours", "tuition", "subscription", "inspections", "corrective_actions", "complaints", "tasks", "documents", "enrollment", "capacity", "network_summary"],
  staff: ["staff_summary", "staff_hours", "tasks"],
  parent: ["parent_summary", "attendance", "tuition", "documents"],
  inspector: ["inspector_portfolio", "inspections", "corrective_actions", "complaints", "documents"],
  admin: ["platform_summary", "subscription"]
};

export function roleCanReadReport(role: string, report: string): report is ReportType {
  return Object.prototype.hasOwnProperty.call(roleReports, role)
    && roleReports[role as ReportingRole].includes(report as ReportType);
}

function dateKeyInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (part: string) => parts.find(item => item.type === part)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

function addDays(value: string, days: number) {
  const date = parseDateKey(value);
  if (!date) throw new Error("invalid_report_date");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveReportRange(search: URLSearchParams, timezone: string, now = new Date()) {
  const preset = search.get("range") ?? "month";
  const today = dateKeyInTimezone(now, timezone);
  let from: string;
  let to: string;
  if (preset === "today") {
    from = today;
    to = today;
  } else if (preset === "week") {
    from = addDays(today, -6);
    to = today;
  } else if (preset === "month") {
    from = `${today.slice(0, 8)}01`;
    to = today;
  } else if (preset === "custom") {
    from = search.get("from") ?? "";
    to = search.get("to") ?? "";
  } else {
    throw new Error("invalid_report_range");
  }
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (!start || !end || start > end) throw new Error("invalid_report_range");
  const days = Math.floor((end.valueOf() - start.valueOf()) / 86_400_000) + 1;
  if (days > REPORT_RANGE_MAX_DAYS) throw new Error("report_range_too_large");
  return { preset, from, to, timezone, days };
}

export function resolveReportPage(search: URLSearchParams, exporting = false) {
  const page = Math.max(1, Number.parseInt(search.get("page") ?? "1", 10) || 1);
  const requested = Number.parseInt(search.get("page_size") ?? String(REPORT_PAGE_SIZE_DEFAULT), 10) || REPORT_PAGE_SIZE_DEFAULT;
  const pageSize = exporting ? REPORT_EXPORT_ROW_MAX : Math.min(Math.max(1, requested), REPORT_PAGE_SIZE_MAX);
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function buildCsv(columns: readonly string[], rows: ReadonlyArray<Record<string, unknown>>) {
  return `\uFEFF${[columns.map(csvCell).join(","), ...rows.map(row => columns.map(column => csvCell(row[column])).join(","))].join("\r\n")}`;
}

export function safeReportFilename(report: ReportType, from: string, to: string) {
  return `gan-batuach-${report}-${from}-${to}.csv`;
}

export function moneyMinorUnits(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

export function moneyFromMinorUnits(value: number) {
  return value / 100;
}
