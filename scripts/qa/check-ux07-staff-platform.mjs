import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const shell = read("components/role-app-shell.tsx");
const clock = read("components/staff-attendance-actions.tsx");
const clockApi = read("app/api/staff/gps-attendance/route.ts");
const staffHome = read("app/dashboard/staff/page.tsx");
const staffSettings = read("app/dashboard/staff/settings/page.tsx");
const staffShifts = read("app/dashboard/staff/shifts/page.tsx");
const managerStaff = read("app/dashboard/garden/staff/page.tsx");
const managerTime = read("app/dashboard/garden/staff-time/page.tsx");
const camera = read("app/dashboard/staff/cameras/page.tsx");
const css = read("app/styles/dashboard-runtime.css");

test("Staff navigation keeps all active-employment capabilities discoverable", () => {
  for (const route of ["/dashboard/staff/shifts", "/dashboard/staff/children-attendance", "/dashboard/staff/pickup", "/dashboard/staff/tasks", "/dashboard/staff/messages", "/dashboard/staff/documents", "/dashboard/staff/cameras", "/dashboard/staff/settings"]) assert.match(shell, new RegExp(route));
});

test("active Staff pages resolve canonical employment and Garden scope", () => {
  assert.match(staffHome, /requireOperationalRole\(\["staff"\]\)/);
  assert.match(staffHome, /staff_classroom_assignments/);
  assert.match(staffSettings, /resolveStaffEmploymentContext/);
  assert.match(staffSettings, /staff_kindergarten_employments/);
  assert.match(managerStaff, /getManagementGardenContext/);
  assert.doesNotMatch(managerStaff, /const gardenId = profile\.garden_id/);
});

test("clock actions use canonical server transition and server time", () => {
  assert.match(clock, /manualAttendance/);
  assert.match(clock, /"check_in" \| "check_out"/);
  assert.match(clockApi, /staff_attendance_transition/);
  assert.match(clockApi, /const timestamp = new Date\(\)/);
  assert.match(clockApi, /profile\.role !== "staff"/);
  assert.match(clockApi, /getOperationalRoleContext/);
});

test("shifts and hours surface missing clock-out without inventing payroll", () => {
  assert.match(staffShifts, /חסרה יציאה/);
  assert.match(managerTime, /missing_clock_out/);
  assert.match(managerTime, /אינה מחשבת מס, שכר נטו או תלוש/);
  assert.match(managerTime, /management_staff_time_export/);
});

test("candidate and active employment remain distinct", () => {
  assert.match(staffHome, /mode="candidate"/);
  assert.match(staffHome, /requireOperationalRole/);
  assert.match(staffSettings, /active \? "assigned" : "candidate"/);
});

test("Staff camera access stays policy and capability bound", () => {
  assert.match(camera, /staff_view_allowed/);
  assert.match(camera, /productionVerified|capability|playback_source/);
  assert.match(camera, /permission|הרשאה|אין גישה|לא זמינה/);
});

test("UX-07 is RTL-first, responsive, and uses the approved Staff visual system", () => {
  assert.match(read("app/layout.tsx"), /dir="rtl"/);
  assert.match(css, /UX-IMPLEMENT-07/);
  assert.match(css, /ux07-staff-profile-card/);
  assert.match(css, /ux07-mobile-time-list/);
  assert.match(css, /@media \(max-width: 820px\)/);
});
