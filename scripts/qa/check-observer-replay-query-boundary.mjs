import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";
import { createRequire } from "node:module";

// Synthetic rendering only: no browser, database, service, handler invocation or fetch.
const requireLocal = createRequire(import.meta.url);
const ts = requireLocal("typescript");
const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const never = () => { throw new Error("NETWORK_OR_ACTION_FORBIDDEN"); };
const source = read("app/dashboard/admin/observer-replay/page.tsx");
const panelSource = read("components/observer-test-center-review-panel.tsx");
function load(text, require) {
  const exports = {};
  const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports, require, fetch: never, console: { warn() {} }, Date, Intl });
  return exports;
}
const safe = load(read("lib/admin-safe.ts"), never);
const domain = load(read("lib/domain/observer-calibration.ts"), never);
const tables = Array.from(source.matchAll(/supabase\.from\("([^"]+)"/g), (match) => match[1]);
const fixtures = [
  [{ id: "AI", event_type: "ROW_AI", confidence_score: 0.8, combined_confidence: 0.9, observer_shadow_mode: true, created_at: "2026-01-01" }],
  [{ id: "AUDIO", event_type: "ROW_AUDIO", confidence: 0.7, created_at: "2026-01-02" }],
  [{ id: "CORR", correlation_type: "ROW_CORR", confidence: 0.6, created_at: "2026-01-03" }],
  [{ id: "SUMMARY", summary_type: "synthetic", title: "ROW_SUMMARY", summary_text: "SYNTHETIC_ONLY", confidence_score: 0.9, created_at: "2026-01-04" }],
  [{ id: "LOG", event_source: "ai_camera_event", replay_status: "completed", replay_reason: "ROW_LOG", created_at: "2026-01-05" }],
  [{ id: "REVIEW", outcome: "correct_detection", confidence_at_review: 0.9 }],
  [{ id: "PROFILE", readiness_score: 80 }]
];
const jsx = { jsx: (type, props, key) => ({ type, props, key }), jsxs: (type, props, key) => ({ type, props, key }) };
function walk(value, visit) {
  if (Array.isArray(value)) return value.forEach((item) => walk(item, visit));
  if (value && typeof value === "object") { visit(value); walk(value.props?.children, visit); }
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value && typeof value === "object" ? text(value.props?.children) : "";
}
const flat = (value) => text(value).replace(/\s+/g, " ").trim();
async function render({ fail = [], reject = [], stale = false, rows = fixtures, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0;
  const denied = new Error("DENIED");
  const client = { from(table) {
    const index = calls++;
    assert.equal(table, tables[index]);
    const builder = {};
    for (const method of ["select", "order", "limit", "eq"]) builder[method] = () => builder;
    builder.then = (ok, bad) => reject.includes(index)
      ? Promise.reject(new Error("PRIVATE_ERROR")).then(ok, bad)
      : Promise.resolve({ data: fail.includes(index) && !stale ? null : rows[index], error: fail.includes(index) ? { message: "PRIVATE_ERROR" } : null }).then(ok, bad);
    return builder;
  } };
  const req = (id) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "node:crypto") return crypto;
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    if (id.endsWith("/dashboard-shell")) return { DashboardShell: "DashboardShell" };
    if (id.endsWith("/premium-dashboard")) return new Proxy({}, { get: (_, key) => String(key) });
    if (id.endsWith("/observer-test-center-review-panel")) return { ObserverTestCenterReviewPanel: "ReviewPanel" };
    if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/admin-safe")) return safe;
    if (id.endsWith("/domain/observer-calibration")) return domain;
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); if (deny) throw denied; } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => { clients++; if (thrown) throw new Error("PRIVATE_ERROR"); return client; } };
    throw new Error(`UNEXPECTED_IMPORT ${id}`);
  };
  let tree;
  try { tree = await load(source, req).default(); } catch (error) {
    if (error !== denied) throw error;
    assert.equal(clients, 0); assert.equal(calls, 0); return { denied: true };
  }
  const nodes = []; walk(tree, (node) => nodes.push(node));
  return {
    tree, calls, clients,
    banner: nodes.find((node) => node.type === "AdminDataError")?.props.message ?? null,
    metrics: Object.fromEntries(nodes.filter((node) => node.type === "RoleMetricCard").map((node) => [node.props.label, node.props])),
    panel: nodes.find((node) => node.type === "ReviewPanel"),
    cards: nodes.filter((node) => node.type === "article" && node.props.className === "premium-action-card").map(flat),
    empty: nodes.filter((node) => node.type === "EmptyState").map((node) => node.props.title),
    strings: flat(tree),
    logs: nodes.filter((node) => node.type === "div" && node.props.className === "list-item"),
    summaries: nodes.filter((node) => node.type === "article" && node.props.className === "card procedure-card")
  };
}

