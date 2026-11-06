import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Synthetic server-page qualification: opaque UI, closed SDK/Auth, no live backend.
const root = process.cwd();
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const pagePath = 'app/dashboard/garden/compliance/page.tsx';
function read(relative) {
  const file = path.join(root, relative);
  assert.equal(Number(execFileSync('/usr/bin/stat', ['-f', '%f', file], { encoding: 'utf8' }).trim()) & 0x40000000, 0);
  return fs.readFileSync(file, 'utf8');
}
const source = read(pagePath);
const domainSource = read('lib/domain/smart-compliance.ts');
const safeSource = read('lib/admin-safe.ts');
const sf = ts.createSourceFile(pagePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const parse = (s) => ts.createSourceFile('contract.ts', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
function walk(node, fn) { fn(node); ts.forEachChild(node, (child) => walk(child, fn)); }
function pureBoundary(text) {
  const file = parse(text);
  for (const item of file.statements) {
    assert(ts.isFunctionDeclaration(item) || ts.isTypeAliasDeclaration(item) || ts.isVariableStatement(item));
    if (ts.isVariableStatement(item)) for (const declaration of item.declarationList.declarations) {
      let value = declaration.initializer;
      if (ts.isAsExpression(value)) value = value.expression;
      assert(ts.isArrayLiteralExpression(value) && value.elements.every(ts.isStringLiteral));
    }
  }
  walk(file, (node) => {
    if (ts.isIdentifier(node)) assert(!['process', 'fetch', 'require', 'globalThis', 'window', 'document', 'eval'].includes(node.text));
    assert(!ts.isImportDeclaration(node));
  });
}
pureBoundary(domainSource); pureBoundary(safeSource);
const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX };
const compile = (text, fileName) => ts.transpileModule(text, { compilerOptions: options, fileName }).outputText;
const domainJs = compile(domainSource, 'smart-compliance.ts');
const safeJs = compile(safeSource, 'admin-safe.ts');
const pageJs = compile(source, pagePath);
const fixed = Date.parse('2026-11-06T09:00:00.000Z');
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixed])); }
  static now() { return fixed; }
}
const names = ['documents', 'staff', 'compliance_alerts', 'compliance_corrective_actions', 'national_compliance_findings', 'required_inspections'];
const chains = [
  'supabase.from("documents" as any).select("id,name,document_type,status,expires_at").eq("garden_id", gardenId).order("expires_at", { ascending: true }).limit(120)',
  'supabase.from("staff" as any).select("id,full_name,background_check_status,police_clearance_status,approved_to_work").eq("garden_id", gardenId).limit(160)',
  'supabase.from("compliance_alerts" as any).select("*").eq("garden_id", gardenId).in("alert_status", ["open", "in_progress"]).order("expiration_date", { ascending: true }).limit(80)',
  'supabase.from("compliance_corrective_actions" as any).select("*").eq("garden_id", gardenId).not("status", "in", "(verified,closed,cancelled)").order("due_at", { ascending: true }).limit(80)',
  'supabase.from("national_compliance_findings" as any).select("*").eq("garden_id", gardenId).in("resolution_status", ["open", "in_progress"]).order("due_at", { ascending: true }).limit(80)',
  'supabase.from("required_inspections" as any).select("*").eq("garden_id", gardenId).lt("due_at", nowIso).neq("status", "done").limit(20)'
];
const printer = ts.createPrinter({ removeComments: true });
function canonical(expression) { const f = parse(expression); return printer.printNode(ts.EmitHint.Unspecified, f.statements[0], f); }
const expectedChains = chains.map(canonical);
const scoreContract = `buildComplianceScore({
 totalDocuments: documents.length,
 invalidDocuments: documents.filter((doc) => ["missing", "required", "expired", "rejected"].includes(String(doc.status))).length,
 expiringDocuments: documents.filter((doc) => doc.expires_at && doc.expires_at <= ninetyDays).length,
 totalStaff: staff.length,
 staffIssues: staff.filter((member) => !member.approved_to_work || member.background_check_status !== "valid" || member.police_clearance_status !== "valid").length,
 overdueInspections: overdueInspections.length,
 unresolvedFindings: findings.length + alerts.length,
 missingProcedures: 0,
 policyGaps: 0
})`;
const healthy = [
 Array.from({ length: 10 }, (_, i) => ({ id: `doc${i}`, name: `document${i}`, document_type: 'license', status: i === 0 ? 'expired' : 'valid', expires_at: i === 0 ? '2026-10-01' : '2027-12-01' })),
 [{ approved_to_work: false, background_check_status: 'pending', police_clearance_status: 'valid' }, { approved_to_work: true, background_check_status: 'valid', police_clearance_status: 'valid' }],
 Array.from({ length: 10 }, (_, i) => ({ id: `alert${i}`, title: `alert-title${i}`, expiration_date: i ? null : '2026-11-01', category: 'licenses', severity: 'high' })),
 Array.from({ length: 10 }, (_, i) => ({ id: `action${i}`, action_title: `action-title${i}`, due_at: i ? null : '2026-11-02', priority: 'medium', status: 'open' })),
 [{ id: 'finding1' }, { id: 'finding2' }], [{ id: 'inspection1' }]
];
const records = []; let calls = 0; let forbidden = 0;
function nodes(tree, type) {
  const found = [];
  function visit(n) {
    if (Array.isArray(n)) return n.forEach(visit);
    if (n && typeof n === 'object') { if (n.type === type) found.push(n); visit(n.props?.children); }
  }
  visit(tree); return found;
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (tree && typeof tree === 'object') return [tree.props?.title, tree.props?.text, tree.props?.message, text(tree.props?.children)].filter(Boolean).join(' ');
  return typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '';
}
function evaluate(js, context, allowed = {}) {
  const module = { exports: {} };
  vm.runInNewContext(js, { ...context, module, exports: module.exports, require(name) { if (Object.hasOwn(allowed, name)) return allowed[name]; forbidden++; throw Error('FORBIDDEN_MODULE'); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return module.exports;
}
async function render(config = {}) {
  calls++;
  const logs = [], queries = [], scoreCalls = []; let clients = 0;
  const baseContext = { Date: TestDate, console: { warn(...args) { logs.push(args); } } };
  const domain = evaluate(domainJs, baseContext);
  const originalScore = domain.buildComplianceScore;
  domain.buildComplianceScore = (input) => { scoreCalls.push(input); return originalScore(input); };
  const safe = evaluate(safeJs, baseContext);
  const payload = config.payload ?? healthy;
  const failed = new Set(config.fail ?? []);
  const method = config.method ?? 'error';
  const approved = { role: config.role ?? 'manager', full_name: '[DEMO] Owner QA', garden_id: config.garden === undefined ? 'garden-qa' : config.garden, profile_image_url: null };
  const denied = new Error('DENIED_ROLE');
  const sdk = { createClient: async () => {
    clients++; if (config.clientThrow) throw Error('PRIVATE_CLIENT_DIAGNOSTIC');
    return { from(table) {
      const index = names.indexOf(table); assert(index >= 0); const query = { table, steps: [] }; queries.push(query);
      if (failed.has(index) && method === 'builder') throw Error('PRIVATE_BUILDER_DIAGNOSTIC');
      const chain = new Proxy({}, { get(_, key) {
        if (key === 'then') return (resolve, reject) => {
          if (failed.has(index) && method === 'reject') return Promise.reject(Error('PRIVATE_REJECT_DIAGNOSTIC')).then(resolve, reject);
          const data = failed.has(index) ? [{ id: 'STALE', title: 'STALE', action_title: 'STALE', name: 'STALE' }] : payload[index];
          return Promise.resolve({ data, error: failed.has(index) ? { message: 'PRIVATE_RETURNED_DIAGNOSTIC' } : null }).then(resolve, reject);
        };
        assert(['select', 'eq', 'order', 'limit', 'in', 'not', 'lt', 'neq'].includes(key));
        return (...args) => { query.steps.push([key, ...args]); return chain; };
      } });
      return chain;
    } };
  } };
  const uiNames = ['TeacherActionTile', 'TeacherAiInsight', 'TeacherAppFrame', 'TeacherCompactItem', 'TeacherCompactList', 'TeacherEmptyState', 'TeacherPageTitle', 'TeacherQuickActions', 'TeacherSection', 'TeacherStatCard', 'TeacherStatsGrid'];
  const ui = Object.fromEntries(uiNames.map((n) => [n, n]));
  const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx }, 'next/link': { default: 'Link', __esModule: true },
    'lucide-react': Object.fromEntries(['AlertTriangle', 'BookOpenCheck', 'ClipboardCheck', 'FileText', 'ShieldCheck', 'UserCheck'].map((n) => [n, n])),
    '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' }, '@/components/admin-data-state': { AdminDataError: 'AdminDataError' },
    '@/lib/auth': { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ['manager', 'owner']); if (config.denied) throw denied; return { profile: approved }; } },
    '@/lib/admin-safe': safe, '@/lib/supabase/server': sdk, '@/lib/domain/smart-compliance': domain, '@/components/teacher-app-ui': ui
  };
  const page = evaluate(pageJs, baseContext, imports).default;
  if (config.denied) { await assert.rejects(page, (e) => e === denied); assert.equal(clients, 0); assert.equal(queries.length, 0); return { denied: true }; }
  const tree = await page();
  const scoped = Boolean(approved.garden_id) && !config.clientThrow;
  assert.equal(clients, approved.garden_id ? 1 : 0); assert.equal(queries.length, scoped ? 6 : 0);
  for (const q of queries) {
    assert(q.steps.some((s) => s[0] === 'eq' && s[1] === 'garden_id' && s[2] === 'garden-qa') || (failed.has(names.indexOf(q.table)) && method === 'builder'));
    if (q.table === 'required_inspections' && q.steps.length) assert.equal(q.steps.find((s) => s[0] === 'lt')[2], '2026-11-06T09:00:00.000Z');
  }
  const available = names.map((_, i) => scoped && !failed.has(i));
  const scoreAvailable = [0, 1, 2, 4, 5].every((i) => available[i]);
  assert.equal(scoreCalls.length, scoreAvailable ? 1 : 0);
  const cards = nodes(tree, 'TeacherStatCard'); const insight = nodes(tree, 'TeacherAiInsight');
  if (!approved.garden_id) {
    assert.equal(cards.length, 0); assert.equal(insight.length, 0); assert(nodes(tree, 'AdminDataError')[0].props.message); assert.equal(nodes(tree, 'TeacherEmptyState').length, 0);
  } else {
    assert.equal(cards.length, 4);
    const values = Object.fromEntries(cards.map((c) => [c.props.title, c.props]));
    for (const [title, i] of [['התראות', 2], ['פעולות', 3], ['פיקוח באיחור', 5]]) {
      assert.equal(values[title].value, available[i] ? (payload[i]?.length ?? 0) : 'לא זמין');
      if (!available[i]) assert.equal(values[title].tone, 'neutral');
      else assert.equal(values[title].tone, payload[i]?.length ? ({ 2: 'orange', 3: 'purple', 5: 'red' })[i] : 'green');
    }
    if (scoreAvailable) {
      const p = payload.map((x) => x ?? []);
      const expected = { totalDocuments: p[0].length, invalidDocuments: p[0].filter((d) => ['missing', 'required', 'expired', 'rejected'].includes(String(d.status))).length, expiringDocuments: p[0].filter((d) => d.expires_at && d.expires_at <= '2027-02-04').length, totalStaff: p[1].length, staffIssues: p[1].filter((m) => !m.approved_to_work || m.background_check_status !== 'valid' || m.police_clearance_status !== 'valid').length, overdueInspections: p[5].length, unresolvedFindings: p[4].length + p[2].length, missingProcedures: 0, policyGaps: 0 };
      assert.equal(JSON.stringify(scoreCalls[0]), JSON.stringify(expected));
      const score = originalScore(expected); assert.equal(values['ציון'].value, `${score.score}/100`); assert.equal(insight[0].props.metric, `${score.score}/100`);
      if (config.empty) assert.equal(score.score, 89);
    } else { assert.equal(values['ציון'].value, 'לא זמין'); assert.equal(values['ציון'].tone, 'neutral'); assert.equal(insight[0].props.metric, 'לא זמין'); }
    for (const [title, i, field] of [['מה דורש טיפול', 2, 'title'], ['פעולות תיקון', 3, 'action_title'], ['מסמכים ותוקף', 0, 'name']]) {
      const section = nodes(tree, 'TeacherSection').find((n) => n.props.title === title); assert(section);
      const rows = nodes(section, 'TeacherCompactItem');
      assert.deepEqual(rows.map((n) => n.props.title), available[i] ? (payload[i] ?? []).slice(0, 8).map((r) => r[field]) : []);
      for (let n = 0; n < rows.length; n++) {
        const item = payload[i][n], props = rows[n].props;
        if (i === 2) {
          assert.equal(props.subtitle, item.expiration_date ? new TestDate(item.expiration_date).toLocaleDateString('he-IL') : item.category);
          assert.equal(props.meta, item.severity); assert.equal(props.tone, domain.complianceTone(item.severity) === 'bad' ? 'red' : 'orange');
        } else if (i === 3) {
          assert.equal(props.subtitle, item.due_at ? new TestDate(item.due_at).toLocaleDateString('he-IL') : 'ללא תאריך');
          assert.equal(props.meta, item.status); assert.equal(props.tone, domain.complianceTone(item.priority) === 'bad' ? 'red' : 'purple');
        } else {
          assert.equal(props.subtitle, `${item.document_type} · ${item.expires_at ? new TestDate(item.expires_at).toLocaleDateString('he-IL') : 'ללא תוקף'}`);
          assert.equal(props.meta, item.status); assert.equal(props.href, '/dashboard/garden/documents');
          assert.equal(props.tone, domain.complianceTone(domain.expirationBucket(item.expires_at)) === 'bad' ? 'red' : 'blue');
        }
      }
      if (!available[i]) { assert(text(section).includes('לא זמי')); assert(!text(section).includes('אין ')); }
    }
    assert(!text(tree).includes('נראים תקינים כרגע')); assert(!text(tree).includes('STALE'));
    if (available.some((v) => !v)) assert(nodes(tree, 'AdminDataError')[0].props.message);
    assert.equal(nodes(tree, 'TeacherAppFrame')[0].props.title, 'בוקר טוב, Owner');
    assert.equal(nodes(tree, 'TeacherActionTile').length, 4);
    assert(text(insight).includes('readiness בלבד'));
  }
  assert(!JSON.stringify(logs).includes('PRIVATE_')); assert(!JSON.stringify(logs).includes('STALE'));
  return { clients, queries: queries.length, scoreCalls: scoreCalls.length };
}
async function test(id, config) { const start = performance.now(); const result = await render(config); records.push({ id, status: 'PASS', milliseconds: performance.now() - start, ...result }); }
const start = performance.now();
try {
  const actualChains = [], scoreCalls = [];
  walk(sf, (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'limit') actualChains.push(canonical(node.getText(sf)));
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'buildComplianceScore') scoreCalls.push(canonical(node.getText(sf)));
  });
  assert.deepEqual(actualChains, expectedChains); assert.deepEqual(scoreCalls, [canonical(scoreContract)]);
  assert(source.indexOf('await requireRole(["manager", "owner"])') < source.indexOf('await safeAdminData'));
  assert(source.indexOf('if (!gardenId)') < source.indexOf('await createClient()'));
  assert(source.includes('const nowIso = new Date().toISOString();')); assert(source.includes('new Date(Date.now() + 90 * 86400000)'));
  assert.equal((source.match(/\bas any\b/g) ?? []).length, 7); // Existing six table casts + existing avatar only.
  records.push({ id: 'static-six-chains-score-contract-admission-pure-boundary', status: 'PASS' });
  await test('healthy-manager', {}); await test('healthy-owner', { role: 'owner' });
  await test('healthy-empty', { payload: names.map(() => []), empty: true });
  await test('healthy-null', { payload: names.map(() => null), empty: true });
  for (let i = 0; i < 6; i++) for (const method of ['error', 'reject', 'builder']) await test(`${names[i]}-${method}`, { fail: [i], method });
  await test('all-failed-stale', { fail: [0, 1, 2, 3, 4, 5] });
  await test('all-rejected', { fail: [0, 1, 2, 3, 4, 5], method: 'reject' });
  await test('client-throw', { clientThrow: true });
  await test('missing-null', { garden: null }); await test('missing-empty', { garden: '' }); await test('denied-role', { denied: true });
  await test('empty-alerts-known-independent-issues', { payload: healthy.map((v, i) => i === 2 ? [] : v) });
  await test('alerts-and-actions-failed-documents-retained', { fail: [2, 3] });
  await test('findings-and-documents-failed-independent-metrics-retained', { fail: [0, 4] });
  await test('inspections-and-actions-failed-alerts-documents-retained', { fail: [3, 5] });
  assert.equal(forbidden, 0);
  console.log(JSON.stringify({ status: 'PASS', cases: records.length, actualPageCalls: calls, staticCases: 1, forbiddenEffects: forbidden, durationMs: performance.now() - start, fixedTestClock: '2026-11-06T09:00:00.000Z', records, limitations: 'Synthetic actual-page + actual pure module; opaque UI; not browser/DB/RLS/full-stack/legal or physical safety proof.' }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ status: 'FAIL', passedCases: records.length, actualPageCalls: calls, forbiddenEffects: forbidden, records, error: String(error), stack: error.stack }, null, 2)); process.exitCode = 1;
}
