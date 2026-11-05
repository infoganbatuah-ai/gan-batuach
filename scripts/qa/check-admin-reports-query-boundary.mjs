import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Readonly actual summary page + actual helper. SYNTHETIC metadata only.
// ReportsCenter remains an unexecuted JSX label; no exports/files/API/actions.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/reports/page.tsx")), helperCode = compile(source("lib/admin-safe.ts"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, fetch: unexpected, FormData: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
const profile = { id: "SYNTHETIC_ADMIN", role: "admin" };
const statuses = ["ready", "done", "completed", "success", "queued", "pending", "running", "processing", "SYNTHETIC_FAILED"];
const fixture = () => statuses.map((status, i) => ({ id: `SYNTHETIC_REPORT_${i}`, report_type: "SYNTHETIC_TYPE", format: "SYNTHETIC_FORMAT", status, created_at: "SYNTHETIC_DATE" }));
async function page({ kind = "healthy", data = fixture(), denied = false } = {}) {
  let clients = 0, calls = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...a) => { calls++; assert.equal(a[0], "דוחות"); captured = await actual.safeAdminData(...a); return captured; } };
  const client = { from(table) { assert.equal(table, "report_exports"); assert.equal(chains.length, 0); const steps = [], q = {}; chains.push([table, steps]); if (kind === "factory") throw Error("PRIVATE_FACTORY"); for (const method of ["select", "limit"]) q[method] = (...a) => { steps.push([method, ...a]); return q; }; q.then = (yes, no) => (kind === "reject" ? Promise.reject(Error("PRIVATE_REJECTION")) : Promise.resolve({ data, error: kind === "returned" ? { message: "PRIVATE_MESSAGE", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no); return q; } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "lucide-react") return { BarChart3: "BarChart3", FileText: "FileText" };
    if (id === "@/components/admin-app-ui") return { AdminAppFrame: "AdminAppFrame" };
    if (id === "@/components/admin-data-state") return { AdminDataError: "AdminDataError" };
    if (id === "@/components/reports-center") return { ReportsCenter: "ReportsCenter" };
    if (id === "@/components/gan-batuach-design-system") return Object.fromEntries(["DashboardGrid", "MetricCard", "PremiumCard", "SectionHeader", "StatusChip"].map(k => [k, k]));
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); return { profile }; } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (kind === "loader") throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(clients, 1); assert.equal(calls, 1);
  assert.deepEqual(plain(chains), kind === "loader" ? [] : [["report_exports", kind === "factory" ? [] : [["select", "id, report_type, format, status, created_at"], ["limit", 50]]]]);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_")); assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_REPORT")); assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_TYPE"));
  const r = { tree, warnings, data: captured.data, cards: nodes(tree, "MetricCard"), frame: nodes(tree, "AdminAppFrame")[0], chip: nodes(tree, "StatusChip")[0], banner: nodes(tree, "AdminDataError")[0].props.message };
  assert.equal(r.frame.props.profile, profile); assert.equal(r.frame.props.activeHref, "/dashboard/admin/reports"); assert.equal(r.frame.props.title, "דוחות וניתוח נתונים"); assert.equal(r.frame.props.subtitle, "דוחות, ייצוא, אנליטיקה, ערים ומגמות תפעוליות."); assert.equal(r.frame.props.badge, "דוחות");
  assert.equal(nodes(tree, "DashboardGrid")[0].props.columns, 3); assert.equal(nodes(tree, "SectionHeader")[0].props.eyebrow, "Reports Center"); assert.equal(nodes(tree, "ReportsCenter").length, 1); assert.deepEqual(plain(nodes(tree, "ReportsCenter")[0].props), { role: "admin" });
  assert.equal(r.chip.props.tone, "muted"); assert.equal(r.chip.props.children, "מצב רשומות הייצוא"); assert.ok(!JSON.stringify(tree).includes("ייצוא מוגבל, מאומת ומתועד")); assert.equal(r.cards[1].props.hint, "לפי סטטוס הייצוא"); assert.ok(!JSON.stringify(tree).includes("קבצים זמינים")); assert.equal(nodes(tree, "button").length, 0); assert.equal(nodes(tree, "form").length, 0); assert.equal(nodes(tree, "Link").length, 0);
  return r;
}
const values = r => r.cards.map(n => n.props.value), tones = r => r.cards.map(n => n.props.tone);
test("healthy actualpage/helper/admin/profile/exactonechain/neutraldescription/ReportsCenter", async () => { const d = fixture(), r = await page({ data: d }); assert.equal(r.data.available, true); assert.equal(r.data.rows, d); assert.equal(r.banner, null); assert.deepEqual(values(r), [9, 4, 4]); assert.deepEqual(tones(r), ["primary", "success", "warning"]); assert.equal(r.warnings.length, 0); });
for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory", "loader"]) test(`${mode} UNKNOWN neutralcounts/no stale metadata/independentReportsCenter retained`, async () => { const data = mode === "returned-empty" ? [] : mode === "returned-null" ? null : fixture(), kind = mode.startsWith("returned") ? "returned" : mode, r = await page({ kind, data }); assert.equal(r.data.available, false); assert.deepEqual(plain(r.data.rows), []); assert.deepEqual(values(r), ["לא זמין", "לא זמין", "לא זמין"]); assert.deepEqual(tones(r), ["muted", "muted", "muted"]); assert.equal(r.banner, "לא ניתן לטעון את הנתונים כרגע"); assert.deepEqual(plain(r.warnings), [[kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:", "דוחות"]]); });
test("denied admin propagates before0helper/client/query/render", async () => page({ denied: true }));
for (const data of [[], null]) test(`healthy ${data === null ? "null" : "empty"} preserves knownzero/originaltones`, async () => { const r = await page({ data }); assert.equal(r.data.available, true); assert.equal(r.banner, null); assert.deepEqual(values(r), [0, 0, 0]); assert.deepEqual(tones(r), ["primary", "success", "success"]); });
for (const [status, ready, pending] of [
  ["ready", 1, 0], ["done", 1, 0], ["completed", 1, 0], ["success", 1, 0], ["queued", 0, 1], ["pending", 0, 1], ["running", 0, 1], ["processing", 0, 1], ["READY", 0, 0], [" ready ", 0, 0], ["Queued", 0, 0], ["pending ", 0, 0], [null, 0, 0], [undefined, 0, 0], [0, 0, 0], ["", 0, 0], [{ toString: () => "ready" }, 1, 0], [{ toString: () => "processing" }, 0, 1], [false, 0, 0], ["SYNTHETIC_UNKNOWN", 0, 0]
]) test(`original Stringfilters ${String(status)}/${typeof status} no normalization`, async () => { const data = [{ id: "SYNTHETIC_ID", status }], r = await page({ data }); assert.deepEqual(values(r), [1, ready, pending]); assert.equal(r.cards[2].props.tone, pending ? "warning" : "success"); assert.equal(r.data.rows, data); });
test("querylimit50 no localclamp/dedup/metadata passthrough to independent workflow", async () => { const data = Array.from({ length: 53 }, () => ({ id: "SYNTHETIC_DUPLICATE", status: "ready" })), r = await page({ data }); assert.deepEqual(values(r), [53, 53, 0]); assert.equal(r.data.rows, data); assert.deepEqual(plain(nodes(r.tree, "ReportsCenter")[0].props), { role: "admin" }); });
test("exact original never casts/noorder and no shared ReportsCenter execution", () => { const s = source("app/dashboard/admin/reports/page.tsx"); assert.ok(s.includes('supabase.from("report_exports" as never).select("id, report_type, format, status, created_at" as never).limit(50)')); assert.ok(s.includes('<ReportsCenter role="admin" />')); assert.ok(!s.includes(".order(")); assert.ok(!s.includes("as any")); });
test("ONE exact DOMAIN hook no unrelated security hook", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-reports-query-boundary"; assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-reports-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0); });
