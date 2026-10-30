import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { config, sql } from "./local-database.mjs";

assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.equal(sql("select exists(select 1 from development_metadata.migrations where version='20261019030000' and schema_fingerprint is not null);").trim(), "t");

const secretFile = resolve(config.runtimeRoot, "push42-api.private.env");
if (!existsSync(secretFile)) {
  const credential = `dosvc_${randomBytes(32).toString("base64url")}`;
  const pepper = randomBytes(32).toString("base64url");
  writeFileSync(secretFile, `DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER=${pepper}\nDIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL=${credential}\n`, { mode: 0o600, flag: "wx" });
}
const secrets = parseEnv(readFileSync(secretFile, "utf8"));
assert.match(secrets.DIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL ?? "", /^dosvc_[A-Za-z0-9_-]{40,}$/);
assert.ok((secrets.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER ?? "").length >= 16);
const credentialHash = createHmac("sha256", secrets.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER).update(secrets.DIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL).digest("hex");

const accountId = "00000000-0000-4000-8000-000000000a42";
const credentialId = "00000000-0000-4000-8000-000000000b42";
const organizationId = "00000000-0000-4000-8000-000000000d41";
const siteId = "00000000-0000-4000-8000-000000000e01";
const ownerId = "00000000-0000-4000-8000-000000000f01";

sql(`begin;
update public.observer_site_subscriptions set
  entitlement_snapshot=entitlement_snapshot || '{"api_access":true}'::jsonb,
  package_limits_snapshot=package_limits_snapshot || '{"api_access":true}'::jsonb
where id='00000000-0000-4000-8000-000000000c41'
  and metadata @> '{"environment":"DEVELOPMENT","synthetic":true,"push":41}'::jsonb;

insert into public.digital_observer_entitlement_grants(
  id,stable_grant_id,observer_site_id,subscription_id,entitlement_key,boolean_value,grant_status,effective_until,metadata
) values (
  '00000000-0000-4000-8000-000000000c43','development:push42:site-a:api-access',
  '${siteId}','00000000-0000-4000-8000-000000000c41','api_access',true,'active',now()+interval '90 days',
  '{"environment":"DEVELOPMENT","synthetic":true,"push":42,"external_proof":false}'::jsonb
) on conflict(subscription_id,entitlement_key) do update set boolean_value=true,grant_status='active',effective_until=excluded.effective_until,
  metadata=excluded.metadata,updated_at=now();

insert into public.digital_observer_service_accounts(
  id,organization_id,display_name,account_status,all_sites,permissions,expires_at,created_by,metadata
) values (
  '${accountId}','${organizationId}','PUSH 42 independent consumer','active',false,
  '["camera.live.view","events.view","evidence.view","investigation.run","watch_rules.manage","notifications.manage"]'::jsonb,
  now()+interval '90 days','${ownerId}','{"environment":"DEVELOPMENT","synthetic":true,"push":42}'::jsonb
) on conflict(id) do update set account_status='active',revoked_at=null,permissions=excluded.permissions,expires_at=excluded.expires_at,
  metadata=excluded.metadata,updated_at=now();

insert into public.digital_observer_service_account_sites(service_account_id,observer_site_id)
values('${accountId}','${siteId}') on conflict do nothing;

update public.digital_observer_service_account_credentials set revoked_at=now(),rotation_reason='push42 synthetic refresh'
where service_account_id='${accountId}' and id<>'${credentialId}' and revoked_at is null;
insert into public.digital_observer_service_account_credentials(
  id,service_account_id,credential_hash,credential_prefix,issued_at,expires_at,revoked_at,created_by,metadata
) values (
  '${credentialId}','${accountId}','${credentialHash}',left('${secrets.DIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL}',14),now(),now()+interval '90 days',null,'${ownerId}',
  '{"environment":"DEVELOPMENT","synthetic":true,"push":42,"raw_credential_stored":false}'::jsonb
) on conflict(id) do update set credential_hash=excluded.credential_hash,credential_prefix=excluded.credential_prefix,
  issued_at=excluded.issued_at,expires_at=excluded.expires_at,revoked_at=null,metadata=excluded.metadata;

insert into public.digital_observer_external_integration_sources(
  id,organization_id,observer_site_id,integration_kind,display_name,provider_key,provider_mode,connection_status,
  capability_manifest,real_proof_status,created_by
) values (
  '00000000-0000-4000-8000-000000000942','${organizationId}','${siteId}','vms','Synthetic disabled VMS','push42-synthetic-vms',
  'disabled','configured_inactive','{"deep_link":false,"federation":false}'::jsonb,'not_proven','${ownerId}'
) on conflict(observer_site_id,provider_key) do update set provider_mode='disabled',connection_status='configured_inactive',real_proof_status='not_proven';
commit;`);

const receipt = JSON.parse(sql(`select json_build_object(
  'account',(select count(*) from public.digital_observer_service_accounts where id='${accountId}' and account_status='active' and organization_id='${organizationId}'),
  'site_scope',(select count(*) from public.digital_observer_service_account_sites where service_account_id='${accountId}' and observer_site_id='${siteId}'),
  'credential',(select count(*) from public.digital_observer_service_account_credentials where id='${credentialId}' and revoked_at is null and credential_hash='${credentialHash}'),
  'api_entitlement',(select count(*) from public.digital_observer_entitlement_grants where observer_site_id='${siteId}' and entitlement_key='api_access' and boolean_value and grant_status='active'),
  'production_sources',(select count(*) from public.digital_observer_external_integration_sources where provider_mode='production'),
  'synthetic_source',(select count(*) from public.digital_observer_external_integration_sources where id='00000000-0000-4000-8000-000000000942' and connection_status='configured_inactive' and real_proof_status='not_proven')
);`).trim());
assert.deepEqual(receipt, { account: 1, site_scope: 1, credential: 1, api_entitlement: 1, production_sources: 0, synthetic_source: 1 });
console.log(JSON.stringify({ status: "PASS", environment: config.environment, ...receipt, rawCredentialPrinted: false, productionAccess: false, providerContact: false }));
