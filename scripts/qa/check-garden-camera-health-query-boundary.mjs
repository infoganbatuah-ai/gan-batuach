import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Actual server page, selected pure AST only. Gateway config is an UNVERIFIED inert fixture.
const root = process.cwd();
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/camera-health/page.tsx';
function read(file) {
  const full = path.join(root, file);
  assert.ok(fs.statSync(full).isFile(), 'source must be a regular file');
  if (process.platform === 'darwin') {
    const rawFlags = execFileSync('/usr/bin/stat', ['-f', '%f', full], { encoding: 'utf8' }).trim();
    assert.match(rawFlags, /^\d+$/, 'stat must return numeric file flags');
    const flags = Number(rawFlags);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0);
    assert.equal(flags & 0x40000000, 0, 'dataless source forbidden');
  }
  return fs.readFileSync(full, 'utf8');
}
function parse(text, file = 'module.ts') { return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function walk(n, fn) { fn(n); ts.forEachChild(n, (child) => walk(child, fn)); }
function shape(n) { const children = []; ts.forEachChild(n, (c) => { children.push(shape(c)); }); return [n.kind, ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? n.text : null, children]; }
const selected = [];
function inert(n) {
  if (ts.isStringLiteral(n) || ts.isNumericLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword) return true;
  return ts.isObjectLiteralExpression(n) && n.properties.every((p) => ts.isPropertyAssignment(p) && inert(p.initializer));
}
function extract(file, functions, variables = []) {
  const sf = parse(read(file)); const nodes = []; const foundFunctions = []; const foundVariables = [];
  for (const node of sf.statements) {
    if (ts.isFunctionDeclaration(node) && functions.includes(node.name?.text)) { nodes.push(node); foundFunctions.push(node.name.text); }
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (!variables.includes(declaration.name.getText(sf))) continue;
      assert.equal(node.declarationList.declarations.length, 1);
      if (declaration.name.getText(sf) === 'cameraProviderRegistry') assert(inert(declaration.initializer));
      else {
        const init = declaration.initializer; assert(ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression));
        assert.equal(init.expression.name.text, 'join'); assert.equal(init.arguments.length, 1); assert.equal(init.arguments[0].text, ',');
        assert(ts.isArrayLiteralExpression(init.expression.expression) && init.expression.expression.elements.every(ts.isStringLiteral));
      }
      nodes.push(node); foundVariables.push(declaration.name.getText(sf));
    }
  }
  assert.deepEqual(foundFunctions, functions); assert.deepEqual(foundVariables, variables);
  for (const node of nodes) walk(node, (n) => {
    assert(!ts.isImportDeclaration(n));
    if (ts.isIdentifier(n)) assert(!['process', 'require', 'fetch', 'globalThis', 'window', 'document', 'eval', 'createClient', 'createAdminClient', 'recordCameraHealthCheck', 'validateCameraStreamReadiness', 'buildRtspCandidates'].includes(n.text));
  });
  selected.push({ file, functions: foundFunctions, variables: foundVariables });
  return nodes.map((n) => n.getText(sf)).join('\n');
}
const pureSource = [
  extract('lib/domain/camera-status.ts', ['normalizeCameraStatus']),
  extract('lib/domain/camera-health.ts', ['getCameraHealthStatus', 'summarizeCameraHealth']),
  extract('lib/domain/video-gateway.ts', ['hasPlaybackSource']),
  extract('lib/domain/real-camera-infrastructure.ts', ['inferCameraProvider', 'buildCameraInfrastructureSummary', 'cameraDiagnosticsFor'], ['cameraProviderRegistry']),
  extract('lib/domain/camera-safe-columns.ts', [], ['CAMERA_BROWSER_SAFE_SELECT']),
  extract('lib/admin-safe.ts', ['safeAdminData', 'logSupabaseError'])
].join('\n');
assert.equal(selected.reduce((n, r) => n + r.functions.length, 0), 9);
assert.equal(selected.reduce((n, r) => n + r.variables.length, 0), 2);
const source = read(pageFile), pageAst = parse(source, pageFile);
const compile = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const pureJs = compile(pureSource, 'selected-pure.ts'), pageJs = compile(source, pageFile);
let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) {
  const module = { exports: {} };
  vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; forbidden++; throw Error('UNAPPROVED_MODULE'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return module.exports;
}
const names = ['camera_streams', 'camera_stream_validations', 'camera_health_history', 'camera_recording_readiness', 'camera_storage_readiness'];
const healthyCameras = Array.from({ length: 10 }, (_, i) => ({ id: `camera-${i}`, name: `camera-name-${i}`, area: `zone-${i}`, garden_id: 'garden-qa', system_type: i % 2 ? 'dvr' : 'hikvision', stream_status: ['connected', 'offline', 'connecting', 'error', 'disabled'][i % 5], health_status: i === 5 ? 'warning' : 'healthy', active: i !== 4, gateway_stream_id: i % 2 ? null : `synthetic-source-${i}`, playback_hls_ready: i % 3 === 0, playback_webrtc_ready: i % 3 === 1, recording_enabled: i % 2 === 0, retention_days: i % 2 === 0 ? 7 : null, recording_storage_location: i % 2 === 0 ? 'synthetic-storage-label' : null, storage_provider: i % 4 === 0 ? 'synthetic-provider-label' : null }));
const healthy = [healthyCameras, [{ id: 'validation-1', status: 'failed' }], [{ id: 'history-1' }], [{ id: 'recording-1' }], [{ id: 'storage-1' }]];
function nodes(tree, type) {
  const out = [];
  function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) out.push(n); visit(n.props?.children); } }
  visit(tree); return out;
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (tree && typeof tree === 'object') return [tree.props?.title, tree.props?.text, tree.props?.message, tree.props?.value, tree.props?.metric, tree.props?.meta, text(tree.props?.children)].filter((x) => x !== undefined).join(' ');
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
}
async function run(config = {}) {
  pageCalls++; const queries = [], logs = [], summaryInputs = [], diagnosticInputs = []; let clients = 0, configCalls = 0;
  const failed = new Set(config.fail ?? []), method = config.method ?? 'error', payload = config.payload ?? healthy;
  const gatewayConfigured = config.gateway ?? false;
  const pure = evaluate(pureJs, {}, { isGatewayConfigured() { configCalls++; return gatewayConfigured; }, console: { warn(...args) { logs.push(args); } } });
  const selector = pure.CAMERA_BROWSER_SAFE_SELECT;
  for (const privateField of ['host', 'connection_host', 'source_url', 'hls_playback_url', 'sample_hls_url', 'webrtc_playback_url', 'username', 'password']) assert(!selector.split(',').includes(privateField));
  const realSummary = pure.buildCameraInfrastructureSummary, realDiagnostics = pure.cameraDiagnosticsFor;
  const infra = { buildCameraInfrastructureSummary(cameras, validations) { summaryInputs.push({ cameras, validations }); return realSummary(cameras, validations); }, cameraDiagnosticsFor(camera) { diagnosticInputs.push(camera); return realDiagnostics(camera); } };
  const profile = { role: config.role ?? 'manager', garden_id: config.garden === undefined ? 'garden-qa' : config.garden, full_name: '[DEMO] Camera QA', profile_image_url: null };
  const denied = Error('ROLE_DENIED');
  const sdk = { createClient: async () => {
    clients++; if (config.clientThrow) throw Error('PRIVATE_CLIENT');
    return { from(table) {
      const index = names.indexOf(table); assert(index >= 0); const q = { table, steps: [] }; queries.push(q);
      if (failed.has(index) && method === 'builder') throw Error('PRIVATE_BUILDER');
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          if (failed.has(index) && method === 'reject') return Promise.reject(Error('PRIVATE_REJECT')).then(resolve, reject);
          return Promise.resolve({ data: failed.has(index) ? [{ id: 'STALE', name: 'STALE', status: 'failed' }] : payload[index], error: failed.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'order', 'limit'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherActionTile', 'TeacherAiInsight', 'TeacherAppFrame', 'TeacherCompactItem', 'TeacherCompactList', 'TeacherEmptyState', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link', __esModule: true },
    'lucide-react': Object.fromEntries(['Camera', 'CameraOff', 'HardDrive', 'RadioTower', 'ShieldCheck', 'Video'].map((n) => [n, n])),
    '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' }, '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui,
    '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } },
    '@/lib/supabase/server': sdk, '@/lib/admin-safe': { safeAdminData: pure.safeAdminData, logSupabaseError: pure.logSupabaseError },
    '@/lib/domain/real-camera-infrastructure': infra, '@/lib/domain/camera-safe-columns': { CAMERA_BROWSER_SAFE_SELECT: selector }
  };
  const page = evaluate(pageJs, imports).default;
  if (config.denied) { await assert.rejects(page, (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); assert.equal(configCalls, 0); return { denied: true }; }
  const tree = await page(), scoped = Boolean(profile.garden_id) && !config.clientThrow;
  assert.equal(clients, profile.garden_id ? 1 : 0); assert.equal(queries.length, scoped ? 5 : 0);
  for (const q of queries) {
    if (failed.has(names.indexOf(q.table)) && method === 'builder') continue;
    assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'garden_id' && s[2] === 'garden-qa'));
    if (q.table === names[0]) assert.equal(q.steps[0][1], selector);
  }
  const cards = nodes(tree, 'TeacherStatCard');
  if (!profile.garden_id) {
    assert.equal(cards.length, 0); assert.equal(nodes(tree, 'TeacherEmptyState').length, 0); assert.equal(nodes(tree, 'TeacherAiInsight').length, 0); assert.equal(configCalls, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); return { clients, queries: 0, configCalls };
  }
  const camerasAvailable = scoped && !failed.has(0), cameras = camerasAvailable ? payload[0] ?? [] : [];
  assert.equal(summaryInputs.length, scoped ? 1 : 0);
  if (scoped) {
    assert.equal(JSON.stringify(summaryInputs[0].cameras), JSON.stringify(cameras));
    assert.equal(JSON.stringify(summaryInputs[0].validations), JSON.stringify(failed.has(1) ? [] : payload[1] ?? []));
  }
  assert.equal(JSON.stringify(diagnosticInputs), JSON.stringify(cameras));
  const expected = realSummary(cameras, failed.has(1) ? [] : payload[1] ?? []);
  const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props]));
  assert.equal(cards.length, 4);
  for (const [title, field, tone] of [['מצלמות', 'total', 'purple'], ['Online', 'online', expected.online ? 'green' : 'orange'], ['Offline', 'offline', expected.offline ? 'red' : 'green']]) {
    assert.equal(stats[title].value, camerasAvailable ? expected[field] : 'לא זמין'); assert.equal(stats[title].tone, camerasAvailable ? tone : 'neutral');
  }
  assert.equal(stats.Gateway.value, scoped ? gatewayConfigured ? 'מוגדר' : 'לא מוגדר' : 'לא זמין'); assert.equal(stats.Gateway.tone, 'neutral'); assert(stats.Gateway.hint.includes('החיבור לא אומת'));
  const insight = nodes(tree, 'TeacherAiInsight')[0]; assert.equal(insight.props.metric, scoped ? gatewayConfigured ? 'Gateway מוגדר' : 'Gateway לא מוגדר' : 'לא זמין'); assert(!['בטוח', 'מחובר'].includes(insight.props.metric)); assert(!['בטוח', 'מחובר'].includes(stats.Gateway.value));
  const diagnosticSection = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'אבחון מצלמות'), rows = nodes(diagnosticSection, 'TeacherCompactItem');
  assert.deepEqual(rows.map((n) => n.props.title), cameras.slice(0, 8).map((c) => c.name ?? 'מצלמה'));
  for (let i = 0; i < rows.length; i++) {
    const c = cameras[i], d = realDiagnostics(c), p = rows[i].props;
    assert.equal(p.subtitle, `${c.area ?? 'אזור לא צוין'} · ${d.providerName} · צפייה ${d.playback.hlsReady || d.playback.webrtcReady ? 'מוכנה' : 'ממתינה'}`);
    assert.equal(p.tone, ['offline', 'failed', 'error'].includes(d.healthStatus) ? 'red' : ['online', 'connected', 'ready'].includes(d.healthStatus) ? 'green' : 'orange'); assert.equal(p.meta, d.healthStatus); assert.equal(p.href, '/dashboard/garden/cameras');
  }
  if (!camerasAvailable) { assert(!text(diagnosticSection).includes('אין מצלמות')); assert(text(diagnosticSection).includes('לא זמי')); }
  else if (!cameras.length) assert(text(diagnosticSection).includes('אין מצלמות עדיין'));
  const ratioSection = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'מוכנות צפייה ואחסון');
  for (const [i, field, tone] of [[0, 'playbackReady', 'blue'], [1, 'recordingReady', 'purple'], [2, 'storageReady', 'green']]) {
    const p = nodes(ratioSection, 'TeacherCompactItem')[i].props; assert.equal(p.meta, camerasAvailable ? `${expected[field]}/${expected.total}` : 'לא זמין'); assert.equal(p.tone, camerasAvailable ? tone : 'neutral');
  }
  if (!scoped || failed.size) assert(nodes(tree, 'AdminDataError')[0].props.message);
  assert(!text(tree).includes('STALE')); assert(!JSON.stringify(logs).includes('PRIVATE_'));
  assert.equal(nodes(tree, 'DashboardShell')[0].props.role, profile.role); assert.equal(nodes(tree, 'TeacherAppFrame')[0].props.title, 'בוקר טוב, Camera'); assert.equal(nodes(tree, 'TeacherActionTile').length, 4);
  assert(text(insight).includes('אין חשיפת RTSP'));
  return { clients, queries: queries.length, cameraCountAvailable: camerasAvailable, gatewayFixture: gatewayConfigured ? 'UNVERIFIED_PRESENT' : 'UNVERIFIED_ABSENT' };
}
async function test(id, config) { const result = await run(config); results.push({ id, status: 'PASS', ...result }); }
const started = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("camera_streams" as any).select(CAMERA_BROWSER_SAFE_SELECT).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(200)',
    'supabase.from("camera_stream_validations" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(100)',
    'supabase.from("camera_health_history" as any).select("*").eq("garden_id", gardenId).order("checked_at", { ascending: false }).limit(100)',
    'supabase.from("camera_recording_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(100)',
    'supabase.from("camera_storage_readiness" as any).select("*").eq("garden_id", gardenId).order("updated_at", { ascending: false }).limit(20)'
  ];
  walk(pageAst, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'limit') chains.push(shape(n)); });
  assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!gardenId)') < source.indexOf('await createClient()'));
  assert(!source.includes('CAMERA_PRIVATE_PLAYBACK_SELECT')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 6);
  results.push({ id: 'static-five-whole-chains-admission-selector-pure-AST', status: 'PASS', selected });
  await test('healthy-manager-config-absent', {}); await test('healthy-owner-config-present', { role: 'owner', gateway: true });
  for (const gateway of [false, true]) {
    await test(`healthy-empty-config-${gateway}`, { payload: names.map(() => []), gateway }); await test(`healthy-null-config-${gateway}`, { payload: names.map(() => null), gateway });
  }
  for (let i = 0; i < 5; i++) for (const method of ['error', 'reject', 'builder']) await test(`${names[i]}-${method}`, { fail: [i], method, gateway: true });
  await test('all-failed', { fail: [0, 1, 2, 3, 4], gateway: true }); await test('all-rejected', { fail: [0, 1, 2, 3, 4], method: 'reject' });
  await test('client-throw-config-present', { clientThrow: true, gateway: true });
  await test('missing-null', { garden: null, gateway: true }); await test('missing-empty', { garden: '', gateway: true }); await test('denied-role', { denied: true, gateway: true });
  await test('all-auxiliary-fail-camera-retained', { fail: [1, 2, 3, 4], gateway: true });
  await test('camera-error-config-absent', { fail: [0], gateway: false });
  assert.equal(forbidden, 0);
  console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - started, gatewayConfigurationEvidence: 'UNVERIFIED_INERT_FIXTURE_ONLY', selected, results, limitations: 'Synthetic selected pure AST / actual page; not live client/hardware/browser/RLS/full-stack/privacy or legal proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
