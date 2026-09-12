-- GB-M15: one transactional enrollment-request lifecycle. Final Child activation remains GB-M16.

alter table public.kindergarten_enrollment_requests
  add column if not exists requested_classroom_id uuid references public.classrooms(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists information_request text,
  add column if not exists information_response text,
  add column if not exists information_requested_at timestamptz,
  add column if not exists information_responded_at timestamptz,
  add column if not exists reservation_id uuid references public.classroom_seat_reservations(id) on delete set null,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null;

alter table public.kindergarten_enrollment_requests drop constraint if exists kindergarten_enrollment_requests_status_check;

update public.kindergarten_enrollment_requests set status='information_required'
where status='more_information_requested';
update public.kindergarten_enrollment_requests set status='awaiting_payment'
where status='approved_pending_payment';

alter table public.kindergarten_enrollment_requests add constraint kindergarten_enrollment_requests_status_check
  check (status in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_payment','waitlisted','rejected','cancelled','expired'));

alter table public.kindergarten_enrollment_requests
  drop constraint if exists kindergarten_enrollment_requests_parent_id_child_profile_id_garden_id_key;
create unique index if not exists enrollment_request_one_active_per_child_garden
  on public.kindergarten_enrollment_requests(child_profile_id,garden_id)
  where status in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_payment','waitlisted');
create index if not exists enrollment_request_garden_inbox_idx
  on public.kindergarten_enrollment_requests(garden_id,status,requested_at desc);

create or replace function public.submit_enrollment_request(
  target_child_file_id uuid,target_garden_id uuid,target_classroom_id uuid default null,
  target_age_group text default null,target_parent_message text default null
)
returns public.kindergarten_enrollment_requests language plpgsql security definer set search_path=public as $$
declare garden public.gardens; child_file public.permanent_child_files; room public.classrooms;
  existing public.kindergarten_enrollment_requests; result public.kindergarten_enrollment_requests; child_months integer;
begin
  if not public.can_guardian_access_child(target_child_file_id,'profile') then raise exception 'enrollment_child_denied' using errcode='42501'; end if;
  select * into child_file from public.permanent_child_files where id=target_child_file_id;
  if child_file.birth_date is null then raise exception 'enrollment_birth_date_required' using errcode='22023'; end if;
  if exists(select 1 from public.child_kindergarten_enrollments where permanent_child_file_id=target_child_file_id and status='active') then
    raise exception 'active_enrollment_conflict' using errcode='23505';
  end if;
  select * into garden from public.gardens where id=target_garden_id;
  if garden.id is null or garden.status<>'active' or not coalesce(garden.public_profile_enabled,false)
    or coalesce(garden.enrollment_availability,'accepting') not in ('accepting','waitlist_only') then
    raise exception 'garden_not_accepting_enrollment' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_child_file_id::text||':'||target_garden_id::text,0));
  select * into existing from public.kindergarten_enrollment_requests
    where child_profile_id=target_child_file_id and garden_id=target_garden_id
      and status in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_payment','waitlisted')
    order by created_at desc limit 1;
  if existing.id is not null then return existing; end if;
  child_months:=extract(year from age(current_date,child_file.birth_date))::integer*12+extract(month from age(current_date,child_file.birth_date))::integer;
  if target_classroom_id is not null then
    select * into room from public.classrooms where id=target_classroom_id and garden_id=target_garden_id and status='active';
    if room.id is null or room.min_age_months is null or room.max_age_months is null or child_months not between room.min_age_months and room.max_age_months then
      raise exception 'invalid_enrollment_classroom' using errcode='23514';
    end if;
  elsif not exists(select 1 from public.classrooms c where c.garden_id=target_garden_id and c.status='active'
    and c.min_age_months is not null and c.max_age_months is not null and child_months between c.min_age_months and c.max_age_months) then
    raise exception 'no_matching_classroom' using errcode='23514';
  end if;
  insert into public.kindergarten_enrollment_requests(parent_id,child_profile_id,garden_id,requested_classroom_id,requested_age_group,parent_message,status,requested_at,payment_required,payment_status,metadata)
  values(auth.uid(),target_child_file_id,target_garden_id,target_classroom_id,target_age_group,nullif(btrim(target_parent_message),''),'submitted',now(),true,'not_requested',jsonb_build_object('source','canonical_parent_discovery')) returning * into result;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),'parent',target_garden_id,'kindergarten_enrollment_requests',result.id,'enrollment_request_submitted',jsonb_build_object('status','submitted'));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,created_by)
  values(target_garden_id,garden.manager_id,garden.manager_id,'manager','בקשת הצטרפות חדשה','התקבלה בקשת הצטרפות חדשה לבדיקה.','התקבלה בקשת הצטרפות חדשה לבדיקה.','kindergarten_enrollment_requests',result.id,'medium','/dashboard/garden/enrollment-requests',target_garden_id,auth.uid());
  return result;
