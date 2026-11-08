import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/natural-language-watch-rule-builder.tsx');
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
const ready = (fingerprint = 'NONUSABLE-FINGERPRINT') => ({ status: 'READY_FOR_CONFIRMATION', originalText: 'NONUSABLE-TEXT', candidateFingerprint: fingerprint,
  preview: { camera: 'NONUSABLE-PREVIEW-CAMERA', event: 'NONUSABLE-EVENT', time: 'NONUSABLE-TIME', days: 'NONUSABLE-DAYS', duration: 'NONUSABLE-DURATION', action: 'NONUSABLE-POLICY', warning: 'NONUSABLE-WARNING' },
  clarification: null, unsupported: null, validation: { valid: true, errors: [] } });
const simulation = () => ({ days: 7, evaluatedRealEventCount: 0, matchCount: 0, liveExecution: false, syntheticEventsUsed: false });
const compilationReply = () => ({ compilation: ready(), simulation: simulation() });

function harness() {
  let props = { siteId: 'NONUSABLE-SITE-A', cameras: [{ id: 'NONUSABLE-CAMERA-A', display_name: 'NONUSABLE-CAMERA-A' }, { id: 'NONUSABLE-CAMERA-B', display_name: 'NONUSABLE-CAMERA-B' }],
    rules: [{ id: 'NONUSABLE-RULE-A', title: 'NONUSABLE-RULE-TITLE-A', original_natural_language: 'NONUSABLE-RULE-TEXT-A', rule_state: 'ACTIVE', rule_version: 1 },
      { id: 'NONUSABLE-RULE-B', title: 'NONUSABLE-RULE-TITLE-B', original_natural_language: null, rule_state: 'DISABLED', rule_version: 2 }] };
  let slots = [], cursor = 0, effects = [], mounted = false, key, tree;
  const log = { requests: [], token: 0, json: 0, reads: [], writes: 0, uuid: 0, defaults: 0, refresh: 0, document: [], scroll: [] };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], next => { log.writes++; cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useLayoutEffect(setup) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push({ setup, cleanup: null }); } }
  };
  const neutral = () => null;
  const allowed = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ refresh() { log.refresh++; } }) },
    'lucide-react': new Proxy({}, { get: () => neutral }),
    '@/lib/domain/digital-observer/client-session': { readObserverAccessToken() { log.token++; return 'NONUSABLE-AUTH'; } } };
  const exports = {};
  const context = vm.createContext({ exports, Error, require(name) { assert.ok(Object.hasOwn(allowed, name), 'unapproved import ' + name); return allowed[name]; },
    crypto: { randomUUID() { log.uuid++; return 'NONUSABLE-UUID-' + log.uuid; } },
    document: { getElementById(id) { log.document.push(id); return { scrollIntoView(options) { log.scroll.push(copy(options)); } }; } },
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
  function walkText(node) { if (Array.isArray(node)) return node.map(walkText).join(' '); if (typeof node === 'string' || typeof node === 'number') return String(node);
    return node && typeof node === 'object' ? walkText(node.props?.children) : ''; }
  function text() { return walkText(tree); }
  function unmount() { for (const effect of effects) effect.cleanup?.(); mounted = false; }
  function render(next = props) {
    props = next; const wrapper = exports.NaturalLanguageWatchRuleBuilder(props);
    assert.equal(typeof wrapper.type, 'function'); assert.equal(wrapper.key, props.siteId);
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; effects = []; mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of effects) if (!effect.cleanup) effect.cleanup = effect.setup();
  }
  function restartEffects() { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.setup(); } }
  function form() { const result = nodes(n => n.type === 'form'); assert.equal(result.length, 1); return result[0]; }
  function textarea() { return nodes(n => n.type === 'textarea')[0]; }
  function camera() { return nodes(n => n.type === 'select')[0]; }
  function type(value) { textarea().props.onChange({ target: { value } }); render(); }
  function chooseCamera(value) { camera().props.onChange({ target: { value } }); render(); }
  function confirmButton() { return nodes(n => n.type === 'button' && walkText(n).includes('אישור והפעלת הכלל'))[0]; }
  function ruleButton(label, index = 0) { return nodes(n => n.type === 'button' && n.props['aria-label'] === label)[index]; }
  function event() { return { preventDefault() { log.defaults++; } }; }
  function handler(kind) { if (kind === 'compile') return form().props.onSubmit; if (kind === 'confirm') { assert.ok(confirmButton()); return confirmButton().props.onClick; }
    return ruleButton('השבתה').props.onClick; }
  function start(kind, callback = handler(kind)) { const pending = kind === 'compile' ? callback(event()) : callback(); render(); return pending; }
  function edit(index = 0) { ruleButton('עריכה', index).props.onClick(); render(); }
  function packet(index, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  async function reply(index, data) { packet(index).resolve({ data }); await tick(); render(); }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, token: log.token, json: log.json, reads: log.reads, writes: log.writes,
    uuid: log.uuid, defaults: log.defaults, refresh: log.refresh, document: log.document, scroll: log.scroll }); }
  function busy() { return nodes(n => n.type === 'button' && n.props.type === 'submit')[0].props.disabled; }
  async function setup(kind) { type('NONUSABLE-TEXT'); if (kind === 'confirm') { const pending = start('compile'); await reply(0, compilationReply()); await pending; } }
  render();
  return { log, nodes, text, render, unmount, restartEffects, form, textarea, camera, type, chooseCamera, confirmButton, ruleButton,
    event, handler, start, edit, packet, reply, poison, snapshot, busy, setup, get props() { return props; } };
}

