import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const original = readFileSync("supabase/migrations/20260912040000_management_enrollment_request_lifecycle.sql", "utf8");
const repair = readFileSync("supabase/migrations/20260922100000_management_enrollment_audit_role_fix.sql", "utf8");

test("forward migration repairs the typed audit role without rewriting migration history", () => {
  assert.match(original, /public\.current_role\(\)::text/);
  assert.match(repair, /create or replace function public\.decide_enrollment_request/);
  assert.match(repair, /values\(auth\.uid\(\),public\.current_role\(\),req\.garden_id/);
  assert.doesNotMatch(repair, /public\.current_role\(\)::text/);
  assert.doesNotMatch(repair, /update public\.kindergarten_enrollment_requests[\s\S]*where id is null/);
});

test("repair preserves enrollment authorization, locking, transitions, seat reservation and grants", () => {
  assert.match(repair, /where id=target_request_id for update/);
  assert.match(repair, /can_manage_garden\(req\.garden_id\)/);
  assert.match(repair, /invalid_enrollment_transition/);
  assert.match(repair, /reserve_classroom_seat/);
  assert.match(repair, /grant execute on function public\.decide_enrollment_request\(uuid,text,uuid,text\) to authenticated/);
  assert.match(repair, /revoke all on function public\.decide_enrollment_request\(uuid,text,uuid,text\) from public,anon/);
});
