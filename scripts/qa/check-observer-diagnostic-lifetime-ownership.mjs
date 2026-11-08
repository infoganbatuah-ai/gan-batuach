import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const zod = require('zod');
function compiled(relative) {
  const path = resolve(root, relative); assert.ok(statSync(path).isFile());
  if (process.platform === 'darwin') {
    const decimal = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim(); assert.match(decimal, /^\d+$/);
    const flags = Number(decimal); assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, 'refuse dataless source');
  }
  return ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
}
const clientCode = compiled('lib/domain/digital-observer/guard-diagnostics-client.ts');
const panelCode = compiled('components/digital-observer/guard-diagnostics-panel.tsx');
const BASE = Date.parse('2026-01-01T00:00:00Z');
const ID = { site: '10000000-0000-4000-8000-000000000001', camera: '10000000-0000-4000-8000-000000000002',
  request: '10000000-0000-4000-8000-000000000003', evidence: '10000000-0000-4000-8000-000000000004', other: '10000000-0000-4000-8000-000000000005' };
const input = () => ({ observer_site_id: ID.site, camera_source_id: ID.camera, request_id: ID.request, task_kind: 'capability_snapshot' });
const iso = milliseconds => new Date(milliseconds).toISOString();
const copy = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await Promise.resolve(); } assert.fail('synthetic async boundary was not reached'); }
function diagnostic(request, state = 'completed', expires = BASE + 120000) {
  const view = { request_id: request.request_id, camera_source_id: request.camera_source_id, task_kind: request.task_kind, state,
    expires_at: iso(expires), audit_recorded: true, executed: false, executor_installed: false, requires_immediate_confirmation: true };
  if (state === 'completed') Object.assign(view, { evidence_id: ID.evidence, verified_at: iso(BASE) }, request.task_kind === 'capability_snapshot'
    ? { capabilities: { ptz: true, twoWayAudio: false, siren: false, lighting: false } } : { action: request.action, supported: true });
  return view;
}
function loadClient(globalFetch, timeouts = []) {
  const exports = {};
  const context = vm.createContext({ exports, Error, URLSearchParams, Date,
    require(name) { assert.equal(name, 'zod', 'only actual installed zod permitted'); return zod; },
    fetch: globalFetch || (() => { throw Error('NONUSABLE-NETWORK-FORBIDDEN'); }),
    AbortSignal: { any(signals) { return signals[0]; }, timeout(ms) { timeouts.push(ms); return new AbortController().signal; } },
    setTimeout() { throw Error('NONUSABLE-REAL-WAIT-FORBIDDEN'); }, clearTimeout() {} });
  new vm.Script(clientCode, { filename: 'guard-diagnostics-client.ts' }).runInContext(context, { timeout: 1000 });
  return exports;
}
function clientHarness(config = {}) {
  let clock = BASE;
  const controller = new AbortController();
  const log = { requests: [], updates: [], waits: [], timeouts: [], now: 0, reads: [] };
  const request = config.input || input();
  function poison(label) { return new Proxy({}, { get(_, key) { if (key === 'then') return undefined; log.reads.push(label + ':' + String(key)); throw Error('NONUSABLE-POISON'); } }); }
  const fetcher = (url, init) => {
    const index = log.requests.length; log.requests.push({ url, init });
    if (config.fetcher) return config.fetcher(index, url, init);
    const state = config.states?.[index] || config.states?.at(-1) || 'completed';
    const view = diagnostic(request, state, config.expires || BASE + 120000);
    return Promise.resolve({ ok: true, json: async () => ({ data: { diagnostic: view } }) });
  };
  const client = loadClient(fetcher, log.timeouts);
  const now = () => { log.now++; config.onNow?.(log.now, controller); return clock; };
  const wait = async (ms, signal) => { log.waits.push(ms); if (!config.frozen) clock += ms; await config.onWait?.(controller, signal); };
  function run(extra = {}) { return client.runGuardDiagnostic(request, { signal: controller.signal, token: 'NONUSABLE-AUTH', fetcher, now, wait,
    onUpdate(view) { log.updates.push(copy(view)); config.onUpdate?.(log.updates.length, controller, view); }, ...extra }); }
  return { client, request, controller, log, now, wait, run, poison, get clock() { return clock; } };
}

