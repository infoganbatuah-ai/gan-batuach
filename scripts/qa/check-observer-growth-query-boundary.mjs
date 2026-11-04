import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const source = fs.readFileSync('app/dashboard/admin/digital-observer-growth/page.tsx', 'utf8');
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const tables = ['digital_observer_leads', 'digital_observer_marketing_events', 'digital_observer_demo_content', 'digital_observer_followup_templates'];
const unavailable = 'לא זמין';
function load(text, require, fetch) {
  const exports = {};
  const js = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(js, { exports, require, fetch, console: { warn() {} }, Date, Intl });
  return exports;
}
const never = () => { throw Error('NETWORK_OR_UNEXPECTED_IMPORT_FORBIDDEN'); };
const safe = load(helper, never, never);
const fixtures = [
  [{ source: 'SYNTHETIC_SOURCE', site_type: 'SYNTHETIC_SITE', city: 'SYNTHETIC_CITY', interest_score: 80 }],
  [{ event_type: 'SYNTHETIC_EVENT' }],
  [{ demo_key: 'demo', title: 'SYNTHETIC_DEMO', status: 'ready', uses_real_people: false, uses_real_credentials: false }],
  [{ template_key: 'template', title: 'SYNTHETIC_TEMPLATE', channel: 'synthetic_channel', provider_mode: 'synthetic_mode', status: 'synthetic_status' }]
];
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
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : 4); assert.equal(network, 0);
  const metrics = nodes.filter(n => n.type === 'article' && n.props.className === 'metric-card').map(n => n.props.children.find(x => x.type === 'strong').props.children);
  return { nodes, strings, metrics, banner: nodes.find(n => n.type === 'AdminDataError')?.props.message };
}

test('fixed query, grouping, formula, demo safety, link and hook contracts need no Git history', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  assert.deepEqual(Array.from(source.matchAll(/\.from\("([^"]+)"/g), m => m[1]), tables);
  assert.equal(sha(source.split('\n').filter(line => line.includes('supabase.from(')).join('\n')), '13d7e87c1999e4dc7cfa6b9f2604f05aa5e98026576f836cf4d55a682ad3e245');
  assert.equal(sha(source.slice(source.indexOf('function countBy'), source.indexOf('export default async function'))), '325adf9d29f2e056253b045df6706ba8d95355cc0c0992e54a2c904d9bdecfbf');
  assert.equal(sha(source.split('\n').filter(line => /^  const (sourceDemand|siteDemand|cityDemand|eventCounts|avgScore) =/.test(line)).join('\n')), 'f470e6ff1de85353f0cf2ac8b0f56c8b3490b602f5d8bb3f1cd4f5df7ece193a');
  assert.ok(source.includes('item.uses_real_people || item.uses_real_credentials ? "blocked" : item.status'));
  assert.ok(source.includes('Object.entries(cityDemand).slice(0, 10)'));
  assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g), m => m[1]), ['/dashboard/admin/digital-observer-leads']);
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'observer-growth-query-boundary'), [{ name: 'observer-growth-query-boundary', args: ['--test', 'scripts/qa/check-observer-growth-query-boundary.mjs'] }]);
});

test('healthy data and safe demo metadata render independent values', async () => {
  const r = await render(); assert.equal(r.banner, null); assert.deepEqual(r.metrics, [1, 1, '80/100', 1]);
  for (const item of ['SYNTHETIC_SOURCE', 'SYNTHETIC_SITE', 'SYNTHETIC_CITY', 'SYNTHETIC_EVENT', 'SYNTHETIC_DEMO', 'ready', 'SYNTHETIC_TEMPLATE', 'synthetic_channel', 'synthetic_mode', 'synthetic_status']) assert.ok(r.strings.includes(item));
});

