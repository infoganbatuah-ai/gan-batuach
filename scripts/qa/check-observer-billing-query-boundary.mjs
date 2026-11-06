import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const pages = { dashboard: fs.readFileSync('app/dashboard/admin/observer-billing/page.tsx', 'utf8'), standalone: fs.readFileSync('app/digital-observer/admin/billing/page.tsx', 'utf8') };
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const runtimeSource = fs.readFileSync('lib/domain/digital-observer/runtime.ts', 'utf8');
const tables = { dashboard: ['observer_site_subscriptions', 'observer_billing_events', 'observer_usage_tracking', 'observer_monitoring_packages'], standalone: ['observer_site_subscriptions', 'observer_payment_provider_readiness', 'observer_billing_events'] };
const unavailable = 'לא זמין';
function load(text, require, fetch) {
  const exports = {};
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, require, fetch, console: { warn() {} }, Date, Intl });
  return exports;
}
const never = () => { throw Error('NETWORK_OR_UNEXPECTED_IMPORT_FORBIDDEN'); };
const safe = load(helper, never, never);
const runtime = load(runtimeSource, () => new Proxy({}, { get: () => never }), never);
async function render(route, { fail = [], stale = true, empty = [], overrides = {}, rejectAt = -1, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0, admissions = 0, network = 0;
  const denied = Error('DENIED');
  const noNetwork = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
  const fixtures = tables[route].map((_, i) => [{ id: `ID_${i}`, status: 'active', subscription_status: 'active', entitlement_status: 'active', billing_cycle: 'monthly', observer_sites: { name: `ROW_${i}`, site_type: 'home' }, observer_monitoring_packages: { name: 'ROW_PLAN', monthly_price: 125, annual_price: 1250, currency: 'ILS' }, provider_name: `ROW_${i}`, provider_key: 'synthetic', mode: 'mock', event_type: `ROW_EVENT_${i}`, period_start: '2026-01-01', active_cameras: 2, ai_events_count: 5, created_at: '2026-01-01', renewal_date: '2026-02-01' }]);
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' };
  const client = { from(table) {
    const i = calls++; assert.equal(table, tables[route][i]); const builder = {};
    for (const method of ['select', 'order', 'limit']) builder[method] = () => builder;
    builder.then = (ok, bad) => i === rejectAt ? Promise.reject(Error('PRIVATE_ERROR')).then(ok, bad) : Promise.resolve({ data: empty.includes(i) ? [] : fail.includes(i) && !stale ? null : overrides[i] ?? fixtures[i], error: fail.includes(i) ? { message: 'PRIVATE_ERROR' } : null }).then(ok, bad);
    return builder;
  } };
  const require = id => {
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'next/link') return { __esModule: true, default: 'Link' };
    if (id === 'lucide-react') return new Proxy({}, { get: (_, key) => `Icon:${String(key)}` });
    if (id.endsWith('/dashboard-shell')) return { DashboardShell: 'DashboardShell' };
    if (id.endsWith('/observer-app-shell')) return { ObserverAppShell: 'ObserverAppShell' };
    if (id.endsWith('/admin-data-state')) return { AdminDataError: 'AdminDataError' };
    if (id.endsWith('/admin-safe')) return safe;
    if (id.endsWith('/domain/digital-observer/runtime')) return runtime;
    if (id.endsWith('/auth')) return { requireRole: async roles => { admissions++; assert.deepEqual(Array.from(roles), ['admin']); if (deny) throw denied; } };
    if (id.endsWith('/supabase/server')) return { createClient: async () => { clients++; if (thrown) throw Error('PRIVATE_ERROR'); return client; } };
    if (id.endsWith('/domain/digital-observer/admin-access')) return { requireDigitalObserverAdmin: async path => { admissions++; assert.equal(path, '/digital-observer/admin/billing'); if (deny) throw denied; return { profile: { id: 'SYNTHETIC_ADMIN' } }; }, createDigitalObserverAdminDataClient: () => { clients++; if (thrown) throw Error('PRIVATE_ERROR'); return client; } };
    throw Error(`UNEXPECTED_IMPORT ${id}`);
  };
  let tree;
  try { tree = await load(pages[route], require, noNetwork).default(); }
  catch (error) { assert.equal(error, denied); assert.equal(clients, 0); assert.equal(calls, 0); return { denied: true }; }
  const nodes = [], strings = [];
  function walk(value) { if (Array.isArray(value)) return value.forEach(walk); if (typeof value === 'string' || typeof value === 'number') strings.push(String(value)); else if (value && typeof value === 'object') { nodes.push(value); walk(value.props?.children); } }
  walk(tree);
  const text = node => { const out = []; function visit(value) { if (Array.isArray(value)) return value.forEach(visit); if (typeof value === 'string' || typeof value === 'number') out.push(String(value)); else if (value && typeof value === 'object') visit(value.props?.children); } visit(node); return out.join(' '); };
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : tables[route].length); assert.equal(network, 0);
  return { nodes, strings, metrics: nodes.filter(n => n.type === 'article' && ['metric-card', 'do-metric', 'do-metric alert'].includes(n.props.className)).map(text), banner: route === 'dashboard' ? nodes.find(n => n.type === 'AdminDataError')?.props.message : nodes.find(n => n.props?.role === 'alert')?.props.children?.props?.children };
}

