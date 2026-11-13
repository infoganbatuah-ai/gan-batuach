import { readFileSync } from 'node:fs';
import { sql, config, assertLocalDatabase } from '../development/local-database.mjs';

const phase = process.argv[2];
if (!['pre-fix', 'proposed', 'installed'].includes(phase)) {
  throw new Error('Explicit pre-fix, proposed or installed phase required');
}
assertLocalDatabase();
if (config.environment !== 'DEVELOPMENT / INTEGRATION' || config.productionAllowed !== false ||
    config.projectId !== 'gan-batuach-integration') {
  throw new Error('Isolated Development identity required');
}
const migration = readFileSync('supabase/migrations/20261107230104_management_manual_arrangement_state_guard.sql', 'utf8');
const script = readFileSync(
  phase === 'pre-fix'
    ? 'scripts/qa/manual-arrangement-state-guard-prefix-20261108.sql'
    : 'scripts/qa/manual-arrangement-state-guard-post-20261108.sql', 'utf8');
const fixtures = [
  'f0000000-0000-4000-8000-000000000901',
  'f0000000-0000-4000-8000-000000000902',
  'f0000000-0000-4000-8000-000000000903',
  'f0000000-0000-4000-8000-000000000904',
  'f0000000-0000-4000-8000-000000000905',
  'f0000000-0000-4000-8000-000000000906',
];
const quoted = fixtures.map(id => `'${id}'`).join(',');
const before = Number(sql(`select count(*) from public.permanent_child_files where id in (${quoted});`).trim());
if (before !== 0) throw new Error('Disposable fixture IDs already exist; refuse');
const proposed = phase === 'proposed' ? migration : '';
const expected = phase === 'pre-fix'
  ? 'PRE_FIX_DEFECT_REPRODUCED_ROLLBACK_ONLY'
  : 'POST_FIX_GUARD_ROLLBACK_ONLY';
let output;
try {
  output = sql(`begin; set local lock_timeout='5s'; set local statement_timeout='30s';
${proposed}
${script}
rollback;`);
} finally {
  const after = Number(sql(`select count(*) from public.permanent_child_files where id in (${quoted});`).trim());
  if (after !== 0) throw new Error('Rollback fixture residue detected');
}
if (!output.includes(expected)) throw new Error('Behavior assertion marker absent');
console.log(JSON.stringify({ phase, result: expected, destination: config.projectId, rollbackVerified: true }));
