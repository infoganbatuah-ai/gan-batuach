import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Actual page + safeAdminData, disconnected readonly synthetic identities only.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/duplicates/page.tsx', import.meta.url));
function compile(value) { const r = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url)));
const jsx = (type, props, key) => ({type, props: props ?? {}, key});
const plain = value => JSON.parse(JSON.stringify(value));
function nodes(v, type) { if (!v || typeof v !== 'object') return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === 'boolean' || typeof v === 'function') return ''; if (typeof v !== 'object') return String(v); return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children); }
const tables = ['parents', 'children', 'staff', 'profiles'], categories = ['הורים', 'ילדים', 'צוות', 'מנהלת / בעלים'];
const fields = ['id, full_name, identity_number, phone, email', 'id, full_name, identity_number, garden_id', 'id, full_name, identity_number, garden_id, role_title', 'id, full_name, email, role, identity_number'];
const rowsFor = table => [{id: `SYNTHETIC_${table}_A`, full_name: `SYNTHETIC_${table}_NAME_A`, identity_number: ' SYNTHETIC_SHARED_ID '}, {id: `SYNTHETIC_${table}_B`, full_name: `SYNTHETIC_${table}_NAME_B`, identity_number: 'SYNTHETIC_SHARED_ID'}];
const fixture = () => Object.fromEntries(tables.map(table => [table, rowsFor(table)]));
const known = mode => !mode || mode === 'empty' || mode === 'null';
async function render({modes = {}, rows = {}, deniedRole = false, clientThrows = false} = {}) {
  const data = {...fixture(), ...rows}, calls = [], logs = [];
  let clients = 0, admissions = 0, effects = 0;
  const deny = () => { effects++; throw Error('UNEXPECTED_EFFECT'); };
  function load(code, require) { const exports = {}; vm.runInNewContext(code, {exports, require, process: {env: {}}, fetch: deny, FormData: deny, console: {warn: (...args) => logs.push(args)}}); return exports; }
  const helper = load(helperCode, deny);
  const client = {from(table) {
    const i = calls.length; assert.equal(table, tables[i]); const mode = modes[table], chain = [['from', table]]; calls.push(chain); if (mode === 'factory') throw Error('PRIVATE_FACTORY');
    const q = {}; for (const method of ['select', 'in', 'limit']) q[method] = (...args) => { chain.push([method, ...args]); if (mode === 'chain') throw Error('PRIVATE_CHAIN'); return q; };
    q.then = (resolve, reject) => (mode === 'reject' ? Promise.reject(Error('PRIVATE_REJECT')) : mode === 'reject-null' ? Promise.reject(null) : mode === 'reject-false' ? Promise.reject(false) : Promise.resolve({data: mode?.endsWith('empty') || mode === 'empty' ? [] : mode?.endsWith('null') || mode === 'null' ? null : data[table], error: mode?.startsWith('error') ? {message: 'PRIVATE_DIAGNOSTIC', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT'} : null})).then(resolve, reject); return q;
  }};
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/lib/admin-safe') return helper;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (deniedRole) throw Error('DENIED'); }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (clientThrows) throw Error('PRIVATE_CLIENT'); return client; }};
    return deny();
  });
  if (deniedRole) { await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls.length, 0); assert.equal(effects, 0); assert.deepEqual(logs, []); return null; }
  const tree = await page.default(), body = text(tree), cards = nodes(tree, 'article');
  assert.equal(clients, 1); assert.equal(calls.length, clientThrows ? 0 : 4);
  if (!clientThrows) for (let i = 0; i < 4; i++) { const expected = [['from', tables[i]], ['select', fields[i]], ...(i === 3 ? [['in', 'role', ['manager', 'owner']]] : []), ['limit', 2000]], mode = modes[tables[i]]; assert.deepEqual(plain(calls[i]), mode === 'factory' ? expected.slice(0, 1) : mode === 'chain' ? expected.slice(0, 2) : expected); }
  const missing = tables.filter(table => clientThrows || !known(modes[table])), allAvailable = missing.length === 0;
  assert.deepEqual(plain(logs), clientThrows ? [['Admin page data unavailable:', 'admin duplicates']] : missing.map(table => ['Admin Supabase query unavailable:', `admin duplicates ${tables.indexOf(table)}`]));
  assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), !allAvailable);
  assert.ok(!JSON.stringify(tree).includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_')); assert.ok(!body.includes('ניתן להריץ את מיגרציית הייחודיות בבטחה'));
  const shell = nodes(tree, 'DashboardShell')[0]; assert.equal(shell.props.role, 'admin'); assert.equal(shell.props.title, 'איתור כפילויות');
  assert.ok(body.includes('Identity QA')); assert.ok(body.includes('איתור כפילויות לפי תעודת זהות.')); assert.ok(body.includes('כלי פנימי לפני הפעלת אינדקסים ייחודיים מלאים. אם קיימות כפילויות, יש לאחד ידנית לפני נעילה קשיחה.'));
  const expected = [];
  for (const [i, table] of tables.entries()) {
    if (missing.includes(table)) continue;
    const input = ['empty', 'null'].includes(modes[table]) ? [] : data[table] ?? [], groups = new Map();
    for (const row of input) { const identity = String(row.identity_number ?? '').trim(); if (identity) { if (!groups.has(identity)) groups.set(identity, []); groups.get(identity).push(row); } }
    for (const [identity, members] of groups) if (members.length > 1) expected.push({type: categories[i], identity, count: members.length, names: members.map(row => row.full_name ?? row.email ?? row.id)});
  }
  assert.equal(cards.length, expected.length);
  for (const [i, group] of expected.entries()) { assert.equal(cards[i].key, `${group.type}-${group.identity}`); assert.equal(text(nodes(cards[i], 'span')[0]), group.type); assert.equal(text(nodes(cards[i], 'h3')[0]), `תעודת זהות ${group.identity}`); assert.equal(text(nodes(cards[i], 'p')[0]), `${group.count} רשומות: ${group.names.join(', ')}`); }
  const hero = nodes(tree, 'div').find(n => n.props.className === 'dashboard-hero-card admin-hero-card'), aggregate = nodes(hero, 'span')[0];
  assert.equal(aggregate.props.className, !allAvailable ? 'pill' : expected.length ? 'pill bad' : 'pill good');
  assert.equal(text(aggregate), allAvailable ? `${expected.length} קבוצות כפולות` : 'בדיקת הכפילויות אינה מלאה');
  if (!allAvailable) { const banner = nodes(tree, 'div').find(n => n.props.className === 'warning-banner'); assert.equal(text(banner), `מקורות שאינם זמינים: ${missing.map(table => categories[tables.indexOf(table)]).join(' · ')}`); assert.ok(!body.includes('לא נמצאו כפילויות לפי תעודת זהות')); if (!expected.length) assert.ok(body.includes('לא ניתן לקבוע אם קיימות כפילויות בכל המקורות כרגע.')); }
  else if (!expected.length) { assert.ok(body.includes('לא נמצאו כפילויות לפי תעודת זהות')); assert.ok(body.includes('לא נמצאו כפילויות ברשומות שנטענו בלבד. תצוגה זו אינה מאשרת מיגרציה, מיזוג או מחיקה.')); }
  assert.equal(nodes(tree, 'button').length, 0); assert.equal(nodes(tree, 'form').length, 0); assert.equal(effects, 0); return {tree, cards, expected};
}
test('actual page/helper healthy four categories remain separate and ordered', () => render());
test('denied role runs no client/query/log/render', () => render({deniedRole: true}));
test('outer client failure safely makes all sources unknown', () => render({clientThrows: true}));
for (const table of tables) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'factory', 'chain', 'reject-null', 'reject-false']) test(`${table} ${mode} suppresses only failed source`, () => render({modes: {[table]: mode}}));
for (const table of tables) for (const mode of ['empty', 'null']) test(`${table} healthy ${mode} remains known`, () => render({modes: {[table]: mode}}));
test('all known empty returns scoped no-duplicates copy, no migration permission', () => render({rows: Object.fromEntries(tables.map(t => [t, []]))}));
test('all known null returns scoped no-duplicates copy', () => render({rows: Object.fromEntries(tables.map(t => [t, null]))}));
test('all failed stale returns unavailable rather than zero/success', () => render({modes: Object.fromEntries(tables.map(t => [t, 'error-stale']))}));
for (const table of tables) test(`known partial zero plus unknown ${table} is not success`, () => render({rows: Object.fromEntries(tables.map(t => [t, []])), modes: {[table]: 'error-stale'}}));
for (const [a, b] of [['parents', 'children'], ['staff', 'profiles'], ['parents', 'profiles']]) test(`paired failures ${a}/${b} preserve independent healthy groups`, () => render({modes: {[a]: 'error-stale', [b]: 'reject'}}));
for (const value of [undefined, null, '', ' ', '\t']) test(`blank identity ${String(value)} is excluded`, () => render({rows: {parents: [{id: 'SYNTHETIC_A', full_name: 'A', identity_number: value}, {id: 'SYNTHETIC_B', full_name: 'B', identity_number: value}]}}));
test('numeric zero identity groups with trimmed string zero', () => render({rows: {parents: [{id: 'SYNTHETIC_A', identity_number: 0}, {id: 'SYNTHETIC_B', identity_number: ' 0 '}]}}));
test('nullish name uses email then id; empty name stays empty', () => render({rows: {parents: [{id: 'SYNTHETIC_A', full_name: null, email: 'synthetic@example.invalid', identity_number: 'SYNTHETIC'}, {id: 'SYNTHETIC_B', full_name: undefined, email: null, identity_number: 'SYNTHETIC'}, {id: 'SYNTHETIC_C', full_name: '', email: 'NOT_USED', identity_number: 'SYNTHETIC'}]}}));
test('map entry and member server order, duplicate row IDs and counts retained', () => render({rows: {children: [{id: 'DUP', full_name: 'Z_FIRST', identity_number: ' Z '}, {id: 'DUP', full_name: 'A_FIRST', identity_number: 'A'}, {id: 'DUP', full_name: 'Z_SECOND', identity_number: 'Z'}, {id: 'DUP', full_name: 'A_SECOND', identity_number: ' A '}], profiles: []}}));
test('single rows sharing identities across categories do not cross-merge', () => render({rows: Object.fromEntries(tables.map(t => [t, rowsFor(t).slice(0, 1)]))}));
test('query limit is preserved without a second local clamp', () => render({rows: {parents: Array.from({length: 2001}, (_, i) => ({id: `SYNTHETIC_${i}`, full_name: `SYNTHETIC_NAME_${i}`, identity_number: 'SYNTHETIC_ONE_GROUP'}))}}));
test('one portable DOMAIN hook and unchanged role-before-loader order', () => { assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData(')); assert.equal((source.match(/readSource\(\(\) => supabase\.from\(/g) ?? []).length, 4); const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url))); assert.deepEqual(config.domain.filter(x => x.name === 'admin-duplicates-query-boundary'), [{name: 'admin-duplicates-query-boundary', args: ['--test', 'scripts/qa/check-admin-duplicates-query-boundary.mjs']}]); });
