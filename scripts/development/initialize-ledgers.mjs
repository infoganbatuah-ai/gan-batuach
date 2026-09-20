import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_NO_LAZY_FETCH:'1'}}).trim();
const audit=JSON.parse(readFileSync('DEVELOPMENT_STATE_AUDIT_2026-09-19.json','utf8'));
const outputs=['DEVELOPMENT_INTEGRATION_LEDGER.json','DEVELOPMENT_MIGRATION_LEDGER.json'];
if(outputs.some(existsSync)) throw new Error('Ledgers already exist: update reviewed entries; never overwrite them from an inventory.');
const groups=new Map();
for(const ref of audit.refs){
  const branch=ref.ref.replace(/^refs\/(heads\/|remotes\/origin\/)/,'');
  if(!groups.has(branch)) groups.set(branch,[]);
  groups.get(branch).push(ref);
}
const units=[];
for(const [branch,versions] of groups){
  const local=versions.find(v=>v.ref.startsWith('refs/heads/'));
  const remote=versions.find(v=>v.ref.startsWith('refs/remotes/'));
  const current=local||remote;
  const commits=[...new Set(versions.flatMap(v=>v.commitsNotInMain))];
  const baseline=versions.every(v=>v.containedMain);
  let equivalent=baseline, equivalence=baseline?'ANCESTOR_OF_REMOTE_MAIN':null;
  if(!baseline){
    try{git('diff','--quiet','origin/main',current.sha);equivalent=true;equivalence='EXACT_TREE_EQUALS_MAIN';}catch{}
    if(!equivalent){try { const cherry=git('cherry','origin/main',current.sha).split('\n').filter(Boolean);if(cherry.length&&cherry.every(l=>l.startsWith('- '))){equivalent=true;equivalence='ALL_PATCH_IDS_PRESENT_IN_MAIN';} } catch { equivalence='NOT_PROVEN_PARTIAL_CLONE_OBJECTS_UNAVAILABLE'; }}
  }
  const pushed=Boolean(current.remoteContainingHead.length);
  const id=branch;
  const state=equivalent?'RELEASED_MAIN':pushed?'PUSHED_REMOTE':'BLOCKED';
  const special=branch.includes('push-38')?'PUSH 38 NOT DONE; qualification, signing, delivery and cap gates. Active camera task owns work; do not stage/push its concurrent changes.'
    : branch==='codex/gb-m29-messaging-threads'?'PR #57; exact-head CI 34782778223 and Management context 34782778294 passed. Eligible for development integration; isolated migration/role QA still required before READY.'
      : branch==='codex/seo-canonical-positioning-20260917'?'Scoped metadata/public-copy hardening reviewed; no schema. Revalidate cumulative state before READY.'
        : branch.startsWith('backup/')||branch.includes('/recover')?'Historical preservation/legacy: keep source history; no automatic integration or deletion.'
          : equivalent?'Accounted for in released main by recorded ancestry/tree/patch evidence; no new merge needed.':'Preserved historical or parallel branch; semantic owner review before any integration. Not automatically release eligible.';
  units.push({id,project:branch.includes('gb-m')?'Gan Batuach Management':'Digital Observer / shared',title:git('log','-1','--format=%s',current.sha),owner:branch.includes('push-38')?'Camera / PUSH 38 owner':branch.includes('seo')?'SEO owner':branch.includes('gb-m')?'Management owner':'Integration owner for disposition; original author for semantic review',sourceBranch:branch,sourceCommits:[...new Set(versions.map(v=>v.sha))],commitsNotInMain:commits,state,
    preservation:{remoteVerified:pushed,remoteRefs:current.remoteContainingHead,localHead:local?.sha||null,remoteHead:remote?.sha||null},
    validation:{status:branch==='codex/gb-m29-messaging-threads'?'EXACT_HEAD_CI_PASS':'NOT_REVALIDATED',evidence:branch==='codex/gb-m29-messaging-threads'?['https://github.com/infoganbatuah-ai/gan-batuach/actions/runs/34782778223','https://github.com/infoganbatuah-ai/gan-batuach/actions/runs/34782778294']:[]},
    integration:{status:equivalent?'BASELINE_ACCOUNTED':'PENDING_REVIEW',commit:null,equivalence},
    dependencies:{status:equivalent?'BASELINE':'REVIEW_REQUIRED',units:[]},migrations:[],migrationOrder:[],conflictsResolution:'No automatic conflict resolution attempted',localVerification:'NOT_TESTED',releaseEligibility:equivalent?'NO_NEW_RELEASE_REQUIRED':'NOT_READY',productionDeployment:{status:'NOT_REVERIFIED_PER_UNIT',deploymentId:null},nextAction:special});
}
units.push({id:'ROOT-MIXED-OWNER-WORK',project:'Shared',title:'Preserved dirty canonical root',owner:'Original task owners; integration coordinator',sourceBranch:'main (dirty, do not release)',sourceCommits:[audit.localMain],state:'BLOCKED',preservation:{remoteVerified:false,evidence:'DEVELOPMENT_STATE_AUDIT_2026-09-19.json; per-file hash and exact-main matches'},validation:{status:'NOT_REVALIDATED'},integration:{status:'PENDING_OWNER_RECONCILIATION',commit:null},dependencies:{status:'REVIEW_REQUIRED',units:[]},migrations:audit.worktrees[0].changes.filter(c=>c.classification==='SUPABASE MIGRATION').map(c=>c.path),migrationOrder:[],conflictsResolution:'No root Product changes staged, copied or overwritten',localVerification:'NOT_TESTED',releaseEligibility:'NOT_READY',productionDeployment:{status:'NOT_DEPLOYED'},nextAction:'Compare root paths against remote main and preserved security/observability source. Retain remaining unfinished work with owners; do not stage all or overwrite.'});
units.push({id:'STASH-PRESERVATION',project:'Shared',title:'Pre-migration stash retained',owner:'Integration coordinator / original authors',sourceBranch:null,sourceCommits:audit.stashes.map(s=>s.sha),state:'BLOCKED',preservation:{remoteVerified:false,evidence:'audit.stashes'},validation:{status:'NOT_REVALIDATED'},integration:{status:'PENDING_SEMANTIC_RECONCILIATION',commit:null},dependencies:{status:'REVIEW_REQUIRED',units:[]},migrations:[],migrationOrder:[],conflictsResolution:'No stash pop/apply/drop',localVerification:'NOT_TESTED',releaseEligibility:'NOT_READY',productionDeployment:{status:'NOT_DEPLOYED'},nextAction:'Check stash tracked/untracked contents against migration archives/current source without restoring obsolete code.'});
const baselineMigrations=new Map(git('ls-tree','-r','origin/main','--','supabase/migrations/').split('\n').map(l=>{const [meta,p]=l.split('\t');return [p,meta.split(' ')[2]];}));
const migrationLedger={schemaVersion:1,observedAt:new Date().toISOString(),productionWriteAuthorized:false,remoteHistoryStatus:'UNVERIFIED_READ_ONLY_RECONCILIATION_REQUIRED',localDatabaseStatus:'BLOCKED_NO_DOCKER_OR_ISOLATED_SUPABASE_CONFIG',migrations:audit.migrationVariants.map(m=>({...m,sourceHeads:undefined,sourceEvidence:'DEVELOPMENT_STATE_AUDIT_2026-09-19.json:migrationVariants',sourceTask:m.file.includes('messaging_threads')?'GB-M29':m.file.includes('edge_private_release_delivery')?'PUSH38P':'See sourceHeads in audit',inclusion:baselineMigrations.get(m.file)===m.blob?'BASELINE_IN_MAIN':m.file.includes('management_canonical_messaging_threads')?'CANDIDATE_GB_M29':m.file.includes('edge_')?'BLOCKED_PUSH38':'EXCLUDED_HISTORICAL_OR_UNCOMMITTED_VARIANT',releaseOrder:m.file.split('/').at(-1).split('_')[0],dependencyStatus:'REVIEW_SCHEMA_DEPENDENCIES_BEFORE_APPLY',requiredPredecessor:m.file.includes('management_canonical_messaging_threads')?'All reviewed baseline migrations through 20260913194000; communication foundation / guardian / classroom / staff models':null}))};
const ledger={schemaVersion:1,updatedAt:new Date().toISOString(),workflow:'OWNER_CONTROLLED_CONSOLIDATED_RELEASE',integrationBranch:'integration/development',canonicalWorktree:resolve(audit.root,'worktrees/development-integration'),baselineMain:audit.remoteMain,ownerReleaseAuthorization:null,transitionStatus:'IN_PROGRESS_WITH_EXPLICIT_BLOCKERS',openPRs:[{number:57,classification:'DEVELOPMENT_INTEGRATION_CANDIDATE',head:'450ac46d38d366b43a25c14f2c0a1075fd52c0e8',action:'Keep open; no main merge'},{number:28,classification:'BLOCKED_QUALIFICATION',action:'Keep draft/open; PUSH 38 NOT DONE'}],units,inventory:'DEVELOPMENT_STATE_AUDIT_2026-09-19.json',migrationLedger:'DEVELOPMENT_MIGRATION_LEDGER.json'};
writeFileSync(outputs[0],JSON.stringify(ledger,null,2)+'\n');writeFileSync(outputs[1],JSON.stringify(migrationLedger,null,2)+'\n');
console.log(JSON.stringify({units:units.length,migrationVariants:migrationLedger.migrations.length,baselineMigrations:baselineMigrations.size}));