function panelHarness() {
  let props = { observerSiteId: ID.site, cameraSourceId: ID.camera }, clock = BASE, nextTimer = 1;
  let slots = [], effects = new Map(), cursor = 0, mounted = false, key, tree;
  const tasks = new Map(), retired = new Map();
  const log = { runs: [], writes: 0, uuid: 0, token: 0, aborts: 0, controllers: [], events: [], expire: 0, reads: [] };
  const actual = loadClient();
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], next => { log.writes++; cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useLayoutEffect(setup, deps) { const i = cursor++; const old = effects.get(i);
      if (!old || deps.length !== old.deps.length || deps.some((v, at) => !Object.is(v, old.deps[at]))) effects.set(i, { setup, deps, cleanup: old?.cleanup, pending: true }); }
  };
  class Controller extends AbortController { constructor() { super(); log.controllers.push(this); } abort(reason) { log.aborts++; super.abort(reason); } }
  class SyntheticDate extends Date { static now() { return clock; } toLocaleTimeString() { return 'NONUSABLE-TIME'; } }
  class SyntheticEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  const neutral = () => null;
  const allowed = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, 'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-AUTH'; } },
    '@/lib/domain/digital-observer/guard-diagnostics-client': {
      expireGuardDiagnostic(view, now) { log.expire++; return actual.expireGuardDiagnostic(view, now); },
      runGuardDiagnostic(request, options) { const pending = deferred(); log.runs.push({ request: copy(request), options, pending }); return pending.promise; }
    } };
  const exports = {};
  const context = vm.createContext({ exports, Error, Date: SyntheticDate, AbortController: Controller, CustomEvent: SyntheticEvent,
    crypto: { randomUUID() { log.uuid++; return '20000000-0000-4000-8000-' + log.uuid.toString(16).padStart(12, '0'); } },
    require(name) { assert.ok(Object.hasOwn(allowed, name), 'unapproved panel import ' + name); return allowed[name]; },
    window: { setTimeout(fn, delay) { const id = nextTimer++; const record = { fn, delay, due: clock + delay }; tasks.set(id, record); retired.set(id, record); return id; },
      clearTimeout(id) { tasks.delete(id); }, dispatchEvent(event) { log.events.push(copy(event)); } }
  });
  new vm.Script(panelCode, { filename: 'guard-diagnostics-panel.tsx' }).runInContext(context, { timeout: 1000 });
  function visit(predicate, node, result) { if (Array.isArray(node)) { for (const child of node) visit(predicate, child, result); return; }
    if (!node || typeof node !== 'object') return; if (predicate(node)) result.push(node); visit(predicate, node.props?.children, result); }
  function nodes(predicate) { const result = []; visit(predicate, tree, result); return result; }
  function textOf(node) { if (Array.isArray(node)) return node.map(textOf).join(' '); if (typeof node === 'string') return node; return node && typeof node === 'object' ? textOf(node.props?.children) : ''; }
  function unmount() { for (const effect of effects.values()) effect.cleanup?.(); mounted = false; }
  function render(next = props) { props = next; const wrapper = exports.GuardDiagnosticsPanel(props); assert.equal(typeof wrapper.type, 'function');
    assert.equal(wrapper.key, JSON.stringify([props.observerSiteId, props.cameraSourceId])); if (mounted && wrapper.key !== key) unmount();
    if (!mounted) { mounted = true; key = wrapper.key; slots = []; effects = new Map(); }
    cursor = 0; tree = wrapper.type(wrapper.props); for (const effect of effects.values()) if (effect.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.setup(); } }
  function restart() { for (const effect of effects.values()) { effect.cleanup?.(); effect.cleanup = effect.setup(); } render(); }
  function buttons() { return nodes(n => n.type === 'button'); }
  function start(kind = 'capability_snapshot', handler = buttons()[kind === 'capability_snapshot' ? 0 : 1].props.onClick) { const pending = handler(); render(); return pending; }
  function change(value) { nodes(n => n.type === 'select')[0].props.onChange({ target: { value } }); render(); }
  function update(index, view) { log.runs[index].options.onUpdate(view); render(); }
  async function finish(index, state = 'completed', publish = true) { const view = diagnostic(log.runs[index].request, state); if (publish) update(index, view); log.runs[index].pending.resolve(view); await tick(); render(); return view; }
  async function fail(index, message = 'NONUSABLE-UNKNOWN') { log.runs[index].pending.reject(new Error(message)); await tick(); render(); }
  function poison(label) { return new Proxy({}, { get(_, prop) { if (prop === 'then') return undefined; log.reads.push(label + ':' + String(prop)); throw Error('NONUSABLE-POISON'); } }); }
  function snapshot() { return copy({ runs: log.runs.length, writes: log.writes, uuid: log.uuid, token: log.token, events: log.events, expire: log.expire, reads: log.reads, aborts: log.aborts }); }
  function fire(id) { const task = retired.get(id); assert.ok(task); tasks.delete(id); task.fn(); if (mounted) render(); }
  render();
  return { log, tasks, nodes, buttons, render, unmount, restart, start, change, update, finish, fail, poison, snapshot, fire,
    text() { return textOf(tree); }, advance(ms) { clock += ms; }, get props() { return props; } };
}

