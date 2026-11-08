import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = resolve(root, 'components/digital-observer/natural-language-investigation-search.tsx');
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
const compilation = () => ({ status: 'NONUSABLE-STATUS', compilerVersion: 'NONUSABLE-COMPILER', preview: { scope: 'NONUSABLE-SCOPE', cameras: 'NONUSABLE-CAMERAS', period: 'NONUSABLE-PERIOD', filters: 'NONUSABLE-FILTERS' }, clarification: null, limitation: null });
const result = (nextCursor = null) => ({ query: { timeZone: 'Asia/Jerusalem', question: 'NONUSABLE-SERVER-QUERY-NOT-REQUEST' }, answer: 'NONUSABLE-ANSWER',
  grounding: { incidentIds: [], eventIds: [], evidenceIds: [] }, incidents: [], events: [], queryLatencyMs: 12,
  coverage: { scanCapReached: false }, pagination: { nextCursor } });
const pagePayload = (nextCursor = 20) => ({ status: 'NONUSABLE-RESULT', compilation: compilation(), result: result(nextCursor), debug: { trace: 'NONUSABLE-DEBUG' } });
const clarification = () => ({ status: 'NONUSABLE-CLARIFICATION', compilation: { ...compilation(), clarification: { question: 'NONUSABLE-CHOOSE', choices: [{ id: 'NONUSABLE-CAMERA-A', label: 'NONUSABLE-CHOICE-A' }, { id: 'NONUSABLE-CAMERA-B', label: 'NONUSABLE-CHOICE-B' }] } }, result: null, debug: null });

