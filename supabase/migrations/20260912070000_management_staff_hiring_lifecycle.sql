-- GB-M18: canonical Staff application, signed invitation and atomic employment activation.

alter table public.staff_job_applications
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null,
  add column if not exists invitation_id uuid references public.management_invitations(id) on delete set null,
  add column if not exists employment_id uuid references public.staff_kindergarten_employments(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists information_request text,
  add column if not exists candidate_response text,
  add column if not exists requirement_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists accepted_at timestamptz,
  add column if not exists withdrawn_at timestamptz;

update public.staff_job_applications set status='information_required' where status='more_information_requested';
update public.staff_job_applications set status='awaiting_candidate_acceptance' where status='approved_pending_completion';
alter table public.staff_job_applications drop constraint if exists staff_job_applications_status_check;
alter table public.staff_job_applications drop constraint if exists staff_job_applications_staff_candidate_id_garden_id_opening_id_key;
alter table public.staff_job_applications add constraint staff_job_applications_status_check check (status in (
  'draft','submitted','under_review','information_required','resubmitted','approved',
  'awaiting_candidate_acceptance','accepted','rejected','withdrawn','cancelled','employed'
));

alter table public.management_invitations
  add column if not exists staff_application_id uuid references public.staff_job_applications(id) on delete set null;

create unique index if not exists staff_application_one_active_opening_idx
  on public.staff_job_applications(staff_candidate_id,opening_id)
  where opening_id is not null and status in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_candidate_acceptance','accepted');
create unique index if not exists staff_employment_one_active_garden_idx
  on public.staff_kindergarten_employments(profile_id,garden_id)
  where profile_id is not null and garden_id is not null and status in ('pending_approval','active');

create or replace function public.submit_staff_job_application(target_opening_id uuid,target_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare candidate public.staff_candidate_profiles; opening public.kindergarten_staff_openings; existing public.staff_job_applications; created public.staff_job_applications; completeness jsonb; now_at timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||target_opening_id::text,0));
  select * into candidate from public.staff_candidate_profiles where profile_id=auth.uid() for update;
  if candidate.profile_id is null then raise exception 'candidate_profile_required' using errcode='23514'; end if;
  completeness:=public.evaluate_staff_candidate_profile(auth.uid());
  if coalesce((completeness->>'required_fields_complete')::boolean,false)<>true then raise exception 'candidate_profile_incomplete:%',completeness->'blockers' using errcode='23514'; end if;
  select o.* into opening from public.kindergarten_staff_openings o join public.gardens g on g.id=o.garden_id
    where o.id=target_opening_id and o.active_status='published' and g.status='active' for update of o;
  if opening.id is null then raise exception 'staff_opening_not_available' using errcode='P0002'; end if;
  if not (coalesce(opening.qualification_keys,'{}') <@ coalesce(candidate.qualification_keys,'{}')) then raise exception 'required_qualification_missing' using errcode='23514'; end if;
  if opening.classroom_id is not null and not exists(select 1 from public.classrooms c where c.id=opening.classroom_id and c.garden_id=opening.garden_id and c.status='active') then raise exception 'staff_opening_classroom_invalid' using errcode='23514'; end if;
  select * into existing from public.staff_job_applications where staff_candidate_id=auth.uid() and opening_id=opening.id and status in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_candidate_acceptance','accepted','employed') order by created_at desc limit 1 for update;
  if existing.id is not null then return jsonb_build_object('application',to_jsonb(existing),'idempotent',true); end if;
  insert into public.staff_job_applications(staff_candidate_id,garden_id,opening_id,classroom_id,requested_role,status,submitted_at,requirement_snapshot,metadata)
  values(auth.uid(),opening.garden_id,opening.id,opening.classroom_id,opening.role_needed,'submitted',now_at,jsonb_build_object('role',opening.role_needed,'qualification_keys',opening.qualification_keys,'classroom_id',opening.classroom_id,'employment_type',opening.employment_type),jsonb_build_object('idempotency_key',coalesce(nullif(btrim(target_idempotency_key),''),'candidate-opening:'||auth.uid()::text||':'||opening.id::text))) returning * into created;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data) values(auth.uid(),'staff',opening.garden_id,'staff_job_applications',created.id,'staff_application_submitted',jsonb_build_object('opening_id',opening.id,'status','submitted'));
  insert into public.notifications(garden_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,created_by)
  values(opening.garden_id,'manager','מועמדות צוות חדשה','הוגשה מועמדות חדשה למשרה פתוחה.','הוגשה מועמדות חדשה למשרה פתוחה.','staff_job_applications',created.id,'low','/dashboard/garden/staff-applications',opening.garden_id,auth.uid());
  return jsonb_build_object('application',to_jsonb(created),'idempotent',false);
