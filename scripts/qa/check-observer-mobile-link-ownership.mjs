import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Link-lifetime qualification of actual runtime source with closed doubles.
// The public login route skips unrelated auth/bootstrap. No real plugins,
// tokens, servers, native device, provider or media are used.
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
const source = readFileSync(file, "utf8");
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(source, {
  fileName: "observer-mobile-runtime.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "observer-mobile-runtime.js" });
const callers = ["appUrl", "launch", "push"];
const jsx = (type, props) => ({ type, props: props ?? {} });
function deferred() {
  let resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
async function drain() { for (let turn = 0; turn < 64; turn++) await Promise.resolve(); }

async function mount({ caller = "appUrl", ok = true, status = 200, destination = "/digital-observer/incidents/synthetic" } = {}) {
  let effect, current = true, closed = false, disposed = false;
  const callbacks = new Map(), hooks = new Map(), requests = [], assignments = [], events = [];
  const fetchGate = deferred(), bodyGate = deferred();
  const reads = { json: 0, ok: 0, status: 0, data: 0, destination: 0, stale: 0 };
  const link = "/digital-observer/incidents/synthetic";
  const live = () => current && !closed;
  const deny = (name) => { throw Error(`UNEXPECTED_EFFECT:${String(name)}`); };
  const readField = (key) => {
    if (!live()) { reads.stale++; throw Error(`STALE_RESPONSE_FIELD:${key}`); }
    reads[key]++;
  };
  // Promise resolution probes 'then' before Product code can guard the value.
  // Do not count that host assimilation as a Product response/payload read.
  const data = new Proxy({}, { get(_target, key) {
    if (key === "then") return undefined;
    assert.equal(key, "destination"); readField("destination"); return destination;
  } });
  const payload = new Proxy({}, { get(_target, key) {
    if (key === "then") return undefined;
    assert.equal(key, "data"); readField("data"); return data;
  } });
  const response = new Proxy({}, { get(_target, key) {
    if (key === "then") return undefined;
    assert.ok(["json", "ok", "status"].includes(key), `unexpected response field:${String(key)}`);
    readField(key);
    if (key === "json") return () => bodyGate.promise;
    return key === "ok" ? ok : status;
  } });
  const addListener = async (name, callback) => {
    assert.ok(["networkStatusChange", "appStateChange", "appUrlOpen", "registration", "registrationError", "pushNotificationReceived", "pushNotificationActionPerformed"].includes(name));
    callbacks.set(name, callback);
    return { remove: async () => {} };
  };
  const window = {
    location: { pathname: "/digital-observer/login", origin: "https://synthetic.invalid", search: "", assign: (url) => assignments.push(url), replace: () => deny("replace"), reload: () => deny("reload") },
    addEventListener: (name, callback) => hooks.set(name, callback),
    removeEventListener: (name, callback) => { if (hooks.get(name) === callback) hooks.delete(name); },
    dispatchEvent: (event) => { events.push(event); return true; }
  };
  const publisher = { isCurrent: live, networkOffline: live, appInactive: live, close: () => { closed = true; } };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["react", { useEffect: (callback) => { assert.equal(effect, undefined); effect = callback; }, useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}] }],
    ["@capacitor/app", { App: { addListener, getLaunchUrl: async () => caller === "launch" ? { url: link } : null, getInfo: () => deny("App.getInfo") } }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name) => { assert.equal(name, "PushNotifications"); return true; }, getPlatform: () => "ios" } }],
    ["@capacitor/device", { Device: { getInfo: () => deny("Device.getInfo") } }],
    ["@capacitor/network", { Network: { addListener, getStatus: async () => ({ connected: true, connectionType: "wifi" }) } }],
    ["@capacitor/preferences", { Preferences: { get: () => deny("Preferences.get"), set: () => deny("Preferences.set") } }],
    ["@capacitor/push-notifications", { PushNotifications: { addListener, checkPermissions: () => deny("checkPermissions"), requestPermissions: () => deny("requestPermissions"), register: () => deny("register") } }],
    ["@/lib/domain/digital-observer/mobile-runtime", { mobileRuntimeRequiresSession: (path) => { assert.equal(path, "/digital-observer/login"); return false; }, mobileNotificationPreview: () => deny("preview"), sanitizeOfflineQueue: () => deny("queue") }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { openMobilePlaybackPublisher: () => publisher }]
  ]);
  const exports = {};
  script.runInNewContext({
    exports,
    require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    window,
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: (url, options) => {
      assert.equal(url, "/api/digital-observer/mobile/runtime");
      assert.equal(options?.method, "POST"); assert.equal(options?.credentials, "same-origin");
      assert.equal(options?.headers["content-type"], "application/json");
      const body = JSON.parse(options.body); assert.deepEqual(body, { url: link });
      requests.push({ url, method: options.method, credentials: options.credentials, body });
      return fetchGate.promise;
    },
    setTimeout: () => deny("timer"), clearTimeout: () => deny("clearTimeout"),
    AbortController: class { constructor() { deny("auth bootstrap"); } },
    crypto: { randomUUID: () => deny("randomUUID") }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  exports.ObserverMobileRuntime();
  assert.equal(typeof effect, "function");
  const cleanup = effect();
  await drain();
  assert.equal(requests.length, caller === "launch" ? 1 : 0, "only launch may start authorization during mount");
  const trigger = () => {
    if (caller === "appUrl") callbacks.get("appUrlOpen")({ url: link });
    else if (caller === "push") callbacks.get("pushNotificationActionPerformed")({ notification: { data: { deep_link: link } } });
  };
  const dispose = () => { if (disposed) return; disposed = true; cleanup(); };
  return {
    caller, callbacks, requests, assignments, events, reads, fetchGate, bodyGate, response, payload, link, trigger, dispose,
    replace: () => { current = false; },
    end: (transition) => { if (transition === "dispose") dispose(); else current = false; }
  };
}
function cleanupAfter(context, harness) { context.after(async () => { harness.dispose(); await drain(); }); }
async function start(context, options) {
  const harness = await mount(options); cleanupAfter(context, harness);
  harness.trigger(); await drain();
  assert.equal(harness.requests.length, 1);
  return harness;
}
async function advanceToBody(harness) {
  harness.fetchGate.resolve(harness.response); await drain();
  assert.equal(harness.reads.json, 1, "body request starts while current owner is live");
  assert.equal(harness.reads.data, 0);
}
function quiet(harness, beforeReads) {
  assert.deepEqual(harness.reads, beforeReads, "no response/payload fields consumed after owner ends");
  assert.equal(harness.reads.stale, 0);
  assert.deepEqual(harness.assignments, []);
  assert.deepEqual(harness.events, [], "no stale denial or other publication");
  assert.equal(harness.requests.length, 1);
}

for (const transition of ["dispose", "replace"]) {
  test(`queued appUrlOpen after ${transition} rejects poisoned payload before requesting`, async (context) => {
    const h = await mount(); cleanupAfter(context, h);
    h.end(transition); await drain(); let payloadReads = 0;
    const poison = new Proxy({}, { get() { payloadReads++; throw Error("STALE_APP_URL_PAYLOAD"); } });
    assert.doesNotThrow(() => h.callbacks.get("appUrlOpen")(poison)); await drain();
    assert.equal(payloadReads, 0); assert.equal(h.requests.length, 0);
    assert.deepEqual(h.assignments, []); assert.deepEqual(h.events, []);
  });
}

for (const caller of callers) for (const boundary of ["fetch", "body"]) for (const transition of ["dispose", "replace"]) {
  test(`${caller} late ${boundary} success after ${transition} cannot read fields navigate or publish`, async (context) => {
    const h = await start(context, { caller });
    if (boundary === "body") await advanceToBody(h);
    h.end(transition); await drain(); const before = { ...h.reads };
    if (boundary === "fetch") h.fetchGate.resolve(h.response); else h.bodyGate.resolve(h.payload);
    await drain(); quiet(h, before);
    if (boundary === "fetch") assert.equal(h.reads.json, 0);
  });
  test(`${caller} late ${boundary} rejection after ${transition} remains quiet`, async (context) => {
    const h = await start(context, { caller });
    if (boundary === "body") await advanceToBody(h);
    h.end(transition); await drain(); const before = { ...h.reads };
    if (boundary === "fetch") h.fetchGate.reject(Error("SYNTHETIC_FETCH_REJECTION"));
    else h.bodyGate.reject(Error("SYNTHETIC_BODY_REJECTION"));
    await drain(); quiet(h, before);
  });
}

for (const caller of callers) test(`current ${caller} preserves exact server request and authorized navigation`, async (context) => {
  const h = await start(context, { caller });
  await advanceToBody(h); h.bodyGate.resolve(h.payload); await drain();
  assert.deepEqual(h.requests, [{ url: "/api/digital-observer/mobile/runtime", method: "POST", credentials: "same-origin", body: { url: h.link } }]);
  assert.deepEqual(h.assignments, [h.link]); assert.deepEqual(h.events, []);
  assert.equal(h.reads.data, 1); assert.equal(h.reads.destination, 1); assert.equal(h.reads.stale, 0);
});

for (const scenario of ["401", "wrong-prefix", "non-string", "fetch-reject", "body-reject"]) {
  test(`current owner retains denial for ${scenario}`, async (context) => {
    const h = await start(context, {
      ok: scenario !== "401", status: scenario === "401" ? 401 : 200,
      destination: scenario === "wrong-prefix" ? "/outside-observer" : scenario === "non-string" ? { invalid: true } : "/digital-observer/incidents/synthetic"
    });
    if (scenario === "fetch-reject") h.fetchGate.reject(Error("SYNTHETIC_FETCH_REJECTION"));
    else {
      await advanceToBody(h);
      if (scenario === "body-reject") h.bodyGate.reject(Error("SYNTHETIC_BODY_REJECTION"));
      else h.bodyGate.resolve(h.payload);
    }
    await drain(); assert.deepEqual(h.assignments, []); assert.equal(h.events.length, 1);
    assert.equal(h.events[0].type, "digital-observer:mobile-link-denied");
    assert.equal(h.reads.stale, 0);
  });
}

test("current Push action without a string deep_link starts no authorization", async (context) => {
  const h = await mount({ caller: "push" }); cleanupAfter(context, h);
  h.callbacks.get("pushNotificationActionPerformed")({ notification: { data: { deep_link: 7 } } }); await drain();
  assert.equal(h.requests.length, 0); assert.deepEqual(h.assignments, []); assert.deepEqual(h.events, []);
});
