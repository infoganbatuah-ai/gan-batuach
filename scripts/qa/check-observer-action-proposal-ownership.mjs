import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/action-proposal-form.tsx');
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
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const candidate = () => ({ intent: { id: 'NONUSABLE-INTENT-A', intent_status: 'awaiting_confirmation', action_type: 'NONUSABLE-ACTION-TYPE',
  human_confirmation_required: true, lawful_use_approval_required: true },
  proposal: { actionType: 'NONUSABLE-PROPOSAL-TYPE', parameters: { scope: 'NONUSABLE-PARAMETER' }, explanation: 'NONUSABLE-EXPLANATION', executionAuthorized: false }, executed: false });

function harness() {
  let props = { siteId: 'NONUSABLE-SITE-A' };
  let slots = [], cursor = 0, layouts = [], mounted = false, key, tree;
  const log = { requests: [], token: 0, json: 0, reads: [], writes: 0, uuid: 0, defaults: 0, refresh: 0 };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], next => { log.writes++; cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useLayoutEffect(setup) { const i = cursor++; if (!(i in slots)) { slots[i] = true; layouts.push({ setup, cleanup: null }); } }
  };
  const neutral = () => null;
  const allowed = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'next/navigation': { useRouter: () => ({ refresh() { log.refresh++; } }) },
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
  function unmount() { for (const effect of layouts) effect.cleanup?.(); mounted = false; }
  function render(next = props) {
    props = next; const wrapper = exports.ActionProposalForm(props);
    assert.equal(typeof wrapper.type, 'function'); assert.equal(wrapper.key, props.siteId);
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; layouts = []; mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of layouts) if (!effect.cleanup) effect.cleanup = effect.setup();
  }
  function restartLayouts() { for (const effect of layouts) { effect.cleanup?.(); effect.cleanup = effect.setup(); } render(); }
  function form() { return nodes(n => n.type === 'form')[0]; }
  function textarea() { return nodes(n => n.type === 'textarea')[0]; }
  function type(value) { textarea().props.onChange({ target: { value } }); render(); }
  function confirmButton() { return nodes(n => n.type === 'button' && walkText(n).includes('אישור אנושי מפורש'))[0]; }
  function handler(kind) { if (kind === 'propose') return form().props.onSubmit; assert.ok(confirmButton()); return confirmButton().props.onClick; }
  function event() { return { preventDefault() { log.defaults++; } }; }
  function start(kind, callback = handler(kind)) { const pending = kind === 'propose' ? callback(event()) : callback(); render(); return pending; }
  function packet(index = 0, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  async function reply(index, data) { packet(index).resolve({ data }); await tick(); render(); }
  function body(index) { return JSON.parse(log.requests[index].request.body); }
  function busy() { return nodes(n => n.type === 'button' && n.props.type === 'submit')[0].props.disabled; }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, token: log.token, json: log.json, reads: log.reads, writes: log.writes, uuid: log.uuid, defaults: log.defaults, refresh: log.refresh }); }
  async function setup(kind, value = candidate()) { type('NONUSABLE-INSTRUCTION-A'); if (kind === 'confirm') { const pending = start('propose'); await reply(0, value); await pending; } }
  render();
  return { log, nodes, text, render, unmount, restartLayouts, form, textarea, type, confirmButton, handler, event, start, packet, reply,
    body, busy, poison, snapshot, setup, get props() { return props; } };
}

test('current proposal exact raw instruction, request UUID and non-execution notice', async () => {
  const h = harness(); h.type('  NONUSABLE-RAW-INSTRUCTION  '); const pending = h.start('propose'); const request = h.log.requests[0];
  assert.equal(request.path, '/api/digital-observer/action-intents'); assert.equal(request.request.method, 'POST'); assert.equal(request.request.credentials, 'same-origin');
  assert.deepEqual(copy(request.request.headers), { 'Content-Type': 'application/json', Authorization: 'Bearer NONUSABLE-AUTH' });
  assert.deepEqual(h.body(0), { kind: 'natural_language_proposal', observer_site_id: 'NONUSABLE-SITE-A', instruction: '  NONUSABLE-RAW-INSTRUCTION  ', request_id: 'NONUSABLE-UUID-1' });
  await h.reply(0, candidate()); await pending; assert.ok(h.confirmButton()); assert.match(h.text(), /NONUSABLE-EXPLANATION/);
  assert.ok(h.text().includes('נוצרה הצעה מובנית בלבד. טרם בוצעה פעולה.')); assert.match(h.text(), /בוצע בפועל: לא/); assert.equal(h.log.refresh, 1); h.unmount();
});

