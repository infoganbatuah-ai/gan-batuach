import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServerClient} from '@supabase/ssr';
import {config} from './local-database.mjs';
import {localCredentials} from './local-client.mjs';

const app='http://127.0.0.1:3000';
const siteA='00000000-0000-4000-8000-000000000e01';
const siteB='00000000-0000-4000-8000-000000000e02';
const noWrite=process.argv.includes('--no-write');
const keys=localCredentials();
const identities=JSON.parse(readFileSync(resolve(config.runtimeRoot,'qa-identities.private.json'),'utf8'));
const expected=execFileSync('git',['rev-parse','origin/integration/development'],{encoding:'utf8'}).trim();
const version=await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit,expected); assert.equal(version.production,false); assert.equal(version.backend,'LOCAL_SUPABASE');

const identity=identities.users.find((user)=>user.email==='observer-a@integration.qa.invalid');
assert.ok(identity);
const jar=new Map();
const client=createServerClient(keys.url,keys.anon,{cookieOptions:{path:'/',sameSite:'lax',secure:false},cookies:{
  getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:(changes)=>changes.forEach(({name,value})=>jar.set(name,value))
}});
const login=await client.auth.signInWithPassword({email:identity.email,password:identity.password});
assert.equal(login.error,null);
const cookie=[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
const checks=[];
async function probe({path,method='GET',body,cookieHeader=cookie,expectedStatus,label,headers={}}){
  const response=await fetch(`${app}${path}`,{method,headers:{...(cookieHeader?{Cookie:cookieHeader}:{}),...(body?{'Content-Type':'application/json',Origin:app}:{}),...headers},
    body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(120000)});
  const raw=await response.text(); let payload=null; try{payload=raw?JSON.parse(raw):null;}catch{}
  const check={path,method,actor:label,status:response.status,expected:expectedStatus,pass:response.status===expectedStatus,serverError:raw.includes('NEXT_HTTP_ERROR_FALLBACK;500')};
  checks.push(check); console.log(JSON.stringify(check)); assert.equal(response.status,expectedStatus,`${method} ${path}: ${raw.slice(0,500)}`); assert.equal(check.serverError,false); return payload;
}

await probe({path:'/digital-observer/billing',expectedStatus:200,label:'observer-a'});
const billing=await probe({path:`/api/digital-observer/billing?observer_site_id=${siteA}`,expectedStatus:200,label:'observer-a'});
assert.equal(billing.data.productionPaymentsEnabled,false);
assert.equal(billing.data.providerMode,'disabled');
assert.ok(billing.data.subscription);
assert.ok(Array.isArray(billing.data.entitlements)&&billing.data.entitlements.length>0);
await probe({path:`/api/digital-observer/billing?observer_site_id=${siteB}`,expectedStatus:403,label:'observer-a forbidden other Site'});
await probe({path:`/api/digital-observer/billing?observer_site_id=${siteA}`,cookieHeader:null,expectedStatus:401,label:'unauthenticated'});

const packages=await client.from('observer_monitoring_packages').select('id,pricing_status').eq('active',true).limit(1);
assert.equal(packages.error,null); assert.ok(packages.data?.[0]); assert.equal(packages.data[0].pricing_status,'unapproved');
await probe({path:'/api/digital-observer/billing',method:'POST',expectedStatus:409,label:'unapproved price checkout denied',body:{
  action:'checkout',observer_site_id:siteA,package_id:packages.data[0].id,billing_cycle:'monthly',idempotency_key:randomUUID()
}});
await probe({path:'/api/digital-observer/payment-provider-callbacks',method:'POST',cookieHeader:null,expectedStatus:503,label:'provider callback disabled',body:{
  event_type:'checkout.payment_confirmed',checkout_stable_id:'a'.repeat(64),outcome:'confirmed'
}});

await client.auth.signOut();
const status=checks.every((check)=>check.pass&&!check.serverError)?'PASS':'FAIL';
const receipt={observedAt:new Date().toISOString(),status,environment:config.environment,integrationCommit:expected,version,checks,
  productionAccess:false,providerContact:false,realPaymentCollected:false,
  proofClassification:{deterministicContract:'PASS',localFullStack:'PASS',paymentSandbox:'NOT_AVAILABLE',productionPayment:'NOT_RUN'},
  limitations:['Synthetic isolated Development identities/data','No provider credentials, card data, charge, tax invoice or refund receipt','Unapproved catalog prices are deliberately rejected']};
if(!noWrite)writeFileSync('development/database/push40-local-product-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status,checks:checks.length,integrationCommit:expected,noWrite}));
if(status!=='PASS')process.exitCode=1;
