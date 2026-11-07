import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual runtime / enable-Push lifetime only. Native APIs, fetch, storage,
// timers and window are closed synthetic doubles, never real integrations.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-mobile-runtime.tsx");
assert.ok(statSync(file).isFile(), "regular source file required");
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "observer-mobile-runtime.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "observer-mobile-runtime.js" });
const eventName = "digital-observer:enable-native-push";
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props) => ({ type, props: props ?? {} });
function deferred() {
  let resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
async function drain() { for (let turn = 0; turn < 64; turn++) await Promise.resolve(); }

async function mount({ pauseAt = null, failAt = null, checked = "granted", requested = "granted", pushAvailable = true, sites = [] } = {}) {
  let effect, disposed = false, current = true, closed = false, timerId = 0;
  const live = () => current && !closed;
  const calls = [], callbacks = new Map(), hooks = new Map(), events = [], fetches = [], stateWrites = [], preferenceWrites = [], timers = new Map();
  const reads = { check: 0, request: 0, stale: 0 };
  const gates = { check: deferred(), request: deferred(), register: deferred() };
  const bootstrapSites = sites.length > 0;
  const path = bootstrapSites ? "/digital-observer/synthetic-settings" : "/digital-observer/login";
  const keys = { site: "digital_observer_native_push_site_v1", device: "digital_observer_native_device_reference_v1", queue: "digital_observer_mobile_offline_queue_v1" };
  const stored = new Map([[keys.site, null], [keys.device, "synthetic-device-reference"], [keys.queue, "[]"]]);
  const deny = (name) => { throw Error(`UNEXPECTED_EFFECT:${String(name)}`); };
  const permission = (stage, receive) => new Proxy({}, { get(_target, key) {
    if (key === "then") return undefined; // Host Promise assimilation, not a Product field read.
    assert.equal(key, "receive");
    if (!live()) { reads.stale++; throw Error("STALE_PERMISSION_PAYLOAD"); }
    reads[stage]++;
    return receive;
  } });
  const pluginStep = (stage) => {
    assert.ok(live(), "no stale plugin work may begin");
    calls.push(stage);
    if (pauseAt === stage) return gates[stage].promise;
    if (failAt === stage) return Promise.reject(Error(`SYNTHETIC_${stage}_REJECTION`));
    return Promise.resolve(stage === "register" ? undefined : permission(stage, stage === "check" ? checked : requested));
  };
  const addListener = async (name, callback) => {
    assert.ok(["networkStatusChange", "appStateChange", "appUrlOpen", "registration", "registrationError", "pushNotificationReceived", "pushNotificationActionPerformed"].includes(name));
    callbacks.set(name, callback); return { remove: async () => {} };
  };
  const window = {
    location: { pathname: path, origin: "https://synthetic.invalid", search: "", assign: () => deny("navigation"), replace: () => deny("replace"), reload: () => deny("reload") },
    addEventListener: (name, callback) => hooks.set(name, callback),
    removeEventListener: (name, callback) => { if (hooks.get(name) === callback) hooks.delete(name); },
    dispatchEvent: (event) => { events.push(event); return true; }
  };
  const Preferences = {
    async get({ key }) { assert.ok(bootstrapSites && stored.has(key), "unexpected storage read"); return { value: stored.get(key) }; },
    async set({ key, value }) { assert.ok(bootstrapSites && stored.has(key), "unexpected storage write"); preferenceWrites.push({ key, value }); stored.set(key, value); }
  };
  const publisher = { isCurrent: live, networkOffline: live, appInactive: live, close: () => { closed = true; } };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["react", { useEffect: (callback) => { assert.equal(effect, undefined); effect = callback; }, useState: (initial) => [typeof initial === "function" ? initial() : initial, (value) => stateWrites.push(value)] }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name) => { assert.equal(name, "PushNotifications"); return pushAvailable; }, getPlatform: () => "ios" } }],
    ["@capacitor/app", { App: { addListener, getLaunchUrl: async () => null, getInfo: async () => { assert.ok(bootstrapSites); return { version: "synthetic-version" }; } } }],
    ["@capacitor/device", { Device: { getInfo: async () => { assert.ok(bootstrapSites); return { name: "SYNTHETIC_DEVICE" }; } } }],
    ["@capacitor/network", { Network: { addListener, getStatus: async () => ({ connected: true, connectionType: "wifi" }) } }],
    ["@capacitor/preferences", { Preferences }],
    ["@capacitor/push-notifications", { PushNotifications: { addListener, checkPermissions: () => pluginStep("check"), requestPermissions: () => pluginStep("request"), register: () => pluginStep("register") } }],
    ["@/lib/domain/digital-observer/mobile-runtime", { mobileRuntimeRequiresSession: (value) => { assert.equal(value, path); return bootstrapSites; }, mobileNotificationPreview: () => deny("preview"), sanitizeOfflineQueue: (items) => { assert.ok(bootstrapSites && Array.isArray(items)); return items; } }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { openMobilePlaybackPublisher: () => publisher }]
  ]);
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    window,
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: async (url, options) => {
      assert.ok(bootstrapSites && live(), "only synthetic Site fixture may use closed fetch");
      assert.equal(options?.credentials, "same-origin");
      if (!options.method) {
        assert.equal(url, "/api/digital-observer/mobile/runtime"); assert.equal(options.cache, "no-store");
        fetches.push({ url, method: "GET" });
        return { ok: true, json: async () => ({ data: { sites } }) };
      }
      assert.equal(options.method, "POST"); assert.equal(options.headers["content-type"], "application/json");
      assert.ok(["/api/push/register", "/api/digital-observer/access-settings"].includes(url));
      fetches.push({ url, method: "POST", body: JSON.parse(options.body) });
      return { ok: true };
    },
    setTimeout: (callback, delay) => { assert.ok(bootstrapSites); assert.equal(delay, 10000); const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: (id) => { assert.ok(bootstrapSites); timers.delete(id); },
    AbortController: class { constructor() { assert.ok(bootstrapSites); this.signal = Object.freeze({ synthetic: true }); } abort() {} },
    crypto: { randomUUID: () => deny("randomUUID") }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  exports.ObserverMobileRuntime(); assert.equal(typeof effect, "function");
  const cleanup = effect(); await drain();
  assert.equal(timers.size, 0, "no live timer even for synthetic Site bootstrap");
  assert.equal(calls.length, 0, "mount must not initiate permission work");
  assert.equal(fetches.length, bootstrapSites ? 1 : 0);
  const handler = hooks.get(eventName); assert.equal(typeof handler, "function");
  const dispose = () => { if (disposed) return; disposed = true; cleanup(); };
  return {
    calls, callbacks, events, fetches, reads, gates, permission, preferenceWrites, stateWrites,
    invoke: (event = { detail: {} }) => handler(event),
    end: (transition) => { if (transition === "dispose") dispose(); else current = false; },
    dispose,
    snapshot: () => plain({ calls, events, reads, fetches, stateWrites, preferenceWrites })
  };
}
function cleanupAfter(context, harness) { context.after(async () => { harness.dispose(); await drain(); }); }
function result(harness, reason) {
  assert.deepEqual(plain(harness.events), [{ type: "digital-observer:native-push-result", detail: { ok: false, reason } }]);
}

