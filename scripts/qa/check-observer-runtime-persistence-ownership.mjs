import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import vm from "node:vm";

// Actual runtime, closed synthetic IO only. No copied persistence helper logic,
// real Auth/RLS, plugin, token, storage, server, device, provider or media proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-mobile-runtime.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw); assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "observer-mobile-runtime.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "observer-mobile-runtime.js" });
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props) => ({ type, props: props ?? {} });
const operation = (kind, id = kind) => ({ id, kind, attempts: 0, createdAt: "2026-01-01T00:00:00.000Z" });
const pushRetry = () => [operation("push_registration")];
async function drain() { for (let n = 0; n < 192; n++) await Promise.resolve(); }
function deferred() {
  let resolvePromise, rejectPromise;
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

async function mount({ mode = "boot", pauseAt = null, rejectAt = null, savedSite, missingReference = false, queue = [], status = 200, accessOk = true } = {}) {
  let effect, current = true, closed = false, disposed = false, slot = 0, timerId = 0, targetSeen = false;
  const live = () => current && !closed;
  const gate = deferred(), counts = {}, callbacks = new Map(), hooks = new Map(), timers = new Map();
  const calls = [], requests = [], writes = [], events = [], states = [], replacements = [];
  const reads = {}; let staleReads = 0, uuidCount = 0, sanitizeCount = 0;
  const keys = { site: "digital_observer_native_push_site_v1", ref: "digital_observer_native_device_reference_v1", queue: "digital_observer_mobile_offline_queue_v1" };
  const tokenMode = mode.startsWith("token");
  const protectedRoute = !tokenMode && mode !== "public";
  const path = protectedRoute ? "/digital-observer/synthetic-runtime" : "/digital-observer/login";
  const initialSite = savedSite === undefined ? (tokenMode ? "site-a" : null) : savedSite;
  const stored = new Map([[keys.site, initialSite], [keys.ref, missingReference ? null : "synthetic-reference"], [keys.queue, typeof queue === "string" || queue === null ? queue : JSON.stringify(queue)]]);
  const sites = [{ id: "site-a", name: "SYNTHETIC_A", timezone: null }, { id: "site-b", name: "SYNTHETIC_B", timezone: null }];
  const deny = (name) => { throw Error(`UNEXPECTED_EFFECT:${String(name)}`); };
  const sync = (name) => { calls.push(name); assert.ok(live(), `stale effect:${name}`); };
  const packet = (label, values) => new Proxy(values, { get(target, key) {
    if (key === "then") return undefined; // Ignore host Promise assimilation, not Product reads.
    if (!live()) { staleReads++; throw Error(`STALE_FIELD:${label}.${String(key)}`); }
    const name = `${label}.${String(key)}`; reads[name] = (reads[name] ?? 0) + 1;
    return Reflect.get(target, key);
  } });
  const step = (prefix, value, commit) => {
    const label = `${prefix}.${counts[prefix] = (counts[prefix] ?? 0) + 1}`;
    sync(label);
    const finish = () => { commit?.(); return value; };
    if (label === pauseAt) { targetSeen = true; return gate.promise.then(finish); }
    if (label === rejectAt) return Promise.reject(Error(`SYNTHETIC_IO_REJECTION:${label}`));
    return Promise.resolve(finish());
  };
  const keyName = (key) => { const match = Object.entries(keys).find(([, value]) => value === key); assert.ok(match, "unknown storage key"); return match[0]; };
  const addListener = async (name, callback) => {
    sync(`listen:${name}`); callbacks.set(name, callback); return { remove: async () => {} };
  };
  const window = {
    location: { pathname: path, origin: "https://synthetic.invalid", search: "?test=1", assign: () => deny("link navigation"), reload: () => deny("reload"), replace: (url) => { sync("replace"); replacements.push(url); } },
    addEventListener: (name, callback) => { sync(`window:${name}`); hooks.set(name, callback); },
    removeEventListener: (name, callback) => { if (hooks.get(name) === callback) hooks.delete(name); },
    dispatchEvent: (event) => { sync(`event:${event.type}`); events.push(event); return true; }
  };
  const Preferences = {
    get: ({ key }) => { const name = keyName(key); return step(`${name}.get`, packet(`${name}.get`, { value: stored.get(key) })); },
    set: ({ key, value }) => {
      const name = keyName(key); writes.push({ key, value });
      return step(`${name}.set`, undefined, () => stored.set(key, value));
    }
  };
  const publisher = { isCurrent: live, networkOffline: live, appInactive: live, close: () => { closed = true; } };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["react", { useEffect: (fn) => { assert.equal(effect, undefined); effect = fn; }, useState: (initial) => { const index = slot++; return [typeof initial === "function" ? initial() : initial, (value) => { sync(`state:${index}`); states.push({ index, value }); }]; } }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name) => { assert.equal(name, "PushNotifications"); return true; }, getPlatform: () => { sync("platform"); return "ios"; } } }],
    ["@capacitor/app", { App: { addListener, getLaunchUrl: async () => null, getInfo: () => step("info.app", packet("info.app", { version: "synthetic-version" })) } }],
    ["@capacitor/device", { Device: { getInfo: () => step("info.device", packet("info.device", { name: "SYNTHETIC_DEVICE" })) } }],
    ["@capacitor/network", { Network: { addListener, getStatus: async () => ({ connected: mode !== "offline", connectionType: "wifi" }) } }],
    ["@capacitor/preferences", { Preferences }],
    ["@capacitor/push-notifications", { PushNotifications: { addListener, checkPermissions: () => step("permission.check", packet("permission", { receive: "granted" })), requestPermissions: () => deny("requestPermissions"), register: () => step("permission.register", undefined) } }],
    ["@/lib/domain/digital-observer/mobile-runtime", {
      mobileRuntimeRequiresSession: (value) => { assert.equal(value, path); return protectedRoute; },
      mobileNotificationPreview: () => deny("preview"),
      sanitizeOfflineQueue: (items) => { sync("sanitize"); sanitizeCount++; assert.ok(Array.isArray(items)); return items; }
    }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { openMobilePlaybackPublisher: () => publisher }]
  ]);
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    window, URL,
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: (url, options) => {
      assert.equal(options?.credentials, "same-origin");
      if (!options.method) {
        assert.ok(protectedRoute); assert.equal(url, "/api/digital-observer/mobile/runtime"); assert.equal(options.cache, "no-store");
        requests.push({ url, method: "GET" });
        const responseStatus = mode === "boot-failure" ? 500 : status;
        const body = packet("runtime.body", { data: packet("runtime.data", { sites }) });
        return step("runtime.fetch", packet("runtime.response", { ok: responseStatus === 200, status: responseStatus, json: () => step("runtime.body", body) }));
      }
      assert.equal(options.method, "POST"); assert.equal(options.headers["content-type"], "application/json");
      assert.ok(["/api/push/register", "/api/digital-observer/access-settings"].includes(url));
      const body = JSON.parse(options.body); requests.push({ url, method: "POST", body });
      const push = url === "/api/push/register";
      return step(push ? "push.post" : "access.post", packet(push ? "push.response" : "access.response", { ok: push ? mode !== "token-failure" : accessOk }));
    },
    setTimeout: (fn, delay) => { assert.equal(delay, 10000); const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: (id) => timers.delete(id),
    AbortController: class { constructor() { this.signal = Object.freeze({ synthetic: true }); } abort() {} },
    crypto: { randomUUID: () => { sync("uuid"); uuidCount++; return `00000000-0000-4000-8000-${String(uuidCount).padStart(12, "0")}`; } }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  exports.ObserverMobileRuntime(); assert.equal(typeof effect, "function");
  const cleanup = effect(); await drain();
  if (tokenMode) {
    assert.equal(typeof callbacks.get("registration"), "function");
    callbacks.get("registration")(packet("token", { value: "SYNTHETIC_NOT_A_REAL_TOKEN" }));
    await drain();
  }
  const dispose = () => { if (disposed) return; disposed = true; cleanup(); };
  return {
    calls, counts, callbacks, hooks, requests, writes, events, states, replacements, keys, stored, sites, timers,
    gate, dispose, seen: () => targetSeen,
    end: (kind) => { if (kind === "dispose") dispose(); else current = false; },
    snapshot: () => plain({ calls, reads, staleReads, uuidCount, sanitizeCount, requests, writes, events, states, replacements }),
    uuidCount: () => uuidCount
  };
}
function cleanupAfter(context, harness) { context.after(async () => { harness.dispose(); await drain(); }); }
function queued(h) { return JSON.parse(h.stored.get(h.keys.queue) || "[]"); }
function outcome(h, ok, reason) {
  const expected = { ok, ...(reason ? { reason } : {}) };
  assert.deepEqual(plain(h.events.at(-1)), { type: "digital-observer:native-push-result", detail: expected });
}