test('current compile has exact request and renders supplied preview/simulation contract', async () => {
  const h = harness(); await h.setup('compile'); const pending = h.start('compile'); const request = h.log.requests[0];
  assert.equal(request.path, '/api/digital-observer/watch-rules'); assert.equal(request.request.method, 'POST'); assert.equal(request.request.credentials, 'same-origin');
  assert.equal(request.request.headers.Authorization, 'Bearer NONUSABLE-AUTH');
  assert.deepEqual(JSON.parse(request.request.body), { action: 'compile', observer_site_id: 'NONUSABLE-SITE-A', text: 'NONUSABLE-TEXT', camera_source_id: null, editing_rule_id: null });
  await h.reply(0, compilationReply()); await pending; h.render();
  assert.ok(h.confirmButton()); assert.match(h.text(), /NONUSABLE-PREVIEW-CAMERA/); assert.match(h.text(), /בדיקה היסטורית בלבד:\s+0\s+התאמות/);
  assert.match(h.text(), /זו אינה הפעלה חיה/); assert.equal(h.log.uuid, 0); assert.equal(h.log.refresh, 0); h.unmount();
});

test('current confirm exact fingerprint/key and clearing policy', async () => {
  const h = harness(); await h.setup('confirm'); h.start('confirm');
  assert.deepEqual(JSON.parse(h.log.requests[1].request.body), { action: 'confirm', observer_site_id: 'NONUSABLE-SITE-A', text: 'NONUSABLE-TEXT',
    camera_source_id: null, editing_rule_id: null, candidate_fingerprint: 'NONUSABLE-FINGERPRINT', idempotency_key: 'watch-confirm-NONUSABLE-UUID-1' });
  await h.reply(1, { message: 'NONUSABLE-CONFIRMED' });
  assert.equal(h.textarea().props.value, ''); assert.equal(h.camera().props.value, ''); assert.equal(h.confirmButton(), undefined);
  assert.match(h.text(), /NONUSABLE-CONFIRMED/); assert.equal(h.log.refresh, 1); assert.equal(h.log.uuid, 1); h.unmount();
});

test('current state command exact fields/key and retained draft', async () => {
  const h = harness(); await h.setup('state'); h.chooseCamera('NONUSABLE-CAMERA-B'); h.start('state');
  assert.deepEqual(JSON.parse(h.log.requests[0].request.body), { action: 'set_state', rule_id: 'NONUSABLE-RULE-A', state: 'DISABLED', idempotency_key: 'watch-state-NONUSABLE-UUID-1' });
  await h.reply(0, { message: 'NONUSABLE-STATE-CHANGED' }); assert.equal(h.textarea().props.value, 'NONUSABLE-TEXT');
  assert.equal(h.camera().props.value, 'NONUSABLE-CAMERA-B'); assert.match(h.text(), /NONUSABLE-STATE-CHANGED/); assert.equal(h.log.refresh, 1); h.unmount();
});

