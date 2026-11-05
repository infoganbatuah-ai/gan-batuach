import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Read-only presentation qualification. Provider modules and UI remain opaque.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(import.meta.url)('typescript');
function read(name) { const p = path.join(root, name); assert.equal(fs.statSync(p).flags & 0x40000000, 0); return fs.readFileSync(p, 'utf8'); }
function compile(source) { const r = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(read('app/dashboard/admin/push-production/page.tsx'));
const safeCode = compile(read('lib/admin-safe.ts'));
const serviceAST = ts.createSourceFile('push-service.ts', read('lib/domain/push-service.ts'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const selected = serviceAST.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'maskDeviceToken');
assert.equal(selected.length, 1);
const maskCode = compile(selected[0].getText(serviceAST));
const normalize = v => JSON.parse(JSON.stringify(v));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function nodes(v, predicate) {
  if (!v || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v.flatMap(x => nodes(x, predicate));
  return [...(predicate(v) ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, predicate))];
}
function text(v) {
  if (v == null || typeof v === 'boolean' || typeof v === 'function') return '';
  if (typeof v !== 'object') return String(v);
  return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children);
}
const sources = ['push_templates', 'push_notification_logs', 'push_device_tokens', 'push_category_preferences', 'push_provider_configs'];
const chains = [
  [['select', '*'], ['order', 'category'], ['order', 'template_name'], ['limit', 120]],
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 160]],
  [['select', '*'], ['order', 'last_seen_at', { ascending: false }], ['limit', 200]],
  [['select', 'id', { count: 'exact', head: true }]],
  [['select', '*'], ['order', 'provider']]
];
function fixture() {
  return [
    [{ id: 'T1', status: 'active', category: 'camera_alert', title_template: 'SYNTHETIC_TEMPLATE', body_template: '', template_name: 'SYNTHETIC_FALLBACK', default_action_type: '', variables: ['SYNTHETIC_VAR'] }, { id: 'T2', status: 'draft', category: 'SYNTHETIC_CATEGORY', title_template: 'SYNTHETIC_TEMPLATE2', body_template: null, template_name: 'SYNTHETIC_FALLBACK2', variables: null }],
    ['failed', 'opened', 'queued', 'sent_mock', 'dead_letter', 'no_active_device', 'sent', 'delivered', 'queued_mock'].map((status, i) => ({ id: `L${i}`, status, title: `SYNTHETIC_LOG_${i}`, body: 'SYNTHETIC_BODY', failure_reason: i === 0 ? 'SYNTHETIC_REASON' : null, platform: 'SYNTHETIC_PLATFORM', provider: 'SYNTHETIC_PROVIDER', deep_link_type: i === 0 ? '' : null, action_url: 'SYNTHETIC_TARGET', next_retry_at: i === 0 ? 'SYNTHETIC_RETRY' : null, opened_at: i === 6 ? 'SYNTHETIC_OPEN' : null })),
    [{ id: 'D1', platform: 'SYNTHETIC_IOS', role: 'SYNTHETIC_OWNER', device_token: 'SYNTHETIC_DEVICE_METADATA', is_active: true, revoked_at: 'SYNTHETIC_REVOKED' }, { id: 'D2', platform: 'SYNTHETIC_WEB', role: 'SYNTHETIC_VIEWER', device_token: 'SYNTH', is_active: false, disabled_reason: '' }],
    null,
    [{ provider: 'SYNTHETIC_DATABASE_PROVIDER' }]
  ];
}
const readiness = Object.freeze({ realSendEnabled: false, summary: 'SYNTHETIC_DISABLED_READINESS', providers: [{ provider: 'SYNTHETIC_DISABLED_PROVIDER', configured: false, missing: ['SYNTHETIC_CONFIGURATION'] }] });
function unavailable(mode) { return mode.startsWith('error-') || ['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(mode); }
async function render({ modes = {}, data = fixture(), count = 27, outer = false, denied = false } = {}) {
  let clients = 0, readinessCalls = 0, maskCalls = 0, effects = 0;
  const queries = [], diagnostics = [];
  const no = () => { effects++; throw Error('UNEXPECTED_EFFECT'); };
  const context = { fetch: no, FormData: no, console: { warn: (...a) => diagnostics.push(a), error: no }, process: new Proxy({}, { get: no }) };
  const safe = {}, mask = {}, exported = {};
  vm.runInNewContext(safeCode, { ...context, exports: safe, require: no });
  vm.runInNewContext(maskCode, { exports: mask, require: no });
  const client = { from(table) {
    const index = sources.indexOf(table); assert.ok(index >= 0);
    const mode = modes[index] ?? 'healthy', calls = [];
    queries.push({ table, mode, calls });
    if (mode === 'factory') throw Error('PRIVATE_FACTORY');
    const query = {};
    for (const method of ['select', 'order', 'limit']) query[method] = (...args) => { if (mode === 'chain' && method === 'select') throw Error('PRIVATE_CHAIN'); calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => {
      if (mode.startsWith('reject')) return Promise.reject(mode === 'reject-null' ? null : mode === 'reject-false' ? false : Error('PRIVATE_REJECT')).then(resolve, reject);
      const response = { error: mode.startsWith('error-') ? { message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT' } : null };
      Object.defineProperties(response, {
        data: { get: () => mode === 'error-poison' ? no() : mode.endsWith('empty') ? [] : mode.endsWith('null') || mode === 'null' ? null : data[index] },
        count: { get: () => mode === 'error-poison' ? no() : mode === 'empty' || mode === 'null' ? null : count }
      });
      return Promise.resolve(response).then(resolve, reject);
    };
    return query;
  } };
  vm.runInNewContext(pageCode, { ...context, exports: exported, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + readinessCalls + maskCalls + queries.length + diagnostics.length + effects, 0); if (denied) throw Error('DENIED'); } };
    if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
    if (id === '@/lib/domain/push-provider') return { getPushProductionReadiness: () => { readinessCalls++; return readiness; } };
    if (id === '@/lib/domain/push-service') return { maskDeviceToken: token => { maskCalls++; assert.ok(token == null || token === '' || token.startsWith('SYNTH')); return mask.maskDeviceToken(token); } };
    if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
    if (id === '@/components/stat-card') return { StatCard: 'StatCard' };
    if (id === 'lucide-react') return Object.fromEntries(['Bell', 'CheckCircle2', 'Link2', 'RefreshCw', 'ShieldCheck', 'Smartphone', 'TriangleAlert'].map(x => [x, x]));
    return no();
  } });
  let tree;
  try { tree = await exported.default(); } catch (e) { assert.ok(denied); assert.equal(e.message, 'DENIED'); }
  if (denied) { assert.equal(tree, undefined); assert.equal(clients + readinessCalls + maskCalls + effects + queries.length + diagnostics.length, 0); return; }
  assert.equal(clients, 1); assert.equal(readinessCalls, 1); assert.equal(effects, 0);
  assert.equal(queries.length, outer ? 0 : 5);
  assert.deepEqual(queries.map(q => q.table), outer ? [] : sources);
  for (const q of queries) if (!['factory', 'chain'].includes(q.mode)) assert.deepEqual(normalize(q.calls), chains[sources.indexOf(q.table)]);
  const available = sources.map((_, i) => !outer && !unavailable(modes[i] ?? 'healthy'));
  const rows = sources.map((_, i) => available[i] && !['empty', 'null'].includes(modes[i]) ? data[i] ?? [] : []);
  const [templates, logs, devices] = rows;
  const expected = [templates.length, templates.filter(t => t.status === 'active').length, devices.filter(d => d.is_active).length, devices.filter(d => !d.is_active || d.revoked_at).length, logs.filter(l => ['queued', 'queued_mock'].includes(l.status)).length, logs.filter(l => ['delivered', 'opened', 'sent_mock'].includes(l.status)).length, logs.filter(l => l.status === 'opened' || l.opened_at).length, logs.filter(l => ['failed', 'dead_letter', 'no_active_device'].includes(l.status)).length];
  const expectedTones = [expected[0] ? 'good' : 'warn', expected[1] ? 'good' : 'warn', expected[2] ? 'good' : 'warn', expected[3] ? 'warn' : 'good', expected[4] ? 'warn' : 'good', 'good', 'good', expected[7] ? 'bad' : 'good'];
  const dependencies = [0, 0, 2, 2, 1, 1, 1, 1];
  const metrics = nodes(tree, n => n.type === 'StatCard'); assert.equal(metrics.length, 8);
  metrics.forEach((m, i) => { assert.equal(m.props.value, available[dependencies[i]] ? expected[i] : 'לא זמין'); assert.equal(m.props.tone, available[dependencies[i]] ? expectedTones[i] : 'warn'); });
  const all = text(tree); assert.ok(!JSON.stringify(tree).includes('PRIVATE_'));
  assert.ok(all.includes(readiness.summary) && all.includes('SYNTHETIC_DISABLED_PROVIDER') && all.includes('SYNTHETIC_CONFIGURATION') && all.includes('Real push disabled') && all.includes('Mock / dry-run בלבד'));
  assert.equal(maskCalls, Math.min(devices.length, 8));
  const cards = nodes(tree, n => n.type === 'article' && n.props.className === 'card procedure-card');
  assert.deepEqual(cards.map(n => n.key), [...templates, ...logs].map(r => r.id));
  assert.deepEqual(nodes(tree, n => n.type === 'div' && n.props.className === 'mini-row').map(n => n.key), devices.slice(0, 8).map(d => d.id));
  for (const [index, unknown, empty, stale] of [[0, 'נתוני התבניות אינם זמינים', 'אין תבניות Push להצגה', 'SYNTHETIC_TEMPLATE'], [1, 'נתוני הלוג אינם זמינים', 'אין לוגים עדיין', 'SYNTHETIC_LOG_'], [2, 'נתוני המכשירים אינם זמינים', 'אין מכשירים רשומים', 'SYNTHETIC_OWNER']]) {
    if (!available[index]) { assert.ok(all.includes(unknown)); assert.ok(!all.includes(empty) && !all.includes(stale)); }
    else if (!rows[index].length) assert.ok(all.includes(empty));
  }
  const riskRows = nodes(tree, n => n.type === 'div' && ['העדפות קטגוריה', 'Retry מתוזמן', 'ספקים במסד'].some(label => text(n).includes(label)) && nodes(n, x => x.type === 'b').length === 1);
  assert.equal(riskRows.length, 3);
  assert.deepEqual(riskRows.map(n => text(nodes(n, x => x.type === 'b')[0])), [available[3] ? String(['empty', 'null'].includes(modes[3]) ? 0 : count ?? 0) : 'לא זמין', available[1] ? String(logs.filter(l => l.next_retry_at && l.status === 'failed').length) : 'לא זמין', available[4] ? String(rows[4].length) : 'לא זמין']);
  assert.equal(Boolean(nodes(tree, n => n.props.role === 'alert').length), available.some(v => !v));
  assert.ok(diagnostics.every(args => !JSON.stringify(args).includes('PRIVATE_')));
  if (available.every(Boolean)) assert.equal(diagnostics.length, 0); else assert.ok(diagnostics.length > 0);
  return { tree, all, cards, metrics, maskCalls };
}
const cases = [];
function add(id, run) { cases.push({ id, run }); }
for (let source = 0; source < 5; source++) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) add(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
for (const mode of ['healthy', 'empty', 'null']) add(`all-known-${mode}`, () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, mode])), data: mode === 'empty' ? [[], [], [], null, []] : fixture() }));
add('denied-before-client-readiness-mask-render', () => render({ denied: true }));
add('outer-client-failure-keeps-readiness-independent', () => render({ outer: true }));
for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) add(`independent-pair-${a}-${b}`, () => render({ modes: { [a]: 'error-stale', [b]: 'reject-false' } }));
add('all-sources-unknown', () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, 'error-poison'])) }));
for (const status of ['failed', 'dead_letter', 'no_active_device', 'queued', 'queued_mock', 'sent_mock', 'sent', 'delivered', 'opened', 'deduped', 'SYNTHETIC_UNKNOWN']) add(`status-${status}`, () => { const data = fixture(); data[1] = [{ ...data[1][0], status }]; return render({ data }); });
for (const active of [true, false, 0, 1, '', 'false', null]) add(`active-${typeof active}-${String(active)}`, () => { const data = fixture(); data[2][0].is_active = active; return render({ data }); });
for (const opened of [null, '', 'SYNTHETIC_OPEN']) add(`opened-truthy-${String(opened)}`, () => { const data = fixture(); data[1] = [{ ...data[1][6], status: 'sent', opened_at: opened }]; return render({ data }); });
for (const token of [null, '', 'SYNTH', 'SYNTHETIC_DEVICE_METADATA']) add(`mask-known-${token === null ? 'null' : token.length}`, async () => {
  const data = fixture(); data[2] = [{ ...data[2][0], device_token: token }]; const r = await render({ data });
  const row = nodes(r.tree, n => n.type === 'div' && n.props.className === 'mini-row')[0];
  assert.equal(text(nodes(row, n => n.type === 'strong')[0]), !token ? '' : token.length <= 10 ? '***' : `${token.slice(0, 4)}...${token.slice(-4)}`);
});
add('healthy-null-count-falls-back-to-zero', () => render({ count: null }));
add('source-caps-and-order-no-extra-local-clamp', () => { const data = fixture(); data[0] = Array.from({ length: 121 }, (_, i) => ({ ...data[0][0], id: `T${i % 2}` })); data[1] = Array.from({ length: 161 }, (_, i) => ({ ...data[1][0], id: `L${i % 2}` })); data[2] = Array.from({ length: 201 }, (_, i) => ({ ...data[2][0], id: `D${i % 2}` })); return render({ data }); });
add('nullish-labels-preserve-empty-string', async () => { const r = await render(); const first = r.cards[0]; assert.equal(text(nodes(first, n => n.type === 'p')[0]), ''); const firstLog = r.cards[2]; assert.ok(text(firstLog).includes('SYNTHETIC_REASON')); assert.ok(!text(firstLog).includes('SYNTHETIC_TARGET')); });
add('one-portable-domain-hook', () => { const config = JSON.parse(read('config/digital-observer-ci-gates.json')); assert.deepEqual(config.domain.filter(x => x.name === 'admin-push-production-query-boundary'), [{ name: 'admin-push-production-query-boundary', args: ['--test', 'scripts/qa/check-admin-push-production-query-boundary.mjs'] }]); });
const registry = cases.map(c => c.id); assert.equal(new Set(registry).size, registry.length);
console.log('CASE_REGISTRY ' + JSON.stringify(registry));
for (const c of cases) test(c.id, c.run);
