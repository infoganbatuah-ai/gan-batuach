import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const fixture = loadTs("lib/domain/digital-observer/qa-learning-fixture.ts", { "@/lib/domain/video-gateway-client": {} });
const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: fixture.GUARD_QA_BRANCH, VERCEL_GIT_COMMIT_SHA: "a".repeat(40), NEXT_PUBLIC_SUPABASE_URL: fixture.GUARD_QA_PROJECT_URL };
const validBody = { run_isolated_fixture: true, expected_commit: env.VERCEL_GIT_COMMIT_SHA };
function previewRoute(overrides = {}, sessionOverride = undefined) {
  const calls = [];
  const db = {};
  const session = sessionOverride === undefined ? {
    user: { id: "qa-user", email: fixture.GUARD_QA_EMAIL, email_confirmed_at: "2026-08-31T00:00:00Z" },
    profile: { id: "qa-user", garden_id: null }, supabase: db
  } : sessionOverride;
  const route = loadTs("app/api/digital-observer/qa/learning-fixture/route.ts", {
    process: { env: { ...env, ...overrides } },
    "@/lib/domain/digital-observer/access": { async getDigitalObserverApiUser() { calls.push("auth"); return session; } },
    "@/lib/supabase/admin": { createAdminClient() { calls.push("admin"); return "admin-client"; } },
    "@/lib/domain/digital-observer/qa-learning-fixture": { ...fixture, async runGuardLearningFixture(admin, owner, id) {
      calls.push("fixture"); assert.equal(admin, "admin-client"); assert.equal(owner, db); assert.equal(id, "qa-user");
      return { passed: true, cleanup: "complete" };
    } }
  });
  return { calls, async post(body = validBody, authorization = "Bearer fixture-token") {
    const response = await route.POST(new Request("https://preview.example.invalid/api/digital-observer/qa/learning-fixture", {
      method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify(body)
    }));
    return { status: response.status, body: await response.json() };
  } };
}

for (const [name, override] of [
  ["production", { VERCEL_ENV: "production" }], ["local", { VERCEL_ENV: undefined }],
  ["other branch", { VERCEL_GIT_COMMIT_REF: "main" }], ["other project", { NEXT_PUBLIC_SUPABASE_URL: "https://other.supabase.co" }]
]) test(`Preview write fixture is unavailable in ${name}, before authentication or admin access`, async () => {
  const route = previewRoute(override);
  assert.equal((await route.post()).status, 404);
  assert.deepEqual(route.calls, []);
});

test("Preview fixture refuses cookies-only access and unauthenticated bearer tokens", async () => {
  const cookies = previewRoute();
  assert.equal((await cookies.post(undefined, "")).status, 401);
  assert.deepEqual(cookies.calls, []);
  const unauthenticated = previewRoute({}, null);
  assert.equal((await unauthenticated.post()).status, 401);
  assert.deepEqual(unauthenticated.calls, ["auth"]);
});

test("Preview fixture rejects non-QA users, unverified email, mismatched profile and kindergarten account", async () => {
  for (const changes of [
    { user: { id: "qa-user", email: "ordinary@example.invalid", email_confirmed_at: "now" } },
    { user: { id: "qa-user", email: fixture.GUARD_QA_EMAIL, email_confirmed_at: null } },
    { profile: { id: "other-user", garden_id: null } }, { profile: { id: "qa-user", garden_id: "garden-a" } }
  ]) {
    const route = previewRoute({}, { user: { id: "qa-user", email: fixture.GUARD_QA_EMAIL, email_confirmed_at: "now" }, profile: { id: "qa-user", garden_id: null }, ...changes });
    assert.equal((await route.post()).status, 403);
    assert.deepEqual(route.calls, ["auth"]);
  }
});

test("Preview fixture requires explicit confirmation and rejects client-selected sites", async () => {
  for (const body of [{}, { ...validBody, run_isolated_fixture: false }, { ...validBody, observer_site_id: "real-site" }]) {
    const route = previewRoute();
    assert.equal((await route.post(body)).status, 422);
    assert.deepEqual(route.calls, ["auth"]);
  }
});

test("Preview fixture cannot run against a different deployed commit", async () => {
  const route = previewRoute();
  assert.equal((await route.post({ ...validBody, expected_commit: "b".repeat(40) })).status, 409);
  assert.deepEqual(route.calls, ["auth"]);
});

test("only the scoped authenticated Preview test reaches the fixture", async () => {
  const route = previewRoute();
  const result = await route.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.hardware_actions, 0);
  assert.deepEqual(route.calls, ["auth", "admin", "fixture"]);
});