for (const kind of ['compile', 'confirm', 'state']) for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'site', 'text', 'camera', 'edit', 'new-operation']) for (const settlement of ['resolve', 'reject']) {
  test(kind + ': stale request quiet ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); await h.setup(kind); const index = h.log.requests.length; const retained = h.handler(kind); const old = h.start(kind); let json;
    if (stage === 'json') { json = h.packet(index); await tick(); }
    if (loss === 'unmount') h.unmount();
    else if (loss === 'site') h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B' });
    else if (loss === 'camera') h.chooseCamera('NONUSABLE-CAMERA-B');
    else if (loss === 'edit') h.edit(1);
    else h.type('NONUSABLE-NEW-DRAFT');
    let next;
    if (loss === 'new-operation') next = h.start('compile');
    const before = h.snapshot();
    if (kind === 'compile') await retained(h.poison('old-submit-event')); else retained();
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[index].pending.resolve(h.poison('old-response'));
      else h.log.requests[index].pending.reject(h.poison('old-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-json-error'));
    await old; await tick(); assert.deepEqual(h.snapshot(), before);
    if (next) {
      assert.equal(h.busy(), true); await h.start('compile'); assert.equal(h.log.requests.length, index + 2, 'stale finally must not unlock current compile');
      await h.reply(index + 1, compilationReply()); await next; assert.ok(h.confirmButton()); assert.equal(h.textarea().props.value, 'NONUSABLE-NEW-DRAFT');
    }
    h.unmount();
  });
}

for (const kind of ['compile', 'confirm', 'state']) test(kind + ': synchronous duplicate and native default policy', async () => {
  const h = harness(); await h.setup(kind); const handler = h.handler(kind); const index = h.log.requests.length;
  const first = kind === 'compile' ? handler(h.event()) : handler();
  const second = kind === 'compile' ? handler(h.event()) : handler(); await second;
  assert.equal(h.log.requests.length, index + 1); assert.equal(h.log.uuid, kind === 'compile' ? 0 : 1);
  if (kind === 'compile') assert.equal(h.log.defaults, 2);
  await h.reply(index, kind === 'compile' ? compilationReply() : { message: 'NONUSABLE-DONE' }); await first; h.unmount();
});

for (const kind of ['compile', 'confirm', 'state']) for (const failure of ['fetch', 'json', 'http']) test(kind + ': current error and explicit retry ' + failure, async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; const old = h.start(kind);
  if (failure === 'fetch') h.log.requests[index].pending.reject(new Error('NONUSABLE-FAILURE'));
  if (failure === 'json') h.packet(index).reject(new Error('NONUSABLE-JSON-FAILURE'));
  if (failure === 'http') h.packet(index, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
  await old; await tick(); h.render(); assert.ok(h.nodes(n => n.props.role === 'alert').length); assert.equal(h.busy(), false); assert.equal(h.log.refresh, 0);
  const retry = h.start(kind); assert.equal(h.log.requests.length, index + 2);
  if (kind !== 'compile') { const first = JSON.parse(h.log.requests[index].request.body); const second = JSON.parse(h.log.requests[index + 1].request.body);
    assert.notEqual(first.idempotency_key, second.idempotency_key); assert.equal(h.log.uuid, 2); }
  await h.reply(index + 1, kind === 'compile' ? compilationReply() : { message: 'NONUSABLE-RETRIED' }); await retry; h.unmount();
});

test('short text prevents native submit without token, UUID or HTTP', async () => {
  const h = harness(); h.type(' X '); await h.start('compile');
  assert.equal(h.log.defaults, 1); assert.equal(h.log.requests.length, 0); assert.equal(h.log.token, 0); assert.equal(h.log.uuid, 0);
  assert.equal(h.textarea().props.minLength, 3); assert.equal(h.textarea().props.maxLength, 1200); assert.equal(h.textarea().props.required, true); h.unmount();
});

test('active busy form submit prevents default while another command is pending', async () => {
  const h = harness(); await h.setup('confirm'); h.start('confirm'); const before = h.log.defaults;
  await h.start('compile'); assert.equal(h.log.defaults, before + 1); assert.equal(h.log.requests.length, 2); assert.equal(h.log.uuid, 1);
  h.ruleButton('השבתה').props.onClick(); assert.equal(h.log.uuid, 1);
  await h.reply(1, { message: 'NONUSABLE-CONFIRMED' }); h.unmount();
});