function harness() {
  let props = { observerSiteId: 'NONUSABLE-SITE-A', siteName: 'NONUSABLE-SITE-NAME-A', adminMode: false };
  let slots = [], cursor = 0, layouts = [], mounted = false, key, tree;
  const log = { requests: [], json: 0, reads: [], writes: 0, defaults: 0, times: [] };
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      const cells = slots; return [slots[i], next => { log.writes++; cells[i] = typeof next === 'function' ? next(cells[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useLayoutEffect(setup) { const i = cursor++; if (!(i in slots)) { slots[i] = true; layouts.push({ setup, cleanup: null }); } }
  };
  const neutral = () => null;
  const allowed = { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' }, 'lucide-react': new Proxy({}, { get: () => neutral }) };
  const exports = {};
  class SyntheticDateTimeFormat {
    constructor(locale, options) { this.locale = locale; this.options = copy(options); }
    format(value) { log.times.push({ locale: this.locale, options: this.options, iso: value.toISOString() }); return 'NONUSABLE-LOCAL-TIME'; }
  }
  const context = vm.createContext({ exports, Error, Intl: { DateTimeFormat: SyntheticDateTimeFormat }, require(name) {
    assert.ok(Object.hasOwn(allowed, name), 'unapproved import ' + name); return allowed[name];
  }, fetch(path, options) { const pending = deferred(); log.requests.push({ path, options, pending }); return pending.promise; } });
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
  function unmount() { for (const effect of layouts) effect.cleanup?.(); mounted = false; }
  function render(next = props) {
    props = next; const wrapper = exports.NaturalLanguageInvestigationSearch(props);
    assert.equal(typeof wrapper.type, 'function'); assert.equal(wrapper.key, props.observerSiteId);
    if (mounted && key !== wrapper.key) unmount();
    if (!mounted) { slots = []; layouts = []; mounted = true; key = wrapper.key; }
    cursor = 0; tree = wrapper.type(wrapper.props);
    for (const effect of layouts) if (!effect.cleanup) effect.cleanup = effect.setup();
  }
  function restartLayouts() { for (const effect of layouts) { effect.cleanup?.(); effect.cleanup = effect.setup(); } render(); }
  function form() { const found = nodes(n => n.type === 'form'); assert.equal(found.length, 1); return found[0]; }
  function textarea() { return nodes(n => n.type === 'textarea')[0]; }
  function type(value) { textarea().props.onChange({ target: { value } }); render(); }
  function example(index = 1) { const button = nodes(n => n.type === 'button' && typeof n.key === 'string' && !n.key.startsWith('NONUSABLE-'))[index]; assert.ok(button); button.props.onClick(); render(); }
  function page() { return nodes(n => n.type === 'button' && walkText(n).includes('העמוד הבא'))[0]; }
  function choice(index = 0) { return nodes(n => n.type === 'button' && n.key === (index ? 'NONUSABLE-CAMERA-B' : 'NONUSABLE-CAMERA-A'))[0]; }
  function handler(kind) { if (kind === 'main') return form().props.onSubmit; const button = kind === 'page' ? page() : choice(); assert.ok(button); return button.props.onClick; }
  function event() { return { preventDefault() { log.defaults++; } }; }
  function start(kind, callback = handler(kind)) { if (kind === 'main') callback(event()); else callback(); render(); }
  function packet(index = 0, ok = true) { const json = deferred(); assert.ok(log.requests[index]);
    log.requests[index].pending.resolve({ get ok() { log.reads.push('ok'); return ok; }, json() { log.json++; return json.promise; } }); return json; }
  async function reply(index, data) { packet(index).resolve({ data }); await tick(); render(); }
  function body(index) { return JSON.parse(log.requests[index].options.body); }
  function busy() { return nodes(n => n.type === 'button' && n.props.type === 'submit')[0].props.disabled; }
  function poison(label) { return new Proxy({}, { get(_, property) { if (property === 'then') return undefined; log.reads.push(label + ':' + String(property)); throw Error('poison ' + label); } }); }
  function snapshot() { return copy({ requests: log.requests.length, json: log.json, reads: log.reads, writes: log.writes, defaults: log.defaults, times: log.times }); }
  async function setup(kind) { type('NONUSABLE-QUESTION-A'); if (kind !== 'main') { start('main'); await reply(0, kind === 'choice' ? clarification() : pagePayload()); } }
  render();
  return { log, nodes, text, render, unmount, restartLayouts, form, textarea, type, example, page, choice, handler, event, start, packet, reply,
    body, busy, poison, snapshot, setup, get props() { return props; } };
}

test('current main request preserves exact fetch options and unspecified camera', async () => {
  const h = harness(); await h.setup('main'); h.start('main'); const request = h.log.requests[0];
  assert.equal(request.path, '/api/digital-observer/investigation'); assert.deepEqual(Object.keys(request.options).sort(), ['body', 'headers', 'method']);
  assert.equal(request.options.method, 'POST'); assert.deepEqual(copy(request.options.headers), { 'content-type': 'application/json' });
  assert.deepEqual(h.body(0), { observer_site_id: 'NONUSABLE-SITE-A', question: 'NONUSABLE-QUESTION-A', cursor: 0, limit: 20 });
  await h.reply(0, pagePayload()); assert.match(h.text(), /NONUSABLE-ANSWER/); assert.ok(h.page()); h.unmount();
});

test('clarification, two pages and fresh main request preserve and reset the exact camera/question scope', async () => {
  const h = harness(); await h.setup('choice'); h.start('choice', h.choice(1).props.onClick);
  assert.deepEqual(h.body(1), { observer_site_id: 'NONUSABLE-SITE-A', question: 'NONUSABLE-QUESTION-A', camera_source_id: 'NONUSABLE-CAMERA-B', cursor: 0, limit: 20 });
  await h.reply(1, pagePayload(20)); h.start('page'); assert.deepEqual(h.body(2), { ...h.body(1), cursor: 20 });
  await h.reply(2, pagePayload(40)); h.start('page'); assert.deepEqual(h.body(3), { ...h.body(1), cursor: 40 });
  await h.reply(3, pagePayload(60)); h.start('main');
  assert.deepEqual(h.body(4), { observer_site_id: 'NONUSABLE-SITE-A', question: 'NONUSABLE-QUESTION-A', cursor: 0, limit: 20 });
  await h.reply(4, pagePayload(null)); assert.equal(h.page(), undefined); h.unmount();
});

test('unspecified camera stays omitted on later page including cursor zero', async () => {
  const h = harness(); await h.setup('page'); h.start('page'); assert.equal(Object.hasOwn(h.body(1), 'camera_source_id'), false); assert.equal(h.body(1).cursor, 20);
  await h.reply(1, pagePayload(0)); h.start('page'); assert.equal(h.body(2).cursor, 0); assert.equal(Object.hasOwn(h.body(2), 'camera_source_id'), false);
  await h.reply(2, pagePayload(null)); h.unmount();
});

for (const kind of ['main', 'choice', 'page']) for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'site', 'question', 'example', 'new-request', 'layout']) for (const settlement of ['resolve', 'reject']) {
  test(kind + ': stale response quiet ' + [stage, loss, settlement].join('/'), async () => {
    const h = harness(); await h.setup(kind); const index = h.log.requests.length; const retained = h.handler(kind); h.start(kind); let json;
    if (stage === 'json') { json = h.packet(index); await tick(); }
    if (loss === 'unmount') h.unmount();
    else if (loss === 'site') h.render({ ...h.props, observerSiteId: 'NONUSABLE-SITE-B' });
    else if (loss === 'example') h.example();
    else if (loss === 'layout') h.restartLayouts();
    else h.type('NONUSABLE-QUESTION-B');
    const next = loss === 'new-request' || loss === 'layout';
    if (next) { assert.equal(h.busy(), false); h.start('main'); }
    const before = h.snapshot();
    if (loss !== 'layout') { if (kind === 'main') retained(h.poison('old-form-event')); else retained(); }
    if (stage === 'fetch') {
      if (settlement === 'resolve') h.log.requests[index].pending.resolve(h.poison('old-response'));
      else h.log.requests[index].pending.reject(h.poison('old-error'));
    } else if (settlement === 'resolve') json.resolve({ get data() { h.log.reads.push('old-data'); throw Error('poison'); } });
    else json.reject(h.poison('old-json-error'));
    await tick(); assert.deepEqual(h.snapshot(), before);
    if (next) { assert.equal(h.busy(), true); h.start('main'); assert.equal(h.log.requests.length, index + 2); await h.reply(index + 1, pagePayload(null)); }
    h.unmount();
  });
}

for (const kind of ['main', 'choice', 'page']) test(kind + ': synchronous duplicate and active busy native default', async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; const handler = h.handler(kind);
  if (kind === 'main') { handler(h.event()); handler(h.event()); } else { handler(); handler(); }
  const defaults = h.log.defaults; h.form().props.onSubmit(h.event()); assert.equal(h.log.defaults, defaults + 1);
  assert.equal(h.log.requests.length, index + 1); await h.reply(index, pagePayload()); h.unmount();
});

for (const kind of ['main', 'choice', 'page']) for (const failure of ['http', 'json', 'missing-data', 'non-error']) test(kind + ': current failure and explicit retry ' + failure, async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; h.start(kind); const request = h.body(index);
  if (failure === 'http') h.packet(index, false).resolve({ error: 'NONUSABLE-HTTP-FAILURE' });
  if (failure === 'json') h.packet(index).reject(new Error('NONUSABLE-JSON-FAILURE'));
  if (failure === 'missing-data') h.packet(index).resolve({});
  if (failure === 'non-error') h.log.requests[index].pending.reject({ kind: 'NONUSABLE-FAILURE' });
  await tick(); h.render(); assert.equal(h.busy(), false);
  assert.match(h.text(), failure === 'http' ? /NONUSABLE-HTTP-FAILURE/ : failure === 'json' ? /NONUSABLE-JSON-FAILURE/ : /לא ניתן לבצע את החיפוש כרגע/);
  if (kind === 'choice') assert.ok(h.choice()); if (kind === 'page') assert.ok(h.page());
  h.start(kind); assert.deepEqual(h.body(index + 1), request); await h.reply(index + 1, pagePayload()); h.unmount();
});

