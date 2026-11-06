import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual page + actual pure identity helper, closed Auth/SDK/family/label/UI.
// No actual SDK/provider/env/helper graph, events, browser or RLS qualification.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const allowed = new Set(["app/dashboard/parent/attendance/page.tsx", "lib/domain/parent-attendance-children.ts"]);
function read(relative) {
  assert.ok(allowed.has(relative));
  const path = resolve(root, relative);
  assert.ok(statSync(path).isFile());
  if (process.platform === "darwin") {
    const raw = execFileSync("/usr/bin/stat", ["-f", "%f", path], { encoding: "utf8" }).trim();
    assert.match(raw, /^\d+$/);
    const flags = Number(raw);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0);
    assert.equal(flags & 0x40000000, 0, "dataless source refused");
  }
  return readFileSync(path, "utf8");
}
const ts = createRequire(import.meta.url)("typescript");
function compile(source, name) {
  const output = ts.transpileModule(source, { fileName: name, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
  return output.outputText;
}
const pageCode = compile(read("app/dashboard/parent/attendance/page.tsx"), "parent-attendance.tsx");
const helperSource = read("lib/domain/parent-attendance-children.ts");
const ast = ts.createSourceFile("identity.ts", helperSource, ts.ScriptTarget.ES2022, true);
assert.equal(ast.parseDiagnostics.length, 0);
assert.ok(ast.statements.every((node) => ts.isTypeAliasDeclaration(node) || ts.isFunctionDeclaration(node)), "only pure helper declarations");
const helperCode = compile(helperSource, "identity.ts");
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (value) => JSON.parse(JSON.stringify(value));
function nodes(value, type) {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, type));
  if (!value || typeof value !== "object" || !("type" in value)) return [];
  return [...(type === undefined || value.type === type ? [value] : []), ...Object.values(value.props).flatMap((item) => nodes(item, type))];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value == null || typeof value === "boolean") return "";
  return typeof value === "object" ? text(value.props?.children) : String(value);
}
const fixed = "2026-11-07T23:30:00.000Z";
const day = (zone) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fixed));
const profile = Object.freeze({ id: "parent-1", full_name: "AUTH_PARENT", profile_image_url: "AUTH_AVATAR" });
function familyFixture() { return { sourceUnavailable: false, children: [{ id: "child-1", garden_id: "garden-1", full_name: "CHILD_ONE", photo_url: "CHILD_PHOTO" }], enrollments: [] }; }
function attendanceFixture() {
  return [
    { id: "today", attendance_date: day("Asia/Jerusalem"), status: "present", check_in_at: "2026-11-08T06:00:00.000Z", check_out_at: "2026-11-08T14:00:00.000Z", pickup_name: "PICKUP_PERSON" },
    { id: "utc-day", attendance_date: day("UTC"), status: "absent" },
    ...["checked_in", "checked_out", "departed", "late", "left_early", "pending"].map((status, index) => ({ id: `history-${index}`, attendance_date: "2026-11-01", status })),
  ];
}
function deniedEffect(name = "effect") { throw new Error(`UNEXPECTED_EFFECT_OR_IMPORT:${String(name)}`); }
function load(code, require, extra = {}) {
  const exports = {};
  new vm.Script(code).runInNewContext({ exports, require, fetch: () => deniedEffect("fetch"), ...extra }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports;
}
const helper = load(helperCode, deniedEffect);
function failedFamily(kind) {
  const family = familyFixture(); family.sourceUnavailable = true;
  if (kind === "familyEnrollment") { family.children = []; family.enrollments = [{ child_id: "stale-child", garden_id: "stale-garden", full_name: "STALE_CHILD" }]; }
  if (kind === "familyChildrenGetter") Object.defineProperty(family, "children", { get() { throw new Error("STALE_CHILDREN"); } });
  if (kind === "familyEnrollmentsGetter") Object.defineProperty(family, "enrollments", { get() { throw new Error("STALE_ENROLLMENTS"); } });
  return family;
}
async function render({ family = familyFixture(), attendanceError = false, gardenError = false, attendanceKind = "stale", gardenKind = "stale", rows = attendanceFixture(), gardenData = { operational_timezone: "Asia/Jerusalem" }, poisonAttendanceData = false, poisonGardenData = false, params = {}, deniedRole = false, ownerProfile = profile } = {}) {
  const steps = [], queries = [], dates = [], formats = [], labels = [];
  let clients = 0, families = 0, identities = 0, derived, helperInputs;
  let attendanceResolved = false, attendanceDataReads = 0, gardenDataReads = 0;
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [fixed])); dates.push(args.length ? args[0] : fixed); }
    static now() { return Date.parse(fixed); }
    toLocaleTimeString(locale, options) { formats.push({ kind: "time", locale, options: plain(options) }); return super.toLocaleTimeString(locale, options); }
    toLocaleDateString(locale, options) { formats.push({ kind: "date", locale }); return super.toLocaleDateString(locale, options); }
  }
  const zoneFormats = [];
  class DateTimeFormat {
    constructor(locale, options) { zoneFormats.push({ locale, options: plain(options) }); this.delegate = new Intl.DateTimeFormat(locale, options); }
    format(value) { return this.delegate.format(value); }
  }
  const attendance = { error: attendanceError ? { message: "PRIVATE_ATTENDANCE_ERROR" } : null };
  Object.defineProperty(attendance, "data", { get() { attendanceDataReads++; if (poisonAttendanceData) throw new Error("STALE_ATTENDANCE_DATA"); return attendanceKind === "null" ? null : attendanceKind === "empty" ? [] : rows; } });
  const garden = { error: gardenError ? { message: "PRIVATE_GARDEN_ERROR" } : null };
  Object.defineProperty(garden, "data", { get() { gardenDataReads++; if (poisonGardenData) throw new Error("STALE_GARDEN_DATA"); return gardenKind === "null" ? null : gardenKind === "empty" ? {} : gardenData; } });
  const client = { from(table) {
    assert.equal(families, 1); assert.equal(identities, 1);
    assert.ok(["attendance", "gardens"].includes(table));
    if (table === "gardens") assert.equal(attendanceResolved, true, "original sequential query order");
    steps.push(table);
    const operations = []; queries.push([table, operations]);
    const query = {};
    for (const method of ["select", "eq", "order", "limit", "maybeSingle"]) query[method] = (...args) => { operations.push([method, ...args]); return query; };
    query.then = (accept, reject) => { if (table === "attendance") attendanceResolved = true; return Promise.resolve(table === "attendance" ? attendance : garden).then(accept, reject); };
    return query;
  } };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }], ["next/link", { __esModule: true, default: "Link" }],
    ["lucide-react", Object.fromEntries(["CalendarDays", "CheckCircle2", "Clock3", "LogOut", "UserRoundX"].map((name) => [name, name]))],
    ["@/components/avatar", { Avatar: "Avatar" }], ["@/components/dashboard-shell", { DashboardShell: "DashboardShell" }],
    ["@/components/parent-app-ui", Object.fromEntries(["ParentAppFrame", "ParentEmptyState", "ParentHero", "ParentMetricCard", "ParentSection"].map((name) => [name, name]))],
    ["@/components/gan-batuach-design-system", { StatusChip: "StatusChip" }],
    ["@/lib/auth", { requireRole: async (roles) => { steps.push("auth"); assert.deepEqual(Array.from(roles), ["parent"]); assert.equal(clients + families + identities + queries.length, 0); if (deniedRole) throw new Error("DENIED"); return { profile: ownerProfile }; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.deepEqual(steps, ["auth", "params"]); clients++; steps.push("client"); return client; } }],
    ["@/lib/domain/parent-family", { getParentFamilyContext: async (receivedClient, receivedProfile) => { assert.equal(receivedClient, client); assert.equal(receivedProfile, ownerProfile); families++; steps.push("family"); return family; } }],
    ["@/lib/domain/parent-attendance-children", { parentAttendanceChildren: (children, enrollments) => { identities++; helperInputs = [children, enrollments]; steps.push("identity"); derived = helper.parentAttendanceChildren(children, enrollments); return derived; } }],
    ["@/lib/domain/display-label", { cleanSyntheticLabel: (value, fallback) => { assert.equal(fallback, "ילד/ה"); labels.push(value); return value ?? fallback; } }],
  ]);
  const loaded = load(pageCode, (name) => modules.has(name) ? modules.get(name) : deniedEffect(name), { Date: FixedDate, Intl: { DateTimeFormat } });
  const searchParams = { then(resolveParams) { steps.push("params"); resolveParams(params); } };
  if (deniedRole) {
    await assert.rejects(loaded.default({ searchParams }), /DENIED/);
    assert.deepEqual(steps, ["auth"]); assert.equal(clients + families + identities + queries.length + dates.length + zoneFormats.length, 0); return;
  }
  const tree = await loaded.default({ searchParams });
  assert.equal(clients, 1); assert.equal(families, 1);
  assert.deepEqual(steps.slice(0, 4), ["auth", "params", "client", "family"]);
  assert.equal(identities, family.sourceUnavailable ? 0 : 1);
  if (!family.sourceUnavailable) { assert.equal(helperInputs[0], family.children); assert.equal(helperInputs[1], family.enrollments); }
  const selected = family.sourceUnavailable ? null : Array.from(derived).find((child) => child.id === params.child) ?? derived[0] ?? null;
  const expectedQueries = selected ? [["attendance", [["select", "id,attendance_date,status,check_in_at,check_out_at,pickup_name,note,updated_at"], ["eq", "child_id", selected.id], ["order", "attendance_date", { ascending: false }], ["limit", 60]]]] : [];
  if (selected?.garden_id) expectedQueries.push(["gardens", [["select", "operational_timezone"], ["eq", "id", selected.garden_id], ["maybeSingle"]]]);
  assert.deepEqual(plain(queries), expectedQueries);
  const shell = nodes(tree, "DashboardShell")[0].props;
  assert.equal(shell.role, "parent"); assert.equal(shell.title, "נוכחות"); assert.equal(shell.appHome, true);
  const frame = nodes(tree, "ParentAppFrame")[0].props;
  assert.equal(frame.active, "calendar"); assert.equal(frame.activeHref, "/dashboard/parent/attendance"); assert.equal(frame.profileName, ownerProfile.full_name); assert.equal(frame.avatarUrl, ownerProfile.profile_image_url ?? null);
  const hero = nodes(tree, "ParentHero")[0].props;
  assert.equal(hero.title, "נוכחות"); assert.equal(hero.subtitle, "הגעה, יציאה והיסטוריה של הילדים שלך");
  assert.ok(!JSON.stringify(tree).includes("PRIVATE_"));
  return { tree, queries, identities, derived, selected, labels, dates, formats, zoneFormats, attendanceDataReads, gardenDataReads };
}
function unavailable(result) {
  assert.equal(nodes(result.tree, "ParentMetricCard").length, 0); assert.equal(nodes(result.tree, "Avatar").length, 0);
  assert.equal(nodes(result.tree, "select").length, 0); assert.equal(nodes(result.tree, "Link").length, 0); assert.equal(nodes(result.tree, "article").length, 0);
  const alerts = nodes(result.tree).filter((node) => node.props.role === "alert"); assert.equal(alerts.length, 1);
  const state = nodes(alerts[0], "ParentEmptyState")[0].props;
  assert.equal(state.title, "לא ניתן לאמת נוכחות כרגע");
  assert.equal(state.text, "המידע לא נטען במלואו. נסו שוב מאוחר יותר; מצב הילד אינו מוצג כהגעה או כאפס מאומת.");
  assert.equal(nodes(result.tree, "ParentSection")[0].props.title, "נתוני נוכחות אינם זמינים");
  assert.deepEqual(result.dates, []); assert.deepEqual(result.zoneFormats, []); assert.deepEqual(result.labels, []);
}
function metric(result, title) {
  const found = nodes(result.tree, "ParentMetricCard").filter((node) => node.props.title === title); assert.equal(found.length, 1); return found[0].props;
}
function healthy(result, selectedId = "child-1") {
  assert.equal(nodes(result.tree).filter((node) => node.props.role === "alert").length, 0);
  assert.equal(nodes(result.tree, "ParentMetricCard").length, 4);
  assert.deepEqual(nodes(result.tree, "Link").map((node) => node.props.href), selectedId ? [`/dashboard/parent/children/${selectedId}`, "/dashboard/parent/pickup"] : []);
  assert.ok(nodes(result.tree, "p").some((node) => node.props.className === "ux05-policy-note" && text(node) === "נוכחות נקבעת רק לפי רשומת הנוכחות הקנונית של הגן. מצלמות או זיהוי חזותי אינם קובעים הגעה, יציאה או הרשאת איסוף."));
}

