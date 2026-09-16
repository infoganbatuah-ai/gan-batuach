-- GB-M25: complaints stay domain records; tasks are execution links only.
alter type public.complaint_status add value if not exists 'waiting_reporter';
alter type public.complaint_status add value if not exists 'escalated';
alter type public.complaint_status add value if not exists 'resolved';
alter type public.complaint_status add value if not exists 'reopened';

create table if not exists public.complaint_sla_policies (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version > 0),
  category text,
  severity public.severity_level,
  acknowledgement_minutes integer check (acknowledgement_minutes > 0),
  response_minutes integer check (response_minutes > 0),
  resolution_minutes integer check (resolution_minutes > 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  status text not null check (status in ('draft','active','retired')),
  source_note text,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from),
  check (status <> 'active' or (approved_by is not null and approved_at is not null))
);
create index if not exists complaint_sla_policy_resolution_idx on public.complaint_sla_policies(status,category,severity,effective_from);
alter table public.complaint_sla_policies enable row level security;
create policy complaint_sla_admin_read on public.complaint_sla_policies for select using (public.is_admin());
grant select on public.complaint_sla_policies to authenticated;
-- Policy approval is deliberately separate from this migration: no invented deadline is activated.

alter table public.complaints
  add column if not exists reporter_user_id uuid references public.profiles(id),
  add column if not exists idempotency_key uuid,
  add column if not exists reported_urgency public.severity_level,
  add column if not exists visibility text not null default 'garden' check (visibility in ('garden','restricted')),
  add column if not exists routing_state text not null default 'unrouted' check (routing_state in ('inspector','admin_queue','garden','unrouted')),
  add column if not exists acknowledgement_due_at timestamptz,
  add column if not exists resolution_due_at timestamptz,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists escalated_at timestamptz,
  add column if not exists resolution_public text,
  add column if not exists sla_policy_id uuid references public.complaint_sla_policies(id),
  add column if not exists revision integer not null default 0;
create unique index if not exists complaints_reporter_retry_key on public.complaints(reporter_user_id,idempotency_key) where idempotency_key is not null;
create index if not exists complaints_sla_attention_idx on public.complaints(status,acknowledgement_due_at,resolution_due_at);
-- Only deterministic parent identity is carried forward; no historical SLA is invented.
update public.complaints c set reporter_user_id=coalesce(p.profile_id,p.user_id)
  from public.parents p where c.parent_id=p.id and c.reporter_user_id is null
    and coalesce(p.profile_id,p.user_id) is not null;
update public.complaints set visibility='restricted'
  where category in ('safety','violence','staff','medical','privacy','camera') or (urgent=true and severity='critical');

