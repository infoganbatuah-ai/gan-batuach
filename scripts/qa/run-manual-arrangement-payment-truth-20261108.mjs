import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { sql, config, assertLocalDatabase } from '../development/local-database.mjs';

const phase = process.argv[2];
if (!['pre-fix', 'proposed', 'installed'].includes(phase)) {
  throw new Error('Explicit pre-fix, proposed or installed phase required');
}
assertLocalDatabase();
if (config.environment !== 'DEVELOPMENT / INTEGRATION' ||
    config.productionAllowed !== false || config.projectId !== 'gan-batuach-integration') {
  throw new Error('Isolated Development identity required');
}

const migration = readFileSync('supabase/migrations/20261108000829_management_manual_arrangement_payment_truth.sql', 'utf8');
const testSql = readFileSync('scripts/qa/manual-arrangement-payment-truth-20261108.sql', 'utf8');
const fixtureCount = () => Number(sql(`
  select
    (select count(*) from public.permanent_child_files where id in
      ('f0000000-0000-4000-8000-000000001001','f0000000-0000-4000-8000-000000001002')) +
    (select count(*) from public.children where id='f0000000-0000-4000-8000-000000001011') +
    (select count(*) from public.kindergarten_enrollment_requests where id in
      ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022')) +
    (select count(*) from public.classroom_seat_reservations where id in
      ('f0000000-0000-4000-8000-000000001031','f0000000-0000-4000-8000-000000001032')) +
    (select count(*) from public.enrollment_payment_evidence where enrollment_request_id in
      ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022')) +
    (select count(*) from public.audit_logs where after_data->>'request_id' in
      ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022'));
`).trim());
const functionHash = () => createHash('sha256').update(sql(`
  select pg_get_functiondef('public.activate_enrollment_from_evidence(uuid,uuid)'::regprocedure);
`)).digest('hex');

if (fixtureCount() !== 0) throw new Error('Disposable fixture collision; refuse');
const before = functionHash();
let output;
let defectReproduced = false;
try {
  output = sql(`begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
${phase === 'proposed' ? migration : ''}
${testSql}
rollback;`);
} catch (error) {
  if (phase !== 'pre-fix' || !String(error.stderr ?? '').includes('manual_arrangement_masquerades_as_payment')) throw error;
  defectReproduced = true;
} finally {
  if (fixtureCount() !== 0) throw new Error('Rollback fixture residue detected');
  if (functionHash() !== before) throw new Error('Rollback did not restore the function');
}
if (phase === 'pre-fix' && !defectReproduced) throw new Error('Pre-fix defect did not reproduce');
if (phase !== 'pre-fix' && !output.includes('MANUAL_ARRANGEMENT_PAYMENT_TRUTH_ROLLBACK_ONLY')) {
  throw new Error('Expected SQL assertion marker absent');
}
console.log(JSON.stringify({ phase, result: phase === 'pre-fix'
    ? 'PRE_FIX_DEFECT_REPRODUCED_ROLLBACK_ONLY' : 'MANUAL_ARRANGEMENT_PAYMENT_TRUTH_ROLLBACK_ONLY',
  destination: config.projectId, rollbackVerified: true, functionRestored: true }));
