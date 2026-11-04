import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Real local modules; synthetic clients, JSX/hooks and effect spies only.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) {
  const filename = path.join(root, relative);
  assert.equal((fs.statSync(filename).flags ?? 0) & 0x40000000, 0);
  return fs.readFileSync(filename, "utf8");
}
const pageSource = source("app/dashboard/admin/observer-intelligence/page.tsx");
const panelSource = source("components/observer-intelligence-panel.tsx");
const helperSource = source("lib/admin-safe.ts");
const expected = [
  ["gardens", [["select", "id, name"], ["order", "name"], ["limit", 300]]],
  ["observer_situation_summaries", [["select", "*, gardens(name), observer_sites(name, site_type)"], ["order", "created_at", { ascending: false }], ["limit", 500]]],
  ["observer_correlated_events", [["select", "id,kindergarten_id,status,severity,confidence"], ["order", "created_at", { ascending: false }], ["limit", 500]]],
  ["camera_streams", [["select", "id,garden_id,kindergarten_id,status,stream_status,health_status,gateway_registration_status,active"], ["limit", 1000]]],
  ["kindergarten_learning_profiles", [["select", "*"], ["order", "updated_at", { ascending: false }], ["limit", 500]]]
];
const keys = ["gardens", "summaries", "correlatedEvents", "cameras", "learningProfiles"];
const fixtures = [
  [{ id: "garden-a", name: "Garden A" }, { id: "garden-b", name: "Garden B" }],
  [{ id: "summary-a", kindergarten_id: "garden-a", status: "open", severity: "critical", summary_type: "mock_summary", title: "SUMMARY_SENTINEL", summary: "BODY_SENTINEL", confidence: 0.9, related_event_ids: [], recommended_actions: ["HUMAN_REVIEW_SENTINEL"] }],
  [{ id: "correlated-a", kindergarten_id: "garden-a", status: "open", severity: "critical", confidence: 0.8 }],
  [{ id: "camera-a", garden_id: "garden-a", status: "offline", active: false }],
  [{ id: "learning-a", kindergarten_id: "garden-a", learning_maturity: "MATURE_SENTINEL", confidence_level: 0.92, anomaly_readiness_score: 0.88 }]
];
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
const plain = (value) => JSON.parse(JSON.stringify(value));
function compile(text) {
  const result = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(result.diagnostics.length, 0);
  return result.outputText;
}
const pageCode = compile(pageSource), panelCode = compile(panelSource), helperCode = compile(helperSource);
function load(code, resolve, { fetch = () => { throw Error("FORBIDDEN_EFFECT"); }, warnings = [] } = {}) {
  const exports = {};
  vm.runInNewContext(code, { exports, require: resolve, Date, Intl, fetch, process: { env: {} }, console: { warn: (...args) => warnings.push(args) } });
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
const unexpected = (id) => { throw Error(`UNEXPECTED_IMPORT:${id}`); };
async function page({ failures = {}, empty = false, nullData = false, loader = false, deny = false, data = fixtures } = {}) {
  let clients = 0;
  const chains = [], warnings = [];
  const helper = load(helperCode, unexpected, { warnings });
  const client = { from(table) {
    const index = chains.length;
    assert.equal(table, expected[index]?.[0]);
    const calls = []; chains.push([table, calls]); const query = {};
    for (const method of ["select", "order", "limit"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => {
      const failure = failures[index];
      if (failure?.kind === "reject") return Promise.reject(Error("PRIVATE_ERROR_SENTINEL")).then(resolve, reject);
      return Promise.resolve({ data: nullData ? null : empty || (failure && !failure.stale) ? [] : data[index], error: failure ? { message: "PRIVATE_ERROR_SENTINEL" } : null }).then(resolve, reject);
    };
    return query;
  } };
  const loaded = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => {
      assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0);
      if (deny) throw Error("DENIED");
    } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER_SENTINEL"); return client; } };
    return unexpected(id);
  });
  if (deny) { await assert.rejects(loaded.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
  const tree = await loaded.default();
  return { props: nodes(tree, "ObserverIntelligencePanel")[0].props, banner: nodes(tree, "AdminDataError")[0].props.message, clients, chains, warnings };
}
function panelRunner({ queuedTransitions = false, responseFactory } = {}) {
  const hooks = [], calls = [], transitions = [], stateQueue = [];
  let cursor = 0, dirty = false, rendering = false, deferState = false, props, refreshes = 0;
  const effects = new Map();
  function slot(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = initial(); return index; }
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const index = slot(() => ({ value: typeof initial === "function" ? initial() : initial }));
      const set = (value) => {
        const update = () => { const next = typeof value === "function" ? value(hooks[index].value) : value; if (!Object.is(next, hooks[index].value)) { hooks[index].value = next; dirty = true; } };
        if (deferState && !rendering) stateQueue.push(update); else update();
      };
      return [hooks[index].value, set];
    },
    useRef(initial) { return hooks[slot(() => ({ current: initial }))]; },
    useMemo(factory, deps) {
      const index = slot(() => ({}));
      if (!same(hooks[index].deps, deps)) hooks[index] = { deps, value: factory() };
      return hooks[index].value;
    },
    useLayoutEffect(effect, deps) {
      const index = slot(() => ({}));
      if (!same(hooks[index].deps, deps)) effects.set(index, { effect, deps });
    },
    useTransition() { slot(() => ({})); return [false, (work) => { if (queuedTransitions) transitions.push(work); else work(); }]; }
  };
  const loaded = load(panelCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "react") return react;
    if (id === "next/navigation") return { useRouter: () => ({ refresh: () => { refreshes++; } }) };
    if (id === "lucide-react") return new Proxy({}, { get: (_, name) => String(name) });
    return unexpected(id);
  }, { fetch: async (url, options) => {
    assert.equal(url, "/api/observer-intelligence"); assert.equal(options.method, "POST");
    assert.equal(options.headers["Content-Type"], "application/json");
    calls.push({ url, payload: JSON.parse(options.body) });
    return responseFactory ? responseFactory() : { ok: true, json: async () => ({}) };
  } });
  function render(next = props) {
    props = next; let tree;
    for (let i = 0; i < 12; i++) {
      cursor = 0; dirty = false; rendering = true;
      tree = loaded.ObserverIntelligencePanel(props); rendering = false;
      if (!dirty) break;
      assert.ok(i < 11, "RENDER_RECONCILIATION_LOOP");
    }
    for (const [index, pending] of effects) {
      hooks[index].cleanup?.(); hooks[index] = { deps: pending.deps, cleanup: pending.effect() };
    }
    effects.clear();
    const select = nodes(tree, "select")[0];
    return { tree, text: text(tree), select: select?.props,
      options: nodes(tree, "option").map((item) => item.props.value),
      metrics: nodes(tree, "article").filter((item) => item.props.className === "metric-card").map((item) => text(nodes(item, "strong")[0])),
      buttons: nodes(tree, "button").map((item) => ({ ...item.props, text: text(item) })),
      context: nodes(tree, "div").filter((item) => item.props.className === "risk-list").flatMap((item) => nodes(item.props.children, "div")).map(text)
    };
  }
  return { render, calls, transitions, stateQueue, get refreshes() { return refreshes; },
    deferState() { deferState = true; },
    flushState() { stateQueue.splice(0).forEach((work) => work()); },
    flushTransitions() { transitions.splice(0).forEach((work) => work()); },
    unmount() { for (const hook of hooks) hook.cleanup?.(); }
  };
}
const generate = (view) => view.buttons.find((button) => button.text === "יצירת סיכומי מצב mock");
const reviewing = (view) => view.buttons.find((button) => button.text === "בבדיקה");
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function assertQueries(result) { assert.equal(result.clients, 1); assert.deepEqual(plain(result.chains), expected); }
function changed(props, values) { return { ...props, ...values }; }