create table if not exists public.complaint_events (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  garden_id uuid not null references public.gardens(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  from_status public.complaint_status,
  to_status public.complaint_status,
  public_note text,
  internal_note text,
  created_at timestamptz not null default now()
);
create index if not exists complaint_events_case_time_idx on public.complaint_events(complaint_id,created_at);
alter table public.complaint_events enable row level security;
create policy complaint_events_admin_read on public.complaint_events for select using (public.is_admin());
create policy complaint_events_inspector_read on public.complaint_events for select using (public.can_inspector_access_garden(garden_id));
grant select on public.complaint_events to authenticated;
-- Reporter/Garden projections use explicit safe columns rather than raw event rows.

create or replace function public.can_report_complaint(p_garden_id uuid,p_child_id uuid default null)
returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and exists(select 1 from public.gardens g where g.id=p_garden_id and g.status='active')
    and case when p_child_id is not null then
      (public.can_parent_access_child(p_child_id) or exists(
        select 1 from public.children c where c.id=p_child_id
          and public.can_guardian_access_child(c.permanent_child_file_id,'profile')))
      and exists(
        select 1 from public.child_kindergarten_enrollments e
        where e.child_id=p_child_id and e.garden_id=p_garden_id and e.status='active'
      )
    else exists(
      select 1 from public.parent_kindergarten_links l
      where l.garden_id=p_garden_id and l.status='active'
        and (l.parent_profile_id=auth.uid() or exists(select 1 from public.parents p where p.id=l.parent_id
          and (p.profile_id=auth.uid() or p.user_id=auth.uid())))
    ) or exists(
      select 1 from public.child_kindergarten_enrollments e
      join public.children c on c.id=e.child_id
      where e.garden_id=p_garden_id and e.status='active' and public.can_parent_access_child(c.id)
    ) end;
$$;

create or replace function public.submit_management_complaint(
  p_garden_id uuid,p_child_id uuid,p_subject text,p_description text,p_category text,
  p_reported_urgency public.severity_level,p_idempotency_key uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare result public.complaints%rowtype; actor public.profiles%rowtype; owner_parent uuid;
  reviewer uuid; manager_user uuid; task_assignee uuid; route_state text;
  policy public.complaint_sla_policies%rowtype; policy_ids uuid[]; policy_count integer; sensitive boolean;
begin
  select * into actor from public.profiles where id=auth.uid() and active=true and role='parent';
  if actor.id is null or not public.can_report_complaint(p_garden_id,p_child_id) then raise exception 'complaint_context_denied' using errcode='42501'; end if;
  if length(btrim(p_subject)) not between 2 and 200 or length(btrim(p_description)) not between 5 and 10000
     or p_idempotency_key is null then raise exception 'invalid_complaint' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtext(actor.id::text),hashtext(p_idempotency_key::text));
  select * into result from public.complaints where reporter_user_id=actor.id and idempotency_key=p_idempotency_key;
  if result.id is not null then return jsonb_build_object('id',result.id,'garden_id',result.garden_id,
    'child_id',result.child_id,'subject',result.subject,'category',result.category,'status',result.status,
    'created_at',result.created_at,'acknowledged_at',result.acknowledged_at,'resolution_public',result.resolution_public,'closed_at',result.closed_at); end if;
  select p.id into owner_parent from public.parents p where p.profile_id=actor.id or p.user_id=actor.id order by p.created_at limit 1;
  select g.inspector_id into reviewer from public.gardens g where g.id=p_garden_id;
  if reviewer is not null and not public.is_approved_inspector(reviewer) then reviewer:=null; end if;
  select m.profile_id into manager_user from public.garden_management_memberships m
    join public.profiles p on p.id=m.profile_id and p.active=true
    where m.garden_id=p_garden_id and m.status='active' and m.relationship_role in ('owner','manager')
    order by case when m.relationship_role='manager' then 0 else 1 end,m.profile_id limit 1;
  select array_agg(id) into policy_ids from public.complaint_sla_policies
    where status='active' and effective_from<=now() and (effective_until is null or effective_until>now())
      and (category is null or category=p_category) and (severity is null or severity=p_reported_urgency);
  policy_count:=coalesce(array_length(policy_ids,1),0);
  if policy_count>1 then raise exception 'sla_policy_conflict' using errcode='23505'; end if;
  if policy_count=1 then select * into policy from public.complaint_sla_policies where id=policy_ids[1];
  else policy.id:=null; end if;
  sensitive:=p_category in ('safety','violence','staff','medical','privacy','camera') or p_reported_urgency='critical';
  route_state:=case when not sensitive and manager_user is not null then 'garden'
    when reviewer is not null then 'inspector' else 'admin_queue' end;
  task_assignee:=case route_state when 'garden' then manager_user when 'inspector' then reviewer else null end;
  insert into public.complaints(garden_id,parent_id,child_id,reporter_user_id,idempotency_key,reported_urgency,subject,description,category,
    severity,urgent,status,visibility,routing_state,assigned_inspector_id,sla_policy_id,acknowledgement_due_at,response_due_at,resolution_due_at)
  values(p_garden_id,owner_parent,p_child_id,actor.id,p_idempotency_key,p_reported_urgency,btrim(p_subject),btrim(p_description),p_category,
    'medium',p_reported_urgency in ('high','critical'),'new',case when sensitive then 'restricted' else 'garden' end,
    route_state,case when route_state='inspector' then reviewer else null end,policy.id,
    case when policy.id is null then null else now()+make_interval(mins=>policy.acknowledgement_minutes) end,
    case when policy.id is null then null else now()+make_interval(mins=>policy.response_minutes) end,
    case when policy.id is null then null else now()+make_interval(mins=>policy.resolution_minutes) end)
  returning * into result;
  insert into public.complaint_events(complaint_id,garden_id,actor_id,action,to_status)
    values(result.id,p_garden_id,actor.id,'submitted','new');
  insert into public.tasks(garden_id,title,assigned_to,created_by,due_at,status,priority,task_type,source_entity_type,source_entity_id)
    values(p_garden_id,'בדיקת תלונה',task_assignee,actor.id,result.response_due_at,'open','medium','report_followup','complaint',result.id)
    on conflict do nothing;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
    values(actor.id,actor.role,p_garden_id,'complaints',result.id,'complaint_submitted',jsonb_build_object('routing_state',result.routing_state,'sla_policy_id',policy.id));
  insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,channel,status)
    select p_garden_id,p.id,'תלונה חדשה','תלונה חדשה מחכה לבדיקה','complaints',result.id,'in_app','pending'
    from public.profiles p where p.id=task_assignee or (task_assignee is null and p.role='admin' and p.active=true);
  return jsonb_build_object('id',result.id,'garden_id',result.garden_id,'child_id',result.child_id,
    'subject',result.subject,'category',result.category,'status',result.status,'created_at',result.created_at,
    'acknowledged_at',result.acknowledged_at,'resolution_public',result.resolution_public,'closed_at',result.closed_at);