test("preserves query chains, shared logic, panel, navigation, and prior gate inventory", () => {
  assert.equal(tables.length, 7);
  assert.equal(hash(Array.from(source.matchAll(/supabase\.from\(.*?\.limit\(\d+\)/g), (m) => m[0]).join("\n")), "a9a318b892f335868d16729604afb13aeb3bb971dab54b6a6c596e53e4f3a324");
  assert.equal(hash(Array.from(source.matchAll(/href="[^"]+"/g), (m) => m[0]).join("\n")), "131409bb408aa960ef6334c7c77d9f653fb5f3a80d413a80f1e0552d14e44329");
  assert.equal(hash(panelSource), "dad09967da8480a887e05a05cfd39572ba335fc4afa77614a70bdc331c62768f");
  assert.equal(hash(read("lib/domain/observer-calibration.ts")), "60241cd0832c352d3894882e616e53e691372c39b0870913ea1a9aa0dacb4c63");
  assert.equal(hash(read("lib/admin-safe.ts")), "8fc98961d4b3b7771066ab49ebd5bed53083b14460b19473f314157b593c46e7");
  const config = JSON.parse(read("config/digital-observer-ci-gates.json"));
  const hooks = config.domain.filter((item) => item.name === "observer-replay-query-boundary");
  assert.deepEqual(hooks, [{ name: "observer-replay-query-boundary", args: ["--test", "scripts/qa/check-observer-replay-query-boundary.mjs"] }]);
  config.domain = config.domain.filter((item) => item.name !== "observer-replay-query-boundary");
  assert.equal(hash(JSON.stringify(config)), "4ce1cf5e331ca6b42e3011bc6339a0a51ef318a093e1f156376917a38a5fd206");
});

for (let index = 0; index < 7; index++) {
  for (const mode of ["null error", "stale error", "rejection"]) test(`source ${index}: ${mode} is isolated and fails closed`, async () => {
    const result = await render(mode === "rejection" ? { reject: [index] } : { fail: [index], stale: mode === "stale error" });
    assert.equal(result.calls, 7); assert.ok(result.banner); assert.ok(!result.strings.includes("PRIVATE_ERROR"));
    assert.equal(result.metrics["אירועים ל-Replay"].value === "לא זמין", index < 3);
    assert.equal(result.metrics["Replay logs"].value === "לא זמין", index === 4);
    assert.equal(result.metrics["Ground truth"].value === "לא זמין", index === 5);
    assert.equal(result.metrics.Readiness.value === "לא זמין", index !== 4);
    if (index < 3) {
      assert.ok(result.cards[index].includes("לא זמין"));
      assert.equal(result.panel.props.events.length, 2);
      assert.ok(!result.panel.props.events.some((event) => event.id === fixtures[index][0].id));
      assert.ok(result.strings.includes("רשימת האירועים חלקית"));
    } else assert.equal(result.panel.props.events.length, 3);
    if (index === 3) { assert.ok(result.empty.includes("סיכומי תצפיתן אינם זמינים")); assert.ok(!result.strings.includes("ROW_SUMMARY")); }
    if (index === 4) { assert.ok(!result.strings.includes("ROW_LOG")); assert.ok(!result.strings.includes("אין Replay שנשמרו")); assert.match(result.strings, /Last replay לא זמין/); }
    for (let card = 0; card < 4; card++) if (index !== card) assert.ok(result.cards[card].includes("1 אירועים"));
  });
}

test("healthy, empty, partial empty, whole loader failure and authorization denial", async () => {
  const healthy = await render();
  assert.equal(healthy.banner, null); assert.equal(healthy.metrics["אירועים ל-Replay"].value, 3);
  assert.equal(healthy.panel.props.events[2].confidence, 0.9);
  assert.deepEqual(Array.from(healthy.panel.props.events, (event) => event.id), ["CORR", "AUDIO", "AI"]);
  assert.ok(!healthy.panel.props.events.some((event) => event.id === "SUMMARY"));
  const emptyRows = fixtures.map(() => []);
  const empty = await render({ rows: emptyRows });
  assert.equal(empty.metrics["אירועים ל-Replay"].value, 0); assert.equal(empty.metrics["Ground truth"].value, 0);
  assert.ok(empty.empty.includes("אין אירועים ל-Replay")); assert.ok(empty.empty.includes("אין סיכומים"));
  const partial = await render({ rows: emptyRows, fail: [0] });
  assert.ok(partial.empty.includes("אירועי Replay אינם זמינים")); assert.ok(!partial.empty.includes("אין אירועים ל-Replay")); assert.equal(partial.panel, undefined);
  const allFailed = await render({ fail: [0, 1, 2], stale: true }); assert.equal(allFailed.panel, undefined);
  const thrown = await render({ thrown: true }); assert.equal(thrown.clients, 1); assert.equal(thrown.calls, 0); assert.equal(thrown.metrics.Readiness.value, "לא זמין"); assert.equal(thrown.panel, undefined);
  assert.equal((await render({ deny: true })).denied, true);
});

test("keyed actual panel remounts for error, recovery and same-ID payload but not unrelated sources", async () => {
  let slots = [], cursor = 0, currentKey;
  const panel = load(panelSource, (id) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "react") return { useState: (initial) => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], never]; } };
    throw new Error(`UNEXPECTED_PANEL_IMPORT ${id}`);
  }).ObserverTestCenterReviewPanel;
  const show = (node) => { if (currentKey !== node.key) { slots = []; currentKey = node.key; } cursor = 0; return flat(panel(node.props)); };
  const healthy = await render(); const partial = await render({ fail: [0], stale: true }); const recovered = await render();
  assert.ok(show(healthy.panel).includes("ROW_AI")); assert.ok(!show(partial.panel).includes("ROW_AI")); assert.ok(show(recovered.panel).includes("ROW_AI"));
  const modified = fixtures.map((row) => row.map((item) => ({ ...item })));
  modified[0][0].event_type = "NEW_AI"; modified[0][0].ground_truth_outcome = "uncertain"; modified[0][0].combined_confidence = 0.2;
  const updated = await render({ rows: modified }); assert.notEqual(updated.panel.key, healthy.panel.key); assert.ok(show(updated.panel).includes("NEW_AI"));
  show(healthy.panel);
  slots[0] = slots[0].map((event) => event.id === "AI" ? { ...event, ground_truth_outcome: "uncertain" } : event);
  for (const index of [3, 4, 5, 6]) {
    const unrelated = await render({ fail: [index] });
    assert.equal(unrelated.panel.key, healthy.panel.key);
    assert.ok(show(unrelated.panel).includes("לא בטוח"));
  }
});

