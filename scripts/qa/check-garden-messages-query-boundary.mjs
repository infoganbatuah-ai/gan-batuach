import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Actual page + exactly two pure safe functions; all client components/actions opaque.
const root = process.cwd(), ts = createRequire(path.join(root, 'package.json'))('typescript');
const pageFile = 'app/dashboard/garden/messages/page.tsx';
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
const selected = safeAst.statements.filter((n) => ts.isFunctionDeclaration(n) && selectedNames.includes(n.name?.text)); assert.deepEqual(selected.map((n) => n.name.text), selectedNames); assert.equal(selected.length, 2);
for (const n of selected) walk(n, (node) => { assert(!ts.isImportDeclaration(node)); if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval', 'createClient'].includes(node.text)); });
const source = read(pageFile), ast = parse(source, pageFile);
const compile = (s, fileName) => ts.transpileModule(s, { fileName, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const safeJs = compile(selected.map((n) => n.getText(safeAst)).join('\n'), 'safe.ts'), pageJs = compile(source, pageFile);
const names = ['parents', 'staff', 'children', 'messages', 'parent_child_requests'], fields = ['parents', 'staff', 'linkedChildren', 'messages', 'parentRequests'];
const parents = [...Array.from({ length: 8 }, (_, i) => ({ profiles: { id: `SYNTHETIC_PARENT_${i % 3}`, full_name: `SYNTHETIC_PARENT_NAME_${i}`, email: `synthetic-${i}@qa.invalid`, role: 'parent', profile_image_url: null } })), { profiles: null }];
const staff = [{ profiles: { id: 'SYNTHETIC_STAFF', full_name: 'SYNTHETIC_STAFF_NAME', role: 'staff' } }, { profiles: parents[0].profiles }, {}];
const children = [...Array.from({ length: 8 }, (_, i) => ({ id: `SYNTHETIC_CHILD_${i}`, full_name: `SYNTHETIC_CHILD_NAME_${i}`, primary_parent_id: `SYNTHETIC_PARENT_ROW_${i}`, parents: { profile_id: i === 0 ? 'SYNTHETIC_FIRST_PARENT' : `SYNTHETIC_PARENT_${i}` } })), { id: 'SYNTHETIC_CHILD_0', full_name: 'SYNTHETIC_DUPLICATE_CHILD', parents: { profile_id: 'SYNTHETIC_SECOND_PARENT' } }];
const messageStatuses = ['new', 'closed', 'handled', 'archived', 'read', 'viewed', 'in_progress', null, undefined, 'OPEN', 'read', 'new', new String('read')];
const requestStatuses = ['new', 'viewed', 'in_progress', 'handled', 'rejected', 'read', null, undefined, 'new', 'viewed', 'in_progress', 'new', new String('new')];
const messages = messageStatuses.map((status, i) => ({ id: `SYNTHETIC_MESSAGE_${i}`, status, sender: i === 2 ? null : { full_name: `SYNTHETIC_SENDER_${i}` }, recipient: { full_name: 'SYNTHETIC_RECIPIENT' }, body: i === 0 ? '' : i === 2 ? null : `SYNTHETIC_BODY_${i}`, content: i === 2 ? null : `SYNTHETIC_CONTENT_${i}` }));
const requests = requestStatuses.map((status, i) => ({ id: `SYNTHETIC_REQUEST_${i}`, child_id: `SYNTHETIC_CHILD_${i}`, parent_profile_id: 'SYNTHETIC_PARENT', status, request_type: i === 6 ? null : `SYNTHETIC_TYPE_${i}`, content: i === 6 ? null : i === 0 ? '' : `SYNTHETIC_REQUEST_CONTENT_${i}`, recipient_label: i === 2 ? null : 'SYNTHETIC_MANAGER', response_text: i % 2 ? `SYNTHETIC_RESPONSE_${i}` : '', created_at: i === 3 ? null : '2026-11-05T12:00:00.000Z', children: i === 6 ? null : { full_name: `SYNTHETIC_CHILD_NAME_${i}` }, parents: i === 6 ? null : { full_name: `SYNTHETIC_PARENT_NAME_${i}`, phone: 'SYNTHETIC_PHONE' } }));
const healthy = [parents, staff, children, messages, requests]; let forbidden = 0, pageCalls = 0; const results = [];
function evaluate(js, imports, extra = {}) { const module = { exports: {} }; vm.runInNewContext(js, { ...extra, module, exports: module.exports, require(n) { if (Object.hasOwn(imports, n)) return imports[n]; forbidden++; throw Error('CLOSED_IMPORT'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } }); return module.exports; }
function nodes(tree, type) { const out = []; function visit(n) { if (Array.isArray(n)) return n.forEach(visit); if (n && typeof n === 'object') { if (n.type === type) out.push(n); visit(n.props?.children); } } visit(tree); return out; }
function text(n) { if (Array.isArray(n)) return n.map(text).join(' '); if (n && typeof n === 'object') return [n.props?.title, n.props?.text, n.props?.message, n.props?.subtitle, n.props?.hint, n.props?.value, text(n.props?.children)].filter((v) => v !== undefined).join(' '); return typeof n === 'string' || typeof n === 'number' ? String(n) : ''; }
async function run(config = {}) {
  pageCalls++; const queries = [], logs = [], captured = []; let clients = 0;
  const pure = evaluate(safeJs, {}, { console: { warn(...args) { logs.push(args); } } });
  const safe = { logSupabaseError: pure.logSupabaseError, safeAdminData(label, loader, fallback) { return pure.safeAdminData(label, async () => { const data = await loader(); captured.push(data); return data; }, fallback); } };
  const fail = new Set(config.fail ?? []), method = config.method ?? 'error', payload = config.payload ?? healthy;
  const profile = { id: config.profile === undefined ? 'profile-qa' : config.profile, garden_id: config.garden === undefined ? 'garden-qa' : config.garden, role: config.role ?? 'manager', full_name: '[DEMO] Owner QA', profile_image_url: 'SYNTHETIC_AVATAR' }, denied = Error('DENIED');
  const sdk = { createClient: async () => {
    clients++; if (config.clientThrow) throw Error('PRIVATE_CLIENT');
    return { from(table) {
      const index = names.indexOf(table); assert(index >= 0); const q = { table, steps: [] }; queries.push(q); if (fail.has(index) && method === 'builder') throw Error('PRIVATE_BUILDER');
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          if (fail.has(index) && method === 'reject') return Promise.reject(Error('PRIVATE_REJECT')).then(resolve, reject);
          const stale = method === 'error-empty' ? [] : index < 2 ? [{ profiles: { id: 'STALE', full_name: 'STALE', role: 'parent' } }] : index === 2 ? [{ id: 'SYNTHETIC_CHILD_0', full_name: 'STALE', parents: { profile_id: 'STALE' } }] : index === 3 ? [{ id: 'STALE', body: 'STALE', sender: { full_name: 'STALE' } }] : [{ id: 'STALE', child_id: 'STALE', content: 'STALE', response_text: 'STALE', status: 'new' }];
          return Promise.resolve({ data: fail.has(index) ? stale : payload[index], error: fail.has(index) ? { message: 'PRIVATE_RETURNED' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'order', 'or', 'limit'].includes(key)); return (...args) => { q.steps.push([key, ...args]); return chain; };
      } }); return chain;
    } };
  } };
  const ui = Object.fromEntries(['TeacherActionTile', 'TeacherAppFrame', 'TeacherCompactItem', 'TeacherCompactList', 'TeacherEmptyState', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid'].map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = { 'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': Object.fromEntries(['MessageCircle', 'MessageSquareText', 'Send', 'UserRound'].map((n) => [n, n])), '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' }, '@/components/dashboard-filter-chip': { DashboardFilterChip: 'DashboardFilterChip_OPAQUE' }, '@/components/internal-messaging-center': { InternalMessagingCenter: 'InternalMessagingCenter_OPAQUE' }, '@/components/parent-request-actions': { ParentRequestActions: 'ParentRequestActions_OPAQUE' }, '@/components/admin-data-state': { AdminDataError: 'AdminDataError' }, '@/components/teacher-app-ui': ui, '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile }; } }, '@/lib/supabase/server': sdk, '@/lib/admin-safe': safe };
  const page = evaluate(pageJs, imports).default, params = { childId: config.childId === undefined ? 'SYNTHETIC_CHILD_0' : config.childId, status: config.status, compose: config.compose }, args = { searchParams: Promise.resolve(params) };
  if (config.denied) { await assert.rejects(() => page(args), (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); return { denied: true, editorCount: 0, actionCount: 0 }; }
  const tree = await page(args), validContext = Boolean(profile.id && profile.garden_id), scoped = validContext && !config.clientThrow, available = names.map((_, i) => scoped && !fail.has(i));
  assert.equal(clients, validContext ? 1 : 0); assert.equal(queries.length, scoped ? 5 : 0);
  for (const q of queries) { const i = names.indexOf(q.table); if (fail.has(i) && method === 'builder') continue; assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'eq')), JSON.stringify(['eq', 'garden_id', 'garden-qa'])); if (i === 3) assert.equal(q.steps.find((s) => s[0] === 'or')[1], 'sender_id.eq.profile-qa,recipient_id.eq.profile-qa'); if (i >= 3) { assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'limit')), JSON.stringify(['limit', 80])); assert.equal(JSON.stringify(q.steps.find((s) => s[0] === 'order')), JSON.stringify(['order', 'created_at', { ascending: false }])); } }
  const frame = nodes(tree, 'TeacherAppFrame')[0], shell = nodes(tree, 'DashboardShell')[0]; assert.equal(shell.props.role, 'manager'); assert.equal(shell.props.title, 'הודעות'); assert.equal(shell.props.appHome, true); assert.equal(frame.props.title, 'בוקר טוב, Owner'); assert.equal(frame.props.subtitle, 'הודעות ותקשורת גננת'); assert.equal(frame.props.avatarUrl, 'SYNTHETIC_AVATAR'); assert.equal(frame.props.active, 'messages');
  const editors = nodes(tree, 'InternalMessagingCenter_OPAQUE'), actions = nodes(tree, 'ParentRequestActions_OPAQUE'), chips = nodes(tree, 'DashboardFilterChip_OPAQUE'), cards = nodes(tree, 'TeacherStatCard');
  if (!validContext) { assert.equal(editors.length, 0); assert.equal(actions.length, 0); assert.equal(chips.length, 0); assert.equal(cards.length, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); return { clients, queries: 0, editorCount: 0, actionCount: 0 }; }
  const data = payload.map((p, i) => available[i] ? p ?? [] : []);
  if (scoped) { assert.equal(captured.length, 1); for (let i = 0; i < 5; i++) assert.equal(JSON.stringify(captured[0][fields[i]]), JSON.stringify(data[i])); } else assert.equal(captured.length, 0);
  const expectedRecipients = [...data[0].map((r) => r.profiles).filter(Boolean), ...data[1].map((r) => r.profiles).filter(Boolean)];
  const expectedMessages = data[3].filter((m) => config.status !== 'open' || !['closed', 'handled', 'archived', 'read'].includes(m.status));
  const expectedRequests = data[4].filter((r) => config.status !== 'open' || ['new', 'viewed', 'in_progress'].includes(String(r.status)));
  const recipientsAvailable = available[0] && available[1], editorAvailable = recipientsAvailable && available[2] && available[3];
  const stats = Object.fromEntries(cards.map((n) => [n.props.title, n.props])); assert.equal(cards.length, 4);
  assert.equal(stats['הודעות'].value, available[3] ? expectedMessages.length : 'לא זמין'); assert.equal(stats['הודעות'].tone, available[3] ? 'blue' : 'neutral'); assert.equal(stats['הודעות'].hint, 'אחרונות');
  assert.equal(stats['פניות הורים'].value, available[4] ? expectedRequests.length : 'לא זמין'); assert.equal(stats['פניות הורים'].tone, !available[4] ? 'neutral' : expectedRequests.length ? 'orange' : 'green'); assert.equal(stats['פניות הורים'].hint, 'לטיפול');
  assert.equal(stats['נמענים'].value, recipientsAvailable ? expectedRecipients.length : 'לא זמין'); assert.equal(stats['נמענים'].tone, recipientsAvailable ? 'purple' : 'neutral'); assert.equal(stats['נמענים'].hint, 'זמינים');
  assert.equal(stats['ילדים מקושרים'].value, available[2] ? data[2].length : 'לא זמין'); assert.equal(stats['ילדים מקושרים'].tone, available[2] ? 'green' : 'neutral'); assert.equal(stats['ילדים מקושרים'].hint, 'לשיחה');
  assert.equal(chips.length, available[3] && available[4] ? 1 : 0);
  if (chips.length) { const p = chips[0].props; assert.equal(p.label, config.status === 'open' ? 'הודעות / פניות פתוחות' : null); assert.equal(p.clearHref, '/dashboard/garden/messages'); assert.equal(p.isEmpty, expectedMessages.length === 0 && expectedRequests.length === 0); assert.equal(p.emptyTitle, 'אין כרגע הודעות פתוחות'); assert.equal(p.emptyText, 'כל ההודעות והפניות במסנן הזה טופלו או נקראו.'); } else { assert(text(tree).includes('נתוני הסינון לא זמינים')); assert(!text(tree).includes('כל ההודעות והפניות במסנן הזה טופלו או נקראו.')); }
  const sections = nodes(tree, 'TeacherSection'), requestSection = sections.find((n) => n.props.title === 'פניות אחרונות'), messageSection = sections.find((n) => n.props.title === 'שיחות אחרונות'); assert(requestSection && messageSection); assert.equal(requestSection.props.action.props.href, '/dashboard/garden/messages?status=open');
  const requestRows = nodes(requestSection, 'TeacherCompactItem'), messageRows = nodes(messageSection, 'TeacherCompactItem'); assert.equal(requestRows.length, available[4] ? Math.min(6, expectedRequests.length) : 0); assert.equal(messageRows.length, available[3] ? Math.min(6, expectedMessages.length) : 0);
  for (let i = 0; i < requestRows.length; i++) { const r = expectedRequests[i], p = requestRows[i].props; assert.equal(requestRows[i].key, r.id); assert.equal(p.title, `${r.request_type ?? 'פנייה'} · ${r.children?.full_name ?? 'ילד/ה'}`); assert.equal(p.subtitle, r.content ?? 'אין תוכן'); assert.equal(p.tone, ['new', 'viewed', 'in_progress'].includes(String(r.status)) ? 'orange' : 'green'); assert.equal(p.meta, r.status ?? 'חדש'); }
  for (let i = 0; i < messageRows.length; i++) { const m = expectedMessages[i], p = messageRows[i].props; assert.equal(messageRows[i].key, m.id); assert.equal(p.title, m.sender?.full_name ?? 'הודעה'); assert.equal(p.subtitle, m.body ?? m.content ?? 'הודעה'); assert.equal(p.tone, 'blue'); assert.equal(p.meta, m.status ?? 'נשלח'); }
  if (!available[4]) { assert(text(requestSection).includes('הפניות לא זמינות')); assert(!text(requestSection).includes('אין פניות פתוחות')); } else if (!expectedRequests.length) assert(text(requestSection).includes('אין פניות פתוחות'));
  if (!available[3]) { assert(text(messageSection).includes('השיחות לא זמינות')); assert(!text(messageSection).includes('אין הודעות להצגה')); } else if (!expectedMessages.length) assert(text(messageSection).includes('אין הודעות להצגה'));
  const workbench = nodes(tree, 'section').find((n) => n.props.id === 'message-workbench'); assert(workbench); assert.equal(editors.length, editorAvailable ? 1 : 0);
  if (editorAvailable) { const p = editors[0].props; assert.equal(p.gardenId, profile.garden_id); assert.equal(p.currentProfileId, profile.id); assert.equal(JSON.stringify(p.recipients), JSON.stringify(expectedRecipients)); assert.equal(JSON.stringify(p.linkedChildren), JSON.stringify(data[2])); assert.equal(JSON.stringify(p.messages), JSON.stringify(expectedMessages)); assert.equal(p.preselectedChildId, params.childId); assert.equal(p.preselectedRecipientId, data[2].find((c) => c.id === params.childId)?.parents?.profile_id); assert.equal(p.defaultOpen, config.compose === '1'); if (config.firstParent) assert.equal(p.preselectedRecipientId, 'SYNTHETIC_FIRST_PARENT'); } else assert(text(workbench).includes('עורך ההודעות לא זמין'));
  const details = nodes(tree, 'details')[0]; assert.equal(details.props.className, 'teacher-management-details'); assert.equal(nodes(details, 'summary')[0].props.children, 'פניות הורים רשמיות'); const articles = nodes(details, 'article'); assert.equal(articles.length, available[4] ? expectedRequests.length : 0); assert.equal(actions.length, available[4] ? expectedRequests.length : 0);
  for (let i = 0; i < articles.length; i++) { const r = expectedRequests[i], article = articles[i]; assert.equal(article.key, r.id); const spans = nodes(article, 'span'), ps = nodes(article, 'p'); assert.equal(spans[0].props.className, r.status === 'handled' ? 'pill good' : r.status === 'rejected' ? 'pill bad' : 'pill warn'); assert.equal(spans[0].props.children, r.status ?? 'new'); assert.equal(text(nodes(article, 'h3')[0]).replace(/\s+/g, ' ').trim(), `${r.request_type ?? 'פניית הורה'} · ${r.children?.full_name ?? 'ילד/ה'}`); assert.equal(ps[0].props.children, r.content); assert.equal(ps.length, r.response_text ? 2 : 1); if (r.response_text) assert(text(ps[1]).includes(r.response_text)); assert.equal(actions[i].props.childId, r.child_id); assert.equal(actions[i].props.requestId, r.id); assert(text(nodes(article, 'small')[0]).includes(r.parents?.full_name ?? 'הורה')); if (r.created_at) assert(text(nodes(article, 'small')[0]).includes(new Date(r.created_at).toLocaleString('he-IL'))); }
  if (!available[4]) { assert(text(details).includes('פניות ההורים לא זמינות')); assert(!text(details).includes('אין פניות הורים פתוחות')); } else if (!expectedRequests.length) assert(text(details).includes('אין פניות הורים פתוחות'));
  const tiles = nodes(tree, 'TeacherActionTile'); assert.deepEqual(tiles.map((n) => n.props.href), ['/dashboard/garden/messages?compose=1#message-workbench', '/dashboard/garden/messages?status=open']); assert.deepEqual(tiles.map((n) => n.props.title), ['שליחת הודעה', 'פניות פתוחות']); assert.equal(nodes(tree, 'TeacherPageTitle')[0].props.title, 'הודעות ותקשורת');
  if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message); assert(!text(tree).includes('STALE')); assert(!JSON.stringify(logs).includes('PRIVATE_')); assert(!JSON.stringify(logs).includes('SYNTHETIC_')); assert(!JSON.stringify(logs).includes('profile-qa')); assert(!JSON.stringify(logs).includes('garden-qa'));
  if (config.expectedCounts) assert.deepEqual([expectedMessages.length, expectedRequests.length, expectedRecipients.length, data[2].length], config.expectedCounts);
  return { clients, queries: queries.length, available, editorCount: editors.length, actionCount: actions.length, messageRows: messageRows.length, requestRows: requestRows.length, filteredMessages: available[3] ? expectedMessages.length : 'UNKNOWN', filteredRequests: available[4] ? expectedRequests.length : 'UNKNOWN' };
}
async function test(id, config = {}) { results.push({ id, status: 'PASS', ...await run(config) }); }
const start = performance.now();
try {
  const chains = [], expected = [
    'supabase.from("parents" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId)',
    'supabase.from("staff" as any).select("profiles:profile_id(id, full_name, email, role, profile_image_url)").eq("garden_id", gardenId)',
    'supabase.from("children" as any).select("id, full_name, primary_parent_id, parents:primary_parent_id(profile_id)").eq("garden_id", gardenId).order("full_name")',
    'supabase.from("messages" as any).select("*, sender:sender_id(full_name, profile_image_url), recipient:recipient_id(full_name, profile_image_url)").eq("garden_id", gardenId).or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).order("created_at", { ascending: false }).limit(80)',
    'supabase.from("parent_child_requests" as any).select("id, child_id, parent_profile_id, request_type, content, recipient_label, status, response_text, created_at, children(full_name), parents:parent_id(full_name, phone)").eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(80)'
  ];
  walk(ast, (n) => { if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ['eq', 'order', 'limit'].includes(n.expression.name.text) && !(ts.isPropertyAccessExpression(n.parent) && ts.isCallExpression(n.parent.parent))) chains.push(shape(n)); }); assert.deepEqual(chains, expected.map((s) => shape(parse(s).statements[0].expression)));
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData')); assert(source.indexOf('if (!profile.id || !profile.garden_id)') < source.indexOf('await createClient()')); assert(source.includes('const { childId, status, compose } = await searchParams;')); assert.equal((source.match(/\bas any\b/g) ?? []).length, 6);
  results.push({ id: 'static-five-whole-chains-context-admission-pure-boundary', status: 'PASS', selected: selectedNames, actualClientActionsExecuted: false });
  await test('healthy-manager-full-order-duplicates-first-child', { firstParent: true, expectedCounts: [13, 13, 10, 9] }); await test('healthy-owner-compose-open', { role: 'owner', compose: '1', status: 'open', firstParent: true, expectedCounts: [8, 8, 10, 9] });
  await test('unknown-status-default-compose', { status: 'other', compose: '0' }); await test('unknown-child-no-recipient', { childId: 'SYNTHETIC_MISSING_CHILD', compose: '1' }); await test('empty-child', { childId: '' });
  for (const status of [undefined, 'open']) {
    await test(`healthy-empty-${status ?? 'all'}`, { status, payload: [[], [], [], [], []] }); await test(`healthy-null-${status ?? 'all'}`, { status, payload: [null, null, null, null, null] });
    const failSets = [[0], [1], [2], [3], [4], ...[0, 1, 2, 3, 4].flatMap((i) => [0, 1, 2, 3, 4].filter((j) => j > i).map((j) => [i, j])), [0, 1, 2, 3, 4]];
    for (const fail of failSets) for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`failed-${fail.join('-')}-${method}-${status ?? 'all'}`, { fail, method, status, compose: '1' });
    for (let i = 0; i < 5; i++) for (const method of ['error', 'error-empty', 'reject', 'builder']) await test(`failed-${names[i]}-healthy-empty-counterparts-${method}-${status ?? 'all'}`, { fail: [i], method, status, payload: [[], [], [], [], []] });
    await test(`client-throw-${status ?? 'all'}`, { status, clientThrow: true });
  }
  for (const field of ['profile', 'garden']) for (const value of [null, '']) await test(`missing-${field}-${value === null ? 'null' : 'empty'}`, { [field]: value }); await test('denied-role', { denied: true });
  await test('healthy-open-filter-legitimately-all-handled', { status: 'open', payload: [parents, staff, children, [{ id: 'SYNTHETIC_CLOSED', status: 'closed' }], [{ id: 'SYNTHETIC_HANDLED', child_id: 'SYNTHETIC_CHILD_0', status: 'handled' }]] });
  assert.equal(forbidden, 0); console.log(JSON.stringify({ status: 'PASS', cases: results.length, actualPageCalls: pageCalls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - start, selected: selectedNames, actualClientActionsExecuted: false, results, limitations: 'Actual page+2 selected pure safe functions; all client components/actions/filter/UI OPAQUE; SDK/Auth CLOSED. No real messages/recipients/requests/children or send/reply/save/markread/backend/provider/browser/fullstack/RLS proof.' }, null, 2));
} catch (error) { console.log(JSON.stringify({ status: 'FAIL', passedCases: results.length, actualPageCalls: pageCalls, forbiddenEffects: forbidden, results, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1; }
