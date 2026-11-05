import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Disconnected actual server page and actual client initial render. No handlers.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const pageSource = read(new URL('../../app/dashboard/admin/policies/page.tsx', import.meta.url));
const managerSource = read(new URL('../../components/policies-manager.tsx', import.meta.url));
const compile = source => {
  const r = ts.transpileModule(source, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal(r.diagnostics.length, 0); return r.outputText;
};
const pageCode = compile(pageSource), managerCode = compile(managerSource), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url)));
const plain = value => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({type, props: props ?? {}, key});
function nodes(value, type) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(item => nodes(item, type));
  return [...(value.type === type ? [value] : []), ...Object.values(value.props ?? {}).flatMap(item => nodes(item, type))];
}
function text(value) {
  if (value == null || typeof value === 'boolean' || typeof value === 'function') return '';
  if (typeof value !== 'object') return String(value);
  return Array.isArray(value) ? value.map(text).join('') : text(value.props?.children);
}
const labels = {kindergarten: 'תקנון גני ילדים', parent: 'תקנון הורים', inspector: 'תקנון מפקחים', staff: 'תקנון צוות'};
const policy = overrides => ({id: 'SYNTHETIC_POLICY_ID', policy_type: 'kindergarten', title: 'SYNTHETIC_POLICY_TITLE', body: 'SYNTHETIC_POLICY_BODY', version: 7, active: true, published_at: '2026-11-05T01:00:00.000Z', ...overrides});
const acceptance = overrides => ({id: 'SYNTHETIC_ACCEPTANCE_ID', policy_type: 'kindergarten', user_id: 'SYNTHETIC_USER_ID', profiles: {full_name: 'SYNTHETIC_USER_NAME'}, version: 7, accepted_at: '2026-11-05T02:00:00.000Z', ...overrides});
function load(code, require, warn, denied) {
  const exports = {};
  vm.runInNewContext(code, {exports, require, process: {env: {}}, fetch: denied, FormData: denied, console: {warn}}); return exports;
}
function manager(props, options = {}) {
  let effects = 0, hooks = 0;
  const denied = () => { effects++; throw Error('UNEXPECTED_SIDE_EFFECT'); };
  const exported = load(managerCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === 'react') return {useState: initial => {
      const index = hooks++; assert.ok(index < 2);
      return [index === 0 ? options.retainedRows ?? initial : options.activeType ?? initial, denied];
    }};
    return denied();
  }, denied, denied);
  const tree = exported.PoliciesManager(props); assert.equal(hooks, 2); assert.equal(effects, 0);
  const tabs = nodes(tree, 'button').filter(node => String(node.props.className).startsWith('tab'));
  assert.deepEqual(tabs.map(text), Object.values(labels)); assert.equal(tabs.filter(node => node.props.className === 'tab active').length, 1);
  const form = nodes(tree, 'form')[0];
  if (props.policiesAvailable !== false) {
    assert.ok(form); assert.equal(form.props.className, 'form'); assert.equal(form.props.onSubmit.name, 'publish');
    assert.equal(typeof form.props.onSubmit, 'function'); assert.equal(nodes(form, 'input')[0].props.name, 'title');
    assert.equal(nodes(form, 'input')[0].props.required, true); assert.equal(nodes(form, 'textarea')[0].props.rows, 12); assert.equal(nodes(form, 'textarea')[0].props.required, true);
    assert.equal(text(nodes(form, 'button')[0]), 'פרסום גרסה חדשה');
  } else {
    assert.equal(form, undefined); assert.equal(nodes(tree, 'input').length, 0); assert.equal(nodes(tree, 'textarea').length, 0);
    assert.ok(text(tree).includes('עריכת התקנון אינה זמינה')); assert.ok(text(tree).includes('גרסת התקנון ומצבו אינם זמינים'));
    assert.equal(nodes(tree, 'span').filter(node => node.props.className === 'pill good').length, 0);
  }
  if (props.acceptancesAvailable === false) { assert.ok(text(tree).includes('נתוני אישורי המשתמשים אינם זמינים')); assert.ok(!text(tree).includes('אין אישורים עדיין.')); }
  return {tree, form, tabs, effects};
}
const expected = table => table === 'policies' ? [['from', table], ['select', '*'], ['order', 'policy_type'], ['order', 'version', {ascending: false}]] : [['from', table], ['select', '*, profiles:user_id(full_name, role)'], ['order', 'accepted_at', {ascending: false}], ['limit', 200]];
const failed = mode => mode.startsWith('error-') || ['query-reject', 'factory-throws', 'chain-throws'].includes(mode);
async function render(modes = {}, supplied = {}, outer = 'healthy', options = {}) {
  let clients = 0, admissions = 0, effects = 0;
  const calls = {policies: [], policy_acceptances: []}, logs = [];
  const denied = () => { effects++; throw Error('UNEXPECTED_SIDE_EFFECT'); };
  const warn = (...args) => logs.push(args);
  const safe = load(helperCode, denied, warn, denied);
  const client = {from(table) {
    assert.ok(table in calls); const mode = modes[table] ?? 'healthy'; calls[table].push(['from', table]);
    if (mode === 'factory-throws') throw Error('PRIVATE_FACTORY');
    const q = {};
    for (const method of ['select', 'order', 'limit']) q[method] = (...args) => { calls[table].push([method, ...args]); if (mode === 'chain-throws') throw Error('PRIVATE_CHAIN'); return q; };
    q.then = (resolve, reject) => (mode === 'query-reject' ? Promise.reject(Error('PRIVATE_REJECTION')) : Promise.resolve({
      data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : supplied[table] ?? [table === 'policies' ? policy() : acceptance()],
      error: mode.startsWith('error-') ? {message: 'PRIVATE_ERROR', details: 'PRIVATE_DETAILS'} : null,
    })).then(resolve, reject); return q;
  }};
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/components/policies-manager') return {PoliciesManager: 'PoliciesManager'};
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (outer === 'denied') throw Error('DENIED'); }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (outer === 'loader-throws') throw Error('PRIVATE_LOADER'); return client; }};
    return denied();
  }, warn, denied);
  if (outer === 'denied') { await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.deepEqual(calls, {policies: [], policy_acceptances: []}); assert.deepEqual(logs, []); assert.equal(effects, 0); return null; }
  const tree = await page.default(); const props = nodes(tree, 'PoliciesManager')[0].props;
  const shell = nodes(tree, 'DashboardShell')[0]; assert.equal(shell.props.role, 'admin'); assert.equal(shell.props.title, 'תקנונים');
  assert.ok(text(tree).includes('ניהול תקנונים ואישורי משתמשים.')); assert.ok(text(tree).includes('פרסום גרסאות חדשות מחייב את המשתמשים לאשר מחדש לפי תפקיד.'));
  assert.equal(clients, 1);
  const bothUnknown = outer === 'loader-throws';
  const unavailable = table => bothUnknown || failed(modes[table] ?? 'healthy');
  for (const [table, field, flag] of [['policies', 'policies', 'policiesAvailable'], ['policy_acceptances', 'acceptances', 'acceptancesAvailable']]) {
    assert.equal(props[flag], !unavailable(table));
    if (unavailable(table)) assert.deepEqual(plain(props[field]), []);
    if (bothUnknown) assert.deepEqual(calls[table], []);
    else if (!['factory-throws', 'chain-throws'].includes(modes[table])) assert.deepEqual(plain(calls[table]), expected(table));
  }
  const unknown = unavailable('policies') || unavailable('policy_acceptances');
  assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), unknown);
  assert.equal(nodes(tree, 'span')[0].props.className, unknown ? 'pill' : 'pill good'); assert.equal(text(nodes(tree, 'span')[0]), 'Policy Gate');
  assert.equal(logs.length, unknown ? 1 : 0); if (unknown) assert.equal(logs[0][1], 'policies');
  assert.ok(!JSON.stringify(logs).includes('PRIVATE_')); assert.ok(!text(tree).includes('PRIVATE_'));
  const clientTree = manager(props, options); assert.equal(effects, 0);
  if (unavailable('policies')) assert.ok(!text(clientTree.tree).includes('SYNTHETIC_POLICY_TITLE'));
  if (unavailable('policy_acceptances')) assert.ok(!text(clientTree.tree).includes('SYNTHETIC_USER_NAME'));
  return {...clientTree, props, page: tree};
}
for (const table of ['policies', 'policy_acceptances']) {
  for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'query-reject', 'factory-throws', 'chain-throws']) {
    test(`${table}: ${mode} retains independent neighbor`, () => render({[table]: mode}, {[table]: [table === 'policies' ? policy({published_at: mode === 'error-stale' ? 'INVALID_DATE' : null}) : acceptance({accepted_at: mode === 'error-stale' ? 'INVALID_DATE' : '2026-11-05T00:00:00Z'})]}));
  }
  for (const neighbor of ['empty', 'null']) test(`${table}: rejected retains known ${neighbor} neighbor`, () => render({[table]: 'query-reject', [table === 'policies' ? 'policy_acceptances' : 'policies']: neighbor}));
}
for (const [policies, policy_acceptances] of [['error-stale', 'query-reject'], ['factory-throws', 'chain-throws']]) test(`both unavailable ${policies}/${policy_acceptances}`, () => render({policies, policy_acceptances}));
for (const outer of ['loader-throws', 'denied']) test(`outer ${outer}`, () => render({}, {}, outer));
for (const flags of [{policiesAvailable: false}, {acceptancesAvailable: false}, {policiesAvailable: false, acceptancesAvailable: false}]) {
  test(`direct stale props flags ${JSON.stringify(flags)}`, () => {
    const r = manager({policies: [policy()], acceptances: [acceptance()], ...flags});
    if (flags.policiesAvailable === false) assert.ok(!text(r.tree).includes('SYNTHETIC_POLICY_TITLE'));
    if (flags.acceptancesAvailable === false) assert.ok(!text(r.tree).includes('SYNTHETIC_USER_NAME'));
    else assert.ok(text(r.tree).includes('SYNTHETIC_USER_NAME'));
  });
}
test('retained previous useState rows remain hidden when current policies unavailable', () => {
  const r = manager({policies: [], acceptances: [acceptance()], policiesAvailable: false}, {retainedRows: [policy({published_at: 'INVALID_DATE'})]});
  assert.equal(r.form, undefined); assert.ok(!text(r.tree).includes('SYNTHETIC_POLICY_TITLE')); assert.ok(text(r.tree).includes('SYNTHETIC_USER_NAME'));
});
test('optional flags omitted retain existing caller behavior', () => {
  const r = manager({policies: [policy()], acceptances: [acceptance()]}); assert.equal(nodes(r.form, 'input')[0].props.defaultValue, 'SYNTHETIC_POLICY_TITLE'); assert.ok(text(r.tree).includes('SYNTHETIC_USER_NAME'));
});
for (const activeType of Object.keys(labels)) for (const activeFirst of [true, false]) {
  test(`${activeType}: original ${activeFirst ? 'active-first' : 'first-matching fallback'}`, () => {
    const rows = [policy({policy_type: activeType, active: false, title: 'SYNTHETIC_FIRST'}), policy({policy_type: activeType, active: activeFirst ? 'false' : false, title: 'SYNTHETIC_SECOND'})];
    const r = manager({policies: rows, acceptances: []}, {activeType}); assert.equal(nodes(r.form, 'input')[0].props.defaultValue, activeFirst ? 'SYNTHETIC_SECOND' : 'SYNTHETIC_FIRST');
    assert.equal(text(r.tabs.find(tab => tab.props.className === 'tab active')), labels[activeType]);
  });
}
for (const value of [null, undefined, 0, '', false]) test(`known policy nullish defaults ${String(value)}`, () => {
  const r = manager({policies: [policy({title: value, body: value, version: value, active: value, published_at: null})], acceptances: []});
  assert.equal(nodes(r.form, 'input')[0].props.defaultValue, value ?? labels.kindergarten); assert.equal(nodes(r.form, 'textarea')[0].props.defaultValue, value ?? '');
  assert.ok(text(r.tree).includes(`גרסה ${value === false ? '' : value ?? 1} · טיוטה`));
});
test('acceptance policy_type strict filter remains exact', () => {
  const r = manager({policies: [], acceptances: [acceptance(), acceptance({policy_type: 'Kindergarten', profiles: {full_name: 'EXCLUDED_UPPER'}}), acceptance({policy_type: 'parent', profiles: {full_name: 'EXCLUDED_PARENT'}}), acceptance({policy_type: null, profiles: {full_name: 'EXCLUDED_NULL'}})]});
  assert.ok(text(r.tree).includes('SYNTHETIC_USER_NAME')); assert.ok(!text(r.tree).includes('EXCLUDED_'));
});
test('known empty policies permit original new form and default version while known acceptances remain', () => {
  const r = manager({policies: [], acceptances: [acceptance()]}); assert.equal(nodes(r.form, 'input')[0].props.defaultValue, labels.kindergarten);
  assert.equal(nodes(r.form, 'textarea')[0].props.defaultValue, ''); assert.ok(text(r.tree).includes('גרסה 1 · טיוטה')); assert.ok(text(r.tree).includes('לא פעיל')); assert.ok(text(r.tree).includes('SYNTHETIC_USER_NAME'));
});
for (const value of [null, undefined, '', 0]) test(`acceptance name nullish fallback ${String(value)}`, () => {
  const r = manager({policies: [], acceptances: [acceptance({profiles: {full_name: value}})]});
  const strong = nodes(r.tree, 'strong').map(text); assert.ok(strong.includes(String(value ?? 'SYNTHETIC_USER_ID')));
});
for (const value of [null, undefined, 0, '', '2026-11-05T03:00:00.000Z']) test(`policy published_at truthy rendering ${String(value)}`, () => {
  const r = manager({policies: [policy({published_at: value})], acceptances: []}); assert.ok(text(r.tree).includes(value ? new Date(value).toLocaleString('he-IL') : 'טיוטה'));
});
test('acceptance duplicates, key/order/version/locale retained beyond fetch cap without local clamp', () => {
  const acceptances = Array.from({length: 201}, (_, i) => acceptance({id: 'SYNTHETIC_DUPLICATE', profiles: {full_name: `SYNTHETIC_ORDER_${i}`}, version: i % 2 ? 0 : ''}));
  const r = manager({policies: [], acceptances}); assert.deepEqual(nodes(r.tree, 'strong').map(text).slice(1), acceptances.map(item => item.profiles.full_name));
  assert.ok(text(r.tree).includes(new Date(acceptances[0].accepted_at).toLocaleString('he-IL')));
});
test('portable single DOMAIN hook, role-before-client and unchanged publish binding', () => {
  assert.ok(pageSource.indexOf('await requireRole(["admin"])') < pageSource.indexOf('await safeAdminData('));
  assert.equal((pageSource.match(/supabase\.from\(/g) ?? []).length, 2); assert.ok(managerSource.includes('onSubmit={publish}'));
  const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url)));
  assert.deepEqual(config.domain.filter(item => item.name === 'admin-policies-query-boundary'), [{name: 'admin-policies-query-boundary', args: ['--test', 'scripts/qa/check-admin-policies-query-boundary.mjs']}]);
});
