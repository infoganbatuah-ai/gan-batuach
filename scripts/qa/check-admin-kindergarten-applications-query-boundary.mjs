import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Readonly actual page + actual safeAdminData. All identities/prices are synthetic.
// Action components are JSX boundary labels, NEVER invoked; no SDK/API/handlers.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const f = path.join(root, p); fs.statSync(f); return fs.readFileSync(f, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/kindergarten-applications/page.tsx"));
const helperCode = compile(source("lib/admin-safe.ts"));
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const runtime = { jsx, jsxs: jsx, Fragment: "Fragment" };
const plain = v => JSON.parse(JSON.stringify(v));
const unexpected = id => { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); };
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, fetch: unexpected, FormData: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
function nodes(v, type) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const keys = ["gardens", "onboarding", "fees", "ages", "documents", "profiles", "subscriptions"];
const tables = ["gardens", "kindergarten_onboarding_records", "kindergarten_fee_groups", "kindergarten_age_group_setups", "documents", "profiles", "kindergarten_subscriptions"];
const selections = ["id,name,city,address,phone,email,owner_name,status,approval_flow_status,final_approval_status,manager_id,public_profile_enabled,admin_correction_note,created_at", "*", "id,garden_id,group_name,age_range,monthly_fee,show_price_public,capacity,active", "garden_id,age_group,children_count,monthly_child_price,annual_child_price,billing_cycle", "id,garden_id,name,document_type,status", "id,full_name,phone,email,self_service_role,self_service_status,active", "id,garden_id,status,billing_status,metadata,created_at"];
const profile = { id: "SYNTHETIC_ADMIN", role: "admin" };
const currency = value => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(value ?? 0));
function fixtures() { return {
  gardens: [{ id: "SYNTHETIC_G0", name: "SYNTHETIC_GARDEN", manager_id: "SYNTHETIC_M0", owner_name: "SYNTHETIC_OWNER", city: "SYNTHETIC_CITY", address: "SYNTHETIC_ADDRESS", created_at: null, approval_flow_status: "active", admin_correction_note: "SYNTHETIC_NOTE" }],
  onboarding: [{ garden_id: "SYNTHETIC_G0", progress_percent: 63, subscription_monthly_amount: 231 }],
  fees: [{ id: "SYNTHETIC_F0", garden_id: "SYNTHETIC_G0", group_name: "SYNTHETIC_FEE", monthly_fee: 811, capacity: 5, show_price_public: true, active: true }],
  ages: [{ garden_id: "SYNTHETIC_G0", age_group: "SYNTHETIC_AGE", children_count: 7, monthly_child_price: 913 }],
  documents: [{ id: "SYNTHETIC_D0", garden_id: "SYNTHETIC_G0", name: "SYNTHETIC_DOCUMENT" }],
  profiles: [{ id: "SYNTHETIC_M0", full_name: "SYNTHETIC_MANAGER", active: true, email: "SYNTHETIC_UNUSED_EMAIL", phone: "SYNTHETIC_UNUSED_PHONE" }],
  subscriptions: [{ garden_id: "SYNTHETIC_G0", status: "approved", metadata: { monthly_amount_nis: 419 } }]
}; }
async function page({ data = fixtures(), failures = {}, denied = false, loader = false } = {}) {
  let clients = 0, calls = 0, captured;
  const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...args) => { calls++; const value = await actual.safeAdminData(...args); if (args[0] === "kindergarten applications") captured = value; return value; } };
  const client = { from(table) {
    const index = tables.indexOf(table); assert.notEqual(index, -1); assert.ok(!chains.some(x => x[0] === table));
    const key = keys[index], kind = failures[key], steps = [], q = {}; chains.push([table, steps]);
    if (kind === "factory") throw Error("PRIVATE_FACTORY");
    for (const method of ["select", "in", "order", "limit"]) q[method] = (...a) => { steps.push([method, ...a]); return q; };
    q.then = (yes, no) => (kind === "reject" ? Promise.reject(Error("PRIVATE_REJECTION")) : Promise.resolve({ data: data[key], error: kind === "returned" ? { message: "PRIVATE_MESSAGE", details: "PRIVATE_DETAILS", hint: "PRIVATE_HINT" } : null })).then(yes, no);
    return q;
  } };
  const p = load(pageCode, id => {
    if (id === "react/jsx-runtime") return runtime;
    if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react") return { ClipboardCheck: "ClipboardCheck", CreditCard: "CreditCard", FileText: "FileText", ShieldCheck: "ShieldCheck" };
    if (id === "@/components/admin-app-ui") return { AdminAppFrame: "AdminAppFrame" };
    if (id === "@/components/admin-data-state") return { AdminDataError: "AdminDataError" };
    if (id === "@/components/kindergarten-application-admin-actions") return { KindergartenApplicationAdminActions: "KindergartenApplicationAdminActions" };
    if (id === "@/components/gan-batuach-design-system") return Object.fromEntries(["DashboardGrid", "EmptyState", "MetricCard", "PremiumCard", "SectionHeader", "StatusChip"].map(k => [k, k]));
    if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async roles => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); if (denied) throw Error("DENIED"); return { profile }; } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } };
    return unexpected(id);
  }, warnings);
  if (denied) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(clients, 1); assert.equal(calls, loader ? 1 : 8);
  assert.ok(!JSON.stringify([tree, warnings]).includes("PRIVATE_")); assert.ok(!JSON.stringify(tree).includes("SYNTHETIC_UNUSED_"));
  assert.equal(nodes(tree, "form").length, 0); assert.equal(nodes(tree, "button").length, 0);
  const r = { tree, text: text(tree), warnings, chains, data: captured.data, cards: nodes(tree, "MetricCard"), rows: nodes(tree, "article").filter(x => x.props.className === "card procedure-card"), decisions: nodes(tree, "KindergartenApplicationAdminActions"), frame: nodes(tree, "AdminAppFrame")[0], hero: nodes(tree, "StatusChip")[0], banner: nodes(tree, "AdminDataError")[0].props.message };
  assert.equal(r.frame.props.profile, profile); assert.equal(r.frame.props.activeHref, "/dashboard/admin/kindergarten-applications"); assert.equal(r.frame.props.title, "קליטת גנים ומעקב ניסיון"); assert.equal(r.frame.props.badge, "קליטה");
  for (let i = 0; !loader && i < keys.length; i++) {
    const expected = failures[keys[i]] === "factory" ? [] : [["select", selections[i]], ...(i === 0 ? [["in", "approval_flow_status", ["activation_in_progress", "onboarding_submitted", "pending_final_approval", "correction_required", "payment_pending", "active", "suspended", "archived"]], ["order", "created_at", { ascending: false }]] : i === 1 ? [["order", "updated_at", { ascending: false }]] : i === 2 ? [["order", "group_name"]] : []), ["limit", [250, 250, 1000, 1000, 1000, 1000, 500][i]]];
    assert.deepEqual(plain(chains[i]), [tables[i], expected]); assert.equal(r.data.available[keys[i]], !failures[keys[i]]);
  }
  assert.equal(chains.length, loader ? 0 : 7);
  return r;
}
const field = (r, prefix) => nodes(r.rows[0], "span").find(n => text(n).startsWith(prefix));
const panel = (r, title) => nodes(r.rows[0], "article").find(n => n.props.className === "card action-panel" && text(nodes(n, "h4")[0]).includes(title));
function unknownGardens(r) {
  assert.equal(r.rows.length, 0); assert.equal(r.decisions.length, 0); assert.equal(nodes(r.tree, "EmptyState").length, 0);
  assert.deepEqual(r.cards.map(x => x.props.value), ["לא זמין", "לא זמין", "לא זמין", "לא זמין"]);
  assert.deepEqual(r.cards.map(x => x.props.tone), ["muted", "muted", "muted", "muted"]); assert.equal(r.hero.props.tone, "muted"); assert.ok(r.banner);
  assert.ok(!/SYNTHETIC_(?:GARDEN|MANAGER|OWNER|NOTE|AGE|FEE)/.test(JSON.stringify(r.tree)));
}
function healthyRows(r, data) { assert.deepEqual(r.rows.map(n => n.key), data.gardens.map(n => n.id)); assert.deepEqual(plain(r.decisions.map(n => n.props)), data.gardens.map(n => ({ gardenId: n.id, status: plain(n.approval_flow_status) }))); }
function sourceUnknown(r, key) {
  assert.ok(r.banner); if (key === "gardens") return unknownGardens(r);
  assert.equal(r.rows.length, 1); assert.equal(r.decisions.length, 1); assert.deepEqual(r.cards.slice(0, 3).map(x => x.props.value), [0, 0, 1]);
  assert.ok(r.text.includes("SYNTHETIC_GARDEN")); assert.ok(r.text.includes("SYNTHETIC_NOTE"));
  if (key === "onboarding") { assert.equal(r.cards[3].props.value, "לא זמין"); assert.equal(r.cards[3].props.tone, "muted"); assert.equal(r.hero.props.tone, "muted"); assert.equal(text(field(r, "מחיר גן")), "מחיר גן בטוח לאחר ניסיון: לא זמין"); }
  else assert.equal(r.cards[3].props.value, "63%");
  if (key === "profiles") { assert.equal(text(field(r, "מנהלת:")), "מנהלת: לא זמין"); assert.equal(text(field(r, "חשבון")), "חשבון מנהלת: לא זמין"); assert.ok(!r.text.includes("SYNTHETIC_MANAGER")); assert.ok(!r.text.includes("SYNTHETIC_OWNER")); }
  if (key === "documents") assert.equal(text(field(r, "מסמכים")), "מסמכים: לא זמין");
  if (key === "subscriptions") { assert.equal(text(field(r, "מנוי:")), "מנוי: לא זמין"); assert.ok(text(field(r, "מחיר גן")).includes(currency(231))); }
  if (key === "ages") { assert.ok(text(panel(r, "קבוצות")).includes("נתוני קבוצות אינם זמינים")); assert.ok(!text(panel(r, "קבוצות")).includes("SYNTHETIC_FEE")); assert.ok(text(panel(r, "מחירים")).includes("SYNTHETIC_FEE")); }
  if (key === "fees") { assert.ok(text(panel(r, "קבוצות")).includes("SYNTHETIC_AGE")); assert.ok(text(panel(r, "מחירים")).includes("מחירי הורים אינם זמינים")); assert.ok(!r.text.includes("SYNTHETIC_FEE")); }
}
test("healthy actualpage/helper exact7chains/profile/static/action props", async () => { const d = fixtures(), r = await page({ data: d }); healthyRows(r, d); assert.equal(r.banner, null); assert.equal(r.warnings.length, 0); assert.deepEqual(r.cards.map(x => x.props.value), [0, 0, 1, "63%"]); assert.deepEqual(r.cards.map(x => x.props.tone), ["success", "success", "success", "warning"]); assert.ok(text(field(r, "מנהלת:")).includes("SYNTHETIC_MANAGER")); assert.ok(r.text.includes("זהו שכר לימוד הורה לגן, לא מנוי Gan Batuach.")); });
for (const key of keys) for (const mode of ["returned-stale", "returned-empty", "returned-null", "reject", "factory"]) test(`${key}/${mode} isolates source and suppresses failed stale values`, async () => { const d = fixtures(); if (mode === "returned-empty") d[key] = []; if (mode === "returned-null") d[key] = null; const kind = mode.startsWith("returned") ? "returned" : mode, r = await page({ data: d, failures: { [key]: kind } }); sourceUnknown(r, key); assert.equal(r.warnings.length, 1); assert.equal(r.warnings[0][0], kind === "returned" ? "Admin Supabase query unavailable:" : "Admin page data unavailable:"); });
test("outer client failure all unknown no queries/no stale actions", async () => unknownGardens(await page({ loader: true })));
test("denied admin admission before0helper/client/query", async () => page({ denied: true }));
for (const value of [[], null]) test(`healthy all ${value === null ? "null" : "empty"} is known zero/ordinaryempty`, async () => { const d = Object.fromEntries(keys.map(k => [k, value])), r = await page({ data: d }); assert.equal(r.banner, null); assert.deepEqual(r.cards.map(n => n.props.value), [0, 0, 0, "0%"]); assert.deepEqual(r.cards.map(n => n.props.tone), ["success", "success", "success", "danger"]); assert.equal(nodes(r.tree, "EmptyState").length, 1); assert.ok(Object.values(r.data.available).every(Boolean)); });
for (const [a, b] of [["documents", "profiles"], ["fees", "subscriptions"], ["onboarding", "ages"], ["gardens", "documents"]]) test(`paired ${a}+${b} retains independently healthy rows/availability`, async () => { const r = await page({ failures: { [a]: "returned", [b]: "reject" } }); assert.equal(r.warnings.length, 2); assert.deepEqual(keys.filter(k => !r.data.available[k]), [a, b].sort((x, y) => keys.indexOf(x) - keys.indexOf(y))); if (a === "gardens") unknownGardens(r); else { assert.equal(r.rows.length, 1); assert.equal(r.decisions.length, 1); assert.ok(r.text.includes("SYNTHETIC_NOTE")); } });
for (const [status, expected] of [["onboarding_submitted", [1, 0, 0]], ["pending_final_approval", [1, 0, 0]], ["payment_pending", [0, 1, 0]], ["active", [0, 0, 1]], ["ACTIVE", [0, 0, 0]], [null, [0, 0, 0]], [0, [0, 0, 0]], [{ toString: () => "onboarding_submitted" }, [1, 0, 0]], [{ toString: () => "active" }, [0, 0, 0]]]) test(`original String pending vs strict active/payment ${String(status)}/${typeof status}`, async () => { const d = fixtures(); d.gardens[0].approval_flow_status = status; const r = await page({ data: d }); assert.deepEqual(r.cards.slice(0, 3).map(n => n.props.value), expected); assert.equal(r.decisions[0].props.status, status); });
for (const amount of [0, "", 317]) test(`non-nullish onboarding amount ${JSON.stringify(amount)} independent of failed subscriptions`, async () => { const d = fixtures(); d.onboarding[0].subscription_monthly_amount = amount; const r = await page({ data: d, failures: { subscriptions: "returned" } }); assert.equal(text(field(r, "מחיר גן")), `מחיר גן בטוח לאחר ניסיון: ${currency(amount)}/חודש`); });
for (const amount of [null, undefined]) test(`nullish onboarding ${String(amount)} refuses unknown subscription fallback700`, async () => { const d = fixtures(); d.onboarding[0].subscription_monthly_amount = amount; const r = await page({ data: d, failures: { subscriptions: "reject" } }); assert.equal(text(field(r, "מחיר גן")), "מחיר גן בטוח לאחר ניסיון: לא זמין"); });
for (const [amount, expected] of [[0, 0], ["", ""], [null, 700], [419, 419]]) test(`known subscription fallback ${JSON.stringify(amount)} preserves nullish order`, async () => { const d = fixtures(); d.onboarding[0].subscription_monthly_amount = null; d.subscriptions[0].metadata.monthly_amount_nis = amount; const r = await page({ data: d }); assert.equal(text(field(r, "מחיר גן")), `מחיר גן בטוח לאחר ניסיון: ${currency(expected)}/חודש`); });
test("healthy missing onboarding/subscription uses original700 and known0progress", async () => { const d = fixtures(); d.onboarding = []; d.subscriptions = null; const r = await page({ data: d }); assert.equal(r.cards[3].props.value, "0%"); assert.ok(text(field(r, "מחיר גן")).includes(currency(700))); assert.equal(text(field(r, "מנוי:")), "מנוי: -"); });
test("known average keeps original Number/sum/divisor/Math.round", async () => { const d = fixtures(); d.gardens.push({ ...d.gardens[0], id: "SYNTHETIC_G1" }); d.onboarding[0].progress_percent = "65"; const r = await page({ data: d }); assert.equal(r.cards[3].props.value, "33%"); assert.equal(r.hero.props.tone, "primary"); });
test("age empty healthy fee fallback order/slice6/raw prices", async () => { const d = fixtures(); d.ages = []; d.fees = Array.from({ length: 8 }, (_, i) => ({ ...d.fees[0], id: `SYNTHETIC_F${i}`, group_name: `SYNTHETIC_GROUP_${i}`, capacity: 0, monthly_fee: 0 })); const r = await page({ data: d }); const ps = nodes(panel(r, "קבוצות"), "p"); assert.equal(ps.length, 6); assert.deepEqual(ps.map(n => n.key), d.fees.slice(0, 6).map(n => `${n.group_name}-${n.id}`)); assert.ok(text(ps[0]).includes(`קיבולת 0 · ${currency(0)}`)); });
test("healthy empty ages with unknown fees is unknown not missingsetup", async () => { const d = fixtures(); d.ages = []; const r = await page({ data: d, failures: { fees: "returned" } }); assert.ok(text(panel(r, "קבוצות")).includes("אינם זמינים")); assert.ok(!r.text.includes("טרם הוגדרו קבוצות")); });
test("healthy empty groups retains ordinary setup/parentprice messages", async () => { const d = fixtures(); d.ages = []; d.fees = []; const r = await page({ data: d }); assert.ok(r.text.includes("טרם הוגדרו קבוצות.")); assert.ok(r.text.includes("אין מחירים שפורסמו להורים.")); });
test("age-first source order and nullish fields even fee failure", async () => { const d = fixtures(); d.ages = Array.from({ length: 8 }, (_, i) => ({ garden_id: "SYNTHETIC_G0", age_group: `SYNTHETIC_AGE_${i}`, children_count: 0, monthly_child_price: "", capacity: 99, monthly_fee: 777 })); const r = await page({ data: d, failures: { fees: "reject" } }); const ps = nodes(panel(r, "קבוצות"), "p"); assert.equal(ps.length, 6); assert.equal(ps[0].key, "SYNTHETIC_AGE_0-"); assert.ok(text(ps[0]).includes(`קיבולת 0 · ${currency("")}`)); });
test("known parent-price filter preserves truthiness/order not literaltrue", async () => { const d = fixtures(); d.fees = [0, 1, "yes", false].map((v, i) => ({ ...d.fees[0], id: `SYNTHETIC_F${i}`, group_name: `SYNTHETIC_PRICE_${i}`, show_price_public: v, active: v })); const r = await page({ data: d }); const ps = nodes(panel(r, "מחירים"), "p"); assert.deepEqual(ps.map(n => n.key), ["SYNTHETIC_F1", "SYNTHETIC_F2"]); });
test("Map last-wins onboarding/profiles/subscriptions and ordered documents", async () => { const d = fixtures(); d.onboarding.push({ ...d.onboarding[0], progress_percent: 91, subscription_monthly_amount: null }); d.profiles.push({ ...d.profiles[0], full_name: "SYNTHETIC_LAST_MANAGER", active: 0 }); d.subscriptions.push({ ...d.subscriptions[0], status: "suspended", metadata: { monthly_amount_nis: 527 } }); d.documents.push({ ...d.documents[0], id: "SYNTHETIC_D1" }); const r = await page({ data: d }); assert.equal(r.cards[3].props.value, "91%"); assert.ok(text(field(r, "מנהלת:")).includes("SYNTHETIC_LAST_MANAGER")); assert.equal(text(field(r, "חשבון")), "חשבון מנהלת: דורש טיפול"); assert.equal(text(field(r, "מסמכים")), "מסמכים: 2"); assert.equal(text(field(r, "מנוי:")), "מנוי: מושהה"); assert.ok(text(field(r, "מחיר גן")).includes(currency(527))); assert.deepEqual(plain(r.data.rows[0].documents.map(x => x.id)), ["SYNTHETIC_D0", "SYNTHETIC_D1"]); });
for (const raw of [0, ""]) test(`raw nullish manager/garden values ${JSON.stringify(raw)} unchanged`, async () => { const d = fixtures(); Object.assign(d.gardens[0], { id: raw, name: raw, city: raw, address: raw, manager_id: raw }); d.profiles = [{ id: raw, full_name: raw, active: "truthy" }]; const r = await page({ data: d }); assert.equal(r.rows[0].key, raw); assert.equal(nodes(r.rows[0], "h3")[0].props.children, raw); assert.equal(text(field(r, "מנהלת:")), `מנהלת: ${raw}`); assert.equal(text(field(r, "חשבון")), "חשבון מנהלת: פעיל"); assert.equal(r.decisions[0].props.gardenId, raw); });
test("no local clamp/dedup/sort of healthy gardens", async () => { const d = fixtures(); d.gardens = Array.from({ length: 253 }, (_, i) => ({ ...d.gardens[0], id: `SYNTHETIC_G${252 - i}` })); const r = await page({ data: d }); healthyRows(r, d); assert.equal(r.cards[2].props.value, 253); });
test("exact one DOMAIN hook", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), name = "admin-kindergarten-applications-query-boundary"; assert.deepEqual(c.domain.filter(x => x.name === name), [{ name, args: ["--test", "scripts/qa/check-admin-kindergarten-applications-query-boundary.mjs"] }]); assert.equal(c.security.filter(x => x.name === name).length, 0); });
