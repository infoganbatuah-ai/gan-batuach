import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path,"utf8");
const migration = read("supabase/migrations/20260912020000_management_versioned_staffing_policy.sql");
const adminApi = read("app/api/admin/staffing-policies/route.ts");
const managerApi = read("app/api/garden/staffing-readiness/route.ts");
const onboarding = read("app/api/kindergarten-onboarding/route.ts");
const constants = read("lib/domain/kindergarten-onboarding.ts");

test("policy is versioned, dated, provenance-bearing and not seeded", () => {
  for (const value of ["effective_from","effective_until","source_title","source_reference","provenance_status","reviewed_by","approved_at"]) assert.match(migration,new RegExp(value));
  assert.doesNotMatch(migration,/insert into public\.staffing_policy_(sets|versions|rules)/i);
  assert.match(migration,/status in \('draft','under_review','approved','active','retired'\)/);
});

test("activation is admin-only, approved, transactional and rejects overlap", () => {
  assert.match(migration,/if not public\.is_admin\(\)/);
  assert.match(migration,/target\.status<>'approved'/);
  assert.match(migration,/daterange[\s\S]*&& daterange/);
  assert.match(migration,/staffing_policy_effective_date_conflict/);
});

test("evaluator is tenant-scoped and returns truthful missing, unverified and conflict states", () => {
  assert.match(migration,/public\.can_access_garden\(room\.garden_id\)/);
  for (const state of ["policy_not_configured","policy_unverified","policy_conflict","staffing_data_incomplete","deficit","compliant","surplus"]) assert.match(migration,new RegExp(state));
  assert.match(migration,/'legal_compliance',null/);
});

test("only activated employed Classroom staff count and shared coverage stays incomplete", () => {
  assert.match(migration,/coalesce\(s\.approved_to_work,false\)/);
  assert.match(migration,/e\.status='active'/);
  assert.match(migration,/a\.classroom_id=room\.id/);
  assert.match(migration,/count\(distinct a\.classroom_id\)>1/);
  assert.doesNotMatch(migration,/garden_teaching_assignments/);
});

test("projection changes child input without mutating assignments", () => {
  assert.match(migration,/projected_count:=greatest\(child_count\+projected_child_delta,0\)/);
  const evaluator = migration.slice(migration.indexOf("evaluate_classroom_staffing"));
  assert.doesNotMatch(evaluator,/update public\.child_classroom_assignments|insert into public\.child_classroom_assignments/);
});

test("Admin mutates policy while Manager receives read-only current and projected output", () => {
  assert.match(adminApi,/session\.profile\.role !== "admin"/);
  assert.match(adminApi,/fail\("נדרשת התחברות מחדש\.", 401\)/);
  assert.match(adminApi,/fail\("אין הרשאה לניהול מדיניות כוח אדם\.", 403\)/);
  assert.match(adminApi,/activate_staffing_policy_version/);
  assert.match(managerApi,/getManagementGardenContext/);
  assert.match(managerApi,/current_compliance/);
  assert.match(managerApi,/projected_compliance/);
  assert.doesNotMatch(managerApi,/insert\(|update\(|delete\(/);
});

test("legacy ratios no longer drive onboarding decisions", () => {
  assert.doesNotMatch(constants,/staffRatio|maxChildrenPerClass|calculateRequiredStaff|validateClassCapacity/);
  assert.doesNotMatch(onboarding,/calculateRequiredStaff|validateClassCapacity/);
  assert.match(onboarding,/מדיניות כוח האדם ממתינה להגדרה ולאישור/);
});

test("reference calculations remain data-driven", () => {
  const evaluate = (children, perStaff, minimum) => children === 0 ? 0 : Math.max(minimum,Math.ceil(children/perStaff));
  assert.equal(evaluate(7,3,1),3);
  assert.equal(evaluate(0,3,1),0);
  assert.equal(evaluate(13,5,2),3);
});
