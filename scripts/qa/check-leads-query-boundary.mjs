import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const sources={leads:readFileSync("app/dashboard/admin/leads/page.tsx","utf8"),join:readFileSync("app/dashboard/admin/join-requests/page.tsx","utf8")};
const component=readFileSync("components/admin-leads-manager.tsx","utf8");
let networkCalls=0;
function noNetwork(){networkCalls++;throw Error("NETWORK_FORBIDDEN");}
function load(source,require){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,fetch:noNetwork,console:{warn(){}},Date,Intl});return exports;}
const safe=load(readFileSync("lib/admin-safe.ts","utf8"),()=>{throw Error("unexpected import");});
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
const manager=load(component,id=>{if(id==="react")return {useState:x=>[typeof x==="function"?x():x,()=>{throw Error("state action forbidden");}]};if(id==="react/jsx-runtime")return jsx;if(id==="next/link")return {__esModule:true,default:"Link"};throw Error("unexpected import "+id);});
const fixtures=[[{id:"l",lead_type:"garden",garden_name:"SYNTHETIC_LEAD",status:"new",email:"SYNTHETIC_LEAD_CONTACT"}],[{id:"g",name:"SYNTHETIC_GARDEN",approval_flow_status:"pending_final_admin_approval",email:"SYNTHETIC_GARDEN_CONTACT"}]];
function render(tree){const nodes=[],strings=[];function walk(v){if(Array.isArray(v))return v.forEach(walk);if(typeof v==="string")return strings.push(v);if(v&&typeof v==="object"){if(typeof v.type==="function")return walk(v.type(v.props??{}));nodes.push(v);walk(v.props?.children);}}walk(tree);return {nodes,strings};}
async function run(route,{fail=[],stale=true,deny=false,thrown=false,reject=false,empty=false}={}){
 let calls=0,clients=0,admissions=0,managerProps;const denied=Error("DENIED");networkCalls=0;
 const client={from(table){const index=calls++;assert.equal(table,index===0?"leads":"gardens");const b={};for(const n of ["select","order","limit","in"])b[n]=()=>b;b.then=(ok,bad)=>(reject&&index===0?Promise.reject(Error("PRIVATE_ERROR")):Promise.resolve({data:empty?[]:fail.includes(index)&&!stale?null:fixtures[index],error:fail.includes(index)?{message:"PRIVATE_ERROR"}:null})).then(ok,bad);return b;}};
 const req=id=>{if(id==="react/jsx-runtime")return jsx;if(id.endsWith("/dashboard-shell"))return {DashboardShell:"DashboardShell"};if(id.endsWith("/admin-leads-manager"))return {AdminLeadsManager:props=>{managerProps=props;return manager.AdminLeadsManager(props);}};if(id.endsWith("/admin-data-state"))return {AdminDataError:"AdminDataError"};if(id.endsWith("/premium-dashboard"))return {PremiumDashboardHero:"PremiumDashboardHero"};if(id.endsWith("/auth"))return {requireRole:async roles=>{admissions++;assert.deepEqual(Array.from(roles),["admin"]);if(deny)throw denied;}};if(id.endsWith("/supabase/server"))return {createClient:async()=>{clients++;if(thrown)throw Error("PRIVATE_ERROR");return client;}};if(id.endsWith("/admin-safe"))return safe;throw Error("unexpected import "+id);};
 let tree;try{tree=await load(sources[route],req).default();}catch(e){if(!deny)throw e;assert.equal(e,denied);assert.equal(clients,0);assert.equal(calls,0);assert.equal(networkCalls,0);return {denied:true};}
 const result=render(tree);assert.equal(admissions,1);assert.equal(calls,thrown?0:route==="leads"?2:1);assert.equal(networkCalls,0);
 return {...result,managerProps,banner:result.nodes.find(n=>n.type==="AdminDataError")?.props.message};
}
const count=(r,s)=>r.strings.filter(x=>x===s).length;
for(const stale of [false,true])for(const index of [0,1])test("leads source "+index+" failed stale="+stale,async()=>{
 const r=await run("leads",{fail:[index],stale});assert.ok(r.banner);assert.equal(count(r,"הנתונים אינם זמינים כרגע"),index===0?5:7);assert.ok(!r.strings.includes("PRIVATE_ERROR"));
 if(index===0){assert.equal(r.managerProps.leads.length,0);assert.ok(!r.strings.includes("SYNTHETIC_LEAD"));assert.ok(!r.strings.includes("המרה לרישום גן"));assert.ok(r.strings.includes("SYNTHETIC_GARDEN"));assert.ok(r.strings.includes("אישור למנוי"));}
 else{assert.equal(r.managerProps.gardens.length,0);assert.ok(!r.strings.includes("SYNTHETIC_GARDEN"));assert.ok(!r.strings.includes("אישור למנוי"));assert.ok(r.strings.includes("SYNTHETIC_LEAD"));assert.ok(r.strings.includes("המרה לרישום גן"));}
 assert.ok(r.nodes.some(n=>n.type==="button"&&typeof n.props.onClick==="function"));
});
test("both sources fail closed without stale controls",async()=>{const r=await run("leads",{fail:[0,1]});assert.ok(r.banner);assert.equal(count(r,"הנתונים אינם זמינים כרגע"),12);assert.ok(!r.nodes.some(n=>n.type==="button"));assert.equal(r.managerProps.leads.length,0);assert.equal(r.managerProps.gardens.length,0);});
for(const stale of [false,true])test("join requests failed source stale="+stale,async()=>{const r=await run("join",{fail:[0],stale});assert.ok(r.banner);assert.equal(r.managerProps.leads.length,0);assert.equal(count(r,"הנתונים אינם זמינים כרגע"),5);assert.equal(count(r,"אין פריטים כרגע"),7);assert.ok(!r.strings.includes("המרה לרישום גן"));assert.equal("gardensAvailable" in r.managerProps,false);});
test("direct caller cannot render stale rows when unavailable",()=>{networkCalls=0;const r=render(manager.AdminLeadsManager({leads:fixtures[0],gardens:fixtures[1],leadsAvailable:false,gardensAvailable:false}));assert.equal(count(r,"הנתונים אינם זמינים כרגע"),12);assert.ok(!r.nodes.some(n=>n.type==="button"));assert.ok(!r.strings.includes("SYNTHETIC_LEAD_CONTACT"));assert.ok(!r.strings.includes("SYNTHETIC_GARDEN_CONTACT"));assert.equal(networkCalls,0);});
test("healthy and legacy callers retain controls and empty behavior",async()=>{const r=await run("leads");assert.ok(!r.banner);assert.ok(r.strings.includes("המרה לרישום גן"));assert.ok(r.strings.includes("אישור למנוי"));assert.ok(r.nodes.filter(n=>n.type==="button").every(n=>typeof n.props.onClick==="function"));const empty=await run("leads",{empty:true});assert.equal(count(empty,"אין פריטים כרגע"),12);networkCalls=0;const legacy=render(manager.AdminLeadsManager({leads:fixtures[0]}));assert.ok(legacy.strings.includes("המרה לרישום גן"));assert.equal(count(legacy,"אין פריטים כרגע"),11);assert.equal(networkCalls,0);});
for(const route of ["leads","join"])test(route+" loader throw/reject and denied role",async()=>{for(const option of [{thrown:true},{reject:true}]){const r=await run(route,option);assert.ok(r.banner);assert.equal(count(r,"הנתונים אינם זמינים כרגע"),route==="leads"?12:5);assert.ok(!r.nodes.some(n=>n.type==="button"));}assert.ok((await run(route,{deny:true})).denied);});
test("exact query and action implementation contracts and one hook",()=>{
 const hash=s=>createHash("sha256").update(s).digest("hex");
 const originalQuery=sources.leads.replace(', "payment_pending"])', '])');
 assert.notEqual(originalQuery,sources.leads);
 assert.equal(hash((originalQuery.match(/supabase\s*\.from\([\s\S]*?\.limit\(\d+\)/g)||[]).join("\n")),"6c73436a09a7921d2d1a4b0e9d657272f6339bab46d1b397d416519040b2f898");
 assert.equal(hash((sources.join.match(/supabase\s*\.from\([\s\S]*?\.limit\(\d+\)/g)||[]).join("\n")),"41334d68b783761c241db5c1b4496aa1b162ad511da095824ebb9aa08c531650");
 const oldButton='<button className="button primary" disabled={Boolean(busy)} onClick={() => act("activate_after_payment", "הגן הופעל אחרי תשלום/override")}>הפעלה אחרי תשלום</button>';
 const newLink='<Link className="button secondary" href="/dashboard/admin/billing" prefetch={false}>מעבר לחיוב</Link>';
 const actionSpan=component.slice(component.indexOf("async function postAction"),component.indexOf("function FlowSection"));
 assert.ok(actionSpan.includes(newLink));assert.ok(!actionSpan.includes(oldButton));
 assert.equal(hash(actionSpan.replace(newLink,oldButton)),"d6228d02f5cac4fa2479c1289f6e076fd688e6655e9f9383cf3c5ad1d41647c3");
 const config=JSON.parse(readFileSync("config/digital-observer-ci-gates.json","utf8"));assert.deepEqual(config.domain.filter(x=>x.name==="leads-query-boundary").map(x=>x.args),[["--test","scripts/qa/check-leads-query-boundary.mjs"]]);
});
