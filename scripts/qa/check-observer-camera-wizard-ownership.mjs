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
  const value = execFileSync('/usr/bin/stat', ['-f', '%f', sourcePath], { encoding: 'utf8' }).trim();
  assert.match(value, /^\d+$/); const flags = Number(value);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, 'refuse dataless source');
}
const source = readFileSync(sourcePath, 'utf8');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const assessment = () => ({ recommendation: 'DIRECT_CONNECTION_AVAILABLE', preferredMethod: 'DIRECT_SECURE', adapterType: 'NONUSABLE-ADAPTER',
  productionEligible: false, reasonCodes: [], missingRequirements: [], securityNotes: [] });

function harness() {
  let props = { initialSiteId: 'NONUSABLE-SITE-A', sites: [
    { id: 'NONUSABLE-SITE-A', name: 'NONUSABLE-SITE-A', site_type: 'home' },
    { id: 'NONUSABLE-SITE-B', name: 'NONUSABLE-SITE-B', site_type: 'business' }
  ] };
  let slots = [], effects = new Map(), cursor = 0, mounted = false, key, tree;
  const log = { requests: [], token: 0, writes: 0, json: 0, reads: [], push: [], refresh: 0,
    images: [], detections: [], classify: 0, connector: 0, detector: 0 };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], value => { log.writes++; cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(setup, deps) {
      const i = cursor++; const previous = effects.get(i);
      if (!previous || deps.length !== previous.deps.length || deps.some((dep, at) => !Object.is(dep, previous.deps[at])))
        effects.set(i, { setup, deps, cleanup: previous?.cleanup, pending: true });
    }
  };
  const neutral = () => null;
  const methodKeys = ['network_discovery', 'recorder', 'manufacturer_app', 'manual_network', 'qr_scan', 'secure_gateway', 'demo'];
  const methodTypes = ['onvif', 'dvr', 'vendor_cloud', 'rtsp', 'vendor_cloud', 'gateway', 'demo'];
  const methods = methodKeys.map((key, i) => ({ key, connectorType: methodTypes[i], label: 'NONUSABLE-' + key,
    shortDescription: 'NONUSABLE-DESCRIPTION', badge: 'NONUSABLE-BADGE', requiredItems: [], steps: [] }));
  class SyntheticDetector {
    constructor(options) { log.detector++; assert.deepEqual(copy(options), { formats: ['qr_code'] }); }
    detect(bitmap) { const pending = deferred(); log.detections.push({ bitmap, pending }); return pending.promise; }
  }
  const window = { BarcodeDetector: SyntheticDetector };
  const allowed = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ push(value) { log.push.push(value); }, refresh() { log.refresh++; } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-TOKEN'; } },
    '@/lib/domain/digital-observer/camera-connection-methods': {
      observerCameraConnectionMethods: methods, observerCameraManufacturers: [{ value: 'unknown', label: 'NONUSABLE-UNKNOWN' }, { value: 'NONUSABLE-VENDOR', label: 'NONUSABLE-VENDOR' }],
      classifyObserverPairingPayload(raw) { log.classify++; assert.equal(raw, 'NONUSABLE-QR'); return 'vendor_code'; },
      connectorTypeForPairing(method, kind) { log.connector++; assert.equal(method, 'qr_scan'); assert.equal(kind, 'vendor_code'); return 'vendor_cloud'; }
    },
    '@/lib/domain/digital-observer/site-templates': { getObserverSiteTemplate: neutral, observerSiteTemplates: [] },
    '@/components/digital-observer/observer-address-fields': { ObserverAddressFields: neutral },
    '@/components/digital-observer/observer-camera-media': { ObserverCameraMedia: neutral },
    '@/components/digital-observer/observer-fcm-push-registration': { ObserverFcmPushRegistration: neutral }
  };
  const exports = {};
  const context = vm.createContext({ exports, Error, window, require(name) { assert.ok(Object.hasOwn(allowed, name), 'unapproved import ' + name); return allowed[name]; },
    fetch(path, options) { const pending = deferred(); log.requests.push({ path, options, pending }); return pending.promise; },
    createImageBitmap(file) { assert.equal(file.name, 'NONUSABLE-FILE'); const pending = deferred(); log.images.push({ pending }); return pending.promise; }
  });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 });
  function visit(predicate, node, result) {
    if (Array.isArray(node)) { for (const child of node) visit(predicate, child, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    visit(predicate, node.props?.children, result);
  }
  function nodes(predicate, node = tree) { const result = []; visit(predicate, node, result); return result; }
  function unmount() { for (const effect of effects.values()) effect.cleanup?.(); mounted = false; }
  function render(next = props) {
    props = next; const wrapper = exports.ObserverCameraWizard(props);
    assert.equal(typeof wrapper.type, 'function'); assert.equal(wrapper.key, props.initialSiteId ?? '');
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; effects = new Map(); key = wrapper.key; mounted = true; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of effects.values()) if (effect.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.setup(); }
    return tree;
  }
  function restartEffects() { for (const effect of effects.values()) { effect.cleanup?.(); effect.cleanup = effect.setup(); } }
  function actionButtons() { const action = nodes(n => n.props.className === 'do-wizard-actions')[0]; assert.ok(action); return nodes(n => n.type === 'button', action); }
  function next() { const button = actionButtons()[0]; assert.equal(button.props.disabled, false); const result = button.props.onClick(); render(); return result; }
  function back() { const button = actionButtons()[1]; assert.ok(button); button.props.onClick(); render(); }
  function submit(handler = actionButtons()[0].props.onClick) { return handler(); }
  function edit(index, value) { const control = nodes(n => (n.type === 'input' && n.props.type !== 'file') || n.type === 'select')[index]; assert.ok(control); control.props.onChange({ target: { value } }); render(); }
  function choose(method) { const button = nodes(n => n.type === 'button' && n.key === method)[0]; assert.ok(button); button.props.onClick(); render(); }
  function scan() { const input = nodes(n => n.type === 'input' && n.props.type === 'file')[0]; assert.ok(input); input.props.onChange({ target: { files: [{ name: 'NONUSABLE-FILE' }] } }); render(); }
  function packet(index, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  async function reply(index, data) { packet(index).resolve({ data }); await tick(); }
  function bitmap(index, failClose = false) { const value = { closes: 0, close() { this.closes++; if (failClose) throw Error('NONUSABLE-CLOSE-FAILURE'); } };
    assert.ok(log.images[index]); log.images[index].pending.resolve(value); return value; }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, token: log.token, writes: log.writes, json: log.json, reads: log.reads,
    push: log.push, refresh: log.refresh, images: log.images.length, detections: log.detections.length,
    classify: log.classify, connector: log.connector, detector: log.detector }); }
  function walkText(node) { if (Array.isArray(node)) return node.map(walkText).join(' '); if (typeof node === 'string') return node;
    if (!node || typeof node !== 'object') return ''; return walkText(node.props?.children); }
  function text() { return walkText(tree); }
  function state() { const result = nodes(n => typeof n.type === 'function' && n.type.name === 'ResultMessage'); assert.equal(result.length, 1); return copy(result[0].props.state); }
  async function summary() {
    next(); edit(1, 'NONUSABLE-CAMERA-NAME'); await tick(); assert.equal(log.requests.length, 1);
    await reply(0, { assessment: assessment() }); assert.equal(log.requests.length, 2);
    await reply(1, { message: 'NONUSABLE-ASSESSMENT-SAVED' }); render(); next(); next();
  }
  render();
  return { log, render, unmount, restartEffects, nodes, next, back, submit, edit, choose, scan, packet, reply, bitmap, poison,
    snapshot, text, state, summary, actionButtons, disableDetector() { window.BarcodeDetector = undefined; }, get props() { return props; } };
}

