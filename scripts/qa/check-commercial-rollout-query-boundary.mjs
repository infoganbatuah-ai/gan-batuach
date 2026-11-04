import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const path = 'app/dashboard/admin/commercial-rollout/page.tsx';
const base = '36a2b3c0009156ae4c81606a4bb787ca44b5b48c';
const source = fs.readFileSync(path, 'utf8');
const old = execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8', env: { ...process.env, GIT_NO_LAZY_FETCH: '1' } });
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const tables = Array.from(old.matchAll(/supabase\.from\("([^"]+)"/g), match => match[1]);
const unavailable = 'לא זמין';

function load(text, require, fetch) {
  const exports = {};
  const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(compiled, { exports, require, fetch, console: { warn() {} }, Date, Intl });
  return exports;
}
const never = () => { throw Error('NETWORK_OR_UNEXPECTED_IMPORT_FORBIDDEN'); };
const safe = load(helper, never, never);
const fixtures = tables.map((_, i) => [{ id: `ROW_${i}`, title: `ROW_${i}`, cohort_name: `ROW_${i}`, kindergarten_name: `ROW_${i}`, report_summary: `ROW_${i}`, summary: `ROW_${i}`, recommendation: `ROW_${i}`, notes: `ROW_${i}`, status: 'open', rollout_status: 'planned', rollout_readiness_score: 95, onboarding_score: 88, parent_activation_score: 77, staff_activation_score: 66, manager_adoption_score: 55, revenue_collected_nis: 600, expected_revenue_nis: 900, launch_decision: 'ready_for_50_gardens', open_blockers: 3, inspection_score: 91, target_kindergartens: 15, subscription_status: 'active', expected_monthly_price_nis: 1200, customer_health_score: 90, collected_amount_nis: 250, expected_amount_nis: 500, tickets_count: 4, severity: 'high', rollout_profile_id: 'ROW_2', decision: 'continue_stabilization' }]);
fixtures[3][0].status = 'completed';
fixtures[4][0].status = 'paid';
fixtures[5] = ['parent', 'staff', 'manager'].map((role_area, i) => ({ id: role_area, role_area, adoption_score: [0, 40, 20][i], rollout_profile_id: 'ROW_2' }));

async function render({ fail = [], rejectAt = -1, empty = [], overrides = {}, thrown = false, deny = false } = {}) {
  let calls = 0, clients = 0, admissions = 0, network = 0;
  const denied = Error('DENIED');
  const noNetwork = () => { network++; throw Error('NETWORK_FORBIDDEN'); };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const client = { from(table) {
    const i = calls++; assert.equal(table, tables[i]);
    const builder = {};
    for (const method of ['select', 'eq', 'order', 'limit']) builder[method] = () => builder;
    builder.then = (ok, bad) => i === rejectAt ? Promise.reject(Error('PRIVATE_ERROR')).then(ok, bad) : Promise.resolve({ data: empty.includes(i) ? [] : overrides[i] ?? fixtures[i], error: fail.includes(i) ? { message: 'PRIVATE_ERROR' } : null }).then(ok, bad);
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
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : 14); assert.equal(network, 0);
  return { nodes, strings, banner: nodes.find(n => n.type === 'AdminDataError')?.props.message, hero: nodes.find(n => n.type === 'PremiumDashboardHero')?.props.badge,
    metric: label => nodes.find(n => n.type === 'RoleMetricCard' && n.props.label === label)?.props,
    action: title => nodes.find(n => n.type === 'ActionCard' && n.props.title === title)?.props };
}

test('query inventory, helper functions and navigation remain unchanged', () => {
  assert.equal(tables.length, 14);
  const lines = s => s.split('\n').filter(line => line.includes('safeQuery<Row>(')).join('\n');
  assert.equal(lines(source), lines(old));
  const helpers = s => s.slice(s.indexOf('function money('), s.indexOf('export default async function'));
  assert.equal(helpers(source), helpers(old));
  const hrefs = s => Array.from(s.matchAll(/href="([^"]+)"/g), m => m[1]);
  assert.deepEqual(hrefs(source), hrefs(old));
});

test('healthy data, measured zero and empty-source fallback remain distinct', async () => {
  const r = await render();
  assert.equal(r.banner, null); assert.equal(r.hero, '95/100');
  assert.equal(r.metric('Parent activation').value, '0%');
  assert.equal(r.metric('Staff activation').value, '40%');
  assert.equal(r.metric('Target gardens').value, 15);
  const zero = await render({ overrides: { 1: [{ target_kindergartens: 0 }], 4: [{ collected_amount_nis: 0, status: 'paid' }], 2: [{ expected_monthly_price_nis: 0, subscription_status: 'active' }], 3: [{ status: 'open' }] } });
  assert.equal(zero.metric('Target gardens').value, 0); assert.equal(zero.metric('Onboarding').value, '0%');
  assert.match(zero.metric('Revenue collected').value, /0/); assert.match(zero.metric('Revenue collected').hint, /0/);
  const empty = await render({ empty: [1, 2, 3, 4, 5] });
  assert.equal(empty.metric('Target gardens').value, '10-25'); assert.equal(empty.metric('Onboarding').value, '88%');
  assert.equal(empty.metric('Parent activation').value, '77%'); assert.match(empty.metric('Revenue collected').value, /600/); assert.match(empty.metric('Revenue collected').hint, /900/);
});

for (let i = 0; i < 14; i++) test(`source ${i} failure is surfaced and stale rows are suppressed`, async () => {
  const r = await render({ fail: [i] });
  assert.ok(r.banner); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
  assert.ok(!r.strings.includes(`ROW_${i}`));
  const checks = { 0: ['Readiness'], 1: ['Target gardens'], 2: ['Active rollout'], 3: ['Onboarding'], 4: ['Revenue collected'], 5: ['Parent activation', 'Staff activation'], 7: ['Support tickets'], 8: ['High risks'] };
  for (const metric of checks[i] ?? []) assert.equal(r.metric(metric).value, unavailable);
  if (i === 0) assert.equal(r.hero, unavailable);
  if (i === 4) assert.equal(r.metric('High risks').hint, unavailable);
});

test('rejections, mixed dependency failures, full fallback and role denial fail closed', async () => {
  for (const rejectAt of [0, 5, 13]) { const r = await render({ rejectAt }); assert.ok(r.banner); }
  const score = await render({ fail: [0] });
  assert.equal(score.metric('Onboarding').value, '100%'); assert.equal(score.metric('Parent activation').value, '0%');
  const mixed = await render({ fail: [0], empty: [2, 3, 4, 5] });
  for (const name of ['Onboarding', 'Parent activation', 'Staff activation', 'Revenue collected']) assert.equal(mixed.metric(name).value, unavailable);
  assert.match(mixed.metric('Revenue collected').hint, /לא זמין/);
  const risks = await render({ fail: [8] }); assert.equal(risks.metric('High risks').value, unavailable); assert.match(risks.metric('High risks').hint, /0 failed/);
  const support = await render({ fail: [7] }); assert.equal(support.metric('Support tickets').value, unavailable); assert.equal(support.metric('Parent').value, '0%');
  const all = await render({ thrown: true }); assert.ok(all.banner); assert.equal(all.hero, unavailable); assert.equal(all.metric('High risks').value, unavailable);
  assert.equal((await render({ deny: true })).denied, true);
});

test('mixed panels and executive metrics retain independently healthy sources', async () => {
  const cases = [[9, 10], [10, 9], [11, 12], [12, 11]];
  for (const [failed, healthy] of cases) {
    const r = await render({ fail: [failed] });
    assert.ok(r.banner);
    assert.ok(r.strings.includes(`ROW_${healthy}`), `healthy source ${healthy} must remain visible`);
    assert.ok(!r.strings.includes(`ROW_${failed}`));
  }
  const payments = await render({ fail: [4] });
  assert.match(payments.action('Revenue validation').text, /לא זמין.*collected/);
  assert.match(payments.action('Revenue validation').text, /1,200/);
  const profiles = await render({ fail: [2] });
  assert.match(profiles.action('Revenue validation').text, /250/);
  assert.match(profiles.action('Revenue validation').text, /לא זמין.*expected/);
  const decision = await render({ fail: [10] });
  assert.equal(decision.action('Next cohort').text, 'ready for 50 gardens');
  const missingDecision = await render({ fail: [10], overrides: { 0: [{ rollout_readiness_score: 95, launch_decision: null }] } });
  assert.equal(missingDecision.action('Next cohort').text, unavailable);
  const failedRisks = await render({ fail: [8] });
  assert.match(failedRisks.action('Blockers').text, /לא זמין.*3 blockers/);
});
