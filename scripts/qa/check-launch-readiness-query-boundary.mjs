import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function compile(path) { const file = fileURLToPath(new URL(`../../${path}`, import.meta.url)); statSync(file); const flags = process.platform === "darwin" ? Number(execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim()) : 0; if (flags & 0x40000000) throw Error("Dataless source"); return ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText; }
function load(source, require) { const exports = {}; runInNewContext(source, { exports, require, console: { warn() {} }, Date, Intl, fetch() { throw Error("NETWORK_FORBIDDEN"); } }); return exports; }
const domain = load(compile("lib/domain/launch-readiness.ts"), () => { throw Error("unexpected domain import"); });
const safe = load(compile("lib/admin-safe.ts"), () => { throw Error("unexpected safe import"); });
const source = compile("app/dashboard/admin/launch-readiness/page.tsx");
const tables = ["launch_readiness_scores", "production_configuration_readiness", "launch_issues", "launch_blockers", "launch_checklist", "pilot_programs", "pilot_participants", "customer_success_readiness", "performance_readiness_checks", "production_readiness_score", "launch_validation_reviews", "launch_risk_register", "go_live_decisions", "launch_executive_reports"];
const fixtures = [["onboarding", "communication", "camera", "observer", "security", "support"].map((category) => ({ id: category, category, score: 80, status: "ready", evidence_summary: "READINESS_MARKER" })), [{ id: "c", title: "CONFIG_MARKER", readiness_status: "ready" }], [{ id: "i", title: "ISSUE_MARKER", status: "open", severity: "critical" }], [{ id: "b", title: "BLOCKER_MARKER", status: "open", severity: "critical" }], [{ id: "l", title: "CHECKLIST_MARKER", required: true, status: "verified" }], [{ id: "p", pilot_status: "active" }], [{ id: "a", participant_status: "active" }], [{ id: "s", title: "SUCCESS_MARKER" }], [{ id: "h", health_area: "PERFORMANCE_MARKER", status: "healthy" }], [{ id: "q", readiness_area: "security", score: 95, weight: 1, status: "ready" }], [{ id: "v", title: "VALIDATION_MARKER", status: "passed" }], [{ id: "r", title: "RISK_MARKER", status: "open", severity: "critical" }], [{ id: "g", decision_status: "production_approved", decision_summary: "DECISION_MARKER", readiness_score: 95 }], [{ id: "e", title: "REPORT_MARKER", status: "ready" }]];
const missing = "לא זמין כרגע", secret = "SYNTHETIC_PRIVATE_ERROR";
const names = ["updateLaunchBlocker", "updateLaunchChecklistItem", "updateLaunchIssue", "updateLaunchReadinessScore", "updatePerformanceReadinessCheck", "updateProductionConfiguration"];
const actions = Object.fromEntries(names.map((name) => [name, () => { throw Error("ACTION_FORBIDDEN"); }]));
async function render({ failures = [], stale = false, empty = false, emptySources = [], deny = false, throwClient = false, reject = false } = {}) {
  const calls = [], order = [];
  const client = { from(table) { const i = calls.length; assert.equal(table, tables[i]); const trace = { table, operations: [] }; calls.push(trace); const b = {};
    for (const method of ["select", "order", "limit", "eq"]) b[method] = (...args) => { trace.operations.push([method, ...args]); return b; };
    b.then = (ok, bad) => reject && i === 1 ? Promise.reject(Error(secret)).then(ok, bad) : Promise.resolve({ data: failures.includes(i) && !stale ? null : empty || emptySources.includes(i) ? [] : fixtures[i], error: failures.includes(i) ? { message: secret } : null }).then(ok, bad); return b;
  } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, noop = () => null;
  const require = (id) => {
    if (id === "react/jsx-runtime") return jsx; if (id === "next/link") return { default: "Link" }; if (id === "lucide-react") return new Proxy({}, { get: () => noop });
    if (id.endsWith("/dashboard-shell")) return { DashboardShell: "DashboardShell" }; if (id.endsWith("/stat-card")) return { StatCard: "StatCard" }; if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/premium-dashboard")) return Object.fromEntries(["PremiumDashboardHero", "RoleMetricCard", "StatusBadge"].map((x) => [x, x]));
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { order.push("admin"); assert.deepEqual(Array.from(roles), ["admin"]); if (deny) throw Error("DENIED"); } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => { order.push("client"); if (throwClient) throw Error(secret); return client; } };
    if (id.endsWith("/admin-safe")) return safe; if (id.endsWith("/domain/launch-readiness")) return domain; if (id.endsWith("/actions")) return actions; throw Error(`unexpected import ${id}`);
  };
  const page = load(source, require).default;
  if (deny) { await assert.rejects(page(), /DENIED/); return { calls, order }; }
  const tree = await page(), nodes = [];
  function walk(v) { if (Array.isArray(v)) return v.forEach(walk); if (v && typeof v === "object") { nodes.push(v); walk(v.props?.children); } } walk(tree);
  return { calls, order, text: JSON.stringify(tree), nodes, banner: nodes.find((x) => x.type === "AdminDataError")?.props.message, hero: nodes.find((x) => x.type === "PremiumDashboardHero")?.props, metric: (label) => nodes.find((x) => x.type === "StatCard" && x.props.label === label)?.props, forms: nodes.filter((x) => x.type === "form") };
}
const markers = ["READINESS_MARKER", "CONFIG_MARKER", "ISSUE_MARKER", "BLOCKER_MARKER", "CHECKLIST_MARKER", null, null, null, "PERFORMANCE_MARKER", null, "VALIDATION_MARKER", "RISK_MARKER", "DECISION_MARKER", "REPORT_MARKER"];
const metricLabels = { 0: "Readiness", 1: "Config ready", 2: "בעיות פתוחות", 3: "חסמים פתוחים", 4: "Checklist", 5: "פיילוטים פעילים", 9: "Production", 10: "Validation", 11: "Risks" };
for (let i = 0; i < 14; i++) test(`source ${i} error suppresses stale data`, async () => {
  const r = await render({ failures: [i], stale: true }); assert.ok(r.banner); assert.ok(!r.text.includes(secret)); assert.deepEqual(r.order, ["admin", "client"]); assert.equal(r.calls.length, 14);
  if (markers[i]) assert.ok(!r.text.includes(markers[i])); if (metricLabels[i]) assert.equal(r.metric(metricLabels[i]).value, missing);
  const actionBySource = { 0: "updateLaunchReadinessScore", 1: "updateProductionConfiguration", 2: "updateLaunchIssue", 3: "updateLaunchBlocker", 4: "updateLaunchChecklistItem", 8: "updatePerformanceReadinessCheck" };
  if (actionBySource[i]) assert.ok(!r.forms.some((f) => f.props.action === actions[actionBySource[i]]));
  if ([0, 2, 3, 4].includes(i)) assert.equal(r.hero.badgeTone, "warn");
  if (i === 12) assert.ok(!r.text.includes("production_approved"));
  if (i === 9) for (const label of ["Security", "Billing", "Mobile", "Camera", "AI", "Support", "Pilot", "Operations"]) assert.equal(r.metric(label).value, missing);
});
test("production error never falls back; unrelated readiness remains", async () => { const r = await render({ failures: [9], stale: true }); assert.equal(r.metric("Production").value, missing); assert.equal(r.metric("Readiness").value, "80%"); });
test("readiness error preserves explicit production score only", async () => { const r = await render({ failures: [0], stale: true }); assert.equal(r.metric("Production").value, "95%"); assert.equal(r.metric("Security").value, "95%"); assert.equal(r.metric("Camera").value, missing); });
test("empty healthy production uses healthy readiness fallback", async () => { const r = await render({ emptySources: [9] }); assert.equal(r.metric("Production").value, "80%"); assert.equal(r.metric("Security").value, "80%"); });
test("empty production with failed readiness cannot fallback", async () => { const r = await render({ failures: [0], emptySources: [9] }); assert.equal(r.metric("Production").value, missing); assert.equal(r.metric("Security").value, missing); assert.equal(r.metric("Billing").value, "0%"); });
test("paired issue/blocker failure retains healthy forms and scores", async () => { const r = await render({ failures: [2, 3], stale: true }); assert.equal(r.metric("Readiness").value, "80%"); assert.ok(r.forms.some((f) => f.props.action === actions.updateProductionConfiguration)); assert.ok(!r.forms.some((f) => f.props.action === actions.updateLaunchIssue || f.props.action === actions.updateLaunchBlocker)); });
test("healthy queries preserve all fourteen chains and six action bindings", async () => { const r = await render(); assert.equal(r.banner, null); assert.deepEqual(r.calls.map((x) => x.table), tables); for (const action of Object.values(actions)) assert.ok(r.forms.some((f) => f.props.action === action));
  const expected = [["category"], ["category"], ["created_at", 200], ["created_at", 100], ["category"], ["created_at", 100], ["created_at", 300], ["material_type"], ["health_area"], ["readiness_area"], ["validation_type"], ["severity"], ["created_at", 5], ["created_at", 20]];
  for (const [i, call] of r.calls.entries()) { const want = [["select", "*"], expected[i][0] === "created_at" ? ["order", "created_at", { ascending: false }] : ["order", expected[i][0]]]; if (expected[i].length > 1) want.push(["limit", expected[i][1]]); assert.deepEqual(JSON.parse(JSON.stringify(call.operations)), want); }
});
test("healthy empty data remains empty without migration instruction", async () => { const r = await render({ empty: true }); assert.equal(r.banner, null); assert.equal(r.metric("Readiness").value, "0%"); assert.ok(!r.text.includes("מיגרציית Phase 144")); });
for (const mode of ["throwClient", "reject"]) test(`${mode} is safe and unavailable`, async () => { const r = await render({ [mode]: true }); assert.ok(r.banner); assert.equal(r.metric("Production").value, missing); assert.equal(r.hero.badgeTone, "warn"); assert.equal(r.forms.length, 0); assert.ok(!r.text.includes(secret)); });
test("denied admission prevents client and queries", async () => { const r = await render({ deny: true }); assert.deepEqual(r.order, ["admin"]); assert.equal(r.calls.length, 0); });
