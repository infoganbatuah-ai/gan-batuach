import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import vm from "node:vm";

// New pending-consumer cases only. Actual TSX/closure/module cache through real
// rendered effect cleanup; no copied request helper or private-function export.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/observer-live-player.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/); const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "observer-live-player.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "observer-live-player.js" });
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props) => ({ type, props: props ?? {} });
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
async function drain() { for (let n = 0; n < 128; n++) await Promise.resolve(); }
const poison = new Proxy({}, { get(_target, key) { if (key === "then") return undefined; assert.fail(`stale payload read:${String(key)}`); } });
const direct = (name = "fresh") => ({ data: { playback: { hls_url: `https://synthetic.invalid/hls/${name}.m3u8` } } });
const claim = () => ({ data: { playback: { claim_url: "https://synthetic.invalid/playback/claim", allowed_origin: "https://synthetic.invalid", grant: "SYNTHETIC_GRANT" } } });
const claimed = (name = "fresh") => ({ playback: { hls_url: `https://synthetic.invalid/hls/${name}.m3u8` } });

function laboratory({ native = true } = {}) {
  const fibers = [], requests = [], media = [], states = [], reads = [], hlsInstances = [], timers = new Map(), listeners = new Map(), subscribers = new Set();
  let active, cursor = 0, timerId = 0, now = 0;
  const packet = (label, fields) => new Proxy(fields, { get(target, key) {
    if (key === "then") return undefined;
    reads.push(`${label}.${String(key)}`); return Reflect.get(target, key);
  } });
  const nested = (label, fields) => {
    if (!fields || typeof fields !== "object") return fields;
    return packet(label, Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value && typeof value === "object" ? nested(`${label}.${key}`, value) : value])));
  };
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const pending = [];
  const React = {
    useState: (initial) => {
      const own = active, slot = cursor++;
      if (!own.slots[slot]) own.slots[slot] = { kind: "state", value: typeof initial === "function" ? initial() : initial };
      assert.equal(own.slots[slot].kind, "state");
      return [own.slots[slot].value, (value) => { assert.equal(own.dead, false, "stale setter after unmount"); states.push({ id: own.id, slot }); own.slots[slot].value = typeof value === "function" ? value(own.slots[slot].value) : value; own.dirty = true; }];
    },
    useRef: (initial) => {
      const slot = cursor++; if (!active.slots[slot]) active.slots[slot] = { kind: "ref", value: { current: initial } };
      assert.equal(active.slots[slot].kind, "ref"); return active.slots[slot].value;
    },
    useEffect: (fn, deps) => {
      const own = active, slot = cursor++;
      if (!own.slots[slot] || !same(own.slots[slot].deps, deps)) {
        const old = own.slots[slot]; own.slots[slot] = { kind: "effect", deps, cleanup: old?.cleanup };
        pending.push(() => { own.slots[slot].cleanup?.(); own.slots[slot].cleanup = fn(); });
      }
      assert.equal(own.slots[slot].kind, "effect");
    }
  };
  const timerSet = (fn, delay, repeat) => {
    assert.ok(repeat ? delay === 2000 : [1200, 2400, 5000].includes(delay));
    const id = ++timerId; timers.set(id, { fn, delay, repeat }); return id;
  };
  class FakeHls {
    static Events = { MEDIA_ATTACHED: "attached", MANIFEST_PARSED: "manifest", ERROR: "error" };
    static isSupported() { return !native; }
    constructor(config) {
      assert.deepEqual(plain(config), { liveSyncDurationCount: 6, liveMaxLatencyDurationCount: 12, enableWorker: false, lowLatencyMode: false });
      this.events = new Map(); this.destroyed = false; this.loads = []; hlsInstances.push(this);
    }
    on(name, fn) { this.events.set(name, fn); }
    attachMedia(video) { this.video = video; media.push({ kind: "attach", id: video.id }); }
    loadSource(url) { this.loads.push(url); media.push({ kind: "hls-source", url }); }
    destroy() { this.destroyed = true; }
  }
  const modules = new Map([
    ["react", React], ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["hls.js", { __esModule: true, default: FakeHls }],
    ["lucide-react", { CameraOff: "CameraOff", LoaderCircle: "LoaderCircle", Volume2: "Volume2", VolumeX: "VolumeX" }],
    ["@/lib/domain/digital-observer/mobile-playback-lifecycle", { subscribeMobilePlayback: (fn) => { subscribers.add(fn); fn(null); return () => subscribers.delete(fn); } }]
  ]);
  const window = {
    addEventListener: (name, fn) => { const values = listeners.get(name) ?? new Set(); values.add(fn); listeners.set(name, values); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn)
  };
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    URL, window, Date: class extends Date { static now() { return now; } },
    setTimeout: (fn, delay) => timerSet(fn, delay, false), clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => timerSet(fn, delay, true), clearInterval: (id) => timers.delete(id),
    fetch: (url, options) => {
      assert.equal(options.method, "POST"); assert.deepEqual(plain(options.headers), { "content-type": "application/json" });
      const body = JSON.parse(options.body), kind = url === "/api/digital-observer/dvr-gateway" ? "cloud" : "claim";
      if (kind === "cloud") { assert.equal(body.mode, "live"); assert.equal(typeof body.observer_site_id, "string"); assert.equal(typeof body.camera_source_id, "string"); }
      else { assert.equal(url, "https://synthetic.invalid/playback/claim"); assert.deepEqual(body, { grant: "SYNTHETIC_GRANT" }); assert.equal(options.redirect, "error"); assert.equal(options.referrerPolicy, "no-referrer"); }
      const record = { kind, url, body, response: deferred(), payload: deferred(), jsonCalls: 0 }; requests.push(record);
      return record.response.promise;
    }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const unmount = (own) => { if (own.dead) return; own.dead = true; for (const slot of own.slots) if (slot?.kind === "effect") slot.cleanup?.(); };
  const render = (own) => {
    assert.equal(own.dead, false); active = own; cursor = 0;
    own.tree = exports.ObserverLivePlayer(own.props);
    const video = own.tree.props.children.find((node) => node?.type === "video"); assert.ok(video);
    video.props.ref.current = own.video;
    while (pending.length) pending.shift()(); own.dirty = false;
  };
  const mount = (site = "site-a", camera = "camera-a") => {
    const own = { id: fibers.length, props: { observerSiteId: site, cameraSourceId: camera, name: "SYNTHETIC" }, slots: [], dead: false, dirty: false };
    own.video = {
      id: own.id, currentTime: 0, muted: true, canPlayType: () => native ? "maybe" : "",
      pause: () => media.push({ kind: "pause", id: own.id }),
      removeAttribute: (key) => { assert.equal(key, "src"); media.push({ kind: "remove-src", id: own.id }); },
      load: () => media.push({ kind: "load", id: own.id }),
      play: () => { assert.equal(own.dead, false); media.push({ kind: "play", id: own.id }); return Promise.resolve(); },
      set src(url) { assert.equal(own.dead, false); this.url = url; media.push({ kind: "src", id: own.id, url }); }
    };
    fibers.push(own); render(own);
    return {
      own, video: own.video,
      unmount: () => unmount(own),
      // Running actual effect cleanup twice tests idempotent consumer release,
      // not just a harness-side once-protected unmount.
      cleanupAgain: () => { for (const slot of own.slots) if (slot?.kind === "effect") slot.cleanup?.(); },
      change: (camera, site = own.props.observerSiteId) => { own.props = { ...own.props, cameraSourceId: camera, observerSiteId: site }; render(own); },
      flush: () => { if (own.dirty && !own.dead) render(own); },
      state: () => { render(own); return own.tree.props["data-playback-state"]; }
    };
  };
  const respond = (record, { status = 200, body, poisonResponse = false } = {}) => {
    assert.ok(record);
    const index = requests.indexOf(record);
    const response = poisonResponse ? poison : packet(`response.${index}`, {
      ok: status >= 200 && status < 300, status,
      json: () => { record.jsonCalls++; return record.payload.promise; }
    });
    record.response.resolve(response);
    if (body !== undefined) record.payload.resolve(nested(`payload.${index}`, body));
  };
  return {
    mount, requests, media, reads, states, timers, hlsInstances,
    respond,
    body: (record, value, rejected = false) => { if (rejected) record.payload.reject(Error("SYNTHETIC_JSON_FAILURE")); else record.payload.resolve(value === poison ? value : nested(`payload.${requests.indexOf(record)}`, value)); },
    reject: (record) => record.response.reject(Error("SYNTHETIC_FETCH_FAILURE")),
    fire: (delay) => {
      const selected = [...timers.entries()].filter(([, entry]) => entry.delay === delay);
      assert.equal(selected.length, 1, `one timer:${delay}`);
      const [id, entry] = selected[0]; if (!entry.repeat) timers.delete(id); entry.fn();
    },
    emit: (suffix) => { for (const fn of [...(listeners.get(`digital-observer:${suffix}`) ?? [])]) fn(); },
    clock: (value) => { now = value; },
    snapshot: () => plain({ requests: requests.map((r) => ({ kind: r.kind, body: r.body, jsonCalls: r.jsonCalls })), media, reads, states }),
    cleanup: async () => {
      for (const own of fibers) unmount(own);
      for (const record of requests) { record.response.resolve({ ok: true, json: async () => ({}) }); record.payload.resolve({}); }
      for (const [id, entry] of [...timers]) { timers.delete(id); if (!entry.repeat) entry.fn(); }
      await drain(); assert.equal(timers.size, 0); assert.equal(subscribers.size, 0);
      assert.ok([...listeners.values()].every((values) => values.size === 0));
    }
  };
}
async function reach(h, p, stage) {
  const cloud = h.requests[0]; assert.equal(cloud.kind, "cloud");
  if (stage === "cloud-response") return cloud;
  if (stage === "cloud-json") { h.respond(cloud); await drain(); assert.equal(cloud.jsonCalls, 1); return cloud; }
  if (stage === "retry") { h.respond(cloud, { status: 503, body: {} }); await drain(); assert.equal(h.requests.length, 1); return cloud; }
  h.respond(cloud, { body: claim() }); await drain();
  const local = h.requests[1]; assert.equal(local.kind, "claim");
  if (stage === "claim-json") { h.respond(local); await drain(); assert.equal(local.jsonCalls, 1); }
  return local;
}
for (const stage of ["cloud-response", "cloud-json", "claim-response", "claim-json"]) for (const loss of ["unmount", "source-change"]) for (const rejected of [false, true]) {
  test(`last consumer ${loss} at ${stage}, late ${rejected ? "rejection" : "poisoned resolution"} cannot advance or cache`, async (t) => {
    const h = laboratory(); t.after(() => h.cleanup()); const p = h.mount(); const record = await reach(h, p, stage);
    if (loss === "unmount") { p.unmount(); p.cleanupAgain(); } else p.change("camera-b");
    const before = h.snapshot();
    if (stage.endsWith("response")) {
      if (rejected) h.reject(record); else h.respond(record, { poisonResponse: true });
    } else h.body(record, poison, rejected);
    await drain(); assert.deepEqual(h.snapshot(), before, "no late JSON/fields/new IO/cache-driven media or stale setter");
    const requestCount = h.requests.length; h.mount(); await drain();
    assert.equal(h.requests.length, requestCount + 1, "old orphan did not populate completed cache");
    assert.equal(h.requests.at(-1).body.camera_source_id, "camera-a");
  });
}
for (const loss of ["unmount", "source-change"]) {
  test(`last consumer ${loss} during backoff cannot start another request`, async (t) => {
    const h = laboratory(); t.after(() => h.cleanup()); const p = h.mount(); await reach(h, p, "retry");
    if (loss === "unmount") p.unmount(); else p.change("camera-b");
    const before = h.snapshot(); h.fire(1200); await drain(); assert.deepEqual(h.snapshot(), before);
    const count = h.requests.length; h.mount(); assert.equal(h.requests.length, count + 1);
  });
}
for (const stage of ["cloud-response", "cloud-json", "claim-response", "claim-json"]) {
  test(`one of two same-key consumers releases at ${stage}, survivor shares one cloud and claim`, async (t) => {
    const h = laboratory(); t.after(() => h.cleanup()); const p = h.mount(), q = h.mount(); assert.equal(h.requests.length, 1);
    const record = await reach(h, p, stage); p.unmount(); p.cleanupAgain();
    if (stage === "cloud-response") h.respond(record, { body: claim() });
    else if (stage === "cloud-json") h.body(record, claim());
    await drain();
    const local = h.requests.find((r) => r.kind === "claim"); assert.ok(local);
    if (stage === "claim-json") h.body(local, claimed()); else h.respond(local, { body: claimed() });
    await drain();
    assert.equal(h.requests.filter((r) => r.kind === "cloud").length, 1); assert.equal(h.requests.filter((r) => r.kind === "claim").length, 1);
    assert.equal(h.media.filter((m) => m.kind === "src" && m.id === p.own.id).length, 0);
    assert.equal(q.video.url, "https://synthetic.invalid/hls/fresh.m3u8");
    assert.equal(h.media.filter((m) => m.kind === "play").length, 1);
  });
}
for (const stage of ["cloud-response", "cloud-json"]) for (const rejected of [false, true]) {
  test(`all gone then fresh same-key ticket survives old ${stage} ${rejected ? "rejection" : "resolution"}, finally and release`, async (t) => {
    const h = laboratory(); t.after(() => h.cleanup()); const a = h.mount(), b = h.mount(); const old = await reach(h, a, stage);
    a.unmount(); b.unmount(); const fresh = h.mount(); assert.equal(h.requests.length, 2);
    if (stage.endsWith("response")) { if (rejected) h.reject(old); else h.respond(old, { poisonResponse: true }); }
    else h.body(old, poison, rejected);
    await drain(); a.cleanupAgain(); b.cleanupAgain();
    const join = h.mount(); assert.equal(h.requests.length, 2, "old finally/release must not delete fresh pending ticket");
    h.respond(h.requests[1], { body: direct("replacement") }); await drain();
    assert.equal(fresh.video.url, "https://synthetic.invalid/hls/replacement.m3u8"); assert.equal(join.video.url, fresh.video.url);
    const cached = h.mount(); await drain(); assert.equal(h.requests.length, 2); assert.equal(cached.video.url, fresh.video.url);
  });
}
test("independent Site/source keys retain their own consumers and cache", async (t) => {
  const h = laboratory(); t.after(() => h.cleanup()); const a = h.mount("site-a", "camera-a"), b = h.mount("site-b", "camera-a"), c = h.mount("site-a", "camera-b");
  assert.equal(h.requests.length, 3); a.unmount(); h.respond(h.requests[0], { poisonResponse: true });
  h.respond(h.requests[1], { body: direct("b") }); h.respond(h.requests[2], { body: direct("c") }); await drain();
  assert.equal(b.video.url, "https://synthetic.invalid/hls/b.m3u8"); assert.equal(c.video.url, "https://synthetic.invalid/hls/c.m3u8");
  h.mount("site-a", "camera-a"); h.mount("site-b", "camera-a"); await drain(); assert.equal(h.requests.length, 4);
});
test("completed valid cache survives ordinary unmount and expires at existing TTL", async (t) => {
  const h = laboratory(); t.after(() => h.cleanup()); const a = h.mount(); h.respond(h.requests[0], { body: direct("cached") }); await drain(); a.unmount();
  h.clock(239999); const cached = h.mount(); await drain(); assert.equal(h.requests.length, 1); assert.equal(cached.video.url, "https://synthetic.invalid/hls/cached.m3u8"); cached.unmount();
  h.clock(240000); h.mount(); assert.equal(h.requests.length, 2);
});
for (const status of [502, 503, 504]) {
  test(`current shared request retains three attempts/backoff for ${status}`, async (t) => {
    const h = laboratory(); t.after(() => h.cleanup()); h.mount(); h.mount();
    h.respond(h.requests[0], { status, body: {} }); await drain(); h.fire(1200); await drain();
    h.respond(h.requests[1], { status, body: {} }); await drain(); h.fire(2400); await drain();
    h.respond(h.requests[2], { status, body: {} }); await drain(); assert.equal(h.requests.length, 3);
    assert.equal([...h.timers.values()].filter((entry) => [1200, 2400].includes(entry.delay)).length, 0);
    assert.equal(h.media.filter((m) => m.kind === "src").length, 0);
  });
}
test("current nonretryable authorization error does not claim or internally retry", async (t) => {
  const h = laboratory(); t.after(() => h.cleanup()); const p = h.mount(); h.respond(h.requests[0], { status: 401, body: {} }); await drain();
  assert.equal(h.requests.length, 1); assert.equal(p.state(), "error");
  assert.equal([...h.timers.values()].filter((entry) => [1200, 2400].includes(entry.delay)).length, 0);
});
for (const invalid of ["claim-origin", "hls-origin"]) {
  test(`current ${invalid} remains fail-closed with consumer ownership`, async (t) => {
    const h = laboratory(); t.after(() => h.cleanup()); const p = h.mount();
    if (invalid === "claim-origin") {
      const body = claim(); body.data.playback.allowed_origin = "https://other.invalid"; h.respond(h.requests[0], { body }); await drain(); assert.equal(h.requests.length, 1);
    } else { h.respond(h.requests[0], { body: claim() }); await drain(); h.respond(h.requests[1], { body: { playback: { hls_url: "https://other.invalid/hls/no.m3u8" } } }); await drain(); }
    assert.equal(h.media.filter((m) => m.kind === "src").length, 0); assert.equal(p.state(), "error");
  });
}
test("suspension invalidates shared pending interest; resumed consumers share a fresh ticket", async (t) => {
  const h = laboratory(); t.after(() => h.cleanup()); const a = h.mount(), b = h.mount(); const old = h.requests[0];
  h.emit("mobile-offline"); h.respond(old, { poisonResponse: true }); await drain(); assert.equal(h.requests.length, 1);
  h.emit("mobile-online"); a.flush(); b.flush(); assert.equal(h.requests.length, 2);
  h.respond(h.requests[1], { body: direct("resumed") }); await drain(); assert.equal(a.video.url, b.video.url); assert.match(a.video.url, /resumed/);
});
test("current shared HLS consumer retains attachment configuration and valid cache", async (t) => {
  const h = laboratory({ native: false }); t.after(() => h.cleanup()); const a = h.mount(), b = h.mount(); a.unmount();
  h.respond(h.requests[0], { body: direct("hls") }); await drain(); assert.equal(h.hlsInstances.length, 1);
  const player = h.hlsInstances[0]; player.events.get("attached")(); player.events.get("manifest")(); await drain();
  assert.deepEqual(player.loads, ["https://synthetic.invalid/hls/hls.m3u8"]); assert.equal(h.media.filter((m) => m.kind === "play").length, 1);
  b.unmount(); assert.equal(player.destroyed, true);
});
test("one shared consumer changes source while the other retains its original claim", async (t) => {
  const h = laboratory(); t.after(() => h.cleanup()); const moving = h.mount(), staying = h.mount();
  const original = h.requests[0]; moving.change("camera-b"); assert.equal(h.requests.length, 2);
  h.respond(original, { body: claim() }); await drain();
  const local = h.requests.find((r) => r.kind === "claim"); assert.ok(local); h.respond(local, { body: claimed("original") }); await drain();
  assert.equal(staying.video.url, "https://synthetic.invalid/hls/original.m3u8"); assert.equal(moving.video.url, undefined);
  h.respond(h.requests[1], { body: direct("moved") }); await drain(); assert.equal(moving.video.url, "https://synthetic.invalid/hls/moved.m3u8");
  assert.equal(h.requests.filter((r) => r.kind === "claim").length, 1);
  assert.equal(h.requests.filter((r) => r.kind === "cloud" && r.body.camera_source_id === "camera-a").length, 1);
});
test("current retry succeeds within the original bound and remains cache-reusable", async (t) => {
  const h = laboratory(); t.after(() => h.cleanup()); const p = h.mount();
  h.respond(h.requests[0], { status: 503, body: {} }); await drain(); h.fire(1200); await drain();
  h.respond(h.requests[1], { body: direct("retry-success") }); await drain(); assert.equal(p.video.url, "https://synthetic.invalid/hls/retry-success.m3u8");
  h.mount(); await drain(); assert.equal(h.requests.length, 2);
});
