import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [dashboard, shell, garden, inspection, report, correctiveList, correctiveDetail, complaints, trends, preliminary, apply, cameras, safetyPlatform, safetyModel, guard, css, approvalMigration, inspectionMigration, correctiveMigration, invitationApi] = await Promise.all([
  read("app/dashboard/inspector/page.tsx"),
  read("components/role-app-shell.tsx"),
  read("app/dashboard/inspector/gardens/[id]/page.tsx"),
  read("app/dashboard/inspector/inspections/[id]/page.tsx"),
  read("components/inspection-report-view.tsx"),
  read("app/dashboard/inspector/corrective-actions/page.tsx"),
  read("app/dashboard/inspector/corrective-actions/[id]/page.tsx"),
  read("app/dashboard/inspector/complaints/page.tsx"),
  read("app/dashboard/inspector/trends/page.tsx"),
  read("app/dashboard/inspector/preliminary-gardens/page.tsx"),
  read("app/dashboard/inspector/apply/page.tsx"),
  read("app/dashboard/inspector/cameras/page.tsx"),
  read("components/safety-cameras-platform.tsx"),
  read("lib/management/safety-cameras.ts"),
  read("lib/management/operational-role.ts"),
  read("app/globals.css"),
  read("supabase/migrations/20260913030000_management_inspector_garden_bootstrap.sql"),
  read("supabase/migrations/20260913040000_management_monthly_inspection_workflow.sql"),
  read("supabase/migrations/20260913050000_management_corrective_actions.sql"),
  read("app/api/garden/bootstrap-invitations/accept/route.ts")
]);

test("Inspector shell is distinct and exposes the complete canonical workspace", () => {
  const inspectorShell = shell.slice(shell.indexOf("  inspector:"), shell.indexOf('  "digital-observer":'));
  for (const route of ["/dashboard/inspector/control-center", "/dashboard/inspector/inspections", "/dashboard/inspector/violations", "/dashboard/inspector/corrective-actions", "/dashboard/inspector/complaints", "/dashboard/inspector/reports", "/dashboard/inspector/tasks", "/dashboard/inspector/preliminary-gardens", "/dashboard/inspector/cameras"]) {
    assert.match(inspectorShell, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.doesNotMatch(inspectorShell, /dashboard\/garden\/finance/);
  assert.match(dashboard, /requireApprovedInspector/);
  assert.match(dashboard, /טרם הוקצו לך גנים/);
});

test("Garden portfolio and detail are assignment scoped", () => {
  assert.match(garden, /\.eq\("inspector_id", profile\.id\)/);
  assert.match(garden, /inspections/);
  assert.match(garden, /violations/);
  assert.match(garden, /complaints/);
  assert.doesNotMatch(garden, /children|parents|tuition|payments/i);
});

test("Monthly inspection reuses the canonical draft, evidence and submission engine", () => {
  assert.match(inspection, /InspectorInspectionWizard/);
  assert.match(inspection, /\.eq\("inspector_id", profile\.id\)/);
  assert.match(inspection, /inspection_form_questions/);
  assert.match(inspectionMigration, /complete_monthly_inspection/);
  assert.match(inspectionMigration, /weighted_score/);
  assert.match(inspectionMigration, /inspection_answers/);
  assert.doesNotMatch(inspection, /Math\.(round|floor).*score|weighted_score\s*=/s);
});

test("Reports, findings and corrective actions preserve server truth and history", () => {
  assert.match(report, /role === "parent"/);
  assert.match(report, /inspection\.weighted_score/);
  assert.match(correctiveList + correctiveDetail, /violations/);
  assert.match(correctiveDetail, /corrective_action_events/);
  assert.match(correctiveDetail, /ViolationStatusActions/);
  assert.match(correctiveMigration, /corrective_action_events/);
  assert.match(correctiveMigration, /transition_corrective_action/);
  assert.doesNotMatch(correctiveDetail, /weighted_score\s*=/);
});

test("Complaints, trends and preliminary Gardens remain canonically scoped", () => {
  assert.match(complaints, /assigned_inspector_id/);
  assert.match(complaints, /ComplaintWorkspace/);
  assert.match(complaints, /role="inspector"/);
  assert.match(complaints, /scopeMessage=/);
  assert.match(trends, /\.eq\("inspector_id", profile\.id\)/);
  assert.match(trends, /weighted_score/);
  assert.match(preliminary, /InspectorPreliminaryGardens/);
  assert.match(approvalMigration, /create_inspector_preliminary_garden/);
  assert.match(invitationApi, /resolveSignedInvitation/);
});

test("Pending, unassigned and suspended Inspector states are explicit", () => {
  assert.match(apply, /more_information_requested/);
  assert.match(apply, /approved_pending_assignment/);
  assert.match(apply, /suspended/);
  assert.match(apply, /InspectorStatePanel/);
  assert.match(guard, /current_inspector_approved/);
  assert.match(guard, /inspector_assignment/);
});

test("Camera access remains policy based and cannot become inspection truth", () => {
  assert.match(cameras, /SafetyCamerasPlatform/);
  assert.match(cameras, /toSafetyCamera/);
  assert.match(cameras, /inspector_view_allowed/);
  assert.match(cameras, /inspector_access_policy/);
  assert.match(safetyModel, /evidence_only/);
  assert.match(safetyModel, /production_verification_required/);
  assert.match(safetyPlatform, /Live אינו נפתח ללא הרשאה ואימות Production/);
  assert.doesNotMatch(cameras, /face|track_id|weighted_score/is);
});

test("UX-09 visual layer has desktop, mobile, RTL and reduced-motion compositions", () => {
  assert.match(css, /\.inspector-hero-card-image/);
  assert.match(css, /\.inspector-portfolio-grid/);
  assert.match(css, /\.inspector-timeline/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});
