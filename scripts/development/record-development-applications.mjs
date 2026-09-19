import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {sql} from './local-database.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:'pipe'}).trim();
const integration=git('rev-parse','origin/integration/development');
const applied=JSON.parse(sql("select coalesce(json_agg(m order by applied_at),'[]') from development_metadata.migrations m;"));
if(!applied.some(m=>m.version==='20260919170000'&&m.schema_fingerprint))throw Error('Canonical trigger-fix application receipt is required before advancing this unit');
const ledger=JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json','utf8'));
for(const row of applied){
 if(!row.schema_fingerprint)throw Error(`Incomplete application receipt: ${row.version}`);
 git('merge-base','--is-ancestor',row.source_commit,integration);
 const blob=git('rev-parse',`${integration}:${row.filename}`);
 const entries=ledger.migrations.filter(m=>m.file===row.filename&&m.blob===blob);
 if(entries.length!==1)throw Error(`Missing/ambiguous ledger row: ${row.filename}`);
 Object.assign(entries[0],{inGit:true,inIntegration:true,inclusion:'INTEGRATED_DEVELOPMENT',integrationCommit:row.source_commit,developmentApplied:'YES',developmentAppliedAt:row.applied_at,developmentEvidence:'development/database/development-application-receipts.json',developmentHistoryDigest:row.source_digest,developmentSchemaFingerprint:row.schema_fingerprint,developmentStatusReason:'Original post-baseline SQL applied after remote integration; Production status unchanged'});
}
ledger.observedAt=new Date().toISOString();ledger.localDatabaseStatus='BASELINE_AND_INTEGRATED_MIGRATIONS_APPLIED';
const selected=git('ls-tree','-r','--name-only',integration,'--','supabase/migrations').split('\n').filter(file=>file.endsWith('.sql'));
ledger.developmentExpected=selected.length;
ledger.developmentAppliedVerified=selected.filter(file=>{
 const blob=git('rev-parse',`${integration}:${file}`);
 const entries=ledger.migrations.filter(m=>m.file===file&&m.blob===blob);
 if(entries.length!==1)throw Error(`Missing/ambiguous selected migration ledger row: ${file}`);
 return entries[0].developmentApplied==='YES'&&Boolean(entries[0].developmentAppliedAt)&&Boolean(entries[0].developmentEvidence);
}).length;
writeFileSync('DEVELOPMENT_MIGRATION_LEDGER.json',JSON.stringify(ledger,null,2)+'\n');
writeFileSync('development/database/development-application-receipts.json',JSON.stringify({environment:'DEVELOPMENT / INTEGRATION',observedAt:new Date().toISOString(),integrationCommit:integration,migrations:applied,productionAccess:false},null,2)+'\n');
// This reusable receipt command must not reset task/source history or claim
// Product QA. The owning task advances its development unit after scoped QA.
console.log(JSON.stringify({postBaselineApplied:applied.length,productionStatuses:'UNCHANGED'}));
