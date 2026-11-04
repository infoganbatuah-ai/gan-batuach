import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/helper/panel/domain; synthetic clients, JSX/hooks/form state and effects only.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) {
  const p = path.join(root, relative);
  assert.equal((fs.statSync(p).flags ?? 0) & 0x40000000, 0);
  return fs.readFileSync(p, "utf8");
}
function compile(text) {
  const result = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(result.diagnostics.length, 0); return result.outputText;
}
const pageCode = compile(source("app/dashboard/admin/observer-learning-advanced/page.tsx"));
const panelCode = compile(source("components/advanced-learning-dashboard.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const domainCode = compile(source("lib/domain/advanced-learning-engine.ts"));
const plain = (v) => JSON.parse(JSON.stringify(v));
const unexpected = (id) => { throw Error(`UNEXPECTED_IMPORT:${id}`); };
function load(code, resolve, { fetch = () => { throw Error("FORBIDDEN_EFFECT"); }, warnings = [] } = {}) {
  const exports = {};
  vm.runInNewContext(code, { exports, require: resolve, Date, Intl, fetch, process: { env: {} }, console: { warn: (...args) => warnings.push(args) } });
  return exports;
}
const domain = load(domainCode, unexpected);
const expected = [
  ["gardens", [["select", "id, name"], ["order", "name"], ["limit", 300]]],
  ["kindergarten_learning_profiles", [["select", "*"], ["order", "updated_at", { ascending: false }], ["limit", 300]]],
  ["site_behavior_baselines", [["select", "*"], ["order", "updated_at", { ascending: false }], ["limit", 800]]],
  ["camera_learning_profiles", [["select", "*, camera_streams(name)"], ["order", "updated_at", { ascending: false }], ["limit", 500]]],
  ["zone_learning_profiles", [["select", "*, camera_zones(name, zone_type)"], ["order", "updated_at", { ascending: false }], ["limit", 500]]],
  ["learning_feedback_signals", [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 500]]]
];
const keys = ["gardens", "learningProfiles", "baselines", "cameraProfiles", "zoneProfiles", "feedbackSignals"];
const fixtures = [
  [{ id: "garden-a", name: "Garden A" }, { id: "garden-b", name: "Garden B" }],
  [{ id: "profile-a", kindergarten_id: "garden-a", learning_maturity: "mature", confidence_level: 0.93, anomaly_readiness_score: 0.81 }, { id: "profile-b", kindergarten_id: "garden-b", learning_maturity: "learning", confidence_level: 0.24, anomaly_readiness_score: 0.12 }],
  Array.from({ length: 13 }, (_, i) => ({ id: `baseline-${i}`, kindergarten_id: "garden-a", baseline_type: `BASELINE_${i}`, confidence_level: 0.91, anomaly_readiness_score: 0.81, learning_maturity: "mature" })),
  [{ id: "camera-a", kindergarten_id: "garden-a" }, { id: "camera-b", kindergarten_id: "garden-b" }],
  [{ id: "zone-a", kindergarten_id: "garden-a" }],
  Array.from({ length: 15 }, (_, i) => ({ id: `feedback-${i}`, kindergarten_id: "garden-a", review_outcome: i % 3 === 0 ? "false_positive" : "confirmed", event_type: `FEEDBACK_${i}`, source_type: "mock", maturity_after: "mature", confidence_after: 0.93, confidence_delta: 0.04 }))
];
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
function nodes(value, type) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((v) => nodes(v, type));
  return [...(value.type === type ? [value] : []), ...Object.values(value.props ?? {}).flatMap((v) => nodes(v, type))];
}
function text(value) {
  if (value == null || typeof value === "boolean" || typeof value === "function") return "";
  if (typeof value !== "object") return String(value);
  return Array.isArray(value) ? value.map(text).join("") : text(value.props?.children);
}
async function page({ failures = {}, empty = false, nullData = false, loader = false, deny = false, data = fixtures } = {}) {
  let clients = 0; const chains = [], warnings = [];
  const helper = load(helperCode, unexpected, { warnings });
  const client = { from(table) {
    const i = chains.length, calls = [], query = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]);
    for (const name of ["select", "order", "limit"]) query[name] = (...args) => { calls.push([name, ...args]); return query; };
    query.then = (resolve, reject) => {
      const failure = failures[i];
      if (failure?.kind === "reject") return Promise.reject(Error("PRIVATE_QUERY_SENTINEL")).then(resolve, reject);
      return Promise.resolve({ data: nullData ? null : empty || failure && !failure.stale ? [] : data[i], error: failure ? { message: "PRIVATE_QUERY_SENTINEL" } : null }).then(resolve, reject);
    }; return query;
  } };
  const loaded = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => {
      assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED");
    } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER_SENTINEL"); return client; } };
    return unexpected(id);
  });
  if (deny) { await assert.rejects(loaded.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
  const tree = await loaded.default();
  return { props: nodes(tree, "AdvancedLearningDashboard")[0].props, banner: nodes(tree, "AdminDataError")[0].props.message, chains, clients, warnings };
}
function panelRunner({ responseFactory, queueTransitions = false } = {}) {
  const hooks = [], calls = [], transitions = [], queuedState = [], dom = new Map(), effects = new Map();
  let cursor = 0, dirty = false, rendering = false, deferState = false, props, refreshes = 0;
  function slot(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial(); return i; }
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = slot(() => ({ value: typeof initial === "function" ? initial() : initial }));
      return [hooks[i].value, (value) => {
        const update = () => { const next = typeof value === "function" ? value(hooks[i].value) : value; if (!Object.is(next, hooks[i].value)) { hooks[i].value = next; dirty = true; } };
        if (deferState && !rendering) queuedState.push(update); else update();
      }];
    },
    useRef(initial) { return hooks[slot(() => ({ current: initial }))]; },
    useMemo(factory, deps) { const i = slot(() => ({})); if (!same(hooks[i].deps, deps)) hooks[i] = { deps, value: factory() }; return hooks[i].value; },
    useLayoutEffect(effect, deps) { const i = slot(() => ({})); if (!same(hooks[i].deps, deps)) effects.set(i, { effect, deps }); },
    useTransition() { return [false, (work) => { if (queueTransitions) transitions.push(work); else work(); }]; }
  };
  const loaded = load(panelCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "react") return react;
    if (id === "next/navigation") return { useRouter: () => ({ refresh: () => { refreshes++; } }) };
    if (id === "lucide-react") return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/domain/advanced-learning-engine") return domain;
    return unexpected(id);
  }, { fetch: async (url, options) => {
    assert.equal(url, "/api/observer-learning-advanced"); assert.equal(options.method, "POST"); assert.equal(options.headers["Content-Type"], "application/json");
    const payload = JSON.parse(options.body); calls.push(payload); return responseFactory ? responseFactory(payload, calls.length) : ok();
  } });
  function render(next = props) {
    props = next; let tree;
    for (let i = 0; i < 16; i++) {
      cursor = 0; dirty = false; rendering = true; tree = loaded.AdvancedLearningDashboard(props); rendering = false;
      if (!dirty) break; assert.ok(i < 15, "RECONCILIATION_LOOP");
    }
    for (const [i, pending] of effects) { hooks[i].cleanup?.(); hooks[i] = { deps: pending.deps, cleanup: pending.effect() }; } effects.clear();
    const active = new Set();
    const forms = nodes(tree, "form").map((form, i) => {
      const key = i + ":" + form.key; active.add(key);
      if (!dom.has(key)) dom.set(key, Object.fromEntries([...nodes(form, "input"), ...nodes(form, "select")].filter((n) => n.props.name).map((n) => [n.props.name, n.props.defaultValue ?? n.props.value ?? ""])));
      const values = { ...dom.get(key), kindergarten_id: nodes(form, "input").find((n) => n.props.name === "kindergarten_id")?.props.value };
      return { ...form.props, key: form.key, domKey: key, values, disabled: nodes(form, "button")[0].props.disabled };
    });
    for (const key of dom.keys()) if (!active.has(key)) dom.delete(key);
    const articles = nodes(tree, "article");
    return { tree, text: text(tree), forms, select: nodes(tree, "select").find((n) => !n.props.name)?.props,
      metrics: articles.filter((n) => n.props.className === "metric-card").map((n) => text(nodes(n, "strong")[0])),
      counts: articles.filter((n) => ["Camera profiles", "Zone profiles", "Reviewed signals"].includes(text(nodes(n, "h2")[0]))).map((n) => text(nodes(n, "strong")[0])),
      readiness: nodes(tree, "b").map(text), success: nodes(tree, "div").filter((n) => n.props.className === "success-banner").map(text), errors: nodes(tree, "div").filter((n) => n.props.className === "error-banner").map(text)
    };
  }
  return { render, calls, transitions, queuedState, get refreshes() { return refreshes; },
    edit(form, name, value) { dom.get(form.domKey)[name] = value; },
    immediate(work) { const previous = deferState; deferState = false; try { return work(); } finally { deferState = previous; } },
    flushTransitions() { transitions.splice(0).forEach((work) => work()); },
    deferState() { deferState = true; }, flushState() { queuedState.splice(0).forEach((work) => work()); },
    unmount() { hooks.forEach((hook) => hook.cleanup?.()); }
  };
}
function fd(values = {}, onGet) { const reads = []; return { reads, get(name) { reads.push(name); onGet?.(name); return values[name] ?? null; } }; }
const formData = (form, values = {}) => fd({ ...form.values, ...values });
const ok = () => ({ ok: true, json: async () => ({ data: {} }) });
const bad = () => ({ ok: false, json: async () => ({ error: "SYNTHETIC_ACTION_FAILURE" }) });
const settle = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
const select = (runner, view, props, id) => runner.immediate(() => { view.select.onChange({ target: { value: id } }); return runner.render(props); });
function assertQueries(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); }

