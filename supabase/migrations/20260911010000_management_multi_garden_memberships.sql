-- Canonical Management owner/manager memberships and multi-garden authority.
-- profiles.garden_id remains a legacy/default hint only.

create table if not exists public.garden_management_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  relationship_role text not null check (relationship_role in ('owner', 'manager')),
  status text not null default 'active' check (status in ('pending', 'active', 'inactive', 'revoked')),
  is_default boolean not null default false,
  source text not null default 'system' check (source in ('garden_owner', 'garden_manager', 'legacy_profile_authority', 'admin', 'self_service', 'system')),
  activated_at timestamptz,
  ended_at timestamptz,
  granted_by uuid references public.profiles(id) on delete set null,
  revoked_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_management_memberships_unique unique (profile_id, garden_id, relationship_role),
  constraint garden_management_memberships_lifecycle_check check (
    (status = 'active' and activated_at is not null and ended_at is null)
    or status <> 'active'
  )
);

create index if not exists garden_management_memberships_garden_active_idx
  on public.garden_management_memberships(garden_id, profile_id)
  where status = 'active';

-- Direct garden ownership and management columns are deterministic legacy
-- relationships. Preserve them without inventing access from names or email.
insert into public.garden_management_memberships
  (profile_id, garden_id, relationship_role, status, is_default, source, activated_at, metadata)
select g.owner_profile_id, g.id, 'owner', 'active', false, 'garden_owner', coalesce(g.created_at, now()), '{"backfill":"deterministic"}'::jsonb
from public.gardens g join public.profiles p on p.id = g.owner_profile_id
where g.owner_profile_id is not null
on conflict (profile_id, garden_id, relationship_role) do nothing;

insert into public.garden_management_memberships
  (profile_id, garden_id, relationship_role, status, is_default, source, activated_at, metadata)
select g.manager_id, g.id, 'manager', 'active', false, 'garden_manager', coalesce(g.created_at, now()), '{"backfill":"deterministic"}'::jsonb
from public.gardens g join public.profiles p on p.id = g.manager_id
where g.manager_id is not null
on conflict (profile_id, garden_id, relationship_role) do nothing;

-- profiles.garden_id was the previous explicit authority. Backfill only the
-- matching owner/manager role when no direct garden relationship exists.
insert into public.garden_management_memberships
  (profile_id, garden_id, relationship_role, status, is_default, source, activated_at, metadata)
select p.id, p.garden_id, p.role::text, 'active', false, 'legacy_profile_authority', coalesce(p.created_at, now()), '{"backfill":"legacy_authority"}'::jsonb
from public.profiles p join public.gardens g on g.id = p.garden_id
where p.garden_id is not null and p.role::text in ('owner', 'manager')
on conflict (profile_id, garden_id, relationship_role) do nothing;

-- Resolve any historical duplicate default flags deterministically in favor of
-- profiles.garden_id, then the oldest relationship.
with ranked as (
  select id, row_number() over (
    partition by profile_id
    order by (garden_id = (select p.garden_id from public.profiles p where p.id = garden_management_memberships.profile_id)) desc,
             activated_at asc nulls last, created_at asc, id
  ) as position
  from public.garden_management_memberships where status = 'active'
)
update public.garden_management_memberships membership
set is_default = ranked.position = 1
from ranked where ranked.id = membership.id;

create unique index if not exists garden_management_memberships_one_default_idx
  on public.garden_management_memberships(profile_id)
  where is_default is true and status = 'active';

