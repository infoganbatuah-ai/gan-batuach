import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";

test("install-intent migration: real isolated PostgreSQL least-privilege and replay checks", async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table public.profiles(id uuid primary key);
      create table public.observer_sites(id uuid primary key, owner_profile_id uuid references public.profiles(id));
      create table public.observer_site_memberships(observer_site_id uuid, profile_id uuid, active boolean, member_role text);
      create function public.is_admin() returns boolean language sql as 'select false';`);
    await db.exec(readFileSync("supabase/migrations/20260829010000_gateway_device_enrollment.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20260907020000_connector_install_intents.sql", "utf8"));
    const actor = randomUUID(), otherActor = randomUUID(), site = randomUUID(), otherSite = randomUUID();
    await db.query("insert into profiles values ($1),($2)", [actor, otherActor]);
    await db.query("insert into observer_sites values ($1,$2),($3,$4)", [site, actor, otherSite, otherActor]);
    async function issued(options = {}) {
      const id = randomUUID();
      await db.query(`insert into observer_connector_install_intents(id,observer_site_id,actor_profile_id,secret_hash,created_at,expires_at)
        values ($1,$2,$3,$4, now() - ($5::int * interval '1 minute'), now() + ($6::int * interval '1 minute'))`,
      [id, site, options.actor ?? actor, "a".repeat(64), options.expired ? 11 : 0, options.expired ? -1 : 10]);
      return id;
    }
    async function claim(id, options = {}) {
      return db.query("select public.claim_observer_connector_install_intent($1,$2,$3,$4,$5,$6,$7,$8,$9) as id",
        [id, options.secret ?? "a".repeat(64), options.site ?? site, options.enrollment ?? randomUUID(), "b".repeat(64),
          options.installation ?? `edge-${randomUUID().replaceAll("-", "")}`, "macos-arm64", "qa-v1", "qa-build"]);
    }
    await t.test("anon/authenticated cannot read/write/delete table or invoke privileged RPC", async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`set role ${role}`);
        for (const sql of ["select * from observer_connector_install_intents", "delete from observer_connector_install_intents", "update observer_connector_install_intents set state='CANCELLED'", "insert into observer_connector_install_intents(id) values(gen_random_uuid())"])
          await assert.rejects(db.query(sql), /permission denied/);
        await assert.rejects(claim(randomUUID()), /permission denied/);
        await db.exec("reset role");
      }
    });
    await t.test("wrong site, expired token and wrong proof fail closed without enrollment", async () => {
      await assert.rejects(claim(await issued(), { site: otherSite }), /INSTALL_INTENT_UNAVAILABLE/);
      await assert.rejects(claim(await issued({ expired: true })), /INSTALL_INTENT_UNAVAILABLE/);
      await assert.rejects(claim(await issued(), { secret: "c".repeat(64) }), /INSTALL_INTENT_UNAVAILABLE/);
      assert.equal((await db.query("select count(*)::int as n from video_gateway_device_enrollments")).rows[0].n, 0);
    });
    await t.test("role removal and billing membership cannot claim installation", async () => {
      const id = await issued({ actor: otherActor });
      await db.query("insert into observer_site_memberships values($1,$2,true,'billing')", [site, otherActor]);
      await assert.rejects(claim(id), /INSTALL_AUTHORIZATION_REVOKED/);
      await db.query("update observer_site_memberships set member_role='admin',active=false where profile_id=$1", [otherActor]);
      await assert.rejects(claim(id), /INSTALL_AUTHORIZATION_REVOKED/);
    });
    await t.test("service-role claim binds fixed actor/site and erases one-time bearer hash", async () => {
      const id = await issued(), enrollment = randomUUID();
      await db.exec("set role service_role");
      await claim(id, { enrollment });
      await db.exec("reset role");
      const row = (await db.query("select * from video_gateway_device_enrollments where id=$1", [enrollment])).rows[0];
      assert.equal(row.observer_site_id, site); assert.equal(row.created_by_profile_id, actor);
      assert.equal(row.status, "pending"); assert.equal(row.metadata.device_type, "SOFTWARE_CONNECTOR");
      assert.equal((await db.query("select secret_hash from observer_connector_install_intents where id=$1", [id])).rows[0].secret_hash, "0".repeat(64));
      await assert.rejects(claim(id), /INSTALL_INTENT_UNAVAILABLE/);
    });
    await t.test("repeated installation identity cannot create second active enrollment", async () => {
      const installation = `edge-${randomUUID().replaceAll("-", "")}`;
      await claim(await issued(), { installation });
      await assert.rejects(claim(await issued(), { installation }), /INSTALLATION_ALREADY_ENROLLED/);
    });
    await t.test("bounded lifetime and table RLS are enforced", async () => {
      assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.observer_connector_install_intents'::regclass")).rows[0].relrowsecurity, true);
      await assert.rejects(db.query("insert into observer_connector_install_intents(id,observer_site_id,actor_profile_id,secret_hash,expires_at) values($1,$2,$3,$4,now()+interval '1 hour')", [randomUUID(), site, actor, "a".repeat(64)]), /bounded_install_intent/);
    });
  } finally { await db.close(); }
});