end $$;

create or replace function public.decide_enrollment_request(
  target_request_id uuid,target_action text,target_classroom_id uuid default null,target_reason text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare req public.kindergarten_enrollment_requests; room public.classrooms; reservation public.classroom_seat_reservations;
  next_status text; staffing jsonb; child_birth date; child_months integer;
begin
  select * into req from public.kindergarten_enrollment_requests where id=target_request_id for update;
  if req.id is null then raise exception 'enrollment_request_not_found' using errcode='P0002'; end if;
  if not public.can_manage_garden(req.garden_id) then raise exception 'enrollment_decision_denied' using errcode='42501'; end if;
  if target_action='review' and req.status in ('submitted','resubmitted') then next_status:='under_review';
  elsif target_action='request_information' and req.status in ('submitted','resubmitted','under_review') then next_status:='information_required';
  elsif target_action='reject' and req.status in ('submitted','resubmitted','under_review','information_required') then next_status:='rejected';
  elsif target_action='waitlist' and req.status in ('submitted','resubmitted','under_review') then next_status:='waitlisted';
  elsif target_action='approve' and req.status in ('submitted','resubmitted','under_review') then next_status:='awaiting_payment';
  elsif target_action='cancel' and req.status in ('submitted','resubmitted','under_review','information_required','approved','awaiting_payment','waitlisted') then next_status:='cancelled';
  elsif target_action='approve' and req.status='awaiting_payment' and req.reservation_id is not null then
    return jsonb_build_object('request',to_jsonb(req),'staffing_readiness',public.evaluate_classroom_staffing(req.requested_classroom_id,current_date,1),'idempotent',true);
  else raise exception 'invalid_enrollment_transition' using errcode='23514'; end if;

  if target_action='approve' then
    select birth_date into child_birth from public.permanent_child_files where id=req.child_profile_id;
    child_months:=extract(year from age(current_date,child_birth))::integer*12+extract(month from age(current_date,child_birth))::integer;
    select * into room from public.classrooms where id=coalesce(target_classroom_id,req.requested_classroom_id) and garden_id=req.garden_id and status='active' for update;
    if room.id is null or room.min_age_months is null or room.max_age_months is null or child_months not between room.min_age_months and room.max_age_months then raise exception 'invalid_enrollment_classroom' using errcode='23514'; end if;
    reservation:=public.reserve_classroom_seat(room.id,'enrollment-request:'||req.id::text,null,null,req.id,null);
    staffing:=public.evaluate_classroom_staffing(room.id,current_date,1);
  end if;
  if next_status='cancelled' and req.reservation_id is not null then perform public.release_classroom_seat_reservation(req.reservation_id); end if;
  update public.kindergarten_enrollment_requests set status=next_status,reviewed_at=now(),reviewed_by=auth.uid(),
    manager_decision=target_action,decision_reason=case when target_action in ('reject','waitlist') then nullif(btrim(target_reason),'') else decision_reason end,
    information_request=case when target_action='request_information' then nullif(btrim(target_reason),'') else information_request end,
    information_requested_at=case when target_action='request_information' then now() else information_requested_at end,
    requested_classroom_id=coalesce(room.id,requested_classroom_id),reservation_id=coalesce(reservation.id,reservation_id),
    payment_status=case when next_status='awaiting_payment' then 'pending' else payment_status end,
    decided_at=case when next_status in ('awaiting_payment','waitlisted','rejected','cancelled') then now() else decided_at end,
    cancelled_at=case when next_status='cancelled' then now() else cancelled_at end,cancelled_by=case when next_status='cancelled' then auth.uid() else cancelled_by end,updated_at=now()
  where id=req.id returning * into req;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,before_data,after_data)
  values(auth.uid(),public.current_role()::text,req.garden_id,'kindergarten_enrollment_requests',req.id,'enrollment_request_'||target_action,null,jsonb_build_object('status',next_status,'reservation_id',req.reservation_id));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,created_by)
  values(req.garden_id,req.parent_id,req.parent_id,'parent','בקשת ההצטרפות עודכנה',coalesce(nullif(btrim(target_reason),''),'סטטוס בקשת ההצטרפות עודכן.'),coalesce(nullif(btrim(target_reason),''),'סטטוס בקשת ההצטרפות עודכן.'),'kindergarten_enrollment_requests',req.id,case when next_status='rejected' then 'medium' else 'low' end,'/dashboard/parent',req.garden_id,auth.uid());
  return jsonb_build_object('request',to_jsonb(req),'staffing_readiness',staffing,'idempotent',false);
