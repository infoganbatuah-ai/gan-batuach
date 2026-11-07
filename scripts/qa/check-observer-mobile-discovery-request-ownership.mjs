import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual rendered component handlers; no copied discovery implementation and
// no source rewriting. All imported IO/native/React behavior is closed below.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "components/digital-observer/universal-camera-onboarding.tsx");
assert.ok(statSync(file).isFile(), "source must be regular");
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "refuse dataless source without hydration");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: "universal-camera-onboarding.tsx", reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
const errors = (compiled.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((d) => `TS${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "universal-camera-onboarding.js" });
const plain = (value) => JSON.parse(JSON.stringify(value));
function deferred() {
  let resolvePromise, reject;
  const promise = new Promise((resolveValue, rejectValue) => { resolvePromise = resolveValue; reject = rejectValue; });
  return { promise, resolve: resolvePromise, reject };
}
async function drain() { for (let i = 0; i < 96; i++) await Promise.resolve(); }
const plan = (reason) => ({ reason, nextAction: "IDENTIFY", preferredStrategy: "NONE", version: "synthetic", registryVersion: "synthetic" });
const jsx = (type, props) => ({ type, props: props ?? {} });
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

function mount({ pauseAt = null, rejectAt = null, missingBridge = false, startOk = true, submitOk = true } = {}) {
  const slots = [], effects = [], gates = new Map(), counts = {}, reads = {};
  const requests = [], bridgeCalls = [], writes = [];
  let cursor = 0, tree, unmounted = false, tokens = 0, uuid = 0;
  if (pauseAt) gates.set(pauseAt, deferred());
  const step = (prefix, value) => {
    const label = `${prefix}.${counts[prefix] = (counts[prefix] ?? 0) + 1}`;
    if (label === rejectAt) return Promise.reject(Error(`SYNTHETIC:${label}`));
    const gate = gates.get(label);
    return gate ? gate.promise.then(() => value) : Promise.resolve(value);
  };
  const packet = (label, fields) => new Proxy(fields, {
    get(target, key) {
      if (key === "then") return undefined;
      const name = `${label}.${String(key)}`;
      reads[name] = (reads[name] ?? 0) + 1;
      return Reflect.get(target, key);
    }
  });
  const sameDeps = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const React = {
    useState: (initial) => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { kind: "state", value: typeof initial === "function" ? initial() : initial };
      assert.equal(slots[index].kind, "state");
      return [slots[index].value, (value) => {
        writes.push({ index, afterUnmount: unmounted });
        slots[index].value = typeof value === "function" ? value(slots[index].value) : value;
      }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!slots[index]) slots[index] = { kind: "ref", value: { current: initial } };
      assert.equal(slots[index].kind, "ref"); return slots[index].value;
    },
    useCallback: (fn, deps) => {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) slots[index] = { kind: "callback", value: fn, deps };
      assert.equal(slots[index].kind, "callback"); return slots[index].value;
    },
    useEffect: (fn, deps) => {
      const index = cursor++;
      if (!slots[index] || !sameDeps(slots[index].deps, deps)) {
        const old = slots[index];
        slots[index] = { kind: "effect", deps, cleanup: old?.cleanup };
        effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = fn(); });
      }
      assert.equal(slots[index].kind, "effect");
    }
  };
  const bridge = { discoverLocalCameras: (input) => {
    bridgeCalls.push(plain(input)); const n = bridgeCalls.length;
    return step("bridge", packet(`receipt.${n}`, { synthetic: true, installation: `installation-${n}` }));
  } };
  const modules = new Map([
    ["react", React],
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["lucide-react", { Camera: "Camera", LoaderCircle: "LoaderCircle" }],
    ["@/lib/domain/digital-observer/client-session", { readObserverAccessToken: () => { tokens++; return "SYNTHETIC_TOKEN"; } }],
    ["@/lib/domain/digital-observer/connectivity-registry", { connectivityRegistry: [
      { id: "unknown", label: "UNKNOWN" }, { id: "synthetic-family", label: "SYNTHETIC" }, { id: "generic-onvif", label: "ONVIF" }
    ] }],
    ["./software-connector-onboarding", { SoftwareConnectorOnboarding: "SoftwareConnectorOnboarding" }],
    ["./connector-install-handoff", { ConnectorInstallHandoff: "ConnectorInstallHandoff" }]
  ]);
  const exports = {};
  script.runInNewContext({
    exports, require: (name) => { assert.ok(modules.has(name), `unapproved import:${name}`); return modules.get(name); },
    window: missingBridge ? {} : { DigitalObserverCameraDiscovery: bridge },
    crypto: { randomUUID: () => `SYNTHETIC_UUID_${++uuid}` },
    fetch: (url, options) => {
      assert.equal(options.method, "POST"); assert.equal(options.credentials, "same-origin"); assert.equal(options.cache, "no-store");
      assert.equal(options.headers["content-type"], "application/json"); assert.equal(options.headers.authorization, "Bearer SYNTHETIC_TOKEN");
      const body = JSON.parse(options.body); requests.push({ url, body });
      if (url === "/api/digital-observer/connection-assessment") {
        if (body.action === "record_failure") return Promise.resolve({ ok: true });
        assert.equal(body.action, "plan");
        const n = (counts["assess.fetch"] ?? 0) + 1;
        return step("assess.fetch", { ok: true, json: async () => ({ data: { plan: plan(`ASSESS_${n}`), diagnostic_id: `assess-${n}`, connector_online: false, installer_delivery: "PLATFORM_CHECK_REQUIRED" } }) });
      }
      assert.equal(url, "/api/digital-observer/mobile-camera-setup"); assert.ok(["start", "submit"].includes(body.action));
      const prefix = body.action, n = (counts[`${prefix}.fetch`] ?? 0) + 1;
      const data = prefix === "start" ? { session_id: `session-${n}` } : { plan: plan(`DISCOVERY_${n}`) };
      const payload = packet(`${prefix}.payload.${n}`, { data: packet(`${prefix}.data.${n}`, data) });
      return step(`${prefix}.fetch`, packet(`${prefix}.response.${n}`, {
        ok: prefix === "start" ? startOk : submitOk,
        json: () => step(`${prefix}.body`, payload)
      }));
    }
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  const props = { sites: [{ id: "site-a", name: "A" }, { id: "site-b", name: "B" }] };
  const render = () => {
    assert.equal(unmounted, false, "render after unmount"); cursor = 0;
    tree = exports.UniversalCameraOnboarding(props);
    while (effects.length) effects.shift()();
    return tree;
  };
  render();
  const button = (kind) => {
    render();
    const selected = nodes(tree, (node) => node.type === "button" && (kind === "mobile"
      ? text(node).includes("חיפוש זמני ברשת הביתית") : node.props.className === "do-button primary"));
    assert.equal(selected.length, 1); return selected[0];
  };
  const unmount = () => {
    if (unmounted) return; unmounted = true;
    for (const slot of slots) if (slot?.kind === "effect") slot.cleanup?.();
  };
  return {
    counts, reads, requests, bridgeCalls, writes,
    render, unmount,
    // Invoking an already-rendered callback also models a queued native/UI
    // action; it is not a claim that a disabled DOM button is user-clickable.
    mobile: () => button("mobile").props.onClick(),
    assess: () => button("assess").props.onClick(),
    select: (kind, value) => {
      render(); const selectors = nodes(tree, (node) => node.type === "select");
      assert.equal(selectors.length, 2);
      selectors[kind === "site" ? 0 : 1].props.onChange({ target: { value } }); render();
    },
    pause: (label) => { assert.equal(gates.has(label), false); const gate = deferred(); gates.set(label, gate); return gate; },
    release: (label, reject = false) => { assert.ok(gates.has(label)); const gate = gates.get(label); if (reject) gate.reject(Error("SYNTHETIC_LATE_REJECTION")); else gate.resolve(); },
    snapshot: () => plain({ reads, requests, bridgeCalls, writes, tokens, uuid }),
    ui: () => { render(); return {
      diagnostic: text(nodes(tree, (node) => node.type === "bdi")[0]),
      alert: text(nodes(tree, (node) => node.props?.role === "alert")[0]),
      message: text(nodes(tree, (node) => node.type === "p" && node.props.className === "do-help-copy")[0]),
      busy: nodes(tree, (node) => node.type === "button" && node.props.className === "do-button primary")[0].props.disabled
    }; },
    cleanup: async () => { unmount(); for (const gate of gates.values()) gate.resolve(); await drain(); }
  };
}

const boundaries = ["start.fetch.1", "start.body.1", "bridge.1", "submit.fetch.1", "submit.body.1"];
const invalidations = ["site", "family", "assess", "new-discovery", "unmount"];
for (const boundary of boundaries) for (const invalidation of invalidations) for (const settlement of ["resolve", "reject"]) {
  test(`${boundary} late ${settlement} after ${invalidation} is quiet`, async (t) => {
    const h = mount({ pauseAt: boundary }); t.after(() => h.cleanup());
    h.mobile(); await drain();
    assert.equal(h.counts[boundary.slice(0, boundary.lastIndexOf("."))], 1, "must reach deferred boundary");
    let nextGate;
    if (invalidation === "site") h.select("site", "site-b");
    else if (invalidation === "family") h.select("family", "synthetic-family");
    else if (invalidation === "assess") { nextGate = h.pause("assess.fetch.1"); h.assess(); }
    else if (invalidation === "new-discovery") { nextGate = h.pause("start.fetch.2"); h.mobile(); }
    else h.unmount();
    await drain();
    const before = h.snapshot();
    const beforeUI = invalidation === "unmount" ? null : h.ui();
    h.release(boundary, settlement === "reject"); await drain();
    assert.deepEqual(h.snapshot(), before, "old completion must not read late fields, invoke bridge/submit/telemetry or write UI/busy");
    if (beforeUI) assert.deepEqual(h.ui(), beforeUI);
    if (nextGate) {
      assert.equal(h.ui().busy, true, "old finally must not release newer busy state");
      nextGate.resolve(); await drain();
      assert.equal(h.ui().busy, false); assert.equal(h.ui().alert, "");
      assert.equal(h.ui().diagnostic, invalidation === "assess" ? "assess-1" : "session-2");
    }
    assert.equal(h.requests.filter((request) => request.body.action === "record_failure").length, 0);
  });
}

test("healthy discovery preserves selected Site, session, receipt, plan and effort", async (t) => {
  const h = mount(); t.after(() => h.cleanup());
  h.select("site", "site-b"); h.select("family", "synthetic-family"); h.mobile(); await drain();
  assert.deepEqual(h.bridgeCalls, [{ sessionId: "session-1", siteId: "site-b" }]);
  assert.deepEqual(h.requests.map((r) => r.body), [
    { action: "start", observer_site_id: "site-b" },
    { action: "submit", observer_site_id: "site-b", session_id: "session-1", receipt: { synthetic: true, installation: "installation-1" } }
  ]);
  assert.deepEqual(h.ui(), { diagnostic: "session-1", alert: "", message: "", busy: false });
  h.assess(); await drain();
  const body = h.requests.at(-1).body;
  assert.equal(body.action, "plan"); assert.equal(body.observer_site_id, "site-b"); assert.equal(body.family, "synthetic-family");
  assert.equal(body.computer_available, "UNKNOWN"); assert.equal(body.effort.product_actions, 4);
  assert.equal(body.effort.technical_actions, 0); assert.ok(body.effort.elapsed_ms >= 0);
});
test("current missing bridge keeps fallback message and never submits", async (t) => {
  const h = mount({ missingBridge: true }); t.after(() => h.cleanup()); h.mobile(); await drain();
  assert.match(h.ui().message, /איתור מקומי בטלפון עדיין אינו זמין/);
  assert.equal(h.ui().busy, false); assert.equal(h.ui().alert, "");
  assert.equal(h.requests.length, 1); assert.equal(h.bridgeCalls.length, 0);
});
for (const boundary of boundaries) {
  test(`current rejection at ${boundary} retains failure telemetry and clears busy`, async (t) => {
    const h = mount({ rejectAt: boundary }); t.after(() => h.cleanup()); h.mobile(); await drain();
    assert.match(h.ui().alert, /לא ניתן להשלים חיפוש מקומי/); assert.equal(h.ui().busy, false);
    const failures = h.requests.filter((request) => request.body.action === "record_failure");
    assert.equal(failures.length, 1); assert.equal(failures[0].body.failure, "LOCAL_PERMISSION_DENIED");
    assert.equal(failures[0].body.observer_site_id, "site-a"); assert.equal(failures[0].body.family, "unknown");
    assert.equal(failures[0].body.effort.product_actions, 1);
  });
}
for (const rejectedResponse of ["start", "submit"]) {
  test(`current non-OK ${rejectedResponse} preserves existing error behavior`, async (t) => {
    const h = mount({ startOk: rejectedResponse !== "start", submitOk: rejectedResponse !== "submit" }); t.after(() => h.cleanup());
    h.mobile(); await drain(); assert.match(h.ui().alert, /לא ניתן להשלים חיפוש מקומי/);
    assert.equal(h.ui().busy, false); assert.equal(h.ui().diagnostic, "");
    assert.equal(h.requests.filter((r) => r.body.action === "record_failure").length, 1);
    if (rejectedResponse === "start") assert.equal(h.bridgeCalls.length, 0);
  });
}
for (const next of ["selector", "assessment"]) {
  test(`new ${next} clears discovery-scoped fallback message`, async (t) => {
    const h = mount({ missingBridge: true }); t.after(() => h.cleanup()); h.mobile(); await drain(); assert.ok(h.ui().message);
    if (next === "selector") h.select("family", "synthetic-family"); else { h.assess(); await drain(); }
    assert.equal(h.ui().message, ""); assert.equal(h.ui().alert, ""); assert.equal(h.ui().busy, false);
  });
}
test("selector reset preserves existing assessment generation ownership", async (t) => {
  const h = mount(); t.after(() => h.cleanup()); const gate = h.pause("assess.fetch.1"); h.assess(); await drain();
  h.select("site", "site-b"); h.assess(); await drain(); assert.equal(h.ui().diagnostic, "assess-2");
  gate.resolve(); await drain(); assert.equal(h.ui().diagnostic, "assess-2"); assert.equal(h.ui().busy, false);
  assert.deepEqual(h.requests.filter((r) => r.body.action === "plan").map((r) => r.body.observer_site_id), ["site-a", "site-b"]);
});
