create table if not exists public.child_guardian_links (
  id uuid primary key default gen_random_uuid(),
  permanent_child_file_id uuid not null references public.permanent_child_files(id) on delete cascade,
  guardian_profile_id uuid not null references public.profiles(id) on delete cascade,
  relationship_type text not null default 'parent',
  is_primary boolean not null default false,
  legal_authority boolean not null default true,
  access_scope jsonb not null default '{"profile":true,"medical":true,"education":true,"pickup":true,"payments":true}'::jsonb,
  status text not null default 'active',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  source text not null default 'canonical',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint child_guardian_relationship_check check (relationship_type in ('mother','father','parent','guardian','foster_parent','legal_representative')),
  constraint child_guardian_status_check check (status in ('pending','active','suspended','revoked','expired')),
  unique(permanent_child_file_id, guardian_profile_id)
);

create unique index if not exists child_guardian_one_primary_idx
  on public.child_guardian_links(permanent_child_file_id)
  where is_primary = true and status = 'active';
create index if not exists child_guardian_profile_idx
  on public.child_guardian_links(guardian_profile_id, status, permanent_child_file_id);

insert into public.child_guardian_links (
  permanent_child_file_id, guardian_profile_id, relationship_type, is_primary,
  legal_authority, status, verified_at, source
)
select f.id, f.primary_parent_profile_id, 'parent', true, true, 'active', f.created_at, 'legacy_primary_parent_backfill'
from public.permanent_child_files f
where f.primary_parent_profile_id is not null
on conflict (permanent_child_file_id, guardian_profile_id) do update
set is_primary = excluded.is_primary,
    legal_authority = excluded.legal_authority,
    status = 'active',
    updated_at = now();

insert into public.child_guardian_links (
  permanent_child_file_id, guardian_profile_id, relationship_type, is_primary,
  legal_authority, status, verified_at, source
)
select distinct f.id, coalesce(p.profile_id, p.user_id), 'parent',
  coalesce(p.profile_id, p.user_id) = f.primary_parent_profile_id,
  true, 'active', c.created_at, 'legacy_child_parent_backfill'
from public.children c
join public.permanent_child_files f on f.id = c.permanent_child_file_id
join public.parents p on p.id = c.primary_parent_id
where coalesce(p.profile_id, p.user_id) is not null
on conflict (permanent_child_file_id, guardian_profile_id) do nothing;

create or replace function public.sync_primary_child_guardian_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.primary_parent_profile_id is not null then
    update public.child_guardian_links
    set is_primary = false, updated_at = now()
    where permanent_child_file_id = new.id
      and guardian_profile_id <> new.primary_parent_profile_id
      and is_primary = true;
    insert into public.child_guardian_links (
      permanent_child_file_id, guardian_profile_id, relationship_type, is_primary,
      legal_authority, status, verified_at, source
    ) values (
      new.id, new.primary_parent_profile_id, 'parent', true,
      true, 'active', now(), 'legacy_primary_parent_sync'
    )
    on conflict (permanent_child_file_id, guardian_profile_id) do update
    set is_primary = true, legal_authority = true, status = 'active', updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists sync_primary_child_guardian_link_trigger on public.permanent_child_files;
create trigger sync_primary_child_guardian_link_trigger
after insert or update of primary_parent_profile_id on public.permanent_child_files
for each row execute function public.sync_primary_child_guardian_link();

create or replace function public.can_guardian_access_child(target_child_file_id uuid, required_scope text default 'profile')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_child_file_id is not null and exists (
    select 1 from public.child_guardian_links link
    join public.profiles profile on profile.id = link.guardian_profile_id
    where link.permanent_child_file_id = target_child_file_id
      and link.guardian_profile_id = auth.uid()
      and profile.role = 'parent'
      and link.status = 'active'
      and link.legal_authority = true
      and (link.valid_until is null or link.valid_until > now())
      and coalesce(link.access_scope ->> required_scope, 'false') = 'true'
  );
$$;

revoke all on function public.can_guardian_access_child(uuid, text) from public;
grant execute on function public.can_guardian_access_child(uuid, text) to authenticated;
revoke all on function public.sync_primary_child_guardian_link() from public;

