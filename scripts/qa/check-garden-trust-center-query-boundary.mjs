import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Actual page and selected pure functions; SDK/Auth fixtures and opaque UI only.
const root = process.cwd(), ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/trust-center/page.tsx';
function read(file) { const full = path.join(root, file); assert.equal(Number(execFileSync('/usr/bin/stat', ['-f', '%f', full], { encoding: 'utf8' }).trim()) & 0x40000000, 0); return fs.readFileSync(full, 'utf8'); }
function parse(text, file = 'module.ts') { return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS); }
function walk(n, fn) { fn(n); ts.forEachChild(n, (child) => walk(child, fn)); }
function shape(n) { const children = []; ts.forEachChild(n, (c) => { children.push(shape(c)); }); return [n.kind, ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateTail(n) ? n.text : null, children]; }
const selected = [];
function extract(file, wanted) {
  const sf = parse(read(file)), list = sf.statements.filter((n) => ts.isFunctionDeclaration(n) && wanted.includes(n.name?.text));
  assert.deepEqual(list.map((n) => n.name.text), wanted);
  for (const n of list) walk(n, (node) => { assert(!ts.isImportDeclaration(node)); if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval', 'createClient'].includes(node.text)); });
  selected.push({ file, functions: wanted }); return list.map((n) => n.getText(sf)).join('\n');
}
const pureSource = extract('lib/domain/parent-trust.ts', ['parentTrustTone', 'trustBadgeLabel']) + '\n' + extract('lib/admin-safe.ts', ['safeAdminData', 'logSupabaseError']);
assert.equal(selected.reduce((n, s) => n + s.functions.length, 0), 4);
const source = read(pageFile), pageAst = parse(source, pageFile);
const compile = (text, fileName) => ts.transpileModule(text, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const pureJs = compile(pureSource, 'pure.ts'), pageJs = compile(source, pageFile);
const names = ['parent_trust_profiles', 'parent_transparency_scores', 'parent_feedback_items', 'parent_request_center_items', 'community_announcements', 'community_calendar_events', 'parent_surveys', 'parent_trust_reports'];
const statuses = ['received', 'answered', 'resolved', 'closed', 'under_review', 'in_progress'];
const healthy = [
  { trust_score: 93, trust_badge_status: 'certified', gardens: { name: 'QA Garden' } }, { transparency_score: 74 },
  Array.from({ length: 6 }, (_, i) => ({ id: `feedback-${i}`, title: `feedback-title-${i}`, created_at: i === 5 ? 'invalid' : '2026-11-01', lifecycle_status: statuses[i] })),
  Array.from({ length: 6 }, (_, i) => ({ id: `request-${i}`, title: `request-title-${i}`, created_at: i === 5 ? null : '2026-11-02', lifecycle_status: statuses[i] })),
  Array.from({ length: 8 }, (_, i) => ({ id: `announcement-${i}`, title: `announcement-title-${i}`, published: i % 2 === 0, published_at: '2026-11-03', announcement_type: 'news' })),
  [{ title: 'community-test', starts_at: '2026-11-04' }, { title: 'later-test', starts_at: '2026-11-05' }], [{ status: 'active' }, { status: 'closed' }],
  [{ period_start: '2026-10-01', period_end: '2026-10-31' }, { period_start: '2026-09-01', period_end: '2026-09-30' }]
];
const empty = () => [{}, {}, [], [], [], [], [], []];
const override = (values) => healthy.map((value, i) => Object.hasOwn(values, i) ? values[i] : value);
let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) {
  const module = { exports: {} }; vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(name) { if (Object.hasOwn(imports, name)) return imports[name]; forbidden++; throw Error('FORBIDDEN_MODULE'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }); return module.exports;
}
function nodes(tree, type) { const out = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) out.push(n); visit(n.props?.children); } } visit(tree); return out; }
function text(n) { if (Array.isArray(n)) return n.map(text).join(' '); if (n && typeof n === 'object') return [n.props?.title, n.props?.text, n.props?.message, n.props?.subtitle, n.props?.value, n.props?.hint, n.props?.meta, n.props?.metric, text(n.props?.children)].filter((v) => v !== undefined).join(' '); return typeof n === 'string' || typeof n === 'number' ? String(n) : ''; }
function date(value) { if (!value) return ''; const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? '' : parsed.toLocaleDateString('he-IL'); }
function statusLabel(status) { return ({ received: 'התקבל', under_review: 'בטיפול', in_progress: 'בטיפול', answered: 'נענה', resolved: 'טופל', closed: 'נסגר' })[status ?? 'received'] ?? 'בטיפול'; }
async function run(config = {}) {
  pageCalls++; const queries = [], logs = [], badgeCalls = []; let clients = 0;
  const failed = new Set(config.fail ?? []), method = config.method ?? 'error', payload = config.payload ?? healthy;
  const pure = evaluate(pureJs, {}, { console: { warn(...args) { logs.push(args); } } });
  const originalBadge = pure.trustBadgeLabel;
  const domain = { parentTrustTone: pure.parentTrustTone, trustBadgeLabel(value) { badgeCalls.push(value); return originalBadge(value); } };
  const profile = { role: config.role ?? 'manager', garden_id: config.garden === undefined ? 'garden-qa' : config.garden, full_name: '[DEMO] Owner QA', profile_image_url: null }, denied = Error('DENIED_ROLE');
  const sdk = { createClient: async () => {
    clients++; if (config.clientThrow) throw Error('PRIVATE_CLIENT');
    return { from(table) {
      const index = names.indexOf(table); assert(index >= 0); const q = { table, steps: [] }; queries.push(q);
      if (failed.has(index) && method === 'builder') throw Error('PRIVATE_BUILDER');
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          if (failed.has(index) && method === 'reject') return Promise.reject(Error('PRIVATE_REJECTION')).then(resolve, reject);
          const stale = index < 2 ? { trust_score: 999, transparency_score: 999, trust_badge_status: 'certified', gardens: { name: 'STALE' } } : [{ id: 'STALE', title: 'STALE', lifecycle_status: 'received', published: true, status: 'active', period_start: 'STALE', period_end: 'STALE' }];
          return Promise.resolve({ data: failed.has(index) ? stale : payload[index], error: failed.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'or', 'order', 'limit', 'maybeSingle'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherActionTile', 'TeacherAiInsight', 'TeacherAppFrame', 'TeacherCompactItem', 'TeacherCompactList', 'TeacherEmptyState', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link', __esModule: true }, 'lucide-react': Object.fromEntries(['CalendarDays', 'HeartHandshake', 'Megaphone', 'MessageSquareWarning', 'ShieldCheck', 'Sparkles'].map((n) => [n, n])), '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' }, '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui, '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } }, '@/lib/supabase/server': sdk, '@/lib/domain/parent-trust': domain, '@/lib/admin-safe': { safeAdminData: pure.safeAdminData, logSupabaseError: pure.logSupabaseError } };
  const page = evaluate(pageJs, imports).default;
  if (config.denied) { await assert.rejects(page, (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); assert.equal(badgeCalls.length, 0); return { denied: true }; }
  const tree = await page(), scoped = Boolean(profile.garden_id) && !config.clientThrow, available = names.map((_, i) => scoped && !failed.has(i));
  assert.equal(clients, profile.garden_id ? 1 : 0); assert.equal(queries.length, scoped ? 8 : 0);
  for (const q of queries) {
    if (failed.has(names.indexOf(q.table)) && method === 'builder') continue;
    if (q.table === names[6]) assert.equal(q.steps.find((s) => s[0] === 'or')[1], 'garden_id.eq.garden-qa,garden_id.is.null');
    else assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'garden_id' && s[2] === 'garden-qa'));
  }
  const cards = nodes(tree, 'TeacherStatCard');
  if (!profile.garden_id) { assert.equal(cards.length, 0); assert.equal(nodes(tree, 'TeacherAiInsight').length, 0); assert.equal(nodes(tree, 'TeacherEmptyState').length, 0); assert.equal(badgeCalls.length, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); return { clients, queries: 0 }; }
  const data = payload.map((value, i) => available[i] ? value ?? (i < 2 ? {} : []) : (i < 2 ? {} : []));
  const [trust, transparency, feedback, requests, announcements, calendar, surveys, reports] = data;
  const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props])); assert.equal(cards.length, 4);
  const tone = (v) => { const t = pure.parentTrustTone(typeof v === 'number' ? v : Number(v ?? 0)); return t === 'bad' ? 'red' : t === 'warn' ? 'orange' : 'green'; };
  for (const [title, i, value] of [['אמון', 0, trust.trust_score], ['שקיפות', 1, transparency.transparency_score]]) { assert.equal(stats[title].value, available[i] ? `${value ?? 0}/100` : 'לא זמין'); assert.equal(stats[title].tone, available[i] ? tone(value) : 'neutral'); }
  assert.equal(badgeCalls.length, available[0] ? 1 : 0); assert.equal(stats['אמון'].hint, available[0] ? originalBadge(trust.trust_badge_status) : 'תג האמון לא זמין');
  assert.equal(nodes(tree, 'TeacherAppFrame')[0].props.subtitle, available[0] ? trust.gardens?.name ?? 'אמון ושקיפות' : 'שם הגן לא זמין');
  const hero = !available[1] ? null : transparency.transparency_score != null ? Number(transparency.transparency_score) : available[0] ? Number(trust.trust_score ?? 0) : null;
  assert.equal(nodes(tree, 'TeacherAiInsight')[0].props.metric, hero === null ? 'לא זמין' : `${hero}/100`);
  const bothContacts = available[2] && available[3], count = feedback.filter((i) => !['resolved', 'closed'].includes(String(i.lifecycle_status))).length + requests.filter((i) => !['answered', 'closed'].includes(String(i.lifecycle_status))).length;
  assert.equal(stats['פניות פתוחות'].value, bothContacts ? count : 'לא זמין'); assert.equal(stats['פניות פתוחות'].tone, !bothContacts ? 'neutral' : count ? 'orange' : 'green');
  const contacts = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'משוב ובקשות הורים'), contactRows = nodes(contacts, 'TeacherCompactItem'), expectedContacts = [...feedback, ...requests].slice(0, 8);
  assert.deepEqual(contactRows.map((n) => n.props.title), expectedContacts.map((r) => r.title));
  for (let i = 0; i < contactRows.length; i++) { const row = expectedContacts[i], p = contactRows[i].props; assert.equal(p.subtitle, date(row.created_at)); assert.equal(p.meta, statusLabel(row.lifecycle_status)); assert.equal(p.tone, ['resolved', 'closed'].includes(String(row.lifecycle_status)) ? 'green' : 'orange'); }
  if (!bothContacts) { assert(nodes(contacts, 'AdminDataError')[0].props.message); assert(!text(contacts).includes('אין עדיין פניות אמון')); }
  else if (!expectedContacts.length) assert(text(contacts).includes('אין עדיין פניות אמון'));
  assert.equal(stats['הודעות קהילה'].value, available[4] ? announcements.length : 'לא זמין'); assert.equal(stats['הודעות קהילה'].tone, available[4] ? 'purple' : 'neutral');
  const feed = nodes(tree, 'TeacherSection').find((n) => n.props.title === 'הודעות קהילה'), feedRows = nodes(feed, 'TeacherCompactItem');
  assert.deepEqual(feedRows.map((n) => n.props.title), announcements.slice(0, 6).map((r) => r.title));
  for (let i = 0; i < feedRows.length; i++) { const row = announcements[i], p = feedRows[i].props; assert.equal(p.subtitle, row.published ? `פורסם ${date(row.published_at)}` : 'טיוטה'); assert.equal(p.tone, row.published ? 'green' : 'purple'); assert.equal(p.meta, row.announcement_type); }
  if (!available[4]) { assert(text(feed).includes('לא זמי')); assert(!text(feed).includes('אין הודעות קהילה')); }
  const metrics = Object.fromEntries(nodes(nodes(tree, 'TeacherSection').find((n) => n.props.title === 'סקרים, אירועים ודוחות'), 'TeacherCompactItem').map((n) => [n.props.title, n.props]));
  for (const [title, i, rows, healthyTone] of [['סקרים פעילים', 6, surveys, surveys.some((s) => s.status === 'active') ? 'green' : 'orange'], ['אירועי קהילה', 5, calendar, 'blue'], ['דוחות אמון', 7, reports, 'purple']]) { assert.equal(metrics[title].meta, available[i] ? rows.length : 'לא זמין'); assert.equal(metrics[title].tone, available[i] ? healthyTone : 'neutral'); }
  assert.equal(metrics['סקרים פעילים'].subtitle, available[6] ? 'מדידת שביעות רצון ואמון' : 'הסקרים לא זמינים');
  assert.equal(metrics['אירועי קהילה'].subtitle, !available[5] ? 'אירועי הקהילה לא זמינים' : calendar[0] ? `${calendar[0].title} · ${date(calendar[0].starts_at)}` : 'אין אירועים קרובים');
  assert.equal(metrics['דוחות אמון'].subtitle, !available[7] ? 'דוחות האמון לא זמינים' : reports[0] ? `${date(reports[0].period_start)} - ${date(reports[0].period_end)}` : 'טרם הופקו דוחות');
  if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message);
  assert(!text(tree).includes('STALE')); assert(!JSON.stringify(logs).includes('PRIVATE_')); assert.equal(nodes(tree, 'TeacherActionTile').length, 4); assert.equal(nodes(tree, 'TeacherAppFrame')[0].props.title, 'בוקר טוב, Owner'); assert(text(nodes(tree, 'TeacherAiInsight')).includes('חקירות פנימיות'));
  return { clients, queries: queries.length, hero: hero === null ? 'UNAVAILABLE' : hero, contactCount: bothContacts ? count : 'UNAVAILABLE' };
}
async function test(id, config = {}) { const result = await run(config); results.push({ id, status: 'PASS', ...result }); }
const started = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("parent_trust_profiles" as any).select("*, gardens(name,city)").eq("garden_id", gardenId).maybeSingle()',
    'supabase.from("parent_transparency_scores" as any).select("*").eq("garden_id", gardenId).order("calculated_at", { ascending: false }).limit(1).maybeSingle()',
    'supabase.from("parent_feedback_items" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(12)',
    'supabase.from("parent_request_center_items" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(12)',
    'supabase.from("community_announcements" as any).select("*").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(10)',
    'supabase.from("community_calendar_events" as any).select("*").eq("garden_id", gardenId).order("starts_at", { ascending: true }).limit(10)',
    'supabase.from("parent_surveys" as any).select("*").or(`garden_id.eq.${gardenId},garden_id.is.null`).order("created_at", { ascending: false }).limit(8)',
    'supabase.from("parent_trust_reports" as any).select("*").eq("garden_id", gardenId).order("period_end", { ascending: false }).limit(6)'
  ];
  walk(pageAst, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['limit', 'maybeSingle'].includes(n.expression.name.text) && !(ts.isPropertyAccessExpression(n.parent) && ts.isCallExpression(n.parent.parent))) chains.push(shape(n)); });
  assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!gardenId)') < source.indexOf('await createClient()')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 9);
  results.push({ id: 'static-eight-whole-chains-singletons-survey-OR-admission-pure', status: 'PASS', selected });
  await test('healthy-manager'); await test('healthy-owner', { role: 'owner' }); await test('healthy-empty', { payload: empty() }); await test('healthy-null', { payload: names.map(() => null) });
  for (let i = 0; i < 8; i++) for (const method of ['error', 'reject', 'builder']) await test(`${names[i]}-${method}`, { fail: [i], method });
  await test('all-failed', { fail: [0, 1, 2, 3, 4, 5, 6, 7] }); await test('all-rejected', { fail: [0, 1, 2, 3, 4, 5, 6, 7], method: 'reject' }); await test('client-throw', { clientThrow: true });
  await test('missing-null', { garden: null }); await test('missing-empty', { garden: '' }); await test('denied-role', { denied: true });
  await test('hero-zero-authoritative-with-trust-failed', { payload: override({ 1: { transparency_score: 0 } }), fail: [0] });
  await test('hero-positive-authoritative-with-trust-failed', { payload: override({ 1: { transparency_score: 65 } }), fail: [0] });
  await test('hero-null-transparency-fallback', { payload: override({ 1: { transparency_score: null } }) });
  await test('hero-absent-transparency-fallback', { payload: override({ 1: {} }) });
  await test('hero-null-transparency-trust-failed', { payload: override({ 1: { transparency_score: null } }), fail: [0] });
  await test('hero-absent-transparency-trust-failed', { payload: override({ 1: {} }), fail: [0] });
  await test('hero-null-scores-both-healthy-zero', { payload: override({ 0: { trust_score: null }, 1: { transparency_score: null } }) });
  await test('feedback-failed-empty-requests', { payload: override({ 3: [] }), fail: [2] }); await test('requests-failed-empty-feedback', { payload: override({ 2: [] }), fail: [3] });
  await test('both-contact-sources-failed', { fail: [2, 3] });
  await test('both-contact-sources-healthy-empty', { payload: override({ 2: [], 3: [] }) });
  await test('feedback-healthy-requests-empty', { payload: override({ 3: [] }) }); await test('requests-healthy-feedback-empty', { payload: override({ 2: [] }) });
  await test('inactive-surveys-invalid-calendar-date-empty-reports', { payload: override({ 6: [{ status: 'closed' }], 5: [{ title: 'undated', starts_at: 'invalid' }], 7: [] }) });
  assert.equal(forbidden, 0);
  console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - started, selected, results, limitations: 'Synthetic actual page with selected pure functions/opaque UI/closed SDK Auth; not browser/full-stack/RLS/parent/legal/privacy/certification proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
