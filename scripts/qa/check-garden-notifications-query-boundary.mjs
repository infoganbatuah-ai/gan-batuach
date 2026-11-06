import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Actual page + two selected pure safe helpers. Client components opaque; SDK/Auth closed.
// Delivery capability is ONLY an inert UNVERIFIED fixture, never the mixed provider module.
const root = process.cwd(), ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/notifications/page.tsx';
function read(file) {
  const p = path.join(root, file);
  assert.ok(fs.statSync(p).isFile(), 'source must be a regular file');
  if (process.platform === 'darwin') {
    const rawFlags = execFileSync('/usr/bin/stat', ['-f', '%f', p], { encoding: 'utf8' }).trim();
    assert.match(rawFlags, /^\d+$/, 'stat must return numeric file flags');
    const flags = Number(rawFlags);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0);
    assert.equal(flags & 0x40000000, 0, 'dataless source forbidden');
  }
  return fs.readFileSync(p, 'utf8');
}
function parse(s, file = 'pure.ts') { return ts.createSourceFile(file, s, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function walk(n, fn) { fn(n); ts.forEachChild(n, (c) => walk(c, fn)); }
function shape(n) { const children = []; ts.forEachChild(n, (c) => { children.push(shape(c)); }); return [n.kind, ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? n.text : null, children]; }
const safeAst = parse(read('lib/admin-safe.ts')), selectedNames = ['safeAdminData', 'logSupabaseError'];
const selected = safeAst.statements.filter((n) => ts.isFunctionDeclaration(n) && selectedNames.includes(n.name?.text));
assert.deepEqual(selected.map((n) => n.name.text), selectedNames); assert.equal(selected.length, 2);
for (const n of selected) walk(n, (node) => { assert(!ts.isImportDeclaration(node)); if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval', 'createClient', 'managementDeliveryCapability'].includes(node.text)); });
const source = read(pageFile), ast = parse(source, pageFile);
const compile = (s, fileName) => ts.transpileModule(s, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const safeJs = compile(selected.map((n) => n.getText(safeAst)).join('\n'), 'safe.ts'), pageJs = compile(source, pageFile);
const names = ['notifications', 'communication_preferences', 'push_category_preferences'];
const notifications = [
  { id: 'SYNTHETIC_N0', read_at: null, severity: 'urgent', body: 'SYNTHETIC_BODY_0' },
  { id: 'SYNTHETIC_N1', read_at: '', severity: 'critical', body: 'SYNTHETIC_BODY_1' },
  { id: 'SYNTHETIC_N2', read_at: false, severity: 'high' },
  { id: 'SYNTHETIC_N3', read_at: 0, severity: 'normal' },
  { id: 'SYNTHETIC_N4', read_at: 'SYNTHETIC_READ_TIME', severity: 'urgent' },
  { id: 'SYNTHETIC_N5', severity: 'URGENT' },
  { id: 'SYNTHETIC_N6', read_at: true, severity: null },
  { id: 'SYNTHETIC_N0', read_at: null, severity: 'critical', body: 'SYNTHETIC_DUPLICATE_ID' }
];
const preferences = { id: 'SYNTHETIC_PREFERENCE', profile_id: 'SYNTHETIC_PROFILE', quiet_hours_enabled: false, marker: 'SYNTHETIC_UNCHANGED_PAYLOAD' };
const push = [{ category: 'updates', enabled: true }, { category: 'safety', enabled: false }, { category: 'updates', enabled: false }, { category: 'other', enabled: false }, { category: 'safety', enabled: true }];
const healthy = [notifications, preferences, push], capability = Object.freeze({ status: 'UNVERIFIED', marker: 'INERT_QA_CAPABILITY_NOT_PROVIDER_PROOF' });
let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) { const module = { exports: {} }; vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(n) { if (Object.hasOwn(imports, n)) return imports[n]; forbidden++; throw Error('CLOSED_IMPORT'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }); return module.exports; }
function nodes(tree, type) { const out = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) out.push(n); visit(n.props?.children); } } visit(tree); return out; }
function text(n) { if (Array.isArray(n)) return n.map(text).join(' '); if (n && typeof n === 'object') return [n.props?.title, n.props?.text, n.props?.message, n.props?.subtitle, n.props?.hint, n.props?.value, text(n.props?.children)].filter((v) => v !== undefined).join(' '); return typeof n === 'string' || typeof n === 'number' ? String(n) : ''; }
async function run(config = {}) {
  pageCalls++; const queries = [], logs = [], captured = []; let clients = 0, capabilityCalls = 0;
  const pure = evaluate(safeJs, {}, { console: { warn(...args) { logs.push(args); } } });
  const safe = { logSupabaseError: pure.logSupabaseError, safeAdminData(label, loader, fallback) { return pure.safeAdminData(label, async () => { const data = await loader(); captured.push(data); return data; }, fallback); } };
  const fail = new Set(config.fail ?? []), method = config.method ?? 'error', payload = config.payload ?? healthy;
  const profile = { id: config.profile === undefined ? 'profile-qa' : config.profile, garden_id: config.garden === undefined ? 'garden-qa' : config.garden, role: config.role ?? 'manager', full_name: '[DEMO] Owner QA', profile_image_url: 'SYNTHETIC_AVATAR' }, denied = Error('DENIED');
  const sdk = { createClient: async () => {
    clients++; if (config.clientThrow) throw Error('PRIVATE_CLIENT');
    return { from(table) {
      const index = names.indexOf(table); assert(index >= 0); const q = { table, steps: [] }; queries.push(q);
      if (fail.has(index) && method === 'builder') throw Error('PRIVATE_BUILDER');
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          if (fail.has(index) && method === 'reject') return Promise.reject(Error('PRIVATE_REJECT')).then(resolve, reject);
          const stale = method === 'error-empty' ? index === 1 ? null : [] : index === 0 ? [{ id: 'STALE', read_at: null, severity: 'critical', body: 'STALE' }] : index === 1 ? { id: 'STALE', marker: 'STALE' } : [{ category: 'STALE', enabled: true }];
          return Promise.resolve({ data: fail.has(index) ? stale : payload[index], error: fail.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'or', 'eq', 'order', 'limit', 'maybeSingle'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherAppFrame', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherActionTile', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid', 'TeacherEmptyState'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': Object.fromEntries(['Bell', 'CheckCircle2', 'MessageSquareText', 'ShieldAlert'].map((n) => [n, n])), '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui, '@/components/notification-center': { NotificationCenter: 'NotificationCenter_OPAQUE' }, '@/components/parent-notification-preferences': { NotificationPreferencesPanel: 'NotificationPreferencesPanel_OPAQUE' }, '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } }, '@/lib/supabase/server': sdk, '@/lib/admin-safe': safe, '@/lib/management/external-delivery': { managementDeliveryCapability() { capabilityCalls++; return capability; } } };
  const page = evaluate(pageJs, imports).default;
  if (config.denied) { await assert.rejects(() => page(), (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); assert.equal(capabilityCalls, 0); return { denied: true, centerCount: 0, preferencesCount: 0, capabilityCalls }; }
  const tree = await page(), validContext = Boolean(profile.id && profile.garden_id), scoped = validContext && !config.clientThrow, available = names.map((_, i) => scoped && !fail.has(i)), prefsAvailable = available[1] && available[2];
  assert.equal(clients, validContext ? 1 : 0); assert.equal(queries.length, scoped ? 3 : 0);
  for (const q of queries) {
    const i = names.indexOf(q.table); if (fail.has(i) && method === 'builder') continue;
    if (i === 0) {
      assert.equal(q.steps.find((s) => s[0] === 'or')[1], 'recipient_id.eq.profile-qa,recipient_profile_id.eq.profile-qa,garden_id.eq.garden-qa,kindergarten_id.eq.garden-qa');
      assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'order')), JSON.stringify(['order', 'created_at', { ascending: false }])); assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'limit')), JSON.stringify(['limit', 120]));
    } else { assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'eq')), JSON.stringify(['eq', 'profile_id', 'profile-qa'])); assert.equal(q.steps.find((s) => s[0] === 'select')[1], i === 1 ? '*' : 'category,enabled'); if (i === 1) assert.equal(q.steps.at(-1)[0], 'maybeSingle'); }
  }
  const frame = nodes(tree, 'TeacherAppFrame')[0]; assert.equal(frame.props.title, 'בוקר טוב, Owner'); assert.equal(frame.props.subtitle, 'מרכז התראות הגן'); assert.equal(frame.props.avatarUrl, 'SYNTHETIC_AVATAR'); assert.equal(frame.props.active, 'messages');
  const centers = nodes(tree, 'NotificationCenter_OPAQUE'), panels = nodes(tree, 'NotificationPreferencesPanel_OPAQUE'), cards = nodes(tree, 'TeacherStatCard');
  if (!validContext) { assert.equal(centers.length, 0); assert.equal(panels.length, 0); assert.equal(cards.length, 0); assert.equal(capabilityCalls, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); return { clients, queries: 0, centerCount: 0, preferencesCount: 0, capabilityCalls }; }
  const expectedNotifications = available[0] ? payload[0] ?? [] : [], expectedPreferences = available[1] ? payload[1] : null, expectedPush = available[2] ? payload[2] ?? [] : [];
  if (scoped) { assert.equal(captured.length, 1); assert.equal(JSON.stringify(captured[0].notifications), JSON.stringify(expectedNotifications)); assert.equal(JSON.stringify(captured[0].preferences), JSON.stringify(expectedPreferences)); assert.equal(JSON.stringify(captured[0].pushPreferences), JSON.stringify(expectedPush)); } else assert.equal(captured.length, 0);
  const unread = expectedNotifications.filter((n) => !n.read_at).length, urgent = expectedNotifications.filter((n) => ['urgent', 'critical'].includes(n.severity ?? '')).length;
  const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props])); assert.equal(cards.length, 3);
  assert.equal(stats['התראות חדשות'].value, available[0] ? unread : 'לא זמין'); assert.equal(stats['התראות חדשות'].tone, available[0] ? 'purple' : 'neutral'); assert.equal(stats['התראות חדשות'].hint, 'ממתינות לקריאה');
  assert.equal(stats['דחופות'].value, available[0] ? urgent : 'לא זמין'); assert.equal(stats['דחופות'].tone, !available[0] ? 'neutral' : urgent ? 'red' : 'green'); assert.equal(stats['דחופות'].hint, 'לטיפול היום');
  assert.equal(stats['סך הכל'].value, available[0] ? expectedNotifications.length : 'לא זמין'); assert.equal(stats['סך הכל'].tone, available[0] ? 'blue' : 'neutral'); assert.equal(stats['סך הכל'].hint, 'התראות אחרונות');
  const sections = nodes(tree, 'TeacherSection'), centerSection = sections.find((n) => n.props.title === 'כל ההתראות'), preferencesSection = sections.find((n) => n.props.title === 'העדפות ושעות שקט'); assert(centerSection && preferencesSection); assert.equal(centerSection.props.subtitle, 'הצגה מלאה עם פעולות קריאה ופתיחה'); assert.equal(preferencesSection.props.subtitle, 'הערוצים מוצגים לפי מוכנות אמיתית של הספק.');
  assert.equal(centers.length, available[0] ? 1 : 0); if (available[0]) assert.equal(JSON.stringify(centers[0].props.notifications), JSON.stringify(payload[0] ?? [])); else assert(text(centerSection).includes('ההתראות לא זמינות'));
  assert.equal(panels.length, prefsAvailable ? 1 : 0); assert.equal(capabilityCalls, prefsAvailable ? 1 : 0);
  if (prefsAvailable) { const p = panels[0].props; assert.equal(p.preferences, payload[1]); assert.equal(JSON.stringify(p.pushCategoryPreferences), JSON.stringify(Object.fromEntries((payload[2] ?? []).map((r) => [r.category, r.enabled])))); assert.equal(p.capability, capability); assert.equal(p.capability.status, 'UNVERIFIED'); assert.equal(p.audienceLabel, 'עדכוני הניהול שלך'); if (config.expectedPushMap) assert.equal(JSON.stringify(p.pushCategoryPreferences), JSON.stringify(config.expectedPushMap)); }
  else assert(text(preferencesSection).includes('ההעדפות לא זמינות'));
  const actions = nodes(tree, 'TeacherActionTile'); assert.equal(actions.length, 3); assert.deepEqual(actions.map((n) => n.props.href), ['/dashboard/garden/messages', '/dashboard/garden/enrollment-requests', '/dashboard/garden/incidents']); assert.deepEqual(actions.map((n) => n.props.title), ['הודעות להורים', 'בקשות הצטרפות', 'אירועים']); assert.deepEqual(actions.map((n) => n.props.tone), ['purple', 'blue', 'orange']); assert.equal(nodes(tree, 'TeacherPageTitle')[0].props.title, 'מרכז ההתראות');
  if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message);
  assert(!text(tree).includes('STALE')); assert(!JSON.stringify(logs).includes('PRIVATE_')); assert(!JSON.stringify(logs).includes('SYNTHETIC_')); assert(!JSON.stringify(logs).includes('profile-qa')); assert(!JSON.stringify(logs).includes('garden-qa'));
  if (config.expectedCounts) assert.deepEqual([unread, urgent, expectedNotifications.length], config.expectedCounts);
  return { clients, queries: queries.length, notificationsAvailable: available[0], communicationAvailable: available[1], categoriesAvailable: available[2], unread: available[0] ? unread : 'UNKNOWN', urgent: available[0] ? urgent : 'UNKNOWN', centerCount: centers.length, preferencesCount: panels.length, capabilityCalls, capabilityProof: 'UNVERIFIED_FIXTURE_ONLY' };
}
async function test(id, config = {}) { results.push({ id, status: 'PASS', ...await run(config) }); }
const start = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("notifications" as any).select("*").or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id},garden_id.eq.${profile.garden_id},kindergarten_id.eq.${profile.garden_id}`).order("created_at", { ascending: false }).limit(120)',
    'supabase.from("communication_preferences" as never).select("*").eq("profile_id", profile.id).maybeSingle()',
    'supabase.from("push_category_preferences" as never).select("category,enabled").eq("profile_id", profile.id)'
  ];
  walk(ast, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['limit', 'maybeSingle', 'eq'].includes(n.expression.name.text) && !(ts.isPropertyAccessExpression(n.parent) && ts.isCallExpression(n.parent.parent))) chains.push(shape(n)); }); assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!profile.id || !profile.garden_id)') < source.indexOf('await createClient()')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 2); assert.equal((source.match(/\bas never\b/g) ?? []).length, 2); assert.equal((source.match(/managementDeliveryCapability\(\)/g) ?? []).length, 1);
  results.push({ id: 'static-three-whole-chains-four-arm-OR-admission-pure-boundary', status: 'PASS', selected: selectedNames, actualDeliveryModuleExecuted: false });
  await test('healthy-manager-raw-counts-duplicates-push-false-preserved', { expectedCounts: [6, 4, 8], expectedPushMap: { updates: false, safety: true, other: false } }); await test('healthy-owner', { role: 'owner' });
  await test('healthy-empty', { payload: [[], null, []] }); await test('healthy-null', { payload: [null, null, null] });
  await test('healthy-null-communication-original-default', { payload: [notifications, null, push] }); await test('healthy-empty-push-original-default', { payload: [notifications, preferences, []] });
  await test('healthy-no-urgent-legitimate-green', { payload: [[{ id: 'SYNTHETIC_NORMAL', read_at: true, severity: 'high' }], preferences, push], expectedCounts: [0, 0, 1] });
  for (let mask = 1; mask < 8; mask++) for (const method of ['error', 'error-empty', 'reject', 'builder']) { const fail = [0, 1, 2].filter((i) => mask & (1 << i)); await test(`failed-sources-${fail.join('-')}-${method}`, { fail, method }); }
  await test('client-throw', { clientThrow: true });
  for (const field of ['profile', 'garden']) for (const value of [null, '']) await test(`missing-${field}-${value === null ? 'null' : 'empty'}`, { [field]: value });
  await test('missing-both-context-fields', { profile: '', garden: null }); await test('denied-role', { denied: true });
  for (let i = 0; i < 3; i++) for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`failed-${names[i]}-healthy-empty-counterparts-${method}`, { fail: [i], method, payload: [[], null, []] });
  await test('failed-notifications-null-preferences-empty-push-valid-defaults', { fail: [0], payload: [notifications, null, []] });
  await test('both-preferences-failed-healthy-null-notifications', { fail: [1, 2], payload: [null, preferences, push] });
  assert.equal(forbidden, 0); console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - start, selected: selectedNames, actualClientComponentsExecuted: false, actualDeliveryModuleExecuted: false, capabilityProof: 'INERT_UNVERIFIED_FIXTURE_ONLY', results, limitations: 'Actual page +2 selected pure helpers; client UI OPAQUE; SDK/Auth CLOSED; no live notifications/preferences/send/markread/provider/env/module/fullstack/RLS proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