alter table public.child_guardian_links enable row level security;
create policy "child guardian own read" on public.child_guardian_links
for select using (public.is_admin() or guardian_profile_id = auth.uid() or exists (
  select 1 from public.child_kindergarten_enrollments enrollment
  where enrollment.permanent_child_file_id = child_guardian_links.permanent_child_file_id
    and public.can_access_garden(enrollment.garden_id)
));
create policy "child guardian scoped write" on public.child_guardian_links
for all using (public.is_admin() or exists (
  select 1 from public.child_kindergarten_enrollments enrollment
  where enrollment.permanent_child_file_id = child_guardian_links.permanent_child_file_id
    and public.can_manage_garden(enrollment.garden_id)
)) with check (public.is_admin() or exists (
  select 1 from public.child_kindergarten_enrollments enrollment
  where enrollment.permanent_child_file_id = child_guardian_links.permanent_child_file_id
    and public.can_manage_garden(enrollment.garden_id)
));

drop policy if exists "permanent child files scoped read" on public.permanent_child_files;
drop policy if exists "permanent child files scoped read hardened" on public.permanent_child_files;
create policy "permanent child files canonical read" on public.permanent_child_files
for select using (public.is_admin() or public.can_guardian_access_child(id, 'profile') or exists (
  select 1 from public.child_kindergarten_enrollments enrollment
  where enrollment.permanent_child_file_id = permanent_child_files.id
    and public.can_access_garden(enrollment.garden_id)
));

drop policy if exists "permanent child files parent update" on public.permanent_child_files;
drop policy if exists "permanent child files parent update hardened" on public.permanent_child_files;
create policy "permanent child files canonical update" on public.permanent_child_files
for update using (public.is_admin() or public.can_guardian_access_child(id, 'profile'))
with check (public.is_admin() or public.can_guardian_access_child(id, 'profile'));

grant select on table public.child_guardian_links to authenticated;

create or replace function public.can_parent_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_garden_id is not null and exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.active = true
      and profile.role = 'parent'
      and (
        exists (
          select 1 from public.parent_kindergarten_links link
          where link.parent_profile_id = profile.id
            and link.garden_id = target_garden_id
            and link.status in ('pending', 'active')
        )
        or exists (
          select 1 from public.child_guardian_links guardian
          join public.child_kindergarten_enrollments enrollment
            on enrollment.permanent_child_file_id = guardian.permanent_child_file_id
          where guardian.guardian_profile_id = profile.id
            and guardian.status = 'active'
            and guardian.legal_authority = true
            and (guardian.valid_until is null or guardian.valid_until > now())
            and enrollment.garden_id = target_garden_id
            and enrollment.status in ('pending_parent_completion','pending_manager_approval','active')
        )
      )
  );
$$;

drop policy if exists "child enrollments scoped read" on public.child_kindergarten_enrollments;
drop policy if exists "child enrollments scoped read hardened" on public.child_kindergarten_enrollments;
create policy "child enrollments canonical read" on public.child_kindergarten_enrollments
for select using (public.is_admin() or public.can_access_garden(garden_id) or public.can_guardian_access_child(permanent_child_file_id, 'education'));

drop policy if exists "child enrollments scoped write" on public.child_kindergarten_enrollments;
drop policy if exists "child enrollments scoped write hardened" on public.child_kindergarten_enrollments;
create policy "child enrollments canonical write" on public.child_kindergarten_enrollments
for all using (public.is_admin() or public.can_access_garden(garden_id) or public.can_guardian_access_child(permanent_child_file_id, 'education'))
with check (public.is_admin() or public.can_access_garden(garden_id) or public.can_guardian_access_child(permanent_child_file_id, 'education'));

drop policy if exists "child timeline scoped read" on public.child_timeline_events;
drop policy if exists "child timeline scoped read hardened" on public.child_timeline_events;
create policy "child timeline canonical read" on public.child_timeline_events
for select using (public.is_admin() or public.can_access_garden(garden_id) or public.can_guardian_access_child(permanent_child_file_id, 'education'));

notify pgrst, 'reload schema';
