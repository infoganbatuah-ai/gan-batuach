import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const source = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
const compile = (input) => ts.transpileModule(input, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const js = compile(source);
const pushRequest = { exports: {} };
vm.runInNewContext(compile(readFileSync(new URL("../../lib/domain/digital-observer/native-push-request.ts", import.meta.url), "utf8")), pushRequest);
const queueKey = "digital_observer_mobile_offline_queue_v1";
const siteKey = "digital_observer_native_push_site_v1";
const ownerKey = "digital_observer_native_push_owner_v1";
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };

function runtime(initial, permission = {}) {
  const values = new Map(initial);
  const calls = [];
  const listeners = new Map();
  const appListeners = new Map();
  const results = [];
  let cleanup;
  let now = 0;
  const preferences = {
    get: async ({ key }) => ({ value: values.get(key) ?? null }),
    set: async ({ key, value }) => { calls.push(["set", key]); values.set(key, value); },
    remove: async ({ key }) => { calls.push(["remove", key]); values.delete(key); }
  };
  const plugin = {
    Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true, getPlatform: () => "android" },
    App: { addListener: async (name, callback) => {
      appListeners.set(name, callback);
      return { remove: async () => appListeners.delete(name) };
    }, getLaunchUrl: async () => null,
      getInfo: async () => ({ id: "com.ganbatuach.app", version: "1.0-qa" }) },
    Network: { addListener: async () => ({ remove: async () => {} }), getStatus: async () => ({ connected: true }) },
    Device: { getInfo: async () => ({ name: "synthetic" }) }, Preferences: preferences,
    PushNotifications: {
      checkPermissions: permission.check ?? (async () => ({ receive: "granted" })),
      requestPermissions: async () => {
        calls.push(["push-prompt"]);
        return permission.prompt?.() ?? { receive: "granted" };
      },
      register: async () => { calls.push(["push-register"]); },
      addListener: async () => ({ remove: async () => {} }) }
  };
  const window = { location: { pathname: "/digital-observer/dashboard", search: "", origin: "https://qa.invalid", replace: () => {} },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    dispatchEvent: ({ type, detail }) => {
      if (type === "digital-observer:native-push-result") results.push(JSON.parse(JSON.stringify(detail)));
    } };
  const modules = {
    react: { useState: (value) => [typeof value === "function" ? value() : value, () => {}], useEffect: (fn) => { cleanup = fn(); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@/lib/domain/digital-observer/mobile-runtime": { mobileRuntimeRequiresSession: () => true, sanitizeOfflineQueue: (value) => value, mobileNotificationPreview: () => ({}) },
    "@/lib/domain/digital-observer/mobile-playback-lifecycle": { openMobilePlaybackPublisher: () => ({ isCurrent: () => true, networkOffline: () => true, appInactive: () => true, close: () => {} }) },
    "@/lib/domain/digital-observer/native-push-request": pushRequest.exports,
    "@/lib/domain/digital-observer/native-push-availability": { observerNativePushAvailable: ({ appId, pluginAvailable }) => !!pluginAvailable && appId === "com.ganbatuach.app" },
    "@/lib/domain/digital-observer/pending-mobile-link": { firstLaunchOfMobileLink: () => false,
      rememberPendingMobileLink: () => null, takePendingMobileLink: () => null }
  };
  const exports = {};
  vm.runInNewContext(js, { exports, window, URL, AbortController, setTimeout, clearTimeout, crypto,
    Date: class extends Date { static now() { return now; } },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: async (url) => {
      calls.push(["fetch", url]);
      if (url === "/api/digital-observer/mobile/runtime") return { ok: true, json: async () => ({ data: {
        session: { profile_id: "user-b" }, sites: [{ id: "site-a", name: "QA", timezone: null }]
      } }) };
      return { ok: true };
    },
    require: (name) => {
      if (name.startsWith("@capacitor/")) return plugin;
      assert.ok(Object.hasOwn(modules, name), name); return modules[name];
    }
  }, { timeout: 5000 });
  exports.ObserverMobileRuntime();
  return {
    values, calls, results,
    request: (requestId) => listeners.get("digital-observer:enable-native-push")({ detail: { requestId, siteId: "site-a" } }),
    appState: (isActive) => appListeners.get("appStateChange")({ isActive }),
    advance: (milliseconds) => { now += milliseconds; },
    unmount: () => cleanup()
  };
}

test("another account never replays an earlier account's Push intent or Site", async () => {
  const oldQueue = [{ id: "00000000-0000-4000-8000-000000000001", kind: "push_registration", createdAt: "2026-11-15T00:00:00.000Z", attempts: 0 }];
  const h = runtime([[queueKey, JSON.stringify(oldQueue)], [siteKey, "site-a"], [ownerKey, "user-a"]]);
  await tick();
  assert.equal(h.calls.filter(([kind]) => kind === "push-register").length, 0);
  assert.equal(h.calls.filter(([kind, url]) => kind === "fetch" && url === "/api/digital-observer/access-settings").length, 0);
  assert.equal(h.values.has(siteKey), false);
  assert.equal(h.values.get(queueKey), "[]");
  assert.equal(h.values.get(ownerKey), "user-b");
});

test("legacy unbound Push intent fails closed on first authenticated bootstrap", async () => {
  const oldQueue = [{ id: "00000000-0000-4000-8000-000000000001", kind: "push_registration", createdAt: "2026-11-15T00:00:00.000Z", attempts: 0 }];
  const h = runtime([[queueKey, JSON.stringify(oldQueue)], [siteKey, "site-a"]]);
  await tick();
  assert.equal(h.calls.filter(([kind]) => kind === "push-register").length, 0);
  assert.equal(h.values.has(siteKey), false);
  assert.equal(h.values.get(queueKey), "[]");
});

test("late native permission check after resume cannot open an expired permission prompt", async (t) => {
  const check = Promise.withResolvers();
  const h = runtime([], { check: () => check.promise });
  t.after(h.unmount);
  await tick();
  const pending = h.request("old");
  await h.appState(false);
  h.advance(30_000);
  await h.appState(true);
  check.resolve({ receive: "prompt" });
  await pending;
  assert.equal(h.calls.some(([kind]) => kind === "push-prompt" || kind === "push-register"), false);
  assert.deepEqual(h.results, []);
});

test("late approval from an expired native prompt cannot register for its replacement", async (t) => {
  const oldPrompt = Promise.withResolvers();
  const currentCheck = Promise.withResolvers();
  let checks = 0;
  const h = runtime([], {
    check: () => ++checks === 1 ? { receive: "prompt" } : currentCheck.promise,
    prompt: () => oldPrompt.promise
  });
  t.after(h.unmount);
  await tick();
  const pending = h.request("old");
  await tick();
  assert.equal(h.calls.filter(([kind]) => kind === "push-prompt").length, 1);
  h.advance(30_000);
  const replacement = h.request("new");
  oldPrompt.resolve({ receive: "granted" });
  await pending;
  assert.equal(h.calls.some(([kind]) => kind === "push-register"), false);
  currentCheck.resolve({ receive: "denied" });
  await replacement;
  assert.deepEqual(h.results, [{ requestId: "new", siteId: "site-a", ok: false, reason: "permission_denied" }]);
});

test("native prompt resolved after unmount cannot register", async () => {
  const prompt = Promise.withResolvers();
  const h = runtime([], { check: async () => ({ receive: "prompt" }), prompt: () => prompt.promise });
  await tick();
  const pending = h.request("active");
  await tick();
  assert.equal(h.calls.filter(([kind]) => kind === "push-prompt").length, 1);
  h.unmount();
  prompt.resolve({ receive: "granted" });
  await pending;
  assert.equal(h.calls.some(([kind]) => kind === "push-register"), false);
  assert.deepEqual(h.results, []);
});

test("native permission granted within the current request window still registers", async (t) => {
  const prompt = Promise.withResolvers();
  const h = runtime([], { check: async () => ({ receive: "prompt" }), prompt: () => prompt.promise });
  t.after(h.unmount);
  await tick();
  const pending = h.request("current");
  await tick();
  h.advance(29_999);
  prompt.resolve({ receive: "granted" });
  await pending;
  assert.equal(h.calls.filter(([kind]) => kind === "push-register").length, 1);
});
