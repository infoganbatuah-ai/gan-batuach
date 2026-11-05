import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Read source text, select exactly ten PURE declarations; never import runtime modules.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/camera-audit/page.tsx', import.meta.url));
const inventory = [['parent-camera-access', ['getCameraGardenId']], ['camera-status', ['normalizeCameraStatus']], ['camera-health', ['getCameraHealthStatus', 'summarizeCameraHealth']], ['video-gateway', ['normalizeCameraSourceType', 'hasPlaybackSource']], ['camera-diagnostics', ['isDemoCamera', 'parentViewingEnabled', 'buildCameraAuditSummary', 'describeCameraReadiness']]];
const declarations = [];
for (const [file, names] of inventory) {
  const input = read(new URL(`../../lib/domain/${file}.ts`, import.meta.url)), root = ts.createSourceFile(`${file}.ts`, input, ts.ScriptTarget.Latest, true), selected = root.statements.filter(node => ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text));
  assert.deepEqual(selected.map(node => node.name.text), names); declarations.push(...selected.map(node => node.getText(root)));
}
assert.equal(declarations.length, 10);
function compile(value) { const r = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url))), pureCode = compile(declarations.join('\n'));
const jsx = (type, props, key) => ({type, props: props ?? {}, key});
const plain = value => JSON.parse(JSON.stringify(value));
function nodes(v, type) { if (!v || typeof v !== 'object') return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === 'boolean' || typeof v === 'function') return ''; if (typeof v !== 'object') return String(v); return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children); }
const camera = (x = {}) => ({id: 'SYNTHETIC_CAMERA', garden_id: 'SYNTHETIC_GARDEN', name: 'SYNTHETIC_CAMERA_NAME', area: 'SYNTHETIC_AREA', gardens: {name: 'SYNTHETIC_GARDEN_NAME'}, source_type: 'HLS', status: 'connected', active: true, parent_view_allowed: true, gateway_stream_id: 'SYNTHETIC_GATEWAY', last_seen: '2026-01-01T12:00:00Z', failure_count: 0, reconnect_attempts: 0, recording_enabled: false, ...x});
const columns = 'id, garden_id, kindergarten_id, name, area, source_type, camera_type, protocol, status, stream_status, health_status, active, parent_view_allowed, parent_viewing_allowed, live_preview_status, playback_hls_ready, playback_webrtc_ready, gateway_stream_id, video_gateway_stream_id, last_seen, last_successful_connection_at, last_stream_activity_at, failure_count, reconnect_attempts, recording_enabled, retention_days, archive_policy, is_demo, demo_batch_id, gardens(name, city)';
const labels = ['סה״כ מצלמות', 'פעילות', 'אופליין / שגיאה', 'דמו', 'חסר מקור צפייה', 'בעיית הרשאה', 'ללא שיוך גן', 'מוכנות'];
async function render(mode = 'healthy', rows = [camera()]) {
  let clients = 0, queries = 0, admissions = 0, effects = 0, readinessCalls = 0;
  const calls = [], logs = [], summaryInputLengths = [], deny = () => { effects++; throw Error('UNEXPECTED_RUNTIME_OR_STALE_DATE'); };
  class ReadonlyDate extends Date { constructor(value) { if (value === 'INVALID_DATE') deny(); super(value); } }
  function load(code, require) { const exports = {}; vm.runInNewContext(code, {exports, require, process: {env: {}}, Date: ReadonlyDate, fetch: deny, FormData: deny, console: {warn: (...args) => logs.push(args)}}); return exports; }
  const pure = load(pureCode, deny), helper = load(helperCode, deny);
  const domain = {buildCameraAuditSummary: input => { summaryInputLengths.push(input.length); return pure.buildCameraAuditSummary(input); }, describeCameraReadiness: input => { readinessCalls++; return pure.describeCameraReadiness(input); }};
  const client = {from(table) { queries++; calls.push(['from', table]); if (mode === 'factory') throw Error('PRIVATE_FACTORY'); const q = {}; for (const method of ['select', 'limit']) q[method] = (...args) => { calls.push([method, ...args]); if (mode === 'chain') throw Error('PRIVATE_CHAIN'); return q; }; q.then = (resolve, reject) => (mode === 'reject' ? Promise.reject(Error('PRIVATE_REJECT')) : mode === 'reject-null' ? Promise.reject(null) : mode === 'reject-false' ? Promise.reject(false) : Promise.resolve({data: ['empty', 'error-empty'].includes(mode) ? [] : ['null', 'error-null'].includes(mode) ? null : rows, error: mode.startsWith('error-') ? {message: 'PRIVATE_DIAGNOSTIC', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT'} : null})).then(resolve, reject); return q; }};
  const page = load(pageCode, id => {
    if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx};
    if (id === 'next/link') return {__esModule: true, default: 'Link'};
    if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'};
    if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'};
    if (id === '@/lib/admin-safe') return helper;
    if (id === '@/lib/domain/camera-diagnostics') return domain;
    if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (mode === 'denied') throw Error('DENIED'); }};
    if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (mode === 'loader') throw Error('PRIVATE_CLIENT'); return client; }};
    return deny();
  });
  if (mode === 'denied') { await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.equal(queries, 0); assert.deepEqual(logs, []); assert.deepEqual(summaryInputLengths, []); assert.equal(readinessCalls, 0); assert.equal(effects, 0); return null; }
  const tree = await page.default(), body = text(tree), metrics = nodes(tree, 'article').filter(n => n.props.className === 'card metric-card'), cards = nodes(tree, 'article').filter(n => n.props.className === 'card procedure-card');
  assert.equal(clients, 1); assert.equal(queries, mode === 'loader' ? 0 : 1); if (!['factory', 'chain', 'loader'].includes(mode)) assert.deepEqual(plain(calls), [['from', 'camera_streams'], ['select', columns], ['limit', 500]]);
  assert.equal(nodes(tree, 'DashboardShell')[0].props.role, 'admin'); assert.equal(nodes(tree, 'DashboardShell')[0].props.title, 'Camera Audit');
  assert.ok(body.includes('Video Gateway readiness')); assert.ok(body.includes('אודיט תשתית מצלמות.')); assert.ok(body.includes('בדיקה ייעודית לאדמין: מלאי מצלמות, בריאות, מקורות צפייה, הרשאות הורים ומוכנות ל-Video Gateway עתידי.')); assert.ok(body.includes('האבחון הזה מיועד לאדמין בלבד. הורים לא רואים מזהים, מקורות, Gateway או נתוני RLS.')); assert.equal(nodes(tree, 'Link').length, 1); assert.equal(nodes(tree, 'Link')[0].props.href, '/dashboard/admin/cameras');
  assert.equal(metrics.length, 8); assert.deepEqual(metrics.map(n => text(nodes(n, 'span')[0])), labels);
  const unknown = !['healthy', 'empty', 'null'].includes(mode); assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), unknown); assert.ok(!JSON.stringify(tree).includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
  const values = metrics.map(n => text(nodes(n, 'strong')[0]));
  if (unknown) { assert.deepEqual(values, Array(8).fill('לא זמין')); assert.equal(cards.length, 0); assert.equal(readinessCalls, 0); assert.ok(summaryInputLengths.every(n => n === 0)); assert.ok(body.includes('נתוני אודיט המצלמות אינם זמינים')); assert.ok(!body.includes('אין מצלמות לאודיט')); assert.ok(!body.includes('SYNTHETIC_')); assert.equal(logs.length, 1); assert.equal(logs[0][1], mode.startsWith('error-') ? 'camera audit camera_streams' : 'camera audit'); }
  else {
    const expected = ['empty', 'null'].includes(mode) ? [] : rows, summary = pure.buildCameraAuditSummary(expected); assert.equal(cards.length, expected.length); assert.equal(readinessCalls, expected.length); assert.deepEqual(logs, []);
    assert.deepEqual(values, [summary.total, summary.online, summary.offline, summary.demo, summary.missingPlaybackSource, summary.permissionIssues, summary.orphan, summary.productionReady ? 'תקין' : 'לטיפול'].map(String));
    if (!expected.length) { assert.ok(body.includes('אין מצלמות לאודיט')); assert.ok(body.includes('כאשר גנים יוסיפו מצלמות, תופיע כאן תמונת מוכנות מלאה.')); }
    for (const [i, row] of expected.entries()) {
      const ready = pure.describeCameraReadiness(row), card = cards[i], badges = nodes(card, 'span'); assert.equal(card.key, row.id);
      assert.equal(text(badges[0]), ready.healthStatus); assert.equal(badges[0].props.className, ready.healthStatus === 'online' ? 'pill good' : ready.healthStatus === 'offline' ? 'pill bad' : 'pill warn');
      assert.equal(text(nodes(card, 'h3')[0]), `${row.name ?? 'מצלמה'} · ${row.gardens?.name ?? 'גן לא משויך'}`); assert.equal(text(nodes(card, 'p')[0]), `${row.area ?? 'אזור לא הוגדר'} · ${ready.sourceType} · ${ready.parentViewing ? 'צפיית הורים פעילה' : 'צפיית הורים כבויה'}`);
      assert.equal(text(nodes(card, 'small')[0]), `Last seen: ${row.last_seen ? new Date(row.last_seen).toLocaleString('he-IL') : 'טרם'} · Failures: ${row.failure_count ?? 0} · Reconnects: ${row.reconnect_attempts ?? 0}`);
      assert.equal(badges[1].props.className, ready.playbackReady ? 'pill good' : 'pill warn'); assert.equal(text(badges[1]), ready.playbackReady ? 'מקור צפייה קיים' : 'חסר מקור צפייה'); assert.equal(text(badges[2]), row.recording_enabled ? `הקלטה עתידית ${row.retention_days ?? '-'} ימים` : 'ללא הקלטה'); assert.ok(text(card).includes(ready.issues.length ? ready.issues.join(' · ') : 'אין ממצא קריטי'));
    }
  }
  assert.equal(nodes(tree, 'button').length, 0); assert.equal(nodes(tree, 'form').length, 0); assert.equal(effects, 0); return {tree, cards, values};
}
for (const mode of ['healthy', 'empty', 'null', 'error-stale', 'error-empty', 'error-null', 'reject', 'factory', 'chain', 'reject-null', 'reject-false', 'loader', 'denied']) test(`actual page/pure domain ${mode}`, () => render(mode));
for (const status of ['connected', 'online', 'connecting', 'pending', 'offline', 'failed', 'error', 'disabled', ' CONNECTED ']) test(`unchanged normalized health ${status}`, () => render('healthy', [camera({status})]));
for (const source_type of ['HLS', 'webrtc', 'ONVIF', 'DVR', 'NVR', 'Sample HLS', 'unknown', '']) test(`unchanged pure source label ${source_type}`, () => render('healthy', [camera({source_type})]));
for (const value of [true, false, null, 0, 1, 'true']) test(`strict parent metadata flags ${typeof value}:${String(value)}`, () => render('healthy', [camera({parent_view_allowed: value, parent_viewing_allowed: value})]));
for (const value of [true, false, null, 0, 'false']) test(`recording truthiness ${typeof value}:${String(value)}`, () => render('healthy', [camera({recording_enabled: value, retention_days: 0})]));
for (const value of [undefined, null, '', 0]) test(`nullish labels and counters ${String(value)}`, () => render('healthy', [camera({name: value, area: value, gardens: {name: value}, failure_count: value, reconnect_attempts: value})]));
for (const last_seen of [undefined, null, '']) test(`known missing timestamp ${String(last_seen)}`, () => render('healthy', [camera({last_seen})]));
test('mixed offline/orphan/demo/disabled metadata retains summary and issues', async () => { const r = await render('healthy', [camera(), camera({id: 'OFFLINE', status: 'offline', garden_id: null, gateway_stream_id: null}), camera({id: 'DEMO', name: '[DEMO] SYNTHETIC', active: false, parent_view_allowed: false})]); assert.deepEqual(r.values, ['3', '1', '1', '1', '1', '1', '1', 'לטיפול']); });
test('failed stale invalid timestamp never formatted', () => render('error-stale', [camera({last_seen: 'INVALID_DATE'})]));
test('failed poisoned array never read by mapping, summary or formatter', () => render('error-stale', new Proxy([], {get() { throw Error('STALE_ARRAY_READ_FORBIDDEN'); }})));
test('ready flags without a source do not replace original hasPlaybackSource', () => render('healthy', [camera({gateway_stream_id: null, playback_hls_ready: true, playback_webrtc_ready: true})]));
test('raw 501 rows, duplicate keys/server order not locally clamped', async () => { const rows = Array.from({length: 501}, (_, i) => camera({id: 'SYNTHETIC_DUP', name: `SYNTHETIC_ORDER_${500-i}`})); const r = await render('healthy', rows); assert.equal(r.cards.length, 501); assert.deepEqual(r.cards.map(n => text(nodes(n, 'h3')[0])), rows.map(row => `${row.name} · SYNTHETIC_GARDEN_NAME`)); });
test('exact ten pure declarations and one portable hook', () => { assert.equal(declarations.length, 10); assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData(')); const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url))); assert.deepEqual(config.domain.filter(x => x.name === 'camera-audit-query-boundary'), [{name: 'camera-audit-query-boundary', args: ['--test', 'scripts/qa/check-camera-audit-query-boundary.mjs']}]); });
