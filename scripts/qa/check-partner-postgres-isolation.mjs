import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = (file) => readFileSync(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8");
const runtime = migration("20260820010000_digital_observer_product_runtime.sql");
const identity = migration("20261019020000_digital_observer_push41_enterprise_identity.sql");
const external = migration("20261019030000_digital_observer_push42_external_api.sql");
const partner = migration("20261019040000_digital_observer_push43_oem_sdk.sql");
const delegated = migration("20261019041000_digital_observer_push43_delegated_usage.sql");
const currentScope = migration("20261127162335_digital_observer_push43_current_usage_scope.sql");

function section(source, first, next) {
  const start = source.indexOf(first);
  const end = source.indexOf(next, start + first.length);
  assert.ok(start >= 0 && end > start, `Migration anchors missing for ${first}`);
  return source.slice(start, end);
}

const [memberA, memberB, partnerAdmin, orgA, orgB, partnerOrg, site, source, partnerId, customer, account, session, directAccount] =
  Array.from({ length: 13 }, (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);

async function fixture(t) {
  const directory = mkdtempSync(new URL("../../.partner-postgres-", import.meta.url).pathname);
  const db = new PGlite(directory);
  t.after(async () => {
    try { await db.close(); } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  // Synthetic dependency tables and auth claims only. The tested partner,
  // access, camera and metering contracts below come from checked migrations.
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable
      as $$ select current_setting('request.jwt.claim.role', true) $$;
    create function public.is_admin() returns boolean language sql stable as $$ select false $$;
    create function public.can_access_garden(uuid) returns boolean language sql stable as $$ select false $$;
    create function public.can_manage_garden(uuid) returns boolean language sql stable as $$ select false $$;
    create table public.profiles(id uuid primary key);
    create table public.camera_streams(id uuid primary key);
    create table public.digital_observer_organizations(id uuid primary key, owner_profile_id uuid);
    create table public.observer_sites(id uuid primary key, owner_profile_id uuid, garden_id uuid,
      site_type text, digital_observer_organization_id uuid references public.digital_observer_organizations(id));
    create table public.observer_site_memberships(observer_site_id uuid, profile_id uuid, active boolean, member_role text);
    create table public.digital_observer_organization_memberships(id uuid primary key default gen_random_uuid(), organization_id uuid,
      profile_id uuid, all_sites boolean, enterprise_role text, active boolean, revoked_at timestamptz);
    create table public.digital_observer_organization_member_sites(membership_id uuid, observer_site_id uuid);
    create table public.digital_observer_partner_billing_accounts(id uuid primary key);
    create table public.digital_observer_sso_connections(id uuid primary key);
    create table public.digital_observer_entitlement_grants(id uuid primary key);
  `);
  await db.exec(section(identity, "create table if not exists public.digital_observer_service_accounts",
    "create table if not exists public.digital_observer_service_account_credentials"));
  await db.exec(section(identity, "create or replace function public.digital_observer_has_org_permission(",
    'create policy "do org membership scoped read"'));
  await db.exec(section(runtime, "create table if not exists public.digital_observer_camera_sources",
    "create table if not exists public.digital_observer_known_people"));
  await db.exec(section(runtime, "alter table public.digital_observer_camera_sources enable row level security;",
    "alter table public.digital_observer_known_people enable row level security;"));
  await db.exec(section(runtime, 'drop policy if exists "digital observer camera sources scoped read"',
    'drop policy if exists "digital observer known people scoped"'));
  await db.exec(section(runtime, "revoke select on table public.digital_observer_camera_sources",
    "revoke select on table public.digital_observer_known_people"));
  await db.exec(section(external, "create table if not exists public.digital_observer_external_api_usage_buckets",
    "create table if not exists public.digital_observer_external_integration_sources"));
  await db.exec(partner);
  await db.exec(delegated);
  await db.exec(`
    insert into public.profiles(id) values ('${memberA}'), ('${memberB}'), ('${partnerAdmin}');
    insert into public.digital_observer_organizations values ('${orgA}', null), ('${orgB}', null), ('${partnerOrg}', '${partnerAdmin}');
    insert into public.observer_sites values ('${site}', null, null, 'home', '${orgA}');
    insert into public.digital_observer_organization_memberships(organization_id,profile_id,all_sites,enterprise_role,active)
      values ('${orgA}', '${memberA}', true, 'viewer', true), ('${orgB}', '${memberB}', true, 'viewer', true);
    insert into public.digital_observer_camera_sources(id,observer_site_id,display_name) values ('${source}', '${site}', 'synthetic');
    insert into public.digital_observer_service_accounts(id,organization_id,display_name,permissions,expires_at,created_by)
      values ('${account}', '${partnerOrg}', 'synthetic', '["camera.live.view"]', now() + interval '1 day', '${partnerAdmin}');
    insert into public.digital_observer_service_account_sites values ('${account}', '${site}', now());
    insert into public.digital_observer_service_accounts(id,organization_id,display_name,permissions,expires_at,created_by,all_sites)
      values ('${directAccount}', '${orgA}', 'direct-fixture', '["camera.live.view"]', now() + interval '1 day', '${memberA}', true);
    insert into public.digital_observer_partners(id,organization_id,partner_key,partner_type)
      values ('${partnerId}', '${partnerOrg}', 'partner-fixture', 'oem');
    insert into public.digital_observer_partner_customers(id,partner_id,customer_organization_id,external_customer_reference_hash,
      external_customer_reference_hint,idempotency_key,customer_status)
      values ('${customer}', '${partnerId}', '${orgA}', repeat('a',64), 'synthetic', 'fixture-1234', 'active');
    insert into public.digital_observer_partner_customer_sites values ('${customer}', '${site}', now());
    insert into public.digital_observer_partner_service_accounts(partner_id,service_account_id,partner_customer_id,access_kind)
      values ('${partnerId}', '${account}', '${customer}', 'customer_resources');
    insert into public.digital_observer_embedded_sessions(id,partner_id,partner_customer_id,observer_site_id,token_hash,token_prefix,
      audience,allowed_origin,scopes,expires_at)
      values ('${session}', '${partnerId}', '${customer}', '${site}', repeat('b',64), 'synthetic',
        'fixture', 'https://partner.example.invalid', '["cameras.read"]', now() + interval '10 minutes');
  `);
  return db;
}

function asRole(db, role, profileId, statement) {
  assert.ok(["anon", "authenticated", "service_role"].includes(role));
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query("select set_config('request.jwt.claim.role',$1,true), set_config('request.jwt.claim.sub',$2,true)", [role, profileId]);
    return tx.query(statement);
  });
}

const readCameras = "select id from public.digital_observer_camera_sources";
const readSessions = "select id from public.digital_observer_embedded_sessions";
const meter = (id = account, success = true) =>
  `select public.record_digital_observer_external_api_usage('${id}', '${site}', 'cameras.list', '2026-11-27T10:00:00Z', ${success}) as receipt`;

test("PostgreSQL RLS semantics on the installed embedded engine", async (t) => {
  const db = await fixture(t);
  const version = await db.query("show server_version");
  t.diagnostic(`PGlite local PostgreSQL engine ${version.rows[0].server_version}`);
  await t.test("Site transfer and membership revocation affect database reads", async () => {
    assert.deepEqual((await asRole(db, "authenticated", memberA, readCameras)).rows, [{ id: source }]);
    assert.deepEqual((await asRole(db, "authenticated", memberB, readCameras)).rows, []);
    await db.query("update public.observer_sites set digital_observer_organization_id=$1 where id=$2", [orgB, site]);
    assert.deepEqual((await asRole(db, "authenticated", memberA, readCameras)).rows, []);
    assert.deepEqual((await asRole(db, "authenticated", memberB, readCameras)).rows, [{ id: source }]);
    await db.query("update public.digital_observer_organization_memberships set revoked_at=now() where profile_id=$1", [memberB]);
    assert.deepEqual((await asRole(db, "authenticated", memberB, readCameras)).rows, []);
    await db.query("update public.observer_sites set digital_observer_organization_id=$1 where id=$2", [orgA, site]);
  });
  await t.test("DB ACL blocks application roles from reading or revoking embedded sessions", async () => {
    await assert.rejects(asRole(db, "anon", "", readCameras), { code: "42501" });
    await assert.rejects(asRole(db, "anon", "", readSessions), { code: "42501" });
    await assert.rejects(asRole(db, "authenticated", partnerAdmin, readSessions), { code: "42501" });
    await assert.rejects(asRole(db, "authenticated", partnerAdmin,
      "update public.digital_observer_embedded_sessions set revoked_at=now()"), { code: "42501" });
    const readLinks = "select observer_site_id from public.digital_observer_partner_customer_sites";
    assert.deepEqual((await asRole(db, "authenticated", memberA, readLinks)).rows, []);
    assert.deepEqual((await asRole(db, "authenticated", partnerAdmin, readLinks)).rows, [{ observer_site_id: site }]);
    await db.query("update public.digital_observer_embedded_sessions set revoked_at=now() where id=$1", [session]);
    assert.deepEqual((await db.query("select id from public.digital_observer_embedded_sessions where revoked_at is null")).rows, []);
  });
  await t.test("ordered upgrade keeps existing counters and rejects stale Site, account and customer scopes", async () => {
    const initial = (await asRole(db, "service_role", "", meter())).rows[0].receipt;
    assert.ok(initial);
    await db.exec(currentScope);
    await assert.rejects(asRole(db, "anon", "", meter()), { code: "42501" });
    await assert.rejects(asRole(db, "authenticated", partnerAdmin, meter()), { code: "42501" });
    const denied = () => assert.rejects(asRole(db, "service_role", "", meter()), { message: "service account/site mismatch" });

    const retained = await asRole(db, "service_role", "", meter(account, false));
    assert.equal(retained.rows[0].receipt, initial);
    assert.ok((await asRole(db, "service_role", "", meter(directAccount))).rows[0].receipt);
    await db.query("update public.observer_sites set digital_observer_organization_id=$1 where id=$2", [orgB, site]);
    await denied();
    await assert.rejects(asRole(db, "service_role", "", meter(directAccount)), { message: "service account/site mismatch" });
    await db.query("update public.observer_sites set digital_observer_organization_id=$1 where id=$2", [orgA, site]);

    await db.query("update public.digital_observer_service_accounts set account_status='revoked', revoked_at=now() where id=$1", [account]);
    await denied();
    await db.query(`update public.digital_observer_service_accounts set account_status='active', revoked_at=null,
      created_at=now()-interval '2 days', expires_at=now()-interval '1 day' where id=$1`, [account]);
    await denied();
    await db.query("update public.digital_observer_service_accounts set expires_at=now()+interval '1 day' where id=$1", [account]);

    await db.query("update public.digital_observer_partner_customers set customer_status='suspended' where id=$1", [customer]);
    await denied();
    await db.query("update public.digital_observer_partner_customers set customer_status='active' where id=$1", [customer]);
    await db.query("delete from public.digital_observer_service_account_sites where service_account_id=$1 and observer_site_id=$2", [account, site]);
    await denied();
    await db.query("insert into public.digital_observer_service_account_sites values ($1,$2,now())", [account, site]);
    await db.query("delete from public.digital_observer_partner_customer_sites where partner_customer_id=$1 and observer_site_id=$2", [customer, site]);
    await denied();

    const buckets = await db.query(`select service_account_id, request_count::int, success_count::int, failure_count::int
      from public.digital_observer_external_api_usage_buckets order by service_account_id`);
    assert.deepEqual(buckets.rows, [
      { service_account_id: account, request_count: 2, success_count: 1, failure_count: 1 },
      { service_account_id: directAccount, request_count: 1, success_count: 1, failure_count: 0 },
    ]);
  });
});