test('current exact create/attach and navigation, duplicate submit sends one create', async () => {
  const h = harness(); await h.summary(); const handler = h.actionButtons()[0].props.onClick;
  const pending = h.submit(handler); await h.submit(handler); assert.equal(h.log.requests.length, 3);
  const create = h.log.requests[2]; assert.equal(create.path, '/api/digital-observer/cameras');
  assert.equal(create.options.method, 'POST'); assert.equal(create.options.credentials, 'same-origin'); assert.equal(create.options.headers.Authorization, 'Bearer NONUSABLE-TOKEN');
  assert.deepEqual(JSON.parse(create.options.body), { action: 'create', observer_site_id: 'NONUSABLE-SITE-A', display_name: 'NONUSABLE-CAMERA-NAME',
    location_label: '', pairing_method: 'network_discovery', connector_type: 'onvif', connector_provider: 'unknown', pairing_payload_kind: 'unknown',
    monitoring_targets: ['person', 'children', 'animal', 'known_faces', 'entry_exit', 'after_hours', 'camera_obstruction'], preview_scene: null });
  await h.reply(2, { camera: { id: 'NONUSABLE-CREATED' }, message: 'NONUSABLE-CREATED-MESSAGE' });
  assert.deepEqual(JSON.parse(h.log.requests[3].options.body), { action: 'attach_source', observer_site_id: 'NONUSABLE-SITE-A', camera_source_id: 'NONUSABLE-CREATED' });
  await h.reply(3, { message: 'NONUSABLE-ATTACHED' }); await pending; h.render();
  assert.equal(h.state().message, 'NONUSABLE-CREATED-MESSAGE'); assert.equal(h.log.refresh, 1);
  assert.deepEqual(h.log.push, ['/digital-observer/cameras?site=NONUSABLE-SITE-A&camera=NONUSABLE-CREATED']); h.unmount();
});

