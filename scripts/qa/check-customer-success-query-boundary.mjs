import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import ts from "typescript";

const load = (source, require) => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require, console: { warn() {} }, Date, Intl, fetch() { throw Error("network forbidden"); } });
  return exports;
};
const safe = load(readFileSync("lib/admin-safe.ts", "utf8"), () => { throw Error("unexpected import"); });
const page = readFileSync("app/dashboard/admin/customer-success/page.tsx", "utf8");
const tables = ["gardens","profiles","staff","parents","documents","kindergarten_subscriptions","customer_health_scores","customer_lifecycle_events","support_tickets","training_hub_items","training_completion_records","knowledge_base_articles","customer_success_tasks","renewal_risk_signals","success_playbooks","customer_success_surveys","product_adoption_analytics","customer_success_reports","customer_success_readiness"];
const fixtures = [[{id:"g",name:"GARDEN",status:"active"}],[{id:"p",role:"manager",active:true}],[{id:"s",approved_to_work:true}],[{id:"a",completed_profile:true}],[{id:"d",status:"signed"}],[{id:"b",billing_status:"paid"}],[{id:"h",customer_health_score:20,renewal_risk_level:"high",explanation:"HEALTH_STALE",gardens:{name:"HEALTH_GARDEN"}}],[{id:"l"}],[{id:"t",subject:"TICKET_STALE",status:"open",priority:"critical"}],[{id:"i",title:"TRAINING_STALE"}],[{id:"c",completion_status:"completed"}],[{id:"k",title:"KNOWLEDGE_STALE",status:"published"}],[{id:"q",title:"TASK_STALE",status:"open"}],[{id:"r",severity:"high",signal_type:"RISK_STALE",risk_score:90}],[{id:"y",title:"PLAYBOOK_STALE"}],[{id:"u",title:"SURVEY_STALE"}],[{id:"v",feature_key:"ADOPTION_STALE"}],[{id:"w",title:"REPORT_STALE"}],[{id:"z"}]];

