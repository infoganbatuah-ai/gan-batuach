import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Actual conversation export only. The untouched identity-review export is never invoked.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = resolve(root, 'components/digital-observer/observer-intelligence-experience.tsx');
assert.ok(statSync(path).isFile());
if (process.platform === 'darwin') {
  const raw = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless source before reading');
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const code = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const initial = { siteId: 'site-a', cameraSourceId: 'camera-a', cameraName: 'Camera A' };
const answer = (text = 'Synthetic current answer', live = false) => ({ data: { answer: text, live_ai_used: live } });
function harness(accessToken = 'development-token') {
  let cells = [], effects = [], cursor = 0, tree, key, inner, props, mounted = false, writes = 0, tokens = 0, uuids = 0;
  const requests = [];
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  const react = {
    useState(value) {
      const index = cursor++, owned = cells;
      if (!(index in owned)) owned[index] = typeof value === 'function' ? value() : value;
      return [owned[index], next => { writes++; owned[index] = typeof next === 'function' ? next(owned[index]) : next; }];
    },
    useRef(value) { const index = cursor++; if (!(index in cells)) cells[index] = { current: value }; return cells[index]; },
    useLayoutEffect(setup, deps) { const index = cursor++, old = effects[index]; if (!old || changed(old.deps, deps)) effects[index] = { setup, deps, pending: true, cleanup: old?.cleanup }; }
  };
  const exported = {};
  const context = vm.createContext({ exports: exported,
    crypto: { randomUUID() { uuids++; return `synthetic-uuid-${uuids}`; } },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'next/navigation') return { useRouter() { throw Error('Forbidden identity review/router use'); } };
      if (name === '@/lib/domain/digital-observer/client-session') return { readObserverAccessToken() { tokens++; return accessToken; } };
      if (name === 'lucide-react') return Object.fromEntries(['AlertTriangle', 'BrainCircuit', 'Check', 'CircleHelp', 'LoaderCircle', 'MessageCircle', 'Radar', 'Send', 'ShieldCheck', 'Sparkles', 'UserRoundCheck', 'UserRoundX'].map(name => [name, name]));
      throw Error(`Unexpected import ${name}`);
    },
    fetch(url, options) { const gate = deferred(); requests.push({ url, options, gate }); return gate.promise; }
  });
  new vm.Script(code, { filename: path }).runInContext(context, { timeout: 1000 });
  function cleanup() { for (const effect of effects) if (effect?.cleanup) { effect.cleanup(); effect.cleanup = undefined; } }
  function render(next = props || initial) {
    props = next;
    const wrapper = exported.ObserverConversationPanel(next);
    assert.equal(typeof wrapper.type, 'function');
    if (!mounted || wrapper.key !== key || wrapper.type !== inner) { cleanup(); cells = []; effects = []; key = wrapper.key; inner = wrapper.type; mounted = true; }
    cursor = 0; tree = inner(wrapper.props);
    let rerender = false;
    for (const effect of effects) if (effect?.pending) {
      effect.cleanup?.(); effect.pending = false; const before = writes; effect.cleanup = effect.setup(); rerender ||= writes !== before;
    }
    if (rerender) { cursor = 0; tree = inner(wrapper.props); }
    return tree;
  }
  function visit(node, predicate, result) {
    if (Array.isArray(node)) { for (const child of node) visit(child, predicate, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    visit(node.props?.children, predicate, result);
  }
  const nodes = predicate => { const result = []; visit(tree, predicate, result); return result; };
  function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return textOf(node.props?.children);
  }
  const one = type => { const result = nodes(node => node.type === type); assert.equal(result.length, 1); return result[0]; };
  const suggestions = () => nodes(node => node.type === 'button' && node.props.type === 'button');
  const sendButton = () => nodes(node => node.type === 'button' && node.props.type === 'submit')[0];
  const messages = role => nodes(node => node.type === 'article' && node.props.className === `do-chat-message ${role}`);
  const messageTexts = role => messages(role).map(textOf);
  function type(value) { one('input').props.onChange({ target: { value } }); render(); }
  function submit(callback = one('form').props.onSubmit) { const event = { prevented: 0, preventDefault() { this.prevented++; } }; callback(event); return event; }
  function reconnect() { cleanup(); for (const effect of effects) if (effect) effect.pending = true; render(); }
  function poison() { const reads = []; return { reads, value: new Proxy({}, { get(_, field) { if (field === 'then') return undefined; reads.push(String(field)); throw Error('obsolete access'); } }) }; }
  render();
  return { render, nodes, one, suggestions, sendButton, messages, messageTexts, type, submit, cleanup, reconnect, poison, requests,
    text: () => textOf(tree), snapshot: () => ({ writes, tokens, uuids, requests: requests.length }),
    click(index = 0) { suggestions()[index].props.onClick(); },
    async respond(payload = answer(), ok = true) { requests.at(-1).gate.resolve({ ok, json: async () => payload }); await tick(); render(); },
    async jsonStage() { const gate = deferred(); requests.at(-1).gate.resolve({ ok: true, json: () => gate.promise }); await tick(); return gate; }
  };
}
function busy(h, value) { for (const button of h.suggestions()) assert.equal(button.props.disabled, value); }
function assertError(h) { assert.equal(h.nodes(node => node.props?.role === 'alert').length, 1); busy(h, false); assert.equal(h.messages('observer').length, 1); assert.equal(h.messages('user').length, 1); }