end $$;

create or replace function public.decide_staff_job_application(target_application_id uuid,target_action text,target_reason text default null,target_role text default null,target_classroom_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
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
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,before_data,after_data) values(auth.uid(),public.current_role()::text,application.garden_id,'staff_job_applications',application.id,'staff_application_'||target_action,jsonb_build_object('status',previous_status),jsonb_build_object('status',next_status));
  insert into public.notifications(garden_id,recipient_id,recipient_profile_id,recipient_role,title,body,message,entity_type,entity_id,severity,action_url,kindergarten_id,created_by)
  values(application.garden_id,application.staff_candidate_id,application.staff_candidate_id,'staff','המועמדות עודכנה',coalesce(nullif(btrim(target_reason),''),'סטטוס המועמדות שלך עודכן.'),coalesce(nullif(btrim(target_reason),''),'סטטוס המועמדות שלך עודכן.'),'staff_job_applications',application.id,'low','/dashboard/staff/job-market',application.garden_id,auth.uid());
  return to_jsonb(application);
end $$;

create or replace function public.respond_staff_job_application(target_application_id uuid,target_action text,target_response text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare application public.staff_job_applications; now_at timestamptz:=now();
begin
  select * into application from public.staff_job_applications where id=target_application_id and staff_candidate_id=auth.uid() for update;
  if application.id is null then raise exception 'staff_application_not_found' using errcode='P0002'; end if;
  if target_action='respond' and application.status='information_required' then update public.staff_job_applications set status='resubmitted',candidate_response=nullif(btrim(target_response),''),updated_at=now_at where id=application.id returning * into application;
  elsif target_action='withdraw' and application.status in ('draft','submitted','under_review','information_required','resubmitted','approved','awaiting_candidate_acceptance') then update public.staff_job_applications set status='withdrawn',withdrawn_at=now_at,updated_at=now_at where id=application.id returning * into application;
  else raise exception 'staff_application_transition_invalid' using errcode='23514'; end if;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data) values(auth.uid(),'staff',application.garden_id,'staff_job_applications',application.id,'staff_application_'||target_action,jsonb_build_object('status',application.status));
  return to_jsonb(application);
end $$;

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
  if actor_profile.id is null or (actor_profile.contact_verification_required and (actor_profile.email_verified_at is null or actor_profile.phone_verified_at is null)) then raise exception 'staff_contact_verification_required' using errcode='23514'; end if;
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

drop policy if exists "staff applications scoped read" on public.staff_job_applications;
drop policy if exists "staff applications candidate insert" on public.staff_job_applications;
drop policy if exists "staff applications scoped update" on public.staff_job_applications;
create policy "staff applications manager or candidate read update" on public.staff_job_applications for select using (public.is_admin() or staff_candidate_id=auth.uid() or public.can_manage_garden(garden_id));
create policy "staff applications candidate controlled update" on public.staff_job_applications for update using (staff_candidate_id=auth.uid()) with check (staff_candidate_id=auth.uid());
create policy "staff applications manager controlled update" on public.staff_job_applications for update using (public.is_admin() or public.can_manage_garden(garden_id)) with check (public.is_admin() or public.can_manage_garden(garden_id));

revoke insert,update,delete on public.staff_job_applications from authenticated;
grant select on public.staff_job_applications to authenticated;

revoke all on function public.submit_staff_job_application(uuid,text),public.decide_staff_job_application(uuid,text,text,text,uuid),public.respond_staff_job_application(uuid,text,text),public.activate_staff_employment(uuid,uuid) from public,anon;
grant execute on function public.submit_staff_job_application(uuid,text),public.decide_staff_job_application(uuid,text,text,text,uuid),public.respond_staff_job_application(uuid,text,text),public.activate_staff_employment(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
