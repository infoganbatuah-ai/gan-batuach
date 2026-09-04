import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { runGuardDiagnostic, expireGuardDiagnostic, diagnosticWait } = loadTs("lib/domain/digital-observer/guard-diagnostics-client.ts");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = Date.now();
const input = { observer_site_id: id(1), camera_source_id: id(2), request_id: id(3), task_kind: "capability_snapshot" };
const queued = { request_id: id(3), camera_source_id: id(2), task_kind: "capability_snapshot", state: "queued",
  expires_at: new Date(now + 119_000).toISOString(), audit_recorded: true, executed: false, executor_installed: false, requires_immediate_confirmation: true };
const completed = { ...queued, state: "completed", evidence_id: id(5), verified_at: new Date(now).toISOString(),
  capabilities: { ptz: true, twoWayAudio: false, siren: false, lighting: true } };
function fixture(sequence, extra = {}) {
  let time = now;
  const calls = [], updates = [], abort = new AbortController();
  return { calls, updates, abort, run: (request = input) => runGuardDiagnostic(request, {
    signal: abort.signal, now: () => time, token: "synthetic-token", onUpdate: view => updates.push(view),
    wait: async milliseconds => { time += milliseconds; },
    fetcher: async (path, options) => {
      calls.push({ path, options });
      const item = sequence[Math.min(calls.length - 1, sequence.length - 1)];
      if (item instanceof Error) throw item;
      return item instanceof Response ? item : Response.json({ data: { diagnostic: item } });
    }, ...extra
  }) };
}

test("client creates one intent, then polls scoped same-origin status without physical commands", async () => {
  const f = fixture([queued, { ...queued, state: "running" }, completed]);
  assert.equal((await f.run()).state, "completed");
  assert.deepEqual(f.calls.map(call => call.options.method), ["POST", "GET", "GET"]);
  assert.deepEqual(JSON.parse(f.calls[0].options.body), input);
  for (const { path, options } of f.calls) {
    assert.ok(path.startsWith("/api/digital-observer/camera-diagnostics"));
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, "Bearer synthetic-token");
    assert.ok(options.signal instanceof AbortSignal);
    if (options.method === "GET") {
      const url = new URL(path, "https://fixture.invalid");
      assert.deepEqual(Object.fromEntries(url.searchParams), { observer_site_id: id(1), camera_source_id: id(2), request_id: id(3) });
      assert.equal(options.body, undefined);
    }
  }
});

test("lost POST response does not automatically create or resend an intent", async () => {
  const f = fixture([Error("lost response")]);
  await assert.rejects(f.run());
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.updates, []);
});

test("login/permission/storage failures never appear as successful diagnostics", async () => {
  for (const status of [401, 403, 404, 503]) {
    const f = fixture([Response.json({ error: "PRIVATE_PROVIDER_TEXT" }, { status })]);
    await assert.rejects(f.run(), error => !error.message.includes("PRIVATE_PROVIDER_TEXT"));
    assert.deepEqual(f.updates, []);
    assert.equal(f.calls.length, 1);
  }
});

test("wrong source/request/kind, physical ACK, absent audit and malformed capabilities fail closed", async () => {
  for (const patch of [{ camera_source_id: id(9) }, { request_id: id(9) }, { task_kind: "command_preflight" },
    { executed: true }, { executor_installed: true }, { audit_recorded: false }, { requires_immediate_confirmation: false },
    { capabilities: { ...completed.capabilities, ptz: "true" } }, { secret: "unexpected" },
    { evidence_id: undefined }, { verified_at: null }, { verified_at: new Date(now + 10_000).toISOString() }]) {
    const f = fixture([{ ...completed, ...patch }]);
    await assert.rejects(f.run());
    assert.deepEqual(f.updates, []);
  }
});

test("unverified queued responses cannot smuggle capability evidence", async () => {
  await assert.rejects(fixture([{ ...queued, capabilities: completed.capabilities }]).run());
});

test("poll responses cannot renew the server's original deadline", async () => {
  const f = fixture([queued, { ...completed, expires_at: new Date(now + 121_000).toISOString() }]);
  await assert.rejects(f.run(), /RESPONSE_INVALID/);
  assert.equal(f.updates.length, 1);
});

