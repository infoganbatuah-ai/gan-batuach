import {spawn} from 'node:child_process';
import {readFileSync,openSync,writeSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {config,docker,sql} from './local-database.mjs';
const contexts=JSON.parse(docker(['context','inspect',config.dockerContext]));
if(config.productionAllowed!==false||!contexts[0]?.Endpoints?.docker?.Host?.startsWith(`unix://${config.runtimeRoot}/colima/`))throw Error('Dedicated local Docker context required');
const network='gan-batuach-integration-loopback';
let networkState;
try { networkState=JSON.parse(docker(['network','inspect',network]))[0]; }
catch { docker(['network','create','--label',`com.gan-batuach.environment=development`,'-o','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network]);networkState=JSON.parse(docker(['network','inspect',network]))[0]; }
if(networkState?.Options?.['com.docker.network.bridge.host_binding_ipv4']!=='127.0.0.1')throw Error('Development network must bind published ports only to loopback');
const workdir=resolve(config.runtimeRoot,'stack');
const text=readFileSync(resolve(workdir,'supabase/config.toml'),'utf8');
if(!text.includes('project_id = "gan-batuach-integration"')||!text.includes('port = 55421'))throw Error('Wrong local stack config');
const log=resolve(config.runtimeRoot,`supabase-start-${Date.now()}.log`),fd=openSync(log,'wx',0o600);
const env={PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,DOCKER_CONFIG:resolve(config.runtimeRoot,'docker'),DOCKER_CONTEXT:config.dockerContext};
console.log(`Starting DEVELOPMENT-only Supabase; private startup log: ${log}`);
const child=spawn('supabase',['start','--workdir',workdir,'--network-id',network,'--exclude','studio,postgres-meta,logflare,vector,supavisor,edge-runtime,imgproxy'],{env,stdio:['ignore','pipe','pipe']});
// The cumulative schema is large. Bound schema-cache initialization at 60s on
// the local connection role; anon/authenticated role limits remain unchanged.
// Reapply after CLI local restore because container roles are reconstructed.
const configure=setInterval(()=>{
  try{sql("ALTER ROLE authenticator SET statement_timeout='60s'; NOTIFY pgrst,'reload config';");clearInterval(configure);console.log('Local API schema-cache initialization timeout configured; user-role limits unchanged.');}catch{/* Dedicated DB not yet ready; do not fall back to another context. */}
},5000);
child.stdout.on('data',b=>writeSync(fd,b));child.stderr.on('data',b=>writeSync(fd,b));
const tick=setInterval(()=>console.log('Local Supabase startup/download still running; secrets suppressed.'),30000);
child.on('error',e=>{clearInterval(configure);clearInterval(tick);closeSync(fd);console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{clearInterval(configure);clearInterval(tick);closeSync(fd);console.log(JSON.stringify({exitCode:code,privateLog:log,productionAccess:false}));process.exitCode=code??1;});
