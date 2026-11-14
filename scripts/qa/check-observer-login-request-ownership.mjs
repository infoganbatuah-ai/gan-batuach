import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Closed fake SDK only. Never import browser client implementation/configuration.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = resolve(root, 'components/digital-observer/observer-login-form.tsx');
assert.ok(statSync(path).isFile());
if (process.platform === 'darwin') {
  const raw = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw); assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless source before content read');
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const code = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const initial = { initialType: 'home', nextPath: '/digital-observer/dashboard', registered: false, verified: false, passwordUpdated: false, verificationRequired: false };
const fields = () => ({ email: '  SYNTHETIC@EXAMPLE.INVALID  ', password: ' Raw Synthetic Password ', observer_account_type: 'home' });
const login = (options = {}) => ({ error: null, data: { user: { id: 'synthetic-user', user_metadata: options.userMetadata ?? {}, app_metadata: options.appMetadata ?? {} }, session: { access_token: 'SYNTHETIC-TOKEN' } } });
const queryValues = (options = {}) => [
  { data: options.missing ? null : { account_type: options.accountType ?? 'home' }, error: options.readError ? { message: 'synthetic read error ignored as before' } : null },
  { data: options.site === false ? null : { id: 'synthetic-site' }, error: null },
  { data: options.membership ? { observer_site_id: 'synthetic-member-site' } : null, error: null }
];
const genericError = 'פרטי ההתחברות אינם נכונים. בדקו את כתובת המייל והסיסמה ונסו שוב.';
function harness({ native = false, autoPassive = true } = {}) {
  let cells = [], effects = [], cursor = 0, tree, key, inner, props, mounted = false, writes = 0, creates = 0, formBuilds = 0;
  let failOnce, onCreate, onRemember, onAssign;
  const attempts = [], stored = [], navigations = [];
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  function effect(kind, setup, deps) { const index = cursor++, old = effects[index]; if (!old || changed(old.deps, deps)) effects[index] = { kind, setup, deps, pending: true, cleanup: old?.cleanup }; }
  const react = {
    useState(value) {
      const index = cursor++, owned = cells; if (!(index in owned)) owned[index] = typeof value === 'function' ? value() : value;
      return [owned[index], next => { writes++; owned[index] = typeof next === 'function' ? next(owned[index]) : next; }];
    },
    useRef(value) { const index = cursor++; if (!(index in cells)) cells[index] = { current: value }; return cells[index]; },
    useEffect(setup, deps) { effect('passive', setup, deps); },
    useLayoutEffect(setup, deps) { effect('layout', setup, deps); }
  };
  function maybeThrow(point) { if (failOnce === point) { failOnce = undefined; throw Error('SYNTHETIC INTERNAL DETAILS MUST NOT DISPLAY'); } }
  const tables = ['digital_observer_accounts', 'observer_sites', 'observer_site_memberships'];
  const chainSteps = [
    [['select', 'account_type'], ['eq', 'profile_id', 'synthetic-user'], ['maybeSingle']],
    [['select', 'id'], ['eq', 'owner_profile_id', 'synthetic-user'], ['is', 'garden_id', null], ['neq', 'site_type', 'kindergarten'], ['limit', 1], ['maybeSingle']],
    [['select', 'observer_site_id'], ['eq', 'profile_id', 'synthetic-user'], ['eq', 'active', true], ['limit', 1], ['maybeSingle']]
  ];
  function createClient() {
    creates++; maybeThrow('create');
    const attempt = { auth: deferred(), rpc: deferred(), queries: [deferred(), deferred(), deferred()], signouts: [], calls: [], chains: [[], [], []] };
    attempts.push(attempt);
    onCreate?.();
    return {
      auth: {
        signInWithPassword(value) { attempt.calls.push(['auth', copy(value)]); maybeThrow('auth'); return attempt.auth.promise; },
        signOut(...args) { assert.equal(args.length, 0, 'original GLOBAL default, no scope argument'); attempt.calls.push(['signOut', args]); maybeThrow('signOut'); const gate = deferred(); attempt.signouts.push(gate); return gate.promise; }
      },
      rpc(name, value) { assert.equal(name, 'ensure_digital_observer_account'); attempt.calls.push(['rpc', name, copy(value)]); maybeThrow('rpc'); return attempt.rpc.promise; },
      from(table) {
        const index = tables.indexOf(table); assert.ok(index >= 0, `unexpected table ${table}`);
        attempt.calls.push(['from', table]); maybeThrow(`query${index}`);
        let position = 0;
        const chain = Object.fromEntries(['select', 'eq', 'is', 'neq', 'limit', 'maybeSingle'].map(method => [method, (...args) => {
          const actual = [method, ...args]; attempt.chains[index].push(actual); assert.deepEqual(actual, chainSteps[index][position++]);
          if (method === 'maybeSingle') { assert.equal(position, chainSteps[index].length); return attempt.queries[index].promise; }
          return chain;
        }]));
        return chain;
      }
    };
  }
  class FakeFormData {
    constructor(form) { formBuilds++; maybeThrow('form'); this.form = form; form.builds = (form.builds || 0) + 1; }
    get(name) { this.form.reads.push(name); return this.form.values[name] ?? null; }
  }
  const exported = {};
  const context = vm.createContext({ exports: exported, FormData: FakeFormData,
    window: { location: { assign(destination) { navigations.push(destination); maybeThrow('assign'); onAssign?.(); } } },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/link') return { default: 'NextLink' };
      if (name === '@capacitor/core') return { Capacitor: { isNativePlatform() { return native; } } };
      if (name === 'lucide-react') return { LoaderCircle: 'LoaderCircle', LockKeyhole: 'LockKeyhole', ShieldCheck: 'ShieldCheck' };
      if (name === '@/components/digital-observer/observer-app-shell') return { ObserverMark: 'ObserverMark' };
      if (name === '@/lib/domain/digital-observer/client-session') return { rememberObserverAccessToken(value) { stored.push(value); maybeThrow('remember'); onRemember?.(); } };
      if (name === '@/lib/supabase/browser') return { createClient };
      throw Error(`Unexpected import ${name}`);
    }
  });
  new vm.Script(code, { filename: path }).runInContext(context, { timeout: 1000 });
  function cleanup() { for (const entry of effects) if (entry?.cleanup) { entry.cleanup(); entry.cleanup = undefined; } }
  function flush(kind) {
    let rerender = false;
    for (const entry of effects) if (entry?.pending && entry.kind === kind) {
      entry.cleanup?.(); entry.pending = false; const before = writes; entry.cleanup = entry.setup(); rerender ||= writes !== before;
    }
    return rerender;
  }
  function render(next = props || initial) {
    props = next; const wrapper = exported.ObserverLoginForm(next); assert.equal(typeof wrapper.type, 'function');
    if (!mounted || key !== wrapper.key || inner !== wrapper.type) { cleanup(); cells = []; effects = []; key = wrapper.key; inner = wrapper.type; mounted = true; }
    cursor = 0; tree = inner(wrapper.props);
    let rerender = flush('layout'); if (autoPassive) rerender = flush('passive') || rerender;
    if (rerender) { cursor = 0; tree = inner(wrapper.props); }
    return tree;
  }
  function visit(node, predicate, result) {
    if (Array.isArray(node)) { for (const child of node) visit(child, predicate, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node); visit(node.props?.children, predicate, result);
  }
  const nodes = predicate => { const result = []; visit(tree, predicate, result); return result; };
  function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node); return textOf(node.props?.children);
  }
  const form = () => { const result = nodes(node => node.type === 'form'); assert.equal(result.length, 1); return result[0]; };
  const button = () => nodes(node => node.type === 'button' && node.props.type === 'submit')[0];
  function submit(values = fields(), callback = form().props.onSubmit) {
    const target = { values, reads: [] }, event = { currentTarget: target, prevented: 0, preventDefault() { this.prevented++; } };
    const promise = callback(event); event.currentTarget = null; return { target, event, promise };
  }
  function reconnect() { cleanup(); for (const entry of effects) if (entry) entry.pending = true; render(); }
  function poison() { const reads = []; return { reads, value: new Proxy({}, { get(_, field) { if (field === 'then') return undefined; reads.push(String(field)); throw Error('obsolete result'); } }) }; }
  render();
  return { render, nodes, form, button, submit, cleanup, reconnect, poison, attempts, stored, navigations,
    text: () => textOf(tree), snapshot: () => ({ writes, creates, formBuilds, attempts: attempts.length, rpc: attempts.reduce((n, a) => n + a.calls.filter(c => c[0] === 'rpc').length, 0), reads: attempts.reduce((n, a) => n + a.calls.filter(c => c[0] === 'from').length, 0), signouts: attempts.reduce((n, a) => n + a.calls.filter(c => c[0] === 'signOut').length, 0), stored: stored.length, navigations: navigations.length }),
    passive() { flush('passive'); render(); },
    fail(point) { failOnce = point; }, callbacks(values) { onCreate = values.create; onRemember = values.remember; onAssign = values.assign; },
    async auth(attempt = attempts.at(-1), value = login()) { attempt.auth.resolve(value); await tick(); },
    async rpc(attempt = attempts.at(-1), value = { error: null, data: true }) { attempt.rpc.resolve(value); await tick(); },
    async queries(attempt = attempts.at(-1), values = queryValues()) { values.forEach((value, index) => attempt.queries[index].resolve(value)); await tick(); },
    async finish(attempt = attempts.at(-1), options = {}) { await this.auth(attempt, login(options)); await this.rpc(attempt); await this.queries(attempt, queryValues(options)); render(); }
  };
}
async function reach(h, stage) {
  h.submit(); const attempt = h.attempts.at(-1);
  if (stage === 'auth') return attempt;
  await h.auth(attempt);
  if (stage === 'rpc') return attempt;
  await h.rpc(attempt, stage === 'signOutPrep' ? { error: null, data: false } : { error: null, data: true });
  if (stage === 'queries' || stage === 'signOutPrep') return attempt;
  await h.queries(attempt, queryValues({ missing: true })); return attempt;
}
function oldGate(attempt, stage) { return stage === 'auth' ? attempt.auth : stage === 'rpc' ? attempt.rpc : stage === 'queries' ? null : attempt.signouts[0]; }
function assertError(h, expected = genericError) { h.render(); assert.equal(h.button().props.disabled, false); assert.ok(h.text().includes(expected)); assert.doesNotMatch(h.text(), /SYNTHETIC INTERNAL DETAILS/); }

