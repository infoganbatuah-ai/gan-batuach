#!/usr/bin/env node
// Offline source check: no SQL execution, database connection or service startup.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const matrix = JSON.parse(readFileSync(new URL("./CLAIM-REFERENCED-UNIQUES-SOURCE-MATRIX-20261027.json", import.meta.url), "utf8"));
const local = path => readFileSync(`${root}${path}`, "utf8");
const gitText = (ref, path) => execFileSync("git", ["show", `${ref}:${path}`], { cwd: root, encoding: "utf8" });
const sha = text => createHash("sha256").update(text).digest("hex");
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const columnsPattern = columns => columns.map(escape).join("\\s*,\\s*");
const claim = local(matrix.references.claimOnly.path);
const draft = gitText(matrix.references.draft.ref, matrix.references.draft.path);
const migrationPaths = execFileSync("git", ["ls-files", "supabase/migrations"], { cwd: root, encoding: "utf8" })
  .trim().split("\n").filter(path => path.endsWith(".sql"));
const migrations = migrationPaths.map(path => [path, local(path)]);

function verifyPin(entry, text) {
  assert.equal(sha(text), entry.sha256, `source drift: ${entry.path}`);
}
function exactUniqueStatements(text, table, columns) {
  const tablePattern = escape(table);
  const cols = columnsPattern(columns);
  const source = text.replace(/--[^\n]*/g, "");
  const index = new RegExp(`\\bCREATE\\s+UNIQUE\\s+INDEX\\b[^;]*?\\bON\\s+(?:ONLY\\s+)?${tablePattern}\\s*\\(\\s*${cols}\\s*\\)[^;]*;`, "gi");
  const constraint = new RegExp(`\\bALTER\\s+TABLE\\s+${tablePattern}\\s+ADD\\s+CONSTRAINT\\s+\\w+\\s+UNIQUE\\s*\\(\\s*${cols}\\s*\\)[^;]*;`, "gi");
  const inline = new RegExp(`\\bCREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+${tablePattern}\\s*\\([^;]*?\\bUNIQUE\\s*\\(\\s*${cols}\\s*\\)[^;]*;`, "gi");
  return [...source.matchAll(index), ...source.matchAll(constraint), ...source.matchAll(inline)].map(match => match[0]);
}
function verifyRow(row, parts) {
  const { claimText, draftText, migrationTexts } = parts;
  assert.equal(row.catalogInstalled, "UNVERIFIED");
  assert.equal(row.historicalRows, "UNVERIFIED");
  assert.equal(row.trackedMigrationMatch, false);
  assert.equal(row.partial, false, `${row.id}: proposal must be nonpartial`);
  assert.ok(row.gates.includes("exact unique key catalog check"));
  const fk = new RegExp(`CONSTRAINT\\s+${escape(row.claimConstraint)}\\s+FOREIGN\\s+KEY\\s*\\([^)]*\\)\\s+REFERENCES\\s+${escape(row.referencedTable)}\\s*\\(\\s*${columnsPattern(row.referencedColumns)}\\s*\\)`, "i");
  assert.match(claimText, fk, `${row.id}: claim FK-reference mismatch`);
  const proposalLine = draftText.split("\n").slice(row.draftLine - 1, row.draftLine + 4).join("\n");
  assert.match(proposalLine, new RegExp(`CREATE\\s+UNIQUE\\s+INDEX\\s+${escape(row.proposedIndex)}\\b`, "i"), `${row.id}: proposal line/index drift`);
  const proposed = exactUniqueStatements(proposalLine + ";", row.referencedTable, row.referencedColumns);
  assert.equal(proposed.length, 1, `${row.id}: exact nonpartial proposal missing`);
  assert.doesNotMatch(proposed[0], /\bWHERE\b/i, `${row.id}: partial index cannot support this FK`);
  for (const evidence of row.columnEvidence) {
    const text = migrationTexts.find(([path]) => path === evidence.path)?.[1];
    assert.ok(text, `${row.id}: source migration missing: ${evidence.path}`);
    verifyPin(evidence, text);
    const line = text.split("\n")[evidence.line - 1]?.toLowerCase() ?? "";
    const normalized = evidence.contract.toLowerCase().replace("; nullable", "").replace(" references", "");
    assert.ok(line.includes(normalized), `${row.id}: column line/type/nullability drift at ${evidence.path}:${evidence.line}`);
    if (evidence.contract.includes("nullable")) assert.doesNotMatch(line, /\bnot\s+null\b/i);
  }
  const matches = migrationTexts.flatMap(([path, text]) => exactUniqueStatements(text, row.referencedTable, row.referencedColumns).map(sql => ({ path, sql })));
  assert.equal(matches.length, 0, `${row.id}: matching tracked migration found; review matrix before asserting absence`);
}

assert.equal(matrix.status, "SOURCE_PROPOSAL_ONLY_CATALOG_UNVERIFIED");
assert.equal(matrix.activation, "BLOCKED_NO_MIGRATION_OR_SQL_EXECUTION");
assert.equal(matrix.retention, "ENGINEERING_BASELINE_ONLY_NO_ROW_DELETION");
assert.equal(matrix.keys.length, 4);
assert.equal(migrations.length, matrix.trackedMigrationsInspected);
verifyPin(matrix.references.claimOnly, claim);
verifyPin(matrix.references.draft, draft);
const parts = { claimText: claim, draftText: draft, migrationTexts: migrations };
for (const row of matrix.keys) verifyRow(row, parts);

let negative = 0;
function rejects(fn, pattern) { assert.throws(fn, pattern); negative++; }
const site = matrix.keys[0];
rejects(() => verifyPin(matrix.references.claimOnly, claim + " "), /source drift/);
rejects(() => verifyRow(site, { ...parts, claimText: claim.replace("REFERENCES public.observer_sites(id, digital_observer_organization_id)", "REFERENCES public.observer_sites(id, garden_id)") }), /FK-reference mismatch/);
rejects(() => verifyRow(site, { ...parts, draftText: draft.replace("ON public.observer_sites(id, digital_observer_organization_id)", "ON public.observer_sites(id, garden_id)") }), /exact nonpartial proposal missing/);
rejects(() => verifyRow({ ...site, draftLine: 14 }, parts), /proposal line\/index drift/);
rejects(() => verifyRow(site, { ...parts, migrationTexts: [...migrations, ["synthetic-uncommitted.sql", "CREATE UNIQUE INDEX synthetic ON public.observer_sites(id, digital_observer_organization_id);"]] }), /matching tracked migration found/);
rejects(() => verifyRow({ ...site, partial: true }, parts), /nonpartial/);

console.log(`PASS: ${matrix.keys.length} composite-key source rows, ${migrations.length} tracked migration files scanned, pinned claims/draft/columns and exact FK references; ${negative} negative fixtures. Catalog/rows NOT verified; no SQL executed.`);
