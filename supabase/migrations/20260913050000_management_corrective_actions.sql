-- GB-M23: inspection answers remain immutable findings; violations are their corrective actions.
-- Existing inspection-created tasks remain linked for GB-M24 consolidation.

alter table public.violations
  add column if not exists acknowledged_at timestamptz,
  add column if not exists submitted_at timestamptz,
  add column if not exists reopened_at timestamptz,
  add column if not exists responsible_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists review_note text;

create table if not exists public.corrective_action_events (
  id uuid primary key default gen_random_uuid(),
  violation_id uuid not null references public.violations(id) on delete cascade,
  garden_id uuid not null references public.gardens(id),
  actor_id uuid not null references public.profiles(id),
  action text not null,
  from_status public.task_status,
  to_status public.task_status not null,
  note text,
  evidence_paths jsonb not null default '[]'::jsonb,
  due_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists corrective_action_events_violation_created_idx on public.corrective_action_events(violation_id,created_at);
alter table public.corrective_action_events enable row level security;
revoke all on public.corrective_action_events from anon,authenticated;
grant select on public.corrective_action_events to authenticated;
create policy "management corrective action events read" on public.corrective_action_events for select using
  (public.is_admin() or public.can_manage_garden(garden_id) or public.can_inspector_access_garden(garden_id));

drop policy if exists "violations scoped" on public.violations;
drop policy if exists "violations inspector admin write" on public.violations;
create policy "management corrective actions read" on public.violations for select using
  (public.is_admin() or public.can_manage_garden(garden_id) or public.can_inspector_access_garden(garden_id));
revoke insert,update,delete on public.violations from anon,authenticated;

create or replace function public.transition_corrective_action(
  p_violation_id uuid, p_action text, p_note text default null,
  p_evidence_paths jsonb default '[]'::jsonb, p_due_at timestamptz default null,
  p_responsible_profile_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.violations%rowtype; next_status public.task_status; manager_allowed boolean;
  inspector_allowed boolean; actor uuid := auth.uid(); evidence_item text;
begin
  if actor is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into v from public.violations where id=p_violation_id for update;
  if v.id is null then raise exception 'corrective_action_not_found' using errcode='P0002'; end if;
  manager_allowed := public.can_manage_garden(v.garden_id);
  inspector_allowed := public.can_inspector_access_garden(v.garden_id);
  if not (manager_allowed or inspector_allowed or public.is_admin()) then
    raise exception 'corrective_action_not_authorized' using errcode='42501';
  end if;
  if p_note is not null and length(p_note)>2000 then raise exception 'note_too_long' using errcode='23514'; end if;
  if p_evidence_paths is null or jsonb_typeof(p_evidence_paths)<>'array' or jsonb_array_length(p_evidence_paths)>12 then
    raise exception 'invalid_evidence' using errcode='23514';
  end if;
  for evidence_item in select jsonb_array_elements_text(p_evidence_paths) loop
    if evidence_item !~ ('^inspection-reports/corrective-actions/' || v.id::text || '/[a-zA-Z0-9._-]+$') then
      raise exception 'invalid_evidence_path' using errcode='23514';
    end if;
  end loop;
  if p_action in ('acknowledge','progress','submit') and not manager_allowed then
    raise exception 'garden_manager_required' using errcode='42501';
  end if;
  if p_action in ('accept','reject','reopen','extend') and not (inspector_allowed or public.is_admin()) then
    raise exception 'assigned_inspector_required' using errcode='42501';
  end if;
  case p_action
    when 'acknowledge' then
      if v.status<>'open' then raise exception 'invalid_transition' using errcode='23514'; end if;
      next_status := 'in_progress';
    when 'progress' then
      if v.status not in ('open','in_progress','rejected','overdue') then raise exception 'invalid_transition' using errcode='23514'; end if;
      next_status := 'in_progress';
    when 'submit' then
      if v.status not in ('in_progress','rejected','overdue') or nullif(btrim(coalesce(p_note,v.correction_note,'')),'') is null then
        raise exception 'remediation_note_required_or_invalid_transition' using errcode='23514';
      end if;
      next_status := 'waiting_approval';
    when 'accept' then
      if v.status='done' then return jsonb_build_object('id',v.id,'status',v.status,'idempotent',true); end if;
      if v.status<>'waiting_approval' then raise exception 'invalid_transition' using errcode='23514'; end if;
      next_status := 'done';
    when 'reject' then
      if v.status<>'waiting_approval' or nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'rejection_reason_required_or_invalid_transition' using errcode='23514'; end if;
      next_status := 'rejected';
    when 'reopen' then
      if v.status not in ('done','rejected') or nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'reopen_reason_required_or_invalid_transition' using errcode='23514'; end if;
      next_status := 'in_progress';
    when 'extend' then
      if v.status='done' or p_due_at is null or p_due_at<=now() then raise exception 'invalid_deadline_extension' using errcode='23514'; end if;
      next_status := v.status;
    else raise exception 'unsupported_action' using errcode='23514';
  end case;
  if p_responsible_profile_id is not null then
    if not manager_allowed or not exists(select 1 from public.profiles p where p.id=p_responsible_profile_id and p.active and
      (p.id=actor or exists(select 1 from public.staff_kindergarten_employments e
        join public.staff s on s.id=e.staff_id and s.profile_id=e.profile_id and s.garden_id=e.garden_id
        where e.profile_id=p.id and e.garden_id=v.garden_id and e.status='active'
          and (e.start_date is null or e.start_date<=current_date)
          and (e.end_date is null or e.end_date>=current_date)
          and s.approved_to_work and s.onboarding_status='active'))) then
      raise exception 'invalid_responsible_profile' using errcode='42501';
    end if;
  end if;
  update public.violations set status=next_status,
    acknowledged_at=case when p_action='acknowledge' then now() else acknowledged_at end,
    submitted_at=case when p_action='submit' then now() else submitted_at end,
    reopened_at=case when p_action='reopen' then now() else reopened_at end,
    correction_note=case when p_action in ('progress','submit') then coalesce(p_note,correction_note) else correction_note end,
    correction_files=case when p_action in ('progress','submit') and jsonb_array_length(p_evidence_paths)>0 then correction_files || p_evidence_paths else correction_files end,
    review_note=case when p_action in ('reject','reopen') then p_note when p_action='accept' then null else review_note end,
    approved_by=case when p_action='accept' then actor when p_action='reopen' then null else approved_by end,
    approved_at=case when p_action='accept' then now() when p_action='reopen' then null else approved_at end,
    correction_due_at=case when p_action='extend' then p_due_at else correction_due_at end,
    responsible_profile_id=coalesce(p_responsible_profile_id,responsible_profile_id)
  where id=v.id;
  insert into public.corrective_action_events(violation_id,garden_id,actor_id,action,from_status,to_status,note,evidence_paths,due_at)
  values(v.id,v.garden_id,actor,p_action,v.status,next_status,p_note,p_evidence_paths,case when p_action='extend' then p_due_at else v.correction_due_at end);
  return jsonb_build_object('id',v.id,'garden_id',v.garden_id,'status',next_status,'overdue',next_status<>'done' and coalesce(p_due_at,v.correction_due_at)<now());
end $$;
revoke all on function public.transition_corrective_action(uuid,text,text,jsonb,timestamptz,uuid) from public,anon;
grant execute on function public.transition_corrective_action(uuid,text,text,jsonb,timestamptz,uuid) to authenticated;

create or replace function public.parent_corrective_action_summary(p_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.can_parent_access_garden(p_garden_id) then
    raise exception 'parent_garden_not_authorized' using errcode='42501';
  end if;
  select jsonb_build_object(
    'garden_id',p_garden_id,
    'open_count',count(*) filter(where status<>'done'),
    'resolved_count',count(*) filter(where status='done'),
    'overdue_count',count(*) filter(where status<>'done' and correction_due_at<now()),
    'last_updated_at',max(updated_at)
  ) into result from public.violations where garden_id=p_garden_id and inspection_id is not null;
  return result;
end $$;
revoke all on function public.parent_corrective_action_summary(uuid) from public,anon;
grant execute on function public.parent_corrective_action_summary(uuid) to authenticated;
