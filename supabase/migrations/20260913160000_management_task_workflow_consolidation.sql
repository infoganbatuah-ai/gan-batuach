-- GB-M24: tasks is the execution layer. Domain records remain authoritative.
alter type public.task_status add value if not exists 'blocked';
alter type public.task_status add value if not exists 'cancelled';

alter table public.tasks
  add column if not exists cancelled_at timestamptz,
  add column if not exists blocked_reason text;
create index if not exists management_tasks_garden_status_due_idx on public.tasks(garden_id,status,due_at);
create index if not exists management_tasks_assignee_status_due_idx on public.tasks(assigned_to,status,due_at);
create index if not exists management_tasks_source_idx on public.tasks(source_entity_type,source_entity_id);

-- The M22 scorer creates the task before the violation; M23 already stores the
-- deterministic task_id. Normalize that link without guessing other sources.
update public.tasks t set source_entity_type='corrective_action',source_entity_id=v.id
from public.violations v where v.task_id=t.id
  and (t.source_entity_type is distinct from 'corrective_action' or t.source_entity_id is distinct from v.id);

create or replace function public.link_corrective_action_task()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.task_id is not null then
    update public.tasks set source_entity_type='corrective_action',source_entity_id=new.id
      where id=new.task_id and garden_id=new.garden_id;
    if not found then raise exception 'corrective_task_garden_mismatch' using errcode='23514'; end if;
  end if;
  return new;
end; $$;
drop trigger if exists management_link_corrective_action_task on public.violations;
create trigger management_link_corrective_action_task after insert on public.violations
for each row execute function public.link_corrective_action_task();
create unique index if not exists management_tasks_corrective_source_unique
  on public.tasks(source_entity_id) where source_entity_type='corrective_action' and source_entity_id is not null;
create unique index if not exists management_tasks_report_source_unique
  on public.tasks(source_entity_type,source_entity_id)
  where source_entity_type in ('complaint','incident') and source_entity_id is not null;

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
      or public.can_inspector_access_garden(p_garden_id));
$$;

drop policy if exists "tasks garden scoped" on public.tasks;
drop policy if exists "tasks write scoped" on public.tasks;
create policy "management tasks scoped read" on public.tasks for select using
  (public.can_view_management_task(garden_id,assigned_to,assigned_role,source_entity_type,source_entity_id));
revoke insert,update,delete on public.tasks from anon,authenticated;

-- Workflow tables remain compatibility storage; their assignment is not a
-- tenant grant. Canonical mutations go through tasks RPCs below.
drop policy if exists "workflow tasks scoped read" on public.workflow_tasks;
drop policy if exists "workflow tasks scoped write" on public.workflow_tasks;
create policy "management workflow tasks compatible read" on public.workflow_tasks for select using
  (public.can_view_management_task(garden_id,assigned_to,assigned_role::text,source_entity_type,source_entity_id)
   and (legacy_task_id is null or exists(select 1 from public.tasks t where t.id=legacy_task_id)));
revoke insert,update,delete on public.workflow_tasks from anon,authenticated;

drop policy if exists "workflows scoped read" on public.workflows;
drop policy if exists "workflows scoped write" on public.workflows;
create policy "management legacy workflows admin read" on public.workflows for select using (public.is_admin());
revoke insert,update,delete on public.workflows from anon,authenticated;
drop policy if exists "workflow approvals scoped" on public.workflow_approvals;
create policy "management legacy workflow approvals admin read" on public.workflow_approvals for select using (public.is_admin());
revoke insert,update,delete on public.workflow_approvals from anon,authenticated;
drop policy if exists "workflow escalations scoped" on public.workflow_escalations;
create policy "management legacy workflow escalations admin read" on public.workflow_escalations for select using (public.is_admin());
revoke insert,update,delete on public.workflow_escalations from anon,authenticated;
drop policy if exists "workflow audit scoped read" on public.workflow_audit_events;
create policy "management legacy workflow audit admin read" on public.workflow_audit_events for select using (public.is_admin());

drop policy if exists "task view logs insert self" on public.task_view_logs;
create policy "management task view logs insert" on public.task_view_logs for insert with check
  (viewer_id=auth.uid() and exists(select 1 from public.tasks t where t.id=task_id));

