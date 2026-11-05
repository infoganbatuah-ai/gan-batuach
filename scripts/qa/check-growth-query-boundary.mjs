import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const source = fs.readFileSync('app/dashboard/admin/growth/page.tsx', 'utf8');
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const tables = ['growth_leads', 'leads', 'growth_parent_demand_clusters', 'growth_campaign_metrics', 'growth_follow_up_tasks', 'growth_lead_communications', 'growth_conversion_events', 'growth_referrals'];
const unavailable = 'לא זמין';
function load(text, require, fetch) {
  const exports = {};
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, require, fetch, console: { warn() {} }, Date, Intl });
  return exports;
}
const never = () => { throw Error('NETWORK_OR_UNEXPECTED_IMPORT_FORBIDDEN'); };
const safe = load(helper, never, never);
const fixtures = tables.map((_, i) => [{ id: `ROW_${i}`, garden_name: `ROW_${i}`, contact_name: `CONTACT_${i}`, parent_name: `CONTACT_${i}`, title: `ROW_${i}`, campaign_name: `ROW_${i}`, template_key: `ROW_${i}`, referred_garden_name: `ROW_${i}`, lead_source: 'demo_booking', source: 'kindergarten_registration', status: 'new', interest_score: 80, lead_score: 90, city: `CITY_${i}`, high_demand: true, request_count: 3, parent_contacts: 2, event_type: 'conversion', leads: 10 }]);
fixtures[1][0].status = 'converted';
fixtures[0][0].status = 'qualified';

async function render({ fail = [], stale = true, empty = [], overrides = {}, rejectAt = -1, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0, admissions = 0, network = 0;
  const denied = Error('DENIED');
  const noNetwork = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const client = { from(table) {
    const i = calls++; assert.equal(table, tables[i]);
    const builder = {};
    for (const method of ['select', 'eq', 'order', 'limit']) builder[method] = () => builder;
    builder.then = (ok, bad) => i === rejectAt ? Promise.reject(Error('PRIVATE_ERROR')).then(ok, bad) : Promise.resolve({ data: empty.includes(i) ? [] : fail.includes(i) && !stale ? null : overrides[i] ?? fixtures[i], error: fail.includes(i) ? { message: 'PRIVATE_ERROR' } : null }).then(ok, bad);
    return builder;
  } };
  const require = id => {
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'next/link') return { __esModule: true, default: 'Link' };
    if (id === 'lucide-react') return new Proxy({}, { get: (_, key) => `Icon:${String(key)}` });
    if (id.endsWith('/dashboard-shell')) return { DashboardShell: 'DashboardShell' };
    if (id.endsWith('/premium-dashboard')) return new Proxy({}, { get: (_, key) => String(key) });
    if (id.endsWith('/admin-data-state')) return { AdminDataError: 'AdminDataError' };
    if (id.endsWith('/admin-safe')) return safe;
    if (id.endsWith('/auth')) return { requireRole: async roles => { admissions++; assert.deepEqual(Array.from(roles), ['admin']); if (deny) throw denied; } };
    if (id.endsWith('/supabase/server')) return { createClient: async () => { clients++; if (thrown) throw Error('PRIVATE_ERROR'); return client; } };
    throw Error(`UNEXPECTED_IMPORT ${id}`);
  };
  let tree;
  try { tree = await load(source, require, noNetwork).default(); }
  catch (error) { assert.equal(error, denied); assert.equal(clients, 0); assert.equal(calls, 0); return { denied: true }; }
  const nodes = [], strings = [];
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (typeof value === 'string') return strings.push(value);
    if (value && typeof value === 'object') { if (typeof value.type === 'function') return walk(value.type(value.props ?? {})); nodes.push(value); walk(value.props?.children); }
  }
  walk(tree);
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : 8); assert.equal(network, 0);
  return { nodes, strings, banner: nodes.find(n => n.type === 'AdminDataError')?.props.message,
    hero: nodes.find(n => n.type === 'PremiumDashboardHero')?.props,
    metric: label => nodes.find(n => n.type === 'RoleMetricCard' && n.props.label === label)?.props,
    empty: nodes.filter(n => n.type === 'EmptyState').map(n => n.props.title) };
}

test('fixed query, helper and link contracts and unique CI hook need no Git history', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  assert.deepEqual(Array.from(source.matchAll(/supabase\.from\("([^"]+)"/g), m => m[1]), tables);
  assert.equal(sha(source.split('\n').filter(line => line.includes('supabase.from(')).join('\n')), '5e3881dc4fe999a5b13d84350e2530fd4d720011d56dcc9d6a8e38e12e6e2f5a');
  assert.equal(sha(source.slice(source.indexOf('function pct('), source.indexOf('export default async function'))), 'f63e39c57849284b093bd4afde1222d58325078f702c6b3ad8a48d5604275bc1');
  assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g), m => m[1]), ['/dashboard/admin/leads', '/book-demo', '/dashboard/admin/leads', '/parents-demand', '/dashboard/admin/growth', '/dashboard/admin/growth', '/dashboard/admin/growth', '/dashboard/admin/growth', '/book-demo', '/join-kindergarten', '/parents-demand', '/dashboard/admin/leads']);
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'growth-query-boundary'), [{ name: 'growth-query-boundary', args: ['--test', 'scripts/qa/check-growth-query-boundary.mjs'] }]);
});

