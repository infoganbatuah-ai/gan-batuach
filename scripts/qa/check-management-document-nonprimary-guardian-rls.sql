-- Rollback-only, isolated Development QA fixtures. Never run against Production.
-- Requires the synthetic Parent Multi / Child B fixture and one Child B document.
begin;
do $$ begin
  if not exists (select 1 from public.documents where id='64e9452d-edb1-40aa-8201-ac640dab7471'
      and child_id='00000000-0000-4000-8000-000000000902' and garden_id='00000000-0000-4000-8000-000000000602')
    or not exists (select 1 from public.child_guardian_links where id='00000000-0000-4000-8000-000000000c42'
      and guardian_profile_id='00000000-0000-4000-8000-000000000103' and status='active' and legal_authority)
  then raise exception 'required_synthetic_fixture_missing'; end if;
end $$;
insert into storage.objects(bucket_id,name) values
 ('documents','management/00000000-0000-4000-8000-000000000602/00000000-0000-4000-8000-00000000d0f1/00000000-0000-4000-8000-00000000e0f1.pdf'),
 ('documents','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d0f2/00000000-0000-4000-8000-00000000e0f2.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
do $$ begin
  if not public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
    or not exists (select 1 from public.documents where id='64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'active_nonprimary_guardian_cannot_read_child_document'; end if;
  perform public.register_management_document('00000000-0000-4000-8000-00000000d0f1',
    '00000000-0000-4000-8000-000000000602','child',null,null,
    '00000000-0000-4000-8000-000000000902',null,'child_document','QA guardian upload',
    'management/00000000-0000-4000-8000-000000000602/00000000-0000-4000-8000-00000000d0f1/00000000-0000-4000-8000-00000000e0f1.pdf',
    'application/pdf',100,null,null);
  if not exists (select 1 from public.documents where id='00000000-0000-4000-8000-00000000d0f1')
  then raise exception 'nonprimary_guardian_registration_missing'; end if;
  begin
    perform public.register_management_document('00000000-0000-4000-8000-00000000d0f2',
      '00000000-0000-4000-8000-000000000601','child',null,null,
      '00000000-0000-4000-8000-000000000902',null,'child_document','QA foreign garden upload',
      'management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d0f2/00000000-0000-4000-8000-00000000e0f2.pdf',
      'application/pdf',100,null,null);
    raise exception 'foreign_garden_registration_allowed';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  if not public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'primary_parent_regressed'; end if;
end $$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
    or exists (select 1 from public.documents where id='64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'foreign_parent_can_read'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'staff_can_read_child_document'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000401',true);
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'inspector_can_read_child_document'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'foreign_manager_can_read_child_document'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$ begin
  if not public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'garden_manager_regressed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'admin_child_document_boundary_regressed'; end if;
end $$;

reset role;
update public.child_guardian_links set status='revoked'
  where id='00000000-0000-4000-8000-000000000c42';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'revoked_guardian_can_read'; end if;
end $$;

reset role;
update public.child_guardian_links set status='active', valid_until=now()-interval '1 minute'
  where id='00000000-0000-4000-8000-000000000c42';
set local role authenticated;
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'expired_guardian_can_read'; end if;
end $$;

reset role;
update public.child_guardian_links set valid_until=null, access_scope=jsonb_set(access_scope,'{profile}','false'::jsonb)
  where id='00000000-0000-4000-8000-000000000c42';
set local role authenticated;
do $$ begin
  if public.can_access_document('64e9452d-edb1-40aa-8201-ac640dab7471')
  then raise exception 'guardian_without_profile_scope_can_read'; end if;
end $$;
rollback;
