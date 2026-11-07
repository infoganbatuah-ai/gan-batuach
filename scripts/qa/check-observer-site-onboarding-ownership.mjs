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
const address = () => ({ address_query: 'NONUSABLE-ADDRESS-QUERY', city: 'NONUSABLE-CITY', street: 'NONUSABLE-STREET',
  building_number: '1', apartment_number: '', floor_kind: 'floor', floor_number: '', postal_code: 'NONUSABLE-POSTAL',
  address_place_id: 'NONUSABLE-PLACE', address_session_token: 'NONUSABLE-ADDRESS-SESSION', formatted_address: 'NONUSABLE-FORMATTED', address_verification_status: 'unverified' });
const packages = () => [
  { id: 'NONUSABLE-HOME-1', name: 'NONUSABLE-HOME-1', package_type: 'home', monthly_price: 0, camera_limit: 1, recording_retention_hours: 0 },
  { id: 'NONUSABLE-HOME-2', name: 'NONUSABLE-HOME-2', package_type: 'home', monthly_price: 0, camera_limit: 2, recording_retention_hours: 0 },
  { id: 'NONUSABLE-BUSINESS-1', name: 'NONUSABLE-BUSINESS-1', package_type: 'business', monthly_price: 0, camera_limit: 1, recording_retention_hours: 0 },
  { id: 'NONUSABLE-ENTERPRISE-1', name: 'NONUSABLE-ENTERPRISE-1', package_type: 'enterprise', monthly_price: 0, camera_limit: 3, recording_retention_hours: 0 }
];
const templates = [
  { key: 'home', label: 'NONUSABLE-HOME-TEMPLATE', childPrivacyRequired: false, defaultTargets: [] },
  { key: 'custom', label: 'NONUSABLE-CUSTOM-TEMPLATE', childPrivacyRequired: false, defaultTargets: ['person'] },
  { key: 'child_education', label: 'NONUSABLE-CHILD-TEMPLATE', childPrivacyRequired: true, defaultTargets: ['children'] }
];

