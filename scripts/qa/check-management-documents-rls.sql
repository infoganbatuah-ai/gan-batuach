-- Synthetic, rollback-only GB-M32 matrix. Run after the GB-M32 migration in
-- the disposable integration database; never against Production.
begin;
insert into public.documents(id,garden_id,child_id,name,document_type,file_url,uploaded_by,owner_type)
values ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000901','QA Child A','child_document','/api/documents/00000000-0000-4000-8000-00000000d001/file','00000000-0000-4000-8000-000000000101','child');
insert into public.documents(id,garden_id,child_id,name,document_type,file_url,uploaded_by,owner_type)
values ('00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000902','QA Child B','child_document','/api/documents/00000000-0000-4000-8000-00000000d002/file','00000000-0000-4000-8000-000000000102','child');
insert into public.documents(id,garden_id,staff_id,name,document_type,file_url,uploaded_by,owner_type)
values ('00000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-000000000602','00000000-0000-4000-8000-000000000b04','QA Staff B','staff_document','/api/documents/00000000-0000-4000-8000-00000000d003/file','00000000-0000-4000-8000-000000000303','staff');
insert into public.documents(id,garden_id,staff_id,name,document_type,file_url,uploaded_by,owner_type,status,expires_at)
values ('00000000-0000-4000-8000-00000000d010','00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000b05','QA Former Staff','staff_document','/api/documents/00000000-0000-4000-8000-00000000d010/file','00000000-0000-4000-8000-000000000305','staff','valid','2026-09-25');
insert into public.documents(id,garden_id,name,document_type,file_url,uploaded_by,owner_type)
values ('00000000-0000-4000-8000-00000000d004','00000000-0000-4000-8000-000000000601','QA Garden A','garden_document','/api/documents/00000000-0000-4000-8000-00000000d004/file','00000000-0000-4000-8000-000000000201','garden');
insert into public.documents(id,garden_id,name,document_type,file_url,uploaded_by,owner_type)
values ('00000000-0000-4000-8000-00000000d008','00000000-0000-4000-8000-000000000601','QA Safety A','safety_certificate','/api/documents/00000000-0000-4000-8000-00000000d008/file','00000000-0000-4000-8000-000000000201','garden'),
 ('00000000-0000-4000-8000-00000000d009','00000000-0000-4000-8000-000000000602','QA Safety B','safety_certificate','/api/documents/00000000-0000-4000-8000-00000000d009/file','00000000-0000-4000-8000-000000000202','garden');
