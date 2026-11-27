// Source-only integration checks. No database, listener, device or remote host.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {randomUUID} = require("node:crypto");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname,"../..");
require("tsconfig-paths").register({baseUrl:root,paths:{"@/*":["./*"]}});
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name,...rest) {
  if (name==="server-only") return require.resolve("next/dist/compiled/server-only/empty.js");
  return resolve.call(this,name,...rest);
};
require.extensions[".ts"] = (mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText,file);
global.fetch=()=>{throw Error("Network forbidden in integration checks");};
const fromRoot = p=>require(path.join(root,p));
const route=fromRoot("app/api/digital-observer/qa/installation-proof/route.ts");
const {qaSiteWriterMode}=fromRoot("lib/domain/digital-observer/qa-site-writer-mode.ts");
const {stagedQaWindow}=fromRoot("lib/domain/digital-observer/qa-installation/window.ts");
const qaProject="https://qrkodgtccyzmshitowdt.supabase.co";
const flags=["OBSERVER_QA_ATOMIC_SITE_SAVE","OBSERVER_QA_INSTALLATION_PROOF","OBSERVER_QA_INSTALLATION_WINDOW",
  "VERCEL_ENV","NEXT_PUBLIC_SUPABASE_URL"];
test.beforeEach(()=>{for(const f of flags) delete process.env[f];});
const request=()=>new Request("https://observer-qa.ganbatuach.com/api/digital-observer/qa/installation-proof",{method:"POST"});
function syntheticWindow() {
  const now=Date.now();
  return {receiptSecret:"a".repeat(64),operator:{requestId:randomUUID(),ownerSubject:randomUUID(),
    siteId:randomUUID(),sourceId:randomUUID(),publicKeyDigest:"b".repeat(64),issuedAt:now,expiresAt:now+200000}};
}
test("mounted route stays closed with a valid obsolete env window and browser-supplied window",async()=>{
  const window=syntheticWindow();
  Object.assign(process.env,{VERCEL_ENV:"preview",NEXT_PUBLIC_SUPABASE_URL:qaProject,
    OBSERVER_QA_INSTALLATION_PROOF:"1",OBSERVER_QA_INSTALLATION_WINDOW:JSON.stringify(window)});
  const r = new Request(request().url,{method:"POST",headers:{
    host:"observer-qa.ganbatuach.com",origin:"https://observer-qa.ganbatuach.com","sec-fetch-site":"same-origin",
    "content-type":"application/json",cookie:"synthetic=1"
  },body:JSON.stringify(window)});
  const result=await route.POST(r);
  assert.equal(result.status,404);
  assert.deepEqual(await result.json(),{});
  assert.equal(await stagedQaWindow(),null);
});
test("reader contract checks fresh server-only staging per request and fails closed on loss or expiry",async()=>{
  Object.assign(process.env,{VERCEL_ENV:"preview",NEXT_PUBLIC_SUPABASE_URL:qaProject,OBSERVER_QA_INSTALLATION_PROOF:"1"});
  let staged=syntheticWindow(), reads=0;
  // In-memory contract fixture only. No reader is wired into the deployed route.
  const read=async(...args)=>{assert.equal(args.length,0);reads++;return staged;};
  assert.deepEqual(await stagedQaWindow(read),staged);
  staged=null;
  assert.equal(await stagedQaWindow(read),null);
  staged=syntheticWindow();staged.operator.expiresAt=staged.operator.issuedAt+300001;
  assert.equal(await stagedQaWindow(read),null);
  staged.operator.expiresAt=Date.now()-1;
  assert.equal(await stagedQaWindow(read),null);
  assert.equal(await stagedQaWindow(async()=>{throw Error("unavailable");}),null);
  for(const [key,value] of [["VERCEL_ENV","production"],["NEXT_PUBLIC_SUPABASE_URL","https://different.invalid"],
      ["OBSERVER_QA_INSTALLATION_PROOF","0"]]){
    const prior=process.env[key];process.env[key]=value;assert.equal(await stagedQaWindow(read),null);process.env[key]=prior;
  }
  assert.equal(reads,4);
});
test("ordinary Product keeps its handler; hosted QA Site save is closed; only explicit standalone q669 selects #669",async()=>{
  assert.equal(qaSiteWriterMode(),"product");
  process.env.NEXT_PUBLIC_SUPABASE_URL=qaProject;
  assert.equal(qaSiteWriterMode(),"closed");
  const site=fromRoot("app/api/digital-observer/onboarding/route.ts");
  assert.equal((await site.POST(request())).status,403);
  process.env.NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:39869";
  assert.equal(qaSiteWriterMode(),"closed");
  process.env.OBSERVER_QA_ATOMIC_SITE_SAVE="1";
  assert.equal(qaSiteWriterMode(),"local-atomic");
  process.env.VERCEL_ENV="preview";assert.equal(qaSiteWriterMode(),"closed");
});
test("external ingress policy still denies installation POST even when proxy owner authentication succeeds",async()=>{
  const {observerQaRouteAllowed}=await import("../../scripts/qa/push44-observer-qa-ingress-policy.mjs");
  assert.equal(observerQaRouteAllowed({method:"POST",rawUrl:"/api/digital-observer/qa/installation-proof",
    host:"observer-qa.ganbatuach.com",trustedHttps:true,ownerAuthorized:true}),false);
});

