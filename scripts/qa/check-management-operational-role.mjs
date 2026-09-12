import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const actorId = "00000000-0000-4000-8000-000000000101";
const gardenId = "00000000-0000-4000-8000-000000000102";
const api = { fail: (error, status) => Response.json({ error }, { status }) };

function load(file, dependencies) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    exports: module.exports,
    module,
    Response,
    console,
    require: id => {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      throw new Error(`Unmocked dependency: ${id}`);
    }
  }, { filename: file });
  return module.exports;
}

function fixture({ role = "staff", active = true, profile = {}, session, rows = {}, rpc = { data: true, error: null }, authThrows = false } = {}) {
  const resolvedSession = session ?? {
    user: { id: actorId },
    profile: { id: actorId, role, active, garden_id: gardenId, ...profile }
  };
  const calls = [];
  const query = table => {
    const builder = {
      select: () => builder,
      eq: (column, value) => { calls.push({ table, column, value }); return builder; },
      limit: () => builder,
      maybeSingle: async () => rows[table] ?? { data: null, error: null }
    };
    return builder;
  };
  const module = load("lib/management/operational-role.ts", {
    "next/navigation": { redirect: path => { throw new Error(`redirect:${path}`); } },
    "@/lib/api": api,
    "@/lib/auth": { getSessionProfile: async () => {
      if (authThrows) throw new Error("private auth detail");
      return resolvedSession;
    } },
    "@/lib/roles": {},
    "@/lib/management/active-garden-context": { resolveManagementGardenContext: async currentProfile => ({ available: true, gardens: [], activeGarden: currentProfile.garden_id ? { id: currentProfile.garden_id } : null }) },
    "@/lib/management/staff-employment-context": { resolveStaffEmploymentContext: async currentProfile => {
      if (rows.staff?.error || rows.staff_kindergarten_employments?.error) return { available: false };
      const staff = rows.staff?.data;
      const employment = rows.staff_kindergarten_employments?.data;
      const activeEmployment = staff?.approved_to_work && staff?.onboarding_status === "active" && employment
        ? { employment_id: employment.id, staff_id: staff.id, garden_id: currentProfile.garden_id, role_title: "צוות" } : null;
      return { available: true, employments: activeEmployment ? [activeEmployment] : [], activeEmployment };
    } },
    "@/lib/management/contact-verification": load("lib/management/contact-verification.ts", {}),
    "@/lib/supabase/server": { createClient: async () => ({
      from: query,
      rpc: async (name, params) => {
        calls.push({ table: "rpc", column: name, value: params.target_garden_id });
        return rpc;
      }
    }) }
  });
  return { module, calls };
}

async function expectDenied(options, allowedRoles, status, reason) {
  const f = fixture(options);
  const result = await f.module.getOperationalRoleContext(allowedRoles);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, reason);
  assert.equal(result.response.status, status);
  assert.doesNotMatch(await result.response.text(), /private|database|PGRST/i);
  return f;
}

test("active staff requires approved record and matching active employment", async () => {
  const f = fixture({ rows: {
    staff: { data: { id: "staff-1", approved_to_work: true, onboarding_status: "active" }, error: null },
    staff_kindergarten_employments: { data: { id: "employment-1" }, error: null }
  } });
  const result = await f.module.getOperationalRoleContext(["staff"]);
  assert.equal(result.allowed, true);
  assert.equal(result.gardenIds.length, 1);
  assert.equal(result.gardenIds[0], gardenId);
  assert.equal(result.employment.staff_id, "staff-1");
  assert.ok(f.calls.some(call => call.table === "rpc" && call.column === "can_staff_access_garden" && call.value === gardenId));
});

