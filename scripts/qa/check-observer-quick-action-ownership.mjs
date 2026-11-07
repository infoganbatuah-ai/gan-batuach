import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/observer-action-forms.tsx');
assert.ok(statSync(sourcePath).isFile());
if (process.platform === 'darwin') {
  const decimal = execFileSync('/usr/bin/stat', ['-f', '%f', sourcePath], { encoding: 'utf8' }).trim();
  assert.match(decimal, /^\d+$/); const flags = Number(decimal);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, 'refuse dataless source');
}
const source = readFileSync(sourcePath, 'utf8');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));

function harness() {
  let slots = [], cursor = 0, effects = [], mounted = false, key, tree;
  let confirmation = () => true;
  const log = { requests: [], token: 0, json: 0, reads: [], writes: 0, confirms: [], done: [], refresh: 0, order: [] };
  let props = { endpoint: '/NONUSABLE-ENDPOINT-A', body: { action: 'NONUSABLE-ACTION', id: 'NONUSABLE-ID-A' }, children: 'NONUSABLE-LABEL',
    confirmText: 'NONUSABLE-CONFIRM', onDone() { log.done.push('A'); log.order.push('done:A'); } };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], value => { log.writes++; log.order.push('state'); cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(setup) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push({ setup, cleanup: null }); } }
  };
  const neutral = () => null;
  const allowed = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ refresh() { log.refresh++; log.order.push('refresh'); } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-TOKEN'; } },
    '@/lib/domain/digital-observer/camera-connection-methods': { observerCameraConnectionMethods: [], observerCameraManufacturers: [],
      classifyObserverPairingPayload: neutral, connectorTypeForPairing: neutral },
    '@/lib/domain/digital-observer/site-templates': { observerSiteTemplates: [], getObserverSiteTemplate: neutral },
    '@/components/digital-observer/observer-address-fields': { ObserverAddressFields: neutral },
    '@/components/digital-observer/observer-camera-media': { ObserverCameraMedia: neutral },
    '@/components/digital-observer/observer-fcm-push-registration': { ObserverFcmPushRegistration: neutral }
  };
  const exports = {};
  // Fixture props are created in this host realm; use its standard Object/Array
  // intrinsics so plain-prototype checks model one browser realm, not an RPC boundary.
  const context = vm.createContext({ exports, Error, Object, Array, require(name) {
    assert.ok(Object.hasOwn(allowed, name), 'unapproved import ' + name); return allowed[name];
  }, window: { confirm(text) { log.confirms.push(text); return confirmation(text); } },
    fetch(path, options) { const pending = deferred(); log.requests.push({ path, options, pending }); return pending.promise; }
  });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 });
  function visit(predicate, node, result) {
    if (Array.isArray(node)) { for (const child of node) visit(predicate, child, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    visit(predicate, node.props?.children, result);
  }
  function nodes(predicate, node = tree) { const result = []; visit(predicate, node, result); return result; }
  function unmount() { for (const effect of effects) effect.cleanup?.(); mounted = false; }
  function render(next = props) {
    props = next; const wrapper = exports.ObserverQuickAction(props);
    assert.equal(typeof wrapper.type, 'function');
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; effects = []; mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of effects) if (!effect.cleanup) effect.cleanup = effect.setup();
    return key;
  }
  function restartEffects() { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.setup(); } }
  function button() { const result = nodes(n => n.type === 'button'); assert.equal(result.length, 1); return result[0]; }
  function click(handler = button().props.onClick) { return handler(); }
  function state() { const result = nodes(n => typeof n.type === 'function' && n.type.name === 'ResultMessage'); assert.equal(result.length, 1); return copy(result[0].props.state); }
  function packet(index = 0, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, token: log.token, json: log.json, reads: log.reads, writes: log.writes,
    confirms: log.confirms, done: log.done, refresh: log.refresh, order: log.order }); }
  render();
  return { log, render, unmount, restartEffects, button, click, state, packet, poison, snapshot,
    setConfirm(fn) { confirmation = fn; }, get props() { return props; }, get key() { return key; } };
}