for (const kind of ['capability_snapshot', 'command_preflight']) test('panel exact current payload/event and synchronous duplicate ' + kind, async () => {
  const h = panelHarness(); const handler = h.buttons()[kind === 'capability_snapshot' ? 0 : 1].props.onClick; const pending = handler(); handler(); h.render();
  assert.equal(h.log.runs.length, 1); assert.equal(h.log.uuid, 1); assert.equal(h.log.token, 1);
  const expected = { observer_site_id: ID.site, camera_source_id: ID.camera, task_kind: kind, request_id: '20000000-0000-4000-8000-000000000001' };
  if (kind === 'command_preflight') Object.assign(expected, { action: 'ptz', payload: { direction: 'left', duration_ms: 500 } });
  assert.deepEqual(h.log.runs[0].request, expected); await h.finish(0); await pending;
  assert.deepEqual(h.log.events, [{ type: 'observer-camera-capabilities-updated', detail: { cameraSourceId: ID.camera } }]);
  assert.match(h.text(), /שליטה פיזית חסומה/); assert.equal(h.buttons()[0].props.disabled, false); h.unmount();
});

for (const kind of ['capability_snapshot', 'command_preflight']) for (const loss of ['unmount', 'site', 'camera', 'reconnect']) for (const settlement of ['resolve', 'reject']) test('panel stale callbacks ' + [kind, loss, settlement].join('/'), async () => {
  const h = panelHarness(); const retained = h.buttons()[kind === 'capability_snapshot' ? 0 : 1].props.onClick; const old = h.start(kind);
  if (loss === 'unmount') h.unmount(); else if (loss === 'reconnect') h.restart(); else h.render({ ...h.props, ...(loss === 'site' ? { observerSiteId: ID.other } : { cameraSourceId: ID.other }) });
  let next; if (loss === 'reconnect') { assert.equal(h.buttons()[0].props.disabled, false); next = h.start(kind); assert.equal(h.log.uuid, 1); }
  const before = h.snapshot(); if (loss !== 'reconnect') retained(); h.log.runs[0].options.onUpdate(h.poison('old-update'));
  if (settlement === 'resolve') h.log.runs[0].pending.resolve(h.poison('old-result')); else h.log.runs[0].pending.reject(h.poison('old-error'));
  await old; await tick(); assert.deepEqual(h.snapshot(), before);
  if (next) { h.start(kind); assert.equal(h.log.runs.length, 2); assert.equal(h.buttons()[0].props.disabled, true); await h.finish(1); await next; }
  h.unmount();
});

