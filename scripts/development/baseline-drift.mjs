export function compareBaselineState({files,baseline,postMigrations,ledger,schemaFingerprint}) {
  const errors=[],missing=[];
  if(!baseline||!Array.isArray(baseline.source_mapping)||!Array.isArray(postMigrations))return {status:'BLOCKED',errors:['Development baseline/history unavailable']};
  const mapped=new Map(baseline.source_mapping.map(m=>[m.file,m]));
  const post=new Map(postMigrations.map(m=>[m.filename,m]));
  if(mapped.size!==baseline.source_mapping.length||post.size!==postMigrations.length)errors.push('Duplicate baseline/post-migration mapping');
  const names=new Set(files.map(f=>f.file));
  for(const name of [...mapped.keys(),...post.keys()])if(!names.has(name))errors.push(`Database source absent from selected integration: ${name}`);
  for(const file of files){
    const historical=mapped.get(file.file),applied=post.get(file.file);
    if(historical&&applied)errors.push(`Ambiguous history mapping: ${file.file}`);
    if(historical){if(historical.blob!==file.blob||historical.sourceSha256!==file.sha256)errors.push(`Historical source changed: ${file.file}`);}
    else if(!applied)missing.push(file.file);
    else if(applied.source_digest!==file.sha256)errors.push(`Applied migration source changed: ${file.file}`);
    const rows=ledger.filter(m=>m.file===file.file&&m.blob===file.blob);
    if(rows.length!==1||rows[0].developmentApplied!=='YES'||!rows[0].developmentAppliedAt||!rows[0].developmentEvidence)errors.push(`Ledger application evidence missing: ${file.file}`);
  }
  if(missing.length)errors.push(`${missing.length} post-baseline migrations unapplied`);
  if(schemaFingerprint.expected!==schemaFingerprint.actual)errors.push('Live schema fingerprint differs from verified baseline/migration receipt');
  return {status:errors.length?'BLOCKED':'PASS',expected:files.length,baselineIncluded:mapped.size,postBaselineApplied:post.size,missing,errors,historicalReplayClaim:false};
}
