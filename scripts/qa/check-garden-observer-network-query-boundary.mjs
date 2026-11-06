import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual Garden page/helper, synthetic SDK/Auth/JSX; children stay opaque.
// Only three selected pure declarations, never the whole domain or real Auth.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) {
  const filename = path.join(root, relative);
  assert.equal((fs.statSync(filename).flags ?? 0) & 0x40000000, 0);
  return fs.readFileSync(filename, "utf8");
}
function compile(text) {
  const result = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(result.diagnostics.length, 0);
  return result.outputText;
}
const pageCode = compile(source("app/dashboard/garden/observer-network/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const domainAST = ts.createSourceFile("observer-network.ts", source("lib/domain/observer-network.ts"), ts.ScriptTarget.Latest, true);
const selected = ["observerNetworkTone", "clampObserverNetworkScore", "buildObserverReadinessScore"];
const pureCode = compile(selected.map((name) => {
  const found = domainAST.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.equal(found.length, 1, name); return found[0].getText(domainAST);
}).join("\n"));
const gardenId = "SYN_NETWORK_GARDEN";
const tables = ["observer_intelligence_signals", "observer_safety_recommendations", "camera_streams", "compliance_alerts"];
const fixtures = [
  Array.from({ length: 10 }, (_, i) => ({ id: `SYN_SIGNAL_${i}`, kindergarten_id: gardenId, signal_type: i === 0 ? "camera_health" : i === 1 ? "compliance" : "synthetic", recommended_action: `SYN_ACTION_${i}`, risk_score: 90 - i, review_status: "needs_review" })),
  Array.from({ length: 8 }, (_, i) => ({ id: `SYN_REC_${i}`, kindergarten_id: gardenId, recommendation_text: `SYN_RECOMMENDATION_${i}`, recommendation_type: "synthetic", status: "open" })),
  [{ id: "SYN_CAM_0", status: "online", health_status: "failed", active: true }, { id: "SYN_CAM_1", stream_status: "offline", active: true }, { id: "SYN_CAM_2", health_status: "degraded", active: true }, { id: "SYN_CAM_3", status: "online", active: false }, { id: "SYN_CAM_4", status: "healthy", active: true }],
  [{ id: "SYN_COMPLIANCE_0", alert_status: "open" }, { id: "SYN_COMPLIANCE_1", alert_status: "in_progress" }]
];
const expected = [
  [tables[0], [["select", "*"], ["eq", "kindergarten_id", gardenId], ["in", "review_status", ["needs_review", "reviewing", "escalated"]], ["order", "risk_score", { ascending: false }], ["limit", 80]]],
  [tables[1], [["select", "*"], ["eq", "kindergarten_id", gardenId], ["eq", "status", "open"], ["order", "created_at", { ascending: false }], ["limit", 60]]],
  [tables[2], [["select", "id,status,stream_status,health_status,active"], ["or", `garden_id.eq.${gardenId},kindergarten_id.eq.${gardenId}`], ["limit", 250]]],
  [tables[3], [["select", "id,severity,alert_status"], ["eq", "garden_id", gardenId], ["in", "alert_status", ["open", "in_progress"]], ["limit", 80]]]
];
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (value) => JSON.parse(JSON.stringify(value));
function nodes(value, type) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, type));
  return [...(value.type === type ? [value] : []), ...Object.values(value.props ?? {}).flatMap((item) => nodes(item, type))];
}
let pageExecutions = 0, deniedExecutions = 0, effects = 0;
async function render({ role = "manager", garden = gardenId, data = fixtures, failures = {}, empty = false, nullData = false, loader = false, deny = false, builder = -1 } = {}) {
  pageExecutions++;
  let clients = 0, captured;
  const chains = [], warnings = [], readinessCalls = [];
  const no = (name) => { effects++; throw Error(`FORBIDDEN_EFFECT_OR_IMPORT:${name}`); };
  const context = { fetch: no, FormData: no, process: new Proxy({}, { get: no }), console: { warn: (...args) => warnings.push(args), error: no } };
  const actualHelper = {}, pure = {}, exports = {};
  vm.runInNewContext(helperCode, { ...context, exports: actualHelper, require: no });
  vm.runInNewContext(pureCode, { ...context, exports: pure, require: no });
  const helper = { ...actualHelper, safeAdminData: async (...args) => { captured = await actualHelper.safeAdminData(...args); return captured; } };
  const domain = { observerNetworkTone: pure.observerNetworkTone, buildObserverReadinessScore: (input) => { readinessCalls.push(plain(input)); return pure.buildObserverReadinessScore(input); } };
  const client = { from(table) {
    const index = chains.length, calls = [], query = {}; chains.push([table, calls]);
    if (index === builder) throw Error("PRIVATE_BUILDER_MARKER");
    for (const method of ["select", "eq", "in", "order", "or", "limit"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => failures[index] === "reject"
      ? Promise.reject(Error("PRIVATE_REJECTION_MARKER")).then(resolve, reject)
      : Promise.resolve({ data: nullData ? null : empty ? [] : data[index], error: failures[index] ? { message: "PRIVATE_QUERY_MARKER", details: "PRIVATE_TENANT_MARKER" } : null }).then(resolve, reject);
    return query;
  } };
  vm.runInNewContext(pageCode, { ...context, exports, require: (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/domain/observer-network") return domain;
    if (id === "@/lib/auth") return { requireRole: async (roles) => {
      assert.deepEqual(Array.from(roles), ["manager", "owner"]);
      assert.equal(clients + chains.length + warnings.length + readinessCalls.length, 0);
      if (deny) throw Error("GARDEN_NETWORK_ADMISSION_DENIED");
      return { profile: { role, garden_id: garden, full_name: "[DEMO] Synthetic Owner", profile_image_url: "SYN_AVATAR_ONLY" } };
    } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_CLIENT_MARKER"); return client; } };
    if (["lucide-react", "@/components/dashboard-shell", "@/components/admin-data-state", "@/components/teacher-app-ui"].includes(id)) return new Proxy({}, { get: (_, name) => String(name) });
    return no(id);
  } });
  if (deny) {
    await assert.rejects(exports.default(), /GARDEN_NETWORK_ADMISSION_DENIED/); deniedExecutions++;
    assert.equal(clients + chains.length + warnings.length + readinessCalls.length, 0); return;
  }
  const tree = await exports.default(); assert.equal(effects, 0);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_"));
  return { tree, clients, chains, warnings, readinessCalls, data: captured.data, stats: nodes(tree, "TeacherStatCard").map((item) => item.props), banner: nodes(tree, "AdminDataError")[0].props.message };
}
function items(result, title) {
  const section = nodes(result.tree, "TeacherSection").find((item) => item.props.title === title);
  assert.ok(section, title); return nodes(section, "TeacherCompactItem");
}
function emptyTitles(result) { return nodes(result.tree, "TeacherEmptyState").map((item) => item.props.title); }
function contracts(result) {
  assert.equal(result.clients, 1); assert.deepEqual(plain(result.chains), expected);
  assert.deepEqual(nodes(result.tree, "TeacherActionTile").map((item) => item.props.href), ["/dashboard/garden/camera-health", "/dashboard/garden/observer-intelligence", "/dashboard/garden/compliance"]);
  assert.equal(nodes(result.tree, "Link")[0].props.href, "/dashboard/garden/observer-intelligence");
}
function unavailable(result, failed) {
  assert.ok(result.banner);
  const sourceForStat = [0, 2, 3, 1], values = [10, "2/5", 2, 8];
  for (let i = 0; i < 4; i++) {
    assert.equal(result.stats[i].value, failed.includes(sourceForStat[i]) ? "לא זמין" : values[i]);
    assert.equal(result.stats[i].tone, failed.includes(sourceForStat[i]) ? "neutral" : "orange");
  }
  assert.equal(result.stats[1].hint, failed.includes(2) ? "לא זמין" : "3 דורשות טיפול");
  for (const [index, title, healthyEmpty, unavailableTitle, cap] of [[0, "נושאים לטיפול", "אין נושאים פתוחים", "נתוני הנושאים אינם זמינים כרגע", 8], [1, "המלצות", "אין המלצות פתוחות", "נתוני ההמלצות אינם זמינים כרגע", 6]]) {
    assert.equal(items(result, title).length, failed.includes(index) ? 0 : cap);
    assert.equal(emptyTitles(result).includes(unavailableTitle), failed.includes(index));
    assert.ok(!emptyTitles(result).includes(healthyEmpty));
  }
  for (const [i, name] of [[0, "signals"], [1, "recommendations"], [2, "cameras"], [3, "compliance"]]) if (failed.includes(i)) assert.equal(result.data[name].length, 0);
  const inputFailed = [0, 2, 3].some((i) => failed.includes(i));
  assert.equal(result.readinessCalls.length, inputFailed ? 0 : 1);
  if (inputFailed) assert.equal(result.data.readiness, null); else assert.equal(result.data.readiness.readinessScore, 52);
}
const cases = [
  ["garden-network-healthy-manager-four-exact-chains-and-bounded-items", async () => {
    const result = await render(); contracts(result); assert.equal(result.banner, null);
    assert.deepEqual(result.stats.map((item) => item.value), [10, "2/5", 2, 8]);
    assert.deepEqual(items(result, "נושאים לטיפול").map((item) => item.key), fixtures[0].slice(0, 8).map((row) => row.id));
    assert.deepEqual(items(result, "המלצות").map((item) => item.key), fixtures[1].slice(0, 6).map((row) => row.id));
    assert.equal(items(result, "נושאים לטיפול")[0].props.title, "מצלמה דורשת בדיקה"); assert.equal(items(result, "נושאים לטיפול")[1].props.title, "פער ציות");
    assert.equal(items(result, "המלצות")[0].props.title, fixtures[1][0].recommendation_text);
    assert.equal(result.data.readiness.readinessScore, 52); assert.equal(result.readinessCalls.length, 1);
    assert.equal(nodes(result.tree, "DashboardShell")[0].props.role, "manager");
  }],
  ["garden-network-owner-camera-active-and-nullish-precedence", async () => {
    const data = structuredClone(fixtures);
    data[2] = [{ status: "online", health_status: "failed", active: true }, { stream_status: "error" }, { health_status: "unhealthy" }, { status: "pending_gateway" }, { status: "healthy", active: false }, { status: "healthy", active: true }];
    const result = await render({ role: "owner", data }); contracts(result);
    assert.equal(nodes(result.tree, "DashboardShell")[0].props.role, "owner");
    assert.equal(result.stats[1].value, "2/6"); assert.equal(result.stats[1].hint, "4 דורשות טיפול");
    assert.equal(result.readinessCalls[0].activeCameras, 5); assert.equal(result.readinessCalls[0].unhealthyCameras, 4);
    const frame = nodes(result.tree, "TeacherAppFrame")[0].props; assert.equal(frame.active, "more"); assert.equal(frame.avatarUrl, "SYN_AVATAR_ONLY");
  }],
  ["garden-network-healthy-empty-distinct-from-failure", async () => {
    const result = await render({ empty: true }); contracts(result); assert.equal(result.banner, null);
    assert.deepEqual(result.stats.map((item) => item.value), [0, "0/0", 0, 0]); assert.ok(result.stats.every((item) => item.tone === "green"));
    assert.deepEqual(emptyTitles(result), ["אין נושאים פתוחים", "אין המלצות פתוחות"]); assert.equal(result.readinessCalls.length, 1);
  }],
  ["garden-network-healthy-null-preserves-legitimate-empty", async () => {
    const result = await render({ nullData: true }); contracts(result); assert.equal(result.banner, null);
    assert.deepEqual(result.stats.map((item) => item.value), [0, "0/0", 0, 0]); assert.equal(result.data.readiness.readinessScore, 69);
  }],
  ...tables.map((table, index) => [`garden-network-returned-${table}-stale-unavailable`, async () => {
    const result = await render({ failures: { [index]: "returned" } }); contracts(result); unavailable(result, [index]); assert.equal(result.warnings.length, 1);
  }]),
  ["garden-network-camera-rejection-retains-independent-items", async () => {
    const result = await render({ failures: { 2: "reject" } }); contracts(result); unavailable(result, [2]);
  }],
  ["garden-network-compliance-builder-throw-fails-only-own-source", async () => {
    const result = await render({ builder: 3 }); unavailable(result, [3]);
    assert.deepEqual(plain(result.chains.slice(0, 3)), expected.slice(0, 3)); assert.equal(result.chains[3][1].length, 0);
  }],
  ["garden-network-mixed-failed-items-retain-camera-compliance", async () => {
    const result = await render({ failures: { 0: "returned", 1: "reject" } }); contracts(result); unavailable(result, [0, 1]);
  }],
  ["garden-network-recommendation-rejection-does-not-invalidate-readiness-inputs", async () => {
    const result = await render({ failures: { 1: "reject" } }); contracts(result); unavailable(result, [1]);
    assert.deepEqual(result.readinessCalls[0], { totalCameras: 5, activeCameras: 4, unhealthyCameras: 3, totalSignals: 10, reviewedSignals: 0, falsePositiveSignals: 0, unresolvedSignals: 10, complianceSignals: 2 });
  }],
  ["garden-network-missing-garden-no-client-or-blank-scope-queries", async () => {
    for (const garden of [null, ""]) { const result = await render({ garden }); assert.equal(result.clients, 0); assert.equal(result.chains.length, 0); unavailable(result, [0, 1, 2, 3]); }
  }],
  ["garden-network-denied-admission-never-caught-or-rendered", async () => { await render({ deny: true }); }],
  ["garden-network-client-throw-safe-unavailable-not-zero-green", async () => {
    const result = await render({ loader: true }); assert.equal(result.clients, 1); assert.equal(result.chains.length, 0); unavailable(result, [0, 1, 2, 3]); assert.equal(result.warnings.length, 1);
  }],
  ["garden-network-all-stale-errors-hide-action-rows-and-confident-score", async () => {
    const result = await render({ failures: { 0: "returned", 1: "returned", 2: "returned", 3: "returned" } }); contracts(result); unavailable(result, [0, 1, 2, 3]); assert.equal(result.warnings.length, 4);
  }]
];
assert.equal(cases.length, 16); const ids = cases.map(([id]) => id); assert.equal(new Set(ids).size, 16);
console.log("CASE_REGISTRY " + JSON.stringify(ids)); for (const [id, run] of cases) test(id, run);
after(() => { console.log("GARDEN_NETWORK_OBSERVATIONS " + JSON.stringify({ pageExecutions, deniedExecutions, effects, selectedPureDeclarations: selected, wholeDomainEvaluated: false, sharedChildren: "OPAQUE", liveAuthOrDatabase: false })); assert.equal(effects, 0); });
