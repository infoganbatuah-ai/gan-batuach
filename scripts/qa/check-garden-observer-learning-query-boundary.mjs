import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page and safe helper. SDK/Auth/JSX fixtures only; editable children opaque.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) {
  const file = path.join(root, relative); assert.equal((fs.statSync(file).flags ?? 0) & 0x40000000, 0);
  return fs.readFileSync(file, "utf8");
}
function compile(text) {
  const result = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(result.diagnostics.length, 0); return result.outputText;
}
const pageCode = compile(source("app/dashboard/garden/observer-learning/page.tsx")), helperCode = compile(source("lib/admin-safe.ts"));
const gardenId = "SYN_LEARNING_GARDEN";
const tables = ["kindergarten_learning_profiles", "kindergarten_routine_configs", "camera_zones", "kindergarten_learning_signals", "kindergarten_risk_profiles", "site_behavior_baselines", "camera_learning_profiles", "zone_learning_profiles", "learning_feedback_signals"];
const single = new Set([0, 1, 4]);
const counts = [1, 1, 2, 3, 1, 4, 1, 2, 3];
const fixtures = tables.map((table, index) => single.has(index) ? { id: `SYN_SINGLE_${index}`, kindergarten_id: gardenId, label: `SYN_${table}` } : Array.from({ length: counts[index] }, (_, i) => ({ id: `SYN_ROW_${index}_${i}`, kindergarten_id: gardenId, label: `SYN_${table}_${i}` })));
const expected = tables.map((table, index) => {
  const select = index === 2 || index === 6 ? "*, camera_streams(name)" : index === 7 ? "*, camera_zones(name, zone_type)" : "*";
  const calls = [["select", select], ["eq", "kindergarten_id", gardenId]];
  if (single.has(index)) calls.push(["maybeSingle"]);
  else { calls.push(["order", index >= 5 && index <= 7 ? "updated_at" : "created_at", { ascending: false }]); calls.push(["limit", index === 3 ? 80 : 100]); }
  return [table, calls];
});
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (value) => JSON.parse(JSON.stringify(value));
function nodes(value, type) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, type));
  return [...(value.type === type ? [value] : []), ...Object.values(value.props ?? {}).flatMap((item) => nodes(item, type))];
}
let pageExecutions = 0, deniedExecutions = 0, effects = 0;
async function render({ role = "manager", garden = gardenId, empty = false, nullData = false, failures = {}, deny = false, loader = false, builder = -1 } = {}) {
  pageExecutions++; let clients = 0, captured; const chains = [], warnings = [];
  const no = (name) => { effects++; throw Error(`FORBIDDEN_IMPORT_OR_EFFECT:${name}`); };
  const context = { fetch: no, FormData: no, process: new Proxy({}, { get: no }), console: { warn: (...args) => warnings.push(args), error: no } };
  const actualHelper = {}, exports = {};
  vm.runInNewContext(helperCode, { ...context, exports: actualHelper, require: no });
  const helper = { ...actualHelper, safeAdminData: async (...args) => { captured = await actualHelper.safeAdminData(...args); return captured; } };
  const client = { from(table) {
    const index = chains.length, calls = [], query = {}; chains.push([table, calls]);
    if (index === builder) throw Error("PRIVATE_BUILDER_MARKER");
    for (const method of ["select", "eq", "order", "limit", "maybeSingle"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => failures[index] === "reject"
      ? Promise.reject(Error("PRIVATE_REJECTION_MARKER")).then(resolve, reject)
      : Promise.resolve({ data: nullData ? null : empty ? single.has(index) ? null : [] : fixtures[index], error: failures[index] ? { message: "PRIVATE_ERROR_MARKER", details: "PRIVATE_TENANT_MARKER" } : null }).then(resolve, reject);
    return query;
  } };
  vm.runInNewContext(pageCode, { ...context, exports, require: (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => {
      assert.deepEqual(Array.from(roles), ["manager", "owner"]); assert.equal(clients + chains.length + warnings.length, 0);
      if (deny) throw Error("GARDEN_LEARNING_ADMISSION_DENIED");
      return { profile: { role, garden_id: garden, full_name: "[DEMO] Synthetic Owner", profile_image_url: "SYN_AVATAR_METADATA" } };
    } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_CLIENT_MARKER"); return client; } };
    if (["lucide-react", "@/components/teacher-app-ui", "@/components/observer-learning-dashboard", "@/components/advanced-learning-dashboard"].includes(id)) return new Proxy({}, { get: (_, name) => String(name) });
    return no(id);
  } });
  if (deny) { await assert.rejects(exports.default(), /GARDEN_LEARNING_ADMISSION_DENIED/); deniedExecutions++; assert.equal(clients + chains.length + warnings.length, 0); return; }
  const tree = await exports.default(); assert.equal(effects, 0); assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_"));
  return { tree, clients, chains, warnings, data: captured.data, stats: nodes(tree, "TeacherStatCard").map((item) => item.props), basic: nodes(tree, "ObserverLearningDashboard"), advanced: nodes(tree, "AdvancedLearningDashboard") };
}
function basicProps() { return { role: "garden", kindergartenId: gardenId, learningProfile: fixtures[0], routine: fixtures[1], zones: fixtures[2], signals: fixtures[3], riskProfile: fixtures[4] }; }
function advancedProps() { return { role: "garden", kindergartenId: gardenId, learningProfiles: [fixtures[0]], baselines: fixtures[5], cameraProfiles: fixtures[6], zoneProfiles: fixtures[7], feedbackSignals: fixtures[8] }; }
function contracts(result) {
  assert.equal(result.clients, 1); assert.deepEqual(plain(result.chains), expected);
  assert.deepEqual(nodes(result.tree, "TeacherActionTile").map((item) => item.props.href), ["/dashboard/garden/cameras", "/dashboard/garden/correlated-events", "/dashboard/garden/insights"]);
  assert.deepEqual(nodes(result.tree, "TeacherSection").map((item) => item.props.title), ["למידה בסיסית", "למידה מתקדמת"]);
  const frame = nodes(result.tree, "TeacherAppFrame")[0].props;
  assert.equal(frame.title, "בוקר טוב, Synthetic"); assert.equal(frame.avatarUrl, "SYN_AVATAR_METADATA"); assert.equal(frame.active, "more"); assert.ok(!("role" in frame));
  assert.ok(nodes(result.tree, "TeacherPageTitle")[0].props.subtitle.includes("אין פרופיל ילדים ואין החלטות אוטומטיות"));
}
function masks(result, failed) {
  const basicOK = ![0, 1, 2, 3, 4].some((i) => failed.includes(i)), advancedOK = ![0, 5, 6, 7, 8].some((i) => failed.includes(i));
  assert.equal(result.basic.length, basicOK ? 1 : 0); assert.equal(result.advanced.length, advancedOK ? 1 : 0);
  const emptyTitles = nodes(result.tree, "TeacherEmptyState").map((item) => item.props.title);
  assert.equal(emptyTitles.includes("הלמידה הבסיסית אינה זמינה כרגע"), !basicOK);
  assert.equal(emptyTitles.includes("הלמידה המתקדמת אינה זמינה כרגע"), !advancedOK);
  if (basicOK) assert.deepEqual(plain(result.basic[0].props), basicProps());
  if (advancedOK) assert.deepEqual(plain(result.advanced[0].props), advancedProps());
  for (const [position, index, count, tone] of [[0, 2, 2, "blue"], [1, 3, 3, "purple"], [2, 5, 4, "green"]]) {
    assert.equal(result.stats[position].value, failed.includes(index) ? "לא זמין" : count);
    assert.equal(result.stats[position].tone, failed.includes(index) ? "neutral" : tone);
  }
  for (const [index, name] of [[0, "learningProfile"], [1, "routine"], [2, "zones"], [3, "signals"], [4, "riskProfile"], [5, "baselines"], [6, "cameraProfiles"], [7, "zoneProfiles"], [8, "feedbackSignals"]]) if (failed.includes(index)) {
    if (single.has(index)) assert.equal(result.data[name], null); else assert.equal(result.data[name].length, 0);
  }
}
const cases = [
  ["garden-learning-healthy-manager-exact-nine-chains-and-two-payloads", async () => { const result = await render(); contracts(result); masks(result, []); assert.equal(result.warnings.length, 0); }],
  ["garden-learning-healthy-owner-keeps-existing-frame-and-garden-binding", async () => { const result = await render({ role: "owner" }); contracts(result); masks(result, []); }],
  ["garden-learning-healthy-empty-is-zero-with-both-panels", async () => {
    const result = await render({ empty: true }); contracts(result); assert.deepEqual(result.stats.map((item) => item.value), [0, 0, 0]); assert.deepEqual(result.stats.map((item) => item.tone), ["blue", "purple", "green"]);
    assert.equal(result.basic.length, 1); assert.equal(result.advanced.length, 1); assert.equal(result.basic[0].props.learningProfile, null); assert.equal(result.basic[0].props.routine, null); assert.equal(result.basic[0].props.riskProfile, null); assert.equal(result.advanced[0].props.learningProfiles.length, 0);
  }],
  ["garden-learning-healthy-null-preserves-single-and-array-contracts", async () => {
    const result = await render({ nullData: true }); contracts(result); assert.deepEqual(result.stats.map((item) => item.value), [0, 0, 0]);
    assert.equal(result.basic.length, 1); assert.equal(result.advanced.length, 1); assert.equal(result.basic[0].props.kindergartenId, gardenId); assert.equal(result.basic[0].props.zones.length, 0); assert.equal(result.advanced[0].props.baselines.length, 0);
  }],
  ...tables.map((table, index) => [`garden-learning-returned-${table}-stale-dependency-mask`, async () => {
    const result = await render({ failures: { [index]: "returned" } }); contracts(result); masks(result, [index]); assert.equal(result.warnings.length, 1);
  }]),
  ["garden-learning-missing-null-or-empty-context-no-client-query-panels", async () => {
    for (const garden of [null, ""]) { const result = await render({ garden }); assert.equal(result.clients, 0); assert.equal(result.chains.length, 0); masks(result, tables.map((_, i) => i)); }
  }],
  ["garden-learning-denied-admission-not-caught-or-rendered", async () => { await render({ deny: true }); }],
  ["garden-learning-client-throw-unavailable-after-admission", async () => { const result = await render({ loader: true }); assert.equal(result.clients, 1); assert.equal(result.chains.length, 0); masks(result, tables.map((_, i) => i)); assert.equal(result.warnings.length, 1); }],
  ["garden-learning-rejected-shared-profile-gates-both-not-independent-metrics", async () => { const result = await render({ failures: { 0: "reject" } }); contracts(result); masks(result, [0]); }],
  ["garden-learning-rejected-routine-preserves-advanced-payload", async () => { const result = await render({ failures: { 1: "reject" } }); contracts(result); masks(result, [1]); }],
  ["garden-learning-camera-profile-builder-throw-preserves-basic", async () => {
    const result = await render({ builder: 6 }); masks(result, [6]); assert.equal(result.chains.length, 9); assert.equal(result.chains[6][1].length, 0); assert.deepEqual(plain(result.chains.filter((_, i) => i !== 6)), expected.filter((_, i) => i !== 6));
  }],
  ["garden-learning-paired-zone-baseline-failure-hides-both-keeps-signals", async () => { const result = await render({ failures: { 2: "returned", 5: "reject" } }); contracts(result); masks(result, [2, 5]); }],
  ["garden-learning-advanced-only-failures-preserve-entire-basic", async () => { const result = await render({ failures: { 5: "returned", 6: "reject", 7: "returned", 8: "reject" } }); contracts(result); masks(result, [5, 6, 7, 8]); }],
  ["garden-learning-all-stale-errors-not-green-empty-or-editable", async () => { const failed = tables.map((_, i) => i); const result = await render({ failures: Object.fromEntries(failed.map((i) => [i, "returned"])) }); contracts(result); masks(result, failed); assert.equal(result.warnings.length, 9); }]
];
assert.equal(cases.length, 22); const ids = cases.map(([id]) => id); assert.equal(new Set(ids).size, 22);
console.log("CASE_REGISTRY " + JSON.stringify(ids)); for (const [id, run] of cases) test(id, run);
after(() => { console.log("GARDEN_LEARNING_OBSERVATIONS " + JSON.stringify({ pageExecutions, deniedExecutions, effects, childComponents: "OPAQUE", wholeDomainModulesEvaluated: 0, liveAuthOrDatabase: false })); assert.equal(effects, 0); });
