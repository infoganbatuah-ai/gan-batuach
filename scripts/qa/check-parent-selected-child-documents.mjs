// Focused synthetic page qualification. Auth/SDK/family IO and every UI leaf
// are closed fixtures. No DB/RLS, provider, full-stack or physical-device proof.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const ts = createRequire(import.meta.url)("typescript");
const read = (path) => {
  const absolutePath = resolve(root, path);
  assert.ok(statSync(absolutePath).isFile(), `refusing non-file source: ${absolutePath}`);
  if (process.platform === "darwin") {
    const rawFlags = execFileSync("/usr/bin/stat", ["-f", "%f", absolutePath], { encoding: "utf8" }).trim();
    assert.match(rawFlags, /^\d+$/, "stat must return numeric file flags");
    const flags = Number(rawFlags);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0, `invalid file flags: ${absolutePath}`);
    assert.equal(flags & 0x40000000, 0, `refusing dataless source: ${absolutePath}`);
  }
  return readFileSync(absolutePath, "utf8");
};
const source = read("app/dashboard/parent/page.tsx");
const opaque = (name) => Object.assign(() => { throw Error(`opaque leaf executed: ${name}`); }, { displayName: name });
const uiNames = ["ParentActionTile", "ParentAppFrame", "ParentChildCard", "ParentChildContextCard", "ParentEmptyState", "ParentHero", "ParentListRow", "ParentMetricCard", "ParentSection"];
const ui = Object.fromEntries(uiNames.map((name) => [name, opaque(name)]));
const iconNames = ["Baby", "Bell", "Building2", "CalendarDays", "Camera", "FileText", "MessageCircle", "Phone", "Plus", "ShieldCheck", "WalletCards"];
const icons = Object.fromEntries(iconNames.map((name) => [name, opaque(name)]));
const Link = opaque("Link");
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });

function evaluate(text, modules = {}) {
  const compiled = ts.transpileModule(text, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  });
  assert.deepEqual(compiled.diagnostics ?? [], [], "fixture compilation diagnostics");
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: (name) => {
      assert.ok(Object.hasOwn(modules, name), `unapproved import: ${name}`);
      return modules[name];
    }
  }, { timeout: 1000 });
  return exports;
}

// Extract named pure functions only. Never import/evaluate the family IO
// function, SDK, auth implementation, real actions or client components.
function pureFunctions(path, names) {
  const text = read(path);
  const ast = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.deepEqual(functions.map((node) => node.name.text).sort(), [...names].sort());
  const printer = ts.createPrinter();
  return evaluate(functions.map((node) => printer.printNode(ts.EmitHint.Unspecified, node, ast)).join("\n"));
}

const readModel = pureFunctions("lib/management/dashboard-read-model.ts", ["finiteMoney", "deriveAttendanceSummary", "deriveTuitionSummary", "selectAuthorizedChild"]);
const familyPure = pureFunctions("lib/domain/parent-family.ts", ["id", "resolveParentDashboardChild", "requestMatchesParentChild"]);

