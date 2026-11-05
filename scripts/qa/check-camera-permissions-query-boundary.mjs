import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Actual admin page/helper readonly JSX; no permission enforcement or live media proof.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/camera-permissions/page.tsx', import.meta.url));
function compile(value) { const r = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url)));
const jsx = (type, props, key) => ({type, props: props ?? {}, key});
const plain = value => JSON.parse(JSON.stringify(value));
function nodes(v, type) { if (!v || typeof v !== 'object') return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === 'boolean' || typeof v === 'function') return ''; if (typeof v !== 'object') return String(v); return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children); }
const row = (x = {}) => ({id: 'SYNTHETIC_PERMISSION', garden_id: 'SYNTHETIC_GARDEN', allowed: true, parents: {full_name: 'SYNTHETIC_PARENT', phone: 'NEVER_DISPLAY_PHONE'}, camera_streams: {name: 'SYNTHETIC_CAMERA', area: 'SYNTHETIC_AREA', status: 'connected'}, gardens: {name: 'SYNTHETIC_GARDEN_NAME'}, reason: 'SYNTHETIC_REASON', valid_until: '2026-01-01T12:00:00Z', ...x});
const selected = 'id, garden_id, allowed, valid_from, valid_until, reason, parents(full_name, phone), camera_streams(name, area, status), gardens(name, city)';
async function render(mode = 'healthy', rows = [row()]) {
  let clients = 0, queries = 0, admissions = 0, effects = 0;
  const calls = [], logs = [], deny = () => { effects++; throw Error('UNEXPECTED_EFFECT_OR_STALE_DATE'); };
  class ReadonlyDate extends Date { constructor(value) { if (value === 'INVALID_DATE') deny(); super(value); } }
  function load(code, require) { const exports = {}; vm.runInNewContext(code, {exports, require, process: {env: {}}, Date: ReadonlyDate, fetch: deny, FormData: deny, console: {warn: (...args) => logs.push(args)}}); return exports; }
  const helper = load(helperCode, deny);
  const client = {from(table) { queries++; calls.push(['from', table]); if (mode === 'factory') throw Error('PRIVATE_FACTORY'); const q = {}; for (const method of ['select', 'order', 'limit']) q[method] = (...args) => { calls.push([method, ...args]); if (mode === 'chain') throw Error('PRIVATE_CHAIN'); return q; }; q.then = (resolve, reject) => (mode === 'reject' ? Promise.reject(Error('PRIVATE_REJECT')) : mode === 'reject-null' ? Promise.reject(null) : mode === 'reject-false' ? Promise.reject(false) : Promise.resolve({data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : rows, error: mode.startsWith('error-') ? {message: 'PRIVATE_DIAGNOSTIC', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT'} : null})).then(resolve, reject); return q; }};
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === 'next/link') return {__esModule: true, default: 'Link'};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/lib/admin-safe') return helper;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (mode === 'denied') throw Error('DENIED'); }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (mode === 'loader') throw Error('PRIVATE_CLIENT'); return client; }};
    return deny();
  });
  if (mode === 'denied') { await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.equal(queries, 0); assert.deepEqual(logs, []); assert.equal(effects, 0); return null; }
  const tree = await page.default(), body = text(tree), cards = nodes(tree, 'article'), links = nodes(tree, 'Link');
  assert.equal(clients, 1); assert.equal(queries, mode === 'loader' ? 0 : 1);
  if (!['factory', 'chain', 'loader'].includes(mode)) assert.deepEqual(plain(calls), [['from', 'parent_camera_permissions'], ['select', selected], ['order', 'created_at', {ascending: false}], ['limit', 80]]);
  assert.equal(nodes(tree, 'DashboardShell')[0].props.role, 'admin'); assert.equal(nodes(tree, 'DashboardShell')[0].props.title, 'הרשאות מצלמה');
  const hero = nodes(tree, 'div').find(n => n.props.className === 'dashboard-hero-card admin-hero-card'); assert.ok(text(hero).includes('Camera Permissions')); assert.ok(text(hero).includes('הרשאות צפיית הורים במצלמות.')); assert.ok(text(hero).includes('ניהול שקוף של מי מורשה לצפות באיזו מצלמה, לאיזה גן, באיזה תוקף ובאיזה סטטוס Gateway.')); assert.equal(nodes(hero, 'Link')[0].props.href, '/dashboard/admin/cameras'); assert.equal(text(nodes(hero, 'Link')[0]), 'ניהול מצלמות');
  assert.equal(nodes(tree, 'input')[0].props.placeholder, 'חיפוש הורה / גן / מצלמה'); assert.deepEqual(nodes(tree, 'option').map(text), ['כל הסטטוסים', 'מורשה', 'חסום', 'פג תוקף']);
  const unknown = !['healthy', 'empty', 'null'].includes(mode); assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), unknown);
  assert.ok(!JSON.stringify(tree).includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_')); assert.ok(!body.includes('NEVER_DISPLAY_PHONE'));
  if (unknown) { assert.equal(cards.length, 0); assert.equal(links.length, 1); assert.ok(body.includes('נתוני הרשאות המצלמה אינם זמינים')); assert.ok(!body.includes('אין הרשאות מצלמה עדיין')); assert.ok(!body.includes('הוספת מצלמה והרשאות')); assert.ok(!body.includes('SYNTHETIC_')); assert.equal(nodes(tree, 'span').filter(n => ['pill good', 'pill bad', 'pill warn'].includes(n.props.className)).length, 0); assert.equal(logs.length, 1); assert.equal(logs[0][1], 'camera permissions'); }
  else {
    const expected = ['empty', 'null'].includes(mode) ? [] : rows; assert.equal(cards.length, expected.length); assert.equal(links.length, expected.length ? 1 + expected.length : 2); assert.deepEqual(logs, []);
    if (!expected.length) { assert.ok(body.includes('אין הרשאות מצלמה עדיין')); assert.ok(body.includes('לאחר שמנהלת או אדמין יגדירו צפיית הורים במצלמה, הרשאות התוקף והסיבה יוצגו כאן.')); assert.equal(text(links[1]), 'הוספת מצלמה והרשאות'); assert.equal(links[1].props.href, '/dashboard/admin/cameras'); }
    for (const [i, value] of expected.entries()) {
      const card = cards[i], badges = nodes(card, 'span'); assert.equal(card.key, value.id); assert.equal(badges[0].props.className, value.allowed ? 'pill good' : 'pill bad'); assert.equal(text(badges[0]), value.allowed ? 'מורשה' : 'חסום');
      assert.equal(text(nodes(card, 'h3')[0]), `${value.parents?.full_name ?? 'הורה'} · ${value.camera_streams?.name ?? 'מצלמה'}`); assert.equal(text(nodes(card, 'p')[0]), `${value.gardens?.name ?? 'גן'} · ${value.camera_streams?.area ?? 'אזור'} · ${value.reason ?? 'ללא הערה'}`); assert.equal(text(nodes(card, 'small')[0]), `תוקף: ${value.valid_until ? new Date(value.valid_until).toLocaleDateString('he-IL') : 'ללא תאריך סיום'}`);
      assert.equal(badges[1].props.className, value.camera_streams?.status === 'connected' ? 'pill good' : 'pill warn'); assert.equal(text(badges[1]), String(value.camera_streams?.status ?? 'pending_gateway')); assert.equal(nodes(card, 'Link')[0].props.href, `/dashboard/admin/gardens/${value.garden_id}`);
    }
  }
  assert.equal(effects, 0); return {tree, cards};
}
for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'reject', 'factory', 'chain', 'reject-null', 'reject-false', 'loader', 'denied']) test(`actual page/helper ${mode}`, () => render(mode));
for (const allowed of [true, false, null, undefined, 0, 1, '', 'false']) test(`unchanged allowed truthiness ${typeof allowed}:${String(allowed)}`, () => render('healthy', [row({allowed})]));
for (const status of ['connected', 'CONNECTED', 'disconnected', null, undefined, '', 0]) test(`unchanged status display ${String(status)}`, () => render('healthy', [row({camera_streams: {name: 'SYNTHETIC_CAMERA', status}})]));
for (const value of [null, undefined, '', 0]) test(`unchanged nullish labels/reason ${String(value)}`, () => render('healthy', [row({parents: {full_name: value}, camera_streams: {name: value, area: value}, gardens: {name: value}, reason: value})]));
for (const valid_until of [null, undefined, '', 0, '2000-01-01T12:00:00Z', '2099-01-01T12:00:00Z']) test(`unchanged date presentation not expiry policy ${String(valid_until)}`, () => render('healthy', [row({allowed: true, valid_until})]));
test('missing relations retain legitimate labels', () => render('healthy', [row({parents: null, camera_streams: null, gardens: null})]));
test('failed stale invalid date and identity never reach render', () => render('error-stale', [row({valid_until: 'INVALID_DATE'})]));
test('phone remains projected but not read or displayed', () => { const parent = {full_name: 'SYNTHETIC_PARENT', get phone() { throw Error('PHONE_READ_FORBIDDEN'); }}; return render('healthy', [row({parents: parent})]); });
test('raw server order/duplicate keys and 81 rows not locally clamped', async () => { const rows = Array.from({length: 81}, (_, i) => row({id: 'SYNTHETIC_DUPLICATE', reason: `SYNTHETIC_ORDER_${80-i}`})); const result = await render('healthy', rows); assert.equal(result.cards.length, 81); assert.deepEqual(result.cards.map(n => text(nodes(n, 'p')[0])), rows.map(x => `SYNTHETIC_GARDEN_NAME · SYNTHETIC_AREA · ${x.reason}`)); });
test('single portable hook and auth-before-loader', () => { assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData(')); assert.ok(source.includes('available: false')); const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url))); assert.deepEqual(config.domain.filter(x => x.name === 'camera-permissions-query-boundary'), [{name: 'camera-permissions-query-boundary', args: ['--test', 'scripts/qa/check-camera-permissions-query-boundary.mjs']}]); });
