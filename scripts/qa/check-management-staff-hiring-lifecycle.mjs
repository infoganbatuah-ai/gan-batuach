import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20260912070000_management_staff_hiring_lifecycle.sql", "utf8");
const submitApi = await readFile("app/api/staff/job-applications/route.ts", "utf8");
const decisionApi = await readFile("app/api/garden/staff-applications/[id]/route.ts", "utf8");
const invitationApi = await readFile("app/api/garden/staff-invitations/route.ts", "utf8");
const acceptanceApi = await readFile("app/api/staff/invitations/accept/route.ts", "utf8");
const registrationApi = await readFile("app/api/self-service/register/route.ts", "utf8");
const operationalRole = await readFile("lib/management/operational-role.ts", "utf8");

test("candidate submissions are complete, qualified, canonical and idempotent", () => {
  assert.match(migration, /submit_staff_job_application/);
  assert.match(migration, /evaluate_staff_candidate_profile/);
  assert.match(migration, /required_qualification_missing/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /staff_application_one_active_opening_idx/);
  assert.match(submitApi, /submit_staff_job_application/);
  assert.doesNotMatch(submitApi, /\.from\("staff"/);
});

test("application transitions and information requests are server controlled", () => {
  assert.match(migration, /information_required/);
  assert.match(migration, /resubmitted/);
  assert.match(migration, /awaiting_candidate_acceptance/);
  assert.match(migration, /staff_application_transition_invalid/);
  assert.match(decisionApi, /decide_staff_job_application/);
  assert.doesNotMatch(decisionApi, /createAdminClient/);
});

test("signed invitations reuse GB-M05 and are bound to recipient and job", () => {
  assert.match(invitationApi, /createSignedInvitation/);
  assert.match(invitationApi, /deliverSignedInvitation/);
  assert.match(invitationApi, /intendedRole: "staff"/);
  assert.match(acceptanceApi, /resolveSignedInvitation/);
  assert.match(acceptanceApi, /verifiedEmail/);
  assert.match(acceptanceApi, /target_profile_id/);
  assert.doesNotMatch(invitationApi, /temporary_password|password:/);
});

test("new users preserve invitation context through registration and verification", () => {
  assert.match(registrationApi, /expectedRole/);
  assert.match(registrationApi, /staff_candidate/);
  assert.match(registrationApi, /invite\/accept\?token=/);
});

test("employment activation is atomic, replay safe and same-Garden scoped", () => {
  assert.match(migration, /activate_staff_employment/);
  assert.match(migration, /staff_employment_one_active_garden_idx/);
  assert.match(migration, /staff_application_classroom_invalid/);
  assert.match(migration, /staff_classroom_assignments/);
  assert.match(migration, /status='employed'/);
  assert.match(acceptanceApi, /activate_staff_employment/);
});

test("role alone does not grant operational Garden access", () => {
  assert.match(operationalRole, /staff_kindergarten_employments/);
  assert.match(operationalRole, /\.eq\("status", "active"\)/);
  assert.match(operationalRole, /approved_to_work/);
});

test("manager and candidate scopes remain explicit", () => {
  assert.match(migration, /can_manage_garden\(application\.garden_id\)/);
  assert.match(migration, /staff_candidate_id=auth\.uid\(\)/);
  assert.match(migration, /revoke insert,update,delete/);
  assert.match(decisionApi, /access\.gardenId/);
});

test("Digital Observer core is outside the hiring lifecycle", () => {
  assert.doesNotMatch(migration, /observer_|camera_|ai_event/);
  assert.doesNotMatch(submitApi + decisionApi + invitationApi + acceptanceApi, /digital-observer|camera|observer/);
});
