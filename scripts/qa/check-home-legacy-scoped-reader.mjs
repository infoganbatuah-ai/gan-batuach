import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createHomeLegacyScopedReader } from "../../services/video-gateway/home-legacy-scoped-reader.mjs";
import { evaluateHomeLegacyMatch, HOME_LEGACY_MATCH_BINDINGS, HOME_LEGACY_MATCH_SITE_ID } from "../../services/video-gateway/home-legacy-match-service.mjs";

const db = new PGlite();
let checks = 0, credentialReads = 0, queryCalls = 0;
const secret = "isolated-synthetic-home-credential-over-32-characters";
const verifier = createHash("sha256").update(secret).digest("hex");
const bindings = Object.values(HOME_LEGACY_MATCH_BINDINGS);
const otherSite = randomUUID();
try {
  await db.exec(`create role anon nologin;
    create table public.video_gateway_device_enrollments (
      id uuid primary key, gateway_id uuid, observer_site_id uuid, tenant_id uuid,
      deployment_profile text, config_version integer, status text,
      lifecycle_state text, identity_scheme text, refresh_token_hash text
    );
    alter table public.video_gateway_device_enrollments enable row level security;
    create policy deny_all on public.video_gateway_device_enrollments for all using (false) with check (false);`);
  for (const binding of bindings) {
    await db.query(`insert into public.video_gateway_device_enrollments values
      ($1,$2,$3,$4,$5,$6,'delivered','ACTIVE','LEGACY_HMAC',$7)`,
    [binding.enrollmentId, binding.deviceId, binding.siteId, binding.tenantId,
      binding.deploymentProfile, binding.configVersion, verifier]);
  }
  await db.query(`insert into public.video_gateway_device_enrollments values
    ($1,$2,$3,$4,'PHYSICAL_GATEWAY',1,'delivered','ACTIVE','LEGACY_HMAC',$5)`,
  [randomUUID(), bindings[0].deviceId, otherSite, bindings[0].tenantId, verifier]);
  await db.exec(readFileSync("supabase/migrations/20261021010000_home_legacy_compare_reader_preparation.sql", "utf8"));
  assert.equal((await db.query("select count(*)::int n from pg_roles where rolname='home_legacy_compare_reader'")).rows[0].n, 0); checks++;
  await db.exec("set role anon");
  await assert.rejects(db.query("select * from public.video_gateway_device_enrollments"), /permission denied/); checks++;
  await db.exec("reset role");

  const reader = createHomeLegacyScopedReader({
    query: (sql, values) => { queryCalls++; return db.query(sql, values); },
    loadProtectedCredential: async () => { credentialReads++; return secret; }
  });
  assert.deepEqual(Object.keys(reader), ["compareBoundCredential"]); checks++;
  for (const binding of bindings) {
    assert.equal(await reader.compareBoundCredential(binding), "MATCH"); checks++;
    for (const mutation of [
      { enrollmentId: randomUUID() }, { tenantId: randomUUID() },
      { siteId: randomUUID() }, { deviceId: randomUUID() },
      { configVersion: binding.configVersion + 1 }, { deploymentProfile: "OTHER" }
    ]) {
      const before = queryCalls;
      assert.equal(await reader.compareBoundCredential({ ...binding, ...mutation }), "UNKNOWN"); checks++;
      assert.equal(queryCalls, before); checks++;
    }
  }
  assert.equal(await reader.compareBoundCredential({ ...bindings[0], extra: "untrusted" }), "UNKNOWN"); checks++;
  const wrong = createHomeLegacyScopedReader({ query: (sql, values) => db.query(sql, values),
    loadProtectedCredential: async () => secret + "-wrong" });
  assert.equal(await wrong.compareBoundCredential(bindings[0]), "MISMATCH"); checks++;
  await db.query("update public.video_gateway_device_enrollments set lifecycle_state='REVOKED' where id=$1", [bindings[0].enrollmentId]);
  assert.equal(await reader.compareBoundCredential(bindings[0]), "UNKNOWN"); checks++;
  await db.query("update public.video_gateway_device_enrollments set lifecycle_state='ACTIVE' where id=$1", [bindings[0].enrollmentId]);
  const audit = [], seen = new Set();
  const binding = bindings[0];
  const run = (requestId = randomUUID(), overrides = {}) => evaluateHomeLegacyMatch({ deviceId: binding.deviceId, requestId }, {
    now: () => 1_000_000,
    authorizeAdministrator: async () => ({ authenticated: true, role: "platform_admin",
      purpose: "HOME_TELEMETRY_LEGACY_MATCH", deviceId: binding.deviceId,
      siteId: HOME_LEGACY_MATCH_SITE_ID, tenantId: binding.tenantId,
      actorId: "synthetic-admin", approvalId: "synthetic-approval",
      issuedAt: 990_000, expiresAt: 1_030_000, revoked: false }),
    confirmApprovalActive: async () => true,
    consumeAttempt: async ({ requestId: id }) => { if (seen.has(id)) return false; seen.add(id); return true; },
    recordAudit: async event => { audit.push(event); return true; },
    ...reader, ...overrides
  });
  assert.equal(await run(), "MATCH"); checks++;
  const replay = randomUUID();
  assert.equal(await run(replay), "MATCH"); checks++;
  assert.equal(await run(replay), "UNKNOWN"); checks++;
  assert.equal(await run(randomUUID(), { confirmApprovalActive: async () => false }), "UNKNOWN"); checks++;
  assert.equal(JSON.stringify(audit).includes(secret) || JSON.stringify(audit).includes(verifier), false); checks++;
  assert.equal((await db.query("select count(*)::int n from public.video_gateway_device_enrollments")).rows[0].n, 3); checks++;
} finally { await db.close(); }
console.log(`home legacy scoped reader: ${checks}/${checks} isolated checks PASS`);
