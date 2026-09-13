import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { projectTuitionPeriod } from '../../lib/domain/tuition-ledger.ts';
const read = path => readFileSync(path, 'utf8');
const sql = read('supabase/migrations/20260913194000_management_parent_tuition_ledger.sql');
const garden = read('app/api/garden/tuition-ledger/route.ts');
const parent = read('app/api/parent/tuition-ledger/route.ts');
const old = read('app/api/garden/child-payments/route.ts');

test('period arithmetic, partial payment and overdue projection are server derived', () => {
  const base = { id: 'x', garden_id: 'g', enrollment_id: 'e', period_start: '2026-09-01', period_end: '2026-09-30', due_at: '2026-09-10', base_amount: 100, adjustment_total: -10, settled_total: 40, status: 'pending' };
  assert.deepEqual((({ amount_due, amount_settled, outstanding, status }) => ({ amount_due, amount_settled, outstanding, status }))(projectTuitionPeriod(base, '2026-09-11')), { amount_due: 90, amount_settled: 40, outstanding: 50, status: 'overdue' });
  assert.equal(projectTuitionPeriod({ ...base, status: 'partially_paid' }, '2026-09-11').status, 'overdue');
});

test('ledger periods and entries are enrollment scoped and idempotent', () => {
  assert.match(sql, /unique\(enrollment_id, period_start\)/);
  assert.match(sql, /unique\(garden_id,source_key\)/);
  assert.match(sql, /for update/);
  assert.match(sql, /tuition_unit_price_snapshot/);
  assert.match(sql, /tuition_partial_period_review_required/);
  assert.match(sql, /agreed_partial_amount numeric default null/);
  assert.match(sql, /unapplied_credit/);
  assert.match(sql, /unapplied_credit_total=unapplied_credit_total\+excess/);
  assert.match(sql, /tuition_due_day/);
  assert.match(sql, /activation_evidence_requires_period_allocation/);
  assert.match(sql, /historical_tuition_price_requires_review/);
  assert.doesNotMatch(sql, /kindergarten_subscriptions/);
});

test('only management mutates periods and old child-level paid switch is retired', () => {
  assert.match(garden, /getManagementGardenContext/);
  assert.match(sql, /can_manage_garden\(p.garden_id\) is distinct from true/);
  assert.match(sql, /revoke all on public.tuition_billing_periods, public.tuition_ledger_entries/);
  assert.match(old, /410/);
  assert.doesNotMatch(parent, /export async function POST/);
  assert.match(parent, /guardianCanAccessChild/);
});
