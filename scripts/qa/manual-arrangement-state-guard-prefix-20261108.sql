-- Run only through the bounded runner against the verified isolated Development
-- database. The runner wraps this in BEGIN/ROLLBACK and checks no fixture survives.
insert into public.permanent_child_files(id,primary_parent_profile_id,full_name,birth_date)
values ('f0000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000101','[QA] Guard rejected','2023-01-01');
insert into public.kindergarten_enrollment_requests(id,parent_id,child_profile_id,garden_id,status,payment_status)
values ('f0000000-0000-4000-8000-000000000911','00000000-0000-4000-8000-000000000101',
        'f0000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000601','rejected','not_requested');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$
declare result jsonb;
begin
  result:=public.record_manual_enrollment_arrangement(
    'f0000000-0000-4000-8000-000000000911','bank_transfer',100,current_date,current_date+30,'QA rollback only',null);
  if result->>'status'<>'payment_reconciliation_required' then raise exception 'pre_fix_defect_not_reproduced'; end if;
end $$;
reset role;
do $$
begin
  if (select status from public.kindergarten_enrollment_requests where id='f0000000-0000-4000-8000-000000000911')<>'payment_reconciliation_required'
    or (select count(*) from public.enrollment_payment_evidence where enrollment_request_id='f0000000-0000-4000-8000-000000000911')<>1
    or (select count(*) from public.audit_logs where entity_id in
       ('f0000000-0000-4000-8000-000000000911', (select id from public.enrollment_payment_evidence where enrollment_request_id='f0000000-0000-4000-8000-000000000911'))
       and action in ('manual_payment_arrangement_recorded','enrollment_activation_reconciliation_required'))<>2
  then raise exception 'pre_fix_defect_counts_unexpected'; end if;
end $$;
select 'PRE_FIX_DEFECT_REPRODUCED_ROLLBACK_ONLY';
