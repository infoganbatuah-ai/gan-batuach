import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Actual module, unchanged transpilation, closed allowlisted imports. No HTTP or native APIs.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/observer-action-forms.tsx');
assert.ok(statSync(sourcePath).isFile(), 'regular source required');
if (process.platform === 'darwin') {
  const decimal = execFileSync('/usr/bin/stat', ['-f', '%f', sourcePath], { encoding: 'utf8' }).trim();
  assert.match(decimal, /^\d+$/);
  const flags = Number(decimal);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless source');
}
const source = readFileSync(sourcePath, 'utf8');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const cameraA = () => ({ id: 'NONUSABLE-CAMERA-A', display_name: 'NONUSABLE-NAME-A', location_label: 'NONUSABLE-LOCATION-A',
  metadata: { zone_type: 'ENTRANCE', ai_suggested_name: 'NONUSABLE-AI-NAME', crossing_line: { axis: 'x', position: 0.4, inside: 'positive' } } });
const cameraB = () => ({ id: 'NONUSABLE-CAMERA-B', display_name: 'NONUSABLE-NAME-B', location_label: 'NONUSABLE-LOCATION-B',
  metadata: { zone_type: 'INDOOR', crossing_line: { axis: 'y', position: 0.7, inside: 'negative' } } });

function harness(kind) {
  let slots = [], cursor = 0, effects = [], cleanups = [], setups = [], mounted = false, key, tree;
  let camera = cameraA();
  const log = { token: 0, fetch: [], json: 0, reads: [], writes: 0, refresh: 0, defaults: 0, stops: 0 };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], value => { log.writes++; cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!(i in slots)) { slots[i] = deps; effects.push(fn); } }
  };
  const neutral = () => null;
  const allowed = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ refresh() { log.refresh++; } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-TOKEN'; } },
    '@/lib/domain/digital-observer/camera-connection-methods': { classifyObserverPairingPayload: neutral,
      connectorTypeForPairing: neutral, observerCameraConnectionMethods: [], observerCameraManufacturers: [] },
    '@/lib/domain/digital-observer/site-templates': { getObserverSiteTemplate: neutral, observerSiteTemplates: [] },
    '@/components/digital-observer/observer-address-fields': { ObserverAddressFields: neutral },
    '@/components/digital-observer/observer-camera-media': { ObserverCameraMedia: neutral },
    '@/components/digital-observer/observer-fcm-push-registration': { ObserverFcmPushRegistration: neutral }
  };
  const exports = {};
  const context = vm.createContext({ exports, Error, require(name) {
    assert.ok(Object.hasOwn(allowed, name), 'unapproved import: ' + name); return allowed[name];
  }, fetch(path, options) {
    const pending = deferred(); log.fetch.push({ path, options, pending }); return pending.promise;
  } });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 });
  const exported = kind === 'full' ? exports.ObserverCameraNameForm : exports.ObserverCameraInlineRename;
  function nodes(predicate, node, result = []) {
    if (arguments.length < 2) node = tree;
    if (Array.isArray(node)) { for (const child of node) nodes(predicate, child, result); return result; }
    if (!node || typeof node !== 'object') return result;
    if (predicate(node)) result.push(node);
    nodes(predicate, node.props?.children, result); return result;
  }
  function unmount() { for (const cleanup of cleanups) cleanup(); cleanups = []; setups = []; mounted = false; }
  function render(next = camera) {
    camera = next; const wrapper = exported({ camera });
    assert.equal(typeof wrapper.type, 'function', 'top-level keyed inner required');
    assert.equal(wrapper.key, camera.id);
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of effects.splice(0)) { setups.push(effect); const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    return tree;
  }
  function event() { return { preventDefault() { log.defaults++; }, stopPropagation() { log.stops++; } }; }
  function controls() { return nodes(n => n.type === 'input' || n.type === 'select'); }
  function form() { return nodes(n => n.type === 'form')[0]; }
  function trigger() { return nodes(n => n.type === 'button' && n.props.className === 'do-camera-rename-trigger')[0]; }
  function cancelButton() { return nodes(n => n.type === 'button' && n.props['aria-label'] === 'ביטול שינוי שם')[0]; }
  function open() { assert.equal(kind, 'inline'); const button = trigger(); assert.ok(button); button.props.onClick(event()); render(); assert.ok(form()); }
  function cancel() { const button = cancelButton(); assert.ok(button); button.props.onClick(); render(); assert.ok(trigger()); }
  function edit(index, value) {
    const control = controls()[index]; assert.ok(control, 'missing control ' + index);
    control.props.onChange({ target: control.props.type === 'checkbox' ? { checked: value } : { value } }); render();
  }
  function suggest() { const button = nodes(n => n.type === 'button' && n.props.className === 'do-camera-name-suggestion')[0]; assert.ok(button); button.props.onClick(); render(); }
  function submit(handler = form()?.props.onSubmit) { assert.equal(typeof handler, 'function'); return handler(event()); }
  function values() { return copy(controls().map(n => n.props.type === 'checkbox' ? n.props.checked : n.props.value)); }
  function state() {
    if (kind === 'full') {
      const result = nodes(n => typeof n.type === 'function' && n.type.name === 'ResultMessage');
      assert.equal(result.length, 1); return copy(result[0].props.state);
    }
    return { error: nodes(n => n.props.role === 'alert').map(n => n.props.children).join(''),
      message: nodes(n => n.props.role === 'status').map(n => n.props.children).join(''),
      busy: Boolean(nodes(n => n.type === 'button' && n.props.type === 'submit')[0]?.props.disabled) };
  }
  function packet(index = 0, ok = true) {
    const json = deferred(); assert.ok(log.fetch[index]);
    log.fetch[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json;
  }
  function poison(label) { return new Proxy({}, { get(_, property) {
    if (property === 'then') return undefined;
    log.reads.push(label + ':' + String(property)); throw Error('poison ' + label);
  } }); }
  function snapshot() { return copy({ token: log.token, fetch: log.fetch.length, json: log.json, reads: log.reads,
    writes: log.writes, refresh: log.refresh, defaults: log.defaults, stops: log.stops }); }
  render();
  return { log, nodes, render, unmount, replayEffects() { for (const cleanup of cleanups) cleanup(); cleanups = []; for (const setup of setups) { const cleanup = setup(); if (cleanup) cleanups.push(cleanup); } }, event, controls, form, trigger, cancelButton, open, cancel, edit, suggest,
    submit, values, state, packet, poison, snapshot, get camera() { return camera; } };
}

