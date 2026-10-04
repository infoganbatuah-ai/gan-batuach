-- GB-M31: Email verification is sufficient for normal Management account actions.
-- Preserve other authorization/approval requirements and applied migration history.

create or replace function public.management_account_verification_satisfied(p_profile_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.profiles p where p.id=p_profile_id
      and (not p.contact_verification_required or p.email_verified_at is not null)
  );
$$;
revoke all on function public.management_account_verification_satisfied(uuid) from public, anon, authenticated;
grant execute on function public.management_account_verification_satisfied(uuid) to service_role;

-- Forward replacement of garden_onboarding_status from 20260911020000_management_atomic_garden_onboarding.sql; only the universal phone gate changes.

create or replace function public.garden_onboarding_status(target_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb; blockers text[] := '{}'; record public.kindergarten_onboarding_records%rowtype; garden public.gardens%rowtype; actor public.profiles%rowtype;
begin
  if not public.can_edit_garden_onboarding(target_garden_id) then raise exception 'onboarding_access_denied' using errcode='42501'; end if;
  select * into record from public.kindergarten_onboarding_records where garden_id=target_garden_id;
  select * into garden from public.gardens where id=target_garden_id;
  select * into actor from public.profiles where id=auth.uid();
  if record.id is null or garden.id is null then raise exception 'onboarding_not_found' using errcode='P0002'; end if;
  if coalesce(trim(garden.name),'')='' then blockers:=array_append(blockers,'garden_name'); end if;
  if coalesce(trim(garden.address),'')='' then blockers:=array_append(blockers,'address'); end if;
  if coalesce(trim(garden.phone),'')='' then blockers:=array_append(blockers,'phone'); end if;
  if not public.management_account_verification_satisfied(actor.id) then blockers:=array_append(blockers,'identity_verification'); end if;
  if coalesce(jsonb_array_length(coalesce(record.profile_data->'selected_age_groups','[]'::jsonb)),0)=0 then blockers:=array_append(blockers,'age_groups'); end if;
  if coalesce(trim(record.profile_data->>'documents_summary'),'')='' then blockers:=array_append(blockers,'documents'); end if;
  if not exists(select 1 from public.kindergarten_legal_acceptances a where a.garden_id=target_garden_id and a.manager_profile_id=auth.uid() and a.accepted and a.acceptance_type='platform_terms') then blockers:=array_append(blockers,'platform_terms'); end if;
  if not exists(select 1 from public.kindergarten_legal_acceptances a where a.garden_id=target_garden_id and a.manager_profile_id=auth.uid() and a.accepted and a.acceptance_type='privacy_terms') then blockers:=array_append(blockers,'privacy_terms'); end if;
  result:=jsonb_build_object('garden_id',target_garden_id,'lifecycle_status',record.lifecycle_status,'current_step',record.current_step,
    'completed_stages',record.completed_steps,'progress_percent',record.progress_percent,'blockers',blockers,'can_activate',cardinality(blockers)=0,
    'registrant_type',record.registrant_type,'subscription',jsonb_build_object('provider','manual','status',record.payment_status,'live_collection',false));
  return result;
end $$;


-- Forward replacement of activate_enrollment_from_evidence from 20260912050000_management_enrollment_activation.sql; only the universal phone gate changes.

create or replace function public.activate_enrollment_from_evidence(target_request_id uuid,target_evidence_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  req public.kindergarten_enrollment_requests; evidence public.enrollment_payment_evidence;
  hold public.classroom_seat_reservations; room public.classrooms; file public.permanent_child_files;
  parent_profile public.profiles; parent_row public.parents; child_row public.children;
  enrollment public.child_kindergarten_enrollments; existing_active public.child_kindergarten_enrollments;
  other_request record; identity_value text; now_at timestamptz:=now();
begin
  perform pg_advisory_xact_lock(hashtextextended(target_request_id::text,0));
  select * into req from public.kindergarten_enrollment_requests where id=target_request_id for update;
  if req.id is null then raise exception 'enrollment_request_not_found' using errcode='P0002'; end if;
  if req.status='activated' and req.activated_enrollment_id is not null then
    select * into enrollment from public.child_kindergarten_enrollments where id=req.activated_enrollment_id;
    return jsonb_build_object('status','activated','enrollment_id',enrollment.id,'child_id',enrollment.child_id,'idempotent',true);
  end if;
  if req.status<>'awaiting_payment' then raise exception 'enrollment_not_awaiting_payment' using errcode='23514'; end if;
  select * into evidence from public.enrollment_payment_evidence where id=target_evidence_id and enrollment_request_id=req.id and garden_id=req.garden_id for update;
  if evidence.id is null or evidence.status<>'confirmed' then raise exception 'confirmed_payment_evidence_required' using errcode='23514'; end if;
  if evidence.evidence_kind='electronic' and evidence.provider_mode not in ('live','verified_test') then raise exception 'unverified_electronic_provider' using errcode='23514'; end if;
  select * into hold from public.classroom_seat_reservations where id=req.reservation_id and enrollment_request_id=req.id and garden_id=req.garden_id and classroom_id=req.requested_classroom_id for update;
  if hold.id is null or hold.status<>'active' or (hold.expires_at is not null and hold.expires_at<=now_at) then raise exception 'enrollment_reservation_not_active' using errcode='23514'; end if;
  select * into room from public.classrooms where id=hold.classroom_id and garden_id=req.garden_id and status='active' for update;
  if room.id is null then raise exception 'enrollment_classroom_not_active' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(req.child_profile_id::text,0));
  select * into existing_active from public.child_kindergarten_enrollments where permanent_child_file_id=req.child_profile_id and status='active' for update;
  if existing_active.id is not null and existing_active.garden_id<>req.garden_id then raise exception 'active_enrollment_conflict' using errcode='23505'; end if;
  select * into file from public.permanent_child_files where id=req.child_profile_id for update;
  select * into parent_profile from public.profiles where id=req.parent_id;
  if file.id is null or parent_profile.id is null or not exists(
    select 1 from public.child_guardian_links link where link.guardian_profile_id=req.parent_id and link.permanent_child_file_id=req.child_profile_id
      and link.status='active' and link.legal_authority=true and coalesce((link.access_scope->>'profile')::boolean,false)=true
      and (link.valid_until is null or link.valid_until>now_at)
  ) then raise exception 'enrollment_identity_invalid' using errcode='42501'; end if;
  if not public.management_account_verification_satisfied(parent_profile.id) then raise exception 'enrollment_contact_verification_required' using errcode='23514'; end if;
  select * into parent_row from public.parents where profile_id=req.parent_id and garden_id=req.garden_id order by created_at desc limit 1 for update;
  if parent_row.id is null then
    insert into public.parents(profile_id,user_id,garden_id,full_name,phone,email,address,completed_profile,status,onboarding_status,invitation_status,activated_at,activated_by)
    values(req.parent_id,req.parent_id,req.garden_id,parent_profile.full_name,coalesce(parent_profile.phone,''),parent_profile.email,file.address,true,'active','active','active',now_at,evidence.recorded_by)
    returning * into parent_row;
  else
    update public.parents set status='active',onboarding_status='active',invitation_status='active',activated_at=coalesce(activated_at,now_at),activated_by=coalesce(activated_by,evidence.recorded_by),updated_at=now_at where id=parent_row.id returning * into parent_row;
  end if;
  select * into child_row from public.children where garden_id=req.garden_id and permanent_child_file_id=file.id for update;
  if child_row.id is null then
    identity_value:=coalesce(file.identity_number,file.mother_details->>'identity_number',file.father_details->>'identity_number');
    if identity_value is null then raise exception 'child_identity_required' using errcode='23514'; end if;
    insert into public.children(garden_id,primary_parent_id,permanent_child_file_id,full_name,birth_date,identity_number,hmo,address,photo_url,face_image_url,pickup_authorized,status,parent_completed,manager_approved_at,monthly_fee,payment_status)
    values(req.garden_id,parent_row.id,file.id,file.full_name,file.birth_date,identity_value,file.hmo,file.address,file.photo_url,coalesce(file.face_image_url,file.photo_url),coalesce(file.pickup_authorized,'[]'::jsonb),'active',true,now_at,coalesce(req.published_price_snapshot,evidence.amount),case when evidence.evidence_kind='manual_arrangement' then 'special_arrangement' else 'paid' end)
    returning * into child_row;
  else
    update public.children set status='active',parent_completed=true,manager_approved_at=coalesce(manager_approved_at,now_at),payment_status=case when evidence.evidence_kind='manual_arrangement' then 'special_arrangement' else 'paid' end,last_amount_paid=evidence.amount,last_payment_date=evidence.covered_from,valid_until=evidence.covered_until,updated_at=now_at where id=child_row.id returning * into child_row;
  end if;
  select * into enrollment from public.child_kindergarten_enrollments where child_id=child_row.id and garden_id=req.garden_id for update;
  if enrollment.id is null then
    insert into public.child_kindergarten_enrollments(child_id,permanent_child_file_id,garden_id,status,start_date,manager_approved_at,manager_approved_by,enrollment_request_id,activation_payment_evidence_id,classroom_id,activated_at,activation_source,updated_at)
    values(child_row.id,file.id,req.garden_id,'active',greatest(evidence.covered_from,current_date),now_at,evidence.recorded_by,req.id,evidence.id,room.id,now_at,evidence.evidence_kind,now_at)
    returning * into enrollment;
  else
    update public.child_kindergarten_enrollments set permanent_child_file_id=file.id,status='active',start_date=coalesce(start_date,greatest(evidence.covered_from,current_date)),manager_approved_at=coalesce(manager_approved_at,now_at),manager_approved_by=coalesce(manager_approved_by,evidence.recorded_by),enrollment_request_id=req.id,activation_payment_evidence_id=evidence.id,classroom_id=room.id,activated_at=coalesce(activated_at,now_at),activation_source=evidence.evidence_kind,updated_at=now_at where id=enrollment.id returning * into enrollment;
  end if;
  update public.classroom_seat_reservations set child_id=child_row.id,enrollment_id=enrollment.id,updated_at=now_at where id=hold.id;
  update public.child_classroom_assignments set is_current=false,ended_at=now_at,end_reason='enrollment_activation_move'
    where child_id=child_row.id and garden_id=req.garden_id and is_current and classroom_id<>room.id;
  if exists(select 1 from public.child_classroom_assignments where child_id=child_row.id and garden_id=req.garden_id and classroom_id=room.id and is_current) then
    update public.child_classroom_assignments set enrollment_id=enrollment.id where child_id=child_row.id and garden_id=req.garden_id and classroom_id=room.id and is_current;
  else
    insert into public.child_classroom_assignments(garden_id,child_id,enrollment_id,classroom_id,assigned_by)
    values(req.garden_id,child_row.id,enrollment.id,room.id,evidence.recorded_by);
  end if;
  update public.classroom_seat_reservations set status='consumed',consumed_at=now_at,updated_at=now_at where id=hold.id and status='active';
  select * into hold from public.classroom_seat_reservations where id=hold.id;
  if hold.status<>'consumed' then raise exception 'reservation_consumption_failed'; end if;
  update public.permanent_child_files set owner_status='submitted',updated_at=now_at where id=file.id;
  update public.kindergarten_enrollment_requests set status='activated',payment_status=case when evidence.evidence_kind='manual_arrangement' then 'arranged' else 'paid' end,activation_payment_evidence_id=evidence.id,activated_enrollment_id=enrollment.id,activated_at=now_at,activated_child_id=child_row.id,updated_at=now_at where id=req.id;

  for other_request in select id,reservation_id from public.kindergarten_enrollment_requests where child_profile_id=file.id and id<>req.id and status in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_payment','waitlisted') for update loop
    update public.classroom_seat_reservations set status='released',released_at=now_at,updated_at=now_at where id=other_request.reservation_id and status='active';
    if exists(select 1 from public.enrollment_payment_evidence p where p.enrollment_request_id=other_request.id and p.status='confirmed') then
      update public.enrollment_payment_evidence set status='reconciliation_required',reconciliation_reason='another_garden_enrollment_activated',updated_at=now_at where enrollment_request_id=other_request.id and status='confirmed';
      update public.kindergarten_enrollment_requests set status='payment_reconciliation_required',updated_at=now_at where id=other_request.id;
    else
      update public.kindergarten_enrollment_requests set status='cancelled',cancelled_at=now_at,cancelled_by=evidence.recorded_by,updated_at=now_at where id=other_request.id;
    end if;
  end loop;
  insert into public.child_timeline_events(child_id,permanent_child_file_id,garden_id,actor_id,actor_role,event_type,title,description,metadata)
  values(child_row.id,file.id,req.garden_id,evidence.recorded_by,case when evidence.evidence_kind='manual_arrangement' then 'manager' else 'system' end,'kindergarten_enrollment_activated','ההרשמה לגן הופעלה','ההרשמה הופעלה לאחר אימות הסדר התשלום.',jsonb_build_object('enrollment_request_id',req.id,'payment_evidence_id',evidence.id,'classroom_id',room.id));
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(evidence.recorded_by,case when evidence.evidence_kind='manual_arrangement' then 'manager' else 'system' end,req.garden_id,'child_kindergarten_enrollments',enrollment.id,'enrollment_activation_succeeded',jsonb_build_object('request_id',req.id,'payment_evidence_id',evidence.id,'classroom_id',room.id));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,child_id,created_by)
  values(req.garden_id,req.parent_id,req.parent_id,'parent','ההרשמה לגן הופעלה','ההרשמה הושלמה והילד/ה פעיל/ה בגן.','ההרשמה הושלמה והילד/ה פעיל/ה בגן.','child_kindergarten_enrollments',enrollment.id,'low','/dashboard/parent',req.garden_id,child_row.id,evidence.recorded_by);
  return jsonb_build_object('status','activated','enrollment_id',enrollment.id,'child_id',child_row.id,'classroom_id',room.id,'payment_evidence_id',evidence.id,'idempotent',false);
