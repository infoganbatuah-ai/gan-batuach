import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL as NativeURL } from "node:url";
import vm from "node:vm";

// Actual component only. Every installer/download/share/approval/token effect
// below is a closed SYNTHETIC record; this test never installs or downloads.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/connector-install-handoff.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/); const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, "refuse dataless source");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "connector-install-handoff.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "connector-install-handoff.js" });
const SITE_A = "00000000-0000-4000-8000-000000000001", SITE_B = "00000000-0000-4000-8000-000000000002";
const INTENT_A = "00000000-0000-4000-8000-000000000021", INTENT_B = "00000000-0000-4000-8000-000000000022";
const ENROLL_A = "00000000-0000-4000-8000-000000000031", ENROLL_B = "00000000-0000-4000-8000-000000000032";
const CREATED = "00000000-0000-4000-8000-000000000041";
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
async function drain() { for (let n = 0; n < 128; n++) await Promise.resolve(); }
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
const poison = new Proxy({}, { get(_target, key) { if (key === "then") return undefined; assert.fail(`stale data:${String(key)}`); } });
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
function fixture({ platform = "MACOS", canShare = true, initialIntent = "" } = {}) {
  const requests = [], reads = [], writes = [], effects = [], callbacks = [], timers = new Map(), revokes = [], shares = [], pending = [];
  const fibers = []; let fiber, cursor = 0, tree, dead = false, timerId = 0, objectId = 0, hidden = false, tokenReads = 0;
  const callbackProps = (label) => ({
    onOnline: (intent) => callbacks.push({ kind: "online", label, intent }),
    onProductAction: () => callbacks.push({ kind: "product", label }),
    onInstallerAction: () => callbacks.push({ kind: "installer", label }),
    onFailure: (category) => callbacks.push({ kind: "failure", label, category })
  });
  let props = { siteId: SITE_A, family: "unknown", initialIntent, ...callbackProps("A") };
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const packet = (label, fields) => new Proxy(fields, { get(target, key) {
    if (key === "then") return undefined;
    reads.push(`${label}.${String(key)}`); return Reflect.get(target, key);
  } });
  const nested = (label, fields) => {
    if (!fields || typeof fields !== "object") return fields;
    if (Array.isArray(fields)) return fields.map((value, index) => nested(`${label}.${index}`, value));
    return packet(label, Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, nested(`${label}.${key}`, value)])));
  };
  const React = {
    useState: (initial) => {
      const own = fiber, slot = cursor++;
      if (!own.slots[slot]) own.slots[slot] = { kind: "state", value: typeof initial === "function" ? initial() : initial };
      assert.equal(own.slots[slot].kind, "state");
      return [own.slots[slot].value, (value) => { assert.equal(own.dead, false, "stale setter"); writes.push({ key: own.key, slot }); own.slots[slot].value = typeof value === "function" ? value(own.slots[slot].value) : value; own.dirty = true; }];
    },
    useRef: (initial) => {
      const slot = cursor++; if (!fiber.slots[slot]) fiber.slots[slot] = { kind: "ref", value: { current: initial } };
      assert.equal(fiber.slots[slot].kind, "ref"); return fiber.slots[slot].value;
    },
    useCallback: (fn, deps) => {
      const slot = cursor++; if (!fiber.slots[slot] || !same(fiber.slots[slot].deps, deps)) fiber.slots[slot] = { kind: "callback", value: fn, deps };
      assert.equal(fiber.slots[slot].kind, "callback"); return fiber.slots[slot].value;
    },
    useEffect: (fn, deps) => {
      const own = fiber, slot = cursor++;
      if (!own.slots[slot] || !same(own.slots[slot].deps, deps)) {
        const old = own.slots[slot]; own.slots[slot] = { kind: "effect", deps, cleanup: old?.cleanup };
        pending.push(() => { own.slots[slot].cleanup?.(); own.slots[slot].cleanup = fn(); });
      }
      assert.equal(own.slots[slot].kind, "effect");
    }
  };
  const modules = new Map([
    ["react", React], ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["@/lib/domain/digital-observer/client-session", { readObserverAccessToken: () => { tokenReads++; return "SYNTHETIC_TOKEN"; } }],
    ["@/lib/domain/digital-observer/connector-installation", { installerPlatform: (ua) => { assert.equal(ua, "SYNTHETIC_UA"); return platform; } }]
  ]);
  const setTimer = (fn, delay, repeat) => { assert.ok(repeat ? delay === 5000 : [0, 1000].includes(delay)); const id = ++timerId; timers.set(id, { fn, delay, repeat }); return id; };
  class SyntheticFile {
    constructor(parts, name, options) { this.parts = parts; this.name = name; this.type = options.type; effects.push({ kind: "File", parts: plain(parts), name, type: this.type }); }
  }
  class SyntheticURL extends NativeURL {
    static createObjectURL(value) { assert.ok(value instanceof SyntheticFile); const url = `blob:synthetic-${++objectId}`; effects.push({ kind: "objectURL", url }); return url; }
    static revokeObjectURL(url) { revokes.push(url); }
  }
  const share = deferred();
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    URL: SyntheticURL, File: SyntheticFile,
    window: { location: { href: "https://synthetic.invalid/digital-observer/qa?unchanged=1" }, open: (...args) => effects.push({ kind: "open", args }) },
    history: { replaceState: (state, title, url) => { assert.equal(state, null); assert.equal(title, ""); effects.push({ kind: "history", url: String(url) }); } },
    navigator: {
      userAgent: "SYNTHETIC_UA",
      canShare: (input) => { assert.ok(input.files[0] instanceof SyntheticFile); effects.push({ kind: "canShare" }); return canShare; },
      share: (input) => { shares.push(input); effects.push({ kind: "share", title: input.title, text: input.text, names: input.files.map((file) => file.name) }); return share.promise; }
    },
    document: {
      get hidden() { return hidden; },
      createElement: (tag) => { assert.equal(tag, "a"); effects.push({ kind: "anchor" }); const node = { href: "", download: "", click: () => effects.push({ kind: "click", href: node.href, download: node.download }) }; return node; }
    },
    setTimeout: (fn, delay) => setTimer(fn, delay, false), clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => setTimer(fn, delay, true), clearInterval: (id) => timers.delete(id),
    fetch: (url, options) => {
      assert.equal(options.cache, "no-store"); assert.equal(options.credentials, "same-origin");
      let kind, body;
      if (!options.method) {
        const parsed = new NativeURL(url, "https://synthetic.invalid");
        assert.equal(parsed.pathname, "/api/digital-observer/connector-installation"); assert.equal(parsed.searchParams.get("action"), "manifest");
        kind = "manifest"; body = Object.fromEntries(parsed.searchParams);
        assert.deepEqual(plain(options.headers), { authorization: "Bearer SYNTHETIC_TOKEN" });
      } else {
        assert.equal(options.method, "POST"); assert.deepEqual(plain(options.headers), { "content-type": "application/json", authorization: "Bearer SYNTHETIC_TOKEN" });
        body = JSON.parse(options.body); kind = body.action;
        assert.equal(url, kind === "approve" ? "/api/digital-observer/gateway-enrollment" : "/api/digital-observer/connector-installation");
        assert.ok(["status", "create", "approve"].includes(kind));
      }
      const record = { kind, url, body, response: deferred(), payload: deferred(), jsonCalls: 0 }; requests.push(record); return record.response.promise;
    }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const destroy = (own) => { if (!own || own.dead) return; own.dead = true; for (const slot of own.slots) if (slot?.kind === "effect") slot.cleanup?.(); };
  const render = () => {
    assert.equal(dead, false); let passes = 0;
    do {
      assert.ok(++passes < 8); const shell = exports.ConnectorInstallHandoff(props);
      assert.equal(typeof shell.type, "function", "keyed top-level scope required");
      if (!fiber || fiber.key !== shell.key || fiber.type !== shell.type) { destroy(fiber); fiber = { key: shell.key, type: shell.type, slots: [], dead: false, dirty: false }; fibers.push(fiber); }
      fiber.dirty = false; cursor = 0; tree = shell.type(shell.props); while (pending.length) pending.shift()();
    } while (fiber.dirty);
  };
  render();
  const handler = (kind) => {
    render(); const words = { begin: "התקן והמשך", mac: "שליחה ל‑Mac", windows: "שליחה ל‑Windows", confirm: "אישור חיבור המחשב", retry: "נסה שוב" };
    const matches = nodes(tree, (node) => node.type === "button" && text(node).includes(words[kind])); assert.equal(matches.length, 1, `button:${kind}`); return matches[0].props.onClick;
  };
  const defaults = (record) => {
    if (record.kind === "manifest") return { available: true, platform: record.body.platform, filename: "SYNTHETIC_INSTALLER", download_path: "/synthetic/installer-only" };
    if (record.kind === "create") return { document: { version: "connector-install-v1", intent_id: CREATED, observer_site_id: record.body.observer_site_id,
      secret: "SYNTHETIC_NOT_AN_ENROLLMENT_SECRET", expires_at: "2030-01-01T00:00:00.000Z", origin: "https://synthetic.invalid" } };
    return record.kind === "approve" ? { approved: true } : { stage: "WAITING_FOR_INSTALL", enrollment_id: null, expires_at: "2030-01-01T00:00:00.000Z" };
  };
  const respond = (record, { data, status = 200, headersOnly = false, poisonResponse = false } = {}) => {
    assert.ok(record); const index = requests.indexOf(record);
    record.response.resolve(poisonResponse ? poison : packet(`response.${index}`, { ok: status >= 200 && status < 300,
      json: () => { record.jsonCalls++; return record.payload.promise; } }));
    if (!headersOnly && !poisonResponse) record.payload.resolve(nested(`payload.${index}`, { data: data ?? defaults(record) }));
  };
  const fire = (delay) => {
    const matches = [...timers.entries()].filter(([, entry]) => entry.delay === delay); assert.equal(matches.length, 1, `one timer:${delay}`);
    const [id, entry] = matches[0]; if (!entry.repeat) timers.delete(id); entry.fn();
  };
  const unmount = () => { if (!dead) { dead = true; destroy(fiber); } };
  return {
    requests, effects, callbacks, revokes, timers, reads, writes, shares,
    handler, click: (kind = platform === "MOBILE" ? "mac" : "begin") => handler(kind)(), defaults, respond, fire,
    scope: (changes) => { props = { ...props, ...changes, ...callbackProps("B") }; render(); }, rerender: render,
    start: () => fire(0), hidden: (value) => { hidden = value; },
    body: (record, value, rejected = false) => { if (rejected) record.payload.reject(Error("SYNTHETIC_JSON_REJECTION")); else record.payload.resolve(value === poison ? value : nested(`payload.${requests.indexOf(record)}`, { data: value })); },
    reject: (record) => record.response.reject(Error("SYNTHETIC_RESPONSE_REJECTION")),
    share: (rejected = false) => { if (rejected) share.reject(Error("SYNTHETIC_SHARE_REJECTION")); else share.resolve(); },
    peek: (delay) => { const matches = [...timers.values()].filter((entry) => entry.delay === delay); assert.equal(matches.length, 1); return matches[0].fn; },
    ui: () => { render(); const buttons = nodes(tree, (node) => node.type === "button"); return {
      text: text(tree), busy: buttons.some((button) => button.props.disabled === true), error: text(nodes(tree, (node) => node.props?.role === "alert")[0])
    }; },
    snapshot: () => plain({ requests: requests.map((r) => ({ kind: r.kind, body: r.body, jsonCalls: r.jsonCalls })), reads, writes, effects, callbacks, revokes, tokenReads }),
    unmount,
    cleanup: async () => { unmount(); for (const r of requests) { r.response.resolve({ ok: true, json: async () => ({}) }); r.payload.resolve({}); } share.resolve(); await drain(); assert.equal(timers.size, 0); }
  };
}
const last = (h, kind) => h.requests.filter((r) => r.kind === kind).at(-1);
const count = (h, kind) => h.requests.filter((r) => r.kind === kind).length;
async function manifest(h) { h.click(); await drain(); h.respond(last(h, "manifest")); await drain(); }
async function created(h) { await manifest(h); h.respond(last(h, "create")); await drain(); h.ui(); }
async function confirmReady(h) {
  h.start(); const r = last(h, "status"); h.respond(r, { data: { ...h.defaults(r), stage: "CONFIRM_COMPUTER", enrollment_id: ENROLL_A } }); await drain(); h.ui();
}
async function reach(h, stage) {
  if (stage.startsWith("status")) { h.start(); return last(h, "status"); }
  if (stage.startsWith("approve")) { await confirmReady(h); h.click("confirm"); await drain(); return last(h, "approve"); }
  if (stage.startsWith("manifest")) { h.click(); await drain(); return last(h, "manifest"); }
  await manifest(h);
  if (stage.startsWith("create")) return last(h, "create");
  h.respond(last(h, "create")); await drain(); assert.equal(h.shares.length, 1); return null;
}
const stages = ["manifest", "manifest-json", "create", "create-json", "status", "status-json", "approve", "approve-json", "share"];
for (const stage of stages) for (const loss of ["unmount", "Site", "family", "initialIntent"]) for (const rejected of [false, true]) {
  test(`${stage} late ${rejected ? "rejection" : "resolution"} after ${loss} has no next effects`, async (t) => {
    const h = fixture({ platform: stage === "share" ? "MOBILE" : "MACOS", initialIntent: /^(status|approve)/.test(stage) ? INTENT_A : "" }); t.after(() => h.cleanup());
    const record = await reach(h, stage);
    if (stage.endsWith("json")) { h.respond(record, { headersOnly: true }); await drain(); assert.equal(record.jsonCalls, 1); }
    if (loss === "unmount") h.unmount();
    else h.scope(loss === "Site" ? { siteId: SITE_B } : loss === "family" ? { family: "synthetic-family" } : { initialIntent: INTENT_B });
    const ui = loss === "unmount" ? null : h.ui(), before = h.snapshot();
    if (stage === "share") h.share(rejected);
    else if (stage.endsWith("json")) h.body(record, poison, rejected);
    else if (rejected) h.reject(record); else h.respond(record, { poisonResponse: true });
    await drain(); assert.deepEqual(h.snapshot(), before, "no stale data/token/new IO/history/File/share/open/download/parent/state/finally");
    if (ui) assert.deepEqual(h.ui(), ui);
  });
}
for (const platform of ["MACOS", "WINDOWS"]) {
  test(`current ${platform} desktop preserves exact manifest/create/File/history/download UX`, async (t) => {
    const h = fixture({ platform }); t.after(() => h.cleanup()); await created(h);
    assert.equal(last(h, "manifest").body.platform, platform === "MACOS" ? "macos-arm64" : "windows-x64");
    assert.deepEqual(last(h, "create").body, { action: "create", observer_site_id: SITE_A, family: "unknown" });
    const file = h.effects.find((e) => e.kind === "File"); assert.equal(file.name, "Digital Observer.observer-connect"); assert.equal(file.type, "application/vnd.digital-observer.connect+json");
    assert.equal(JSON.parse(file.parts[0]).intent_id, CREATED);
    const history = h.effects.find((e) => e.kind === "history").url; assert.equal(new NativeURL(history).searchParams.get("install_intent"), CREATED); assert.equal(history.includes("SYNTHETIC_NOT_AN_ENROLLMENT_SECRET"), false);
    assert.deepEqual(h.effects.filter((e) => e.kind === "click").map((e) => e.download), ["Digital Observer.observer-connect", "SYNTHETIC_INSTALLER"]);
    assert.equal(h.callbacks.filter((c) => c.kind === "product").length, 1); assert.equal(h.callbacks.filter((c) => c.kind === "installer").length, 1);
  });
}
for (const selection of ["mac", "windows"]) {
  test(`current mobile explicit ${selection} shares then opens authenticated installer`, async (t) => {
    const h = fixture({ platform: "MOBILE" }); t.after(() => h.cleanup()); h.click(selection); await drain(); h.respond(last(h, "manifest")); await drain(); h.respond(last(h, "create")); await drain();
    assert.equal(last(h, "manifest").body.platform, selection === "mac" ? "macos-arm64" : "windows-x64"); assert.equal(h.shares.length, 1); assert.equal(h.effects.filter((e) => e.kind === "open").length, 0);
    h.share(); await drain(); assert.deepEqual(h.effects.find((e) => e.kind === "open").args, ["/synthetic/installer-only", "_blank", "noopener,noreferrer"]);
    assert.equal(h.callbacks.filter((c) => c.kind === "installer").length, 1); assert.equal(h.effects.filter((e) => e.kind === "click").length, 0);
  });
}
for (const selection of ["mac", "windows"]) {
  test(`mobile ${selection} canShare false retains two-download fallback`, async (t) => {
    const h = fixture({ platform: "MOBILE", canShare: false }); t.after(() => h.cleanup()); h.click(selection); await drain(); h.respond(last(h, "manifest")); await drain(); h.respond(last(h, "create")); await drain();
    assert.equal(h.shares.length, 0); assert.equal(h.effects.filter((e) => e.kind === "click").length, 2); assert.equal(h.callbacks.filter((c) => c.kind === "installer").length, 1);
  });
}
for (const failure of ["unavailable", "no-path", "http"]) {
  test(`current manifest ${failure} prevents create and reports current failure`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); h.click(); await drain(); const r = last(h, "manifest"), data = h.defaults(r);
    if (failure === "unavailable") data.available = false; if (failure === "no-path") delete data.download_path;
    h.respond(r, { data, status: failure === "http" ? 503 : 200 }); await drain();
    assert.equal(count(h, "create"), 0); assert.equal(h.effects.length, 0); assert.match(h.ui().error, /לא ניתן להתחיל/); assert.equal(h.ui().busy, false);
    assert.equal(h.callbacks.at(-1).category, "INSTALLER_UNAVAILABLE");
  });
}
test("unsupported platform preserves current failure without manifest request", async (t) => {
  const h = fixture({ platform: "UNSUPPORTED" }); t.after(() => h.cleanup()); h.click(); await drain(); assert.equal(h.requests.length, 0); assert.equal(h.callbacks.at(-1).category, "INSTALLER_UNAVAILABLE");
});
test("current share rejection reports failure without opening installer", async (t) => {
  const h = fixture({ platform: "MOBILE" }); t.after(() => h.cleanup()); await created(h); h.share(true); await drain();
  assert.equal(h.effects.filter((e) => e.kind === "open").length, 0); assert.equal(h.callbacks.at(-1).category, "INSTALLER_UNAVAILABLE"); assert.equal(h.ui().busy, false);
});
test("current create rejection never creates history or a file", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await manifest(h); h.reject(last(h, "create")); await drain(); assert.equal(h.effects.length, 0); assert.equal(h.ui().busy, false); assert.equal(h.callbacks.at(-1).category, "INSTALLER_UNAVAILABLE");
});
for (const rejected of [false, true]) {
  test(`newest same-intent status wins over older ${rejected ? "rejection" : "response"}`, async (t) => {
    const h = fixture({ initialIntent: INTENT_A }); t.after(() => h.cleanup()); h.start(); const old = last(h, "status"); h.fire(5000); const fresh = last(h, "status");
    h.respond(fresh, { data: { ...h.defaults(fresh), stage: "CONNECTOR_FOUND" } }); await drain(); const ui = h.ui(), before = h.snapshot();
    if (rejected) h.reject(old); else h.respond(old, { poisonResponse: true }); await drain(); assert.deepEqual(h.snapshot(), before); assert.deepEqual(h.ui(), ui);
    assert.deepEqual(h.callbacks.filter((c) => c.kind === "online"), [{ kind: "online", label: "A", intent: INTENT_A }]);
  });
}
test("old status intent cannot notify parent after an explicit replacement begin", async (t) => {
  const h = fixture({ initialIntent: INTENT_A }); t.after(() => h.cleanup()); h.start(); const first = last(h, "status");
  h.respond(first, { data: { ...h.defaults(first), stage: "EXPIRED" } }); await drain(); h.ui(); h.fire(5000); const old = last(h, "status");
  h.click(); await drain(); h.respond(last(h, "manifest")); await drain(); h.respond(last(h, "create")); await drain(); const before = h.snapshot();
  h.respond(old, { poisonResponse: true }); await drain(); assert.deepEqual(h.snapshot(), before); assert.equal(h.callbacks.some((c) => c.kind === "online"), false);
});
test("duplicate current begin callback does not start a second manifest/create", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); const begin = h.handler("begin"); begin(); begin(); await drain(); assert.equal(count(h, "manifest"), 1);
  h.respond(last(h, "manifest")); await drain(); assert.equal(count(h, "create"), 1); h.respond(last(h, "create")); await drain();
  const before = h.snapshot(); begin(); await drain(); assert.deepEqual(h.snapshot(), before, "retained old empty-intent callback cannot restart created intent");
});
test("explicit confirm binds newest enrollment and intent; old callback and duplicate are denied", async (t) => {
  const h = fixture({ initialIntent: INTENT_A }); t.after(() => h.cleanup()); await confirmReady(h); const old = h.handler("confirm"); h.fire(5000); const r = last(h, "status");
  h.respond(r, { data: { ...h.defaults(r), stage: "CONFIRM_COMPUTER", enrollment_id: ENROLL_B } }); await drain(); old(); assert.equal(count(h, "approve"), 0);
  const current = h.handler("confirm"); current(); current(); await drain(); assert.equal(count(h, "approve"), 1);
  assert.deepEqual(last(h, "approve").body, { action: "approve", enrollment_request_id: ENROLL_B, observer_site_id: SITE_A });
  h.respond(last(h, "approve")); await drain(); assert.equal(last(h, "status").body.intent_id, INTENT_A);
  const terminal = last(h, "status"); h.respond(terminal, { data: { ...h.defaults(terminal), stage: "CONNECTOR_FOUND" } }); await drain();
  current(); assert.equal(count(h, "approve"), 1); assert.equal(h.ui().busy, false); assert.equal(h.callbacks.filter((c) => c.kind === "online").length, 1);
});
for (const loss of ["timer", "cleanup"]) {
  test(`owned object URL is revoked once on ${loss}, never redownloaded`, async (t) => {
    const h = fixture(); t.after(() => h.cleanup()); await created(h); const queued = h.peek(1000), clicks = h.effects.filter((e) => e.kind === "click").length;
    if (loss === "timer") h.fire(1000); else h.unmount();
    queued(); h.unmount(); assert.deepEqual(h.revokes, ["blob:synthetic-1"]); assert.equal(h.effects.filter((e) => e.kind === "click").length, clicks);
  });
}
test("existing polling respects visibility, busy action, startup and five-second interval", async (t) => {
  const h = fixture({ initialIntent: INTENT_A }); t.after(() => h.cleanup()); await confirmReady(h); assert.equal(count(h, "status"), 1);
  h.hidden(true); h.fire(5000); assert.equal(count(h, "status"), 1); h.hidden(false); h.click("confirm"); h.ui();
  h.fire(5000); h.fire(0); assert.equal(count(h, "status"), 1, "polling must not compete with active explicit approval");
  h.respond(last(h, "approve")); await drain(); assert.equal(count(h, "status"), 2, "authorized approval continuation can refresh while busy");
});
test("same-scope created intent survives unrelated rerenders without inheriting initial intent again", async (t) => {
  const h = fixture(); t.after(() => h.cleanup()); await created(h); const before = count(h, "create"); h.rerender(); h.rerender(); h.start();
  assert.equal(last(h, "status").body.intent_id, CREATED); assert.equal(count(h, "create"), before);
});
test("current approval rejection retains current failure and no followup status", async (t) => {
  const h = fixture({ initialIntent: INTENT_A }); t.after(() => h.cleanup()); await confirmReady(h); h.click("confirm"); await drain(); h.reject(last(h, "approve")); await drain();
  assert.equal(count(h, "status"), 1); assert.equal(h.callbacks.at(-1).category, "ENROLLMENT_EXPIRED"); assert.equal(h.ui().busy, false);
});
for (const loss of ["Site", "family", "initialIntent"]) {
  test(`retained begin, confirm and queued poll handlers after ${loss} cannot read token or call parent`, async (t) => {
    const h = fixture({ initialIntent: INTENT_A }); t.after(() => h.cleanup()); await confirmReady(h); const confirm = h.handler("confirm"), poll = h.peek(5000);
    h.scope(loss === "Site" ? { siteId: SITE_B } : loss === "family" ? { family: "synthetic-family" } : { initialIntent: INTENT_B });
    const before = h.snapshot(); confirm(); poll(); await drain(); assert.deepEqual(h.snapshot(), before);
    // The separate retained begin callback is also invoked from its own old
    // scope: no private function exposure or dead-wrapper bypass in fixture.
    const other = fixture(); t.after(() => other.cleanup()); const begin = other.handler("begin"); other.unmount(); const snap = other.snapshot(); begin(); await drain(); assert.deepEqual(other.snapshot(), snap);
  });
}
