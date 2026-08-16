-- Break recursive observer membership policies without widening site access.

create or replace function public.can_access_observer_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_site_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.observer_sites s
      where s.id = target_site_id
        and (
          s.owner_profile_id = auth.uid()
          or (s.garden_id is not null and public.can_access_garden(s.garden_id))
        )
    )
    or exists (
      select 1
      from public.observer_site_memberships m
      where m.observer_site_id = target_site_id
        and m.profile_id = auth.uid()
        and m.active = true
    )
  )
$$;

create or replace function public.can_manage_observer_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_site_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.observer_sites s
      where s.id = target_site_id
        and s.owner_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.observer_site_memberships m
      where m.observer_site_id = target_site_id
        and m.profile_id = auth.uid()
        and m.active = true
        and m.member_role in ('owner', 'admin')
    )
  )
$$;

revoke all on function public.can_access_observer_site(uuid) from public;
revoke all on function public.can_manage_observer_site(uuid) from public;
grant execute on function public.can_access_observer_site(uuid) to authenticated, service_role;
grant execute on function public.can_manage_observer_site(uuid) to authenticated, service_role;

drop policy if exists "observer site memberships own read" on public.observer_site_memberships;
create policy "observer site memberships scoped read" on public.observer_site_memberships
for select using (
  profile_id = auth.uid()
  or public.can_manage_observer_site(observer_site_id)
);

drop policy if exists "observer sites membership read" on public.observer_sites;
create policy "observer sites scoped membership read" on public.observer_sites
for select using (public.can_access_observer_site(id));

notify pgrst, 'reload schema';
