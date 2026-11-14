-- Management privacy requests must bind an authorized child to that child's garden.
-- This changes request submission only; review, retention, export and deletion stay manual.
begin;

-- The portal needs only own-row reads and new submissions; RLS remains the authority.
grant select, insert on public.privacy_rights_requests to authenticated;

alter table public.privacy_rights_requests drop constraint if exists privacy_rights_subject_type_check;
alter table public.privacy_rights_requests add constraint privacy_rights_subject_type_check check (data_subject_type in (
  'child','parent','staff','manager','owner','network_manager','inspector','admin','garden',
  'observer_account','organization_member','site_user','partner_customer'
));

create or replace function public.management_privacy_child_garden(target_child_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.garden_id
  from public.children c
  where c.id = target_child_id
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active is true)
    and public.can_guardian_access_child(c.permanent_child_file_id, 'profile')
  limit 1
$$;

revoke all on function public.management_privacy_child_garden(uuid) from public;
grant execute on function public.management_privacy_child_garden(uuid) to authenticated;

create or replace function public.management_privacy_self_role_valid(subject_role text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid()
    and p.active is true and p.role::text = subject_role)
$$;

revoke all on function public.management_privacy_self_role_valid(text) from public;
grant execute on function public.management_privacy_self_role_valid(text) to authenticated;

drop policy if exists "privacy rights child ownership boundary" on public.privacy_rights_requests;
create policy "privacy rights child ownership boundary" on public.privacy_rights_requests
as restrictive for insert to authenticated
with check (
  child_id is null
  or public.is_admin()
  or public.can_parent_access_child(child_id)
  or (garden_id is not null and public.can_manage_garden(garden_id))
  or public.management_privacy_child_garden(child_id) is not null
);

drop policy if exists "management privacy request subject scope" on public.privacy_rights_requests;
create policy "management privacy request subject scope" on public.privacy_rights_requests
as restrictive for insert to authenticated
with check (
  observer_site_id is not null or organization_id is not null
  or (
    requester_profile_id = auth.uid() and requested_by = auth.uid()
    and (
      (data_subject_type = 'child' and subject_type = 'child'
        and child_id is not null and subject_user_id is null
        and data_subject_id = child_id
        and garden_id = public.management_privacy_child_garden(child_id))
      or (data_subject_type = 'garden' and subject_type = 'garden'
        and child_id is null and subject_user_id is null
        and garden_id is not null and data_subject_id = garden_id
        and public.can_manage_garden(garden_id))
      or (data_subject_type not in ('child', 'garden') and subject_type = data_subject_type
        and child_id is null and subject_user_id = auth.uid()
        and data_subject_id = auth.uid()
        and public.management_privacy_self_role_valid(data_subject_type))
    )
  )
);

commit;
