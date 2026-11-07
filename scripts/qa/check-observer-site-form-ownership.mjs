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
const definitions = {
  rule: { exported: 'ObserverRuleForm', path: '/api/digital-observer/watch-requests', reset: 1,
    draft: { title: 'NONUSABLE-TITLE', camera_source_id: 'NONUSABLE-CAMERA-A', description: 'NONUSABLE-DESCRIPTION',
      watch_type: 'custom_text_instruction', priority: '8', schedule_mode: 'night_only' },
    expected: { action: 'create', observer_site_id: 'NONUSABLE-SITE-A', title: 'NONUSABLE-TITLE', camera_source_id: 'NONUSABLE-CAMERA-A',
      description: 'NONUSABLE-DESCRIPTION', watch_type: 'custom_text_instruction', priority: 8, schedule_mode: 'night_only' } },
  person: { exported: 'ObserverKnownPersonForm', path: '/api/digital-observer/known-people', reset: 1,
    draft: { display_name: 'NONUSABLE-PERSON', relationship_label: 'NONUSABLE-RELATION', consent: 'on', notify: 'on' },
    expected: { action: 'create', observer_site_id: 'NONUSABLE-SITE-A', display_name: 'NONUSABLE-PERSON',
      relationship_label: 'NONUSABLE-RELATION', consent_confirmed: true, notify_on_detection: true } },
  settings: { exported: 'ObserverSettingsForm', path: '/api/digital-observer/settings', reset: 0,
    draft: { schedule_mode: 'custom_schedule', quiet_start: '21:45', quiet_end: '07:15', in_app: 'on', email: 'on', push: 'on',
      sms: 'on', whatsapp: 'on', monitoring_consent: 'on', safe_action_consent: 'on', model_improvement_consent: 'on' },
    expected: { observer_site_id: 'NONUSABLE-SITE-A', schedule_mode: 'custom_schedule', quiet_start: '21:45', quiet_end: '07:15',
      in_app: true, email: true, push: true, sms: true, whatsapp: true, monitoring_consent: true, safe_action_consent: true,
      model_improvement_consent: true } }
};

