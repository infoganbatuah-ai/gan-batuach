import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(path, 'utf8');
const sql = read('supabase/migrations/20260913190000_management_platform_subscription_lifecycle.sql');
const admin = read('app/api/admin/subscriptions/route.ts');
const plans = read('app/api/admin/subscription-plans/route.ts');
const garden = read('app/api/garden/subscription/route.ts');
const oldApproval = read('app/api/admin/kindergarten-approval/route.ts');
const onboarding = read('app/api/kindergarten-onboarding/route.ts');
const billing = read('lib/domain/billing.ts');
const authFix = read('supabase/migrations/20260913193000_management_platform_subscription_auth_fix.sql');

test('product base price is one Admin-configurable plan, not legacy UI authority', () => {
  assert.match(sql, /name='Gan Batuach Fixed Kindergarten Plan' and price_amount=700/);
  assert.match(sql, /is_default=true/);
  assert.match(sql, /subscription_plans_code_version_unique/);
  assert.match(sql, /admin_version_platform_plan/);
  assert.match(plans, /admin_version_platform_plan/);
  assert.doesNotMatch(plans, /\.update\(row\)/);
  assert.match(onboarding, /\.eq\("is_default", true\)/);
});

test('subscription snapshots monthly price separately from annual commitment', () => {
  assert.match(sql, /unit_price_snapshot/);
  assert.match(sql, /billing_interval='monthly'/);
  assert.match(sql, /commitment_months/);
  assert.match(sql, /snapshot_platform_subscription_terms_trigger/);
  assert.match(sql, /ensure_platform_subscription/);
  assert.match(sql, /admin_adopt_platform_plan/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtext\(target_garden_id::text\)\)/);
  assert.match(sql, /kindergarten_subscriptions_one_current_per_garden_idx/);
});

test('manual activation and renewal are locked transitions without fake electronic payment', () => {
  assert.match(sql, /admin_transition_platform_subscription/);
  assert.match(sql, /where id=target_subscription_id for update/);
  assert.match(sql, /manual_reason_required/);
  assert.match(sql, /source_kind:='manual_admin'/);
  assert.match(sql, /requested_action='renew'/);
  assert.match(admin, /admin_transition_platform_subscription/);
  assert.doesNotMatch(admin, /billing_status: "paid"/);
  assert.doesNotMatch(oldApproval, /subscription_payments" as any\)\.insert/);
  assert.doesNotMatch(oldApproval, /"activate_after_payment", "request_corrections"/);
});

test('cancellation is Garden-authorized; plan and transition changes are Admin-only', () => {
  assert.match(sql, /request_platform_subscription_cancellation/);
  assert.match(sql, /public\.can_manage_garden\(target_garden_id\) is distinct from true/);
  assert.match(sql, /public\.is_admin\(\) is distinct from true then raise exception 'admin_required'/);
  assert.match(authFix, /public\.is_admin\(\) is distinct from true/);
  assert.doesNotMatch(authFix, /if not public\.is_admin\(\)/);
  assert.match(sql, /revoke insert, update, delete on public\.kindergarten_subscriptions/);
  assert.match(sql, /commercial_access/);
  assert.match(garden, /request_platform_subscription_cancellation/);
  assert.match(billing, /"grace_period"/);
});

test('Admin subscription APIs return HTTP authorization errors without redirecting', () => {
  for (const route of [admin, plans]) {
    assert.match(route, /getSessionProfile/);
    assert.match(route, /if \(!user\).*401/);
    assert.match(route, /profile\?\.role !== "admin".*403/);
    assert.doesNotMatch(route, /requireRole/);
  }
});
