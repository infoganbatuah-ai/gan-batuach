import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";

// Synthetic actual-page/helper/panel checks only. No Git history, live client or actions.
const root = new URL("../../", import.meta.url);
const require = createRequire(new URL("package.json", root));
const ts = require("typescript");
const read = path => readFileSync(new URL(path, root), "utf8");
const pageSource = read("app/dashboard/admin/ai-observer/page.tsx");
const panelSource = read("components/ai-observer-worker-dashboard.tsx");
const safeSource = read("lib/admin-safe.ts");
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
let fetchCalls = 0;
const forbidden = () => { fetchCalls += 1; throw new Error("SYNTHETIC_FETCH_FORBIDDEN"); };
const fixedNow = "2026-11-04T12:34:56.000Z";
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
}
function load(source, imports, warnings = []) {
  const compiled = ts.transpileModule(source, { reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(compiled.diagnostics?.length ?? 0, 0);
  const exports = {};
  vm.runInNewContext(compiled.outputText, { exports, require: imports, fetch: forbidden,
    console: { warn: (...args) => warnings.push(args) }, Date: FixedDate, Intl,
    process: { env: { AI_GATEWAY_URL: "", VIDEO_GATEWAY_URL: "" } } });
  return exports;
}
const normal = value => JSON.parse(JSON.stringify(value));
const fixtures = [
  [{ id: "worker-1", name: "WORKER_ROW", worker_type: "mock", status: "idle" }],
  [{ id: "job-1", job_type: "JOB_ROW", status: "queued" }, { id: "job-2", job_type: "FAILED_JOB_ROW", status: "failed" }],
  [{ id: "log-1", message: "LOG_ROW analyzer", level: "error", created_at: fixedNow }],
  [{ id: "rule-1", rule_key: "RULE_ROW", enabled: true, threshold: 0.5 }],
  [{ id: "zone-1", name: "ZONE_ROW", zone_type: "test" }],
  [{ id: "garden-1", name: "GARDEN_ROW" }, { id: "garden-2", name: "SECOND_GARDEN" }],
  [{ id: "camera-1", name: "CAMERA_ROW", garden_id: "garden-1" }, { id: "camera-2", name: "SECOND_CAMERA", garden_id: "garden-2" }],
  [{ id: "event-1", event_type: "EVENT_ROW", confidence_score: 0.9, review_outcome: "valid_detection", detector_provider: "SYNTHETIC_PROVIDER", detector_mode: "local_shadow", created_at: fixedNow },
    { id: "event-2", event_type: "EVENT_ROW", confidence_score: 0.3, review_outcome: "false_positive" },
    { id: "event-3", event_type: "OTHER_EVENT", confidence_score: 0.6, review_outcome: "needs_more_data" }]
];
const contracts = [
  ["observer_workers", [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 20]]],
  ["observer_jobs", [["select", "*, gardens(name), camera_streams(name)"], ["order", "created_at", { ascending: false }], ["limit", 50]]],
  ["observer_job_logs", [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 50]]],
  ["observer_rules", [["select", "*"], ["order", "priority", { ascending: false }], ["limit", 100]]],
  ["camera_zones", [["select", "*, camera_streams(name)"], ["order", "created_at", { ascending: false }], ["limit", 100]]],
  ["gardens", [["select", "id, name"], ["order", "name"], ["limit", 200]]],
  ["camera_streams", [["select", "id, name, garden_id"], ["order", "name"], ["limit", 300]]],
  ["ai_camera_events", [["select", "id, event_type, severity, confidence_score, review_outcome, detector_provider, detector_mode, camera_id, kindergarten_id, metadata, created_at"], ["eq", "shadow_mode", true], ["gte", "created_at", (() => { const day = new Date(fixedNow); day.setHours(0, 0, 0, 0); return day.toISOString(); })()], ["order", "created_at", { ascending: false }], ["limit", 200]]]
];
async function page({ errors = [], rejected = [], missing = false, empty = [], data = fixtures, loader = false, deny = false } = {}) {
  let clients = 0;
  const calls = [], warnings = [];
  const safe = load(safeSource, forbidden, warnings);
  const client = { from(table) {
    const index = calls.length, methods = [];
    assert.equal(table, contracts[index]?.[0]); calls.push([table, methods]);
    const chain = {};
    for (const method of ["select", "order", "limit", "eq", "gte"]) chain[method] = (...args) => { methods.push([method, ...args]); return chain; };
    chain.then = (resolve, reject) => rejected.includes(index)
      ? Promise.reject(new Error("PRIVATE_REJECTION_SENTINEL")).then(resolve, reject)
      : Promise.resolve({ data: empty.includes(index) ? [] : errors.includes(index) && missing ? null : data[index], error: errors.includes(index) ? { message: "PRIVATE_ERROR_SENTINEL" } : null }).then(resolve, reject);
    return chain;
  } };
  const module = load(pageSource, id => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "node:crypto") return require(id);
    if (id === "@/lib/admin-safe") return safe;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(calls.length, 0); if (deny) throw new Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients += 1; if (loader) throw new Error("PRIVATE_LOADER_SENTINEL"); return client; } };
    if (id.startsWith("@/components/")) return new Proxy({}, { get: (_, key) => String(key) });
    throw new Error(`Unexpected page import ${id}`);
  }, warnings);
  if (deny) { await assert.rejects(module.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls.length, 0); return; }
  const tree = await module.default();
  assert.equal(clients, 1); assert.equal(calls.length, loader ? 0 : 8);
  if (!loader) assert.deepEqual(normal(calls), contracts);
  assert.ok(!JSON.stringify(warnings).includes("SENTINEL"));
  return { tree, warnings };
}
function nodes(tree, type) {
  if (tree == null || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(child => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...Object.values(tree.props ?? {}).flatMap(child => nodes(child, type))];
}
function text(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree).trim();
  if (Array.isArray(tree)) return tree.map(text).join("");
  return text(tree.props?.children);
}
const panelElement = result => nodes(result.tree, "AiObserverWorkerDashboard")[0];
function panelHarness() {
  let states = [], cursor = 0, currentKey;
  const module = load(panelSource, id => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "react") return { useState(initial) { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }]; } };
    throw new Error(`Unexpected panel import ${id}`);
  });
  return {
    render(result) { const element = panelElement(result); if (element.key !== currentKey) { states = []; currentKey = element.key; } cursor = 0; return module.AiObserverWorkerDashboard(element.props); },
    get states() { return states; }
  };
}
const renderPanel = result => panelHarness().render(result);
function metrics(tree) { return Object.fromEntries(nodes(tree, "article").filter(n => n.props.className === "card metric-card").map(n => [text(nodes(n, "span")[0]), text(nodes(n, "strong")[0])])); }
const banner = result => nodes(result.tree, "AdminDataError")[0].props.message;
const mockButton = tree => nodes(tree, "button").find(n => text(n) === "הרצת mock job");
const all = n => Array.from({ length: n }, (_, i) => i);
async function assertFailure(index, options) {
  const result = await page(options), element = panelElement(result), tree = renderPanel(result), values = metrics(tree);
  assert.ok(banner(result));
  const names = ["workers", "jobs", "logs", "rules", "zones", "gardens", "cameras", "shadowEvents"];
  assert.equal(element.props[names[index]].length, 0, "failed-source stale rows discarded");
  assert.equal(values.Workers, index === 0 ? "לא זמין" : "1");
  assert.equal(values["Queued / Running"], index === 1 ? "לא זמין" : "1");
  assert.equal(values.Failed, index === 1 ? "לא זמין" : "1");
  assert.equal(values["Camera zones"], index === 4 ? "לא זמין" : "1");
  assert.equal(values["Failed analyzer calls"], index === 2 ? "לא זמין" : "1");
  assert.equal(values["Shadow detections today"], index === 7 ? "לא זמין" : "3");
  assert.equal(values["False positive rate"], index === 7 ? "לא זמין" : "33%");
  assert.equal(values["Valid detection rate"], index === 7 ? "לא זמין" : "33%");
  assert.equal(values["Avg confidence"], index === 7 ? "לא זמין" : "0.60");
  assert.equal(values.Detector, index === 7 ? "לא זמין" : "SYNTHETIC_PROVIDER");
  assert.equal(values["Detector mode"], index === 7 ? "לא זמין" : "local_shadow");
  if (index === 7) { assert.equal(values["Last detection run"], "לא זמין"); assert.ok(!text(tree).includes("EVENT_ROW")); assert.ok(text(tree).includes("נתוני איכות הזיהויים לא זמינים")); }
  const expectedDisabled = [3, 5, 6].includes(index);
  assert.equal(mockButton(tree).props.disabled, expectedDisabled);
  for (const select of nodes(tree, "select")) assert.equal(select.props.disabled, expectedDisabled);
  if (index === 1) assert.ok(!nodes(tree, "button").some(n => text(n) === "Retry"));
  if (index === 3) assert.ok(!text(tree).includes("RULE_ROW"));
}
for (const index of all(8)) {
  test(`source ${index} returned error suppresses stale data independently`, () => assertFailure(index, { errors: [index] }));
  test(`source ${index} missing error data is unavailable`, () => assertFailure(index, { errors: [index], missing: true }));
  test(`source ${index} rejection preserves independent sources`, () => assertFailure(index, { rejected: [index] }));
}
test("healthy nonempty queries, formulas and architecture configuration indicators remain intact", async () => {
  const result = await page(), tree = renderPanel(result), values = metrics(tree);
  assert.equal(banner(result), null); assert.equal(values["Shadow detections today"], "3"); assert.equal(values["False positive rate"], "33%"); assert.equal(values["Valid detection rate"], "33%"); assert.equal(values["Avg confidence"], "0.60");
  assert.equal(mockButton(tree).props.disabled, false);
  assert.deepEqual(normal(nodes(result.tree, "DigitalObserverArchitecture")[0].props), { aiConnected: false, videoConnected: false });
  assert.ok(text(result.tree).includes("local_mock shadow")); assert.ok(text(tree).includes("Mock worker only"));
});
test("healthy empty counts are zero, rates unmeasured, automatic selections valid", async () => {
  const result = await page({ empty: all(8) }), tree = renderPanel(result), values = metrics(tree);
  assert.equal(banner(result), null);
  for (const name of ["Workers", "Queued / Running", "Failed", "Camera zones", "Shadow detections today", "Failed analyzer calls"]) assert.equal(values[name], "0");
  assert.equal(values["False positive rate"], "טרם נמדד"); assert.equal(values["Valid detection rate"], "טרם נמדד");
  assert.equal(mockButton(tree).props.disabled, false); assert.equal(nodes(tree, "select")[0].props.value, "");
});
test("nonempty detections without reviews have no measured quality rate", async () => {
  const data = structuredClone(fixtures); for (const e of data[7]) e.review_outcome = "pending";
  const values = metrics(renderPanel(await page({ data })));
  assert.equal(values["False positive rate"], "טרם נמדד"); assert.equal(values["Valid detection rate"], "טרם נמדד"); assert.equal(values["Shadow detections today"], "3");
});
test("paired failures and loader fallback do not manufacture healthy values", async () => {
  const paired = await page({ errors: [1, 7] }); const values = metrics(renderPanel(paired));
  assert.equal(values.Failed, "לא זמין"); assert.equal(values["Shadow detections today"], "לא זמין"); assert.equal(values.Workers, "1");
  const result = await page({ loader: true }), tree = renderPanel(result);
  assert.ok(banner(result)); for (const value of Object.values(metrics(tree))) assert.equal(value, "לא זמין");
  assert.equal(mockButton(tree).props.disabled, true); assert.ok(!JSON.stringify(result.tree).includes("SENTINEL"));
});
test("admin denial prevents client creation and every query", async () => { await page({ deny: true }); });
test("unchanged state-bearing payload preserves optimistic rows and selection on unrelated refresh", async () => {
  const first = await page(), harness = panelHarness(); harness.render(first);
  harness.states[0] = [{ id: "optimistic-job", job_type: "OPTIMISTIC_JOB", status: "queued" }];
  harness.states[1] = [{ id: "optimistic-rule", rule_key: "OPTIMISTIC_RULE" }]; harness.states[5] = "garden-2";
  for (const index of [0, 2, 4, 7]) {
    const data = structuredClone(fixtures); data[index] = []; const result = await page({ data });
    assert.equal(panelElement(result).key, panelElement(first).key); harness.render(result);
    assert.equal(harness.states[0][0].id, "optimistic-job"); assert.equal(harness.states[1][0].id, "optimistic-rule"); assert.equal(harness.states[5], "garden-2");
    const failed = await page({ errors: [index] }); assert.equal(panelElement(failed).key, panelElement(first).key); harness.render(failed); assert.equal(harness.states[0][0].id, "optimistic-job");
  }
  assert.equal(panelElement(await page()).key, panelElement(first).key);
});
test("same-ID job/rule/destination changes and removal reset actionable state", async () => {
  const initial = await page();
  for (const index of [1, 3, 5, 6]) {
    const harness = panelHarness(); harness.render(initial); harness.states[0] = [{ id: "stale" }]; harness.states[5] = "garden-2";
    const data = structuredClone(fixtures); data[index][0] = { ...data[index][0], ...(index === 1 ? { status: "completed" } : index === 3 ? { enabled: false } : index === 5 ? { name: "UPDATED_GARDEN" } : { garden_id: "garden-2" }) };
    const updated = await page({ data }); assert.notEqual(panelElement(updated).key, panelElement(initial).key); harness.render(updated); assert.equal(harness.states[0][0].id, "job-1");
    if (index === 1) assert.equal(harness.states[0][0].status, "completed");
    if (index === 3) assert.equal(harness.states[1][0].enabled, false);
    const removed = structuredClone(fixtures); removed[index] = []; const gone = await page({ data: removed }); assert.notEqual(panelElement(gone).key, panelElement(initial).key); harness.render(gone);
    if (index === 1) assert.equal(harness.states[0].length, 0);
    if (index === 3) assert.equal(harness.states[1].length, 0);
    if (index === 5) assert.equal(harness.states[5], "");
    if (index === 6) assert.equal(panelElement(gone).props.cameras.length, 0);
  }
  const removedGarden = structuredClone(fixtures); removedGarden[5].shift(); const tree = panelHarness().render(await page({ data: removedGarden }));
  assert.equal(nodes(tree, "select")[0].props.value, "garden-2"); assert.ok(!nodes(tree, "option").some(n => n.props.value === "camera-1"));
});
test("healthy-empty versus failed-empty availability resets previously optimistic state", async () => {
  const first = await page({ empty: [1, 3, 5, 6] });
  for (const index of [1, 3, 5, 6]) {
    const harness = panelHarness(); harness.render(first); harness.states[0] = [{ id: "optimistic" }]; harness.states[1] = [{ id: "rule-optimistic" }]; harness.states[5] = "stale-garden";
    const failed = await page({ empty: [1, 3, 5, 6], errors: [index] }); assert.notEqual(panelElement(failed).key, panelElement(first).key); harness.render(failed);
    assert.equal(harness.states[0].length, 0); assert.equal(harness.states[1].length, 0); assert.equal(harness.states[5], "");
    const healthy = await page({ empty: [1, 3, 5, 6] }); assert.equal(panelElement(healthy).key, panelElement(first).key); harness.render(healthy); assert.equal(harness.states[0].length, 0);
  }
});
test("unavailable mock options guard submission without reading form or invoking any action", async () => {
  for (const index of [3, 5, 6]) {
    const tree = renderPanel(await page({ errors: [index] }));
    await nodes(tree, "form")[0].props.action({ get() { throw new Error("UNAVAILABLE_FORM_READ"); } });
  }
  assert.equal(fetchCalls, 0);
});
test("portable action/registration contracts retain endpoints and add exactly one hook", () => {
  assert.match(panelSource, /if \(!mockAvailable\) return;/);
  assert.match(panelSource, /async function retry\(job: Row\) \{\s+if \(failures\[1\]\) return;/);
  assert.match(panelSource, /async function toggleRule\(rule: Row\) \{\s+if \(failures\[3\]\) return;/);
  for (const contract of ['"/api/admin/ai-observer/run-mock-job"', '`/api/admin/ai-observer/rules/${rule.id}/toggle`', 'action: "retry", job_id: job.id', 'enabled: !rule.enabled', 'href="/dashboard/admin/ai-events"']) assert.ok(panelSource.includes(contract));
  const config = JSON.parse(read("config/digital-observer-ci-gates.json"));
  assert.equal(config.domain.filter(s => s.name === "ai-worker-query-boundary").length, 1);
  assert.deepEqual(config.domain.find(s => s.name === "ai-worker-query-boundary").args, ["--test", "scripts/qa/check-ai-worker-query-boundary.mjs"]);
  assert.equal(fetchCalls, 0);
});