for (const [label, staff, reason] of [
  ["not approved", { id: "staff-1", approved_to_work: false, onboarding_status: "active" }, "staff_employment"],
  ["onboarding pending", { id: "staff-1", approved_to_work: true, onboarding_status: "pending_verification" }, "staff_employment"],
  ["missing staff record", null, "staff_employment"]
]) {
  test(`staff candidate is denied: ${label}`, async () => {
    await expectDenied({ rows: { staff: { data: staff, error: null } } }, ["staff"], 403, reason);
  });
}

test("staff without an active matching employment is denied", async () => {
  await expectDenied({ rows: {
    staff: { data: { id: "staff-1", approved_to_work: true, onboarding_status: "active" }, error: null },
    staff_kindergarten_employments: { data: null, error: null }
  } }, ["staff"], 403, "staff_employment");
});

test("active inspector requires approval, inspector identity, activation timestamp and assignment", async () => {
  const f = fixture({ role: "inspector", profile: { garden_id: null }, rows: {
    inspector_applications: { data: { id: "application-1", status: "approved", activated_at: "2026-09-07T00:00:00Z" }, error: null },
    inspectors: { data: { id: actorId }, error: null },
    gardens: { data: { id: gardenId }, error: null }
  } });
  const result = await f.module.getOperationalRoleContext(["inspector"]);
  assert.equal(result.allowed, true);
  assert.equal(result.gardenIds.length, 1);
  assert.equal(result.gardenIds[0], gardenId);
});

for (const [label, rows, reason] of [
  ["application still submitted", {
    inspector_applications: { data: { status: "submitted", activated_at: null }, error: null },
    inspectors: { data: null, error: null }, gardens: { data: null, error: null }
  }, "inspector_approval"],
  ["approval has no assignment", {
    inspector_applications: { data: { status: "approved", activated_at: "2026-09-07T00:00:00Z" }, error: null },
    inspectors: { data: { id: actorId }, error: null }, gardens: { data: null, error: null }
  }, "inspector_assignment"]
]) {
  test(`inspector candidate is denied: ${label}`, async () => {
    await expectDenied({ role: "inspector", profile: { garden_id: null }, rows }, ["inspector"], 403, reason);
  });
}

test("inactive profile is denied before lifecycle tables are queried", async () => {
  const f = await expectDenied({ active: false }, ["staff"], 403, "inactive");
  assert.equal(f.calls.length, 0);
});

test("new accounts missing either verified contact are denied before lifecycle queries", async () => {
  const f = await expectDenied({
    session: {
      user: { id: actorId, app_metadata: { contact_verification_required: true }, email_confirmed_at: "2026-09-08T00:00:00Z", phone_confirmed_at: null },
      profile: { id: actorId, role: "staff", active: true, garden_id: gardenId, contact_verification_required: true }
    }
  }, ["staff"], 403, "contact_verification");
  assert.equal(f.calls.length, 0);
});

test("unknown activation value is denied", async () => {
  const f = await expectDenied({ active: "true" }, ["staff"], 403, "inactive");
  assert.equal(f.calls.length, 0);
});

test("wrong role is denied before lifecycle tables are queried", async () => {
  const f = await expectDenied({ role: "parent" }, ["staff"], 403, "role");
  assert.equal(f.calls.length, 0);
});

test("missing or mismatched session identity is denied", async () => {
  await expectDenied({ session: { user: null, profile: null } }, ["staff"], 401, "session");
  await expectDenied({ profile: { id: "different-profile" } }, ["staff"], 401, "session");
});

test("lifecycle authority errors fail closed without private details", async () => {
  await expectDenied({ rows: { staff: { data: null, error: { message: "private database detail" } } } }, ["staff"], 503, "authority_unavailable");
  await expectDenied({ authThrows: true }, ["staff"], 503, "authority_unavailable");
});

test("other explicitly allowed active roles retain their existing route authorization", async () => {
  const f = fixture({ role: "admin", profile: { garden_id: null } });
  const result = await f.module.getOperationalRoleContext(["admin", "inspector"]);
  assert.equal(result.allowed, true);
  assert.equal(f.calls.length, 0);
});

