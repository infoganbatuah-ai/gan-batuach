"use client";

import {
  AlertCircle, ArrowLeft, BarChart3, BookOpenCheck, BriefcaseBusiness,
  Building2, CalendarDays, CheckCircle2, ChevronLeft, ClipboardCheck,
  Clock3, Download, FileBarChart2, FileCheck2, FileSpreadsheet, Filter,
  GraduationCap, ListFilter, LoaderCircle, RefreshCw, Search, ShieldCheck,
  Table2, TrendingUp, UserCheck, UsersRound, WalletCards, type LucideIcon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReportType, ReportingRole } from "@/lib/management/reporting";

export type ReportScopeOption = { id: string; label: string };
type ReportRow = Record<string, unknown>;
type Category = "overview" | "children" | "staff" | "finance" | "safety" | "operations";
type Definition = { type: ReportType; title: string; text: string; category: Category; roles: ReportingRole[]; icon: LucideIcon; csv?: boolean };
type ReportPayload = {
  report: ReportType;
  rows: ReportRow[];
  notice?: string;
  range: { preset: string; from: string; to: string; timezone: string; days: number };
  pagination: { page: number; page_size: number; total: number };
  freshness: { generated_at: string; mode: string; live: boolean };
};
type RequestConfig = { report: ReportType; range: "today" | "week" | "month" | "custom"; from: string; to: string; gardenId: string; childId: string };

const definitions: Definition[] = [
  { type: "dashboard", title: "תמונת מצב ניהולית", text: "סיכום נוכחות, משימות, תלונות, חיובים ומסמכים", category: "overview", roles: ["owner", "manager"], icon: BarChart3 },
  { type: "attendance", title: "דוח נוכחות", text: "הגעה, יציאה, היעדרות ומגמה לפי תקופה", category: "children", roles: ["owner", "manager", "parent"], icon: UserCheck, csv: true },
  { type: "pickup", title: "דוח איסוף ושחרור", text: "אירועי שחרור ואימות מורשה ללא מידע עודף", category: "children", roles: ["owner", "manager"], icon: ShieldCheck, csv: true },
  { type: "staff_hours", title: "דוח שעות צוות", text: "מתוכנן מול בפועל, חוסרים וסיכום שעות מורשה", category: "staff", roles: ["owner", "manager", "staff"], icon: Clock3, csv: true },
  { type: "tuition", title: "דוח שכר לימוד", text: "חיוב, תשלום, יתרה, התאמות וזיכויים", category: "finance", roles: ["owner", "manager", "parent"], icon: WalletCards, csv: true },
  { type: "subscription", title: "מנוי הפלטפורמה", text: "תכנית, מחזור חיוב, סטטוס ומוכנות ספק", category: "finance", roles: ["owner", "manager", "admin"], icon: Building2, csv: true },
  { type: "enrollment", title: "משפך הרשמה", text: "בקשות, מידע נדרש, תשלום, המתנה והפעלה", category: "children", roles: ["owner", "manager"], icon: GraduationCap, csv: true },
  { type: "capacity", title: "דוח קיבולת", text: "קיבולת מוגדרת, משויכים, שמורים וזמינות", category: "operations", roles: ["owner", "manager"], icon: UsersRound, csv: true },
  { type: "documents", title: "דוח מסמכים", text: "חסר, ממתין, מאומת, נדחה, פג תוקף והחלפה", category: "operations", roles: ["owner", "manager", "parent", "inspector"], icon: FileCheck2, csv: true },
  { type: "inspections", title: "דוח פיקוחים", text: "ביקורות שהוגשו, ציון היסטורי וממצאים", category: "safety", roles: ["owner", "manager", "inspector"], icon: ClipboardCheck, csv: true },
  { type: "corrective_actions", title: "פעולות מתקנות", text: "ממצא, יעד תיקון, ראיות וסטטוס בדיקה", category: "safety", roles: ["owner", "manager", "inspector"], icon: CheckCircle2, csv: true },
  { type: "complaints", title: "דוח תלונות", text: "סטטוס, חומרה ו־SLA ללא תוכן פרטי", category: "safety", roles: ["owner", "manager", "inspector"], icon: AlertCircle, csv: true },
  { type: "tasks", title: "דוח משימות", text: "פתוחות, בביצוע, הושלמו ובאיחור", category: "operations", roles: ["owner", "manager", "staff"], icon: BookOpenCheck, csv: true },
  { type: "network_summary", title: "סיכום רשת גנים", text: "איחוד רק של הגנים המורשים לניהול", category: "overview", roles: ["owner", "manager"], icon: Building2 },
  { type: "parent_summary", title: "סיכום משפחתי", text: "תמונת מצב רק לילדים המקושרים לחשבון", category: "overview", roles: ["parent"], icon: UsersRound },
  { type: "staff_summary", title: "סיכום צוות אישי", text: "משמרות ומשימות במסגרת העסקה פעילה", category: "overview", roles: ["staff"], icon: BriefcaseBusiness },
  { type: "inspector_portfolio", title: "תיק גנים למפקח", text: "פיקוחים ומעקב רק בגנים המשויכים", category: "overview", roles: ["inspector"], icon: ShieldCheck },
  { type: "platform_summary", title: "סיכום פלטפורמה", text: "מדדים מצטברים ומוכנות ספקים ללא מידע פרטי", category: "overview", roles: ["admin"], icon: BarChart3 }
];