end $$;


-- Forward replacement of activate_staff_employment from 20260912070000_management_staff_hiring_lifecycle.sql; only the universal phone gate changes.

create or replace function public.activate_staff_employment(target_application_id uuid,target_invitation_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare application public.staff_job_applications; candidate public.staff_candidate_profiles; invitation public.management_invitations; actor_profile public.profiles; file public.staff_permanent_files; staff_row public.staff; employment public.staff_kindergarten_employments; room public.classrooms; now_at timestamptz:=now();
begin
  perform pg_advisory_xact_lock(hashtextextended(target_application_id::text,0));
  select * into application from public.staff_job_applications where id=target_application_id and staff_candidate_id=auth.uid() for update;
  if application.id is null then raise exception 'staff_application_not_found' using errcode='P0002'; end if;
  if application.status='employed' and application.employment_id is not null then return jsonb_build_object('application_id',application.id,'employment_id',application.employment_id,'staff_id',application.activated_staff_id,'idempotent',true); end if;
  if application.status<>'awaiting_candidate_acceptance' then raise exception 'staff_application_not_awaiting_acceptance' using errcode='23514'; end if;
  select * into actor_profile from public.profiles where id=auth.uid() for update;
  if actor_profile.id is null or (not public.management_account_verification_satisfied(actor_profile.id)) then raise exception 'staff_contact_verification_required' using errcode='23514'; end if;
  select * into candidate from public.staff_candidate_profiles where profile_id=auth.uid() for update;
  if candidate.profile_id is null or coalesce((public.evaluate_staff_candidate_profile(auth.uid())->>'required_fields_complete')::boolean,false)<>true then raise exception 'candidate_profile_incomplete' using errcode='23514'; end if;
  if target_invitation_id is not null then
    select * into invitation from public.management_invitations where id=target_invitation_id and invitation_type='staff' and intended_role='staff' and garden_id=application.garden_id and staff_application_id=application.id and target_profile_id=auth.uid() and status in ('pending','delivered') and expires_at>now_at for update;
    if invitation.id is null then raise exception 'staff_invitation_invalid' using errcode='42501'; end if;
  end if;
  if application.classroom_id is not null then select * into room from public.classrooms where id=application.classroom_id and garden_id=application.garden_id and status='active'; if room.id is null then raise exception 'staff_application_classroom_invalid' using errcode='23514'; end if; end if;
  select * into file from public.staff_permanent_files where profile_id=auth.uid() order by created_at limit 1 for update;
  if file.id is null then insert into public.staff_permanent_files(profile_id,full_name,phone,email,profile_photo_url,document_summary,notes) values(auth.uid(),coalesce(candidate.full_name,'איש צוות'),candidate.phone,candidate.email,candidate.profile_photo_url,candidate.document_status,'נוצר בהפעלת העסקה קנונית GB-M18') returning * into file; end if;
  select * into staff_row from public.staff where profile_id=auth.uid() and garden_id=application.garden_id order by created_at limit 1 for update;
  if staff_row.id is null then insert into public.staff(profile_id,garden_id,full_name,role_title,phone,email,profile_photo_url,class_group,approved_to_work,onboarding_status,background_check_status,police_clearance_status,manager_approved_at,activated_at,activated_by) values(auth.uid(),application.garden_id,coalesce(candidate.full_name,'איש צוות'),coalesce(application.requested_role,'צוות'),candidate.phone,candidate.email,candidate.profile_photo_url,null,true,'active','pending_review','pending_review',application.reviewed_at,now_at,application.reviewed_by) returning * into staff_row;
  else update public.staff set approved_to_work=true,onboarding_status='active',role_title=coalesce(application.requested_role,role_title),activated_at=coalesce(activated_at,now_at),activated_by=coalesce(activated_by,application.reviewed_by),updated_at=now_at where id=staff_row.id returning * into staff_row; end if;
  select * into employment from public.staff_kindergarten_employments where profile_id=auth.uid() and garden_id=application.garden_id and status in ('pending_approval','active') order by created_at limit 1 for update;
  if employment.id is null then insert into public.staff_kindergarten_employments(staff_file_id,staff_id,profile_id,garden_id,status,role_title,start_date,approved_at,approved_by,notes) values(file.id,staff_row.id,auth.uid(),application.garden_id,'active',coalesce(application.requested_role,'צוות'),current_date,now_at,application.reviewed_by,'הופעל דרך GB-M18') returning * into employment;
  else update public.staff_kindergarten_employments set staff_id=staff_row.id,status='active',role_title=coalesce(application.requested_role,role_title),approved_at=coalesce(approved_at,now_at),approved_by=coalesce(approved_by,application.reviewed_by),updated_at=now_at where id=employment.id returning * into employment; end if;
  if room.id is not null and not exists(select 1 from public.staff_classroom_assignments where employment_id=employment.id and classroom_id=room.id and status='active') then insert into public.staff_classroom_assignments(garden_id,staff_id,employment_id,classroom_id,assigned_by,status) values(application.garden_id,staff_row.id,employment.id,room.id,application.reviewed_by,'active'); end if;
  update public.staff_job_applications set status='employed',accepted_at=now_at,activated_at=now_at,activated_staff_id=staff_row.id,employment_id=employment.id,updated_at=now_at where id=application.id;
  if invitation.id is not null then update public.management_invitations set status='accepted',accepted_at=now_at,accepted_by=auth.uid(),updated_at=now_at where id=invitation.id; end if;
  update public.profiles set active=true,garden_id=coalesce(garden_id,application.garden_id),self_service_status='active',self_service_approved_at=coalesce(self_service_approved_at,now_at),self_service_approved_by=coalesce(self_service_approved_by,application.reviewed_by) where id=auth.uid();
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data) values(auth.uid(),'staff',application.garden_id,'staff_kindergarten_employments',employment.id,'staff_employment_activated',jsonb_build_object('application_id',application.id,'invitation_id',invitation.id,'classroom_id',application.classroom_id));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,created_by) values(application.garden_id,auth.uid(),auth.uid(),'staff','ההעסקה הופעלה','הגישה התפעולית לגן הופעלה בהתאם לתפקיד.','הגישה התפעולית לגן הופעלה בהתאם לתפקיד.','staff_kindergarten_employments',employment.id,'low','/dashboard/staff',application.garden_id,application.reviewed_by);
  return jsonb_build_object('application_id',application.id,'employment_id',employment.id,'staff_id',staff_row.id,'classroom_id',application.classroom_id,'idempotent',false);
