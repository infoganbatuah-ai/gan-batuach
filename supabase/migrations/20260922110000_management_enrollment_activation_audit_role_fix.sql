-- GB-M35E scoped forward-only repair: audit_logs.actor_role is public.app_role.
-- Preserve the applied GB-M16/GB-M31 migrations and replace only the two
-- enrollment activation RPC bodies. This migration creates no payment evidence
-- and changes no enrollment state until an authenticated manager invokes it.

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
  values(evidence.recorded_by,case when evidence.evidence_kind='manual_arrangement' then public.current_role() else null::public.app_role end,req.garden_id,'child_kindergarten_enrollments',enrollment.id,'enrollment_activation_succeeded',jsonb_build_object('request_id',req.id,'payment_evidence_id',evidence.id,'classroom_id',room.id));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,child_id,created_by)
  values(req.garden_id,req.parent_id,req.parent_id,'parent','ההרשמה לגן הופעלה','ההרשמה הושלמה והילד/ה פעיל/ה בגן.','ההרשמה הושלמה והילד/ה פעיל/ה בגן.','child_kindergarten_enrollments',enrollment.id,'low','/dashboard/parent',req.garden_id,child_row.id,evidence.recorded_by);
  return jsonb_build_object('status','activated','enrollment_id',enrollment.id,'child_id',child_row.id,'classroom_id',room.id,'payment_evidence_id',evidence.id,'idempotent',false);
end $$;

create or replace function public.record_manual_enrollment_arrangement(
  target_request_id uuid,target_method text,target_amount numeric,target_covered_from date,target_covered_until date,target_reference text default null,target_note text default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare req public.kindergarten_enrollment_requests; evidence public.enrollment_payment_evidence; key text; activation jsonb; reason text;
begin
  select * into req from public.kindergarten_enrollment_requests where id=target_request_id for update;
  if req.id is null then raise exception 'enrollment_request_not_found' using errcode='P0002'; end if;
  if not public.can_manage_garden(req.garden_id) then raise exception 'manual_payment_denied' using errcode='42501'; end if;
  if target_method not in ('bank_transfer','standing_order','checks') or target_amount<0 or target_covered_until<target_covered_from then raise exception 'invalid_manual_arrangement' using errcode='22023'; end if;
  key:='manual-enrollment:'||req.id::text;
  insert into public.enrollment_payment_evidence(garden_id,enrollment_request_id,evidence_kind,provider_mode,idempotency_key,status,manual_method,amount,covered_from,covered_until,reference,note,confirmed_at,recorded_by)
  values(req.garden_id,req.id,'manual_arrangement','manual',key,'confirmed',target_method,target_amount,target_covered_from,target_covered_until,nullif(btrim(target_reference),''),nullif(btrim(target_note),''),now(),auth.uid())
  on conflict(garden_id,idempotency_key) do update set updated_at=now()
  returning * into evidence;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),public.current_role(),req.garden_id,'enrollment_payment_evidence',evidence.id,'manual_payment_arrangement_recorded',jsonb_build_object('request_id',req.id,'method',target_method,'covered_from',target_covered_from,'covered_until',target_covered_until));
  begin
    activation:=public.activate_enrollment_from_evidence(req.id,evidence.id);
    return activation;
  exception when others then
    reason:=sqlstate||':'||sqlerrm;
    update public.enrollment_payment_evidence set status='reconciliation_required',reconciliation_reason=left(reason,500),updated_at=now() where id=evidence.id;
    update public.kindergarten_enrollment_requests set status='payment_reconciliation_required',payment_status='reconciliation_required',updated_at=now() where id=req.id and status<>'activated';
    insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),public.current_role(),req.garden_id,'enrollment_payment_evidence',evidence.id,'enrollment_activation_reconciliation_required',jsonb_build_object('request_id',req.id,'reason_code',sqlstate));
    return jsonb_build_object('status','payment_reconciliation_required','payment_evidence_id',evidence.id,'reason_code',sqlstate,'idempotent',false);
  end;
end $$;

revoke all on function public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text) from public,anon;
grant execute on function public.record_manual_enrollment_arrangement(uuid,text,numeric,date,date,text,text) to authenticated;
