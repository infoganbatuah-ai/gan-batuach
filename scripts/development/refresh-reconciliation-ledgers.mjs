import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
// Explicit report regeneration only; never modifies Git refs, source or databases.
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:'pipe',maxBuffer:32*1024*1024,timeout:60000,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const write=(p,data)=>writeFileSync(p,JSON.stringify(data,null,2)+'\n');
const lines=s=>s?s.split('\n'):[];
const attempt=(f,fallback)=>{try{return f();}catch{return fallback;}};
const ancestor=(a,b)=>attempt(()=>{git('merge-base','--is-ancestor',a,b);return true;},false);
const now=new Date().toISOString(),main=git('rev-parse','origin/main'),integration=git('rev-parse','integration/development');
const ledger=read('DEVELOPMENT_INTEGRATION_LEDGER.json'),migrations=read('DEVELOPMENT_MIGRATION_LEDGER.json');
if(migrations.migrations.some(m=>m.developmentApplied==='YES'))throw Error('This dated closure report updater must not replace verified development application state. Use a new evidence-based audit.');
// Earlier raw inventory also counted physically missing/untracked observations
// as variants. Preserve them separately: undefined === undefined is NOT proof
// of a migration being selected or applied.
migrations.localObservations=[...(migrations.localObservations||[]),...migrations.migrations.filter(m=>!m.blob).map(m=>({...m,integrationCommit:null,inclusion:'LOCAL_OBSERVATION_NOT_A_GIT_VARIANT'}))];
migrations.migrations=migrations.migrations.filter(m=>m.blob);
const local=read('DEVELOPMENT_LOCAL_RECONCILIATION_2026-09-19.json');
const audit=read('DEVELOPMENT_FINAL_STATE_AUDIT_2026-09-19.json');
for(const v of audit.migrationVariants){
  if(v.blob&&!migrations.migrations.some(m=>m.file===v.file&&m.blob===v.blob))migrations.migrations.push({...v,sourceTask:'See sourceHeads in audit',releaseOrder:v.file.split('/').at(-1).split('_')[0],dependencyStatus:'REVIEW_REQUIRED',requiredPredecessor:null});
  if(!v.blob&&!migrations.localObservations.some(m=>m.file===v.file&&m.worktree===v.worktree&&m.sha256===v.sha256))migrations.localObservations.push({...v,integrationCommit:null,inclusion:'LOCAL_OBSERVATION_NOT_A_GIT_VARIANT',developmentApplied:'NO',productionApplied:'UNVERIFIED'});
}
const refs=lines(git('for-each-ref','--format=%(refname)|%(objectname)','refs/heads/','refs/remotes/origin/')).filter(x=>!x.startsWith('refs/remotes/origin/HEAD|')).map(x=>{const [ref,sha]=x.split('|');return {ref,sha,branch:ref.replace(/^refs\/(heads\/|remotes\/origin\/)/,'')};});
const remoteRefs=refs.filter(r=>r.ref.startsWith('refs/remotes/'));
const groups=new Map();for(const r of refs){if(!groups.has(r.branch))groups.set(r.branch,[]);groups.get(r.branch).push(r);}
const branches=[];
for(const [branch,items] of groups){
  const source=items.find(r=>r.ref.startsWith('refs/heads/'))||items[0],remote=items.find(r=>r.ref.startsWith('refs/remotes/'));
  let unit=ledger.units.find(u=>u.id===branch);
  const oldSha=unit?.sourceCommits?.at(-1);
  if(!unit){unit={id:branch,project:/gb-m/.test(branch)?'Gan Batuach Management':'Digital Observer / shared',title:git('log','-1','--format=%s',source.sha),owner:/push-38/.test(branch)?'PUSH 38 owner':'Integration coordinator / original task owner',sourceBranch:branch,sourceCommits:[],state:'PRESERVED_PENDING_INTEGRATION',preservation:{},validation:{status:'NOT_REVALIDATED'},integration:{status:'PENDING_REVIEW',commit:null},dependencies:{status:'REVIEW_REQUIRED',units:[]},migrations:[],migrationOrder:[],conflictsResolution:'No blind merge attempted',localVerification:'NOT_TESTED',releaseEligibility:'NOT_READY',productionDeployment:{status:'NOT_DEPLOYED'},nextAction:'Review original source and dependencies before integration'};ledger.units.push(unit);}
  unit.sourceCommits=[...new Set([...unit.sourceCommits,source.sha])];
  const containing=lines(git('for-each-ref',`--contains=${source.sha}`,'--format=%(refname:short)','refs/remotes/'));
  const inMain=ancestor(source.sha,main),inIntegration=ancestor(source.sha,integration);
  const provenEquivalent=oldSha===source.sha&&['EXACT_TREE_EQUALS_MAIN','ALL_PATCH_IDS_PRESENT_IN_MAIN'].includes(unit.integration.equivalence);
  let disposition=inMain?'ALREADY_IN_MAIN':inIntegration?'ALREADY_INTEGRATED':provenEquivalent?'SUPERSEDED':'PRESERVED_PENDING_INTEGRATION';
  let reason=inMain?'Exact source HEAD is an ancestor of origin/main':inIntegration?'Exact source HEAD is an ancestor of integration/development':provenEquivalent?`Prior verified ${unit.integration.equivalence} at unchanged source SHA`:'Historical divergent source is preserved; compatibility with current architecture and cumulative isolated backend is not validated. No direct merge authorized.';
  if(!inMain&&!inIntegration&&/push-38/.test(branch)){disposition='BLOCKED';reason='PUSH 38 explicitly incomplete; qualification, commercial signing custody and delivery prerequisites remain owned by its task. Preserve remotely; no automatic integration/activation.';}
  if(branch==='codex/gb-m29-messaging-threads'){disposition='BLOCKED';reason='PR #57 source preserved; historical canonical DB replay fails before GB-M29. Adapted disposable QA cannot establish canonical development migration/RLS PASS.';}
  if(/recover\/digital-observer-(docs|reference-gap)|supplier-backup-docs|release-queue/.test(branch)&&!inMain&&!inIntegration){disposition='EVIDENCE_ONLY';reason='Historical report/handoff source; archive/reference only, earlier automatic-release instructions superseded by current AGENTS.md.';}
  if(branch==='codex/preserve-root-source-20260919'){reason='Exact 5 local source versions preserved in 3 scoped commits. Manifest projection/audit, polling cadence/tests and editorial navigation superseded in main; connector recovery installer not approved for activation (fixed local target, overwrites staged/service state). Keep pending review, never overlay old whole files.';}
  if(branch==='codex/preserve-push38-r2-draft-20260919'){disposition='BLOCKED';reason='11 byte-identical R2 draft source/config/SQL files copied from damaged temporary worktree, syntax/diff/secret heuristic checked and remotely preserved. NOT feature-validated or approved for integration. Private report copies verified separately on Kingston; source worktree untouched.';}
  unit.preservation={...unit.preservation,remoteVerified:containing.length>0,remoteRefs:containing,localHead:source.sha,remoteHead:remote?.sha??null,observedAt:now};
  unit.reconciliation={disposition,reason,observedAt:now};
  if(!inMain&&!inIntegration&&!provenEquivalent)unit.state=disposition==='BLOCKED'?'BLOCKED':'PRESERVED_PENDING_INTEGRATION';
  if(disposition==='BLOCKED')unit.nextAction=reason;
  const counts=remote?git('rev-list','--left-right','--count',`${remote.sha}...${source.sha}`).split(/\s+/).map(Number):null;
  branches.push({branch,localHead:source.sha,remoteHead:remote?.sha??null,remoteContainingHead:containing,behind:counts?.[0]??null,ahead:counts?.[1]??null,disposition,reason,commitsNotInMain:lines(git('rev-list','--reverse',`${main}..${source.sha}`)),commitsNotInIntegration:lines(git('rev-list','--reverse',`${integration}..${source.sha}`))});
}
const stash=ledger.units.find(u=>u.id==='STASH-PRESERVATION');
stash.state='PRESERVED_PENDING_INTEGRATION';stash.reconciliation={disposition:'PRESERVED_PENDING_INTEGRATION',reason:'Exact stash commit b8739d0d including index and untracked parents is origin/backup/local-wip-preserved-20260830. No unique source blob remains local-only. Historical deletion intents and duplicate page 2/legacy paths must not be applied to modern architecture.'};
stash.preservation={remoteVerified:true,remoteRefs:['origin/backup/local-wip-preserved-20260830'],stashRetained:true,observedAt:now};stash.integration={status:'ARCHIVE_ONLY_NOT_TO_APPLY',commit:null};stash.nextAction='Keep stash and remote backup; no restore/drop needed for preservation. Reimplement only a separately validated missing requirement.';
const root=ledger.units.find(u=>u.id==='ROOT-MIXED-OWNER-WORK');
root.sourceCommits=[...new Set([...root.sourceCommits,git('rev-parse','origin/codex/preserve-root-source-20260919')])];
root.state='PRESERVED_PENDING_INTEGRATION';root.preservation={remoteVerified:true,scope:'Product code blobs only; private ENV/evidence remain external',evidence:'DEVELOPMENT_LOCAL_RECONCILIATION_2026-09-19.json',remoteRefs:['origin/codex/preserve-root-source-20260919','origin/codex/preserve-security-observability-20260919','origin/codex/development-final-closure-20260919','origin/main'],observedAt:now};
root.reconciliation={disposition:'PRESERVED_PENDING_INTEGRATION',reason:'Source versions preserved or exact remote blobs; no root cleanup. Five unique operational/SEO reports remain private evidence on Kingston with hashes/pointers; generated/native artifacts and ENV excluded.'};root.nextAction='Do not stage/reset shared root. Review preserved historical feature overlap separately; safe current workflow changes are on final-closure branch.';
root.conflictsResolution='Original root source/index untouched; five exact file copies preserved in isolated branch with three scoped commits.';
ledger.schemaVersion=2;ledger.observedAt=now;ledger.reconciliationReport='DEVELOPMENT_BRANCH_RECONCILIATION_2026-09-19.json';
ledger.transitionStatus='BLOCKED_CANONICAL_DEVELOPMENT_DATABASE';
ledger.openPullRequests=[{number:58,head:git('rev-parse','codex/development-final-closure-20260919'),base:'integration/development',disposition:'READY_TO_INTEGRATE',reason:'Development workflow guards only; required exact-commit CI before integration; never a main release',automaticMerge:false},{number:57,head:'450ac46d38d366b43a25c14f2c0a1075fd52c0e8',disposition:'BLOCKED',reason:'GB-M29 canonical isolated database prerequisite',automaticMerge:false},{number:28,head:'e249323ee4555a66672ab55c3bccda863bd47cf8',disposition:'BLOCKED',reason:'PUSH 38 incomplete qualification',draft:true,automaticMerge:false}];
ledger.externalEvidence=[
  ...local.worktrees.find(w=>w.worktree===local.root).files.filter(f=>f.disposition==='LOCAL_UNIQUE_REQUIRES_REVIEW'&&f.path.endsWith('.md')).map(f=>({path:`${local.root}/${f.path}`,sha256:f.sha256,classification:'EVIDENCE_ONLY',location:'Kingston canonical root',publishContents:false})),
  {path:'/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/preserve-push38-r2-draft-20260919/exports/zero-loss-20260919/DIGITAL_OBSERVER_COMMERCIAL_RELEASE_CUSTODY.md',sha256:'2f6782b492af07b317f7f407f1d0eac1bd647ef263aa7b5d16a315f38164efd8',classification:'EVIDENCE_ONLY',verification:'Byte-identical to tmp source; git check-ignore PASS; do not delete worktree until private evidence separately archived',publishContents:false},
  {path:'/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/worktrees/preserve-push38-r2-draft-20260919/exports/zero-loss-20260919/DIGITAL_OBSERVER_PUSH_38Q_R2_DELIVERY_REPORT.md',sha256:'0c2348aea9433f109750e04ce6db08a839990fe30add4841ddf3a7f8511766f3',classification:'EVIDENCE_ONLY',verification:'Byte-identical to tmp source; git check-ignore PASS; do not delete worktree until private evidence separately archived',publishContents:false}
];
const currentTree=new Map(lines(git('ls-tree','-r',integration,'--','supabase/migrations/')).map(l=>{const [m,p]=l.split('\t');return [p,m.split(' ')[2]];}));
let previous=null;const selected=[...currentTree.keys()].sort(),predecessors=new Map(selected.map(f=>{const p=previous;previous=f;return [f,p];}));
for(const m of migrations.migrations){
  const variant=audit.migrationVariants.find(v=>v.file===m.file&&v.blob===m.blob);
  const sourceHead=variant?.sourceHeads?.find(sha=>remoteRefs.some(r=>r.sha===sha))||variant?.sourceHeads?.[0]||null;
  const witnesses=sourceHead?lines(git('for-each-ref',`--contains=${sourceHead}`,'--format=%(refname:short)','refs/remotes/')):[];
  m.version=m.file.split('/').at(-1).split('_')[0];
  m.sourceCommit=sourceHead?attempt(()=>git('log','-1','--format=%H',sourceHead,'--',m.file),sourceHead):null;
  m.remoteBranch=witnesses[0]||null;m.sourceHead=sourceHead;m.sourceTask=m.sourceTask==='See sourceHeads in audit'?(m.remoteBranch||'UNCOMMITTED_VARIANT_REVIEW'):m.sourceTask;
  m.integrationCommit=m.blob&&currentTree.get(m.file)===m.blob?integration:null;
  m.developmentApplied??='NO';m.developmentAppliedAt??=null;m.developmentEvidence??=null;m.developmentHistoryDigest??=null;
  if(m.developmentApplied!=='YES')m.developmentStatusReason=m.integrationCommit?'Canonical isolated database bootstrap blocked; adapted diagnostic QA is not application proof':'Not selected in cumulative integration';
  m.productionApplied=m.productionApplied||'UNVERIFIED';m.productionEvidence=m.productionEvidence||null;
  m.inclusion=m.integrationCommit?'INTEGRATED_DEVELOPMENT':m.sourceTask==='GB-M29'?'CANDIDATE_GB_M29':/edge_private_release_delivery/.test(m.file)?'BLOCKED_PUSH38':'PRESERVED_HISTORICAL_VARIANT';
  m.requiredPredecessor=m.integrationCommit?(predecessors.get(m.file)||null):m.requiredPredecessor;
}
migrations.schemaVersion=2;migrations.observedAt=now;migrations.localDatabaseStatus='BLOCKED_CANONICAL_BASELINE_REPLAY';migrations.developmentExpected=selected.length;migrations.developmentAppliedVerified=migrations.migrations.filter(m=>m.integrationCommit&&m.developmentApplied==='YES'&&m.developmentEvidence&&m.developmentAppliedAt).length;migrations.productionWriteAuthorized=false;
migrations.blockers=[{version:'20260523003000',reason:'CLI single transaction adds then uses enum owner; unsafe use of new enum value'},{version:'20260523012000',reason:'Invalid SQL token alter typeש'},{version:'20260612016600',reason:'Historical Vercel DPA fixture violates constrained status'},{version:'20260827000100',reason:'Invalid correlated LATERAL UPDATE reference'},{version:'20260902033000',reason:'Production-specific authorized camera scope guard fails on empty isolated database; do not fabricate live authorization'}];
write('DEVELOPMENT_INTEGRATION_LEDGER.json',ledger);write('DEVELOPMENT_MIGRATION_LEDGER.json',migrations);
write('DEVELOPMENT_BRANCH_RECONCILIATION_2026-09-19.json',{observedAt:now,main,integration,localRefs:refs.filter(r=>r.ref.startsWith('refs/heads/')).length,remoteRefs:remoteRefs.length,branches,worktrees:local.worktrees.map(w=>({path:w.worktree,head:w.HEAD,present:w.present,remoteContainingHead:w.headRemoteRefs||[],uniqueFiles:w.files.filter(f=>f.disposition==='LOCAL_UNIQUE_REQUIRES_REVIEW').map(f=>f.path),status:!w.present?'MISSING_DIRECTORY_UNTRACKED_HISTORY_UNVERIFIABLE':w.files.some(f=>f.disposition==='LOCAL_UNIQUE_REQUIRES_REVIEW')?'PRESERVATION_REVIEW':'SURVIVING_SOURCE_ACCOUNTED',privateEvidence:w.files.filter(f=>['EVIDENCE_ONLY','SECRET/ENV'].includes(f.disposition)).map(f=>({path:f.path,classification:f.disposition}))})),stashes:local.stashes,openPullRequests:ledger.openPullRequests});
console.log(JSON.stringify({units:ledger.units.length,branches:branches.length,dispositions:branches.reduce((a,b)=>(a[b.disposition]=(a[b.disposition]||0)+1,a),{}),remotePreserved:branches.filter(b=>b.remoteContainingHead.length).length,notRemote:branches.filter(b=>!b.remoteContainingHead.length).map(b=>b.branch),migrationVariants:migrations.migrations.length,canonicalMigrations:selected.length},null,2));
