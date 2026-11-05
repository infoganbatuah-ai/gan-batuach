import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const source = fs.readFileSync('app/dashboard/admin/observer-network/page.tsx', 'utf8');
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const domainSource = fs.readFileSync('lib/domain/observer-network.ts', 'utf8');
const tables = ['observer_sites', 'camera_streams', 'camera_streams', 'camera_streams', 'observer_intelligence_signals', 'observer_intelligence_signals', 'observer_intelligence_signals', 'observer_safety_recommendations', 'observer_sites', 'gardens', 'camera_streams', 'observer_signal_reviews', 'compliance_score_snapshots'];
const unavailable = 'לא זמין';
function load(text, require, fetch) {
  const exports = {};
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, require, fetch, console: { warn() {} }, Date, Intl });
  return exports;
}
const never = () => { throw Error('NETWORK_OR_UNEXPECTED_IMPORT_FORBIDDEN'); };
const safe = load(helper, never, never);
const domain = load(domainSource, never, never);
const fixtures = Array.from({ length: 13 }, () => []);
fixtures[6] = [{ id: 'SIG', signal_type: 'motion', source_type: 'camera', kindergarten_id: 'G', risk_score: 90, review_status: 'needs_review', repeated_count: 2, pattern_key: 'ROW_PATTERN', recommended_action: 'ROW_SIGNAL', gardens: { name: 'ROW_SIGNAL_SITE' } }];
fixtures[7] = [{ id: 'R', recommendation_text: 'ROW_RECOMMENDATION', status: 'open', gardens: { name: 'ROW_REC_SITE' } }];
fixtures[8] = [{ id: 'S', name: 'ROW_SITE' }]; fixtures[9] = [{ id: 'G', name: 'ROW_GARDEN', city: 'ROW_CITY' }];
fixtures[10] = [{ id: 'C', garden_id: 'G', status: 'offline', active: true }]; fixtures[11] = [{ id: 'REV', review_status: 'confirmed' }]; fixtures[12] = [{ garden_id: 'G', score: 70 }];
async function render({ fail = [], stale = true, empty = [], overrides = {}, counts = [3, 8, 10, 1, 2, 3], rejectAt = -1, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0, admissions = 0, network = 0;
  const denied = Error('DENIED');
  const noNetwork = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' };
  const client = { from(table) {
    const i = calls++; assert.equal(table, tables[i]); const builder = {};
    for (const method of ['select', 'eq', 'not', 'or', 'in', 'order', 'limit']) builder[method] = () => builder;
    builder.then = (ok, bad) => i === rejectAt ? Promise.reject(Error('PRIVATE_ERROR')).then(ok, bad) : Promise.resolve({ count: empty.includes(i) ? 0 : counts[i] ?? null, data: empty.includes(i) ? [] : fail.includes(i) && !stale ? null : overrides[i] ?? fixtures[i], error: fail.includes(i) ? { message: 'PRIVATE_ERROR' } : null }).then(ok, bad);
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
    if (id.endsWith('/domain/observer-network')) return domain;
    if (id.endsWith('/auth')) return { requireRole: async roles => { admissions++; assert.deepEqual(Array.from(roles), ['admin']); if (deny) throw denied; } };
    if (id.endsWith('/supabase/server')) return { createClient: async () => { clients++; if (thrown) throw Error('PRIVATE_ERROR'); return client; } };
    throw Error(`UNEXPECTED_IMPORT ${id}`);
  };
  let tree;
  try { tree = await load(source, require, noNetwork).default(); }
  catch (error) { assert.equal(error, denied); assert.equal(clients, 0); assert.equal(calls, 0); return { denied: true }; }
  const nodes = [], strings = [];
  function walk(value) { if (Array.isArray(value)) return value.forEach(walk); if (typeof value === 'string' || typeof value === 'number') strings.push(String(value)); else if (value && typeof value === 'object') { nodes.push(value); walk(value.props?.children); } }
  walk(tree);
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : 13); assert.equal(network, 0);
  return { nodes, strings, banner: nodes.find(n => n.type === 'AdminDataError')?.props.message, hero: nodes.find(n => n.type === 'PremiumDashboardHero')?.props,
    metric: label => nodes.find(n => n.type === 'RoleMetricCard' && n.props.label === label)?.props,
    empty: nodes.filter(n => n.type === 'EmptyState').map(n => n.props.title) };
}
test('fixed queries, helpers, formulas, policy, links and CI hook need no Git history', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  assert.equal(sha(source.split('\n').filter(line => line.includes('countFiltered(supabase,')).join('\n')), '5f560298254b1c16a26385658f19cd0876daed2e4974ceaefad9980005122e53');
  assert.equal(sha(source.split('\n').filter(line => line.includes('safeRows(() => supabase.from(')).join('\n')), '47968d9c91a225e4dec18c61d332e2d8ee35041c4d6e8b87f922e0336bf79187');
  assert.ok(source.includes('supabase.from(table as any).select("id", { count: "exact", head: true })'));
  assert.equal(sha(source.slice(source.indexOf('function groupCount'), source.indexOf('export default async function'))), '5543ad03b4345d6702a889177cc286e54614ea47d2fd9962ed653951eec18e0c');
  assert.equal(sha(source.slice(source.indexOf('    const reviewedSignals'), source.indexOf('    return { activeSites'))), 'f49c60a86da6ed8e17f960377ea4cbe5e9c07e23f7861f8fc0d8aa13ed280ce1');
  assert.equal(sha(domainSource), '6dc18f567433d9c1822a26b0ef96d2179b82e390e7d1950fb6b50cda2c56b542');
  assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g), m => m[1]), ['/dashboard/admin/observer-calibration', '/dashboard/admin/national-inspections', '/dashboard/admin/observer-replay', '/dashboard/admin/observer-network', '/dashboard/admin/observer-replay', '/dashboard/admin/observer-calibration', '/dashboard/admin/national-inspections', '/dashboard/admin/camera-deployment']);
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'observer-network-query-boundary'), [{ name: 'observer-network-query-boundary', args: ['--test', 'scripts/qa/check-observer-network-query-boundary.mjs'] }]);
  config.domain = config.domain.filter(gate => gate.name !== 'observer-network-query-boundary'); assert.equal(sha(JSON.stringify(config)), '4ce1cf5e331ca6b42e3011bc6339a0a51ef318a093e1f156376917a38a5fd206');
});
test('healthy and zero counts retain real summary and safety policy text', async () => {
  const r = await render(); assert.equal(r.banner, null); assert.match(r.hero.badge, /^\d+\/100$/); assert.equal(r.metric('מצלמות פעילות').value, '8/10'); assert.ok(r.strings.includes('ROW_GARDEN')); assert.ok(r.strings.includes('ROW_RECOMMENDATION'));
  const zero = await render({ counts: [0, 0, 0, 0, 0, 0], empty: [6, 7, 9, 10, 11, 12] }); assert.equal(zero.metric('התראות').value, 0); assert.equal(zero.metric('בריאות מצלמות').value, '55%'); assert.ok(zero.empty.includes('אין סימנים פתוחים')); assert.ok(zero.strings.includes('אין גנים בסיכון גבוה.'));
});
for (let i = 0; i < 13; i++) test(`source ${i} null/stale error and rejection are disclosed without losing healthy sources`, async () => {
  for (const args of [{ fail: [i] }, { fail: [i], stale: false }, { rejectAt: i }]) {
    const r = await render(args); assert.ok(r.banner); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
    const scoreDeps = [1, 2, 3, 5, 6, 11, 12]; assert.equal(r.hero.badge === unavailable, scoreDeps.includes(i));
    if (i === 0) assert.equal(r.metric('אתרים פעילים').value, unavailable);
    if (i === 4) { assert.equal(r.metric('התראות').value, unavailable); assert.notEqual(r.metric('התראות').tone, 'good'); }
    if (i === 5) assert.equal(r.metric('סימנים פתוחים').value, unavailable);
    if (i === 6) { assert.ok(!r.empty.includes('אין סימנים פתוחים')); assert.ok(!r.strings.includes('ROW_SIGNAL')); assert.ok(!r.strings.includes('ROW_PATTERN')); }
    if (i === 7) { assert.ok(!r.strings.includes('ROW_RECOMMENDATION')); assert.ok(!r.strings.includes('אין המלצות פתוחות.')); }
    if ([6, 9, 10].includes(i)) { assert.ok(!r.strings.includes('ROW_GARDEN')); assert.ok(!r.strings.includes('אין גנים בסיכון גבוה.')); }
    if (i !== 7) assert.ok(r.strings.includes('ROW_RECOMMENDATION'));
  }
});
test('camera ratio and unhealthy hint are independent', async () => {
  const health = await render({ fail: [3] }); assert.equal(health.metric('מצלמות פעילות').value, '8/10'); assert.equal(health.metric('מצלמות פעילות').hint, unavailable); assert.notEqual(health.metric('מצלמות פעילות').tone, 'good'); assert.equal(health.metric('בריאות מצלמות').value, unavailable);
  const active = await render({ fail: [1] }); assert.equal(active.metric('מצלמות פעילות').value, unavailable); assert.equal(active.metric('בריאות מצלמות').value, '90%');
});
test('review and compliance conditional dependencies preserve empty or positive data', async () => {
  const noReviews = await render({ empty: [6], fail: [11] }); assert.equal(noReviews.metric('קצב Review').value, '65%'); assert.equal(noReviews.hero.badge, unavailable);
  const compliance = [{ ...fixtures[6][0], signal_type: 'compliance' }];
  const positive = await render({ overrides: { 6: compliance }, fail: [12] }); assert.equal(positive.metric('ציות משולב').value, '88%'); assert.match(positive.hero.badge, /^\d+\/100$/);
  const absent = await render({ fail: [12] }); assert.equal(absent.metric('ציות משולב').value, unavailable); assert.equal(absent.hero.badge, unavailable);
  const noSignals = await render({ fail: [6] }); assert.equal(noSignals.metric('ציות משולב').value, unavailable);
});
test('empty gardens are independent while nonempty gardens need signal and camera rows', async () => {
  for (const i of [6, 10]) { const empty = await render({ empty: [9], fail: [i] }); assert.ok(empty.strings.includes('אין גנים בסיכון גבוה.')); const nonempty = await render({ fail: [i] }); assert.ok(nonempty.strings.includes('נתוני הגנים בסיכון אינם זמינים כרגע')); assert.ok(!nonempty.strings.includes('ROW_GARDEN')); }
});
test('all errors, whole-loader failure and denied admission fail closed', async () => {
  for (const args of [{ fail: tables.map((_, i) => i) }, { thrown: true }]) { const r = await render(args); assert.ok(r.banner); assert.equal(r.hero.badge, unavailable); for (const label of ['אתרים פעילים', 'מצלמות פעילות', 'התראות', 'סימנים פתוחים', 'כיסוי מצלמות', 'בריאות מצלמות', 'קצב Review', 'ציות משולב']) assert.equal(r.metric(label).value, unavailable); }
  assert.equal((await render({ deny: true })).denied, true);
});
