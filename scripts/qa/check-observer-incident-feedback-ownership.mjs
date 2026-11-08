import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/incident-feedback-panel.tsx');
assert.ok(statSync(sourcePath).isFile());
if (process.platform === 'darwin') {
  const decimal = execFileSync('/usr/bin/stat', ['-f', '%f', sourcePath], { encoding: 'utf8' }).trim();
  assert.match(decimal, /^\d+$/); const flags = Number(decimal);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0); assert.equal(flags & 0x40000000, 0, 'refuse dataless source');
}
const source = readFileSync(sourcePath, 'utf8');
const require = createRequire(resolve(root, 'package.json'));
const ts = require('typescript');
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const labels = ['TRUE_SECURITY_EVENT', 'TRUE_EXPECTED_ACTIVITY', 'FALSE_DETECTION', 'FALSE_CORRELATION', 'FALSE_SPATIAL_EVENT', 'UNCERTAIN'];

function harness() {
  let props = { incidentId: 'NONUSABLE-INCIDENT-A', currentLabel: 'TRUE_EXPECTED_ACTIVITY', currentFeedbackId: 'NONUSABLE-FEEDBACK-A', groundTruthLabel: null, canReview: true };
  let slots = [], cursor = 0, layouts = new Map(), mounted = false, key, tree;
  let onRefresh = () => {};
  const log = { requests: [], token: 0, json: 0, reads: [], writes: 0, uuid: 0, refresh: 0 };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], next => { log.writes++; cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useLayoutEffect(setup, deps) {
      const i = cursor++; const previous = layouts.get(i);
      if (!previous || !deps || !previous.deps || deps.length !== previous.deps.length || deps.some((value, at) => !Object.is(value, previous.deps[at])))
        layouts.set(i, { setup, deps, cleanup: previous?.cleanup, pending: true });
    }
  };
  const neutral = () => null;
  const allowed = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ refresh() { log.refresh++; onRefresh(); } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-AUTH'; } } };
  const exports = {};
  const context = vm.createContext({ exports, Error, require(name) { assert.ok(Object.hasOwn(allowed, name), 'unapproved import ' + name); return allowed[name]; },
    crypto: { randomUUID() { log.uuid++; return 'NONUSABLE-UUID-' + log.uuid; } },
    fetch(path, request) { const pending = deferred(); log.requests.push({ path, request, pending }); return pending.promise; }
  });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context, { timeout: 1000 });
  function visit(predicate, node, result) {
    if (Array.isArray(node)) { for (const child of node) visit(predicate, child, result); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) result.push(node);
    visit(predicate, node.props?.children, result);
  }
  function nodes(predicate, node = tree) { const result = []; visit(predicate, node, result); return result; }
  function walkText(node) { if (Array.isArray(node)) return node.map(walkText).join(' '); if (typeof node === 'string') return node;
    return node && typeof node === 'object' ? walkText(node.props?.children) : ''; }
  function text() { return walkText(tree); }
  function unmount() { for (const effect of layouts.values()) effect.cleanup?.(); mounted = false; }
  function render(next = props) {
    props = next; const wrapper = exports.IncidentFeedbackPanel(props);
    assert.equal(typeof wrapper.type, 'function'); assert.equal(wrapper.key, props.incidentId);
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; layouts = new Map(); mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of layouts.values()) if (effect.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.setup(); }
  }
  function restartLayouts() { for (const effect of layouts.values()) { effect.cleanup?.(); effect.cleanup = effect.setup(); } }
  function textarea() { return nodes(n => n.type === 'textarea')[0]; }
  function note(value) { textarea().props.onChange({ target: { value } }); render(); }
  function submitButton(label = labels[0]) { return nodes(n => n.type === 'button' && n.key === label)[0]; }
  function reviewButton() { return nodes(n => n.type === 'button' && walkText(n).includes('אישור כ‑Ground Truth'))[0]; }
  function handler(kind, label) { const button = kind === 'review' ? reviewButton() : submitButton(label); assert.ok(button); return button.props.onClick; }
  function start(kind, callback = handler(kind)) { callback(); render(); }
  function packet(index = 0, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  async function reply(index, data = {}) { packet(index).resolve({ data }); await tick(); render(); }
  async function fail(index) { log.requests[index].pending.reject(new Error('NONUSABLE-FAILURE')); await tick(); render(); }
  function body(index) { return JSON.parse(log.requests[index].request.body); }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, token: log.token, json: log.json, reads: log.reads, writes: log.writes, uuid: log.uuid, refresh: log.refresh }); }
  function busy() { return submitButton().props.disabled; }
  render();
  return { log, render, unmount, restartLayouts, nodes, text, textarea, note, submitButton, reviewButton, handler, start, packet, reply, fail, body, poison, snapshot, busy,
    setRefresh(fn) { onRefresh = fn; }, get props() { return props; } };
}

