import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateSourceCorrectionManifest,parseSourceCorrectionProof} from './baseline-source-corrections.mjs';
import {compareBaselineState} from './baseline-drift.mjs';

const manifest=JSON.parse(readFileSync(new URL('../../development/database/source-corrections-20261124.json',import.meta.url)));
const proofSql=readFileSync(new URL('./historical-equivalence.sql',import.meta.url),'utf8');
const baseline={id:manifest.baselineId,source_commit:manifest.baselineSourceCommit,
  source_mapping:manifest.corrections.map(c=>({file:c.file,blob:c.baselineBlob,sourceSha256:c.baselineSha256}))};
const proofText=[
  ...Object.entries(manifest.expectedReadOnlyChecks).map(([key,value])=>`${key}|${value}`),
  `baseline_fingerprint_receipt|${manifest.baselineFingerprint}`,
  `latest_migration_fingerprint_receipt|${manifest.priorSchemaFingerprint}`,
].join('\n');
const files=manifest.corrections.map(c=>({file:c.file,blob:c.replayBlob,sha256:c.replaySha256}));
const ledger=manifest.corrections.flatMap(c=>[
  {file:c.file,blob:c.baselineBlob,developmentApplied:'YES',developmentAppliedAt:'2026-09-19',developmentEvidence:'original receipt'},
  {file:c.file,blob:c.replayBlob,developmentApplied:'NO',developmentMapping:'CURRENT_STATE_REPLAY_VARIANT',
    developmentEvidence:'development/database/source-corrections-20261124.json'},
]);
const goodProof=parseSourceCorrectionProof(proofText,manifest,manifest.priorSchemaFingerprint);
const compare=overrides=>compareBaselineState({files,baseline,postMigrations:[],ledger,
  schemaFingerprint:{expected:manifest.priorSchemaFingerprint,actual:manifest.priorSchemaFingerprint},
  sourceCorrections:manifest,correctionProof:goodProof,...overrides});

test('exact immutable baseline and source variants have bounded current-state evidence',()=>{
  assert.deepEqual(validateSourceCorrectionManifest(manifest,baseline,proofSql),[]);
  assert.equal(goodProof.valid,true);
  const result=compare();
  assert.equal(result.status,'PASS');
  assert.equal(result.reviewedCorrections.length,6);
  assert.equal(result.historicalReplayClaim,false);
});
test('changed source blob and missing current-state proof block drift',()=>{
  assert.equal(compare({files:[{...files[0],blob:'0'.repeat(40)},...files.slice(1)]}).status,'BLOCKED');
  assert.equal(compare({correctionProof:{valid:false,errors:['Missing proof']}}).status,'BLOCKED');
});
test('tampered query, values, and fingerprint cannot qualify a correction',()=>{
  assert.notDeepEqual(validateSourceCorrectionManifest(manifest,baseline,proofSql+'\n-- change'),[]);
  assert.equal(parseSourceCorrectionProof(proofText.replace('owner_enum_exists|true','owner_enum_exists|false'),
    manifest,manifest.priorSchemaFingerprint).valid,false);
  assert.equal(parseSourceCorrectionProof(proofText,manifest,'0'.repeat(64)).valid,false);
});
test('new unapplied migration remains blocked without claiming application',()=>{
  const pending={file:'supabase/migrations/20261123000100_qa_public_rls_and_invoker_views.sql',
    blob:'1'.repeat(40),sha256:'2'.repeat(64)};
  const result=compare({files:[...files,pending],
    ledger:[...ledger,{file:pending.file,blob:pending.blob,developmentApplied:'NO'}]});
  assert.equal(result.status,'BLOCKED');
  assert.deepEqual(result.missing,[pending.file]);
});