test('short question prevents native default without HTTP', () => {
  const h = harness(); h.type(' X '); h.start('main'); assert.equal(h.log.defaults, 1); assert.equal(h.log.requests.length, 0); assert.equal(h.busy(), true);
  assert.equal(h.textarea().props.rows, 3); assert.equal(h.textarea().props.maxLength, 500); h.unmount();
});

test('manual edit and example selection clear result/choices/cursor before another search', async () => {
  const h = harness(); await h.setup('page'); const oldPage = h.page().props.onClick; const oldText = h.textarea().props.onChange;
  h.type('NONUSABLE-QUESTION-B'); assert.equal(h.page(), undefined); assert.doesNotMatch(h.text(), /NONUSABLE-ANSWER/); const before = h.snapshot();
  oldPage(); oldText(h.poison('old-question-event')); assert.deepEqual(h.snapshot(), before);
  h.start('main'); await h.reply(1, clarification()); h.example(); assert.equal(h.choice(), undefined); assert.doesNotMatch(h.text(), /NONUSABLE-CHOOSE/); h.unmount();
});

for (const kind of ['choice', 'page']) test(kind + ': later payload never reuses retained result capability even for same object/IDs/cursor', async () => {
  const h = harness(); const samePayload = kind === 'choice' ? clarification() : pagePayload(); await h.setup('main'); h.start('main'); await h.reply(0, samePayload);
  const retained = h.handler(kind); h.start('main'); await h.reply(1, samePayload);
  const before = h.snapshot(); retained(); await tick(); assert.deepEqual(h.snapshot(), before);
  h.start(kind); assert.equal(h.log.requests.length, 3); await h.reply(2, pagePayload(null)); h.unmount();
});

