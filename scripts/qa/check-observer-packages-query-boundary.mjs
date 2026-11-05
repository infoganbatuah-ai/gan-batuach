import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const dashboard = fs.readFileSync('app/dashboard/admin/observer-packages/page.tsx', 'utf8');
const standalone = fs.readFileSync('app/digital-observer/admin/packages/page.tsx', 'utf8');
const component = fs.readFileSync('components/observer-packages-admin.tsx', 'utf8');
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const tables = ['observer_monitoring_packages', 'observer_sites', 'observer_site_subscriptions', 'observer_site_usage_snapshots'];
const fixtures = [[{ id: 'PACKAGE_ID', name: 'SYNTHETIC_PACKAGE', package_type: 'home', active: true, monthly_price: 0, annual_price: 0, event_retention_days: 30 }], [{ id: 'SITE_ID', name: 'SYNTHETIC_SITE', site_type: 'home' }], [{ id: 'SUB_ID', status: 'SYNTHETIC_SUB', observer_sites: { name: 'SUB_SITE' }, observer_monitoring_packages: { name: 'SUB_PACKAGE' } }], [{ id: 'USAGE_ID', observer_sites: { name: 'USAGE_SITE' }, period_start: 'start', period_end: 'end', active_cameras: 1, ai_events_count: 2 }]];
const unavailable = 'לא זמין';
function load(text, require, fetch) {
  const exports = {};
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, require, fetch, console: { warn() {} }, Date, Intl });
  return exports;
}
const never = () => { throw Error('NETWORK_OR_UNEXPECTED_IMPORT_FORBIDDEN'); };
const safe = load(helper, never, never);
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' };
function componentRenderer() {
  let cursor = 0, state = [], calls = 0;
  const react = { useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value; }]; }, useMemo(fn) { return fn(); }, useTransition() { return [false, never]; } };
  const req = id => { if (id === 'react/jsx-runtime') return jsx; if (id === 'react') return react; if (id === 'next/navigation') return { useRouter: () => ({ refresh: never }) }; if (id === 'lucide-react') return new Proxy({}, { get: (_, key) => `Icon:${String(key)}` }); throw Error(`UNEXPECTED_COMPONENT_IMPORT ${id}`); };
  const fn = load(component, req, () => { calls++; throw Error('NETWORK_FORBIDDEN'); }).ObserverPackagesAdmin;
  return { render(props) { cursor = 0; const tree = fn(props); assert.equal(calls, 0); return inspect(tree); } };
}
function inspect(tree) {
  const nodes = [], strings = [];
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value === 'string') return strings.push(value);
    if (value && typeof value === 'object') { nodes.push(value); walk(value.props?.children); }
  }
  walk(tree);
  return { nodes, strings, json: JSON.stringify(nodes), metrics: nodes.filter(n => n.type === 'article' && n.props.className === 'metric-card').map(n => n.props.children.find(x => x.type === 'strong').props.children), forms: nodes.filter(n => n.type === 'form').map(n => n.props.action.name), snapshot: nodes.find(n => n.type === 'button' && n.props.onClick?.name === 'snapshotUsage')?.props.disabled };
}
async function page(route, { fail = [], stale = true, empty = [], rejectAt = -1, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0, admissions = 0, network = 0;
  const denied = Error('DENIED');
  const noNetwork = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
  const client = { from(table) {
    const i = calls++; assert.equal(table, tables[i]); const builder = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'is', 'neq']) builder[method] = () => builder;
    builder.then = (ok, bad) => i === rejectAt ? Promise.reject(Error('PRIVATE_ERROR')).then(ok, bad) : Promise.resolve({ data: empty.includes(i) ? [] : fail.includes(i) && !stale ? null : fixtures[i], error: fail.includes(i) ? { message: 'PRIVATE_ERROR' } : null }).then(ok, bad);
    return builder;
  } };
  const req = id => {
    if (id === 'react/jsx-runtime') return jsx;
    if (id.endsWith('/dashboard-shell')) return { DashboardShell: 'DashboardShell' };
    if (id.endsWith('/observer-app-shell')) return { ObserverAppShell: 'ObserverAppShell' };
    if (id.endsWith('/observer-packages-admin')) return { ObserverPackagesAdmin: 'ObserverPackagesAdmin' };
    if (id.endsWith('/admin-data-state')) return { AdminDataError: 'AdminDataError' };
    if (id.endsWith('/admin-safe')) return safe;
    if (id.endsWith('/auth')) return { requireRole: async roles => { admissions++; assert.deepEqual(Array.from(roles), ['admin']); if (deny) throw denied; } };
    if (id.endsWith('/supabase/server')) return { createClient: async () => { clients++; if (thrown) throw Error('PRIVATE_ERROR'); return client; } };
    if (id.endsWith('/domain/digital-observer/admin-access')) return { requireDigitalObserverAdmin: async path => { admissions++; assert.equal(path, '/digital-observer/admin/packages'); if (deny) throw denied; return { profile: { id: 'SYNTHETIC_PROFILE' } }; }, createDigitalObserverAdminDataClient: () => { clients++; if (thrown) throw Error('PRIVATE_ERROR'); return client; } };
    throw Error(`UNEXPECTED_IMPORT ${id}`);
  };
  let tree;
  try { tree = await load(route === 'dashboard' ? dashboard : standalone, req, noNetwork).default(); }
  catch (error) { assert.equal(error, denied); assert.equal(clients, 0); assert.equal(calls, 0); return { denied: true }; }
  const view = inspect(tree), props = view.nodes.find(n => n.type === 'ObserverPackagesAdmin')?.props;
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : 4); assert.equal(network, 0); assert.ok(props);
  const banner = route === 'dashboard' ? view.nodes.find(n => n.type === 'AdminDataError')?.props.message : view.nodes.find(n => n.props?.role === 'alert')?.props.children?.props?.children;
  return { props, banner, view, render: componentRenderer().render(props) };
}

