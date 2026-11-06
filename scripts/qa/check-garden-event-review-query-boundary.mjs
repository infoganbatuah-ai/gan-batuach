// Offline actual-page functions, closed SDK/Auth fixtures, opaque review panels.
// No actions/effects/media/provider code; not browser/lifecycle/DB/RLS/full-stack proof.
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
const contracts = {
  ai: {
    file: 'app/dashboard/garden/ai-events/page.tsx', panel: 'AiCameraEventsReview',
    titles: ['ממתינים לבדיקה', 'אירועים', 'מצלמות'], subtitle: 'אירועי תצפיתן לבדיקה',
    policy: 'אינדיקציות לבדיקה אנושית בלבד, בלי מסקנות אוטומטיות',
    sectionPolicy: 'כל פעולה נשארת בבדיקת אדם ומוגבלת לגן הנוכחי',
    links: ['/dashboard/garden/cameras', '/dashboard/garden/insights', '/dashboard/garden/risk'],
    queries: [['ai_camera_events', '*, gardens(name), camera_streams(name, area)', 'kindergarten_id', 'created_at', { ascending: false }, 100]]
  },
  audio: {
    file: 'app/dashboard/garden/audio-events/page.tsx', panel: 'AudioObserverEventsPanel',
    titles: ['אינדיקציות', 'מקורות', 'מצב פרטיות'], subtitle: 'תצפיתן דיגיטלי',
    policy: 'אין תמלול שיחות ואין זיהוי קולי. כל סימן דורש בדיקת אדם',
    sectionPolicy: 'שפה זהירה, ללא חשיפה להורים לפני בדיקה',
    links: ['/dashboard/garden/ai-events', '/dashboard/garden/cameras', '/dashboard/garden/observer-watch'],
    queries: [['audio_observer_events', '*, camera_streams(name)', 'kindergarten_id', 'created_at', { ascending: false }, 150],
      ['camera_streams', 'id, name, garden_id', 'garden_id', 'name', null, 200]]
  }
};
const texts = Object.fromEntries(Object.entries(contracts).map(([kind, c]) => [kind, read(c.file)]));
const code = Object.fromEntries(Object.entries(contracts).map(([kind, c]) => [kind, compile(texts[kind], c.file)]));
const safeCode = compile(read('lib/admin-safe.ts'), 'admin-safe.ts');
const totals = { pageCalls: 0, deniedAdmissions: 0, forbiddenEffects: 0, staticCases: 0 };
const denied = new Error('SYNTHETIC_ADMISSION_DENIED');
function elements(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => elements(item, result));
  else if (node && typeof node === 'object' && 'type' in node) { result.push(node); elements(node.props?.children, result); }
  return result;
}
async function run(kind, options = {}) {
  totals.pageCalls++;
  const c = contracts[kind], garden = Object.hasOwn(options, 'garden') ? options.garden : 'garden-approved';
  const state = { clients: 0, queries: [], loaded: null, warnings: [] }, modes = options.modes ?? {};
  const aiRows = ['new', 'pending', 'review', 'confirmed', 'reviewing', null, 'new', 'dismissed'].map((status, i) => ({ id: `ai-${i}`, status, camera_id: ['cam-a', 'cam-a', 'cam-b', 'cam-c', null, '', 0, undefined][i], kindergarten_id: 'garden-approved', gardens: { name: 'Synthetic Garden' }, camera_streams: { name: `Camera ${i}`, area: 'Synthetic Room' } }));
  const audioRows = Array.from({ length: 4 }, (_, i) => ({ id: `audio-${i}`, kindergarten_id: 'garden-approved', camera_streams: { name: `Audio Source ${i}` }, review_status: 'pending_review' }));
  const cameraRows = Array.from({ length: 3 }, (_, i) => ({ id: `camera-${i}`, name: `Camera ${i}`, garden_id: 'garden-approved' }));
  const rows = kind === 'ai' ? [aiRows] : [audioRows, cameraRows];
  const effect = () => { totals.forbiddenEffects++; throw new Error('FORBIDDEN_EFFECT'); };
  function evaluate(source, filename, importer) {
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, require: importer,
      console: { warn: (...args) => state.warnings.push(args) }, fetch: effect, FormData: effect,
      process: new Proxy({}, { get: effect }) });
    new vm.Script(source, { filename }).runInContext(context, { timeout: 1000 }); return module.exports;
  }
  const safe = evaluate(safeCode, 'actual-safe-helper', effect);
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const page = evaluate(code[kind], c.file, (name) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === '@/lib/auth') return { requireRole: async (roles) => {
      assert.deepEqual(plain(roles), ['manager', 'owner']);
      assert.equal(state.clients, 0); assert.equal(state.queries.length, 0); assert.equal(state.warnings.length, 0);
      if (options.denied) { totals.deniedAdmissions++; throw denied; }
      return { profile: { role: options.role ?? 'manager', garden_id: garden, full_name: '[DEMO] Owner Person', profile_image_url: 'synthetic-avatar' } };
    } };
    if (name === '@/lib/admin-safe') return { ...safe, safeAdminData: async (...args) => {
      const result = await safe.safeAdminData(...args); state.loaded = plain(result.data); return result;
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
    if (['lucide-react', '@/components/teacher-app-ui', '@/components/ai-camera-events-review', '@/components/audio-observer-events-panel'].includes(name)) return new Proxy({}, { get: (_, key) => String(key) });
    return effect();
  });
  if (options.denied) {
    await assert.rejects(page.default, (error) => error === denied);
    assert.equal(state.clients, 0); assert.equal(state.queries.length, 0); assert.equal(state.loaded, null); assert.deepEqual(state.warnings, []); return;
  }
  const tree = await page.default(), nodes = elements(tree), of = (type) => nodes.filter((node) => node.type === type);
  const unavailable = c.queries.map((_, i) => !garden || options.clientThrows || Boolean(modes[i]));
  const availableRows = rows.map((data, i) => unavailable[i] || options.empty || options.nullData ? [] : data);
  assert.equal(state.clients, garden ? 1 : 0); assert.equal(state.queries.length, garden && !options.clientThrows ? c.queries.length : 0);
  state.queries.forEach((calls, i) => {
    const [table, select, scope, order, orderOptions, limit] = c.queries[i], expected = [['from', table]];
    if (modes[i] !== 'builder') expected.push(['select', select], ['eq', scope, garden], orderOptions ? ['order', order, orderOptions] : ['order', order], ['limit', limit]);
    assert.deepEqual(plain(calls), expected);
  });
  const loadedRows = kind === 'ai' ? [state.loaded.rows] : state.loaded.rows;
  const loadedAvailability = kind === 'ai' ? [state.loaded.available] : state.loaded.available;
  assert.deepEqual(loadedAvailability, unavailable.map((value) => !value));
  loadedRows.forEach((data, i) => assert.deepEqual(data, plain(availableRows[i]), 'failed stale payload must be discarded'));
  const cards = of('TeacherStatCard'); assert.equal(cards.length, 3);
  assert.deepEqual(cards.map((node) => node.props.title), c.titles);
  let values, tones;
  if (kind === 'ai') {
    const events = availableRows[0], pending = events.filter((event) => ['new', 'pending', 'review'].includes(event.status ?? '')).length;
    const distinct = new Set(events.map((event) => event.camera_id).filter(Boolean)).size;
    if (!unavailable[0] && !options.empty && !options.nullData) { assert.equal(pending, 4); assert.equal(distinct, 3); }
    values = unavailable[0] ? ['לא זמין', 'לא זמין', 'לא זמין'] : [pending, events.length, distinct];
    tones = unavailable[0] ? ['neutral', 'neutral', 'neutral'] : [pending ? 'orange' : 'green', 'purple', 'blue'];
  } else {
    values = [unavailable[0] ? 'לא זמין' : availableRows[0].length, unavailable[1] ? 'לא זמין' : availableRows[1].length, 'מוגבל'];
    tones = [unavailable[0] ? 'neutral' : 'purple', unavailable[1] ? 'neutral' : 'blue', 'green'];
    assert.equal(cards[2].props.hint, 'ללא תמלול'); // Static policy label, not live privacy proof.
  }
  cards.forEach((node, i) => { assert.equal(node.props.value, values[i]); assert.equal(node.props.tone, tones[i]); });
  const panelReady = Boolean(garden) && unavailable.every((value) => !value), panels = of(c.panel);
  assert.equal(panels.length, panelReady ? 1 : 0); assert.equal(of('TeacherEmptyState').length, panelReady ? 0 : 1);
  if (panelReady) {
    const expected = kind === 'ai' ? { events: availableRows[0], role: 'garden' } : { role: 'garden', fixedKindergartenId: garden, events: availableRows[0], cameras: availableRows[1] };
    assert.deepEqual(plain(panels[0].props), plain(expected), 'complete original panel payload only');
  } else assert.match(of('TeacherEmptyState')[0].props.title, /אינם זמינים/);
  const frame = of('TeacherAppFrame')[0].props;
  assert.equal(frame.title, 'בוקר טוב, Owner'); assert.equal(frame.subtitle, c.subtitle); assert.equal(frame.avatarUrl, 'synthetic-avatar'); assert.equal(frame.active, 'more');
  assert.equal(of('TeacherPageTitle')[0].props.subtitle, c.policy);
  assert.equal(of('TeacherSection')[0].props.subtitle, c.sectionPolicy);
  assert.deepEqual(of('TeacherActionTile').map((node) => node.props.href), c.links);
  assert(!JSON.stringify({ tree, warnings: state.warnings }).includes('PRIVATE_DIAGNOSTIC'));
}
const cases = [];
const add = (id, body) => cases.push({ id, body });
for (const kind of ['ai', 'audio']) {
  for (const role of ['manager', 'owner']) add(`${kind}-healthy-${role}`, () => run(kind, { role }));
  add(`${kind}-healthy-empty`, () => run(kind, { empty: true }));
  add(`${kind}-healthy-null`, () => run(kind, { nullData: true }));
  for (let i = 0; i < contracts[kind].queries.length; i++) {
    for (const mode of ['error', 'reject', 'builder']) add(`${kind}-${mode}-source-${i}`, () => run(kind, { modes: { [i]: mode } }));
  }
  add(`${kind}-missing-garden-null`, () => run(kind, { garden: null }));
  add(`${kind}-missing-garden-empty`, () => run(kind, { garden: '' }));
  add(`${kind}-admission-denied`, () => run(kind, { denied: true }));
  add(`${kind}-client-throws`, () => run(kind, { clientThrows: true }));
}
add('ai-error-empty-is-unavailable', () => run('ai', { empty: true, modes: { 0: 'error' } }));
add('audio-all-error-empty-is-unavailable', () => run('audio', { empty: true, modes: { 0: 'error', 1: 'error' } }));
add('static-exact-three-chains-and-admission', () => {
  totals.staticCases++;
  const env = { PATH: process.env.PATH, GIT_NO_LAZY_FETCH: '1', GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' };
  function chains(text, fileName) {
    const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); assert.equal(file.parseDiagnostics.length, 0);
    const found = [];
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'limit' && node.getText(file).startsWith('supabase.from(')) found.push(node.getText(file));
      ts.forEachChild(node, visit);
    };
    visit(file); return found;
  }
  let total = 0;
  for (const [kind, c] of Object.entries(contracts)) {
    const before = execFileSync('git', ['--no-lazy-fetch', '-C', root, 'show', `a4f3661bfe0aa3beb39edce557bcc77e587eaeda:${c.file}`], { env, encoding: 'utf8' });
    const current = chains(texts[kind], c.file); assert.equal(current.length, c.queries.length); assert.deepEqual(current, chains(before, c.file)); total += current.length;
    assert(texts[kind].indexOf('await requireRole(["manager", "owner"])') < texts[kind].indexOf('await safeAdminData('));
    const guard = kind === 'ai' ? 'if (!profile.garden_id) return unavailable;' : 'if (!gardenId) return unavailable;';
    assert(texts[kind].indexOf(guard) < texts[kind].indexOf('await createClient()'));
  }
  assert.equal(total, 3);
});
assert.equal(cases.length, 28); assert.equal(new Set(cases.map((entry) => entry.id)).size, 28);
console.log('CASE_REGISTRY', JSON.stringify(cases.map((entry) => entry.id)));
for (const entry of cases) test(entry.id, entry.body);
after(() => { assert.equal(totals.forbiddenEffects, 0); console.log('OBSERVATIONS', JSON.stringify(totals)); });