for (const kind of ['main', 'choice', 'page']) test(kind + ': same-Site display props preserve question and pending current result', async () => {
  const h = harness(); await h.setup(kind); const index = h.log.requests.length; h.start(kind);
  h.render({ ...h.props, siteName: 'NONUSABLE-RENAMED-SITE', adminMode: true }); assert.equal(h.textarea().props.value, 'NONUSABLE-QUESTION-A'); assert.equal(h.busy(), true);
  await h.reply(index, pagePayload()); assert.match(h.text(), /NONUSABLE-ANSWER/); assert.equal(h.nodes(n => n.type === 'details').length, 1);
  h.render({ ...h.props, adminMode: false }); assert.match(h.text(), /NONUSABLE-ANSWER/); assert.equal(h.nodes(n => n.type === 'details').length, 0); h.unmount();
});

test('failed fresh main can retain otherwise valid prior selected-camera result', async () => {
  const h = harness(); await h.setup('choice'); h.start('choice'); await h.reply(1, pagePayload()); h.start('main');
  h.log.requests[2].pending.reject(new Error('NONUSABLE-NEW-FAILURE')); await tick(); h.render(); assert.ok(h.page());
  h.start('page'); assert.equal(h.body(3).camera_source_id, 'NONUSABLE-CAMERA-A'); assert.equal(h.body(3).question, 'NONUSABLE-QUESTION-A');
  await h.reply(3, pagePayload(null)); h.unmount();
});