test('hydration, server form contract, hidden fields, labels and disabled Google preserved', () => {
  const h = harness({ autoPassive: false }); assert.equal(h.form().props['data-hydrated'], 'false'); assert.equal(h.button().props.disabled, true);
  assert.equal(h.form().props.action, '/api/digital-observer/auth/login'); assert.equal(h.form().props.method, 'post');
  const hidden = h.nodes(node => node.type === 'input' && node.props.type === 'hidden'); assert.deepEqual(hidden.map(node => [node.props.name, node.props.value]), [['auth_source', 'observer'], ['next', initial.nextPath], ['observer_account_type', 'home']]);
  h.passive(); assert.equal(h.form().props['data-hydrated'], 'true'); assert.equal(h.button().props.disabled, false);
  const google = h.nodes(node => node.props?.className === 'do-auth-google')[0]; assert.equal(google.props.disabled, true); assert.equal(google.props.type, 'button');
  assert.match(h.text(), /לא זמין בסביבת הבדיקה/); assert.equal(h.attempts.length, 0);
});
test('native progressive enhancement never prevents default, reads form or starts browser SDK', async () => {
  const h = harness({ native: true }), poison = h.poison(); let prevented = 0;
  await h.form().props.onSubmit({ preventDefault() { prevented++; }, get currentTarget() { return poison.value; } });
  assert.equal(prevented, 0); assert.deepEqual(poison.reads, []); assert.equal(h.snapshot().creates, 0); assert.equal(h.snapshot().formBuilds, 0); assert.equal(h.stored.length, 0); assert.equal(h.navigations.length, 0);
});
test('duplicate current submit prevents default before form/client and captures synthetic raw fields', async () => {
  const h = harness(); const handler = h.form().props.onSubmit, first = h.submit(); const poison = h.poison(); let prevented = 0;
  await handler({ preventDefault() { prevented++; }, get currentTarget() { return poison.value; } });
  assert.equal(prevented, 1); assert.deepEqual(poison.reads, []); assert.equal(h.snapshot().formBuilds, 1); assert.equal(h.snapshot().creates, 1);
  assert.equal(first.event.currentTarget, null); assert.deepEqual(first.target.reads, ['email', 'password', 'observer_account_type']);
  assert.deepEqual(h.attempts[0].calls[0], ['auth', { email: 'synthetic@example.invalid', password: ' Raw Synthetic Password ' }]); await h.finish();
});
test('exact RPC hints, three parallel read chains and default signOut scope unchanged', async () => {
  const h = harness(); h.submit({ ...fields(), observer_account_type: 'business' }); const a = h.attempts[0]; await h.auth(a, login({ userMetadata: { full_name: 'Synthetic Name', account_type: 'metadata-hint' } }));
  assert.deepEqual(a.calls[1], ['rpc', 'ensure_digital_observer_account', { requested_name: 'Synthetic Name', requested_account_type: 'metadata-hint' }]);
  await h.rpc(a); assert.equal(a.calls.filter(c => c[0] === 'from').length, 3); assert.equal(a.chains.every(chain => chain.at(-1)[0] === 'maybeSingle'), true);
  await h.queries(a); assert.equal(h.navigations[0], '/digital-observer/dashboard');
});
const routes = [
  ['home-site', {}, '/digital-observer/dashboard'], ['business-site', { accountType: 'business' }, '/digital-observer/dashboard'],
  ['home-no-site', { site: false }, '/digital-observer/onboarding?type=home'], ['business-no-site', { site: false, accountType: 'business' }, '/digital-observer/onboarding?type=business'],
  ['admin-no-site', { site: false, appMetadata: { digital_observer_admin: true } }, '/digital-observer/admin'],
  ['membership', { site: false, membership: true }, '/digital-observer/dashboard'],
  ['explicit-return', { path: '/digital-observer/cameras', site: false }, '/digital-observer/cameras'],
  ['unsafe-return', { path: 'https://example.invalid' }, '/digital-observer/dashboard'],
  ['protocol-relative', { path: '//example.invalid' }, '/digital-observer/dashboard'],
  ['editable-user-admin-not-authority', { site: false, userMetadata: { digital_observer_admin: true } }, '/digital-observer/onboarding?type=home'],
  ['strict-admin-boolean', { site: false, appMetadata: { digital_observer_admin: 'true' } }, '/digital-observer/onboarding?type=home'],
  ['unknown-account-type', { site: false, accountType: 'other' }, '/digital-observer/onboarding?type=home'],
  ['original-prefix-policy', { path: '/digital-observer-extra' }, '/digital-observer-extra']
];
for (const [name, options, destination] of routes) test(`unchanged routing ${name}`, async () => {
  const h = harness(); if (options.path) h.render({ ...initial, nextPath: options.path }); h.submit(); await h.finish(undefined, options);
  assert.deepEqual(h.navigations, [destination]); assert.deepEqual(h.stored, ['SYNTHETIC-TOKEN']);
  assert.equal(h.button().props.disabled, true, 'returning assign stays locked'); const before = h.snapshot(); h.submit(); assert.deepEqual(h.snapshot(), before);
});
for (const [name, result, expected] of [
  ['email-code', { error: { code: 'EMAIL_NOT_CONFIRMED' }, data: { user: null } }, 'כתובת המייל עדיין לא אומתה.'],
  ['email-message', { error: { message: 'Email not confirmed' }, data: { user: null } }, 'כתובת המייל עדיין לא אומתה.'],
  ['ordinary', { error: { code: 'wrong' }, data: { user: null } }, genericError],
  ['missing-user', { error: null, data: { user: null } }, genericError]
]) test(`ordinary auth error ${name} safe mapping and retry`, async () => {
  const h = harness(); h.submit(); await h.auth(undefined, result); assertError(h, expected); assert.equal(h.snapshot().signouts, 0); h.submit(); await h.finish();
});
for (const stage of ['signOutPrep', 'signOutMissing']) test(`${stage} ordinary failure retains original signOut and message`, async () => {
  const h = harness(), a = await reach(h, stage); assert.equal(a.signouts.length, 1); a.signouts[0].resolve({ error: null }); await tick();
  assertError(h, stage === 'signOutPrep' ? 'ההתחברות הצליחה, אך הכנת חשבון התצפיתן לא הושלמה.' : 'חשבון התצפיתן לא נמצא לאחר ההתחברות.');
  assert.equal(h.stored.length, 0); h.submit(); await h.finish();
});
test('existing read-error policy unchanged when account data is available', async () => {
  const h = harness(); h.submit(); await h.finish(undefined, { readError: true }); assert.deepEqual(h.navigations, ['/digital-observer/dashboard']); assert.equal(h.snapshot().signouts, 0);
});
const unexpected = ['form', 'create', 'auth', 'authReject', 'rpc', 'rpcReject', 'query0', 'query0Reject', 'query1Reject', 'query2Reject', 'signOut', 'signOutReject', 'remember', 'assign'];
for (const point of unexpected) test(`unexpected ${point} safely releases busy without cleanup logout, explicit retry`, async () => {
  const h = harness();
  if (['form', 'create', 'auth'].includes(point)) { h.fail(point); await h.submit().promise; }
  else if (point === 'authReject') { const invocation = h.submit(); h.attempts[0].auth.reject(Error('SYNTHETIC INTERNAL DETAILS')); await invocation.promise; }
  else {
    h.submit(); const a = h.attempts[0];
    if (point === 'rpc') h.fail('rpc');
    await h.auth(a);
    if (point === 'rpcReject') a.rpc.reject(Error('SYNTHETIC INTERNAL DETAILS'));
    else if (point !== 'rpc') {
      if (point === 'query0') h.fail('query0');
      if (point === 'signOut') h.fail('signOut');
      await h.rpc(a, point.startsWith('signOut') ? { error: null, data: false } : { error: null, data: true });
      if (point === 'signOutReject') a.signouts[0].reject(Error('SYNTHETIC INTERNAL DETAILS'));
      else if (/^query[012]Reject$/.test(point)) a.queries[Number(point[5])].reject(Error('SYNTHETIC INTERNAL DETAILS'));
      else if (point === 'remember' || point === 'assign') { h.fail(point); await h.queries(a); }
    }
    await tick();
  }
  assertError(h); const previous = h.attempts.length; h.submit(); assert.equal(h.attempts.length, previous + 1); await h.finish();
});
for (const stage of ['auth', 'rpc', 'queries', 'signOutPrep', 'signOutMissing']) for (const loss of ['unmount', 'next', 'type', 'roundtrip', 'typeRoundtrip', 'layout']) for (const rejected of [false, true]) {
  test(`${stage}/${loss}/${rejected ? 'reject' : 'resolve'} old result cannot read/advance/signOut/store/navigate/unlock`, async () => {
    const h = harness(), a = await reach(h, stage), old = h.form().props.onSubmit;
    if (loss === 'unmount') h.cleanup();
    else if (loss === 'layout') h.reconnect();
    else {
      h.render(loss === 'type' || loss === 'typeRoundtrip' ? { ...initial, initialType: 'business' } : { ...initial, nextPath: '/digital-observer/cameras' });
      if (loss === 'roundtrip' || loss === 'typeRoundtrip') h.render(initial);
    }
    if (loss !== 'unmount') { h.submit(); h.render(); assert.equal(h.button().props.disabled, true); }
    const before = h.snapshot(), poison = h.poison();
    const gates = stage === 'queries' ? a.queries : [oldGate(a, stage)];
    for (const gate of gates) { if (rejected) gate.reject(poison.value); else gate.resolve(poison.value); }
    await tick(); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
    const event = h.poison(); await old(event.value); assert.deepEqual(event.reads, []); assert.deepEqual(h.snapshot(), before);
    if (loss !== 'unmount') {
      h.render(); assert.equal(h.button().props.disabled, true); const duplicate = h.submit(); assert.equal(duplicate.target.builds, undefined); assert.deepEqual(h.snapshot(), before);
      await h.finish(); assert.equal(h.stored.length, 1); assert.equal(h.navigations.length, 1);
    }
  });
}
test('same-target informational refresh retains request and latest notices without another SDK', async () => {
  const h = harness(); h.submit(); h.render({ ...initial, registered: true, verified: true, passwordUpdated: true, verificationRequired: true, initialError: 'new seed not replacing current state' });
  assert.equal(h.attempts.length, 1); assert.match(h.text(), /כתובת המייל אומתה בהצלחה/); assert.match(h.text(), /הסיסמה עודכנה/); assert.match(h.text(), /אימות קוד או שליחה חוזרת/); await h.finish();
});
for (const point of ['create', 'remember', 'assign']) test(`${point} callback-triggered unmount has no later effects/setter`, async () => {
  const h = harness(); let after;
  h.callbacks({ [point]: () => { h.cleanup(); after = h.snapshot(); } }); h.submit();
  if (point !== 'create') { await h.auth(); await h.rpc(); await h.queries(); }
  await tick(); assert.ok(after); assert.deepEqual(h.snapshot(), after);
  assert.equal(h.navigations.length, point === 'assign' ? 1 : 0);
});
test('layout reconnect releases canceled login without automatic SDK or cleanup signOut', async () => {
  const h = harness(); h.submit(); h.render(); h.reconnect(); assert.equal(h.button().props.disabled, false); assert.equal(h.attempts.length, 1); assert.equal(h.snapshot().signouts, 0);
  h.submit(); await h.finish(); assert.equal(h.attempts.length, 2);
});
