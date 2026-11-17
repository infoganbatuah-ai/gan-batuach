// One UI POST on pinned isolated Development. Never rerun after a write without readback.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createServerClient} from '@supabase/ssr';
import {config,sql} from '../development/local-database.mjs';
import {localCredentials} from '../development/local-client.mjs';

const expected=process.argv[2];
const base='http://127.0.0.1:3100';
const child='00000000-0000-4000-8000-000000004905';
const garden='00000000-0000-4000-8000-000000000601';
const parentId='00000000-0000-4000-8000-000000000101';
const evidenceRoot=resolve(config.runtimeRoot,'parent-new-enrollment-submission-20261107');
const started=Date.now();
const receipt={task:'GB-PRODUCT-PARENT-NEW-ENROLLMENT-SUBMISSION-20261107',expected,
  startedAt:new Date(started).toISOString(),environment:config.environment,status:'BLOCKED',
  checks:[],actions:[],captures:[],productionAccess:false,browserWrites:0,targetNavigations:0};
const check=(name,ok)=>{receipt.checks.push({name,pass:!!ok});assert.ok(ok,name)};
const left=()=>{const remaining=45_000-(Date.now()-started);if(remaining<=0)throw Error('45-second journey deadline');return remaining};
let browser,requestId,runError;
const contexts=[];

function state() {
  const id=requestId?`'${requestId}'::uuid`:'null::uuid';
  return JSON.parse(sql(`select json_build_object(
    'file',(select count(*) from public.permanent_child_files where id='${child}'::uuid),
    'links',(select count(*) from public.child_guardian_links where permanent_child_file_id='${child}'::uuid
      and guardian_profile_id='${parentId}'::uuid and status='active' and legal_authority),
    'requests',(select count(*) from public.kindergarten_enrollment_requests where child_profile_id='${child}'::uuid and garden_id='${garden}'::uuid),
    'id',(select id from public.kindergarten_enrollment_requests where child_profile_id='${child}'::uuid and garden_id='${garden}'::uuid order by created_at desc limit 1),
    'status',(select status from public.kindergarten_enrollment_requests where id=${id}),
    'payment_status',(select payment_status from public.kindergarten_enrollment_requests where id=${id}),
    'audit',(select count(*) from public.audit_logs where entity_type='kindergarten_enrollment_requests' and entity_id=${id}),
    'notifications',(select count(*) from public.notifications where entity_type='kindergarten_enrollment_requests' and entity_id=${id}),
    'reservation',(select count(*) from public.classroom_seat_reservations where enrollment_request_id=${id}),
    'active_enrollment',(select count(*) from public.child_kindergarten_enrollments where permanent_child_file_id='${child}'::uuid and status='active'),
    'payment_evidence',(select count(*) from public.enrollment_payment_evidence where enrollment_request_id=${id}),
    'external_accepted',(select count(*) from public.communication_logs l join public.notifications n on n.id=l.notification_id
      where n.entity_type='kindergarten_enrollment_requests' and n.entity_id=${id}
        and l.status in ('sent','delivered','accepted_by_provider')))`).trim());
}

async function login(label,keys,identities) {
  const person=identities.users.find(x=>x.email===`${label}@integration.qa.invalid`);
  assert.ok(person?.password,`Missing ${label} QA identity`);
  const jar=new Map();
  const client=createServerClient(keys.url,keys.anon,{cookieOptions:{path:'/',sameSite:'lax',secure:false},cookies:{
    getAll:()=>[...jar].map(([name,value])=>({name,value})),
    setAll:changes=>changes.forEach(({name,value})=>jar.set(name,value))}});
  const result=await client.auth.signInWithPassword({email:person.email,password:person.password});
  assert.equal(result.error,null);client.auth.stopAutoRefresh();
  return {jar,id:result.data.user.id};
}

