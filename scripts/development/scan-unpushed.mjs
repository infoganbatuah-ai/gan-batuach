import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const refs=process.argv.slice(2);
if(!refs.length) throw new Error('Specify the exact refs to scan.');
const commits=git('rev-list',...refs,'--not','--remotes').trim().split('\n').filter(Boolean);
const patterns=[/sk-[A-Za-z0-9_-]{20,}/,/sb_secret_[A-Za-z0-9_-]+/,/xox[baprs]-[A-Za-z0-9-]+/,/AIza[0-9A-Za-z_-]{35}/,/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/];
const findings=[];
let checked=0;
for(const commit of commits){
  const files=git('diff-tree','--root','--no-commit-id','--name-only','--diff-filter=ACMR','-r',commit).trim().split('\n').filter(Boolean);
  for(const file of files){
    if(/(^|\/)(\.env(?:\.|$)|node_modules|\.next)|:memory:\.ses|\.(pem|p12)$/.test(file)) findings.push({commit,file,reason:'forbidden local/secret path'});
    if(!/\.(md|json|[cm]?js|tsx?|yml|yaml|sql|sh|toml|txt)$/.test(file)) continue;
    const content=git('show',`${commit}:${file}`);checked++;
    if(patterns.some(p=>p.test(content))) findings.push({commit,file,reason:'secret-shaped value; review privately'});
  }
}
console.log(JSON.stringify({status:findings.length?'BLOCKED':'PASS',commits,checked,findings,scope:'Heuristic scan of newly reachable commit blobs, not a comprehensive security audit'},null,2));
if(findings.length) process.exitCode=1;
