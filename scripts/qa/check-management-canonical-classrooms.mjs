import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260911040000_management_canonical_classrooms.sql", "utf8");
const api = readFileSync("app/api/garden/classrooms/route.ts", "utf8");
const onboarding = readFileSync("app/api/kindergarten-onboarding/route.ts", "utf8");
const form = readFileSync("components/kindergarten-onboarding-form.tsx", "utf8");

test("Classroom is a Garden-scoped entity separate from category", () => {
  assert.match(migration, /create table if not exists public\.classrooms/);
  for (const field of ["garden_id", "name", "age_group_key", "min_age_months", "max_age_months", "status", "sort_order"]) assert.match(migration, new RegExp(field));
});
test("same age category supports multiple named classrooms", () => {
  assert.match(migration, /unique \(garden_id,name\)/);
  assert.doesNotMatch(migration, /unique \(garden_id,age_group_key\)/);
  assert.match(form, /classroom_counts/);
});
test("child movements preserve one current assignment and history", () => {
  assert.match(migration, /child_classroom_current_unique/);
  assert.match(migration, /set is_current=false,ended_at=now\(\),end_reason='moved'/);
});
test("cross-Garden child and staff assignments are rejected in database", () => {
  assert.match(migration, /cross_garden_classroom_assignment/);
  assert.match(migration, /validate_child_classroom_scope/);
  assert.match(migration, /validate_staff_classroom_scope/);
});
test("staff requires approved work and optional active employment", () => {
  assert.match(migration, /approved_to_work/);
  assert.match(migration, /active_employment_required/);
});
test("Classroom management uses canonical active Garden authority", () => {
  assert.match(api, /getManagementGardenContext/);
  assert.match(api, /\.eq\("garden_id", access\.gardenId\)/);
});
test("deactivation cannot orphan current children", () => {
  assert.match(api, /יש להעביר את הילדים הפעילים/);
  assert.match(migration, /references public\.classrooms\(id\) on delete restrict/);
});
test("onboarding creates one or more canonical rooms idempotently", () => {
  assert.match(onboarding, /desiredClassrooms/);
  assert.match(onboarding, /onConflict: "garden_id,name"/);
  assert.match(onboarding, /source: "onboarding"/);
});
test("legacy backfill creates only deterministic minimum", () => {
  assert.match(migration, /One deterministic compatibility classroom/);
  assert.match(migration, /'deterministic_minimum',true/);
});
test("no capacity or staff-ratio policy is introduced", () => {
  assert.doesNotMatch(migration, /max_children|staff_ratio|remaining_seats/);
});
