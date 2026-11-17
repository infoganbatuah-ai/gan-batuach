import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPush44Upgrade, TARGET } from '../development/plan-push44-preference-upgrade.mjs';

const historical = { file: 'supabase/migrations/20260101000000_old.sql', sha256: 'h1', blob: 'b1' };
const newer = { file: 'supabase/migrations/20261115002000_current.sql', sha256: 'h2', blob: 'b2' };
const target = { file: TARGET, sha256: 'h3', blob: 'b3' };
const valid = () => ({
  files: [historical, newer, target],
  baseline: { source_mapping: [{ ...historical, sourceSha256: historical.sha256, version: '20260101000000' }] },
  applied: [{ filename: newer.file, version: '20261115002000', source_digest: newer.sha256,
    schema_fingerprint: 'schema' }],
  ledger: [{ file: TARGET, blob: target.blob, developmentApproval: 'VALIDATED_FOR_ISOLATED_DEVELOPMENT',
    developmentDependsOn: ['20261115002000'] }],
  schemaFingerprint: 'schema', expectedBaseline: 1, expectedApplied: 1
});
const blockers = change => assessPush44Upgrade({ ...valid(), ...change }).blockers;

test('exact next migration is reviewable without historical replay or mutation', () => {
  const report = assessPush44Upgrade(valid());
  assert.equal(report.status, 'READY_FOR_SEPARATE_APPLY_REVIEW');
  assert.equal(report.historicalReplay, false);
  assert.equal(report.databaseMutation, false);
  assert.deepEqual(report.missing, [TARGET]);
});
test('changed baseline bytes and blob both fail closed', () => {
  for (const change of [{ ...historical, sha256: 'changed' }, { ...historical, blob: 'changed' }])
    assert.ok(blockers({ files: [change, newer, target] }).some(b => b.startsWith('BASELINE_SOURCE_DRIFT:')));
});
test('missing approval, wrong target blob and missing dependency fail closed', () => {
  assert.ok(blockers({ ledger: [] }).includes('TARGET_NOT_LEDGER_APPROVED'));
  assert.ok(blockers({ ledger: [{ ...valid().ledger[0], blob: 'wrong' }] }).includes('TARGET_NOT_LEDGER_APPROVED'));
  assert.ok(blockers({ ledger: [{ ...valid().ledger[0], developmentDependsOn: ['20261116000000'] }] })
    .includes('TARGET_DEPENDENCY_MISSING'));
});
test('receipt drift, historical replay and live schema drift fail closed', () => {
  assert.ok(blockers({ applied: [{ ...valid().applied[0], source_digest: 'wrong' }] })
    .some(b => b.startsWith('POST_BASELINE_RECEIPT_INVALID:')));
  assert.ok(blockers({ applied: [{ ...valid().applied[0], filename: historical.file }] })
    .some(b => b.startsWith('BASELINE_SOURCE_DRIFT:')));
  assert.ok(blockers({ schemaFingerprint: 'drift' }).includes('LIVE_SCHEMA_DRIFT'));
});
test('missing target, duplicate mapping or reordered version cannot pass', () => {
  assert.ok(blockers({ files: [historical, newer] }).includes('UPGRADE_IS_NOT_EXACTLY_NEXT_TARGET'));
  assert.ok(blockers({ baseline: { source_mapping: [valid().baseline.source_mapping[0],
    valid().baseline.source_mapping[0]] } }).includes('COUNT_OR_DUPLICATE_MISMATCH'));
  assert.ok(blockers({ applied: [{ ...valid().applied[0], version: '20261117000000' }] })
    .includes('UPGRADE_IS_NOT_EXACTLY_NEXT_TARGET'));
});
test('audited historical out-of-order filenames are accepted; duplicate receipt versions are not', () => {
  const older = { file: 'supabase/migrations/20260913210000_late.sql', sha256: 'h4', blob: 'b4' };
  const caseWithLate = valid();
  caseWithLate.files = [historical, newer, older, target];
  caseWithLate.applied = [caseWithLate.applied[0], {
    filename: older.file, version: '20260913210000', source_digest: older.sha256,
    schema_fingerprint: 'schema'
  }];
  caseWithLate.expectedApplied = 2;
  assert.equal(assessPush44Upgrade(caseWithLate).status, 'READY_FOR_SEPARATE_APPLY_REVIEW');
  caseWithLate.applied[1].version = caseWithLate.applied[0].version;
  assert.ok(assessPush44Upgrade(caseWithLate).blockers.some(b =>
    b.startsWith('POST_BASELINE_RECEIPT_INVALID:')));
});
