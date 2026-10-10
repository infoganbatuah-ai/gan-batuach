import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const operations = read("app/dashboard/garden/operations/page.tsx");
const dashboard = read("components/manager-overview-dashboard.tsx");
const shell = read("components/role-app-shell.tsx");
const context = read("components/garden-context-switcher.tsx");
const styles = read("app/styles/dashboard-runtime.css");

test("Owner command center keeps canonical truth sources separated", () => {
  for (const source of [
    "child_kindergarten_enrollments", "attendance", "staff_kindergarten_employments",
    "staff_shifts", "tuition_billing_periods", "kindergarten_subscriptions", "documents",
    "complaints", "required_inspections", "violations", "camera_streams", "classrooms",
    "kindergarten_enrollment_requests"
  ]) assert.match(operations, new RegExp(source), source);
  assert.match(dashboard, /שכר לימוד הורים/);
  assert.match(dashboard, /מנוי גן בטוח/);
  assert.match(dashboard, /נפרד מתשלומי הורים/);
  assert.doesNotMatch(dashboard, /Apple Pay|Google Pay|LIVE/);
});

test("desktop and mobile navigation use canonical destinations without resurrecting legacy routes", () => {
  for (const route of [
    "/dashboard/garden/operations", "/dashboard/garden/children", "/dashboard/garden/attendance",
    "/dashboard/garden/staff", "/dashboard/garden/messages", "/dashboard/garden/finance",
    "/dashboard/garden/command-center", "/dashboard/garden/cameras", "/dashboard/garden/documents",
    "/dashboard/garden/reports", "/dashboard/garden/settings"
  ]) assert.ok(shell.includes(route), route);
  assert.doesNotMatch(`${shell}\n${dashboard}`, /inspection-status|pickup-face|observer-pilot/);
  assert.match(shell, /desktopNav/);
  assert.match(shell, /BottomNav[^]*items=\{config\.nav\}/);
});

test("Garden switching stays server authorized and exposes a real active context", () => {
  assert.match(context, /api\/management\/gardens/);
  assert.match(context, /router\.refresh/);
  assert.match(context, /גן פעיל/);
  assert.match(context, /aria-label="החלפת גן פעיל"/);
  assert.match(operations, /requireRole\(\["manager", "owner"\]\)/);
});

test("all required Owner domains have an access surface", () => {
  for (const route of [
    "/dashboard/garden/enrollment-requests", "/dashboard/garden/parents", "/dashboard/garden/pickup",
    "/dashboard/garden/staff-applications", "/dashboard/garden/staff-time", "/dashboard/garden/tuition-ledger",
    "/dashboard/garden/subscription", "/dashboard/garden/communication", "/dashboard/garden/notifications",
    "/dashboard/garden/tasks", "/dashboard/garden/inspections", "/dashboard/garden/corrective-actions",
    "/dashboard/garden/trust-center"
  ]) assert.ok(dashboard.includes(route), route);
});

test("visual system provides the approved navy shell and purpose-built mobile layout", () => {
  assert.match(styles, /\.role-app-owner \.gb-app-shell-sidebar/);
  assert.match(styles, /linear-gradient\(180deg, #0b3a92/);
  assert.match(styles, /\.manager-command-hero/);
  assert.match(styles, /\.manager-today-strip/);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("safety and failures remain truthful", () => {
  assert.match(operations, /safetyCapabilityState/);
  assert.match(dashboard, /אין הצגה של ניטור או אירועי AI לא מאומתים|safety\.detail/);
  assert.match(operations, /מקורות נתונים אינם זמינים/);
  assert.doesNotMatch(operations, /sourceErrors\s*\?\s*0/);
});
