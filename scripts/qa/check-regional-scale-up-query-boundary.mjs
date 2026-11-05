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
const pageCode = compile(source("app/dashboard/admin/regional-scale-up/page.tsx")) + "\nexports.qaFormatters={money,measuredMoney,label,dateText,toneForScore,toneForStatus,avg};", helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  [
    "regional_scale_readiness_scores",
    [
      [
        "select",
        "*, regional_rollout_cohorts(cohort_name, rollout_status, region)"
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
    "regional_rollout_cohorts",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "start_date",
        {
          "ascending": true
        }
      ],
      [
        "limit",
        50
      ]
    ]
  ],
  [
    "regional_growth_plans",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "recommended_priority"
      ],
      [
        "order",
        "parent_demand_requests",
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
    "regional_onboarding_capacity",
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
        20
      ]
    ]
  ],
  [
    "regional_onboarding_automation_tasks",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "priority"
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
    "regional_support_forecasts",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "garden_count"
      ],
      [
        "limit",
        20
      ]
    ]
  ],
  [
    "regional_inspector_capacity",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "garden_count"
      ],
      [
        "limit",
        20
      ]
    ]
  ],
  [
    "regional_inspector_workloads",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "overload_risk"
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "regional_revenue_scale_validation",
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
        20
      ]
    ]
  ],
  [
    "regional_unit_economics",
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
        20
      ]
    ]
  ],
  [
    "regional_infrastructure_scale_checks",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "area"
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "regional_camera_observer_scale_readiness",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "readiness_type"
      ],
      [
        "limit",
        40
      ]
    ]
  ],
  [
    "regional_adoption_metrics",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "role_area"
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "regional_churn_risk_signals",
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
    "regional_customer_health_scores",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "customer_health_score",
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
    "regional_customer_success_tasks",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "priority"
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
    "regional_training_content_needs",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "issue_area"
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "regional_sales_operations_metrics",
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
        20
      ]
    ]
  ],
  [
    "regional_parent_demand_scaling",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "parent_requests",
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
    "regional_rollout_risks",
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
    "regional_expansion_decisions",
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
        20
      ]
    ]
  ]
];
const fixtures=[
[{id:'score',scale_readiness_score:88,target_kindergartens:100,active_kindergartens:12,adoption_score:77,launch_decision:'continue_to_250'}],
[{id:'cohort',cohort_name:'SYNTHETIC_COHORT',target_kindergartens:70,rollout_status:'planned'}],
[{id:'growth',city:'SYNTHETIC_CITY',active_kindergartens:7,recommended_priority:'planned'}],
[{id:'capacity',kindergartens_per_week:5,capacity_status:'tracking'}],
[{id:'automation',title:'SYNTHETIC_AUTOMATION',priority:'planned'}],
[{id:'support50',garden_count:50,recommended_support_staff:2,recommendation:'near_capacity'},{id:'support100',garden_count:100,recommended_support_staff:4,recommendation:'healthy'}],
[{id:'inspector50',garden_count:50,inspectors_needed:3,overload_risk:'near_capacity'},{id:'inspector100',garden_count:100,inspectors_needed:6,overload_risk:'healthy'}],
[{id:'workload',assigned_kindergartens:8,status:'tracking'}],
[{id:'revenue',forecast_mrr_nis:10000,mrr_nis:5000,arr_nis:60000,status:'on_forecast'}],
[{id:'economics',contribution_margin_nis:3000,break_even_kindergartens:20,status:'on_forecast'}],
[{id:'infrastructure',area:'SYNTHETIC_INFRA',metric_name:'load',status:'watch'}],
[{id:'camera',readiness_type:'SYNTHETIC_READINESS',status:'readiness_only',parent_raw_ai_blocked:true}],
[{id:'parent',role_area:'parent',adoption_score:80},{id:'staff',role_area:'staff',adoption_score:60},{id:'manager',role_area:'manager',adoption_score:90}],
[{id:'churn',signal_type:'SYNTHETIC_CHURN',status:'open',severity:'medium'}],
[{id:'health',customer_name:'SYNTHETIC_CUSTOMER',customer_health_score:70,status:'tracking'}],
[{id:'cs',title:'SYNTHETIC_CS_TASK',priority:'planned'}],
[{id:'training',issue_area:'SYNTHETIC_TRAINING',status:'planned'}],
[{id:'sales',leads_per_week:3,status:'tracking'}],
[{id:'demand',city:'SYNTHETIC_DEMAND',parent_requests:11,recommended_outreach_priority:'planned'}],
[{id:'risk',title:'SYNTHETIC_RISK',severity:'high',status:'open'}],
[{id:'decision',decision:'expand_to_new_city',readiness_score:80,rationale:'SYNTHETIC_RATIONALE'}]
];