test("manager and owner retain the GB-M02 database authority requirement", async () => {
  for (const role of ["manager", "owner"]) {
    const allowed = fixture({ role });
    const result = await allowed.module.getOperationalRoleContext(["manager", "owner", "staff"]);
    assert.equal(result.allowed, true);
    assert.ok(allowed.calls.some(call => call.table === "rpc" && call.column === "can_manage_garden" && call.value === gardenId));

    await expectDenied({ role, rpc: { data: false, error: null } }, ["manager", "owner", "staff"], 403, "role");
    await expectDenied({ role, rpc: { data: true, error: { message: "private database detail" } } }, ["manager", "owner", "staff"], 503, "authority_unavailable");
  }
});

test("operational pages route candidates to safe lifecycle screens", async () => {
  const pendingStaff = fixture({ rows: { staff: { data: null, error: null } } });
  await assert.rejects(
    pendingStaff.module.requireOperationalRole(["staff"]),
    /redirect:\/dashboard\/staff\/job-market/
  );

  const missingEmployment = fixture({ rows: {
    staff: { data: { id: "staff-1", approved_to_work: true, onboarding_status: "active" }, error: null },
    staff_kindergarten_employments: { data: null, error: null }
  } });
  await assert.rejects(
    missingEmployment.module.requireOperationalRole(["staff"]),
    /redirect:\/dashboard\/staff\/job-market/
  );

  const pendingInspector = fixture({ role: "inspector", profile: { garden_id: null }, rows: {
    inspector_applications: { data: { status: "submitted", activated_at: null }, error: null },
    inspectors: { data: null, error: null },
    gardens: { data: null, error: null }
  } });
  await assert.rejects(
    pendingInspector.module.requireOperationalRole(["inspector"]),
    /redirect:\/dashboard\/inspector\/apply/
  );
});

const operationalApiFiles = [
  "app/api/ai-camera-events/[id]/action/route.ts",
  "app/api/ai-events/[id]/action/route.ts",
  "app/api/assistant/summary/route.ts",
  "app/api/child-daily-journals/route.ts",
  "app/api/child-health-records/route.ts",
  "app/api/children/[id]/photo/route.ts",
  "app/api/daily-operational-tasks/route.ts",
  "app/api/dashboard/interaction-summary/route.ts",
  "app/api/garden/attendance-action/route.ts",
  "app/api/garden/children/[id]/operations/route.ts",
  "app/api/garden/day-close/route.ts",
  "app/api/incident-reports/route.ts",
  "app/api/gps-verification/route.ts",
  "app/api/inspections/[id]/report/route.ts",
  "app/api/inspections/[id]/submit/route.ts",
  "app/api/medicine-given-logs/route.ts",
  "app/api/tasks/[id]/escalate/route.ts",
  "app/api/tasks/[id]/status/route.ts",
  "app/api/smart-insights/[id]/status/route.ts",
  "app/api/unsafe-gardens/route.ts",
  "app/api/violations/[id]/status/route.ts"
];

test("every inventoried operational API checks activation before request payload or data access", () => {
  for (const file of operationalApiFiles) {
    const source = readFileSync(file, "utf8");
    const guard = source.indexOf("await getOperationalRoleContext(");
    assert.ok(guard >= 0, `${file}: missing operational guard`);
    const denial = source.indexOf("if (!access.allowed) return access.response", guard);
    assert.ok(denial > guard, `${file}: missing fail-closed return`);
    const payload = source.indexOf("request.json()", guard);
    const dataAccess = source.indexOf("await createClient()", guard);
    if (payload >= 0) assert.ok(denial < payload, `${file}: payload is processed before activation denial`);
    if (dataAccess >= 0) assert.ok(denial < dataAccess, `${file}: data is accessed before activation denial`);
  }
});

