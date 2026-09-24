// Transactional, rollback-only verification against the guarded synthetic Development DB.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { config, sql } from '../development/local-database.mjs';

assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
const migration = readFileSync(new URL('../../supabase/migrations/20260920160000_management_tuition_audit_role_fix.sql', import.meta.url), 'utf8');
assert.equal(migration.match(/create or replace function public\./g)?.length, 3);
const garden = '00000000-0000-4000-8000-000000000601';
const enrollment = 'bd73a084-c60d-4ff3-9f57-f108cacdf36a';
const period = '4d799075-24aa-4415-a4ef-2cdedbededce';
const manager = '00000000-0000-4000-8000-000000000201';
const before = sql("select settled_total,coalesce((select tuition_due_day::text from public.gardens where id='" + garden + "'),'NULL') from public.tuition_billing_periods where id='" + period + "';").trim();
assert.ok(before.startsWith('0.00|'), 'Synthetic period must be unsettled before migration QA');

const result = sql("begin;\n" + migration + "\n" +
  "select set_config('request.jwt.claim.sub','" + manager + "',true);\n" +
  "set local role authenticated;\n" +
  "select 'role='||public.current_role()::text;\n" +
  "select 'manual='||(public.apply_manual_tuition_entry('" + period + "','manual_settlement',40,'bank_transfer','GB-M35 rollback-only probe',null,'gb-m35-rollback-only-audit-fix')->>'amount_settled');\n" +
  "reset role;\n" +
  "select 'manual_audit='||count(*) from public.audit_logs where entity_id='" + period + "' and action='tuition_ledger_entry_recorded' and actor_role=public.current_role();\n" +
  "set local role authenticated;\n" +
  "select 'due_day='||public.set_garden_tuition_due_day('" + garden + "',5);\n" +
  "update public.child_kindergarten_enrollments set start_date='2026-10-15' where id='" + enrollment + "';\n" +
  "select 'partial='||(public.ensure_tuition_billing_period('" + enrollment + "','2026-10-01',50,'GB-M35 synthetic partial month')->>'base_amount');\n" +
  "reset role;\n" +
  "select 'partial_audit='||count(*) from public.audit_logs where garden_id='" + garden + "' and action='tuition_partial_period_agreed' and actor_role=public.current_role();\n" +
  "rollback;");
assert.match(result, /role=manager/);
assert.match(result, /manual=40\.00/);
assert.match(result, /manual_audit=1/);
assert.match(result, /due_day=5/);
assert.match(result, /partial=50\.00/);
assert.match(result, /partial_audit=1/);
const after = sql("select settled_total,coalesce((select tuition_due_day::text from public.gardens where id='" + garden + "'),'NULL') from public.tuition_billing_periods where id='" + period + "';").trim();
assert.equal(after, before, 'Rollback-only QA changed canonical synthetic tuition state');
console.log('GB-M35 tuition audit role forward migration PASS: three RPCs, audit enum, rollback-only');
