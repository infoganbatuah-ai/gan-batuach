import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Readonly actual page/shared helper; every identity and row below is synthetic.
// This is presentation proof, not PostgreSQL, MFA, session or physical-device proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const full = path.join(root, p); const stat = fs.statSync(full); assert.equal(Boolean(stat.flags & 0x40000000), false); return fs.readFileSync(full, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/identity-security/page.tsx")) + "\nexports.qaFormatters={percent,scoreTone,severityTone};";
const helperCode = compile(source("lib/admin-safe.ts"));
const statCardCode = compile(source("components/stat-card.tsx"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const ordered = (field, ascending) => ascending === undefined ? ["order", field] : ["order", field, { ascending }];
const roles = ["admin", "owner", "manager", "inspector", "staff", "parent", "network_manager"];
const inventory = [
 ["profiles", "profiles", [["in", "role", ["admin", "owner", "manager", "parent", "staff", "inspector", "network_manager"]]], 5000],
 ["mfa_enrollment_status", "mfa", [ordered("role")], 5000],
 ["mfa_enforcement_policies", "policies", [ordered("role_key")], 100],
 ["trusted_devices", "devices", [ordered("last_seen_at", false)], 500],
 ["security_sessions", "sessions", [ordered("last_seen_at", false)], 500],
 ["account_security_locks", "locks", [ordered("locked_at", false)], 200],
 ["identity_recovery_requests", "recovery", [ordered("created_at", false)], 200],
 ["security_events", "securityEvents", [ordered("created_at", false)], 300],
 ["sensitive_action_mfa_rules", "actionRules", [ordered("action_category")], 120]
];
const expected = inventory.map(([table, , calls, limit], i) => [table, [["select", i === 0 ? "id,full_name,email,phone,role,garden_id,created_at" : "*"], ...calls, ["limit", limit]]]);
const fixtures = [
 [{ id: "SYNTHETIC_PROFILE_1", role: "admin" }, { id: "SYNTHETIC_PROFILE_2", role: "parent" }, { id: "SYNTHETIC_PROFILE_3", role: "parent" }],
 [{ role: "admin", enrollment_status: "enrolled", mfa_required: true }, { role: "parent", enrollment_status: "pending", enforcement_status: "required" }, { role: "parent", enrollment_status: "pending", enforcement_status: "grace_period" }],
 [{ id: "SYNTHETIC_POLICY", role_key: "admin", enforcement_status: "grace_period", grace_period_days: 4, required_for_sensitive_actions: true }],
 [{ id: "SYNTHETIC_DEVICE", risk_status: "suspicious", trust_status: "trusted" }, { id: "SYNTHETIC_DEVICE_2", trust_status: "trusted" }],
 [{ id: "SYNTHETIC_SESSION", risk_level: "high", revoked_at: null }, { id: "SYNTHETIC_SESSION_2", risk_level: "low", revoked_at: "SYNTHETIC_REVOKED" }],
 [{ id: "SYNTHETIC_LOCK", lock_status: "active" }],
 [{ id: "SYNTHETIC_RECOVERY" }, { id: "SYNTHETIC_RECOVERY_2" }],
 [{ id: "SYNTHETIC_EVENT", event_type: "failed_login", severity: "high", status: "open", created_at: "2026-11-05T00:00:00Z" }],
 [{ id: "SYNTHETIC_RULE", action_key: "synthetic-action", title_he: "SYNTHETIC_ACTION", enforcement_status: "required", fresh_challenge_minutes: 3, required_roles: ["admin", "owner"] }]
];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
 let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
 const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
 const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); if (failures[i]?.kind === "factory") throw Error("PRIVATE_FACTORY"); for (const m of ["select", "order", "in", "limit"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { assert.equal(chains.length, 9, "one concurrent batch"); const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
 const p = load(pageCode, (id) => {
  if (id === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, k) => String(k) });
  if (id === "@/lib/admin-safe") return helper;
  if (id === "@/lib/auth") return { requireRole: async (r) => { assert.deepEqual(Array.from(r), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
  if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } }; return unexpected(id);
 }, warnings);
 if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
 const tree = await p.default(); assert.equal(nodes(tree, "form").length, 0);
 const hero = nodes(tree, "div").find((n) => n.props.className === "profile-actions");
 return { tree, text: text(tree), clients, chains, warnings, data: captured.data, formatters: p.qaFormatters, banner: nodes(tree, "AdminDataError")[0].props.message, pills: nodes(hero, "span").map((n) => ({ text: text(n), className: n.props.className })), metrics: nodes(tree, "StatCard").map((n) => n.props) };
}
const panel = (r, title) => nodes(r.tree, "article").find((n) => text(nodes(n, "h2")[0]).trim() === title);
const keys = (n) => nodes(n).filter((v) => v.key != null).map((v) => v.key);
const rows = (r, title) => nodes(panel(r, title), "div").filter((n) => n.props.className === "mini-row");
const recovery = (r) => nodes(r.tree, "article").filter((n) => n.props.className === "card compact-card");
function contracts(r, factory) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected.map(([t, calls], i) => [t, i === factory ? [] : calls])); assert.ok(!JSON.stringify([r.tree, r.warnings]).includes("PRIVATE_")); assert.ok(!String(r.banner).includes("155")); assert.ok(!String(r.banner).includes("מיגרציה")); }
function qualifiers(r) { for (const s of ["כוונת מדיניות", "מטא־נתונים ודרישות בלבד", "אינה הוכחה לאכיפת MFA", "להפעלת שחזור והתראות", "דרישה: נעילה זמנית", "דרישה: פעולות שחזור", "כוונת תבניות הודעה"]) assert.ok(r.text.includes(s), s); }
function dependencies(r, failed = []) {
 const known = (...set) => set.every((i) => !failed.includes(i)), hero = known(0, 1, 2, 3, 5, 7);
 assert.deepEqual(Array.from(r.data.available), inventory.map((_, i) => known(i)));
 // 33% enrollment +45 devices+55 locks+60 events+85 policies => round(278/5)=56.
 assert.deepEqual(r.pills[0], { text: hero ? "56/100" : "לא זמין", className: hero ? "pill warn" : "pill default" });
 const deps = [[0, 1], [1], [3], [3], [4], [4], [7], [5]];
 const values = ["33%", 2, 2, 1, 1, 1, 1, 1], tones = ["bad", "warn", "good", "bad", "good", "bad", "warn", "bad"];
 assert.deepEqual(r.metrics.map((m) => m.value), values.map((v, i) => known(...deps[i]) ? v : "לא זמין"));
 assert.deepEqual(r.metrics.map((m) => m.tone), tones.map((v, i) => known(...deps[i]) ? v : "default"));
 const roleRows = rows(r, "Users Without MFA"); assert.deepEqual(roleRows.map((n) => n.key), roles);
 roleRows.forEach((n, i) => { const enrolled = i === 0 ? 1 : 0, profiles = i === 0 ? 1 : i === 5 ? 2 : 0; assert.equal(text(nodes(n, "strong")[0]), known(0, 1) ? `${i === 0 ? 100 : 0}%` : "לא זמין"); assert.equal(text(nodes(n, "small")[0]), `${known(1) ? enrolled : "לא זמין"}/${known(0) ? profiles : "לא זמין"} enrolled`); if (!known(0, 1)) assert.equal(nodes(n, "strong")[0].props.className, "pill default"); });
 for (const [i, title, originalKeys] of [[2, "MFA Rollout", ["SYNTHETIC_POLICY"]], [8, "Sensitive Action Gates", ["SYNTHETIC_RULE"]], [7, "Security Events", ["SYNTHETIC_EVENT"]]]) { assert.deepEqual(keys(panel(r, title)), known(i) ? originalKeys : []); if (!known(i)) assert.ok(text(panel(r, title)).includes("לא זמין")); }
 assert.deepEqual(nodes(panel(r, "Trusted Devices"), "b").map(text), known(3) ? ["0", "1", "0"] : ["לא זמין", "לא זמין", "לא זמין"]);
 const c = recovery(r); assert.equal(text(nodes(c[0], "h3")[0]), `${known(5) ? 1 : "לא זמין"} חשבונות נעולים`); assert.equal(nodes(c[0], "span")[0].props.className, known(5) ? "pill bad" : "pill default"); assert.equal(text(nodes(c[1], "h3")[0]), `${known(6) ? 2 : "לא זמין"} בקשות שחזור`); if (!known(6)) assert.equal(nodes(c[1], "span")[0].props.className, "pill default");
 for (const i of failed) assert.deepEqual(Array.from(r.data[inventory[i][1]]), []); qualifiers(r);
}
test("healthy actualpage/sharedhelper exact9queries original56formula and requirements qualifier", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let i = 0; i < 9; i++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${i} ${kind}/${stale ? "stale" : "empty"} independent unknown`, async () => { const r = await page({ failures: { [i]: { kind, stale } } }); contracts(r); dependencies(r, [i]); assert.ok(r.banner); assert.deepEqual(plain(r.warnings), [["Admin Supabase query unavailable:", `identity security query ${i}`]]); });
for (let i = 0; i < 9; i++) test(`source${i} factorythrow contained`, async () => { const r = await page({ failures: { [i]: { kind: "factory" } } }); contracts(r, i); dependencies(r, [i]); assert.ok(r.banner); });
for (const failed of [[0, 1], [1, 2], [3, 4], [5, 6], [6, 8], [0, 7], [2, 8], [4, 6, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8]]) test(`paired${failed} preserves exact dependency boundaries`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(r); dependencies(r, failed); });
test("loader unknown notempty61 and private errors redacted; denied admin zero clients", async () => { const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, inventory.map((_, i) => i)); assert.ok(r.banner); assert.ok(!JSON.stringify([r.tree, r.warnings]).includes("PRIVATE_")); await page({ deny: true }); });
for (const nullData of [false, true]) test(`healthy${nullData ? "null" : "empty"} original61/zero defaults onlymetadata`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.equal(r.pills[0].text, "61/100"); assert.deepEqual(r.metrics.map((m) => m.value), ["0%", 0, 0, 0, 0, 0, 0, 0]); assert.equal(r.metrics[1].tone, "good"); assert.deepEqual(keys(panel(r, "MFA Rollout")), []); assert.ok(recovery(r).map(text)[0].includes("0 חשבונות נעולים")); qualifiers(r); });
test("strict enrolled/required and Stringenforcement; missing independent ofprofiles", async () => { const data = structuredClone(fixtures); data[0] = []; data[1] = [{ role: "admin", enrollment_status: { toString: () => "enrolled" }, mfa_required: "true" }, { role: "admin", enrollment_status: "ENROLLED", enforcement_status: { toString: () => "enforced" } }, { role: "parent", enrollment_status: "pending", mfa_required: true }, { role: "parent", enrollment_status: "enrolled", enforcement_status: "grace_period" }]; const r = await page({ data }); assert.equal(r.metrics[0].value, "33%"); assert.equal(r.metrics[1].value, 2); assert.equal(r.pills[0].text, "56/100"); const f = await page({ data, failures: { 0: { kind: "reject" } } }); assert.equal(f.metrics[0].value, "לא זמין"); assert.equal(f.metrics[1].value, 2); });
test("duplicate optional enrolled may exceed100; no dedup clamp or denominator change", async () => { const data = structuredClone(fixtures); data[0] = [{ id: "SYNTHETIC_ONE", role: "admin" }]; data[1] = Array.from({ length: 3 }, () => ({ role: "admin", enrollment_status: "enrolled" })); const r = await page({ data }); assert.equal(r.metrics[0].value, "300%"); assert.equal(r.metrics[1].value, 0); assert.equal(r.pills[0].text, "109/100"); assert.equal(text(nodes(rows(r, "Users Without MFA")[0], "strong")[0]), "100%"); });
test("role STRICT matching and role denominator maxprofiles rows, notrequired or join", async () => { const data = structuredClone(fixtures); data[0] = [{ role: "admin" }, { role: { toString: () => "admin" } }, { role: "ADMIN" }]; data[1] = [{ role: "admin", enrollment_status: "enrolled" }, { role: "admin", enrollment_status: "pending" }, { role: { toString: () => "admin" }, enrollment_status: "enrolled" }]; const r = await page({ data }); const admin = rows(r, "Users Without MFA")[0]; assert.equal(text(nodes(admin, "strong")[0]), "50%"); assert.equal(text(nodes(admin, "small")[0]), "1/1 enrolled"); assert.deepEqual(keys(panel(r, "Users Without MFA")), roles); });
test("device nullish fallback is NOT truthy fallback, String conversion and breakdown retained", async () => { const data = structuredClone(fixtures); data[3] = [{ risk_status: "", trust_status: "suspicious" }, { risk_status: null, trust_status: "blocked" }, { risk_status: { toString: () => "suspicious" }, trust_status: "new" }, { trust_status: "new" }, { trust_status: "trusted" }, { risk_status: "revoked", trust_status: "trusted" }, { risk_status: "NEW" }]; const r = await page({ data }); assert.equal(r.metrics[2].value, 7); assert.equal(r.metrics[3].value, 2); assert.deepEqual(nodes(panel(r, "Trusted Devices"), "b").map(text), ["1", "1", "1"]); });
test("locks STRICT active and events String membership/case preserved", async () => { const data = structuredClone(fixtures); data[5] = [{ lock_status: "ACTIVE" }, { lock_status: { toString: () => "active" } }, { lock_status: "active" }]; data[7] = ["failed_login", "mfa_failed", "mfa_challenge_failure", "FAILED_LOGIN", "other"].map((v, i) => ({ id: `SYNTHETIC_${i}`, event_type: { toString: () => v } })); const r = await page({ data }); assert.equal(r.metrics[7].value, 1); assert.equal(r.metrics[6].value, 3); });
test("sessions original TRUTHY reauth and FALSY revoked_at retained; no hero input", async () => { const data = structuredClone(fixtures); data[4] = [{ risk_level: "low", sensitive_action_reauth_required: "false", revoked_at: "" }, { risk_level: { toString: () => "critical" }, revoked_at: 0 }, { risk_level: "HIGH", sensitive_action_reauth_required: 0, revoked_at: false }, { risk_level: "low", sensitive_action_reauth_required: [], revoked_at: "SYNTHETIC_REVOKED" }, { risk_level: "low", revoked_at: null }]; const r = await page({ data }); assert.equal(r.metrics[4].value, 4); assert.equal(r.metrics[5].value, 3); assert.equal(r.pills[0].text, "56/100"); });
test("policy ALLrows order keynullish statuses grace and truthyflags preserved", async () => { const data = structuredClone(fixtures); data[2] = Array.from({ length: 13 }, (_, i) => ({ id: i === 0 ? "" : i === 1 ? null : `SYNTHETIC_POLICY_${i}`, role_key: `SYNTHETIC_ROLE_${i}`, enforcement_status: i === 0 ? "active" : "partial", grace_period_days: i, required_for_sensitive_actions: i % 2 ? "false" : false })); const r = await page({ data }); assert.deepEqual(keys(panel(r, "MFA Rollout")), data[2].map((v) => v.id ?? v.role_key)); assert.equal(rows(r, "MFA Rollout").length, 13); assert.ok(text(rows(r, "MFA Rollout")[1]).includes("1 ימי חסד · פעולות רגישות")); assert.equal(nodes(rows(r, "MFA Rollout")[0], "strong")[0].props.className, "pill bad"); });
test("actionrules ALLrows keynullish freshness and requiredroles join preserved", async () => { const data = structuredClone(fixtures); data[8] = Array.from({ length: 13 }, (_, i) => ({ id: i === 0 ? "" : null, action_key: `SYNTHETIC_ACTION_${i}`, title_he: `SYNTHETIC_TITLE_${i}`, enforcement_status: "new", fresh_challenge_minutes: i, required_roles: i === 0 ? null : ["admin", "parent"] })); const r = await page({ data }); assert.deepEqual(keys(panel(r, "Sensitive Action Gates")), data[8].map((v) => v.id ?? v.action_key)); assert.ok(text(rows(r, "Sensitive Action Gates")[1]).includes("1 דקות · admin, parent")); assert.ok(!text(rows(r, "Sensitive Action Gates")[0]).includes("null")); assert.equal(r.pills[0].text, "56/100"); });
test("events FIRST10 original order keys status dates and severity, no resort", async () => { const data = structuredClone(fixtures); data[7] = Array.from({ length: 13 }, (_, i) => ({ id: `SYNTHETIC_EVENT_${i}`, event_type: i === 0 ? "failed_login" : `synthetic-${i}`, severity: i === 0 ? "critical" : "medium", status: `SYNTHETIC_STATUS_${i}`, created_at: i === 0 ? "2026-11-05T00:00:00Z" : "" })); const r = await page({ data }); assert.deepEqual(keys(panel(r, "Security Events")), data[7].slice(0, 10).map((v) => v.id)); assert.ok(!text(panel(r, "Security Events")).includes("SYNTHETIC_EVENT_10")); assert.ok(text(rows(r, "Security Events")[0]).includes(new Date("2026-11-05T00:00:00Z").toLocaleString("he-IL"))); assert.equal(nodes(rows(r, "Security Events")[1], "strong")[0].props.className, "pill warn"); });
test("score term dependencies exactlysix; empty policy and no flags original arithmetic", async () => { const data = structuredClone(fixtures); data[2] = []; data[3] = []; data[5] = []; data[7] = []; const r = await page({ data }); assert.equal(r.pills[0].text, "68/100"); for (const i of [4, 6, 8]) { const f = await page({ data, failures: { [i]: { kind: "reject" } } }); assert.equal(f.pills[0].text, "68/100"); } });
test("actual unchanged StatCard defaultunknown neverpositive תקין, knownzero originalgood", async () => { const r = await page({ failures: Object.fromEntries(inventory.map((_, i) => [i, { kind: "reject" }])) }), actual = load(statCardCode, (id) => { if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "next/link") return { __esModule: true, default: "Link" }; return unexpected(id); }); for (const m of r.metrics) { const rendered = actual.StatCard(m); assert.equal(rendered.props.className, "card stat stat-default"); assert.ok(!text(rendered).includes("תקין")); assert.ok(text(rendered).includes("לא זמין")); } assert.ok(text(actual.StatCard({ label: "Synthetic known empty", value: 0, tone: "good" })).includes("תקין")); });
test("original helpers thresholds strict severity percentzero/rounding/unclamped and ONEhook", async () => { const r = await page(), f = r.formatters; assert.equal(f.percent(1, 3), 33); assert.equal(f.percent(3, 1), 300); assert.equal(f.percent(3, 0), 0); for (const [n, tone] of [[0, "bad"], [54.99, "bad"], [55, "warn"], [79.99, "warn"], [80, "good"]]) assert.equal(f.scoreTone(n), tone); for (const s of ["critical", "high", "active", "blocked", "suspicious"]) assert.equal(f.severityTone(s), "bad"); for (const s of ["medium", "new", "partial", "grace_period"]) assert.equal(f.severityTone(s), "warn"); for (const s of [null, "HIGH", { toString: () => "high" }, "unknown"]) assert.equal(f.severityTone(s), "good"); const hooks = JSON.parse(source("config/digital-observer-ci-gates.json")).domain.filter((v) => v.name === "identity-security-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-identity-security-query-boundary.mjs"]); });