// In-memory database boundary; actual fixture + actual sampler execute above it.
function fixtureDb({ fail, throwAfterInsert = false } = {}) {
  const tables = Object.fromEntries(["observer_sites", "digital_observer_camera_sources", "site_behavior_baselines", "observer_site_learning_profiles", "observer_intelligence_signals"].map((name) => [name, []]));
  const db = { tables, from(table) {
    assert.ok(tables[table], `Unexpected table ${table}`);
    let operation = "read", payload, single = false;
    const filters = [];
    const query = {
      select() { return query; }, eq(key, value) { filters.push((row) => row[key] === value); return query; },
      maybeSingle() { single = true; return query; }, single() { single = true; return query; },
      insert(value) { operation = "insert"; payload = value; return query; }, update(value) { operation = "update"; payload = value; return query; },
      upsert(value) { operation = "upsert"; payload = value; return query; }, delete() { operation = "delete"; return query; },
      then(resolve, reject) { return Promise.resolve().then(() => {
        const matches = tables[table].filter((row) => filters.every((filter) => filter(row)));
        if (fail?.(table, operation)) return { error: { message: "provider-private-error-never-returned" }, data: null };
        let data = matches;
        if (operation === "insert") {
          const rows = Array.isArray(payload) ? payload : [payload];
          if (rows.some((row) => row.id && tables[table].some((existing) => existing.id === row.id))) return { error: { code: "23505" }, data: null };
          data = rows.map((row) => structuredClone({ id: randomUUID(), ...row })); tables[table].push(...data);
          if (throwAfterInsert && table === "observer_sites") throw Error("Lost insert acknowledgement");
        } else if (operation === "update") matches.forEach((row) => Object.assign(row, structuredClone(payload)));
        else if (operation === "upsert") {
          const existing = tables[table].find((row) => row.observer_site_id === payload.observer_site_id);
          if (existing) Object.assign(existing, structuredClone(payload)); else tables[table].push(structuredClone(payload));
        } else if (operation === "delete") tables[table] = tables[table].filter((row) => !matches.includes(row));
        return { data: structuredClone(single ? data[0] ?? null : data), error: null };
      }).then(resolve, reject); }
    };
    return query;
  } };
  return db;
}

test("isolated fixture verifies persistence and removes only its synthetic data", async () => {
  const db = fixtureDb();
  const existing = { id: "existing-site", owner_profile_id: "real-user", metadata: {} };
  db.tables.observer_sites.push(existing);
  const report = await fixture.runGuardLearningFixture(db, db, "qa-user");
  assert.equal(report.passed, true);
  assert.equal(report.checks.length, 8);
  assert.equal(report.cleanup, "complete");
  assert.deepEqual(db.tables.observer_sites, [existing]);
  for (const [name, rows] of Object.entries(db.tables)) if (name !== "observer_sites") assert.deepEqual(rows, []);
});

test("fixture cleans up after a partial write without returning provider error text", async () => {
  const db = fixtureDb({ fail: (table, operation) => table === "site_behavior_baselines" && operation === "insert" });
  const report = await fixture.runGuardLearningFixture(db, db, "qa-user");
  assert.equal(report.passed, false);
  assert.equal(report.failed_step, "learn_baseline");
  assert.equal(report.cleanup, "complete");
  assert.ok(!JSON.stringify(report).includes("provider-private"));
  assert.deepEqual(Object.values(db.tables).flat(), []);
});

test("fixture cleanup handles a successful insert whose acknowledgement was lost", async () => {
  const db = fixtureDb({ throwAfterInsert: true });
  const report = await fixture.runGuardLearningFixture(db, db, "qa-user");
  assert.equal(report.passed, false);
  assert.equal(report.cleanup, "complete");
  assert.deepEqual(Object.values(db.tables).flat(), []);
});

test("concurrent fixtures cannot mutate or clean up another invocation's lease", async () => {
  const db = fixtureDb();
  const reports = await Promise.all([fixture.runGuardLearningFixture(db, db, "qa-user"), fixture.runGuardLearningFixture(db, db, "qa-user")]);
  assert.equal(reports.filter((report) => report.passed).length, 1);
  assert.equal(reports.filter((report) => report.cleanup === "not_created").length, 1);
  assert.deepEqual(Object.values(db.tables).flat(), []);
});

test("cleanup failure is a failed test with an exact recovery site ID", async () => {
  const db = fixtureDb({ fail: (table, operation) => table === "observer_sites" && operation === "delete" });
  const report = await fixture.runGuardLearningFixture(db, db, "qa-user");
  assert.equal(report.passed, false);
  assert.equal(report.cleanup, "failed");
  assert.equal(report.failed_step, "cleanup");
  assert.equal(db.tables.observer_sites[0].id, report.fixture_site_id);
  assert.equal(db.tables.observer_sites[0].monitoring_enabled, false);
});
