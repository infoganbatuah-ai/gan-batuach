import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createHomeLegacyScopedReader } from "../../services/video-gateway/home-legacy-scoped-reader.mjs";
import { evaluateHomeLegacyMatch, HOME_LEGACY_MATCH_DEVICES, HOME_LEGACY_MATCH_SITE_ID } from "../../services/video-gateway/home-legacy-match-service.mjs";

const db = new PGlite();
let checks = 0;
const tenantId = randomUUID();
const otherSite = randomUUID();
const secret = "isolated-synthetic-home-credential";
const verifier = createHash("sha256").update(secret).digest("hex");
const identities = Object.entries(HOME_LEGACY_MATCH_DEVICES).map(([deviceId, profile]) =>
  ({ deviceId, profile, enrollmentId: randomUUID() }));
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create table public.video_gateway_device_enrollments (
      id uuid primary key, gateway_id uuid, observer_site_id uuid, tenant_id uuid,
      deployment_profile text, config_version integer, status text,
      lifecycle_state text, identity_scheme text, refresh_token_hash text
    );
    alter table public.video_gateway_device_enrollments enable row level security;
    create policy admin_only on public.video_gateway_device_enrollments for all using (false) with check (false);`);
  for (const identity of identities) {
    await db.query(`insert into public.video_gateway_device_enrollments values
      ($1,$2,$3,$4,$5,1,'delivered','ACTIVE','LEGACY_HMAC',$6)`,
    [identity.enrollmentId, identity.deviceId, HOME_LEGACY_MATCH_SITE_ID, tenantId, identity.profile, verifier]);
  }
  const foreignId = randomUUID();
  await db.query(`insert into public.video_gateway_device_enrollments values
    ($1,$2,$3,$4,'PHYSICAL_GATEWAY',1,'delivered','ACTIVE','LEGACY_HMAC',$5)`,
  [randomUUID(), foreignId, HOME_LEGACY_MATCH_SITE_ID, tenantId, verifier]);
  await db.query(`insert into public.video_gateway_device_enrollments values
    ($1,$2,$3,$4,'PHYSICAL_GATEWAY',1,'delivered','ACTIVE','LEGACY_HMAC',$5)`,
  [randomUUID(), identities[0].deviceId, otherSite, tenantId, verifier]);
  await db.exec(readFileSync("supabase/migrations/20261021010000_home_legacy_compare_reader_preparation.sql", "utf8"));

  await db.exec("set role anon");
  await assert.rejects(db.query("select * from private_home_legacy_compare.read_exact_enrollment($1::uuid)",
    [identities[0].deviceId]), /permission denied/); checks++;
  await db.exec("reset role");

  await db.exec("set role home_legacy_compare_reader");
  const query = (sql, values) => db.query(sql, values);
  const reader = createHomeLegacyScopedReader(query);
  for (const identity of identities) {
    const rows = await db.query("select * from private_home_legacy_compare.read_exact_enrollment($1::uuid)", [identity.deviceId]);
    assert.equal(rows.rows.length, 1); checks++;
    assert.equal(rows.rows[0].id, identity.enrollmentId); checks++;
    const binding = await reader.resolveApprovedBinding(identity.deviceId);
    assert.equal(binding?.tenantId, tenantId); checks++;
    assert.equal((await reader.loadScopedRows(binding)).length, 1); checks++;
    assert.deepEqual(await reader.loadScopedRows({ ...binding, tenantId: randomUUID() }), []); checks++;
  }
  assert.equal((await db.query("select * from private_home_legacy_compare.read_exact_enrollment($1::uuid)", [foreignId])).rows.length, 0); checks++;
  assert.deepEqual(await reader.resolveApprovedBinding(foreignId), null); checks++;
  await assert.rejects(db.query("select id from public.video_gateway_device_enrollments"), /permission denied/); checks++;
  await assert.rejects(db.query("update public.video_gateway_device_enrollments set status='revoked'"), /permission denied/); checks++;
  await assert.rejects(db.query("delete from public.video_gateway_device_enrollments"), /permission denied/); checks++;
  await assert.rejects(db.query("insert into public.video_gateway_device_enrollments(id) values ($1)", [randomUUID()]), /permission denied/); checks++;
  assert.equal((await db.query("select rolcanlogin, rolbypassrls from pg_roles where rolname='home_legacy_compare_reader'")).rows[0].rolcanlogin, false); checks++;
  await db.exec("reset role");

  // The same private reader is exercised through the pre-existing comparison
  // core. All approval, audit and credential inputs here are synthetic only.
  for (const identity of identities) {
    const audit = [], seen = new Set();
    const run = (overrides = {}, requestId = randomUUID()) =>
      evaluateHomeLegacyMatch({ deviceId: identity.deviceId, requestId }, {
        now: () => 1_000_000,
        authorizeAdministrator: async () => ({ authenticated: true, role: "platform_admin",
          purpose: "HOME_TELEMETRY_LEGACY_MATCH", deviceId: identity.deviceId,
          siteId: HOME_LEGACY_MATCH_SITE_ID, tenantId, actorId: "synthetic-admin",
          approvalId: "synthetic-approval", issuedAt: 990_000, expiresAt: 1_030_000, revoked: false }),
        confirmApprovalActive: async () => true,
        consumeAttempt: async ({ requestId: id, maxAttempts }) => {
          assert.equal(maxAttempts, 2);
          if (seen.has(id)) return false;
          seen.add(id); return true;
        },
        recordAudit: async event => { audit.push(event); return true; },
        loadProtectedCredential: async () => secret,
        ...reader, ...overrides
      });
    assert.equal(await run(), "MATCH"); checks++;
    assert.equal(await run({ loadProtectedCredential: async () => secret + "-wrong" }), "MISMATCH"); checks++;
    const replayId = randomUUID();
    assert.equal(await run({}, replayId), "MATCH"); checks++;
    assert.equal(await run({}, replayId), "UNKNOWN"); checks++;
    assert.equal(await run({ authorizeAdministrator: async () => ({ authenticated: false }) }), "UNKNOWN"); checks++;
    assert.equal(await run({ confirmApprovalActive: async () => false }), "UNKNOWN"); checks++;
    assert.equal(JSON.stringify(audit).includes(secret) || JSON.stringify(audit).includes(verifier), false); checks++;
  }
  assert.equal((await db.query("select count(*)::int as n from public.video_gateway_device_enrollments")).rows[0].n, 4); checks++;
} finally {
  await db.close();
}
console.log(`home legacy scoped reader: ${checks}/${checks} isolated checks PASS`);