for (const state of ['queued', 'running', 'completed', 'failed', 'expired', 'blocked', 'cancelled']) test('panel terminal-only intent retirement ' + state, async () => {
  const h = panelHarness(); h.start(); const first = h.log.runs[0].request.request_id; await h.finish(0, state); h.start();
  assert.equal(h.log.runs[1].request.request_id === first, state === 'queued' || state === 'running');
  assert.equal(h.log.events.length, state === 'completed' ? 1 : 0); await h.fail(1); h.unmount();
});

test('panel unknown response retains one-slot signature across action away/back before another body', async () => {
  const h = panelHarness(); const retained = h.buttons()[1].props.onClick; h.start('command_preflight'); const first = h.log.runs[0].request.request_id; await h.fail(0);
  h.change('siren'); h.change('ptz'); const before = h.snapshot(); retained(); assert.deepEqual(h.snapshot(), before); h.start('command_preflight'); assert.equal(h.log.runs[1].request.request_id, first); await h.fail(1);
  h.change('siren'); h.start('command_preflight'); assert.notEqual(h.log.runs[2].request.request_id, first); assert.deepEqual(h.log.runs[2].request.payload, { duration_ms: 3000 }); await h.fail(2);
  h.change('ptz'); h.start('command_preflight'); assert.notEqual(h.log.runs[3].request.request_id, first); await h.fail(3); h.unmount();
});

test('panel snapshot signature excludes action, while bounded action payloads remain exact', async () => {
  const h = panelHarness(); h.start(); const id = h.log.runs[0].request.request_id; await h.fail(0); h.change('lighting'); h.start(); assert.equal(h.log.runs[1].request.request_id, id); await h.fail(1);
  h.start('command_preflight'); assert.deepEqual(h.log.runs[2].request.payload, { enabled: true }); await h.fail(2);
  h.change('talk'); h.start('command_preflight'); assert.deepEqual(h.log.runs[3].request.payload, { text: 'בדיקת תאימות בלבד' }); await h.fail(3); h.unmount();
});

for (const [error, label] of [['DIAGNOSTIC_LOGIN_REQUIRED', 'נדרשת התחברות מחדש.'], ['DIAGNOSTIC_FORBIDDEN', 'Standard מורשה בלבד'], ['NONUSABLE-UNKNOWN', 'אפשר לנסות שוב עם אותה בקשה']]) test('panel current error/retry ' + error, async () => {
  const h = panelHarness(); h.start(); const id = h.log.runs[0].request.request_id; await h.fail(0, error); assert.ok(h.text().includes(label));
  h.start(); assert.equal(h.log.runs[1].request.request_id, id); await h.finish(1); h.unmount();
});

test('panel action change is blocked while busy and clears obsolete view without using retained controls', async () => {
  const h = panelHarness(); const oldButton = h.buttons()[1].props.onClick, oldSelect = h.nodes(n => n.type === 'select')[0].props.onChange;
  h.start('command_preflight'); h.change('lighting'); assert.equal(h.nodes(n => n.type === 'select')[0].props.value, 'ptz'); await h.finish(0);
  h.change('lighting'); const before = h.snapshot(); oldButton(); oldSelect(h.poison('old-select-event')); assert.deepEqual(h.snapshot(), before);
  assert.doesNotMatch(h.text(), /המתאם דיווח על תאימות/); assert.equal(h.tasks.size, 0); h.unmount();
});

test('panel same-scope rerender preserves current action/request and expiry timer owns exact view', async () => {
  const h = panelHarness(); h.change('lighting'); h.start(); h.render({ ...h.props }); h.advance(500); const view = await h.finish(0);
  assert.equal(h.nodes(n => n.type === 'select')[0].props.value, 'lighting'); const [id, task] = [...h.tasks][0]; assert.equal(task.delay, 119500);
  h.log.runs[0].options.onUpdate(view); h.render(); assert.equal(h.tasks.size, 1, 'late callback after settled controller must be quiet');
  h.advance(task.delay); h.fire(id); assert.equal(h.log.expire, 1); assert.match(h.text(), /תוקף הבדיקה פג/); assert.equal(h.tasks.size, 0); h.unmount();
});

