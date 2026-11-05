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
const pageCode = compile(source("app/dashboard/admin/documents/page.tsx")) + "\nexports.qaFields=documentFields;";
const helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }



const policyCode = compile(source("lib/management/document-policy.ts"));

const fields="id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";
const profile={id:"SYNTHETIC_PROFILE",role:"admin"};
const doc=(id,extra={})=>({id,garden_id:"SYNTHETIC_G1",owner_type:"garden",uploaded_by:"SYNTHETIC_OTHER",name:"SYNTHETIC_NAME",document_type:"garden_document",status:"pending_review",created_at:"2026-11-05T00:00:00Z",file_url:`/api/documents/${id}/file`,...extra});
const fixtureDocs=[doc("SYNTHETIC_D0"),doc("SYNTHETIC_D1",{owner_type:"inspection",uploaded_by:profile.id}),doc("SYNTHETIC_D2",{garden_id:"SYNTHETIC_G2",owner_type:"teacher",status:"valid",expires_at:"2026-12-31"}),doc("SYNTHETIC_D3",{garden_id:null,owner_type:"guardian",file_url:"/not-approved"})];
const fixtureGardens=[{id:"SYNTHETIC_G1",name:"SYNTHETIC_FIRST"},{id:"SYNTHETIC_G1",name:"SYNTHETIC_LAST"},{id:"SYNTHETIC_G2",name:"SYNTHETIC_SECOND"}];
async function page({failure=null,secondary=null,docs=fixtureDocs,gardens=fixtureGardens,loader=false,deny=false,nullPrimary=false,nullLookup=false}={}){
 let clients=0,policyCalls=0,captured;const chains=[],warnings=[],settled=new Set();
 const safe=load(helperCode,unexpected,warnings),policy=load(policyCode,unexpected);
 const helper={...safe,safeAdminData:async(...a)=>{captured=await safe.safeAdminData(...a);return captured;}};
 const client={from(table){const index=chains.length,calls=[],q={},f=index===0?failure:secondary;
 assert.ok(index<2);assert.equal(table,index===0?"documents":"gardens");if(index===1){assert.ok(settled.has(0));assert.equal(policyCalls,0);}chains.push([table,calls]);
 if(f?.kind==="factory")throw Error("PRIVATE_FACTORY");
 for(const m of ["select","is","order","limit","in"])q[m]=(...a)=>{calls.push([m,...a]);return q;};
 q.then=(a,b)=>{
  assert.equal(chains.length,index+1,"strict sequential query, not parallel");
  const rows=index===0?docs:gardens,isNull=index===0?nullPrimary:nullLookup;
  const promise=f?.kind==="reject"?Promise.reject(Error("PRIVATE_SENTINEL")):Promise.resolve({data:isNull?null:f&&!f.stale?[]:rows,error:f?{message:"PRIVATE_SENTINEL",details:"PRIVATE_DETAILS"}:null});
  return promise.then(value=>{settled.add(index);return value;},error=>{settled.add(index);throw error;}).then(a,b);
 };return q;}};
 const p=load(pageCode,id=>{
  if(id==="react/jsx-runtime")return{jsx,jsxs:jsx};
  if(id==="@/components/dashboard-shell")return{DashboardShell:"DashboardShell"};
  if(id==="@/components/documents-platform")return{DocumentsPlatform:"DocumentsPlatform"};
  if(id==="@/lib/admin-safe")return helper;
  if(id==="@/lib/auth")return{requireRole:async roles=>{assert.deepEqual(Array.from(roles),["admin"]);assert.equal(clients,0);assert.equal(policyCalls,0);if(deny)throw Error("DENIED");return{profile};}};
  if(id==="@/lib/management/document-policy")return{effectiveDocumentStatus:row=>{assert.ok(settled.has(0));if(chains.length===2)assert.ok(settled.has(1)||secondary?.kind==="factory");policyCalls++;return policy.effectiveDocumentStatus(row);}};
  if(id==="@/lib/supabase/server")return{createClient:async()=>{clients++;if(loader)throw Error("PRIVATE_LOADER");return client;}};
  return unexpected(id);
 },warnings);
 assert.equal(p.qaFields,fields);
 if(deny){await assert.rejects(p.default(),/DENIED/);assert.equal(clients,0);assert.equal(policyCalls,0);assert.equal(chains.length,0);return;}
 const tree=await p.default(),shell=nodes(tree,"DashboardShell")[0];assert.equal(shell.props.role,"admin");assert.equal(shell.props.title,"מרכז מסמכים");
 assert.equal(nodes(tree,"form").length,0);assert.equal(nodes(tree,"a").length,0);assert.equal(nodes(tree,"button").length,0);
 assert.ok(!JSON.stringify([tree,warnings]).includes("PRIVATE_"));
 return{tree,text:text(tree),clients,chains,warnings,policyCalls,data:captured.data,platform:nodes(tree,"DocumentsPlatform")[0]?.props};
}
const primaryChain=[["select",fields],["is","deleted_at",null],["order","created_at",{ascending:false}],["limit",120]];
function queryContracts(r,{factory=null,lookup=true,ids=["SYNTHETIC_G1","SYNTHETIC_G2"]}={}){
 assert.equal(r.clients,1);
 assert.deepEqual(plain(r.chains),[["documents",factory===0?[]:primaryChain],...(lookup?[["gardens",factory===1?[]:[["select","id,name"],["in","id",ids]]]]:[])]);
}
const platformProps={title:"בקרת מסמכים",subtitle:"תור אימות מורשה למסמכי גן, בעלים, הוראה וביקורת. מסמכי משפחה וצוות נשארים מחוץ לטווח האדמין.",canReview:true,roleLabel:"אדמין",limitedMessage:"הגישה כאן משתמשת בהרשאות המשתמש וב־RLS. ראיות ביקורת, קבצי הודעות ומסמכים משפחתיים אינם נכללים במרכז הזה."};
function props(r){assert.ok(r.platform);const{rows,...rest}=r.platform;assert.deepEqual(plain(rest),platformProps);return rows;}
function unavailable(r){assert.equal(r.platform,undefined);assert.equal(r.policyCalls,0);assert.equal(r.data.primaryAvailable,false);assert.equal(r.data.lookupState,"not_requested");assert.deepEqual(Array.from(r.data.rows),[]);assert.ok(r.text.includes("רשימת המסמכים אינה זמינה"));assert.ok(r.text.includes("לא ניתן לקבוע אם קיימים מסמכים"));assert.equal(nodes(r.tree,"EmptyState").length,0);assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_D"));assert.ok(!JSON.stringify(r.tree).includes("/api/documents/"));}
function healthyRows(r,partial=false){
 const rows=props(r);assert.equal(r.policyCalls,fixtureDocs.length);assert.equal(r.data.primaryAvailable,true);assert.equal(r.data.lookupState,partial?"unavailable":"available");
 assert.deepEqual(rows.map(v=>v.id),fixtureDocs.map(v=>v.id));assert.deepEqual(rows.map(v=>v.effective_status),["pending_review","pending_review","valid","pending_review"]);assert.deepEqual(rows.map(v=>v.can_review),[true,false,true,false]);
 assert.deepEqual(rows.map(v=>v.file_url),fixtureDocs.map((v,i)=>i===3?null:v.file_url));
 assert.deepEqual(rows.map(v=>v.garden_name),partial?Array(4).fill("שם הגן לא זמין"):["SYNTHETIC_LAST","SYNTHETIC_LAST","SYNTHETIC_SECOND","גן מורשה"]);
 assert.deepEqual(rows.map(v=>v.context_name),partial?["שם הגן לא זמין","ביקורת · שם הגן לא זמין","שם הגן לא זמין","שם הגן לא זמין"]:["SYNTHETIC_LAST","ביקורת · SYNTHETIC_LAST","SYNTHETIC_SECOND","מסמך ארגוני"]);
 for(let i=0;i<rows.length;i++){const{effective_status,file_url,garden_name,context_name,can_review,...rest}=rows[i];const{file_url:originalURL,...original}=fixtureDocs[i];assert.equal(typeof effective_status,"string");assert.equal(typeof can_review,"boolean");assert.equal(typeof garden_name,"string");assert.equal(typeof context_name,"string");assert.ok(file_url===null||file_url===originalURL);assert.deepEqual(plain(rest),original);}
 if(partial){assert.ok(r.text.includes("רשומות המסמכים נטענו, אך שמות הגנים אינם זמינים"));assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_LAST"));assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_SECOND"));}
}