test('retained confirm cannot authorize later draft or newer preview with matching fingerprint', async () => {
  const h = harness(); await h.setup('confirm'); const retained = h.confirmButton().props.onClick;
  h.type('NONUSABLE-NEW-DRAFT'); const next = h.start('compile'); await h.reply(1, compilationReply()); await next;
  const before = h.snapshot(); retained(); await tick(); assert.deepEqual(h.snapshot(), before);
  h.start('confirm'); assert.equal(JSON.parse(h.log.requests[2].request.body).text, 'NONUSABLE-NEW-DRAFT');
  await h.reply(2, { message: 'NONUSABLE-CURRENT-CONFIRM' }); h.unmount();
});

test('clarification selection invalidates compilation and keeps explicit selected camera in next request', async () => {
  const h = harness(); await h.setup('compile'); const pending = h.start('compile');
  const compilation = { ...ready(), status: 'NEEDS_CLARIFICATION', candidateFingerprint: null, preview: null,
    clarification: { question: 'NONUSABLE-QUESTION', options: [{ id: 'NONUSABLE-CAMERA-B', label: 'NONUSABLE-OPTION' }] } };
  await h.reply(0, { compilation, simulation: simulation() }); await pending;
  assert.equal(h.confirmButton(), undefined); assert.match(h.text(), /NONUSABLE-QUESTION/);
  h.nodes(n => n.type === 'button' && n.key === 'NONUSABLE-CAMERA-B')[0].props.onClick(); h.render();
  assert.equal(h.camera().props.value, 'NONUSABLE-CAMERA-B'); assert.doesNotMatch(h.text(), /NONUSABLE-QUESTION/);
  const next = h.start('compile'); assert.equal(JSON.parse(h.log.requests[1].request.body).camera_source_id, 'NONUSABLE-CAMERA-B');
  await h.reply(1, compilationReply()); await next; h.unmount();
});

for (const status of ['UNSUPPORTED_CAPABILITY', 'UNSUPPORTED_ACTION', 'INVALID']) test('unsupported/invalid compilation remains nonconfirmable ' + status, async () => {
  const h = harness(); await h.setup('compile'); const pending = h.start('compile');
  await h.reply(0, { compilation: { ...ready(), status, preview: null, unsupported: { capability: 'NONUSABLE-CAPABILITY', explanation: 'NONUSABLE-UNSUPPORTED' }, validation: { valid: false, errors: ['NONUSABLE-ERROR'] } }, simulation: null });
  await pending; assert.equal(h.confirmButton(), undefined); assert.match(h.text(), /לא נוצר כלל/); assert.match(h.text(), /NONUSABLE-UNSUPPORTED/); assert.equal(h.log.uuid, 0); h.unmount();
});

test('READY status without fingerprint cannot issue confirmation or UUID', async () => {
  const h = harness(); await h.setup('compile'); const pending = h.start('compile'); await h.reply(0, { compilation: ready(null), simulation: simulation() }); await pending;
  assert.ok(h.confirmButton()); h.start('confirm'); await tick(); assert.equal(h.log.requests.length, 1); assert.equal(h.log.uuid, 0); h.unmount();
});

test('current edit initializes text/id, retains selected camera and scrolls only while owned', async () => {
  const h = harness(); h.chooseCamera('NONUSABLE-CAMERA-B'); h.edit();
  assert.equal(h.textarea().props.value, 'NONUSABLE-RULE-TEXT-A'); assert.equal(h.camera().props.value, 'NONUSABLE-CAMERA-B');
  assert.deepEqual(h.log.document, ['natural-language-rule-builder']); assert.deepEqual(h.log.scroll, [{ behavior: 'smooth' }]);
  assert.match(h.text(), /עריכת כלל יוצרת גרסה חדשה/);
  const pending = h.start('compile'); assert.deepEqual(JSON.parse(h.log.requests[0].request.body), { action: 'compile', observer_site_id: 'NONUSABLE-SITE-A',
    text: 'NONUSABLE-RULE-TEXT-A', camera_source_id: 'NONUSABLE-CAMERA-B', editing_rule_id: 'NONUSABLE-RULE-A' });
  await h.reply(0, compilationReply()); await pending; h.start('confirm');
  assert.equal(JSON.parse(h.log.requests[1].request.body).editing_rule_id, 'NONUSABLE-RULE-A'); await h.reply(1, { message: 'NONUSABLE-NEW-VERSION' }); h.unmount();
});

