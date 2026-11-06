import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page and safe-data helper; disconnected SDK/JSX/auth fixtures only.
// Child components remain opaque: not browser, live Auth, RLS or tenant proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) {
  const filename = path.join(root, relative);
  assert.equal((fs.statSync(filename).flags ?? 0) & 0x40000000, 0);
  return fs.readFileSync(filename, "utf8");
}
function compile(text) {
  const result = ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  });
  assert.equal(result.diagnostics.length, 0);
  return result.outputText;
}
const pageCode = compile(source("app/dashboard/garden/observer-intelligence/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const gardenId = "SYNTHETIC_GARDEN";
const tables = ["observer_situation_summaries", "observer_correlated_events", "camera_streams", "kindergarten_learning_profiles"];
const fixtures = [
  [{ id: "SYN_SUMMARY_A", title: "SYN_SUMMARY_TITLE" }, { id: "SYN_SUMMARY_B" }],
  [{ id: "SYN_CORRELATED", severity: "low", confidence: 0.5 }],
  [{ id: "SYN_CAM_OFFLINE", status: "offline" }, { id: "SYN_CAM_INACTIVE", active: false }, { id: "SYN_CAM_PRECEDENCE", status: "online", health_status: "failed" }],
  { id: "SYN_LEARNING", learning_maturity: "SYN_MATURITY", confidence_level: 0.5 }
];
const expected = [
  [tables[0], [["select", "*"], ["eq", "kindergarten_id", gardenId], ["order", "created_at", { ascending: false }], ["limit", 150]]],
  [tables[1], [["select", "id,kindergarten_id,status,severity,confidence"], ["eq", "kindergarten_id", gardenId], ["order", "created_at", { ascending: false }], ["limit", 100]]],
  [tables[2], [["select", "id,status,stream_status,health_status,gateway_registration_status,active"], ["or", `garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`], ["limit", 250]]],
  [tables[3], [["select", "*"], ["eq", "kindergarten_id", gardenId], ["maybeSingle"]]]
];
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (value) => JSON.parse(JSON.stringify(value));
function nodes(value, type) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, type));
  return [...(value.type === type ? [value] : []), ...Object.values(value.props ?? {}).flatMap((item) => nodes(item, type))];
}
function text(value) {
  if (value == null || typeof value === "boolean" || typeof value === "function") return "";
  if (typeof value !== "object") return String(value);
  return Array.isArray(value) ? value.map(text).join("") : text(value.props?.children);
}
let pageExecutions = 0, deniedExecutions = 0, effects = 0;
async function render({ role = "manager", garden = gardenId, data = fixtures, failures = {}, empty = false, nullData = false, deny = false, loader = false, builder = -1 } = {}) {
  pageExecutions++;
  let clients = 0;
  const chains = [], warnings = [];
  const no = (name) => { effects++; throw Error(`FORBIDDEN_EFFECT_OR_IMPORT:${name}`); };
  const context = { fetch: no, FormData: no, process: new Proxy({}, { get: no }), console: { warn: (...args) => warnings.push(args), error: no } };
  const helper = {}, exports = {};
  vm.runInNewContext(helperCode, { ...context, exports: helper, require: no });
  const client = { from(table) {
    const index = chains.length, calls = [], query = {};
    chains.push([table, calls]);
    if (index === builder) throw Error("PRIVATE_BUILDER_DIAGNOSTIC");
    for (const method of ["select", "eq", "order", "limit", "or", "maybeSingle"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => {
      if (failures[index] === "reject") return Promise.reject(Error("PRIVATE_QUERY_DIAGNOSTIC")).then(resolve, reject);
      return Promise.resolve({ data: nullData ? null : empty ? index === 3 ? null : [] : data[index], error: failures[index] ? { message: "PRIVATE_QUERY_DIAGNOSTIC", details: "PRIVATE_TENANT_DIAGNOSTIC" } : null }).then(resolve, reject);
    };
    return query;
  } };
  vm.runInNewContext(pageCode, { ...context, exports, require: (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => {
      assert.deepEqual(Array.from(roles), ["manager", "owner"]);
      assert.equal(clients + chains.length + warnings.length, 0);
      if (deny) throw Error("GARDEN_ADMISSION_DENIED");
      return { profile: { role, garden_id: garden, full_name: "[DEMO] Synthetic Owner", profile_image_url: "SYN_AVATAR_METADATA" } };
    } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_CLIENT_DIAGNOSTIC"); return client; } };
    if (["lucide-react", "@/components/dashboard-shell", "@/components/teacher-app-ui", "@/components/observer-intelligence-panel"].includes(id)) return new Proxy({}, { get: (_, name) => String(name) });
    return no(id);
  } });
  if (deny) {
    await assert.rejects(exports.default(), /GARDEN_ADMISSION_DENIED/);
    deniedExecutions++;
    assert.equal(clients + chains.length + warnings.length, 0);
    return;
  }
  const tree = await exports.default();
  assert.equal(effects, 0);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_"));
  return { tree, clients, chains, warnings, stats: nodes(tree, "TeacherStatCard").map((item) => item.props), panels: nodes(tree, "ObserverIntelligencePanel"), text: text(tree) };
}
function contracts(result) {
  assert.equal(result.clients, 1);
  assert.deepEqual(plain(result.chains), expected);
  assert.equal(nodes(result.tree, "TeacherActionTile").length, 3);
  assert.deepEqual(nodes(result.tree, "TeacherActionTile").map((item) => item.props.href), ["/dashboard/garden/cameras", "/dashboard/garden/observer-network", "/dashboard/garden/observer-pilot"]);
  assert.equal(nodes(result.tree, "Link")[0].props.href, "/dashboard/garden/observer-network");
}
function failed(result, indexes) {
  assert.equal(result.panels.length, 0);
  assert.ok(result.text.includes("סיכומי התצפיתן אינם זמינים כרגע"));
  assert.equal(nodes(result.tree, "div").filter((item) => item.props.role === "status").length, 1);
  for (let i = 0; i < 3; i++) {
    assert.equal(result.stats[i].value, indexes.includes(i) ? "לא זמין" : [2, 1, 2][i]);
    assert.equal(result.stats[i].tone, indexes.includes(i) ? "neutral" : "orange");
  }
  assert.equal(result.stats[3].value, "פעיל");
}
const cases = [
  ["garden-observer-healthy-manager-exact-four-chains-and-panel-payload", async () => {
    const result = await render(); contracts(result);
    assert.deepEqual(result.stats.slice(0, 3).map((item) => item.value), [2, 1, 2]);
    assert.equal(nodes(result.tree, "DashboardShell")[0].props.role, "manager");
    assert.equal(result.panels.length, 1);
    assert.deepEqual(plain(result.panels[0].props), { role: "garden", fixedKindergartenId: gardenId, summaries: fixtures[0], correlatedEvents: fixtures[1], cameraWarnings: 2, learningProfiles: [fixtures[3]] });
    const frame = nodes(result.tree, "TeacherAppFrame")[0].props;
    assert.equal(frame.active, "more"); assert.equal(frame.avatarUrl, "SYN_AVATAR_METADATA"); assert.equal(frame.title, "בוקר טוב, Synthetic");
  }],
  ["garden-observer-owner-role-and-camera-warning-precedence", async () => {
    const data = structuredClone(fixtures);
    data[2] = [{ status: "online", health_status: "failed" }, { stream_status: "offline" }, { health_status: "error" }, { gateway_registration_status: "pending_gateway" }, { status: "online", active: false }, { status: "disabled" }, { status: "healthy", active: true }];
    const result = await render({ role: "owner", data }); contracts(result);
    assert.equal(nodes(result.tree, "DashboardShell")[0].props.role, "owner");
    assert.equal(result.stats[2].value, 5); assert.equal(result.panels[0].props.cameraWarnings, 5);
    assert.deepEqual(plain(result.panels[0].props.summaries), fixtures[0]);
  }],
  ["garden-observer-healthy-empty-remains-measured-zero", async () => {
    const result = await render({ empty: true }); contracts(result);
    assert.deepEqual(result.stats.slice(0, 3).map((item) => [item.value, item.tone]), [[0, "green"], [0, "green"], [0, "green"]]);
    assert.equal(result.panels.length, 1); assert.equal(result.panels[0].props.learningProfiles.length, 0);
  }],
  ["garden-observer-healthy-null-remains-empty-not-unavailable", async () => {
    const result = await render({ nullData: true }); contracts(result);
    assert.deepEqual(result.stats.slice(0, 3).map((item) => item.value), [0, 0, 0]);
    assert.equal(result.panels.length, 1); assert.equal(result.panels[0].props.fixedKindergartenId, gardenId);
  }],
  ...tables.map((table, index) => [`garden-observer-returned-${table}-stale-data-denied`, async () => {
    const result = await render({ failures: { [index]: "returned" } }); contracts(result); failed(result, [index]);
    assert.equal(result.warnings.length, 1);
  }]),
  ["garden-observer-rejected-summary-keeps-independent-correlated-and-camera", async () => {
    const result = await render({ failures: { 0: "reject" } }); contracts(result); failed(result, [0]);
  }],
  ["garden-observer-rejected-learning-gates-panel-not-independent-statistics", async () => {
    const result = await render({ failures: { 3: "reject" } }); contracts(result); failed(result, [3]);
  }],
  ["garden-observer-mixed-failed-summary-camera-preserves-correlated", async () => {
    const result = await render({ failures: { 0: "returned", 2: "reject" } }); contracts(result); failed(result, [0, 2]);
  }],
  ["garden-observer-missing-context-never-constructs-client", async () => {
    for (const garden of [null, ""]) {
      const result = await render({ garden });
      assert.equal(result.clients, 0); assert.equal(result.chains.length, 0); failed(result, [0, 1, 2]);
    }
  }],
  ["garden-observer-denied-admission-not-caught-or-rendered", async () => { await render({ deny: true }); }],
  ["garden-observer-client-throw-safe-unavailable-no-private-diagnostics", async () => {
    const result = await render({ loader: true }); assert.equal(result.clients, 1); assert.equal(result.chains.length, 0); failed(result, [0, 1, 2]);
    assert.equal(result.warnings.length, 1);
  }],
  ["garden-observer-query-builder-throw-isolated-to-camera", async () => {
    const result = await render({ builder: 2 }); failed(result, [2]);
    assert.equal(result.chains.length, 4); assert.equal(result.chains[2][1].length, 0);
    assert.deepEqual(plain(result.chains.filter((_, index) => index !== 2)), expected.filter((_, index) => index !== 2));
  }],
  ["garden-observer-all-stale-errors-never-mount-editable-panel", async () => {
    const result = await render({ failures: { 0: "returned", 1: "returned", 2: "returned", 3: "returned" } }); contracts(result); failed(result, [0, 1, 2]);
    assert.equal(result.warnings.length, 4);
  }]
];
assert.equal(cases.length, 16);
const ids = cases.map(([id]) => id); assert.equal(new Set(ids).size, 16);
console.log("CASE_REGISTRY " + JSON.stringify(ids));
for (const [id, run] of cases) test(id, run);
after(() => { console.log("GARDEN_OBSERVER_OBSERVATIONS " + JSON.stringify({ pageExecutions, deniedExecutions, effects, sharedChildren: "OPAQUE", liveAuthOrDatabase: false })); assert.equal(effects, 0); });
