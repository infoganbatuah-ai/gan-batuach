// Actual page with closed synthetic dependencies. Not DB/RLS/full-stack proof.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
function read(path) {
  const absolutePath = resolve(root, path);
  assert.ok(statSync(absolutePath).isFile(), `not a regular source file: ${absolutePath}`);
  if (process.platform === "darwin") {
    const rawFlags = execFileSync("/usr/bin/stat", ["-f", "%f", absolutePath], { encoding: "utf8" }).trim();
    assert.match(rawFlags, /^\d+$/);
    const flags = Number(rawFlags);
    assert.ok(Number.isSafeInteger(flags) && flags >= 0);
    assert.equal(flags & 0x40000000, 0, `refusing dataless source: ${absolutePath}`);
  }
  return readFileSync(absolutePath, "utf8");
}
const source = read("app/dashboard/parent/messages/page.tsx");
const ts = createRequire(import.meta.url)("typescript");
const opaque = (name) => Object.assign(() => { throw Error(`opaque component executed: ${name}`); }, { displayName: name });
const ui = Object.fromEntries(["DashboardShell", "ParentAppFrame", "ParentEmptyState", "ParentHero", "ParentSection", "ParentChildRequestForm", "InternalMessagingCenter", "MessageCircleHeart"].map((name) => [name, opaque(name)]));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const clean = (value) => JSON.parse(JSON.stringify(value));

