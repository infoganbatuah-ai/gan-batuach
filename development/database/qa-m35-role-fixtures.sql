-- GB-M35 synthetic role extension; guarded Development only; idempotent.
do $$ begin
  if (select count(*) from development_metadata.baselines) <> 1 then raise exception 'Development baseline required'; end if;
  if (select count(*) from auth.users where id in
    ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000203',
     '00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000205',
     '00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000402',
     '00000000-0000-4000-8000-000000000403')
    and email like '%@integration.qa.invalid') <> 7 then raise exception 'Seven GB-M35 synthetic Auth users required'; end if;
end $$;

update public.profiles set role=case
  when id in ('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000205') then 'owner'::public.app_role
  when id='00000000-0000-4000-8000-000000000306' then 'staff'::public.app_role
  when id in ('00000000-0000-4000-8000-000000000402','00000000-0000-4000-8000-000000000403') then 'inspector'::public.app_role
  else 'parent'::public.app_role end,
  garden_id=case
    when id in ('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-000000000306') then '00000000-0000-4000-8000-000000000601'::uuid
    else garden_id end,
  must_change_password=false
where id in ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000203',
             '00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000205',
             '00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000402',
             '00000000-0000-4000-8000-000000000403');

insert into public.garden_management_memberships(id,profile_id,garden_id,relationship_role,status,is_default,source,activated_at,metadata) values
('00000000-0000-4000-8000-000000000c31','00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000601','owner','active',true,'admin','2000-01-01T00:00:00Z','{"synthetic":true,"task":"GB-M35"}'),
('00000000-0000-4000-8000-000000000c32','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000601','owner','active',true,'admin','2000-01-01T00:00:00Z','{"synthetic":true,"task":"GB-M35"}'),
('00000000-0000-4000-8000-000000000c33','00000000-0000-4000-8000-000000000204','00000000-0000-4000-8000-000000000602','owner','active',false,'admin','2000-01-01T00:00:00Z','{"synthetic":true,"task":"GB-M35"}'),
('00000000-0000-4000-8000-000000000c34','00000000-0000-4000-8000-000000000205','00000000-0000-4000-8000-000000000601','owner','active',true,'admin','2000-01-01T00:00:00Z','{"synthetic":true,"task":"GB-M35"}')
on conflict (id) do nothing;

-- The owner-teacher trigger requires the Garden's explicit ownership semantics.
update public.gardens set owner_profile_id='00000000-0000-4000-8000-000000000205',
  ownership_type='teacher_is_owner'
where id='00000000-0000-4000-8000-000000000601';

insert into public.garden_teaching_assignments(id,garden_id,profile_id,assignment_kind,title,access_scope,status) values
('00000000-0000-4000-8000-000000000c35','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000205','owner_teacher','QA Owner Teacher','{"children":true,"attendance":true,"journal":true,"communication":true}','active')
on conflict (id) do nothing;
update public.garden_teaching_assignments set access_scope='{"children":true,"attendance":true,"journal":true,"communication":true}'
where id='00000000-0000-4000-8000-000000000c35';

insert into public.staff_permanent_files(id,profile_id,full_name) values
('00000000-0000-4000-8000-000000000a06','00000000-0000-4000-8000-000000000306','QA Delegated Teacher')
on conflict (id) do nothing;
insert into public.staff(id,profile_id,garden_id,full_name,role_title,approved_to_work,onboarding_status) values
('00000000-0000-4000-8000-000000000b06','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000601','QA Delegated Teacher','teacher',true,'active')
on conflict (id) do nothing;
insert into public.staff_kindergarten_employments(id,staff_file_id,staff_id,profile_id,garden_id,status,role_title) values
('00000000-0000-4000-8000-000000000c36','00000000-0000-4000-8000-000000000a06','00000000-0000-4000-8000-000000000b06','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000601','active','teacher')
on conflict (id) do nothing;
insert into public.staff_classroom_assignments(id,garden_id,staff_id,classroom_id,status) values
('00000000-0000-4000-8000-000000000c37','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000b06','00000000-0000-4000-8000-000000000701','active')
on conflict (id) do nothing;
insert into public.garden_teaching_assignments(id,garden_id,profile_id,staff_id,assignment_kind,title,access_scope,status) values
('00000000-0000-4000-8000-000000000c38','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000306','00000000-0000-4000-8000-000000000b06','delegated_teacher','QA Delegated Teacher','{"children":true,"attendance":true,"journal":true,"communication":true}','active'),
('00000000-0000-4000-8000-000000000c43','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000b01','delegated_teacher','QA Staff A Teaching','{"children":true,"attendance":true,"journal":true,"communication":true}','active')
on conflict (id) do nothing;
update public.garden_teaching_assignments set access_scope='{"children":true,"attendance":true,"journal":true,"communication":true}'
where id in ('00000000-0000-4000-8000-000000000c38','00000000-0000-4000-8000-000000000c43');

insert into public.inspectors(id,service_cities) values
('00000000-0000-4000-8000-000000000402',array['QA City']),
('00000000-0000-4000-8000-000000000403',array['QA City'])
on conflict (id) do nothing;
insert into public.inspector_applications(id,profile_id,full_name,email,city,status,admin_decision,activated_at,metadata) values
('00000000-0000-4000-8000-000000000d42','00000000-0000-4000-8000-000000000402','QA Inspector Unassigned','inspector-unassigned@integration.qa.invalid','QA City','approved','isolated_qa_fixture','2000-01-01T00:00:00Z','{"synthetic":true,"task":"GB-M35"}'),
('00000000-0000-4000-8000-000000000d43','00000000-0000-4000-8000-000000000403','QA Inspector Suspended','inspector-suspended@integration.qa.invalid','QA City','suspended','isolated_qa_fixture',null,'{"synthetic":true,"task":"GB-M35"}')
on conflict (id) do nothing;

insert into public.gardens(id,name,city,status,bootstrap_inspector_id,onboarding_status) values
('00000000-0000-4000-8000-000000000603','QA Preliminary Garden C','QA City','pending','00000000-0000-4000-8000-000000000401','draft')
on conflict (id) do nothing;

insert into public.permanent_child_files(id,full_name,primary_parent_profile_id) values
('00000000-0000-4000-8000-000000000803','QA Child C','00000000-0000-4000-8000-000000000103')
on conflict (id) do nothing;
insert into public.children(id,garden_id,full_name,permanent_child_file_id,status,identity_number) values
('00000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000601','QA Child C','00000000-0000-4000-8000-000000000803','active','QA-C')
on conflict (id) do nothing;
insert into public.child_kindergarten_enrollments(id,child_id,permanent_child_file_id,garden_id,status) values
('00000000-0000-4000-8000-000000000c39','00000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000803','00000000-0000-4000-8000-000000000601','active')
on conflict (id) do nothing;
insert into public.child_classroom_assignments(id,garden_id,child_id,classroom_id) values
('00000000-0000-4000-8000-000000000c40','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000702')
on conflict (id) do nothing;
insert into public.child_guardian_links(id,permanent_child_file_id,guardian_profile_id,relationship_type,is_primary,legal_authority,status,source) values
('00000000-0000-4000-8000-000000000c42','00000000-0000-4000-8000-000000000802','00000000-0000-4000-8000-000000000103','parent',false,true,'active','isolated_qa_fixture')
on conflict (id) do nothing;
