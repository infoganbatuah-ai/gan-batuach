-- GB-M33: a Child's daily attendance and confirmed release are one guarded
-- Management transaction. Existing attendance, contact and event rows remain.
alter table public.gardens add column if not exists operational_timezone text not null default 'Asia/Jerusalem';
alter table public.attendance
  add column if not exists enrollment_id uuid references public.child_kindergarten_enrollments(id) on delete set null,
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null,
  add column if not exists arrival_recorded_by uuid references public.profiles(id) on delete set null,
  add column if not exists departure_recorded_by uuid references public.profiles(id) on delete set null;
alter table public.child_pickup_events
  add column if not exists attendance_id uuid references public.attendance(id) on delete set null,
  add column if not exists release_confirmed boolean not null default false,
  add column if not exists authorization_snapshot jsonb not null default '{}'::jsonb;
alter table public.attendance_compliance_audit_trail
  drop constraint if exists attendance_audit_action_check;
alter table public.attendance_compliance_audit_trail
  add constraint attendance_audit_action_check check (action in
    ('check_in_requested','check_in_completed','check_out_requested','check_out_completed',
     'absence_recorded','attendance_corrected','pickup_blocked',
     'pickup_authorization_created','pickup_authorization_revoked',
     'temporary_authorization_created','emergency_pickup_approved','manual_override',
     'signature_recorded','gps_validated'));

-- Fail closed on ambiguous historical duplicate days rather than guessing
-- which arrival/departure to preserve. The release preflight audits this.
create unique index if not exists attendance_one_child_garden_day
  on public.attendance(garden_id,child_id,attendance_date) where child_id is not null;
create unique index if not exists pickup_one_confirmed_release_per_attendance
  on public.child_pickup_events(attendance_id) where release_confirmed and attendance_id is not null;
create index if not exists attendance_garden_day_classroom_idx
  on public.attendance(garden_id,attendance_date,classroom_id) where child_id is not null;

