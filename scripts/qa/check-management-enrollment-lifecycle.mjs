import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");
const migration = read("supabase/migrations/20260912040000_management_enrollment_request_lifecycle.sql");
const parentApi = read("app/api/parent/enrollment-requests/route.ts");
const managerApi = read("app/api/garden/enrollment-requests/[id]/route.ts");
const invitationApi = read("app/api/parent/garden-invitations/route.ts");

test("one canonical lifecycle and guarded transitions", () => {
  for (const state of ["submitted","under_review","information_required","resubmitted","awaiting_payment","waitlisted","rejected","cancelled","expired"]) assert.match(migration,new RegExp(`'${state}'`));
  assert.match(migration,/invalid_enrollment_transition/);
  assert.match(managerApi,/decide_enrollment_request/);
  assert.doesNotMatch(managerApi,/\.update\(\{[\s\S]*status/);
});

test("submission is guardian authorized, eligible, age matched and duplicate safe", () => {
  assert.match(migration,/can_guardian_access_child/);
  assert.match(migration,/garden_not_accepting_enrollment/);
  assert.match(migration,/child_months not between room\.min_age_months and room\.max_age_months/);
  assert.match(migration,/pg_advisory_xact_lock/);
  assert.match(migration,/enrollment_request_one_active_per_child_garden/);
  assert.match(migration,/active_enrollment_conflict/);
});

test("approval locks request and atomically reserves without activation", () => {
  assert.match(migration,/for update/);
  assert.match(migration,/reserve_classroom_seat/);
  assert.match(migration,/enrollment-request:/);
  assert.match(migration,/next_status:='awaiting_payment'/);
  assert.doesNotMatch(migration,/activateKindergartenEnrollment|activated_child_id=/);
});

test("information, cancellation and waitlist preserve truthful state", () => {
  assert.match(parentApi,/respond_enrollment_information/);
  assert.match(parentApi,/cancel_parent_enrollment_request/);
  assert.match(migration,/status='released'/);
  assert.match(migration,/next_status:='waitlisted'/);
});

test("manager and parent boundaries remain scoped", () => {
  assert.match(managerApi,/getManagementGardenContext/);
  assert.match(managerApi,/\.eq\("garden_id", access\.gardenId\)/);
  assert.match(migration,/can_manage_garden\(req\.garden_id\)/);
  assert.match(parentApi,/guardianChildIds/);
  assert.match(parentApi,/session\.profile\.role !== "parent"/);
});

test("Garden invitation converges without premature activation", () => {
  assert.match(invitationApi,/kindergarten_enrollment_requests/);
  assert.match(invitationApi,/status: "submitted"/);
  assert.doesNotMatch(invitationApi,/activateKindergartenEnrollment/);
});

test("staffing is reported but missing policy is not converted into a legal decision", () => {
  assert.match(migration,/evaluate_classroom_staffing/);
  assert.match(migration,/staffing_readiness/);
  assert.doesNotMatch(migration,/legal_compliance[^\n]*raise exception/);
});
