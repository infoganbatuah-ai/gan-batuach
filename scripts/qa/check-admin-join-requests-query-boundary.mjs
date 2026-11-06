import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Actual page + unchanged actual Manager/FlowSection/Card readonly rendering.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/join-requests/page.tsx', import.meta.url));
const compile = value => {
  const r = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal(r.diagnostics.length, 0); return r.outputText;
};
const pageCode = compile(source), managerCode = compile(read(new URL('../../components/admin-leads-manager.tsx', import.meta.url))), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url)));
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
function load(code, require, warn, denied) {
  const exports = {};
  vm.runInNewContext(code, {exports, require, process: {env: {}}, fetch: denied, FormData: denied, console: {warn}}); return exports;
}
const lead = overrides => ({id: 'SYNTHETIC_LEAD_ID', lead_type: 'garden', garden_name: 'SYNTHETIC_GARDEN_TITLE', manager_name: 'SYNTHETIC_MANAGER', owner_name: 'SYNTHETIC_OWNER', city: 'SYNTHETIC_CITY', email: 'synthetic@example.invalid', phone: 'SYNTHETIC_PHONE', status: 'new', notes: 'SYNTHETIC_NOTE', ...overrides});
const selected = 'id, lead_type, parent_name, garden_name, owner_name, manager_name, city, address, phone, email, age_groups, capacity, children_count, staff_count, experience, certifications, notes, status';
async function render(mode = 'healthy', rows = [lead()]) {
  let clients = 0, queries = 0, admissions = 0, effects = 0;
  const calls = [], logs = [], counts = {AdminLeadsManager: 0, FlowSection: 0, LeadCard: 0, GardenCard: 0};
  const denied = () => { effects++; throw Error('UNEXPECTED_SIDE_EFFECT'); };
  const warn = (...args) => logs.push(args);
  const safe = load(helperCode, denied, warn, denied);
  const manager = load(managerCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx, Fragment: 'Fragment'};
    if (id === 'react') return {useState: initial => [initial, denied]};
    if (id === 'next/link') return {__esModule: true, default: 'Link'};
    return denied();
  }, denied, denied);
  function fold(value) {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(fold);
    if (typeof value.type === 'function') {
      assert.ok(Object.hasOwn(counts, value.type.name)); counts[value.type.name]++;
      return fold(value.type(value.props)); // Never invoke event/action props.
    }
    return {...value, props: {...value.props, children: fold(value.props?.children)}};
  }
  const client = {from(table) {
    queries++; calls.push(['from', table]); if (mode === 'factory-throws') throw Error('PRIVATE_FACTORY');
    const q = {};
    for (const method of ['select', 'order', 'limit']) q[method] = (...args) => { calls.push([method, ...args]); if (mode === 'chain-throws') throw Error('PRIVATE_CHAIN'); return q; };
    q.then = (resolve, reject) => (mode === 'query-reject' ? Promise.reject(Error('PRIVATE_REJECTION')) : Promise.resolve({data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : rows, error: mode.startsWith('error-') ? {message: 'PRIVATE_ERROR', details: 'PRIVATE_DETAILS'} : null})).then(resolve, reject);
    return q;
  }};
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/components/admin-leads-manager') return manager;
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (mode === 'denied') throw Error('DENIED'); }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (mode === 'loader-throws') throw Error('PRIVATE_LOADER'); return client; }};
    return denied();
  }, warn, denied);
  if (mode === 'denied') { await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.equal(queries, 0); assert.deepEqual(logs, []); assert.deepEqual(Object.values(counts), [0, 0, 0, 0]); assert.equal(effects, 0); return null; }
  const rawTree = await page.default(), invocation = nodes(rawTree, manager.AdminLeadsManager)[0];
  const tree = fold(rawTree), body = text(tree);
  assert.equal(clients, 1); assert.equal(queries, mode === 'loader-throws' ? 0 : 1);
  if (!['factory-throws', 'chain-throws', 'loader-throws'].includes(mode)) assert.deepEqual(plain(calls), [['from', 'leads'], ['select', selected], ['order', 'created_at', {ascending: false}], ['limit', 100]]);
  const shell = nodes(tree, 'DashboardShell')[0]; assert.equal(shell.props.role, 'admin'); assert.equal(shell.props.title, 'בקשות הצטרפות');
  assert.ok(body.includes('לידים מגנים, מפקחים והורים עם המרה למשתמש פעיל.')); assert.ok(body.includes('גן או מפקח שאושרו יכולים להפוך מכאן לרשומת מערכת פעילה עם משתמש Supabase Auth, פרופיל והרשאות.'));
  assert.equal(text(nodes(tree, 'span').find(n => n.props.className === 'pill good')), 'new / contacted / approved / rejected');
  const unknown = mode.startsWith('error-') || ['query-reject', 'factory-throws', 'chain-throws', 'loader-throws'].includes(mode);
  assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), unknown);
  assert.ok(!body.includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  const boards = nodes(tree, 'section').filter(n => n.props.className === 'dashboard-section flow-board-section');
  const cards = nodes(tree, 'article');
  if (unknown) {
    assert.equal(invocation, undefined); assert.deepEqual(Object.values(counts), [0, 0, 0, 0]); assert.equal(boards.length, 0); assert.equal(cards.length, 0); assert.equal(nodes(tree, 'button').length, 0);
    assert.ok(body.includes('נתוני בקשות ההצטרפות אינם זמינים')); assert.ok(!body.includes('אין פריטים כרגע')); assert.ok(!body.includes('SYNTHETIC_')); assert.ok(!body.includes('synthetic@example.invalid'));
    assert.equal(logs.length, 1); assert.equal(logs[0][1], 'admin leads');
  } else {
    assert.deepEqual(Object.keys(invocation.props), ['leads', 'leadsAvailable']); assert.equal(invocation.props.leadsAvailable, true);
    assert.deepEqual(plain(invocation.props.leads), ['empty', 'null'].includes(mode) ? [] : plain(rows));
    assert.equal(counts.AdminLeadsManager, 1); assert.equal(counts.FlowSection, 12); assert.equal(counts.GardenCard, 0); assert.equal(boards.length, 12); assert.deepEqual(logs, []);
    if (['empty', 'null'].includes(mode)) { assert.equal(counts.LeadCard, 0); assert.equal((body.match(/אין פריטים כרגע/g) ?? []).length, 12); }
  }
  assert.equal(effects, 0); return {tree, body, counts, cards, boards, props: invocation?.props, effects};
}
for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'query-reject', 'factory-throws', 'chain-throws', 'loader-throws', 'denied']) test(`actual page/client ${mode}`, () => render(mode));
for (const status of ['new', 'registration_pending', 'new_garden_onboarding', 'lead_submitted', 'contacted', 'qualified', 'approved', 'onboarding']) test(`existing active lead status ${status}`, async () => { const r = await render('healthy', [lead({status})]); assert.equal(r.counts.LeadCard, 1); assert.ok(r.body.includes('המרה לרישום גן')); });
for (const status of ['active', 'rejected', 'converted', 'new ', '', 0]) test(`existing excluded lead status ${String(status)}`, async () => { const r = await render('healthy', [lead({status})]); assert.equal(r.counts.LeadCard, 0); });
for (const [source, title] of [[undefined, 'בקשות גן חדשות'], [null, 'בקשות גן חדשות'], ['', 'בקשות גן חדשות'], ['demo_booking', 'בקשות הדגמה'], ['parent_request', 'בקשות שהגיעו מהורים'], ['synthetic_referral_source', 'הפניות'], ['public_website', 'בקשות גן חדשות']]) {
  test(`unchanged synthetic source filter ${String(source)}`, async () => {
    const r = await render('healthy', [lead({source})]); assert.equal(r.counts.LeadCard, 1);
    const board = r.boards.find(n => text(nodes(n, 'h2')[0]) === title); assert.equal(nodes(board, 'article').length, 1);
  });
}
for (const lead_type of ['parent', 'inspector', 'Garden']) test(`existing lead type filter ${lead_type}`, async () => { const r = await render('healthy', [lead({lead_type})]); assert.equal(r.counts.LeadCard, 0); });
for (const value of [undefined, null, '', 0]) test(`known falsy contact fallback ${String(value)}`, async () => {
  const r = await render('healthy', [lead({garden_name: value, city: value, manager_name: value, owner_name: 'SYNTHETIC_OWNER_FALLBACK', email: value})]);
  assert.ok(text(r.cards[0]).includes('גן חדש')); assert.ok(text(r.cards[0]).includes('עיר לא צוינה')); assert.ok(text(r.cards[0]).includes('SYNTHETIC_OWNER_FALLBACK')); assert.ok(text(r.cards[0]).includes('SYNTHETIC_PHONE'));
});
test('known duplicate identifiers/server order retained without local clamp or mutation', async () => {
  const rows = Array.from({length: 101}, (_, i) => lead({id: 'SYNTHETIC_DUPLICATE', garden_name: `SYNTHETIC_ORDER_${i}`}));
  const r = await render('healthy', rows); assert.equal(r.counts.LeadCard, 101); assert.deepEqual(r.cards.map(card => text(nodes(card, 'h3')[0])), rows.map(item => item.garden_name));
});
for (const count of [0, 4, 5, 10]) test(`existing parent-source demand metadata ${count}`, async () => {
  const r = await render('healthy', [lead({source: 'parent_request', parent_name: 'SYNTHETIC_PARENT', qualification: {parent_request_count: count, child_age_groups: ['SYNTHETIC_AGE']}})]);
  assert.ok(r.body.includes(`${count} בקשות`)); assert.ok(r.body.includes(count >= 10 ? 'ביקוש גבוה' : count >= 5 ? 'ביקוש בינוני' : 'ביקוש רגיל'));
});
test('existing omitted gardens prop retains legitimate empty downstream boards', async () => { const r = await render(); assert.equal(r.counts.GardenCard, 0); assert.equal(r.boards.slice(5).length, 7); for (const board of r.boards.slice(5)) assert.ok(text(board).includes('אין פריטים כרגע')); });
test('single portable DOMAIN hook; original Manager invocation and fail-closed fallback', () => {
  assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData(')); assert.ok(source.includes('<AdminLeadsManager leads={result.data.rows} leadsAvailable={result.data.available} />')); assert.ok(source.includes('available: false'));
  const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url)));
  assert.deepEqual(config.domain.filter(item => item.name === 'admin-join-requests-query-boundary'), [{name: 'admin-join-requests-query-boundary', args: ['--test', 'scripts/qa/check-admin-join-requests-query-boundary.mjs']}]);
});
