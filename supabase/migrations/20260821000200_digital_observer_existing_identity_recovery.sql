-- Allow an authenticated email owner to create or repair only their own
-- standalone Digital Observer profile/account. Existing Gan Batuach roles,
-- assignments and data remain unchanged.

create or replace function public.ensure_digital_observer_account(
  requested_name text default null,
  requested_account_type text default 'home'
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  safe_type text := case when requested_account_type = 'business' then 'business' else 'home' end;
  auth_identity auth.users%rowtype;
begin
  if auth.uid() is null then return false; end if;

  select * into auth_identity
  from auth.users
  where id = auth.uid();

  if auth_identity.id is null or auth_identity.email_confirmed_at is null then
    return false;
  end if;

  insert into public.profiles (id, role, full_name, phone, must_change_password)
  values (
    auth_identity.id,
    'parent'::public.app_role,
    coalesce(
      nullif(btrim(requested_name), ''),
      nullif(btrim(auth_identity.raw_user_meta_data ->> 'full_name'), ''),
      auth_identity.email,
      'Digital Observer user'
    ),
    auth_identity.raw_user_meta_data ->> 'phone',
    false
  )
  on conflict (id) do update set
    full_name = coalesce(
      nullif(btrim(requested_name), ''),
      nullif(btrim(public.profiles.full_name), ''),
      nullif(btrim(auth_identity.raw_user_meta_data ->> 'full_name'), ''),
      auth_identity.email
    ),
    must_change_password = false,
    updated_at = now();

  insert into public.digital_observer_accounts (
    profile_id, account_type, status, onboarding_step, email_verified_at, metadata
  ) values (
    auth_identity.id,
    safe_type,
    'onboarding',
    'site',
    auth_identity.email_confirmed_at,
    jsonb_build_object(
      'product', 'digital_observer',
      'identity_separated_from_gan_batuach_role', true,
      'recovered_from_verified_identity', true
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

  return true;
end;
$$;

revoke all on function public.ensure_digital_observer_account(text, text) from public, anon;
grant execute on function public.ensure_digital_observer_account(text, text) to authenticated;

comment on function public.ensure_digital_observer_account(text, text) is
  'Creates or repairs only the authenticated user own standalone Digital Observer account after email verification; preserves existing Gan Batuach roles and assignments.';
