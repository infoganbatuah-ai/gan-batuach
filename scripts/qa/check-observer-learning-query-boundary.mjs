import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/helper/dashboard; synthetic clients, JSX/hooks/forms and effects.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) {
  const p = path.join(root, relative);
  assert.equal((fs.statSync(p).flags ?? 0) & 0x40000000, 0);
  return fs.readFileSync(p, "utf8");
}
function compile(text) {
  const compiled = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(compiled.diagnostics.length, 0); return compiled.outputText;
}
const pageCode = compile(source("app/dashboard/admin/observer-learning/page.tsx"));
const panelCode = compile(source("components/observer-learning-dashboard.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const expected = [
  ["gardens", [["select", "id, name"], ["order", "name"], ["limit", 200]]],
  ["kindergarten_learning_profiles", [["select", "*"], ["order", "updated_at", { ascending: false }], ["limit", 200]]],
  ["kindergarten_routine_configs", [["select", "*"], ["order", "updated_at", { ascending: false }], ["limit", 200]]],
  ["camera_zones", [["select", "*, camera_streams(name)"], ["order", "created_at", { ascending: false }], ["limit", 200]]],
  ["kindergarten_learning_signals", [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 200]]],
  ["kindergarten_risk_profiles", [["select", "*"], ["order", "calculated_at", { ascending: false }], ["limit", 200]]]
];
const keys = ["gardens", "learningProfiles", "routines", "zones", "signals", "riskProfiles"];
const fixtures = [
  [{ id: "garden-a", name: "Garden A" }, { id: "garden-b", name: "Garden B" }],
  [{ id: "profile-a", kindergarten_id: "garden-a", learning_status: "PROFILE_A", baseline_version: "BASELINE_A", confidence_level: 0.91 }, { id: "profile-b", kindergarten_id: "garden-b", learning_status: "PROFILE_B", baseline_version: "BASELINE_B", confidence_level: 0.42 }],
  [{ id: "routine-a", kindergarten_id: "garden-a", opening_hours: { start: "07:07", end: "16:16" } }, { id: "routine-b", kindergarten_id: "garden-b", opening_hours: { start: "09:09", end: "18:18" } }],
  [{ id: "zone-a", kindergarten_id: "garden-a", name: "ZONE_A", zone_type: "classroom", is_restricted: false, camera_streams: { name: "CAMERA_A" } }],
  Array.from({ length: 15 }, (_, i) => ({ id: `signal-${i}`, kindergarten_id: i % 2 ? "garden-b" : "garden-a", signal_type: `SIGNAL_${i}`, confidence_level: 0.91, baseline_version: "SIGNAL_BASELINE" })),
  [{ id: "risk-a", kindergarten_id: "garden-a", attendance_score: 11, pickup_score: 22, safety_score: 77, supervision_score: 33, camera_coverage_score: 44 }, { id: "risk-b", kindergarten_id: "garden-b", attendance_score: 1, pickup_score: 2, safety_score: 5, supervision_score: 3, camera_coverage_score: 4 }]
];
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
const plain = (value) => JSON.parse(JSON.stringify(value));
const unexpected = (id) => { throw Error(`UNEXPECTED_IMPORT:${id}`); };
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
async function page({ failures = {}, empty = false, nullData = false, loader = false, deny = false, data = fixtures } = {}) {
  let clients = 0; const chains = [], warnings = [];
  const helper = load(helperCode, unexpected, { warnings });
  const client = { from(table) {
    const index = chains.length; assert.equal(table, expected[index]?.[0]); const calls = []; chains.push([table, calls]); const query = {};
    for (const method of ["select", "order", "limit"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => {
      const failure = failures[index];
      if (failure?.kind === "reject") return Promise.reject(Error("PRIVATE_QUERY_SENTINEL")).then(resolve, reject);
      return Promise.resolve({ data: nullData ? null : empty || (failure && !failure.stale) ? [] : data[index], error: failure ? { message: "PRIVATE_QUERY_SENTINEL" } : null }).then(resolve, reject);
    };
    return query;
  } };
  const loaded = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
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
  return { props: nodes(tree, "ObserverLearningDashboard")[0].props, banner: nodes(tree, "AdminDataError")[0].props.message, clients, chains, warnings };
}
function panelRunner({ responseFactory } = {}) {
  const hooks = [], calls = [], queuedState = [], dom = new Map();
  let cursor = 0, dirty = false, rendering = false, deferState = false, props;
  const effects = new Map();
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
    useLayoutEffect(effect, deps) { const i = slot(() => ({})); if (!same(hooks[i].deps, deps)) effects.set(i, { effect, deps }); }
  };
  const loaded = load(panelCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "react") return react;
    return unexpected(id);
  }, { fetch: async (url, options) => {
    assert.equal(url, "/api/observer-learning"); assert.equal(options.method, "POST"); assert.equal(options.headers["Content-Type"], "application/json");
    const payload = JSON.parse(options.body); calls.push(payload);
    if (responseFactory) return responseFactory(payload, calls.length);
    return { ok: true, json: async () => ({ data: payload.action === "update_zone" ? { zone: { ...fixtures[3][0], id: payload.zone_id, name: payload.name, zone_type: payload.zone_type, is_restricted: payload.is_restricted } } : {} }) };
  } });
  function render(next = props) {
    props = next; let tree;
    for (let i = 0; i < 16; i++) {
      cursor = 0; dirty = false; rendering = true; tree = loaded.ObserverLearningDashboard(props); rendering = false;
      if (!dirty) break; assert.ok(i < 15, "RECONCILIATION_LOOP");
    }
    for (const [i, pending] of effects) { hooks[i].cleanup?.(); hooks[i] = { deps: pending.deps, cleanup: pending.effect() }; }
    effects.clear();
    const forms = nodes(tree, "form"), active = new Set();
    function bind(form, kind) {
      const key = kind + ":" + form.key; active.add(key);
      if (!dom.has(key)) dom.set(key, Object.fromEntries([...nodes(form, "input"), ...nodes(form, "select")].filter((n) => n.props.name).map((n) => [n.props.name, n.props.type === "checkbox" ? n.props.defaultChecked ? "on" : null : n.props.defaultValue ?? n.props.value ?? ""])));
      const values = { ...dom.get(key) };
      const target = nodes(form, "select").find((n) => n.props.name === "kindergarten_id")?.props.value ?? nodes(form, "input").find((n) => n.props.name === "kindergarten_id")?.props.value;
      if (target !== undefined) values.kindergarten_id = target;
      return { ...form.props, key: form.key, domKey: key, values, disabled: nodes(form, "button")[0].props.disabled };
    }
    const routineForm = bind(forms.find((form) => form.props.className === "card form compact-form"), "routine");
    const zoneForms = forms.filter((form) => form.props.className === "card procedure-card").map((form) => bind(form, "zone"));
    for (const key of dom.keys()) if (!active.has(key)) dom.delete(key);
    return { tree, text: text(tree), routineForm, zoneForms,
      select: nodes(tree, "select").find((n) => n.props.name === "kindergarten_id")?.props,
      metrics: nodes(tree, "article").filter((n) => n.props.className === "card metric-card").map((n) => text(nodes(n, "strong")[0])),
      risks: nodes(tree, "div").filter((n) => n.props.className?.startsWith("risk-score-card ")).map((n) => ({ value: text(nodes(n, "strong")[0]), tone: n.props.className, bars: nodes(n, "i").length }))
    };
  }
  return { render, calls, queuedState,
    edit(form, name, value) { dom.get(form.domKey)[name] = value; },
    deferState() { deferState = true; }, flushState() { queuedState.splice(0).forEach((work) => work()); },
    unmount() { hooks.forEach((hook) => hook.cleanup?.()); }
  };
}
function fd(values = {}, onGet) {
  const reads = []; return { reads, get(name) { reads.push(name); onGet?.(name); return values[name] ?? null; } };
}
const formData = (form, values = {}) => fd({ ...form.values, ...values });
const change = (props, values) => ({ ...props, ...values });
function assertQueries(result) { assert.equal(result.clients, 1); assert.deepEqual(plain(result.chains), expected); }
const ok = (data = {}) => ({ ok: true, json: async () => ({ data }) });
const bad = (error = "Synthetic failure") => ({ ok: false, json: async () => ({ error }) });