test("healthy page uses exact five queries and actual panel measured values", async () => {
  const result = await page(); assertQueries(result); assert.equal(result.banner, null);
  const runner = panelRunner(), view = runner.render(result.props);
  assert.deepEqual(view.metrics, ["1", "1", "1", "MATURE_SENTINEL"]);
  assert.deepEqual(view.context, ["Learning confidence 92%", "Anomaly readiness 88%", "Correlated events 1", "Parent auto notify לא פעיל"]);
  assert.equal(view.select.value, "garden-a"); assert.equal(generate(view).disabled, false); assert.equal(runner.calls.length, 0);
});
for (const [index, [table]] of expected.entries()) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) {
  test(`${table}: ${kind} ${stale ? "stale" : "empty"} data unavailable independently`, async () => {
    const result = await page({ failures: { [index]: { kind, stale } } }); assertQueries(result); assert.ok(result.banner);
    assert.equal(result.props.availability[keys[index]], false);
    for (const [i, key] of keys.entries()) if (i !== index && key !== "cameras") assert.deepEqual(plain(result.props[key]), fixtures[i]);
    const runner = panelRunner(), view = runner.render(result.props);
    if (index === 0) { assert.deepEqual(view.options, []); assert.equal(view.select.value, ""); assert.equal(generate(view).disabled, true); }
    else { assert.equal(view.select.value, "garden-a"); assert.equal(generate(view).disabled, false); }
    assert.deepEqual(view.metrics.slice(0, 2), index === 1 ? ["לא זמין", "לא זמין"] : ["1", "1"]);
    assert.equal(view.metrics[2], index === 3 ? "לא זמין" : "1");
    assert.equal(view.metrics[3], index === 4 ? "לא זמין" : index === 0 ? "new" : "MATURE_SENTINEL");
    assert.equal(view.text.includes("SUMMARY_SENTINEL"), index !== 1);
    assert.equal(view.buttons.filter((button) => button.text !== "יצירת סיכומי מצב mock").length, index === 1 ? 0 : 5);
    assert.equal(view.context[2], index === 2 ? "Correlated events לא זמין" : "Correlated events 1");
    if (index === 4) { assert.equal(view.context[0], "Learning confidence לא זמין"); assert.equal(view.context[1], "Anomaly readiness לא זמין"); }
    assert.deepEqual(plain(result.warnings), [["Admin Supabase query unavailable:", `observer intelligence ${index}`]]);
    assert.ok(!JSON.stringify(result.warnings).includes("PRIVATE_ERROR_SENTINEL")); assert.equal(runner.calls.length, 0);
  });
}
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} retains genuine zero/new metrics`, async () => {
  const result = await page({ empty: true, nullData }); assertQueries(result); assert.equal(result.banner, null);
  const view = panelRunner().render(result.props); assert.deepEqual(view.metrics, ["0", "0", "0", "new"]);
  assert.equal(view.context[0], "Learning confidence 0%"); assert.equal(view.context[1], "Anomaly readiness 0%"); assert.equal(view.context[2], "Correlated events 0");
  assert.equal(generate(view).disabled, true); assert.ok(view.text.includes("אין סיכומי תצפיתן עדיין"));
});
test("loader failure is unavailable and denied admission constructs nothing", async () => {
  const result = await page({ loader: true }); assert.equal(result.chains.length, 0); assert.ok(result.banner);
  const view = panelRunner().render(result.props); assert.deepEqual(view.metrics, ["לא זמין", "לא זמין", "לא זמין", "לא זמין"]);
  assert.ok(view.context.slice(0, 3).every((value) => value.includes("לא זמין"))); assert.equal(generate(view).disabled, true);
  await page({ deny: true });
});
test("mixed failures retain healthy cameras and learning", async () => {
  const result = await page({ failures: { 1: { kind: "reject" }, 2: { kind: "returned", stale: true } } });
  const view = panelRunner().render(result.props); assert.deepEqual(view.metrics, ["לא זמין", "לא זמין", "1", "MATURE_SENTINEL"]); assert.equal(generate(view).disabled, false);
});
test("camera warning policy remains unchanged across fallbacks and active flag", async () => {
  const data = structuredClone(fixtures);
  data[3] = [{ status: "online", health_status: "failed" }, { stream_status: "offline" }, { health_status: "error" }, { gateway_registration_status: "pending_gateway" }, { status: "online", active: false }, { status: "active" }];
  const result = await page({ data }); assert.equal(result.props.cameraWarnings, 4); assert.equal(panelRunner().render(result.props).metrics[2], "4");
});
test("removed selected destination reconciles immediately and captured actions cannot post", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  const current = runner.render(changed(props, { gardens: [fixtures[0][1]], fixedKindergartenId: "garden-b" }));
  assert.equal(current.select.value, "garden-b"); assert.deepEqual(current.options, ["garden-b"]);
  generate(old).onClick(); reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 0);
  generate(current).onClick(); await flush(); assert.deepEqual(runner.calls[0].payload, { action: "generate", kindergarten_id: "garden-b" });
});
test("garden availability A->failure->A denies old generation and review callbacks", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  runner.render(changed(props, { availability: { ...props.availability, gardens: false } })); runner.render(props);
  generate(old).onClick(); reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 0);
});
test("selection A->B->A rejects old callbacks despite identical final IDs", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  old.select.onChange({ target: { value: "garden-b" } }); const middle = runner.render();
  middle.select.onChange({ target: { value: "garden-a" } }); const current = runner.render();
  generate(old).onClick(); reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 0);
  reviewing(current).onClick(); await flush(); assert.equal(runner.calls.length, 1);
});
for (const change of ["unavailable", "removed", "replacement", "site"]) test(`old review denied after summary ${change}`, async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  const next = change === "unavailable" ? changed(props, { availability: { ...props.availability, summaries: false } })
    : changed(props, { summaries: change === "removed" ? [] : [{ ...fixtures[1][0], ...(change === "site" ? { kindergarten_id: "garden-b" } : { title: "REPLACED" }) }] });
  runner.render(next); reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 0);
  generate(old).onClick(); await flush(); assert.equal(runner.calls.length, 1, "independent valid destination stays usable");
});
test("summary A->failure->A cannot revive old review callback", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  runner.render(changed(props, { availability: { ...props.availability, summaries: false } })); runner.render(props);
  reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 0);
});
test("valid selection/callbacks/message survive reorder, unused metadata and independent failures", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 1);
  const next = changed(props, { gardens: [...props.gardens].reverse().map((garden) => ({ ...garden, name: "RENAMED" })), summaries: props.summaries.map((row) => ({ ...row, metadata: { unused: "NEW" } })), availability: { ...props.availability, cameras: false, correlatedEvents: false, learningProfiles: false } });
  const current = runner.render(next); assert.equal(current.select.value, "garden-a"); assert.ok(current.text.includes("נשמר."));
  generate(old).onClick(); reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 3);
});
for (const action of ["generate", "review"]) test(`queued ${action} rechecks before effect after refresh`, async () => {
  const { props } = await page(); const runner = panelRunner({ queuedTransitions: true }); const old = runner.render(props);
  (action === "generate" ? generate(old) : reviewing(old)).onClick(); assert.equal(runner.calls.length, 0);
  runner.render(action === "generate" ? changed(props, { gardens: [] }) : changed(props, { summaries: [] }));
  runner.flushTransitions(); await flush(); assert.equal(runner.calls.length, 0);
});
test("in-flight old response cannot refresh or replace current message", async () => {
  const { props } = await page(); let resolve;
  const runner = panelRunner({ responseFactory: () => new Promise((done) => { resolve = done; }) });
  const old = runner.render(props); reviewing(old).onClick(); assert.equal(runner.calls.length, 1);
  runner.render(changed(props, { summaries: [] })); resolve({ ok: true, json: async () => ({}) }); await flush();
  assert.equal(runner.refreshes, 0); assert.ok(!runner.render().text.includes("נשמר."));
});
test("deferred old state updaters are fenced after context replacement", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props); runner.deferState();
  reviewing(old).onClick(); await flush(); assert.ok(runner.stateQueue.length > 0);
  runner.render(changed(props, { summaries: [] })); runner.flushState(); assert.ok(!runner.render().text.includes("נשמר."));
});
test("unmount rejects captured Admin handlers", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props); runner.unmount();
  generate(old).onClick(); reviewing(old).onClick(); await flush(); assert.equal(runner.calls.length, 0);
});
test("current review buttons preserve all action payloads without executing server handlers", async () => {
  const { props } = await page(); const runner = panelRunner(); const view = runner.render(props);
  const statuses = ["reviewing", "handled", "dismissed", "escalated", "snoozed"];
  for (const button of view.buttons.slice(1)) { button.onClick(); await flush(); }
  assert.deepEqual(runner.calls.map((call) => call.payload), statuses.map((status) => ({ action: "review", id: "summary-a", status, review_notes: "Review אנושי. אין מסקנה אוטומטית." })));
});
test("garden and omitted-availability Admin retain legacy healthy/default contract", async () => {
  const { props } = await page();
  for (const role of ["garden", "admin"]) {
    const legacy = { ...props, role }; delete legacy.availability;
    const runner = panelRunner(); const view = runner.render(legacy);
    assert.deepEqual(view.metrics, ["1", "1", "1", "MATURE_SENTINEL"]);
    assert.equal(Boolean(view.select), role === "admin");
    generate(view).onClick(); await flush(); assert.deepEqual(runner.calls[0].payload, { action: "generate", kindergarten_id: "garden-a" });
    assert.ok(view.text.includes("אין מסקנה אוטומטית")); assert.ok(view.text.includes("אין האשמה"));
  }
});
