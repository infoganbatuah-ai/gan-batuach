import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Install at scripts/qa in the prospective local candidate, NOT in this private directory.
// Actual page/helper/UI leaves; closed synthetic IO and capability dependency.
// Not live provider, database, Auth, RLS, financial, device or pilot qualification.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const allowedSources = new Set([
  "app/dashboard/admin/system-health/page.tsx", "lib/admin-safe.ts",
  "components/gan-batuach-design-system.tsx", "components/platform-admin-ui.tsx",
  "lib/ui/canonical-status.ts", "config/digital-observer-ci-gates.json",
]);
function source(relative) {
  assert.ok(allowedSources.has(relative), `source not allowlisted: ${relative}`);
  const path = resolve(root, relative);
  assert.ok(statSync(path).isFile(), `not a regular file: ${relative}`);
  if (process.platform === "darwin") {
    const flags = execFileSync("/usr/bin/stat", ["-f", "%f", path], { encoding: "utf8" }).trim();
    assert.match(flags, /^\d+$/);
    assert.equal(Number(flags) & 0x40000000, 0, `dataless source refused: ${relative}`);
  }
  return readFileSync(path, "utf8");
}
const ts = createRequire(import.meta.url)("typescript");
function compile(text, filename) {
  const result = ts.transpileModule(text, { fileName: filename, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } });
  const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${filename}: ${errors.map((item) => `TS${item.code}: ${ts.flattenDiagnosticMessageText(item.messageText, "\n")}`).join("\n")}`);
  return result.outputText;
}
const pageCode = compile(source("app/dashboard/admin/system-health/page.tsx"), "system-health.page.tsx") + "\nexports.qaFormatters={stateTone,stateLabel};";
const safeCode = compile(source("lib/admin-safe.ts"), "admin-safe.ts");
const leafCodes = {
  metrics: compile(source("components/gan-batuach-design-system.tsx"), "design-system.tsx"),
  truth: compile(source("components/platform-admin-ui.tsx"), "platform-admin-ui.tsx"),
  status: compile(source("lib/ui/canonical-status.ts"), "canonical-status.ts"),
};
const registry = JSON.parse(source("config/digital-observer-ci-gates.json"));
const plain = (value) => JSON.parse(JSON.stringify(value));
const denied = (name) => { throw new Error(`UNEXPECTED_IMPORT_OR_EFFECT:${String(name)}`); };
function load(code, require, warnings = []) {
  const exports = {};
  new vm.Script(code).runInNewContext({ exports, require, fetch: () => denied("fetch"), console: { warn: (...args) => warnings.push(args) } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports;
}
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
function nodes(value, type) {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, type));
  if (!value || typeof value !== "object" || !("type" in value)) return [];
  return [...(type === undefined || value.type === type ? [value] : []), ...Object.values(value.props).flatMap((item) => nodes(item, type))];
}
function text(value) {
  if (Array.isArray(value)) return value.map(text).join("");
  if (value == null || typeof value === "boolean" || typeof value === "function") return "";
  return typeof value === "object" ? text(value.props?.children) : String(value);
}
const inventory = [
  ["gardens", "gardens", "id,status,manager_id,inspector_id,inspection_required_status", [], 500],
  ["provider_delivery_logs", "delivery", "id,status,channel", [["order", "created_at", { ascending: false }]], 500],
  ["camera_streams", "cameras", "id,status,health_status", [], 500],
  ["documents", "documents", "id,status", [], 500],
  ["provider_production_health_metrics", "providerHealth", "integration_type,provider,provider_status,last_successful_request_at,credentials_missing,production_mode_enabled", [], 120],
  ["production_integrations", "integrations", "integration_type,provider,status,environment,send_mode", [["eq", "environment", "production"]], 120],
];
const expectedChains = inventory.map(([table, , projection, rest, limit]) => [table, [["select", projection, { count: "exact" }], ...rest, ["limit", limit]]]);
const types = ["email", "storage", "camera_gateway"];
const fixtures = () => [
  [{ manager_id: "synthetic-manager", inspector_id: "synthetic-inspector" }, { manager_id: null, inspector_id: "synthetic-inspector" }, { manager_id: "synthetic-manager", inspector_id: "synthetic-inspector", inspection_required_status: "pending_first_inspection" }],
  ["failed", "bounced", "delivered"].map((status) => ({ status })),
  [{ status: "offline" }, { status: "active", health_status: "degraded" }, { status: "active", health_status: "healthy" }],
  ["expired", "approved", "missing"].map((status) => ({ status })),
  types.map((integration_type) => ({ integration_type, provider: `synthetic-${integration_type}`, provider_status: "production_active", last_successful_request_at: "2026-11-01T00:00:00.000Z", credentials_missing: false, production_mode_enabled: true })),
  types.map((integration_type) => ({ integration_type, provider: `synthetic-${integration_type}`, status: "active", environment: "production", send_mode: "production" })),
];
function quietData() { const data = fixtures(); data[1] = []; data[2] = []; return data; }
const disabledCapability = Object.freeze({ payment: Object.freeze({ checkoutAvailable: false, providerAdapterVerified: false, webhookVerified: false, liveChargesEnabled: false, requestedMode: "disabled" }) });
const profile = Object.freeze({ id: "synthetic-admin", role: "admin" });
const serviceNames = ["יישום", "קריאות נתוני מערכת", "התראות ותקשורת", "תשלומים", "מסמכים ואחסון", "מצלמות / Digital Observer"];
const labels = { operational: "תפעולי", degraded: "מוגבל", setup_required: "נדרשת הגדרה", unavailable: "לא זמין", unknown: "לא נמדד" };
const tones = { operational: "good", degraded: "warning", setup_required: "warning", unavailable: "danger", unknown: "neutral" };

async function page({ failures = {}, data = fixtures(), counts = {}, loader = false, denyRole = false, capability = disabledCapability } = {}) {
  let clients = 0, financialCalls = 0, authorized = false, captured;
  const chains = [], warnings = [], resolvedSources = [];
  const actual = load(safeCode, denied, warnings);
  const safe = { ...actual, safeAdminData: async (...args) => { captured = await actual.safeAdminData(...args); return captured; } };
  const client = { from(table) {
    assert.ok(authorized);
    const index = chains.length;
    assert.equal(table, inventory[index]?.[0], "exact source and batch order");
    const calls = [];
    chains.push([table, calls]);
    if (failures[index]?.kind === "factory") throw new Error("PRIVATE_FACTORY");
    const query = {};
    for (const method of ["select", "order", "eq", "limit"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    query.then = (accept, reject) => {
      assert.equal(chains.length, 6, "six sources acquired in the same concurrent batch");
      resolvedSources.push(index);
      const failure = failures[index];
      if (failure?.kind === "reject") return Promise.reject(new Error("PRIVATE_REJECTED")).then(accept, reject);
      let rows = data[index];
      // Emulate the exact server predicate; preview rows do not survive production eq.
      if (Array.isArray(rows)) for (const [method, column, value] of calls) if (method === "eq") rows = rows.filter((row) => row[column] === value);
      const count = Object.hasOwn(counts, index) ? counts[index] : Array.isArray(rows) ? rows.length : 0;
      const limit = calls.find(([method]) => method === "limit")[1];
      const returned = failure && !failure.stale ? [] : Array.isArray(rows) ? rows.slice(0, limit) : rows;
      return Promise.resolve({ data: returned, count, error: failure ? { message: "PRIVATE_RETURNED" } : null }).then(accept, reject);
    };
    return query;
  } };
  const imports = new Map([
    ["react/jsx-runtime", { jsx, jsxs: jsx, Fragment: "Fragment" }],
    ["next/link", { __esModule: true, default: "Link" }],
    ["lucide-react", Object.fromEntries(["Activity", "BellRing", "Camera", "CreditCard", "Database", "FileText", "HeartPulse", "ServerCog", "ShieldCheck"].map((name) => [name, name]))],
    ["@/components/admin-app-ui", { AdminAppFrame: "AdminAppFrame" }],
    ["@/components/admin-data-state", { AdminDataError: "AdminDataError" }],
    ["@/components/gan-batuach-design-system", Object.fromEntries(["DashboardGrid", "MetricCard", "PremiumCard", "SectionHeader", "StatusChip"].map((name) => [name, name]))],
    ["@/components/platform-admin-ui", { AdminSectionIntro: "AdminSectionIntro", AdminTruthState: "AdminTruthState" }],
    ["@/lib/admin-safe", safe],
    ["@/lib/auth", { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients + financialCalls + chains.length, 0); if (denyRole) throw new Error("DENIED"); authorized = true; return { profile }; } }],
    ["@/lib/domain/financial-provider-capability", { getFinancialProviderCapabilities: () => { assert.ok(authorized); assert.equal(clients, 0); financialCalls++; return capability; } }],
    ["@/lib/supabase/server", { createClient: async () => { assert.ok(authorized); assert.equal(financialCalls, 1); clients++; if (loader) throw new Error("PRIVATE_LOADER"); return client; } }],
  ]);
  const loaded = load(pageCode, (name) => { if (!imports.has(name)) return denied(name); return imports.get(name); }, warnings);
  if (denyRole) {
    await assert.rejects(loaded.default(), /DENIED/);
    assert.equal(clients + financialCalls + chains.length, 0);
    return;
  }
  const tree = await loaded.default();
  const frame = nodes(tree, "AdminAppFrame")[0].props;
  assert.equal(frame.profile, profile);
  assert.equal(frame.activeHref, "/dashboard/admin/system-health");
  assert.equal(frame.title, "מצב מערכת");
  assert.equal(nodes(tree, "form").length, 0);
  assert.equal(clients, 1);
  assert.equal(financialCalls, 1);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_"), "no private error or source payload leakage");
  assert.ok(frame.subtitle.includes("רשומות מצב ומוכנות בלבד"));
  assert.ok(frame.subtitle.includes("לא בדיקת ספק חיה"));
  assert.deepEqual(nodes(tree, "Link").map((node) => node.props.href), ["/dashboard/admin/provider-production", "/dashboard/admin", "/dashboard/admin/database-integrity", "/dashboard/admin/provider-production", "/dashboard/admin/subscriptions", "/dashboard/admin/document-center", "/dashboard/admin/provider-production"]);
  const services = nodes(tree, "AdminTruthState").map((node) => ({ key: node.key, ...node.props, chip: nodes(node.props.title, "StatusChip")[0].props }));
  assert.deepEqual(services.map((service) => service.key), serviceNames);
  assert.deepEqual(plain(chains), loader ? [] : expectedChains.map(([table, calls], index) => [table, failures[index]?.kind === "factory" ? [] : calls]));
  return { tree, frame, services, metrics: nodes(tree, "MetricCard").map((node) => node.props), banner: nodes(tree, "AdminDataError")[0].props.message, result: captured, data: captured.data, warnings, chains, resolvedSources, capability, formatters: loaded.qaFormatters };
}
function expectStates(result, states) {
  assert.equal(states.length, 6);
  assert.deepEqual(result.services.map((service) => service.chip.children), states.map((state) => labels[state]));
  assert.deepEqual(result.services.map((service) => service.tone), states.map((state) => tones[state]));
  assert.deepEqual(result.services.map((service) => service.chip.tone), states.map((state) => state === "unknown" ? "default" : state === "operational" ? "success" : state === "unavailable" ? "danger" : "warning"));
  const complete = !states.includes("unknown");
  const totals = ["operational", "degraded", "unavailable"].map((state) => states.filter((item) => item === state).length);
  assert.deepEqual(result.metrics.slice(0, 3).map((metric) => metric.value), complete ? totals : Array(3).fill("לא זמין"));
  if (!complete) {
    assert.deepEqual(result.metrics.slice(0, 3).map((metric) => metric.tone), Array(3).fill("default"));
    assert.equal(result.frame.badge, "מצב חלקי — נתונים חסרים");
    assert.ok(result.metrics.slice(0, 3).every((metric) => /אינו מלא|אינה זמינה/.test(metric.hint)));
  } else {
    const queryProblem = Boolean(result.result.error || result.data.queryError);
    assert.deepEqual(result.metrics.slice(0, 3).map((metric) => metric.tone), [queryProblem ? "warning" : "success", totals[1] || queryProblem ? "warning" : "success", totals[2] ? "danger" : queryProblem ? "warning" : "success"]);
    assert.equal(result.frame.badge, totals[2] ? `${totals[2]} לא זמינים` : totals[1] ? `${totals[1]} מוגבלים` : "בדיקת שירות");
  }
}
function expectDependencies(result, incomplete = [], loader = false, partial = []) {
  const ready = (index) => !incomplete.includes(index);
  expectStates(result, ["operational", loader ? "unknown" : incomplete.length ? "degraded" : "operational", ready(1) ? "degraded" : "unknown", "setup_required", ready(3) && ready(4) && ready(5) ? "operational" : "unknown", ready(2) ? "degraded" : "unknown"]);
  assert.equal(result.metrics[3].value, ready(0) ? 2 : "לא זמין");
  assert.equal(result.metrics[3].tone, ready(0) ? "warning" : "default");
  for (let index = 0; index < 6; index++) {
    assert.equal(result.data.sourceState[inventory[index][1]], ready(index) ? "complete" : partial.includes(index) ? "partial" : "unavailable");
    if (!ready(index) && !partial.includes(index)) assert.deepEqual(Array.from(result.data[inventory[index][1]]), []);
  }
  assert.equal(result.data.batchLoaded, !loader);
  assert.equal(Boolean(result.banner), incomplete.length > 0);
  if (!ready(1)) assert.ok(result.services[2].text.includes("נתוני המסירה לא נמדדו במלואם"));
  else assert.ok(result.services[2].text.startsWith("1 כשלים"));
  if (!ready(3)) assert.ok(result.services[4].text.includes("נתוני המסמכים לא נמדדו במלואם"));
  else assert.ok(result.services[4].text.startsWith("2 מסמכים"));
  if (!ready(2)) assert.ok(result.services[5].text.includes("מצב מקורות המצלמה לא נמדד במלואו"));
  else assert.ok(result.services[5].text.startsWith("2 מקורות"));
}
function expectProviders(result, state) {
  expectStates(result, ["operational", "operational", state, "setup_required", state, state]);
}

test("healthy actual page and helper retain six exact chains and independent counts", async () => {
  const result = await page();
  expectDependencies(result);
  assert.equal(result.banner, null);
  assert.deepEqual(result.metrics.slice(0, 3).map((metric) => metric.value), [3, 2, 0]);
});
for (let index = 0; index < 6; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) {
  test(`source ${index} ${kind} ${stale ? "stale" : "empty"} isolates failure and preserves neighbors`, async () => {
    const result = await page({ failures: { [index]: { kind, stale } } });
    expectDependencies(result, [index]);
    assert.deepEqual(plain(result.warnings), [["Admin Supabase query unavailable:", `platform service status ${index}`]]);
    assert.equal(result.resolvedSources.length, 6);
  });
}
for (let index = 0; index < 6; index++) test(`source ${index} synchronous factory throw remains contained`, async () => {
  const result = await page({ failures: { [index]: { kind: "factory" } } });
  expectDependencies(result, [index]);
  assert.deepEqual(plain(result.warnings), [["Admin Supabase query unavailable:", `platform service status ${index}`]]);
  assert.equal(result.resolvedSources.length, 5);
});
for (const failed of [[0, 3], [1, 2], [1, 4], [2, 5], [3, 4], [4, 5], [0, 1, 2, 3, 4, 5]]) test(`combined failures ${failed} preserve independent evidence`, async () => {
  const result = await page({ failures: Object.fromEntries(failed.map((index) => [index, { kind: index % 2 ? "reject" : "returned", stale: true }])) });
  expectDependencies(result, failed);
  assert.equal(result.warnings.length, failed.length);
});
test("outer loader failure is not a completed query batch", async () => {
  const result = await page({ loader: true });
  expectDependencies(result, [0, 1, 2, 3, 4, 5], true);
  assert.deepEqual(plain(result.warnings), [["Admin page data unavailable:", "platform service status"]]);
  assert.ok(!result.services[1].text.includes("קריאות המסך הושלמו"));
});
test("admin denial precedes capability client and all source IO", async () => { await page({ denyRole: true }); });
test("verified empty rows plus exact zero counts remain healthy empty not provider proof", async () => {
  const result = await page({ data: Array.from({ length: 6 }, () => []), counts: Object.fromEntries(inventory.map((_, index) => [index, 0])) });
  expectStates(result, ["operational", "operational", "setup_required", "setup_required", "setup_required", "setup_required"]);
  assert.equal(result.metrics[3].value, 0);
  assert.equal(result.metrics[3].tone, "success");
  assert.equal(result.banner, null);
  for (const index of [2, 4, 5]) assert.ok(result.services[index].text.startsWith("0 "));
});
for (let index = 0; index < 6; index++) test(`source ${index} null data is not verified empty even with zero count`, async () => {
  const data = fixtures(); data[index] = null;
  expectDependencies(await page({ data, counts: { [index]: 0 } }), [index]);
});
const invalidCounts = [["null", null], ["missing", undefined], ["negative", -1], ["fractional", 0.5], ["string", "3"], ["NaN", Number.NaN], ["Infinity", Number.POSITIVE_INFINITY]];
for (let index = 0; index < 6; index++) for (const [label, value] of invalidCounts) test(`source ${index} ${label} count cannot become healthy zero`, async () => {
  expectDependencies(await page({ counts: { [index]: value } }), [index]);
});
for (let index = 0; index < 6; index++) test(`source ${index} rows exceeding reported count are unavailable`, async () => {
  expectDependencies(await page({ counts: { [index]: 0 } }), [index]);
});
for (let index = 0; index < 6; index++) test(`source ${index} truncated count retains partial evidence without complete totals`, async () => {
  const data = fixtures();
  const result = await page({ data, counts: { [index]: data[index].length + 1 } });
  expectDependencies(result, [index], false, [index]);
  assert.deepEqual(plain(result.data[inventory[index][1]]), data[index]);
  assert.ok(result.banner.includes("מוצגים חלקית"));
});
const statusCases = [["production_active", "operational"], ["failed", "unavailable"], ["disabled", "unavailable"], ["degraded", "degraded"], ["healthy", "setup_required"], ["operational", "setup_required"], ["active", "setup_required"], ["offline", "setup_required"], ["unavailable", "setup_required"], ["warning", "setup_required"], ["pending", "setup_required"], ["", "setup_required"], [null, "setup_required"], [undefined, "setup_required"]];
for (const [status, expected] of statusCases) test(`recorded provider status ${String(status)} requires current readiness contract`, async () => {
  const data = quietData(); data[4].forEach((row) => { row.provider_status = status; });
  expectProviders(await page({ data }), expected);
});
const readinessCases = [
  ["health provider mismatch", (data) => data[4].forEach((row) => { row.provider = "different-provider"; })],
  ["health type mismatch", (data) => data[4].forEach((row) => { row.integration_type = "other-type"; })],
  ["preview integration filtered out", (data) => data[5].forEach((row) => { row.environment = "preview"; })],
  ...["mock", "shadow", "sandbox", "preview", "", null].map((value) => [`send mode ${String(value)}`, (data) => data[5].forEach((row) => { row.send_mode = value; })]),
  ...["disabled", "failed", "pending"].map((value) => [`inactive integration ${value}`, (data) => data[5].forEach((row) => { row.status = value; })]),
  ...[false, "true", undefined].map((value) => [`production flag ${String(value)}`, (data) => data[4].forEach((row) => { row.production_mode_enabled = value; })]),
  ...[true, "false", undefined].map((value) => [`credentials flag ${String(value)}`, (data) => data[4].forEach((row) => { row.credentials_missing = value; })]),
  ...[null, "", undefined].map((value) => [`missing success reference ${String(value)}`, (data) => data[4].forEach((row) => { row.last_successful_request_at = value; })]),
  ["truthy legacy verification cannot substitute current evidence", (data) => { data[4].forEach((row) => { delete row.last_successful_request_at; }); data[5].forEach((row) => { row.production_verified_at = "false"; }); }],
  ["empty provider health cannot prove readiness", (data) => { data[4] = []; }],
  ["empty integrations cannot prove readiness", (data) => { data[5] = []; }],
];
for (const [name, change] of readinessCases) test(`provider readiness denies ${name}`, async () => {
  const data = quietData(); change(data);
  expectProviders(await page({ data }), "setup_required");
});
test("live send mode with matching strict evidence remains accepted recorded readiness", async () => {
  const data = quietData(); data[5].forEach((row) => { row.send_mode = "live"; row.status = "production_active"; });
  expectProviders(await page({ data }), "operational");
});
test("a different provider's healthy record cannot override matched failed evidence", async () => {
  const data = quietData();
  data[4] = [...data[4].map((row) => ({ ...row, provider: "unrelated-provider" })), ...data[4].map((row) => ({ ...row, provider_status: "failed" }))];
  expectProviders(await page({ data }), "unavailable");
});
test("an independently matching second provider can establish recorded readiness", async () => {
  const data = quietData();
  data[4] = [...data[4].map((row) => ({ ...row, provider_status: "failed" })), ...data[4].map((row) => ({ ...row, provider: `second-${row.provider}` }))];
  data[5] = [...data[5], ...data[5].map((row) => ({ ...row, provider: `second-${row.provider}` }))];
  expectProviders(await page({ data }), "operational");
});
for (const local of ["positive", "zero", "unknown"]) for (const provider of ["operational", "degraded", "unavailable", "unknown"]) for (const index of [1, 2]) test(`local source ${index} ${local} versus provider ${provider}`, async () => {
  const data = quietData(), failures = {};
  if (local === "positive") data[index] = [index === 1 ? { status: "failed" } : { status: "offline" }];
  if (local === "unknown") failures[index] = { kind: "returned", stale: true };
  if (provider === "unknown") failures[5] = { kind: "reject" };
  else data[4].forEach((row) => { row.provider_status = provider === "operational" ? "production_active" : provider === "unavailable" ? "failed" : "degraded"; });
  const result = await page({ data, failures });
  const service = result.services[index === 1 ? 2 : 5];
  const expected = local === "unknown" ? "unknown" : local === "positive" ? "degraded" : provider;
  assert.equal(service.chip.children, labels[expected]);
  assert.equal(service.tone, tones[expected]);
  if (local !== "unknown") assert.ok(service.text.startsWith(local === "positive" ? "1 " : "0 "));
});
test("unavailable garden source retains numeric independent service totals with warning zero tones", async () => {
  const result = await page({ failures: { 0: { kind: "reject" } } });
  expectDependencies(result, [0]);
  assert.deepEqual(result.metrics.slice(0, 3).map((metric) => metric.value), [2, 3, 0]);
  assert.deepEqual(result.metrics.slice(0, 3).map((metric) => metric.tone), ["warning", "warning", "warning"]);
});
test("current issue predicates are strict where defined without broad legacy fallback", async () => {
  const data = fixtures();
  data[0] = [{ manager_id: "m", inspector_id: "i", inspection_required_status: { toString: () => "pending_first_inspection" } }, { manager_id: "", inspector_id: "i" }, { manager_id: "m", inspector_id: null }, { manager_id: "m", inspector_id: "i", inspection_required_status: "pending_first_inspection" }];
  data[1] = [{ status: "FAILED" }, { status: "bounced" }, { status: "unfailed" }, { status: "failed" }];
  data[2] = [{ status: "OFFLINE" }, { status: { toString: () => "offline" } }, { status: "active", health_status: { toString: () => "unhealthy" } }, { status: "active", health_status: "OFFLINE" }];
  data[3] = [{ status: { toString: () => "missing" } }, { status: "REJECTED" }, { status: "replacement_required" }, { status: "expired" }];
  const result = await page({ data });
  assert.equal(result.metrics[3].value, 3);
  assert.ok(result.services[2].text.startsWith("1 "));
  assert.ok(result.services[5].text.startsWith("2 "));
  assert.ok(result.services[4].text.startsWith("2 "));
});
test("actual metric truth-state and chip leaves render unknown neutrally", async () => {
  const result = await page({ loader: true });
  const status = load(leafCodes.status, denied);
  const common = (name) => {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (name === "next/link") return { __esModule: true, default: "Link" };
    if (name === "react") return { useId: () => denied("useId") };
    if (name === "lucide-react") return new Proxy({}, { get: (_, key) => String(key) });
    if (name === "@/lib/ui/canonical-status") return status;
    if (name === "@/components/global-state-system") return { GlobalStatePanel: () => denied("GlobalStatePanel") };
    return denied(name);
  };
  const actual = load(leafCodes.metrics, common), truth = load(leafCodes.truth, common);
  function expand(node) {
    if (Array.isArray(node)) return node.map(expand);
    if (!node || typeof node !== "object") return node;
    if (typeof node.type === "function") return expand(node.type(node.props));
    return { ...node, props: { ...node.props, children: expand(node.props.children) } };
  }
  for (const metric of result.metrics) {
    assert.equal(metric.tone, "default");
    const rendered = expand(actual.MetricCard(metric));
    assert.ok(rendered.props.className.includes("gb-tone-default"));
    assert.ok(text(rendered).includes("לא זמין"));
    assert.ok(!text(rendered).includes("תקין"));
  }
  for (const service of result.services.filter((item) => item.tone === "neutral")) {
    assert.equal(truth.AdminTruthState(service).props.className, "platform-admin-truth state-neutral");
    const chip = actual.StatusChip(service.chip);
    assert.equal(chip.props.className, "gb-status-chip gb-tone-default");
    assert.equal(text(chip), "לא נמדד");
  }
});
for (const [checkout, adapter, webhook, expected] of [[false, false, false, "setup_required"], [true, false, false, "degraded"], [true, true, false, "degraded"], [true, true, true, "operational"]]) test(`synthetic payment capability ${checkout}/${adapter}/${webhook} stays independent`, async () => {
  const capability = { payment: { checkoutAvailable: checkout, providerAdapterVerified: adapter, webhookVerified: webhook } };
  const result = await page({ capability, failures: Object.fromEntries(inventory.map((_, index) => [index, { kind: "reject" }])) });
  assert.equal(result.services[3].chip.children, labels[expected]);
  assert.equal(result.services[3].tone, tones[expected]);
  assert.equal(result.capability, capability);
});
test("recorded state vocabulary and one existing domain hook are preserved", async () => {
  const result = await page();
  assert.deepEqual(plain(result.formatters.stateLabel), labels);
  for (const [state, tone] of Object.entries(tones)) assert.equal(result.formatters.stateTone(state), tone);
  assert.deepEqual(registry.domain.filter((entry) => entry.name === "system-health-query-boundary"), [{ name: "system-health-query-boundary", args: ["--test", "scripts/qa/check-system-health-query-boundary.mjs"] }]);
  assert.equal(registry.security.filter((entry) => entry.name === "system-health-query-boundary").length, 0);
});

// Deliberate source-review limitations, not silently converted to passing safety claims:
// provider equality currently accepts null===null / undefined===undefined; the Product
// does not validate nonempty provider identifiers before its operational predicate.
// The success reference uses Boolean(), not timestamp parsing. Root must decide/fix
// those Product contracts separately; this harness is not permission to change them.