for (const stage of ['create-fetch', 'create-json', 'attach-fetch', 'attach-json']) for (const loss of ['unmount', 'back', 'site', 'provider', 'prop', 'new-save', 'exit']) for (const settlement of ['resolve', 'reject']) {
  test('save stale ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); await h.summary(); const retained = h.actionButtons()[0].props.onClick; const old = h.submit();
    let index = 2, json;
    if (stage.startsWith('attach')) { await h.reply(2, { camera: { id: 'NONUSABLE-OLD-CREATED' }, message: 'NONUSABLE-OLD' }); index = 3; }
    if (stage.endsWith('json')) { json = h.packet(index); await tick(); }
    if (loss === 'unmount') h.unmount();
    else if (loss === 'prop') h.render({ ...h.props, initialSiteId: 'NONUSABLE-SITE-B' });
    else {
      h.back();
      if (loss === 'site' || loss === 'provider') { h.back(); h.edit(loss === 'site' ? 0 : 3, loss === 'site' ? 'NONUSABLE-SITE-B' : 'NONUSABLE-VENDOR'); }
      if (loss === 'exit') { h.back(); h.back(); h.back(); }
    }
    let next;
    if (loss === 'new-save') { h.next(); next = h.submit(); }
    await tick(); const currentIndex = h.log.requests.length - 1; const before = h.snapshot(); await retained();
    if (stage.endsWith('fetch')) {
      if (settlement === 'resolve') h.log.requests[index].pending.resolve(h.poison('old-response'));
      else h.log.requests[index].pending.reject(h.poison('old-fetch-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-json-error'));
    await old; assert.deepEqual(h.snapshot(), before);
    if (next) {
      await h.submit(); assert.equal(h.log.requests.length, before.requests, 'old finally cannot unlock current save');
      await h.reply(currentIndex, { camera: { id: 'NONUSABLE-NEW-CREATED' }, message: 'NONUSABLE-NEW' });
      await h.reply(currentIndex + 1, { message: 'NONUSABLE-NEW-ATTACHED' }); await next; assert.equal(h.log.refresh, 1);
    }
    h.unmount();
  });
}

