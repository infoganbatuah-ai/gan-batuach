#!/usr/bin/env node
// Text-only containment/shape test. No database connection or SQL execution.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("CLAIM-HISTORICAL-AGGREGATES-NOT-RUN.sql", import.meta.url), "utf8");
const plan = readFileSync(new URL("CLAIM-HISTORICAL-COMPATIBILITY-GATE-20261027.md", import.meta.url), "utf8");
function validate(source) {
  assert.match(source, /^BEGIN READ ONLY;\s*DO \$historical_guard\$/m);
  assert.match(source, /RAISE EXCEPTION 'DRAFT_NOT_RUN:/);
  assert.match(source, /\$historical_guard\$;\s*ROLLBACK;/);
  const block = source.match(/\/\* FUTURE OWNER-AUTHORIZED[\s\S]*?\*\//)?.[0];
  assert.ok(block, "candidate must be fully commented");
  const executable = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
  assert.doesNotMatch(executable, /\b(?:SELECT|CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE)\b/i);
  assert.match(block, /BEGIN READ ONLY;/);
  assert.match(block, /statement_timeout = '3s'/);
  assert.match(block, /lock_timeout = '250ms'/);
  assert.match(block, /idle_in_transaction_session_timeout = '10s'/);
  assert.match(block, /work_mem = '4MB'/);
  assert.match(block, /ROLLBACK;/);
  const uncommented = block.replace(/^\/\*|\*\/$/g, "").replace(/--[^\n]*/g, "");
  const body = uncommented.slice(uncommented.indexOf("BEGIN READ ONLY;"));
  assert.doesNotMatch(body, /\b(?:GROUP\s+BY|ORDER\s+BY|LIMIT|OFFSET|EXPLAIN|COPY|pg_sleep|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i);
  const queries = [...body.matchAll(/\bSELECT\s+([\s\S]*?)\s+FROM\s+(public\.\w+)[\s\S]*?;/g)];
  assert.equal(queries.length, 4, "exactly four aggregate statements");
  const expected = ["observer_sites", "observer_intelligence_signals", "observer_correlated_events", "digital_observer_risk_evaluations"];
  for (const [i, query] of queries.entries()) {
    assert.equal(query[2], `public.${expected[i]}`);
    const projections = query[1].split(",").map(part => part.trim());
    assert.ok(projections.length >= 4);
    for (const projection of projections)
      assert.match(projection, /^count\(\*\)(?:\s+FILTER\s*\(.*\))?\s+AS\s+[a-z_]+$/is, `non-COUNT projection in S${i + 1}`);
  }
  for (const table of expected) assert.ok(block.includes(`public.${table}`));
  return queries.length;
}

assert.equal(validate(sql), 4);
assert.match(plan, /NOT RUN \/ NOT AUTHORIZED/);
assert.match(plan, /zero\/nonzero/);
let negatives = 0;
function rejects(mutated) { assert.throws(() => validate(mutated)); negatives++; }
rejects(sql.replace("BEGIN READ ONLY;", "BEGIN;"));
rejects(sql.replace("DRAFT_NOT_RUN:", "UNGUARDED:"));
rejects(sql.replace("count(*) AS site_total", "id AS site_total"));
rejects(sql.replace("statement_timeout = '3s'", "statement_timeout = '0'"));
rejects(sql.replace("FROM public.digital_observer_risk_evaluations", "FROM public.other_table"));
rejects(sql.replace("ROLLBACK;\n*/", "COMMIT;\n*/"));
console.log(`PASS: ${validate(sql)} guarded COUNT-only candidates, ${negatives} negative fixtures; SQL NOT RUN`);
