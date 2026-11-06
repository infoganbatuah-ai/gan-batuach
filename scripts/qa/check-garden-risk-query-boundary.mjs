// Offline actual page + the two explicitly allowed pure domain modules.
// Opaque UI and closed SDK/Auth; no generators, actions, providers or live services.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const pagePath = 'app/dashboard/garden/risk/page.tsx';
const plain = (value) => JSON.parse(JSON.stringify(value));
function read(relative) {
  const file = path.join(root, relative);
  assert.equal(Number(execFileSync('/usr/bin/stat', ['-f', '%f', file], { encoding: 'utf8' }).trim()) & 0x40000000, 0);
  return fs.readFileSync(file, 'utf8');
}
const compile = (text, fileName) => ts.transpileModule(text, { fileName,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const pureBoundary = [];
function pure(relative) {
  const text = read(relative), file = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(file.parseDiagnostics.length, 0);
  for (const statement of file.statements) {
    assert(ts.isTypeAliasDeclaration(statement) || ts.isFunctionDeclaration(statement) || ts.isVariableStatement(statement), 'only pure functions/constants/types');
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
      let expression = declaration.initializer;
      while (expression && ts.isAsExpression(expression)) expression = expression.expression;
      assert(expression && ts.isArrayLiteralExpression(expression) && expression.elements.every((node) => ts.isStringLiteral(node)), 'inert string constants only');
    }
  }
  function visit(node) {
    assert(!ts.isImportDeclaration(node) && !ts.isImportEqualsDeclaration(node));
    if (ts.isIdentifier(node)) assert(!['fetch', 'process', 'require', 'globalThis', 'window', 'document', 'setTimeout', 'setInterval'].includes(node.text), 'no effect/environment identifiers');
    ts.forEachChild(node, visit);
  }
  visit(file); pureBoundary.push({ file: relative, imports: 0, boundary: 'FUNCTIONS_TYPES_INERT_STRING_CONSTANTS_ONLY' });
  return compile(text, relative);
}
const riskCode = pure('lib/domain/predictive-risk.ts');
const preventionCode = pure('lib/domain/predictive-safety-prevention.ts');
const pageText = read(pagePath), pageCode = compile(pageText, pagePath);
const safeCode = compile(read('lib/admin-safe.ts'), 'admin-safe.ts');
const totals = { pageCalls: 0, deniedAdmissions: 0, forbiddenEffects: 0, staticCases: 0 };
const denied = new Error('SYNTHETIC_ADMISSION_DENIED');
const keys = ['profile', 'signals', 'recommendations', 'history', 'warnings', 'actions', 'readiness'];
const tables = ['kindergarten_risk_profiles', 'predictive_risk_signals', 'risk_prevention_recommendations', 'kindergarten_risk_history', 'early_warning_signals', 'prevention_recommendation_actions', 'prevention_readiness_scores'];
function elements(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => elements(item, result));
  else if (node && typeof node === 'object' && 'type' in node) { result.push(node); elements(node.props?.children, result); }
  return result;
}
async function run(options = {}) {
  totals.pageCalls++;
  const garden = Object.hasOwn(options, 'garden') ? options.garden : 'garden-approved';
  const state = { clients: 0, queries: [], loaded: null, warnings: [], profileCalls: { cleanRiskReasons: 0, riskCategoryRows: 0, riskLevelLabel: 0, riskTrendLabel: 0 } };
  const modes = options.modes ?? {};
  const fixtures = [
    { overall_risk_score: 76, safety_risk: 80, compliance_risk: 40, operational_risk: 22, staffing_risk: 67, observer_risk: 55, risk_level: 'high', risk_trend: 'rising', predicted_risk_level: 'critical', explanation: { why_increased: ['PROFILE_REASON_A', '', null, 17, '  ', ' PROFILE_REASON_B '], how_to_improve: ['PROFILE_IMPROVE_A', false, '', 'PROFILE_IMPROVE_B'] } },
    [{ id: 's1', title: 'SIGNAL_ONE', explanation: 'signal explanation', severity: 'high', pattern_count: 3 }, { id: 's2', title: 'SIGNAL_TWO', explanation: 'another signal', severity: 37, pattern_count: 1 }],
    [{ id: 'r1', title: 'REC_ONE', explanation: 'recommendation explanation', priority: 'medium' }],
    [{ id: 'h1', overall_risk_score: 99 }],
    [{ id: 'w1', warning_type: 'rising_complaint_trend', recommended_action: 'WARNING_ACTION', severity: 'high', confidence_score: 86 }, { id: 'w2', warning_type: 'camera_outage_pattern', recommended_action: 'WARNING_CAMERA_ACTION', severity: 80, confidence_score: 74 }],
    [{ id: 'a1', title: 'ACTION_ONE', description: 'action description', priority: 'in_progress' }, { id: 'a2', title: 'ACTION_TWO', description: 'another action', priority: 'high' }],
    { prevention_readiness_score: 82 }
  ];
  const singleton = (i) => i === 0 || i === 6;
  const delivered = fixtures.map((value, i) => options.nullData ? null : options.empty || options.emptySources?.includes(i) ? singleton(i) ? null : [] : options.profileNull && i === 0 ? null : value);
  const effect = () => { totals.forbiddenEffects++; throw new Error('FORBIDDEN_EFFECT'); };
  function evaluate(source, filename, importer) {
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, require: importer,
      console: { warn: (...args) => state.warnings.push(args) }, fetch: effect, FormData: effect,
      process: new Proxy({}, { get: effect }) });
    new vm.Script(source, { filename }).runInContext(context, { timeout: 1000 }); return module.exports;
  }
  const riskDomain = evaluate(riskCode, 'actual-pure-predictive-risk', effect);
  const prevention = evaluate(preventionCode, 'actual-pure-prevention', effect);
  const safe = evaluate(safeCode, 'actual-safe-helper', effect);
  const pageRisk = { ...riskDomain };
  for (const name of Object.keys(state.profileCalls)) pageRisk[name] = (...args) => { state.profileCalls[name]++; return riskDomain[name](...args); };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const page = evaluate(pageCode, pagePath, (name) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === 'next/link') return { default: 'Link' };
    if (name === '@/lib/auth') return { requireRole: async (roles) => {
      assert.deepEqual(plain(roles), ['manager', 'owner']); assert.equal(state.clients, 0); assert.equal(state.queries.length, 0); assert.equal(state.warnings.length, 0);
      if (options.denied) { totals.deniedAdmissions++; throw denied; }
      return { profile: { role: options.role ?? 'manager', garden_id: garden, full_name: '[DEMO] Owner Person', profile_image_url: 'synthetic-avatar' } };
    } };
    if (name === '@/lib/admin-safe') return { ...safe, safeAdminData: async (...args) => { const result = await safe.safeAdminData(...args); state.loaded = plain(result.data); return result; } };
    if (name === '@/lib/domain/predictive-risk') return pageRisk;
    if (name === '@/lib/domain/predictive-safety-prevention') return prevention;
    if (name === '@/lib/supabase/server') return { createClient: async () => {
      state.clients++;
      if (options.clientThrows) throw new Error('PRIVATE_DIAGNOSTIC');
      return { from(table) {
        const i = state.queries.length, calls = [['from', table]]; state.queries.push(calls);
        if (modes[i] === 'builder') throw new Error('PRIVATE_DIAGNOSTIC');
        const builder = {};
        for (const method of ['select', 'eq', 'in', 'order', 'limit', 'maybeSingle']) builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
        builder.then = (resolve, reject) => modes[i] === 'reject' ? Promise.reject(new Error('PRIVATE_DIAGNOSTIC')).then(resolve, reject)
          : Promise.resolve({ data: delivered[i], error: modes[i] === 'error' ? { message: 'PRIVATE_DIAGNOSTIC' } : null }).then(resolve, reject);
        return builder;
      } };
    } };
    if (['lucide-react', '@/components/dashboard-shell', '@/components/admin-data-state', '@/components/teacher-app-ui'].includes(name)) return new Proxy({}, { get: (_, key) => String(key) });
    return effect();
  });
  if (options.denied) {
    await assert.rejects(page.default, (error) => error === denied); assert.equal(state.clients, 0); assert.equal(state.queries.length, 0); assert.equal(state.loaded, null); assert.deepEqual(state.warnings, []); return;
  }
  const tree = await page.default(), nodes = elements(tree), of = (type) => nodes.filter((node) => node.type === type);
  const unavailable = keys.map((_, i) => !garden || options.clientThrows || Boolean(modes[i]));
  const data = delivered.map((value, i) => unavailable[i] ? singleton(i) ? null : [] : singleton(i) ? value : value ?? []);
  assert.equal(state.clients, garden ? 1 : 0); assert.equal(state.queries.length, garden && !options.clientThrows ? 7 : 0);
  state.queries.forEach((calls, i) => {
    const expected = [['from', tables[i]]];
    if (modes[i] !== 'builder') {
      expected.push(['select', i === 0 ? '*, gardens(name,city)' : '*'], ['eq', 'garden_id', garden]);
      if (i === 0) expected.push(['maybeSingle']);
      else {
        if (i === 1) expected.push(['in', 'review_status', ['needs_review', 'reviewing', 'escalated']]);
        if (i === 2) expected.push(['eq', 'status', 'open']);
        if (i === 4) expected.push(['in', 'review_status', ['needs_review', 'reviewing', 'confirmed', 'escalated']]);
        if (i === 5) expected.push(['in', 'status', ['open', 'in_progress', 'approved']]);
        expected.push(['order', i === 3 || i === 6 ? 'snapshot_date' : 'created_at', { ascending: false }], ['limit', i === 1 ? 40 : i === 6 ? 1 : 30]);
        if (i === 6) expected.push(['maybeSingle']);
      }
    }
    assert.deepEqual(plain(calls), expected, `exact query ${i}`);
  });
  assert.deepEqual(state.loaded.available, unavailable.map((value) => !value));
  keys.forEach((key, i) => assert.deepEqual(state.loaded[key], plain(data[i]), `source ${i} stale data discarded`));
  const defaultProfile = { overall_risk_score: 0, safety_risk: 0, compliance_risk: 0, operational_risk: 0, staffing_risk: 0, observer_risk: 0, risk_level: 'low', risk_trend: 'new', predicted_risk_level: 'low', explanation: {} };
  const risk = unavailable[0] ? null : data[0] ?? defaultProfile;
  const tone = (value) => ({ bad: 'red', warn: 'orange', good: 'green' })[value] ?? 'purple';
  const expectedValues = [risk ? `${risk.overall_risk_score}/100` : 'לא זמין', unavailable[6] ? 'לא זמין' : `${data[6]?.prevention_readiness_score ?? 0}/100`, unavailable[4] ? 'לא זמין' : data[4].length, risk ? `${risk.staffing_risk}/100` : 'לא זמין'];
  const expectedTones = [risk ? tone(riskDomain.riskTone(Number(risk.overall_risk_score ?? 0))) : 'neutral', unavailable[6] ? 'neutral' : tone(prevention.preventionTone(Number(data[6]?.prevention_readiness_score ?? 0))), unavailable[4] ? 'neutral' : data[4].length ? 'orange' : 'green', risk ? tone(riskDomain.riskTone(Number(risk.staffing_risk ?? 0))) : 'neutral'];
  const cards = of('TeacherStatCard'); assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((node) => node.props.title), ['סיכון כללי', 'מוכנות מניעה', 'אזהרות', 'צוות']);
  cards.forEach((node, i) => { assert.equal(node.props.value, expectedValues[i]); assert.equal(node.props.tone, expectedTones[i]); });
  assert.equal(cards[0].props.hint, risk ? riskDomain.riskLevelLabel(risk.risk_level) : 'לא זמין');
  assert.equal(cards[2].props.hint, risk ? riskDomain.riskTrendLabel(risk.risk_trend) : 'לא זמין');
  const banner = of('AdminDataError')[0].props.message; assert.equal(Boolean(banner), unavailable.some(Boolean)); if (!garden) assert(banner.includes('הקשר גן'));
  const section = (title) => of('TeacherSection').find((node) => node.props.title === title);
  const items = (title) => elements(section(title)).filter((node) => node.type === 'TeacherCompactItem');
  const cues = (title) => elements(section(title)).filter((node) => node.type === 'TeacherEmptyState').map((node) => node.props.title);
  const categories = risk ? riskDomain.riskCategoryRows(risk) : [];
  assert.deepEqual(plain(items('קטגוריות סיכון').map((node) => node.props)), plain(categories.map((row) => ({ title: row.label, subtitle: row.description, tone: tone(riskDomain.riskTone(Number(row.value ?? 0))), meta: `${row.value}/100` }))));
  const reasons = risk ? plain(riskDomain.cleanRiskReasons(risk.explanation?.why_increased)) : [];
  const improvements = risk ? plain(riskDomain.cleanRiskReasons(risk.explanation?.how_to_improve)) : [];
  assert.deepEqual(items('מה מעלה סיכון').map((node) => node.props.title), reasons);
  assert.deepEqual(items('איך מורידים סיכון').map((node) => node.props.title), improvements);
  if (!risk) {
    assert(cues('קטגוריות סיכון').includes('נתוני קטגוריות הסיכון אינם זמינים'));
    assert(cues('מה מעלה סיכון').includes('גורמי הסיכון אינם זמינים')); assert(!cues('מה מעלה סיכון').includes('אין דפוס חריג כרגע'));
    assert(cues('איך מורידים סיכון').includes('המלצות לשיפור הסיכון אינן זמינות')); assert(!cues('איך מורידים סיכון').includes('אין המלצות זמינות'));
    assert(Object.values(state.profileCalls).every((value) => value === 0), 'no missing-profile labels/category/default helper calls');
  } else {
    assert.deepEqual(state.profileCalls, { cleanRiskReasons: 2, riskCategoryRows: 1, riskLevelLabel: 2, riskTrendLabel: 1 });
    if (!reasons.length) assert(cues('מה מעלה סיכון').includes('אין דפוס חריג כרגע'));
    if (!improvements.length) assert(cues('איך מורידים סיכון').includes('אין המלצות זמינות'));
  }
  const expectedWarnings = [
    ...data[4].map((row) => ({ key: row.id, props: { title: prevention.warningTypeLabel(row.warning_type), subtitle: row.recommended_action, tone: tone(prevention.preventionTone(row.severity)), meta: `${row.confidence_score}%` } })),
    ...data[1].map((row) => ({ key: row.id, props: { title: row.title, subtitle: row.explanation, tone: tone(riskDomain.riskTone(row.severity)), meta: row.pattern_count } }))
  ];
  assert.deepEqual(plain(items('אזהרות מוקדמות').map(({ key, props }) => ({ key, props }))), plain(expectedWarnings));
  const warningsComplete = !unavailable[1] && !unavailable[4];
  assert.equal(cues('אזהרות מוקדמות').includes('חלק מנתוני האזהרות אינם זמינים'), !warningsComplete);
  assert.equal(cues('אזהרות מוקדמות').includes('אין אזהרות פתוחות'), warningsComplete && expectedWarnings.length === 0);
  const expectedRecs = [
    ...data[5].map((row) => ({ key: row.id, props: { title: row.title, subtitle: row.description, tone: tone(prevention.preventionTone(row.priority)), meta: row.priority } })),
    ...data[2].map((row) => ({ key: row.id, props: { title: row.title, subtitle: row.explanation, tone: tone(riskDomain.riskTone(row.priority)), meta: row.priority } }))
  ];
  assert.deepEqual(plain(items('המלצות מניעה').map(({ key, props }) => ({ key, props }))), plain(expectedRecs));
  const recsComplete = !unavailable[2] && !unavailable[5];
  assert.equal(cues('המלצות מניעה').includes('חלק מנתוני המלצות המניעה אינם זמינים'), !recsComplete);
  assert.equal(cues('המלצות מניעה').includes('אין המלצות פתוחות'), recsComplete && expectedRecs.length === 0);
  const insight = of('TeacherAiInsight')[0].props;
  assert.equal(insight.metric, risk ? riskDomain.riskLevelLabel(risk.risk_level) : 'לא זמין');
  assert.equal([insight.children].flat().join(''), `${riskDomain.predictiveRiskSafeguards.join(' · ')}. המידע אינו מוצג להורים ואינו מחליף בדיקה אנושית.`);
  const frame = of('TeacherAppFrame')[0].props;
  assert.equal(frame.title, 'בוקר טוב, Owner'); assert.equal(frame.subtitle, 'מרכז מניעה ובטיחות'); assert.equal(frame.avatarUrl, 'synthetic-avatar'); assert.equal(frame.active, 'more');
  assert.equal(of('DashboardShell')[0].props.role, options.role === 'owner' ? 'owner' : 'manager');
  assert.equal(of('TeacherPageTitle')[0].props.action.props.href, '/dashboard/garden/tasks');
  assert.deepEqual(of('TeacherActionTile').map((node) => node.props.href), ['/dashboard/garden/staff', '/dashboard/garden/compliance', '/dashboard/garden/inspections', '/dashboard/garden/camera-health']);
  assert(!JSON.stringify({ tree, warnings: state.warnings }).includes('PRIVATE_DIAGNOSTIC'));
}
const cases = [];
const add = (id, body) => cases.push({ id, body });
for (const role of ['manager', 'owner']) add(`healthy-${role}`, () => run({ role }));
add('healthy-empty-genuine-defaults', () => run({ empty: true }));
add('healthy-null-genuine-defaults', () => run({ nullData: true }));
for (let i = 0; i < 7; i++) for (const mode of ['error', 'reject', 'builder']) add(`${mode}-source-${i}`, () => run({ modes: { [i]: mode } }));
add('client-throws', () => run({ clientThrows: true }));
add('missing-garden-null', () => run({ garden: null }));
add('missing-garden-empty', () => run({ garden: '' }));
add('admission-denied-zero-client-query', () => run({ denied: true }));
add('failed-signals-healthy-empty-warnings', () => run({ modes: { 1: 'error' }, emptySources: [4] }));
add('failed-warnings-healthy-empty-signals', () => run({ modes: { 4: 'error' }, emptySources: [1] }));
add('failed-recommendations-healthy-empty-actions', () => run({ modes: { 2: 'error' }, emptySources: [5] }));
add('failed-actions-healthy-empty-recommendations', () => run({ modes: { 5: 'error' }, emptySources: [2] }));
add('both-warning-inputs-failed', () => run({ modes: { 1: 'error', 4: 'error' } }));
add('both-recommendation-inputs-failed', () => run({ modes: { 2: 'error', 5: 'error' } }));
const allErrors = Object.fromEntries(keys.map((_, i) => [i, 'error']));
add('all-error-stale-payloads', () => run({ modes: allErrors }));
add('all-error-empty-not-known-zero', () => run({ modes: allErrors, empty: true }));
add('failed-profile-readiness-keeps-warnings', () => run({ modes: { 0: 'error', 6: 'error' } }));
add('healthy-null-profile-keeps-independent-data', () => run({ profileNull: true }));
add('static-exact-seven-chains-and-admission', () => {
  totals.staticCases++;
  const env = { PATH: process.env.PATH, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  const baseline = execFileSync('git', ['--no-lazy-fetch', '-C', root, 'show', `a4f3661bfe0aa3beb39edce557bcc77e587eaeda:${pagePath}`], { env, encoding: 'utf8' });
  function chains(text) {
    const file = ts.createSourceFile(pagePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); assert.equal(file.parseDiagnostics.length, 0);
    const found = [];
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['limit', 'maybeSingle'].includes(node.expression.name.text) && node.getText(file).startsWith('supabase.from(') && !ts.isPropertyAccessExpression(node.parent)) found.push(node.getText(file));
      ts.forEachChild(node, visit);
    };
    visit(file); return found;
  }
  assert.equal(chains(pageText).length, 7); assert.deepEqual(chains(pageText), chains(baseline));
  const admission = pageText.indexOf('await requireRole(["manager", "owner"])');
  const fallback = pageText.indexOf('await safeAdminData(');
  const guard = pageText.indexOf('if (!gardenId) return');
  const client = pageText.indexOf('await createClient()');
  assert([admission, fallback, guard, client].every((index) => index >= 0));
  assert(admission < fallback); assert(guard < client);
});
assert.equal(cases.length, 40); assert.equal(new Set(cases.map((entry) => entry.id)).size, 40);
console.log('PURE_BOUNDARY', JSON.stringify(pureBoundary));
console.log('CASE_REGISTRY', JSON.stringify(cases.map((entry) => entry.id)));
for (const entry of cases) test(entry.id, entry.body);
after(() => { assert.equal(totals.forbiddenEffects, 0); console.log('OBSERVATIONS', JSON.stringify(totals)); });
