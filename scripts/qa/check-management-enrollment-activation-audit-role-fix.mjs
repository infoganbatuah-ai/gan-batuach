import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const original = readFileSync("supabase/migrations/20260912050000_management_enrollment_activation.sql", "utf8");
const emailFirst = readFileSync("supabase/migrations/20260920110000_management_email_first_verification.sql", "utf8");
const repair = readFileSync("supabase/migrations/20260922110000_management_enrollment_activation_audit_role_fix.sql", "utf8");

test("forward migration repairs activation and manual-arrangement audit roles", () => {
  assert.match(original, /create or replace function public\.record_manual_enrollment_arrangement/);
  assert.match(original, /public\.current_role\(\)::text/);
  assert.match(emailFirst, /create or replace function public\.activate_enrollment_from_evidence/);
  assert.match(repair, /create or replace function public\.activate_enrollment_from_evidence/);
  assert.match(repair, /child_timeline_events[\s\S]*then 'manager' else 'system' end/);
  assert.match(repair, /audit_logs[\s\S]*then public\.current_role\(\) else null::public\.app_role end/);
  assert.doesNotMatch(repair, /'system'::public\.app_role/);
  assert.match(repair, /create or replace function public\.record_manual_enrollment_arrangement/);
  assert.equal((repair.match(/values\(auth\.uid\(\),public\.current_role\(\),req\.garden_id/g) ?? []).length, 2);
  assert.doesNotMatch(repair, /public\.current_role\(\)::text/);
});

test("repair preserves authorization, row lock, idempotency, activation and narrow grants", () => {
  assert.match(repair, /where id=target_request_id for update/);
  assert.match(repair, /can_manage_garden\(req\.garden_id\)/);
  assert.match(repair, /on conflict\(garden_id,idempotency_key\) do update/);
  assert.match(repair, /management_account_verification_satisfied\(parent_profile\.id\)/);
  assert.match(repair, /activate_enrollment_from_evidence\(req\.id,evidence\.id\)/);
  assert.match(repair, /grant execute on function public\.record_manual_enrollment_arrangement\(uuid,text,numeric,date,date,text,text\) to authenticated/);
  assert.match(repair, /revoke all on function public\.record_manual_enrollment_arrangement\(uuid,text,numeric,date,date,text,text\) from public,anon/);
});
