import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = file => readFileSync(file, "utf8");
const migrationFile = "supabase/migrations/20260910050000_management_teaching_assignments.sql";

test("canonical assignments preserve owner and staff identities", () => {
  const migration = source(migrationFile);
  assert.match(migration, /create table if not exists public\.garden_teaching_assignments/);
  assert.match(migration, /assignment_kind in \('owner_teacher', 'delegated_teacher'\)/);
  assert.match(migration, /garden_teaching_assignments_actor_shape_check/);
  assert.match(migration, /garden_teaching_assignments_profile_unique unique \(garden_id, profile_id\)/);
});

test("database validates exact owner and active delegated staff semantics", () => {
  const migration = source(migrationFile);
  assert.match(migration, /garden_owner is distinct from new\.profile_id/);
  assert.match(migration, /garden_ownership <> 'teacher_is_owner'/);
  assert.match(migration, /delegated_teacher_requires_active_staff_employment/);
  assert.match(migration, /employment\.status = 'active'/);
  assert.match(migration, /s\.approved_to_work is true/);
});

test("teaching authority is narrow and independent of management authority", () => {
  const migration = source(migrationFile);
  assert.match(migration, /can_teach_in_garden/);
  assert.match(migration, /required_scope in \('children','attendance','journal','communication'\)/);
  assert.match(migration, /never grant garden management authority/);
  const functionBody = migration.slice(migration.indexOf("create or replace function public.can_teach_in_garden"), migration.indexOf("revoke all on function"));
  assert.doesNotMatch(functionBody, /can_manage_garden/);
});

test("management API checks tenant and eligibility before privileged writes", () => {
  const route = source("app/api/garden/teaching-assignments/route.ts");
  assert.match(route, /getManagementGardenContext/);
  assert.match(route, /garden\.owner_profile_id !== access\.session\.profile\.id/);
  assert.match(route, /staff\.onboarding_status !== "active"/);
  assert.match(route, /staff_kindergarten_employments/);
  assert.match(route, /\.eq\("garden_id", access\.gardenId\)/);
  assert.match(route, /writeAdminActionEvent/);
});

test("staff UI exposes owner-teacher and delegated-teacher controls", () => {
  const page = source("app/dashboard/garden/staff/page.tsx");
  const panel = source("components/teaching-assignments-panel.tsx");
  assert.match(page, /garden_teaching_assignments/);
  assert.match(page, /TeachingAssignmentsPanel/);
  assert.match(panel, /בעלים שהוא גם גננת/);
  assert.match(panel, /האצלת הוראה/);
  assert.match(panel, /אינה מעניקה הרשאות ניהול גן/);
});

test("staff teaching writes enforce the canonical scope decision", () => {
  const guard = source("lib/management/teaching-access.ts");
  assert.match(guard, /profile\.role !== "staff"/);
  assert.match(guard, /rpc\("can_teach_in_garden"/);
  for (const [file, scope] of [
    ["app/api/garden/attendance-action/route.ts", "attendance"],
    ["app/api/child-daily-journals/route.ts", "journal"],
    ["app/api/garden/children/[id]/operations/route.ts", "children"]
  ]) assert.match(source(file), new RegExp(`requireStaffTeachingScope\\(profile, "${scope}"\\)`), `${file}: teaching scope guard missing`);
});
