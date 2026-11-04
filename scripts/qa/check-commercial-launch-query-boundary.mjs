import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const source=readFileSync("app/dashboard/admin/commercial-launch/page.tsx","utf8");
const tables=Array.from(source.matchAll(/supabase\.from\("([^"]+)"/g),m=>m[1]);
let network=0;
function load(s,require){const exports={};vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,console:{warn(){}},Date,Intl,fetch(){network++;throw Error("NETWORK_FORBIDDEN");}});return exports;}
const safe=load(readFileSync("lib/admin-safe.ts","utf8"),()=>{throw Error("unexpected import");});
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
const fixtures=tables.map((_,i)=>[{id:"s"+i,title:"ROW_"+i,package_name:"ROW_"+i,kindergarten_name:"ROW_"+i,customer_name:"ROW_"+i,handoff_key:"ROW_"+i,known_risks:"ROW_"+i,status:"open",stage:"qualified",commercial_readiness_score:95,base_price_nis:12345,additional_class_price_nis:2468,estimated_monthly_revenue_nis:1200,estimated_annual_revenue_nis:14400,probability:50,projected_mrr_nis:900,current_mrr_nis:300,current_arr_nis:3600,projected_arr_nis:10800,pipeline_value_nis:18000,average_revenue_per_kindergarten_nis:1234,average_classes_per_kindergarten:3,renewal_risk_level:"high",risk_level:"high"}]);fixtures[0][0].status="commercial_ready";fixtures[19][0].status="completed";
async function run({fail=[],reject=-1,thrown=false,deny=false,data=fixtures}={}){
 let calls=0,clients=0,admissions=0;network=0;const denied=Error("DENIED");
 const client={from(table){const i=calls++;assert.equal(table,tables[i]);const b={};for(const m of ["select","eq","order","limit"])b[m]=()=>b;b.then=(ok,bad)=>(i===reject?Promise.reject(Error("PRIVATE_ERROR")):Promise.resolve({data:data[i],error:fail.includes(i)?{message:"PRIVATE_ERROR"}:null})).then(ok,bad);return b;}};
 const req=id=>{if(id==="react/jsx-runtime")return jsx;if(id==="next/link")return {__esModule:true,default:"Link"};if(id==="lucide-react")return new Proxy({},{get:(_,k)=>"Icon:"+String(k)});if(id.endsWith("/dashboard-shell"))return {DashboardShell:"DashboardShell"};if(id.endsWith("/premium-dashboard"))return new Proxy({},{get:(_,k)=>String(k)});if(id.endsWith("/admin-data-state"))return {AdminDataError:"AdminDataError"};if(id.endsWith("/admin-safe"))return safe;if(id.endsWith("/auth"))return {requireRole:async roles=>{admissions++;assert.deepEqual(Array.from(roles),["admin"]);if(deny)throw denied;}};if(id.endsWith("/supabase/server"))return {createClient:async()=>{clients++;if(thrown)throw Error("PRIVATE_ERROR");return client;}};throw Error("unexpected import "+id);};
 let tree;try{tree=await load(source,req).default();}catch(e){if(!deny)throw e;assert.equal(e,denied);assert.equal(clients,0);assert.equal(calls,0);return {denied:true};}
 const nodes=[],strings=[];function walk(v){if(Array.isArray(v))return v.forEach(walk);if(typeof v==="string")return strings.push(v);if(v&&typeof v==="object"){nodes.push(v);walk(v.props?.children);}}walk(tree);function text(v){if(Array.isArray(v))return v.map(text).join("");if(typeof v==="string"||typeof v==="number")return String(v);return v&&typeof v==="object"?text(v.props?.children):"";}
 assert.equal(admissions,1);assert.equal(calls,thrown?0:20);assert.equal(network,0);
 return {nodes,strings,text,section:title=>nodes.find(n=>n.type==="CleanSection"&&n.props.title===title),metric:label=>nodes.filter(n=>n.type==="RoleMetricCard"&&n.props.label===label).map(n=>n.props),action:title=>nodes.find(n=>n.type==="ActionCard"&&n.props.title===title)?.props,banner:nodes.find(n=>n.type==="AdminDataError")?.props.message,hero:nodes.find(n=>n.type==="PremiumDashboardHero")?.props.badge};
}
for(let i=0;i<20;i++)test("source "+tables[i]+" errors and rejects are disclosed",async()=>{
 for(const opt of [{fail:[i]},{reject:i}]){const r=await run(opt);assert.ok(r.banner);assert.ok(!r.strings.some(x=>x.includes("PRIVATE_ERROR")));assert.ok(!r.strings.includes("ROW_"+i));}
});
test("readiness and pricing errors do not invent values",async()=>{
 let r=await run({fail:[0]});assert.equal(r.hero,"לא זמין");assert.equal(r.metric("Commercial score")[0].value,"לא זמין");assert.equal(r.metric("Commercial score")[0].hint,"לא זמין");
 r=await run({fail:[1]});assert.ok(r.text(r.section("Pricing Model Center")).includes("אינם זמינים"));assert.ok(!r.text(r.section("Pricing Model Center")).includes("800"));assert.ok(r.strings.includes("תמחור לא זמין"));
 const data=fixtures.map(x=>x.slice());data[0]=[{commercial_readiness_score:0}];data[1]=[];r=await run({data});assert.equal(r.hero,"0/100");assert.ok(r.text(r.section("Pricing Model Center")).includes("800"));
});
test("forecast actual fields, missing fallback and explicit failure",async()=>{
 let r=await run({fail:[16]});for(const x of r.metric("Projected MRR"))assert.equal(x.value,"לא זמין");assert.equal(r.metric("Current MRR")[0].value,"לא זמין");assert.equal(r.action("Projected MRR").text,"לא זמין");
 r=await run({fail:[3]});assert.ok(r.metric("Projected MRR")[0].value.includes("900"));assert.ok(r.metric("Projected ARR")[0].value.includes("10,800"));assert.ok(r.metric("Projected MRR")[0].hint.includes("18,000"));
 const data=fixtures.map(x=>x.slice());data[16]=[{}];r=await run({data});assert.ok(r.metric("Projected MRR")[0].value.includes("600"));r=await run({data,fail:[3]});assert.equal(r.metric("Projected MRR")[0].value,"לא זמין");assert.equal(r.metric("Projected ARR")[0].value,"לא זמין");assert.ok(r.metric("Projected MRR")[0].hint.includes("לא זמין"));assert.ok(r.metric("Current MRR")[0].value.includes("0"));
 data[16]=[];r=await run({data});assert.ok(r.metric("Projected MRR")[0].value.includes("600"));r=await run({data,fail:[3]});assert.equal(r.metric("Projected MRR")[0].value,"לא זמין");
});
test("mixed renewals preserve healthy side without partial total",async()=>{
 for(const i of [14,15]){const r=await run({fail:[i]});assert.equal(r.metric("Renewal risks")[0].value,"לא זמין");assert.equal(r.action("Renewal risk").text,"לא זמין");assert.ok(r.strings.includes("ROW_"+(i===14?15:14)));assert.ok(!r.nodes.some(n=>n.type==="EmptyState"&&n.props.title==="אין סיכוני חידוש פעילים"));}
 const r=await run({fail:[14,15]});assert.equal(r.metric("Renewal risks")[0].value,"לא זמין");
});
test("independent panels and action cards show unavailable",async()=>{
 for(const [i,title] of [[2,"Package Positioning"],[3,"Sales Opportunity Dashboard"],[9,"Customer Success Handoff"],[18,"Onboarding & Sales Tasks"],[19,"Commercial Launch Checklist"]]){const r=await run({fail:[i]});assert.ok(r.text(r.section(title)).includes("אינם זמינים"),title);}
 for(const [i,title] of [[10,"Collateral"],[11,"Demo scripts"],[12,"Objections"],[13,"Referral readiness"],[18,"Follow-up today"]])assert.equal((await run({fail:[i]})).action(title).text,"לא זמין");
 for(const i of [4,5,6,7]){const r=await run({fail:[i]});assert.ok(r.text(r.section("Demo / Proposal / Contract")).includes("לא זמין"));assert.ok(r.text(r.section("Demo / Proposal / Contract")).includes("legal review required")||i===6);}
 const r=await run({fail:[17]});assert.ok(r.text(r.section("Revenue Forecasting")).includes("לא זמין"));assert.ok(r.metric("Projected MRR")[0].value.includes("900"));
});
test("all errors, healthy empty, whole loader and role denial",async()=>{
 let r=await run({fail:Array.from({length:20},(_,i)=>i)});assert.ok(r.banner);assert.equal(r.hero,"לא זמין");assert.equal(r.metric("Pipeline active")[0].value,"לא זמין");assert.equal(r.metric("Launch checklist")[0].value,"לא זמין");
 r=await run({data:fixtures.map(()=>[])});assert.ok(!r.banner);assert.equal(r.hero,"0/100");assert.equal(r.metric("Pipeline active")[0].value,0);assert.ok(r.nodes.some(n=>n.type==="EmptyState"&&n.props.title==="אין סיכוני חידוש פעילים"));
 r=await run({thrown:true});assert.ok(r.banner);assert.equal(r.hero,"לא זמין");assert.equal(r.metric("Projected MRR")[0].value,"לא זמין");assert.ok((await run({deny:true})).denied);
});
test("20 exact query chains, formula helpers, links and one hook remain",()=>{
 const hash=s=>createHash("sha256").update(s).digest("hex");const lines=source.split("\n").filter(s=>s.includes("safeQuery<Row>("));assert.equal(lines.length,20);assert.equal(hash(lines.join("\n")+"\n"),"52bccda4559fe7493e05207c3fdce2369f0846bed092b77e4d277f6ff751c726");assert.equal(hash(source.slice(source.indexOf("function money("),source.indexOf("export default async function"))),"f47300d3c9227fa2e6de92343788235ee35492aeb9618898c5e1d5176ad8e911");
 assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g),m=>m[1]),["/dashboard/admin/growth","/dashboard/admin/customer-success","/dashboard/admin/docs/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM","/dashboard/admin/docs/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM","/dashboard/admin/docs/COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM","/dashboard/admin/growth","/dashboard/admin/commercial-launch","/dashboard/admin/billing","/dashboard/admin/customer-success","/dashboard/admin/growth","/dashboard/admin/billing","/dashboard/admin/legal-review"]);
 const cfg=JSON.parse(readFileSync("config/digital-observer-ci-gates.json","utf8"));assert.deepEqual(cfg.domain.filter(x=>x.name==="commercial-launch-query-boundary").map(x=>x.args),[["--test","scripts/qa/check-commercial-launch-query-boundary.mjs"]]);
});
