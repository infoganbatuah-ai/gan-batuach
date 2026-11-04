import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const source = fs.readFileSync('app/dashboard/admin/digital-observer-core/page.tsx', 'utf8');
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const domainSource = fs.readFileSync('lib/domain/digital-observer-core.ts', 'utf8');
const tables = ['digital_observer_core_capabilities', 'observer_vertical_profiles', 'observer_core_services_registry', 'observer_shared_package_mapping', 'observer_cross_vertical_policies', 'observer_data_boundary_map', 'observer_roadmap_registry', 'vertical_capability_matrix'];
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
const fixtures = tables.map((_, i) => [{ id: `ROW_${i}`, capability_name: `ROW_${i}`, display_name: `ROW_${i}`, service_name: `ROW_${i}`, package_name: `ROW_${i}`, feature_key: `ROW_${i}`, data_domain: `ROW_${i}`, module_name: `ROW_${i}`, implementation_status: 'mapped', reusable: true, profile_key: 'GAN_BATUACH_PROFILE', profile_status: 'active', allowed_capabilities: ['A', 'B'], disabled_capabilities: ['X'], legal_review_required_capabilities: ['L1', 'L2'], extraction_status: 'mapped', policy_status: 'active', restricted_verticals: ['home', 'school'], disabled_verticals: ['other'], roadmap_status: 'planned', vertical_key: i === 7 ? 'MATRIX_SENTINEL' : 'gan_batuach', capability_status: 'enabled', legal_status: 'allowed' }]);
async function render({ fail = [], stale = true, empty = [], overrides = {}, rejectAt = -1, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0, admissions = 0, network = 0;
  const denied = Error('DENIED');
  const noNetwork = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const client = { from(table) {
    const i = calls++; assert.equal(table, tables[i]);
    const builder = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'in']) builder[method] = () => builder;
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
    if (id.endsWith('/domain/digital-observer-core')) return domain;
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

test('query, helper, domain, filter, navigation and CI hook contracts need no Git history', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  assert.deepEqual(Array.from(source.matchAll(/supabase\.from\("([^"]+)"/g), m => m[1]), tables);
  assert.equal(sha(source.split('\n').filter(line => line.includes('safeQuery<Row>(')).join('\n')), 'c989b4f1f279e9098cb8be7be4624ff3cb0aa870f13d1505941b17e886381675');
  assert.equal(sha(source.slice(source.indexOf('function toneForScore'), source.indexOf('async function safeQuery')) + source.slice(source.indexOf('function englishName'), source.indexOf('export default async function'))), 'c51f60164abd16e4271bb3cba7fe94062d0aa7ac2345e77790403707b5993c15');
  assert.equal(sha(domainSource), '657c59f92fd2cc3389fac05093830ad81c5db9a8d67b2e3b6c4807fd23aaa830');
  assert.equal(sha(source.split('\n').filter(line => /^  const (legalReviewItems|restrictedItems) =/.test(line)).join('\n')), 'b0cd0f7680ed3427c2fe71ca0f5fcda7b1ee07faea47e74860029a3c9d49a50e');
  assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g), m => m[1]), ['/dashboard/admin/regulatory', '/dashboard/admin/ai-governance', '/dashboard/admin/camera-infrastructure', '/dashboard/admin/ai-platform', '/dashboard/admin/workflows', '/dashboard/admin/audit-logs', '/dashboard/admin/analytics-center', '/dashboard/admin/observer-packages']);
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'observer-core-query-boundary'), [{ name: 'observer-core-query-boundary', args: ['--test', 'scripts/qa/check-observer-core-query-boundary.mjs'] }]);
});
test('healthy score, measured zero matrix and profile metadata', async () => {
  const r = await render(); assert.equal(r.banner, null); assert.equal(r.hero.badge, '100/100');
  assert.equal(r.metric('יכולות Core').value, 1); assert.equal(r.metric('מיפוי הפרדה').value, '1/1'); assert.equal(r.metric('פרופילים').value, '1/1');
  assert.equal(r.metric('מוגבל').value, 0); assert.equal(r.metric('בדיקה משפטית').value, 0); assert.ok(r.strings.includes('הגדרת מדיניות בלבד; המצב בפועל לא אומת.'));
});
for (let i = 0; i < 8; i++) test(`source ${i} null/stale errors and rejection are independently disclosed`, async () => {
  for (const args of [{ fail: [i], stale: false }, { fail: [i] }, { rejectAt: i }]) {
    const r = await render(args); assert.ok(r.banner); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
    assert.equal(r.hero.badge, [0, 1, 2, 4, 6].includes(i) ? unavailable : '100/100');
    if (i < 7) assert.ok(!r.strings.includes(`ROW_${i}`)); else assert.ok(!r.strings.includes('MATRIX SENTINEL'));
    if (i === 0) { assert.equal(r.metric('יכולות Core').value, unavailable); assert.equal(r.metric('מיפוי הפרדה').value, unavailable); assert.notEqual(r.metric('יכולות Core').tone, 'good'); }
    if (i === 1) { for (const label of ['פרופילים', 'Gan Batuach פעיל', 'Gan Batuach כבוי']) assert.equal(r.metric(label).value, unavailable); assert.ok(r.strings.includes('נתוני הפרופיל אינם זמינים כרגע')); }
    if (i === 2) assert.equal(r.metric('שירותים').value, unavailable);
    if (i === 7) { assert.equal(r.metric('מוגבל').value, unavailable); assert.equal(r.metric('בדיקה משפטית').value, unavailable); assert.ok(!r.empty.includes('אין מטריצה')); }
    if (i !== 0) assert.equal(r.metric('יכולות Core').value, 1);
    if (i !== 2) assert.equal(r.metric('שירותים').value, 1);
  }
});
test('empty matrix uses independent healthy policy/profile fallbacks, never failed matrix', async () => {
  const empty = await render({ empty: [7] }); assert.equal(empty.metric('מוגבל').value, 3); assert.equal(empty.metric('בדיקה משפטית').value, 2);
  const noPolicy = await render({ empty: [7], fail: [4] }); assert.equal(noPolicy.metric('מוגבל').value, unavailable); assert.equal(noPolicy.metric('בדיקה משפטית').value, 2);
  const noProfile = await render({ empty: [7], fail: [1] }); assert.equal(noProfile.metric('מוגבל').value, 3); assert.equal(noProfile.metric('בדיקה משפטית').value, unavailable);
  const zero = await render({ fail: [1, 4] }); assert.equal(zero.metric('מוגבל').value, 0); assert.equal(zero.metric('בדיקה משפטית').value, 0);
  const failed = await render({ fail: [7] }); assert.equal(failed.metric('מוגבל').value, unavailable); assert.equal(failed.metric('בדיקה משפטית').value, unavailable);
});
test('matrix filters preserve both legal and restricted metadata', async () => {
  const matrix = [{ vertical_key: 'home_observer', capability_status: 'restricted', legal_status: 'allowed' }, { vertical_key: 'home_observer', capability_status: 'enabled', legal_status: 'legal_review_required' }];
  const r = await render({ overrides: { 7: matrix } }); assert.equal(r.metric('מוגבל').value, 1); assert.equal(r.metric('בדיקה משפטית').value, 1); assert.ok(r.strings.includes('home observer'));
});
test('healthy empty, all failures, loader throw and admission denial remain distinct', async () => {
  const empty = await render({ empty: tables.map((_, i) => i) }); assert.equal(empty.banner, null); assert.equal(empty.hero.badge, '0/100'); assert.equal(empty.metric('יכולות Core').value, 0); assert.equal(empty.metric('מוגבל').value, 0); assert.ok(empty.empty.includes('אין מטריצה'));
  for (const args of [{ fail: tables.map((_, i) => i) }, { thrown: true }]) { const r = await render(args); assert.ok(r.banner); assert.equal(r.hero.badge, unavailable); for (const label of ['יכולות Core', 'מיפוי הפרדה', 'שירותים', 'פרופילים', 'Gan Batuach פעיל', 'Gan Batuach כבוי', 'מוגבל', 'בדיקה משפטית']) assert.equal(r.metric(label).value, unavailable); }
  assert.equal((await render({ deny: true })).denied, true);
});