const candidateApiFiles = [
  "app/api/inspector/applications/route.ts",
  "app/api/staff/job-applications/route.ts",
  "app/api/staff/onboarding/route.ts"
];

test("candidate lifecycle APIs remain accessible to the candidate role", () => {
  for (const file of candidateApiFiles) {
    const source = readFileSync(file, "utf8");
    const hasCandidateRoleEntry = /requireRole\(\["(?:staff|inspector)"\]\)/.test(source)
      || (/getSessionProfile\(\)/.test(source) && /profile\.role !== "(?:staff|inspector)"/.test(source));
    assert.ok(hasCandidateRoleEntry, `${file}: candidate role entry missing`);
    assert.doesNotMatch(source, /getOperationalRoleContext/, `${file}: candidate flow was accidentally activation-gated`);
  }
});

const operationalStaffPages = [
  "app/dashboard/staff/page.tsx",
  ...["attendance", "cameras", "child-journal", "daily-journal", "incidents", "messages", "notifications", "operations", "shifts", "tasks"]
    .map(name => `app/dashboard/staff/${name}/page.tsx`)
];
const operationalInspectorPages = [
  "ai-events", "cameras", "command-center", "compliance", "inspections/due",
  "inspections/history", "inspections", "notifications", "observer-network",
  "observer-pilot", "ratings", "reports", "risk", "tasks", "violations"
].map(name => `app/dashboard/inspector/${name}/page.tsx`);

test("operational staff and inspector pages require activated role context", () => {
  for (const file of [...operationalStaffPages, ...operationalInspectorPages, "app/dashboard/inspector/page.tsx", "app/dashboard/tasks/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, file.includes("command-center") ? /await requireApprovedInspector\(/ : /await requireOperationalRole\(/, `${file}: missing Inspector page guard`);
  }
  assert.match(readFileSync("app/dashboard/inspector/control-center/page.tsx", "utf8"), /export \{ default \} from "\.\.\/command-center\/page"/);
});

const candidatePageFiles = [
  "app/onboarding/staff/page.tsx",
  "app/dashboard/staff/job-market/page.tsx",
  "app/dashboard/staff/settings/page.tsx",
  "app/dashboard/staff/documents/page.tsx",
  "app/dashboard/staff/background/page.tsx",
  "app/dashboard/staff/certificates/page.tsx",
  "app/dashboard/staff/access-pending/page.tsx",
  "app/dashboard/inspector/apply/page.tsx",
  "app/dashboard/inspector/settings/page.tsx"
];

test("candidate completion and application pages remain role-accessible", () => {
  for (const file of candidatePageFiles) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /await requireRole\(\["(?:staff|inspector)"\]\)/, `${file}: candidate page entry missing`);
    assert.doesNotMatch(source, /requireOperationalRole/, `${file}: candidate page was accidentally activation-gated`);
  }
});

test("staff approval waits for candidate acceptance and atomic employment activation", () => {
  const applicationApproval = readFileSync("app/api/garden/staff-applications/[id]/route.ts", "utf8");
  const hiringMigration = readFileSync("supabase/migrations/20260912070000_management_staff_hiring_lifecycle.sql", "utf8");
  assert.match(applicationApproval, /decide_staff_job_application/);
  assert.doesNotMatch(applicationApproval, /from\("staff_permanent_files"/);
  assert.match(hiringMigration, /awaiting_candidate_acceptance/);
  assert.match(hiringMigration, /activate_staff_employment/);
  assert.match(hiringMigration, /staff_kindergarten_employments/);
  assert.match(hiringMigration, /status='employed'/);

  const directApproval = readFileSync("app/api/garden/staff/[id]/approve/route.ts", "utf8");
  assert.match(directApproval, /from\("staff_kindergarten_employments"/);
  assert.match(directApproval, /employmentStatus = payload\.action === "approve" \? "active"/);
  assert.match(directApproval, /גישה התפעולית תישאר חסומה/);
});
