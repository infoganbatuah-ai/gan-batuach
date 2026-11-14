import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Actual-module closed VM. All credentials and records below are synthetic.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = resolve(root, 'components/digital-observer/enterprise-identity-center.tsx');
assert.ok(statSync(path).isFile());
if (process.platform === 'darwin') {
  const raw = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless source before reading');
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const code = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const initial = { organizationId: 'org/a & b', organizations: [{ id: 'org/a & b', name: 'Organization A' }, { id: 'org-b', name: 'Organization B' }] };
function snapshot(name = 'Organization A') {
  return {
    organization: { id: name, name }, actor: { role: 'organization_owner' },
    sites: [{ id: 'site-a', name: 'Site A' }],
    memberships: [{ id: 'member-a', enterprise_role: 'viewer', all_sites: true, active: true, revoked_at: null }],
    invitations: [{ id: 'invite-a', invited_email_hint: 'synthetic-invite', enterprise_role: 'viewer', status: 'pending', expires_at: '2026-01-02T03:04:05Z' }],
    serviceAccounts: [{ id: 'service-a', display_name: 'Synthetic Service', account_status: 'active', permissions: ['events.view'], expires_at: '2026-01-02T03:04:05Z' }],
    sso: [{ protocol: 'oidc', status: 'sandbox' }], scim: [{ status: 'sandbox' }], audit: [], sessions: [], slo: []
  };
}
const formNames = ['invite', 'create_service_account', 'configure_sso', 'configure_scim'];
const actions = [...formNames, 'revoke_invitation', 'rotate_service_credential', 'revoke_service_account'];
const formValues = {
  invite: { email: 'synthetic-owner@example.invalid', role: 'viewer', site: 'site-a' },
  create_service_account: { name: 'Synthetic Service', site: '', 'p_events.view': 'on', 'p_audit.read': 'on' },
  configure_sso: { protocol: 'oidc', issuer: 'https://issuer.invalid', audience: 'qa-audience', redirect: 'https://callback.invalid' },
  configure_scim: {}
};
const expected = {
  invite: { action: 'invite', email: 'synthetic-owner@example.invalid', role: 'viewer', site_ids: ['site-a'], expires_in_hours: 72 },
  create_service_account: { action: 'create_service_account', display_name: 'Synthetic Service', permissions: ['events.view', 'audit.read'], site_ids: [], expires_in_days: 90 },
  configure_sso: { action: 'configure_sso', connection_key: 'primary', protocol: 'oidc', mode: 'sandbox', issuer: 'https://issuer.invalid', audience: 'qa-audience', metadata_url: null, redirect_allowlist: ['https://callback.invalid'] },
  configure_scim: { action: 'configure_scim', connection_key: 'primary', mode: 'sandbox', group_role_mapping: {} },
  revoke_invitation: { action: 'revoke_invitation', invitation_id: 'invite-a' },
  rotate_service_credential: { action: 'rotate_service_credential', service_account_id: 'service-a', expires_in_days: 90, reason: 'manual rotation' },
  revoke_service_account: { action: 'revoke_service_account', service_account_id: 'service-a', reason: 'manual revocation' }
};
function makeForm(name) {
  return { values: { ...formValues[name] }, resets: 0, reads: [], reset() { this.resets++; } };
}
class FakeFormData {
  constructor(form) { this.form = form; form.constructs = (form.constructs || 0) + 1; }
  get(name) { this.form.reads.push(name); return this.form.values[name] ?? null; }
}
function harness() {
  let cells = [], effects = [], cursor = 0, tree, key, inner, props, mounted = false, writes = 0;
  const requests = [], invokedForms = [];
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  const react = {
    useState(value) {
      const index = cursor++, ownedCells = cells;
      if (!(index in ownedCells)) ownedCells[index] = typeof value === 'function' ? value() : value;
      return [ownedCells[index], next => { writes++; ownedCells[index] = typeof next === 'function' ? next(ownedCells[index]) : next; }];
    },
    useRef(value) { const index = cursor++; if (!(index in cells)) cells[index] = { current: value }; return cells[index]; },
    useCallback(callback, deps) { const index = cursor++; if (!cells[index] || changed(cells[index].deps, deps)) cells[index] = { callback, deps }; return cells[index].callback; },
    useLayoutEffect(setup, deps) { const index = cursor++, old = effects[index]; if (!old || changed(old.deps, deps)) effects[index] = { setup, deps, pending: true, cleanup: old?.cleanup }; }
  };
  const exported = {};
  const context = vm.createContext({ exports: exported, FormData: FakeFormData, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === 'lucide-react') return Object.fromEntries(['Building2', 'CheckCircle2', 'Clock3', 'KeyRound', 'LockKeyhole', 'RefreshCw', 'ShieldCheck', 'UserPlus', 'UsersRound', 'XCircle'].map(name => [name, name]));
    throw Error(`Unexpected import ${name}`);
  }, fetch(url, options) { const gate = deferred(); requests.push({ url, options, gate }); return gate.promise; } });
  new vm.Script(code, { filename: path }).runInContext(context, { timeout: 1000 });
  function cleanup() { for (const effect of effects) if (effect?.cleanup) { effect.cleanup(); effect.cleanup = undefined; } }
  function render(next = props || initial) {
    props = next;
    const wrapper = exported.EnterpriseIdentityCenter(next);
    assert.equal(typeof wrapper.type, 'function');
    if (!mounted || key !== wrapper.key || inner !== wrapper.type) { cleanup(); cells = []; effects = []; key = wrapper.key; inner = wrapper.type; mounted = true; }
    cursor = 0; tree = inner(wrapper.props);
    let rerender = false;
    for (const effect of effects) if (effect?.pending) {
      effect.cleanup?.(); effect.pending = false;
      const before = writes; effect.cleanup = effect.setup(); rerender ||= before !== writes;
    }
    if (rerender) { cursor = 0; tree = inner(wrapper.props); }
    return tree;
  }
  function visit(node, predicate, result) {
    if (Array.isArray(node)) { for (const child of node) visit(child, predicate, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    visit(node.props?.children, predicate, result);
  }
  const nodes = (predicate, node = tree) => { const result = []; visit(node, predicate, result); return result; };
  function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return textOf(node.props?.children);
  }
  const formNode = name => { const forms = nodes(node => node.type === 'form'); assert.equal(forms.length, 4); return forms[formNames.indexOf(name)]; };
  const rowButton = name => { const rows = nodes(node => node.type === 'button' && node.props.type === 'button'); assert.equal(rows.length, 3); return rows[['revoke_invitation', 'rotate_service_credential', 'revoke_service_account'].indexOf(name)]; };
  function reconnect() { cleanup(); for (const effect of effects) if (effect) effect.pending = true; render(); }
  function poison() { const reads = []; return { reads, value: new Proxy({}, { get(_, field) { if (field === 'then') return undefined; reads.push(String(field)); throw Error('obsolete access'); } }) }; }
  function handler(name) { return formNames.includes(name) ? formNode(name).props.onSubmit : rowButton(name).props.onClick; }
  function invoke(name, form = makeForm(name), callback = handler(name)) {
    if (!formNames.includes(name)) { callback(); return { form, promise: undefined, event: undefined }; }
    invokedForms.push(form);
    const event = { currentTarget: form, prevented: 0, preventDefault() { this.prevented++; } };
    const promise = callback(event);
    event.currentTarget = null; // React clears this immediately after callback dispatch.
    return { form, promise, event };
  }
  render();
  return { render, cleanup, reconnect, nodes, formNode, rowButton, handler, invoke, requests, poison,
    text: () => textOf(tree), snapshot: () => ({ writes, requests: requests.length, resets: invokedForms.reduce((total, form) => total + form.resets, 0) }),
    async respond(data = snapshot(), ok = true, request = requests.at(-1)) { request.gate.resolve({ ok, json: async () => ({ data }) }); await tick(); render(); },
    async jsonStage() { const gate = deferred(); requests.at(-1).gate.resolve({ ok: true, json: () => gate.promise }); await tick(); return gate; }
  };
}
function allDisabled(h, disabled) { const controls = h.nodes(node => node.type === 'button'); assert.equal(controls.length, 7); for (const node of controls) assert.equal(node.props.disabled, disabled); }
async function complete(h, value = { credential: 'SYNTHETIC-ONE-TIME' }, state = snapshot()) {
  await h.respond(value); assert.equal(h.requests.at(-1).options.cache, 'no-store');
  assert.equal(h.nodes(node => node.type === 'form').length, 4, 'forms stay mounted during refresh');
  allDisabled(h, true); await h.respond(state); allDisabled(h, false);
}
async function prepare(h, name) {
  await h.respond();
  if (name === 'read') { h.reconnect(); return; }
  h.invoke('invite');
  if (name === 'refresh') await h.respond({ acceptanceToken: 'SYNTHETIC-ACCEPTANCE' });
}

