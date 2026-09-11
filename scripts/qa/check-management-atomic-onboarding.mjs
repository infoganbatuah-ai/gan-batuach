import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = file => readFileSync(file, "utf8");
const migration = source("supabase/migrations/20260911020000_management_atomic_garden_onboarding.sql");
const lifecycleMigration = source("supabase/migrations/20260606016000_kindergarten_onboarding_lifecycle_final.sql");
const onboardingRoute = source("app/api/kindergarten-onboarding/route.ts");
const startRoute = source("app/api/garden/manager-application/route.ts");
const page = source("app/onboarding/kindergarten/page.tsx");

test("one canonical server-side onboarding record separates current step from completion", () => {
  assert.match(migration, /add column if not exists current_step text/);
  assert.match(lifecycleMigration, /completed_steps text\[\]/);
  assert.match(migration, /garden_onboarding_status/);
});

test("draft creation is serialized and preserves existing garden context", () => {
  const body = migration.slice(migration.indexOf("start_garden_onboarding"), migration.indexOf("garden_onboarding_status"));
  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /already_exists/);
  assert.match(body, /garden_management_memberships/);
  assert.match(body, /'pending'/);
  assert.match(body, /update public\.garden_management_memberships set status='pending'/);
  assert.doesNotMatch(body, /set garden_id=/);
});

test("activation is one locked database transaction and idempotent", () => {
  const body = migration.slice(migration.indexOf("activate_garden_onboarding"), migration.indexOf("revoke all on function"));
  assert.match(body, /pg_advisory_xact_lock/);
  assert.match(body, /already_active/);
  assert.match(body, /update public\.gardens set status='active'/);
  assert.match(body, /update public\.garden_management_memberships set status='active'/);
  assert.match(body, /kindergarten_subscriptions/);
  assert.match(body, /kindergarten_activation_events/);
});

test("activation eligibility derives from persisted Garden identity documents and consent", () => {
  const body = migration.slice(migration.indexOf("garden_onboarding_status"), migration.indexOf("activate_garden_onboarding"));
  for (const field of ["garden_name", "address", "phone", "identity_verification", "age_groups", "documents", "platform_terms", "privacy_terms"]) assert.match(body, new RegExp(field));
});

test("owner-teacher operator-teacher and owner-only stay distinct", () => {
  assert.match(migration, /'teacher_operator', 'owner_teacher', 'owner_only'/);
  assert.match(migration, /operator_teacher/);
  assert.match(migration, /record\.registrant_type in \('owner_teacher','teacher_operator'\)/);
  assert.match(migration, /if record\.registrant_type in/);
});

test("owner-only activation cannot fabricate a teaching assignment", () => {
  const insert = migration.slice(migration.indexOf("if record.registrant_type in"), migration.indexOf("kindergarten_subscriptions"));
  assert.doesNotMatch(insert, /owner_only/);
});

test("draft read save and activation enforce server-side ownership", () => {
  assert.match(migration, /can_edit_garden_onboarding/);
  assert.match(onboardingRoute, /can_edit_garden_onboarding/);
  assert.match(onboardingRoute, /editAuthority\.data !== true/);
  assert.match(startRoute, /start_garden_onboarding/);
});

test("save resume uses server state and explicit draft garden id", () => {
  assert.match(page, /searchParams/);
  assert.match(page, /targetGardenId/);
  assert.match(onboardingRoute, /garden_onboarding_status/);
  assert.match(onboardingRoute, /current_step/);
});

test("consent evidence and subscription readiness are truthful and retry safe", () => {
  assert.match(migration, /where not exists\(select 1 from public\.kindergarten_legal_acceptances existing/);
  assert.match(migration, /accept_required_consents boolean/);
  assert.match(migration, /'provider','manual'/);
  assert.match(migration, /'live_collection',false/);
});

test("legacy admin approval is informational and never gates atomic activation", () => {
  const activation = migration.slice(migration.indexOf("activate_garden_onboarding"));
  assert.match(activation, /'admin_approval_required',false/);
  assert.doesNotMatch(activation, /pending_final_approval.*raise|admin_approved.*raise/);
});

test("Digital Observer is not referenced by the Management activation migration", () => {
  assert.doesNotMatch(migration, /digital_observer|camera_/i);
});
