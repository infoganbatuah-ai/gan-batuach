export function compareBaselineState({files,baseline,postMigrations,ledger,schemaFingerprint,
  sourceCorrections,correctionProof}) {
  const errors=[],missing=[];
  if(!baseline||!Array.isArray(baseline.source_mapping)||!Array.isArray(postMigrations))return {status:'BLOCKED',errors:['Development baseline/history unavailable']};
  const mapped=new Map(baseline.source_mapping.map(m=>[m.file,m]));
  const post=new Map(postMigrations.map(m=>[m.filename,m]));
  const corrections=new Map((sourceCorrections?.corrections||[]).map(m=>[m.file,m]));
  const reviewedCorrections=[];
  if(mapped.size!==baseline.source_mapping.length||post.size!==postMigrations.length)errors.push('Duplicate baseline/post-migration mapping');
  const names=new Set(files.map(f=>f.file));
  for(const name of [...mapped.keys(),...post.keys()])if(!names.has(name))errors.push(`Database source absent from selected integration: ${name}`);
  for(const file of files){
    const historical=mapped.get(file.file),applied=post.get(file.file);
    if(historical&&applied)errors.push(`Ambiguous history mapping: ${file.file}`);
    const correction=corrections.get(file.file);
    if(historical){
      if(historical.blob!==file.blob||historical.sourceSha256!==file.sha256){
        if(!correction || correction.baselineBlob!==historical.blob ||
           correction.baselineSha256!==historical.sourceSha256 ||
           correction.replayBlob!==file.blob || correction.replaySha256!==file.sha256 ||
           correctionProof?.valid!==true){
          errors.push(`Historical source changed without current-state proof: ${file.file}`);
        } else reviewedCorrections.push(file.file);
      } else if(correction) errors.push(`Correction no longer matches changed source: ${file.file}`);
    }
    else if(!applied)missing.push(file.file);
    else if(applied.source_digest!==file.sha256)errors.push(`Applied migration source changed: ${file.file}`);
    const appliedBlob=historical?.blob||file.blob;
    const rows=ledger.filter(m=>m.file===file.file&&m.blob===appliedBlob);
    if(historical||applied){
      if(rows.length!==1||rows[0].developmentApplied!=='YES'||!rows[0].developmentAppliedAt||!rows[0].developmentEvidence)errors.push(`Ledger application evidence missing: ${file.file}`);
    } else if(rows.length!==1||rows[0].developmentApplied!=='NO')errors.push(`Pending migration ledger mapping missing: ${file.file}`);
    if(reviewedCorrections.includes(file.file)){
      const variants=ledger.filter(m=>m.file===file.file&&m.blob===file.blob);
      if(variants.length!==1||variants[0].developmentApplied!=='NO'||
         variants[0].developmentMapping!=='CURRENT_STATE_REPLAY_VARIANT' ||
         variants[0].developmentEvidence!=='development/database/source-corrections-20261124.json'){
        errors.push(`Replay variant ledger evidence missing: ${file.file}`);
      }
    }
  }
  if(corrections.size!==reviewedCorrections.length)errors.push('Unmatched source corrections');
  if(corrections.size&&correctionProof?.valid!==true)errors.push(...(correctionProof?.errors||['Current-state source correction proof unavailable']));
  if(missing.length)errors.push(`${missing.length} post-baseline migrations unapplied`);
  if(schemaFingerprint.expected!==schemaFingerprint.actual)errors.push('Live schema fingerprint differs from verified baseline/migration receipt');
  return {status:errors.length?'BLOCKED':'PASS',expected:files.length,baselineIncluded:mapped.size,postBaselineApplied:post.size,missing,errors,
    reviewedCorrections,correctionScope:'CURRENT_LOCAL_DEVELOPMENT_STATE_ONLY',historicalReplayClaim:false};
}
