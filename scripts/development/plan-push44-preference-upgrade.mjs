#!/usr/bin/env node
// Read-only provenance gate for the single 274 -> 275 Development upgrade.
// This never applies migrations or replays baseline-mapped historical files.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const TARGET = 'supabase/migrations/20261116224059_push44_atomic_notification_preferences.sql';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const version = file => file.split('/').at(-1).slice(0, 14);

export function assessPush44Upgrade({ files, baseline, applied, ledger, schemaFingerprint,
  expectedBaseline = 227, expectedApplied = 47 }) {
  const blockers = [];
  if (!baseline || !Array.isArray(baseline.source_mapping) || !Array.isArray(applied) || !Array.isArray(files))
    return { status: 'BLOCKED', blockers: ['MISSING_PROVENANCE'] };
  const byFile = new Map(files.map(f => [f.file, f]));
  const mapped = new Map(baseline.source_mapping.map(m => [m.file, m]));
  const post = new Map(applied.map(m => [m.filename, m]));
  if (files.length !== expectedBaseline + expectedApplied + 1 ||
      mapped.size !== expectedBaseline || post.size !== expectedApplied ||
      byFile.size !== files.length || mapped.size !== baseline.source_mapping.length ||
      post.size !== applied.length) blockers.push('COUNT_OR_DUPLICATE_MISMATCH');
  for (const [name, entry] of mapped) {
    const source = byFile.get(name);
    if (!source || source.sha256 !== entry.sourceSha256 || source.blob !== entry.blob || post.has(name))
      blockers.push(`BASELINE_SOURCE_DRIFT:${name}`);
  }
  const versions = new Set();
  let maxVersion = '';
  let previousAppliedAt = '';
  for (const receipt of applied) {
    const source = byFile.get(receipt.filename);
    if (!source || receipt.source_digest !== source.sha256 || mapped.has(receipt.filename) ||
        receipt.version !== version(receipt.filename) || versions.has(receipt.version) ||
        (receipt.applied_at && receipt.applied_at < previousAppliedAt) ||
        !receipt.schema_fingerprint) blockers.push(`POST_BASELINE_RECEIPT_INVALID:${receipt.filename}`);
    versions.add(receipt.version);
    if (receipt.version > maxVersion) maxVersion = receipt.version;
    if (receipt.applied_at) previousAppliedAt = receipt.applied_at;
  }
  const missing = files.filter(f => !mapped.has(f.file) && !post.has(f.file));
  if (missing.length !== 1 || missing[0]?.file !== TARGET || version(TARGET) <= maxVersion)
    blockers.push('UPGRADE_IS_NOT_EXACTLY_NEXT_TARGET');
  if (schemaFingerprint !== applied.at(-1)?.schema_fingerprint)
    blockers.push('LIVE_SCHEMA_DRIFT');
  const target = byFile.get(TARGET);
  const approvals = ledger.filter(m => m.file === TARGET && m.blob === target?.blob);
  if (approvals.length !== 1 || approvals[0].developmentApproval !== 'VALIDATED_FOR_ISOLATED_DEVELOPMENT')
    blockers.push('TARGET_NOT_LEDGER_APPROVED');
  else if ((approvals[0].developmentDependsOn ?? []).some(v =>
    !applied.some(m => m.version === v) && !baseline.source_mapping.some(m => m.version === v)))
    blockers.push('TARGET_DEPENDENCY_MISSING');
  return { status: blockers.length ? 'BLOCKED' : 'READY_FOR_SEPARATE_APPLY_REVIEW',
    baselineIncluded: mapped.size, postBaselineApplied: post.size,
    target: TARGET, targetSha256: target?.sha256 ?? null, missing: missing.map(f => f.file),
    historicalReplay: false, databaseMutation: false, blockers };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [{ sql }, { schemaFingerprint }] = await Promise.all([
    import('./local-database.mjs'), import('./verify-baseline-schema.mjs')
  ]);
  const names = readdirSync('supabase/migrations').filter(n => /^\d{14}_[a-z0-9_]+\.sql$/.test(n)).sort();
  const files = names.map(n => {
    const file = `supabase/migrations/${n}`, bytes = readFileSync(file);
    return { file, sha256: hash(bytes), blob: blob(bytes) };
  });
  const baseline = JSON.parse(sql('begin read only; select row_to_json(b) from development_metadata.baselines b; commit;'));
  const applied = JSON.parse(sql("begin read only; select coalesce(json_agg(m order by applied_at),'[]') from development_metadata.migrations m; commit;"));
  const ledger = JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json', 'utf8')).migrations;
  const report = assessPush44Upgrade({ files, baseline, applied, ledger, schemaFingerprint: schemaFingerprint('postgres') });
  console.log(JSON.stringify(report));
  if (report.status === 'BLOCKED') process.exitCode = 1;
}
