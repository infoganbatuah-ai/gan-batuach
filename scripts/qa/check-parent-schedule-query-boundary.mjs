import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual Server Component only. Closed Auth/SDK/family/UI doubles; no actions,
// actual helper, SDK, env or provider modules. No live Auth/RLS/full-stack proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "app/dashboard/parent/schedule/page.tsx");
assert.ok(statSync(file).isFile(), "schedule source must be a regular file");
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  const flags = Number(raw);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: "parent-schedule.tsx", reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
const script = new vm.Script(output.outputText, { filename: "parent-schedule.js" });
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
const profile = Object.freeze({ id: "parent-1", full_name: "AUTH_PARENT", profile_image_url: "AUTH_AVATAR" });
function healthyRows() {
  return [{ id: "schedule-a", title: "ACTIVITY_A", description: "DESCRIPTION_A", starts_at: "2026-11-07T06:00:00.000Z" }, { id: "schedule-b", title: "ACTIVITY_B", description: "DESCRIPTION_B", starts_at: null }];
}
async function render({ error = false, kind = "stale", familyError = false, gardenIds = ["garden-1"], poisonFamily = false, poisonData = false, rows = healthyRows(), deniedRole = false, ownerProfile = profile } = {}) {
  let admitted = false, clients = 0, helpers = 0;
  const calls = [], dateCalls = [];
  class ObservedDate extends Date {
    constructor(value) { super(value); this.input = value; }
    toLocaleTimeString(locale, options) {
      dateCalls.push({ input: this.input, locale, options: plain(options) });
      return super.toLocaleTimeString(locale, options);
    }
  }
  const family = { sourceUnavailable: familyError, gardenIds };
  if (poisonFamily) Object.defineProperty(family, "gardenIds", { get() { throw new Error("STALE_GARDEN_IDS"); } });
  const result = { error: error ? { message: "PRIVATE_SOURCE_ERROR" } : null, data: kind === "null" ? null : kind === "empty" ? [] : rows };
  if (poisonData) Object.defineProperty(result, "data", { get() { throw new Error("STALE_DATA"); } });
  const client = { from(table) {
    assert.ok(admitted); assert.equal(helpers, 1);
    calls.push(["from", table]);
    const query = {};
    for (const method of ["select", "in", "eq", "order", "limit"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (accept, reject) => Promise.resolve(result).then(accept, reject);
    return query;
  } };
  const imports = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["lucide-react", { CalendarDays: "CalendarDays" }],
    ["@/components/dashboard-shell", { DashboardShell: "DashboardShell" }],
    ["@/components/parent-app-ui", Object.fromEntries(["ParentAppFrame", "ParentEmptyState", "ParentHero", "ParentListRow", "ParentSection"].map((name) => [name, name]))],
    ["@/lib/auth", { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["parent"]); assert.equal(clients + helpers + calls.length + dateCalls.length, 0); if (deniedRole) throw new Error("DENIED"); admitted = true; return { profile: ownerProfile }; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.ok(admitted); clients++; return client; } }],
    ["@/lib/domain/parent-family", { getParentFamilyContext: async (receivedClient, receivedProfile) => { assert.equal(receivedClient, client); assert.equal(receivedProfile, ownerProfile); helpers++; return family; } }],
  ]);
  const exports = {};
  script.runInNewContext({ exports, require: (name) => { assert.ok(imports.has(name), `unlisted import ${name}`); return imports.get(name); }, Date: ObservedDate, fetch: () => { throw new Error("NETWORK_FORBIDDEN"); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  if (deniedRole) { await assert.rejects(exports.default(), /DENIED/); assert.equal(clients + helpers + calls.length + dateCalls.length, 0); return; }
  const tree = await exports.default();
  assert.equal(clients, 1); assert.equal(helpers, 1);
  const shouldQuery = !familyError && gardenIds.length > 0;
  assert.deepEqual(plain(calls), shouldQuery ? [
    ["from", "schedule_items"], ["select", "id, title, description, starts_at, ends_at, visible_to_parents, created_at"],
    ["in", "garden_id", gardenIds], ["eq", "visible_to_parents", true], ["order", "starts_at", { ascending: true }], ["limit", 80],
  ] : []);
  const shell = nodes(tree, "DashboardShell")[0].props;
  assert.equal(shell.role, "parent"); assert.equal(shell.title, "לו״ז ותפריט"); assert.equal(shell.appHome, true);
  const frame = nodes(tree, "ParentAppFrame")[0].props;
  assert.equal(frame.active, "calendar"); assert.equal(frame.profileName, ownerProfile.full_name); assert.equal(frame.avatarUrl, ownerProfile.profile_image_url ?? null);
  const hero = nodes(tree, "ParentHero")[0].props;
  assert.equal(hero.title, "היום של הילד"); assert.equal(hero.subtitle, "סדר יום, אוכל, פעילויות ואירועים שהגן פרסם");
  const section = nodes(tree, "ParentSection")[0].props;
  assert.equal(section.title, "לו״ז, תפריט ופעילויות"); assert.equal(section.subtitle, "מה שהגן פרסם להורים מופיע כאן בצורה פשוטה וברורה.");
  assert.ok(!JSON.stringify(tree).includes("PRIVATE_SOURCE_ERROR"));
  return { tree, calls, dateCalls };
}
function unavailable(result) {
  assert.equal(nodes(result.tree, "ParentListRow").length, 0);
  assert.equal(nodes(result.tree, "ParentEmptyState").length, 0, "failure is not known empty");
  assert.ok(nodes(result.tree).some((node) => node.props.role === "status" && text(node).includes("אינו זמין")));
  assert.deepEqual(result.dateCalls, [], "failed data must not reach date processing");
}
function empty(result) {
  assert.equal(nodes(result.tree, "ParentListRow").length, 0);
  const state = nodes(result.tree, "ParentEmptyState"); assert.equal(state.length, 1);
  assert.equal(state[0].props.title, "אין לו״ז מפורסם כרגע");
  assert.equal(state[0].props.text, "כאשר הגן יפרסם פעילות, תפריט או אירוע להורים, הם יופיעו כאן.");
  assert.equal(nodes(result.tree).filter((node) => node.props.role === "status").length, 0);
  assert.deepEqual(result.dateCalls, []);
}

for (const kind of ["stale", "null", "empty"]) test(`schedule error ${kind} must be unavailable`, async () => {
  const result = await render({ error: true, kind }); unavailable(result);
  assert.equal(result.calls.length, 6, "empty result data must not be confused with empty family scope");
});
test("family unavailable stale IDs stop dependent query", async () => { const result = await render({ familyError: true }); unavailable(result); assert.deepEqual(result.calls, []); });
test("family unavailable empty scope is not a healthy empty schedule", async () => { const result = await render({ familyError: true, gardenIds: [] }); unavailable(result); assert.deepEqual(result.calls, []); });
test("family unavailable cuts poisoned garden IDs before scope derivation", async () => { const result = await render({ familyError: true, poisonFamily: true }); unavailable(result); assert.deepEqual(result.calls, []); });
test("schedule error cuts poisoned row fields before render or date access", async () => {
  const row = {};
  for (const field of ["id", "title", "description", "starts_at"]) Object.defineProperty(row, field, { get() { throw new Error(`STALE_ROW_${field}`); } });
  unavailable(await render({ error: true, rows: [row] }));
});
test("schedule error cuts result data getter before normalization", async () => { unavailable(await render({ error: true, poisonData: true })); });
test("healthy rows keep original order keys icon tone and fields", async () => {
  const result = await render();
  const rows = nodes(result.tree, "ParentListRow");
  assert.deepEqual(rows.map((node) => node.key), ["schedule-a", "schedule-b"]);
  assert.deepEqual(rows.map((node) => node.props.title), ["ACTIVITY_A", "ACTIVITY_B"]);
  assert.deepEqual(rows.map((node) => node.props.subtitle), ["DESCRIPTION_A", "DESCRIPTION_B"]);
  assert.ok(rows.every((node) => node.props.icon === "CalendarDays" && node.props.tone === "purple"));
  assert.equal(rows[1].props.time, undefined);
});
for (const kind of ["empty", "null"]) test(`healthy schedule ${kind} remains legitimate empty after exact query`, async () => {
  const result = await render({ kind }); empty(result); assert.equal(result.calls.length, 6);
});
test("healthy family with no garden IDs remains empty without querying", async () => { const result = await render({ gardenIds: [] }); empty(result); assert.deepEqual(result.calls, []); });
test("parent denial precedes client family query and date IO", async () => { await render({ deniedRole: true }); });
test("multi-garden scope remains exactly the helper IDs and original query contract", async () => {
  const result = await render({ gardenIds: ["garden-a", "garden-b", "garden-a"] });
  assert.deepEqual(result.calls[2], ["in", "garden_id", ["garden-a", "garden-b", "garden-a"]]);
});
test("healthy title description and missing-time nullish fallbacks stay unchanged", async () => {
  const result = await render({ rows: [{ id: "fallback", title: null, description: null, starts_at: null }, { id: "empty-string", title: "", description: "", starts_at: "" }] });
  const rows = nodes(result.tree, "ParentListRow");
  assert.deepEqual(rows.map((node) => [node.props.title, node.props.subtitle, node.props.time]), [["פעילות", "פעילות / תפריט / אירוע", undefined], ["", "", undefined]]);
  assert.deepEqual(result.dateCalls, []);
});
test("healthy date formatting calls actual Date with exact he-IL hour-minute options", async () => {
  const result = await render();
  assert.deepEqual(result.dateCalls, [{ input: "2026-11-07T06:00:00.000Z", locale: "he-IL", options: { hour: "2-digit", minute: "2-digit" } }]);
  assert.equal(nodes(result.tree, "ParentListRow")[0].props.time, new Date("2026-11-07T06:00:00.000Z").toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }));
});
test("independent Auth frame retains null avatar fallback during source failure", async () => {
  unavailable(await render({ error: true, ownerProfile: { ...profile, profile_image_url: null } }));
});
test("paired family and potential schedule failures short-circuit query entirely", async () => {
  const result = await render({ familyError: true, error: true, poisonData: true }); unavailable(result); assert.deepEqual(result.calls, []);
});
test("poisoned scope and result data are both untouched behind family failure", async () => {
  const result = await render({ familyError: true, poisonFamily: true, error: true, poisonData: true }); unavailable(result); assert.deepEqual(result.calls, []);
});
test("healthy empty family does not invent an error from an unused SDK response", async () => {
  const result = await render({ gardenIds: [], error: true, poisonData: true }); empty(result); assert.deepEqual(result.calls, []);
});
