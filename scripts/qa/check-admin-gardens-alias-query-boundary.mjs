import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Disconnected actual page/helper rendering only. No real garden or access proof.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/gardens/page.tsx', import.meta.url));
function compile(value) {
  const result = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal(result.diagnostics.length, 0); return result.outputText;
}
const pageCode = compile(source), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url)));
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
const garden = overrides => ({id: 'SYNTHETIC_ID', name: 'SYNTHETIC_GARDEN', city: 'SYNTHETIC_CITY', address: 'SYNTHETIC_ADDRESS', safe_status: 'safe', status: 'active', children_capacity: 12, current_children_count: 3, managers: {full_name: 'SYNTHETIC_MANAGER'}, owners: {full_name: 'SYNTHETIC_OWNER'}, ...overrides});
const selected = 'id, name, city, address, safe_status, status, children_capacity, current_children_count, managers:manager_id(full_name), owners:owner_profile_id(full_name)';
async function render(mode = 'healthy', rows = [garden()]) {
  let clients = 0, queries = 0, admissions = 0, effects = 0;
  const calls = [], logs = [], profile = {full_name: 'SYNTHETIC_ADMIN'};
  const denied = () => { effects++; throw Error('UNEXPECTED_SIDE_EFFECT'); };
  const warn = (...args) => logs.push(args);
  const helper = load(helperCode, denied, warn, denied);
  const client = {from(table) {
    queries++; calls.push(['from', table]); if (mode === 'factory-throws') throw Error('PRIVATE_FACTORY');
    const query = {};
    for (const method of ['select', 'order', 'limit']) query[method] = (...args) => { calls.push([method, ...args]); if (mode === 'chain-throws') throw Error('PRIVATE_CHAIN'); return query; };
    query.then = (resolve, reject) => (mode === 'query-reject' ? Promise.reject(Error('PRIVATE_REJECTION')) : Promise.resolve({data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : rows, error: mode.startsWith('error-') ? {message: 'PRIVATE_ERROR', details: 'PRIVATE_DETAILS'} : null})).then(resolve, reject);
    return query;
  }};
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === 'next/link') return {__esModule: true, default: 'Link'};
    if (id === '@/components/admin-app-ui') return {AdminAppFrame: 'AdminAppFrame'};
    if (id === '@/components/premium-dashboard') return {PremiumDashboardHero: 'PremiumDashboardHero'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/lib/admin-safe') return helper;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (mode === 'denied') throw Error('DENIED'); return {profile}; }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (mode === 'loader-throws') throw Error('PRIVATE_LOADER'); return client; }};
    return denied();
  }, warn, denied);
  if (mode === 'denied') { await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.equal(queries, 0); assert.equal(effects, 0); assert.deepEqual(logs, []); return null; }
  const tree = await page.default(), body = text(tree), frame = nodes(tree, 'AdminAppFrame')[0], hero = nodes(tree, 'PremiumDashboardHero')[0];
  assert.equal(clients, 1); assert.equal(queries, mode === 'loader-throws' ? 0 : 1);
  if (!['factory-throws', 'chain-throws', 'loader-throws'].includes(mode)) assert.deepEqual(plain(calls), [['from', 'gardens'], ['select', selected], ['order', 'created_at', {ascending: false}], ['limit', 120]]);
  assert.equal(frame.props.profile, profile); assert.equal(frame.props.activeHref, '/dashboard/admin/kindergarten-applications'); assert.equal(frame.props.title, 'גנים'); assert.equal(frame.props.subtitle, 'ספריית גנים, סטטוס תפעולי וכניסה לפרופיל מלא.');
  assert.equal(hero.props.eyebrow, 'גנים'); assert.equal(hero.props.title, 'ספריית גנים נקייה.'); assert.equal(hero.props.subtitle, 'סטטוס, מנהלת וכניסה לפרופיל מלא.');
  assert.deepEqual(nodes(hero.props.actions, 'Link').map(n => [n.props.href, n.props.className, text(n)]), [['/dashboard/admin/leads', 'button primary', 'קליטת גן חדש'], ['/dashboard/admin/kindergartens', 'button secondary', 'ספרייה מורחבת']]);
  assert.equal(nodes(tree, 'input')[0].props.placeholder, 'חיפוש לפי שם גן / עיר'); assert.deepEqual(nodes(tree, 'option').map(text), ['כל הסטטוסים', 'active', 'pending', 'blocked']);
  const unknown = mode.startsWith('error-') || ['query-reject', 'factory-throws', 'chain-throws', 'loader-throws'].includes(mode);
  const cards = nodes(tree, 'article'), links = nodes(tree, 'Link');
  assert.equal(nodes(tree, 'AdminDataError')[0].props.message, unknown ? 'לא ניתן לטעון את הנתונים כרגע' : null);
  assert.ok(!body.includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  if (unknown) {
    assert.equal(frame.props.badge, 'נתוני הגנים אינם זמינים'); assert.equal(hero.props.badge, 'נתוני הגנים אינם זמינים'); assert.equal(hero.props.badgeTone, 'default');
    assert.equal(cards.length, 0); assert.equal(links.length, 2); assert.ok(body.includes('נתוני הגנים אינם זמינים')); assert.ok(!body.includes('אין גנים להצגה')); assert.ok(!body.includes('SYNTHETIC_')); assert.ok(!body.includes('ילדים:'));
    assert.equal(logs.length, 1); assert.equal(logs[0][1], mode.startsWith('error-') ? 'admin gardens' : 'admin gardens alias');
  } else {
    const expected = ['empty', 'null'].includes(mode) ? [] : rows;
    assert.equal(frame.props.badge, `${expected.length} גנים`); assert.equal(hero.props.badge, `${expected.length} גנים`); assert.equal(hero.props.badgeTone, 'good'); assert.equal(cards.length, expected.length); assert.equal(links.length, 2 + expected.length * 2); assert.deepEqual(logs, []);
    if (!expected.length) assert.ok(body.includes('אין גנים להצגהגן חדש יופיע כאן אחרי אישור וקליטה.'));
    for (const [index, item] of expected.entries()) {
      const card = cards[index], content = text(card), pill = nodes(card, 'span')[0];
      assert.equal(card.key, item.id); assert.equal(text(nodes(card, 'h3')[0]), item.name ?? '');
      assert.equal(pill.props.className, item.safe_status === 'safe' ? 'pill good' : 'pill warn'); assert.equal(text(pill), String(item.safe_status ?? 'pending'));
      assert.equal(text(nodes(card, 'p')[0]), `${item.city ?? ''} · ${item.address ?? 'ללא כתובת'}`);
      assert.ok(content.includes(`מנהלת: ${item.managers?.full_name ?? '-'} · בעלים: ${item.owners?.full_name ?? '-'} · ילדים: ${item.current_children_count ?? 0}/${item.children_capacity ?? 0}`));
      assert.deepEqual(nodes(card, 'Link').map(n => n.props.href), [`/dashboard/admin/gardens/${item.id}`, `/dashboard/admin/users/new-kindergarten?gardenId=${item.id}`]);
    }
  }
  assert.equal(effects, 0); return {tree, body, frame, hero, cards};
}
for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'query-reject', 'factory-throws', 'chain-throws', 'loader-throws', 'denied']) test(`actual alias page/helper ${mode}`, () => render(mode));
for (const safe_status of ['safe', 'pending', 'blocked', 'SAFE', '', null, undefined]) test(`unchanged metadata status ${String(safe_status)}`, () => render('healthy', [garden({safe_status})]));
for (const value of [undefined, null, '', 0, 1, 99]) test(`unchanged nullish address/count fields ${String(value)}`, () => render('healthy', [garden({address: value, current_children_count: value, children_capacity: value})]));
for (const value of [undefined, null, '', 'SYNTHETIC_RELATION']) test(`unchanged relation names ${String(value)}`, () => render('healthy', [garden({managers: {full_name: value}, owners: {full_name: value}})]));
for (const value of [undefined, null]) test(`missing relations ${String(value)}`, () => render('healthy', [garden({managers: value, owners: value})]));
for (const status of ['active', 'pending', 'blocked', null]) test(`no new status filter ${String(status)}`, () => render('healthy', [garden({status})]));
test('raw duplicate IDs and server order remain, no client-side 120-row clamp', async () => {
  const rows = Array.from({length: 121}, (_, i) => garden({id: 'SYNTHETIC_DUPLICATE', name: `SYNTHETIC_ORDER_${120-i}`}));
  const before = JSON.stringify(rows), result = await render('healthy', rows);
  assert.equal(result.cards.length, 121); assert.deepEqual(result.cards.map(card => text(nodes(card, 'h3')[0])), rows.map(item => item.name)); assert.equal(JSON.stringify(rows), before);
});
test('single portable hook, auth-before-loader and fail-closed fallback', () => {
  assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData(')); assert.ok(source.includes('available: false')); assert.ok(source.includes('rows: error ? [] : data ?? []')); assert.equal((source.match(/supabase\.from\(/g) ?? []).length, 1);
  const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url)));
  assert.deepEqual(config.domain.filter(item => item.name === 'admin-gardens-alias-query-boundary'), [{name: 'admin-gardens-alias-query-boundary', args: ['--test', 'scripts/qa/check-admin-gardens-alias-query-boundary.mjs']}]);
});
