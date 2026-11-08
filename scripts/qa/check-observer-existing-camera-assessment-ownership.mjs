import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Closed VM: this script never contacts the application or any camera.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = resolve(root, 'components/digital-observer/camera-onboarding-status.tsx');
assert.ok(statSync(path).isFile());
if (process.platform === 'darwin') {
  const value = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim();
  assert.match(value, /^\d+$/);
  const flags = Number(value);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless source before reading');
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const good = (recommendation = 'DIRECT_CONNECTION_AVAILABLE', reasonCodes = []) => ({ data: { assessment: { recommendation, reasonCodes } } });
const initial = { observerSiteId: 'site-a', source: { id: 'camera-a', display_name: 'Camera A' } };
function harness() {
  let slots = [], cursor = 0, effects = [], tree, key, inner, props, mounted = false;
  let tokens = 0, writes = 0;
  const requests = [];
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(value) {
      const index = cursor++, cells = slots;
      if (!(index in cells)) cells[index] = typeof value === 'function' ? value() : value;
      return [cells[index], next => { writes++; cells[index] = typeof next === 'function' ? next(cells[index]) : next; }];
    },
    useRef(value) { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; },
    useLayoutEffect(setup, deps) {
      const index = cursor++;
      const old = effects[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) effects[index] = { setup, deps, pending: true, cleanup: old?.cleanup };
    }
  };
  const exported = {};
  const context = vm.createContext({ exports: exported, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return Object.fromEntries(['Check', 'CircleAlert', 'LoaderCircle', 'RefreshCw', 'Router', 'ShieldCheck'].map(name => [name, name]));
    if (name === '@/lib/domain/digital-observer/client-session') return { readObserverAccessToken() { tokens++; return 'development-token'; } };
    throw Error(`Unexpected import ${name}`);
  }, fetch(url, options) { const gate = deferred(); requests.push({ url, options, gate }); return gate.promise; } });
  new vm.Script(compiled, { filename: path }).runInContext(context, { timeout: 1000 });
  function cleanup() { for (const effect of effects) if (effect?.cleanup) { effect.cleanup(); effect.cleanup = undefined; } }
  function render(next = props || initial) {
    props = next;
    const wrapper = exported.CameraOnboardingStatus(next);
    assert.equal(typeof wrapper.type, 'function');
    if (!mounted || wrapper.key !== key || wrapper.type !== inner) {
      cleanup(); slots = []; effects = []; key = wrapper.key; inner = wrapper.type; mounted = true;
    }
    cursor = 0; tree = inner(wrapper.props);
    let rerender = false;
    for (const effect of effects) if (effect?.pending) { effect.cleanup?.(); effect.pending = false; const before = writes; effect.cleanup = effect.setup(); if (before !== writes) rerender = true; }
    if (rerender) { cursor = 0; tree = inner(wrapper.props); }
    return tree;
  }
  function visit(node, predicate, found) {
    if (Array.isArray(node)) { for (const item of node) visit(item, predicate, found); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) found.push(node);
    visit(node.props?.children, predicate, found);
  }
  const nodes = predicate => { const found = []; visit(tree, predicate, found); return found; };
  function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return textOf(node.props?.children);
  }
  const button = () => { const found = nodes(node => node.type === 'button'); assert.equal(found.length, 1); return found[0]; };
  function reconnect() { cleanup(); for (const effect of effects) if (effect) effect.pending = true; render(); }
  function poison() { const reads = []; return { reads, value: new Proxy({}, { get(_, name) { if (name === 'then') return undefined; reads.push(String(name)); throw Error('obsolete property read'); } }) }; }
  render();
  return { render, button, requests, reconnect, poison, cleanup, text: () => textOf(tree), snapshot: () => ({ writes, tokens, requests: requests.length }),
    click() { button().props.onClick(); },
    async respond(payload = good(), ok = true) { const request = requests.at(-1); request.gate.resolve({ ok, json: async () => payload }); await tick(); render(); },
    async jsonStage() { const gate = deferred(); requests.at(-1).gate.resolve({ ok: true, json: () => gate.promise }); await tick(); return gate; }
  };
}

