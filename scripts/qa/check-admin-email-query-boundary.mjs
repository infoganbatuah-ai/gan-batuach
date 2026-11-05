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
const page = compile('app/dashboard/admin/email-production/page.tsx');
const helper = compile('lib/admin-safe.ts');
const stat = compile('components/stat-card.tsx');
const sources = ['email_templates', 'email_delivery_logs', 'email_category_preferences', 'email_provider_configs', 'communication_logs'];
const chains = [
  [['select', '*'], ['order', 'category'], ['order', 'template_name'], ['limit', 120]],
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 160]],
  [['select', 'id', { count: 'exact', head: true }]],
  [['select', '*'], ['order', 'provider']],
  [['select', 'id, status', { count: 'exact' }], ['eq', 'channel', 'email'], ['order', 'created_at', { ascending: false }], ['limit', 200]]
];
const labels = ['תבניות', 'פעילות', 'בתור', 'נמסר', 'נפתח', 'נלחץ', 'כשלונות', 'Retry מתוזמן'];
const dependencies = [[0], [0], [1], [1], [1], [1], [1, 4], [1]];
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
    [{ id: 'T1', subject_template: 'SYNTHETIC_TEMPLATE', body_text_template: 'SYNTHETIC_BODY', status: 'active', category: 'observer_notification', language: 'he', variables: ['one', 'two'] }, { id: 'T2', subject_template: 'SYNTHETIC_DRAFT', status: 'draft', variables: null }],
    ['queued', 'delivered', 'failed', 'dead_letter', 'sent', 'opened', 'clicked'].map((status, index) => ({ id: `L${index}`, status, category: 'observer_notification', subject_preview: `SYNTHETIC_LOG_${index}`, provider: 'SYNTHETIC_PROVIDER', next_retry_at: status === 'failed' ? '2026-11-05T00:00:00Z' : null })),
    [{ id: 'SYNTHETIC_CONSENT' }],
    [{ id: 'SYNTHETIC_PROVIDER_ONE' }, { id: 'SYNTHETIC_PROVIDER_TWO' }],
    [{ id: 'C1', status: 'failed' }, { id: 'C2', status: 'dead_letter' }]
  ];
}
async function render({ modes = {}, outer = false, denied = false, data = fixtures(), count = 17, configured = false } = {}) {
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
      return Promise.resolve({ data: rows, error, count: error ? 919 : count }).then(resolve, reject);
    };
    return query;
  } };
  const exported = {};
  class SafeDate extends Date { constructor(...args) { assert.notEqual(args[0], 'INVALID_RETRY'); super(...args); } }
  vm.runInNewContext(page, { ...context, exports: exported, Date: SafeDate, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'lucide-react') return Object.fromEntries(['AlertTriangle', 'CheckCircle2', 'Mail', 'MousePointerClick', 'RefreshCw', 'ShieldCheck'].map(n => [n, `Icon:${n}`]));
    if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
    if (id === '@/components/stat-card') return cards;
    if (id === '@/components/resend-live-test-button') return { ResendLiveTestButton: 'OpaqueLiveTest' };
    if (id === '@/components/admin-data-state') return { AdminDataError: 'AdminDataError' };
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + readiness + queries.length, 0); if (denied) throw Error('DENIED'); } };
    if (id === '@/lib/domain/email-provider') return { getEmailProductionReadiness: () => { readiness++; return { configured, canSendRealMessages: false, provider: 'SYNTHETIC_EMAIL_PROVIDER', summary: 'SYNTHETIC_READINESS_ONLY', missing: [] }; } };
    if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
    return no();
  } });
  let tree;
  try { tree = await exported.default(); } catch (error) { assert.ok(denied); assert.equal(error.message, 'DENIED'); }
  assert.equal(effects, 0);
  if (denied) { assert.equal(clients + readiness + queries.length + logs.length, 0); assert.equal(tree, undefined); return; }
  assert.equal(clients, 1); assert.equal(readiness, 1); assert.equal(queries.length, outer ? 0 : 5);
  for (const query of queries) if (!['factory', 'chain'].includes(query.mode)) assert.deepEqual(normalize(query.calls), chains[sources.indexOf(query.table)]);
  const rendered = expand(tree), all = text(rendered);
  assert.ok(!JSON.stringify(rendered).includes('PRIVATE_'));
  assert.ok(all.includes('SYNTHETIC_READINESS_ONLY') && all.includes('Real email disabled'));
  const live = nodes(rendered, n => n.type === 'OpaqueLiveTest'); assert.equal(live.length, 1); assert.equal(live[0].props.enabled, false);
  const metrics = nodes(rendered, n => n.type === 'article' && n.props.className?.startsWith('card stat '));
  assert.equal(metrics.length, 8);
  const available = sources.map((_, index) => !outer && !String(modes[index] ?? 'healthy').startsWith('error-') && !['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(modes[index]));
  const clean = data.map((rows, index) => available[index] && !['empty', 'null'].includes(modes[index]) ? rows ?? [] : []);
  const values = [clean[0].length, clean[0].filter(x => x.status === 'active').length, clean[1].filter(x => x.status === 'queued').length, clean[1].filter(x => ['delivered', 'opened', 'clicked'].includes(x.status)).length, clean[1].filter(x => x.status === 'opened' || x.opened_at).length, clean[1].filter(x => x.status === 'clicked' || x.clicked_at).length, clean[1].filter(x => ['failed', 'dead_letter'].includes(x.status)).length + clean[4].filter(x => x.status === 'failed').length, clean[1].filter(x => x.next_retry_at && x.status === 'failed').length];
  const tones = [values[0] ? 'good' : 'warn', values[1] ? 'good' : 'warn', values[2] ? 'warn' : 'good', 'good', 'good', 'good', values[6] ? 'bad' : 'good', values[7] ? 'warn' : 'good'];
  metrics.forEach((metric, index) => {
    const known = dependencies[index].every(i => available[i]);
    assert.equal(text(nodes(metric, n => n.type === 'strong')[0]), known ? String(values[index]) : 'לא זמין');
    assert.ok(metric.props.className.includes(`stat-${known ? tones[index] : 'default'}`));
    assert.ok(text(metric).includes(labels[index]));
  });
  const cardsRendered = nodes(rendered, n => n.type === 'article' && n.props.className === 'card procedure-card');
  assert.equal(cardsRendered.length, clean[0].length + clean[1].length);
  assert.deepEqual(cardsRendered.map(x => x.key), [...clean[0], ...clean[1]].map(x => x.id));
  if (!available[0]) { assert.ok(all.includes('נתוני תבניות האימייל אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_TEMPLATE') && !all.includes('אין תבניות אימייל להצגה')); }
  else if (!clean[0].length) assert.ok(all.includes('אין תבניות אימייל להצגה'));
  if (!available[1]) { assert.ok(all.includes('נתוני לוג האימייל אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_LOG_') && !all.includes('אין אימיילים בתור עדיין')); }
  else if (!clean[1].length) assert.ok(all.includes('אין אימיילים בתור עדיין'));
  const paragraph = nodes(rendered, n => n.type === 'p' && n.props.className === 'muted').map(text).find(s => s.includes('העדפות קטגוריה:'));
  assert.equal(paragraph, `העדפות קטגוריה: ${available[2] ? count ?? 0 : 'לא זמין'} · ספקים במסד: ${available[3] ? clean[3].length : 'לא זמין'}`);
  assert.equal(Boolean(nodes(rendered, n => n.type === 'AdminDataError')[0].props.message), available.some(v => !v));
  return { rendered, all, metrics };
}
for (let source = 0; source < 5; source++) {
  for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) {
    test(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
  }
}
for (let first = 0; first < 5; first++) for (let second = first + 1; second < 5; second++) test(`paired-${first}-${second}`, () => render({ modes: { [first]: 'error-stale', [second]: 'chain' } }));
for (const mode of ['healthy', 'empty', 'null']) for (const count of [0, null, 17]) test(`known-${mode}-count-${count}`, () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, mode])), count }));
test('outer-client-failure-keeps-readonly-provider-metadata', () => render({ outer: true }));
test('denied-before-all-effects', () => render({ denied: true }));
test('stale-invalid-retry-never-formatted', () => { const data = fixtures(); data[1][2].next_retry_at = 'INVALID_RETRY'; return render({ data, modes: { 1: 'error-stale' } }); });
test('healthy-provider-configured-but-live-test-disabled', async () => { const r = await render({ configured: true }); assert.ok(r.all.includes('ממתין להפעלה')); });
test('known-maps-labels-nullish-defaults-and-typed-variables', async () => {
  const data = fixtures(); data[0][0].variables = 'not-an-array'; data[0][0].category = 'SYNTHETIC_CATEGORY'; data[0][0].status = 'paused'; data[1][0] = { id: 'L0', status: 'disabled', category: null }; data[1][1].failure_reason = ''; data[1][1].message_preview = 'SHOULD_NOT_REPLACE_EMPTY_FAILURE';
  const r = await render({ data }); assert.ok(r.all.includes('0 משתנים') && r.all.includes('SYNTHETIC_CATEGORY') && r.all.includes('ללא תוכן') && r.all.includes('כללי') && !r.all.includes('SHOULD_NOT_REPLACE_EMPTY_FAILURE'));
});
test('bounded-raw-order-and-duplicate-keys-not-reinterpreted', () => {
  const data = fixtures(); data[0] = Array.from({ length: 121 }, (_, i) => ({ ...data[0][0], id: `T${i % 2}`, subject_template: `SYNTHETIC_ORDER_${i}` })); return render({ data });
});
test('email-specific-delivery-tracking-and-failure-predicates', async () => {
  const data = fixtures(); data[1][0].opened_at = 'SYNTHETIC_TRACKING_TIME'; data[1][4].clicked_at = 'SYNTHETIC_TRACKING_TIME'; data[1][3].next_retry_at = '2026-11-05T00:00:00Z';
  const r = await render({ data });
  for (const [index, expected] of [[3, '3'], [4, '2'], [5, '2'], [6, '3'], [7, '1']]) assert.equal(text(nodes(r.metrics[index], n => n.type === 'strong')[0]), expected);
});
test('no-local-log-communication-or-provider-clamp', () => {
  const data = fixtures(); data[1] = Array.from({ length: 161 }, (_, i) => ({ ...data[1][0], id: `L${i % 2}` })); data[4] = Array.from({ length: 201 }, (_, i) => ({ id: `C${i}`, status: 'failed' })); data[3] = Array.from({ length: 205 }, (_, i) => ({ id: `P${i}` })); return render({ data });
});
test('exact-single-domain-hook', () => {
  const config = JSON.parse(read('config/digital-observer-ci-gates.json'));
  assert.deepEqual(config.domain.filter(x => x.name === 'admin-email-query-boundary'), [{ name: 'admin-email-query-boundary', args: ['--test', 'scripts/qa/check-admin-email-query-boundary.mjs'] }]);
});
