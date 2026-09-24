-- GB-M29: canonical, participant-scoped Management messaging.
-- Messages are conversations; they never change complaint, task or notification state.

alter table public.communication_threads
  add column if not exists classroom_id uuid references public.classrooms(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

alter table public.communication_thread_participants
  add column if not exists left_at timestamptz,
  add column if not exists last_read_message_id uuid;

alter table public.messages
  add column if not exists idempotency_key uuid,
  add column if not exists message_kind text not null default 'human',
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

alter table public.communication_threads
  drop constraint if exists communication_thread_type_check;
alter table public.communication_threads
  add constraint communication_thread_type_check check (thread_type in (
    'parent_kindergarten','parent_manager','staff_manager','inspector_kindergarten',
    'admin_user','complaint','inspection','document_request','emergency','general',
    'parent_garden','parent_staff','staff_internal','garden_broadcast',
    'classroom_broadcast','staff_broadcast','system_context'
  ));
alter table public.messages
  add constraint messages_message_kind_check check (message_kind in ('human','system'));

create unique index if not exists messages_sender_idempotency_key_unique
  on public.messages(sender_id, idempotency_key) where idempotency_key is not null;
create index if not exists communication_threads_garden_classroom_idx
  on public.communication_threads(garden_id, classroom_id, status, last_message_at desc);
create index if not exists communication_participants_unread_idx
  on public.communication_thread_participants(profile_id, last_read_at, thread_id)
  where left_at is null;
create index if not exists messages_thread_created_live_idx
  on public.messages(thread_id, created_at desc) where deleted_at is null;

-- Membership is only a delivery/read record. It is never by itself an authority
-- grant: the actor must still hold the current parent, employment or management
-- relationship for the thread's Garden.
create or replace function public.can_access_management_communication_thread(p_thread_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_thread_id is not null and exists (
    select 1
    from public.communication_threads t
    join public.communication_thread_participants participant
      on participant.thread_id=t.id and participant.profile_id=auth.uid()
      and participant.left_at is null
    join public.profiles actor on actor.id=auth.uid() and actor.active
    where t.id=p_thread_id
      and (
        (actor.role::text='parent' and exists (
          select 1 from public.children child
          join public.child_kindergarten_enrollments enrollment
            on enrollment.child_id=child.id and enrollment.garden_id=t.garden_id
            and enrollment.status='active'
          where (t.child_id is null or child.id=t.child_id)
            and public.can_guardian_access_child(child.permanent_child_file_id, 'education')
        ))
        or ((actor.role::text in ('manager','owner')) and public.can_manage_garden(t.garden_id))
        or (actor.role::text='staff' and public.can_staff_access_garden(t.garden_id) and (
          t.thread_type <> 'parent_staff' or exists (
            select 1 from public.child_classroom_assignments child_assignment
            join public.staff staff_row on staff_row.profile_id=auth.uid() and staff_row.garden_id=t.garden_id
            join public.staff_classroom_assignments staff_assignment
              on staff_assignment.staff_id=staff_row.id
              and staff_assignment.classroom_id=child_assignment.classroom_id
              and staff_assignment.garden_id=t.garden_id and staff_assignment.status='active'
            where child_assignment.child_id=t.child_id and child_assignment.garden_id=t.garden_id
              and child_assignment.is_current
          )
        ))
      )
  );
$$;

-- Direct communication is created only through this authority-bearing RPC. The
-- Garden/child relation is resolved and rechecked here, not trusted from a card.
create or replace function public.create_management_communication_thread(
  p_garden_id uuid,
  p_recipient_id uuid,
  p_child_id uuid,
  p_subject text,
  p_body text,
  p_idempotency_key uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  actor public.profiles;
  recipient public.profiles;
  child_row public.children;
  garden uuid;
  thread_kind text;
  thread_row public.communication_threads;
  message_row public.messages;
  target_is_staff boolean := false;
  target_is_manager boolean := false;
begin
  select * into actor from public.profiles where id=auth.uid() and active=true;
  if actor.id is null or actor.role::text not in ('parent','manager','owner','staff') then
    raise exception 'communication_actor_denied' using errcode='42501';
  end if;
  select * into recipient from public.profiles where id=p_recipient_id and active=true;
  if recipient.id is null or recipient.id=actor.id then raise exception 'communication_recipient_invalid' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_subject,'')),'') is null or nullif(btrim(coalesce(p_body,'')),'') is null then
    raise exception 'communication_content_required' using errcode='23514';
  end if;
  if p_idempotency_key is not null then
    select m.* into message_row from public.messages m where m.sender_id=actor.id and m.idempotency_key=p_idempotency_key limit 1;
    if message_row.id is not null then
      return jsonb_build_object('thread_id',message_row.thread_id,'message_id',message_row.id,'idempotent',true);
    end if;
  end if;
  if p_child_id is not null then select * into child_row from public.children where id=p_child_id; end if;

  if actor.role::text='parent' then
    if child_row.id is null or child_row.permanent_child_file_id is null then raise exception 'communication_child_required' using errcode='42501'; end if;
    select enrollment.garden_id into garden from public.child_kindergarten_enrollments enrollment
      where enrollment.child_id=child_row.id and enrollment.status='active' order by enrollment.created_at desc limit 1;
    if garden is null or not public.can_guardian_access_child(child_row.permanent_child_file_id,'education') then
      raise exception 'communication_child_denied' using errcode='42501';
    end if;
    target_is_manager := exists(select 1 from public.gardens g where g.id=garden and (g.manager_id=recipient.id or g.owner_profile_id=recipient.id));
    target_is_staff := exists(select 1 from public.staff_kindergarten_employments e join public.staff s on s.id=e.staff_id and s.profile_id=e.profile_id and s.garden_id=e.garden_id where e.profile_id=recipient.id and e.garden_id=garden and e.status='active' and s.approved_to_work and s.onboarding_status='active');
    if not target_is_manager and not target_is_staff then raise exception 'communication_recipient_denied' using errcode='42501'; end if;
    thread_kind := case when target_is_staff then 'parent_staff' else 'parent_garden' end;
  elsif actor.role::text in ('manager','owner') then
    garden := p_garden_id;
    if garden is null or not public.can_manage_garden(garden) or (child_row.id is not null and child_row.garden_id is distinct from garden) then raise exception 'communication_garden_denied' using errcode='42501'; end if;
    target_is_staff := exists(select 1 from public.staff_kindergarten_employments e join public.staff s on s.id=e.staff_id and s.profile_id=e.profile_id and s.garden_id=e.garden_id where e.profile_id=recipient.id and e.garden_id=garden and e.status='active' and s.approved_to_work and s.onboarding_status='active');
    if target_is_staff then thread_kind := 'staff_internal';
    elsif child_row.id is not null and exists(select 1 from public.child_kindergarten_enrollments e where e.child_id=child_row.id and e.garden_id=garden and e.status='active') and recipient.role::text='parent' and exists(select 1 from public.child_guardian_links l where l.permanent_child_file_id=child_row.permanent_child_file_id and l.guardian_profile_id=recipient.id and l.status='active' and l.legal_authority) then thread_kind := 'parent_garden';
    else raise exception 'communication_recipient_denied' using errcode='42501'; end if;
  else
    garden := p_garden_id;
    if garden is null or not public.can_staff_access_garden(garden) or (child_row.id is not null and child_row.garden_id is distinct from garden) then raise exception 'communication_garden_denied' using errcode='42501'; end if;
    target_is_manager := exists(select 1 from public.gardens g where g.id=garden and (g.manager_id=recipient.id or g.owner_profile_id=recipient.id));
    target_is_staff := exists(select 1 from public.staff_kindergarten_employments e join public.staff s on s.id=e.staff_id and s.profile_id=e.profile_id and s.garden_id=e.garden_id where e.profile_id=recipient.id and e.garden_id=garden and e.status='active' and s.approved_to_work and s.onboarding_status='active');
    if target_is_manager then thread_kind := 'staff_internal';
    elsif target_is_staff then thread_kind := 'staff_internal';
    elsif child_row.id is not null and recipient.role::text='parent' and exists(
      select 1 from public.child_guardian_links l join public.child_classroom_assignments ca on ca.child_id=child_row.id and ca.garden_id=garden and ca.is_current
      join public.staff s on s.profile_id=actor.id and s.garden_id=garden
      join public.staff_classroom_assignments sa on sa.staff_id=s.id and sa.classroom_id=ca.classroom_id and sa.garden_id=garden and sa.status='active'
      where l.permanent_child_file_id=child_row.permanent_child_file_id and l.guardian_profile_id=recipient.id and l.status='active' and l.legal_authority
    ) then thread_kind := 'parent_staff';
    else raise exception 'communication_recipient_denied' using errcode='42501'; end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(actor.id::text), hashtext(coalesce(p_idempotency_key::text,gen_random_uuid()::text)));
  insert into public.communication_threads(garden_id,child_id,thread_type,subject,priority,status,created_by,assigned_to,last_message_at,metadata)
  values(garden,child_row.id,thread_kind,left(btrim(p_subject),180),'informational','open',actor.id,recipient.id,now(),jsonb_build_object('canonical',true,'source','gb_m29'))
  returning * into thread_row;
  insert into public.communication_thread_participants(thread_id,profile_id,role,participant_label,last_read_at)
  values(thread_row.id,actor.id,actor.role,actor.full_name,now()),(thread_row.id,recipient.id,recipient.role,recipient.full_name,null);
  insert into public.messages(garden_id,sender_id,recipient_id,thread_id,subject,body,content,read_at,treatment_status,priority,idempotency_key,message_kind)
  values(garden,actor.id,recipient.id,thread_row.id,left(btrim(p_subject),180),btrim(p_body),btrim(p_body),null,'open','informational',p_idempotency_key,'human') returning * into message_row;
  insert into public.notifications(garden_id,recipient_id,recipient_role,title,body,entity_type,entity_id,metadata)
  values(garden,recipient.id,recipient.role,left(btrim(p_subject),180),'התקבלה הודעה חדשה','communication_thread',thread_row.id,jsonb_build_object('message_id',message_row.id))
  on conflict do nothing;
  return jsonb_build_object('thread_id',thread_row.id,'message_id',message_row.id,'idempotent',false);
