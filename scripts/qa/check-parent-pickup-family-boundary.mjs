import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual page + actual pure child-ID helper. Closed Auth/SDK/family/UI doubles.
// Pickup center/actions are opaque; no release event, submit or service executes.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const allowlistedSources = new Set(["app/dashboard/parent/pickup/page.tsx", "lib/domain/parent-attendance-children.ts"]);
function read(relative) {
  assert.ok(allowlistedSources.has(relative));
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
  const output = ts.transpileModule(source, { fileName: name, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
  return output.outputText;
}
const pageCode = compile(read("app/dashboard/parent/pickup/page.tsx"), "parent-pickup.tsx");
const helperSource = read("lib/domain/parent-attendance-children.ts");
const helperAST = ts.createSourceFile("parent-attendance-children.ts", helperSource, ts.ScriptTarget.ES2022, true);
assert.equal(helperAST.parseDiagnostics.length, 0);
assert.ok(helperAST.statements.every((node) => ts.isTypeAliasDeclaration(node) || ts.isFunctionDeclaration(node)), "only the existing pure types/functions may be evaluated");
const helperCode = compile(helperSource, "parent-attendance-children.ts");
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
function deny(name = "effect") { throw new Error(`UNEXPECTED_IMPORT_OR_EFFECT:${String(name)}`); }
function load(code, require) {
  const exports = {};
  new vm.Script(code).runInNewContext({ exports, require, fetch: () => deny("fetch") }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports;
}
const actual = load(helperCode, deny);
const profile = Object.freeze({ id: "synthetic-profile", full_name: "AUTH_PARENT", profile_image_url: "AUTH_AVATAR" });
function familyFixture() {
  return { sourceUnavailable: false, children: [{ id: "child-1", full_name: "CHILD_ONE", photo_url: "CHILD_PHOTO", garden_id: "garden-1" }], enrollments: [] };
}
function unavailableFamily(kind) {
  const family = familyFixture(); family.sourceUnavailable = true;
  if (kind === "enrollment") { family.children = []; family.enrollments = [{ child_id: "stale-child", full_name: "STALE_CHILD", garden_id: "stale-garden" }]; }
  if (kind === "childrenGetter") Object.defineProperty(family, "children", { get() { throw new Error("STALE_CHILDREN"); } });
  if (kind === "enrollmentsGetter") Object.defineProperty(family, "enrollments", { get() { throw new Error("STALE_ENROLLMENTS"); } });
  if (kind === "childId") Object.defineProperty(family.children[0], "id", { get() { throw new Error("STALE_CHILD_ID"); } });
  return family;
}
async function render({ family = familyFixture(), failures = {}, data = [[{ id: "contact-1", child_id: "child-1" }], [{ id: "event-1", child_id: "child-1" }]], deniedRole = false, ownerProfile = profile } = {}) {
  let admitted = false, clients = 0, familyCalls = 0, identityCalls = 0;
  let helperInputs, helperChildren;
  const chains = [], resolved = [];
  const tables = ["authorized_pickup_contacts", "child_pickup_events"];
  const client = { from(table) {
    assert.ok(admitted); assert.equal(familyCalls, 1); assert.equal(identityCalls, 1);
    const index = chains.length; assert.equal(table, tables[index]);
    const operations = []; chains.push([table, operations]);
    const query = {};
    for (const method of ["select", "in", "order", "limit"]) query[method] = (...args) => { operations.push([method, ...args]); return query; };
    query.then = (accept, reject) => {
      assert.equal(chains.length, 2, "both pickup reads remain parallel"); resolved.push(index);
      const kind = failures[index], limit = operations.find(([method]) => method === "limit")[1];
      const payload = kind === "null" ? null : kind === "empty" ? [] : Array.isArray(data[index]) ? data[index].slice(0, limit) : data[index];
      return Promise.resolve({ data: payload, error: kind ? { message: "PRIVATE_SOURCE_ERROR" } : null }).then(accept, reject);
    };
    return query;
  } };
  const modules = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }], ["lucide-react", { ShieldCheck: "ShieldCheck" }],
    ["@/components/dashboard-shell", { DashboardShell: "DashboardShell" }],
    ["@/components/parent-app-ui", Object.fromEntries(["ParentAppFrame", "ParentEmptyState", "ParentHero", "ParentSection"].map((name) => [name, name]))],
    ["@/components/pickup-verification-panels", { ParentPickupCenter: "ParentPickupCenter" }],
    ["@/lib/auth", { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["parent"]); assert.equal(clients + familyCalls + identityCalls + chains.length, 0); if (deniedRole) throw new Error("DENIED"); admitted = true; return { profile: ownerProfile }; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.ok(admitted); clients++; return client; } }],
    ["@/lib/domain/parent-family", { getParentFamilyContext: async (receivedClient, receivedProfile) => { assert.equal(receivedClient, client); assert.equal(receivedProfile, ownerProfile); familyCalls++; return family; } }],
    ["@/lib/domain/parent-attendance-children", { parentAttendanceChildren: (children, enrollments) => { assert.equal(familyCalls, 1); identityCalls++; helperInputs = [children, enrollments]; helperChildren = actual.parentAttendanceChildren(children, enrollments); return helperChildren; } }],
  ]);
  const loaded = load(pageCode, (name) => modules.has(name) ? modules.get(name) : deny(name));
  if (deniedRole) { await assert.rejects(loaded.default(), /DENIED/); assert.equal(clients + familyCalls + identityCalls + chains.length, 0); return; }
  const tree = await loaded.default();
  assert.equal(clients, 1); assert.equal(familyCalls, 1);
  assert.equal(identityCalls, family.sourceUnavailable ? 0 : 1);
  if (!family.sourceUnavailable) { assert.equal(helperInputs[0], family.children); assert.equal(helperInputs[1], family.enrollments); }
  const ids = helperChildren ? Array.from(helperChildren, (child) => child.id) : [];
  assert.deepEqual(plain(chains), ids.length ? [
    [tables[0], [["select", "*, children(full_name, photo_url)"], ["in", "child_id", ids], ["order", "created_at", { ascending: false }], ["limit", 301]]],
    [tables[1], [["select", "*, children(full_name, photo_url)"], ["in", "child_id", ids], ["order", "pickup_time", { ascending: false }], ["limit", 80]]],
  ] : []);
  assert.equal(resolved.length, ids.length ? 2 : 0);
  const shell = nodes(tree, "DashboardShell")[0].props;
  assert.equal(shell.role, "parent"); assert.equal(shell.title, "איסוף הילד"); assert.equal(shell.appHome, true);
  const frame = nodes(tree, "ParentAppFrame")[0].props;
  assert.equal(frame.active, "more"); assert.equal(frame.profileName, ownerProfile.full_name); assert.equal(frame.avatarUrl, ownerProfile.profile_image_url ?? null);
  const hero = nodes(tree, "ParentHero")[0].props;
  assert.equal(hero.title, "איסוף הילד"); assert.equal(hero.subtitle, "מורשי איסוף, הרשאות זמניות והיסטוריה");
  const section = nodes(tree, "ParentSection")[0].props;
  assert.equal(section.title, "מרכז איסוף"); assert.equal(section.subtitle, "הגן תמיד מבצע בדיקה אנושית לפני שחרור ילד.");
  assert.equal(section.action.props.className, "pill good"); assert.equal(nodes(section.action, "ShieldCheck")[0].props.size, 15); assert.ok(text(section.action).includes("בדיקה אנושית בלבד"));
  assert.ok(!JSON.stringify(tree).includes("PRIVATE_SOURCE_ERROR"));
  return { tree, chains, identityCalls, helperChildren };
}
function unavailable(result) {
  assert.equal(nodes(result.tree, "ParentPickupCenter").length, 0);
  const alerts = nodes(result.tree).filter((node) => node.props.role === "alert"); assert.equal(alerts.length, 1);
  const empty = nodes(alerts[0], "ParentEmptyState"); assert.equal(empty.length, 1);
  assert.equal(empty[0].props.title, "נתוני האיסוף אינם זמינים");
  assert.equal(empty[0].props.text, "לא ניתן לאמת כעת את המורשים או היסטוריית האיסוף. לא תוצג רשימה ריקה כאילו נבדקה.");
}
function center(result) {
  assert.equal(nodes(result.tree).filter((node) => node.props.role === "alert").length, 0);
  const centers = nodes(result.tree, "ParentPickupCenter"); assert.equal(centers.length, 1);
  return centers[0].props;
}

