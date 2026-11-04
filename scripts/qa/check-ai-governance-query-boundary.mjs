import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
// Actual page/helper, synthetic clients/JSX only. No live auth, DB or compliance proof.
const root = new URL("../../", import.meta.url);
const require = createRequire(new URL("package.json", root));
const ts = require("typescript");
function compile(path) {
  const source = readFileSync(new URL(path, root), "utf8");
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(result.diagnostics.length, 0);
  return result.outputText;
}
const pageJS = compile("app/dashboard/admin/ai-governance/page.tsx");
const helperJS = compile("lib/admin-safe.ts");
const contracts = [["responsible_ai_scores", [["select", "*"], ["order", "score_date", {"ascending": false}], ["limit", 40]]], ["ai_dpia_assessments", [["select", "*"], ["order", "updated_at", {"ascending": false}], ["limit", 120]]], ["ai_capabilities", [["select", "*"], ["order", "risk_classification"], ["order", "capability_name"], ["limit", 160]]], ["ai_explainability_records", [["select", "*"], ["order", "created_at", {"ascending": false}], ["limit", 120]]], ["ai_decision_audit_trail", [["select", "*"], ["order", "created_at", {"ascending": false}], ["limit", 120]]], ["ai_privacy_impact_registry", [["select", "*"], ["order", "updated_at", {"ascending": false}], ["limit", 120]]], ["ai_ethics_reviews", [["select", "*"], ["order", "updated_at", {"ascending": false}], ["limit", 120]]], ["ai_models", [["select", "id,model_key,model_name,category,lifecycle_status,deployment_status,human_approval_required,automatic_promotion_allowed,explainability_level,accuracy,updated_at"], ["order", "updated_at", {"ascending": false}], ["limit", 120]]], ["ai_model_deployments", [["select", "*"], ["order", "created_at", {"ascending": false}], ["limit", 80]]], ["ai_governance_reviews", [["select", "*"], ["order", "created_at", {"ascending": false}], ["limit", 120]]], ["vertical_capability_matrix", [["select", "*"], ["order", "vertical_key"], ["order", "capability_name"], ["limit", 220]]], ["parent_visibility_policy_rules", [["select", "*"], ["order", "source_type"], ["limit", 80]]]];
const normal = value => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
let externalCalls = 0;
const forbidden = () => { externalCalls++; throw Error("EXTERNAL_ACTION_FORBIDDEN"); };
function load(code, require, warnings) {
  const exports = {};
  vm.runInNewContext(code, { exports, require, Date, Intl, fetch: forbidden, console: { warn: (...args) => warnings.push(args) }, process: { env: {} } });
  return exports;
}
function nodes(value, type) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(item => nodes(item, type));
  return [...(value.type === type ? [value] : []), ...Object.values(value.props ?? {}).flatMap(item => nodes(item, type))];
}
function text(value) {
  if (value == null || typeof value === "boolean") return "";
  if (typeof value !== "object") return typeof value === "function" ? "" : String(value);
  return Array.isArray(value) ? value.map(text).join("") : text(value.props?.children);
}
const fixtures = [
  [{ responsible_ai_score: 91, explainability_score: 87 }],
  [{ id: "dpia", ai_system_name: "DPIA_HEALTHY", approval_status: "approved" }],
  [{ id: "cap", capability_name: "CAPABILITY_HEALTHY", legal_status: "restricted", automatic_action_allowed: true }],
  [{ id: "exp", output_summary: "EXPLANATION_HEALTHY" }],
  [{ id: "audit", ai_output_type: "AUDIT_HEALTHY", automatic_action_taken: false }],
  [{ id: "privacy", privacy_risk: "PRIVACY_HEALTHY" }],
  [{ id: "ethics", score: 93 }],
  [{ id: "model", lifecycle_status: "production" }],
  [{ id: "deployment", approval_status: "pending" }],
  [{ id: "review" }],
  [{ id: "matrix", capability_name: "MATRIX_HEALTHY", vertical_key: "home" }],
  [{ id: "visibility", visibility_status: "blocked" }]
];
async function page({ errors = [], rejected = [], missing = false, data = fixtures, loader = false, deny = false } = {}) {
  let clients = 0; const calls = [], warnings = [];
  const client = { from(table) {
    const index = calls.length, chain = []; assert.equal(table, contracts[index][0]); calls.push([table, chain]);
    const builder = {};
    for (const method of ["select", "order", "limit"]) builder[method] = (...args) => { chain.push([method, ...args]); return builder; };
    builder.then = (resolve, reject) => (rejected.includes(index) ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: errors.includes(index) && missing ? null : data[index], error: errors.includes(index) ? { message: "PRIVATE_SENTINEL" } : null })).then(resolve, reject);
    return builder;
  } };
  const helper = load(helperJS, forbidden, warnings);
  const loadedPage = load(pageJS, id => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "next/link") return { default: "Link" };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(calls.length, 0); if (deny) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_SENTINEL"); return client; } };
    throw Error("UNEXPECTED_IMPORT " + id);
  }, warnings);
  if (deny) { await assert.rejects(loadedPage.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls.length, 0); return; }
  const tree = await loadedPage.default();
  assert.equal(clients, 1); assert.equal(calls.length, loader ? 0 : 12);
  if (!loader) assert.deepEqual(normal(calls), contracts);
  assert.ok(!JSON.stringify(warnings).includes("SENTINEL")); assert.ok(!JSON.stringify(tree).includes("SENTINEL"));
  return { tree, text: text(tree), metrics: Object.fromEntries(nodes(tree, "RoleMetricCard").map(node => [node.props.label, node.props])), hero: nodes(tree, "PremiumDashboardHero")[0].props, banner: nodes(tree, "AdminDataError")[0].props.message };
}
function inline(result, label) { const row = nodes(result.tree, "div").find(node => text(node).startsWith(label) && nodes(node, "b").length === 1); return label + text(nodes(row, "b")[0]); }
const noData = "לא זמין";
async function checkFailure(index, options) {
  const result = await page(options); assert.ok(result.banner);
  assert.equal(result.metrics["Responsible AI"].value, index === 0 ? noData : "91/100");
  assert.equal(result.metrics["הסברתיות"].value, index === 0 ? noData : "87/100");
  assert.equal(result.metrics["DPIA"].value, index === 1 ? noData : "1/1");
  assert.equal(result.metrics["יכולות מוגבלות"].value, index === 2 ? noData : 1);
  assert.equal(result.metrics["פעולות אוטומטיות"].value, index === 2 ? noData : 1);
  assert.equal(result.metrics["ביקורת החלטות"].value, index === 4 ? noData : 1);
  if (index === 2) { assert.equal(result.metrics["יכולות מוגבלות"].tone, "default"); assert.equal(result.metrics["פעולות אוטומטיות"].tone, "default"); }
  const sentinels = { 1: "DPIA_HEALTHY", 2: "CAPABILITY_HEALTHY", 3: "EXPLANATION_HEALTHY", 4: "AUDIT_HEALTHY", 5: "PRIVACY_HEALTHY", 10: "MATRIX_HEALTHY" };
  for (const [source, sentinel] of Object.entries(sentinels)) assert.equal(result.text.includes(sentinel), Number(source) !== index);
  for (const [source, label, value] of [[6,"Ethics score","93/100"],[6,"Fairness/Bias/Privacy reviews","1"],[7,"Production models","1"],[8,"Unapproved deployments","1"],[11,"Parent blocked rules","1"]]) assert.equal(inline(result,label), label + (source === index ? noData : value));
  if (index === 5) assert.ok(!result.text.includes("אין רישום סיכוני פרטיות."));
  assert.equal(externalCalls, 0);
}
for (let index = 0; index < 12; index++) {
  test(`source ${index} returned error discards stale rows and retains independent metrics`, () => checkFailure(index, { errors: [index] }));
  test(`source ${index} missing errored data stays unavailable`, () => checkFailure(index, { errors: [index], missing: true }));
  test(`source ${index} rejection retains source availability`, () => checkFailure(index, { rejected: [index] }));
}
test("healthy nonempty measurements and query contracts are retained", async () => {
  const r = await page(); assert.equal(r.banner,null); assert.equal(r.hero.badge,"91/100"); assert.equal(r.metrics["הסברתיות"].value,"87/100"); assert.equal(r.metrics["פעולות אוטומטיות"].tone,"bad"); assert.equal(externalCalls,0);
});
test("healthy empty count registries stay zero and missing scores stay unmeasured", async () => {
  const r = await page({data:fixtures.map(()=>[])}); assert.equal(r.banner,null); assert.equal(r.hero.badge,"טרם נמדד"); assert.equal(r.metrics["הסברתיות"].value,"טרם נמדד"); assert.equal(r.metrics["יכולות מוגבלות"].value,0); assert.equal(r.metrics["פעולות אוטומטיות"].value,0); assert.equal(inline(r,"Ethics score"),"Ethics scoreטרם נמדד"); assert.ok(r.text.includes("אין רישום סיכוני פרטיות."));
});
test("explicit numeric zero remains measured and never triggers explanation fallback", async () => {
  const data=structuredClone(fixtures); data[0]=[{responsible_ai_score:0,explainability_score:0}]; data[6]=[{score:0}];
  const r=await page({data}); assert.equal(r.hero.badge,"0/100"); assert.equal(r.metrics["הסברתיות"].value,"0/100"); assert.equal(inline(r,"Ethics score"),"Ethics score0/100");
});
test("explanation fallback requires both healthy score and record sources", async () => {
  const data=structuredClone(fixtures);data[0]=[];
  const healthy=await page({data});assert.equal(healthy.metrics["הסברתיות"].value,"30/100");
  for(const index of [0,3]){const r=await page({data,errors:[index]});assert.equal(r.metrics["הסברתיות"].value,noData);}
  const explicit=await page({errors:[3]});assert.equal(explicit.metrics["הסברתיות"].value,"87/100");assert.equal(explicit.metrics["הסברתיות"].hint,"רשומות לא זמינות");
});
test("missing and nonfinite score observations do not invent measured zero", async()=>{
  const data=structuredClone(fixtures);data[0]=[{responsible_ai_score:null,explainability_score:"invalid"}];data[6]=[{score:null},{score:"invalid"}];
  const r=await page({data});assert.equal(r.hero.badge,"טרם נמדד");assert.equal(r.metrics["הסברתיות"].value,"טרם נמדד");assert.equal(inline(r,"Ethics score"),"Ethics scoreטרם נמדד");
});
test("paired failures preserve healthy independent values",async()=>{
  const r=await page({errors:[2,5,8]});assert.equal(r.metrics["פעולות אוטומטיות"].value,noData);assert.equal(r.metrics["Responsible AI"].value,"91/100");assert.equal(inline(r,"Unapproved deployments"),"Unapproved deploymentsלא זמין");assert.ok(r.text.includes("DPIA_HEALTHY"));assert.ok(r.text.includes("מרשם סיכוני הפרטיות לא זמין"));
});
test("outer loader failure never retains good zero risk registries",async()=>{
  const r=await page({loader:true});assert.ok(r.banner);assert.equal(r.hero.badge,noData);for(const metric of Object.values(r.metrics)){assert.equal(metric.value,noData);assert.equal(metric.tone,"default");}for(const label of ["Ethics score","Production models","Unapproved deployments","Parent blocked rules"])assert.equal(inline(r,label),label+noData);assert.ok(!r.text.includes("אין רישום סיכוני פרטיות."));
});
test("denied admission prevents client and all queries",async()=>{await page({deny:true});assert.equal(externalCalls,0);});
