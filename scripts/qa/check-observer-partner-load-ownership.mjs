import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Actual module, closed transport; no application/provider activation.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const path = resolve(root, 'components/digital-observer/partner-integration-center.tsx');
assert.ok(statSync(path).isFile(), 'regular product source');
if (process.platform === 'darwin') {
  const value = execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim();
  assert.match(value, /^\d+$/);
  const flags = Number(value);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, 'refuse dataless source before content read');
}
const ts = createRequire(resolve(root, 'package.json'))('typescript');
const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const copy = value => JSON.parse(JSON.stringify(value));
const initial = { organizationId: 'org/a & b', organizationName: 'Organization A' };
const empty = () => ({ partner: null, customers: [], brand: null, serviceAccounts: [], externalProof: 'NOT_PROVEN', productionActivated: false });
const populated = () => ({
  partner: { id: 'partner-a', partner_key: 'key-a', partner_type: 'sdk', partner_status: 'partner-active' },
  customers: [{ id: 'customer-a', external_customer_reference_hint: 'hint-A', customer_status: 'customer-active', created_at: '2026-01-02T03:04:05Z' }],
  brand: { brand_name: 'Brand A', product_name: 'Product A', primary_color: '#123456', accent_color: '#abcdef', domain_status: 'brand-pending' },
  serviceAccounts: [{ service_account_id: 'service-a', access_kind: 'read', partner_customer_id: 'customer-a' }],
  externalProof: 'NOT_PROVEN', productionActivated: false
});
function harness() {
  let slots = [], effects = [], cursor = 0, tree, key, inner, props, mounted = false, writes = 0;
  const requests = [];
  const jsx = (type, props, key) => ({ type, props: props || {}, key });
  const changed = (a, b) => !a || b.some((value, index) => !Object.is(value, a[index]));
  const react = {
    useState(value) {
      const index = cursor++, cells = slots;
      if (!(index in cells)) cells[index] = typeof value === 'function' ? value() : value;
      return [cells[index], next => { writes++; cells[index] = typeof next === 'function' ? next(cells[index]) : next; }];
    },
    useRef(value) { const index = cursor++; if (!(index in slots)) slots[index] = { current: value }; return slots[index]; },
    useCallback(callback, deps) { const index = cursor++; if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { callback, deps }; return slots[index].callback; },
    useLayoutEffect(setup, deps) {
      const index = cursor++, old = effects[index];
      if (!old || changed(old.deps, deps)) effects[index] = { setup, deps, pending: true, cleanup: old?.cleanup };
    }
  };
  const exported = {};
  const context = vm.createContext({ exports: exported, require(name) {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return Object.fromEntries(['Boxes', 'Building2', 'KeyRound', 'Palette', 'RefreshCw', 'ShieldCheck', 'UsersRound'].map(name => [name, name]));
    throw Error(`Unexpected import ${name}`);
  }, fetch(url, options) { const gate = deferred(); requests.push({ url, options, gate }); return gate.promise; } });
  new vm.Script(compiled, { filename: path }).runInContext(context, { timeout: 1000 });
  function cleanup() { for (const effect of effects) if (effect?.cleanup) { effect.cleanup(); effect.cleanup = undefined; } }
  function render(next = props || initial) {
    props = next;
    const wrapper = exported.PartnerIntegrationCenter(next);
    assert.equal(typeof wrapper.type, 'function');
    if (!mounted || wrapper.key !== key || wrapper.type !== inner) {
      cleanup(); slots = []; effects = []; key = wrapper.key; inner = wrapper.type; mounted = true;
    }
    cursor = 0; tree = inner(wrapper.props);
    let rerender = false;
    for (const effect of effects) if (effect?.pending) {
      effect.cleanup?.(); effect.pending = false;
      const before = writes; effect.cleanup = effect.setup(); rerender ||= before !== writes;
    }
    if (rerender) { cursor = 0; tree = inner(wrapper.props); }
    return tree;
  }
  function visit(node, predicate, found) {
    if (Array.isArray(node)) { for (const item of node) visit(item, predicate, found); return; }
    if (!node || typeof node !== 'object') return;
    if (predicate(node)) found.push(node);
    visit(node.props?.children, predicate, found);
  }
  const nodes = predicate => { const result = []; visit(tree, predicate, result); return result; };
  function textOf(node) {
    if (Array.isArray(node)) return node.map(textOf).join(' ');
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    return textOf(node.props?.children);
  }
  const button = () => { const result = nodes(node => node.type === 'button'); assert.equal(result.length, 1); return result[0]; };
  function reconnect() { cleanup(); for (const effect of effects) if (effect) effect.pending = true; render(); }
  function poison() { const reads = []; return { reads, value: new Proxy({}, { get(_, name) { if (name === 'then') return undefined; reads.push(String(name)); throw Error('obsolete property access'); } }) }; }
  render();
  return { render, button, requests, cleanup, reconnect, nodes, poison, text: () => textOf(tree),
    snapshot: () => ({ writes, requests: requests.length }),
    click() { button().props.onClick(); },
    async respond(payload = { data: populated() }, ok = true) { requests.at(-1).gate.resolve({ ok, json: async () => payload }); await tick(); render(); },
    async jsonStage() { const gate = deferred(); requests.at(-1).gate.resolve({ ok: true, json: () => gate.promise }); await tick(); return gate; }
  };
}
function assertPending(h) {
  assert.equal(h.button().props.disabled, true); assert.match(h.text(), /טוען/);
  assert.doesNotMatch(h.text(), /עדיין אין לקוחות|לא הוגדר|ללא מיתוג|hint-A|Product A|partner-active|brand-pending/);
  for (const node of h.nodes(node => node.type === 'article')) assert.match(node.props.children.map(child => child?.type === 'strong' ? child.props.children : '').join(''), /טוען/);
}
function assertUnavailable(h) {
  assert.equal(h.button().props.disabled, false); assert.match(h.text(), /אינם זמינים/);
  assert.doesNotMatch(h.text(), /עדיין אין לקוחות|לא הוגדר|ללא מיתוג|hint-A|Product A|partner-active|brand-pending/);
  assert.ok(h.nodes(node => node.props?.className === 'do-notice danger').length === 1);
}

