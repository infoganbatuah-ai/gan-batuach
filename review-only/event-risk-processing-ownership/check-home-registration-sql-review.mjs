import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Deliberately source-only: no DB client, process execution or network API.
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const sql = read("HOME-REGISTRATION-RECEIPTS-NOT-APPLIED.sql");
const review = read("HOME-REGISTRATION-SQL-REVIEW.md");
const route = read("../../app/api/video-gateway/cloud-events/route.ts");
const contract = read("../../lib/domain/digital-observer/home-registration-ownership.ts");

test("draft aborts before all proposed objects and has no completion statement", () => {
  const executable = sql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
  assert.match(executable, /^\s*BEGIN;\s*DO \$not_applied\$/);
  assert.match(executable, /RAISE EXCEPTION 'NOT_APPLIED:/);
  assert.doesNotMatch(executable, /^\s*COMMIT\s*;/im);
  assert.doesNotMatch(executable, /^\s*GRANT\s+/im);
  assert.doesNotMatch(executable, /\bSECURITY\s+DEFINER\b/i);
  assert.doesNotMatch(executable, /\b(DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM|UPDATE\s+public\.)\b/i);
});

test("all proposed data remains private with no anon/authenticated grants", () => {
  for (const name of ["registration_identities", "registration_versions", "event_acceptances",
    "event_bindings", "registration_audit"]) {
    assert.match(sql, new RegExp(`CREATE TABLE observer_home_review\\.${name} \\(`));
    assert.match(sql, new RegExp(`ALTER TABLE observer_home_review\\.${name} ENABLE ROW LEVEL SECURITY;`));
  }
  assert.match(sql, /REVOKE ALL ON ALL TABLES IN SCHEMA observer_home_review FROM PUBLIC, anon, authenticated, service_role;/);
  assert.match(sql, /REVOKE ALL ON FUNCTION observer_home_review\.bind_accepted_event_v1\(uuid\)/);
  assert.match(sql, /SECURITY INVOKER\s+SET search_path = ''/);
  assert.match(review, /Data API exposed-schema list require verification/);
});

test("draft binds exact Event acceptance and immutable historical version", () => {
  assert.match(sql, /event_id uuid PRIMARY KEY REFERENCES public\.observer_intelligence_signals\(id\) ON DELETE RESTRICT/);
  assert.match(sql, /FOREIGN KEY \(registration_id, registration_version, tenant_id, site_id,/);
  assert.match(sql, /FOREIGN KEY \(event_id, registration_id, registration_version, tenant_id, site_id,/);
  assert.match(sql, /FOR UPDATE;/);
  assert.match(sql, /ON CONFLICT \(event_id\) DO NOTHING/);
  assert.match(sql, /HOME_EVENT_BINDING_CONFLICT/);
  assert.match(sql, /HOME_EVENT_MANDATORY_AUDIT_MISSING/);
  assert.match(sql, /registration_versions_no_mutation/);
  assert.match(sql, /event_acceptances_no_mutation/);
  assert.match(sql, /event_bindings_no_mutation/);
  assert.match(sql, /registration_audit_no_mutation/);
});

test("unqualified qualification/acceptance and active route stay closed", () => {
  assert.match(sql, /BLOCKED: no registration-qualification RPC/);
  assert.match(sql, /BLOCKED: no acceptance RPC/);
  assert.doesNotMatch(sql, /CREATE FUNCTION observer_home_review\.(?:qualify|accept)/);
  assert.match(review, /No current source-only test proves concurrency or durability/);
  assert.match(contract, /acceptedEvent\(eventId: string\)/);
  assert.match(contract, /bindEvent\(accepted: AcceptedEvent/);
  assert.match(route, /\.from\("observer_intelligence_signals"\)\.insert\(/);
  assert.doesNotMatch(route, /observer_home_review|HOME-REGISTRATION-RECEIPTS-NOT-APPLIED/);
  assert.match(review, /No route imports it/);
});
