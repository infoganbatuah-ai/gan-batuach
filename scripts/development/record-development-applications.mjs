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
writeFileSync('DEVELOPMENT_MIGRATION_LEDGER.json',JSON.stringify(ledger,null,2)+'\n');
writeFileSync('development/database/development-application-receipts.json',JSON.stringify({environment:'DEVELOPMENT / INTEGRATION',observedAt:new Date().toISOString(),integrationCommit:integration,migrations:applied,productionAccess:false},null,2)+'\n');
const development=JSON.parse(readFileSync('DEVELOPMENT_INTEGRATION_LEDGER.json','utf8'));
const unit=development.units.find(u=>u.id==='codex/development-database-baseline-20260919');
unit.sourceCommits=['52e9534115042aa36e9d949b30b417f4f7e710fe','8506689ff1a95d08314e01db7eb60f92ff7d3547'];
unit.state='DEVELOPMENT_MIGRATIONS_APPLIED';unit.integration={status:'INTEGRATED_DEVELOPMENT',commit:'00402d7a3134fe3e654b5c9579f15e7a1b3df1f6',pullRequest:59,conflicts:'NONE'};
unit.validation={status:'PASS_BASELINE_AUTH_REST_STORAGE_SQL_RLS_AND_CI',ci:['https://github.com/infoganbatuah-ai/gan-batuach/actions/runs/35455732639','https://github.com/infoganbatuah-ai/gan-batuach/actions/runs/35455732605'],remaining:'Cumulative local app and role journeys'};
unit.nextAction='Verify cumulative local app health and role journeys; keep main/Production unchanged';
development.updatedAt=new Date().toISOString();writeFileSync('DEVELOPMENT_INTEGRATION_LEDGER.json',JSON.stringify(development,null,2)+'\n');
console.log(JSON.stringify({postBaselineApplied:applied.length,productionStatuses:'UNCHANGED'}));
