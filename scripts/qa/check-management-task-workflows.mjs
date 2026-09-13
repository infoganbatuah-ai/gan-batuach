import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260913160000_management_task_workflow_consolidation.sql");
const create = read("app/api/tasks/route.ts");
const transition = read("app/api/tasks/[id]/status/route.ts");
const staff = read("app/dashboard/staff/tasks/page.tsx");
const inspector = read("app/dashboard/inspector/tasks/page.tsx");
const unified = read("app/dashboard/tasks/page.tsx");
const reportActions = read("app/api/admin/report-actions/route.ts");

test("task assignment cannot grant tenant or source authority", () => {
  assert.match(migration, /can_staff_access_garden\(p_garden_id\)/);
  assert.match(migration, /can_inspector_access_garden\(p_garden_id\)/);
  assert.match(migration, /p_assigned_to=auth\.uid\(\)/);
  assert.match(migration, /p_source_type not in \('corrective_action','complaint','incident'\)/);
  assert.match(migration, /ineligible_task_assignee/);
  assert.match(migration, /e\.status='active'/);
  assert.match(migration, /public\.is_approved_inspector\(p_assigned_to\)/);
  assert.doesNotMatch(migration, /or assigned_to = auth\.uid\(\)/);
});

test("manual task creation and transition cannot accept generic client status or source", () => {
  assert.match(create, /createSchema.*=/);
  assert.match(create, /\.strict\(\)/);
  assert.doesNotMatch(create, /source_entity_type:|source_entity_id:/);
  assert.match(create, /create_management_task/);
  assert.match(transition, /action: z\.enum/);
  assert.doesNotMatch(transition, /status: z\.enum/);
  assert.match(transition, /transition_management_task/);
  assert.match(migration, /for update/);
  assert.match(migration, /if t\.status=next_status then return t/);
});

test("corrective action remains source authority and duplicate task links are prevented", () => {
  assert.match(migration, /from public\.violations v where v\.task_id=t\.id/);
  assert.match(migration, /management_tasks_corrective_source_unique/);
  assert.match(migration, /create trigger management_link_corrective_action_task/);
  assert.doesNotMatch(migration, /update public\.violations set status/);
  assert.doesNotMatch(migration, /update public\.inspections set/);
});

test("report-generated tasks are source-idempotent and Observer mock events are not accepted", () => {
  assert.match(migration, /create or replace function public\.create_task_from_source/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /management_tasks_report_source_unique/);
  assert.match(migration, /p_source_type not in \('complaint','incident'\)/);
  assert.match(reportActions, /create_task_from_source/);
  assert.doesNotMatch(reportActions, /\.from\("tasks"\)\.insert/);
});

test("Staff, Inspector, Manager and Parent task surfaces keep role boundaries", () => {
  assert.match(staff, /requireOperationalRole\(\["staff"\]\)/);
  assert.match(staff, /\.eq\("garden_id", profile\.garden_id/);
  assert.match(staff, /\.eq\("assigned_to", profile\.id\)/);
  assert.match(inspector, /gardenIds\.includes\(task\.garden_id\)/);
  assert.match(unified, /\.from\("tasks"/);
  assert.doesNotMatch(unified, /\.from\("workflow_tasks"/);
  assert.doesNotMatch(unified, /"parent", "inspector"/);
});

test("direct task writes are closed and legacy escalation cannot spoof actor", () => {
  assert.match(migration, /revoke insert,update,delete on public\.tasks from anon,authenticated/);
  assert.match(migration, /revoke insert,update,delete on public\.workflow_tasks from anon,authenticated/);
  assert.match(migration, /create or replace function public\.escalate_task/);
  assert.match(migration, /escalated_by=actor\.id/);
  assert.doesNotMatch(migration, /escalated_by=p_actor_id/);
});
