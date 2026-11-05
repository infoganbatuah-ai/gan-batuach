import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const source = fs.readFileSync('app/dashboard/admin/digital-observer-leads/page.tsx', 'utf8');
const helper = fs.readFileSync('lib/admin-safe.ts', 'utf8');
const tables = ['digital_observer_leads', 'digital_observer_marketing_events', 'digital_observer_lead_conversion_readiness'];
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
  [{ id: 'LEAD', contact_name: 'SYNTHETIC_LEAD', contact_phone: 'SYNTHETIC_PHONE', contact_email: 'SYNTHETIC_CONTACT', business_name: 'SYNTHETIC_SITE', lead_status: 'new', source: 'digital_observer_demo', conversion_status: 'qualified', interest_score: 80 }],
  [{ event_type: 'SYNTHETIC_EVENT', source: 'synthetic', site_type: 'test' }],
  [{ readiness_key: 'SYNTHETIC_KEY', step_name: 'SYNTHETIC_CONVERSION', status: 'SYNTHETIC_STATUS' }]
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
  assert.equal(admissions, 1); assert.equal(calls, thrown ? 0 : 3); assert.equal(network, 0);
  const metrics = nodes.filter(n => n.type === 'article' && n.props.className === 'metric-card').map(n => n.props.children.find(x => x.type === 'strong').props.children);
  return { nodes, strings, metrics, banner: nodes.find(n => n.type === 'AdminDataError')?.props.message };
}

test('query chains, helpers, filters, href and CI hook have fixed history-independent contracts', () => {
  const sha = text => createHash('sha256').update(text).digest('hex');
  assert.deepEqual(Array.from(source.matchAll(/\.from\("([^"]+)"/g), m => m[1]), tables);
  assert.equal(sha(source.slice(source.indexOf('    const [leads, events, conversion]'), source.indexOf('    [leads, events, conversion].forEach'))), '1b2745e2cb4eaec0694ab93248a35e713a9149e4b2c96040c7fe65ca231102ea');
  assert.equal(sha(source.slice(source.indexOf('function statusClass'), source.indexOf('export default async function'))), '44d7e9a6057b0b2c9f4888e8ad7a71a18a93dc7e69d30956f4339bc2af2e142a');
  assert.equal(sha(source.split('\n').filter(line => /^  const (newLeads|demoRequests|qualified|converted) =/.test(line)).join('\n')), '24dd0079dd69592ce0cedee7f1acbb4eb75d12ca74594f7a3739897e497a6a62');
  assert.deepEqual(Array.from(source.matchAll(/href="([^"]+)"/g), m => m[1]), ['/digital-observer/request-demo']);
  const config = JSON.parse(fs.readFileSync('config/digital-observer-ci-gates.json', 'utf8'));
  assert.deepEqual(config.domain.filter(gate => gate.name === 'observer-leads-query-boundary'), [{ name: 'observer-leads-query-boundary', args: ['--test', 'scripts/qa/check-observer-leads-query-boundary.mjs'] }]);
});

test('healthy rows render correct metrics, contact, event and conversion data', async () => {
  const r = await render(); assert.equal(r.banner, null); assert.deepEqual(r.metrics, [1, 1, 1, 0]);
  for (const item of ['SYNTHETIC_LEAD', 'SYNTHETIC_PHONE', 'SYNTHETIC_CONTACT', 'SYNTHETIC_EVENT', 'SYNTHETIC_CONVERSION', 'SYNTHETIC_STATUS']) assert.ok(r.strings.includes(item));
});

for (let i = 0; i < 3; i++) test(`source ${i} error discards null or stale data while independent sources survive`, async () => {
  for (const stale of [true, false]) {
    const r = await render({ fail: [i], stale }); assert.ok(r.banner); assert.ok(!JSON.stringify(r.nodes).includes('PRIVATE_ERROR'));
    if (i === 0) {
      assert.deepEqual(r.metrics, Array(4).fill(unavailable));
      for (const item of ['SYNTHETIC_LEAD', 'SYNTHETIC_PHONE', 'SYNTHETIC_CONTACT', 'SYNTHETIC_SITE', 'No Digital Observer leads yet']) assert.ok(!r.strings.includes(item));
      assert.ok(r.strings.includes('Lead data is unavailable.')); assert.ok(r.strings.includes('SYNTHETIC_EVENT')); assert.ok(r.strings.includes('SYNTHETIC_CONVERSION'));
    }
    if (i === 1) { assert.deepEqual(r.metrics, [1, 1, 1, 0]); assert.ok(!r.strings.includes('SYNTHETIC_EVENT')); assert.ok(!r.strings.includes('No events yet')); assert.ok(r.strings.includes('Event data is unavailable.')); assert.ok(r.strings.includes('SYNTHETIC_LEAD')); assert.ok(r.strings.includes('SYNTHETIC_CONVERSION')); }
    if (i === 2) { assert.deepEqual(r.metrics, [1, 1, 1, 0]); assert.ok(!r.strings.includes('SYNTHETIC_CONVERSION')); assert.ok(!r.strings.includes('SYNTHETIC_STATUS')); assert.ok(r.strings.includes('Conversion data is unavailable.')); assert.ok(r.strings.includes('SYNTHETIC_LEAD')); assert.ok(r.strings.includes('SYNTHETIC_EVENT')); }
  }
});

test('healthy empty and zero counts are not failure or readiness claims', async () => {
  const r = await render({ empty: [0, 1, 2] }); assert.equal(r.banner, null); assert.deepEqual(r.metrics, [0, 0, 0, 0]);
  for (const text of ['No Digital Observer leads yet', 'No events yet', 'No conversion data yet.']) assert.ok(r.strings.includes(text));
  assert.ok(!r.strings.includes('ready'));
});
test('event list preserves order and limits rendering to ten', async () => {
  const events = Array.from({ length: 12 }, (_, i) => ({ event_type: `EV_${i}`, source: 'synthetic' }));
  const r = await render({ overrides: { 1: events } });
  assert.deepEqual(r.strings.filter(s => /^EV_\d+$/.test(s)), events.slice(0, 10).map(e => e.event_type));
});
test('combined source errors, all loader rejections and denied role fail closed', async () => {
  const mixed = await render({ fail: [1, 2] }); assert.deepEqual(mixed.metrics, [1, 1, 1, 0]); assert.ok(mixed.strings.includes('SYNTHETIC_LEAD')); assert.ok(mixed.strings.includes('Event data is unavailable.')); assert.ok(mixed.strings.includes('Conversion data is unavailable.'));
  for (const args of [{ thrown: true }, ...tables.map((_, rejectAt) => ({ rejectAt }))]) { const r = await render(args); assert.ok(r.banner); assert.deepEqual(r.metrics, Array(4).fill(unavailable)); assert.ok(r.strings.includes('Event data is unavailable.')); assert.ok(r.strings.includes('Conversion data is unavailable.')); }
  assert.equal((await render({ deny: true })).denied, true);
});
