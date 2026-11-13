import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const source = {
  safe: compile("lib/admin-safe.ts"),
  gardens: compile("app/dashboard/admin/kindergartens/page.tsx"),
  health: compile("app/dashboard/admin/system-health/page.tsx")
};
const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
const noop = () => null;

function load(code, require) {
  const exports = {};
  runInNewContext(code, { exports, require, console: { warn() {} }, Object, Promise, Array, Number, String, Boolean, Intl, Date });
  return exports;
}

function textOf(tree) {
  if (tree == null || typeof tree === "boolean") return "";
  if (typeof tree !== "object") return String(tree);
  if (Array.isArray(tree)) return tree.map(textOf).join(" ");
  const props = tree.props ?? {};
  return ["title", "text", "message", "label", "value", "badge", "children"].map((key) => textOf(props[key])).join(" ");
}

function nodesOf(tree, kind, out = []) {
  if (Array.isArray(tree)) tree.forEach((item) => nodesOf(item, kind, out));
  else if (tree && typeof tree === "object") {
    if (tree.type === kind) out.push(tree);
    nodesOf(tree.props?.children, kind, out);
  }
  return out;
}

function pageFixture(kind, overrides = {}) {
  const reads = [];
  let authorized = false;
  const defaultRows = kind === "gardens" ? {
    gardens: [{ id: "garden-1", name: "גן בדיקה", city: "חיפה", status: "active", children_capacity: 20 }],
    children: [{ garden_id: "garden-1" }],
    staff: [{ garden_id: "garden-1" }],
    complaints: [], documents: [], kindergarten_subscriptions: []
  } : { gardens: [], provider_delivery_logs: [], camera_streams: [], documents: [], provider_production_health_metrics: [], production_integrations: [] };
  const rows = { ...defaultRows, ...overrides };
  const client = { from(table) {
    assert.ok(authorized, "authorization must precede data access");
    assert.ok(Object.hasOwn(rows, table), `unexpected table: ${table}`);
    const read = { table, select: null, filters: [], count: null };
    reads.push(read);
    const builder = {
      select(columns, options) { read.select = columns; read.count = options?.count; return builder; },
      in(column, values) { read.filters.push({ column, values }); return builder; },
      eq(column, value) { read.filters.push({ column, value }); return builder; },
      order() { return builder; },
      limit() {
        const result = rows[table];
        if (result?.error) return Promise.resolve({ data: null, count: null, error: { code: "PRIVATE_ERROR", message: "PRIVATE_IDENTIFIER" } });
        const data = Array.isArray(result) ? result : result.data;
        return Promise.resolve({ data, count: result?.count ?? data.length, error: null });
      }
    };
    return builder;
  } };
  const safe = load(source.safe, () => { throw Error("unexpected helper import"); });
  const require = (id) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react") return new Proxy({}, { get: () => noop });
    if (id.endsWith("/admin-safe")) return safe;
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); authorized = true; return { profile: {} }; } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => client };
    if (id.endsWith("/financial-provider-capability")) return { getFinancialProviderCapabilities: () => ({ payment: { checkoutAvailable: false, providerAdapterVerified: false, webhookVerified: false } }) };
    if (id.endsWith("/display-label")) return { cleanSyntheticLabel: (value) => value };
    if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/admin-app-ui")) return { AdminAppFrame: "AdminAppFrame" };
    if (id.endsWith("/gan-batuach-design-system")) return new Proxy({}, { get: (_, name) => name });
    if (id.endsWith("/platform-admin-ui")) return { AdminSectionIntro: "AdminSectionIntro", AdminTruthState: "AdminTruthState" };
    throw Error(`unexpected import: ${id}`);
  };
  const page = load(source[kind], require).default;
  return { render: () => kind === "gardens" ? page({ searchParams: Promise.resolve({}) }) : page(), reads };
}

test("bounded reads distinguish verified empty, partial and failed results", () => {
  const safe = load(source.safe, () => { throw Error("unexpected helper import"); });
  assert.equal(safe.adminBoundedRows({ data: [], count: 0, error: null }).state, "complete");
  assert.equal(safe.adminBoundedRows({ data: [{ id: 1 }], count: 3, error: null }).state, "partial");
  assert.equal(safe.adminBoundedRows({ data: [], count: null, error: null }).state, "unavailable");
  assert.equal(safe.adminBoundedRows({ data: [{ id: 1 }], count: 0, error: null }).state, "unavailable");
  assert.equal(safe.adminBoundedRows({ data: [], count: 0, error: { code: "PRIVATE" } }).state, "unavailable");
});

