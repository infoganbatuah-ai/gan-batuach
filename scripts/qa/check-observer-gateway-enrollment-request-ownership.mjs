// Closed-VM qualification of the actual component source. Root runs this; no network is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const root = process.argv[2] ?? process.cwd();
assert.ok(path.isAbsolute(root), "repository root must be absolute");
const source = path.join(root, "components/digital-observer/gateway-enrollment-panel.tsx");
assert.ok(fs.statSync(source).isFile());
if (process.platform === "darwin") {
  const flags = BigInt(execFileSync("/usr/bin/stat", ["-f", "%f", source], { encoding: "utf8" }).trim());
  assert.equal(flags & 0x40000000n, 0n, "source is SF_DATALESS; do not hydrate it for QA");
}
const ts = createRequire(path.join(root, "package.json"))("typescript");
const code = ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 }
}).outputText;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async () => { for (let step = 0; step < 8; step++) await Promise.resolve(); };

function harness() {
  const calls = [];
  const slots = [];
  let cursor = 0, effect, cleanup, lastDeps, current, props;
  const React = {
    useState(initial) {
      const n = cursor++;
      if (!(n in slots)) slots[n] = initial;
      return [slots[n], value => { slots[n] = value; }];
    },
    useRef(initial) {
      const n = cursor++;
      if (!(n in slots)) slots[n] = { current: initial };
      return slots[n];
    },
    useEffect(fn, deps) { effect = fn; if (!lastDeps || deps.some((x, i) => x !== lastDeps[i])) { cleanup?.(); cleanup = fn(); lastDeps = deps; } }
  };
  const jsx = (type, given) => ({ type, props: given ?? {} });
  const context = {
    exports: {},
    require(name) {
      if (name === "react") return React;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      throw Error(`unexpected import: ${name}`);
    },
    fetch(url, options) { const request = deferred(); calls.push({ url, options, request }); return request.promise; }
  };
  new vm.Script(code, { filename: source }).runInNewContext(context, { timeout: 1000 });
  function render(next) {
    props = next ?? props;
    cursor = 0;
    const wrapper = context.exports.GatewayEnrollmentPanel(props);
    current = wrapper.type(wrapper.props);
    return current;
  }
  function button() { return current.props.children[1]; }
  function text() { return current.props.children[0].props.children[1].props.children[1]; }
  function unmount() { cleanup?.(); cleanup = undefined; lastDeps = undefined; }
  return { render, button, text, unmount, calls, slots };
}
const A = { enrollmentId: "A", siteId: "site-1" };
const B = { enrollmentId: "B", siteId: "site-2" };
const reply = (status = "pending", ok = true) => ({ ok, json: async () => ({ data: { status, device_name: "QA", device_type: "SOFTWARE_CONNECTOR" } }) });

// A pending GET is required; a nonpending GET cannot offer approval.
{
  const h = harness(); h.render(A); assert.equal(h.button(), null);
  h.calls[0].request.resolve(reply("complete")); await tick(); h.render(); assert.equal(h.button(), null);
  h.unmount();
}
// The synchronous latch blocks two clicks even before React rerenders.
{
  const h = harness(); h.render(A); h.calls[0].request.resolve(reply()); await tick(); h.render();
  const click = h.button().props.onClick;
  click(); click(); assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].url, "/api/digital-observer/gateway-enrollment");
  assert.equal(h.calls[1].options.method, "POST");
  assert.equal(JSON.parse(h.calls[1].options.body).enrollment_request_id, "A");
  h.calls[1].request.resolve({ ok: true, json: async () => ({}) }); await tick(); h.render();
  assert.equal(h.button(), null); h.unmount();
}
// A stale POST must not update a later lifecycle or start a second POST.
{
  const h = harness(); h.render(A); h.calls[0].request.resolve(reply()); await tick(); h.render();
  const oldClick = h.button().props.onClick; oldClick(); h.unmount(); h.render(B);
  oldClick(); assert.equal(h.calls.length, 3);
  h.calls[1].request.resolve({ ok: true, json: async () => ({}) }); await tick(); h.render();
  assert.equal(h.button(), null);
  h.calls[2].request.resolve(reply()); await tick(); h.render(); assert.ok(h.button());
  h.unmount();
}
// A stale POST failure must not replace B's current pending status.
{
  const h = harness(); h.render(A); h.calls[0].request.resolve(reply()); await tick(); h.render();
  h.button().props.onClick(); h.unmount(); h.render(B);
  h.calls[2].request.resolve(reply()); await tick(); h.render();
  assert.ok(h.button()); assert.equal(h.text(), "ממתין לאישור שלך");
  h.calls[1].request.reject(new Error("old A failure")); await tick(); h.render();
  assert.ok(h.button()); assert.equal(h.text(), "ממתין לאישור שלך");
  h.unmount();
}
// A current GET failure cannot expose approval.
{
  const h = harness(); h.render(A);
  h.calls[0].request.resolve({ ok: false, json: async () => ({ error: "not found" }) });
  await tick(); h.render(); assert.equal(h.button(), null); assert.equal(h.text(), "not found");
  h.unmount();
}
// A stale GET cannot turn the next request into an approvable one.
{
  const h = harness(); h.render(A); h.unmount(); h.render(B);
  h.calls[0].request.resolve(reply()); await tick(); h.render(); assert.equal(h.button(), null);
  h.calls[1].request.resolve(reply()); await tick(); h.render(); assert.ok(h.button());
  h.unmount();
}
// A failed current POST may be deliberately retried, but never concurrently.
{
  const h = harness(); h.render(A); h.calls[0].request.resolve(reply()); await tick(); h.render();
  h.button().props.onClick();
  h.calls[1].request.resolve({ ok: false, json: async () => ({ error: "rejected" }) });
  await tick(); h.render(); assert.ok(h.button()); assert.equal(h.text(), "rejected");
  h.button().props.onClick(); assert.equal(h.calls.length, 3); h.unmount();
}
console.log("gateway enrollment ownership: closed-VM assertions passed");