for (const transition of ["dispose", "replace"]) for (const pushAvailable of [true, false]) {
  test(`queued enable-Push after ${transition}, plugin=${pushAvailable}, ignores poisoned event and stays quiet`, async (context) => {
    const h = await mount({ pushAvailable }); cleanupAfter(context, h);
    h.end(transition); await drain(); const before = h.snapshot(); let eventReads = 0;
    const poison = new Proxy({}, { get() { eventReads++; throw Error("STALE_ENABLE_EVENT"); } });
    await h.invoke(poison); await drain();
    assert.equal(eventReads, 0); assert.deepEqual(h.snapshot(), before);
  });
}

for (const stage of ["check", "request"]) for (const transition of ["dispose", "replace"]) {
  for (const receive of stage === "check" ? ["prompt", "granted"] : ["granted", "denied"]) {
    test(`late ${stage} ${receive} after ${transition} does not consume permission or continue`, async (context) => {
      const h = await mount({ pauseAt: stage, checked: stage === "request" ? "prompt" : "granted" }); cleanupAfter(context, h);
      const operation = h.invoke(); await drain(); assert.equal(h.calls.at(-1), stage);
      h.end(transition); await drain(); const before = h.snapshot();
      h.gates[stage].resolve(h.permission(stage, receive)); await operation; await drain();
      assert.deepEqual(h.snapshot(), before); assert.equal(h.reads.stale, 0);
    });
  }
}

