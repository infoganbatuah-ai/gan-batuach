#!/usr/bin/env node
// Offline contract/containment check. Does not connect to or execute SQL.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = new URL("./", import.meta.url);
const read = name => readFileSync(new URL(name, here), "utf8");
const matrix = JSON.parse(read("CLAIM-REFERENCED-UNIQUES-SOURCE-MATRIX-20261027.json"));
const sql = read("CLAIM-REFERENCED-UNIQUES-CANDIDATE-NOT-APPLIED.sql");
const plan = read("CLAIM-REFERENCED-UNIQUES-MIGRATION-PREFLIGHT-20261027.md");
const root = fileURLToPath(new URL("../../", import.meta.url));
assert.ok(root.endsWith("/"));

assert.equal(matrix.keys.length, 4);
assert.match(sql, /^BEGIN;\s*DO \$review_guard\$/m);
assert.match(sql, /RAISE EXCEPTION 'DRAFT_NOT_APPLIED:/);
assert.match(sql, /\$review_guard\$;\s*ROLLBACK;/);
const candidate = sql.match(/\/\* FUTURE CANDIDATE ONLY[\s\S]*?\*\//)?.[0];
assert.ok(candidate, "all candidate DDL must be in one block comment");
const executable = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE)\b/i);
const matches = [...candidate.matchAll(/CREATE UNIQUE INDEX CONCURRENTLY\s+(\w+)\s+ON\s+(public\.\w+)\s*\(([^)]*)\);/g)];
assert.equal(matches.length, 4, "one exact candidate per composite FK");
for (const [i, row] of matrix.keys.entries()) {
  const [, index, table, columns] = matches[i];
  assert.equal(index, row.proposedIndex);
  assert.equal(table, row.referencedTable);
  assert.deepEqual(columns.split(",").map(x => x.trim()), row.referencedColumns);
  assert.ok(plan.includes(row.claimConstraint), `${row.id}: FK missing from plan`);
  assert.ok(plan.includes(row.referencedTable), `${row.id}: table missing from plan`);
}
assert.match(plan, /NOT APPLIED; NOT READY TO APPLY/);
assert.match(plan, /historical nullable scope/i);
assert.match(plan, /ACL, RLS and Data API/i);
assert.match(plan, /Lossless rollback is \*\*not proven\*\*/);
console.log("PASS: four exact guarded candidate keys, order, claim FK mapping, containment and blocked gates; no SQL executed");
