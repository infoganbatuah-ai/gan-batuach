import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page, safe helper and client initial render; synthetic data only.
// Calling the panel's render prop constructs JSX ONLY. No handler/setter/FormData/POST.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/tasks/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const engineSource = source("components/admin-task-engine.tsx"), engineCode = compile(engineSource);
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = [], effect = unexpected) {
  const exports = {};
  vm.runInNewContext(code, { exports, require, Date: FixedDate, FormData: effect, fetch: effect, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } });
  return exports;
}
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const tables = ["tasks", "profiles", "gardens"], keys = ["tasks", "users", "gardens"];
const chainsExpected = [ [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 100]], [["select", "id, full_name, role, garden_id, active"], ["eq", "active", true], ["limit", 300]], [["select", "id, name, city"], ["order", "name"]] ];
function fixtures() { return [
  [{ id: "SYNTHETIC_TASK", title: "SYNTHETIC_TITLE", description: "SYNTHETIC_DESCRIPTION", priority: "high", status: "SYNTHETIC_STATUS", assigned_role: "manager", assigned_to: "SYNTHETIC_ASSIGNEE", due_at: "2026-11-05T00:00:00.000Z", unknown: { zero: 0 } }],
  [{ id: "SYNTHETIC_USER_MANAGER", full_name: "SYNTHETIC_MANAGER_NAME", role: "manager", active: true }, { id: "SYNTHETIC_USER_STAFF", full_name: "SYNTHETIC_STAFF_NAME", role: "staff", active: true }],
  [{ id: "SYNTHETIC_GARDEN", name: "SYNTHETIC_GARDEN_NAME", city: "SYNTHETIC_CITY" }]
]; }
function renderEngine(props, roleOverride) {
  let hook = 0, effects = 0;
  function forbidden() { effects++; throw Error("CLIENT_EFFECT_FORBIDDEN"); }
  const client = load(engineCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "react") return { useMemo: calculate => calculate(), useState: value => { const index = hook++; return [index === 1 && roleOverride !== undefined ? roleOverride : value, forbidden]; } };
    if (id === "@/components/collapsible-action-panel") return { CollapsibleActionPanel: "CollapsibleActionPanel" };
    return unexpected(id);
  }, [], forbidden);
  const tree = client.AdminTaskEngine(props); assert.equal(hook, 5);
  const panels = nodes(tree, "CollapsibleActionPanel");
  const formTree = panels.length ? panels[0].props.children({ close: forbidden }) : null;
  assert.equal(effects, 0);
  return { tree, panels, formTree, forms: nodes(formTree, "form"), rows: nodes(tree, "article"), effects };
}
async function page({ failures = {}, data = fixtures(), loader = false, denied = false } = {}) {
  let clients = 0, helperCalls = 0;
  const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: (...a) => { helperCalls++; assert.match(a[0], /^משימות(?: [0-2])?$/); return actual.safeAdminData(...a); } };
  const client = { from(table) {
    const i = tables.indexOf(table); assert.ok(i >= 0); assert.equal(chains.length, i);
    const calls = [], q = {}; chains.push([table, calls]);
    if (failures[i] === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "order", "limit", "eq"]) q[method] = (...a) => { calls.push([method, ...a]); return q; };
    q.then = (yes, no) => {
      assert.equal(chains.length, 3, "all three factories attempted before settlement");
      return (failures[i] === "reject" ? Promise.reject(Error("PRIVATE_REJECTION")) : Promise.resolve({ data: data[i], error: failures[i] === "returned" ? { message: "PRIVATE_ERROR", details: "PRIVATE_DETAILS" } : null })).then(yes, no);
    };
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "@/components/dashboard-shell") return { DashboardShell: "DashboardShell" };
    if (id === "@/components/admin-data-state") return { AdminDataError: "AdminDataError" };
    if (id === "@/components/admin-task-engine") return { AdminTaskEngine: "AdminTaskEngine" };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(clients, 1); assert.equal(helperCalls, loader ? 1 : 4);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_"));
  const props = nodes(tree, "AdminTaskEngine")[0].props;
  return { tree, chains, warnings, props, client: renderEngine(props), banner: nodes(tree, "AdminDataError")[0].props.message };
}
function contracts(r, failures = {}, data = fixtures(), loader = false) {
  assert.deepEqual(plain(r.chains), loader ? [] : tables.map((table, i) => [table, failures[i] === "factory" ? [] : chainsExpected[i]]));
  const shell = nodes(r.tree, "DashboardShell")[0]; assert.equal(shell.props.role, "admin"); assert.equal(shell.props.title, "משימות");
  const hero = nodes(r.tree, "div").find(n => n.props.className === "dashboard-hero-card admin-hero-card");
  assert.ok(text(hero).includes("יצירת משימות ומעקב ביצוע.")); assert.ok(text(hero).includes("משימות אישיות בגן או בהנהלה, עם עדיפות ודדליין. שיוך למשתמש נבדק מול קשר פעיל לגן."));
  assert.equal(nodes(hero, "span")[0].props.className, "pill"); assert.equal(text(nodes(hero, "span")[0]), "משימות"); assert.ok(!text(hero).includes("Production UI"));
  const availability = Object.fromEntries(keys.map((key, i) => [key, !loader && !failures[i]]));
  assert.deepEqual(plain(r.props.availability), availability);
  for (let i = 0; i < 3; i++) {
    if (!availability[keys[i]] || data[i] === null) assert.deepEqual(Array.from(r.props[keys[i]]), []);
    else assert.equal(r.props[keys[i]], data[i]);
  }
  const unknown = !Object.values(availability).every(Boolean);
  assert.equal(r.banner, unknown ? "לא ניתן לטעון את הנתונים כרגע" : null);
  const expectedWarnings = loader ? [["Admin page data unavailable:", "משימות"]] : Object.entries(failures).map(([i, kind]) => [kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:", `משימות ${i}`]);
  assert.deepEqual(plain(r.warnings).sort((a, b) => a[1].localeCompare(b[1])), expectedWarnings);
  assert.equal(r.client.panels.length, unknown ? 0 : 1); assert.equal(r.client.forms.length, unknown ? 0 : 1); assert.equal(r.client.effects, 0);
  if (unknown) {
    assert.ok(text(r.client.tree).includes("יצירת משימה אינה זמינה")); assert.equal(nodes(r.client.tree, "button").length, 0); assert.equal(nodes(r.client.tree, "option").length, 0);
    assert.ok(!JSON.stringify(r.client.tree).includes("SYNTHETIC_MANAGER_NAME")); assert.ok(!JSON.stringify(r.client.tree).includes("SYNTHETIC_GARDEN_NAME"));
  } else assert.equal(r.client.panels[0].props.defaultOpen, (data[0] ?? []).length === 0);
  if (!availability.tasks) {
    assert.equal(r.client.rows.length, 0); assert.ok(text(r.client.tree).includes("נתוני המשימות אינם זמינים")); assert.ok(!text(r.client.tree).includes("אין משימות עדיין")); assert.ok(!text(r.client.tree).includes("SYNTHETIC_TITLE"));
  } else {
    assert.deepEqual(r.client.rows.map(n => n.key), (data[0] ?? []).map(n => n.id));
    assert.equal(text(r.client.tree).includes("אין משימות עדיין"), (data[0] ?? []).length === 0);
    assert.ok(!text(r.client.tree).includes("נתוני המשימות אינם זמינים"));
  }
}
function formContract(client) {
  assert.equal(client.forms.length, 1); const form = client.forms[0]; assert.equal(form.props.className, "card form wizard-form");
  assert.deepEqual(nodes(form, "select").map(n => n.props.name), ["assigned_role", "garden_id", "assigned_to", "priority"]);
  assert.deepEqual(nodes(form, "input").map(n => [n.props.name, n.props.type ?? null, n.props.required ?? false]), [["title", null, true], ["due_at", "datetime-local", false]]);
  assert.deepEqual(nodes(form, "textarea").map(n => [n.props.name, n.props.rows]), [["description", 4]]);
  const selects = nodes(form, "select");
  assert.deepEqual(nodes(selects[0], "option").map(n => n.props.value), ["staff", "manager", "owner", "inspector", "admin"]);
  assert.deepEqual(nodes(selects[3], "option").map(n => n.props.value), ["low", "medium", "high", "critical"]);
  assert.equal(nodes(selects[1], "option")[0].props.value, ""); assert.equal(nodes(selects[2], "option")[0].props.value, "");
  assert.ok(text(client.formTree).includes("המשימה תופיע למשתמש רק אם יש לו הרשאה פעילה לגן"));
}
test("healthy actualpage/helper/engine exactbatch form defaults and known readonly rows", async () => {
  const data = fixtures(), r = await page({ data }); contracts(r, {}, data); formContract(r.client);
  const selects = nodes(r.client.forms[0], "select");
  assert.deepEqual(nodes(selects[2], "option").map(n => n.props.value), ["", "SYNTHETIC_USER_MANAGER"]);
  assert.deepEqual(nodes(selects[1], "option").map(n => n.props.value), ["", "SYNTHETIC_GARDEN"]);
  assert.ok(text(r.client.rows[0]).includes("SYNTHETIC_TITLE"));
});
for (let i = 0; i < 3; i++) for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory"]) test(`source${i}/${mode} creation denied known tasks independent`, async () => {
  const data = fixtures(), failures = { [i]: mode.startsWith("returned") ? "returned" : mode };
  if (mode === "returned-empty") data[i] = []; if (mode === "returned-null") data[i] = null;
  const r = await page({ failures, data }); contracts(r, failures, data);
});
for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) for (const kind of ["returned", "reject", "factory"]) test(`paired${a}/${b}/${kind} preserve independent source and failclosedcreation`, async () => {
  const data = fixtures(), failures = { [a]: kind, [b]: "reject" }, r = await page({ failures, data }); contracts(r, failures, data);
});
test("all sources fail no stale task list/form/options", async () => { const data = fixtures(), failures = { 0: "returned", 1: "reject", 2: "factory" }, r = await page({ data, failures }); contracts(r, failures, data); });
test("loader failure safe shell allunknown noqueries no form", async () => { const data = fixtures(), r = await page({ data, loader: true }); contracts(r, {}, data, true); });
test("deniedadmin0clients/helpers/queries", async () => { await page({ denied: true }); });
for (let mask = 0; mask < 8; mask++) test(`allknown empty/null mask${mask} legitimate creation and emptylist retained`, async () => {
  const data = keys.map((_, i) => mask & (1 << i) ? null : []), r = await page({ data }); contracts(r, {}, data); formContract(r.client);
  assert.equal(r.client.panels[0].props.defaultOpen, true);
});
for (const empty of [false, true]) test(`omitted optional availability compatibility ${empty ? "empty" : "knownrows"}`, () => {
  const data = empty ? [[], [], []] : fixtures(), client = renderEngine(Object.fromEntries(keys.map((key, i) => [key, data[i]])));
  formContract(client); assert.equal(client.panels[0].props.defaultOpen, empty); assert.equal(client.rows.length, data[0].length);
});
for (let mask = 0; mask < 8; mask++) test(`currentavailability mask${mask} hides cachedrows/creation independently`, () => {
  const data = fixtures(), availability = Object.fromEntries(keys.map((key, i) => [key, Boolean(mask & (1 << i))]));
  const client = renderEngine({ ...Object.fromEntries(keys.map((key, i) => [key, data[i]])), availability });
  assert.equal(client.rows.length, availability.tasks ? 1 : 0); assert.equal(client.forms.length, mask === 7 ? 1 : 0);
  assert.equal(text(client.tree).includes("אין משימות עדיין"), false);
});
for (const value of [null, undefined, 0, ""]) test(`raw NULLISH row fields ${typeof value}/${String(value)} preserved`, () => {
  const data = fixtures(); data[0] = [{ ...data[0][0], priority: value, description: value, assigned_role: value, assigned_to: "SYNTHETIC_ASSIGNEE", status: value, due_at: null }];
  const client = renderEngine({ tasks: data[0], users: data[1], gardens: data[2] }), row = client.rows[0];
  assert.equal(nodes(row, "span")[0].props.children, value ?? "medium"); assert.equal(nodes(row, "p")[0].props.children, value ?? "");
  assert.equal(nodes(row, "span")[1].props.children, value ?? "open"); assert.ok(text(row).includes(`יעד: ${value ?? "SYNTHETIC_ASSIGNEE"}`));
});
for (const due of [null, undefined, 0, ""]) test(`stored due_at TRUTHY ${String(due)} remains no-deadline`, () => {
  const data = fixtures(); data[0][0].due_at = due; const client = renderEngine({ tasks: data[0], users: data[1], gardens: data[2] }); assert.ok(text(client.rows[0]).endsWith("ללאSYNTHETIC_STATUS"));
});
test("truthy due date formatting uses original heIL path and fixedclock", () => {
  const data = fixtures(), client = renderEngine({ tasks: data[0], users: data[1], gardens: data[2] }); assert.ok(text(client.rows[0]).includes(new FixedDate(data[0][0].due_at).toLocaleString("he-IL")));
});
for (const role of ["", "staff"]) test(`readonly filteredUsers state ${role || "all"} no setters invoked`, () => {
  const data = fixtures(), client = renderEngine({ tasks: data[0], users: data[1], gardens: data[2] }, role);
  const options = nodes(nodes(client.forms[0], "select")[2], "option"); assert.deepEqual(options.map(n => n.props.value), ["", ...data[1].filter(user => !role || user.role === role).map(user => user.id)]); assert.equal(client.effects, 0);
});
test("query100 does not introduce local row clamp sorting or coercion", async () => {
  const data = fixtures(); data[0] = Array.from({ length: 103 }, (_, i) => ({ ...data[0][0], id: `SYNTHETIC_TASK_${102 - i}` }));
  const r = await page({ data }); contracts(r, {}, data); assert.equal(r.props.tasks, data[0]); assert.equal(r.client.rows.length, 103);
});
test("submit has first-statement currentavailability guard before FormData/postTask without invoking handler", () => {
  const file = ts.createSourceFile("admin-task-engine.tsx", engineSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let submit; function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "submit") submit = node; ts.forEachChild(node, visit); } visit(file); assert.ok(submit);
  const guard = submit.body.statements[0]; assert.ok(ts.isIfStatement(guard)); assert.equal(guard.expression.getText(file), "!creationAvailable"); assert.ok(ts.isReturnStatement(guard.thenStatement));
  const body = submit.body.getText(file); assert.ok(body.indexOf("if (!creationAvailable) return;") < body.indexOf("new FormData(form)")); assert.ok(body.indexOf("if (!creationAvailable) return;") < body.indexOf("await postTask("));
  assert.ok(engineSource.includes('fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })'));
});
test("one exact DOMAIN hook no unrelated security hook", () => {
  const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-tasks-query-boundary";
  assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-tasks-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0);
});
