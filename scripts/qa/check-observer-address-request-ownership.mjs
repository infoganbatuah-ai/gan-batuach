import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/observer-address-fields.tsx');
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
const initialValue = () => ({ address_query: 'NONUSABLE-QUERY-A', city: 'NONUSABLE-CITY-A', street: 'NONUSABLE-STREET-A',
  building_number: '1', apartment_number: '2', floor_kind: 'floor', floor_number: '3', postal_code: 'NONUSABLE-POSTAL-A',
  address_place_id: '', address_session_token: '', formatted_address: '', address_verification_status: 'unverified', parent_marker: 'NONUSABLE-PARENT-A' });
const suggestions = () => [{ placeId: 'NONUSABLE-PLACE-A', label: 'NONUSABLE-LABEL-A' }, { placeId: 'NONUSABLE-PLACE-B', label: 'NONUSABLE-LABEL-B' }];
const resolved = () => ({ city: 'NONUSABLE-CITY-RESOLVED', street: 'NONUSABLE-STREET-RESOLVED', buildingNumber: '9',
  postalCode: 'NONUSABLE-POSTAL-RESOLVED', placeId: 'NONUSABLE-PLACE-RESOLVED', formattedAddress: 'NONUSABLE-FORMATTED' });

function harness(options = {}) {
  let slots = [], cursor = 0, layouts = new Map(), mounted = false, tree;
  let parentVersion = 0, mode = 'echo', queued;
  const log = { requests: [], token: 0, json: 0, reads: [], writes: 0, changes: [], refused: 0, uuid: 0, now: 0 };
  let props = { value: { ...initialValue(), ...(options.value || {}) }, collapsibleDetails: false, onChange: null };
  function parentCallback(version) { return next => {
    log.changes.push(copy(next));
    if (version !== parentVersion) { log.refused++; return; }
    if (mode === 'refuse') return;
    if (mode === 'delay') { queued = next; return; }
    parentVersion++; props = { ...props, value: next, onChange: parentCallback(parentVersion) };
  }; }
  props.onChange = parentCallback(parentVersion);
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], next => { log.writes++; cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useLayoutEffect(setup, deps) {
      const i = cursor++; const previous = layouts.get(i);
      if (!previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((value, at) => !Object.is(value, previous.deps[at])))
        layouts.set(i, { setup, deps, cleanup: previous?.cleanup, pending: true });
    }
  };
  const neutral = () => null;
  const allowed = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-AUTH'; } } };
  const exports = {};
  const context = vm.createContext({ exports, Error, require(name) { assert.ok(Object.hasOwn(allowed, name), 'unapproved import ' + name); return allowed[name]; },
    crypto: options.noCrypto ? undefined : { randomUUID() { log.uuid++; return 'NONUSABLE-SESSION-' + log.uuid; } },
    Date: { now() { log.now++; return 123; } },
    fetch(path, request) { const pending = deferred(); log.requests.push({ path, request, pending }); return pending.promise; }
  });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 });
  function visit(predicate, node, result) {
    if (Array.isArray(node)) { for (const child of node) visit(predicate, child, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    visit(predicate, node.props?.children, result);
  }
  function nodes(predicate) { const result = []; visit(predicate, tree, result); return result; }
  function walkText(node) {
    if (Array.isArray(node)) return node.map(walkText).join(' ');
    if (typeof node === 'string') return node;
    return node && typeof node === 'object' ? walkText(node.props?.children) : '';
  }
  function text() { return walkText(tree); }
  function render(next = props) {
    props = next;
    if (!mounted) { slots = []; layouts = new Map(); mounted = true; }
    cursor = 0; tree = exports.ObserverAddressFields(props);
    // Commit layout jobs in registration order before any asynchronous continuation.
    for (const effect of layouts.values()) if (effect.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.setup(); }
  }
  function unmount() { for (const effect of layouts.values()) effect.cleanup?.(); mounted = false; }
  function restartLayouts() { for (const effect of layouts.values()) { effect.cleanup?.(); effect.cleanup = effect.setup(); } }
  function controls() { return nodes(n => n.type === 'input' || n.type === 'select'); }
  function edit(index, value) { const control = controls()[index]; assert.ok(control); control.props.onChange({ target: { value } }); render(); }
  function search(handler = nodes(n => n.type === 'button' && n.props.className === 'do-button secondary')[0].props.onClick) { const pending = handler(); render(); return pending; }
  function select(index = 0, handler) { const callback = handler || nodes(n => n.props.role === 'option')[index]?.props.onClick; assert.equal(typeof callback, 'function'); const pending = callback(); render(); return pending; }
  function packet(index = 0, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, token: log.token, json: log.json, reads: log.reads, writes: log.writes,
    changes: log.changes, refused: log.refused, uuid: log.uuid, now: log.now }); }
  function replace(value) { parentVersion++; render({ ...props, value, onChange: parentCallback(parentVersion) }); }
  async function prepare() { const pending = search(); packet().resolve({ data: { suggestions: suggestions() } }); await pending; render(); }
  function busy() { return nodes(n => n.type === 'button' && n.props.className === 'do-button secondary')[0].props.disabled; }
  render();
  return { log, render, unmount, restartLayouts, nodes, text, controls, edit, search, select, packet, poison, snapshot, replace, prepare, busy,
    setMode(value) { mode = value; }, flushEcho() { assert.ok(queued); const next = queued; queued = undefined; replace(next); },
    unrelated() { replace({ ...props.value, parent_marker: 'NONUSABLE-PARENT-B' }); }, get props() { return props; } };
}

