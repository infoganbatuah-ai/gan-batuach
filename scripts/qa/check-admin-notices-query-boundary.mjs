import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Actual page/helper; disconnected synthetic fixtures only. No send/publication.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/notices/page.tsx', import.meta.url));
const compile = value => {
  const result = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal(result.diagnostics.length, 0); return result.outputText;
};
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
function load(code, require, warn) {
  const exports = {};
  const denied = () => { throw Error('UNEXPECTED_SIDE_EFFECT'); };
  vm.runInNewContext(code, {exports, require, process: {env: {}}, fetch: denied, FormData: denied, console: {warn}});
  return exports;
}
const fixture = table => ({id: `SYNTHETIC_${table}_ID`, title: `SYNTHETIC_${table}_TITLE`, body: 'UNUSED_BODY_CANARY',
  starts_at: '2026-11-05T01:00:00.000Z', ends_at: '2000-01-01T00:00:00.000Z', audience: 'UNUSED_AUDIENCE_CANARY',
  scheduled_for: '2026-11-05T02:00:00.000Z', recipient_role: 'SYNTHETIC_ROLE', status: 'SYNTHETIC_STATUS'});
const failure = mode => mode.startsWith('error-') || ['query-reject', 'factory-throws', 'chain-throws'].includes(mode);
const expectedCalls = table => [['from', table], ['select', table === 'campaigns' ? 'id, title, body, audience, starts_at, ends_at, created_at' : 'id, title, body, recipient_role, status, severity, scheduled_for, sent_at, read_at'], ['order', 'created_at', {ascending: false}], ['limit', table === 'campaigns' ? 30 : 50]];
async function render(modes = {}, supplied = {}, outer = 'healthy') {
  let admissions = 0, clients = 0;
  const calls = {campaigns: [], notifications: []}, logs = [];
  const warn = (...args) => logs.push(args);
  const safe = load(helperCode, id => { throw Error(`UNEXPECTED_HELPER_IMPORT ${id}`); }, warn);
  const client = {from(table) {
    assert.ok(['campaigns', 'notifications'].includes(table)); const mode = modes[table] ?? 'healthy';
    calls[table].push(['from', table]);
    if (mode === 'factory-throws') throw Error('PRIVATE_FACTORY');
    const q = {};
    for (const method of ['select', 'order', 'limit']) q[method] = (...args) => {
      calls[table].push([method, ...args]); if (mode === 'chain-throws') throw Error('PRIVATE_CHAIN'); return q;
    };
    q.then = (resolve, reject) => (mode === 'query-reject' ? Promise.reject(Error('PRIVATE_QUERY')) : Promise.resolve({
      data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : supplied[table] ?? [fixture(table)],
      error: mode.startsWith('error-') ? {message: 'PRIVATE_ERROR', details: 'PRIVATE_DETAILS'} : null,
    })).then(resolve, reject);
    return q;
  }};
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx, Fragment: 'Fragment'};
    if (id === 'lucide-react') return {Megaphone: 'Megaphone', Siren: 'Siren', Users: 'Users'};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return {requireRole: async roles => {
      assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++;
      if (outer === 'denied') throw Error('DENIED');
    }};
    if (id === '@/lib/supabase/server') return {createClient: async () => {
      assert.equal(admissions, 1); clients++; if (outer === 'loader-throws') throw Error('PRIVATE_LOADER'); return client;
    }};
    throw Error(`UNEXPECTED_IMPORT ${id}`);
  }, warn);
  if (outer === 'denied') {
    await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.deepEqual(calls, {campaigns: [], notifications: []}); assert.deepEqual(logs, []); return null;
  }
  const tree = await page.default();
  assert.equal(clients, 1);
  const shell = nodes(tree, 'DashboardShell')[0]; assert.equal(shell.props.role, 'admin'); assert.equal(shell.props.title, 'הודעות וקמפיינים');
  const articles = nodes(tree, 'article'); assert.equal(articles.length, 5);
  const cards = articles.slice(0, 3);
  assert.deepEqual(cards.map(card => text(nodes(card, 'h2')[0])), ['הודעה ארצית', 'התראת חירום', 'קהלים']);
  assert.equal(nodes(cards[0], 'Megaphone').length, 1); assert.equal(nodes(cards[1], 'Siren').length, 1); assert.equal(nodes(cards[2], 'Users').length, 1);
  assert.deepEqual(cards.map(card => text(nodes(card, 'span')[0])), ['דרך API מאובטח', 'גבוה', 'RBAC']);
  const hero = nodes(tree, 'div').find(item => item.props.className === 'dashboard-hero-card admin-hero-card');
  const pill = nodes(hero, 'span')[0];
  const panels = {campaigns: articles[3], notifications: articles[4]};
  const body = text(tree); assert.ok(!body.includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  assert.ok(!body.includes('UNUSED_')); assert.equal(nodes(tree, 'form').length, 0); assert.equal(nodes(tree, 'button').length, 0);
  const bothUnknown = outer === 'loader-throws';
  const unavailable = table => bothUnknown || failure(modes[table] ?? 'healthy');
  assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), ['campaigns', 'notifications'].some(unavailable));
  for (const table of ['campaigns', 'notifications']) {
    const panel = panels[table], items = nodes(panel, 'div').filter(item => item.props.className === 'list-item');
    const unknown = unavailable(table), mode = modes[table] ?? 'healthy';
    if (bothUnknown) assert.deepEqual(calls[table], []);
    else if (!['factory-throws', 'chain-throws'].includes(mode)) assert.deepEqual(plain(calls[table]), expectedCalls(table));
    if (unknown) {
      assert.equal(items.length, 0); assert.ok(text(panel).includes('אינם זמינים כרגע'));
      assert.ok(!text(panel).includes(table === 'campaigns' ? 'אין קמפיינים פעילים' : 'אין התראות שנשלחו'));
      assert.ok(!text(panel).includes('SYNTHETIC_'));
    } else if (['empty', 'null'].includes(mode) || supplied[table]?.length === 0) {
      assert.equal(items.length, 0); assert.ok(text(panel).includes(table === 'campaigns' ? 'אין קמפיינים פעילים' : 'אין התראות שנשלחו'));
    } else {
      assert.equal(items.length, supplied[table]?.length ?? 1); assert.ok(!text(panel).includes('אינם זמינים'));
    }
  }
  if (unavailable('notifications')) { assert.equal(pill.props.className, 'pill'); assert.equal(text(pill), 'נתוני ההתראות אינם זמינים'); }
  else {
    const count = ['empty', 'null'].includes(modes.notifications) ? 0 : supplied.notifications?.length ?? 1;
    assert.equal(pill.props.className, 'pill good'); assert.equal(text(pill), `${count} התראות אחרונות`);
  }
  const failed = ['campaigns', 'notifications'].filter(table => failure(modes[table] ?? 'healthy'));
  assert.equal(logs.length, bothUnknown ? 1 : failed.length);
  if (bothUnknown) assert.deepEqual(plain(logs[0]), ['Admin page data unavailable:', 'admin notices']);
  else assert.deepEqual(plain(logs.map(args => args[1])).sort(), failed.map(table => `admin notices ${table}`).sort());
  return {tree, panels, pill, calls: plain(calls), logs: plain(logs)};
}
for (const table of ['campaigns', 'notifications']) {
  for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'query-reject', 'factory-throws', 'chain-throws']) {
    test(`${table}: ${mode} preserves independent healthy neighbor`, () => render({[table]: mode}, {[table]: [{...fixture(table), ...(mode === 'error-stale' ? {starts_at: 'INVALID_DATE', scheduled_for: 'INVALID_DATE'} : {})}]}));
  }
  for (const neighbor of ['empty', 'null']) {
    test(`${table}: rejected source preserves known ${neighbor} neighbor`, () => render({[table]: 'query-reject', [table === 'campaigns' ? 'notifications' : 'campaigns']: neighbor}));
  }
}
for (const [campaigns, notifications] of [['error-stale', 'query-reject'], ['factory-throws', 'chain-throws'], ['empty', 'null'], ['null', 'empty']]) {
  test(`paired ${campaigns}/${notifications}`, () => render({campaigns, notifications}));
}
for (const outer of ['loader-throws', 'denied']) test(`outer ${outer}`, () => render({}, {}, outer));
for (const value of [null, undefined, 0, '', '2026-11-05T03:00:00.000Z']) {
  test(`original truthy date rendering ${String(value)}`, async () => {
    const r = await render({}, {campaigns: [{...fixture('campaigns'), starts_at: value}], notifications: [{...fixture('notifications'), scheduled_for: value}]});
    const expected = value ? new Date(value).toLocaleString('he-IL') : '';
    assert.equal(text(nodes(r.panels.campaigns, 'span')[0]), expected);
    assert.equal(text(nodes(r.panels.notifications, 'span')[0]), `SYNTHETIC_ROLE · ${expected}`);
  });
}
for (const value of [null, undefined, 0, '', 'parent']) {
  test(`recipient nullish fallback preserves ${String(value)}`, async () => {
    const r = await render({}, {notifications: [{...fixture('notifications'), recipient_role: value, scheduled_for: null}]});
    assert.equal(text(nodes(r.panels.notifications, 'span')[0]), `${value ?? 'כללי'} · `);
  });
}
test('server order, duplicate keys and metadata status retained without local clamp/filter', async () => {
  const campaigns = Array.from({length: 31}, (_, i) => ({...fixture('campaigns'), id: 'SYNTHETIC_DUPLICATE', title: `SYNTHETIC_CAMPAIGN_${i}`}));
  const notifications = Array.from({length: 51}, (_, i) => ({...fixture('notifications'), id: 'SYNTHETIC_DUPLICATE', title: `SYNTHETIC_NOTICE_${i}`, status: i % 2 ? 'sent' : ''}));
  const r = await render({}, {campaigns, notifications});
  for (const [table, rows] of Object.entries({campaigns, notifications})) assert.deepEqual(nodes(r.panels[table], 'strong').map(text), rows.map(item => item.title));
  assert.equal(text(r.pill), '51 התראות אחרונות');
});
test('exact role admission, one local catch per query, two original chains and one DOMAIN hook', () => {
  assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData('));
  assert.equal((source.match(/supabase\.from\(/g) ?? []).length, 2);
  assert.ok(source.includes('campaignsAvailable: false, notificationsAvailable: false'));
  assert.ok(source.includes('return { data: error ? null : data, available: !error }'));
  const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url)));
  assert.deepEqual(config.domain.filter(item => item.name === 'admin-notices-query-boundary'), [{name: 'admin-notices-query-boundary', args: ['--test', 'scripts/qa/check-admin-notices-query-boundary.mjs']}]);
});
