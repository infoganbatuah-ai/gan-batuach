import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual readonly page/shared safe loader; SYNTHETIC candidate data only.
// Decision component is a JSX boundary stub, never invoked. No SDK/API/actions.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/inspector-applications/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const metricCode = compile(source("components/premium-dashboard.tsx"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) {
  const exports = {};
  vm.runInNewContext(code, { exports, require, fetch: unexpected, FormData: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } });
  return exports;
}
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const profile = { id: "SYNTHETIC_ADMIN", role: "admin" };
const expectedActions = [ { value: "under_review", label: "סימון בבדיקה" }, { value: "request_more_information", label: "בקשת מידע נוסף" }, { value: "approve", label: "אישור והפעלת מפקח" }, { value: "reject", label: "דחייה" }, { value: "suspend", label: "השעיה" } ];
const statuses = ["submitted", "under_review", "approve_pending_assignment", "approved_pending_assignment", "approved", "rejected", "suspended"];
function fixtures() { return statuses.map((status, i) => ({ id: `SYNTHETIC_INSPECTOR_${i}`, status, full_name: `SYNTHETIC_CANDIDATE_${i}`, phone: "SYNTHETIC_PHONE", email: "SYNTHETIC_EMAIL", city: "SYNTHETIC_CITY", preferred_regions: ["SYNTHETIC_REGION"], experience_summary: "SYNTHETIC_EXPERIENCE", duplicate_flags: [], profiles: { full_name: "SYNTHETIC_UNUSED_JOIN_NAME", phone: "SYNTHETIC_UNUSED_JOIN_PHONE", email: "SYNTHETIC_UNUSED_JOIN_EMAIL", active: true } })); }
async function page({ kind = "healthy", data = fixtures(), denied = false } = {}) {
  let clients = 0, helperCalls = 0, captured;
  const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...a) => { helperCalls++; assert.equal(a[0], "admin inspector applications overview"); captured = await actual.safeAdminData(...a); return captured; } };
  const client = { from(table) {
    assert.equal(table, "inspector_applications"); assert.equal(chains.length, 0);
    const calls = [], q = {}; chains.push([table, calls]);
    if (kind === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "order", "limit"]) q[method] = (...a) => { calls.push([method, ...a]); return q; };
    q.then = (yes, no) => (kind === "reject" ? Promise.reject(Error("PRIVATE_REJECTION")) : Promise.resolve({ data, error: kind === "returned" ? { message: "PRIVATE_ERROR", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no);
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "lucide-react") return { ClipboardCheck: "ClipboardCheck", MapPin: "MapPin", ShieldCheck: "ShieldCheck" };
    if (id === "@/components/admin-app-ui") return { AdminAppFrame: "AdminAppFrame" };
    if (id === "@/components/admin-data-state") return { AdminDataError: "AdminDataError" };
    if (id === "@/components/premium-dashboard") return { RoleMetricCard: "RoleMetricCard" };
    if (id === "@/components/self-service-forms") return { ApplicationDecisionForm: "ApplicationDecisionForm" };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); return { profile }; } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (kind === "loader") throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(clients, 1); assert.equal(helperCalls, 1);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_")); assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_UNUSED_JOIN"));
  assert.equal(nodes(tree, "button").length, 0); assert.equal(nodes(tree, "form").length, 0); assert.equal(nodes(tree, "Link").length, 0);
  return { tree, text: text(tree), chains, warnings, data: captured.data, frame: nodes(tree, "AdminAppFrame")[0], hero: nodes(tree, "section").find(n => n.props.className === "dashboard-hero-card admin-hero-card"), cards: nodes(tree, "RoleMetricCard"), rows: nodes(tree, "article"), decisions: nodes(tree, "ApplicationDecisionForm"), banner: nodes(tree, "AdminDataError")[0].props.message };
}
function contracts(r, kind = "healthy") {
  assert.deepEqual(plain(r.chains), kind === "loader" ? [] : [["inspector_applications", kind === "factory" ? [] : [["select", "*, profiles(full_name,phone,email,active)"], ["order", "created_at", { ascending: false }], ["limit", 150]]]]);
  assert.equal(r.frame.props.profile, profile); assert.equal(r.frame.props.activeHref, "/dashboard/admin/kindergarten-applications"); assert.equal(r.frame.props.title, "אישורי מפקחים"); assert.equal(r.frame.props.subtitle, "אישור מועמדות והמשך לשיוך נפרד ומפורש.");
  assert.ok(text(r.hero).includes("אישור מועמדים למערך המפקחים.")); assert.ok(text(r.hero).includes("מועמד מפקח לא רואה גנים עד אישור אדמין ושיוך מפורש. אישור מועמדות אינו שיוך לגן."));
  assert.deepEqual(r.cards.map(n => n.props.label), ["בקשות", "בבדיקה", "ממתין לשיוך", "אושרו"]);
}
function unknown(r) {
  assert.equal(r.data.available, false); assert.deepEqual(Array.from(r.data.rows), []);
  assert.equal(r.frame.props.badge, "נתונים לא זמינים"); assert.deepEqual(r.cards.map(n => n.props.value), ["לא זמין", "לא זמין", "לא זמין", "לא זמין"]);
  assert.deepEqual(r.cards.map(n => n.props.tone ?? "default"), ["default", "default", "default", "default"]);
  const badge = nodes(r.hero, "span")[0]; assert.equal(badge.props.className, "pill"); assert.equal(badge.props.role, "status");
  assert.ok(text(r.hero).includes("נתוני הבקשות אינם זמינים")); assert.ok(!text(r.hero).includes("0 בקשות"));
  assert.equal(r.rows.length, 0); assert.equal(r.decisions.length, 0); assert.equal(nodes(r.tree, "ShieldCheck").length, 0);
  assert.equal(r.banner, "לא ניתן לטעון את הנתונים כרגע"); assert.ok(!r.text.includes("אין בקשות מפקחים")); assert.ok(!r.text.includes("כפילות אפשרית לבדיקה"));
  assert.ok(!/SYNTHETIC_(?:CANDIDATE|PHONE|EMAIL|EXPERIENCE)/.test(JSON.stringify(r.tree))); assert.ok(!JSON.stringify(r.tree).includes("/api/admin/inspector-applications/"));
  const state = nodes(r.tree, "section").find(n => n.props["aria-label"] === "נתוני בקשות מפקחים לא זמינים"); assert.equal(state.props.className, "card"); assert.equal(state.props.role, "status");
}
function known(r, data, counts, tone) {
  assert.equal(r.data.available, true); assert.equal(r.banner, null); assert.equal(r.frame.props.badge, `${data.length} בקשות`);
  assert.deepEqual(r.cards.map(n => n.props.value), counts); assert.deepEqual(r.cards.map(n => n.props.tone ?? "default"), ["default", "warn", "warn", "good"]);
  assert.equal(nodes(r.hero, "span")[0].props.className, `pill ${tone}`); assert.ok(text(r.hero).endsWith(`${data.length} בקשות`));
  assert.deepEqual(r.rows.map(n => n.key), data.map(n => n.id)); assert.equal(r.decisions.length, data.length); assert.equal(nodes(r.tree, "ShieldCheck").length, data.length);
  for (let i = 0; i < data.length; i++) { assert.equal(r.decisions[i].props.endpoint, `/api/admin/inspector-applications/${data[i].id}`); assert.deepEqual(plain(r.decisions[i].props.actions), expectedActions); if (i) assert.equal(r.decisions[i].props.actions, r.decisions[0].props.actions); }
  assert.equal(r.warnings.length, 0);
}
test("healthy exact actualpage/helper admission/profile/query/counts/actions boundary", async () => { const data = fixtures(), r = await page({ data }); contracts(r); known(r, data, [7, 2, 1, 1], "warn"); assert.equal(r.data.rows, data); });
for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory", "loader"]) test(`${mode} UNKNOWN neutral counts no failed personal data or decision props`, async () => {
  const data = mode === "returned-empty" ? [] : mode === "returned-null" ? null : fixtures(); const kind = mode.startsWith("returned") ? "returned" : mode;
  const r = await page({ data, kind }); contracts(r, kind); unknown(r);
  assert.deepEqual(plain(r.warnings), [[kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:", "admin inspector applications overview"]]);
});
test("denied admission0helper/client/query", async () => { await page({ denied: true }); });
for (const data of [[], null]) test(`healthy ${data === null ? "null" : "empty"} preserves ordinaryempty ZERO and known tones`, async () => { const r = await page({ data }); contracts(r); known(r, [], [0, 0, 0, 0], "good"); assert.ok(r.text.includes("אין בקשות מפקחים")); assert.ok(r.text.includes("כאשר מועמד יגיש בקשה, היא תופיע כאן.")); assert.ok(!r.text.includes("אינם זמינים")); });
for (const [status, review, pending, approved, label, rowTone] of [
  ["submitted", 1, 0, 0, "הוגש", "warn"], ["under_review", 1, 0, 0, "נבדק", "warn"], ["approve_pending_assignment", 0, 0, 0, "ממתין לשיוך", "warn"], ["approved_pending_assignment", 0, 1, 0, "ממתין לשיוך", "warn"], ["approved", 0, 0, 1, "מאושר", "good"], ["rejected", 0, 0, 0, "נדחה", "bad"], ["suspended", 0, 0, 0, "מושהה", "warn"], ["APPROVED", 0, 0, 0, "APPROVED", "warn"], [null, 0, 0, 0, "-", "warn"], [undefined, 0, 0, 0, "-", "warn"], ["", 0, 0, 0, "", "warn"], [0, 0, 0, 0, 0, "warn"], [{ toString: () => "approved" }, 0, 0, 0, "מאושר", "warn"], ["SYNTHETIC_RAW_STATUS", 0, 0, 0, "SYNTHETIC_RAW_STATUS", "warn"]
]) test(`STRICT status buckets ${typeof status}/${String(status)} label unchanged`, async () => {
  const data = [{ ...fixtures()[0], status }], r = await page({ data }); contracts(r); known(r, data, [1, review, pending, approved], status === "approved" ? "good" : "warn");
  const badge = nodes(r.rows[0], "span")[0]; assert.equal(badge.props.className, `pill ${rowTone}`); assert.equal(badge.props.children, label);
});
for (const [flags, duplicate] of [[[], false], [["SYNTHETIC_DUPLICATE"], true], [null, false], [undefined, false], ["SYNTHETIC_FLAGS", false], [{ length: 1 }, false], [0, false]]) test(`duplicateflags actual Array.isArray/nonempty ${typeof flags}/${String(flags)}`, async () => { const r = await page({ data: [{ ...fixtures()[0], duplicate_flags: flags }] }); assert.equal(text(r.rows[0]).includes("כפילות אפשרית לבדיקה"), duplicate); });
for (const value of [0, ""]) test(`raw NULLISH candidate/contact/city/experience ${typeof value}/${String(value)} retained`, async () => {
  const r = await page({ data: [{ ...fixtures()[0], full_name: value, phone: value, email: value, city: value, experience_summary: value }] });
  assert.equal(nodes(r.rows[0], "h3")[0].props.children, value); assert.equal(text(nodes(r.rows[0], "p")[0]), `${value} · ${value} · ${value}`); assert.equal(nodes(r.rows[0], "p")[1].props.children, value);
});
for (const [regions, expected] of [[null, "לא נבחרו אזורים"], [[], "לא נבחרו אזורים"], [["SYNTHETIC_R0", "SYNTHETIC_R1"], "SYNTHETIC_R0, SYNTHETIC_R1"], [[""], "לא נבחרו אזורים"]]) test(`region join/fallback ${JSON.stringify(regions)}`, async () => { const r = await page({ data: [{ ...fixtures()[0], preferred_regions: regions, experience_summary: null }] }); assert.ok(text(nodes(r.rows[0], "small")[0]).endsWith(expected)); assert.ok(text(r.rows[0]).includes("לא נוסף ניסיון מקצועי.")); });
test("all STRICT approved retains known good hero and countALLrows", async () => { const data = fixtures().map(row => ({ ...row, status: "approved" })), r = await page({ data }); known(r, data, [7, 0, 0, 7], "good"); });
test("querylimit150 no new local clamp/sort/coercion with raw empty ID", async () => { const data = Array.from({ length: 153 }, (_, i) => ({ ...fixtures()[0], id: i ? `SYNTHETIC_INSPECTOR_${152 - i}` : "" })), r = await page({ data }); contracts(r); known(r, data, [153, 153, 0, 0], "warn"); assert.equal(r.data.rows, data); assert.equal(r.rows[0].key, ""); });
test("ACTUAL RoleMetricCard unknown defaults neutral notgood/zero/no actions", () => {
  const shared = load(metricCode, id => { if (id === "react/jsx-runtime") return runtime; if (id === "next/link") return { __esModule: true, default: "Link" }; if (id === "@/components/global-state-system") return { GlobalStatePanel: unexpected }; if (id === "@/lib/ui/canonical-status") return { canonicalStatusLabel: unexpected, canonicalStatusTone: unexpected }; return unexpected(id); });
  const tree = shared.RoleMetricCard({ label: "SYNTHETIC_METRIC", value: "לא זמין" }); assert.equal(tree.type, "article"); assert.equal(tree.props.className, "role-metric-card default"); assert.ok(text(tree).includes("לא זמין")); assert.equal(nodes(tree, "Link").length, 0);
});
test("one exact DOMAIN hook no unrelated security hook", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-inspector-applications-query-boundary"; assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-inspector-applications-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0); });