test("healthy actualpage+actualpolicy sequentialqueries dedup/Maplast/securityprops",async()=>{const r=await page();queryContracts(r);healthyRows(r);assert.equal(r.data.queryError,null);assert.equal(r.warnings.length,0);});
for(const kind of ["returned","reject"])for(const stale of [false,true])test(`primary ${kind}/${stale?"stale":"empty"} absentplatform/0policy/skiplookup`,async()=>{const r=await page({failure:{kind,stale}});queryContracts(r,{lookup:false});unavailable(r);assert.deepEqual(plain(r.warnings),[["Admin Supabase query unavailable:","admin documents primary"]]);});
test("primary factorythrow safeunknown no secondary/policy",async()=>{const r=await page({failure:{kind:"factory"}});queryContracts(r,{lookup:false,factory:0});unavailable(r);assert.equal(r.warnings.length,1);});
test("loader safeunknown/0queries/0policy and denial0client/queries/policy",async()=>{const r=await page({loader:true});unavailable(r);assert.equal(r.chains.length,0);assert.deepEqual(plain(r.warnings),[["Admin page data unavailable:","admin documents"]]);await page({deny:true});});
for(const kind of ["returned","reject"])for(const stale of [false,true])test(`lookup ${kind}/${stale?"stale":"empty"} primaryretained/unknownlabels/reviewunchanged`,async()=>{const r=await page({secondary:{kind,stale}});queryContracts(r);healthyRows(r,true);assert.deepEqual(plain(r.warnings),[["Admin Supabase query unavailable:","admin documents gardens"]]);});
test("lookup factorythrow retainsprimaryrows and independentcanreview",async()=>{const r=await page({secondary:{kind:"factory"}});queryContracts(r,{factory:1});healthyRows(r,true);assert.equal(r.warnings.length,1);});
for(const nullPrimary of [false,true])test(`healthyprimary${nullPrimary?"null":"empty"} legitimateemptyplatform/nolookup/0policy`,async()=>{const r=await page({docs:[],nullPrimary});queryContracts(r,{lookup:false});assert.deepEqual(Array.from(props(r)),[]);assert.equal(r.policyCalls,0);assert.equal(r.data.primaryAvailable,true);assert.equal(r.data.lookupState,"not_needed");assert.equal(r.data.queryError,null);assert.equal(r.text,"");});
for(const nullLookup of [false,true])test(`healthylookup${nullLookup?"null":"empty"} originalfallback NOTpartial`,async()=>{const r=await page({gardens:[],nullLookup});queryContracts(r);const rows=props(r);assert.deepEqual(rows.map(v=>v.garden_name),Array(4).fill("גן מורשה"));assert.deepEqual(rows.map(v=>v.context_name),["מסמך ארגוני","ביקורת · גן","מסמך ארגוני","מסמך ארגוני"]);assert.equal(r.data.lookupState,"available");assert.equal(r.data.queryError,null);assert.equal(r.warnings.length,0);});
test("allnoIDs NOTNEEDEDlookup originalfallbacks noerror",async()=>{const docs=[doc("SYNTHETIC_N0",{garden_id:null}),doc("SYNTHETIC_N1",{garden_id:"",owner_type:"inspection"})],r=await page({docs});queryContracts(r,{lookup:false});const rows=props(r);assert.equal(r.data.lookupState,"not_needed");assert.deepEqual(rows.map(v=>v.garden_name),["גן מורשה","גן מורשה"]);assert.deepEqual(rows.map(v=>v.context_name),["מסמך ארגוני","ביקורת · גן"]);assert.equal(r.warnings.length,0);});
test("gardenIds originalSetorder/filterBoolean and noextra lookup/queries",async()=>{const docs=["SYNTHETIC_G2","SYNTHETIC_G1","SYNTHETIC_G2",null,"",0,false,"SYNTHETIC_G3"].map((garden_id,i)=>doc(`SYNTHETIC_I${i}`,{garden_id}));const r=await page({docs});queryContracts(r,{ids:["SYNTHETIC_G2","SYNTHETIC_G1","SYNTHETIC_G3"]});assert.equal(props(r).length,docs.length);});
test("Map LASTduplicate/emptystring NULLISH nottruthy/missingID semantics",async()=>{const gardens=[{id:"SYNTHETIC_G1",name:"SYNTHETIC_FIRST"},{id:"SYNTHETIC_G1",name:""},{id:"SYNTHETIC_G2",name:null}];const r=await page({gardens});const rows=props(r);assert.deepEqual(rows.map(v=>v.garden_name),["","","גן מורשה","גן מורשה"]);assert.deepEqual(rows.map(v=>v.context_name),["","ביקורת · ","מסמך ארגוני","מסמך ארגוני"]);assert.equal(r.data.queryError,null);});
for(const [owner,review] of [["garden",true],["owner",true],["teacher",true],["inspection",true],["staff",false],["guardian",false],["child",false],["GARDEN",false],[null,false],[{toString:()=>"teacher"},true]])test(`canreview Stringowner ${String(owner)} EXACToriginalscope`,async()=>{const r=await page({docs:[doc("SYNTHETIC_O",{owner_type:owner})]});assert.equal(props(r)[0].can_review,review);});
for(const [uploaded_by,expected]of [[profile.id,false],["SYNTHETIC_OTHER",true],[null,true],[undefined,true],[{toString:()=>profile.id},true]])test(`canreview STRICTuploadedBy ${typeof uploaded_by}/${expected}`,async()=>{const r=await page({docs:[doc("SYNTHETIC_U",{uploaded_by})]});assert.equal(props(r)[0].can_review,expected);});
for(const [url,expected]of [["/api/documents/SYNTHETIC_F/file","/api/documents/SYNTHETIC_F/file"],["/api/documents/SYNTHETIC_F/file?x=1",null],["/api/documents/OTHER/file",null],["/not-approved",null],["",null],[null,null],[{toString:()=>"/api/documents/SYNTHETIC_F/file"},null]])test(`fileURL STRICT exactboundrelative ${typeof url}/${String(url)}`,async()=>{const r=await page({docs:[doc("SYNTHETIC_F",{file_url:url})]});assert.equal(props(r)[0].file_url,expected);});
for(const [extra,status]of [
 [{status:"valid",deleted_at:"SYNTHETIC_DELETED",replaced_by:"SYNTHETIC_REPLACED",expires_at:"2026-11-04"},"deleted"],
 [{status:"valid",deleted_at:"",replaced_by:"SYNTHETIC_REPLACED",expires_at:"2026-11-04"},"replaced"],
 [{status:"valid",expires_at:"2026-11-04"},"expired"],
 [{status:"valid",expires_at:"2026-11-05"},"expiring_soon"],
 [{status:"valid",expires_at:"2026-12-05"},"expiring_soon"],
 [{status:"valid",expires_at:"2026-12-06"},"valid"],
 [{status:"valid",expires_at:"2026-11-06",reminder_days_before:0},"valid"],
 [{status:"valid",expires_at:"2026-11-05",reminder_days_before:-5},"expiring_soon"],
 [{status:"valid",expires_at:"2027-11-05",reminder_days_before:999},"expiring_soon"],
 [{status:"valid",expires_at:"2027-11-06",reminder_days_before:999},"valid"],
 [{status:"pending_review",expires_at:"2026-11-06"},"pending_review"],
 [{status:""},"pending_review"],[{status:null},"pending_review"],[{status:"SYNTHETIC_STATUS"},"SYNTHETIC_STATUS"]
])test(`actualeffectiveDocumentStatus ${JSON.stringify(extra)} =>${status}`,async()=>{const r=await page({docs:[doc("SYNTHETIC_P",extra)]});assert.equal(props(r)[0].effective_status,status);assert.equal(r.policyCalls,1);});
test("context STRICTinspection vs Stringreview predicate preserved",async()=>{const r=await page({docs:[doc("SYNTHETIC_C",{owner_type:{toString:()=>"inspection"}})]});assert.equal(props(r)[0].can_review,true);assert.equal(props(r)[0].context_name,"SYNTHETIC_LAST");});
test("unavailable primary never passes stale URLs, review or upload props; fixedshellneutral",async()=>{const r=await page({failure:{kind:"returned",stale:true}});unavailable(r);assert.equal(nodes(r.tree,"DocumentsPlatform").length,0);assert.equal(nodes(r.tree,"section")[0].props.className,"card");assert.equal(nodes(r.tree,"section")[0].props.role,"status");assert.equal(nodes(r.tree,"section")[0].props["aria-label"],"נתוני מסמכים לא זמינים");});
test("oneDOMAINhook and no unrelatedsecurityhook",()=>{const c=JSON.parse(source("config/digital-observer-ci-gates.json")),name="admin-documents-query-boundary";assert.deepEqual(c.domain.filter(v=>v.name===name),[{name,args:["--test","scripts/qa/check-admin-documents-query-boundary.mjs"]}]);assert.equal(c.security.filter(v=>v.name===name).length,0);});
