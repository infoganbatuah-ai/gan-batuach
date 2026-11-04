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
const pageCode = compile(source("app/dashboard/admin/company-operations/page.tsx")) + "\nexports.qaFormatters={money,label,scoreTone,statusTone};", helperCode = compile(source("lib/admin-safe.ts"));
function unexpected(id) { throw Error(`UNEXPECTED_IMPORT_OR_EFFECT:${id}`); }
class FixedDate extends Date { constructor(...a) { super(...(a.length ? a : ["2026-11-04T12:00:00.000Z"])); } static now() { return new Date("2026-11-04T12:00:00.000Z").getTime(); } }
function load(code, require, warnings = []) { const exports = {}; vm.runInNewContext(code, { exports, require, Date: FixedDate, Intl, fetch: unexpected, process: { env: {} }, console: { warn: (...a) => warnings.push(a) } }); return exports; }
const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
const plain = (v) => JSON.parse(JSON.stringify(v));
function nodes(v, t) { if (!v || typeof v !== "object") return []; if (Array.isArray(v)) return v.flatMap((x) => nodes(x, t)); return [...(t === undefined || v.type === t ? [v] : []), ...Object.values(v.props ?? {}).flatMap((x) => nodes(x, t))]; }
function text(v) { if (v == null || typeof v === "boolean" || typeof v === "function") return ""; if (typeof v !== "object") return String(v); return Array.isArray(v) ? v.map(text).join("") : text(v.props?.children); }
const expected = [
  [
    "company_customer_lifecycle",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "product_type"
      ],
      [
        "order",
        "lifecycle_stage"
      ],
      [
        "limit",
        100
      ]
    ]
  ],
  [
    "product_releases",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "planned_date",
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
    "product_roadmap_items",
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
        "created_at",
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
    "customer_feedback_loop",
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
    "production_incident_response",
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
        50
      ]
    ]
  ],
  [
    "post_launch_monitoring",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "monitor_area"
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "launch_communication_templates",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "audience"
      ],
      [
        "order",
        "template_type"
      ],
      [
        "limit",
        80
      ]
    ]
  ],
  [
    "final_production_readiness_scores",
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
    "final_launch_blockers",
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
        "limit",
        30
      ]
    ]
  ],
  [
    "provider_production_health_metrics",
    [
      [
        "select",
        "*"
      ],
      [
        "order",
        "integration_type"
      ],
      [
        "limit",
        50
      ]
    ]
  ],
  [
    "support_tickets",
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
        "in",
        "(resolved,closed)"
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
    "observer_sites",
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
    "subscriptions",
    [
      [
        "select",
        "status,monthly_amount,amount,price"
      ],
      [
        "limit",
        500
      ]
    ]
  ],
  [
    "observer_site_subscriptions",
    [
      [
        "select",
        "subscription_status,monthly_price,annual_price"
      ],
      [
        "limit",
        500
      ]
    ]
  ]
];
const fixtures=[[{"id": "lifecycle", "customer_name": "SYNTHETIC_CUSTOMER", "product_type": "observer", "lifecycle_stage": "active", "health_score": 80}], [{"id": "release", "release_name": "SYNTHETIC_RELEASE", "status": "planned", "release_type": "maintenance", "owner": "SYNTHETIC_OWNER"}], [{"id": "roadmap", "title": "SYNTHETIC_ROADMAP", "priority": "high", "status": "open"}], [{"id": "feedback", "feedback_source": "admin", "feedback_summary": "SYNTHETIC_FEEDBACK", "product_type": "observer", "status": "open"}], [{"id": "incident", "title": "SYNTHETIC_INCIDENT", "severity": "high", "status": "open", "mitigation": "human_review"}], [{"id": "monitor", "monitor_area": "SYNTHETIC_MONITOR", "status": "watching"}], [{"id": "template", "subject": "SYNTHETIC_TEMPLATE", "audience": "admin", "template_type": "plan", "status": "planned"}], [{"id": "score", "company_readiness_score": 88}], [{"id": "blocker", "title": "SYNTHETIC_BLOCKER", "severity": "critical", "status": "open"}], [{"id": "provider", "integration_type": "SYNTHETIC_PROVIDER", "provider_status": "degraded"}], [], [], [], [], [], [{"status": "active", "monthly_amount": 800}, {"status": "trialing", "amount": 300}, {"status": "cancelled", "price": 500}], [{"subscription_status": "active", "monthly_price": 700}, {"subscription_status": "trial", "monthly_price": 200}, {"subscription_status": "cancelled", "monthly_price": 500}]];

