import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = file => readFileSync(file, "utf8");
const migration = source("supabase/migrations/20260912080000_management_multi_garden_staff_context.sql");
const context = source("lib/management/staff-employment-context.ts");
const endpoint = source("app/api/staff/employment-context/route.ts");
const attendance = source("app/api/staff/gps-attendance/route.ts");
const shiftApi = source("app/api/staff/shifts/route.ts");

function selection() {
  const output = ts.transpileModule(context, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: () => ({}) });
  return module.exports.chooseStaffEmployment;
}
const choose = selection();
const A = { garden_id: "A", role_title: "Teacher", staff_id: "A-staff" };
const B = { garden_id: "B", role_title: "Assistant", staff_id: "B-staff" };

test("one employment selects automatically, multiple remain distinct and C fails closed", () => {
  assert.equal(choose([A], null, null).garden_id, "A");
  assert.equal(choose([A, B], "B", "A").staff_id, "B-staff");
  assert.equal(choose([A, B], "C", "A"), null);
  assert.equal(choose([B], "A", "A"), null);
  assert.equal(choose([A, B], null, null), null);
});

test("employment list and switch are authenticated and independently authorized", () => {
  assert.match(migration, /e\.profile_id = auth\.uid\(\)/);
  assert.match(migration, /e\.status = 'active'/);
  assert.match(migration, /e\.end_date is null or e\.end_date >= current_date/);
  assert.match(migration, /s\.garden_id = e\.garden_id/);
  assert.match(migration, /staff_employments_for_current_user/);
  assert.match(endpoint, /can_staff_access_garden/);
  assert.match(endpoint, /employments\.some\(item => item\.garden_id === gardenId\)/);
  assert.match(endpoint, /httpOnly: true/);
  assert.doesNotMatch(context, /\.from\("profiles"\)/);
});

test("per-Garden teaching authority requires the same active employment", () => {
  assert.match(migration, /a\.assignment_kind='delegated_teacher'/);
  assert.match(migration, /e\.garden_id=a\.garden_id/);
  assert.match(migration, /e\.end_date is null or e\.end_date>=current_date/);
  assert.match(migration, /can_teach_in_garden/);
});

test("attendance transition binds employment and rejects overlap, wrong Garden and revocation", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /staff_already_clocked_in/);
  assert.match(migration, /existing\.garden_id <> target_garden_id/);
  assert.match(migration, /staff_employment_denied/);
  assert.match(migration, /employment_id=e\.id/);
  assert.match(attendance, /staff_attendance_transition/);
  assert.match(attendance, /staffAccess\.employment\?\.garden_id === payload\.garden_id/);
  assert.doesNotMatch(attendance, /onConflict: "staff_id,garden_id,shift_date"/);
});

test("manager hours and staff shifts remain Garden-scoped", () => {
  for (const page of ["page", "operations/page", "attendance/page", "shifts/page"]) {
    const content = source(`app/dashboard/staff/${page}.tsx`);
    assert.match(content, /employment!/);
    assert.match(content, /\.eq\("garden_id", employment!\.garden_id\)|\.eq\("garden_id", gardenId\)/);
  }
  assert.match(shiftApi, /getManagementGardenContext/);
  assert.match(shiftApi, /\.eq\("garden_id", access\.gardenId\)/);
  assert.match(shiftApi, /input\.garden_id !== access\.gardenId/);
  assert.match(shiftApi, /schedule_staff_employment_shift/);
  assert.match(migration, /staff_scheduling_conflict/);
  assert.match(migration, /s\.profile_id=employee\.profile_id/);
  assert.match(migration, /staff shifts manager write/);
  assert.match(migration, /s\.profile_id=auth\.uid\(\)/);
});

test("tasks, messages, children and cameras use only verified selected Garden", () => {
  for (const name of ["tasks", "messages", "child-journal", "cameras"]) {
    const content = source(`app/dashboard/staff/${name}/page.tsx`);
    assert.match(content, /requireOperationalRole\(\["staff"\]\)/);
    assert.match(content, /profile\.garden_id/);
  }
  assert.match(source("lib/management/operational-role.ts"), /session\.profile\.garden_id = employment\.garden_id/);
});

test("Digital Observer core is untouched", () => {
  assert.doesNotMatch(migration + context + endpoint + attendance, /digital.observer|observer_|camera_streams/i);
});
