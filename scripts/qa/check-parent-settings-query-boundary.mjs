import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual page with closed Auth/SDK/UI/label/verification doubles. Action components
// and actual verification/provider/env modules are never loaded. Not real RLS proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "app/dashboard/parent/settings/page.tsx");
assert.ok(statSync(file).isFile(), "source must be a regular file");
if (process.platform === "darwin") {
  const rawFlags = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(rawFlags, /^\d+$/);
  const flags = Number(rawFlags);
  assert.ok(Number.isSafeInteger(flags) && flags >= 0);
  assert.equal(flags & 0x40000000, 0, "dataless source refused");
}
const ts = createRequire(import.meta.url)("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), { fileName: "parent-settings.page.tsx", reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
const script = new vm.Script(output.outputText, { filename: "parent-settings.page.js" });
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
const now = "2026-11-07T06:00:00.000Z";
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return Date.parse(now); }
}
const profile = Object.freeze({ id: "synthetic-profile", full_name: "Original Synthetic Parent", email: "synthetic@example.invalid", phone: null, profile_image_url: "AUTH_AVATAR" });
const user = Object.freeze({ id: "synthetic-user", email: "auth-user@example.invalid" });
const displayName = "Clean Synthetic Parent";
function fixtures() {
  return [
    { id: "synthetic-parent-row", full_name: "PARENT_ROW_NAME", phone: "PARENT_PHONE", address: "PARENT_ADDRESS", photo_url: "PARENT_PHOTO", status: "active", completed_profile: true },
    [{ id: "child-a", garden_id: "garden-a", status: "active" }, { id: "child-b", garden_id: "garden-b", status: "pending" }, { id: "child-c", garden_id: "garden-c", status: "active" }],
    [{ id: "permission-a", allowed: true, valid_until: "2999-01-01", garden_id: "garden-a" }, { id: "permission-b", allowed: false, valid_until: null }],
  ];
}
const tables = ["parents", "children", "parent_camera_permissions"];
const settingsComponents = ["AccountVerificationSummary", "SettingsLinkList", "SettingsPlatformLayout", "SettingsPlatformNavigation", "SettingsSection", "SettingsStatusCard", "SettingsStatusGrid"];
const parentChain = ["parents", [["select", "id,full_name,phone,address,photo_url,status,completed_profile"], ["or", "profile_id.eq.synthetic-profile,user_id.eq.synthetic-profile"], ["limit", 1], ["maybeSingle"]]];
const dependentChains = (parentId) => [
  ["children", [["select", "id,garden_id,status"], ["eq", "primary_parent_id", parentId], ["limit", 30]]],
  ["parent_camera_permissions", [["select", "id,allowed,valid_until,garden_id"], ["eq", "parent_id", parentId], ["limit", 100]]],
];
async function render({ failures = {}, data = fixtures(), deniedRole = false, ownerProfile = profile, ownerUser = user, verification = { emailVerified: true, phoneVerified: false } } = {}) {
  let admitted = false, clients = 0, verifications = 0, labels = 0;
  const calls = [];
  const client = { from(table) {
    assert.ok(admitted);
    const index = tables.indexOf(table);
    assert.ok(index >= 0);
    assert.equal(table, tables[calls.length]);
    const operations = [];
    calls.push([table, operations]);
    const query = {};
    for (const method of ["select", "or", "eq", "limit", "maybeSingle"]) query[method] = (...args) => { operations.push([method, ...args]); return query; };
    query.then = (accept, reject) => {
      if (index > 0) assert.equal(calls.length, 3, "dependent queries share a concurrent batch");
      const kind = failures[index];
      const payload = kind === "null" ? null : kind === "empty" ? index === 0 ? {} : [] : data[index];
      return Promise.resolve({ data: payload, error: kind ? { message: "PRIVATE_SOURCE_ERROR" } : null }).then(accept, reject);
    };
    return query;
  } };
  const imports = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["lucide-react", Object.fromEntries(["Bell", "Camera", "KeyRound", "ShieldCheck", "UserRound", "UsersRound"].map((name) => [name, name]))],
    ["@/components/parent-app-ui", { ParentAppFrame: "ParentAppFrame", ParentHero: "ParentHero" }],
    ["@/components/profile-settings-form", { ProfileSettingsForm: "ProfileSettingsForm" }],
    ["@/components/settings-platform-ui", Object.fromEntries(settingsComponents.map((name) => [name, name]))],
    ["@/lib/auth", { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["parent"]); assert.equal(clients + verifications + labels + calls.length, 0); if (deniedRole) throw new Error("DENIED"); admitted = true; return { user: ownerUser, profile: ownerProfile }; } }],
    ["@/lib/domain/display-label", { cleanSyntheticLabel: (name, fallback) => { assert.ok(admitted); assert.equal(clients + verifications + calls.length, 0); assert.equal(name, ownerProfile.full_name); assert.equal(fallback, "הורה"); labels++; return displayName; } }],
    ["@/lib/management/contact-verification", { managementContactVerification: (receivedUser, receivedProfile) => { assert.ok(admitted); assert.equal(clients + calls.length, 0); assert.equal(labels, 1); assert.equal(receivedUser, ownerUser); assert.equal(receivedProfile, ownerProfile); verifications++; return verification; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.ok(admitted); assert.equal(verifications, 1); clients++; return client; } }],
  ]);
  const exports = {};
  script.runInNewContext({ exports, require: (name) => { assert.ok(imports.has(name), `unlisted import ${name}`); return imports.get(name); }, Date: FixedDate, fetch: () => { throw new Error("NETWORK_FORBIDDEN"); } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  if (deniedRole) {
    await assert.rejects(exports.default(), /DENIED/);
    assert.equal(clients + verifications + labels + calls.length, 0);
    return;
  }
  const tree = await exports.default();
  assert.equal(clients, 1);
  assert.equal(verifications, 1);
  assert.equal(labels, 1);
  const expectedParent = failures[0] ? null : data[0];
  const parentId = expectedParent?.id;
  assert.deepEqual(plain(calls), parentId ? [parentChain, ...dependentChains(parentId)] : [parentChain], "exact query chains and parent-dependent admission");
  const frame = nodes(tree, "ParentAppFrame")[0].props;
  assert.equal(frame.active, "more");
  assert.equal(frame.profileName, displayName);
  assert.equal(frame.avatarUrl, ownerProfile.profile_image_url ?? null);
  const navigation = nodes(tree, "SettingsPlatformNavigation")[0].props;
  assert.equal(navigation.role, "parent");
  assert.equal(navigation.activeHref, "/dashboard/parent/settings");
  assert.equal(nodes(tree, "ParentHero")[0].props.title, "הגדרות וחשבון");
  assert.equal(nodes(tree, "ParentHero")[0].props.subtitle, "פרופיל, אבטחה, התראות ופרטיות משפחתית");
  assert.deepEqual(nodes(tree, "SettingsSection").map((node) => node.props.id), ["account", "profile", "preferences", "privacy"]);
  const summary = nodes(tree, "AccountVerificationSummary")[0].props;
  assert.equal(summary.email, ownerProfile.email ?? ownerUser.email);
  assert.equal(summary.emailVerified, verification.emailVerified);
  assert.equal(summary.phone, ownerProfile.phone ?? expectedParent?.phone);
  assert.equal(summary.phoneVerified, verification.phoneVerified);
  assert.ok(!JSON.stringify(tree).includes("PRIVATE_SOURCE_ERROR"));
  return { tree, calls, expectedParent, data, ownerProfile, summary };
}
const card = (tree, label) => {
  const found = nodes(tree, "SettingsStatusCard").filter((node) => node.props.label === label);
  assert.equal(found.length, 1, label);
  return found[0].props;
};
function expectAvailability(result, failed = [], childCount = 2, permittedCount = 1) {
  const parentFailed = failed.includes(0), childrenFailed = parentFailed || failed.includes(1), camerasFailed = parentFailed || failed.includes(2);
  const { tree, expectedParent, ownerProfile } = result;
  const parentCard = card(tree, "פרופיל"), childCard = card(tree, "ילדים מקושרים"), cameraCard = card(tree, "גישה למצלמות");
  assert.equal(parentCard.value, parentFailed ? "לא זמין" : expectedParent?.completed_profile ? "מושלם" : "להשלמה");
  assert.equal(parentCard.tone, parentFailed ? "orange" : expectedParent?.completed_profile ? "green" : "orange");
  assert.equal(childCard.value, childrenFailed ? "לא זמין" : String(childCount));
  assert.equal(childCard.tone, childrenFailed ? "orange" : "blue");
  assert.equal(cameraCard.value, camerasFailed ? "לא זמין" : permittedCount ? `${permittedCount} מורשות` : "ללא הרשאה");
  assert.equal(cameraCard.tone, camerasFailed ? "orange" : permittedCount ? "green" : "purple");
  assert.equal(cameraCard.href, "/dashboard/parent/cameras");
  for (const [unavailable, value] of [[parentFailed, parentCard], [childrenFailed, childCard], [camerasFailed, cameraCard]]) if (unavailable) assert.ok(value.detail.includes("אינם זמינים"));
  const form = nodes(tree, "ProfileSettingsForm");
  assert.equal(form.length, parentFailed ? 0 : 1);
  if (parentFailed) {
    assert.equal(result.calls.length, 1);
    assert.ok(nodes(tree, "p").some((node) => node.props.role === "status" && text(node).includes("לא ניתן לערוך פרטים")));
    assert.ok(!JSON.stringify(tree).includes("PARENT_"), "failed parent fields do not leak into any props");
  } else {
    assert.equal(form[0].props.roleLabel, "הורה");
    assert.equal(form[0].props.includeGarden, false);
    assert.deepEqual(plain(form[0].props.profile), plain({ ...ownerProfile, ...expectedParent, full_name: displayName, profile_image_url: expectedParent?.photo_url ?? ownerProfile.profile_image_url }));
  }
  const links = nodes(tree, "SettingsLinkList")[0].props.items;
  assert.deepEqual(plain(links.map((item) => [item.title, item.href])), [
    ["התראות ושעות שקט", "/dashboard/parent/notifications#preferences"], ["מורשי איסוף", "/dashboard/parent/pickup"], ["מדיניות מצלמות", "/dashboard/parent/cameras"], ["אבטחה וכניסה מהירה", "/dashboard/security-settings"],
  ]);
  assert.equal(links[2].status, camerasFailed ? "לא זמין" : permittedCount ? "מורשה" : "לא מורשה");
  assert.equal(links[0].status, "אישי");
  assert.equal(links[1].status, "לפי ילד");
  assert.equal(links[3].status, "מאובטח");
  assert.ok(nodes(tree, "p").some((node) => node.props.className === "settings-truth-note" && text(node).includes("הרשאות מצלמה, איסוף ומסמכים אינן נשמרות מהקשר קודם")));
}

test("healthy actual page retains forms verification profile props and all exact queries", async () => { expectAvailability(await render()); });
for (let index = 0; index < 3; index++) for (const kind of ["stale", "null", "empty"]) test(`parent settings source ${index} ${kind} remains unavailable`, async () => {
  expectAvailability(await render({ failures: { [index]: kind } }), [index]);
});
for (const failed of [[0, 1], [0, 2], [1, 2], [0, 1, 2]]) test(`paired or all failures ${failed} preserve independent state`, async () => {
  expectAvailability(await render({ failures: Object.fromEntries(failed.map((index) => [index, "stale"])) }), failed);
});
for (const parent of [null, {}]) test(`successful parent ${parent === null ? "null" : "empty"} keeps original form and skipped dependent semantics`, async () => {
  const data = fixtures(); data[0] = parent;
  expectAvailability(await render({ data }), [], 0, 0);
});
for (const [index, label] of [[1, "children"], [2, "permissions"]]) for (const kind of ["empty", "null"]) test(`healthy ${label} ${kind} remains known empty not unavailable`, async () => {
  const data = fixtures(); data[index] = kind === "empty" ? [] : null;
  expectAvailability(await render({ data }), [], index === 1 ? 0 : 2, index === 2 ? 0 : 1);
});
test("healthy dependent empty sources keep profile editor and known zero/no-grant", async () => {
  const data = fixtures(); data[1] = []; data[2] = [];
  expectAvailability(await render({ data }), [], 0, 0);
});
test("denied parent role prevents client query label and verification IO", async () => { await render({ deniedRole: true }); });
test("poisoned stale parent id is cut before dependent query admission", async () => {
  const data = fixtures(); data[0] = { get id() { throw new Error("STALE_PARENT_ID"); } };
  expectAvailability(await render({ data, failures: { 0: "stale" } }), [0]);
});
test("poisoned stale parent fields cannot enter verification fallback or profile merge", async () => {
  const data = fixtures();
  data[0] = { id: "stale-parent", get full_name() { throw new Error("STALE_NAME"); }, get phone() { throw new Error("STALE_PHONE"); }, get photo_url() { throw new Error("STALE_AVATAR"); }, get address() { throw new Error("STALE_ADDRESS"); }, get completed_profile() { throw new Error("STALE_COMPLETION"); } };
  expectAvailability(await render({ data, failures: { 0: "stale" } }), [0]);
});
test("poisoned stale child status never reaches filter or count", async () => {
  const data = fixtures(); data[1] = [{ id: "poison-child", get status() { throw new Error("STALE_CHILD_STATUS"); } }];
  expectAvailability(await render({ data, failures: { 1: "stale" } }), [1]);
});
test("poisoned stale permission allowed never reaches grant computation", async () => {
  const data = fixtures(); data[2] = [{ id: "poison-permission", get allowed() { throw new Error("STALE_ALLOWED"); } }];
  expectAvailability(await render({ data, failures: { 2: "stale" } }), [2]);
});
test("poisoned stale permission expiry never reaches date computation", async () => {
  const data = fixtures(); data[2] = [{ id: "poison-expiry", allowed: true, get valid_until() { throw new Error("STALE_EXPIRY"); } }];
  expectAvailability(await render({ data, failures: { 2: "stale" } }), [2]);
});
test("combined poisoned dependent failures preserve healthy profile and verification", async () => {
  const data = fixtures();
  data[1] = [{ get status() { throw new Error("STALE_CHILD"); } }];
  data[2] = [{ get allowed() { throw new Error("STALE_CAMERA"); } }];
  expectAvailability(await render({ data, failures: { 1: "stale", 2: "stale" } }), [1, 2]);
});
test("active child count stays strict and independent of camera failure", async () => {
  const data = fixtures(); data[1] = [{ status: "active" }, { status: "ACTIVE" }, { status: { toString: () => "active" } }, { status: null }, { status: "active" }];
  expectAvailability(await render({ data, failures: { 2: "stale" } }), [2], 2);
});
test("camera expiry remains strict greater-than FixedDate with original truthiness", async () => {
  const data = fixtures();
  data[2] = [
    { allowed: true, valid_until: null }, { allowed: true, valid_until: "2999-01-01" }, { allowed: false, valid_until: "2999-01-01" },
    { allowed: true, valid_until: now }, { allowed: true, valid_until: "2000-01-01" }, { allowed: true, valid_until: "invalid-date" },
    { allowed: null }, { allowed: true, valid_until: "" }, { allowed: true },
  ];
  expectAvailability(await render({ data }), [], 2, 4);
});
test("healthy expired-only permissions retain known no-grant semantics", async () => {
  const data = fixtures(); data[2] = [{ allowed: true, valid_until: now }, { allowed: true, valid_until: "2000-01-01" }];
  expectAvailability(await render({ data }), [], 2, 0);
});
for (const parentFailed of [false, true]) test(`Auth profile phone takes priority with parent ${parentFailed ? "failed" : "healthy"}`, async () => {
  const result = await render({ ownerProfile: { ...profile, phone: "AUTH_PHONE" }, failures: parentFailed ? { 0: "stale" } : {} });
  expectAvailability(result, parentFailed ? [0] : []);
  assert.equal(result.summary.phone, "AUTH_PHONE");
});
test("Auth profile email fallback uses user without changing verification booleans", async () => {
  const result = await render({ ownerProfile: { ...profile, email: null }, verification: { emailVerified: false, phoneVerified: true } });
  expectAvailability(result);
  assert.equal(result.summary.email, user.email);
  assert.equal(result.summary.emailVerified, false);
  assert.equal(result.summary.phoneVerified, true);
});
for (const completed of [false, null]) test(`healthy completed_profile ${completed} retains completion semantics`, async () => {
  const data = fixtures(); data[0].completed_profile = completed;
  expectAvailability(await render({ data }));
});
test("null healthy parent photo retains Auth avatar in editable profile", async () => {
  const data = fixtures(); data[0].photo_url = null;
  const result = await render({ data });
  expectAvailability(result);
  assert.equal(nodes(result.tree, "ProfileSettingsForm")[0].props.profile.profile_image_url, profile.profile_image_url);
});
