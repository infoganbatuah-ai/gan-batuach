import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Disconnected synthetic rendering only; no SDK, actual inspections or actions.
const resident = path => {
  assert.equal(fs.statSync(path).flags & 0x40000000, 0);
  return fs.readFileSync(path, 'utf8');
};
const sources = Object.fromEntries(['due', 'late'].map(kind => [kind, resident(new URL(`../../app/dashboard/admin/inspections/${kind}/page.tsx`, import.meta.url))]));
const helperSource = resident(new URL('../../lib/admin-safe.ts', import.meta.url));
const compile = source => {
  const compiled = ts.transpileModule(source, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal(compiled.diagnostics.length, 0);
  return compiled.outputText;
};
const pages = Object.fromEntries(Object.entries(sources).map(([kind, source]) => [kind, compile(source)]));
const helper = compile(helperSource);
const fixed = '2026-11-05T00:00:00.000Z';
const NativeDate = Date;
class FixedDate extends NativeDate {
  constructor(...args) { if (args.length) super(...args); else super(fixed); }
  static now() { return NativeDate.parse(fixed); }
}
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
function load(code, require, warn) {
  const exports = {};
  const denied = () => { throw Error('UNEXPECTED_SIDE_EFFECT'); };
  vm.runInNewContext(code, {exports, require, Date: FixedDate, process: {env: {}}, fetch: denied, FormData: denied, console: {warn}});
  return exports;
}
function fixture(kind, overrides = {}) {
  return {id: 'SYNTHETIC_INSPECTION', garden_id: 'SYNTHETIC_GARDEN_ID', inspector_id: 'SYNTHETIC_INSPECTOR_ID', status: 'pending', countdown_day: 3,
    due_at: kind === 'due' ? '2026-11-05T12:00:00.000Z' : '2026-11-04T12:00:00.000Z',
    gardens: {name: 'SYNTHETIC_GARDEN_TITLE', city: 'SYNTHETIC_CITY', last_inspection_score: 87}, inspectors: {full_name: 'SYNTHETIC_INSPECTOR'}, ...overrides};
}
async function render(kind, mode, rows = [fixture(kind)]) {
  let clients = 0, queries = 0, admissions = 0;
  const calls = [], logs = [];
  const warn = (...args) => logs.push(args);
  const safe = load(helper, id => { throw Error(`UNEXPECTED_HELPER_IMPORT ${id}`); }, warn);
  const client = {from(table) {
    queries++; calls.push(['from', table]);
    if (mode === 'factory-throws') throw Error('PRIVATE_SYNTHETIC_FACTORY');
    const query = {};
    for (const method of ['select', 'gte', 'lte', 'lt', 'neq', 'order']) query[method] = (...args) => {
      calls.push([method, ...args]);
      if (mode === 'chain-throws') throw Error('PRIVATE_SYNTHETIC_CHAIN');
      return query;
    };
    query.then = (resolve, reject) => (mode === 'query-reject' ? Promise.reject(Error('PRIVATE_SYNTHETIC_REJECTION')) : Promise.resolve({
      data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : rows,
      error: mode.startsWith('error-') ? {message: 'PRIVATE_SYNTHETIC_ERROR', details: 'PRIVATE_DETAILS'} : null,
    })).then(resolve, reject);
    return query;
  }};
  const page = load(pages[kind], id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === 'next/link') return {__esModule: true, default: 'Link'};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return {requireRole: async roles => {
      assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++;
      if (mode === 'denied') throw Error('DENIED');
    }};
    if (id === '@/lib/supabase/server') return {createClient: async () => {
      assert.equal(admissions, 1); clients++;
      if (mode === 'loader-throws') throw Error('PRIVATE_SYNTHETIC_LOADER');
      return client;
    }};
    throw Error(`UNEXPECTED_IMPORT ${id}`);
  }, warn);
  if (mode === 'denied') {
    await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.equal(queries, 0); assert.deepEqual(logs, []); return null;
  }
  const tree = await page.default();
  const result = {tree, clients, queries, calls: plain(calls), logs: plain(logs), body: text(tree), articles: nodes(tree, 'article'), links: nodes(tree, 'Link'), banner: nodes(tree, 'AdminDataError')[0]?.props.message};
  assert.equal(clients, 1); assert.equal(queries, mode === 'loader-throws' ? 0 : 1);
  assert.equal(nodes(tree, 'DashboardShell')[0].props.role, 'admin');
  assert.equal(nodes(tree, 'DashboardShell')[0].props.title, kind === 'due' ? 'פיקוח בקרוב' : 'פיקוח באיחור');
  assert.ok(!result.body.includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  assert.ok(result.body.includes(kind === 'due' ? 'גנים שצריכים לבצע פיקוח בקרוב.' : 'גנים שמאחרים בביצוע פיקוח.'));
  assert.equal(nodes(tree, 'input')[0].props.placeholder, kind === 'due' ? 'חיפוש גן / עיר / פקח' : 'חיפוש גן / פקח');
  assert.deepEqual(nodes(tree, 'option').map(text), kind === 'due' ? ['כל הפקחים'] : ['כל חומרות האיחור', '1-3 ימים', '4-7 ימים', 'מעל שבוע']);
  assert.equal(result.links[0].props.href, kind === 'due' ? '/dashboard/admin/inspections' : '/dashboard/admin/inspection-forms');
  return result;
}
function expectedCalls(kind) {
  const select = kind === 'due' ? 'id, garden_id, inspector_id, due_at, status, countdown_day, gardens(name, city, last_inspection_score), inspectors:inspector_id(full_name)' : 'id, garden_id, inspector_id, due_at, status, gardens(name, city, last_inspection_score), inspectors:inspector_id(full_name)';
  return [['from', 'required_inspections'], ['select', select], ...(kind === 'due' ? [['gte', 'due_at', fixed], ['lte', 'due_at', '2026-11-10T00:00:00.000Z']] : [['lt', 'due_at', fixed], ['neq', 'status', 'done']]), ['order', 'due_at']];
}
for (const kind of ['due', 'late']) {
  for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'query-reject', 'factory-throws', 'chain-throws', 'loader-throws', 'denied']) {
    test(`${kind}: ${mode}`, async () => {
      const r = await render(kind, mode); if (!r) return;
      const unavailable = mode.startsWith('error-') || ['query-reject', 'factory-throws', 'chain-throws', 'loader-throws'].includes(mode);
      assert.equal(Boolean(r.banner), unavailable);
      if (!['factory-throws', 'chain-throws', 'loader-throws'].includes(mode)) assert.deepEqual(r.calls, expectedCalls(kind));
      if (unavailable) {
        assert.ok(r.body.includes('נתוני הפיקוחים אינם זמינים כרגע')); assert.ok(!r.body.includes('אין פיקוחים'));
        assert.ok(!r.body.includes('SYNTHETIC_')); assert.equal(r.articles.length, 0); assert.equal(r.links.length, 1);
        assert.equal(r.logs.length, 1); assert.equal(r.logs[0][1], `admin inspections ${kind}`);
      } else if (mode === 'healthy') {
        assert.equal(r.articles.length, 1); assert.ok(r.body.includes('SYNTHETIC_GARDEN_TITLE')); assert.equal(r.links.length, 3);
        assert.equal(r.links[2].props.href, '/dashboard/admin/gardens/SYNTHETIC_GARDEN_ID'); assert.deepEqual(r.logs, []);
      } else {
        assert.equal(r.articles.length, 0); assert.ok(r.body.includes(kind === 'due' ? 'אין פיקוחים קרובים' : 'אין פיקוחים באיחור'));
        assert.ok(!r.body.includes('אינם זמינים')); assert.equal(r.links.length, 1); assert.deepEqual(r.logs, []);
      }
    });
  }
  for (const offset of [-5.1, -1, -0.1, 0, 0.1, 1, 5]) {
    test(`${kind}: original date arithmetic offset ${offset}`, async () => {
      const due_at = new NativeDate(NativeDate.parse(fixed) + offset * 86400000).toISOString();
      const r = await render(kind, 'healthy', [fixture(kind, {due_at, countdown_day: 999, status: 'done'})]);
      const days = Math.ceil(kind === 'due' ? offset : -offset);
      assert.ok(text(r.articles[0]).includes(`${days} ימים ${kind === 'due' ? 'נותרו' : 'איחור'}`));
      assert.ok(text(r.articles[0]).includes(new NativeDate(due_at).toLocaleDateString('he-IL')));
      assert.deepEqual(r.calls, expectedCalls(kind)); assert.equal(r.articles.length, 1); // No new local status/date filter.
    });
  }
  for (const variant of ['null-relations', 'null-fields', 'zero-empty']) {
    test(`${kind}: healthy nullish semantics ${variant}`, async () => {
      const values = variant === 'null-relations' ? {gardens: null, inspectors: null} : variant === 'null-fields' ? {gardens: {name: null, city: null, last_inspection_score: null}, inspectors: {full_name: null}} : {gardens: {name: '', city: '', last_inspection_score: 0}, inspectors: {full_name: ''}};
      const r = await render(kind, 'healthy', [fixture(kind, values)]);
      assert.equal(text(nodes(r.articles[0], 'h3')[0]), variant === 'zero-empty' ? '' : 'SYNTHETIC_GARDEN_ID');
      assert.ok(text(r.articles[0]).includes(`ציון אחרון: ${variant === 'zero-empty' ? '0' : '-'}`));
      assert.equal(r.links[2].props.href, '/dashboard/admin/gardens/SYNTHETIC_GARDEN_ID');
    });
  }
  test(`${kind}: multiple rows preserve server order and duplicate keys without local clamp`, async () => {
    const rows = Array.from({length: 53}, (_, index) => fixture(kind, {id: 'SYNTHETIC_DUPLICATE', gardens: {name: `SYNTHETIC_ORDER_${index}`}}));
    const r = await render(kind, 'healthy', rows);
    assert.equal(r.articles.length, 53);
    assert.deepEqual(r.articles.map(article => text(nodes(article, 'h3')[0])), rows.map(row => row.gardens.name));
  });
}
test('one portable DOMAIN hook; query/deadline formulas and authorization remain explicit', () => {
  const config = JSON.parse(resident(new URL('../../config/digital-observer-ci-gates.json', import.meta.url)));
  assert.deepEqual(config.domain.filter(item => item.name === 'admin-inspection-deadlines-query-boundary'), [{name: 'admin-inspection-deadlines-query-boundary', args: ['--test', 'scripts/qa/check-admin-inspection-deadlines-query-boundary.mjs']}]);
  for (const source of Object.values(sources)) {
    assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData('));
    assert.equal((source.match(/supabase\.from\(/g) ?? []).length, 1);
    assert.equal((source.match(/rows\.map\(/g) ?? []).length, 1);
    assert.ok(source.includes('available: false')); assert.ok(source.includes('rows: error ? [] : data ?? []'));
    assert.ok(!source.includes('.limit(')); assert.ok(!source.includes('@ts-ignore'));
  }
});
