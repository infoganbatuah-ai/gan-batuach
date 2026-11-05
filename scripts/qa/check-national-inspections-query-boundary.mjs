import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page, safe helper and domain; synthetic JSX/client/fixed clock only.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
function source(p) { return fs.readFileSync(path.join(root, p), "utf8"); }
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source("app/dashboard/admin/national-inspections/page.tsx")), helperCode = compile(source("lib/admin-safe.ts")), domainCode = compile(source("lib/domain/national-inspections.ts"));
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-04T12:00:00Z"])); } static now() { return Date.parse("2026-11-04T12:00:00Z"); } }
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const domain = load(domainCode, unexpected), jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  [
    "inspections",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ]
    ]
  ],
  [
    "inspections",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "gte",
        "completed_at",
        "2026-10-31T22:00:00.000Z"
      ],
      [
        "eq",
        "status",
        "done"
      ]
    ]
  ],
  [
    "required_inspections",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "lt",
        "due_at",
        "2026-11-04T12:00:00.000Z"
      ],
      [
        "neq",
        "status",
        "done"
      ]
    ]
  ],
  [
    "required_inspections",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "gte",
        "due_at",
        "2026-11-04T12:00:00.000Z"
      ],
      [
        "lte",
        "due_at",
        "2026-12-04T12:00:00.000Z"
      ],
      [
        "neq",
        "status",
        "done"
      ]
    ]
  ],
  [
    "profiles",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "eq",
        "role",
        "inspector"
      ],
      [
        "eq",
        "active",
        true
      ]
    ]
  ],
  [
    "violations",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "neq",
        "status",
        "done"
      ]
    ]
  ],
  [
    "national_compliance_findings",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "in",
        "resolution_status",
        [
          "open",
          "in_progress"
        ]
      ]
    ]
  ],
  [
    "complaints",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "not",
        "status",
        "eq",
        "closed"
      ]
    ]
  ],
  [
    "observer_inspection_recommendations",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "in",
        "status",
        [
          "new",
          "reviewing",
          "planned"
        ]
      ]
    ]
  ],
  [
    "observer_inspection_recommendations",
    [
      [
        "select",
        "id",
        {
          "count": "exact",
          "head": true
        }
      ],
      [
        "gte",
        "risk_score",
        75
      ],
      [
        "in",
        "status",
        [
          "new",
          "reviewing",
          "planned"
        ]
      ]
    ]
  ],
  [
    "inspections",
    [
      [
        "select",
        "id,garden_id,inspector_id,status,completed_at,created_at,weighted_score,violation_count,critical_failures,gps_verified,gardens(name,city),inspectors:inspector_id(full_name)"
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
        250
      ]
    ]
  ],
  [
    "required_inspections",
    [
      [
        "select",
        "id,garden_id,inspector_id,due_at,status,gardens(name,city,last_inspection_score,safe_status)"
      ],
      [
        "neq",
        "status",
        "done"
      ],
      [
        "order",
        "due_at",
        {
          "ascending": true
        }
      ],
      [
        "limit",
        250
      ]
    ]
  ],
  [
    "inspectors",
    [
      [
        "select",
        "id,service_cities,created_at,profiles!inspectors_id_fkey(full_name,phone,email,active)"
      ],
      [
        "limit",
        250
      ]
    ]
  ],
  [
    "gardens",
    [
      [
        "select",
        "id,name,city,status,safe_status,inspector_id,last_inspection_score,next_inspection_at"
      ],
      [
        "limit",
        500
      ]
    ]
  ],
  [
    "violations",
    [
      [
        "select",
        "id,garden_id,title,severity,status,correction_due_at,gardens(name,city)"
      ],
      [
        "neq",
        "status",
        "done"
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
        250
      ]
    ]
  ],
  [
    "national_compliance_findings",
    [
      [
        "select",
        "id,garden_id,title,severity,resolution_status,due_at,responsible_party,gardens(name,city)"
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
        250
      ]
    ]
  ],
  [
    "complaints",
    [
      [
        "select",
        "id,garden_id,subject,severity,status,urgent,assigned_inspector_id,created_at,gardens(name,city)"
      ],
      [
        "not",
        "status",
        "eq",
        "closed"
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
        250
      ]
    ]
  ],
  [
    "observer_inspection_recommendations",
    [
      [
        "select",
        "id,garden_id,recommendation_type,risk_reason,risk_score,status,created_at,gardens(name,city)"
      ],
      [
        "order",
        "risk_score",
        {
          "ascending": false
        }
      ],
      [
        "limit",
        100
      ]
    ]
  ],
  [
    "national_inspection_plans",
    [
      [
        "select",
        "id,garden_id,inspector_id,plan_type,priority,status,scheduled_for,due_at,recommended_reason,gardens(name,city)"
      ],
      [
        "order",
        "due_at",
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
    "inspector_assignment_history",
    [
      [
        "select",
        "id,inspector_id,garden_id,assignment_scope,assignment_type,city,municipality,starts_at,ends_at,active,profiles:inspector_id(full_name),gardens(name,city)"
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
    "inspection_follow_up_actions",
    [
      [
        "select",
        "id,garden_id,action_type,status,due_at,completed_at,gardens(name,city)"
      ],
      [
        "order",
        "due_at",
        {
          "ascending": true
        }
      ],
      [
        "limit",
        120
      ]
    ]
  ]
];
// Preserve local calendar-month semantics rather than fixing a UTC month start.
expected[1][1][1][2] = new FixedDate(new FixedDate().getFullYear(), new FixedDate().getMonth(), 1).toISOString();
const counts = [100, 60, 2, 4, 5, 3, 2, 2, 3, 1], garden = { id: "garden-a", name: "GARDEN_A", city: "CITY_A", status: "active", inspector_id: "inspector-a", last_inspection_score: 70 };
const fixtures = [...Array(10).fill([]), [{ id: "inspection-a", garden_id: garden.id, inspector_id: "inspector-a", status: "done", weighted_score: 80 }], Array.from({ length: 3 }, (_, i) => ({ id: `required-${i}`, garden_id: garden.id, inspector_id: "inspector-a", due_at: "2020-01-01", status: "pending" })), [{ id: "inspector-a", profiles: { full_name: "INSPECTOR_A", active: true }, service_cities: ["CITY_A"] }], [garden], [{ id: "violation-a", garden_id: garden.id }], [{ id: "finding-a", garden_id: garden.id }], [{ id: "complaint-a", garden_id: garden.id }], [{ id: "rec-a", garden_id: garden.id, risk_reason: "REC_A", risk_score: 80, gardens: garden }], [{ id: "plan-a", garden_id: garden.id, plan_type: "PLAN_A", priority: "urgent", status: "planned", gardens: garden }], [{ id: "assign-a" }], [{ id: "follow-a" }]];
async function page({ failures = {}, data = fixtures, values = counts, empty = false, nullData = false, loader = false, deny = false } = {}) {
  let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
  const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
  const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "in", "eq", "order", "limit", "gte", "lte", "lt", "neq", "not"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i], count: nullData ? null : empty ? 0 : values[i] ?? null, error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
  const p = load(pageCode, (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, k) => String(k) });
    if (id === "@/lib/domain/national-inspections") return domain; if (id === "@/lib/admin-safe") return helper;
    if (id === "@/lib/auth") return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } }; return unexpected(id);
  }, warnings);
  if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(nodes(tree, "form").length, 0);
  return { tree, text: text(tree), clients, chains, warnings, data: captured.data, banner: nodes(tree, "AdminDataError")[0].props.message, hero: nodes(tree, "PremiumDashboardHero")[0].props, metrics: nodes(tree, "RoleMetricCard").map((n) => n.props), components: nodes(nodes(tree, "section").find((n) => n.props.className === "national-inspection-score-grid"), "strong").map(text) };
}
const section = (r, title) => nodes(r.tree, "CleanSection").find((n) => n.props.title === title);
const panel = (r, title) => nodes(r.tree, "article").find((n) => text(nodes(n, "h2")[0]).includes(title));
const list = (n) => nodes(n, "div").filter((v) => v.props.className === "list-item");
const valueDeps = [[0], [2], [3], [4], [0, 1], [6], [7], [8]], toneDeps = [[0, 1], [2], [3], [4, 11, 12], [0, 1], [6], [7], [8, 9]], componentDeps = [[0, 1], [2], [6], [4, 11, 12], [9]], riskDeps = [11, 13, 14, 15, 16, 17];
const healthyValues = [100, 2, 4, 5, "60%", 2, 2, 3], healthyTones = ["good", "bad", "warn", "warn", "bad", "warn", "warn", "bad"], healthyComponents = ["60%", "82%", "90%", "80%", "92%"];
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE")); }
function dependencies(r, failed = []) {
  const missing = (deps) => deps.some((i) => failed.includes(i));
  assert.deepEqual(r.metrics.map((m) => m.value), healthyValues.map((v, i) => missing(valueDeps[i]) ? "לא זמין" : v)); assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => missing(toneDeps[i]) ? "default" : v));
  assert.deepEqual(r.components, healthyComponents.map((v, i) => missing(componentDeps[i]) ? "לא זמין" : v)); assert.equal(r.hero.badge, componentDeps.some(missing) ? "לא זמין" : "78/100"); assert.equal(r.hero.badgeTone, componentDeps.some(missing) ? "default" : "warn");
  assert.equal(r.metrics[0].hint, failed.includes(1) ? "לא זמין" : "60 הושלמו החודש"); assert.equal(r.metrics[3].hint, missing([11, 12]) ? "לא זמין" : "1 בעומס"); assert.equal(r.metrics[7].hint, failed.includes(9) ? "לא זמין" : "1 דחופות");
  const work = panel(r, "עומס מפקחים"); assert.equal(list(work).length, failed.includes(12) ? 0 : 1);
  if (failed.includes(12)) { assert.ok(text(work).includes("לא זמין")); assert.ok(!text(work).includes("אין מפקחים להצגה.")); } else {
    assert.ok(text(work).includes("INSPECTOR_A")); assert.ok(text(work).includes(`${failed.includes(13) ? "לא זמין" : 1} גנים`)); assert.ok(text(work).includes(`${failed.includes(11) ? "לא זמין" : 3} פתוחות`)); assert.ok(text(work).includes(`${failed.includes(10) ? "לא זמין" : 1} הושלמו`)); assert.equal(nodes(work, "StatusBadge")[0].props.tone, failed.includes(11) ? "default" : "bad");
    assert.equal(r.data.inspectorWorkload[0].averageScore, failed.includes(10) ? null : 80);
  }
  for (const [title, index, marker] of [["תכנון פיקוחים", 18, "PLAN_A"], ["המלצות תצפיתן לפיקוח", 17, "REC_A"]]) { assert.equal(text(panel(r, title)).includes(marker), !failed.includes(index)); if (failed.includes(index)) assert.ok(text(panel(r, title)).includes("לא זמין")); }
  assert.equal(nodes(section(r, "גנים בסיכון גבוה"), "Link").length, missing(riskDeps) ? 0 : 1); assert.equal(list(panel(r, "סיכון לפי עיר")).length, missing(riskDeps) ? 0 : 1);
  if (missing(riskDeps)) { assert.ok(text(section(r, "גנים בסיכון גבוה")).includes("לא זמין")); assert.ok(text(panel(r, "סיכון לפי עיר")).includes("לא זמין")); }
  for (const [title, index, value] of [["Assignment engine", 19, 1], ["Follow-up workflow", 20, 1], ["Complaint escalation", 7, 2]]) assert.ok(text(nodes(panel(r, title), "p")[0]).startsWith(String(failed.includes(index) ? "לא זמין" : value)));
  assert.equal(nodes(r.tree, "ActionCard").find((n) => n.props.title === "ביקורות באיחור").props.tone, failed.includes(2) ? "default" : "bad");
}
test("healthy actual page/helper/domain preserves21 exact contracts and all dependencies", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let index = 0; index < 21; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${index} ${kind}/${stale ? "stale" : "empty"}: exact independent fields`, async () => { const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.equal(r.warnings.length, 1); assert.ok(!r.banner.includes("מיגרציה")); });
for (const failed of [[0, 18], [1, 13], [2, 17], [3, 7], [4, 10], [5, 19], [6, 14], [8, 9], [10, 13], [11, 12], [15, 20], [16, 18]]) test(`paired${failed} retain healthy independent sections`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
test("primary finding positive ignores unavailable fallback; primary unknown never falls back", async () => {
  for (const kind of ["returned", "reject"]) { const r = await page({ failures: { 5: { kind, stale: true } } }); dependencies(r, [5]); assert.equal(r.metrics[5].value, 2); assert.equal(r.components[2], "90%"); assert.equal(r.hero.badge, "78/100"); const primary = await page({ failures: { 6: { kind, stale: true } } }); assert.equal(primary.metrics[5].value, "לא זמין"); assert.equal(primary.components[2], "לא זמין"); }
});
test("known zero primary uses only known fallback; healthy null/zero retains precedence", async () => {
  for (const primary of [0, null]) { const values = [...counts]; values[6] = primary; const r = await page({ values }); assert.equal(r.metrics[5].value, 3); assert.equal(r.components[2], "85%"); const denied = await page({ values, failures: { 5: { kind: "reject" } } }); assert.equal(denied.metrics[5].value, "לא זמין"); assert.equal(denied.hero.badge, "לא זמין"); values[5] = 0; const zero = await page({ values }); assert.equal(zero.metrics[5].value, 0); assert.equal(zero.metrics[5].tone, "good"); }
});
test("headcount zero/null/stale999 errors never become known zeros", async () => { for (let i = 0; i < 10; i++) for (const value of [0, null, 999]) { const values = [...counts]; values[i] = value; const r = await page({ values, failures: { [i]: { kind: "returned", stale: true } } }); contracts(r); dependencies(r, [i]); } });
for (const nullData of [false, true]) test(`healthy ${nullData ? "null" : "empty"} preserves original94 readiness and65 workload`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.equal(r.hero.badge, "94/100"); assert.deepEqual(r.components, ["100%", "100%", "100%", "65%", "100%"]); assert.deepEqual(r.metrics.map((m) => m.value), [0, 0, 0, 0, "100%", 0, 0, 0]); assert.ok(r.text.includes("אין מפקחים להצגה.")); assert.ok(r.text.includes("אין אזורים להצגה.")); assert.ok(r.text.includes("אין תוכניות פיקוח לאומיות עדיין.")); });
test("loader/all unavailable never false94 or100 proof; denied0clients", async () => { const all = expected.map((_, i) => i); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); assert.ok(r.banner); const failures = Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])); const f = await page({ failures }); contracts(f); dependencies(f, all); await page({ deny: true }); });
test("custom readiness formula and workload threshold12open/3overdue remain unchanged", async () => {
  const data = structuredClone(fixtures); data[12] = Array.from({ length: 4 }, (_, i) => ({ id: `inspector-${i}`, profiles: i % 2 ? [{ full_name: `INSPECTOR_${i}`, active: false }] : { full_name: `INSPECTOR_${i}`, active: true }, service_cities: ["CITY"] })); data[11] = data[12].flatMap((p, i) => Array.from({ length: [11, 12, 3, 2][i] }, (_, n) => ({ id: `${i}-${n}`, inspector_id: p.id, due_at: i >= 2 ? "2020-01-01" : "2028-01-01" })));
  const values = [80, 60, 1, 7, 4, 20, 1, 6, 5, 2], r = await page({ data, values }); assert.equal(r.data.overloadedInspectors, 2); const s = domain.buildNationalInspectionReadiness({ totalInspections: 80, completedInspections: 60, overdueInspections: 1, unresolvedFindings: 1, activeInspectors: 4, overloadedInspectors: 2, urgentRecommendations: 2 }); assert.equal(r.hero.badge, `${s.readinessScore}/100`); assert.deepEqual(r.components, [s.completionRate, s.overdueScore, s.findingsScore, s.workloadScore, s.observerScore].map((n) => `${n}%`)); assert.equal(r.data.inspectorWorkload[1].name, "INSPECTOR_1"); assert.equal(r.data.inspectorWorkload[1].active, false);
});
test("workload null/date/dayUntil boundary, completed statuses/average filters and default profile", async () => {
  const data = structuredClone(fixtures); data[12].push({ id: "empty-inspector", profiles: [], service_cities: null }); data[10] = [0, 80, 60, null, "invalid"].map((v, i) => ({ id: `history-${i}`, inspector_id: "inspector-a", status: i === 2 ? "completed" : "done", weighted_score: v })); data[10].push({ id: "pending", inspector_id: "inspector-a", status: "pending", weighted_score: 100 }); data[11] = [null, "2026-11-04T11:59:59Z", "2026-11-03T12:00:00Z", "2026-11-05T12:00:00Z"].map((due_at, i) => ({ id: `due-${i}`, inspector_id: "inspector-a", due_at }));
  const r = await page({ data }); assert.equal(r.data.inspectorWorkload[0].completed, 5); assert.equal(r.data.inspectorWorkload[0].averageScore, 70); assert.equal(r.data.inspectorWorkload[0].overdue, 1); assert.equal(r.data.inspectorWorkload[1].name, "מפקח"); assert.equal(r.data.inspectorWorkload[1].active, true);
  const unknown = await page({ data, failures: { 10: { kind: "returned", stale: true }, 13: { kind: "reject" } } }); assert.equal(unknown.data.inspectorWorkload[0].completed, null); assert.equal(unknown.data.inspectorWorkload[0].averageScore, null); assert.equal(unknown.data.inspectorWorkload[0].assigned, null); assert.equal(unknown.data.inspectorWorkload[0].open, 4);
});
test("garden and city risk formulas/order/top12/top8; independent lists/workload top8", async () => {
  const data = structuredClone(fixtures); data[13] = Array.from({ length: 15 }, (_, i) => ({ ...garden, id: `garden-${i}`, name: `GARDEN_${i}`, city: i ? `CITY_${i}` : null, last_inspection_score: i % 2 ? 0 : 90 })); data[11] = data[13].flatMap((g, i) => Array.from({ length: i % 4 }, (_, n) => ({ id: `${i}-${n}`, garden_id: g.id, due_at: "2020-01-01" }))); data[14] = []; data[15] = []; data[16] = []; data[17] = data[13].map((g, i) => ({ ...fixtures[17][0], id: `rec-${i}`, garden_id: g.id, gardens: g })); data[18] = data[13].map((g, i) => ({ ...fixtures[18][0], id: `plan-${i}`, gardens: g })); data[12] = Array.from({ length: 11 }, (_, i) => ({ id: `inspector-${i}`, profiles: { full_name: `INSPECTOR_${i}` } }));
  const r = await page({ data }); contracts(r); const risk = data[13].map((g) => ({ id: g.id, score: domain.buildInspectionRiskScore({ incidents: 0, complaints: 0, unresolvedFindings: 0, observerAlerts: 1, overdueInspections: data[11].filter((v) => v.garden_id === g.id).length, complianceScore: g.last_inspection_score }) })).sort((a, b) => b.score - a.score);
  assert.deepEqual(nodes(section(r, "גנים בסיכון גבוה"), "Link").map((n) => n.key), risk.slice(0, 12).map((v) => v.id)); assert.equal(list(panel(r, "סיכון לפי עיר")).length, 8); assert.equal(list(panel(r, "תכנון פיקוחים")).length, 8); assert.equal(list(panel(r, "המלצות תצפיתן לפיקוח")).length, 8); assert.equal(list(panel(r, "עומס מפקחים")).length, 8); assert.ok(r.data.regionRows.some((v) => v.city === "לא משויך"));
  for (const city of r.data.regionRows) { const members = data[13].filter((g) => String(g.city ?? "לא משויך") === city.city); const scores = members.map((g) => Number(g.last_inspection_score ?? 0)).filter(Boolean); const mean = scores.length ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null; assert.equal(city.averageScore, mean); assert.equal(city.riskScore, domain.buildInspectionRiskScore({ incidents: 0, complaints: city.complaints, unresolvedFindings: city.findings, observerAlerts: city.observer, overdueInspections: city.overdue, complianceScore: mean })); }
});
test("actual domain thresholds/lifecycle/human-review policy and navigation", async () => { assert.deepEqual([61, 62, 81, 82].map(domain.inspectionTone), ["bad", "warn", "warn", "good"]); assert.deepEqual(plain(domain.inspectionLifecycle), ["planned", "assigned", "in_progress", "completed", "follow_up", "verified"]); assert.equal(domain.buildInspectionRiskScore({ incidents: 0, complaints: 0, unresolvedFindings: 0, observerAlerts: 0, overdueInspections: 0, complianceScore: null }), 8); const r = await page(); assert.ok(r.text.includes("המלצות תצפיתן לבדיקה אנושית בלבד")); assert.ok(r.text.includes("השיוך הקיים בגן נשמר כמקור אמת תפעולי")); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/inspections", "/dashboard/admin/inspections/late", "/dashboard/admin/inspectors", "/dashboard/admin/complaints", "/dashboard/admin/observer-calibration", "/dashboard/admin/reports"]); });
test("one distinct domain hook", () => { const c = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = c.domain.filter((v) => v.name === "national-inspections-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-national-inspections-query-boundary.mjs"]); });
