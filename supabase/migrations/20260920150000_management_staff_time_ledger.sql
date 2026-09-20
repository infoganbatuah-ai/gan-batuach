-- GB-M34: one operational Staff-time record per existing staff_shifts row.
-- This is not payroll, statutory overtime, tax, benefits, or a payslip.
create or replace function public.management_can_manage_staff_time(p_garden_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists (
    select 1 from public.garden_management_memberships m
    join public.profiles p on p.id=m.profile_id and p.active
    join public.gardens g on g.id=m.garden_id
    where m.profile_id=auth.uid() and m.garden_id=p_garden_id
      and m.status='active' and m.relationship_role in ('owner','manager')
      and p.role::text in ('owner','manager') and g.status::text='active'
  );
$$;
revoke all on function public.management_can_manage_staff_time(uuid) from public,anon;
grant execute on function public.management_can_manage_staff_time(uuid) to authenticated;

-- The optional planning Classroom must belong to the same Garden.
alter table public.staff_shifts add column if not exists classroom_id uuid references public.classrooms(id) on delete set null;
alter table public.staff_shifts add column if not exists staff_profile_id uuid references public.profiles(id) on delete set null;
alter table public.staff_shifts add column if not exists approved_at timestamptz;
alter table public.staff_shifts add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.staff_shifts add column if not exists rate_version_id uuid;
update public.staff_shifts sh set staff_profile_id=s.profile_id
  from public.staff s where sh.staff_id=s.id and sh.staff_profile_id is null and s.profile_id is not null;
do $$ begin
  if exists(select 1 from public.staff_shifts where staff_profile_id is not null
    and actual_start is not null and actual_end is null and status='started'
    group by staff_profile_id having count(*)>1) then
    raise exception 'staff_open_shift_duplicates_require_review';
  end if;
end $$;
create unique index if not exists staff_one_open_session_per_profile_idx
  on public.staff_shifts(staff_profile_id)
  where staff_profile_id is not null and actual_start is not null and actual_end is null and status='started';
create index if not exists staff_time_garden_period_idx on public.staff_shifts(garden_id,shift_date,staff_id);

-- Rates are Garden-employment-specific, immutable versions. They are private
-- operational cost inputs, not final salary or a legal payroll determination.
create table if not exists public.staff_time_rates (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete restrict,
  employment_id uuid not null references public.staff_kindergarten_employments(id) on delete restrict,
  rate_kind text not null check(rate_kind in ('hourly','monthly')),
  amount numeric(12,2) not null check(amount>=0),
  currency text not null default 'ILS' check(currency='ILS'),
  effective_from date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(employment_id,effective_from)
);
alter table public.staff_shifts add constraint staff_shifts_rate_version_fkey
  foreign key(rate_version_id) references public.staff_time_rates(id) on delete restrict not valid;
alter table public.staff_shifts validate constraint staff_shifts_rate_version_fkey;
create index if not exists staff_time_rates_lookup_idx on public.staff_time_rates(employment_id,effective_from desc);
alter table public.staff_time_rates enable row level security;
create policy "staff time rates manager read" on public.staff_time_rates for select
  using(public.management_can_manage_staff_time(garden_id));
revoke all on public.staff_time_rates from public,anon,authenticated;
grant select on public.staff_time_rates to authenticated;

-- A correction is an append-only explanation of the previous and amended
-- actual clock values; no historical event is overwritten in the audit trail.
create table if not exists public.staff_time_corrections (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.staff_shifts(id) on delete restrict,
  garden_id uuid not null references public.gardens(id) on delete restrict,
  actor_id uuid references public.profiles(id),
  action text not null check(action in ('correct','approve','reopen','employment_revoked')),
  reason text not null check(length(btrim(reason))>=8),
  previous_start timestamptz,
  previous_end timestamptz,
  new_start timestamptz,
  new_end timestamptz,
  previous_minutes integer,
  new_minutes integer,
  created_at timestamptz not null default now()
);
create index if not exists staff_time_corrections_shift_idx on public.staff_time_corrections(shift_id,created_at desc);
alter table public.staff_time_corrections enable row level security;
create policy "staff time corrections scoped read" on public.staff_time_corrections for select using (
  public.management_can_manage_staff_time(garden_id) or exists (
    select 1 from public.staff_shifts sh join public.staff s on s.id=sh.staff_id
    where sh.id=shift_id and s.profile_id=auth.uid() and sh.garden_id=staff_time_corrections.garden_id
  )
);
revoke all on public.staff_time_corrections from public,anon,authenticated;
grant select on public.staff_time_corrections to authenticated;

-- Direct table mutation would bypass server time, employment, correction and
-- cross-Garden checks. All operational writes use reviewed RPCs below.
drop policy if exists "staff shifts manager write" on public.staff_shifts;
drop policy if exists "staff shifts employment scoped read" on public.staff_shifts;
create policy "staff shifts own or manager read" on public.staff_shifts for select using (
  public.management_can_manage_staff_time(garden_id) or
  staff_profile_id=auth.uid()
);
revoke insert,update,delete on public.staff_shifts from public,anon,authenticated;

create or replace function public.management_staff_shift_integrity()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_staff public.staff; v_rate uuid;
begin
  select * into v_staff from public.staff where id=new.staff_id;
  if v_staff.id is null or v_staff.garden_id<>new.garden_id then
    raise exception 'staff_shift_scope_invalid' using errcode='42501';
  end if;
  new.staff_profile_id:=v_staff.profile_id;
  if new.classroom_id is not null and not exists(
    select 1 from public.classrooms c where c.id=new.classroom_id and c.garden_id=new.garden_id and c.status='active'
  ) then raise exception 'staff_shift_classroom_invalid' using errcode='42501'; end if;
  if new.employment_id is not null and not exists(
    select 1 from public.staff_kindergarten_employments e
    where e.id=new.employment_id and e.staff_id=new.staff_id and e.garden_id=new.garden_id
  ) then raise exception 'staff_shift_employment_invalid' using errcode='42501'; end if;
  if new.actual_end is not null then
    if new.actual_start is null or new.actual_end<new.actual_start then
      raise exception 'staff_shift_time_invalid' using errcode='23514';
    end if;
    new.total_minutes:=greatest(0,round(extract(epoch from (new.actual_end-new.actual_start))/60)::integer);
    if new.rate_version_id is null and new.employment_id is not null then
      select r.id into v_rate from public.staff_time_rates r
      where r.employment_id=new.employment_id and r.garden_id=new.garden_id
        and r.effective_from<=new.shift_date order by r.effective_from desc limit 1;
      new.rate_version_id:=v_rate;
    end if;
  else new.total_minutes:=0; end if;
  return new;
end $$;
revoke all on function public.management_staff_shift_integrity() from public,anon,authenticated;
drop trigger if exists management_staff_shift_integrity_trigger on public.staff_shifts;
create trigger management_staff_shift_integrity_trigger before insert or update on public.staff_shifts
for each row execute function public.management_staff_shift_integrity();

alter table public.staff_workforce_audit_events drop constraint if exists staff_workforce_audit_type_check;
alter table public.staff_workforce_audit_events add constraint staff_workforce_audit_type_check check(event_type in (
  'location_sample','auto_shift_started','auto_shift_closed','attendance_requires_review',
  'schedule_changed','task_completed','compliance_action','manager_intervention',
  'absence_requested','absence_reviewed','clock_in','clock_out','time_corrected',
  'time_approved','time_reopened','rate_version_created','employment_session_flagged'
)) not valid;
alter table public.staff_workforce_audit_events validate constraint staff_workforce_audit_type_check;

create or replace function public.staff_attendance_transition(target_garden_id uuid,
  target_action text, target_lat numeric default null, target_lng numeric default null)
returns public.staff_shifts language plpgsql security definer set search_path=public as $$
declare e public.staff_kindergarten_employments; existing public.staff_shifts;
        result public.staff_shifts; effective_at timestamptz; matching_samples integer;
        v_date date; v_zone text; v_profile uuid:=auth.uid();
        is_automatic boolean:=target_action in ('auto_check_in','auto_check_out');
        is_check_in boolean:=target_action in ('check_in','auto_check_in');
begin
  if target_action not in ('check_in','check_out','auto_check_in','auto_check_out') then
    raise exception 'attendance_action_invalid' using errcode='23514'; end if;
  if v_profile is null or not exists(select 1 from public.profiles p
    where p.id=v_profile and p.role::text='staff' and p.active) then
    raise exception 'staff_employment_denied' using errcode='42501'; end if;
  select g.operational_timezone into v_zone from public.gardens g
    where g.id=target_garden_id and g.status::text='active';
  if v_zone is null then raise exception 'staff_garden_inactive' using errcode='42501'; end if;
  v_date:=(now() at time zone v_zone)::date;
  perform pg_advisory_xact_lock(hashtextextended(v_profile::text,19));
  select * into e from public.staff_kindergarten_employments em
    where em.profile_id=v_profile and em.garden_id=target_garden_id and em.status='active'
      and (em.start_date is null or em.start_date<=v_date)
      and (em.end_date is null or em.end_date>=v_date)
    order by em.created_at limit 1 for update;
  if e.id is null or not exists(select 1 from public.staff s
    where s.id=e.staff_id and s.profile_id=v_profile and s.garden_id=target_garden_id
      and s.approved_to_work and s.onboarding_status='active') then
    raise exception 'staff_employment_denied' using errcode='42501'; end if;

  effective_at:=now();
  if is_automatic then
    select min(created_at),count(*) into effective_at,matching_samples
      from public.staff_location_samples
      where staff_id=e.staff_id and profile_id=v_profile and garden_id=target_garden_id
        and inside_geofence=is_check_in and created_at between now()-interval '36 minutes' and now();
    if matching_samples<2 or effective_at>now()-interval '30 minutes'
      or not exists(select 1 from public.staff_location_samples
        where staff_id=e.staff_id and profile_id=v_profile and garden_id=target_garden_id
          and inside_geofence=is_check_in and created_at>=now()-interval '2 minutes')
      or exists(select 1 from public.staff_location_samples
        where staff_id=e.staff_id and profile_id=v_profile and garden_id=target_garden_id
          and inside_geofence<>is_check_in and created_at between effective_at and now()) then
      raise exception 'attendance_observation_incomplete' using errcode='23514';
    end if;
  end if;
  v_date:=(effective_at at time zone v_zone)::date;

  select * into existing from public.staff_shifts sh
    where sh.staff_profile_id=v_profile and sh.actual_start is not null
      and sh.actual_end is null and sh.status='started'
    order by sh.actual_start desc limit 1 for update;
  -- An ended employment never fabricates an end time. Flag its open record
  -- and free the worker to start an authorized shift in another Garden.
  if existing.id is not null and not exists(select 1 from public.staff_kindergarten_employments em
    where em.id=existing.employment_id and em.status='active'
      and (em.end_date is null or em.end_date>=v_date)) then
    update public.staff_shifts set status='requires_review',review_reason='missing_clock_out_after_employment_end'
      where id=existing.id;
    insert into public.staff_time_corrections(shift_id,garden_id,actor_id,action,reason,
      previous_start,previous_end,new_start,new_end,previous_minutes,new_minutes)
    values(existing.id,existing.garden_id,v_profile,'employment_revoked',
      'Employment ended with an open time entry',existing.actual_start,null,existing.actual_start,null,0,0);
    existing:=null;
  end if;
  if is_check_in then
    if existing.id is not null then
      if existing.garden_id=target_garden_id and existing.employment_id=e.id then return existing; end if;
      raise exception 'staff_already_clocked_in' using errcode='23505';
    end if;
    select * into result from public.staff_shifts sh
      where sh.staff_id=e.staff_id and sh.garden_id=target_garden_id and sh.shift_date=v_date
      order by sh.created_at desc limit 1 for update;
    if result.id is null then
      insert into public.staff_shifts(staff_id,garden_id,employment_id,shift_date,actual_start,status,
        gps_start_lat,gps_start_lng,auto_started,auto_start_detected_at)
      values(e.staff_id,target_garden_id,e.id,v_date,effective_at,'started',target_lat,target_lng,
        is_automatic,case when is_automatic then now() end) returning * into result;
    else
      if result.actual_start is not null or result.actual_end is not null or result.status in ('cancelled','canceled') then
        raise exception 'staff_shift_already_used' using errcode='23505'; end if;
      update public.staff_shifts set employment_id=e.id,actual_start=effective_at,status='started',
        gps_start_lat=target_lat,gps_start_lng=target_lng,auto_started=is_automatic,
        auto_start_detected_at=case when is_automatic then now() end
        where id=result.id returning * into result;
    end if;
    insert into public.staff_workforce_audit_events(staff_id,garden_id,actor_profile_id,event_type,entity_type,entity_id,details)
      values(e.staff_id,target_garden_id,v_profile,'clock_in','staff_shift',result.id,
        jsonb_build_object('source',case when is_automatic then 'observed_location' else 'manual_staff' end));
  else
    if existing.id is null then
      select * into result from public.staff_shifts sh where sh.staff_profile_id=v_profile
        and sh.garden_id=target_garden_id and sh.staff_id=e.staff_id and sh.actual_end>=now()-interval '1 day'
        order by sh.actual_end desc limit 1;
      if result.id is not null then return result; end if;
      raise exception 'staff_shift_not_open_in_garden' using errcode='23514';
    end if;
    if existing.garden_id<>target_garden_id or existing.staff_id<>e.staff_id then
      raise exception 'staff_shift_not_open_in_garden' using errcode='23514'; end if;
    if effective_at<existing.actual_start then raise exception 'attendance_time_invalid' using errcode='23514'; end if;
    update public.staff_shifts set actual_end=effective_at,status='completed',
      gps_end_lat=target_lat,gps_end_lng=target_lng,auto_closed=is_automatic,
      auto_end_detected_at=case when is_automatic then now() end
      where id=existing.id returning * into result;
    insert into public.staff_workforce_audit_events(staff_id,garden_id,actor_profile_id,event_type,entity_type,entity_id,details)
      values(e.staff_id,target_garden_id,v_profile,'clock_out','staff_shift',result.id,
        jsonb_build_object('source',case when is_automatic then 'observed_location' else 'manual_staff' end));
  end if;
  return result;
end $$;
revoke all on function public.staff_attendance_transition(uuid,text,numeric,numeric) from public,anon;
grant execute on function public.staff_attendance_transition(uuid,text,numeric,numeric) to authenticated;

create or replace function public.management_schedule_staff_shift(p_staff_id uuid,p_garden_id uuid,
  p_shift_date date,p_start time,p_end time,p_classroom_id uuid default null)
returns public.staff_shifts language plpgsql security definer set search_path=public as $$
declare v_staff public.staff; v_employment public.staff_kindergarten_employments;
        v_shift public.staff_shifts; v_profile uuid;
begin
  if not public.management_can_manage_staff_time(p_garden_id) then
    raise exception 'shift_management_denied' using errcode='42501'; end if;
  if p_shift_date is null or p_start is null or p_end is null or p_start=p_end then
    raise exception 'shift_schedule_invalid' using errcode='23514'; end if;
  select * into v_staff from public.staff where id=p_staff_id and garden_id=p_garden_id;
  if v_staff.id is null or v_staff.profile_id is null or not v_staff.approved_to_work
    or v_staff.onboarding_status<>'active' then
    raise exception 'shift_employment_denied' using errcode='42501'; end if;
  v_profile:=v_staff.profile_id;
  perform pg_advisory_xact_lock(hashtextextended(v_profile::text,19));
  select * into v_employment from public.staff_kindergarten_employments e
    where e.staff_id=v_staff.id and e.profile_id=v_profile and e.garden_id=p_garden_id
      and e.status='active' and (e.start_date is null or e.start_date<=p_shift_date)
      and (e.end_date is null or e.end_date>=p_shift_date)
    order by e.created_at limit 1 for update;
  if v_employment.id is null then raise exception 'shift_employment_denied' using errcode='42501'; end if;
  if p_classroom_id is not null and not exists(select 1 from public.classrooms c
    where c.id=p_classroom_id and c.garden_id=p_garden_id and c.status='active') then
    raise exception 'shift_classroom_denied' using errcode='42501'; end if;
  -- Existing one-day Staff/Garden uniqueness is preserved; planned windows
  -- remain distinct from actual timestamps. Overnight windows are explicit.
  if exists(select 1 from public.staff_shifts sh where sh.staff_id=p_staff_id
    and sh.garden_id=p_garden_id and sh.shift_date=p_shift_date) then
    raise exception 'staff_shift_already_planned' using errcode='23505'; end if;
  if exists(select 1 from public.staff_shifts sh
    join public.gardens existing_garden on existing_garden.id=sh.garden_id
    join public.gardens target_garden on target_garden.id=p_garden_id
    where sh.staff_profile_id=v_profile and sh.shift_date between p_shift_date-1 and p_shift_date+1
      and sh.planned_start is not null and sh.planned_end is not null
      and sh.status not in ('cancelled','canceled')
      and tstzrange((sh.shift_date+sh.planned_start) at time zone existing_garden.operational_timezone,
          ((sh.shift_date+case when sh.planned_end<=sh.planned_start then 1 else 0 end)+sh.planned_end) at time zone existing_garden.operational_timezone,'[)')
        && tstzrange((p_shift_date+p_start) at time zone target_garden.operational_timezone,
          ((p_shift_date+case when p_end<=p_start then 1 else 0 end)+p_end) at time zone target_garden.operational_timezone,'[)')
  ) then raise exception 'staff_scheduling_conflict' using errcode='23505'; end if;
  insert into public.staff_shifts(staff_id,garden_id,employment_id,classroom_id,shift_date,
    planned_start,planned_end,status)
    values(p_staff_id,p_garden_id,v_employment.id,p_classroom_id,p_shift_date,p_start,p_end,'planned')
    returning * into v_shift;
  insert into public.staff_workforce_audit_events(staff_id,garden_id,actor_profile_id,event_type,entity_type,entity_id)
    values(p_staff_id,p_garden_id,auth.uid(),'schedule_changed','staff_shift',v_shift.id);
  insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,
    notification_type,preference_category,dedupe_key,action_url)
    values(p_garden_id,v_profile,'משמרת חדשה','יש עדכון בלוח המשמרות שלך','staff_shift',v_shift.id,
      'staff_shift_assigned','task','staff_shift:'||v_shift.id::text||':assigned','/dashboard/staff/shifts');
  return v_shift;
