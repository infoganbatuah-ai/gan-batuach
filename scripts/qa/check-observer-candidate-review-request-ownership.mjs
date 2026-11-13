import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Synthetic candidate descriptors only; no image loads or identity/provider operation.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = resolve(root, 'components/digital-observer/observer-intelligence-experience.tsx');
assert.ok(statSync(path).isFile());
if (process.platform === 'darwin') {
  const raw = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless source before content read');
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const code = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const initial = { candidate: { id: 'synthetic-candidate-a', candidate_status: 'ready_for_review', preview_available: false, observation_count: 3, suggested_label: 'Synthetic Candidate', average_confidence: 0.82 }, cameraName: 'Synthetic Camera' };
const success = message => ({ data: { message } });
function harness() {
  let cells = [], effects = [], cursor = 0, tree, key, inner, props, mounted = false, writes = 0, tokens = 0, refreshes = 0, refreshCallback;
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
  const router = { refresh() { refreshes++; refreshCallback?.(); } };
  const exported = {};
  const context = vm.createContext({ exports: exported, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'next/navigation') return { useRouter() { return router; } };
    if (name === '@/lib/domain/digital-observer/client-session') return { readObserverAccessToken() { tokens++; return 'development-token'; } };
    if (name === 'lucide-react') return Object.fromEntries(['AlertTriangle', 'BrainCircuit', 'Check', 'CircleHelp', 'LoaderCircle', 'MessageCircle', 'Radar', 'Send', 'ShieldCheck', 'Sparkles', 'UserRoundCheck', 'UserRoundX'].map(name => [name, name]));
    throw Error(`Unexpected import ${name}`);
  }, fetch(url, options) { const gate = deferred(); requests.push({ url, options, gate }); return gate.promise; } });
  new vm.Script(code, { filename: path }).runInContext(context, { timeout: 1000 });
  function cleanup() { for (const effect of effects) if (effect?.cleanup) { effect.cleanup(); effect.cleanup = undefined; } }
  function render(next = props || initial) {
    props = next;
    // Never call ObserverConversationPanel or any non-target export.
    const wrapper = exported.ObserverIdentityCandidateReview(next);
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
  function button(kind) {
    const result = nodes(node => {
      if (node.type !== 'button') return false;
      const text = textOf(node);
      return kind === 'expand' ? text.includes('אני מכיר/ה') : kind === 'known' ? text.includes('שמירה כאדם מוכר') : kind === 'dismissed' ? node.props['aria-label'] === 'הסרת מועמד' : text.includes('אדם לא מוכר') || text.includes('לא מוכר/ת');
    });
    assert.equal(result.length, 1, `${kind} button`); return result[0];
  }
  function input(field) {
    const result = nodes(node => node.type === 'input' && (field === 'consent' ? node.props.type === 'checkbox' : node.props.placeholder === (field === 'name' ? 'למשל: דניאל' : 'בן משפחה / עובד / בעל גישה')));
    assert.equal(result.length, 1, `${field} input`); return result[0];
  }
  function expand() { if (!nodes(node => node.type === 'input').length) { button('expand').props.onClick(); render(); } }
  function change(field, value) { input(field).props.onChange({ target: field === 'consent' ? { checked: value } : { value } }); render(); }
  function knownDraft() { expand(); change('name', ' Raw Name '); change('relationship', ' Raw Relationship '); change('consent', true); }
  function reconnect() { cleanup(); for (const effect of effects) if (effect) effect.pending = true; render(); }
  function poison() { const reads = []; return { reads, value: new Proxy({}, { get(_, field) { if (field === 'then') return undefined; reads.push(String(field)); throw Error('obsolete access'); } }) }; }
  render();
  return { render, nodes, button, input, expand, change, knownDraft, reconnect, cleanup, poison, requests,
    click(kind) { button(kind).props.onClick(); },
    text: () => textOf(tree), snapshot: () => ({ writes, tokens, refreshes, requests: requests.length }), onRefresh(callback) { refreshCallback = callback; },
    async respond(payload = success('Synthetic review recorded'), ok = true) { requests.at(-1).gate.resolve({ ok, json: async () => payload }); await tick(); render(); },
    async jsonStage() { const gate = deferred(); requests.at(-1).gate.resolve({ ok: true, json: () => gate.promise }); await tick(); return gate; }
  };
}
function errorVisible(h) {
  assert.equal(h.nodes(node => node.props?.className === 'do-action-result error').length, 1);
  assert.equal(h.nodes(node => node.props?.className === 'do-action-result success').length, 0);
  assert.equal(h.button('unknown').props.disabled, false);
}