end; $$;

create or replace function public.transition_management_complaint(p_id uuid,p_action text,p_public_note text default null,p_internal_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.complaints%rowtype; old_status public.complaint_status; next_status public.complaint_status; is_reporter boolean;
  is_inspector boolean; is_manager boolean; is_platform_admin boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into c from public.complaints where id=p_id for update;
  if c.id is null then raise exception 'complaint_not_found' using errcode='P0002'; end if;
  is_reporter:=c.reporter_user_id=auth.uid();
  is_inspector:=public.can_inspector_access_garden(c.garden_id);
  is_manager:=c.visibility='garden' and public.can_manage_garden(c.garden_id);
  is_platform_admin:=public.is_admin();
  if length(coalesce(p_public_note,''))>4000 or length(coalesce(p_internal_note,''))>4000 then raise exception 'note_too_long' using errcode='23514'; end if;
  if p_action in ('request_reporter','request_garden','reporter_reply','garden_reply','resolve','reopen')
    and nullif(btrim(coalesce(p_public_note,'')),'') is null then raise exception 'public_note_required' using errcode='23514'; end if;
  if p_action='note' and nullif(btrim(coalesce(p_internal_note,'')),'') is null then raise exception 'internal_note_required' using errcode='23514'; end if;
  if p_action='acknowledge' and (is_inspector or is_platform_admin or is_manager) and c.status='new' then next_status:='assigned';
  elsif p_action='review' and (is_inspector or is_platform_admin) and c.status in ('new','assigned','reopened') then next_status:='in_progress';
  elsif p_action='request_reporter' and (is_inspector or is_platform_admin) and c.status in ('assigned','in_progress','reopened') then next_status:='waiting_reporter';
  elsif p_action='request_garden' and (is_inspector or is_platform_admin) and c.visibility='garden'
    and c.status in ('assigned','in_progress','reopened') then next_status:='waiting_garden';
  elsif p_action='reporter_reply' and is_reporter and c.status='waiting_reporter' then next_status:='in_progress';
  elsif p_action='garden_reply' and is_manager and c.status in ('assigned','in_progress','waiting_garden') then next_status:='in_progress';
  elsif p_action='note' and (is_inspector or is_platform_admin) and c.status not in ('closed') then next_status:=c.status;
  elsif p_action='assign' and is_platform_admin and c.status not in ('closed') then next_status:='assigned';
  elsif p_action='mark_urgent' and (is_inspector or is_platform_admin) and c.status not in ('closed') then next_status:=c.status;
  elsif p_action='escalate' and (is_inspector or is_platform_admin) and c.status not in ('closed','resolved') then next_status:='escalated';
  elsif p_action='resolve' and (is_inspector or is_platform_admin) and c.status in ('in_progress','escalated','reopened') and nullif(btrim(p_public_note),'') is not null then next_status:='resolved';
  elsif p_action='close' and (is_inspector or is_platform_admin) and c.status='resolved' then next_status:='closed';
  elsif p_action='reopen' and (is_reporter or is_inspector or is_platform_admin) and c.status in ('resolved','closed') and nullif(btrim(p_public_note),'') is not null then next_status:='reopened';
  else raise exception 'complaint_transition_denied' using errcode='42501'; end if;
  if p_internal_note is not null and not (is_inspector or is_platform_admin) then raise exception 'internal_note_denied' using errcode='42501'; end if;
  old_status:=c.status;
  update public.complaints set status=next_status,revision=revision+1,
    acknowledged_at=case when p_action='acknowledge' then coalesce(acknowledged_at,now()) else acknowledged_at end,
    last_response_at=case when p_action='garden_reply' then now() else last_response_at end,
    resolved_at=case when p_action='resolve' then now() else resolved_at end,
    closed_at=case when p_action='close' then now() else closed_at end,
    escalated_at=case when p_action='escalate' then now() else escalated_at end,
    resolution_public=case when p_action='resolve' then p_public_note when p_action='reopen' then null else resolution_public end,
    resolution_due_at=case when p_action='reopen' and sla_policy_id is not null then now()+(select make_interval(mins=>resolution_minutes) from public.complaint_sla_policies where id=c.sla_policy_id) else resolution_due_at end
    where id=p_id returning * into c;
  if p_action='assign' then
    update public.complaints set assigned_to=auth.uid() where id=p_id returning * into c;
  end if;
  if p_action='mark_urgent' then
    update public.complaints set severity='critical',urgent=true where id=p_id returning * into c;
  end if;
  insert into public.complaint_events(complaint_id,garden_id,actor_id,action,from_status,to_status,public_note,internal_note)
    values(c.id,c.garden_id,auth.uid(),p_action,old_status,next_status,p_public_note,p_internal_note);
  if p_action='resolve' then
    update public.tasks set status='done',completed_at=now(),completed_by=auth.uid()
      where source_entity_type='complaint' and source_entity_id=c.id and status::text not in ('done','cancelled');
  elsif p_action='reopen' then
    update public.tasks set status='open',completed_at=null,completed_by=null,cancelled_at=null
      where source_entity_type='complaint' and source_entity_id=c.id and status::text in ('done','cancelled');
  end if;
  insert into public.audit_logs(actor_id,garden_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),c.garden_id,'complaints',c.id,'complaint_'||p_action,jsonb_build_object('status',next_status));
  if c.reporter_user_id is not null and p_action not in ('reporter_reply','note','assign') then
    insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,channel,status)
      values(c.garden_id,c.reporter_user_id,'עדכון תלונה','סטטוס התלונה עודכן','complaints',c.id,'in_app','pending');
  end if;
  return jsonb_build_object('id',c.id,'garden_id',c.garden_id,'child_id',c.child_id,
    'subject',c.subject,'status',c.status,'routing_state',c.routing_state,'reporter_user_id',c.reporter_user_id,
    'resolution_public',c.resolution_public,'acknowledged_at',c.acknowledged_at,
    'resolved_at',c.resolved_at,'closed_at',c.closed_at);