const names = ["scores", "cohorts", "growth", "capacity", "automation", "support", "inspectorCapacity", "workloads", "revenue", "economics", "infrastructure", "cameraObserver", "adoption", "churn", "health", "csTasks", "training", "sales", "demand", "risks", "decisions"];
const displayNames = [null, "Regional cohorts", "Growth plans", "Onboarding capacity", "Automation tasks", "Support forecasts", "Inspector capacity", "Inspector workloads", "Revenue validation", "Unit economics", "Infrastructure checks", "Camera observer readiness", "Adoption metrics", "Churn signals", "Customer health", "Customer success tasks", "Training content", "Sales operations", "Regional demand", "Rollout risks", "Expansion decisions"];
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
const money = (v) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(v ?? 0));
const healthyValues = ["88/100", 100, 12, 4, 6, money(10000), money(3000), 2, "80%", "60%", "90%"], healthyTones = ["good", "warn", "warn", "good", "good", "good", "good", "bad", "warn", "warn", "good"], deps = [[0], [0], [0], [5], [6], [8], [9], [19, 13], [12], [12], [12]];
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE")); }
function dependencies(r, failed = []) {
  const missing = (ds) => ds.some((i) => failed.includes(i));
  assert.deepEqual(r.metrics.map((m) => m.value), healthyValues.map((v, i) => missing(deps[i]) ? "לא זמין" : v)); assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => missing(deps[i]) ? "default" : v)); assert.equal(r.hero.badge, failed.includes(0) ? "לא זמין" : "88/100");
  assert.equal(r.metrics[0].hint, failed.includes(0) ? "לא זמין" : "continue to 250"); assert.equal(r.metrics[1].hint, failed.includes(1) ? "לא זמין" : "1 regional cohorts"); assert.equal(r.metrics[7].hint, failed.includes(10) ? "לא זמין" : "1 infra checks to watch");
  for (let i = 1; i < 21; i++) { assert.equal(r.data.availability[names[i]], !failed.includes(i)); assert.equal(r.text.includes(`${displayNames[i]}: לא זמין`), failed.includes(i)); for (const row of fixtures[i]) assert.equal(nodes(r.tree).some((n) => n.key === row.id), !failed.includes(i)); }
  assert.equal(card(r, "Regional cohorts").text, `${failed.includes(1) ? "לא זמין" : 1} active planning records · ${failed.includes(0) ? "לא זמין" : 100} target gardens`);
  assert.equal(card(r, "System health").text, `${failed.includes(10) ? "לא זמין" : 1} checks require monitoring before expansion`); assert.equal(card(r, "Customer health").text, `${failed.includes(13) ? "לא זמין" : 1} churn signals open`); assert.equal(card(r, "Expansion blockers").text, `${failed.includes(19) ? "לא זמין" : 1} high/critical regional risks`); assert.equal(card(r, "Training scale").text, `${failed.includes(16) ? "לא זמין" : 1} knowledge items tracked`); assert.equal(card(r, "Parent adoption").text, failed.includes(12) ? "לא זמין" : "80% parent activation readiness");
  assert.equal(card(r, "Revenue validation").text, `${failed.includes(8) ? "לא זמין" : money(10000)} forecast MRR · price validation active`); assert.equal(card(r, "Support capacity").text, failed.includes(5) ? "לא זמין" : "4 staff · healthy"); assert.equal(card(r, "Inspector capacity").text, failed.includes(6) ? "לא זמין" : "6 inspectors needed for 100 gardens");
}
test("healthy21exactcontracts and all independent fields/lists/cards", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let index = 0; index < 21; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${index} ${kind}/${stale ? "stale" : "empty"} fails only own dependencies`, async () => { const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.equal(r.warnings.length, 1); assert.ok(!r.banner.includes("מיגרציה")); });
for (const failed of [[0, 12], [1, 2], [3, 4], [5, 6], [6, 7], [8, 9], [10, 11], [12, 19], [13, 14], [15, 16], [2, 18], [19, 20]]) test(`paired${failed} retains independent neighbor lists`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
test("failed primary cannot use healthy fallback, nonzero parent average still independent", async () => { const r = await page({ failures: { 0: { kind: "reject" } } }); dependencies(r, [0]); assert.equal(r.metrics[8].value, "80%"); });
for (const value of [0, "0", 9, "9"]) test(`presentprimary${value} ignores failed fallbacks`, async () => { const data = structuredClone(fixtures); data[0][0] = { scale_readiness_score: value, target_kindergartens: value, active_kindergartens: value, launch_decision: value }; const r = await page({ data, failures: { 1: { kind: "reject" }, 2: { kind: "returned" }, 20: { kind: "reject" } } }); contracts(r); assert.deepEqual(r.metrics.slice(0, 3).map((m) => m.value), [`${Number(value)}/100`, Number(value) || "50-100", Number(value)]); assert.equal(r.metrics[0].hint, String(value)); });
for (const mode of ["empty", "null", "missing"]) test(`healthyprimary${mode} uses only healthy fallback perfield`, async () => { const data = structuredClone(fixtures); data[0] = mode === "empty" ? [] : [mode === "null" ? { target_kindergartens: null, active_kindergartens: null, launch_decision: null } : {}]; const r = await page({ data }); assert.deepEqual(r.metrics.slice(0, 3).map((m) => m.value), ["0/100", 70, 7]); assert.equal(r.metrics[0].hint, "expand to new city"); for (const i of [1, 2, 20]) { const f = await page({ data, failures: { [i]: { kind: "reject" } } }); assert.equal(f.hero.badge, "0/100"); if (i === 20) assert.equal(f.metrics[0].hint, "לא זמין"); else assert.equal(f.metrics[i].value, "לא זמין"); } data[20] = []; const noDecision = await page({ data }); assert.equal(noDecision.metrics[0].hint, "not ready"); });
for (const [field, fallback, target] of [["target_kindergartens", 1, 1], ["active_kindergartens", 2, 2], ["launch_decision", 20, 0]]) test(`only missing${field} requires ownfallback`, async () => { const data = structuredClone(fixtures); delete data[0][0][field]; const r = await page({ data, failures: { [fallback]: { kind: "reject" } } }); assert.equal(r.hero.badge, "88/100"); if (target === 0) assert.equal(r.metrics[0].hint, "לא זמין"); else assert.equal(r.metrics[target].value, "לא זמין"); });
test("conditional adoption exact zero-inclusive rounded avg and snapshot fallback", async () => { const data = structuredClone(fixtures); data[12] = [{ id: "p0", role_area: "parent", adoption_score: 0 }, { id: "p80", role_area: "parent", adoption_score: 80 }, { id: "other", role_area: "parents", adoption_score: 100 }]; const r = await page({ data, failures: { 0: { kind: "reject" } } }); assert.equal(r.metrics[8].value, "40%"); assert.equal(r.metrics[8].hint, "2 records"); assert.equal(r.metrics[9].value, "0%"); assert.equal(r.metrics[10].value, "0%"); for (const rows of [[], [{ id: "p0", role_area: "parent", adoption_score: 0 }]]) { data[12] = rows; const fallback = await page({ data }); assert.equal(fallback.metrics[8].value, "77%"); const unknown = await page({ data, failures: { 0: { kind: "reject" } } }); assert.equal(unknown.metrics[8].value, "לא זמין"); assert.equal(unknown.metrics[8].tone, "default"); assert.equal(unknown.metrics[9].value, "0%"); } const failed = await page({ failures: { 12: { kind: "returned", stale: true } } }); assert.deepEqual(failed.metrics.slice(8).map((m) => m.value), Array(3).fill("לא זמין")); data[12] = [{ role_area: "parent", adoption_score: 0 }, { role_area: "parent", adoption_score: 1 }]; assert.equal((await page({ data })).metrics[8].value, "1%"); });
test("risk AND/churn filters and infrastructure independently known", async () => { const data = structuredClone(fixtures); data[19] = ["open", "mitigated", "closed", "accepted", "tracking"].flatMap((status, i) => ["high", "critical", "low"].map((severity, j) => ({ id: `risk${i}-${j}`, status, severity }))); data[13] = ["open", "mitigated", "accepted", "closed", "tracking"].map((status, i) => ({ id: `churn${i}`, status })); data[10] = ["watch", "needs_optimization", "blocked", "healthy"].map((status, i) => ({ id: `infra${i}`, status })); const r = await page({ data }); assert.equal(r.metrics[7].value, 6); assert.equal(r.metrics[7].hint, "3 infra checks to watch"); for (const index of [13, 19]) { const f = await page({ data, failures: { [index]: { kind: "reject" } } }); assert.equal(f.metrics[7].value, "לא זמין"); assert.equal(f.metrics[7].tone, "default"); assert.equal(f.metrics[7].hint, "3 infra checks to watch"); } const f = await page({ data, failures: { 10: { kind: "reject" } } }); assert.equal(f.metrics[7].value, 6); assert.equal(f.metrics[7].hint, "לא זמין"); });
test("100scenario absence distinct from queryerror; never substitute50", async () => { const data = structuredClone(fixtures); data[5] = [data[5][0]]; data[6] = [data[6][0]]; const r = await page({ data }); assert.equal(r.metrics[3].value, "TBD"); assert.equal(r.metrics[4].value, "TBD"); assert.equal(r.metrics[4].hint, "TBD gardens forecast"); assert.equal(card(r, "Support capacity").text, "TBD staff · TBD"); assert.equal(card(r, "Inspector capacity").text, "TBD inspectors needed for TBD gardens"); assert.ok(text(section(r, "Support Load & Staffing")).includes("50 gardens")); assert.ok(text(section(r, "Inspector Capacity & Workload")).includes("50 gardens")); });
test("exact100 later/string100/duplicatefirstmatch and present0 recommendations", async () => { const data = structuredClone(fixtures); data[5][1].garden_count = "100"; data[6][1].garden_count = "100"; data[5].push({ id: "later-support", garden_count: 100, recommended_support_staff: 99 }); data[6].push({ id: "later-inspector", garden_count: 100, inspectors_needed: 99 }); const r = await page({ data }); assert.equal(r.metrics[3].value, 4); assert.equal(r.metrics[4].value, 6); data[5][1].recommended_support_staff = 0; data[6][1].inspectors_needed = 0; const zero = await page({ data }); assert.equal(zero.metrics[3].value, 0); assert.equal(zero.metrics[4].value, 0); delete data[5][1].recommended_support_staff; delete data[6][1].inspectors_needed; const missing = await page({ data }); assert.equal(missing.metrics[3].value, "TBD"); assert.equal(missing.metrics[4].value, "TBD"); });
for (const value of [null, undefined, 0, "0", 12.7]) test(`money${value}: all displayed fields preserve measured versusmissing`, async () => { const data = structuredClone(fixtures); for (const k of ["forecast_mrr_nis", "mrr_nis", "arr_nis"]) data[8][0][k] = value; for (const k of ["contribution_margin_nis", "support_cost_nis", "inspector_cost_nis", "infrastructure_cost_nis"]) data[9][0][k] = value; const r = await page({ data }); const v = value == null ? "TBD" : money(value); assert.equal(r.metrics[5].value, v); assert.equal(r.metrics[5].hint, `${v} current`); assert.equal(r.metrics[6].value, v); assert.ok(card(r, "Revenue validation").text.startsWith(v)); const finance = text(section(r, "Revenue, Pricing & Unit Economics")); for (const part of [`${v} forecast MRR`, `${v} current`, `${v} ARR`, `${v} contribution margin`, `Support ${v}`, `inspector ${v}`, `infrastructure ${v}`]) assert.ok(finance.includes(part)); assert.equal(r.metrics[5].tone, value == null ? "default" : "good"); assert.equal(r.metrics[6].tone, value == null ? "default" : "good"); });
for (const nullData of [false, true]) test(`healthy${nullData ? "null" : "empty"} preserves default0 onlywhereknown`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.deepEqual(r.metrics.map((m) => m.value), ["0/100", "50-100", 0, "TBD", "TBD", "TBD", "TBD", 0, "0%", "0%", "0%"]); assert.equal(r.metrics[0].hint, "not ready"); assert.equal(r.metrics[7].tone, "good"); assert.equal(nodes(r.tree, "EmptyState")[0].props.title, "אין cohort אזורי"); });
test("loader/allfail/denied: no false defaults/money0/green0risks", async () => { const all = names.map((_, i) => i); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); assert.ok(r.banner); const f = await page({ failures: Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(f); dependencies(f, all); await page({ deny: true }); });
test("actual formatters/avg/statussets/thresholds and safety/navigation remain", async () => { const r = await page(), f = r.formatters; assert.equal(f.money(null), money(0)); assert.equal(f.measuredMoney(null), "TBD"); assert.equal(f.measuredMoney(0), money(0)); assert.equal(f.label("expand_to_new_city"), "expand to new city"); assert.equal(f.dateText(null), "לא נקבע"); assert.equal(f.dateText("2026-11-01"), new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date("2026-11-01"))); assert.equal(f.avg([{ x: 0 }, { x: 81 }, {}], "x"), 27); assert.deepEqual([57, 58, 81, 82].map(f.toneForScore), ["bad", "warn", "warn", "good"]); for (const s of ["active", "completed", "healthy", "on_forecast", "mitigated", "closed", "continue_to_250", "expand_to_new_city", "approved"]) assert.equal(f.toneForStatus(s), "good"); for (const s of ["planned", "recruiting", "onboarding", "stabilizing", "tracking", "near_limit", "near_capacity", "watch", "readiness_only", "mitigating", "recommended", "continue_regional_stabilization"]) assert.equal(f.toneForStatus(s), "warn"); for (const s of ["blocked", "critical", "high", "overloaded", "needs_optimization", "below_forecast", "negative_margin", "not_ready", "open", "at_risk"]) assert.equal(f.toneForStatus(s), "bad"); const visible = r.text + r.hero.subtitle + nodes(r.tree, "CleanSection").map((n) => n.props.subtitle).join(" ") + nodes(r.tree, "ActionCard").map((n) => n.props.text).join(" "); for (const note of ["800 ₪", "200 ₪", "readiness/shadow", "סקירת אנוש", "Shadow mode and human review remain mandatory", "Regional only"]) assert.ok(visible.includes(note)); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/regional-scale-up", "/dashboard/admin/commercial-rollout", "/dashboard/admin/customer-success", "/dashboard/admin/inspectors", "/dashboard/admin/billing", "/dashboard/admin/system-health", "/dashboard/admin/database-integrity", "/dashboard/admin/camera-gateway", "/dashboard/admin/observer-pilot", "/dashboard/admin/customer-success", "/dashboard/admin/customer-success", "/dashboard/admin/growth", "/dashboard/admin/commercial-launch", "/dashboard/admin/system-health", "/dashboard/admin/customer-success", "/dashboard/admin/final-compliance-review", "/dashboard/admin/reports"]); });
test("list order/unclipped bounded rows and one distinct hook", async () => { const data = structuredClone(fixtures); data[16] = Array.from({ length: 12 }, (_, i) => ({ id: `training${i}`, issue_area: `ISSUE_${i}` })); const r = await page({ data }); assert.deepEqual(nodes(section(r, "Customer Success, Training & Knowledge Scaling")).filter((n) => String(n.key).startsWith("training")).map((n) => n.key), data[16].map((v) => v.id)); assert.equal(card(r, "Training scale").text, "12 knowledge items tracked"); const c = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = c.domain.filter((v) => v.name === "regional-scale-up-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-regional-scale-up-query-boundary.mjs"]); });
