-- Digital Observer account identity and trial lifecycle.
-- This keeps standalone product onboarding separate from Gan Batuach roles.

create table if not exists public.digital_observer_accounts (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  account_type text not null default 'home',
  status text not null default 'onboarding',
  onboarding_step text not null default 'profile',
  selected_package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  primary_site_id uuid references public.observer_sites(id) on delete set null,
  email_verified_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  billing_status text not null default 'payment_method_pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_accounts_type_check check (account_type in ('home','business')),
  constraint digital_observer_accounts_status_check check (status in ('onboarding','trial','active','suspended','cancelled')),
  constraint digital_observer_accounts_step_check check (onboarding_step in ('profile','site','package','camera_setup','complete')),
  constraint digital_observer_accounts_billing_check check (billing_status in ('payment_method_pending','trial','active','past_due','suspended','cancelled'))
);

create index if not exists digital_observer_accounts_status_idx
  on public.digital_observer_accounts (status, trial_end);

-- Backfill only owners of standalone home/business observer sites. This does
-- not infer product membership from a Gan Batuach role and never touches
-- kindergarten observer sites.
insert into public.digital_observer_accounts (
  profile_id,
  account_type,
  status,
  onboarding_step,
  selected_package_id,
  primary_site_id,
  trial_start,
  trial_end,
  billing_status,
  metadata
)
select distinct on (site.owner_profile_id)
  site.owner_profile_id,
  case when site.site_type = 'home' then 'home' else 'business' end,
  case
    when site.observer_subscription_status::text = 'active' then 'active'
    when site.observer_subscription_status::text = 'trial' then 'trial'
    when site.observer_subscription_status::text in ('expired','suspended','cancelled') then 'suspended'
    else 'onboarding'
  end,
  case when site.observer_package_id is null then 'package' else 'camera_setup' end,
  site.observer_package_id,
  site.id,
  site.observer_trial_start,
  site.observer_trial_end,
  case
    when site.observer_subscription_status::text = 'active' then 'active'
    when site.observer_subscription_status::text = 'trial' then 'trial'
    when site.observer_subscription_status::text in ('expired','suspended','cancelled') then 'suspended'
    else 'payment_method_pending'
  end,
  jsonb_build_object('product', 'digital_observer', 'legacy_standalone_site_backfill', true)
from public.observer_sites site
where site.owner_profile_id is not null
  and site.garden_id is null
  and site.site_type <> 'kindergarten'
order by site.owner_profile_id, site.created_at asc
on conflict (profile_id) do nothing;

alter table public.digital_observer_accounts enable row level security;

drop policy if exists "digital observer account own read" on public.digital_observer_accounts;
create policy "digital observer account own read" on public.digital_observer_accounts
for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "digital observer account admin manage" on public.digital_observer_accounts;
create policy "digital observer account admin manage" on public.digital_observer_accounts
for all using (public.is_admin())
with check (public.is_admin());

revoke insert, update, delete on table public.digital_observer_accounts from anon, authenticated;
grant select on table public.digital_observer_accounts to authenticated;

