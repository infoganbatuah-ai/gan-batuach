import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Existing controls UI only, actual TSX under closed synthetic IO. Recorded
// confirm/status requests are fixtures, NOT camera/Guard/server execution.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-camera-controls.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/); const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, "refuse dataless source");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "observer-camera-controls.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "observer-camera-controls.js" });
const SITE_A = "00000000-0000-4000-8000-000000000001", SITE_B = "00000000-0000-4000-8000-000000000002";
const CAMERA_A = "00000000-0000-4000-8000-000000000011", CAMERA_B = "00000000-0000-4000-8000-000000000012";
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
async function drain() { for (let n = 0; n < 128; n++) await Promise.resolve(); }
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
const poison = new Proxy({}, { get(_target, key) { if (key === "then") return undefined; assert.fail(`stale fields:${String(key)}`); } });
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

function fixture({ site = SITE_A, source = CAMERA_A } = {}) {
  const requests = [], reads = [], writes = [], timers = new Map(), listeners = new Set(), retainedListeners = [], fibers = [], knownScopes = new Map();
  const pending = [];
  let props = { observerSiteId: site, cameraSourceId: source, name: "SYNTHETIC_A", capabilities: { audio: false } };
  let fiber, cursor = 0, tree, dead = false, timerId = 0, now = 0, uuid = 0;
  knownScopes.set(source, site);
  const deny = (label) => { throw Error(`FORBIDDEN_REAL_EFFECT:${String(label)}`); };
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const packet = (label, fields) => new Proxy(fields, { get(target, key) {
    if (key === "then") return undefined;
    reads.push(`${label}.${String(key)}`); return Reflect.get(target, key);
  } });
  const nested = (label, fields) => {
    if (!fields || typeof fields !== "object") return fields;
    if (Array.isArray(fields)) return fields.map((entry, index) => nested(`${label}.${index}`, entry));
    return packet(label, Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, nested(`${label}.${key}`, value)])));
  };
  const React = {
    useState: (initial) => {
      const own = fiber, slot = cursor++;
      if (!own.slots[slot]) own.slots[slot] = { kind: "state", value: typeof initial === "function" ? initial() : initial };
      assert.equal(own.slots[slot].kind, "state");
      return [own.slots[slot].value, (value) => {
        assert.equal(own.dead, false, "setter after scope loss"); writes.push({ scope: own.key, slot });
        own.slots[slot].value = typeof value === "function" ? value(own.slots[slot].value) : value; own.dirty = true;
      }];
    },
    useRef: (initial) => {
      const slot = cursor++; if (!fiber.slots[slot]) fiber.slots[slot] = { kind: "ref", value: { current: initial } };
      assert.equal(fiber.slots[slot].kind, "ref"); return fiber.slots[slot].value;
    },
    useCallback: (fn, deps) => {
      const slot = cursor++; if (!fiber.slots[slot] || !same(fiber.slots[slot].deps, deps)) fiber.slots[slot] = { kind: "callback", value: fn, deps };
      assert.equal(fiber.slots[slot].kind, "callback"); return fiber.slots[slot].value;
    },
    useMemo: (fn, deps) => {
      const slot = cursor++; if (!fiber.slots[slot] || !same(fiber.slots[slot].deps, deps)) fiber.slots[slot] = { kind: "memo", value: fn(), deps };
      assert.equal(fiber.slots[slot].kind, "memo"); return fiber.slots[slot].value;
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
  const iconNames = ["AlertTriangle", "Camera", "Check", "ChevronDown", "ChevronLeft", "ChevronRight", "ChevronUp", "Lightbulb", "LightbulbOff", "Siren", "Volume2", "VolumeX", "X", "ZoomIn", "ZoomOut"];
  const styles = Object.fromEntries(["diagnostics", "diagnosticsWarning", "automation", "ptzGroup", "status", "warning", "confirmationBackdrop", "confirmationDialog", "confirmationExpiry", "confirmationActions"].map((name) => [name, name]));
  const modules = new Map([
    ["react", React], ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["lucide-react", Object.fromEntries(iconNames.map((name) => [name, name]))],
    ["./observer-camera-controls.module.css", { __esModule: true, default: styles }]
  ]);
  const setTimer = (fn, delay, repeat) => {
    assert.ok(repeat ? delay === 250 : [0, 1000].includes(delay));
    const id = ++timerId; timers.set(id, { fn, delay, repeat }); return id;
  };
  const window = {
    setTimeout: (fn, delay) => setTimer(fn, delay, false), clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => setTimer(fn, delay, true), clearInterval: (id) => timers.delete(id),
    addEventListener: (name, fn) => { assert.equal(name, "observer-camera-capabilities-updated"); listeners.add(fn); retainedListeners.push(fn); },
    removeEventListener: (name, fn) => { assert.equal(name, "observer-camera-capabilities-updated"); listeners.delete(fn); }
  };
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    window, Date: class extends Date { static now() { return now; } },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` },
    document: { querySelector: () => deny("video access"), createElement: () => deny("canvas/anchor") },
    CSS: { escape: () => deny("CSS.escape") }, URL: { createObjectURL: () => deny("download"), revokeObjectURL: () => deny("URL revoke") },
    setTimeout: () => deny("snapshot timer"),
    fetch: (url, options) => {
      assert.equal(url, "/api/digital-observer/camera-actions"); assert.equal(options.method, "POST");
      assert.deepEqual(plain(options.headers), { "content-type": "application/json" });
      const body = JSON.parse(options.body); assert.ok(["controls", "prepare", "confirm", "status"].includes(body.action));
      const preparation = requests.find((r) => r.body.action === "prepare" && r.body.request_id === body.request_id);
      const scope = body.camera_source_id ? { site: knownScopes.get(body.camera_source_id), source: body.camera_source_id } : preparation?.scope;
      assert.ok(scope?.site); const record = { body, scope, response: deferred(), payload: deferred(), jsonCalls: 0 }; requests.push(record);
      return record.response.promise;
    }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const destroy = (own) => { if (!own || own.dead) return; own.dead = true; for (const slot of own.slots) if (slot?.kind === "effect") slot.cleanup?.(); };
  const render = () => {
    assert.equal(dead, false);
    let passes = 0;
    do {
      assert.ok(++passes < 8, "bounded synthetic effect render");
      const shell = exports.ObserverCameraControls(props);
      assert.equal(typeof shell.type, "function", "actual top-level keyed scope required");
      if (!fiber || fiber.key !== shell.key || fiber.type !== shell.type) { destroy(fiber); fiber = { key: shell.key, type: shell.type, slots: [], dead: false, dirty: false }; fibers.push(fiber); }
      fiber.dirty = false; cursor = 0; tree = shell.type(shell.props);
      while (pending.length) pending.shift()();
    } while (fiber.dirty);
  };
  render();
  const handler = (kind) => {
    render();
    const match = nodes(tree, (node) => node.type === "button" && (kind === "prepare" ? node.props.title === "הדלקת תאורת המצלמה"
      : kind === "siren" ? node.props.title === "הפעלת סירנה קצרה"
      : kind === "confirm" ? text(node).includes("אישור עכשיו") : text(node).includes("ביטול")));
    assert.equal(match.length, 1, `button:${kind}`); return match[0].props.onClick;
  };
  const defaults = (record) => {
    const scope = { observer_site_id: record.scope.site, camera_source_id: record.scope.source };
    if (record.body.action === "controls") return { ...scope, controls: ["lighting", "siren", "ptz"], diagnostics: "live_capabilities", operator_warning: false, non_retryable: false,
      digital_guard_automation: { enabled: false, allowed_actions: [], siren_duration_ms: null } };
    if (record.body.action === "prepare") return { ...scope, request_id: record.body.request_id, confirmation_id: `confirmation-${record.body.request_id}`, confirmation_nonce: "SYNTHETIC_NONCE", expires_at: new Date(now + 10000).toISOString() };
    if (record.body.action === "confirm") return { request_id: record.body.request_id, observer_site_id: record.scope.site, executed: false };
    return { request_id: record.body.request_id, observer_site_id: record.scope.site, terminal: true, operator_warning: false, non_retryable: false, message: "SYNTHETIC_TERMINAL" };
  };
  const respond = (record, { data, status = 200, headersOnly = false, poisonResponse = false } = {}) => {
    assert.ok(record); const index = requests.indexOf(record);
    record.response.resolve(poisonResponse ? poison : packet(`response.${index}`, { ok: status >= 200 && status < 300,
      json: () => { record.jsonCalls++; return record.payload.promise; } }));
    if (!headersOnly && !poisonResponse) record.payload.resolve(nested(`payload.${index}`, status >= 200 && status < 300 ? { data: data ?? defaults(record) } : { error: "SYNTHETIC_SERVER_DENIAL" }));
  };
  const fire = (delay) => {
    const matches = [...timers.entries()].filter(([, entry]) => entry.delay === delay); assert.equal(matches.length, 1, `one fake timer:${delay}`);
    const [id, entry] = matches[0]; if (!entry.repeat) timers.delete(id); entry.fn();
  };
  const unmount = () => { if (!dead) { dead = true; destroy(fiber); } };
  return {
    requests, reads, writes, timers, retainedListeners,
    handler, call: (kind) => handler(kind)(), defaults, respond, fire,
    start: () => fire(0),
    scope: (siteId, sourceId) => { props = { ...props, observerSiteId: siteId, cameraSourceId: sourceId, name: "SYNTHETIC_B" }; knownScopes.set(sourceId, siteId); render(); },
    refresh: () => { for (const fn of [...listeners]) fn({ detail: { cameraSourceId: props.cameraSourceId } }); },
    body: (record, value, rejected = false) => { if (rejected) record.payload.reject(Error("SYNTHETIC_JSON_REJECTION")); else record.payload.resolve(value === poison ? value : nested(`payload.${requests.indexOf(record)}`, { data: value })); },
    reject: (record) => record.response.reject(Error("SYNTHETIC_RESPONSE_REJECTION")),
    ui: () => {
      render(); const dialog = nodes(tree, (node) => node.props?.role === "alertdialog")[0];
      const status = nodes(tree, (node) => node.type === "p" && typeof node.props.className === "string" && node.props.className.startsWith("status"))[0];
      const physical = nodes(tree, (node) => node.type === "button" && node.props.title === "הדלקת תאורת המצלמה")[0];
      const screenshot = nodes(tree, (node) => node.type === "button" && node.props.title === "שמירת תמונה מהשידור החי")[0];
      return { dialog: text(dialog), status: text(status), warning: status.props.role === "alert", physicalDisabled: physical?.props.disabled ?? null,
        busy: screenshot.props.disabled, diagnostics: text(nodes(tree, (node) => node.type === "section" && node.props.className?.startsWith("diagnostics"))[0]) };
    },
    peekTimer: (delay) => { const values = [...timers.values()].filter((entry) => entry.delay === delay); assert.equal(values.length, 1); return values[0].fn; },
    clock: (value) => { now = value; },
    snapshot: () => plain({ requests: requests.map((r) => ({ body: r.body, jsonCalls: r.jsonCalls })), reads, writes }),
    unmount,
    cleanup: async () => { unmount(); for (const r of requests) { r.response.resolve({ ok: true, json: async () => ({}) }); r.payload.resolve({}); } await drain(); assert.equal(timers.size, 0); assert.equal(listeners.size, 0); }
  };
}
const last = (h, action) => h.requests.filter((r) => r.body.action === action).at(-1);
const count = (h, action) => h.requests.filter((r) => r.body.action === action).length;
async function boot(h) { h.start(); h.respond(last(h, "controls")); await drain(); h.ui(); }
async function prepared(h) { await boot(h); h.call("prepare"); await drain(); h.respond(last(h, "prepare")); await drain(); h.ui(); }
async function reach(h, action) {
  if (action === "controls") { h.start(); return last(h, action); }
  if (action === "prepare") { await boot(h); h.call("prepare"); await drain(); return last(h, action); }
  await prepared(h); h.call("confirm"); await drain();
  if (action === "confirm") return last(h, action);
  h.respond(last(h, "confirm")); await drain(); h.ui(); return last(h, "status");
}
for (const action of ["controls", "prepare", "confirm", "status"]) for (const stage of ["fetch", "json"]) for (const loss of ["unmount", "Site", "Source"]) for (const rejected of [false, true]) {
  test(`${action}/${stage} late ${rejected ? "rejection" : "poisoned resolution"} after ${loss} is inert`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); const record = await reach(h, action);
    if (stage === "json") { h.respond(record, { headersOnly: true }); await drain(); assert.equal(record.jsonCalls, 1); }
    if (loss === "unmount") h.unmount(); else h.scope(loss === "Site" ? SITE_B : SITE_A, loss === "Source" ? CAMERA_B : CAMERA_A);
    const before = h.snapshot(), ui = loss === "unmount" ? null : h.ui();
    if (stage === "fetch") { if (rejected) h.reject(record); else h.respond(record, { poisonResponse: true }); }
    else h.body(record, poison, rejected);
    await drain(); assert.deepEqual(h.snapshot(), before, "no late fields/state/finally/new request");
    if (ui) { assert.deepEqual(h.ui(), ui); assert.equal(h.ui().dialog, ""); assert.equal(h.ui().busy, false); }
  });
}
for (const change of ["Site", "Source"]) {
  test(`prepared A and retained confirm never survive ${change} remount; B still works`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); await prepared(h); const oldConfirm = h.handler("confirm"), oldPrepare = h.handler("prepare"), oldRefresh = h.retainedListeners[0];
    h.scope(change === "Site" ? SITE_B : SITE_A, CAMERA_B); assert.equal(h.ui().dialog, "");
    const before = h.snapshot(); oldConfirm(); oldPrepare(); oldRefresh(new Proxy({}, { get() { assert.fail("stale event detail"); } })); await drain(); assert.deepEqual(h.snapshot(), before);
    await prepared(h); assert.match(h.ui().dialog, /SYNTHETIC_B/); h.call("confirm"); await drain();
    assert.equal(count(h, "confirm"), 1); assert.equal(last(h, "confirm").scope.source, CAMERA_B);
  });
}
for (const rejected of [false, true]) {
  test(`newest same-scope controls refresh wins over older ${rejected ? "rejection" : "response"}`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); h.start(); const old = last(h, "controls"); h.refresh(); const fresh = last(h, "controls");
    h.respond(fresh, { data: { ...h.defaults(fresh), controls: ["siren"], diagnostics: "online" } }); await drain(); const before = h.snapshot(), ui = h.ui();
    if (rejected) h.reject(old); else h.respond(old, { poisonResponse: true }); await drain();
    assert.deepEqual(h.snapshot(), before); assert.deepEqual(h.ui(), ui); assert.equal(h.ui().physicalDisabled, null);
  });
}
for (const rejected of [false, true]) {
  test(`new preparation owns pending busy/result after older ${rejected ? "rejection" : "response"}`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); await boot(h); h.call("prepare"); const old = last(h, "prepare"); h.call("siren"); const fresh = last(h, "prepare");
    const before = h.snapshot(); if (rejected) h.reject(old); else h.respond(old, { poisonResponse: true }); await drain();
    assert.deepEqual(h.snapshot(), before); assert.equal(h.ui().busy, true); assert.equal(h.ui().dialog, "");
    h.respond(fresh); await drain(); assert.equal(h.ui().busy, false); assert.match(h.ui().dialog, /סירנה/);
  });
}
for (const cause of ["confirm-failure", "terminal-warning", "forty-poll-timeout"]) {
  test(`older diagnostics cannot clear newer uncertain lock from ${cause}`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); await prepared(h); const stalePrepare = h.handler("prepare"); h.refresh(); const old = last(h, "controls");
    h.call("confirm"); await drain();
    if (cause === "confirm-failure") h.respond(last(h, "confirm"), { status: 500 });
    else {
      h.respond(last(h, "confirm")); await drain();
      if (cause === "terminal-warning") { const r = last(h, "status"); h.respond(r, { data: { ...h.defaults(r), operator_warning: true, non_retryable: true } }); }
      else for (let i = 0; i < 40; i++) {
        const r = last(h, "status"); h.respond(r, { data: { ...h.defaults(r), terminal: false } }); await drain(); h.fire(1000); await drain();
      }
    }
    await drain(); assert.equal(h.ui().warning, true); assert.equal(h.ui().physicalDisabled, true);
    const before = h.snapshot(), ui = h.ui(); h.respond(old); await drain(); assert.deepEqual(h.snapshot(), before); assert.deepEqual(h.ui(), ui);
    stalePrepare(); await drain(); assert.deepEqual(h.snapshot(), before, "old unlocked closure cannot bypass current lock");
    assert.equal(count(h, "confirm"), 1);
    if (cause === "forty-poll-timeout") { assert.equal(count(h, "status"), 40); assert.equal([...h.timers.values()].some((timer) => timer.delay === 1000), false); }
  });
}
test("one explicit confirmation callback cannot send or resend twice", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await prepared(h); const confirm = h.handler("confirm"); confirm(); confirm(); await drain();
  assert.equal(count(h, "confirm"), 1); h.respond(last(h, "confirm")); await drain(); const r = last(h, "status");
  h.respond(r, { data: { ...h.defaults(r), operator_warning: true, non_retryable: true } }); await drain(); confirm(); assert.equal(count(h, "confirm"), 1);
});
for (const loss of ["unmount", "Site", "Source"]) {
  test(`poll wait is settled/canceled on ${loss}, including an already queued timer callback`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); const r = await reach(h, "status"); h.respond(r, { data: { ...h.defaults(r), terminal: false } }); await drain();
    const queued = h.peekTimer(1000); if (loss === "unmount") h.unmount(); else h.scope(loss === "Site" ? SITE_B : SITE_A, CAMERA_B);
    assert.equal([...h.timers.values()].some((timer) => timer.delay === 1000), false); const before = h.snapshot(); queued(); await drain(); assert.deepEqual(h.snapshot(), before); assert.equal(count(h, "status"), 1);
  });
}
test("current flow preserves exact prepare/nonce/ack/status contracts and refreshes only after terminal success", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await prepared(h); const prep = last(h, "prepare");
  assert.deepEqual(prep.body, { action: "prepare", request_id: prep.body.request_id, camera_source_id: CAMERA_A, camera_action: "lighting", payload: { enabled: true } });
  assert.equal(count(h, "confirm"), 0, "preparation never confirms itself"); h.call("confirm"); await drain(); const confirmation = last(h, "confirm");
  assert.deepEqual(confirmation.body, { action: "confirm", request_id: prep.body.request_id, confirmation_id: `confirmation-${prep.body.request_id}`, confirmation_nonce: "SYNTHETIC_NONCE" });
  assert.equal(count(h, "status"), 0); h.respond(confirmation); await drain();
  assert.deepEqual(last(h, "status").body, { action: "status", request_id: prep.body.request_id });
  h.respond(last(h, "status")); await drain(); assert.equal(count(h, "controls"), 2); assert.equal(h.ui().busy, true);
  h.respond(last(h, "controls")); await drain(); assert.equal(h.ui().busy, false); assert.equal(h.ui().warning, false); assert.equal(h.ui().physicalDisabled, false);
});
test("expiry refuses retained confirm even before countdown paints, then clears current modal", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await prepared(h); const confirm = h.handler("confirm"); h.clock(10001); confirm(); await drain(); assert.equal(count(h, "confirm"), 0);
  h.fire(250); assert.equal(h.ui().dialog, ""); assert.match(h.ui().status, /תוקף האישור פג/);
});
test("cancel consumes only current preparation, emits no confirm, and fences retained countdown", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await prepared(h); const confirm = h.handler("confirm"), cancel = h.handler("cancel"), tick = h.peekTimer(250);
  cancel(); const before = h.snapshot(); cancel(); confirm(); tick(); await drain(); assert.deepEqual(h.snapshot(), before); assert.equal(count(h, "confirm"), 0); assert.equal(h.ui().dialog, "");
});
test("invalid Site fails closed without server or physical work", async (t) => {
  const h = fixture({ site: "invalid" }); t.after(() => h.cleanup()); h.start(); await drain(); assert.equal(h.requests.length, 0); assert.match(h.ui().status, /שיוך האתר/);
});
const badContracts = [
  ["controls", "Site", (d) => ({ ...d, observer_site_id: SITE_B })],
  ["controls", "Source", (d) => ({ ...d, camera_source_id: CAMERA_B })],
  ["controls", "diagnostics", (d) => ({ ...d, diagnostics: "not-a-state" })],
  ["prepare", "request", (d) => ({ ...d, request_id: "wrong" })],
  ["prepare", "Site", (d) => ({ ...d, observer_site_id: SITE_B })],
  ["prepare", "Source", (d) => ({ ...d, camera_source_id: CAMERA_B })],
  ["prepare", "confirmation identity", (d) => ({ ...d, confirmation_id: d.request_id })],
  ["prepare", "confirmation type", (d) => ({ ...d, confirmation_id: 3 })],
  ["prepare", "nonce", (d) => ({ ...d, confirmation_nonce: 3 })],
  ["prepare", "expiry", (d) => ({ ...d, expires_at: 3 })],
  ["confirm", "request", (d) => ({ ...d, request_id: "wrong" })],
  ["confirm", "Site", (d) => ({ ...d, observer_site_id: SITE_B })],
  ["confirm", "execution flag", (d) => ({ ...d, executed: true })],
  ["status", "request", (d) => ({ ...d, request_id: "wrong" })],
  ["status", "Site", (d) => ({ ...d, observer_site_id: SITE_B })]
];
for (const [action, name, corrupt] of badContracts) {
  test(`current ${action} ${name} mismatch remains fail-closed`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); const record = await reach(h, action); h.respond(record, { data: corrupt(h.defaults(record)) }); await drain();
    assert.equal(h.ui().dialog, "");
    if (action === "confirm" || action === "status") { assert.equal(h.ui().warning, true); assert.equal(h.ui().physicalDisabled, true); }
    if (action === "confirm") assert.equal(count(h, "status"), 0);
    if (action === "prepare") assert.equal(count(h, "confirm"), 0);
    if (action === "controls") assert.equal(h.ui().physicalDisabled, null);
  });
}