test('panel old expiry callback cannot expire a newer diagnostic view', async () => {
  const h = panelHarness(); h.start(); await h.finish(0); const old = [...h.tasks.keys()][0]; h.start(); assert.equal(h.tasks.size, 0); await h.finish(1);
  const current = [...h.tasks.keys()][0]; const before = h.snapshot(); h.fire(old); assert.deepEqual(h.snapshot(), before);
  h.advance(120000); h.fire(current); assert.equal(h.log.expire, 1); assert.match(h.text(), /תוקף הבדיקה פג/); h.unmount();
});

test('panel scope/action/unmount clears owned expiry and stale callback remains quiet', async () => {
  const h = panelHarness(); h.start(); await h.finish(0); const old = [...h.tasks.keys()][0]; h.change('siren'); const before = h.snapshot(); h.fire(old); assert.deepEqual(h.snapshot(), before);
  h.start(); await h.finish(1); const next = [...h.tasks.keys()][0]; h.unmount(); const unmounted = h.snapshot(); h.fire(next); assert.deepEqual(h.snapshot(), unmounted);
});

test('panel external JS abort releases only current controller and preserves retry intent', async () => {
  const h = panelHarness(); const pending = h.start(); const id = h.log.runs[0].request.request_id; h.log.controllers[0].abort(Error('NONUSABLE-ABORT'));
  h.log.runs[0].options.onUpdate(h.poison('aborted-update')); h.log.runs[0].pending.resolve(h.poison('aborted-result')); await pending; h.render();
  assert.equal(h.buttons()[0].props.disabled, false); assert.equal(h.log.events.length, 0); h.start(); assert.equal(h.log.runs[1].request.request_id, id); await h.fail(1); h.unmount();
});

test('client normal queued/running/completed callback order and bounded exact POST/GET', async () => {
  const h = clientHarness({ states: ['queued', 'running', 'completed'] }); const view = await h.run();
  assert.deepEqual(h.log.updates.map(v => v.state), ['queued', 'running', 'completed', 'completed']); assert.equal(view.state, 'completed');
  assert.deepEqual(h.log.waits, [2000, 2000]); assert.deepEqual(h.log.timeouts, [10000, 10000, 10000]);
  assert.deepEqual(h.log.requests.map(r => r.init.method), ['POST', 'GET', 'GET']); assert.deepEqual(JSON.parse(h.log.requests[0].init.body), h.request);
  assert.equal(h.log.requests[0].url, '/api/digital-observer/camera-diagnostics');
  for (const request of h.log.requests) { assert.equal(request.init.credentials, 'same-origin'); assert.equal(request.init.redirect, 'error'); assert.equal(request.init.cache, 'no-store'); assert.equal(request.init.headers.Authorization, 'Bearer NONUSABLE-AUTH'); }
  const query = new URL('https://NONUSABLE.invalid' + h.log.requests[1].url).searchParams; assert.equal(query.get('request_id'), ID.request); assert.equal(query.get('camera_source_id'), ID.camera); assert.equal(query.get('observer_site_id'), ID.site);
});

test('client immediate terminal still reports initial and final update exactly twice', async () => {
  const h = clientHarness(); await h.run(); assert.equal(h.log.requests.length, 1); assert.equal(h.log.updates.length, 2); assert.equal(h.log.waits.length, 0);
});

test('client abort before request has no fetch or callback', async () => {
  const h = clientHarness(); const reason = Error('NONUSABLE-ABORT'); h.controller.abort(reason); await assert.rejects(h.run(), e => e === reason);
  assert.equal(h.log.requests.length, 0); assert.equal(h.log.updates.length, 0);
});

for (const stage of ['post', 'poll']) test('client abort after fetch before any response access ' + stage, async () => {
  const pending = deferred(); let h;
  h = clientHarness({ fetcher(index) { if (stage === 'poll' && index === 0) return Promise.resolve({ ok: true, json: async () => ({ data: { diagnostic: diagnostic(input(), 'queued') } }) }); return pending.promise; } });
  const reason = Error('NONUSABLE-ABORT'); const rejected = assert.rejects(h.run(), e => e === reason); await until(() => h.log.requests.length === (stage === 'poll' ? 2 : 1)); h.controller.abort(reason); pending.resolve(h.poison('response')); await rejected;
  assert.deepEqual(h.log.reads, []); assert.equal(h.log.updates.length, stage === 'poll' ? 1 : 0);
});