for (const label of labels) test('current submit exact enum and normalized body ' + label, async () => {
  const h = harness(); h.note('  NONUSABLE-NOTE  '); h.start('submit', h.handler('submit', label)); const request = h.log.requests[0];
  assert.equal(request.path, '/api/digital-observer/incidents/feedback'); assert.equal(request.request.method, 'POST'); assert.equal(request.request.credentials, 'same-origin');
  assert.equal(request.request.headers.Authorization, 'Bearer NONUSABLE-AUTH');
  assert.deepEqual(h.body(0), { action: 'submit', incident_id: 'NONUSABLE-INCIDENT-A', target_type: 'INCIDENT', label, note: 'NONUSABLE-NOTE', idempotency_key: 'submit:' + label + ':NONUSABLE-UUID-1' });
  await h.reply(0, { message: 'NONUSABLE-SAVED' }); assert.match(h.text(), /NONUSABLE-SAVED/); assert.equal(h.log.refresh, 1); assert.equal(h.textarea().props.value, '  NONUSABLE-NOTE  '); h.unmount();
});

test('current review exact target, note, key and success', async () => {
  const h = harness(); h.note('  NONUSABLE-REVIEW-NOTE  '); h.start('review');
  assert.deepEqual(h.body(0), { action: 'review', feedback_id: 'NONUSABLE-FEEDBACK-A', label: 'TRUE_EXPECTED_ACTIVITY', note: 'NONUSABLE-REVIEW-NOTE', idempotency_key: 'review:NONUSABLE-FEEDBACK-A:TRUE_EXPECTED_ACTIVITY:NONUSABLE-UUID-1' });
  await h.reply(0, { message: 'NONUSABLE-REVIEWED' }); assert.match(h.text(), /NONUSABLE-REVIEWED/); assert.equal(h.log.refresh, 1); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': empty note and message fallbacks remain exact', async () => {
  const h = harness(); h.note('   '); h.start(kind);
  if (kind === 'submit') assert.equal(Object.hasOwn(h.body(0), 'note'), false); else assert.equal(h.body(0).note, 'אושר בביקורת אנושית');
  await h.reply(0, {}); assert.ok(h.text().includes(kind === 'submit' ? 'המשוב נשמר.' : 'התיוג אושר כ‑Ground Truth.')); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': synchronous duplicate and cross-command guard', async () => {
  const h = harness(); const handler = h.handler(kind); handler(); handler(); h.handler(kind === 'submit' ? 'review' : 'submit')();
  assert.equal(h.log.requests.length, 1); assert.equal(h.log.uuid, 1); assert.equal(h.log.token, 1);
  await h.reply(0); h.unmount();
});

for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'incident', 'new-request']) for (const settlement of ['resolve', 'reject']) {
  test('submit stale ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); const retained = h.handler('submit'); h.start('submit'); let json;
    if (stage === 'json') { json = h.packet(); await tick(); }
    if (loss === 'unmount') h.unmount(); else h.render({ ...h.props, incidentId: 'NONUSABLE-INCIDENT-B' });
    if (loss === 'new-request') { h.note('NONUSABLE-NEW-NOTE'); h.start('submit'); }
    const before = h.snapshot(); retained();
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[0].pending.resolve(h.poison('old-submit-response'));
      else h.log.requests[0].pending.reject(h.poison('old-submit-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-submit-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-submit-json-error'));
    await tick(); assert.deepEqual(h.snapshot(), before);
    if (loss === 'new-request') { h.start('submit'); assert.equal(h.log.requests.length, 2); assert.equal(h.busy(), true); await h.reply(1); assert.equal(h.textarea().props.value, 'NONUSABLE-NEW-NOTE'); }
    h.unmount();
  });
}