test('current autocomplete exact request, suggestions and matching once-generated session', async () => {
  const h = harness(); assert.equal(h.log.uuid, 1); const pending = h.search(); const request = h.log.requests[0];
  assert.equal(request.path, '/api/digital-observer/address/autocomplete'); assert.equal(request.request.method, 'POST');
  assert.equal(request.request.credentials, 'same-origin'); assert.equal(request.request.headers.Authorization, 'Bearer NONUSABLE-AUTH');
  assert.deepEqual(JSON.parse(request.request.body), { input: 'NONUSABLE-QUERY-A', session_token: 'NONUSABLE-SESSION-1' });
  h.packet().resolve({ data: { suggestions: suggestions() } }); await pending; h.render();
  assert.equal(h.nodes(n => n.props.role === 'option').length, 2); assert.equal(h.busy(), false); assert.equal(h.log.uuid, 1); h.unmount();
});

test('current resolve calls latest parent once, preserves full draft and own controlled echo notice', async () => {
  const h = harness(); await h.prepare(); const pending = h.select(); h.unrelated();
  h.packet(1).resolve({ data: { address: resolved() } }); await pending; h.render();
  assert.deepEqual(JSON.parse(h.log.requests[1].request.body), { place_id: 'NONUSABLE-PLACE-A', session_token: 'NONUSABLE-SESSION-1' });
  assert.equal(h.log.changes.length, 1); assert.equal(h.log.refused, 0);
  assert.deepEqual(copy(h.props.value), { ...initialValue(), parent_marker: 'NONUSABLE-PARENT-B', address_query: 'NONUSABLE-LABEL-A',
    city: 'NONUSABLE-CITY-RESOLVED', street: 'NONUSABLE-STREET-RESOLVED', building_number: '9', postal_code: 'NONUSABLE-POSTAL-RESOLVED',
    address_place_id: 'NONUSABLE-PLACE-RESOLVED', formatted_address: 'NONUSABLE-FORMATTED', address_verification_status: 'suggested', address_session_token: 'NONUSABLE-SESSION-1' });
  assert.match(h.text(), /הכתובת נמצאה וסונכרנה/); h.render({ ...h.props, value: { ...h.props.value }, collapsibleDetails: true });
  assert.match(h.text(), /הכתובת נמצאה וסונכרנה/); assert.equal(h.log.uuid, 1); h.unmount();
});

