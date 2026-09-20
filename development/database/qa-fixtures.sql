-- Synthetic DEVELOPMENT fixtures only. Apply through the guarded seed command.
-- All normal triggers/RLS definitions remain enabled. No real customer PII.
do $$ begin
  if not exists(select 1 from development_metadata.baselines) then raise exception 'development baseline required'; end if;
  if (select count(*) from auth.users where email like '%@integration.qa.invalid')<>13 then raise exception 'controlled QA identities required'; end if;
end $$;

update public.profiles set role=case
  when right(id::text,3) in ('201','202') then 'manager'::public.app_role
  when right(id::text,3) in ('301','302','303','304','305') then 'staff'::public.app_role
  when right(id::text,3)='401' then 'inspector'::public.app_role
  when right(id::text,3)='501' then 'admin'::public.app_role
  else 'parent'::public.app_role end, must_change_password=false
where id in (select id from auth.users where email like '%@integration.qa.invalid');

insert into public.inspectors(id,service_cities) values ('00000000-0000-4000-8000-000000000401',array['QA City']) on conflict(id) do nothing;
insert into public.inspector_applications(profile_id,full_name,email,city,status,admin_decision,activated_at,metadata)
values ('00000000-0000-4000-8000-000000000401','QA Inspector','inspector-a@integration.qa.invalid','QA City','approved','isolated_qa_fixture',now(),'{"environment":"DEVELOPMENT","synthetic":true}');

insert into public.gardens(id,name,city,status,manager_id,inspector_id) values
('00000000-0000-4000-8000-000000000601','QA Garden A','QA City','active','00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000401'),
('00000000-0000-4000-8000-000000000602','QA Garden B','QA City','active','00000000-0000-4000-8000-000000000202',null);
update public.profiles set garden_id='00000000-0000-4000-8000-000000000601' where id in ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000301');
update public.profiles set garden_id='00000000-0000-4000-8000-000000000602' where id in ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000302');
insert into public.classrooms(id,garden_id,name,age_group_key) values
('00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000601','QA A1','toddlers'),
('00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000601','QA A2','toddlers'),
('00000000-0000-4000-8000-000000000703','00000000-0000-4000-8000-000000000602','QA B1','toddlers');
insert into public.permanent_child_files(id,full_name,primary_parent_profile_id) values
('00000000-0000-4000-8000-000000000801','QA Child A','00000000-0000-4000-8000-000000000101'),
('00000000-0000-4000-8000-000000000802','QA Child B','00000000-0000-4000-8000-000000000102');
insert into public.children(id,garden_id,full_name,permanent_child_file_id,status,identity_number) values
('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000601','QA Child A','00000000-0000-4000-8000-000000000801','active','QA-A'),
('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000602','QA Child B','00000000-0000-4000-8000-000000000802','active','QA-B');
insert into public.child_kindergarten_enrollments(child_id,permanent_child_file_id,garden_id,status) values
('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000801','00000000-0000-4000-8000-000000000601','active'),
('00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000802','00000000-0000-4000-8000-000000000602','active');
insert into public.child_classroom_assignments(garden_id,child_id,classroom_id) values
('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000701'),
('00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000703');
insert into public.staff_permanent_files(id,profile_id,full_name) values
('00000000-0000-4000-8000-000000000a01','00000000-0000-4000-8000-000000000301','QA Staff A'),
('00000000-0000-4000-8000-000000000a02','00000000-0000-4000-8000-000000000302','QA Staff B'),
('00000000-0000-4000-8000-000000000a03','00000000-0000-4000-8000-000000000303','QA Staff AB'),
('00000000-0000-4000-8000-000000000a05','00000000-0000-4000-8000-000000000305','QA Staff Revoked');
insert into public.staff(id,profile_id,garden_id,full_name,role_title,approved_to_work,onboarding_status) values
('00000000-0000-4000-8000-000000000b01','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000601','QA Staff A','teacher',true,'active'),
('00000000-0000-4000-8000-000000000b02','00000000-0000-4000-8000-000000000302','00000000-0000-4000-8000-000000000602','QA Staff B','teacher',true,'active'),
('00000000-0000-4000-8000-000000000b03','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000601','QA Staff AB A','teacher',true,'active'),
('00000000-0000-4000-8000-000000000b04','00000000-0000-4000-8000-000000000303','00000000-0000-4000-8000-000000000602','QA Staff AB B','assistant',true,'active'),
('00000000-0000-4000-8000-000000000b05','00000000-0000-4000-8000-000000000305','00000000-0000-4000-8000-000000000601','QA Staff Revoked','teacher',true,'active');
insert into public.staff_kindergarten_employments(staff_file_id,staff_id,profile_id,garden_id,status,role_title)
select case when profile_id='00000000-0000-4000-8000-000000000301' then '00000000-0000-4000-8000-000000000a01'::uuid
 when profile_id='00000000-0000-4000-8000-000000000302' then '00000000-0000-4000-8000-000000000a02'::uuid
 when profile_id='00000000-0000-4000-8000-000000000303' then '00000000-0000-4000-8000-000000000a03'::uuid else '00000000-0000-4000-8000-000000000a05'::uuid end,
 id,profile_id,garden_id,case when profile_id='00000000-0000-4000-8000-000000000305' then 'revoked' else 'active' end,role_title
from public.staff where full_name like 'QA Staff %';
insert into public.staff_classroom_assignments(garden_id,staff_id,classroom_id,status) values
('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000b01','00000000-0000-4000-8000-000000000701','active'),
('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000b03','00000000-0000-4000-8000-000000000702','active'),
('00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000b02','00000000-0000-4000-8000-000000000703','active'),
('00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000b04','00000000-0000-4000-8000-000000000703','active');
insert into public.observer_sites(id,name,site_type,owner_profile_id,monitoring_enabled,metadata) values
('00000000-0000-4000-8000-000000000e01','QA Observer A','home','00000000-0000-4000-8000-000000000f01',false,'{"environment":"DEVELOPMENT","synthetic":true}'),
('00000000-0000-4000-8000-000000000e02','QA Observer B','home','00000000-0000-4000-8000-000000000f02',false,'{"environment":"DEVELOPMENT","synthetic":true}');
insert into public.observer_site_memberships(observer_site_id,profile_id,member_role,active) values
('00000000-0000-4000-8000-000000000e01','00000000-0000-4000-8000-000000000f01','owner',true),
('00000000-0000-4000-8000-000000000e02','00000000-0000-4000-8000-000000000f02','owner',true);
update public.digital_observer_accounts set primary_site_id=case when profile_id='00000000-0000-4000-8000-000000000f01' then '00000000-0000-4000-8000-000000000e01'::uuid else '00000000-0000-4000-8000-000000000e02'::uuid end
where profile_id in ('00000000-0000-4000-8000-000000000f01','00000000-0000-4000-8000-000000000f02');
