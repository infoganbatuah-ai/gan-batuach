import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deriveAttendanceSummary,
  deriveTuitionSummary,
  safeDashboardMessagePreview,
  safetyCapabilityState,
  selectAuthorizedChild
} from "../../lib/management/dashboard-read-model.ts";

const read = path => readFileSync(path, "utf8");

test("attendance keeps expected, present, absent and departed distinct", () => {
  assert.deepEqual(deriveAttendanceSummary([
    { status: "present" }, { status: "absent" }, { status: "departed" }
  ], 4), { expected: 4, present: 1, absent: 1, departed: 1, recorded: 3, completion: 75 });
});

test("tuition dashboard derives money from the GB-M27 ledger without subscription mixing", () => {
  assert.deepEqual(deriveTuitionSummary([
    { base_amount: "1000", adjustment_total: "-100", settled_total: "250", due_at: "2026-09-01", status: "partially_paid", currency: "ILS" },
    { base_amount: "500", adjustment_total: "0", settled_total: "500", due_at: "2026-09-01", status: "paid", currency: "ILS" }
  ], "2026-09-22"), { due: 1400, settled: 750, outstanding: 650, overdue: 1, reconciliation: 0, currency: "ILS" });
});

test("parent Child context accepts only the supplied authorized collection", () => {
  const children = [{ child_id: "child-a" }, { child_id: "child-b" }];
  assert.equal(selectAuthorizedChild(children, "child-b")?.child_id, "child-b");
  assert.equal(selectAuthorizedChild(children, "child-c"), null);
});

test("dashboard communication preview excludes private message body", () => {
  const preview = safeDashboardMessagePreview({ sender: { full_name: "צוות א" }, subject: "פרטי" });
  assert.equal(preview.title, "צוות א");
  assert.equal(preview.summary, "יש הודעה חדשה בשיחה המורשית");
  assert.equal(JSON.stringify(preview).includes("פרטי"), false);
});

test("camera records alone never become verified monitoring", () => {
  assert.equal(safetyCapabilityState({ configuredCameraCount: 2, verifiedOperationalCount: 0, providerReady: false }).state, "readiness");
  assert.equal(safetyCapabilityState({ configuredCameraCount: 0, verifiedOperationalCount: 0, providerReady: false }).state, "unavailable");
});

test("role pages use canonical scoped sources and navigation", () => {
  const garden = read("app/dashboard/garden/operations/page.tsx");
  const parent = read("app/dashboard/parent/page.tsx");
  const staff = read("app/dashboard/staff/page.tsx");
  const admin = read("app/dashboard/admin/page.tsx");
  const shell = read("components/role-app-shell.tsx");
  assert.match(garden, /tuition_billing_periods/);
  assert.match(garden, /kindergarten_subscriptions/);
  assert.doesNotMatch(garden, /children[^\n]*payment_status/);
  assert.match(garden, /actual_start,actual_end/);
  assert.doesNotMatch(garden, /observer_intelligence_signals|ai_events/);
  assert.match(parent, /name="child"/);
  assert.match(parent, /selectAuthorizedChild/);
  assert.match(parent, /\.eq\("child_id", selectedChildId\)/);
  assert.match(staff, /staff_classroom_assignments/);
  assert.doesNotMatch(staff, /select\("[^"]*(allergies|medical_notes|regular_medications)/);
  assert.doesNotMatch(staff, /select\("[^"]*(body|content)[^"]*"\)/);
  assert.match(admin, /Promise\.resolve\(\{ data: \[\], error: null \}\)/);
  assert.match(shell, /\/dashboard\/admin\/reports/);
  assert.match(shell, /\/dashboard\/garden\/messages/);
});

test("multi-Garden Staff receives an explicit context choice instead of candidate content", () => {
  const staff = read("app/dashboard/staff/page.tsx");
  const selector = read("components/staff-garden-selector.tsx");
  assert.match(staff, /employments\.length > 1 && !initialContext\.activeEmployment/);
  assert.match(staff, /בחרו גן עבודה/);
  assert.match(selector, /option value="" disabled/);
  assert.match(selector, /api\/staff\/employment-context/);
});

test("approved unassigned Inspector gets a private empty state while suspension still fails closed", () => {
  const inspector = read("app/dashboard/inspector/page.tsx");
  const guard = read("lib/management/operational-role.ts");
  assert.match(inspector, /requireApprovedInspector/);
  assert.match(inspector, /טרם הוקצו לך גנים/);
  assert.match(inspector, /assignedGardens\.length === 0/);
  assert.match(guard, /profile\.active !== true\) redirect\("\/dashboard\/inspector\/apply"\)/);
  assert.match(guard, /current_inspector_approved/);
});

test("dashboard notification endpoints reject unauthenticated requests without redirect exceptions", () => {
  const listRoute = read("app/api/notifications/route.ts");
  const markReadRoute = read("app/api/notifications/mark-read/route.ts");
  for (const source of [listRoute, markReadRoute]) {
    assert.match(source, /getSessionProfile\(\)/);
    assert.match(source, /return fail\("נדרשת התחברות מחדש\.", 401\)/);
    assert.doesNotMatch(source, /requireUser\(/);
  }
});
