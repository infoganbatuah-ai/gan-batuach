import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260912030000_management_child_discovery_matching.sql");
const api = read("app/api/parent/garden-discovery/route.ts");
const service = read("lib/domain/child-garden-discovery.ts");
const page = read("app/dashboard/parent/discover-kindergartens/page.tsx");
const ts = createRequire(import.meta.url)("typescript");

function loadModule(source, dependencies = {}) {
  const exports = {};
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { exports, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  } }, { timeout: 1000 });
  return exports;
}

const ageGroups = loadModule(read("lib/domain/kindergarten-onboarding.ts"));

function discoveryService(allowed = true) {
  return loadModule(service, {
    "@/lib/domain/kindergarten-onboarding": ageGroups,
    "@/lib/management/family-link": { guardianCanAccessChild: async () => allowed }
  });
}

test("matching is canonical, child-authorized, age-aware and non-reserving", () => {
  assert.match(migration, /child_guardian_links/);
  assert.match(migration, /child_discovery_denied/);
  assert.match(migration, /child_months between c\.min_age_months and c\.max_age_months/);
  assert.match(migration, /classroom_seat_reservations/);
  assert.doesNotMatch(migration, /reserve_classroom_seat\(/);
});

test("published public projection excludes sensitive fields", () => {
  assert.match(migration, /returns table/);
  assert.doesNotMatch(migration, /camera_url|medical_notes|staff_id|phone|email|document_url/);
  assert.match(migration, /public_profile_enabled/);
  assert.match(migration, /enrollment_availability/);
});

test("parent endpoint requires a parent session and rejects child IDOR", () => {
  assert.match(api, /session\.profile\.role !== "parent"/);
  assert.match(service, /guardianCanAccessChild/);
  assert.match(api, /result\.kind === "denied"/);
});

test("existing discovery UI is child-specific and uses canonical matches", () => {
  assert.match(page, /selectedChild/);
  assert.match(page, /findEligibleGardensForChild/);
  assert.match(page, /matching_classrooms/);
  assert.match(page, /הזמינות אינה שומרת מקום/);
});

test("enrollment availability remains separate from capacity", () => {
  assert.match(migration, /'accepting','paused','closed','waitlist_only'/);
  assert.match(migration, /coalesce\(matches\.has_capacity,false\)/);
});

test("an authorized age-group selection narrows Gardens without changing canonical match data", async () => {
  const policy = discoveryService();
  const infant = { garden_id: "infant", match_status: "full", available_seats: 0,
    matching_classrooms: [{ age_group_key: "INFANT" }, { age_group_key: "TODDLER_YOUNG" }] };
  const older = { garden_id: "older", match_status: "eligible",
    matching_classrooms: [{ age_group_key: "TODDLER_MATURE" }] };
  const waitlist = { garden_id: "waitlist", match_status: "waitlist_only", matching_classrooms: [] };
  const data = [older, infant, waitlist];
  let calls = 0;
  const db = { rpc: async (name, args) => {
    calls++;
    assert.equal(name, "find_child_garden_matches");
    assert.equal(args.target_child_file_id, "linked-child");
    assert.equal(args.target_city, "חיפה");
    assert.equal(args.target_query, "גן");
    return { data };
  } };
  const filters = { city: "חיפה", query: "גן" };
  const find = (input) => policy.findEligibleGardensForChild(db, "parent", "linked-child", {
    ...filters, ageGroup: policy.discoveryAgeGroup(input)
  });
  const filtered = await find("INFANT");
  assert.equal(filtered.kind, "ok");
  assert.equal(filtered.matches.length, 1);
  assert.equal(filtered.matches[0], infant);
  assert.equal((await find("KINDERGARTEN")).matches.length, 0);
  for (const input of ["", "unsupported", ["INFANT", "KINDERGARTEN"]]) {
    assert.equal((await find(input)).matches, data);
  }
  assert.equal(calls, 5);
});

test("choosing an age group cannot bypass family authorization or a missing birth date", async () => {
  const denied = await discoveryService(false).findEligibleGardensForChild({
    rpc: () => assert.fail("Unauthorized child must not reach the RPC")
  }, "parent", "other-child", { ageGroup: "INFANT" });
  assert.equal(denied.kind, "denied");
  const missing = await discoveryService().findEligibleGardensForChild({
    rpc: async () => ({ error: { code: "22023", message: "child_discovery_birth_date_required" } })
  }, "parent", "linked-child", { ageGroup: "INFANT" });
  assert.equal(missing.kind, "birth_date_required");
});