test('welcome, rule, suggestions and safety remain; no auto request/UUID/token', () => {
  const h = harness(); assert.deepEqual(h.snapshot(), { writes: 0, tokens: 0, uuids: 0, requests: 0 });
  assert.equal(h.messages('observer').length, 1); assert.ok(h.text().includes('אפשר לשאול מה קרה, מי נכנס, האם היה משהו חריג או לבקש ממני לשים לב למשהו מסוים.'));
  assert.ok(h.text().includes('אין חיוג חירום או פעולה אוטומטית מתוך השיחה. אירוע חריג תמיד מועבר לאישור אנושי.'));
  assert.match(h.text(), /שיחה על Camera A/); assert.match(h.text(), /ביקורת אנושית/); assert.match(h.text(), /מוכן להגדרה/);
  assert.deepEqual(h.suggestions().map(node => node.props.children), ['מה קרה כאן היום?', 'האם הייתה תנועה חריגה?', 'מי נכנס או יצא?', 'שים לב לכל שינוי במצלמה']);
});
for (const camera of [false, true]) test(`exact ${camera ? 'camera' : 'Site-only'} body/auth/POST contract`, async () => {
  const h = harness(); if (!camera) h.render({ siteId: 'site-a' }); h.type('  Current question  '); h.submit();
  assert.equal(h.requests.length, 1); const r = h.requests[0];
  assert.equal(r.url, '/api/digital-observer/conversation');
  assert.deepEqual(copy(r.options), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer development-token' }, body: JSON.stringify({ observer_site_id: 'site-a', ...(camera ? { camera_source_id: 'camera-a' } : {}), message: 'Current question' }) });
  h.render(); assert.equal(h.one('input').props.value, ''); assert.equal(h.messages('user').length, 1); await h.respond(); assert.equal(h.messages('observer').length, 2);
});
test('optional absent access token preserves original headers only', async () => {
  const h = harness(null); h.click(); assert.deepEqual(copy(h.requests[0].options.headers), { 'Content-Type': 'application/json' }); await h.respond();
});
test('trim/minimum two characters blocks without UUID/token/HTTP', () => {
  const h = harness(); for (const value of ['', ' ', ' a ']) { h.type(value); const before = h.snapshot(); h.submit(); assert.deepEqual(h.snapshot(), before); }
  assert.equal(h.requests.length, 0); assert.equal(h.messages('user').length, 0);
});
test('same-tick duplicate suggestions share synchronous busy', async () => {
  const h = harness(); const first = h.suggestions()[0].props.onClick, other = h.suggestions()[1].props.onClick;
  first(); first(); other(); assert.equal(h.requests.length, 1); assert.equal(h.snapshot().uuids, 1); h.render(); busy(h, true); await h.respond();
});
test('same-tick duplicate form prevents default for both and sends once', async () => {
  const h = harness(); h.type('Current question'); const callback = h.one('form').props.onSubmit;
  const a = h.submit(callback), b = h.submit(callback); assert.equal(a.prevented, 1); assert.equal(b.prevented, 1); assert.equal(h.requests.length, 1);
  h.render(); assert.equal(h.messages('user').length, 1); await h.respond();
});
test('retained form revision cannot submit older text after edit', async () => {
  const h = harness(); h.type('Old draft'); const old = h.one('form').props.onSubmit; h.type('New draft');
  const before = h.snapshot(); assert.equal(h.submit(old).prevented, 1); assert.deepEqual(h.snapshot(), before);
  h.submit(); assert.equal(JSON.parse(h.requests[0].options.body).message, 'New draft'); await h.respond();
});
for (const failure of [false, true]) test(`new input during pending survives ${failure ? 'failure' : 'reply'} and finally`, async () => {
  const h = harness(); h.type('Submitted draft'); h.submit(); h.render(); assert.equal(h.one('input').props.value, '');
  h.type('New unsent draft');
  if (failure) { h.requests[0].gate.reject(Error('offline')); await tick(); h.render(); } else await h.respond();
  assert.equal(h.one('input').props.value, 'New unsent draft'); assert.equal(h.requests.length, 1); busy(h, false);
  assert.ok(h.messageTexts('user')[0].includes('Submitted draft')); h.submit(); assert.equal(h.requests.length, 2); await h.respond();
});
for (const [live, label] of [[true, 'AI חי'], [false, 'המידע השמור באתר'], ['truthy', 'AI חי']]) test(`valid answer source metadata ${String(live)}`, async () => {
  const h = harness(); h.click(); await h.respond(answer('Future legitimate answer', live));
  assert.ok(h.messageTexts('observer')[1].includes('Future legitimate answer')); assert.ok(h.messageTexts('observer')[1].includes(label)); assert.equal(h.snapshot().uuids, 2);
});
for (const [name, payload] of Object.entries({ missing: {}, nullData: { data: null }, missingAnswer: { data: {} }, nullAnswer: { data: { answer: null } }, numeric: answer(42), empty: answer(''), blank: answer(' \n '), object: answer({ value: 'not text' }) })) {
  test(`invalid answer ${name} retains user, no fabricated reply, usable retry`, async () => {
    const h = harness(); h.click(); await h.respond(payload); assertError(h); assert.equal(h.snapshot().uuids, 1);
    h.click(); await h.respond(); assert.equal(h.messages('observer').length, 2); assert.equal(h.messages('user').length, 2);
  });
}
for (const failure of ['fetch', 'json', 'http']) test(`current ${failure} visible without observer reply; explicit retry`, async () => {
  const h = harness(); h.click();
  if (failure === 'fetch') h.requests[0].gate.reject(Error('offline'));
  else if (failure === 'json') { const gate = await h.jsonStage(); gate.reject(Error('bad JSON')); }
  else h.requests[0].gate.resolve({ ok: false, json: async () => ({ error: 'Current denial' }) });
  await tick(); h.render(); assertError(h); assert.equal(h.snapshot().uuids, 1); h.click(); await h.respond(); assert.equal(h.messages('observer').length, 2);
});
for (const boundary of ['fetch', 'json']) for (const loss of ['unmount', 'site', 'camera', 'removeCamera', 'siteRoundtrip', 'cameraRoundtrip', 'layout']) for (const rejected of [false, true]) {
  test(`${boundary}/${loss}/${rejected ? 'reject' : 'resolve'} obsolete request/handlers inert and cannot unlock current request`, async () => {
    const h = harness(); h.type('Old question'); const oldSubmit = h.one('form').props.onSubmit, oldSuggestion = h.suggestions()[0].props.onClick;
    h.submit(); h.render(); const gate = boundary === 'fetch' ? h.requests[0].gate : await h.jsonStage();
    if (loss === 'unmount') h.cleanup();
    else if (loss === 'layout') h.reconnect();
    else {
      const next = loss === 'site' || loss === 'siteRoundtrip' ? { ...initial, siteId: 'site-b' } : loss === 'removeCamera' ? { siteId: initial.siteId } : { ...initial, cameraSourceId: 'camera-b', cameraName: 'Camera B' };
      h.render(next); if (loss === 'siteRoundtrip' || loss === 'cameraRoundtrip') h.render(initial);
    }
    if (loss !== 'unmount') { busy(h, false); h.type('Current question'); h.submit(); h.render(); busy(h, true); }
    const before = h.snapshot(), poison = h.poison();
    if (rejected) gate.reject(poison.value); else gate.resolve(poison.value);
    await tick(); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
    const badEvent = h.poison(); oldSubmit(badEvent.value); oldSuggestion(); assert.deepEqual(badEvent.reads, []); assert.deepEqual(h.snapshot(), before);
    if (loss !== 'unmount') {
      h.render(); busy(h, true); h.submit(); assert.deepEqual(h.snapshot(), before);
      h.type('Preserved current unsent text'); await h.respond(); assert.equal(h.one('input').props.value, 'Preserved current unsent text');
      assert.ok(h.messageTexts('observer').at(-1).includes('Synthetic current answer')); busy(h, false);
    }
  });
}
test('same-context metadata refresh keeps draft/request/history, updates camera/rule and does not auto ask', async () => {
  const h = harness(); h.type('Draft A');
  const fresh = { ...initial, cameraName: 'Latest Camera', initialPrompt: 'New seed not a history reset', ruleSummary: { title: 'Latest Rule', description: 'Latest Description', active: true } };
  h.render(fresh); assert.equal(h.one('input').props.value, 'Draft A'); assert.equal(h.requests.length, 0); assert.match(h.text(), /Latest Camera/); assert.match(h.text(), /Latest Rule/); assert.match(h.text(), /Latest Description/);
  assert.ok(h.messageTexts('observer')[0].includes('אפשר לשאול')); h.submit(); h.render({ ...fresh, cameraName: 'Newest Camera' });
  assert.equal(h.requests.length, 1); busy(h, true); await h.respond(); assert.match(h.text(), /Newest Camera/); assert.equal(h.messages('observer').length, 2);
});
test('context reset gets new welcome and clears previous draft/error/history without IO', async () => {
  const h = harness(); h.click(); await h.respond({ data: null }); h.type('Old unsent draft');
  const count = h.requests.length; h.render({ siteId: 'site-b', initialPrompt: 'New context welcome' });
  assert.equal(h.messages('observer').length, 1); assert.match(h.text(), /New context welcome/); assert.equal(h.messages('user').length, 0); assert.equal(h.one('input').props.value, '');
  assert.equal(h.nodes(node => node.props?.role === 'alert').length, 0); assert.equal(h.requests.length, count); busy(h, false);
});
test('obsolete HTTP status/JSON access denied before response properties', async () => {
  const h = harness(); h.click(); const gate = h.requests[0].gate; h.render({ siteId: 'site-b' });
  const reads = [], before = h.snapshot(); gate.resolve({ get ok() { reads.push('ok'); throw Error('old status'); }, get json() { reads.push('json'); throw Error('old json'); } });
  await tick(); assert.deepEqual(reads, []); assert.deepEqual(h.snapshot(), before);
});
test('old input handler cannot inspect event after context loss', () => {
  const h = harness(); const old = h.one('input').props.onChange; h.render({ siteId: 'site-b' });
  const before = h.snapshot(), poison = h.poison(); old(poison.value); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
});
test('suggestion explicitly sends clicked text and clears submitted draft only at start', async () => {
  const h = harness(); h.type('Different typed draft'); const clicked = h.suggestions()[2].props.children; h.click(2); h.render();
  assert.equal(JSON.parse(h.requests[0].options.body).message, clicked); assert.equal(h.one('input').props.value, ''); await h.respond();
});
test('layout reconnect after settled conversation preserves history/draft without automatic transport', async () => {
  const h = harness(); h.click(); await h.respond(); h.type('Unsent after reply'); const count = h.requests.length;
  h.reconnect(); assert.equal(h.requests.length, count); assert.equal(h.messages('observer').length, 2); assert.equal(h.one('input').props.value, 'Unsent after reply'); busy(h, false);
  h.submit(); await h.respond(); assert.equal(h.requests.length, count + 1);
});