for (const stage of ['post', 'poll']) for (const settle of ['resolve', 'reject']) test('client abort while JSON waits ' + stage + '/' + settle, async () => {
  const json = deferred(); let h, waiting = false;
  h = clientHarness({ fetcher(index) { if (stage === 'poll' && index === 0) return Promise.resolve({ ok: true, json: async () => ({ data: { diagnostic: diagnostic(input(), 'queued') } }) }); return Promise.resolve({ ok: true, json() { waiting = true; return json.promise; } }); } });
  const rejected = assert.rejects(h.run()); await until(() => waiting); h.controller.abort(Error('NONUSABLE-ABORT'));
  if (settle === 'resolve') json.resolve(h.poison('payload')); else json.reject(Error('NONUSABLE-JSON-REJECTION')); await rejected;
  assert.deepEqual(h.log.reads, []); assert.equal(h.log.updates.length, stage === 'poll' ? 1 : 0);
});

for (const point of ['initial', 'poll', 'final']) test('client abort inside update stops subsequent callbacks/return ' + point, async () => {
  const reason = Error('NONUSABLE-ABORT'); const target = point === 'initial' ? 1 : 2;
  const h = clientHarness({ states: point === 'poll' ? ['queued', 'completed'] : ['completed'], onUpdate(count, controller) { if (count === target) controller.abort(reason); } });
  await assert.rejects(h.run(), e => e === reason); assert.equal(h.log.updates.length, target); assert.equal(h.log.requests.length, point === 'poll' ? 2 : 1);
});

test('client final return boundary checks abort after final update', async () => {
  const h = clientHarness(); const reason = Error('NONUSABLE-RETURN-ABORT'); const original = h.controller.signal.throwIfAborted.bind(h.controller.signal);
  Object.defineProperty(h.controller.signal, 'throwIfAborted', { value() { if (h.log.updates.length === 2) h.controller.abort(reason); original(); } });
  await assert.rejects(h.run(), e => e === reason); assert.equal(h.log.updates.length, 2); assert.equal(h.log.requests.length, 1);
});

for (const point of ['parse-now', 'final-now']) test('client abort in injected clock before parse/final callback ' + point, async () => {
  const reason = Error('NONUSABLE-NOW-ABORT'); const h = clientHarness({ onNow(count, controller) { if (count === (point === 'parse-now' ? 2 : 3)) controller.abort(reason); } });
  await assert.rejects(h.run(), e => e === reason); assert.equal(h.log.updates.length, point === 'parse-now' ? 0 : 1);
});

test('client abort during injected wait prevents clock/fetch/update continuation', async () => {
  const reason = Error('NONUSABLE-WAIT-ABORT'); const h = clientHarness({ states: ['queued'], onWait(controller) { controller.abort(reason); } });
  await assert.rejects(h.run(), e => e === reason); assert.equal(h.log.requests.length, 1); assert.equal(h.log.updates.length, 1); assert.equal(h.log.now, 3);
});

for (const [status, message] of [[401, 'DIAGNOSTIC_LOGIN_REQUIRED'], [403, 'DIAGNOSTIC_FORBIDDEN'], [500, 'DIAGNOSTIC_REQUEST_FAILED']]) test('client exact HTTP error ' + status, async () => {
  const h = clientHarness({ fetcher() { return Promise.resolve({ ok: false, status, json() { throw Error('NONUSABLE-JSON-MUST-NOT-RUN'); } }); } });
  await assert.rejects(h.run(), new RegExp(message)); assert.equal(h.log.updates.length, 0); assert.equal(h.log.requests.length, 1);
});

