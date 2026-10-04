import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const shell = read("components/role-app-shell.tsx");
const dashboard = read("app/dashboard/parent/page.tsx");
const family = read("app/dashboard/parent/family-home/page.tsx");
const attendance = read("app/dashboard/parent/attendance/page.tsx");
const camera = read("app/dashboard/parent/cameras/page.tsx");
const payments = read("app/dashboard/parent/payments/page.tsx");
const documents = read("app/dashboard/parent/documents/page.tsx");
const messages = read("app/dashboard/parent/messages/page.tsx");
const discovery = read("app/dashboard/parent/discover-kindergartens/page.tsx");
const profile = read("app/dashboard/parent/children/[id]/page.tsx");

test("Parent shell exposes the complete approved platform without candidate or owner tools", () => {
  for (const route of ["/dashboard/parent/attendance", "/dashboard/parent/payments", "/dashboard/parent/cameras", "/dashboard/parent/messages", "/dashboard/parent/notifications", "/dashboard/parent/documents", "/dashboard/parent/settings"]) assert.match(shell, new RegExp(route.replaceAll("/", "\\/")));
  assert.doesNotMatch(shell.slice(shell.indexOf("function parentDesktopNavigation")), /job-market|garden\/finance|staff\/operations/);
});

test("multi-Child context is server scoped and selectable", () => {
  assert.match(dashboard, /selectAuthorizedChild/);
  assert.match(dashboard, /name="child"/);
  assert.match(discovery, /findEligibleGardensForChild/);
  assert.match(discovery, /selectedChild/);
  assert.match(family, /getParentFamilyContext/);
});

test("Parent attendance is read from canonical attendance records and never inferred from cameras", () => {
  assert.match(attendance, /from\("attendance"/);
  assert.match(attendance, /\.eq\("child_id", selected\.id\)/);
  assert.match(attendance, /מצלמות או זיהוי חזותי אינם קובעים/);
  assert.doesNotMatch(attendance, /insert\(|update\(|upsert\(/);
});

test("Parent cameras remain capability and policy truthful", () => {
  assert.match(camera, /getParentCameraListForProfile/);
  assert.match(camera, /אין שידור|אימות|הרשאה/);
  assert.doesNotMatch(camera, /mock AI|shadow AI|זיהוי ודאי/);
});

test("tuition, documents, and messaging reuse canonical domains", () => {
  assert.match(payments, /tuition_billing_periods/);
  assert.match(payments, /תשלומי הורים שייכים לגן הילדים/);
  assert.doesNotMatch(payments, /platform_subscriptions/);
  assert.match(documents, /effectiveDocumentStatus/);
  assert.match(messages, /InternalMessagingCenter/);
});

test("Child profile links all parent-safe operational surfaces", () => {
  for (const route of ["attendance", "cameras", "documents", "payments", "messages"]) assert.match(profile, new RegExp(`dashboard/parent/${route}`));
});

test("Parent visual contract is RTL-first and mobile responsive", () => {
  const css = read("app/styles/dashboard-runtime.css");
  const layout = read("app/layout.tsx");
  assert.match(layout, /dir="rtl"/);
  assert.match(css, /UX-IMPLEMENT-05/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /ux05-attendance-history/);
});