test("healthy actual page/dashboard preserves six exact chains and initial measurements", async () => {
  const result = await page(); assertQueries(result); assert.equal(result.banner, null);
  const runner = panelRunner(), view = runner.render(result.props);
  assert.deepEqual(view.metrics, ["PROFILE_A", "BASELINE_A", "91%", "1"]); assert.equal(view.routineForm.values.opening_start, "07:07");
  assert.equal(view.risks[2].value, "77"); assert.equal(view.zoneForms.length, 1); assert.equal(view.routineForm.disabled, false);
  assert.ok(view.text.includes("SIGNAL_11")); assert.ok(!view.text.includes("SIGNAL_12")); assert.equal(runner.calls.length, 0);
});
for (const [index, [table]] of expected.entries()) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) {
  test(`${table}: ${kind} ${stale ? "stale" : "empty"} is unavailable independently`, async () => {
    const result = await page({ failures: { [index]: { kind, stale } } }); assertQueries(result); assert.ok(result.banner);
    assert.equal(result.props.availability[keys[index] === "riskProfiles" ? "risks" : keys[index]], false);
    for (const [i, key] of keys.entries()) assert.deepEqual(plain(result.props[key]), i === index ? [] : fixtures[i]);
    const runner = panelRunner(), view = runner.render(result.props);
    assert.deepEqual(view.metrics.slice(0, 3), [0, 1].includes(index) ? ["לא זמין", "לא זמין", "לא זמין"] : ["PROFILE_A", "BASELINE_A", "91%"]);
    assert.equal(view.metrics[3], index === 3 ? "לא זמין" : "1"); assert.equal(view.zoneForms.length, index === 3 ? 0 : 1);
    assert.equal(view.routineForm.disabled, index === 0 || index === 2);
    assert.equal(view.routineForm.values.opening_start, index === 0 || index === 2 ? undefined : "07:07");
    assert.ok(view.risks.every((risk) => index === 0 || index === 5 ? risk.value === "לא זמין" && risk.tone === "risk-score-card default" && risk.bars === 0 : risk.value !== "לא זמין"));
    assert.equal(view.text.includes("SIGNAL_0"), index !== 4);
    assert.deepEqual(plain(result.warnings), [["Admin Supabase query unavailable:", `admin observer learning ${index}`]]);
    assert.ok(!JSON.stringify(result.warnings).includes("PRIVATE_QUERY_SENTINEL")); assert.equal(runner.calls.length, 0);
  });
}
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} preserves defaults without permitting unknown target mutation`, async () => {
  const result = await page({ empty: true, nullData }); assertQueries(result); assert.equal(result.banner, null);
  const view = panelRunner().render(result.props); assert.deepEqual(view.metrics, ["not_started", "v0_mock", "0%", "0"]);
  assert.equal(view.routineForm.values.opening_start, "07:30"); assert.equal(view.routineForm.disabled, true); assert.ok(view.risks.every((risk) => risk.value === "0" && risk.tone === "risk-score-card good"));
});
test("loader failure is unavailable and denied admission never creates client/query", async () => {
  const result = await page({ loader: true }); assert.equal(result.chains.length, 0); assert.ok(result.banner);
  const view = panelRunner().render(result.props); assert.deepEqual(view.metrics, ["לא זמין", "לא זמין", "לא זמין", "לא זמין"]);
  assert.equal(view.routineForm.disabled, true); assert.equal(view.zoneForms.length, 0); assert.ok(view.risks.every((risk) => risk.value === "לא זמין"));
  await page({ deny: true });
});
test("selected B binds B profile/routine/risk and retains global zones/signals", async () => {
  const { props } = await page(); const runner = panelRunner(); const a = runner.render(props);
  runner.edit(a.routineForm, "opening_start", "06:06"); a.select.onChange({ target: { value: "garden-b" } }); const b = runner.render();
  assert.equal(b.select.value, "garden-b"); assert.deepEqual(b.metrics, ["PROFILE_B", "BASELINE_B", "42%", "1"]);
  assert.equal(b.routineForm.values.opening_start, "09:09"); assert.notEqual(b.routineForm.key, a.routineForm.key); assert.equal(b.risks[2].value, "5");
  assert.ok(b.text.includes("CAMERA_A")); assert.ok(b.text.includes("SIGNAL_0"));
});
test("missing healthy B row never borrows A; ordered first match remains canonical", async () => {
  const { props } = await page(); const runner = panelRunner(); const a = runner.render(change(props, { learningProfiles: [fixtures[1][0]], routines: [fixtures[2][0]], riskProfiles: [fixtures[5][0]] }));
  a.select.onChange({ target: { value: "garden-b" } }); const b = runner.render();
  assert.deepEqual(b.metrics.slice(0, 3), ["not_started", "v0_mock", "0%"]); assert.equal(b.routineForm.values.opening_start, "07:30"); assert.equal(b.risks[2].value, "0");
  const first = panelRunner().render(change(props, { routines: [fixtures[2][0], { ...fixtures[2][0], opening_hours: { start: "22:22" } }] })); assert.equal(first.routineForm.values.opening_start, "07:07");
});
test("valid choice and in-progress fields survive reorder/rename/unused metadata and unrelated source refresh", async () => {
  const { props } = await page(); const runner = panelRunner(); const a = runner.render(props);
  runner.edit(a.routineForm, "opening_start", "06:06"); runner.edit(a.zoneForms[0], "name", "TYPED_ZONE");
  const next = change(props, { gardens: [...props.gardens].reverse().map((g) => ({ ...g, name: "Renamed" })), routines: props.routines.map((r) => ({ ...r, unused: { revised: true } })), zones: props.zones.map((z) => ({ ...z, metadata: { unused: true } })), signals: [] });
  const refreshed = runner.render(next); assert.equal(refreshed.select.value, "garden-a"); assert.equal(refreshed.routineForm.key, a.routineForm.key); assert.equal(refreshed.routineForm.values.opening_start, "06:06"); assert.equal(refreshed.zoneForms[0].values.name, "TYPED_ZONE");
  await a.routineForm.action(formData(refreshed.routineForm)); assert.equal(runner.calls[0].opening_start, "06:06");
});
test("authoritative routine update remounts defaults, removing old edits and handlers", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props); runner.edit(old.routineForm, "opening_start", "06:06");
  const next = runner.render(change(props, { routines: [{ ...fixtures[2][0], opening_hours: { start: "08:08" } }, fixtures[2][1]] }));
  assert.equal(next.routineForm.values.opening_start, "08:08"); assert.notEqual(next.routineForm.key, old.routineForm.key);
  const data = formData(old.routineForm); await old.routineForm.action(data); assert.deepEqual(data.reads, []); assert.equal(runner.calls.length, 0);
});
for (const mode of ["removed", "failed", "routine-failed"]) test(`routine ${mode} context blocks captured handlers before reads`, async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  const next = mode === "removed" ? change(props, { gardens: [fixtures[0][1]] }) : change(props, { availability: { ...props.availability, [mode === "failed" ? "gardens" : "routines"]: false } });
  runner.render(next); const data = formData(old.routineForm); await old.routineForm.action(data); assert.deepEqual(data.reads, []); assert.equal(runner.calls.length, 0);
});
test("submitted routine target validated before mutable fields", async () => {
  const { props } = await page(); const runner = panelRunner(); const view = runner.render(props); const data = formData(view.routineForm, { kindergarten_id: "garden-b" });
  await view.routineForm.action(data); assert.deepEqual(data.reads, ["kindergarten_id"]); assert.equal(runner.calls.length, 0);
});
test("routine selection A->B->A cannot revive old form", async () => {
  const { props } = await page(); const runner = panelRunner(); const a = runner.render(props); a.select.onChange({ target: { value: "garden-b" } }); const b = runner.render(); b.select.onChange({ target: { value: "garden-a" } }); runner.render();
  const data = formData(a.routineForm); await a.routineForm.action(data); assert.deepEqual(data.reads, []); assert.equal(runner.calls.length, 0);
});
for (const mode of ["deleted", "replaced", "unavailable", "ABA"]) test(`zone ${mode} reconciliation denies captured editor before reads`, async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  if (mode === "deleted") { const view = runner.render(change(props, { zones: [] })); assert.equal(view.zoneForms.length, 0); assert.equal(view.metrics[3], "0"); }
  if (mode === "replaced") { const view = runner.render(change(props, { zones: [{ ...fixtures[3][0], name: "REPLACED" }] })); assert.equal(view.zoneForms[0].values.name, "REPLACED"); }
  if (mode === "unavailable") { const view = runner.render(change(props, { availability: { ...props.availability, zones: false } })); assert.equal(view.zoneForms.length, 0); assert.equal(view.metrics[3], "לא זמין"); }
  if (mode === "ABA") { runner.render(change(props, { zones: [] })); runner.render(props); }
  const data = formData(old.zoneForms[0]); await old.zoneForms[0].action(data); assert.deepEqual(data.reads, []); assert.equal(runner.calls.length, 0);
});
test("optimistic zone retained on unchanged authoritative props and unrelated refresh, old editor denied", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props);
  await old.zoneForms[0].action(formData(old.zoneForms[0], { name: "SAVED_ZONE" }));
  const current = runner.render(change(props, { zones: props.zones.map((z) => ({ ...z, metadata: { unused: true } })), riskProfiles: [] }));
  assert.equal(current.zoneForms[0].values.name, "SAVED_ZONE"); assert.ok(current.text.includes("אזור המצלמה נשמר"));
  const data = formData(old.zoneForms[0]); await old.zoneForms[0].action(data); assert.deepEqual(data.reads, []); assert.equal(runner.calls.length, 1);
});
test("zone and routine payload fields/defaults/classification unchanged under synthetic spies", async () => {
  const { props } = await page(); const runner = panelRunner(); const view = runner.render(props);
  await view.zoneForms[0].action(fd({ name: "", zone_type: "", is_restricted: "on" }));
  assert.deepEqual(runner.calls[0], { action: "update_zone", zone_id: "zone-a", name: "ZONE_A", zone_type: "classroom", is_restricted: true });
  await view.routineForm.action(formData(view.routineForm));
  assert.deepEqual(Object.keys(runner.calls[1]).sort(), ["action", "kindergarten_id", "opening_start", "opening_end", "pickup_start", "pickup_end", "nap_start", "nap_end", "outdoor_start", "outdoor_end", "breakfast_time", "lunch_time"].sort());
  assert.equal(runner.calls[1].action, "save_routine"); assert.equal(runner.calls[1].kindergarten_id, "garden-a"); assert.equal(runner.calls[1].opening_start, "07:07");
});
for (const kind of ["zone", "routine"]) test(`queued ${kind} stale work cannot read or send`, async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props); const form = kind === "zone" ? old.zoneForms[0] : old.routineForm; const data = formData(form); const queued = () => form.action(data);
  runner.render(kind === "zone" ? change(props, { zones: [] }) : change(props, { gardens: [] })); await queued(); assert.deepEqual(data.reads, []); assert.equal(runner.calls.length, 0);
});
for (const kind of ["zone", "routine"]) test(`${kind} rechecks after mutable reads before effects`, async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props); const form = kind === "zone" ? old.zoneForms[0] : old.routineForm;
  const data = fd(form.values, (name) => { if (name === (kind === "zone" ? "name" : "opening_start")) runner.render(kind === "zone" ? change(props, { zones: [] }) : change(props, { gardens: [] })); });
  await form.action(data); assert.equal(runner.calls.length, 0);
});
for (const failure of [false, true]) test(`late zone ${failure ? "failure" : "success"} cannot resurrect deleted rows or old feedback`, async () => {
  const { props } = await page(); let resolve;
  const runner = panelRunner({ responseFactory: () => new Promise((done) => { resolve = done; }) }); const old = runner.render(props); const pending = old.zoneForms[0].action(formData(old.zoneForms[0]));
  runner.render(change(props, { zones: [] })); resolve(failure ? bad("OLD_ERROR") : ok({ zone: { ...fixtures[3][0], name: "OLD_REPLY" } })); await pending;
  const current = runner.render(); assert.equal(current.zoneForms.length, 0); assert.ok(!current.text.includes("OLD_ERROR")); assert.ok(!current.text.includes("אזור המצלמה נשמר"));
});
test("old routine settlement cannot clear newer B busy/error/message ownership", async () => {
  const { props } = await page(); const replies = [];
  const runner = panelRunner({ responseFactory: () => new Promise((done) => replies.push(done)) }); const a = runner.render(props); const first = a.routineForm.action(formData(a.routineForm));
  a.select.onChange({ target: { value: "garden-b" } }); const b = runner.render(); const second = b.routineForm.action(formData(b.routineForm));
  replies[0](bad("OLD_A_ERROR")); await first; let current = runner.render(); assert.equal(current.routineForm.disabled, true); assert.ok(!current.text.includes("OLD_A_ERROR"));
  replies[1](ok()); await second; current = runner.render(); assert.equal(current.routineForm.disabled, false); assert.ok(current.text.includes("שגרת הגן נשמרה"));
});
test("older same-zone operation cannot clear newer pending ownership or overwrite its result", async () => {
  const { props } = await page(); const replies = [];
  const runner = panelRunner({ responseFactory: () => new Promise((done) => replies.push(done)) }); const view = runner.render(props);
  const first = view.zoneForms[0].action(formData(view.zoneForms[0], { name: "FIRST" })); const second = view.zoneForms[0].action(formData(view.zoneForms[0], { name: "SECOND" }));
  replies[0](bad("OLD_ZONE_ERROR")); await first; let current = runner.render(); assert.equal(current.zoneForms[0].disabled, true); assert.ok(!current.text.includes("OLD_ZONE_ERROR"));
  replies[1](ok({ zone: { ...fixtures[3][0], name: "SECOND" } })); await second; current = runner.render(); assert.equal(current.zoneForms[0].disabled, false); assert.equal(current.zoneForms[0].values.name, "SECOND");
});
test("independent routine and global zone ownership survives unrelated context changes", async () => {
  const { props } = await page(); const replies = [];
  const runner = panelRunner({ responseFactory: () => new Promise((done) => replies.push(done)) }); const a = runner.render(props);
  const zone = a.zoneForms[0].action(formData(a.zoneForms[0], { name: "GLOBAL_ZONE" }));
  a.select.onChange({ target: { value: "garden-b" } }); const b = runner.render(); assert.equal(b.routineForm.disabled, false);
  const routine = b.routineForm.action(formData(b.routineForm));
  replies[0](ok({ zone: { ...fixtures[3][0], name: "GLOBAL_ZONE" } })); await zone;
  runner.render(change(props, { zones: [] })); replies[1](ok()); await routine; const current = runner.render();
  assert.ok(current.text.includes("שגרת הגן נשמרה")); assert.equal(current.routineForm.disabled, false);
});
test("deferred old zone rows and feedback updates cannot commit after authoritative removal", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props); runner.deferState();
  await old.zoneForms[0].action(formData(old.zoneForms[0], { name: "DEFERRED" })); assert.ok(runner.queuedState.length > 0);
  runner.render(change(props, { zones: [] })); runner.flushState(); const current = runner.render(); assert.equal(current.zoneForms.length, 0); assert.ok(!current.text.includes("אזור המצלמה נשמר"));
});
test("unmount blocks captured routine/zone actions before FormData reads", async () => {
  const { props } = await page(); const runner = panelRunner(); const old = runner.render(props); runner.unmount();
  for (const form of [old.routineForm, old.zoneForms[0]]) { const data = formData(form); await form.action(data); assert.deepEqual(data.reads, []); } assert.equal(runner.calls.length, 0);
});
test("legacy Garden/fixed context and omitted-availability Admin preserve healthy single-row defaults", async () => {
  const { props } = await page();
  for (const role of ["garden", "admin"]) {
    const legacy = { ...props, role, kindergartenId: "garden-a", learningProfile: fixtures[1][0], routine: fixtures[2][0], riskProfile: fixtures[5][0] }; delete legacy.availability;
    const runner = panelRunner(); const view = runner.render(legacy);
    assert.deepEqual(view.metrics, ["PROFILE_A", "BASELINE_A", "91%", "1"]); assert.equal(view.routineForm.values.opening_start, "07:07"); assert.equal(view.risks[2].value, "77");
    assert.equal(Boolean(view.select), role === "admin"); await view.routineForm.action(formData(view.routineForm)); assert.equal(runner.calls[0].kindergarten_id, "garden-a");
    assert.ok(view.text.includes("פרופיל ילדים")); assert.ok(view.text.includes("לא נוצר")); assert.ok(view.text.includes("לא פעילות"));
  }
});
test("exactly one portable domain hook exists", () => {
  const hooks = JSON.parse(source("config/digital-observer-ci-gates.json")).domain.filter((hook) => hook.name === "observer-learning-query-boundary");
  assert.deepEqual(hooks, [{ name: "observer-learning-query-boundary", args: ["--test", "scripts/qa/check-observer-learning-query-boundary.mjs"] }]);
});
