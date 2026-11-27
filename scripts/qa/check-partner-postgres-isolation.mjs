import assert from "node:assert/strict";
import test from "node:test";
import { asRole, currentScope, partnerPostgresFixture, partnerPostgresIds } from "./partner-postgres-fixture.mjs";

const { memberA, memberB, partnerAdmin, orgA, orgB, site, source, customer, account, session, directAccount } = partnerPostgresIds;

const readCameras = "select id from public.digital_observer_camera_sources";
const readSessions = "select id from public.digital_observer_embedded_sessions";
const meter = (id = account, success = true) =>
  `select public.record_digital_observer_external_api_usage('${id}', '${site}', 'cameras.list', '2026-11-27T10:00:00Z', ${success}) as receipt`;

test("PostgreSQL RLS semantics on the installed embedded engine", async (t) => {
  const db = await partnerPostgresFixture(t);
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
