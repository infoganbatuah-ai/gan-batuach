import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import vm from "node:vm";

// All values/requests are literal synthetic fixtures, not real credentials or
// configure/activate operations. Actual TSX, no copied business helpers.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/software-connector-onboarding.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/); const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "software-connector-onboarding.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "software-connector-onboarding.js" });
const SITE_A = "00000000-0000-4000-8000-000000000001", SITE_B = "00000000-0000-4000-8000-000000000002";
const INTENT_A = "00000000-0000-4000-8000-000000000021", INTENT_B = "00000000-0000-4000-8000-000000000022";
const USER = "SYNTHETIC_USER_ONLY", PASSWORD = "SYNTHETIC_PASSWORD_ONLY";
const NOW = 1000000;
const effort = { product_actions: 3, technical_actions: 0, installer_actions: 1, external_app_actions: 0, elapsed_ms: 1000, support_required: false };
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
async function drain() { for (let n = 0; n < 128; n++) await Promise.resolve(); }
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
function nodes(value, predicate) {
  if (Array.isArray(value)) return value.flatMap((entry) => nodes(entry, predicate));
  if (!value || typeof value !== "object") return [];
  return [...(predicate(value) ? [value] : []), ...nodes(value.props?.children, predicate)];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value && typeof value === "object") return text(value.props?.children);
  return value === null || value === undefined || typeof value === "boolean" ? "" : String(value);
}
function result(site = SITE_A) {
  return {
    site: { id: site, name: "SYNTHETIC_SITE" }, onboarding_session_id: "SYNTHETIC_SESSION",
    connectors: [{ gateway_id: "SYNTHETIC_GATEWAY", name: "SYNTHETIC_CONNECTOR", status: "HEALTHY", last_seen_at: new Date(NOW - 1000).toISOString(), version: "synthetic" }],
    candidates: [1, 2, 3].map((n) => ({ id: `candidate-${n}`, connector_gateway_id: "SYNTHETIC_GATEWAY", name: `SYNTHETIC_CAMERA_${n}`, vendor: "SYNTHETIC", model: null, protocols: ["SYNTHETIC"],
      credentials_saved: n === 2, registration_status: "synthetic", camera_source: n === 2 ? { id: "source-2", display_name: "SYNTHETIC_DISPLAY_2", location_label: "SYNTHETIC_LOCATION", source_mode: "synthetic", status: "connected", health_status: "healthy", last_seen_at: new Date(NOW - 1000).toISOString(), active_monitoring: false } : null }))
  };
}
function fixture() {
  const requests = [], reads = [], writes = [], callbacks = [], timers = new Map(), pending = [];
  let fiber, cursor = 0, tree, dead = false, timerId = 0, hidden = false, tokenReads = 0;
  const parent = (label) => ({ onProductAction: () => callbacks.push({ kind: "product", label }), measuredEffort: () => { callbacks.push({ kind: "effort", label }); return effort; }, onFailure: (category) => callbacks.push({ kind: "failure", label, category }) });
  let props = { siteId: SITE_A, installIntentId: INTENT_A, ...parent("A") };
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const packet = (label, fields) => new Proxy(fields, { get(target, key) {
    if (key === "then") return undefined;
    reads.push(`${label}.${String(key)}`); return Reflect.get(target, key);
  } });
  const poison = new Proxy({}, { get(_target, key) {
    if (key === "then") return undefined;
    // Record before throwing: Product catch must not hide a failed read assertion.
    reads.push(`POISON.${String(key)}`); assert.fail("stale payload read");
  } });
  const React = {
    useState: (initial) => {
      const own = fiber, slot = cursor++;
      if (!own.slots[slot]) own.slots[slot] = { kind: "state", value: typeof initial === "function" ? initial() : initial };
      assert.equal(own.slots[slot].kind, "state");
      return [own.slots[slot].value, (value) => { assert.equal(own.dead, false, "stale setter"); writes.push({ key: own.key, slot }); own.slots[slot].value = typeof value === "function" ? value(own.slots[slot].value) : value; own.dirty = true; }];
    },
    useRef: (initial) => {
      const slot = cursor++; if (!fiber.slots[slot]) fiber.slots[slot] = { kind: "ref", value: { current: initial } };
      assert.equal(fiber.slots[slot].kind, "ref"); return fiber.slots[slot].value;
    },
    useMemo: (fn, deps) => {
      const slot = cursor++; if (!fiber.slots[slot] || !same(fiber.slots[slot].deps, deps)) fiber.slots[slot] = { kind: "memo", value: fn(), deps };
      assert.equal(fiber.slots[slot].kind, "memo"); return fiber.slots[slot].value;
    },
    useCallback: (fn, deps) => {
      const slot = cursor++; if (!fiber.slots[slot] || !same(fiber.slots[slot].deps, deps)) fiber.slots[slot] = { kind: "callback", value: fn, deps };
      assert.equal(fiber.slots[slot].kind, "callback"); return fiber.slots[slot].value;
    },
    useEffect: (fn, deps) => {
      const own = fiber, slot = cursor++;
      if (!own.slots[slot] || !same(own.slots[slot].deps, deps)) {
        const old = own.slots[slot]; own.slots[slot] = { kind: "effect", deps, cleanup: old?.cleanup };
        pending.push(() => { own.slots[slot].cleanup?.(); own.slots[slot].cleanup = fn(); });
      }
      assert.equal(own.slots[slot].kind, "effect");
    }
  };
  const iconNames = ["AlertTriangle", "Camera", "Check", "LoaderCircle", "LockKeyhole", "RefreshCw", "Router", "ShieldCheck", "Wifi"];
  const modules = new Map([
    ["react", React], ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["next/link", { __esModule: true, default: "Link" }],
    ["lucide-react", Object.fromEntries(iconNames.map((name) => [name, name]))],
    ["@/lib/domain/digital-observer/client-session", { readObserverAccessToken: () => { tokenReads++; return "SYNTHETIC_ACCESS_ONLY"; } }]
  ]);
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    Date: class extends Date { static now() { return NOW; } },
    document: { get hidden() { return hidden; } },
    window: {
      setTimeout: (fn, delay) => { assert.equal(delay, 0); const id = ++timerId; timers.set(id, { fn, delay, repeat: false }); return id; },
      clearTimeout: (id) => timers.delete(id),
      setInterval: (fn, delay) => { assert.equal(delay, 5000); const id = ++timerId; timers.set(id, { fn, delay, repeat: true }); return id; },
      clearInterval: (id) => timers.delete(id)
    },
    fetch: (path, options) => {
      assert.equal(options.cache, "no-store"); assert.equal(options.credentials, "same-origin");
      const body = options.body ? JSON.parse(options.body) : null;
      assert.deepEqual(plain(options.headers), { ...(body ? { "content-type": "application/json" } : {}), authorization: "Bearer SYNTHETIC_ACCESS_ONLY" });
      if (body) { assert.equal(path, "/api/digital-observer/software-connector"); assert.equal(options.method, "POST"); assert.ok(["configure_batch", "activate_batch"].includes(body.action)); }
      else assert.equal(new URL(path, "https://synthetic.invalid").pathname, "/api/digital-observer/software-connector");
      const record = { kind: body?.action ?? "GET", path, body, response: deferred(), payload: deferred(), jsonCalls: 0 }; requests.push(record); return record.response.promise;
    }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const destroy = (own) => { if (!own || own.dead) return; own.dead = true; for (const slot of own.slots) if (slot?.kind === "effect") slot.cleanup?.(); };
  const render = () => {
    assert.equal(dead, false); let passes = 0;
    do {
      assert.ok(++passes < 8); const shell = exports.SoftwareConnectorOnboarding(props); assert.equal(typeof shell.type, "function", "keyed inner scope expected");
      if (!fiber || fiber.key !== shell.key || fiber.type !== shell.type) { destroy(fiber); fiber = { key: shell.key, type: shell.type, slots: [], dead: false, dirty: false }; }
      fiber.dirty = false; cursor = 0; tree = shell.type(shell.props); while (pending.length) pending.shift()();
    } while (fiber.dirty);
  };
  render();
  const article = (id) => { render(); const found = nodes(tree, (node) => node.type === "article" && node.key === id); assert.equal(found.length, 1); return found[0]; };
  const input = (id, field) => {
    render();
    if (field === "username" || field === "password") {
      const set = nodes(tree, (node) => node.type === "fieldset" && node.key === id)[0]; assert.ok(set, `credential form:${id}`);
      return nodes(set, (node) => node.type === "input" && node.props.autoComplete === (field === "username" ? "username" : "new-password"))[0];
    }
    return nodes(article(id), (node) => node.type === "input" && node.props.type !== "checkbox")[field === "displayName" ? 0 : 1];
  };
  const handler = (kind) => {
    render();
    if (kind === "configure") { const form = nodes(tree, (node) => node.type === "form")[0]; assert.ok(form); return form.props.onSubmit; }
    const found = nodes(tree, (node) => node.type === "button" && (kind === "activate" ? text(node).includes("הוסף את המצלמות") : kind === "retry" ? text(node).includes("נסה שוב") : /בחר הכול|בטל בחירת הכול/.test(text(node))));
    assert.equal(found.length, 1, `button:${kind}`); return found[0].props.onClick;
  };
  const respond = (record, { data, status = 200, headersOnly = false, poisonResponse = false } = {}) => {
    assert.ok(record); const index = requests.indexOf(record);
    record.response.resolve(poisonResponse ? poison : packet(`response.${index}`, { ok: status >= 200 && status < 300, json: () => { record.jsonCalls++; return record.payload.promise; } }));
    if (!headersOnly && !poisonResponse) record.payload.resolve(packet(`payload.${index}`, status >= 200 && status < 300 ? { data: data ?? (record.kind === "GET" ? result(new URL(record.path, "https://synthetic.invalid").searchParams.get("observer_site_id")) : { accepted: true }) } : { error: "SYNTHETIC_SERVER_DENIAL" }));
  };
  const fire = (delay) => { const matches = [...timers.entries()].filter(([, entry]) => entry.delay === delay); assert.equal(matches.length, 1); const [id, entry] = matches[0]; if (!entry.repeat) timers.delete(id); entry.fn(); };
  const unmount = () => { if (!dead) { dead = true; destroy(fiber); } };
  return {
    requests, reads, writes, callbacks, timers, render, respond, handler,
    start: () => fire(0), poll: () => fire(5000),
    toggle: (id) => nodes(article(id), (node) => node.type === "input" && node.props.type === "checkbox")[0].props.onChange(),
    edit: (id, field, value) => input(id, field).props.onChange({ target: { value } }),
    values: (id) => ({ username: input(id, "username").props.value, password: input(id, "password").props.value }),
    editCredentials: (id) => { const matches = nodes(article(id), (node) => node.type === "button" && text(node).includes("עדכון פרטי")); assert.equal(matches.length, 1); matches[0].props.onClick(); },
    configure: () => handler("configure")({ preventDefault() {} }),
    click: (kind) => handler(kind)(),
    scope: (changes) => { props = { ...props, ...changes, ...parent("B") }; render(); },
    hidden: (value) => { hidden = value; },
    body: (record, data, rejected = false) => { if (rejected) record.payload.reject(Error("SYNTHETIC_BODY_REJECTION")); else record.payload.resolve(data === "POISON" ? poison : packet(`payload.${requests.indexOf(record)}`, { data })); },
    reject: (record) => record.response.reject(Error("SYNTHETIC_RESPONSE_REJECTION")),
    ui: () => {
      render(); const retry = nodes(tree, (node) => node.type === "button" && text(node).includes("נסה שוב"))[0];
      return { text: text(tree), retryDisabled: retry?.props.disabled ?? null, formIds: nodes(tree, (node) => node.type === "fieldset").map((node) => node.key),
        selected: nodes(tree, (node) => node.type === "input" && node.props.type === "checkbox").map((node) => node.props.checked),
        inputs: nodes(tree, (node) => node.type === "input" && node.props.type !== "checkbox").map((node) => node.props.value),
        error: text(nodes(tree, (node) => node.props?.role === "alert")[0]), message: text(nodes(tree, (node) => node.props?.className === "do-action-result success")[0]),
        activatePresent: nodes(tree, (node) => node.type === "button" && text(node).includes("הוסף את המצלמות")).length > 0 };
    },
    snapshot: () => plain({ requests: requests.map((r) => ({ kind: r.kind, body: r.body, path: r.path, jsonCalls: r.jsonCalls })), reads, writes, callbacks, tokenReads }),
    unmount,
    cleanup: async () => { unmount(); for (const r of requests) { r.response.resolve({ ok: true, json: async () => ({}) }); r.payload.resolve({}); } await drain(); assert.equal(timers.size, 0); }
  };
}
const last = (h, kind) => h.requests.filter((r) => r.kind === kind).at(-1);
const count = (h, kind) => h.requests.filter((r) => r.kind === kind).length;
async function boot(h, data = result()) { h.start(); h.respond(last(h, "GET"), { data }); await drain(); h.render(); }
function fill(h, id = "candidate-1") { h.edit(id, "username", USER); h.edit(id, "password", PASSWORD); }
async function configureReady(h, data = result()) { await boot(h, data); h.toggle("candidate-1"); fill(h); h.render(); }
async function activateReady(h) { await boot(h); h.toggle("candidate-2"); h.render(); }
async function reach(h, phase) {
  if (phase === "initial") { h.start(); return last(h, "GET"); }
  if (phase === "manual") { await boot(h); h.click("retry"); return last(h, "GET"); }
  if (phase.startsWith("configure")) { await configureReady(h); h.configure(); await drain(); }
  else { await activateReady(h); h.click("activate"); await drain(); }
  const record = last(h, phase.startsWith("configure") ? "configure_batch" : "activate_batch");
  if (phase.endsWith("refresh")) { h.respond(record); await drain(); return last(h, "GET"); }
  return record;
}
for (const phase of ["initial", "manual", "configure", "activate", "configure-refresh", "activate-refresh"]) for (const stage of ["fetch", "json"]) for (const loss of ["unmount", "Site", "intent"]) for (const rejected of [false, true]) {
  test(`${phase}/${stage} late ${rejected ? "rejection" : "resolution"} after ${loss} cannot advance`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); const record = await reach(h, phase);
    if (stage === "json") { h.respond(record, { headersOnly: true }); await drain(); assert.equal(record.jsonCalls, 1); }
    if (loss === "unmount") h.unmount(); else h.scope(loss === "Site" ? { siteId: SITE_B } : { installIntentId: INTENT_B });
    const ui = loss === "unmount" ? null : h.ui(), before = h.snapshot();
    if (stage === "fetch") { if (rejected) h.reject(record); else h.respond(record, { poisonResponse: true }); }
    else h.body(record, "POISON", rejected);
    await drain(); assert.deepEqual(h.snapshot(), before, "no stale fields/token/new GET/parent/state/finally"); if (ui) assert.deepEqual(h.ui(), ui);
  });
}
for (const rejected of [false, true]) {
  test(`newest refresh preserves selection/draft/loading over old ${rejected ? "rejection" : "response"}`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); h.poll(); const old = last(h, "GET"); h.click("retry"); const fresh = last(h, "GET");
    h.respond(fresh); await drain(); h.edit("candidate-1", "displayName", "SYNTHETIC_NEW_NAME"); const ui = h.ui(), before = h.snapshot();
    if (rejected) h.reject(old); else h.respond(old, { poisonResponse: true }); await drain(); assert.deepEqual(h.snapshot(), before); assert.deepEqual(h.ui(), ui); assert.equal(h.ui().retryDisabled, false);
  });
}
test("mismatched result Site never renders another scope", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); h.start(); h.respond(last(h, "GET"), { data: result(SITE_B) }); await drain();
  assert.match(h.ui().error, /SCOPE_MISMATCH/); assert.equal(h.ui().selected.length, 0); assert.equal(h.ui().formIds.length, 0);
});
test("newest quiet refresh settles older foreground loading without false retry failure", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); h.start(); const old = last(h, "GET"); h.poll(); h.respond(last(h, "GET")); await drain();
  assert.equal(h.ui().retryDisabled, false); const before = h.snapshot(); h.respond(old, { poisonResponse: true }); await drain(); assert.deepEqual(h.snapshot(), before);
});
test("superseded manual retry does not report stale empty discovery", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await boot(h); h.click("retry"); const old = last(h, "GET"); h.poll(); h.respond(last(h, "GET")); await drain();
  h.respond(old, { data: { ...result(), candidates: [] } }); await drain(); assert.equal(h.callbacks.some((c) => c.kind === "failure"), false); assert.equal(h.ui().selected.length, 3);
});
test("unchanged submitted credentials clear and remain blank after reopening current edit form", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); h.configure(); h.respond(last(h, "configure_batch")); await drain();
  const saved = result(); saved.candidates[0].credentials_saved = true; h.respond(last(h, "GET"), { data: saved }); await drain(); assert.equal(h.ui().formIds.includes("candidate-1"), false);
  h.editCredentials("candidate-1"); assert.deepEqual(h.values("candidate-1"), { username: "", password: "" });
});
for (const field of ["username", "password", "displayName", "locationLabel"]) for (const when of ["before-ack", "during-followup"]) {
  test(`${field} edited ${when} survives ack and credentials_saved refresh as pending`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); h.configure(); const post = last(h, "configure_batch");
    if (when === "during-followup") { h.respond(post); await drain(); }
    const value = `SYNTHETIC_NEW_${field}`; h.edit("candidate-1", field, value);
    if (when === "before-ack") { h.respond(post); await drain(); }
    const saved = result(); saved.candidates[0].credentials_saved = true; h.respond(last(h, "GET"), { data: saved }); await drain();
    assert.ok(h.ui().formIds.includes("candidate-1"), "new unsent fields remain editable"); assert.ok(h.ui().inputs.includes(value)); assert.match(h.ui().message, /לא נשלחו/);
    assert.equal(count(h, "configure_batch"), 1); assert.equal(count(h, "activate_batch"), 0); assert.equal(JSON.stringify(post.body).includes(value), false);
  });
}
test("ack clears only configured IDs, not merely selected saved candidate draft", async (t) => {
  const initial = result(); initial.candidates[1].credentials_saved = false;
  const h = fixture(); t.after(() => h.cleanup()); await boot(h, initial); h.toggle("candidate-1"); h.toggle("candidate-2"); fill(h); fill(h, "candidate-2");
  h.poll(); h.respond(last(h, "GET")); await drain(); h.configure(); const post = last(h, "configure_batch"); assert.deepEqual(post.body.cameras.map((c) => c.candidate_id), ["candidate-1"]);
  h.respond(post); await drain(); const saved = result(); saved.candidates[0].credentials_saved = true; h.respond(last(h, "GET"), { data: saved }); await drain();
  h.editCredentials("candidate-2"); assert.deepEqual(h.values("candidate-2"), { username: USER, password: PASSWORD });
});
test("per-candidate revisions clear unchanged first draft and retain edited second draft", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await boot(h); h.toggle("candidate-1"); h.toggle("candidate-3"); fill(h); fill(h, "candidate-3"); h.configure();
  h.edit("candidate-3", "password", "SYNTHETIC_NEW_SECOND"); h.respond(last(h, "configure_batch")); await drain();
  const saved = result(); saved.candidates[0].credentials_saved = true; saved.candidates[2].credentials_saved = true; h.respond(last(h, "GET"), { data: saved }); await drain();
  assert.ok(h.ui().formIds.includes("candidate-3")); assert.equal(h.values("candidate-3").password, "SYNTHETIC_NEW_SECOND");
  h.editCredentials("candidate-1"); assert.deepEqual(h.values("candidate-1"), { username: "", password: "" });
});
for (const action of ["configure", "activate"]) {
  test(`duplicate explicit ${action} remains one request and polling cannot cancel its own refresh`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); if (action === "configure") await configureReady(h); else await activateReady(h);
    const handler = h.handler(action); const event = { preventDefault() {} }; handler(event); handler(event); await drain(); const kind = action === "configure" ? "configure_batch" : "activate_batch";
    assert.equal(count(h, kind), 1); const before = h.requests.length; h.poll(); assert.equal(h.requests.length, before);
    h.respond(last(h, kind)); await drain(); assert.equal(h.requests.length, before + 1, "owned followup allowed while busy");
    h.respond(last(h, "GET")); await drain(); assert.equal(h.callbacks.filter((c) => c.kind === "failure").length, 0);
  });
}
test("current configuration preserves exact batch payload without revision or extra credentials", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); h.configure(); const body = last(h, "configure_batch").body;
  assert.deepEqual(body, { action: "configure_batch", observer_site_id: SITE_A, gateway_id: "SYNTHETIC_GATEWAY", cameras: [{ candidate_id: "candidate-1", display_name: "SYNTHETIC_CAMERA_1", location_label: "בית", username: USER, password: PASSWORD }] });
});
test("current explicit activation preserves scoped ready IDs and measured effort", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await activateReady(h); h.click("activate");
  assert.deepEqual(last(h, "activate_batch").body, { action: "activate_batch", observer_site_id: SITE_A, camera_source_ids: ["source-2"], effort });
  assert.equal(h.callbacks.filter((c) => c.kind === "effort").length, 1);
});
test("no candidate is selected or activated automatically", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await boot(h); assert.deepEqual(h.ui().selected, [false, false, false]); assert.equal(h.ui().formIds.length, 0); assert.equal(h.ui().activatePresent, false); assert.equal(h.requests.length, 1);
});
for (const unavailable of ["stale", "invalid-time", "already-active"]) {
  test(`current ${unavailable} source is not offered for activation`, async (t) => {
    const data = result(); const source = data.candidates[1].camera_source;
    if (unavailable === "stale") source.last_seen_at = new Date(NOW - 120000).toISOString();
    else if (unavailable === "invalid-time") source.last_seen_at = "invalid"; else source.active_monitoring = true;
    const h = fixture(); t.after(() => h.cleanup()); await boot(h, data); h.toggle("candidate-2"); assert.equal(h.ui().activatePresent, false); assert.equal(count(h, "activate_batch"), 0);
  });
}
test("current empty manual retry reports only current DISCOVERY_FAILED", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); const empty = { ...result(), candidates: [] }; await boot(h, empty); h.click("retry"); h.respond(last(h, "GET"), { data: empty }); await drain();
  assert.deepEqual(h.callbacks.filter((c) => c.kind === "failure").map((c) => c.category), ["DISCOVERY_FAILED"]); assert.equal(h.ui().retryDisabled, false);
});
test("current failed GET retry shows current error and failure without infinite loading", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); h.start(); h.respond(last(h, "GET"), { status: 500 }); await drain(); assert.match(h.ui().error, /SYNTHETIC_SERVER_DENIAL/);
  h.click("retry"); h.respond(last(h, "GET"), { status: 500 }); await drain(); assert.equal(h.ui().retryDisabled, false); assert.equal(h.callbacks.at(-1).category, "DISCOVERY_FAILED");
});
test("visibility and busy preserve bounded five-second quiet refresh", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); h.hidden(true); h.poll(); assert.equal(count(h, "GET"), 1);
  h.hidden(false); h.poll(); h.respond(last(h, "GET")); await drain(); assert.equal(h.ui().retryDisabled, false);
  h.configure(); const before = h.requests.length; h.poll(); assert.equal(h.requests.length, before);
});
test("same-scope rerenders retain edits without mirroring props into draft state", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); const before = h.ui(); h.render(); h.render(); assert.deepEqual(h.ui(), before); assert.equal(h.requests.length, 1);
});
test("new intent immediately has no previous selection, credential fields or retained actionable callbacks", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); const submit = h.handler("configure"), retry = h.handler("retry"); h.scope({ installIntentId: INTENT_B });
  assert.equal(h.ui().inputs.length, 0); assert.equal(h.ui().formIds.length, 0); const before = h.snapshot(); submit({ preventDefault() { assert.fail("stale form inspected"); } }); retry(); await drain(); assert.deepEqual(h.snapshot(), before);
});
for (const action of ["configure", "activate"]) {
  test(`current ${action} failure preserves category and never starts a followup or resend`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); if (action === "configure") await configureReady(h); else await activateReady(h);
    if (action === "configure") h.configure(); else h.click("activate");
    const kind = action === "configure" ? "configure_batch" : "activate_batch";
    h.respond(last(h, kind), { status: 500 }); await drain(); assert.equal(count(h, kind), 1); assert.equal(count(h, "GET"), 1);
    assert.equal(h.callbacks.at(-1).category, action === "configure" ? "CREDENTIALS_INVALID" : "UNKNOWN"); assert.match(h.ui().error, /SYNTHETIC_SERVER_DENIAL/);
  });
}
test("old same-scope form cannot acknowledge a newer edit revision as if it submitted it", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await configureReady(h); const oldForm = h.handler("configure");
  h.edit("candidate-1", "password", "SYNTHETIC_NEW_BEFORE_SUBMIT"); oldForm({ preventDefault() {} }); await drain(); assert.equal(count(h, "configure_batch"), 0);
  h.configure(); assert.equal(last(h, "configure_batch").body.cameras[0].password, "SYNTHETIC_NEW_BEFORE_SUBMIT");
});