create or replace function public.sync_garden_management_memberships()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.owner_profile_id is not null and old.owner_profile_id is distinct from new.owner_profile_id then
    update public.garden_management_memberships set status = 'revoked', is_default = false, ended_at = now(), updated_at = now()
    where profile_id = old.owner_profile_id and garden_id = new.id and relationship_role = 'owner' and status = 'active';
  end if;
  if new.owner_profile_id is not null and (tg_op = 'INSERT' or new.owner_profile_id is distinct from old.owner_profile_id) then
    insert into public.garden_management_memberships(profile_id, garden_id, relationship_role, status, is_default, source, activated_at)
    values (new.owner_profile_id, new.id, 'owner', 'active', false, 'garden_owner', now())
    on conflict (profile_id, garden_id, relationship_role) do update
      set status = 'active', ended_at = null, activated_at = coalesce(garden_management_memberships.activated_at, now()), updated_at = now();
  end if;
  if tg_op = 'UPDATE' and old.manager_id is not null and old.manager_id is distinct from new.manager_id then
    update public.garden_management_memberships set status = 'revoked', is_default = false, ended_at = now(), updated_at = now()
    where profile_id = old.manager_id and garden_id = new.id and relationship_role = 'manager' and status = 'active';
  end if;
  if new.manager_id is not null and (tg_op = 'INSERT' or new.manager_id is distinct from old.manager_id) then
    insert into public.garden_management_memberships(profile_id, garden_id, relationship_role, status, is_default, source, activated_at)
    values (new.manager_id, new.id, 'manager', 'active', false, 'garden_manager', now())
    on conflict (profile_id, garden_id, relationship_role) do update
      set status = 'active', ended_at = null, activated_at = coalesce(garden_management_memberships.activated_at, now()), updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists sync_garden_management_memberships_trigger on public.gardens;
create trigger sync_garden_management_memberships_trigger
after insert or update on public.gardens
for each row execute function public.sync_garden_management_memberships();

create or replace function public.can_manage_garden(target_garden_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_garden_id is not null and (
    public.is_admin()
    or exists (
      select 1
      from public.garden_management_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      join public.gardens garden on garden.id = membership.garden_id
      where membership.profile_id = auth.uid()
        and membership.garden_id = target_garden_id
        and membership.status = 'active'
        and membership.relationship_role in ('owner', 'manager')
        and profile.active is true
        and profile.role::text in ('owner', 'manager')
        and coalesce(garden.status::text, 'active') not in ('inactive', 'suspended', 'closed', 'rejected')
    )
    or exists (
      select 1 from public.profiles profile
      join public.gardens garden on garden.id = target_garden_id
      join public.network_manager_assignments assignment
        on assignment.network_id = garden.network_id and assignment.profile_id = profile.id
      where profile.id = auth.uid() and profile.active is true and profile.role::text = 'network_manager'
        and assignment.active is true and (assignment.ends_at is null or assignment.ends_at > now())
    )
  )
$$;

create or replace function public.management_gardens_for_current_user()
returns table (garden_id uuid, garden_name text, relationship_role text, is_default boolean)
language sql stable security definer set search_path = public as $$
  with authorized as (
    select membership.garden_id, garden.name,
      case when bool_or(membership.relationship_role = 'owner') then 'owner' else 'manager' end as relationship_role,
      bool_or(membership.is_default) as is_default
    from public.garden_management_memberships membership
    join public.profiles profile on profile.id = membership.profile_id
    join public.gardens garden on garden.id = membership.garden_id
    where membership.profile_id = auth.uid()
      and membership.status = 'active'
      and profile.active is true
      and coalesce(garden.status::text, 'active') not in ('inactive', 'suspended', 'closed', 'rejected')
    group by membership.garden_id, garden.name
  )
  select authorized.garden_id, authorized.name, authorized.relationship_role, authorized.is_default
  from authorized
  order by authorized.is_default desc, authorized.garden_id
$$;

revoke all on function public.can_manage_garden(uuid) from public;
grant execute on function public.can_manage_garden(uuid) to authenticated;
revoke all on function public.management_gardens_for_current_user() from public;
grant execute on function public.management_gardens_for_current_user() to authenticated;

alter table public.garden_management_memberships enable row level security;
drop policy if exists "management memberships own read" on public.garden_management_memberships;
create policy "management memberships own read" on public.garden_management_memberships
for select using (profile_id = auth.uid() or public.is_admin());
drop policy if exists "management memberships admin write" on public.garden_management_memberships;
create policy "management memberships admin write" on public.garden_management_memberships
for all using (public.is_admin()) with check (public.is_admin());
revoke all on table public.garden_management_memberships from anon, authenticated;
grant select on table public.garden_management_memberships to authenticated;

comment on table public.garden_management_memberships is 'Canonical garden-scoped owner and manager authority. profiles.garden_id is a compatibility/default hint only.';
notify pgrst, 'reload schema';
