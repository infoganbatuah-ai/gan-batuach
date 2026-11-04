import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Actual page/helper/domain, synthetic JSX and clients only. No browser or DB proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) {
  const filename = path.join(root, relative);
  assert.equal((fs.statSync(filename).flags ?? 0) & 0x40000000, 0);
  return fs.readFileSync(filename, "utf8");
}
const pageSource = source("app/dashboard/admin/ai-platform/page.tsx");
const helperSource = source("lib/admin-safe.ts");
const domainSource = source("lib/domain/observer-calibration.ts");
const expectedQueries = [
  ["ai_models", "updated_at", 200],
  ["ai_training_datasets", "updated_at", 120],
  ["ai_model_calibrations", "updated_at", 200],
  ["ai_model_evaluations", "created_at", 120],
  ["ai_model_deployments", "created_at", 120],
  ["ai_vertical_capability_matrix", "vertical_key", 200],
  ["ai_governance_reviews", "created_at", 120],
  ["ai_audit_events", "created_at", 80],
  ["observer_ground_truth_reviews", "created_at", 500]
];
const heroDependencies = new Set([0, 1, 2, 3, 6, 8]);
const fixtures = [
  [{ id: "model", model_name: "MODEL_SENTINEL", lifecycle_status: "production", drift_status: "stable", accuracy: 95 }],
  [{ id: "dataset", dataset_name: "DATASET_SENTINEL", approval_status: "approved", quality_score: 94 }],
  [{ id: "calibration", model_key: "CALIBRATION_SENTINEL", calibration_status: "approved", confidence_threshold: 0.9, alert_threshold: 0.7 }],
  [{ id: "evaluation", evaluation_status: "completed" }],
  [{ id: "deployment", deployment_status: "production" }],
  [{ id: "matrix", capability_name: "MATRIX_SENTINEL", module_name: "MODULE_SENTINEL", regulatory_mode: "reviewed", enabled: true }],
  [{ id: "governance", status: "approved_human" }],
  [{ id: "audit" }],
  Array.from({ length: 100 }, (_, i) => ({ id: `review${i}`, outcome: "correct_detection", confidence_at_review: 0.9 }))
];
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
function load(text, resolve, warnings) {
  const compiled = ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  });
  assert.equal(compiled.diagnostics.length, 0);
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports, require: resolve, Date, Intl,
    fetch() { throw Error("FORBIDDEN_FETCH"); },
    process: { env: {} }, console: { warn: (...args) => warnings.push(args) }
  });
  return exports;
}
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
const plain = (value) => JSON.parse(JSON.stringify(value));
async function run({ failures = {}, empty = false, nullData = false, loader = false, deny = false, data = fixtures } = {}) {
  let clients = 0;
  const chains = [];
  const warnings = [];
  const unexpected = (name) => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${name}`); };
  const helper = load(helperSource, unexpected, warnings);
  const domain = load(domainSource, unexpected, warnings);
  const client = {
    from(table) {
      const index = chains.length;
      assert.equal(table, expectedQueries[index]?.[0]);
      const calls = [];
      chains.push([table, calls]);
      const query = {};
      for (const method of ["select", "order", "limit"]) {
        query[method] = (...args) => { calls.push([method, ...args]); return query; };
      }
      query.then = (resolve, reject) => {
        const failure = failures[index];
        if (failure?.kind === "reject") return Promise.reject(Error("PRIVATE_ERROR_SENTINEL")).then(resolve, reject);
        return Promise.resolve({
          data: nullData ? null : empty || (failure && !failure.stale) ? [] : data[index],
          error: failure ? { message: "PRIVATE_ERROR_SENTINEL", details: "DO_NOT_LOG" } : null
        }).then(resolve, reject);
      };
      return query;
    }
  };
  const page = load(pageSource, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "next/link") return { default: "Link" };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/domain/observer-calibration") return domain;
    if (id === "@/lib/auth") return { requireRole: async (roles) => {
      assert.deepEqual(Array.from(roles), ["admin"]);
      assert.equal(clients, 0);
      assert.equal(chains.length, 0);
      if (deny) throw Error("DENIED");
    } };
    if (id === "@/lib/supabase/server") return { createClient: async () => {
      clients++;
      if (loader) throw Error("PRIVATE_LOADER_SENTINEL");
      return client;
    } };
    return unexpected(id);
  }, warnings);
  if (deny) {
    await assert.rejects(page.default(), /DENIED/);
    assert.equal(clients, 0); assert.equal(chains.length, 0);
    return;
  }
  const tree = await page.default();
  const metrics = Object.fromEntries(nodes(tree, "RoleMetricCard").map((item) => [item.props.label, item.props]));
  const counts = Object.fromEntries(nodes(tree, "div").filter((item) => item.props.className === "risk-list")
    .flatMap((item) => nodes(item.props.children, "div")).map((item) => [text(item).replace(text(nodes(item, "b")[0]), "").trim(), text(nodes(item, "b")[0])]));
  return {
    tree, clients, chains, warnings, metrics, counts, text: text(tree),
    hero: nodes(tree, "PremiumDashboardHero")[0].props,
    banner: nodes(tree, "AdminDataError")[0].props.message,
    sections: Object.fromEntries(nodes(tree, "CleanSection").map((item) => [item.props.title,
      text(item) + nodes(item, "EmptyState").map((emptyState) => `${emptyState.props.title} ${emptyState.props.text}`).join(" ")]))
  };
}
function assertQueries(result) {
  assert.equal(result.clients, 1);
  assert.deepEqual(plain(result.chains), expectedQueries.map(([table, order, limit]) => [table, [
    ["select", "*"], order === "vertical_key" ? ["order", order] : ["order", order, { ascending: false }], ["limit", limit]
  ]]));
}
function unavailable(metric) { assert.equal(metric.value, "לא זמין"); assert.equal(metric.tone, "default"); }
function healthyModels(result) {
  assert.equal(result.metrics.Models.value, 1); assert.equal(result.metrics.Versions.value, 1);
  assert.equal(result.metrics.Production.value, 1); assert.equal(result.metrics.Accuracy.value, "95%");
  assert.equal(result.metrics.Drift.value, 0); assert.equal(result.metrics.Drift.tone, "good");
}
function assertFailedSource(result, index) {
  if (index === 0) {
    for (const name of ["Models", "Versions", "Testing", "Production", "Accuracy", "Drift"]) unavailable(result.metrics[name]);
    assert.ok(result.sections["מודלים פעילים"].includes("אינם זמינים"));
    assert.ok(!result.text.includes("MODEL_SENTINEL"));
  } else healthyModels(result);
  if (index === 8) { unavailable(result.metrics.Reviews); unavailable(result.metrics.Observer); }
  else { assert.equal(result.metrics.Reviews.value, 100); assert.equal(result.metrics.Observer.value, "94/100"); }
  for (const [i, marker] of [[1, "DATASET_SENTINEL"], [2, "CALIBRATION_SENTINEL"], [5, "MATRIX_SENTINEL"]]) {
    assert.equal(result.text.includes(marker), i !== index);
  }
  for (const [i, label] of [[3, "Evaluations"], [4, "Deployments"], [6, "Governance reviews"], [7, "Audit events"]]) {
    assert.equal(result.counts[label], i === index ? "לא זמין" : "1");
  }
  assert.equal(result.hero.badge, heroDependencies.has(index) ? "לא זמין" : "99/100");
  if (heroDependencies.has(index)) assert.equal(result.hero.badgeTone, "default");
  assert.ok(result.banner);
  assert.ok(!result.banner.includes("מיגרצי"));
  assert.ok(!JSON.stringify(result.warnings).includes("PRIVATE_ERROR_SENTINEL"));
  assert.deepEqual(plain(result.warnings), [["Admin Supabase query unavailable:", `ai platform query ${index}`]]);
  assertQueries(result);
}

test("healthy full page preserves nine exact queries, formulas and independent sections", async () => {
  const result = await run(); assertQueries(result); healthyModels(result);
  assert.equal(result.hero.badge, "99/100"); assert.equal(result.banner, null);
  assert.equal(result.metrics.Observer.value, "94/100");
  assert.ok(result.text.includes("MATRIX_SENTINEL")); assert.ok(result.text.includes("מאופשר"));
});
for (const [index, [table]] of expectedQueries.entries()) {
  for (const kind of ["returned", "reject"]) for (const stale of [false, true]) {
    test(`${table}: ${kind} ${stale ? "stale" : "empty"} source is unavailable, independent data survives`, async () => {
      assertFailedSource(await run({ failures: { [index]: { kind, stale } } }), index);
    });
  }
}
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} remains measured empty, not unavailable`, async () => {
  const result = await run({ empty: true, nullData }); assertQueries(result);
  assert.equal(result.banner, null); assert.equal(result.hero.badge, "16/100");
  for (const name of ["Models", "Versions", "Testing", "Production", "Drift", "Reviews"]) assert.equal(result.metrics[name].value, 0);
  assert.equal(result.metrics.Accuracy.value, "אין"); assert.equal(result.metrics.Observer.value, "0/100");
  assert.equal(result.metrics.Drift.tone, "good");
  assert.ok(result.sections["Capability Matrix"].includes("אין מטריצת יכולות"));
});
test("all sources fail without false measurements or enabled capabilities", async () => {
  const result = await run({ failures: Object.fromEntries(expectedQueries.map((_, i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) });
  assertQueries(result); assert.equal(result.hero.badge, "לא זמין");
  for (const metric of Object.values(result.metrics)) unavailable(metric);
  for (const count of Object.values(result.counts)) assert.equal(count, "לא זמין");
  assert.ok(!result.text.includes("SENTINEL")); assert.ok(!result.text.includes("מאופשר"));
});
test("outer client failure is unavailable, not good zero", async () => {
  const result = await run({ loader: true }); assert.equal(result.chains.length, 0);
  assert.equal(result.hero.badge, "לא זמין"); assert.equal(result.hero.badgeTone, "default"); assert.ok(result.banner);
  for (const metric of Object.values(result.metrics)) unavailable(metric);
  assert.ok(!JSON.stringify(result.warnings).includes("PRIVATE_LOADER_SENTINEL"));
});
test("denied admission cannot construct client or query", async () => { await run({ deny: true }); });
test("simultaneous non-readiness failures preserve healthy readiness", async () => {
  const result = await run({ failures: { 4: { kind: "returned", stale: true }, 5: { kind: "reject" }, 7: { kind: "returned" } } });
  assertQueries(result); healthyModels(result); assert.equal(result.hero.badge, "99/100");
  assert.equal(result.metrics.Observer.value, "94/100");
  assert.equal(result.counts.Deployments, "לא זמין"); assert.equal(result.counts["Audit events"], "לא זמין");
});
test("failed models and reviews do not erase healthy datasets/calibration/matrix/counts", async () => {
  const result = await run({ failures: { 0: { kind: "reject" }, 8: { kind: "returned", stale: true } } });
  for (const metric of Object.values(result.metrics)) unavailable(metric);
  for (const marker of ["DATASET_SENTINEL", "CALIBRATION_SENTINEL", "MATRIX_SENTINEL"]) assert.ok(result.text.includes(marker));
  for (const count of Object.values(result.counts)) assert.equal(count, "1");
});
test("measured model formulas retain retired, testing, drift and positive-only average behavior", async () => {
  const data = structuredClone(fixtures);
  data[0] = [
    { id: "a", lifecycle_status: "production", accuracy: 80, drift_status: "watch" },
    { id: "b", lifecycle_status: "testing", accuracy: 100, drift_status: "stable" },
    { id: "c", lifecycle_status: "retired", accuracy: 0, drift_status: "critical" }
  ];
  const result = await run({ data });
  assert.equal(result.metrics.Models.value, 2); assert.equal(result.metrics.Versions.value, 3);
  assert.equal(result.metrics.Testing.value, 1); assert.equal(result.metrics.Production.value, 1);
  assert.equal(result.metrics.Drift.value, 2); assert.equal(result.metrics.Drift.tone, "bad");
  assert.equal(result.metrics.Accuracy.value, "90%"); assert.equal(result.hero.badge, "85/100");
});
test("control policy text, links and action cards remain present without executing actions", async () => {
  const result = await run();
  for (const policy of ["Human approval required", "No automatic production promotion", "אין החלטות אוטומטיות", "אין אימון אוטומטי"]) assert.ok(result.text.includes(policy));
  assert.deepEqual(nodes(result.tree, "ActionCard").map((item) => item.props.href), [
    "/dashboard/admin/observer-calibration", "/dashboard/admin/observer-replay", "/dashboard/admin/observer-network", "/dashboard/admin/risk-intelligence", "/dashboard/admin/ai-events"
  ]);
});
