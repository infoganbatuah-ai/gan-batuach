import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { config, sql } from "./local-database.mjs";

assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.equal(sql("select exists(select 1 from development_metadata.migrations where version='20261019040000' and schema_fingerprint is not null);").trim(), "t");

const privateFile = resolve(config.runtimeRoot, "push42-api.private.env");
assert.ok(existsSync(privateFile), "PUSH 42 Development credentials must exist");
const current = readFileSync(privateFile, "utf8");
if (!current.includes("DIGITAL_OBSERVER_PUSH43_CUSTOMER_CREDENTIAL=")) {
  writeFileSync(privateFile, `${current.trimEnd()}\nDIGITAL_OBSERVER_PUSH43_CUSTOMER_CREDENTIAL=dosvc_${randomBytes(32).toString("base64url")}\n`, { mode: 0o600 });
}
const secrets = parseEnv(readFileSync(privateFile, "utf8"));
assert.match(secrets.DIGITAL_OBSERVER_PUSH43_CUSTOMER_CREDENTIAL ?? "", /^dosvc_[A-Za-z0-9_-]{40,}$/);
const credentialHash = createHmac("sha256", secrets.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER)
  .update(secrets.DIGITAL_OBSERVER_PUSH43_CUSTOMER_CREDENTIAL).digest("hex");

const ids = {
  partner: "00000000-0000-4000-8000-000000004301",
  customerB: "00000000-0000-4000-8000-000000004302",
  customerC: "00000000-0000-4000-8000-000000004303",
  orgA: "00000000-0000-4000-8000-000000000d41",
  orgB: "00000000-0000-4000-8000-000000000d42",
  orgC: "00000000-0000-4000-8000-000000004304",
  siteB: "00000000-0000-4000-8000-000000000e02",
  siteC: "00000000-0000-4000-8000-000000004305",
  ownerA: "00000000-0000-4000-8000-000000000f01",
  ownerB: "00000000-0000-4000-8000-000000000f02",
  controlAccount: "00000000-0000-4000-8000-000000000a42",
  customerAccount: "00000000-0000-4000-8000-000000004306",
  customerCredential: "00000000-0000-4000-8000-000000004307",
  subscriptionB: "00000000-0000-4000-8000-000000004308",
  subscriptionC: "00000000-0000-4000-8000-000000004309",
  entitlementB: "00000000-0000-4000-8000-00000000430a",
  entitlementC: "00000000-0000-4000-8000-00000000430b"
};

