-- Run inside a rollback-only transaction on the guarded local database.
create function pg_temp.require_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'QA assertion failed: %',label; end if; end $$;

-- Both record variants work; invalid Garden/Classroom boundaries still fail.
update public.child_classroom_assignments set enrollment_id=enrollment_id where child_id='00000000-0000-4000-8000-000000000901';
update public.staff_classroom_assignments set employment_id=employment_id where staff_id='00000000-0000-4000-8000-000000000b01';
do $$ declare denied boolean:=false; begin
  begin update public.child_classroom_assignments set classroom_id='00000000-0000-4000-8000-000000000703' where child_id='00000000-0000-4000-8000-000000000901';
  exception when check_violation then denied:=true; end;
  perform pg_temp.require_true(denied,'child cross-garden assignment denied');
end $$;
do $$ declare denied boolean:=false; begin
  begin update public.staff_classroom_assignments set classroom_id='00000000-0000-4000-8000-000000000703' where staff_id='00000000-0000-4000-8000-000000000b01';
  exception when check_violation then denied:=true; end;
  perform pg_temp.require_true(denied,'staff cross-garden assignment denied');
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.require_true(public.can_guardian_access_child('00000000-0000-4000-8000-000000000801','profile'),'parent own child');
select pg_temp.require_true(not public.can_guardian_access_child('00000000-0000-4000-8000-000000000802','profile'),'parent other child denied');
select pg_temp.require_true((select count(*) from public.permanent_child_files where id='00000000-0000-4000-8000-000000000801')=1,'parent own child RLS');
select pg_temp.require_true((select count(*) from public.permanent_child_files where id='00000000-0000-4000-8000-000000000802')=0,'parent other child RLS');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select pg_temp.require_true(public.can_manage_garden('00000000-0000-4000-8000-000000000601'),'manager own garden');
select pg_temp.require_true(not public.can_manage_garden('00000000-0000-4000-8000-000000000602'),'manager other garden denied');
select pg_temp.require_true((select count(*) from public.children where garden_id='00000000-0000-4000-8000-000000000602')=0,'manager other children RLS');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
select pg_temp.require_true(public.can_staff_access_garden('00000000-0000-4000-8000-000000000601'),'staff own garden');
select pg_temp.require_true(not public.can_staff_access_garden('00000000-0000-4000-8000-000000000602'),'staff other garden denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000304',true);
select pg_temp.require_true(not public.can_staff_access_garden('00000000-0000-4000-8000-000000000601'),'candidate no operational garden');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000305',true);
select pg_temp.require_true(not public.can_staff_access_garden('00000000-0000-4000-8000-000000000601'),'revoked staff denied');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000401',true);
select pg_temp.require_true(public.can_inspector_access_garden('00000000-0000-4000-8000-000000000601'),'approved assigned inspector');
select pg_temp.require_true(not public.can_inspector_access_garden('00000000-0000-4000-8000-000000000602'),'inspector unassigned garden denied');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000f01',true);
select pg_temp.require_true(public.can_access_observer_site('00000000-0000-4000-8000-000000000e01'),'observer own Site');
select pg_temp.require_true(not public.can_access_observer_site('00000000-0000-4000-8000-000000000e02'),'observer other Site denied');
select pg_temp.require_true((select count(*) from public.observer_sites where id='00000000-0000-4000-8000-000000000e01')=1,'observer own Site RLS');
select pg_temp.require_true((select count(*) from public.observer_sites where id='00000000-0000-4000-8000-000000000e02')=0,'observer other Site RLS');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
select pg_temp.require_true(public.is_admin(),'QA admin contract');
select pg_temp.require_true(public.can_manage_garden('00000000-0000-4000-8000-000000000602'),'admin authorized Garden access');
reset role;
select pg_temp.require_true(not has_function_privilege('anon','public.approve_observer_managed_device_enrollment(uuid,uuid,uuid,uuid)','execute'),'anon privileged gateway RPC denied');
select pg_temp.require_true(not exists(select 1 from pg_trigger where tgname in ('validate_child_classroom_scope','validate_staff_classroom_scope') and tgenabled='D'),'security triggers remain enabled');
