import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/helper/domain with synthetic JSX/client only. No actions/network.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) { const p = path.join(root, relative); assert.equal((fs.statSync(p).flags ?? 0) & 0x40000000, 0); return fs.readFileSync(p, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/risk-intelligence/page.tsx")), helperCode = compile(source("lib/admin-safe.ts")), domainCode = compile(source("lib/domain/predictive-risk.ts"));
const unexpected = (id) => { throw Error(`UNEXPECTED_IMPORT:${id}`); };
function load(code, resolve, warnings = [], effects = []) { const exports = {}; vm.runInNewContext(code, { exports, require: resolve, Date, Intl, process: { env: {} }, fetch: () => { effects.push("FORBIDDEN_FETCH"); throw Error("FORBIDDEN_FETCH"); }, console: { warn: (...args) => warnings.push(args) } }); return exports; }
const domain = load(domainCode, unexpected), jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  ["kindergarten_risk_profiles", [["select", "*, gardens(name,city,status)"], ["order", "overall_risk_score", { ascending: false }], ["limit", 500]]],
  ["predictive_risk_signals", [["select", "*, gardens(name,city)"], ["in", "review_status", ["needs_review", "reviewing", "escalated"]], ["order", "created_at", { ascending: false }], ["limit", 200]]],
  ["risk_prevention_recommendations", [["select", "*, gardens(name,city)"], ["eq", "status", "open"], ["order", "created_at", { ascending: false }], ["limit", 160]]],
  ["kindergarten_risk_history", [["select", "*"], ["eq", "snapshot_period", "daily"], ["order", "snapshot_date", { ascending: false }], ["limit", 1200]]]
];
const fixtures = [
  [{ id: "risk-a", gardens: { name: "RISK_A", city: "CITY_A" }, overall_risk_score: 80, risk_level: "high", predicted_risk_level: "high", risk_trend: "rising", safety_risk: 70, compliance_risk: 60, operational_risk: 50, staffing_risk: 40, observer_risk: 30, prediction_summary: "PREDICTION_A" }, { id: "risk-b", gardens: { name: "RISK_B", city: "CITY_B" }, overall_risk_score: 20, risk_level: "low", predicted_risk_level: "low", risk_trend: "declining", safety_risk: 10, compliance_risk: 20, operational_risk: 30, staffing_risk: 40, observer_risk: 50 }],
  [{ id: "signal-a", title: "SIGNAL_A", explanation: "SIGNAL_EXPLANATION", severity: "high", pattern_count: 3, gardens: { name: "SIGNAL_GARDEN" } }],
  [{ id: "rec-a", title: "RECOMMENDATION_A", explanation: "RECOMMENDATION_EXPLANATION", priority: "high", gardens: { name: "REC_GARDEN" } }],
  [{ id: "history-a", snapshot_period: "daily", snapshot_date: "2026-11-01" }]
];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
  let clients = 0; const chains = [], warnings = [], effects = [], helper = load(helperCode, unexpected, warnings, effects);
  const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "in", "eq", "order", "limit"]) q[m] = (...args) => { calls.push([m, ...args]); return q; }; q.then = (resolve, reject) => { const failure = failures[i]; if (failure?.kind === "reject") return Promise.reject(Error("PRIVATE_QUERY_SENTINEL")).then(resolve, reject); return Promise.resolve({ data: nullData ? null : empty || failure && !failure.stale ? [] : data[i], error: failure ? { message: "PRIVATE_QUERY_SENTINEL" } : null }).then(resolve, reject); }; return q; } };
  const p = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/domain/predictive-risk") return domain; if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER_SENTINEL"); return client; } }; return unexpected(id);
  }, warnings, effects);
  if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); assert.equal(effects.length, 0); return; }
  const tree = await p.default(); assert.equal(effects.length, 0); assert.equal(nodes(tree, "form").length, 0);
  return { tree, text: text(tree), clients, chains, warnings, banner: nodes(tree, "AdminDataError")[0].props.message, hero: nodes(tree, "PremiumDashboardHero")[0].props, metrics: nodes(tree, "RoleMetricCard").map((n) => n.props), components: nodes(nodes(tree, "section").find((n) => n.props.className === "risk-score-grid"), "strong").map(text) };
}
const panel = (r, title) => nodes(r.tree, "article").find((n) => text(nodes(n, "h2")[0]).includes(title));
const section = (r, title) => nodes(r.tree, "CleanSection").find((n) => n.props.title === title);
const listKeys = (n) => nodes(n, "div").filter((v) => v.props.className === "list-item").map((v) => v.key);
const metricValues = (r) => r.metrics.map((m) => m.value);
const metricSources = [0, 0, 0, 0, 1, 2, 0, 3], healthyValues = ["50/100", 1, 1, 1, 1, 1, 1, 1], healthyTones = ["warn", "bad", "warn", "bad", "warn", "warn", "good", "good"];
function assertQueries(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); }
function dependencies(r, failed = []) {
  assert.deepEqual(metricValues(r), healthyValues.map((v, i) => failed.includes(metricSources[i]) ? "לא זמין" : v)); assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => failed.includes(metricSources[i]) ? "default" : v)); assert.equal(r.hero.badge, failed.includes(0) ? "לא זמין" : "50/100"); assert.equal(r.hero.badgeTone, failed.includes(0) ? "default" : "warn"); assert.deepEqual(r.components, Array(5).fill(failed.includes(0) ? "לא זמין" : "40/100"));
  for (const [i, sentinel] of [[0, "RISK_A"], [0, "PREDICTION_A"], [1, "SIGNAL_A"], [2, "RECOMMENDATION_A"]]) assert.equal(r.text.includes(sentinel), !failed.includes(i));
  if (failed.includes(0)) { assert.ok(text(panel(r, "גנים בסיכון גבוה")).includes("לא זמין")); assert.ok(text(panel(r, "סיכון עולה")).includes("לא זמין")); assert.ok(!r.text.includes("אין גנים בסיכון גבוה.")); assert.ok(!r.text.includes("אין מגמת עלייה חריגה.")); }
  if (failed.includes(1)) { assert.ok(text(section(r, "אזהרות מוקדמות")).includes("לא זמין")); assert.ok(!nodes(r.tree, "EmptyState").some((n) => n.props.title === "אין אזהרות פתוחות")); }
  if (failed.includes(2)) { assert.ok(text(panel(r, "המלצות מניעה")).includes("לא זמין")); assert.ok(!r.text.includes("אין המלצות פתוחות.")); }
}
test("actual healthy page/helper/domain preserve four exact queries and all measured dependencies", async () => { const r = await page(); assertQueries(r); assert.equal(r.banner, null); dependencies(r); });
for (const [index, [table]] of expected.entries()) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`${table} ${kind}/${stale ? "stale" : "empty"}: dependent UI unavailable only`, async () => {
  const r = await page({ failures: { [index]: { kind, stale } } }); assertQueries(r); assert.ok(r.banner); assert.ok(!r.banner.includes("מיגרציה")); dependencies(r, [index]); assert.deepEqual(plain(r.warnings), [["Admin Supabase query unavailable:", `risk intelligence query ${index}`]]); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE_QUERY_SENTINEL")); assert.ok(!r.text.includes("PRIVATE_QUERY_SENTINEL"));
});
for (const failed of [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]]) test(`paired sources ${failed} preserve independently healthy data`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); assertQueries(r); dependencies(r, failed); });
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} preserves original zeros/good tones/default texts`, async () => {
  const r = await page({ empty: true, nullData }); assertQueries(r); assert.equal(r.banner, null); assert.deepEqual(metricValues(r), ["0/100", 0, 0, 0, 0, 0, 0, 0]); assert.deepEqual(r.metrics.map((m) => m.tone), Array(8).fill("good")); assert.equal(r.hero.badge, "0/100"); assert.equal(r.hero.badgeTone, "good"); assert.deepEqual(r.components, Array(5).fill("0/100")); assert.ok(r.text.includes("אין גנים בסיכון גבוה.")); assert.ok(r.text.includes("אין מגמת עלייה חריגה.")); assert.ok(r.text.includes("אין המלצות פתוחות.")); assert.equal(nodes(r.tree, "EmptyState")[0].props.title, "אין אזהרות פתוחות");
});
test("loader all unavailable/neutral and denied role creates zero clients/queries", async () => { const r = await page({ loader: true }); assert.equal(r.chains.length, 0); assert.ok(r.banner); dependencies(r, [0, 1, 2, 3]); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE_LOADER_SENTINEL")); await page({ deny: true }); });
test("all errors remain unavailable, never false low-risk proof", async () => { const r = await page({ failures: Object.fromEntries(expected.map((_, i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); assertQueries(r); dependencies(r, [0, 1, 2, 3]); });
test("profile avg includes zero/missing fields and rounds original per-category averages", async () => {
  const data = structuredClone(fixtures); data[0] = [0, 90, 0].map((score, i) => ({ id: `risk-${i}`, overall_risk_score: score, risk_level: "low", predicted_risk_level: "low", risk_trend: "stable", ...(i === 1 ? { safety_risk: 60, compliance_risk: 63, operational_risk: 66, staffing_risk: 69, observer_risk: 72 } : {}) }));
  const r = await page({ data }); assert.equal(r.metrics[0].value, "30/100"); assert.deepEqual(r.components, ["20/100", "21/100", "22/100", "23/100", "24/100"]); assert.deepEqual(metricValues(r).slice(1, 4), [0, 0, 0]);
  data[0] = [{ overall_risk_score: 1 }, { overall_risk_score: 2 }]; const rounded = await page({ data }); assert.equal(rounded.metrics[0].value, "2/100");
});
test("top10 clipped profile counts/order and12 signals8 recommendations remain unchanged", async () => {
  const data = structuredClone(fixtures); data[0] = Array.from({ length: 24 }, (_, i) => ({ ...fixtures[0][0], id: `risk-${i}`, risk_level: i % 2 ? "critical" : "high", predicted_risk_level: "critical", risk_trend: i < 12 ? "rising" : "declining" })); data[1] = Array.from({ length: 15 }, (_, i) => ({ ...fixtures[1][0], id: `signal-${i}` })); data[2] = Array.from({ length: 11 }, (_, i) => ({ ...fixtures[2][0], id: `rec-${i}` })); const r = await page({ data }); assert.deepEqual(metricValues(r), ["80/100", 10, 10, 10, 15, 11, 10, 1]); assert.deepEqual(listKeys(panel(r, "גנים בסיכון גבוה")), Array.from({ length: 10 }, (_, i) => `risk-${i}`)); assert.deepEqual(listKeys(panel(r, "סיכון עולה")), Array.from({ length: 10 }, (_, i) => `risk-${i}`)); assert.deepEqual(listKeys(panel(r, "המלצות מניעה")), Array.from({ length: 8 }, (_, i) => `rec-${i}`)); assert.deepEqual(nodes(section(r, "אזהרות מוקדמות"), "div").filter((n) => n.props.className === "risk-row").map((n) => n.key), Array.from({ length: 12 }, (_, i) => `signal-${i}`));
});
test("risk_level/predicted level classification does not infer high from score alone", async () => {
  const data = structuredClone(fixtures); data[0] = [{ ...fixtures[0][0], id: "high-score-low-level", overall_risk_score: 99, risk_level: "low", predicted_risk_level: "low", risk_trend: "stable" }, { ...fixtures[0][0], id: "critical-low-score", overall_risk_score: 1, risk_level: "critical", predicted_risk_level: "critical", risk_trend: "new" }]; const r = await page({ data }); assert.deepEqual(metricValues(r).slice(0, 4), ["50/100", 1, 0, 1]); assert.deepEqual(listKeys(panel(r, "גנים בסיכון גבוה")), ["critical-low-score"]);
});
test("actual domain labels/tones/category contract and safety/navigation remain unchanged", async () => {
  assert.deepEqual([37, 38, 69, 70].map(domain.riskTone), ["good", "warn", "warn", "bad"]); assert.equal(domain.riskLevelLabel("critical"), "קריטי"); assert.equal(domain.riskTrendLabel("declining"), "יורד"); assert.deepEqual(plain(domain.riskCategoryRows({})).map((row) => row.key), ["safety", "compliance", "operational", "staffing", "observer"]);
  const r = await page(); for (const line of domain.predictiveRiskSafeguards) assert.ok(r.text.includes(line)); const questions = nodes(r.tree, "Link").filter((n) => n.props.href === "/dashboard/admin/risk-intelligence"); assert.deepEqual(questions.map(text), Array.from(domain.riskAssistantQuestions)); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/national-inspections", "/dashboard/admin/observer-network", "/dashboard/admin/compliance-center", "/dashboard/admin/rating-system"]); assert.ok(r.text.includes("ללא אכיפה אוטומטית")); assert.ok(r.hero.subtitle.includes("בדיקת אדם חובה"));
});
test("domain hook is scoped/distinct/unique", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), found = c.domain.filter((v) => v.name === "risk-intelligence-query-boundary"); assert.equal(found.length, 1); assert.deepEqual(found[0].args, ["--test", "scripts/qa/check-risk-intelligence-query-boundary.mjs"]); });
