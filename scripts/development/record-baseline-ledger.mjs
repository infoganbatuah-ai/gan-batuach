import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {config} from './local-database.mjs';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:'pipe'}).trim();
const directory=`development/database/baselines/${config.baselineId}`;
const receipt=JSON.parse(readFileSync(`${directory}/bootstrap-receipt.json`,'utf8'));
const provenance=JSON.parse(readFileSync(`${directory}/provenance.json`,'utf8'));
if(receipt.baselineSchemaEquality!=='PASS')throw Error('Verified baseline receipt required');
const ledger=JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json','utf8'));
ledger.localDatabaseStatus='BASELINE_SCHEMA_VERIFIED_FULL_STACK_QA_PENDING';
ledger.baseline={id:config.baselineId,sourceIntegrationSha:config.sourceIntegrationSha,provenance:`${directory}/provenance.json`,receipt:`${directory}/bootstrap-receipt.json`,historicalReplayClaim:false};
for(const source of provenance.migrations){
  const rows=ledger.migrations.filter(m=>m.file===source.file&&m.blob===source.gitBlob);
  if(rows.length!==1)throw Error(`Ambiguous migration ledger: ${source.file}`);
  Object.assign(rows[0],{historyClass:'HISTORICAL_MIGRATION',developmentMapping:'DEVELOPMENT_BASELINE_INCLUDED',inGit:true,inIntegration:true,developmentApplied:'YES',developmentAppliedAt:receipt.appliedAt,developmentEvidence:`${directory}/bootstrap-receipt.json`,developmentHistoryDigest:receipt.schemaSha256,developmentStatusReason:'Schema/security included by explicit development baseline; original data/backfill execution is NOT claimed',baselineId:config.baselineId});
}
const file='supabase/migrations/20260919170000_classroom_scope_trigger_record_fields.sql';
const sourceCommit=git('log','-1','--format=%H','--',file),blob=git('rev-parse',`HEAD:${file}`);
const existing=ledger.migrations.find(m=>m.file===file&&m.blob===blob);
const item={file,blob,version:'20260919170000',sourceTask:'CANONICAL_DEVELOPMENT_BASELINE',sourceCommit,sourceHead:sourceCommit,remoteBranch:'origin/codex/development-database-baseline-20260919',integrationCommit:null,inclusion:'PRESERVED_PENDING_INTEGRATION',historyClass:'POST_BASELINE_MIGRATION',inGit:true,inIntegration:false,developmentApplied:'NO',developmentAppliedAt:null,developmentEvidence:null,developmentHistoryDigest:null,productionApplied:'UNVERIFIED',productionEvidence:null,developmentApproval:'VALIDATED_FOR_ISOLATED_DEVELOPMENT',developmentDependsOn:['20260911040000'],dependencyStatus:'BASELINE_INCLUDED',releaseOrder:'20260919170000',requiredPredecessor:'20260911040000_management_canonical_classrooms.sql',recovery:'Function-only repair; preserve migration and history; no data rewrite or Production apply. Rollback requires restoring prior function only after dependency review.',validation:'Rollback-only local transaction: both trigger variants, cross-garden rejection, parent/manager/staff/candidate/revoked/inspector/admin and Observer Site boundaries PASS'};
if(existing)Object.assign(existing,item);else ledger.migrations.push(item);
ledger.observedAt=new Date().toISOString();writeFileSync('DEVELOPMENT_MIGRATION_LEDGER.json',JSON.stringify(ledger,null,2)+'\n');
const development=JSON.parse(readFileSync('DEVELOPMENT_INTEGRATION_LEDGER.json','utf8'));
const id='codex/development-database-baseline-20260919';
const unit={id,project:'Shared development infrastructure',title:'Canonical isolated development baseline and full-stack closure',owner:'Current database-baseline task',sourceBranch:id,sourceCommits:[sourceCommit],state:'PRESERVED_PENDING_INTEGRATION',preservation:{remoteVerified:true,remoteRefs:[`origin/${id}`]},validation:'Baseline schema/ACL verification PASS; rollback-only fixture/RLS suite PASS; Auth/REST/Storage end-to-end and full cumulative CI pending',integration:{status:'PENDING',reason:'Full-stack services startup and final branch QA pending',mergeCommit:null},dependencies:{units:[],status:'Requires integration c0cf2de7 baseline'},migrations:[file],migrationOrder:['20260919170000'],localVerification:'SCHEMA_AND_SQL_ROLE_QA_PASS_FULL_STACK_PENDING',releaseEligibility:'NOT_READY',productionDeployment:'NOT_DEPLOYED_NO_AUTHORIZATION',nextAction:'Complete isolated Auth/REST/Storage health, preserve baseline branch, CI, integration-only merge, apply reviewed new migration and verify cumulative local Product'};
const index=development.units.findIndex(u=>u.id===id);if(index<0)development.units.push(unit);else development.units[index]=unit;
development.updatedAt=new Date().toISOString();development.transitionStatus='DEVELOPMENT_BASELINE_VERIFIED_FULL_STACK_CLOSURE_PENDING';
writeFileSync('DEVELOPMENT_INTEGRATION_LEDGER.json',JSON.stringify(development,null,2)+'\n');
console.log(JSON.stringify({baselineIncluded:provenance.migrations.length,newPostBaseline:1,productionStatuses:'PRESERVED_UNCHANGED',unit:id}));
