import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page/helper, synthetic JSX and read-only client; no live workforce proof.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/inspection-workforce/page.tsx")) + "\nexports.qaFormatters={label,money,dateText,toneForScore,toneForStatus};", helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  [
    "inspection_workforce_readiness_scores",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "calculated_at",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        1
      ]
    ]
  ],
  [
    "inspection_workforce_profiles",
    [
      [
        "select",
        "*, profiles:inspector_profile_id(full_name,email,phone,active)"
      ],
      [
        "order",
        "active_status"
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "inspection_workforce_assignments",
    [
      [
        "select",
        "*, gardens(name,city), primary:primary_inspector_id(full_name), backup:backup_inspector_id(full_name), supervisor:regional_supervisor_id(full_name)"
      ],
      [
        "order",
        "region"
      ],
      [
        "limit",
        160
      ]
    ]
  ],
  [
    "inspection_workforce_capacity_models",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "inspections_per_month"
      ],
      [
        "limit",
        20
      ]
    ]
  ],
  [
    "inspection_workforce_monthly_plans",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "plan_month",
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
    "inspection_workforce_schedules",
    [
      [
        "select",
        "*, gardens(name,city)"
      ],
      [
        "order",
        "scheduled_date",
        {
          "ascending": true
        }
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "inspection_workforce_routes",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "route_date",
        {
          "ascending": true
        }
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "inspection_workforce_compensation",
    [
      [
        "select",
        "*, profiles:inspector_id(full_name)"
      ],
      [
        "order",
        "estimated_monthly_payout_nis",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "inspection_workforce_financial_forecasts",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "scenario_kindergartens"
      ],
      [
        "limit",
        20
      ]
    ]
  ],
  [
    "inspection_workforce_performance",
    [
      [
        "select",
        "*, profiles:inspector_id(full_name)"
      ],
      [
        "order",
        "metric_month",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "inspection_workforce_quality_reviews",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "severity"
      ],
      [
        "order",
        "due_date",
        {
          "ascending": true
        }
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "inspection_workforce_training",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "module_type"
      ],
      [
        "limit",
        160
      ]
    ]
  ],
  [
    "inspection_workforce_certifications",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "document_type"
      ],
      [
        "limit",
        160
      ]
    ]
  ],
  [
    "inspection_workforce_candidates",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "status"
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "inspection_workforce_slas",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "sla_type"
      ],
      [
        "limit",
        40
      ]
    ]
  ],
  [
    "inspection_workforce_alerts",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "severity"
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
        120
      ]
    ]
  ],
  [
    "inspection_workforce_audit_events",
    [
      [
        "select",
        "*"
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
    "inspection_workforce_risks",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "severity"
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
        120
      ]
    ]
  ]
];
const garden={name:'SYNTHETIC_GARDEN',city:'CITY_A'};const fixtures=[
[{id:'score-a',workforce_readiness_score:88,active_inspectors:12,assigned_kindergartens:100,inspections_due_this_month:40,overdue_inspections:3,follow_up_inspections:5,complaint_driven_inspections:2}],
[{id:'profile-a',active_status:'active',profiles:{full_name:'SYNTHETIC_INSPECTOR_A'},city_coverage:['CITY_A'],assigned_kindergarten_count:8,monthly_capacity:10,completed_inspections:4,overdue_inspections:1},{id:'profile-b',active_status:'active',profiles:{full_name:'SYNTHETIC_INSPECTOR_B'}}],
[{id:'assignment-a',status:'active',gardens:garden,assignment_method:'manual',region:'REGION_A',workload_score:70}],
[{id:'cap20',model_key:'capacity-20-kindergartens',scenario_name:'CAP20_ONLY',max_kindergartens_per_inspector:3,overload_risk:'healthy'},{id:'cap100',model_key:'capacity-100-kindergartens',scenario_name:'CAP100_TARGET',max_kindergartens_per_inspector:8,overload_risk:'healthy'}],
[{id:'plan-a',inspections_due:7,overdue_inspections:1,follow_up_inspections:2,complaint_driven_inspections:1,region:'REGION_A',week_number:1,inspections_scheduled:6,urgent_visits:1}],
[{id:'schedule-a',gardens:garden,inspection_type:'monthly',status:'scheduled',expected_duration_minutes:60}],
[{id:'route-a',region:'REGION_A',city:'CITY_A',status:'planned',map_provider_readiness:'future',travel_distance_estimate_km:10}],
[{id:'comp-a',profiles:{full_name:'SYNTHETIC_PAYEE'},estimated_monthly_payout_nis:100,compensation_model:'estimated',payout_status:'estimated'}],
[{id:'forecast20',scenario_kindergartens:20,inspector_cost_nis:1000,inspectors_needed:2,operational_risk:'estimated'},{id:'forecast100',scenario_kindergartens:100,inspector_cost_nis:5000,inspectors_needed:12,operational_risk:'estimated'}],
[{id:'performance-a',profiles:{full_name:'SYNTHETIC_INSPECTOR'},inspector_performance_score:90,inspections_completed:9,inspections_assigned:10,gps_validation_rate:80,report_quality_score:90}],
[{id:'quality-a',issue_type:'report',severity:'medium',quality_task:'SYNTHETIC_QUALITY'}],
[{id:'training-a',module_name:'SYNTHETIC_TRAINING',module_type:'basic',completion_status:'planned'}],
[{id:'cert-a',document_type:'first_aid',status:'pending_review',notes:'SYNTHETIC_CERT'}],
[{id:'candidate-a',full_name:'SYNTHETIC_CANDIDATE',status:'candidate',region:'REGION_A',expected_pay_nis:100}],
[{id:'sla-a',sla_type:'report',target_hours:24,current_breaches:1,status:'tracking'}],
[{id:'alert-a',severity:'high',status:'open',alert_type:'coverage',recipient_type:'admin',message:'SYNTHETIC_ALERT'},{id:'alert-b',severity:'critical',status:'resolved',message:'SYNTHETIC_RESOLVED'}],
[{id:'audit-a',event_title:'SYNTHETIC_AUDIT',event_type:'mock',created_at:'2026-11-01'}],
[{id:'risk-a',risk:'SYNTHETIC_OPEN_RISK',status:'open',severity:'medium',category:'coverage',mitigation:'human_review'},{id:'risk-b',risk:'SYNTHETIC_ACCEPTED',status:'accepted_risk',severity:'low'}]
];

