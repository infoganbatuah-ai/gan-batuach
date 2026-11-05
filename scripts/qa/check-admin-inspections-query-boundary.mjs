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
const pageCode = compile(source("app/dashboard/admin/inspections/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }




const fields="id, garden_id, inspector_id, status, completed_at, weighted_score, violation_count, critical_failures, gps_verified, gardens(name, city), inspectors:inspector_id(full_name)";
const expected=[["select",fields],["order","created_at",{ascending:false}],["limit",120]];
const fixtures=[
 {id:"SYNTHETIC_I0",garden_id:"SYNTHETIC_G0",status:"done",gardens:{name:"SYNTHETIC_GARDEN0",city:"SYNTHETIC_CITY"},inspectors:{full_name:"SYNTHETIC_INSPECTOR"},weighted_score:0,violation_count:0,gps_verified:false,critical_failures:"SYNTHETIC_UNUSED_CRITICAL",completed_at:"SYNTHETIC_UNUSED_COMPLETED"},
 {id:"SYNTHETIC_I1",garden_id:"SYNTHETIC_G1",status:"open",gardens:null,inspectors:null,weighted_score:null,violation_count:null,gps_verified:true}
];
async function page({failure=null,data=fixtures,nullData=false,loader=false,deny=false}={}){
 let clients=0,helperCalls=0,captured;const chains=[],warnings=[],actual=load(helperCode,unexpected,warnings);
 const helper={...actual,safeAdminData:async(...a)=>{helperCalls++;assert.equal(a[0],"admin inspections overview");captured=await actual.safeAdminData(...a);return captured;}};
 const client={from(table){assert.equal(chains.length,0);assert.equal(table,"inspections");const calls=[],q={};chains.push([table,calls]);if(failure?.kind==="factory")throw Error("PRIVATE_FACTORY");for(const m of ["select","order","limit"])q[m]=(...a)=>{calls.push([m,...a]);return q;};q.then=(a,b)=>(failure?.kind==="reject"?Promise.reject(Error("PRIVATE_SENTINEL")):Promise.resolve({data:nullData?null:failure&&!failure.stale?[]:data,error:failure?{message:"PRIVATE_SENTINEL",details:"PRIVATE_DETAILS"}:null})).then(a,b);return q;}};
 const p=load(pageCode,id=>{
  if(id==="react/jsx-runtime")return{jsx,jsxs:jsx};if(id==="next/link")return{__esModule:true,default:"Link"};
  if(id==="@/components/dashboard-shell")return{DashboardShell:"DashboardShell"};if(id==="@/components/admin-data-state")return{AdminDataError:"AdminDataError"};
  if(id==="@/lib/admin-safe")return helper;
  if(id==="@/lib/auth")return{requireRole:async roles=>{assert.deepEqual(Array.from(roles),["admin"]);assert.equal(clients,0);assert.equal(helperCalls,0);assert.equal(chains.length,0);if(deny)throw Error("DENIED");return{profile:{id:"SYNTHETIC_PROFILE",role:"admin"}};}};
  if(id==="@/lib/supabase/server")return{createClient:async()=>{clients++;if(loader)throw Error("PRIVATE_LOADER");return client;}};
  return unexpected(id);
 },warnings);
 if(deny){await assert.rejects(p.default(),/DENIED/);assert.equal(clients,0);assert.equal(helperCalls,0);assert.equal(chains.length,0);return;}
 const tree=await p.default(),shell=nodes(tree,"DashboardShell")[0];assert.equal(shell.props.role,"admin");assert.equal(shell.props.title,"ביקורות");assert.equal(helperCalls,1);
 assert.equal(nodes(tree,"form").length,0);assert.equal(nodes(tree,"button").length,0);assert.ok(!JSON.stringify([tree,warnings]).includes("PRIVATE_"));assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_UNUSED_"));
 return{tree,text:text(tree),clients,chains,warnings,data:captured.data,rows:nodes(tree,"article"),links:nodes(tree,"Link").map(n=>n.props),banner:nodes(tree,"AdminDataError")[0].props.message};
}
const nav=[
 {className:"button secondary",href:"/dashboard/admin/inspections/due",children:"בקרוב"},
 {className:"button secondary",href:"/dashboard/admin/inspections/late",children:"באיחור"},
 {className:"button primary",href:"/dashboard/admin/inspection-forms",children:"בונה טפסים"}
];
function staticUI(r){
 assert.deepEqual(plain(r.links.slice(0,3)),nav);
 const filter=nodes(r.tree,"section").find(n=>n.props.className==="filter-bar");
 assert.deepEqual(plain(nodes(filter,"input").map(n=>n.props)),[{placeholder:"חיפוש גן / פקח"}]);
 assert.deepEqual(nodes(filter,"option").map(text),["כל הסטטוסים","open","done","late"]);
 assert.ok(r.text.includes("עד 120 ביקורות הפיקוח האחרונות, לפי הרשומות שנטענו."));
}
function query(r,factory=false){assert.equal(r.clients,1);assert.deepEqual(plain(r.chains),[["inspections",factory?[]:expected]]);staticUI(r);}
function unavailable(r){
 assert.equal(r.data.available,false);assert.deepEqual(Array.from(r.data.rows),[]);assert.equal(r.rows.length,0);assert.ok(r.banner);
 assert.ok(r.text.includes("נתוני הביקורות אינם זמינים"));assert.ok(!r.text.includes("אין ביקורות במערכת"));
 assert.deepEqual(plain(r.links),nav);assert.ok(!r.text.includes("SYNTHETIC_I"));assert.ok(!r.text.includes("SYNTHETIC_GARDEN"));assert.ok(!r.text.includes("ציון "));assert.ok(!r.text.includes("GPS "));
 const state=nodes(r.tree,"div").find(n=>n.props["aria-label"]==="נתוני ביקורות לא זמינים");assert.ok(state);assert.equal(state.props.className,"card");assert.equal(state.props.role,"status");staticUI(r);
}
test("healthy actualpage/sharedsafehelper exactsinglechain allrows/nav/fields retained",async()=>{const r=await page();query(r);assert.equal(r.data.available,true);assert.equal(r.banner,null);assert.deepEqual(r.rows.map(n=>n.key),fixtures.map(v=>v.id));assert.deepEqual(r.links.slice(3).map(v=>v.href),fixtures.flatMap(v=>[`/dashboard/admin/inspections/${v.id}/report`,`/dashboard/admin/gardens/${v.garden_id}`]));assert.equal(nodes(r.rows[0],"span")[0].props.className,"pill good");assert.equal(nodes(r.rows[1],"span")[0].props.className,"pill warn");assert.ok(text(r.rows[0]).includes("ציון 0 · ליקויים 0 · GPS לא אומת"));assert.ok(text(r.rows[1]).includes("ציון - · ליקויים 0 · GPS אומת"));});
for(const kind of ["returned","reject"])for(const stale of [false,true])test(`query ${kind}/${stale?"stale":"empty"} unknown notordinaryempty/stalelinks`,async()=>{const r=await page({failure:{kind,stale}});query(r);unavailable(r);assert.deepEqual(plain(r.warnings),[[kind==="returned"?"Admin Supabase query unavailable:":"Admin page data unavailable:","admin inspections overview"]]);});
test("factorythrow oneattempt/onegenericprivate-log/unknown",async()=>{const r=await page({failure:{kind:"factory"}});query(r,true);unavailable(r);assert.deepEqual(plain(r.warnings),[["Admin page data unavailable:","admin inspections overview"]]);});
test("clientloader zeroquery safeunknown and denied0clients/queries/helper",async()=>{const r=await page({loader:true});assert.equal(r.clients,1);assert.equal(r.chains.length,0);unavailable(r);assert.deepEqual(plain(r.warnings),[["Admin page data unavailable:","admin inspections overview"]]);await page({deny:true});});
for(const nullData of [false,true])test(`healthy${nullData?"null":"empty"} legitimateoriginalemptystate noerror`,async()=>{const r=await page({data:[],nullData});query(r);assert.equal(r.data.available,true);assert.equal(r.banner,null);assert.equal(r.rows.length,0);assert.ok(r.text.includes("אין ביקורות במערכת"));assert.ok(r.text.includes("ביקורות חודשיות או ביקורת ראשונה יופיעו כאן לאחר יצירת משימות פיקוח."));assert.ok(!r.text.includes("נתוני הביקורות אינם זמינים"));assert.deepEqual(plain(r.links),nav);assert.equal(r.warnings.length,0);});
for(const [value,flag]of [[false,"לא אומת"],[0,"לא אומת"],["","לא אומת"],[null,"לא אומת"],[undefined,"לא אומת"],[true,"אומת"],["false","אומת"],[[],"אומת"]])test(`gpsrecord rawTRUTHY ${typeof value}/${String(value)} notphysicalproof`,async()=>{const r=await page({data:[{...fixtures[0],gps_verified:value}]});assert.ok(text(nodes(r.rows[0],"small")[0]).endsWith(`GPS ${flag}`));});
for(const [status,tone]of [["done","good"],["open","warn"],["late","warn"],["DONE","warn"],["","warn"],[null,"warn"],[{toString:()=>"done"},"warn"]])test(`status STRICTdone ${typeof status}/${String(status)} rawdisplay/tone`,async()=>{const r=await page({data:[{...fixtures[0],status}]});const badge=nodes(r.rows[0],"span")[0];assert.equal(badge.props.className,`pill ${tone}`);assert.equal(badge.props.children,status);});
test("NULLISH nottruthy relations/name/city/inspector/score/violations preserved",async()=>{
 const data=[{...fixtures[0],gardens:{name:"",city:""},inspectors:{full_name:""},weighted_score:"",violation_count:""},{...fixtures[1],gardens:{name:null,city:null},inspectors:{full_name:null},weighted_score:0,violation_count:0}];
 const r=await page({data});assert.equal(text(nodes(r.rows[0],"h3")[0]),"");assert.equal(text(nodes(r.rows[0],"p")[0])," · פקח: ");assert.ok(text(nodes(r.rows[0],"small")[0]).startsWith("ציון  · ליקויים  · "));
 assert.equal(text(nodes(r.rows[1],"h3")[0]),"SYNTHETIC_G1");assert.equal(text(nodes(r.rows[1],"p")[0])," · פקח: -");assert.ok(text(nodes(r.rows[1],"small")[0]).startsWith("ציון 0 · ליקויים 0 · "));
});
test("rawnumericstring scores/counts plusempty articlekey preserved no normalization",async()=>{const r=await page({data:[{...fixtures[0],id:"",weighted_score:"085.50",violation_count:"00",garden_id:""}]});assert.equal(r.rows[0].key,"");assert.ok(text(r.rows[0]).includes("ציון 085.50 · ליקויים 00"));assert.equal(r.links[3].href,"/dashboard/admin/inspections//report");assert.equal(r.links[4].href,"/dashboard/admin/gardens/");});
test("querylimit120 exact WITHOUT newlocal slice/reorder/filter, IDsoriginal order",async()=>{const data=Array.from({length:125},(_,i)=>({...fixtures[0],id:`SYNTHETIC_I${i}`,garden_id:`SYNTHETIC_G${i}`}));const r=await page({data});query(r);assert.deepEqual(r.rows.map(n=>n.key),data.map(v=>v.id));assert.equal(r.links.length,3+2*125);});
test("selectedcritical/completed remainUNUSED no newUI/metrics",async()=>{const r=await page({data:[{...fixtures[0],critical_failures:"SYNTHETIC_UNUSED_CRITICAL",completed_at:"SYNTHETIC_UNUSED_COMPLETED"}]});assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_UNUSED_"));assert.equal(nodes(r.tree,"MetricCard").length,0);});
test("oneDOMAINhook no unrelatedsecurityhook",()=>{const c=JSON.parse(source("config/digital-observer-ci-gates.json")),name="admin-inspections-query-boundary";assert.deepEqual(c.domain.filter(v=>v.name===name),[{name,args:["--test","scripts/qa/check-admin-inspections-query-boundary.mjs"]}]);assert.equal(c.security.filter(v=>v.name===name).length,0);});