test('one initial exact GET, no false healthy-empty state, refresh blocked before render', () => {
  const h = harness(); assertPending(h); assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, '/api/digital-observer/partners?organization_id=org%2Fa%20%26%20b');
  assert.deepEqual(copy(h.requests[0].options), { cache: 'no-store' });
  const before = h.snapshot(); h.click(); h.click(); assert.deepEqual(h.snapshot(), before);
  assert.match(h.text(), /Development\/Sandbox/); assert.match(h.text(), /מפתח שירות ארוך־חיים אינו מגיע לדפדפן/);
});
for (const wrapped of [true, false]) test(`successful ${wrapped ? 'data envelope' : 'direct payload'} preserves row/status/date/brand/count`, async () => {
  const h = harness(), value = populated(); await h.respond(wrapped ? { data: value } : value);
  assert.equal(h.button().props.disabled, false);
  for (const text of ['hint-A', 'customer-active', 'partner-active', 'Brand A', 'Product A', 'brand-pending']) assert.ok(h.text().includes(text));
  assert.ok(h.text().includes(new Date(value.customers[0].created_at).toLocaleString('he-IL')));
  assert.equal(h.nodes(node => node.props?.style?.borderInlineStart === '6px solid #123456').length, 1);
  const counts = h.nodes(node => node.type === 'strong' && node.props.children === 1); assert.equal(counts.length, 2);
});
test('only successful empty response shows healthy empty defaults and zero counts', async () => {
  const h = harness(); await h.respond({ data: empty() });
  assert.match(h.text(), /עדיין אין לקוחות/); assert.match(h.text(), /לא הוגדר/); assert.match(h.text(), /ללא מיתוג/);
  assert.equal(h.nodes(node => node.type === 'strong' && node.props.children === 0).length, 2);
});
test('explicit refresh clears prior snapshot synchronously and duplicates issue once', async () => {
  const h = harness(); await h.respond(); const handler = h.button().props.onClick; handler(); handler();
  assert.equal(h.requests.length, 2); assert.deepEqual(copy(h.requests[1].options), { cache: 'no-store' });
  h.render(); assertPending(h); await h.respond({ data: empty() }); assert.match(h.text(), /עדיין אין לקוחות/);
});
for (const origin of ['initial', 'manual']) for (const failure of ['fetch', 'json', 'http']) test(`${origin} ${failure} visible current failure with explicit usable retry`, async () => {
  const h = harness(); if (origin === 'manual') { await h.respond(); h.click(); }
  if (failure === 'fetch') h.requests.at(-1).gate.reject(Error('offline'));
  else if (failure === 'json') { const gate = await h.jsonStage(); gate.reject(Error('invalid JSON')); }
  else h.requests.at(-1).gate.resolve({ ok: false, json: async () => ({ error: 'Rejected' }) });
  await tick(); h.render(); assertUnavailable(h);
  const count = h.requests.length; h.click(); h.click(); assert.equal(h.requests.length, count + 1);
  h.render(); assertPending(h); await h.respond(); assert.match(h.text(), /hint-A/);
});
for (const origin of ['initial', 'manual']) for (const stage of ['fetch', 'json']) for (const loss of ['unmount', 'organization', 'roundtrip', 'layout', 'new-current-refresh']) for (const rejected of [false, true]) {
  test(`${origin}/${stage}/${loss}/${rejected ? 'reject' : 'resolve'} obsolete completion is inert`, async () => {
    const h = harness(); if (origin === 'manual') { await h.respond(); h.click(); }
    const retained = h.button().props.onClick;
    const gate = stage === 'json' ? await h.jsonStage() : h.requests.at(-1).gate;
    if (loss === 'unmount') h.cleanup();
    else if (loss === 'layout' || loss === 'new-current-refresh') {
      h.reconnect();
      if (loss === 'new-current-refresh') { await h.respond({ data: empty() }); h.click(); h.render(); }
    } else {
      h.render({ organizationId: 'org-b', organizationName: 'Organization B' });
      if (loss === 'roundtrip') h.render(initial);
    }
    if (loss !== 'unmount') assertPending(h);
    const before = h.snapshot(), poison = h.poison();
    if (rejected) gate.reject(poison.value); else gate.resolve(poison.value);
    await tick(); assert.deepEqual(poison.reads, []); assert.deepEqual(h.snapshot(), before);
    if (loss !== 'unmount') {
      h.render(); assertPending(h); h.click(); assert.deepEqual(h.snapshot(), before);
      await h.respond(); assert.match(h.text(), /hint-A/);
    }
    const after = h.snapshot(); retained(); await tick(); assert.deepEqual(h.snapshot(), after);
  });
}
test('same-ID name refresh keeps pending request and latest name without extra load', async () => {
  const h = harness(); h.render({ ...initial, organizationName: 'Updated Name' });
  assert.equal(h.requests.length, 1); assert.match(h.text(), /Updated Name/); assertPending(h);
  await h.respond(); assert.match(h.text(), /Updated Name/); assert.match(h.text(), /hint-A/);
});
test('same-ID settled metadata refresh preserves current data and callback', async () => {
  const h = harness(); await h.respond(); const callback = h.button().props.onClick;
  h.render({ ...initial, organizationName: 'New Name' }); assert.match(h.text(), /New Name/); assert.match(h.text(), /hint-A/);
  assert.equal(h.requests.length, 1); callback(); assert.equal(h.requests.length, 2); h.render(); assertPending(h);
});
test('settled A-B-A never presents old snapshot under new name', async () => {
  const h = harness(); await h.respond();
  h.render({ organizationId: 'org-b', organizationName: 'Organization B' }); assertPending(h); assert.match(h.text(), /Organization B/);
  await h.respond({ data: empty() }); h.render(initial); assertPending(h); assert.equal(h.requests.length, 3);
});
test('layout reconnect issues exactly intended initial load, then refresh becomes usable', async () => {
  const h = harness(); await h.respond(); h.reconnect(); assert.equal(h.requests.length, 2); assertPending(h);
  h.render({ ...initial, organizationName: 'Latest Name' }); assert.equal(h.requests.length, 2);
  await h.respond({ data: empty() }); assert.equal(h.button().props.disabled, false); h.click(); assert.equal(h.requests.length, 3);
});
test('obsolete response status getter never runs after current organization changes', async () => {
  const h = harness(), gate = h.requests[0].gate; h.render({ organizationId: 'org-b', organizationName: 'B' });
  const reads = []; gate.resolve({ get ok() { reads.push('ok'); throw Error('old status'); }, get json() { reads.push('json'); throw Error('old json'); } });
  await tick(); assert.deepEqual(reads, []); assertPending(h); await h.respond(); assert.match(h.text(), /hint-A/);
});
