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
const link = "digitalobserver://camera/00000000-0000-4000-8000-000000000044?site=00000000-0000-4000-8000-000000000045";
const tick = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };

test("a new appUrlOpen tap of the same URL is authorized after initial getLaunchUrl", async () => {
  let appUrlOpen, launchChecks = 0, postCount = 0;
  const destinations = [];
  const storage = new Map();
  const sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  };
  const window = {
    sessionStorage,
    location: { pathname: "/digital-observer/login", origin: "https://qa.invalid", assign: (url) => destinations.push(url), replace: () => assert.fail("unexpected redirect") },
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {}
  };
  const plugin = {
    Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => false },
    App: { addListener: async (name, callback) => { if (name === "appUrlOpen") appUrlOpen = callback; return { remove: async () => {} }; },
      getLaunchUrl: async () => ({ url: link }) },
    Network: { addListener: async () => ({ remove: async () => {} }), getStatus: async () => ({ connected: true }) },
    Preferences: { get: async () => ({ value: null }), set: async () => {} }, Device: {}, PushNotifications: {}
  };
  const modules = {
    react: { useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useEffect: (fn) => { fn(); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@/lib/domain/digital-observer/mobile-runtime": { mobileRuntimeRequiresSession: () => false, sanitizeOfflineQueue: () => [], mobileNotificationPreview: () => ({}) },
    "@/lib/domain/digital-observer/mobile-playback-lifecycle": { openMobilePlaybackPublisher: () => ({ isCurrent: () => true, networkOffline: () => true, appInactive: () => true, close: () => {} }) },
    "@/lib/domain/digital-observer/native-push-request": { parseNativePushRequest: () => null, nativePushResult: () => ({}) },
    "@/lib/domain/digital-observer/pending-mobile-link": {
      firstLaunchOfMobileLink: () => ++launchChecks === 1,
      rememberPendingMobileLink: () => false, takePendingMobileLink: () => null
    }
  };
  const exports = {};
  vm.runInNewContext(js, {
    exports, window, URL, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      assert.equal(url, "/api/digital-observer/mobile/runtime");
      assert.equal(options.method, "POST");
      postCount++;
      return { ok: true, status: 200, json: async () => ({ data: { destination: "/digital-observer/sites/authorized" } }) };
    },
    require: (name) => {
      if (name.startsWith("@capacitor/")) return plugin;
      assert.ok(Object.hasOwn(modules, name), name);
      return modules[name];
    }
  }, { timeout: 5000 });
  exports.ObserverMobileRuntime();
  await tick();
  assert.equal(postCount, 1, "initial launch was authorized");
  assert.equal(typeof appUrlOpen, "function");
  appUrlOpen({ url: link });
  await tick();
  assert.equal(postCount, 2, "deliberate second appUrlOpen tap bypasses only the stale-launch marker");
  assert.equal(launchChecks, 1, "the stale-launch marker applies only to getLaunchUrl");
  assert.deepEqual(destinations, ["/digital-observer/sites/authorized", "/digital-observer/sites/authorized"]);
});
