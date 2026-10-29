-- Follow-up to 20261029215625: once the obsolete role-claim guard was removed,
-- PostgreSQL reached the function body and exposed an ambiguous identifier
-- between the PL/pgSQL row variable and the table alias named `c`. Use distinct
-- names throughout while preserving the service_role-only EXECUTE boundary.
create or replace function public.escalate_overdue_complaints(
  p_at timestamptz default now(),
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  complaint_row public.complaints%rowtype;
  processed integer := 0;
  reason text;
  reviewer uuid;
begin
  if p_limit not between 1 and 500 then
    raise exception 'invalid_batch_size' using errcode = '23514';
  end if;

  -- Current Inspector authority wins over the historical assignee.
  -- Suspended or reassigned cases return to the Admin queue.
  for complaint_row in
    select complaint_candidate.*
    from public.complaints as complaint_candidate
    join public.gardens as garden on garden.id = complaint_candidate.garden_id
    where complaint_candidate.status::text not in ('closed', 'resolved')
      and complaint_candidate.routing_state in ('inspector', 'admin_queue', 'unrouted')
      and (
        complaint_candidate.assigned_inspector_id is distinct from
          (case when public.is_approved_inspector(garden.inspector_id) then garden.inspector_id else null end)
        or complaint_candidate.routing_state is distinct from
          (case when public.is_approved_inspector(garden.inspector_id) then 'inspector' else 'admin_queue' end)
      )
    order by complaint_candidate.created_at, complaint_candidate.id
    for update of complaint_candidate skip locked
    limit p_limit
  loop
    select garden.inspector_id
    into reviewer
    from public.gardens as garden
    where garden.id = complaint_row.garden_id;

    if reviewer is not null and not public.is_approved_inspector(reviewer) then
      reviewer := null;
    end if;

    if complaint_row.assigned_inspector_id is distinct from reviewer
      or complaint_row.routing_state is distinct from
        (case when reviewer is null then 'admin_queue' else 'inspector' end)
    then
      update public.complaints
      set assigned_inspector_id = reviewer,
          routing_state = case when reviewer is null then 'admin_queue' else 'inspector' end,
          revision = revision + 1
      where id = complaint_row.id;

      update public.tasks
      set assigned_to = reviewer
      where source_entity_type = 'complaint'
        and source_entity_id = complaint_row.id
        and status::text not in ('done', 'cancelled');

      insert into public.complaint_events(
        complaint_id,
        garden_id,
        action,
        from_status,
        to_status
      )
      values (
        complaint_row.id,
        complaint_row.garden_id,
        case when reviewer is null then 'routed_admin_queue' else 'routed_inspector' end,
        complaint_row.status,
        complaint_row.status
      );

      insert into public.audit_logs(
        garden_id,
        entity_type,
        entity_id,
        action,
        after_data
      )
      values (
        complaint_row.garden_id,
        'complaints',
        complaint_row.id,
        'complaint_reassigned',
        jsonb_build_object(
          'routing_state',
          case when reviewer is null then 'admin_queue' else 'inspector' end
        )
      );
    end if;
  end loop;

  for complaint_row in
    select complaint_candidate.*
    from public.complaints as complaint_candidate
    where complaint_candidate.status::text not in ('closed', 'resolved', 'escalated')
      and complaint_candidate.sla_policy_id is not null
      and (
        (complaint_candidate.acknowledgement_due_at < p_at and complaint_candidate.acknowledged_at is null)
        or (complaint_candidate.response_due_at < p_at and complaint_candidate.last_response_at is null)
        or complaint_candidate.resolution_due_at < p_at
      )
    order by coalesce(
      complaint_candidate.acknowledgement_due_at,
      complaint_candidate.response_due_at,
      complaint_candidate.resolution_due_at
    ), complaint_candidate.id
    for update of complaint_candidate skip locked
    limit p_limit
  loop
    reason := case
      when complaint_row.acknowledgement_due_at < p_at and complaint_row.acknowledged_at is null
        then 'acknowledgement_overdue'
      when complaint_row.response_due_at < p_at and complaint_row.last_response_at is null
        then 'response_overdue'
      else 'resolution_overdue'
    end;

    update public.complaints
    set status = 'escalated',
        routing_state = 'admin_queue',
        escalated_at = p_at,
        revision = revision + 1
    where id = complaint_row.id;

    update public.tasks
    set assigned_to = null,
        due_at = p_at
    where source_entity_type = 'complaint'
      and source_entity_id = complaint_row.id
      and status::text not in ('done', 'cancelled');

    insert into public.complaint_events(
      complaint_id,
      garden_id,
      action,
      from_status,
      to_status,
      internal_note
    )
    values (
      complaint_row.id,
      complaint_row.garden_id,
      'sla_escalated',
      complaint_row.status,
      'escalated',
      reason
    );

    insert into public.audit_logs(
      garden_id,
      entity_type,
      entity_id,
      action,
      after_data
    )
    values (
      complaint_row.garden_id,
      'complaints',
      complaint_row.id,
      'complaint_sla_escalated',
      jsonb_build_object('reason', reason)
    );

    processed := processed + 1;
  end loop;

  return processed;
end;
$$;

revoke all on function public.escalate_overdue_complaints(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.escalate_overdue_complaints(timestamptz, integer)
  to service_role;

comment on function public.escalate_overdue_complaints(timestamptz, integer) is
  'Service-role-only complaint SLA escalation with unambiguous row and table identifiers.';

notify pgrst, 'reload schema';