end $$;
revoke all on function public.management_schedule_staff_shift(uuid,uuid,date,time,time,uuid) from public,anon;
grant execute on function public.management_schedule_staff_shift(uuid,uuid,date,time,time,uuid) to authenticated;

create or replace function public.management_create_staff_time_rate(p_employment_id uuid,
  p_rate_kind text,p_amount numeric,p_effective_from date)
returns public.staff_time_rates language plpgsql security definer set search_path=public as $$
declare v_employment public.staff_kindergarten_employments; v_rate public.staff_time_rates;
        v_today date;
begin
  select * into v_employment from public.staff_kindergarten_employments where id=p_employment_id;
  if v_employment.id is null or not public.management_can_manage_staff_time(v_employment.garden_id) then
    raise exception 'staff_rate_denied' using errcode='42501'; end if;
  select (now() at time zone g.operational_timezone)::date into v_today
    from public.gardens g where g.id=v_employment.garden_id;
  if p_rate_kind not in ('hourly','monthly') or p_amount is null or p_amount<0
    or p_effective_from is null or p_effective_from<v_today
    or v_employment.status<>'active'
    or (v_employment.end_date is not null and p_effective_from>v_employment.end_date) then
    raise exception 'staff_rate_invalid' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_employment_id::text,23));
  if exists(select 1 from public.staff_time_rates r where r.employment_id=p_employment_id
    and r.effective_from>=p_effective_from) then
    raise exception 'staff_rate_date_conflict' using errcode='23505'; end if;
  insert into public.staff_time_rates(garden_id,employment_id,rate_kind,amount,effective_from,created_by)
    values(v_employment.garden_id,p_employment_id,p_rate_kind,p_amount,p_effective_from,auth.uid())
    returning * into v_rate;
  insert into public.staff_workforce_audit_events(staff_id,garden_id,actor_profile_id,event_type,entity_type,entity_id,
    details) values(v_employment.staff_id,v_employment.garden_id,auth.uid(),'rate_version_created',
      'staff_time_rate',v_rate.id,jsonb_build_object('kind',p_rate_kind,'effective_from',p_effective_from));
  return v_rate;
