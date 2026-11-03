import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const source=readFileSync("app/dashboard/admin/billing/page.tsx","utf8");
const tables=Array.from(source.matchAll(/supabase\.from\("([^"]+)"/g),x=>x[1]);
let fetchCalls=0;
function load(s,require){const exports={};vm.runInNewContext(ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require,console:{warn(){}},Date,Intl,fetch(){fetchCalls++;throw Error("NETWORK_FORBIDDEN");}});return exports;}
const safe=load(readFileSync("lib/admin-safe.ts","utf8"),()=>{throw Error("unexpected import");});
const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
const fixtures=tables.map((_,i)=>[{id:"s"+i,name:"ROW_"+i,title:"ROW_"+i,company_name:"ROW_"+i,account_name:"ROW_"+i,provider_name:"ROW_"+i,code:"ROW_"+i,explanation:"ROW_"+i,invoice_number:"ROW_"+i,amount:100+i,currency:"ILS",status:"active",gardens:{name:"ROW_"+i},subscription_plans:{name:"PLAN_JOIN",monthly_price:120},billing_cycle:"monthly",billing_status:"failed",gateway_status:"failed",mrr:777}]);
fixtures[17][0].status="verified";fixtures[19][0].status="paid";
async function run({fail=[],data=fixtures,deny=false,thrown=false,reject=false}={}){
 let calls=0,clients=0,admissions=0;fetchCalls=0;const denied=Error("DENIED");
 const client={from(table){const i=calls++;assert.equal(table,tables[i]);const b={};for(const n of ["select","order","limit"])b[n]=()=>b;b.then=(ok,bad)=>(reject&&i===0?Promise.reject(Error("PRIVATE_ERROR")):Promise.resolve({data:data[i],error:fail.includes(i)?{message:"PRIVATE_ERROR"}:null})).then(ok,bad);return b;}};
 const req=id=>{if(id==="react/jsx-runtime")return jsx;if(id==="next/link")return {__esModule:true,default:"Link"};if(id==="lucide-react")return new Proxy({},{get:(_,k)=>"Icon:"+String(k)});if(id.endsWith("/dashboard-shell"))return {DashboardShell:"DashboardShell"};if(id.endsWith("/premium-dashboard"))return new Proxy({},{get:(_,k)=>String(k)});if(id.endsWith("/admin-data-state"))return {AdminDataError:"AdminDataError"};if(id.endsWith("/auth"))return {requireRole:async roles=>{admissions++;assert.deepEqual(Array.from(roles),["admin"]);if(deny)throw denied;}};if(id.endsWith("/supabase/server"))return {createClient:async()=>{clients++;if(thrown)throw Error("PRIVATE_ERROR");return client;}};if(id.endsWith("/admin-safe"))return safe;throw Error("unexpected import "+id);};
 let tree;try{tree=await load(source,req).default();}catch(e){if(!deny)throw e;assert.equal(e,denied);assert.equal(clients,0);assert.equal(calls,0);return {denied:true};}
 const nodes=[],strings=[];function walk(v){if(Array.isArray(v))return v.forEach(walk);if(typeof v==="string")return strings.push(v);if(v&&typeof v==="object"){nodes.push(v);walk(v.props?.children);}}walk(tree);
 function text(v){if(Array.isArray(v))return v.map(text).join("");if(typeof v==="string"||typeof v==="number")return String(v);return v&&typeof v==="object"?text(v.props?.children):"";}
 assert.equal(admissions,1);assert.equal(calls,thrown?0:22);assert.equal(fetchCalls,0);
 const section=title=>nodes.find(n=>n.type==="CleanSection"&&n.props.title===title);
 return {nodes,strings,text,section,metric:label=>nodes.find(n=>n.type==="RoleMetricCard"&&n.props.label===label)?.props,banner:nodes.find(n=>n.type==="AdminDataError")?.props.message,hero:nodes.find(n=>n.type==="PremiumDashboardHero")?.props.badge};
}
for(let i=0;i<22;i++)test("error "+tables[i]+" produces safe banner",async()=>{const r=await run({fail:[i]});assert.ok(r.banner);assert.ok(!r.strings.some(s=>s.includes("PRIVATE_ERROR")));});
test("failed subscriptions cannot appear as zero while healthy snapshot survives",async()=>{
 const r=await run({fail:[0]});for(const label of ["MRR","ARR","לקוחות פעילים","חידושים קרובים"])assert.equal(r.metric(label).value,"לא זמין");assert.equal(r.hero,"לא זמין");assert.notEqual(r.metric("לקוחות פעילים").tone,"good");assert.ok(r.metric("MRR").hint.includes("777"));assert.ok(r.text(r.section("מנויי גנים")).includes("הנתונים אינם זמינים"));assert.ok(!r.strings.includes("ROW_0"));assert.equal(r.metric("תשלום נכשל").value,1);
});
test("plan failure does not suppress joined subscription values",async()=>{const r=await run({fail:[1]});assert.ok(r.metric("MRR").value.includes("120"));assert.ok(r.strings.includes("PLAN_JOIN"));assert.ok(r.text(r.section("תוכניות")).includes("אינם זמינים"));assert.equal(r.nodes.find(n=>n.type==="ActionCard"&&n.props.title==="תוכניות מנוי").props.tone,"warn");});
test("snapshot failure and successful missing fallback are distinct",async()=>{
 let r=await run({fail:[14]});assert.equal(r.metric("MRR").hint,"Snapshot: לא זמין");assert.ok(r.metric("MRR").value.includes("120"));
 const data=fixtures.map(x=>x.slice());data[14]=[];r=await run({data});assert.ok(r.metric("MRR").hint.includes("120"));r=await run({data,fail:[0]});assert.equal(r.metric("MRR").hint,"Snapshot: לא זמין");
});
test("failed payments and retry hint are independent",async()=>{
 let r=await run({fail:[2]});assert.equal(r.metric("תשלום נכשל").value,"לא זמין");assert.notEqual(r.metric("תשלום נכשל").tone,"good");assert.equal(r.nodes.find(n=>n.type==="ActionCard"&&n.props.title==="כשלי גבייה").props.tone,"warn");assert.ok(r.text(r.section("תשלומים שנכשלו")).includes("אינם זמינים"));assert.ok(!r.nodes.some(n=>n.type==="EmptyState"&&n.props.title==="אין כשלי תשלום פתוחים"));assert.ok(!r.strings.includes("ROW_2"));
 r=await run({fail:[8]});assert.equal(r.metric("תשלום נכשל").value,1);assert.equal(r.metric("תשלום נכשל").hint,"ניסיונות חוזרים: לא זמין");
});
test("all direct source sections suppress stale rows and empty claims",async()=>{
 for(const [i,title] of [[0,"מנויי גנים"],[1,"תוכניות"],[2,"תשלומים שנכשלו"],[3,"חשבוניות וקבלות"],[5,"תזכורות וחידושים"],[6,"ספקי תשלום"],[7,"הגדרות חברה"],[10,"הודעות חיוב"],[11,"Audit פיננסי"],[12,"החזרות וזיכויים"],[13,"רשתות גנים"],[16,"תובנות פיננסיות"],[20,"קודי הנחה"]]) {const r=await run({fail:[i]});assert.ok(r.text(r.section(title)).includes("הנתונים אינם זמינים"),title);assert.ok(!r.text(r.section(title)).includes("ROW_"+i),title);}
});
test("mixed sections preserve healthy values and mark only failing dependencies",async()=>{
 for(const [i,title] of [[4,"Jobs וייצוא"],[9,"Jobs וייצוא"],[12,"Jobs וייצוא"],[15,"Jobs וייצוא"],[17,"יעדי תשלום גנים"],[18,"תשלומי הורים"],[19,"תשלומי הורים"],[21,"הפרדת הכנסות"],[3,"הכנסות"]]) {const r=await run({fail:[i]});assert.ok(r.text(r.section(title)).includes("לא זמין"),title);if(i!==17)assert.ok(r.text(r.section(title)).includes("1")||r.text(r.section(title)).includes("120")||r.text(r.section(title)).includes("440"),title);}
 const r=await run({fail:[3,19]});assert.ok(r.text(r.section("הכנסות")).includes("לא זמין"));assert.ok(r.text(r.section("הכנסות")).includes("120"));assert.ok(r.text(r.section("תשלומי הורים")).includes("לא זמין"));assert.ok(r.text(r.section("תשלומי הורים")).includes("1"));
});
test("healthy empty, loader failure and denied admission remain distinct",async()=>{
 const empty=fixtures.map(()=>[]);const ok=await run({data:empty});assert.ok(!ok.banner);assert.ok(ok.nodes.some(n=>n.type==="EmptyState"&&n.props.title==="אין כשלי תשלום פתוחים"));assert.equal(ok.metric("תשלום נכשל").value,0);
 for(const opt of [{thrown:true},{reject:true}]){const r=await run(opt);assert.ok(r.banner);assert.equal(r.hero,"לא זמין");assert.equal(r.metric("תשלום נכשל").value,"לא זמין");assert.notEqual(r.metric("תשלום נכשל").tone,"good");assert.ok(!r.nodes.some(n=>n.type==="EmptyState"&&n.props.title==="אין כשלי תשלום פתוחים"));}
 assert.ok((await run({deny:true})).denied);
});
test("22 exact queries, original links and one CI hook remain",()=>{assert.equal(tables.length,22);const lines=source.split("\n").filter(s=>s.includes("supabase.from("));assert.equal(createHash("sha256").update(lines.join("\n")+"\n").digest("hex"),"d29fa9a71f2296718758e84306d223b4d6d868d630d4cbcd4b918651f4d605e3");assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g),m=>m[1]),["/dashboard/admin/subscriptions","/dashboard/admin/billing#plans","/dashboard/admin/billing#gateways","/dashboard/admin/billing#invoices","/dashboard/admin/billing#recovery","/dashboard/admin/subscriptions","/dashboard/admin/communications","/dashboard/admin/integrations","/dashboard/admin/audit-logs"]);const cfg=JSON.parse(readFileSync("config/digital-observer-ci-gates.json","utf8"));assert.deepEqual(cfg.domain.filter(x=>x.name==="billing-query-boundary").map(x=>x.args),[["--test","scripts/qa/check-billing-query-boundary.mjs"]]);});
