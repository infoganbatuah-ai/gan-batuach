import assert from "node:assert/strict";
import test from "node:test";
import { filterAdminInspections, normalizeAdminInspectionFilters } from "../../lib/admin-inspection-filters.ts";

const rows = [
  { id: "a", status: "open", gardens: { name: "גן נרקיס", city: "חיפה" }, inspectors: { full_name: "דנה כהן" } },
  { id: "b", status: "done", gardens: { name: "גן אור", city: "תל אביב" }, inspectors: { full_name: "רות לוי" } },
  { id: "c", status: "overdue", gardens: { name: "גן נרקיס", city: "ירושלים" }, inspectors: { full_name: "אורי בר" } }
];

test("search and status combine on the bounded supplied result set", () => {
  assert.deepEqual(filterAdminInspections(rows, { q: "נרקיס", status: "overdue" }).map((row) => row.id), ["c"]);
  assert.deepEqual(filterAdminInspections(rows, { q: "חיפה", status: "all" }).map((row) => row.id), ["a"]);
  assert.deepEqual(filterAdminInspections(rows, { q: "רות", status: "done" }).map((row) => row.id), ["b"]);
  assert.deepEqual(filterAdminInspections(rows, { q: "חיפה", status: "done" }), []);
  assert.equal(rows.length, 3);
});

test("URL input is bounded and unknown statuses cannot change filter semantics", () => {
  assert.deepEqual(normalizeAdminInspectionFilters({ q: ["ignored"], status: ["done"] }), { q: "", status: "all" });
  assert.deepEqual(normalizeAdminInspectionFilters({ q: "  גן אור  ", status: "late" }), { q: "גן אור", status: "all" });
  assert.equal(normalizeAdminInspectionFilters({ q: "x".repeat(100), status: "done" }).q.length, 80);
  assert.deepEqual(filterAdminInspections(rows, normalizeAdminInspectionFilters({ q: "", status: "overdue" })).map((row) => row.id), ["c"]);
});
