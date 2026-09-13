import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const sql = read("supabase/migrations/20260913170000_management_complaint_sla.sql");
const submit = read("app/api/parent/complaints/route.ts");
const actions = read("app/api/complaints/[id]/actions/route.ts");
const parentPage = read("app/dashboard/parent/complaints/page.tsx");
const cron = read("app/api/cron/complaint-sla-escalation/route.ts");
const inspector = read("app/dashboard/inspector/reports/page.tsx");

// These contracts protect boundaries that ordinary UI snapshots cannot exercise.
test("reporter submission binds the same active child and Garden server-side", () => {
  assert.match(sql, /can_parent_access_child\(p_child_id\)/);
  assert.match(sql, /can_guardian_access_child\(c\.permanent_child_file_id,'profile'\)/);
  assert.match(sql, /e\.child_id=p_child_id and e\.garden_id=p_garden_id and e\.status='active'/);
  assert.match(sql, /g\.status='active'/);
  assert.match(submit, /submit_management_complaint/);
  assert.match(parentPage, /enrollment\.status === "active"/);
  assert.doesNotMatch(submit, /\.from\("complaints"[^\n]*\.insert\(/);
});

test("retry creates one complaint and one source task without granting access", () => {
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\(actor\.id::text\),hashtext\(p_idempotency_key::text\)\)/);
  assert.match(sql, /complaints_reporter_retry_key/);
  assert.match(sql, /source_entity_type,source_entity_id\)/);
  assert.match(sql, /can_view_management_task/);
  assert.match(sql, /c\.visibility='garden' and public\.can_manage_garden/);
});

test("SLA is reviewed data, with no invented active policy", () => {
  assert.match(sql, /complaint_sla_policies/);
  assert.match(sql, /status <> 'active' or \(approved_by is not null and approved_at is not null\)/);
  assert.match(sql, /policy_count>1 then raise exception 'sla_policy_conflict'/);
  assert.match(sql, /effective_from<=now\(\)/);
  assert.match(sql, /Policy approval is deliberately separate from this migration: no invented deadline is activated/);
});

test("complaint transitions and overdue escalation are locked and audited", () => {
  assert.match(sql, /where id=p_id for update/);
  assert.match(sql, /for update of c skip locked/);
  assert.match(sql, /complaint_transition_denied/);
  assert.match(sql, /complaint_sla_escalated/);
  assert.match(sql, /complaint_events/);
  assert.match(cron, /CRON_SECRET/);
  assert.match(actions, /transition_management_complaint/);
  assert.match(inspector, /יעד SLA חלף/);
});

test("reporter and Garden clients cannot read internal notes or raw attachment paths", () => {
  assert.match(sql, /revoke select on public\.complaints from public,anon,authenticated/);
  assert.match(sql, /'internal_notes','status_history','resolution','attachment_url','attachment_urls'/);
  assert.match(sql, /returns jsonb language plpgsql security definer/);
  assert.match(sql, /return jsonb_build_object\('id',c\.id/);
  assert.match(submit, /reporterProjection\(data\)/);
  assert.doesNotMatch(submit, /select\("\*"\)/);
});
