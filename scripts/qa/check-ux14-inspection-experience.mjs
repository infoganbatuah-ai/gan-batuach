import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [wizard, report, detail, dashboard, due, history, trends, gardenHistory, ownerActions, inspectorActions, submitApi, draftApi, evidenceApi, engine, inspectionMigration, correctiveMigration, css, cameras, safetyPlatform, safetyModel] = await Promise.all([
  read("components/inspector-inspection-wizard.tsx"),
  read("components/inspection-report-view.tsx"),
  read("app/dashboard/inspector/inspections/[id]/page.tsx"),
  read("app/dashboard/inspector/page.tsx"),
  read("app/dashboard/inspector/inspections/due/page.tsx"),
  read("app/dashboard/inspector/inspections/history/page.tsx"),
  read("app/dashboard/inspector/trends/page.tsx"),
  read("app/dashboard/garden/inspections/page.tsx"),
  read("components/corrective-action-workspace.tsx"),
  read("app/dashboard/inspector/corrective-actions/[id]/page.tsx"),
  read("app/api/inspections/[id]/submit/route.ts"),
  read("app/api/inspections/[id]/draft/route.ts"),
  read("app/api/inspections/[id]/evidence/route.ts"),
  read("lib/domain/inspection-engine.ts"),
  read("supabase/migrations/20260913040000_management_monthly_inspection_workflow.sql"),
  read("supabase/migrations/20260913050000_management_corrective_actions.sql"),
  read("app/styles/ux-implement-14.css"),
  read("app/dashboard/inspector/cameras/page.tsx"),
  read("components/safety-cameras-platform.tsx"),
  read("lib/management/safety-cameras.ts")
]);

test("inspection routes reuse the canonical GB-M22 lifecycle", () => {
  assert.match(detail, /InspectorInspectionWizard/);
  assert.match(detail, /\.eq\("inspector_id", profile\.id\)/);
  assert.match(draftApi, /get_monthly_inspection_draft/);
  assert.match(draftApi, /save_monthly_inspection_draft/);
  assert.match(submitApi, /complete_monthly_inspection/);
  assert.match(inspectionMigration, /schedule_management_monthly_inspections/);
  assert.match(inspectionMigration, /inspection_drafts/);
});

test("draft, resume, review and submission expose truthful states", () => {
  for (const token of ["טוען טיוטה", "שומר בשרת", "יש שינויים שלא נשמרו", "סקירה לפני הגשה", "אימות מיקום בזמן הגשה", "הגשה ונעילת דוח"]) assert.match(wizard, new RegExp(token));
  assert.match(wizard, /missingRequired/);
  assert.match(wizard, /navigator\.geolocation/);
  assert.match(wizard, /signature_image/);
  assert.match(wizard, /role="dialog"/);
});

test("score is backend-authoritative and uses the canonical 1–10 scale", () => {
  assert.match(wizard, /הציון מחושב בשרת/);
  assert.match(wizard, /submissionResult\.weighted_score/);
  assert.doesNotMatch(wizard, /weighted\s*=|weighted_sum|reduce\([^)]*score/);
  assert.match(engine, /score: z\.number\(\)\.int\(\)\.min\(1\)\.max\(10\)/);
  assert.match(report, /inspection\.weighted_score/);
  assert.match(report, /מתוך 10/);
  assert.match(history + trends, /inspection_product_settings/);
  assert.match(history + trends, />= attentionThreshold/);
  assert.doesNotMatch(history + trends, />= 80|מתוך 100|מתחת 80|80 ומעלה/);
});

test("evidence remains private and role scoped", () => {
  assert.match(evidenceApi, /inspection-reports/);
  assert.match(evidenceApi, /createSignedUrl\([^,]+, 60\)/);
  assert.match(evidenceApi, /inspection\.inspector_id !== actor\.id/);
  assert.match(evidenceApi, /access\.gardenIds\?\.includes/);
  assert.match(wizard, /אחסון פרטי/);
  assert.doesNotMatch(wizard + report, /getPublicUrl|publicUrl/);
});

test("findings and corrective actions remain canonically linked and score immutable", () => {
  assert.match(inspectionMigration, /insert into public\.violations/);
  assert.match(inspectionMigration, /violation_threshold/);
  assert.match(ownerActions + inspectorActions, /ViolationStatusActions/);
  assert.match(correctiveMigration, /corrective_action_events/);
  assert.match(report + ownerActions, /אינו משנה את הציון|הציון ההיסטורי נעול/);
  assert.doesNotMatch(ownerActions + inspectorActions + correctiveMigration, /update public\.inspections set weighted_score/);
});

test("Inspector and Owner surfaces preserve tenant and role isolation", () => {
  assert.match(dashboard, /requireApprovedInspector/);
  assert.match(dashboard, /\.eq\("inspector_id", profile\.id\)/);
  assert.match(due, /\.eq\("inspector_id", profile\.id\)/);
  assert.match(gardenHistory, /\.eq\("garden_id", profile\.garden_id/);
  assert.match(report, /showPrivateNotes/);
  assert.match(report, /role === "inspector" \|\| role === "admin"/);
});

test("Safety and camera context stays truthful", () => {
  assert.match(cameras, /SafetyCamerasPlatform/);
  assert.match(cameras, /toSafetyCamera/);
  assert.match(cameras, /inspector_view_allowed/);
  assert.match(safetyModel, /production_verification_required/);
  assert.match(safetyPlatform, /Live אינו נפתח ללא הרשאה ואימות Production/);
  assert.doesNotMatch(wizard + report, /track_id|face match|shadow detection/i);
});

test("Desktop and Mobile are purpose-built, RTL and accessible", () => {
  for (const selector of ["inspection-workspace-grid", "inspection-category-nav", "inspection-question-card", "inspection-review-dialog", "inspection-report-layout", "inspection-report-findings"]) assert.match(css, new RegExp(`\\.${selector}`));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /inspection-question-card\.mobile-current/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(wizard, /role="progressbar"/);
  assert.match(wizard, /aria-modal="true"/);
  assert.match(wizard, /<fieldset/);
});

test("feature completeness routes include dashboard, schedule, history, report and remediation", () => {
  assert.match(dashboard, /inspections\/due/);
  assert.match(dashboard, /inspections\/history/);
  assert.match(history, /\/report/);
  assert.match(trends, /weighted_score/);
  assert.match(ownerActions, /work-evidence/);
  assert.match(inspectorActions, /corrective_action_events/);
});
