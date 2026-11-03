import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function compile(path) {
  const file = fileURLToPath(new URL(`../../${path}`, import.meta.url));
  statSync(file);
  const flags = process.platform === "darwin" ? Number(execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim()) : 0;
  if (flags & 0x40000000) throw Error("Dataless source");
  return ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}
function load(source, require) {
  const exports = {};
  runInNewContext(source, { exports, require, console: { warn() {} }, Date, Intl, fetch() { throw Error("NETWORK_FORBIDDEN"); } });
  return exports;
}
const domain = load(compile("lib/domain/pilot-health.ts"), () => { throw Error("unexpected domain import"); });
const safe = load(compile("lib/admin-safe.ts"), () => { throw Error("unexpected safe import"); });
const source = compile("app/dashboard/admin/pilot-health/page.tsx");
const tables = ["pilot_programs", "pilot_deployment_checklist", "pilot_journey_validations", "pilot_issues", "pilot_feedback", "pilot_usage_analytics", "pilot_success_criteria", "pilot_participants", "camera_streams", "observer_ground_truth_reviews"];
const fixtures = [[{ id: "p", kindergarten_name: "PROFILE_MARKER", pilot_status: "active", real_customer_pilot: true, camera_availability: "test_mode", observer_participation: true }], [{ id: "c", title: "CHECKLIST_MARKER", status: "verified", required: true }], [{ id: "j", role_key: "manager", journey_step: "login", status: "passed" }], [{ id: "i", title: "ISSUE_MARKER", status: "open", severity: "critical" }], [{ id: "f", comment: "FEEDBACK_MARKER", status: "open", rating: 5, user_role: "parent", category: "general" }], [{ id: "u", daily_active_users: 8, onboarding_completion_percent: 100 }], [{ id: "s", criteria_key: "manager-satisfaction", current_value: 100 }], [{ id: "a", participant_status: "active" }], [{ id: "v", status: "online" }], [{ id: "r", outcome: "approved" }]];
const secret = "SYNTHETIC_PRIVATE_ERROR_NEVER_DISPLAY";
const missing = "לא זמין כרגע";

async function render({ failures = [], stale = false, empty = false, emptySources = [], reject = false, deny = false, throwClient = false } = {}) {
  const calls = [], order = [];
  const client = { from(table) {
    const n = calls.length; assert.equal(table, tables[n]);
    const trace = { table, operations: [] }; calls.push(trace);
    const b = {};
    for (const name of ["select", "order", "limit", "eq"]) b[name] = (...args) => { trace.operations.push([name, ...args]); return b; };
    b.then = (ok, bad) => {
      if (reject && n === 1) return Promise.reject(Error(secret)).then(ok, bad);
      return Promise.resolve({ data: failures.includes(n) && !stale ? null : empty || emptySources.includes(n) ? [] : fixtures[n], error: failures.includes(n) ? { message: secret } : null }).then(ok, bad);
    };
    return b;
  } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const noop = () => null;
  const require = (id) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "next/link") return { default: "Link" };
    if (id === "lucide-react") return new Proxy({}, { get: () => noop });
    if (id.endsWith("/dashboard-shell")) return { DashboardShell: "DashboardShell" };
    if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/premium-dashboard")) return Object.fromEntries(["ActionCard", "CleanSection", "EmptyState", "PremiumDashboardHero", "RoleMetricCard", "StatusBadge"].map((x) => [x, x]));
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { order.push("admin"); assert.deepEqual(Array.from(roles), ["admin"]); if (deny) throw Error("DENIED"); } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => { order.push("client"); if (throwClient) throw Error(secret); return client; } };
    if (id.endsWith("/admin-safe")) return safe;
    if (id.endsWith("/domain/pilot-health")) return domain;
    throw Error(`unexpected import ${id}`);
  };
  const page = load(source, require).default;
  if (deny) { await assert.rejects(page(), /DENIED/); return { calls, order }; }
  const tree = await page(), nodes = [];
  function walk(v) { if (Array.isArray(v)) return v.forEach(walk); if (v && typeof v === "object") { nodes.push(v); walk(v.props?.children); } }
  walk(tree);
  return { calls, order, text: JSON.stringify(tree), nodes, banner: nodes.find((x) => x.type === "AdminDataError")?.props.message, hero: nodes.find((x) => x.type === "PremiumDashboardHero")?.props, metric: (label) => nodes.find((x) => x.type === "RoleMetricCard" && x.props.label === label)?.props, criterion: (label) => nodes.find((x) => x.type === "div" && Array.isArray(x.props?.children) && x.props.children[0] === label)?.props.children[1].props.children };
}

