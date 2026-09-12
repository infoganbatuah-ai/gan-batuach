import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const sql = read("supabase/migrations/20260913030000_management_inspector_garden_bootstrap.sql");
const draft = read("app/api/inspector/preliminary-gardens/route.ts");
const invite = read("app/api/inspector/preliminary-gardens/[id]/invitation/route.ts");
const accept = read("app/api/garden/bootstrap-invitations/accept/route.ts");
const onboarding = read("supabase/migrations/20260911020000_management_atomic_garden_onboarding.sql");
const discovery = read("supabase/migrations/20260912030000_management_child_discovery_matching.sql");
const enrollment = read("supabase/migrations/20260912040000_management_enrollment_request_lifecycle.sql");

test("preliminary Garden is a pending non-public canonical draft", () => {
  assert.match(sql, /insert into public\.gardens/);
  assert.match(sql, /'pending','activation_in_progress'/);
  assert.match(sql, /'not_started',false,false/);
  assert.match(sql, /insert into public\.kindergarten_onboarding_records/);
  assert.match(sql, /duplicate_review_required/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(discovery, /g\.status='active' and coalesce\(g\.public_profile_enabled,false\)/);
  assert.match(enrollment, /garden\.status<>'active'/);
});

test("inspector approval and source ownership gate all bootstrap mutations", () => {
  assert.match(sql, /not public\.is_approved_inspector\(actor_id\)/);
  assert.match(draft, /current_inspector_approved/);
  assert.match(draft, /\.eq\("bootstrap_inspector_id", access\.profile!\.id\)/);
  assert.match(invite, /\.eq\("bootstrap_inspector_id", profile\.id\)/);
  assert.match(sql, /garden\.bootstrap_inspector_id<>actor_id/);
  assert.match(sql, /onboarding\.manager_id is not null/);
});

test("signed invitation binds recipient, Garden, source and contextual role", () => {
  assert.match(invite, /createSignedInvitation/);
  assert.match(invite, /source: "inspector_preliminary"/);
  assert.match(accept, /resolveSignedInvitation/);
  assert.match(accept, /hashInvitationToken/);
  assert.match(sql, /invitation\.token_hash<>p_token_hash/);
  assert.match(sql, /invitation\.target_profile_id<>actor\.id/);
  assert.match(sql, /actor\.email_verified_at is null/);
  assert.match(sql, /invitation\.expires_at<=now_at/);
  assert.match(sql, /invitation\.intended_role<>\(case/);
  assert.match(sql, /on conflict\(profile_id,garden_id,relationship_role\)/);
});

test("activation assigns only an approved source Inspector in the Garden transaction", () => {
  assert.match(sql, /after update of status,onboarding_status on public\.gardens/);
  assert.match(sql, /public\.is_approved_inspector\(new\.bootstrap_inspector_id\)/);
  assert.match(sql, /admin_reassignment_required/);
  assert.match(onboarding, /update public\.gardens set status='active'/);
  assert.match(onboarding, /update public\.garden_management_memberships set status='active'/);
  assert.match(sql, /if invitation\.status='accepted'.*p_accept/);
  const activation = sql.slice(sql.indexOf("create or replace function public.activate_garden_onboarding("));
  assert.ok(activation.indexOf("update public.profiles set garden_id=") < activation.indexOf("insert into public.garden_teaching_assignments"));
});

test("delivery state remains truthful and onboarding is reused", () => {
  assert.match(invite, /deliverSignedInvitation/);
  assert.match(invite, /delivery_pending/);
  assert.match(accept, /\/onboarding\/kindergarten\?gardenId=/);
  assert.doesNotMatch(invite, /createUser|password/);
});