test('Site A to B to A cannot resurrect old busy, result or callbacks', async () => {
  const h = harness(); await h.setup('main'); const retained = h.handler('main'); h.start('main'); const initial = h.textarea().props.value;
  h.render({ ...h.props, observerSiteId: 'NONUSABLE-SITE-B' }); h.render({ ...h.props, observerSiteId: 'NONUSABLE-SITE-A' });
  assert.notEqual(h.textarea().props.value, initial); assert.equal(h.busy(), false); const before = h.snapshot(); retained(h.poison('old-site-event'));
  h.log.requests[0].pending.resolve(h.poison('old-site-response')); await tick(); assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('question A to B to A cannot revive canceled request busy or old cursor', async () => {
  const h = harness(); await h.setup('page'); h.start('page'); h.type('NONUSABLE-QUESTION-B'); h.type('NONUSABLE-QUESTION-A');
  assert.equal(h.busy(), false); assert.equal(h.page(), undefined); const before = h.snapshot();
  h.log.requests[1].pending.resolve(h.poison('old-question-response')); await tick(); assert.deepEqual(h.snapshot(), before); h.unmount();
});

test('current empty result, limitation and clarification render without an inferred answer', async () => {
  const h = harness(); await h.setup('main'); h.start('main'); const payload = clarification();
  payload.compilation.limitation = { code: 'NONUSABLE-LIMIT', explanation: 'NONUSABLE-LIMIT-EXPLANATION' };
  await h.reply(0, payload); assert.match(h.text(), /NONUSABLE-LIMIT-EXPLANATION/); assert.ok(h.choice()); assert.equal(h.page(), undefined);
  h.start('choice'); await h.reply(1, pagePayload(null)); assert.match(h.text(), /NONUSABLE-ANSWER/); assert.equal(h.page(), undefined); h.unmount();
});

test('representative synthetic evidence/coverage/time/debug markup stays intact and links are only rendered', async () => {
  const h = harness(); await h.setup('main'); h.render({ ...h.props, adminMode: true }); h.start('main'); const payload = pagePayload(null);
  payload.result.coverage.scanCapReached = true;
  payload.result.grounding = { incidentIds: ['NONUSABLE-INCIDENT'], eventIds: ['NONUSABLE-EVENT'], evidenceIds: ['NONUSABLE-EVIDENCE'] };
  payload.result.incidents = [{ id: 'NONUSABLE-INCIDENT', siteId: 'NONUSABLE-SITE-A', title: 'NONUSABLE-INCIDENT-TITLE', summary: 'NONUSABLE-SUMMARY', status: 'NONUSABLE-STATUS',
    cameraName: 'NONUSABLE-CAMERA', lastActivityAt: '2026-01-01T00:00:00Z', risk: { score: 20, band: 'NONUSABLE-RISK' }, verification: { status: 'NONUSABLE-VERIFICATION', confidence: 0.5 },
    decision: { final: 'NONUSABLE-DECISION', current: null }, evidence: { states: ['AVAILABLE', 'NO_RECORDING_BY_POLICY', 'EXPIRED', 'FAILED', 'UNAVAILABLE'], playbackPaths: ['/NONUSABLE-EVIDENCE'] },
    timeline: [{ eventId: 'NONUSABLE-EVENT', label: 'NONUSABLE-TIMELINE', timestamp: '2026-01-01T00:00:00Z', evidenceState: 'AVAILABLE' }] }];
  payload.result.events = [{ id: 'NONUSABLE-EVENT', label: 'NONUSABLE-EVENT-LABEL', cameraName: 'NONUSABLE-CAMERA', occurredAt: '2026-01-01T00:00:00Z', confidence: 0.7,
    evidence: { state: 'EXPIRED', playbackPath: '/NONUSABLE-EVENT-EVIDENCE' } }];
  await h.reply(0, payload);
  for (const label of ['NONUSABLE-INCIDENT-TITLE', 'NONUSABLE-TIMELINE', 'NONUSABLE-EVENT-LABEL', 'NONUSABLE-LOCAL-TIME', 'ראיה זמינה', 'ללא הקלטה לפי המדיניות', 'הראיה פגה', 'יצירת הראיה נכשלה', 'ראיה אינה זמינה', 'תקרת הסריקה', 'NONUSABLE-DEBUG']) assert.ok(h.text().includes(label), label);
  assert.ok(h.log.times.length >= 3);
  assert.ok(h.log.times.every(item => item.locale === 'he-IL' && item.options.timeZone === 'Asia/Jerusalem'));
  const links = h.nodes(n => n.type === 'a').map(n => n.props.href);
  assert.deepEqual(links, ['/digital-observer/incidents?site=NONUSABLE-SITE-A&incident=NONUSABLE-INCIDENT', '/NONUSABLE-EVIDENCE', '/NONUSABLE-EVENT-EVIDENCE']);
  assert.equal(h.log.requests.length, 1); assert.match(h.text(), /אין SQL חופשי/); assert.match(h.text(), /אין זיהוי פנים/); h.unmount();
});

for (const kind of ['choice', 'page']) test(kind + ': obsolete handler does not read captured option/cursor properties', async () => {
  const h = harness(); await h.setup('main'); h.start('main'); const payload = kind === 'choice' ? clarification() : pagePayload();
  await h.reply(0, payload); const retained = h.handler(kind); h.type('NONUSABLE-NEW-QUESTION');
  const target = kind === 'choice' ? payload.compilation.clarification.choices[0] : payload.result.pagination;
  Object.defineProperty(target, kind === 'choice' ? 'id' : 'nextCursor', { get() { h.log.reads.push('obsolete-option'); throw Error('NONUSABLE-OBSOLETE'); } });
  const before = h.snapshot(); retained(); await tick(); assert.deepEqual(h.snapshot(), before); h.unmount();
});
