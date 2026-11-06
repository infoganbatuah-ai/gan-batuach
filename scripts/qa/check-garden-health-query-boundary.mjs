import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// SYNTHETIC medical fixtures only. Actual editor/actions/client modules NEVER execute.
const root = process.cwd(), ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/health/page.tsx';
function read(file) { const full = path.join(root, file); assert.equal(Number(execFileSync('/usr/bin/stat', ['-f', '%f', full], { encoding: 'utf8' }).trim()) & 0x40000000, 0); return fs.readFileSync(full, 'utf8'); }
function parse(text, file = 'module.ts') { return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function walk(n, fn) { fn(n); ts.forEachChild(n, (child) => walk(child, fn)); }
function shape(n) { const children = []; ts.forEachChild(n, (c) => { children.push(shape(c)); }); return [n.kind, ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? n.text : null, children]; }
const safeAst = parse(read('lib/admin-safe.ts')), safeNames = ['safeAdminData', 'logSupabaseError'];
const safeNodes = safeAst.statements.filter((n) => ts.isFunctionDeclaration(n) && safeNames.includes(n.name?.text));
assert.deepEqual(safeNodes.map((n) => n.name.text), safeNames); assert.equal(safeNodes.length, 2);
for (const n of safeNodes) walk(n, (node) => { assert(!ts.isImportDeclaration(node)); if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval', 'createClient'].includes(node.text)); });
const source = read(pageFile), pageAst = parse(source, pageFile);
const compile = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const safeJs = compile(safeNodes.map((n) => n.getText(safeAst)).join('\n'), 'safe-only.ts'), pageJs = compile(source, pageFile);
const names = ['children', 'child_health_records'];
const healthyChildren = Array.from({ length: 10 }, (_, i) => ({ id: `SYNTHETIC_CHILD_ID_${i}`, full_name: `SYNTHETIC_CHILD_NAME_${i}`, photo_url: i === 0 ? 'SYNTHETIC_AVATAR_LABEL' : null, hmo: i === 0 || i === 2 || i === 3 ? 'SYNTHETIC_HMO' : null, allergies: i === 0 || i === 2 ? 'SYNTHETIC_ALLERGY' : null, sensitivities: i === 1 ? 'SYNTHETIC_SENSITIVITY' : null, regular_medications: [0, 3, 4].includes(i) ? 'SYNTHETIC_MEDICATION' : null, medical_notes: null }));
const healthyRecords = [{ id: 'SYNTHETIC_RECORD_1', child_id: 'SYNTHETIC_CHILD_ID_0', notes: 'SYNTHETIC_RECORD_NOTE' }, { id: 'SYNTHETIC_RECORD_2', child_id: 'SYNTHETIC_CHILD_ID_1' }];
const healthy = [healthyChildren, healthyRecords];
let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) { const module = { exports: {} }; vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; forbidden++; throw Error('FORBIDDEN_MODULE'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }); return module.exports; }
function nodes(tree, type) { const out = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) out.push(n); visit(n.props?.children); } } visit(tree); return out; }
function text(n) { if (Array.isArray(n)) return n.map(text).join(' '); if (n && typeof n === 'object') return [n.props?.title, n.props?.text, n.props?.message, n.props?.subtitle, n.props?.hint, n.props?.value, n.props?.meta, text(n.props?.children)].filter((v) => v !== undefined).join(' '); return typeof n === 'string' || typeof n === 'number' ? String(n) : ''; }
async function run(config = {}) {
  pageCalls++; const logs = [], queries = [], captured = []; let clients = 0;
  const actual = evaluate(safeJs, {}, { console: { warn(...args) { logs.push(args); } } });
  const safe = { logSupabaseError: actual.logSupabaseError, safeAdminData(label, loader, fallback) { return actual.safeAdminData(label, async () => { const data = await loader(); captured.push(data); return data; }, fallback); } };
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
          const stale = method === 'error-empty' ? [] : [{ id: 'STALE', full_name: 'STALE', allergies: 'STALE', sensitivities: 'STALE', regular_medications: 'STALE', medical_notes: 'STALE' }];
          return Promise.resolve({ data: failed.has(index) ? stale : payload[index], error: failed.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'in', 'order'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherActionTile', 'TeacherAiInsight', 'TeacherAppFrame', 'TeacherCompactItem', 'TeacherCompactList', 'TeacherEmptyState', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': Object.fromEntries(['AlertTriangle', 'Baby', 'FileText', 'HeartPulse', 'ShieldCheck'].map((n) => [n, n])), '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' }, '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui, '@/components/health-medicine-manager': { HealthMedicineManager: 'HealthMedicineManager_OPAQUE' }, '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } }, '@/lib/supabase/server': sdk, '@/lib/admin-safe': safe };
  const page = evaluate(pageJs, imports).default;
  if (config.denied) { await assert.rejects(page, (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); return { denied: true, managerCount: 0 }; }
  const tree = await page(), scoped = Boolean(profile.garden_id) && !config.clientThrow, available = names.map((_, i) => scoped && !failed.has(i));
  assert.equal(clients, profile.garden_id ? 1 : 0); assert.equal(queries.length, scoped ? 2 : 0);
  for (const q of queries) { if (failed.has(names.indexOf(q.table)) && method === 'builder') continue; assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'garden_id' && s[2] === 'garden-qa')); }
  const cards = nodes(tree, 'TeacherStatCard'), managers = nodes(tree, 'HealthMedicineManager_OPAQUE');
  if (!profile.garden_id) { assert.equal(cards.length, 0); assert.equal(managers.length, 0); assert.equal(nodes(tree, 'TeacherEmptyState').length, 0); assert.equal(nodes(tree, 'TeacherAiInsight').length, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); return { clients, queries: 0, managerCount: 0 }; }
  const children = available[0] ? payload[0] ?? [] : [], records = available[1] ? payload[1] ?? [] : [];
  if (scoped) { assert.equal(captured.length, 1); assert.equal(JSON.stringify(captured[0].children), JSON.stringify(children)); assert.equal(JSON.stringify(captured[0].records), JSON.stringify(records)); } else assert.equal(captured.length, 0);
  const allergies = children.filter((c) => c.allergies || c.sensitivities), medications = children.filter((c) => c.regular_medications), missing = children.filter((c) => !c.hmo && !c.medical_notes && !c.allergies);
  assert.equal(cards.length, 4); const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props]));
  for (const [title, count, tone] of [['ילדים פעילים', children.length, 'purple'], ['אלרגיות/רגישויות', allergies.length, allergies.length ? 'red' : 'green'], ['תרופות קבועות', medications.length, medications.length ? 'orange' : 'blue']]) { assert.equal(stats[title].value, available[0] ? count : 'לא זמין'); assert.equal(stats[title].tone, available[0] ? tone : 'neutral'); }
  assert.equal(stats['רשומות'].value, available[1] ? records.length : 'לא זמין'); assert.equal(stats['רשומות'].tone, available[1] ? 'green' : 'neutral');
  const attention = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'ילדים שדורשים תשומת לב'), rows = nodes(attention, 'TeacherCompactItem'), expectedAttention = [...allergies, ...medications].slice(0, 6);
  assert.deepEqual(rows.map((n) => n.props.title), expectedAttention.map((c) => c.full_name));
  for (let i = 0; i < rows.length; i++) { const p = rows[i].props, c = expectedAttention[i]; assert.equal(p.subtitle, `${c.allergies ? `אלרגיות: ${c.allergies}` : 'אין אלרגיה רשומה'} · ${c.regular_medications ? 'תרופה קבועה' : 'ללא תרופה קבועה'}`); assert.equal(p.tone, c.allergies ? 'red' : 'orange'); assert.equal(p.avatar, c.photo_url); assert.equal(p.meta, 'בדיקה'); assert.equal(p.href, `/dashboard/garden/children/${c.id}`); }
  if (!available[0]) { assert(text(attention).includes('לא זמי')); assert(!text(attention).includes('אין התראות רפואיות פתוחות')); } else if (!expectedAttention.length) assert(text(attention).includes('אין התראות רפואיות פתוחות'));
  const missingSection = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'פרטים חסרים');
  if (!available[0]) { assert(missingSection); assert.equal(nodes(missingSection, 'TeacherCompactItem').length, 0); assert(text(missingSection).includes('לא ניתן')); }
  else if (!missing.length) assert.equal(missingSection, undefined);
  else { const mr = nodes(missingSection, 'TeacherCompactItem'); assert.deepEqual(mr.map((n) => n.props.title), missing.slice(0, 4).map((c) => c.full_name)); for (let i = 0; i < mr.length; i++) { const p = mr[i].props, c = missing[i]; assert.equal(p.subtitle, 'חסר מידע רפואי בסיסי בכרטיס הילד'); assert.equal(p.tone, 'orange'); assert.equal(p.avatar, c.photo_url); assert.equal(p.href, `/dashboard/garden/children/${c.id}`); assert.equal(p.meta, 'חסר'); } }
  const both = available[0] && available[1]; assert.equal(managers.length, both ? 1 : 0);
  if (both) { const p = managers[0].props; assert.equal(p.gardenId, 'garden-qa'); assert.equal(JSON.stringify(p.children), JSON.stringify(payload[0] ?? [])); assert.equal(JSON.stringify(p.records), JSON.stringify(payload[1] ?? [])); }
  else { const details = nodes(tree, 'details').find((n) => n.props.id === 'health-manager'); assert(details); assert(text(details).includes('ניהול הבריאות לא זמין')); }
  if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message);
  assert(!text(tree).includes('STALE')); assert(!JSON.stringify(logs).includes('PRIVATE_')); assert(!JSON.stringify(logs).includes('SYNTHETIC_'));
  assert.equal(nodes(tree, 'TeacherActionTile').length, 3); assert.equal(nodes(tree, 'TeacherAppFrame')[0].props.title, 'בוקר טוב, Owner'); assert.equal(nodes(tree, 'DashboardShell')[0].props.role, 'manager'); assert(text(nodes(tree, 'TeacherAiInsight')).includes('אין חשיפה ציבורית'));
  return { clients, queries: queries.length, childrenAvailable: available[0], recordsAvailable: available[1], managerCount: managers.length };
}
async function test(id, config = {}) { const result = await run(config); results.push({ id, status: 'PASS', ...result }); }
const start = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("children" as any).select("id, full_name, photo_url, hmo, allergies, sensitivities, regular_medications, medical_notes").eq("garden_id", gardenId).in("status", ["active", "approved"]).order("full_name")',
    'supabase.from("child_health_records" as any).select("*").eq("garden_id", gardenId)'
  ], filters = {};
  walk(pageAst, (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['order', 'eq'].includes(n.expression.name.text) && !(ts.isPropertyAccessExpression(n.parent) && ts.isCallExpression(n.parent.parent))) chains.push(shape(n));
    if (ts.isVariableDeclaration(n) && ['allergies', 'medications', 'missing'].includes(n.name.getText(pageAst))) filters[n.name.getText(pageAst)] = shape(n.initializer);
  });
  assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  for (const [name, expression] of [['allergies', 'children.filter((child) => child.allergies || child.sensitivities)'], ['medications', 'children.filter((child) => child.regular_medications)'], ['missing', 'children.filter((child) => !child.hmo && !child.medical_notes && !child.allergies)']]) assert.deepEqual(filters[name], shape(parse(expression).statements[0].expression));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!gardenId)') < source.indexOf('await createClient()')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 3);
  const originalConcat = [...healthyChildren.filter((c) => c.allergies || c.sensitivities), ...healthyChildren.filter((c) => c.regular_medications)].slice(0, 6); assert.equal(originalConcat.filter((c) => c.id === 'SYNTHETIC_CHILD_ID_0').length, 2); assert(healthyChildren.filter((c) => !c.hmo && !c.medical_notes && !c.allergies).some((c) => c.id === 'SYNTHETIC_CHILD_ID_1'));
  results.push({ id: 'static-two-whole-chains-original-three-predicates-admission-safe-pure', status: 'PASS', safeFunctions: safeNames, actualEditorExecuted: false });
  await test('healthy-manager'); await test('healthy-owner', { role: 'owner' }); await test('healthy-empty', { payload: [[], []] }); await test('healthy-null', { payload: [null, null] });
  for (let i = 0; i < 2; i++) for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`${names[i]}-${method}`, { fail: [i], method });
  for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`both-failed-${method}`, { fail: [0, 1], method });
  await test('client-throw', { clientThrow: true }); await test('missing-null', { garden: null }); await test('missing-empty', { garden: '' }); await test('denied-role', { denied: true });
  await test('healthy-children-no-alerts', { payload: [[{ id: 'SYNTHETIC_CLEAR_ID', full_name: 'SYNTHETIC_CLEAR_NAME', hmo: 'SYNTHETIC_HMO', allergies: null, sensitivities: null, regular_medications: null, medical_notes: null }], healthyRecords] });
  await test('healthy-children-empty-records', { payload: [healthyChildren, []] }); await test('healthy-empty-children-records-retained', { payload: [[], healthyRecords] });
  for (const method of ['error', 'error-empty', 'reject', 'builder']) { await test(`children-failed-healthy-empty-records-${method}`, { fail: [0], method, payload: [healthyChildren, []] }); await test(`records-failed-healthy-empty-children-${method}`, { fail: [1], method, payload: [[], healthyRecords] }); }
  assert.equal(forbidden, 0); console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - start, safeFunctions: safeNames, actualEditorExecuted: false, medicalData: 'SYNTHETIC_ONLY', results, limitations: 'Actual page/safe functions + opaque HealthMedicineManager/UI/closed SDKAuth only; not browser/full-stack/RLS/medical/privacy/safety compliance proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