test('current confirm exact path/body and matching status update retains lawful/non-execution notice', async () => {
  const h = harness(); const original = candidate(); await h.setup('confirm', original); const pending = h.start('confirm');
  assert.equal(h.log.requests[1].path, '/api/digital-observer/action-intents/NONUSABLE-INTENT-A'); assert.deepEqual(h.body(1), { action: 'confirm', confirmation_text: 'CONFIRM' });
  await h.reply(1, { message: 'NONUSABLE-CONFIRMED', intent: { id: 'NONUSABLE-IGNORED-ID', intent_status: 'confirmed', action_type: 'NONUSABLE-IGNORED-ACTION', human_confirmation_required: false, lawful_use_approval_required: false } }); await pending;
  assert.match(h.text(), /confirmed/); assert.match(h.text(), /NONUSABLE-CONFIRMED/); assert.match(h.text(), /NONUSABLE-PROPOSAL-TYPE/);
  assert.match(h.text(), /אישור שימוש חוקי מתועד/); assert.match(h.text(), /אין הפעלה אוטומטית/); assert.match(h.text(), /בוצע בפועל: לא/);
  assert.equal(original.intent.intent_status, 'awaiting_confirmation'); assert.equal(h.confirmButton(), undefined); assert.equal(h.log.uuid, 1); assert.equal(h.log.refresh, 2); h.unmount();
});

for (const kind of ['propose', 'confirm']) test(kind + ': synchronous duplicate and cross-command busy guard', async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; const handler = h.handler(kind);
  const first = kind === 'propose' ? handler(h.event()) : handler(); const second = kind === 'propose' ? handler(h.event()) : handler(); await second;
  const defaults = h.log.defaults; h.form().props.onSubmit(h.event()); assert.equal(h.log.defaults, defaults + 1); assert.equal(h.log.requests.length, index + 1);
  assert.equal(h.log.uuid, 1); await h.reply(index, kind === 'propose' ? candidate() : { intent: { intent_status: 'confirmed' } }); await first; h.unmount();
});

for (const kind of ['propose', 'confirm']) for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'site', 'instruction', 'new-request', 'replacement', 'layout']) for (const settlement of ['resolve', 'reject']) {
  test(kind + ': stale response quiet ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); const sameCandidate = candidate(); await h.setup(kind, sameCandidate); const index = h.log.requests.length;
    const retained = h.handler(kind); const old = h.start(kind); let json;
    if (stage === 'json') { json = h.packet(index); await tick(); }
    if (loss === 'unmount') h.unmount();
    else if (loss === 'site') h.render({ ...h.props, siteId: 'NONUSABLE-SITE-B' });
    else if (loss === 'layout') h.restartLayouts();
    else h.type('NONUSABLE-INSTRUCTION-B');
    const next = ['new-request', 'replacement', 'layout'].includes(loss); let nextPending;
    if (next) { assert.equal(h.busy(), false); nextPending = h.start('propose'); }
    if (loss === 'replacement') { await h.reply(index + 1, sameCandidate); await nextPending; }
    const before = h.snapshot();
    if (loss !== 'layout') { if (kind === 'propose') await retained(h.poison('old-submit-event')); else await retained(); }
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[index].pending.resolve(h.poison('old-response'));
      else h.log.requests[index].pending.reject(h.poison('old-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-json-error'));
    await old; await tick(); assert.deepEqual(h.snapshot(), before);
    if (next && loss !== 'replacement') {
      assert.equal(h.busy(), true); h.start('propose'); assert.equal(h.log.requests.length, index + 2, 'old finally must not release newer request');
      await h.reply(index + 1, sameCandidate); await nextPending; assert.ok(h.confirmButton());
    }
    h.unmount();
  });
}

for (const kind of ['propose', 'confirm']) for (const failure of ['fetch', 'json', 'http', 'non-error']) test(kind + ': current failure and explicit retry ' + failure, async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; const beforeRefresh = h.log.refresh; const pending = h.start(kind);
  if (failure === 'fetch') h.log.requests[index].pending.reject(new Error('NONUSABLE-FAILURE'));
  // Non-OK JSON failure retains the existing transport fallback. Missing
  // successful results are independently checked below before any created notice.
  if (failure === 'json') h.packet(index, false).reject(new Error('NONUSABLE-JSON-FAILURE'));
  if (failure === 'http') h.packet(index, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
  if (failure === 'non-error') h.log.requests[index].pending.reject({ kind: 'NONUSABLE-FAILURE' });
  await pending; h.render(); assert.equal(h.busy(), false); assert.ok(h.nodes(n => n.props.role === 'alert').length); assert.equal(h.log.refresh, beforeRefresh);
  if (failure === 'non-error') assert.ok(h.text().includes(kind === 'propose' ? 'לא ניתן להכין הצעה' : 'האישור נדחה'));
  const retry = h.start(kind); assert.equal(h.log.requests.length, index + 2); assert.equal(h.log.uuid, kind === 'propose' ? 2 : 1);
  await h.reply(index + 1, kind === 'propose' ? candidate() : { intent: { intent_status: 'confirmed' } }); await retry; h.unmount();
});