for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'query', 'manual', 'apartment', 'floor', 'new-search', 'session', 'external-address']) for (const settlement of ['resolve', 'reject']) {
  test('autocomplete stale ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); const retained = h.nodes(n => n.type === 'button')[0].props.onClick; const old = h.search(); let json;
    if (stage === 'json') { json = h.packet(); await tick(); }
    if (loss === 'unmount') h.unmount();
    else if (loss === 'session') h.replace({ ...h.props.value, address_session_token: 'NONUSABLE-SESSION-EXTERNAL' });
    else if (loss === 'external-address') h.replace({ ...h.props.value, city: 'NONUSABLE-EXTERNAL-CITY' });
    else h.edit(loss === 'manual' ? 1 : loss === 'apartment' ? 4 : loss === 'floor' ? 6 : 0, loss === 'floor' ? '7' : 'NONUSABLE-NEW-DRAFT');
    let next; if (loss === 'new-search') next = h.search();
    const before = h.snapshot(); await retained();
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[0].pending.resolve(h.poison('old-response'));
      else h.log.requests[0].pending.reject(h.poison('old-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-json-error'));
    await old; assert.deepEqual(h.snapshot(), before);
    if (next) {
      assert.equal(h.busy(), true); await h.search(); assert.equal(h.log.requests.length, 2);
      h.packet(1).resolve({ data: { suggestions: suggestions() } }); await next; h.render(); assert.equal(h.busy(), false);
    }
    h.unmount();
  });
}

for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'query', 'manual', 'apartment', 'floor', 'selection', 'session', 'external-address', 'new-search']) for (const settlement of ['resolve', 'reject']) {
  test('resolve stale ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); await h.prepare(); const retained = h.nodes(n => n.props.role === 'option')[0].props.onClick;
    const old = h.select(); let json; if (stage === 'json') { json = h.packet(1); await tick(); }
    let next;
    if (loss === 'unmount') h.unmount();
    else if (loss === 'selection') next = h.select(1);
    else if (loss === 'session') h.replace({ ...h.props.value, address_session_token: 'NONUSABLE-SESSION-EXTERNAL' });
    else if (loss === 'external-address') h.replace({ ...h.props.value, street: 'NONUSABLE-EXTERNAL-STREET' });
    else h.edit(loss === 'manual' ? 2 : loss === 'apartment' ? 4 : loss === 'floor' ? 6 : 0, loss === 'floor' ? '8' : 'NONUSABLE-NEW-DRAFT');
    if (loss === 'new-search') next = h.search();
    const before = h.snapshot(); await retained();
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[1].pending.resolve(h.poison('old-resolve-response'));
      else h.log.requests[1].pending.reject(h.poison('old-resolve-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-resolve-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-resolve-json-error'));
    await old; assert.deepEqual(h.snapshot(), before);
    if (next) {
      assert.equal(h.busy(), true);
      if (loss === 'selection') await h.select(1); else await h.search();
      assert.equal(h.log.requests.length, 3, 'stale finally must not release newer intent');
      h.packet(2).resolve({ data: loss === 'selection' ? { address: resolved() } : { suggestions: [] } }); await next; h.render(); assert.equal(h.busy(), false);
    }
    h.unmount();
  });
}

test('same in-flight autocomplete intent is suppressed synchronously', async () => {
  const h = harness(); const handler = h.nodes(n => n.type === 'button')[0].props.onClick;
  const pending = handler(); await handler(); assert.equal(h.log.requests.length, 1); assert.equal(h.log.token, 1);
  h.packet().resolve({ data: { suggestions: [] } }); await pending; h.render(); assert.equal(h.busy(), false); h.unmount();
});

test('same resolve intent deduplicates but distinct visible suggestion can supersede', async () => {
  const h = harness(); await h.prepare(); const handler = h.nodes(n => n.props.role === 'option')[0].props.onClick;
  const first = handler(); await handler(); h.render(); assert.equal(h.log.requests.length, 2);
  const next = h.select(1); assert.equal(h.log.requests.length, 3);
  h.packet(2).resolve({ data: { address: resolved() } }); await next; h.render(); const before = h.snapshot();
  h.log.requests[1].pending.resolve(h.poison('superseded-response')); await first; assert.deepEqual(h.snapshot(), before);
  assert.equal(h.props.value.address_query, 'NONUSABLE-LABEL-B'); assert.equal(h.log.changes.length, 1); h.unmount();
});

test('short query makes no request and current later explicit search remains usable', async () => {
  const h = harness(); h.edit(0, ' X '); const before = h.log.token; await h.search(); h.render();
  assert.equal(h.log.requests.length, 0); assert.equal(h.log.token, before); assert.match(h.text(), /לפחות עיר/);
  h.edit(0, 'NONUSABLE-LONGER'); const pending = h.search(); h.packet().resolve({ data: { suggestions: [] } }); await pending; h.render();
  assert.match(h.text(), /לא נמצאה התאמה/); h.unmount();
});

