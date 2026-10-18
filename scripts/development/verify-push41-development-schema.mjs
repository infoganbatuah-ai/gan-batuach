import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { config, sql } from "./local-database.mjs";

const expectedTables = [
  "digital_observer_auth_policies", "digital_observer_enterprise_audit_events", "digital_observer_enterprise_invitations",
  "digital_observer_enterprise_sessions", "digital_observer_organization_member_sites", "digital_observer_organization_memberships",
  "digital_observer_scim_connections", "digital_observer_scim_event_receipts", "digital_observer_scim_subjects",
  "digital_observer_service_account_credentials", "digital_observer_service_account_sites", "digital_observer_service_accounts",
  "digital_observer_slo_policies", "digital_observer_sso_connections", "digital_observer_sso_transactions"
];
const scalar = (query) => sql(query).trim();
const rows = JSON.parse(scalar(`select coalesce(json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity) order by c.relname),'[]'::json)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
  and c.relname=any(array[${expectedTables.map((name) => `'${name}'`).join(",")}]);`));
assert.deepEqual(rows.map((row) => row.table), expectedTables);
assert.ok(rows.every((row) => row.rls === true));

const migrationPresent = scalar("select exists(select 1 from development_metadata.migrations where version='20261019020000');") === "t";
const smsEnabled = Number(scalar("select count(*) from public.digital_observer_auth_policies where sms_authentication_enabled or automatic_sms_fallback_enabled;"));
const productionSso = Number(scalar("select count(*) from public.digital_observer_sso_connections where provider_mode='production';"));
const productionScim = Number(scalar("select count(*) from public.digital_observer_scim_connections where provider_mode='production';"));
const anonymousMembershipRead = scalar("select has_table_privilege('anon','public.digital_observer_organization_memberships','SELECT');") === "t";
const authenticatedCredentialRead = scalar("select has_table_privilege('authenticated','public.digital_observer_service_account_credentials','SELECT');") === "t";
const authenticatedMembershipMutation = scalar("select has_table_privilege('authenticated','public.digital_observer_organization_memberships','INSERT') or has_table_privilege('authenticated','public.digital_observer_organization_memberships','UPDATE') or has_table_privilege('authenticated','public.digital_observer_organization_memberships','DELETE');") === "t";
const auditTrigger = scalar("select exists(select 1 from pg_trigger where tgname='do_enterprise_audit_block_mutation' and not tgisinternal);") === "t";
const orgPermissionFunction = scalar("select to_regprocedure('public.digital_observer_has_org_permission(uuid,text,uuid)') is not null;") === "t";
const organizationUpdateGrants = JSON.parse(scalar(`select json_build_object(
  'status',has_column_privilege('authenticated','public.digital_observer_organizations','status','UPDATE'),
  'owner',has_column_privilege('authenticated','public.digital_observer_organizations','owner_profile_id','UPDATE'),
  'name',has_column_privilege('authenticated','public.digital_observer_organizations','name','UPDATE'))`));

const roleBoundary = JSON.parse(scalar(`begin;
  insert into public.digital_observer_organizations(id,owner_profile_id,name,organization_type,active,slug,status)
    values('00000000-0000-4000-8000-000000000d49','00000000-0000-4000-8000-000000000f01','PUSH41 boundary','enterprise',true,'push41-boundary','active');
  update public.observer_sites set digital_observer_organization_id='00000000-0000-4000-8000-000000000d49'
    where id='00000000-0000-4000-8000-000000000e01';
  insert into public.digital_observer_organization_memberships(organization_id,profile_id,enterprise_role,active,all_sites,accepted_at)
    values('00000000-0000-4000-8000-000000000d49','00000000-0000-4000-8000-000000000f02','billing_admin',true,true,now());
  set local role authenticated;
  select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000f02',true);
  select json_build_object(
    'camera',public.digital_observer_has_org_permission('00000000-0000-4000-8000-000000000d49','camera.live.view','00000000-0000-4000-8000-000000000e01'),
    'billing',public.digital_observer_has_org_permission('00000000-0000-4000-8000-000000000d49','billing.read','00000000-0000-4000-8000-000000000e01'),
    'manage',public.can_manage_observer_site('00000000-0000-4000-8000-000000000e01'),
    'operational',public.can_access_observer_site('00000000-0000-4000-8000-000000000e01'));
  rollback;`));

assert.equal(migrationPresent, true);
assert.equal(smsEnabled, 0);
assert.equal(productionSso, 0);
assert.equal(productionScim, 0);
assert.equal(anonymousMembershipRead, false);
assert.equal(authenticatedCredentialRead, false);
assert.equal(authenticatedMembershipMutation, false);
assert.equal(auditTrigger, true);
assert.equal(orgPermissionFunction, true);
assert.deepEqual(organizationUpdateGrants, { status: false, owner: false, name: true });
assert.deepEqual(roleBoundary, { camera: false, billing: true, manage: false, operational: false });

const integrationCommit = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const receipt = { observedAt: new Date().toISOString(), status: "PASS", environment: config.environment, integrationCommit,
  migration: "20261019020000_digital_observer_push41_enterprise_identity.sql", migrationPresent, tables: rows,
  smsEnabled, productionSso, productionScim, anonymousMembershipRead, authenticatedCredentialRead,
  authenticatedMembershipMutation, auditTrigger, orgPermissionFunction, organizationUpdateGrants, roleBoundary,
  productionAccess: false, limitations: ["Isolated Development schema and synthetic role-boundary proof", "No external IdP/SCIM provider or Production environment contacted", "No real enterprise scale claim"] };
writeFileSync("development/database/push41-schema-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