create or replace function public.create_management_task(
  p_garden_id uuid,p_title text,p_description text default null,p_assigned_to uuid default null,
  p_due_at timestamptz default null,p_priority text default 'medium'
) returns public.tasks language plpgsql security definer set search_path=public as $$
declare actor public.profiles%rowtype; result public.tasks%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into actor from public.profiles where id=auth.uid() and active=true;
  if actor.id is null or not (public.is_admin() or (p_garden_id is not null and public.can_manage_garden(p_garden_id))) then
    raise exception 'task_manager_required' using errcode='42501'; end if;
  if nullif(btrim(p_title),'') is null or length(p_title)>200 or p_priority not in ('low','medium','high','critical') then
    raise exception 'invalid_task' using errcode='23514'; end if;
  if p_assigned_to is not null and not (
    (p_garden_id is null and exists(select 1 from public.profiles p where p.id=p_assigned_to and p.active and p.role::text='admin'))
    or (p_garden_id is not null and (
      exists(select 1 from public.garden_management_memberships m join public.profiles p on p.id=m.profile_id and p.active where m.profile_id=p_assigned_to and m.garden_id=p_garden_id and m.status='active' and m.relationship_role in ('owner','manager'))
      or exists(select 1 from public.staff_kindergarten_employments e join public.staff s on s.id=e.staff_id and s.profile_id=e.profile_id and s.garden_id=e.garden_id join public.profiles p on p.id=e.profile_id and p.active where e.profile_id=p_assigned_to and e.garden_id=p_garden_id and e.status='active' and (e.start_date is null or e.start_date<=current_date) and (e.end_date is null or e.end_date>=current_date) and s.approved_to_work and s.onboarding_status='active')
      or (public.is_approved_inspector(p_assigned_to) and exists(select 1 from public.gardens g where g.id=p_garden_id and g.inspector_id=p_assigned_to))
    ))
  ) then raise exception 'ineligible_task_assignee' using errcode='42501'; end if;
  insert into public.tasks(garden_id,title,description,assigned_to,created_by,due_at,priority,status,task_type)
  values(p_garden_id,btrim(p_title),p_description,p_assigned_to,actor.id,p_due_at,p_priority::public.severity_level,'open','general') returning * into result;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(actor.id,actor.role,p_garden_id,'tasks',result.id,'task_created',jsonb_build_object('assigned_to',p_assigned_to,'due_at',p_due_at));
  if p_assigned_to is not null then
    insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,channel,status)
    values(p_garden_id,p_assigned_to,'משימה חדשה',result.title,'task',result.id,'in_app','pending');
  end if;
  return result;
end; $$;

-- Admin report follow-ups use the source record as the deterministic identity.
-- Observer mock/shadow events are deliberately not accepted here.
create or replace function public.create_task_from_source(
  p_source_type text,p_source_id uuid,p_assigned_to uuid default null,p_note text default null
) returns public.tasks language plpgsql security definer set search_path=public as $$
declare result public.tasks%rowtype; target_garden uuid; source_title text; source_description text; source_priority text;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
  if p_source_type not in ('complaint','incident') then raise exception 'unsupported_task_source' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtext('management_task_source'),hashtext(p_source_type||p_source_id::text));
  select * into result from public.tasks where source_entity_type=p_source_type and source_entity_id=p_source_id limit 1;
  if result.id is not null then return result; end if;
  if p_source_type='complaint' then
    select garden_id,subject,description,severity::text into target_garden,source_title,source_description,source_priority
      from public.complaints where id=p_source_id;
  else
    select garden_id,title,description,severity into target_garden,source_title,source_description,source_priority
      from public.incident_reports where id=p_source_id;
  end if;
  if target_garden is null then raise exception 'task_source_not_found' using errcode='P0002'; end if;
  if p_assigned_to is not null and not (
    exists(select 1 from public.garden_management_memberships m join public.profiles p on p.id=m.profile_id and p.active
      where m.profile_id=p_assigned_to and m.garden_id=target_garden and m.status='active' and m.relationship_role in ('owner','manager'))
    or (public.is_approved_inspector(p_assigned_to) and exists(select 1 from public.gardens g where g.id=target_garden and g.inspector_id=p_assigned_to))
  ) then raise exception 'source_task_reviewer_required' using errcode='42501'; end if;
  result:=public.create_management_task(target_garden,'טיפול בדיווח: '||source_title,
    coalesce(p_note,source_description),p_assigned_to,null,
    case when source_priority in ('low','medium','high','critical') then source_priority else 'medium' end);
  update public.tasks set source_entity_type=p_source_type,source_entity_id=p_source_id,task_type='report_followup'
    where id=result.id returning * into result;
  return result;
end; $$;

