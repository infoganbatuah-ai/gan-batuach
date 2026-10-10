import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [market, jobDetail, applicationDetail, managerHub, managerDetail, candidateNav, operationalGuard, notifications, recruitmentNotifications, profile, documents, actions, display, css, invitationApi, hiringMigration, managerReviewMigration] = await Promise.all([
  read("app/dashboard/staff/job-market/page.tsx"),
  read("app/dashboard/staff/job-market/[id]/page.tsx"),
  read("app/dashboard/staff/job-market/applications/[id]/page.tsx"),
  read("app/dashboard/garden/staff-applications/page.tsx"),
  read("app/dashboard/garden/staff-applications/[id]/page.tsx"),
  read("components/staff-app-ui.tsx"),
  read("lib/management/operational-role.ts"),
  read("app/dashboard/staff/notifications/page.tsx"),
  read("app/dashboard/staff/recruitment-notifications/page.tsx"),
  read("app/dashboard/staff/settings/page.tsx"),
  read("app/dashboard/staff/documents/page.tsx"),
  read("components/staff-application-actions.tsx"),
  read("lib/domain/recruitment-display.ts"),
  read("app/styles/ux-implement-08.css"),
  read("app/api/staff/invitations/accept/route.ts"),
  read("supabase/migrations/20260912070000_management_staff_hiring_lifecycle.sql"),
  read("supabase/migrations/20260928010000_management_staff_candidate_manager_review.sql")
]);

test("candidate workspace is self-scoped and uses canonical recruitment truth", () => {
  assert.match(market, /requireRole\(\["staff"\]\)/);
  assert.match(market, /evaluate_staff_candidate_profile/);
  assert.match(market, /find_relevant_staff_jobs/);
  assert.match(market, /staff_job_applications/);
  assert.match(jobDetail, /find_relevant_staff_jobs/);
  assert.match(applicationDetail, /\.eq\("staff_candidate_id", profile\.id\)/);
  assert.doesNotMatch(market + jobDetail + applicationDetail, /createAdminClient|distance_km|match_score|AI match/i);
});

test("candidate navigation excludes every active Staff operational surface", () => {
  const candidateBlock = candidateNav.slice(candidateNav.indexOf("const candidateNavigation"), candidateNav.indexOf("return ("));
  for (const forbidden of ["/dashboard/staff/shifts", "/dashboard/staff/children-attendance", "/dashboard/staff/pickup", "/dashboard/staff/cameras", "/dashboard/staff/messages"]) assert.doesNotMatch(candidateBlock, new RegExp(forbidden.replaceAll("/", "\\/")));
  assert.match(candidateBlock, /recruitment-notifications/);
  assert.match(operationalGuard, /resolveStaffEmploymentContext/);
  assert.match(notifications, /requireOperationalRole/);
});

test("recruitment notifications are candidate-safe and separate from operational notifications", () => {
  assert.match(recruitmentNotifications, /requireRole\(\["staff"\]\)/);
  assert.match(recruitmentNotifications, /recipient_id\.eq/);
  assert.match(recruitmentNotifications, /staff_job_applications/);
  assert.doesNotMatch(recruitmentNotifications, /garden_id\.eq|recipient_role\.eq/);
});

test("professional profile and documents reuse canonical APIs and storage", () => {
  assert.match(profile, /StaffCandidateProfileForm/);
  assert.match(profile, /evaluate_staff_candidate_profile/);
  assert.match(documents, /StaffCandidateDocumentUpload/);
  assert.match(actions, /\/api\/staff\/job-applications/);
  assert.match(display, /uploaded.*ממתין לבדיקה/s);
});

test("manager recruitment remains scoped to the active Garden", () => {
  assert.match(managerHub, /resolveManagementGardenContext/);
  assert.match(managerHub, /\.eq\("garden_id", gardenId\)/);
  assert.match(managerDetail, /\.eq\("id", id\)\.eq\("garden_id", gardenId\)/);
  assert.match(managerDetail, /ApplicationDecisionForm/);
  assert.match(managerHub + managerDetail, /הגישה התפעולית נפתחת רק/);
  assert.match(managerReviewMigration, /exists\s*\([\s\S]*staff_job_applications/);
  assert.match(managerReviewMigration, /can_manage_garden\(application\.garden_id\)/);
  assert.doesNotMatch(managerReviewMigration, /can_access_garden/);
});

test("application states, signed invitations and activation handoff stay canonical", () => {
  for (const state of ["submitted", "information_required", "resubmitted", "awaiting_candidate_acceptance", "rejected", "withdrawn", "cancelled", "employed"]) assert.match(display + hiringMigration, new RegExp(state));
  assert.match(invitationApi, /resolveSignedInvitation/);
  assert.match(invitationApi, /verifiedEmail/);
  assert.match(invitationApi, /activate_staff_employment/);
  assert.match(actions, /window\.location\.assign\("\/dashboard\/staff"\)/);
});

test("UX-08 visual layer has distinct desktop and mobile compositions", () => {
  assert.match(css, /\.ux08-recruitment-hero/);
  assert.match(css, /\.ux08-manager-candidate-hero/);
  assert.match(css, /\.ux08-application-timeline/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /focus-visible/);
});

test("candidate UI does not fabricate unsupported interview, camera or AI capability", () => {
  const ui = market + jobDetail + applicationDetail + managerHub + managerDetail;
  assert.doesNotMatch(ui, /ראיון נקבע|שיחת וידאו|ציון התאמה|אחוז התאמה|מצלמה חיה|זיהוי פנים/);
});
