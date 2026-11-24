import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');

// The original baseline and its database mapping remain immutable. These
// corrections describe fresh-replay source variants, not SQL executed by the
// historical Development database. A current-state proof is required on every
// drift check; it cannot establish what rows existed in the past.
export function validateSourceCorrectionManifest(manifest, baseline, sqlText) {
  const errors = [];
  if (manifest?.schemaVersion !== 1 || manifest?.baselineId !== baseline?.id ||
      manifest?.baselineSourceCommit !== baseline?.source_commit ||
      manifest?.scope !== 'CURRENT_LOCAL_DEVELOPMENT_STATE_ONLY_NOT_HISTORICAL_REPLAY') {
    errors.push('Source correction manifest identity/scope mismatch');
  }
  if (manifest?.querySha256 !== digest(sqlText) || !sqlText.startsWith('BEGIN READ ONLY;') ||
      !sqlText.trimEnd().endsWith('ROLLBACK;')) errors.push('Read-only correction query mismatch');
  const mapped = new Map((baseline?.source_mapping || []).map(row => [row.file, row]));
  const corrections = manifest?.corrections || [];
  if (corrections.length !== 6 || new Set(corrections.map(row => row.file)).size !== corrections.length) {
    errors.push('Expected six unique historical source corrections');
  }
  for (const row of corrections) {
    const original = mapped.get(row.file);
    if (!original || original.blob !== row.baselineBlob || original.sourceSha256 !== row.baselineSha256 ||
        !/^[0-9a-f]{40}$/.test(row.replayBlob || '') || !/^[0-9a-f]{64}$/.test(row.replaySha256 || '') ||
        !Array.isArray(row.checkNames) || row.checkNames.length === 0 ||
        row.checkNames.some(name => !(name in (manifest.expectedReadOnlyChecks || {})))) {
      errors.push(`Unanchored historical source correction: ${row.file}`);
    }
  }
  return errors;
}

export function parseSourceCorrectionProof(output, manifest, currentFingerprint) {
  const errors = [];
  const values = new Map();
  for (const line of output.trim().split('\n')) {
    const pair = line.trim().split('|');
    if (pair.length !== 2 || !pair[0] || values.has(pair[0])) {
      errors.push('Unexpected or duplicate correction query output');
      continue;
    }
    values.set(pair[0], pair[1]);
  }
  const expected = manifest.expectedReadOnlyChecks || {};
  const keys = new Set([...Object.keys(expected), 'baseline_fingerprint_receipt', 'latest_migration_fingerprint_receipt']);
  if (values.size !== keys.size || [...values.keys()].some(key => !keys.has(key))) {
    errors.push('Correction query key set mismatch');
  }
  for (const [key, value] of Object.entries(expected)) {
    if (values.get(key) !== value) errors.push(`Current-state correction check failed: ${key}`);
  }
  if (values.get('baseline_fingerprint_receipt') !== manifest.baselineFingerprint ||
      values.get('latest_migration_fingerprint_receipt') !== currentFingerprint) {
    errors.push('Correction proof fingerprint mismatch');
  }
  return { valid: errors.length === 0, errors, scope: manifest.scope };
}
