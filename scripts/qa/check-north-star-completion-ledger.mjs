import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md", "utf8");
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

console.log(JSON.stringify({ status: "PASS", total, ownerless: 0, counts }, null, 2));
