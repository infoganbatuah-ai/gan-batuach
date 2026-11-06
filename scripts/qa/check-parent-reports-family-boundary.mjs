import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual page only, opaque ReportsCenter/DashboardShell and closed Auth/SDK/family.
// No report effect graph, real helper, SDK/env/provider, requests or RLS proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "app/dashboard/parent/reports/page.tsx");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: "parent-reports.tsx", reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
const script = new vm.Script(output.outputText, { filename: "parent-reports.js" });
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
const profile = Object.freeze({ id: "parent-1", full_name: "AUTH_PARENT", garden_id: "auth-garden" });
function familyFixture() {
  return { sourceUnavailable: false, children: [{ id: "child-a", full_name: "CHILD_A" }], enrollments: [{ child_id: "child-b", full_name: "GUARDIAN_CHILD" }], gardens: [{ id: "garden-1", name: "GARDEN_ONE" }], gardenIds: ["garden-1"] };
}
function emptyFamily(sourceUnavailable = false) { return { sourceUnavailable, children: [], enrollments: [], gardens: [], gardenIds: [] }; }
async function render({ family = familyFixture(), ownerProfile = profile, deniedRole = false, helperThrows = false } = {}) {
  let admitted = false, clients = 0, helpers = 0, queries = 0;
  const steps = [];
  const client = { from() { queries++; throw new Error("UNEXPECTED_QUERY"); } };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["@/components/dashboard-shell", { DashboardShell: "DashboardShell" }],
    ["@/components/reports-center", { ReportsCenter: "ReportsCenter" }],
    ["@/lib/auth", { requireRole: async (roles) => { steps.push("auth"); assert.deepEqual(Array.from(roles), ["parent"]); assert.equal(clients + helpers + queries, 0); if (deniedRole) throw new Error("DENIED"); admitted = true; return { profile: ownerProfile }; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.ok(admitted); assert.deepEqual(steps, ["auth"]); clients++; steps.push("client"); return client; } }],
    ["@/lib/domain/parent-family", { getParentFamilyContext: async (receivedClient, receivedProfile) => { assert.equal(receivedClient, client); assert.equal(receivedProfile, ownerProfile); helpers++; steps.push("family"); if (helperThrows) throw new Error("EXPECTED_HELPER_THROW"); return family; } }],
  ]);
  const exports = {};
  script.runInNewContext({ exports, require: (name) => { assert.ok(modules.has(name), `unlisted import ${name}`); return modules.get(name); }, fetch: () => { throw new Error("NETWORK_FORBIDDEN"); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  if (deniedRole) { await assert.rejects(exports.default(), /DENIED/); assert.equal(clients + helpers + queries, 0); assert.deepEqual(steps, ["auth"]); return; }
  const tree = await exports.default();
  assert.equal(clients, 1); assert.equal(helpers, 1); assert.equal(queries, 0);
  assert.deepEqual(steps, ["auth", "client", "family"]);
  const shell = nodes(tree, "DashboardShell"); assert.equal(shell.length, 1);
  assert.equal(shell[0].props.role, "parent"); assert.equal(shell[0].props.title, "הדוחות שלי"); assert.equal(shell[0].props.appHome, true);
  assert.equal(nodes(tree, "h1").length, 1); assert.equal(text(nodes(tree, "h1")[0]), "הדוחות שלי");
  const header = nodes(tree, "div").find((node) => node.props.className === "page-header"); assert.ok(header);
  assert.ok(text(header).includes("סיכומים רק עבור הילדים שהקשר ההורי אליהם פעיל ומורשה."));
  return { tree };
}
function unavailable(result) {
  assert.equal(nodes(result.tree, "ReportsCenter").length, 0);
  assert.ok(nodes(result.tree).some((node) => node.props.role === "status" && text(node) === "נתוני המשפחה אינם זמינים כרגע. לא ניתן להציג דוחות עד לטעינתם מחדש."));
  assert.ok(!JSON.stringify(result.tree).includes("STALE_"));
}
function reports(result) {
  assert.equal(nodes(result.tree).filter((node) => node.props.role === "status" || node.props.role === "alert").length, 0);
  const centers = nodes(result.tree, "ReportsCenter"); assert.equal(centers.length, 1); assert.equal(centers[0].props.role, "parent"); return centers[0].props;
}

for (const kind of ["stale", "empty", "children", "enrollments", "gardens", "gardenIds"]) test(`unavailable parent reports family ${kind} stops identity mapping and controls`, async () => {
  const family = kind === "empty" ? emptyFamily(true) : { sourceUnavailable: true, children: [{ id: "stale-child", full_name: "STALE_CHILD" }], enrollments: [{ child_id: "stale-enrollment", full_name: "STALE_ENROLLMENT" }], gardens: [{ id: "stale-garden", name: "STALE_GARDEN" }], gardenIds: ["stale-garden"] };
  if (["children", "enrollments", "gardens", "gardenIds"].includes(kind)) Object.defineProperty(family, kind, { get() { throw new Error(`STALE_${kind}`); } });
  unavailable(await render({ family, ownerProfile: { ...profile, garden_id: null } }));
});
test("parent denial precedes client helper and query IO", async () => { await render({ deniedRole: true }); });
test("healthy primary child options and garden labels keep their original contract", async () => {
  const family = familyFixture(); family.enrollments = [];
  const props = reports(await render({ family }));
  assert.deepEqual(plain(props.childOptions), [{ id: "child-a", label: "CHILD_A" }]);
  assert.deepEqual(plain(props.gardens), [{ id: "garden-1", label: "GARDEN_ONE" }]);
});
test("healthy nonprimary enrollment options keep child IDs not enrollment IDs", async () => {
  const family = familyFixture(); family.children = []; family.enrollments = [{ id: "enrollment-not-child", child_id: "guardian-child", full_name: "GUARDIAN_CHILD" }];
  assert.deepEqual(plain(reports(await render({ family })).childOptions), [{ id: "guardian-child", label: "GUARDIAN_CHILD" }]);
});
test("original children-first Map overrides and nullish labels remain exact", async () => {
  const family = { sourceUnavailable: false,
    children: [{ id: "a", full_name: "First A" }, { id: "b", full_name: "" }, { id: "c", full_name: null }, { id: "a", full_name: "Latest A" }],
    enrollments: [{ child_id: "a", full_name: "Enrollment override" }, { child_id: "d", full_name: null }, { child_id: "b", full_name: "" }, { child_id: null }, { child_id: "" }, { child_id: "a", full_name: undefined }],
    gardens: [{ id: "g1", name: "First" }, { id: "g1", name: "Second" }, { id: "g2", name: "" }, { id: "g3", name: null }], gardenIds: ["g1"],
  };
  const props = reports(await render({ family }));
  assert.deepEqual(plain(props.childOptions), [{ id: "a", label: "ילד/ה" }, { id: "b", label: "" }, { id: "c", label: "ילד/ה" }, { id: "d", label: "ילד/ה" }]);
  assert.deepEqual(plain(props.gardens), [{ id: "g1", label: "First" }, { id: "g1", label: "Second" }, { id: "g2", label: "" }, { id: "g3", label: "גן" }]);
});
const gardenCases = [
  ["profile wins", "auth-garden", ["family-garden"], "auth-garden"],
  ["null profile falls back", null, ["family-garden"], "family-garden"],
  ["undefined profile falls back", undefined, ["family-garden"], "family-garden"],
  ["empty profile is not nullish", "", ["family-garden"], ""],
  ["empty family first ID is not nullish", null, ["", "next-garden"], ""],
  ["no profile or family first ID", undefined, [], null],
];
for (const [name, profileGarden, familyIds, expected] of gardenCases) test(`garden precedence ${name}`, async () => {
  const family = familyFixture(); family.gardenIds = familyIds;
  assert.equal(reports(await render({ family, ownerProfile: { ...profile, garden_id: profileGarden } })).gardenId, expected);
});
test("healthy empty family arrays keep an available empty ReportsCenter", async () => {
  const props = reports(await render({ family: emptyFamily(), ownerProfile: { ...profile, garden_id: null } }));
  assert.deepEqual(plain(props.childOptions), []); assert.deepEqual(plain(props.gardens), []); assert.equal(props.gardenId, null);
});
for (const field of ["child", "enrollment", "garden"]) test(`failed family never reads stale ${field} identity fields`, async () => {
  const family = familyFixture(); family.sourceUnavailable = true;
  if (field === "child") family.children = [{ get id() { throw new Error("STALE_CHILD_ID"); }, get full_name() { throw new Error("STALE_CHILD_LABEL"); } }];
  if (field === "enrollment") family.enrollments = [{ get child_id() { throw new Error("STALE_ENROLLMENT_ID"); }, get full_name() { throw new Error("STALE_ENROLLMENT_LABEL"); } }];
  if (field === "garden") family.gardens = [{ get id() { throw new Error("STALE_GARDEN_ID"); }, get name() { throw new Error("STALE_GARDEN_LABEL"); } }];
  unavailable(await render({ family }));
});
test("failed family returns before any profile garden fallback selection", async () => {
  const ownerProfile = { ...profile, get garden_id() { throw new Error("STALE_PROFILE_GARDEN_SELECTION"); } };
  const family = emptyFamily(true);
  unavailable(await render({ family, ownerProfile }));
});
test("thrown family helper keeps its original rejected-page behavior", async () => { await assert.rejects(render({ helperThrows: true }), /EXPECTED_HELPER_THROW/); });
