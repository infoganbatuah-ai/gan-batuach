import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCsv,
  moneyFromMinorUnits,
  moneyMinorUnits,
  REPORT_EXPORT_ROW_MAX,
  resolveReportPage,
  resolveReportRange,
  roleCanReadReport,
  safeReportFilename
} from "../../lib/management/reporting.ts";

const route = await readFile(new URL("../../app/api/reports/route.ts", import.meta.url), "utf8");

test("standard report ranges use the supplied canonical timezone and enforce one-year bound", () => {
  const now = new Date("2026-09-22T21:30:00.000Z");
  assert.deepEqual(resolveReportRange(new URLSearchParams("range=today"), "Asia/Jerusalem", now), {
    preset: "today", from: "2026-09-23", to: "2026-09-23", timezone: "Asia/Jerusalem", days: 1
  });
  assert.throws(() => resolveReportRange(new URLSearchParams("range=custom&from=2024-01-01&to=2026-01-01"), "UTC", now));
});

test("pagination and exports are bounded", () => {
  assert.equal(resolveReportPage(new URLSearchParams("page_size=9999")).pageSize, 200);
  assert.equal(resolveReportPage(new URLSearchParams("page=3"), true).pageSize, REPORT_EXPORT_ROW_MAX);
});

test("report catalog enforces least-privilege roles", () => {
  assert.equal(roleCanReadReport("parent", "tuition"), true);
  assert.equal(roleCanReadReport("parent", "platform_summary"), false);
  assert.equal(roleCanReadReport("staff", "staff_hours"), true);
  assert.equal(roleCanReadReport("staff", "tuition"), false);
  assert.equal(roleCanReadReport("inspector", "inspections"), true);
  assert.equal(roleCanReadReport("inspector", "staff_hours"), false);
  assert.equal(roleCanReadReport("admin", "platform_summary"), true);
  assert.equal(roleCanReadReport("admin", "documents"), false);
});

test("CSV neutralizes spreadsheet formulas and preserves Hebrew Unicode", () => {
  const csv = buildCsv(["name", "value"], [
    { name: "גן בדיקה", value: "=HYPERLINK(\"https://bad.invalid\")" },
    { name: "+cmd", value: "-2" },
    { name: " @SUM(A1:A2)", value: "safe" }
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /גן בדיקה/);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+cmd/);
  assert.match(csv, /'-2/);
  assert.match(csv, /' @SUM/);
  assert.equal(safeReportFilename("attendance", "2026-09-01", "2026-09-22"), "gan-batuach-attendance-2026-09-01-2026-09-22.csv");
});

test("financial aggregation uses minor units", () => {
  const total = moneyMinorUnits("0.10") + moneyMinorUnits("0.20");
  assert.equal(total, 30);
  assert.equal(moneyFromMinorUnits(total), 0.3);
});

test("report route keeps authorization, privacy and audit boundaries explicit", () => {
  assert.doesNotMatch(route, /createAdminClient|service[_-]?role/i);
  assert.doesNotMatch(route, /\.select\(\s*["'`]\*["'`]/);
  assert.match(route, /resolveManagementGardenContext/);
  assert.match(route, /getParentFamilyContext/);
  assert.match(route, /getOperationalRoleContext/);
  assert.match(route, /management_report_export/);
  assert.match(route, /Cache-Control["']:\s*["']private, no-store/);
  assert.doesNotMatch(route, /messages[^\n]+body|complaints[^\n]+description|documents[^\n]+storage_path/);
});

test("report reads bypass the Next data cache so source corrections stay current", () => {
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /export const fetchCache = "force-no-store"/);
});
