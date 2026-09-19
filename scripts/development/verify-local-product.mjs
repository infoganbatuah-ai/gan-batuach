import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServerClient} from '@supabase/ssr';
import {config} from './local-database.mjs';
import {localCredentials} from './local-client.mjs';
const app='http://127.0.0.1:3000',keys=localCredentials();
const identities=JSON.parse(readFileSync(resolve(config.runtimeRoot,'qa-identities.private.json'),'utf8'));
assert.equal(identities.environment,config.environment);
const expected=execFileSync('git',['rev-parse','integration/development'],{encoding:'utf8'}).trim();
const version=await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit,expected);assert.equal(version.production,false);assert.equal(version.backend,'LOCAL_SUPABASE');
const checks=[];
async function probe(path,cookie,expectedStatus,label){
 const response=await fetch(`${app}${path}`,{headers:cookie?{Cookie:cookie}:{},redirect:'manual',signal:AbortSignal.timeout(120000)});
 const body=await response.text();
 checks.push({path,actor:label,status:response.status,expected:expectedStatus,pass:response.status===expectedStatus,serverError:body.includes('NEXT_HTTP_ERROR_FALLBACK;500')});
 console.log(JSON.stringify(checks.at(-1)));
 return {response,body};
}
const health=await probe('/api/health',null,200,'public');
assert.equal(JSON.parse(health.body).supabase,'ok');
await probe('/digital-observer',null,200,'public');
for(const [name,pages] of [
 ['observer-a',['/digital-observer/dashboard','/digital-observer/alerts','/digital-observer/cameras','/digital-observer/recordings']],
 ['manager-a',['/dashboard/garden']],['parent-a',['/dashboard/parent']],['staff-a',['/dashboard/staff']],
]){
 const identity=identities.users.find(u=>u.email===`${name}@integration.qa.invalid`);assert.ok(identity);
 const jar=new Map();const client=createServerClient(keys.url,keys.anon,{cookieOptions:{path:'/',sameSite:'lax',secure:false},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:changes=>changes.forEach(({name,value})=>jar.set(name,value))}});
 const login=await client.auth.signInWithPassword({email:identity.email,password:identity.password});assert.equal(login.error,null);
 const cookie=[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
 for(const path of pages)await probe(path,cookie,200,name);
 if(name==='observer-a')for(const endpoint of ['settings','event-journal','incidents','watch-rules']){
  await probe(`/api/digital-observer/${endpoint}?observer_site_id=00000000-0000-4000-8000-000000000e01`,cookie,200,name);
  await probe(`/api/digital-observer/${endpoint}?observer_site_id=00000000-0000-4000-8000-000000000e02`,cookie,403,`${name} forbidden other Site`);
 }
 await client.auth.signOut();
}
await probe('/api/digital-observer/settings?observer_site_id=00000000-0000-4000-8000-000000000e01',null,401,'unauthenticated');
const status=checks.every(c=>c.pass&&!c.serverError)?'PASS':'FAIL';
writeFileSync('development/database/local-product-receipt.json',JSON.stringify({observedAt:new Date().toISOString(),status,environment:config.environment,integrationCommit:expected,version,checks,productionAccess:false,limitations:['Synthetic local fixtures only','No real camera/Gateway/AI/payment/email provider activation','GB-M29 pending separate integration/HTTP QA','HTTP HTML success is not a full interactive browser journey']},null,2)+'\n');
console.log(JSON.stringify({status,checks:checks.length,integrationCommit:expected}));
if(status!=='PASS')process.exitCode=1;