for (const invalid of ['request', 'camera', 'task', 'ttl', 'execution', 'future-proof']) test('client existing parser contract rejects invalid view ' + invalid, async () => {
  const view = diagnostic(input()); if (invalid === 'request') view.request_id = ID.other; if (invalid === 'camera') view.camera_source_id = ID.other;
  if (invalid === 'task') view.task_kind = 'command_preflight'; if (invalid === 'ttl') view.expires_at = iso(BASE + 126000);
  if (invalid === 'execution') view.executed = true; if (invalid === 'future-proof') view.verified_at = iso(BASE + 6000);
  const h = clientHarness({ fetcher() { return Promise.resolve({ ok: true, json: async () => ({ data: { diagnostic: view } }) }); } });
  await assert.rejects(h.run()); assert.equal(h.log.updates.length, 0); assert.equal(h.log.requests.length, 1);
});

test('client unchanged expiry is required across polling', async () => {
  const h = clientHarness({ fetcher(index) { return Promise.resolve({ ok: true, json: async () => ({ data: { diagnostic: diagnostic(input(), index ? 'running' : 'queued', BASE + (index ? 119000 : 120000)) } }) }); } });
  await assert.rejects(h.run(), /DIAGNOSTIC_RESPONSE_INVALID/); assert.equal(h.log.requests.length, 2); assert.equal(h.log.updates.length, 1);
});

test('client short expiry clamps wait and returns stripped expired view without another POST', async () => {
  const h = clientHarness({ states: ['queued'], expires: BASE + 1000 }); const view = await h.run();
  assert.equal(view.state, 'expired'); assert.deepEqual(h.log.waits, [1000]); assert.equal(h.log.requests.length, 1); assert.deepEqual(h.log.updates.map(v => v.state), ['queued', 'expired']);
});

test('client poll60 and absolute120-second bounds remain unchanged', async () => {
  const frozen = clientHarness({ states: ['queued'], frozen: true }); await assert.rejects(frozen.run(), /DIAGNOSTIC_WAIT_EXHAUSTED/);
  assert.equal(frozen.log.waits.length, 60); assert.equal(frozen.log.requests.length, 61); assert.equal(frozen.log.requests.filter(r => r.init.method === 'POST').length, 1);
  const deadline = clientHarness({ states: ['queued'], expires: BASE + 125000 }); await assert.rejects(deadline.run(), /DIAGNOSTIC_WAIT_EXHAUSTED/);
  assert.equal(deadline.clock, BASE + 120000); assert.ok(deadline.log.waits.every(ms => ms <= 2000)); assert.equal(deadline.log.requests.filter(r => r.init.method === 'POST').length, 1);
});

test('client command-preflight path and optional token/fetcher interface remain compatible', async () => {
  const request = { ...input(), task_kind: 'command_preflight', action: 'lighting', payload: { enabled: true } };
  const h = clientHarness({ input: request }); const view = await h.run({ token: undefined, fetcher: undefined });
  assert.equal(view.action, 'lighting'); assert.equal(view.supported, true); assert.equal(Object.hasOwn(h.log.requests[0].init.headers, 'Authorization'), false); assert.equal(h.log.requests.length, 1);
});

test('actual unchanged expiry helper strips completed evidence and never grants execution', () => {
  const client = loadClient(); const view = diagnostic(input()); assert.equal(client.expireGuardDiagnostic(view, BASE), view);
  const expired = client.expireGuardDiagnostic(view, BASE + 120000); assert.equal(expired.state, 'expired');
  for (const field of ['capabilities', 'action', 'supported', 'evidence_id', 'verified_at']) assert.equal(Object.hasOwn(expired, field), false);
  assert.equal(expired.executed, false); assert.equal(expired.executor_installed, false); assert.equal(expired.audit_recorded, true);
});

test('panel repeated current completed update preserves one expiry timer before return', async () => {
  const h = panelHarness(); const pending = h.start(); const view = diagnostic(h.log.runs[0].request);
  h.update(0, view); const timer = [...h.tasks.keys()][0]; h.update(0, view); assert.equal(h.tasks.size, 1); assert.equal([...h.tasks.keys()][0], timer);
  h.log.runs[0].pending.resolve(view); await pending; h.render(); assert.equal(h.log.events.length, 1);
  h.advance(120000); h.fire(timer); assert.equal(h.log.expire, 1); assert.match(h.text(), /תוקף הבדיקה פג/); h.unmount();
});