function fixture({ childCount = 13, documentCount = 0, documentError = false, withRequests = false, deniedRole = false } = {}) {
  const events = [];
  const calls = [];
  const profile = { id: "qa-parent", role: "parent", full_name: "Synthetic Parent", profile_image_url: null };
  const enrollments = Array.from({ length: childCount }, (_, index) => ({
    id: `enrollment-${index + 1}`, child_id: `child-${index + 1}`, permanent_child_file_id: `file-${index + 1}`,
    full_name: `Child ${index + 1}`, status: "active", garden_id: "garden-a"
  }));
  const family = { childFiles: [], enrollments, gardens: [{ id: "garden-a", name: "Synthetic Garden", city: "QA", last_inspection_score: 88 }], sourceUnavailable: false };
  const requests = withRequests ? [{ id: "request-1", child_profile_id: "file-5", status: "submitted", payment_status: "pending", gardens: { name: "Request Garden", city: "QA" } }] : [];
  const results = {
    kindergarten_enrollment_requests: { data: requests, error: null },
    schedule_items: { data: [{ id: "schedule-1", title: "Synthetic activity", starts_at: "2099-01-02T10:00:00Z" }], error: null },
    attendance: { data: enrollments.map((child) => ({ child_id: child.child_id, status: "present", attendance_date: "2099-01-02" })), error: null },
    tuition_billing_periods: { data: [{ base_amount: 100, adjustment_total: 0, settled_total: 25, status: "open", due_at: "2099-12-31", currency: "ILS" }], error: null },
    documents: { data: null, count: documentCount, error: documentError ? { message: "synthetic documents unavailable" } : null },
    notifications: { data: null, count: 2, error: null }
  };
  const from = (table) => {
    assert.ok(Object.hasOwn(results, table), `unexpected table: ${table}`);
    const call = { table, operations: [] };
    calls.push(call);
    const chain = {};
    for (const method of ["select", "eq", "order", "limit", "in", "not", "is"]) {
      chain[method] = (...args) => { call.operations.push([method, ...args]); return chain; };
    }
    chain.then = (yes, no) => Promise.resolve(results[table]).then(yes, no);
    return chain;
  };
  const client = { from };
  const page = evaluate(source, {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("react.fragment") },
    "next/link": { __esModule: true, default: Link },
    "lucide-react": icons,
    "@/components/dashboard-shell": { DashboardShell: opaque("DashboardShell") },
    "@/components/self-service-forms": { ParentChildProfileForm: opaque("ParentChildProfileForm") },
    "@/components/parent-kindergarten-invitations-panel": { ParentKindergartenInvitationsPanel: opaque("ParentKindergartenInvitationsPanel") },
    "@/components/parent-app-ui": { ...ui, parentDefaultActions: [] },
    "@/lib/auth": { requireRole: async (roles) => { events.push(["requireRole", ...roles]); if (deniedRole) throw Error("denied-role"); return { profile }; } },
    "@/lib/domain/display-label": { cleanSyntheticLabel: (value, fallback = "") => value || fallback, isSyntheticLabel: () => false },
    "@/lib/domain/parent-family": { ...familyPure, getParentFamilyContext: async (received, receivedProfile) => {
      events.push(["family"]);
      assert.equal(received, client);
      assert.equal(receivedProfile, profile);
      return family;
    } },
    "@/lib/management/dashboard-read-model": readModel,
    "@/lib/supabase/server": { createClient: async () => { events.push(["createClient"]); return client; } }
  }).default;
  return { page, calls, events, enrollments };
}

function nodes(tree, predicate) {
  const found = [];
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    if (predicate(node)) found.push(node);
    walk(node.props?.children);
  }
  walk(tree);
  return found;
}
const named = (tree, name, title) => nodes(tree, (node) => node.type === ui[name] && (!title || node.props.title === title));
const classed = (tree, name) => nodes(tree, (node) => String(node.props?.className ?? "").split(" ").includes(name));
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (tree === null || tree === undefined || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  return text(tree.props?.children);
}
function attendanceSection(tree) {
  const sections = named(tree, "ParentSection", "נוכחות היום");
  assert.equal(sections.length, 1);
  return sections[0];
}
async function render(options, requested = "child-5") {
  const f = fixture(options);
  const tree = await f.page({ searchParams: Promise.resolve({ child: requested }) });
  return { ...f, tree };
}

for (const selected of [1, 4, 5, 13]) {
  test(`selected child ${selected} stays inside four authorized attendance rows`, async () => {
    const { tree, calls } = await render({}, `child-${selected}`);
    const section = attendanceSection(tree);
    const rows = classed(section, "parent-primary-attendance-row");
    const expected = selected <= 4 ? [1, 2, 3, 4] : [1, 2, 3, selected];
    assert.equal(rows.length, 4);
    assert.deepEqual(rows.map((row) => text(nodes(row, (node) => node.type === "strong")[0])), expected.map((n) => `Child ${n}`));
    assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
    const activeRows = classed(section, "is-selected");
    assert.equal(activeRows.length, 1);
    assert.match(text(activeRows[0]), new RegExp(`Child ${selected}(?![0-9])`));
    assert.equal(section.props.subtitle, `Child ${selected}`);
    assert.ok(nodes(section, (node) => node.type === Link && node.props.href === `/dashboard/parent/attendance?child=child-${selected}`).length);
    const selector = named(tree, "ParentChildContextCard");
    assert.equal(selector.length, 13);
    assert.equal(selector.filter((node) => node.props.active).length, 1);
    const query = calls.find((call) => call.table === "attendance");
    const ids = query.operations.find((op) => op[0] === "in")[2];
    assert.deepEqual(Array.from(ids), [...Array.from({ length: 12 }, (_, i) => `child-${i + 1}`), ...(selected === 13 ? ["child-13"] : [])]);
    assert.deepEqual(query.operations.at(-1), ["limit", 13]);
  });
}

