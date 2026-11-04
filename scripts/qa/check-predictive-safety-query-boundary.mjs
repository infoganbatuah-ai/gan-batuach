import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page, safe helper and two domain modules; synthetic JSX/client only.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) { const p = path.join(root, relative); assert.equal((fs.statSync(p).flags ?? 0) & 0x40000000, 0); return fs.readFileSync(p, "utf8"); }
function compile(text) { const r = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/predictive-safety/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const preventionCode = compile(source("lib/domain/predictive-safety-prevention.ts"));
const riskCode = compile(source("lib/domain/predictive-risk.ts"));
const unexpected = (id) => { throw Error(`UNEXPECTED_IMPORT:${id}`); };
function load(code, resolve, warnings = [], effects = []) { const exports = {}; vm.runInNewContext(code, { exports, require: resolve, Date, Intl, process: { env: {} }, fetch: () => { effects.push("FORBIDDEN_FETCH"); throw Error("FORBIDDEN_FETCH"); }, console: { warn: (...args) => warnings.push(args) } }); return exports; }
const prevention = load(preventionCode, unexpected), risk = load(riskCode, unexpected);
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const join = "*, gardens(id,name,city,region,status)";
const expected = [
  ["kindergarten_risk_profiles", [["select", join], ["order", "overall_risk_score", { ascending: false }], ["limit", 500]]],
  ["early_warning_signals", [["select", join], ["in", "review_status", ["needs_review", "reviewing", "confirmed", "escalated"]], ["order", "created_at", { ascending: false }], ["limit", 250]]],
  ["prevention_recommendation_actions", [["select", join], ["in", "status", ["open", "in_progress", "approved"]], ["order", "created_at", { ascending: false }], ["limit", 200]]],
  ["prediction_accuracy_reviews", [["select", join], ["order", "prediction_made_at", { ascending: false }], ["limit", 300]]],
  ["prevention_readiness_scores", [["select", join], ["order", "snapshot_date", { ascending: false }], ["limit", 500]]],
  ["kindergarten_risk_history", [["select", "*"], ["eq", "snapshot_period", "daily"], ["order", "snapshot_date", { ascending: false }], ["limit", 1200]]]
];
const garden = (name) => ({ id: `garden-${name}`, name, city: `CITY_${name}`, region: `REGION_${name}`, status: "active" });
const fixtures = [
  [{ id: "risk-a", gardens: garden("RISK_GARDEN"), overall_risk_score: 80, predicted_risk_level: "high", risk_level: "high", risk_trend: "rising" }],
  [{ id: "warning-a", gardens: garden("WARNING_GARDEN"), severity: "high", confidence_score: 86, warning_type: "camera_outage_pattern", recommended_action: "WARNING_ACTION" }],
  [{ id: "action-a", gardens: garden("ACTION_GARDEN"), title: "PREVENTION_ACTION", recommendation_type: "urgent_review", status: "open", priority: "high" }],
  [{ id: "accuracy-a", gardens: garden("ACCURACY_GARDEN_A"), validation_outcome: "accurate" }, { id: "accuracy-b", gardens: garden("ACCURACY_GARDEN_B"), validation_outcome: "inaccurate" }],
  [{ id: "readiness-a", gardens: garden("READINESS_GARDEN"), prevention_readiness_score: 88, compliance_component: 81, inspections_component: 82, incident_history_component: 83, observer_readiness_component: 84, corrective_action_component: 85, snapshot_date: "2026-11-01" }],
  [{ id: "history-a", snapshot_period: "daily", snapshot_date: "2026-11-01" }]
];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
  let clients = 0; const chains = [], warnings = [], effects = [], helper = load(helperCode, unexpected, warnings, effects);
  const client = { from(table) {
    const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]);
    for (const m of ["select", "in", "eq", "order", "limit"]) q[m] = (...args) => { calls.push([m, ...args]); return q; };
    q.then = (resolve, reject) => { const failure = failures[i]; if (failure?.kind === "reject") return Promise.reject(Error("PRIVATE_QUERY_SENTINEL")).then(resolve, reject); return Promise.resolve({ data: nullData ? null : empty || failure && !failure.stale ? [] : data[i], error: failure ? { message: "PRIVATE_QUERY_SENTINEL" } : null }).then(resolve, reject); }; return q;
  } };
  const p = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/domain/predictive-safety-prevention") return prevention; if (id === "@/lib/domain/predictive-risk") return risk;
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER_SENTINEL"); return client; } }; return unexpected(id);
  }, warnings, effects);
  if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); assert.equal(effects.length, 0); return; }
  const tree = await p.default(); assert.equal(effects.length, 0); assert.equal(nodes(tree, "form").length, 0);
  return { tree, text: text(tree), clients, chains, warnings, banner: nodes(tree, "AdminDataError")[0].props.message, hero: nodes(tree, "PremiumDashboardHero")[0].props, metrics: nodes(tree, "RoleMetricCard").map((n) => n.props), components: nodes(nodes(tree, "section").find((n) => n.props.className === "prediction-score-grid"), "strong").map(text) };
}
function panel(r, title) { return nodes(r.tree, "article").find((n) => text(nodes(n, "h2")[0]).includes(title)); }
function section(r, title) { return nodes(r.tree, "CleanSection").find((n) => n.props.title === title); }
const listKeys = (n) => nodes(n, "div").filter((x) => x.props.className === "list-item").map((x) => x.key);
const rowKeys = (n) => nodes(n, "article").filter((x) => x.props.className === "prediction-row").map((x) => x.key);
const metricValues = (r) => r.metrics.map((m) => m.value);
const metricSources = [4, 0, 1, 2, 3, 1, 0, 5];
const healthyValues = ["88/100", 1, 1, 1, "50%", "86%", 1, 1];
const healthyTones = ["good", "bad", "warn", "warn", "bad", "good", "warn", "good"];
function assertQueries(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); }
function assertDependencies(r, failed = []) {
  assert.deepEqual(metricValues(r), healthyValues.map((v, i) => failed.includes(metricSources[i]) ? "לא זמין" : v));
  assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => failed.includes(metricSources[i]) ? "default" : v));
  assert.equal(r.hero.badge, failed.includes(4) ? "לא זמין" : "88/100"); assert.equal(r.hero.badgeTone, failed.includes(4) ? "default" : "good");
  assert.deepEqual(r.components, failed.includes(4) ? Array(5).fill("לא זמין") : ["81/100", "82/100", "83/100", "84/100", "85/100"]);
  for (const [i, sentinel] of [[0, "RISK_GARDEN"], [1, "WARNING_ACTION"], [2, "PREVENTION_ACTION"], [3, "ACCURACY_GARDEN_A"], [4, "READINESS_GARDEN"]]) assert.equal(r.text.includes(sentinel), !failed.includes(i));
  const mini = nodes(nodes(r.tree, "div").find((n) => n.props.className === "prediction-mini-grid"), "b").map(text); assert.deepEqual(mini, failed.includes(3) ? Array(4).fill("לא זמין") : ["1", "1", "0", "0"]);
  if (failed.includes(0)) { assert.ok(text(panel(r, "גנים בסיכון חזוי")).includes("לא זמין")); assert.ok(text(panel(r, "סיכון אזורי")).includes("לא זמין")); assert.ok(!r.text.includes("אין כרגע גנים בסיכון חזוי גבוה.")); assert.ok(!r.text.includes("אין אזורים להצגה.")); }
  if (failed.includes(1)) { assert.ok(text(section(r, "אזהרות מוקדמות")).includes("לא זמין")); assert.ok(!nodes(r.tree, "EmptyState").some((n) => n.props.title === "אין אזהרות פתוחות")); }
  if (failed.includes(2)) { assert.ok(text(panel(r, "המלצות מניעה")).includes("לא זמין")); assert.ok(!r.text.includes("אין המלצות פתוחות.")); }
  if (failed.includes(4)) { assert.ok(text(section(r, "מוכנות מניעה לפי גן")).includes("לא זמין")); assert.ok(!nodes(r.tree, "EmptyState").some((n) => n.props.title === "אין ציוני מניעה עדיין")); }
}
test("healthy actual page/helper/two domains preserve six exact chains, values, tones and five components", async () => { const r = await page(); assertQueries(r); assert.equal(r.banner, null); assertDependencies(r); });
for (const [index, [table]] of expected.entries()) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`${table} ${kind}/${stale ? "stale" : "empty"}: only dependent UI unavailable`, async () => {
  const r = await page({ failures: { [index]: { kind, stale } } }); assertQueries(r); assert.ok(r.banner); assert.ok(!r.banner.includes("מיגרציה")); assertDependencies(r, [index]);
  assert.deepEqual(plain(r.warnings), [["Admin Supabase query unavailable:", `predictive safety query ${index}`]]); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE_QUERY_SENTINEL")); assert.ok(!r.text.includes("PRIVATE_QUERY_SENTINEL"));
});
for (const failed of [[0, 1], [0, 5], [1, 2], [2, 3], [3, 5], [0, 4]]) test(`paired failed sources ${failed} retain independent measured sources`, async () => {
  const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); assertQueries(r); assertDependencies(r, failed); assert.ok(r.banner);
});
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} retains original defaults/tones/texts`, async () => {
  const r = await page({ empty: true, nullData }); assertQueries(r); assert.equal(r.banner, null); assert.deepEqual(metricValues(r), ["0/100", 0, 0, 0, "0%", "0%", 0, 0]); assert.deepEqual(r.metrics.map((m) => m.tone), ["bad", "good", "good", "good", "bad", "bad", "good", "good"]); assert.equal(r.hero.badge, "0/100"); assert.equal(r.hero.badgeTone, "bad"); assert.deepEqual(r.components, Array(5).fill("0/100")); assert.ok(r.text.includes("אין כרגע גנים בסיכון חזוי גבוה.")); assert.ok(r.text.includes("אין המלצות פתוחות.")); assert.ok(r.text.includes("אין אזורים להצגה.")); assert.deepEqual(nodes(r.tree, "EmptyState").map((n) => n.props.title), ["אין אזהרות פתוחות", "אין ציוני מניעה עדיין"]);
});
test("loader all unavailable, neutral and no private error; denied role zero client/query", async () => {
  const r = await page({ loader: true }); assert.equal(r.chains.length, 0); assert.ok(r.banner); assertDependencies(r, [0, 1, 2, 3, 4, 5]); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE_LOADER_SENTINEL")); await page({ deny: true });
});
test("all six errors remain explicitly unavailable and no false healthy empty statements", async () => { const r = await page({ failures: Object.fromEntries(expected.map((_, i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); assertQueries(r); assertDependencies(r, [0, 1, 2, 3, 4, 5]); });
test("list bounds/order10 risks10 actions14 warnings5 accuracy8 regions10 sorted readiness preserved", async () => {
  const data = structuredClone(fixtures);
  data[0] = Array.from({ length: 14 }, (_, i) => ({ ...fixtures[0][0], id: `risk-${i}`, overall_risk_score: 90 - i, gardens: { ...garden(`RISK_${i}`), region: `REGION_${i}` } }));
  data[1] = Array.from({ length: 16 }, (_, i) => ({ ...fixtures[1][0], id: `warning-${i}`, recommended_action: `WARNING_${i}` }));
  data[2] = Array.from({ length: 12 }, (_, i) => ({ ...fixtures[2][0], id: `action-${i}`, title: `ACTION_${i}` }));
  data[3] = Array.from({ length: 7 }, (_, i) => ({ ...fixtures[3][0], id: `accuracy-${i}`, validation_outcome: ["accurate", "inaccurate", "inconclusive", "pending"][i % 4] }));
  const scores = [15, 91, 32, 85, 61, 70, 98, 42, 54, 88, 20, 77]; data[4] = scores.map((n, i) => ({ ...fixtures[4][0], id: `readiness-${i}`, prevention_readiness_score: n }));
  const r = await page({ data }); assertQueries(r); assert.deepEqual(listKeys(panel(r, "גנים בסיכון חזוי")), Array.from({ length: 10 }, (_, i) => `risk-${i}`)); assert.deepEqual(listKeys(panel(r, "המלצות מניעה")), Array.from({ length: 10 }, (_, i) => `action-${i}`)); assert.deepEqual(rowKeys(section(r, "אזהרות מוקדמות")), Array.from({ length: 14 }, (_, i) => `warning-${i}`)); assert.deepEqual(listKeys(panel(r, "דיוק תחזיות")), Array.from({ length: 5 }, (_, i) => `accuracy-${i}`)); assert.deepEqual(listKeys(panel(r, "סיכון אזורי")), Array.from({ length: 8 }, (_, i) => `REGION_${i}`)); assert.deepEqual(rowKeys(section(r, "מוכנות מניעה לפי גן")), scores.map((score, i) => ({ score, id: `readiness-${i}` })).sort((a, b) => b.score - a.score).slice(0, 10).map((v) => v.id)); assert.equal(r.metrics[4].value, "33%");
});
test("risk classification65 boundary and predicted high/critical policy unchanged", async () => {
  const data = structuredClone(fixtures); data[0] = [64, 65, 5, 6].map((score, i) => ({ ...fixtures[0][0], id: `risk-${i}`, overall_risk_score: score, predicted_risk_level: ["low", "low", "critical", "high"][i], risk_level: "low" })); const r = await page({ data }); assert.equal(r.metrics[1].value, 3); assert.deepEqual(listKeys(panel(r, "גנים בסיכון חזוי")), ["risk-1", "risk-2", "risk-3"]);
});
test("original avg/pct/regionalRisk/tones and confidence fallback math retained", async () => {
  assert.equal(prevention.avg([{ v: 0 }, { v: -5 }, { v: 20 }, { v: 40 }, { v: "bad" }], "v"), 30); assert.equal(prevention.pct(1, 3), 33); assert.equal(prevention.pct(0, 0), 0); assert.deepEqual([54, 55, 77, 78].map(prevention.preventionTone), ["bad", "warn", "warn", "good"]); assert.deepEqual([37, 38, 69, 70].map(risk.riskTone), ["good", "warn", "warn", "bad"]);
  const region = plain(prevention.regionalRisk([{ overall_risk_score: 20, risk_level: "low", gardens: { region: "R" } }, { overall_risk_score: 80, risk_level: "high", risk_trend: "rising", gardens: { region: "R" } }])); assert.deepEqual(region, [{ region: "R", total: 100, count: 2, high: 1, rising: 1, averageRisk: 50 }]);
  const data = structuredClone(fixtures); data[1] = [{ ...fixtures[1][0], confidence_score: 0 }, { ...fixtures[1][0], confidence_score: null, confidence_at_prediction: 60 }, { ...fixtures[1][0], confidence_score: 90 }]; const r = await page({ data }); assert.equal(r.metrics[5].value, "75%");
});
test("safety/parent boundaries, question links and navigation unchanged; no action route", async () => {
  const r = await page(); for (const item of [...prevention.parentSafetyBoundary, ...prevention.preventionSafeguards]) assert.ok(r.text.includes(item));
  assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/risk-intelligence", "/dashboard/admin/national-inspections", "/dashboard/admin/compliance-center", "/dashboard/admin/observer-network", "/dashboard/admin/camera-deployment"]); assert.equal(nodes(r.tree, "Link").filter((n) => n.props.href === "/dashboard/admin/predictive-safety").length, 4); assert.ok(r.hero.subtitle.includes("אין אכיפה אוטומטית"));
});
test("unique scoped domain hook only", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), found = c.domain.filter((v) => v.name === "predictive-safety-query-boundary"); assert.equal(found.length, 1); assert.deepEqual(found[0].args, ["--test", "scripts/qa/check-predictive-safety-query-boundary.mjs"]); });