end; $$;

create or replace function public.create_complaint_sla_draft(
  p_category text,p_severity public.severity_level,p_acknowledgement_minutes integer,
  p_response_minutes integer,p_resolution_minutes integer,p_effective_from timestamptz,p_effective_until timestamptz,
  p_source_note text
) returns public.complaint_sla_policies language plpgsql security definer set search_path=public as $$
declare result public.complaint_sla_policies%rowtype; new_version integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_acknowledgement_minutes is null or p_response_minutes is null or p_resolution_minutes is null
    or p_source_note is null or length(btrim(p_source_note))<3 then raise exception 'policy_incomplete' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtext('complaint_sla_policy'),0);
  select coalesce(max(version),0)+1 into new_version from public.complaint_sla_policies;
  insert into public.complaint_sla_policies(version,category,severity,acknowledgement_minutes,response_minutes,
    resolution_minutes,effective_from,effective_until,status,source_note)
  values(new_version,p_category,p_severity,p_acknowledgement_minutes,p_response_minutes,p_resolution_minutes,
    p_effective_from,p_effective_until,'draft',btrim(p_source_note)) returning * into result;
  insert into public.audit_logs(actor_id,garden_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),null,'complaint_sla_policies',result.id,'sla_draft_created',jsonb_build_object('version',result.version));
  return result;
end; $$;

create or replace function public.transition_complaint_sla_policy(p_id uuid,p_action text)
returns public.complaint_sla_policies language plpgsql security definer set search_path=public as $$
declare result public.complaint_sla_policies%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext('complaint_sla_policy'),0);
  select * into result from public.complaint_sla_policies where id=p_id for update;
  if result.id is null then raise exception 'policy_not_found' using errcode='P0002'; end if;
  if p_action='activate' and result.status='draft' then
    if exists(select 1 from public.complaint_sla_policies p where p.status='active'
      and p.category is not distinct from result.category and p.severity is not distinct from result.severity
      and tstzrange(p.effective_from,p.effective_until,'[)') && tstzrange(result.effective_from,result.effective_until,'[)'))
    then raise exception 'policy_conflict' using errcode='23505'; end if;
    update public.complaint_sla_policies set status='active',approved_by=auth.uid(),approved_at=now()
      where id=p_id returning * into result;
  elsif p_action='retire' and result.status='active' then
    update public.complaint_sla_policies set status='retired' where id=p_id returning * into result;
  else raise exception 'policy_transition_denied' using errcode='42501'; end if;
  insert into public.audit_logs(actor_id,garden_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),null,'complaint_sla_policies',p_id,'sla_'||p_action,jsonb_build_object('version',result.version,'status',result.status));
  return result;