for (const kind of ["child", "enrollment", "childrenGetter", "enrollmentsGetter", "childId"]) test(`unavailable family ${kind} is fenced before identity derivation and query`, async () => {
  const result = await render({ family: unavailableFamily(kind) }); unavailable(result);
  assert.deepEqual(result.chains, []); assert.equal(result.identityCalls, 0);
});
test("parent denial prevents client family identity and pickup IO", async () => { await render({ deniedRole: true }); });
test("healthy child keeps actual identity fields contacts and events", async () => {
  const result = await render(), props = center(result);
  assert.deepEqual(plain(props.children), [{ id: "child-1", full_name: "CHILD_ONE", photo_url: "CHILD_PHOTO", garden_id: "garden-1" }]);
  assert.deepEqual(plain(props.contacts), [{ id: "contact-1", child_id: "child-1" }]);
  assert.deepEqual(plain(props.events), [{ id: "event-1", child_id: "child-1" }]);
});
test("nonprimary guardian uses enrollment child ID not enrollment or permanent-file identity", async () => {
  const family = { sourceUnavailable: false, children: [], enrollments: [{ id: "enrollment-not-child", permanent_child_file_id: "file-not-child", child_id: "guardian-child", garden_id: "guardian-garden", child: { full_name: "Guardian Child", photo_url: "Guardian Photo" } }] };
  const result = await render({ family }), props = center(result);
  assert.deepEqual(plain(props.children), [{ id: "guardian-child", full_name: "Guardian Child", photo_url: "Guardian Photo", garden_id: "guardian-garden" }]);
  assert.deepEqual(plain(result.chains[0][1][1]), ["in", "child_id", ["guardian-child"]]);
});
test("actual helper dedupes IDs and preserves primary metadata plus guardian fallbacks", async () => {
  const family = { sourceUnavailable: false,
    children: [{ id: "child-1", full_name: "First", photo_url: "Primary Photo", garden_id: "garden-1" }, { id: "child-1", full_name: "Latest", photo_url: "Latest Photo", garden_id: "garden-1" }, { id: "" }, { id: 0 }],
    enrollments: [{ child_id: "child-1", full_name: "Not override", garden_id: "other-garden" }, { child_id: "child-2", garden_id: "garden-2", child: { full_name: "Guardian", photo_url: "P2" } }, { child_id: "child-2", full_name: "Not override" }],
  };
  const result = await render({ family });
  assert.deepEqual(plain(center(result).children), [{ id: "child-1", full_name: "Latest", photo_url: "Latest Photo", garden_id: "garden-1" }, { id: "child-2", full_name: "Guardian", photo_url: "P2", garden_id: "garden-2" }]);
  assert.deepEqual(plain(result.chains[0][1][1]), ["in", "child_id", ["child-1", "child-2"]]);
});
test("healthy empty family still calls pure helper once but skips both queries", async () => {
  const result = await render({ family: { sourceUnavailable: false, children: [], enrollments: [] } });
  assert.equal(result.identityCalls, 1); assert.deepEqual(result.chains, []);
  assert.deepEqual(plain(center(result)), { children: [], contacts: [], events: [] });
});
for (let index = 0; index < 2; index++) for (const kind of ["stale", "null", "empty"]) test(`pickup source ${index} error ${kind} retains existing warning and suppresses actions`, async () => {
  const result = await render({ failures: { [index]: kind } }); unavailable(result);
  assert.equal(result.identityCalls, 1); assert.equal(result.chains.length, 2);
});
for (const index of [0, 1]) test(`healthy pickup source ${index} null remains known empty`, async () => {
  const data = [[{ id: "contact" }], [{ id: "event" }]]; data[index] = null;
  const props = center(await render({ data })); assert.deepEqual(plain(index === 0 ? props.contacts : props.events), []);
});
test("healthy both empty query results preserve an available center", async () => {
  const props = center(await render({ data: [[], []] }));
  assert.deepEqual(plain(props.contacts), []); assert.deepEqual(plain(props.events), []);
});
for (const count of [300, 301]) test(`contacts threshold ${count} retains exact existing cap behavior`, async () => {
  const result = await render({ data: [Array.from({ length: count }, (_, index) => ({ id: `contact-${index}` })), []] });
  if (count === 301) unavailable(result);
  else assert.equal(center(result).contacts.length, 300);
  assert.equal(result.chains[0][1].at(-1)[1], 301); assert.equal(result.chains[1][1].at(-1)[1], 80);
});
test("independent Auth avatar fallback remains during family unavailability", async () => {
  unavailable(await render({ family: unavailableFamily("child"), ownerProfile: { ...profile, profile_image_url: null } }));
});
test("both returned pickup errors retain existing single warning UI", async () => { unavailable(await render({ failures: { 0: "stale", 1: "stale" } })); });
test("unavailable empty family remains unknown rather than available empty center", async () => {
  const result = await render({ family: { sourceUnavailable: true, children: [], enrollments: [] } });
  unavailable(result); assert.equal(result.identityCalls, 0); assert.deepEqual(result.chains, []);
});
