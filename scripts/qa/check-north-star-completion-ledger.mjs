import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md", "utf8");
const ownership = JSON.parse(readFileSync("DIGITAL_OBSERVER_CAPABILITY_PUSH_OWNERSHIP_MAP.json", "utf8"));
const start = source.indexOf("## CAMERA PLATFORM");
const end = source.indexOf("## CURRENT COMPLETION COUNTS");
assert(start >= 0 && end > start, "North-Star capability ledger boundaries are missing");

const statuses = [
  "DONE + REAL PROOF",
  "IMPLEMENTED — NEEDS REAL PROOF",
  "FOUNDATION",
  "PARTIAL",
  "NOT STARTED",
  "EXTERNAL COVERAGE GAP",
];
const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
for (const line of source.slice(start, end).split("\n")) {
  const cells = line.split("|").map((cell) => cell.trim());
  if (cells.length < 4 || !(cells[2] in counts)) continue;
  counts[cells[2]] += 1;
}

const summary = {};
for (const line of source.slice(end).split("\n")) {
  const cells = line.split("|").map((cell) => cell.trim());
  const status = cells[1]?.replaceAll("`", "");
  if (status in counts && /^\d+$/.test(cells[2] || "")) summary[status] = Number(cells[2]);
}
for (const status of statuses) {
  assert.equal(summary[status], counts[status], `North-Star summary drift for ${status}`);
}
const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
assert.match(source.slice(end), new RegExp(`\\| \\*\\*TOTAL\\*\\* \\| \\*\\*${total}\\*\\* \\|`));
assert.match(source.slice(end), new RegExp(`Canonical owner coverage: \\*\\*${total}/${total}\\*\\*; capabilities without an owning canonical PUSH: \\*\\*0\\*\\*\\.`));

const additionsStart = source.indexOf("## POST-PUSH-38 ADDITIVE CAPABILITY REGISTER");
const reconciledStart = source.indexOf("### Reconciled counts", additionsStart);
assert(additionsStart > end && reconciledStart > additionsStart, "North-Star additive register boundaries are missing");
const additionCounts = Object.fromEntries(statuses.map((status) => [status, 0]));
const additionIds = [];
for (const line of source.slice(additionsStart, reconciledStart).split("\n")) {
  const cells = line.split("|").map((cell) => cell.trim());
  const id = cells[1]?.replaceAll("`", "");
  if (!/^DO-NS-\d{3}$/.test(id) || !(cells[3] in additionCounts)) continue;
  additionIds.push(id);
  additionCounts[cells[3]] += 1;
}
assert.deepEqual(additionIds, ["DO-NS-191", "DO-NS-192", "DO-NS-193", "DO-NS-194", "DO-NS-195", "DO-NS-196", "DO-NS-197"]);

const reconciledCounts = Object.fromEntries(statuses.map((status) => [status, counts[status] + additionCounts[status]]));
const reconciledTotal = Object.values(reconciledCounts).reduce((sum, count) => sum + count, 0);
assert.equal(reconciledTotal, 197);
assert.equal(ownership.canonicalRoadmapPushCount, 52);
assert.equal(ownership.originalCapabilityCount, total);
assert.equal(ownership.addedCapabilityCount, additionIds.length);
assert.equal(ownership.reconciledCapabilityCount, reconciledTotal);
assert.equal(ownership.capabilities.length, reconciledTotal);
const expectedIds = Array.from({ length: reconciledTotal }, (_, index) => `DO-NS-${String(index + 1).padStart(3, "0")}`);
assert.deepEqual(ownership.capabilities.map((row) => row.id), expectedIds, "North-Star IDs must be unique, stable and contiguous");
assert.equal(ownership.capabilities.filter((row) => !row.canonicalImplementationOwner?.id).length, 0, "Every capability needs one implementation owner");
assert.equal(ownership.capabilities.filter((row) => !row.proofOwner?.id).length, 0, "Every capability needs one proof owner or release gate");
const machineCounts = Object.fromEntries(statuses.map((status) => [status, 0]));
for (const row of ownership.capabilities) {
  assert(row.canonicalStatus in machineCounts, `Unknown machine status for ${row.id}`);
  machineCounts[row.canonicalStatus] += 1;
}
assert.deepEqual(machineCounts, reconciledCounts, "Machine-readable capability statuses must match the reconciled matrix");
assert.deepEqual(ownership.statusCounts, reconciledCounts, "Machine-readable status summary must match its rows");

console.log(JSON.stringify({ status: "PASS", originalTotal: total, addedTotal: additionIds.length,
  reconciledTotal, ownerless: 0, proofOwnerless: 0, originalCounts: counts, reconciledCounts }, null, 2));