function harness(type) {
  let props = { packages: packages(), defaultType: type };
  let slots = [], cursor = 0, effects = [], mounted = false, key, tree;
  const log = { requests: [], token: 0, json: 0, reads: [], writes: 0, push: [], refresh: 0 };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], value => { log.writes++; cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(setup) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push({ setup, cleanup: null }); } }
  };
  const neutral = () => null;
  const AddressFields = () => null;
  const allowed = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ push(value) { log.push.push(value); }, refresh() { log.refresh++; } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-TOKEN'; } },
    '@/lib/domain/digital-observer/camera-connection-methods': { observerCameraConnectionMethods: [], observerCameraManufacturers: [],
      classifyObserverPairingPayload: neutral, connectorTypeForPairing: neutral },
    '@/lib/domain/digital-observer/site-templates': { observerSiteTemplates: templates,
      getObserverSiteTemplate(key) { const template = templates.find(item => item.key === key); assert.ok(template, 'unexpected template'); return template; } },
    '@/components/digital-observer/observer-address-fields': { ObserverAddressFields: AddressFields },
    '@/components/digital-observer/observer-camera-media': { ObserverCameraMedia: neutral },
    '@/components/digital-observer/observer-fcm-push-registration': { ObserverFcmPushRegistration: neutral }
  };
  const exports = {};
  const context = vm.createContext({ exports, Error, require(name) { assert.ok(Object.hasOwn(allowed, name), 'unapproved import ' + name); return allowed[name]; },
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
    props = next; const wrapper = exports.ObserverOnboardingWizard(props);
    assert.equal(typeof wrapper.type, 'function'); assert.equal(wrapper.key, props.defaultType ?? 'home');
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; effects = []; mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of effects) if (!effect.cleanup) effect.cleanup = effect.setup();
    return tree;
  }
  function restartEffects() { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.setup(); } }
  function actions() { const group = nodes(n => n.props.className === 'do-wizard-actions')[0]; assert.ok(group); return nodes(n => n.type === 'button', group); }
  function next() { const button = actions().at(-1); assert.equal(button.props.disabled, false); const result = button.props.onClick(); render(); return result; }
  function back() { assert.equal(actions().length, 2); actions()[0].props.onClick(); render(); }
  function submit(handler = actions().at(-1).props.onClick) { return handler(); }
  function addressNode() { const result = nodes(n => n.type === AddressFields); assert.equal(result.length, 1); return result[0]; }
  function setAddress(value = address()) { addressNode().props.onChange(value); render(); }
  function name(value) { const input = nodes(n => n.type === 'input' && n.props.placeholder === ((props.defaultType ?? 'home') === 'home' ? 'הבית שלי' : 'הקלידו שם עסק'))[0]; assert.ok(input); input.props.onChange({ target: { value } }); render(); }
  function keyed(value) { const button = nodes(n => n.type === 'button' && n.key === value)[0]; assert.ok(button, 'missing keyed control ' + value); button.props.onClick(); render(); }
  function selectTemplate(value) { const control = nodes(n => n.type === 'select' && templates.some(t => t.key === n.props.value))[0]; assert.ok(control); control.props.onChange({ target: { value } }); render(); }
  function childPrivacy(checked) { const input = nodes(n => n.type === 'input' && n.props.type === 'checkbox')[0]; assert.ok(input); input.props.onChange({ target: { checked } }); render(); }
  function fieldByType(type, index, value) { const input = nodes(n => n.type === 'input' && n.props.type === type)[index]; assert.ok(input); input.props.onChange({ target: { value } }); render(); }
  function cameraCount(delta) { const button = nodes(n => n.type === 'button' && n.props['aria-label'] === (delta > 0 ? 'הוספה' : 'הפחתה'))[0]; assert.ok(button); button.props.onClick(); render(); }
  function schedule(value) { const control = nodes(n => n.type === 'select')[0]; assert.ok(control); control.props.onChange({ target: { value } }); render(); }
  function packageChoice(value) { const input = nodes(n => n.type === 'input' && n.props.type === 'radio' && n.props.value === value)[0]; assert.ok(input); input.props.onChange(); render(); }
  function currentPackage() { return nodes(n => n.type === 'input' && n.props.type === 'radio' && n.props.checked)[0]?.props.value; }
  function packet(index = 0, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, token: log.token, json: log.json, reads: log.reads, writes: log.writes, push: log.push, refresh: log.refresh }); }
  function state() { const result = nodes(n => typeof n.type === 'function' && n.type.name === 'ResultMessage'); assert.equal(result.length, 1); return copy(result[0].props.state); }
  function effectiveType() { return props.defaultType ?? 'home'; }
  function fillDetails() { name('NONUSABLE-SITE-NAME'); setAddress(); }
  function summary(select = true) {
    if (effectiveType() === 'home') next();
    fillDetails(); next(); next(); if (effectiveType() === 'business') next();
    if (select) packageChoice(effectiveType() === 'home' ? 'NONUSABLE-HOME-1' : 'NONUSABLE-BUSINESS-1');
  }
  render();
  return { log, render, unmount, restartEffects, nodes, actions, next, back, submit, addressNode, setAddress, name, keyed, selectTemplate,
    childPrivacy, fieldByType, cameraCount, schedule, packageChoice, currentPackage, packet, poison, snapshot, state, fillDetails, summary,
    get props() { return props; } };
}

function expectedDefaults(type) { return { name: 'NONUSABLE-SITE-NAME', site_type: type, site_template: type === 'home' ? 'home' : 'custom',
  business_handles_children: false, vision_privacy_mode: 'standard_consent', ...address(), camera_count: 1, branch_count: 1,
  active_days: ['sun', 'mon', 'tue', 'wed', 'thu'], opening_time: '08:00', closing_time: '18:00',
  schedule_mode: type === 'home' ? 'event_only' : 'business_hours', package_id: type === 'home' ? 'NONUSABLE-HOME-1' : 'NONUSABLE-BUSINESS-1',
  monitoring_targets: type === 'home' ? [] : ['person'] }; }

