import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const projectRequire = createRequire(resolve(process.cwd(), "package.json"));
const ts = projectRequire("typescript");
const source = readFileSync(resolve(process.cwd(), "app/dashboard/garden/operations/page.tsx"), "utf8");
const marker = (name) => Object.assign(function Marker() {}, { displayName: name });

function fixture({ context, failedTable } = {}) {
  const profile = { id: "owner-1", role: "owner", garden_id: "garden-a", full_name: "דנה כהן", profile_image_url: null };
  const allowedGardens = [{ id: "garden-a", name: "גן א", relationshipRole: "owner", isDefault: true }, { id: "garden-b", name: "גן ב", relationshipRole: "owner", isDefault: false }];
  const selectedContext = context ?? { available: true, gardens: allowedGardens, activeGarden: allowedGardens[1] };
  const calls = [];
  const query = (table) => {
    const filters = [];
    calls.push({ table, filters });
    const result = () => ({ data: table === "gardens" ? { id: "garden-b", name: "גן ב", city: "חיפה", approval_flow_status: "active" } : table === "camera_streams" ? [{ id: "camera-1", active: true, status: "online" }] : [], count: 0, error: table === failedTable ? { message: "simulated unavailable source" } : null });
    const chain = {
      select: () => chain,
      eq: (key, value) => { filters.push([key, value]); return chain; },
      neq: () => chain, is: () => chain, not: () => chain, in: () => chain,
      gte: () => chain, lte: () => chain, order: () => chain, limit: () => chain,
      maybeSingle: async () => result(),
      then: (yes, no) => Promise.resolve(result()).then(yes, no)
    };
    return chain;
  };
  const modules = {
    "react/jsx-runtime": projectRequire("react/jsx-runtime"),
    "next/link": { __esModule: true, default: marker("Link") },
    "next/navigation": { redirect: () => { throw Error("unexpected redirect"); } },
    "@/components/dashboard-shell": { DashboardShell: marker("DashboardShell") },
    "@/components/garden-context-switcher": { GardenContextSwitcher: marker("GardenContextSwitcher") },
    "@/components/manager-overview-dashboard": { ManagerOverviewDashboard: marker("ManagerOverviewDashboard") },
    "@/components/teacher-app-ui": { TeacherAppFrame: marker("TeacherAppFrame") },
    "@/lib/auth": { requireRole: async () => ({ profile }) },
    "@/lib/domain/display-label": { cleanSyntheticLabel: value => String(value ?? ""), isSyntheticLabel: () => false },
    "@/lib/domain/israel-date": { israelTodayDateKey: () => "2026-11-06" },
    "@/lib/management/active-garden-context": { resolveManagementGardenContext: async () => selectedContext },
    "@/lib/management/dashboard-read-model": {
      deriveAttendanceSummary: () => ({ present: 0, absent: 0, departed: 0, expected: 0, recorded: 0, completion: 0 }),
      deriveTuitionSummary: () => ({ outstanding: 0, overdue: 0, reconciliation: 0, currency: "ILS" }),
      safetyCapabilityState: ({ configuredCameraCount, providerReady }) => ({ state: providerReady ? "verified" : "readiness", label: `${configuredCameraCount} configured` })
    },
    "@/lib/supabase/server": { createClient: async () => ({ from: query }) }
  };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: id => { assert.ok(id in modules, `unexpected import ${id}`); return modules[id]; }, console, Intl, Date }, { timeout: 1000 });
  const find = (node, displayName) => {
    if (!node || typeof node !== "object") return null;
    if (node.type?.displayName === displayName) return node;
    if (node.type?.name === "OwnerDashboardState") return find(node.type(node.props), displayName);
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) { const found = find(child, displayName); if (found) return found; }
    return null;
  };
  return { page: exports.default, calls, find };
}

test("no selected authorized Garden renders a choice without querying or redirecting", async () => {
  const gardens = [{ id: "garden-a", name: "גן א", relationshipRole: "owner", isDefault: false }, { id: "garden-b", name: "גן ב", relationshipRole: "owner", isDefault: false }];
  const f = fixture({ context: { available: true, gardens, activeGarden: null } });
  const tree = await f.page();
  assert.ok(f.find(tree, "GardenContextSwitcher"));
  assert.equal(f.find(tree, "ManagerOverviewDashboard"), null);
  assert.equal(f.calls.length, 0);
});

test("authority unavailable and query failure never render confirmed zero metrics", async () => {
  for (const options of [{ context: { available: false, gardens: [], activeGarden: null } }, { failedTable: "tasks" }]) {
    const f = fixture(options); const tree = await f.page();
    assert.equal(f.find(tree, "ManagerOverviewDashboard"), null);
    assert.ok(f.find(tree, "TeacherAppFrame"));
  }
});

test("queries and displayed Garden use the authorized selected context, while camera DB status is not Live proof", async () => {
  const f = fixture(); const tree = await f.page();
  const dashboard = f.find(tree, "ManagerOverviewDashboard");
  assert.ok(dashboard);
  assert.equal(dashboard.props.garden.name, "גן ב");
  assert.equal(dashboard.props.safety.operationalCameras, 0);
  assert.equal(dashboard.props.safety.state, "readiness");
  assert.ok(f.calls.length >= 15);
  for (const call of f.calls) {
    const key = call.table === "gardens" ? "id" : "garden_id";
    if (call.table !== "messages") assert.ok(call.filters.some(([column, value]) => column === key && value === "garden-b"), `${call.table} must use selected Garden`);
  }
});