create or replace function public.transition_management_task(p_task_id uuid,p_action text,p_note text default null)
returns public.tasks language plpgsql security definer set search_path=public as $$
declare t public.tasks%rowtype; actor public.profiles%rowtype; manager_allowed boolean; assignee_allowed boolean;
  next_status public.task_status; old_status public.task_status;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into t from public.tasks where id=p_task_id for update;
  if t.id is null then raise exception 'task_not_found' using errcode='P0002'; end if;
  if not public.can_view_management_task(t.garden_id,t.assigned_to,t.assigned_role,t.source_entity_type,t.source_entity_id) then
    raise exception 'task_not_authorized' using errcode='42501'; end if;
  select * into actor from public.profiles where id=auth.uid() and active=true;
  if actor.id is null then raise exception 'active_actor_required' using errcode='42501'; end if;
  manager_allowed:=public.is_admin() or (t.garden_id is not null and public.can_manage_garden(t.garden_id));
  assignee_allowed:=t.assigned_to=auth.uid() and t.garden_id is not null and
    (public.can_staff_access_garden(t.garden_id) or public.can_inspector_access_garden(t.garden_id));
  if not (manager_allowed or assignee_allowed) then raise exception 'task_transition_denied' using errcode='42501'; end if;
  if p_note is not null and length(p_note)>2000 then raise exception 'note_too_long' using errcode='23514'; end if;
  old_status:=t.status;
  case p_action
    when 'start' then next_status:='in_progress';
    when 'submit' then next_status:='waiting_approval';
    when 'complete' then next_status:='done';
    when 'block' then next_status:='blocked';
    when 'reject' then next_status:='rejected';
    when 'reopen' then next_status:='open';
    when 'cancel' then next_status:='cancelled';
    else raise exception 'invalid_task_action' using errcode='23514';
  end case;
  if t.status=next_status then return t; end if;
  if p_action in ('complete','reject','reopen','cancel') and not manager_allowed then
    raise exception 'task_manager_required' using errcode='42501'; end if;
  if (p_action in ('start','submit','block') and t.status not in ('open','in_progress','rejected','blocked','overdue'))
    or (p_action='complete' and t.status not in ('open','in_progress','waiting_approval','blocked','overdue'))
    or (p_action='reject' and t.status<>'waiting_approval')
    or (p_action='reopen' and t.status not in ('done','cancelled','rejected'))
    or (p_action='cancel' and t.status in ('done','cancelled')) then
      raise exception 'invalid_task_transition' using errcode='23514'; end if;
  update public.tasks set status=next_status,updated_at=now(),
    completed_at=case when next_status='done' then now() else null end,
    completed_by=case when next_status='done' then actor.id else null end,
    cancelled_at=case when next_status='cancelled' then now() else null end,
    blocked_reason=case when next_status='blocked' then p_note else blocked_reason end,
    completion_comment=case when next_status='done' then p_note else completion_comment end,
    rejection_reason=case when next_status='rejected' then p_note else rejection_reason end,
    waiting_approval_at=case when next_status='waiting_approval' then now() else waiting_approval_at end
  where id=t.id returning * into t;
  if t.workflow_task_id is not null then
    update public.workflow_tasks set status=next_status::text,updated_at=now(),
      completed_at=t.completed_at,completed_by=t.completed_by,outcome_notes=p_note where id=t.workflow_task_id;
  end if;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,before_data,after_data)
  values(actor.id,actor.role,t.garden_id,'tasks',t.id,'task_'||p_action,
    jsonb_build_object('status',old_status),jsonb_build_object('status',next_status,'note',p_note));
  if t.created_by is not null and t.created_by<>actor.id and p_action in ('submit','complete','block','reopen') then
    insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,channel,status)
    values(t.garden_id,t.created_by,'עדכון משימה',t.title||' · '||next_status::text,'task',t.id,'in_app','pending');
  end if;
  return t;
end; $$;