for (const kind of ['search', 'resolve']) for (const failure of ['fetch', 'json', 'http', 'empty']) test(kind + ': current failure or empty reply and explicit retry ' + failure, async () => {
  const h = harness(); if (kind === 'resolve') await h.prepare(); const index = kind === 'resolve' ? 1 : 0;
  const pending = kind === 'resolve' ? h.select() : h.search();
  if (failure === 'fetch') h.log.requests[index].pending.reject(new Error('NONUSABLE-FAILURE'));
  if (failure === 'json') h.packet(index).reject(new Error('NONUSABLE-JSON-FAILURE'));
  if (failure === 'http') h.packet(index, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
  if (failure === 'empty') h.packet(index).resolve({ data: {} });
  await pending; h.render(); assert.equal(h.busy(), false); assert.equal(h.log.changes.length, 0);
  if (kind === 'search' && failure === 'empty') assert.match(h.text(), /לא נמצאה התאמה/);
  const retry = kind === 'resolve' ? h.select() : h.search();
  h.packet(index + 1).resolve({ data: kind === 'resolve' ? { address: resolved() } : { suggestions: suggestions() } }); await retry; h.render();
  if (kind === 'resolve') assert.equal(h.log.changes.length, 1); else assert.equal(h.nodes(n => n.props.role === 'option').length, 2); h.unmount();
});

test('resolve fallback fields preserve current manual address, apartment and floor', async () => {
  const h = harness(); await h.prepare(); const pending = h.select();
  h.packet(1).resolve({ data: { address: { city: '', street: '', buildingNumber: '', postalCode: '', placeId: 'NONUSABLE-PLACE', formattedAddress: 'NONUSABLE-FORMATTED' } } });
  await pending; h.render(); const value = h.props.value;
  assert.equal(value.city, 'NONUSABLE-CITY-A'); assert.equal(value.street, 'NONUSABLE-STREET-A'); assert.equal(value.building_number, '1');
  assert.equal(value.postal_code, 'NONUSABLE-POSTAL-A'); assert.equal(value.apartment_number, '2'); assert.equal(value.floor_number, '3'); h.unmount();
});

for (const field of [0, 1, 2, 3]) test('manual address edit resets verification and clears suggestions field ' + field, async () => {
  const h = harness({ value: { address_place_id: 'NONUSABLE-OLD-PLACE', formatted_address: 'NONUSABLE-OLD-FORMATTED', address_verification_status: 'suggested' } });
  await h.prepare(); h.edit(field, 'NONUSABLE-MANUAL');
  assert.equal(h.props.value.address_place_id, ''); assert.equal(h.props.value.formatted_address, ''); assert.equal(h.props.value.address_verification_status, 'unverified');
  assert.equal(h.nodes(n => n.props.role === 'option').length, 0); h.unmount();
});

test('apartment/floor edits preserve verification; ground selection retains zero and disabled floor', () => {
  const h = harness({ value: { address_place_id: 'NONUSABLE-PLACE', formatted_address: 'NONUSABLE-FORMATTED', address_verification_status: 'suggested' } });
  h.edit(4, '4'); assert.equal(h.props.value.address_place_id, 'NONUSABLE-PLACE'); h.edit(5, 'ground');
  assert.equal(h.props.value.floor_number, '0'); assert.equal(h.controls()[6].props.disabled, true); assert.equal(h.controls()[6].props.value, '0');
  h.edit(5, 'floor'); assert.equal(h.controls()[6].props.disabled, false); assert.equal(h.props.value.floor_number, '0'); h.edit(6, '5');
  assert.equal(h.props.value.floor_number, '5'); assert.equal(h.props.value.address_verification_status, 'suggested'); h.unmount();
});

test('retained old controls and suggestions cannot read an event or change newer draft', async () => {
  const h = harness(); await h.prepare(); const oldControls = h.controls().map(n => n.props.onChange); const oldOption = h.nodes(n => n.props.role === 'option')[0].props.onClick;
  h.edit(0, 'NONUSABLE-NEW-QUERY'); const before = h.snapshot();
  for (const callback of oldControls) callback(h.poison('old-control-event')); await oldOption(); assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('equivalent address refresh and cosmetic props preserve pending result and latest callback', async () => {
  const h = harness(); const pending = h.search(); h.replace({ ...h.props.value }); h.render({ ...h.props, collapsibleDetails: true });
  assert.equal(h.busy(), true); h.packet().resolve({ data: { suggestions: suggestions() } }); await pending; h.render();
  assert.equal(h.nodes(n => n.props.role === 'option').length, 2); assert.equal(h.nodes(n => n.type === 'details').length, 1); assert.equal(h.log.uuid, 1); h.unmount();
});

for (const mode of ['refuse', 'delay']) test('success requires actual controlled address echo ' + mode, async () => {
  const h = harness(); await h.prepare(); h.setMode(mode); const pending = h.select(); h.packet(1).resolve({ data: { address: resolved() } });
  await pending; h.render(); assert.equal(h.log.changes.length, 1); assert.doesNotMatch(h.text(), /הכתובת נמצאה וסונכרנה/);
  if (mode === 'delay') { h.flushEcho(); assert.match(h.text(), /הכתובת נמצאה וסונכרנה/); assert.equal(h.log.uuid, 1); }
  else { h.setMode('echo'); h.edit(1, 'NONUSABLE-RECOVERY-CITY'); assert.equal(h.props.value.city, 'NONUSABLE-RECOVERY-CITY'); }
  h.unmount();
});

test('supplied token is preserved without UUID generation', async () => {
  const h = harness({ value: { address_session_token: 'NONUSABLE-SUPPLIED' } }); await h.prepare(); const pending = h.select();
  assert.equal(JSON.parse(h.log.requests[0].request.body).session_token, 'NONUSABLE-SUPPLIED');
  h.packet(1).resolve({ data: { address: resolved() } }); await pending; h.render(); assert.equal(h.props.value.address_session_token, 'NONUSABLE-SUPPLIED'); assert.equal(h.log.uuid, 0); h.unmount();
});

test('generated token echo does not regenerate and real external replacement uses new token', async () => {
  const h = harness(); h.edit(4, '4'); assert.equal(h.props.value.address_session_token, 'NONUSABLE-SESSION-1');
  h.render(); h.render(); assert.equal(h.log.uuid, 1);
  h.replace({ ...h.props.value, address_session_token: 'NONUSABLE-EXTERNAL' });
  const pending = h.search(); assert.equal(JSON.parse(h.log.requests[0].request.body).session_token, 'NONUSABLE-EXTERNAL');
  h.packet().resolve({ data: { suggestions: [] } }); await pending;
  h.replace({ ...h.props.value, address_session_token: '' }); assert.equal(h.log.uuid, 2);
  const next = h.search(); assert.equal(JSON.parse(h.log.requests[1].request.body).session_token, 'NONUSABLE-SESSION-2');
  h.packet(1).resolve({ data: { suggestions: [] } }); await next; h.unmount();
});

test('fallback clock token is generated once outside render when crypto is absent', async () => {
  const h = harness({ noCrypto: true }); h.render(); h.render(); assert.equal(h.log.now, 1); const pending = h.search();
  assert.equal(JSON.parse(h.log.requests[0].request.body).session_token, 'address-123'); h.packet().resolve({ data: { suggestions: [] } }); await pending; h.unmount();
});

for (const kind of ['search', 'resolve']) test('layout cleanup/setup keeps token and fences old request ' + kind, async () => {
  const h = harness(); if (kind === 'resolve') await h.prepare(); const index = kind === 'resolve' ? 1 : 0;
  const old = kind === 'resolve' ? h.select() : h.search(); h.restartLayouts();
  const next = kind === 'resolve' ? h.select() : h.search(); const before = h.snapshot();
  h.log.requests[index].pending.resolve(h.poison('layout-old-response')); await old; assert.deepEqual(h.snapshot(), before);
  h.packet(index + 1).resolve({ data: kind === 'resolve' ? { address: resolved() } : { suggestions: [] } }); await next; h.render();
  assert.equal(h.log.uuid, 1); assert.equal(h.busy(), false); h.unmount();
});
