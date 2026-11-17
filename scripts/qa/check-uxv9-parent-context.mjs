import assert from "node:assert/strict";
import { requestMatchesParentChild, resolveParentDashboardChild } from "../../lib/domain/parent-family.ts";
import { selectAuthorizedChild } from "../../lib/management/dashboard-read-model.ts";

const fileA = "file-a";
const fileB = "file-b";
const gardenChildA = "child-a";
const gardenChildB = "child-b";
const authorized = [
  { id: "enrollment-a", child_id: gardenChildA, permanent_child_file_id: fileA, full_name: "אותו שם" },
  { id: "enrollment-b", child_id: gardenChildB, permanent_child_file_id: fileB, full_name: "אותו שם" },
];
const enrollments = [
  { child_id: gardenChildA, permanent_child_file_id: fileA, status: "ended", garden_id: "old-garden" },
  { child_id: gardenChildA, permanent_child_file_id: fileA, status: "active", garden_id: "garden-a" },
  { child_id: gardenChildB, permanent_child_file_id: fileB, status: "active", garden_id: "garden-b" },
];

const first = resolveParentDashboardChild(selectAuthorizedChild(authorized, gardenChildA), enrollments);
assert.equal(first.contextId, gardenChildA);
assert.equal(first.fileId, fileA);
assert.equal(first.gardenChildId, gardenChildA);
assert.equal(first.enrollment?.garden_id, "garden-a");

const second = resolveParentDashboardChild(selectAuthorizedChild(authorized, gardenChildB), enrollments);
assert.equal(second.contextId, gardenChildB);
assert.equal(second.fileId, fileB);
assert.equal(second.enrollment?.garden_id, "garden-b");
assert.notEqual(first.contextId, second.contextId, "same display name must not collapse child identity");

const fileOnly = resolveParentDashboardChild({ id: "file-c" }, []);
assert.equal(fileOnly.contextId, "file-c");
assert.equal(fileOnly.fileId, "file-c");
assert.equal(fileOnly.gardenChildId, "");

const foreign = resolveParentDashboardChild(selectAuthorizedChild(authorized, "foreign-child"), enrollments);
assert.equal(foreign.contextId, "");
assert.equal(foreign.fileId, "");
assert.equal(foreign.gardenChildId, "");
assert.equal(foreign.enrollment, undefined);
assert.equal(requestMatchesParentChild({ child_profile_id: fileA }, first.fileId), true);
assert.equal(requestMatchesParentChild({ child_profile_id: fileB }, first.fileId), false);
assert.equal(requestMatchesParentChild({ child_profile_id: gardenChildA }, first.fileId), false);
assert.equal(requestMatchesParentChild({ child_profile_id: fileA }, foreign.fileId), false);

console.log("UXV9 Parent authorized child identity: 20 assertions passed");
