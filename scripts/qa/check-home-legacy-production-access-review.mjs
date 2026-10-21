import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { HOME_LEGACY_MATCH_BINDINGS } from "../../services/video-gateway/home-legacy-match-service.mjs";

// Review-only configuration and catalog SQL against a synthetic in-memory
// database. Never connects to Supabase, Keychain, or an installed device.
const config = JSON.parse(readFileSync("config/home-legacy-production-compare-review.json", "utf8"));
const preflight = readFileSync("DIGITAL_OBSERVER_HOME_LEGACY_PRODUCTION_ACCESS_PREFLIGHT_20261021.sql", "utf8");
const pendingMigration = readFileSync("supabase/migrations/20261021010000_home_legacy_compare_reader_preparation.sql", "utf8");
const sql = preflight.replace(/^--.*$/gm, "");
let checks = 0;
assert.equal(config.status, "BLOCKED_REVIEW_ONLY"); checks++;
for (const key of ["enabled", "newDirectDatabaseLogin", "productionDDL", "productionDeployment",
  "realComparison", "liveTelemetryTransition"]) {
  const value = key === "newDirectDatabaseLogin" ? config.executionIdentity[key] : config[key];
  assert.equal(value, false, key); checks++;
}
assert.equal(config.executionIdentity.productionDatabasePrincipal, "NOT_SELECTED"); checks++;
assert.doesNotMatch(pendingMigration.replace(/^--.*$/gm, ""),
  /\b(create|alter|grant|revoke)\s+(role|function|schema)\b/i); checks++;
assert.equal(config.bindings.length, 2); checks++;
for (const binding of config.bindings) {
  const pinned = HOME_LEGACY_MATCH_BINDINGS[binding.deviceId];
  assert.ok(pinned); checks++;
  for (const key of ["enrollmentId", "deviceId", "tenantId", "siteId", "deploymentProfile", "configVersion"]) {
    assert.equal(binding[key], pinned[key], key); checks++;
  }
}
assert.deepEqual(config.requiredReadColumns, ["id", "gateway_id", "observer_site_id", "tenant_id",
  "deployment_profile", "config_version", "status", "lifecycle_state", "identity_scheme",
  "refresh_token_hash"]); checks++;
assert.doesNotMatch(sql, /\b(create|alter|drop|grant|revoke|insert|update|delete|truncate|call|do)\b/i); checks++;
assert.doesNotMatch(sql, /select\s+[^;]*refresh_token_hash/i); checks++;

const db = new PGlite();
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create role service_role nologin;
    create table public.video_gateway_device_enrollments (
      id uuid primary key, gateway_id uuid, tenant_id uuid, observer_site_id uuid,
      deployment_profile text, config_version integer, status text,
      lifecycle_state text, identity_scheme text, refresh_token_hash text);
    create function public.synthetic_function() returns integer
      language sql volatile security definer as $$ select 1 $$;`);
  for (const binding of config.bindings) {
    await db.query(`insert into public.video_gateway_device_enrollments values
      ($1,$2,$3,$4,$5,$6,'delivered','ACTIVE','LEGACY_HMAC','synthetic-not-a-verifier')`,
    [binding.enrollmentId, binding.deviceId, binding.tenantId, binding.siteId,
      binding.deploymentProfile, binding.configVersion]);
  }
  const before = (await db.query("select * from public.video_gateway_device_enrollments order by id")).rows;
  const results = await db.exec(preflight);
  assert.ok(Array.isArray(results) && results.length > 0); checks++;
  assert.deepEqual((await db.query("select * from public.video_gateway_device_enrollments order by id")).rows, before); checks++;
  assert.equal((await db.query("select count(*)::int n from public.video_gateway_device_enrollments")).rows[0].n, 2); checks++;
} finally { await db.close(); }
console.log(`home legacy Production access review: ${checks}/${checks} isolated checks PASS`);