test('fixed query, authorization, handler, parser, filter and hook contracts need no Git history', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  const queries = s => s.split('\n').filter(line => line.includes('safeQuery(() => supabase.from(')).map(line => line.trim().replace(/^safeQuery\(\(\) => /, '').replace(/\),?$/, '')).join('\n');
  assert.equal(sha(queries(dashboard)), '2d0b7fe1b5abaa59f5d2468175dae098661c5501655ef80dbb90216e9629b50e');
  assert.equal(sha(queries(standalone)), '405df832b8aa4fda523047b77e3aba859b82db8f65eb9a6acbc044ec20847af9');
  assert.ok(dashboard.includes('await requireRole(["admin"])')); assert.ok(standalone.includes('await requireDigitalObserverAdmin("/digital-observer/admin/packages")'));
  assert.ok(standalone.includes('שמירת חבילה אינה מפעילה חיוב חי. הפעלה מסחרית חסומה בשרת עד אישור מפורש וחיבור ספק.'));
  assert.ok(component.includes('אתרי גן ילדים חסומים לשיוך חבילת תצפיתן עצמאית כדי לא לפגוע במנוי גן בטוח.'));
  assert.equal(sha(component.slice(component.indexOf('  async function post('), component.indexOf('  return (\n    <div className="stack">'))), '36fa49298198efe48db77c6bf895c048f07722eb0a7f4aef4c7d8f5ba7ed168b');
  assert.equal(sha(component.slice(component.indexOf('function parseJson'), component.indexOf('export function ObserverPackagesAdmin'))), 'f417ff527997ddf4f4eb8de8bc485008ede1e4ae238ce89189ddd61f1f2af6ef');
  assert.equal(sha(component.split('\n').find(line => line.includes('const standaloneSites ='))), 'd5eb5f1678f6fe5b0cc88f886461660aec3f862fa53b625d24f80a1b922ac8a2');
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'observer-packages-query-boundary'), [{ name: 'observer-packages-query-boundary', args: ['--test', 'scripts/qa/check-observer-packages-query-boundary.mjs'] }]);
  config.domain = config.domain.filter(gate => gate.name !== 'observer-packages-query-boundary');
  assert.equal(sha(JSON.stringify(config)), '4ce1cf5e331ca6b42e3011bc6339a0a51ef318a093e1f156376917a38a5fd206');
});
for (const route of ['dashboard', 'standalone']) {
  test(`${route}: healthy values, empty and authorization`, async () => {
    const r = await page(route); assert.ok(!r.banner); assert.deepEqual(r.render.metrics, [1, 1, 1, 1]); assert.deepEqual(r.render.forms, ['savePackage', 'assignPackage']); assert.equal(r.render.snapshot, false);
    const empty = await page(route, { empty: [0, 1, 2, 3] }); assert.ok(!empty.banner); assert.deepEqual(empty.render.metrics, [0, 0, 0, 0]); assert.ok(empty.render.strings.includes('מוכן להגדרה')); assert.equal(empty.render.snapshot, true);
    assert.equal((await page(route, { deny: true })).denied, true);
    if (route === 'standalone') { const shell = r.view.nodes.find(n => n.type === 'ObserverAppShell'); assert.equal(shell.props.mode, 'admin'); assert.equal(shell.props.activeHref, '/digital-observer/admin/packages'); assert.equal(shell.props.profile.id, 'SYNTHETIC_PROFILE'); assert.ok(r.view.strings.some(s => s.includes('הפעלה מסחרית חסומה'))); }
  });
  for (let i = 0; i < 4; i++) test(`${route}: source ${i} error or rejection strips stale and gates only dependent controls`, async () => {
    for (const args of [{ fail: [i] }, { fail: [i], stale: false }, { rejectAt: i }]) {
      const r = await page(route, args); assert.ok(r.banner); assert.ok(!r.view.json.includes('PRIVATE_ERROR')); assert.equal(r.props.errors[i], true);
      assert.equal(r.props[['packages', 'sites', 'subscriptions', 'usage'][i]].length, 0);
      const expected = [1, 1, 1, 1]; if (i === 0) { expected[0] = unavailable; expected[1] = unavailable; } if (i === 1) expected[2] = unavailable; if (i === 3) expected[3] = unavailable;
      assert.deepEqual(r.render.metrics, expected);
      assert.equal(r.render.forms.includes('savePackage'), i !== 0);
      assert.equal(r.render.forms.includes('assignPackage'), i !== 0 && i !== 1);
      assert.equal(r.render.snapshot, i === 1);
      if (i === 0) assert.ok(!r.render.json.includes('SYNTHETIC_PACKAGE'));
      if (i === 1) assert.ok(!r.render.json.includes('SYNTHETIC_SITE'));
      if (i === 2) { assert.ok(!r.render.strings.includes('SYNTHETIC_SUB')); assert.ok(!r.render.strings.includes('מוכן להגדרה')); }
      if (i === 3) { assert.ok(!r.render.strings.includes('USAGE_SITE')); assert.ok(!r.render.strings.includes('חשב שימוש')); }
    }
  });
  test(`${route}: whole-loader failure fails closed`, async () => { const r = await page(route, { thrown: true }); assert.ok(r.banner); assert.deepEqual(r.render.metrics, Array(4).fill(unavailable)); assert.deepEqual(r.render.forms, []); assert.equal(r.render.snapshot, true); });
}
test('shared component gates stale props across healthy → error → recovery without actions', () => {
  const renderer = componentRenderer(), props = { packages: fixtures[0], sites: fixtures[1], subscriptions: fixtures[2], usage: fixtures[3], errors: [false, false, false, false] };
  let r = renderer.render(props); assert.deepEqual(r.forms, ['savePackage', 'assignPackage']); assert.equal(r.snapshot, false);
  r = renderer.render({ ...props, errors: [true, true, true, true] }); assert.deepEqual(r.forms, []); assert.equal(r.snapshot, true); for (const token of ['SYNTHETIC_PACKAGE', 'SYNTHETIC_SITE', 'SYNTHETIC_SUB', 'USAGE_SITE']) assert.ok(!r.json.includes(token));
  r = renderer.render(props); assert.deepEqual(r.forms, ['savePackage', 'assignPackage']); assert.equal(r.snapshot, false); assert.ok(r.json.includes('SYNTHETIC_PACKAGE')); assert.ok(r.json.includes('SYNTHETIC_SITE'));
  r = renderer.render({ ...props, sites: [], errors: [false, false, false, false] }); assert.equal(r.snapshot, true);
});