for (let i = 0; i < 4; i++) test(`source ${i} error discards stale or null rows and preserves independent data`, async () => {
  for (const stale of [true, false]) {
    const r = await render({ fail: [i], stale }); assert.ok(r.banner); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
    if (i === 0) { assert.equal(r.metrics[0], unavailable); assert.equal(r.metrics[2], unavailable); for (const s of ['SYNTHETIC_SOURCE', 'SYNTHETIC_SITE', 'SYNTHETIC_CITY', 'No source data', 'No site data', 'No city data']) assert.ok(!r.strings.includes(s)); assert.equal(r.strings.filter(s => s === 'Lead data is unavailable.').length, 3); }
    if (i === 1) { assert.equal(r.metrics[1], unavailable); assert.ok(!r.strings.includes('SYNTHETIC_EVENT')); assert.ok(!r.strings.includes('No event data')); assert.ok(r.strings.includes('Event data is unavailable.')); }
    if (i === 2) { assert.ok(!r.strings.includes('SYNTHETIC_DEMO')); assert.ok(!r.strings.includes('No demo content ')); assert.ok(r.strings.includes('Demo content data is unavailable.')); }
    if (i === 3) { assert.equal(r.metrics[3], unavailable); for (const s of ['SYNTHETIC_TEMPLATE', 'synthetic_channel', 'synthetic_mode', 'synthetic_status']) assert.ok(!r.strings.includes(s)); assert.ok(r.strings.includes('Template data is unavailable.')); }
    if (i !== 0) assert.equal(r.metrics[0], 1);
    if (i !== 1) assert.equal(r.metrics[1], 1);
    if (i !== 2) assert.ok(r.strings.includes('SYNTHETIC_DEMO'));
    if (i !== 3) assert.equal(r.metrics[3], 1);
  }
});

test('healthy empty is zero with neutral text and no hardcoded ready', async () => {
  const r = await render({ empty: [0, 1, 2, 3] }); assert.equal(r.banner, null); assert.deepEqual(r.metrics, [0, 0, '0/100', 0]);
  for (const text of ['No source data', 'No site data', 'No city data', 'No event data', 'No templates yet.']) assert.ok(r.strings.includes(text));
  assert.ok(!r.strings.includes('ready'));
});
test('grouping preserves unknown keys, score zero and first ten cities', async () => {
  const leads = Array.from({ length: 12 }, (_, i) => ({ source: null, site_type: null, city: `CITY_${i}`, interest_score: 0 }));
  const r = await render({ overrides: { 0: leads, 1: [{ event_type: null }] } });
  assert.equal(r.metrics[2], '0/100'); assert.equal(r.strings.filter(s => s === 'unknown').length, 3);
  for (let i = 0; i < 10; i++) assert.ok(r.strings.includes(`CITY_${i}`));
  assert.ok(!r.strings.includes('CITY_10')); assert.ok(!r.strings.includes('CITY_11'));
});
test('demo unsafe flags block status and templates preserve given order and metadata', async () => {
  const demo = [{ demo_key: 'a', title: 'DEMO_A', status: 'ready', uses_real_people: true, uses_real_credentials: false }, { demo_key: 'b', title: 'DEMO_B', status: 'ready', uses_real_people: false, uses_real_credentials: true }, { demo_key: 'c', title: 'DEMO_C', status: 'ready', uses_real_people: false, uses_real_credentials: false }];
  const templates = [{ template_key: 'a', title: 'TEMPLATE_A', channel: 'A', provider_mode: 'mock', status: 'one' }, { template_key: 'b', title: 'TEMPLATE_B', channel: 'B', provider_mode: 'mock', status: 'two' }];
  const r = await render({ overrides: { 2: demo, 3: templates } }); assert.equal(r.strings.filter(s => s === 'blocked').length, 2); assert.equal(r.strings.filter(s => s === 'ready').length, 1);
  assert.deepEqual(r.strings.filter(s => s === 'TEMPLATE_A' || s === 'TEMPLATE_B'), ['TEMPLATE_A', 'TEMPLATE_B']); assert.ok(r.strings.includes('one')); assert.ok(r.strings.includes('two'));
});
test('mixed failures, all loader rejections and denied role fail closed', async () => {
  const mixed = await render({ fail: [0, 1, 3] }); assert.ok(mixed.strings.includes('SYNTHETIC_DEMO')); assert.deepEqual(mixed.metrics, [unavailable, unavailable, unavailable, unavailable]);
  for (const args of [{ thrown: true }, ...tables.map((_, rejectAt) => ({ rejectAt }))]) { const r = await render(args); assert.ok(r.banner); assert.deepEqual(r.metrics, Array(4).fill(unavailable)); assert.ok(r.strings.includes('Demo content data is unavailable.')); }
  assert.equal((await render({ deny: true })).denied, true);
});
