-- Executed only by the bounded runner inside one BEGIN/ROLLBACK on isolated QA.
-- All fixture UUIDs are reserved for this rollback-only test.
insert into public.permanent_child_files
  (id,primary_parent_profile_id,full_name,birth_date,identity_number)
values
  ('f0000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000101','[QA] Prior payment child','2023-01-01','QA-TRUTH-1001'),
  ('f0000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000101','[QA] New child','2023-02-01','QA-TRUTH-1002');
-- The canonical file trigger creates the primary legal guardian link.
insert into public.children
  (id,garden_id,permanent_child_file_id,full_name,birth_date,identity_number,status,last_amount_paid,last_payment_date,monthly_fee)
values
  ('f0000000-0000-4000-8000-000000001011','00000000-0000-4000-8000-000000000601',
   'f0000000-0000-4000-8000-000000001001','[QA] Prior payment child','2023-01-01','QA-TRUTH-1001',
   'pending_manager_approval',75,'2026-10-03',120);
insert into public.kindergarten_enrollment_requests
  (id,parent_id,child_profile_id,garden_id,requested_classroom_id,status,payment_status,published_price_snapshot)
values
  ('f0000000-0000-4000-8000-000000001021','00000000-0000-4000-8000-000000000101',
   'f0000000-0000-4000-8000-000000001001','00000000-0000-4000-8000-000000000601',
   '00000000-0000-4000-8000-000000000701','awaiting_payment','pending',120),
  ('f0000000-0000-4000-8000-000000001022','00000000-0000-4000-8000-000000000101',
   'f0000000-0000-4000-8000-000000001002','00000000-0000-4000-8000-000000000601',
   '00000000-0000-4000-8000-000000000701','awaiting_payment','pending',130);
insert into public.classroom_seat_reservations
  (id,garden_id,classroom_id,enrollment_request_id,status,idempotency_key,created_by)
values
  ('f0000000-0000-4000-8000-000000001031','00000000-0000-4000-8000-000000000601',
   '00000000-0000-4000-8000-000000000701','f0000000-0000-4000-8000-000000001021',
   'active','qa-payment-truth-1021','00000000-0000-4000-8000-000000000201'),
  ('f0000000-0000-4000-8000-000000001032','00000000-0000-4000-8000-000000000601',
   '00000000-0000-4000-8000-000000000701','f0000000-0000-4000-8000-000000001022',
   'active','qa-payment-truth-1022','00000000-0000-4000-8000-000000000201');
update public.kindergarten_enrollment_requests set reservation_id=case id
  when 'f0000000-0000-4000-8000-000000001021' then 'f0000000-0000-4000-8000-000000001031'::uuid
  else 'f0000000-0000-4000-8000-000000001032'::uuid end
where id in ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022');

-- Role/Garden denial must occur before any evidence is written.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $$ begin
  begin
    perform public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000001021',
      'bank_transfer',120,current_date,current_date+30,null,null);
    raise exception 'parent_accepted';
  exception when sqlstate '42501' then
    if sqlerrm<>'manual_payment_denied' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000202',true);
do $$ begin
  begin
    perform public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000001021',
      'bank_transfer',120,current_date,current_date+30,null,null);
    raise exception 'foreign_manager_accepted';
  exception when sqlstate '42501' then
    if sqlerrm<>'manual_payment_denied' then raise; end if;
  end;
end $$;
reset role;
do $$ begin
  if exists(select 1 from public.enrollment_payment_evidence
    where enrollment_request_id in ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022'))
  then raise exception 'denial_created_evidence'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
do $$ declare result jsonb; begin
  result:=public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000001021',
    'bank_transfer',120,current_date,current_date+30,'QA rollback only',null);
  if result->>'status'<>'activated' or result->>'idempotent'<>'false' or
     result->>'child_id'<>'f0000000-0000-4000-8000-000000001011' then
    raise exception 'existing_child_activation_failed';
  end if;
  result:=public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000001022',
    'standing_order',130,current_date,current_date+30,'QA rollback only',null);
  if result->>'status'<>'activated' or result->>'idempotent'<>'false' then
    raise exception 'new_child_activation_failed';
  end if;
  result:=public.record_manual_enrollment_arrangement('f0000000-0000-4000-8000-000000001021',
    'bank_transfer',120,current_date,current_date+30,'QA rollback only',null);
  if result->>'status'<>'activated' or result->>'idempotent'<>'true' then
    raise exception 'idempotent_retry_failed';
  end if;
end $$;
reset role;

do $$ declare child_new uuid; begin
  select activated_child_id into child_new from public.kindergarten_enrollment_requests
    where id='f0000000-0000-4000-8000-000000001022';
  if child_new is null or child_new='f0000000-0000-4000-8000-000000001011' then
    raise exception 'new_child_missing';
  end if;
  if not exists(select 1 from public.children where id='f0000000-0000-4000-8000-000000001011'
    and last_amount_paid=75 and last_payment_date='2026-10-03'
    and payment_status='special_arrangement' and status='active')
    or not exists(select 1 from public.children where id=child_new
      and last_amount_paid is null and last_payment_date is null
      and payment_status='special_arrangement' and status='active')
  then raise exception 'manual_arrangement_masquerades_as_payment'; end if;
  if (select count(*) from public.kindergarten_enrollment_requests
      where id in ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022')
        and status='activated' and payment_status='arranged')<>2
    or (select count(*) from public.classroom_seat_reservations
      where id in ('f0000000-0000-4000-8000-000000001031','f0000000-0000-4000-8000-000000001032')
        and status='consumed' and consumed_at is not null and enrollment_id is not null)<>2
    or (select count(*) from public.child_kindergarten_enrollments
      where enrollment_request_id in ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022')
        and status='active')<>2
  then raise exception 'activation_transition_failed'; end if;
  if exists(select 1 from public.tuition_billing_periods where child_id in
      ('f0000000-0000-4000-8000-000000001011',child_new))
    or exists(select 1 from public.child_payment_history where child_id in
      ('f0000000-0000-4000-8000-000000001011',child_new))
    or exists(select 1 from public.tuition_ledger_entries where period_id in
      (select id from public.tuition_billing_periods where child_id in
        ('f0000000-0000-4000-8000-000000001011',child_new)))
  then raise exception 'arrangement_created_settlement'; end if;
  if (select count(*) from public.enrollment_payment_evidence where enrollment_request_id in
      ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022')
        and evidence_kind='manual_arrangement' and status='confirmed')<>2
    or (select count(*) from public.audit_logs where action='manual_payment_arrangement_recorded'
      and after_data->>'request_id' in
      ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022'))<>2
    or (select count(*) from public.audit_logs where action='enrollment_activation_succeeded'
      and after_data->>'request_id' in
      ('f0000000-0000-4000-8000-000000001021','f0000000-0000-4000-8000-000000001022'))<>2
  then raise exception 'evidence_or_audit_count_failed'; end if;
  if has_function_privilege('anon','public.activate_enrollment_from_evidence(uuid,uuid)','execute')
    or has_function_privilege('authenticated','public.activate_enrollment_from_evidence(uuid,uuid)','execute')
    or not has_function_privilege('service_role','public.activate_enrollment_from_evidence(uuid,uuid)','execute')
  then raise exception 'activation_acl_changed'; end if;
end $$;
select 'MANUAL_ARRANGEMENT_PAYMENT_TRUTH_ROLLBACK_ONLY';
