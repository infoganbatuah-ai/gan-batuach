import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260912030000_management_child_discovery_matching.sql");
const api = read("app/api/parent/garden-discovery/route.ts");
const service = read("lib/domain/child-garden-discovery.ts");
const page = read("app/dashboard/parent/discover-kindergartens/page.tsx");

test("matching is canonical, child-authorized, age-aware and non-reserving", () => {
  assert.match(migration, /child_guardian_links/);
  assert.match(migration, /child_discovery_denied/);
  assert.match(migration, /child_months between c\.min_age_months and c\.max_age_months/);
  assert.match(migration, /classroom_seat_reservations/);
  assert.doesNotMatch(migration, /reserve_classroom_seat\(/);
});

test("published public projection excludes sensitive fields", () => {
  assert.match(migration, /returns table/);
  assert.doesNotMatch(migration, /camera_url|medical_notes|staff_id|phone|email|document_url/);
  assert.match(migration, /public_profile_enabled/);
  assert.match(migration, /enrollment_availability/);
});

test("parent endpoint requires a parent session and rejects child IDOR", () => {
  assert.match(api, /session\.profile\.role !== "parent"/);
  assert.match(service, /guardianCanAccessChild/);
  assert.match(api, /result\.kind === "denied"/);
});

test("existing discovery UI is child-specific and uses canonical matches", () => {
  assert.match(page, /selectedChild/);
  assert.match(page, /findEligibleGardensForChild/);
  assert.match(page, /matching_classrooms/);
  assert.match(page, /הזמינות אינה שומרת מקום/);
});

test("enrollment availability remains separate from capacity", () => {
  assert.match(migration, /'accepting','paused','closed','waitlist_only'/);
  assert.match(migration, /coalesce\(matches\.has_capacity,false\)/);
});
