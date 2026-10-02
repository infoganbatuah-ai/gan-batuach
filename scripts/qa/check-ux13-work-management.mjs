import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [
  tasksUi, complaintsUi, correctiveUi, overviewUi, css,
  taskCreateApi, taskUpdateApi, taskStatusApi, complaintActionApi, complaintParentApi,
  violationActionApi, evidenceApi, taskMigration, complaintMigration, correctiveMigration,
  gardenTasks, staffTasks, inspectorTasks, parentComplaints, gardenComplaints, inspectorComplaints,
  gardenCorrective, inspectorCorrective, nav, routes
] = await Promise.all([
  read("components/task-workbench.tsx"),
  read("components/complaint-workspace.tsx"),
  read("components/corrective-action-workspace.tsx"),
  read("components/work-operations-overview.tsx"),
  read("app/styles/ux-implement-13.css"),
  read("app/api/tasks/route.ts"),
  read("app/api/tasks/[id]/route.ts"),
  read("app/api/tasks/[id]/status/route.ts"),
  read("app/api/complaints/[id]/actions/route.ts"),
  read("app/api/parent/complaints/route.ts"),
  read("app/api/violations/[id]/status/route.ts"),
  read("app/api/violations/[id]/evidence/route.ts"),
  read("supabase/migrations/20260913160000_management_task_workflow_consolidation.sql"),
  read("supabase/migrations/20260913170000_management_complaint_sla.sql"),
  read("supabase/migrations/20260913050000_management_corrective_actions.sql"),
  read("app/dashboard/garden/tasks/page.tsx"),
  read("app/dashboard/staff/tasks/page.tsx"),
  read("app/dashboard/inspector/tasks/page.tsx"),
  read("app/dashboard/parent/complaints/page.tsx"),
  read("app/dashboard/garden/complaints/page.tsx"),
  read("app/dashboard/inspector/complaints/page.tsx"),
  read("app/dashboard/garden/corrective-actions/page.tsx"),
  read("app/dashboard/inspector/corrective-actions/page.tsx"),
  read("components/dashboard-shell.tsx"),
  read("lib/dashboard-route-safety.ts")
]);

test("Tasks, Complaints and Corrective Actions remain separate canonical domains", () => {
  assert.match(taskCreateApi, /create_management_task/);
  assert.match(taskUpdateApi, /update_management_task/);
  assert.match(taskStatusApi, /transition_management_task/);
  assert.match(complaintActionApi, /transition_management_complaint/);
  assert.match(complaintParentApi, /submit_management_complaint/);
  assert.match(violationActionApi, /transition_corrective_action/);
  assert.match(taskMigration, /create_management_task/);
  assert.match(complaintMigration, /transition_management_complaint/);
  assert.match(correctiveMigration, /corrective_action_events/);
  assert.doesNotMatch(overviewUi, /insert\(|update\(|fetch\(/);
});

test("Canonical states, audit transitions and score immutability are preserved", () => {
  for (const state of ["open", "in_progress", "waiting_approval", "blocked", "overdue", "done", "rejected", "cancelled"]) assert.match(tasksUi, new RegExp(state));
  for (const state of ["new", "assigned", "in_progress", "waiting_garden", "waiting_reporter", "escalated", "resolved", "closed", "reopened"]) assert.match(complaintsUi, new RegExp(state));
  for (const state of ["open", "in_progress", "waiting_approval", "rejected", "overdue", "done"]) assert.match(correctiveUi, new RegExp(state));
  assert.match(correctiveMigration, /inspection answers remain immutable findings/);
  assert.doesNotMatch(correctiveUi, /score\s*[:=]|update[^\n]*score/i);
  assert.match(correctiveUi, /ציון הביקורת המקורי נשמר/);
});

test("SLA and evidence remain backend-authoritative and private", () => {
  assert.match(complaintsUi, /acknowledgement_due_at/);
  assert.match(complaintsUi, /response_due_at/);
  assert.match(complaintsUi, /resolution_due_at/);
  assert.doesNotMatch(complaintsUi, /24\s*שעות|48\s*שעות|SLA.*=/i);
  assert.match(evidenceApi, /createSignedUrl/);
  assert.match(evidenceApi, /60/);
  assert.match(evidenceApi, /inspection-reports/);
  assert.match(correctiveUi, /\/api\/violations\/\$\{selected\.id\}\/evidence/);
  assert.doesNotMatch(correctiveUi, /storage\.from|publicUrl/);
});

test("Role pages query through session RLS and keep tenant boundaries", () => {
  for (const source of [gardenTasks, staffTasks, inspectorTasks, parentComplaints, gardenComplaints, inspectorComplaints, gardenCorrective, inspectorCorrective]) {
    assert.match(source, /createClient/);
    assert.doesNotMatch(source, /createAdminClient|service_role/);
  }
  assert.match(staffTasks, /eq\("assigned_to", profile\.id\)/);
  assert.match(inspectorTasks, /gardenIds\.includes/);
  assert.match(parentComplaints, /eq\("reporter_user_id", profile\.id\)/);
  assert.match(gardenComplaints, /eq\("garden_id", profile\.garden_id/);
  assert.match(inspectorComplaints, /eq\("assigned_inspector_id", profile\.id\)/);
  assert.match(gardenCorrective, /eq\("garden_id", profile\.garden_id/);
  assert.match(inspectorCorrective, /in\("garden_id", gardenIds\)/);
});

test("The approved Desktop and Mobile visual compositions are implemented", () => {
  for (const selector of ["work-platform", "work-platform-hero", "work-metrics", "work-toolbar", "work-list-detail", "work-list-card", "work-detail", "work-detail-facts", "work-timeline", "work-evidence", "work-overview", "work-overview-domains"]) assert.match(css, new RegExp("\\." + selector));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(tasksUi, /role="dialog"/);
  assert.match(complaintsUi, /aria-modal="true"/);
  assert.match(correctiveUi, /aria-label="מרכז פעולות תיקון"/);
  assert.match(nav, /\/dashboard\/garden\/work-center/);
  assert.match(nav, /\/dashboard\/inspector\/corrective-actions/);
  assert.match(routes, /\/dashboard\/garden\/complaints/);
});

test("Empty, search and role-limited states remain explicit", () => {
  assert.match(tasksUi, /אין משימות/);
  assert.match(tasksUi, /לא נמצאו משימות/);
  assert.match(complaintsUi, /אין תלונות/);
  assert.match(complaintsUi, /לא נמצאו תלונות/);
  assert.match(correctiveUi, /אין פעולות תיקון/);
  assert.match(correctiveUi, /לא נמצאו פעולות/);
  assert.match(staffTasks, /משימות של עובדים אחרים אינן זמינות/);
  assert.match(inspectorComplaints, /תוכן שאינו נדרש לפיקוח אינו נחשף/);
});