test("Gardens keeps the valid garden and refuses a false zero for failed document data", async () => {
  const fixture = pageFixture("gardens", { documents: { error: true } });
  const tree = await fixture.render();
  const text = textOf(tree);
  assert.match(text, /גן בדיקה/);
  assert.match(text, /מסמכים לא נטענו/);
  assert.match(text, /פעולות פתוחות.*לא נמדד/);
  assert.doesNotMatch(text, /PRIVATE_IDENTIFIER/);
  assert.equal(fixture.reads.length, 6);
  assert.ok(fixture.reads.every((read) => read.count === "exact"));
  assert.deepEqual(Array.from(fixture.reads.find((read) => read.table === "documents").filters[0].values), ["missing", "pending_review", "rejected", "expired"]);
});

test("Gardens does not report a capped result as a complete garden list", async () => {
  const fixture = pageFixture("gardens", { gardens: { data: [{ id: "garden-1", name: "גן בדיקה", status: "active" }], count: 2 } });
  const tree = await fixture.render();
  assert.match(textOf(tree), /גנים מוצגים חלקית/);
  assert.equal(nodesOf(tree, "AdminAppFrame")[0].props.badge, "נתוני גנים חלקיים");
});

test("System Health preserves a verified empty state without green provider claims", async () => {
  const fixture = pageFixture("health");
  const tree = await fixture.render();
  const text = textOf(tree);
  assert.match(text, /נדרשת הגדרה/);
  assert.doesNotMatch(text, /PRIVATE_IDENTIFIER/);
  assert.equal(fixture.reads.length, 6);
  assert.ok(fixture.reads.every((read) => read.count === "exact"));
  assert.ok(fixture.reads.some((read) => read.table === "provider_delivery_logs"));
  assert.ok(fixture.reads.some((read) => read.table === "production_integrations" && !read.select.includes("production_verified_at")));
});

test("System Health exposes a failed delivery query as unmeasured, without private error data", async () => {
  const fixture = pageFixture("health", { provider_delivery_logs: { error: true } });
  const tree = await fixture.render();
  const text = textOf(tree);
  assert.match(text, /מסירה לא נטענו/);
  assert.match(text, /נתוני המסירה לא נמדדו במלואם/);
  assert.match(text, /לא נמדד/);
  assert.doesNotMatch(text, /PRIVATE_IDENTIFIER/);
});

test("System Health refuses to treat mock provider configuration as operational", async () => {
  const fixture = pageFixture("health", {
    production_integrations: [{ integration_type: "email", provider: "fixture", status: "active", environment: "production", send_mode: "mock" }],
    provider_production_health_metrics: [{ integration_type: "email", provider: "fixture", provider_status: "production_active", credentials_missing: false, production_mode_enabled: true, last_successful_request_at: "2026-11-01T00:00:00Z" }]
  });
  const tree = await fixture.render();
  const text = textOf(tree);
  assert.match(text, /נדרשת הגדרה/);
  const service = nodesOf(tree, "AdminTruthState").find((node) => textOf(node.props.title).includes("התראות ותקשורת"));
  assert.equal(service.props.tone, "warning");
});

test("System Health marks a provider operational only with matched production readiness evidence", async () => {
  const fixture = pageFixture("health", {
    production_integrations: [{ integration_type: "email", provider: "fixture", status: "active", environment: "production", send_mode: "production" }],
    provider_production_health_metrics: [{ integration_type: "email", provider: "fixture", provider_status: "production_active", credentials_missing: false, production_mode_enabled: true, last_successful_request_at: "2026-11-01T00:00:00Z" }]
  });
  const service = nodesOf(await fixture.render(), "AdminTruthState").find((node) => textOf(node.props.title).includes("התראות ותקשורת"));
  assert.equal(service.props.tone, "good");
  assert.match(textOf(service.props.title), /תפעולי/);
});