const categoryLabels = { all: "הכול", overview: "סקירה", children: "ילדים", staff: "צוות", finance: "כספים", safety: "בטיחות", operations: "תפעול" } as const;
const roleCopy: Record<ReportingRole, { eyebrow: string; title: string; text: string }> = {
  owner: { eyebrow: "מרכז דוחות", title: "דוחות וניתוח נתונים", text: "מדדים תפעוליים מתוך נתוני המקור של הגנים שבניהולך." },
  manager: { eyebrow: "מרכז דוחות", title: "דוחות וניתוח נתונים", text: "מדדים תפעוליים מתוך נתוני המקור של הגנים שבניהולך." },
  parent: { eyebrow: "הדוחות שלי", title: "תמונת מצב משפחתית", text: "מידע רק עבור הילדים המקושרים אליך והרשאות הקשר הפעילות." },
  staff: { eyebrow: "הדוחות שלי", title: "שעות ומשימות אישיות", text: "נתונים אישיים במסגרת ההעסקה הפעילה והגן הנוכחי." },
  inspector: { eyebrow: "דוחות פיקוח", title: "פיקוחים, ממצאים ומעקב", text: "דוחות רק עבור הגנים והביקורות המשויכים אליך." },
  admin: { eyebrow: "דוחות פלטפורמה", title: "מדדים מצטברים ומוכנות", text: "נתונים מצטברים ללא חשיפת תוכן פרטי של ילדים, מסמכים או הודעות." }
};
const defaultReport: Record<ReportingRole, ReportType> = { owner: "dashboard", manager: "dashboard", parent: "parent_summary", staff: "staff_summary", inspector: "inspector_portfolio", admin: "platform_summary" };
const statusLabels: Record<string, string> = {
  active: "פעיל", approved: "מאושר", cancelled: "בוטל", checked_in: "נוכח", checked_out: "יצא", closed: "נסגר", completed: "הושלם", departed: "יצא", done: "הושלם", escalated: "הוסלם", expired: "פג תוקף", failed: "נכשל", in_progress: "בביצוע", missing: "חסר", open: "פתוח", overdue: "באיחור", paid: "שולם", partial: "חלקי", pending: "ממתין", pending_review: "ממתין לבדיקה", present: "נוכח", rejected: "נדחה", resolved: "נפתר", verified: "מאומת", waiting_approval: "ממתין לאישור", within_target: "במסגרת היעד"
};