for (const stage of ['create', 'attach']) for (const failure of ['reject', 'json', 'http']) test('current save failure and explicit retry ' + stage + '/' + failure, async () => {
  const h = harness(); await h.summary(); const pending = h.submit(); let index = 2;
  if (stage === 'attach') { await h.reply(2, { camera: { id: 'NONUSABLE-CREATED' }, message: 'NONUSABLE-CREATED' }); index = 3; }
  if (failure === 'reject') h.log.requests[index].pending.reject(new Error('NONUSABLE-FAILURE'));
  else if (failure === 'json') h.packet(index, false).reject(new Error('NONUSABLE-JSON-FAILURE'));
  else h.packet(index, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
  await pending; h.render(); assert.ok(h.state().error); assert.equal(h.log.refresh, 0); assert.deepEqual(h.log.push, []);
  const retryIndex = h.log.requests.length; const retry = h.submit();
  await h.reply(retryIndex, { camera: { id: 'NONUSABLE-RETRY' }, message: 'NONUSABLE-RETRY' });
  await h.reply(retryIndex + 1, { message: 'NONUSABLE-ATTACHED' }); await retry; assert.equal(h.log.refresh, 1); h.unmount();
});

test('same-scope site-list update preserves local selected Site and draft', () => {
  const h = harness(); h.next(); h.edit(0, 'NONUSABLE-SITE-B'); h.edit(1, 'NONUSABLE-DRAFT');
  h.render({ ...h.props, sites: [...h.props.sites].reverse() });
  const controls = h.nodes(n => (n.type === 'input' && n.props.type !== 'file') || n.type === 'select');
  assert.equal(controls[0].props.value, 'NONUSABLE-SITE-B'); assert.equal(controls[1].props.value, 'NONUSABLE-DRAFT'); h.unmount();
});

test('effect cleanup/setup leaves current context usable', async () => {
  const h = harness(); h.restartEffects(); await h.summary(); const pending = h.submit();
  await h.reply(2, { camera: { id: 'NONUSABLE-CREATED' }, message: 'NONUSABLE-CREATED' }); await h.reply(3, {}); await pending;
  assert.equal(h.log.refresh, 1); h.unmount();
});

for (const stage of ['fetch', 'json', 'save-fetch', 'save-json']) for (const loss of ['back', 'site', 'provider', 'unmount']) for (const settlement of ['resolve', 'reject']) {
  test('assessment stale ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); h.next(); await tick(); let index = 0, json;
    if (stage.startsWith('save')) { await h.reply(0, { assessment: assessment() }); index = 1; }
    if (stage.endsWith('json')) { json = h.packet(index); await tick(); }
    if (loss === 'unmount') h.unmount(); else if (loss === 'back') h.back(); else h.edit(loss === 'site' ? 0 : 3, loss === 'site' ? 'NONUSABLE-SITE-B' : 'NONUSABLE-VENDOR');
    await tick(); const before = h.snapshot();
    if (stage.endsWith('fetch') || stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[index].pending.resolve(h.poison('old-assessment-response'));
      else h.log.requests[index].pending.reject(h.poison('old-assessment-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-assessment-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-assessment-json-error'));
    await tick(); assert.deepEqual(h.snapshot(), before); h.unmount();
  });
}

test('name-only draft edit does not cancel or duplicate current assessment', async () => {
  const h = harness(); h.next(); await tick(); h.edit(1, 'NONUSABLE-NAME-CHANGE'); await tick();
  assert.equal(h.log.requests.length, 1); await h.reply(0, { assessment: assessment() });
  assert.deepEqual(JSON.parse(h.log.requests[1].options.body), { action: 'save', observer_site_id: 'NONUSABLE-SITE-A', system_kind: 'ONVIF',
    connector_type: 'onvif', connector_provider: 'unknown', pairing_method: 'network_discovery', pairing_payload_kind: 'unknown', mappings: [] });
  await h.reply(1, {}); h.render(); assert.equal(h.actionButtons()[0].props.disabled, false); h.unmount();
});

for (const stage of ['bitmap', 'detect']) for (const loss of ['new-scan', 'site', 'method', 'back', 'unmount', 'prop']) for (const settlement of ['resolve', 'reject']) {
  test('QR stale ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); h.scan(); let acquired;
    if (stage === 'detect') { acquired = h.bitmap(0); await tick(); assert.equal(h.log.detections.length, 1); }
    if (loss === 'new-scan') h.scan();
    else if (loss === 'site') h.edit(0, 'NONUSABLE-SITE-B');
    else if (loss === 'method') { h.back(); h.choose('recorder'); }
    else if (loss === 'back') h.back();
    else if (loss === 'prop') h.render({ ...h.props, initialSiteId: 'NONUSABLE-SITE-B' });
    else h.unmount();
    await tick(); const before = h.snapshot();
    if (stage === 'bitmap') {
      if (settlement === 'resolve') acquired = h.bitmap(0);
      else h.log.images[0].pending.reject(h.poison('old-bitmap-error'));
    } else if (settlement === 'resolve') h.log.detections[0].pending.resolve(h.poison('old-codes'));
    else h.log.detections[0].pending.reject(h.poison('old-detect-error'));
    await tick(); assert.deepEqual(h.snapshot(), before); if (acquired) assert.equal(acquired.closes, 1);
    if (loss === 'new-scan') {
      const fresh = h.bitmap(1); await tick(); const index = h.log.detections.length - 1;
      h.log.detections[index].pending.resolve([{ rawValue: 'NONUSABLE-QR' }]); await tick(); h.render();
      assert.equal(fresh.closes, 1); assert.equal(h.log.classify, 1); assert.match(h.text(), /הקוד זוהה/);
    }
    h.unmount();
  });
}

