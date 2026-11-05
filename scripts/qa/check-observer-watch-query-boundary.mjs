import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/helper/panel; synthetic clients, JSX/hooks/form-state and effect spies only.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(relative) { const p = path.join(root, relative); assert.equal((fs.statSync(p).flags ?? 0) & 0x40000000, 0); return fs.readFileSync(p, "utf8"); }
function compile(text) { const r = ts.transpileModule(text, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/observer-watch/page.tsx"));
const panelCode = compile(source("components/observer-watch-requests-panel.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const expected = [
  ["observer_watch_requests", [["select", "*, gardens(name), observer_sites(name, site_type), camera_streams(name), camera_zones(name, zone_type)"], ["order", "created_at", { ascending: false }], ["limit", 300]]],
  ["camera_streams", [["select", "id, name, garden_id, observer_site_id"], ["order", "name"], ["limit", 500]]],
  ["camera_zones", [["select", "id, name, zone_type, kindergarten_id, observer_site_id"], ["order", "name"], ["limit", 500]]],
  ["gardens", [["select", "id, name"], ["order", "name"], ["limit", 300]]],
  ["observer_sites", [["select", "id, name, site_type"], ["neq", "site_type", "kindergarten"], ["order", "name"], ["limit", 300]]],
  ["ai_camera_events", [["select", "id, watch_request_id"], ["not", "watch_request_id", "is", null], ["limit", 500]]]
];
const keys = ["requests", "cameras", "zones", "gardens", "observerSites", "events"];
const fixtures = [
  [{ id: "request-a", title: "REQUEST_A", watch_type: "after_hours_activity", active: true, priority: 5, kindergarten_id: "garden-a", camera_id: "camera-a", zone_id: "zone-a", schedule: { mode: "always_active" }, gardens: { name: "Garden A" } }, { id: "request-b", title: "REQUEST_B", watch_type: "movement_in_area", active: false, priority: 4, observer_site_id: "site-b", observer_sites: { name: "Site B" } }],
  [{ id: "camera-a", name: "CAMERA_A", garden_id: "garden-a" }, { id: "camera-b", name: "CAMERA_B", observer_site_id: "site-b" }],
  [{ id: "zone-a", name: "ZONE_A", kindergarten_id: "garden-a", zone_type: "classroom" }, { id: "zone-b", name: "ZONE_B", observer_site_id: "site-b", zone_type: "entrance" }],
  [{ id: "garden-a", name: "Garden A" }, { id: "garden-b", name: "Garden B" }],
  [{ id: "site-a", name: "SITE_A", site_type: "home" }, { id: "site-b", name: "SITE_B", site_type: "business" }],
  [{ id: "event-a", watch_request_id: "request-a" }]
];
const jsx = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
const plain = (v) => JSON.parse(JSON.stringify(v));
const unexpected = (id) => { throw Error(`UNEXPECTED_IMPORT:${id}`); };
function load(code, resolve, { fetch = () => { throw Error("FORBIDDEN_EFFECT"); }, warnings = [] } = {}) {
  const exports = {}; vm.runInNewContext(code, { exports, require: resolve, Date, Intl, fetch, process: { env: {} }, console: { warn: (...args) => warnings.push(args) } }); return exports;
}
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
async function page({ failures = {}, empty = false, nullData = false, loader = false, deny = false, data = fixtures } = {}) {
  let clients = 0; const chains = [], warnings = [], helper = load(helperCode, unexpected, { warnings });
  const client = { from(table) {
    const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]);
    for (const m of ["select", "order", "limit", "neq", "not"]) q[m] = (...args) => { calls.push([m, ...args]); return q; };
    q.then = (resolve, reject) => {
      const failure = failures[i]; if (failure?.kind === "reject") return Promise.reject(Error("PRIVATE_QUERY_SENTINEL")).then(resolve, reject);
      return Promise.resolve({ data: nullData ? null : empty || failure && !failure.stale ? [] : data[i], error: failure ? { message: "PRIVATE_QUERY_SENTINEL" } : null }).then(resolve, reject);
    }; return q;
  } };
  const p = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id.startsWith("@/components/")) return new Proxy({}, { get: (_, name) => String(name) });
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER_SENTINEL"); return client; } };
    return unexpected(id);
  });
  if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); return { props: nodes(tree, "ObserverWatchRequestsPanel")[0].props, banner: nodes(tree, "AdminDataError")[0].props.message, text: text(tree), chains, clients, warnings };
}
function panelRunner({ responseFactory, queueTransitions = false } = {}) {
  const hooks = [], calls = [], transitions = [], queuedState = [], dom = new Map(), effects = new Map();
  let cursor = 0, dirty = false, rendering = false, deferState = false, props, refreshes = 0;
  function slot(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial(); return i; }
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = slot(() => ({ value: typeof initial === "function" ? initial() : initial })); return [hooks[i].value, (value) => {
      const update = () => { const next = typeof value === "function" ? value(hooks[i].value) : value; if (!Object.is(next, hooks[i].value)) { hooks[i].value = next; dirty = true; } }; if (deferState && !rendering) queuedState.push(update); else update();
    }]; },
    useRef(initial) { return hooks[slot(() => ({ current: initial }))]; },
    useMemo(factory, deps) { const i = slot(() => ({})); if (!same(hooks[i].deps, deps)) hooks[i] = { deps, value: factory() }; return hooks[i].value; },
    useLayoutEffect(effect, deps) { const i = slot(() => ({})); if (!same(hooks[i].deps, deps)) effects.set(i, { effect, deps }); },
    useTransition() { return [false, (work) => { if (queueTransitions) transitions.push(work); else work(); }]; }
  };
  const p = load(panelCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "react") return react;
    if (id === "next/navigation") return { useRouter: () => ({ refresh: () => { refreshes++; } }) };
    if (id === "lucide-react") return new Proxy({}, { get: (_, name) => String(name) }); return unexpected(id);
  }, { fetch: async (url, options) => {
    assert.equal(url, "/api/observer-watch-requests"); assert.equal(options.method, "POST"); assert.equal(options.headers["Content-Type"], "application/json"); const payload = JSON.parse(options.body); calls.push(payload); return responseFactory ? responseFactory(payload, calls.length) : ok();
  } });
  function render(next = props) {
    props = next; let tree;
    for (let i = 0; i < 16; i++) { cursor = 0; dirty = false; rendering = true; tree = p.ObserverWatchRequestsPanel(props); rendering = false; if (!dirty) break; assert.ok(i < 15, "RECONCILIATION_LOOP"); }
    for (const [i, pending] of effects) { hooks[i].cleanup?.(); hooks[i] = { deps: pending.deps, cleanup: pending.effect() }; } effects.clear();
    const form = nodes(tree, "form")[0], key = String(form.key), inputs = [...nodes(form, "input"), ...nodes(form, "select"), ...nodes(form, "textarea")].filter((n) => n.props.name);
    if (!dom.has(key)) dom.set(key, Object.fromEntries(inputs.map((n) => [n.props.name, n.props.defaultValue ?? n.props.value ?? (n.type === "select" ? nodes(n, "option")[0]?.props.value ?? "" : "")])));
    const values = { ...dom.get(key) }; for (const input of inputs) if (input.props.value !== undefined) values[input.props.name] = input.props.value;
    for (const other of dom.keys()) if (other !== key) dom.delete(other);
    const rows = nodes(tree, "article").filter((n) => n.props.className === "card procedure-card").map((n) => ({ id: n.key, title: text(nodes(n, "h3")[0]), buttons: nodes(n, "button").map((b) => ({ ...b.props, text: text(b) })), text: text(n) }));
    return { tree, text: text(tree), rows, form: { ...form.props, key: form.key, values, disabled: nodes(form, "button")[0].props.disabled }, metrics: nodes(tree, "article").filter((n) => n.props.className === "metric-card").map((n) => text(nodes(n, "strong")[0])), typeCounts: nodes(tree, "b").map(text), notices: nodes(tree, "div").filter((n) => n.props.className?.startsWith("notice ")).map(text) };
  }
  return { render, calls, transitions, queuedState, get refreshes() { return refreshes; }, edit(form, name, value) { dom.get(String(form.key))[name] = value; }, flushTransitions() { transitions.splice(0).forEach((work) => work()); }, deferState() { deferState = true; }, flushState() { queuedState.splice(0).forEach((work) => work()); }, unmount() { hooks.forEach((hook) => hook.cleanup?.()); } };
}
const ok = () => ({ ok: true, json: async () => ({ data: {} }) });
const bad = () => ({ ok: false, json: async () => ({ error: "הפעולה נכשלה באופן סינתטי" }) });
const settle = () => new Promise((resolve) => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fd(values = {}, onGet) { const reads = []; return { reads, get(name) { reads.push(name); onGet?.(name); return values[name] ?? null; } }; }
const formData = (form, values = {}) => fd({ ...form.values, ...values });
const button = (v, id = "request-a", action = "Trigger mock") => v.rows.find((r) => r.id === id)?.buttons.find((b) => b.text === action);
const selected = { kindergarten_id: "garden-a", observer_site_id: "site-b", camera_id: "camera-a", zone_id: "zone-a", title: "QA_TITLE", description: "QA_DESCRIPTION", watch_type: "after_hours_activity", priority: "5", schedule_mode: "always_active" };
const createPayload = (v = selected) => ({ action: "create", ...v, notification_channels: ["in_app"] });
function assertQueries(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); }

