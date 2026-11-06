// Synthetic actual-page contract only. No SDK/auth/actions/client UI are loaded;
// no DB/RLS/full-stack/provider or physical-device proof is asserted here.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const read = (path) => {
  const absolutePath = resolve(root, path);
  assert.ok(statSync(absolutePath).isFile(), `source must be a regular file: ${absolutePath}`);
  if (process.platform === "darwin") {
    const rawFlags = execFileSync("/usr/bin/stat", ["-f", "%f", absolutePath], { encoding: "utf8" }).trim();
    assert.match(rawFlags, /^\d+$/, "stat must return numeric file flags");
    const flags = Number(rawFlags);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0);
    assert.equal(flags & 0x40000000, 0, `refusing dataless source: ${absolutePath}`);
  }
  return readFileSync(absolutePath, "utf8");
};
const ts = createRequire(import.meta.url)("typescript");
const source = read("app/dashboard/parent/page.tsx");
const opaque = (name) => Object.assign(() => { throw Error(`opaque component executed: ${name}`); }, { displayName: name });
const ui = Object.fromEntries(["ParentActionTile", "ParentAppFrame", "ParentChildCard", "ParentChildContextCard", "ParentEmptyState", "ParentHero", "ParentListRow", "ParentMetricCard", "ParentSection"].map((name) => [name, opaque(name)]));
const icons = Object.fromEntries(["Baby", "Bell", "Building2", "CalendarDays", "Camera", "FileText", "MessageCircle", "Phone", "Plus", "ShieldCheck", "WalletCards"].map((name) => [name, opaque(name)]));
const Link = opaque("Link");
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });

function evaluate(text, modules = {}) {
  const compiled = ts.transpileModule(text, {
    fileName: "isolated-page.tsx", reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  });
  assert.deepEqual(compiled.diagnostics ?? [], []);
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: (name) => { assert.ok(Object.hasOwn(modules, name), `unapproved import: ${name}`); return modules[name]; }
  }, { timeout: 1000 });
  return exports;
}

// Extract only known pure function declarations. The family loader and all
// server SDK imports are excluded, not executed with a fake network fallback.
function pureFunctions(path, names) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name?.text));
  assert.deepEqual(functions.map((node) => node.name.text).sort(), [...names].sort());
  const printer = ts.createPrinter();
  return evaluate(functions.map((node) => printer.printNode(ts.EmitHint.Unspecified, node, ast)).join("\n"));
}
const readModel = pureFunctions("lib/management/dashboard-read-model.ts", ["finiteMoney", "deriveAttendanceSummary", "deriveTuitionSummary", "selectAuthorizedChild"]);
const familyPure = pureFunctions("lib/domain/parent-family.ts", ["id", "resolveParentDashboardChild", "requestMatchesParentChild"]);

