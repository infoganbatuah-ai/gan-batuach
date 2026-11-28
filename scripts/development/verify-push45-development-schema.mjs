import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { config, sql } from "./local-database.mjs";

const expectedTables = [
  "digital_observer_legal_approvals",
  "digital_observer_notice_acknowledgements",
  "digital_observer_notice_versions",
  "digital_observer_privacy_audit_events",
  "digital_observer_privacy_incidents",
  "digital_observer_privacy_policy_profiles"
];
const scalar = (query) => sql(query).trim();
const rows = JSON.parse(scalar(`select coalesce(json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity) order by c.relname),'[]'::json)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
  and c.relname=any(array[${expectedTables.map((name) => `'${name}'`).join(",")}]);`));
assert.deepEqual(rows.map((row) => row.table), expectedTables);
assert.ok(rows.every((row) => row.rls === true));

const migrationPresent = scalar("select exists(select 1 from development_metadata.migrations where version='20261019050000');") === "t";
const seededApprovals = Number(scalar("select count(*) from public.digital_observer_legal_approvals where approval_status='approved';"));
const activeUnapprovedProfiles = Number(scalar("select count(*) from public.digital_observer_privacy_policy_profiles where active and legal_decision_state<>'EXTERNALLY_APPROVED';"));
const automaticSensitiveRetention = Number(scalar("select count(*) from public.data_retention_policies where policy_key like 'do-%' and automatic_execution_allowed;"));
const anonymousAccess = scalar("select has_table_privilege('anon','public.digital_observer_privacy_policy_profiles','SELECT') or has_table_privilege('anon','public.digital_observer_legal_approvals','SELECT');") === "t";
const authenticatedApprovalMutation = scalar("select has_table_privilege('authenticated','public.digital_observer_legal_approvals','INSERT') or has_table_privilege('authenticated','public.digital_observer_legal_approvals','UPDATE') or has_table_privilege('authenticated','public.digital_observer_legal_approvals','DELETE');") === "t";
const auditTrigger = scalar("select exists(select 1 from pg_trigger where tgname='do_privacy_audit_block_mutation' and not tgisinternal);") === "t";
const observerColumns = JSON.parse(scalar(`select json_build_object(
  'privacy_request_site',exists(select 1 from information_schema.columns where table_schema='public' and table_name='privacy_rights_requests' and column_name='observer_site_id'),
  'privacy_request_external',exists(select 1 from information_schema.columns where table_schema='public' and table_name='privacy_rights_requests' and column_name='external_system_disposition'),
  'legal_hold_site',exists(select 1 from information_schema.columns where table_schema='public' and table_name='legal_holds' and column_name='observer_site_id'),
  'legal_hold_scope',exists(select 1 from information_schema.columns where table_schema='public' and table_name='legal_holds' and column_name='data_scope'))`));

assert.equal(migrationPresent, true);
assert.equal(seededApprovals, 0);
assert.equal(activeUnapprovedProfiles, 0);
assert.equal(automaticSensitiveRetention, 0);
assert.equal(anonymousAccess, false);
assert.equal(authenticatedApprovalMutation, false);
assert.equal(auditTrigger, true);
assert.deepEqual(observerColumns, { privacy_request_site: true, privacy_request_external: true, legal_hold_site: true, legal_hold_scope: true });

const integrationCommit = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const receipt = { observedAt: new Date().toISOString(), status: "PASS", environment: config.environment, integrationCommit,
  migration: "20261019050000_digital_observer_push45_privacy_compliance.sql", migrationPresent, tables: rows,
  seededApprovals, activeUnapprovedProfiles, automaticSensitiveRetention, anonymousAccess, authenticatedApprovalMutation,
  auditTrigger, observerColumns, productionAccess: false,
  limitations: ["Isolated Development schema proof only", "No counsel decision, provider, real customer, biometric, child-monitoring or Production system contacted"] };
writeFileSync("development/database/push45-schema-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