for (let i = 0; i < 10; i++) test(`source ${i} failure hides aggregate score`, async () => {
  const r = await render({ failures: [i], stale: true });
  assert.equal(r.hero.badge, missing); assert.ok(r.banner); assert.ok(!r.text.includes(secret)); assert.equal(r.calls.length, 10); assert.deepEqual(r.order, ["admin", "client"]);
  if (i === 0) assert.ok(!r.text.includes("PROFILE_MARKER"));
  if (i === 1) assert.ok(!r.text.includes("CHECKLIST_MARKER"));
  if (i === 2) assert.ok(!r.text.includes("not_tested"));
  if (i === 3) { assert.equal(r.metric("בעיות פתוחות").value, missing); assert.ok(!r.text.includes("ISSUE_MARKER")); }
  if (i === 4) { assert.equal(r.metric("משובים").value, missing); assert.ok(!r.text.includes("FEEDBACK_MARKER")); }
  if (i === 5) assert.equal(r.metric("משתמשים פעילים").value, 1);
  if (i === 7) assert.equal(r.metric("משתמשים פעילים").value, missing);
  if (i === 8) assert.equal(r.metric("Camera").value, missing);
  if (i === 9) assert.equal(r.metric("Observer").value, missing);
});
test("camera and observer errors cannot fall back to profile scores", async () => {
  const r = await render({ failures: [8, 9] }); assert.equal(r.metric("Camera").value, missing); assert.equal(r.metric("Observer").value, missing); assert.ok(r.text.includes("PROFILE_MARKER")); assert.ok(r.text.includes("ISSUE_MARKER"));
});
test("issue and feedback errors preserve independent healthy data", async () => {
  const r = await render({ failures: [3, 4], stale: true }); assert.equal(r.metric("בעיות פתוחות").value, missing); assert.equal(r.metric("משובים").value, missing); assert.equal(r.criterion("Issue resolution "), missing); assert.equal(r.criterion("Parent satisfaction "), missing); assert.equal(r.criterion("Manager satisfaction "), "100%"); assert.ok(r.text.includes("CHECKLIST_MARKER")); assert.ok(r.text.includes("PROFILE_MARKER")); assert.ok(!r.text.includes("FEEDBACK_MARKER"));
});
test("failed criteria source hides criteria even when stale records accompany the error", async () => {
  const r = await render({ failures: [6], stale: true }); for (const name of ["Manager satisfaction ", "Parent satisfaction ", "Onboarding completion ", "Issue resolution ", "Observer readiness ", "Camera readiness "]) assert.equal(r.criterion(name), missing); assert.equal(r.metric("בעיות פתוחות").value, 1);
});
test("healthy empty profile does not claim verified real environment", async () => {
  const r = await render({ empty: true }); assert.equal(r.banner, null); assert.ok(!r.text.includes("סביבה אמיתית: כן")); assert.ok(r.text.includes("לא אומתה")); assert.match(r.hero.badge, /^\d+\/100$/);
});
test("successful profile marks real-customer flag as unverified metadata", async () => {
  const r = await render(); assert.equal(r.banner, null); assert.match(r.hero.badge, /^\d+\/100$/); assert.ok(r.text.includes("סימון בפרופיל בלבד — לא אומת")); assert.ok(r.text.includes("PROFILE_MARKER"));
  assert.deepEqual(r.calls.map((x) => x.table), tables); assert.deepEqual(r.calls[0].operations.map((x) => x[0]), ["select", "eq", "order", "limit"]); assert.deepEqual(r.calls[0].operations[1], ["eq", "real_customer_pilot", true]);
});
test("successful empty camera and review sources retain existing profile fallback", async () => {
  const r = await render({ emptySources: [8, 9] }); assert.equal(r.banner, null); assert.equal(r.metric("Camera").value, "65%"); assert.equal(r.metric("Observer").value, "55%");
});
test("usage failure cannot replace missing participant fallback with zero", async () => {
  const r = await render({ failures: [5], emptySources: [7] }); assert.equal(r.metric("משתמשים פעילים").value, missing);
});
for (const mode of ["reject", "throwClient"]) test(`${mode} uses controlled all-unavailable fallback`, async () => {
  const r = await render({ [mode]: true }); assert.equal(r.hero.badge, missing); assert.ok(r.banner); assert.equal(r.metric("Camera").value, missing); assert.ok(!r.text.includes(secret));
});
test("denied admission occurs before client or queries", async () => {
  const r = await render({ deny: true }); assert.deepEqual(r.order, ["admin"]); assert.equal(r.calls.length, 0);
});