end $$;
revoke all on function public.management_create_staff_time_rate(uuid,text,numeric,date) from public,anon;
grant execute on function public.management_create_staff_time_rate(uuid,text,numeric,date) to authenticated;

create or replace function public.management_correct_staff_shift(p_shift_id uuid,
  p_actual_start timestamptz,p_actual_end timestamptz,p_reason text)
returns public.staff_shifts language plpgsql security definer set search_path=public as $$
declare v_old public.staff_shifts; v_new public.staff_shifts;
begin
  select * into v_old from public.staff_shifts where id=p_shift_id for update;
  if v_old.id is null or not public.management_can_manage_staff_time(v_old.garden_id) then
    raise exception 'staff_time_correction_denied' using errcode='42501'; end if;
  if v_old.approved_at is not null then raise exception 'staff_time_reopen_required' using errcode='23514'; end if;
  if p_reason is null or length(btrim(p_reason))<8 or p_actual_start is null
    or p_actual_end is null or p_actual_end<p_actual_start or p_actual_end>now()+interval '5 minutes' then
    raise exception 'staff_time_correction_invalid' using errcode='23514'; end if;
  update public.staff_shifts set actual_start=p_actual_start,actual_end=p_actual_end,
    status='completed',review_reason=null where id=p_shift_id returning * into v_new;
  insert into public.staff_time_corrections(shift_id,garden_id,actor_id,action,reason,
    previous_start,previous_end,new_start,new_end,previous_minutes,new_minutes)
    values(p_shift_id,v_old.garden_id,auth.uid(),'correct',btrim(p_reason),
      v_old.actual_start,v_old.actual_end,v_new.actual_start,v_new.actual_end,
      v_old.total_minutes,v_new.total_minutes);
  insert into public.staff_workforce_audit_events(staff_id,garden_id,actor_profile_id,event_type,entity_type,entity_id)
    values(v_old.staff_id,v_old.garden_id,auth.uid(),'time_corrected','staff_shift',p_shift_id);
  return v_new;
