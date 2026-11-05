import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page and shared safe loader; readonly synthetic responses only.
// Admin SDK constructor is STUBBED: its real module, credentials and env never load.
// Workspace/report clients and their effectful handlers are never executed.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/complaints/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_SDK_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) {
  const exports = {};
  vm.runInNewContext(code, { exports, require, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } });
  return exports;
}
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const profile = { id: "SYNTHETIC_ADMIN", role: "admin" };
const tables = ["complaints", "incident_reports"];
const projections = ["*, gardens(name, city), parents(full_name), children(full_name), assignee:assigned_to(full_name)", "*, gardens(name, city), children(full_name), assignee:assigned_to(full_name), reporter:reported_by(full_name, role)"];
function fixtures() { return tables.map((_, index) => [{ id: `SYNTHETIC_ROW_${index}`, title: `SYNTHETIC_TITLE_${index}`, body: `SYNTHETIC_BODY_${index}`, status: "SYNTHETIC_STATUS", gardens: { name: "SYNTHETIC_GARDEN", city: "SYNTHETIC_CITY" }, parents: { full_name: "SYNTHETIC_PARENT" }, children: { full_name: "SYNTHETIC_CHILD" }, assignee: { full_name: "SYNTHETIC_ASSIGNEE" }, reporter: { full_name: "SYNTHETIC_REPORTER", role: "SYNTHETIC_ROLE" }, unknown: { zero: 0, empty: "", relative: "/dashboard/admin/complaints" } }]); }
async function page({ failures = {}, data = fixtures(), loader = false, denied = false } = {}) {
  let constructors = 0, helperCalls = 0, captured;
  const chains = [], warnings = [];
  const actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...a) => {
    helperCalls++; assert.match(a[0], /^דיווחים ופניות(?: [01])?$/);
    const result = await actual.safeAdminData(...a); if (a[0] === "דיווחים ופניות") captured = result; return result;
  } };
  const client = { from(table) {
    const index = tables.indexOf(table); assert.ok(index >= 0); assert.equal(chains.length, index);
    const calls = [], q = {}; chains.push([table, calls]);
    if (failures[index] === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "order", "limit"]) q[method] = (...a) => { calls.push([method, ...a]); return q; };
    q.then = (yes, no) => {
      assert.equal(chains.length, 2, "both factories attempted in one batch before settlement");
      return (failures[index] === "reject" ? Promise.reject(Error("PRIVATE_REJECTION")) : Promise.resolve({ data: data[index], error: failures[index] === "returned" ? { message: "PRIVATE_ERROR", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no);
    };
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "@/components/admin-app-ui") return { AdminAppFrame: "AdminAppFrame" };
    if (id === "@/components/admin-data-state") return { AdminDataError: "AdminDataError" };
    if (id === "@/components/complaint-workspace") return { ComplaintWorkspace: "ComplaintWorkspace" };
    if (id === "@/components/admin-reports-center") return { AdminReportsCenter: "AdminReportsCenter" };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(constructors, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); return { profile }; } };
    if (id === "@/lib/supabase/admin") return { createAdminClient: () => { constructors++; if (loader) throw Error("PRIVATE_CONSTRUCTOR"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(constructors, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default();
  assert.equal(constructors, 1); assert.equal(helperCalls, loader ? 1 : 3);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_"));
  assert.equal(nodes(tree, "button").length, 0); assert.equal(nodes(tree, "form").length, 0); assert.equal(nodes(tree, "Link").length, 0);
  return { tree, chains, warnings, data: captured.data, error: captured.error, workspace: nodes(tree, "ComplaintWorkspace"), reports: nodes(tree, "AdminReportsCenter"), details: nodes(tree, "details"), banner: nodes(tree, "AdminDataError")[0].props.message };
}
function contracts(r, failures = {}, data = fixtures(), loader = false) {
  assert.deepEqual(plain(r.chains), loader ? [] : tables.map((table, i) => [table, failures[i] === "factory" ? [] : [["select", projections[i]], ["order", "created_at", { ascending: false }], ["limit", 150]]]));
  const frame = nodes(r.tree, "AdminAppFrame")[0]; assert.equal(frame.props.profile, profile);
  assert.equal(frame.props.activeHref, "/dashboard/admin/complaints"); assert.equal(frame.props.title, "תלונות והסלמות");
  assert.equal(frame.props.subtitle, "פיקוח פלטפורמה לפי הרשאה, SLA והצורך התפעולי."); assert.equal(frame.props.badge, "תלונות");
  const unknown = i => loader || Boolean(failures[i]);
  assert.equal(r.data.complaintsAvailable, !unknown(0)); assert.equal(r.data.incidentsAvailable, !unknown(1));
  assert.equal(r.workspace.length, unknown(0) ? 0 : 1);
  if (!unknown(0)) {
    const workspace = r.workspace[0]; assert.equal(workspace.props.role, "admin"); assert.equal(workspace.props.title, "תלונות מכל המערכת");
    assert.equal(workspace.props.scopeMessage, "תצוגת אדמין מורשית. פעולות ותוכן מוצגים לפי מדיניות ההרשאה והבידוד הקנונית.");
    if (data[0] !== null) assert.equal(workspace.props.rows, data[0]); else assert.deepEqual(Array.from(workspace.props.rows), []);
    assert.deepEqual(Object.keys(workspace.props).sort(), ["role", "rows", "scopeMessage", "title"]);
  } else assert.deepEqual(Array.from(r.data.complaints), []);
  const hasIncidents = !unknown(1) && (data[1] ?? []).length > 0;
  assert.equal(r.reports.length, hasIncidents ? 1 : 0); assert.equal(r.details.length, hasIncidents ? 1 : 0);
  if (hasIncidents) {
    assert.equal(r.reports[0].props.incidents, data[1]); assert.deepEqual(Array.from(r.reports[0].props.complaints), []);
    assert.deepEqual(Object.keys(r.reports[0].props).sort(), ["complaints", "incidents"]);
    assert.equal(r.details[0].props.className, "teacher-management-details"); assert.equal(text(nodes(r.details[0], "summary")[0]), "דיווחי אירוע נפרדים");
  }
  if (unknown(1)) assert.deepEqual(Array.from(r.data.incidents), []);
  const sections = nodes(r.tree, "section");
  for (let i = 0; i < 2; i++) {
    const label = i ? "נתוני אירועים לא זמינים" : "נתוני פניות לא זמינים";
    const state = sections.filter(n => n.props["aria-label"] === label); assert.equal(state.length, unknown(i) ? 1 : 0);
    if (unknown(i)) { assert.equal(state[0].props.className, "card"); assert.equal(state[0].props.role, "status"); assert.ok(!JSON.stringify(state[0]).includes("SYNTHETIC_")); }
  }
  assert.equal(r.banner, unknown(0) || unknown(1) ? "לא ניתן לטעון את הנתונים כרגע" : null);
  const expectedWarnings = loader ? [["Admin page data unavailable:", "דיווחים ופניות"]] : Object.entries(failures).map(([i, kind]) => [kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:", `דיווחים ופניות ${i}`]);
  assert.deepEqual(plain(r.warnings).sort((a, b) => a[1].localeCompare(b[1])), expectedWarnings);
}
test("healthy original readonly query batch/profile/client props and raw identities", async () => {
  const data = fixtures(), r = await page({ data }); contracts(r, {}, data);
  assert.equal(r.workspace[0].props.rows[0], data[0][0]); assert.equal(r.reports[0].props.incidents[0], data[1][0]);
});
for (let index = 0; index < 2; index++) for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory"]) test(`source${index}/${mode} failed client absent independent neighbor retained`, async () => {
  const data = fixtures(), failures = { [index]: mode.startsWith("returned") ? "returned" : mode };
  if (mode === "returned-empty") data[index] = []; if (mode === "returned-null") data[index] = null;
  const r = await page({ data, failures }); contracts(r, failures, data);
  assert.ok(!JSON.stringify(r.tree).includes(`SYNTHETIC_ROW_${index}`)); assert.ok(!JSON.stringify(r.tree).includes(`SYNTHETIC_BODY_${index}`));
});
for (const first of ["returned", "reject", "factory"]) for (const second of ["returned", "reject", "factory"]) test(`bothfail ${first}/${second} no workspace/reports no ordinaryempty substitute`, async () => {
  const data = fixtures(), failures = { 0: first, 1: second }, r = await page({ data, failures }); contracts(r, failures, data);
  assert.equal(r.workspace.length, 0); assert.equal(r.reports.length, 0); assert.ok(!/SYNTHETIC_(?:ROW_|BODY_|PARENT|CHILD|ASSIGNEE|REPORTER)/.test(JSON.stringify(r.tree)));
});
for (const complaints of [[], null]) for (const incidents of [[], null]) test(`healthy empty/null ${complaints === null}/${incidents === null} workspace originalempty incidenthidden noerror`, async () => {
  const data = [complaints, incidents], r = await page({ data }); contracts(r, {}, data); assert.equal(r.workspace.length, 1); assert.equal(r.reports.length, 0); assert.equal(r.banner, null);
});
for (let index = 0; index < 2; index++) for (const neighbor of [[], null]) for (const kind of ["returned", "reject"]) test(`source${index}/${kind} neighborhealthy ${neighbor === null ? "null" : "empty"} noterroneouslyunknown`, async () => {
  const data = fixtures(), failures = { [index]: kind }; data[1 - index] = neighbor;
  const r = await page({ data, failures }); contracts(r, failures, data);
});
test("constructor failure safe original frame bothunknown zero query no SDK import", async () => { const data = fixtures(), r = await page({ data, loader: true }); contracts(r, {}, data, true); });
test("admission denial propagates before admin constructor helper or query", async () => { await page({ denied: true }); });
test("raw row order unknownfields nullishzero values unchanged no local150 clamp", async () => {
  const data = fixtures().map(rows => Array.from({ length: 153 }, (_, i) => ({ ...rows[0], id: `${rows[0].id}_${152 - i}`, title: i ? null : "", status: i ? 0 : "", unknown: { zero: 0, empty: "" } })));
  const r = await page({ data }); contracts(r, {}, data);
  assert.equal(r.workspace[0].props.rows.length, 153); assert.equal(r.reports[0].props.incidents.length, 153);
  assert.equal(r.workspace[0].props.rows[152], data[0][152]); assert.equal(r.reports[0].props.incidents[152], data[1][152]);
});
test("one exact domain hook no unrelated security hook", () => {
  const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-complaints-query-boundary";
  assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-complaints-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0);
});