//23 distinct await boundaries. Each is a new persistence/bootstrap/token
//continuation, not a replay of listener, deep-link or enable-Push suites.
const boundaries = [
  { name: "bootstrap body hydration", mode: "boot", pauseAt: "runtime.body.1" },
  { name: "bootstrap saved Site", mode: "boot", pauseAt: "site.get.1" },
  { name: "bootstrap tokenless registration return", mode: "boot", savedSite: "site-a", pauseAt: "access.post.1" },
  { name: "bootstrap queue read", mode: "boot", pauseAt: "queue.get.1" },
  { name: "bootstrap queue write", mode: "boot", pauseAt: "queue.set.1" },
  { name: "bootstrap retry permission", mode: "boot", queue: pushRetry(), pauseAt: "permission.check.1" },
  { name: "bootstrap retry register", mode: "boot", queue: pushRetry(), pauseAt: "permission.register.1" },
  { name: "bootstrap catch enqueue read", mode: "boot-failure", pauseAt: "queue.get.1" },
  { name: "bootstrap catch enqueue write", mode: "boot-failure", pauseAt: "queue.set.1" },
  { name: "token saved Site read", mode: "token", pauseAt: "site.get.1" },
  { name: "token Device info", mode: "token", pauseAt: "info.device.1" },
  { name: "token App info", mode: "token", pauseAt: "info.app.1" },
  { name: "token reference read", mode: "token", pauseAt: "ref.get.1" },
  { name: "token new reference write", mode: "token", missingReference: true, pauseAt: "ref.set.1" },
  { name: "token Push POST", mode: "token", pauseAt: "push.post.1" },
  { name: "token access-settings POST", mode: "token", pauseAt: "access.post.1" },
  { name: "token saved Site write", mode: "token", pauseAt: "site.set.1" },
  { name: "token queue read", mode: "token", pauseAt: "queue.get.1" },
  { name: "token queue write", mode: "token", pauseAt: "queue.set.1" },
  { name: "token failure enqueue read", mode: "token-failure", pauseAt: "queue.get.1" },
  { name: "token failure enqueue write", mode: "token-failure", pauseAt: "queue.set.1" },
  { name: "offline enqueue read", mode: "offline", pauseAt: "queue.get.1" },
  { name: "offline enqueue write", mode: "offline", pauseAt: "queue.set.1" }
];
for (const boundary of boundaries) for (const transition of ["dispose", "replace"]) for (const settlement of ["resolve", "reject"]) {
  test(`${boundary.name}: ${settlement} after ${transition} is quiet`, async (context) => {
    const h = await mount(boundary); cleanupAfter(context, h);
    assert.ok(h.seen(), `target boundary not reached:${boundary.pauseAt}`);
    h.end(transition); await drain(); const before = h.snapshot();
    if (settlement === "resolve") h.gate.resolve(); else h.gate.reject(Error("SYNTHETIC_LATE_IO_REJECTION"));
    await drain(); assert.deepEqual(h.snapshot(), before, "no stale reads, UUID, sanitizer, next request/write/event/navigation/state");
    // An already-issued write may commit in the double after ownership ends.
    // Storage is deliberately not compared/rolled back; no NEXT write is allowed.
  });
}