test("actual healthy page/panel retain query/admin contracts, options, labels and metrics", async () => {
  const r = await page(); assertQueries(r); assert.equal(r.banner, null); assert.ok(r.text.includes("1 triggered mock events")); const runner = panelRunner(), v = runner.render(r.props);
  assert.deepEqual(v.metrics, ["2", "1", "1", "2"]); assert.equal(v.typeCounts.length, 8); assert.equal(v.rows.length, 2); assert.equal(v.form.disabled, false); assert.equal(v.form.values.watch_type, "after_hours_activity"); assert.equal(v.form.values.schedule_mode, "always_active"); assert.equal(v.form.values.priority, "5");
  assert.deepEqual(nodes(nodes(v.tree, "select").find((n) => n.props.name === "camera_id"), "option").slice(1).map((n) => n.props.value), fixtures[1].map((c) => c.id)); assert.equal(runner.calls.length, 0);
});
for (const [index, [table]] of expected.entries()) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`${table} ${kind}/${stale ? "stale" : "empty"} independent availability`, async () => {
  const r = await page({ failures: { [index]: { kind, stale } } }); assertQueries(r); assert.ok(r.banner); assert.equal(r.props.availability[keys[index]], false);
  for (let i = 0; i < 5; i++) assert.deepEqual(plain(r.props[keys[i]]), i === index ? [] : fixtures[i]);
  assert.ok(r.text.includes(index === 5 ? "לא זמין triggered mock events" : "1 triggered mock events"));
  const runner = panelRunner(), v = runner.render(r.props); assert.deepEqual(v.metrics, index === 0 ? Array(4).fill("לא זמין") : ["2", "1", "1", "2"]); assert.equal(v.rows.length, index === 0 ? 0 : 2); assert.equal(v.form.disabled, index >= 1 && index <= 4); assert.ok(v.typeCounts.every((n) => index === 0 ? n === "לא זמין" : n !== "לא זמין"));
  if (index >= 1 && index <= 4) { const d = formData(v.form, selected); v.form.action(d); assert.equal(d.reads.length, 0); const selector = nodes(v.tree, "select").find((n) => n.props.name === ["", "camera_id", "zone_id", "kindergarten_id", "observer_site_id"][index]); assert.equal(text(selector), "לא זמין"); }
  assert.deepEqual(plain(r.warnings), [["Admin Supabase query unavailable:", `observer watch admin query ${index}`]]); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE_QUERY_SENTINEL")); assert.equal(runner.calls.length, 0);
});
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} stays empty and permits optional no-target semantics`, async () => {
  const r = await page({ empty: true, nullData }); assertQueries(r); assert.equal(r.banner, null); assert.ok(r.text.includes("0 triggered mock events")); const runner = panelRunner(), v = runner.render(r.props); assert.deepEqual(v.metrics, ["0", "0", "0", "0"]); assert.equal(v.form.disabled, false); assert.ok(v.text.includes("אין בקשות מעקב"));
  v.form.action(formData(v.form, { title: "EMPTY_OPTIONAL", description: "" })); await settle(); assert.deepEqual(runner.calls, [createPayload({ ...selected, kindergarten_id: null, observer_site_id: null, camera_id: null, zone_id: null, title: "EMPTY_OPTIONAL", description: "" })]);
});
test("loader unavailable; denied role creates no client/query", async () => {
  const r = await page({ loader: true }); assert.equal(r.chains.length, 0); assert.ok(r.banner); const v = panelRunner().render(r.props); assert.deepEqual(v.metrics, Array(4).fill("לא זמין")); assert.equal(v.form.disabled, true); assert.equal(v.rows.length, 0); await page({ deny: true });
});
test("failed requests/events do not block valid creation; failed choices do not block healthy row action", async () => {
  const a = await page({ failures: { 0: { kind: "reject" }, 5: { kind: "returned", stale: true } } }), r = panelRunner(), v = r.render(a.props); v.form.action(formData(v.form, selected)); await settle(); assert.deepEqual(r.calls, [createPayload()]);
  const b = await page({ failures: { 1: { kind: "reject" }, 3: { kind: "returned" } } }), other = panelRunner(), x = other.render(b.props); button(x).onClick(); await settle(); assert.deepEqual(other.calls, [{ action: "trigger_mock", id: "request-a" }]);
});
test("healthy create/disable/inactive-trigger preserve exact JSON payloads and notes", async () => {
  const a = await page(), r = panelRunner(), v = r.render(a.props); v.form.action(formData(v.form, selected)); button(v, "request-a", "השבתה").onClick(); button(v, "request-b").onClick(); await settle();
  assert.deepEqual(r.calls, [createPayload(), { action: "disable", id: "request-a" }, { action: "trigger_mock", id: "request-b" }]); assert.equal(r.refreshes, 3); assert.ok(v.text.includes("אין הודעה להורים")); assert.ok(v.text.includes("Trigger mock יוצר אירוע shadow מקושר"));
});
test("stable semantic choices preserve edits/selections across reorder/rename/metadata/unrelated refresh", async () => {
  const a = await page(), r = panelRunner(), v = r.render(a.props); for (const [name, value] of Object.entries(selected)) r.edit(v.form, name, value);
  const changed = { ...a.props, requests: [], availability: { ...a.props.availability, events: false, requests: false } }; for (const key of ["cameras", "zones", "gardens", "observerSites"]) changed[key] = [...a.props[key]].reverse().map((x) => ({ ...x, name: "RENAMED", unused: "metadata" }));
  const next = r.render(changed); assert.equal(v.form.key, next.form.key); assert.deepEqual(next.form.values, selected); next.form.action(formData(next.form)); await settle(); assert.deepEqual(r.calls, [createPayload()]);
});
for (const key of ["cameras", "zones", "gardens", "observerSites"]) for (const mode of ["remove", "replace", "unavailable"]) test(`creation ${key}/${mode} invalidates stale handler before reads and resets form`, async () => {
  const a = await page(), r = panelRunner(), old = r.render(a.props); r.edit(old.form, "title", "OLD_TYPED"); const props = { ...a.props };
  if (mode === "unavailable") props.availability = { ...a.props.availability, [key]: false }; else props[key] = mode === "remove" ? [] : a.props[key].map((x) => ({ ...x, observer_site_id: "REPLACED_SCOPE" }));
  const next = r.render(props); assert.notEqual(next.form.key, old.form.key); assert.equal(next.form.values.title, ""); const d = formData(old.form, selected); old.form.action(d); assert.equal(d.reads.length, 0); await settle(); assert.equal(r.calls.length, 0);
  const restored = r.render(a.props); assert.notEqual(restored.form.key, old.form.key); old.form.action(d); assert.equal(d.reads.length, 0);
});
for (const field of ["kindergarten_id", "observer_site_id", "camera_id", "zone_id"]) test(`unknown submitted ${field} denied before title/description reads`, async () => {
  const a = await page(), r = panelRunner(), v = r.render(a.props), d = formData(v.form, { ...selected, [field]: "UNKNOWN" }); v.form.action(d); assert.ok(!d.reads.includes("title")); assert.equal(d.reads.at(-1), field); assert.equal(r.calls.length, 0);
});
for (const field of ["kindergarten_id", "camera_id", "title", "description"]) test(`reentrant FormData ${field} invalidation cannot create`, async () => {
  const a = await page(), r = panelRunner(), v = r.render(a.props); let changed = false;
  const d = fd(selected, (name) => { if (name === field && !changed) { changed = true; r.render({ ...a.props, cameras: [] }); } }); v.form.action(d); await settle(); assert.equal(r.calls.length, 0); if (field === "kindergarten_id") assert.deepEqual(d.reads, ["kindergarten_id"]);
});
test("queued creation after authoritative removal reads nothing; unrelated refresh still permits", async () => {
  const a = await page(), r = panelRunner({ queueTransitions: true }), v = r.render(a.props), d = formData(v.form, selected); v.form.action(d); r.render({ ...a.props, cameras: [] }); r.flushTransitions(); await settle(); assert.equal(d.reads.length, 0); assert.equal(r.calls.length, 0);
  const other = panelRunner({ queueTransitions: true }), x = other.render(a.props); x.form.action(formData(x.form, selected)); other.render({ ...a.props, requests: [] }); other.flushTransitions(); await settle(); assert.deepEqual(other.calls, [createPayload()]);
});
for (const mode of ["remove", "replace", "unavailable", "scope", "active"]) test(`row ${mode} denies old trigger/disable and ABA restoration`, async () => {
  const a = await page(), r = panelRunner(), v = r.render(a.props); let props;
  if (mode === "unavailable") props = { ...a.props, availability: { ...a.props.availability, requests: false } }; else props = { ...a.props, requests: mode === "remove" ? [fixtures[0][1]] : [{ ...fixtures[0][0], ...(mode === "replace" ? { title: "REPLACED" } : mode === "scope" ? { camera_id: "camera-b" } : { active: false }) }, fixtures[0][1]] };
  r.render(props); button(v).onClick(); button(v, "request-a", "השבתה").onClick(); await settle(); assert.equal(r.calls.length, 0); r.render(a.props); button(v).onClick(); await settle(); assert.equal(r.calls.length, 0);
});
test("unrelated request replacement/reorder/choice names do not invalidate a healthy row", async () => {
  const a = await page(), r = panelRunner(), v = r.render(a.props); r.render({ ...a.props, requests: [fixtures[0][1], { ...fixtures[0][0], title: "NEW_A" }], cameras: fixtures[1].map((x) => ({ ...x, name: "RENAMED" })) }); button(v, "request-b").onClick(); await settle(); assert.deepEqual(r.calls, [{ action: "trigger_mock", id: "request-b" }]);
});
test("queued removed/replaced row operations cannot post", async () => {
  const a = await page(), r = panelRunner({ queueTransitions: true }), v = r.render(a.props); button(v).onClick(); button(v, "request-a", "השבתה").onClick(); r.render({ ...a.props, requests: [] }); r.flushTransitions(); await settle(); assert.equal(r.calls.length, 0);
});
for (const kind of ["creation", "row"]) for (const response of ["success", "error", "reject"]) test(`${kind} late ${response} cannot clear newer busy/message or refresh`, async () => {
  const first = deferred(), second = deferred(), a = await page(), r = panelRunner({ responseFactory: (_, n) => n === 1 ? first.promise : second.promise }), v = r.render(a.props);
  const act = (view) => kind === "creation" ? view.form.action(formData(view.form, selected)) : button(view).onClick(); act(v);
  const changed = kind === "creation" ? { ...a.props, zones: a.props.zones.map((x) => ({ ...x, zone_type: "NEW_TYPE" })) } : { ...a.props, requests: [{ ...fixtures[0][0], title: "NEW_ROW" }, fixtures[0][1]] }; const current = r.render(changed); act(current);
  if (response === "reject") first.reject(Error("SYNTHETIC_FETCH_REJECT")); else first.resolve(response === "success" ? ok() : bad()); await settle(); const pending = r.render(); assert.equal(kind === "creation" ? pending.form.disabled : button(pending).disabled, true); assert.equal(pending.notices.length, 0); assert.equal(r.refreshes, 0);
  second.resolve(ok()); await settle(); const done = r.render(); assert.equal(kind === "creation" ? done.form.disabled : button(done).disabled, false); assert.equal(done.notices.length, 1); assert.equal(r.refreshes, 1);
});
test("per-row and creation operations keep independent busy ownership", async () => {
  const a = await page(), work = [deferred(), deferred(), deferred()], r = panelRunner({ responseFactory: (_, n) => work[n - 1].promise }), v = r.render(a.props); v.form.action(formData(v.form, selected)); button(v).onClick(); button(v, "request-b").onClick(); work[1].resolve(ok()); await settle(); const pending = r.render(); assert.equal(pending.form.disabled, true); assert.equal(button(pending).disabled, false); assert.equal(button(pending, "request-b").disabled, true); work[0].resolve(ok()); work[2].resolve(ok()); await settle();
});
test("newer operation on same row owns busy state and feedback", async () => {
  const a = await page(), first = deferred(), second = deferred(), r = panelRunner({ responseFactory: (_, n) => n === 1 ? first.promise : second.promise }), v = r.render(a.props); button(v).onClick(); button(v, "request-a", "השבתה").onClick(); first.resolve(bad()); await settle(); assert.equal(button(r.render()).disabled, true); assert.equal(r.render().notices.length, 0); second.resolve(ok()); await settle(); assert.equal(button(r.render()).disabled, false); assert.equal(r.refreshes, 1);
});
for (const kind of ["creation", "row"]) test(`${kind} rejected current fetch handled without unhandled rejection`, async () => {
  const a = await page(), r = panelRunner({ responseFactory: () => Promise.reject(Error("PRIVATE_FETCH_DETAIL")) }), v = r.render(a.props); if (kind === "creation") v.form.action(formData(v.form, selected)); else button(v).onClick(); await settle(); const done = r.render(); assert.deepEqual(done.notices, ["הפעולה נכשלה"]); assert.equal(done.form.disabled, false); assert.equal(r.refreshes, 0); assert.ok(!done.text.includes("PRIVATE_FETCH_DETAIL"));
});
for (const kind of ["creation", "row"]) test(`${kind} deferred settlement cannot overwrite replacement and unmount cannot refresh`, async () => {
  const a = await page(), first = deferred(), r = panelRunner({ responseFactory: () => first.promise }), v = r.render(a.props); if (kind === "creation") v.form.action(formData(v.form, selected)); else button(v).onClick(); r.deferState(); first.resolve(ok()); await settle(); r.render(kind === "creation" ? { ...a.props, gardens: [] } : { ...a.props, requests: [] }); r.flushState(); const done = r.render(); assert.equal(done.notices.length, 0); assert.equal(done.form.disabled, false);
  const pending = deferred(), other = panelRunner({ responseFactory: () => pending.promise }), x = other.render(a.props); if (kind === "creation") x.form.action(formData(x.form, selected)); else button(x).onClick(); other.unmount(); pending.resolve(ok()); await settle(); assert.equal(other.refreshes, 0);
});
for (const role of ["garden", "admin"]) test(`legacy ${role} omitted availability and fixed Garden target stay compatible`, async () => {
  const r = panelRunner(), v = r.render({ role, fixedKindergartenId: "garden-fixed", requests: fixtures[0], cameras: [], zones: [] }); assert.deepEqual(v.metrics, ["2", "1", "1", "2"]); assert.equal(v.form.key, null); assert.equal(v.form.disabled, false); const d = formData(v.form, selected); v.form.action(d); await settle(); assert.equal(r.calls[0].kindergarten_id, "garden-fixed"); assert.ok(!d.reads.includes("kindergarten_id"));
});
test("legacy rejected fetch is handled and healthy empty defaults remain", async () => {
  const r = panelRunner({ responseFactory: () => Promise.reject(Error("PRIVATE")) }), v = r.render({ role: "garden", requests: [], cameras: [], zones: [] }); assert.deepEqual(v.metrics, ["0", "0", "0", "0"]); v.form.action(formData(v.form, selected)); await settle(); assert.deepEqual(r.render().notices, ["הפעולה נכשלה"]);
});
test("domain hook is distinct and unique", () => {
  const c = JSON.parse(source("config/digital-observer-ci-gates.json")), entries = c.domain.filter((x) => x.name === "observer-watch-query-boundary"); assert.equal(entries.length, 1); assert.deepEqual(entries[0].args, ["--test", "scripts/qa/check-observer-watch-query-boundary.mjs"]);
});