// Only these three actual public wrappers/inners run. Other exports are never invoked.
function harness(kind) {
  const definition = definitions[kind];
  let props = { siteId: 'NONUSABLE-SITE-A', cameras: [{ id: 'NONUSABLE-CAMERA-A', display_name: 'NONUSABLE-CAMERA' }], channels: [] };
  let slots = [], cursor = 0, effectSlots = [], mounted = false, key, tree, form;
  const log = { token: 0, fetch: [], json: 0, reads: [], writes: 0, refresh: 0, reset: 0,
    formData: 0, defaults: 0, eventReads: 0, cleared: 0 };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], value => { log.writes++; cells[i] = typeof value === 'function' ? value(cells[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effectSlots.push({ setup: fn, cleanup: null }); } }
  };
  const neutral = () => null;
  const allowed = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ refresh() { log.refresh++; } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-TOKEN'; } },
    '@/lib/domain/digital-observer/camera-connection-methods': { classifyObserverPairingPayload: neutral, connectorTypeForPairing: neutral,
      observerCameraConnectionMethods: [], observerCameraManufacturers: [] },
    '@/lib/domain/digital-observer/site-templates': { getObserverSiteTemplate: neutral, observerSiteTemplates: [] },
    '@/components/digital-observer/observer-address-fields': { ObserverAddressFields: neutral },
    '@/components/digital-observer/observer-camera-media': { ObserverCameraMedia: neutral },
    '@/components/digital-observer/observer-fcm-push-registration': { ObserverFcmPushRegistration: neutral }
  };
  class SyntheticFormData {
    constructor(target) { log.formData++; assert.equal(target, form); this.values = copy(target.values); }
    get(name) { return this.values[name] ?? null; }
  }
  const exports = {};
  const context = vm.createContext({ exports, Error, FormData: SyntheticFormData, require(name) {
    assert.ok(Object.hasOwn(allowed, name), 'unapproved import: ' + name); return allowed[name];
  }, fetch(path, options) { const pending = deferred(); log.fetch.push({ path, options, pending }); return pending.promise; } });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 });
  function visit(predicate, node, result) {
    if (Array.isArray(node)) { for (const child of node) visit(predicate, child, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    visit(predicate, node.props?.children, result);
  }
  function nodes(predicate, node = tree) { const result = []; visit(predicate, node, result); return result; }
  function controls() { return nodes(n => n.type === 'input' || n.type === 'select' || n.type === 'textarea'); }
  function initialValues() {
    const values = {};
    for (const control of controls()) {
      const p = control.props;
      if (p.type === 'checkbox') { if (p.defaultChecked) values[p.name] = 'on'; }
      else if (p.defaultValue !== undefined) values[p.name] = String(p.defaultValue);
      else if (control.type === 'select') values[p.name] = nodes(n => n.type === 'option', control)[0]?.props.value ?? '';
      else values[p.name] = '';
    }
    return values;
  }
  function unmount() {
    for (const effect of effectSlots) if (effect.cleanup) effect.cleanup();
    if (form?.element.props.ref) form.element.props.ref.current = null;
    mounted = false;
  }
  function render(next = props) {
    props = next; const wrapper = exports[definition.exported](props);
    assert.equal(typeof wrapper.type, 'function'); assert.equal(wrapper.key, props.siteId);
    if (mounted && key !== wrapper.key) unmount();
    const fresh = !mounted;
    if (fresh) { slots = []; effectSlots = []; mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    const forms = nodes(n => n.type === 'form'); assert.equal(forms.length, 1);
    if (fresh) {
      const defaults = initialValues();
      form = { defaults, values: copy(defaults), reset() { log.reset++; this.values = copy(this.defaults); } };
    }
    form.element = forms[0]; form.element.props.ref.current = form;
    for (const effect of effectSlots) if (!effect.cleanup) effect.cleanup = effect.setup();
    return form;
  }
  function restartEffects() { for (const effect of effectSlots) { if (effect.cleanup) effect.cleanup(); effect.cleanup = effect.setup(); } }
  function draft() { form.values = copy(definition.draft); return copy(form.values); }
  function edit(name, value) {
    assert.ok(controls().some(n => n.props.name === name), 'missing input ' + name);
    if (value === false) delete form.values[name]; else form.values[name] = value === true ? 'on' : value;
    form.element.props.onChange({ currentTarget: form });
  }
  function submit(handler = form.element.props.onSubmit) {
    let current = form;
    const event = { preventDefault() { log.defaults++; },
      get currentTarget() { log.eventReads++; return current; },
      set currentTarget(value) { current = value; log.cleared++; } };
    // Match React executeDispatch: it does not await the returned Promise.
    const pending = handler(event); event.currentTarget = null; return pending;
  }
  function state() {
    const result = nodes(n => typeof n.type === 'function' && n.type.name === 'ResultMessage');
    assert.equal(result.length, 1); return copy(result[0].props.state);
  }
  function packet(index = 0, ok = true) {
    const json = deferred(); assert.ok(log.fetch[index]);
    log.fetch[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json;
  }
  function poison(label) { return new Proxy({}, { get(_, property) {
    if (property === 'then') return undefined;
    log.reads.push(label + ':' + String(property)); throw Error('poison ' + label);
  } }); }
  function snapshot() { return copy({ token: log.token, fetch: log.fetch.length, json: log.json, reads: log.reads, writes: log.writes,
    refresh: log.refresh, reset: log.reset, formData: log.formData, defaults: log.defaults, eventReads: log.eventReads, cleared: log.cleared }); }
  render();
  return { definition, log, render, unmount, restartEffects, controls, draft, edit, submit, state, packet, poison, snapshot,
    get form() { return form; }, get props() { return props; } };
}

for (const kind of Object.keys(definitions)) {
  test(kind + ': actual React currentTarget clearing does not turn saved result into failure', async () => {
    const h = harness(kind); h.draft(); const pending = h.submit();
    assert.equal(h.log.cleared, 1); assert.equal(h.log.eventReads, 1);
    const request = h.log.fetch[0]; assert.equal(request.path, h.definition.path);
    assert.equal(request.options.method, 'POST'); assert.equal(request.options.credentials, 'same-origin');
    assert.equal(request.options.headers.Authorization, 'Bearer NONUSABLE-TOKEN');
    assert.deepEqual(JSON.parse(request.options.body), h.definition.expected);
    h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
    assert.equal(h.state().error, ''); assert.equal(h.state().message, 'NONUSABLE-SAVED');
    assert.equal(h.log.eventReads, 1); assert.equal(h.log.reset, h.definition.reset); assert.equal(h.log.refresh, 1); h.unmount();
  });

  test(kind + ': active duplicate suppresses native submit without FormData or token reread', async () => {
    const h = harness(kind); h.draft(); const handler = h.form.element.props.onSubmit;
    const first = h.submit(handler); await h.submit(handler);
    assert.equal(h.log.defaults, 2); assert.equal(h.log.eventReads, 1); assert.equal(h.log.formData, 1);
    assert.equal(h.log.token, 1); assert.equal(h.log.fetch.length, 1);
    h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await first; h.unmount();
  });

  for (const loss of ['site', 'unmount', 'new-request']) for (const stage of ['fetch', 'json']) for (const settlement of ['resolve', 'reject']) {
    test(kind + ': late completion is silent ' + [loss, stage, settlement].join('/'), async () => {
      const h = harness(kind); h.draft(); const retained = h.form.element.props.onSubmit; const old = h.submit(); let json;
      if (stage === 'json') { json = h.packet(); await tick(); assert.equal(h.log.json, 1); }
      if (loss === 'unmount') h.unmount();
      else { h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B' }); h.draft();
        const field = kind === 'rule' ? 'title' : kind === 'person' ? 'display_name' : 'quiet_start';
        h.edit(field, kind === 'settings' ? '22:15' : 'NONUSABLE-SITE-B-DRAFT'); }
      let next; if (loss === 'new-request') next = h.submit();
      const draft = copy(h.form.values); const before = h.snapshot();
      await retained(h.poison('retained-event'));
      if (stage === 'fetch') {
        if (settlement === 'resolve') h.log.fetch[0].pending.resolve(h.poison('old-response'));
        else h.log.fetch[0].pending.reject(h.poison('old-fetch-error'));
      } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
      else json.reject(h.poison('old-json-error'));
      await old; assert.deepEqual(h.snapshot(), before); assert.deepEqual(h.form.values, draft);
      if (next) {
        await h.submit(); assert.equal(h.log.fetch.length, 2, 'old finally must not unlock new operation');
        h.packet(1).resolve({ data: { message: 'NONUSABLE-NEW-SAVED' } }); await next;
        assert.equal(h.log.reset, h.definition.reset); assert.equal(h.log.refresh, 1);
      }
      h.unmount();
    });
  }

  for (const failure of ['fetch', 'json', 'http']) test(kind + ': current failure retains draft and explicit retry works ' + failure, async () => {
    const h = harness(kind); const draft = h.draft(); const pending = h.submit();
    if (failure === 'fetch') h.log.fetch[0].pending.reject(new Error('NONUSABLE-FAILURE'));
    if (failure === 'json') h.packet().reject(new Error('NONUSABLE-BAD-JSON'));
    if (failure === 'http') h.packet(0, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
    await pending; h.render(); assert.ok(h.state().error); assert.equal(h.state().busy, false);
    assert.deepEqual(h.form.values, draft); assert.equal(h.log.reset, 0); assert.equal(h.log.refresh, 0);
    const retry = h.submit(); assert.equal(h.log.fetch.length, 2);
    h.packet(1).resolve({ data: { message: 'NONUSABLE-RETRY-SAVED' } }); await retry; assert.equal(h.log.refresh, 1); h.unmount();
  });

  test(kind + ': same-Site prop updates preserve current uncontrolled draft', async () => {
    const h = harness(kind); h.draft(); const pending = h.submit();
    const field = kind === 'rule' ? 'title' : kind === 'person' ? 'display_name' : 'quiet_start';
    h.edit(field, kind === 'settings' ? '22:15' : 'NONUSABLE-UNSENT'); const draft = copy(h.form.values); const form = h.form;
    h.render({ ...h.props, cameras: [...h.props.cameras, { id: 'NONUSABLE-CAMERA-B', display_name: 'NONUSABLE-UPDATED' }],
      schedule: { schedule_mode: 'night_only', schedule: { quiet_hours: { start: '20:00', end: '08:00' } } },
      channels: [{ channel: 'push', enabled: true }], consent: { observer_monitoring_consent: true } });
    assert.equal(h.form, form); assert.deepEqual(h.form.values, draft);
    h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
    assert.deepEqual(h.form.values, draft); assert.equal(h.log.reset, 0); assert.equal(h.log.refresh, 0); assert.match(h.state().message, /טרם נשלחו/); h.unmount();
  });

  test(kind + ': new Site receives its own defaults and empty action state', () => {
    const h = harness(kind); h.draft(); const previous = h.form;
    h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B', schedule: { schedule_mode: 'night_only', schedule: { quiet_hours: { start: '20:00', end: '08:00' } } },
      channels: [{ channel: 'push', enabled: true }], consent: { observer_monitoring_consent: true } });
    assert.notEqual(h.form, previous); assert.deepEqual(h.state(), { busy: false, error: '', message: '' });
    if (kind === 'rule') assert.deepEqual(h.form.values, { title: '', camera_source_id: '', watch_type: 'after_hours_activity', schedule_mode: 'always_active', description: '', priority: '5' });
    if (kind === 'person') assert.deepEqual(h.form.values, { display_name: '', relationship_label: '' });
    if (kind === 'settings') assert.deepEqual(h.form.values, { schedule_mode: 'night_only', quiet_start: '20:00', quiet_end: '08:00', push: 'on', monitoring_consent: 'on' });
    h.unmount();
  });

  test(kind + ': effect cleanup/setup invalidates old operation but permits current form submission', async () => {
    const h = harness(kind); h.draft(); const old = h.submit(); h.restartEffects();
    const next = h.submit(); assert.equal(h.log.fetch.length, 2); const before = h.snapshot();
    h.log.fetch[0].pending.resolve(h.poison('effect-old-response')); await old; assert.deepEqual(h.snapshot(), before);
    h.packet(1).resolve({ data: { message: 'NONUSABLE-CURRENT-SAVED' } }); await next; h.render();
    assert.equal(h.state().error, ''); assert.equal(h.log.refresh, 1); h.unmount();
  });

  test(kind + ': mismatched currentTarget is denied before FormData and token', async () => {
    const h = harness(kind); const event = { currentTarget: {}, preventDefault() { h.log.defaults++; } };
    await h.form.element.props.onSubmit(event);
    assert.equal(h.log.defaults, 1); assert.equal(h.log.formData, 0); assert.equal(h.log.token, 0); assert.equal(h.log.fetch.length, 0); h.unmount();
  });
}

const edits = {
  rule: [['title', 'NONUSABLE-NEW-TITLE'], ['camera_source_id', ''], ['description', 'NONUSABLE-NEW-DESCRIPTION'],
    ['watch_type', 'movement_in_area'], ['priority', '3'], ['schedule_mode', 'business_hours']],
  person: [['display_name', 'NONUSABLE-NEW-PERSON'], ['relationship_label', 'NONUSABLE-NEW-RELATION'], ['consent', false], ['notify', false]],
  settings: [['schedule_mode', 'night_only'], ['quiet_start', '22:15'], ['quiet_end', '08:30'], ['in_app', false], ['email', false],
    ['push', false], ['sms', false], ['whatsapp', false], ['monitoring_consent', false], ['safe_action_consent', false], ['model_improvement_consent', false]]
};
for (const [kind, fields] of Object.entries(edits)) for (const [field, value] of fields) {
  test(kind + ': pending edit remains unsent and next explicit submission captures it ' + field, async () => {
    const h = harness(kind); h.draft(); const pending = h.submit(); const originallySent = h.log.fetch[0].options.body;
    h.edit(field, value); const latest = copy(h.form.values);
    h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.render();
    assert.deepEqual(h.form.values, latest); assert.match(h.state().message, /טרם נשלחו/); assert.equal(h.state().busy, false);
    assert.equal(h.log.reset, 0); assert.equal(h.log.refresh, 0); assert.equal(h.log.fetch[0].options.body, originallySent);
    const next = h.submit(); assert.equal(h.log.fetch.length, 2); assert.notEqual(h.log.fetch[1].options.body, originallySent);
    h.packet(1).resolve({ data: { message: 'NONUSABLE-NEW-SAVED' } }); await next;
    assert.equal(h.log.reset, h.definition.reset); assert.equal(h.log.refresh, 1); h.unmount();
  });
}

test('rule: empty camera and priority retain null and numeric fallback contract', async () => {
  const h = harness('rule'); h.draft(); h.edit('camera_source_id', ''); h.edit('priority', '');
  const pending = h.submit(); const body = JSON.parse(h.log.fetch[0].options.body);
  assert.equal(body.camera_source_id, null); assert.equal(body.priority, 5);
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.unmount();
});

test('settings: empty quiet hours remain omitted and synthetic unchecked boxes false', async () => {
  const h = harness('settings'); h.form.values = { schedule_mode: 'event_only', quiet_start: '', quiet_end: '' };
  const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.fetch[0].options.body), {
    observer_site_id: 'NONUSABLE-SITE-A', schedule_mode: 'event_only', in_app: false, email: false, push: false,
    sms: false, whatsapp: false, monitoring_consent: false, safe_action_consent: false, model_improvement_consent: false
  });
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; assert.equal(h.log.reset, 0); h.unmount();
});

test('person: unchecked synthetic readiness flags do not become true', async () => {
  const h = harness('person'); h.form.values = { display_name: 'NONUSABLE-PERSON', relationship_label: '' };
  const pending = h.submit(); assert.deepEqual(JSON.parse(h.log.fetch[0].options.body), {
    action: 'create', observer_site_id: 'NONUSABLE-SITE-A', display_name: 'NONUSABLE-PERSON', relationship_label: '',
    consent_confirmed: false, notify_on_detection: false
  });
  h.packet().resolve({ data: { message: 'NONUSABLE-SAVED' } }); await pending; h.unmount();
});

test('settings: existing default in-app preference applies only to empty channel list', () => {
  const h = harness('settings'); assert.equal(h.form.values.in_app, 'on');
  h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B', channels: [{ channel: 'push', enabled: false }] });
  assert.equal(h.form.values.in_app, undefined); assert.equal(h.form.values.push, undefined); h.unmount();
});