test("live bootstrap hydrates Sites, tokenless device metadata and bounded queue/permission retry", async (context) => {
  const h = await mount({ savedSite: "site-a", queue: [operation("runtime_revalidate"), ...pushRetry()] }); cleanupAfter(context, h);
  assert.equal(h.requests.filter((r) => r.url === "/api/push/register").length, 0);
  assert.deepEqual(h.requests.find((r) => r.url === "/api/digital-observer/access-settings").body, {
    action: "register_device", observer_site_id: "site-a", device_label: "SYNTHETIC_DEVICE", platform: "ios", device_reference: "synthetic-reference"
  });
  assert.deepEqual(queued(h), pushRetry());
  assert.equal(h.counts["permission.check"], 1); assert.equal(h.counts["permission.register"], 1);
  assert.equal(h.states.filter((s) => s.index === 3 && s.value === false).length, 1);
  assert.equal(h.timers.size, 0);
});

test("live token flow preserves API payload, saved Site and queue filtering", async (context) => {
  const runtime = operation("runtime_revalidate");
  const h = await mount({ mode: "token", queue: [...pushRetry(), runtime] }); cleanupAfter(context, h);
  assert.deepEqual(h.requests.map((r) => r.url), ["/api/push/register", "/api/digital-observer/access-settings"]);
  assert.deepEqual(h.requests[0].body, { platform: "ios", device_token: "SYNTHETIC_NOT_A_REAL_TOKEN", device_id: "synthetic-reference", app_version: "synthetic-version", metadata: { source: "digital_observer_native", observer_site_id: "site-a" } });
  assert.equal(h.stored.get(h.keys.site), "site-a"); assert.deepEqual(queued(h), [runtime]);
  assert.equal(h.uuidCount(), 0); outcome(h, true);
});

