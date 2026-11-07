-- GB-DB-CANDIDATE-REVIEW-ACTOR-ROLE-20261107: preserve the canonical review function and correct only its audit enum cast.
-- No data rewrite, RLS, grants, owner, signature, SECURITY DEFINER, search_path or state transition change.
CREATE OR REPLACE FUNCTION public.decide_staff_job_application(target_application_id uuid, target_action text, target_reason text DEFAULT NULL::text, target_role text DEFAULT NULL::text, target_classroom_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare application public.staff_job_applications; room public.classrooms; next_status text; previous_status text; now_at timestamptz:=now();
begin
  select * into application from public.staff_job_applications where id=target_application_id for update;
  if application.id is null then raise exception 'staff_application_not_found' using errcode='P0002'; end if;
  previous_status:=application.status;
  if not public.can_manage_garden(application.garden_id) then raise exception 'staff_application_decision_denied' using errcode='42501'; end if;
  if target_action='review' and application.status in ('submitted','resubmitted') then next_status:='under_review';
  elsif target_action='request_information' and application.status in ('submitted','under_review','resubmitted') then next_status:='information_required';
  elsif target_action='reject' and application.status in ('submitted','under_review','resubmitted','approved','awaiting_candidate_acceptance') then next_status:='rejected';
  elsif target_action='approve' and application.status in ('submitted','under_review','resubmitted') then next_status:='awaiting_candidate_acceptance';
  else raise exception 'staff_application_transition_invalid' using errcode='23514'; end if;
  if target_action='approve' then
    if target_classroom_id is not null then select * into room from public.classrooms where id=target_classroom_id and garden_id=application.garden_id and status='active'; if room.id is null then raise exception 'staff_application_classroom_invalid' using errcode='23514'; end if; end if;
    if not exists(select 1 from public.staff_candidate_profiles c where c.profile_id=application.staff_candidate_id and coalesce((c.profile_completeness->>'required_fields_complete')::boolean,false)) then raise exception 'candidate_profile_incomplete' using errcode='23514'; end if;
  end if;
  update public.staff_job_applications set status=next_status,reviewed_at=now_at,reviewed_by=auth.uid(),manager_decision=target_action,decision_reason=case when target_action='request_information' then null else nullif(btrim(target_reason),'') end,information_request=case when target_action='request_information' then nullif(btrim(target_reason),'') else information_request end,classroom_id=coalesce(target_classroom_id,classroom_id),requested_role=coalesce(nullif(btrim(target_role),''),requested_role),decided_at=case when target_action in ('approve','reject') then now_at else decided_at end,updated_at=now_at where id=application.id returning * into application;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),public.current_role()::public.app_role,application.garden_id,'staff_job_applications',application.id,'staff_application_'||target_action,jsonb_build_object('status',previous_status),jsonb_build_object('status',next_status));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,created_by)
  values(application.garden_id,application.staff_candidate_id,application.staff_candidate_id,'staff','המועמדות עודכנה',coalesce(nullif(btrim(target_reason),''),'סטטוס המועמדות שלך עודכן.'),coalesce(nullif(btrim(target_reason),''),'סטטוס המועמדות שלך עודכן.'),'staff_job_applications',application.id,'low','/dashboard/staff/job-market',application.garden_id,auth.uid());
  return to_jsonb(application);
end $function$;
