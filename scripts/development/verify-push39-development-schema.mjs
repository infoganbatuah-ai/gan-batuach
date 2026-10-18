import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {config,sql} from './local-database.mjs';

const expectedTables=[
  'digital_observer_action_audit',
  'digital_observer_action_intents',
  'digital_observer_delivery_attempts',
  'digital_observer_escalation_steps',
  'digital_observer_escalations',
  'digital_observer_provider_callbacks',
  'digital_observer_provider_channels',
  'digital_observer_webhook_endpoints'
];
const scalar=(query)=>sql(query).trim();
const rows=JSON.parse(scalar(`select coalesce(json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity) order by c.relname),'[]'::json)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname = any(array[${expectedTables.map((name)=>`'${name}'`).join(',')}]);`));
assert.deepEqual(rows.map((row)=>row.table),expectedTables);
assert.ok(rows.every((row)=>row.rls===true));

const productionProviders=Number(scalar("select count(*) from public.digital_observer_provider_channels where provider_mode='production' or (active and provider_mode <> 'sandbox');"));
const enabledAutomationPolicies=Number(scalar('select count(*) from public.digital_observer_camera_automation_policies where enabled;'));
const serviceRoleCanAutonomouslyExecute=scalar("select has_function_privilege('service_role','public.enqueue_digital_guard_camera_command_v1(uuid,text,jsonb,text)','EXECUTE');")==='t';
const externalQaAttempts=Number(scalar("select count(*) from public.digital_observer_delivery_attempts where provider_key <> 'digital-observer-in-app' and created_at >= now() - interval '2 hours';"));
// The isolated Development baseline intentionally records only post-baseline
// applications in its own receipt table. It does not replay or depend on the
// Supabase CLI migration-history table used by fresh projects.
const migrationPresent=scalar("select exists(select 1 from development_metadata.migrations where version='20261018010000');")==='t';
const deliveryGrantMigrationPresent=scalar("select exists(select 1 from development_metadata.migrations where version='20261018204500');")==='t';
const authenticatedCanReadPush39Status=scalar("select has_column_privilege('authenticated','public.digital_observer_notification_deliveries','action_intent_id','SELECT') and has_column_privilege('authenticated','public.digital_observer_notification_deliveries','priority','SELECT') and has_column_privilege('authenticated','public.digital_observer_notification_deliveries','expires_at','SELECT');")==='t';

assert.equal(productionProviders,0);
assert.equal(enabledAutomationPolicies,0);
assert.equal(serviceRoleCanAutonomouslyExecute,false);
assert.equal(externalQaAttempts,0);
assert.equal(migrationPresent,true);
assert.equal(deliveryGrantMigrationPresent,true);
assert.equal(authenticatedCanReadPush39Status,true);

const integrationCommit=execFileSync('git',['rev-parse','origin/integration/development'],{encoding:'utf8'}).trim();
const receipt={observedAt:new Date().toISOString(),status:'PASS',environment:config.environment,integrationCommit,
  migrations:['20261018010000_digital_observer_push39_orchestration.sql','20261018204500_digital_observer_push39_delivery_read_grant.sql'],
  migrationPresent,deliveryGrantMigrationPresent,authenticatedCanReadPush39Status,tables:rows,
  productionProviders,enabledAutomationPolicies,serviceRoleCanAutonomouslyExecute,externalQaAttempts,
  productionAccess:false,limitations:['Read-only schema and policy verification','No external provider or Production environment contacted']};
writeFileSync('development/database/push39-schema-receipt.json',JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt));
