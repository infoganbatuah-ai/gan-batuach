import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Actual source modules with synthetic clients/state hooks. No browser, live
// authentication, database, provider or React reconciliation proof is claimed.
const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");
const source = (name) => fs.readFileSync(path.join(root, name), "utf8");
const pageSource = source("app/dashboard/admin/ai-events/page.tsx");
const panelSource = source("components/ai-camera-events-review.tsx");
const helperSource = source("lib/admin-safe.ts");
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
let externalCalls = 0;
const forbidden = () => { externalCalls++; throw Error("EXTERNAL_ACTION_FORBIDDEN"); };
function load(text, imports, warnings = []) {
  const exports = {};
  const compiled = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
  } });
  assert.equal(compiled.diagnostics.length, 0);
  vm.runInNewContext(compiled.outputText, { exports, require: imports, Date, Intl,
    fetch: forbidden, window: { prompt: forbidden }, process: { env: {} },
    console: { warn: (...args) => warnings.push(args) } });
  return exports;
}
const domains = new Map();
function domain(name) {
  if (!domains.has(name)) domains.set(name, load(source(name), (id) => {
    if (id === "zod") return require("zod");
    if (id.startsWith("@/lib/domain/")) return domain(id.slice(2) + ".ts");
    throw Error("Unexpected domain import " + id);
  }));
  return domains.get(name);
}
const actualDomain = domain("lib/domain/ai-digital-observer.ts");
const normalize = (value) => JSON.parse(JSON.stringify(value));
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
const event = { id: "e", title: "EVENT_ROW", event_type: "fall_suspected", severity: "high",
  status: "open", shadow_mode: true, review_priority: 1, safety_category: "fall",
  created_at: "2026-11-04T10:00:00.000Z", metadata: {} };
const fixtures = [[event], [{ id: "g", name: "GARDEN_ROW" }], [{ id: "c", name: "CAMERA_ROW", garden_id: "g" }]];
const tables = ["ai_camera_events", "gardens", "camera_streams"];
const expectedContracts = [
  ["ai_camera_events", [["select", "*, gardens(name), camera_streams(name, area)"], ["order", "created_at", { ascending: false }], ["limit", 100]]],
  ["gardens", [["select", "id, name"], ["order", "name"]]],
  ["camera_streams", [["select", "id, name, garden_id"], ["order", "name"]]]
];
async function page({ errors = [], rejections = [], missing = [], data = fixtures, loader = false, deny = false } = {}) {
  let clients = 0, queries = 0;
  const contracts = [], warnings = [];
  const client = { from(table) {
    const i = queries++; assert.equal(table, tables[i]);
    const chain = []; contracts.push([table, chain]);
    const builder = {};
    for (const method of ["select", "order", "limit"]) builder[method] = (...args) => { chain.push([method, ...args]); return builder; };
    builder.then = (resolve, reject) => (rejections.includes(i) ? Promise.reject(Error("PRIVATE_RAW_ERROR")) :
      Promise.resolve({ data: missing.includes(i) ? null : data[i], error: errors.includes(i) ? { message: "PRIVATE_RAW_ERROR" } : null })).then(resolve, reject);
    return builder;
  } };
  const helper = load(helperSource, forbidden, warnings);
  const pageModule = load(pageSource, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => {
      assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(queries, 0);
      if (deny) throw Error("DENIED");
    } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_RAW_ERROR"); return client; } };
    if (id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    throw Error("Unexpected page import " + id);
  }, warnings);
  if (deny) { await assert.rejects(pageModule.default(), /DENIED/); return { clients, queries }; }
  const tree = await pageModule.default();
  return { tree, panel: nodes(tree, "AiCameraEventsReview")[0], banner: nodes(tree, "AdminDataError")[0].props.message,
    clients, queries, contracts: normalize(contracts), warnings: normalize(warnings) };
}
function harness() {
  const slots = []; let cursor = 0, dirty = false, props;
  const panelModule = load(panelSource, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "@/lib/domain/ai-digital-observer") return actualDomain;
    if (id === "react") return { useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (update) => { slots[index] = typeof update === "function" ? update(slots[index]) : update; dirty = true; }];
    } };
    throw Error("Unexpected panel import " + id);
  });
  return {
    render(next = props) {
      props = next; let tree, attempts = 0;
      do { dirty = false; cursor = 0; tree = panelModule.AiCameraEventsReview(props); assert.ok(++attempts < 10, "bounded render reconciliation"); } while (dirty);
      return tree;
    },
    optimistic(rows) { slots[0] = { ...slots[0], rows }; },
    get rows() { return slots[0].rows; },
    get identity() { return slots[0].identity; },
    get generation() { return slots[0].generation; }
  };
}
const metric = (tree, label) => text(nodes(tree, "article").find((node) => node.props.className === "metric-card" && text(nodes(node, "span")[0]) === label)?.props.children[0]);
const select = (tree, name) => nodes(tree, "select").find((node) => node.props.name === name);
const mockButton = (tree) => nodes(tree, "button").find((node) => text(node) === "יצירת אירוע mock");
const qualified = (overrides = {}) => ({ events: fixtures[0], gardens: fixtures[1], cameras: fixtures[2],
  availability: { events: true, gardens: true, cameras: true }, role: "admin", adminMode: true, ...overrides });