test('healthy data and healthy-empty fallbacks preserve expected values', async () => {
  const r = await render(); assert.equal(r.banner, null); assert.equal(r.metric('לידים').value, 1); assert.equal(r.metric('1. ביקורים').value, 0);
  assert.equal(r.metric('ציון עניין').value, 80); assert.ok(r.strings.includes('ROW_0')); assert.ok(r.strings.includes('ROW_3'));
  const legacy = await render({ empty: [0, 3, 6] }); assert.equal(legacy.metric('לידים').value, 1); assert.equal(legacy.hero.badge, '100% המרה');
  assert.equal(legacy.metric('ציון עניין').value, 90); assert.equal(legacy.metric('1. ביקורים').value, 1); assert.ok(legacy.strings.includes('ROW_7'));
  const empty = await render({ empty: tables.map((_, i) => i) }); assert.equal(empty.banner, null); assert.equal(empty.metric('לידים').value, 0); assert.equal(empty.metric('1. ביקורים').value, 0); assert.ok(empty.empty.includes('אין לידים להצגה'));
});

for (let i = 0; i < 8; i++) test(`source ${i} failures disclose unavailability and discard stale rows`, async () => {
  for (const stale of [true, false]) {
    const r = await render({ fail: [i], stale });
    assert.ok(r.banner); assert.ok(!r.banner.includes('Phase 143')); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
    if ([0, 2, 3, 4, 5].includes(i)) assert.ok(!r.strings.includes(`ROW_${i}`));
    if (i === 0) { assert.equal(r.hero.badge, unavailable); assert.equal(r.metric('לידים').value, unavailable); assert.ok(!r.strings.includes('ROW_1')); assert.ok(!r.empty.includes('אין לידים להצגה')); }
    if (i === 2) { assert.ok(!r.empty.includes('אין עדיין אשכולות ביקוש')); assert.ok(r.strings.includes('נתוני הביקוש אינם זמינים כרגע')); assert.ok(JSON.stringify(r.hero.children).includes(unavailable)); }
    if (i === 4) { assert.ok(r.strings.includes('נתוני המשימות אינם זמינים כרגע.')); assert.ok(!r.strings.includes('אין משימות פתוחות.')); }
    if (i === 5) { assert.ok(r.strings.includes('נתוני התקשורת אינם זמינים כרגע.')); assert.ok(!r.strings.includes('תבניות WhatsApp, SMS ומייל מוכנות במודל הנתונים.')); }
    if (i === 6) assert.equal(r.metric('1. ביקורים').value, unavailable);
  }
});

test('lead fallback requires healthy primary and healthy selected legacy', async () => {
  const primary = await render({ fail: [1] }); assert.equal(primary.metric('לידים').value, 1); assert.ok(primary.strings.includes('ROW_0'));
  const failedPrimary = await render({ fail: [0] }); assert.equal(failedPrimary.metric('לידים').value, unavailable); assert.equal(failedPrimary.metric('ערים').value, unavailable); assert.equal(failedPrimary.metric('2. לידים').hint, unavailable);
  const failedFallback = await render({ empty: [0], fail: [1] }); assert.equal(failedFallback.metric('לידים').value, unavailable); assert.ok(!failedFallback.empty.includes('אין לידים להצגה'));
  const legacy = await render({ empty: [0] }); assert.equal(legacy.metric('המרות').value, 1); assert.ok(legacy.strings.includes('ROW_1'));
});

test('campaign selection does not conceal primary or required fallback failures', async () => {
  const primary = await render({ fail: [7] }); assert.ok(primary.strings.includes('ROW_3')); assert.ok(primary.banner);
  const failedPrimary = await render({ fail: [3] }); assert.ok(!failedPrimary.strings.includes('ROW_7')); assert.ok(failedPrimary.strings.includes('נתוני הקמפיינים וההפניות אינם זמינים כרגע.'));
  const fallback = await render({ empty: [3] }); assert.ok(fallback.strings.includes('ROW_7'));
  const failedFallback = await render({ empty: [3], fail: [7] }); assert.ok(!failedFallback.strings.includes('אין עדיין נתוני קמפיין או הפניה.')); assert.ok(failedFallback.strings.includes('נתוני הקמפיינים וההפניות אינם זמינים כרגע.'));
});

test('visit count is independent when measured and fallback requires healthy leads', async () => {
  const zero = await render(); assert.equal(zero.metric('1. ביקורים').value, 0);
  const empty = await render({ empty: [6] }); assert.equal(empty.metric('1. ביקורים').value, 1);
  const failed = await render({ fail: [6] }); assert.equal(failed.metric('1. ביקורים').value, unavailable); assert.equal(failed.metric('2. לידים').value, 1);
  const independent = await render({ fail: [0], overrides: { 6: [{ event_type: 'visit' }, { event_type: 'visit' }] } }); assert.equal(independent.metric('1. ביקורים').value, 2); assert.equal(independent.metric('2. לידים').value, unavailable);
  const noFallback = await render({ fail: [0], empty: [6] }); assert.equal(noFallback.metric('1. ביקורים').value, unavailable);
});

test('mixed panels preserve healthy neighbors and denial or whole-loader failure stays closed', async () => {
  const mixed = await render({ fail: [2, 4, 5] }); assert.ok(mixed.strings.includes('ROW_3')); assert.equal(mixed.metric('לידים').value, 1); assert.ok(mixed.strings.includes('נתוני המשימות אינם זמינים כרגע.'));
  for (const args of [{ thrown: true }, ...tables.map((_, rejectAt) => ({ rejectAt }))]) { const r = await render(args); assert.ok(r.banner); assert.equal(r.hero.badge, unavailable); assert.equal(r.metric('לידים').value, unavailable); assert.equal(r.metric('1. ביקורים').value, unavailable); }
  assert.equal((await render({ deny: true })).denied, true);
});