for (const childCount of [0, 1, 3, 4]) {
  test(`healthy bounded child list preserves order with ${childCount} contexts`, async () => {
    const { tree } = await render({ childCount }, childCount ? "child-1" : undefined);
    const rows = classed(tree, "parent-primary-attendance-row");
    assert.equal(rows.length, childCount);
    assert.deepEqual(rows.map((row) => text(nodes(row, (node) => node.type === "strong")[0])), Array.from({ length: childCount }, (_, i) => `Child ${i + 1}`));
  });
}

test("unauthorized selection does not synthesize a child or expand query scope", async () => {
  const { tree, calls } = await render({}, "foreign-child");
  assert.equal(named(tree, "ParentSection", "נוכחות היום").length, 0);
  assert.equal(named(tree, "ParentChildCard").length, 0);
  assert.equal(named(tree, "ParentChildContextCard").filter((node) => node.props.active).length, 0);
  assert.match(text(tree), /הילד שביקשת אינו זמין בחשבונך/);
  assert.doesNotMatch(JSON.stringify(calls), /foreign-child/);
  assert.equal(calls.some((call) => ["documents", "tuition_billing_periods", "schedule_items"].includes(call.table)), false);
});

for (const count of [null, 0, 7]) {
  for (const withRequests of [false, true]) {
    test(`document error never displays null/zero/stale count ${count}; requests=${withRequests}`, async () => {
      const { tree } = await render({ documentCount: count, documentError: true, withRequests });
      const updates = classed(tree, "parent-primary-updates")[0];
      const rows = named(updates, "ParentListRow");
      const documentRows = rows.filter((node) => node.props.subtitle === "מרכז המסמכים של הילד");
      if (withRequests) {
        assert.equal(documentRows.length, 0);
        assert.equal(rows.length, 1);
        assert.match(rows[0].props.title, /Request Garden/);
      } else {
        assert.equal(documentRows.length, 1);
        assert.equal(documentRows[0].props.title, "מצב המסמכים אינו זמין");
        assert.equal(documentRows[0].props.tone, "neutral");
      }
      const tile = named(classed(tree, "parent-primary-reference-actions")[0], "ParentActionTile", "מסמכים")[0];
      assert.equal(tile.props.tone, "neutral");
      assert.equal(tile.props.detail, "הסטטוס לא זמין");
      assert.equal(tile.props.href, "/dashboard/parent/documents");
      const attendance = named(tree, "ParentMetricCard", "נוכחות היום")[0];
      assert.equal(attendance.props.hint, "מצב המסמכים אינו זמין");
      assert.equal(attendance.props.value, "בגן");
      assert.equal(attendance.props.href, "/dashboard/parent/attendance?child=child-5");
      assert.equal(named(tree, "ParentMetricCard", "ציון בטיחות")[0].props.value, 88);
      assert.equal(named(tree, "ParentMetricCard", "עדכונים פתוחים")[0].props.value, withRequests ? 3 : 2);
      assert.match(String(named(tree, "ParentMetricCard", "שכר לימוד")[0].props.value), /75/);
    });
  }
}

for (const count of [0, 3]) {
  test(`healthy documents retain genuine count ${count} and success/action presentation`, async () => {
    const { tree } = await render({ documentCount: count });
    const row = named(classed(tree, "parent-primary-updates")[0], "ParentListRow").find((node) => node.props.subtitle === "מרכז המסמכים של הילד");
    assert.equal(row.props.title, count ? "3 מסמכים דורשים פעולה" : "המסמכים מעודכנים");
    assert.equal(row.props.tone, count ? "orange" : "green");
    assert.equal(named(tree, "ParentMetricCard", "נוכחות היום")[0].props.hint, `${count} מסמכים דורשים פעולה`);
    const tile = named(classed(tree, "parent-primary-reference-actions")[0], "ParentActionTile", "מסמכים")[0];
    assert.equal(tile.props.tone, count ? "orange" : "green");
    assert.equal(tile.props.detail, count ? "3 מסמכים לטיפול" : "המסמכים מעודכנים");
    assert.equal(named(tree, "ParentMetricCard", "שכר לימוד")[0].props.href, "/dashboard/parent/payments?child=file-5");
    assert.equal(named(tree, "ParentChildCard")[0].props.name, "Child 5");
    assert.equal(named(tree, "ParentHero")[0].props.title, "שלום, Synthetic Parent");
  });
}

