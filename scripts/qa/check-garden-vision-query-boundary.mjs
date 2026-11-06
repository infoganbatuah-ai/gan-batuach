// Offline actual-page contracts; extract ONLY the approved pure AST functions.
// No provider module, readiness/environment code, model, frame analysis or child executes.
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
const pagePath = 'app/dashboard/garden/vision-ai/page.tsx';
const plain = (value) => JSON.parse(JSON.stringify(value));
function read(relative) {
  const file = path.join(root, relative);
  assert.ok(fs.statSync(file).isFile(), 'source must be a regular file');
  if (process.platform === 'darwin') {
    const rawFlags = execFileSync('/usr/bin/stat', ['-f', '%f', file], { encoding: 'utf8' }).trim();
    assert.match(rawFlags, /^\d+$/, 'stat must return numeric file flags');
    const flags = Number(rawFlags);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0);
    assert.equal(flags & 0x40000000, 0, 'dataless source forbidden');
  }
  return fs.readFileSync(file, 'utf8');
}
const compile = (text, fileName) => ts.transpileModule(text, { fileName,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const selectedDeclarations = [];
function extract(relative, names) {
  const file = ts.createSourceFile(relative, read(relative), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(file.parseDiagnostics.length, 0);
  const selected = file.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.deepEqual(selected.map((node) => node.name.text).sort(), [...names].sort());
  const text = selected.map((node) => node.getText(file)).join('\n');
  const onlyFunctions = ts.createSourceFile(relative, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert(onlyFunctions.statements.every((node) => ts.isFunctionDeclaration(node)));
  selectedDeclarations.push({ file: relative, names });
  return compile(text, relative);
}
const providerCode = extract('lib/domain/vision-provider.ts', ['calibrateConfidenceFromReview', 'clamp', 'round']);
const pipelineCode = extract('lib/domain/vision-analysis-pipeline.ts', ['buildVisionDiagnosticsSummary', 'buildReviewedManagerDetection', 'average', 'round']);
const pageText = read(pagePath), pageCode = compile(pageText, pagePath);
const safeCode = compile(read('lib/admin-safe.ts'), 'admin-safe.ts');
const totals = { pageCalls: 0, deniedAdmissions: 0, forbiddenEffects: 0, staticCases: 0 };
const denied = new Error('SYNTHETIC_ADMISSION_DENIED');
const contracts = [['vision_detection_results', 100], ['vision_diagnostics', 50], ['vision_calibration_feedback', 100], ['ai_camera_events', 50]];
function elements(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => elements(item, result));
  else if (node && typeof node === 'object' && 'type' in node) { result.push(node); elements(node.props?.children, result); }
  return result;
}
async function run(options = {}) {
  totals.pageCalls++;
  const garden = Object.hasOwn(options, 'garden') ? options.garden : 'garden-approved';
  const state = { clients: 0, queries: [], loaded: null, warnings: [] };
  const modes = options.modes ?? {};
  const rows = [
    [{ id: 'd1', combined_confidence: 0.9 }, { id: 'd2', model_confidence: 0.5 }, { id: 'd3', combined_confidence: 0, model_confidence: 0.8 }],
    [{ average_latency_ms: 10, average_processing_time_ms: 20, model_health: 'healthy' }, { latency_ms: 30, processing_time_ms: 40, model_health: 'offline' }],
    [{ review_outcome: 'false_positive' }, { review_outcome: 'valid_detection' }, { review_outcome: 'confirmed' }, { review_outcome: 'uncertain' }],
    options.sparseReview ? [{ status: 'confirmed', confidence_score: 0.3 }, { status: 'dismissed', confidence_score: 0.4, review_outcome: 'false_positive' }] : [
      { title: 'Reviewed Confirmed', combined_confidence: 0.8, status: 'confirmed', recommended_action: 'Review A' },
      { title: 'Reviewed Dismissed', confidence_score: 0.5, status: 'dismissed', recommended_action: 'Review B' },
      { title: 'Reviewed Escalated', combined_confidence: 0.7, status: 'escalated', recommended_action: 'Review C' }
    ]
  ];
  const effect = () => { totals.forbiddenEffects++; throw new Error('FORBIDDEN_EFFECT'); };
  function evaluate(source, filename, importer = effect, globals = {}) {
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, require: importer, ...globals,
      console: { warn: (...args) => state.warnings.push(args) }, fetch: effect, FormData: effect,
      process: new Proxy({}, { get: effect }), getVisionProvider: effect, runMockVisionFrameAnalysis: effect });
    new vm.Script(source, { filename }).runInContext(context, { timeout: 1000 }); return module.exports;
  }
  const provider = evaluate(providerCode, 'approved-provider-declarations-only');
  const UNVERIFIED = Object.freeze({ qualification: 'UNVERIFIED', providers: [] });
  const pipeline = evaluate(pipelineCode, 'approved-pipeline-declarations-only', effect, {
    calibrateConfidenceFromReview: provider.calibrateConfidenceFromReview,
    getVisionProductionReadiness: () => UNVERIFIED
  });
  const safe = evaluate(safeCode, 'actual-safe-helper');
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const page = evaluate(pageCode, pagePath, (name) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === 'next/link') return { default: 'Link' };
    if (name === '@/lib/auth') return { requireRole: async (roles) => {
      assert.deepEqual(plain(roles), ['manager', 'owner']);
      assert.equal(state.clients, 0); assert.equal(state.queries.length, 0); assert.equal(state.warnings.length, 0);
      if (options.denied) { totals.deniedAdmissions++; throw denied; }
      return { profile: { role: options.role ?? 'manager', garden_id: garden, full_name: '[DEMO] Owner Person', profile_image_url: 'synthetic-avatar' } };
    } };
    if (name === '@/lib/admin-safe') return { ...safe, safeAdminData: async (...args) => {
      const result = await safe.safeAdminData(...args); state.loaded = plain(result.data); return result;
    } };
    if (name === '@/lib/domain/vision-analysis-pipeline') return pipeline;
    if (name === '@/lib/supabase/server') return { createClient: async () => {
      state.clients++;
      if (options.clientThrows) throw new Error('PRIVATE_DIAGNOSTIC');
      return { from(table) {
        const i = state.queries.length, calls = [['from', table]]; state.queries.push(calls);
        if (modes[i] === 'builder') throw new Error('PRIVATE_DIAGNOSTIC');
        const builder = {};
        for (const method of ['select', 'eq', 'not', 'in', 'order', 'limit']) builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
        builder.then = (resolve, reject) => modes[i] === 'reject'
          ? Promise.reject(new Error('PRIVATE_DIAGNOSTIC')).then(resolve, reject)
          : Promise.resolve({ data: options.empty ? [] : options.nullData ? null : rows[i], error: modes[i] === 'error' ? { message: 'PRIVATE_DIAGNOSTIC' } : null }).then(resolve, reject);
        return builder;
      } };
    } };
    if (['lucide-react', '@/components/dashboard-shell', '@/components/admin-data-state', '@/components/teacher-app-ui'].includes(name)) return new Proxy({}, { get: (_, key) => String(key) });
    return effect();
  });
  if (options.denied) {
    await assert.rejects(page.default, (error) => error === denied);
    assert.equal(state.clients, 0); assert.equal(state.queries.length, 0); assert.equal(state.loaded, null); assert.deepEqual(state.warnings, []); return;
  }
  const tree = await page.default(), nodes = elements(tree), of = (type) => nodes.filter((node) => node.type === type);
  const unavailable = contracts.map((_, i) => !garden || options.clientThrows || Boolean(modes[i]));
  const empty = options.empty || options.nullData;
  const availableRows = rows.map((data, i) => unavailable[i] || empty ? [] : data);
  assert.equal(state.clients, garden ? 1 : 0); assert.equal(state.queries.length, garden && !options.clientThrows ? 4 : 0);
  state.queries.forEach((calls, i) => {
    const [table, limit] = contracts[i], expected = [['from', table]];
    if (modes[i] !== 'builder') {
      expected.push(['select', '*'], ['eq', 'kindergarten_id', garden]);
      if (i === 3) expected.push(['not', 'vision_provider', 'is', null], ['in', 'status', ['confirmed', 'dismissed', 'escalated']]);
      expected.push(['order', 'created_at', { ascending: false }], ['limit', limit]);
    }
    assert.deepEqual(plain(calls), expected);
  });
  assert.deepEqual(state.loaded.available, unavailable.map((value) => !value));
  ['detections', 'diagnostics', 'feedback', 'reviewedEvents'].forEach((key, i) => assert.deepEqual(state.loaded[key], availableRows[i], 'failed stale rows are discarded'));
  const summary = pipeline.buildVisionDiagnosticsSummary(availableRows[1], availableRows[0], availableRows[2]);
  assert.deepEqual(state.loaded.summary, plain(summary)); assert.equal(state.loaded.summary.providerStatus.qualification, 'UNVERIFIED');
  const mapped = availableRows[3].map((event) => plain(pipeline.buildReviewedManagerDetection(event)));
  if (!unavailable[3] && !empty) assert.deepEqual(mapped.map((event) => event.confidence), options.sparseReview ? [0.38, 0.22] : [0.88, 0.4, 0.8]);
  const pct = (value) => `${Math.round(Number(value ?? 0) * 100)}%`;
  const values = [unavailable[0] ? 'לא זמין' : summary.detectionVolume, unavailable[0] ? 'לא זמין' : pct(summary.averageConfidence), unavailable[2] ? 'לא זמין' : pct(summary.falsePositiveRate), unavailable[3] ? 'לא זמין' : mapped.length];
  const tones = [unavailable[0] ? 'neutral' : 'blue', unavailable[0] ? 'neutral' : 'green', unavailable[2] ? 'neutral' : summary.falsePositiveRate > 0.2 ? 'orange' : 'green', unavailable[3] ? 'neutral' : 'purple'];
  const cards = of('TeacherStatCard'); assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((node) => node.props.title), ['זיהויים', 'דיוק ממוצע', 'False positive', 'נבדקו']);
  cards.forEach((node, i) => { assert.equal(node.props.value, values[i]); assert.equal(node.props.tone, tones[i]); });
  if (!unavailable[0] && !empty) { assert.equal(cards[0].props.value, 3); assert.equal(cards[1].props.value, '70%'); }
  if (!unavailable[2] && !empty) assert.equal(cards[2].props.value, '25%');
  const banner = of('AdminDataError')[0].props.message;
  assert.equal(Boolean(banner), unavailable.some(Boolean)); if (!garden) assert(banner.includes('הקשר גן'));
  const section = (title) => of('TeacherSection').find((node) => node.props.title === title);
  const reviewedNodes = elements(section('זיהויים שנבדקו'));
  const items = reviewedNodes.filter((node) => node.type === 'TeacherCompactItem');
  assert.equal(items.length, mapped.length);
  if (unavailable[3]) assert(reviewedNodes.some((node) => node.props?.title === 'נתוני הזיהויים שנבדקו אינם זמינים'));
  else if (empty) assert(reviewedNodes.some((node) => node.props?.title === 'אין זיהויים שנבדקו עדיין'));
  else items.forEach((node, i) => {
    assert.equal(node.props.title, mapped[i].title); assert.equal(node.props.subtitle, `${mapped[i].recommendedAction} · דיוק ${pct(mapped[i].confidence)}`);
    assert.equal(node.props.tone, 'green'); assert.equal(node.props.meta, mapped[i].status);
  });
  const summaryMeta = elements(section('מה מוצג למנהלת')).find((node) => node.type === 'TeacherCompactItem' && node.props.title === 'זיהויים שנבדקו').props;
  assert.equal(summaryMeta.meta, unavailable[3] ? 'לא זמין' : mapped.length); assert.equal(summaryMeta.tone, unavailable[3] ? 'neutral' : 'green');
  const safety = elements(section('המלצות זהירות')).filter((node) => node.type === 'TeacherCompactItem');
  assert.deepEqual(safety.map((node) => node.props.title), ['אין זיהוי ילדים', 'אין ניקוד צוות', 'אין האשמות אוטומטיות']);
  safety.forEach((node) => assert.equal(node.props.meta, 'מושבת'));
  const frame = of('TeacherAppFrame')[0].props;
  assert.equal(frame.title, 'בוקר טוב, Owner'); assert.equal(frame.subtitle, 'זיהוי חזותי בטוח'); assert.equal(frame.avatarUrl, 'synthetic-avatar'); assert.equal(frame.active, 'more');
  assert.equal(of('DashboardShell')[0].props.role, options.role === 'owner' ? 'owner' : 'manager');
  assert.equal(of('TeacherPageTitle')[0].props.action.props.href, '/dashboard/garden/ai-events');
  assert.deepEqual(of('TeacherActionTile').map((node) => node.props.href), ['/dashboard/garden/ai-events', '/dashboard/garden/cameras']);
  assert(!JSON.stringify({ tree, warnings: state.warnings }).includes('PRIVATE_DIAGNOSTIC'));
}
const cases = [];
const add = (id, body) => cases.push({ id, body });
for (const role of ['manager', 'owner']) add(`healthy-${role}`, () => run({ role }));
add('healthy-empty-genuine-zero', () => run({ empty: true }));
add('healthy-null-genuine-zero', () => run({ nullData: true }));
for (let i = 0; i < 4; i++) add(`returned-stale-error-source-${i}`, () => run({ modes: { [i]: 'error' } }));
add('all-error-empty-is-unavailable', () => run({ empty: true, modes: { 0: 'error', 1: 'error', 2: 'error', 3: 'error' } }));
add('missing-garden-null', () => run({ garden: null }));
add('missing-garden-empty', () => run({ garden: '' }));
add('admission-denied-zero-client-query', () => run({ denied: true }));
add('client-throws-unavailable', () => run({ clientThrows: true }));
for (let i = 0; i < 4; i++) add(`rejected-source-${i}`, () => run({ modes: { [i]: 'reject' } }));
for (let i = 0; i < 4; i++) add(`builder-throws-source-${i}`, () => run({ modes: { [i]: 'builder' } }));
add('mixed-errors-keep-healthy-feedback', () => run({ modes: { 0: 'error', 1: 'reject', 3: 'builder' } }));
add('healthy-reviewed-fallback-mapping', () => run({ sparseReview: true }));
add('static-exact-four-chains-and-admission', () => {
  totals.staticCases++;
  const env = { PATH: process.env.PATH, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  const baseline = execFileSync('git', ['--no-lazy-fetch', '-C', root, 'show', `a4f3661bfe0aa3beb39edce557bcc77e587eaeda:${pagePath}`], { env, encoding: 'utf8' });
  function chains(text) {
    const file = ts.createSourceFile(pagePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); assert.equal(file.parseDiagnostics.length, 0);
    const found = [];
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'limit' && node.getText(file).startsWith('supabase.from(')) found.push(node.getText(file));
      ts.forEachChild(node, visit);
    };
    visit(file); return found;
  }
  assert.equal(chains(pageText).length, 4); assert.deepEqual(chains(pageText), chains(baseline));
  assert(pageText.indexOf('await requireRole(["manager", "owner"])') < pageText.indexOf('await safeAdminData('));
  assert(pageText.indexOf('if (!gardenId) return') < pageText.indexOf('await createClient()'));
});
assert.equal(cases.length, 24); assert.equal(new Set(cases.map((entry) => entry.id)).size, 24);
console.log('PURE_BOUNDARY', JSON.stringify({ selectedDeclarations, readiness: 'UNVERIFIED_INERT_FIXTURE', wholeProviderModuleExecuted: false }));
console.log('CASE_REGISTRY', JSON.stringify(cases.map((entry) => entry.id)));
for (const entry of cases) test(entry.id, entry.body);
after(() => { assert.equal(totals.forbiddenEffects, 0); console.log('OBSERVATIONS', JSON.stringify(totals)); });
