import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const ts = createRequire(import.meta.url)("typescript");
const source = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const queueKey = "digital_observer_mobile_offline_queue_v1";
const siteKey = "digital_observer_native_push_site_v1";
const ownerKey = "digital_observer_native_push_owner_v1";
const tick = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };

function runtime(initial) {
  const values = new Map(initial);
  const calls = [];
  const preferences = {
    get: async ({ key }) => ({ value: values.get(key) ?? null }),
    set: async ({ key, value }) => { calls.push(["set", key]); values.set(key, value); },
    remove: async ({ key }) => { calls.push(["remove", key]); values.delete(key); }
  };
  const plugin = {
    Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true, getPlatform: () => "android" },
    App: { addListener: async () => ({ remove: async () => {} }), getLaunchUrl: async () => null,
      getInfo: async () => ({ version: "1.0-qa" }) },
    Network: { addListener: async () => ({ remove: async () => {} }), getStatus: async () => ({ connected: true }) },
    Device: { getInfo: async () => ({ name: "synthetic" }) }, Preferences: preferences,
    PushNotifications: { checkPermissions: async () => ({ receive: "granted" }), register: async () => { calls.push(["push-register"]); },
      addListener: async () => ({ remove: async () => {} }) }
  };
  const window = { location: { pathname: "/digital-observer/dashboard", search: "", origin: "https://qa.invalid", replace: () => {} },
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {} };
  const modules = {
    react: { useState: (value) => [typeof value === "function" ? value() : value, () => {}], useEffect: (fn) => { fn(); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@/lib/domain/digital-observer/mobile-runtime": { mobileRuntimeRequiresSession: () => true, sanitizeOfflineQueue: (value) => value, mobileNotificationPreview: () => ({}) },
    "@/lib/domain/digital-observer/mobile-playback-lifecycle": { openMobilePlaybackPublisher: () => ({ isCurrent: () => true, networkOffline: () => true, appInactive: () => true, close: () => {} }) },
    "@/lib/domain/digital-observer/native-push-request": { parseNativePushRequest: () => null, nativePushResult: () => ({}) },
    "@/lib/domain/digital-observer/pending-mobile-link": { firstLaunchOfMobileLink: () => false,
      rememberPendingMobileLink: () => null, takePendingMobileLink: () => null }
  };
  const exports = {};
  vm.runInNewContext(js, { exports, window, URL, AbortController, setTimeout, clearTimeout, Date, crypto,
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
  return { values, calls };
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
