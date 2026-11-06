import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual Server Component, closed IO doubles, actual pure tuition projection.
// This is not live Supabase/RLS, browser, payment or provider qualification.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
function readSource(relative) {
  const path = resolve(root, relative);
  assert.ok(statSync(path).isFile(), `not a regular source file: ${relative}`);
  if (process.platform === "darwin") {
    const flags = execFileSync("/usr/bin/stat", ["-f", "%f", path], { encoding: "utf8" }).trim();
    assert.match(flags, /^\d+$/);
    assert.equal(Number(flags) & 0x40000000, 0, `refusing dataless source: ${relative}`);
  }
  return readFileSync(path, "utf8");
}
const require = createRequire(import.meta.url);
const ts = require("typescript");
const pageSource = readSource("app/dashboard/parent/payments/page.tsx");
const projectionSource = readSource("lib/domain/tuition-ledger.ts");
function parse(name, source, kind) {
  const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, kind);
  assert.equal(parsed.parseDiagnostics.length, 0, `invalid source: ${name}`);
  return parsed;
}
const pageAst = parse("page.tsx", pageSource, ts.ScriptKind.TSX);
const projectionAst = parse("tuition-ledger.ts", projectionSource, ts.ScriptKind.TS);
const functions = projectionAst.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === "projectTuitionPeriod");
assert.equal(functions.length, 1);
const projectionDeclaration = functions[0].getText(projectionAst);
// Only this pure declaration is extracted; never load the application module.
for (const forbidden of [/\brequire\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /\bprocess\b/, /\bglobalThis\b/]) {
  assert.doesNotMatch(projectionDeclaration, forbidden);
}
const allowedImports = new Map([
  ["next/link", ["default"]],
  ["lucide-react", ["AlertTriangle", "CalendarClock", "CheckCircle2", "FileText", "MessageCircle", "ReceiptText", "ShieldCheck", "WalletCards"]],
  ["@/components/dashboard-shell", ["DashboardShell"]],
  ["@/components/finance-platform-frame", ["FinanceFrame"]],
  ["@/components/finance-platform-ui", ["FinanceEmpty", "FinanceHero", "FinanceMetric", "FinanceMetrics", "FinanceSection", "FinanceStatus", "FinanceTruthBanner", "dateText", "money", "periodText"]],
  ["@/lib/auth", ["requireRole"]],
  ["@/lib/management/family-link", ["guardianChildIds"]],
  ["@/lib/supabase/server", ["createClient"]],
  ["@/lib/domain/tuition-ledger", ["projectTuitionPeriod", "TuitionPeriod"]],
]);
const imports = pageAst.statements.filter(ts.isImportDeclaration);
assert.equal(imports.length, allowedImports.size);
for (const node of imports) {
  const expected = allowedImports.get(node.moduleSpecifier.text);
  assert.ok(expected, `unexpected import ${node.moduleSpecifier.text}`);
  const bindings = node.importClause;
  const names = [...(bindings?.name ? ["default"] : []), ...(bindings?.namedBindings && ts.isNamedImports(bindings.namedBindings) ? bindings.namedBindings.elements.map((item) => (item.propertyName ?? item.name).text) : [])];
  assert.deepEqual(names, expected);
}
assert.doesNotMatch(pageSource, /["']use client["']/);
const fromCalls = [];
function collect(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "from") fromCalls.push(node.getText(pageAst));
  ts.forEachChild(node, collect);
}
collect(pageAst);
assert.deepEqual(fromCalls, [
  'supabase.from("child_kindergarten_enrollments" as never)',
  'supabase.from("tuition_billing_periods" as never)',
]);
assert.ok(pageSource.includes('const allowedSelection = params.child && authorizedChildIds.includes(params.child) ? params.child : authorizedChildIds[0];'));
assert.ok(pageSource.includes('const periods = periodRows.filter((item) => !params.status || item.status === params.status);'));

function compile(source, filename, jsx = false) {
  const output = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, ...(jsx ? { jsx: ts.JsxEmit.ReactJSX } : {}) } });
  const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${filename}: ${errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n")}`);
  return new vm.Script(output.outputText, { filename });
}
const pageScript = compile(pageSource, "parent-payments.page.tsx", true);
const pureScript = compile(projectionDeclaration, "pure-tuition-projection.ts");
const pureExports = {};
pureScript.runInNewContext({ exports: pureExports, require: () => { throw new Error("pure projection import denied"); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
assert.equal(typeof pureExports.projectTuitionPeriod, "function");
const copy = (value) => JSON.parse(JSON.stringify(value));
const profile = { id: "parent-qa-only", full_name: "Synthetic Parent", profile_image_url: "synthetic-avatar" };
const authorizedIds = ["file-a", "file-b"];
const enrollments = [
  { id: "enrollment-a", child_id: "child-a", permanent_child_file_id: "file-a", children: { full_name: "Synthetic Child A" }, gardens: { name: "Synthetic Garden A" } },
  { id: "enrollment-b", child_id: "child-b", permanent_child_file_id: "file-b", children: { full_name: "Synthetic Child B" }, gardens: { name: "Synthetic Garden B" } },
];
const period = (id, enrollmentId, overrides = {}) => ({ id, garden_id: "synthetic-garden", enrollment_id: enrollmentId, child_id: "synthetic-child", period_start: "2999-01-01", period_end: "2999-01-31", due_at: "2999-02-01", base_amount: 120, adjustment_total: -20, settled_total: 30, unapplied_credit_total: 7, status: "partially_paid", reconciliation_reason: null, ...overrides });
const periods = [
  period("period-a-partial", "enrollment-a"),
  period("period-a-paid", "enrollment-a", { settled_total: 100, status: "paid", due_at: null }),
  period("period-a-overdue", "enrollment-a", { base_amount: 60, adjustment_total: 0, settled_total: 0, status: "pending", due_at: "2000-01-01" }),
  period("period-b", "enrollment-b", { base_amount: 900, adjustment_total: 0, settled_total: 0, status: "pending" }),
];
const failure = { message: "synthetic returned source failure" };
const component = (name) => name;
const uiNames = allowedImports.get("@/components/finance-platform-ui");
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function walk(tree, predicate) {
  const found = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object" || !("type" in value)) return;
    if (predicate(value)) found.push(value);
    for (const prop of Object.values(value.props)) visit(prop);
  }
  visit(tree);
  return found;
}
const nodes = (tree, type) => walk(tree, (node) => node.type === type);
const rows = (tree, className) => walk(tree, (node) => node.props.className === className);
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value == null || typeof value === "boolean") return "";
  if (typeof value !== "object") return String(value);
  return text(value.props?.children);
}
const metric = (tree, label) => {
  const found = nodes(tree, "FinanceMetric").filter((node) => node.props.label === label);
  assert.equal(found.length, 1, label);
  return found[0].props;
};
const emptyTitles = (tree) => nodes(tree, "FinanceEmpty").map((node) => node.props.title);
function partialText(tree) {
  const cards = rows(tree, "finance-domain-card").filter((node) => text(node).includes("תשלום חלקי"));
  assert.equal(cards.length, 1);
  return text(nodes(cards[0], "b")[0]);
}
function makePage(options = {}) {
  const calls = [];
  const projectionIds = [];
  const ids = options.authorizedIds ?? authorizedIds;
  const sourceEnrollments = options.enrollmentsData === undefined ? enrollments : options.enrollmentsData;
  const sourcePeriods = options.periodsData === undefined ? periods : options.periodsData;
  const client = { from(table) {
    assert.ok(["child_kindergarten_enrollments", "tuition_billing_periods"].includes(table));
    const call = { table, operations: [] };
    calls.push(call);
    const query = {};
    for (const name of ["select", "in", "order", "limit"]) query[name] = (...args) => { call.operations.push([name, copy(args)]); return query; };
    query.then = (accept, reject) => {
      calls.push({ resolved: table });
      const filter = call.operations.find(([name]) => name === "in")?.[1];
      let data = table === "child_kindergarten_enrollments" ? sourceEnrollments : sourcePeriods;
      if (Array.isArray(data)) data = data.filter((item) => filter[1].includes(item[filter[0]]));
      return Promise.resolve({ data, error: table === "child_kindergarten_enrollments" ? options.enrollmentsError ?? null : options.periodsError ?? null }).then(accept, reject);
    };
    return query;
  } };
  const ui = Object.fromEntries(uiNames.map((name) => [name, component(name)]));
  Object.assign(ui, { money: (value) => `MONEY(${value})`, dateText: (value) => `DATE(${value})`, periodText: (value) => `PERIOD(${value})` });
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["next/link", { __esModule: true, default: "Link" }],
    ["lucide-react", Object.fromEntries(allowedImports.get("lucide-react").map((name) => [name, name]))],
    ["@/components/dashboard-shell", { DashboardShell: "DashboardShell" }],
    ["@/components/finance-platform-frame", { FinanceFrame: "FinanceFrame" }],
    ["@/components/finance-platform-ui", ui],
    ["@/lib/auth", { requireRole: async (roles) => { calls.push({ auth: copy(roles) }); if (options.denied) throw new Error("parent role denied"); return { profile }; } }],
    ["@/lib/management/family-link", { guardianChildIds: async (receivedClient, userId) => { assert.equal(receivedClient, client); assert.equal(userId, profile.id); calls.push({ guardian: userId }); return ids; } }],
    ["@/lib/supabase/server", { createClient: async () => { calls.push({ client: true }); return client; } }],
    ["@/lib/domain/tuition-ledger", { projectTuitionPeriod: (item) => { projectionIds.push(item.id); return pureExports.projectTuitionPeriod(item); } }],
  ]);
  const exports = {};
  pageScript.runInNewContext({ exports, require: (name) => { assert.ok(modules.has(name), `blocked module ${name}`); return modules.get(name); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { calls, projectionIds, render: () => exports.default({ searchParams: Promise.resolve(options.params ?? {}) }) };
}
async function render(options) {
  const harness = makePage(options);
  const tree = await harness.render();
  assert.deepEqual(harness.calls.slice(0, 3), [{ auth: ["parent"] }, { client: true }, { guardian: profile.id }]);
  assert.equal(nodes(tree, "DashboardShell")[0].props.role, "parent");
  const frame = nodes(tree, "FinanceFrame")[0].props;
  assert.equal(frame.role, "parent");
  assert.equal(frame.name, profile.full_name);
  assert.equal(frame.avatarUrl, profile.profile_image_url);
  assert.equal(frame.activeHref, "/dashboard/parent/payments");
  return { ...harness, tree };
}
function unavailable(result, enrollmentFailed) {
  for (const label of ["יתרה פתוחה", "נרשם כשולם", "דורש בדיקה", "מועד הבא"]) {
    assert.equal(metric(result.tree, label).value, "לא זמין");
    assert.equal(metric(result.tree, label).tone, "neutral");
    assert.ok(metric(result.tree, label).hint);
    assert.doesNotMatch(metric(result.tree, label).hint, /MONEY\(|אין יתרה|אין חיוב קרוב/);
  }
  assert.deepEqual(result.projectionIds, []);
  assert.equal(rows(result.tree, "finance-ledger-row").length, 0);
  assert.equal(rows(result.tree, "finance-history-row").length, 0);
  assert.ok(emptyTitles(result.tree).includes("תקופות החיוב אינן זמינות"));
  assert.ok(emptyTitles(result.tree).includes("היסטוריית התשלומים אינה זמינה"));
  assert.ok(!emptyTitles(result.tree).includes("אין תקופות חיוב להצגה"));
  assert.equal(partialText(result.tree), "מספר התקופות אינו זמין");
  assert.equal(text(nodes(rows(result.tree, "finance-balance-card")[0], "strong")[0]), "לא זמין");
  assert.equal(nodes(result.tree, "FinanceStatus").length, 2, "only fixed provider/privacy statuses remain");
  const hero = nodes(result.tree, "FinanceHero")[0].props;
  if (enrollmentFailed) {
    assert.equal(result.calls.filter((call) => call.table === "tuition_billing_periods").length, 0);
    assert.equal(hero.eyebrow, "פרטי הגן אינם זמינים");
    assert.doesNotMatch(JSON.stringify(result.tree), /Synthetic Child|Synthetic Garden/);
  } else {
    assert.equal(hero.title, "התשלומים של Synthetic Child A");
    assert.equal(hero.eyebrow, "Synthetic Garden A");
    assert.match(text(rows(result.tree, "finance-balance-card")[0]), /Synthetic Child A · Synthetic Garden A/);
  }
}
const tests = [];
const test = (name, run) => tests.push({ name, run });
for (const [label, data] of [["stale", enrollments], ["null", null], ["empty", []]]) {
  test(`enrollment ${label} data excluded before dependent query`, async () => unavailable(await render({ enrollmentsData: data, enrollmentsError: failure }), true));
}
for (const [label, data] of [["stale", periods], ["null", null], ["empty", []]]) {
  test(`period ${label} data excluded before projection and rendering`, async () => unavailable(await render({ periodsData: data, periodsError: failure }), false));
}
test("paired returned failures cannot cause dependent reads or stale output", async () => unavailable(await render({ enrollmentsError: failure, periodsError: failure }), true));
test("selected healthy metadata survives period failure", async () => {
  const result = await render({ params: { child: "file-b", status: "paid" }, periodsError: failure });
  const hero = nodes(result.tree, "FinanceHero")[0].props;
  assert.equal(hero.title, "התשלומים של Synthetic Child B");
  assert.equal(hero.eyebrow, "Synthetic Garden B");
  assert.equal(rows(result.tree, "finance-ledger-row").length, 0);
  assert.equal(partialText(result.tree), "מספר התקופות אינו זמין");
  assert.deepEqual(result.calls.find((call) => call.table === "tuition_billing_periods").operations[1], ["in", ["enrollment_id", ["enrollment-b"]]]);
});
test("healthy math uses actual pure projection including overdue transition", async () => {
  const result = await render();
  assert.equal(metric(result.tree, "יתרה פתוחה").value, "MONEY(130)");
  assert.equal(metric(result.tree, "נרשם כשולם").value, "MONEY(130)");
  assert.equal(metric(result.tree, "נרשם כשולם").hint, "מתוך MONEY(260)");
  assert.equal(metric(result.tree, "דורש בדיקה").value, 1);
  assert.equal(metric(result.tree, "מועד הבא").value, "DATE(2000-01-01)");
  assert.equal(metric(result.tree, "מועד הבא").tone, "blue");
  assert.equal(rows(result.tree, "finance-ledger-row").length, 3);
  assert.equal(rows(result.tree, "finance-history-row").length, 3);
  assert.equal(partialText(result.tree), "1 תקופות");
  assert.ok(nodes(result.tree, "FinanceStatus").some((node) => node.props.status === "overdue"));
  assert.match(text(result.tree), /זיכוי בבדיקה MONEY\(7\)/);
});
test("healthy selected second child does not read first child's periods", async () => {
  const result = await render({ params: { child: "file-b" } });
  assert.deepEqual(result.projectionIds, ["period-b"]);
  assert.equal(metric(result.tree, "יתרה פתוחה").value, "MONEY(900)");
  assert.equal(nodes(result.tree, "FinanceHero")[0].props.title, "התשלומים של Synthetic Child B");
});
test("foreign query selection retains existing first-authorized fallback", async () => {
  const result = await render({ params: { child: "unrelated-file" } });
  assert.deepEqual(result.projectionIds, ["period-a-partial", "period-a-paid", "period-a-overdue"]);
  assert.doesNotMatch(JSON.stringify(result.tree), /unrelated-file/);
});
for (const status of ["paid", "overdue", "not-a-status"]) {
  test(`status filter ${status} only filters ledger, not total or history`, async () => {
    const result = await render({ params: { status } });
    assert.equal(rows(result.tree, "finance-ledger-row").length, status === "not-a-status" ? 0 : 1);
    assert.equal(rows(result.tree, "finance-history-row").length, 3);
    assert.equal(metric(result.tree, "יתרה פתוחה").value, "MONEY(130)");
    assert.equal(emptyTitles(result.tree).includes("אין תקופות חיוב להצגה"), status === "not-a-status");
    const nav = rows(result.tree, "finance-filter-bar")[0];
    assert.deepEqual(nodes(nav, "Link").map((node) => node.props.href), ["/dashboard/parent/payments?child=file-a", "/dashboard/parent/payments?child=file-a&status=overdue", "/dashboard/parent/payments?child=file-a&status=paid"]);
  });
}
for (const [label, options] of [
  ["no periods", { periodsData: [] }],
  ["null periods", { periodsData: null }],
  ["no enrollments", { enrollmentsData: [] }],
  ["null enrollments", { enrollmentsData: null }],
  ["no authorized children", { authorizedIds: [] }],
]) {
  test(`successful empty ${label} remains healthy`, async () => {
    const result = await render(options);
    assert.equal(metric(result.tree, "יתרה פתוחה").value, "MONEY(0)");
    assert.equal(metric(result.tree, "יתרה פתוחה").tone, "green");
    assert.equal(metric(result.tree, "מועד הבא").value, "לא נקבע");
    assert.equal(metric(result.tree, "מועד הבא").tone, "blue");
    assert.equal(partialText(result.tree), "0 תקופות");
    assert.deepEqual(emptyTitles(result.tree), ["אין תקופות חיוב להצגה"]);
    assert.equal(rows(result.tree, "finance-history-row").length, 0);
    if (options.enrollmentsData === null || options.enrollmentsData?.length === 0 || options.authorizedIds?.length === 0) assert.equal(result.calls.filter((call) => call.table === "tuition_billing_periods").length, 0);
    if (options.authorizedIds?.length === 0) assert.equal(result.calls.filter((call) => call.table).length, 0);
  });
}
test("role denial precedes client guardian and all query calls", async () => {
  const harness = makePage({ denied: true });
  await assert.rejects(harness.render(), /parent role denied/);
  assert.deepEqual(harness.calls, [{ auth: ["parent"] }]);
});
test("both exact scoped query chains remain unchanged", async () => {
  const result = await render();
  assert.deepEqual(result.calls.filter((call) => call.table), [
    { table: "child_kindergarten_enrollments", operations: [
      ["select", ["id,child_id,permanent_child_file_id,children(full_name,photo_url),gardens(name)"]],
      ["in", ["permanent_child_file_id", authorizedIds]],
      ["order", ["created_at", { ascending: false }]],
    ] },
    { table: "tuition_billing_periods", operations: [
      ["select", ["id,garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,adjustment_total,settled_total,unapplied_credit_total,status,reconciliation_reason"]],
      ["in", ["enrollment_id", ["enrollment-a"]]],
      ["order", ["period_start", { ascending: false }]], ["limit", [100]],
    ] },
  ]);
});
test("authorized child links and fixed provider/privacy contracts preserved on failure", async () => {
  const result = await render({ enrollmentsError: failure });
  const links = nodes(rows(result.tree, "finance-child-switcher")[0], "Link");
  assert.deepEqual(links.map((node) => node.props.href), authorizedIds.map((id) => `/dashboard/parent/payments?child=${id}`));
  assert.deepEqual(links.map((node) => node.props.className), ["active", ""]);
  assert.equal(nodes(result.tree, "FinanceTruthBanner").filter((node) => node.props.title === "תשלום אלקטרוני אינו זמין").length, 1);
  assert.ok(nodes(result.tree, "FinanceStatus").some((node) => node.props.status === "pending" && text(node) === "ספק מסמכים לא זמין"));
  assert.ok(nodes(result.tree, "FinanceStatus").some((node) => node.props.status === "verified" && text(node) === "גישה מאומתת"));
  assert.equal(nodes(result.tree, "Link").filter((node) => node.props.href === "/dashboard/parent/messages").length, 1);
});
test("unavailable source blocks projection before touching stale financial fields", async () => {
  const poisoned = period("poisoned", "enrollment-a");
  Object.defineProperty(poisoned, "base_amount", { get() { throw new Error("stale financial amount read"); } });
  const result = await render({ periodsData: [poisoned], periodsError: failure });
  unavailable(result, false);
});

for (const item of tests) {
  await item.run();
  console.log(`PASS ${item.name}`);
}
console.log(`${tests.length}/${tests.length} parent-payments actual-page synthetic cases passed; no SDK, database, service, browser or provider used.`);
