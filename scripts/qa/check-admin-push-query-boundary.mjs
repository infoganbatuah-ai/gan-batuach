import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Readonly synthetic presentation evidence; no provider module is evaluated.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(import.meta.url)('typescript');
function read(name) { const p = path.join(root, name); assert.equal(fs.statSync(p).flags & 0x40000000, 0); return fs.readFileSync(p, 'utf8'); }
function compile(source) { const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(result.diagnostics.length, 0); return result.outputText; }
const pageCode = compile(read('app/dashboard/admin/push/page.tsx'));
const componentCode = compile(read('components/push-diagnostics.tsx'));
const helperCode = compile(read('lib/admin-safe.ts'));
const serviceText = read('lib/domain/push-service.ts');
const serviceAST = ts.createSourceFile('push-service.ts', serviceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const selected = serviceAST.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text === 'maskDeviceToken');
assert.equal(selected.length, 1);
const maskCode = compile(selected[0].getText(serviceAST));
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
function fixture() {
  return {
    devices: [{ id: 'D1', platform: 'SYNTHETIC_IOS', role: 'SYNTHETIC_OWNER', device_token: 'SYNTHETIC_DEVICE_METADATA', is_active: true, app_version: 'SYNTHETIC_VERSION', last_seen_at: '2026-11-05T00:00:00Z' }, { id: 'D2', platform: 'SYNTHETIC_WEB', role: 'SYNTHETIC_VIEWER', device_token: 'SYNTH', is_active: false }],
    logs: ['sent_mock', 'queued_mock', 'failed', 'no_active_device', 'sent'].map((status, i) => ({ id: `L${i}`, status, title: `SYNTHETIC_LOG_${i}`, body: 'SYNTHETIC_BODY', provider: 'SYNTHETIC_PROVIDER', platform: 'SYNTHETIC_PLATFORM', failure_reason: i === 2 ? 'SYNTHETIC_REASON' : null, action_url: i === 2 ? 'SYNTHETIC_DESTINATION' : null, created_at: '2026-11-05T00:00:00Z' }))
  };
}
const sources = ['push_device_tokens', 'push_notification_logs'];
const chains = [
  [['select', '*'], ['order', 'last_seen_at', { ascending: false }], ['limit', 200]],
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 250]]
];
async function render({ modes = {}, data = fixture(), outer = false, denied = false, direct = false, flags = {}, poison = false, provider = 'synthetic' } = {}) {
  let clients = 0, providerReads = 0, maskCalls = 0, componentCalls = 0, effects = 0;
  const queries = [], logs = [];
  const no = () => { effects++; throw Error('UNEXPECTED_EFFECT'); };
  const context = { fetch: no, FormData: no, console: { warn: (...a) => logs.push(a), error: no }, process: { env: { get PUSH_PROVIDER() { providerReads++; return provider; } } } };
  class SafeDate extends Date { constructor(...a) { assert.notEqual(a[0], 'INVALID_DATE'); super(...a); } }
  const maskExports = {};
  vm.runInNewContext(maskCode, { exports: maskExports, require: no });
  const mask = token => { maskCalls++; assert.ok(token == null || token === '' || token.startsWith('SYNTH')); return maskExports.maskDeviceToken(token); };
  const component = {};
  vm.runInNewContext(componentCode, { ...context, Date: SafeDate, exports: component, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === '@/lib/domain/push-service') return { maskDeviceToken: mask };
    return no();
  } });
  const safe = {};
  vm.runInNewContext(helperCode, { ...context, exports: safe, require: no });
  function diagnostics(props) { componentCalls++; return component.PushDiagnostics(props); }
  const client = { from(table) {
    const index = sources.indexOf(table); assert.ok(index >= 0);
    const mode = modes[index] ?? 'healthy', calls = [];
    queries.push({ table, mode, calls });
    if (mode === 'factory') throw Error('PRIVATE_FACTORY');
    const query = {};
    for (const method of ['select', 'order', 'limit']) query[method] = (...args) => { if (mode === 'chain' && method === 'select') throw Error('PRIVATE_CHAIN'); calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => {
      if (mode === 'reject') return Promise.reject(Error('PRIVATE_REJECT')).then(resolve, reject);
      if (mode === 'reject-null') return Promise.reject(null).then(resolve, reject);
      if (mode === 'reject-false') return Promise.reject(false).then(resolve, reject);
      let rows = mode.endsWith('empty') ? [] : mode.endsWith('null') ? null : data[index ? 'logs' : 'devices'];
      if (mode === 'error-poison') rows = new Proxy([], { get: no });
      return Promise.resolve({ data: rows, error: mode.startsWith('error-') ? { message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT' } : null }).then(resolve, reject);
    };
    return query;
  } };
  let tree;
  if (direct) {
    const devices = poison && flags.devicesAvailable === false ? new Proxy([], { get: no }) : data.devices;
    const messages = poison && flags.logsAvailable === false ? new Proxy([], { get: no }) : data.logs;
    tree = diagnostics({ devices, logs: messages, ...flags });
  } else {
    const exported = {};
    vm.runInNewContext(pageCode, { ...context, exports: exported, require: id => {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
      if (id === '@/components/push-diagnostics') return { PushDiagnostics: diagnostics };
      if (id === '@/components/admin-data-state') return { AdminDataError: 'AdminDataError' };
      if (id === '@/lib/admin-safe') return safe;
      if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + providerReads + maskCalls + componentCalls + queries.length + logs.length, 0); if (denied) throw Error('DENIED'); } };
      if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
      return no();
    } });
    try { tree = await exported.default(); } catch (error) { assert.ok(denied); assert.equal(error.message, 'DENIED'); }
    if (denied) { assert.equal(tree, undefined); assert.equal(effects + clients + providerReads + maskCalls + componentCalls + queries.length + logs.length, 0); return; }
    assert.equal(clients, 1); assert.equal(providerReads, 1); assert.equal(queries.length, outer ? 0 : 2);
    for (const query of queries) if (!['factory', 'chain'].includes(query.mode)) assert.deepEqual(normalize(query.calls), chains[sources.indexOf(query.table)]);
  }
  const available = sources.map((_, i) => direct ? (i ? flags.logsAvailable : flags.devicesAvailable) ?? true : !outer && !String(modes[i] ?? 'healthy').startsWith('error-') && !['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(modes[i]));
  const devices = available[0] && (direct || !['empty', 'null'].includes(modes[0])) ? data.devices ?? [] : [];
  const messages = available[1] && (direct || !['empty', 'null'].includes(modes[1])) ? data.logs ?? [] : [];
  const raw = tree;
  function expand(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(expand);
    if (typeof value.type === 'function') return expand(value.type(value.props));
    return { ...value, props: { ...value.props, children: expand(value.props?.children) } };
  }
  tree = expand(tree);
  assert.equal(componentCalls, 1); assert.equal(maskCalls, devices.length); assert.equal(effects, 0);
  const all = text(tree); assert.ok(!JSON.stringify(raw).includes('PRIVATE_') && !JSON.stringify(tree).includes('PRIVATE_'));
  const metrics = nodes(tree, n => n.type === 'div' && n.props.className === 'metric-card');
  const expected = [devices.filter(d => d.is_active).length, messages.filter(l => l.status === 'sent_mock' || l.status === 'queued_mock').length, messages.filter(l => l.status === 'failed' || l.status === 'no_active_device').length];
  assert.equal(metrics.length, 3);
  metrics.forEach((metric, i) => assert.equal(text(nodes(metric, n => n.type === 'strong')[0]), available[i ? 1 : 0] ? String(expected[i]) : 'לא זמין'));
  const rows = nodes(tree, n => n.type === 'article' && n.props.className === 'info-card');
  assert.deepEqual(rows.map(r => r.key), [...devices, ...messages].map(r => r.id));
  if (!available[0]) { assert.ok(all.includes('נתוני המכשירים אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_OWNER') && !all.includes('אין עדיין מכשירים רשומים')); }
  else if (!devices.length) assert.ok(all.includes('אין עדיין מכשירים רשומים'));
  if (!available[1]) { assert.ok(all.includes('נתוני לוג ה-Push אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_LOG_') && !all.includes('SYNTHETIC_REASON') && !all.includes('SYNTHETIC_DESTINATION') && !all.includes('אין עדיין לוגים')); }
  else if (!messages.length) assert.ok(all.includes('אין עדיין לוגים'));
  if (!direct) assert.equal(Boolean(nodes(tree, n => n.type === 'AdminDataError')[0].props.message), available.some(v => !v));
  return { all, tree, metrics, rows, maskCalls };
}
for (let source = 0; source < 2; source++) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) test(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
for (const mode of ['healthy', 'empty', 'null']) test(`both-known-${mode}`, () => render({ modes: { 0: mode, 1: mode } }));
test('both-independent-failures', () => render({ modes: { 0: 'error-stale', 1: 'reject-null' } }));
test('outer-loader-failure', () => render({ outer: true }));
test('denied-before-every-effect', () => render({ denied: true }));
for (const flags of [{ devicesAvailable: false }, { logsAvailable: false }, { devicesAvailable: false, logsAvailable: false }]) {
  const id = `${flags.devicesAvailable === false ? 'devices' : ''}-${flags.logsAvailable === false ? 'logs' : ''}`;
  test(`direct-stale-${id}`, () => render({ direct: true, flags }));
  test(`direct-poison-${id}`, () => render({ direct: true, flags, poison: true }));
}
test('default-true-existing-caller', () => render({ direct: true }));
for (const direct of [false, true]) test(`failed-invalid-dates-${direct}`, () => {
  const data = fixture(); data.devices[0].last_seen_at = 'INVALID_DATE'; data.logs[0].created_at = 'INVALID_DATE';
  return render({ data, direct, modes: { 0: 'error-stale', 1: 'error-stale' }, flags: { devicesAvailable: false, logsAvailable: false } });
});
for (const status of ['sent_mock', 'queued_mock', 'failed', 'no_active_device', 'sent', 'queued', 'deduped', 'SYNTHETIC_UNKNOWN']) test(`known-status-${status}`, () => { const data = fixture(); data.logs = [{ ...data.logs[0], status }]; return render({ data }); });
for (const active of [true, false, 0, 1, '', 'false', null]) test(`known-active-${typeof active}-${String(active)}`, () => { const data = fixture(); data.devices[0].is_active = active; return render({ data }); });
for (const token of [null, '', 'SYNTH', 'SYNTHETIC_DEVICE_METADATA']) test(`known-mask-${token === null ? 'null' : token.length}`, async () => {
  const data = fixture(); data.devices = [{ ...data.devices[0], device_token: token }]; const r = await render({ data });
  assert.equal(text(nodes(r.rows[0], n => n.type === 'p')[0]), !token ? '' : token.length <= 10 ? '***' : `${token.slice(0, 4)}...${token.slice(-4)}`);
});
test('known-or-defaults-and-optional-details', async () => {
  const data = fixture(); data.devices[0].app_version = ''; data.devices[0].last_seen_at = null; data.logs[0].body = ''; data.logs[0].created_at = null; data.logs[0].failure_reason = ''; data.logs[0].action_url = '';
  const r = await render({ data }); assert.ok(r.all.includes('ללא גרסה') && r.all.includes('ללא last seen') && r.all.includes('ללא תוכן') && r.all.includes('ללא תאריך'));
});
test('raw-order-duplicate-ids-no-local-caps', () => {
  const data = fixture(); data.devices = Array.from({ length: 201 }, (_, i) => ({ ...data.devices[0], id: `D${i % 2}` })); data.logs = Array.from({ length: 251 }, (_, i) => ({ ...data.logs[0], id: `L${i % 2}` })); return render({ data });
});
test('provider-expression-uses-only-fake-getter', async () => { const r = await render({ provider: 'real' }); assert.ok(r.all.includes('Provider configured')); });
test('one-portable-domain-hook', () => {
  const config = JSON.parse(read('config/digital-observer-ci-gates.json'));
  assert.deepEqual(config.domain.filter(x => x.name === 'admin-push-query-boundary'), [{ name: 'admin-push-query-boundary', args: ['--test', 'scripts/qa/check-admin-push-query-boundary.mjs'] }]);
});
