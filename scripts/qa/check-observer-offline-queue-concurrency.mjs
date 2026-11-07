import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import vm from "node:vm";

// Closed synthetic IO around the actual, unmodified runtime module. This does
// not prove real Preferences atomicity, multiple JS realms, APNs or native IO.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-mobile-runtime.tsx");
assert.ok(statSync(file).isFile(), "runtime must be a regular file");
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "refuse SF_DATALESS without hydration");
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
const op = (kind, id = kind) => ({ id, kind, createdAt: "2026-01-01T00:00:00.000Z", attempts: 0 });
const Q = "digital_observer_mobile_offline_queue_v1";
const S = "digital_observer_native_push_site_v1";
const R = "digital_observer_native_device_reference_v1";
const both = () => [op("runtime_revalidate"), op("push_registration")];
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
async function drain() { for (let i = 0; i < 192; i++) await Promise.resolve(); }

function laboratory(initial = []) {
  const stored = new Map([[Q, typeof initial === "string" ? initial : JSON.stringify(initial)], [S, "site-a"], [R, "synthetic-ref"]]);
  const counts = {}, calls = [], writes = [], gates = new Map(), failures = new Set(), instances = [];
  let active, generation = 0, uuid = 0, timer = 0;
  const closed = (name) => { throw Error(`UNEXPECTED_IO:${String(name)}`); };
  const step = (name, value, commit) => {
    const label = `${name}.${counts[name] = (counts[name] ?? 0) + 1}`;
    calls.push(label);
    const finish = () => { commit?.(); return value; };
    if (failures.delete(label)) return Promise.reject(Error(`SYNTHETIC_FAILURE:${label}`));
    const gate = gates.get(label);
    return gate ? gate.promise.then(finish) : Promise.resolve(finish());
  };
  const keyName = (key) => {
    assert.ok([Q, S, R].includes(key), "unexpected storage key");
    return key === Q ? "queue" : key === S ? "site" : "ref";
  };
  const Preferences = {
    get: ({ key }) => step(`${keyName(key)}.get`, { value: stored.get(key) }),
    set: ({ key, value }) => {
      const name = keyName(key);
      writes.push({ key, value });
      return step(`${name}.set`, undefined, () => stored.set(key, value));
    }
  };
  const jsx = (type, props) => ({ type, props });
  const listener = async (name, callback) => {
    const h = active;
    assert.ok(h && !h.disposed);
    h.callbacks.set(name, callback);
    return { remove: async () => { h.removals.push(name); } };
  };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["react", {
      useState: (initial) => {
        const h = active, index = h.slot++;
        return [typeof initial === "function" ? initial() : initial, (value) => h.states.push({ index, value })];
      },
      useEffect: (fn) => { assert.equal(active.effect, undefined); active.effect = fn; }
    }],
    ["@capacitor/core", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: (name) => { assert.equal(name, "PushNotifications"); return true; }, getPlatform: () => "ios" } }],
    ["@capacitor/app", { App: { addListener: listener, getInfo: async () => ({ version: "synthetic" }), getLaunchUrl: async () => null } }],
    ["@capacitor/device", { Device: { getInfo: async () => ({ name: "SYNTHETIC" }) } }],
    ["@capacitor/network", { Network: { addListener: listener, getStatus: async () => ({ connected: !active.offline, connectionType: "wifi" }) } }],
    ["@capacitor/preferences", { Preferences }],
    ["@capacitor/push-notifications", { PushNotifications: {
      addListener: listener,
      checkPermissions: async () => { active.permissions++; return { receive: "granted" }; },
      requestPermissions: () => closed("permission prompt"),
      register: async () => { active.registers++; }
    } }],
    ["@/lib/domain/digital-observer/mobile-runtime", {
      mobileRuntimeRequiresSession: (path) => path.startsWith("/digital-observer/qa"),
      mobileNotificationPreview: () => closed("notification"),
      // Narrow dependency double only. Parsing and all queue mutations are the
      // actual component code; unchanged domain sanitizer has its own evidence.
      sanitizeOfflineQueue: (items) => {
        assert.ok(Array.isArray(items));
        return items.filter((item) => item && ["runtime_revalidate", "push_registration"].includes(item.kind));
      }
    }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { openMobilePlaybackPublisher: () => {
      const h = active, ownGeneration = ++generation;
      const live = () => !h.disposed && !h.superseded && ownGeneration === generation;
      return { isCurrent: live, networkOffline: live, appInactive: live, close: () => { h.closed = true; } };
    } }]
  ]);
  const exports = {};
  const location = {
    get pathname() { return active.path; }, origin: "https://synthetic.invalid", search: "",
    assign: () => closed("navigation"), replace: () => closed("redirect"), reload: () => closed("reload")
  };
  const window = {
    location,
    addEventListener: (name, callback) => active.hooks.set(name, callback),
    removeEventListener: (name, callback) => { for (const h of instances) if (h.hooks.get(name) === callback) h.hooks.delete(name); },
    dispatchEvent: (event) => { active.events.push(plain(event)); return true; }
  };
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    window, URL,
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } },
    fetch: async (url, options) => {
      assert.equal(options.credentials, "same-origin");
      const h = active;
      if (!options.method) {
        assert.equal(url, "/api/digital-observer/mobile/runtime");
        assert.equal(options.cache, "no-store");
        h.gets++;
        return { ok: !h.bootFailure, status: h.bootFailure ? 500 : 200,
          json: async () => ({ data: { sites: [{ id: "site-a", name: "SYNTHETIC", timezone: null }] } }) };
      }
      assert.equal(options.method, "POST");
      assert.equal(options.headers["content-type"], "application/json");
      assert.ok(["/api/push/register", "/api/digital-observer/access-settings"].includes(url));
      const body = JSON.parse(options.body);
      if (url === "/api/push/register") {
        assert.equal(body.metadata.observer_site_id, "site-a");
        h.pushPosts++;
        return { ok: !h.pushFailure };
      }
      assert.equal(body.observer_site_id, "site-a");
      return { ok: true };
    },
    setTimeout: (_fn, delay) => { assert.equal(delay, 10000); const id = ++timer; active.timers.add(id); return id; },
    clearTimeout: (id) => { for (const h of instances) h.timers.delete(id); },
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}` }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  // One evaluation per laboratory, even when mounting successive runtimes.
  // Re-evaluating the module for a second owner would conceal a nonshared lane.
  return {
    stored, counts, calls, writes,
    pauseNext: (name) => {
      const label = `${name}.${(counts[name] ?? 0) + 1}`;
      const gate = deferred(); gates.set(label, gate); return gate;
    },
    failNext: (name) => failures.add(`${name}.${(counts[name] ?? 0) + 1}`),
    queue: () => JSON.parse(stored.get(Q) || "[]"),
    uuids: () => uuid,
    mount: async ({ offline = false } = {}) => {
      const h = { path: offline ? "/digital-observer/qa" : "/digital-observer/login", offline, disposed: false, superseded: false,
        callbacks: new Map(), hooks: new Map(), timers: new Set(), removals: [], events: [], states: [], slot: 0,
        permissions: 0, registers: 0, gets: 0, pushPosts: 0, pushFailure: false, bootFailure: false };
      active = h; instances.push(h);
      exports.ObserverMobileRuntime();
      const cleanup = h.effect();
      h.dispose = () => { if (!h.disposed) { h.disposed = true; cleanup(); } };
      h.boot = () => { active = h; h.path = "/digital-observer/qa"; return h.hooks.get("pageshow")(); };
      h.token = () => { active = h; h.callbacks.get("registration")({ value: "SYNTHETIC_ONLY" }); };
      await drain(); return h;
    },
    cleanup: async () => { for (const gate of gates.values()) gate.resolve(); await drain(); for (const h of instances) h.dispose(); await drain(); }
  };
}
async function setup(context, initial) {
  const lab = laboratory(initial); context.after(() => lab.cleanup());
  const h = await lab.mount(); return { lab, h };
}
function result(h, ok) {
  assert.deepEqual(h.events.filter((event) => event.type === "digital-observer:native-push-result").at(-1)?.detail,
    ok ? { ok: true } : { ok: false, reason: "registration_failed" });
}
function kinds(lab) { return lab.queue().map((item) => item.kind).sort(); }

test("paused bootstrap then successful registration never resurrects completed retry", async (t) => {
  const { lab, h } = await setup(t, [op("push_registration")]);
  const gate = lab.pauseNext("queue.get"); const boot = h.boot(); await drain();
  h.token(); await drain(); assert.equal(lab.counts["queue.get"], 1);
  assert.equal(h.events.length, 0, "registration must wait, not merge an old snapshot");
  gate.resolve(); await boot; await drain();
  result(h, true); assert.deepEqual(lab.queue(), []);
});
test("paused empty bootstrap then failed registration preserves newly enqueued retry", async (t) => {
  const { lab, h } = await setup(t, []);
  const gate = lab.pauseNext("queue.get"); const boot = h.boot(); await drain();
  h.pushFailure = true; h.token(); await drain(); assert.equal(lab.counts["queue.get"], 1);
  gate.resolve(); await boot; await drain();
  result(h, false); assert.deepEqual(kinds(lab), ["push_registration"]);
});
test("bootstrap retains push kind and bases permission retry on completed transaction", async (t) => {
  const { lab, h } = await setup(t, both());
  const gate = lab.pauseNext("queue.set"); const boot = h.boot(); await drain();
  assert.equal(h.permissions, 0); gate.resolve(); await boot;
  assert.deepEqual(kinds(lab), ["push_registration"]); assert.equal(h.permissions, 1); assert.equal(h.registers, 1);
});
test("registration cleanup retains independent runtime retry", async (t) => {
  const { lab, h } = await setup(t, both()); h.token(); await drain();
  result(h, true); assert.deepEqual(kinds(lab), ["runtime_revalidate"]);
});
test("parallel same-kind failures generate one UUID from latest snapshot", async (t) => {
  const { lab, h } = await setup(t, []); h.pushFailure = true;
  const gate = lab.pauseNext("queue.get"); h.token(); await drain(); h.token(); await drain();
  assert.equal(lab.counts["queue.get"], 1); gate.resolve(); await drain();
  assert.deepEqual(kinds(lab), ["push_registration"]); assert.equal(lab.uuids(), 1); assert.equal(lab.counts["queue.set"], 1);
  assert.equal(h.events.filter((e) => e.detail?.reason === "registration_failed").length, 2);
});
test("concurrent distinct-kind failures retain both retries", async (t) => {
  const { lab, h } = await setup(t, []); h.bootFailure = true; h.pushFailure = true;
  const gate = lab.pauseNext("queue.get"); const boot = h.boot(); await drain(); h.token(); await drain();
  gate.resolve(); await boot; await drain(); assert.deepEqual(kinds(lab), ["push_registration", "runtime_revalidate"]);
  assert.equal(lab.uuids(), 2);
});
test("two cleanup transactions reread latest storage in reverse operation order", async (t) => {
  const { lab, h } = await setup(t, both());
  const gate = lab.pauseNext("queue.set"); h.token(); await drain(); const boot = h.boot(); await drain();
  assert.equal(lab.counts["queue.get"], 1); gate.resolve(); await boot; await drain();
  assert.deepEqual(lab.queue(), []); result(h, true); assert.equal(h.permissions, 0);
  assert.deepEqual(lab.writes.filter((w) => w.key === Q).map((w) => JSON.parse(w.value).map((o) => o.kind)), [["runtime_revalidate"], []]);
});
for (const failure of ["queue.get", "queue.set"]) {
  test(`live ${failure} rejection does not poison the next mutation`, async (t) => {
    const { lab, h } = await setup(t, both()); lab.failNext(failure);
    h.token(); await drain(); result(h, false);
    assert.ok(kinds(lab).includes("push_registration"));
    h.token(); await drain(); result(h, true); assert.deepEqual(kinds(lab), ["runtime_revalidate"]);
  });
}
for (const staleBy of ["dispose", "supersede"]) {
  test(`queued stale waiter performs no queue IO after ${staleBy}`, async (t) => {
    const { lab, h } = await setup(t, both());
    const gate = lab.pauseNext("queue.get"); const boot = h.boot(); await drain(); h.token(); await drain();
    assert.equal(lab.counts["queue.get"], 1);
    if (staleBy === "dispose") h.dispose(); else h.superseded = true;
    gate.resolve(); await boot; await drain();
    assert.equal(lab.counts["queue.get"], 1); assert.equal(lab.counts["queue.set"] ?? 0, 0);
    assert.equal(h.events.length, 0); assert.deepEqual(kinds(lab), ["push_registration", "runtime_revalidate"]);
  });
}
for (const settlement of ["commit", "reject"]) {
  test(`fresh owner waits for prior issued queue write to ${settlement}`, async (t) => {
    const { lab, h: old } = await setup(t, both());
    const gate = lab.pauseNext("queue.set"); const oldBoot = old.boot(); await drain();
    assert.equal(lab.counts["queue.set"], 1);
    old.dispose(); const fresh = await lab.mount(); fresh.token(); await drain();
    assert.equal(lab.counts["queue.get"], 1, "new owner must not read before old issued write settles");
    if (settlement === "commit") gate.resolve(); else gate.reject(Error("SYNTHETIC_LATE_WRITE_FAILURE"));
    await oldBoot; await drain(); result(fresh, true);
    assert.deepEqual(kinds(lab), settlement === "commit" ? [] : ["runtime_revalidate"]);
    assert.equal(old.events.length, 0); assert.equal(lab.counts["queue.get"], 2);
  });
}
for (const initial of [[], "{malformed"]) {
  test(`healthy bootstrap cleans ${typeof initial === "string" ? "malformed" : "empty"} stored queue`, async (t) => {
    const { lab, h } = await setup(t, initial); await h.boot(); await drain();
    assert.deepEqual(lab.queue(), []); assert.equal(h.permissions, 0); assert.equal(h.timers.size, 0);
    assert.equal(h.states.filter((s) => s.index === 3).at(-1)?.value, false);
  });
}
test("offline startup enqueue and subsequent online cleanup use same queue lane", async (t) => {
  const lab = laboratory([op("push_registration")]); t.after(() => lab.cleanup());
  const h = await lab.mount({ offline: true });
  assert.deepEqual(kinds(lab), ["push_registration", "runtime_revalidate"]);
  await h.callbacks.get("networkStatusChange")({ connected: true, connectionType: "wifi" }); await drain();
  assert.deepEqual(kinds(lab), ["push_registration"]); assert.equal(lab.uuids(), 1);
});
test("failed enqueue write never reports registration success and later retry can persist", async (t) => {
  const { lab, h } = await setup(t, []); h.pushFailure = true; lab.failNext("queue.set");
  h.token(); await drain(); result(h, false); assert.deepEqual(lab.queue(), []);
  h.token(); await drain(); result(h, false); assert.deepEqual(kinds(lab), ["push_registration"]);
  assert.equal(h.events.some((e) => e.detail?.ok === true), false);
});
test("existing same-kind item keeps ID timestamp and attempts on failed registration", async (t) => {
  const existing = { ...op("push_registration", "preserved"), attempts: 4 };
  const { lab, h } = await setup(t, [existing]); h.pushFailure = true; h.token(); await drain();
  result(h, false); assert.deepEqual(lab.queue(), [existing]); assert.equal(lab.uuids(), 0); assert.equal(lab.counts["queue.set"] ?? 0, 0);
});