end $$;
revoke all on function public.management_correct_staff_shift(uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.management_correct_staff_shift(uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function public.management_review_staff_shift(p_shift_id uuid,p_action text,p_reason text default null)
returns public.staff_shifts language plpgsql security definer set search_path=public as $$
declare v_old public.staff_shifts; v_new public.staff_shifts;
begin
  select * into v_old from public.staff_shifts where id=p_shift_id for update;
  if v_old.id is null or not public.management_can_manage_staff_time(v_old.garden_id) then
    raise exception 'staff_time_review_denied' using errcode='42501'; end if;
  if p_action='approve' then
    if v_old.approved_at is not null then return v_old; end if;
    if v_old.actual_start is null or v_old.actual_end is null or v_old.status<>'completed' then
      raise exception 'staff_time_not_complete' using errcode='23514'; end if;
    update public.staff_shifts set approved_at=now(),approved_by=auth.uid()
      where id=p_shift_id returning * into v_new;
  elsif p_action='reopen' then
    if v_old.approved_at is null or p_reason is null or length(btrim(p_reason))<8 then
      raise exception 'staff_time_reopen_invalid' using errcode='23514'; end if;
    update public.staff_shifts set approved_at=null,approved_by=null
      where id=p_shift_id returning * into v_new;
  else raise exception 'staff_time_review_action_invalid' using errcode='23514'; end if;
  insert into public.staff_time_corrections(shift_id,garden_id,actor_id,action,reason,
    previous_start,previous_end,new_start,new_end,previous_minutes,new_minutes)
    values(p_shift_id,v_old.garden_id,auth.uid(),p_action,
      case when p_action='approve' then 'Manager approved completed time entry' else btrim(p_reason) end,
      v_old.actual_start,v_old.actual_end,v_new.actual_start,v_new.actual_end,
      v_old.total_minutes,v_new.total_minutes);
  insert into public.staff_workforce_audit_events(staff_id,garden_id,actor_profile_id,event_type,entity_type,entity_id)
    values(v_old.staff_id,v_old.garden_id,auth.uid(),
      case when p_action='approve' then 'time_approved' else 'time_reopened' end,'staff_shift',p_shift_id);
  return v_new;
end $$;
revoke all on function public.management_review_staff_shift(uuid,text,text) from public,anon;
grant execute on function public.management_review_staff_shift(uuid,text,text) to authenticated;

-- One bounded month at a time. Only an authorized Garden Owner/Manager gets
-- rates; monthly salary never produces a fictitious hourly labor cost.
create or replace function public.management_staff_time_export(p_garden_id uuid,p_period_start date)
returns table(shift_id uuid,staff_id uuid,employment_id uuid,staff_name text,shift_date date,
  planned_start time,planned_end time,actual_start timestamptz,actual_end timestamptz,
  worked_minutes integer,approval_state text,rate_kind text,rate_amount numeric,
  estimated_labor_cost numeric,currency text,missing_clock_out boolean)
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.management_can_manage_staff_time(p_garden_id) then
    raise exception 'staff_time_export_denied' using errcode='42501'; end if;
  if p_period_start is null or extract(day from p_period_start)<>1 then
    raise exception 'staff_time_period_invalid' using errcode='23514'; end if;
  return query select sh.id,sh.staff_id,sh.employment_id,s.full_name::text,sh.shift_date,
    sh.planned_start,sh.planned_end,sh.actual_start,sh.actual_end,
    case when sh.actual_end is not null then sh.total_minutes else null end,
    case when sh.approved_at is not null then 'approved'
      when sh.actual_start is not null and sh.actual_end is null and
        (sh.status='requires_review' or sh.shift_date<(now() at time zone g.operational_timezone)::date)
        then 'missing_clock_out'
      when sh.actual_start is not null and sh.actual_end is null then 'in_progress'
      when sh.actual_end is not null then 'pending_review' else 'scheduled' end,
    r.rate_kind,r.amount,
    case when sh.approved_at is not null and r.rate_kind='hourly'
      then round(sh.total_minutes::numeric*r.amount/60,2) else null end,
    r.currency,
    sh.actual_start is not null and sh.actual_end is null and
      (sh.status='requires_review' or sh.shift_date<(now() at time zone g.operational_timezone)::date)
  from public.staff_shifts sh
  join public.staff s on s.id=sh.staff_id and s.garden_id=sh.garden_id
  join public.gardens g on g.id=sh.garden_id
  left join public.staff_time_rates r on r.id=sh.rate_version_id and r.garden_id=sh.garden_id
  where sh.garden_id=p_garden_id and sh.shift_date>=p_period_start
    and sh.shift_date<(p_period_start+interval '1 month')::date
  order by sh.shift_date, s.full_name, sh.id
  limit 5000;
end $$;
revoke all on function public.management_staff_time_export(uuid,date) from public,anon;
grant execute on function public.management_staff_time_export(uuid,date) to authenticated;

-- Keep the old RPC as a compatibility adapter. It now inherits the narrower
-- Garden HR authority and the same Classroom-aware overlap validation.
create or replace function public.schedule_staff_employment_shift(target_staff_id uuid,
  target_garden_id uuid,target_shift_date date,target_start time,target_end time)
returns public.staff_shifts language sql security definer set search_path=public as $$
  select public.management_schedule_staff_shift(target_staff_id,target_garden_id,
    target_shift_date,target_start,target_end,null::uuid);
$$;
revoke all on function public.schedule_staff_employment_shift(uuid,uuid,date,time,time) from public,anon;
grant execute on function public.schedule_staff_employment_shift(uuid,uuid,date,time,time) to authenticated;

-- Employment revocation closes operational session authority, not worked
-- hours. Actual end remains unknown until a reasoned Manager correction.
create or replace function public.management_flag_revoked_staff_session()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_shift public.staff_shifts;
begin
  if old.status='active' and new.status<>'active' and new.profile_id is not null then
    -- The employment row is already locked by UPDATE. Attendance locks the
    -- advisory key before that row; acquiring it here would invert lock order.
    for v_shift in select * from public.staff_shifts sh
      where sh.employment_id=new.id and sh.actual_start is not null
        and sh.actual_end is null and sh.status='started' for update loop
      update public.staff_shifts set status='requires_review',
        review_reason='missing_clock_out_after_employment_end' where id=v_shift.id;
      insert into public.staff_time_corrections(shift_id,garden_id,actor_id,action,reason,
        previous_start,previous_end,new_start,new_end,previous_minutes,new_minutes)
        values(v_shift.id,v_shift.garden_id,auth.uid(),'employment_revoked',
          'Employment revoked with an open time entry',v_shift.actual_start,null,
          v_shift.actual_start,null,0,0);
      insert into public.staff_workforce_audit_events(staff_id,garden_id,actor_profile_id,
        event_type,entity_type,entity_id)
        values(v_shift.staff_id,v_shift.garden_id,auth.uid(),'employment_session_flagged','staff_shift',v_shift.id);
    end loop;
  end if;
  return new;
end $$;
revoke all on function public.management_flag_revoked_staff_session() from public,anon,authenticated;
drop trigger if exists management_flag_revoked_staff_session_trigger on public.staff_kindergarten_employments;
create trigger management_flag_revoked_staff_session_trigger after update of status
  on public.staff_kindergarten_employments for each row
  execute function public.management_flag_revoked_staff_session();
