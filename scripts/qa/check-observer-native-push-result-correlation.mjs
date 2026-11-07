import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import vm from "node:vm";

// Actual producer and consumer, unchanged source, closed IO. These tests cannot
// attribute a native SDK token/error to its physical provider request: the SDK
// event contains no request ID. Only JavaScript callback-entry context is bound.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ts = createRequire(import.meta.url)("typescript");
function compile(relative) {
  const file = resolve(root, relative); assert.ok(statSync(file).isFile());
  if (process.platform === "darwin") {
    const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
    assert.match(raw, /^\d+$/); const flags = Number(raw);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, "dataless source refused");
  }
  const result = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: relative, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  });
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
  return new vm.Script(result.outputText, { filename: relative + ".js" });
}
const producer = compile("components/digital-observer/observer-mobile-runtime.tsx");
const consumer = compile("components/digital-observer/observer-fcm-push-registration.tsx");
const ENABLE = "digital-observer:enable-native-push", RESULT = "digital-observer:native-push-result";
const Q = "digital_observer_mobile_offline_queue_v1", S = "digital_observer_native_push_site_v1", R = "digital_observer_native_device_reference_v1";
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
async function drain() { for (let n = 0; n < 160; n++) await Promise.resolve(); }
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
function elements(value, predicate) {
  if (Array.isArray(value)) return value.flatMap((item) => elements(item, predicate));
  if (!value || typeof value !== "object") return [];
  return [...(predicate(value) ? [value] : []), ...elements(value.props?.children, predicate)];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value && typeof value === "object") return text(value.props?.children);
  return value === null || value === undefined || typeof value === "boolean" ? "" : String(value);
}
async function fixture({ withRuntime = true, pushAvailable = true, noSites = false, receive = "granted", requestReceive = "granted", pushOk = true } = {}) {
  const bus = new Map(), retained = [], removals = new Map(), timers = new Map(), clears = new Map(), plugin = new Map();
  const emitted = [], enables = [], requests = [], storageWrites = [], uiWrites = [], runtimeWrites = [], counts = {}, reads = {}, gates = new Map();
  const store = new Map([[Q, "[]"], [S, null], [R, "SYNTHETIC_REFERENCE"]]);
  const uiJobs = [], eventJobs = []; let timer = 0, runtimeActive = true, runtimeCleanup, effect, runtimeSlot = 0, runtimeId = 0, uiId = 0;
  let currentSite = "site-a", fiber, cursor = 0, tree, uiDead = false;
  const deny = (label) => { throw Error(`UNAPPROVED_IO:${String(label)}`); };
  const packet = (label, fields) => new Proxy(fields, { get(target, key) {
    if (key === "then") return undefined;
    const name = `${label}.${String(key)}`; reads[name] = (reads[name] ?? 0) + 1; return Reflect.get(target, key);
  } });
  const step = (prefix, value, commit) => {
    const label = `${prefix}.${counts[prefix] = (counts[prefix] ?? 0) + 1}`;
    const finish = () => { commit?.(); return value; };
    return gates.has(label) ? gates.get(label).promise.then(finish) : Promise.resolve(finish());
  };
  const add = (name, fn, options) => {
    const list = bus.get(name) ?? []; const once = options === true ? false : Boolean(options?.once);
    list.push({ fn, once }); bus.set(name, list); if (name === RESULT) retained.push(fn);
  };
  const remove = (name, fn) => {
    const list = bus.get(name) ?? []; const index = list.findIndex((entry) => entry.fn === fn);
    if (index !== -1) list.splice(index, 1);
    if (name === RESULT) removals.set(fn, (removals.get(fn) ?? 0) + 1);
  };
  const dispatch = (name, detail) => {
    if (name === ENABLE) enables.push(plain(detail));
    if (name === RESULT) emitted.push(detail);
    for (const entry of [...(bus.get(name) ?? [])]) {
      if (!(bus.get(name) ?? []).includes(entry)) continue;
      // DOM once removes BEFORE callback, even when callback ignores the event.
      if (entry.once) remove(name, entry.fn);
      const result = entry.fn({ type: name, detail });
      if (result && typeof result.then === "function") eventJobs.push(result);
    }
    return true;
  };
  const timerSet = (fn, delay) => { assert.ok([10000, 30000].includes(delay)); const id = ++timer; timers.set(id, { fn, delay }); return id; };
  const timerClear = (id) => { clears.set(id, (clears.get(id) ?? 0) + 1); timers.delete(id); };
  const window = {
    location: { pathname: "/digital-observer/qa", search: "", origin: "https://synthetic.invalid", assign: () => deny("navigation"), replace: () => deny("redirect"), reload: () => deny("reload") },
    addEventListener: add, removeEventListener: remove, dispatchEvent: (event) => dispatch(event.type, event.detail), setTimeout: timerSet, clearTimeout: timerClear,
    localStorage: { getItem: () => deny("Web localStorage"), setItem: () => deny("Web localStorage") }
  };
  const common = {
    window, URL, setTimeout: timerSet, clearTimeout: timerClear,
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    AbortController: class { constructor() { this.signal = {}; } abort() {} }
  };
  const evaluate = (script, modules, extras) => {
    const exports = {};
    script.runInNewContext({ ...common, ...extras, exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); } },
      { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
    return exports;
  };
  const keyName = (key) => { assert.ok([Q, S, R].includes(key)); return key === Q ? "queue" : key === S ? "site" : "ref"; };
  const Preferences = {
    get: ({ key }) => step(`${keyName(key)}.get`, packet(`${keyName(key)}.value.${(counts[`${keyName(key)}.get`] ?? 0) + 1}`, { value: store.get(key) })),
    set: ({ key, value }) => { storageWrites.push({ key, value }); return step(`${keyName(key)}.set`, undefined, () => store.set(key, value)); }
  };
  const addPlugin = async (name, callback) => { plugin.set(name, callback); return { remove: async () => { if (plugin.get(name) === callback) plugin.delete(name); } }; };
  const runtimeModules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["react", { useState: (initial) => { const slot = runtimeSlot++; return [typeof initial === "function" ? initial() : initial, (value) => runtimeWrites.push({ slot, value })]; }, useEffect: (fn) => { assert.equal(effect, undefined); effect = fn; } }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name) => { assert.equal(name, "PushNotifications"); return pushAvailable; }, getPlatform: () => "ios" } }],
    ["@capacitor/app", { App: { addListener: addPlugin, getLaunchUrl: async () => null, getInfo: () => step("app.info", { version: "SYNTHETIC_VERSION" }) } }],
    ["@capacitor/device", { Device: { getInfo: () => step("device.info", { name: "SYNTHETIC_DEVICE" }) } }],
    ["@capacitor/network", { Network: { addListener: addPlugin, getStatus: async () => ({ connected: true, connectionType: "wifi" }) } }],
    ["@capacitor/preferences", { Preferences }],
    ["@capacitor/push-notifications", { PushNotifications: {
      addListener: addPlugin,
      checkPermissions: () => step("permission.check", packet(`permission.check.${(counts["permission.check"] ?? 0) + 1}`, { receive })),
      requestPermissions: () => step("permission.request", packet(`permission.request.${(counts["permission.request"] ?? 0) + 1}`, { receive: requestReceive })),
      register: () => step("provider.register", undefined)
    } }],
    ["@/lib/domain/digital-observer/mobile-runtime", { mobileRuntimeRequiresSession: () => true, mobileNotificationPreview: () => deny("notification"), sanitizeOfflineQueue: (items) => { assert.ok(Array.isArray(items)); return items; } }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { openMobilePlaybackPublisher: () => ({ isCurrent: () => runtimeActive, networkOffline: () => runtimeActive, appInactive: () => runtimeActive, close: () => { runtimeActive = false; } }) }]
  ]);
  if (withRuntime) {
    const mod = evaluate(producer, runtimeModules, {
      crypto: { randomUUID: () => `SYNTHETIC_RUNTIME_${++runtimeId}` },
      fetch: (url, options) => {
        assert.equal(options.credentials, "same-origin");
        if (!options.method) {
          assert.equal(url, "/api/digital-observer/mobile/runtime"); assert.equal(options.cache, "no-store");
          return Promise.resolve({ ok: true, json: async () => ({ data: { sites: noSites ? [] : [{ id: "site-a" }, { id: "site-b" }] } }) });
        }
        assert.equal(options.method, "POST"); assert.deepEqual(plain(options.headers), { "content-type": "application/json" });
        const prefix = url === "/api/push/register" ? "push.post" : url === "/api/digital-observer/access-settings" ? "access.post" : null;
        assert.ok(prefix); const body = JSON.parse(options.body); requests.push({ url, body });
        return step(prefix, packet(`${prefix}.${(counts[prefix] ?? 0) + 1}`, { ok: prefix === "push.post" ? pushOk : true }));
      }
    });
    mod.ObserverMobileRuntime(); runtimeCleanup = effect(); await drain();
    assert.ok((bus.get(ENABLE) ?? []).length === 1, "runtime control listener ready");
  }
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const pendingEffects = [];
  const React = {
    useState: (initial) => {
      const own = fiber, slot = cursor++;
      if (!own.slots[slot]) own.slots[slot] = { kind: "state", value: typeof initial === "function" ? initial() : initial };
      assert.equal(own.slots[slot].kind, "state");
      return [own.slots[slot].value, (value) => { uiWrites.push({ site: own.key, slot, dead: own.dead }); own.slots[slot].value = typeof value === "function" ? value(own.slots[slot].value) : value; }];
    },
    useRef: (initial) => {
      const slot = cursor++; if (!fiber.slots[slot]) fiber.slots[slot] = { kind: "ref", value: { current: initial } };
      assert.equal(fiber.slots[slot].kind, "ref"); return fiber.slots[slot].value;
    },
    useEffect: (fn, deps) => {
      const own = fiber, slot = cursor++;
      if (!own.slots[slot] || !same(own.slots[slot].deps, deps)) {
        const old = own.slots[slot]; own.slots[slot] = { kind: "effect", deps, cleanup: old?.cleanup };
        pendingEffects.push(() => { own.slots[slot].cleanup?.(); own.slots[slot].cleanup = fn(); });
      }
      assert.equal(own.slots[slot].kind, "effect");
    }
  };
  const uiModules = new Map([
    ["react", React], ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => true } }],
    ["firebase/app", { getApps: () => deny("getApps"), initializeApp: () => deny("initializeApp") }],
    ["firebase/messaging", Object.fromEntries(["getMessaging", "getToken", "isSupported", "onMessage"].map((name) => [name, () => deny(name)]))],
    ["lucide-react", { BellRing: "BellRing", LoaderCircle: "LoaderCircle", Send: "Send", Smartphone: "Smartphone" }],
    ["@/lib/domain/digital-observer/client-session", { readObserverAccessToken: () => deny("UI access token") }]
  ]);
  const ui = evaluate(consumer, uiModules, {
    crypto: { randomUUID: () => `SYNTHETIC_REQUEST_${++uiId}` },
    process: Object.freeze({ env: Object.freeze({ NEXT_PUBLIC_FIREBASE_API_KEY: "SYNTHETIC", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "synthetic.invalid", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "SYNTHETIC", NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "SYNTHETIC", NEXT_PUBLIC_FIREBASE_APP_ID: "SYNTHETIC", NEXT_PUBLIC_FCM_VAPID_KEY: "SYNTHETIC" }) }),
    fetch: () => deny("UI Web request"), Notification: class { constructor() { deny("Notification"); } }
  });
  const destroy = () => { if (fiber && !fiber.dead) { fiber.dead = true; for (const slot of fiber.slots) if (slot?.kind === "effect") slot.cleanup?.(); } };
  const render = () => {
    assert.equal(uiDead, false); const shell = ui.ObserverFcmPushRegistration({ siteId: currentSite });
    if (!fiber || fiber.key !== shell.key) { destroy(); fiber = { key: shell.key, slots: [], dead: false }; }
    assert.equal(typeof shell.type, "function"); cursor = 0; tree = shell.type(shell.props);
    while (pendingEffects.length) pendingEffects.shift()();
  };
  render();
  const unmount = () => { if (!uiDead) { uiDead = true; destroy(); } };
  return {
    enables, emitted, requests, storageWrites, store, counts, reads, uiWrites, runtimeWrites, retained, removals, timers, clears,
    register: () => { render(); const button = elements(tree, (node) => node.type === "button" && node.props.className === "do-button secondary")[0]; const job = button.props.onClick(); uiJobs.push(job); return job; },
    scope: (site) => { currentSite = site; render(); },
    ui: () => { render(); const buttons = elements(tree, (node) => node.type === "button"); return {
      busy: buttons[0].props.disabled, registered: !buttons[1].props.disabled,
      error: text(elements(tree, (node) => node.type === "p" && node.props.className === "do-notice warn")[0]),
      message: text(elements(tree, (node) => node.type === "p" && node.props.className === "do-notice success")[0])
    }; },
    send: (detail) => dispatch(RESULT, detail), enable: (detail) => dispatch(ENABLE, detail),
    token: (value = { value: "SYNTHETIC_PROVIDER_TOKEN" }) => { assert.ok(plugin.has("registration")); plugin.get("registration")(value); },
    providerError: () => { assert.ok(plugin.has("registrationError")); plugin.get("registrationError")(); },
    pause: (label) => { assert.equal(gates.has(label), false); const gate = deferred(); gates.set(label, gate); return gate; },
    permission: (value) => { receive = value; },
    pauseResolve: (label, reject) => { const gate = gates.get(label); assert.ok(gate); if (reject) gate.reject(Error("SYNTHETIC_REJECTION")); else gate.resolve(); },
    listenerCount: () => (bus.get(RESULT) ?? []).length,
    timeout: () => { const entries = [...timers.values()].filter((entry) => entry.delay === 30000); assert.equal(entries.length, 1); entries[0].fn(); },
    snapshot: () => plain({ counts, reads, requests, storageWrites, uiWrites, emitted, runtimeWrites }),
    unmount,
    cleanup: async () => { unmount(); runtimeCleanup?.(); for (const gate of gates.values()) gate.resolve(); await drain(); await Promise.all(uiJobs); await Promise.all(eventJobs); }
  };
}
function rejectPayload(detail) {
  Object.defineProperties(detail, { ok: { get() { assert.fail("foreign ok consumed"); } }, reason: { get() { assert.fail("foreign reason consumed"); } } });
  return detail;
}