test("exact three query chains and admin admission remain unchanged", async () => {
  const result = await page(); assert.deepEqual(result.contracts, expectedContracts); assert.equal(result.banner, null);
  assert.equal(result.clients, 1); assert.equal(result.queries, 3);
});
test("denied admin never creates a client or starts a query", async () => {
  assert.deepEqual(await page({ deny: true }), { clients: 0, queries: 0 });
});
for (let i = 0; i < 3; i++) for (const mode of ["returned", "rejected"]) for (const missing of [false, true]) {
  test(`${tables[i]} ${mode} ${missing ? "missing" : "stale"}: discard only failed source`, async () => {
    const result = await page({ errors: mode === "returned" ? [i] : [], rejections: mode === "rejected" ? [i] : [], missing: missing ? [i] : [] });
    assert.equal(result.queries, 3); assert.deepEqual(result.contracts, expectedContracts);
    for (let j = 0; j < 3; j++) {
      const name = ["events", "gardens", "cameras"][j];
      assert.equal(result.panel.props[name].length, j === i ? 0 : 1);
      assert.equal(result.panel.props.availability[name], j !== i);
    }
    assert.ok(result.banner.includes(["אירועים", "גנים", "מצלמות"][i]));
    assert.ok(!JSON.stringify(result.tree).includes("PRIVATE_RAW_ERROR"));
    assert.ok(!JSON.stringify(result.warnings).includes("PRIVATE_RAW_ERROR"));
    assert.ok(result.warnings.every((row) => row.length === 2));
  });
}
for (const failed of [[0, 1], [0, 2], [1, 2], [0, 1, 2]]) test(`paired source failures ${failed}`, async () => {
  const result = await page({ errors: failed });
  for (let i = 0; i < 3; i++) {
    assert.equal(result.panel.props[["events", "gardens", "cameras"][i]].length, failed.includes(i) ? 0 : 1);
    if (failed.includes(i)) assert.ok(result.banner.includes(["אירועים", "גנים", "מצלמות"][i]));
  }
});
test("thrown loader marks all sources unavailable rather than healthy zero", async () => {
  const result = await page({ loader: true }); assert.equal(result.queries, 0);
  assert.deepEqual(normalize(result.panel.props.availability), { events: false, gardens: false, cameras: false });
  for (const label of ["אירועים", "גנים", "מצלמות"]) assert.ok(result.banner.includes(label));
  const tree = harness().render(result.panel.props);
  for (const label of ["פתוחים ל-review", "חומרה גבוהה", "Shadow detections", "Safety indicators", "Priority review", "Escalations", "Avg resolution"]) assert.equal(metric(tree, label), "לא זמין");
  assert.ok(!text(tree).includes("אושרו לאחר בדיקה: 0")); assert.equal(nodes(tree, "img").length, 0);
});
for (let i = 0; i < 3; i++) test(`successful missing ${tables[i]} remains healthy empty`, async () => {
  const result = await page({ missing: [i] });
  assert.equal(result.banner, null);
  assert.equal(result.panel.props[["events", "gardens", "cameras"][i]].length, 0);
  assert.ok(Object.values(result.panel.props.availability).every(Boolean));
});
test("event outage retains independent healthy mock choices without stale rows/actions", async () => {
  const result = await page({ errors: [0] }); const tree = harness().render(result.panel.props);
  assert.ok(!text(tree).includes("EVENT_ROW")); assert.equal(mockButton(tree).props.disabled, false);
  assert.ok(text(tree).includes("GARDEN_ROW")); assert.ok(text(tree).includes("CAMERA_ROW"));
  assert.ok(!nodes(tree, "button").some((node) => text(node) === "אישור לאחר review"));
});
for (const failed of ["gardens", "cameras"]) test(`failed ${failed} guards mock before FormData reads`, async () => {
  const props = qualified({ availability: { events: true, gardens: failed !== "gardens", cameras: failed !== "cameras" } });
  const h = harness(); const tree = h.render(props); assert.equal(mockButton(tree).props.disabled, true);
  assert.ok(nodes(tree, "select").every((node) => node.props.disabled));
  let reads = 0; await nodes(tree, "form")[0].props.action({ get() { reads++; throw Error("FORM_READ_FORBIDDEN"); } });
  assert.equal(reads, 0); assert.equal(externalCalls, 0);
  assert.ok(!text(tree).includes(failed === "gardens" ? "GARDEN_ROW" : "CAMERA_ROW"));
});
test("healthy empty preserves zero counts, but new Admin average is unmeasured", async () => {
  const result = await page({ data: [[], [], []] }); assert.equal(result.banner, null);
  const tree = harness().render(result.panel.props); assert.equal(metric(tree, "פתוחים ל-review"), "0");
  assert.equal(metric(tree, "Avg resolution"), "לא נמדד"); assert.equal(mockButton(tree).props.disabled, true);
});
test("healthy empty optional camera list permits mock when a garden exists", () => {
  assert.equal(mockButton(harness().render(qualified({ cameras: [] }))).props.disabled, false);
});
test("actual measured zero and nonempty resolution formulas remain", () => {
  for (const [reviewed, expected] of [["2026-11-04T10:00:00.000Z", "0.0h"], ["2026-11-04T12:00:00.000Z", "2.0h"]]) {
    const tree = harness().render(qualified({ events: [{ ...event, reviewed_at: reviewed }] }));
    assert.equal(metric(tree, "Avg resolution"), expected); assert.equal(metric(tree, "Safety indicators"), "1");
    assert.equal(metric(tree, "Priority review"), "1");
  }
});
for (const role of [undefined, "garden", "inspector"]) test(`legacy ${role ?? "default"} healthy and empty contract`, () => {
  for (const rows of [fixtures[0], []]) {
    const tree = harness().render({ events: rows, ...(role ? { role } : {}) });
    assert.equal(metric(tree, "Avg resolution"), "0.0h"); assert.equal(nodes(tree, "form").length, 0);
    assert.equal(metric(tree, "פתוחים ל-review"), String(rows.length));
    assert.equal(nodes(tree, "button").length, rows.length * 7);
  }
});
const updates = {
  title: "NEW_TITLE", description: "NEW_DESCRIPTION", status: "confirmed", review_outcome: "valid_detection",
  review_notes: "NEW_REVIEW", reviewed_at: "2026-11-04T11:00:00.000Z", severity: "critical",
  event_type: "distress_suspected", safety_category: "distress", review_priority: 4,
  shadow_mode: false, created_at: "2026-11-04T09:00:00.000Z", started_at: "2026-11-04T10:00:00.000Z",
  snapshot_url: "/synthetic-local-only.png", confidence_score: 0, recommended_action: "NEW_RECOMMENDATION",
  evidence_notes: "NEW_EVIDENCE", kindergarten_id: "g2", gardens: { name: "NEW_GARDEN" },
  camera_streams: { name: "NEW_CAMERA" }, metadata: { safety_framework: true, shadow_mode: true }
};
for (const [field, value] of Object.entries(updates)) test(`same-ID authoritative ${field} replaces stale local rows`, () => {
  const h = harness(); h.render(qualified()); h.optimistic([{ ...event, title: "OPTIMISTIC_OLD" }]);
  h.render(qualified({ events: [{ ...event, [field]: value }] }));
  assert.deepEqual(normalize(h.rows), [{ ...event, [field]: value }]);
});
test("removal, outage and recovery clear old events without resurrection", () => {
  const h = harness(); h.render(qualified());
  assert.ok(!text(h.render(qualified({ events: [] }))).includes("EVENT_ROW"));
  h.optimistic([{ ...event, title: "OPTIMISTIC" }]);
  const unavailable = qualified({ events: [], availability: { events: false, gardens: true, cameras: true } });
  assert.ok(!text(h.render(unavailable)).includes("OPTIMISTIC"));
  assert.equal(h.rows.length, 0);
  h.render(qualified({ events: [] })); assert.equal(h.rows.length, 0);
  assert.ok(text(h.render(qualified())).includes("EVENT_ROW"));
});
test("unchanged empty payload preserves optimistic rows; failure invalidates them", () => {
  const h = harness(); const props = qualified({ events: [] }); h.render(props); h.optimistic([event]);
  assert.ok(text(h.render({ ...props, unrelated: "rerender" })).includes("EVENT_ROW"));
  assert.equal(h.rows.length, 1);
  assert.ok(!text(h.render({ ...props, availability: { events: false, gardens: true, cameras: true } })).includes("EVENT_ROW"));
});
test("same-identity recovery receives a new reconciliation generation", () => {
  const h = harness(); const props = qualified(); h.render(props);
  const originalIdentity = h.identity, originalGeneration = h.generation;
  h.render(qualified({ availability: { events: false, gardens: true, cameras: true } }));
  assert.ok(h.generation > originalGeneration);
  h.render(props); assert.equal(h.identity, originalIdentity);
  assert.ok(h.generation > originalGeneration + 1);
  const recoveredGeneration = h.generation;
  h.render({ ...props }); assert.equal(h.generation, recoveredGeneration);
});
test("irrelevant nested metadata and independent choice refresh preserve optimistic rows", () => {
  const h = harness(); h.render(qualified()); h.optimistic([{ ...event, title: "OPTIMISTIC" }]); const identity = h.identity;
  h.render(qualified({ events: [{ ...event, metadata: { unused: { arbitrary: "changed" } }, camera_streams: { area: "unused" } }] }));
  assert.equal(h.identity, identity); assert.equal(h.rows[0].title, "OPTIMISTIC");
  h.render(qualified({ gardens: [{ id: "g", name: "RENAMED" }] })); assert.equal(h.rows[0].title, "OPTIMISTIC");
});
test("destination reconciliation preserves valid selection, clears failure/removal, and recovers", () => {
  const h = harness(); const props = qualified({ gardens: [...fixtures[1], { id: "g2", name: "SECOND" }] });
  let tree = h.render(props); select(tree, "kindergarten_id").props.onChange({ target: { value: "g2" } });
  tree = h.render(); assert.equal(select(tree, "kindergarten_id").props.value, "g2");
  tree = h.render({ ...props, events: [{ ...event, status: "confirmed" }] }); assert.equal(select(tree, "kindergarten_id").props.value, "g2");
  tree = h.render({ ...props, gardens: [{ id: "g2", name: "RENAMED" }] }); assert.equal(select(tree, "kindergarten_id").props.value, "g2");
  tree = h.render({ ...props, gardens: fixtures[1] }); assert.equal(select(tree, "kindergarten_id").props.value, "g");
  tree = h.render({ ...props, gardens: [], availability: { events: true, gardens: false, cameras: true } }); assert.equal(select(tree, "kindergarten_id").props.value, "");
  tree = h.render(props); assert.equal(select(tree, "kindergarten_id").props.value, "g");
});
test("form identity ignores unrelated metadata and changes when camera routing changes", () => {
  const h = harness(); const first = nodes(h.render(qualified()), "form")[0].key;
  const same = nodes(h.render(qualified({ cameras: [{ ...fixtures[2][0], unused: "changed" }] })), "form")[0].key;
  assert.equal(first, same);
  const changed = nodes(h.render(qualified({ cameras: [{ ...fixtures[2][0], garden_id: "g2" }] })), "form")[0].key;
  assert.notEqual(first, changed);
});
test("static API/action, human-review and config contracts remain intact", () => {
  for (const action of ["review", "confirm", "dismiss", "escalate", "false_positive", "valid_detection", "needs_more_data"]) assert.ok(panelSource.includes(`action(event, "${action}")`));
  assert.ok(panelSource.includes('fetch(`/api/ai-camera-events/${event.id}/action`'));
  assert.ok(panelSource.includes('fetch("/api/ai-camera-events"'));
  assert.ok(panelSource.includes('JSON.stringify({ action: actionName, review_notes })'));
  for (const key of ["kindergarten_id", "camera_id", "event_type", "severity", "confidence_score", "description"]) assert.ok(panelSource.includes(`formData.get("${key}")`));
  assert.ok(panelSource.includes("אין הודעת הורים לפני workflow מאושר"));
  assert.ok(pageSource.includes('process.env.AI_GATEWAY_URL ? "Gateway configured" : "Gateway pending"'));
  assert.ok(!/Date\.now\(|Math\.random\(/.test(pageSource + panelSource));
  const config = JSON.parse(source("config/digital-observer-ci-gates.json"));
  const hooks = config.domain.filter((entry) => entry.name === "ai-events-query-boundary");
  assert.deepEqual(hooks, [{ name: "ai-events-query-boundary", args: ["--test", "scripts/qa/check-ai-events-query-boundary.mjs"] }]);
});
test("all qualification remains synthetic and executes zero fetch/actions", () => assert.equal(externalCalls, 0));
