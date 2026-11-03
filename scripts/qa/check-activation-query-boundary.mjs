import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import ts from "typescript";

function load(source, require) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX } }).outputText, {exports,require,console:{warn(){}},Date,Intl,fetch(){throw Error("network forbidden");}});
  return exports;
}
const safe=load(readFileSync("lib/admin-safe.ts","utf8"),()=>{throw Error("unexpected import");});
const domain=load(readFileSync("lib/domain/observer-calibration.ts","utf8"),()=>{throw Error("unexpected import");});
const source=readFileSync("app/dashboard/admin/kindergarten-activation/page.tsx","utf8");
const tables=["kindergarten_onboarding_records","gardens","kindergarten_subscriptions"];
const fixtures=[[{garden_id:"g",progress_percent:80,profile_data:{current_staff:2,required_staff:3,uploaded_document_categories:["one","two"]},subscription_monthly_amount:120}],[{id:"g",name:"SYNTHETIC_GARDEN",email:"SYNTHETIC_CONTACT",approval_flow_status:"admin_approved"}],[{garden_id:"g",status:"pending_payment"}]];
async function run({fail=[],data=fixtures,deny=false,thrown=false,reject=false}={}) {
  let clients=0,calls=0,admissions=0;
  const denied=Error("DENIED");
  const client={from(table){const index=calls++;assert.equal(table,tables[index]);const b={}; for(const name of ["select","order","limit"]) b[name]=()=>b; b.then=(ok,bad)=>(reject&&index===0?Promise.reject(Error("PRIVATE_ERROR")):Promise.resolve({data:data[index],error:fail.includes(index)?{message:"PRIVATE_ERROR"}:null})).then(ok,bad);return b;}};
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const require=id=>{
    if(id==="react/jsx-runtime")return jsx;
    if(id==="next/link")return {default:"Link"};
    if(id==="lucide-react")return new Proxy({},{get:()=>()=>null});
    if(id.endsWith("/dashboard-shell"))return {DashboardShell:"DashboardShell"};
    if(id.endsWith("/premium-dashboard"))return Object.fromEntries(["ActionCard","CleanSection","EmptyState","PremiumDashboardHero","RoleMetricCard","StatusBadge"].map(k=>[k,k]));
    if(id.endsWith("/admin-data-state"))return {AdminDataError:"AdminDataError"};
    if(id.endsWith("/auth"))return {requireRole:async roles=>{admissions++;assert.deepEqual(Array.from(roles),["admin"]);if(deny)throw denied;}};
    if(id.endsWith("/supabase/server"))return {createClient:async()=>{clients++;if(thrown)throw Error("PRIVATE_ERROR");return client;}};
    if(id.endsWith("/admin-safe"))return safe;
    if(id.endsWith("/domain/observer-calibration"))return domain;
    throw Error("unexpected import "+id);
  };
  let tree;
  try{tree=await load(source,require).default();}catch(e){if(!deny)throw e;assert.equal(e,denied);assert.equal(clients,0);assert.equal(calls,0);return {denied:true};}
  const nodes=[],strings=[];
  function walk(v){if(Array.isArray(v))return v.forEach(walk);if(typeof v==="string")strings.push(v);else if(v&&typeof v==="object"){nodes.push(v);walk(v.props?.children);}}
  walk(tree);
  function text(v){if(Array.isArray(v))return v.map(text).join("");if(typeof v==="string"||typeof v==="number")return String(v);return v&&typeof v==="object"?text(v.props?.children):"";}
  assert.equal(admissions,1);assert.equal(calls,thrown?0:3);
  return {nodes,strings,content:text(tree),metric:label=>nodes.find(n=>n.type==="RoleMetricCard"&&n.props.label===label)?.props,banner:nodes.find(n=>n.type==="AdminDataError")?.props.message,hero:nodes.find(n=>n.type==="PremiumDashboardHero")?.props.badge};
}
for(let i=0;i<3;i++)test("source "+tables[i]+" error is disclosed and stale rows suppressed",async()=>{
  const r=await run({fail:[i]});assert.ok(r.banner);assert.ok(!r.content.includes("PRIVATE_ERROR"));
  if(i===1){assert.ok(!r.content.includes("SYNTHETIC_GARDEN"));assert.ok(!r.content.includes("SYNTHETIC_CONTACT"));assert.ok(!r.nodes.some(n=>n.type==="EmptyState"));for(const label of ["בתהליך","פעילים","ממתינים לתשלום","התקדמות ממוצעת"])assert.equal(r.metric(label).value,"לא זמין");}
  else assert.ok(r.content.includes("SYNTHETIC_GARDEN"));
});
test("onboarding failure hides progress, staff, documents, amount and payment while preserving garden and payment count",async()=>{
 const r=await run({fail:[0]});assert.equal(r.hero,"לא זמין");assert.equal(r.metric("התקדמות ממוצעת").value,"לא זמין");assert.equal(r.metric("ממתינים לתשלום").value,1);for(const x of ["צוות: לא זמין","מסמכים: לא זמין","תשלום: לא זמין","מנוי: לא זמין"])assert.ok(r.content.includes(x));assert.ok(!r.content.includes("80%"));
});
test("subscription failure preserves progress and primary payment but does not infer payment count",async()=>{
 const data=fixtures.map(x=>x.map(y=>({...y})));data[0][0].payment_status="paid";
 const r=await run({fail:[2],data});assert.equal(r.hero,"80%");assert.equal(r.metric("ממתינים לתשלום").value,"לא זמין");assert.ok(r.content.includes("תשלום: paid"));assert.ok(r.content.includes("צוות: 2/3"));
});
test("payment fallback requires both relevant sources and respects nullish precedence",async()=>{
 for(const value of [null,undefined]){const data=fixtures.map(x=>x.map(y=>({...y})));data[0][0].payment_status=value;const good=await run({data});assert.ok(good.content.includes("תשלום: pending_payment"));const bad=await run({data,fail:[2]});assert.ok(bad.content.includes("תשלום: לא זמין"));assert.ok(!bad.content.includes("לא התחיל"));}
 const data=fixtures.map(x=>x.map(y=>({...y})));data[0][0].payment_status="";const r=await run({data,fail:[2]});assert.ok(r.content.includes("תשלום: "));assert.ok(!r.content.includes("תשלום: לא זמין"));
 const empty=fixtures.map(x=>x.slice());empty[0]=[];let result=await run({data:empty});assert.ok(result.content.includes("תשלום: pending_payment"));result=await run({data:empty,fail:[2]});assert.ok(result.content.includes("תשלום: לא זמין"));
});
test("paired failures and healthy empty inputs preserve correct states",async()=>{
 let r=await run({fail:[0,2]});assert.equal(r.hero,"לא זמין");assert.equal(r.metric("ממתינים לתשלום").value,"לא זמין");assert.ok(r.content.includes("תשלום: לא זמין"));
 r=await run({data:[[],[],[]]});assert.equal(r.hero,"0%");assert.equal(r.metric("פעילים").value,0);assert.ok(r.nodes.some(n=>n.type==="EmptyState"&&n.props.title==="אין גנים להצגה"));
 const data=[[],fixtures[1],[]];r=await run({data});assert.equal(r.hero,"0%");assert.ok(r.content.includes("תשלום: לא התחיל"));assert.ok(r.content.includes("צוות: 0/0"));
});
test("whole loader fails closed and denied admin never creates client",async()=>{
 for(const opt of [{thrown:true},{reject:true}]){const r=await run(opt);assert.ok(r.banner);assert.equal(r.hero,"לא זמין");assert.equal(r.metric("פעילים").value,"לא זמין");assert.ok(!r.content.includes("SYNTHETIC_CONTACT"));}
 assert.ok((await run({deny:true})).denied);
});
test("query chains unchanged and one domain hook registered",()=>{
 const lines=source.split("\n").filter(line=>line.includes("supabase.from("));assert.equal(lines.length,3);assert.equal(createHash("sha256").update(lines.join("\n")+"\n").digest("hex"),"da6266be97a59f0e687b29b85c80dff5cf07110f140ccf9d62d3bb50836b8bb8");
 const config=JSON.parse(readFileSync("config/digital-observer-ci-gates.json","utf8"));assert.deepEqual(config.domain.filter(x=>x.name==="activation-query-boundary").map(x=>x.args),[["--test","scripts/qa/check-activation-query-boundary.mjs"]]);
});