type Column = { key: string; label: string; format?: "date" | "datetime" | "minutes" | "money" | "score" | "boolean" | "status" | "counts" | "readiness" };
const columnSets: Partial<Record<ReportType, Column[]>> = {
  dashboard: [{ key: "garden_count", label: "גנים" }, { key: "attendance_records", label: "רשומות נוכחות" }, { key: "present", label: "נוכחים" }, { key: "open_tasks", label: "משימות פתוחות" }, { key: "open_complaints", label: "תלונות פתוחות" }, { key: "outstanding_tuition", label: "יתרת שכר לימוד", format: "money" }],
  network_summary: [{ key: "garden_count", label: "גנים" }, { key: "attendance_records", label: "רשומות נוכחות" }, { key: "present", label: "נוכחים" }, { key: "open_tasks", label: "משימות פתוחות" }, { key: "open_complaints", label: "תלונות פתוחות" }, { key: "outstanding_tuition", label: "יתרת שכר לימוד", format: "money" }],
  parent_summary: [{ key: "attendance_records", label: "רשומות נוכחות" }, { key: "present", label: "נוכחים" }, { key: "outstanding_tuition", label: "יתרת שכר לימוד", format: "money" }, { key: "document_action_items", label: "מסמכים לטיפול" }],
  platform_summary: [{ key: "garden_count", label: "גנים" }, { key: "role_counts", label: "משתמשים לפי תפקיד", format: "counts" }, { key: "subscription_states", label: "מצבי מנוי", format: "counts" }, { key: "open_complaints", label: "תלונות פתוחות" }, { key: "provider_readiness", label: "מוכנות ספקים", format: "readiness" }],
  attendance: [{ key: "attendance_date", label: "תאריך", format: "date" }, { key: "status", label: "סטטוס", format: "status" }, { key: "arrival_at", label: "כניסה", format: "datetime" }, { key: "departure_at", label: "יציאה", format: "datetime" }],
  pickup: [{ key: "pickup_time", label: "מועד שחרור", format: "datetime" }, { key: "authorization_type", label: "סוג הרשאה" }, { key: "status", label: "סטטוס", format: "status" }],
  staff_hours: [{ key: "shift_date", label: "תאריך", format: "date" }, { key: "staff_name", label: "איש/ת צוות" }, { key: "worked_minutes", label: "שעות", format: "minutes" }, { key: "approval_state", label: "אישור", format: "status" }, { key: "missing_clock_out", label: "יציאה חסרה", format: "boolean" }],
  tuition: [{ key: "period_start", label: "תקופה", format: "date" }, { key: "amount_due", label: "חיוב", format: "money" }, { key: "settled_total", label: "שולם", format: "money" }, { key: "outstanding", label: "יתרה", format: "money" }, { key: "status", label: "סטטוס", format: "status" }],
  subscription: [{ key: "plan_name", label: "תכנית" }, { key: "status", label: "סטטוס", format: "status" }, { key: "billing_status", label: "חיוב", format: "status" }, { key: "unit_price_snapshot", label: "מחיר מוגדר", format: "money" }, { key: "provider", label: "ספק" }],
  enrollment: [{ key: "submitted_at", label: "הוגש", format: "datetime" }, { key: "status", label: "שלב", format: "status" }, { key: "reviewed_at", label: "נבדק", format: "datetime" }, { key: "activated_at", label: "הופעל", format: "datetime" }],
  capacity: [{ key: "classroom_name", label: "כיתה" }, { key: "configured_capacity", label: "קיבולת" }, { key: "occupied", label: "משויכים" }, { key: "reserved", label: "שמורים" }, { key: "available", label: "פנויים" }, { key: "over_capacity", label: "חריגה", format: "boolean" }],
  documents: [{ key: "document_type", label: "מסמך" }, { key: "owner_type", label: "הקשר" }, { key: "status", label: "סטטוס", format: "status" }, { key: "expires_at", label: "תוקף", format: "date" }],
  inspections: [{ key: "period_month", label: "תקופה", format: "date" }, { key: "status", label: "סטטוס", format: "status" }, { key: "weighted_score", label: "ציון", format: "score" }, { key: "violation_count", label: "ממצאים" }, { key: "completed_at", label: "הוגש", format: "datetime" }],
  inspector_portfolio: [{ key: "period_month", label: "תקופה", format: "date" }, { key: "status", label: "סטטוס", format: "status" }, { key: "weighted_score", label: "ציון", format: "score" }, { key: "violation_count", label: "ממצאים" }],
  corrective_actions: [{ key: "title", label: "פעולה" }, { key: "severity", label: "חומרה", format: "status" }, { key: "status", label: "סטטוס", format: "status" }, { key: "correction_due_at", label: "יעד", format: "date" }],
  complaints: [{ key: "category", label: "קטגוריה" }, { key: "severity", label: "חומרה", format: "status" }, { key: "status", label: "סטטוס", format: "status" }, { key: "sla_state", label: "SLA", format: "status" }, { key: "created_at", label: "נפתח", format: "datetime" }],
  tasks: [{ key: "title", label: "משימה" }, { key: "priority", label: "עדיפות", format: "status" }, { key: "status", label: "סטטוס", format: "status" }, { key: "due_at", label: "יעד", format: "date" }],
  staff_summary: [{ key: "title", label: "משימה" }, { key: "priority", label: "עדיפות", format: "status" }, { key: "status", label: "סטטוס", format: "status" }, { key: "due_at", label: "יעד", format: "date" }]
};

