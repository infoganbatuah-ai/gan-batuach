import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const indexPath = resolve(root, 'review-only/push50-evidence-preparation/EVIDENCE-INDEX.json');
const expectedPushes = [39, 40, 43, 44, 45];
const allowedTiers = new Set([
  'SOURCE_TEST_ENTRYPOINT',
  'HISTORICAL_SYNTHETIC_POSTGRES_RECEIPT',
  'HISTORICAL_OWNER_REPORTED_REAL_DEVICE_RECEIPT',
  'PENDING_EXTERNAL_REVIEW_PACKAGE',
  'ENGINEERING_BASELINE_RECEIPT',
  'BOUNDED_DEVELOPMENT_CATALOG_RECEIPT',
  'CANONICAL_CAPABILITY_MATRIX',
  'EXTERNAL_GATE_REGISTER',
]);

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function assertPath(path) {
  assert.match(path, /^[A-Za-z0-9][A-Za-z0-9_./-]*$/, 'unsafe or missing evidence path');
  assert.ok(!path.split('/').includes('..'), 'parent traversal in evidence path');
}

function assertEvidence(entry) {
  assert.match(entry.commit, /^[a-f0-9]{40}$/, 'missing or malformed evidence SHA');
  assertPath(entry.path);
  assert.ok(allowedTiers.has(entry.tier), 'unrecognized proof tier');
  git('cat-file', '-e', `${entry.commit}^{commit}`);
  git('merge-base', '--is-ancestor', entry.commit, 'HEAD');
  const recordedBlob = git('rev-parse', `${entry.commit}:${entry.path}`);
  const currentBlob = git('rev-parse', `HEAD:${entry.path}`);
  assert.equal(currentBlob, recordedBlob, `evidence changed since recorded SHA: ${entry.path}`);
}

function assertReviewOnly(entry) {
  if (entry === null) return;
  assertPath(entry.path);
  assert.ok(entry.path.startsWith('review-only/'), 'SQL escaped review-only');
  assert.equal(entry.state, 'NOT_APPLIED', 'review-only SQL marked active');
  assert.equal(entry.applied, false, 'review-only SQL marked applied');
  const content = git('show', `HEAD:${entry.path}`);
  assert.match(content.slice(0, 800), /raise exception/i, 'SQL execution guard absent');
  assert.match(content.slice(0, 800), /(MUST_NOT_RUN|DRAFT_NOT_APPLIED)/i, 'review marker absent');
}

export function validate(index) {
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.scope, 'PUSH50_PREPARATION_ONLY');
  assert.equal(index.activationReady, false);
  assert.match(index.baselineCommit, /^[a-f0-9]{40}$/);
  git('merge-base', '--is-ancestor', index.baselineCommit, 'HEAD');
  assert.deepEqual(index.pushes.map((item) => item.push), expectedPushes);
  for (const item of index.pushes) {
    assert.equal(item.externalGate, 'OPEN', `PUSH ${item.push} falsely passes external gate`);
    assert.ok(item.localEvidence.length >= 2, `PUSH ${item.push} lacks evidence`);
    assert.ok(item.actuallyProven && item.missing, `PUSH ${item.push} lacks limits`);
    item.localEvidence.forEach(assertEvidence);
    assertReviewOnly(item.reviewOnly);
  }
  index.sharedEvidence.forEach(assertEvidence);
  assert.equal(index.canonicalBoundaries.guard, 'OFF');
  assert.equal(index.canonicalBoundaries.nativeAccess, 'BLOCKED');
  assert.equal(index.canonicalBoundaries.push44, 'PARTIAL');
  assert.equal(index.canonicalBoundaries.push46, 'NOT_STARTED');
  assert.equal(index.canonicalBoundaries.retentionV1, 'ENGINEERING_BASELINE_NOT_EXTERNALLY_APPROVED');
  assert.equal(index.sharedGaps.canonicalSchemaAndDataApi, 'BLOCKED_FOR_NEW_REVIEW_ONLY_RPCS');
  assert.equal(index.sharedGaps.retentionAndLegal, 'ENGINEERING_BASELINE_ONLY');
  assert.equal(index.costDefinitions.measuredAmounts, 'NOT_INCLUDED_OR_VERIFIED_IN_THIS_INDEX');
  return `${index.pushes.length} PUSH rows; ${index.pushes.reduce((n, item) => n + item.localEvidence.length, index.sharedEvidence.length)} pinned evidence blobs; 3 guarded SQL proposals; external gates OPEN`;
}

function selfTest(index) {
  const copy = () => structuredClone(index);
  const missingSha = copy();
  missingSha.pushes[0].localEvidence[0].commit = '0'.repeat(40);
  assert.throws(() => validate(missingSha));
  const missingFile = copy();
  missingFile.pushes[0].localEvidence[0].path = 'scripts/qa/absent-push50-evidence.mjs';
  assert.throws(() => validate(missingFile));
  const falseActivation = copy();
  falseActivation.pushes[0].reviewOnly.applied = true;
  assert.throws(() => validate(falseActivation));
  const falseExternalPass = copy();
  falseExternalPass.pushes[0].externalGate = 'PASS';
  assert.throws(() => validate(falseExternalPass));
}

const index = JSON.parse(readFileSync(indexPath, 'utf8'));
console.log(`PUSH50 evidence index: ${validate(index)}`);
if (process.argv.includes('--self-test')) {
  selfTest(index);
  console.log('Negative checks: missing SHA, missing file, active review-only SQL, false external PASS — PASS');
}
