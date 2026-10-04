import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [center, route, reporting, css, gardenPage, parentPage, staffPage, inspectorPage, adminPage, layout] = await Promise.all([
  read("components/reports-center.tsx"),
  read("app/api/reports/route.ts"),
  read("lib/management/reporting.ts"),
  read("app/styles/ux-implement-15.css"),
  read("app/dashboard/garden/reports/page.tsx"),
  read("app/dashboard/parent/reports/page.tsx"),
  read("app/dashboard/staff/reports/page.tsx"),
  read("app/dashboard/inspector/reports/page.tsx"),
  read("app/dashboard/admin/reports/page.tsx"),
  read("app/layout.tsx")
]);

test("Reports Center exposes every canonical GB-M36 reporting domain", () => {
  for (const report of ["dashboard", "attendance", "pickup", "staff_hours", "tuition", "subscription", "enrollment", "capacity", "documents", "inspections", "corrective_actions", "complaints", "tasks", "network_summary", "parent_summary", "staff_summary", "inspector_portfolio", "platform_summary"]) {
    assert.match(center, new RegExp(`type: \"${report}\"`), report);
    assert.match(reporting, new RegExp(`\"${report}\"`), report);
  }
  assert.match(center, /\/api\/reports/);
  assert.doesNotMatch(center, /createClient|createAdminClient|from\(/);
});

test("role surfaces render the shared report experience with canonical scope selectors", () => {
  for (const page of [gardenPage, parentPage, staffPage, inspectorPage, adminPage]) assert.match(page, /<ReportsCenter/);
  assert.match(gardenPage, /resolveManagementGardenContext/);
  assert.match(parentPage, /getParentFamilyContext/);
  assert.match(parentPage, /childOptions=\{children\}/);
  assert.match(inspectorPage, /gardens=\{gardens\.map/);
});

test("role and tenant authorization remains server authoritative", () => {
  assert.match(route, /roleCanReadReport/);
  assert.match(route, /resolveManagementGardenContext/);
  assert.match(route, /getParentFamilyContext/);
  assert.match(route, /resolveStaffEmploymentContext/);
  assert.match(route, /getOperationalRoleContext/);
  assert.match(route, /אין הרשאה לדוח הגן המבוקש/);
  assert.match(route, /אין הרשאה לדוח הילד המבוקש/);
  assert.doesNotMatch(route, /createAdminClient|service[_-]?role/i);
});

test("finance reporting preserves tuition and platform subscription separation", () => {
  assert.match(center, /שכר לימוד בלבד/);
  assert.match(center, /הורים → גן/);
  assert.match(route, /tuition_billing_periods/);
  assert.match(route, /kindergarten_subscriptions/);
  assert.doesNotMatch(route, /generic_payments|unified_balance/i);
});

test("exports stay bounded, audited and formula safe", () => {
  assert.match(reporting, /REPORT_EXPORT_ROW_MAX = 2_000/);
  assert.match(reporting, /\[=\+@-\]/);
  assert.match(route, /management_report_export/);
  assert.match(route, /Cache-Control/);
  assert.match(center, /עד 2,000 שורות/);
  assert.match(center, /PDF, Excel והדפסה/);
  assert.match(center, /אינם מוצגים כפעילים/);
});

test("charts and metrics only derive from current server report rows", () => {
  assert.match(center, /reportChartBuckets\(report, rows\)/);
  assert.match(center, /כל עמודה מבוססת על נתוני הדוח שהתקבלו מהשרת/);
  assert.match(center, /metricsFor\(activeReport, payload\)/);
  assert.doesNotMatch(center, /Math\.random|mockData|fakeData|prediction|forecastRevenue/i);
});

test("failed and empty report states remain distinct and do not become zero data", () => {
  assert.match(center, /"loading" \| "ready" \| "empty" \| "error"/);
  assert.match(center, /מצב ריק אינו שגיאה/);
  assert.match(center, /הדוח לא נטען/);
  assert.match(center, /setPayload\(null\)/);
});

test("Desktop and Mobile are purpose-built, RTL-compatible and accessible", () => {
  for (const selector of ["reports-workspace", "reports-library", "reports-config", "reports-results", "reports-chart", "reports-table-wrap", "reports-mobile-cards", "reports-export"]) assert.match(css, new RegExp(`\\.${selector}`));
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /reports-table-wrap \{ display: none/);
  assert.match(css, /reports-mobile-cards \{ display: grid/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(center, /aria-busy/);
  assert.match(center, /role="img"/);
  assert.match(center, /<caption className="sr-only"/);
  assert.match(layout, /dir="rtl"/);
});

test("report queries remain bounded and query-time fresh", () => {
  assert.match(reporting, /REPORT_PAGE_SIZE_MAX = 200/);
  assert.match(reporting, /REPORT_RANGE_MAX_DAYS = 366/);
  assert.match(route, /force-dynamic/);
  assert.match(route, /force-no-store/);
  assert.match(route, /\.limit\(2_000\)/);
  assert.match(center, /page_size: csv \? "2000" : "200"/);
});
