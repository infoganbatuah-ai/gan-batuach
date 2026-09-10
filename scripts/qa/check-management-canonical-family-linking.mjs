import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = file => readFileSync(file, "utf8");

test("canonical guardian table represents multiple legal relationships and scoped access", () => {
  const migration = source("supabase/migrations/20260910030000_management_canonical_child_guardians.sql");
  assert.match(migration, /create table if not exists public\.child_guardian_links/);
  assert.match(migration, /relationship_type.*not null/);
  assert.match(migration, /legal_authority boolean not null/);
  assert.match(migration, /access_scope jsonb not null/);
  assert.match(migration, /unique\(permanent_child_file_id, guardian_profile_id\)/);
});

test("legacy primary parents are backfilled and future legacy writes stay synchronized", () => {
  const migration = source("supabase/migrations/20260910030000_management_canonical_child_guardians.sql");
  assert.match(migration, /legacy_primary_parent_backfill/);
  assert.match(migration, /legacy_child_parent_backfill/);
  assert.match(migration, /sync_primary_child_guardian_link_trigger/);
  assert.match(migration, /guardian_profile_id <> new\.primary_parent_profile_id/);
});

test("child and garden authorization use canonical guardian relationships", () => {
  const migration = source("supabase/migrations/20260910030000_management_canonical_child_guardians.sql");
  assert.match(migration, /can_guardian_access_child/);
  assert.match(migration, /child enrollments canonical read/);
  assert.match(migration, /permanent child files canonical read/);
  assert.match(migration, /join public\.child_kindergarten_enrollments enrollment/);
  assert.doesNotMatch(migration, /profile\.garden_id = target_garden_id/);
});

test("active parent flows read and verify children through canonical links", () => {
  for (const file of [
    "app/api/parent/enrollment-requests/route.ts",
    "app/api/parent/garden-invitations/route.ts",
    "app/dashboard/parent/discover-kindergartens/page.tsx",
    "lib/domain/parent-family.ts"
  ]) assert.match(source(file), /(guardianCanAccessChild|guardianChildIds|child_guardian_links)/, `${file}: canonical guardian access missing`);
});

test("child creation and enrollment activation ensure the primary canonical link", () => {
  assert.match(source("app/api/parent/child-profiles/route.ts"), /ensurePrimaryGuardianLink/);
  assert.match(source("lib/domain/enrollment-activation.ts"), /ensurePrimaryGuardianLink/);
});
