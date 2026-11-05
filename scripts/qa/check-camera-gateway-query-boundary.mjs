import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Synthetic readonly presentation proof, never a real Gateway health request.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ts = createRequire(import.meta.url)('typescript');
function read(name) { const p = path.join(root, name); assert.equal(fs.statSync(p).flags & 0x40000000, 0); return fs.readFileSync(p, 'utf8'); }
function compile(source) { const r = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(read('app/dashboard/admin/camera-gateway/page.tsx'));
const safeCode = compile(read('lib/admin-safe.ts'));
const normalize = v => JSON.parse(JSON.stringify(v));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function nodes(v, predicate) {
  if (!v || typeof v !== 'object') return [];
  if (Array.isArray(v)) return v.flatMap(x => nodes(x, predicate));
  return [...(predicate(v) ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, predicate))];
}
function text(v) {
  if (v == null || typeof v === 'boolean' || typeof v === 'function') return '';
  if (typeof v !== 'object') return String(v);
  return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children);
}
const sources = ['camera_gateway_configs', 'camera_streams', 'home_camera_test_sites', 'camera_deployment_readiness_checks', 'camera_stream_validations', 'camera_playback_sessions'];
const chains = [
  [['select', '*'], ['order', 'provider']],
  [['select', 'id, garden_id, kindergarten_id, name, area, source_type, source_category, system_type, brand, status, stream_status, health_status, gateway_provider, gateway_registration_status, gateway_latency_ms, gateway_failed_stream_count, last_test_at, last_test_status, last_health_check_at, parent_viewing_allowed, recording_enabled, observer_enabled, observer_shadow_mode, audio_disabled, face_recognition_disabled, deployment_scope, test_site_type, gardens(name)'], ['order', 'created_at', { ascending: false }], ['limit', 300]],
  [['select', '*'], ['order', 'created_at', { ascending: false }], ['limit', 20]],
  [['select', '*'], ['order', 'category'], ['order', 'score', { ascending: false }]],
  [['select', 'id, provider_key, status, message, latency_ms, candidates_tried_count, created_at, camera_streams(name)'], ['order', 'created_at', { ascending: false }], ['limit', 12]],
  [['select', 'id, camera_id, gateway_provider, compliance_status, started_at, ended_at, camera_streams(name), profiles(full_name)'], ['order', 'started_at', { ascending: false }], ['limit', 12]]
];
function fixture() {
  return [
    [{ id: 'G1', provider: 'SYNTHETIC_CONFIG', status: 'active', health_status: '', notes: '', last_heartbeat_at: null }],
    [{ id: 'C1', name: 'SYNTHETIC_CAMERA1', status: 'connected', gateway_registration_status: 'registered', deployment_scope: 'home_test', recording_enabled: true, observer_enabled: false, observer_shadow_mode: true, audio_disabled: true, face_recognition_disabled: true, source_category: '', last_test_at: null }, { id: 'C2', name: 'SYNTHETIC_CAMERA2', gateway_registration_status: 'failed', health_status: 'healthy', recording_enabled: false, observer_enabled: true, audio_disabled: false, face_recognition_disabled: true, gardens: { name: '' } }, { id: 'C3', name: 'SYNTHETIC_CAMERA3', gateway_registration_status: null, health_status: 'no_signal', test_site_type: 'home_test' }],
    [{ id: 'H1', display_name: 'SYNTHETIC_HOME', location_label: '', connection_type: 'SYNTHETIC_CONNECTION', status: 'pending', isolation_status: 'isolated', camera_count: 2, observer_shadow_mode: false }],
    ['gateway', 'home_test', 'playback', 'health', 'SYNTHETIC_UNRELATED'].map((category, i) => ({ id: `R${i}`, category, title: `SYNTHETIC_CHECK_${i}`, evidence_summary: 'SYNTHETIC_EVIDENCE', status: 'partial', score: i ? null : 0 })),
    [{ id: 'V1', provider_key: 'SYNTHETIC_VALIDATION', camera_streams: { name: '' }, message: '', latency_ms: 0, candidates_tried_count: null, status: 'success' }],
    [{ id: 'S1', camera_streams: { name: 'SYNTHETIC_SESSION_NEVER_RENDERED' } }]
  ];
}
function unavailable(mode) { return mode.startsWith('error-') || ['reject', 'reject-null', 'reject-false', 'factory', 'chain'].includes(mode); }
async function render({ modes = {}, data = fixture(), streamCount = null, outer = false, denied = false, healthReject = false, requiredEnv = ['SYNTHETIC_ENV_NAME'] } = {}) {
  let clients = 0, healthCalls = 0, diagnosticCalls = 0, providerCalls = 0, effects = 0;
  const queries = [], diagnostics = [], dateInputs = [];
  const no = () => { effects++; throw Error('UNEXPECTED_EFFECT'); };
  const context = { fetch: no, FormData: no, console: { warn: (...a) => diagnostics.push(a), error: no }, process: new Proxy({}, { get: no }) };
  class SafeDate extends Date { constructor(...a) { dateInputs.push(a[0]); assert.notEqual(a[0], 'INVALID_DATE'); super(...a); } }
  const safe = {}, exported = {};
  vm.runInNewContext(safeCode, { ...context, exports: safe, require: no });
  const client = { from(table) {
    const index = sources.indexOf(table); assert.ok(index >= 0);
    const mode = modes[index] ?? 'healthy', calls = [];
    queries.push({ table, mode, calls });
    if (mode === 'factory') throw Error('PRIVATE_FACTORY');
    const query = {};
    for (const method of ['select', 'order', 'limit']) query[method] = (...args) => { if (mode === 'chain' && method === 'select') throw Error('PRIVATE_CHAIN'); calls.push([method, ...args]); return query; };
    query.then = (resolve, reject) => {
      if (mode.startsWith('reject')) return Promise.reject(mode === 'reject-null' ? null : mode === 'reject-false' ? false : Error('PRIVATE_REJECT')).then(resolve, reject);
      const response = { error: mode.startsWith('error-') ? { message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS', hint: 'PRIVATE_HINT' } : null };
      Object.defineProperty(response, 'data', { get: () => mode === 'error-poison' ? no() : mode.endsWith('empty') || mode === 'empty' ? [] : mode.endsWith('null') || mode === 'null' ? null : data[index] });
      return Promise.resolve(response).then(resolve, reject);
    };
    return query;
  } };
  vm.runInNewContext(pageCode, { ...context, Date: SafeDate, exports: exported, require: id => {
    if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
    if (id === '@/lib/admin-safe') return safe;
    if (id === '@/lib/auth') return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ['admin']); assert.equal(clients + healthCalls + diagnosticCalls + providerCalls + queries.length + diagnostics.length + effects, 0); if (denied) throw Error('DENIED'); } };
    if (id === '@/lib/supabase/server') return { createClient: async () => { clients++; if (outer) throw Error('PRIVATE_CLIENT'); return client; } };
    if (id === '@/lib/domain/camera-gateway') return {
      checkGatewayHealth: () => { healthCalls++; return healthReject ? Promise.reject(Error('PRIVATE_HEALTH')) : Promise.resolve({ configured: false, status: 'not_configured', message: 'SYNTHETIC_DISABLED_HEALTH', streamCount }); },
      getGatewayDiagnostics: () => { diagnosticCalls++; return { configured: false, provider: 'SYNTHETIC_DIAGNOSTICS', ...(requiredEnv === undefined ? {} : { requiredEnv }) }; },
      getGatewayProvider: () => { providerCalls++; return 'SYNTHETIC_DISABLED_PROVIDER'; }
    };
    if (id === '@/components/dashboard-shell') return { DashboardShell: 'DashboardShell' };
    if (id === '@/components/admin-data-state') return { AdminDataError: 'AdminDataError' };
    if (id === '@/components/premium-dashboard') return Object.fromEntries(['ActionCard', 'CleanSection', 'EmptyState', 'PremiumDashboardHero', 'RoleMetricCard', 'StatusBadge'].map(x => [x, x]));
    if (id === 'next/link') return { default: 'Link' };
    if (id === 'lucide-react') return Object.fromEntries(['Activity', 'Camera', 'CheckCircle2', 'Eye', 'Home', 'RadioTower', 'ShieldCheck', 'TriangleAlert', 'Video'].map(x => [x, x]));
    return no();
  } });
  let tree;
  try { tree = await exported.default(); } catch (e) { assert.ok(denied); assert.equal(e.message, 'DENIED'); }
  if (denied) { assert.equal(tree, undefined); assert.equal(clients + healthCalls + diagnosticCalls + providerCalls + effects + queries.length + diagnostics.length, 0); return; }
  assert.equal(clients, 1); assert.equal(healthCalls, 1); assert.equal(diagnosticCalls, 1); assert.equal(providerCalls, 0); assert.equal(effects, 0);
  assert.deepEqual(queries.map(q => q.table), outer ? [] : sources);
  for (const q of queries) if (!['factory', 'chain'].includes(q.mode)) assert.deepEqual(normalize(q.calls), chains[sources.indexOf(q.table)]);
  const available = sources.map((_, i) => !outer && !unavailable(modes[i] ?? 'healthy'));
  const rows = sources.map((_, i) => available[i] && !['empty', 'null'].includes(modes[i]) ? data[i] ?? [] : []);
  const camera = rows[1], homes = rows[2];
  const registered = camera.filter(c => c.gateway_registration_status === 'registered' || c.status === 'connected').length;
  const failed = camera.filter(c => ['failed', 'offline', 'error', 'gateway_unavailable', 'no_signal'].includes(c.gateway_registration_status ?? c.health_status ?? '')).length;
  const pending = camera.filter(c => !c.gateway_registration_status || ['pending_gateway', 'testing', 'registering', 'pending'].includes(c.gateway_registration_status)).length;
  const homeCount = camera.filter(c => c.deployment_scope === 'home_test' || c.test_site_type === 'home_test').length + homes.reduce((sum, h) => sum + (h.camera_count ?? 0), 0);
  const privacySafe = camera.filter(c => c.audio_disabled !== false && c.face_recognition_disabled !== false).length;
  const metrics = nodes(tree, n => n.type === 'RoleMetricCard'); assert.equal(metrics.length, 8);
  const expected = [healthReject ? 'error' : 'not_configured', (!healthReject ? streamCount : null) ?? (available[1] ? registered : 'לא זמין'), available[1] && available[2] ? camera.length - homeCount : 'לא זמין', available[1] && available[2] ? homeCount : 'לא זמין', available[1] ? registered : 'לא זמין', available[1] ? pending : 'לא זמין', available[1] ? camera.filter(c => c.recording_enabled).length : 'לא זמין', available[1] ? camera.filter(c => c.observer_enabled || c.observer_shadow_mode).length : 'לא זמין'];
  assert.deepEqual(metrics.map(m => m.props.value), expected);
  assert.equal(metrics[1].props.hint, available[1] ? `${failed} כשלו` : 'נתוני הכשלונות אינם זמינים');
  assert.equal(metrics[2].props.hint, available[1] ? `${pending} ממתינות` : 'נתוני ההמתנה אינם זמינים');
  assert.equal(metrics[3].props.hint, available[2] ? `${homes.length} אתרי בדיקה` : 'נתוני אתרי הבדיקה אינם זמינים');
  if (!available[1]) for (const i of [1, 2, 3, 4, 5, 6, 7]) assert.equal(metrics[i].props.tone, 'warn');
  if (!available[2]) for (const i of [2, 3]) assert.equal(metrics[i].props.tone, 'warn');
  const sections = nodes(tree, n => n.type === 'CleanSection');
  const section = title => { const s = sections.filter(n => n.props.title === title); assert.equal(s.length, 1); return s[0]; };
  const all = text(tree); assert.ok(!JSON.stringify(tree).includes('PRIVATE_')); assert.ok(!all.includes('SYNTHETIC_SESSION_NEVER_RENDERED'));
  assert.equal(Boolean(nodes(tree, n => n.type === 'AdminDataError')[0].props.message), available.some(x => !x));
  const spec = [[0, 'תצורת Gateway', 'נתוני תצורת ה-Gateway אינם זמינים'], [1, 'מצלמות ושידורים', 'נתוני המצלמות אינם זמינים'], [2, 'פיילוט מצלמת בית', 'נתוני אתרי הבית אינם זמינים'], [3, 'מוכנות פריסה', 'נתוני מוכנות הפריסה אינם זמינים'], [4, 'בדיקות חיבור אחרונות', 'נתוני בדיקות החיבור אינם זמינים']];
  const displayed = [rows[0], rows[1].slice(0, 12), rows[2], rows[3].filter(c => ['gateway', 'home_test', 'playback', 'health'].includes(c.category)).slice(0, 8), rows[4]];
  for (const [index, title, unknown] of spec) {
    const s = section(title); const empty = nodes(s, n => n.type === 'EmptyState');
    if (!available[index]) { assert.deepEqual(empty.map(n => n.props.title), [unknown]); assert.equal(nodes(s, n => n.type === 'article').length, 0); }
    else {
      assert.ok(!empty.some(n => n.props.title === unknown));
      const cards = nodes(s, n => n.type === 'article' && n.key != null); assert.deepEqual(cards.map(n => n.key), displayed[index].map(r => r.id));
      if (!displayed[index].length && index !== 0 && index !== 3) assert.equal(empty.length, 1);
    }
  }
  const configText = text(section('תצורת Gateway'));
  assert.equal(configText.includes('SYNTHETIC_DIAGNOSTICS'), available[0] && rows[0].length === 0);
  const privacy = nodes(section('פרטיות ואבטחה'), n => n.type === 'article' && text(n).includes('Audio / Face'))[0];
  assert.ok(privacy); const badge = nodes(privacy, n => n.type === 'StatusBadge')[0];
  assert.equal(badge.props.tone, !available[1] ? 'warn' : privacySafe === camera.length ? 'good' : 'warn');
  assert.ok(text(privacy).includes(available[1] ? `${privacySafe}/${camera.length}` : 'נתוני סימון הפרטיות אינם זמינים'));
  if (healthReject) assert.equal(metrics[0].props.hint, 'לא ניתן לבדוק את מצב ה-Gateway כרגע'); else assert.equal(metrics[0].props.hint, 'SYNTHETIC_DISABLED_HEALTH');
  assert.ok(diagnostics.every(args => !JSON.stringify(args).includes('PRIVATE_')));
  if (available.every(Boolean)) assert.equal(diagnostics.length, 0); else assert.ok(diagnostics.length > 0);
  return { tree, all, metrics, sections, dateInputs, section };
}
const cases = [];
function add(id, run) { cases.push({ id, run }); }
for (let source = 0; source < 6; source++) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'reject-null', 'reject-false', 'factory', 'chain', 'error-poison']) add(`source-${source}-${mode}`, () => render({ modes: { [source]: mode } }));
for (const mode of ['healthy', 'empty', 'null']) add(`all-known-${mode}`, () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, mode])) }));
add('denied-before-all-effects', () => render({ denied: true }));
add('outer-client-all-unknown-independent-health', () => render({ outer: true }));
add('health-rejection-generic-not-private', () => render({ healthReject: true }));
for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) add(`independent-pair-${a}-${b}`, () => render({ modes: { [a]: 'error-stale', [b]: 'reject-false' } }));
add('all-sources-poisoned-unknown', () => render({ modes: Object.fromEntries(sources.map((_, i) => [i, 'error-poison'])) }));
for (const streamCount of [null, 0, 7]) for (const failed of [false, true]) add(`health-count-${streamCount}-camera-failed-${failed}`, () => render({ streamCount, modes: failed ? { 1: 'error-stale' } : {} }));
for (const status of ['registered', 'failed', 'offline', 'error', 'gateway_unavailable', 'no_signal', 'pending_gateway', 'testing', 'registering', 'pending', '', null]) add(`camera-status-${String(status)}`, () => { const data = fixture(); data[1] = [{ ...data[1][0], gateway_registration_status: status, status: 'connected', health_status: 'failed' }]; return render({ data }); });
for (const flag of [true, false, null, 0, 'false']) add(`camera-truthy-flags-${typeof flag}-${String(flag)}`, () => { const data = fixture(); data[1][0].recording_enabled = flag; data[1][0].observer_enabled = flag; data[1][0].observer_shadow_mode = false; data[1][0].audio_disabled = flag; data[1][0].face_recognition_disabled = flag; return render({ data }); });
for (const source of [0, 1]) add(`failed-invalid-date-${source}`, () => { const data = fixture(); if (source === 0) data[0][0].last_heartbeat_at = 'INVALID_DATE'; else data[1][0].last_test_at = 'INVALID_DATE'; return render({ data, modes: { [source]: 'error-stale' } }); });
add('healthy-valid-dates-and-nullish-labels', async () => { const data = fixture(); data[0][0].last_heartbeat_at = '2026-11-05T00:00:00Z'; data[1][0].last_test_at = '2026-11-05T01:00:00Z'; const r = await render({ data }); assert.equal(r.dateInputs.length, 2); assert.ok(!text(r.section('בדיקות חיבור אחרונות')).includes('SYNTHETIC_VALIDATION')); const first = nodes(r.section('מצלמות ושידורים'), n => n.type === 'article')[0]; assert.ok(text(nodes(first, n => n.type === 'span')[0]).startsWith(' · ')); });
add('home-double-contribution-negative-kindergarten-preserved', async () => { const r = await render(); assert.equal(r.metrics[2].props.value, -1); assert.equal(r.metrics[3].props.value, 4); });
add('healthy-empty-config-diagnostics-fallback', () => render({ modes: { 0: 'empty' } }));
add('healthy-empty-camera-privacy-zero-of-zero', () => render({ modes: { 1: 'empty' } }));
add('diagnostic-required-env-fallback-no-env-access', () => render({ modes: { 0: 'empty' }, requiredEnv: null }));
add('original-list-order-and-local-caps', () => { const data = fixture(); data[0] = Array.from({ length: 3 }, (_, i) => ({ ...data[0][0], id: `G${i}` })); data[1] = Array.from({ length: 301 }, (_, i) => ({ ...data[1][0], id: `C${i % 2}` })); data[2] = Array.from({ length: 21 }, (_, i) => ({ ...data[2][0], id: `H${i}` })); data[3] = Array.from({ length: 12 }, (_, i) => ({ ...data[3][0], id: `R${i}` })); data[4] = Array.from({ length: 13 }, (_, i) => ({ ...data[4][0], id: `V${i}` })); return render({ data }); });
add('sessions-failure-feedback-only', async () => { const r = await render({ modes: { 5: 'error-poison' } }); assert.deepEqual(r.metrics.slice(1).map(m => m.props.value), [1, -1, 4, 1, 1, 1, 2]); });
add('one-portable-domain-hook', () => { const config = JSON.parse(read('config/digital-observer-ci-gates.json')); assert.deepEqual(config.domain.filter(x => x.name === 'camera-gateway-query-boundary'), [{ name: 'camera-gateway-query-boundary', args: ['--test', 'scripts/qa/check-camera-gateway-query-boundary.mjs'] }]); });
const registry = cases.map(c => c.id); assert.equal(new Set(registry).size, registry.length);
console.log('CASE_REGISTRY ' + JSON.stringify(registry));
for (const c of cases) test(c.id, c.run);
