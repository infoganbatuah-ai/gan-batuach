// Preserve previously reviewed application evidence. A fresh database snapshot
// may fill a pending row, but it must not rewrite the source history of a row
// that was already recorded as applied.
export function recordApplication(item,row){
  if(item.developmentHistoryDigest&&item.developmentHistoryDigest!==row.source_digest)
    throw Error(`Development source digest differs: ${row.filename}`);
  if(item.developmentSchemaFingerprint&&item.developmentSchemaFingerprint!==row.schema_fingerprint)
    throw Error(`Development schema fingerprint differs: ${row.filename}`);
  if(item.developmentApplied==='YES')return item;
  if(item.developmentApplied!=='NO')throw Error(`Unreviewed application state: ${row.filename}`);
  return {...item,inGit:true,inIntegration:true,inclusion:'INTEGRATED_DEVELOPMENT',
    integrationCommit:row.source_commit,developmentApplied:'YES',
    developmentAppliedAt:row.applied_at,
    developmentEvidence:'development/database/development-application-receipts.json',
    developmentHistoryDigest:row.source_digest,
    developmentSchemaFingerprint:row.schema_fingerprint,
    developmentStatusReason:'Original post-baseline SQL applied after remote integration; Production status unchanged'};
}
