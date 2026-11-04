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
const pageCode = compile(source("app/dashboard/admin/scale-100/page.tsx")) + "\nexports.qaFormatters={money,measuredMoney,label,dateText,toneForScore,toneForStatus,avg};", helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  [
    "scale_100_readiness_scores",
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
    "kindergarten_scale_cohorts",
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
        30
      ]
    ]
  ],
  [
    "kindergarten_scale_profiles",
    [
      [
        "select",
        "*, kindergarten_scale_cohorts(cohort_name, status)"
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
    "scale_100_onboarding_metrics",
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
    "scale_100_automation_tasks",
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
        100
      ]
    ]
  ],
  [
    "scale_100_adoption_targets",
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
    "scale_100_support_capacity",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "kindergarten_count"
      ],
      [
        "limit",
        20
      ]
    ]
  ],
  [
    "scale_100_inspector_capacity",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "kindergarten_count"
      ],
      [
        "limit",
        20
      ]
    ]
  ],
  [
    "scale_100_revenue_unit_economics",
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
    "scale_100_payment_health",
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
    "scale_100_infrastructure_checks",
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
    "scale_100_privacy_security_checks",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "risk_level"
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "scale_100_customer_health",
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
    "scale_100_churn_risk_signals",
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
    "scale_100_training_knowledge",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "category"
      ],
      [
        "limit",
        120
      ]
    ]
  ],
  [
    "scale_100_sales_insights",
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
        40
      ]
    ]
  ],
  [
    "scale_100_risk_register",
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
    "scale_100_success_criteria",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "required",
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
    "scale_100_expansion_decisions",
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
const fixtures=[[{"id": "score", "scale_readiness_score": 88, "active_kindergartens": 12, "onboarding_kindergartens": 5, "paid_kindergartens": 10, "suspended_kindergartens": 2, "parent_activation_score": 80, "staff_activation_score": 75, "critical_blockers": 1, "launch_decision": "continue_to_250_kindergartens"}], [{"id": "cohort", "cohort_name": "SYNTHETIC_COHORT", "target_kindergarten_count": 100, "status": "planned"}], [{"id": "profilea", "kindergarten_name": "SYNTHETIC_GARDEN_A", "payment_status": "paid", "onboarding_status": "completed", "subscription_amount_nis": 800}, {"id": "profileb", "kindergarten_name": "SYNTHETIC_GARDEN_B", "payment_status": "active", "onboarding_status": "onboarding"}, {"id": "profilec", "kindergarten_name": "SYNTHETIC_GARDEN_C", "payment_status": "suspended"}], [{"id": "onboarding", "average_kindergarten_activation_days": 7, "capacity_status": "tracking"}], [{"id": "automation", "title": "SYNTHETIC_AUTOMATION", "priority": "planned"}], [{"id": "parent", "role_area": "parent", "adoption_score": 40}, {"id": "staff", "role_area": "staff", "adoption_score": 30}, {"id": "manager", "role_area": "manager", "adoption_score": 90}], [{"id": "support50", "kindergarten_count": 50, "support_staff_needed": 2, "recommended_staffing": "tracking"}, {"id": "support100", "kindergarten_count": 100, "support_staff_needed": 4, "recommended_staffing": "healthy"}], [{"id": "inspector50", "kindergarten_count": 50, "inspectors_needed": 3, "monthly_inspections_required": 50, "overload_risk": "tracking"}, {"id": "inspector100", "kindergarten_count": 100, "inspectors_needed": 6, "monthly_inspections_required": 100, "overload_risk": "healthy"}], [{"id": "revenue", "projected_revenue_nis": 10000, "average_revenue_per_kindergarten_nis": 1000, "contribution_margin_nis": 3000, "status": "healthy"}], [{"id": "payments", "successful_payments": 10, "failed_payments": 1, "debt_accumulated_nis": 800, "status": "tracking"}], [{"id": "infra", "area": "SYNTHETIC_INFRA", "readiness_status": "watch"}], [{"id": "security", "area": "SYNTHETIC_SECURITY", "risk_level": "critical", "status": "open", "readiness_score": 20}], [{"id": "health", "customer_name": "SYNTHETIC_CUSTOMER", "customer_health_score": 70, "health_status": "tracking"}], [{"id": "churn", "signal_type": "SYNTHETIC_CHURN", "severity": "high"}], [{"id": "training", "title": "SYNTHETIC_TRAINING", "status": "planned"}], [{"id": "sales", "city": "SYNTHETIC_CITY", "leads_count": 5}], [{"id": "risk", "risk": "SYNTHETIC_RISK", "severity": "critical", "status": "open"}], [{"id": "criteria", "metric_name": "SYNTHETIC_CRITERION", "current_value": 2, "target_value": 3, "status": "in_progress"}], [{"id": "decision", "decision": "expand_to_another_region", "readiness_score": 85, "rationale": "SYNTHETIC_RATIONALE"}]];

const names = ["scores", "cohorts", "profiles", "onboarding", "automation", "adoption", "support", "inspectors", "revenue", "payments", "infrastructure", "security", "health", "churn", "training", "sales", "risks", "criteria", "decisions"];
const displayNames = [null, "Cohorts", "Kindergarten profiles", "Onboarding metrics", "Automation tasks", "Adoption targets", "Support forecasts", "Inspector forecasts", "Revenue economics", "Payment health", "Infrastructure checks", "Security checks", "Customer health", "Churn signals", "Training knowledge", "Sales insights", "Risk register", "Success criteria", "Expansion decisions"];
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

const healthyValues = ["88/100", 100, 12, 10, 4, 6, "80%", 3, "80%", "75%", "90%"], healthyTones = ["good", "warn", "good", "good", "good", "good", "warn", "bad", "warn", "warn", "good"], deps = [[0], [1], [0], [0], [6], [7], [0], [0, 16, 11], [0], [0], [5]];
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE")); }
function dependencies(r, failed = []) {
  const missing = (ds) => ds.some((i) => failed.includes(i));
  assert.deepEqual(r.metrics.map((m) => m.value), healthyValues.map((v, i) => missing(deps[i]) ? "לא זמין" : v));
  assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => missing(deps[i]) ? "default" : v));
  assert.equal(r.hero.badge, failed.includes(0) ? "לא זמין" : "88/100");
  assert.equal(r.metrics[0].hint, failed.includes(0) ? "לא זמין" : "continue to 250 kindergartens");
  assert.equal(r.metrics[1].hint, failed.includes(1) ? "לא זמין" : "1 cohorts");
  assert.equal(r.metrics[2].hint, failed.includes(0) ? "לא זמין" : "5 onboarding"); assert.equal(r.metrics[3].hint, failed.includes(0) ? "לא זמין" : "2 suspended");
  assert.equal(r.metrics[7].hint, failed.includes(16) ? "לא זמין" : "1 high/critical risks");
  for (let i = 1; i < 19; i++) { assert.equal(r.data.availability[names[i]], !failed.includes(i)); assert.equal(r.text.includes(`${displayNames[i]}: לא זמין`), failed.includes(i)); for (const row of fixtures[i]) assert.equal(nodes(r.tree).some((n) => n.key === row.id), !failed.includes(i)); }
  for (const [title, index, value] of [["Support capacity", 6, "4 staff forecast"], ["Inspector capacity", 7, "6 inspectors for 100"], ["Security", 11, "1 high-risk checks"], ["Parent adoption", 0, "80% current readiness"], ["Staff adoption", 0, "75% current readiness"], ["Training scale", 14, "1 training/KB items"], ["Sales insights", 15, "1 regional insight records"]]) assert.equal(card(r, title).text, failed.includes(index) ? "לא זמין" : value);
}
test("healthy19 exact contracts and actual page/helper", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let index = 0; index < 19; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${index} ${kind}/${stale ? "stale" : "empty"} retains independent facts`, async () => { const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.equal(r.warnings.length, 1); assert.ok(!r.banner.includes("מיגרציה")); });
for (const failed of [[0, 2], [0, 5], [0, 18], [1, 2], [3, 4], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 11], [16, 17], [17, 18]]) test(`paired${failed} only suppresses own dependencies`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
for (const value of [0, "0", 9, "9"]) test(`presentprimary${value} survives unavailable fallbacks`, async () => { const data = structuredClone(fixtures); for (const k of ["scale_readiness_score", "active_kindergartens", "onboarding_kindergartens", "paid_kindergartens", "suspended_kindergartens", "parent_activation_score", "staff_activation_score", "launch_decision"]) data[0][0][k] = value; const r = await page({ data, failures: { 2: { kind: "reject" }, 5: { kind: "returned", stale: true }, 18: { kind: "reject" } } }); contracts(r); assert.equal(r.hero.badge, `${Number(value)}/100`); assert.deepEqual(r.metrics.slice(2, 4).map((m) => m.value), [Number(value), Number(value)]); assert.deepEqual(r.metrics.slice(6, 7).map((m) => m.value), [`${Number(value)}%`]); assert.deepEqual(r.metrics.slice(8).map((m) => m.value), [`${Number(value)}%`, `${Number(value)}%`, "לא זמין"]); assert.equal(r.metrics[0].hint, String(value)); assert.equal(r.metrics[2].hint, `${Number(value)} onboarding`); assert.equal(r.metrics[3].hint, `${Number(value)} suspended`); });
for (const mode of ["empty", "missing", "null"]) test(`healthyprimary${mode} fallbackonly whereavailable`, async () => { const data = structuredClone(fixtures); data[0] = mode === "empty" ? [] : [mode === "missing" ? {} : Object.fromEntries(Object.keys(fixtures[0][0]).map((k) => [k, null]))]; const r = await page({ data }); assert.equal(r.hero.badge, "0/100"); assert.equal(r.metrics[1].value, 100); assert.deepEqual(r.metrics.slice(2, 4).map((m) => m.value), [2, 2]); assert.equal(r.metrics[2].hint, "1 onboarding"); assert.equal(r.metrics[3].hint, "1 suspended"); assert.equal(r.metrics[6].value, "40%"); assert.deepEqual(r.metrics.slice(8).map((m) => m.value), ["40%", "30%", "90%"]); assert.equal(r.metrics[0].hint, "expand to another region"); for (const i of [2, 5, 18]) { const f = await page({ data, failures: { [i]: { kind: "reject" } } }); assert.equal(f.hero.badge, "0/100"); if (i === 2) { assert.equal(f.metrics[2].value, "לא זמין"); assert.equal(f.metrics[3].value, "לא זמין"); } if (i === 5) assert.deepEqual([f.metrics[6], ...f.metrics.slice(8)].map((m) => m.value), Array(4).fill("לא זמין")); if (i === 18) assert.equal(f.metrics[0].hint, "לא זמין"); } data[18] = []; assert.equal((await page({ data })).metrics[0].hint, "pause and stabilize"); });
for (const field of ["active_kindergartens", "onboarding_kindergartens", "paid_kindergartens", "suspended_kindergartens", "parent_activation_score", "staff_activation_score", "launch_decision"]) test(`conditional missing${field} doesnoterase knownsnapshotfields`, async () => { const data = structuredClone(fixtures); delete data[0][0][field]; const i = field.includes("activation") ? 5 : field === "launch_decision" ? 18 : 2; const r = await page({ data, failures: { [i]: { kind: "reject" } } }); assert.equal(r.hero.badge, "88/100"); assert.equal(r.metrics[1].value, 100); if (field === "active_kindergartens") { assert.equal(r.metrics[2].value, "לא זמין"); assert.equal(r.metrics[2].hint, "5 onboarding"); } if (field === "onboarding_kindergartens") { assert.equal(r.metrics[2].value, 12); assert.equal(r.metrics[2].hint, "לא זמין"); assert.equal(r.metrics[2].tone, "default"); } if (field === "paid_kindergartens") { assert.equal(r.metrics[3].value, "לא זמין"); assert.equal(r.metrics[3].hint, "2 suspended"); } if (field === "suspended_kindergartens") { assert.equal(r.metrics[3].value, 10); assert.equal(r.metrics[3].hint, "לא זמין"); assert.equal(r.metrics[3].tone, "default"); } if (field === "parent_activation_score") { assert.equal(r.metrics[6].value, "לא זמין"); assert.equal(r.metrics[9].value, "75%"); } if (field === "staff_activation_score") { assert.equal(r.metrics[6].value, "80%"); assert.equal(r.metrics[9].value, "לא זמין"); } if (field === "launch_decision") assert.equal(r.metrics[0].hint, "לא זמין"); });
test("adoption snapshotfirst zero inclusive exact role averages managerindependent", async () => { const data = structuredClone(fixtures); data[5] = [{ role_area: "parent", adoption_score: 0 }, { role_area: "parent", adoption_score: 81 }, { role_area: "parents", adoption_score: 100 }, { role_area: "staff", adoption_score: 0 }]; assert.equal((await page({ data })).metrics[6].value, "80%"); delete data[0][0].parent_activation_score; delete data[0][0].staff_activation_score; const r = await page({ data }); assert.equal(r.metrics[6].value, "41%"); assert.equal(r.metrics[9].value, "0%"); assert.equal(r.metrics[10].value, "0%"); const f = await page({ data, failures: { 0: { kind: "reject" } } }); assert.equal(f.metrics[6].value, "לא זמין"); assert.equal(f.metrics[10].value, "0%"); data[5] = []; assert.equal((await page({ data })).metrics[6].value, "0%"); });
test("target onlycohorts healthyzero defaults100 primaryfailure irrelevant", async () => { const data = structuredClone(fixtures); data[1] = [{ target_kindergarten_count: "20" }, { target_kindergarten_count: 30 }, {}]; assert.equal((await page({ data, failures: { 0: { kind: "reject" } } })).metrics[1].value, 50); for (const rows of [[], [{ target_kindergarten_count: 0 }], [{ target_kindergarten_count: "0" }]]) { data[1] = rows; assert.equal((await page({ data })).metrics[1].value, 100); } assert.equal((await page({ failures: { 1: { kind: "reject" } } })).metrics[1].value, "לא זמין"); });
test("blockers three-wayAND originalrisk/security filters and independenthints", async () => { const data = structuredClone(fixtures); data[16] = ["open", "mitigated", "closed", "accepted_risk", "accepted", "tracking"].flatMap((status) => ["low", "high", "critical"].map((severity) => ({ status, severity }))); data[11] = ["healthy", "open", "closed"].flatMap((status) => ["low", "high", "critical"].map((risk_level) => ({ status, risk_level }))); const r = await page({ data }); assert.equal(r.metrics[7].value, 6); assert.equal(r.metrics[7].hint, "6 high/critical risks"); assert.equal(card(r, "Security").text, "4 high-risk checks"); for (const i of [0, 11, 16]) { const f = await page({ data, failures: { [i]: { kind: "reject" } } }); assert.equal(f.metrics[7].value, "לא זמין"); assert.equal(f.metrics[7].tone, "default"); assert.equal(f.metrics[7].hint, i === 16 ? "לא זמין" : "6 high/critical risks"); if (i !== 0) assert.equal(f.hero.badge, "88/100"); } data[0][0].critical_blockers = "0"; data[16] = []; data[11] = []; const z = await page({ data }); assert.equal(z.metrics[7].value, 0); assert.equal(z.metrics[7].tone, "good"); });
for (const rows of [[], [{ id: "wrong50", kindergarten_count: 50, support_staff_needed: 99, inspectors_needed: 99 }], [{ id: "wrong250", kindergarten_count: 250, support_staff_needed: 99, inspectors_needed: 99 }]]) test(`100scenario absent${JSON.stringify(rows)} neverfallback`, async () => { const data = structuredClone(fixtures); data[6] = rows; data[7] = rows; const r = await page({ data }); assert.equal(r.metrics[4].value, "TBD"); assert.equal(r.metrics[5].value, "TBD"); assert.equal(r.metrics[5].hint, "TBD monthly inspections"); assert.equal(r.metrics[4].tone, "default"); assert.equal(r.metrics[5].tone, "default"); assert.equal(card(r, "Support capacity").text, "TBD staff forecast"); for (const row of rows) assert.equal(nodes(r.tree).filter((n) => n.key === row.id).length, 2); });
for (const value of [0, "0", 6]) test(`string100 firstmatch and missingfields measured${value}`, async () => { const data = structuredClone(fixtures); data[6][1].kindergarten_count = "100"; data[7][1].kindergarten_count = "100"; data[6][1].support_staff_needed = value; data[7][1].inspectors_needed = value; data[7][1].monthly_inspections_required = value; data[6].push({ kindergarten_count: 100, support_staff_needed: 999 }); data[7].push({ kindergarten_count: 100, inspectors_needed: 999 }); const r = await page({ data }); assert.equal(r.metrics[4].value, value); assert.equal(r.metrics[5].value, value); assert.equal(r.metrics[5].hint, `${value} monthly inspections`); delete data[6][1].support_staff_needed; delete data[7][1].inspectors_needed; delete data[7][1].monthly_inspections_required; const m = await page({ data }); assert.equal(m.metrics[4].value, "TBD"); assert.equal(m.metrics[5].value, "TBD"); assert.equal(m.metrics[5].hint, "TBD monthly inspections"); });
for (const value of [null, undefined, 0, "0", 12.7]) test(`all5 monetaryfields absentversusmeasured${value}`, async () => { const data = structuredClone(fixtures); data[2][0].subscription_amount_nis = value; for (const k of ["projected_revenue_nis", "average_revenue_per_kindergarten_nis", "contribution_margin_nis"]) data[8][0][k] = value; data[9][0].debt_accumulated_nis = value; const r = await page({ data }), v = value == null ? "TBD" : money(value), finance = text(section(r, "Revenue, Unit Economics & Payment Health")); assert.ok(text(section(r, "Kindergarten Scale Profiles")).includes(v)); for (const item of [`${v} projected MRR`, `${v} avg/garden`, `contribution ${v}`, `debt ${v}`]) assert.ok(finance.includes(item), item); assert.ok(finance.includes("break-even TBD gardens")); });
for (const nullData of [false, true]) test(`healthy${nullData ? "null" : "empty"} preservesonlyknown defaults`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.deepEqual(r.metrics.map((m) => m.value), ["0/100", 100, 0, 0, "TBD", "TBD", "0%", 0, "0%", "0%", "0%"]); assert.equal(r.metrics[0].hint, "pause and stabilize"); assert.equal(r.metrics[7].tone, "good"); assert.equal(r.metrics[5].hint, "TBD monthly inspections"); assert.equal(nodes(r.tree, "EmptyState")[0].props.title, "אין cohorts לתוכנית 100"); });
test("loader allfail and denied no falsegreen or financialproof", async () => { const all = names.map((_, i) => i); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); assert.ok(r.banner); const f = await page({ failures: Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(f); dependencies(f, all); await page({ deny: true }); });
test("actualformatters and original thresholds/statussets/navigation/safety", async () => { const r = await page(), f = r.formatters; assert.equal(f.money(null), money(0)); assert.equal(f.measuredMoney(null), "TBD"); assert.equal(f.measuredMoney(0), money(0)); assert.equal(f.label("expand_to_another_region"), "expand to another region"); assert.equal(f.dateText(null), "לא נקבע"); assert.equal(f.dateText("2026-11-01"), new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date("2026-11-01"))); assert.equal(f.avg([{ x: 0 }, { x: 81 }, {}], "x"), 27); assert.deepEqual([57, 58, 81, 82].map(f.toneForScore), ["bad", "warn", "warn", "good"]); for (const v of [{"values": ["active", "completed", "healthy", "met", "mitigated", "closed", "paid", "tracking_ok", "continue_to_250_kindergartens", "expand_to_another_region"], "tone": "good"}, {"values": ["planned", "recruiting", "onboarding", "stabilizing", "tracking", "needs_attention", "near_limit", "watch", "readiness_only", "in_progress", "recommended", "pause_and_stabilize"], "tone": "warn"}, {"values": ["blocked", "critical", "high", "overloaded", "at_risk", "not_met", "open", "negative_margin", "needs_optimization"], "tone": "bad"}]) for (const status of v.values) assert.equal(f.toneForStatus(status), v.tone); const visible = r.text + r.hero.subtitle + nodes(r.tree, "CleanSection").map((n) => n.props.subtitle).join(" ") + nodes(r.tree, "ActionCard").map((n) => n.props.text).join(" "); for (const note of ["800 ₪", "200 ₪", "לא השקה ארצית", "הפרדה מלאה מתשלומי הורים", "Readiness only unless gateway is proven"]) assert.ok(visible.includes(note), note); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/commercial-rollout", "/dashboard/admin/regional-scale-up", "/dashboard/admin/customer-success", "/dashboard/admin/inspectors", "/dashboard/admin/subscriptions", "/dashboard/admin/database-integrity", "/dashboard/admin/system-health", "/dashboard/admin/security-review", "/dashboard/admin/camera-gateway", "/dashboard/admin/customer-success", "/dashboard/admin/users", "/dashboard/admin/customer-success", "/dashboard/admin/customer-success", "/dashboard/admin/growth", "/dashboard/admin/reports"]); });
test("unclipped ordered independentsections and singledomainhook", async () => { const data = structuredClone(fixtures); data[14] = Array.from({ length: 12 }, (_, i) => ({ id: `training${i}`, title: `TITLE_${i}` })); const r = await page({ data }); assert.deepEqual(nodes(section(r, "Training, Knowledge Base & Sales Insights")).filter((n) => String(n.key).startsWith("training")).map((n) => n.key), data[14].map((v) => v.id)); assert.equal(card(r, "Training scale").text, "12 training/KB items"); const c = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = c.domain.filter((v) => v.name === "scale-100-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-scale-100-query-boundary.mjs"]); });