for (const type of ['home', 'business']) {
  test(type + ': current exact payload, duplicate suppression and returned next path', async () => {
    const h = harness(type); h.summary(); const handler = h.actions().at(-1).props.onClick;
    const pending = h.submit(handler); await h.submit(handler); assert.equal(h.log.requests.length, 1); assert.equal(h.log.token, 1);
    const request = h.log.requests[0]; assert.equal(request.path, '/api/digital-observer/onboarding'); assert.equal(request.options.method, 'POST');
    assert.equal(request.options.credentials, 'same-origin'); assert.equal(request.options.headers.Authorization, 'Bearer NONUSABLE-TOKEN');
    assert.deepEqual(JSON.parse(request.options.body), expectedDefaults(type));
    h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.render();
    assert.equal(h.state().message, 'האתר הוקם ותקופת ניסיון של 14 יום נפתחה ללא חיוב.');
    assert.deepEqual(h.log.push, ['/NONUSABLE-NEXT']); assert.equal(h.log.refresh, 1); h.unmount();
  });

  for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'back', 'edit', 'type', 'new-request']) for (const settlement of ['resolve', 'reject']) {
    test(type + ': stale response is quiet ' + [stage, loss, settlement].join('/'), async () => {
      const h = harness(type); h.summary(); const retained = h.actions().at(-1).props.onClick; const old = h.submit(); let json;
      if (stage === 'json') { json = h.packet(); await tick(); assert.equal(h.log.json, 1); }
      if (loss === 'unmount') h.unmount();
      else if (loss === 'type') h.render({ ...h.props, defaultType: type === 'home' ? 'business' : 'home' });
      else if (loss === 'edit') h.packageChoice(type === 'home' ? 'NONUSABLE-HOME-2' : 'NONUSABLE-ENTERPRISE-1');
      else h.back();
      let next; if (loss === 'new-request') { h.next(); next = h.submit(); }
      const before = h.snapshot(); await retained();
      if (stage === 'fetch') {
        if (settlement === 'resolve') h.log.requests[0].pending.resolve(h.poison('old-response'));
        else h.log.requests[0].pending.reject(h.poison('old-error'));
      } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
      else json.reject(h.poison('old-json-error'));
      await old; assert.deepEqual(h.snapshot(), before);
      if (next) {
        await h.submit(); assert.equal(h.log.requests.length, 2, 'old finally cannot unlock current request');
        h.packet(1).resolve({ data: { next: '/NONUSABLE-CURRENT' } }); await next;
        assert.deepEqual(h.log.push, ['/NONUSABLE-CURRENT']); assert.equal(h.log.refresh, 1);
      }
      h.unmount();
    });
  }

  for (const failure of ['fetch', 'json', 'http']) test(type + ': current failure retains draft and permits explicit retry ' + failure, async () => {
    const h = harness(type); h.summary(); const pending = h.submit(); const body = h.log.requests[0].options.body;
    if (failure === 'fetch') h.log.requests[0].pending.reject(new Error('NONUSABLE-FAILURE'));
    if (failure === 'json') h.packet().reject(new Error('NONUSABLE-BAD-JSON'));
    if (failure === 'http') h.packet(0, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
    await pending; h.render(); assert.ok(h.state().error); assert.equal(h.state().busy, false); assert.equal(h.log.refresh, 0); assert.deepEqual(h.log.push, []);
    const retry = h.submit(); assert.equal(h.log.requests[1].options.body, body);
    h.packet(1).resolve({ data: { next: '/NONUSABLE-RETRY' } }); await retry; assert.equal(h.log.refresh, 1); h.unmount();
  });

  test(type + ': same-scope packages reference update keeps step and selected package without new policy', async () => {
    const h = harness(type); h.summary(); const selected = h.currentPackage();
    h.render({ ...h.props, packages: copy(h.props.packages).reverse() }); assert.equal(h.currentPackage(), selected);
    h.render({ ...h.props, packages: [] }); assert.equal(h.actions().at(-1).props.disabled, false);
    const pending = h.submit(); assert.equal(JSON.parse(h.log.requests[0].options.body).package_id, selected);
    h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.unmount();
  });

  test(type + ': cleanup/setup fences old request and keeps mounted workflow usable', async () => {
    const h = harness(type); h.summary(); const old = h.submit(); h.restartEffects(); const next = h.submit();
    assert.equal(h.log.requests.length, 2); const before = h.snapshot();
    h.log.requests[0].pending.resolve(h.poison('effect-old-response')); await old; assert.deepEqual(h.snapshot(), before);
    h.packet(1).resolve({ data: { next: '/NONUSABLE-AFTER-EFFECT' } }); await next; assert.equal(h.log.refresh, 1); h.unmount();
  });

  test(type + ': old details/address/control callbacks cannot mutate later summary context', async () => {
    const h = harness(type); if (type === 'home') h.next(); h.fillDetails();
    const oldAddress = h.addressNode().props.onChange;
    const oldInputs = h.nodes(n => (n.type === 'input' || n.type === 'select') && typeof n.props.onChange === 'function').map(n => n.props.onChange);
    const oldDays = h.nodes(n => n.type === 'button' && ['sun', 'mon', 'tue'].includes(n.key)).map(n => n.props.onClick);
    h.next(); h.next(); if (type === 'business') h.next(); h.packageChoice(type === 'home' ? 'NONUSABLE-HOME-1' : 'NONUSABLE-BUSINESS-1');
    const before = h.snapshot(); oldAddress(h.poison('old-address'));
    for (const callback of oldInputs) callback({ target: { value: 'NONUSABLE-OLD-CONTROL', checked: true } });
    for (const callback of oldDays) callback();
    assert.deepEqual(h.snapshot(), before);
    const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.requests[0].options.body), expectedDefaults(type));
    h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.unmount();
  });
}

