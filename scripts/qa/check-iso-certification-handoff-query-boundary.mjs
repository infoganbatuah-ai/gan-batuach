import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual readonly page and shared helper; synthetic metadata is not ISO or live-provider proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { const full = path.join(root, p); fs.statSync(full); return fs.readFileSync(full, "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/iso-certification-handoff/page.tsx")) + "\nexports.qaFormatters={label,toneForScore,toneForStatus,formatDate,jsonList,openCount};";
const helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-05T00:00:00.000Z"])); } static now() { return new Date("2026-11-05T00:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const ordered = (field, ascending) => ascending === undefined ? ["order", field] : ["order", field, { ascending }];
const inventory = [
 ["iso_external_process_readiness_scores", "iso external process readiness scores", "scores", [ordered("calculated_at", false)], 1],
 ["iso_certification_scopes", "iso certification scopes", "scopes", [ordered("created_at", false)], 10],
 ["iso_certification_process_stages", "iso certification process stages", "stages", [ordered("created_at")], 20],
 ["iso_external_handoff_packages", "iso external handoff packages", "packages", [ordered("package_type")], 30],
 ["iso_evidence_binder_finalization", "iso evidence binder finalization", "binder", [ordered("evidence_category")], 40],
 ["iso_statement_of_applicability", "iso statement of applicability", "soa", [ordered("control_id")], 250],
 ["risk_register", "risk register", "risks", [ordered("severity"), ordered("created_at", false)], 120],
 ["risk_treatment_plan", "risk treatment plan", "treatments", [ordered("target_date", true)], 120],
 ["internal_audits", "internal audits", "audits", [ordered("audit_date", false)], 80],
 ["management_reviews", "management reviews", "reviews", [ordered("review_date", true)], 40],
 ["security_policies_repository", "security policies repository", "policies", [ordered("policy_type")], 120],
 ["security_procedures", "security procedures", "procedures", [ordered("procedure_type")], 120],
 ["iso_external_reviewer_access_modes", "iso external reviewer access modes", "reviewerModes", [ordered("reviewer_type")], 20],
 ["iso_final_readiness_checklists", "iso final readiness checklists", "checklists", [ordered("standard"), ordered("area")], 80],
 ["iso_certification_gaps", "iso certification gaps", "gaps", [ordered("severity"), ordered("due_date", true)], 120],
 ["iso_certification_timeline", "iso certification timeline", "timeline", [ordered("target_date", true)], 30],
 ["iso_external_action_items", "iso external action items", "actions", [ordered("due_date", true)], 60],
 ["iso_certification_body_options", "iso certification body options", "bodies", [ordered("provider_name")], 20],
 ["iso_cost_timeline_estimates", "iso cost timeline estimates", "estimates", [ordered("created_at", false)], 5],
 ["iso_certification_claim_guardrails", "iso certification claim guardrails", "guardrails", [ordered("guardrail_key")], 30],
 ["iso_public_copy_audit_items", "iso public copy audit items", "copyAudit", [ordered("risk_type")], 40]
];
const expected = inventory.map(([table, , , orders, limit]) => [table, [["select", "*"], ...orders, ["limit", limit]]]);
const fixtures = [
 [{ id: "score", overall_handoff_score: 85, iso_27001_readiness: 80, iso_27017_readiness: 60, iso_27701_readiness: 40, evidence_completeness: 75, external_reviewer_status_score: 50, certification_stage: "prepared", remaining_blockers: ["SYNTHETIC_BLOCKER"] }],
 [{ id: "scope", included_items: ["SYNTHETIC_INCLUDED"], excluded_items: ["SYNTHETIC_EXCLUDED"] }],
 [{ id: "stage", stage: "prepared", notes: "SYNTHETIC_STAGE", status: "planned" }],
 [{ id: "package", title: "SYNTHETIC_PACKAGE", document_path: "SYNTHETIC_METADATA_NOT_A_PATH", status: "draft", sensitive_data_excluded: true }],
 [{ id: "binder1", evidence_category: "SYNTHETIC_BINDER", status: "ready_for_review", approved_count: 1, evidence_count: 2, missing_count: 1 }, { id: "binder2", status: "missing" }],
 [{ id: "soa1", applicable: true }, { id: "soa2", applicable: false }, { id: "soa3" }],
 [{ id: "risk1" }, { id: "risk2" }],
 [{ id: "treatment", treatment_type: "SYNTHETIC_TREATMENT", evidence: "SYNTHETIC_EVIDENCE", status: "planned" }],
 [{ id: "audit" }],
 [{ id: "review", review_scope: "SYNTHETIC_REVIEW", reviewer_name: "SYNTHETIC_REVIEWER", review_date: "2026-11-01", review_status: "planned" }],
 [{ id: "p1", certification_ready: true }, { id: "p2", approval_status: "approved" }],
 [{ id: "proc1", approval_status: "ready_for_review" }, { id: "proc2", status: "draft" }],
 [{ id: "mode", reviewer_type: "SYNTHETIC_MODE", blocked_resources: ["synthetic"], access_status: "planned", export_allowed: false }],
 [{ id: "checklist", title: "SYNTHETIC_CHECKLIST", status: "planned", standard: "synthetic" }],
 [{ id: "gap1", gap: "SYNTHETIC_OPEN_GAP", status: "open", severity: "critical" }, { id: "gap2", gap: "SYNTHETIC_FIXED_GAP", status: "fixed", severity: "high" }],
 [{ id: "timeline", stage: "SYNTHETIC_TIMELINE", status: "planned", target_date: "2026-11-03" }],
 [{ id: "action1", title: "SYNTHETIC_OPEN_ACTION", status: "open" }, { id: "action2", status: "completed" }, { id: "action3", status: "deferred" }],
 [{ id: "body", provider_name: "SYNTHETIC_BODY", standards_supported: ["synthetic"], estimated_timeline_weeks: 0, status: "research" }],
 [{ id: "estimate", confidence_level: "SYNTHETIC_ESTIMATE", expected_timeline_weeks: 0, internal_work_days: 0 }],
 [{ id: "guardrail", prohibited_claim: "SYNTHETIC_FORBIDDEN", allowed_wording: "SYNTHETIC_WORDING", status: "planned" }],
 [{ id: "copy", risky_claim: "SYNTHETIC_COPY", recommendation: "SYNTHETIC_RECOMMENDATION", status: "open" }]
];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
 let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
 const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
 const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "order", "limit"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { assert.equal(chains.length, 21, "one concurrent batch"); const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
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
const keys = (n) => nodes(n).filter((v) => v.key != null).map((v) => v.key);
const groups = [[2, "Certification Process Stages"], [3, "Handoff Packages"], [4, "Evidence Binder Finalization"], [13, "SoA / Controls"], [7, "Risk Treatment"], [9, "Policies / Procedures"], [12, "Safe External Reviewer Modes"], [14, "Gap Remediation Tracker"], [15, "Timeline and External Actions"], [16, "Timeline and External Actions"], [17, "Certification Body Comparison"], [18, "Certification Body Comparison"], [19, "Certification Claims Guardrails"], [20, "Public Website Copy Audit"]];
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!JSON.stringify([r.tree, r.warnings]).includes("PRIVATE_SENTINEL")); assert.ok(!String(r.banner).includes("מיגרציה")); }
function qualifiers(r) { for (const note of ["No certification claim", "Metadata-only reviewer access", "External approval required", "No sensitive data", "אין child, medical, camera, payment או secrets.", "ISO readiness בלבד עד תעודה חיצונית."]) assert.ok(r.text.includes(note), note); assert.ok(!section(r, "External Reviewer Handoff").props.subtitle.includes("החבילה מוכנה")); assert.equal(nodes(r.tree, "a").length, 0); }
function dependencies(r, failed = []) {
 const known = (i) => !failed.includes(i);
 assert.deepEqual(plain(r.data.available), Object.fromEntries(inventory.map(([, , k], i) => [k, known(i)])));
 assert.deepEqual(r.metrics.map((m) => m.value), [...["85/100", "80%", "60%", "40%", "75%", "50%"].map((v) => known(0) ? v : "לא זמין"), known(14) ? 1 : "לא זמין", known(16) ? 1 : "לא זמין"]);
 assert.deepEqual(r.metrics.map((m) => m.tone), [...["good", "warn", "warn", "bad", "warn", "bad"].map((v) => known(0) ? v : "default"), known(14) ? "bad" : "default", known(16) ? "warn" : "default"]);
 assert.equal(r.hero.badge, known(0) ? "85/100" : "לא זמין"); assert.equal(r.hero.badgeTone, known(0) ? "good" : "default");
 assert.equal(r.metrics[0].hint, known(0) ? "prepared" : "לא זמין"); assert.equal(r.metrics[4].hint, known(4) ? "1/2 binder categories" : "לא זמין"); assert.equal(r.metrics[5].hint, known(12) ? "1 safe modes" : "לא זמין"); assert.equal(r.metrics[6].hint, known(14) ? "1 high/critical" : "לא זמין");
 assert.ok(section(r, "Remaining Blockers")); assert.equal(text(section(r, "Remaining Blockers")).includes("SYNTHETIC_BLOCKER"), known(0));
 assert.equal(text(section(r, "Certification Scope")).includes("SYNTHETIC_INCLUDED"), known(1)); assert.ok(!nodes(r.tree, "EmptyState").some((n) => n.props.title === "לא הוגדר scope"));
 for (const [i, title] of groups) for (const row of fixtures[i].filter((row) => i !== 16 || row.status === "open")) assert.equal(keys(section(r, title)).includes(row.id), known(i), `${i}/${title}/${row.id}`);
 const countHints = [[5, "SoA / Controls", "2 applicable controls", "3 SoA records"], [13, "SoA / Controls", "1 final checklist items"], [6, "Risk Treatment", "2 risks"], [7, "Risk Treatment", "1 treatment plans"], [8, "Risk Treatment", "1 internal audits"], [10, "Policies / Procedures", "2/2 policies ready"], [11, "Policies / Procedures", "1/2 procedures ready"], [9, "Policies / Procedures", "1 management reviews"]];
 for (const [i, title, ...hints] of countHints) for (const h of hints) assert.equal(text(section(r, title)).includes(h), known(i), `${i}/${h}`);
 for (const i of failed) assert.deepEqual(Array.from(r.data[inventory[i][2]]), []); qualifiers(r);
}
test("healthy actual page/helper exact21 concurrent readonly queries", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let i = 0; i < 21; i++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${i} ${kind}/${stale ? "stale" : "empty"} is independent unknown`, async () => { const r = await page({ failures: { [i]: { kind, stale } } }); contracts(r); dependencies(r, [i]); assert.ok(r.banner); assert.deepEqual(plain(r.warnings), [["Admin Supabase query unavailable:", inventory[i][1]]]); });
for (const failed of [[0, 14, 16], [4, 12], [5, 7, 9], [5, 13], [6, 8], [9, 10], [10, 11], [15, 16], [17, 18], [19, 20], [1, 2, 3], [0, 4, 12]]) test(`paired${failed} independent counts/rows/hints`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(r); dependencies(r, failed); });
for (const score of [0, "0", 57.99, 58, 81.99, 82, 105.5, -4, null, undefined, "82.25"]) test(`source0 raw percentage versus Number score/tone ${score}`, async () => { const data = structuredClone(fixtures); data[0] = [{ overall_handoff_score: score, iso_27001_readiness: score, iso_27017_readiness: score, iso_27701_readiness: score, evidence_completeness: score, external_reviewer_status_score: score }]; const r = await page({ data }), n = Number(score ?? 0), tone = n >= 82 ? "good" : n >= 58 ? "warn" : "bad"; assert.equal(r.hero.badge, `${n}/100`); assert.equal(r.hero.badgeTone, tone); assert.deepEqual(r.metrics.slice(0, 6).map((m) => m.value), [`${n}/100`, ...Array(5).fill(`${score ?? 0}%`)]); assert.ok(r.metrics.slice(0, 6).every((m) => m.tone === tone)); assert.equal(section(r, "Remaining Blockers"), undefined); });
test("readiness uses first score only and no fallback to other scores or independent sources", async () => { const data = structuredClone(fixtures); data[0].push({ overall_handoff_score: 100, remaining_blockers: ["NOT_FIRST"] }); const r = await page({ data }); assert.equal(r.hero.badge, "85/100"); assert.ok(!r.text.includes("NOT_FIRST")); data[0] = []; const e = await page({ data }); assert.equal(e.hero.badge, "0/100"); assert.equal(e.metrics[6].value, 1); assert.equal(section(e, "Remaining Blockers"), undefined); const f = await page({ data, failures: { 0: { kind: "returned" } } }); assert.equal(f.hero.badge, "לא זמין"); assert.ok(section(f, "Remaining Blockers")); });
test("scope first row/jsonList Array-only String-map and blocker absence semantics", async () => { const data = structuredClone(fixtures); data[1] = [{ included_items: [0, false, null, { a: 1 }], excluded_items: '["NOT_ARRAY"]' }, { included_items: ["NOT_FIRST_SCOPE"] }]; data[0][0].remaining_blockers = '["NOT_A_BLOCKER"]'; const r = await page({ data }); assert.ok(text(section(r, "Certification Scope")).includes("0falsenull[object Object]")); assert.ok(!r.text.includes("NOT_FIRST_SCOPE")); assert.ok(!r.text.includes("NOT_ARRAY")); assert.equal(section(r, "Remaining Blockers"), undefined); data[0][0].remaining_blockers = [0, false, null]; const b = await page({ data }); assert.deepEqual(keys(section(b, "Remaining Blockers")), ["0", "false", "null"]); });
test("distinct gap openCount/critical and action pending sets, nullish review_status retained", async () => { const data = structuredClone(fixtures), statuses = ["completed", "verified", "fixed", "approved", "not_applicable", "accepted_risk", "deferred", "closed", "open"]; data[14] = statuses.map((status, i) => ({ id: `g${i}`, severity: "critical", status })); data[14].push({ id: "nullish", status: null, review_status: "verified", severity: "high" }, { id: "empty", status: "", review_status: "verified", severity: "low" }); data[16] = statuses.map((status, i) => ({ id: `a${i}`, status })); const r = await page({ data }); assert.equal(r.metrics[6].value, 5); assert.equal(r.metrics[6].hint, "7 high/critical"); assert.equal(r.metrics[7].value, 7); assert.deepEqual(keys(section(r, "Gap Remediation Tracker")), data[14].map((v) => v.id)); assert.deepEqual(keys(section(r, "Timeline and External Actions")), ["timeline", ...data[16].filter((v) => !["completed", "deferred"].includes(v.status)).map((v) => v.id)]); });
test("ready policy truthiness, ?? not ||, strict applicable !== false", async () => { const data = structuredClone(fixtures); data[5] = [true, false, null, undefined, 0, "false"].map((applicable, i) => ({ id: `s${i}`, applicable })); const rows = [{ certification_ready: "false", approval_status: "draft" }, { certification_ready: 0, approval_status: "", status: "approved" }, { approval_status: null, status: "approved" }, { approval_status: "ready_for_review" }, { certification_ready: false, status: "draft" }]; data[10] = rows; data[11] = rows; const r = await page({ data }); assert.ok(text(section(r, "SoA / Controls")).includes("5 applicable controls")); const p = text(section(r, "Policies / Procedures")); assert.ok(p.includes("3/5 policies ready")); assert.ok(p.includes("3/5 procedures ready")); });
test("binder exact String statuses and independent score/hints", async () => { const data = structuredClone(fixtures); data[4] = ["approved", "ready_for_review", "ready", "verified", "APPROVED"].map((status, i) => ({ id: `b${i}`, status })); const r = await page({ data, failures: { 0: { kind: "reject" } } }); assert.equal(r.metrics[4].value, "לא זמין"); assert.equal(r.metrics[4].hint, "2/5 binder categories"); assert.equal(r.metrics[5].hint, "1 safe modes"); });
test("all row groups retain order/keys, only checklist treatment action first8", async () => { const data = structuredClone(fixtures); for (const [i] of groups) data[i] = Array.from({ length: 11 }, (_, n) => ({ ...fixtures[i][0], id: `${i}-${n}`, status: "open", title: `SYNTHETIC_${i}_${n}` })); const r = await page({ data }); for (const title of new Set(groups.map(([, t]) => t))) { const parts = groups.filter(([, t]) => t === title); assert.deepEqual(keys(section(r, title)), parts.flatMap(([i]) => data[i].slice(0, [7, 13, 16].includes(i) ? 8 : 11).map((v) => v.id))); } assert.ok(!keys(r.tree).includes("risk1")); assert.ok(!keys(r.tree).includes("audit")); });
test("fallback row keys and metadata nullish/date/truthiness stay unchanged", async () => { const data = structuredClone(fixtures); const keyFields = { 2: "stage_key", 3: "package_key", 4: "binder_key", 7: "treatment_key", 9: "review_key", 12: "mode_key", 13: "checklist_key", 14: "gap_key", 15: "timeline_key", 16: "action_key", 17: "provider_key", 18: "estimate_key", 19: "guardrail_key", 20: "item_key" }; for (const [i, key] of Object.entries(keyFields)) data[i] = [{ ...fixtures[i][0], id: undefined, [key]: `fallback${i}` }]; data[7][0].evidence = ""; data[7][0].residual_risk = "NOT_NULLISH_FALLBACK"; data[12][0].export_allowed = "false"; data[12][0].blocked_resources = [0, false, null]; data[17][0].standards_supported = [0, false]; const r = await page({ data }); for (const [i, title] of groups) assert.ok(keys(section(r, title)).includes(`fallback${i}`)); assert.ok(!r.text.includes("NOT_NULLISH_FALLBACK")); assert.ok(r.text.includes("Export with admin approval · blocks 3 sensitive areas")); assert.ok(r.text.includes("0, false · timeline TBD")); assert.ok(r.text.includes("0 weeks · internal work 0 days")); assert.ok(r.text.includes(r.formatters.formatDate("2026-11-01"))); });
for (const nullData of [false, true]) test(`healthy${nullData ? "null" : "empty"} is known zero, not unknown`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.equal(r.hero.badge, "0/100"); assert.deepEqual(r.metrics.map((m) => m.value), ["0/100", "0%", "0%", "0%", "0%", "0%", 0, 0]); assert.equal(r.metrics[6].tone, "warn"); assert.equal(r.metrics[7].tone, "good"); assert.equal(r.metrics[4].hint, "0/0 binder categories"); assert.ok(nodes(r.tree, "EmptyState").some((n) => n.props.title === "לא הוגדר scope")); assert.equal(section(r, "Remaining Blockers"), undefined); qualifiers(r); });
test("all failed and loader unknown; denied admin makes zero clients/queries", async () => { const all = inventory.map((_, i) => i), r = await page({ failures: Object.fromEntries(all.map((i) => [i, { kind: "reject", stale: true }])) }); contracts(r); dependencies(r, all); const l = await page({ loader: true }); assert.equal(l.chains.length, 0); dependencies(l, all); assert.ok(l.banner); assert.ok(!JSON.stringify(l.tree).includes("PRIVATE_LOADER")); await page({ deny: true }); });
test("exact helpers/statusmaps/date/navigation/single hook and no actual effects", async () => { const r = await page(), f = r.formatters; for (const status of ["approved", "approved_for_audit", "completed", "ready", "ready_for_audit", "ready_for_consultant", "ready_for_external_reviewer", "ready_for_review", "verified"]) assert.equal(f.toneForStatus(status), "good"); for (const status of ["deferred", "draft", "in_progress", "needs_changes", "planned", "prepared", "research", "scheduled", "under_review"]) assert.equal(f.toneForStatus(status), "warn"); for (const status of ["blocked", "critical", "expired", "failed", "high", "missing", "not_started", "open"]) assert.equal(f.toneForStatus(status), "bad"); assert.equal(f.toneForStatus(null), "default"); assert.equal(f.formatDate(null), "לא נקבע"); assert.equal(f.formatDate("2026-11-01"), new Date("2026-11-01").toLocaleDateString("he-IL")); assert.equal(f.label(null), "לא ידוע"); assert.equal(f.label("a_b"), "a b"); assert.deepEqual(Array.from(f.jsonList("[]")), []); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/iso-certification-handoff", "/dashboard/admin/iso-evidence", "/dashboard/admin/security-review", "/dashboard/admin/legal-review"]); assert.deepEqual(nodes(r.hero.actions, "Link").map((n) => n.props.href), ["/dashboard/admin/iso-evidence", "/dashboard/admin/security-review"]); const hooks = JSON.parse(source("config/digital-observer-ci-gates.json")).domain.filter((v) => v.name === "iso-certification-handoff-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-iso-certification-handoff-query-boundary.mjs"]); qualifiers(r); });
