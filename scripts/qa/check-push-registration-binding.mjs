import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

const providerUrl = `data:text/javascript,${encodeURIComponent('export const getPushProviderForPlatform = () => ({ name: "mock" });')}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "./push-provider" && context.parentURL?.endsWith("/lib/domain/push-service.ts")) {
      return { url: providerUrl, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

const { registerPushDevice, unregisterPushDevice } = await import("../../lib/domain/push-service.ts");
const site = "00000000-0000-4000-8000-000000000044";
const otherSite = "00000000-0000-4000-8000-000000000045";
const input = (overrides = {}) => ({ profileId: "owner-a", role: "parent", platform: "ios",
  deviceToken: "synthetic-provider-token-a", deviceId: "installation-a", appVersion: "1.0",
  metadata: { source: "digital_observer_native", observer_site_id: site }, ...overrides });
const row = (overrides = {}) => ({ id: "row-a", profile_id: "owner-a", role: "parent", platform: "ios",
  device_token: "synthetic-provider-token-a", device_id: "installation-a", is_active: true,
  metadata: { source: "digital_observer_native", observer_site_id: site }, ...overrides });

function database(initial = [], options = {}) {
  const rows = structuredClone(initial);
  const writes = [];
  let sequence = 0;
  const query = (operation, payload) => {
    const filters = [];
    let selected = "";
    const builder = {
      select(columns) { selected = columns; return builder; },
      then(resolve, reject) { return finish().then(resolve, reject); },
      eq(key, value) { filters.push((record) => record[key] === value); return builder; },
      is(key, value) { filters.push((record) => record[key] === value); return builder; },
      contains(key, value) { filters.push((record) => Object.entries(value).every(([field, expected]) => record[key]?.[field] === expected)); return builder; },
      async maybeSingle() { const result = await finish(); return { ...result, data: result.data?.[0] ?? null }; },
      async single() { const result = await finish(); return { ...result, data: result.data?.[0] ?? null }; },
      async limit(count) { const result = await finish(); return { ...result, data: result.data?.slice(0, count) ?? null }; }
    };
    async function finish() {
      if (options.fail === operation) return { data: null, error: { message: `${operation.toUpperCase()}_FAILED` } };
      const matched = rows.filter((record) => filters.every((filter) => filter(record)));
      if (operation === "read") return { data: matched, error: null };
      if (operation === "insert") {
        if (options.uniqueRace || rows.some((record) => record.device_token === payload.device_token)) {
          return { data: null, error: { code: "23505", message: "unique violation" } };
        }
        const created = { id: `created-${++sequence}`, ...payload };
        rows.push(created); writes.push({ operation, payload: structuredClone(payload), selected });
        return { data: [created], error: null };
      }
      for (const record of matched) Object.assign(record, payload);
      if (matched.length) writes.push({ operation, payload: structuredClone(payload), selected });
      return { data: matched, error: null };
    }
    return builder;
  };
  return { rows, writes, from(table) { assert.equal(table, "push_device_tokens"); return {
    select(columns) { return query("read").select(columns); },
    insert(payload) { return query("insert", payload); },
    update(payload) { return query("update", payload); }
  }; } };
}

test("new Observer token is inserted once and a same-binding replay only updates liveness/version", async () => {
  const db = database();
  assert.equal((await registerPushDevice(db, input())).ok, true);
  assert.equal(db.rows.length, 1);
  const replay = await registerPushDevice(db, input({ appVersion: "1.1" }));
  assert.equal(replay.ok, true);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].app_version, "1.1");
  assert.deepEqual(Object.keys(db.writes[1].payload).sort(), ["app_version", "last_seen_at", "updated_at"]);
});

test("token cannot move profile, role, Site, source, device or platform even for admin-visible rows", async () => {
  for (const change of [
    { profileId: "owner-b" }, { role: "admin" }, { metadata: { source: "digital_observer_native", observer_site_id: otherSite } },
    { metadata: { source: "digital_observer_fcm", observer_site_id: site } },
    { deviceId: "installation-b" }, { platform: "android" }
  ]) {
    const db = database([row()]);
    const result = await registerPushDevice(db, input(change));
    assert.equal(result.conflict, true, JSON.stringify(change));
    assert.equal(db.writes.length, 0);
    assert.deepEqual(db.rows, [row()]);
  }
});

test("disabled tokens do not reactivate; rotated tokens require explicit old-token revocation", async () => {
  const disabled = database([row({ is_active: false })]);
  assert.equal((await registerPushDevice(disabled, input())).conflict, true);
  assert.equal(disabled.writes.length, 0);
  const rotated = database([row()]);
  assert.equal((await registerPushDevice(rotated, input({ deviceToken: "synthetic-provider-token-b" }))).conflict, true);
  assert.equal(rotated.writes.length, 0);
});

test("unique-race, lookup failure and update failure fail closed with zero row mutation", async () => {
  for (const [db, request] of [
    [database([], { uniqueRace: true }), input()],
    [database([row()], { fail: "read" }), input()],
    [database([row()], { fail: "update" }), input()]
  ]) {
    const before = structuredClone(db.rows);
    assert.equal((await registerPushDevice(db, request)).ok, false);
    assert.deepEqual(db.rows, before);
    assert.equal(db.writes.length, 0);
  }
});

test("generic product registration remains available but cannot take an Observer token", async () => {
  const generic = database();
  assert.equal((await registerPushDevice(generic, input({ metadata: { source: "fcm_web" } }))).ok, true);
  const observer = database([row()]);
  assert.equal((await registerPushDevice(observer, input({ metadata: { source: "fcm_web" } }))).conflict, true);
  assert.equal(observer.writes.length, 0);
});

const scope = { source: "digital_observer_native", siteId: site };

test("scoped revocation disables only the current profile/source/Site installation", async () => {
  const db = database([row(), row({ id: "row-other-site", device_token: "synthetic-provider-token-b",
    metadata: { source: "digital_observer_native", observer_site_id: otherSite } }),
  row({ id: "row-management", device_token: "synthetic-provider-token-c", metadata: { source: "management" } })]);
  const result = await unregisterPushDevice(db, "owner-a", null, "installation-a", scope);
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows.map((item) => item.id), ["row-a"]);
  assert.equal(db.rows[0].is_active, false);
  assert.equal(db.rows[1].is_active, true);
  assert.equal(db.rows[2].is_active, true);
});

test("exact token is also a valid scoped revocation target", async () => {
  const db = database([row()]);
  const result = await unregisterPushDevice(db, "owner-a", "synthetic-provider-token-a", null, scope);
  assert.equal(result.ok, true);
  assert.equal(db.rows[0].is_active, false);
  assert.equal(db.writes.length, 1);
});

test("wrong profile, Site, source and token cannot revoke another binding", async () => {
  for (const [profile, token, device, binding] of [
    ["owner-b", null, "installation-a", scope],
    ["owner-a", null, "installation-a", { ...scope, siteId: otherSite }],
    ["owner-a", null, "installation-a", { ...scope, source: "digital_observer_fcm" }],
    ["owner-a", "synthetic-provider-token-other", "installation-a", scope]
  ]) {
    const db = database([row()]);
    const result = await unregisterPushDevice(db, profile, token, device, binding);
    assert.equal(result.ok, true);
    assert.deepEqual(result.rows, []);
    assert.equal(db.writes.length, 0);
    assert.deepEqual(db.rows, [row()]);
  }
});

test("empty target is rejected; double revocation is bounded and idempotent", async () => {
  const db = database([row()]);
  assert.equal((await unregisterPushDevice(db, "owner-a", null, null, scope)).ok, false);
  assert.equal(db.writes.length, 0);
  assert.equal((await unregisterPushDevice(db, "owner-a", null, "installation-a", scope)).rows.length, 1);
  assert.equal((await unregisterPushDevice(db, "owner-a", null, "installation-a", scope)).rows.length, 0);
  assert.equal(db.writes.length, 1);
});

test("database failure does not claim revocation; new token rotates only after old revocation", async () => {
  const failing = database([row()], { fail: "update" });
  assert.equal((await unregisterPushDevice(failing, "owner-a", null, "installation-a", scope)).ok, false);
  assert.equal(failing.rows[0].is_active, true);
  const db = database([row()]);
  assert.equal((await registerPushDevice(db, input({ deviceToken: "synthetic-provider-token-b" }))).conflict, true);
  assert.equal((await unregisterPushDevice(db, "owner-a", null, "installation-a", scope)).ok, true);
  assert.equal((await registerPushDevice(db, input({ deviceToken: "synthetic-provider-token-b" }))).ok, true);
  assert.equal(db.rows.filter((item) => item.is_active).length, 1);
  assert.equal((await registerPushDevice(db, input())).conflict, true);
});
