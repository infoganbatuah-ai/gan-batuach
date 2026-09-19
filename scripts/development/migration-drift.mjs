// Pure comparison of selected Git files, provenance ledger and observed DB history.
export function compareMigrationState({files, ledger, history, environment}) {
  const errors=[], missing=[], unexpected=[];
  if(!['DEVELOPMENT','PRODUCTION_READ_ONLY'].includes(environment)) errors.push('Unknown database environment');
  if(!Array.isArray(history)) return {status:'BLOCKED',errors:[...errors,'Database history unavailable'],expected:files.length,applied:null,missing:null,unverified:files.map(f=>f.version),unexpected:null};
  const expected=new Map(), observed=new Map();
  for(const file of files){
    if(expected.has(file.version))errors.push(`Duplicate Git migration ID ${file.version}`);
    expected.set(file.version,file);
    const entries=ledger.filter(m=>m.file===file.file&&m.blob===file.blob);
    if(entries.length!==1) errors.push(`Migration missing/ambiguous in ledger: ${file.file}`);
    else {
      const item=entries[0];
      if(!item.sourceCommit||!item.remoteBranch||!item.sourceTask)errors.push(`Missing provenance: ${file.file}`);
      if(environment==='DEVELOPMENT'&&item.developmentApplied==='YES'&&(!item.developmentAppliedAt||!item.developmentEvidence||!item.developmentHistoryDigest))errors.push(`Missing application evidence: ${file.file}`);
    }
  }
  for(const row of history){
    const version=String(row.version);
    if(observed.has(version))errors.push(`Duplicate database migration ID ${version}`);
    observed.set(version,row);
    const file=expected.get(version);
    if(!file){unexpected.push(version);continue;}
    if(row.name!==file.name)errors.push(`Database migration name differs: ${version}`);
    const item=ledger.find(m=>m.file===file.file&&m.blob===file.blob);
    if(environment==='DEVELOPMENT'&&item?.developmentApplied!=='YES')errors.push(`Database/ledger status disagrees: ${version}`);
    if(item?.developmentHistoryDigest&&environment==='DEVELOPMENT'&&row.statementsDigest!==item.developmentHistoryDigest)errors.push(`Database statements changed: ${version}`);
  }
  for(const id of expected.keys())if(!observed.has(id))missing.push(id);
  if(missing.length)errors.push(`${missing.length} Git migrations absent from DB history`);
  if(unexpected.length)errors.push(`${unexpected.length} DB migrations absent from selected Git snapshot`);
  return {status:errors.length?'BLOCKED':'PASS',errors,expected:files.length,applied:history.length,missing,unexpected,note:'History/provenance check, not a substitute for schema/RLS/auth/tenant/application QA.'};
}