test("same preview process authenticates before lookup, denies mismatched owner, and separates RPC credentials",async t=>{
  const stage=syntheticWindow();
  const backendCredential=["sb","secret","synthetic_fixture_only"].join("_");
  const userToken="synthetic-session-only";
  const digest=stage.operator.publicKeyDigest;
  Object.assign(process.env,{VERCEL_ENV:"preview",NEXT_PUBLIC_SUPABASE_URL:qaProject,
    OBSERVER_QA_INSTALLATION_PROOF:"1",SUPABASE_SERVICE_ROLE_KEY:backendCredential,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-publishable"});
  t.after(()=>{delete process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;});
  const supabase=fromRoot("lib/supabase/server.ts"),access=fromRoot("lib/domain/digital-observer/access.ts");
  const pending=fromRoot("lib/domain/digital-observer/qa-installation/server.ts");
  t.mock.method(supabase,"createClient",async()=>({auth:{getSession:async()=>({data:{session:{access_token:userToken}}})}}));
  let who=null,staged=null,reads=0,stores=0;
  t.mock.method(access,"getDigitalObserverApiUser",async req=>{
    assert.ok(req.headers.get("authorization")==="Bearer "+userToken);
    return who && {user:{id:who,email_confirmed_at:"confirmed"},profile:{active:true}};
  });
  t.mock.method(pending,"preparePendingOnProductServer",async()=>({status:"PENDING",grantsAccess:false,
    requestId:stage.operator.requestId,siteId:stage.operator.siteId,sourceId:stage.operator.sourceId,
    spkiSha256:digest,expiresAt:stage.operator.expiresAt}));
  t.mock.method(global,"fetch",async(url,options)=>{
    assert.equal(options.redirect,"error");assert.equal(options.cache,"no-store");
    if(url===qaProject+"/rest/v1/rpc/qa_observer_read_window"){
      assert.ok(options.headers.apikey===backendCredential && !options.headers.authorization);
      assert.equal(options.body,"{}");reads++;
      return Response.json(staged);
    }
    assert.equal(url,qaProject+"/rest/v1/rpc/qa_observer_pending_proof");stores++;
    assert.ok(options.headers.authorization==="Bearer "+userToken && options.headers.apikey!==backendCredential);
    const payload=JSON.parse(options.body);
    assert.ok(payload.ticket===stage.receiptSecret && !options.body.includes(backendCredential));
    return Response.json(payload.nonce_hex);
  });
  // Bind the adapter after installing the Product verifier double.
  const modulePath=require.resolve(path.join(root,"app/api/digital-observer/qa/installation-proof/route.ts"));
  const originalModule=require.cache[modulePath];
  delete require.cache[modulePath];
  const isolatedRoute=require(modulePath);
  t.after(()=>{require.cache[modulePath]=originalModule;});
  const post=()=>isolatedRoute.POST(new Request(request().url,{method:"POST",headers:{host:"observer-qa.ganbatuach.com",
    origin:"https://observer-qa.ganbatuach.com","sec-fetch-site":"same-origin","content-type":"application/json"},
    body:JSON.stringify({op:"begin",spki:"A".repeat(124)})}));
  assert.equal((await post()).status,404);assert.equal(reads,0);
  who=stage.operator.ownerSubject;assert.equal((await post()).status,404);
  staged=stage;who=randomUUID();assert.equal((await post()).status,404);assert.equal(stores,0);
  who=stage.operator.ownerSubject;
  const r=await post();assert.equal(r.status,200);
  const raw=await r.text();
  for(const value of [backendCredential,userToken,stage.receiptSecret,who])assert.ok(!raw.includes(value));
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),["nonce","status"]);
  staged=null;assert.equal((await post()).status,404);assert.equal(stores,1);
});


test("private reader rejects a mismatched legacy project before transmission",async t=>{
  const reader=fromRoot("lib/domain/digital-observer/qa-installation/private-reader.ts");
  const claims={role:"service_role",ref:"different-project",exp:Math.floor(Date.now()/1000)+120};
  Object.assign(process.env,{VERCEL_ENV:"preview",NEXT_PUBLIC_SUPABASE_URL:qaProject,OBSERVER_QA_INSTALLATION_PROOF:"1",
    SUPABASE_SERVICE_ROLE_KEY:"fixture."+Buffer.from(JSON.stringify(claims)).toString("base64url")+".fixture"});
  t.after(()=>delete process.env.SUPABASE_SERVICE_ROLE_KEY);
  let calls=0;t.mock.method(global,"fetch",async()=>{calls++;return Response.json(null);});
  assert.equal(await reader.readPrivateWindow(),null);assert.equal(calls,0);
});
