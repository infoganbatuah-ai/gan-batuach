import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {developmentReadinessErrors} from './migration-drift.mjs';
const ledger=JSON.parse(readFileSync('DEVELOPMENT_INTEGRATION_LEDGER.json','utf8'));
const errors=[],ids=new Set();
const states=new Set(['IMPLEMENTING','IMPLEMENTATION_DONE','VALIDATED','VALIDATED_ON_BRANCH','PUSHED_REMOTE','PRESERVED_PENDING_INTEGRATION','INTEGRATED_DEVELOPMENT','DEVELOPMENT_MIGRATIONS_APPLIED','LOCAL_FULL_STACK_VERIFIED','LOCAL_VERIFIED','BLOCKED','READY_FOR_OWNER_RELEASE','RELEASED_MAIN','PRODUCTION_MIGRATIONS_APPLIED','DEPLOYED_PRODUCTION']);
const migrationLedger=JSON.parse(readFileSync('DEVELOPMENT_MIGRATION_LEDGER.json','utf8'));
const release=process.argv.includes('--release');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:'pipe',env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
for(const unit of ledger.units){
  if(ids.has(unit.id)) errors.push(`Duplicate unit ${unit.id}`);ids.add(unit.id);
  if(!states.has(unit.state)) errors.push(`Invalid state ${unit.id}`);
  if(unit.state==='READY_FOR_OWNER_RELEASE') {
    if(unit.localVerification!=='PASS_FULL_PRODUCT')errors.push(`${unit.id}: full-stack local QA required`);
    errors.push(...developmentReadinessErrors(unit.migrations,migrationLedger.migrations).map(error=>`${unit.id}: ${error}`));
  }
  for(const field of ['project','title','owner','sourceCommits','validation','integration','dependencies','migrations','migrationOrder','localVerification','releaseEligibility','productionDeployment','nextAction']) if(!(field in unit)) errors.push(`${unit.id} missing ${field}`);
}
for(const unit of ledger.units) for(const dep of unit.dependencies.units) if(!ids.has(dep)) errors.push(`${unit.id}: missing dependency ${dep}`);
if(release){
  const approval=ledger.ownerReleaseAuthorization;
  if(!approval?.instruction || !approval?.recordedAt || !approval?.candidateSha || !Array.isArray(approval?.selectedUnits)) errors.push('Explicit recorded owner approval, exact candidate SHA and selected units are required. This field is evidence, never self-authorization.');
  else {
    const selected=new Set(approval.selectedUnits);
    for(const id of selected){
      const unit=ledger.units.find(u=>u.id===id);
      if(!unit || unit.state!=='READY_FOR_OWNER_RELEASE') {errors.push(`${id} is not READY_FOR_OWNER_RELEASE`);continue;}
      if(unit.localVerification!=='PASS_FULL_PRODUCT') errors.push(`${id} lacks full isolated Product verification`);
      for(const dep of unit.dependencies.units){const d=ledger.units.find(u=>u.id===dep);if(!selected.has(dep)&&!['RELEASED_MAIN','DEPLOYED_PRODUCTION'].includes(d?.state))errors.push(`${id} excludes prerequisite ${dep}`);}
      for(const sha of unit.sourceCommits){
        try{git('merge-base','--is-ancestor',sha,approval.candidateSha);}catch{errors.push(`${id}: candidate lacks original commit ${sha}`);}
        if(!git('for-each-ref',`--contains=${sha}`,'--format=%(refname)','refs/remotes/'))errors.push(`${id}: source commit not remote-preserved`);
      }
    }
    for(const unit of ledger.units.filter(u=>u.state==='READY_FOR_OWNER_RELEASE'&&!selected.has(u.id))) {
      if(!approval.excludedUnits?.[unit.id]) errors.push(`${unit.id}: READY item omitted without explicit reason`);
    }
  }
}
console.log(JSON.stringify({status:errors.length?'BLOCKED':'PASS',mode:release?'release-inclusion-preflight':'ledger-schema-only',units:ids.size,errors,productionAuthorized:false,note:'Schema/ancestry checks do not replace owner authorization, provider cost/backup checks, CI or live migration/role/hardware verification.'},null,2));
if(errors.length)process.exitCode=1;
