import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Disconnected presentation proof only. The provider module is never loaded.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const ts = require('typescript');
function read(relative) {
  const filename = path.join(root, relative);
  assert.equal(fs.statSync(filename).flags & 0x40000000, 0);
  return fs.readFileSync(filename, 'utf8');
}
function compile(relative) {
  const result = ts.transpileModule(read(relative), { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  assert.equal(result.diagnostics.length, 0);
  return result.outputText;
}
const page = compile('app/dashboard/admin/whatsapp/page.tsx');
const helper = compile('lib/admin-safe.ts');
const stat = compile('components/stat-card.tsx');
const sources = ['whatsapp_templates', 'whatsapp_message_logs', 'whatsapp_opt_ins', 'communication_logs'];
const chains = [
  [['select', '*'], ['order', 'event_type'], ['order', 'template_name'], ['limit', 100]],
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 120]],
  [['select', 'id', { count: 'exact', head: true }], ['eq', 'opted_in', true]],
  [['select', 'id, status', { count: 'exact' }], ['eq', 'channel', 'whatsapp'], ['order', 'created_at', { ascending: false }], ['limit', 200]]
];
const labels = ['תבניות', 'מאושרות', 'טיוטות', 'הסכמות', 'ממתין', 'נמסר/נקרא', 'כשלונות', 'לוגים כלליים'];
const dependencies = [[0], [0], [0], [2], [1], [1], [1, 3], [3]];
const normalize = value => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function nodes(value, predicate) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(v => nodes(v, predicate));
  return [...(predicate(value) ? [value] : []), ...Object.values(value.props ?? {}).flatMap(v => nodes(v, predicate))];
}
function text(value) {
  if (value == null || typeof value === 'boolean' || typeof value === 'function') return '';
  if (typeof value !== 'object') return String(value);
  return Array.isArray(value) ? value.map(text).join('') : text(value.props?.children);
}
function expand(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(expand);
  if (typeof value.type === 'function') return expand(value.type(value.props));
  return { ...value, props: { ...value.props, children: expand(value.props?.children) } };
}
function fixtures() {
  return [
    [{ id: 'T1', template_name: 'SYNTHETIC_TEMPLATE', body_preview: 'SYNTHETIC_BODY', status: 'approved', event_type: 'safety_alert', language: 'he', variables: ['one', 'two'] }, { id: 'T2', template_name: 'SYNTHETIC_DRAFT', status: 'draft', variables: null }],
    ['queued', 'delivered', 'failed', 'read', 'sent'].map((status, index) => ({ id: `L${index}`, status, event_type: 'safety_alert', template_name: `SYNTHETIC_LOG_${index}`, provider: 'SYNTHETIC_PROVIDER', created_at: '2026-11-05T00:00:00Z' })),
    [{ id: 'SYNTHETIC_CONSENT' }],
    [{ id: 'C1', status: 'failed' }, { id: 'C2', status: 'dead_letter' }]
  ];
}
async function render({ modes = {}, outer = false, denied = false, data = fixtures(), count = 17, communicationCount = 23, configured = false } = {}) {
  let clients = 0, readiness = 0, effects = 0;
  const queries = [], logs = [];
  const no = () => { effects++; throw Error('UNEXPECTED_EFFECT'); };
  const context = { process: new Proxy({}, { get: no }), fetch: no, FormData: no, console: { warn: (...args) => logs.push(args), error: no } };
  const safe = {};
  vm.runInNewContext(helper, { ...context, exports: safe, require: no });
  const cards = {};
  vm.runInNewContext(stat, { ...context, exports: cards, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'next/link') return { __esModule: true, default: 'Link' };
    return no();
  } });
  const client = { from(table) {
    const index = sources.indexOf(table); assert.ok(index >= 0);
    const mode = modes[index] ?? 'healthy', calls = [];
    queries.push({ table, calls, mode });
    if (mode === 'factory') throw Error('PRIVATE_FACTORY');
    const query = {};
    for (const method of ['select', 'order', 'limit', 'eq']) query[method] = (...args) => {
      if (mode === 'chain' && method === 'select') throw Error('PRIVATE_CHAIN');
      calls.push([method, ...args]); return query;
    };
    query.then = (resolve, reject) => {
      if (mode === 'reject') return Promise.reject(Error('PRIVATE_REJECTION')).then(resolve, reject);
      if (mode === 'reject-null') return Promise.reject(null).then(resolve, reject);
      if (mode === 'reject-false') return Promise.reject(false).then(resolve, reject);
      const error = mode.startsWith('error-') ? { message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT' } : null;
      let rows = mode.endsWith('empty') ? [] : mode.endsWith('null') ? null : data[index];
      if (mode === 'error-poison') rows = new Proxy([], { get: no });
      return Promise.resolve({ data: rows, error, count: error ? index === 3 ? 777 : 919 : index === 3 ? communicationCount : count }).then(resolve, reject);
    };
    return query;
  } };
  const exported = {};
  class SafeDate extends Date { constructor(...args) { assert.notEqual(args[0], 'INVALID_RETRY'); super(...args); } }
  vm.runInNewContext(page, { ...context, exports: exported, Date: SafeDate, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'lucide-react') return Object.fromEntries(['AlertTriangle', 'CheckCircle2', 'MessageCircle', 'ShieldCheck'].map(n => [n, `Icon:${n}`]));
    if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
    if (id === '@/components/stat-card') return cards;
    if (id === '@/components/admin-data-state') return { AdminDataError: 'AdminDataError' };
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + readiness + queries.length, 0); if (denied) throw Error('DENIED'); } };
    if (id === '@/lib/domain/whatsapp-provider') return { getWhatsAppProductionReadiness: () => { readiness++; return { configured, mode: configured ? 'dry_run' : 'mock', summary: 'SYNTHETIC_READINESS_ONLY', missing: [] }; } };
    if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
    return no();
  } });
  let tree;
  try { tree = await exported.default(); } catch (error) { assert.ok(denied); assert.equal(error.message, 'DENIED'); }
  assert.equal(effects, 0);
  if (denied) { assert.equal(clients + readiness + queries.length + logs.length, 0); assert.equal(tree, undefined); return; }
  assert.equal(clients, 1); assert.equal(readiness, 1); assert.equal(queries.length, outer ? 0 : 4);
  for (const query of queries) if (!['factory', 'chain'].includes(query.mode)) assert.deepEqual(normalize(query.calls), chains[sources.indexOf(query.table)]);
  const rendered = expand(tree), all = text(rendered);
  assert.ok(!JSON.stringify(rendered).includes('PRIVATE_'));
  assert.ok(all.includes('SYNTHETIC_READINESS_ONLY') && all.includes('Real send disabled'));
  const metrics = nodes(rendered, n => n.type === 'article' && n.props.className?.startsWith('card stat '));
  assert.equal(metrics.length, 8);
  const available = sources.map((_, index) => !outer && !String(modes[index] ?? 'healthy').startsWith('error-') && !['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(modes[index]));
  const clean = data.map((rows, index) => available[index] && !['empty', 'null'].includes(modes[index]) ? rows ?? [] : []);
  const values = [clean[0].length, clean[0].filter(x => x.status === 'approved').length, clean[0].filter(x => x.status === 'draft').length, count ?? 0, clean[1].filter(x => x.status === 'queued').length, clean[1].filter(x => x.status === 'delivered' || x.status === 'read').length, clean[1].filter(x => x.status === 'failed').length + clean[3].filter(x => x.status === 'failed').length, communicationCount ?? clean[3].length];
  const tones = ['good', values[1] ? 'good' : 'warn', values[2] ? 'warn' : 'good', values[3] ? 'good' : 'warn', values[4] ? 'warn' : 'good', 'good', values[6] ? 'bad' : 'good', 'default'];
  metrics.forEach((metric, index) => {
    const known = dependencies[index].every(i => available[i]);
    assert.equal(text(nodes(metric, n => n.type === 'strong')[0]), known ? String(values[index]) : 'לא זמין');
    assert.ok(metric.props.className.includes(`stat-${known ? tones[index] : 'default'}`));
    assert.ok(text(metric).includes(labels[index]));
  });
  const cardsRendered = nodes(rendered, n => n.type === 'article' && n.props.className === 'card procedure-card');
  assert.equal(cardsRendered.length, clean[0].length + clean[1].length);
  assert.deepEqual(cardsRendered.map(x => x.key), [...clean[0], ...clean[1]].map(x => x.id));
  if (!available[0]) { assert.ok(all.includes('נתוני התבניות אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_TEMPLATE') && !all.includes('אין תבניות להצגה')); }
  else if (!clean[0].length) assert.ok(all.includes('אין תבניות להצגה'));
  if (!available[1]) { assert.ok(all.includes('נתוני לוג ה-WhatsApp אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_LOG_') && !all.includes('אין הודעות WhatsApp עדיין')); }
  else if (!clean[1].length) assert.ok(all.includes('אין הודעות WhatsApp עדיין'));
  assert.equal(Boolean(nodes(rendered, n => n.type === 'AdminDataError')[0].props.message), available.some(v => !v));
  return { rendered, all, metrics };
}
for (let source = 0; source < 4; source++) {
  for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) {
    test(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
  }
}
for (let first = 0; first < 4; first++) for (let second = first + 1; second < 4; second++) test(`paired-${first}-${second}`, () => render({ modes: { [first]: 'error-stale', [second]: 'chain' } }));
for (const mode of ['healthy', 'empty', 'null']) for (const count of [0, null, 17]) test(`known-${mode}-count-${count}`, () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, mode])), count }));
test('outer-client-failure-keeps-readonly-provider-metadata', () => render({ outer: true }));
test('denied-before-all-effects', () => render({ denied: true }));
test('stale-invalid-timestamp-never-formatted', () => { const data = fixtures(); data[1][2].created_at = 'INVALID_RETRY'; return render({ data, modes: { 1: 'error-stale' } }); });
test('healthy-provider-dry-run-badge-preserved', async () => { const r = await render({ configured: true }); assert.ok(r.all.includes('Dry-run בלבד')); });
test('known-maps-labels-nullish-defaults-and-typed-variables', async () => {
  const data = fixtures(); data[0][0].variables = 'not-an-array'; data[0][0].event_type = 'SYNTHETIC_EVENT'; data[0][0].status = 'paused'; data[0][0].body_preview = null; data[1][0] = { id: 'L0', status: 'disabled', masked_phone: 'SYNTHETIC_MASK' }; data[1][1].failure_reason = ''; data[1][1].created_at = null;
  const r = await render({ data }); assert.ok(r.all.includes('0 משתנים') && r.all.includes('SYNTHETIC_EVENT') && r.all.includes('נמען SYNTHETIC_MASK') && r.all.includes('אין תצוגה מקדימה') && r.all.includes('תבנית WhatsApp'));
});
test('bounded-raw-order-and-duplicate-keys-not-reinterpreted', () => {
  const data = fixtures(); data[0] = Array.from({ length: 101 }, (_, i) => ({ ...data[0][0], id: `T${i % 2}`, template_name: `SYNTHETIC_ORDER_${i}` })); return render({ data });
});
test('exact-single-domain-hook', () => {
  const config = JSON.parse(read('config/digital-observer-ci-gates.json'));
  assert.deepEqual(config.domain.filter(x => x.name === 'admin-whatsapp-query-boundary'), [{ name: 'admin-whatsapp-query-boundary', args: ['--test', 'scripts/qa/check-admin-whatsapp-query-boundary.mjs'] }]);
});
for (const communicationCount of [0, null, 999]) test(`general-log-server-count-${communicationCount}`, () => render({ communicationCount }));
test('delivered-and-read-not-sent-and-approved-not-active', async () => {
  const data = fixtures(); data[0].push({ ...data[0][0], id: 'ACTIVE_NOT_APPROVED', status: 'active' });
  const r = await render({ data });
  assert.equal(text(nodes(r.metrics[1], n => n.type === 'strong')[0]), '1');
  assert.equal(text(nodes(r.metrics[5], n => n.type === 'strong')[0]), '2');
});
test('no-local-message-or-communication-clamp', () => {
  const data = fixtures(); data[1] = Array.from({ length: 121 }, (_, i) => ({ ...data[1][0], id: `L${i % 2}`, status: i % 2 ? 'read' : 'delivered' })); data[3] = Array.from({ length: 201 }, (_, i) => ({ id: `C${i}`, status: 'failed' })); return render({ data, communicationCount: null });
});