for (const kind of ['full', 'inline']) {
  test(kind + ': unchanged ack uses exact payload and refreshes once', async () => {
    const h = harness(kind); if (kind === 'inline') h.open(); h.edit(0, 'NONUSABLE-SUBMITTED');
    const pending = h.submit(); assert.equal(h.log.fetch.length, 1);
    const request = h.log.fetch[0]; assert.equal(request.path, '/api/digital-observer/cameras');
    assert.equal(request.options.method, 'POST'); assert.equal(request.options.credentials, 'same-origin');
    assert.equal(request.options.headers.Authorization, 'Bearer NONUSABLE-TOKEN');
    const body = { action: 'rename', id: 'NONUSABLE-CAMERA-A', display_name: 'NONUSABLE-SUBMITTED', location_label: 'NONUSABLE-LOCATION-A' };
    if (kind === 'full') Object.assign(body, { zone_type: 'ENTRANCE', crossing_line: { axis: 'x', position: 0.4, inside: 'positive' } });
    assert.deepEqual(JSON.parse(request.options.body), body);
    h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
    assert.equal(h.log.refresh, 1);
    if (kind === 'full') assert.equal(h.state().message, 'NONUSABLE-SAVED');
    else { assert.ok(h.trigger()); assert.equal(h.form(), undefined); }
    h.unmount();
  });

  test(kind + ': duplicate prevents browser submit but does not send twice', async () => {
    const h = harness(kind); if (kind === 'inline') h.open();
    const handler = h.form().props.onSubmit; const first = h.submit(handler); const second = h.submit(handler); await second;
    assert.equal(h.log.defaults, kind === 'inline' ? 3 : 2);
    assert.equal(h.log.stops, kind === 'inline' ? 3 : 0);
    assert.equal(h.log.fetch.length, 1); assert.equal(h.log.token, 1);
    h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await first; h.unmount();
  });

  test(kind + ': same-camera server props preserve draft', async () => {
    const h = harness(kind); if (kind === 'inline') h.open(); h.edit(0, 'NONUSABLE-UNSENT');
    const before = h.values(); const pending = h.submit();
    h.render({ ...h.camera, display_name: 'NONUSABLE-SERVER-UPDATE', location_label: 'NONUSABLE-SERVER-LOCATION',
      metadata: { ...h.camera.metadata, unrelated: 'NONUSABLE-UPDATE' } });
    assert.deepEqual(h.values(), before);
    h.edit(0, 'NONUSABLE-NEWER-UNSENT'); const newer = h.values();
    h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
    assert.deepEqual(h.values(), newer); assert.match(h.state().message, /טרם נשלח/); assert.equal(h.log.refresh, 0); h.unmount();
  });

  test(kind + ': Camera B initializes its own fields instead of carrying Camera A draft', () => {
    const h = harness(kind); if (kind === 'inline') h.open(); h.edit(0, 'NONUSABLE-A-DRAFT');
    h.render(cameraB());
    if (kind === 'full') assert.deepEqual(h.values(), ['NONUSABLE-NAME-B', 'NONUSABLE-LOCATION-B', 'INDOOR', true, 'y', 70, 'negative']);
    else { assert.ok(h.trigger()); h.open(); assert.deepEqual(h.values(), ['NONUSABLE-NAME-B']); }
    h.unmount();
  });

  for (const loss of ['camera', 'unmount', 'new-request']) for (const stage of ['fetch', 'json']) for (const settlement of ['resolve', 'reject']) {
    test(kind + ': lost owner silent ' + [loss, stage, settlement].join('/'), async () => {
      const h = harness(kind); if (kind === 'inline') h.open();
      const oldHandler = h.form().props.onSubmit; const old = h.submit();
      let json;
      if (stage === 'json') { json = h.packet(); await tick(); assert.equal(h.log.json, 1); }
      if (loss === 'unmount') h.unmount();
      else { h.render(cameraB()); if (kind === 'inline') h.open(); h.edit(0, 'NONUSABLE-B-UNSENT'); }
      let next;
      if (loss === 'new-request') next = h.submit();
      const values = h.values(); const before = h.snapshot();
      await oldHandler(h.poison('retained-event'));
      if (stage === 'fetch') {
        if (settlement === 'reject') h.log.fetch[0].pending.reject(h.poison('old-error'));
        else h.log.fetch[0].pending.resolve(h.poison('old-response'));
      } else if (settlement === 'reject') json.reject(h.poison('old-json-error'));
      else json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
      await old;
      assert.deepEqual(h.snapshot(), before);
      if (loss !== 'unmount') { h.render(); assert.deepEqual(h.values(), values); }
      if (next) { h.packet(1).resolve({ data: { message: 'NONUSABLE-B-SAVED' } }); await next; h.render(); assert.equal(h.log.refresh, 1); }
      h.unmount();
    });
  }

  for (const failure of ['fetch', 'json', 'http']) test(kind + ': failure keeps draft and permits retry ' + failure, async () => {
    const h = harness(kind); if (kind === 'inline') h.open(); h.edit(0, 'NONUSABLE-RETRY-DRAFT');
    const before = h.values(); const pending = h.submit();
    if (failure === 'fetch') h.log.fetch[0].pending.reject(new Error('NONUSABLE-FAILURE'));
    // Existing helper swallows JSON parse errors. Inline historically ignores data on
    // HTTP success, so use HTTP failure there instead of changing that contract.
    if (failure === 'json') h.packet(0, kind === 'full').reject(new Error('NONUSABLE-BAD-JSON'));
    if (failure === 'http') h.packet(0, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
    await pending; h.render(); assert.deepEqual(h.values(), before); assert.ok(h.state().error); assert.equal(h.log.refresh, 0);
    const retry = h.submit(); assert.equal(h.log.fetch.length, 2);
    h.packet(1).resolve({ data: { message: 'NONUSABLE-RETRIED' } }); await retry; assert.equal(h.log.refresh, 1); h.unmount();
  });
}

const fullEdits = [
  [0, 'NONUSABLE-NAME-NEW'], [1, 'NONUSABLE-LOCATION-NEW'], [2, 'POOL'], [3, false],
  [4, 'y'], [5, '65'], [6, 'negative'], ['suggestion', 'NONUSABLE-AI-NAME']
];
for (const [field, value] of fullEdits) test('full: new unsent field survives acknowledgement ' + field, async () => {
  const h = harness('full'); const before = h.values(); const pending = h.submit();
  if (field === 'suggestion') h.suggest(); else h.edit(field, value);
  const latest = h.values(); assert.notDeepEqual(latest, before);
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
  assert.deepEqual(h.values(), latest); assert.equal(h.log.refresh, 0); assert.match(h.state().message, /טרם נשלחו/);
  const next = h.submit(); assert.equal(h.log.fetch.length, 2);
  const body = JSON.parse(h.log.fetch[1].options.body);
  if (field === 3) assert.equal(body.crossing_line, null);
  if (field === 5) assert.equal(body.crossing_line.position, 0.65);
  if (field === 'suggestion') assert.equal(body.display_name, value);
  h.packet(1).resolve({ data: { message: 'NONUSABLE-NEW-SAVED' } }); await next; assert.equal(h.log.refresh, 1); h.unmount();
});

test('full: unchanged input event and repeated AI proposal do not fabricate a new revision', async () => {
  const h = harness('full'); h.suggest(); const pending = h.submit();
  h.edit(0, 'NONUSABLE-AI-NAME'); h.suggest();
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; assert.equal(h.log.refresh, 1); h.unmount();
});

test('full: stale render submit cannot send values preceding the current draft', async () => {
  const h = harness('full'); const old = h.form().props.onSubmit; h.edit(0, 'NONUSABLE-NEWER-DRAFT');
  await h.submit(old); assert.equal(h.log.defaults, 1); assert.equal(h.log.fetch.length, 0); assert.equal(h.log.token, 0);
  const next = h.submit(); assert.equal(JSON.parse(h.log.fetch[0].options.body).display_name, 'NONUSABLE-NEWER-DRAFT');
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await next; h.unmount();
});

test('full: optional metadata defaults and crossing line omission retain existing contract', async () => {
  const h = harness('full'); h.render({ id: 'NONUSABLE-CAMERA-DEFAULTS', display_name: 'NONUSABLE-NAME' });
  assert.deepEqual(h.values(), ['NONUSABLE-NAME', '', '', false]);
  const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.fetch[0].options.body), {
    action: 'rename', id: 'NONUSABLE-CAMERA-DEFAULTS', display_name: 'NONUSABLE-NAME', location_label: '', crossing_line: null
  });
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.unmount();
});

