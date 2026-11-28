-- All IDs are disposable within the runner's single rollback-only transaction.
insert into public.permanent_child_files(id,primary_parent_profile_id,full_name,birth_date)
values
 ('f0000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000101','[QA] Guard rejected','2023-01-01'),
 ('f0000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000101','[QA] Guard cancelled','2023-01-01'),
 ('f0000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000101','[QA] Guard reconciliation','2023-01-01'),
 ('f0000000-0000-4000-8000-000000000905','00000000-0000-4000-8000-000000000101','[QA] Guard other garden','2023-01-01'),
 ('f0000000-0000-4000-8000-000000000906','00000000-0000-4000-8000-000000000101','[QA] Guard retry','2023-01-01');
insert into public.kindergarten_enrollment_requests(id,parent_id,child_profile_id,garden_id,status,payment_status)
values
 ('f0000000-0000-4000-8000-000000000912','00000000-0000-4000-8000-000000000101','f0000000-0000-4000-8000-000000000902','00000000-0000-4000-8000-000000000601','rejected','not_requested'),
 ('f0000000-0000-4000-8000-000000000913','00000000-0000-4000-8000-000000000101','f0000000-0000-4000-8000-000000000903','00000000-0000-4000-8000-000000000601','cancelled','not_requested'),
 ('f0000000-0000-4000-8000-000000000914','00000000-0000-4000-8000-000000000101','f0000000-0000-4000-8000-000000000904','00000000-0000-4000-8000-000000000601','payment_reconciliation_required','reconciliation_required'),
 ('f0000000-0000-4000-8000-000000000915','00000000-0000-4000-8000-000000000101','f0000000-0000-4000-8000-000000000905','00000000-0000-4000-8000-000000000601','awaiting_payment','pending'),
 ('f0000000-0000-4000-8000-000000000916','00000000-0000-4000-8000-000000000101','f0000000-0000-4000-8000-000000000906','00000000-0000-4000-8000-000000000601','activated','arranged');
insert into public.enrollment_payment_evidence
  (id,garden_id,enrollment_request_id,evidence_kind,provider_mode,idempotency_key,status,manual_method,amount,covered_from,covered_until,recorded_by)
values
  ('f0000000-0000-4000-8000-000000000921','00000000-0000-4000-8000-000000000601',
   'f0000000-0000-4000-8000-000000000916','manual_arrangement','manual',
   'manual-enrollment:f0000000-0000-4000-8000-000000000916','confirmed','bank_transfer',
   100,current_date,current_date+30,'00000000-0000-4000-8000-000000000201');
insert into public.child_kindergarten_enrollments
  (id,permanent_child_file_id,garden_id,status,enrollment_request_id,activation_payment_evidence_id)
values
  ('f0000000-0000-4000-8000-000000000931','f0000000-0000-4000-8000-000000000906',
   '00000000-0000-4000-8000-000000000601','pending_parent_completion',
   'f0000000-0000-4000-8000-000000000916','f0000000-0000-4000-8000-000000000921');
update public.kindergarten_enrollment_requests
set activation_payment_evidence_id='f0000000-0000-4000-8000-000000000921',
    activated_enrollment_id='f0000000-0000-4000-8000-000000000931'
where id='f0000000-0000-4000-8000-000000000916';
create temp table qa_guard_request_snapshot on commit drop as
select id,ctid as tuple_id,status,payment_status,updated_at from public.kindergarten_enrollment_requests
where id in ('f0000000-0000-4000-8000-000000000912','f0000000-0000-4000-8000-000000000913',
             'f0000000-0000-4000-8000-000000000914','f0000000-0000-4000-8000-000000000915',
             'f0000000-0000-4000-8000-000000000916');
create temp table qa_guard_evidence_snapshot on commit drop as
select id,ctid as tuple_id,status,updated_at from public.enrollment_payment_evidence
where id='f0000000-0000-4000-8000-000000000921';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$
declare request_id uuid;
begin
  foreach request_id in array array[
    'f0000000-0000-4000-8000-000000000912'::uuid,
    'f0000000-0000-4000-8000-000000000913'::uuid,
    'f0000000-0000-4000-8000-000000000914'::uuid
  ] loop
    begin
      perform public.record_manual_enrollment_arrangement(request_id,'bank_transfer',100,current_date,current_date+30,'QA rollback only',null);
      raise exception 'invalid_status_accepted';
    exception when sqlstate '23514' then
      if sqlerrm<>'enrollment_not_awaiting_payment' then raise; end if;
    end;
  end loop;
