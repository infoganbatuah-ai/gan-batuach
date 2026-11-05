import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual readonly page/shared loader, synthetic technical readiness records ONLY.
// Not a catalog, RLS, migration, storage, QA-resource or live security test.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const full = path.join(root, p); fs.statSync(full); return fs.readFileSync(full, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/system-health/page.tsx")) + "\nexports.qaFormatters={stateTone,stateLabel};";
const helperCode = compile(source("lib/admin-safe.ts"));
const metricCode = compile(source("components/gan-batuach-design-system.tsx"));
const truthCode = compile(source("components/platform-admin-ui.tsx"));
const statusCode = compile(source("lib/ui/canonical-status.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const ordered = (field, ascending) => ascending === undefined ? ["order", field] : ["order", field, { ascending }];



const financialPaths=["financial-provider-capability","financial-provider-policy","provider-integration-safety"];
const financialCode=Object.fromEntries(financialPaths.map(n=>["@/lib/domain/"+n,compile(source("lib/domain/"+n+".ts"))]));
const financialModules={};
function financialModule(id){assert.ok(Object.hasOwn(financialCode,id));return financialModules[id]??=(load(financialCode[id],financialModule));}
const inventory=[
 ["gardens","gardens","id,status,manager_id,inspector_id,inspection_required_status",[],500],
 ["communication_delivery_logs","delivery","id,status,channel",[ordered("created_at",false)],500],
 ["camera_streams","cameras","id,status,health_status",[],500],
 ["documents","documents","id,status",[],500],
 ["provider_production_health_metrics","providerHealth","integration_type,provider_status,last_successful_request_at",[],120],
 ["production_integrations","integrations","integration_type,status,production_verified_at",[],120]
];
const expected=inventory.map(([table,,projection,calls,limit])=>[table,[["select",projection],...calls,["limit",limit]]]);
const types=["email","storage","camera_gateway"];
const fixtures=[
 [{manager_id:"SYNTHETIC_MANAGER",inspector_id:"SYNTHETIC_INSPECTOR"},{manager_id:null,inspector_id:"SYNTHETIC_INSPECTOR"},{manager_id:"SYNTHETIC_MANAGER",inspector_id:"SYNTHETIC_INSPECTOR",inspection_required_status:"pending_first_inspection"}],
 ["failed","bounced","delivered"].map(status=>({status})),
 [{status:"offline"},{status:"active",health_status:"degraded"},{status:"active",health_status:"healthy"}],
 ["expired","approved","missing"].map(status=>({status})),
 types.map(integration_type=>({integration_type,provider_status:"healthy",last_successful_request_at:"SYNTHETIC_TIMESTAMP"})),
 types.map(integration_type=>({integration_type,status:"production_active",production_verified_at:"SYNTHETIC_VERIFIED_RECORD"}))
];
const profile={id:"SYNTHETIC_PROFILE",role:"admin"};
async function page({failures={},data=fixtures,empty=false,nullData=false,loader=false,deny=false}={}){
 let clients=0,financialCalls=0,authorized=false,captured,financial;
 const chains=[],warnings=[],actual=load(helperCode,unexpected,warnings);
 const helper={...actual,safeAdminData:async(...a)=>{captured=await actual.safeAdminData(...a);return captured;}};
 const client={from(table){
  const i=chains.length,calls=[],q={};assert.equal(table,expected[i]?.[0]);chains.push([table,calls]);
  if(failures[i]?.kind==="factory")throw Error("PRIVATE_FACTORY");
  for(const m of ["select","order","limit"])q[m]=(...a)=>{calls.push([m,...a]);return q;};
  q.then=(a,b)=>{assert.equal(chains.length,6,"one concurrent batch");const f=failures[i];return(f?.kind==="reject"?Promise.reject(Error("PRIVATE_SENTINEL")):Promise.resolve({data:nullData?null:empty||f&&!f.stale?[]:data[i],error:f?{message:"PRIVATE_SENTINEL"}:null})).then(a,b);};return q;
 }};
 const p=load(pageCode,id=>{
  if(id==="react/jsx-runtime")return{jsx,jsxs:jsx};
  if(id==="next/link")return{__esModule:true,default:"Link"};
  if(id==="lucide-react"||id.startsWith("@/components/"))return new Proxy({},{get:(_,k)=>String(k)});
  if(id==="@/lib/admin-safe")return helper;
  if(id==="@/lib/auth")return{requireRole:async roles=>{assert.deepEqual(Array.from(roles),["admin"]);assert.equal(clients,0);assert.equal(financialCalls,0);assert.equal(chains.length,0);if(deny)throw Error("DENIED");authorized=true;return{profile};}};
  if(id==="@/lib/domain/financial-provider-capability")return{getFinancialProviderCapabilities:()=>{assert.ok(authorized);assert.equal(clients,0);financialCalls++;financial=financialModule(id).getFinancialProviderCapabilities();return financial;}};
  if(id==="@/lib/supabase/server")return{createClient:async()=>{assert.equal(financialCalls,1);clients++;if(loader)throw Error("PRIVATE_LOADER");return client;}};
  return unexpected(id);
 },warnings);
 if(deny){await assert.rejects(p.default(),/DENIED/);assert.equal(clients,0);assert.equal(financialCalls,0);assert.equal(chains.length,0);return;}
 const tree=await p.default(),frame=nodes(tree,"AdminAppFrame")[0];assert.equal(frame.props.profile,profile);assert.equal(frame.props.activeHref,"/dashboard/admin/system-health");assert.equal(frame.props.title,"מצב מערכת");assert.equal(nodes(tree,"form").length,0);assert.equal(financialCalls,1);
 const services=nodes(tree,"AdminTruthState").map(n=>({key:n.key,...n.props,chip:nodes(n.props.title,"StatusChip")[0].props}));
 return{tree,text:text(tree),frame:frame.props,clients,financialCalls,financial,chains,warnings,data:captured.data,formatters:p.qaFormatters,banner:nodes(tree,"AdminDataError")[0].props.message,metrics:nodes(tree,"MetricCard").map(n=>n.props),services};
}
const hrefs=["/dashboard/admin/provider-production","/dashboard/admin","/dashboard/admin/database-integrity","/dashboard/admin/provider-production","/dashboard/admin/subscriptions","/dashboard/admin/document-center","/dashboard/admin/provider-production"];
const names=["יישום","מסד נתונים","התראות ותקשורת","תשלומים","מסמכים ואחסון","מצלמות / Digital Observer"];
const labels={operational:"תפעולי",degraded:"מוגבל",setup_required:"נדרשת הגדרה",unavailable:"לא זמין"};
const tones={operational:"good",degraded:"warning",setup_required:"warning",unavailable:"danger"};
function states(r,expectedStates){
 assert.deepEqual(r.services.map(s=>s.key),names);
 assert.deepEqual(r.services.map(s=>s.chip.children),expectedStates.map(s=>s===null?"לא ידוע":labels[s]));
 assert.deepEqual(r.services.map(s=>s.tone),expectedStates.map(s=>s===null?"neutral":tones[s]));
 assert.deepEqual(r.services.map(s=>s.chip.tone),expectedStates.map(s=>s===null?"default":s==="operational"?"success":s==="unavailable"?"danger":"warning"));
 const known=expectedStates.every(s=>s!==null),totals=["operational","degraded","unavailable"].map(s=>expectedStates.filter(x=>x===s).length);
 assert.deepEqual(r.metrics.slice(0,3).map(m=>m.value),known?totals:Array(3).fill("לא זמין"));
 assert.deepEqual(r.metrics.slice(0,3).map(m=>m.tone),known?["success",totals[1]?"warning":"success",totals[2]?"danger":"success"]:Array(3).fill("default"));
 assert.equal(r.frame.badge,known?totals[2]?`${totals[2]} לא זמינים`:totals[1]?`${totals[1]} מוגבלים`:"בדיקת שירות":"מצב חלקי — נתונים חסרים");
}
function contracts(r,factory){
 assert.equal(r.clients,1);assert.deepEqual(plain(r.chains),expected.map(([t,c],i)=>[t,i===factory?[]:c]));
 assert.ok(!JSON.stringify([r.tree,r.warnings]).includes("PRIVATE_"));assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_TIMESTAMP"));assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_VERIFIED_RECORD"));
 assert.deepEqual(nodes(r.tree,"Link").map(n=>n.props.href),hrefs);assert.ok(r.frame.subtitle.includes("רשומות מצב ומוכנות בלבד"));assert.ok(r.frame.subtitle.includes("לא בדיקת ספק חיה"));assert.equal(r.financial.payment.checkoutAvailable,false);assert.equal(r.financial.payment.liveChargesEnabled,false);
 assert.equal(r.services[0].text,"מסך האדמין עבר אימות הרשאה בצד השרת ונענה לבקשה הנוכחית.");assert.equal(r.services[3].text,"אין יכולת checkout מאומתת.");
}
function dependencies(r,failed=[],loader=false){
 const known=i=>!failed.includes(i);assert.deepEqual(Array.from(r.data.available),[0,1,2,3,4,5].map(known));
 states(r,["operational",loader?null:failed.length?"degraded":"operational",known(1)?"degraded":null,"setup_required",known(4)&&known(5)?"operational":null,known(2)?"degraded":null]);
 assert.equal(r.metrics[3].value,known(0)?2:"לא זמין");assert.equal(r.metrics[3].tone,known(0)?"warning":"default");
 assert.ok(r.services[2].text.startsWith(known(1)?"2 כשלים":"לא זמין כשלים"));assert.ok(r.services[4].text.startsWith(known(3)?"2 מסמכים":"לא זמין מסמכים"));assert.ok(r.services[5].text.startsWith(known(2)?"2 מקורות":"לא זמין מקורות"));
 if(!known(4)||!known(5))for(const i of [2,4,5])assert.ok(r.services[i].text.includes("מצב הספק לא ידוע"));
 for(const i of failed)assert.deepEqual(Array.from(r.data[inventory[i][1]]),[]);
}
function providerData(status="healthy",verified="SYNTHETIC_VERIFIED_RECORD"){const d=structuredClone(fixtures);d[1]=[];d[2]=[];d[4]=types.map(integration_type=>({integration_type,provider_status:status}));d[5]=types.map(integration_type=>({integration_type,status:"production_active",production_verified_at:verified}));return d;}