test('idle is explicit, private and non-destructive; no automatic transport', () => {
  const h = harness(); assert.match(h.text(), /טרם נבדק/); assert.doesNotMatch(h.text(), /בודק…/);
  assert.match(h.text(), /לא ניצור מקור נוסף/); assert.match(h.text(), /סיסמאות/); assert.equal(h.requests.length, 0);
});
test('current button performs exact authenticated non-persisting request; synchronous duplicate denied', async () => {
  const h = harness(); const handler = h.button().props.onClick; handler(); handler();
  assert.deepEqual(h.snapshot(), { writes: 3, tokens: 1, requests: 1 });
  const r = h.requests[0]; assert.equal(r.url, '/api/digital-observer/connection-assessment');
  assert.deepEqual(copy(r.options), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer development-token' }, body: JSON.stringify({ action: 'assess_existing', observer_site_id: 'site-a', camera_source_id: 'camera-a', persist: false }) });
  h.render(); assert.equal(h.button().props.disabled, true); assert.match(h.text(), /בודק…/);
  await h.respond(); assert.equal(h.button().props.disabled, false); assert.match(h.text(), /חיבור דיגיטלי זמין/);
});
for (const [recommendation, label] of [['DIRECT_CONNECTION_AVAILABLE', 'חיבור דיגיטלי זמין'], ['SOFTWARE_CONNECTOR_REQUIRED', 'נדרש Connector'], ['PHYSICAL_GATEWAY_REQUIRED', 'Gateway מקומי מוצדק'], ['ENTERPRISE_EDGE_RECOMMENDED', 'מומלץ Edge ארגוני'], ['UNSUPPORTED_SYSTEM', 'נדרשים פרטים נוספים'], ['FUTURE_SAFE_RECOMMENDATION', 'FUTURE_SAFE_RECOMMENDATION']]) {
  test(`ready recommendation ${recommendation}`, async () => { const h = harness(); h.click(); await h.respond(good(recommendation)); assert.ok(h.text().includes(label)); assert.doesNotMatch(h.text(), /טרם נבדק|לא זמינה|בודק…/); });
}
test('local bridge reason preserved', async () => { const h = harness(); h.click(); await h.respond(good('PHYSICAL_GATEWAY_REQUIRED', ['LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE'])); assert.match(h.text(), /המקליט זמין רק ברשת המקומית/); });
for (const [name, payload] of Object.entries({ absent: {}, nullData: { data: null }, nullAssessment: { data: { assessment: null } }, missingRecommendation: { data: { assessment: { reasonCodes: [] } } }, empty: good(''), whitespace: good('  '), numeric: good(3), nullReasons: good('VALID', null), stringReasons: good('VALID', 'reason'), invalidReason: good('VALID', [1]) })) {
  test(`malformed success ${name} unavailable and explicit retry works`, async () => {
    const h = harness(); h.click(); await h.respond(payload); assert.match(h.text(), /לא זמינה/); assert.equal(h.button().props.disabled, false);
    assert.doesNotMatch(h.text(), /בודק…/); h.click(); await h.respond(); assert.match(h.text(), /חיבור דיגיטלי זמין/);
  });
}
for (const failure of ['http', 'fetch', 'json']) test(`current ${failure} clears previous successful assessment`, async () => {
  const h = harness(); h.click(); await h.respond(); h.click(); h.render(); assert.doesNotMatch(h.text(), /חיבור דיגיטלי זמין/);
  if (failure === 'http') await h.respond({ error: 'Denied' }, false);
  else if (failure === 'fetch') { h.requests.at(-1).gate.reject(Error('offline')); await tick(); h.render(); }
  else { const gate = await h.jsonStage(); gate.reject(Error('malformed json')); await tick(); h.render(); }
  assert.match(h.text(), /לא זמינה/); assert.equal(h.button().props.disabled, false); h.click(); await h.respond(); assert.match(h.text(), /חיבור דיגיטלי זמין/);
});
for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'site', 'source', 'roundtrip', 'layout']) for (const failure of [false, true]) {
  test(`${stage} ${loss} ${failure ? 'reject' : 'resolve'} cannot read obsolete response or unlock new request`, async () => {
    const h = harness(); const retained = h.button().props.onClick; retained();
    const gate = stage === 'json' ? await h.jsonStage() : h.requests[0].gate;
    if (loss === 'unmount') h.cleanup();
    else if (loss === 'layout') h.reconnect();
    else {
      h.render({ ...initial, observerSiteId: loss === 'source' ? 'site-a' : 'site-b', source: { ...initial.source, id: loss === 'site' ? 'camera-a' : 'camera-b' } });
      if (loss === 'roundtrip') h.render(initial);
    }
    if (loss !== 'unmount') { assert.equal(h.button().props.disabled, false); h.click(); h.render(); }
    const before = h.snapshot(), poison = h.poison();
    if (failure) gate.reject(poison.value); else gate.resolve(poison.value);
    await tick(); assert.deepEqual(h.snapshot(), before); assert.deepEqual(poison.reads, []);
    if (loss !== 'unmount') {
      h.render(); assert.equal(h.button().props.disabled, true); const current = h.button().props.onClick; current(); assert.deepEqual(h.snapshot(), before);
      await h.respond(); assert.match(h.text(), /חיבור דיגיטלי זמין/);
    }
    if (loss !== 'layout') { const after = h.snapshot(); retained(); await tick(); assert.deepEqual(h.snapshot(), after); }
  });
}
test('same target metadata refresh retains pending request and assessment; latest display and health render', async () => {
  const h = harness(); h.click();
  const fresh = { ...initial, source: { ...initial.source, display_name: 'Fresh display', status: 'connected', health_status: 'healthy', source_mode: 'live', last_seen_at: 'present' } };
  h.render(fresh); assert.equal(h.button().props.disabled, true); assert.match(h.text(), /Fresh display/); assert.match(h.text(), /Streaming \/ AI מוכן/);
  await h.respond(); h.render({ ...fresh, source: { ...fresh.source, status: 'offline' } });
  assert.match(h.text(), /חיבור דיגיטלי זמין/); assert.match(h.text(), /לא מאומת כפעיל/); assert.equal(h.requests.length, 1);
});
test('Site/source changes reset settled data without automatic assessment', async () => {
  const h = harness(); h.click(); await h.respond();
  for (const next of [{ ...initial, observerSiteId: 'site-b' }, { ...initial, source: { ...initial.source, id: 'camera-b' } }, initial]) {
    h.render(next); assert.match(h.text(), /טרם נבדק/); assert.doesNotMatch(h.text(), /חיבור דיגיטלי זמין/); assert.equal(h.requests.length, 1);
  }
});
for (const [name, changes, healthy] of [
  ['live', {}, true], ['gateway test', { source_mode: 'gateway_test' }, true],
  ['offline', { status: 'offline' }, false], ['unhealthy', { health_status: 'unhealthy' }, false],
  ['recorded', { source_mode: 'recorded' }, false], ['missing seen', { last_seen_at: null }, false],
  ['old seen presence preserved', { last_seen_at: '2000-01-01' }, true]
]) test(`unchanged metadata-only healthyLive ${name}`, () => {
  const h = harness(); h.render({ ...initial, source: { ...initial.source, status: 'connected', health_status: 'healthy', source_mode: 'live', last_seen_at: 'present', ...changes } });
  assert.ok(h.text().includes(healthy ? 'Streaming / AI מוכן' : 'לא מאומת כפעיל')); assert.equal(h.requests.length, 0);
});
