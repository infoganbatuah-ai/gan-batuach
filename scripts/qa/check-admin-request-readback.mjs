import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminRequestSelection, selectAdminRequestRow } from "../../lib/management/admin-request-selection.ts";

const id = "550e8400-e29b-41d4-a716-446655440000";

test("only parent and staff requests with one valid UUID can be selected", () => {
  assert.deepEqual(parseAdminRequestSelection({ kind: "parent", id }), { kind: "parent", id });
  assert.deepEqual(parseAdminRequestSelection({ kind: "staff", id }), { kind: "staff", id });
  for (const query of [{ kind: "parent" }, { kind: "garden", id }, { kind: "staff", id: "bad" }, { kind: ["parent", "staff"], id }, { kind: "parent", id: [id, id] }]) {
    assert.equal(parseAdminRequestSelection(query), null);
  }
});

test("readback resolves only a row already present in the authorized bounded queue", () => {
  const rows = [{ id, status: "submitted" }];
  assert.deepEqual(selectAdminRequestRow(rows, id), rows[0]);
  assert.equal(selectAdminRequestRow(rows, "550e8400-e29b-41d4-a716-446655440001"), null);
});