test("stalled Gateway expires at the deadline without creating another request", async () => {
  const f = fixture([queued]);
  const result = await f.run();
  assert.equal(result.state, "expired");
  assert.equal(result.capabilities, undefined);
  assert.ok(f.calls.length <= 60);
  assert.equal(f.calls.filter(call => call.options.method === "POST").length, 1);
});

test("expired completed evidence is stripped before rendering", () => {
  const expired = expireGuardDiagnostic(completed, now + 120_000);
  assert.equal(expired.state, "expired");
  for (const key of ["capabilities", "action", "supported", "evidence_id", "verified_at"]) assert.equal(key in expired, false);
});

test("preflight validates the requested action and never implies physical execution", async () => {
  const request = { ...input, task_kind: "command_preflight", action: "lighting", payload: { enabled: true } };
  const view = { ...queued, task_kind: "command_preflight", state: "completed", evidence_id: id(5), verified_at: new Date(now).toISOString(), action: "lighting", supported: true };
  assert.equal((await fixture([view]).run(request)).executed, false);
  await assert.rejects(fixture([{ ...view, action: "siren" }]).run(request));
});

test("cancellation before sending and while waiting leaves no background polling", async () => {
  const f = fixture([queued]);
  f.abort.abort();
  await assert.rejects(f.run());
  assert.deepEqual(f.calls, []);
  const abort = new AbortController();
  const waiting = diagnosticWait(30_000, abort.signal);
  abort.abort();
  await assert.rejects(waiting);
});

function panel(run) {
  const states = [], refs = [], effects = [], requests = [];
  let si = 0, ri = 0;
  const component = loadTs("components/digital-observer/guard-diagnostics-panel.tsx", {
    react: {
      useState(initial) { const i = si++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; },
      useRef(initial) { const i = ri++; refs[i] ??= { current: initial }; return refs[i]; },
      useEffect(effect) { effects.push(effect); }
    },
    "@/lib/domain/digital-observer/client-session": { readObserverAccessToken: () => "synthetic-token" },
    "@/lib/domain/digital-observer/guard-diagnostics-client": {
      expireGuardDiagnostic,
      async runGuardDiagnostic(input, options) { requests.push(input); return run(input, options); }
    }
  }).GuardDiagnosticsPanel;
  const render = () => { si = ri = 0; return component({ observerSiteId: id(1), cameraSourceId: id(2) }); };
  const buttons = node => !node || typeof node !== "object" ? [] : [ ...(node.type === "button" ? [node] : []), ...[node.props?.children].flat(Infinity).flatMap(buttons) ];
  return { states, refs, effects, requests, render, button: () => buttons(render())[0] };
}

test("panel never sends diagnostics on render or mount", () => {
  const p = panel(() => { throw Error("Unexpected request"); });
  p.render();
  for (const effect of p.effects) effect();
  assert.deepEqual(p.requests, []);
});

test("panel double-click is single-flight and uncertain retry keeps the same request ID", async () => {
  const p = panel(async () => { throw Error("PRIVATE_PROVIDER_TEXT"); });
  const button = p.button();
  await Promise.all([button.props.onClick(), button.props.onClick()]);
  assert.equal(p.requests.length, 1);
  assert.doesNotMatch(p.states[2], /PRIVATE_PROVIDER_TEXT/);
  await p.button().props.onClick();
  assert.equal(p.requests.length, 2);
  assert.equal(p.requests[0].request_id, p.requests[1].request_id);
  assert.equal(p.requests[0].confirmed, undefined);
});

test("panel new terminal check gets a new ID and unmount aborts pending work", async () => {
  const p = panel(async (_input, options) => { options.onUpdate(completed); return completed; });
  await p.button().props.onClick();
  await p.button().props.onClick();
  assert.notEqual(p.requests[0].request_id, p.requests[1].request_id);
  const abort = new AbortController();
  p.refs[0].current = abort;
  p.effects[0]()();
  assert.equal(abort.signal.aborted, true);
});
