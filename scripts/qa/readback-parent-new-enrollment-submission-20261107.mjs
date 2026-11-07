// Read-only verification after the one permitted enrollment submission.
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
const requestId='7811740b-d8e7-4f0e-b056-122cf2f8a15b';
const root=resolve(config.runtimeRoot,'parent-new-enrollment-submission-20261107');
const receipt={task:'GB-PRODUCT-PARENT-NEW-ENROLLMENT-SUBMISSION-20261107',mode:'NO_WRITE_UI_READBACK',
  expected,startedAt:new Date().toISOString(),checks:[],captures:[],browserWrites:0,status:'BLOCKED',productionAccess:false};
const check=(label,value)=>{receipt.checks.push({label,pass:!!value});assert.ok(value,label)};
function state(){
  return JSON.parse(sql(`select json_build_object(
    'file',(select count(*) from public.permanent_child_files where id='${child}'::uuid),
    'links',(select count(*) from public.child_guardian_links where permanent_child_file_id='${child}'::uuid and status='active'),
    'requests',(select count(*) from public.kindergarten_enrollment_requests where child_profile_id='${child}'::uuid and garden_id='${garden}'::uuid),
    'status',(select status from public.kindergarten_enrollment_requests where id='${requestId}'::uuid),
    'audit',(select count(*) from public.audit_logs where entity_type='kindergarten_enrollment_requests' and entity_id='${requestId}'::uuid),
    'notifications',(select count(*) from public.notifications where entity_type='kindergarten_enrollment_requests' and entity_id='${requestId}'::uuid),
    'reservation',(select count(*) from public.classroom_seat_reservations where enrollment_request_id='${requestId}'::uuid),
    'active',(select count(*) from public.child_kindergarten_enrollments where permanent_child_file_id='${child}'::uuid and status='active'),
    'payment',(select count(*) from public.enrollment_payment_evidence where enrollment_request_id='${requestId}'::uuid))`).trim());
}
async function login(label,keys,identities){
  const person=identities.users.find(x=>x.email===`${label}@integration.qa.invalid`);
  assert.ok(person?.password,`missing ${label} QA identity`);
  const jar=new Map();
  const client=createServerClient(keys.url,keys.anon,{cookieOptions:{path:'/',sameSite:'lax',secure:false},cookies:{
    getAll:()=>[...jar].map(([name,value])=>({name,value})),
    setAll:changes=>changes.forEach(({name,value})=>jar.set(name,value))}});
  const result=await client.auth.signInWithPassword({email:person.email,password:person.password});
  assert.equal(result.error,null);client.auth.stopAutoRefresh();
  return jar;
}
async function capture(browser,jar,label,width,height,path,selector){
  const context=await browser.newContext({viewport:{width,height},locale:'he-IL'});
  try{
    await context.addCookies([...jar].map(([name,value])=>({name,value,url:base})));
    await context.route('**/*',route=>{
      const request=route.request();
      if(!['GET','HEAD'].includes(request.method())){receipt.browserWrites++;return route.abort('blockedbyclient')}
      if(new URL(request.url()).origin!==base)return route.abort('blockedbyclient');
      return route.continue();
    });
    const page=await context.newPage();
    await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:30000});
    const target=page.locator(selector).first();
    await target.waitFor({state:'visible',timeout:30000});
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    check(`${label} actual content`,!await page.locator('[aria-label="טוען"]').isVisible().catch(()=>false));
    const file=resolve(root,`${label}-${expected.slice(0,8)}.png`);
    await page.screenshot({path:file,fullPage:false,animations:'disabled',timeout:30000});
    chmodSync(file,0o600);receipt.captures.push({label,file,width,height});
  }finally{await context.close()}
}
let browser,failed;
try{
  mkdirSync(root,{recursive:true,mode:0o700});
  check('exact clean feature SHA',/^[0-9a-f]{40}$/.test(expected??'')
    &&execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===expected
    &&!execFileSync('git',['status','--porcelain=v1','-uall'],{encoding:'utf8'}).trim());
  check('isolated Development',config.environment==='DEVELOPMENT / INTEGRATION'&&config.productionAllowed===false
    &&config.projectId==='gan-batuach-integration'&&process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED!=='true');
  const keys=localCredentials();check('loopback Supabase',keys.url==='http://127.0.0.1:55421');
  const version=await fetch(base+'/api/development/version',{signal:AbortSignal.timeout(15000)}).then(r=>r.json());
  check('exact feature Product',version.commit===expected&&version.backend==='LOCAL_SUPABASE'
    &&version.production===false&&version.canonicalProduct===false);
  const before=state();check('one submitted request before screenshots',before.file===1&&before.links===1
    &&before.requests===1&&before.status==='submitted'&&before.audit===1&&before.notifications===1
    &&before.reservation===0&&before.active===0&&before.payment===0);
  const identities=JSON.parse(readFileSync(resolve(config.runtimeRoot,'qa-identities.private.json'),'utf8'));
  const parent=await login('parent-a',keys,identities),manager=await login('manager-a',keys,identities);
  const {chromium}=createRequire(import.meta.url)('/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  for(const [label,jar,width,height,path,selector] of [
    ['parent-desktop-settled',parent,1440,1024,`/dashboard/parent?child=${child}#requests`,'.parent-enrollment-request'],
    ['manager-desktop-settled',manager,1440,1024,`/dashboard/garden/enrollment-requests?request=${requestId}`,'.ux04-enrollment-detail'],
    ['parent-mobile-settled',parent,390,844,`/dashboard/parent?child=${child}#requests`,'.parent-enrollment-request'],
    ['manager-mobile-settled',manager,390,844,`/dashboard/garden/enrollment-requests?request=${requestId}`,'.ux04-enrollment-detail']]){
    await capture(browser,jar,label,width,height,path,selector);
  }
  check('no browser writes',receipt.browserWrites===0);
  const after=state();check('request and counters unchanged',JSON.stringify(after)===JSON.stringify(before));
  receipt.final=after;receipt.status='PASS';
}catch(error){failed=error;receipt.reason=error instanceof Error?error.message:String(error);try{receipt.failureReadback=state()}catch{}}
finally{
  await browser?.close().catch(()=>{});
  receipt.finishedAt=new Date().toISOString();
  const file=resolve(root,`settled-readback-${Date.now()}.json`);
  writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});chmodSync(file,0o600);
  console.log(JSON.stringify({status:receipt.status,file,captures:receipt.captures.length,reason:receipt.reason??null}));
  if(failed)process.exitCode=1;
}
