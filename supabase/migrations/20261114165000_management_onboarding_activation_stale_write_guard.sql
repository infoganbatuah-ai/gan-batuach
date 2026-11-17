-- GB-M10 closure: a stale onboarding save must not demote an activated Garden
-- or its lifecycle after the atomic activation transaction commits.
create or replace function public.guard_activated_garden_from_onboarding_draft()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status::text = 'active' and
    (new.status::text = 'pending' or new.onboarding_status = 'onboarding_in_progress') then
    raise exception 'activated_garden_cannot_return_to_onboarding_draft' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists guard_activated_garden_from_onboarding_draft on public.gardens;
create trigger guard_activated_garden_from_onboarding_draft
before update of status,onboarding_status on public.gardens
for each row execute function public.guard_activated_garden_from_onboarding_draft();

create or replace function public.guard_activated_onboarding_record_from_draft()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.lifecycle_status = 'active' and new.lifecycle_status in
    ('registration_pending','credentials_sent','activation_in_progress','onboarding_in_progress','correction_required') then
    raise exception 'activated_onboarding_cannot_return_to_draft' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists guard_activated_onboarding_record_from_draft on public.kindergarten_onboarding_records;
create trigger guard_activated_onboarding_record_from_draft
before update of lifecycle_status on public.kindergarten_onboarding_records
for each row execute function public.guard_activated_onboarding_record_from_draft();

revoke all on function public.guard_activated_garden_from_onboarding_draft(),
  public.guard_activated_onboarding_record_from_draft() from public, anon, authenticated;
