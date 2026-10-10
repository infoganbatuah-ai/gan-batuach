import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const children = read("app/dashboard/garden/children/page.tsx");
const profile = read("app/dashboard/garden/children/[id]/page.tsx");
const enrollment = read("app/dashboard/garden/enrollment-requests/page.tsx");
const classroomApi = read("app/api/garden/classrooms/route.ts");
const profileApi = read("app/api/garden/children/[id]/profile/route.ts");
const styles = read("app/styles/dashboard-runtime.css");

test("Children and profile use the canonical active Garden context", () => {
  assert.match(children, /getManagementGardenContext/);
  assert.match(profile, /getManagementGardenContext/);
  assert.match(enrollment, /getManagementGardenContext/);
  assert.doesNotMatch(`${children}\n${profile}\n${enrollment}`, /profile\.garden_id/);
  assert.match(profileApi, /getManagementGardenContext/);
  assert.match(profileApi, /eq\("garden_id", access\.gardenId\)/);
});

test("Children workspace preserves canonical domain capabilities", () => {
  for (const source of ["children", "attendance", "classrooms", "classroom_seat_reservations", "child_kindergarten_enrollments"]) assert.ok(children.includes(source), source);
  assert.match(children, /חיפוש לפי שם ילד/);
  assert.match(children, /section === "classrooms"/);
  assert.match(children, /capacity_limit/);
  assert.match(children, /reserved/);
  assert.match(children, /overCapacity/);
  assert.match(classroomApi, /assign_child/);
  assert.match(classroomApi, /assign_child_to_classroom/);
});

test("Child profile exposes real role-safe domains without camera authority", () => {
  for (const source of ["attendance", "child_guardian_links", "authorized_pickup_contacts", "child_pickup_events", "documents", "tuition_billing_periods", "messages", "child_classroom_assignments", "child_kindergarten_enrollments", "child_timeline_events"]) assert.ok(profile.includes(source), source);
  for (const tab of ["overview", "attendance", "guardians", "pickup", "documents", "tuition", "communication", "history"]) assert.ok(profile.includes(`\"${tab}\"`), tab);
  assert.match(profile, /צילום או התאמת פנים אינם סמכות שחרור/);
  assert.match(profile, /שכר לימוד זה נפרד ממנוי הגן/);
  assert.doesNotMatch(profile, /camera.*attendance|face.*release_confirmed/i);
});

test("Enrollment lifecycle stays explicit and atomic", () => {
  for (const state of ["submitted", "information_required", "resubmitted", "awaiting_payment", "waitlisted", "rejected", "cancelled", "activated", "payment_reconciliation_required"]) assert.ok(enrollment.includes(state), state);
  assert.match(enrollment, /ManualEnrollmentActivationForm/);
  assert.match(enrollment, /ApplicationDecisionForm/);
  assert.match(enrollment, /classroom_seat_reservations/);
  assert.match(enrollment, /ההפעלה אטומית/);
  assert.doesNotMatch(enrollment, /TeacherAiInsight/);
  assert.match(enrollment, /getManagementGardenContext/);
  assert.match(enrollment, /const scopedRows/);
  assert.match(enrollment, /\.in\("id", childFileIds\)/);
  assert.match(enrollment, /\.in\("id", parentIds\)/);
  assert.doesNotMatch(enrollment, /admin\.from\("kindergarten_enrollment_requests"\)/);
});

test("approved visual system has distinct desktop and mobile compositions", () => {
  for (const selector of [".ux04-domain-workspace", ".ux04-children-table", ".ux04-mobile-child-list", ".ux04-classroom-grid", ".ux04-profile-hero", ".ux04-enrollment-layout", ".ux04-mobile-enrollment-list"]) assert.ok(styles.includes(selector), selector);
  assert.match(styles, /@media \(max-width: 720px\)/);
  assert.match(styles, /\.ux04-children-table,[^]*display: none/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /#0e2f70|#0c47b6/);
});

test("UX-04 does not introduce Digital Observer core code", () => {
  const combined = `${children}\n${profile}\n${enrollment}\n${profileApi}`;
  assert.doesNotMatch(combined, /services\/digital-observer|digital_observer_core|local_mock|shadow_ai/i);
});