test('inline: changed pending name stays open and explicit next submit uses latest name', async () => {
  const h = harness('inline'); h.open(); h.edit(0, 'NONUSABLE-FIRST'); const pending = h.submit();
  h.edit(0, 'NONUSABLE-UNSENT');
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
  assert.ok(h.form()); assert.deepEqual(h.values(), ['NONUSABLE-UNSENT']); assert.match(h.state().message, /טרם נשלח/); assert.equal(h.log.refresh, 0);
  const next = h.submit(); assert.equal(JSON.parse(h.log.fetch[1].options.body).display_name, 'NONUSABLE-UNSENT');
  h.packet(1).resolve({ data: { message: 'NONUSABLE-SAVED-NEW' } }); await next; h.render();
  assert.ok(h.trigger()); assert.equal(h.log.refresh, 1); h.unmount();
});

for (const stage of ['fetch', 'json']) for (const settlement of ['resolve', 'reject']) for (const newerRequest of [false, true]) {
  test('inline: cancel/reopen isolates prior edit ' + [stage, settlement, newerRequest].join('/'), async () => {
    const h = harness('inline'); h.open(); h.edit(0, 'NONUSABLE-OLD-NAME');
    const retained = { submit: h.form().props.onSubmit, cancel: h.cancelButton().props.onClick, edit: h.controls()[0].props.onChange };
    const old = h.submit(); let json;
    if (stage === 'json') { json = h.packet(); await tick(); }
    h.cancel(); h.open(); h.edit(0, 'NONUSABLE-NEW-EDIT');
    let next; if (newerRequest) next = h.submit();
    const before = h.snapshot(); const values = h.values();
    await retained.submit(h.poison('old-edit-event')); retained.cancel(); retained.edit(h.poison('old-input-event'));
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.fetch[0].pending.resolve(h.poison('canceled-response'));
      else h.log.fetch[0].pending.reject(h.poison('canceled-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('canceled-data'); throw Error('poison'); } });
    else json.reject(h.poison('canceled-json-error'));
    await old; assert.deepEqual(h.snapshot(), before); h.render(); assert.ok(h.form()); assert.deepEqual(h.values(), values);
    if (next) {
      // Old finally must not unlock the newer pending request.
      const duplicate = h.submit(); await duplicate; assert.equal(h.log.fetch.length, 2);
      h.packet(1).resolve({ data: { message: 'NONUSABLE-CURRENT-SAVED' } }); await next; h.render(); assert.ok(h.trigger()); assert.equal(h.log.refresh, 1);
    }
    h.unmount();
  });
}

for (const settlement of ['resolve', 'reject']) test('inline: newer request can finish before canceled older request ' + settlement, async () => {
  const h = harness('inline'); h.open(); const old = h.submit(); h.cancel(); h.open(); h.edit(0, 'NONUSABLE-CURRENT');
  const next = h.submit(); h.packet(1).resolve({ data: { message: 'NONUSABLE-CURRENT-SAVED' } }); await next; h.render();
  assert.ok(h.trigger()); assert.equal(h.log.refresh, 1); const before = h.snapshot();
  if (settlement === 'resolve') h.log.fetch[0].pending.resolve(h.poison('very-late-response'));
  else h.log.fetch[0].pending.reject(h.poison('very-late-error'));
  await old; assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('inline: retained trigger from previous view cannot open or replace current edit', () => {
  const h = harness('inline'); const previous = h.trigger().props.onClick; h.open();
  const before = h.snapshot(); previous(h.poison('old-trigger-event')); assert.deepEqual(h.snapshot(), before);
  h.cancel(); const closed = h.snapshot(); previous(h.poison('older-trigger-event')); assert.deepEqual(h.snapshot(), closed); h.unmount();
});

test('inline: unchanged name event during pending submit still closes normally', async () => {
  const h = harness('inline'); h.open(); const pending = h.submit(); h.edit(0, 'NONUSABLE-NAME-A');
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render(); assert.ok(h.trigger()); assert.equal(h.log.refresh, 1); h.unmount();
});

test('inline: default missing location remains an empty string', async () => {
  const h = harness('inline'); h.render({ id: 'NONUSABLE-CAMERA-DEFAULTS', display_name: 'NONUSABLE-NAME' }); h.open();
  const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.fetch[0].options.body), {
    action: 'rename', id: 'NONUSABLE-CAMERA-DEFAULTS', display_name: 'NONUSABLE-NAME', location_label: ''
  });
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.unmount();
});

for (const kind of ['full', 'inline']) test(kind + ': initial effect cleanup/setup still permits current edit and save', async () => {
  const h = harness(kind); h.replayEffects();
  if (kind === 'inline') h.open();
  h.edit(0, 'NONUSABLE-AFTER-EFFECT-RESTART');
  const pending = h.submit(); assert.equal(h.log.fetch.length, 1);
  assert.equal(JSON.parse(h.log.fetch[0].options.body).display_name, 'NONUSABLE-AFTER-EFFECT-RESTART');
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
  assert.equal(h.log.refresh, 1); if (kind === 'inline') assert.ok(h.trigger()); h.unmount();
});