test("actual page/helper/panel/domain retain exact chains, measurements, labels and list bounds", async () => {
  const r = await page(); assertQueries(r); assert.equal(r.banner, null); const runner = panelRunner(), v = runner.render(r.props);
  assert.deepEqual(v.metrics, ["mature", "93%", "81%", "33%"]); assert.deepEqual(v.counts, ["1", "1", "15"]); assert.ok(v.readiness.every((n) => n === "81%"));
  assert.ok(v.text.includes("BASELINE_9")); assert.ok(!v.text.includes("BASELINE_10")); assert.ok(v.text.includes("FEEDBACK_11")); assert.ok(!v.text.includes("FEEDBACK_12"));
  assert.ok(v.forms.every((f) => !f.disabled)); assert.notEqual(v.forms[0].key, v.forms[1].key); assert.equal(runner.calls.length, 0);
  assert.deepEqual(plain(domain.calculateLearningCalibration({ reviewOutcome: "confirmed" })), { confidenceDelta: 0.04, confidenceAfter: 0.16, anomalyReadinessAfter: 0.13, maturityAfter: "new" });
  assert.equal(nodes(v.tree, "option").length, fixtures[0].length + Object.keys(domain.baselineLabels).length + 7 + 6);
});
for (const [index, [table]] of expected.entries()) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`${table}: ${kind}/${stale ? "stale" : "empty"} discarded independently`, async () => {
  const r = await page({ failures: { [index]: { kind, stale } } }); assertQueries(r); assert.ok(r.banner); assert.equal(r.props.availability[keys[index]], false);
  for (const [i, key] of keys.entries()) assert.deepEqual(plain(r.props[key]), i === index ? [] : fixtures[i]);
  const runner = panelRunner(), v = runner.render(r.props); const unknown = index === 0;
  assert.deepEqual(v.metrics.slice(0, 3), unknown || index === 1 ? ["לא זמין", "לא זמין", "לא זמין"] : ["mature", "93%", "81%"]);
  assert.equal(v.metrics[3], unknown || index === 5 ? "לא זמין" : "33%"); assert.ok(v.readiness.every((n) => n === (unknown || index === 1 ? "לא זמין" : "81%")));
  assert.deepEqual(v.counts, [unknown || index === 3 ? "לא זמין" : "1", unknown || index === 4 ? "לא זמין" : "1", unknown || index === 5 ? "לא זמין" : "15"]);
  assert.equal(v.text.includes("BASELINE_0"), !unknown && index !== 2); assert.equal(v.text.includes("FEEDBACK_0"), !unknown && index !== 5);
  assert.ok(v.forms.every((f) => f.disabled === unknown)); assert.deepEqual(plain(r.warnings), [["Admin Supabase query unavailable:", `advanced observer learning ${index}`]]);
  assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE_QUERY_SENTINEL")); assert.equal(runner.calls.length, 0);
});
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} defaults retain zero counts and unmeasured rate`, async () => {
  const r = await page({ empty: true, nullData }); assertQueries(r); assert.equal(r.banner, null); const v = panelRunner().render(r.props);
  assert.deepEqual(v.metrics, ["new", "0%", "0%", "טרם נמדד"]); assert.deepEqual(v.counts, ["0", "0", "0"]); assert.ok(v.forms.every((f) => f.disabled)); assert.equal(v.forms[0].values.confidence_level, "0.18");
});
test("loader unavailable and admission denied before client creation", async () => {
  const r = await page({ loader: true }); assert.equal(r.chains.length, 0); assert.ok(r.banner); const v = panelRunner().render(r.props);
  assert.deepEqual(v.metrics, Array(4).fill("לא זמין")); assert.deepEqual(v.counts, Array(3).fill("לא זמין")); assert.ok(v.forms.every((f) => f.disabled)); await page({ deny: true });
});
test("paired failures retain healthy sources only with authoritative valid choices", async () => {
  const r = await page({ failures: { 1: { kind: "reject" }, 4: { kind: "returned", stale: true } } }), v = panelRunner().render(r.props);
  assert.deepEqual(v.metrics, ["לא זמין", "לא זמין", "לא זמין", "33%"]); assert.deepEqual(v.counts, ["1", "לא זמין", "15"]); assert.ok(v.text.includes("BASELINE_0")); assert.ok(v.forms.every((f) => !f.disabled));
});
test("B uses B profile and own lists; no B profile means defaults not A; first matching row wins", async () => {
  const r = await page(), runner = panelRunner(); let v = runner.render(r.props); v = select(runner, v, r.props, "garden-b");
  assert.deepEqual(v.metrics, ["learning", "24%", "12%", "טרם נמדד"]); assert.deepEqual(v.counts, ["1", "0", "0"]); assert.ok(!v.text.includes("BASELINE_0"));
  v = runner.render({ ...r.props, learningProfiles: [fixtures[1][0]] }); assert.deepEqual(v.metrics.slice(0, 3), ["new", "0%", "0%"]);
  v = runner.render({ ...r.props, learningProfiles: [fixtures[1][1], { ...fixtures[1][1], confidence_level: 0.99 }] }); assert.equal(v.metrics[1], "24%");
});
test("observed nonempty zero false positives remains measured 0 percent", async () => {
  const r = await page(), v = panelRunner().render({ ...r.props, feedbackSignals: [{ ...fixtures[5][0], review_outcome: "confirmed" }] }); assert.equal(v.metrics[3], "0%"); assert.equal(v.counts[2], "1");
});
test("empty choices never turn scoped rows into global data", async () => {
  const r = await page(), v = panelRunner().render({ ...r.props, gardens: [] }); assert.equal(v.select.value, ""); assert.deepEqual(v.metrics, ["new", "0%", "0%", "טרם נמדד"]); assert.deepEqual(v.counts, ["0", "0", "0"]); assert.ok(!v.text.includes("FEEDBACK_0"));
});
test("selection target changes reset both forms, not unrelated reads/reorder/rename/metadata", async () => {
  const r = await page(), runner = panelRunner(); let v = runner.render(r.props); const initial = v.forms.map((f) => f.key);
  runner.edit(v.forms[0], "confidence_level", "0.99"); runner.edit(v.forms[1], "event_type", "A_TYPED");
  v = runner.render({ ...r.props, gardens: [...r.props.gardens].reverse().map((g) => ({ ...g, name: "Renamed", unused: "metadata" })), baselines: [], availability: { ...r.props.availability, cameraProfiles: false } });
  assert.equal(v.select.value, "garden-a"); assert.deepEqual(v.forms.map((f) => f.key), initial); assert.equal(v.forms[0].values.confidence_level, "0.99"); assert.equal(v.forms[1].values.event_type, "A_TYPED");
  v = select(runner, v, r.props, "garden-b"); assert.ok(v.forms.every((f, i) => f.key !== initial[i] && f.values.kindergarten_id === "garden-b")); assert.equal(v.forms[0].values.confidence_level, "0.18"); assert.equal(v.forms[0].values.anomaly_readiness_score, "0.12"); assert.equal(v.forms[1].values.event_type, "mock_reviewed_event");
});
for (const unavailable of [false, true]) test(`removed/failed choices reconcile target and captured actions read nothing (${unavailable})`, async () => {
  const r = await page(), runner = panelRunner(); const a = runner.render(r.props);
  const v = runner.render({ ...r.props, gardens: [fixtures[0][1]], availability: { ...r.props.availability, gardens: !unavailable } });
  assert.equal(v.select.value, unavailable ? "" : "garden-b"); assert.ok(v.forms.every((f) => f.disabled === unavailable));
  for (const f of a.forms) { const d = formData(f); f.action(d); assert.equal(d.reads.length, 0); } await settle(); assert.equal(runner.calls.length, 0);
});
for (const i of [0, 1]) test(`form${i}: target tamper rejected before mutable reads; stale A-B-A denied`, async () => {
  const r = await page(), runner = panelRunner(); const a = runner.render(r.props); const wrong = formData(a.forms[i], { kindergarten_id: "garden-b" }); a.forms[i].action(wrong); assert.deepEqual(wrong.reads, ["kindergarten_id"]);
  const b = select(runner, a, r.props, "garden-b"); const again = select(runner, b, r.props, "garden-a"); assert.notEqual(a.forms[i].key, again.forms[i].key);
  const stale = formData(a.forms[i]); a.forms[i].action(stale); assert.equal(stale.reads.length, 0); assert.equal(runner.calls.length, 0);
});
for (const i of [0, 1]) for (const field of ["kindergarten_id", i === 0 ? "confidence_level" : "event_type"]) test(`form${i}: reentrant ${field} context change cannot post`, async () => {
  const r = await page(), runner = panelRunner(); const a = runner.render(r.props); let changed = false;
  const d = fd(a.forms[i].values, (name) => { if (name === field && !changed) { changed = true; select(runner, a, r.props, "garden-b"); } }); a.forms[i].action(d); await settle(); assert.equal(runner.calls.length, 0);
  if (field === "kindergarten_id") assert.deepEqual(d.reads, ["kindergarten_id"]);
});
for (const i of [0, 1]) test(`form${i}: queued transition from replaced context denied`, async () => {
  const r = await page(), runner = panelRunner({ queueTransitions: true }); const a = runner.render(r.props); a.forms[i].action(formData(a.forms[i])); assert.equal(runner.transitions.length, 1); select(runner, a, r.props, "garden-b"); runner.flushTransitions(); await settle(); assert.equal(runner.calls.length, 0); assert.equal(runner.refreshes, 0);
});
test("healthy valid actions preserve exact defaults/payloads and independent form feedback", async () => {
  const r = await page(), runner = panelRunner(); const v = runner.render(r.props); for (const f of v.forms) f.action(formData(f)); await settle();
  assert.deepEqual(runner.calls, [{ action: "create_mock_baseline", kindergarten_id: "garden-a", baseline_type: "normal_activity_levels", confidence_level: "0.18", anomaly_readiness_score: "0.12" }, { action: "record_feedback", kindergarten_id: "garden-a", source_type: "mock", event_type: "mock_reviewed_event", review_outcome: "confirmed" }]);
  const done = runner.render(); assert.equal(done.success.length, 2); assert.ok(done.forms.every((f) => !f.disabled)); assert.equal(runner.refreshes, 2);
});
for (const i of [0, 1]) for (const response of ["success", "error"]) test(`form${i}: old ${response} cannot refresh or overwrite newer context busy/messages`, async () => {
  const first = deferred(), second = deferred(); const r = await page(), runner = panelRunner({ responseFactory: (_, n) => n === 1 ? first.promise : second.promise });
  const a = runner.render(r.props); a.forms[i].action(formData(a.forms[i])); const b = select(runner, a, r.props, "garden-b"); b.forms[i].action(formData(b.forms[i])); assert.equal(runner.render().forms[i].disabled, true);
  first.resolve(response === "success" ? ok() : bad()); await settle(); let v = runner.render(); assert.equal(v.forms[i].disabled, true); assert.equal(v.errors.length + v.success.length, 0); assert.equal(runner.refreshes, 0);
  second.resolve(ok()); await settle(); v = runner.render(); assert.equal(v.forms[i].disabled, false); assert.equal(v.success.length, 1); assert.equal(runner.refreshes, 1);
});
test("new operation sequence owns busy state even within same context", async () => {
  const first = deferred(), second = deferred(); const r = await page(), runner = panelRunner({ responseFactory: (_, n) => n === 1 ? first.promise : second.promise }); const v = runner.render(r.props);
  v.forms[0].action(formData(v.forms[0])); v.forms[0].action(formData(v.forms[0])); first.resolve(bad()); await settle(); assert.equal(runner.render().forms[0].disabled, true); assert.equal(runner.render().errors.length, 0);
  second.resolve(ok()); await settle(); assert.equal(runner.render().forms[0].disabled, false); assert.equal(runner.refreshes, 1);
});
test("independent baseline/feedback operations do not clear each other's busy ownership", async () => {
  const first = deferred(), second = deferred(); const r = await page(), runner = panelRunner({ responseFactory: (_, n) => n === 1 ? first.promise : second.promise }); const a = runner.render(r.props);
  a.forms[0].action(formData(a.forms[0])); a.forms[1].action(formData(a.forms[1])); first.resolve(ok()); await settle(); const v = runner.render(); assert.equal(v.forms[0].disabled, false); assert.equal(v.forms[1].disabled, true); second.resolve(ok()); await settle();
});
test("deferred settlement state cannot overwrite another context; unmount prevents refresh", async () => {
  const r = await page(), work = deferred(), runner = panelRunner({ responseFactory: () => work.promise }); const a = runner.render(r.props); a.forms[0].action(formData(a.forms[0])); runner.deferState(); work.resolve(ok()); await settle(); const b = select(runner, a, r.props, "garden-b"); runner.flushState(); const v = runner.render(); assert.equal(v.success.length, 0); assert.equal(v.forms[0].disabled, false); assert.equal(b.forms[0].key, v.forms[0].key);
  const pending = deferred(), other = panelRunner({ responseFactory: () => pending.promise }), x = other.render(r.props); x.forms[1].action(formData(x.forms[1])); other.unmount(); pending.resolve(ok()); await settle(); assert.equal(other.refreshes, 0);
});
for (const role of ["garden", "admin"]) test(`omitted-availability ${role} legacy defaults and fixed-context contract unchanged`, async () => {
  const props = { role, kindergartenId: "garden-b", learningProfiles: [fixtures[1][1]], baselines: [], cameraProfiles: [], zoneProfiles: [], feedbackSignals: [] }, runner = panelRunner(); const v = runner.render(props);
  assert.deepEqual(v.metrics, ["learning", "24%", "12%", "0%"]); assert.deepEqual(v.counts, ["0", "0", "0"]); assert.ok(v.forms.every((f) => !f.disabled && f.key == null));
  runner.edit(v.forms[1], "event_type", "LEGACY_TYPED"); assert.equal(runner.render({ ...props, unused: "metadata" }).forms[1].values.event_type, "LEGACY_TYPED");
});
test("legacy omitted context retains historical empty/default and fallback semantics", () => {
  const empty = panelRunner().render({ role: "garden" }); assert.deepEqual(empty.metrics, ["new", "0%", "0%", "0%"]); assert.ok(empty.forms.every((f) => !f.disabled));
  const legacy = panelRunner().render({ role: "garden", kindergartenId: "garden-b", learningProfiles: [fixtures[1][0]] }); assert.equal(legacy.metrics[1], "93%");
});
test("distinct domain hook added exactly once without replacing security gates", () => {
  const c = JSON.parse(source("config/digital-observer-ci-gates.json")); const matches = c.domain.filter((entry) => entry.name === "advanced-learning-query-boundary"); assert.equal(matches.length, 1); assert.deepEqual(matches[0].args, ["--test", "scripts/qa/check-advanced-learning-query-boundary.mjs"]);
});
