-- GB-M19 follow-up: an automatic 30-minute geofence decision must record
-- the observed boundary, not the time the threshold was finally detected.
create or replace function public.stamp_staff_location_sample_received_at()
returns trigger language plpgsql set search_path=public as $$
begin
  if tg_op='INSERT' then new.created_at:=now();
  else new.created_at:=old.created_at; end if;
  return new;
end $$;
drop trigger if exists stamp_staff_location_sample_received_at_trigger on public.staff_location_samples;
create trigger stamp_staff_location_sample_received_at_trigger
before insert or update on public.staff_location_samples
for each row execute function public.stamp_staff_location_sample_received_at();

create or replace function public.staff_attendance_transition(target_garden_id uuid,
  target_action text, target_lat numeric default null, target_lng numeric default null)
returns public.staff_shifts language plpgsql security definer set search_path=public as $$
declare e public.staff_kindergarten_employments; existing public.staff_shifts;
        result public.staff_shifts; effective_at timestamptz; matching_samples integer;
        is_automatic boolean := target_action in ('auto_check_in','auto_check_out');
        is_check_in boolean := target_action in ('check_in','auto_check_in');
begin
  if target_action not in ('check_in','check_out','auto_check_in','auto_check_out') then
    raise exception 'attendance_action_invalid' using errcode='23514';
  end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='staff' and p.active) then
    raise exception 'staff_employment_denied' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,19));
  select * into e from public.staff_kindergarten_employments
    where profile_id=auth.uid() and garden_id=target_garden_id and status='active'
      and (start_date is null or start_date<=current_date)
      and (end_date is null or end_date>=current_date)
    order by created_at limit 1 for update;
  if e.id is null or not public.can_staff_access_garden(target_garden_id) then
    raise exception 'staff_employment_denied' using errcode='42501';
  end if;

  effective_at := now();
  if is_automatic then
    select min(created_at),count(*) into effective_at,matching_samples
    from public.staff_location_samples
    where staff_id=e.staff_id and profile_id=auth.uid() and garden_id=target_garden_id
      and inside_geofence=is_check_in and created_at between now()-interval '36 minutes' and now();
    if matching_samples<2 or effective_at>now()-interval '30 minutes'
      or not exists(select 1 from public.staff_location_samples
          where staff_id=e.staff_id and profile_id=auth.uid() and garden_id=target_garden_id
            and inside_geofence=is_check_in and created_at>=now()-interval '2 minutes')
      or exists(select 1 from public.staff_location_samples
          where staff_id=e.staff_id and profile_id=auth.uid() and garden_id=target_garden_id
            and inside_geofence<>is_check_in and created_at between effective_at and now()) then
      raise exception 'attendance_observation_incomplete' using errcode='23514';
    end if;
  end if;

  select * into existing from public.staff_shifts
    where staff_id in (select id from public.staff where profile_id=auth.uid())
      and actual_start is not null and actual_end is null
    order by actual_start desc limit 1 for update;
  if is_check_in then
    if existing.id is not null then
      if existing.garden_id=target_garden_id and existing.employment_id=e.id then return existing; end if;
      raise exception 'staff_already_clocked_in' using errcode='23505';
    end if;
    select * into result from public.staff_shifts
      where staff_id=e.staff_id and garden_id=target_garden_id
        and shift_date=(effective_at at time zone 'Asia/Jerusalem')::date
      order by created_at desc limit 1 for update;
    if result.id is null then
      insert into public.staff_shifts(staff_id,garden_id,employment_id,shift_date,actual_start,status,
        gps_start_lat,gps_start_lng,auto_started,auto_start_detected_at)
      values(e.staff_id,target_garden_id,e.id,(effective_at at time zone 'Asia/Jerusalem')::date,
        effective_at,'started',target_lat,target_lng,is_automatic,
        case when is_automatic then now() else null end)
      returning * into result;
    else
      if result.actual_end is not null then raise exception 'staff_shift_already_completed' using errcode='23505'; end if;
      update public.staff_shifts set employment_id=e.id,actual_start=effective_at,status='started',
        gps_start_lat=target_lat,gps_start_lng=target_lng,auto_started=is_automatic,
        auto_start_detected_at=case when is_automatic then now() else null end
      where id=result.id returning * into result;
    end if;
  else
    if existing.id is null or existing.garden_id<>target_garden_id or existing.staff_id<>e.staff_id then
      raise exception 'staff_shift_not_open_in_garden' using errcode='23514';
    end if;
    if effective_at<existing.actual_start then raise exception 'attendance_time_invalid' using errcode='23514'; end if;
    update public.staff_shifts set employment_id=e.id,actual_end=effective_at,status='completed',
      total_minutes=greatest(0,round(extract(epoch from (effective_at-existing.actual_start))/60)::integer),
      gps_end_lat=target_lat,gps_end_lng=target_lng,auto_closed=is_automatic,
      auto_end_detected_at=case when is_automatic then now() else null end
    where id=existing.id returning * into result;
  end if;
  return result;
end $$;
revoke all on function public.staff_attendance_transition(uuid,text,numeric,numeric) from public,anon;
grant execute on function public.staff_attendance_transition(uuid,text,numeric,numeric) to authenticated;