const cookie=p=>[...p.jar].map(([name,value])=>`${name}=${value}`).join('; ');
async function api(person,path,method='GET',body) {
  const response=await fetch(`${base}${path}`,{method,redirect:'manual',signal:AbortSignal.timeout(left()),
    headers:{...(person?{Cookie:cookie(person)}:{}),...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json().catch(()=>null)};
}

async function pageFor(person,width,height) {
  const context=await browser.newContext({viewport:{width,height},locale:'he-IL'});
  contexts.push(context);
  await context.addCookies([...person.jar].map(([name,value])=>({name,value,url:base})));
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==base)return route.abort('blockedbyclient');
    if(['/dashboard/parent/discover-kindergartens','/dashboard/parent','/dashboard/garden/enrollment-requests'].includes(url.pathname)
      && ['document','fetch'].includes(request.resourceType())) {
      receipt.targetNavigations++;
      if(receipt.targetNavigations>6)return route.abort('blockedbyclient');
    }
    if(!['GET','HEAD'].includes(request.method())) {
      if(request.method()!=='POST'||url.pathname!=='/api/parent/enrollment-requests'||receipt.browserWrites>=1)
        return route.abort('blockedbyclient');
      receipt.browserWrites++;
    }
    return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(5000);return page;
}

async function capture(page,name,selector) {
  await page.locator(selector).first().waitFor({state:'visible',timeout:left()});
  if(name.includes('mobile'))await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const path=resolve(evidenceRoot,`${name}-${expected.slice(0,8)}.png`);
  await page.screenshot({path,fullPage:false,animations:'disabled',timeout:left()});
  chmodSync(path,0o600);receipt.captures.push({name,path});
}

try {
  mkdirSync(evidenceRoot,{recursive:true,mode:0o700});
  check('exact clean feature SHA',/^[0-9a-f]{40}$/.test(expected??'')
    && execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===expected
    && !execFileSync('git',['status','--porcelain=v1','-uall'],{encoding:'utf8'}).trim());
  check('pinned local Development and outbound disabled',config.environment==='DEVELOPMENT / INTEGRATION'
    && config.productionAllowed===false&&config.projectId==='gan-batuach-integration'
    && process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED!=='true'&&!process.env.GB_M31_DELIVERY_WORKER_SECRET);
  const keys=localCredentials();check('loopback local Supabase',keys.url==='http://127.0.0.1:55421');
  const version=await api(null,'/api/development/version');
  check('exact isolated feature Product',version.status===200&&version.body?.commit===expected
    && version.body?.backend==='LOCAL_SUPABASE'&&version.body?.production===false&&version.body?.canonicalProduct===false);
  const before=state();check('one Child, one link, zero request or enrollment before POST',
    before.file===1&&before.links===1&&before.requests===0&&before.active_enrollment===0);
  const identities=JSON.parse(readFileSync(resolve(config.runtimeRoot,'qa-identities.private.json'),'utf8'));
  check('QA identities pinned',identities.environment===config.environment);
  const parent=await login('parent-a',keys,identities),foreignParent=await login('parent-b',keys,identities);
  const manager=await login('manager-a',keys,identities),foreignManager=await login('manager-b',keys,identities);
  const staff=await login('staff-a',keys,identities);
  check('correct Parent identity',parent.id===parentId);
  const {chromium}=createRequire(import.meta.url)('/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,timeout:left()});
  const parentPage=await pageFor(parent,1440,1024);
  await parentPage.goto(`${base}/dashboard/parent/discover-kindergartens?child=${child}`,{waitUntil:'domcontentloaded',timeout:left()});
  const card=parentPage.locator('.parent-garden-card').filter({hasText:'גן השקד'}).first();
  await card.getByRole('button',{name:'שליחת בקשה'}).waitFor({state:'visible',timeout:left()});
  await card.locator('select[name="child_profile_id"]').selectOption(child);
  const responsePromise=parentPage.waitForResponse(r=>new URL(r.url()).pathname==='/api/parent/enrollment-requests'&&r.request().method()==='POST',{timeout:left()});
  await card.getByRole('button',{name:'שליחת בקשה'}).click();
  const submitted=await responsePromise;const payload=await submitted.json();
  requestId=payload?.data?.enrollment_request?.id;
  receipt.actions.push({actor:'parent-ui',action:'submit',status:submitted.status(),requestId});
  check('one fresh Parent UI POST',submitted.status()===201&&/^[0-9a-f-]{36}$/i.test(requestId??'')&&receipt.browserWrites===1);
  await card.getByText('בקשת ההצטרפות נשלחה למנהלת הגן.').waitFor({state:'visible',timeout:left()});
  const created=state();
  check('single submitted request with local audit/notification only',created.id===requestId&&created.requests===1
    && created.status==='submitted'&&created.audit===1&&created.notifications===1&&created.payment_status==='not_requested'
    && created.reservation===0&&created.active_enrollment===0&&created.payment_evidence===0&&created.external_accepted===0);
  await capture(parentPage,'parent-discovery-desktop','.parent-garden-card');
  const retry=await api(parent,'/api/parent/enrollment-requests','POST',{child_profile_id:child,garden_id:garden});
  check('same-intent retry returns same ID without side effects',retry.status===201
    &&retry.body?.data?.enrollment_request?.id===requestId&&JSON.stringify(state())===JSON.stringify(created));
  const denied=await Promise.all([
    api(foreignParent,'/api/parent/enrollment-requests','POST',{child_profile_id:child,garden_id:garden}),
    api(foreignParent,'/api/parent/enrollment-requests'),
    api(foreignManager,`/api/garden/enrollment-requests/${requestId}`),
    api(staff,'/api/parent/enrollment-requests'),
    api(null,'/api/parent/enrollment-requests')]);
  check('foreign Parent submit, Manager, Staff and guest denied; foreign list scoped',
    [401,403,404].includes(denied[0].status)&&denied[1].status===200
    &&!JSON.stringify(denied[1].body).includes(requestId)
    &&[401,403,404].includes(denied[2].status)
    &&[401,403,404].includes(denied[3].status)
    &&[401,403,404].includes(denied[4].status));
  check('denied operations leave request unchanged',JSON.stringify(state())===JSON.stringify(created));
  const parentRead=await api(parent,'/api/parent/enrollment-requests');
  const managerRead=await api(manager,`/api/garden/enrollment-requests/${requestId}`);
  check('Parent and correct Manager APIs return same request',parentRead.status===200
    &&JSON.stringify(parentRead.body).includes(requestId)&&managerRead.status===200
    &&managerRead.body?.data?.enrollment_request?.id===requestId);
  await parentPage.goto(`${base}/dashboard/parent?child=${child}#requests`,{waitUntil:'domcontentloaded',timeout:left()});
  await parentPage.locator('.parent-enrollment-request').filter({hasText:'גן השקד'}).first().waitFor({state:'visible',timeout:left()});
  await capture(parentPage,'parent-request-desktop','.parent-enrollment-request');
  const managerPage=await pageFor(manager,1440,1024);
  await managerPage.goto(`${base}/dashboard/garden/enrollment-requests?request=${requestId}`,{waitUntil:'domcontentloaded',timeout:left()});
  await managerPage.locator('.ux04-enrollment-detail').first().waitFor({state:'visible',timeout:left()});
  await capture(managerPage,'manager-request-desktop','.ux04-enrollment-detail');
  for(const [label,person,path,selector] of [
    ['parent',parent,`/dashboard/parent?child=${child}#requests`,'.parent-enrollment-request'],
    ['manager',manager,`/dashboard/garden/enrollment-requests?request=${requestId}`,'.ux04-enrollment-detail']]) {
    const page=await pageFor(person,390,844);
    await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:left()});
    await capture(page,`${label}-request-mobile`,selector);
  }
  check('navigation and write budgets',receipt.targetNavigations<=6&&receipt.browserWrites===1);
  check('final request unchanged and no activation/payment/delivery',JSON.stringify(state())===JSON.stringify(created));
  receipt.final={requestId,status:created.status,childFiles:created.file,links:created.links,
    requests:created.requests,audit:created.audit,notifications:created.notifications,
    reservation:created.reservation,activeEnrollment:created.active_enrollment,
    paymentEvidence:created.payment_evidence,externalAccepted:created.external_accepted};
  receipt.status='PASS';
} catch(error) {
  runError=error;receipt.reason=error instanceof Error?error.message:String(error);
  if(requestId)try{receipt.failureReadback=state()}catch{}
} finally {
  for(const context of contexts)await context.close().catch(()=>{});
  await browser?.close().catch(()=>{});
  receipt.finishedAt=new Date().toISOString();
  const path=resolve(evidenceRoot,`journey-${started}.json`);
  writeFileSync(path,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});chmodSync(path,0o600);
  console.log(JSON.stringify({status:receipt.status,receiptPath:path,requestId,
    checks:receipt.checks.length,captures:receipt.captures.length,reason:receipt.reason??null}));
  if(runError)process.exitCode=1;
}
