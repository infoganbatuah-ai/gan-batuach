import assert from "node:assert/strict";
import test from "node:test";
import { parentAttendanceChildren } from "../../lib/domain/parent-attendance-children.ts";

test("a non-primary guardian's active enrollment exposes the Garden child ID", () => {
  const rows = parentAttendanceChildren([], [{
    child_id: "garden-child-a",
    permanent_child_file_id: "permanent-file-a",
    id: "enrollment-a",
    garden_id: "garden-a",
    full_name: "Synthetic Child"
  }]);
  assert.deepEqual(rows, [{ id: "garden-child-a", full_name: "Synthetic Child", photo_url: null, garden_id: "garden-a" }]);
});

test("a file-only enrollment is never turned into an attendance child ID", () => {
  const rows = parentAttendanceChildren([], [{
    id: "enrollment-a",
    permanent_child_file_id: "permanent-file-a",
    garden_id: "garden-a"
  }]);
  assert.deepEqual(rows, []);
});

test("the primary Child row and enrollment resolve to one selected Garden context", () => {
  const rows = parentAttendanceChildren(
    [{ id: "garden-child-a", full_name: "Canonical Child", photo_url: "private-photo-a", garden_id: "garden-a" }],
    [{ child_id: "garden-child-a", permanent_child_file_id: "permanent-file-a", full_name: "Enrollment Alias", garden_id: "garden-a" }]
  );
  assert.deepEqual(rows, [{ id: "garden-child-a", full_name: "Canonical Child", photo_url: "private-photo-a", garden_id: "garden-a" }]);
});

test("different Garden child IDs sharing a permanent file remain separate contexts", () => {
  const rows = parentAttendanceChildren([], [
    { child_id: "garden-child-a", permanent_child_file_id: "shared-file", garden_id: "garden-a" },
    { child_id: "garden-child-b", permanent_child_file_id: "shared-file", garden_id: "garden-b" }
  ]);
  assert.deepEqual(rows.map(({ id, garden_id }) => [id, garden_id]), [
    ["garden-child-a", "garden-a"], ["garden-child-b", "garden-b"]
  ]);
});
