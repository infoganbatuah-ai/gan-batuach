import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { setImmediate as hostImmediate } from "node:timers";
import vm from "node:vm";

// FIRST fixed-source tests, not the blocked baseline. Actual component runtime
// with closed native doubles. No process-global rejection/error interception.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-mobile-runtime.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/); const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "observer-mobile-runtime.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "observer-mobile-runtime.js" });
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props) => ({ type, props: props ?? {} });
const nonPush = ["networkStatusChange", "appStateChange", "appUrlOpen"];
const all = [...nonPush, "registration", "registrationError", "pushNotificationReceived", "pushNotificationActionPerformed"];
function deferred() {
  let resolvePromise;
  const promise = new Promise((resolveValue) => { resolvePromise = resolveValue; });
  return { promise, resolve: resolvePromise };
}
async function drain() { for (let n = 0; n < 96; n++) await Promise.resolve(); }
async function hostTurn() {
  await drain();
  // Node's own test runner must see any detached unhandled rejection. A host
  // event-loop turn is observation, not a Capacitor/app/product timer.
  await new Promise((done) => hostImmediate(done));
  await drain();
}
async function mount({ failures = {}, late = null } = {}) {
  let current = true, disposed = false, closed = false, effect, slot = 0;
  const live = () => current && !disposed && !closed;
  const gate = deferred(), adds = [], removals = [], callbacks = new Map(), hooks = new Map();
  const states = [], events = [], io = [], handles = new Map();
  const deny = (label) => { io.push(label); throw Error(`UNEXPECTED_IO:${String(label)}`); };
  const addListener = (name, callback) => {
    assert.ok(live(), `stale acquisition:${name}`); assert.ok(all.includes(name));
    assert.equal(handles.has(name), false, "no duplicate subscription");
    adds.push(name); callbacks.set(name, callback);
    const handle = { count: 0, remove: () => {
      handle.count++; removals.push(name);
      if (failures[name] === "throw") throw Error(`SYNTHETIC_SYNC_REMOVE:${name}`);
      if (failures[name] === "reject") return Promise.reject(Error(`SYNTHETIC_REJECT_REMOVE:${name}`));
      return Promise.resolve();
    } };
    handles.set(name, handle);
    return name === late ? gate.promise.then(() => handle) : Promise.resolve(handle);
  };
  const window = {
    location: { pathname: "/digital-observer/login", origin: "https://synthetic.invalid", search: "", assign: () => deny("navigation"), replace: () => deny("redirect"), reload: () => deny("reload") },
    addEventListener: (name, callback) => { assert.ok(live()); hooks.set(name, callback); },
    removeEventListener: (name, callback) => { if (hooks.get(name) === callback) hooks.delete(name); },
    dispatchEvent: (event) => { assert.ok(live(), "no cleanup-driven or stale event"); events.push(plain(event)); return true; }
  };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["react", { useEffect: (fn) => { assert.equal(effect, undefined); effect = fn; }, useState: (value) => {
      const index = slot++; return [typeof value === "function" ? value() : value, (next) => { assert.ok(live(), "no stale state setter"); states.push({ index, next }); }];
    } }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name) => { assert.equal(name, "PushNotifications"); return true; }, getPlatform: () => deny("platform") } }],
    ["@capacitor/app", { App: { addListener, getLaunchUrl: async () => { assert.ok(live()); return null; }, getInfo: () => deny("App.getInfo") } }],
    ["@capacitor/device", { Device: { getInfo: () => deny("Device.getInfo") } }],
    ["@capacitor/network", { Network: { addListener, getStatus: async () => ({ connected: true, connectionType: "wifi" }) } }],
    ["@capacitor/preferences", { Preferences: { get: () => deny("Preferences.get"), set: () => deny("Preferences.set") } }],
    ["@capacitor/push-notifications", { PushNotifications: { addListener, checkPermissions: () => deny("Push.checkPermissions"), requestPermissions: () => deny("Push.requestPermissions"), register: () => deny("Push.register") } }],
    ["@/lib/domain/digital-observer/mobile-runtime", { mobileRuntimeRequiresSession: (path) => { assert.equal(path, "/digital-observer/login"); return false; }, mobileNotificationPreview: () => deny("preview"), sanitizeOfflineQueue: () => deny("sanitize") }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { openMobilePlaybackPublisher: () => ({ isCurrent: live, networkOffline: () => live(), appInactive: () => live(), close: () => { closed = true; } }) }]
  ]);
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    window, URL,
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: () => deny("fetch"),
    setTimeout: () => deny("app timeout"), clearTimeout: () => deny("app clearTimeout"),
    AbortController: class { constructor() { deny("AbortController"); } },
    crypto: { randomUUID: () => deny("UUID") }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  exports.ObserverMobileRuntime(); assert.equal(typeof effect, "function"); const cleanup = effect(); await drain();
  return {
    adds, removals, handles, hooks, callbacks, io,
    release: () => gate.resolve(),
    replace: () => { current = false; },
    // Intentionally invoke the actual cleanup repeatedly, not a harness-side
    // once wrapper that would hide duplicate Product removal attempts.
    dispose: () => { disposed = true; cleanup(); },
    effects: () => plain({ states, events, io, adds }),
    finish: async () => { disposed = true; cleanup(); gate.resolve(); await hostTurn(); }
  };
}
function countsOnce(h, expected) {
  for (const name of expected) assert.equal(h.handles.get(name)?.count, 1, `exactly one removal:${name}`);
  assert.equal(h.removals.length, expected.length, "no removal retry");
}
for (const name of nonPush) for (const failure of ["throw", "reject"]) {
  test(`owned ${name} ${failure} cannot escape or skip later cleanup`, async (t) => {
    const h = await mount({ failures: { [name]: failure } }); t.after(() => h.finish());
    assert.deepEqual(h.adds, all); assert.deepEqual(h.adds.slice(0, 2), nonPush.slice(0, 2));
    const before = h.effects();
    h.dispose(); h.dispose(); await hostTurn();
    countsOnce(h, all); assert.deepEqual(h.effects(), before); assert.equal(h.hooks.size, 0);
  });
}
for (const [name, failures] of [
  ["all rejected", Object.fromEntries(nonPush.map((key) => [key, "reject"]))],
  ["all synchronous", Object.fromEntries(nonPush.map((key) => [key, "throw"]))],
  ["mixed", { networkStatusChange: "throw", appStateChange: "reject", appUrlOpen: "throw" }]
]) {
  test(`multiple ${name} cleanup failures still attempt every acquired handle once`, async (t) => {
    const h = await mount({ failures }); t.after(() => h.finish()); assert.deepEqual(h.adds, all);
    const before = h.effects(); h.dispose(); await hostTurn(); h.dispose(); await hostTurn();
    countsOnce(h, all); assert.deepEqual(h.effects(), before); assert.equal(h.io.length, 0);
  });
}
for (const name of nonPush) for (const loss of ["dispose", "replacement"]) for (const failure of ["throw", "reject"]) {
  test(`late ${name} after ${loss}, removal ${failure}, is safely owned once`, async (t) => {
    const h = await mount({ late: name, failures: { [name]: failure } }); t.after(() => h.finish());
    const expected = name === "appUrlOpen" ? nonPush : nonPush.slice(0, 2);
    assert.deepEqual(h.adds, expected, "preserve independent early acquisitions and blocked startup");
    assert.equal(h.handles.get(name).count, 0, "pending handle has not resolved");
    if (loss === "dispose") h.dispose(); else h.replace();
    const before = h.effects(); h.release(); await hostTurn();
    assert.equal(h.handles.get(name).count, 1); assert.deepEqual(h.effects(), before, "late acquisition cannot resume startup/state/API work");
    h.dispose(); h.dispose(); await hostTurn(); countsOnce(h, expected);
    assert.deepEqual(h.effects(), before); assert.equal(h.hooks.size, 0);
    // Retained queued non-Push callbacks must not produce state/API work.
    await h.callbacks.get("networkStatusChange")({ connected: true, connectionType: "wifi" });
    await h.callbacks.get("appStateChange")({ isActive: true });
    if (h.callbacks.has("appUrlOpen")) h.callbacks.get("appUrlOpen")(new Proxy({}, { get() { assert.fail("stale URL read"); } }));
    await hostTurn(); assert.deepEqual(h.effects(), before);
  });
}
