import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const { PGlite } = await import(process.env.CAMERA_QUEUE_PGLITE_MODULE || "@electric-sql/pglite");
const { pgcrypto } = await import(process.env.CAMERA_QUEUE_PGLITE_MODULE
  ? new URL("./contrib/pgcrypto.js", pathToFileURL(process.env.CAMERA_QUEUE_PGLITE_MODULE)).href
  : "@electric-sql/pglite/contrib/pgcrypto");
const migration = readFileSync(new URL("../../supabase/migrations/20260908010000_managed_device_identity_hardening.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function fixture() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create extension if not exists pgcrypto;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table digital_observer_organizations(id uuid primary key);
    create table profiles(id uuid primary key);
    create table observer_sites(id uuid primary key,owner_profile_id uuid,digital_observer_organization_id uuid);
    create table observer_site_memberships(observer_site_id uuid,profile_id uuid,active boolean,member_role text);
    create table video_gateway_device_enrollments(
      id uuid primary key,status text not null default 'pending',device_name text not null,device_platform text not null,
      device_fingerprint text,poll_token_hash text not null,observer_site_id uuid,gateway_id uuid,refresh_token_hash text,
      expires_at timestamptz not null,approved_at timestamptz,delivered_at timestamptz,revoked_at timestamptz,
      created_by_profile_id uuid,metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),constraint video_gateway_device_enrollment_refresh_check
      check ((status in ('approved','delivered') and observer_site_id is not null and gateway_id is not null and refresh_token_hash is not null) or status not in ('approved','delivered'))
    );
    create table observer_connector_install_intents(id uuid primary key,observer_site_id uuid,actor_profile_id uuid,
      secret_hash text,state text,expires_at timestamptz,enrollment_id uuid,created_at timestamptz default now());
    create table digital_observer_camera_sources(id uuid primary key,observer_site_id uuid,status text,health_status text,
      metadata jsonb not null default '{}'::jsonb,updated_at timestamptz default now());
  `);
  await db.exec(migration);
  return db;
}

test("database lifecycle enforces one active key, replay, clone, rotation and replacement", async () => {
  const db = await fixture();
  await db.query("insert into profiles values($1)", [id(1)]);
  await db.query("insert into digital_observer_organizations values($1)", [id(2)]);
  await db.query("insert into observer_sites values($1,$2,$3)", [id(3), id(1), id(2)]);
  const key1 = "A".repeat(60), key2 = "B".repeat(60), key3 = "C".repeat(60);
  await db.query(`insert into video_gateway_device_enrollments(id,status,device_name,device_platform,poll_token_hash,expires_at,metadata)
    values($1,'pending','QA Connector','macos',$2,now()+interval '5 minutes',$3)`, [id(4), "0".repeat(64), {
    device_type: "SOFTWARE_CONNECTOR", credential_algorithm: "Ed25519", credential_public_key_spki: key1, software_version: "qa"
  }]);
  assert.equal((await db.query("select approve_observer_managed_device_enrollment($1,$2,$3,$4) ok", [id(4), id(3), id(5), id(1)])).rows[0].ok, true);
  await db.query("update video_gateway_device_enrollments set status='delivered' where id=$1", [id(4)]);
  const first = await db.query("select record_observer_managed_device_auth($1,1,$2,'runtime-a',1,now()) class", [id(4), "1".repeat(64)]);
  assert.equal(first.rows[0].class, "FIRST_SEEN");
  await assert.rejects(db.query("select record_observer_managed_device_auth($1,1,$2,'runtime-a',2,now())", [id(4), "1".repeat(64)]), /duplicate key|unique/i);
  const clone = await db.query("select record_observer_managed_device_auth($1,1,$2,'runtime-b',1,now()) class", [id(4), "2".repeat(64)]);
  assert.equal(clone.rows[0].class, "MANAGED_DEVICE_CLONE_SUSPECTED");
  assert.ok((await db.query("select clone_suspected_at from video_gateway_device_enrollments where id=$1", [id(4)])).rows[0].clone_suspected_at);

  await db.query("insert into observer_managed_device_credentials values($1,$2,2,'Ed25519',$3,'PENDING',now(),null,null,null)", [id(6), id(4), key2]);
  await db.query("insert into observer_managed_device_rotations(id,enrollment_id,old_credential_version,new_credential_version,challenge_hash,expires_at) values($1,$2,1,2,$3,now()+interval '5 minutes')", [id(7), id(4), "3".repeat(64)]);
  assert.equal((await db.query("select confirm_observer_managed_device_rotation($1,$2,2,$3) ok", [id(7), id(4), "3".repeat(64)])).rows[0].ok, true);
  const credentials = await db.query("select credential_version,credential_state from observer_managed_device_credentials where enrollment_id=$1 order by credential_version", [id(4)]);
  assert.deepEqual(credentials.rows, [{ credential_version: 1, credential_state: "RETIRED" }, { credential_version: 2, credential_state: "ACTIVE" }]);
  await assert.rejects(db.query("select record_observer_managed_device_auth($1,1,$2,'runtime-a',3,now())", [id(4), "4".repeat(64)]), /NOT_ACTIVE/);

  await db.query(`insert into video_gateway_device_enrollments(id,status,device_name,device_platform,poll_token_hash,observer_site_id,gateway_id,
    refresh_token_hash,expires_at,metadata,identity_scheme,deployment_profile,tenant_id,credential_version,lifecycle_state)
    values($1,'delivered','Legacy Gateway','macos',$2,$3,$4,$5,now()+interval '5 minutes',$6,'LEGACY_HMAC','PHYSICAL_GATEWAY',$7,0,'ACTIVE')`,
    [id(12), "6".repeat(64), id(3), id(13), "7".repeat(64), { device_type: "PHYSICAL_GATEWAY" }, id(2)]);
  await db.query("insert into observer_managed_device_credentials(id,enrollment_id,credential_version,algorithm,public_key_spki,credential_state) values($1,$2,1,'Ed25519',$3,'PENDING')", [id(14), id(12), "D".repeat(60)]);
  await db.query("insert into observer_managed_device_rotations(id,enrollment_id,old_credential_version,new_credential_version,challenge_hash,expires_at) values($1,$2,0,1,$3,now()+interval '5 minutes')", [id(15), id(12), "8".repeat(64)]);
  assert.equal((await db.query("select confirm_observer_managed_device_rotation($1,$2,1,$3) ok", [id(15), id(12), "8".repeat(64)])).rows[0].ok, true);
  const migrated = (await db.query("select identity_scheme,credential_version,refresh_token_hash,hardened_at from video_gateway_device_enrollments where id=$1", [id(12)])).rows[0];
  assert.equal(migrated.identity_scheme, "ED25519_V1");
  assert.equal(migrated.credential_version, 1);
  assert.equal(migrated.refresh_token_hash, null);
  assert.ok(migrated.hardened_at);

  await db.query(`insert into video_gateway_device_enrollments(id,status,device_name,device_platform,poll_token_hash,observer_site_id,gateway_id,
    expires_at,metadata,identity_scheme,deployment_profile,tenant_id,credential_version,lifecycle_state)
    values($1,'delivered','Replacement','macos',$2,$3,$4,now()+interval '5 minutes',$5,'ED25519_V1','SOFTWARE_CONNECTOR',$6,1,'ACTIVE')`,
    [id(8), "5".repeat(64), id(3), id(9), { device_type: "SOFTWARE_CONNECTOR" }, id(2)]);
  await db.query("insert into observer_managed_device_credentials(id,enrollment_id,credential_version,algorithm,public_key_spki,credential_state,activated_at) values($1,$2,1,'Ed25519',$3,'ACTIVE',now())", [id(10), id(8), key3]);
  await db.query("insert into digital_observer_camera_sources values($1,$2,'connected','healthy',$3,now())", [id(11), id(3), { gateway_id: id(5), active_monitoring: true }]);
  const replaced = await db.query("select replace_observer_managed_device($1,$2,$3,$4) result", [id(3), id(5), id(9), id(1)]);
  assert.equal(replaced.rows[0].result.source_count, 1);
  assert.equal((await db.query("select lifecycle_state from video_gateway_device_enrollments where id=$1", [id(4)])).rows[0].lifecycle_state, "REPLACED");
  await db.close();
});