create or replace function public.management_can_record_child_attendance(p_garden_id uuid,p_child_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(
    select 1 from public.profiles p join public.gardens g on g.id=p_garden_id
    where p.id=auth.uid() and p.active and g.status::text='active'
      and (
        (p.role::text in ('owner','manager') and exists(
          select 1 from public.garden_management_memberships m
          where m.profile_id=p.id and m.garden_id=p_garden_id and m.status='active'
            and m.relationship_role in ('owner','manager')))
        or (p.role::text='staff' and public.can_staff_access_garden(p_garden_id)
          and exists(
            select 1 from public.child_classroom_assignments ca
            join public.staff_classroom_assignments sa
              on sa.classroom_id=ca.classroom_id and sa.garden_id=ca.garden_id and sa.status='active'
                and sa.responsibility in ('staff','lead_teacher','assistant')
            join public.staff s on s.id=sa.staff_id and s.profile_id=p.id and s.garden_id=p_garden_id
            join public.staff_kindergarten_employments e
              on e.staff_id=s.id and e.profile_id=p.id and e.garden_id=p_garden_id and e.status='active'
            where ca.child_id=p_child_id and ca.garden_id=p_garden_id and ca.is_current
              and (e.start_date is null or e.start_date<=current_date)
              and (e.end_date is null or e.end_date>=current_date))))
      )
$$;
revoke all on function public.management_can_record_child_attendance(uuid,uuid) from public,anon;
grant execute on function public.management_can_record_child_attendance(uuid,uuid) to authenticated;

create or replace function public.management_child_arrival(p_garden_id uuid,p_child_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.gardens; c public.children; e public.child_kindergarten_enrollments;
  a public.attendance; room_id uuid; local_day date; at_time timestamptz:=clock_timestamp();
begin
  if auth.uid() is null or not public.management_can_record_child_attendance(p_garden_id,p_child_id)
    then raise exception 'attendance_actor_denied' using errcode='42501'; end if;
  select * into g from public.gardens where id=p_garden_id;
  if not exists(select 1 from pg_timezone_names where name=g.operational_timezone)
    then raise exception 'garden_timezone_invalid' using errcode='22023'; end if;
  local_day:=(at_time at time zone g.operational_timezone)::date;
  -- Child lock serializes arrival with release; the unique index covers retries.
  select * into c from public.children where id=p_child_id and garden_id=p_garden_id for update;
  if c.id is null then raise exception 'attendance_child_denied' using errcode='42501'; end if;
  select * into e from public.child_kindergarten_enrollments
   where child_id=p_child_id and garden_id=p_garden_id and status='active'
     and (start_date is null or start_date<=local_day)
     and (end_date is null or end_date>=local_day) order by created_at desc limit 1;
  if e.id is null then raise exception 'attendance_enrollment_required' using errcode='42501'; end if;
  select classroom_id into room_id from public.child_classroom_assignments
   where child_id=p_child_id and garden_id=p_garden_id and is_current limit 1;
  select * into a from public.attendance
   where child_id=p_child_id and garden_id=p_garden_id and attendance_date=local_day for update;
  if a.id is not null then
    if a.check_out_at is not null or a.status in ('absent','sick')
      then raise exception 'attendance_correction_required' using errcode='23514'; end if;
    if a.check_in_at is not null then return jsonb_build_object('attendance_id',a.id,'status','present','idempotent',true); end if;
    update public.attendance set status='present',check_in_at=at_time,arrival_recorded_by=auth.uid(),
      enrollment_id=e.id,classroom_id=room_id,updated_by=auth.uid(),updated_at=at_time,
      legal_attendance_method='staff_recorded',camera_based_attendance_used=false,
      biometric_identification_used=false where id=a.id returning * into a;
  else
    insert into public.attendance(garden_id,child_id,attendance_date,status,check_in_at,
      enrollment_id,classroom_id,arrival_recorded_by,updated_by,legal_attendance_method,
      camera_based_attendance_used,biometric_identification_used)
    values(p_garden_id,p_child_id,local_day,'present',at_time,e.id,room_id,auth.uid(),auth.uid(),
      'staff_recorded',false,false) returning * into a;
  end if;
  insert into public.attendance_compliance_audit_trail
    (attendance_id,child_id,garden_id,actor_profile_id,action,status,metadata)
    values(a.id,p_child_id,p_garden_id,auth.uid(),'check_in_completed','success',
      jsonb_build_object('source','gb_m33','date',local_day,'classroom_id',room_id));
  insert into public.notifications(garden_id,recipient_id,recipient_role,title,body,
    entity_type,entity_id,notification_type,preference_category,dedupe_key,metadata)
    select p_garden_id,l.guardian_profile_id,'parent','עדכון נוכחות','נרשמה הגעה לגן',
      'attendance',a.id,'child_arrival','system','attendance:'||a.id::text||':arrival',
      jsonb_build_object('child_id',p_child_id)
    from public.child_guardian_links l join public.profiles p on p.id=l.guardian_profile_id and p.active
    where l.permanent_child_file_id=c.permanent_child_file_id and l.status='active' and l.legal_authority
      and (l.valid_until is null or l.valid_until>at_time)
    on conflict do nothing;
  return jsonb_build_object('attendance_id',a.id,'status','present','check_in_at',a.check_in_at,'idempotent',false);
end $$;
revoke all on function public.management_child_arrival(uuid,uuid) from public,anon;
grant execute on function public.management_child_arrival(uuid,uuid) to authenticated;

create or replace function public.management_child_absence(
  p_garden_id uuid,p_child_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.gardens; c public.children; e public.child_kindergarten_enrollments;
  a public.attendance; room_id uuid; local_day date; previous_state jsonb;
begin
  if auth.uid() is null or not public.management_can_record_child_attendance(p_garden_id,p_child_id)
    then raise exception 'attendance_actor_denied' using errcode='42501'; end if;
  if p_action not in ('mark_absent','correct_to_present')
    then raise exception 'attendance_action_invalid' using errcode='22023'; end if;
  if p_action='correct_to_present' and length(btrim(coalesce(p_reason,'')))<10
    then raise exception 'attendance_correction_reason_required' using errcode='22023'; end if;
  select * into g from public.gardens where id=p_garden_id;
  if not exists(select 1 from pg_timezone_names where name=g.operational_timezone)
    then raise exception 'garden_timezone_invalid' using errcode='22023'; end if;
  local_day:=(now() at time zone g.operational_timezone)::date;
  select * into c from public.children where id=p_child_id and garden_id=p_garden_id for update;
  if c.id is null then raise exception 'attendance_child_denied' using errcode='42501'; end if;
  select * into e from public.child_kindergarten_enrollments
    where child_id=p_child_id and garden_id=p_garden_id and status='active'
      and (start_date is null or start_date<=local_day)
      and (end_date is null or end_date>=local_day) order by created_at desc limit 1;
  if e.id is null then raise exception 'attendance_enrollment_required' using errcode='42501'; end if;
  select classroom_id into room_id from public.child_classroom_assignments
    where child_id=p_child_id and garden_id=p_garden_id and is_current limit 1;
  select * into a from public.attendance
    where garden_id=p_garden_id and child_id=p_child_id and attendance_date=local_day for update;
  previous_state:=jsonb_build_object('status',a.status,'check_in_at',a.check_in_at,'check_out_at',a.check_out_at);
  if p_action='mark_absent' then
    if a.id is not null then
      if a.status='absent' then return jsonb_build_object('attendance_id',a.id,'status','absent','idempotent',true); end if;
      raise exception 'attendance_correction_required' using errcode='23514';
    end if;
    insert into public.attendance(garden_id,child_id,attendance_date,status,enrollment_id,
      classroom_id,updated_by,legal_attendance_method,biometric_identification_used,camera_based_attendance_used)
    values(p_garden_id,p_child_id,local_day,'absent',e.id,room_id,auth.uid(),
      'staff_recorded',false,false) returning * into a;
  else
    if a.id is null or a.status not in ('absent','sick') or a.check_out_at is not null
      then raise exception 'attendance_correction_denied' using errcode='23514'; end if;
    update public.attendance set status='present',check_in_at=clock_timestamp(),
      arrival_recorded_by=auth.uid(),updated_by=auth.uid(),updated_at=now(),
      note=left(p_reason,500),legal_attendance_method='staff_recorded'
      where id=a.id returning * into a;
  end if;
  insert into public.attendance_compliance_audit_trail
    (attendance_id,child_id,garden_id,actor_profile_id,action,status,metadata)
    values(a.id,p_child_id,p_garden_id,auth.uid(),
      case when p_action='mark_absent' then 'absence_recorded' else 'attendance_corrected' end,
      'success',jsonb_build_object('source','gb_m33','previous',previous_state,
        'current',jsonb_build_object('status',a.status,'check_in_at',a.check_in_at),
        'reason',left(p_reason,500)));
  return jsonb_build_object('attendance_id',a.id,'status',a.status,'idempotent',false);
end $$;
revoke all on function public.management_child_absence(uuid,uuid,text,text) from public,anon;
grant execute on function public.management_child_absence(uuid,uuid,text,text) to authenticated;

create or replace function public.management_child_release(
  p_garden_id uuid,p_child_id uuid,p_pickup_contact_id uuid default null,p_guardian_profile_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.gardens; c public.children; e public.child_kindergarten_enrollments;
  a public.attendance; contact public.authorized_pickup_contacts;
  pickup_auth public.pickup_authorizations; pickup_event public.child_pickup_events;
  picker_name text; picker_kind text; local_day date; at_time timestamptz:=clock_timestamp();
begin
  if auth.uid() is null or not public.management_can_record_child_attendance(p_garden_id,p_child_id)
    then raise exception 'release_actor_denied' using errcode='42501'; end if;
  if (p_pickup_contact_id is null)=(p_guardian_profile_id is null)
    then raise exception 'one_pickup_identity_required' using errcode='22023'; end if;
  select * into g from public.gardens where id=p_garden_id;
  if not exists(select 1 from pg_timezone_names where name=g.operational_timezone)
    then raise exception 'garden_timezone_invalid' using errcode='22023'; end if;
  local_day:=(at_time at time zone g.operational_timezone)::date;
  select * into c from public.children where id=p_child_id and garden_id=p_garden_id for update;
  if c.id is null then raise exception 'release_child_denied' using errcode='42501'; end if;
  select * into e from public.child_kindergarten_enrollments
   where child_id=p_child_id and garden_id=p_garden_id and status='active'
     and (start_date is null or start_date<=local_day)
     and (end_date is null or end_date>=local_day) order by created_at desc limit 1;
  if e.id is null then raise exception 'release_enrollment_required' using errcode='42501'; end if;
  select * into a from public.attendance
   where child_id=p_child_id and garden_id=p_garden_id and attendance_date=local_day for update;
  if a.id is null or a.check_in_at is null then raise exception 'release_arrival_required' using errcode='23514'; end if;
  if a.check_out_at is not null then
    select * into pickup_event from public.child_pickup_events
      where attendance_id=a.id and release_confirmed limit 1;
    return jsonb_build_object('attendance_id',a.id,'pickup_event_id',pickup_event.id,
      'status','departed','idempotent',true);
  end if;
  if p_pickup_contact_id is not null then
    -- Revoke and release both acquire this row lock. A committed revocation
    -- before this read is always observed, including under concurrent requests.
    select * into contact from public.authorized_pickup_contacts
      where id=p_pickup_contact_id and child_id=p_child_id and kindergarten_id=p_garden_id for update;
    if contact.id is null or not contact.active or contact.authorization_status<>'approved'
      or (contact.valid_from is not null and contact.valid_from>at_time)
      or (contact.valid_until is not null and contact.valid_until<=at_time)
      then raise exception 'pickup_authorization_denied' using errcode='42501'; end if;
    select * into pickup_auth from public.pickup_authorizations
      where pickup_contact_id=contact.id and child_id=p_child_id and garden_id=p_garden_id
        and status='approved' and (valid_from is null or valid_from<=at_time)
        and (valid_until is null or valid_until>at_time)
      order by created_at desc limit 1 for update;
    if pickup_auth.id is null then raise exception 'pickup_authorization_denied' using errcode='42501'; end if;
    picker_name:=contact.full_name; picker_kind:=contact.authorization_type;
  else
    if not exists(
      select 1 from public.child_guardian_links l
      where l.permanent_child_file_id=c.permanent_child_file_id
        and l.guardian_profile_id=p_guardian_profile_id and l.status='active'
        and l.legal_authority and (l.valid_until is null or l.valid_until>at_time))
      then raise exception 'pickup_guardian_denied' using errcode='42501'; end if;
    select full_name into picker_name from public.profiles where id=p_guardian_profile_id and active;
    if picker_name is null then raise exception 'pickup_guardian_denied' using errcode='42501'; end if;
    picker_kind:='permanent';
  end if;
  insert into public.child_pickup_events(child_id,kindergarten_id,attendance_id,
    pickup_contact_id,authorized_adult_id,pickup_authorization_id,pickup_person,
    authorization_type,pickup_time,status,verified_by,legal_release_status,
    identity_verification_status,release_confirmed,authorization_snapshot,
    face_match_status,biometric_identification_used,camera_based_release_used,metadata)
  values(p_child_id,p_garden_id,a.id,contact.id,contact.authorized_adult_id,pickup_auth.id,
    picker_name,picker_kind,at_time,'verified_by_staff',auth.uid(),'completed',
    'manager_verified',true,jsonb_build_object('kind',case when contact.id is null then 'guardian' else 'contact' end,
      'contact_id',contact.id,'guardian_profile_id',p_guardian_profile_id,
      'authorization_id',pickup_auth.id,'valid_at',at_time),
    'not_run',false,false,jsonb_build_object('source','gb_m33','human_confirmed',true))
  returning * into pickup_event;
  update public.attendance set status='left_early',check_out_at=at_time,
    departure_recorded_by=auth.uid(),updated_by=auth.uid(),updated_at=at_time,
    pickup_name=picker_name,pickup_authorized=true,
    camera_based_attendance_used=false,biometric_identification_used=false
    where id=a.id;
  insert into public.attendance_compliance_audit_trail
    (attendance_id,pickup_event_id,child_id,garden_id,actor_profile_id,action,status,metadata)
    values(a.id,pickup_event.id,p_child_id,p_garden_id,auth.uid(),'check_out_completed','success',
      jsonb_build_object('source','gb_m33','authorization_id',pickup_auth.id));
  insert into public.notifications(garden_id,recipient_id,recipient_role,title,body,
    entity_type,entity_id,notification_type,preference_category,dedupe_key,metadata)
    select p_garden_id,l.guardian_profile_id,'parent','עדכון איסוף','נרשם שחרור מהגן',
      'child_pickup_event',pickup_event.id,'child_released','system',
      'pickup:'||pickup_event.id::text||':released',jsonb_build_object('child_id',p_child_id)
    from public.child_guardian_links l join public.profiles p on p.id=l.guardian_profile_id and p.active
    where l.permanent_child_file_id=c.permanent_child_file_id and l.status='active' and l.legal_authority
      and (l.valid_until is null or l.valid_until>at_time)
    on conflict do nothing;
  return jsonb_build_object('attendance_id',a.id,'pickup_event_id',pickup_event.id,
    'status','departed','check_out_at',at_time,'idempotent',false);
end $$;
revoke all on function public.management_child_release(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.management_child_release(uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.management_add_pickup_contact(
  p_child_id uuid,p_full_name text,p_relation text,p_phone text default null,
  p_valid_from timestamptz default null,p_valid_until timestamptz default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.children; contact public.authorized_pickup_contacts;
  adult_id uuid; authorization_id uuid; local_day date;
begin
  if auth.uid() is null or length(btrim(coalesce(p_full_name,''))) not between 2 and 120
    or p_relation not in ('mother','father','parent','second_parent','grandparent','sibling',
      'babysitter','nanny','guardian','approved_pickup_contact','emergency_contact','other')
    then raise exception 'pickup_contact_invalid' using errcode='22023'; end if;
  select * into c from public.children where id=p_child_id for update;
  if c.id is null or not public.can_guardian_access_child(c.permanent_child_file_id,'profile')
    then raise exception 'pickup_contact_denied' using errcode='42501'; end if;
  local_day:=(now() at time zone (select operational_timezone from public.gardens where id=c.garden_id))::date;
  if not exists(select 1 from public.child_kindergarten_enrollments e
      where e.child_id=c.id and e.garden_id=c.garden_id and e.status='active'
        and (e.start_date is null or e.start_date<=local_day)
        and (e.end_date is null or e.end_date>=local_day))
    then raise exception 'pickup_active_enrollment_required' using errcode='42501'; end if;
  if p_valid_until is not null and (p_valid_until<=now() or
      (p_valid_from is not null and p_valid_until<=p_valid_from))
    then raise exception 'pickup_validity_invalid' using errcode='22023'; end if;
  insert into public.authorized_pickup_contacts
    (child_id,kindergarten_id,created_by,full_name,relation,phone,authorization_type,
     valid_from,valid_until,notes,active,identity_verification_status,
     authorization_status,legal_identity_method,biometric_identification_used,
     camera_based_authorization_used,metadata)
  values(c.id,c.garden_id,auth.uid(),btrim(p_full_name),p_relation,
    nullif(btrim(coalesce(p_phone,'')),''),
    case when p_valid_until is null then 'permanent' else 'temporary' end,
    p_valid_from,p_valid_until,left(p_notes,500),true,'pending','approved',
    'parent_declared',false,false,'{"source":"gb_m33","human_review_required":true}'::jsonb)
  returning * into contact;
  insert into public.authorized_adults
    (garden_id,child_id,parent_profile_id,source_pickup_contact_id,full_name,phone,
     relationship,identity_verification_status,authorization_status,authorization_scope,
     created_by,expires_at,biometric_identification_allowed,camera_based_identification_allowed,
     metadata)
  values(c.garden_id,c.id,auth.uid(),contact.id,contact.full_name,contact.phone,
    case when p_valid_until is not null then 'temporary'
      when p_relation in ('second_parent','sibling','nanny') then 'other'
      else p_relation end,'pending','approved','pickup',auth.uid(),p_valid_until,false,false,
    '{"source":"gb_m33"}'::jsonb)
  returning id into adult_id;
  update public.authorized_pickup_contacts set authorized_adult_id=adult_id where id=contact.id;
  insert into public.pickup_authorizations
    (child_id,garden_id,authorized_adult_id,pickup_contact_id,authorization_type,
     status,created_by,valid_from,valid_until,approval_method,metadata)
  values(c.id,c.garden_id,adult_id,contact.id,
    case when p_valid_until is null then 'permanent' else 'temporary' end,
    'approved',auth.uid(),p_valid_from,p_valid_until,'parent_request',
    '{"source":"gb_m33"}'::jsonb)
  returning id into authorization_id;
  insert into public.attendance_compliance_audit_trail
    (child_id,garden_id,authorized_adult_id,actor_profile_id,action,status,metadata)
  values(c.id,c.garden_id,adult_id,auth.uid(),
    case when p_valid_until is null then 'pickup_authorization_created'
      else 'temporary_authorization_created' end,'success',
    jsonb_build_object('source','gb_m33','contact_id',contact.id,'authorization_id',authorization_id));
  insert into public.notifications(garden_id,recipient_id,recipient_role,title,body,
    entity_type,entity_id,notification_type,preference_category,dedupe_key)
    select c.garden_id,m.profile_id,p.role,'עדכון הרשאת איסוף','נוספה הרשאת איסוף חדשה',
      'authorized_pickup_contact',contact.id,'pickup_authorization_added','system',
      'pickup-contact:'||contact.id::text||':added'
    from public.garden_management_memberships m join public.profiles p on p.id=m.profile_id and p.active
    where m.garden_id=c.garden_id and m.status='active' and m.relationship_role in ('owner','manager')
    on conflict do nothing;
  return jsonb_build_object('id',contact.id,'child_id',c.id,'kindergarten_id',c.garden_id,
    'full_name',contact.full_name,'relation',contact.relation,'phone',contact.phone,
    'authorization_type',contact.authorization_type,'valid_from',contact.valid_from,
    'valid_until',contact.valid_until,'active',true);
end $$;
revoke all on function public.management_add_pickup_contact(uuid,text,text,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.management_add_pickup_contact(uuid,text,text,text,timestamptz,timestamptz,text) to authenticated;

create or replace function public.management_revoke_pickup_contact(p_contact_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare contact public.authorized_pickup_contacts; c public.children;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into contact from public.authorized_pickup_contacts where id=p_contact_id for update;
  if contact.id is null then raise exception 'pickup_contact_denied' using errcode='42501'; end if;
  select * into c from public.children where id=contact.child_id and garden_id=contact.kindergarten_id;
  if c.id is null or not public.can_guardian_access_child(c.permanent_child_file_id,'profile')
    then raise exception 'pickup_contact_denied' using errcode='42501'; end if;
  if not contact.active then return jsonb_build_object('id',contact.id,'active',false,'idempotent',true); end if;
  update public.authorized_pickup_contacts set active=false,authorization_status='revoked',updated_at=now()
    where id=contact.id;
  update public.pickup_authorizations set status='revoked',updated_at=now()
    where pickup_contact_id=contact.id and status='approved';
  update public.authorized_adults set authorization_status='revoked',updated_at=now()
    where source_pickup_contact_id=contact.id and authorization_status='approved';
  insert into public.attendance_compliance_audit_trail
    (child_id,garden_id,authorized_adult_id,actor_profile_id,action,status,metadata)
    values(contact.child_id,contact.kindergarten_id,contact.authorized_adult_id,
      auth.uid(),'pickup_authorization_revoked','success',
      jsonb_build_object('source','gb_m33','operation','revoked','contact_id',contact.id));
  insert into public.notifications(garden_id,recipient_id,recipient_role,title,body,
    entity_type,entity_id,notification_type,preference_category,dedupe_key)
    select contact.kindergarten_id,m.profile_id,p.role,'עדכון הרשאת איסוף','הרשאת איסוף בוטלה',
      'authorized_pickup_contact',contact.id,'pickup_authorization_revoked','system',
      'pickup-contact:'||contact.id::text||':revoked'
    from public.garden_management_memberships m join public.profiles p on p.id=m.profile_id and p.active
    where m.garden_id=contact.kindergarten_id and m.status='active' and m.relationship_role in ('owner','manager')
    on conflict do nothing;
  return jsonb_build_object('id',contact.id,'active',false,'idempotent',false);
end $$;
revoke all on function public.management_revoke_pickup_contact(uuid) from public,anon;
grant execute on function public.management_revoke_pickup_contact(uuid) to authenticated;

-- The reviewed RPCs own operational mutations. Legacy generic table routes
-- cannot claim arrival or release by directly editing rows.
revoke insert,update,delete on public.attendance from public,authenticated;
revoke insert,update,delete on public.child_pickup_events from public,authenticated;
revoke update,delete on public.authorized_pickup_contacts from public,authenticated;
revoke insert on public.authorized_pickup_contacts from public,authenticated;
revoke insert,update,delete on public.authorized_adults from public,authenticated;
revoke insert,update,delete on public.pickup_authorizations from public,authenticated;
revoke insert,update,delete on public.attendance_compliance_audit_trail from public,authenticated;

do $$ declare pol record; begin
  for pol in select policyname from pg_policies where schemaname='public' and tablename='attendance' loop
    execute format('drop policy %I on public.attendance',pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname='public' and tablename='child_pickup_events' loop
    execute format('drop policy %I on public.child_pickup_events',pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname='public' and tablename='authorized_pickup_contacts' loop
    execute format('drop policy %I on public.authorized_pickup_contacts',pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname='public' and tablename='authorized_adults' loop
    execute format('drop policy %I on public.authorized_adults',pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname='public' and tablename='pickup_authorizations' loop
    execute format('drop policy %I on public.pickup_authorizations',pol.policyname);
  end loop;
  for pol in select policyname from pg_policies where schemaname='public' and tablename='attendance_compliance_audit_trail' loop
    execute format('drop policy %I on public.attendance_compliance_audit_trail',pol.policyname);
  end loop;
end $$;
create or replace function public.management_can_guardian_read_child(p_child_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.children c
    where c.id=p_child_id
      and public.can_guardian_access_child(c.permanent_child_file_id,'profile')
  )
$$;
revoke all on function public.management_can_guardian_read_child(uuid) from public,anon;
grant execute on function public.management_can_guardian_read_child(uuid) to authenticated;
create or replace function public.management_can_read_staff_attendance(p_garden_id uuid,p_staff_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    exists(select 1 from public.staff s where s.id=p_staff_id and s.profile_id=auth.uid()
      and s.garden_id=p_garden_id)
    or exists(select 1 from public.garden_management_memberships m
      join public.profiles p on p.id=m.profile_id
      where m.garden_id=p_garden_id and m.profile_id=auth.uid() and m.status='active'
        and m.relationship_role in ('owner','manager') and p.active
        and p.role::text in ('owner','manager'))
  )
$$;
revoke all on function public.management_can_read_staff_attendance(uuid,uuid) from public,anon;
grant execute on function public.management_can_read_staff_attendance(uuid,uuid) to authenticated;
create policy management_child_attendance_read on public.attendance for select to authenticated using (
  (child_id is not null and (public.management_can_guardian_read_child(child_id)
    or public.management_can_record_child_attendance(garden_id,child_id)))
  or (staff_id is not null and public.management_can_read_staff_attendance(garden_id,staff_id))
);
create policy management_child_pickup_event_read on public.child_pickup_events for select to authenticated using (
  public.management_can_guardian_read_child(child_id)
  or public.management_can_record_child_attendance(kindergarten_id,child_id)
);
create policy management_pickup_contact_read on public.authorized_pickup_contacts for select to authenticated using (
  public.management_can_guardian_read_child(child_id)
  or public.management_can_record_child_attendance(kindergarten_id,child_id)
);
create policy management_authorized_adult_read on public.authorized_adults for select to authenticated using (
  public.management_can_guardian_read_child(child_id)
  or public.management_can_record_child_attendance(garden_id,child_id)
);
create policy management_pickup_authorization_read on public.pickup_authorizations for select to authenticated using (
  public.management_can_guardian_read_child(child_id)
  or public.management_can_record_child_attendance(garden_id,child_id)
);
create policy management_attendance_audit_read on public.attendance_compliance_audit_trail for select to authenticated using (
  public.management_can_guardian_read_child(child_id)
  or public.management_can_record_child_attendance(garden_id,child_id)
);
