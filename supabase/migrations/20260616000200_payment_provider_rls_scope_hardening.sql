-- SECURITY FIX: payment and provider RLS scope hardening.
-- Payment/provider records are finance-sensitive. Garden staff/inspectors should not
-- inherit access through operational garden assignment.
--
-- This migration is intentionally defensive because some environments may not yet
-- include every later billing-readiness table. Existing tables are hardened; missing
-- optional readiness tables are skipped and can be hardened when their migrations run.

do $$
begin
  if to_regclass('public.subscription_reminders') is not null then
    execute 'drop policy if exists "subscription reminders by role" on public.subscription_reminders';
    execute 'drop policy if exists "subscription reminders manager admin read" on public.subscription_reminders';
    execute 'create policy "subscription reminders manager admin read" on public.subscription_reminders for select using (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;

  if to_regclass('public.payment_method_tokens') is not null then
    execute 'drop policy if exists "payment method tokens scoped read" on public.payment_method_tokens';
    execute 'drop policy if exists "payment method tokens manager admin read" on public.payment_method_tokens';
    execute 'create policy "payment method tokens manager admin read" on public.payment_method_tokens for select using (public.is_admin() or public.can_manage_garden(garden_id))';
    execute 'comment on policy "payment method tokens manager admin read" on public.payment_method_tokens is ''Finance-sensitive token references are visible only to admin or manager/owner of the garden. Staff and inspectors are excluded.''';
  end if;

  if to_regclass('public.subscription_checkout_sessions') is not null then
    execute 'drop policy if exists "checkout sessions scoped read" on public.subscription_checkout_sessions';
    execute 'drop policy if exists "checkout sessions manager admin read" on public.subscription_checkout_sessions';
    execute 'create policy "checkout sessions manager admin read" on public.subscription_checkout_sessions for select using (public.is_admin() or public.can_manage_garden(garden_id))';

    execute 'drop policy if exists "checkout sessions scoped insert" on public.subscription_checkout_sessions';
    execute 'drop policy if exists "checkout sessions manager admin insert" on public.subscription_checkout_sessions';
    execute 'create policy "checkout sessions manager admin insert" on public.subscription_checkout_sessions for insert with check (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;

  if to_regclass('public.payment_retry_attempts') is not null then
    execute 'drop policy if exists "payment retry attempts scoped read" on public.payment_retry_attempts';
    execute 'drop policy if exists "payment retry attempts manager admin read" on public.payment_retry_attempts';
    execute 'create policy "payment retry attempts manager admin read" on public.payment_retry_attempts for select using (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;

  if to_regclass('public.invoice_generation_jobs') is not null then
    execute 'drop policy if exists "invoice generation jobs scoped read" on public.invoice_generation_jobs';
    execute 'drop policy if exists "invoice generation jobs manager admin read" on public.invoice_generation_jobs';
    execute 'create policy "invoice generation jobs manager admin read" on public.invoice_generation_jobs for select using (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;

  if to_regclass('public.billing_notifications') is not null then
    execute 'drop policy if exists "billing notifications scoped read" on public.billing_notifications';
    execute 'drop policy if exists "billing notifications manager admin read" on public.billing_notifications';
    execute 'create policy "billing notifications manager admin read" on public.billing_notifications for select using (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;

  if to_regclass('public.billing_refund_credit_notes') is not null then
    execute 'drop policy if exists "refund credit notes scoped read" on public.billing_refund_credit_notes';
    execute 'drop policy if exists "refund credit notes manager admin read" on public.billing_refund_credit_notes';
    execute 'create policy "refund credit notes manager admin read" on public.billing_refund_credit_notes for select using (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;

  if to_regclass('public.kindergarten_payout_configurations') is not null then
    execute 'drop policy if exists "kindergarten payout scoped read" on public.kindergarten_payout_configurations';
    execute 'drop policy if exists "kindergarten payout manager admin read" on public.kindergarten_payout_configurations';
    execute 'create policy "kindergarten payout manager admin read" on public.kindergarten_payout_configurations for select using (public.is_admin() or public.can_manage_garden(garden_id))';

    execute 'drop policy if exists "kindergarten payout manager write" on public.kindergarten_payout_configurations';
    execute 'drop policy if exists "kindergarten payout manager admin write" on public.kindergarten_payout_configurations';
    execute 'create policy "kindergarten payout manager admin write" on public.kindergarten_payout_configurations for all using (public.is_admin() or public.can_manage_garden(garden_id)) with check (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;

  if to_regclass('public.parent_payment_authorizations') is not null then
    execute 'drop policy if exists "parent payment authorizations scoped read" on public.parent_payment_authorizations';
    execute 'drop policy if exists "parent payment authorizations finance scoped read" on public.parent_payment_authorizations';
    execute 'create policy "parent payment authorizations finance scoped read" on public.parent_payment_authorizations for select using (public.is_admin() or public.can_manage_garden(garden_id) or parent_profile_id = auth.uid())';

    execute 'drop policy if exists "parent payment authorizations scoped write" on public.parent_payment_authorizations';
    execute 'drop policy if exists "parent payment authorizations finance scoped write" on public.parent_payment_authorizations';
    execute 'create policy "parent payment authorizations finance scoped write" on public.parent_payment_authorizations for all using (public.is_admin() or public.can_manage_garden(garden_id) or parent_profile_id = auth.uid()) with check (public.is_admin() or public.can_manage_garden(garden_id) or parent_profile_id = auth.uid())';
  end if;

  if to_regclass('public.parent_payment_transactions') is not null then
    execute 'drop policy if exists "parent payment transactions scoped read" on public.parent_payment_transactions';
    execute 'drop policy if exists "parent payment transactions finance scoped read" on public.parent_payment_transactions';
    execute 'create policy "parent payment transactions finance scoped read" on public.parent_payment_transactions for select using (public.is_admin() or public.can_manage_garden(garden_id) or parent_profile_id = auth.uid())';
    execute 'comment on policy "parent payment transactions finance scoped read" on public.parent_payment_transactions is ''Parent tuition records are visible to the relevant parent, garden manager/owner, and admin only. They remain separate from Gan Batuach subscription revenue.''';

    execute 'drop policy if exists "parent payment transactions service write" on public.parent_payment_transactions';
    execute 'drop policy if exists "parent payment transactions manager admin insert" on public.parent_payment_transactions';
    execute 'create policy "parent payment transactions manager admin insert" on public.parent_payment_transactions for insert with check (public.is_admin() or public.can_manage_garden(garden_id))';
  end if;
end $$;

notify pgrst, 'reload schema';
