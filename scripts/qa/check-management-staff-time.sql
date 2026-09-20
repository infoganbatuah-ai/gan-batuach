-- GB-M34 rollback-only role and ledger matrix. Run with the proposed migration
-- in one transaction against isolated Development synthetic fixtures only.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ declare sh public.staff_shifts; e uuid; r public.staff_time_rates; begin
  select id into e from public.staff_kindergarten_employments
    where profile_id='00000000-0000-4000-8000-000000000301' and garden_id='00000000-0000-4000-8000-000000000601';
  if not public.management_can_manage_staff_time('00000000-0000-4000-8000-000000000601')
    or public.management_can_manage_staff_time('00000000-0000-4000-8000-000000000602') then
    raise exception 'manager_tenant_scope'; end if;
  r:=public.management_create_staff_time_rate(e,'hourly',75,(now() at time zone 'Asia/Jerusalem')::date);
  sh:=public.management_schedule_staff_shift('00000000-0000-4000-8000-000000000b01',
    '00000000-0000-4000-8000-000000000601',(now() at time zone 'Asia/Jerusalem')::date+2,
    '09:00','17:00',null);
  if sh.id is null or sh.actual_start is not null or r.amount<>75 then raise exception 'planning_rate_state'; end if;
  begin
    perform public.management_schedule_staff_shift('00000000-0000-4000-8000-000000000b02',
      '00000000-0000-4000-8000-000000000601',(now() at time zone 'Asia/Jerusalem')::date+2,'09:00','17:00',null);
    raise exception 'wrong_garden_staff_scheduled';
  exception when insufficient_privilege then null; end;
  begin
    perform public.management_schedule_staff_shift('00000000-0000-4000-8000-000000000b05',
      '00000000-0000-4000-8000-000000000601',(now() at time zone 'Asia/Jerusalem')::date+2,'09:00','17:00',null);
    raise exception 'revoked_staff_scheduled';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.staff_shifts(staff_id,garden_id,employment_id,shift_date,
  actual_start,actual_end,status,approved_at,approved_by)
select e.staff_id,e.garden_id,e.id,(now() at time zone 'Asia/Jerusalem')::date,
  now()-interval '3 hours',now()-interval '1 hour','completed',now(),
  '00000000-0000-4000-8000-000000000201'
from public.staff_kindergarten_employments e
where e.profile_id='00000000-0000-4000-8000-000000000301'
  and e.garden_id='00000000-0000-4000-8000-000000000601';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
do $$ declare first_shift public.staff_shifts; second_shift public.staff_shifts; completed public.staff_shifts; begin
  if exists(select 1 from public.staff_time_rates) then raise exception 'staff_wage_read'; end if;
  first_shift:=public.staff_attendance_transition('00000000-0000-4000-8000-000000000601','check_in');
  second_shift:=public.staff_attendance_transition('00000000-0000-4000-8000-000000000601','check_in');
  if first_shift.id is distinct from second_shift.id or first_shift.actual_start is distinct from second_shift.actual_start then
    raise exception 'duplicate_clock_in'; end if;
  begin
    perform public.staff_attendance_transition('00000000-0000-4000-8000-000000000602','check_in');
    raise exception 'cross_garden_simultaneous_clock';
  exception when unique_violation then null; end;
  completed:=public.staff_attendance_transition('00000000-0000-4000-8000-000000000601','check_out');
  if completed.id<>first_shift.id or completed.actual_end is null then raise exception 'clock_out_missing'; end if;
  second_shift:=public.staff_attendance_transition('00000000-0000-4000-8000-000000000601','check_out');
  if second_shift.id<>completed.id or second_shift.actual_end is distinct from completed.actual_end then
    raise exception 'duplicate_clock_out'; end if;
  begin
    perform public.management_create_staff_time_rate((select id from public.staff_kindergarten_employments
      where profile_id='00000000-0000-4000-8000-000000000303' and garden_id='00000000-0000-4000-8000-000000000601'),
      'hourly',999,(now() at time zone 'Asia/Jerusalem')::date+1);
    raise exception 'staff_self_rate_change';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
do $$ begin
  if exists(select 1 from public.staff_shifts where staff_profile_id='00000000-0000-4000-8000-000000000303') then
    raise exception 'staff_cross_user_read'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000401',true);
do $$ begin
  if exists(select 1 from public.staff_time_rates) or exists(select 1 from public.staff_shifts) then
    raise exception 'inspector_wage_or_time_leak'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
do $$ begin
  if exists(select 1 from public.staff_time_rates) or exists(select 1 from public.staff_shifts) then
    raise exception 'admin_blanket_wage_or_time_access'; end if;
  begin
    perform public.management_staff_time_export('00000000-0000-4000-8000-000000000601',
      date_trunc('month',now() at time zone 'Asia/Jerusalem')::date);
    raise exception 'admin_blanket_export';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000305',true);