end;
$$;

create or replace function public.send_management_communication_message(
  p_thread_id uuid, p_body text, p_idempotency_key uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare thread_row public.communication_threads; actor public.profiles; message_row public.messages;
begin
  if not public.can_access_management_communication_thread(p_thread_id) then raise exception 'communication_thread_denied' using errcode='42501'; end if;
  if nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'communication_content_required' using errcode='23514'; end if;
  select * into actor from public.profiles where id=auth.uid();
  if p_idempotency_key is not null then select * into message_row from public.messages where sender_id=actor.id and idempotency_key=p_idempotency_key limit 1; if message_row.id is not null then return jsonb_build_object('thread_id',message_row.thread_id,'message_id',message_row.id,'idempotent',true); end if; end if;
  select * into thread_row from public.communication_threads where id=p_thread_id for update;
  if thread_row.id is null or thread_row.status in ('closed','archived') then raise exception 'communication_thread_closed' using errcode='23514'; end if;
  insert into public.messages(garden_id,sender_id,thread_id,subject,body,content,treatment_status,priority,idempotency_key,message_kind)
  values(thread_row.garden_id,actor.id,thread_row.id,thread_row.subject,btrim(p_body),btrim(p_body),'open',thread_row.priority,p_idempotency_key,'human') returning * into message_row;
  update public.communication_threads set last_message_at=message_row.created_at,updated_at=now() where id=thread_row.id;
  update public.communication_thread_participants set last_read_at=message_row.created_at,last_read_message_id=message_row.id where thread_id=thread_row.id and profile_id=actor.id;
  insert into public.notifications(garden_id,recipient_id,recipient_role,title,body,entity_type,entity_id,metadata)
  select thread_row.garden_id,p.profile_id,p.role,thread_row.subject,'התקבלה הודעה חדשה','communication_thread',thread_row.id,jsonb_build_object('message_id',message_row.id)
  from public.communication_thread_participants p where p.thread_id=thread_row.id and p.profile_id<>actor.id and p.left_at is null;
  return jsonb_build_object('thread_id',thread_row.id,'message_id',message_row.id,'idempotent',false);
end;
$$;

-- Broadcast delivery uses one Thread plus an explicit participant snapshot. It
-- never creates one copied conversation per Parent and later enrollments do not
-- alter the captured audience.
create or replace function public.create_management_communication_broadcast(
  p_garden_id uuid, p_classroom_id uuid, p_audience text, p_subject text,
  p_body text, p_idempotency_key uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.profiles; thread_row public.communication_threads; message_row public.messages; recipients uuid[];
begin
  select * into actor from public.profiles where id=auth.uid() and active=true;
  if actor.id is null or actor.role::text not in ('manager','owner') or not public.can_manage_garden(p_garden_id) then raise exception 'communication_broadcast_denied' using errcode='42501'; end if;
  if p_audience not in ('parents','staff') or nullif(btrim(coalesce(p_subject,'')),'') is null or nullif(btrim(coalesce(p_body,'')),'') is null then raise exception 'communication_broadcast_invalid' using errcode='23514'; end if;
  if p_classroom_id is not null and not exists(select 1 from public.classrooms c where c.id=p_classroom_id and c.garden_id=p_garden_id and c.status='active') then raise exception 'communication_classroom_denied' using errcode='42501'; end if;
  if p_idempotency_key is not null then select * into message_row from public.messages where sender_id=actor.id and idempotency_key=p_idempotency_key limit 1; if message_row.id is not null then return jsonb_build_object('thread_id',message_row.thread_id,'message_id',message_row.id,'idempotent',true); end if; end if;
  perform pg_advisory_xact_lock(hashtext(actor.id::text),hashtext(coalesce(p_idempotency_key::text,gen_random_uuid()::text)));
  if p_audience='parents' then
    select coalesce(array_agg(distinct link.guardian_profile_id), '{}'::uuid[]) into recipients
    from public.child_kindergarten_enrollments enrollment
    join public.children child on child.id=enrollment.child_id
    join public.child_guardian_links link on link.permanent_child_file_id=child.permanent_child_file_id and link.status='active' and link.legal_authority
    join public.profiles parent_profile on parent_profile.id=link.guardian_profile_id and parent_profile.active and parent_profile.role::text='parent'
    left join public.child_classroom_assignments assignment on assignment.child_id=child.id and assignment.garden_id=p_garden_id and assignment.is_current
    where enrollment.garden_id=p_garden_id and enrollment.status='active' and (p_classroom_id is null or assignment.classroom_id=p_classroom_id);
  else
    select coalesce(array_agg(distinct employment.profile_id), '{}'::uuid[]) into recipients
    from public.staff_kindergarten_employments employment
    join public.staff staff_row on staff_row.id=employment.staff_id and staff_row.profile_id=employment.profile_id and staff_row.garden_id=employment.garden_id and staff_row.approved_to_work and staff_row.onboarding_status='active'
    join public.profiles staff_profile on staff_profile.id=employment.profile_id and staff_profile.active and staff_profile.role::text='staff'
    where employment.garden_id=p_garden_id and employment.status='active' and (employment.start_date is null or employment.start_date<=current_date) and (employment.end_date is null or employment.end_date>=current_date);
  end if;
  if cardinality(recipients)=0 then raise exception 'communication_broadcast_empty_audience' using errcode='23514'; end if;
  insert into public.communication_threads(garden_id,classroom_id,thread_type,subject,priority,status,created_by,last_message_at,metadata)
  values(p_garden_id,p_classroom_id,case when p_audience='staff' then 'staff_broadcast' when p_classroom_id is null then 'garden_broadcast' else 'classroom_broadcast' end,left(btrim(p_subject),180),'informational','open',actor.id,now(),jsonb_build_object('canonical',true,'audience_snapshot',recipients,'audience_type',p_audience)) returning * into thread_row;
  insert into public.communication_thread_participants(thread_id,profile_id,role,participant_label,last_read_at)
  values(thread_row.id,actor.id,actor.role,actor.full_name,now());
  insert into public.communication_thread_participants(thread_id,profile_id,role,participant_label)
  select thread_row.id,p.id,p.role,p.full_name from public.profiles p where p.id=any(recipients);
  insert into public.messages(garden_id,sender_id,thread_id,subject,body,content,treatment_status,priority,idempotency_key,message_kind)
  values(p_garden_id,actor.id,thread_row.id,left(btrim(p_subject),180),btrim(p_body),btrim(p_body),'open','informational',p_idempotency_key,'human') returning * into message_row;
  insert into public.notifications(garden_id,recipient_id,recipient_role,title,body,entity_type,entity_id,metadata)
  select p_garden_id,p.id,p.role,thread_row.subject,'התקבלה הודעת גן','communication_thread',thread_row.id,jsonb_build_object('message_id',message_row.id,'broadcast',true)
  from public.profiles p where p.id=any(recipients);
  return jsonb_build_object('thread_id',thread_row.id,'message_id',message_row.id,'audience_count',cardinality(recipients),'idempotent',false);
end;
$$;

create or replace function public.mark_management_communication_thread_read(p_thread_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare latest uuid; begin
  if not public.can_access_management_communication_thread(p_thread_id) then raise exception 'communication_thread_denied' using errcode='42501'; end if;
  select id into latest from public.messages where thread_id=p_thread_id and deleted_at is null order by created_at desc limit 1;
  update public.communication_thread_participants set last_read_at=now(),last_read_message_id=latest where thread_id=p_thread_id and profile_id=auth.uid() and left_at is null;
end;
$$;

-- Remove the legacy broad policies. New canonical records can only be read by
-- a current, valid participant. Admin and Inspector need explicit support flows;
-- neither gains a blanket conversation reader here.
drop policy if exists "communication threads scoped read" on public.communication_threads;
drop policy if exists "communication threads scoped write" on public.communication_threads;
drop policy if exists "communication participants scoped read" on public.communication_thread_participants;
drop policy if exists "communication participants scoped write" on public.communication_thread_participants;
drop policy if exists "communication delivery scoped read" on public.communication_delivery_events;
drop policy if exists "communication delivery admin scoped write" on public.communication_delivery_events;
create policy "canonical communication thread participant read" on public.communication_threads for select using (public.can_access_management_communication_thread(id));
create policy "canonical communication participant read" on public.communication_thread_participants for select using (public.can_access_management_communication_thread(thread_id));
create policy "canonical communication delivery read" on public.communication_delivery_events for select using (public.can_access_management_communication_thread(thread_id) or recipient_profile_id=auth.uid());

drop policy if exists "messages participant or garden" on public.messages;
drop policy if exists "messages authenticated insert" on public.messages;
drop policy if exists "messages participant update" on public.messages;
create policy "canonical management message participant read" on public.messages for select using (
  thread_id is not null and public.can_access_management_communication_thread(thread_id)
);

revoke insert, update, delete on public.communication_threads, public.communication_thread_participants, public.communication_delivery_events from anon, authenticated;
revoke insert, update, delete on public.messages from anon, authenticated;
grant execute on function public.can_access_management_communication_thread(uuid), public.create_management_communication_thread(uuid,uuid,uuid,text,text,uuid), public.create_management_communication_broadcast(uuid,uuid,text,text,text,uuid), public.send_management_communication_message(uuid,text,uuid), public.mark_management_communication_thread_read(uuid) to authenticated;

comment on function public.create_management_communication_thread(uuid,uuid,uuid,text,text,uuid) is 'GB-M29 direct canonical messaging. Parent Garden is derived from an authorized active Child enrollment.';
comment on table public.communication_threads is 'Canonical conversation context. Complaint, Task and Notification remain independent domains.';
notify pgrst, 'reload schema';