insert into storage.objects(bucket_id,name) values
 ('documents','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d005/00000000-0000-4000-8000-00000000e001.pdf'),
 ('documents','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d006/00000000-0000-4000-8000-00000000e002.pdf'),
 ('documents','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d007/00000000-0000-4000-8000-00000000e003.pdf'),
 ('documents','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d011/00000000-0000-4000-8000-00000000e011.pdf');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ declare changed integer; begin
  if (select count(*) from public.documents where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d004')) <> 1
  then raise exception 'parent_child_scope_failed'; end if;
  begin
    update public.documents set status='valid' where id='00000000-0000-4000-8000-00000000d001';
    get diagnostics changed = row_count;
    if changed > 0 then raise exception 'direct_self_verification_allowed'; end if;
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
do $$ begin
  if (select count(*) from public.documents where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002'))<>1
    or exists (select 1 from public.documents where id='00000000-0000-4000-8000-00000000d001')
  then raise exception 'parent_b_cross_child_access'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ begin
  if (select count(*) from public.documents where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d004')) <> 2
  then raise exception 'manager_garden_scope_failed'; end if;
  if exists (select 1 from storage.objects where bucket_id='documents' and name like '%d005%')
  then raise exception 'authenticated_raw_storage_read_allowed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$ begin
  if (select count(*) from public.documents where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d004'))<>2
  then raise exception 'manager_b_cross_garden_access'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select public.register_management_document('00000000-0000-4000-8000-00000000d005','00000000-0000-4000-8000-000000000601','garden',null,null,null,null,
  'garden_document','QA old certificate','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d005/00000000-0000-4000-8000-00000000e001.pdf',
  'application/pdf',100,null,null);
select public.register_management_document('00000000-0000-4000-8000-00000000d006','00000000-0000-4000-8000-000000000601','garden',null,null,null,null,
  'garden_document','QA new certificate','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d006/00000000-0000-4000-8000-00000000e002.pdf',
  'application/pdf',100,null,'00000000-0000-4000-8000-00000000d005');
do $$ begin
  if not exists (select 1 from public.documents where id='00000000-0000-4000-8000-00000000d005'
    and replaced_by='00000000-0000-4000-8000-00000000d006') then raise exception 'replacement_history_missing'; end if;
  begin
    perform public.register_management_document('00000000-0000-4000-8000-00000000d011','00000000-0000-4000-8000-000000000601','teacher','00000000-0000-4000-8000-000000000201',null,null,null,
      'teacher_certificate','QA unsupported Teacher certificate','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d011/00000000-0000-4000-8000-00000000e011.pdf',
      'application/pdf',100,null,null);
    raise exception 'non_teacher_certificate_allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.register_management_document('00000000-0000-4000-8000-00000000d007','00000000-0000-4000-8000-000000000601','garden',null,null,null,null,
      'garden_document','QA conflicting replacement','management/00000000-0000-4000-8000-000000000601/00000000-0000-4000-8000-00000000d007/00000000-0000-4000-8000-00000000e003.pdf',
      'application/pdf',100,null,'00000000-0000-4000-8000-00000000d005');
    raise exception 'conflicting_replacement_allowed';
  exception when unique_violation then null; end;
end $$;
select public.review_management_document('00000000-0000-4000-8000-00000000d001','valid',null);
select public.review_management_document('00000000-0000-4000-8000-00000000d001','valid',null);
do $$ begin
  if not exists (select 1 from public.documents where id='00000000-0000-4000-8000-00000000d001' and status='valid')
  then raise exception 'review_transition_failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000303',true);
do $$ begin
  if (select count(*) from public.documents where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d004')) <> 1
  then raise exception 'multi_garden_staff_document_scope_failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000401',true);
do $$ begin
  if exists (select 1 from public.documents where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d003','00000000-0000-4000-8000-00000000d004'))
  then raise exception 'inspector_blanket_document_access'; end if;
  if (select count(*) from public.documents where id in ('00000000-0000-4000-8000-00000000d008','00000000-0000-4000-8000-00000000d009'))<>1
    or not exists (select 1 from public.documents where id='00000000-0000-4000-8000-00000000d008')
  then raise exception 'inspector_assignment_document_boundary'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000501',true);
do $$ begin
  if exists (select 1 from public.documents where id in ('00000000-0000-4000-8000-00000000d001','00000000-0000-4000-8000-00000000d002','00000000-0000-4000-8000-00000000d003'))
  then raise exception 'admin_sensitive_document_blanket_access'; end if;
  begin
    perform public.review_management_document('00000000-0000-4000-8000-00000000d001','rejected','QA');
    raise exception 'admin_blind_child_review_allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from storage.buckets where id='documents' and public=true)
  then raise exception 'documents_bucket_public'; end if;
  if has_table_privilege('anon','public.documents','select')
    or has_table_privilege('authenticated','public.documents','insert')
    or has_table_privilege('authenticated','public.documents','update')
    or has_function_privilege('anon','public.register_management_document(uuid,uuid,text,uuid,uuid,uuid,uuid,text,text,text,text,bigint,date,uuid)','execute')
  then raise exception 'document_grants_too_broad'; end if;
  if (select count(*) from pg_constraint where conrelid='public.documents'::regclass and conname in
    ('documents_garden_id_fkey','documents_child_id_fkey','documents_staff_id_fkey','documents_parent_id_fkey','documents_inspector_id_fkey')
    and pg_get_constraintdef(oid) like '%ON DELETE RESTRICT')<>5
  then raise exception 'document_retention_fk_missing'; end if;
  if (select count(*) from public.audit_logs where entity_id='00000000-0000-4000-8000-00000000d001' and action='document_reviewed')<>1
  then raise exception 'review_audit_not_idempotent'; end if;
end $$;
update public.documents set status='valid',expires_at='2026-09-25' where id='00000000-0000-4000-8000-00000000d004';
do $$ declare first_count integer; second_count integer; begin
  first_count := public.queue_management_document_expiry_notifications('2026-09-20',100);
  second_count := public.queue_management_document_expiry_notifications('2026-09-20',100);
  if first_count<>1 or second_count<>0 then raise exception 'expiry_notification_not_idempotent'; end if;
  if (select count(*) from public.notifications where dedupe_key='document:expiry:00000000-0000-4000-8000-00000000d004:expiring')<>1
  then raise exception 'expiry_notification_missing'; end if;
  if exists (select 1 from public.notifications where entity_id='00000000-0000-4000-8000-00000000d010')
  then raise exception 'revoked_staff_notified'; end if;
end $$;
select 'GB-M32 synthetic document RLS PASS';
rollback;
