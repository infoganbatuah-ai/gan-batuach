-- GB-M19: employment is the authority; the selected garden and legacy profile
-- pointer are preferences, never grants. Historical shifts remain untouched.
create or replace function public.can_staff_access_garden(target_garden_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_garden_id is not null and (
    public.can_manage_garden(target_garden_id)
    or exists (
      select 1 from public.staff_kindergarten_employments e
      join public.staff s on s.id = e.staff_id and s.profile_id = e.profile_id and s.garden_id = e.garden_id
      join public.profiles p on p.id = e.profile_id
      join public.gardens g on g.id = e.garden_id
      where e.profile_id = auth.uid() and e.garden_id = target_garden_id
        and p.active and p.role::text = 'staff' and e.status = 'active'
        and (e.start_date is null or e.start_date <= current_date)
        and (e.end_date is null or e.end_date >= current_date)
        and s.approved_to_work and s.onboarding_status = 'active'
        and g.status::text = 'active'
    )
  )
$$;

-- Earlier deployments may still have the enterprise version of this function
-- that granted p.garden_id to every role. Preserve management/inspector scope.
create or replace function public.can_access_garden(target_garden_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_garden_id is not null and (
    public.can_manage_garden(target_garden_id)
    or public.can_staff_access_garden(target_garden_id)
    or public.can_inspector_access_garden(target_garden_id)
  )
$$;

-- Delegated teaching permission stays specific to the same employment and
-- stops at revocation/end date; a Teacher assignment in A never grants B.
create or replace function public.can_teach_in_garden(target_garden_id uuid, required_scope text default 'children')
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and required_scope in ('children','attendance','journal','communication')
    and exists (
      select 1 from public.garden_teaching_assignments a
      join public.profiles p on p.id=a.profile_id and p.active
      join public.gardens g on g.id=a.garden_id and g.status::text='active'
      left join public.staff s on s.id=a.staff_id and s.profile_id=a.profile_id and s.garden_id=a.garden_id
      where a.profile_id=auth.uid() and a.garden_id=target_garden_id and a.status='active'
        and coalesce((a.access_scope ->> required_scope)::boolean,false)
        and ((a.assignment_kind='owner_teacher' and p.role::text='owner'
              and g.owner_profile_id=p.id and g.ownership_type='teacher_is_owner')
          or (a.assignment_kind='delegated_teacher' and p.role::text='staff'
              and s.approved_to_work and s.onboarding_status='active'
              and exists(select 1 from public.staff_kindergarten_employments e
                where e.staff_id=s.id and e.profile_id=p.id and e.garden_id=a.garden_id
                  and e.status='active' and (e.start_date is null or e.start_date<=current_date)
                  and (e.end_date is null or e.end_date>=current_date))))
    )
$$;

create or replace function public.staff_employments_for_current_user()
returns table(employment_id uuid, staff_id uuid, garden_id uuid, garden_name text,
              role_title text, start_date date, classroom_names text[])
language sql stable security definer set search_path = public as $$
  select e.id, e.staff_id, e.garden_id, g.name::text, e.role_title,
         e.start_date,
         array(select c.name::text from public.staff_classroom_assignments a
               join public.classrooms c on c.id = a.classroom_id and c.garden_id = e.garden_id
               where a.employment_id = e.id and a.staff_id = e.staff_id
                 and a.garden_id = e.garden_id and a.status = 'active'
                 and c.status = 'active' order by c.name)
  from public.staff_kindergarten_employments e
  join public.staff s on s.id = e.staff_id and s.profile_id = e.profile_id and s.garden_id = e.garden_id
  join public.gardens g on g.id = e.garden_id
  where e.profile_id = auth.uid() and public.can_staff_access_garden(e.garden_id)
    and e.status = 'active' and s.approved_to_work and s.onboarding_status = 'active'
  order by g.name, e.id
$$;
revoke all on function public.staff_employments_for_current_user() from public, anon;
grant execute on function public.staff_employments_for_current_user() to authenticated;

alter table public.staff_kindergarten_employments enable row level security;
drop policy if exists "staff employment context read" on public.staff_kindergarten_employments;
create policy "staff employment context read" on public.staff_kindergarten_employments
  for select using (public.is_admin() or public.can_manage_garden(garden_id) or
    (profile_id=auth.uid() and public.can_staff_access_garden(garden_id)));
drop policy if exists "staff employment management write" on public.staff_kindergarten_employments;
create policy "staff employment management write" on public.staff_kindergarten_employments
  for all using (public.is_admin() or public.can_manage_garden(garden_id))
  with check (public.is_admin() or public.can_manage_garden(garden_id));

-- A shift is always bound to a specific active employment. Never guess a
-- historical employment from a name, profile default, or another garden.
alter table public.staff_shifts add column if not exists employment_id uuid
  references public.staff_kindergarten_employments(id) on delete set null;
create index if not exists staff_shifts_employment_date_idx
  on public.staff_shifts(employment_id, shift_date desc);

drop policy if exists "staff shifts scoped" on public.staff_shifts;
drop policy if exists "staff shifts write scoped" on public.staff_shifts;
create policy "staff shifts employment scoped read" on public.staff_shifts for select using (
  public.is_admin() or public.can_manage_garden(garden_id) or
  (public.can_staff_access_garden(garden_id) and exists (
    select 1 from public.staff s where s.id=staff_id and s.profile_id=auth.uid() and s.garden_id=staff_shifts.garden_id
  ))
);
create policy "staff shifts manager write" on public.staff_shifts for all using (
  public.is_admin() or public.can_manage_garden(garden_id)
) with check (public.is_admin() or public.can_manage_garden(garden_id));

drop policy if exists "staff location samples scoped" on public.staff_location_samples;
create policy "staff location samples scoped" on public.staff_location_samples for all using (
  public.is_admin() or public.can_manage_garden(garden_id) or
  (profile_id=auth.uid() and public.can_staff_access_garden(garden_id))
) with check (
  public.is_admin() or public.can_manage_garden(garden_id) or
  (profile_id=auth.uid() and public.can_staff_access_garden(garden_id) and exists (
    select 1 from public.staff s where s.id=staff_id and s.profile_id=auth.uid() and s.garden_id=staff_location_samples.garden_id
  ))
);

create or replace function public.staff_attendance_transition(target_garden_id uuid,
  target_action text, target_lat numeric default null, target_lng numeric default null)
returns public.staff_shifts language plpgsql security definer set search_path = public as $$
declare e public.staff_kindergarten_employments; existing public.staff_shifts; result public.staff_shifts;
begin
  if target_action not in ('check_in','check_out') then raise exception 'attendance_action_invalid' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 19));
  select * into e from public.staff_kindergarten_employments
    where profile_id = auth.uid() and garden_id = target_garden_id and status = 'active'
      and (start_date is null or start_date <= current_date)
      and (end_date is null or end_date >= current_date)
    order by created_at limit 1 for update;
  if e.id is null or not public.can_staff_access_garden(target_garden_id) then
    raise exception 'staff_employment_denied' using errcode='42501';
  end if;
  select * into existing from public.staff_shifts
    where staff_id in (select id from public.staff where profile_id = auth.uid())
      and actual_start is not null and actual_end is null
    order by actual_start desc limit 1 for update;
  if target_action = 'check_in' then
    if existing.id is not null then
      if existing.garden_id = target_garden_id and existing.employment_id = e.id then return existing; end if;
      raise exception 'staff_already_clocked_in' using errcode='23505';
    end if;
    select * into result from public.staff_shifts
      where staff_id = e.staff_id and garden_id = target_garden_id and shift_date = current_date
      order by created_at desc limit 1 for update;
    if result.id is null then
      insert into public.staff_shifts(staff_id,garden_id,employment_id,shift_date,actual_start,status,
        gps_start_lat,gps_start_lng)
      values(e.staff_id,target_garden_id,e.id,current_date,now(),'started',target_lat,target_lng)
      returning * into result;
    else
      if result.actual_end is not null then raise exception 'staff_shift_already_completed' using errcode='23505'; end if;
      update public.staff_shifts set employment_id=e.id,actual_start=now(),status='started',
        gps_start_lat=target_lat,gps_start_lng=target_lng where id=result.id returning * into result;
    end if;
  else
    if existing.id is null or existing.garden_id <> target_garden_id or existing.staff_id <> e.staff_id then
      raise exception 'staff_shift_not_open_in_garden' using errcode='23514';
    end if;
    update public.staff_shifts set employment_id=e.id,actual_end=now(),status='completed',
      total_minutes=greatest(0,round(extract(epoch from (now()-existing.actual_start))/60)::integer),
      gps_end_lat=target_lat,gps_end_lng=target_lng where id=existing.id returning * into result;
  end if;
  return result;