for (const stage of ["check", "request", "register"]) for (const transition of ["dispose", "replace"]) {
  test(`late rejected ${stage} after ${transition} cannot emit registration_failed`, async (context) => {
    const h = await mount({ pauseAt: stage, checked: stage === "request" ? "prompt" : "granted" }); cleanupAfter(context, h);
    const operation = h.invoke(); await drain(); assert.equal(h.calls.at(-1), stage);
    h.end(transition); await drain(); const before = h.snapshot();
    h.gates[stage].reject(Error("SYNTHETIC_PERMISSION_REJECTION")); await operation; await drain();
    assert.deepEqual(h.snapshot(), before); assert.equal(h.reads.stale, 0);
  });
}

for (const checked of ["granted", "prompt", "prompt-with-rationale"]) {
  test(`healthy ${checked} preserves permission method order and register outcome`, async (context) => {
    const h = await mount({ checked }); cleanupAfter(context, h);
    await h.invoke(); await drain();
    assert.deepEqual(h.calls, checked === "granted" ? ["check", "register"] : ["check", "request", "register"]);
    assert.deepEqual(h.events, []); assert.equal(h.reads.stale, 0);
  });
}

for (const stage of ["check", "request"]) {
  test(`healthy denied ${stage} preserves permission_denied and skips register`, async (context) => {
    const h = await mount({ checked: stage === "check" ? "denied" : "prompt", requested: "denied" }); cleanupAfter(context, h);
    await h.invoke(); await drain(); result(h, "permission_denied");
    assert.deepEqual(h.calls, stage === "check" ? ["check"] : ["check", "request"]);
  });
}

test("current Push-unavailable branch correlates its request without plugin work", async (context) => {
  const h = await mount({ pushAvailable: false }); cleanupAfter(context, h);
  const detail = { siteId: "site-a", requestId: "SYNTHETIC_UNAVAILABLE_REQUEST" };
  await h.invoke({ detail }); await drain();
  assert.deepEqual(plain(h.events), [{ type: "digital-observer:native-push-result", detail: { ok: false, reason: "push_unavailable_in_qa", ...detail } }]);
  assert.deepEqual(h.calls, []);
});

for (const stage of ["check", "request", "register"]) {
  test(`current rejected ${stage} preserves registration_failed result`, async (context) => {
    const h = await mount({ failAt: stage, checked: stage === "request" ? "prompt" : "granted" }); cleanupAfter(context, h);
    await h.invoke(); await drain(); result(h, "registration_failed");
    assert.deepEqual(h.calls, stage === "check" ? ["check"] : stage === "request" ? ["check", "request"] : ["check", "register"]);
  });
}

for (const selection of ["requested", "foreign", "missing"]) {
  test(`current ${selection} Site selection keeps exact authorized choice or first-Site fallback`, async (context) => {
    const sites = [{ id: "site-a", name: "SYNTHETIC_A", timezone: null }, { id: "site-b", name: "SYNTHETIC_B", timezone: null }];
    const h = await mount({ sites }); cleanupAfter(context, h);
    await h.invoke({ detail: selection === "missing" ? {} : { siteId: selection === "requested" ? "site-b" : "foreign-site" } });
    await drain(); assert.deepEqual(h.calls, ["check", "register"]); assert.deepEqual(h.events, []);
    // Observe the pending choice via the EXISTING callback, with entirely
    // synthetic token/storage/API doubles. This is not token-flow proof.
    h.callbacks.get("registration")({ value: "SYNTHETIC_NOT_A_REAL_TOKEN" }); await drain();
    const selected = selection === "requested" ? "site-b" : "site-a";
    const deviceRequest = h.fetches.find((request) => request.url === "/api/digital-observer/access-settings");
    assert.equal(deviceRequest?.body.observer_site_id, selected);
    assert.equal(h.fetches.find((request) => request.url === "/api/push/register")?.body.metadata.observer_site_id, selected);
    assert.deepEqual(plain(h.events.at(-1)), { type: "digital-observer:native-push-result", detail: { ok: true } });
  });
}