test('current exact request and callback ordering', async () => {
  const h = harness(); const pending = h.click(); assert.deepEqual(h.log.confirms, ['NONUSABLE-CONFIRM']);
  const request = h.log.requests[0]; assert.equal(request.path, '/NONUSABLE-ENDPOINT-A'); assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'same-origin'); assert.equal(request.options.headers.Authorization, 'Bearer NONUSABLE-TOKEN');
  assert.deepEqual(JSON.parse(request.options.body), { action: 'NONUSABLE-ACTION', id: 'NONUSABLE-ID-A' });
  h.packet().resolve({ data: { message: 'NONUSABLE-SUCCESS' } }); await pending; h.render();
  assert.equal(h.state().message, 'NONUSABLE-SUCCESS'); assert.deepEqual(h.log.order.slice(-3), ['state', 'done:A', 'refresh']); h.unmount();
});

test('current success retains existing fallback text', async () => {
  const h = harness(); const pending = h.click(); h.packet().resolve({ data: {} }); await pending; h.render();
  assert.equal(h.state().message, 'הפעולה הושלמה'); h.unmount();
});

test('denied confirmation has no UI, token or request effect and permits later explicit attempt', async () => {
  const h = harness(); h.setConfirm(() => false); await h.click(); h.render();
  assert.equal(h.log.writes, 0); assert.equal(h.log.token, 0); assert.equal(h.log.requests.length, 0); assert.equal(h.log.refresh, 0);
  h.setConfirm(() => true); const pending = h.click(); h.packet().resolve({ data: {} }); await pending;
  assert.equal(h.log.confirms.length, 2); assert.equal(h.log.requests.length, 1); h.unmount();
});

test('empty and absent confirmation share no-prompt semantics', async () => {
  const h = harness(); h.render({ ...h.props, confirmText: '' }); const key = h.key;
  const pending = h.click(); h.render({ ...h.props, confirmText: undefined }); assert.equal(h.key, key);
  assert.equal(h.log.confirms.length, 0); h.packet().resolve({ data: {} }); await pending; assert.equal(h.log.refresh, 1); h.unmount();
});

test('synchronous and reentrant duplicate attempts confirm once and POST once', async () => {
  const h = harness(); let nested;
  h.setConfirm(() => { nested = h.click(); return true; });
  const handler = h.button().props.onClick; const pending = h.click(handler); await nested; await h.click(handler);
  assert.equal(h.log.confirms.length, 1); assert.equal(h.log.requests.length, 1); assert.equal(h.log.token, 1);
  h.packet().resolve({ data: {} }); await pending; h.unmount();
});

for (const loss of ['unmount', 'target']) test('scope lost inside confirmation blocks transport ' + loss, async () => {
  const h = harness(); h.setConfirm(() => { if (loss === 'unmount') h.unmount(); else h.render({ ...h.props, body: { id: 'NONUSABLE-ID-B' } }); return true; });
  await h.click(); assert.equal(h.log.requests.length, 0); assert.equal(h.log.token, 0); assert.equal(h.log.writes, 0); assert.equal(h.log.refresh, 0); h.unmount();
});