end $$;
revoke all on function public.staff_attendance_transition(uuid,text,numeric,numeric) from public,anon;
grant execute on function public.staff_attendance_transition(uuid,text,numeric,numeric) to authenticated;

-- A Manager sees only a generic conflict, never the other Garden's identity,
-- timetable or compensation. Serialize planned changes by Staff identity.
create or replace function public.schedule_staff_employment_shift(target_staff_id uuid,
  target_garden_id uuid,target_shift_date date,target_start time,target_end time)
returns public.staff_shifts language plpgsql security definer set search_path=public as $$
declare employee public.staff; employment public.staff_kindergarten_employments; result public.staff_shifts;
begin
  if not public.can_manage_garden(target_garden_id) then raise exception 'shift_management_denied' using errcode='42501'; end if;
  if target_shift_date is null or target_start is null or target_end is null or target_end<=target_start then
    raise exception 'shift_schedule_invalid' using errcode='23514';
  end if;
  select * into employee from public.staff where id=target_staff_id and garden_id=target_garden_id;
  if employee.id is null or employee.profile_id is null then raise exception 'shift_employment_denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(employee.profile_id::text,19));
  select * into employment from public.staff_kindergarten_employments
    where staff_id=employee.id and profile_id=employee.profile_id and garden_id=target_garden_id
      and status='active' and (start_date is null or start_date<=target_shift_date)
      and (end_date is null or end_date>=target_shift_date)
    order by created_at limit 1 for update;
  if employment.id is null or not employee.approved_to_work or employee.onboarding_status<>'active' then
    raise exception 'shift_employment_denied' using errcode='42501';
  end if;
  if exists(select 1 from public.staff_shifts sh join public.staff s on s.id=sh.staff_id
      where s.profile_id=employee.profile_id and sh.shift_date=target_shift_date
        and sh.planned_start is not null and sh.planned_end is not null
        and sh.status not in ('cancelled','canceled')
        and sh.planned_start<target_end and sh.planned_end>target_start) then
    raise exception 'staff_scheduling_conflict' using errcode='23505';
  end if;
  insert into public.staff_shifts(staff_id,garden_id,employment_id,shift_date,planned_start,planned_end,status)
  values(employee.id,target_garden_id,employment.id,target_shift_date,target_start,target_end,'planned')
  returning * into result;
  return result;
end $$;
revoke all on function public.schedule_staff_employment_shift(uuid,uuid,date,time,time) from public,anon;
grant execute on function public.schedule_staff_employment_shift(uuid,uuid,date,time,time) to authenticated;
