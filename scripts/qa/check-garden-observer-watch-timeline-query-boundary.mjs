// Offline actual-page contract checks. Child panels and all live services stay opaque.
// This is not browser, React lifecycle, RLS, or PostgreSQL integration proof.
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const plain = (value) => JSON.parse(JSON.stringify(value));
function read(relative) {
  const file = path.join(root, relative);
  const stat = fs.statSync(file);
  assert.equal((stat.flags ?? 0) & 0x40000000, 0, 'dataless source forbidden');
  return fs.readFileSync(file, 'utf8');
}
const pagePaths = {
  watch: 'app/dashboard/garden/observer-watch/page.tsx',
  timeline: 'app/dashboard/garden/correlated-events/page.tsx'
};
const compile = (text, name) => ts.transpileModule(text, {
  fileName: name,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const code = Object.fromEntries(Object.entries(pagePaths).map(([kind, file]) => [kind, compile(read(file), file)]));
const safeCode = compile(read('lib/admin-safe.ts'), 'admin-safe.ts');
const contracts = {
  watch: {
    panel: 'ObserverWatchRequestsPanel', keys: ['requests', 'cameras', 'zones'], metric: [0, 1, 2],
    titles: ['בקשות', 'מצלמות', 'אזורים'], subtitle: 'בקשות מעקב לתצפיתן',
    queries: [
      ['observer_watch_requests', '*, gardens(name), camera_streams(name), camera_zones(name, zone_type)', 'kindergarten_id', 'created_at', { ascending: false }, 200],
      ['camera_streams', 'id, name, garden_id, observer_site_id', 'garden_id', 'name', null, 200],
      ['camera_zones', 'id, name, zone_type, kindergarten_id, observer_site_id', 'kindergarten_id', 'name', null, 200]
    ],
    links: ['/dashboard/garden/cameras', '/dashboard/garden/ai-events', '/dashboard/garden/correlated-events']
  },
  timeline: {
    panel: 'CorrelatedEventsPanel', keys: ['events', 'links', 'cameras', 'zones'], metric: [0, 1, 3],
    titles: ['אירועים', 'קישורים', 'אזורים'], subtitle: 'צירי זמן תצפיתן',
    queries: [
      ['observer_correlated_events', '*', 'kindergarten_id', 'created_at', { ascending: false }, 150],
      ['observer_correlated_event_links', '*, camera_streams(name), camera_zones(name, zone_type)', 'kindergarten_id', 'sequence_order', { ascending: true }, 500],
      ['camera_streams', 'id, name, garden_id, kindergarten_id', 'OR', 'name', null, 200],
      ['camera_zones', 'id, name, kindergarten_id, camera_id', 'kindergarten_id', 'name', null, 200]
    ],
    links: ['/dashboard/garden/observer-watch', '/dashboard/garden/ai-events', '/dashboard/garden/cameras']
  }
};
const totals = { pageCalls: 0, deniedAdmissions: 0, forbiddenEffects: 0 };
const denied = new Error('SYNTHETIC_ADMISSION_DENIED');
function elements(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => elements(item, result));
  else if (node && typeof node === 'object' && 'type' in node) {
    result.push(node);
    elements(node.props?.children, result);
  }
  return result;
}
async function run(kind, options = {}) {
  totals.pageCalls++;
  const contract = contracts[kind];
  const garden = Object.hasOwn(options, 'garden') ? options.garden : 'garden-approved';
  const profile = { role: options.role ?? 'manager', garden_id: garden, full_name: '[DEMO] Owner Person', profile_image_url: 'synthetic-avatar' };
  const state = { clients: 0, queries: [], warnings: [], loaded: null };
  const modes = options.modes ?? {};
  const rows = contract.keys.map((key, index) => Array.from({ length: index + 1 }, (_, n) => ({ id: `${key}-${n}`, name: `synthetic-${key}-${n}` })));
  const effect = () => { totals.forbiddenEffects++; throw new Error('FORBIDDEN_LIVE_EFFECT'); };
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  function evaluate(source, filename, importer) {
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, require: importer,
      console: { warn: (...args) => state.warnings.push(args) }, fetch: effect, FormData: effect,
      process: new Proxy({}, { get: effect }) });
    new vm.Script(source, { filename }).runInContext(context, { timeout: 1000 });
    return module.exports;
  }
  const safe = evaluate(safeCode, 'actual-admin-safe', effect);
  const module = evaluate(code[kind], pagePaths[kind], (name) => {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (name === '@/lib/auth') return { requireRole: async (roles) => {
      assert.deepEqual(plain(roles), ['manager', 'owner']);
      assert.equal(state.clients, 0);
      assert.equal(state.queries.length, 0);
      assert.equal(state.warnings.length, 0);
      if (options.denied) { totals.deniedAdmissions++; throw denied; }
      return { profile };
    } };
    if (name === '@/lib/admin-safe') return { ...safe, safeAdminData: async (...args) => {
      const result = await safe.safeAdminData(...args);
      state.loaded = plain(result.data);
      return result;
    } };
    if (name === '@/lib/supabase/server') return { createClient: async () => {
      state.clients++;
      if (options.clientThrows) throw new Error('PRIVATE_DIAGNOSTIC_MUST_NOT_APPEAR');
      return { from(table) {
        const index = state.queries.length;
        const calls = [['from', table]];
        state.queries.push(calls);
        if (modes[index] === 'builder') throw new Error('PRIVATE_DIAGNOSTIC_MUST_NOT_APPEAR');
        const builder = {};
        for (const method of ['select', 'eq', 'or', 'order', 'limit']) {
          builder[method] = (...args) => { calls.push([method, ...args]); return builder; };
        }
        builder.then = (resolve, reject) => {
          if (modes[index] === 'reject') return Promise.reject(new Error('PRIVATE_DIAGNOSTIC_MUST_NOT_APPEAR')).then(resolve, reject);
          const data = options.empty ? [] : options.nullData ? null : rows[index];
          return Promise.resolve({ data, error: modes[index] === 'error' ? { message: 'PRIVATE_DIAGNOSTIC_MUST_NOT_APPEAR' } : null }).then(resolve, reject);
        };
        return builder;
      } };
    } };
    if (name === 'lucide-react' || name === '@/components/teacher-app-ui' ||
        name === '@/components/observer-watch-requests-panel' || name === '@/components/correlated-events-panel') {
      return new Proxy({}, { get: (_, key) => String(key) });
    }
    return effect();
  });
  if (options.denied) {
    await assert.rejects(module.default, (error) => error === denied);
    assert.equal(state.clients, 0); assert.equal(state.queries.length, 0);
    assert.equal(state.loaded, null); assert.deepEqual(state.warnings, []);
    return;
  }
  const tree = await module.default();
  const nodes = elements(tree);
  const one = (type) => nodes.filter((node) => node.type === type);
  const unavailable = contract.keys.map((_, i) => !garden || options.clientThrows || Boolean(modes[i]));
  assert.equal(state.clients, garden ? 1 : 0);
  assert.equal(state.queries.length, garden && !options.clientThrows ? contract.keys.length : 0);
  for (const [i, calls] of state.queries.entries()) {
    const [table, select, scope, order, orderOptions, limit] = contract.queries[i];
    const expected = [['from', table]];
    if (modes[i] !== 'builder') {
      expected.push(['select', select], scope === 'OR' ? ['or', `garden_id.eq.${garden},kindergarten_id.eq.${garden}`] : ['eq', scope, garden]);
      expected.push(orderOptions ? ['order', order, orderOptions] : ['order', order], ['limit', limit]);
    }
    assert.deepEqual(plain(calls), expected, `${kind} exact scoped query ${i}`);
  }
  assert.deepEqual(state.loaded.available, unavailable.map((value) => !value));
  for (let i = 0; i < rows.length; i++) {
    assert.deepEqual(state.loaded.rows[i], unavailable[i] || options.empty || options.nullData ? [] : rows[i], 'stale failed rows discarded');
  }
  const cards = one('TeacherStatCard');
  assert.equal(cards.length, 3);
  cards.forEach(({ props }, index) => {
    const source = contract.metric[index];
    assert.equal(props.title, contract.titles[index]);
    assert.equal(props.value, unavailable[source] ? 'לא זמין' : options.empty || options.nullData ? 0 : rows[source].length);
    assert.equal(props.tone, unavailable[source] ? 'neutral' : ['purple', 'blue', 'green'][index]);
  });
  const ready = unavailable.every((value) => !value);
  const panels = one(contract.panel);
  assert.equal(panels.length, ready ? 1 : 0);
  assert.equal(one('TeacherEmptyState').length, ready ? 0 : 1);
  if (ready) {
    const expected = { role: 'garden', fixedKindergartenId: garden };
    contract.keys.forEach((key, i) => { expected[key] = options.empty || options.nullData ? [] : rows[i]; });
    assert.deepEqual(plain(panels[0].props), expected);
  } else assert.match(one('TeacherEmptyState')[0].props.title, /אינם זמינים/);
  const frame = one('TeacherAppFrame')[0].props;
  assert.equal(frame.title, 'בוקר טוב, Owner');
  assert.equal(frame.subtitle, contract.subtitle);
  assert.equal(frame.avatarUrl, 'synthetic-avatar'); assert.equal(frame.active, 'more');
  assert.deepEqual(one('TeacherActionTile').map((node) => node.props.href), contract.links);
  assert(!JSON.stringify({ tree, warnings: state.warnings }).includes('PRIVATE_DIAGNOSTIC_MUST_NOT_APPEAR'));
}
const cases = [];
const add = (id, body) => cases.push({ id, body });
for (const kind of ['watch', 'timeline']) {
  for (const role of ['manager', 'owner']) add(`${kind}-healthy-${role}`, () => run(kind, { role }));
  add(`${kind}-healthy-empty`, () => run(kind, { empty: true }));
  add(`${kind}-healthy-null`, () => run(kind, { nullData: true }));
  for (let index = 0; index < contracts[kind].keys.length; index++) {
    add(`${kind}-stale-error-${contracts[kind].keys[index]}`, () => run(kind, { modes: { [index]: 'error' } }));
  }
  add(`${kind}-missing-null`, () => run(kind, { garden: null }));
  add(`${kind}-missing-empty`, () => run(kind, { garden: '' }));
  add(`${kind}-admission-denied`, () => run(kind, { denied: true }));
  add(`${kind}-client-throws`, () => run(kind, { clientThrows: true }));
}
add('watch-rejected-request', () => run('watch', { modes: { 0: 'reject' } }));
add('timeline-builder-camera', () => run('timeline', { modes: { 2: 'builder' } }));
add('watch-mixed-errors-healthy-zone', () => run('watch', { modes: { 0: 'error', 1: 'reject' } }));
add('timeline-all-error-empty', () => run('timeline', { empty: true, modes: { 0: 'error', 1: 'error', 2: 'error', 3: 'error' } }));
add('route-availability-independent', async () => {
  await run('watch', { modes: { 2: 'error' } });
  await run('timeline');
});
assert.equal(cases.length, 28);
assert.equal(new Set(cases.map((entry) => entry.id)).size, 28);
console.log('CASE_REGISTRY', JSON.stringify(cases.map((entry) => entry.id)));
for (const entry of cases) test(entry.id, entry.body);
after(() => {
  assert.equal(totals.forbiddenEffects, 0);
  console.log('OBSERVATIONS', JSON.stringify(totals));
});
