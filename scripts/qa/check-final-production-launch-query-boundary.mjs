import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/shared helper, synthetic read-only clients/JSX. No live release proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
const source = (p) => fs.readFileSync(path.join(root, p), "utf8");
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/final-production-launch/page.tsx")) + "\nexports.qaFormatters={label,scoreTone,statusTone,countOpen};";
const helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-04T12:00:00.000Z"])); } static now() { return new Date("2026-11-04T12:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const ordered = (field, ascending) => ascending === undefined ? ["order", field] : ["order", field, { ascending }];
const expected = [
 ["final_production_readiness_scores", [["select", "*"], ordered("calculated_at", false), ["limit", 1]]],
 ["final_launch_status", [["select", "*"], ordered("product_type"), ["limit", 10]]],
 ["final_launch_checklists", [["select", "*"], ordered("product_type"), ordered("checklist_area"), ["limit", 80]]],
 ["final_launch_blockers", [["select", "*"], ordered("severity"), ordered("created_at", false), ["limit", 80]]],
 ["final_production_risks", [["select", "*"], ordered("severity"), ordered("created_at", false), ["limit", 80]]],
 ["final_go_live_decisions", [["select", "*"], ordered("audited_at", false), ["limit", 10]]],
 ["external_validation_scores", [["select", "*"], ordered("calculated_at", false), ["limit", 1]]],
 ["provider_production_readiness_scores", [["select", "*"], ordered("calculated_at", false), ["limit", 1]]],
 ["mobile_release_readiness_scores", [["select", "*"], ordered("calculated_at", false), ["limit", 1]]]
];
const labels = ["final production readiness scores", "final launch status", "final launch checklists", "final launch blockers", "final production risks", "final go live decisions", "external validation scores", "provider production readiness scores", "mobile release readiness scores"];
const fixtures = [
 [{ company_readiness_score: 90, gan_batuach_score: 82, digital_observer_score: 62, launch_recommendation: "SYNTHETIC_RECOMMENDATION", external_validation_score: 31, provider_activation_score: 42, mobile_readiness_score: 53 }],
 [{ id: "gan", product_type: "gan_batuach", status: "ready", readiness_score: 82, notes: "SYNTHETIC_GAN" }, { id: "observer", product_type: "digital_observer", status: "commercial_ready", readiness_score: 62, notes: "SYNTHETIC_OBSERVER" }],
 [{ id: "check", status: "ready", product_type: "gan_batuach", checklist_area: "security", checklist_item: "SYNTHETIC_CHECKLIST", evidence_reference: "SYNTHETIC_EVIDENCE", critical: true }],
 [{ id: "block", severity: "critical", status: "open", title: "SYNTHETIC_BLOCKER", launch_impact: "SYNTHETIC_IMPACT" }],
 [{ id: "risk", severity: "high", status: "open", category: "security", risk: "SYNTHETIC_RISK", mitigation: "SYNTHETIC_MITIGATION" }],
 [{ id: "decision", decision: "do_not_launch", approver_name: "SYNTHETIC_APPROVER", decision_reason: "SYNTHETIC_REASON", blockers_reviewed: true, accepted_risks_reviewed: true }],
 [{ external_validation_score: 80 }], [{ activation_readiness_score: 81 }], [{ overall_readiness: 82 }]
];
const displayNames = ["Final Product Status", "Final Launch Checklist", "Launch Blockers", "Final Risk Register", "Go / No-Go Decision"];
const sectionSource = [1, 2, 3, 4, 5];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
 let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
 const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
 const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "order", "limit"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { assert.equal(chains.length, 9, "one concurrent batch"); const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
 const p = load(pageCode, (id) => {
  if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "next/link") return { __esModule: true, default: "Link" };
  if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, k) => String(k) });
  if (id === "@/lib/admin-safe") return helper;
  if (id === "@/lib/auth") return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
  if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } }; return unexpected(id);
 }, warnings);
 if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
 const tree = await p.default(); assert.equal(nodes(tree, "form").length, 0);
 return { tree, text: text(tree), clients, chains, warnings, data: captured.data, formatters: p.qaFormatters, banner: nodes(tree, "AdminDataError")[0].props.message, hero: nodes(tree, "PremiumDashboardHero")[0].props, metrics: nodes(tree, "RoleMetricCard").map((n) => n.props) };
}
const section = (r, title) => nodes(r.tree, "CleanSection").find((n) => n.props.title === title);
const states = (r) => nodes(r.tree, "EmptyState").map((n) => n.props);
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!JSON.stringify([r.tree, r.warnings]).includes("PRIVATE")); assert.ok(!String(r.banner).includes("מיגרציה")); }
function qualifiers(r) { assert.ok(r.hero.subtitle.includes("רשומות שמורות בלבד")); assert.ok(r.hero.subtitle.includes("אישור בעלים מפורש")); assert.ok(section(r, "Go / No-Go Decision").props.subtitle.includes("לא הרשאת השקה")); for (const note of ["No automatic public launch", "No unsupported certification claims", "No live billing without provider approval", "Monthly releases after Phase 190"]) assert.ok(r.text.includes(note)); assert.ok(!r.hero.subtitle.includes("מוכנים לתפעול שוטף")); }
function dependencies(r, failed = []) {
 const known = (i) => !failed.includes(i);
 assert.deepEqual(Array.from(r.data.availability), labels.map((_, i) => known(i)));
 assert.deepEqual(r.metrics.map((m) => m.value), [known(0) ? "90/100" : "לא זמין", known(0) ? "82/100" : "לא זמין", known(0) ? "62/100" : "לא זמין", known(6) ? "80/100" : "לא זמין", known(7) ? "81/100" : "לא זמין", known(8) ? "82/100" : "לא זמין", known(3) ? 1 : "לא זמין", known(4) ? 1 : "לא זמין"]);
 assert.deepEqual(r.metrics.map((m) => m.tone), [known(0) ? "good" : "default", known(0) ? "good" : "default", known(0) ? "warn" : "default", known(6) ? "warn" : "default", known(7) ? "warn" : "default", known(8) ? "good" : "default", known(3) ? "bad" : "default", known(4) ? "warn" : "default"]);
 assert.equal(r.hero.badge, known(0) ? "90/100" : "לא זמין"); assert.equal(r.hero.badgeTone, known(0) ? "good" : "default");
 assert.equal(r.metrics[0].hint, known(0) ? "SYNTHETIC RECOMMENDATION" : "לא זמין"); assert.equal(r.metrics[1].hint, known(1) ? "ready" : "לא זמין"); assert.equal(r.metrics[2].hint, known(1) ? "commercial ready" : "לא זמין"); assert.equal(r.metrics[6].hint, known(3) ? "1 open blockers" : "לא זמין");
 for (let i = 0; i < displayNames.length; i++) { const index = sectionSource[i], s = section(r, displayNames[i]); assert.equal(nodes(s, "EmptyState").length, known(index) ? 0 : 1); for (const row of fixtures[index]) if (index !== 5) assert.equal(nodes(s).some((n) => n.key === row.id), known(index)); }
 assert.equal(r.text.includes("SYNTHETIC_APPROVER"), known(5)); assert.equal(r.text.includes("SYNTHETIC_REASON"), known(5));
 assert.equal(section(r, "Final Launch Checklist").props.subtitle.includes("1/1"), known(2)); qualifiers(r);
}
test("healthy actualpage/sharedhelper nine exact parallel bounded read queries", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let i = 0; i < 9; i++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${i} ${kind}/${stale ? "stale" : "empty"} remains unknown only locally`, async () => { const r = await page({ failures: { [i]: { kind, stale } } }); contracts(r); dependencies(r, [i]); assert.ok(r.banner); assert.deepEqual(plain(r.warnings), [["Admin Supabase query unavailable:", labels[i]]]); });
for (const failed of [[0, 1], [0, 6], [0, 7], [0, 8], [2, 5], [3, 4], [6, 7, 8]]) test(`paired failures ${failed} retain healthy neighbors`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i) => [i, { kind: "returned", stale: true }])) }); contracts(r); dependencies(r, failed); });
for (const [index, field, metric, fallback] of [[6, "external_validation_score", 3, 31], [7, "activation_readiness_score", 4, 42], [8, "overall_readiness", 5, 53]]) {
 for (const value of [0, "0", 17, 82, null, undefined]) for (const failedShared of [false, true]) test(`primary${index} ${value} shared${failedShared ? "failed" : "healthy"} exact nullish fallback`, async () => {
  const data = structuredClone(fixtures); data[index] = [{ [field]: value }];
  const r = await page({ data, failures: failedShared ? { 0: { kind: "reject" } } : {} });
  const known = value != null || !failedShared, score = Number(value ?? fallback);
  assert.equal(r.metrics[metric].value, known ? `${score}/100` : "לא זמין"); assert.equal(r.metrics[metric].tone, known ? r.formatters.scoreTone(score) : "default");
 });
 for (const primary of [[], [{}], [{ [field]: null }]]) test(`primary${index} healthy empty/nullish fallback versus missing shared`, async () => { const data = structuredClone(fixtures); data[index] = primary; const healthy = await page({ data }); assert.equal(healthy.metrics[metric].value, `${fallback}/100`); const unknown = await page({ data, failures: { 0: { kind: "returned", stale: true } } }); assert.equal(unknown.metrics[metric].value, "לא זמין"); const failedPrimary = await page({ data, failures: { [index]: { kind: "returned", stale: true } } }); assert.equal(failedPrimary.metrics[metric].value, "לא זמין"); });
}
for (const value of [0, "0", 73]) test(`external secondary readiness ${value} precedes shared fallback even on shared failure`, async () => { const data = structuredClone(fixtures); data[6] = [{ external_validation_score: null, readiness_score: value }]; for (const failures of [{}, { 0: { kind: "reject" } }]) { const r = await page({ data, failures }); assert.equal(r.metrics[3].value, `${Number(value)}/100`); } });
test("external primary zero precedes secondary and fallback", async () => { const data = structuredClone(fixtures); data[6] = [{ external_validation_score: 0, readiness_score: 99 }]; assert.equal((await page({ data })).metrics[3].value, "0/100"); });
for (const value of [0, "0", null, 61, 62, 81, 82, 101, -1]) test(`stored aggregate${value} Number/nullish and original82/62 thresholds no recomputation`, async () => { const data = structuredClone(fixtures); data[0] = [{ company_readiness_score: value, gan_batuach_score: value, digital_observer_score: value }]; const r = await page({ data }); const score = Number(value ?? 0), tone = score >= 82 ? "good" : score >= 62 ? "warn" : "bad"; for (let i = 0; i < 3; i++) { assert.equal(r.metrics[i].value, `${score}/100`); assert.equal(r.metrics[i].tone, tone); } assert.equal(r.hero.badge, `${score}/100`); });
test("distinct blocker critical/countOpen and risk exclusion sets retained including mitigated and verified", async () => {
 const data = structuredClone(fixtures), statuses = ["verified", "closed", "accepted_risk", "mitigated", "open", "unknown"];
 data[3] = statuses.map((status, i) => ({ id: `b${i}`, severity: "critical", status, title: status })); data[3].push({ id: "low", severity: "low", status: "open" });
 data[4] = statuses.map((status, i) => ({ id: `r${i}`, severity: i % 2 ? "high" : "critical", status })); data[4].push({ id: "risklow", severity: "low", status: "open" });
 const r = await page({ data }); assert.equal(r.metrics[6].value, 3); assert.equal(r.metrics[6].hint, "3 open blockers"); assert.equal(r.metrics[7].value, 3);
 assert.deepEqual(nodes(section(r, "Launch Blockers")).filter((n) => n.key != null).map((n) => n.key), data[3].map((v) => v.id)); assert.deepEqual(nodes(section(r, "Final Risk Register")).filter((n) => n.key != null).map((n) => n.key), data[4].map((v) => v.id));
});
test("checklist exact ready/approved/not_required set count and all returned rows retain order", async () => { const data = structuredClone(fixtures); data[2] = ["ready", "approved", "not_required", "blocked", "verified"].map((status, i) => ({ id: `c${i}`, status })); const r = await page({ data }); assert.ok(section(r, "Final Launch Checklist").props.subtitle.includes("3/5")); assert.deepEqual(nodes(section(r, "Final Launch Checklist")).filter((n) => n.key != null).map((n) => n.key), data[2].map((v) => v.id)); const f = await page({ data, failures: { 2: { kind: "returned", stale: true } } }); assert.ok(!section(f, "Final Launch Checklist").props.subtitle.includes("/")); });
test("first decision only no latest recomputation; stored review flags never present on source failure", async () => { const data = structuredClone(fixtures); data[5].push({ decision: "approved_for_launch", approver_name: "NOT_FIRST", blockers_reviewed: false }); let r = await page({ data }); assert.ok(!r.text.includes("NOT_FIRST")); const badges = nodes(section(r, "Go / No-Go Decision"), "StatusBadge").map((n) => n.props); assert.deepEqual(badges.map((p) => p.tone), ["bad", "good", "good"]); data[5][0] = { decision: "approved_for_launch", blockers_reviewed: false, accepted_risks_reviewed: false }; r = await page({ data }); assert.deepEqual(nodes(section(r, "Go / No-Go Decision"), "StatusBadge").map((n) => n.props.tone), ["warn", "warn", "warn"]); assert.ok(r.text.includes("pending approval")); });
for (const dataAtDecision of [[], [{}], [{ decision: null }]]) test(`healthy missing decision ${JSON.stringify(dataAtDecision)} distinct from unavailable`, async () => { const data = structuredClone(fixtures); data[5] = dataAtDecision; const r = await page({ data }); assert.ok(states(r).some((n) => n.title === "אין החלטת Go/No-Go")); const f = await page({ data, failures: { 5: { kind: "returned", stale: true } } }); assert.ok(!states(f).some((n) => n.title === "אין החלטת Go/No-Go")); assert.ok(states(f).some((n) => n.title === "נתוני ההחלטה לא זמינים")); });
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} data preserves legitimate defaults`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.deepEqual(r.metrics.map((m) => m.value), ["0/100", "0/100", "0/100", "0/100", "0/100", "0/100", 0, 0]); assert.deepEqual(r.metrics.map((m) => m.tone), ["bad", "bad", "bad", "bad", "bad", "bad", "good", "good"]); assert.equal(r.metrics[1].hint, "לא ידוע"); assert.ok(section(r, "Final Launch Checklist").props.subtitle.includes("0/0")); });
test("all failures/loader failure/denied admin fail closed without false empty success", async () => { const all = labels.map((_, i) => i), failures = Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])); const f = await page({ failures }); contracts(f); dependencies(f, all); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); await page({ deny: true }); });
test("actual formatters original status precedence and row keys fallback semantics", async () => { const r = await page(), f = r.formatters; assert.equal(f.label(null), "לא ידוע"); assert.equal(f.label("SOME_VALUE"), "SOME VALUE"); for (const s of ["ready", "approved", "verified", "closed", "commercial_ready", "approved_for_launch", "launched", "mitigated"]) assert.equal(f.statusTone(s), "good"); for (const s of ["in_progress", "internal_ready", "pilot_ready", "external_review_required", "accepted_risk", "open"]) assert.equal(f.statusTone(s), "warn"); for (const s of ["not_ready", "blocked", "critical", "failed", "paused"]) assert.equal(f.statusTone(s), "bad"); assert.equal(f.statusTone(null), "default"); assert.equal(f.countOpen([{ status: "mitigated" }, { status: "verified" }, { status: "open" }]), 1); const data = structuredClone(fixtures); delete data[1][0].id; delete data[2][0].id; data[2][0].checklist_key = "fallback-check"; delete data[3][0].id; data[3][0].blocker_key = "fallback-block"; delete data[4][0].id; data[4][0].risk_key = "fallback-risk"; const k = nodes((await page({ data })).tree).map((n) => n.key); for (const id of ["gan_batuach", "fallback-check", "fallback-block", "fallback-risk"]) assert.ok(k.includes(id)); });
test("links/static planning qualifiers and exact single domain hook", async () => { const r = await page(); qualifiers(r); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/company-operations", "/dashboard/admin/security-center", "/dashboard/admin/external-validation", "/dashboard/admin/launch-readiness"]); assert.deepEqual(nodes(r.hero.actions, "Link").map((n) => n.props.href), ["/dashboard/admin/company-operations", "/dashboard/admin/external-validation"]); const config = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = config.domain.filter((v) => v.name === "final-production-launch-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-final-production-launch-query-boundary.mjs"]); assert.ok(section(r, "Operating Handoff").props.subtitle); });