for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'incident', 'permission', 'feedback', 'label', 'new-review', 'new-submit']) for (const settlement of ['resolve', 'reject']) {
  test('review stale ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); const retained = h.handler('review'); h.start('review'); let json;
    if (stage === 'json') { json = h.packet(); await tick(); }
    if (loss === 'unmount') h.unmount();
    else if (loss === 'incident') h.render({ ...h.props, incidentId: 'NONUSABLE-INCIDENT-B' });
    else if (loss === 'permission' || loss === 'new-submit') h.render({ ...h.props, canReview: false });
    else if (loss === 'label') h.render({ ...h.props, currentLabel: 'FALSE_DETECTION' });
    else h.render({ ...h.props, currentFeedbackId: 'NONUSABLE-FEEDBACK-B' });
    const nextKind = loss === 'new-review' ? 'review' : loss === 'new-submit' ? 'submit' : null;
    if (nextKind) h.start(nextKind);
    const before = h.snapshot(); retained();
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[0].pending.resolve(h.poison('old-review-response'));
      else h.log.requests[0].pending.reject(h.poison('old-review-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-review-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-review-json-error'));
    await tick(); assert.deepEqual(h.snapshot(), before);
    if (nextKind) { h.start(nextKind); assert.equal(h.log.requests.length, 2); assert.equal(h.busy(), true); await h.reply(1); }
    h.unmount();
  });
}