const sourceNames = ["requests", "family", "schedule", "attendance", "tuition", "documents", "notifications"];
function fixture({ failed = [], empty = [], withRequests = false, deniedRole = false } = {}) {
  const failures = new Set(failed);
  const empties = new Set(empty);
  const events = [];
  const calls = [];
  const profile = { id: "qa-parent", role: "parent", full_name: "Synthetic Parent", profile_image_url: null };
  const familyStale = failures.has("family");
  const enrollments = Array.from({ length: 13 }, (_, index) => ({
    id: `enrollment-${index + 1}`, child_id: `child-${index + 1}`, permanent_child_file_id: `file-${index + 1}`,
    full_name: `${familyStale ? "Stale family child" : "Child"} ${index + 1}`, status: "active", garden_id: "garden-a"
  }));
  const family = {
    childFiles: familyStale ? [{ id: "stale-extra-file", full_name: "Stale file profile" }] : [],
    enrollments: empties.has("family") ? [] : enrollments,
    gardens: empties.has("family") ? [] : [{ id: "garden-a", name: familyStale ? "Stale family garden" : "Healthy Garden", city: "QA", last_inspection_score: familyStale ? 97 : 88 }],
    sourceUnavailable: familyStale
  };
  const requests = empties.has("requests") ? [] : failures.has("requests") || withRequests ? [{
    id: "request-1", child_profile_id: "file-5", status: "submitted", payment_status: "pending",
    requested_at: "2099-01-02T11:42:00Z", gardens: { name: failures.has("requests") ? "Stale request garden" : "Healthy request garden", city: "QA" }
  }] : [];
  const error = (name) => failures.has(name) ? { message: `synthetic ${name} failure` } : null;
  const results = {
    kindergarten_enrollment_requests: { data: requests, error: error("requests") },
    schedule_items: { data: empties.has("schedule") ? [] : [{ id: "schedule-1", title: failures.has("schedule") ? "Stale schedule" : "Healthy schedule", starts_at: "2099-01-02T10:00:00Z" }], error: error("schedule") },
    attendance: { data: empties.has("attendance") ? [] : enrollments.map((row) => ({ child_id: row.child_id, status: "present", check_in_at: "2099-01-02T11:42:00Z" })), error: error("attendance") },
    tuition_billing_periods: { data: empties.has("tuition") ? [] : [{ base_amount: failures.has("tuition") ? 99000 : 100, adjustment_total: 0, settled_total: 25, status: failures.has("tuition") ? "reconciliation_required" : "open", due_at: "2000-01-01", currency: "ILS" }], error: error("tuition") },
    documents: { data: null, count: empties.has("documents") ? 0 : failures.has("documents") ? 97 : 3, error: error("documents") },
    notifications: { data: null, count: empties.has("notifications") ? 0 : failures.has("notifications") ? 97 : 2, error: error("notifications") }
  };
  const client = {
    from: (table) => {
      assert.ok(Object.hasOwn(results, table), `unexpected table: ${table}`);
      const call = { table, operations: [] };
      calls.push(call);
      const chain = {};
      for (const method of ["select", "eq", "order", "limit", "in", "not", "is"]) {
        chain[method] = (...args) => { call.operations.push([method, ...args]); return chain; };
      }
      chain.then = (yes, no) => Promise.resolve(results[table]).then(yes, no);
      return chain;
    }
  };
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
      events.push(["family"]); assert.equal(received, client); assert.equal(receivedProfile, profile); return family;
    } },
    "@/lib/management/dashboard-read-model": readModel,
    "@/lib/supabase/server": { createClient: async () => { events.push(["createClient"]); return client; } }
  }).default;
  return { page, calls, events, failures, empties, withRequests };
}

function nodes(tree, predicate) {
  const output = [];
  function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== "object") return;
    if (predicate(node)) output.push(node);
    walk(node.props?.children);
  }
  walk(tree);
  return output;
}
const named = (tree, name, title) => nodes(tree, (node) => node.type === ui[name] && (!title || node.props.title === title));
const classed = (tree, name) => nodes(tree, (node) => String(node.props?.className ?? "").split(" ").includes(name));
const metric = (tree, title) => named(tree, "ParentMetricCard", title)[0];
const primaryTile = (tree, title) => named(classed(tree, "parent-primary-reference-actions")[0], "ParentActionTile", title)[0];
const section = (tree, title) => named(tree, "ParentSection", title)[0];
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (node === null || node === undefined || typeof node === "boolean") return "";
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
async function render(options = {}, child = "child-5") {
  const f = fixture(options);
  const tree = await f.page({ searchParams: Promise.resolve({ child }) });
  return { ...f, tree };
}

