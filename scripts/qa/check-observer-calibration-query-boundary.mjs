import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const source = fs.readFileSync('app/dashboard/admin/observer-calibration/page.tsx', 'utf8');
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const domainSource = fs.readFileSync('lib/domain/observer-calibration.ts', 'utf8');
const tables = ['observer_calibration_profiles', 'observer_ground_truth_reviews', 'observer_performance_snapshots', 'observer_training_readiness', 'observer_model_readiness_catalog', 'observer_test_sessions', 'ai_camera_events', 'audio_observer_events', 'observer_correlated_events', 'observer_event_replay_logs'];
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
const fixtures = [[{ id: 'P', scope_type: 'ROW_PROFILE', observer_model: 'local_shadow', calibration_status: 'review_ready', readiness_score: 80, learning_maturity: 'review_ready' }], [{ id: 'R', outcome: 'correct_detection', confidence_at_review: 0.9 }], [{ id: 'PERF', readiness_score: 77 }], [{ id: 'T', readiness_key: 'ROW_TRAINING', training_status: 'review_ready', dataset_readiness_score: 60 }], [{ id: 'M', model_key: 'ROW_MODEL_KEY', model_name: 'ROW_MODEL', activation_status: 'blocked', notes: 'SYNTHETIC' }], [{ id: 'SESSION', status: 'mock' }], [{ id: 'AI', event_type: 'motion', confidence_score: 0.8, observer_shadow_mode: true, created_at: '2026-01-01' }], [{ id: 'AUDIO', event_type: 'sound', confidence: 0.7, created_at: '2026-01-02' }], [{ id: 'CORR', correlation_type: 'synthetic', confidence: 0.6, created_at: '2026-01-03' }], [{ id: 'REPLAY', status: 'mock' }]];
async function render({ fail = [], stale = true, empty = [], overrides = {}, rejectAt = -1, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0, admissions = 0, network = 0;
  const denied = Error('DENIED'); const noNetwork = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'Fragment' };
  const client = { from(table) { const i = calls++; assert.equal(table, tables[i]); const builder = {};
    for (const method of ['select', 'eq', 'order', 'limit']) builder[method] = () => builder;
    builder.then = (ok, bad) => i === rejectAt ? Promise.reject(Error('PRIVATE_ERROR')).then(ok, bad) : Promise.resolve({ data: empty.includes(i) ? [] : fail.includes(i) && !stale ? null : overrides[i] ?? fixtures[i], error: fail.includes(i) ? { message: 'PRIVATE_ERROR' } : null }).then(ok, bad); return builder;
  } };
  const require = id => {
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'next/link') return { __esModule: true, default: 'Link' };
    if (id === 'lucide-react') return new Proxy({}, { get: (_, key) => `Icon:${String(key)}` });
    if (id.endsWith('/dashboard-shell')) return { DashboardShell: 'DashboardShell' };
    if (id.endsWith('/premium-dashboard')) return new Proxy({}, { get: (_, key) => String(key) });
    if (id.endsWith('/admin-data-state')) return { AdminDataError: 'AdminDataError' };
    if (id.endsWith('/admin-safe')) return safe;
    if (id.endsWith('/domain/observer-calibration')) return domain;
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
  const text = node => { const out = []; function visit(value) { if (Array.isArray(value)) return value.forEach(visit); if (typeof value === 'string' || typeof value === 'number') out.push(String(value)); else if (value && typeof value === 'object') visit(value.props?.children); } visit(node); return out.join(' '); };
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : 10); assert.equal(network, 0);
  return { nodes, strings, banner: nodes.find(n => n.type === 'AdminDataError')?.props.message, hero: nodes.find(n => n.type === 'PremiumDashboardHero')?.props,
    metric: label => nodes.find(n => n.type === 'RoleMetricCard' && n.props.label === label)?.props,
    empty: nodes.filter(n => n.type === 'EmptyState').map(n => n.props.title), rows: nodes.filter(n => n.type === 'div' && typeof n.props.children?.[0] === 'string').map(node => text(node).replace(/\s+/g, ' ').trim()) };
}
test('fixed queries, helpers, predicates, domain, links and CI hook need no Git history', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  assert.deepEqual(Array.from(source.matchAll(/supabase\.from\("([^"]+)"/g), m => m[1]), tables);
  assert.equal(sha(source.split('\n').filter(line => line.includes('safeRows(() => supabase.from(')).join('\n')), '32a48cf8dbc08b172898fdce8a44b493798e2a9aad2981e4be2828b97dff12a2');
  assert.equal(sha(source.slice(source.indexOf('function confidenceLabel'), source.indexOf('async function safeRows'))), '3aaf413475dd96dd031096eabf46af81912f3347e67a9c2a4343aa05fdaf0ee4');
  assert.equal(sha(source.split('\n').filter(line => /^  const (calibrationReady|trainingReady|latestSnapshot) =/.test(line)).join('\n')), '1d6602b9181e11e51f9446ec3840624e6287c46872d60f6cf81779be29ad0238');
  assert.equal(sha(domainSource), '60241cd0832c352d3894882e616e53e691372c39b0870913ea1a9aa0dacb4c63');
  assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g), m => m[1]), ['/dashboard/admin/observer-replay', '/dashboard/admin/observer-test-center', '/dashboard/admin/observer-replay', '/dashboard/admin/observer-test-center', '/dashboard/admin/observer-calibration', '/dashboard/admin/observer-intelligence']);
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'observer-calibration-query-boundary'), [{ name: 'observer-calibration-query-boundary', args: ['--test', 'scripts/qa/check-observer-calibration-query-boundary.mjs'] }]);
});
test('healthy measurements and empty fallback preserve existing results', async () => {
  const r = await render(); assert.equal(r.banner, null); assert.match(r.hero.badge, /^\d+\/100$/); assert.equal(r.metric('Reviewed').value, 1); assert.ok(r.strings.includes('ROW_PROFILE')); assert.ok(r.strings.includes('ROW_TRAINING')); assert.ok(r.strings.includes('ROW_MODEL'));
  const empty = await render({ empty: tables.map((_, i) => i) }); assert.equal(empty.banner, null); assert.equal(empty.metric('Reviewed').value, 0); assert.equal(empty.metric('False positive').value, '0%'); assert.ok(empty.empty.includes('אין פרופילי כיול')); assert.ok(empty.empty.includes('אין קטלוג מודלים'));
});
for (let i = 0; i < 10; i++) test(`source ${i} null/stale errors and rejection preserve independent data`, async () => {
  for (const args of [{ fail: [i] }, { fail: [i], stale: false }, { rejectAt: i }]) {
    const r = await render(args); assert.ok(r.banner); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
    assert.equal(r.hero.badge === unavailable, [0, 1, 6, 7, 8].includes(i));
    for (const label of ['Confidence', 'Stability']) assert.equal(r.metric(label).value === unavailable, [1, 6, 7, 8].includes(i));
    for (const label of ['Reviewed', 'Precision', 'Recall', 'False positive']) assert.equal(r.metric(label).value === unavailable, i === 1);
    if (i === 0) { assert.ok(!r.strings.includes('ROW_PROFILE')); assert.ok(!r.empty.includes('אין פרופילי כיול')); }
    if (i === 1) { assert.notEqual(r.metric('False positive').tone, 'good'); assert.equal(r.metric('False positive').hint, unavailable); assert.ok(r.rows.some(s => s === 'Current training status לא זמין')); }
    if (i === 2) assert.ok(r.rows.some(s => s === 'Latest snapshot לא זמין'));
    if (i === 3) { assert.ok(!r.strings.includes('ROW_TRAINING')); assert.ok(r.rows.some(s => s === 'Training ready לא זמין')); }
    if (i === 4) { assert.ok(!r.strings.includes('ROW_MODEL')); assert.ok(!r.empty.includes('אין קטלוג מודלים')); }
    if (i === 9) assert.ok(r.rows.some(s => s === 'Replay logs לא זמין'));
  }
});
test('profile and event failures do not erase independent review metrics', async () => {
  for (const i of [0, 6, 7, 8]) { const r = await render({ fail: [i] }); assert.equal(r.metric('Reviewed').value, 1); assert.equal(r.metric('Precision').value, '100%'); assert.ok(r.rows.some(s => s === 'Current training status collecting')); }
  const noProfile = await render({ fail: [0] }); assert.notEqual(noProfile.metric('Confidence').value, unavailable); assert.equal(noProfile.metric('Maturity').value, unavailable);
  const ancillary = await render({ fail: [2, 3, 4, 5, 9] }); assert.match(ancillary.hero.badge, /^\d+\/100$/); assert.equal(ancillary.metric('Reviewed').value, 1);
});
test('real event feed retains sorting and confidence precedence', () => {
  const feed = domain.buildObserverEventFeed({ aiEvents: [{ event_type: 'A', confidence_score: 0.2, combined_confidence: 0.9, created_at: '2026-01-01' }], audioEvents: [{ event_type: 'B', confidence: 0.7, created_at: '2026-01-03' }], correlatedEvents: [{ correlation_type: 'C', confidence: 0.4, created_at: '2026-01-02' }] });
  assert.deepEqual(Array.from(feed, item => item.event_label), ['B', 'C', 'A']); assert.equal(feed[2].confidence, 0.9);
});
test('all failures, whole-loader failure and denied admission fail closed', async () => {
  for (const args of [{ fail: tables.map((_, i) => i) }, { thrown: true }]) { const r = await render(args); assert.ok(r.banner); assert.equal(r.hero.badge, unavailable); for (const label of ['Readiness', 'Maturity', 'Confidence', 'Stability', 'Reviewed', 'Precision', 'Recall', 'False positive']) assert.equal(r.metric(label).value, unavailable); }
  assert.equal((await render({ deny: true })).denied, true);
});
