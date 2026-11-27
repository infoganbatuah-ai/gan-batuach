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

function iosRuntime(getLaunchUrl = async () => ({ url: link })) {
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
    Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => false, getPlatform: () => "ios" },
    App: { addListener: async (name, callback) => { if (name === "appUrlOpen") appUrlOpen = callback; return { remove: async () => {} }; },
      getLaunchUrl, getInfo: async () => ({ id: "com.ganbatuach.app" }) },
    Network: { addListener: async () => ({ remove: async () => {} }), getStatus: async () => ({ connected: true }) },
    Preferences: { get: async () => ({ value: null }), set: async () => {} }, Device: {}, PushNotifications: {}
  };
  const modules = {
    react: { useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useEffect: (fn) => { fn(); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@/lib/domain/digital-observer/mobile-runtime": { mobileRuntimeRequiresSession: () => false, sanitizeOfflineQueue: () => [], mobileNotificationPreview: () => ({}),
      nativeAppAcceptsMobileLink: (raw, appId, platform) => appId === "com.ganbatuach.app" && platform === "ios" && raw.startsWith("digitalobserver://") },
    "@/lib/domain/digital-observer/mobile-playback-lifecycle": { openMobilePlaybackPublisher: () => ({ isCurrent: () => true, networkOffline: () => true, appInactive: () => true, close: () => {} }) },
    "@/lib/domain/digital-observer/native-push-request": { parseNativePushRequest: () => null, nativePushResult: () => ({}) },
    "@/lib/domain/digital-observer/native-push-availability": { observerNativePushAvailable: ({ appId, pluginAvailable }) => !!pluginAvailable && appId === "com.ganbatuach.app" },
    "@/lib/domain/digital-observer/pending-mobile-link": {
      firstLaunchOfMobileLink: () => ++launchChecks === 1,
      rememberPendingMobileLink: () => false, takePendingMobileLink: () => null
    }
  };
  const exports = {};
  vm.runInNewContext(js, {
    exports, window, URL, AbortController, setTimeout, clearTimeout, CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
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
  return {
    tap: (url) => appUrlOpen({ url }),
    get launchChecks() { return launchChecks; },
    get postCount() { return postCount; },
    destinations
  };
}

test("a new appUrlOpen tap of the same URL is authorized after initial getLaunchUrl", async () => {
  const h = iosRuntime();
  await tick();
  assert.equal(h.postCount, 1, "initial launch was authorized");
  h.tap(link);
  await tick();
  assert.equal(h.postCount, 2, "deliberate second appUrlOpen tap bypasses only the stale-launch marker");
  assert.equal(h.launchChecks, 1, "the stale-launch marker applies only to getLaunchUrl");
  h.tap(link.replace("digitalobserver://", "observerqaandroid://"));
  await tick();
  assert.equal(h.postCount, 2, "a foreign app scheme is denied before the server request");
  assert.deepEqual(h.destinations, ["/digital-observer/sites/authorized", "/digital-observer/sites/authorized"]);
});

test("a native link delivered as both a startup event and a launch snapshot opens once", async () => {
  const launch = Promise.withResolvers();
  const h = iosRuntime(() => launch.promise);
  await tick();
  h.tap(link);
  await tick();
  assert.equal(h.postCount, 1);
  launch.resolve({ url: link });
  await tick();
  assert.equal(h.postCount, 1, "the duplicate snapshot must not authorize again");
  assert.deepEqual(h.destinations, ["/digital-observer/sites/authorized"]);
  assert.equal(h.launchChecks, 1, "still mark the launch snapshot for login reloads");
  h.tap(link);
  await tick();
  assert.equal(h.postCount, 2, "a later deliberate tap is still authorized");
});

test("a different startup event does not consume the launch snapshot", async () => {
  const launch = Promise.withResolvers();
  const h = iosRuntime(() => launch.promise);
  await tick();
  h.tap(link.replace("digitalobserver://", "observerqaandroid://"));
  launch.resolve({ url: link });
  await tick();
  assert.equal(h.postCount, 1);
  assert.equal(h.launchChecks, 1);
});

test("Android Observer QA defers only a resource link on network failure and retries after reconnect", async () => {
  let appUrlOpen, networkChange, pending = null, postCount = 0, failNext = false;
  const destinations = [];
  const observerLink = link.replace("digitalobserver://", "observerqaandroid://");
  const storage = new Map();
  const sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key)
  };
  const window = {
    sessionStorage,
    location: { pathname: "/digital-observer/sites/site", search: "", origin: "https://qa.invalid",
      assign: (url) => destinations.push(url), replace: () => assert.fail("unexpected redirect") },
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => {}
  };
  const plugin = {
    Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => false, getPlatform: () => "android" },
    App: { addListener: async (name, callback) => { if (name === "appUrlOpen") appUrlOpen = callback; return { remove: async () => {} }; },
      getLaunchUrl: async () => null, getInfo: async () => ({ id: "com.digitalobserver.app.qa" }) },
    Network: { addListener: async (_, callback) => { networkChange = callback; return { remove: async () => {} }; },
      getStatus: async () => ({ connected: true }) },
    Preferences: { get: async (input) => ({ value: input.key.includes("push_owner") ? "profile-a" : null }),
      set: async () => {}, remove: async () => {} }, Device: {}, PushNotifications: {}
  };
  const modules = {
    react: { useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useEffect: (fn) => { fn(); } },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: "Fragment" },
    "@/lib/domain/digital-observer/mobile-runtime": { mobileRuntimeRequiresSession: () => true,
      sanitizeOfflineQueue: () => [], mobileNotificationPreview: () => ({}),
      nativeAppAcceptsMobileLink: (raw, appId, platform) => appId === "com.digitalobserver.app.qa"
        && platform === "android" && raw.startsWith("observerqaandroid://") },
    "@/lib/domain/digital-observer/mobile-playback-lifecycle": { openMobilePlaybackPublisher: () =>
      ({ isCurrent: () => true, networkOffline: () => true, appInactive: () => true, close: () => {} }) },
    "@/lib/domain/digital-observer/native-push-request": { parseNativePushRequest: () => null, nativePushResult: () => ({}) },
    "@/lib/domain/digital-observer/native-push-availability": { observerNativePushAvailable: () => false },
    "@/lib/domain/digital-observer/pending-mobile-link": {
      firstLaunchOfMobileLink: () => true,
      rememberPendingMobileLink: (_store, raw) => { if (raw !== observerLink) return false; pending = raw; return true; },
      takePendingMobileLink: () => { const value = pending; pending = null; return value; }
    }
  };
  const exports = {};
  vm.runInNewContext(js, {
    exports, window, URL, AbortController, setTimeout, clearTimeout,
    CustomEvent: class { constructor(name, options) { this.type = name; this.detail = options?.detail; } },
    fetch: async (url, options = {}) => {
      if (options.method !== "POST") return { ok: true, json: async () => ({ data: { session: { profile_id: "profile-a" }, sites: [] } }) };
      assert.equal(url, "/api/digital-observer/mobile/runtime");
      postCount++;
      if (postCount === 1 || failNext) throw new Error("network interrupted");
      return { ok: true, status: 200, json: async () => ({ data: { destination: "/digital-observer/sites/authorized" } }) };
    },
    require: (name) => { if (name.startsWith("@capacitor/")) return plugin;
      assert.ok(Object.hasOwn(modules, name), name); return modules[name]; }
  }, { timeout: 5000 });
  exports.ObserverMobileRuntime();
  await tick();
  assert.equal(typeof appUrlOpen, "function");
  appUrlOpen({ url: observerLink });
  await tick();
  assert.equal(postCount, 1);
  assert.equal(pending, observerLink);
  assert.deepEqual(destinations, []);
  await networkChange({ connected: true, connectionType: "wifi" });
  await tick();
  assert.equal(postCount, 2);
  assert.equal(pending, null);
  assert.deepEqual(destinations, ["/digital-observer/sites/authorized"]);
  failNext = true;
  appUrlOpen({ url: "observerqaandroid://auth/callback?code=forbidden" });
  await tick();
  assert.equal(postCount, 3, "a callback attempt reaches the existing server gate");
  assert.equal(pending, null);
});
