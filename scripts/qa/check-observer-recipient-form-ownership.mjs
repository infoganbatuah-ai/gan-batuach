import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Closed synthetic harness: actual TSX module, no source rewriting or private exports.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/observer-action-forms.tsx');
const info = statSync(sourcePath);
assert.ok(info.isFile(), 'regular source file required');
if (process.platform === 'darwin') {
  const rawFlags = execFileSync('/usr/bin/stat', ['-f', '%f', sourcePath], { encoding: 'utf8' }).trim();
  assert.match(rawFlags, /^\d+$/, 'decimal flags required');
  const flags = Number(rawFlags);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0, 'decimal flags required');
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

function harness() {
  let slots = [], cursor = 0, effects = [], mounted = false, key, wrapper, tree;
  let props = { siteId: 'NONUSABLE-SITE-A', recipients: [], devices: [] };
  let form;
  const log = { token: 0, fetch: [], json: 0, reads: [], writes: 0, reset: 0, refresh: 0, formData: 0 };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cell = slots; return [slots[i], value => { log.writes++; cell[i] = typeof value === 'function' ? value(cell[i]) : value; }]; },
    useEffect(fn, deps) { const i = cursor++; if (!(i in slots)) { slots[i] = deps; effects.push(fn); } }
  };
  const neutral = () => null;
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ refresh() { log.refresh++; } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-TOKEN'; } },
    '@/lib/domain/digital-observer/camera-connection-methods': {
      classifyObserverPairingPayload: neutral, connectorTypeForPairing: neutral,
      observerCameraConnectionMethods: [], observerCameraManufacturers: []
    },
    '@/lib/domain/digital-observer/site-templates': { getObserverSiteTemplate: neutral, observerSiteTemplates: [] },
    '@/components/digital-observer/observer-address-fields': { ObserverAddressFields: neutral },
    '@/components/digital-observer/observer-camera-media': { ObserverCameraMedia: neutral },
    '@/components/digital-observer/observer-fcm-push-registration': { ObserverFcmPushRegistration: neutral }
  };
  const exports = {};
  class SyntheticFormData {
    constructor(value) { log.formData++; assert.equal(value, form); this.values = structuredClone(value.values); }
    get(name) { return this.values[name] ?? null; }
    getAll(name) { return this.values[name] || []; }
  }
  const context = vm.createContext({ exports, require(name) {
    assert.ok(Object.hasOwn(imports, name), 'unapproved module: ' + name); return imports[name];
  }, FormData: SyntheticFormData, Error, fetch(path, options) {
    const pending = deferred(); log.fetch.push({ path, options, pending }); return pending.promise;
  } });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 });
  const cleanups = [];
  function nodes(node, predicate, result = []) {
    if (Array.isArray(node)) { for (const child of node) nodes(child, predicate, result); return result; }
    if (!node || typeof node !== 'object') return result;
    if (predicate(node)) result.push(node);
    nodes(node.props?.children, predicate, result); return result;
  }
  function unmount() {
    for (const cleanup of cleanups.splice(0)) cleanup();
    if (form?.element.props.ref) form.element.props.ref.current = null;
    mounted = false;
  }
  function render(next = props) {
    props = next;
    wrapper = exports.ObserverRecipientsDevicesForm(props);
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) {
      slots = []; key = wrapper.key; mounted = true;
      form = { values: {}, reset() { log.reset++; this.values = {}; } };
    }
    cursor = 0; tree = wrapper.type(wrapper.props);
    const found = nodes(tree, n => n.type === 'form'); assert.equal(found.length, 1);
    form.element = found[0]; form.element.props.ref.current = form;
    for (const effect of effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    return form;
  }
  render();
  function draft() { form.values = { display_name: 'NONUSABLE-NAME', relationship_label: 'NONUSABLE-RELATION', destination: 'NONUSABLE-CONTACT', recipient_channels: ['email'], critical: 'on' }; return structuredClone(form.values); }
  function submit(handler = form.element.props.onSubmit) { return handler({ preventDefault() {}, currentTarget: form }); }
  function edit(name, value) { form.values[name] = value; form.element.props.onChange({ currentTarget: form }); }
  function message() {
    render(); const result = nodes(tree, n => typeof n.type === 'function' && n.type.name === 'ResultMessage');
    assert.equal(result.length, 1); return result[0].props.state;
  }
  function packet(index = 0) {
    const json = deferred(); const call = log.fetch[index]; assert.ok(call);
    const response = { get ok() { log.reads.push('ok'); return true; }, json() { log.json++; return json.promise; } };
    call.pending.resolve(response); return json;
  }
  const poison = label => new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } });
  return { log, render, unmount, draft, submit, edit, message, packet, poison, get form() { return form; }, get props() { return props; } };
}

