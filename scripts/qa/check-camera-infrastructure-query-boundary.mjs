import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Only selected pure metadata declarations; whole provider modules stay unevaluated.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(import.meta.url)('typescript');
function read(name) { const p = path.join(root, name); assert.equal(fs.statSync(p).flags & 0x40000000, 0); return fs.readFileSync(p, 'utf8'); }
function compile(source) { const r = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(read('app/dashboard/admin/camera-infrastructure/page.tsx'));
const safeCode = compile(read('lib/admin-safe.ts'));
const inventory = [
  ['camera-status.ts', ['normalizeCameraStatus']],
  ['camera-health.ts', ['getCameraHealthStatus', 'summarizeCameraHealth']],
  ['video-gateway.ts', ['hasPlaybackSource']],
  ['real-camera-infrastructure.ts', ['cameraProviderRegistry', 'inferCameraProvider', 'buildCameraInfrastructureSummary', 'cameraDiagnosticsFor']]
];
const declarations = inventory.flatMap(([file, names]) => {
  const ast = ts.createSourceFile(file, read(`lib/domain/${file}`), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  return names.map(name => { const found = ast.statements.filter(n => ts.isFunctionDeclaration(n) ? n.name?.text === name : ts.isVariableStatement(n) && n.declarationList.declarations.length === 1 && n.declarationList.declarations[0].name.getText(ast) === name); assert.equal(found.length, 1, name); return found[0].getText(ast); });
});
assert.equal(declarations.length, 8);
const pureCode = compile(declarations.join('\n'));
const normalize = v => JSON.parse(JSON.stringify(v));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function nodes(v, predicate) { if (!v || typeof v !== 'object') return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, predicate)); return [...(predicate(v) ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, predicate))]; }
function text(v) { if (v == null || typeof v === 'boolean' || typeof v === 'function') return ''; if (typeof v !== 'object') return String(v); return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children); }
const sources = ['camera_streams', 'camera_stream_validations', 'camera_health_history', 'camera_recording_readiness', 'camera_storage_readiness', 'camera_playback_sessions', 'camera_provider_registry', 'camera_gateway_deployments', 'camera_deployment_test_sites'];
const columns = 'id,garden_id,kindergarten_id,observer_site_id,name,area,camera_type,source_type,system_type,deployment_scope,test_site_type,camera_provider_key,gateway_provider_preference,live_preview_status,clip_readiness_status,snapshot_readiness_status,permission_model,stream_status,health_status,last_seen,connection_method,protocol,status,active,parent_view_allowed,parent_viewing_allowed,last_health_check_at,last_test_status,last_test_message,last_test_at,gateway_registration_status,gateway_last_error,masked_connection_summary,video_gateway_stream_id,gateway_stream_id,gateway_provider,gateway_source_id,gateway_playback_id,gateway_registered_at,gateway_latency_ms,gateway_stream_count,gateway_failed_stream_count,viewing_hours,recording_enabled,retention_days,archive_policy,recording_status,recording_retention_days,recording_storage_location,storage_provider,storage_mode,estimated_daily_storage_mb,recording_storage_used_mb,playback_hls_ready,playback_webrtc_ready,created_at,updated_at';
const chains = [
  [['select', columns], ['order', 'created_at', { ascending: false }], ['limit', 300]],
  ...['created_at', 'checked_at', 'updated_at', 'updated_at', 'started_at'].map(field => [['select', '*'], ['order', field, { ascending: false }], ['limit', 200]]),
  [['select', '*'], ['order', 'provider_name']], [['select', '*'], ['order', 'provider']], [['select', '*'], ['order', 'site_key']]
];
function fixture() { return [
  [{ id: 'C1', name: 'SYNTHETIC_CAMERA1', area: '', system_type: 'hikvision', stream_status: 'connected', health_status: 'healthy', recording_enabled: true, retention_days: 0, recording_retention_days: 7, recording_storage_location: 'SYNTHETIC_STORAGE_METADATA', playback_hls_ready: true, gateway_stream_id: 'SYNTHETIC_STREAM_METADATA', gateway_latency_ms: 0, gateway_registration_status: '' }, { id: 'C2', name: 'SYNTHETIC_CAMERA2', system_type: 'dahua', status: 'offline', health_status: 'failed', playback_webrtc_ready: true, recording_enabled: true, retention_days: 0 }],
  [{ id: 'V1', status: 'failed' }], [{ id: 'H1', status: 'SYNTHETIC_HISTORY' }], [{ id: 'R1', status: 'SYNTHETIC_RECORDING' }], [{ id: 'S1', status: 'SYNTHETIC_STORAGE' }], [{ id: 'P1', status: 'SYNTHETIC_SESSION' }],
  [{ provider_key: 'hikvision', provider_name: 'SYNTHETIC_PROVIDER', capabilities: { synthetic_true: true, synthetic_false: false, synthetic_null: null } }],
  [{ provider: 'SYNTHETIC_GATEWAY', environment: 'SYNTHETIC_DEVELOPMENT', status: '', health_status: '', active_streams: 0, failed_streams: null }],
  [{ site_key: 'SYNTHETIC_SITE', display_name: 'SYNTHETIC_TEST_SITE', site_type: '', isolated_from_kindergarten_data: true }]
]; }
function unavailable(mode) { return mode.startsWith('error-') || ['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(mode); }
function health(camera) { const operational = camera.active === false ? 'disabled' : String(camera.stream_status ?? camera.status ?? 'pending').trim().toLowerCase(); const h = String(camera.health_status ?? '').toLowerCase(); if (operational === 'disabled') return 'disabled'; if (['connected', 'online'].includes(operational) && ['healthy', 'ok', 'connected', ''].includes(h)) return 'online'; if (['connected', 'online'].includes(operational) && ['warning', 'degraded'].includes(h)) return 'warning'; if (!['connected', 'online', 'offline', 'failed', 'error', 'disabled'].includes(operational)) return 'pending'; return 'offline'; }
async function render({ modes = {}, data = fixture(), outer = false, denied = false } = {}) {
  let clients = 0, summaryCalls = 0, diagnosticCalls = 0, configurationCalls = 0, effects = 0;
  const queries = [], logs = [], summaryArgs = [];
  const no = () => { effects++; throw Error('UNEXPECTED_EFFECT'); };
  const context = { fetch: no, FormData: no, console: { warn: (...a) => logs.push(a), error: no }, process: new Proxy({}, { get: no }) };
  const safe = {}, pure = {}, exported = {};
  vm.runInNewContext(safeCode, { ...context, exports: safe, require: no });
  vm.runInNewContext(pureCode, { ...context, exports: pure, require: no, isGatewayConfigured: () => { configurationCalls++; return false; } });
  const client = { from(table) { const index = sources.indexOf(table); assert.ok(index >= 0); const mode = modes[index] ?? 'healthy', calls = []; queries.push({ table, mode, calls }); if (mode === 'factory') throw Error('PRIVATE_FACTORY'); const query = {};
    for (const method of ['select', 'order', 'limit']) query[method] = (...args) => { if (mode === 'chain' && method === 'select') throw Error('PRIVATE_CHAIN'); calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => { if (mode.startsWith('reject')) return Promise.reject(mode === 'reject-null' ? null : mode === 'reject-false' ? false : Error('PRIVATE_REJECT')).then(resolve, reject); const response = { error: mode.startsWith('error-') ? { message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS' } : null }; Object.defineProperty(response, 'data', { get: () => mode === 'error-poison' ? no() : mode.endsWith('empty') || mode === 'empty' ? [] : mode.endsWith('null') || mode === 'null' ? null : data[index] }); return Promise.resolve(response).then(resolve, reject); };
    return query;
  } };
  vm.runInNewContext(pageCode, { ...context, exports: exported, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + summaryCalls + diagnosticCalls + configurationCalls + effects + queries.length + logs.length, 0); if (denied) throw Error('DENIED'); } };
    if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
    if (id === '@/lib/domain/real-camera-infrastructure') return { cameraProviderRegistry: pure.cameraProviderRegistry, buildCameraInfrastructureSummary: (...args) => { summaryCalls++; summaryArgs.push(args.map(a => a.length)); return pure.buildCameraInfrastructureSummary(...args); }, cameraDiagnosticsFor: camera => { diagnosticCalls++; assert.ok(String(camera.id).startsWith('C')); return pure.cameraDiagnosticsFor(camera); } };
    if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
    if (id === '@/components/stat-card') return { StatCard: 'StatCard' };
    if (id === '@/components/admin-data-state') return { AdminDataError: 'AdminDataError' };
    if (id === 'next/link') return { default: 'Link' };
    if (id === 'lucide-react') return Object.fromEntries(['Camera', 'Database', 'HardDrive', 'RadioTower', 'ShieldCheck', 'Video'].map(x => [x, x]));
    return no();
  } });
  let tree; try { tree = await exported.default(); } catch (e) { assert.ok(denied); assert.equal(e.message, 'DENIED'); }
  if (denied) { assert.equal(tree, undefined); assert.equal(clients + summaryCalls + diagnosticCalls + configurationCalls + effects + queries.length + logs.length, 0); return; }
  assert.equal(clients, 1); assert.equal(effects, 0); assert.deepEqual(queries.map(q => q.table), outer ? [] : sources);
  for (const q of queries) if (!['factory', 'chain'].includes(q.mode)) assert.deepEqual(normalize(q.calls), chains[sources.indexOf(q.table)]);
  const available = sources.map((_, i) => !outer && !unavailable(modes[i] ?? 'healthy'));
  const rows = sources.map((_, i) => available[i] && !['empty', 'null'].includes(modes[i]) ? data[i] ?? [] : []), camera = rows[0];
  assert.equal(summaryCalls, outer ? 1 : 2); assert.equal(diagnosticCalls, Math.min(camera.length, 24)); assert.equal(configurationCalls, summaryCalls + diagnosticCalls);
  assert.deepEqual(normalize(summaryArgs), outer ? [[0]] : [[0], [camera.length, rows[1].length, rows[5].length]]);
  const expected = [camera.length, camera.filter(c => health(c) === 'online').length, camera.filter(c => health(c) === 'offline').length, camera.filter(c => health(c) === 'warning' || String(c.health_status ?? '').toLowerCase() === 'degraded').length, camera.filter(c => c.hls_playback_url || c.sample_hls_url || c.playback_hls_ready).length, camera.filter(c => c.webrtc_playback_url || c.playback_webrtc_ready).length, camera.filter(c => c.recording_enabled && (c.retention_days || c.recording_retention_days)).length, camera.filter(c => c.storage_location || c.recording_storage_location || c.storage_provider).length];
  const metrics = nodes(tree, n => n.type === 'StatCard'); assert.equal(metrics.length, 8); assert.deepEqual(metrics.map(m => m.props.value), available[0] ? expected : Array(8).fill('לא זמין'));
  if (!available[0]) metrics.forEach(m => assert.equal(m.props.tone, 'warn'));
  const all = text(tree); assert.ok(!JSON.stringify(tree).includes('PRIVATE_')); assert.ok(all.includes('Gateway pending') && !all.includes('Gateway configured'));
  assert.equal(Boolean(nodes(tree, n => n.type === 'AdminDataError')[0].props.message), available.some(x => !x));
  const articles = nodes(tree, n => n.type === 'article' && n.props.className === 'card action-panel'); assert.equal(articles.length, 4);
  const providerRows = nodes(articles[0], n => n.type === 'div' && n.props.className === 'mini-row');
  const providers = rows[6].length ? rows[6] : Object.entries(pure.cameraProviderRegistry).map(([provider_key, p]) => ({ provider_key, provider_name: p.name, capabilities: p.capabilities }));
  assert.deepEqual(providerRows.map(p => p.key), available[6] ? providers.map(p => p.provider_key) : []);
  if (!available[6]) assert.ok(text(articles[0]).includes('נתוני ספקי המצלמות אינם זמינים'));
  if (!available[0]) providerRows.forEach(row => assert.equal(text(nodes(row, n => n.type === 'strong')[0]), 'לא זמין מצלמות'));
  else providerRows.forEach((row, i) => { const key = providers[i].provider_key; const count = camera.filter(c => { const s = `${c.provider_key ?? ''} ${c.system_type ?? ''} ${c.camera_type ?? ''} ${c.source_type ?? ''} ${c.rtsp_template ?? ''}`.toLowerCase(); return ['hikvision', 'dahua', 'uniview', 'axis', 'nvr', 'dvr'].find(x => s.includes(x)) === key || key === 'generic_rtsp' && !['hikvision', 'dahua', 'uniview', 'axis', 'nvr', 'dvr'].some(x => s.includes(x)); }).length; assert.equal(text(nodes(row, n => n.type === 'strong')[0]), `${count} מצלמות`); });
  const ratios = nodes(articles[1], n => n.type === 'b').slice(0, 4); assert.deepEqual(ratios.map(text), available[0] ? [expected[4], expected[5], expected[6], expected[7]].map(n => `${n}/${camera.length}`) : Array(4).fill('לא זמין'));
  for (const [index, article, unknown, empty] of [[7, articles[2], 'נתוני ה-Gateway אינם זמינים', 'אין רשומות Gateway עדיין'], [8, articles[3], 'נתוני אתרי הבדיקה אינם זמינים', 'אין אתרי בדיקה עדיין']]) {
    const cards = nodes(article, n => n.type === 'div' && n.props.className === 'mini-row'); assert.equal(cards.length, rows[index].length);
    if (!available[index]) { assert.ok(text(article).includes(unknown)); assert.ok(!text(article).includes(empty)); } else if (!rows[index].length) assert.ok(text(article).includes(empty));
  }
  const diagnosticsRows = nodes(tree, n => n.type === 'article' && n.props.className === 'card procedure-card'); assert.deepEqual(diagnosticsRows.map(n => n.key), camera.slice(0, 24).map(c => c.id));
  if (!available[0]) assert.ok(all.includes('נתוני אבחון המצלמות אינם זמינים') && !all.includes('אין מצלמות להצגה') && !all.includes('SYNTHETIC_CAMERA'));
  else if (!camera.length) assert.ok(all.includes('אין מצלמות להצגה'));
  assert.ok(logs.every(args => !JSON.stringify(args).includes('PRIVATE_'))); if (available.every(Boolean)) assert.equal(logs.length, 0); else assert.ok(logs.length > 0);
  return { tree, all, metrics, providerRows, diagnosticsRows, diagnosticCalls };
}
const cases = [];
function add(id, run) { cases.push({ id, run }); }
for (let source = 0; source < 9; source++) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) add(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
for (const mode of ['healthy', 'empty', 'null']) add(`all-known-${mode}`, () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, mode])) }));
add('denied-before-all-effects', () => render({ denied: true })); add('outer-client-failure', () => render({ outer: true }));
for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) add(`independent-pair-${a}-${b}`, () => render({ modes: { [a]: 'error-poison', [b]: 'reject-null' } }));
add('all-unknown', () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, 'error-poison'])) }));
add('healthy-empty-provider-seven-static-metadata-only', async () => { const r = await render({ modes: { 6: 'empty' } }); assert.equal(r.providerRows.length, 7); });
add('failed-cameras-static-provider-counts-unknown', async () => { const r = await render({ modes: { 0: 'error-poison', 6: 'empty' } }); assert.equal(r.providerRows.length, 7); assert.equal(r.diagnosticCalls, 0); });
for (const status of ['connected', 'online', 'offline', 'failed', 'disabled', 'connecting', 'error', '', null]) add(`camera-status-${String(status)}`, () => { const data = fixture(); data[0][0].stream_status = status; return render({ data }); });
for (const flag of [true, false, null, 0, 'false']) add(`readiness-truthy-${typeof flag}-${String(flag)}`, () => { const data = fixture(); data[0][0].recording_enabled = flag; data[0][0].playback_hls_ready = flag; data[0][0].playback_webrtc_ready = flag; data[0][0].storage_provider = flag; return render({ data }); });
for (const retention of [0, null, 7, '0']) add(`retention-nullish-or-${typeof retention}-${String(retention)}`, () => { const data = fixture(); data[0][0].retention_days = retention; return render({ data }); });
add('diagnostic-cap-24-source-cap-300-not-additional-clamp', () => { const data = fixture(); data[0] = Array.from({ length: 301 }, (_, i) => ({ ...data[0][0], id: `C${i % 2}` })); return render({ data }); });
add('unused-failures-do-not-mute-camera-metrics', () => render({ modes: { 1: 'error-poison', 2: 'error-poison', 3: 'error-poison', 4: 'error-poison', 5: 'error-poison' } }));
add('one-portable-domain-hook', () => { const config = JSON.parse(read('config/digital-observer-ci-gates.json')); assert.deepEqual(config.domain.filter(x => x.name === 'camera-infrastructure-query-boundary'), [{ name: 'camera-infrastructure-query-boundary', args: ['--test', 'scripts/qa/check-camera-infrastructure-query-boundary.mjs'] }]); });
const registry = cases.map(c => c.id); assert.equal(new Set(registry).size, registry.length); console.log('CASE_REGISTRY ' + JSON.stringify(registry));
for (const c of cases) test(c.id, c.run);
