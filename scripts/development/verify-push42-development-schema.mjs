import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { config, sql } from "./local-database.mjs";

const expectedTables = ["digital_observer_external_api_request_receipts", "digital_observer_external_api_usage_buckets", "digital_observer_external_integration_sources"];
const scalar = (query) => sql(query).trim();
const tables = JSON.parse(scalar(`select coalesce(json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity) order by c.relname),'[]'::json)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array[${expectedTables.map((name) => `'${name}'`).join(",")}]);`));
assert.deepEqual(tables.map((row) => row.table), expectedTables);
assert.ok(tables.every((row) => row.rls));

const proof = JSON.parse(scalar(`select json_build_object(
  'migration_present',exists(select 1 from development_metadata.migrations where version='20261019030000' and schema_fingerprint is not null),
  'anonymous_receipts',has_table_privilege('anon','public.digital_observer_external_api_request_receipts','SELECT'),
  'authenticated_receipts',has_table_privilege('authenticated','public.digital_observer_external_api_request_receipts','SELECT'),
  'authenticated_source_write',has_table_privilege('authenticated','public.digital_observer_external_integration_sources','INSERT') or has_table_privilege('authenticated','public.digital_observer_external_integration_sources','UPDATE') or has_table_privilege('authenticated','public.digital_observer_external_integration_sources','DELETE'),
  'authenticated_usage_execute',has_function_privilege('authenticated','public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean)','EXECUTE'),
  'production_sources',(select count(*) from public.digital_observer_external_integration_sources where provider_mode='production'),
  'raw_secret_columns',(select count(*) from information_schema.columns where table_schema='public' and table_name in ('digital_observer_external_api_request_receipts','digital_observer_external_api_usage_buckets','digital_observer_external_integration_sources') and column_name in ('credential','secret','password','raw_video'))
);`));
assert.deepEqual(proof, { migration_present: true, anonymous_receipts: false, authenticated_receipts: false,
  authenticated_source_write: false, authenticated_usage_execute: false, production_sources: 0, raw_secret_columns: 0 });

const integrationCommit = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const receipt = { observedAt: new Date().toISOString(), status: "PASS", environment: config.environment, integrationCommit,
  migration: "20261019030000_digital_observer_push42_external_api.sql", tables, ...proof, productionAccess: false,
  limitations: ["Isolated Development schema only", "No external API consumer, VMS, webhook receiver, provider or Production environment contacted"] };
writeFileSync("development/database/push42-schema-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