for (const changedSite of [true, false]) {
  test(`paired runtime held A server completion cannot settle ${changedSite ? "new Site" : "same Site retry"} B`, async (t) => {
    const h = await fixture(); t.after(() => h.cleanup()); const gate = h.pause("push.post.1");
    const a = h.register(); await drain(); const tagA = h.enables[0]; h.token(); await drain(); assert.equal(h.counts["push.post"], 1);
    if (changedSite) h.scope("site-b"); const b = h.register(); await a; await drain(); const tagB = h.enables[1];
    assert.notEqual(tagA.requestId, tagB.requestId); gate.resolve(); await drain();
    assert.equal(h.emitted.length, 0, "old JS completion must not borrow B context"); assert.equal(h.ui().busy, true);
    h.send({ ...tagA, ok: changedSite, reason: "permission_denied" }); await drain();
    assert.equal(h.ui().busy, true); assert.equal(h.ui().error, ""); assert.equal(h.listenerCount(), 1);
    h.token(); await drain(); await b;
    assert.deepEqual(plain(h.emitted.at(-1)), { ok: true, ...tagB }); assert.equal(h.ui().registered, true);
    for (const tag of h.enables) {
      assert.equal(JSON.stringify(h.requests).includes(tag.requestId), false);
      assert.equal(JSON.stringify(h.storageWrites).includes(tag.requestId), false);
    }
    assert.equal(h.requests.filter((r) => r.url === "/api/digital-observer/access-settings").length, 1);
  });
}
const invalidTags = [
  ["missing", () => rejectPayload({})],
  ["foreign", () => rejectPayload({ requestId: "FOREIGN", siteId: "site-a" })],
  ["wrong Site", (tag) => rejectPayload({ ...tag, siteId: "site-b" })],
  ["empty", (tag) => rejectPayload({ ...tag, requestId: "" })],
  ["oversized", (tag) => rejectPayload({ ...tag, requestId: "x".repeat(129) })],
  ["number", (tag) => rejectPayload({ ...tag, requestId: 17 })],
  ["null", () => null], ["primitive", () => "UNSCOPED"]
];
for (const [name, create] of invalidTags) {
  test(`consumer ignores ${name} identity then accepts matching result under real DOM once semantics`, async (t) => {
    const h = await fixture({ withRuntime: false }); t.after(() => h.cleanup()); const pending = h.register(); const tag = h.enables[0];
    const writes = h.uiWrites.length, timerCount = h.timers.size; h.send(create(tag)); await drain();
    assert.equal(h.uiWrites.length, writes); assert.equal(h.ui().busy, true); assert.equal(h.listenerCount(), 1); assert.equal(h.timers.size, timerCount);
    h.send({ ...tag, ok: true }); await pending;
    assert.equal(h.ui().registered, true); assert.equal(h.listenerCount(), 0); assert.equal(h.removals.get(h.retained[0]), 1);
  });
}
test("foreign event does not clear the absolute native timeout", async (t) => {
  const h = await fixture({ withRuntime: false }); t.after(() => h.cleanup()); const pending = h.register();
  h.send({ requestId: "FOREIGN", siteId: "site-a", ok: true }); h.timeout(); await pending;
  assert.equal(h.ui().registered, false); assert.match(h.ui().error, /רישום ה־Push במכשיר לא הושלם/); assert.equal(h.listenerCount(), 0);
});
test("matched failure preserves messages and manually releases once", async (t) => {
  const h = await fixture({ withRuntime: false }); t.after(() => h.cleanup()); const pending = h.register(); const tag = h.enables[0];
  h.send({ ...tag, ok: false, reason: "permission_denied" }); await pending;
  assert.match(h.ui().error, /הרשאת ההתראות לא אושרה/); const before = h.uiWrites.length;
  h.send({ ...tag, ok: true }); h.unmount(); assert.equal(h.uiWrites.length, before); assert.equal(h.removals.get(h.retained[0]), 1);
});
for (const malformed of [{ ok: "yes" }, { ok: false, reason: 7 }]) {
  test(`matched identity with malformed result ${JSON.stringify(malformed)} stays pending`, async (t) => {
    const h = await fixture({ withRuntime: false }); t.after(() => h.cleanup()); const pending = h.register(), tag = h.enables[0];
    h.send({ ...tag, ...malformed }); await drain(); assert.equal(h.ui().busy, true); assert.equal(h.listenerCount(), 1);
    h.send({ ...tag, ok: true }); await pending; assert.equal(h.ui().registered, true);
  });
}
test("canceled correlated waiter refuses even to read retained event detail", async (t) => {
  const h = await fixture({ withRuntime: false }); t.after(() => h.cleanup()); const pending = h.register(); h.unmount(); await pending;
  const before = h.uiWrites.length; h.retained[0](new Proxy({}, { get() { assert.fail("stale detail read"); } }));
  assert.equal(h.uiWrites.length, before); assert.equal(h.removals.get(h.retained[0]), 1);
});
for (const boundary of ["site.get.2", "device.info.1", "ref.get.1", "push.post.1", "access.post.1", "site.set.1", "queue.get.2", "queue.set.2"]) for (const rejection of [false, true]) {
  test(`callback-entry context fenced at ${boundary} after newer attempt (${rejection ? "reject" : "resolve"})`, async (t) => {
    const h = await fixture(); t.after(() => h.cleanup()); h.pause(boundary); const a = h.register(); await drain(); h.token(); await drain();
    assert.equal(h.counts[boundary.slice(0, boundary.lastIndexOf("."))], Number(boundary.slice(boundary.lastIndexOf(".") + 1)));
    h.scope("site-b"); const b = h.register(); await a; await drain();
    const before = h.snapshot(); h.pauseResolve(boundary, rejection); await drain();
    assert.deepEqual(h.snapshot(), before, "stale fields, IO and result must not advance after snapshot"); assert.equal(h.ui().busy, true);
    h.token(); await drain(); await b; assert.equal(h.ui().registered, true);
    assert.deepEqual(plain(h.emitted.at(-1)), { ok: true, ...h.enables.at(-1) });
  });
}
for (const boundary of ["permission.check.1", "permission.request.1", "provider.register.1"]) for (const rejection of [false, true]) {
  test(`old permission invocation ${boundary} cannot publish under newer request (${rejection ? "reject" : "resolve"})`, async (t) => {
    const h = await fixture({ receive: boundary.startsWith("permission.request") ? "prompt" : "granted" }); t.after(() => h.cleanup());
    h.pause(boundary); const a = h.register(); await drain(); h.permission("granted"); const b = h.register(); await a; await drain();
    const before = h.snapshot(); h.pauseResolve(boundary, rejection); await drain();
    assert.deepEqual(h.snapshot(), before); assert.equal(h.ui().busy, true);
    h.token(); await drain(); await b; assert.deepEqual(plain(h.emitted.at(-1)), { ok: true, ...h.enables.at(-1) });
  });
}
for (const scenario of ["denied", "request-denied", "unavailable", "site-required", "registration-failed", "provider-error"]) {
  test(`actual runtime ${scenario} retains originating UI request and Site`, async (t) => {
    const h = await fixture({ receive: scenario === "denied" ? "denied" : scenario === "request-denied" ? "prompt" : "granted", requestReceive: "denied", pushAvailable: scenario !== "unavailable", noSites: scenario === "site-required", pushOk: scenario !== "registration-failed" });
    t.after(() => h.cleanup()); const pending = h.register(); await drain();
    if (scenario === "site-required" || scenario === "registration-failed") h.token();
    else if (scenario === "provider-error") h.providerError();
    await drain(); await pending;
    const reasons = { denied: "permission_denied", "request-denied": "permission_denied", unavailable: "push_unavailable_in_qa", "site-required": "site_required", "registration-failed": "registration_failed", "provider-error": "provider_error" };
    assert.deepEqual(plain(h.emitted.at(-1)), { ok: false, reason: reasons[scenario], ...h.enables[0] });
    assert.equal(h.ui().registered, false); assert.equal(h.ui().busy, false);
  });
}
for (const requestId of [undefined, "", "x".repeat(129), 7, null]) {
  test(`legacy runtime optional requestId ${String(requestId).slice(0, 15)} retains untagged result shape`, async (t) => {
    const h = await fixture(); t.after(() => h.cleanup());
    h.enable({ siteId: "site-a", ...(requestId === undefined ? {} : { requestId }) }); await drain(); h.token(); await drain();
    assert.deepEqual(plain(h.emitted.at(-1)), { ok: true });
    assert.equal(h.requests.filter((r) => r.url === "/api/push/register").length, 1);
  });
}
test("untagged callback without enable remains legacy; no device ID is fabricated", async (t) => {
  const h = await fixture(); t.after(() => h.cleanup()); h.token(); await drain();
  assert.deepEqual(plain(h.emitted.at(-1)), { ok: true }); assert.equal(h.enables.length, 0);
});
test("bounded 128-character tagged runtime request is echoed only in result metadata", async (t) => {
  const h = await fixture(); t.after(() => h.cleanup()); const requestId = "r".repeat(128);
  h.enable({ siteId: "site-b", requestId }); await drain(); h.token(); await drain();
  assert.deepEqual(plain(h.emitted.at(-1)), { ok: true, requestId, siteId: "site-b" });
  assert.equal(JSON.stringify(h.requests).includes(requestId), false); assert.equal(JSON.stringify(h.storageWrites).includes(requestId), false);
  assert.equal(h.requests[0].body.metadata.observer_site_id, "site-b");
});
test("native SDK error has no origin ID: only current callback-entry context can be labeled", async (t) => {
  const h = await fixture(); t.after(() => h.cleanup()); const a = h.register(); await drain(); h.scope("site-b"); const b = h.register(); await a; await drain();
  h.providerError(); await b;
  assert.deepEqual(plain(h.emitted.at(-1)), { ok: false, reason: "provider_error", ...h.enables[1] });
  // This deliberately documents the remaining vendor-event ambiguity. It is
  // NOT evidence that this SDK error physically originated from request B.
});
test("existing Site fallback never labels success as a different requested Site", async (t) => {
  const h = await fixture(); t.after(() => h.cleanup());
  h.enable({ siteId: "unavailable-site", requestId: "SYNTHETIC_FALLBACK" }); await drain(); h.token(); await drain();
  assert.equal(h.requests[0].body.metadata.observer_site_id, "site-a");
  assert.deepEqual(plain(h.emitted.at(-1)), { ok: true, requestId: "SYNTHETIC_FALLBACK", siteId: "site-a" });
});
