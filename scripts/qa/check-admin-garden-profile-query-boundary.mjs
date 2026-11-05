import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Actual page/helper/label, disconnected readonly JSX. Synthetic metadata only.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/gardens/[id]/page.tsx', import.meta.url));
function compile(value) {
  const result = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal(result.diagnostics.length, 0); return result.outputText;
}
const pageCode = compile(source), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url))), labelCode = compile(read(new URL('../../lib/domain/display-label.ts', import.meta.url)));
const jsx = (type, props, key) => ({type, props: props ?? {}, key});
const plain = value => JSON.parse(JSON.stringify(value));
function nodes(value, type) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(item => nodes(item, type));
  return [...(value.type === type ? [value] : []), ...Object.values(value.props ?? {}).flatMap(item => nodes(item, type))];
}
function text(value) {
  if (value == null || typeof value === 'boolean' || typeof value === 'function') return '';
  if (typeof value !== 'object') return String(value);
  return Array.isArray(value) ? value.map(text).join('') : text(value.props?.children);
}
const tables = ['gardens', 'children', 'parents', 'staff', 'complaints', 'documents', 'inspections', 'kindergarten_subscriptions', 'audit_logs'];
const routeId = 'SYNTHETIC_ROUTE';
const garden = overrides => ({id: routeId, name: '[demo] QA Garden A', city: 'SYNTHETIC_CITY', address: 'SYNTHETIC_ADDRESS', status: 'active', final_approval_status: 'approved', approval_flow_status: 'pending', owner: {full_name: 'SYNTHETIC_OWNER'}, manager: {full_name: 'SYNTHETIC_MANAGER'}, inspector: {full_name: 'SYNTHETIC_INSPECTOR'}, ...overrides});
function fixture() {
  return {
    gardens: {data: garden()}, children: {data: null, count: 5}, parents: {data: null, count: 7},
    staff: {data: [{approved_to_work: true}, {approved_to_work: false}], count: 997},
    complaints: {data: [{status: 'closed'}, {status: 'open'}]}, documents: {data: []},
    inspections: {data: [{status: 'completed', completed_at: '2026-01-03T12:00:00Z', weighted_score: 0, violation_count: 0}, {status: 'pending'}]},
    kindergarten_subscriptions: {data: {status: 'active', billing_status: 'verified'}},
    audit_logs: {data: [{id: 'SYNTHETIC_AUDIT', action: 'SYNTHETIC_ACTION', actor_role: 'SYNTHETIC_ACTOR', created_at: '2026-01-02T12:00:00Z'}]}
  };
}
const selects = [
  'id,name,city,address,status,safe_status,approval_flow_status,final_approval_status,owner_name,manager_id,owner_profile_id,inspector_id,children_capacity,current_children_count,staff_count,public_profile_enabled,created_at,manager:manager_id(full_name),owner:owner_profile_id(full_name),inspector:inspector_id(full_name)',
  'id', 'id', 'id,approved_to_work', 'id,status,severity', 'id,status,document_type', 'id,status,weighted_score,completed_at,violation_count', 'id,status,billing_status,current_period_end,subscription_plans(name)', 'id,action,actor_role,entity_type,created_at'
];
function expectedChain(table) {
  const i = tables.indexOf(table), calls = [['from', table], ['select', selects[i], ...([1, 2].includes(i) ? [{count: 'exact', head: true}] : i === 3 ? [{count: 'exact'}] : [])], ['eq', i === 0 ? 'id' : i === 8 ? 'entity_id' : 'garden_id', routeId]];
  if (i >= 6) calls.push(['order', 'created_at', {ascending: false}]);
  if (i >= 3) calls.push(['limit', i <= 5 ? 500 : i === 7 ? 1 : 8]);
  if (i === 0 || i === 7) calls.push(['maybeSingle']);
  return calls;
}
const known = mode => !mode || ['empty', 'null'].includes(mode);
const label = value => ({active: 'פעיל', approved: 'מאושר', pending: 'ממתין', preliminary: 'מקדים', suspended: 'מושהה', blocked: 'חסום', verified: 'מאומת', rejected: 'נדחה', expired: 'פג תוקף', replacement_required: 'נדרשת החלפה', healthy: 'תקין', degraded: 'מוגבל', unavailable: 'לא זמין', manual: 'ידני', payment_failed: 'כשל תשלום'}[String(value ?? '')] ?? 'דורש בדיקה');
async function render({modes = {}, rows = {}, deniedRole = false, clientThrows = false} = {}) {
  const data = {...fixture(), ...rows}, logs = [], calls = new Map(), profile = {full_name: 'SYNTHETIC_ADMIN'};
  let clients = 0, admissions = 0, parameterReads = 0, effects = 0;
  const denied = () => { effects++; throw Error('UNEXPECTED_EFFECT_OR_STALE_DATE'); };
  class ReadonlyDate extends Date { constructor(...args) { if (args[0] === 'INVALID_DATE') denied(); super(...args); } }
  function load(code, require) {
    const exports = {};
    vm.runInNewContext(code, {exports, require, process: {env: {}}, fetch: denied, FormData: denied, Date: ReadonlyDate, console: {warn: (...args) => logs.push(args)}}); return exports;
  }
  const helper = load(helperCode, denied), labels = load(labelCode, denied);
  const client = {from(table) {
    assert.ok(tables.includes(table)); assert.ok(!calls.has(table));
    const chain = [['from', table]], mode = modes[table]; calls.set(table, chain);
    if (mode === 'factory') throw Error('PRIVATE_FACTORY');
    const query = {};
    for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle']) query[method] = (...args) => { chain.push([method, ...args]); if (mode === 'chain') throw Error('PRIVATE_CHAIN'); return query; };
    query.then = (resolve, reject) => {
      const reply = {data: mode?.endsWith('empty') || mode === 'empty' ? [] : mode?.endsWith('null') || mode === 'null' ? null : data[table].data, count: mode?.startsWith('error') ? 9999 : data[table].count, error: mode?.startsWith('error') ? {message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS'} : null};
      return (mode === 'reject' ? Promise.reject(Error('PRIVATE_REJECTION')) : mode === 'reject-null' ? Promise.reject(null) : Promise.resolve(reply)).then(resolve, reject);
    };
    return query;
  }};
  const designNames = ['DashboardGrid', 'EmptyState', 'MetricCard', 'PremiumCard', 'SectionHeader', 'StatusChip'];
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx, Fragment: 'Fragment'};
    if (id === 'next/link') return {__esModule: true, default: 'Link'};
    if (id === 'lucide-react') return Object.fromEntries(['Activity', 'Building2', 'ClipboardCheck', 'FileText', 'MessageSquareWarning', 'ShieldCheck', 'UsersRound', 'WalletCards'].map(name => [name, name]));
    if (id === '@/components/admin-app-ui') return {AdminAppFrame: 'AdminAppFrame'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/components/gan-batuach-design-system') return Object.fromEntries(designNames.map(name => [name, name]));
    if (id === '@/components/platform-admin-ui') return {AdminSectionIntro: 'AdminSectionIntro', AdminTruthState: 'AdminTruthState'};
    if (id === '@/lib/admin-safe') return helper;
    if (id === '@/lib/domain/display-label') return labels;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(parameterReads, 0); assert.equal(clients, 0); admissions++; if (deniedRole) throw Error('DENIED'); return {profile}; }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (clientThrows) throw Error('PRIVATE_CLIENT'); return client; }};
    return denied();
  });
  const params = {then(resolve) { parameterReads++; assert.equal(admissions, 1); resolve({id: routeId}); }};
  if (deniedRole) { await assert.rejects(page.default({params}), /DENIED/); assert.equal(parameterReads, 0); assert.equal(clients, 0); assert.equal(calls.size, 0); assert.equal(effects, 0); assert.deepEqual(logs, []); return null; }
  const tree = await page.default({params}), frame = nodes(tree, 'AdminAppFrame')[0], metrics = nodes(tree, 'MetricCard'), states = nodes(tree, 'AdminTruthState'), empty = nodes(tree, 'EmptyState'), intro = nodes(tree, 'AdminSectionIntro')[0];
  assert.equal(clients, 1); assert.equal(parameterReads, 1); assert.equal(frame.props.profile, profile); assert.equal(frame.props.activeHref, '/dashboard/admin/kindergartens'); assert.equal(frame.props.backHref, '/dashboard/admin/kindergartens'); assert.equal(frame.props.title, 'פרטי גן');
  assert.equal(calls.size, clientThrows ? 0 : 9);
  if (!clientThrows) for (const table of tables) { const all = expectedChain(table), mode = modes[table]; assert.deepEqual(plain(calls.get(table)), mode === 'factory' ? all.slice(0, 1) : mode === 'chain' ? all.slice(0, 2) : all); }
  const errors = clientThrows ? [] : tables.filter(table => !known(modes[table]));
  assert.equal(logs.length, clientThrows ? 1 : errors.length);
  if (clientThrows) assert.deepEqual(plain(logs[0]), ['Admin page data unavailable:', 'admin garden detail']);
  else assert.deepEqual(logs.map(item => plain(item)), errors.map(table => ['Admin Supabase query unavailable:', `admin garden detail ${tables.indexOf(table)}`]));
  assert.ok(!JSON.stringify(tree).includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  const isKnown = table => !clientThrows && known(modes[table]);
  const effective = table => modes[table] === 'null' ? null : modes[table] === 'empty' ? [] : data[table].data;
  const g = effective('gardens');
  if (!isKnown('gardens')) {
    assert.equal(empty[0].props.title, 'נתוני הגן אינם זמינים'); assert.equal(frame.props.subtitle, 'נתוני הגן אינם זמינים כרגע.'); assert.equal(metrics.length, 0); assert.equal(states.length, 0); assert.equal(intro, undefined); assert.equal(nodes(tree, 'Link').length, 0); assert.ok(nodes(tree, 'AdminDataError')[0].props.message); assert.ok(!JSON.stringify(tree).includes('SYNTHETIC_OWNER'));
  } else if (!g) {
    assert.equal(frame.props.subtitle, 'הגן המבוקש אינו זמין.'); assert.equal(empty[0].props.title, 'הגן לא נמצא'); assert.equal(empty[0].props.text, 'ייתכן שהוסר, הועבר או שאינו זמין להרשאתך.'); assert.equal(metrics.length, 0); assert.equal(nodes(tree, 'AdminDataError').length, 0);
  } else {
    assert.equal(intro.props.title, labels.cleanSyntheticLabel(g.name, 'גן')); assert.equal(intro.props.eyebrow, 'GARDEN DETAIL'); assert.ok(intro.props.text.startsWith(`${g.city ?? 'עיר לא צוינה'} · ${g.address ?? 'כתובת לא הוזנה'}.`));
    assert.equal(nodes(intro.props.actions, 'Link')[0].props.href, `/dashboard/admin/kindergarten-applications?garden=${routeId}`); assert.equal(frame.props.badge, label(g.status));
    assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), errors.length > 0);
    const metric = name => metrics.find(item => item.props.label === name).props;
    const truth = name => states.find(item => item.props.title === name)?.props;
    assert.equal(metrics.length, 4);
    const staff = effective('staff') ?? [], docs = effective('documents') ?? [], complaints = effective('complaints') ?? [];
    const linked = metric('משתמשים מקושרים'), staffMetric = metric('צוות מאושר'), documentMetric = metric('פעולות מסמך'), complaintMetric = metric('תלונות פתוחות');
    const linkedKnown = ['children', 'parents', 'staff'].every(isKnown);
    assert.equal(linked.value, linkedKnown ? (data.children.count ?? 0) + (data.parents.count ?? 0) + staff.length : 'לא זמין'); assert.equal(linked.tone, linkedKnown ? 'primary' : 'muted');
    const approved = staff.filter(item => Boolean(item.approved_to_work)).length;
    assert.equal(staffMetric.value, isKnown('staff') ? `${approved}/${staff.length}` : 'לא זמין'); assert.equal(staffMetric.tone, !isKnown('staff') ? 'muted' : approved === staff.length ? 'success' : 'warning');
    const docActions = docs.filter(item => ['missing', 'rejected', 'expired', 'replacement_required'].includes(String(item.status))).length;
    const open = complaints.filter(item => !['closed', 'resolved', 'dismissed'].includes(String(item.status))).length;
    for (const [table, metricProps, count] of [['documents', documentMetric, docActions], ['complaints', complaintMetric, open]]) { assert.equal(metricProps.value, isKnown(table) ? count : 'לא זמין'); assert.equal(metricProps.tone, !isKnown(table) ? 'muted' : count ? 'warning' : 'success'); }
    assert.equal(truth('בעלות').text, g.owner?.full_name ?? g.owner_name ?? 'טרם שויכה'); assert.equal(truth('מנהלת').text, g.manager?.full_name ?? 'טרם שויכה'); assert.equal(truth('מפקח').text, g.inspector?.full_name ?? 'טרם שויך');
    const service = truth('מצב שירות'), serviceKnown = g.status !== 'active' || isKnown('documents');
    const expectedTone = !serviceKnown ? 'neutral' : g.status === 'active' && !docActions ? 'good' : g.status === 'suspended' ? 'danger' : 'warning';
    assert.equal(service.tone, expectedTone); assert.equal(service.text, !serviceKnown ? 'לא ניתן לקבוע את מצב השירות כרגע.' : expectedTone === 'good' ? 'השירותים התפעוליים נראים תקינים לפי הנתונים הזמינים.' : 'נדרשת בדיקה; אין הצגת מצב ירוק ללא מקור מאומת.');
    const subscription = truth('מנוי פלטפורמה'), sub = effective('kindergarten_subscriptions');
    assert.equal(subscription.text, isKnown('kindergarten_subscriptions') ? `${label(sub?.status)} · חיוב ${label(sub?.billing_status)}` : 'נתוני המנוי אינם זמינים'); assert.equal(subscription.tone, !isKnown('kindergarten_subscriptions') ? 'neutral' : ['active', 'approved', 'verified', 'healthy', 'done', 'completed'].includes(String(sub?.status)) ? 'good' : 'warning'); assert.equal(nodes(subscription.action, 'Link')[0].props.href, '/dashboard/admin/subscriptions');
    const inspections = effective('inspections') ?? [], latest = inspections[0];
    if (!isKnown('inspections')) { assert.equal(truth('נתוני הביקורות אינם זמינים').tone, 'neutral'); assert.equal(truth('ביקורת אחרונה'), undefined); assert.ok(!empty.some(item => item.props.title === 'אין ביקורות להצגה')); assert.ok(!text(tree).includes('היסטוריה:')); }
    else if (!latest) { assert.equal(empty.find(item => item.props.title === 'אין ביקורות להצגה').props.text, 'ביקורת שתוגש תופיע כאן ללא שינוי הציון ההיסטורי.'); }
    else { const inspection = truth('ביקורת אחרונה'); assert.equal(inspection.text, `${latest.completed_at ? new Date(latest.completed_at).toLocaleDateString('he-IL') : label(latest.status)} · ${latest.violation_count ?? 0} ממצאים`); assert.equal(inspection.tone, ['completed', 'done'].includes(latest.status) ? 'good' : 'warning'); assert.ok(text(tree).includes(`ציון שרת: ${latest.weighted_score ?? 'לא זמין'}`)); assert.ok(text(tree).includes(`היסטוריה: ${inspections.length} ביקורות`)); }
    const audit = effective('audit_logs') ?? [], auditCards = nodes(tree, 'article');
    if (!isKnown('audit_logs')) { assert.equal(truth('נתוני הפעילות אינם זמינים').tone, 'neutral'); assert.equal(auditCards.length, 0); assert.ok(!empty.some(item => item.props.title === 'אין פעילות אדמין אחרונה')); }
    else if (!audit.length) assert.equal(empty.find(item => item.props.title === 'אין פעילות אדמין אחרונה').props.text, 'אישור, שינוי שיוך או שינוי מנוי יופיעו כאן לאחר רישום canonical audit.');
    else { assert.equal(auditCards.length, audit.length); for (const [i, item] of audit.entries()) { assert.equal(auditCards[i].key, item.id); assert.equal(text(nodes(auditCards[i], 'h3')[0]), item.action ?? ''); assert.equal(text(nodes(auditCards[i], 'p')[0]), `${item.actor_role ?? 'system'} · ${item.created_at ? new Date(item.created_at).toLocaleString('he-IL') : 'זמן לא זמין'}`); } }
  }
  assert.equal(effects, 0); return {tree, frame, metrics, states, empty};
}
test('healthy full profile exact nine queries and readonly metadata', () => render());
test('role denial precedes params, helper, client and all views', () => render({deniedRole: true}));
test('client failure makes all sources unavailable, not missing primary', () => render({clientThrows: true}));
for (const table of tables) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'factory', 'chain']) test(`${table}: ${mode} isolated source boundary`, () => render({modes: {[table]: mode}}));
for (const table of tables) test(`${table}: null rejection remains unavailable`, () => render({modes: {[table]: 'reject-null'}}));
for (const table of tables.slice(1)) test(`${table}: healthy null keeps original legitimate fallback`, () => render({modes: {[table]: 'null'}, rows: {[table]: {data: null, count: null}}}));
test('healthy primary null retains original missing state', () => render({rows: {gardens: {data: null}}}));
test('healthy primary null plus rejected neighbor still original missing state', () => render({rows: {gardens: {data: null}}, modes: {documents: 'reject'}}));
test('all neighbors healthy empty retain original zero and empty states', () => render({rows: {children: {data: null, count: null}, parents: {data: null, count: null}, staff: {data: null, count: 999}, complaints: {data: []}, documents: {data: []}, inspections: {data: []}, kindergarten_subscriptions: {data: null}, audit_logs: {data: []}}}));
for (const [a, b] of [['children', 'parents'], ['staff', 'documents'], ['complaints', 'inspections'], ['kindergarten_subscriptions', 'audit_logs'], ['documents', 'audit_logs']]) test(`paired ${a}/${b} preserve healthy independent neighbors`, () => render({modes: {[a]: 'error-stale', [b]: 'reject'}}));
for (const status of ['active', 'suspended', 'pending', 'blocked', null]) test(`service precedence ${String(status)} plus unknown documents`, () => render({rows: {gardens: {data: garden({status})}}, modes: {documents: 'error-stale'}}));
test('active with known empty documents remains good despite all unrelated failures', () => render({modes: Object.fromEntries(tables.filter(t => !['gardens', 'documents'].includes(t)).map(t => [t, 'error-stale']))}));
test('staff uses original truthiness and bounded array not count', () => render({rows: {staff: {data: [{approved_to_work: true}, {approved_to_work: 1}, {approved_to_work: 'yes'}, {approved_to_work: false}, {approved_to_work: null}, {}], count: 9999}}}));
for (const count of [null, 0, 1, 31]) test(`head-count ${String(count)} remains independent of data arrays`, () => render({rows: {children: {data: [{id: 'NOT_A_COUNT'}], count}, parents: {data: null, count}}}));
test('document and complaint status predicates retain exact case sensitivity', () => render({rows: {documents: {data: ['missing', 'rejected', 'expired', 'replacement_required', 'verified', 'MISSING', null].map(status => ({status}))}, complaints: {data: ['closed', 'resolved', 'dismissed', 'CLOSED', 'open', null].map(status => ({status}))}}}));
for (const value of [undefined, null, '', 'SYNTHETIC_NAME']) test(`primary nullish identity fields ${String(value)}`, () => render({rows: {gardens: {data: garden({name: value, city: value, address: value, owner: {full_name: value}, owner_name: 'SYNTHETIC_FALLBACK', manager: {full_name: value}, inspector: {full_name: value}})}}}));
for (const value of [null, undefined]) test(`primary missing relations ${String(value)}`, () => render({rows: {gardens: {data: garden({owner: value, owner_name: null, manager: value, inspector: value})}}}));
for (const status of ['done', 'completed', 'pending', null]) test(`inspection latest date/status/zero/nullish contract ${String(status)}`, () => render({rows: {inspections: {data: [{status, completed_at: null, violation_count: null, weighted_score: 0}]}}}));
test('failed stale invalid inspection date never formatted', () => render({modes: {inspections: 'error-stale'}, rows: {inspections: {data: [{completed_at: 'INVALID_DATE', status: 'completed'}]}}}));
test('failed stale invalid audit date never formatted', () => render({modes: {audit_logs: 'error-stale'}, rows: {audit_logs: {data: [{id: 'SYNTHETIC_STALE', action: 'SYNTHETIC_STALE_ACTION', created_at: 'INVALID_DATE'}]}}}));
test('audit raw duplicate keys/order/nullish actor/time preserved', () => render({rows: {audit_logs: {data: [{id: 'SYNTHETIC_DUP', action: 'SECOND', actor_role: null, created_at: null}, {id: 'SYNTHETIC_DUP', action: 'FIRST', actor_role: '', created_at: null}]}}}));
test('portable one-hook registration and per-source thunk boundaries', () => {
  assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await params')); assert.equal((source.match(/readSource\(\(\) => supabase\.from\(/g) ?? []).length, 9);
  const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url)));
  assert.deepEqual(config.domain.filter(item => item.name === 'admin-garden-profile-query-boundary'), [{name: 'admin-garden-profile-query-boundary', args: ['--test', 'scripts/qa/check-admin-garden-profile-query-boundary.mjs']}]);
});
