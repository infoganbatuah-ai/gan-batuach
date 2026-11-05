import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function compile(path) { const file = fileURLToPath(new URL(`../../${path}`, import.meta.url)); statSync(file); const flags = process.platform === "darwin" ? Number(execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim()) : 0; if (flags & 0x40000000) throw Error("Dataless source"); return ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText; }
function load(source, require) { const exports = {}; runInNewContext(source, { exports, require, console: { warn() {} }, Date, Intl, fetch() { throw Error("NETWORK_FORBIDDEN"); } }); return exports; }
const safe = load(compile("lib/admin-safe.ts"), () => { throw Error("unexpected safe import"); });
const source = compile("app/dashboard/admin/first-pilot/page.tsx");
const tables = ["pilot_kindergarten_profiles", "first_pilot_readiness_scores", "pilot_approval_gates", "pilot_data_policies", "pilot_agreement_checklist", "pilot_training_checklist", "pilot_issue_reports", "pilot_feedback_collection", "pilot_daily_health_checks", "pilot_success_metrics", "pilot_risks", "pilot_exit_criteria"];
const fixtures = [[{ id: "p", kindergarten_name: "PROFILE_MARKER", pilot_status: "preparing", health_score: 88 }], [{ id: "s", readiness_score: 96, status: "pilot_ready" }], [{ id: "g", title: "GATE_MARKER", required: true, blocks_activation: true, status: "blocked" }], [{ id: "d", data_category: "camera_data", allowed: false, approval_status: "not_approved" }], [{ id: "a", title: "AGREEMENT_MARKER", status: "signed" }], [{ id: "t", title: "TRAINING_MARKER", status: "completed" }], [{ id: "i", title: "ISSUE_MARKER", status: "open", severity: "critical" }], [{ id: "f", title: "FEEDBACK_MARKER", status: "open" }], [{ id: "h", status: "healthy", score: 92, manager_logged_in: true }], [{ id: "m", metric_name: "METRIC_MARKER", status: "met", metric_value: 1 }], [{ id: "r", risk_title: "RISK_MARKER", severity: "critical", status: "open" }], [{ id: "e", title: "EXIT_MARKER", status: "met" }]];
const missing = "לא זמין כרגע", secret = "SYNTHETIC_PRIVATE_ERROR";
async function render({ failures = [], stale = false, empty = false, reject = -1, deny = false, throwClient = false, scoreValue = 96 } = {}) {
  const calls = [], order = [];
  const rows = fixtures.map((items) => items.map((item) => ({ ...item }))); rows[1][0].readiness_score = scoreValue;
  const client = { from(table) { const i = calls.length; assert.equal(table, tables[i]); const trace = { table, operations: [] }; calls.push(trace); const b = {};
    for (const method of ["select", "order", "limit"]) b[method] = (...args) => { trace.operations.push([method, ...args]); return b; };
    b.then = (ok, bad) => reject === i ? Promise.reject(Error(secret)).then(ok, bad) : Promise.resolve({ data: failures.includes(i) && !stale ? null : empty ? [] : rows[i], error: failures.includes(i) ? { message: secret } : null }).then(ok, bad); return b;
  } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, noop = () => null;
  const require = (id) => {
    if (id === "react/jsx-runtime") return jsx; if (id === "next/link") return { default: "Link" }; if (id === "lucide-react") return new Proxy({}, { get: () => noop });
    if (id.endsWith("/dashboard-shell")) return { DashboardShell: "DashboardShell" }; if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/premium-dashboard")) return Object.fromEntries(["ActionCard", "CleanSection", "EmptyState", "PremiumDashboardHero", "RoleMetricCard", "StatusBadge"].map((x) => [x, x]));
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { order.push("admin"); assert.deepEqual(Array.from(roles), ["admin"]); if (deny) throw Error("DENIED"); } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => { order.push("client"); if (throwClient) throw Error(secret); return client; } }; if (id.endsWith("/admin-safe")) return safe; throw Error(`unexpected import ${id}`);
  };
  const page = load(source, require).default; if (deny) { await assert.rejects(page(), /DENIED/); return { calls, order }; }
  const tree = await page(), nodes = []; function walk(v) { if (Array.isArray(v)) return v.forEach(walk); if (v && typeof v === "object") { nodes.push(v); walk(v.props?.children); } } walk(tree);
  return { calls, order, text: JSON.stringify(tree), nodes, banner: nodes.find((x) => x.type === "AdminDataError")?.props.message, hero: nodes.find((x) => x.type === "PremiumDashboardHero")?.props, metric: (label) => nodes.find((x) => x.type === "RoleMetricCard" && x.props.label === label)?.props, action: (title) => nodes.find((x) => x.type === "ActionCard" && x.props.title === title)?.props };
}
const markers = ["PROFILE_MARKER", null, "GATE_MARKER", null, "AGREEMENT_MARKER", "TRAINING_MARKER", "ISSUE_MARKER", "FEEDBACK_MARKER", null, "METRIC_MARKER", "RISK_MARKER", "EXIT_MARKER"];
const metricLabels = { 0: "Pilot status", 1: "Pilot health", 2: "Approval gates", 3: "Data allowed", 4: "Agreements", 5: "Training", 6: "Open issues", 11: "Exit criteria" };
for (let i = 0; i < 12; i++) test(`source ${i} failure is unavailable and stale data discarded`, async () => {
  const r = await render({ failures: [i], stale: true }); assert.ok(r.banner); assert.ok(!r.text.includes(secret)); assert.equal(r.calls.length, 12); assert.deepEqual(r.order, ["admin", "client"]); if (markers[i]) assert.ok(!r.text.includes(markers[i])); if (metricLabels[i]) assert.equal(r.metric(metricLabels[i]).value, missing);
  if (i === 1) assert.equal(r.hero.badge, missing); if (i === 0) assert.equal(r.hero.badge, "96/100"); if (i === 8) assert.ok(!r.text.includes("פעולות יומיות סומנו"));
  if (i === 3) { assert.equal(r.action("Camera pilot").text, missing); assert.equal(r.action("Observer pilot").text, missing); } if (i === 5) assert.equal(r.action("Training").text, missing);
});
test("paired gate and issue failures cannot claim readiness", async () => { const r = await render({ failures: [2, 6] }); assert.ok(r.banner); assert.ok(!r.nodes.some((x) => x.props?.className === "success-banner")); assert.ok(r.text.includes("לא ניתן לקבוע מוכנות")); });
test("single rejected query retains independent healthy data", async () => { const r = await render({ reject: 6 }); assert.ok(r.banner); assert.equal(r.metric("Open issues").value, missing); assert.ok(r.text.includes("GATE_MARKER")); assert.ok(r.text.includes("PROFILE_MARKER")); });
test("score null falls back only to available profile; zero stays zero", async () => { const a = await render({ scoreValue: null }); assert.equal(a.hero.badge, "88/100"); const b = await render({ scoreValue: 0 }); assert.equal(b.hero.badge, "0/100"); const c = await render({ scoreValue: null, failures: [0] }); assert.equal(c.hero.badge, missing); });
test("healthy empty retains empty semantics without migration instruction", async () => { const r = await render({ empty: true }); assert.equal(r.banner, null); assert.equal(r.hero.badge, "0/100"); assert.ok(!r.text.includes("הרצת המיגרציה")); });
test("healthy query order and exact operations unchanged", async () => { const r = await render(); assert.equal(r.banner, null); assert.deepEqual(r.calls.map((x) => x.table), tables); const desc={ ascending: false }; const expected = [
  [["select","*"],["order","created_at",desc],["limit",20]], [["select","*"],["order","calculated_at",desc],["limit",20]], [["select","*"],["order","gate_area"],["order","gate_key"],["limit",80]], [["select","*"],["order","data_category"],["limit",80]], [["select","*"],["order","document_type"],["limit",80]], [["select","*"],["order","training_track"],["limit",80]], [["select","*"],["order","severity"],["order","created_at",desc],["limit",100]], [["select","*"],["order","collected_at",desc],["limit",80]], [["select","*"],["order","check_date",desc],["limit",30]], [["select","*"],["order","metric_area"],["limit",80]], [["select","*"],["order","severity"],["order","risk_category"],["limit",100]], [["select","*"],["order","criteria_key"],["limit",80]] ]; assert.deepEqual(JSON.parse(JSON.stringify(r.calls.map((x)=>x.operations))), expected); });
test("thrown client is safely unavailable", async () => { const r = await render({ throwClient: true }); assert.ok(r.banner); assert.equal(r.hero.badge, missing); assert.ok(!r.text.includes(secret)); assert.ok(!r.nodes.some((x) => x.props?.className === "success-banner")); });
test("denied admission prevents client and queries", async () => { const r = await render({ deny: true }); assert.deepEqual(r.order, ["admin"]); assert.equal(r.calls.length, 0); });
