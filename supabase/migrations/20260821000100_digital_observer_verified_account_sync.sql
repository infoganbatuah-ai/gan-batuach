-- Keep standalone Digital Observer product accounts synchronized with verified
-- Supabase Auth identities. This does not change Gan Batuach roles or grants.

create or replace function public.sync_verified_digital_observer_account()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  safe_type text := case
    when new.raw_user_meta_data ->> 'account_type' = 'business' then 'business'
    else 'home'
  end;
begin
  if new.email_confirmed_at is null
    or coalesce(new.raw_user_meta_data ->> 'product', '') <> 'digital_observer'
  then
    return new;
  end if;

  insert into public.profiles (id, role, full_name, phone, must_change_password)
  values (
    new.id,
    'parent'::public.app_role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), new.email, 'Digital Observer user'),
    new.raw_user_meta_data ->> 'phone',
    false
  )
  on conflict (id) do update set
    full_name = coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), public.profiles.full_name),
    must_change_password = false,
    updated_at = now();

  insert into public.digital_observer_accounts (
    profile_id,
    account_type,
    status,
    onboarding_step,
    email_verified_at,
    metadata
  ) values (
    new.id,
    safe_type,
    'onboarding',
    'site',
    new.email_confirmed_at,
    jsonb_build_object(
      'product', 'digital_observer',
      'identity_separated_from_gan_batuach_role', true,
      'created_from_verified_auth_identity', true
    )
  )
  on conflict (profile_id) do update set
    account_type = case
      when public.digital_observer_accounts.primary_site_id is null then excluded.account_type
      else public.digital_observer_accounts.account_type
    end,
    email_verified_at = coalesce(public.digital_observer_accounts.email_verified_at, excluded.email_verified_at),
    metadata = public.digital_observer_accounts.metadata || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.sync_verified_digital_observer_account() from public, anon, authenticated;

drop trigger if exists digital_observer_account_after_auth_insert on auth.users;
create trigger digital_observer_account_after_auth_insert
after insert on auth.users
for each row execute function public.sync_verified_digital_observer_account();

drop trigger if exists digital_observer_account_after_email_confirmation on auth.users;
create trigger digital_observer_account_after_email_confirmation
after update of email_confirmed_at, raw_user_meta_data on auth.users
for each row execute function public.sync_verified_digital_observer_account();

-- Repair already-confirmed standalone observer identities without changing an
-- existing Gan Batuach role or linking any garden, parent, or child data.
insert into public.profiles (id, role, full_name, phone, must_change_password)
select
  auth_user.id,
  'parent'::public.app_role,
  coalesce(nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), ''), auth_user.email, 'Digital Observer user'),
  auth_user.raw_user_meta_data ->> 'phone',
  false
from auth.users auth_user
where auth_user.email_confirmed_at is not null
  and auth_user.raw_user_meta_data ->> 'product' = 'digital_observer'
on conflict (id) do nothing;

insert into public.digital_observer_accounts (
  profile_id,
  account_type,
  status,
  onboarding_step,
  email_verified_at,
  metadata
)
select
  auth_user.id,
  case when auth_user.raw_user_meta_data ->> 'account_type' = 'business' then 'business' else 'home' end,
  'onboarding',
  'site',
  auth_user.email_confirmed_at,
  jsonb_build_object(
    'product', 'digital_observer',
    'identity_separated_from_gan_batuach_role', true,
    'backfilled_from_verified_auth_identity', true
  )
from auth.users auth_user
join public.profiles profile on profile.id = auth_user.id
where auth_user.email_confirmed_at is not null
  and auth_user.raw_user_meta_data ->> 'product' = 'digital_observer'
on conflict (profile_id) do update set
  email_verified_at = coalesce(public.digital_observer_accounts.email_verified_at, excluded.email_verified_at),
  metadata = public.digital_observer_accounts.metadata || excluded.metadata,
  updated_at = now();

comment on function public.sync_verified_digital_observer_account() is
  'Creates or repairs the standalone Digital Observer account after Supabase confirms an observer email; does not alter Gan Batuach role assignments.';
