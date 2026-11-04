import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/helper/domain; synthetic clients and JSX, never live database proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/compliance-center/page.tsx")), helperCode = compile(source("lib/admin-safe.ts")), domainCode = compile(source("lib/domain/smart-compliance.ts"));
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-04T12:00:00Z"])); } static now() { return Date.parse("2026-11-04T12:00:00Z"); } }
function unexpected(id) { throw Error(`UNEXPECTED_EFFECT:${id}`); }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const domain = load(domainCode, unexpected), jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const head = ["select", "id", { count: "exact", head: true }];
const expected = [
  ["documents", [head]], ["documents", [head, ["in", "status", ["missing", "required", "expired", "rejected"]]]],
  ["documents", [head, ["lte", "expires_at", new FixedDate(FixedDate.now() + 90 * 86400000).toISOString().slice(0, 10)], ["not", "expires_at", "is", null]]],
  ["staff", [head]], ["staff", [head, ["or", "approved_to_work.eq.false,background_check_status.neq.valid,police_clearance_status.neq.valid"]]],
  ["required_inspections", [head, ["lt", "due_at", new FixedDate().toISOString()], ["neq", "status", "done"]]],
  ["national_compliance_findings", [head, ["in", "resolution_status", ["open", "in_progress"]]]],
  ["mandatory_procedures", [head, ["eq", "active", true], ["eq", "required", true]]], ["policies", [head, ["eq", "active", true], ["not", "published_at", "is", null]]],
  ["compliance_requirements", [["select", "*"], ["eq", "active", true], ["order", "category"]]],
  ["compliance_alerts", [["select", "id,garden_id,staff_id,category,title,severity,alert_status,due_at,expiration_date,warning_bucket,gardens(name,city)"], ["in", "alert_status", ["open", "in_progress"]], ["order", "expiration_date", { ascending: true }], ["limit", 120]]],
  ["compliance_corrective_actions", [["select", "id,garden_id,action_title,status,priority,due_at,gardens(name,city)"], ["not", "status", "in", "(verified,closed,cancelled)"], ["order", "due_at", { ascending: true }], ["limit", 120]]],
  ["documents", [["select", "id,garden_id,staff_id,child_id,name,document_type,status,expires_at,gardens(name,city),staff(full_name)"], ["order", "expires_at", { ascending: true }], ["limit", 120]]],
  ["staff", [["select", "id,garden_id,full_name,background_check_status,police_clearance_status,approved_to_work,gardens(name,city)"], ["limit", 160]]],
  ["gardens", [["select", "id,name,city,status,last_inspection_score,safe_status"], ["limit", 300]]],
  ["national_compliance_findings", [["select", "id,garden_id,title,severity,resolution_status,due_at,gardens(name,city)"], ["in", "resolution_status", ["open", "in_progress"]], ["order", "due_at", { ascending: true }], ["limit", 120]]],
  ["compliance_score_snapshots", [["select", "*"], ["order", "calculated_at", { ascending: false }], ["limit", 80]]],
  ["compliance_report_requests", [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 40]]]
];
const counts = [100, 2, 3, 20, 1, 2, 3, 2, 4], garden = { id: "garden-a", name: "GARDEN_A", city: "CITY_A" };
const fixtures = [...Array(9).fill([]), [{ id: "req-a", category: "licenses" }], [{ id: "alert-a", garden_id: garden.id, title: "ALERT_A", severity: "critical", warning_bucket: "expired", gardens: garden }], [{ id: "action-a", garden_id: garden.id, action_title: "ACTION_A", status: "open", priority: "high", gardens: garden }], [{ id: "doc-a", garden_id: garden.id, status: "expired", expires_at: "2020-01-01" }], [{ id: "staff-a", garden_id: garden.id, approved_to_work: false, background_check_status: "invalid", police_clearance_status: "invalid" }], [garden], [{ id: "finding-a", garden_id: garden.id }], [{ id: "snapshot-a" }], [{ id: "report-a" }]];
async function page({ failures = {}, data = fixtures, values = counts, empty = false, nullData = false, loader = false, deny = false } = {}) {
  let clients = 0; const chains = [], warnings = [], helper = load(helperCode, unexpected, warnings);
  const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "in", "eq", "order", "limit", "or", "lte", "lt", "neq", "not"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], count: nullData ? null : empty ? 0 : values[i] ?? null, error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
  const p = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, k) => String(k) });
    if (id === "@/lib/domain/smart-compliance") return domain; if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } }; return unexpected(id);
  }, warnings);
  if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(nodes(tree, "form").length, 0);
  return { tree, text: text(tree), clients, chains, warnings, banner: nodes(tree, "AdminDataError")[0].props.message, hero: nodes(tree, "PremiumDashboardHero")[0].props, metrics: nodes(tree, "RoleMetricCard").map((n) => n.props), components: nodes(nodes(tree, "section").find((n) => n.props.className === "compliance-score-grid"), "strong").map(text) };
}
const section = (r, title) => nodes(r.tree, "CleanSection").find((n) => n.props.title === title);
const panel = (r, title) => nodes(r.tree, "article").find((n) => text(nodes(n, "h2")[0]).includes(title));
const metricDeps = [[0, 1, 2, 3, 4, 5, 6, 7, 8], [10, 12], [2], [11], [0, 1], [3, 4], [5], [6]], componentDeps = [[0, 1, 2], [3, 4], [5], [6], [7, 8]], rankingDeps = [10, 12, 13, 14, 15];
const healthyValues = ["86/100", 2, 3, 1, "98/100", "19/20", "76%", 3], healthyTones = ["good", "bad", "warn", "warn", "warn", "warn", "warn", "warn"], healthyComponents = ["94%", "95%", "76%", "76%", "88%"];
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE_SENTINEL")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE_SENTINEL")); }
function dependencies(r, failed = []) {
  const missing = (deps) => deps.some((i) => failed.includes(i));
  assert.deepEqual(r.metrics.map((m) => m.value), healthyValues.map((v, i) => missing(metricDeps[i]) ? "לא זמין" : v));
  assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => missing(metricDeps[i]) ? "default" : v));
  assert.equal(r.hero.badge, missing(metricDeps[0]) ? "לא זמין" : "86/100"); assert.equal(r.hero.badgeTone, missing(metricDeps[0]) ? "default" : "good");
  assert.deepEqual(r.components, healthyComponents.map((v, i) => missing(componentDeps[i]) ? "לא זמין" : v)); assert.equal(r.metrics[6].hint, failed.includes(5) ? "לא זמין" : "2 באיחור");
  assert.equal(text(section(r, "קטגוריות ציות")).includes("1 דרישות"), !failed.includes(9));
  assert.equal(text(panel(r, "התראות קרובות")).includes("ALERT_A"), !failed.includes(10)); assert.equal(text(panel(r, "פעולות תיקון")).includes("ACTION_A"), !failed.includes(11));
  assert.equal(nodes(section(r, "גנים בסיכון ציות"), "Link").length, missing(rankingDeps) ? 0 : 1);
  if (missing(rankingDeps)) assert.ok(text(section(r, "גנים בסיכון ציות")).includes("לא זמין"));
  for (const [i, title, emptyText] of [[10, "התראות קרובות", "אין התראות ציות פתוחות."], [11, "פעולות תיקון", "אין פעולות תיקון פתוחות."]]) if (failed.includes(i)) { assert.ok(text(panel(r, title)).includes("לא זמין")); assert.ok(!r.text.includes(emptyText)); }
}
test("healthy actual page/helper/domain: eighteen exact chains and unchanged formulas", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let index = 0; index < 18; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source ${index} ${kind}/${stale ? "stale" : "empty"} preserves independent dependencies`, async () => {
  const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.ok(!r.banner.includes("מיגרציה")); assert.equal(r.warnings.length, 1); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE"));
});
for (const failed of [[0, 11], [2, 12], [3, 9], [5, 10], [6, 15], [7, 17], [8, 16], [10, 11], [12, 13], [14, 15]]) test(`paired ${failed} independent retention`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} is distinct from unavailable`, async () => {
  const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); const score = domain.buildComplianceScore({ totalDocuments: 0, invalidDocuments: 0, expiringDocuments: 0, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: 0, missingProcedures: 0, policyGaps: 4 });
  assert.deepEqual(r.metrics.map((m) => m.value), [`${score.score}/100`, 0, 0, 0, "0/0", "0/0", "100%", 0]); assert.equal(r.metrics[1].tone, "good"); assert.equal(r.metrics[6].hint, "0 באיחור"); assert.ok(r.text.includes("אין התראות ציות פתוחות.")); assert.equal(nodes(r.tree, "EmptyState")[0].props.title, "אין גנים להצגה");
});
test("loader and all failed sources unavailable; denied role zero clients", async () => { const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, expected.map((_, i) => i)); assert.ok(r.banner); const all = await page({ failures: Object.fromEntries(expected.map((_, i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(all); dependencies(all, expected.map((_, i) => i)); await page({ deny: true }); });
test("count errors with stale nonzero/zero/null never become known zero", async () => { for (let i = 0; i < 9; i++) for (const value of [0, null, 999]) { const values = [...counts]; values[i] = value; const r = await page({ values, failures: { [i]: { kind: "returned", stale: true } } }); contracts(r); dependencies(r, [i]); } });
test("custom valid counts use original rounding and procedure transforms", async () => { const values = [20, 3, 4, 10, 4, 3, 7, 3, 2], r = await page({ values }); const s = domain.buildComplianceScore({ totalDocuments: 20, invalidDocuments: 3, expiringDocuments: 4, totalStaff: 10, staffIssues: 4, overdueInspections: 3, unresolvedFindings: 7, missingProcedures: 2, policyGaps: 2 }); assert.equal(r.hero.badge, `${s.score}/100`); assert.deepEqual(r.components, [s.documentsScore, s.staffScore, s.inspectionsScore, s.findingsScore, s.proceduresScore].map((n) => `${n}%`)); assert.equal(r.metrics[4].value, "17/20"); assert.equal(r.metrics[5].value, "6/10"); });
test("garden ranking asc top10, independent alert/action top8 and original formulas", async () => {
  const data = structuredClone(fixtures); data[14] = Array.from({ length: 13 }, (_, i) => ({ id: `garden-${i}`, name: `RANK_${i}`, city: "CITY" })); data[10] = Array.from({ length: 12 }, (_, i) => ({ ...fixtures[10][0], id: `alert-${i}`, garden_id: `garden-${i}`, title: `ALERT_${i}` })); data[11] = Array.from({ length: 12 }, (_, i) => ({ ...fixtures[11][0], id: `action-${i}` })); data[12] = data[14].map((g, i) => ({ id: `doc-${i}`, garden_id: g.id, status: i % 2 ? "valid" : "expired", expires_at: i % 2 ? "2028-01-01" : "2020-01-01" })); data[13] = []; data[15] = [];
  const r = await page({ data }); contracts(r); const scores = data[14].map((g) => { const d = data[12].find((v) => v.garden_id === g.id), invalid = d.status === "expired" ? 1 : 0; return { id: g.id, score: domain.buildComplianceScore({ totalDocuments: 1, invalidDocuments: invalid, expiringDocuments: invalid, totalStaff: 0, staffIssues: 0, overdueInspections: 0, unresolvedFindings: data[10].filter((a) => a.garden_id === g.id).length, missingProcedures: 0, policyGaps: 0 }).score }; }).sort((a, b) => a.score - b.score).slice(0, 10);
  assert.deepEqual(nodes(section(r, "גנים בסיכון ציות"), "Link").map((n) => n.key), scores.map((v) => v.id)); assert.deepEqual(nodes(section(r, "גנים בסיכון ציות"), "StatusBadge").map(text), scores.map((v) => `${v.score}/100`)); for (const title of ["התראות קרובות", "פעולות תיקון"]) assert.equal(nodes(panel(r, title), "div").filter((n) => n.props.className === "list-item").length, 8);
});
test("actual domain fixed-clock date buckets/category/tone boundaries and navigation", async () => {
  const days = [-1, 0, 7, 8, 14, 15, 30, 31, 60, 61, 90, 91]; assert.deepEqual(days.map((n) => domain.expirationBucket(new FixedDate(FixedDate.now() + n * 86400000).toISOString())), ["expired", "7_days", "7_days", "14_days", "14_days", "30_days", "30_days", "60_days", "60_days", "90_days", "90_days", "future"]); assert.equal(domain.expirationBucket(null), "no_date"); assert.deepEqual([61, 62, 81, 82].map(domain.complianceTone), ["bad", "warn", "warn", "good"]);
  const data = structuredClone(fixtures); data[10] = ["expired", "7_days", "14_days", "30_days", "60_days", "90_days", "future", "no_date"].map((bucket, i) => ({ ...fixtures[10][0], id: `bucket-${i}`, warning_bucket: bucket })); const r = await page({ data }); for (const label of ["פג תוקף", "7 ימים", "14 ימים", "30 ימים", "60 ימים", "90 ימים", "עתידי", "ללא תאריך"]) assert.ok(text(panel(r, "התראות קרובות")).includes(label)); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/documents", "/dashboard/admin/procedures", "/dashboard/admin/policies", "/dashboard/admin/national-inspections", "/dashboard/admin/inspectors", "/dashboard/admin/reports"]); assert.equal(domain.complianceCategories.length, 8);
});
test("unique focused domain hook", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), entries = c.domain.filter((v) => v.name === "compliance-center-query-boundary"); assert.equal(entries.length, 1); assert.deepEqual(entries[0].args, ["--test", "scripts/qa/check-compliance-center-query-boundary.mjs"]); });
