import {execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, lstatSync, existsSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative} from 'node:path';

// Inventory only: no index writes, checkout, stash application, or secret output.
const root = resolve(process.argv[2] || '.');
const out=process.argv.indexOf('--output');
if(out<0)throw Error('Explicit --output is required');
const outputPath=resolve(process.argv[out+1]);
const git = (...args) => execFileSync('git', args, {cwd:root, encoding:'utf8', maxBuffer:128*1024*1024, stdio:'pipe', env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}});
const remoteObjects = new Set(git('rev-list','--objects','--missing=allow-promisor','--remotes').split('\n').map(s=>s.split(' ')[0]));
const tree = ref => new Map(git('ls-tree','-rz',ref).split('\0').filter(Boolean).map(s=>{const [meta,path]=s.split('\t');return [path,meta.split(' ')[2]];}));
const main=tree('origin/main'), integration=tree('integration/development');
const blobHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const privatePath = p => /(^|\/)\.env(?:\.|$)|(^|\/)(credentials?|secrets?)(\/|\.|$)|\.(pem|p12|key)$|integration\.local\.env/.test(p);
const external = p => /^(qa-evidence|archives?|exports|recordings|logs|tmp)(\/|$)|:memory:\.ses|\.(log|mp4|mov|ses|zip|xlsx|pdf)$/.test(p);
const generated = p => /(^|\/)(node_modules|\.next[^/]*|\.git|\.vercel|\.temp|worktrees|build|dist|\.gradle|Pods|\.DS_Store)(\/|$)|^(android\/app\/src\/main\/assets|android\/capacitor-cordova-android-plugins|ios\/capacitor-cordova-ios-plugins)\/|^ios\/App\/App\/capacitor\.config\.json$/.test(p);
const classify=(p,blob)=> privatePath(p)?'SECRET/ENV':external(p)?'EVIDENCE_ONLY':main.get(p)===blob?'ALREADY_IN_MAIN':integration.get(p)===blob?'ALREADY_INTEGRATED':remoteObjects.has(blob)?'PRESERVED_PENDING_INTEGRATION':'LOCAL_UNIQUE_REQUIRES_REVIEW';
const worktrees=git('worktree','list','--porcelain').trim().split('\n\n').map(block=>Object.fromEntries(block.split('\n').map(s=>{const i=s.indexOf(' ');return i<0?[s,true]:[s.slice(0,i),s.slice(i+1)];})));
for(const wt of worktrees){
  wt.present=existsSync(wt.worktree);wt.files=[];wt.omittedGenerated=[];
  if(!wt.present){wt.disposition='MISSING_DIRECTORY_REMOTE_HEAD_PRESERVED_PRIVATE_DATA_UNVERIFIABLE';continue;}
  const base=tree(wt.HEAD);
  const visit=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){
    const abs=resolve(dir,entry.name),p=relative(wt.worktree,abs);
    if(abs===outputPath)continue;
    if(generated(p)){wt.omittedGenerated.push(p);continue;}
    if(entry.isSymbolicLink()){wt.files.push({path:p,disposition:'SYMLINK_NOT_FOLLOWED'});continue;}
    if(entry.isDirectory()){
      if(external(p)){wt.files.push({path:p,disposition:'EVIDENCE_ONLY',contentRead:false,recursiveContentsOmitted:true});continue;}
      visit(abs);continue;
    }
    if(!entry.isFile())continue;
    const size=lstatSync(abs).size;
    if(privatePath(p)){wt.files.push({path:p,bytes:size,disposition:'SECRET/ENV',contentRead:false});continue;}
    if(external(p)){wt.files.push({path:p,bytes:size,disposition:'EVIDENCE_ONLY',contentRead:false});continue;}
    const content=readFileSync(abs),blob=blobHash(content);
    if(base.get(p)===blob)continue;
    wt.files.push({path:p,bytes:size,blob,sha256:createHash('sha256').update(content).digest('hex'),disposition:classify(p,blob),inHead:base.has(p)});
  }};
  visit(wt.worktree);
  const absent=[...base.keys()].filter(p=>!existsSync(resolve(wt.worktree,p)));
  wt.absentTrackedExternalCount=absent.filter(p=>external(p)||generated(p)).length;
  wt.absentTrackedSource=absent.filter(p=>!external(p)&&!generated(p));
  wt.absenceNote='Physical absence may be intentional sparse checkout, not a deletion. Consult readable Git status before any restoration; no files removed.';
  wt.headRemoteRefs=git('for-each-ref',`--contains=${wt.HEAD}`,'--format=%(refname)','refs/remotes/').trim().split('\n').filter(Boolean);
}
const stashes=git('stash','list','--format=%gd|%H').trim().split('\n').filter(Boolean).map(line=>{
  const [ref,sha]=line.split('|'),base=tree(`${sha}^1`),files=[];
  for(const [label,rev] of [['tracked',sha],['index',`${sha}^2`],['untracked',`${sha}^3`]]){
    let t;try{t=tree(rev);}catch{continue;}
    for(const [path,blob] of t){if(label!=='untracked'&&base.get(path)===blob)continue;files.push({layer:label,path,blob,disposition:classify(path,blob)});}
    if(label!=='untracked')for(const path of base.keys())if(!t.has(path))files.push({layer:label,path,disposition:'DELETION_INTENT_REVIEW',baseBlob:base.get(path)});
  }
  return {ref,sha,base:git('rev-parse',`${sha}^1`).trim(),files,removed:false};
});
const result={observedAt:new Date().toISOString(),root,remoteMain:git('rev-parse','origin/main').trim(),integration:git('rev-parse','integration/development').trim(),worktrees,stashes,limitations:['A remotely reachable identical blob proves preservation, not semantic integration.','Secret values and private evidence are not read or published.','Missing directories cannot prove preservation of former untracked/private files.','Concurrent tasks may change files after this point-in-time audit.']};
writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({worktrees:worktrees.length,missing:worktrees.filter(w=>!w.present).length,localUnique:worktrees.map(w=>({worktree:w.worktree,files:w.files.filter(f=>f.disposition==='LOCAL_UNIQUE_REQUIRES_REVIEW').map(f=>f.path)})).filter(w=>w.files.length),stashCount:stashes.length,stashUnique:stashes.flatMap(s=>s.files.filter(f=>f.disposition==='LOCAL_UNIQUE_REQUIRES_REVIEW'))},null,2));
