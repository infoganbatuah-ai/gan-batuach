import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Actual page, safe helper and domain; fixed-clock synthetic read-only clients/JSX.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ts = createRequire(path.join(root, "package.json"))("typescript");
const source = (p) => fs.readFileSync(path.join(root, p), "utf8");
function compile(s) { const r = ts.transpileModule(s, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const codes = ["app/dashboard/admin/scale-validation/page.tsx", "lib/admin-safe.ts", "lib/domain/multi-kindergarten-scale.ts"].map((p) => compile(source(p)));
codes[0] += "\nexports.qaFormatters={countByGarden,sumByGarden,pct,todayIsoDate,weekAgoIso};";
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-04T12:00:00.000Z"])); } static now() { return new Date("2026-11-04T12:00:00.000Z").getTime(); } }
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  [
    "gardens",
    [
      [
        "select",
        "id,name,city,status,safe_status,manager_id,inspector_id,current_children_count,staff_count,created_at"
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
    "profiles",
    [
      [
        "select",
        "id,role,garden_id,active,last_login_at"
      ],
      [
        "limit",
        2000
      ]
    ]
  ],
  [
    "parents",
    [
      [
        "select",
        "id,profile_id,garden_id,status,completed_profile,created_at"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "staff",
    [
      [
        "select",
        "id,profile_id,garden_id,approved_to_work,onboarding_status,created_at"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "children",
    [
      [
        "select",
        "id,garden_id,status,created_at"
      ],
      [
        "limit",
        5000
      ]
    ]
  ],
  [
    "parent_kindergarten_links",
    [
      [
        "select",
        "id,parent_profile_id,garden_id,status"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "camera_streams",
    [
      [
        "select",
        "id,garden_id,status,stream_status,health_status,active,deployment_scope,test_site_type"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "inspections",
    [
      [
        "select",
        "id,garden_id,inspector_id,status,completed_at,created_at"
      ],
      [
        "gte",
        "created_at",
        "2026-10-28T12:00:00.000Z"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "required_inspections",
    [
      [
        "select",
        "id,garden_id,inspector_id,status,due_at"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "ai_events",
    [
      [
        "select",
        "id,garden_id,severity,status,created_at"
      ],
      [
        "gte",
        "created_at",
        "2026-10-28T12:00:00.000Z"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "notifications",
    [
      [
        "select",
        "id,garden_id,recipient_role,read_at,created_at"
      ],
      [
        "gte",
        "created_at",
        "2026-10-28T12:00:00.000Z"
      ],
      [
        "limit",
        5000
      ]
    ]
  ],
  [
    "video_stream_sessions",
    [
      [
        "select",
        "id,garden_id,viewer_role,created_at"
      ],
      [
        "gte",
        "created_at",
        "2026-10-28T12:00:00.000Z"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "documents",
    [
      [
        "select",
        "id,garden_id,status,created_at"
      ],
      [
        "gte",
        "created_at",
        "2026-10-28T12:00:00.000Z"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "attendance",
    [
      [
        "select",
        "id,garden_id,status,attendance_date,updated_at"
      ],
      [
        "eq",
        "attendance_date",
        "2026-11-04"
      ],
      [
        "limit",
        5000
      ]
    ]
  ],
  [
    "child_daily_journals",
    [
      [
        "select",
        "id,garden_id,journal_date,updated_at"
      ],
      [
        "eq",
        "journal_date",
        "2026-11-04"
      ],
      [
        "limit",
        5000
      ]
    ]
  ],
  [
    "tasks",
    [
      [
        "select",
        "id,garden_id,status,created_at,completed_at"
      ],
      [
        "gte",
        "created_at",
        "2026-10-28T12:00:00.000Z"
      ],
      [
        "limit",
        3000
      ]
    ]
  ],
  [
    "pilot_usage_analytics",
    [
      [
        "select",
        "id,garden_id,role_key,daily_active_users,login_count,feature_key,feature_usage_count,screen_views,onboarding_completion_percent,usage_date"
      ],
      [
        "gte",
        "usage_date",
        "2026-11-04"
      ],
      [
        "limit",
        1000
      ]
    ]
  ],
  [
    "performance_readiness_checks",
    [
      [
        "select",
        "id,check_key,health_area,status,latest_value,threshold_value,checked_at,recommended_action"
      ],
      [
        "limit",
        200
      ]
    ]
  ],
  [
    "pilot_issues",
    [
      [
        "select",
        "id,garden_id,severity,status,affected_role,title"
      ],
      [
        "limit",
        1000
      ]
    ]
  ],
  [
    "kindergarten_onboarding_records",
    [
      [
        "select",
        "id,garden_id,status,progress_percent,submitted_at,completed_at"
      ],
      [
        "limit",
        1000
      ]
    ]
  ],
  [
    "gardens",
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
    "gardens",
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
          "active",
          "safe",
          "approved"
        ]
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
        "in",
        "role",
        [
          "manager",
          "owner"
        ]
      ],
      [
        "eq",
        "active",
        true
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
  ]
];
const garden='garden-a';const fixtures=[
[{id:garden,name:'SYNTHETIC_GARDEN',city:'CITY_A',status:'active',current_children_count:9,staff_count:3}],
[{id:'profile-a',role:'manager',garden_id:garden,active:true}],
[{id:'parent-a',garden_id:garden,status:'active'}],
[{id:'staff-a',garden_id:garden,approved_to_work:true}],
[{id:'child-a',garden_id:garden,status:'active'}],
[{id:'link-a',garden_id:garden,status:'active'}],
[{id:'camera-a',garden_id:garden,status:'offline',health_status:'unhealthy',active:true}],
[{id:'inspection-a',garden_id:garden,status:'completed'}],
[{id:'required-a',garden_id:garden,status:'open'}],
[{id:'event-a',garden_id:garden,severity:'high',status:'open'}],
[{id:'notification-a',garden_id:garden,recipient_role:'parent',read_at:'2026-11-04'}],
[{id:'video-a',garden_id:garden,viewer_role:'parent'}],
[{id:'document-a',garden_id:garden,status:'approved'}],
[{id:'attendance-a',garden_id:garden,status:'present'}],
[{id:'journal-a',garden_id:garden}],
[{id:'task-a',garden_id:garden,status:'completed'}],
[{id:'usage-a',garden_id:garden,role_key:'manager',feature_usage_count:3,screen_views:5}],
[{id:'performance-a',check_key:'SYNTHETIC_API',health_area:'api',status:'degraded',latest_value:90},{id:'performance-b',check_key:'SYNTHETIC_DB',health_area:'database',status:'degraded',latest_value:80}],
[{id:'issue-a',garden_id:garden,title:'SYNTHETIC_ISSUE',severity:'high',status:'open'}],
[{id:'onboarding-a',garden_id:garden,status:'completed',progress_percent:100}]
];
async function page({ failures = {}, data = fixtures, counts = [5, 3, 3, 1], empty = false, nullData = false, loader = false, deny = false } = {}) {
  let clients = 0, captured, rowSettled = 0; const chains = [], warnings = [], actual = load(codes[1], unexpected, warnings), domain = load(codes[2], unexpected);
  const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
  const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); if (i >= 20) assert.equal(rowSettled, 20, "count phase waits all row outcomes"); chains.push([table, calls]); for (const m of ["select", "order", "limit", "gte", "eq", "in"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { const f = failures[i]; if (i < 20) rowSettled++; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ data: nullData ? null : empty || f && !f.stale ? [] : data[i] ?? [], count: empty ? 0 : counts[i - 20] ?? null, error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
  const p = load(codes[0], (id) => {
    if (id === "react/jsx-runtime") return { jsx, jsxs: jsx }; if (id === "next/link") return { __esModule: true, default: "Link" };
    if (id === "lucide-react" || id.startsWith("@/components/")) return new Proxy({}, { get: (_, k) => String(k) });
    if (id === "@/lib/admin-safe") return helper; if (id === "@/lib/domain/multi-kindergarten-scale") return domain;
    if (id === "@/lib/auth") return { requireRole: async (roles) => { assert.deepEqual(Array.from(roles), ["admin"]); assert.equal(clients, 0); assert.equal(chains.length, 0); if (deny) throw Error("DENIED"); } };
    if (id === "@/lib/supabase/server") return { createClient: async () => { clients++; if (loader) throw Error("PRIVATE_LOADER"); return client; } }; return unexpected(id);
  }, warnings);
  if (deny) { await assert.rejects(p.default(), /DENIED/); assert.equal(clients, 0); assert.equal(chains.length, 0); return; }
  const tree = await p.default(); assert.equal(nodes(tree, "form").length, 0);
  return { tree, text: text(tree), clients, chains, warnings, data: captured.data, formatters: p.qaFormatters, domain, banner: nodes(tree, "AdminDataError")[0].props.message, hero: nodes(tree, "PremiumDashboardHero")[0].props, metrics: nodes(tree, "RoleMetricCard").map((n) => n.props), grid: nodes(tree).find((n) => n.props?.className === "scale-score-grid"), rows: nodes(tree, "Link").filter((n) => n.props.className === "scale-comparison-row") };
}
const panel = (r, title) => nodes(r.tree, "article").find((n) => text(nodes(n, "h2")).includes(title));
const tile = (r, label) => nodes(r.grid, "article").find((n) => text(nodes(n, "span")) === label);
const tileValue = (r, label) => text(nodes(tile(r, label), "strong"));
const componentDeps = { tenantCoverage: [21, 22, 23, 2, 3, 4], performanceScore: [17], stabilityScore: [9, 18], onboardingScore: [19], adoptionScore: [10, 11, 13, 14, 16], cameraScore: [6] };
const componentLabels = { performanceScore: "ביצועים", stabilityScore: "יציבות", onboardingScore: "קליטה", adoptionScore: "אימוץ", cameraScore: "מצלמות" };
const rowDeps = { kids: [4], staffTotal: [3], parents: [2, 5], activeCameras: [6], offlineCameras: [6], inspections: [7], openRequired: [8], observerEvents: [9], parentSignals: [10, 11, 12], staffSignals: [13, 14, 15], managerSignals: [16], health: [6, 8, 9] };
const healthyRow = { kids: 1, staffTotal: 1, parents: 2, activeCameras: 1, offlineCameras: 1, inspections: 1, openRequired: 1, observerEvents: 1, parentSignals: 3, staffSignals: 3, managerSignals: 3, health: 75 };
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE")); assert.ok(!String(r.banner).includes("טבלאות")); assert.ok(!String(r.banner).includes("מיגרציה")); }
function isolation(r) { assert.ok(tileValue(r, "בידוד לקוחות").includes("לא אומת")); assert.ok(!tileValue(r, "בידוד לקוחות").includes("100%")); const p = panel(r, "Tenant isolation audit"); assert.equal(nodes(p, "StatusBadge").length, 4); for (const n of nodes(p, "StatusBadge")) { assert.equal(n.props.tone, "default"); assert.equal(text(n), "לא אומת"); } assert.ok(!r.text.includes("Scoped")); for (const row of r.domain.tenantIsolationAudit) for (const k of ["role", "scope", "evidence"]) assert.ok(text(p).includes(row[k])); assert.ok(r.metrics[0].hint.includes("מודל")); }
function dependencies(r, failed = []) {
  const missing = (ds) => ds.some((i) => failed.includes(i)), known = (ds, v) => missing(ds) ? "לא זמין" : v;
  const aggregate = Object.entries(componentDeps).filter(([k]) => k !== "cameraScore").every(([, ds]) => !missing(ds));
  assert.equal(r.metrics[0].value, aggregate ? `${r.data.readiness.readinessScore}/100` : "לא זמין"); assert.equal(r.hero.badge, r.metrics[0].value); assert.equal(r.hero.badgeTone, aggregate ? r.data.readiness.tone : "default");
  assert.deepEqual(r.metrics.slice(1).map((m) => m.value), [`${known([21], 3)}/${known([20], 5)}`, known([22, 23, 2, 3], 6), known([6], "0/1"), known([7], 1), known([9], 1), known([18], 1), known([17], 2)]);
  assert.deepEqual(r.metrics.slice(1).map((m) => m.tone), [missing([20, 21]) ? "default" : "warn", missing([22, 23, 2, 3, 4]) ? "default" : "good", missing([6]) ? "default" : "warn", missing([7, 8]) ? "default" : "warn", missing([9]) ? "default" : "good", missing([18]) ? "default" : "bad", missing([17]) ? "default" : "warn"]);
  assert.equal(r.metrics[2].hint, `${known([4], 1)} ילדים`); assert.equal(r.metrics[3].hint, known([6], "1 לא תקינות")); assert.equal(r.metrics[4].hint, known([8], "1 דרישות פתוחות"));
  for (const [k, label] of Object.entries(componentLabels)) assert.equal(tileValue(r, label), known(componentDeps[k], `${r.data.readiness[k]}%`));
  assert.deepEqual(Array.from(r.data.availability), Array.from({ length: 24 }, (_, i) => !failed.includes(i)));
  if (failed.includes(0)) { assert.equal(r.rows.length, 0); assert.equal(r.data.comparison.length, 0); assert.ok(r.text.includes("השוואת גנים: לא זמין")); } else { assert.equal(r.rows.length, 1); const row = r.data.comparison[0]; for (const [k, ds] of Object.entries(rowDeps)) assert.equal(row[k], missing(ds) ? null : healthyRow[k], k); const badge = nodes(r.rows[0], "StatusBadge")[0]; assert.equal(badge.props.tone, missing([6, 8, 9]) ? "default" : r.domain.scaleTone(75)); assert.equal(text(badge), missing([6, 8, 9]) ? "לא זמין" : "75/100"); const adoptionText = nodes(r.rows[0], "span").map(text).at(-1); assert.equal(adoptionText, known([10, 11, 12, 13, 14, 15, 16], "9")); }
  assert.equal(text(panel(r, "Parent activity")), ` Parent activity${known([10], 1)} התראות נפתחו · ${known([11], 1)} צפיות מצלמה · ${known([12], 1)} פעולות מסמכים.`);
  assert.ok(text(panel(r, "Staff activity")).includes(`${known([13], 1)} עדכוני נוכחות · ${known([14], 1)} עדכוני ילדים · ${known([15], 1)} משימות הושלמו.`));
  assert.ok(text(panel(r, "Manager activity")).includes(`${known([16], 3)} פעולות ניהול`));
  assert.equal(text(panel(r, "Performance readiness")).includes("Performance readiness: לא זמין"), failed.includes(17)); isolation(r);
}
test("healthy actual page/helper/domain24exactchains and originalformula", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); assert.equal(r.hero.badge, "92/100"); assert.deepEqual(plain(r.data.readiness), plain(r.domain.buildScaleReadinessScore({ activeGardens: 3, totalGardens: 5, managers: 3, inspectors: 1, parents: 1, staff: 1, children: 1, unresolvedIsolationChecks: 0, slowApiChecks: 1, slowDashboardChecks: 1, activeCameras: 0, offlineCameras: 1, observerEvents: 1, openIssues: 1, onboardingCompleted: 1, onboardingTotal: 1, activeParentSignals: 2, activeStaffSignals: 2, activeManagerSignals: 3 }))); });
for (let index = 0; index < 24; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${index} ${kind}/${stale ? "stale" : "empty"} independentlysettles`, async () => { const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.equal(r.warnings.length, 1); });
for (const failed of [[0, 17], [2, 5], [3, 4], [6, 8], [7, 8], [9, 18], [10, 11], [12, 15], [13, 14], [16, 19], [20, 21], [22, 23], [1, 6]]) test(`paired${failed} preservesindependent fields`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
test("healthyempty/null preserves exact originalmodel/default72 without falseisolationproof", async () => { for (const nullData of [false, true]) { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.deepEqual(r.metrics.map((m) => m.value), ["61/100", "0/0", 0, "0/0", 0, 0, 0, 0]); assert.equal(tileValue(r, "מצלמות"), "72%"); assert.equal(tileValue(r, "קליטה"), "0%"); assert.equal(tileValue(r, "ביצועים"), "100%"); assert.equal(nodes(r.tree, "EmptyState")[0].props.title, "אין גנים להשוואה"); assert.ok(text(panel(r, "Performance readiness")).includes("אין בדיקות ביצועים רשומות עדיין.")); isolation(r); } });
test("loader allfail denied failclosed without deleting healthy proof", async () => { const all = Array.from({ length: 24 }, (_, i) => i); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); assert.ok(r.banner); const f = await page({ failures: Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(f); dependencies(f, all); await page({ deny: true }); });
test("onboarding rows choose own denominator and emptyonly uses healthyactivecount", async () => { const data = structuredClone(fixtures); data[19] = [{ status: "completed" }, { status: "active" }, { status: "pending", progress_percent: "100" }, { status: "pending", progress_percent: 0 }]; const r = await page({ data, failures: { 21: { kind: "reject" } } }); assert.equal(tileValue(r, "קליטה"), "75%"); data[19] = []; assert.equal(tileValue(await page({ data }), "קליטה"), "0%"); assert.equal(tileValue(await page({ data, failures: { 21: { kind: "reject" } } }), "קליטה"), "לא זמין"); assert.equal(tileValue(await page({ failures: { 19: { kind: "reject" } } }), "קליטה"), "לא זמין"); });
test("rowhealthyempty usesgardenfallback but primaryfailure doesnot", async () => { const data = structuredClone(fixtures); data[3] = []; data[4] = []; const r = await page({ data }); assert.equal(r.data.comparison[0].kids, 9); assert.equal(r.data.comparison[0].staffTotal, 3); for (const [i, k] of [[3, "staffTotal"], [4, "kids"]]) { const f = await page({ data, failures: { [i]: { kind: "reject" } } }); assert.equal(f.data.comparison[0][k], null); } data[0][0].current_children_count = 0; data[0][0].staff_count = "0"; const z = await page({ data }); assert.equal(z.data.comparison[0].kids, 0); assert.equal(z.data.comparison[0].staffTotal, 0); });
test("global activity and rowactivity keepdistinct filters/counts/sums", async () => { const data = structuredClone(fixtures), g = "garden-a"; data[6] = [{ garden_id: g, active: false, status: "healthy" }, { garden_id: g, active: true, status: "offline" }, { garden_id: g, active: true, status: "healthy", health_status: "unhealthy" }]; data[7] = [{ garden_id: g, status: "open" }, { garden_id: g, status: "completed" }]; data[8] = ["open", "done", "completed"].map((status) => ({ garden_id: g, status })); data[10] = [{ garden_id: g, recipient_role: "staff", read_at: "x" }, { garden_id: g, recipient_role: "parent", read_at: "x" }, { garden_id: g, recipient_role: "parent", read_at: null }]; data[11] = [{ garden_id: g, viewer_role: "staff" }, { garden_id: g, viewer_role: "parent" }]; data[13] = ["not_updated", "absent", "present"].map((status) => ({ garden_id: g, status })); data[15] = [{ garden_id: g, status: "done" }, { garden_id: g, status: "pending", completed_at: "x" }, { garden_id: g, status: "pending" }]; data[16] = [{ garden_id: g, role_key: "manager", screen_views: 9 }, { garden_id: g, role_key: "manager", feature_usage_count: "0", screen_views: 90 }, { garden_id: g, role_key: "parent", feature_usage_count: 200 }]; const r = await page({ data }), row = r.data.comparison[0]; assert.equal(r.data.activeCameraCount, 1); assert.equal(r.data.offlineCameraCount, 2); assert.equal(row.activeCameras, 2); assert.equal(row.offlineCameras, 2); assert.equal(r.data.requiredInspections, 3); assert.equal(row.openRequired, 1); assert.equal(row.inspections, 2); assert.equal(r.data.notificationsOpened, 2); assert.equal(r.data.cameraViews, 2); assert.equal(row.parentSignals, 4); assert.equal(r.data.attendanceUpdates, 3); assert.equal(r.data.completedTasks, 2); assert.equal(row.staffSignals, 4); assert.equal(r.data.managerUsage, 9); assert.equal(row.managerSignals, 0); assert.equal(row.health, 61); });
test("issue filters/performance areas original formula no reweight", async () => { const data = structuredClone(fixtures); data[18] = ["verified", "accepted_risk", "open", "closed"].flatMap((status) => ["low", "high", "critical"].map((severity) => ({ status, severity }))); data[17] = ["api", "database", "storage"].flatMap((health_area) => ["degraded", "offline", "healthy"].map((status) => ({ health_area, status }))); const r = await page({ data }); assert.equal(r.metrics[6].value, 4); assert.equal(r.metrics[7].value, 6); assert.equal(tileValue(r, "ביצועים"), "56%"); assert.equal(tileValue(r, "יציבות"), "50%"); });
test("comparison12 performance8 independentlycapped ordered and no extraquery", async () => { const data = structuredClone(fixtures); data[0] = Array.from({ length: 15 }, (_, i) => ({ id: `g${i}`, name: `GARDEN_${i}` })); data[17] = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, check_key: `PERF_${i}`, status: "healthy" })); const r = await page({ data }); assert.equal(r.rows.length, 12); assert.deepEqual(r.rows.map((n) => n.key), data[0].slice(0, 12).map((v) => v.id)); assert.equal(nodes(panel(r, "Performance readiness"), "StatusBadge").length, 8); assert.equal(r.chains.length, 24); const f = await page({ data, failures: { 0: { kind: "reject" } } }); assert.equal(f.rows.length, 0); assert.equal(nodes(panel(f, "Performance readiness"), "StatusBadge").length, 8); });
test("actuallocalhelpers/domain thresholds/date/statuses/navigation and onehook", async () => { const r = await page(), f = r.formatters; assert.deepEqual(plain(f.countByGarden([{ garden_id: "g" }, { garden_id: "g" }, {}, { garden_id: "x" }])), { g: 2, x: 1 }); assert.deepEqual(plain(f.sumByGarden([{ garden_id: "g", v: "3" }, { garden_id: "g", v: 0 }, { garden_id: "g" }], "garden_id", "v")), { g: 3 }); assert.equal(f.pct(1, 3), 33); assert.equal(f.pct(1, 0), 0); assert.equal(f.todayIsoDate(), "2026-11-04"); assert.equal(f.weekAgoIso(), "2026-10-28T12:00:00.000Z"); assert.deepEqual([61, 62, 81, 82].map(r.domain.scaleTone), ["bad", "warn", "warn", "good"]); for (const v of ["critical", "high", "failed", "blocked", "bad"]) assert.equal(r.domain.scaleTone(v), "bad"); for (const v of ["partial", "warn", "medium", "pending", "not_tested"]) assert.equal(r.domain.scaleTone(v), "warn"); for (const v of ["healthy", "unknown", "degraded"]) assert.equal(r.domain.scaleTone(v), "good"); assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), ["/dashboard/admin/customer-success", "/dashboard/admin/pilot-health", "/dashboard/admin/camera-deployment", "/dashboard/admin/observer-calibration", "/dashboard/admin/security-center", "/dashboard/admin/launch-readiness"]); assert.ok(r.text.includes("ללא שינוי הרשאות")); assert.ok(r.text.includes("ללא פיצ׳רים ניסיוניים")); const c = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = c.domain.filter((v) => v.name === "scale-validation-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-scale-validation-query-boundary.mjs"]); });