const actionLinks = ["/dashboard/admin/customer-success", "/dashboard/admin/security-center", "/dashboard/admin/provider-production", "/dashboard/admin/billing", "/dashboard/admin/inspection-workforce", "/dashboard/admin/camera-infrastructure"];
const names = ["lifecycles", "releases", "roadmap", "feedback", "incidents", "monitoring", "templates", "finalScores", "blockers", "providerHealth", "supportTickets", "inspectionsDue", "overdueInspections", "activeGardens", "observerSites", "subscriptions", "observerSubscriptions"];
const displayNames = ["Customer lifecycles", "Monthly releases", "Roadmap items", "Customer feedback", "Incident response", "Post-launch monitoring", "Launch templates"];
async function page({ failures = {}, data = fixtures, counts = { 10: 7, 11: 8, 12: 2, 13: 5, 14: 4 }, empty = false, nullData = false, loader = false, deny = false } = {}) {
 let clients = 0, captured; const chains = [], warnings = [], actual = load(helperCode, unexpected, warnings);
 const helper = { ...actual, safeAdminData: async (...a) => { captured = await actual.safeAdminData(...a); return captured; } };
 const client = { from(table) { const i = chains.length, calls = [], q = {}; assert.equal(table, expected[i]?.[0]); chains.push([table, calls]); for (const m of ["select", "order", "limit", "not", "neq", "lt", "in"]) q[m] = (...a) => { calls.push([m, ...a]); return q; }; q.then = (a, b) => { assert.equal(chains.length, 17, "one concurrent query batch"); const f = failures[i]; return (f?.kind === "reject" ? Promise.reject(Error("PRIVATE_SENTINEL")) : Promise.resolve({ count: empty ? 0 : counts[i] ?? null, data: nullData ? null : empty || f && !f.stale ? [] : data[i], error: f ? { message: "PRIVATE_SENTINEL" } : null })).then(a, b); }; return q; } };
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
const money = (v) => new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(Number(v ?? 0));


const healthyValues = [5, 4, money(1100), money(900), 7, 8, 1, 1], healthyTones = ["good", "good", "good", "good", "default", "bad", "warn", "bad"], deps = [[13], [14], [15], [16], [10], [11], [4], [9]];
function contracts(r) { assert.equal(r.clients, 1); assert.deepEqual(plain(r.chains), expected); assert.ok(!r.text.includes("PRIVATE")); assert.ok(!JSON.stringify(r.warnings).includes("PRIVATE")); assert.ok(!String(r.banner).includes("מיגרציה")); }
const emptyStates = (r) => nodes(r.tree, "EmptyState").map((n) => n.props);
function dependencies(r, failed = []) {
 const missing = (ds) => ds.some((i) => failed.includes(i));
 assert.deepEqual(r.metrics.map((m) => m.value), healthyValues.map((v, i) => missing(deps[i]) ? "לא זמין" : v));
 assert.deepEqual(r.metrics.map((m) => m.tone), healthyTones.map((v, i) => missing(i === 5 ? [11, 12] : deps[i]) ? "default" : v));
 assert.equal(r.hero.badge, failed.includes(7) ? "לא זמין" : "88/100"); assert.equal(r.hero.badgeTone, failed.includes(7) ? "default" : "good");
 assert.equal(r.metrics[5].hint, failed.includes(12) ? "לא זמין" : "2 overdue");
 for (let i = 0; i < 7; i++) { assert.equal(r.text.includes(`${displayNames[i]}: לא זמין`), failed.includes(i)); for (const row of fixtures[i]) assert.equal(nodes(r.tree).some((n) => n.key === row.id), !failed.includes(i)); }
 for (let i = 0; i < 17; i++) assert.equal(r.data.availability[names[i]], !failed.includes(i));
 assert.ok(section(r, "Roadmap & Feedback Loop").props.subtitle.startsWith(`High priority open items: ${failed.includes(2) ? "לא זמין" : 1}.`));
 assert.equal(r.text.includes("Launch blockers: לא זמין"), failed.includes(8)); assert.equal(nodes(r.tree).some((n) => n.key === "blocker"), !failed.includes(8)); assert.equal(emptyStates(r).some((n) => n.title === "אין חסמי השקה פתוחים"), false);
 assert.deepEqual(nodes(r.tree, "ActionCard").map((n) => n.props.href), actionLinks);
}
test("healthy17exactcontracts actualpage/sharedhelper", async () => { const r = await page(); contracts(r); dependencies(r); assert.equal(r.banner, null); });
for (let index = 0; index < 17; index++) for (const kind of ["returned", "reject"]) for (const stale of [false, true]) test(`source${index} ${kind}/${stale ? "stale" : "empty"} onlyown dependencies`, async () => { const r = await page({ failures: { [index]: { kind, stale } } }); contracts(r); dependencies(r, [index]); assert.ok(r.banner); assert.equal(r.warnings.length, 1); });
for (const failed of [[0, 1], [2, 3], [4, 9], [5, 6], [7, 8], [10, 11], [11, 12], [13, 14], [15, 16], [7, 15], [8, 16]]) test(`paired${failed} preservesindependentneighbors`, async () => { const r = await page({ failures: Object.fromEntries(failed.map((i, n) => [i, { kind: n ? "returned" : "reject", stale: true }])) }); contracts(r); dependencies(r, failed); });
for (const value of [0, "0", 62, 81, 82, null, undefined]) test(`snapshot${value} onlysource7`, async () => { const data = structuredClone(fixtures); data[7] = [{ company_readiness_score: value }]; const r = await page({ data, failures: { 4: { kind: "reject" }, 15: { kind: "returned" } } }); assert.equal(r.hero.badge, `${Number(value ?? 0)}/100`); assert.equal(r.hero.badgeTone, r.formatters.scoreTone(Number(value ?? 0))); assert.equal(r.metrics[3].value, money(900)); });
test("MRR originalstatuses/nullishprecedence/0/annualignored and streamindependence", async () => { const data = structuredClone(fixtures); data[15] = [{ status: "active", monthly_amount: 0, amount: 100, price: 900 }, { status: "trialing", monthly_amount: null, amount: "10.4", price: 800 }, { status: "active", price: 20.4 }, { status: "active" }, { status: "trial", monthly_amount: 700 }, { status: "paid_beta", amount: 600 }, { status: "cancelled", price: 999 }]; data[16] = [{ subscription_status: "active", monthly_price: "0", annual_price: 12000 }, { subscription_status: "trial", monthly_price: 11.4 }, { subscription_status: "paid_beta", monthly_price: 22.4 }, { subscription_status: "active", annual_price: 12000 }, { subscription_status: "trialing", monthly_price: 999 }, { subscription_status: "cancelled", monthly_price: 999 }]; const r = await page({ data }); assert.equal(r.metrics[2].value, money(30.8)); assert.equal(r.metrics[3].value, money(33.8)); for (const i of [15, 16]) { const f = await page({ data, failures: { [i]: { kind: "reject" } } }); assert.equal(f.metrics[i - 13].value, "לא זמין"); assert.equal(f.metrics[i - 13].tone, "default"); assert.equal(f.metrics[i === 15 ? 3 : 2].value, i === 15 ? money(33.8) : money(30.8)); } });
for (const value of [null, undefined, 0, "0"]) test(`healthyMRR${value} preserveszeroonlywhenhealthy`, async () => { const data = structuredClone(fixtures); data[15] = [{ status: "active", monthly_amount: value }]; data[16] = [{ subscription_status: "paid_beta", monthly_price: value }]; const r = await page({ data }); assert.deepEqual(r.metrics.slice(2, 4).map((m) => m.value), [money(0), money(0)]); assert.deepEqual(r.metrics.slice(2, 4).map((m) => m.tone), ["good", "good"]); });
test("countfields exactsupportthreshold and independentinspectionvalue/hint", async () => { for (const count of [0, 15, 16]) { const counts = { 10: count, 11: count, 12: 0, 13: 0, 14: 0 }; const r = await page({ counts }); assert.equal(r.metrics[4].value, count); assert.equal(r.metrics[4].tone, count > 15 ? "warn" : "default"); assert.equal(r.metrics[5].value, count); assert.equal(r.metrics[5].hint, "0 overdue"); assert.equal(r.metrics[5].tone, "warn"); assert.equal(r.metrics[0].tone, "warn"); assert.equal(r.metrics[1].tone, "warn"); const f = await page({ counts, failures: { 12: { kind: "reject" } } }); assert.equal(f.metrics[5].value, count); assert.equal(f.metrics[5].hint, "לא זמין"); assert.equal(f.metrics[5].tone, "default"); const d = await page({ counts, failures: { 11: { kind: "reject" } } }); assert.equal(d.metrics[5].value, "לא זמין"); assert.equal(d.metrics[5].hint, "0 overdue"); } });
test("exactincident/provider/roadmap/blockerstatusfilters do notsilentlyfiltervisiblelist", async () => { const data = structuredClone(fixtures); data[4] = ["resolved", "closed", "open", "mitigated"].map((status, i) => ({ id: `i${i}`, status })); data[9] = ["degraded", "failed", "healthy", "critical"].map((provider_status) => ({ provider_status })); data[2] = ["high", "critical", "low"].flatMap((priority) => ["released", "cancelled", "open", "closed"].map((status, i) => ({ id: `${priority}${i}`, priority, status }))); data[8] = ["verified", "closed", "accepted_risk", "open"].map((status, i) => ({ id: `blocker${i}`, status, title: `B_${i}` })); const r = await page({ data }); assert.equal(r.metrics[6].value, 2); assert.equal(r.metrics[7].value, 2); assert.ok(section(r, "Roadmap & Feedback Loop").props.subtitle.startsWith("High priority open items: 4.")); assert.deepEqual(nodes(section(r, "Launch Blockers Still Open")).filter((n) => String(n.key).startsWith("blocker")).map((n) => n.key), data[8].map((v) => v.id)); data[8] = data[8].slice(0, 3); const noOpen = await page({ data }); assert.ok(emptyStates(noOpen).some((n) => n.title === "אין חסמי השקה פתוחים")); const unavailable = await page({ data, failures: { 8: { kind: "returned", stale: true } } }); assert.ok(unavailable.text.includes("Launch blockers: לא זמין")); assert.ok(!emptyStates(unavailable).some((n) => n.title === "אין חסמי השקה פתוחים")); });
for (const nullData of [false, true]) test(`healthy${nullData ? "null" : "empty"} measureddefaults remain`, async () => { const r = await page({ empty: true, nullData }); contracts(r); assert.equal(r.banner, null); assert.equal(r.hero.badge, "0/100"); assert.equal(r.hero.badgeTone, "bad"); assert.deepEqual(r.metrics.map((m) => m.value), [0, 0, money(0), money(0), 0, 0, 0, 0]); assert.equal(r.metrics[5].hint, "0 overdue"); assert.ok(emptyStates(r).some((n) => n.title === "אין חסמי השקה פתוחים" && n.text.includes("אישור אנושי"))); });
test("loader/allfail/denied nevergreenunknown or noopenblockerclaim", async () => { const all = names.map((_, i) => i); const r = await page({ loader: true }); assert.equal(r.chains.length, 0); dependencies(r, all); assert.ok(r.banner); const f = await page({ failures: Object.fromEntries(all.map((i) => [i, { kind: i % 2 ? "reject" : "returned", stale: true }])) }); contracts(f); dependencies(f, all); await page({ deny: true }); });
test("formatter/statussets/thresholds/navigation/staticnotes and boundedorderedlists", async () => { const r = await page(), f = r.formatters; assert.equal(f.label("customer_feedback"), "customer feedback"); assert.equal(f.label(null), "לא ידוע"); for (const v of [null, 0, "0", 12.7]) assert.equal(f.money(v), money(v)); assert.deepEqual([61, 62, 81, 82].map(f.scoreTone), ["bad", "warn", "warn", "good"]); for (const s of [{"values": ["healthy", "ready", "approved", "released", "active", "closed", "mitigated", "resolved"], "tone": "good"}, {"values": ["planned", "in_progress", "qa", "watching", "open", "triaged", "roadmap_linked", "assigned"], "tone": "warn"}, {"values": ["failed", "degraded", "critical", "blocked", "at_risk", "churned", "detected"], "tone": "bad"}]) for (const v of s.values) assert.equal(f.statusTone(v), s.tone); const visible = r.text + r.hero.subtitle + nodes(r.tree, "CleanSection").map((n) => n.props.subtitle).join(" ") + nodes(r.tree, "ActionCard").map((n) => n.props.text).join(" "); for (const note of ["Monthly releases", "provider approval", "shadow mode", "בלי ערבוב בין גנים לבין אתרי תצפיתן", "separate revenue stream"]) assert.ok((visible + r.metrics.map((m) => m.hint).join(" ")).includes(note), note); assert.equal(nodes(r.tree, "ActionCard").length, 6); const data = structuredClone(fixtures); data[0] = Array.from({ length: 25 }, (_, i) => ({ id: `life${i}`, customer_name: `CUSTOMER_${i}` })); const many = await page({ data }); assert.deepEqual(nodes(section(many, "Customer Operations")).filter((n) => String(n.key).startsWith("life")).map((n) => n.key), data[0].map((v) => v.id)); const c = JSON.parse(source("config/digital-observer-ci-gates.json")), hooks = c.domain.filter((v) => v.name === "company-operations-query-boundary"); assert.equal(hooks.length, 1); assert.deepEqual(hooks[0].args, ["--test", "scripts/qa/check-company-operations-query-boundary.mjs"]); });