test('home: target, address, camera count, schedule and package edit paths retain exact submitted semantics', async () => {
  const h = harness('home'); h.keyed('family'); h.keyed('family'); h.keyed('animal'); h.next(); h.fillDetails();
  h.next(); h.cameraCount(-1); h.cameraCount(1); h.schedule('night_only'); h.next(); h.packageChoice('NONUSABLE-HOME-2');
  const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.requests[0].options.body), {
    ...expectedDefaults('home'), camera_count: 2, schedule_mode: 'night_only', package_id: 'NONUSABLE-HOME-2', monitoring_targets: ['animal']
  });
  h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.unmount();
});

test('business: compound template/privacy/address and weekday edits remain atomic', async () => {
  const h = harness('business'); h.fillDetails(); h.selectTemplate('child_education');
  assert.equal(h.addressNode().props.value.business_handles_children, true);
  assert.equal(h.addressNode().props.value.vision_privacy_mode, 'skeleton_only');
  h.childPrivacy(false); assert.equal(h.addressNode().props.value.site_template, 'custom');
  assert.equal(h.addressNode().props.value.vision_privacy_mode, 'standard_consent');
  h.childPrivacy(true); assert.equal(h.addressNode().props.value.site_template, 'child_education');
  h.keyed('mon'); h.keyed('fri'); h.fieldByType('number', 0, '3'); h.fieldByType('time', 0, '09:00'); h.fieldByType('time', 1, '20:00');
  h.next(); h.cameraCount(1); h.schedule('24_7'); h.next(); h.keyed('person'); h.next(); h.packageChoice('NONUSABLE-ENTERPRISE-1');
  const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.requests[0].options.body), {
    ...expectedDefaults('business'), site_template: 'child_education', business_handles_children: true, vision_privacy_mode: 'skeleton_only',
    branch_count: 3, active_days: ['sun', 'tue', 'wed', 'thu', 'fri'], opening_time: '09:00', closing_time: '20:00',
    camera_count: 2, schedule_mode: '24_7', monitoring_targets: ['children', 'person'], package_id: 'NONUSABLE-ENTERPRISE-1'
  });
  h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.unmount();
});

test('empty package preserves existing null serialization without changing UI validation', async () => {
  const h = harness('home'); h.summary(false); assert.equal(h.actions().at(-1).props.disabled, true);
  const pending = h.submit(); assert.equal(JSON.parse(h.log.requests[0].options.body).package_id, null);
  h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.unmount();
});

test('undefined and explicit home share effective scope and preserve current home draft', async () => {
  const h = harness(undefined); h.summary(); h.render({ ...h.props, defaultType: 'home' });
  assert.equal(h.currentPackage(), 'NONUSABLE-HOME-1'); const pending = h.submit();
  assert.deepEqual(JSON.parse(h.log.requests[0].options.body), expectedDefaults('home'));
  h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.unmount();
});

test('explicit defaultType change starts correct business defaults without stale home fields', async () => {
  const h = harness('home'); h.summary(); h.render({ ...h.props, defaultType: 'business' });
  assert.equal(h.actions().length, 1); assert.deepEqual(h.state(), { busy: false, error: '', message: '' });
  const initial = h.addressNode().props.value; assert.equal(initial.site_type, 'business'); assert.equal(initial.name, ''); assert.equal(initial.package_id, '');
  assert.equal(initial.schedule_mode, 'business_hours'); assert.deepEqual(copy(initial.monitoring_targets), ['person']);
  h.summary(); const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.requests[0].options.body), expectedDefaults('business'));
  h.packet().resolve({ data: { next: '/NONUSABLE-NEXT' } }); await pending; h.unmount();
});