test('unchanged current acknowledgement resets and refreshes once with exact payload', async () => {
  const h = harness(); const values = h.draft(); const pending = h.submit();
  assert.equal(h.log.fetch.length, 1); const request = h.log.fetch[0];
  assert.equal(request.path, '/api/digital-observer/access-settings');
  assert.equal(request.options.method, 'POST'); assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.headers.Authorization, 'Bearer NONUSABLE-TOKEN');
  assert.deepEqual(JSON.parse(request.options.body), { action: 'create_recipient', observer_site_id: 'NONUSABLE-SITE-A',
    display_name: values.display_name, relationship_label: values.relationship_label, destination: values.destination,
    channels: ['email'], receives_critical_alerts: true });
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending;
  assert.equal(h.log.reset, 1); assert.equal(h.log.refresh, 1); assert.equal(h.message().busy, false); h.unmount();
});

test('current duplicate submit prevents native navigation without another API or form read', async () => {
  const h = harness(); h.draft(); const first = h.submit();
  const handler = h.form.element.props.onSubmit;
  let prevented = false;
  await handler({ preventDefault() { prevented = true; }, get currentTarget() { assert.fail('duplicate form read'); } });
  assert.equal(prevented, true, 'current duplicate form must suppress browser default submission');
  assert.equal(h.log.fetch.length, 1); assert.equal(h.log.token, 1); assert.equal(h.log.formData, 1);
  assert.deepEqual(h.log.reads, []);
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await first; h.unmount();
});

const edits = [
  ['display_name', 'NONUSABLE-NEW-NAME'], ['relationship_label', 'NONUSABLE-NEW-RELATION'],
  ['destination', 'NONUSABLE-NEW-CONTACT'], ['recipient_channels', ['sms']],
  ['recipient_channels', ['whatsapp']], ['recipient_channels', ['voice']],
  ['recipient_channels', []], ['critical', null]
];
for (const [field, value] of edits) test('unsent edit survives old ack: ' + field + ':' + JSON.stringify(value), async () => {
  const h = harness(); h.draft(); const pending = h.submit(); h.edit(field, value);
  const latest = structuredClone(h.form.values);
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending;
  assert.deepEqual(h.form.values, latest); assert.equal(h.log.reset, 0); assert.equal(h.log.refresh, 0);
  assert.match(h.message().message, /טרם נשלחו/); assert.equal(h.message().busy, false);
  const next = h.submit(); assert.equal(h.log.fetch.length, 2);
  h.packet(1).resolve({ data: { message: 'NONUSABLE-SAVED-NEW' } }); await next;
  assert.equal(h.log.reset, 1); assert.equal(h.log.refresh, 1); h.unmount();
});

