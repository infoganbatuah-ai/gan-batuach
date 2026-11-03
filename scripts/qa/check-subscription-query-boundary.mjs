import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const page=readFileSync("app/dashboard/admin/subscriptions/page.tsx","utf8");
const component=readFileSync("components/subscription-admin-manager.tsx","utf8");
const panelSource=readFileSync("components/collapsible-action-panel.tsx","utf8");
const tables=["kindergarten_subscriptions","subscription_plans","gardens","subscription_payments"];
const fixtures=[[{id:"s",status:"active",gardens:{name:"STALE_SUBSCRIPTION"},subscription_plans:{name:"JOIN_PLAN"}}],[{id:"p",name:"STALE_PLAN",plan_type:"annual",active:true,version:1}],[{id:"g",name:"STALE_GARDEN",city:"CITY"}],[{billing_status:"failed"}]];
let fetchCalls=0;
function forbidden(){throw Error("ACTION_FORBIDDEN");}
function noNetwork(){fetchCalls++;throw Error("NETWORK_FORBIDDEN");}
function load(source,require){const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,fetch:noNetwork,console:{warn(){}},Date,Intl});return exports;}
const safe=load(readFileSync("lib/admin-safe.ts","utf8"),()=>{throw Error("unexpected import");});
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};const icons=new Proxy({},{get:(_,k)=>"Icon:"+String(k)});
async function run({fail=[],stale=true,empty=false,deny=false,thrown=false,reject=false,open=true,direct=null}={}){
 let calls=0,clients=0,admissions=0;fetchCalls=0;const denied=Error("DENIED");
 const panel=load(panelSource,id=>{if(id==="react")return {useState:x=>[open?true:x,forbidden]};if(id==="react/jsx-runtime")return jsx;if(id==="lucide-react")return icons;throw Error("unexpected panel import");});
 const manager=load(component,id=>{if(id==="react")return {useState:x=>[typeof x==="function"?x():x,forbidden]};if(id==="react/jsx-runtime")return jsx;if(id==="next/navigation")return {useRouter:()=>({refresh:forbidden})};if(id==="lucide-react")return icons;if(id.endsWith("/collapsible-action-panel"))return panel;throw Error("unexpected manager import "+id);});
 const client={from(table){const i=calls++;assert.equal(table,tables[i]);const b={};for(const n of ["select","order","limit"])b[n]=()=>b;b.then=(ok,bad)=>(reject&&i===0?Promise.reject(Error("PRIVATE_ERROR")):Promise.resolve({data:empty?[]:fail.includes(i)&&!stale?null:fixtures[i],error:fail.includes(i)?{message:"PRIVATE_ERROR"}:null})).then(ok,bad);return b;}};
 const req=id=>{if(id==="react/jsx-runtime")return jsx;if(id==="lucide-react")return icons;if(id.endsWith("/admin-app-ui"))return {AdminAppFrame:"AdminAppFrame"};if(id.endsWith("/finance-platform-ui"))return new Proxy({},{get:(_,k)=>String(k)});if(id.endsWith("/subscription-admin-manager"))return manager;if(id.endsWith("/admin-data-state"))return {AdminDataError:"AdminDataError"};if(id.endsWith("/auth"))return {requireRole:async roles=>{admissions++;assert.deepEqual(Array.from(roles),["admin"]);if(deny)throw denied;return {profile:{id:"admin",role:"admin"}};}};if(id.endsWith("/supabase/server"))return {createClient:async()=>{clients++;if(thrown)throw Error("PRIVATE_ERROR");return client;}};if(id.endsWith("/admin-safe"))return safe;throw Error("unexpected page import "+id);};
 let tree;try{tree=direct?{type:manager.SubscriptionAdminManager,props:{subscriptions:fixtures[0],plans:fixtures[1],gardens:fixtures[2],payments:fixtures[3],...direct}}:await load(page,req).default();}catch(e){if(!deny)throw e;assert.equal(e,denied);assert.equal(calls,0);assert.equal(clients,0);return {denied:true};}
 const nodes=[],strings=[],inputs=[];function walk(v){if(Array.isArray(v))return v.forEach(walk);if(typeof v==="string")return strings.push(v);if(v&&typeof v==="object"){if(typeof v.type==="function"){if(v.type===manager.SubscriptionAdminManager)inputs.push(v.props);return walk(v.type(v.props??{}));}nodes.push(v);walk(v.props?.children);}}walk(tree);assert.equal(admissions,direct?0:1);assert.equal(calls,direct||thrown?0:4);assert.equal(fetchCalls,0);
 return {nodes,strings,inputs,metric:label=>nodes.find(n=>n.type==="FinanceMetric"&&n.props.label===label)?.props,banner:nodes.find(n=>n.type==="AdminDataError")?.props.message,forms:nodes.filter(n=>n.type==="form"),options:nodes.filter(n=>n.type==="option").map(n=>n.props.value)};
}
for(const stale of [false,true])for(let i=0;i<4;i++)test("source "+tables[i]+" error stale="+stale,async()=>{
 const r=await run({fail:[i],stale});assert.ok(r.banner);assert.ok(!r.strings.some(x=>x.includes("PRIVATE_ERROR")));assert.equal(r.inputs[0][["subscriptions","plans","gardens","payments"][i]].length,0);
 if(i===0){assert.equal(r.metric("מנויים פעילים").value,"לא זמין");assert.notEqual(r.metric("מנויים פעילים").tone,"green");assert.ok(!r.strings.includes("STALE_SUBSCRIPTION"));assert.ok(!r.strings.includes("אין עדיין מנויים"));assert.equal(r.forms.length,2);}
 if(i===1){assert.equal(r.forms.length,0);assert.ok(!r.options.includes("p"));assert.equal(r.metric("מנויים פעילים").value,1);}
 if(i===2){assert.equal(r.forms.length,1);assert.ok(!r.options.includes("g"));assert.ok(r.options.includes("p"));assert.equal(r.metric("מנויים פעילים").value,1);}
 if(i===3){assert.equal(r.metric("תשלומים שנכשלו").value,"לא זמין");assert.notEqual(r.metric("תשלומים שנכשלו").tone,"green");assert.ok(r.strings.some(x=>x.includes("נתוני התשלומים אינם זמינים")));assert.equal(r.forms.length,2);}
});
test("combined errors do not invalidate independent sources",async()=>{
 let r=await run({fail:[0,3]});assert.equal(r.forms.length,2);assert.equal(r.metric("מנויים פעילים").value,"לא זמין");assert.equal(r.metric("תשלומים שנכשלו").value,"לא זמין");
 r=await run({fail:[1,2]});assert.equal(r.forms.length,0);assert.equal(r.metric("מנויים פעילים").value,1);assert.equal(r.metric("תשלומים שנכשלו").value,1);
});
test("direct stale props fail closed and healthy default caller remains compatible",async()=>{
 let r=await run({direct:{subscriptionsAvailable:false,plansAvailable:false,gardensAvailable:false,paymentsAvailable:false}});assert.equal(r.forms.length,0);assert.ok(!r.strings.includes("STALE_SUBSCRIPTION"));assert.ok(!r.options.includes("p"));assert.ok(!r.options.includes("g"));assert.ok(r.strings.some(x=>x.includes("נתוני התשלומים אינם זמינים")));
 r=await run({direct:{}});assert.equal(r.forms.length,2);assert.ok(r.strings.includes("STALE_SUBSCRIPTION"));assert.ok(r.options.includes("p"));assert.ok(r.options.includes("g"));
});
test("healthy empty and closed panel keep original behavior",async()=>{
 let r=await run({empty:true});assert.ok(!r.banner);assert.equal(r.forms.length,2);assert.ok(r.strings.includes("אין עדיין מנויים"));assert.ok(!r.options.includes("p"));assert.ok(!r.options.includes("g"));
 r=await run({open:false});assert.equal(r.forms.length,0);assert.ok(r.strings.includes("STALE_SUBSCRIPTION"));
});
test("whole loader fails closed and denied admission creates no client",async()=>{
 for(const opt of [{thrown:true},{reject:true}]){const r=await run(opt);assert.ok(r.banner);assert.equal(r.forms.length,0);assert.equal(r.metric("מנויים פעילים").value,"לא זמין");assert.equal(r.metric("תשלומים שנכשלו").value,"לא זמין");}assert.ok((await run({deny:true})).denied);
});
test("exact query, action functions, garden export and hook remain",()=>{
 const hash=s=>createHash("sha256").update(s).digest("hex");const lines=page.split("\n").filter(s=>s.includes("supabase.from("));assert.equal(lines.length,4);assert.equal(hash(lines.join("\n")+"\n"),"f938d45f09a403a196771206aac4b286bac80e2e0108f7b883cdad2fe81777a8");
 for(const [a,b,expected] of [["async function postJson","export type SubscriptionPlanSummary","37cb4e86db0d6782fb9b6bbae997ae272ada84af653fae06838ed30f18ed0950"],["  async function savePlan","  return (","6c5758e97d06717b270b967b2b55c8e0762df214acf6df3391005daef4de2edf"],["export function GardenSubscriptionActions",null,"ee3449ea393574615010087433f34a844f4991fc29a36228f13cbb4c2554a852"]])assert.equal(hash(component.slice(component.indexOf(a),b?component.indexOf(b,component.indexOf(a)):undefined)),expected);
 assert.deepEqual((component.match(/<form className="card form wizard-form"[\s\S]*?<\/form>/g)||[]).map(hash),["7031cfecc40b8d127b2a4aea2653bb74918f16bbb57d89305e384a13c82c26ec","d87ff850a880a1fe64b7147f0d4fe13817df4d3eb0793b8a4e7217b8028cb8df"]);
 assert.ok(page.includes('export const dynamic = "force-dynamic"'));const cfg=JSON.parse(readFileSync("config/digital-observer-ci-gates.json","utf8"));assert.deepEqual(cfg.domain.filter(x=>x.name==="subscription-query-boundary").map(x=>x.args),[["--test","scripts/qa/check-subscription-query-boundary.mjs"]]);
});
