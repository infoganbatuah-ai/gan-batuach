import assert from "node:assert/strict";
import { config, sql } from "./local-database.mjs";

assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.equal(sql("select exists(select 1 from development_metadata.migrations where version='20261019020000' and schema_fingerprint is not null);").trim(), "t");

const conflictCount = Number(sql(`select count(*) from public.observer_site_subscriptions
  where observer_site_id='00000000-0000-4000-8000-000000000e01'
  and not (id='00000000-0000-4000-8000-000000000c41'
    and metadata @> '{"environment":"DEVELOPMENT","synthetic":true,"push":41}'::jsonb);`).trim());
assert.equal(conflictCount, 0, "Site A already has a non-PUSH-41 subscription; synthetic QA must not overwrite it");

sql(`begin;
insert into public.digital_observer_organizations(
  id,owner_profile_id,name,organization_type,active,slug,status,default_timezone,support_tier,metadata
) values
  ('00000000-0000-4000-8000-000000000d41','00000000-0000-4000-8000-000000000f01','QA Enterprise A','enterprise',true,'qa-enterprise-a','active','Asia/Jerusalem','standard','{"environment":"DEVELOPMENT","synthetic":true,"push":41}'),
  ('00000000-0000-4000-8000-000000000d42','00000000-0000-4000-8000-000000000f02','QA Enterprise B','enterprise',true,'qa-enterprise-b','active','Asia/Jerusalem','standard','{"environment":"DEVELOPMENT","synthetic":true,"push":41}')
on conflict(id) do nothing;

update public.observer_sites set digital_observer_organization_id=case
  when id='00000000-0000-4000-8000-000000000e01' then '00000000-0000-4000-8000-000000000d41'::uuid
  else '00000000-0000-4000-8000-000000000d42'::uuid end
where id in ('00000000-0000-4000-8000-000000000e01','00000000-0000-4000-8000-000000000e02');

insert into public.digital_observer_organization_memberships(
  organization_id,profile_id,enterprise_role,active,all_sites,accepted_at,metadata
) values
  ('00000000-0000-4000-8000-000000000d41','00000000-0000-4000-8000-000000000f01','organization_owner',true,true,now(),'{"environment":"DEVELOPMENT","synthetic":true}'),
  ('00000000-0000-4000-8000-000000000d42','00000000-0000-4000-8000-000000000f02','organization_owner',true,true,now(),'{"environment":"DEVELOPMENT","synthetic":true}')
on conflict(organization_id,profile_id) do nothing;

insert into public.digital_observer_auth_policies(organization_id,updated_by) values
  ('00000000-0000-4000-8000-000000000d41','00000000-0000-4000-8000-000000000f01'),
  ('00000000-0000-4000-8000-000000000d42','00000000-0000-4000-8000-000000000f02')
on conflict(organization_id) do nothing;

insert into public.observer_site_subscriptions(
  id,observer_site_id,status,subscription_status,trial_start,trial_end,entitlement_status,
  payment_provider,payment_provider_mode,provider_outcome,commercial_state,
  entitlement_snapshot,package_limits_snapshot,metadata
) values (
  '00000000-0000-4000-8000-000000000c41','00000000-0000-4000-8000-000000000e01','trial','trial',now(),'2099-01-01T00:00:00Z','trial',
  'mock','disabled','none','trial','{"notifications":true}'::jsonb,'{"notifications":true}'::jsonb,
  '{"environment":"DEVELOPMENT","synthetic":true,"push":41,"real_charge_performed":false,"provider_contacted":false}'::jsonb
) on conflict(id) do nothing;

insert into public.digital_observer_entitlement_grants(
  id,stable_grant_id,observer_site_id,subscription_id,entitlement_key,boolean_value,grant_status,effective_until,metadata
) values (
  '00000000-0000-4000-8000-000000000c42','development:push41:site-a:notifications',
  '00000000-0000-4000-8000-000000000e01','00000000-0000-4000-8000-000000000c41',
  'notifications',true,'active','2099-01-01T00:00:00Z',
  '{"environment":"DEVELOPMENT","synthetic":true,"push":41,"external_proof":false}'::jsonb
) on conflict(subscription_id,entitlement_key) do nothing;
commit;`);

const receipt = JSON.parse(sql(`select json_build_object(
  'organizations',(select count(*) from public.digital_observer_organizations where id in ('00000000-0000-4000-8000-000000000d41','00000000-0000-4000-8000-000000000d42')),
  'linked_sites',(select count(*) from public.observer_sites where (id='00000000-0000-4000-8000-000000000e01' and digital_observer_organization_id='00000000-0000-4000-8000-000000000d41') or (id='00000000-0000-4000-8000-000000000e02' and digital_observer_organization_id='00000000-0000-4000-8000-000000000d42')),
  'memberships',(select count(*) from public.digital_observer_organization_memberships where organization_id in ('00000000-0000-4000-8000-000000000d41','00000000-0000-4000-8000-000000000d42') and active),
  'sms_enabled',(select count(*) from public.digital_observer_auth_policies where organization_id in ('00000000-0000-4000-8000-000000000d41','00000000-0000-4000-8000-000000000d42') and (sms_authentication_enabled or automatic_sms_fallback_enabled)),
  'synthetic_subscription',(select count(*) from public.observer_site_subscriptions where id='00000000-0000-4000-8000-000000000c41' and payment_provider_mode='disabled' and provider_outcome='none' and metadata @> '{"real_charge_performed":false,"provider_contacted":false}'::jsonb),
  'notification_entitlement',(select count(*) from public.digital_observer_entitlement_grants where id='00000000-0000-4000-8000-000000000c42' and entitlement_key='notifications' and boolean_value and grant_status='active')
);`).trim());
assert.deepEqual(receipt, { organizations: 2, linked_sites: 2, memberships: 2, sms_enabled: 0, synthetic_subscription: 1, notification_entitlement: 1 });
console.log(JSON.stringify({ status: "PASS", environment: config.environment, ...receipt, productionAccess: false, providerContact: false, realCharge: false }));