test('edit fallback title and retained old edit/input handlers cannot alter a later draft', async () => {
  const h = harness(); const retainedEdit = h.ruleButton('עריכה').props.onClick; const retainedText = h.textarea().props.onChange;
  h.edit(1); assert.equal(h.textarea().props.value, 'NONUSABLE-RULE-TITLE-B'); const before = h.snapshot();
  retainedEdit(); retainedText(h.poison('old-text-event')); await tick(); assert.deepEqual(h.snapshot(), before); h.unmount();
});

for (const kind of ['compile', 'confirm', 'state']) test(kind + ': equivalent camera/rule list refresh preserves current draft and operation', async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; const pending = h.start(kind);
  h.render({ ...h.props, cameras: copy(h.props.cameras), rules: copy(h.props.rules) });
  assert.equal(h.textarea().props.value, 'NONUSABLE-TEXT'); assert.equal(h.busy(), true);
  await h.reply(index, kind === 'compile' ? compilationReply() : { message: 'NONUSABLE-CURRENT' }); await pending;
  if (kind === 'compile') assert.ok(h.confirmButton()); else assert.equal(h.log.refresh, 1); h.unmount();
});

test('Site change starts empty draft, camera, preview and action state', async () => {
  const h = harness(); await h.setup('confirm'); h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B' });
  assert.equal(h.textarea().props.value, ''); assert.equal(h.camera().props.value, ''); assert.equal(h.confirmButton(), undefined);
  assert.equal(h.nodes(n => n.props.role === 'alert').length, 0); assert.doesNotMatch(h.text(), /NONUSABLE-PREVIEW-CAMERA/); h.unmount();
});

for (const kind of ['compile', 'confirm', 'state']) test(kind + ': cleanup/setup fences old operation and permits current explicit retry', async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; const old = h.start(kind); h.restartEffects(); const next = h.start(kind); const before = h.snapshot();
  h.log.requests[index].pending.resolve(h.poison('effect-old-response')); await old; await tick(); assert.deepEqual(h.snapshot(), before);
  await h.reply(index + 1, kind === 'compile' ? compilationReply() : { message: 'NONUSABLE-AFTER-EFFECT' }); await next;
  if (kind === 'compile') assert.ok(h.confirmButton()); else assert.equal(h.log.refresh, 1); h.unmount();
});

test('state enable and archive commands preserve exact enum/key formats without changing draft', async () => {
  const h = harness(); await h.setup('state'); h.ruleButton('הפעלה').props.onClick();
  assert.deepEqual(JSON.parse(h.log.requests[0].request.body), { action: 'set_state', rule_id: 'NONUSABLE-RULE-B', state: 'ACTIVE', idempotency_key: 'watch-state-NONUSABLE-UUID-1' });
  await h.reply(0, { message: 'NONUSABLE-ENABLED' }); h.ruleButton('העברה לארכיון').props.onClick();
  assert.deepEqual(JSON.parse(h.log.requests[1].request.body), { action: 'set_state', rule_id: 'NONUSABLE-RULE-A', state: 'ARCHIVED', idempotency_key: 'watch-state-NONUSABLE-UUID-2' });
  await h.reply(1, { message: 'NONUSABLE-ARCHIVED' }); assert.equal(h.textarea().props.value, 'NONUSABLE-TEXT'); h.unmount();
});

test('same-draft failed recompile preserves existing valid preview policy', async () => {
  const h = harness(); await h.setup('confirm'); const pending = h.start('compile');
  h.log.requests[1].pending.reject(new Error('NONUSABLE-RECOMPILE-FAILURE')); await pending; h.render();
  assert.ok(h.confirmButton()); h.start('confirm'); assert.equal(JSON.parse(h.log.requests[2].request.body).candidate_fingerprint, 'NONUSABLE-FINGERPRINT');
  await h.reply(2, { message: 'NONUSABLE-CURRENT-PREVIEW' }); h.unmount();
});

test('retained older preview cannot confirm a replacement preview even with same fingerprint', async () => {
  const h = harness(); await h.setup('confirm'); const retained = h.confirmButton().props.onClick;
  const pending = h.start('compile'); await h.reply(1, compilationReply()); await pending;
  const before = h.snapshot(); retained(); await tick(); assert.deepEqual(h.snapshot(), before);
  h.start('confirm'); assert.equal(h.log.requests.length, 3); await h.reply(2, { message: 'NONUSABLE-LATEST-PREVIEW' }); h.unmount();
});
