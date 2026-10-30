import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { config, sql } from "./local-database.mjs";

const expectedTables = [
  "digital_observer_embedded_sessions",
  "digital_observer_partner_brand_profiles",
  "digital_observer_partner_customer_entitlements",
  "digital_observer_partner_customer_sites",
  "digital_observer_partner_customers",
  "digital_observer_partner_provisioning_receipts",
  "digital_observer_partner_service_accounts",
  "digital_observer_partners"
];
const scalar = (query) => sql(query).trim();
const tables = JSON.parse(scalar(`select coalesce(json_agg(json_build_object('table',c.relname,'rls',c.relrowsecurity) order by c.relname),'[]'::json)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array[${expectedTables.map((name) => `'${name}'`).join(",")}]);`));
assert.deepEqual(tables.map((row) => row.table), expectedTables);
assert.ok(tables.every((row) => row.rls));

const proof = JSON.parse(scalar(`select json_build_object(
  'migration_present',exists(select 1 from development_metadata.migrations where version='20261019040000' and schema_fingerprint is not null),
  'anonymous_readable',(select count(*) from (values
    (has_table_privilege('anon','public.digital_observer_partners','SELECT')),
    (has_table_privilege('anon','public.digital_observer_partner_customers','SELECT')),
    (has_table_privilege('anon','public.digital_observer_embedded_sessions','SELECT'))
  ) p(allowed) where allowed),
  'authenticated_writable',(select count(*) from information_schema.role_table_grants where grantee='authenticated'
    and table_schema='public' and table_name=any(array[${expectedTables.map((name) => `'${name}'`).join(",")}])
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
  'authenticated_private_receipts',has_table_privilege('authenticated','public.digital_observer_partner_provisioning_receipts','SELECT'),
  'authenticated_embedded_sessions',has_table_privilege('authenticated','public.digital_observer_embedded_sessions','SELECT'),
  'production_partners',(select count(*) from public.digital_observer_partners where partner_status not in ('draft','sandbox','suspended','revoked')),
  'raw_secret_columns',(select count(*) from information_schema.columns where table_schema='public'
    and table_name=any(array[${expectedTables.map((name) => `'${name}'`).join(",")}])
    and column_name in ('credential','secret','password','raw_token','raw_video')),
  'hashed_customer_references',(select count(*) from information_schema.columns where table_schema='public' and table_name='digital_observer_partner_customers' and column_name='external_customer_reference_hash'),
  'hashed_embedded_tokens',(select count(*) from information_schema.columns where table_schema='public' and table_name='digital_observer_embedded_sessions' and column_name='token_hash')
);`));
assert.deepEqual(proof, {
  migration_present: true,
  anonymous_readable: 0,
  authenticated_writable: 0,
  authenticated_private_receipts: false,
  authenticated_embedded_sessions: false,
  production_partners: 0,
  raw_secret_columns: 0,
  hashed_customer_references: 1,
  hashed_embedded_tokens: 1
});

const integrationCommit = execFileSync("git", ["rev-parse", "origin/integration/development"], { encoding: "utf8" }).trim();
const receipt = {
  observedAt: new Date().toISOString(), status: "PASS", environment: config.environment, integrationCommit,
  migration: "20261019040000_digital_observer_push43_oem_sdk.sql", tables, ...proof,
  productionAccess: false,
  limitations: ["Isolated Development schema only", "No real partner, customer, provider, domain or Production environment contacted"]
};
writeFileSync("development/database/push43-schema-receipt.json", `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt));