test("live device-reference absence generates and persists exactly one reference", async (context) => {
  const h = await mount({ mode: "token", missingReference: true }); cleanupAfter(context, h);
  assert.equal(h.uuidCount(), 1); assert.equal(h.counts["ref.set"], 1);
  assert.equal(h.requests[0].body.device_id, h.stored.get(h.keys.ref)); outcome(h, true);
});

test("live token without Site retains site_required with no device or server work", async (context) => {
  const h = await mount({ mode: "token", savedSite: null }); cleanupAfter(context, h);
  assert.equal(h.requests.length, 0); assert.equal(h.counts["info.device"], undefined); outcome(h, false, "site_required");
});

test("live registration failure enqueues the original retry shape and reports failure", async (context) => {
  const h = await mount({ mode: "token-failure" }); cleanupAfter(context, h);
  outcome(h, false, "registration_failed");
  const items = queued(h); assert.equal(items.length, 1); assert.equal(items[0].kind, "push_registration");
  assert.equal(items[0].attempts, 0); assert.match(items[0].createdAt, /^\d{4}-\d\d-\d\dT/); assert.equal(h.uuidCount(), 1);
});

test("live retry persistence failure never reports registration success", async (context) => {
  const h = await mount({ mode: "token-failure", rejectAt: "queue.set.1" }); cleanupAfter(context, h);
  outcome(h, false, "registration_failed"); assert.deepEqual(queued(h), []);
});

for (const rejectAt of ["site.get.1", "ref.get.1", "ref.set.1"]) test(`live ${rejectAt} failure retains registration_failed recovery`, async (context) => {
  const h = await mount({ mode: "token", rejectAt, missingReference: rejectAt === "ref.set.1" }); cleanupAfter(context, h);
  outcome(h, false, "registration_failed"); assert.equal(h.requests.length, 0);
  assert.equal(queued(h)[0].kind, "push_registration");
});

for (const value of [null, "", "{malformed"]) test(`live queue ${String(value)} keeps existing empty/malformed behavior`, async (context) => {
  const h = await mount({ queue: value }); cleanupAfter(context, h);
  assert.deepEqual(queued(h), []); assert.equal(h.states.at(-1).value, false); assert.deepEqual(h.events, []);
});

test("live bootstrap401 retains retry enqueue and same-origin protected-route redirect", async (context) => {
  const h = await mount({ status: 401 }); cleanupAfter(context, h);
  assert.equal(h.counts["runtime.body"], undefined);
  assert.equal(queued(h)[0].kind, "runtime_revalidate"); assert.equal(h.replacements.length, 1);
  const login = new URL(h.replacements[0]); assert.equal(login.origin, "https://synthetic.invalid");
  assert.equal(login.pathname, "/digital-observer/login"); assert.equal(login.searchParams.get("next"), "/digital-observer/synthetic-runtime?test=1");
  assert.equal(h.states.some((s) => s.index === 3 && s.value === false), false);
});

test("public route skips bootstrap requests and persistence", async (context) => {
  const h = await mount({ mode: "public" }); cleanupAfter(context, h);
  assert.deepEqual(h.requests, []); assert.deepEqual(h.writes, []); assert.equal(h.counts["site.get"], undefined);
});

test("interrupted in-flight bootstrap still schedules at most one fresh follow-up", async (context) => {
  const h = await mount({ pauseAt: "runtime.body.1" }); cleanupAfter(context, h); assert.ok(h.seen());
  await h.callbacks.get("networkStatusChange")({ connected: false, connectionType: "none" });
  for (let n = 0; n < 3; n++) await h.callbacks.get("networkStatusChange")({ connected: true, connectionType: "wifi" });
  assert.equal(h.counts["runtime.fetch"], 1);
  h.gate.resolve(); await drain();
  assert.equal(h.counts["runtime.fetch"], 2); assert.equal(h.states.filter((s) => s.index === 3 && s.value === false).length, 1);
});

test("offline enqueue deduplicates an existing retry without UUID or write", async (context) => {
  const h = await mount({ mode: "offline", queue: [operation("runtime_revalidate")] }); cleanupAfter(context, h);
  assert.equal(h.uuidCount(), 0); assert.equal(h.counts["queue.set"], undefined); assert.equal(queued(h).length, 1);
});

test("live tokenless bootstrap registration failure retains existing best-effort continuation", async (context) => {
  const h = await mount({ savedSite: "site-a", accessOk: false }); cleanupAfter(context, h);
  assert.equal(h.counts["access.post"], 1); assert.equal(h.counts["queue.set"], 1);
  assert.equal(h.states.some((s) => s.index === 3 && s.value === false), true); assert.deepEqual(h.events, []);
});