test("healthy actualpage+financial actualpuremodules emptyenv exact6chains/profile/state/counts",async()=>{const r=await page();contracts(r);dependencies(r);assert.equal(r.banner,null);});
for(let i=0;i<6;i++)for(const kind of ["returned","reject"])for(const stale of [false,true])test(`source${i} ${kind}/${stale?"stale":"empty"} independent states/counts`,async()=>{const r=await page({failures:{[i]:{kind,stale}}});contracts(r);dependencies(r,[i]);assert.ok(r.banner);assert.deepEqual(plain(r.warnings),[["Admin Supabase query unavailable:",`platform service status ${i}`]]);});
for(let i=0;i<6;i++)test(`source${i} factorythrow once contained and neighborspreserved`,async()=>{const r=await page({failures:{[i]:{kind:"factory"}}});contracts(r,i);dependencies(r,[i]);assert.equal(r.warnings.length,1);});
for(const failed of [[0,3],[1,2],[1,4],[2,5],[3,4],[4,5],[0,1,2,3,4,5]])test(`paired${failed} states independent and summaries exact`,async()=>{const r=await page({failures:Object.fromEntries(failed.map(i=>[i,{kind:i%2?"reject":"returned",stale:true}]))});contracts(r);dependencies(r,failed);});
test("loader UNKNOWNdatabase notqueriescompleted, app/paymentindependent, deny0clients/financial",async()=>{const r=await page({loader:true});dependencies(r,[0,1,2,3,4,5],true);assert.equal(r.chains.length,0);assert.equal(r.data.batchLoaded,false);assert.ok(!r.services[1].text.includes("הושלמו"));assert.ok(r.banner);assert.ok(!JSON.stringify([r.tree,r.warnings]).includes("PRIVATE_"));await page({deny:true});});
for(const nullData of [false,true])test(`healthy${nullData?"null":"empty"} originalsetuprequired/no inventedproviderfailure`,async()=>{const r=await page({empty:true,nullData});contracts(r);states(r,["operational","operational","setup_required","setup_required","setup_required","setup_required"]);assert.equal(r.metrics[3].value,0);assert.equal(r.metrics[3].tone,"success");assert.equal(r.banner,null);for(const i of [2,4,5])assert.ok(r.services[i].text.startsWith("0 "));});
for(const [status,expected] of [["failed","unavailable"],["offline","unavailable"],["unavailable","unavailable"],["degraded","degraded"],["warning","degraded"],["pending","degraded"],["healthy","operational"],["operational","operational"],["active","operational"],["production_active","operational"],["","setup_required"],["OTHER","setup_required"],[null,"operational"],[undefined,"operational"]])test(`knownprovider status${status} exactoriginal${expected}`,async()=>{const r=await page({data:providerData(status)});states(r,["operational","operational",expected,"setup_required",expected,expected]);});
test("healthyempty providerhealth + verifiedactiveintegration is OPERATIONAL",async()=>{const data=providerData();data[4]=[];const r=await page({data});states(r,["operational","operational","operational","setup_required","operational","operational"]);});
for(const [status,expected] of [["failed","unavailable"],["offline","unavailable"],["unavailable","unavailable"],["degraded","degraded"],["warning","degraded"],["pending","degraded"],["","setup_required"],["OTHER","setup_required"],["healthy",null],["operational",null],["active",null],["production_active",null],[null,null]])test(`missingintegration health${status} decisive${expected}`,async()=>{const r=await page({data:providerData(status),failures:{5:{kind:"reject",stale:true}}});states(r,["operational","degraded",expected,"setup_required",expected,expected]);});
test("missinghealth cannottrust knownnegativeintegration alone",async()=>{const data=providerData();data[5].forEach(x=>x.status="failed");const r=await page({data,failures:{4:{kind:"returned",stale:true}}});states(r,["operational","degraded",null,"setup_required",null,null]);});
for(const local of ["positive","zero","unknown"])for(const provider of ["operational","degraded","unavailable","unknown"])for(const index of [1,2])test(`issueprecedence source${index} ${local} vsprovider${provider}`,async()=>{
 const data=providerData(provider==="unknown"?"healthy":provider),failures={};if(local==="positive")data[index]=[index===1?{status:"failed"}:{status:"offline"}];if(local==="unknown")failures[index]={kind:"returned",stale:true};if(provider==="unknown")failures[5]={kind:"reject",stale:true};
 const r=await page({data,failures}),service=r.services[index===1?2:5];
 const state=local==="positive"?"degraded":local==="unknown"?provider==="degraded"?"degraded":null:provider==="unknown"?null:provider;
 assert.equal(service.chip.children,state===null?"לא ידוע":labels[state]);assert.equal(service.tone,state===null?"neutral":tones[state]);assert.ok(service.text.startsWith(local==="unknown"?"לא זמין ":local==="positive"?"1 ":"0 "));
 if(provider==="unknown")assert.ok(service.text.includes("מצב הספק לא ידוע"));
});
test("ALLderivedstates known despite missingcount when knownproviderdegraded; exacttotals retained",async()=>{const data=providerData("degraded"),r=await page({data,failures:{1:{kind:"reject"},2:{kind:"returned"},3:{kind:"reject"},5:{kind:"reject"}}});states(r,["operational","degraded","degraded","setup_required","degraded","degraded"]);assert.deepEqual(r.metrics.slice(0,3).map(m=>m.value),[1,4,0]);});
test("firstSTRICTtype row / firstintegration / emptydoesnotfallback / nullfallback / TRUTHYverification",async()=>{
 const data=providerData();data[4]=[{integration_type:{toString:()=>"storage"},provider_status:"failed"},{integration_type:"storage",provider_status:""},{integration_type:"storage",provider_status:"failed"}];let r=await page({data});assert.equal(r.services[4].chip.children,"נדרשת הגדרה");
 data[4]=[{integration_type:"storage",provider_status:null}];data[5]=[{integration_type:"storage",status:"production_active",production_verified_at:""},{integration_type:"storage",status:"production_active",production_verified_at:"SYNTHETIC_VERIFIED_RECORD"}];r=await page({data});assert.equal(r.services[4].chip.children,"נדרשת הגדרה");
 data[5][0].production_verified_at="false";r=await page({data});assert.equal(r.services[4].chip.children,"תפעולי");
 data[4][0].provider_status={toString:()=>"warning"};r=await page({data});assert.equal(r.services[4].chip.children,"מוגבל");
});
test("original issuepredicates Stringstatus/health vs STRICTpending and rawTRUTHYassignments",async()=>{
 const data=structuredClone(fixtures);data[0]=[{manager_id:"m",inspector_id:"i",inspection_required_status:{toString:()=>"pending_first_inspection"}},{manager_id:"",inspector_id:"i"},{manager_id:"m",inspector_id:null},{manager_id:"m",inspector_id:"i",inspection_required_status:"pending_first_inspection"}];
 data[1]=[{status:"FAILED"},{status:{toString:()=>"BOUNCED"}},{status:"unfailed"},{status:"delivered"}];
 data[2]=[{status:"OFFLINE"},{status:{toString:()=>"offline"}},{status:"active",health_status:{toString:()=>"unhealthy"}},{status:"active",health_status:"OFFLINE"}];
 data[3]=[{status:{toString:()=>"missing"}},{status:"REJECTED"},{status:"replacement_required"},{status:"expired"}];
 const r=await page({data});assert.equal(r.metrics[3].value,3);assert.ok(r.services[2].text.startsWith("3 "));assert.ok(r.services[5].text.startsWith("2 "));assert.ok(r.services[4].text.startsWith("3 "));
});
test("irrelevantgarden/docsfailure retains exactsummary with independentknownproviderstates",async()=>{const r=await page({failures:{0:{kind:"returned"},3:{kind:"reject"}}});states(r,["operational","degraded","degraded","setup_required","operational","degraded"]);assert.equal(r.metrics[3].value,"לא זמין");assert.ok(r.services[4].text.startsWith("לא זמין "));assert.deepEqual(r.metrics.slice(0,3).map(m=>m.value),[2,3,0]);});
test("actualfinancial emptyenv unchanged no livecapabilities across allsourcefailures",async()=>{const a=await page(),b=await page({failures:Object.fromEntries([0,1,2,3,4,5].map(i=>[i,{kind:"reject"}]))});assert.deepEqual(plain(a.financial),plain(b.financial));assert.equal(a.financial.payment.requestedMode,"disabled");assert.equal(a.financial.payment.providerAdapterVerified,false);assert.equal(a.financial.payment.webhookVerified,false);assert.equal(a.financial.payment.checkoutAvailable,false);assert.equal(b.services[3].chip.children,"נדרשת הגדרה");});
test("actualMetricCard/TruthState/StatusChip UNKNOWN rendersneutral notdanger/success",async()=>{
 const r=await page({loader:true}),canonical=load(statusCode,unexpected),common=id=>{if(id==="react/jsx-runtime")return{jsx,jsxs:jsx};if(id==="next/link")return{__esModule:true,default:"Link"};if(id==="react")return{useId:()=>unexpected("useId")};if(id==="lucide-react")return new Proxy({},{get:(_,k)=>String(k)});if(id==="@/lib/ui/canonical-status")return canonical;if(id==="@/components/global-state-system")return{GlobalStatePanel:()=>unexpected("GlobalStatePanel")};return unexpected(id);};
 const actual=load(metricCode,common),truth=load(truthCode,common);
 function expand(n){if(Array.isArray(n))return n.map(expand);if(!n||typeof n!=="object")return n;if(typeof n.type==="function")return expand(n.type(n.props));return{...n,props:{...n.props,children:expand(n.props.children)}};}
 for(const m of r.metrics){assert.equal(m.tone,"default");const n=expand(actual.MetricCard(m));assert.ok(n.props.className.includes("gb-tone-default"));assert.ok(text(n).includes("לא זמין"));assert.ok(!text(n).includes("תקין"));}
 for(const s of r.services.filter(s=>s.tone==="neutral")){const n=truth.AdminTruthState(s);assert.equal(n.props.className,"platform-admin-truth state-neutral");const chip=actual.StatusChip(s.chip);assert.equal(chip.props.className,"gb-status-chip gb-tone-default");assert.equal(text(chip),"לא ידוע");}
});
test("statevocabulary helpers unchanged and oneDOMAINhook",async()=>{const f=(await page()).formatters;assert.deepEqual(plain(f.stateLabel),labels);for(const [s,t]of Object.entries(tones))assert.equal(f.stateTone(s),t);const c=JSON.parse(source("config/digital-observer-ci-gates.json")),name="system-health-query-boundary";assert.deepEqual(c.domain.filter(v=>v.name===name),[{name,args:["--test","scripts/qa/check-system-health-query-boundary.mjs"]}]);assert.equal(c.security.filter(v=>v.name===name).length,0);});
