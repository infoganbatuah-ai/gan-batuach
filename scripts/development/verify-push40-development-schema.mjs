import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {config,sql} from './local-database.mjs';

const expectedTables=[
  'digital_observer_billing_accounts','digital_observer_checkout_intents','digital_observer_commercial_usage_events',
  'digital_observer_entitlement_grants','digital_observer_financial_audit','digital_observer_partner_billing_accounts',
  'digital_observer_payment_events','digital_observer_plan_versions','digital_observer_reconciliation_runs','digital_observer_refunds'
];
const scalar=(query)=>sql(query).trim();
const rows=JSON.parse(scalar(`select coalesce(json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity) order by c.relname),'[]'::json)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname = any(array[${expectedTables.map((name)=>`'${name}'`).join(',')}]);`));
assert.deepEqual(rows.map((row)=>row.table),expectedTables);
assert.ok(rows.every((row)=>row.rls===true));

const migrationPresent=scalar("select exists(select 1 from development_metadata.migrations where version='20261019010000');")==='t';
const productionCheckouts=Number(scalar("select count(*) from public.digital_observer_checkout_intents where provider_mode='production';"));
const productionPaymentEvents=Number(scalar("select count(*) from public.digital_observer_payment_events where provider_mode='production';"));
const unapprovedLegacyPlans=Number(scalar("select count(*) from public.digital_observer_plan_versions where metadata->>'source'='legacy_catalog_snapshot' and pricing_status='unapproved';"));
const entitlementSnapshots=Number(scalar("select count(*) from public.observer_site_subscriptions where entitlement_snapshot <> '{}'::jsonb;"));
const helperDefinition=scalar("select pg_get_functiondef('public.can_access_observer_site(uuid)'::regprocedure);");
const billingSummaryExists=scalar("select to_regprocedure('public.digital_observer_billing_site_summary(uuid)') is not null;")==='t';
const billingSitesExists=scalar("select to_regprocedure('public.digital_observer_billing_sites()') is not null;")==='t';
const anonymousPaymentRead=scalar("select has_table_privilege('anon','public.digital_observer_payment_events','SELECT');")==='t';
const authenticatedPaymentMutation=scalar("select has_table_privilege('authenticated','public.digital_observer_payment_events','INSERT') or has_table_privilege('authenticated','public.digital_observer_payment_events','UPDATE') or has_table_privilege('authenticated','public.digital_observer_payment_events','DELETE');")==='t';
const billingRoleBoundary=JSON.parse(scalar(`begin;
  insert into public.observer_site_memberships(observer_site_id,profile_id,member_role,active)
  values('00000000-0000-4000-8000-000000000e01','00000000-0000-4000-8000-000000000f02','billing',true)
  on conflict(observer_site_id,profile_id) do update set member_role='billing',active=true;
  set local role authenticated;
  select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000f02',true);
  select json_build_object(
    'operational',public.can_access_observer_site('00000000-0000-4000-8000-000000000e01'),
    'billing',public.digital_observer_can_read_billing_site('00000000-0000-4000-8000-000000000e01'),
    'manage',public.can_manage_observer_site('00000000-0000-4000-8000-000000000e01'),
    'listed',exists(select 1 from public.digital_observer_billing_sites() s where s.id='00000000-0000-4000-8000-000000000e01'));
  rollback;`));

assert.equal(migrationPresent,true);
assert.equal(productionCheckouts,0);
assert.equal(productionPaymentEvents,0);
assert.ok(unapprovedLegacyPlans>0);
assert.ok(entitlementSnapshots>0);
assert.ok(helperDefinition.includes("member_role = ANY (ARRAY['owner'::text, 'admin'::text, 'operator'::text, 'viewer'::text, 'reviewer'::text])") || helperDefinition.includes("'reviewer'"));
assert.ok(!helperDefinition.includes("'billing'"));
assert.equal(billingSummaryExists,true);
assert.equal(billingSitesExists,true);
assert.equal(anonymousPaymentRead,false);
assert.equal(authenticatedPaymentMutation,false);
assert.deepEqual(billingRoleBoundary,{operational:false,billing:true,manage:false,listed:true});

const integrationCommit=execFileSync('git',['rev-parse','origin/integration/development'],{encoding:'utf8'}).trim();
const receipt={observedAt:new Date().toISOString(),status:'PASS',environment:config.environment,integrationCommit,
  migration:'20261019010000_digital_observer_push40_commercial_billing.sql',migrationPresent,tables:rows,
  productionCheckouts,productionPaymentEvents,unapprovedLegacyPlans,entitlementSnapshots,billingRoleExcludedFromOperationalHelper:true,
  billingSummaryExists,billingSitesExists,anonymousPaymentRead,authenticatedPaymentMutation,billingRoleBoundary,productionAccess:false,
  limitations:['Isolated Development schema and role-boundary verification','No payment provider or Production environment contacted','Legacy prices remain unapproved']};
writeFileSync('development/database/push40-schema-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
