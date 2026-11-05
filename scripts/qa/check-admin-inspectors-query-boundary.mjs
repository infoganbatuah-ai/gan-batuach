import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual readonly page + actual safeAdminData; only SYNTHETIC directory fixtures.
// Shared components/links are JSX boundaries, never invoked/navigated.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/inspectors/page.tsx")), helperCode = compile(source("lib/admin-safe.ts"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, fetch: unexpected, FormData: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const keys = ["inspectors", "gardens", "inspections", "tasks"];
const selections = ["id, service_cities, certification_notes, created_at, profiles!inspectors_id_fkey(full_name, phone, email, active, profile_image_url)", "id, name, city, inspector_id", "id, inspector_id, garden_id, completed_at, weighted_score, status, gardens:garden_id(name,city)", "id, assigned_to, status"];
const profile = { id: "SYNTHETIC_ADMIN", role: "admin" };
function fixtures() { return {
  inspectors: [{ id: "SYNTHETIC_I0", service_cities: ["SYNTHETIC_CITY0", "SYNTHETIC_CITY1"], profiles: { full_name: "SYNTHETIC_INSPECTOR", active: true, phone: "SYNTHETIC_UNUSED_PHONE", email: "SYNTHETIC_UNUSED_EMAIL", profile_image_url: "SYNTHETIC_UNUSED_IMAGE" } }],
  gardens: [{ id: "SYNTHETIC_G0", inspector_id: "SYNTHETIC_I0", name: "SYNTHETIC_GARDEN" }],
  inspections: [{ id: "SYNTHETIC_R0", inspector_id: "SYNTHETIC_I0", weighted_score: 89, status: "completed" }],
  tasks: [{ id: "SYNTHETIC_T0", assigned_to: "SYNTHETIC_I0", status: "open" }]
}; }
async function page({ data = fixtures(), failures = {}, denied = false, loader = false } = {}) {
  let clients = 0, calls = 0, captured;
  const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...args) => { calls++; const value = await actual.safeAdminData(...args); if (args[0] === "מפקחים") captured = value; return value; } };
  const client = { from(table) {
    const index = keys.indexOf(table); assert.notEqual(index, -1); assert.ok(!chains.some(x => x[0] === table)); const kind = failures[table], steps = [], q = {}; chains.push([table, steps]);
    if (kind === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "order", "neq"]) q[method] = (...a) => { steps.push([method, ...a]); return q; };
    q.then = (yes, no) => (kind === "reject" ? Promise.reject(Error("PRIVATE_REJECTION")) : Promise.resolve({ data: data[table], error: kind === "returned" ? { message: "PRIVATE_MESSAGE", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no);
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react") return { ClipboardCheck: "ClipboardCheck", UsersRound: "UsersRound" };
    if (id === "@/components/admin-app-ui") return { AdminAppFrame: "AdminAppFrame" };
    if (id === "@/components/admin-data-state") return { AdminDataError: "AdminDataError" };
    if (id === "@/components/gan-batuach-design-system") return Object.fromEntries(["DashboardGrid", "EmptyState", "ListRowCard", "MetricCard", "PremiumCard", "SectionHeader", "StatusChip"].map(k => [k, k]));
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); return { profile }; } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(clients, 1); assert.equal(calls, loader ? 1 : 5);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_")); assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_UNUSED_")); assert.equal(nodes(tree, "form").length, 0); assert.equal(nodes(tree, "button").length, 0);
  const r = { tree, text: text(tree), chains, warnings, data: captured.data, cards: nodes(tree, "MetricCard"), rows: nodes(tree, "ListRowCard"), frame: nodes(tree, "AdminAppFrame")[0], banner: nodes(tree, "AdminDataError")[0].props.message };
  assert.equal(r.frame.props.profile, profile); assert.equal(r.frame.props.activeHref, "/dashboard/admin/inspectors"); assert.equal(r.frame.props.title, "ניהול מפקחים"); assert.equal(r.frame.props.subtitle, "שיבוצים, עומסים, ביקורות פתוחות ומוכנות פיקוח."); assert.equal(r.frame.props.badge, "מפקחים");
  for (let i = 0; !loader && i < keys.length; i++) {
    const expected = failures[keys[i]] === "factory" ? [] : [["select", selections[i]], ...(i === 2 ? [["order", "completed_at", { ascending: false }]] : i === 3 ? [["neq", "status", "done"]] : [])];
    assert.deepEqual(plain(chains[i]), [keys[i], expected]); assert.equal(r.data.available[keys[i]], !failures[keys[i]]);
  }
  assert.equal(chains.length, loader ? 0 : 4);
  assert.equal(nodes(tree, "Link")[0].props.href, "/dashboard/admin/users/new-inspector");
  for (const row of r.rows) { assert.equal(row.props.href, "/dashboard/admin/users"); assert.deepEqual(nodes(row.props.actions, "Link").map(n => n.props.href), ["/dashboard/admin/inspection-forms", "/dashboard/admin/tasks"]); }
  return r;
}
const values = r => r.cards.map(n => n.props.value);
const tones = r => r.cards.map(n => n.props.tone);
const latest = r => nodes(r.rows[0]?.props.actions, "StatusChip");
function unknown(r, key) {
  assert.ok(r.banner);
  if (key === "inspectors") { assert.equal(r.rows.length, 0); assert.equal(nodes(r.tree, "EmptyState").length, 0); assert.deepEqual(values(r), ["לא זמין", "לא זמין", 1, 1]); assert.deepEqual(tones(r), ["muted", "muted", "primary", "warning"]); assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_INSPECTOR")); assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_CITY")); }
  else {
    assert.equal(r.rows.length, 1); assert.equal(r.rows[0].props.title, "SYNTHETIC_INSPECTOR"); assert.deepEqual(values(r).slice(0, 2), [1, 1]);
    if (key === "gardens") { assert.equal(r.cards[2].props.value, "לא זמין"); assert.equal(r.cards[2].props.tone, "muted"); assert.ok(r.rows[0].props.meta.startsWith("גנים משויכים: לא זמין")); assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_GARDEN")); assert.ok(r.rows[0].props.meta.includes("ביקורות שהושלמו: 1 · משימות פעילות: 1")); assert.equal(latest(r)[0].props.children, 89); }
    if (key === "tasks") { assert.equal(r.cards[3].props.value, "לא זמין"); assert.equal(r.cards[3].props.tone, "muted"); assert.ok(r.rows[0].props.meta.endsWith("משימות פעילות: לא זמין")); assert.ok(r.rows[0].props.meta.includes("SYNTHETIC_GARDEN")); assert.equal(latest(r)[0].props.children, 89); }
    if (key === "inspections") { assert.deepEqual(values(r), [1, 1, 1, 1]); assert.ok(r.rows[0].props.meta.includes("ביקורות שהושלמו: לא זמין")); assert.equal(latest(r).length, 1); assert.equal(latest(r)[0].props.tone, "muted"); assert.equal(latest(r)[0].props.children, "נתוני ביקורות לא זמינים"); assert.ok(!JSON.stringify(r.tree).includes('"children":89')); }
  }
}
test("healthy actualpage+helper exact4chains/admission/profile/list/status/links", async () => { const r = await page(); assert.equal(r.banner, null); assert.equal(r.warnings.length, 0); assert.deepEqual(values(r), [1, 1, 1, 1]); assert.deepEqual(tones(r), ["primary", "success", "primary", "warning"]); assert.equal(r.rows[0].key, "SYNTHETIC_I0"); assert.equal(r.rows[0].props.subtitle, "SYNTHETIC_CITY0, SYNTHETIC_CITY1"); assert.equal(r.rows[0].props.meta, "גנים משויכים: SYNTHETIC_GARDEN · ביקורות שהושלמו: 1 · משימות פעילות: 1"); assert.equal(latest(r)[0].props.children, 89); });
for (const key of keys) for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory"]) test(`${key}/${mode} discards source only/retains healthy independent metadata`, async () => { const data = fixtures(); if (mode === "returned-empty") data[key] = []; if (mode === "returned-null") data[key] = null; const kind = mode.startsWith("returned") ? "returned" : mode, r = await page({ data, failures: { [key]: kind } }); unknown(r, key); assert.equal(r.warnings.length, 1); assert.equal(r.warnings[0][0], kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:"); });
test("outer loader all unknown no queries/stale rows/ordinaryempty", async () => { const r = await page({ loader: true }); assert.equal(r.rows.length, 0); assert.equal(nodes(r.tree, "EmptyState").length, 0); assert.deepEqual(values(r), ["לא זמין", "לא זמין", "לא זמין", "לא זמין"]); assert.deepEqual(tones(r), ["muted", "muted", "muted", "muted"]); assert.ok(r.banner); });
test("denied admin0helper/client/query", async () => page({ denied: true }));
for (const v of [[], null]) test(`all healthy ${v === null ? "null" : "empty"} knownzero/originalempty/tones`, async () => { const r = await page({ data: Object.fromEntries(keys.map(k => [k, v])) }); assert.equal(r.banner, null); assert.deepEqual(values(r), [0, 0, 0, 0]); assert.deepEqual(tones(r), ["primary", "success", "primary", "success"]); assert.equal(nodes(r.tree, "EmptyState").length, 1); assert.ok(Object.values(r.data.available).every(Boolean)); });
for (const [a, b, expected] of [["inspectors", "tasks", ["לא זמין", "לא זמין", 1, "לא זמין"]], ["gardens", "inspections", [1, 1, "לא זמין", 1]], ["inspections", "tasks", [1, 1, 1, "לא זמין"]]]) test(`paired ${a}+${b} known KPI and row-neighbor preservation`, async () => { const r = await page({ failures: { [a]: "returned", [b]: "reject" } }); assert.deepEqual(values(r), expected); assert.equal(r.warnings.length, 2); if (a !== "inspectors") assert.equal(r.rows[0].props.title, "SYNTHETIC_INSPECTOR"); });
for (const active of [false, true, null, undefined, 0, "", "truthy"]) for (const shape of ["object", "array"]) test(`profile ${shape}/active ${String(active)} strictfalse only`, async () => { const data = fixtures(), p = { full_name: "SYNTHETIC_NAME", active }; data.inspectors[0].profiles = shape === "array" ? [p, { full_name: "SYNTHETIC_IGNORED_SECOND", active: !active }] : p; const r = await page({ data }); assert.equal(r.cards[1].props.value, active === false ? 0 : 1); assert.equal(r.rows[0].props.title, "SYNTHETIC_NAME"); assert.equal(r.rows[0].props.status.props.tone, active === false ? "danger" : "success"); assert.equal(text(r.rows[0].props.status), active === false ? "לא פעיל" : "פעיל"); assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_IGNORED_SECOND")); });
for (const p of [[], null, undefined]) test(`profile missing ${JSON.stringify(p)} preserves original active/defaultname`, async () => { const data = fixtures(); data.inspectors[0].profiles = p; const r = await page({ data }); assert.equal(r.cards[1].props.value, 1); assert.equal(r.rows[0].props.title, "מפקח"); assert.equal(r.rows[0].props.status.props.tone, "success"); });
for (const v of [0, ""]) test(`raw nullish name/id ${JSON.stringify(v)} not truthy-normalized`, async () => { const data = fixtures(); data.inspectors[0].id = v; data.inspectors[0].profiles.full_name = v; const r = await page({ data }); assert.equal(r.rows[0].key, v); assert.equal(r.rows[0].props.title, v); });
for (const [cities, expected] of [[[], ""], [null, "אזור לא צוין"], ["SYNTHETIC_NOT_ARRAY", "אזור לא צוין"], [["", "SYNTHETIC_CITY"], ", SYNTHETIC_CITY"]]) test(`cities ${JSON.stringify(cities)} originalArrayjoin/fallback`, async () => { const data = fixtures(); data.inspectors[0].service_cities = cities; const r = await page({ data }); assert.equal(r.rows[0].props.subtitle, expected); });
test("garden/task truthy grouping/count includes unknown directory IDs and raw task statuses", async () => { const data = fixtures(); data.gardens = ["SYNTHETIC_I0", "SYNTHETIC_UNKNOWN", null, "", 0, false, "SYNTHETIC_I0"].map((id, i) => ({ inspector_id: id, name: `SYNTHETIC_GARDEN_${i}` })); data.tasks = ["SYNTHETIC_I0", "SYNTHETIC_UNKNOWN", null, "", 0, false, "SYNTHETIC_I0"].map((id, i) => ({ assigned_to: id, status: i === 6 ? "done" : "SYNTHETIC_RAW_STATUS" })); const r = await page({ data }); assert.deepEqual(values(r), [1, 1, 3, 3]); assert.equal(r.rows[0].props.meta, "גנים משויכים: SYNTHETIC_GARDEN_0, SYNTHETIC_GARDEN_6 · ביקורות שהושלמו: 1 · משימות פעילות: 2"); assert.deepEqual(plain(r.data.gardensByInspector.SYNTHETIC_I0.map(x => x.name)), ["SYNTHETIC_GARDEN_0", "SYNTHETIC_GARDEN_6"]); });
test("known empty joins retain dash/completed0/tasks0/no latest chip", async () => { const data = fixtures(); data.gardens = []; data.inspections = []; data.tasks = []; const r = await page({ data }); assert.equal(r.rows[0].props.meta, "גנים משויכים: - · ביקורות שהושלמו: 0 · משימות פעילות: 0"); assert.equal(latest(r).length, 0); assert.deepEqual(values(r), [1, 1, 0, 0]); });
for (const [status, count, label] of [["done", 1, "הושלמה"], ["completed", 1, "הושלמה"], ["DONE", 0, "הושלמה"], ["Completed", 0, "הושלמה"], ["in_progress", 0, "בביצוע"], ["planned", 0, "מתוכננת"], ["scheduled", 0, "מתוכננת"], ["pending", 0, "ממתינה"], ["overdue", 0, "באיחור"], [null, 0, "פתוחה"], ["", 0, "פתוחה"], [{ toString: () => "done" }, 1, "הושלמה"]]) test(`completion String vs lowercase label ${String(status)}/${typeof status}`, async () => { const data = fixtures(); data.inspections[0].status = status; data.inspections[0].weighted_score = null; const r = await page({ data }); assert.ok(r.rows[0].props.meta.includes(`ביקורות שהושלמו: ${count}`)); assert.equal(latest(r)[0].props.children, label); });
for (const score of [0, "", 47]) test(`FIRST latest raw score ${JSON.stringify(score)} wins withoutsort/coercion`, async () => { const data = fixtures(); data.inspections = [{ ...data.inspections[0], weighted_score: score, completed_at: "SYNTHETIC_OLD" }, { ...data.inspections[0], weighted_score: 99, completed_at: "SYNTHETIC_NEW" }]; const r = await page({ data }); assert.equal(latest(r)[0].props.children, score); assert.ok(r.rows[0].props.meta.includes("ביקורות שהושלמו: 2")); });
test("healthy garden empty names preserve original joinORdash", async () => { const data = fixtures(); data.gardens[0].name = ""; const r = await page({ data }); assert.ok(r.rows[0].props.meta.startsWith("גנים משויכים: -")); assert.equal(r.cards[2].props.value, 1); });
test("healthy duplicate directory IDs/order/no local clamp preserved", async () => { const data = fixtures(); data.inspectors = [data.inspectors[0], { ...data.inspectors[0], profiles: [] }, { ...data.inspectors[0], id: "SYNTHETIC_LAST" }]; const r = await page({ data }); assert.deepEqual(r.rows.map(n => n.key), ["SYNTHETIC_I0", "SYNTHETIC_I0", "SYNTHETIC_LAST"]); assert.deepEqual(values(r).slice(0, 2), [3, 3]); });
test("ONE exact DOMAIN hook no unrelated security hook", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-inspectors-query-boundary"; assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-inspectors-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0); });
