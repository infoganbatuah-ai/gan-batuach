import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Closed actual-module QA, not real privacy requests or deletion proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = resolve(root, 'components/digital-observer/privacy-compliance-center.tsx');
assert.ok(statSync(path).isFile());
if (process.platform === 'darwin') {
  const raw = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless content');
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const code = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 32; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const initial = { siteId: 'site/a & b' };
const empty = () => ({ profiles: [], requests: [], holds: [], incidents: [], externalLegalApproval: 'PENDING', sensitiveActivation: 'FAIL_CLOSED' });
const populated = () => ({
  profiles: [{ id: 'profile-a', product_context: 'context-A', jurisdiction: 'jurisdiction-A', stated_purpose: 'policy-purpose-A', legal_decision_state: 'LEGAL_REVIEW_PENDING', active: false }],
  requests: [{ id: 'request-a', request_type: 'access', status: 'submitted', execution_status: 'not-executed-A', external_system_disposition: [], created_at: '2026-01-01T00:00:00Z' }],
  holds: [{ id: 'hold-a', hold_type: 'hold-type-A', status: 'active', documented_purpose: 'hold-purpose', review_due_at: null }],
  incidents: [{ id: 'incident-a', classification: 'classification-A', severity: 'severity-A', status: 'reported-A', notification_decision: 'pending-A', created_at: '2026-01-01T00:00:00Z' }],
  externalLegalApproval: 'PENDING', sensitiveActivation: 'FAIL_CLOSED'
});
class FakeFormData {
  constructor(values = { request_type: 'access', purpose: 'Explicit test purpose' }) { this.values = values; this.reads = []; }
  get(name) { this.reads.push(name); return this.values[name] ?? null; }
}
function harness() {
  let cells = [], effects = [], cursor = 0, tree, key, inner, props, mounted = false, writes = 0;
  const requests = [];
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  const react = {
    useState(value) {
      const index = cursor++, ownerCells = cells;
      if (!(index in ownerCells)) ownerCells[index] = typeof value === 'function' ? value() : value;
      return [ownerCells[index], next => { writes++; ownerCells[index] = typeof next === 'function' ? next(ownerCells[index]) : next; }];
    },
    useRef(value) { const index = cursor++; if (!(index in cells)) cells[index] = { current: value }; return cells[index]; },
    useCallback(callback, deps) { const index = cursor++; if (!cells[index] || changed(cells[index].deps, deps)) cells[index] = { callback, deps }; return cells[index].callback; },
    useLayoutEffect(setup, deps) { const index = cursor++, old = effects[index]; if (!old || changed(old.deps, deps)) effects[index] = { setup, deps, pending: true, cleanup: old?.cleanup }; }
  };
  const exported = {};
  const context = vm.createContext({ exports: exported, FormData: FakeFormData, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return Object.fromEntries(['AlertTriangle', 'FileCheck2', 'LockKeyhole', 'Scale', 'ShieldCheck'].map(name => [name, name]));
    throw Error(`Unapproved import ${name}`);
  }, fetch(url, options) { const gate = deferred(); requests.push({ url, options, gate }); return gate.promise; } });
  new vm.Script(code, { filename: path }).runInContext(context, { timeout: 1000 });
  function cleanup() { for (const effect of effects) if (effect?.cleanup) { effect.cleanup(); effect.cleanup = undefined; } }
  function render(next = props || initial) {
    props = next;
    const wrapper = exported.PrivacyComplianceCenter(next);
    assert.equal(typeof wrapper.type, 'function');
    if (!mounted || key !== wrapper.key || inner !== wrapper.type) { cleanup(); cells = []; effects = []; key = wrapper.key; inner = wrapper.type; mounted = true; }
    cursor = 0; tree = inner(wrapper.props);
    let rerender = false;
    for (const effect of effects) if (effect?.pending) {
      effect.cleanup?.(); effect.pending = false;
      const before = writes; effect.cleanup = effect.setup(); rerender ||= before !== writes;
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
  function reconnect() { cleanup(); for (const effect of effects) if (effect) effect.pending = true; render(); }
  function poison() { const reads = []; return { reads, value: new Proxy({}, { get(_, field) { if (field === 'then') return undefined; reads.push(String(field)); throw Error('obsolete access'); } }) }; }
  render();
  return { render, nodes, one, cleanup, reconnect, requests, poison, text: () => textOf(tree), action: () => one('form').props.action,
    snapshot: () => ({ writes, requests: requests.length }),
    submit(form = new FakeFormData()) { return one('form').props.action(form); },
    async respond(payload = { data: populated() }, ok = true, request = requests.at(-1)) { request.gate.resolve({ ok, json: async () => payload }); await tick(); render(); },
    async jsonStage(request = requests.at(-1)) { const gate = deferred(); request.gate.resolve({ ok: true, json: () => gate.promise }); await tick(); return gate; }
  };
}
const healthyEmpty = ['אין מדיניות מאושרת', 'אין בקשות', 'אין holds גלויים', 'אין אירועים מדווחים'];
const markers = ['context-A', 'not-executed-A', 'hold-type-A', 'classification-A'];
function noOldSnapshot(h) { for (const text of [...healthyEmpty, ...markers]) assert.ok(!h.text().includes(text), `unexpected ${text}`); }
function pendingData(h) {
  noOldSnapshot(h);
  for (const text of ['טוען פרופילי מדיניות…', 'טוען בקשות…', 'טוען holds…', 'טוען אירועי פרטיות…']) assert.ok(h.text().includes(text));
}
function unavailable(h) {
  noOldSnapshot(h);
  for (const text of ['פרופילי המדיניות אינם זמינים', 'הבקשות אינן זמינות', 'נתוני ה־holds אינם זמינים', 'אירועי הפרטיות אינם זמינים']) assert.ok(h.text().includes(text));
  assert.equal(h.one('button').props.disabled, false);
  assert.equal(h.nodes(node => node.props?.className === 'do-notice danger').length, 1);
}
async function stage(h, name) {
  if (name === 'initial') return;
  await h.respond(); h.submit();
  if (name === 'refresh') await h.respond({ data: { accepted: true } });
}
async function completeSubmit(h) {
  await h.respond({ data: { accepted: true } });
  const request = h.requests.at(-1);
  assert.equal(request.options.cache, 'no-store');
  await h.respond();
  assert.equal(h.one('button').props.disabled, false);
  for (const text of markers) assert.ok(h.text().includes(text));
}

test('initial exact GET; four loading sections; legal warnings and form contract preserved', () => {
  const h = harness(); assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/digital-observer/privacy-compliance?site_id=site%2Fa%20%26%20b');
  assert.deepEqual(copy(h.requests[0].options), { cache: 'no-store' }); pendingData(h);
  assert.equal(h.one('button').props.disabled, false, 'submit allowed during initial GET');
  const select = h.one('select'); assert.equal(select.props.name, 'request_type'); assert.equal(select.props.defaultValue, 'access');
  assert.deepEqual(h.nodes(node => node.type === 'option').map(node => node.props.value), ['access', 'export', 'correction', 'restriction', 'deletion', 'objection']);
  const area = h.one('textarea'); assert.equal(area.props.name, 'purpose'); assert.equal(area.props.minLength, 5); assert.equal(area.props.maxLength, 500); assert.equal(area.props.required, true); assert.equal(area.props.placeholder, 'תיאור קצר ומדויק');
  for (const text of [
    'אין עדיין אישור משפטי חיצוני. זיהוי ביומטרי, ניטור ילדים רגיש, מעקב מיקום וחקירה רגישה נשארים חסומים בשרת.',
    'PENDING', 'FAIL CLOSED', 'יישום טכני אינו אישור משפטי.', 'מצב לא ידוע או חסר מסמך שולל הפעלה.',
    'מחיקה מקומית אינה מוכיחה מחיקה מ-DVR/NVR/VMS.', 'קבלה מלאה ניתנת רק לאחר אימות כל המערכות החיצוניות.'
  ]) assert.ok(h.text().includes(text));
});
test('successful populated response renders all four original records and status labels', async () => {
  const h = harness(); await h.respond();
  for (const text of [...markers, 'ממתין לבחינה משפטית', 'הוגש', 'פעיל', 'severity-A', 'pending-A']) assert.ok(h.text().includes(text));
  assert.equal(h.requests.length, 1);
});
test('healthy empty is shown only after successful empty response, with legal caveats', async () => {
  const h = harness(); await h.respond({ data: empty() });
  for (const text of [...healthyEmpty, 'לא בוצעה מחיקה או יצוא אוטומטיים.', 'מחיקה עדיין דורשת מדיניות מאושרת ובדיקת scope.', 'מצב זה אינו מהווה אישור שאין סיכונים פתוחים.']) assert.ok(h.text().includes(text));
});
test('POST exact fields captured synchronously, duplicate before rerender inert, exactly one owned refresh', async () => {
  const h = harness(); await h.respond(); const form = new FakeFormData({ request_type: 'restriction', purpose: 'Original purpose' });
  const action = h.action(); const done = action(form); form.values.purpose = 'Changed later';
  const blocked = h.poison(); await action(blocked.value); assert.deepEqual(blocked.reads, []);
  assert.equal(h.requests.length, 2); assert.deepEqual(form.reads, ['request_type', 'purpose']);
  const request = h.requests[1]; assert.equal(request.url, '/api/digital-observer/privacy-compliance');
  assert.deepEqual(copy(request.options), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'submit_rights_request', site_id: initial.siteId, request_type: 'restriction', purpose: 'Original purpose' }) });
  h.render(); pendingData(h); assert.equal(h.one('button').props.disabled, true);
  await completeSubmit(h); await done; assert.equal(h.requests.length, 3);
});
test('FormData failure is caught inside owned try and releases synchronous busy', async () => {
  const h = harness(), poison = h.poison(); await h.submit(poison.value); h.render();
  assert.deepEqual(poison.reads, ['get']); assert.equal(h.requests.length, 1); unavailable(h);
  h.submit(); assert.equal(h.requests.length, 2); await completeSubmit(h);
});
test('same Site rerender preserves request and settled data without additional GET', async () => {
  const h = harness(); h.render({ ...initial }); assert.equal(h.requests.length, 1); await h.respond(); h.render({ ...initial });
  assert.equal(h.requests.length, 1); assert.ok(h.text().includes('context-A'));
});
for (const boundary of ['fetch', 'json']) test(`submission invalidates initial ${boundary} before refreshed result`, async () => {
  const h = harness(); const gate = boundary === 'fetch' ? h.requests[0].gate : await h.jsonStage();
  h.submit(); const before = h.snapshot(), poison = h.poison(); gate.resolve(poison.value); await tick();
  assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before); h.render(); pendingData(h);
  await completeSubmit(h); assert.equal(h.requests.length, 3);
});
for (const name of ['initial', 'post', 'refresh']) for (const failure of ['fetch', 'json', 'http']) {
  test(`current ${name}/${failure} visible, clears old data, retry usable`, async () => {
    const h = harness(); await stage(h, name);
    if (failure === 'fetch') h.requests.at(-1).gate.reject(Error('offline'));
    else if (failure === 'json') { const gate = await h.jsonStage(); gate.reject(Error('invalid JSON')); }
    else h.requests.at(-1).gate.resolve({ ok: false, json: async () => ({ error: 'Rejected current request' }) });
    await tick(); h.render(); unavailable(h);
    const count = h.requests.length; h.submit(); h.submit(); assert.equal(h.requests.length, count + 1);
    h.render(); pendingData(h); await completeSubmit(h);
  });
}
for (const name of ['initial', 'post', 'refresh']) for (const boundary of ['fetch', 'json']) for (const loss of ['unmount', 'site', 'roundtrip', 'layout']) for (const rejected of [false, true]) {
  test(`${name}/${boundary}/${loss}/${rejected ? 'reject' : 'resolve'} old response cannot act or release new submit`, async () => {
    const h = harness(); await stage(h, name); const retained = h.action();
    const gate = boundary === 'fetch' ? h.requests.at(-1).gate : await h.jsonStage();
    if (loss === 'unmount') h.cleanup();
    else if (loss === 'layout') h.reconnect();
    else { h.render({ siteId: 'site-b' }); if (loss === 'roundtrip') h.render(initial); }
    if (loss !== 'unmount') { h.submit(); h.render(); pendingData(h); assert.equal(h.one('button').props.disabled, true); }
    const before = h.snapshot(), poison = h.poison();
    if (rejected) gate.reject(poison.value); else gate.resolve(poison.value);
    await tick(); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
    const badForm = h.poison(); await retained(badForm.value); assert.deepEqual(badForm.reads, []); assert.deepEqual(h.snapshot(), before);
    if (loss !== 'unmount') {
      h.render(); assert.equal(h.one('button').props.disabled, true); await h.submit(badForm.value);
      assert.deepEqual(badForm.reads, []); assert.deepEqual(h.snapshot(), before);
      await completeSubmit(h);
    }
  });
}
for (const name of ['initial', 'post', 'refresh']) test(`${name} old HTTP status and JSON getters not touched after Site loss`, async () => {
  const h = harness(); await stage(h, name); const gate = h.requests.at(-1).gate;
  h.render({ siteId: 'site-b' }); const reads = [], before = h.snapshot();
  gate.resolve({ get ok() { reads.push('ok'); throw Error('old status'); }, get json() { reads.push('json'); throw Error('old body'); } });
  await tick(); assert.deepEqual(reads, []); assert.deepEqual(h.snapshot(), before); pendingData(h);
});
for (const loss of ['unmount', 'site', 'roundtrip', 'layout']) test(`retained settled action ${loss} cannot read FormData or start IO`, async () => {
  const h = harness(); await h.respond(); const retained = h.action();
  if (loss === 'unmount') h.cleanup();
  else if (loss === 'layout') { h.reconnect(); await h.respond(); }
  else { h.render({ siteId: 'site-b' }); if (loss === 'roundtrip') h.render(initial); await h.respond(); }
  const before = h.snapshot(), poison = h.poison(); await retained(poison.value); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
  if (loss !== 'unmount') { assert.equal(h.one('button').props.disabled, false); h.submit(); await completeSubmit(h); }
});
