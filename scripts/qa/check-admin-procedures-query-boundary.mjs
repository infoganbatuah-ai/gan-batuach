import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Actual disconnected server page/client render only. Never invoke handlers.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const pageSource = read(new URL('../../app/dashboard/admin/procedures/page.tsx', import.meta.url));
const managerSource = read(new URL('../../components/procedures-manager.tsx', import.meta.url));
const compile = source => {
  const r = ts.transpileModule(source, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal(r.diagnostics.length, 0); return r.outputText;
};
const pageCode = compile(pageSource), managerCode = compile(managerSource), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url)));
const plain = value => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({type, props: props ?? {}, key});
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
const sources = [
  {table: 'mandatory_procedures', field: 'procedures', flag: 'proceduresAvailable'},
  {table: 'gardens', field: 'gardens', flag: 'gardensAvailable'},
  {table: 'procedure_acknowledgements', field: 'acknowledgements', flag: 'acknowledgementsAvailable'},
  {table: 'audit_logs', field: 'auditLogs', flag: 'auditLogsAvailable'},
];
const procedure = overrides => ({id: 'SYNTHETIC_PROCEDURE_ID', title: 'SYNTHETIC_PROCEDURE_TITLE', body: 'SYNTHETIC_PROCEDURE_BODY', procedure_type: 'בטיחות', active: true, requires_acknowledgement: true, required_for_framework: 'SYNTHETIC_GARDEN_ID', ...overrides});
const garden = overrides => ({id: 'SYNTHETIC_GARDEN_ID', name: 'SYNTHETIC_GARDEN_NAME', city: 'SYNTHETIC_CITY', ...overrides});
const ack = overrides => ({procedure_id: 'SYNTHETIC_PROCEDURE_ID', acknowledged_at: '2026-11-05T00:00:00Z', acknowledged_by: 'SYNTHETIC_USER_ID', gardens: {name: 'SYNTHETIC_ACK_GARDEN'}, profiles: {full_name: 'SYNTHETIC_ACK_USER'}, ...overrides});
const audit = overrides => ({action: 'SYNTHETIC_AUDIT_ACTION', created_at: '2026-11-05T00:00:00Z', after_data: {marker: 'UNUSED_AUDIT_PAYLOAD'}, ...overrides});
const fixtures = () => ({procedures: [procedure()], gardens: [garden()], acknowledgements: [ack()], auditLogs: [audit()]});
function load(code, require, warn, denied) {
  const exports = {};
  vm.runInNewContext(code, {exports, require, process: {env: {}}, fetch: denied, FormData: denied, console: {warn}}); return exports;
}
function manager(props, retained = {}) {
  let effects = 0, hooks = 0, memo;
  const denied = () => { effects++; throw Error('UNEXPECTED_SIDE_EFFECT'); };
  const api = load(managerCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === 'react') return {useState: initial => {
      const key = ['items', 'editing', 'message', 'error'][hooks++]; assert.ok(key);
      return [Object.hasOwn(retained, key) ? retained[key] : initial, denied];
    }, useMemo: (fn, deps) => { assert.equal(deps[0], props.acknowledgements); memo = fn(); return memo; }};
    return denied();
  }, denied, denied);
  const tree = api.ProceduresManager(props); assert.equal(hooks, 4); assert.equal(effects, 0);
  const formAvailable = props.proceduresAvailable !== false && props.gardensAvailable !== false;
  const form = nodes(tree, 'form')[0], rows = nodes(tree, 'article').filter(node => node.props.className === 'card procedure-card');
  const ackRows = nodes(tree, 'div').filter(node => node.props.className === 'list-item');
  const auditRows = nodes(tree, 'div').filter(node => node.props.className === 'document-chip');
  if (formAvailable) {
    assert.ok(form); assert.equal(form.props.className, 'card form wizard-form'); assert.equal(form.props.onSubmit.name, 'submit');
    assert.equal(typeof form.props.onSubmit, 'function');
    assert.equal(nodes(form, 'input').find(node => node.props.name === 'title').props.required, true);
    assert.equal(nodes(form, 'textarea')[0].props.required, true); assert.equal(nodes(form, 'textarea')[0].props.rows, 6);
  } else { assert.equal(form, undefined); assert.equal(nodes(tree, 'input').length, 0); assert.ok(text(tree).includes('יצירה ועריכה אינן זמינות')); }
  if (props.proceduresAvailable === false) { assert.equal(rows.length, 0); assert.ok(text(tree).includes('נתוני הנהלים אינם זמינים')); assert.ok(!text(tree).includes('אין נהלים עדיין')); }
  if (props.acknowledgementsAvailable === false) {
    assert.equal(ackRows.length, 0); assert.ok(text(tree).includes('נתוני אישורי הקריאה אינם זמינים')); assert.ok(!text(tree).includes('אין אישורי קריאה עדיין'));
    for (const row of rows) { assert.ok(text(row).includes('נצפה/הושלם: לא זמין')); assert.ok(!text(row).includes('נצפה/הושלם: טרם')); assert.ok(!text(row).includes('נצפה/הושלם: כן')); }
  }
  if (props.auditLogsAvailable === false) { assert.equal(auditRows.length, 0); assert.ok(text(tree).includes('נתוני לוג הביקורת אינם זמינים')); assert.ok(!text(tree).includes('אין פעולות נוהל בלוג')); }
  for (const row of rows) { const button = nodes(row, 'button')[0]; assert.equal(button.props.disabled, !formAvailable); assert.equal(typeof button.props.onClick, 'function'); }
  assert.equal(effects, 0); return {tree, form, rows, ackRows, auditRows, memo, effects};
}
const failed = mode => mode.startsWith('error-') || ['query-reject', 'factory-throws', 'chain-throws'].includes(mode);
const expected = table => {
  if (table === 'mandatory_procedures') return [['from', table], ['select', '*'], ['order', 'created_at', {ascending: false}]];
  if (table === 'gardens') return [['from', table], ['select', 'id, name, city, manager_id'], ['order', 'name']];
  if (table === 'procedure_acknowledgements') return [['from', table], ['select', 'procedure_id, acknowledged_at, acknowledged_by'], ['order', 'acknowledged_at', {ascending: false}], ['limit', 20]];
  return [['from', table], ['select', 'action, created_at, after_data'], ['eq', 'entity_type', 'mandatory_procedures'], ['order', 'created_at', {ascending: false}], ['limit', 20]];
};
async function render(modes = {}, supplied = {}, outer = 'healthy') {
  let admissions = 0, clients = 0, effects = 0;
  const denied = () => { effects++; throw Error('UNEXPECTED_SIDE_EFFECT'); };
  const calls = Object.fromEntries(sources.map(s => [s.table, []])), logs = [];
  const warn = (...args) => logs.push(args), safe = load(helperCode, denied, warn, denied);
  const defaultRows = fixtures();
  const client = {from(table) {
    assert.ok(table in calls); const spec = sources.find(s => s.table === table), mode = modes[table] ?? 'healthy'; calls[table].push(['from', table]);
    if (mode === 'factory-throws') throw Error('PRIVATE_FACTORY');
    const q = {};
    for (const method of ['select', 'order', 'limit', 'eq']) q[method] = (...args) => { calls[table].push([method, ...args]); if (mode === 'chain-throws') throw Error('PRIVATE_CHAIN'); return q; };
    q.then = (resolve, reject) => (mode === 'query-reject' ? Promise.reject(Error('PRIVATE_QUERY')) : Promise.resolve({
      data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : supplied[spec.field] ?? defaultRows[spec.field],
      error: mode.startsWith('error-') ? {message: 'PRIVATE_ERROR', details: 'PRIVATE_DETAILS'} : null,
    })).then(resolve, reject); return q;
  }};
  const api = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === 'lucide-react') return {BookOpenCheck: 'BookOpenCheck'};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/components/procedures-manager') return {ProceduresManager: 'ProceduresManager'};
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (outer === 'denied') throw Error('DENIED'); }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (outer === 'loader-throws') throw Error('PRIVATE_LOADER'); return client; }};
    return denied();
  }, warn, denied);
  if (outer === 'denied') { await assert.rejects(api.default(), /DENIED/); assert.equal(clients, 0); assert.deepEqual(Object.values(calls), [[], [], [], []]); assert.deepEqual(logs, []); assert.equal(effects, 0); return null; }
  const tree = await api.default(), props = nodes(tree, 'ProceduresManager')[0].props;
  assert.equal(clients, 1); const shell = nodes(tree, 'DashboardShell')[0]; assert.equal(shell.props.role, 'admin'); assert.equal(shell.props.title, 'ניהול נהלים');
  assert.ok(text(tree).includes('מסך ניהול נהלים אמיתי, לא JSON.')); assert.ok(text(tree).includes('יצירה, עריכה, שיוך, חובת אישור, צפייה בביצוע ולוג ביקורת.'));
  assert.equal(nodes(tree, 'BookOpenCheck')[0].props.size, 15);
  const bothUnknown = outer === 'loader-throws', unavailable = spec => bothUnknown || failed(modes[spec.table] ?? 'healthy');
  for (const spec of sources) {
    assert.equal(props[spec.flag], !unavailable(spec));
    if (unavailable(spec)) assert.deepEqual(plain(props[spec.field]), []);
    if (bothUnknown) assert.deepEqual(calls[spec.table], []);
    else if (!['factory-throws', 'chain-throws'].includes(modes[spec.table])) assert.deepEqual(plain(calls[spec.table]), expected(spec.table));
  }
  const unknown = sources.some(unavailable); assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), unknown);
  assert.equal(nodes(tree, 'span')[0].props.className, unknown ? 'pill' : 'pill good'); assert.equal(text(nodes(tree, 'span')[0]), ' Procedures UI');
  const bad = sources.map((s, index) => failed(modes[s.table] ?? 'healthy') ? index : null).filter(index => index !== null);
  assert.equal(logs.length, bothUnknown ? 1 : bad.length);
  if (bothUnknown) assert.equal(logs[0][1], 'admin procedures'); else assert.deepEqual(plain(logs.map(item => item[1])), bad.map(index => `admin procedures ${index}`));
  assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  const rendered = manager(props); assert.equal(effects, 0); assert.ok(!text(rendered.tree).includes('UNUSED_AUDIT_PAYLOAD'));
  if (props.proceduresAvailable && props.procedures.length === 0) assert.ok(text(rendered.tree).includes('אין נהלים עדיין'));
  if (props.acknowledgementsAvailable && props.acknowledgements.length === 0) assert.ok(text(rendered.tree).includes('אין אישורי קריאה עדיין.'));
  if (props.auditLogsAvailable && props.auditLogs.length === 0) assert.ok(text(rendered.tree).includes('אין פעולות נוהל בלוג.'));
  for (const spec of sources) if (!unavailable(spec) && !['empty', 'null'].includes(modes[spec.table])) assert.equal(props[spec.field].length, supplied[spec.field]?.length ?? 1);
  return {...rendered, props, page: tree};
}
for (const spec of sources) for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'query-reject', 'factory-throws', 'chain-throws']) {
  test(`${spec.table}: ${mode} retains healthy neighbors`, () => render({[spec.table]: mode}, spec.field === 'acknowledgements' ? {acknowledgements: [ack({acknowledged_at: mode === 'error-stale' ? 'INVALID_DATE' : null})]} : spec.field === 'auditLogs' ? {auditLogs: [audit({created_at: mode === 'error-stale' ? 'INVALID_DATE' : null})]} : {}));
}
for (let first = 0; first < 4; first++) for (let second = first + 1; second < 4; second++) test(`paired failures ${first}/${second}`, () => render({[sources[first].table]: 'query-reject', [sources[second].table]: 'factory-throws'}));
for (const outer of ['loader-throws', 'denied']) test(`outer ${outer}`, () => render({}, {}, outer));
for (const spec of sources) test(`direct stale props respect ${spec.flag}`, () => {
  const r = manager({...fixtures(), [spec.flag]: false});
  if (spec.field === 'procedures') assert.ok(!text(r.tree).includes('SYNTHETIC_PROCEDURE_TITLE'));
  if (spec.field === 'acknowledgements') assert.ok(!text(r.tree).includes('SYNTHETIC_ACK_USER'));
  if (spec.field === 'auditLogs') assert.ok(!text(r.tree).includes('SYNTHETIC_AUDIT_ACTION'));
});
test('retained items and editing state stay hidden when all flags become unavailable', () => {
  const props = Object.fromEntries(sources.flatMap(s => [[s.field, []], [s.flag, false]]));
  const r = manager(props, {items: [procedure()], editing: procedure()}); assert.equal(r.form, undefined); assert.equal(r.rows.length, 0); assert.ok(!text(r.tree).includes('SYNTHETIC_'));
});
test('optional flags omitted preserve existing caller initial render', () => { const r = manager(fixtures()); assert.ok(r.form); assert.equal(r.rows.length, 1); assert.equal(r.ackRows.length, 1); assert.equal(r.auditRows.length, 1); });
for (let mask = 0; mask < 16; mask++) test(`exact form dependency mask ${mask}`, () => {
  const flags = Object.fromEntries(sources.map((s, i) => [s.flag, Boolean(mask & (1 << i))]));
  const r = manager({...fixtures(), ...flags}, {editing: procedure()}); assert.equal(Boolean(r.form), flags.proceduresAvailable && flags.gardensAvailable);
});
test('actual useMemo Map keeps last duplicate and original known-empty acknowledgement semantics', () => {
  const r = manager({...fixtures(), acknowledgements: [ack({acknowledged_by: 'SYNTHETIC_FIRST'}), ack({acknowledged_by: 'SYNTHETIC_LAST'})]});
  assert.equal(r.memo.get('SYNTHETIC_PROCEDURE_ID').acknowledged_by, 'SYNTHETIC_LAST'); assert.ok(text(r.rows[0]).includes('נצפה/הושלם: כן'));
  const empty = manager({...fixtures(), acknowledgements: []}); assert.ok(text(empty.rows[0]).includes('נצפה/הושלם: טרם'));
});
for (const value of [null, undefined, 0, '', '2026-11-05T03:00:00.000Z']) test(`original acknowledgement/audit date truthiness ${String(value)}`, () => {
  const r = manager({...fixtures(), acknowledgements: [ack({acknowledged_at: value})], auditLogs: [audit({created_at: value})]});
  assert.ok(text(r.ackRows[0]).includes(value ? new Date(value).toLocaleDateString('he-IL') : 'ללא תאריך'));
  assert.equal(text(nodes(r.auditRows[0], 'span')[0]), value ? new Date(value).toLocaleString('he-IL') : '');
});
for (const value of [null, undefined, 0, '']) test(`procedure/form nullish fields preserve ${String(value)}`, () => {
  const p = procedure({title: value, body: value, procedure_type: value, active: value, requires_acknowledgement: value, required_for_framework: value});
  const r = manager({...fixtures(), procedures: [p]}, {editing: p});
  assert.equal(nodes(r.form, 'input').find(n => n.props.name === 'title').props.defaultValue, value ?? '');
  assert.equal(nodes(r.form, 'textarea')[0].props.defaultValue, value ?? '');
  assert.equal(nodes(r.form, 'select').find(n => n.props.name === 'status').props.defaultValue, 'active');
  assert.equal(nodes(r.form, 'input').find(n => n.props.name === 'requires_acknowledgement').props.defaultChecked, value ?? true);
  assert.ok(text(r.rows[0]).includes(`שיוך: ${value ?? 'all'}`));
});
test('server order/duplicate identifiers and original target options are not clamped', () => {
  const props = {...fixtures(), procedures: Array.from({length: 31}, (_, i) => procedure({id: 'SYNTHETIC_DUPLICATE', title: `SYNTHETIC_ORDER_${i}`})), gardens: [garden(), garden({id: 'SYNTHETIC_GARDEN_TWO', name: 'SYNTHETIC_SECOND'})]};
  const r = manager(props); assert.deepEqual(r.rows.map(row => text(nodes(row, 'h3')[0])), props.procedures.map(p => p.title));
  const target = nodes(r.form, 'select').find(n => n.props.name === 'required_for_framework');
  assert.deepEqual(nodes(target, 'option').map(n => n.props.value), ['all', 'SYNTHETIC_GARDEN_ID', 'SYNTHETIC_GARDEN_TWO', 'manager', 'inspector', 'staff']);
});
test('existing persistent message/error UI retained without executing actions', () => {
  const r = manager(fixtures(), {message: 'SYNTHETIC_PREVIOUS_MESSAGE', error: 'SYNTHETIC_PREVIOUS_ERROR'}); assert.ok(text(r.tree).includes('SYNTHETIC_PREVIOUS_MESSAGE')); assert.ok(text(r.tree).includes('SYNTHETIC_PREVIOUS_ERROR')); assert.equal(r.effects, 0);
});
test('one DOMAIN hook and original callback/submit bindings remain explicit', () => {
  assert.ok(pageSource.indexOf('await requireRole(["admin"])') < pageSource.indexOf('await safeAdminData(')); assert.equal((pageSource.match(/supabase\.from\(/g) ?? []).length, 4);
  assert.ok(managerSource.includes('onSubmit={submit}')); assert.ok(managerSource.includes('onClick={() => setEditing(procedure)}'));
  const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url)));
  assert.deepEqual(config.domain.filter(item => item.name === 'admin-procedures-query-boundary'), [{name: 'admin-procedures-query-boundary', args: ['--test', 'scripts/qa/check-admin-procedures-query-boundary.mjs']}]);
});
