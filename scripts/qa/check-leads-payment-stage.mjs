import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";

const page=readFileSync("app/dashboard/admin/leads/page.tsx","utf8");
const component=readFileSync("components/admin-leads-manager.tsx","utf8");
const api=readFileSync("app/api/admin/kindergarten-approval/route.ts","utf8");
const original=["credentials_sent","onboarding_in_progress","onboarding_submitted","pending_final_approval","correction_required","active","suspended","archived","lead_approved_credentials_sent","profile_incomplete","pending_final_admin_approval"];
let calls=0,fetchCalls=0;
const noNetwork=()=>{fetchCalls++;throw Error("NETWORK_FORBIDDEN");};
function load(source,require){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,fetch:noNetwork,console:{warn(){}},Date,Intl});return exports;}
const safe=load(readFileSync("lib/admin-safe.ts","utf8"),()=>{throw Error("unexpected import");});
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
const manager=load(component,id=>{if(id==="react")return {useState:x=>[x,()=>{throw Error("state mutation forbidden");}]};if(id==="react/jsx-runtime")return jsx;if(id==="next/link")return {__esModule:true,default:"Link"};throw Error("unexpected import "+id);});
const leads=[{id:"l",lead_type:"garden",garden_name:"SYNTHETIC_LEAD",status:"new"}];
const gardens=[{id:"g",name:"SYNTHETIC_PENDING",approval_flow_status:"payment_pending"}];
function render(tree){const nodes=[],strings=[];function walk(v){if(Array.isArray(v))return v.forEach(walk);if(typeof v==="string")return strings.push(v);if(v&&typeof v==="object"){if(typeof v.type==="function")return walk(v.type(v.props??{}));nodes.push(v);walk(v.props?.children);}}walk(tree);return {nodes,strings};}
async function run({failGarden=false}={}){
 calls=0;fetchCalls=0;let allowed;
 const client={from(table){const i=calls++;assert.equal(table,i===0?"leads":"gardens");const b={};for(const method of ["select","order","limit"])b[method]=()=>b;b.in=(field,values)=>{assert.equal(field,"approval_flow_status");allowed=Array.from(values);return b;};b.then=(ok,bad)=>Promise.resolve({data:i===0?leads:gardens.filter(g=>allowed.includes(g.approval_flow_status)),error:i===1&&failGarden?{message:"PRIVATE_ERROR"}:null}).then(ok,bad);return b;}};
 const req=id=>{if(id==="react/jsx-runtime")return jsx;if(id.endsWith("/dashboard-shell"))return {DashboardShell:"DashboardShell"};if(id.endsWith("/admin-leads-manager"))return manager;if(id.endsWith("/admin-data-state"))return {AdminDataError:"AdminDataError"};if(id.endsWith("/premium-dashboard"))return {PremiumDashboardHero:"PremiumDashboardHero"};if(id.endsWith("/auth"))return {requireRole:async roles=>assert.deepEqual(Array.from(roles),["admin"])};if(id.endsWith("/supabase/server"))return {createClient:async()=>client};if(id.endsWith("/admin-safe"))return safe;throw Error("unexpected import "+id);};
 const r=render(await load(page,req).default());assert.equal(calls,2);assert.equal(fetchCalls,0);return {...r,allowed};
}
test("actual API contract transitions to pending and does not support the old action",()=>{
 const start=api.indexOf('if (payload.action === "approve_final_profile")');assert.ok(start>=0);const end=api.indexOf('if (payload.action === "request_corrections")',start);assert.ok(end>start);assert.ok(api.slice(start,end).includes('approval_flow_status: "payment_pending"'));
 const enumText=api.match(/action: z\.enum\(\[([^\]]+)\]/);assert.ok(enumText);assert.ok(!JSON.parse("["+enumText[1]+"]").includes("activate_after_payment"));
});
test("real page filter preserves every prior status and includes pending exactly once",async()=>{
 const r=await run();assert.deepEqual(r.allowed,[...original,"payment_pending"]);assert.equal(r.strings.filter(x=>x==="SYNTHETIC_PENDING").length,1);assert.ok(r.strings.includes("ממתינים למנוי או לתשלום"));assert.ok(r.strings.includes("אושר וממתין למנוי"));
 const links=r.nodes.filter(n=>n.type==="Link"&&n.props.href==="/dashboard/admin/billing");assert.equal(links.length,1);assert.equal(links[0].props.prefetch,false);assert.ok(!r.strings.includes("הפעלה אחרי תשלום"));assert.ok(r.strings.includes("המרה לרישום גן"));assert.ok(!component.includes('act("activate_after_payment"'));
});
test("failed garden source suppresses stale pending and its billing link, preserving leads",async()=>{
 const r=await run({failGarden:true});assert.ok(!r.strings.includes("SYNTHETIC_PENDING"));assert.equal(r.nodes.filter(n=>n.type==="Link"&&n.props.href==="/dashboard/admin/billing").length,0);assert.ok(r.strings.includes("המרה לרישום גן"));assert.equal(r.strings.filter(x=>x==="הנתונים אינם זמינים כרגע").length,7);assert.equal(fetchCalls,0);
});
test("direct fallback status works once and unavailable direct props cannot show billing",()=>{
 fetchCalls=0;let r=render(manager.AdminLeadsManager({leads:[],gardens:[{id:"g",name:"FALLBACK_PENDING",status:"payment_pending"}]}));assert.equal(r.strings.filter(x=>x==="FALLBACK_PENDING").length,1);assert.equal(r.nodes.filter(n=>n.type==="Link"&&n.props.href==="/dashboard/admin/billing").length,1);
 r=render(manager.AdminLeadsManager({leads,gardens,gardensAvailable:false}));assert.ok(!r.strings.includes("SYNTHETIC_PENDING"));assert.equal(r.nodes.filter(n=>n.type==="Link"&&n.props.href==="/dashboard/admin/billing").length,0);assert.ok(r.strings.includes("המרה לרישום גן"));assert.equal(fetchCalls,0);
});
test("new hook is unique and previous boundary hook remains",()=>{
 const cfg=JSON.parse(readFileSync("config/digital-observer-ci-gates.json","utf8"));assert.deepEqual(cfg.domain.filter(x=>x.name==="leads-payment-stage").map(x=>x.args),[["--test","scripts/qa/check-leads-payment-stage.mjs"]]);assert.deepEqual(cfg.domain.filter(x=>x.name==="leads-query-boundary").map(x=>x.args),[["--test","scripts/qa/check-leads-query-boundary.mjs"]]);
});
