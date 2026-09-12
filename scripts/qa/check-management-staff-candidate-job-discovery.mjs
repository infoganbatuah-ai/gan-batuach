import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("supabase/migrations/20260912060000_management_staff_candidate_job_discovery.sql", "utf8");
const market = await readFile("app/dashboard/staff/job-market/page.tsx", "utf8");
const profileApi = await readFile("app/api/staff/candidate-profile/route.ts", "utf8");
const jobApi = await readFile("app/api/garden/staff-openings/[id]/route.ts", "utf8");

test("candidate completeness is server evaluated from structured profile truth", () => {
  assert.match(migration, /evaluate_staff_candidate_profile/);
  assert.match(migration, /qualification_missing/);
  assert.match(migration, /required_documents_pending/);
  assert.match(migration, /ready_for_matching/);
});
test("candidate profile remains self-scoped", () => {
  assert.match(migration, /target_profile_id <> auth\.uid\(\) and not public\.is_admin\(\)/);
  assert.match(profileApi, /requireRole\(\["staff"\]\)/);
  assert.match(profileApi, /save_staff_candidate_profile/);
});
test("job matches are deterministic and qualification-aware", () => {
  assert.match(migration, /find_relevant_staff_jobs/);
  assert.match(migration, /qualification_match/);
  assert.match(migration, /missing_required_qualification/);
  assert.match(migration, /order by/);
});
test("only published jobs are discoverable and no fake distance is returned", () => {
  assert.match(migration, /o\.active_status='published'/);
  assert.doesNotMatch(migration, /distance_km/);
  assert.match(migration, /location_unavailable/);
});
test("job mutations use canonical garden authority", () => {
  assert.match(migration, /can_manage_garden\(garden_id\)/);
  assert.match(jobApi, /access\.gardenId/);
  assert.match(jobApi, /classroom.*garden_id/);
});
test("job market uses the canonical matching function and preserves application state", () => {
  assert.match(market, /find_relevant_staff_jobs/);
  assert.match(market, /application_status/);
  assert.match(market, /הגשה תיפתח ב־GB-M18/);
  assert.doesNotMatch(market, /StaffApplicationForm/);
});
test("candidate discovery stays recruitment-safe", () => {
  assert.doesNotMatch(migration, /child_id/);
  assert.doesNotMatch(migration, /camera_url/);
  assert.doesNotMatch(migration, /incident/);
});