end; $$;

create or replace function public.complaint_sla_state(p_id uuid,p_at timestamptz default now())
returns table(acknowledgement_overdue boolean,response_overdue boolean,resolution_overdue boolean,sla_configured boolean)
language sql stable security definer set search_path=public as $$
  select c.sla_policy_id is not null and c.acknowledgement_due_at<p_at and c.acknowledged_at is null,
    c.sla_policy_id is not null and c.response_due_at<p_at and c.last_response_at is null and c.status::text not in ('resolved','closed'),
    c.sla_policy_id is not null and c.resolution_due_at<p_at and c.status::text not in ('resolved','closed'),c.sla_policy_id is not null
  from public.complaints c where c.id=p_id and (public.is_admin() or c.reporter_user_id=auth.uid()
    or public.can_inspector_access_garden(c.garden_id) or (c.visibility='garden' and public.can_manage_garden(c.garden_id)));
$$;

create or replace function public.escalate_overdue_complaints(p_at timestamptz default now(),p_limit integer default 100)
returns integer language plpgsql security definer set search_path=public as $$
declare c public.complaints%rowtype; processed integer:=0; reason text; reviewer uuid;
begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode='42501';
  end if;
  if p_limit not between 1 and 500 then raise exception 'invalid_batch_size' using errcode='23514'; end if;
  -- Current Inspector authority wins over the historical assignee. Suspended/reassigned cases go to Admin.
  for c in select c.* from public.complaints c join public.gardens g on g.id=c.garden_id
    where c.status::text not in ('closed','resolved') and c.routing_state in ('inspector','admin_queue','unrouted') and
      (c.assigned_inspector_id is distinct from
        (case when public.is_approved_inspector(g.inspector_id) then g.inspector_id else null end)
       or c.routing_state is distinct from
        (case when public.is_approved_inspector(g.inspector_id) then 'inspector' else 'admin_queue' end))
    order by c.created_at,c.id for update of c skip locked limit p_limit
  loop
    select g.inspector_id into reviewer from public.gardens g where g.id=c.garden_id;
    if reviewer is not null and not public.is_approved_inspector(reviewer) then reviewer:=null; end if;
    if c.assigned_inspector_id is distinct from reviewer or c.routing_state is distinct from
      (case when reviewer is null then 'admin_queue' else 'inspector' end) then
      update public.complaints set assigned_inspector_id=reviewer,
        routing_state=case when reviewer is null then 'admin_queue' else 'inspector' end,revision=revision+1
        where id=c.id;
      update public.tasks set assigned_to=reviewer where source_entity_type='complaint' and source_entity_id=c.id
        and status::text not in ('done','cancelled');
      insert into public.complaint_events(complaint_id,garden_id,action,from_status,to_status)
        values(c.id,c.garden_id,case when reviewer is null then 'routed_admin_queue' else 'routed_inspector' end,c.status,c.status);
      insert into public.audit_logs(garden_id,entity_type,entity_id,action,after_data)
        values(c.garden_id,'complaints',c.id,'complaint_reassigned',jsonb_build_object('routing_state',case when reviewer is null then 'admin_queue' else 'inspector' end));
    end if;
  end loop;
  for c in select * from public.complaints
    where status::text not in ('closed','resolved','escalated') and sla_policy_id is not null
      and ((acknowledgement_due_at<p_at and acknowledged_at is null)
        or (response_due_at<p_at and last_response_at is null)
        or resolution_due_at<p_at)
    order by coalesce(acknowledgement_due_at,response_due_at,resolution_due_at),id
    for update skip locked limit p_limit
  loop
    reason:=case when c.acknowledgement_due_at<p_at and c.acknowledged_at is null then 'acknowledgement_overdue'
      when c.response_due_at<p_at and c.last_response_at is null then 'response_overdue' else 'resolution_overdue' end;
    update public.complaints set status='escalated',routing_state='admin_queue',escalated_at=p_at,revision=revision+1
      where id=c.id;
    update public.tasks set assigned_to=null,due_at=p_at where source_entity_type='complaint' and source_entity_id=c.id
      and status::text not in ('done','cancelled');
    insert into public.complaint_events(complaint_id,garden_id,action,from_status,to_status,internal_note)
      values(c.id,c.garden_id,'sla_escalated',c.status,'escalated',reason);
    insert into public.audit_logs(garden_id,entity_type,entity_id,action,after_data)
      values(c.garden_id,'complaints',c.id,'complaint_sla_escalated',jsonb_build_object('reason',reason));
    processed:=processed+1;
  end loop;
  return processed;
