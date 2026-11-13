import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Closed actual-component tests. Firebase/permission/native/network operations
// are synthetic allowlisted doubles, never loaded from a provider SDK.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-fcm-push-registration.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw); assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "SF_DATALESS source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "observer-fcm-push-registration.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "observer-fcm-push-registration.js" });
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
async function drain() { for (let i = 0; i < 128; i++) await Promise.resolve(); }
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
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
function fixture({ native = false, pauseAt = null, initialRegistered = false, support = true, permission = "granted", token = "SYNTHETIC_FCM", serverError = false, existingReference = null, unsubscribeThrows = false } = {}) {
  const counts = {}, reads = {}, calls = [], writes = [], requests = [], notifications = [], subscriptions = [];
  const gates = new Map(), listeners = new Set(), retained = [], removes = new Map(), timers = new Map(), clears = new Map();
  const storage = new Map(existingReference ? [["digital_observer_device_reference", existingReference]] : []);
  const pending = [], fibers = [];
  let nativeRequest;
  let siteId = "site-a", initial = initialRegistered, fiber, cursor = 0, tree, dead = false, timerId = 0, uuid = 0, notificationPermission = "granted";
  if (pauseAt) gates.set(pauseAt, deferred());
  const count = (name) => { calls.push(name); counts[name] = (counts[name] ?? 0) + 1; };
  const step = (prefix, value) => {
    count(prefix); const label = `${prefix}.${counts[prefix]}`;
    const gate = gates.get(label); return gate ? gate.promise.then(() => value) : Promise.resolve(value);
  };
  const packet = (label, fields) => new Proxy(fields, { get(target, key) {
    if (key === "then") return undefined;
    const name = `${label}.${String(key)}`; reads[name] = (reads[name] ?? 0) + 1;
    return Reflect.get(target, key);
  } });
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
  const React = {
    useState: (initialValue) => {
      const own = fiber, index = cursor++;
      if (!own.slots[index]) own.slots[index] = { kind: "state", value: typeof initialValue === "function" ? initialValue() : initialValue };
      assert.equal(own.slots[index].kind, "state");
      return [own.slots[index].value, (value) => {
        writes.push({ site: own.key, index, afterUnmount: own.dead });
        own.slots[index].value = typeof value === "function" ? value(own.slots[index].value) : value;
      }];
    },
    useRef: (value) => {
      const index = cursor++;
      if (!fiber.slots[index]) fiber.slots[index] = { kind: "ref", value: { current: value } };
      assert.equal(fiber.slots[index].kind, "ref"); return fiber.slots[index].value;
    },
    useEffect: (fn, deps) => {
      const own = fiber, index = cursor++;
      if (!own.slots[index] || !same(own.slots[index].deps, deps)) {
        const previous = own.slots[index]; own.slots[index] = { kind: "effect", deps, cleanup: previous?.cleanup };
        pending.push(() => { own.slots[index].cleanup?.(); own.slots[index].cleanup = fn(); });
      }
      assert.equal(own.slots[index].kind, "effect");
    }
  };
  const env = Object.freeze({
    NEXT_PUBLIC_FIREBASE_API_KEY: "SYNTHETIC_API_KEY", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "synthetic.invalid",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "SYNTHETIC_PROJECT", NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "SYNTHETIC_SENDER",
    NEXT_PUBLIC_FIREBASE_APP_ID: "SYNTHETIC_APP", NEXT_PUBLIC_FCM_VAPID_KEY: "SYNTHETIC_VAPID"
  });
  const syntheticApp = Object.freeze({ syntheticApp: true }), messaging = Object.freeze({ syntheticMessaging: true }), sw = Object.freeze({ syntheticSW: true });
  const modules = new Map([
    ["react", React], ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => { count("native"); return native; } } }],
    ["firebase/app", {
      getApps: () => { count("apps"); return []; },
      initializeApp: (config) => { count("initialize"); assert.deepEqual(plain(config), {
        apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
      }); return syntheticApp; }
    }],
    ["firebase/messaging", {
      isSupported: () => step("support", support),
      getMessaging: (app) => { count("messaging"); assert.equal(app, syntheticApp); return messaging; },
      getToken: (value, options) => { assert.equal(value, messaging); assert.equal(options.serviceWorkerRegistration, sw); assert.equal(options.vapidKey, env.NEXT_PUBLIC_FCM_VAPID_KEY); return step("token", token); },
      onMessage: (value, callback) => {
        assert.equal(value, messaging); count("onMessage");
        const sub = { callback, active: true, removed: 0 }; subscriptions.push(sub);
        return () => { sub.removed++; sub.active = false; count("unsubscribe"); if (unsubscribeThrows) throw Error("SYNTHETIC_UNSUBSCRIBE"); };
      }
    }],
    ["lucide-react", { BellRing: "BellRing", LoaderCircle: "LoaderCircle", Send: "Send", Smartphone: "Smartphone" }],
    ["@/lib/domain/digital-observer/client-session", { readObserverAccessToken: () => { count("accessToken"); return "SYNTHETIC_ACCESS"; } }]
  ]);
  class NotificationDouble {
    static get permission() { count("notification.permission"); return notificationPermission; }
    static requestPermission() { return step("permission", permission); }
    constructor(title, options) { count("Notification"); notifications.push({ title, ...plain(options) }); }
  }
  const window = {
    localStorage: {
      getItem: (key) => { count("storage.get"); assert.equal(key, "digital_observer_device_reference"); return storage.get(key) ?? null; },
      setItem: (key, value) => { count("storage.set"); assert.equal(key, "digital_observer_device_reference"); storage.set(key, value); }
    },
    setTimeout: (fn, delay) => { assert.equal(delay, 30000); const id = ++timerId; timers.set(id, fn); count("timer.add"); return id; },
    clearTimeout: (id) => { clears.set(id, (clears.get(id) ?? 0) + 1); timers.delete(id); count("timer.clear"); },
    addEventListener: (name, callback, options) => { assert.equal(name, "digital-observer:native-push-result"); assert.notEqual(options?.once, true); listeners.add(callback); retained.push(callback); count("listener.add"); },
    removeEventListener: (name, callback) => { assert.equal(name, "digital-observer:native-push-result"); listeners.delete(callback); removes.set(callback, (removes.get(callback) ?? 0) + 1); count("listener.remove"); },
    dispatchEvent: (event) => { assert.equal(event.type, "digital-observer:enable-native-push"); assert.equal(event.detail.siteId, siteId); assert.equal(typeof event.detail.requestId, "string"); assert.ok(event.detail.requestId.length > 0 && event.detail.requestId.length <= 128); nativeRequest = { siteId, requestId: event.detail.requestId }; count("native.dispatch"); return true; }
  };
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    process: Object.freeze({ env }), window, Notification: NotificationDouble,
    navigator: { userAgent: "Synthetic Desktop", serviceWorker: { register: (path) => { assert.equal(path, "/firebase-messaging-sw.js"); return step("sw", sw); } } },
    crypto: { randomUUID: () => { count("uuid"); return `SYNTHETIC_REF_${++uuid}`; } },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: (url, options) => {
      assert.equal(options.method, "POST"); assert.equal(options.credentials, "same-origin");
      assert.deepEqual(plain(options.headers), { "Content-Type": "application/json", Authorization: "Bearer SYNTHETIC_ACCESS" });
      const prefix = url === "/api/push/register" ? "push" : url === "/api/digital-observer/access-settings" ? "access" : url === "/api/digital-observer/notifications/push-test" ? "test" : null;
      assert.ok(prefix, "unexpected request URL");
      const body = JSON.parse(options.body); requests.push({ url, body });
      const n = (counts[`${prefix}.fetch`] ?? 0) + 1;
      const data = prefix === "test" ? { message: "SYNTHETIC_DRY_RUN_ONLY" } : { synthetic: true };
      const payload = packet(`${prefix}.payload.${n}`, serverError ? { error: "SYNTHETIC_SERVER_DENIAL" } : { data: packet(`${prefix}.data.${n}`, data) });
      return step(`${prefix}.fetch`, packet(`${prefix}.response.${n}`, { ok: !serverError, json: () => step(`${prefix}.body`, payload) }));
    }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const destroyFiber = (own) => { if (!own || own.dead) return; own.dead = true; for (const slot of own.slots) if (slot?.kind === "effect") slot.cleanup?.(); };
  const render = () => {
    assert.equal(dead, false, "render after unmount");
    const shell = exports.ObserverFcmPushRegistration({ siteId, initialRegistered: initial });
    // Model normal React keyed component identity; resolve the actual returned
    // function, not an exposed/copied private helper.
    if (!fiber || fiber.key !== shell.key || fiber.type !== shell.type) {
      destroyFiber(fiber); fiber = { key: shell.key, type: shell.type, slots: [], dead: false }; fibers.push(fiber);
    }
    assert.equal(typeof shell.type, "function", "top-level Site scope expected"); cursor = 0;
    tree = shell.type(shell.props); while (pending.length) pending.shift()(); return tree;
  };
  const action = (kind) => {
    render(); const button = nodes(tree, (node) => node.type === "button" && node.props.className === (kind === "register" ? "do-button secondary" : "do-button primary"))[0];
    assert.ok(button); return button.props.onClick;
  };
  const unmount = () => { if (!dead) { dead = true; destroyFiber(fiber); } };
  render();
  return {
    counts, reads, calls, writes, requests, notifications, subscriptions, listeners, retained, removes, timers, clears, storage,
    register: () => action("register")(), send: () => action("test")(), handlers: () => ({ register: action("register"), send: action("test") }),
    scope: (site, registered = false) => { siteId = site; initial = registered; render(); },
    ui: () => { render(); const buttons = nodes(tree, (node) => node.type === "button"); return {
      busy: buttons[0].props.disabled, testDisabled: buttons[1].props.disabled,
      testing: nodes(buttons[1], (node) => node.type === "LoaderCircle").length > 0,
      message: text(nodes(tree, (node) => node.type === "p" && node.props.className === "do-notice success")[0]),
      error: text(nodes(tree, (node) => node.type === "p" && node.props.className === "do-notice warn")[0])
    }; },
    pause: (label) => { assert.equal(gates.has(label), false); const gate = deferred(); gates.set(label, gate); return gate; },
    release: (label, reject = false) => { const gate = gates.get(label); assert.ok(gate); if (reject) gate.reject(Error("SYNTHETIC_REJECTION")); else gate.resolve(); },
    result: (detail) => { for (const callback of [...listeners]) callback({ detail: { ...nativeRequest, ...detail } }); },
    timeout: () => { assert.equal(timers.size, 1); [...timers.values()][0](); },
    setNotificationPermission: (value) => { notificationPermission = value; },
    unmount,
    snapshot: () => plain({ counts, reads, calls, writes, requests, notifications, listeners: listeners.size, timers: timers.size,
      subscriptions: subscriptions.map((sub) => ({ active: sub.active, removed: sub.removed })) }),
    cleanup: async () => { unmount(); for (const gate of gates.values()) gate.resolve(); await drain(); }
  };
}
const poison = new Proxy({}, { get() { assert.fail("stale event/payload must not be read"); } });
test("Web register synchronously admits only one in-flight action before state commit", async (t) => {
  const h = fixture({ pauseAt: "support.1" }); t.after(() => h.cleanup());
  const register = h.handlers().register;
  const first = register(), duplicate = register();
  await drain();
  assert.equal(h.counts.support, 1);
  assert.equal(h.counts.permission ?? 0, 0);
  h.release("support.1"); await Promise.all([first, duplicate]);
  assert.equal(h.counts.permission, 1);
  assert.equal(h.counts["push.fetch"], 1);
  assert.equal(h.counts["access.fetch"], 1);
  await h.register();
  assert.equal(h.counts["push.fetch"], 2, "explicit retry after success is permitted");
});
test("native register duplicate cannot dispatch a second permission request", async (t) => {
  const h = fixture({ native: true }); t.after(() => h.cleanup());
  const register = h.handlers().register;
  const first = register(), duplicate = register();
  assert.equal(h.counts["native.dispatch"], 1);
  assert.equal(h.listeners.size, 1);
  h.result({ ok: true }); await Promise.all([first, duplicate]);
  assert.equal(h.counts["native.dispatch"], 1);
  const retry = h.register(); assert.equal(h.counts["native.dispatch"], 2);
  h.result({ ok: true }); await retry;
});
test("dry-run duplicate is fenced synchronously; explicit retry after failure is allowed", async (t) => {
  const h = fixture({ initialRegistered: true, pauseAt: "test.fetch.1", serverError: true }); t.after(() => h.cleanup());
  const send = h.handlers().send;
  const first = send(), duplicate = send();
  assert.equal(h.counts["test.fetch"], 1);
  assert.equal(h.requests.length, 1);
  h.release("test.fetch.1"); await Promise.all([first, duplicate]);
  assert.match(h.ui().error, /SYNTHETIC_SERVER_DENIAL/);
  await h.send(); assert.equal(h.counts["test.fetch"], 2);
});
test("Site replacement rejects retained actions and permits one new Site action", async (t) => {
  const h = fixture({ initialRegistered: true }); t.after(() => h.cleanup());
  const old = h.handlers(); h.scope("site-b", true);
  const before = h.snapshot(); await old.register(); await old.send();
  assert.deepEqual(h.snapshot(), before);
  const current = h.handlers().send;
  const first = current(), duplicate = current();
  await Promise.all([first, duplicate]);
  assert.equal(h.counts["test.fetch"], 1);
  assert.deepEqual(h.requests[0].body, { observer_site_id: "site-b" });
});
test("retained test handler cannot use stale registered state after failed re-register", async (t) => {
  const h = fixture({ initialRegistered: true, support: false }); t.after(() => h.cleanup());
  const staleSend = h.handlers().send;
  await h.register();
  assert.equal(h.ui().testDisabled, true);
  await staleSend();
  assert.equal(h.counts["test.fetch"] ?? 0, 0);
  assert.equal(h.requests.length, 0);
});
test("current test remains usable after successful re-register", async (t) => {
  const h = fixture({ initialRegistered: true }); t.after(() => h.cleanup());
  const retainedSend = h.handlers().send;
  await h.register();
  await retainedSend();
  assert.equal(h.counts["test.fetch"], 1);
  assert.deepEqual(h.requests.at(-1).body, { observer_site_id: "site-a" });
});
const webBoundaries = ["support.1", "permission.1", "sw.1", "token.1", "push.fetch.1", "push.body.1", "access.fetch.1", "access.body.1"];
for (const boundary of webBoundaries) for (const loss of ["unmount", "Site"]) for (const settlement of ["resolve", "reject"]) {
  test(`Web ${boundary} late ${settlement} after ${loss} is quiet`, async (t) => {
    const h = fixture({ pauseAt: boundary }); t.after(() => h.cleanup()); const old = h.register(); await drain();
    const prefix = boundary.slice(0, boundary.lastIndexOf(".")); assert.equal(h.counts[prefix], 1);
    if (loss === "unmount") h.unmount();
    else h.scope("site-b");
    const before = h.snapshot(), beforeUI = loss === "unmount" ? null : h.ui();
    h.release(boundary, settlement === "reject"); await old; await drain();
    assert.deepEqual(h.snapshot(), before, "no stale payload consumption or next effect");
    if (beforeUI) assert.deepEqual(h.ui(), beforeUI);
  });
}
for (const outcome of ["success", "permission_denied", "provider_error", "timeout"]) {
  test(`native current ${outcome} settles listener and timer exactly once`, async (t) => {
    const h = fixture({ native: true }); t.after(() => h.cleanup()); const promise = h.register(); await drain();
    assert.equal(h.listeners.size, 1); assert.equal(h.timers.size, 1);
    if (outcome === "timeout") h.timeout(); else h.result({ ok: outcome === "success", reason: outcome });
    await promise; assert.equal(h.listeners.size, 0); assert.equal(h.timers.size, 0); assert.equal(h.ui().busy, false);
    assert.equal(h.removes.get(h.retained[0]), 1); assert.deepEqual([...h.clears.values()], [1]);
    if (outcome === "success") { assert.equal(h.ui().testDisabled, false); assert.match(h.ui().message, /המכשיר נרשם/); }
    else assert.match(h.ui().error, outcome === "permission_denied" ? /הרשאת ההתראות לא אושרה/ : /רישום ה־Push במכשיר לא הושלם/);
    h.retained[0](poison); h.unmount(); assert.equal(h.removes.get(h.retained[0]), 1);
  });
}
for (const loss of ["unmount", "Site"]) {
  test(`native cancellation on ${loss} settles quietly and fences retained listener`, async (t) => {
    const h = fixture({ native: true }); t.after(() => h.cleanup()); const old = h.register(); await drain(); const stale = h.retained[0];
    if (loss === "unmount") h.unmount(); else h.scope("site-b");
    await old; await drain();
    const before = h.snapshot(); stale(poison); await drain(); assert.deepEqual(h.snapshot(), before);
    assert.equal(h.removes.get(stale), 1); assert.equal(h.clears.get(1), 1);
    if (loss === "Site") assert.deepEqual(h.ui(), { busy: false, testDisabled: true, testing: false, message: "", error: "" });
  });
}
test("native settled resource cleanup is idempotent across scope loss and repeated unmount", async (t) => {
  const h = fixture({ native: true }); t.after(() => h.cleanup()); const p = h.register(); h.result({ ok: true }); await p;
  h.scope("site-b"); h.unmount(); h.unmount();
  assert.equal(h.removes.get(h.retained[0]), 1); assert.equal(h.clears.get(1), 1);
});
test("retained register and test handlers do no work after unmount", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); const handlers = h.handlers(); h.unmount(); const before = h.snapshot();
  await handlers.register(); await handlers.send(); assert.deepEqual(h.snapshot(), before);
});
test("healthy Web preserves contracts and replacement owns one foreground subscription", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await h.register();
  assert.deepEqual(h.requests.map((r) => r.body), [
    { platform: "web", device_token: "SYNTHETIC_FCM", metadata: { source: "digital_observer_fcm", observer_site_id: "site-a" } },
    { action: "register_device", observer_site_id: "site-a", device_label: "הדפדפן שלי", platform: "web", device_reference: "SYNTHETIC_REF_1" }
  ]);
  assert.equal(h.counts.initialize, 1); assert.equal(h.counts["storage.set"], 1);
  const old = h.subscriptions[0]; await h.register(); assert.equal(old.removed, 1);
  assert.equal(h.subscriptions.filter((sub) => sub.active).length, 1); assert.equal(h.counts.uuid, 1);
  const before = h.snapshot(); old.callback(poison); assert.deepEqual(h.snapshot(), before);
  await h.send(); assert.equal(h.subscriptions[1].active, true, "test must not invalidate current foreground subscription");
  h.subscriptions[1].callback({ notification: { title: "SYNTHETIC_TITLE", body: "SYNTHETIC_BODY" } });
  assert.deepEqual(h.notifications.at(-1), { title: "SYNTHETIC_TITLE", body: "SYNTHETIC_BODY", icon: "/assets/digital-observer/app-icon.svg" });
  h.scope("site-b"); assert.equal(h.subscriptions[1].removed, 1); h.unmount(); assert.equal(h.subscriptions[1].removed, 1);
});
test("foreground defaults and permission behavior preserved; stale callback reads nothing", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await h.register(); const sub = h.subscriptions[0];
  sub.callback({}); assert.deepEqual(h.notifications[0], { title: "תצפיתן דיגיטלי", body: "התקבלה התראה חדשה.", icon: "/assets/digital-observer/app-icon.svg" });
  h.setNotificationPermission("denied"); sub.callback(poison); assert.equal(h.notifications.length, 1);
  h.unmount(); const before = h.snapshot(); sub.callback(poison); assert.deepEqual(h.snapshot(), before); assert.equal(sub.removed, 1);
});
test("unsubscribe rejection is best-effort once and cannot poison replacement", async (t) => {
  const h = fixture({ unsubscribeThrows: true }); t.after(() => h.cleanup()); await h.register(); await h.register();
  assert.equal(h.subscriptions[0].removed, 1); assert.equal(h.subscriptions[1].active, true);
  h.unmount(); h.unmount(); assert.equal(h.subscriptions[1].removed, 1);
});
for (const boundary of ["test.fetch.1", "test.body.1"]) for (const loss of ["unmount", "Site", "register"]) for (const settlement of ["resolve", "reject"]) {
  test(`dry-run ${boundary} late ${settlement} after ${loss} is quiet`, async (t) => {
    const h = fixture({ pauseAt: boundary, initialRegistered: true }); t.after(() => h.cleanup()); const old = h.send(); await drain();
    assert.equal(h.counts[boundary.slice(0, boundary.lastIndexOf("."))], 1);
    let next, gate;
    if (loss === "unmount") h.unmount(); else if (loss === "Site") h.scope("site-b");
    else { gate = h.pause("support.1"); next = h.register(); }
    await drain(); const before = h.snapshot(), ui = loss === "unmount" ? null : h.ui();
    h.release(boundary, settlement === "reject"); await old; await drain(); assert.deepEqual(h.snapshot(), before);
    if (ui) assert.deepEqual(h.ui(), ui);
    if (gate) { gate.resolve(); await next; assert.equal(h.ui().testing, false); assert.equal(h.ui().error, ""); }
  });
}
test("current dry-run contract and Site initialRegistered semantics", async (t) => {
  const h = fixture({ initialRegistered: true }); t.after(() => h.cleanup()); assert.equal(h.ui().testDisabled, false); await h.send();
  assert.deepEqual(h.requests, [{ url: "/api/digital-observer/notifications/push-test", body: { observer_site_id: "site-a" } }]);
  assert.match(h.ui().message, /SYNTHETIC_DRY_RUN_ONLY/); assert.equal(h.ui().testing, false);
  h.scope("site-b", false); assert.deepEqual(h.ui(), { busy: false, testDisabled: true, testing: false, message: "", error: "" });
  h.scope("site-c", true); assert.equal(h.ui().testDisabled, false);
});
test("current dry-run server error remains visible and testing clears", async (t) => {
  const h = fixture({ initialRegistered: true, serverError: true }); t.after(() => h.cleanup()); await h.send();
  assert.match(h.ui().error, /SYNTHETIC_SERVER_DENIAL/); assert.equal(h.ui().testing, false); assert.equal(h.ui().message, "");
});
for (const [name, options, expected] of [
  ["unsupported", { support: false }, /הדפדפן הזה אינו תומך/],
  ["permission denied", { permission: "denied" }, /יש לאשר התראות/],
  ["empty token", { token: "" }, /Firebase לא החזיר טוקן/]
]) {
  test(`current Web ${name} preserves error and no server registration`, async (t) => {
    const h = fixture(options); t.after(() => h.cleanup()); await h.register();
    assert.match(h.ui().error, expected); assert.equal(h.ui().busy, false); assert.equal(h.requests.length, 0);
  });
}
test("existing reference is reused without UUID or storage write", async (t) => {
  const h = fixture({ existingReference: "SYNTHETIC_EXISTING_REF" }); t.after(() => h.cleanup()); await h.register();
  assert.equal(h.requests[1].body.device_reference, "SYNTHETIC_EXISTING_REF");
  assert.equal(h.counts.uuid ?? 0, 0); assert.equal(h.counts["storage.set"] ?? 0, 0);
});
