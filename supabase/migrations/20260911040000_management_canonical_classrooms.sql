-- GB-M11: canonical Garden-scoped classrooms and operational assignments.

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  name text not null,
  age_group_key text not null,
  age_group_label text,
  min_age_months integer,
  max_age_months integer,
  status text not null default 'active',
  sort_order integer not null default 0,
  source text not null default 'management',
  legacy_age_group_setup_id uuid references public.kindergarten_age_group_setups(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classrooms_name_check check (length(btrim(name)) between 1 and 120),
  constraint classrooms_age_bounds_check check (min_age_months is null or min_age_months >= 0) and (max_age_months is null or max_age_months >= coalesce(min_age_months,0)),
  constraint classrooms_status_check check (status in ('active','inactive','archived')),
  constraint classrooms_garden_name_unique unique (garden_id,name)
);

create table if not exists public.child_classroom_assignments (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  enrollment_id uuid references public.child_kindergarten_enrollments(id) on delete set null,
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  is_current boolean not null default true,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  end_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint child_classroom_period_check check ((is_current and ended_at is null) or (not is_current))
);

create unique index if not exists child_classroom_current_unique on public.child_classroom_assignments(child_id,garden_id) where is_current;
create index if not exists child_classroom_history_idx on public.child_classroom_assignments(child_id,garden_id,assigned_at desc);
create index if not exists classrooms_garden_status_idx on public.classrooms(garden_id,status,sort_order,name);

create table if not exists public.staff_classroom_assignments (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  employment_id uuid references public.staff_kindergarten_employments(id) on delete set null,
  classroom_id uuid not null references public.classrooms(id) on delete restrict,
  status text not null default 'active',
  responsibility text not null default 'staff',
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_classroom_status_check check (status in ('active','inactive','revoked')),
  constraint staff_classroom_responsibility_check check (responsibility in ('staff','lead_teacher','assistant','support')),
  constraint staff_classroom_unique unique (staff_id,classroom_id)
);
create index if not exists staff_classroom_scope_idx on public.staff_classroom_assignments(garden_id,classroom_id,status);

create or replace function public.validate_classroom_assignment_scope()
returns trigger language plpgsql set search_path=public as $$
declare room_garden uuid; subject_garden uuid; relation_garden uuid;
begin
  select garden_id into room_garden from public.classrooms where id=new.classroom_id;
  if tg_table_name='child_classroom_assignments' then
    select garden_id into subject_garden from public.children where id=new.child_id;
    if new.enrollment_id is not null then select garden_id into relation_garden from public.child_kindergarten_enrollments where id=new.enrollment_id and child_id=new.child_id; end if;
  else
    select garden_id into subject_garden from public.staff where id=new.staff_id;
    if new.employment_id is not null then select garden_id into relation_garden from public.staff_kindergarten_employments where id=new.employment_id and staff_id=new.staff_id and status='active'; end if;
  end if;
  if room_garden is null or subject_garden is null or room_garden<>new.garden_id or subject_garden<>new.garden_id or (case when tg_table_name='child_classroom_assignments' then new.enrollment_id is not null else new.employment_id is not null end and relation_garden is distinct from new.garden_id) then
    raise exception 'cross_garden_classroom_assignment' using errcode='23514';
  end if;
  return new;
end $$;

drop trigger if exists validate_child_classroom_scope on public.child_classroom_assignments;
create trigger validate_child_classroom_scope before insert or update on public.child_classroom_assignments for each row execute function public.validate_classroom_assignment_scope();
drop trigger if exists validate_staff_classroom_scope on public.staff_classroom_assignments;
create trigger validate_staff_classroom_scope before insert or update on public.staff_classroom_assignments for each row execute function public.validate_classroom_assignment_scope();

create or replace function public.assign_child_to_classroom(target_child_id uuid,target_classroom_id uuid,target_enrollment_id uuid default null)
returns public.child_classroom_assignments language plpgsql security definer set search_path=public as $$
declare room public.classrooms; child_garden uuid; result public.child_classroom_assignments;
begin
  select * into room from public.classrooms where id=target_classroom_id and status='active' for update;
  select garden_id into child_garden from public.children where id=target_child_id;
  if room.id is null or child_garden is distinct from room.garden_id then raise exception 'cross_garden_classroom_assignment' using errcode='42501'; end if;
  if not public.can_manage_garden(room.garden_id) then raise exception 'classroom_assignment_denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_child_id::text,0));
  update public.child_classroom_assignments set is_current=false,ended_at=now(),end_reason='moved' where child_id=target_child_id and garden_id=room.garden_id and is_current and classroom_id<>room.id;
  select * into result from public.child_classroom_assignments where child_id=target_child_id and garden_id=room.garden_id and classroom_id=room.id and is_current limit 1;
  if result.id is null then
    insert into public.child_classroom_assignments(garden_id,child_id,enrollment_id,classroom_id,assigned_by) values(room.garden_id,target_child_id,target_enrollment_id,room.id,auth.uid()) returning * into result;
  end if;
  return result;
