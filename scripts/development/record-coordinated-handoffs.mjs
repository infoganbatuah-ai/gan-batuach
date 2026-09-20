import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:'pipe'}).trim();
const now=new Date().toISOString(),path='DEVELOPMENT_INTEGRATION_LEDGER.json';
const ledger=JSON.parse(readFileSync(path,'utf8'));
for(const [id,expected] of [['codex/gb-m29-messaging-threads','a07b3ca9e64f73111eb1216fe92280c1a97949be'],['codex/push-38-aws-signing','b5d2bf821933cae923e2cb25066de0c81379db2c']]){
 if(git('ls-remote','origin',`refs/heads/${id}`).split(/\s/)[0]!==expected)throw Error(`Remote changed: ${id}`);
 const unit=ledger.units.find(u=>u.id===id);
 unit.sourceCommits=[...new Set([...unit.sourceCommits,expected,...(id.includes('push-38')?[git('rev-parse','db26a314')]:[])])];
 unit.preservation={remoteVerified:true,remoteRefs:[`origin/${id}`],remoteHead:expected,observedAt:now};
 unit.state='PRESERVED_PENDING_INTEGRATION';
 const reason=id.includes('gb-m29')?'Canonical rollback-only three-migration/role/attachment-metadata RLS QA PASS. Task owner explicitly requested PR57 remain open/unmerged; integration may auto-close it. Coordinate this hold; authenticated attachment HTTP E2E remains pending.':'PUSH 38 NOT DONE; keychain/signing infrastructure preserved separately. Qualification, custody and delivery are not approved for cumulative integration or activation.';
 unit.reconciliation={disposition:'PRESERVED_PENDING_INTEGRATION',reason,observedAt:now};
 unit.integration={status:'PRESERVED_PENDING_INTEGRATION',commit:null,reason};unit.nextAction=reason;
 if(id.includes('gb-m29')){
  unit.validation={status:'CANONICAL_ROLLBACK_SQL_RLS_PASS_HTTP_E2E_PENDING',sourceCommit:expected,evidence:['https://github.com/infoganbatuah-ai/gan-batuach/actions/runs/35455806892','https://github.com/infoganbatuah-ai/gan-batuach/actions/runs/35455806930'],ownerReceipt:'GB-M29 task 01a07933-ed3d-7ad0-9a45-2f9b0b21460a, 2026-09-19: one BEGIN/ROLLBACK, original three migrations, all role/scope checks and private attachment metadata visibility PASS; no persistent apply'};
  unit.migrations=['20260913210000_management_canonical_messaging_threads.sql','20260913211000_management_messaging_qa_hardening.sql','20260913212000_management_private_message_attachments.sql'];unit.migrationOrder=unit.migrations.map(m=>m.split('_')[0]);
 }else unit.validation={status:'SCOPED_OWNER_REPORTED_PASS_QUALIFICATION_INCOMPLETE',sourceCommit:expected,checks:['Keychain 13','signer 14','HOME QA 9','trust regression','R2 scope','diff check','limited secret heuristic'],fullCi:'NOT_CLAIMED'};
}
for(const collection of [ledger.openPRs,ledger.openPullRequests])for(const pr of collection||[]){
 if(pr.number===57)Object.assign(pr,{head:'a07b3ca9e64f73111eb1216fe92280c1a97949be',base:'integration/development',disposition:'PRESERVED_PENDING_INTEGRATION',reason:'Canonical SQL QA PASS; explicit task-owner open/unmerged hold; HTTP E2E pending',automaticMerge:false});
 if(pr.number===58)Object.assign(pr,{state:'MERGED_DEVELOPMENT',disposition:'ALREADY_INTEGRATED'});
}
ledger.updatedAt=now;ledger.transitionStatus='CANONICAL_DATABASE_READY_LOCAL_APP_AND_RECONCILIATION_PENDING';
writeFileSync(path,JSON.stringify(ledger,null,2)+'\n');
const migrations=JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json','utf8'));
const gb=ledger.units.find(u=>u.id==='codex/gb-m29-messaging-threads');
for(const filename of gb.migrations){
 const file=`supabase/migrations/${filename}`,blob=git('rev-parse',`origin/${gb.id}:${file}`);
 let row=migrations.migrations.find(m=>m.file===file&&m.blob===blob);
 if(!row){row={file,blob,productionApplied:'UNVERIFIED',productionEvidence:null};migrations.migrations.push(row);}
 Object.assign(row,{version:filename.split('_')[0],sourceTask:'GB-M29',sourceCommit:git('log','-1','--format=%H',`origin/${gb.id}`,'--',file),sourceHead:gb.preservation.remoteHead,remoteBranch:`origin/${gb.id}`,inGit:true,inIntegration:false,inclusion:'PRESERVED_PENDING_INTEGRATION',integrationCommit:null,developmentApplied:'NO',developmentAppliedAt:null,developmentEvidence:null,releaseOrder:filename.split('_')[0],dependencyStatus:'BASELINE_QA_PASS_INTEGRATION_HOLD',diagnosticQaEvidence:gb.validation.ownerReceipt,recovery:'No Production application authorized; future Production history/upgrade check is separate; retained source and baseline support isolated rebuild'});
}
writeFileSync('DEVELOPMENT_MIGRATION_LEDGER.json',JSON.stringify(migrations,null,2)+'\n');
console.log('Coordinated source heads verified remotely; Production states untouched.');
