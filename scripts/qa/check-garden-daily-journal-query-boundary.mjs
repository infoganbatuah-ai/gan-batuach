import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Actual page/date/safe helpers, fixed QA clock, OPAQUE journal/UI and CLOSED SDK/Auth.
const root = process.cwd(), ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/daily-journal/page.tsx';
function read(file) {
  const full = path.join(root, file);
  assert.ok(fs.statSync(full).isFile(), 'source must be a regular file');
  if (process.platform === 'darwin') {
    const rawFlags = execFileSync('/usr/bin/stat', ['-f', '%f', full], { encoding: 'utf8' }).trim();
    assert.match(rawFlags, /^\d+$/, 'stat must return numeric file flags');
    const flags = Number(rawFlags);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0);
    assert.equal(flags & 0x40000000, 0, 'dataless source forbidden');
  }
  return fs.readFileSync(full, 'utf8');
}
function parse(text, file = 'module.ts') { return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function walk(n, fn) { fn(n); ts.forEachChild(n, (child) => walk(child, fn)); }
function shape(n) { const children = []; ts.forEachChild(n, (c) => { children.push(shape(c)); }); return [n.kind, ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateTail(n) ? n.text : null, children]; }
const selected = [];
function extract(file, names) {
  const sf = parse(read(file)), nodes = sf.statements.filter((n) => ts.isFunctionDeclaration(n) && names.includes(n.name?.text));
  assert.deepEqual(nodes.map((n) => n.name.text), names);
  for (const n of nodes) walk(n, (node) => { assert(!ts.isImportDeclaration(node)); if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval', 'createClient'].includes(node.text)); });
  selected.push({ file, functions: names }); return nodes.map((n) => n.getText(sf)).join('\n');
}
const pureSource = extract('lib/domain/israel-date.ts', ['israelTodayDateKey']) + '\n' + extract('lib/admin-safe.ts', ['safeAdminData', 'logSupabaseError']);
assert.equal(selected.reduce((n, s) => n + s.functions.length, 0), 3);
const source = read(pageFile), pageAst = parse(source, pageFile);
const compile = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const pureJs = compile(pureSource, 'pure.ts'), pageJs = compile(source, pageFile);
const names = ['daily_operational_tasks', 'daily_task_completions'];
const tasks = Array.from({ length: 10 }, (_, i) => ({ id: `SYNTHETIC_TASK_${i}`, title: i === 9 ? null : `משימה ${9 - i}`, description: i === 4 ? '' : i % 2 ? null : `SYNTHETIC_DESCRIPTION_${i}`, category: ['בוקר', 'אחר', null][i % 3], required: i % 2 === 0, active: true }));
const completions = [{ id: 'SYNTHETIC_COMPLETION_0', operational_task_id: tasks[0].id }, { id: 'SYNTHETIC_COMPLETION_1', operational_task_id: tasks[3].id }, { id: 'SYNTHETIC_EXTRANEOUS_COMPLETION', operational_task_id: 'SYNTHETIC_UNKNOWN_TASK' }, { id: 'SYNTHETIC_DUPLICATE_COMPLETION', operational_task_id: tasks[0].id }];
const healthy = [tasks, completions];
let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) { const module = { exports: {} }; vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; forbidden++; throw Error('FORBIDDEN_MODULE'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }); return module.exports; }
function nodes(tree, type) { const out = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) out.push(n); visit(n.props?.children); } } visit(tree); return out; }
function text(n) { if (Array.isArray(n)) return n.map(text).join(' '); if (n && typeof n === 'object') return [n.props?.title, n.props?.text, n.props?.message, n.props?.subtitle, n.props?.hint, n.props?.value, n.props?.meta, text(n.props?.children)].filter((v) => v !== undefined).join(' '); return typeof n === 'string' || typeof n === 'number' ? String(n) : ''; }
async function run(config = {}) {
  pageCalls++; const queries = [], logs = [], captured = []; let clients = 0, dateCalls = 0;
  const fixed = Date.parse(config.clock ?? '2026-11-05T22:30:00.000Z');
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }
  const pure = evaluate(pureJs, {}, { Date: FixedDate, console: { warn(...args) { logs.push(args); } } });
  const safe = { logSupabaseError: pure.logSupabaseError, safeAdminData(label, loader, fallback) { return pure.safeAdminData(label, async () => { const data = await loader(); captured.push(data); return data; }, fallback); } };
  const failed = new Set(config.fail ?? []), method = config.method ?? 'error', payload = config.payload ?? healthy;
  const profile = { role: config.role ?? 'manager', garden_id: config.garden === undefined ? 'garden-qa' : config.garden, full_name: '[DEMO] Owner QA', profile_image_url: null }, denied = Error('DENIED_ROLE');
  const sdk = { createClient: async () => {
    clients++; if (config.clientThrow) throw Error('PRIVATE_CLIENT');
    return { from(table) {
      const index = names.indexOf(table); assert(index >= 0); const q = { table, steps: [] }; queries.push(q);
      if (failed.has(index) && method === 'builder') throw Error('PRIVATE_BUILDER');
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          if (failed.has(index) && method === 'reject') return Promise.reject(Error('PRIVATE_REJECT')).then(resolve, reject);
          const stale = method === 'error-empty' ? [] : index === 0 ? [{ id: 'STALE', title: 'STALE', description: 'STALE', category: 'STALE', required: true }] : [{ id: 'STALE', operational_task_id: tasks[0].id }];
          return Promise.resolve({ data: failed.has(index) ? stale : payload[index], error: failed.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'or'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherActionTile', 'TeacherAppFrame', 'TeacherCompactItem', 'TeacherCompactList', 'TeacherEmptyState', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': Object.fromEntries(['CalendarDays', 'CheckCircle2', 'ClipboardCheck', 'Clock'].map((n) => [n, n])), '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' }, '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui, '@/components/daily-task-journal': { DailyTaskJournal: 'DailyTaskJournal_OPAQUE' }, '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } }, '@/lib/supabase/server': sdk, '@/lib/admin-safe': safe, '@/lib/domain/israel-date': { israelTodayDateKey() { dateCalls++; return pure.israelTodayDateKey(); } } };
  const page = evaluate(pageJs, imports, { Date: FixedDate }).default;
  const args = config.workbench === undefined ? {} : { searchParams: Promise.resolve({ workbench: config.workbench }) };
  if (config.denied) { await assert.rejects(() => page(args), (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); assert.equal(dateCalls, 0); return { denied: true, journalCount: 0 }; }
  const tree = await page(args), scoped = Boolean(profile.garden_id) && !config.clientThrow, available = names.map((_, i) => scoped && !failed.has(i));
  assert.equal(clients, profile.garden_id ? 1 : 0); assert.equal(queries.length, scoped ? 2 : 0);
  const today = config.expectedDate ?? '2026-11-06'; assert.equal(pure.israelTodayDateKey(), today);
  for (const q of queries) {
    if (failed.has(names.indexOf(q.table)) && method === 'builder') continue;
    if (q.table === names[0]) assert.equal(q.steps.find((s) => s[0] === 'or')[1], 'garden_id.is.null,garden_id.eq.garden-qa');
    else { assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'completed_for_date' && s[2] === today)); assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'garden_id' && s[2] === 'garden-qa')); }
  }
  const cards = nodes(tree, 'TeacherStatCard'), journals = nodes(tree, 'DailyTaskJournal_OPAQUE');
  if (!profile.garden_id) { assert.equal(cards.length, 0); assert.equal(journals.length, 0); assert.equal(nodes(tree, 'TeacherEmptyState').length, 0); assert.equal(dateCalls, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); return { clients, queries: 0, journalCount: 0 }; }
  assert.equal(dateCalls, 1);
  const expectedTasks = available[0] ? payload[0] ?? [] : [], expectedCompletions = available[1] ? payload[1] ?? [] : [], both = available[0] && available[1];
  if (scoped) { assert.equal(captured.length, 1); assert.equal(JSON.stringify(captured[0].tasks), JSON.stringify(expectedTasks)); assert.equal(JSON.stringify(captured[0].completions), JSON.stringify(expectedCompletions)); } else assert.equal(captured.length, 0);
  const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props])); assert.equal(cards.length, 4);
  assert.equal(stats['משימות היום'].value, available[0] ? expectedTasks.length : 'לא זמין'); assert.equal(stats['משימות היום'].tone, available[0] ? 'blue' : 'neutral');
  assert.equal(stats['הושלמו'].value, available[1] ? expectedCompletions.length : 'לא זמין'); assert.equal(stats['הושלמו'].tone, available[1] ? 'green' : 'neutral');
  const percent = expectedTasks.length ? Math.round((expectedCompletions.length / expectedTasks.length) * 100) : 0;
  assert.equal(stats['הושלמו'].hint, both ? `${percent}%` : 'אחוז ההשלמה לא זמין');
  assert.equal(stats['נותרו'].value, both ? Math.max(0, expectedTasks.length - expectedCompletions.length) : 'לא זמין'); assert.equal(stats['נותרו'].tone, !both ? 'neutral' : expectedTasks.length - expectedCompletions.length ? 'orange' : 'green');
  assert.equal(stats['שעה נוכחית'].value, new FixedDate().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })); assert.equal(stats['שעה נוכחית'].hint, 'שעת התצוגה'); assert(!text(tree).includes('גן פעיל'));
  const section = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'סדר יום'), rows = nodes(section, 'TeacherCompactItem');
  const ordered = [...expectedTasks].sort((a, b) => String(a.category ?? '').localeCompare(String(b.category ?? ''), 'he') || String(a.title ?? '').localeCompare(String(b.title ?? ''), 'he')).slice(0, 7), ids = new Set(expectedCompletions.map((c) => c.operational_task_id));
  assert.deepEqual(rows.map((n) => n.props.title), ordered.map((t) => t.title ?? 'משימה'));
  for (let i = 0; i < rows.length; i++) { const p = rows[i].props, t = ordered[i], done = ids.has(t.id); assert.equal(p.subtitle, t.description ?? t.category ?? 'משימת תפעול'); assert.equal(p.meta, !available[1] ? 'סטטוס לא זמין' : done ? 'הושלם' : t.required ? 'חובה' : 'רשות'); assert.equal(p.tone, !available[1] ? 'neutral' : done ? 'green' : t.required ? 'orange' : 'blue'); }
  if (!available[0]) { assert(text(section).includes('לא זמי')); assert(!text(section).includes('עדיין לא הוגדר סדר יום')); } else if (!ordered.length) assert(text(section).includes('עדיין לא הוגדר סדר יום'));
  const details = nodes(tree, 'details').find((n) => n.props.id === 'daily-journal-workbench'); assert(details); assert.equal(details.props.open, config.workbench === '1'); assert.equal(details.props.className, 'teacher-management-details');
  assert.equal(journals.length, both ? 1 : 0);
  if (both) { const p = journals[0].props; assert.equal(p.gardenId, profile.garden_id); assert.equal(JSON.stringify(p.tasks), JSON.stringify(payload[0] ?? [])); assert.equal(JSON.stringify(p.completions), JSON.stringify(payload[1] ?? [])); }
  else assert(text(details).includes('היומן המלא לא זמין'));
  const actions = nodes(tree, 'TeacherActionTile'); assert.equal(actions.length, 2); assert.equal(actions[0].props.href, '/dashboard/garden/daily-journal?workbench=1#daily-journal-workbench'); assert.equal(actions[1].props.href, '/dashboard/garden/attendance');
  if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message);
  assert(!text(tree).includes('STALE')); assert(!JSON.stringify(logs).includes('PRIVATE_')); assert(!JSON.stringify(logs).includes('SYNTHETIC_')); assert.equal(nodes(tree, 'DashboardShell')[0].props.role, profile.role); assert.equal(nodes(tree, 'TeacherAppFrame')[0].props.title, 'בוקר טוב, Owner');
  return { clients, queries: queries.length, tasksAvailable: available[0], completionsAvailable: available[1], percent: both ? percent : 'UNKNOWN', journalCount: journals.length, dateKey: today };
}
async function test(id, config = {}) { const result = await run(config); results.push({ id, status: 'PASS', ...result }); }
const start = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("daily_operational_tasks" as any).select("*").eq("active", true).or(`garden_id.is.null,garden_id.eq.${profile.garden_id}`)',
    'supabase.from("daily_task_completions" as any).select("*").eq("completed_for_date", today).eq("garden_id", profile.garden_id ?? "")'
  ];
  walk(pageAst, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['or', 'eq'].includes(n.expression.name.text) && !(ts.isPropertyAccessExpression(n.parent) && ts.isCallExpression(n.parent.parent))) chains.push(shape(n)); }); assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!profile.garden_id)') < source.indexOf('await createClient()')); assert(source.includes('searchParams ? await searchParams : {}')); assert(source.includes('const today = israelTodayDateKey();')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 3);
  results.push({ id: 'static-two-whole-chains-global-garden-OR-admission-date-pure', status: 'PASS', selected, actualJournalExecuted: false });
  await test('healthy-manager'); await test('healthy-owner-workbench1', { role: 'owner', workbench: '1' }); await test('healthy-empty', { payload: [[], []] }); await test('healthy-null', { payload: [null, null], workbench: '1' });
  for (let i = 0; i < 2; i++) for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`${names[i]}-${method}`, { fail: [i], method, workbench: '1' });
  for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`both-failed-${method}`, { fail: [0, 1], method });
  await test('client-throw', { clientThrow: true, workbench: '1' }); await test('missing-null', { garden: null }); await test('missing-empty', { garden: '' }); await test('denied-role', { denied: true });
  await test('zero-tasks-extraneous-completions-original-zero-percent', { payload: [[], completions] });
  await test('one-task-duplicate-extraneous-completions-above100', { payload: [[tasks[0]], completions] });
  await test('healthy-tasks-empty-completions', { payload: [tasks, []] });
  await test('israel-before-midnight-query-date', { clock: '2026-11-05T21:59:00.000Z', expectedDate: '2026-11-05' });
  await test('israel-after-midnight-query-date', { clock: '2026-11-05T22:01:00.000Z', expectedDate: '2026-11-06' });
  await test('workbench-other-value-stays-closed', { workbench: '0' });
  for (const method of ['error', 'error-empty', 'reject', 'builder']) { await test(`tasks-failed-healthy-empty-completions-${method}`, { fail: [0], method, payload: [tasks, []] }); await test(`completions-failed-healthy-empty-tasks-${method}`, { fail: [1], method, payload: [[], completions] }); }
  assert.equal(forbidden, 0); console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - start, selected, clock: 'FIXED_QA_ONLY_ISRAEL_MIDNIGHT_BOUNDARY', actualJournalExecuted: false, results, limitations: 'Actual page/pure date+safe helpers/opaque journalUI/closed SDKAuth; not live task completion/activity/browser/full-stack/RLS proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