for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'endpoint', 'body', 'confirm', 'new-request', 'effect']) for (const settlement of ['resolve', 'reject']) {
  test('late request is quiet ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); const retained = h.button().props.onClick; const old = h.click(); let json;
    if (stage === 'json') { json = h.packet(); await tick(); assert.equal(h.log.json, 1); }
    if (loss === 'unmount') h.unmount();
    if (loss === 'endpoint') h.render({ ...h.props, endpoint: '/NONUSABLE-ENDPOINT-B' });
    if (loss === 'body' || loss === 'new-request') h.render({ ...h.props, body: { action: 'NONUSABLE-ACTION', id: 'NONUSABLE-ID-B' } });
    if (loss === 'confirm') h.render({ ...h.props, confirmText: 'NONUSABLE-CONFIRM-B' });
    if (loss === 'effect') h.restartEffects();
    let next; if (loss === 'new-request' || loss === 'effect') next = h.click();
    const before = h.snapshot(); if (loss !== 'effect') await retained();
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[0].pending.resolve(h.poison('old-response'));
      else h.log.requests[0].pending.reject(h.poison('old-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-json-error'));
    await old; assert.deepEqual(h.snapshot(), before);
    if (next) {
      await h.click(); assert.equal(h.log.requests.length, 2, 'old finally must not unlock newer request');
      h.packet(1).resolve({ data: { message: 'NONUSABLE-NEW-SUCCESS' } }); await next;
      assert.equal(h.log.refresh, 1); assert.deepEqual(h.log.done, ['A']);
    }
    h.unmount();
  });
}

test('equivalent fresh inline DTO, children and callback refs retain pending request and captured callback', async () => {
  const h = harness(); const pending = h.click(); h.render(); const key = h.key;
  h.render({ ...h.props, body: { id: 'NONUSABLE-ID-A', action: 'NONUSABLE-ACTION', optional: undefined }, children: 'NONUSABLE-CHANGED-LABEL',
    onDone() { h.log.done.push('B'); } });
  assert.equal(h.key, key); assert.equal(h.state().busy, true); assert.equal(h.log.requests.length, 1);
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
  assert.deepEqual(h.log.done, ['A']); const state = h.state();
  h.render({ ...h.props, body: { action: 'NONUSABLE-ACTION', id: 'NONUSABLE-ID-A' } });
  assert.equal(h.key, key); assert.deepEqual(h.state(), state); assert.equal(h.log.requests.length, 1); h.unmount();
});