do $$ begin
  begin
    perform public.staff_attendance_transition('00000000-0000-4000-8000-000000000601','check_in');
    raise exception 'revoked_staff_clock_allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ declare sh public.staff_shifts; corrected public.staff_shifts; export_count integer; begin
  perform public.management_create_staff_time_rate((select id from public.staff_kindergarten_employments
    where profile_id='00000000-0000-4000-8000-000000000301' and garden_id='00000000-0000-4000-8000-000000000601'),
    'hourly',90,(now() at time zone 'Asia/Jerusalem')::date+1);
  if not exists(select 1 from public.management_staff_time_export(
    '00000000-0000-4000-8000-000000000601',date_trunc('month',now() at time zone 'Asia/Jerusalem')::date)
    where staff_id='00000000-0000-4000-8000-000000000b01' and estimated_labor_cost=150
      and rate_amount=75) then raise exception 'rate_history_repriced'; end if;
  select * into sh from public.staff_shifts where staff_profile_id='00000000-0000-4000-8000-000000000303'
    and actual_end is not null limit 1;
  corrected:=public.management_correct_staff_shift(sh.id,sh.actual_start-interval '2 hours',sh.actual_end,
    'Synthetic missing clock-in correction');
  if corrected.total_minutes<120 or not exists(select 1 from public.staff_time_corrections where shift_id=sh.id and action='correct') then
    raise exception 'correction_audit_or_duration'; end if;
  sh:=public.management_review_staff_shift(sh.id,'approve');
  if sh.approved_at is null then raise exception 'approval_missing'; end if;
  begin
    perform public.management_correct_staff_shift(sh.id,sh.actual_start,sh.actual_end,'No silent approved edit');
    raise exception 'approved_time_silently_changed';
  exception when check_violation then null; end;
  select count(*) into export_count from public.management_staff_time_export(
    '00000000-0000-4000-8000-000000000601',date_trunc('month',now() at time zone 'Asia/Jerusalem')::date)
    where shift_id=sh.id and approval_state='approved';
  if export_count<>1 then raise exception 'manager_export_missing'; end if;
  sh:=public.management_review_staff_shift(sh.id,'reopen','Synthetic approved period amendment');
  if sh.approved_at is not null then raise exception 'reopen_failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$ begin
  perform public.management_create_staff_time_rate((select id from public.staff_kindergarten_employments
    where profile_id='00000000-0000-4000-8000-000000000302' and garden_id='00000000-0000-4000-8000-000000000602'),
    'monthly',10000,(now() at time zone 'Asia/Jerusalem')::date);
  begin
    perform public.management_staff_time_export('00000000-0000-4000-8000-000000000601',
      date_trunc('month',now() at time zone 'Asia/Jerusalem')::date);
    raise exception 'cross_garden_export_allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.staff_shifts(staff_id,garden_id,employment_id,shift_date,
  actual_start,actual_end,status,approved_at,approved_by)
select e.staff_id,e.garden_id,e.id,(now() at time zone 'Asia/Jerusalem')::date,
  now()-interval '3 hours',now()-interval '1 hour','completed',now(),
  '00000000-0000-4000-8000-000000000202'
from public.staff_kindergarten_employments e
where e.profile_id='00000000-0000-4000-8000-000000000302'
  and e.garden_id='00000000-0000-4000-8000-000000000602';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$ begin
  if not exists(select 1 from public.management_staff_time_export(
    '00000000-0000-4000-8000-000000000602',date_trunc('month',now() at time zone 'Asia/Jerusalem')::date)
    where staff_id='00000000-0000-4000-8000-000000000b02' and rate_kind='monthly'
      and estimated_labor_cost is null) then raise exception 'monthly_salary_faked_hourly'; end if;
end $$;
reset role;
insert into public.staff_shifts(staff_id,garden_id,employment_id,shift_date,actual_start,status)
select e.staff_id,e.garden_id,e.id,(now() at time zone 'Asia/Jerusalem')::date-1,
  now()-interval '1 day','started'
from public.staff_kindergarten_employments e
where e.profile_id='00000000-0000-4000-8000-000000000301'
  and e.garden_id='00000000-0000-4000-8000-000000000601';
update public.staff_kindergarten_employments set status='revoked'
where profile_id='00000000-0000-4000-8000-000000000301'
  and garden_id='00000000-0000-4000-8000-000000000601';
do $$ begin
  if not exists(select 1 from public.staff_shifts where staff_profile_id='00000000-0000-4000-8000-000000000301'
    and status='requires_review' and actual_start is not null and actual_end is null and total_minutes=0)
    or not exists(select 1 from public.staff_time_corrections where action='employment_revoked'
      and garden_id='00000000-0000-4000-8000-000000000601') then
    raise exception 'revocation_session_not_safely_flagged'; end if;
end $$;
do $$ begin
  if has_table_privilege('authenticated','public.staff_shifts','update')
    or has_table_privilege('authenticated','public.staff_time_rates','insert')
    or has_function_privilege('anon','public.management_staff_time_export(uuid,date)','execute') then
    raise exception 'direct_write_or_anon_grant'; end if;
end $$;
select 'GB-M34 isolated synthetic role/ledger PASS';
