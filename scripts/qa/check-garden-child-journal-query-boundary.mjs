import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Actual page + selected pure helpers only; manager/filter/UI opaque, SDK/Auth closed.
const root = process.cwd(), ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/child-journal/page.tsx';
function read(file) { const p = path.join(root, file); assert.equal(Number(execFileSync('/usr/bin/stat', ['-f', '%f', p], { encoding: 'utf8' }).trim()) & 0x40000000, 0); return fs.readFileSync(p, 'utf8'); }
function parse(source, file = 'pure.ts') { return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function walk(n, fn) { fn(n); ts.forEachChild(n, (c) => walk(c, fn)); }
function shape(n) { const children = []; ts.forEachChild(n, (c) => { children.push(shape(c)); }); return [n.kind, ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? n.text : null, children]; }
const selected = [];
function extract(file, names) {
  const sf = parse(read(file)), declarations = sf.statements.filter((n) => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  assert.deepEqual(declarations.map((n) => n.name.text), names);
  for (const n of declarations) walk(n, (node) => { assert(!ts.isImportDeclaration(node)); if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval', 'createClient'].includes(node.text)); });
  selected.push({ file, functions: names }); return declarations.map((n) => n.getText(sf)).join('\n');
}
const pureSource = extract('lib/domain/israel-date.ts', ['israelTodayDateKey']) + '\n' + extract('lib/admin-safe.ts', ['safeAdminData', 'logSupabaseError']);
assert.equal(selected.reduce((n, s) => n + s.functions.length, 0), 3);
const source = read(pageFile), ast = parse(source, pageFile);
const compile = (s, fileName) => ts.transpileModule(s, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const pureJs = compile(pureSource, 'pure.ts'), pageJs = compile(source, pageFile);
const names = ['children', 'child_daily_journals'];
const children = [3, 0, 5, 1, 4, 2].map((i) => ({ id: `SYNTHETIC_CHILD_${i}`, full_name: `SYNTHETIC_NAME_${i}`, photo_url: null, allergies: i % 2 ? null : 'SYNTHETIC_ALLERGY', regular_medications: null }));
const journals = [
  { id: 'SYNTHETIC_J0', child_id: 'SYNTHETIC_CHILD_0', meals: [{ label: 'SYNTHETIC_MEAL' }], sleep_summary: 'SYNTHETIC_SLEEP' },
  { id: 'SYNTHETIC_J1_FIRST', child_id: 'SYNTHETIC_CHILD_1', meals: [{}], sleep_summary: 'SYNTHETIC_OLD_SLEEP' },
  { id: 'SYNTHETIC_J2', child_id: 'SYNTHETIC_CHILD_2', meals: 'NOT_AN_ARRAY', sleep_summary: false },
  { id: 'SYNTHETIC_J3', child_id: 'SYNTHETIC_CHILD_3', meals: [], sleep_summary: '0' },
  { id: 'SYNTHETIC_J4', child_id: 'SYNTHETIC_CHILD_4', meals: [null], sleep_summary: 0 },
  { id: 'SYNTHETIC_J1_LAST', child_id: 'SYNTHETIC_CHILD_1', meals: [], sleep_summary: '' },
  { id: 'SYNTHETIC_UNRELATED_J', child_id: 'SYNTHETIC_UNKNOWN_CHILD', meals: [], sleep_summary: null }
];
const healthy = [children, journals]; let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) { const module = { exports: {} }; vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(n) { if (Object.hasOwn(imports, n)) return imports[n]; forbidden++; throw Error('CLOSED_IMPORT'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }); return module.exports; }
function nodes(tree, type) { const result = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) result.push(n); visit(n.props?.children); } } visit(tree); return result; }
function text(n) { if (Array.isArray(n)) return n.map(text).join(' '); if (n && typeof n === 'object') return [n.props?.title, n.props?.text, n.props?.message, n.props?.subtitle, n.props?.hint, n.props?.value, text(n.props?.children)].filter((v) => v !== undefined).join(' '); return typeof n === 'string' || typeof n === 'number' ? String(n) : ''; }
async function run(config = {}) {
  pageCalls++; const queries = [], captured = [], logs = []; let clients = 0, dateCalls = 0;
  const epoch = Date.parse(config.clock ?? '2026-11-05T22:30:00.000Z');
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [epoch])); } static now() { return epoch; } }
  const pure = evaluate(pureJs, {}, { Date: FixedDate, console: { warn(...args) { logs.push(args); } } });
  const safe = { logSupabaseError: pure.logSupabaseError, safeAdminData(label, loader, fallback) { return pure.safeAdminData(label, async () => { const data = await loader(); captured.push(data); return data; }, fallback); } };
  const fail = new Set(config.fail ?? []), method = config.method ?? 'error', payload = config.payload ?? healthy;
  const profile = { role: config.role ?? 'manager', garden_id: config.garden === undefined ? 'garden-qa' : config.garden, full_name: '[DEMO] Owner QA', profile_image_url: 'SYNTHETIC_AVATAR' }, denied = Error('DENIED');
  const sdk = { createClient: async () => {
    clients++; if (config.clientThrow) throw Error('PRIVATE_CLIENT');
    return { from(table) {
      const index = names.indexOf(table); assert(index >= 0); const q = { table, steps: [] }; queries.push(q);
      if (fail.has(index) && method === 'builder') throw Error('PRIVATE_BUILDER');
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          if (fail.has(index) && method === 'reject') return Promise.reject(Error('PRIVATE_REJECT')).then(resolve, reject);
          const stale = method === 'error-empty' ? [] : index === 0 ? [{ id: 'STALE', full_name: 'STALE', allergies: 'STALE' }] : [{ child_id: children[0].id, meals: ['STALE'], sleep_summary: 'STALE' }];
          return Promise.resolve({ data: fail.has(index) ? stale : payload[index], error: fail.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'in', 'order'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherAppFrame', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherActionTile', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid', 'TeacherEmptyState'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': Object.fromEntries(['Bell', 'BookOpenCheck', 'Moon', 'Utensils', 'UsersRound'].map((n) => [n, n])), '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui, '@/components/child-daily-journal-manager': { ChildDailyJournalManager: 'ChildDailyJournalManager_OPAQUE' }, '@/components/dashboard-filter-chip': { DashboardFilterChip: 'DashboardFilterChip_OPAQUE' }, '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } }, '@/lib/supabase/server': sdk, '@/lib/admin-safe': safe, '@/lib/domain/israel-date': { israelTodayDateKey() { dateCalls++; return pure.israelTodayDateKey(); } } };
  const page = evaluate(pageJs, imports, { Date: FixedDate }).default, args = { searchParams: Promise.resolve(config.filter === undefined ? {} : { missing: config.filter }) };
  if (config.denied) { await assert.rejects(() => page(args), (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); assert.equal(dateCalls, 0); return { denied: true, managerCount: 0 }; }
  const tree = await page(args), scoped = Boolean(profile.garden_id) && !config.clientThrow, available = names.map((_, i) => scoped && !fail.has(i)), both = available[0] && available[1];
  assert.equal(clients, profile.garden_id ? 1 : 0); assert.equal(queries.length, scoped ? 2 : 0);
  const today = config.expectedDate ?? '2026-11-06'; assert.equal(pure.israelTodayDateKey(), today);
  for (const q of queries) {
    if (fail.has(names.indexOf(q.table)) && method === 'builder') continue;
    assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'garden_id' && s[2] === 'garden-qa'));
    if (q.table === names[0]) { assert.equal(q.steps.find((s) => s[0] === 'select')[1], 'id, full_name, photo_url, allergies, regular_medications'); assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'in')), JSON.stringify(['in', 'status', ['active', 'approved']])); assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'order')), JSON.stringify(['order', 'full_name'])); }
    else assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'journal_date' && s[2] === today));
  }
  const manager = nodes(tree, 'ChildDailyJournalManager_OPAQUE'), chips = nodes(tree, 'DashboardFilterChip_OPAQUE'), cards = nodes(tree, 'TeacherStatCard');
  const frame = nodes(tree, 'TeacherAppFrame')[0]; assert.equal(frame.props.title, 'בוקר טוב, Owner'); assert.equal(frame.props.subtitle, 'יומן יומי לילדים'); assert.equal(frame.props.avatarUrl, 'SYNTHETIC_AVATAR'); assert.equal(frame.props.active, 'calendar');
  if (!profile.garden_id) { assert.equal(cards.length, 0); assert.equal(manager.length, 0); assert.equal(chips.length, 0); assert.equal(dateCalls, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); assert(!text(tree).includes('כל הילדים במסנן')); return { clients, queries: 0, managerCount: 0 }; }
  assert.equal(dateCalls, 1);
  const expectedChildren = available[0] ? payload[0] ?? [] : [], expectedJournals = available[1] ? payload[1] ?? [] : [];
  if (scoped) { assert.equal(captured.length, 1); assert.equal(JSON.stringify(captured[0].allChildren), JSON.stringify(expectedChildren)); assert.equal(JSON.stringify(captured[0].journals), JSON.stringify(expectedJournals)); } else assert.equal(captured.length, 0);
  const byChild = new Map(expectedJournals.map((j) => [j.child_id, j])), needsMeal = (c) => { const j = byChild.get(c.id); return !(Array.isArray(j?.meals) && j.meals.length > 0); }, needsSleep = (c) => !byChild.get(c.id)?.sleep_summary;
  const filteredAvailable = available[0] && (!['meal', 'sleep'].includes(config.filter) || available[1]);
  const expectedFiltered = filteredAvailable ? expectedChildren.filter((c) => config.filter === 'meal' ? needsMeal(c) : config.filter === 'sleep' ? needsSleep(c) : true) : [];
  const meal = both ? expectedChildren.filter(needsMeal).length : null, sleep = both ? expectedChildren.filter(needsSleep).length : null;
  const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props])); assert.equal(cards.length, 3);
  assert.equal(stats['ילדים'].value, filteredAvailable ? expectedFiltered.length : 'לא זמין'); assert.equal(stats['ילדים'].tone, filteredAvailable ? 'blue' : 'neutral'); assert.equal(stats['ילדים'].hint, 'לפי הסינון');
  assert.equal(stats['ללא ארוחה'].value, meal ?? 'לא זמין'); assert.equal(stats['ללא ארוחה'].tone, meal === null ? 'neutral' : meal ? 'orange' : 'green');
  assert.equal(stats['ללא שינה'].value, sleep ?? 'לא זמין'); assert.equal(stats['ללא שינה'].tone, sleep === null ? 'neutral' : sleep ? 'purple' : 'green');
  assert.equal(stats['ללא ארוחה'].hint, 'דורש עדכון'); assert.equal(stats['ללא שינה'].hint, 'דורש עדכון');
  assert.equal(chips.length, filteredAvailable ? 1 : 0);
  if (filteredAvailable) {
    const p = chips[0].props; assert.equal(p.label, config.filter === 'meal' ? 'ילדים ללא עדכון ארוחה' : config.filter === 'sleep' ? 'ילדים ללא עדכון שינה' : null); assert.equal(p.clearHref, '/dashboard/garden/child-journal'); assert.equal(p.isEmpty, expectedFiltered.length === 0);
    assert.equal(p.emptyTitle, config.filter === 'meal' ? 'אין כרגע ילדים ללא עדכון ארוחה' : config.filter === 'sleep' ? 'אין כרגע ילדים ללא עדכון שינה' : undefined); assert.equal(p.emptyText, 'כל הילדים במסנן הזה כבר קיבלו עדכון. אפשר לנקות סינון כדי לראות את כולם.');
  } else { assert(text(tree).includes('נתוני הסינון לא זמינים')); assert(!text(tree).includes('כל הילדים במסנן')); assert(!text(tree).includes('אין כרגע ילדים ללא עדכון')); }
  const section = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'עדכון יומי'); assert(section); assert.equal(section.props.subtitle, 'טופס מלא לכל ילד, עם שמירה למערכת הקיימת');
  assert.equal(manager.length, both ? 1 : 0);
  if (both) { const p = manager[0].props; assert.equal(p.gardenId, profile.garden_id); assert.equal(JSON.stringify(p.children), JSON.stringify(expectedFiltered)); assert.equal(JSON.stringify(p.journals), JSON.stringify(payload[1] ?? [])); }
  else assert(text(section).includes('יומן הילדים לא זמין'));
  const actions = nodes(tree, 'TeacherActionTile'); assert.equal(actions.length, 3); assert.deepEqual(actions.map((n) => n.props.href), ['/dashboard/garden/child-journal?missing=meal', '/dashboard/garden/child-journal?missing=sleep', '/dashboard/garden/messages?compose=1#message-workbench']); assert.deepEqual(actions.map((n) => n.props.title), ['ללא ארוחה', 'ללא שינה', 'הודעה להורים']);
  assert.equal(nodes(tree, 'TeacherPageTitle')[0].props.title, 'יומן ילד יומי');
  if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message);
  assert(!text(tree).includes('STALE')); assert(!JSON.stringify(logs).includes('PRIVATE_')); assert(!JSON.stringify(logs).includes('SYNTHETIC_'));
  if (config.expectedIds) assert.deepEqual(expectedFiltered.map((c) => c.id), config.expectedIds);
  if (config.expectedMissing !== undefined) { assert.equal(meal, config.expectedMissing[0]); assert.equal(sleep, config.expectedMissing[1]); }
  return { clients, queries: queries.length, childrenAvailable: available[0], journalsAvailable: available[1], filteredCount: filteredAvailable ? expectedFiltered.length : 'UNKNOWN', missingMeal: meal ?? 'UNKNOWN', missingSleep: sleep ?? 'UNKNOWN', managerCount: manager.length, chipCount: chips.length, dateKey: today };
}
async function test(id, config = {}) { results.push({ id, status: 'PASS', ...await run(config) }); }
const start = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("children" as any).select("id, full_name, photo_url, allergies, regular_medications").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name")',
    'supabase.from("child_daily_journals" as any).select("*").eq("garden_id", gardenId).eq("journal_date", today)'
  ];
  walk(ast, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['order', 'eq'].includes(n.expression.name.text) && !(ts.isPropertyAccessExpression(n.parent) && ts.isCallExpression(n.parent.parent))) chains.push(shape(n)); }); assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!profile.garden_id)') < source.indexOf('await createClient()')); assert(source.indexOf('if (!profile.garden_id)') < source.indexOf('const today = israelTodayDateKey()')); assert(source.includes('const params = await searchParams;')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 3);
  results.push({ id: 'static-two-whole-chains-admission-date-and-pure-boundaries', status: 'PASS', selected, managerAndFilterExecuted: false });
  await test('healthy-manager-map-last-duplicate-raw-truthiness', { expectedMissing: [4, 4] });
  await test('healthy-owner', { role: 'owner' });
  await test('healthy-meal-input-order', { filter: 'meal', expectedIds: ['SYNTHETIC_CHILD_3', 'SYNTHETIC_CHILD_5', 'SYNTHETIC_CHILD_1', 'SYNTHETIC_CHILD_2'] });
  await test('healthy-sleep-input-order', { filter: 'sleep', expectedIds: ['SYNTHETIC_CHILD_5', 'SYNTHETIC_CHILD_1', 'SYNTHETIC_CHILD_4', 'SYNTHETIC_CHILD_2'] });
  await test('unknown-filter-is-unfiltered', { filter: 'other' }); await test('empty-filter-is-unfiltered', { filter: '' });
  for (const filter of [undefined, 'meal', 'sleep']) {
    await test(`healthy-empty-${filter ?? 'all'}`, { filter, payload: [[], []] }); await test(`healthy-null-${filter ?? 'all'}`, { filter, payload: [null, null] });
    for (let i = 0; i < 2; i++) for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`${names[i]}-${method}-${filter ?? 'all'}`, { filter, fail: [i], method });
    for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`both-failed-${method}-${filter ?? 'all'}`, { filter, fail: [0, 1], method });
    await test(`client-throw-${filter ?? 'all'}`, { filter, clientThrow: true });
    await test(`missing-null-${filter ?? 'all'}`, { filter, garden: null }); await test(`missing-empty-${filter ?? 'all'}`, { filter, garden: '' });
    await test(`healthy-children-no-journals-${filter ?? 'all'}`, { filter, payload: [children, []], expectedMissing: [6, 6] });
    await test(`healthy-no-children-full-journals-${filter ?? 'all'}`, { filter, payload: [[], journals], expectedMissing: [0, 0] });
  }
  await test('denied-role', { denied: true });
  for (const method of ['error', 'error-empty', 'reject', 'builder']) for (const filter of [undefined, 'meal', 'sleep']) {
    await test(`failed-children-healthy-empty-journals-${method}-${filter ?? 'all'}`, { fail: [0], method, filter, payload: [children, []] });
    await test(`failed-journals-healthy-empty-children-${method}-${filter ?? 'all'}`, { fail: [1], method, filter, payload: [[], journals] });
  }
  const updated = children.map((c) => ({ child_id: c.id, meals: [false], sleep_summary: true }));
  for (const filter of ['meal', 'sleep']) await test(`healthy-all-updated-empty-filter-${filter}`, { filter, payload: [children, updated], expectedMissing: [0, 0], expectedIds: [] });
  await test('israel-before-midnight', { clock: '2026-11-05T21:59:00.000Z', expectedDate: '2026-11-05' }); await test('israel-after-midnight', { clock: '2026-11-05T22:01:00.000Z', expectedDate: '2026-11-06' });
  await test('failed-journals-unknown-filter-retains-child-count', { fail: [1], filter: 'other' });
  assert.equal(forbidden, 0); console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - start, selected, fixedClock: 'QA_ONLY_ISRAEL_MIDNIGHT', managerAndFilterExecuted: false, results, limitations: 'Actual page + 3 selected pure functions; OPAQUE manager/filter/UI, CLOSED SDK/Auth; no real child data/actions/writes/browser/fullstack/RLS/medical proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
