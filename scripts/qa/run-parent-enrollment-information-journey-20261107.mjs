// One bounded Parent -> Manager -> Parent journey on the isolated local Development database.
// A failed run must be inspected before resuming; it never creates a second request.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {chmodSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServerClient} from '@supabase/ssr';
import {config,sql} from '../development/local-database.mjs';
import {localCredentials} from '../development/local-client.mjs';

const base='http://127.0.0.1:3100';
const expectedSha=process.argv[2];
const resumeId=process.env.GB_ENROLLMENT_REQUEST_ID||null;
const parentId='00000000-0000-4000-8000-000000000101';
const childFileId='00000000-0000-4000-8000-000000004901';
const gardenId='00000000-0000-4000-8000-000000000601';
const note='נא לציין שעות נוחות לתיאום שיחה קצרה.';
const answer='אפשר לתאם שיחה בשעות אחר הצהריים.';
const started=Date.now();
const evidenceRoot=resolve(config.runtimeRoot,'parent-enrollment-information-20261107');
const receiptPath=resolve(evidenceRoot,`receipt-${started}.json`);
const receipt={task:'GB-PRODUCT-PARENT-ENROLLMENT-INFORMATION-JOURNEY-20261107',expectedSha,
  environment:config.environment,startedAt:new Date(started).toISOString(),status:'INCOMPLETE',
  actions:[],checks:[],captures:[],productionAccess:false};
const check=(name,pass)=>{receipt.checks.push({name,pass:Boolean(pass)});assert.ok(pass,name);};
const cookieHeader=person=>[...person.jar].map(([name,value])=>`${name}=${value}`).join('; ');
let browser;let requestId;let runError;let initialAudit=0;let initialNotifications=0;let resumeStage='submitted';
const contexts=[];

async function login(label,keys,identities){
  const persona=identities.users.find(item=>item.email===`${label}@integration.qa.invalid`);
  assert.ok(persona?.password,`Missing ${label} synthetic identity`);
  const jar=new Map();
  const client=createServerClient(keys.url,keys.anon,{cookieOptions:{path:'/',sameSite:'lax',secure:false},cookies:{
    getAll:()=>[...jar].map(([name,value])=>({name,value})),
    setAll:changes=>changes.forEach(({name,value})=>jar.set(name,value))
  }});
  const result=await client.auth.signInWithPassword({email:persona.email,password:persona.password});
  assert.equal(result.error,null,`${label} local authentication`);
  client.auth.stopAutoRefresh();
  return {label,jar,client,id:result.data.user.id};
}

