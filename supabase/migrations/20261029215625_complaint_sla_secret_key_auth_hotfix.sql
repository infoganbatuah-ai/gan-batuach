-- Production hotfix: modern Supabase sb_secret_* keys are authorized by the
-- API gateway/PostgREST as service_role but do not populate the legacy
-- role-claim GUC. The function ACL is the authoritative boundary:
-- PUBLIC, anon and authenticated remain revoked, while service_role alone can
-- execute the SECURITY DEFINER routine.
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
  c public.complaints%rowtype;
  processed integer := 0;
  reason text;
  reviewer uuid;
begin
  if p_limit not between 1 and 500 then
    raise exception 'invalid_batch_size' using errcode = '23514';
  end if;

  -- Current Inspector authority wins over the historical assignee.
  -- Suspended or reassigned cases return to the Admin queue.
  for c in
    select c.*
    from public.complaints c
    join public.gardens g on g.id = c.garden_id
    where c.status::text not in ('closed', 'resolved')
      and c.routing_state in ('inspector', 'admin_queue', 'unrouted')
      and (
        c.assigned_inspector_id is distinct from
          (case when public.is_approved_inspector(g.inspector_id) then g.inspector_id else null end)
        or c.routing_state is distinct from
          (case when public.is_approved_inspector(g.inspector_id) then 'inspector' else 'admin_queue' end)
      )
    order by c.created_at, c.id
    for update of c skip locked
    limit p_limit
  loop
    select g.inspector_id
    into reviewer
    from public.gardens g
    where g.id = c.garden_id;

    if reviewer is not null and not public.is_approved_inspector(reviewer) then
      reviewer := null;
    end if;

    if c.assigned_inspector_id is distinct from reviewer
      or c.routing_state is distinct from
        (case when reviewer is null then 'admin_queue' else 'inspector' end)
    then
      update public.complaints
      set assigned_inspector_id = reviewer,
          routing_state = case when reviewer is null then 'admin_queue' else 'inspector' end,
          revision = revision + 1
      where id = c.id;

      update public.tasks
      set assigned_to = reviewer
      where source_entity_type = 'complaint'
        and source_entity_id = c.id
        and status::text not in ('done', 'cancelled');

      insert into public.complaint_events(
        complaint_id,
        garden_id,
        action,
        from_status,
        to_status
      )
      values (
        c.id,
        c.garden_id,
        case when reviewer is null then 'routed_admin_queue' else 'routed_inspector' end,
        c.status,
        c.status
      );

      insert into public.audit_logs(
        garden_id,
        entity_type,
        entity_id,
        action,
        after_data
      )
      values (
        c.garden_id,
        'complaints',
        c.id,
        'complaint_reassigned',
        jsonb_build_object(
          'routing_state',
          case when reviewer is null then 'admin_queue' else 'inspector' end
        )
      );
    end if;
  end loop;

  for c in
    select *
    from public.complaints
    where status::text not in ('closed', 'resolved', 'escalated')
      and sla_policy_id is not null
      and (
        (acknowledgement_due_at < p_at and acknowledged_at is null)
        or (response_due_at < p_at and last_response_at is null)
        or resolution_due_at < p_at
      )
    order by coalesce(acknowledgement_due_at, response_due_at, resolution_due_at), id
    for update skip locked
    limit p_limit
  loop
    reason := case
      when c.acknowledgement_due_at < p_at and c.acknowledged_at is null
        then 'acknowledgement_overdue'
      when c.response_due_at < p_at and c.last_response_at is null
        then 'response_overdue'
      else 'resolution_overdue'
    end;

    update public.complaints
    set status = 'escalated',
        routing_state = 'admin_queue',
        escalated_at = p_at,
        revision = revision + 1
    where id = c.id;

    update public.tasks
    set assigned_to = null,
        due_at = p_at
    where source_entity_type = 'complaint'
      and source_entity_id = c.id
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
      c.id,
      c.garden_id,
      'sla_escalated',
      c.status,
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
      c.garden_id,
      'complaints',
      c.id,
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
  'Service-role-only complaint SLA escalation. Authorization is enforced by function EXECUTE grants; compatible with modern Supabase secret keys.';

notify pgrst, 'reload schema';
