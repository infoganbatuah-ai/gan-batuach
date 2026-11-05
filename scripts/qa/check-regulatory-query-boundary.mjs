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
const pageCode = compile(source("app/dashboard/admin/regulatory/page.tsx")) + "\nexports.qaFormatters={toneForScore,statusTone,statusLabel,averageScore,principleScore};";
const helperCode = compile(source("lib/admin-safe.ts"));
const metricCode = compile(source("components/premium-dashboard.tsx"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const ordered = (field, ascending) => ascending === undefined ? ["order", field] : ["order", field, { ascending }];

const inventory = [
 ["regulatory_policy_modes","modes", [ordered("vertical_key"),ordered("mode_key")]],
 ["vertical_capability_matrix","matrix",[ordered("vertical_key"),ordered("capability_category"),ordered("capability_name")],500],
 ["legal_feature_registry","registry",[ordered("feature_category"),ordered("feature_name")],200],
 ["privacy_by_design_controls","privacy",[ordered("principle")],200],
 ["parent_visibility_policy_rules","visibility",[ordered("visibility_status"),ordered("source_type")],120],
 ["regulatory_policy_audit_events","audit",[ordered("created_at",false)],80],
 ["ai_vertical_capability_matrix","aiMatrix",[ordered("vertical_key")],250]
];
const expected=inventory.map(([table,,calls,limit])=>[table,[["select","*"],...calls,...(limit===undefined?[]:[["limit",limit]])]]);
const principles=["data_minimization","purpose_limitation","access_limitation","retention_limitation"];
const fixtures=[
 [{id:"SYNTHETIC_MODE",mode_key:"GAN_BATUACH_ISRAEL_MODE",status:"enabled"}],
 ["enabled","disabled","legal_review_required"].map((capability_status,i)=>({id:`SYNTHETIC_M${i}`,vertical_key:"gan_batuach",capability_status,capability_name:`SYNTHETIC_CAP${i}`,capability_category:"SYNTHETIC_CATEGORY",restriction_summary:"SYNTHETIC_RESTRICTION"})),
 [{id:"SYNTHETIC_REG",feature_category:"camera",legal_status:"allowed",feature_name:"SYNTHETIC_FEATURE",restriction_summary:"SYNTHETIC_REG_RESTRICTION",allowed_verticals:["SYNTHETIC_ALLOWED"],restricted_verticals:["SYNTHETIC_RESTRICTED"],approval_required:true}],
 principles.map((principle,i)=>({id:`SYNTHETIC_P${i}`,principle,readiness_score:60,control_name:`SYNTHETIC_CONTROL${i}`,evidence_summary:"SYNTHETIC_EVIDENCE"})),
 ["allowed_after_review","other"].map((visibility_status,i)=>({id:`SYNTHETIC_V${i}`,visibility_status,source_type:`SYNTHETIC_SOURCE${i}`,rule_summary:"SYNTHETIC_RULE"})),
 [{id:"SYNTHETIC_A",event_type:"restriction_override",reason:"SYNTHETIC_REASON",vertical_key:"SYNTHETIC_VERTICAL",capability_key:"SYNTHETIC_CAPABILITY",created_at:"2026-11-05T00:00:00Z"}],
 [{id:"SYNTHETIC_UNUSED_AI",vertical_key:"SYNTHETIC_UNUSED_VERTICAL",readiness_score:999}]
];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
 let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
 const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
 const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); if (failures[i]?.kind === "factory") throw Error("PRIVATE_FACTORY"); for (const m of ["select", "order", "eq", "in", "limit"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { assert.equal(chains.length, 7, "one concurrent batch"); const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
 const p = load(pageCode, (id) => {
  if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (id === "next/link") return { __esModule: true, default: "Link" };
  if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, k) => String(k) });
  if (id === "@/lib/admin-safe") return helper;
  if (id === "@/lib/auth") return { requireRole: async (r) => { assert.deepEqual(Array.from(r), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
  if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } }; return unexpected(id);
 }, warnings);
 if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
 const tree = await p.default(); assert.equal(nodes(tree, "form").length, 0);
 return { tree, text: text(tree), clients, chains, warnings, data: captured.data, formatters: p.qaFormatters, banner: nodes(tree, "AdminDataError")[0].props.message, hero: nodes(tree, "PremiumDashboardHero")[0].props, metrics: nodes(tree, "RoleMetricCard").map((n) => n.props) };
}

const section=(r,title)=>nodes(r.tree,"CleanSection").find(n=>n.props.title===title);
const keys=n=>nodes(n).filter(v=>v.key!=null).map(v=>v.key);
const noData=[0,1,2,3,4,5,6];
function contracts(r,factory){
 assert.equal(r.clients,1);
 assert.deepEqual(plain(r.chains),expected.map(([t,c],i)=>[t,i===factory?[]:c]));
 assert.ok(!JSON.stringify([r.tree,r.warnings]).includes("PRIVATE_"));
 assert.ok(!String(r.banner).includes("PHASE"));
 assert.ok(!r.text.includes("SYNTHETIC_UNUSED_"));
 assert.ok(!r.text.includes("GAN_BATUACH_ISRAEL_MODE פעיל"));
 assert.ok(r.hero.subtitle.includes("רשומות מדיניות ודרישות בלבד"));
 assert.ok(r.hero.subtitle.includes("המסך אינו מפעיל יכולות"));
 assert.ok(r.text.includes("דרישות — הגבלות חובה"));
 assert.ok(r.text.includes("דרישות — יכולות מותרות"));
 assert.deepEqual(nodes(r.tree,"Link").map(n=>n.props.href),["/dashboard/admin/ai-platform","/dashboard/admin/security-center"]);
 assert.deepEqual(nodes(r.tree,"ActionCard").map(n=>n.props.href),["/dashboard/admin/security-center","/dashboard/admin/ai-platform","/dashboard/admin/policies","/dashboard/admin/audit-logs","/dashboard/parent/ai-events"]);
}
function dependencies(r,failed=[]){
 const known=i=>!failed.includes(i);
 assert.deepEqual(Array.from(r.data.available),noData.map(known));
 assert.equal(r.hero.badge,[1,3,4].every(known)?"59/100":"לא זמין");
 assert.equal(r.hero.badgeTone,[1,3,4].every(known)?"bad":"default");
 const values=["מותר",1,1,1,"60/100","67%","50%","60/100"],deps=[0,1,1,1,3,1,4,3],tones=["good","good","bad","warn","warn","warn","bad","warn"];
 assert.deepEqual(r.metrics.map(m=>m.value),values.map((v,i)=>known(deps[i])?v:"לא זמין"));
 assert.deepEqual(r.metrics.map(m=>m.tone),tones.map((v,i)=>known(deps[i])?v:"default"));
 for(const [i,title] of [[1,"מטריצת יכולות לפי ורטיקל"],[2,"Legal Feature Registry"],[5,"יומן רגולטורי"]]){
  const n=section(r,title);
  assert.deepEqual(keys(n),known(i)?i===1?["gan_batuach",...fixtures[i].map(v=>v.id)]:fixtures[i].map(v=>v.id):[]);
  if(!known(i)){assert.equal(nodes(n,"EmptyState").length,0);assert.ok(text(n).includes("לא זמין"));}
 }
 for(const [i,name] of [[3,"SYNTHETIC_CONTROL"],[4,"SYNTHETIC_SOURCE"]])assert.equal(r.text.includes(name),known(i));
 for(const i of failed)assert.deepEqual(Array.from(r.data[inventory[i][1]]),[]);
}
test("healthy actualpage exact7querychains/adminguard/onebatch/59hero",async()=>{const r=await page();contracts(r);dependencies(r);assert.equal(r.banner,null);});
for(let i=0;i<7;i++)for(const kind of ["returned","reject"])for(const stale of [false,true])test(`source${i} ${kind}/${stale?"stale":"empty"} independent display`,async()=>{
 const r=await page({failures:{[i]:{kind,stale}}});contracts(r);dependencies(r,[i]);assert.ok(r.banner);
 assert.deepEqual(plain(r.warnings),[["Admin Supabase query unavailable:",`regulatory query ${i}`]]);
});
for(let i=0;i<7;i++)test(`source${i} factorythrow contained once`,async()=>{const r=await page({failures:{[i]:{kind:"factory"}}});contracts(r,i);dependencies(r,[i]);assert.ok(r.banner);assert.equal(r.warnings.length,1);});
for(const failed of [[0,2],[2,5,6],[1,3],[3,4],[1,4],noData])test(`paired ${failed} dependencies/unknown vs unrelated known`,async()=>{
 const r=await page({failures:Object.fromEntries(failed.map(i=>[i,{kind:i%2?"reject":"returned",stale:true}]))});contracts(r);dependencies(r,failed);assert.ok(r.banner);
});
test("loader unknownall7 and denied zero clients",async()=>{const r=await page({loader:true});dependencies(r,noData);assert.equal(r.chains.length,0);assert.ok(r.banner);assert.ok(!JSON.stringify([r.tree,r.warnings]).includes("PRIVATE_"));await page({deny:true});});
for(const nullData of [false,true])test(`healthy ${nullData?"null":"empty"} retains original zeros/empties NOTunknown/active`,async()=>{
 const r=await page({empty:true,nullData});contracts(r);
 assert.equal(r.hero.badge,"0/100");assert.equal(r.hero.badgeTone,"default");
 assert.deepEqual(r.metrics.map(m=>m.value),["לא נטען",0,0,0,"0/100","0%","0%","0/100"]);
 assert.deepEqual(r.metrics.map(m=>m.tone),["warn","good","bad","good","default","default","default","default"]);
 for(const title of ["מטריצת יכולות לפי ורטיקל","Legal Feature Registry","יומן רגולטורי"])assert.equal(nodes(section(r,title),"EmptyState").length,1);
 assert.ok(r.text.includes("אין כללי חשיפה."));assert.ok(r.text.includes("אין בקרות פרטיות."));assert.equal(r.banner,null);
});
test("mode FIRST STRICTmatch status record only and missing keepswarn",async()=>{
 const data=structuredClone(fixtures);data[0]=[{mode_key:{toString:()=>"GAN_BATUACH_ISRAEL_MODE"},status:"enabled"},{mode_key:"GAN_BATUACH_ISRAEL_MODE",status:"disabled"},...fixtures[0]];
 let r=await page({data});assert.equal(r.metrics[0].value,"כבוי");assert.equal(r.metrics[0].tone,"warn");assert.ok(r.text.includes("לא הוכחת הפעלה"));assert.equal(r.hero.badge,"59/100");
 data[0]=[{mode_key:"OTHER",status:"enabled"}];r=await page({data});assert.equal(r.metrics[0].value,"לא נטען");assert.equal(r.metrics[0].tone,"warn");
});
test("gan strictfilter/status 2of3 regardlessothervertical/objectlabels or AI6",async()=>{
 const data=structuredClone(fixtures);data[1].push({vertical_key:"other",capability_status:"enabled"},{vertical_key:{toString:()=>"gan_batuach"},capability_status:"enabled"});
 const r=await page({data});assert.equal(r.metrics[5].value,"67%");assert.equal(r.metrics[1].value,1);assert.equal(r.metrics[2].value,1);assert.equal(r.metrics[3].value,1);
});
test("positiveonly average excludes zero/negative/NaN with exact nestedrounding and missingprinciple",async()=>{
 const data=structuredClone(fixtures);data[3]=[{principle:principles[0],readiness_score:"40.4"},{principle:principles[0],readiness_score:40.6},{principle:principles[1],readiness_score:80.6},{principle:principles[2],readiness_score:0},{principle:principles[3],readiness_score:-1},{principle:"other",readiness_score:"NaN"},{principle:{toString:()=>principles[1]},readiness_score:120}];
 const r=await page({data});assert.equal(r.metrics[4].value,"70/100");assert.equal(r.metrics[7].value,"31/100");
 assert.equal(r.formatters.principleScore(data[3],principles[0]),41);assert.equal(r.formatters.principleScore(data[3],principles[1]),81);
 assert.equal(r.formatters.averageScore([{readiness_score:150},{readiness_score:200}]),175);
 assert.equal(r.formatters.averageScore([{readiness_score:0},{readiness_score:-1},{readiness_score:"NaN"}]),0);
});
test("visibility STRICTraw status over ALLrows no verticalfilter",async()=>{
 const data=structuredClone(fixtures);data[4]=["blocked","allowed_after_review",{toString:()=>"blocked"},"other"].map((visibility_status,i)=>({id:`SYNTHETIC_V${i}`,visibility_status,vertical_key:i?"other":"gan_batuach"}));
 const r=await page({data});assert.equal(r.metrics[6].value,"50%");
});
test("matrix originalgrouporder first10 EACHvertical and all other lists/idkeys",async()=>{
 const data=structuredClone(fixtures);data[1]=["other","gan_batuach"].flatMap(v=>Array.from({length:13},(_,i)=>({id:`SYNTHETIC_${v}_${i}`,vertical_key:v,capability_name:`SYNTHETIC_NAME_${v}_${i}`,capability_status:"enabled"})));
 for(const i of [2,3,4,5])data[i]=Array.from({length:15},(_,j)=>({...fixtures[i][0],id:`SYNTHETIC_ALL_${i}_${j}`}));
 const r=await page({data});assert.deepEqual(keys(section(r,"מטריצת יכולות לפי ורטיקל")),["other",...data[1].slice(0,10).map(v=>v.id),"gan_batuach",...data[1].slice(13,23).map(v=>v.id)]);
 for(const [i,title] of [[2,"Legal Feature Registry"],[5,"יומן רגולטורי"]])assert.deepEqual(keys(section(r,title)),data[i].map(v=>v.id));
 for(const i of [3,4])for(const item of data[i])assert.ok(keys(r.tree).includes(item.id));
 assert.equal(r.metrics[5].value,"100%");
});
test("registry rawTRUTHYapproval/listjoins and nullish/empty metadata unchanged",async()=>{
 const data=structuredClone(fixtures);data[2]=[false,"false",0,[],null].map((approval_required,i)=>({id:`SYNTHETIC_R${i}`,approval_required,legal_status:"allowed",allowed_verticals:i?null:["a","b"],restricted_verticals:[]}));
 const r=await page({data}),rows=nodes(section(r,"Legal Feature Registry"),"article");
 assert.deepEqual(rows.map(n=>nodes(n,"StatusBadge")[1].props.tone),["good","warn","good","warn","good"]);
 assert.deepEqual(rows.map(n=>text(nodes(n,"StatusBadge")[1])),["ללא אישור נוסף","דורש אישור","ללא אישור נוסף","דורש אישור","ללא אישור נוסף"]);
 assert.ok(text(rows[0]).includes("a, b"));assert.ok(text(rows[1]).includes("אין"));assert.equal(r.hero.badge,"59/100");
});
test("privacy RAWreadiness display and Numbertone not normalized/clamped",async()=>{
 const data=structuredClone(fixtures);data[3]=["085.50","",null,150].map((readiness_score,i)=>({id:`SYNTHETIC_P${i}`,readiness_score,principle:"other"}));
 const r=await page({data}),badges=nodes(r.tree,"StatusBadge").filter(n=>/\/100$/.test(text(n)));
 assert.deepEqual(badges.map(text),["085.50/100","/100","/100","150/100"]);assert.deepEqual(badges.map(n=>n.props.tone),["good","default","default","good"]);
});
test("audit exact restriction_override comparison/date/nullishnottruthy",async()=>{
 const data=structuredClone(fixtures);data[5]=[{id:"a0",event_type:"restriction_override",reason:"",event_key:"NOT_USED",vertical_key:"",capability_key:"",feature_key:"NOT_USED",created_at:"2026-11-05T00:00:00Z"},{id:"a1",event_type:{toString:()=>"restriction_override"},reason:null,event_key:"SYNTHETIC_EVENT",vertical_key:null,feature_key:"SYNTHETIC_FEATURE",created_at:null}];
 const r=await page({data}),rows=nodes(section(r,"יומן רגולטורי"),"article");
 assert.deepEqual(rows.map(n=>nodes(n,"StatusBadge")[0].props.tone),["warn","good"]);assert.equal(text(nodes(rows[0],"h3")[0]),"");assert.ok(!text(rows[0]).includes("NOT_USED"));assert.equal(text(nodes(rows[1],"h3")[0]),"SYNTHETIC_EVENT");
 assert.ok(text(rows[0]).includes(new Date("2026-11-05T00:00:00Z").toLocaleString("he-IL")));
});
test("unused cameraCompliance and AI matrix NEVER newUI dependencies",async()=>{const data=structuredClone(fixtures);data[2]=[{feature_category:"camera",legal_status:"allowed"},{feature_category:"camera",legal_status:"restricted"}];data[6]=[{readiness_score:100000}];const r=await page({data});assert.equal(r.hero.badge,"59/100");assert.equal(r.metrics.length,8);assert.equal(r.metrics[5].value,"67%");});
test("helper STRICTtones vs Stringlabel and thresholdboundaries unchanged",async()=>{
 const f=(await page()).formatters;assert.equal(f.statusLabel({toString:()=>"enabled"}),"מותר");assert.equal(f.statusTone({toString:()=>"enabled"}),"default");
 for(const [n,t] of [[-1,"default"],[0,"default"],[1,"bad"],[59.9,"bad"],[60,"warn"],[79.99,"warn"],[80,"good"],[150,"good"],[NaN,"default"]])assert.equal(f.toneForScore(n),t);
 assert.equal(f.statusLabel(null),"לא ידוע");assert.equal(f.statusLabel(""),"");assert.equal(f.statusLabel("SYNTHETIC_UNKNOWN"),"SYNTHETIC_UNKNOWN");
});
test("ACTUAL RoleMetricCard failed8values neutral no inferred success",async()=>{
 const r=await page({failures:Object.fromEntries(noData.map(i=>[i,{kind:"reject"}]))});
 const actual=load(metricCode,id=>{if(id==="react/jsx-runtime")return{jsx,jsxs:jsx};if(id==="next/link")return{__esModule:true,default:"Link"};if(id==="@/components/global-state-system"||id==="@/lib/ui/canonical-status")return new Proxy({},{get:(_,k)=>()=>unexpected(k)});return unexpected(id);});
 for(const m of r.metrics){const n=actual.RoleMetricCard(m);assert.equal(n.props.className,"role-metric-card default");assert.ok(text(n).includes("לא זמין"));assert.ok(!text(n).includes("תקין"));}
});
test("ONE appended DOMAINhook no securityhook",()=>{
 const c=JSON.parse(source("config/digital-observer-ci-gates.json")),name="regulatory-query-boundary";assert.deepEqual(c.domain.filter(v=>v.name===name),[{name,args:["--test","scripts/qa/check-regulatory-query-boundary.mjs"]}]);assert.equal(c.security.filter(v=>v.name===name).length,0);
});