const names = ["scores", "profiles", "assignments", "capacity", "plans", "schedules", "routes", "compensation", "forecasts", "performance", "quality", "training", "certs", "candidates", "slas", "alerts", "audit", "risks"];
const displayNames = [null, "Workforce profiles", "Regional assignments", "Capacity models", "Monthly plans", "Schedules", "Routes", "Compensation", "Financial forecasts", "Performance", "Quality reviews", "Training", "Certifications", "Candidates", "SLAs", "Workforce alerts", "Audit trail", "Workforce risks"];
async function page({ failures = {}, data = fixtures, empty = false, nullData = false, loader = false, deny = false } = {}) {
  let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
  const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "order", "limit"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
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
const card = (r, title) => nodes(r.tree, "ActionCard").find((n) => n.props.title === title).props;
const answer = (r, question) => text(nodes(r.tree, "article").find((n) => n.key === question));
const money = (v) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(v ?? 0));
const healthyValues = ["88/100", 12, 100, 40, 5, 8, money(5000), 1], healthyTones = ["good", "good", "good", "bad", "warn", "good", "warn", "bad"], deps = [[0], [0], [0], [0], [0], [3], [8], [15]];
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE")); }
function dependencies(r, failed = []) {
  const missing = (ds) => ds.some((i) => failed.includes(i));
  assert.deepEqual(r.metrics.map((m) => m.value), healthyValues.map((v, i) => missing(deps[i]) ? "לא זמין" : v)); assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => missing(deps[i]) ? "default" : v)); assert.equal(r.hero.badge, failed.includes(0) ? "לא זמין" : "88/100"); assert.equal(r.hero.badgeTone, failed.includes(0) ? "default" : "good");
  assert.equal(r.metrics[0].hint, failed.includes(17) ? "לא זמין" : "1 open risks"); assert.equal(r.metrics[1].hint, failed.includes(1) ? "לא זמין" : "2 workforce profiles"); assert.equal(r.metrics[3].hint, failed.includes(0) ? "לא זמין" : "3 overdue"); assert.equal(r.metrics[4].hint, failed.includes(0) ? "לא זמין" : "2 complaint-driven");
  for (let i = 1; i < 18; i++) { assert.equal(r.data.availability[names[i]], !failed.includes(i)); assert.equal(r.text.includes(`${displayNames[i]}: לא זמין`), failed.includes(i)); for (const row of fixtures[i]) assert.equal(nodes(r.tree).some((n) => n.key === row.id), !failed.includes(i)); }
  for (const [title, index, suffix] of [["Training", 11, "modules tracked"], ["Certification", 12, "document checks"], ["Recruitment", 13, "candidates"]]) assert.equal(card(r, title).text, `${failed.includes(index) ? "לא זמין" : 1} ${suffix}`);
  assert.equal(card(r, "Late inspections").text, `${failed.includes(0) ? "לא זמין" : 3} overdue`); assert.equal(card(r, "Late inspections").tone, failed.includes(0) ? "default" : "bad"); assert.equal(card(r, "Financial planning").text, `${failed.includes(8) ? "לא זמין" : money(5000)} cost at 100`);
  assert.ok(answer(r, "How many inspectors do we need for 100 kindergartens?").includes(`${failed.includes(8) ? "לא זמין" : 12} inspectors in baseline forecast`)); assert.ok(answer(r, "Which inspections are overdue?").includes(`${failed.includes(0) ? "לא זמין" : 3} overdue in workforce plan`));
}
test("healthy18exactqueries/primarymetrics/independent lists and hints", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let index = 0; index < 18; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${index} ${kind}/${stale ? "stale" : "empty"}: only own dependencies unavailable`, async () => { const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.ok(!r.banner.includes("מיגרציה")); assert.equal(r.warnings.length, 1); });
for (const failed of [[0, 3], [1, 2], [4, 5], [7, 8], [9, 10], [11, 12], [12, 13], [14, 15], [15, 16], [17, 8]]) test(`paired${failed} healthy neighbor lists retained`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
test("failed snapshot never falls back to healthy rows; row failures never erase present snapshot", async () => { const r = await page({ failures: { 0: { kind: "reject" } } }); dependencies(r, [0]); const keep = await page({ failures: { 1: { kind: "reject" }, 2: { kind: "returned" }, 4: { kind: "reject" } } }); dependencies(keep, [1, 2, 4]); });
for (const primary of [0, "0", 9, "9"]) test(`present primary${primary} wins over failed fallback per field`, async () => { const data = structuredClone(fixtures); for (const key of ["workforce_readiness_score", "active_inspectors", "assigned_kindergartens", "inspections_due_this_month", "overdue_inspections", "follow_up_inspections", "complaint_driven_inspections"]) data[0][0][key] = primary; const r = await page({ data, failures: { 1: { kind: "reject" }, 2: { kind: "returned" }, 4: { kind: "reject" } } }); contracts(r); assert.deepEqual(r.metrics.slice(0, 5).map((m) => m.value), [`${Number(primary)}/100`, Number(primary), Number(primary), Number(primary), Number(primary)]); assert.equal(r.metrics[3].hint, `${Number(primary)} overdue`); assert.equal(r.metrics[4].hint, `${Number(primary)} complaint-driven`); });
for (const mode of ["empty", "null", "missing"]) test(`healthy snapshot${mode} permits only valid fallback sources`, async () => {
  const data = structuredClone(fixtures); data[0] = mode === "empty" ? [] : [mode === "missing" ? {} : { workforce_readiness_score: null, active_inspectors: null, assigned_kindergartens: null, inspections_due_this_month: null, overdue_inspections: null, follow_up_inspections: null, complaint_driven_inspections: null }];
  const r = await page({ data }); contracts(r); assert.deepEqual(r.metrics.slice(0, 5).map((m) => m.value), ["0/100", 2, 1, 7, 2]); assert.equal(r.metrics[3].hint, "1 overdue"); assert.equal(r.metrics[4].hint, "1 complaint-driven");
  for (const i of [1, 2, 4]) { const f = await page({ data, failures: { [i]: { kind: "returned", stale: true } } }); assert.equal(f.hero.badge, "0/100"); assert.equal(f.metrics[i === 1 ? 1 : i === 2 ? 2 : 3].value, "לא זמין"); if (i === 4) { assert.equal(f.metrics[4].value, "לא זמין"); assert.equal(card(f, "Late inspections").tone, "default"); } }
});
for (const [field, fallback, target] of [["active_inspectors", 1, 1], ["assigned_kindergartens", 2, 2], ["inspections_due_this_month", 4, 3], ["follow_up_inspections", 4, 4]]) test(`only missing field${field} depends on failed fallback`, async () => { const data = structuredClone(fixtures); delete data[0][0][field]; const r = await page({ data, failures: { [fallback]: { kind: "reject" } } }); const values = [...healthyValues]; values[target] = "לא זמין"; assert.deepEqual(r.metrics.map((m) => m.value), values); assert.equal(r.hero.badge, "88/100"); });
for (const field of ["overdue_inspections", "complaint_driven_inspections"]) test(`missing severity${field} preserves known value but neutral hint/tone`, async () => { const data = structuredClone(fixtures); delete data[0][0][field]; const r = await page({ data, failures: { 4: { kind: "reject" } } }); const i = field === "overdue_inspections" ? 3 : 4; assert.equal(r.metrics[i].value, healthyValues[i]); assert.equal(r.metrics[i].hint, "לא זמין"); assert.equal(r.metrics[i].tone, "default"); if (i === 3) { assert.equal(card(r, "Late inspections").tone, "default"); assert.ok(answer(r, "Which inspections are overdue?").includes("לא זמין")); } });
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} distinguishes0 from unconfigured100scenario`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.deepEqual(r.metrics.map((m) => m.value), ["0/100", 0, 0, 0, 0, "TBD", "TBD", 0]); assert.equal(r.metrics[7].tone, "good"); assert.equal(r.metrics[0].hint, "0 open risks"); assert.equal(nodes(r.tree, "EmptyState")[0].props.title, "אין פרופילי workforce"); assert.equal(card(r, "Financial planning").text, "TBD cost at 100"); });
test("loader/allfail unavailable not false0/financial proof; denied0clients", async () => { const all = names.map((_, i) => i); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); assert.ok(r.banner); const f = await page({ failures: Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(f); dependencies(f, all); await page({ deny: true }); });
test("only20scenario is not100; complete original own-scenario lists retained", async () => { const data = structuredClone(fixtures); data[3] = [data[3][0]]; data[8] = [data[8][0]]; const r = await page({ data }); contracts(r); assert.equal(r.metrics[5].value, "TBD"); assert.equal(r.metrics[5].hint, "TBD"); assert.equal(r.metrics[5].tone, "default"); assert.equal(r.metrics[6].value, "TBD"); assert.equal(r.metrics[6].hint, "TBD inspectors"); assert.equal(card(r, "Financial planning").text, "TBD cost at 100"); assert.ok(answer(r, "How many inspectors do we need for 100 kindergartens?").includes("TBD inspectors")); assert.ok(text(section(r, "Capacity Calculator")).includes("CAP20_ONLY")); assert.ok(text(section(r, "Compensation & Financial Planning")).includes(money(1000))); });
test("exact100matching first row, string100 accepted, unrelated first scenario ignored", async () => { const data = structuredClone(fixtures); data[3].push({ ...data[3][1], id: "later-cap100", max_kindergartens_per_inspector: 99 }); data[8][1].scenario_kindergartens = "100"; data[8].push({ ...data[8][1], id: "later-forecast100", inspector_cost_nis: 99999, inspectors_needed: 999 }); const r = await page({ data }); assert.equal(r.metrics[5].value, 8); assert.equal(r.metrics[6].value, money(5000)); assert.equal(r.metrics[6].hint, "12 inspectors"); assert.ok(text(section(r, "Capacity Calculator")).includes("99 gardens/inspector")); });
for (const cost of [null, undefined, 0]) test(`matching100cost${cost} isTBD unless actually0`, async () => { const data = structuredClone(fixtures); data[8][1].inspector_cost_nis = cost; const r = await page({ data }); const value = cost == null ? "TBD" : money(0); assert.equal(r.metrics[6].value, value); assert.equal(card(r, "Financial planning").text, `${value} cost at 100`); assert.equal(r.metrics[6].hint, "12 inspectors"); assert.equal(r.metrics[6].tone, cost == null ? "default" : "warn"); assert.ok(text(section(r, "Compensation & Financial Planning")).includes(`cost ${value}`)); });
test("matchingcapacity missingmax retainsTBD and own risk; missinginspectors retainsTBD", async () => { const data = structuredClone(fixtures); delete data[3][1].max_kindergartens_per_inspector; delete data[8][1].inspectors_needed; const r = await page({ data }); assert.equal(r.metrics[5].value, "TBD"); assert.equal(r.metrics[5].hint, "healthy"); assert.equal(r.metrics[6].value, money(5000)); assert.equal(r.metrics[6].hint, "TBD inspectors"); });
test("active filters/plansums/high alert exclusions/open risk statuses remain exact", async () => { const data = structuredClone(fixtures); data[0] = []; data[1].push({ id: "inactive", active_status: "training" }); data[2].push({ id: "inactive-assign", status: "closed" }); data[4].push({ id: "second-plan", inspections_due: "3", overdue_inspections: "2", follow_up_inspections: "4", complaint_driven_inspections: "5" }); data[15] = ["open", "resolved", "skipped", "closed"].flatMap((status, i) => ["high", "critical", "low"].map((severity, j) => ({ id: `${i}-${j}`, status, severity }))); data[17] = ["open", "accepted_risk", "closed", "mitigated", "tracking"].map((status, i) => ({ id: `risk-${i}`, status })); const r = await page({ data }); assert.deepEqual(r.metrics.slice(0, 5).map((m) => m.value), ["0/100", 2, 1, 10, 6]); assert.equal(r.metrics[3].hint, "3 overdue"); assert.equal(r.metrics[4].hint, "6 complaint-driven"); assert.equal(r.metrics[7].value, 4); assert.equal(r.metrics[0].hint, "2 open risks"); });
test("auditfirst8,otherlistsunclipped,profilesarray/defaults and nativeformatters/tones", async () => { const data = structuredClone(fixtures); data[16] = Array.from({ length: 12 }, (_, i) => ({ id: `audit-${i}`, event_title: `AUDIT_${i}`, created_at: "2026-11-01" })); data[11] = Array.from({ length: 12 }, (_, i) => ({ id: `training-${i}`, module_name: `TRAINING_${i}` })); data[1][0].profiles = [{ full_name: "ARRAY_PERSON" }]; delete data[1][1].profiles; const r = await page({ data }); assert.deepEqual(nodes(section(r, "SLA, Alerts & Audit Trail")).filter((n) => String(n.key).startsWith("audit-")).map((n) => n.key), Array.from({ length: 8 }, (_, i) => `audit-${i}`)); assert.ok(r.text.includes("ARRAY_PERSON")); assert.ok(r.text.includes("Inspector profile")); assert.ok(r.text.includes("TRAINING_11")); const f = r.formatters; assert.equal(f.label("needs_review"), "needs review"); assert.equal(f.label(null), "לא ידוע"); assert.equal(f.dateText(null), "לא נקבע"); assert.equal(f.dateText("2026-11-01"), new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date("2026-11-01"))); assert.equal(f.money(null), money(0)); assert.deepEqual([57, 58, 81, 82].map(f.toneForScore), ["bad", "warn", "warn", "good"]); for (const v of ["active", "approved", "completed", "healthy", "ready", "paid", "mitigated", "closed", "resolved"]) assert.equal(f.toneForStatus(v), "good"); for (const v of ["candidate", "training", "planned", "scheduled", "tracking", "medium", "estimated", "in_progress", "open", "needs_review", "manual_only", "recommended"]) assert.equal(f.toneForStatus(v), "warn"); for (const v of ["paused", "suspended", "inactive", "expired", "rejected", "blocked", "breached", "critical", "high", "overloaded", "missing"]) assert.equal(f.toneForStatus(v), "bad"); assert.equal(f.toneForStatus(null), "default"); });
test("navigation and human-inspection/financial/future-mapping safety notes unchanged", async () => { const r = await page(); const visibleContract = r.text + r.hero.subtitle + nodes(r.tree, "CleanSection").map((n) => n.props.subtitle).join(" "); for (const note of ["Human inspection required", "No automatic pass/fail", "חישוב בלבד, לא תשלום בפועל.", "Google Maps/Waze/Mapbox עתידי בלבד.", "stored data only", "AI ותצפיתן מסייעים בתיעדוף בלבד."]) assert.ok(visibleContract.includes(note)); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/national-inspections", "/dashboard/admin/inspectors", "/dashboard/admin/inspections/due", "/dashboard/admin/inspections/late", "/dashboard/admin/regional-scale-up", "/dashboard/admin/inspection-workforce", "/dashboard/admin/scale-100", "/dashboard/admin/inspection-workforce", "/dashboard/admin/inspection-workforce", "/dashboard/admin/inspection-workforce", "/dashboard/admin/security-review", "/dashboard/admin/scale-100", "/dashboard/admin/reports"]); });
test("one distinct hook only", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = c.domain.filter((v) => v.name === "inspection-workforce-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-inspection-workforce-query-boundary.mjs"]); });
