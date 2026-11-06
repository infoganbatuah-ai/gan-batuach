import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual page only, closed Auth/SDK/UI/capability stubs. No components with actions
// or actual provider/capability/env modules are loaded. Not live Auth/RLS proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "app/dashboard/parent/notifications/page.tsx");
assert.ok(statSync(file).isFile(), "page source must be a regular file");
if (process.platform === "darwin") {
  const rawFlags = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(rawFlags, /^\d+$/);
  const flags = Number(rawFlags);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "dataless page source is forbidden");
}
const ts = createRequire(import.meta.url)("typescript");
const compiled = ts.transpileModule(readFileSync(file, "utf8"), { fileName: "parent-notifications.page.tsx", reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
const errors = (compiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
const script = new vm.Script(compiled.outputText, { filename: "parent-notifications.page.js" });
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (value) => JSON.parse(JSON.stringify(value));
function nodes(value, type) {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, type));
  if (!value || typeof value !== "object" || !("type" in value)) return [];
  return [...(value.type === type ? [value] : []), ...Object.values(value.props).flatMap((item) => nodes(item, type))];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value == null || typeof value === "boolean") return "";
  return typeof value === "object" ? text(value.props?.children) : String(value);
}
const profile = Object.freeze({ id: "synthetic-parent", full_name: "Synthetic Parent", profile_image_url: "synthetic-avatar" });
const capability = Object.freeze({ status: "UNVERIFIED", liveDeliveryEnabled: false });
const tables = ["notifications", "communication_preferences", "push_category_preferences"];
const categories = ["עדכוני ילד", "הודעות", "מסמכים", "תשלומים", "בטיחות", "כללי"];
function fixtures() {
  return [
    [
      { id: "child-a", title: "ילד" },
      { id: "message-a", entity_type: "message" },
      { id: "document-a", title: "document" },
      { id: "payment-a", title: "payment" },
      { id: "safety-a", title: "safety" },
      { id: "general-a", title: "כללי" },
      { id: "document-b", title: "מסמך תשלום" },
      { id: "message-b", message: null, body: "הודעה" },
      { id: "general-b", message: "", body: "מסמך" },
      { id: "child-b", entity_type: "Child" },
      { id: "safety-b", message: "תצפיתן" },
      { id: "payment-b", title: "Payment" },
    ],
    { email_enabled: false, fixture_marker: "SYNTHETIC_PREFERENCES" },
    [{ category: "safety", enabled: false }, { category: "message", enabled: true }],
  ];
}
const expectedQueries = [
  ["notifications", [["select", "*"], ["or", "recipient_id.eq.synthetic-parent,recipient_profile_id.eq.synthetic-parent"], ["order", "created_at", { ascending: false }], ["limit", 80]]],
  ["communication_preferences", [["select", "*"], ["eq", "profile_id", "synthetic-parent"], ["maybeSingle"]]],
  ["push_category_preferences", [["select", "category, enabled"], ["eq", "profile_id", "synthetic-parent"], ["in", "category", ["important", "safety", "attendance", "message", "document", "payment", "pickup"]]]],
];