test('original collapsed/expanded defaults, labels and no automatic review', () => {
  const h = harness(); assert.equal(h.requests.length, 0); assert.equal(h.snapshot().tokens, 0); assert.equal(h.snapshot().refreshes, 0);
  assert.match(h.text(), /Synthetic Candidate/); assert.match(h.text(), /Synthetic Camera/); assert.match(h.text(), /82%/); assert.match(h.text(), /אין תמונה זמינה/);
  h.expand(); assert.equal(h.input('name').props.value, ''); assert.equal(h.input('relationship').props.value, ''); assert.equal(h.input('consent').props.checked, false);
  assert.match(h.text(), /קיימת הסכמה מפורשת להגדרת האדם כמוכר/); assert.equal(h.button('known').props.disabled, true); assert.equal(h.requests.length, 0);
});
for (const outcome of ['known', 'unknown', 'dismissed']) test(`exact ${outcome} body and original raw values`, async () => {
  const h = harness(); if (outcome !== 'dismissed') { h.knownDraft(); if (outcome === 'unknown') h.change('consent', false); }
  h.click(outcome); assert.equal(h.requests.length, 1); const request = h.requests[0];
  assert.equal(request.url, '/api/digital-observer/identity-candidates');
  assert.deepEqual(copy(request.options), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer development-token' }, body: JSON.stringify({ candidate_id: initial.candidate.id, outcome, display_name: outcome === 'dismissed' ? '' : ' Raw Name ', relationship_label: outcome === 'dismissed' ? '' : ' Raw Relationship ', explicit_consent: outcome === 'known' }) });
  await h.respond(); assert.equal(h.snapshot().refreshes, 1); assert.match(h.text(), /Synthetic review recorded/);
});
for (const setup of ['empty-name', 'short-name', 'no-consent']) test(`direct known admission denies ${setup}`, () => {
  const h = harness(); h.expand();
  if (setup !== 'empty-name') h.change('name', setup === 'short-name' ? ' a ' : 'Valid Name');
  if (setup !== 'no-consent') h.change('consent', true);
  const before = h.snapshot(); h.click('known'); assert.deepEqual(h.snapshot(), before);
});
for (const outcome of ['unknown', 'dismissed']) test(`${outcome} does not acquire name/consent requirement`, async () => {
  const h = harness(); h.click(outcome); assert.equal(h.requests.length, 1); const body = JSON.parse(h.requests[0].options.body); assert.equal(body.display_name, ''); assert.equal(body.explicit_consent, false); await h.respond();
});
test('current not-ready state rejects previously retained review handler', () => {
  const h = harness(); const old = h.button('unknown').props.onClick;
  h.render({ ...initial, candidate: { ...initial.candidate, candidate_status: 'collecting' } });
  const before = h.snapshot(); old(); assert.deepEqual(h.snapshot(), before); assert.match(h.text(), /אוסף עוד תצפיות/);
});
for (const outcome of ['known', 'unknown', 'dismissed']) test(`synchronous duplicate ${outcome} sends once`, async () => {
  const h = harness(); if (outcome === 'known') h.knownDraft(); const callback = h.button(outcome).props.onClick;
  callback(); callback(); assert.equal(h.requests.length, 1); assert.equal(h.snapshot().tokens, 1); await h.respond();
});
for (const expanded of [false, true]) test(`shared busy across ${expanded ? 'known/unknown' : 'unknown/dismissed'}`, async () => {
  const h = harness(); if (expanded) h.knownDraft();
  const a = h.button(expanded ? 'known' : 'unknown').props.onClick, b = h.button(expanded ? 'unknown' : 'dismissed').props.onClick;
  a(); const before = h.snapshot(); b(); assert.deepEqual(h.snapshot(), before); await h.respond();
});
test('nonempty future response message retained verbatim, one refresh', async () => {
  const h = harness(); h.click('unknown'); await h.respond(success('  Future valid message  ')); assert.ok(h.text().includes('  Future valid message  ')); assert.equal(h.snapshot().refreshes, 1);
});
for (const [name, payload] of Object.entries({ missing: {}, nullData: { data: null }, missingMessage: { data: {} }, nullMessage: success(null), numeric: success(3), empty: success(''), blank: success(' \n '), object: success({ text: 'invalid' }) })) {
  test(`invalid message ${name} cannot claim success/refresh and allows retry`, async () => {
    const h = harness(); h.click('unknown'); await h.respond(payload); errorVisible(h); assert.equal(h.snapshot().refreshes, 0);
    h.click('unknown'); await h.respond(); assert.equal(h.snapshot().refreshes, 1);
  });
}
for (const outcome of ['known', 'unknown', 'dismissed']) for (const failure of ['fetch', 'json', 'http']) test(`${outcome}/${failure} current error and explicit retry`, async () => {
  const h = harness(); if (outcome === 'known') h.knownDraft(); h.click(outcome);
  if (failure === 'fetch') h.requests[0].gate.reject(Error('offline'));
  else if (failure === 'json') { const gate = await h.jsonStage(); gate.reject(Error('bad JSON')); }
  else h.requests[0].gate.resolve({ ok: false, json: async () => ({ error: 'Current denial' }) });
  await tick(); h.render(); errorVisible(h); assert.equal(h.snapshot().refreshes, 0); h.click(outcome); await h.respond(); assert.equal(h.snapshot().refreshes, 1);
});
for (const field of ['name', 'relationship', 'consent']) test(`newer ${field} while pending preserved without refresh/resend`, async () => {
  const h = harness(); h.knownDraft(); h.click('known'); h.render();
  const value = field === 'consent' ? false : `New unsent ${field}`; h.change(field, value);
  await h.respond(); assert.equal(h.input(field).props[field === 'consent' ? 'checked' : 'value'], value);
  assert.equal(h.snapshot().refreshes, 0); assert.equal(h.requests.length, 1); assert.match(h.text(), /Synthetic review recorded/); assert.match(h.text(), /העריכות החדשות נשמרו כטיוטה ולא נשלחו/);
  assert.equal(h.button('unknown').props.disabled, false);
});
for (const field of ['name', 'relationship', 'consent']) test(`old callback cannot submit prior ${field} draft`, () => {
  const h = harness(); h.knownDraft(); const old = h.button('known').props.onClick;
  h.change(field, field === 'consent' ? false : 'New draft'); const before = h.snapshot(); old(); assert.deepEqual(h.snapshot(), before);
});
test('same-candidate harmless metadata refresh preserves draft and pending review', async () => {
  const h = harness(); h.knownDraft(); h.click('known');
  h.render({ ...initial, cameraName: 'Fresh Camera', candidate: { ...initial.candidate, observation_count: 9, average_confidence: 0.91, suggested_label: 'Fresh Label' } });
  assert.equal(h.input('name').props.value, ' Raw Name '); assert.equal(h.input('consent').props.checked, true); assert.equal(h.button('unknown').props.disabled, true);
  assert.match(h.text(), /Fresh Camera/); assert.match(h.text(), /Fresh Label/); assert.match(h.text(), /91%/); await h.respond(); assert.equal(h.snapshot().refreshes, 1);
});
test('changed candidate resets expansion/draft/consent/notices/busy and does not act', async () => {
  const h = harness(); h.knownDraft(); h.click('known'); await h.respond();
  h.render({ ...initial, candidate: { ...initial.candidate, id: 'synthetic-candidate-b' } });
  assert.equal(h.nodes(node => node.type === 'input').length, 0); assert.doesNotMatch(h.text(), /Synthetic review recorded/); assert.equal(h.button('unknown').props.disabled, false);
  h.expand(); assert.equal(h.input('name').props.value, ''); assert.equal(h.input('relationship').props.value, ''); assert.equal(h.input('consent').props.checked, false); assert.equal(h.requests.length, 1);
});
for (const boundary of ['fetch', 'json']) for (const loss of ['unmount', 'candidate', 'status', 'statusRoundtrip', 'layout']) for (const rejected of [false, true]) {
  test(`${boundary}/${loss}/${rejected ? 'reject' : 'resolve'} old completion inert and cannot release newer request`, async () => {
    const h = harness(); h.knownDraft(); const old = h.button('known').props.onClick, oldInput = h.input('name').props.onChange;
    h.click('known'); h.render(); const gate = boundary === 'fetch' ? h.requests[0].gate : await h.jsonStage();
    if (loss === 'unmount') h.cleanup();
    else if (loss === 'layout') h.reconnect();
    else if (loss === 'candidate') h.render({ ...initial, candidate: { ...initial.candidate, id: 'synthetic-candidate-b' } });
    else {
      h.render({ ...initial, candidate: { ...initial.candidate, candidate_status: 'collecting' } });
      if (loss === 'statusRoundtrip') h.render(initial);
    }
    const canAct = loss !== 'unmount' && loss !== 'status';
    if (canAct) { h.knownDraft(); h.click('known'); h.render(); assert.equal(h.button('unknown').props.disabled, true); }
    const before = h.snapshot(), poison = h.poison();
    if (rejected) gate.reject(poison.value); else gate.resolve(poison.value);
    await tick(); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
    const badEvent = h.poison(); old(); oldInput(badEvent.value); assert.deepEqual(badEvent.reads, []); assert.deepEqual(h.snapshot(), before);
    if (canAct) {
      h.render(); assert.equal(h.button('unknown').props.disabled, true); h.click('unknown'); assert.deepEqual(h.snapshot(), before);
      await h.respond(); assert.equal(h.button('unknown').props.disabled, false); assert.equal(h.snapshot().refreshes, 1);
    }
  });
}
test('old response status/body getters not touched after candidate loss', async () => {
  const h = harness(); h.click('unknown'); const gate = h.requests[0].gate;
  h.render({ ...initial, candidate: { ...initial.candidate, id: 'synthetic-candidate-b' } });
  const before = h.snapshot(), reads = []; gate.resolve({ get ok() { reads.push('ok'); throw Error('old status'); }, get json() { reads.push('json'); throw Error('old body'); } });
  await tick(); assert.deepEqual(reads, []); assert.deepEqual(h.snapshot(), before);
});
test('router callback unmount cannot cause late finally state write', async () => {
  const h = harness(); let afterCleanup;
  h.onRefresh(() => { h.cleanup(); afterCleanup = h.snapshot(); }); h.click('unknown');
  h.requests[0].gate.resolve({ ok: true, json: async () => success('Synthetic recorded') }); await tick();
  assert.equal(afterCleanup.refreshes, 1); assert.deepEqual(h.snapshot(), afterCleanup);
});
test('layout reconnect retains current draft, releases canceled busy and never auto reviews', async () => {
  const h = harness(); h.knownDraft(); h.click('known'); h.render(); h.reconnect();
  assert.equal(h.requests.length, 1); assert.equal(h.button('unknown').props.disabled, false); assert.equal(h.input('name').props.value, ' Raw Name ');
  h.click('known'); await h.respond(); assert.equal(h.requests.length, 2);
});
test('old input event is unread after current draft revision changes', () => {
  const h = harness(); h.knownDraft(); const old = h.input('name').props.onChange; h.change('relationship', 'New relationship');
  const before = h.snapshot(), poison = h.poison(); old(poison.value); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
});
test('preview descriptor and confidence/observation fallback unchanged without image access', () => {
  const h = harness(); h.render({ candidate: { ...initial.candidate, preview_available: true, average_confidence: null, suggested_label: '' } });
  const images = h.nodes(node => node.type === 'img'); assert.equal(images.length, 1);
  assert.equal(images[0].props.src, '/api/digital-observer/identity-candidates/synthetic-candidate-a/preview'); assert.equal(images[0].props.alt, 'תצוגה פרטית של אדם שנצפה');
  assert.match(h.text(), /לא זמין/); assert.match(h.text(), /מצלמה לא ידועה/); assert.match(h.text(), /אדם שנצפה לעיתים קרובות/); assert.equal(h.requests.length, 0);
});
test('retained expand handler cannot restore UI across ready A-B-A', () => {
  const h = harness(); const old = h.button('expand').props.onClick;
  h.render({ ...initial, candidate: { ...initial.candidate, candidate_status: 'collecting' } }); h.render(initial);
  const before = h.snapshot(); old(); assert.deepEqual(h.snapshot(), before); assert.equal(h.nodes(node => node.type === 'input').length, 0);
});