end $$;

create or replace function public.respond_enrollment_information(target_request_id uuid,target_response text)
returns public.kindergarten_enrollment_requests language plpgsql security definer set search_path=public as $$
declare req public.kindergarten_enrollment_requests;
begin
  select * into req from public.kindergarten_enrollment_requests where id=target_request_id for update;
  if req.id is null or req.parent_id<>auth.uid() or not public.can_guardian_access_child(req.child_profile_id,'profile') then raise exception 'enrollment_request_denied' using errcode='42501'; end if;
  if req.status<>'information_required' then raise exception 'invalid_enrollment_transition' using errcode='23514'; end if;
  update public.kindergarten_enrollment_requests set status='resubmitted',information_response=nullif(btrim(target_response),''),information_responded_at=now(),updated_at=now() where id=req.id returning * into req;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data) values(auth.uid(),'parent',req.garden_id,'kindergarten_enrollment_requests',req.id,'enrollment_information_resubmitted',jsonb_build_object('status','resubmitted'));
  return req;
end $$;

create or replace function public.cancel_parent_enrollment_request(target_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare req public.kindergarten_enrollment_requests;
begin
  select * into req from public.kindergarten_enrollment_requests where id=target_request_id for update;
  if req.id is null or req.parent_id<>auth.uid() or not public.can_guardian_access_child(req.child_profile_id,'profile') then raise exception 'enrollment_request_denied' using errcode='42501'; end if;
  if req.status not in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_payment','waitlisted') then raise exception 'invalid_enrollment_transition' using errcode='23514'; end if;
  if req.reservation_id is not null then
    update public.classroom_seat_reservations set status='released',released_at=now(),updated_at=now()
    where id=req.reservation_id and enrollment_request_id=req.id and status='active';
  end if;
  update public.kindergarten_enrollment_requests set status='cancelled',cancelled_at=now(),cancelled_by=auth.uid(),updated_at=now() where id=req.id returning * into req;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data) values(auth.uid(),'parent',req.garden_id,'kindergarten_enrollment_requests',req.id,'enrollment_request_cancelled',jsonb_build_object('status','cancelled'));
  return jsonb_build_object('request',to_jsonb(req));
end $$;

revoke all on function public.submit_enrollment_request(uuid,uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.decide_enrollment_request(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.respond_enrollment_information(uuid,text) from public,anon,authenticated;
revoke all on function public.cancel_parent_enrollment_request(uuid) from public,anon,authenticated;
grant execute on function public.submit_enrollment_request(uuid,uuid,uuid,text,text) to authenticated;
grant execute on function public.decide_enrollment_request(uuid,text,uuid,text) to authenticated;
grant execute on function public.respond_enrollment_information(uuid,text) to authenticated;
grant execute on function public.cancel_parent_enrollment_request(uuid) to authenticated;

-- Keep GB-M14 discovery aware of the canonical GB-M15 request states without
-- duplicating its privacy-sensitive public projection here.
do $do$
declare discovery_definition text;
begin
  select pg_get_functiondef('public.find_child_garden_matches(uuid,text,text,date)'::regprocedure)
    into discovery_definition;
  discovery_definition := replace(
    discovery_definition,
    $needle$'more_information_requested'$needle$,
    $replacement$'information_required','resubmitted','waitlisted'$replacement$
  );
  discovery_definition := replace(
    discovery_definition,
    $needle$'approved_pending_payment'$needle$,
    $replacement$'approved','awaiting_payment'$replacement$
  );
  if discovery_definition like '%more_information_requested%'
     or discovery_definition like '%approved_pending_payment%'
     or discovery_definition not like '%information_required%' then
    raise exception 'GB-M15 could not update discovery request-state compatibility';
  end if;
  execute discovery_definition;
end $do$;