test("actual bounded panel, log and summary slices preserve independent records", async () => {
  const many = fixtures.map((row) => row.map((item) => ({ ...item })));
  many[0] = Array.from({ length: 60 }, (_, i) => ({ ...fixtures[0][0], id: `ai-${i}`, created_at: `2026-01-${String((i % 28) + 1).padStart(2, "0")}` }));
  many[3] = Array.from({ length: 14 }, (_, i) => ({ ...fixtures[3][0], id: `sum-${i}` }));
  many[4] = Array.from({ length: 10 }, (_, i) => ({ ...fixtures[4][0], id: `log-${i}` }));
  const result = await render({ rows: many });
  assert.equal(result.metrics["אירועים ל-Replay"].value, 62); assert.equal(result.panel.props.events.length, 50);
  assert.equal(result.logs.length, 8); assert.equal(result.summaries.length, 12); assert.match(result.strings, /Last replay completed/);
  const modifiedOutside = many.map((row) => row.map((item) => ({ ...item })));
  const firstIds = new Set(Array.from(result.panel.props.events, (event) => event.id));
  const outside = modifiedOutside[0].find((item) => !firstIds.has(item.id)); outside.event_type = "OUTSIDE_SLICE";
  const second = await render({ rows: modifiedOutside }); assert.equal(second.panel.key, result.panel.key);
});
