import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual page + actual shared component + one actual pure policy declaration.
// Closed effects. The stateful reconciler models type/key/hook identity and commits
// rendered frames; it is not ReactDOM/browser, action, Auth, RLS or upload proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const allowed = new Set(["app/dashboard/parent/documents/page.tsx", "components/documents-platform.tsx", "lib/management/document-policy.ts"]);
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
  const result = ts.transpileModule(source, { fileName: name, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n"));
  return result.outputText;
}
const pageCode = compile(read("app/dashboard/parent/documents/page.tsx"), "parent-documents.tsx");
const platformCode = compile(read("components/documents-platform.tsx"), "documents-platform.tsx");
const ast = ts.createSourceFile("policy.ts", read("lib/management/document-policy.ts"), ts.ScriptTarget.ES2022, true);
assert.equal(ast.parseDiagnostics.length, 0);
const declarations = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name?.text === "effectiveDocumentStatus");
assert.equal(declarations.length, 1);
const declaration = declarations[0].getText(ast);
for (const forbidden of [/\brequire\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /\bprocess\b/]) assert.doesNotMatch(declaration, forbidden);
const policyCode = compile(declaration, "pure-document-policy.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
function nodes(value, type) {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, type));
  if (!value || typeof value !== "object" || !("type" in value)) return [];
  return [...(type === undefined || value.type === type ? [value] : []), ...Object.values(value.props).flatMap((item) => nodes(item, type))];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value == null || typeof value === "boolean" || typeof value === "function") return "";
  return typeof value === "object" ? text(value.props?.children) : String(value);
}
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ["2026-11-07T06:00:00.000Z"])); }
  static now() { return Date.parse("2026-11-07T06:00:00.000Z"); }
}
let forbiddenEffects = 0;
function deny(name = "effect") { forbiddenEffects++; throw new Error(`UNEXPECTED_EFFECT_OR_IMPORT:${String(name)}`); }
function load(code, require) {
  const exports = {};
  new vm.Script(code).runInNewContext({ exports, require, Date: FixedDate, fetch: () => deny("fetch"), FormData: () => deny("FormData"), File: () => deny("File"), requestAnimationFrame: () => 0, console: { error: () => deny("console.error"), warn: () => deny("console.warn") } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports;
}
const pure = load(policyCode, deny);

function componentHarness() {
  const instances = new Map(), ids = new WeakMap();
  let nextId = 0, active = null, visited = null;
  function hook(kind, initialize) {
    assert.ok(active, "hook outside component render");
    const index = active.cursor++;
    if (index === active.hooks.length) active.hooks.push({ kind, value: initialize() });
    assert.equal(active.hooks[index].kind, kind, "stable hook order");
    return active.hooks[index];
  }
  const react = {
    useState(initial) {
      const cell = hook("state", () => typeof initial === "function" ? initial() : initial);
      return [cell.value, (value) => { cell.value = typeof value === "function" ? value(cell.value) : value; }];
    },
    useMemo(calculate, dependencies) {
      const cell = hook("memo", () => ({ dependencies: null, result: undefined }));
      if (!cell.value.dependencies || dependencies.length !== cell.value.dependencies.length || dependencies.some((value, index) => !Object.is(value, cell.value.dependencies[index]))) cell.value = { dependencies: Array.from(dependencies), result: calculate() };
      return cell.value.result;
    },
    useRef(initial) { return hook("ref", () => ({ current: initial })).value; },
    useTransition() { hook("transition", () => null); return [false, () => deny("transition/upload")]; },
  };
  const icons = Object.fromEntries(["AlertTriangle", "Archive", "Check", "CheckCircle2", "ChevronLeft", "Clock3", "Download", "Eye", "FileCheck2", "FileImage", "FileText", "FileUp", "Filter", "Folder", "FolderOpen", "History", "LockKeyhole", "RefreshCw", "Search", "ShieldCheck", "UploadCloud", "X"].map((name) => [name, name]));
  const imports = new Map([
    ["react/jsx-runtime", runtime], ["react", react], ["lucide-react", icons],
    ["@/lib/client-upload", { uploadManagementDocument: () => deny("uploadManagementDocument") }],
    ["@/components/document-review-actions", { DocumentReviewActions: "DocumentReviewActions" }],
  ]);
  const platform = load(platformCode, (name) => imports.has(name) ? imports.get(name) : deny(name));
  function expand(element, path) {
    if (Array.isArray(element)) return element.map((item, index) => expand(item, `${path}/${index}`));
    if (!element || typeof element !== "object" || !("type" in element)) return element;
    if (typeof element.type === "function") {
      if (!ids.has(element.type)) ids.set(element.type, ++nextId);
      const identity = `${path}/type${ids.get(element.type)}/key${element.key ?? ""}`;
      visited.add(identity);
      if (!instances.has(identity)) instances.set(identity, { hooks: [], cursor: 0, rendered: false });
      const instance = instances.get(identity), previous = active;
      const oldCount = instance.hooks.length;
      instance.cursor = 0; active = instance;
      let output;
      try { output = element.type(element.props); } finally { active = previous; }
      if (instance.rendered) assert.equal(instance.cursor, oldCount);
      instance.rendered = true;
      return expand(output, `${identity}/render`);
    }
    return { ...element, props: { ...element.props, children: expand(element.props.children, `${path}/children`) } };
  }
  const commits = [];
  function render(props) {
    visited = new Set();
    const tree = expand(jsx(platform.DocumentsPlatform, props), "root");
    for (const key of instances.keys()) if (!visited.has(key)) instances.delete(key);
    commits.push(tree);
    return tree;
  }
  return { platform, render, commits };
}
const fields = "id,garden_id,owner_type,owner_profile_id,staff_id,child_id,inspection_id,uploaded_by,name,document_type,status,expires_at,created_at,reviewed_at,rejection_reason,mime_type,byte_size,replaces_document_id,replaced_by,file_url,reminder_days_before,deleted_at";
const profile = Object.freeze({ id: "synthetic-parent", full_name: "AUTH_PARENT", profile_image_url: "AUTH_AVATAR" });
function familyFixture(empty = false) {
  return { sourceUnavailable: false, children: empty ? [] : [{ id: "child-1", full_name: "FAMILY_CHILD", garden_id: "garden-1" }], gardens: empty ? [] : [{ id: "garden-1", name: "FAMILY_GARDEN" }], gardenIds: empty ? [] : ["garden-1"] };
}
function document(id = "document-1", name = "SYNTHETIC_DOCUMENT") {
  return { id, garden_id: "garden-1", owner_type: "child", child_id: "child-1", name, document_type: "child_document", status: "valid", file_url: `/api/documents/${id}/file`, created_at: "2026-11-01", mime_type: "application/pdf", byte_size: 128 };
}
async function page({ docError = false, kind = "stale", familyError = false, familyEmpty = false, familyPayload, documents = [document()], deniedRole = false } = {}) {
  const harness = componentHarness();
  const family = familyPayload ?? familyFixture(familyEmpty);
  if (!familyPayload) family.sourceUnavailable = familyError;
  let admitted = false, clients = 0, familyCalls = 0, statusCalls = 0;
  const calls = [];
  const client = { from(table) {
    assert.ok(admitted); assert.equal(familyCalls, 1);
    calls.push(["from", table]);
    const query = {};
    for (const method of ["select", "is", "order", "limit"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (accept, reject) => Promise.resolve({ data: kind === "null" ? null : kind === "empty" ? [] : documents, error: docError ? { message: "PRIVATE_SOURCE_ERROR" } : null }).then(accept, reject);
    return query;
  } };
  const imports = new Map([
    ["react/jsx-runtime", runtime], ["@/components/dashboard-shell", { DashboardShell: "DashboardShell" }],
    ["@/components/documents-platform", harness.platform], ["@/components/parent-app-ui", { ParentAppFrame: "ParentAppFrame" }],
    ["@/lib/auth", { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["parent"]); assert.equal(clients + familyCalls + calls.length + statusCalls, 0); if (deniedRole) throw new Error("DENIED"); admitted = true; return { profile }; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.ok(admitted); clients++; return client; } }],
    ["@/lib/domain/parent-family", { getParentFamilyContext: async (receivedClient, receivedProfile) => { assert.equal(receivedClient, client); assert.equal(receivedProfile, profile); familyCalls++; return family; } }],
    ["@/lib/management/document-policy", { effectiveDocumentStatus: (row) => { statusCalls++; return pure.effectiveDocumentStatus(row); } }],
  ]);
  const loaded = load(pageCode, (name) => imports.has(name) ? imports.get(name) : deny(name));
  if (deniedRole) { await assert.rejects(loaded.default(), /DENIED/); assert.equal(clients + familyCalls + calls.length + statusCalls, 0); return; }
  const tree = await loaded.default();
  assert.equal(clients, 1); assert.equal(familyCalls, 1);
  assert.deepEqual(plain(calls), [["from", "documents"], ["select", fields], ["is", "deleted_at", null], ["order", "created_at", { ascending: false }], ["limit", 100]]);
  const shell = nodes(tree, "DashboardShell")[0].props;
  assert.equal(shell.role, "parent"); assert.equal(shell.title, "מסמכים"); assert.equal(shell.appHome, true);
  const frame = nodes(tree, "ParentAppFrame")[0].props;
  assert.equal(frame.active, "more"); assert.equal(frame.profileName, profile.full_name); assert.equal(frame.avatarUrl, profile.profile_image_url);
  const element = nodes(tree, harness.platform.DocumentsPlatform)[0]; assert.ok(element);
  assert.equal(element.props.title, "המסמכים של המשפחה"); assert.equal(element.props.roleLabel, "משפחה");
  assert.ok(!JSON.stringify(tree).includes("PRIVATE_SOURCE_ERROR"));
  return { tree, props: element.props, html: harness.render(element.props), harness, statusCalls };
}
function byClass(tree, className) { return nodes(tree).filter((node) => String(node.props.className ?? "").split(" ").includes(className)); }
function unavailable(html) {
  assert.ok(nodes(html).some((node) => node.props.role === "status" && text(node).includes("המסמכים אינם זמינים")));
  assert.ok(!text(html).includes("אין מסמכים בתצוגה הזו"));
  for (const name of ["documents-metrics", "documents-category-strip", "documents-toolbar", "document-list-card", "document-detail-pane", "document-detail-actions", "document-review-zone", "document-history-card"]) assert.equal(byClass(html, name).length, 0, name);
  assert.equal(nodes(html, "a").length, 0);
  assert.equal(nodes(html, "DocumentReviewActions").length, 0);
}
function noFamily(result) {
  assert.deepEqual(plain(result.props.uploadTargets), []);
  assert.ok(!JSON.stringify(result.props).includes("FAMILY_"));
  assert.ok(nodes(result.tree).some((node) => node.props.role === "status" && text(node).includes("פרטי המשפחה אינם זמינים")));
  assert.equal(byClass(result.html, "documents-upload-button").length, 0);
}
function clickUpload(result, props = result.props) {
  const button = byClass(result.html, "documents-upload-button")[0]; assert.ok(button);
  button.props.onClick();
  const html = result.harness.render(props);
  assert.equal(nodes(html).filter((node) => node.props.role === "dialog").length, 1);
  return html;
}

test("healthy page actual platform pure status and exact query retain canonical bindings", async () => {
  const result = await page();
  assert.equal(result.statusCalls, 1); assert.equal(result.props.sourceAvailable, true);
  assert.equal(result.props.rows[0].effective_status, "valid"); assert.equal(result.props.rows[0].can_review, false);
  assert.equal(result.props.rows[0].context_name, "FAMILY_CHILD"); assert.equal(result.props.rows[0].garden_name, "FAMILY_GARDEN");
  assert.equal(byClass(result.html, "document-list-card").length, 1);
  assert.equal(nodes(result.html, "DocumentReviewActions").length, 0);
  assert.equal(forbiddenEffects, 0);
});
for (const kind of ["stale", "null", "empty"]) test(`document source error ${kind} cannot show complete document state`, async () => {
  const result = await page({ docError: true, kind });
  assert.equal(result.statusCalls, 0); assert.deepEqual(plain(result.props.rows), []);
  unavailable(result.html); assert.equal(result.props.uploadTargets.length, 2);
});
test("unavailable family cannot retain stale upload identities or names", async () => {
  const result = await page({ familyError: true }); noFamily(result);
  assert.equal(result.statusCalls, 1); assert.equal(byClass(result.html, "document-list-card").length, 1);
  assert.equal(result.props.rows[0].context_name, "ילד/ה מקושר/ת"); assert.equal(result.props.rows[0].garden_name, "הגן המשויך");
});
test("unavailable empty family is not silently presented as verified empty", async () => { noFamily(await page({ familyError: true, familyEmpty: true })); });
test("paired document and family failures retain neither stale source", async () => {
  const result = await page({ docError: true, familyError: true });
  noFamily(result); unavailable(result.html); assert.equal(result.statusCalls, 0);
});
test("failed document poison never reaches spread policy or file mapping", async () => {
  const result = await page({ docError: true, documents: [{ get status() { throw new Error("STALE_STATUS"); }, get file_url() { throw new Error("STALE_FILE"); } }] });
  assert.equal(result.statusCalls, 0); unavailable(result.html);
});
test("failed family child poison never reaches context or target mapping", async () => {
  const familyPayload = familyFixture(); familyPayload.sourceUnavailable = true;
  familyPayload.children = [{ get id() { throw new Error("STALE_CHILD_ID"); } }];
  noFamily(await page({ familyPayload }));
});
for (const field of ["children", "gardens", "gardenIds"]) test(`aggregate family failure does not read ${field} getter`, async () => {
  const familyPayload = { sourceUnavailable: true, get [field]() { throw new Error(`STALE_FAMILY_${field}`); } };
  noFamily(await page({ familyPayload }));
});
for (const kind of ["empty", "null"]) test(`healthy document ${kind} remains original empty`, async () => {
  const result = await page({ kind });
  assert.equal(result.statusCalls, 0); assert.ok(text(result.html).includes("אין מסמכים בתצוגה הזו"));
  assert.equal(byClass(result.html, "documents-metrics").length, 1);
  assert.equal(result.props.uploadTargets.length, 2);
});
test("healthy empty family does not invent a family failure", async () => {
  const result = await page({ familyEmpty: true });
  assert.equal(nodes(result.tree).filter((node) => node.props.role === "status").length, 0);
  assert.deepEqual(plain(result.props.uploadTargets), []); assert.equal(result.props.rows[0].context_name, "ילד/ה מקושר/ת");
});
test("parent denial prevents client family query and status IO", async () => { await page({ deniedRole: true }); });
test("healthy canonical file URL and actual policy statuses remain unchanged", async () => {
  const rows = [document("valid"), { ...document("foreign"), file_url: "https://foreign.invalid/file" }, { ...document("expired"), expires_at: "2000-01-01" }, { ...document("replaced"), replaced_by: "new-id" }, { ...document("near"), expires_at: "2026-11-08" }];
  const result = await page({ documents: rows });
  assert.deepEqual(Array.from(result.props.rows, (row) => row.effective_status), ["valid", "valid", "expired", "replaced", "expiring_soon"]);
  assert.equal(result.props.rows[1].file_url, null);
  assert.ok(result.props.rows.every((row) => row.can_review === false));
  assert.ok(nodes(result.html, "a").every((node) => node.props.href === "/api/documents/valid/file"));
});
test("child and guardian target contracts keep guardian garden dedupe and Auth owner", async () => {
  const familyPayload = { sourceUnavailable: false, children: [{ id: "a", full_name: "A", garden_id: "garden-1" }, { id: "b", full_name: "B", garden_id: "garden-2" }, { id: "c", full_name: "C", garden_id: null }], gardens: [{ id: "garden-1", name: "G1" }, { id: "garden-2", name: "G2" }], gardenIds: ["garden-1", "garden-1", "garden-2"] };
  const result = await page({ familyPayload, documents: [{ ...document(), owner_type: "guardian", child_id: null }] });
  assert.deepEqual(plain(result.props.uploadTargets), [
    { id: "child-a", label: "מסמכי A", gardenId: "garden-1", ownerId: "a", documentTypes: ["child_document", "medical_approval"] },
    { id: "child-b", label: "מסמכי B", gardenId: "garden-2", ownerId: "b", documentTypes: ["child_document", "medical_approval"] },
    { id: "guardian-garden-1", label: "מסמכי הורה · G1", gardenId: "garden-1", ownerId: profile.id, documentTypes: ["guardian_document"] },
    { id: "guardian-garden-2", label: "מסמכי הורה · G2", gardenId: "garden-2", ownerId: profile.id, documentTypes: ["guardian_document"] },
  ]);
  assert.equal(result.props.rows[0].context_name, profile.full_name);
});
test("shared callers omit availability and keep original healthy rendering", () => {
  const harness = componentHarness();
  const html = harness.render({ title: "Other caller", subtitle: "Synthetic", roleLabel: "Other", rows: [document()] });
  assert.equal(byClass(html, "document-list-card").length, 1); assert.equal(byClass(html, "documents-metrics").length, 1);
});
test("direct unavailable shared props ignore poisoned rows before snapshot serialization", () => {
  const harness = componentHarness();
  unavailable(harness.render({ title: "Unavailable", subtitle: "Synthetic", roleLabel: "Other", sourceAvailable: false, rows: [{ get status() { throw new Error("STALE_SHARED_STATUS"); } }] }));
});
test("same component healthy to error to recovered commits no previous rows or actions", async () => {
  const result = await page({ documents: [document("old", "OLD_DOCUMENT")] });
  assert.ok(text(result.html).includes("OLD_DOCUMENT"));
  const failed = result.harness.render({ ...result.props, sourceAvailable: false, rows: result.props.rows });
  unavailable(failed); assert.ok(!text(failed).includes("OLD_DOCUMENT"));
  const recovered = result.harness.render({ ...result.props, sourceAvailable: true, rows: [{ ...document("new", "NEW_DOCUMENT"), effective_status: "valid", can_review: false }] });
  assert.ok(text(recovered).includes("NEW_DOCUMENT")); assert.ok(!text(recovered).includes("OLD_DOCUMENT"));
  assert.ok(nodes(recovered, "a").every((node) => node.props.href === "/api/documents/new/file"));
  assert.equal(result.harness.commits.length, 3);
});
test("healthy props replacement commits current rows without needing an unavailable interlude", async () => {
  const result = await page({ documents: [document("old", "OLD_DOCUMENT")] });
  const next = result.harness.render({ ...result.props, rows: [{ ...document("new", "NEW_DOCUMENT"), effective_status: "valid" }] });
  assert.ok(!text(next).includes("OLD_DOCUMENT")); assert.ok(text(next).includes("NEW_DOCUMENT"));
});
test("open modal to no targets unmounts stale editable state and stays closed on recovery", async () => {
  const result = await page(); clickUpload(result);
  const closed = result.harness.render({ ...result.props, uploadTargets: [] });
  assert.equal(nodes(closed).filter((node) => node.props.role === "dialog").length, 0);
  assert.equal(nodes(closed, "form").length, 0);
  const recovered = result.harness.render(result.props);
  assert.equal(nodes(recovered).filter((node) => node.props.role === "dialog").length, 0);
});
test("open replacement modal closes on source failure before the next committed frame", async () => {
  const result = await page();
  const replacement = nodes(result.html, "button").find((node) => text(node).includes("החלפת מסמך")); assert.ok(replacement);
  replacement.props.onClick();
  assert.equal(nodes(result.harness.render(result.props)).filter((node) => node.props.role === "dialog").length, 1);
  const failed = result.harness.render({ ...result.props, sourceAvailable: false });
  unavailable(failed); assert.equal(nodes(failed, "form").length, 0);
});
test("failed list preserves known healthy upload targets without showing stale details", async () => {
  const result = await page({ docError: true }); unavailable(result.html);
  const modal = clickUpload(result); unavailable(modal);
  assert.equal(nodes(modal, "form").length, 1); assert.equal(nodes(modal, "option").filter((node) => String(node.props.value).startsWith("child-") || String(node.props.value).startsWith("guardian-")).length, 2);
});
test("healthy search and filter state remain usable while props snapshot is unchanged", async () => {
  const result = await page({ documents: [document("one", "ONE_DOCUMENT"), { ...document("two", "TWO_DOCUMENT"), status: "pending_review" }] });
  const search = nodes(result.html, "input").find((node) => node.props.placeholder === "חיפוש לפי שם, סוג או בעלים..."); assert.ok(search);
  search.props.onChange({ target: { value: "TWO_DOCUMENT" } });
  const searched = result.harness.render(result.props);
  assert.equal(byClass(searched, "document-list-card").length, 1); assert.ok(text(byClass(searched, "document-list-card")[0]).includes("TWO_DOCUMENT"));
  const filter = nodes(searched, "button").find((node) => text(node).includes("מאומתים")); assert.ok(filter);
  filter.props.onClick();
  assert.equal(byClass(result.harness.render(result.props), "document-list-card").length, 0);
});
test("shared review control respects can_review false without executing action component", () => {
  const harness = componentHarness(), props = { title: "Review", subtitle: "Synthetic", roleLabel: "Other", canReview: true, rows: [{ ...document(), status: "pending_review", can_review: false }] };
  assert.equal(nodes(harness.render(props), "DocumentReviewActions").length, 0);
  assert.equal(nodes(harness.render({ ...props, rows: [{ ...props.rows[0], can_review: true }] }), "DocumentReviewActions").length, 1);
  assert.equal(forbiddenEffects, 0);
});
