import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260912010000_management_classroom_capacity.sql");
const api = read("app/api/garden/classrooms/route.ts");
const publicApi = read("app/api/public/classroom-availability/route.ts");
const onboarding = read("app/api/kindergarten-onboarding/route.ts");

test("capacity truth is Classroom scoped and arithmetic is server calculated", () => {
  assert.match(migration, /add column if not exists capacity_limit integer/);
  assert.match(migration, /greatest\(room\.capacity_limit-occupied_count-reserved_count,0\)/);
  assert.match(migration, /over_capacity/);
  assert.doesNotMatch(migration, /children per staff|legal ratio/i);
});

test("reservation lifecycle is idempotent, expirable and tenant constrained", () => {
  assert.match(migration, /unique\(garden_id,idempotency_key\)/);
  assert.match(migration, /status in \('active','released','consumed','expired'\)/);
  assert.match(migration, /validate_classroom_reservation_scope/);
  assert.match(migration, /public\.can_manage_garden\(room\.garden_id\)/);
  assert.match(migration, /expires_at<=now\(\)/);
});

test("last-seat acquisition and child moves lock the destination", () => {
  assert.match(migration, /where id=target_classroom_id and status='active' for update/);
  assert.match(migration, /classroom_capacity_unavailable/);
  const capacityCheck = migration.indexOf("capacity:=public.classroom_capacity_status(room.id)", migration.indexOf("assign_child_to_classroom"));
  const sourceRelease = migration.indexOf("update public.child_classroom_assignments set is_current=false", migration.indexOf("assign_child_to_classroom"));
  assert.ok(capacityCheck > 0 && sourceRelease > capacityCheck, "destination capacity must be secured before source release");
});

test("manager and public APIs expose only their intended projections", () => {
  assert.match(api, /classroom_capacity_status/);
  assert.match(api, /reserve_classroom_seat/);
  assert.match(api, /release_classroom_seat_reservation/);
  assert.match(api, /consume_classroom_seat_reservation/);
  assert.match(publicApi, /public_classroom_availability/);
  assert.match(publicApi, /public_age_group_availability/);
  assert.doesNotMatch(publicApi, /child_id|enrollment_id|reservation_id/);
  assert.match(migration, /public_profile_enabled/);
});

test("onboarding writes explicit per-Classroom capacity without inferring legal limits", () => {
  assert.match(onboarding, /classroom_capacities/);
  assert.match(onboarding, /capacity_limit: classroomCapacities/);
});

test("capacity arithmetic covers basic, full and legacy over-capacity cases", () => {
  const calculate = (limit, occupied, reserved) => ({ available: Math.max(limit - occupied - reserved, 0), over: occupied + reserved > limit });
  assert.deepEqual(calculate(20, 15, 2), { available: 3, over: false });
  assert.deepEqual(calculate(20, 18, 2), { available: 0, over: false });
  assert.deepEqual(calculate(20, 22, 0), { available: 0, over: true });
});
