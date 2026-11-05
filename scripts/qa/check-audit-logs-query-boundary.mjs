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
const pageCode = compile(source("app/dashboard/admin/audit-logs/page.tsx")) + "\nexports.qaFormatters={riskTone,scoreTone,metadataKeys,categoryLabels};";
const helperCode = compile(source("lib/admin-safe.ts"));
const metricCode = compile(source("components/stat-card.tsx"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const ordered = (field, ascending) => ascending === undefined ? ["order", field] : ["order", field, { ascending }];


const inventory=[
 ["immutable_audit_events","immutable","*, actor:actor_profile_id(full_name, role), gardens(name, city)",[ordered("created_at",false)],300],
 ["audit_logs","legacy","*, actor:actor_id(full_name, role), gardens(name, city)",[ordered("created_at",false)],120],
 ["medical_data_access_logs","medical","*",[ordered("created_at",false)],120],
 ["security_events","security","*",[ordered("created_at",false)],120],
 ["audit_coverage_readiness","coverage","*",[ordered("coverage_area")],80]
];
const expected=inventory.map(([table,,projection,calls,limit])=>[table,[["select",projection],...calls,["limit",limit]]]);
const fixtures=[
 ["medical","camera","observer","parent"].map((event_category,i)=>({id:`SYNTHETIC_EVENT_${i}`,event_category,event_type:["read","denied","export","blocked"][i],risk_level:["high","critical","low","medium"][i],event_hash:i===0?"SYNTHETIC_HASH_NEVER_DISPLAY":null,actor:{full_name:"SYNTHETIC_ACTOR",role:"SYNTHETIC_ROLE"},gardens:{name:"SYNTHETIC_GARDEN"},target_type:"SYNTHETIC_TARGET",created_at:"2026-11-05T00:00:00Z",metadata:{safe_key:"SYNTHETIC_VALUE_NEVER_DISPLAY",token:"SYNTHETIC_VALUE_NEVER_DISPLAY"}})),
 [{id:"SYNTHETIC_LEGACY",action:"SYNTHETIC_LEGACY_ACTION",entity_type:"SYNTHETIC_ENTITY",entity_id:"SYNTHETIC_ENTITY_ID",actor_id:"SYNTHETIC_ACTOR_ID",after_data:{legacy_key:"SYNTHETIC_VALUE_NEVER_DISPLAY"},created_at:"2026-11-05T00:00:00Z"}],
 [{id:"SYNTHETIC_ACCESS_0"},{id:"SYNTHETIC_ACCESS_1"}],
 ["open","reviewing","closed"].map((status,i)=>({id:`SYNTHETIC_SECURITY_${i}`,event_type:`SYNTHETIC_SECURITY_TYPE_${i}`,status,severity:["critical","low","medium"][i],created_at:"2026-11-05T00:00:00Z"})),
 [80,40].map((coverage_score,i)=>({id:`SYNTHETIC_COVERAGE_${i}`,coverage_key:i?"SYNTHETIC_OTHER":"security-event-audit",coverage_score,title:`SYNTHETIC_COVERAGE_TITLE_${i}`,recommended_action:"SYNTHETIC_RECOMMENDATION",audited_routes:i+1,required_routes:5,readiness_status:"SYNTHETIC_STATUS"}))
];
const ownerProfile={id:"SYNTHETIC_PROFILE",role:"admin"};
async function page({failures={},data=fixtures,empty=false,nullData=false,loader=false,deny=false}={}){
 let clients=0,captured;const chains=[],warnings=[],actual=load(helperCode,unexpected,warnings);
 const helper={...actual,safeAdminData:async(...a)=>{captured=await actual.safeAdminData(...a);return captured;}};
 const client={from(table){
  const i=chains.length,calls=[],q={};assert.equal(table,expected[i]?.[0]);chains.push([table,calls]);
  if(failures[i]?.kind==="factory")throw Error("PRIVATE_FACTORY");
  for(const m of ["select","order","limit"])q[m]=(...a)=>{calls.push([m,...a]);return q;};
  q.then=(a,b)=>{assert.equal(chains.length,5,"one concurrent batch");const f=failures[i];return(f?.kind==="reject"?Promise.reject(Error("PRIVATE_SENTINEL")):Promise.resolve({data:nullData?null:empty||f&&!f.stale?[]:data[i],error:f?{message:"PRIVATE_SENTINEL"}:null})).then(a,b);};return q;
 }};
 const p=load(pageCode,id=>{
  if(id==="react/jsx-runtime")return{jsx,jsxs:jsx};
  if(id==="lucide-react"||id.startsWith("@/components/"))return new Proxy({},{get:(_,k)=>String(k)});
  if(id==="@/lib/admin-safe")return helper;
  if(id==="@/lib/auth")return{requireRole:async roles=>{assert.deepEqual(Array.from(roles),["admin"]);assert.equal(clients,0);assert.equal(chains.length,0);if(deny)throw Error("DENIED");return{profile:ownerProfile};}};
  if(id==="@/lib/supabase/server")return{createClient:async()=>{clients++;if(loader)throw Error("PRIVATE_LOADER");return client;}};
  return unexpected(id);
 },warnings);
 if(deny){await assert.rejects(p.default(),/DENIED/);assert.equal(clients,0);assert.equal(chains.length,0);return;}
 const tree=await p.default(),frame=nodes(tree,"AdminAppFrame")[0];assert.equal(frame.props.profile,ownerProfile);assert.equal(frame.props.activeHref,"/dashboard/admin/audit-logs");assert.equal(frame.props.title,"Audit ואבטחה");assert.equal(nodes(tree,"form").length,0);
 return{tree,text:text(tree),clients,chains,warnings,data:captured.data,formatters:p.qaFormatters,banner:nodes(tree,"AdminDataError")[0].props.message,metrics:nodes(tree,"StatCard").map(n=>n.props),hero:nodes(tree,"div").find(n=>n.props.className==="profile-actions")};
}
const keys=n=>nodes(n).filter(v=>v.key!=null).map(v=>v.key);
const panel=(r,title)=>nodes(r.tree,"article").find(n=>text(nodes(n,"h2")[0]).includes(title));
const section=(r,title)=>nodes(r.tree,"section").find(n=>n.props.className==="dashboard-section"&&text(nodes(n,"h2")[0]).includes(title));
const stream=r=>section(r,"זרם אירועים");
const categories=["medical","camera","document","observer","payment","admin","security","regulatory"];
function contracts(r,factory){
 assert.equal(r.clients,1);assert.deepEqual(plain(r.chains),expected.map(([t,c],i)=>[t,i===factory?[]:c]));
 assert.ok(!JSON.stringify([r.tree,r.warnings]).includes("PRIVATE_"));
 assert.ok(!r.text.includes("SYNTHETIC_VALUE_NEVER_DISPLAY"));assert.ok(!r.text.includes("SYNTHETIC_HASH_NEVER_DISPLAY"));
 assert.ok(!String(r.banner).includes("Phase"));assert.ok(!String(r.banner).includes("מיגרצי"));
 for(const q of ["רשומות ומדדי מוכנות בלבד","לא הוכחת אחסון בלתי־מחיק","שרשרת hash מאומתת","פרטיות רפואית/DLP","דרישות/תכנון","24+ חודשים","חוסמת מחיקה","דרישות ייצוא עתידי","לא הרשאת ייצוא"])assert.ok(r.text.includes(q),q);
 assert.deepEqual(plain(nodes(stream(r),"input").map(n=>n.props)),[{placeholder:"סינון לפי פעולה / משתמש / גן"},{type:"date"}]);
 assert.deepEqual(nodes(stream(r),"option").map(text),["כל הקטגוריות",...categories]);
 assert.equal(nodes(r.tree,"button").length,0);assert.equal(nodes(r.tree,"a").length,0);
}
function dependencies(r,failed=[]){
 const known=i=>!failed.includes(i);
 assert.deepEqual(Array.from(r.data.available),[0,1,2,3,4].map(known));
 const witness=known(0)||known(4),tk=witness||(known(0)&&known(4));
 assert.deepEqual(r.metrics.map(m=>m.value),[known(0)?4:"לא זמין",known(0)?1:"לא זמין",known(0)?2:"לא זמין",known(0)&&known(3)?4:"לא זמין",known(2)?2:"לא זמין",known(3)?3:"לא זמין","עתידי",tk?witness?"מוכנה":"חלקית":"לא זמין"]);
 assert.deepEqual(r.metrics.map(m=>m.tone),[known(0)?"good":"default",known(0)?"bad":"default",known(0)?"warn":"default",known(0)&&known(3)?"bad":"default",known(2)?"warn":"default",known(3)?"bad":"default","warn",tk?witness?"good":"warn":"default"]);
 const badges=nodes(r.hero,"span");assert.equal(text(badges[0]),known(4)?"כיסוי ביקורת 60/100":"כיסוי ביקורת לא זמין");assert.equal(badges[0].props.className,known(4)?"pill warn":"pill default");
 assert.equal(text(badges[1]),tk?witness?"רשומת הגנת שינוי מוכנה":"רשומת הגנת שינוי ממתינה":"לא זמין");
 assert.deepEqual(nodes(panel(r,"גישה למידע רגיש"),"b").map(text),[known(2)?"2":"לא זמין",known(0)?"2":"לא זמין",known(0)?"1":"לא זמין"]);
 assert.deepEqual(nodes(panel(r,"מצלמות ותצפיתן"),"b").map(text),[known(0)?"1":"לא זמין",known(0)?"1":"לא זמין",known(0)?"2":"לא זמין"]);
 assert.deepEqual(keys(section(r,"כיסוי ביקורת")),known(4)?fixtures[4].map(v=>v.id):[]);if(!known(4))assert.ok(text(section(r,"כיסוי ביקורת")).includes("לא זמין"));
 const cat=nodes(panel(r,"פעילות לפי תחום"),"div").filter(n=>n.props.className==="mini-row");
 assert.deepEqual(cat.map(n=>n.key),categories);assert.deepEqual(cat.map(n=>text(nodes(n,"strong")[0])),known(0)?["1","1","0","1","0","0","0","0"]:Array(8).fill("לא זמין"));
 if(!known(0))assert.ok(!text(panel(r,"פעילות לפי תחום")).includes("הכיסוי ממתין"));
 assert.deepEqual(keys(panel(r,"אירועי אבטחה")),known(3)?fixtures[3].map(v=>v.id):[]);
 const expectedRows=known(0)?fixtures[0]:known(1)?fixtures[1]:[];assert.deepEqual(nodes(stream(r),"article").map(n=>n.key),expectedRows.map(v=>v.id));
 if(!known(0)&&known(1))assert.ok(text(stream(r)).includes("המקור הראשי אינו זמין — רשומות ישנות חלקיות בלבד"));
 if(!known(0)&&!known(1))assert.ok(text(stream(r)).includes("לא זמין"));
 for(const i of failed)assert.deepEqual(Array.from(r.data[inventory[i][1]]),[]);
}

test("healthy actualpage/sharedhelper exact5chains/adminprofile/concurrency/coverage60",async()=>{const r=await page();contracts(r);dependencies(r);assert.equal(r.banner,null);});
for(let i=0;i<5;i++)for(const kind of ["returned","reject"])for(const stale of [false,true])test(`source${i} ${kind}/${stale?"stale":"empty"} keeps independent counts/stream`,async()=>{const r=await page({failures:{[i]:{kind,stale}}});contracts(r);dependencies(r,[i]);assert.ok(r.banner);assert.deepEqual(plain(r.warnings),[["Admin Supabase query unavailable:",`audit center query ${i}`]]);});
for(let i=0;i<5;i++)test(`source${i} factorythrow settled once and neighbors kept`,async()=>{const r=await page({failures:{[i]:{kind:"factory"}}});contracts(r,i);dependencies(r,[i]);assert.equal(r.warnings.length,1);});
for(const failed of [[0,1],[0,3],[0,4],[2,3],[1,2,3],[0,1,2,3,4]])test(`paired ${failed} independent panels and unknowns`,async()=>{const r=await page({failures:Object.fromEntries(failed.map(i=>[i,{kind:i%2?"reject":"returned",stale:true}]))});contracts(r);dependencies(r,failed);});
for(const primary of ["positive","negative","unavailable"])for(const coverage of ["positive","negative","unavailable"])test(`tamper OR truth table primary${primary}/coverage${coverage}`,async()=>{
 const data=structuredClone(fixtures);data[0].forEach(v=>v.event_hash=primary==="positive"?"SYNTHETIC_HASH_NEVER_DISPLAY":null);data[4].forEach(v=>v.coverage_key=coverage==="positive"?"security-event-audit":"other");
 const failures={};if(primary==="unavailable")failures[0]={kind:"returned",stale:true};if(coverage==="unavailable")failures[4]={kind:"reject",stale:true};
 const r=await page({data,failures}),ready=primary==="positive"||coverage==="positive",known=ready||primary!=="unavailable"&&coverage!=="unavailable";
 assert.equal(r.metrics[7].value,known?ready?"מוכנה":"חלקית":"לא זמין");assert.equal(r.metrics[7].tone,known?ready?"good":"warn":"default");
 const badge=nodes(r.hero,"span")[1];assert.equal(badge.props.className,known?ready?"pill good":"pill warn":"pill default");
 assert.equal(text(nodes(panel(r,"מוכנות לאחסון"),"b")[0]),known?ready?"סימן מוכנות רשום":"ממתינה":"לא זמין");
});
for(const primary of ["rows","empty","unavailable"])for(const legacy of ["rows","empty","unavailable"])test(`stream availability primary${primary}/legacy${legacy}`,async()=>{
 const data=structuredClone(fixtures);if(primary==="empty")data[0]=[];if(legacy==="empty")data[1]=[];const failures={};if(primary==="unavailable")failures[0]={kind:"reject",stale:true};if(legacy==="unavailable")failures[1]={kind:"returned",stale:true};
 const r=await page({data,failures}),s=stream(r),rows=nodes(s,"article"),primaryRows=primary==="rows",legacyRows=!primaryRows&&legacy==="rows";
 assert.deepEqual(rows.map(n=>n.key),primaryRows?fixtures[0].map(v=>v.id):legacyRows?fixtures[1].map(v=>v.id):[]);
 const bothEmpty=primary==="empty"&&legacy==="empty";assert.equal(text(s).includes("אין לוגים להצגה"),bothEmpty);
 if(primary==="unavailable"&&legacy!=="unavailable")assert.ok(text(s).includes("המקור הראשי אינו זמין"));
 if(!primaryRows&&legacy==="unavailable")assert.ok(text(s).includes("לא זמין"));
 if(primary==="empty"&&legacy==="rows")assert.ok(text(s).includes("רשומות ישנות (legacy)"));
 if(primary==="unavailable")assert.equal(r.metrics[0].value,"לא זמין");else assert.equal(r.metrics[0].value,primary==="empty"?0:4);
});
test("loader allunknown and denied0clientsqueries, futureexport remainsstatic",async()=>{const r=await page({loader:true});assert.equal(r.chains.length,0);dependencies(r,[0,1,2,3,4]);assert.ok(r.banner);assert.ok(!JSON.stringify([r.tree,r.warnings]).includes("PRIVATE_"));await page({deny:true});});
for(const nullData of [false,true])test(`healthy${nullData?"null":"empty"} original emptycounts/tamperfalse/streamempty`,async()=>{const r=await page({empty:true,nullData});contracts(r);assert.deepEqual(r.metrics.map(m=>m.value),[0,0,0,0,0,0,"עתידי","חלקית"]);assert.deepEqual(r.metrics.map(m=>m.tone),["warn","good","good","good","good","good","warn","warn"]);assert.equal(text(nodes(r.hero,"span")[0]),"כיסוי ביקורת 0/100");assert.ok(text(stream(r)).includes("אין לוגים להצגה"));assert.equal(r.banner,null);});
test("count STRICTcritical/categories vs Stringhighrisk/status and raw regex",async()=>{
 const data=structuredClone(fixtures);data[0]=[{id:"s0",risk_level:{toString:()=>"critical"},event_category:{toString:()=>"medical"},event_type:"EXPORT_denied"},{id:"s1",risk_level:"critical",event_category:"child",event_type:{toString:()=>"blocked"}},{id:"s2",risk_level:"HIGH",event_category:"camera",event_type:"failed"},{id:"s3",risk_level:"high",event_category:"observer",event_type:"UNRELATED"}];data[3]=[{id:"x",status:{toString:()=>"open"},severity:{toString:()=>"critical"}},{id:"y",status:"reviewing",severity:"CRITICAL"}];
 const r=await page({data});assert.equal(r.metrics[1].value,1);assert.equal(r.metrics[2].value,3);assert.equal(r.metrics[3].value,5);assert.equal(r.metrics[5].tone,"good");assert.deepEqual(nodes(panel(r,"גישה למידע רגיש"),"b").map(text),["2","1","1"]);assert.deepEqual(nodes(panel(r,"מצלמות ותצפיתן"),"b").map(text),["1","1","2"]);
});
for(const [scores,score] of [[[80,0],40],[[80,-20,0],20],[[55.4,55.6],56],[[150,200],175],[["NaN",80],"NaN"],[[null,100],50]])test(`coverage ALLrows ${scores} originalmean${score}`,async()=>{
 const data=structuredClone(fixtures);data[4]=scores.map((coverage_score,i)=>({coverage_key:`SYNTHETIC_C${i}`,coverage_score,title:"SYNTHETIC_TITLE"}));const r=await page({data});assert.equal(text(nodes(r.hero,"span")[0]),`כיסוי ביקורת ${score}/100`);assert.equal(nodes(r.hero,"span")[0].props.className,`pill ${Number(score)>=80?"good":Number(score)>=55?"warn":"bad"}`);
});
test("tamper event_hash rawTRUTHY and coverage_key STRICT not String",async()=>{const data=structuredClone(fixtures);data[4]=[{coverage_key:{toString:()=>"security-event-audit"},coverage_score:80}];for(const value of [false,"",0,null]){data[0].forEach(v=>v.event_hash=value);assert.equal((await page({data})).metrics[7].value,"חלקית");}data[0][0].event_hash="false";assert.equal((await page({data})).metrics[7].value,"מוכנה");});
test("primary FIRST120 / security FIRST8 / coverageALL originalkeys and order",async()=>{
 const data=structuredClone(fixtures);data[0]=Array.from({length:125},(_,i)=>({...fixtures[0][0],id:`SYNTHETIC_P${i}`}));data[3]=Array.from({length:13},(_,i)=>({...fixtures[3][0],id:`SYNTHETIC_S${i}`}));data[4]=Array.from({length:15},(_,i)=>({...fixtures[4][0],id:i===0?"":null,coverage_key:`SYNTHETIC_C${i}`}));
 const r=await page({data});assert.deepEqual(nodes(stream(r),"article").map(n=>n.key),data[0].slice(0,120).map(v=>v.id));assert.deepEqual(keys(panel(r,"אירועי אבטחה")),data[3].slice(0,8).map(v=>v.id));assert.deepEqual(keys(section(r,"כיסוי ביקורת")),data[4].map(v=>v.id??v.coverage_key));assert.equal(r.metrics[0].value,125);assert.equal(r.metrics[5].value,13);
});
test("legacy FIRST120 evenwhenprimaryempty, no legacy substitution into primarymetrics",async()=>{const data=structuredClone(fixtures);data[0]=[];data[1]=Array.from({length:125},(_,i)=>({...fixtures[1][0],id:`SYNTHETIC_L${i}`,event_category:i===0?"medical":null,event_type:"SYNTHETIC_LEGACY_IMMUTABLE_STYLE"}));const r=await page({data});const rows=nodes(stream(r),"article");assert.equal(rows.length,120);assert.equal(text(nodes(rows[0],"h3")[0]),"SYNTHETIC_LEGACY_IMMUTABLE_STYLE");assert.equal(text(nodes(rows[1],"h3")[0]),"SYNTHETIC_LEGACY_ACTION");assert.equal(r.metrics[0].value,0);assert.equal(r.metrics[1].value,0);assert.equal(r.metrics[2].value,0);});
test("row nullishnottruthy actor/garden/target/action/role/date and keys-only metadata",async()=>{
 const data=structuredClone(fixtures);data[0]=[{id:"s0",event_category:"medical",event_type:"SYNTHETIC_EVENT",target_type:"",risk_level:"",actor:{full_name:"",role:"NOT_USED"},actor_profile_id:"NOT_USED",gardens:{name:""},garden_id:"NOT_USED",event_hash:"SYNTHETIC_HASH_NEVER_DISPLAY",metadata:{safe_key:"SYNTHETIC_VALUE_NEVER_DISPLAY",email:"SYNTHETIC_VALUE_NEVER_DISPLAY"},created_at:"2026-11-05T00:00:00Z"},{id:"s1",event_category:"",action:"SYNTHETIC_ACTION",entity_type:"SYNTHETIC_ENTITY",entity_id:"SYNTHETIC_ID",risk_level:null,actor_role:"SYNTHETIC_ACTOR_ROLE",actor_profile_id:null,actor_id:"SYNTHETIC_ACTOR_ID",garden_id:"SYNTHETIC_GARDEN_ID",after_data:{after_key:"SYNTHETIC_VALUE_NEVER_DISPLAY"},metadata:{NOT_USED:"SYNTHETIC_VALUE_NEVER_DISPLAY"},created_at:null}];
 const r=await page({data}),rows=nodes(stream(r),"article");assert.ok(!text(rows).includes("NOT_USED"));assert.ok(!text(rows).includes("SYNTHETIC_VALUE_NEVER_DISPLAY"));assert.ok(!text(rows).includes("SYNTHETIC_HASH_NEVER_DISPLAY"));assert.equal(text(nodes(rows[0],"h3")[0]),"SYNTHETIC_EVENT");assert.equal(text(nodes(rows[0],"p")[0]),"medical · ");assert.equal(text(nodes(rows[1],"h3")[0]),"SYNTHETIC_ACTION");assert.ok(text(rows[1]).includes("after_key"));assert.ok(text(rows[1]).includes("SYNTHETIC_ACTOR_ROLE"));assert.ok(text(rows[0]).includes(new Date("2026-11-05T00:00:00Z").toLocaleString("he-IL")));
});
test("metadata exact first8 forbiddenkeyfilter arrays/null/type and NOvalues",async()=>{
 const f=(await page()).formatters;const metadata=Object.fromEntries(["token","SECRET","password","medical","phone","email","address","url","path","content","message",...Array.from({length:12},(_,i)=>`safe_${i}`)].map(k=>[k,"SYNTHETIC_VALUE_NEVER_DISPLAY"]));
 assert.deepEqual(Array.from(f.metadataKeys(metadata)),Array.from({length:8},(_,i)=>`safe_${i}`));for(const v of [null,[],false,"SYNTHETIC_TEXT",17])assert.deepEqual(Array.from(f.metadataKeys(v)),[]);
 const data=structuredClone(fixtures);data[0][0].metadata=metadata;const r=await page({data}),meta=nodes(nodes(stream(r),"article")[0],"div").find(n=>n.props.className==="platform-admin-safe-meta");assert.deepEqual(keys(meta),Array.from({length:8},(_,i)=>`safe_${i}`));assert.ok(!text(r.tree).includes("SYNTHETIC_VALUE_NEVER_DISPLAY"));
});
test("coverage RAWscores/keys/recommendation/routes/status and security RAWseverity/date",async()=>{
 const data=structuredClone(fixtures);data[4]=[{id:null,coverage_key:"SYNTHETIC_C",coverage_score:"085.50",title:"SYNTHETIC_TITLE",recommended_action:"SYNTHETIC_ACTION",audited_routes:"",required_routes:0,readiness_status:"SYNTHETIC_STATUS"}];data[3]=[{id:"SYNTHETIC_S",event_type:"SYNTHETIC_TYPE",severity:"HIGH",status:"SYNTHETIC_STATUS",created_at:"2026-11-05T00:00:00Z"}];const r=await page({data}),c=nodes(section(r,"כיסוי ביקורת"),"article")[0];assert.equal(c.key,"SYNTHETIC_C");assert.equal(text(nodes(c,"span")[0]),"085.50/100");assert.equal(nodes(c,"span")[0].props.className,"pill good");assert.ok(text(c).includes("/0 routes · SYNTHETIC_STATUS"));assert.equal(nodes(panel(r,"אירועי אבטחה"),"strong")[0].props.className,"pill good");
});
test("actual StatCard failed metrics neutral/noתקין staticfuture retained",async()=>{
 const r=await page({failures:Object.fromEntries([0,1,2,3,4].map(i=>[i,{kind:"reject"}]))}),actual=load(metricCode,id=>{if(id==="react/jsx-runtime")return{jsx,jsxs:jsx};if(id==="next/link")return{__esModule:true,default:"Link"};return unexpected(id);});
 for(const m of r.metrics.filter(m=>m.label!=="מוכנות ייצוא")){const n=actual.StatCard(m);assert.equal(n.props.className,"card stat stat-default");assert.ok(text(n).includes("לא זמין"));assert.ok(!text(n).includes("תקין"));}assert.equal(r.metrics[6].value,"עתידי");
});
test("riskTone STRICT and scoreTone80/55 thresholds plus fixedcategorylabels/ONEhook",async()=>{
 const f=(await page()).formatters;for(const [v,t] of [["critical","bad"],["high","bad"],["medium","warn"],["HIGH","good"],[{toString:()=>"critical"},"good"]])assert.equal(f.riskTone(v),t);for(const [v,t] of [[0,"bad"],[54.9,"bad"],[55,"warn"],[79.9,"warn"],[80,"good"],[150,"good"],[NaN,"bad"]])assert.equal(f.scoreTone(v),t);
 assert.deepEqual(Object.keys(f.categoryLabels),categories);
 const c=JSON.parse(source("config/digital-observer-ci-gates.json")),name="audit-logs-query-boundary";assert.deepEqual(c.domain.filter(v=>v.name===name),[{name,args:["--test","scripts/qa/check-audit-logs-query-boundary.mjs"]}]);assert.equal(c.security.filter(v=>v.name===name).length,0);
});
