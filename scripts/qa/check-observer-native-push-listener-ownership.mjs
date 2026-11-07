import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual runtime, closed native/plugin/window/timer/network doubles. A PUBLIC login
// route deliberately skips auth bootstrap. No real token, device, provider or media.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-mobile-runtime.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: "observer-mobile-runtime.tsx", reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
const runtimeScript = new vm.Script(output.outputText, { filename: "observer-mobile-runtime.js" });
const names = ["registration", "registrationError", "pushNotificationReceived", "pushNotificationActionPerformed"];
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function text(value) {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value == null || typeof value === "boolean") return "";
  return typeof value === "object" ? text(value.props?.children) : typeof value === "function" ? "" : String(value);
}
function deferred() {
  let resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
async function drain() { for (let turn = 0; turn < 64; turn++) await Promise.resolve(); }

async function mount({ pauseAt = -1, rejectAt = -1, savedSite = null, destination = "/digital-observer/incidents/synthetic", removalReject = [], pushAvailable = true } = {}) {
  let effect, closed = false, current = true, disposedOnce = false, cleanup;
  let previewCalls = 0, deviceCalls = 0, appInfoCalls = 0, permissionCalls = 0, registerCalls = 0, stateIndex = 0;
  const gate = deferred(), callbacks = new Map(), handles = [], pushCalls = [], nativeCalls = [], windowHooks = new Map(), windowAttempts = [], events = [], fetches = [], assignments = [], preferenceGets = [], preferenceSets = [], stateWrites = [], previewInputs = [];
  const preview = Object.freeze({ title: "SANITIZED_SYNTHETIC_TITLE", body: "SANITIZED_SYNTHETIC_BODY" });
  const keys = { site: "digital_observer_native_push_site_v1", device: "digital_observer_native_device_reference_v1", queue: "digital_observer_mobile_offline_queue_v1" };
  const stored = new Map([[keys.site, savedSite], [keys.device, "synthetic-device-reference"], [keys.queue, "[]"]]);
  function deny(name = "effect") { throw new Error(`UNEXPECTED_NATIVE_OR_NETWORK_EFFECT:${String(name)}`); }
  function handle(name) {
    const acquired = { name, removed: 0, async remove() { acquired.removed++; if (removalReject.includes(name)) throw new Error("SYNTHETIC_REMOVE_REJECTION"); } };
    handles.push(acquired);
    return acquired;
  }
  const window = {
    location: { pathname: "/digital-observer/login", origin: "https://synthetic.invalid", search: "", assign: (value) => assignments.push(value), replace: () => deny("replace"), reload: () => deny("reload") },
    dispatchEvent(event) { events.push(event); return true; },
    addEventListener(name, callback) { windowAttempts.push({ name, live: current && !closed }); windowHooks.set(name, callback); },
    removeEventListener(name, callback) { if (windowHooks.get(name) === callback) windowHooks.delete(name); },
  };
  const publisher = { isCurrent: () => current && !closed, networkOffline: () => current && !closed, appInactive: () => current && !closed, close: () => { closed = true; } };
  const App = {
    async addListener(name, callback) { nativeCalls.push(`App:${name}`); callbacks.set(name, callback); return handle(name); },
    async getLaunchUrl() { nativeCalls.push("App:getLaunchUrl"); return null; },
    async getInfo() { appInfoCalls++; return { version: "synthetic-version" }; },
  };
  const Network = {
    async addListener(name, callback) { nativeCalls.push(`Network:${name}`); callbacks.set(name, callback); return handle(name); },
    async getStatus() { nativeCalls.push("Network:getStatus"); return { connected: true, connectionType: "wifi" }; },
  };
  const PushNotifications = {
    addListener(name, callback) {
      const stage = names.indexOf(name); assert.ok(stage >= 0); assert.equal(stage, pushCalls.length);
      pushCalls.push(name); callbacks.set(name, callback);
      if (stage === pauseAt || stage === rejectAt) return gate.promise.then(() => handle(name));
      return Promise.resolve(handle(name));
    },
    async checkPermissions() { permissionCalls++; return { receive: "granted" }; },
    async requestPermissions() { permissionCalls++; return { receive: "granted" }; },
    async register() { registerCalls++; },
  };
  const Preferences = {
    async get({ key }) { assert.ok(stored.has(key), "unknown Preferences key"); preferenceGets.push(key); return { value: stored.get(key) }; },
    async set({ key, value }) { assert.ok(stored.has(key), "unknown Preferences key"); preferenceSets.push({ key, value }); stored.set(key, value); },
  };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["react", { useEffect: (callback) => { assert.equal(effect, undefined); effect = callback; }, useState: (initial) => { const slot = stateIndex++; return [typeof initial === "function" ? initial() : initial, (value) => stateWrites.push({ slot, value })]; } }],
    ["@capacitor/app", { App }], ["@capacitor/core", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name) => { assert.equal(name, "PushNotifications"); return pushAvailable; }, getPlatform: () => "ios" } }],
    ["@capacitor/device", { Device: { getInfo: async () => { deviceCalls++; return { name: "SYNTHETIC_DEVICE" }; } } }],
    ["@capacitor/network", { Network }], ["@capacitor/preferences", { Preferences }], ["@capacitor/push-notifications", { PushNotifications }],
    ["@/lib/domain/digital-observer/mobile-runtime", { mobileRuntimeRequiresSession: (path) => { assert.equal(path, "/digital-observer/login"); return false; }, mobileNotificationPreview: (notification) => { previewCalls++; previewInputs.push(notification); return preview; }, sanitizeOfflineQueue: (items) => items }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { openMobilePlaybackPublisher: () => publisher }],
  ]);
  const exports = {};
  runtimeScript.runInNewContext({
    exports, require: (name) => modules.has(name) ? modules.get(name) : deny(name), window,
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: async (url, options) => {
      assert.equal(options?.method, "POST"); assert.equal(options?.credentials, "same-origin");
      assert.equal(options.headers["content-type"], "application/json");
      assert.ok(["/api/digital-observer/mobile/runtime", "/api/push/register", "/api/digital-observer/access-settings"].includes(url));
      const body = JSON.parse(options.body); fetches.push({ url, options: { method: options.method, credentials: options.credentials }, body });
      return { ok: true, status: 200, json: async () => ({ data: { destination } }) };
    },
    crypto: { randomUUID: () => deny("randomUUID") },
    setTimeout: () => deny("timer"), clearTimeout: () => deny("clearTimeout"), AbortController: class { constructor() { deny("auth bootstrap"); } },
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const initialUI = exports.ObserverMobileRuntime();
  assert.equal(typeof effect, "function"); cleanup = effect();
  await drain();
  assert.deepEqual(nativeCalls.slice(0, 3), ["Network:networkStatusChange", "App:appStateChange", "Network:getStatus"], "independent early App/Network subscriptions preserved");
  assert.equal(fetches.length, 0, "public route fixture must not run auth bootstrap");
  function dispose() { if (disposedOnce) return; disposedOnce = true; cleanup(); }
  function snapshot() { return [events.length, fetches.length, previewCalls, preferenceGets.length, preferenceSets.length, deviceCalls, appInfoCalls, permissionCalls, registerCalls, stateWrites.length, assignments.length]; }
  return { gate, callbacks, handles, pushCalls, nativeCalls, windowHooks, windowAttempts, events, fetches, assignments, preferenceGets, preferenceSets, stateWrites, previewInputs, keys, preview, initialUI, dispose, replace: () => { current = false; }, snapshot, drain };
}
function allRemovedOnce(harness) { for (const handle of harness.handles) assert.equal(handle.removed, 1, `acquired ${handle.name} removed once`); }
function pushRemovedOnce(harness) { for (const handle of harness.handles.filter((item) => names.includes(item.name))) assert.equal(handle.removed, 1, `Push ${handle.name} removed once`); }
function afterCleanup(context, harness) { context.after(async () => { harness.dispose(); await drain(); }); }

for (const transition of ["dispose", "replace"]) for (let stage = 0; stage < 4; stage++) test(`late ${names[stage]} acquisition after ${transition} is removed and cannot resume startup`, async (context) => {
  const harness = await mount({ pauseAt: stage }); afterCleanup(context, harness);
  assert.equal(harness.pushCalls.length, stage + 1);
  if (transition === "dispose") harness.dispose(); else harness.replace();
  harness.gate.resolve(); await drain();
  assert.equal(harness.handles.find((handle) => handle.name === names[stage]).removed, 1);
  assert.deepEqual(harness.pushCalls, names.slice(0, stage + 1));
  assert.equal(harness.windowHooks.size, 0); assert.deepEqual(harness.windowAttempts, []);
  harness.dispose(); await drain(); pushRemovedOnce(harness); allRemovedOnce(harness);
});
for (let stage = 0; stage < 4; stage++) test(`Push rejection at stage ${stage} keeps its successful prefix cleanup-owned`, async (context) => {
  const harness = await mount({ rejectAt: stage }); afterCleanup(context, harness);
  harness.gate.reject(new Error("SYNTHETIC_REGISTRATION_REJECTION")); await drain();
  assert.deepEqual(harness.pushCalls, names.slice(0, stage + 1));
  assert.equal(harness.handles.filter((handle) => names.includes(handle.name)).length, stage);
  assert.equal(harness.windowHooks.size, 0); assert.deepEqual(harness.windowAttempts, []);
  harness.dispose(); await drain(); allRemovedOnce(harness);
});
for (const transition of ["dispose", "replace"]) for (const name of names) test(`queued ${name} callback after ${transition} cannot read poisoned payload or start effects`, async (context) => {
  const harness = await mount(); afterCleanup(context, harness);
  assert.equal(harness.pushCalls.length, 4);
  if (transition === "dispose") harness.dispose(); else harness.replace();
  await drain(); const before = harness.snapshot(); let payloadReads = 0;
  const poison = new Proxy({}, { get() { payloadReads++; throw new Error("STALE_PUSH_PAYLOAD"); } });
  harness.callbacks.get(name)(poison); await drain();
  assert.equal(payloadReads, 0); assert.deepEqual(harness.snapshot(), before);
});
test("healthy current owner registers exactly four Push listeners two window hooks and cleans all once", async (context) => {
  const harness = await mount(); afterCleanup(context, harness);
  assert.deepEqual(harness.pushCalls, names);
  assert.deepEqual(Array.from(harness.windowHooks.keys()), ["digital-observer:enable-native-push", "pageshow"]);
  assert.ok(harness.windowAttempts.every((attempt) => attempt.live));
  assert.ok(harness.handles.every((handle) => handle.removed === 0));
  harness.dispose(); await drain(); allRemovedOnce(harness); assert.equal(harness.windowHooks.size, 0);
});
test("current registration error and received callback keep original event and preview binding", async (context) => {
  const harness = await mount(); afterCleanup(context, harness);
  harness.callbacks.get("registrationError")();
  const notification = { title: "SYNTHETIC_RAW_TITLE" };
  harness.callbacks.get("pushNotificationReceived")(notification); await drain();
  assert.deepEqual(plain(harness.events[0]), { type: "digital-observer:native-push-result", detail: { ok: false, reason: "provider_error" } });
  assert.equal(harness.events[1].type, "digital-observer:native-notification"); assert.equal(harness.events[1].detail, harness.preview);
  assert.equal(harness.previewInputs[0], notification);
  assert.equal(harness.snapshot()[2], 1);
});
test("current action callback retains server authorization before opening allowed destination", async (context) => {
  const harness = await mount(); afterCleanup(context, harness);
  const link = "/digital-observer/incidents/synthetic";
  harness.callbacks.get("pushNotificationActionPerformed")({ notification: { data: { deep_link: link } } }); await drain();
  assert.deepEqual(harness.fetches, [{ url: "/api/digital-observer/mobile/runtime", options: { method: "POST", credentials: "same-origin" }, body: { url: link } }]);
  assert.deepEqual(harness.assignments, [link]);
});
test("current action callback denies a server destination outside the Observer path", async (context) => {
  const harness = await mount({ destination: "/outside-observer" }); afterCleanup(context, harness);
  harness.callbacks.get("pushNotificationActionPerformed")({ notification: { data: { deep_link: "/digital-observer/incidents/synthetic" } } }); await drain();
  assert.deepEqual(harness.assignments, []); assert.ok(harness.events.some((event) => event.type === "digital-observer:mobile-link-denied"));
});
test("current registration callback enters existing handler and preserves site-required result", async (context) => {
  const harness = await mount(); afterCleanup(context, harness);
  harness.callbacks.get("registration")({ value: "SYNTHETIC_NOT_A_REAL_TOKEN" }); await drain();
  assert.deepEqual(harness.preferenceGets, [harness.keys.site]); assert.equal(harness.fetches.length, 0);
  assert.deepEqual(plain(harness.events.at(-1)), { type: "digital-observer:native-push-result", detail: { ok: false, reason: "site_required" } });
});
test("current registration preserves synthetic token payload Preferences keys and successful handler result", async (context) => {
  const harness = await mount({ savedSite: "synthetic-site" }); afterCleanup(context, harness);
  harness.callbacks.get("registration")({ value: "SYNTHETIC_NOT_A_REAL_TOKEN" }); await drain();
  assert.deepEqual(harness.fetches.map((request) => request.url), ["/api/push/register", "/api/digital-observer/access-settings"]);
  assert.deepEqual(harness.fetches[0].body, { platform: "ios", device_token: "SYNTHETIC_NOT_A_REAL_TOKEN", device_id: "synthetic-device-reference", app_version: "synthetic-version", metadata: { source: "digital_observer_native", observer_site_id: "synthetic-site" } });
  assert.deepEqual(harness.fetches[1].body, { action: "register_device", observer_site_id: "synthetic-site", device_label: "SYNTHETIC_DEVICE", platform: "ios", device_reference: "synthetic-device-reference" });
  assert.deepEqual(harness.preferenceGets, [harness.keys.site, harness.keys.device, harness.keys.queue]);
  assert.deepEqual(plain(harness.preferenceSets), [{ key: harness.keys.site, value: "synthetic-site" }, { key: harness.keys.queue, value: "[]" }]);
  assert.deepEqual(plain(harness.events.at(-1)), { type: "digital-observer:native-push-result", detail: { ok: true } });
});
test("rejected Push remove is attempted once without a retry or unhandled cleanup rejection", async (context) => {
  const harness = await mount({ removalReject: ["registration"] }); afterCleanup(context, harness);
  harness.dispose(); await drain(); pushRemovedOnce(harness); allRemovedOnce(harness);
});
test("Push-unavailable QA path preserves banner and adds no Push listener or permission effect", async (context) => {
  const harness = await mount({ pushAvailable: false }); afterCleanup(context, harness);
  assert.deepEqual(harness.pushCalls, []); assert.ok(text(harness.initialUI).includes("Push כבוי בבניית QA זו"));
  assert.equal(harness.windowHooks.size, 2); assert.ok(harness.windowAttempts.every((attempt) => attempt.live));
  harness.dispose(); await drain(); allRemovedOnce(harness);
});