function assertFailureBoundaries({ tree, failures, withRequests, calls }) {
  const familyBad = failures.has("family");
  const updatesBad = failures.has("requests") || failures.has("notifications") || familyBad;
  const updates = metric(tree, "עדכונים פתוחים");
  assert.equal(updates.props.value, updatesBad ? "לא זמין" : 2 + (withRequests && !familyBad ? 1 : 0));
  assert.equal(updates.props.tone, updatesBad ? "neutral" : "orange");
  assert.equal(updates.props.hint, updatesBad ? "לא ניתן לאמת את מספר העדכונים" : "בקשות/התראות לטיפול");
  const attendanceBad = familyBad || failures.has("attendance");
  assert.equal(metric(tree, "נוכחות היום").props.value, attendanceBad ? "לא זמין" : "בגן");
  assert.equal(metric(tree, "נוכחות היום").props.tone, attendanceBad ? "neutral" : "green");
  const tuitionBad = familyBad || failures.has("tuition");
  const tuition = metric(tree, "שכר לימוד");
  if (tuitionBad) {
    assert.equal(tuition.props.value, "לא זמין"); assert.equal(tuition.props.tone, "neutral");
    assert.equal(tuition.props.hint, "מצב התשלומים אינו זמין");
  } else { assert.match(String(tuition.props.value), /75/); assert.equal(tuition.props.tone, "orange"); assert.equal(tuition.props.hint, "1 תקופות באיחור"); }
  assert.equal(metric(tree, "ציון בטיחות").props.value, familyBad ? "לא זמין" : 88);
  assert.equal(metric(tree, "ציון בטיחות").props.tone, familyBad ? "neutral" : "purple");
  const schedule = section(tree, "היום בגן");
  if (familyBad || failures.has("schedule")) {
    assert.equal(named(schedule, "ParentListRow").length, 0);
    assert.equal(named(schedule, "ParentEmptyState")[0].props.title, "לוח הגן אינו זמין");
  } else { assert.equal(named(schedule, "ParentListRow")[0].props.title, "Healthy schedule"); }
  if (failures.has("requests")) {
    assert.doesNotMatch(JSON.stringify(tree), /Stale request garden/);
    assert.ok(named(tree, "ParentEmptyState", "בקשות ההרשמה אינן זמינות").length >= 2);
  } else if (withRequests && !familyBad) {
    assert.ok(named(tree, "ParentListRow").some((row) => String(row.props.title).includes("Healthy request garden")));
  }
  if (familyBad) {
    assert.doesNotMatch(JSON.stringify(tree), /Stale family|Stale file/);
    assert.equal(named(tree, "ParentChildContextCard").length, 0);
    assert.equal(named(tree, "ParentChildCard").length, 0);
    assert.match(text(tree), /לא הצלחנו לטעון את רשימת הילדים/);
    assert.deepEqual(calls.map((call) => call.table), ["kindergarten_enrollment_requests", "notifications"]);
    return;
  }
  assert.equal(named(tree, "ParentChildContextCard").length, 13);
  assert.equal(named(tree, "ParentChildCard")[0].props.name, "Child 5");
  const attendance = section(tree, "נוכחות היום");
  assert.equal(attendance.props.subtitle, "Child 5");
  const rows = classed(attendance, "parent-primary-attendance-row");
  assert.equal(rows.length, 4);
  if (failures.has("attendance")) {
    assert.equal(classed(attendance, "is-present").length, 0);
    assert.equal(classed(attendance, "is-absent").length, 0);
    for (const row of rows) {
      assert.equal(text(nodes(row, (node) => node.type === "time")[0]), "—");
      assert.match(text(row), /לא זמין/);
    }
  } else {
    assert.equal(classed(attendance, "is-present").length, 4);
    assert.match(text(attendance), /לפי רשומות הנוכחות של הגן להיום/);
  }
  const docsBad = failures.has("documents");
  const docs = primaryTile(tree, "מסמכים");
  assert.equal(docs.props.tone, docsBad ? "neutral" : "orange");
  assert.equal(docs.props.detail, docsBad ? "הסטטוס לא זמין" : "3 מסמכים לטיפול");
  assert.equal(docs.props.href, "/dashboard/parent/documents");
  const hint = metric(tree, "נוכחות היום").props.hint;
  assert.equal(hint, docsBad ? "מצב המסמכים אינו זמין" : attendanceBad ? "עדכון הנוכחות אינו זמין" : "3 מסמכים דורשים פעולה");
  const payment = primaryTile(tree, "תשלומים");
  assert.equal(payment.props.tone, tuitionBad ? "neutral" : "orange");
  assert.equal(payment.props.href, "/dashboard/parent/payments?child=file-5");
  if (tuitionBad) assert.equal(payment.props.detail, "הסטטוס לא זמין");
  const scheduleTile = primaryTile(tree, "אירועים קרובים");
  assert.equal(scheduleTile.props.tone, failures.has("schedule") ? "neutral" : "purple");
  if (failures.has("schedule")) assert.equal(scheduleTile.props.detail, "לוח הגן לא זמין");
  assert.equal(section(tree, "הודעות אחרונות").props.subtitle, updatesBad ? "העדכונים אינם זמינים" : `${updates.props.value} עדכונים פתוחים`);
  assert.ok(nodes(attendance, (node) => node.type === Link && node.props.href === "/dashboard/parent/attendance?child=child-5").length);
}