for (const condition of ['human', 'status']) test('confirm checks current eligibility itself before target read ' + condition, async () => {
  const h = harness(); const value = candidate(); await h.setup('confirm', value); const retained = h.handler('confirm');
  if (condition === 'human') value.intent.human_confirmation_required = false; else value.intent.intent_status = 'confirmed';
  h.render(); assert.equal(h.confirmButton(), undefined); const before = h.snapshot(); await retained(); assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('same ID and reused response object cannot revive an older confirmation view', async () => {
  const h = harness(); const same = candidate(); await h.setup('confirm', same); const retained = h.handler('confirm');
  const next = h.start('propose'); assert.equal(h.confirmButton(), undefined); const during = h.snapshot(); await retained(); assert.deepEqual(h.snapshot(), during); await h.reply(1, same); await next;
  const before = h.snapshot(); await retained(); assert.deepEqual(h.snapshot(), before);
  const current = h.start('confirm'); assert.equal(h.log.requests.length, 3); await h.reply(2, { intent: { intent_status: 'confirmed' } }); await current; h.unmount();
});

test('returned awaiting status installs a fresh view, retains identity/flags and allows explicit current attempt', async () => {
  const h = harness(); await h.setup('confirm'); const retained = h.handler('confirm'); const first = h.start('confirm');
  await h.reply(1, { intent: { id: 'NONUSABLE-IGNORED-ID', intent_status: 'awaiting_confirmation', human_confirmation_required: false, lawful_use_approval_required: false } }); await first;
  assert.ok(h.confirmButton()); assert.match(h.text(), /אישור שימוש חוקי מתועד/); const before = h.snapshot(); await retained(); assert.deepEqual(h.snapshot(), before);
  const next = h.start('confirm'); assert.equal(h.log.requests[2].path, '/api/digital-observer/action-intents/NONUSABLE-INTENT-A');
  await h.reply(2, { intent: { intent_status: 'confirmed' } }); await next; h.unmount();
});

test('obsolete confirm does not read captured intent ID after instruction edit', async () => {
  const h = harness(); const value = candidate(); await h.setup('confirm', value); const retained = h.handler('confirm'); h.type('NONUSABLE-NEW-INSTRUCTION');
  Object.defineProperty(value.intent, 'id', { get() { h.log.reads.push('obsolete-id'); throw Error('NONUSABLE-OBSOLETE'); } });
  const before = h.snapshot(); await retained(); assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('retained submit and input controls return before obsolete event reads', async () => {
  const h = harness(); h.type('NONUSABLE-A'); const oldSubmit = h.handler('propose'); const oldInput = h.textarea().props.onChange;
  h.type('NONUSABLE-B'); const before = h.snapshot(); await oldSubmit(h.poison('old-submit-event')); oldInput(h.poison('old-input-event'));
  assert.deepEqual(h.snapshot(), before); assert.equal(h.textarea().props.value, 'NONUSABLE-B'); h.unmount();
});

for (const kind of ['propose', 'confirm']) test(kind + ': equivalent same-Site rerender preserves instruction and current operation', async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; const pending = h.start(kind); h.render({ ...h.props });
  assert.equal(h.textarea().props.value, 'NONUSABLE-INSTRUCTION-A'); assert.equal(h.busy(), true);
  await h.reply(index, kind === 'propose' ? candidate() : { intent: { intent_status: 'confirmed' } }); await pending; h.render({ ...h.props });
  assert.match(h.text(), /NONUSABLE-PROPOSAL-TYPE/); assert.equal(h.textarea().props.value, 'NONUSABLE-INSTRUCTION-A'); h.unmount();
});

test('Site A to B to A cannot resurrect canceled busy or proposal', async () => {
  const h = harness(); await h.setup('propose'); const pending = h.start('propose');
  h.render({ siteId: 'NONUSABLE-SITE-B' }); h.render({ siteId: 'NONUSABLE-SITE-A' }); assert.equal(h.busy(), false); assert.equal(h.textarea().props.value, ''); assert.equal(h.confirmButton(), undefined);
  const before = h.snapshot(); h.log.requests[0].pending.resolve(h.poison('old-site-response')); await pending; assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('instruction A to B to A does not restore old proposal or pending busy', async () => {
  const h = harness(); await h.setup('confirm'); const retained = h.handler('confirm'); const pending = h.start('confirm');
  h.type('NONUSABLE-B'); h.type('NONUSABLE-INSTRUCTION-A'); assert.equal(h.busy(), false); assert.equal(h.confirmButton(), undefined);
  const before = h.snapshot(); await retained(); h.log.requests[1].pending.resolve(h.poison('old-instruction-response')); await pending; assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('initial layout cleanup/setup remains usable with no extra request UUID', async () => {
  const h = harness(); h.restartLayouts(); h.type('NONUSABLE-INSTRUCTION'); const pending = h.start('propose');
  await h.reply(0, candidate()); await pending; assert.ok(h.confirmButton()); assert.equal(h.log.uuid, 1); h.unmount();
});

test('raw whitespace and original HTML limits are preserved without new interpretation', async () => {
  const h = harness(); h.type('   '); assert.equal(h.textarea().props.required, true); assert.equal(h.textarea().props.minLength, 1); assert.equal(h.textarea().props.maxLength, 500); assert.equal(h.textarea().props.rows, 3);
  const pending = h.start('propose'); assert.equal(h.body(0).instruction, '   '); await h.reply(0, candidate()); await pending; h.unmount();
});

test('fresh proposal immediately retires prior confirmation even when replacement fails', async () => {
  const h = harness(); await h.setup('confirm'); const retained = h.handler('confirm'); const pending = h.start('propose'); assert.equal(h.confirmButton(), undefined);
  h.log.requests[1].pending.reject(new Error('NONUSABLE-REPLACEMENT-FAILURE')); await pending; h.render(); assert.equal(h.confirmButton(), undefined);
  const before = h.snapshot(); await retained(); assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('malformed confirmation status fails locally without replacing another proposal', async () => {
  const h = harness(); await h.setup('confirm'); const pending = h.start('confirm'); await h.reply(1, {}); await pending;
  assert.ok(h.nodes(n => n.props.role === 'alert').length); assert.ok(h.confirmButton()); assert.equal(h.log.refresh, 1); assert.match(h.text(), /NONUSABLE-EXPLANATION/); h.unmount();
});

test('HTTP-success malformed proposal JSON cannot claim proposal creation without a result', async () => {
  const h = harness(); await h.setup('propose'); const pending = h.start('propose'); h.packet(0, true).reject(new Error('NONUSABLE-JSON-FAILURE')); await pending; h.render();
  assert.equal(h.confirmButton(), undefined); assert.doesNotMatch(h.text(), /נוצרה הצעה מובנית בלבד/); assert.ok(h.text().includes('לא ניתן להכין הצעה')); assert.equal(h.log.refresh, 0); assert.equal(h.busy(), false); h.unmount();
});

test('current confirmation fallback message stays exact and never claims execution', async () => {
  const h = harness(); await h.setup('confirm'); const pending = h.start('confirm'); await h.reply(1, { intent: { intent_status: 'confirmed' } }); await pending;
  assert.ok(h.text().includes('הכוונה אושרה. ההרשאות והיכולת ייבדקו שוב לפני ביצוע.')); assert.match(h.text(), /בוצע בפועל: לא/); h.unmount();
});


for (const missing of ['absent', 'null']) test('missing successful proposal result reports failure and permits explicit retry ' + missing, async () => {
  const h = harness(); await h.setup('propose'); const pending = h.start('propose');
  h.packet(0, true).resolve(missing === 'absent' ? {} : { data: null }); await pending; h.render();
  assert.equal(h.confirmButton(), undefined); assert.doesNotMatch(h.text(), /נוצרה הצעה מובנית בלבד/);
  assert.ok(h.text().includes('לא ניתן להכין הצעה')); assert.equal(h.log.refresh, 0); assert.equal(h.busy(), false);
  const retry = h.start('propose'); assert.equal(h.log.requests.length, 2); assert.equal(h.log.uuid, 2);
  await h.reply(1, candidate()); await retry; assert.ok(h.confirmButton()); assert.equal(h.log.refresh, 1); h.unmount();
});
