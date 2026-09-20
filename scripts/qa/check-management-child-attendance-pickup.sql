-- GB-M33 synthetic rollback-only matrix. Apply the proposed migration in the
-- same transaction first; never run this test against Production.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ declare a jsonb; b jsonb; begin
  a:=public.management_add_pickup_contact('00000000-0000-4000-8000-000000000901','QA Pickup A','grandparent',null,null,null,null);
  b:=public.management_add_pickup_contact('00000000-0000-4000-8000-000000000901','QA Pickup Revoked','grandparent',null,null,null,null);
  if a->>'id' is null or b->>'id' is null then raise exception 'contact_creation_failed'; end if;
  perform public.management_revoke_pickup_contact((b->>'id')::uuid);
  begin
    perform public.management_add_pickup_contact('00000000-0000-4000-8000-000000000902','Wrong Garden','other',null,null,null,null);
    raise exception 'cross_child_contact_allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
do $$ begin
  if not public.management_can_record_child_attendance('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901')
    or public.management_can_record_child_attendance('00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000902')
    then raise exception 'staff_garden_classroom_scope'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
do $$ begin
  if public.management_can_record_child_attendance('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901')
    then raise exception 'staff_unrelated_classroom_allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ declare first_result jsonb; second_result jsonb; released jsonb; repeated jsonb;
  good_contact uuid; revoked_contact uuid; arrived_at timestamptz; begin
  select id into good_contact from public.authorized_pickup_contacts where full_name='QA Pickup A';
  begin
    perform public.management_child_release('00000000-0000-4000-8000-000000000601',
      '00000000-0000-4000-8000-000000000901',good_contact,null);
    raise exception 'release_without_arrival_allowed';
  exception when check_violation then null; end;
  first_result:=public.management_child_arrival('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901');
  second_result:=public.management_child_arrival('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901');
  if first_result->>'attendance_id' is distinct from second_result->>'attendance_id' or second_result->>'idempotent'<>'true'
    then raise exception 'arrival_not_idempotent'; end if;
  select check_in_at into arrived_at from public.attendance where id=(first_result->>'attendance_id')::uuid;
  if arrived_at is null or (select count(*) from public.attendance where child_id='00000000-0000-4000-8000-000000000901')<>1
    then raise exception 'arrival_not_canonical'; end if;
  select id into revoked_contact from public.authorized_pickup_contacts where full_name='QA Pickup Revoked';
  begin
    perform public.management_child_release('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901',revoked_contact,null);
    raise exception 'revoked_pickup_released';
  exception when insufficient_privilege then null; end;
  begin
    perform public.management_child_release('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901',null,null);
    raise exception 'unknown_pickup_released';
  exception when invalid_parameter_value then null; end;
  select id into good_contact from public.authorized_pickup_contacts where full_name='QA Pickup A';
  released:=public.management_child_release('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901',good_contact,null);
  repeated:=public.management_child_release('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901',good_contact,null);
  if released->>'pickup_event_id' is distinct from repeated->>'pickup_event_id'
    or repeated->>'idempotent'<>'true' or (select count(*) from public.child_pickup_events where release_confirmed and child_id='00000000-0000-4000-8000-000000000901')<>1
    then raise exception 'release_not_idempotent'; end if;
  if not exists(select 1 from public.attendance where id=(first_result->>'attendance_id')::uuid and check_out_at is not null and check_in_at=arrived_at)
    then raise exception 'release_not_atomic'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  if exists(select 1 from public.attendance where child_id='00000000-0000-4000-8000-000000000901')
    or exists(select 1 from public.child_pickup_events where child_id='00000000-0000-4000-8000-000000000901')
    then raise exception 'parent_cross_child_read'; end if;
end $$;
reset role;
-- A second legal Guardian gains their own Child scope without becoming the
-- legacy primary Parent. This distinguishes canonical links from old pointers.
insert into public.child_guardian_links(permanent_child_file_id,guardian_profile_id,
  relationship_type,is_primary,legal_authority,status,source)
select permanent_child_file_id,'00000000-0000-4000-8000-000000000102',
  'guardian',false,true,'active','gb_m33_synthetic_test'
from public.children where id='00000000-0000-4000-8000-000000000901';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  if not public.management_can_guardian_read_child('00000000-0000-4000-8000-000000000901')
    or (select count(*) from public.attendance where child_id='00000000-0000-4000-8000-000000000901')<>1
    then raise exception 'secondary_guardian_read_denied'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$ declare absent_result jsonb; corrected jsonb; guardian_release jsonb; begin
  absent_result:=public.management_child_absence('00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000902','mark_absent',null);
  if absent_result->>'status'<>'absent' then raise exception 'absence_missing'; end if;
  begin
    perform public.management_child_arrival('00000000-0000-4000-8000-000000000602',
      '00000000-0000-4000-8000-000000000902');
    raise exception 'absence_silently_overwritten';
  exception when check_violation then null; end;
  corrected:=public.management_child_absence('00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000902','correct_to_present','Synthetic correction reason');
  if corrected->>'status'<>'present' or not exists(select 1 from public.attendance_compliance_audit_trail
    where attendance_id=(corrected->>'attendance_id')::uuid and action='attendance_corrected')
    then raise exception 'correction_audit_missing'; end if;
  guardian_release:=public.management_child_release('00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000902',null,'00000000-0000-4000-8000-000000000102');
  if guardian_release->>'status'<>'departed' then raise exception 'guardian_pickup_failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000401',true);
do $$ begin
  if exists(select 1 from public.attendance where child_id='00000000-0000-4000-8000-000000000901')
    or exists(select 1 from public.child_pickup_events where child_id='00000000-0000-4000-8000-000000000901')
    then raise exception 'inspector_blanket_attendance'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
do $$ begin
  if exists(select 1 from public.attendance where child_id='00000000-0000-4000-8000-000000000901')
    or public.management_can_read_staff_attendance('00000000-0000-4000-8000-000000000601',
      (select id from public.staff where profile_id='00000000-0000-4000-8000-000000000301' limit 1))
    then raise exception 'admin_blanket_attendance'; end if;
end $$;
reset role;
do $$ begin
  if has_table_privilege('authenticated','public.attendance','insert')
    or has_table_privilege('authenticated','public.attendance','update')
    or has_table_privilege('authenticated','public.child_pickup_events','insert')
    or has_function_privilege('anon','public.management_child_release(uuid,uuid,uuid,uuid)','execute')
    then raise exception 'direct_write_or_anonymous_rpc_available'; end if;
end $$;
select 'GB-M33 synthetic attendance/pickup PASS';
