import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Actual page, selected pure helpers, opaque UI and closed SDK/Auth fixtures only.
const root = process.cwd(), ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/rating/page.tsx';
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
function shape(n) { const children = []; ts.forEachChild(n, (c) => { children.push(shape(c)); }); return [n.kind, ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? n.text : null, children]; }
function inert(n) { if (ts.isAsExpression(n)) return inert(n.expression); if (ts.isStringLiteral(n) || ts.isNumericLiteral(n)) return true; if (ts.isArrayLiteralExpression(n)) return n.elements.every(inert); return ts.isObjectLiteralExpression(n) && n.properties.every((p) => ts.isPropertyAssignment(p) && inert(p.initializer)); }
const selected = [];
function extract(file, functions, variables = []) {
  const sf = parse(read(file)), found = [], vars = [], nodes = [];
  for (const n of sf.statements) {
    if (ts.isFunctionDeclaration(n) && functions.includes(n.name?.text)) { found.push(n.name.text); nodes.push(n); }
    if (ts.isVariableStatement(n)) for (const d of n.declarationList.declarations) if (variables.includes(d.name.getText(sf))) { assert.equal(n.declarationList.declarations.length, 1); assert(inert(d.initializer)); vars.push(d.name.getText(sf)); nodes.push(n); }
  }
  assert.deepEqual(found, functions); assert.deepEqual(vars, variables);
  for (const n of nodes) walk(n, (node) => { assert(!ts.isImportDeclaration(node)); if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval', 'createClient'].includes(node.text)); });
  selected.push({ file, functions: found, variables: vars }); return nodes.map((n) => n.getText(sf)).join('\n');
}
const functions = ['ratingTone', 'ratingBandLabel', 'ratingTrendLabel', 'categoryScoreRows', 'cleanRatingReasons'];
const pureSource = extract('lib/domain/kindergarten-rating.ts', functions, ['ratingWeights', 'publicRatingBoundary']) + '\n' + extract('lib/admin-safe.ts', ['safeAdminData', 'logSupabaseError']);
assert.equal(selected.reduce((n, s) => n + s.functions.length, 0), 7); assert.equal(selected.reduce((n, s) => n + s.variables.length, 0), 2);
const source = read(pageFile), pageAst = parse(source, pageFile);
const compile = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const pureJs = compile(pureSource, 'pure.ts'), pageJs = compile(source, pageFile);
const names = ['kindergarten_rating_profiles', 'kindergarten_rating_history', 'kindergarten_rating_recommendations'];
const healthy = [
  { overall_score: 91, safety_score: 78, compliance_score: 62, inspection_score: 45, parent_satisfaction_score: 82, observer_score: 90, rating_band: 'strong', trend: 'improving', explanation: { why_score_decreased: [' reason-one ', '', null, 42, 'reason-two'], how_to_improve: ['improve-one', '  ', {}, 'improve-two'] }, gardens: { name: 'QA Garden' } },
  [{ id: 'history-row', overall_score: 72 }],
  Array.from({ length: 20 }, (_, i) => ({ id: `recommendation-${i}`, title: `recommendation-title-${i}`, explanation: `explanation-${i}`, impact_level: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low', status: 'open' }))
];
const defaults = { overall_score: 0, safety_score: 0, compliance_score: 0, inspection_score: 0, parent_satisfaction_score: 0, observer_score: 0, rating_band: 'new', trend: 'new', explanation: {}, gardens: {} };
const override = (values) => healthy.map((v, i) => Object.hasOwn(values, i) ? values[i] : v);
let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) { const module = { exports: {} }; vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; forbidden++; throw Error('UNAPPROVED_MODULE'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }); return module.exports; }
function nodes(tree, type) { const out = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) out.push(n); visit(n.props?.children); } } visit(tree); return out; }
function text(n) { if (Array.isArray(n)) return n.map(text).join(' '); if (n && typeof n === 'object') return [n.props?.title, n.props?.text, n.props?.message, n.props?.subtitle, n.props?.hint, n.props?.value, n.props?.meta, n.props?.metric, text(n.props?.children)].filter((v) => v !== undefined).join(' '); return typeof n === 'string' || typeof n === 'number' ? String(n) : ''; }
async function run(config = {}) {
  pageCalls++; const logs = [], queries = [], capturedData = [], helperCalls = Object.fromEntries(functions.map((n) => [n, 0])); let clients = 0;
  const pure = evaluate(pureJs, {}, { console: { warn(...args) { logs.push(args); } } });
  const domain = { ratingWeights: pure.ratingWeights, publicRatingBoundary: pure.publicRatingBoundary };
  for (const name of functions) domain[name] = (...args) => { helperCalls[name]++; return pure[name](...args); };
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
          const stale = index === 0 ? { ...healthy[0], overall_score: 999, safety_score: 999, explanation: { why_score_decreased: ['STALE'], how_to_improve: ['STALE'] } } : [{ id: 'STALE', title: 'STALE', explanation: 'STALE', impact_level: 'high', overall_score: 999 }];
          return Promise.resolve({ data: failed.has(index) ? stale : payload[index], error: failed.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'order', 'limit', 'maybeSingle'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherActionTile', 'TeacherAiInsight', 'TeacherAppFrame', 'TeacherCompactItem', 'TeacherCompactList', 'TeacherEmptyState', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const safe = { logSupabaseError: pure.logSupabaseError, safeAdminData(label, loader, fallback) { return pure.safeAdminData(label, async () => { const data = await loader(); capturedData.push(data); return data; }, fallback); } };
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link', __esModule: true }, 'lucide-react': Object.fromEntries(['ClipboardCheck', 'FileText', 'ShieldCheck', 'Star', 'TrendingUp'].map((n) => [n, n])), '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' }, '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui, '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } }, '@/lib/supabase/server': sdk, '@/lib/domain/kindergarten-rating': domain, '@/lib/admin-safe': safe };
  const page = evaluate(pageJs, imports).default;
  if (config.denied) { await assert.rejects(page, (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); assert.equal(Object.values(helperCalls).reduce((a, b) => a + b, 0), 0); return { denied: true }; }
  const tree = await page(), scoped = Boolean(profile.garden_id) && !config.clientThrow, available = names.map((_, i) => scoped && !failed.has(i));
  assert.equal(clients, profile.garden_id ? 1 : 0); assert.equal(queries.length, scoped ? 3 : 0);
  for (const q of queries) { if (failed.has(names.indexOf(q.table)) && method === 'builder') continue; assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'garden_id' && s[2] === 'garden-qa')); if (q.table === names[2]) assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'status' && s[2] === 'open')); }
  const cards = nodes(tree, 'TeacherStatCard');
  if (!profile.garden_id) { assert.equal(cards.length, 0); assert.equal(nodes(tree, 'TeacherAiInsight').length, 0); assert.equal(nodes(tree, 'TeacherEmptyState').length, 0); assert.equal(Object.values(helperCalls).reduce((a, b) => a + b, 0), 0); assert(nodes(tree, 'AdminDataError')[0].props.message); return { clients, queries: 0 }; }
  if (scoped) {
    assert.equal(capturedData.length, 1); const observed = capturedData[0];
    assert.equal(JSON.stringify(observed.rating), JSON.stringify(available[0] ? payload[0] : null));
    assert.equal(JSON.stringify(observed.history), JSON.stringify(available[1] ? payload[1] ?? [] : []));
    assert.equal(JSON.stringify(observed.recommendations), JSON.stringify(available[2] ? payload[2] ?? [] : []));
  } else assert.equal(capturedData.length, 0);
  const rating = available[0] ? payload[0] ?? defaults : null, recommendations = available[2] ? payload[2] ?? [] : [];
  const tone = (v) => ({ bad: 'red', warn: 'orange', good: 'green' })[pure.ratingTone(Number(v ?? 0))] ?? 'purple';
  assert.equal(cards.length, 4); const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props]));
  for (const [title, key] of [['ציון כללי', 'overall_score'], ['בטיחות', 'safety_score'], ['ציות', 'compliance_score'], ['תצפיתן', 'observer_score']]) { assert.equal(stats[title].value, rating ? `${rating[key]}/100` : 'לא זמין'); assert.equal(stats[title].tone, rating ? tone(rating[key]) : 'neutral'); }
  assert.equal(stats['ציון כללי'].hint, rating ? pure.ratingBandLabel(rating.rating_band) : 'רמת הדירוג לא זמינה'); assert.equal(stats['תצפיתן'].hint, rating ? pure.ratingTrendLabel(rating.trend) : 'מגמת הדירוג לא זמינה');
  assert.equal(helperCalls.ratingBandLabel, rating ? 1 : 0); assert.equal(helperCalls.ratingTrendLabel, rating ? 1 : 0); assert.equal(helperCalls.categoryScoreRows, rating ? 1 : 0); assert.equal(helperCalls.cleanRatingReasons, rating ? 2 : 0);
  const section = (title) => nodes(tree, 'TeacherSection').find((n) => n.props.title === title);
  const categoryRows = nodes(section('רכיבי הציון'), 'TeacherCompactItem'), expectedCategories = rating ? pure.categoryScoreRows(rating) : [];
  assert.deepEqual(categoryRows.map((n) => n.props.title), Array.from(expectedCategories, (r) => r.label));
  for (let i = 0; i < categoryRows.length; i++) { const p = categoryRows[i].props, r = expectedCategories[i]; assert.equal(p.subtitle, r.description); assert.equal(p.meta, `${r.value}/100`); assert.equal(p.tone, tone(r.value)); }
  for (const [title, field, emptyClaim, subtitle, rowTone, meta] of [['מה משפיע על הציון', 'why_score_decreased', 'אין גורמים חריגים שמורידים את הציון', 'ניתן לטפל ולשפר', 'orange', 'פתוח'], ['מה משפר את הציון', 'how_to_improve', 'אין המלצות זמינות', 'פעולה מומלצת', 'green', 'שיפור']]) {
    const s = section(title), rows = nodes(s, 'TeacherCompactItem'), expected = rating ? pure.cleanRatingReasons(rating.explanation?.[field]) : [];
    assert.deepEqual(rows.map((n) => n.props.title), Array.from(expected));
    for (const n of rows) { assert.equal(n.props.subtitle, subtitle); assert.equal(n.props.tone, rowTone); assert.equal(n.props.meta, meta); }
    if (!rating) { assert(text(s).includes('לא זמי')); assert(!text(s).includes(emptyClaim)); } else if (!expected.length) assert(text(s).includes(emptyClaim));
  }
  if (!rating) assert(text(section('רכיבי הציון')).includes('לא זמי'));
  const recSection = section('המלצות פתוחות'), recRows = nodes(recSection, 'TeacherCompactItem');
  assert.deepEqual(recRows.map((n) => n.props.title), recommendations.map((r) => r.title));
  for (let i = 0; i < recRows.length; i++) { const p = recRows[i].props, r = recommendations[i]; assert.equal(p.subtitle, r.explanation); assert.equal(p.tone, r.impact_level === 'high' ? 'red' : 'orange'); assert.equal(p.meta, r.impact_level); }
  if (!available[2]) { assert(text(recSection).includes('לא זמי')); assert(!text(recSection).includes('אין המלצות פתוחות')); } else if (!recommendations.length) assert(text(recSection).includes('אין המלצות פתוחות'));
  const insight = nodes(tree, 'TeacherAiInsight')[0]; assert.equal(insight.props.metric, rating ? `${rating.overall_score}/100` : 'לא זמין');
  const weights = Array.from(pure.ratingWeights, (item) => `${item.label} ${item.weight}%`).join(' · '); assert(text(insight).includes(weights)); assert(text(insight).includes(pure.publicRatingBoundary[0]));
  if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message);
  assert(!text(tree).includes('STALE')); assert(!text(tree).includes('מיגרציה')); assert(!JSON.stringify(logs).includes('PRIVATE_'));
  assert.equal(nodes(tree, 'DashboardShell')[0].props.role, profile.role); assert.equal(nodes(tree, 'TeacherAppFrame')[0].props.title, 'בוקר טוב, Owner'); assert.equal(nodes(tree, 'TeacherActionTile').length, 3);
  return { clients, queries: queries.length, ratingAvailable: available[0], recommendationsAvailable: available[2] };
}
async function test(id, config = {}) { const result = await run(config); results.push({ id, status: 'PASS', ...result }); }
const start = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("kindergarten_rating_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle()',
    'supabase.from("kindergarten_rating_history" as any).select("*").eq("garden_id", gardenId).order("snapshot_date", { ascending: false }).limit(30)',
    'supabase.from("kindergarten_rating_recommendations" as any).select("*").eq("garden_id", gardenId).eq("status", "open").order("impact_level", { ascending: false }).limit(20)'
  ];
  walk(pageAst, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['limit', 'maybeSingle'].includes(n.expression.name.text)) chains.push(shape(n)); }); assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!gardenId)') < source.indexOf('await createClient()')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 4);
  results.push({ id: 'static-three-whole-chains-admission-garden-pure-boundary', status: 'PASS', selected });
  await test('healthy-manager'); await test('healthy-owner', { role: 'owner' }); await test('healthy-empty', { payload: [null, [], []] }); await test('healthy-null', { payload: [null, null, null] });
  for (let i = 0; i < 3; i++) for (const method of ['error', 'reject', 'builder']) await test(`${names[i]}-${method}`, { fail: [i], method });
  await test('all-failed', { fail: [0, 1, 2] }); await test('all-rejected', { fail: [0, 1, 2], method: 'reject' }); await test('client-throw', { clientThrow: true });
  await test('missing-null', { garden: null }); await test('missing-empty', { garden: '' }); await test('denied-role', { denied: true });
  for (const method of ['error', 'reject', 'builder']) {
    await test(`profile-failed-healthy-empty-recs-${method}`, { fail: [0], method, payload: override({ 2: [] }) });
    await test(`history-and-recs-failed-profile-retained-${method}`, { fail: [1, 2], method });
    await test(`profile-and-history-failed-recs-retained-${method}`, { fail: [0, 1], method });
  }
  await test('healthy-explicit-zero-new-clean-explanation', { payload: override({ 0: defaults, 2: [] }) });
  await test('healthy-declining-critical-profile', { payload: override({ 0: { ...healthy[0], overall_score: 35, rating_band: 'critical', trend: 'declining', explanation: { why_score_decreased: 'not-an-array', how_to_improve: [null, ''] } } }) });
  assert.equal(forbidden, 0); console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - start, selected, results, limitations: 'Synthetic actual page/selected pure AST/opaque UI/closed SDKAuth only; not browser/full-stack/RLS/Postgres/legal/safety/certification proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
