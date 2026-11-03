import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function compile(path) {
  const file = fileURLToPath(new URL(`../../${path}`, import.meta.url)); statSync(file);
  const flags = process.platform === "darwin" ? Number(execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim()) : 0;
  if (flags & 0x40000000) throw Error("Dataless source");
  return ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}
function load(source, require) { const exports = {}; runInNewContext(source, { exports, require, console: { warn() {} }, Date, Intl, fetch() { throw Error("NETWORK_FORBIDDEN"); } }); return exports; }
const domain = load(compile("lib/domain/launch-readiness.ts"), () => { throw Error("unexpected domain import"); });
const safe = load(compile("lib/admin-safe.ts"), () => { throw Error("unexpected safe import"); });
const source = compile("app/dashboard/admin/pilot-center/page.tsx");
const tables = ["pilot_programs", "pilot_participants", "pilot_feedback", "launch_issues", "launch_blockers", "launch_checklist", "launch_readiness_scores", "production_configuration_readiness"];
const fixtures = [[{ id: "p", pilot_name: "PILOT_MARKER", pilot_status: "active", onboarding_status: "completed", observer_status: "configured" }], [{ id: "a", participant_status: "active", profiles: { full_name: "PARTICIPANT_MARKER" } }], [{ id: "f", comment: "FEEDBACK_MARKER", status: "open" }], [{ id: "i", title: "ISSUE_MARKER", status: "open", severity: "critical" }], [{ id: "b", status: "open", severity: "critical" }], [{ id: "c", required: true, status: "verified" }], ["onboarding", "communication", "camera", "observer", "security", "support"].map((category) => ({ category, score: 100, status: "ready" })), [{ id: "k", readiness_status: "ready" }]];
const missing = "לא זמין כרגע", secret = "SYNTHETIC_PRIVATE_ERROR";
const actions = { updateLaunchIssue() { throw Error("ACTION_FORBIDDEN"); }, updatePilotProgram() { throw Error("ACTION_FORBIDDEN"); }, updatePilotParticipant() { throw Error("ACTION_FORBIDDEN"); } };

async function render({ failures = [], stale = false, empty = false, deny = false, throwClient = false, reject = false } = {}) {
  const calls = [], order = [];
  const client = { from(table) { const i = calls.length; assert.equal(table, tables[i]); const trace = { table, operations: [] }; calls.push(trace); const b = {};
    for (const method of ["select", "order", "limit", "eq"]) b[method] = (...args) => { trace.operations.push([method, ...args]); return b; };
    b.then = (ok, bad) => reject && i === 1 ? Promise.reject(Error(secret)).then(ok, bad) : Promise.resolve({ data: failures.includes(i) && !stale ? null : empty ? [] : fixtures[i], error: failures.includes(i) ? { message: secret } : null }).then(ok, bad); return b;
  } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }, noop = () => null;
  const require = (id) => {
    if (id === "react/jsx-runtime") return jsx; if (id === "next/link") return { default: "Link" }; if (id === "lucide-react") return new Proxy({}, { get: () => noop });
    if (id.endsWith("/dashboard-shell")) return { DashboardShell: "DashboardShell" }; if (id.endsWith("/stat-card")) return { StatCard: "StatCard" }; if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { order.push("admin"); assert.deepEqual(Array.from(roles), ["admin"]); if (deny) throw Error("DENIED"); } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => { order.push("client"); if (throwClient) throw Error(secret); return client; } };
    if (id.endsWith("/admin-safe")) return safe; if (id.endsWith("/domain/launch-readiness")) return domain; if (id.endsWith("/actions")) return actions; throw Error(`unexpected import ${id}`);
  };
  const page = load(source, require).default;
  if (deny) { await assert.rejects(page(), /DENIED/); return { calls, order }; }
  const tree = await page(), nodes = [];
  function walk(v) { if (Array.isArray(v)) return v.forEach(walk); if (v && typeof v === "object") { nodes.push(v); walk(v.props?.children); } } walk(tree);
  return { calls, order, text: JSON.stringify(tree), nodes, banner: nodes.find((x) => x.type === "AdminDataError")?.props.message, metric: (label) => nodes.find((x) => x.type === "StatCard" && x.props.label === label)?.props, forms: nodes.filter((x) => x.type === "form") };
}

