import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Disconnected readonly render qualification; handlers and setters are never run.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(import.meta.url)('typescript');
function read(name) { const p = path.join(root, name); assert.equal(fs.statSync(p).flags & 0x40000000, 0); return fs.readFileSync(p, 'utf8'); }
function compile(name) { const r = ts.transpileModule(read(name), { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const page = compile('app/dashboard/admin/communication/page.tsx');
const component = compile('components/communication-center.tsx');
const helper = compile('lib/admin-safe.ts');
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const normalize = value => JSON.parse(JSON.stringify(value));
const defaultCapability = { in_app: 'available', push: 'not_configured', email: 'not_configured', whatsapp: 'not_configured', sms: 'not_configured' };
function nodes(v, predicate) {
  if (!v || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v.flatMap(x => nodes(x, predicate));
  return [...(predicate(v) ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, predicate))];
}
function text(v) { if (v == null || typeof v === 'boolean' || typeof v === 'function') return ''; if (typeof v !== 'object') return String(v); return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children); }
function fixture() {
  return {
    logs: ['failed', 'sent_mock', 'queued', 'sent'].map((status, i) => ({ id: `L${i}`, status, channel: ['sms', 'email', 'in_app', 'whatsapp'][i], template_key: `SYNTHETIC_LOG_${i}`, message_preview: 'SYNTHETIC_PREVIEW', provider: 'SYNTHETIC_PROVIDER', failure_reason: i === 0 ? 'SYNTHETIC_REASON' : null, created_at: '2026-11-05T00:00:00Z' })),
    templates: [{ id: 'T1', title: 'SYNTHETIC_TEMPLATE', body: 'SYNTHETIC_BODY', template_key: 'SYNTHETIC_KEY', audience_role: 'SYNTHETIC_ROLE', active: true }, { id: 'T2', title: 'SYNTHETIC_DISABLED_TEMPLATE', body: 'SYNTHETIC_BODY_2', template_key: 'SYNTHETIC_KEY_2', audience_role: 'SYNTHETIC_ROLE_2', active: false }]
  };
}
const sources = ['communication_logs', 'communication_templates'];
const chains = [
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 250]],
  [['select', '*'], ['order', 'audience_role', { ascending: true }], ['order', 'template_key', { ascending: true }]]
];
async function render({ modes = {}, data = fixture(), outer = false, denied = false, direct = false, role = 'admin', flags = {}, poison = false, channel = 'all', status = 'all', settings = null, capability = defaultCapability, omitCapability = false } = {}) {
  let clients = 0, capabilityCalls = 0, componentCalls = 0, effects = 0, memoCalls = 0;
  const queries = [], logs = [], initialStates = [];
  const no = () => { effects++; throw Error('UNEXPECTED_SIDE_EFFECT'); };
  const context = { process: new Proxy({}, { get: no }), fetch: no, FormData: no, console: { warn: (...a) => logs.push(a), error: no } };
  class SafeDate extends Date { constructor(...a) { assert.notEqual(a[0], 'INVALID_DATE'); super(...a); } }
  const exports = {};
  vm.runInNewContext(component, { ...context, Date: SafeDate, exports, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (id === 'react') return {
      useState: initial => { const index = initialStates.length; initialStates.push(initial); return [index === 0 ? channel : index === 1 ? status : initial, no]; },
      useMemo: (body, dependencies) => { memoCalls++; assert.equal(dependencies.length, 3); assert.equal(dependencies[1], channel); assert.equal(dependencies[2], status); return body(); }
    };
    if (id === '@/components/broadcast-center') return { DeliveryReadinessStrip: 'OpaqueReadinessStrip' };
    return no();
  } });
  const safe = {};
  vm.runInNewContext(helper, { ...context, exports: safe, require: no });
  const center = props => { componentCalls++; return exports.CommunicationCenter(props); };
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
      let rows = mode.endsWith('empty') ? [] : mode.endsWith('null') ? null : data[index ? 'templates' : 'logs'];
      if (mode === 'error-poison') rows = new Proxy([], { get: no });
      return Promise.resolve({ data: rows, error: mode.startsWith('error-') ? { message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT' } : null }).then(resolve, reject);
    };
    return query;
  } };
  let tree;
  if (direct) {
    const rawLogs = poison && flags.logsAvailable === false ? new Proxy([], { get: no }) : data.logs;
    const rawTemplates = poison && flags.templatesAvailable === false ? new Proxy([], { get: no }) : data.templates;
    tree = center({ role, logs: rawLogs, templates: rawTemplates, settings, apiPath: '/SYNTHETIC_DISABLED_CONTROL', ...(omitCapability ? {} : { capability }), ...flags });
  } else {
    const exported = {};
    vm.runInNewContext(page, { ...context, exports: exported, require: id => {
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
      if (id === '@/components/communication-center') return { CommunicationCenter: center };
      if (id === '@/components/admin-data-state') return { AdminDataError: 'AdminDataError' };
      if (id === '@/lib/admin-safe') return safe;
      if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + capabilityCalls + componentCalls + queries.length + logs.length, 0); if (denied) throw Error('DENIED'); } };
      if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
      if (id === '@/lib/management/external-delivery') return { managementDeliveryCapability: () => { capabilityCalls++; return capability; } };
      return no();
    } });
    try { tree = await exported.default(); } catch (error) { assert.ok(denied); assert.equal(error.message, 'DENIED'); }
    if (denied) { assert.equal(tree, undefined); assert.equal(effects + clients + capabilityCalls + componentCalls + queries.length + logs.length + initialStates.length + memoCalls, 0); return; }
    assert.equal(clients, 1); assert.equal(capabilityCalls, 1); assert.equal(queries.length, outer ? 0 : 2);
    for (const query of queries) if (!['factory', 'chain'].includes(query.mode)) assert.deepEqual(normalize(query.calls), chains[sources.indexOf(query.table)]);
  }
  const available = sources.map((_, i) => direct ? (i ? flags.templatesAvailable : flags.logsAvailable) ?? true : !outer && !String(modes[i] ?? 'healthy').startsWith('error-') && !['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(modes[i]));
  const cleanLogs = available[0] && (direct || !['empty', 'null'].includes(modes[0])) ? data.logs ?? [] : [];
  const cleanTemplates = available[1] && (direct || !['empty', 'null'].includes(modes[1])) ? data.templates ?? [] : [];
  const filtered = cleanLogs.filter(log => (channel === 'all' || log.channel === channel) && (status === 'all' || log.status === status));
  const raw = tree;
  function expand(v) { if (!v || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(expand); if (typeof v.type === 'function') return expand(v.type(v.props)); return { ...v, props: { ...v.props, children: expand(v.props?.children) } }; }
  tree = expand(tree);
  assert.equal(componentCalls, 1); assert.equal(memoCalls, 1); assert.equal(effects, 0);
  assert.deepEqual(initialStates, ['all', 'all', direct ? settings?.default_parent_channel ?? 'in_app' : 'in_app', false, null]);
  const all = text(tree); assert.ok(!JSON.stringify(raw).includes('PRIVATE_') && !JSON.stringify(tree).includes('PRIVATE_'));
  const metrics = nodes(tree, n => n.type === 'div' && n.props.className === 'metric-card'); assert.equal(metrics.length, 3);
  const values = [cleanLogs.length, cleanLogs.filter(l => l.status === 'sent_mock').length, cleanLogs.filter(l => l.status === 'failed').length];
  metrics.forEach((n, i) => assert.equal(text(nodes(n, x => x.type === 'strong')[0]), available[0] ? String(values[i]) : 'לא זמין'));
  const rows = nodes(tree, n => n.type === 'article' && n.props.className === 'info-card');
  assert.deepEqual(rows.map(r => r.key), [...filtered, ...cleanTemplates.slice(0, 12)].map(r => r.id));
  if (!available[0]) { assert.ok(all.includes('נתוני לוג התקשורת אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_LOG_') && !all.includes('SYNTHETIC_REASON') && !all.includes('אין הודעות במסנן הזה')); }
  else if (!filtered.length) assert.ok(all.includes('אין הודעות במסנן הזה'));
  if (!available[1]) { assert.ok(all.includes('נתוני תבניות התקשורת אינם זמינים')); assert.ok(!all.includes('SYNTHETIC_TEMPLATE') && !all.includes('SYNTHETIC_BODY')); }
  const retry = nodes(tree, n => n.type === 'button' && text(n) === 'ניסיון חוזר');
  assert.equal(retry.length, (direct ? role : 'admin') === 'admin' ? filtered.filter(l => l.status === 'failed').length : 0);
  retry.forEach(n => { assert.equal(n.props.disabled, false); assert.equal(typeof n.props.onClick, 'function'); });
  const selects = nodes(tree, n => n.type === 'select'); assert.equal(selects.length, direct && role === 'garden' ? 3 : 2);
  assert.deepEqual(selects.slice(-2).map(n => n.props.value), [channel, status]);
  selects.forEach(n => assert.equal(typeof n.props.onChange, 'function'));
  if (direct && role === 'garden') {
    assert.equal(selects[0].props.value, settings?.default_parent_channel ?? 'in_app');
    const options = nodes(selects[0], n => n.type === 'option');
    assert.equal(options.find(n => n.props.value === 'whatsapp').props.disabled, true); assert.equal(options.find(n => n.props.value === 'sms').props.disabled, true);
    assert.equal(options.find(n => n.props.value === 'email').props.disabled, (omitCapability ? defaultCapability : capability).email !== 'provider_submission_available');
    const save = nodes(tree, n => n.type === 'button' && text(n) === 'שמירת הגדרות'); assert.equal(save.length, 1); assert.equal(typeof save[0].props.onClick, 'function');
  }
  const strip = nodes(tree, n => n.type === 'OpaqueReadinessStrip'); assert.equal(strip.length, 1); assert.deepEqual(normalize(strip[0].props.capability), omitCapability ? defaultCapability : capability);
  if (!direct) assert.equal(Boolean(nodes(tree, n => n.type === 'AdminDataError')[0].props.message), available.some(v => !v));
  return { tree, all, rows, metrics };
}
const cases = [];
const add = (id, body) => cases.push({ id, body });
for (let source = 0; source < 2; source++) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) add(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
for (const mode of ['healthy', 'empty', 'null']) add(`both-known-${mode}`, () => render({ modes: { 0: mode, 1: mode } }));
add('both-independent-failures', () => render({ modes: { 0: 'error-stale', 1: 'reject-false' } }));
add('outer-loader-failure', () => render({ outer: true }));
add('denied-before-all-effects', () => render({ denied: true }));
for (const flags of [{ logsAvailable: false }, { templatesAvailable: false }, { logsAvailable: false, templatesAvailable: false }]) {
  const id = `${flags.logsAvailable === false ? 'logs' : ''}-${flags.templatesAvailable === false ? 'templates' : ''}`;
  add(`direct-stale-${id}`, () => render({ direct: true, flags })); add(`direct-poison-${id}`, () => render({ direct: true, flags, poison: true }));
}
for (const role of ['admin', 'garden']) add(`default-flags-${role}`, () => render({ direct: true, role, omitCapability: true }));
for (const direct of [false, true]) add(`failed-invalid-date-${direct}`, () => { const data = fixture(); data.logs[0].created_at = 'INVALID_DATE'; return render({ data, direct, modes: { 0: 'error-stale' }, flags: { logsAvailable: false } }); });
for (const channel of ['all', 'in_app', 'sms', 'whatsapp', 'email']) for (const status of ['all', 'failed', 'sent_mock', 'deduped', 'skipped_preferences']) add(`filter-${channel}-${status}`, () => render({ channel, status }));
for (const email of ['not_configured', 'provider_submission_available', 'disabled']) add(`garden-capability-${email}`, () => render({ direct: true, role: 'garden', flags: { logsAvailable: false, templatesAvailable: false }, settings: { default_parent_channel: 'email' }, capability: { ...defaultCapability, email } }));
for (const status of ['queued', 'sent', 'delivered', 'read', 'failed', 'sent_mock', 'deduped', 'SYNTHETIC_UNKNOWN']) add(`known-status-${status}`, () => { const data = fixture(); data.logs = [{ ...data.logs[0], status }]; return render({ data }); });
for (const active of [false, true, 0, 'false']) add(`known-template-active-${typeof active}-${active}`, () => { const data = fixture(); data.templates[0].active = active; return render({ data }); });
add('original-truthy-fallbacks', async () => { const data = fixture(); data.logs[0].provider = ''; data.logs[0].message_preview = ''; data.logs[0].created_at = null; data.logs[0].failure_reason = ''; data.logs[2].provider = ''; const r = await render({ data }); assert.ok(r.all.includes('ספק לא מוגדר') && r.all.includes('מסירה פנימית') && r.all.includes('אין תצוגה מקדימה') && r.all.includes('ללא תאריך')); });
add('raw-log-order-duplicates-and-original-template-slice', () => { const data = fixture(); data.logs = Array.from({ length: 251 }, (_, i) => ({ ...data.logs[0], id: `L${i % 2}` })); data.templates = Array.from({ length: 15 }, (_, i) => ({ ...data.templates[0], id: `T${i}`, title: `SYNTHETIC_TEMPLATE_${i}` })); return render({ data }); });
add('one-portable-domain-hook', () => { const config = JSON.parse(read('config/digital-observer-ci-gates.json')); assert.deepEqual(config.domain.filter(x => x.name === 'admin-communication-query-boundary'), [{ name: 'admin-communication-query-boundary', args: ['--test', 'scripts/qa/check-admin-communication-query-boundary.mjs'] }]); });
assert.equal(new Set(cases.map(x => x.id)).size, cases.length);
console.log(`CASE_REGISTRY ${JSON.stringify(cases.map(x => x.id))}`);
for (const entry of cases) test(entry.id, entry.body);
