import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual readonly page, actual safe helper and actual PURE domain modules.
// All garden/name/address/ID fixtures synthetic; no SDK, navigation or actions.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/kindergarten-analytics/page.tsx")), helperCode = compile(source("lib/admin-safe.ts"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, fetch: unexpected, FormData: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const onboarding = load(compile(source("lib/domain/kindergarten-onboarding.ts")), unexpected);
const calibration = load(compile(source("lib/domain/observer-calibration.ts")), unexpected);
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const statuses = ["active", "onboarding_submitted", "registration_pending", "pending", "payment_pending", "demo_active", "frozen", "suspended", "rejected"];
function fixtures() { return statuses.map((status, i) => ({ id: `SYNTHETIC_G${i}`, name: `SYNTHETIC_GARDEN_${i}`, city: i % 2 ? "חיפה" : "ירושלים", address: "SYNTHETIC_UNUSED_ADDRESS", approval_flow_status: status, status: "SYNTHETIC_UNUSED_FALLBACK", public_profile_enabled: i % 2 })); }
async function page({ kind = "healthy", data = fixtures(), denied = false } = {}) {
  let clients = 0, calls = 0, captured;
  const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...args) => { calls++; assert.equal(args[0], "kindergarten city analytics"); captured = await actual.safeAdminData(...args); return captured; } };
  const client = { from(table) {
    assert.equal(table, "gardens"); assert.equal(chains.length, 0); const steps = [], q = {}; chains.push([table, steps]);
    if (kind === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "order", "limit"]) q[method] = (...a) => { steps.push([method, ...a]); return q; };
    q.then = (yes, no) => (kind === "reject" ? Promise.reject(Error("PRIVATE_REJECTION")) : Promise.resolve({ data, error: kind === "returned" ? { message: "PRIVATE_MESSAGE", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no);
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react") return { Building2: "Building2", MapPinned: "MapPinned", ShieldCheck: "ShieldCheck" };
    if (id === "@/components/dashboard-shell") return { DashboardShell: "DashboardShell" };
    if (id === "@/components/admin-data-state") return { AdminDataError: "AdminDataError" };
    if (id === "@/components/premium-dashboard") return Object.fromEntries(["CleanSection", "EmptyState", "PremiumDashboardHero", "RoleMetricCard", "StatusBadge"].map(k => [k, k]));
    if (id === "@/lib/domain/kindergarten-onboarding") return onboarding;
    if (id === "@/lib/domain/observer-calibration") return calibration;
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); return { profile: { id: "SYNTHETIC_ADMIN" } }; } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (kind === "loader") throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(clients, 1); assert.equal(calls, 1);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_")); assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_UNUSED_")); assert.equal(nodes(tree, "form").length, 0); assert.equal(nodes(tree, "button").length, 0);
  assert.deepEqual(plain(chains), kind === "loader" ? [] : [["gardens", kind === "factory" ? [] : [["select", "id,name,city,address,approval_flow_status,status,public_profile_enabled,created_at"], ["order", "created_at", { ascending: false }], ["limit", 1000]]]]);
  const sections = nodes(tree, "CleanSection"), region = sections.find(n => n.props.title === "פריסה לפי עיר"), recent = sections.find(n => n.props.title === "גנים אחרונים");
  const r = { tree, warnings, data: captured.data, cards: nodes(tree, "RoleMetricCard"), hero: nodes(tree, "PremiumDashboardHero")[0], region, recent, cityRows: nodes(region, "article"), gardenRows: nodes(recent, "article").filter(n => n.props.className === "card procedure-card"), banner: nodes(tree, "AdminDataError")[0].props.message };
  assert.equal(nodes(tree, "DashboardShell")[0].props.role, "admin"); assert.equal(nodes(tree, "DashboardShell")[0].props.title, "אנליטיקת גנים");
  assert.equal(r.hero.props.eyebrow, "City & District Readiness"); assert.equal(r.hero.props.title, "גנים לפי עיר ומחוז תפעולי"); assert.deepEqual(nodes(r.hero.props.actions, "Link").map(n => n.props.href), ["/dashboard/admin/kindergarten-applications", "/dashboard/admin/kindergarten-activation"]);
  assert.ok(text(nodes(tree, "section").find(n => n.props.className === "warning-banner")).includes("פרסום כתובת לציבור נשאר תלוי באישור public-safe בלבד."));
  return r;
}
const values = r => r.cards.map(n => n.props.value), tones = r => r.cards.map(n => n.props.tone ?? "default");
function unknown(r) {
  assert.equal(r.data.available, false); assert.deepEqual(plain(r.data.gardens), []); assert.deepEqual(plain(r.data.rows), []);
  assert.deepEqual(values(r), ["לא זמין", "לא זמין", "לא זמין", "לא זמין"]); assert.deepEqual(tones(r), ["default", "default", "default", "default"]);
  assert.equal(r.hero.props.badge, "נתוני ערים לא זמינים"); assert.equal(r.hero.props.badgeTone, "default"); assert.equal(r.cityRows.length, 0); assert.equal(r.gardenRows.length, 0); assert.equal(nodes(r.tree, "EmptyState").length, 0); assert.ok(r.banner);
  assert.ok(text(r.region).includes("אינם זמינים")); assert.ok(text(r.recent).includes("אינם זמינים")); assert.equal(nodes(r.tree, "StatusBadge").length, 0); assert.equal(nodes(r.tree, "MapPinned").length, 0); assert.equal(nodes(r.tree, "Building2").length, 0); assert.ok(!/SYNTHETIC_GARDEN|SYNTHETIC_UNUSED|פרופיל ציבורי/.test(JSON.stringify(r.tree)));
}
test("healthy actualpage/helper/pureDomain exactquery/topcounts/region/callbacks", async () => { const d = fixtures(), r = await page({ data: d }); assert.equal(r.data.available, true); assert.equal(r.data.gardens, d); assert.equal(r.banner, null); assert.equal(r.warnings.length, 0); assert.deepEqual(values(r), [9, 1, 1, 1]); assert.deepEqual(tones(r), ["default", "good", "warn", "bad"]); assert.equal(r.hero.props.badge, "2 ערים"); assert.equal(r.hero.props.badgeTone, "good"); assert.equal(r.cityRows.length, 2); assert.deepEqual(r.gardenRows.map(n => n.key), d.map(n => n.id)); });
for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory", "loader"]) test(`${mode} UNKNOWN no stale rows/aggregates/status/public-profile props`, async () => { const data = mode === "returned-empty" ? [] : mode === "returned-null" ? null : fixtures(); const kind = mode.startsWith("returned") ? "returned" : mode, r = await page({ kind, data }); unknown(r); assert.deepEqual(plain(r.warnings), [[kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:", "kindergarten city analytics"]]); });
test("denied admission0helper/client/query", async () => page({ denied: true }));
for (const data of [[], null]) test(`healthy ${data === null ? "null" : "empty"} originalzero/tones/ordinaryempty/recentempty`, async () => { const r = await page({ data }); assert.equal(r.data.available, true); assert.equal(r.banner, null); assert.deepEqual(values(r), [0, 0, 0, 0]); assert.deepEqual(tones(r), ["default", "warn", "good", "good"]); assert.equal(r.hero.props.badge, "0 ערים"); assert.equal(r.hero.props.badgeTone, "warn"); assert.equal(nodes(r.region, "EmptyState").length, 1); assert.equal(r.gardenRows.length, 0); assert.equal(nodes(r.recent, "div")[0].props.className, "procedure-list"); });
for (const [approval, status, top, bucket, label] of [
  ["active", null, [1, 1, 0, 0], "active", "פעיל"], ["activation_in_progress", null, [1, 0, 1, 0], "pending", "בהקמה"], ["onboarding_submitted", null, [1, 0, 1, 0], "pending", "הוגש לאישור"], ["pending_final_approval", null, [1, 0, 1, 0], "pending", "ממתין לאישור"], ["registration_pending", null, [1, 0, 0, 0], "pending", "registration_pending"], ["pending", null, [1, 0, 0, 0], "pending", "pending"], ["payment_pending", null, [1, 0, 0, 1], "paymentPending", "ממתין למנוי"], ["demo_active", null, [1, 0, 0, 0], "demoActive", "דמו פעיל"], ["frozen", null, [1, 0, 0, 0], "frozen", "מוקפא"], ["suspended", null, [1, 0, 0, 0], "frozen", "מושהה"], ["rejected", null, [1, 0, 0, 0], "rejected", "נדחה"], ["archived", null, [1, 0, 0, 0], null, "ארכיון"], [null, "active", [1, 0, 0, 0], "active", "לא צוין"], [undefined, "payment_pending", [1, 0, 0, 0], "paymentPending", "לא צוין"], ["", "active", [1, 0, 0, 0], null, ""], ["ACTIVE", null, [1, 0, 0, 0], null, "ACTIVE"], [0, "active", [1, 0, 0, 0], null, 0], [{ toString: () => "active" }, null, [1, 0, 0, 0], "active", "פעיל"], [{ toString: () => "onboarding_submitted" }, null, [1, 0, 1, 0], "pending", "הוגש לאישור"]
]) test(`original regionalfallback/String vs distinct topstrict buckets ${String(approval)}/${typeof approval}/${status}`, async () => { const d = [{ ...fixtures()[0], approval_flow_status: approval, status }], r = await page({ data: d }); assert.deepEqual(values(r), top); const row = r.data.rows[0]; assert.equal(row.total, 1); for (const b of ["active", "pending", "paymentPending", "demoActive", "frozen", "rejected"]) assert.equal(row[b], b === bucket ? 1 : 0); const badge = nodes(r.gardenRows[0], "StatusBadge")[0]; assert.equal(badge.props.children, label); assert.equal(badge.props.tone, calibration.statusTone(approval)); });
test("city trim/unknown/actual districts and totalDESC then Hebrew city tie", async () => { const cities = [" ירושלים ", "ירושלים", "חיפה", " חיפה ", null, "", "   ", "SYNTHETIC_CITY", "תל אביב-יפו"], d = cities.map((city, i) => ({ ...fixtures()[0], id: `SYNTHETIC_C${i}`, city })), r = await page({ data: d }); const expected = [ ["לא ידוע", "לא ידוע", 3], ["חיפה", "חיפה", 2], ["ירושלים", "ירושלים", 2], ["SYNTHETIC_CITY", "לא ידוע", 1], ["תל אביב-יפו", "תל אביב", 1] ].sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], "he")); assert.deepEqual(plain(r.data.rows.map(n => [n.city, n.district, n.total])), expected); assert.deepEqual(r.cityRows.map(n => n.key), expected.map(n => `${n[1]}-${n[0]}`)); for (let i = 0; i < r.cityRows.length; i++) { const n = r.cityRows[i]; assert.equal(nodes(n, "strong")[0].props.children, expected[i][0]); assert.equal(nodes(n, "span")[0].props.children, expected[i][1]); assert.equal(nodes(n, "small").length, 7); } });
test("all regional seven counters reflect original map accumulation", async () => { const d = [...fixtures(), { ...fixtures()[0], approval_flow_status: "registration_pending" }, { ...fixtures()[0], approval_flow_status: "pending" }].map(n => ({ ...n, city: "חיפה" })), r = await page({ data: d }); const expected = { city: "חיפה", district: "חיפה", total: 11, active: 1, pending: 5, paymentPending: 1, demoActive: 1, frozen: 2, rejected: 1 }; assert.deepEqual(plain(r.data.rows[0]), expected); assert.deepEqual(nodes(r.cityRows[0], "small").map(text), ["סה״כ: 11", "פעילים: 1", "ממתינים: 5", "מנוי: 1", "דמו: 1", "מוקפאים/מושהים: 2", "נדחו: 1"]); assert.deepEqual(values(r), [11, 1, 1, 1]); });
for (const city of [null, "", 0, " חיפה "]) test(`recent raw nullish city ${JSON.stringify(city)} vs actual derived district`, async () => { const d = [{ ...fixtures()[0], city, name: "", id: "" }], r = await page({ data: d }); assert.equal(r.gardenRows[0].key, ""); assert.equal(nodes(r.gardenRows[0], "h3")[0].props.children, ""); assert.equal(text(nodes(r.gardenRows[0], "p")[0]), `${city ?? "עיר לא צוינה"} · ${onboarding.operationalDistrictForCity(city)}`); });
for (const flag of [true, false, null, 0, "", "truthy"]) test(`public flag ${JSON.stringify(flag)} retains original truthiness metadata only`, async () => { const r = await page({ data: [{ ...fixtures()[0], public_profile_enabled: flag }] }); assert.equal(nodes(r.gardenRows[0], "span")[0].props.children, flag ? "פרופיל ציבורי" : "לא ציבורי"); assert.equal(nodes(r.gardenRows[0], "Building2").length, 1); });
test("slice20 unchanged inputorder/duplicate IDs and no local querylimit clamp", async () => { const d = Array.from({ length: 1003 }, (_, i) => ({ ...fixtures()[0], id: i === 1 ? "SYNTHETIC_ID_0" : `SYNTHETIC_ID_${i}`, name: `SYNTHETIC_RECENT_${i}`, city: "חיפה" })), r = await page({ data: d }); assert.equal(r.data.gardens, d); assert.deepEqual(values(r), [1003, 1003, 0, 0]); assert.equal(r.data.rows[0].total, 1003); assert.equal(r.gardenRows.length, 20); assert.deepEqual(r.gardenRows.map(n => n.key), d.slice(0, 20).map(n => n.id)); assert.deepEqual(r.gardenRows.map(n => nodes(n, "h3")[0].props.children), d.slice(0, 20).map(n => n.name)); });
test("ONE exact DOMAIN hook no unrelated security hook", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-kindergarten-analytics-query-boundary"; assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-kindergarten-analytics-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0); });
