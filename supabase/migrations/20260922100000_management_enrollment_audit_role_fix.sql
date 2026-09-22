-- GB-M35E scoped forward-only repair: audit_logs.actor_role is public.app_role.
-- The original GB-M15 migration is already applied. Preserve its history and
-- replace only the decision RPC body; this migration changes no enrollment row.

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
  values(auth.uid(),public.current_role(),req.garden_id,'kindergarten_enrollment_requests',req.id,'enrollment_request_'||target_action,null,jsonb_build_object('status',next_status,'reservation_id',req.reservation_id));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,created_by)
  values(req.garden_id,req.parent_id,req.parent_id,'parent','בקשת ההצטרפות עודכנה',coalesce(nullif(btrim(target_reason),''),'סטטוס בקשת ההצטרפות עודכן.'),coalesce(nullif(btrim(target_reason),''),'סטטוס בקשת ההצטרפות עודכן.'),'kindergarten_enrollment_requests',req.id,case when next_status='rejected' then 'medium' else 'low' end,'/dashboard/parent',req.garden_id,auth.uid());
  return jsonb_build_object('request',to_jsonb(req),'staffing_readiness',staffing,'idempotent',false);
end $$;

revoke all on function public.decide_enrollment_request(uuid,text,uuid,text) from public,anon;
grant execute on function public.decide_enrollment_request(uuid,text,uuid,text) to authenticated;
