-- Canonical Management teaching semantics. A teaching assignment augments an
-- existing identity; it never promotes staff to manager/owner authority.

create table if not exists public.garden_teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  assignment_kind text not null,
  title text not null default 'גננת',
  access_scope jsonb not null default '{"children":true,"attendance":true,"journal":true,"communication":true}'::jsonb,
  status text not null default 'active',
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garden_teaching_assignments_kind_check check (assignment_kind in ('owner_teacher', 'delegated_teacher')),
  constraint garden_teaching_assignments_status_check check (status in ('active', 'suspended', 'revoked')),
  constraint garden_teaching_assignments_actor_shape_check check (
    (assignment_kind = 'owner_teacher' and staff_id is null)
    or (assignment_kind = 'delegated_teacher' and staff_id is not null)
  ),
  constraint garden_teaching_assignments_scope_object_check check (jsonb_typeof(access_scope) = 'object'),
  constraint garden_teaching_assignments_profile_unique unique (garden_id, profile_id)
);

create index if not exists garden_teaching_assignments_active_garden_idx
  on public.garden_teaching_assignments(garden_id, assignment_kind, profile_id)
  where status = 'active';

create or replace function public.validate_garden_teaching_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  actor_active boolean;
  garden_owner uuid;
  garden_ownership text;
begin
  select role::text, active into actor_role, actor_active
  from public.profiles where id = new.profile_id;
  select owner_profile_id, ownership_type into garden_owner, garden_ownership
  from public.gardens where id = new.garden_id;

  if new.status = 'active' and actor_active is not true then
    raise exception 'teaching_assignment_requires_active_profile' using errcode = '23514';
  end if;

  if new.assignment_kind = 'owner_teacher' then
    if new.status = 'active' and (actor_role <> 'owner' or garden_owner is distinct from new.profile_id or garden_ownership <> 'teacher_is_owner') then
      raise exception 'owner_teacher_identity_mismatch' using errcode = '23514';
    end if;
  elsif new.status = 'active' and not exists (
    select 1
    from public.staff s
    join public.staff_kindergarten_employments employment
      on employment.staff_id = s.id
     and employment.profile_id = s.profile_id
     and employment.garden_id = s.garden_id
     and employment.status = 'active'
    where s.id = new.staff_id
      and s.profile_id = new.profile_id
      and s.garden_id = new.garden_id
      and s.approved_to_work is true
      and s.onboarding_status = 'active'
      and actor_role = 'staff'
  ) then
    raise exception 'delegated_teacher_requires_active_staff_employment' using errcode = '23514';
  end if;

  if new.access_scope - array['children','attendance','journal','communication'] <> '{}'::jsonb then
    raise exception 'teaching_assignment_scope_not_allowed' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_each(new.access_scope) entry where jsonb_typeof(entry.value) <> 'boolean') then
    raise exception 'teaching_assignment_scope_must_be_boolean' using errcode = '23514';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists validate_garden_teaching_assignment_trigger on public.garden_teaching_assignments;
create trigger validate_garden_teaching_assignment_trigger
before insert or update on public.garden_teaching_assignments
for each row execute function public.validate_garden_teaching_assignment();

create or replace function public.can_teach_in_garden(target_garden_id uuid, required_scope text default 'children')
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and required_scope in ('children','attendance','journal','communication')
    and exists (
      select 1
      from public.garden_teaching_assignments assignment
      join public.profiles profile on profile.id = assignment.profile_id and profile.active is true
      left join public.staff staff_member on staff_member.id = assignment.staff_id
      left join public.staff_kindergarten_employments employment
        on employment.staff_id = staff_member.id
       and employment.profile_id = assignment.profile_id
       and employment.garden_id = assignment.garden_id
       and employment.status = 'active'
      left join public.gardens garden on garden.id = assignment.garden_id
      where assignment.garden_id = target_garden_id
        and assignment.profile_id = auth.uid()
        and assignment.status = 'active'
        and coalesce((assignment.access_scope ->> required_scope)::boolean, false)
        and (
          (assignment.assignment_kind = 'owner_teacher'
            and profile.role::text = 'owner'
            and garden.owner_profile_id = profile.id
            and garden.ownership_type = 'teacher_is_owner')
          or
          (assignment.assignment_kind = 'delegated_teacher'
            and profile.role::text = 'staff'
            and staff_member.profile_id = profile.id
            and staff_member.garden_id = target_garden_id
            and staff_member.approved_to_work is true
            and staff_member.onboarding_status = 'active'
            and employment.id is not null)
        )
    );
$$;

revoke all on function public.can_teach_in_garden(uuid, text) from public;
grant execute on function public.can_teach_in_garden(uuid, text) to authenticated;

alter table public.garden_teaching_assignments enable row level security;

drop policy if exists "teaching assignments own or manager read" on public.garden_teaching_assignments;
create policy "teaching assignments own or manager read"
on public.garden_teaching_assignments for select
using (profile_id = auth.uid() or public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "teaching assignments manager write" on public.garden_teaching_assignments;
create policy "teaching assignments manager write"
on public.garden_teaching_assignments for all
using (public.is_admin() or public.can_manage_garden(garden_id))
with check (public.is_admin() or public.can_manage_garden(garden_id));

revoke all on table public.garden_teaching_assignments from anon;
grant select, insert, update on table public.garden_teaching_assignments to authenticated;

comment on table public.garden_teaching_assignments is
  'Canonical, garden-scoped owner-teacher and delegated-teacher assignments. These assignments never grant garden management authority.';
comment on function public.can_teach_in_garden(uuid, text) is
  'Checks a narrow teaching capability independently of can_manage_garden.';

notify pgrst, 'reload schema';
