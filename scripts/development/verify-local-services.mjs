import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {config,sql,docker} from './local-database.mjs';
import {localCredentials} from './local-client.mjs';
const keys=localCredentials();
const saved=JSON.parse(readFileSync(resolve(config.runtimeRoot,'qa-identities.private.json'),'utf8'));
if(saved.environment!==config.environment)throw Error('Wrong QA identity environment');
const results=[];
for(const user of saved.users){
 if(!user.email.endsWith('@integration.qa.invalid'))throw Error('Non-QA identity rejected');
 const client=createClient(keys.url,keys.anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email:user.email,password:user.password});
 if(login.error||login.data.user?.id!==user.id)throw Error('Local QA Auth login failed');
 const profile=await client.from('profiles').select('id,role').eq('id',user.id).single();
 if(profile.error||profile.data.id!==user.id||profile.data.role!==user.role)throw Error('Local QA own-profile REST read failed');
 results.push({role:user.role,syntheticIdentity:user.email.split('@')[0],auth:'PASS',rest:'PASS'});
 await client.auth.signOut();
}
sql(`BEGIN; SET LOCAL statement_timeout='30s';\n${readFileSync('development/database/qa-security.sql','utf8')}\nROLLBACK;`);
const containers=JSON.parse(docker(['inspect',...docker(['ps','--filter',`label=com.supabase.cli.project=${config.projectId}`,'--format','{{.Names}}']).trim().split('\n')]));
const services=containers.map(c=>({name:c.Name.slice(1),running:c.State.Running,health:c.State.Health?.Status??'NO_HEALTHCHECK',ports:Object.values(c.NetworkSettings.Ports??{}).flat().filter(Boolean).map(p=>({host:p.HostIp,port:p.HostPort}))}));
if(services.some(s=>!s.running||['unhealthy','starting'].includes(s.health)||s.ports.some(p=>p.host!=='127.0.0.1')))throw Error('Local services unhealthy or externally published');
const report={observedAt:new Date().toISOString(),environment:config.environment,productionAccess:false,identities:results,sqlRls:'PASS_ROLLBACK_ONLY',services};
writeFileSync('development/database/services-qa-receipt.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({identities:results.length,auth:'PASS',rest:'PASS',sqlRls:'PASS',services:services.length,loopbackOnly:true}));
