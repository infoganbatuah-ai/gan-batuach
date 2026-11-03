import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const pageSource = compile("app/dashboard/admin/digital-observer-pilot/page.tsx");
const safeSource = compile("lib/admin-safe.ts");
const tables = ["digital_observer_pilot_sites", "digital_observer_pilot_gateway_checks", "camera_streams", "digital_observer_pilot_alert_reviews", "digital_observer_pilot_calibration_profiles", "digital_observer_pilot_support_issues", "digital_observer_pilot_feedback", "digital_observer_pilot_commercial_validation", "digital_observer_pilot_legal_notes", "digital_observer_pilot_readiness_snapshots"];
const markers = ["SITE_MARKER", "GATEWAY_MARKER", "CAMERA_MARKER", null, "CALIBRATION_MARKER", "SUPPORT_MARKER", "FEEDBACK_MARKER", "COMMERCIAL_MARKER", "LEGAL_MARKER", "READINESS_MARKER"];
const fixtures = [
  { id: "1", site_name: markers[0], pilot_status: "active_pilot", readiness_score: 91 },
  { id: "2", digital_observer_pilot_sites: { site_name: markers[1] }, status: "success" },
  { id: "3", name: markers[2] },
  { id: "4", lifecycle_status: "pending_review", outcome: "false_positive" },
  { id: "5", digital_observer_pilot_sites: { site_name: markers[4] } },
  { id: "6", title: markers[5], status: "open" },
  { id: "7", digital_observer_pilot_sites: { site_name: markers[6] } },
  { id: "8", digital_observer_pilot_sites: { site_name: markers[7] } },
  { id: "9", digital_observer_pilot_sites: { site_name: markers[8] } },
  { id: "10", digital_observer_pilot_sites: { site_name: markers[9] }, readiness_score: 73 }
];
const metricFor = { 0: "pilot sites", 1: "gateway checks ready", 2: "pilot cameras", 3: "reviews pending", 5: "open support issues", 7: "commercial validations", 9: "readiness score" };
const missing = "לא זמין כרגע";
const privateError = "SYNTHETIC_PRIVATE_ERROR_WITH_IDENTIFIER";

function load(source, require) {
  const exports = {};
  runInNewContext(source, { exports, require, console: { warn() {} }, Intl, Date, fetch() { throw Error("NETWORK_FORBIDDEN"); } });
  return exports;
}
const safe = load(safeSource, () => { throw Error("unexpected safe import"); });

async function render({ failures = [], rejected = false, thrown = false, deny = false, empty = false } = {}) {
  const order = [];
  const client = { from(table) {
    order.push(`query:${table}`);
    const index = tables.indexOf(table);
    assert.notEqual(index, -1);
    const builder = { select() { return builder; }, order() { return builder; }, eq() { return builder; }, limit() {
      if (thrown && index === 1) throw Error(privateError);
      if (rejected && index === 1) return Promise.reject(Error(privateError));
      return Promise.resolve(failures.includes(index) ? { data: null, error: { message: privateError, code: "PRIVATE_CODE" } } : { data: empty ? [] : [fixtures[index]], error: null });
    } };
    return builder;
  } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const noop = () => null;
  const require = (id) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "next/link") return { __esModule: true, default: noop };
    if (id === "lucide-react") return new Proxy({}, { get: () => noop });
    if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/dashboard-shell")) return { DashboardShell: "DashboardShell" };
    if (id.endsWith("/admin-safe")) return safe;
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { order.push("authorization"); assert.deepEqual(Array.from(roles), ["admin"]); if (deny) throw Error("DENIED"); } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => { order.push("client"); return client; } };
    if (id.endsWith("/digital-observer-product")) return { DIGITAL_OBSERVER_PILOT_CAMERA_SYSTEMS: [], DIGITAL_OBSERVER_PILOT_PRIVACY_RULES: [], DIGITAL_OBSERVER_PILOT_REVIEW_LIFECYCLE: [], DIGITAL_OBSERVER_PILOT_SUPPORT_CATEGORIES: [] };
    throw Error(`unexpected import ${id}`);
  };
  const page = load(pageSource, require).default;
  if (deny) { await assert.rejects(page(), /DENIED/); return { order }; }
  const tree = await page();
  const nodes = [];
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === "object") { nodes.push(value); walk(value.props?.children); }
  }
  walk(tree);
  const text = JSON.stringify(tree);
  const banner = nodes.find((node) => node.type === "AdminDataError")?.props.message ?? null;
  const metric = (label) => nodes.find((node) => node.type === "article" && JSON.stringify(node.props.children).includes(`"${label}"`));
  return { order, text, banner, metric };
}

for (const [index, table] of tables.entries()) {
  test(`resolved error in ${table} is visible and not represented as empty`, async () => {
    const result = await render({ failures: [index] });
    assert.ok(result.banner);
    assert.ok(result.text.includes(missing));
    assert.ok(!result.text.includes(privateError));
    if (metricFor[index]) assert.ok(JSON.stringify(result.metric(metricFor[index])).includes(missing));
    if (markers[index]) assert.ok(!result.text.includes(markers[index]));
    assert.ok(result.text.includes(markers[index === 2 ? 5 : 2]));
    assert.deepEqual(result.order.slice(0, 2), ["authorization", "client"]);
    assert.equal(result.order.filter((entry) => entry.startsWith("query:")).length, 10);
  });
}
test("empty success keeps ordinary empty states without an error", async () => {
  const result = await render({ empty: true });
  assert.equal(result.banner, null);
  assert.ok(result.text.includes("No Digital Observer pilots yet"));
  assert.ok(result.text.includes("No gateway checks"));
  assert.ok(!result.text.includes(missing));
});
test("nonempty success keeps all sections and readiness", async () => {
  const result = await render();
  assert.equal(result.banner, null);
  for (const marker of markers.filter(Boolean)) assert.ok(result.text.includes(marker));
  assert.ok(JSON.stringify(result.metric("readiness score")).includes("73/100"));
});
test("multiple failures remain distinct while successful sections survive", async () => {
  const result = await render({ failures: [1, 2, 9] });
  assert.ok(result.banner);
  for (const index of [1, 2, 9]) assert.ok(JSON.stringify(result.metric(metricFor[index])).includes(missing));
  assert.ok(result.text.includes(markers[5]));
  assert.ok(!result.text.includes(privateError));
});
test("rejected load safely hides all unavailable values", async () => {
  const result = await render({ rejected: true });
  assert.ok(result.banner);
  assert.ok(JSON.stringify(result.metric("readiness score")).includes(missing));
  assert.ok(!result.text.includes(privateError));
  assert.ok(!result.text.includes("No Digital Observer pilots yet"));
});
test("synchronous loader error is also safely contained", async () => {
  const result = await render({ thrown: true });
  assert.ok(result.banner);
  assert.ok(JSON.stringify(result.metric("readiness score")).includes(missing));
  assert.ok(!result.text.includes(privateError));
});
test("denied admission precedes client creation and all queries", async () => {
  const result = await render({ deny: true });
  assert.deepEqual(result.order, ["authorization"]);
});
test("failed pilot lookup cannot supply a fallback readiness value", async () => {
  const result = await render({ failures: [0], empty: true });
  assert.ok(JSON.stringify(result.metric("readiness score")).includes(missing));
});