create or replace function public.update_management_task(
  p_task_id uuid,p_assigned_to uuid,p_due_at timestamptz,p_priority text
) returns public.tasks language plpgsql security definer set search_path=public as $$
declare t public.tasks%rowtype; actor public.profiles%rowtype; prior_assignee uuid; prior_due timestamptz;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into t from public.tasks where id=p_task_id for update;
  if t.id is null then raise exception 'task_not_found' using errcode='P0002'; end if;
  if not (public.is_admin() or (t.garden_id is not null and public.can_manage_garden(t.garden_id))) then
    raise exception 'task_manager_required' using errcode='42501'; end if;
  if t.status in ('done','cancelled') or p_priority not in ('low','medium','high','critical') then
    raise exception 'task_not_editable' using errcode='23514'; end if;
  if p_assigned_to is not null and not (
    (t.garden_id is null and exists(select 1 from public.profiles p where p.id=p_assigned_to and p.active and p.role::text='admin'))
    or (t.garden_id is not null and (
      exists(select 1 from public.garden_management_memberships m join public.profiles p on p.id=m.profile_id and p.active where m.profile_id=p_assigned_to and m.garden_id=t.garden_id and m.status='active' and m.relationship_role in ('owner','manager'))
      or exists(select 1 from public.staff_kindergarten_employments e join public.staff s on s.id=e.staff_id and s.profile_id=e.profile_id and s.garden_id=e.garden_id join public.profiles p on p.id=e.profile_id and p.active where e.profile_id=p_assigned_to and e.garden_id=t.garden_id and e.status='active' and (e.start_date is null or e.start_date<=current_date) and (e.end_date is null or e.end_date>=current_date) and s.approved_to_work and s.onboarding_status='active')
      or (public.is_approved_inspector(p_assigned_to) and exists(select 1 from public.gardens g where g.id=t.garden_id and g.inspector_id=p_assigned_to))
    ))
  ) then raise exception 'ineligible_task_assignee' using errcode='42501'; end if;
  if t.assigned_to is not distinct from p_assigned_to and t.due_at is not distinct from p_due_at and t.priority::text=p_priority then
    return t; end if;
  prior_assignee:=t.assigned_to; prior_due:=t.due_at;
  select * into actor from public.profiles where id=auth.uid() and active=true;
  if actor.id is null then raise exception 'active_actor_required' using errcode='42501'; end if;
  update public.tasks set assigned_to=p_assigned_to,due_at=p_due_at,priority=p_priority::public.severity_level,updated_at=now()
    where id=t.id returning * into t;
  if t.workflow_task_id is not null then
    update public.workflow_tasks set assigned_to=t.assigned_to,due_at=t.due_at,priority=t.priority::text,updated_at=now()
      where id=t.workflow_task_id;
  end if;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,before_data,after_data)
  values(actor.id,actor.role,t.garden_id,'tasks',t.id,'task_assignment_or_due_changed',
    jsonb_build_object('assigned_to',prior_assignee,'due_at',prior_due),
    jsonb_build_object('assigned_to',t.assigned_to,'due_at',t.due_at,'priority',t.priority));
  if t.assigned_to is not null and t.assigned_to is distinct from prior_assignee then
    insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,channel,status)
    values(t.garden_id,t.assigned_to,'משימה הוקצתה לך',t.title,'task',t.id,'in_app','pending');
  end if;
  return t;
end; $$;

-- The legacy escalation RPC accepted a caller-supplied actor id and had no
-- garden check. Keep its signature for old clients but ignore that argument.
create or replace function public.escalate_task(p_task_id uuid,p_reason text,p_actor_id uuid default auth.uid())
returns public.tasks language plpgsql security definer set search_path=public as $$
declare t public.tasks%rowtype; actor public.profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into t from public.tasks where id=p_task_id for update;
  if t.id is null then raise exception 'task_not_found' using errcode='P0002'; end if;
  if not (public.is_admin() or (t.garden_id is not null and public.can_inspector_access_garden(t.garden_id))) then
    raise exception 'task_escalation_denied' using errcode='42501'; end if;
  if nullif(btrim(p_reason),'') is null or length(p_reason)>2000 then
    raise exception 'reason_required' using errcode='23514'; end if;
  select * into actor from public.profiles where id=auth.uid() and active=true;
  if actor.id is null then raise exception 'active_actor_required' using errcode='42501'; end if;
  update public.tasks set escalated_at=now(),escalated_by=actor.id,escalation_reason=p_reason,
    priority='critical',updated_at=now() where id=t.id returning * into t;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(actor.id,actor.role,t.garden_id,'tasks',t.id,'task_escalated',jsonb_build_object('reason',p_reason));
  return t;
end; $$;

revoke all on function public.create_management_task(uuid,text,text,uuid,timestamptz,text) from public,anon;
revoke all on function public.create_task_from_source(text,uuid,uuid,text) from public,anon;
revoke all on function public.transition_management_task(uuid,text,text) from public,anon;
revoke all on function public.update_management_task(uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.create_management_task(uuid,text,text,uuid,timestamptz,text) to authenticated;
grant execute on function public.create_task_from_source(text,uuid,uuid,text) to authenticated;
grant execute on function public.transition_management_task(uuid,text,text) to authenticated;
grant execute on function public.update_management_task(uuid,uuid,timestamptz,text) to authenticated;
