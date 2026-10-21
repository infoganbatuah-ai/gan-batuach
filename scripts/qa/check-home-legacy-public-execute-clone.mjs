import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { HOME_LEGACY_MATCH_DEVICES, HOME_LEGACY_MATCH_SITE_ID } from "../../services/video-gateway/home-legacy-match-service.mjs";

// Synthetic isolated catalog/row clone. Never connect this check to a remote DB.
const db = new PGlite();
let checks = 0;
const [gatewayId, connectorId] = Object.keys(HOME_LEGACY_MATCH_DEVICES);
const otherDeviceId = randomUUID();
const tenantId = randomUUID();
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create table public.video_gateway_device_enrollments (
      id uuid primary key, gateway_id uuid, observer_site_id uuid, tenant_id uuid,
      deployment_profile text, config_version integer, status text,
      lifecycle_state text, identity_scheme text, refresh_token_hash text
    );
    alter table public.video_gateway_device_enrollments enable row level security;
    create policy admin_only on public.video_gateway_device_enrollments
      for all using (false) with check (false);
    create table public.synthetic_effects (device_id uuid);
    create function public.synthetic_unsafe_notify(p_device uuid)
      returns void language plpgsql volatile security definer
      set search_path = pg_catalog as $$
      begin
        insert into public.synthetic_effects(device_id) values (p_device);
      end $$;
    grant execute on function public.synthetic_unsafe_notify(uuid)
      to anon, authenticated, service_role;
    create function public.synthetic_lookup() returns integer
      language sql stable security definer set search_path = pg_catalog
      as $$ select count(*)::integer from public.synthetic_effects $$;
    grant execute on function public.synthetic_lookup()
      to anon, authenticated, service_role;
  `);
  for (const [id, profile] of Object.entries(HOME_LEGACY_MATCH_DEVICES)) {
    await db.query(`insert into public.video_gateway_device_enrollments values
      ($1,$2,$3,$4,$5,1,'delivered','ACTIVE','LEGACY_HMAC','synthetic-only')`,
    [randomUUID(), id, HOME_LEGACY_MATCH_SITE_ID, tenantId, profile]);
  }
  await db.query(`insert into public.video_gateway_device_enrollments values
    ($1,$2,$3,$4,'PHYSICAL_GATEWAY',1,'delivered','ACTIVE','LEGACY_HMAC','synthetic-only')`,
  [randomUUID(), otherDeviceId, HOME_LEGACY_MATCH_SITE_ID, randomUUID()]);
  await db.exec(readFileSync("supabase/migrations/20261021010000_home_legacy_compare_reader_preparation.sql", "utf8"));

  await db.exec("set role home_legacy_compare_reader");
  assert.equal((await db.query("select count(*)::integer n from private_home_legacy_compare.read_exact_enrollment($1)", [gatewayId])).rows[0].n, 1); checks++;
  assert.equal((await db.query("select count(*)::integer n from private_home_legacy_compare.read_exact_enrollment($1)", [connectorId])).rows[0].n, 1); checks++;
  assert.equal((await db.query("select count(*)::integer n from private_home_legacy_compare.read_exact_enrollment($1)", [otherDeviceId])).rows[0].n, 0); checks++;
  await assert.rejects(db.query("select * from public.video_gateway_device_enrollments"), /permission denied/); checks++;
  await assert.rejects(db.query("insert into public.synthetic_effects values ($1)", [gatewayId]), /permission denied/); checks++;
  // This is the Production-shaped defect: NOINHERIT does not exclude PUBLIC.
  assert.equal((await db.query("select has_function_privilege(current_user, 'public.synthetic_unsafe_notify(uuid)', 'EXECUTE') allowed")).rows[0].allowed, true); checks++;
  await db.query("select public.synthetic_unsafe_notify($1)", [gatewayId]);
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::integer n from public.synthetic_effects")).rows[0].n, 1); checks++;

  // Candidate ACL correction is exercised ONLY on this synthetic clone.
  await db.exec(`revoke execute on function public.synthetic_unsafe_notify(uuid) from public;
    revoke execute on function public.synthetic_lookup() from public;`);
  await db.exec("set role home_legacy_compare_reader");
  for (const signature of ["public.synthetic_unsafe_notify(uuid)", "public.synthetic_lookup()"])
    { assert.equal((await db.query("select has_function_privilege(current_user, $1, 'EXECUTE') allowed", [signature])).rows[0].allowed, false); checks++; }
  await assert.rejects(db.query("select public.synthetic_unsafe_notify($1)", [connectorId]), /permission denied/); checks++;
  await assert.rejects(db.query("select public.synthetic_lookup()"), /permission denied/); checks++;
  assert.equal((await db.query("select count(*)::integer n from private_home_legacy_compare.read_exact_enrollment($1)", [gatewayId])).rows[0].n, 1); checks++;
  await db.exec("reset role");
  assert.equal((await db.query("select count(*)::integer n from public.synthetic_effects")).rows[0].n, 1); checks++;
  await db.exec("set role authenticated");
  assert.equal((await db.query("select has_function_privilege(current_user, 'public.synthetic_unsafe_notify(uuid)', 'EXECUTE') allowed")).rows[0].allowed, true); checks++;
  await db.exec("reset role");
  // Re-granting PUBLIC is the exact ACL rollback and demonstrably reopens risk.
  await db.exec("grant execute on function public.synthetic_unsafe_notify(uuid) to public");
  await db.exec("set role home_legacy_compare_reader");
  assert.equal((await db.query("select has_function_privilege(current_user, 'public.synthetic_unsafe_notify(uuid)', 'EXECUTE') allowed")).rows[0].allowed, true); checks++;
  await db.exec("reset role");
  // Unlike SET ROLE under the PGlite owner, this drops session authorization
  // to a non-superuser principal before exercising role-escalation denial.
  await db.exec("create role synthetic_login login noinherit; grant home_legacy_compare_reader to synthetic_login");
  await db.exec("set session authorization synthetic_login");
  await db.exec("set role home_legacy_compare_reader");
  await assert.rejects(db.exec("set role postgres"), /permission denied/); checks++;
} finally {
  await db.close();
}
console.log(`home legacy public-execute synthetic clone: ${checks}/${checks} PASS`);