for (const failed of sourceNames) {
  test(`single ${failed} error discards stale source and preserves independent healthy state`, async () => {
    assertFailureBoundaries(await render({ failed: [failed], withRequests: true }));
  });
}
for (const failed of [["requests", "notifications"], ["attendance", "tuition"], ["family", "requests"], ["schedule", "documents"], ["family", "notifications"], ["documents", "tuition"]]) {
  test(`paired ${failed.join("+")} failures remain independently bounded`, async () => {
    assertFailureBoundaries(await render({ failed, withRequests: true }));
  });
}
for (const failed of ["tuition", "documents"]) {
  test(`failed ${failed} fallback row stays unavailable without enrollment requests`, async () => {
    const result = await render({ failed: [failed] });
    assertFailureBoundaries(result);
    const rows = named(classed(result.tree, "parent-primary-updates")[0], "ParentListRow");
    const row = rows.find((node) => node.props.subtitle === (failed === "tuition" ? "שכר לימוד ותשלומים" : "מרכז המסמכים של הילד"));
    assert.equal(row.props.tone, "neutral");
    assert.equal(row.props.title, failed === "tuition" ? "מצב התשלומים אינו זמין" : "מצב המסמכים אינו זמין");
  });
}

for (const empty of sourceNames) {
  test(`successful ${empty} empty result remains success-empty, not an error`, async () => {
    const { tree } = await render({ empty: [empty] }, empty === "family" ? null : "child-5");
    assert.equal(classed(tree, "parent-dashboard-data-warning").length, 0);
    if (empty === "family") {
      assert.match(text(tree), /עדיין לא נוסף ילד לחשבון שלך/);
      assert.equal(metric(tree, "שכר לימוד").props.value, "טרם הוגדר");
    } else if (empty === "attendance") {
      assert.equal(metric(tree, "נוכחות היום").props.value, "טרם עודכן");
    } else if (empty === "tuition") {
      assert.equal(metric(tree, "שכר לימוד").props.value, "אין יתרה");
      assert.equal(primaryTile(tree, "תשלומים").props.tone, "green");
    } else if (empty === "documents") {
      assert.equal(primaryTile(tree, "מסמכים").props.detail, "המסמכים מעודכנים");
      assert.equal(primaryTile(tree, "מסמכים").props.tone, "green");
    } else if (empty === "schedule") {
      assert.equal(named(section(tree, "היום בגן"), "ParentEmptyState")[0].props.title, "אין לו״ז מפורסם כרגע");
    } else if (empty === "notifications") {
      assert.equal(metric(tree, "עדכונים פתוחים").props.value, 0);
      assert.equal(metric(tree, "עדכונים פתוחים").props.tone, "green");
    } else {
      assert.equal(metric(tree, "עדכונים פתוחים").props.value, 2);
      assert.ok(named(tree, "ParentEmptyState", "אין התראות חדשות").length);
    }
  });
}

test("family failure does not hide healthy account-scoped requests when no child is requested", async () => {
  const { tree } = await render({ failed: ["family"], withRequests: true }, null);
  assert.equal(metric(tree, "עדכונים פתוחים").props.value, 3);
  assert.ok(named(tree, "ParentListRow").some((row) => String(row.props.title).includes("Healthy request garden")));
  assert.doesNotMatch(JSON.stringify(tree), /Stale family|Stale file/);
});