async function run({ fail = [], data = fixtures, deny = false, thrown = false, reject = false } = {}) {
  let clients = 0, calls = 0;
  const chains = [];
  const client = { from(table) {
    const index = calls++;
    assert.equal(table, tables[index]);
    const chain = [table]; chains.push(chain);
    const builder = {};
    for (const method of ["select","order","limit","eq"]) builder[method] = (...args) => { chain.push([method,...args]); return builder; };
    builder.then = (ok, bad) => (reject && index === 0 ? Promise.reject(Error("PRIVATE_ERROR")) : Promise.resolve({data: data[index], error: fail.includes(index) ? {message:"PRIVATE_ERROR"} : null})).then(ok,bad);
    return builder;
  }};
  const jsx = {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const denied = Error("DENIED");
  const req = id => {
    if(id==="react/jsx-runtime") return jsx;
    if(id==="next/link") return {default:"Link"};
    if(id==="lucide-react") return new Proxy({}, {get:()=>()=>null});
    if(id.endsWith("/dashboard-shell")) return {DashboardShell:"DashboardShell"};
    if(id.endsWith("/premium-dashboard")) return Object.fromEntries(["ActionCard","CleanSection","EmptyState","PremiumDashboardHero","RoleMetricCard","StatusBadge"].map(k=>[k,k]));
    if(id.endsWith("/admin-data-state")) return {AdminDataError:"AdminDataError"};
    if(id.endsWith("/auth")) return {requireRole:async roles=>{assert.deepEqual(Array.from(roles),["admin"]); if(deny) throw denied;}};
    if(id.endsWith("/supabase/server")) return {createClient:async()=>{clients++; if(thrown) throw Error("PRIVATE_ERROR"); return client;}};
    if(id.endsWith("/admin-safe")) return safe;
    throw Error("unexpected import "+id);
  };
  let tree;
  try { tree = await load(page, req).default(); } catch(e) { if(!deny) throw e; assert.equal(e,denied); assert.equal(clients,0); assert.equal(calls,0); return {denied:true}; }
  const nodes = [], strings = [];
  function walk(v) { if(Array.isArray(v)) return v.forEach(walk); if(typeof v==="string") strings.push(v); else if(v && typeof v==="object") { nodes.push(v); walk(v.props?.children); } }
  walk(tree);
  const metric = label => nodes.find(n=>n.type==="RoleMetricCard" && n.props.label===label)?.props;
  return {nodes,strings,metric,chains,calls,clients,banner:nodes.find(n=>n.type==="AdminDataError")?.props.message,hero:nodes.find(n=>n.type==="PremiumDashboardHero")?.props.badge};
}

for (let i=0;i<19;i++) test("failed source "+tables[i]+" is disclosed and stale data discarded",async()=>{
  const r=await run({fail:[i]}); assert.ok(r.banner); assert.equal(r.calls,19); assert.ok(!r.strings.some(s=>s.includes("PRIVATE_ERROR")));
  const markers={6:"HEALTH_STALE",8:"TICKET_STALE",9:"TRAINING_STALE",11:"KNOWLEDGE_STALE",12:"TASK_STALE",13:"RISK_STALE",14:"PLAYBOOK_STALE",15:"SURVEY_STALE",16:"ADOPTION_STALE",17:"REPORT_STALE"};
  if(markers[i]) assert.ok(!r.strings.includes(markers[i]));
});
test("metrics use each actual source",async()=>{
  for(const [i,labels] of [[0,["גנים פעילים","בקליטה","מנהלת"]],[1,["מנהלת"]],[2,["צוות","השלמת צוות"]],[3,["הורים","אימוץ הורים"]],[4,["מסמכים"]],[5,["תשלום"]],[8,["פניות פתוחות"]],[10,["הדרכות"]]]) { const r=await run({fail:[i]}); for(const label of labels) assert.equal(r.metric(label).value,"לא זמין"); }
  const r=await run({fail:[9]}); assert.equal(r.metric("הדרכות").value,"100%");
});
test("health fallback requires healthy source and all six fallback inputs",async()=>{
  assert.equal((await run({fail:[6]})).hero,"לא זמין");
  for(const score of [null,0]) for(let i=0;i<6;i++) { const data=fixtures.map(x=>x.slice()); data[6]=[{customer_health_score:score}]; assert.equal((await run({fail:[i],data})).hero,"לא זמין"); }
  for(let i=0;i<6;i++) assert.equal((await run({fail:[i]})).hero,"20/100");
  const data=fixtures.map(x=>x.slice()); data[6]=[]; assert.equal((await run({data})).hero,"100/100");
});
test("risk total and urgency do not claim absence from missing inputs",async()=>{
  for(const i of [6,13]) { const r=await run({fail:[i]}); assert.equal(r.metric("סיכון חידוש").value,"לא זמין"); assert.ok(!r.strings.includes("אין סיכון גבוה כרגע.")); }
  let r=await run({fail:[12]}); assert.ok(r.strings.includes("1 פניות דחופות."));
  const data=fixtures.map(x=>x.slice()); data[8]=[]; data[12]=[];
  for(const i of [8,12]) { r=await run({fail:[i],data}); assert.ok(!r.strings.includes("אין חסם דחוף.")); }
});
test("reports and surveys retain independent healthy data",async()=>{
  for(const [bad,kept] of [[17,"SURVEY_STALE"],[15,"REPORT_STALE"]]) { const r=await run({fail:[bad]}); assert.ok(r.strings.includes(kept)); assert.ok(r.strings.some(s=>s.includes("אינם זמינים"))); }
  const data=fixtures.map(x=>x.slice()); data[15]=[]; data[17]=[];
  let r=await run({data,fail:[15]}); assert.ok(!r.nodes.some(n=>n.type==="EmptyState" && n.props.title==="אין דוחות או סקרים"));
  r=await run({data}); assert.ok(r.nodes.some(n=>n.type==="EmptyState" && n.props.title==="אין דוחות או סקרים"));
});
test("whole loader failure and rejection fail closed; denied admin does not create client",async()=>{
  for(const opt of [{thrown:true},{reject:true}]) { const r=await run(opt); assert.ok(r.banner); assert.equal(r.hero,"לא זמין"); assert.equal(r.metric("גנים פעילים").value,"לא זמין"); }
  assert.ok((await run({deny:true})).denied);
});
test("healthy behavior, exact query chains and single domain registration",async()=>{
  const r=await run(); assert.equal(r.hero,"20/100"); assert.equal(r.metric("גנים פעילים").value,1); assert.equal(r.calls,19);
  const source=page.match(/supabase\.from\([^\n]+/g); assert.equal(source.length,19);
  const queryLines=page.split("\n").filter(line=>line.includes("supabase.from("));
  assert.equal(createHash("sha256").update(queryLines.join("\n")+"\n").digest("hex"),"6a1f404d7d36b534eb2db9349c60350731cc0f3ac30fb386f6679f680943c947");
  for(let i=0;i<19;i++) { assert.ok(source[i].includes('"'+r.chains[i][0]+'"')); for(const part of r.chains[i].slice(1)) { assert.ok(source[i].includes("."+part[0]+"(")); if(typeof part[1]==="number") assert.ok(source[i].includes(String(part[1]))); else assert.ok(source[i].includes('"'+part[1]+'"')); } }
  const config=JSON.parse(readFileSync("config/digital-observer-ci-gates.json","utf8")); assert.deepEqual(config.domain.filter(x=>x.name==="customer-success-query-boundary").map(x=>x.args),[["--test","scripts/qa/check-customer-success-query-boundary.mjs"]]);
});