end $$;

create or replace function public.assign_staff_to_classroom(target_staff_id uuid,target_classroom_id uuid,target_employment_id uuid default null,target_responsibility text default 'staff')
returns public.staff_classroom_assignments language plpgsql security definer set search_path=public as $$
declare room public.classrooms; staff_row public.staff; employment uuid; result public.staff_classroom_assignments;
begin
  select * into room from public.classrooms where id=target_classroom_id and status='active';
  select * into staff_row from public.staff where id=target_staff_id;
  if room.id is null or staff_row.id is null or staff_row.garden_id is distinct from room.garden_id then raise exception 'cross_garden_classroom_assignment' using errcode='42501'; end if;
  if not public.can_manage_garden(room.garden_id) then raise exception 'classroom_assignment_denied' using errcode='42501'; end if;
  select id into employment from public.staff_kindergarten_employments where id=target_employment_id and staff_id=target_staff_id and garden_id=room.garden_id and status='active';
  if target_employment_id is not null and employment is null then raise exception 'active_employment_required' using errcode='23514'; end if;
  if not coalesce(staff_row.approved_to_work,false) then raise exception 'active_staff_required' using errcode='23514'; end if;
  insert into public.staff_classroom_assignments(garden_id,staff_id,employment_id,classroom_id,responsibility,assigned_by,status,ended_at)
  values(room.garden_id,target_staff_id,target_employment_id,room.id,target_responsibility,auth.uid(),'active',null)
  on conflict(staff_id,classroom_id) do update set employment_id=excluded.employment_id,responsibility=excluded.responsibility,status='active',ended_at=null,assigned_by=auth.uid(),updated_at=now()
  returning * into result;
  return result;
end $$;

alter table public.classrooms enable row level security;
alter table public.child_classroom_assignments enable row level security;
alter table public.staff_classroom_assignments enable row level security;
create policy "classrooms garden read" on public.classrooms for select using (public.can_access_garden(garden_id));
create policy "classrooms manager write" on public.classrooms for all using (public.can_manage_garden(garden_id)) with check (public.can_manage_garden(garden_id));
create policy "child classroom garden read" on public.child_classroom_assignments for select using (public.can_access_garden(garden_id));
create policy "child classroom manager write" on public.child_classroom_assignments for all using (public.can_manage_garden(garden_id)) with check (public.can_manage_garden(garden_id));
create policy "staff classroom garden read" on public.staff_classroom_assignments for select using (public.can_access_garden(garden_id));
create policy "staff classroom manager write" on public.staff_classroom_assignments for all using (public.can_manage_garden(garden_id)) with check (public.can_manage_garden(garden_id));

grant select,insert,update on public.classrooms to authenticated;
grant select on public.child_classroom_assignments,public.staff_classroom_assignments to authenticated;
grant execute on function public.assign_child_to_classroom(uuid,uuid,uuid) to authenticated;
grant execute on function public.assign_staff_to_classroom(uuid,uuid,uuid,text) to authenticated;

-- One deterministic compatibility classroom per legacy age-group setup. No class count is guessed.
insert into public.classrooms(garden_id,name,age_group_key,age_group_label,min_age_months,max_age_months,status,sort_order,source,legacy_age_group_setup_id,metadata)
select s.garden_id,
  case s.age_group when 'INFANT' then 'תינוקות 1' when 'TODDLER_YOUNG' then 'פעוטים צעירים 1' when 'TODDLER_MATURE' then 'פעוטים בוגרים 1' when 'KINDERGARTEN' then 'גן 1' else s.age_group||' 1' end,
  s.age_group,
  case s.age_group when 'INFANT' then 'תינוקות' when 'TODDLER_YOUNG' then 'פעוטים צעירים' when 'TODDLER_MATURE' then 'פעוטים בוגרים' when 'KINDERGARTEN' then 'גן' else s.age_group end,
  case s.age_group when 'INFANT' then 3 when 'TODDLER_YOUNG' then 16 when 'TODDLER_MATURE' then 25 when 'KINDERGARTEN' then 36 else null end,
  case s.age_group when 'INFANT' then 15 when 'TODDLER_YOUNG' then 24 when 'TODDLER_MATURE' then 36 else null end,
  'active',0,'legacy_age_group',s.id,jsonb_build_object('deterministic_minimum',true)
from public.kindergarten_age_group_setups s
on conflict(garden_id,name) do nothing;

comment on table public.classrooms is 'Canonical operational Classroom; age-group category is classification, not identity or legal policy.';
comment on table public.child_classroom_assignments is 'Time-preserving child Classroom assignment history within a Garden enrollment.';
comment on table public.staff_classroom_assignments is 'Operational Classroom scope; employment authorization remains separate.';