for (const loss of ['site', 'unmount', 'new-request']) for (const stage of ['fetch', 'json']) for (const settlement of ['resolve', 'reject']) {
  test('lost owner is silent: ' + [loss, stage, settlement].join('/'), async () => {
    const h = harness(); h.draft(); const retained = h.form.element.props.onSubmit; const old = h.submit();
    let json;
    if (stage === 'json') { json = h.packet(); await tick(); assert.equal(h.log.json, 1); }
    if (loss === 'unmount') h.unmount();
    else { h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B' }); h.draft(); h.edit('destination', 'NONUSABLE-SITE-B-DRAFT'); }
    let next;
    if (loss === 'new-request') next = h.submit();
    const preserved = structuredClone(h.form.values);
    const baseline = { writes: h.log.writes, token: h.log.token, fetch: h.log.fetch.length,
      json: h.log.json, reads: [...h.log.reads], reset: h.log.reset, refresh: h.log.refresh, formData: h.log.formData };
    await retained(h.poison('retained-event'));
    if (stage === 'fetch') {
      if (settlement === 'reject') h.log.fetch[0].pending.reject(h.poison('fetch-error'));
      else h.log.fetch[0].pending.resolve(h.poison('response'));
    } else if (settlement === 'reject') json.reject(h.poison('json-error'));
    else json.resolve({ get data() { h.log.reads.push('stale-data'); throw Error('poison'); } });
    await old;
    assert.deepEqual({ writes: h.log.writes, token: h.log.token, fetch: h.log.fetch.length,
      json: h.log.json, reads: [...h.log.reads], reset: h.log.reset, refresh: h.log.refresh, formData: h.log.formData }, baseline);
    assert.deepEqual(h.form.values, preserved);
    if (next) { h.packet(1).resolve({ data: { message: 'NONUSABLE-NEW-SAVED' } }); await next;
      assert.equal(h.log.reset, 1); assert.equal(h.log.refresh, 1); }
    h.unmount();
  });
}

for (const failure of ['fetch', 'json', 'http']) test('current failure retains draft and permits explicit retry: ' + failure, async () => {
  const h = harness(); const original = h.draft(); const pending = h.submit();
  if (failure === 'fetch') h.log.fetch[0].pending.reject(new Error('NONUSABLE-FAILURE'));
  if (failure === 'json') h.packet().reject(new Error('NONUSABLE-INVALID-JSON'));
  if (failure === 'http') h.log.fetch[0].pending.resolve({ ok: false, json: async () => ({ error: 'NONUSABLE-HTTP-FAILURE' }) });
  await pending; assert.deepEqual(h.form.values, original); assert.equal(h.log.reset, 0); assert.equal(h.log.refresh, 0);
  assert.ok(h.message().error); assert.equal(h.message().busy, false);
  const retry = h.submit(); assert.equal(h.log.fetch.length, 2);
  h.packet(1).resolve({ data: { message: 'NONUSABLE-RETRY-SAVED' } }); await retry;
  assert.equal(h.log.reset, 1); assert.equal(h.log.refresh, 1); h.unmount();
});

test('same Site list updates preserve uncontrolled form and pending operation', async () => {
  const h = harness(); h.draft(); const pending = h.submit(); const sameForm = h.form;
  h.edit('destination', 'NONUSABLE-UNSENT'); const draft = structuredClone(h.form.values);
  h.render({ ...h.props, recipients: [{ id: 'NONUSABLE-RECIPIENT', display_name: 'NONUSABLE-NAME', channels: [] }],
    devices: [{ id: 'NONUSABLE-DEVICE', active: true, platform: 'web', device_label: 'NONUSABLE-LABEL' }] });
  assert.equal(h.form, sameForm); assert.deepEqual(h.form.values, draft);
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending;
  assert.deepEqual(h.form.values, draft); assert.equal(h.log.reset, 0); assert.equal(h.log.refresh, 0); h.unmount();
});

test('Site change resets action state without carrying draft to next Site', async () => {
  const h = harness(); h.draft(); const pending = h.submit();
  h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B' });
  assert.deepEqual(h.form.values, {}); assert.equal(h.message().busy, false); assert.equal(h.message().message, '');
  h.log.fetch[0].pending.resolve(h.poison('old-response')); await pending;
  assert.equal(h.log.json, 0); assert.deepEqual(h.log.reads, []); h.unmount();
});
