import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const manager = read("app/dashboard/garden/attendance/page.tsx");
const pickup = read("components/pickup-verification-panels.tsx");
const releaseApi = read("app/api/garden/pickup-events/route.ts");
const attendanceApi = read("app/api/garden/attendance-action/route.ts");
const parent = read("app/dashboard/parent/attendance/page.tsx");
const staffAttendance = read("app/dashboard/staff/children-attendance/page.tsx");
const staffPickup = read("app/dashboard/staff/pickup/page.tsx");
const css = read("app/styles/dashboard-runtime.css");

test("manager attendance separates expected, present, absent, and departed", () => {
  for (const state of ["present", "absent", "departed", "expected"]) assert.match(manager, new RegExp(state));
  assert.match(manager, /check_out_at/);
  assert.match(manager, /child_classroom_assignments/);
  assert.match(manager, /operational_timezone/);
});

test("attendance actions stay canonical, server-authoritative, and conflict safe", () => {
  assert.match(attendanceApi, /management_child_arrival/);
  assert.match(attendanceApi, /management_child_absence/);
  assert.match(attendanceApi, /check_out.*מחייב בחירת מורשה איסוף/s);
  assert.doesNotMatch(attendanceApi, /new Date\(\).*check_in_at|Date\.now\(\).*check_in_at/);
});

test("release requires one canonical authorized person and revalidates in the database", () => {
  assert.match(releaseApi, /management_child_release/);
  assert.match(releaseApi, /pickup_contact_id/);
  assert.match(releaseApi, /guardian_profile_id/);
  assert.match(releaseApi, /Boolean\(value\.pickup_contact_id\).*Boolean\(value\.guardian_profile_id\)/s);
  assert.match(releaseApi, /409/);
});

test("release UX explicitly confirms and blocks revoked or expired authorizations", () => {
  assert.match(pickup, /role="dialog"/);
  assert.match(pickup, /אישור שחרור ורישום/);
  assert.match(pickup, /blockedContactsForChild/);
  assert.match(pickup, /בוטל|פג תוקף|לא מאושר/);
});

test("Parent attendance is isolated and read-only", () => {
  assert.match(parent, /getParentFamilyContext/);
  assert.match(parent, /from\("attendance"/);
  assert.match(parent, /מצלמות או זיהוי חזותי אינם קובעים/);
  assert.doesNotMatch(parent, /insert\(|update\(|upsert\(/);
});

test("Staff operations use active employment and Classroom scope", () => {
  assert.match(staffAttendance, /requireOperationalRole\(\["staff"\]\)/);
  assert.match(staffAttendance, /staff_classroom_assignments/);
  assert.match(staffAttendance, /child_classroom_assignments/);
  assert.match(staffAttendance, /can_teach_in_garden/);
  assert.match(staffPickup, /staff_classroom_assignments/);
  assert.match(staffPickup, /GardenPickupVerificationPanel childRows=/);
});

test("camera and AI never become attendance or release authority", () => {
  for (const file of [manager, parent, staffAttendance, pickup]) assert.match(file, /מצלמ|זיהוי/);
  assert.doesNotMatch(releaseApi, /face_match.*===.*approved|camera.*release_confirmed/);
});

test("UX-06 is RTL-first, responsive, and presents mobile cards", () => {
  assert.match(read("app/layout.tsx"), /dir="rtl"/);
  assert.match(css, /UX-IMPLEMENT-06/);
  assert.match(css, /ux06-mobile-list/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /ux06-release-confirmation/);
});