test('composite first-step QR choice and step2 scan remains usable and classification starts correct assessment', async () => {
  const h = harness(); h.scan(); assert.equal(h.log.images.length, 1); const image = h.bitmap(0); await tick();
  h.log.detections[0].pending.resolve([{ rawValue: 'NONUSABLE-QR' }]); await tick(); h.render(); await tick();
  assert.equal(image.closes, 1); assert.equal(h.log.classify, 1); assert.equal(h.log.connector, 1); assert.match(h.text(), /הקוד זוהה/);
  const request = h.log.requests.at(-1); assert.deepEqual(JSON.parse(request.options.body), { action: 'assess_new', observer_site_id: 'NONUSABLE-SITE-A',
    connector_type: 'vendor_cloud', connector_provider: 'unknown', pairing_method: 'qr_scan', pairing_payload_kind: 'vendor_code' }); h.unmount();
});

test('QR no-code result closes exactly once and does not classify', async () => {
  const h = harness(); h.scan(); const image = h.bitmap(0); await tick(); h.log.detections[0].pending.resolve([]); await tick(); h.render();
  assert.equal(image.closes, 1); assert.equal(h.log.classify, 0); assert.match(h.text(), /לא נמצא קוד/); h.unmount();
});

test('unsupported QR detector does not acquire bitmap', () => {
  const h = harness(); h.disableDetector(); h.scan(); assert.equal(h.log.images.length, 0); assert.match(h.text(), /אינו תומך/); h.unmount();
});

test('current bitmap failure reports failure without detector call', async () => {
  const h = harness(); h.scan(); h.log.images[0].pending.reject(new Error('NONUSABLE-BITMAP-FAILURE')); await tick(); h.render();
  assert.equal(h.log.detections.length, 0); assert.match(h.text(), /לא ניתן לקרוא/); h.unmount();
});

test('current detect rejection closes acquired bitmap exactly once', async () => {
  const h = harness(); h.scan(); const image = h.bitmap(0); await tick(); h.log.detections[0].pending.reject(new Error('NONUSABLE-DETECT-FAILURE'));
  await tick(); h.render(); assert.equal(image.closes, 1); assert.match(h.text(), /לא ניתן לקרוא/); h.unmount();
});

test('bitmap close failure is best effort once and cannot overwrite valid scan', async () => {
  const h = harness(); h.scan(); const image = h.bitmap(0, true); await tick(); h.log.detections[0].pending.resolve([{ rawValue: 'NONUSABLE-QR' }]);
  await tick(); h.render(); assert.equal(image.closes, 1); assert.match(h.text(), /הקוד זוהה/); assert.doesNotMatch(h.text(), /לא ניתן לקרוא/); h.unmount();
});

test('retained QR input from old step cannot read event or acquire another image', async () => {
  const h = harness(); h.scan(); const retained = h.nodes(n => n.type === 'input' && n.props.type === 'file')[0].props.onChange;
  h.back(); await tick(); const before = h.snapshot(); retained(h.poison('old-file-event'));
  const image = h.bitmap(0); await tick(); assert.equal(image.closes, 1); assert.deepEqual(h.snapshot(), before); h.unmount();
});

for (const stage of ['assessment', 'save']) test('current assessment error clears busy and next explicit context works ' + stage, async () => {
  const h = harness(); h.next(); h.edit(1, 'NONUSABLE-NAME'); await tick(); let index = 0;
  if (stage === 'save') { await h.reply(0, { assessment: assessment() }); index = 1; }
  h.log.requests[index].pending.reject(new Error('NONUSABLE-ASSESSMENT-FAILURE')); await tick(); h.render();
  assert.match(h.text(), /NONUSABLE-ASSESSMENT-FAILURE/);
  h.edit(0, 'NONUSABLE-SITE-B'); await tick(); const current = h.log.requests.length - 1;
  await h.reply(current, { assessment: assessment() }); await h.reply(current + 1, {}); h.render();
  assert.equal(h.actionButtons()[0].props.disabled, false); h.unmount();
});

test('repeat same QR classification does not strand unchanged assessment dependencies', async () => {
  const h = harness(); h.scan(); h.bitmap(0); await tick(); h.log.detections[0].pending.resolve([{ rawValue: 'NONUSABLE-QR' }]);
  await tick(); h.render(); await tick(); const current = h.log.requests.length - 1;
  h.scan(); h.bitmap(1); await tick(); h.log.detections[1].pending.resolve([{ rawValue: 'NONUSABLE-QR' }]);
  await tick(); h.render(); await tick(); assert.equal(h.log.requests.length - 1, current);
  await h.reply(current, { assessment: assessment() });
  assert.equal(JSON.parse(h.log.requests[current + 1].options.body).action, 'save');
  await h.reply(current + 1, {}); h.render(); assert.match(h.text(), /הקוד זוהה/); h.unmount();
});
