import test from "node:test";
import assert from "node:assert/strict";
import { taskAssigneesFromEmployments } from "../../lib/management/task-assignees.ts";

const approved = (profile_id, full_name, extra = {}) => ({
  profile_id, start_date: "2026-01-01", end_date: null,
  staff: { profile_id, full_name, approved_to_work: true, onboarding_status: "active" },
  ...extra
});

test("only currently eligible Staff from the selected Garden can be offered for task assignment", () => {
  const rows = [
    approved("staff-b", "QA Staff B"),
    approved("staff-b", "QA Staff B"),
    approved("future", "Future", { start_date: "2026-11-08" }),
    approved("ended", "Ended", { end_date: "2026-11-06" }),
    approved("not-approved", "Unapproved", { staff: { profile_id: "not-approved", full_name: "Unapproved", approved_to_work: false, onboarding_status: "active" } }),
    approved("mismatch", "Other", { staff: { profile_id: "other", full_name: "Other", approved_to_work: true, onboarding_status: "active" } }),
    approved("pending", "Pending", { staff: { profile_id: "pending", full_name: "Pending", approved_to_work: true, onboarding_status: "pending" } })
  ];
  assert.deepEqual(taskAssigneesFromEmployments(rows, "2026-11-07"), [{ id: "staff-b", name: "QA Staff B" }]);
});

test("an empty or unavailable employment list cannot silently offer a Staff assignee", () => {
  assert.deepEqual(taskAssigneesFromEmployments([], "2026-11-07"), []);
  assert.deepEqual(taskAssigneesFromEmployments([approved(null, "Unknown")], "2026-11-07"), []);
});