end; $$;

-- Direct client writes bypass neither state machine nor reporter/Garden binding.
drop policy if exists "complaints scoped read" on public.complaints;
drop policy if exists "complaints scoped read hardened" on public.complaints;
drop policy if exists "complaints parent insert" on public.complaints;
drop policy if exists "complaints scoped insert hardened" on public.complaints;
drop policy if exists "complaints admin inspector update" on public.complaints;
drop policy if exists "complaints admin inspector update hardened" on public.complaints;
create policy complaint_canonical_read on public.complaints for select using (
  public.is_admin() or reporter_user_id=auth.uid() or public.can_inspector_access_garden(garden_id)
  or (visibility='garden' and public.can_manage_garden(garden_id))
);
create or replace function public.can_view_management_task(
  p_garden_id uuid,p_assigned_to uuid,p_assigned_role text,p_source_type text,p_source_id uuid
) returns boolean language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and
    (case when p_garden_id is null then public.is_admin()
      else public.is_admin() or public.can_manage_garden(p_garden_id)
        or (public.can_staff_access_garden(p_garden_id) and
            (p_assigned_to=auth.uid() or (p_assigned_to is null and p_assigned_role='staff')))
        or (public.can_inspector_access_garden(p_garden_id) and
            (p_assigned_to=auth.uid() or (p_assigned_to is null and p_assigned_role='inspector')))
      end)
    and (p_source_type not in ('corrective_action','complaint','incident') or p_source_id is null
      or public.is_admin() or public.can_manage_garden(p_garden_id)
      or public.can_inspector_access_garden(p_garden_id))
    and (p_source_type is distinct from 'complaint' or p_source_id is null or public.is_admin()
      or public.can_inspector_access_garden(p_garden_id)
      or exists(select 1 from public.complaints c where c.id=p_source_id and c.garden_id=p_garden_id
        and c.visibility='garden' and public.can_manage_garden(p_garden_id)));
$$;
-- RLS cannot redact columns. Keep internal notes and raw evidence paths out of direct client queries.
revoke select on public.complaints from public,anon,authenticated;
do $$
declare safe_columns text;
begin
  select string_agg(quote_ident(attname),',') into safe_columns from pg_attribute
    where attrelid='public.complaints'::regclass and attnum>0 and not attisdropped
      and attname not in ('internal_notes','status_history','resolution','attachment_url','attachment_urls');
  execute 'grant select ('||safe_columns||') on public.complaints to authenticated';
end $$;
revoke insert,update,delete on public.complaints from authenticated;
revoke insert,update,delete on public.complaint_events from authenticated;
revoke all on function public.submit_management_complaint(uuid,uuid,text,text,text,public.severity_level,uuid) from public,anon;
revoke all on function public.transition_management_complaint(uuid,text,text,text) from public,anon;
revoke all on function public.create_complaint_sla_draft(text,public.severity_level,integer,integer,integer,timestamptz,timestamptz,text) from public,anon;
revoke all on function public.transition_complaint_sla_policy(uuid,text) from public,anon;
grant execute on function public.submit_management_complaint(uuid,uuid,text,text,text,public.severity_level,uuid) to authenticated;
grant execute on function public.transition_management_complaint(uuid,text,text,text) to authenticated;
grant execute on function public.create_complaint_sla_draft(text,public.severity_level,integer,integer,integer,timestamptz,timestamptz,text) to authenticated;
grant execute on function public.transition_complaint_sla_policy(uuid,text) to authenticated;
grant execute on function public.complaint_sla_state(uuid,timestamptz) to authenticated;
revoke all on function public.escalate_overdue_complaints(timestamptz,integer) from public,anon,authenticated;
grant execute on function public.escalate_overdue_complaints(timestamptz,integer) to service_role;
notify pgrst,'reload schema';
