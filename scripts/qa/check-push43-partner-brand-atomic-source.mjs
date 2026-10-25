import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../review-only/push43-partner-brand-atomic/forward.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../../lib/domain/digital-observer/partner-platform-service.ts", import.meta.url), "utf8");
const oldMigration = readFileSync(new URL("../../supabase/migrations/20261019040000_digital_observer_push43_oem_sdk.sql", import.meta.url), "utf8");
const signature = "save_digital_observer_partner_brand_atomic(uuid,uuid,uuid,jsonb,text,timestamptz)";

test("candidate is guarded review-only SQL and not an active migration or adapter", () => {
  assert.match(sql, /^-- REVIEW ONLY/);
  assert.ok(sql.indexOf("begin;") < sql.indexOf("REVIEW_ONLY_PARTNER_BRAND_SQL_MUST_NOT_RUN"));
  assert.ok(sql.indexOf("REVIEW_ONLY_PARTNER_BRAND_SQL_MUST_NOT_RUN") < sql.indexOf("create or replace function"));
  assert.ok(!/^commit;/im.test(sql));
  assert.ok(!service.includes(".rpc(\"save_digital_observer_partner_brand_atomic\""));
  assert.ok(!oldMigration.includes("save_digital_observer_partner_brand_atomic"));
});

test("exact RPC is invoker-only with pinned search path and narrow EXECUTE", () => {
  assert.match(sql, /returns public\.digital_observer_partner_brand_profiles\s+language plpgsql security invoker set search_path = ''/i);
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/);
  assert.match(sql, /revoke all on function public\.save_digital_observer_partner_brand_atomic\(uuid,uuid,uuid,jsonb,text,timestamptz\)\s+from public,anon,authenticated;/i);
  assert.match(sql, /grant execute on function public\.save_digital_observer_partner_brand_atomic\(uuid,uuid,uuid,jsonb,text,timestamptz\)\s+to service_role;/i);
  assert.ok(sql.includes(signature));
  assert.ok(!/security definer/i.test(sql));
});

test("ownership locks precede brand write and mandatory audit follows in one body", () => {
  const orgLock = sql.indexOf("where id = requested_organization_id and status = 'active' for share");
  const partnerLock = sql.indexOf("and partner_status = 'sandbox' for update");
  const brandLock = sql.indexOf("where partner_id = partner.id for update");
  const write = sql.indexOf("update public.digital_observer_partner_brand_profiles b set");
  const audit = sql.indexOf("insert into public.digital_observer_enterprise_audit_events");
  assert.ok(orgLock >= 0 && orgLock < partnerLock && partnerLock < brandLock && brandLock < write && write < audit);
  assert.match(sql, /owner_org\.owner_profile_id <> requested_actor_profile_id/);
  assert.match(sql, /enterprise_role in \('organization_owner','organization_admin'\) for share/);
  assert.match(sql, /expected_updated_at is distinct from previous\.updated_at/);
  assert.match(sql, /b\.updated_at = expected_updated_at/);
});

test("payload cannot write system columns or silently retain verification on domain change", () => {
  const allowed = sql.slice(sql.indexOf("where field.name not in ("), sql.indexOf("  ) then\n    raise exception 'PARTNER_BRAND_FIELD_DENIED'"));
  for (const forbidden of ["partner_id", "organization_id", "domain_status", "updated_by", "updated_at", "metadata"]) {
    assert.ok(!allowed.includes(`'${forbidden}'`), forbidden);
  }
  assert.match(sql, /next_domain is not distinct from previous\.customer_domain\s+then previous\.domain_status else 'unverified'/);
  assert.match(sql, /jsonb_build_object\('domain_verified',next_domain_status='verified_sandbox'\)/);
  assert.match(sql, /jsonb_typeof\(requested_brand->'legally_required_notices'\) is distinct from 'array'/);
});