for (let i = 0; i < 8; i++) test(`source ${i} error is visible and stale data suppressed`, async () => {
  const r = await render({ failures: [i], stale: true }); assert.ok(r.banner); assert.ok(!r.text.includes(secret)); assert.deepEqual(r.order, ["admin", "client"]); assert.equal(r.calls.length, 8);
  if (i === 0) { assert.equal(r.metric("פיילוטים פעילים").value, missing); assert.ok(!r.text.includes("PILOT_MARKER")); assert.ok(!r.forms.some((f) => f.props.action === actions.updatePilotProgram)); }
  if (i === 1) { assert.equal(r.metric("משתתפים פעילים").value, missing); assert.ok(!r.text.includes("PARTICIPANT_MARKER")); assert.ok(!r.forms.some((f) => f.props.action === actions.updatePilotParticipant)); }
  if (i === 2) assert.ok(!r.text.includes("FEEDBACK_MARKER"));
  if (i === 3) { assert.equal(r.metric("בעיות פתוחות").value, missing); assert.equal(r.metric("Critical").value, missing); assert.ok(!r.text.includes("ISSUE_MARKER")); assert.ok(!r.forms.some((f) => f.props.action === actions.updateLaunchIssue)); }
  if (i === 4) assert.equal(r.metric("חסמים").value, missing);
  if (i === 5) assert.equal(r.metric("Checklist").value, missing);
  if (i === 6) { assert.equal(r.metric("Launch score").value, missing); assert.equal(r.text.split(missing).length - 1 >= 7, true); } else assert.equal(r.metric("Launch score").value, "100%");
});
test("paired failures preserve independent values and action bindings", async () => {
  const r = await render({ failures: [2, 3], stale: true }); assert.equal(r.metric("Launch score").value, "100%"); assert.equal(r.metric("פיילוטים פעילים").value, 1); assert.ok(r.text.includes("PILOT_MARKER")); assert.ok(r.text.includes("PARTICIPANT_MARKER")); assert.ok(r.forms.some((f) => f.props.action === actions.updatePilotProgram)); assert.ok(r.forms.some((f) => f.props.action === actions.updatePilotParticipant)); assert.ok(!r.forms.some((f) => f.props.action === actions.updateLaunchIssue));
});
test("successful empty data remains empty without ready claim", async () => { const r = await render({ empty: true }); assert.equal(r.banner, null); assert.equal(r.metric("Launch score").value, "0%"); assert.ok(r.text.includes("אין גני פיילוט עדיין")); assert.ok(!r.text.includes("Pilot ready layer")); });
test("healthy data preserves query order, actions and scores", async () => {
  const r = await render(); assert.equal(r.banner, null); assert.equal(r.metric("Launch score").value, "100%"); assert.deepEqual(r.calls.map((x) => x.table), tables); for (const action of Object.values(actions)) assert.ok(r.forms.some((f) => f.props.action === action)); assert.ok(!r.text.includes("Pilot ready layer"));
  assert.deepEqual(r.calls.map((x) => x.operations.map((op) => op[0])), [["select", "order", "limit"], ["select", "order", "limit"], ["select", "order", "limit"], ["select", "order", "limit"], ["select", "order", "limit"], ["select", "order"], ["select", "order"], ["select", "order"]]);
  const expected = [
    [["select", "*, gardens(name, city)"], ["order", "created_at", { ascending: false }], ["limit", 100]],
    [["select", "*, profiles(full_name, role), gardens(name)"], ["order", "created_at", { ascending: false }], ["limit", 300]],
    [["select", "id,user_role,category,status,severity,sentiment,rating,comment,page_path,created_at"], ["order", "created_at", { ascending: false }], ["limit", 80]],
    [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 120]],
    [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 80]],
    [["select", "*"], ["order", "category"]], [["select", "*"], ["order", "category"]], [["select", "*"], ["order", "category"]]
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(r.calls.map((x) => x.operations))), expected);
});
for (const mode of ["throwClient", "reject"]) test(`${mode} gives safe unavailable fallback`, async () => { const r = await render({ [mode]: true }); assert.ok(r.banner); assert.equal(r.metric("Launch score").value, missing); assert.ok(!r.text.includes(secret)); assert.ok(!r.text.includes("Pilot ready layer")); assert.equal(r.forms.length, 0); });
test("denied admission prevents client and queries", async () => { const r = await render({ deny: true }); assert.deepEqual(r.order, ["admin"]); assert.equal(r.calls.length, 0); });
