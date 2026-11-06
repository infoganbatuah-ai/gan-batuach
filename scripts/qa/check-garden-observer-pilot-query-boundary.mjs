// Offline actual-page + existing pure-domain contracts; no child/SDK/Auth execution.
// This is not browser, React lifecycle, database, RLS, or physical-pilot proof.
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
const pagePath = 'app/dashboard/garden/observer-pilot/page.tsx';
const plain = (value) => JSON.parse(JSON.stringify(value));
function read(relative) {
  const file = path.join(root, relative);
  assert.equal(Number(execFileSync('/usr/bin/stat', ['-f', '%f', file], { encoding: 'utf8' }).trim()) & 0x40000000, 0);
  return fs.readFileSync(file, 'utf8');
}
const pageText = read(pagePath);
const compile = (text, fileName) => ts.transpileModule(text, { fileName,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const pageCode = compile(pageText, pagePath);
const domainCode = compile(read('lib/domain/observer-pilot.ts'), 'observer-pilot.ts');
const safeCode = compile(read('lib/admin-safe.ts'), 'admin-safe.ts');
const totals = { pageCalls: 0, deniedAdmissions: 0, forbiddenEffects: 0, staticCases: 0 };
const denied = new Error('SYNTHETIC_ADMISSION_DENIED');
const contracts = [
  ['camera_streams', 'id,name,area,status,health_status,gateway_registration_status,observer_shadow_mode,skeleton_analytics_ready,motion_anomaly_ready', 'garden_id', 'created_at', 80],
  ['skeleton_observer_events', 'id,event_type,severity,confidence,review_status,event_timestamp,camera_streams(name),camera_zones(name)', 'garden_id', 'event_timestamp', 80],
  ['observer_ground_truth_reviews', '*', 'kindergarten_id', 'created_at', 80],
  ['observer_calibration_profiles', 'id,scope_type,event_type,calibration_status,readiness_score,confidence_threshold', 'kindergarten_id', 'updated_at', 30]
];
function elements(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => elements(item, result));
  else if (node && typeof node === 'object' && 'type' in node) {
    result.push(node); elements(node.props?.children, result);
  }
  return result;
}
async function run(options = {}) {
  totals.pageCalls++;
  const garden = Object.hasOwn(options, 'garden') ? options.garden : 'garden-approved';
  const state = { clients: 0, queries: [], loaded: null, warnings: [], readinessInputs: [] };
  const modes = options.modes ?? {};
  const rows = [
    [{ id: 'cam-a', name: 'Camera A', area: 'Room A', gateway_registration_status: 'registered', observer_shadow_mode: true },
      { id: 'cam-b', name: 'Camera B', area: 'Room B', gateway_registration_status: 'offline', observer_shadow_mode: false }],
    Array.from({ length: options.longPending ? 15 : 5 }, (_, i) => ({ id: `event-${i}`, event_type: 'fall_suspected', review_status: options.longPending ? 'pending_review' : ['detected', 'pending_review', 'reviewing', 'needs_followup', 'confirmed'][i], event_timestamp: '2026-11-01T12:00:00Z', camera_streams: { name: `Event Camera ${i}` }, camera_zones: { name: `Zone ${i}` } })),
    ['false_positive', 'false_negative', 'missed_detection', 'uncertain', 'needs_more_context', 'correct_detection'].map((outcome, i) => ({ id: `review-${i}`, outcome })),
    [{ id: 'profile-a', readiness_score: 99, calibration_status: 'calibrated' }]
  ];
  const effect = () => { totals.forbiddenEffects++; throw new Error('FORBIDDEN_EFFECT'); };
  function evaluate(source, filename, importer) {
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, require: importer,
      console: { warn: (...args) => state.warnings.push(args) }, fetch: effect, FormData: effect,
      process: new Proxy({}, { get: effect }) });
    new vm.Script(source, { filename }).runInContext(context, { timeout: 1000 });
    return module.exports;
  }
  const domain = evaluate(domainCode, 'actual-pure-domain', effect);
  const safe = evaluate(safeCode, 'actual-safe-helper', effect);
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
    if (name === '@/lib/domain/observer-pilot') return { ...domain, calculateObserverPilotReadiness: (input) => {
      state.readinessInputs.push(plain(input)); return domain.calculateObserverPilotReadiness(input);
    } };
    if (name === '@/lib/supabase/server') return { createClient: async () => {
      state.clients++;
      if (options.clientThrows) throw new Error('PRIVATE_DIAGNOSTIC');
      return { from(table) {
        const i = state.queries.length, calls = [['from', table]]; state.queries.push(calls);
        if (modes[i] === 'builder') throw new Error('PRIVATE_DIAGNOSTIC');
        const builder = {};
        for (const method of ['select', 'eq', 'order', 'limit']) builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
        builder.then = (resolve, reject) => modes[i] === 'reject'
          ? Promise.reject(new Error('PRIVATE_DIAGNOSTIC')).then(resolve, reject)
          : Promise.resolve({ data: options.empty ? [] : options.nullData ? null : rows[i], error: modes[i] === 'error' ? { message: 'PRIVATE_DIAGNOSTIC' } : null }).then(resolve, reject);
        return builder;
      } };
    } };
    if (['lucide-react', '@/components/dashboard-shell', '@/components/teacher-app-ui'].includes(name)) return new Proxy({}, { get: (_, key) => String(key) });
    return effect();
  });
  if (options.denied) {
    await assert.rejects(page.default, (error) => error === denied);
    assert.equal(state.clients, 0); assert.equal(state.queries.length, 0); assert.equal(state.loaded, null);
    assert.deepEqual(state.warnings, []); assert.deepEqual(state.readinessInputs, []); return;
  }
  const tree = await page.default();
  const nodes = elements(tree), of = (type) => nodes.filter((node) => node.type === type);
  const unavailable = contracts.map((_, i) => !garden || options.clientThrows || Boolean(modes[i]));
  assert.equal(state.clients, garden ? 1 : 0);
  assert.equal(state.queries.length, garden && !options.clientThrows ? 4 : 0);
  state.queries.forEach((calls, i) => {
    const [table, select, scope, order, limit] = contracts[i];
    const expected = [['from', table]];
    if (modes[i] !== 'builder') expected.push(['select', select], ['eq', scope, garden], ['order', order, { ascending: false }], ['limit', limit]);
    assert.deepEqual(plain(calls), expected);
  });
  assert.deepEqual(state.loaded.available, unavailable.map((value) => !value));
  state.loaded.rows.forEach((data, i) => assert.deepEqual(data, unavailable[i] || options.empty || options.nullData ? [] : rows[i], 'failed stale data must be discarded'));
  const empty = options.empty || options.nullData;
  const input = { detections: empty ? 0 : rows[1].length, pendingReview: empty ? 0 : options.longPending ? 15 : 4, reviewed: empty ? 0 : 6, falsePositive: empty ? 0 : 1, falseNegative: empty ? 0 : 2, uncertain: empty ? 0 : 2, cameras: empty ? 0 : 2, stableCameras: empty ? 0 : 1 };
  const calibrationReady = !unavailable.slice(0, 3).some(Boolean);
  assert.equal(state.readinessInputs.length, calibrationReady ? 1 : 0, 'ONLY first three sources are calibration dependencies');
  if (calibrationReady) assert.deepEqual(state.readinessInputs[0], input);
  const calibration = domain.calculateObserverPilotReadiness(input).calibration;
  if (calibrationReady) assert.equal(calibration, empty ? 40 : options.longPending ? 46 : 78);
  const values = [unavailable[1] ? 'לא זמין' : input.pendingReview, unavailable[0] ? 'לא זמין' : empty ? '0/0' : '1/2', calibrationReady ? `${calibration}/100` : 'לא זמין', unavailable[2] ? 'לא זמין' : input.reviewed];
  const tones = [unavailable[1] ? 'neutral' : input.pendingReview ? 'orange' : 'green', unavailable[0] ? 'neutral' : 'orange', calibrationReady ? calibration >= 80 ? 'green' : 'orange' : 'neutral', unavailable[2] ? 'neutral' : input.reviewed ? 'green' : 'orange'];
  const cards = of('TeacherStatCard'); assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((node) => node.props.title), ['אירועים לבדיקה', 'מצלמות מכוסות', 'כיול', 'בדיקות שבוצעו']);
  cards.forEach((node, i) => { assert.equal(node.props.value, values[i]); assert.equal(node.props.tone, tones[i]); });
  const section = (title) => of('TeacherSection').find((node) => node.props.title === title);
  const eventNodes = elements(section('מה דורש בדיקה'));
  const eventItems = eventNodes.filter((node) => node.type === 'TeacherCompactItem');
  assert.equal(eventItems.length, unavailable[1] || empty ? 0 : options.longPending ? 12 : 4);
  if (unavailable[1]) assert(eventNodes.some((node) => node.type === 'TeacherEmptyState' && node.props.title === 'נתוני האירועים אינם זמינים'));
  else if (empty) assert(eventNodes.some((node) => node.props?.title === 'אין אירועים שממתינים לבדיקה'));
  else eventItems.forEach((node, i) => { assert.equal(node.props.title, 'חשד לנפילה'); assert(node.props.subtitle.includes(`Event Camera ${i} · Zone ${i}`)); assert.equal(node.props.tone, 'orange'); });
  const cameraNodes = elements(section('כיסוי מצלמות'));
  const cameraItems = cameraNodes.filter((node) => node.type === 'TeacherCompactItem');
  assert.deepEqual(cameraItems.map((node) => node.props.title), unavailable[0] || empty ? [] : ['Camera A', 'Camera B']);
  if (unavailable[0]) assert(cameraNodes.some((node) => node.props?.title === 'נתוני כיסוי המצלמות אינם זמינים'));
  const cues = of('TeacherEmptyState').map((node) => node.props.title);
  if (!garden) assert(cues.includes('נתוני הפיילוט אינם זמינים'));
  else if (unavailable[3]) assert(cues.includes('פרופילי הכיול אינם זמינים'));
  const safety = elements(section('כללי בטיחות')).filter((node) => node.type === 'TeacherCompactItem');
  assert.deepEqual(safety.map((node) => node.props.title), ['בדיקת אדם חובה', 'הורים לא רואים raw AI', 'אין שמע או זיהוי פנים']);
  const frame = of('TeacherAppFrame')[0].props;
  assert.equal(frame.title, 'בוקר טוב, Owner'); assert.equal(frame.subtitle, 'פיילוט תצפיתן');
  assert.equal(frame.avatarUrl, 'synthetic-avatar'); assert.equal(frame.active, 'more');
  assert.equal(of('DashboardShell')[0].props.role, 'manager');
  assert.deepEqual(of('TeacherActionTile').map((node) => node.props.href), ['/dashboard/garden/cameras', '/dashboard/garden/tasks', '/dashboard/garden/observer-intelligence']);
  assert(!JSON.stringify({ tree, warnings: state.warnings }).includes('PRIVATE_DIAGNOSTIC'));
}
const cases = [];
const add = (id, body) => cases.push({ id, body });
for (const role of ['manager', 'owner']) add(`healthy-${role}`, () => run({ role }));
add('healthy-empty-calibration40', () => run({ empty: true }));
add('healthy-null-calibration40', () => run({ nullData: true }));
for (let i = 0; i < 4; i++) add(`returned-stale-error-source-${i}`, () => run({ modes: { [i]: 'error' } }));
add('all-error-empty-not-known-zero', () => run({ empty: true, modes: { 0: 'error', 1: 'error', 2: 'error', 3: 'error' } }));
add('missing-garden-null', () => run({ garden: null }));
add('missing-garden-empty', () => run({ garden: '' }));
add('admission-denied-zero-client-query', () => run({ denied: true }));
add('client-throws-unavailable', () => run({ clientThrows: true }));
for (let i = 0; i < 4; i++) add(`rejected-source-${i}`, () => run({ modes: { [i]: 'reject' } }));
for (let i = 0; i < 4; i++) add(`builder-throws-source-${i}`, () => run({ modes: { [i]: 'builder' } }));
add('mixed-failure-keeps-healthy-camera', () => run({ modes: { 1: 'error', 2: 'reject', 3: 'builder' } }));
add('healthy-pending-list-remains-bounded', () => run({ longPending: true }));
add('static-exact-four-query-chains-and-admission', () => {
  totals.staticCases++;
  const env = { PATH: process.env.PATH, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  const baseline = execFileSync('git', ['--no-lazy-fetch', '-C', root, 'show', `a4f3661bfe0aa3beb39edce557bcc77e587eaeda:${pagePath}`], { env, encoding: 'utf8' });
  function chains(text) {
    const file = ts.createSourceFile(pagePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(file.parseDiagnostics.length, 0);
    const found = [];
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'limit' && node.getText(file).startsWith('supabase.from(')) found.push(node.getText(file));
      ts.forEachChild(node, visit);
    };
    visit(file); return found;
  }
  assert.equal(chains(pageText).length, 4); assert.deepEqual(chains(pageText), chains(baseline));
  assert(pageText.indexOf('await requireRole(["manager", "owner"])') < pageText.indexOf('await safeAdminData('));
  assert(pageText.indexOf('if (!gardenId) return unavailable;') < pageText.indexOf('await createClient()'));
});
assert.equal(cases.length, 24); assert.equal(new Set(cases.map((entry) => entry.id)).size, 24);
console.log('CASE_REGISTRY', JSON.stringify(cases.map((entry) => entry.id)));
for (const entry of cases) test(entry.id, entry.body);
after(() => { assert.equal(totals.forbiddenEffects, 0); console.log('OBSERVATIONS', JSON.stringify(totals)); });
