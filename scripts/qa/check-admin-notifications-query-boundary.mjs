import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/shared loader/client initial render; synthetic records only.
// Event handlers, effects, notification APIs, providers and databases never run.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/notifications/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const centerCode = compile(source("components/notification-center.tsx"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) {
  const exports = {};
  vm.runInNewContext(code, { exports, require, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } });
  return exports;
}
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const profile = { id: "SYNTHETIC_ADMIN", role: "admin" };
const fixtures = [
  { id: "SYNTHETIC_N2", title: "SYNTHETIC_DOCUMENT", body: "SYNTHETIC_BODY", status: "unread", read_at: null, action_url: "/dashboard/admin/documents", metadata: { href: "/dashboard/admin/notifications", synthetic: true }, unknown: { zero: 0 } },
  { id: "SYNTHETIC_N1", title: "SYNTHETIC_TASK", message: "SYNTHETIC_MESSAGE", status: "read", read_at: null, entity_type: "task" },
  { id: "SYNTHETIC_N0", title: "", body: "", status: "open", read_at: "SYNTHETIC_READ", action_url: "/dashboard", severity: "SYNTHETIC_SEVERITY" }
];
function renderCenter(notifications) {
  let renders = 0;
  const client = load(centerCode, id => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react") return new Proxy({}, { get: (_, key) => `Icon:${String(key)}` });
    if (id === "react") return {
      useState: value => { renders++; return [value, unexpected]; },
      useMemo: calculate => calculate(),
      useTransition: () => [false, unexpected]
    };
    return unexpected(id);
  });
  const tree = client.NotificationCenter({ notifications });
  assert.equal(renders, 4);
  return tree;
}
async function page({ kind = "healthy", data = fixtures, denied = false } = {}) {
  let clients = 0, helperCalls = 0, captured;
  const chains = [], warnings = [], effects = [];
  const actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...a) => { helperCalls++; assert.equal(a[0], "התראות"); captured = await actual.safeAdminData(...a); return captured; } };
  const client = { from(table) {
    assert.equal(table, "notifications"); assert.equal(chains.length, 0);
    const calls = [], q = {}; chains.push([table, calls]);
    if (kind === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "order", "limit"]) q[method] = (...args) => { calls.push([method, ...args]); return q; };
    q.then = (yes, no) => (kind === "reject" ? Promise.reject(Error("PRIVATE_QUERY")) : Promise.resolve({ data, error: kind === "returned" ? { message: "PRIVATE_QUERY", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no);
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (id === "lucide-react") return { BellRing: "BellRing" };
    if (id === "@/components/admin-app-ui") return { AdminAppFrame: "AdminAppFrame" };
    if (id === "@/components/notification-center") return { NotificationCenter: "NotificationCenter" };
    if (id === "@/components/gan-batuach-design-system") return { PremiumCard: "PremiumCard", SectionHeader: "SectionHeader", StatusChip: "StatusChip" };
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); return { profile }; } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (kind === "loader") throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(helperCalls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default();
  assert.equal(helperCalls, 1); assert.equal(clients, 1);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_"));
  assert.equal(effects.length, 0);
  return { tree, text: text(tree), chains, warnings, data: captured.data, center: nodes(tree, "NotificationCenter"), effects };
}
function staticUI(r) {
  const frame = nodes(r.tree, "AdminAppFrame")[0];
  assert.equal(frame.props.profile, profile);
  assert.equal(frame.props.activeHref, "/dashboard/admin/notifications");
  assert.equal(frame.props.title, "מרכז התראות");
  assert.equal(frame.props.subtitle, "פיקוח, מסמכים, מצלמות, AI, הודעות, משימות ואישורי רישום.");
  assert.equal(frame.props.badge, "התראות");
  const card = nodes(r.tree, "PremiumCard")[0];
  assert.equal(card.props.size, "lg"); assert.equal(card.props.className, "admin-section-card");
  const header = nodes(card, "SectionHeader")[0];
  assert.equal(header.props.title, "עד 150 ההתראות האחרונות, לפי הרשומות שנטענו");
  assert.equal(header.props.subtitle, "כל התראה צריכה מקור, הקשר, חומרה ופעולת המשך ברורה.");
  assert.equal(header.props.eyebrow, "Notification Center"); assert.equal(header.props.icon, "BellRing");
  const chip = nodes(card, "StatusChip")[0]; assert.equal(chip.props.tone, "warning"); assert.equal(text(chip), "Control Center");
}
function query(r, kind = "healthy") {
  assert.deepEqual(plain(r.chains), kind === "loader" ? [] : [["notifications", kind === "factory" ? [] : [["select", "*"], ["order", "created_at", { ascending: false }], ["limit", 150]]]]);
  staticUI(r);
}
function unavailable(r) {
  assert.equal(r.data.available, false); assert.deepEqual(Array.from(r.data.rows), []);
  assert.equal(r.center.length, 0);
  assert.equal(nodes(r.tree, "button").length, 0); assert.equal(nodes(r.tree, "Link").length, 0);
  assert.equal(nodes(r.tree, "article").length, 0);
  assert.ok(r.text.includes("נתוני ההתראות אינם זמינים"));
  assert.ok(r.text.includes("לא ניתן לטעון את הנתונים כרגע"));
  assert.ok(!r.text.includes("אין התראות במסנן הזה")); assert.ok(!r.text.includes("לא נקראו"));
  assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_N")); assert.ok(!JSON.stringify(r.tree).includes("SYNTHETIC_BODY"));
  const status = nodes(r.tree, "div").find(n => n.props["aria-label"] === "נתוני התראות לא זמינים");
  assert.equal(status.props.role, "status"); assert.equal(status.props.className, "card");
  staticUI(r);
}
test("healthy exact query/admin admission/raw array identity/frame retained", async () => {
  const r = await page(); query(r); assert.equal(r.data.available, true); assert.equal(r.center.length, 1);
  assert.equal(r.center[0].props.notifications, fixtures); assert.equal(r.data.rows, fixtures); assert.equal(r.warnings.length, 0);
  assert.ok(!r.text.includes("נתוני ההתראות אינם זמינים"));
});
for (const kind of ["returned", "reject", "factory", "loader"]) for (const data of [fixtures, [], null]) test(`${kind}/${data === null ? "null" : data.length ? "stale" : "empty"} unknown hides client and all failed-data actions`, async () => {
  const r = await page({ kind, data }); query(r, kind); unavailable(r);
  assert.deepEqual(plain(r.warnings), [[kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:", "התראות"]]);
});
test("role denial propagates before helper client or query", async () => { await page({ denied: true }); });
for (const data of [[], null]) test(`healthy${data === null ? "null" : "empty"} retains ACTUAL client ordinary empty notunknown`, async () => {
  const r = await page({ data }); query(r); assert.equal(r.data.available, true); assert.equal(r.center.length, 1);
  assert.deepEqual(Array.from(r.center[0].props.notifications), []); assert.equal(r.warnings.length, 0);
  const client = renderCenter(r.center[0].props.notifications);
  assert.ok(text(client).includes("אין התראות במסנן הזה")); assert.ok(text(client).includes("0 לא נקראו"));
  const markAll = nodes(client, "button").find(n => text(n).includes("סימון הכל כנקרא")); assert.equal(markAll.props.disabled, true);
  assert.ok(!r.text.includes("נתוני ההתראות אינם זמינים"));
});
test("ACTUAL client initial rows/unread/category/body/fallback semantics unchanged without actions", async () => {
  const r = await page(); const client = renderCenter(r.center[0].props.notifications);
  assert.deepEqual(nodes(client, "article").map(n => n.key), fixtures.map(n => n.id));
  assert.ok(text(client).includes("1 לא נקראו")); assert.ok(text(client).includes("SYNTHETIC_BODY")); assert.ok(text(client).includes("SYNTHETIC_MESSAGE"));
  assert.ok(text(client).includes("עדכון חדש")); assert.equal(nodes(client, "Link").length, 0);
  assert.equal(nodes(client, "button").filter(n => n.props.className === "notification-quick-read").length, 2);
  assert.equal(nodes(client, "button").find(n => text(n).includes("סימון הכל כנקרא")).props.disabled, false);
});
for (const status of ["read", "READ", "", null, undefined]) test(`raw read-status ${String(status)} initial semantics only`, async () => {
  const rows = [{ ...fixtures[0], status }]; const r = await page({ data: rows });
  assert.equal(r.center[0].props.notifications, rows);
  const client = renderCenter(rows); assert.ok(text(client).includes(`${status === "read" ? 0 : 1} לא נקראו`));
});
test("raw fields identities metadata order preserved no local clamp or coercion", async () => {
  const rows = Array.from({ length: 153 }, (_, i) => ({ ...fixtures[0], id: `SYNTHETIC_${152 - i}`, metadata: { href: "/dashboard/admin/notifications", zero: 0, empty: "" } }));
  const r = await page({ data: rows }); query(r); assert.equal(r.center[0].props.notifications, rows);
  assert.equal(r.center[0].props.notifications[0], rows[0]); assert.equal(r.center[0].props.notifications.length, 153);
  assert.deepEqual(nodes(renderCenter(rows), "article").map(n => n.key), rows.map(n => n.id));
});
test("exactly one domain hook and no security hook", () => {
  const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-notifications-query-boundary";
  assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-notifications-query-boundary.mjs"] }]);
  assert.equal(c.security.filter(x => x.name === name).length, 0);
});