sql(`begin;
insert into public.digital_observer_organizations(id,owner_profile_id,name,organization_type,active,slug,status,default_timezone,support_tier,metadata)
values ('${ids.orgC}','${ids.ownerB}','QA Partner Customer C','business',true,'qa-partner-customer-c','active','Asia/Jerusalem','standard','{"environment":"DEVELOPMENT","synthetic":true,"push":43}')
on conflict(id) do nothing;
insert into public.observer_sites(id,name,site_type,owner_profile_id,digital_observer_organization_id,monitoring_enabled,metadata)
values ('${ids.siteC}','QA Partner Customer C Site','business','${ids.ownerB}','${ids.orgC}',false,'{"environment":"DEVELOPMENT","synthetic":true,"push":43}')
on conflict(id) do nothing;

insert into public.observer_site_subscriptions(id,observer_site_id,status,subscription_status,trial_start,trial_end,entitlement_status,payment_provider,payment_provider_mode,provider_outcome,commercial_state,entitlement_snapshot,package_limits_snapshot,metadata)
values
 ('${ids.subscriptionB}','${ids.siteB}','trial','trial',now(),'2099-01-01T00:00:00Z','trial','mock','disabled','none','trial','{"api_access":true}'::jsonb,'{"api_access":true}'::jsonb,'{"environment":"DEVELOPMENT","synthetic":true,"push":43,"provider_contacted":false}'::jsonb),
 ('${ids.subscriptionC}','${ids.siteC}','trial','trial',now(),'2099-01-01T00:00:00Z','trial','mock','disabled','none','trial','{"api_access":true}'::jsonb,'{"api_access":true}'::jsonb,'{"environment":"DEVELOPMENT","synthetic":true,"push":43,"provider_contacted":false}'::jsonb)
on conflict(id) do nothing;
insert into public.digital_observer_entitlement_grants(id,stable_grant_id,observer_site_id,subscription_id,entitlement_key,boolean_value,grant_status,effective_until,metadata)
values
 ('${ids.entitlementB}','development:push43:customer-b:api','${ids.siteB}','${ids.subscriptionB}','api_access',true,'active','2099-01-01T00:00:00Z','{"environment":"DEVELOPMENT","synthetic":true,"push":43}'::jsonb),
 ('${ids.entitlementC}','development:push43:customer-c:api','${ids.siteC}','${ids.subscriptionC}','api_access',true,'active','2099-01-01T00:00:00Z','{"environment":"DEVELOPMENT","synthetic":true,"push":43}'::jsonb)
on conflict(subscription_id,entitlement_key) do update set boolean_value=true,grant_status='active',effective_until=excluded.effective_until;

insert into public.digital_observer_partners(id,organization_id,partner_key,partner_type,partner_status,retail_pricing_controlled_by_partner,allowed_embed_origins,created_by,metadata)
values ('${ids.partner}','${ids.orgA}','qa-push43-partner','oem','sandbox',true,'["http://127.0.0.1:3000"]'::jsonb,'${ids.ownerA}','{"environment":"DEVELOPMENT","synthetic":true,"push":43,"real_partner":false}')
on conflict(id) do update set partner_status='sandbox',allowed_embed_origins=excluded.allowed_embed_origins,metadata=excluded.metadata;
insert into public.digital_observer_partner_brand_profiles(partner_id,brand_name,product_name,primary_color,accent_color,privacy_url,terms_url,notification_sender_label,legally_required_notices,updated_by)
values ('${ids.partner}','QA Partner','Sentinel Home','#123456','#abcdef','https://example.invalid/privacy','https://example.invalid/terms','Sentinel','["Synthetic Development demonstration only"]'::jsonb,'${ids.ownerA}')
on conflict(partner_id) do update set brand_name=excluded.brand_name,product_name=excluded.product_name,primary_color=excluded.primary_color,accent_color=excluded.accent_color,legally_required_notices=excluded.legally_required_notices;

insert into public.digital_observer_partner_customers(id,partner_id,customer_organization_id,external_customer_reference_hash,external_customer_reference_hint,idempotency_key,customer_status,activated_at,created_by,metadata)
values
 ('${ids.customerB}','${ids.partner}','${ids.orgB}',encode(digest('qa-customer-b','sha256'),'hex'),'qa-…-b','push43-customer-b','active',now(),'${ids.ownerA}','{"environment":"DEVELOPMENT","synthetic":true,"push":43}'),
 ('${ids.customerC}','${ids.partner}','${ids.orgC}',encode(digest('qa-customer-c','sha256'),'hex'),'qa-…-c','push43-customer-c','active',now(),'${ids.ownerA}','{"environment":"DEVELOPMENT","synthetic":true,"push":43}')
on conflict(id) do update set customer_status='active',suspended_at=null,deprovisioned_at=null;
insert into public.digital_observer_partner_customer_sites(partner_customer_id,observer_site_id)
values ('${ids.customerB}','${ids.siteB}'),('${ids.customerC}','${ids.siteC}') on conflict do nothing;
insert into public.digital_observer_partner_customer_entitlements(partner_customer_id,entitlement_grant_id,assigned_by)
values ('${ids.customerB}','${ids.entitlementB}','${ids.ownerA}'),('${ids.customerC}','${ids.entitlementC}','${ids.ownerA}') on conflict do nothing;

insert into public.digital_observer_service_accounts(id,organization_id,display_name,account_status,all_sites,permissions,expires_at,created_by,metadata)
values ('${ids.customerAccount}','${ids.orgA}','PUSH 43 customer B SDK','active',false,
 '["camera.live.view","events.view","evidence.view","investigation.run","watch_rules.manage","notifications.manage"]'::jsonb,
 now()+interval '90 days','${ids.ownerA}','{"environment":"DEVELOPMENT","synthetic":true,"push":43}')
on conflict(id) do update set account_status='active',revoked_at=null,permissions=excluded.permissions,expires_at=excluded.expires_at,metadata=excluded.metadata;
insert into public.digital_observer_service_account_sites(service_account_id,observer_site_id)
values ('${ids.customerAccount}','${ids.siteB}') on conflict do nothing;
insert into public.digital_observer_service_account_credentials(id,service_account_id,credential_hash,credential_prefix,issued_at,expires_at,revoked_at,created_by,metadata)
values ('${ids.customerCredential}','${ids.customerAccount}','${credentialHash}',left('${secrets.DIGITAL_OBSERVER_PUSH43_CUSTOMER_CREDENTIAL}',14),now(),now()+interval '90 days',null,'${ids.ownerA}','{"environment":"DEVELOPMENT","synthetic":true,"push":43,"raw_credential_stored":false}'::jsonb)
on conflict(id) do update set credential_hash=excluded.credential_hash,credential_prefix=excluded.credential_prefix,issued_at=excluded.issued_at,expires_at=excluded.expires_at,revoked_at=null,metadata=excluded.metadata;
insert into public.digital_observer_partner_service_accounts(partner_id,service_account_id,partner_customer_id,access_kind)
values
 ('${ids.partner}','${ids.controlAccount}',null,'partner_control'),
 ('${ids.partner}','${ids.customerAccount}','${ids.customerB}','customer_resources')
on conflict(service_account_id) do update set partner_id=excluded.partner_id,partner_customer_id=excluded.partner_customer_id,access_kind=excluded.access_kind;
commit;`);

const receipt = JSON.parse(sql(`select json_build_object(
 'partners',(select count(*) from public.digital_observer_partners where id='${ids.partner}' and partner_status='sandbox'),
 'customers',(select count(*) from public.digital_observer_partner_customers where partner_id='${ids.partner}' and customer_status='active'),
 'site_links',(select count(*) from public.digital_observer_partner_customer_sites where partner_customer_id in ('${ids.customerB}','${ids.customerC}')),
 'entitlement_links',(select count(*) from public.digital_observer_partner_customer_entitlements where partner_customer_id in ('${ids.customerB}','${ids.customerC}')),
 'service_mappings',(select count(*) from public.digital_observer_partner_service_accounts where partner_id='${ids.partner}'),
 'production_partners',(select count(*) from public.digital_observer_partners where partner_status not in ('draft','sandbox','suspended','revoked')),
 'real_customers',(select count(*) from public.digital_observer_partners where not (metadata @> '{"synthetic":true}'::jsonb))
);`).trim());
assert.deepEqual(receipt, { partners: 1, customers: 2, site_links: 2, entitlement_links: 2, service_mappings: 2, production_partners: 0, real_customers: 0 });
console.log(JSON.stringify({ status: "PASS", environment: config.environment, ...receipt, productionAccess: false, providerContact: false, realCustomerProvisioning: false }));