for (const kind of ["familyChild", "familyEnrollment", "familyChildrenGetter", "familyEnrollmentsGetter"]) test(`unavailable attendance ${kind} fences identity and queries`, async () => {
  const result = await render({ family: failedFamily(kind) }); unavailable(result); assert.equal(result.identities, 0); assert.deepEqual(result.queries, []);
});
test("attendance error cuts poisoned row attendance date before find or count", async () => {
  const result = await render({ attendanceError: true, rows: [{ get attendance_date() { throw new Error("STALE_ATTENDANCE_DATE"); } }] });
  unavailable(result); assert.equal(result.attendanceDataReads, 0);
});
test("attendance error cuts response data getter before normalization", async () => { const result = await render({ attendanceError: true, poisonAttendanceData: true }); unavailable(result); assert.equal(result.attendanceDataReads, 0); });
test("garden error cuts invalid timezone before String Intl or date derivation", async () => { const result = await render({ gardenError: true, gardenData: { operational_timezone: "INVALID_TIME_ZONE" } }); unavailable(result); assert.equal(result.gardenDataReads, 0); });
test("garden error cuts response data getter before timezone access", async () => { const result = await render({ gardenError: true, poisonGardenData: true }); unavailable(result); assert.equal(result.gardenDataReads, 0); });
test("garden error never reads poisoned operational timezone property", async () => {
  const result = await render({ gardenError: true, gardenData: { get operational_timezone() { throw new Error("STALE_ZONE"); } } });
  unavailable(result); assert.equal(result.gardenDataReads, 0);
});
for (const source of ["attendance", "garden"]) for (const kind of ["stale", "null", "empty"]) test(`${source} returned error ${kind} retains early existing warning`, async () => {
  const result = await render(source === "attendance" ? { attendanceError: true, attendanceKind: kind } : { gardenError: true, gardenKind: kind }); unavailable(result);
});
test("healthy primary today checkout precedence counts time formats history keys and links", async () => {
  assert.notEqual(day("Asia/Jerusalem"), day("UTC"));
  const result = await render(); healthy(result);
  assert.equal(metric(result, "מצב היום").value, "יצא/ה"); assert.equal(metric(result, "מצב היום").tone, "orange");
  assert.equal(metric(result, "ימי היעדרות").value, 1); assert.equal(metric(result, "ימי היעדרות").hint, "6 ימי נוכחות בתקופה");
  assert.equal(metric(result, "שעת יציאה").hint, "איסוף: PICKUP_PERSON");
  assert.equal(metric(result, "שעת הגעה").value, new Date("2026-11-08T06:00:00.000Z").toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }));
  assert.deepEqual(result.zoneFormats, [{ locale: "en-CA", options: { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" } }]);
  assert.ok(result.formats.filter((item) => item.kind === "time").every((item) => item.locale === "he-IL" && item.options.hour === "2-digit" && item.options.minute === "2-digit"));
  assert.equal(nodes(result.tree, "article").length, 8);
  assert.deepEqual(nodes(result.tree, "article").map((node) => node.key), attendanceFixture().map((row) => row.id));
  assert.deepEqual(nodes(result.tree, "article").map((node) => nodes(node, "StatusChip")[0].props.children), ["יצא/ה", "נעדר/ת", "בגן", "יצא/ה", "יצא/ה", "בגן", "יצא/ה", "טרם עודכן"]);
  assert.ok(result.formats.filter((item) => item.kind === "date").every((item) => item.locale === "he-IL"));
  assert.equal(nodes(result.tree, "StatusChip")[0].props.tone, "info");
});
test("nonprimary guardian preserves enrollment child ID selection and garden scope", async () => {
  const family = { sourceUnavailable: false, children: [], enrollments: [{ id: "not-child", permanent_child_file_id: "not-child-file", child_id: "guardian-child", garden_id: "guardian-garden", child: { full_name: "GUARDIAN_CHILD", photo_url: "GUARDIAN_PHOTO" } }] };
  const result = await render({ family }); healthy(result, "guardian-child");
  assert.deepEqual(plain(result.derived), [{ id: "guardian-child", full_name: "GUARDIAN_CHILD", photo_url: "GUARDIAN_PHOTO", garden_id: "guardian-garden" }]);
  assert.equal(nodes(result.tree, "Avatar")[0].props.name, "GUARDIAN_CHILD");
});
test("deduped children and authorized second-child selector keep exact IDs and labels", async () => {
  const family = { sourceUnavailable: false, children: [{ id: "child-1", full_name: "FIRST", garden_id: "garden-1" }, { id: "child-1", full_name: "LATEST", garden_id: "garden-1" }], enrollments: [{ child_id: "child-2", garden_id: "garden-2", child: { full_name: "SECOND" } }, { child_id: "child-2", full_name: "NOT_OVERRIDE" }] };
  const result = await render({ family, params: { child: "child-2" } }); healthy(result, "child-2");
  assert.deepEqual(Array.from(result.derived, (row) => row.id), ["child-1", "child-2"]);
  const select = nodes(result.tree, "select")[0].props; assert.equal(select.defaultValue, "child-2"); assert.equal(select.name, "child");
  assert.deepEqual(nodes(result.tree, "option").map((node) => [node.key, node.props.value, text(node)]), [["child-1", "child-1", "LATEST"], ["child-2", "child-2", "SECOND"]]);
  assert.equal(nodes(result.tree, "form")[0].props.method, "get");
});
test("foreign child query preserves original first-child fallback without new selection policy", async () => { const result = await render({ params: { child: "foreign-child" } }); healthy(result); assert.equal(result.selected.id, "child-1"); assert.ok(!JSON.stringify(result.tree).includes("foreign-child")); });
test("healthy empty family is known empty with no dependent queries", async () => {
  const result = await render({ family: { sourceUnavailable: false, children: [], enrollments: [] } }); healthy(result, null);
  assert.equal(result.identities, 1); assert.deepEqual(result.queries, []); assert.equal(metric(result, "מצב היום").value, "אין ילד משויך");
  assert.equal(metric(result, "ימי היעדרות").value, 0); assert.equal(nodes(result.tree, "ParentEmptyState")[0].props.title, "אין ילד משויך");
});
for (const kind of ["empty", "null"]) test(`healthy attendance ${kind} keeps known empty history`, async () => {
  const result = await render({ attendanceKind: kind }); healthy(result);
  assert.equal(metric(result, "מצב היום").value, "טרם עודכן"); assert.equal(metric(result, "ימי היעדרות").value, 0);
  assert.equal(nodes(result.tree, "ParentEmptyState")[0].props.title, "אין עדיין רשומות נוכחות");
});
test("missing garden payload stops before attendance data and derived rows", async () => {
  const result = await render({ gardenData: null, poisonAttendanceData: true }); unavailable(result); assert.equal(result.attendanceDataReads, 0);
});
test("selected child without garden ID retains missing-context warning without garden query", async () => {
  const result = await render({ family: { sourceUnavailable: false, children: [{ id: "child-1", garden_id: null }], enrollments: [] }, poisonAttendanceData: true });
  unavailable(result); assert.equal(result.queries.length, 1); assert.equal(result.attendanceDataReads, 0);
});
test("parent denial precedes awaiting params client family identity and reads", async () => { await render({ deniedRole: true }); });
test("valid UTC garden timezone selects its actual today instead of Jerusalem today", async () => {
  const result = await render({ gardenData: { operational_timezone: "UTC" } }); healthy(result);
  assert.equal(metric(result, "מצב היום").value, "נעדר/ת"); assert.equal(metric(result, "מצב היום").tone, "red");
  assert.equal(metric(result, "שעת הגעה").value, "—"); assert.equal(result.zoneFormats[0].options.timeZone, "UTC");
});
test("healthy present without checkout retains present state instead of departed", async () => {
  const rows = attendanceFixture(); rows[0].check_out_at = null;
  const result = await render({ rows }); healthy(result); assert.equal(metric(result, "מצב היום").value, "בגן"); assert.equal(metric(result, "מצב היום").tone, "green");
});
test("healthy existing empty garden object preserves default timezone behavior", async () => { const result = await render({ gardenData: {} }); healthy(result); assert.equal(result.zoneFormats[0].options.timeZone, "Asia/Jerusalem"); });
test("healthy invalid timezone still throws rather than introducing normalization policy", async () => { await assert.rejects(render({ gardenData: { operational_timezone: "INVALID_TIME_ZONE" } }), (error) => error.name === "RangeError"); });
test("independent Auth frame avatar fallback survives returned attendance error", async () => { unavailable(await render({ attendanceError: true, ownerProfile: { ...profile, profile_image_url: null } })); });
test("paired returned errors cut both poisoned data getters before warning", async () => {
  const result = await render({ attendanceError: true, gardenError: true, poisonAttendanceData: true, poisonGardenData: true }); unavailable(result);
  assert.equal(result.attendanceDataReads, 0); assert.equal(result.gardenDataReads, 0);
});
