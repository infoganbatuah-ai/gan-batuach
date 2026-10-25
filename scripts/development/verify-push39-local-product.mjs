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
assert.equal(identities.environment,config.environment);

const expected=execFileSync('git',['rev-parse','origin/integration/development'],{encoding:'utf8'}).trim();
const version=await (await fetch(`${app}/api/development/version`)).json();
assert.equal(version.commit,expected);
assert.equal(version.production,false);
assert.equal(version.backend,'LOCAL_SUPABASE');

const identity=identities.users.find((user)=>user.email==='observer-a@integration.qa.invalid');
assert.ok(identity);
const jar=new Map();
const client=createServerClient(keys.url,keys.anon,{cookieOptions:{path:'/',sameSite:'lax',secure:false},cookies:{
  getAll:()=>[...jar].map(([name,value])=>({name,value})),
  setAll:(changes)=>changes.forEach(({name,value})=>jar.set(name,value))
}});
const login=await client.auth.signInWithPassword({email:identity.email,password:identity.password});
assert.equal(login.error,null);
assert.ok(login.data.user?.id);
const profileId=login.data.user.id;
const cookie=[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
const checks=[];

async function probe({path,method='GET',body,cookieHeader=cookie,expectedStatus,label}) {
  const response=await fetch(`${app}${path}`,{
    method,
    headers:{
      ...(cookieHeader?{Cookie:cookieHeader}:{}),
      ...(body?{'Content-Type':'application/json',Origin:app}:{}),
    },
    body:body?JSON.stringify(body):undefined,
    redirect:'manual',
    signal:AbortSignal.timeout(120000)
  });
  const raw=await response.text();
  let payload=null;
  try { payload=raw?JSON.parse(raw):null; } catch { payload=null; }
  const check={path,method,actor:label,status:response.status,expected:expectedStatus,
    pass:response.status===expectedStatus,serverError:raw.includes('NEXT_HTTP_ERROR_FALLBACK;500')};
  checks.push(check);
  console.log(JSON.stringify(check));
  assert.equal(response.status,expectedStatus,`${method} ${path}: ${raw.slice(0,500)}`);
  assert.equal(check.serverError,false);
  return payload;
}

await probe({path:'/digital-observer/settings',expectedStatus:200,label:'observer-a'});
for (const endpoint of ['notifications','escalations']) {
  await probe({path:`/api/digital-observer/${endpoint}?observer_site_id=${siteA}`,expectedStatus:200,label:'observer-a'});
  await probe({path:`/api/digital-observer/${endpoint}?observer_site_id=${siteB}`,expectedStatus:403,label:'observer-a forbidden other Site'});
  await probe({path:`/api/digital-observer/${endpoint}?observer_site_id=${siteA}`,cookieHeader:null,expectedStatus:401,label:'unauthenticated'});
}

const disabledProvider=await probe({path:'/api/digital-observer/provider-channels',method:'POST',expectedStatus:200,label:'observer-a',body:{
  observer_site_id:siteA,channel:'email',mode:'disabled'
}});
assert.equal(disabledProvider.data.external_provider_contacted,false);
assert.equal(disabledProvider.data.channel.provider_mode,'disabled');
assert.equal(disabledProvider.data.channel.active,false);

await probe({path:'/api/digital-observer/provider-channels',method:'POST',expectedStatus:422,label:'production activation rejected',body:{
  observer_site_id:siteA,channel:'email',mode:'production'
}});

const notifyRequestId=randomUUID();
const notifyProposal=await probe({path:'/api/digital-observer/action-intents',method:'POST',expectedStatus:201,label:'observer-a',body:{
  kind:'natural_language_proposal',observer_site_id:siteA,instruction:'notify the authorized operator',request_id:notifyRequestId
}});
assert.equal(notifyProposal.data.executed,false);
assert.equal(notifyProposal.data.proposal.actionType,'notify');
const notifyIntentId=notifyProposal.data.intent.id;

const confirmed=await probe({path:`/api/digital-observer/action-intents/${notifyIntentId}`,method:'POST',expectedStatus:200,label:'observer-a',body:{
  action:'confirm',confirmation_text:'CONFIRM'
}});
assert.equal(confirmed.data.executed,false);
assert.equal(confirmed.data.intent.intent_status,'authorized');

const notificationBody={observer_site_id:siteA,action_intent_id:notifyIntentId,recipient_profile_id:profileId,
  channel:'in_app',severity:'medium',priority:5,title:'Digital Observer QA',
  body:'A reviewed local QA event requires attention.',product_path:'/digital-observer/alerts',ttl_seconds:3600,
  dispatch_sandbox:true,sandbox_behavior:'success'};
const firstDelivery=await probe({path:'/api/digital-observer/notifications',method:'POST',expectedStatus:201,label:'observer-a',body:notificationBody});
assert.equal(firstDelivery.data.duplicate,false);
assert.equal(firstDelivery.data.dispatched.confirmedDelivery,true);
assert.equal(firstDelivery.data.dispatched.outcome,'success');
const deliveryId=firstDelivery.data.delivery.id;

const duplicateDelivery=await probe({path:'/api/digital-observer/notifications',method:'POST',expectedStatus:200,label:'observer-a duplicate',body:notificationBody});
assert.equal(duplicateDelivery.data.duplicate,true);
assert.equal(duplicateDelivery.data.dispatched,false);

const acknowledgement=await probe({path:`/api/digital-observer/notifications/${deliveryId}`,method:'POST',expectedStatus:200,label:'observer-a recipient',body:{action:'acknowledge'}});
assert.equal(acknowledgement.data.delivery.delivery_status,'acknowledged');

const escalationCreated=await probe({path:'/api/digital-observer/escalations',method:'POST',expectedStatus:201,label:'observer-a',body:{
  observer_site_id:siteA,action_intent_id:notifyIntentId,acknowledgement_timeout_seconds:900,
  steps:[{recipient_profile_id:profileId,channel:'in_app',delay_seconds:0}]
}});
assert.equal(escalationCreated.data.activated,false);
assert.equal(escalationCreated.data.external_action_taken,false);
const escalationId=escalationCreated.data.escalation.id;
const escalationAdvanced=await probe({path:`/api/digital-observer/escalations/${escalationId}`,method:'POST',expectedStatus:200,label:'observer-a',body:{action:'advance'}});
assert.equal(escalationAdvanced.data.delivery_queued,false);
assert.equal(escalationAdvanced.data.escalation.current_step,1);
const escalationClosed=await probe({path:`/api/digital-observer/escalations/${escalationId}`,method:'POST',expectedStatus:200,label:'observer-a',body:{action:'close',reason:'Local QA completed'}});
assert.equal(escalationClosed.data.escalation.escalation_status,'closed');

const sirenProposal=await probe({path:'/api/digital-observer/action-intents',method:'POST',expectedStatus:201,label:'observer-a',body:{
  kind:'natural_language_proposal',observer_site_id:siteA,instruction:'sound the siren',request_id:randomUUID()
}});
assert.equal(sirenProposal.data.proposal.actionType,'siren');
assert.equal(sirenProposal.data.executed,false);
const sirenIntentId=sirenProposal.data.intent.id;
await probe({path:`/api/digital-observer/action-intents/${sirenIntentId}`,method:'POST',expectedStatus:409,label:'lawful-use gate',body:{
  action:'confirm',confirmation_text:'CONFIRM'
}});
const sirenCancelled=await probe({path:`/api/digital-observer/action-intents/${sirenIntentId}`,method:'POST',expectedStatus:200,label:'observer-a',body:{
  action:'cancel',reason:'Lawful-use approval intentionally unavailable in local QA'
}});
assert.equal(sirenCancelled.data.intent.intent_status,'cancelled');

await probe({path:'/api/digital-observer/action-intents',method:'POST',expectedStatus:422,label:'unsupported natural-language action rejected',body:{
  kind:'natural_language_proposal',observer_site_id:siteA,instruction:'do something unrestricted',request_id:randomUUID()
}});
await probe({path:'/api/digital-observer/action-intents',method:'POST',expectedStatus:403,label:'observer-a forbidden other Site',body:{
  kind:'natural_language_proposal',observer_site_id:siteB,instruction:'notify the operator',request_id:randomUUID()
}});
await probe({path:'/api/digital-observer/action-intents',method:'POST',cookieHeader:null,expectedStatus:401,label:'unauthenticated',body:{
  kind:'natural_language_proposal',observer_site_id:siteA,instruction:'notify the operator',request_id:randomUUID()
}});

await probe({path:'/api/digital-observer/provider-callbacks',method:'POST',cookieHeader:null,expectedStatus:503,label:'provider callback fail-closed',body:{
  delivery_id:randomUUID(),provider_key:'disabled-local-qa',provider_event_id:randomUUID(),outcome:'success'
}});

await client.auth.signOut();
const status=checks.every((check)=>check.pass&&!check.serverError)?'PASS':'FAIL';
const receipt={observedAt:new Date().toISOString(),status,environment:config.environment,integrationCommit:expected,version,
  checks,productionAccess:false,externalProviderContact:false,physicalActionExecuted:false,
  proofClassification:{deterministicContract:'PASS',localFullStack:'PASS',providerSandbox:'NOT_AVAILABLE',productionDelivery:'NOT_RUN'},
  limitations:['Synthetic isolated Development identities and data only','In-app adapter only; no external provider credentials or receipts','No emergency or physical action was executed','PUSH 45 lawful-use approval remains required for sensitive actions']};
if(!noWrite)writeFileSync('development/database/push39-local-product-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status,checks:checks.length,integrationCommit:expected,noWrite}));
if(status!=='PASS')process.exitCode=1;