function initialDates() {
  const today = new Date();
  const value = today.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  return { from: `${value.slice(0, 8)}01`, to: value };
}
function numeric(value: unknown) { const parsed = typeof value === "number" ? value : Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function formatNumber(value: number) { return new Intl.NumberFormat("he-IL", { maximumFractionDigits: 1 }).format(value); }
function formatMoney(value: number) { return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 2 }).format(value); }
function formatDate(value: unknown, withTime = false) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.valueOf())) return String(value);
  return new Intl.DateTimeFormat("he-IL", withTime ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }).format(date);
}
function displayValue(value: unknown, format?: string) {
  if (value == null || value === "") return "—";
  if (format === "date") return formatDate(value);
  if (format === "datetime") return formatDate(value, true);
  if (format === "minutes") return `${formatNumber(numeric(value) / 60)} שעות`;
  if (format === "money") return formatMoney(numeric(value));
  if (format === "score") return `${formatNumber(numeric(value))} / 10`;
  if (format === "boolean") return value ? "כן" : "לא";
  if (format === "status") return statusLabels[String(value)] ?? String(value).replaceAll("_", " ");
  if (format === "counts" && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${statusLabels[key] ?? key.replaceAll("_", " ")}: ${String(item)}`).join(" · ");
  }
  if (format === "readiness" && Array.isArray(value)) {
    if (!value.length) return "לא הוגדר ספק";
    return value.map((item) => {
      const provider = item && typeof item === "object" ? String((item as Record<string, unknown>).provider ?? "ספק") : "ספק";
      const ready = item && typeof item === "object" && (item as Record<string, unknown>).enabled === true;
      return `${provider}: ${ready ? "זמין" : "לא זמין"}`;
    }).join(" · ");
  }
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${String(item)}`).join(" · ");
  return String(value);
}
function columnsFor(report: ReportType, rows: ReportRow[]): Column[] {
  if (columnSets[report]) return columnSets[report]!;
  const hidden = new Set(["id", "garden_id", "child_id", "staff_id", "assigned_to", "inspector_id", "profile_id"]);
  return Object.keys(rows[0] ?? {}).filter((key) => !hidden.has(key)).slice(0, 6).map((key) => ({ key, label: key.replaceAll("_", " ") }));
}
function countsBy(rows: ReportRow[], key: string) {
  const counts = new Map<string, number>();
  rows.forEach((row) => { const value = String(row[key] ?? "unknown"); counts.set(value, (counts.get(value) ?? 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
function statusTone(value: unknown) {
  const status = String(value ?? "");
  if (["active", "approved", "checked_in", "closed", "completed", "done", "paid", "resolved", "verified", "within_target"].includes(status)) return "good";
  if (["cancelled", "escalated", "expired", "failed", "missing", "overdue", "rejected", "resolution_overdue", "acknowledgement_overdue"].includes(status)) return "bad";
  return "warn";
}

type Metric = { label: string; value: string; hint: string; tone?: "blue" | "green" | "orange" | "red" };
function metricsFor(report: ReportType, payload: ReportPayload): Metric[] {
  const rows = payload.rows;
  const total = payload.pagination.total;
  const status = (value: string) => rows.filter((row) => String(row.status ?? "") === value).length;
  if (report === "platform_summary") {
    const row = rows[0] ?? {};
    const roleCount = Object.values((row.role_counts as Record<string, unknown> | undefined) ?? {}).reduce<number>((sum, value) => sum + numeric(value), 0);
    const subscriptions = (row.subscription_states as Record<string, unknown> | undefined) ?? {};
    const activeSubscriptions = numeric(subscriptions.active);
    const providers = Array.isArray(row.provider_readiness) ? row.provider_readiness : [];
    const readyProviders = providers.filter((provider) => provider && typeof provider === "object" && (provider as Record<string, unknown>).enabled === true).length;
    return [
      { label: "גנים", value: formatNumber(numeric(row.garden_count)), hint: "בפלטפורמה", tone: "blue" },
      { label: "משתמשים", value: formatNumber(roleCount), hint: "מצטבר לפי תפקיד", tone: "green" },
      { label: "מנויים פעילים", value: formatNumber(activeSubscriptions), hint: "גן → גן בטוח", tone: "blue" },
      { label: "ספקים זמינים", value: formatNumber(readyProviders), hint: "לפי תצורת Backend", tone: readyProviders ? "green" : "orange" }
    ];
  }
  if (["dashboard", "network_summary", "parent_summary"].includes(report)) {
    const row = rows[0] ?? {};
    const entries = [
      ["garden_count", "גנים", "מורשים בדוח"],
      ["attendance_records", "רשומות נוכחות", "בטווח שנבחר"],
      ["present", "נוכחים", "לפי מקור הנוכחות"],
      ["open_tasks", "משימות פתוחות", "דורשות טיפול"],
      ["open_complaints", "תלונות פתוחות", "לפי הרשאה"],
      ["outstanding_tuition", "יתרת שכר לימוד", "הורים → גן"]
    ].filter(([key]) => row[String(key)] != null).slice(0, 4);
    return entries.map(([key, label, hint], index) => ({ label: String(label), value: key === "outstanding_tuition" ? formatMoney(numeric(row[String(key)])) : formatNumber(numeric(row[String(key)])), hint: String(hint), tone: index === 1 ? "green" : "blue" }));
  }
  if (report === "attendance") {
    const present = rows.filter((row) => ["present", "checked_in", "checked_out", "departed"].includes(String(row.status))).length;
    const absent = rows.filter((row) => String(row.status) === "absent").length;
    const departed = rows.filter((row) => ["departed", "checked_out"].includes(String(row.status))).length;
    return [
      { label: "רשומות", value: formatNumber(total), hint: "בטווח הנבחר", tone: "blue" },
      { label: "נוכחות ברשומות", value: `${rows.length ? Math.round((present / rows.length) * 100) : 0}%`, hint: "מתוך הרשומות המוצגות", tone: "green" },
      { label: "היעדרויות", value: formatNumber(absent), hint: "ברשומות המוצגות", tone: "red" },
      { label: "יציאות", value: formatNumber(departed), hint: "ברשומות המוצגות", tone: "orange" }
    ];
  }
  if (report === "staff_hours") {
    const minutes = rows.reduce((sum, row) => sum + numeric(row.worked_minutes), 0);
    const missing = rows.filter((row) => Boolean(row.missing_clock_out)).length;
    const labor = rows.reduce((sum, row) => sum + numeric(row.estimated_labor_cost), 0);
    return [
      { label: "משמרות", value: formatNumber(total), hint: "בטווח הנבחר", tone: "blue" },
      { label: "שעות מוצגות", value: formatNumber(minutes / 60), hint: "לפי רישום קנוני", tone: "green" },
      { label: "יציאה חסרה", value: formatNumber(missing), hint: "דורש השלמה", tone: missing ? "red" : "green" },
      { label: "עלות מורשית", value: labor ? formatMoney(labor) : "לא זמינה", hint: labor ? "לפי נתוני שכר מורשים" : "לא הוגדרו נתוני עלות", tone: "orange" }
    ];
  }
  if (report === "tuition") {
    const due = rows.reduce((sum, row) => sum + numeric(row.amount_due), 0);
    const paid = rows.reduce((sum, row) => sum + numeric(row.settled_total), 0);
    const outstanding = rows.reduce((sum, row) => sum + numeric(row.outstanding), 0);
    return [
      { label: "חיוב", value: formatMoney(due), hint: "בשורות המוצגות", tone: "blue" },
      { label: "שולם", value: formatMoney(paid), hint: "סילוק קנוני", tone: "green" },
      { label: "יתרה", value: formatMoney(outstanding), hint: "שכר לימוד בלבד", tone: outstanding ? "red" : "green" },
      { label: "התאמה נדרשת", value: formatNumber(status("reconciliation_required")), hint: "לבדיקה", tone: "orange" }
    ];
  }
  if (report === "capacity") {
    return [
      { label: "קיבולת מוגדרת", value: formatNumber(rows.reduce((sum, row) => sum + numeric(row.configured_capacity), 0)), hint: "בכיתות המוצגות", tone: "blue" },
      { label: "משויכים", value: formatNumber(rows.reduce((sum, row) => sum + numeric(row.occupied), 0)), hint: "שיוך פעיל", tone: "green" },
      { label: "מקומות שמורים", value: formatNumber(rows.reduce((sum, row) => sum + numeric(row.reserved), 0)), hint: "שריון פעיל", tone: "orange" },
      { label: "זמינים", value: formatNumber(rows.reduce((sum, row) => sum + numeric(row.available), 0)), hint: "לפי הגדרה תפעולית", tone: "blue" }
    ];
  }
  if (report === "inspections" || report === "inspector_portfolio") {
    const scores = rows.map((row) => numeric(row.weighted_score)).filter((score) => score > 0);
    return [
      { label: "ביקורות", value: formatNumber(total), hint: "בטווח הנבחר", tone: "blue" },
      { label: "ציון ממוצע", value: scores.length ? `${formatNumber(scores.reduce((sum, score) => sum + score, 0) / scores.length)} / 10` : "אין נתון", hint: "מציוני השרת המוצגים", tone: "green" },
      { label: "ממצאים", value: formatNumber(rows.reduce((sum, row) => sum + numeric(row.violation_count), 0)), hint: "בדוחות המוצגים", tone: "orange" },
      { label: "הושלמו", value: formatNumber(status("done") + status("completed") + status("submitted")), hint: "ציון היסטורי נעול", tone: "green" }
    ];
  }
  const buckets = countsBy(rows, "status");
  return [
    { label: "סה״כ", value: formatNumber(total), hint: "בטווח הנבחר", tone: "blue" },
    { label: statusLabels[buckets[0]?.[0] ?? ""] ?? "סטטוס מוביל", value: formatNumber(buckets[0]?.[1] ?? 0), hint: "ברשומות המוצגות", tone: "green" },
    { label: statusLabels[buckets[1]?.[0] ?? ""] ?? "דורש טיפול", value: formatNumber(buckets[1]?.[1] ?? 0), hint: "ברשומות המוצגות", tone: "orange" },
    { label: "מוצג כעת", value: formatNumber(rows.length), hint: `מוגבל ל־${payload.pagination.page_size} בעמוד`, tone: "blue" }
  ];
}

function reportChartBuckets(report: ReportType, rows: ReportRow[]) {
  if (!rows.length) return [];
  const row = rows[0];
  if (["dashboard", "network_summary", "parent_summary"].includes(report)) {
    return [
      ["נוכחות", numeric(row.attendance_records)],
      ["נוכחים", numeric(row.present)],
      ["משימות פתוחות", numeric(row.open_tasks)],
      ["תלונות פתוחות", numeric(row.open_complaints)]
    ] as Array<[string, number]>;
  }
  if (report === "platform_summary") {
    return [["גנים", numeric(row.garden_count)], ["תלונות פתוחות", numeric(row.open_complaints)]] as Array<[string, number]>;
  }
  if (report === "tuition") {
    return [
      ["חיוב", rows.reduce((sum, item) => sum + numeric(item.amount_due), 0)],
      ["שולם", rows.reduce((sum, item) => sum + numeric(item.settled_total), 0)],
      ["יתרה", rows.reduce((sum, item) => sum + numeric(item.outstanding), 0)]
    ] as Array<[string, number]>;
  }
  if (report === "capacity") {
    return [
      ["משויכים", rows.reduce((sum, item) => sum + numeric(item.occupied), 0)],
      ["שמורים", rows.reduce((sum, item) => sum + numeric(item.reserved), 0)],
      ["זמינים", rows.reduce((sum, item) => sum + numeric(item.available), 0)]
    ] as Array<[string, number]>;
  }
  return countsBy(rows, "status").filter(([label]) => label !== "unknown").slice(0, 7);
}

function ReportChart({ report, rows }: { report: ReportType; rows: ReportRow[] }) {
  const buckets = useMemo(() => reportChartBuckets(report, rows), [report, rows]);
  const max = Math.max(1, ...buckets.map(([, value]) => value));
  if (!buckets.length) return null;
  return (
    <figure className="reports-chart" aria-labelledby="reports-chart-title">
      <figcaption id="reports-chart-title"><span><TrendingUp /> התפלגות הרשומות המוצגות</span><small>כל עמודה מבוססת על נתוני הדוח שהתקבלו מהשרת.</small></figcaption>
      <div className="reports-chart-bars" role="img" aria-label={buckets.map(([label, value]) => `${statusLabels[label] ?? label}: ${value}`).join(", ")}>
        {buckets.map(([label, value], index) => <div key={label}><span style={{ "--bar-height": `${Math.max(8, (value / max) * 100)}%`, "--bar-index": index } as React.CSSProperties}><b>{value}</b></span><small>{statusLabels[label] ?? label.replaceAll("_", " ")}</small></div>)}
      </div>
      <ul className="reports-chart-text">{buckets.map(([label, value]) => <li key={label}><i aria-hidden="true" /><span>{statusLabels[label] ?? label.replaceAll("_", " ")}</span><strong>{value}</strong></li>)}</ul>
    </figure>
  );
}

export function ReportsCenter({ role, gardenId, gardens = [], childOptions = [] }: { role: ReportingRole; gardenId?: string | null; gardens?: ReportScopeOption[]; childOptions?: ReportScopeOption[] }) {
  const dates = useMemo(() => initialDates(), []);
  const [activeReport, setActiveReport] = useState<ReportType>(defaultReport[role]);
  const [category, setCategory] = useState<keyof typeof categoryLabels>("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<RequestConfig["range"]>("month");
  const [from, setFrom] = useState(dates.from);
  const [to, setTo] = useState(dates.to);
  const [selectedGarden, setSelectedGarden] = useState(gardenId ?? "");
  const [selectedChild, setSelectedChild] = useState("");
  const [display, setDisplay] = useState<"summary" | "chart" | "table">("summary");
  const [statusFilter, setStatusFilter] = useState("all");
  const [requestConfig, setRequestConfig] = useState<RequestConfig>({ report: defaultReport[role], range: "month", from: dates.from, to: dates.to, gardenId: gardenId ?? "", childId: "" });
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("");
  const reports = useMemo(() => definitions.filter((item) => item.roles.includes(role)), [role]);
  const filteredReports = useMemo(() => reports.filter((item) => {
    const query = search.trim().toLocaleLowerCase("he");
    return (category === "all" || item.category === category) && (!query || `${item.title} ${item.text}`.toLocaleLowerCase("he").includes(query));
  }), [reports, category, search]);
  const definition = reports.find((item) => item.type === activeReport) ?? reports[0];

  const requestUrl = useCallback((config: RequestConfig, csv = false) => {
    const params = new URLSearchParams({ type: config.report, range: config.range, page_size: csv ? "2000" : "200" });
    if (config.range === "custom") { params.set("from", config.from); params.set("to", config.to); }
    if (config.gardenId) params.set("garden_id", config.gardenId);
    if (config.childId) params.set("child_id", config.childId);
    if (csv) params.set("format", "csv");
    return `/api/reports?${params.toString()}`;
  }, []);
  const load = useCallback(async (config: RequestConfig, signal?: AbortSignal) => {
    setState("loading"); setError("");
    try {
      const response = await fetch(requestUrl(config), { signal, cache: "no-store", headers: { Accept: "application/json" } });
      const body = await response.json() as { data?: ReportPayload; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "לא ניתן לטעון את הדוח כרגע.");
      setPayload(body.data); setState(body.data.rows.length ? "ready" : "empty");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setPayload(null); setError(cause instanceof Error ? cause.message : "לא ניתן לטעון את הדוח כרגע."); setState("error");
    }
  }, [requestUrl]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(requestConfig, controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, requestConfig]);

  function chooseReport(type: ReportType) {
    setActiveReport(type); setStatusFilter("all");
    setRequestConfig({ report: type, range, from, to, gardenId: selectedGarden, childId: selectedChild });
    window.history.replaceState({}, "", `${window.location.pathname}?report=${type}`);
  }
  function generateReport() {
    if (range === "custom" && (!from || !to || from > to)) { setError("יש לבחור טווח תאריכים תקין."); setState("error"); return; }
    setRequestConfig({ report: activeReport, range, from, to, gardenId: selectedGarden, childId: selectedChild });
  }
  const visibleRows = useMemo(() => {
    const rows = payload?.rows ?? [];
    return statusFilter === "all" ? rows : rows.filter((row) => String(row.status ?? row.sla_state ?? "") === statusFilter);
  }, [payload, statusFilter]);
  const statuses = useMemo(() => countsBy(payload?.rows ?? [], "status"), [payload]);
  const metrics = payload ? metricsFor(activeReport, payload) : [];
  const columns = columnsFor(activeReport, visibleRows);
  const exportHref = definition?.csv ? requestUrl(requestConfig, true) : null;
  const copy = roleCopy[role];

  return (
    <section className="reports-platform" aria-labelledby="reports-platform-title">
      <header className="reports-hero">
        <div>
          <span><FileBarChart2 /> {copy.eyebrow}</span>
          <h2 id="reports-platform-title">{copy.title}</h2>
          <p>{copy.text}</p>
          <div className="reports-truth-row"><span><ShieldCheck /> הרשאות נבדקות בכל בקשה</span><span><RefreshCw /> חישוב בזמן הבקשה</span><span><FileSpreadsheet /> CSV מוגבל ומתועד</span></div>
        </div>
        <div className="reports-hero-mark" aria-hidden="true"><BarChart3 /></div>
      </header>

      <div className="reports-workspace">
        <aside className="reports-library" aria-label="ספריית דוחות">
          <div className="reports-panel-heading"><div><small>01</small><span><strong>ספריית דוחות</strong><em>{reports.length} דוחות מורשים</em></span></div></div>
          <label className="reports-search"><Search /><span className="sr-only">חיפוש דוח</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש דוח..." /></label>
          <div className="reports-category-tabs" role="tablist" aria-label="קטגוריות דוחות">
            {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((key) => <button key={key} type="button" role="tab" aria-selected={category === key} className={category === key ? "active" : ""} onClick={() => setCategory(key)}>{categoryLabels[key]}</button>)}
          </div>
          <div className="reports-library-list">
            {filteredReports.map((report) => {
              const Icon = report.icon;
              return <button type="button" className={activeReport === report.type ? "active" : ""} onClick={() => chooseReport(report.type)} key={report.type}><span className={`reports-library-icon ${report.category}`}><Icon /></span><span><strong>{report.title}</strong><small>{report.text}</small></span><ChevronLeft /></button>;
            })}
            {filteredReports.length === 0 ? <div className="reports-library-empty">לא נמצאו דוחות מתאימים לחיפוש.</div> : null}
          </div>
        </aside>

        <main className="reports-main">
          <section className="reports-config" aria-labelledby="reports-config-title">
            <div className="reports-panel-heading"><div><small>02</small><span><strong id="reports-config-title">הגדרת הדוח</strong><em>{definition?.title}</em></span></div><span className="reports-role-chip">{role === "parent" ? "משפחה" : role === "staff" ? "אישי" : role === "inspector" ? "שיוך פיקוח" : role === "admin" ? "מצטבר" : "גן פעיל"}</span></div>
            <div className="reports-config-grid">
              <fieldset>
                <legend>טווח תאריכים</legend>
                <div className="reports-range-tabs">{(["today", "week", "month", "custom"] as const).map((item) => <button type="button" key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item === "today" ? "היום" : item === "week" ? "שבוע" : item === "month" ? "חודש" : "מותאם"}</button>)}</div>
                {range === "custom" ? <div className="reports-date-range"><label><span>מתאריך</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><ArrowLeft aria-hidden="true" /><label><span>עד תאריך</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label></div> : <div className="reports-preset-note"><CalendarDays /> הטווח יחושב לפי אזור הזמן הקנוני של הגן.</div>}
              </fieldset>
              {gardens.length ? <label><span>גן</span><select value={selectedGarden} onChange={(event) => setSelectedGarden(event.target.value)}><option value="">כל הגנים המורשים</option>{gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.label}</option>)}</select></label> : null}
              {childOptions.length > 0 && role === "parent" ? <label><span>ילד/ה</span><select value={selectedChild} onChange={(event) => setSelectedChild(event.target.value)}><option value="">כל הילדים המקושרים</option>{childOptions.map((child) => <option value={child.id} key={child.id}>{child.label}</option>)}</select></label> : null}
              <fieldset>
                <legend>תצוגה</legend>
                <div className="reports-display-tabs"><button type="button" className={display === "summary" ? "active" : ""} onClick={() => setDisplay("summary")}><TrendingUp /> סיכום</button><button type="button" className={display === "chart" ? "active" : ""} onClick={() => setDisplay("chart")}><BarChart3 /> גרף</button><button type="button" className={display === "table" ? "active" : ""} onClick={() => setDisplay("table")}><Table2 /> טבלה</button></div>
              </fieldset>
              <button className="reports-generate" type="button" onClick={generateReport} disabled={state === "loading"}>{state === "loading" ? <LoaderCircle className="spin" /> : <BarChart3 />} יצירת דוח</button>
            </div>
          </section>

          <section className="reports-results" aria-labelledby="reports-results-title" aria-busy={state === "loading"}>
            <div className="reports-panel-heading"><div><small>03</small><span><strong id="reports-results-title">תוצאות הדוח</strong><em>{payload ? `${formatDate(payload.range.from)}–${formatDate(payload.range.to)}` : definition?.title}</em></span></div>{payload ? <span className="reports-freshness"><RefreshCw /> הופק {formatDate(payload.freshness.generated_at, true)}</span> : null}</div>
            {state === "loading" ? <div className="reports-state"><LoaderCircle className="spin" /><strong>טוענים נתוני מקור</strong><span>הדוח מחושב כעת לפי ההרשאה והטווח שנבחרו.</span></div> : null}
            {state === "error" ? <div className="reports-state error" role="alert"><AlertCircle /><strong>הדוח לא נטען</strong><span>{error}</span><button type="button" onClick={generateReport}><RefreshCw /> ניסיון נוסף</button></div> : null}
            {state === "empty" ? <div className="reports-state empty"><FileBarChart2 /><strong>אין נתונים לדוח הזה</strong><span>לא נמצאו רשומות בטווח ובמסננים שנבחרו. מצב ריק אינו שגיאה.</span></div> : null}
            {state === "ready" && payload ? <>
              {payload.notice ? <div className="reports-notice"><AlertCircle /> {payload.notice}</div> : null}
              <div className="reports-metrics">{metrics.map((metric) => <article className={metric.tone ?? "blue"} key={metric.label}><span>{metric.tone === "green" ? <TrendingUp /> : metric.tone === "red" ? <AlertCircle /> : metric.tone === "orange" ? <Clock3 /> : <UsersRound />}</span><div><small>{metric.label}</small><strong>{metric.value}</strong><em>{metric.hint}</em></div></article>)}</div>
              <div className="reports-results-toolbar"><div><ListFilter /><span>תצוגת נתונים</span></div>{statuses.length > 1 ? <label><span className="sr-only">סינון לפי סטטוס</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">כל הסטטוסים</option>{statuses.map(([status, count]) => <option value={status} key={status}>{statusLabels[status] ?? status} ({count})</option>)}</select></label> : null}<span>{visibleRows.length} מתוך {payload.pagination.total}</span></div>
              {display !== "table" ? <ReportChart report={activeReport} rows={visibleRows} /> : null}
              {display !== "chart" ? <>
                <div className="reports-table-wrap"><table><caption className="sr-only">{definition?.title} — נתונים מפורטים</caption><thead><tr>{columns.map((column) => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => <tr key={String(row.id ?? index)}>{columns.map((column) => <td key={column.key}>{column.format === "status" ? <span className={`reports-status ${statusTone(row[column.key])}`}>{displayValue(row[column.key], column.format)}</span> : displayValue(row[column.key], column.format)}</td>)}</tr>)}</tbody></table></div>
                <div className="reports-mobile-cards">{visibleRows.map((row, index) => {
                  const statusColumn = columns.find((column) => column.format === "status");
                  return <article key={String(row.id ?? index)}><header><span>{index + 1}</span><strong>{displayValue(row[columns[0]?.key])}</strong>{statusColumn ? <em className={`reports-status ${statusTone(row[statusColumn.key])}`}>{displayValue(row[statusColumn.key], "status")}</em> : null}</header><dl>{columns.slice(1, 5).filter((column) => column.format !== "status").map((column) => <div key={column.key}><dt>{column.label}</dt><dd>{displayValue(row[column.key], column.format)}</dd></div>)}</dl></article>;
                })}</div>
              </> : null}
            </> : null}
          </section>
        </main>

        <aside className="reports-export" aria-labelledby="reports-export-title">
          <div className="reports-panel-heading"><div><small>04</small><span><strong id="reports-export-title">ייצוא</strong><em>פורמטים נתמכים בלבד</em></span></div></div>
          <div className="reports-format-grid"><span className={exportHref ? "active" : "disabled"}><FileSpreadsheet /><strong>CSV</strong><small>{exportHref ? "זמין" : "לא זמין לדוח מסכם"}</small></span></div>
          <div className="reports-export-truth"><ShieldCheck /><div><strong>ייצוא מאובטח</strong><span>עד 2,000 שורות, עם הגנת נוסחאות ותיעוד ביקורת.</span></div></div>
          {exportHref ? <a className="reports-export-button" href={exportHref}><Download /> הורדת CSV</a> : <button className="reports-export-button" type="button" disabled><Download /> ייצוא אינו זמין</button>}
          <div className="reports-export-note"><AlertCircle /><span><strong>PDF, Excel והדפסה</strong><small>אינם מוצגים כפעילים משום שאינם חלק מייצוא GB‑M36 הקנוני.</small></span></div>
          <div className="reports-scope-card"><Filter /><span><strong>טווח ההרשאה</strong><small>{role === "parent" ? "ילדים מקושרים בלבד" : role === "staff" ? "העסקה פעילה בלבד" : role === "inspector" ? "גנים משויכים בלבד" : role === "admin" ? "נתונים מצטברים בלבד" : "גנים שבניהול בלבד"}</small></span></div>
        </aside>
      </div>
    </section>
  );
}