async function render({ failures = {}, data = fixtures(), deniedRole = false, ownerProfile = profile } = {}) {
  let admitted = false, clients = 0, capabilities = 0;
  const calls = [];
  const client = { from(table) {
    assert.ok(admitted);
    const index = calls.length;
    assert.equal(table, tables[index]);
    const operations = [];
    calls.push([table, operations]);
    const query = {};
    for (const method of ["select", "or", "order", "limit", "eq", "maybeSingle", "in"]) query[method] = (...args) => { operations.push([method, ...args]); return query; };
    query.then = (accept, reject) => {
      assert.equal(calls.length, 3, "one three-source concurrent batch");
      let payload = data[index];
      const kind = failures[index];
      if (kind === "null") payload = null;
      if (kind === "empty") payload = index === 1 ? {} : [];
      return Promise.resolve({ data: payload, error: kind ? { message: "PRIVATE_SOURCE_ERROR" } : null }).then(accept, reject);
    };
    return query;
  } };
  const imports = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["@/components/dashboard-shell", { DashboardShell: "DashboardShell" }],
    ["@/components/notification-center", { NotificationCenter: "NotificationCenter" }],
    ["@/components/parent-app-ui", { ParentAppFrame: "ParentAppFrame", ParentHero: "ParentHero", ParentSection: "ParentSection" }],
    ["@/components/parent-notification-preferences", { ParentNotificationPreferences: "ParentNotificationPreferences" }],
    ["@/lib/auth", { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["parent"]); assert.equal(clients + capabilities + calls.length, 0); if (deniedRole) throw new Error("DENIED"); admitted = true; return { profile: ownerProfile }; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.ok(admitted); clients++; return client; } }],
    ["@/lib/management/external-delivery", { managementDeliveryCapability: () => { assert.ok(admitted); assert.equal(calls.length, 3); capabilities++; return capability; } }],
  ]);
  const exports = {};
  script.runInNewContext({ exports, require: (name) => { assert.ok(imports.has(name), `unlisted import ${name}`); return imports.get(name); }, fetch: () => { throw new Error("NETWORK_FORBIDDEN"); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  if (deniedRole) {
    await assert.rejects(exports.default(), /DENIED/);
    assert.equal(clients + capabilities + calls.length, 0);
    return;
  }
  const tree = await exports.default();
  assert.equal(clients, 1);
  assert.deepEqual(plain(calls), expectedQueries, "all three exact query chains are preserved");
  assert.equal(capabilities, failures[1] || failures[2] ? 0 : 1, "capability only binds the independently available editor");
  const shell = nodes(tree, "DashboardShell")[0].props;
  assert.equal(shell.role, "parent");
  assert.equal(shell.title, "התראות");
  assert.equal(shell.appHome, true);
  const frame = nodes(tree, "ParentAppFrame")[0].props;
  assert.equal(frame.active, "alerts");
  assert.equal(frame.profileName, ownerProfile.full_name);
  assert.equal(frame.avatarUrl, ownerProfile.profile_image_url ?? null);
  assert.deepEqual(nodes(tree, "ParentSection").map((node) => [node.props.title, node.props.subtitle]), [["העדפות התראות", "בחירה אילו עדכונים לקבל ובאיזה ערוץ."], ["התראות אחרונות", "אירועים רגישים מוצגים רק אחרי בדיקה ואישור."]]);
  assert.equal(nodes(tree, "ParentHero")[0].props.title, "מרכז עדכונים");
  assert.equal(nodes(tree, "ParentHero")[0].props.subtitle, "מה צריך את תשומת הלב שלך היום?");
  assert.ok(!JSON.stringify(tree).includes("PRIVATE_SOURCE_ERROR"));
  return { tree, calls, capabilities, data };
}
function categoryRows(tree) {
  const sections = nodes(tree, "section").filter((node) => node.props.className === "parent-notification-categories");
  assert.equal(sections.length, 1);
  return nodes(sections[0], "span").map((node) => ({ label: node.key, count: nodes(node, "b")[0].props.children }));
}
function expectAvailability(result, failed = []) {
  const { tree, data } = result;
  const centers = nodes(tree, "NotificationCenter"), editors = nodes(tree, "ParentNotificationPreferences");
  const statusText = nodes(tree, "p").filter((node) => node.props.role === "status").map(text).join(" ");
  if (failed.includes(0)) {
    assert.equal(centers.length, 0, "failed notifications cannot mount as healthy empty");
    assert.deepEqual(categoryRows(tree), [], "unavailable categories are not six zero counts");
    assert.ok(statusText.includes("קטגוריות ההתראות אינן זמינות"));
    assert.ok(statusText.includes("ההתראות האחרונות אינן זמינות"));
  } else {
    assert.equal(centers.length, 1);
    assert.deepEqual(plain(centers[0].props.notifications), plain(data[0] ?? []));
    assert.equal(categoryRows(tree).length, 6);
    assert.deepEqual(categoryRows(tree).map((row) => row.label), categories);
  }
  if (failed.includes(1) || failed.includes(2)) {
    assert.equal(editors.length, 0, "unavailable preferences cannot mount editable controls");
    assert.ok(statusText.includes("העדפות ההתראות אינן זמינות"));
    assert.ok(statusText.includes("לא ניתן לשנות העדפות"));
  } else {
    assert.equal(editors.length, 1);
    assert.equal(editors[0].props.preferences, data[1]);
    assert.deepEqual(plain(editors[0].props.pushCategoryPreferences), Object.fromEntries((data[2] ?? []).map((row) => [row.category, row.enabled])));
    assert.equal(editors[0].props.capability, capability);
    assert.equal(editors[0].props.capability.liveDeliveryEnabled, false);
  }
}

test("healthy actual page preserves category counts editor props and exact query contracts", async () => {
  const result = await render();
  expectAvailability(result);
  assert.deepEqual(categoryRows(result.tree), categories.map((label) => ({ label, count: 2 })));
  assert.equal(nodes(result.tree, "p").filter((node) => node.props.role === "status").length, 0);
});
for (let index = 0; index < 3; index++) for (const kind of ["stale", "null", "empty"]) test(`parent notification source ${index} ${kind} must not mount unavailable input`, async () => {
  const result = await render({ failures: { [index]: kind } });
  expectAvailability(result, [index]);
  if (index !== 0) assert.deepEqual(categoryRows(result.tree), categories.map((label) => ({ label, count: 2 })), "independent notifications remain counted");
});
for (const failed of [[0, 1], [0, 2], [1, 2], [0, 1, 2]]) test(`paired or all errors ${failed} preserve only available independent inputs`, async () => {
  const result = await render({ failures: Object.fromEntries(failed.map((index) => [index, "stale"])) });
  expectAvailability(result, failed);
  if (!failed.includes(0)) assert.deepEqual(categoryRows(result.tree), categories.map((label) => ({ label, count: 2 })));
});
test("healthy empty data remains legitimate empty with editor defaults unchanged", async () => {
  const result = await render({ data: [[], {}, []] });
  expectAvailability(result);
  assert.deepEqual(categoryRows(result.tree), categories.map((label) => ({ label, count: 0 })));
  assert.equal(nodes(result.tree, "p").filter((node) => node.props.role === "status").length, 0);
});
test("healthy null data keeps original null preferences empty notification and push semantics", async () => {
  const result = await render({ data: [null, null, null] });
  expectAvailability(result);
  assert.deepEqual(categoryRows(result.tree), categories.map((label) => ({ label, count: 0 })));
  assert.equal(nodes(result.tree, "ParentNotificationPreferences")[0].props.preferences, null);
});
test("parent role denial precedes client query and capability calls", async () => { await render({ deniedRole: true }); });
test("stale notification getters are never read before unavailable gating", async () => {
  const data = fixtures();
  data[0] = [Object.defineProperties({}, Object.fromEntries(["title", "message", "body", "entity_type"].map((name) => [name, { get() { throw new Error(`STALE_NOTIFICATION_${name}`); } }])) )];
  expectAvailability(await render({ data, failures: { 0: "stale" } }), [0]);
});
test("stale push preference getters are cut before map and Object.fromEntries", async () => {
  const data = fixtures();
  data[2] = [Object.defineProperties({}, Object.fromEntries(["category", "enabled"].map((name) => [name, { get() { throw new Error(`STALE_PUSH_${name}`); } }])) )];
  expectAvailability(await render({ data, failures: { 2: "stale" } }), [2]);
});
test("paired poisoned notification and push rows cannot reach processing or controls", async () => {
  const data = fixtures();
  data[0] = [{ get title() { throw new Error("STALE_NOTIFICATION"); } }];
  data[2] = [{ get category() { throw new Error("STALE_PUSH"); }, get enabled() { throw new Error("STALE_PUSH_ENABLED"); } }];
  expectAvailability(await render({ data, failures: { 0: "stale", 2: "stale" } }), [0, 2]);
});
test("healthy empty preference row remains editable independently of notification failure", async () => {
  const data = fixtures(); data[1] = {}; data[2] = [];
  expectAvailability(await render({ data, failures: { 0: "stale" } }), [0]);
});
test("healthy null communication preference remains editable with healthy push and notifications", async () => {
  const data = fixtures(); data[1] = null;
  expectAvailability(await render({ data }));
});
test("healthy null push preferences preserve empty map without losing communication preference", async () => {
  const data = fixtures(); data[2] = null;
  expectAvailability(await render({ data }));
});
test("actual category label priority nullish body and case behavior remain unchanged", async () => {
  const data = fixtures();
  data[0] = [{ title: "PAYMENT DOCUMENT" }, { title: "safety message" }, { title: "child message" }, { message: null, body: "הודעה" }, { message: "", body: "מסמך" }];
  const result = await render({ data });
  expectAvailability(result);
  assert.deepEqual(categoryRows(result.tree).map((row) => row.count), [0, 2, 1, 0, 1, 1]);
});
for (const variant of ["null", "absent"]) test(`profile avatar ${variant} preserves original null fallback`, async () => {
  const ownerProfile = { ...profile };
  if (variant === "null") ownerProfile.profile_image_url = null;
  else delete ownerProfile.profile_image_url;
  expectAvailability(await render({ ownerProfile }));
});
test("healthy explicit false and duplicate-last push choices are not silently enabled", async () => {
  const data = fixtures();
  data[2] = [{ category: "safety", enabled: true }, { category: "safety", enabled: false }, { category: "important", enabled: false }];
  const result = await render({ data });
  expectAvailability(result);
  assert.deepEqual(plain(nodes(result.tree, "ParentNotificationPreferences")[0].props.pushCategoryPreferences), { safety: false, important: false });
});