async function api(person,path,method='GET',body){
  const response=await fetch(`${base}${path}`,{method,redirect:'manual',signal:AbortSignal.timeout(8000),
    headers:{...(person?{Cookie:cookieHeader(person)}:{}),...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify(body):undefined});
  return {status:response.status,body:await response.json().catch(()=>null)};
}

async function pageFor(person,viewport){
  const context=await browser.newContext({viewport,locale:'he-IL'});
  contexts.push(context);
  await context.addCookies([...person.jar].map(([name,value])=>({name,value,url:base})));
  await context.route('**/*',route=>{
    const request=route.request();const url=new URL(request.url());
    if(url.origin!==base)return route.abort('blockedbyclient');
    if(!['GET','HEAD'].includes(request.method())&&url.pathname.startsWith('/api/')){
      const allowed=(request.method()==='POST'&&(
        url.pathname==='/api/parent/enrollment-requests'||url.pathname===`/api/garden/enrollment-requests/${requestId}`))||
        (request.method()==='PATCH'&&url.pathname==='/api/parent/enrollment-requests');
      if(!allowed)return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(5000);return page;
}

async function capture(page,name){
  const selector=name.startsWith('manager-')?'.ux04-enrollment-detail':
    name==='parent-desktop-submitted'&&!resumeId?'.parent-garden-card':'.parent-enrollment-request';
  await page.locator(selector).first().waitFor({state:'visible',timeout:10000});
  await page.waitForTimeout(1000);
  await page.locator(selector).first().waitFor({state:'visible',timeout:10000});
  if(name.includes('mobile'))await page.locator(selector).first().scrollIntoViewIfNeeded();
  const path=resolve(evidenceRoot,`${name}-${started}.png`);
  await page.screenshot({path,fullPage:false,animations:'disabled',timeout:5000});
  chmodSync(path,0o600);receipt.captures.push({name,path});
}

function state(id){
  assert.match(id,/^[0-9a-f-]{36}$/i);
  return JSON.parse(sql(`select json_build_object(
    'total',(select count(*) from public.kindergarten_enrollment_requests where child_profile_id='${childFileId}'::uuid and garden_id='${gardenId}'::uuid),
    'status',(select status from public.kindergarten_enrollment_requests where id='${id}'::uuid),
    'request',(select information_request from public.kindergarten_enrollment_requests where id='${id}'::uuid),
    'response',(select information_response from public.kindergarten_enrollment_requests where id='${id}'::uuid),
    'reservation',(select count(*) from public.classroom_seat_reservations where enrollment_request_id='${id}'::uuid),
    'audit',(select count(*) from public.audit_logs where entity_type='kindergarten_enrollment_requests' and entity_id='${id}'::uuid),
    'notifications',(select count(*) from public.notifications where entity_type='kindergarten_enrollment_requests' and entity_id='${id}'::uuid),
    'external_accepted',(select count(*) from public.communication_logs l join public.notifications n on n.id=l.notification_id where n.entity_type='kindergarten_enrollment_requests' and n.entity_id='${id}'::uuid and l.status in ('sent','delivered','accepted_by_provider')),
    'active_enrollment',(select count(*) from public.child_kindergarten_enrollments where permanent_child_file_id='${childFileId}'::uuid and status='active'))`).trim());
}

try{
  mkdirSync(evidenceRoot,{recursive:true,mode:0o700});
  check('exact isolated feature commit',/^[0-9a-f]{40}$/.test(expectedSha??'')&&execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===expectedSha);
  check('isolated Development only',config.environment==='DEVELOPMENT / INTEGRATION'&&config.productionAllowed===false&&config.projectId==='gan-batuach-integration');
  check('external delivery disabled',process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED!=='true'&&!process.env.GB_M31_DELIVERY_WORKER_SECRET);
  const keys=localCredentials();check('loopback Supabase',keys.url==='http://127.0.0.1:55421');
  const version=await api(null,'/api/development/version');
  check('exact feature QA server',version.status===200&&version.body?.commit===expectedSha&&version.body?.backend==='LOCAL_SUPABASE'&&version.body?.production===false&&version.body?.canonicalProduct===false);
  const identities=JSON.parse(readFileSync(resolve(config.runtimeRoot,'qa-identities.private.json'),'utf8'));
  check('synthetic identity set',identities.environment===config.environment);
  const parent=await login('parent-a',keys,identities);
  const manager=await login('manager-a',keys,identities);
  const foreignParent=await login('parent-b',keys,identities);
  const foreignManager=await login('manager-b',keys,identities);
  const staff=await login('staff-a',keys,identities);
  check('authorized synthetic Parent',parent.id===parentId);
  const prerequisites=JSON.parse(sql(`select json_build_object(
    'link',exists(select 1 from public.child_guardian_links where guardian_profile_id='${parentId}'::uuid and permanent_child_file_id='${childFileId}'::uuid and status='active' and legal_authority),
    'birth',exists(select 1 from public.permanent_child_files where id='${childFileId}'::uuid and birth_date is not null),
    'garden',exists(select 1 from public.gardens where id='${gardenId}'::uuid and status='active' and public_profile_enabled and enrollment_availability in ('accepting','waitlist_only')),
    'rooms',(select count(*) from public.classrooms where garden_id='${gardenId}'::uuid and status='active' and (select extract(year from age(current_date,birth_date))::integer*12+extract(month from age(current_date,birth_date))::integer from public.permanent_child_files where id='${childFileId}'::uuid) between min_age_months and max_age_months),
    'active',(select count(*) from public.child_kindergarten_enrollments where permanent_child_file_id='${childFileId}'::uuid and status='active'),
    'requests',(select count(*) from public.kindergarten_enrollment_requests where child_profile_id='${childFileId}'::uuid and garden_id='${gardenId}'::uuid))`).trim());
  check('existing authorized Child and Garden, no active enrollment',prerequisites.link&&prerequisites.birth&&prerequisites.garden&&prerequisites.rooms>0&&prerequisites.active===0);
  check('one-request budget',prerequisites.requests===(resumeId?1:0));
  const require=createRequire(import.meta.url);
  const {chromium}=require('/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,timeout:8000});
  const parentPage=await pageFor(parent,{width:1440,height:1024});
  await parentPage.goto(`${base}/dashboard/parent/discover-kindergartens?child=${childFileId}`,{waitUntil:'domcontentloaded',timeout:8000});
  if(resumeId){
    requestId=resumeId;
    const existing=state(requestId);
    check('resumed only known in-scope request', ['submitted','information_required'].includes(existing.status)&&existing.total===1);
    if(existing.status==='information_required')check('existing Manager note is the bounded test note',existing.request===note&&!existing.response);
    resumeStage=existing.status;
    initialAudit=existing.audit;initialNotifications=existing.notifications;
    receipt.actions.push({actor:'local-fixture',action:`resume_existing_${resumeStage}`,requestId});
    await parentPage.goto(`${base}/dashboard/parent?child=${childFileId}#requests`,{waitUntil:'domcontentloaded',timeout:8000});
    await parentPage.getByText(resumeStage==='submitted'?'גן השקד · נשלח':'גן השקד · נדרש מידע נוסף').first().waitFor();
  }
  else{
    await parentPage.getByRole('button',{name:'שליחת בקשה'}).waitFor();
    check('Parent sees eligible Garden submission',await parentPage.getByRole('button',{name:'שליחת בקשה'}).count()>0);
    await parentPage.locator(`form:has(button:text("שליחת בקשה")) select[name="child_profile_id"]`).selectOption(childFileId);
    const responsePromise=parentPage.waitForResponse(response=>new URL(response.url()).pathname==='/api/parent/enrollment-requests'&&response.request().method()==='POST',{timeout:15000});
    await parentPage.getByRole('button',{name:'שליחת בקשה'}).click();
    const result=await responsePromise;const body=await result.json();
    requestId=body?.data?.enrollment_request?.id;
    receipt.actions.push({actor:'parent-ui',action:'submit',status:result.status(),requestId});
    check('one Parent UI submission',result.status()===201&&/^[0-9a-f-]{36}$/i.test(requestId??'')&&state(requestId).status==='submitted');
    initialAudit=state(requestId).audit;initialNotifications=state(requestId).notifications;
  }
  await capture(parentPage,'parent-desktop-submitted');
  const retry=await api(parent,'/api/parent/enrollment-requests','POST',{child_profile_id:childFileId,garden_id:gardenId});
  check('retry returns same request without duplicate',retry.status===201&&retry.body?.data?.enrollment_request?.id===requestId&&state(requestId).total===1);
  const foreignList=await api(foreignParent,'/api/parent/enrollment-requests');
  check('foreign Parent list excludes known request',foreignList.status===200&&!JSON.stringify(foreignList.body).includes(requestId));
  const managerPage=await pageFor(manager,{width:1440,height:1024});
  await managerPage.goto(`${base}/dashboard/garden/enrollment-requests?request=${requestId}`,{waitUntil:'domcontentloaded',timeout:8000});
  await managerPage.locator('.ux04-decision-panel form').waitFor();
  const managerRead=await api(manager,`/api/garden/enrollment-requests/${requestId}`);
  check('Manager sees scoped request despite unavailable optional enrichment',managerRead.status===200&&managerRead.body?.data?.enrollment_request?.id===requestId);
  await managerPage.getByText('פרטי הזיהוי המורחבים אינם זמינים בסביבה זו').waitFor();
  await capture(managerPage,`manager-desktop-${resumeStage}`);
  const form=managerPage.locator('.ux04-decision-panel form');
  if(resumeStage==='submitted'){
    await form.locator('select[name="action"]').selectOption('review');
    const reviewPromise=managerPage.waitForResponse(response=>new URL(response.url()).pathname===`/api/garden/enrollment-requests/${requestId}`&&response.request().method()==='POST',{timeout:15000});
    await form.getByRole('button',{name:/שמירה/}).click();
    const reviewed=await reviewPromise;receipt.actions.push({actor:'manager-ui',action:'review',status:reviewed.status()});
    check('Manager review only',reviewed.status()===200&&state(requestId).status==='under_review'&&state(requestId).reservation===0);
    await form.locator('select[name="action"]').selectOption('request_information');
    await form.locator('textarea[name="decision_reason"]').fill(note);
    const requestPromise=managerPage.waitForResponse(response=>new URL(response.url()).pathname===`/api/garden/enrollment-requests/${requestId}`&&response.request().method()==='POST',{timeout:15000});
    await form.getByRole('button',{name:/שמירה/}).click();
    const requested=await requestPromise;receipt.actions.push({actor:'manager-ui',action:'request_information',status:requested.status()});
    check('Manager requests short nonpersonal information',requested.status()===200&&state(requestId).status==='information_required'&&state(requestId).request===note&&state(requestId).reservation===0);
  }
  else check('resumed Manager information request',state(requestId).status==='information_required'&&state(requestId).request===note&&state(requestId).reservation===0);
  await managerPage.getByText(note).first().waitFor();
  await capture(managerPage,'manager-desktop-information-required');
  const beforeDenied=state(requestId);
  const denied=await Promise.all([
    api(foreignManager,`/api/garden/enrollment-requests/${requestId}`),
    api(foreignManager,`/api/garden/enrollment-requests/${requestId}`,'POST',{action:'review'}),
    api(foreignParent,'/api/parent/enrollment-requests','PATCH',{action:'respond_information',request_id:requestId,response:answer}),
    api(staff,'/api/parent/enrollment-requests','PATCH',{action:'respond_information',request_id:requestId,response:answer}),
    api(null,'/api/parent/enrollment-requests','PATCH',{action:'respond_information',request_id:requestId,response:answer})
  ]);
  check('foreign/Staff/guest known-ID access refused',denied.every(result=>[401,403,404].includes(result.status)));
  check('denied actions leave state unchanged',JSON.stringify(state(requestId))===JSON.stringify(beforeDenied));
  await parentPage.goto(`${base}/dashboard/parent?child=${childFileId}#requests`,{waitUntil:'domcontentloaded',timeout:8000});
  await parentPage.getByText(note).first().waitFor();
  await parentPage.locator('.parent-enrollment-request form textarea[name="response"]').fill(answer);
  await capture(parentPage,'parent-desktop-information-required');
  const respondPromise=parentPage.waitForResponse(response=>new URL(response.url()).pathname==='/api/parent/enrollment-requests'&&response.request().method()==='PATCH',{timeout:15000});
  await parentPage.getByRole('button',{name:'שליחת תשובה'}).click();
  const responded=await respondPromise;receipt.actions.push({actor:'parent-ui',action:'respond_information',status:responded.status()});
  check('Parent responds and request is resubmitted',responded.status()===200&&state(requestId).status==='resubmitted'&&state(requestId).response===answer);
  await parentPage.reload({waitUntil:'domcontentloaded'});
  await parentPage.getByText(answer).first().waitFor();
  await capture(parentPage,'parent-desktop-resubmitted');
  const mobileParent=await pageFor(parent,{width:390,height:844});
  await mobileParent.goto(`${base}/dashboard/parent?child=${childFileId}#requests`,{waitUntil:'domcontentloaded',timeout:8000});
  await mobileParent.getByText(answer).first().waitFor();
  await capture(mobileParent,'parent-mobile-resubmitted');
  const mobileManager=await pageFor(manager,{width:390,height:844});
  await mobileManager.goto(`${base}/dashboard/garden/enrollment-requests?request=${requestId}`,{waitUntil:'domcontentloaded',timeout:8000});
  await mobileManager.getByText(answer).first().waitFor();
  await capture(mobileManager,'manager-mobile-resubmitted');
  const final=state(requestId);
  check('audit/notifications bounded with no reservation, activation or external delivery',final.total===1&&final.status==='resubmitted'&&final.audit===initialAudit+(resumeStage==='submitted'?3:1)&&final.notifications===initialNotifications+(resumeStage==='submitted'?2:0)&&final.reservation===0&&final.active_enrollment===0&&final.external_accepted===0);
  receipt.finalState={requestId,status:final.status,requestCount:final.total,audit:final.audit,notifications:final.notifications,reservation:final.reservation,activeEnrollment:final.active_enrollment,externalAccepted:final.external_accepted};
  receipt.status='PASS';
}catch(error){runError=error;receipt.status='BLOCKED';receipt.reason=error instanceof Error?error.message:String(error);}
finally{
  for(const context of contexts)await context.close().catch(()=>{});
  await browser?.close().catch(()=>{});
  receipt.finishedAt=new Date().toISOString();
  writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  chmodSync(receiptPath,0o600);
  console.log(JSON.stringify({status:receipt.status,receiptPath,requestId,checks:receipt.checks.length,captures:receipt.captures.length,reason:receipt.reason??null}));
  if(runError)process.exitCode=1;
}
