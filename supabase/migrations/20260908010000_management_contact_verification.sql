-- GB-M04: Management contact verification is additive. Existing accounts are
-- grandfathered; new self-service accounts explicitly opt into both checks.

alter table public.profiles
  add column if not exists contact_verification_required boolean not null default false,
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz;

create or replace function public.sync_management_contact_verification()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles
  set email_verified_at = new.email_confirmed_at,
      phone_verified_at = new.phone_confirmed_at,
      updated_at = now()
  where id = new.id;

  update public.self_service_user_profiles
  set verification_status = jsonb_build_object(
        'email', case when new.email_confirmed_at is null then 'pending' else 'verified' end,
        'phone', case when new.phone_confirmed_at is null then 'pending' else 'verified' end,
        'mfa', coalesce(verification_status ->> 'mfa', 'not_required')
      ),
      updated_at = now()
  where profile_id = new.id;

  return new;
end;
$$;

revoke all on function public.sync_management_contact_verification() from public, anon, authenticated;

drop trigger if exists management_contact_verification_after_auth_change on auth.users;
create trigger management_contact_verification_after_auth_change
after update of email_confirmed_at, phone_confirmed_at on auth.users
for each row execute function public.sync_management_contact_verification();

update public.profiles profile
set email_verified_at = auth_user.email_confirmed_at,
    phone_verified_at = auth_user.phone_confirmed_at
from auth.users auth_user
where auth_user.id = profile.id
  and (profile.email_verified_at is distinct from auth_user.email_confirmed_at
    or profile.phone_verified_at is distinct from auth_user.phone_confirmed_at);

comment on column public.profiles.contact_verification_required is
  'True only for accounts enrolled in the GB-M04 email and mobile verification contract; legacy accounts remain compatible.';
