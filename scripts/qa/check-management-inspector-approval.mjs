import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");
const sql = read("supabase/migrations/20260913020000_management_inspector_approval.sql");
const submit = read("app/api/inspector/applications/route.ts");
const review = read("app/api/admin/inspector-applications/[id]/route.ts");
const auth = read("lib/auth.ts");
const guard = read("lib/management/operational-role.ts");
const shell = read("app/dashboard/inspector/command-center/page.tsx");

test("approval and Garden assignment remain independent", () => {
  assert.match(sql, /a\.status='approved' and a\.activated_at is not null/);
  assert.match(sql, /g\.inspector_id=auth\.uid\(\)/);
  assert.match(sql, /guard_inspector_garden_assignment/);
  assert.match(sql, /inspector_not_approved/);
  assert.doesNotMatch(review, /garden_ids|\.from\("gardens"\)/);
  assert.match(auth, /application\?\.status !== "approved"/);
  assert.match(shell, /requireApprovedInspector/);
  assert.match(guard, /current_inspector_approved/);
  assert.match(guard, /if \(!assignment\.data\) return denied\("inspector_assignment"\)/);
});

test("applicant cannot set privileged status directly", () => {
  assert.match(sql, /drop policy if exists "inspector applications scoped update"/);
  assert.match(sql, /drop policy if exists "inspector applications own insert"/);
  assert.match(sql, /if auth\.uid\(\) is null/);
  assert.match(sql, /actor\.role::text <> 'inspector'/);
  assert.match(submit, /submit_inspector_application/);
  assert.match(submit, /if \(!user \|\| !profile\) return fail\("נדרשת התחברות\."\, 401\)/);
  assert.doesNotMatch(submit, /createAdminClient|\.upsert\(/);
});

test("Admin decision is a locked atomic state transition", () => {
  assert.match(sql, /not public\.is_admin\(\)/);
  assert.match(sql, /where id=p_application_id for update/);
  assert.match(sql, /invalid_inspector_transition/);
  assert.match(sql, /if application\.status=next_status then return/);
  assert.match(sql, /inspector_contact_unverified/);
  assert.match(sql, /insert into public\.audit_logs/);
  assert.match(sql, /insert into public\.notifications/);
  assert.match(review, /decide_inspector_application/);
  assert.match(review, /if \(!user \|\| !profile\) return fail\("נדרשת התחברות\."\, 401\)/);
});

test("legacy preservation does not grant unassigned or inactive profiles", () => {
  assert.match(sql, /p\.role::text='inspector' and p\.active=true/);
  assert.match(sql, /exists\(select 1 from public\.gardens g where g\.inspector_id=p\.id\)/);
  assert.match(sql, /not exists\(select 1 from public\.inspector_applications a where a\.profile_id=p\.id\)/);
});