end $$;

-- Another Garden's Manager and a Parent must fail before an evidence write.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$ begin
  begin
    perform public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000000915','bank_transfer',100,current_date,current_date+30,null,null);
    raise exception 'foreign_manager_accepted';
  exception when sqlstate '42501' then
    if sqlerrm<>'manual_payment_denied' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
  begin
    perform public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000000915','bank_transfer',100,current_date,current_date+30,null,null);
    raise exception 'parent_accepted';
  exception when sqlstate '42501' then
    if sqlerrm<>'manual_payment_denied' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$
declare result jsonb;
begin
  result:=public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000000916','bank_transfer',100,current_date,current_date+30,null,null);
  if result->>'status'<>'activated' or result->>'idempotent'<>'true'
    or result->>'enrollment_id'<>'f0000000-0000-4000-8000-000000000931'
  then raise exception 'activated_retry_contract_failed'; end if;
end $$;
reset role;
do $$ begin
  if exists(
    select 1 from qa_guard_request_snapshot prior
    join public.kindergarten_enrollment_requests current_row using(id)
    where prior.tuple_id<>current_row.ctid or prior.status<>current_row.status
      or prior.payment_status<>current_row.payment_status or prior.updated_at<>current_row.updated_at
  ) or exists(
    select 1 from qa_guard_evidence_snapshot prior
    join public.enrollment_payment_evidence current_row using(id)
    where prior.tuple_id<>current_row.ctid or prior.status<>current_row.status
      or prior.updated_at<>current_row.updated_at
  ) then raise exception 'guard_changed_existing_rows'; end if;
  if exists(select 1 from public.enrollment_payment_evidence where enrollment_request_id in (
    'f0000000-0000-4000-8000-000000000912','f0000000-0000-4000-8000-000000000913',
    'f0000000-0000-4000-8000-000000000914','f0000000-0000-4000-8000-000000000915'))
    or exists(select 1 from public.audit_logs where entity_id in (
    'f0000000-0000-4000-8000-000000000912','f0000000-0000-4000-8000-000000000913',
    'f0000000-0000-4000-8000-000000000914','f0000000-0000-4000-8000-000000000915',
    'f0000000-0000-4000-8000-000000000921'))
    or exists(select 1 from public.kindergarten_enrollment_requests where id='f0000000-0000-4000-8000-000000000912' and status<>'rejected')
    or exists(select 1 from public.kindergarten_enrollment_requests where id='f0000000-0000-4000-8000-000000000913' and status<>'cancelled')
    or exists(select 1 from public.kindergarten_enrollment_requests where id='f0000000-0000-4000-8000-000000000914' and status<>'payment_reconciliation_required')
    or exists(select 1 from public.kindergarten_enrollment_requests where id='f0000000-0000-4000-8000-000000000915' and status<>'awaiting_payment')
    or (select count(*) from public.enrollment_payment_evidence where enrollment_request_id='f0000000-0000-4000-8000-000000000916')<>1
    or exists(select 1 from public.audit_logs where entity_id='f0000000-0000-4000-8000-000000000921')
  then raise exception 'guard_postconditions_failed'; end if;
  if (select pg_get_userbyid(proowner) from pg_proc
      where oid='public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text)'::regprocedure)<>'postgres'
    or not (select prosecdef from pg_proc
      where oid='public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text)'::regprocedure)
    or not (select proconfig @> array['search_path=public'] from pg_proc
      where oid='public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text)'::regprocedure)
    or has_function_privilege('anon','public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text)','execute')
    or not has_function_privilege('authenticated','public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text)','execute')
  then raise exception 'function_security_contract_changed'; end if;
end $$;
select 'POST_FIX_GUARD_ROLLBACK_ONLY';