test('initial exact GET and honest loading/unavailable without forms', async () => {
  const h = harness(); assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/digital-observer/enterprise?organization_id=org%2Fa%20%26%20b');
  assert.deepEqual(copy(h.requests[0].options), { cache: 'no-store' }); assert.match(h.text(), /טוען את גבולות הארגון/);
  h.requests[0].gate.reject(Error('offline')); await tick(); h.render(); assert.match(h.text(), /נתוני הארגון אינם זמינים/);
  assert.equal(h.nodes(node => node.type === 'form').length, 0);
});
test('role/permission catalogs and form validation/defaults/disclaimers preserved', async () => {
  const h = harness(); await h.respond();
  const invite = h.formNode('invite'), service = h.formNode('create_service_account'), sso = h.formNode('configure_sso');
  const role = h.nodes(node => node.type === 'select' && node.props.name === 'role', invite)[0]; assert.equal(role.props.defaultValue, 'viewer');
  assert.deepEqual(h.nodes(node => node.type === 'option', role).map(node => node.props.value), ['organization_admin', 'site_admin', 'security_operator', 'investigator', 'viewer', 'billing_admin']);
  assert.deepEqual(h.nodes(node => node.type === 'input' && node.props.type === 'checkbox', service).map(node => [node.props.name, node.props.defaultChecked]), [
    ['p_camera.live.view', false], ['p_recordings.view', false], ['p_evidence.view', false], ['p_events.view', true], ['p_investigation.run', false], ['p_notifications.manage', false], ['p_device_actions.execute', false], ['p_api.credentials.manage', false], ['p_audit.read', false]
  ]);
  const email = h.nodes(node => node.type === 'input' && node.props.name === 'email', invite)[0]; assert.equal(email.props.type, 'email'); assert.equal(email.props.required, true); assert.equal(email.props.autoComplete, 'off');
  const name = h.nodes(node => node.type === 'input' && node.props.name === 'name', service)[0]; assert.equal(name.props.minLength, 2); assert.equal(name.props.maxLength, 100); assert.equal(name.props.required, true);
  for (const input of h.nodes(node => node.type === 'input', sso)) assert.equal(input.props.required, true);
  for (const text of ['כבוי ללא fallback', 'דורש ספק ואישור בעלים', 'מצב חיבור אינו הוכחת ספק.', 'יעדי שירות אינם טענה לעמידה חוזית.', 'claims לא מוכרים אינם מעניקים הרשאה.', 'אין מפתחות קבועים בלתי מוגבלים.']) assert.ok(h.text().includes(text));
  allDisabled(h, false);
});
for (const name of actions) test(`exact current ${name} body, acceptance and owned GET refresh`, async () => {
  const h = harness(); await h.respond(); const invocation = h.invoke(name);
  assert.equal(h.requests.length, 2); const r = h.requests.at(-1);
  assert.equal(r.url, '/api/digital-observer/enterprise'); assert.equal(r.options.method, 'POST');
  assert.deepEqual(copy(r.options.headers), { 'content-type': 'application/json' });
  assert.deepEqual(JSON.parse(r.options.body), { ...expected[name], organization_id: initial.organizationId });
  assert.deepEqual(Object.keys(r.options).sort(), ['body', 'headers', 'method']);
  h.render(); allDisabled(h, true); await complete(h);
  if (formNames.includes(name)) { assert.equal(invocation.event.currentTarget, null); assert.equal(invocation.event.prevented, 1); assert.equal(invocation.form.resets, 1); await invocation.promise; }
  assert.match(h.text(), /הפעולה נשמרה בהצלחה/); assert.match(h.text(), /SYNTHETIC-ONE-TIME/); assert.equal(h.requests.length, 3);
});
for (const name of actions) for (const failure of ['fetch', 'json', 'http']) test(`${name}/${failure} caught current failure releases shared busy and allows retry`, async () => {
  const h = harness(); await h.respond(); const invocation = h.invoke(name);
  if (failure === 'fetch') h.requests.at(-1).gate.reject(Error('offline'));
  else if (failure === 'json') { const gate = await h.jsonStage(); gate.reject(Error('bad json')); }
  else h.requests.at(-1).gate.resolve({ ok: false, json: async () => ({ error: 'CURRENT_DENIED' }) });
  await tick(); h.render(); allDisabled(h, false);
  assert.ok(h.nodes(node => node.props?.className === 'do-notice info').length > 0);
  assert.equal(h.requests.length, 2); assert.equal(invocation.form.resets, 0); await invocation.promise;
  h.invoke(name); assert.equal(h.requests.length, 3); await complete(h);
});
for (const name of formNames) for (const edited of [false, true]) test(`${name} captured form ${edited ? 'preserves edited draft' : 'resets unchanged form'} with nulled currentTarget`, async () => {
  const h = harness(); await h.respond(); const invocation = h.invoke(name);
  assert.equal(invocation.event.currentTarget, null); h.render();
  if (edited) { invocation.form.values.newer = 'unsent'; h.formNode(name).props.onInput(); h.formNode(name).props.onChange(); }
  await h.respond({ acceptanceToken: 'SYNTHETIC-TOKEN' });
  assert.equal(invocation.form.resets, edited ? 0 : 1); assert.equal(h.nodes(node => node.type === 'form').length, 4);
  assert.match(h.text(), /SYNTHETIC-TOKEN/); await h.respond(); await invocation.promise;
  assert.equal(invocation.form.resets, edited ? 0 : 1); if (edited) assert.equal(invocation.form.values.newer, 'unsent');
});
test('all seven callbacks share synchronous busy guard before FormData or row building', async () => {
  const h = harness(); await h.respond(); const handlers = Object.fromEntries(actions.map(name => [name, h.handler(name)]));
  h.invoke('invite'); const before = h.snapshot();
  for (const name of actions) {
    if (formNames.includes(name)) {
      const poison = h.poison(); let prevented = 0;
      await handlers[name]({ preventDefault() { prevented++; }, get currentTarget() { return poison.value; } });
      assert.equal(prevented, 1); assert.deepEqual(poison.reads, []);
    } else handlers[name]();
  }
  assert.deepEqual(h.snapshot(), before); await complete(h);
});
test('current busy event prevents default without reading currentTarget', async () => {
  const h = harness(); await h.respond(); const handler = h.handler('invite'); handler({ preventDefault() {}, currentTarget: makeForm('invite') });
  let prevented = 0, reads = 0;
  await handler({ preventDefault() { prevented++; }, get currentTarget() { reads++; throw Error('must not read busy form'); } });
  assert.equal(prevented, 1); assert.equal(reads, 0); await complete(h);
});
test('FormData construction failure caught; explicit retry works', async () => {
  const h = harness(); await h.respond(); const poison = h.poison();
  await h.handler('invite')({ preventDefault() {}, currentTarget: poison.value }); h.render(); allDisabled(h, false);
  assert.ok(poison.reads.length > 0); assert.equal(h.requests.length, 1); h.invoke('invite'); await complete(h);
});
test('same-ID fresh organizations props preserve data and pending request; no repeat load', async () => {
  const h = harness(); await h.respond(); h.invoke('invite');
  h.render({ ...initial, organizations: [...initial.organizations, { id: 'org-c', name: 'Organization C' }] });
  assert.equal(h.requests.length, 2); assert.match(h.text(), /Organization C/); allDisabled(h, true); await complete(h);
});
test('fresh committed snapshot rejects old row callbacks but admitted action finishes refresh/finally', async () => {
  const h = harness(); await h.respond(); const old = h.handler('rotate_service_credential');
  h.invoke('invite'); await complete(h, { acceptanceToken: 'SYNTHETIC-TOKEN' }, snapshot('Fresh Snapshot'));
  const before = h.snapshot(); old(); await tick(); assert.deepEqual(h.snapshot(), before); allDisabled(h, false);
  h.invoke('rotate_service_credential'); assert.equal(h.requests.length, before.requests + 1); await complete(h);
});
test('one-time result belongs to organization and is cleared on next write and A-B-A', async () => {
  const h = harness(); await h.respond(); h.invoke('invite'); await complete(h, { acceptanceToken: 'SYNTHETIC-OLD' });
  assert.match(h.text(), /SYNTHETIC-OLD/); h.invoke('configure_scim'); h.render(); assert.doesNotMatch(h.text(), /SYNTHETIC-OLD/);
  await complete(h); h.render({ ...initial, organizationId: 'org-b' }); assert.doesNotMatch(h.text(), /SYNTHETIC/);
  h.render(initial); assert.doesNotMatch(h.text(), /SYNTHETIC/); assert.equal(h.nodes(node => node.type === 'form').length, 0);
});
test('action supersedes pending initial/reconnect GET without stale overwrite', async () => {
  const h = harness(); await h.respond(); h.reconnect(); const gate = await h.jsonStage(); h.invoke('invite');
  const before = h.snapshot(), poison = h.poison(); gate.resolve(poison.value); await tick();
  assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before); await complete(h);
});
for (const name of ['read', 'write', 'refresh']) for (const boundary of ['fetch', 'json']) for (const loss of ['unmount', 'organization', 'roundtrip', 'layout']) for (const rejected of [false, true]) {
  test(`${name}/${boundary}/${loss}/${rejected ? 'reject' : 'resolve'} obsolete completion has no reads/resets/IO/state/unlock`, async () => {
    const h = harness(); await prepare(h, name); const retained = h.handler('invite');
    const gate = boundary === 'fetch' ? h.requests.at(-1).gate : await h.jsonStage();
    if (loss === 'unmount') h.cleanup();
    else {
      if (loss === 'layout') h.reconnect();
      else { h.render({ ...initial, organizationId: 'org-b' }); if (loss === 'roundtrip') h.render(initial); }
      await h.respond(snapshot('Current Snapshot')); h.invoke('invite'); h.render(); allDisabled(h, true);
    }
    const before = h.snapshot(), poison = h.poison();
    if (rejected) gate.reject(poison.value); else gate.resolve(poison.value);
    await tick(); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
    const badEvent = h.poison(); await retained(badEvent.value); assert.deepEqual(badEvent.reads, []); assert.deepEqual(h.snapshot(), before);
    if (loss !== 'unmount') {
      h.render(); allDisabled(h, true); const form = makeForm('invite'); h.invoke('invite', form); assert.equal(form.constructs, undefined);
      assert.deepEqual(h.snapshot(), before); await complete(h);
    }
  });
}
for (const name of ['read', 'write', 'refresh']) test(`${name} response status/json getter rejected after loss`, async () => {
  const h = harness(); await prepare(h, name); const gate = h.requests.at(-1).gate;
  h.render({ ...initial, organizationId: 'org-b' }); const before = h.snapshot(), reads = [];
  gate.resolve({ get ok() { reads.push('ok'); throw Error('old status'); }, get json() { reads.push('json'); throw Error('old JSON'); } });
  await tick(); assert.deepEqual(reads, []); assert.deepEqual(h.snapshot(), before);
});
for (const loss of ['unmount', 'organization', 'roundtrip', 'layout']) test(`retained form event ${loss} cannot be inspected`, async () => {
  const h = harness(); await h.respond(); const old = h.handler('invite');
  if (loss === 'unmount') h.cleanup();
  else if (loss === 'layout') { h.reconnect(); await h.respond(); }
  else { h.render({ ...initial, organizationId: 'org-b' }); if (loss === 'roundtrip') h.render(initial); await h.respond(); }
  const before = h.snapshot(), poison = h.poison(); await old(poison.value); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
  if (loss !== 'unmount') { h.invoke('invite'); await complete(h); }
});
test('failed owned refresh keeps matching one-time result, forms and visible error; releases busy', async () => {
  const h = harness(); await h.respond(); h.invoke('rotate_service_credential'); await h.respond({ credential: 'SYNTHETIC-ROTATED' });
  h.requests.at(-1).gate.reject(Error('read unavailable')); await tick(); h.render(); allDisabled(h, false);
  assert.match(h.text(), /SYNTHETIC-ROTATED/); assert.ok(h.nodes(node => node.props?.className === 'do-notice info').length > 0);
  h.invoke('rotate_service_credential'); h.render(); assert.doesNotMatch(h.text(), /SYNTHETIC-ROTATED/); await complete(h);
});
test('delivered false message survives successful refresh without claiming provider delivery', async () => {
  const h = harness(); await h.respond(); h.invoke('invite'); await complete(h, { acceptanceToken: 'SYNTHETIC-TOKEN', delivered: false });
  assert.match(h.text(), /נשמר בהצלחה\. ההזמנה לא נשלחה כי ספק חיצוני אינו מופעל\./);
});