end $$;


-- Forward replacement of submit_inspector_application from 20260913020000_management_inspector_approval.sql; only the universal phone gate changes.

create or replace function public.submit_inspector_application(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.profiles%rowtype; existing public.inspector_applications%rowtype; saved public.inspector_applications%rowtype;
declare submitted boolean := coalesce((p_payload->>'submit')::boolean,true);
declare next_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into actor from public.profiles where id=auth.uid() for update;
  if actor.id is null or actor.role::text <> 'inspector' then raise exception 'inspector_role_required' using errcode='42501'; end if;
  if nullif(trim(p_payload->>'full_name'),'') is null then raise exception 'inspector_name_required' using errcode='23514'; end if;
  if submitted and (nullif(trim(p_payload->>'city'),'') is null or
      (not public.management_account_verification_satisfied(actor.id))) then
    raise exception 'inspector_application_incomplete' using errcode='23514';
  end if;
  select * into existing from public.inspector_applications where profile_id=actor.id for update;
  if existing.id is not null and existing.status in ('approved','suspended') then
    raise exception 'inspector_application_locked' using errcode='23514';
  end if;
  if existing.id is not null and existing.status in ('submitted','under_review') then
    return to_jsonb(existing);
  end if;
  if existing.id is not null and existing.status='more_information_requested' and not submitted then
    raise exception 'inspector_response_requires_submission' using errcode='23514';
  end if;
  next_status:=case when submitted then 'submitted' else 'draft' end;
  insert into public.inspector_applications(profile_id,full_name,phone,email,city,preferred_regions,experience_summary,documents,status,submitted_at,metadata)
  values(actor.id,trim(p_payload->>'full_name'),coalesce(p_payload->>'phone',actor.phone),coalesce(p_payload->>'email',actor.email),p_payload->>'city',
    coalesce(array(select jsonb_array_elements_text(p_payload->'preferred_regions')),'{}'::text[]),p_payload->>'experience_summary',coalesce(p_payload->'documents','{}'::jsonb),next_status,
    case when submitted then now() else null end,coalesce(p_payload->'metadata','{}'::jsonb))
  on conflict(profile_id) do update set full_name=excluded.full_name,phone=excluded.phone,email=excluded.email,city=excluded.city,
    preferred_regions=excluded.preferred_regions,experience_summary=excluded.experience_summary,documents=excluded.documents,status=excluded.status,
    submitted_at=excluded.submitted_at,metadata=excluded.metadata,admin_decision=null,decision_reason=null,decided_at=null,updated_at=now()
  returning * into saved;
  insert into public.audit_logs(actor_id,actor_role,entity_type,entity_id,action,after_data)
  values(actor.id,'inspector','inspector_applications',saved.id,case when submitted then 'inspector_application_submitted' else 'inspector_application_saved' end,jsonb_build_object('status',next_status));
  if submitted then
    insert into public.notifications(recipient_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,recipient_profile_id,created_by)
    values(actor.id,'inspector','בקשת המפקח התקבלה','הבקשה הועברה לבדיקה.','הבקשה הועברה לבדיקה.',
      'inspector_applications',saved.id,'low','/dashboard/inspector/apply',actor.id,actor.id);
  end if;
  return to_jsonb(saved);
end;
$$;

-- Forward replacement of decide_inspector_application from 20260913020000_management_inspector_approval.sql; only the universal phone gate changes.

create or replace function public.decide_inspector_application(p_application_id uuid,p_action text,p_reason text default null,p_regions text[] default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare application public.inspector_applications%rowtype; applicant public.profiles%rowtype; saved public.inspector_applications%rowtype;
declare next_status text; now_at timestamptz:=now();
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  select * into application from public.inspector_applications where id=p_application_id for update;
  if application.id is null then raise exception 'application_not_found' using errcode='P0002'; end if;
  if p_action not in ('under_review','request_more_information','approve','reject','suspend') then raise exception 'invalid_inspector_action' using errcode='23514'; end if;
  next_status:=case p_action when 'request_more_information' then 'more_information_requested' when 'approve' then 'approved' when 'reject' then 'rejected' else p_action end;
  if application.status=next_status then return to_jsonb(application); end if;
  if not (
    (application.status in ('submitted','under_review','approved_pending_assignment') and p_action in ('under_review','request_more_information','approve','reject')) or
    (application.status='approved' and p_action='suspend') or
    (application.status='suspended' and p_action='approve')
  ) then raise exception 'invalid_inspector_transition' using errcode='23514'; end if;
  select * into applicant from public.profiles where id=application.profile_id for update;
  if applicant.id is null or applicant.role::text<>'inspector' then raise exception 'inspector_profile_invalid' using errcode='23514'; end if;
  if p_action='approve' then
    if not public.management_account_verification_satisfied(applicant.id) then
      raise exception 'inspector_contact_unverified' using errcode='23514';
    end if;
    if nullif(trim(application.full_name),'') is null or nullif(trim(application.city),'') is null then
      raise exception 'inspector_application_incomplete' using errcode='23514'; end if;
    insert into public.inspectors(id,service_cities,certification_notes)
    values(applicant.id,coalesce(p_regions,application.preferred_regions),application.experience_summary)
    on conflict(id) do update set service_cities=excluded.service_cities,certification_notes=excluded.certification_notes;
    update public.profiles set active=true,self_service_status='active',self_service_approved_at=now_at,self_service_approved_by=auth.uid() where id=applicant.id;
  elsif p_action='suspend' then
    update public.profiles set self_service_status='suspended' where id=applicant.id;
  elsif p_action='reject' then
    update public.profiles set self_service_status='rejected' where id=applicant.id;
  end if;
  update public.inspector_applications set status=next_status,admin_decision=p_action,decision_reason=p_reason,
    decided_at=case when p_action in ('approve','reject','suspend') then now_at else decided_at end,
    activated_at=case when p_action='approve' then now_at else activated_at end,updated_at=now_at
  where id=application.id returning * into saved;
  insert into public.audit_logs(actor_id,actor_role,entity_type,entity_id,action,before_data,after_data)
  values(auth.uid(),'admin','inspector_applications',application.id,'inspector_application_'||p_action,
    jsonb_build_object('status',application.status),jsonb_build_object('status',next_status));
  insert into public.notifications(recipient_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,recipient_profile_id,created_by)
  values(application.profile_id,'inspector','בקשת המפקח עודכנה',coalesce(p_reason,'סטטוס הבקשה שלך עודכן.'),coalesce(p_reason,'סטטוס הבקשה שלך עודכן.'),
    'inspector_applications',application.id,'low','/dashboard/inspector/apply',application.profile_id,auth.uid());
  return to_jsonb(saved);
end;
$$;
