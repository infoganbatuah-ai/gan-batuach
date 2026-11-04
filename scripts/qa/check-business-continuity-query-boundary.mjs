import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/helper; synthetic clients/JSX only, never real rollout/finance proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/business-continuity/page.tsx")) + "\nexports.qaFormatters={calculateContinuityScore,average,toneForStatus,statusLabel,areaLabel,dateText};", helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-04T12:00:00.000Z"])); } static now() { return new Date("2026-11-04T12:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  [
    "backup_readiness_checks",
    [
      [
        "select",
        "id,backup_key,backup_type,status,backup_frequency,last_backup_at,next_backup_at,last_restore_test_at,restore_status,readiness_score,coverage_scope,retention_days,recovery_point_objective_minutes,recovery_time_objective_minutes,validation_status,legal_hold_supported,deletion_request_handling,notes,updated_at"
      ],
      [
        "order",
        "backup_type"
      ]
    ]
  ],
  [
    "restore_test_runs",
    [
      [
        "select",
        "id,test_key,test_type,target_system,status,started_at,completed_at,duration_minutes,rto_target_minutes,rpo_target_minutes,rto_met,rpo_met,result_summary,next_test_due_at,created_at"
      ],
      [
        "order",
        "created_at",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "disaster_recovery_plans",
    [
      [
        "select",
        "id,plan_key,incident_type,title,status,rto_minutes,rpo_minutes,detection_signals,recovery_steps,failover_strategy,communication_plan,last_tested_at,next_test_due_at,updated_at"
      ],
      [
        "order",
        "incident_type"
      ]
    ]
  ],
  [
    "provider_health_checks",
    [
      [
        "select",
        "id,provider_key,provider_name,provider_type,status,last_checked_at,latency_ms,failure_count,last_failure_at,fallback_provider_key,recovery_recommendation,updated_at"
      ],
      [
        "order",
        "provider_type"
      ]
    ]
  ],
  [
    "operational_incidents",
    [
      [
        "select",
        "id,incident_key,title,severity,status,impact_summary,affected_systems,started_at,ended_at,root_cause,mitigation,postmortem,created_at"
      ],
      [
        "order",
        "started_at",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        60
      ]
    ]
  ],
  [
    "recovery_recommendations",
    [
      [
        "select",
        "id,recommendation_key,source_type,source_id,severity,status,title,recommendation,suggested_owner_role,due_at,resolved_at,created_at"
      ],
      [
        "order",
        "created_at",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "failover_rules",
    [
      [
        "select",
        "id,rule_key,service_type,primary_condition,fallback_action,status,automation_mode,last_tested_at,updated_at"
      ],
      [
        "order",
        "service_type"
      ]
    ]
  ],
  [
    "offline_operations_modes",
    [
      [
        "select",
        "id,mode_key,role_key,capability,status,sync_strategy,max_offline_hours,conflict_policy,updated_at"
      ],
      [
        "order",
        "role_key"
      ]
    ]
  ],
  [
    "business_continuity_audit_events",
    [
      [
        "select",
        "id,event_type,severity,source_table,title,created_at"
      ],
      [
        "order",
        "created_at",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "recovery_objectives",
    [
      [
        "select",
        "id,objective_key,system_area,rto_minutes,rpo_minutes,priority,status,notes,updated_at"
      ],
      [
        "order",
        "priority"
      ]
    ]
  ],
  [
    "retention_alignment_checks",
    [
      [
        "select",
        "id,check_key,data_domain,retention_policy_status,deletion_request_supported,legal_hold_supported,backup_erasure_notes,last_reviewed_at,updated_at"
      ],
      [
        "order",
        "data_domain"
      ]
    ]
  ]
];
const fixtures=[[{"id": "backup", "backup_key": "supabase-database-backup", "backup_type": "database", "status": "ready", "readiness_score": 100, "coverage_scope": "SYNTHETIC_BACKUP", "backup_frequency": "daily"}], [{"id": "scheduled", "target_system": "SYNTHETIC_SCHEDULED_RESTORE", "status": "scheduled"}, {"id": "passed", "target_system": "SYNTHETIC_PASSED_RESTORE", "status": "passed", "completed_at": "2026-11-03"}], [{"id": "plan", "title": "SYNTHETIC_RECOVERY_PLAN", "status": "needs_review"}], [{"id": "provider", "provider_name": "SYNTHETIC_PROVIDER", "status": "healthy", "provider_type": "database"}], [{"id": "incident", "title": "SYNTHETIC_INCIDENT", "status": "open", "severity": "high", "affected_systems": ["synthetic-system"]}], [{"id": "recommendation", "title": "SYNTHETIC_RECOMMENDATION", "recommendation": "SYNTHETIC_HUMAN_REVIEW", "status": "open", "severity": "high"}], [{"id": "rule", "service_type": "database", "status": "pending", "primary_condition": "SYNTHETIC_CONDITION", "fallback_action": "SYNTHETIC_FALLBACK", "automation_mode": "manual"}], [{"id": "offline", "role_key": "SYNTHETIC_ROLE", "capability": "SYNTHETIC_OFFLINE_CAPABILITY", "status": "planned", "sync_strategy": "manual"}], [{"id": "audit", "title": "SYNTHETIC_AUDIT", "event_type": "record", "created_at": "2026-11-03"}], [{"id": "objective", "system_area": "database", "status": "defined", "rto_minutes": 30, "rpo_minutes": 60}], [{"id": "retention", "data_domain": "documents", "retention_policy_status": "pending", "backup_erasure_notes": "SYNTHETIC_RETENTION", "legal_hold_supported": false, "deletion_request_supported": false}]];

const actionLinks = ["/dashboard/admin/business-continuity#restore-tests", "/dashboard/admin/business-continuity#providers", "/dashboard/admin/business-continuity#incidents", "/dashboard/admin/business-continuity#offline", "/dashboard/admin/security-center", "/dashboard/admin/system-health", "/dashboard/admin/launch-readiness"];
const names = ["backups", "restoreTests", "plans", "providers", "incidents", "recommendations", "failoverRules", "offlineModes", "auditEvents", "objectives", "retentionChecks"];
const displayNames = ["כיסוי גיבויים", "בדיקות שחזור", "תוכניות התאוששות", "בריאות ספקים", "אירועים תפעוליים", "המלצות התאוששות", "כללי Failover", "מצבי עבודה בזמן תקלה", "יומן המשכיות", "יעדי התאוששות", "התאמת שמירה ופרטיות"];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
 let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
 const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
 const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "order", "limit"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { assert.equal(chains.length, 11, "one concurrent batch"); const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
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
const emptyStates = (r) => nodes(r.tree, "EmptyState").map((n) => n.props);
const action = (r, title) => nodes(r.tree, "ActionCard").find((n) => n.props.title === title).props;
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE")); assert.ok(!String(r.banner).includes("מיגרציה")); }
function proofLimits(r) { assert.ok(r.hero.subtitle.includes("אינו הוכחה")); for (const old of ["גיבוי מתועד", "שחזור נבדק", "ספקים במעקב"]) assert.ok(!r.text.includes(old)); assert.ok(r.metrics[0].hint.includes("מודל")); assert.ok(r.metrics[2].label.includes("מתוכננות")); assert.ok(section(r, "בדיקות שחזור").props.subtitle.includes("אינו הוכחת שחזור בפועל")); assert.ok(section(r, "כללי Failover מתועדים").props.subtitle.includes("תכנון בלבד")); }
function dependencies(r, failed = []) {
 const miss = (ds) => ds.some((i) => failed.includes(i)), aggregate = !miss([0, 1, 2, 3, 4]);
 assert.deepEqual(r.metrics.map((m) => m.value), [aggregate ? "90%" : "לא זמין", failed.includes(0) ? "לא זמין" : "100%", failed.includes(1) ? "לא זמין" : "2/2", failed.includes(3) ? "לא זמין" : 0, failed.includes(4) ? "לא זמין" : 1]);
 assert.deepEqual(r.metrics.map((m) => m.tone), [aggregate ? "good" : "default", failed.includes(0) ? "default" : "good", failed.includes(1) ? "default" : "good", failed.includes(3) ? "default" : "good", failed.includes(4) ? "default" : "bad"]);
 assert.equal(r.hero.badge, aggregate ? "90/100" : "לא זמין"); assert.equal(r.hero.badgeTone, aggregate ? "good" : "default");
 assert.equal(r.metrics[1].hint, failed.includes(0) ? "לא זמין" : "1 אזורי כיסוי"); assert.equal(r.metrics[2].hint, failed.includes(1) ? "לא זמין" : `אחרונה שהושלמה: ${r.formatters.dateText("2026-11-03")}`); assert.equal(r.metrics[3].hint, failed.includes(3) ? "לא זמין" : "1 רשומות ספקים"); assert.equal(r.metrics[4].hint, failed.includes(5) ? "לא זמין" : "1 המלצות פתוחות"); assert.equal(action(r, "אירוע תפעולי").tone, failed.includes(4) ? "default" : "bad");
 assert.deepEqual(Array.from(r.data.availability), names.map((_, i) => !failed.includes(i)));
 for (let i = 0; i < 11; i++) { assert.equal(r.text.includes(`${displayNames[i]}: לא זמין`), failed.includes(i)); for (const row of fixtures[i]) assert.equal(nodes(r.tree).some((n) => n.key === row.id), !failed.includes(i)); }
 assert.equal(emptyStates(r).length, 0); proofLimits(r);
}
test("healthy11exactqueries actualpage/helper and metadata qualifiers", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let index = 0; index < 11; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${index} ${kind}/${stale ? "stale" : "empty"} independentlysettles`, async () => { const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.equal(r.warnings.length, 1); });
for (const failed of [[0, 5], [1, 9], [2, 3], [3, 6], [4, 8], [7, 10], [4, 5], [5, 6], [0, 4]]) test(`paired${failed} preservesindependent healthy sources`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
test("allunused5to10 failures retain original90model and knowncomponents", async () => { const failed = [5, 6, 7, 8, 9, 10], r = await page({ failures: Object.fromEntries(failed.map((i) => [i, { kind: "reject" }])) }); dependencies(r, failed); assert.equal(r.hero.badge, "90/100"); });
test("formula preserveszeros/nullaverages ratios rounding THENincidentcap clamp", async () => { const r = await page(), f = r.formatters; const data = { backups: [{ readiness_score: 100 }, { readiness_score: 0 }, {}], providers: [{ status: "healthy" }, { status: "degraded" }, { status: "unknown" }], restoreTests: [{ status: "passed" }, { status: "scheduled" }, { status: "running" }], plans: [{ status: "ready" }, { status: "tested" }, { status: "needs_review" }, { status: "not_tested" }], incidents: [{ status: "open" }, { status: "resolved" }, { status: "closed" }] }; assert.equal(f.calculateContinuityScore(data), 42); data.incidents = Array.from({ length: 10 }, () => ({ status: "mitigating" })); assert.equal(f.calculateContinuityScore(data), 22); data.backups = [{ readiness_score: 1000 }]; data.providers = []; data.restoreTests = []; data.plans = []; data.incidents = []; assert.equal(f.calculateContinuityScore(data), 100); data.backups = [{ readiness_score: -100 }]; assert.equal(f.calculateContinuityScore(data), 0); assert.equal(f.average([0, 0, 100]), 33); });
for (const score of [0, 54, 55, 79, 80, 100, "0", null]) test(`original80and55thresholds preservebackup${score}`, async () => { const data = structuredClone(fixtures); data[0] = [{ ...data[0][0], readiness_score: score }]; const r = await page({ data }); assert.equal(r.metrics[1].value, `${Number(score ?? 0)}%`); assert.equal(r.metrics[1].tone, Number(score ?? 0) >= 80 ? "good" : Number(score ?? 0) >= 55 ? "warn" : "bad"); const expectedModel = r.formatters.calculateContinuityScore(r.data); assert.equal(r.hero.badge, `${expectedModel}/100`); assert.equal(r.hero.badgeTone, expectedModel >= 80 ? "good" : expectedModel >= 55 ? "warn" : "bad"); });
test("restore includesplannedrecords and firstcompleted row notmaxdate", async () => { const data = structuredClone(fixtures); data[1] = [{ id: "r0", status: "scheduled" }, { id: "r1", status: "failed", completed_at: "2026-10-01" }, { id: "r2", status: "passed", completed_at: "2026-11-01" }, { id: "r3", status: "running" }]; const r = await page({ data }); assert.equal(r.metrics[2].value, "2/4"); assert.equal(r.metrics[2].tone, "warn"); assert.equal(r.metrics[2].hint, `אחרונה שהושלמה: ${r.formatters.dateText("2026-10-01")}`); data[1] = [{ status: "scheduled" }]; const planned = await page({ data }); assert.equal(planned.metrics[2].value, "1/1"); assert.equal(planned.metrics[2].hint, "אחרונה שהושלמה: לא נקבע"); proofLimits(planned); const failed = await page({ data, failures: { 1: { kind: "returned", stale: true } } }); assert.equal(failed.metrics[2].value, "לא זמין"); assert.equal(failed.metrics[2].hint, "לא זמין"); });
test("incident/recommendation independenthint and neutralunknownzero notfalsegood", async () => { const data = structuredClone(fixtures); data[4] = ["resolved", "closed"].map((status, i) => ({ id: `inc${i}`, status })); data[5] = ["resolved", "dismissed", "open", "closed"].map((status, i) => ({ id: `rec${i}`, status })); const r = await page({ data }); assert.equal(r.metrics[4].value, 0); assert.equal(r.metrics[4].hint, "2 המלצות פתוחות"); assert.equal(r.metrics[4].tone, "warn"); const unknownRec = await page({ data, failures: { 5: { kind: "reject" } } }); assert.equal(unknownRec.metrics[4].value, 0); assert.equal(unknownRec.metrics[4].hint, "לא זמין"); assert.equal(unknownRec.metrics[4].tone, "default"); const unknownIncident = await page({ data, failures: { 4: { kind: "reject" } } }); assert.equal(unknownIncident.metrics[4].value, "לא זמין"); assert.equal(unknownIncident.metrics[4].hint, "2 המלצות פתוחות"); assert.equal(unknownIncident.metrics[4].tone, "default"); data[4] = [{ status: "open" }]; assert.equal((await page({ data, failures: { 5: { kind: "reject" } } })).metrics[4].tone, "bad"); });
test("coverageexact12filters butaverage includes all originalrows withoutdedup", async () => { const data = structuredClone(fixtures); const keys = ["supabase-database-backup", "supabase-auth-users-backup", "supabase-storage-buckets-backup", "documents-backup", "medical-records-backup", "inspection-reports-backup", "signature-records-backup", "parent-communications-backup", "compliance-records-backup", "observer-metadata-backup", "ai-telemetry-backup", "configuration-settings-backup"]; data[0] = keys.map((backup_key, i) => ({ id: `cover${i}`, backup_key, readiness_score: 100 })); data[0].push({ id: "unknown-key", backup_key: "not-in-coverage", readiness_score: 0 }, { id: "duplicate-key", backup_key: keys[0], readiness_score: 0 }); const r = await page({ data }); assert.equal(r.metrics[1].value, "86%"); assert.equal(r.metrics[1].hint, "14 אזורי כיסוי"); assert.deepEqual(nodes(section(r, "כיסוי גיבויים")).filter((n) => n.key != null).map((n) => n.key), [...data[0].slice(0, 12).map((v) => v.id), "duplicate-key"]); assert.ok(!nodes(r.tree).some((n) => n.key === "unknown-key")); });
test("recommendations8 plans10 audit8 originalorder and healthyempty filtersemantics", async () => { const data = structuredClone(fixtures); data[5] = Array.from({ length: 12 }, (_, i) => ({ id: `rec${i}`, status: i === 0 ? "resolved" : "open" })); data[2] = Array.from({ length: 15 }, (_, i) => ({ id: `plan${i}`, status: "ready" })); data[8] = Array.from({ length: 12 }, (_, i) => ({ id: `audit${i}`, title: `AUDIT_${i}` })); const r = await page({ data }); for (const [title, keys] of [["המלצות התאוששות", data[5].slice(1, 9).map((v) => v.id)], ["תוכניות התאוששות", data[2].slice(0, 10).map((v) => v.id)], ["יומן המשכיות", data[8].slice(0, 8).map((v) => v.id)]]) assert.deepEqual(nodes(section(r, title)).filter((n) => n.key != null).map((n) => n.key), keys); data[5] = [{ status: "resolved" }, { status: "dismissed" }]; const noRec = await page({ data }); assert.ok(emptyStates(noRec).some((n) => n.title === "אין המלצות פתוחות")); const failed = await page({ data, failures: { 5: { kind: "reject" } } }); assert.ok(!emptyStates(failed).some((n) => n.title === "אין המלצות פתוחות")); });
for (const nullData of [false, true]) test(`healthy${nullData ? "null" : "empty"} keeps legitimateoriginaldefaults`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.deepEqual(r.metrics.map((m) => m.value), ["0%", "0%", "0/0", 0, 0]); assert.deepEqual(r.metrics.map((m) => m.tone), ["bad", "bad", "warn", "good", "good"]); assert.equal(r.metrics[2].hint, "אחרונה שהושלמה: לא נקבע"); assert.deepEqual(emptyStates(r).map((n) => n.title), ["אין נתוני גיבוי", "אין המלצות פתוחות", "אין אירועים פעילים", "אין אירועי audit עדיין"]); proofLimits(r); });
test("loader/allfail/denied nofalseemptyhealthy or successclaim", async () => { const all = names.map((_, i) => i); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); assert.ok(r.banner); const f = await page({ failures: Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(f); dependencies(f, all); await page({ deny: true }); });
test("actualstatus/area maps date and links/staticassistantquestions/humannote/onehook", async () => { const r = await page(), f = r.formatters; for (const [status, value] of Object.entries({"ready": "\u05de\u05d5\u05db\u05df", "tested": "\u05e0\u05d1\u05d3\u05e7", "passed": "\u05e2\u05d1\u05e8", "partial": "\u05d7\u05dc\u05e7\u05d9", "pending": "\u05de\u05de\u05ea\u05d9\u05df", "scheduled": "\u05de\u05ea\u05d5\u05db\u05e0\u05df", "failed": "\u05e0\u05db\u05e9\u05dc", "blocked": "\u05d7\u05e1\u05d5\u05dd", "healthy": "\u05ea\u05e7\u05d9\u05df", "degraded": "\u05d7\u05dc\u05e7\u05d9", "open": "\u05e4\u05ea\u05d5\u05d7", "investigating": "\u05d1\u05d1\u05d3\u05d9\u05e7\u05d4", "mitigating": "\u05d1\u05d8\u05d9\u05e4\u05d5\u05dc", "resolved": "\u05e0\u05e4\u05ea\u05e8", "closed": "\u05e0\u05e1\u05d2\u05e8", "prepared": "\u05de\u05d5\u05db\u05df", "needs_review": "\u05d3\u05d5\u05e8\u05e9 \u05d1\u05d3\u05d9\u05e7\u05d4", "defined": "\u05de\u05d5\u05d2\u05d3\u05e8", "not_tested": "\u05dc\u05d0 \u05e0\u05d1\u05d3\u05e7", "not_required": "\u05dc\u05d0 \u05e0\u05d3\u05e8\u05e9"})) assert.equal(f.statusLabel(status), value); assert.equal(f.statusLabel(null), "ממתין"); for (const [key, value] of Object.entries({"database": "\u05de\u05e1\u05d3 \u05e0\u05ea\u05d5\u05e0\u05d9\u05dd", "file_storage": "\u05d0\u05d7\u05e1\u05d5\u05df \u05e7\u05d1\u05e6\u05d9\u05dd", "auth_users": "\u05de\u05e9\u05ea\u05de\u05e9\u05d9 \u05d4\u05ea\u05d7\u05d1\u05e8\u05d5\u05ea", "documents": "\u05de\u05e1\u05de\u05db\u05d9\u05dd", "medical_records": "\u05de\u05d9\u05d3\u05e2 \u05e8\u05e4\u05d5\u05d0\u05d9", "inspection_reports": "\u05d3\u05d5\u05d7\u05d5\u05ea \u05e4\u05d9\u05e7\u05d5\u05d7", "signatures": "\u05d7\u05ea\u05d9\u05de\u05d5\u05ea", "parent_communications": "\u05ea\u05e7\u05e9\u05d5\u05e8\u05ea \u05d4\u05d5\u05e8\u05d9\u05dd", "compliance_records": "\u05e6\u05d9\u05d5\u05ea", "observer_metadata": "\u05ea\u05e6\u05e4\u05d9\u05ea\u05df", "ai_telemetry": "\u05de\u05d3\u05d3\u05d9 \u05d7\u05db\u05de\u05d4", "configuration_settings": "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea \u05de\u05e2\u05e8\u05db\u05ea", "communications": "\u05ea\u05e7\u05e9\u05d5\u05e8\u05ea", "camera_gateway": "\u05de\u05e6\u05dc\u05de\u05d5\u05ea", "observer": "\u05ea\u05e6\u05e4\u05d9\u05ea\u05df", "storage": "\u05d0\u05d7\u05e1\u05d5\u05df", "inspections": "\u05e4\u05d9\u05e7\u05d5\u05d7", "compliance": "\u05e6\u05d9\u05d5\u05ea", "configuration": "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea"})) assert.equal(f.areaLabel(key), value); assert.equal(f.areaLabel(null), "כללי"); assert.equal(f.areaLabel("CUSTOM"), "CUSTOM"); for (const s of [{"values": ["ready", "tested", "passed", "healthy", "resolved", "closed", "prepared", "defined", "not_required"], "tone": "good"}, {"values": ["failed", "blocked", "critical", "open", "degraded"], "tone": "bad"}, {"values": ["partial", "pending", "scheduled", "needs_review", "mitigating", "investigating", "running"], "tone": "warn"}]) for (const v of s.values) assert.equal(f.toneForStatus(v), s.tone); assert.equal(f.dateText(null), "לא נקבע"); assert.equal(f.dateText("2026-11-03"), new Date("2026-11-03").toLocaleDateString("he-IL")); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), actionLinks); const assistant = section(r, "עוזר המשכיות"); assert.ok(assistant.props.subtitle.includes("מנהל אנושי מחליט")); for (const question of ["\u05d0\u05d9\u05dc\u05d5 \u05d2\u05d9\u05d1\u05d5\u05d9\u05d9\u05dd \u05d3\u05d5\u05e8\u05e9\u05d9\u05dd \u05d1\u05d3\u05d9\u05e7\u05ea \u05e9\u05d7\u05d6\u05d5\u05e8?", "\u05d0\u05d9\u05dc\u05d5 \u05e1\u05e4\u05e7\u05d9\u05dd \u05d1\u05de\u05e6\u05d1 \u05d7\u05dc\u05e7\u05d9 \u05d0\u05d5 \u05db\u05e9\u05dc?", "\u05de\u05d4 \u05de\u05e1\u05db\u05df \u05d0\u05ea \u05d4\u05d7\u05d6\u05e8\u05d4 \u05dc\u05e4\u05e2\u05d9\u05dc\u05d5\u05ea?", "\u05de\u05d4 \u05d4\u05e4\u05e2\u05d5\u05dc\u05d4 \u05d4\u05d1\u05d0\u05d4 \u05d1\u05de\u05e7\u05e8\u05d4 \u05e9\u05dc \u05e0\u05e4\u05d9\u05dc\u05ea \u05de\u05e6\u05dc\u05de\u05d5\u05ea?", "\u05d0\u05d9\u05dc\u05d5 \u05d9\u05e2\u05d3\u05d9 RTO/RPO \u05dc\u05d0 \u05e0\u05d1\u05d3\u05e7\u05d5?", "\u05de\u05d4 \u05e6\u05e8\u05d9\u05da \u05dc\u05d1\u05d3\u05d5\u05e7 \u05dc\u05e4\u05e0\u05d9 \u05e4\u05d9\u05d9\u05dc\u05d5\u05d8 \u05d0\u05de\u05d9\u05ea\u05d9?"]) assert.ok(text(assistant).includes(question)); assert.equal(nodes(r.tree, "form").length, 0); const c = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = c.domain.filter((v) => v.name === "business-continuity-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-business-continuity-query-boundary.mjs"]); });