test('fixed queries, helpers, formulas, auth, policy and hook need no Git history', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  const query = s => s.slice(s.indexOf('    const [subscriptions,'), s.indexOf('    [subscriptions,'));
  assert.equal(sha(query(pages.dashboard)), '4e8faaa8811d76689fb4792f6e73ab4b9f2691848ff67bd26b6cd70d7253e7c6');
  assert.equal(sha(query(pages.standalone)), '088354bb9a6e6474c2689611939c9878bf73c8bebbda1268ade1032fdca23b25');
  assert.equal(sha(pages.dashboard.slice(pages.dashboard.indexOf('function money'), pages.dashboard.indexOf('async function safeQuery'))), 'f9c6b764a7f7167a2ba8c42791001a1beb3afc5a1ae760123aff209b303ffbf2');
  assert.equal(sha(pages.dashboard.slice(pages.dashboard.indexOf('  const active ='), pages.dashboard.indexOf('\n\n  return ('))), 'e153053caff66940147a8f1439855aeb3e6ace452f3a1377ac8abccac63775c6');
  assert.equal(sha(pages.standalone.slice(pages.standalone.indexOf('  const trials ='), pages.standalone.indexOf('\n\n  return <'))), '9e5587d3a0b9171b5a81f43acc93db4b5a344f60535a9d74f48f484e1553cfaa');
  assert.equal(sha(runtimeSource), '86770e0f6bcf4318244e2cfcc6bf4b301962dabdb00361c52042da3350393f36');
  assert.ok(pages.dashboard.includes('await requireRole(["admin"])')); assert.ok(pages.standalone.includes('await requireDigitalObserverAdmin("/digital-observer/admin/billing")'));
  assert.deepEqual(Array.from(pages.standalone.matchAll(/href="([^"]+)"/g), m => m[1]), ['/digital-observer/admin/packages']);
  assert.ok(pages.standalone.includes('גני ילדים ותשלומי הורים אינם כלולים בזרם זה.')); assert.ok(pages.standalone.includes('Mock / Sandbox בלבד'));
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'observer-billing-query-boundary'), [{ name: 'observer-billing-query-boundary', args: ['--test', 'scripts/qa/check-observer-billing-query-boundary.mjs'] }]);
});
for (const route of ['dashboard', 'standalone']) {
  test(`${route}: healthy values and empty data remain distinct from errors`, async () => {
    const r = await render(route); assert.ok(!r.banner); assert.ok(r.metrics[0].startsWith('1 '));
    assert.ok(r.strings.includes('ROW_0')); assert.ok(!r.metrics.some(x => x.includes('חיובים חיים שבוצעו')));
    if (route === 'standalone') { const shell = r.nodes.find(n => n.type === 'ObserverAppShell'); assert.equal(shell.props.mode, 'admin'); assert.equal(shell.props.activeHref, '/digital-observer/admin/billing'); assert.equal(shell.props.statusLabel, 'Mock / Sandbox בלבד'); assert.ok(r.metrics[3].includes('מידע בלבד')); }
    const empty = await render(route, { empty: tables[route].map((_, i) => i) }); assert.ok(!empty.banner); assert.ok(empty.metrics[0].startsWith('0 '));
    assert.equal((await render(route, { deny: true })).denied, true);
  });
  for (let i = 0; i < tables[route].length; i++) test(`${route}: source ${i} null/stale errors and rejection do not hide healthy sources`, async () => {
    for (const args of [{ fail: [i] }, { fail: [i], stale: false }, { rejectAt: i }]) {
      const r = await render(route, args); assert.ok(r.banner); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
      if (i === 0) { assert.ok(r.metrics.slice(0, route === 'dashboard' ? 4 : 3).every(x => x.startsWith(unavailable))); assert.ok(!r.strings.includes('ROW_0')); assert.ok(!r.strings.includes('אין מנויים להצגה')); assert.ok(r.strings.includes(route === 'dashboard' ? 'ROW_EVENT_1' : 'ROW_1')); assert.ok(r.strings.includes('ROW_2')); }
      else { assert.ok(r.metrics[0].startsWith('1 ')); assert.ok(r.strings.includes('ROW_0')); }
      if (route === 'dashboard' && i === 1) { assert.ok(r.strings.includes('נתוני האירועים אינם זמינים כרגע')); assert.ok(!r.strings.includes('ROW_EVENT_1')); }
      if (route === 'dashboard' && i === 2) { assert.ok(r.strings.includes('נתוני השימוש אינם זמינים כרגע')); assert.ok(!r.strings.includes('ROW_2')); }
      if (route === 'dashboard' && i === 3) assert.ok(r.metrics[3].includes('125'));
      if (route === 'standalone' && i === 1) { assert.ok(r.strings.includes('נתוני הספקים אינם זמינים כרגע')); assert.ok(!r.strings.includes('אין ספק חי מוגדר')); assert.ok(!r.strings.includes('ROW_1')); }
      if (route === 'standalone' && i === 2) { assert.ok(r.strings.includes('נתוני האירועים אינם זמינים כרגע')); assert.ok(!r.strings.includes('אין אירועי חיוב')); assert.ok(!r.strings.includes('ROW_2')); }
      assert.ok(!r.metrics.some(x => x.includes('חיובים חיים שבוצעו')));
    }
  });
  test(`${route}: whole-loader and all source failures fail closed`, async () => {
    for (const args of [{ thrown: true }, { fail: tables[route].map((_, i) => i) }]) { const r = await render(route, args); assert.ok(r.banner); assert.ok(r.metrics.slice(0, route === 'dashboard' ? 4 : 3).every(x => x.startsWith(unavailable))); }
  });
}
test('dashboard annual, monthly, zero and lifecycle predicates are preserved', async () => {
  const subscriptions = [
    { id: 'a', status: 'active', billing_cycle: 'annual', observer_monitoring_packages: { name: 'A', annual_price: 1200, monthly_price: 100 } },
    { id: 'b', status: 'active', billing_cycle: 'monthly', observer_monitoring_packages: { name: 'B', annual_price: 500, monthly_price: 0 } },
    { id: 'c', status: 'trial' }, { id: 'd', status: 'overdue' }, { id: 'e', status: 'pending_payment' }, { id: 'f', status: 'suspended' }
  ];
  const r = await render('dashboard', { overrides: { 0: subscriptions }, fail: [3] }); assert.ok(r.banner); assert.ok(r.metrics[0].startsWith('2 ')); assert.ok(r.metrics[1].startsWith('1 ')); assert.ok(r.metrics[2].startsWith('2 ')); assert.ok(r.metrics[3].includes('1,200'));
  const zero = await render('dashboard', { overrides: { 0: [subscriptions[1]] } }); assert.ok(zero.metrics[3].includes('0'));
});
test('standalone status fallback and pending precedence remain intact', async () => {
  const rows = [{ id: 'a', status: null, subscription_status: 'trial', observer_sites: { name: 'TRIAL_SITE' } }, { id: 'b', status: null, subscription_status: 'overdue', observer_sites: { name: 'PENDING_SITE' } }, { id: 'c', status: 'active', subscription_status: 'overdue', observer_sites: { name: 'ACTIVE_SITE' } }];
  const r = await render('standalone', { overrides: { 0: rows } }); assert.ok(r.metrics[0].startsWith('3 ')); assert.ok(r.metrics[1].startsWith('1 ')); assert.ok(r.metrics[2].startsWith('1 ')); assert.ok(r.strings.includes('TRIAL_SITE')); assert.ok(r.strings.includes('PENDING_SITE'));
});