for (const failure of ['fetch', 'json', 'http']) test('current failure visible and retry explicit ' + failure, async () => {
  const h = harness(); const pending = h.click();
  if (failure === 'fetch') h.log.requests[0].pending.reject(new Error('NONUSABLE-FAILURE'));
  if (failure === 'json') h.packet().reject(new Error('NONUSABLE-BAD-JSON'));
  if (failure === 'http') h.packet(0, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
  await pending; h.render(); assert.ok(h.state().error); assert.equal(h.state().busy, false); assert.equal(h.log.refresh, 0); assert.deepEqual(h.log.done, []);
  const retry = h.click(); assert.equal(h.log.requests.length, 2); h.packet(1).resolve({ data: {} }); await retry; assert.equal(h.log.refresh, 1); h.unmount();
});

test('onDone unmount stops later refresh', async () => {
  const h = harness(); h.render({ ...h.props, onDone() { h.log.done.push('UNMOUNT'); h.unmount(); } });
  const pending = h.click(); h.packet().resolve({ data: {} }); await pending; assert.deepEqual(h.log.done, ['UNMOUNT']); assert.equal(h.log.refresh, 0);
});

test('onDone changing semantic target prevents refresh and leaves new target clean', async () => {
  const h = harness(); h.render({ ...h.props, onDone() { h.log.done.push('CHANGE'); h.render({ ...h.props, body: { id: 'NONUSABLE-ID-B' } }); } });
  const pending = h.click(); h.packet().resolve({ data: {} }); await pending;
  assert.equal(h.log.refresh, 0); assert.deepEqual(h.state(), { busy: false, error: '', message: '' }); h.unmount();
});

test('next explicit request uses refreshed callback after equivalent rerender', async () => {
  const h = harness(); const first = h.click(); h.packet().resolve({ data: {} }); await first;
  h.render({ ...h.props, body: { id: 'NONUSABLE-ID-A', action: 'NONUSABLE-ACTION' }, onDone() { h.log.done.push('B'); } });
  const next = h.click(); h.packet(1).resolve({ data: {} }); await next; assert.deepEqual(h.log.done, ['A', 'B']); h.unmount();
});

for (const [label, value] of [['null', null], ['undefined', undefined], ['true', true], ['false', false], ['number', 1], ['negative-zero', -0],
  ['nan', NaN], ['infinity', Infinity], ['string', 'NONUSABLE-BODY'], ['array', ['NONUSABLE', null]]]) {
  test('ordinary JSON transport value unchanged ' + label, async () => {
    const h = harness(); h.render({ ...h.props, body: value }); const pending = h.click();
    assert.equal(h.log.requests[0].options.body, JSON.stringify(value)); h.packet().resolve({ data: {} }); await pending; h.unmount();
  });
}

test('nested object ordering is equivalent but array order changes target', async () => {
  const h = harness(); h.render({ ...h.props, body: { nested: { b: 2, a: 1 }, list: ['NONUSABLE-A', 'NONUSABLE-B'] } });
  const pending = h.click(); const key = h.key;
  h.render({ ...h.props, body: { list: ['NONUSABLE-A', 'NONUSABLE-B'], nested: { a: 1, b: 2 } } }); assert.equal(h.key, key);
  h.render({ ...h.props, body: { list: ['NONUSABLE-B', 'NONUSABLE-A'], nested: { a: 1, b: 2 } } }); assert.notEqual(h.key, key);
  const before = h.snapshot(); h.log.requests[0].pending.resolve(h.poison('nested-old-response')); await pending; assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('accessor body does not invoke getter until existing click-time serialization', async () => {
  const h = harness(); let reads = 0; const body = { get id() { reads++; return 'NONUSABLE-ACCESSOR'; } };
  h.render({ ...h.props, body }); assert.equal(reads, 0); const pending = h.click(); assert.equal(reads, 1);
  assert.equal(JSON.parse(h.log.requests[0].options.body).id, 'NONUSABLE-ACCESSOR'); h.packet().resolve({ data: {} }); await pending; h.unmount();
});

test('custom toJSON stays click-time only, not invoked to choose scope', async () => {
  const h = harness(); let calls = 0; const body = { toJSON() { calls++; return { id: 'NONUSABLE-CUSTOM' }; } };
  h.render({ ...h.props, body }); assert.equal(calls, 0); const pending = h.click(); assert.equal(calls, 1);
  assert.deepEqual(JSON.parse(h.log.requests[0].options.body), { id: 'NONUSABLE-CUSTOM' }); h.packet().resolve({ data: {} }); await pending; h.unmount();
});

test('cyclic body has no render throw and preserves click-time serialization error', async () => {
  const h = harness(); const body = {}; body.self = body; h.render({ ...h.props, body });
  await h.click(); h.render(); assert.ok(h.state().error); assert.equal(h.log.requests.length, 0); assert.equal(h.state().busy, false); h.unmount();
});

test('bigint has no render throw and retains existing click-time error behavior', async () => {
  const h = harness(); h.render({ ...h.props, body: 1n }); await h.click(); h.render();
  assert.ok(h.state().error); assert.equal(h.log.requests.length, 0); h.unmount();
});

test('oversize identity fallback does not reject otherwise serializable request', async () => {
  const h = harness(); const body = { id: 'NONUSABLE-' + 'X'.repeat(17000) }; h.render({ ...h.props, body }); const pending = h.click();
  assert.equal(h.log.requests[0].options.body, JSON.stringify(body)); h.packet().resolve({ data: {} }); await pending; h.unmount();
});

test('deep identity fallback preserves existing serialization', async () => {
  const h = harness(); let body = { id: 'NONUSABLE-DEEP' }; for (let i = 0; i < 20; i++) body = { child: body };
  h.render({ ...h.props, body }); const pending = h.click(); assert.equal(h.log.requests[0].options.body, JSON.stringify(body));
  h.packet().resolve({ data: {} }); await pending; h.unmount();
});

test('throwing reflection does not escape render and does not invent a transport rejection policy', async () => {
  const h = harness(); const body = new Proxy({ id: 'NONUSABLE-PROXY' }, { getPrototypeOf() { throw Error('NONUSABLE-REFLECTION'); } });
  h.render({ ...h.props, body }); const pending = h.click(); assert.deepEqual(JSON.parse(h.log.requests[0].options.body), { id: 'NONUSABLE-PROXY' });
  h.packet().resolve({ data: {} }); await pending; h.unmount();
});

test('supported/unsupported boundary separates owners without a new transport policy', async () => {
  const h = harness(); const old = h.click(); const supportedKey = h.key;
  h.render({ ...h.props, body: { toJSON() { return { id: 'NONUSABLE-CUSTOM' }; } } }); assert.notEqual(h.key, supportedKey);
  const before = h.snapshot(); h.log.requests[0].pending.resolve(h.poison('boundary-old-response')); await old; assert.deepEqual(h.snapshot(), before);
  h.render({ ...h.props, body: { action: 'NONUSABLE-ACTION', id: 'NONUSABLE-ID-A' } }); assert.equal(h.key, supportedKey); h.unmount();
});

test('unsupported-body same-branch equivalence is explicitly NOT proven', async () => {
  const h = harness(); h.render({ ...h.props, body: { toJSON() { return { id: 'NONUSABLE-CUSTOM-A' }; } } }); const key = h.key;
  const pending = h.click(); h.render({ ...h.props, body: { toJSON() { return { id: 'NONUSABLE-CUSTOM-B' }; } } });
  assert.equal(h.key, key, 'known bounded limitation, not device/target correlation proof');
  assert.equal(JSON.parse(h.log.requests[0].options.body).id, 'NONUSABLE-CUSTOM-A');
  h.packet().resolve({ data: {} }); await pending; assert.equal(h.log.refresh, 1); h.unmount();
});

test('confirmation exception retains previous rejection behavior and releases transient busy', async () => {
  const h = harness(); h.setConfirm(() => { throw Error('NONUSABLE-CONFIRM-ERROR'); });
  await assert.rejects(h.click(), /NONUSABLE-CONFIRM-ERROR/); assert.equal(h.log.writes, 0); assert.equal(h.log.token, 0);
  h.setConfirm(() => true); const pending = h.click(); h.packet().resolve({ data: {} }); await pending; assert.equal(h.log.requests.length, 1); h.unmount();
});

test('current onDone exception remains visible through existing error handling', async () => {
  const h = harness(); h.render({ ...h.props, onDone() { throw Error('NONUSABLE-CALLBACK-ERROR'); } });
  const pending = h.click(); h.packet().resolve({ data: {} }); await pending; h.render();
  assert.equal(h.state().error, 'NONUSABLE-CALLBACK-ERROR'); assert.equal(h.log.refresh, 0); h.unmount();
});

test('non-Error rejection retains exact existing failure fallback', async () => {
  const h = harness(); const pending = h.click(); h.log.requests[0].pending.reject({ kind: 'NONUSABLE-REJECTION' });
  await pending; h.render(); assert.equal(h.state().error, 'הפעולה נכשלה'); assert.equal(h.state().busy, false); h.unmount();
});

test('wire-equivalent numeric and dense-array values share semantic scope', () => {
  const h = harness(); h.render({ ...h.props, body: NaN }); const nullKey = h.key;
  h.render({ ...h.props, body: null }); assert.equal(h.key, nullKey);
  h.render({ ...h.props, body: [-0, undefined] }); const arrayKey = h.key;
  h.render({ ...h.props, body: [0, null] }); assert.equal(h.key, arrayKey);
  assert.equal(h.log.requests.length, 0); h.unmount();
});
