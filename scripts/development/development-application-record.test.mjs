import test from 'node:test';
import assert from 'node:assert/strict';
import {recordApplication} from './development-application-record.mjs';

const row={filename:'supabase/migrations/20261123000100_qa_public_rls_and_invoker_views.sql',
  source_commit:'exact-integration',source_digest:'digest',schema_fingerprint:'schema',applied_at:'date'};

test('prior reviewed application evidence remains unchanged',()=>{
  const old={developmentApplied:'YES',developmentAppliedAt:'original date',
    developmentEvidence:'detailed restoration and role evidence',
    developmentHistoryDigest:'digest',developmentSchemaFingerprint:'schema',
    integrationCommit:'original merge'};
  assert.deepEqual(recordApplication(old,row),old);
});
test('only a pending exact row receives the new application receipt',()=>{
  const pending={developmentApplied:'NO',productionApplied:'NO',developmentEvidence:null};
  const updated=recordApplication(pending,row);
  assert.equal(pending.developmentApplied,'NO');
  assert.equal(updated.developmentApplied,'YES');
  assert.equal(updated.developmentHistoryDigest,row.source_digest);
  assert.equal(updated.developmentSchemaFingerprint,row.schema_fingerprint);
  assert.equal(updated.productionApplied,'NO');
});
test('conflicting receipt or unknown state fails closed',()=>{
  assert.throws(()=>recordApplication({developmentApplied:'YES',developmentHistoryDigest:'other'},row),/digest differs/);
  assert.throws(()=>recordApplication({developmentApplied:'YES',developmentSchemaFingerprint:'other'},row),/fingerprint differs/);
  assert.throws(()=>recordApplication({developmentApplied:'UNKNOWN'},row),/Unreviewed application state/);
});