create or replace function public.ensure_digital_observer_account(
  requested_name text default null,
  requested_account_type text default 'home'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_type text := case when requested_account_type = 'business' then 'business' else 'home' end;
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then return false; end if;

  update public.profiles
  set full_name = coalesce(nullif(btrim(requested_name), ''), full_name),
      must_change_password = false,
      updated_at = now()
  where id = auth.uid();

  insert into public.digital_observer_accounts (
    profile_id, account_type, status, onboarding_step, email_verified_at, metadata
  ) values (
    auth.uid(), safe_type, 'onboarding', 'site', now(),
    jsonb_build_object('product', 'digital_observer', 'identity_separated_from_gan_batuach_role', true)
  )
  on conflict (profile_id) do update set
    account_type = case
      when public.digital_observer_accounts.primary_site_id is null then excluded.account_type
      else public.digital_observer_accounts.account_type
    end,
    email_verified_at = coalesce(public.digital_observer_accounts.email_verified_at, excluded.email_verified_at),
    metadata = public.digital_observer_accounts.metadata || excluded.metadata,
    updated_at = now();

  return true;
end;
$$;

revoke all on function public.ensure_digital_observer_account(text, text) from public, anon;
grant execute on function public.ensure_digital_observer_account(text, text) to authenticated;

-- Keep the previous RPC callable without changing a Gan Batuach role into a
-- Digital Observer role. Product membership is now stored independently.
create or replace function public.claim_digital_observer_profile(requested_name text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.ensure_digital_observer_account(requested_name, 'home');
end;
$$;

revoke all on function public.claim_digital_observer_profile(text) from public, anon;
grant execute on function public.claim_digital_observer_profile(text) to authenticated;

create or replace function public.start_digital_observer_trial(
  requested_site_id uuid,
  requested_package_id uuid,
  requested_billing_cycle text default 'monthly'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_site public.observer_sites%rowtype;
  target_package public.observer_monitoring_packages%rowtype;
  current_subscription public.observer_site_subscriptions%rowtype;
  safe_cycle text := case when requested_billing_cycle = 'annual' then 'annual' else 'monthly' end;
  trial_started timestamptz := now();
  trial_ends timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;

  select * into target_site
  from public.observer_sites
  where id = requested_site_id
    and owner_profile_id = auth.uid()
    and garden_id is null
    and site_type <> 'kindergarten'
  for update;
  if target_site.id is null then raise exception 'observer_site_access_denied'; end if;

  select * into target_package
  from public.observer_monitoring_packages
  where id = requested_package_id and active = true;
  if target_package.id is null then raise exception 'observer_package_unavailable'; end if;
  if target_package.package_type not in (
    case when target_site.site_type = 'home' then 'home' else 'business' end,
    'enterprise'
  ) then raise exception 'observer_package_type_mismatch'; end if;

  trial_ends := trial_started + make_interval(days => least(greatest(coalesce(target_package.trial_days, 14), 1), 14));

  select * into current_subscription
  from public.observer_site_subscriptions
  where observer_site_id = target_site.id
    and status in ('trial','active','pending_payment','suspended')
  order by created_at desc
  limit 1
  for update;

  if current_subscription.id is null then
    insert into public.observer_site_subscriptions (
      observer_site_id, package_id, status, subscription_status, trial_start, trial_end,
      billing_cycle, monthly_price, annual_price, payment_provider,
      billing_separation_key, entitlement_status, purchase_channel, metadata
    ) values (
      target_site.id, target_package.id, 'trial', 'trial', trial_started, trial_ends,
      safe_cycle, target_package.monthly_price, target_package.annual_price, 'mock',
      'digital_observer', 'trial', 'mock',
      jsonb_build_object('product', 'digital_observer', 'real_charge_performed', false, 'payment_method_collected', false)
    )
    returning * into current_subscription;
  elsif current_subscription.status <> 'active' then
    update public.observer_site_subscriptions
    set package_id = target_package.id,
        status = 'trial',
        subscription_status = 'trial',
        trial_start = coalesce(trial_start, trial_started),
        trial_end = coalesce(trial_end, trial_ends),
        billing_cycle = safe_cycle,
        monthly_price = target_package.monthly_price,
        annual_price = target_package.annual_price,
        payment_provider = 'mock',
        billing_separation_key = 'digital_observer',
        entitlement_status = 'trial',
        purchase_channel = 'mock',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'product', 'digital_observer',
          'real_charge_performed', false,
          'payment_method_collected', false
        ),
        updated_at = now()
    where id = current_subscription.id
    returning * into current_subscription;
  end if;

  update public.observer_sites
  set observer_package_id = target_package.id,
      observer_subscription_status = current_subscription.status,
      observer_trial_start = current_subscription.trial_start,
      observer_trial_end = current_subscription.trial_end,
      monitoring_enabled = false,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'product', 'digital_observer',
        'trial_connection_testing_allowed', true,
        'live_monitoring_requires_provider_activation', true
      ),
      updated_at = now()
  where id = target_site.id;

  update public.digital_observer_accounts
  set selected_package_id = target_package.id,
      primary_site_id = target_site.id,
      status = case when current_subscription.status = 'active' then 'active' else 'trial' end,
      onboarding_step = 'camera_setup',
      trial_start = current_subscription.trial_start,
      trial_end = current_subscription.trial_end,
      billing_status = case when current_subscription.status = 'active' then 'active' else 'trial' end,
      metadata = metadata || jsonb_build_object('real_charge_performed', false, 'payment_method_collected', false),
      updated_at = now()
  where profile_id = auth.uid();

  return jsonb_build_object(
    'subscription_id', current_subscription.id,
    'status', current_subscription.status,
    'trial_start', current_subscription.trial_start,
    'trial_end', current_subscription.trial_end,
    'charged', false
  );
end;
$$;

revoke all on function public.start_digital_observer_trial(uuid, uuid, text) from public, anon;
grant execute on function public.start_digital_observer_trial(uuid, uuid, text) to authenticated;

comment on table public.digital_observer_accounts is
  'Standalone Digital Observer product identity. It does not replace or mutate Gan Batuach role assignments.';

notify pgrst, 'reload schema';