test("denied role cannot construct a client or read family/query data", async () => {
  const f = fixture({ deniedRole: true });
  await assert.rejects(f.page({ searchParams: Promise.resolve({ child: "child-5" }) }), /denied-role/);
  assert.deepEqual(f.events, [["requireRole", "parent"]]);
  assert.deepEqual(f.calls, []);
});

test("real page retains exact scoped query chains and authorization/admission expressions", () => {
  const exact = [
    'const { profile } = await requireRole(["parent"]);',
    'const selectedChild = selectAuthorizedChild(childContexts, requestedChildId);',
    'const childIdentity = resolveParentDashboardChild(selectedChild, enrollmentRows);',
    'const family = await getParentFamilyContext(supabase as any, profile);',
    'const selectedRequests = requests.filter(request => !selectedChild ? !requestedChildId : requestMatchesParentChild(request, selectedChildFileId));',
    'const pending = selectedRequests.filter((request) => !["approved", "rejected", "cancelled", "expired"].includes(String(request.status)));',
    'selectedRequests.length ? selectedRequests.slice(0, 3).map((request)',
    '...childContexts.slice(0, 12).map(child => String(child.child_id ?? "")).filter(Boolean),',
    'selectedAttendanceChildId\n  ].filter(Boolean)))',
    'const requestsRes = await supabase.from("kindergarten_enrollment_requests" as any)\n    .select("id,child_profile_id,status,payment_status,requested_at,decided_at,published_price_snapshot,gardens(name,city)")\n    .eq("parent_id", profile.id).order("created_at", { ascending: false }).limit(20);'
  ];
  for (const contract of exact) assert.ok(source.includes(contract), `missing exact contract: ${contract}`);
  const start = source.indexOf('  const [scheduleRes, attendanceRes, tuitionRes, documentRes, notificationRes] = await Promise.all([');
  const end = source.indexOf('\n  const scheduleItems', start);
  assert.equal(source.slice(start, end), `  const [scheduleRes, attendanceRes, tuitionRes, documentRes, notificationRes] = await Promise.all([
    hasActiveKindergarten
    ? supabase.from("schedule_items" as any)
      .select("id,title,description,starts_at,visible_to_parents")
      .eq("garden_id", selectedGardenId)
      .eq("visible_to_parents", true)
      .order("starts_at", { ascending: true })
      .limit(4)
    : Promise.resolve({ data: [], error: null }),
    attendanceChildIds.length ? supabase.from("attendance" as any).select("child_id,status,attendance_date,check_in_at,check_out_at").in("child_id", attendanceChildIds).eq("attendance_date", attendanceDate).limit(13) : Promise.resolve({ data: [], error: null }),
    selectedAttendanceChildId ? supabase.from("tuition_billing_periods" as any).select("base_amount,adjustment_total,settled_total,status,due_at,currency").eq("child_id", selectedAttendanceChildId).not("status", "in", "(paid,waived,cancelled)").limit(100) : Promise.resolve({ data: [], error: null }),
    selectedAttendanceChildId ? supabase.from("documents" as any).select("id,status,expires_at", { count: "exact", head: true }).eq("child_id", selectedAttendanceChildId).is("deleted_at", null).in("status", ["pending_review", "expired", "rejected"]) : Promise.resolve({ data: [], count: 0, error: null }),
    supabase.from("notifications" as any).select("id", { count: "exact", head: true }).eq("recipient_id", profile.id).is("read_at", null).is("archived_at", null)
  ]);`);
});

test("page query order and key bindings remain scoped to the selected authorized context", async () => {
  const { calls, events } = await render({});
  assert.deepEqual(events, [["requireRole", "parent"], ["createClient"], ["family"]]);
  assert.deepEqual(calls.map((call) => call.table), ["kindergarten_enrollment_requests", "schedule_items", "attendance", "tuition_billing_periods", "documents", "notifications"]);
  const byTable = Object.fromEntries(calls.map((call) => [call.table, call.operations]));
  assert.ok(byTable.kindergarten_enrollment_requests.some((op) => op[0] === "eq" && op[1] === "parent_id" && op[2] === "qa-parent"));
  assert.ok(byTable.schedule_items.some((op) => op[0] === "eq" && op[1] === "garden_id" && op[2] === "garden-a"));
  for (const table of ["tuition_billing_periods", "documents"]) assert.ok(byTable[table].some((op) => op[0] === "eq" && op[1] === "child_id" && op[2] === "child-5"));
  assert.ok(byTable.notifications.some((op) => op[0] === "eq" && op[1] === "recipient_id" && op[2] === "qa-parent"));
});
