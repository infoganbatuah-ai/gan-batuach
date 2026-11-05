import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Actual readonly page and safe helper; every UI/provider/test widget is opaque.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(import.meta.url)('typescript');
function read(name) { const p = path.join(root, name); assert.equal(fs.statSync(p).flags & 0x40000000, 0); return fs.readFileSync(p, 'utf8'); }
function compile(name) { const r = ts.transpileModule(read(name), { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const page = compile('app/dashboard/admin/communications/page.tsx');
const helper = compile('lib/admin-safe.ts');
const channels = ['whatsapp', 'sms', 'email', 'push'];
const sources = ['communication_provider_configs', 'real_communication_templates', 'communication_test_logs', 'communication_delivery_events', 'communication_threads', 'messages', 'notifications', 'parent_child_requests', 'whatsapp_message_logs', 'sms_message_logs', 'email_delivery_logs', 'push_notification_logs'];
const chains = [
  [['select', '*'], ['order', 'channel'], ['order', 'provider']],
  [['select', '*'], ['order', 'channel'], ['order', 'template_kind']],
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 40]],
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 180]],
  [['select', 'id,subject,thread_type,priority,status,last_message_at,created_at,child_id,gardens(name,city)'], ['order', 'last_message_at', { ascending: false, nullsFirst: false }], ['limit', 80]],
  [['select', 'id,garden_id,thread_id,subject,status,priority,read_at,treatment_status,response_required,created_at,sender:sender_id(full_name,role),recipient:recipient_id(full_name,role),gardens(name,city)'], ['order', 'created_at', { ascending: false }], ['limit', 120]],
  [['select', 'id,status,channel,recipient_role,read_at,title,created_at,severity'], ['order', 'created_at', { ascending: false }], ['limit', 120]],
  [['select', 'id,request_type,status,created_at,recipient_role,recipient_label'], ['order', 'created_at', { ascending: false }], ['limit', 80]],
  ...channels.map(() => [['select', 'id,status,provider,created_at'], ['order', 'created_at', { ascending: false }], ['limit', 250]])
];
const success = new Set(['sent', 'sent_mock', 'delivered', 'read', 'opened', 'clicked', 'queued_mock', 'sent_dry_run']);
const failure = new Set(['failed', 'failed_mock', 'failed_dry_run', 'dead_letter', 'bounced', 'rejected', 'delivery_failed']);
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const normalize = value => JSON.parse(JSON.stringify(value));
function nodes(v, predicate) { if (!v || typeof v !== 'object') return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, predicate)); return [...(predicate(v) ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, predicate))]; }
function text(v) { if (v == null || typeof v === 'boolean' || typeof v === 'function') return ''; if (typeof v !== 'object') return String(v); return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children); }
function fixture() {
  return [
    channels.map((channel, i) => ({ id: `P${i}`, channel, provider: `SYNTHETIC_PROVIDER_${i}`, display_name: `SYNTHETIC_PROVIDER_NAME_${i}`, status: ['active', 'configured', 'testing', 'disabled'][i], credentials_configured: false })),
    channels.map((channel, i) => ({ id: `T${i}`, channel, template_kind: `SYNTHETIC_KIND_${i % 2}`, display_name: `SYNTHETIC_TEMPLATE_${i}`, status: i ? 'draft' : 'active', active: i === 0 })),
    channels.map((channel, i) => ({ id: `X${i}`, channel, status: i % 2 ? 'failed' : 'sent_mock' })),
    channels.map((channel, i) => ({ id: `E${i}`, channel, status: i % 2 ? 'delivered' : 'failed' })),
    [{ id: 'TH1', subject: 'SYNTHETIC_THREAD', status: 'open', priority: 'urgent', thread_type: 'general', last_message_at: '2026-11-05T04:00:00Z' }, { id: 'TH2', subject: 'SYNTHETIC_CLOSED', status: 'closed' }],
    [{ id: 'M1', subject: 'SYNTHETIC_MESSAGE_1', status: 'unread', read_at: null, treatment_status: 'open', created_at: '2026-11-05T03:00:00Z' }, { id: 'M2', subject: 'SYNTHETIC_MESSAGE_2', thread_id: 'TH1', status: 'read', read_at: 'SYNTHETIC_READ_TIME', treatment_status: 'handled', created_at: '2026-11-05T02:00:00Z' }, { id: 'M3', subject: 'SYNTHETIC_MESSAGE_3', status: 'pending', response_required: true, created_at: '2026-11-05T01:00:00Z' }],
    [{ id: 'N1', read_at: null }, { id: 'N2', read_at: 'SYNTHETIC_READ_TIME' }],
    [{ id: 'R1', request_type: 'SYNTHETIC_REQUEST', recipient_role: 'SYNTHETIC_ROLE', status: 'pending', created_at: '2026-11-05T00:00:00Z' }],
    ...channels.map((_, i) => [{ id: `L${i}a`, status: 'delivered' }, { id: `L${i}b`, status: 'failed' }])
  ];
}
function providerStatus(rows) {
  if (rows.some(r => r.status === 'active')) return 'active';
  if (rows.some(r => r.status === 'testing')) return 'testing';
  if (rows.some(r => r.status === 'configured' || r.credentials_configured)) return 'configured';
  return rows.length && rows.every(r => r.status === 'disabled') ? 'disabled' : 'not_configured';
}
async function render({ modes = {}, data = fixture(), outer = false, denied = false } = {}) {
  let clients = 0, effects = 0;
  const queries = [], logs = [];
  const no = () => { effects++; throw Error('UNEXPECTED_EFFECT'); };
  const context = { process: new Proxy({}, { get: no }), fetch: no, FormData: no, console: { warn: (...a) => logs.push(a), error: no } };
  const safe = {}; vm.runInNewContext(helper, { ...context, exports: safe, require: no });
  const client = { from(table) {
    const index = sources.indexOf(table); assert.ok(index >= 0); const mode = modes[index] ?? 'healthy', calls = [];
    queries.push({ table, mode, calls });
    if (mode === 'factory') throw Error('PRIVATE_FACTORY');
    const query = {};
    for (const method of ['select', 'order', 'limit']) query[method] = (...args) => { if (mode === 'chain' && method === 'select') throw Error('PRIVATE_CHAIN'); calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => {
      if (mode === 'reject') return Promise.reject(Error('PRIVATE_REJECT')).then(resolve, reject);
      if (mode === 'reject-null') return Promise.reject(null).then(resolve, reject);
      if (mode === 'reject-false') return Promise.reject(false).then(resolve, reject);
      let rows = mode.endsWith('empty') ? [] : mode.endsWith('null') ? null : data[index];
      if (mode === 'error-poison') rows = new Proxy([], { get: no });
      return Promise.resolve({ data: rows, error: mode.startsWith('error-') ? { message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT' } : null }).then(resolve, reject);
    };
    return query;
  } };
  class SafeDate extends Date { constructor(...a) { assert.notEqual(a[0], 'INVALID_DATE'); super(...a); } }
  const exported = {};
  vm.runInNewContext(page, { ...context, Date: SafeDate, exports: exported, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (id === 'next/link') return { __esModule: true, default: 'Link' };
    if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => `Icon:${String(name)}` });
    if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
    if (id === '@/components/admin-communications-test-panel') return { AdminCommunicationsTestPanel: 'OpaqueTestPanel' };
    if (id === '@/components/premium-dashboard') return Object.fromEntries(['ActionCard', 'CleanSection', 'EmptyState', 'PremiumDashboardHero', 'RoleMetricCard', 'StatusBadge'].map(n => [n, n]));
    if (id === '@/components/admin-data-state') return { AdminDataError: 'AdminDataError' };
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + queries.length + logs.length, 0); if (denied) throw Error('DENIED'); } };
    if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
    return no();
  } });
  let tree;
  try { tree = await exported.default(); } catch (error) { assert.ok(denied); assert.equal(error.message, 'DENIED'); }
  assert.equal(effects, 0);
  if (denied) { assert.equal(tree, undefined); assert.equal(clients + queries.length + logs.length, 0); return; }
  assert.equal(clients, 1); assert.equal(queries.length, outer ? 0 : 12);
  for (const query of queries) if (!['factory', 'chain'].includes(query.mode)) assert.deepEqual(normalize(query.calls), chains[sources.indexOf(query.table)]);
  assert.ok(!JSON.stringify(tree).includes('PRIVATE_'));
  const available = sources.map((_, i) => !outer && !String(modes[i] ?? 'healthy').startsWith('error-') && !['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(modes[i]));
  const clean = data.map((rows, i) => available[i] && !['empty', 'null'].includes(modes[i]) ? rows ?? [] : []);
  const stats = channels.map((channel, i) => {
    const rows = [...clean[8 + i], ...clean[2].filter(r => r.channel === channel), ...clean[3].filter(r => r.channel === channel)];
    return { total: rows.length, failures: rows.filter(r => failure.has(r.status)).length, successes: rows.filter(r => success.has(r.status)).length };
  });
  const statKnown = channels.map((_, i) => available[8 + i] && available[2] && available[3]);
  const deliveriesKnown = statKnown.every(Boolean);
  const failures = stats.reduce((n, s) => n + s.failures, 0) + clean[3].filter(r => failure.has(r.status)).length;
  const total = stats.reduce((n, s) => n + s.total, 0) + clean[3].length;
  const active = clean[4].filter(r => !['closed', 'resolved', 'archived'].includes(String(r.status)));
  const fallback = clean[5].filter(r => !r.thread_id).slice(0, 20);
  const pending = clean[5].filter(r => ['unread', 'pending', 'open'].includes(String(r.status)) || r.response_required || r.treatment_status === 'open');
  const unread = clean[5].filter(r => !r.read_at || r.status === 'unread').length + clean[6].filter(r => !r.read_at).length;
  const readyChannels = channels.filter(channel => ['active', 'configured', 'testing'].includes(providerStatus(clean[0].filter(r => r.channel === channel)))).length;
  const responseRate = clean[5].length ? Math.round(clean[5].filter(r => ['handled', 'closed', 'resolved'].includes(String(r.treatment_status))).length / clean[5].length * 100) : 100;
  const readyTemplates = clean[1].filter(r => r.active || r.status === 'active' || r.status === 'configured').length;
  const conversationKnown = available[4] && available[5], inboxKnown = conversationKnown && available[7];
  const expected = [active.length + fallback.length, pending.length, unread, failures, `${readyChannels}/4`, `${responseRate}%`];
  const metricKnown = [conversationKnown, available[5], available[5] && available[6], deliveriesKnown, available[0], available[5]];
  const metrics = nodes(tree, n => n.type === 'RoleMetricCard'); assert.equal(metrics.length, 6);
  metrics.forEach((n, i) => { assert.equal(n.props.value, metricKnown[i] ? expected[i] : 'לא זמין'); if (!metricKnown[i]) assert.notEqual(n.props.tone, 'good'); });
  const hero = nodes(tree, n => n.type === 'PremiumDashboardHero')[0];
  assert.equal(hero.props.badge, conversationKnown ? `${expected[0]} שיחות` : 'לא זמין'); assert.equal(hero.props.badgeTone, !deliveriesKnown || failures ? 'warn' : 'good');
  const cards = nodes(tree, n => n.type === 'article' && n.props.className === 'communication-channel-card'); assert.equal(cards.length, 4);
  cards.forEach((card, i) => {
    assert.equal(card.key, channels[i]);
    const providerRows = clean[0].filter(r => r.channel === channels[i]), templateRows = clean[1].filter(r => r.channel === channels[i]);
    assert.equal(text(nodes(card, n => n.type === 'p')[0]), `${available[0] ? providerRows.length : 'לא זמין'} ספקים · ${available[1] ? templateRows.length : 'לא זמין'} תבניות`);
    const badge = nodes(card, n => n.type === 'StatusBadge')[0]; if (!available[0]) { assert.equal(text(badge), 'לא זמין'); assert.notEqual(badge.props.tone, 'good'); }
    const counts = nodes(card, n => n.type === 'div' && n.props.className === 'communication-stats-row')[0];
    const spans = nodes(counts, n => n.type === 'span'); const rate = stats[i].total ? Math.round(stats[i].successes / stats[i].total * 100) : 100;
    assert.equal(text(spans[0]).trim(), statKnown[i] ? `${rate}% הצלחה` : 'לא זמין'); assert.equal(text(spans[1]).trim(), statKnown[i] ? `${stats[i].failures} כשלים` : 'לא זמין');
  });
  const analytics = nodes(tree, n => n.type === 'div' && n.props.className === 'communication-analytics-grid')[0];
  const analyticsKnown = [deliveriesKnown, deliveriesKnown, available[1], available[5], available[2], available[0]];
  const analyticsExpected = [String(total), String(failures), String(readyTemplates), `${responseRate}%`, String(clean[2].length), `${readyChannels}/4`];
  nodes(analytics, n => n.type === 'b').forEach((n, i) => assert.equal(text(n), analyticsKnown[i] ? analyticsExpected[i] : 'לא זמין'));
  const inbox = nodes(tree, n => n.type === 'CleanSection' && n.props.title === 'תיבת תקשורת אחודה')[0];
  const expectedInbox = [...active.map(r => ({ id: r.id, time: r.last_message_at ?? r.created_at, href: '/dashboard/admin/communication' })), ...fallback.map(r => ({ id: r.id, time: r.created_at, href: '/dashboard/admin/communication' })), ...clean[7].slice(0, 12).map(r => ({ id: r.id, time: r.created_at, href: '/dashboard/admin/complaints' }))].sort((a, b) => new Date(b.time ?? 0).getTime() - new Date(a.time ?? 0).getTime()).slice(0, 14);
  assert.deepEqual(nodes(inbox, n => n.type === 'Link').map(n => n.key), expectedInbox.map(r => `${r.href}-${r.id}`));
  assert.equal(text(inbox).includes('תיבת התקשורת חלקית'), !inboxKnown);
  assert.equal(nodes(inbox, n => n.type === 'EmptyState' && n.props.title === 'אין שיחות פעילות').length, inboxKnown && !expectedInbox.length ? 1 : 0);
  if (!available[4]) assert.ok(!JSON.stringify(inbox).includes('SYNTHETIC_THREAD'));
  if (!available[5]) assert.ok(!JSON.stringify(inbox).includes('SYNTHETIC_MESSAGE_'));
  if (!available[7]) assert.ok(!JSON.stringify(inbox).includes('SYNTHETIC_REQUEST'));
  const templateSection = nodes(tree, n => n.type === 'CleanSection' && n.props.title === 'תבניות תקשורת')[0];
  assert.deepEqual(nodes(templateSection, n => n.type === 'article').map(n => n.key), clean[1].slice(0, 14).map(r => r.id));
  assert.equal(nodes(templateSection, n => n.type === 'EmptyState' && n.props.title === 'אין תבניות עדיין').length, available[1] && !clean[1].length ? 1 : 0);
  const panels = nodes(tree, n => n.type === 'OpaqueTestPanel'); assert.equal(panels.length, available[0] && available[1] ? 1 : 0);
  if (panels.length) {
    assert.deepEqual(normalize(panels[0].props.providers), normalize(clean[0].map(r => ({ channel: r.channel, provider: r.provider, display_name: r.display_name, status: r.status }))));
    const kinds = [...new Set(clean[1].map(r => r.template_kind))].sort();
    assert.deepEqual(normalize(panels[0].props.templates), kinds.length ? kinds : ['onboarding', 'inspection_notice', 'compliance_alert', 'document_reminder', 'payment_reminder', 'safety_notification']);
  }
  assert.equal(nodes(tree, n => n.type === 'ActionCard').length, 6);
  assert.equal(Boolean(nodes(tree, n => n.type === 'AdminDataError')[0].props.message), available.some(v => !v));
  return { tree, metrics, analytics, cards, inbox };
}
const cases = [];
const add = (id, body) => cases.push({ id, body });
for (let source = 0; source < 12; source++) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) add(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
for (const mode of ['healthy', 'empty', 'null']) add(`all-known-${mode}`, () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, mode])) }));
add('outer-loader-failure', () => render({ outer: true })); add('denied-zero-effects', () => render({ denied: true }));
add('all-sources-unavailable', () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, 'error-stale'])) }));
for (let i = 0; i < 12; i++) add(`paired-${i}-${(i + 5) % 12}`, () => render({ modes: { [i]: 'error-stale', [(i + 5) % 12]: 'reject-false' } }));
for (const source of [4, 5, 7]) add(`failed-inbox-date-${source}`, () => { const data = fixture(); data[source][0].created_at = 'INVALID_DATE'; if (source === 4) data[source][0].last_message_at = 'INVALID_DATE'; return render({ data, modes: { [source]: 'error-stale' } }); });
add('partial-inbox-no-false-empty', () => render({ modes: { 4: 'error-null', 5: 'empty', 7: 'empty' } }));
add('healthy-empty-messages-response-100', () => render({ modes: { 5: 'empty' } }));
add('known-nullish-provider-and-template-labels', () => { const data = fixture(); data[0][0].status = null; data[0][0].credentials_configured = true; data[1][0].display_name = ''; data[1][0].status = null; return render({ data }); });
add('existing-double-event-aggregate-preserved', async () => { const data = fixture().map(() => []); data[3] = [{ id: 'E', channel: 'email', status: 'failed' }]; const r = await render({ data }); assert.equal(r.metrics[3].props.value, 2); });
add('existing-caps-and-raw-native-log-size', () => { const data = fixture(); data[5] = Array.from({ length: 25 }, (_, i) => ({ ...data[5][0], id: `M${i}`, created_at: null })); data[7] = Array.from({ length: 15 }, (_, i) => ({ ...data[7][0], id: `R${i}`, created_at: null })); data[1] = Array.from({ length: 16 }, (_, i) => ({ ...data[1][0], id: `T${i}` })); data[8] = Array.from({ length: 251 }, (_, i) => ({ id: `W${i}`, status: i % 2 ? 'failed' : 'sent' })); return render({ data }); });
add('one-portable-domain-hook', () => { const config = JSON.parse(read('config/digital-observer-ci-gates.json')); assert.deepEqual(config.domain.filter(x => x.name === 'admin-communications-query-boundary'), [{ name: 'admin-communications-query-boundary', args: ['--test', 'scripts/qa/check-admin-communications-query-boundary.mjs'] }]); });
assert.equal(new Set(cases.map(x => x.id)).size, cases.length);
console.log(`CASE_REGISTRY ${JSON.stringify(cases.map(x => x.id))}`);
for (const entry of cases) test(entry.id, entry.body);
