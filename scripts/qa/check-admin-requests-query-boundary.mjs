import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page and shared safe loader/metric initial render; synthetic requests only.
// No approval, payment, affiliation, navigation, API or database action runs.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/requests/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const metricCode = compile(source("components/premium-dashboard.tsx"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) {
  const exports = {};
  vm.runInNewContext(code, { exports, require, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } });
  return exports;
}
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const tables = ["kindergarten_enrollment_requests", "staff_job_applications", "inspector_applications", "user_affiliation_requests", "gardens"];
const projections = ["id,status,payment_status,created_at,gardens(name,city),permanent_child_files:child_profile_id(full_name),profiles:parent_id(full_name)", "id,status,created_at,gardens(name,city),staff_candidate_profiles:staff_candidate_id(full_name)", "id,status,created_at,full_name,city,duplicate_flags", "id,status,request_type,target_type,created_at", "id,name,city,approval_flow_status,created_at"];
const gardenStatuses = ["activation_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "payment_pending"];
const panels = ["בקשות הורים", "מועמדויות צוות", "בקשות מפקחים"];
const metricLabels = [...panels, "בקשות גנים"];
const metricSources = [0, 1, 2, 4];
const rowLinks = ["/dashboard/garden/enrollment-requests", "/dashboard/garden/staff-applications", "/dashboard/admin/inspector-applications"];
const actions = [
  { title: "בקשות גנים", text: "אישור מנהלות, פרופיל גן ומנוי", href: "/dashboard/admin/kindergarten-applications", icon: "Building2" },
  { title: "בקשות מפקחים", text: "אישור, דחייה ושיוך גנים", href: "/dashboard/admin/inspector-applications", icon: "ClipboardCheck" },
  { title: "משתמשים", text: "ניהול חשבונות קיימים", href: "/dashboard/admin/users", icon: "ShieldAlert" }
];
function fixtures() { return tables.map((_, i) => [{ id: `SYNTHETIC_ID_${i}`, status: i === 4 ? undefined : "submitted", approval_flow_status: "payment_pending", payment_status: "SYNTHETIC_PAYMENT", gardens: { name: `SYNTHETIC_GARDEN_${i}` }, permanent_child_files: { full_name: "SYNTHETIC_CHILD" }, profiles: { full_name: "SYNTHETIC_UNUSED_PARENT" }, staff_candidate_profiles: { full_name: "SYNTHETIC_CANDIDATE" }, full_name: "SYNTHETIC_INSPECTOR", city: "SYNTHETIC_CITY", duplicate_flags: "SYNTHETIC_UNUSED_DUPLICATES", request_type: "SYNTHETIC_UNUSED_REQUEST_TYPE" }]); }
async function page({ failures = {}, data = fixtures(), loader = false, denied = false } = {}) {
  let clients = 0, helperCalls = 0;
  const chains = [], warnings = [];
  const actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: (...a) => { helperCalls++; assert.match(a[0], /^admin requests overview(?: [0-4])?$/); return actual.safeAdminData(...a); } };
  const client = { from(table) {
    const index = tables.indexOf(table); assert.ok(index >= 0); assert.equal(chains.length, index);
    const calls = [], q = {}; chains.push([table, calls]);
    const kind = failures[index];
    if (kind === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "in", "order", "limit"]) q[method] = (...args) => { calls.push([method, ...args]); return q; };
    q.then = (yes, no) => {
      assert.equal(chains.length, 5, "all five factories invoked in one batch before settlement");
      return (kind === "reject" ? Promise.reject(Error("PRIVATE_QUERY")) : Promise.resolve({ data: data[index], error: kind === "returned" ? { message: "PRIVATE_QUERY", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no);
    };
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    if (id === "@/components/dashboard-shell") return { DashboardShell: "DashboardShell" };
    if (id === "@/components/premium-dashboard") return { ActionCard: "ActionCard", RoleMetricCard: "RoleMetricCard" };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default();
  assert.equal(clients, 1); assert.equal(helperCalls, loader ? 1 : 6);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_")); assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_UNUSED_"));
  assert.equal(nodes(tree, "button").length, 0); assert.equal(nodes(tree, "form").length, 0);
  return { tree, text: text(tree), chains, warnings, cards: nodes(tree, "RoleMetricCard"), panels: nodes(tree, "article"), hero: nodes(tree, "section").find(n => n.props.className === "dashboard-hero-card admin-hero-card") };
}
function queryAndStatic(r, failures = {}, loader = false) {
  assert.deepEqual(plain(r.chains), loader ? [] : tables.map((t, i) => [t, failures[i] === "factory" ? [] : [["select", projections[i]], ...(i === 4 ? [["in", "approval_flow_status", gardenStatuses]] : []), ["order", "created_at", { ascending: false }], ["limit", 80]]]));
  const shell = nodes(r.tree, "DashboardShell")[0]; assert.equal(shell.props.role, "admin"); assert.equal(shell.props.title, "בקשות משתמשים");
  assert.equal(text(nodes(r.hero, "h1")[0]), "מרכז בקשות הרשמה ושיוך.");
  assert.ok(text(r.hero).includes("הורים, מועמדי צוות ומועמדי מפקחים נשארים מוגבלים עד אישור הגורם המתאים."));
  assert.deepEqual(plain(nodes(r.tree, "ActionCard").map(n => n.props)), actions);
  assert.deepEqual(r.cards.map(n => n.props.label), metricLabels); assert.equal(r.panels.length, 3);
  assert.deepEqual(r.panels.map(n => text(nodes(n, "h2")[0]).trim()), panels);
}
function availability(r, failures, data, loader = false) {
  const failed = i => loader || Boolean(failures[i]);
  assert.deepEqual(r.cards.map(n => n.props.value), metricSources.map(i => failed(i) ? "לא זמין" : (data[i] ?? []).length));
  for (const [i, panel] of r.panels.entries()) {
    const links = nodes(panel, "Link");
    assert.deepEqual(links.map(n => n.key), failed(i) ? [] : (data[i] ?? []).slice(0, 12).map(n => n.id));
    assert.ok(links.every(n => n.props.href === rowLinks[i]));
    assert.equal(nodes(panel, "p").filter(n => n.props.role === "status").length, failed(i) ? 1 : 0);
  }
  const unknown = loader || Object.keys(failures).length > 0;
  if (unknown) {
    assert.ok(text(r.hero).includes("סיכום הבקשות אינו זמין")); assert.ok(!text(r.hero).includes(" פתוחות"));
    const badge = nodes(r.hero, "span")[0]; assert.equal(badge.props.className, "pill"); assert.equal(badge.props.role, "status");
    assert.ok(r.text.includes("לא ניתן לטעון חלק מנתוני הבקשות כרגע. הסיכום הכולל אינו זמין."));
  } else assert.ok(!r.text.includes("אינו זמין"));
}
function warnings(r, failures, loader = false) {
  assert.deepEqual(plain(r.warnings).sort((a, b) => a[1].localeCompare(b[1])), loader ? [["Admin page data unavailable:", "admin requests overview"]] : Object.entries(failures).map(([i, kind]) => [kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:", `admin requests overview ${i}`]));
}
test("healthy actual page exact five concurrent queries/static scope/raw rows", async () => {
  const data = fixtures(), r = await page({ data }); queryAndStatic(r); availability(r, {}, data); warnings(r, {});
  assert.ok(text(r.hero).endsWith("5 פתוחות")); assert.equal(nodes(r.hero, "span")[0].props.className, "pill warn");
  assert.ok(text(r.panels[0]).includes("SYNTHETIC_CHILD")); assert.ok(text(r.panels[0]).includes("SYNTHETIC_PAYMENT"));
  assert.ok(text(r.panels[1]).includes("SYNTHETIC_CANDIDATE")); assert.ok(text(r.panels[2]).includes("SYNTHETIC_INSPECTOR"));
});
for (let index = 0; index < 5; index++) for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory"]) test(`source${index}/${mode} independently unknown no stale rows/false metrics`, async () => {
  const data = fixtures(), failures = { [index]: mode.startsWith("returned") ? "returned" : mode };
  if (mode === "returned-empty") data[index] = []; if (mode === "returned-null") data[index] = null;
  const r = await page({ failures, data }); queryAndStatic(r, failures); availability(r, failures, data); warnings(r, failures);
  if (index < 3) assert.ok(!JSON.stringify(r.panels[index]).includes("SYNTHETIC_"));
});
for (const [a, b] of [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]) test(`paired${a}/${b} rejection+factory keeps all healthy independent inputs`, async () => {
  const data = fixtures(), failures = { [a]: "reject", [b]: "factory" };
  const r = await page({ data, failures }); queryAndStatic(r, failures); availability(r, failures, data); warnings(r, failures);
});
test("all five errors fail closed without retries and preserve static navigation", async () => {
  const data = fixtures(), failures = { 0: "returned", 1: "reject", 2: "factory", 3: "returned", 4: "reject" };
  const r = await page({ data, failures }); queryAndStatic(r, failures); availability(r, failures, data); warnings(r, failures);
});
test("clientloader failure renders safe shell/all unknown/zero query", async () => { const data = fixtures(), r = await page({ data, loader: true }); queryAndStatic(r, {}, true); availability(r, {}, data, true); warnings(r, {}, true); });
test("admin admission denied before helper/client/query", async () => { await page({ denied: true }); });
for (const value of [[], null]) test(`all healthy ${value === null ? "null" : "empty"} legitimate zero/good and ordinary empty panels`, async () => {
  const data = tables.map(() => value), r = await page({ data }); queryAndStatic(r); availability(r, {}, data); warnings(r, {});
  assert.ok(text(r.hero).endsWith("0 פתוחות")); assert.equal(nodes(r.hero, "span")[0].props.className, "pill good");
  assert.equal(nodes(r.tree, "Link").length, 0);
});
for (const [status, approval, count] of [
  ["approved", "payment_pending", 0], ["active", "payment_pending", 0], ["rejected", null, 0], ["cancelled", null, 0], ["expired", null, 0], ["suspended", null, 0],
  ["", "approved", 1], [null, "approved", 0], [undefined, "active", 0], [null, "payment_pending", 1], [null, null, 1], ["APPROVED", null, 1], ["completed", null, 1], ["approved ", null, 1], [0, "approved", 1], [false, "approved", 1], [{ toString: () => "approved" }, null, 0]
]) test(`allOpen hidden affiliation NULLISH+String ${typeof status}/${String(status)}/${String(approval)}`, async () => {
  const data = tables.map(() => []); data[3] = [{ id: "SYNTHETIC_A", status, approval_flow_status: approval }];
  const r = await page({ data }); queryAndStatic(r); availability(r, {}, data);
  assert.ok(text(r.hero).endsWith(`${count} פתוחות`)); assert.deepEqual(r.cards.map(n => n.props.value), [0, 0, 0, 0]);
});
test("KPI counts ALL rows while panels preserve first12 order/key/raw status helpers", async () => {
  const data = fixtures().map(rows => Array.from({ length: 17 }, (_, i) => ({ ...rows[0], id: `${rows[0].id}_${16 - i}`, status: i === 0 ? "approved" : i === 1 ? "rejected" : "review_required" })));
  const r = await page({ data }); queryAndStatic(r); availability(r, {}, data);
  assert.deepEqual(r.cards.map(n => n.props.value), [17, 17, 17, 17]);
  for (const panel of r.panels) {
    const links = nodes(panel, "Link");
    assert.equal(links.length, 12);
    assert.deepEqual(nodes(links[0], "span").map(n => n.props.className), ["pill good"]); assert.ok(text(links[0]).includes("מאושר"));
    assert.equal(nodes(links[1], "span")[0].props.className, "pill bad"); assert.ok(text(links[1]).includes("נדחה"));
    assert.equal(nodes(links[2], "span")[0].props.className, "pill warn"); assert.ok(text(links[2]).includes("דורש בדיקה"));
  }
});
test("row nullish fallbacks preserve empty strings/zero/payment/raw names", async () => {
  const data = fixtures(); data[0][0] = { id: "SYNTHETIC_EMPTY", status: "", permanent_child_files: { full_name: "" }, gardens: { name: "" }, payment_status: 0 };
  data[1][0] = { id: "SYNTHETIC_NULL", status: null, staff_candidate_profiles: null, gardens: null };
  data[2][0] = { id: "SYNTHETIC_INSPECTOR", status: "SYNTHETIC_RAW_STATUS", full_name: "", city: "" };
  const r = await page({ data }); availability(r, {}, data);
  assert.equal(text(nodes(r.panels[0], "strong")[0]), ""); assert.equal(text(nodes(r.panels[0], "small")[0]), " · 0");
  assert.ok(text(r.panels[1]).includes("מועמד/ת")); assert.ok(text(r.panels[1]).includes("-"));
  assert.ok(text(r.panels[2]).includes("SYNTHETIC_RAW_STATUS")); assert.equal(text(nodes(r.panels[2], "strong")[0]), "");
});
test("ACTUAL shared RoleMetricCard missing-source value stays neutral default no link/action", () => {
  const shared = load(metricCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "@/components/global-state-system") return { GlobalStatePanel: unexpected };
    if (id === "@/lib/ui/canonical-status") return { canonicalStatusLabel: unexpected, canonicalStatusTone: unexpected };
    return unexpected(id);
  });
  const tree = shared.RoleMetricCard({ label: "SYNTHETIC_METRIC", value: "לא זמין" });
  assert.equal(tree.type, "article"); assert.equal(tree.props.className, "role-metric-card default"); assert.equal(nodes(tree, "Link").length, 0);
  assert.ok(text(tree).includes("לא זמין"));
});
test("one exact DOMAIN hook no unrelated security hook", () => {
  const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-requests-query-boundary";
  assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-requests-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0);
});