function fixture({ failed = [], empty = [], deniedRole = false } = {}) {
  const failures = new Set(failed);
  const empties = new Set(empty);
  const events = [];
  const calls = [];
  const logs = [];
  const profile = { id: "qa-parent", role: "parent", full_name: "Synthetic Parent", profile_image_url: "qa-avatar" };
  const staleFamily = failures.has("family");
  const prefix = staleFamily ? "stale-" : "";
  const family = {
    sourceUnavailable: staleFamily,
    children: empties.has("family") ? [] : [{ id: `${prefix}child-a`, full_name: staleFamily ? "Stale child" : "Child A", garden_id: `${prefix}garden-a`, status: "active", photo_url: null }],
    enrollments: empties.has("family") ? [] : [
      { child_id: `${prefix}child-a`, full_name: "Must not replace existing child", garden_id: `${prefix}garden-a`, status: "active" },
      { child_id: `${prefix}child-b`, full_name: staleFamily ? "Stale enrollment" : "Child B", garden_id: `${prefix}garden-b`, status: "active", photo_url: null },
      { child_id: null, permanent_child_file_id: `${prefix}file-c`, full_name: "Child C", kindergarten_id: `${prefix}garden-a`, status: "pending", photo_url: null },
      { child_id: null, permanent_child_file_id: null, full_name: "Unknown child must be excluded" }
    ],
    gardens: empties.has("family") ? [] : [{ id: `${prefix}garden-a`, name: staleFamily ? "Stale garden" : "Garden A" }, { id: `${prefix}garden-b`, name: "Garden B" }]
  };
  const manager = { id: "manager-1", full_name: "Manager One", email: null, role: "manager", profile_image_url: null };
  const owner = { id: "owner-1", full_name: "Owner One", email: null, role: "owner", profile_image_url: null };
  const error = (name) => failures.has(name) ? { message: `synthetic ${name} unavailable` } : null;
  const results = {
    parent_child_requests: { data: empties.has("requests") ? [] : [{
      id: "request-1", child_id: "child-a", request_type: "שאלה", content: failures.has("requests") ? "Stale formal request" : "Healthy formal request",
      response_text: failures.has("requests") ? "Stale reply" : "Healthy reply", recipient_label: "Garden staff", status: "handled", created_at: "2099-01-02T11:42:00Z"
    }], error: error("requests") },
    gardens: { data: empties.has("gardens") ? [] : failures.has("gardens") ? [{ manager: { ...manager, id: "stale-manager", full_name: "Stale manager" }, owner: { ...owner, id: "stale-owner", full_name: "Stale owner" } }] : [
      { manager, owner }, { manager: { ...manager, full_name: "Duplicate must not replace first" }, owner: null }
    ], error: error("gardens") },
    messages: { data: empties.has("messages") ? [] : [{ id: "message-1", subject: "Synthetic", body: failures.has("messages") ? "Stale message" : "Healthy message", content: "Synthetic message", created_at: "2099-01-02T11:42:00Z" }], error: error("messages") }
  };
  const client = {
    from: (table) => {
      assert.ok(Object.hasOwn(results, table), `unexpected table: ${table}`);
      const call = { table, operations: [] };
      calls.push(call);
      const chain = {};
      for (const method of ["select", "or", "order", "limit", "in"]) chain[method] = (...args) => { call.operations.push([method, ...args]); return chain; };
      chain.then = (yes, no) => Promise.resolve(results[table]).then(yes, no);
      return chain;
    }
  };
  const modules = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: Symbol.for("react.fragment") },
    "lucide-react": { MessageCircleHeart: ui.MessageCircleHeart },
    "@/components/dashboard-shell": { DashboardShell: ui.DashboardShell },
    "@/components/parent-app-ui": { ParentAppFrame: ui.ParentAppFrame, ParentEmptyState: ui.ParentEmptyState, ParentHero: ui.ParentHero, ParentSection: ui.ParentSection },
    "@/components/parent-child-request-form": { ParentChildRequestForm: ui.ParentChildRequestForm },
    "@/components/internal-messaging-center": { InternalMessagingCenter: ui.InternalMessagingCenter },
    "@/lib/auth": { requireRole: async (roles) => { events.push(["requireRole", ...roles]); if (deniedRole) throw Error("denied-role"); return { profile }; } },
    "@/lib/domain/parent-family": { getParentFamilyContext: async (received, receivedProfile) => {
      events.push(["family"]); assert.equal(received, client); assert.equal(receivedProfile, profile); return family;
    } },
    "@/lib/supabase/server": { createClient: async () => { events.push(["createClient"]); return client; } }
  };
  const compiled = ts.transpileModule(source, {
    fileName: "isolated-messages-page.tsx", reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  });
  assert.deepEqual(compiled.diagnostics ?? [], []);
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: (name) => { assert.ok(Object.hasOwn(modules, name), `unapproved import: ${name}`); return modules[name]; },
    console: { error: (...args) => logs.push(args) }
  }, { timeout: 1000 });
  return { page: exports.default, calls, events, logs, results, manager, owner, failures, empties, profile };
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
const named = (tree, name) => nodes(tree, (node) => node.type === ui[name]);
const section = (tree, title) => named(tree, "ParentSection").find((node) => node.props.title === title);
const emptyTitle = (tree, title) => named(tree, "ParentEmptyState").some((node) => node.props.title === title);
const classed = (tree, name) => nodes(tree, (node) => String(node.props?.className ?? "").split(" ").includes(name));
function text(node) {
  if (Array.isArray(node)) return node.map(text).join("");
  if (node === null || node === undefined || typeof node === "boolean") return "";
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
async function render(options = {}) {
  const f = fixture(options);
  return { ...f, tree: await f.page() };
}

const expectedChildren = [
  { id: "child-a", full_name: "Child A", garden_id: "garden-a", status: "active", photo_url: null, garden_name: "Garden A" },
  { id: "child-b", full_name: "Child B", garden_id: "garden-b", kindergarten_id: "garden-b", status: "active", photo_url: null, garden_name: "Garden B" },
  { id: "file-c", full_name: "Child C", garden_id: "garden-a", kindergarten_id: "garden-a", status: "pending", photo_url: null, garden_name: "Garden A" }
];

function assertBoundaries({ tree, failures, empties, calls, results, manager, owner }) {
  const familyBad = failures.has("family");
  const centerBad = familyBad || failures.has("gardens") || failures.has("messages");
  const form = named(tree, "ParentChildRequestForm");
  const center = named(tree, "InternalMessagingCenter");
  assert.equal(form.length, familyBad ? 0 : 1);
  assert.equal(center.length, centerBad ? 0 : 1);
  if (familyBad) {
    assert.ok(emptyTitle(tree, "פרטי הילדים אינם זמינים"));
    assert.doesNotMatch(JSON.stringify(tree), /Stale child|Stale enrollment|Stale garden|stale-child|stale-file|stale-garden/);
    assert.doesNotMatch(JSON.stringify(calls), /stale-child|stale-file|stale-garden/);
    assert.equal(calls.some((call) => call.table === "gardens"), false);
    assert.equal(calls.find((call) => call.table === "parent_child_requests").operations.find((op) => op[0] === "or")[1], "parent_profile_id.eq.qa-parent");
  } else {
    assert.deepEqual(clean(form[0].props.children), empties.has("family") ? [] : expectedChildren);
  }
  if (centerBad) assert.ok(emptyTitle(tree, "השיחה עם הגן אינה זמינה"));
  else {
    assert.equal(center[0].props.currentProfileId, "qa-parent");
    assert.deepEqual(clean(center[0].props.linkedChildren), empties.has("family") ? [] : expectedChildren);
    assert.deepEqual(clean(center[0].props.messages), results.messages.data);
    assert.deepEqual(clean(center[0].props.recipients), empties.has("gardens") || empties.has("family") ? [] : [manager, owner]);
  }
  const requestSection = section(tree, "השיחות שלי");
  if (failures.has("requests")) {
    assert.ok(emptyTitle(requestSection, "הפניות אינן זמינות"));
    assert.equal(emptyTitle(requestSection, "אין פניות פתוחות כרגע"), false);
    assert.equal(classed(requestSection, "message-thread").length, 0);
    assert.doesNotMatch(JSON.stringify(tree), /Stale formal request|Stale reply/);
  } else if (empties.has("requests")) {
    assert.ok(emptyTitle(requestSection, "אין פניות פתוחות כרגע"));
  } else {
    assert.match(text(requestSection), /Healthy formal request/);
    assert.match(text(requestSection), /Healthy reply/);
    assert.match(text(requestSection), /טופל/);
    assert.equal(classed(requestSection, "message-thread").length, 1);
  }
  assert.doesNotMatch(JSON.stringify(tree), /Stale message|Stale manager|Stale owner/);
  const action = section(tree, "פנייה חדשה").props.action;
  assert.equal(action.props.className, failures.size ? "pill" : "pill good");
  assert.match(text(action), failures.size ? /חלק מהתקשורת אינו זמין/ : /ערוץ מאובטח/);
  const app = named(tree, "ParentAppFrame")[0];
  assert.equal(app.props.active, "alerts");
  assert.equal(app.props.profileName, "Synthetic Parent");
  assert.equal(app.props.avatarUrl, "qa-avatar");
  assert.equal(named(tree, "ParentHero")[0].props.title, "הודעות ותקשורת");
}

for (const failed of ["family", "gardens", "messages", "requests"]) {
  test(`single ${failed} failure discards stale data while retaining independent sections`, async () => {
    assertBoundaries(await render({ failed: [failed] }));
  });
}
for (const failed of [["family", "gardens"], ["family", "messages"], ["family", "requests"], ["gardens", "messages"], ["gardens", "requests"], ["messages", "requests"]]) {
  test(`paired ${failed.join("+")} failures do not revive stale editors or request rows`, async () => {
    assertBoundaries(await render({ failed }));
  });
}
test("all four unavailable sources remain unavailable without stale data", async () => {
  assertBoundaries(await render({ failed: ["family", "gardens", "messages", "requests"] }));
});
for (const empty of ["family", "gardens", "messages", "requests"]) {
  test(`successful ${empty} empty source remains a healthy empty case`, async () => {
    assertBoundaries(await render({ empty: [empty] }));
  });
}
test("healthy child/recipient identity, first-record dedup and all client props are preserved", async () => {
  const result = await render();
  assertBoundaries(result);
  const recipients = named(result.tree, "InternalMessagingCenter")[0].props.recipients;
  assert.deepEqual(Array.from(recipients, (row) => row.id), ["manager-1", "owner-1"]);
  assert.equal(recipients[0].full_name, "Manager One");
  assert.doesNotMatch(JSON.stringify(result.tree), /Must not replace existing child|Unknown child must be excluded|Duplicate must not replace first/);
});
test("denied parent role has zero client construction, family IO or queries", async () => {
  const f = fixture({ deniedRole: true });
  await assert.rejects(f.page(), /denied-role/);
  assert.deepEqual(f.events, [["requireRole", "parent"]]);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.logs, []);
});
test("request admission and all three exact query chains/order/limits are preserved", async () => {
  const first = source.indexOf('  const requestFilters = [');
  const last = source.indexOf('\n  if (requestsRes.error)', first);
  assert.equal(source.slice(first, last), `  const requestFilters = [
    \`parent_profile_id.eq.\${profile.id}\`,
    childIds.length ? \`child_id.in.(\${childIds.join(",")})\` : ""
  ].filter(Boolean);
  const [requestsRes, gardensRes, messagesRes] = await Promise.all([
    requestFilters.length
    ? await supabase
      .from("parent_child_requests" as any)
      .select("id, child_id, request_type, content, recipient_label, recipient_role, status, response_text, created_at, handled_at")
      .or(requestFilters.join(","))
      .order("created_at", { ascending: false })
      .limit(80)
    : { data: [], error: null },
    gardenIds.length ? supabase.from("gardens" as never).select("id,manager:manager_id(id,full_name,email,role,profile_image_url),owner:owner_profile_id(id,full_name,email,role,profile_image_url)").in("id", gardenIds) : Promise.resolve({ data: [], error: null }),
    supabase.from("messages" as never).select("id,subject,body,content,created_at,treatment_status,sender:sender_id(full_name,profile_image_url),recipient:recipient_id(full_name,profile_image_url)").or(\`sender_id.eq.\${profile.id},recipient_id.eq.\${profile.id}\`).order("created_at", { ascending: false }).limit(80)
  ]);`);
  assert.ok(source.includes('const { profile } = await requireRole(["parent"]);'));
  const { calls, events } = await render();
  assert.deepEqual(events, [["requireRole", "parent"], ["createClient"], ["family"]]);
  assert.deepEqual(calls.map((call) => call.table), ["parent_child_requests", "gardens", "messages"]);
  assert.equal(calls[0].operations.find((op) => op[0] === "or")[1], "parent_profile_id.eq.qa-parent,child_id.in.(child-a,child-b,file-c)");
  assert.deepEqual(Array.from(calls[1].operations.find((op) => op[0] === "in")[2]), ["garden-a", "garden-b"]);
  assert.equal(calls[2].operations.find((op) => op[0] === "or")[1], "sender_id.eq.qa-parent,recipient_id.eq.qa-parent");
  for (const call of [calls[0], calls[2]]) assert.deepEqual(call.operations.at(-1), ["limit", 80]);
});