for (const kind of ['submit', 'review']) for (const failure of ['fetch', 'json', 'http']) test(kind + ': current failure preserves key for exact explicit retry ' + failure, async () => {
  const h = harness(); h.note('NONUSABLE-NOTE'); h.start(kind); const first = h.body(0);
  if (failure === 'fetch') h.log.requests[0].pending.reject(new Error('NONUSABLE-FAILURE'));
  if (failure === 'json') h.packet().reject(new Error('NONUSABLE-JSON-FAILURE'));
  if (failure === 'http') h.packet(0, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
  await tick(); h.render(); assert.equal(h.busy(), false); assert.ok(h.nodes(n => n.props.role === 'alert').length); assert.equal(h.log.refresh, 0);
  h.start(kind); assert.deepEqual(h.body(1), first); assert.equal(h.log.uuid, 1); await h.reply(1); h.unmount();
});

for (const kind of ['submit', 'review']) for (const edit of ['meaningful', 'trim-equivalent']) test(kind + ': failed retry key follows normalized note meaning ' + edit, async () => {
  const h = harness(); h.note('NONUSABLE-NOTE-A'); h.start(kind); const key = h.body(0).idempotency_key; await h.fail(0);
  h.note(edit === 'meaningful' ? 'NONUSABLE-NOTE-B' : ' \tNONUSABLE-NOTE-A\n '); h.start(kind);
  if (edit === 'meaningful') { assert.notEqual(h.body(1).idempotency_key, key); assert.equal(h.log.uuid, 2); }
  else { assert.equal(h.body(1).idempotency_key, key); assert.equal(h.log.uuid, 1); }
  await h.reply(1); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': old note acknowledgement preserves new unsent draft and defers refresh', async () => {
  const h = harness(); h.note('NONUSABLE-SUBMITTED'); h.start(kind); const key = h.body(0).idempotency_key;
  h.note('NONUSABLE-UNSENT'); assert.equal(h.busy(), true);
  await h.reply(0, { message: 'NONUSABLE-SAVED' }); assert.equal(h.textarea().props.value, 'NONUSABLE-UNSENT');
  assert.match(h.text(), /ההערה החדשה טרם נשלחה/); assert.equal(h.log.refresh, 0); assert.equal(h.busy(), false);
  h.start(kind); assert.notEqual(h.body(1).idempotency_key, key); assert.equal(h.body(1).note, 'NONUSABLE-UNSENT');
  await h.reply(1); assert.equal(h.log.refresh, 1); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': editing note during failed request retains draft and requires fresh semantic key', async () => {
  const h = harness(); h.note('NONUSABLE-SUBMITTED'); h.start(kind); const old = h.body(0).idempotency_key;
  h.note('NONUSABLE-UNSENT'); await h.fail(0); assert.equal(h.textarea().props.value, 'NONUSABLE-UNSENT');
  h.start(kind); assert.notEqual(h.body(1).idempotency_key, old); await h.reply(1); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': trim-only pending edit is the same submitted semantic note', async () => {
  const h = harness(); h.note('NONUSABLE-NOTE'); h.start(kind); h.note('  NONUSABLE-NOTE  '); await h.reply(0);
  assert.equal(h.log.refresh, 1); assert.doesNotMatch(h.text(), /טרם נשלחה/); assert.equal(h.textarea().props.value, '  NONUSABLE-NOTE  '); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': current success removes only its entry so next explicit send gets a fresh key', async () => {
  const h = harness(); h.start(kind); const first = h.body(0).idempotency_key; await h.reply(0); h.start(kind);
  assert.notEqual(h.body(1).idempotency_key, first); assert.equal(h.log.uuid, 2); await h.reply(1); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': same-Incident display refresh keeps note and current request', async () => {
  const h = harness(); h.note('NONUSABLE-DRAFT'); h.start(kind);
  h.render({ ...h.props, groundTruthLabel: 'FALSE_SPATIAL_EVENT' }); assert.equal(h.textarea().props.value, 'NONUSABLE-DRAFT');
  await h.reply(0); assert.equal(h.log.refresh, 1); assert.equal(h.textarea().props.value, 'NONUSABLE-DRAFT'); h.unmount();
});

test('pending submit survives unrelated review authorization/target metadata changes', async () => {
  const h = harness(); h.note('NONUSABLE-DRAFT'); h.start('submit');
  h.render({ ...h.props, canReview: false, currentLabel: 'FALSE_DETECTION', currentFeedbackId: 'NONUSABLE-FEEDBACK-B' });
  assert.equal(h.busy(), true); await h.reply(0); assert.equal(h.log.refresh, 1); assert.equal(h.textarea().props.value, 'NONUSABLE-DRAFT'); h.unmount();
});

for (const missing of ['permission', 'feedback', 'label']) test('review rejects current denied/missing target and retained prior callback ' + missing, async () => {
  const h = harness(); const retained = h.handler('review'); h.note('NONUSABLE-UNSENT');
  h.render({ ...h.props, ...(missing === 'permission' ? { canReview: false } : missing === 'feedback' ? { currentFeedbackId: null } : { currentLabel: null }) });
  const before = h.snapshot(); retained(); if (h.reviewButton()) h.start('review');
  await tick(); assert.deepEqual(h.snapshot(), before); assert.equal(h.log.uuid, 0); assert.equal(h.log.token, 0); assert.equal(h.textarea().props.value, 'NONUSABLE-UNSENT'); h.unmount();
});

for (const settlement of ['resolve', 'reject']) test('late old review cannot remove newer failed target retry entry ' + settlement, async () => {
  const h = harness(); h.start('review'); h.render({ ...h.props, currentFeedbackId: 'NONUSABLE-FEEDBACK-B' }); h.start('review');
  const newer = h.body(1); await h.fail(1);
  if (settlement === 'resolve') h.log.requests[0].pending.resolve(h.poison('old-entry-response'));
  else h.log.requests[0].pending.reject(h.poison('old-entry-error'));
  await tick(); h.render(); h.start('review'); assert.deepEqual(h.body(2), newer); assert.equal(h.log.uuid, 2); await h.reply(2); h.unmount();
});

test('six submit retry entries survive one bounded replacing review entry without history growth policy', async () => {
  const h = harness(); const keys = new Map();
  for (const label of labels) { const index = h.log.requests.length; h.start('submit', h.handler('submit', label)); keys.set(label, h.body(index).idempotency_key); await h.fail(index); }
  assert.equal(h.log.uuid, 6); assert.equal(new Set(keys.values()).size, 6);
  h.start('review'); const firstReview = h.body(6).idempotency_key; await h.fail(6);
  for (let i = 0; i < 5; i++) { h.render({ ...h.props, currentFeedbackId: 'NONUSABLE-FEEDBACK-' + i }); const index = h.log.requests.length; h.start('review'); await h.fail(index); }
  for (const label of labels) { const index = h.log.requests.length; h.start('submit', h.handler('submit', label)); assert.equal(h.body(index).idempotency_key, keys.get(label)); await h.fail(index); }
  h.render({ ...h.props, currentFeedbackId: 'NONUSABLE-FEEDBACK-A' }); const index = h.log.requests.length; h.start('review');
  assert.notEqual(h.body(index).idempotency_key, firstReview); await h.reply(index); h.unmount();
});

test('retained note/action controls cannot read an event or submit old note before or after commit', async () => {
  const h = harness(); const oldNote = h.textarea().props.onChange; const oldSubmit = h.handler('submit');
  oldNote({ target: { value: 'NONUSABLE-NEW-DRAFT' } }); const before = h.snapshot();
  oldNote(h.poison('old-note-event')); oldSubmit(); assert.deepEqual(h.snapshot(), before);
  h.render(); const after = h.snapshot(); oldNote(h.poison('older-note-event')); oldSubmit(); assert.deepEqual(h.snapshot(), after);
  h.start('submit'); assert.equal(h.body(0).note, 'NONUSABLE-NEW-DRAFT'); await h.reply(0); h.unmount();
});

test('Incident change resets note/messages and keeps original field limits', async () => {
  const h = harness(); h.note('NONUSABLE-DRAFT'); h.start('submit'); await h.reply(0); h.render({ ...h.props, incidentId: 'NONUSABLE-INCIDENT-B' });
  assert.equal(h.textarea().props.value, ''); assert.equal(h.nodes(n => n.props.role === 'status').length, 0);
  assert.equal(h.textarea().props.maxLength, 500); assert.equal(h.textarea().props.rows, 3); assert.match(h.text(), /למידה מבוקרת בלבד/); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': layout cleanup/setup invalidates old completion and reuses current exact payload key', async () => {
  const h = harness(); h.note('NONUSABLE-NOTE'); h.start(kind); const first = h.body(0); h.restartLayouts(); h.start(kind); const before = h.snapshot();
  h.log.requests[0].pending.resolve(h.poison('layout-old-response')); await tick(); assert.deepEqual(h.snapshot(), before);
  assert.deepEqual(h.body(1), first); assert.equal(h.log.uuid, 1); await h.reply(1); assert.equal(h.log.refresh, 1); h.unmount();
});

test('successful review own metadata echo does not erase note or legitimate success', async () => {
  const h = harness(); h.note('NONUSABLE-NOTE'); h.setRefresh(() => h.render({ ...h.props, currentFeedbackId: 'NONUSABLE-ECHO-FEEDBACK', groundTruthLabel: 'TRUE_EXPECTED_ACTIVITY' }));
  h.start('review'); await h.reply(0); assert.equal(h.textarea().props.value, 'NONUSABLE-NOTE'); assert.match(h.text(), /התיוג אושר כ/);
  assert.equal(h.log.refresh, 1); assert.equal(h.busy(), false); h.unmount();
});

for (const kind of ['submit', 'review']) test(kind + ': non-Error failure keeps exact existing error fallback', async () => {
  const h = harness(); h.start(kind); h.log.requests[0].pending.reject({ kind: 'NONUSABLE-FAILURE' }); await tick(); h.render();
  assert.ok(h.text().includes(kind === 'submit' ? 'לא ניתן לשמור את המשוב' : 'לא ניתן להשלים את הביקורת')); h.unmount();
});

test('OTHER remains display data and existing review label, not an extra submit button', async () => {
  const h = harness(); h.render({ ...h.props, currentLabel: 'OTHER', groundTruthLabel: 'OTHER' });
  assert.equal(h.nodes(n => n.type === 'button' && n.key === 'OTHER').length, 0); assert.match(h.text(), /אחר/);
  h.start('review'); assert.equal(h.body(0).label, 'OTHER'); await h.reply(0); h.unmount();
});

test('review empty note and explicit existing default remain the same retry payload', async () => {
  const h = harness(); h.start('review'); const first = h.body(0); await h.fail(0);
  h.note('  אושר בביקורת אנושית  '); h.start('review'); assert.deepEqual(h.body(1), first); assert.equal(h.log.uuid, 1);
  await h.reply(1); h.unmount();
});


for (const field of ['canReview', 'currentFeedbackId', 'currentLabel']) test('canceled review stays visibly available after target round trip ' + field, async () => {
  const h = harness(); h.note('NONUSABLE-UNSENT'); const original = h.props[field]; h.start('review'); const first = h.body(0);
  h.render({ ...h.props, [field]: field === 'canReview' ? false : field === 'currentFeedbackId' ? 'NONUSABLE-FEEDBACK-B' : 'FALSE_DETECTION' });
  h.render({ ...h.props, [field]: original });
  assert.equal(h.busy(), false); assert.equal(h.reviewButton().props.disabled, false); assert.equal(h.textarea().props.value, 'NONUSABLE-UNSENT');
  const before = h.snapshot(); h.log.requests[0].pending.resolve(h.poison('round-trip-old-response')); await tick(); assert.deepEqual(h.snapshot(), before);
  h.start('review'); assert.deepEqual(h.body(1), first); await h.reply(1); assert.equal(h.log.refresh, 1); h.unmount();
});

for (const kind of ['submit', 'review']) test('layout reconnection visibly releases canceled busy state ' + kind, async () => {
  const h = harness(); h.start(kind); const first = h.body(0); h.restartLayouts(); h.render();
  assert.equal(h.busy(), false); assert.equal(h.reviewButton().props.disabled, false);
  const before = h.snapshot(); h.log.requests[0].pending.resolve(h.poison('reconnect-old-response')); await tick(); assert.deepEqual(h.snapshot(), before);
  h.start(kind); assert.deepEqual(h.body(1), first); await h.reply(1); assert.equal(h.log.refresh, 1); h.unmount();
});