for (const withRequests of [false, true]) {
  test(`healthy page preserves values, enrollment branch and selected-window fix; requests=${withRequests}`, async () => {
    const result = await render({ withRequests });
    assertFailureBoundaries(result);
    assert.equal(classed(result.tree, "parent-dashboard-data-warning").length, 0);
    const { tree, calls } = await render({ withRequests }, "child-13");
    const rows = classed(section(tree, "נוכחות היום"), "parent-primary-attendance-row");
    assert.deepEqual(rows.map((row) => text(nodes(row, (node) => node.type === "strong")[0])), ["Child 1", "Child 2", "Child 3", "Child 13"]);
    assert.equal(new Set(rows.map((row) => row.key)).size, 4);
    assert.match(text(classed(section(tree, "נוכחות היום"), "is-selected")[0]), /Child 13/);
    const attendanceIds = calls.find((call) => call.table === "attendance").operations.find((op) => op[0] === "in")[2];
    assert.deepEqual(Array.from(attendanceIds), Array.from({ length: 13 }, (_, i) => `child-${i + 1}`));
  });
}

test("denied parent admission performs zero client, family IO and queries", async () => {
  const f = fixture({ deniedRole: true });
  await assert.rejects(f.page({ searchParams: Promise.resolve({ child: "child-5" }) }), /denied-role/);
  assert.deepEqual(f.events, [["requireRole", "parent"]]);
  assert.deepEqual(f.calls, []);
});

test("foreign requested child does not gain an enrollment or child-scoped query", async () => {
  const { tree, calls } = await render({}, "foreign-child");
  assert.equal(named(tree, "ParentChildCard").length, 0);
  assert.equal(named(tree, "ParentSection", "נוכחות היום").length, 0);
  assert.match(text(tree), /הילד שביקשת אינו זמין בחשבונך/);
  assert.doesNotMatch(JSON.stringify(calls), /foreign-child/);
  assert.equal(calls.some((call) => ["tuition_billing_periods", "documents", "schedule_items"].includes(call.table)), false);
});

test("all six query chains and authorization/selection/admission contracts remain exact", async () => {
  const exact = [
    'const { profile } = await requireRole(["parent"]);',
    'const family = await getParentFamilyContext(supabase as any, profile);',
    'const selectedChild = selectAuthorizedChild(childContexts, requestedChildId);',
    'const attendanceChildren = childContexts.slice(0, 4);',
    'if (selectedChild && !attendanceChildren.includes(selectedChild)) attendanceChildren.splice(3, 1, selectedChild);',
    'const childIdentity = resolveParentDashboardChild(selectedChild, enrollmentRows);',
    'const selectedRequests = requests.filter(request => !selectedChild ? !requestedChildId : requestMatchesParentChild(request, selectedChildFileId));',
    'const pending = selectedRequests.filter((request) => !["approved", "rejected", "cancelled", "expired"].includes(String(request.status)));',
    'const requestsRes = await supabase.from("kindergarten_enrollment_requests" as any)\n    .select("id,child_profile_id,status,payment_status,requested_at,decided_at,published_price_snapshot,gardens(name,city)")\n    .eq("parent_id", profile.id).order("created_at", { ascending: false }).limit(20);'
  ];
  for (const contract of exact) assert.ok(source.includes(contract), `missing contract: ${contract}`);
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
  const { calls, events } = await render();
  assert.deepEqual(events, [["requireRole", "parent"], ["createClient"], ["family"]]);
  assert.deepEqual(calls.map((call) => call.table), ["kindergarten_enrollment_requests", "schedule_items", "attendance", "tuition_billing_periods", "documents", "notifications"]);
  for (const table of ["tuition_billing_periods", "documents"]) assert.ok(calls.find((call) => call.table === table).operations.some((op) => op[0] === "eq" && op[1] === "child_id" && op[2] === "child-5"));
});
