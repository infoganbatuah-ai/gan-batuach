begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- An authenticated Admin may review a Management request, but a status change
-- alone is never proof that data was exported, corrected, restricted or erased.
-- Digital Observer requests retain their separately governed workflow.
create or replace function public.management_privacy_decision_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  required_action text;
  has_hold boolean;
  has_proof boolean;
begin
  if new.observer_site_id is not null or new.organization_id is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('received', 'submitted') or new.completed_at is not null then
      raise exception 'Management privacy request must begin submitted' using errcode = '23514';
    end if;
    return new;
  end if;

  if new.requester_profile_id is distinct from old.requester_profile_id
     or new.requested_by is distinct from old.requested_by
     or new.subject_user_id is distinct from old.subject_user_id
     or new.child_id is distinct from old.child_id
     or new.garden_id is distinct from old.garden_id
     or new.data_subject_type is distinct from old.data_subject_type
     or new.data_subject_id is distinct from old.data_subject_id
     or new.subject_type is distinct from old.subject_type
     or new.request_type is distinct from old.request_type then
    raise exception 'Privacy request subject is immutable' using errcode = '23514';
  end if;

  if old.status = 'completed' and (
       new.completed_at is distinct from old.completed_at
       or new.execution_status is distinct from old.execution_status
       or new.reviewer_id is distinct from old.reviewer_id
       or new.decision_reason is distinct from old.decision_reason
       or new.response_summary is distinct from old.response_summary
       or new.scope_calculated_at is distinct from old.scope_calculated_at
       or new.legal_hold_checked_at is distinct from old.legal_hold_checked_at
       or new.retention_conflicts is distinct from old.retention_conflicts
       or new.legal_hold_conflicts is distinct from old.legal_hold_conflicts
     ) then
    raise exception 'Completed privacy decision evidence is immutable' using errcode = '23514';
  end if;

  if old.status = 'rejected' and (
       new.reviewer_id is distinct from old.reviewer_id
       or new.decision_reason is distinct from old.decision_reason
       or new.response_summary is distinct from old.response_summary
     ) then
    raise exception 'Rejected privacy decision evidence is immutable' using errcode = '23514';
  end if;

  if new.status is distinct from old.status then
    if old.status in ('completed', 'rejected', 'cancelled') or not (
      (old.status in ('received', 'submitted', 'validating') and new.status in ('validating', 'under_review', 'approved', 'rejected', 'cancelled', 'blocked_by_legal_hold'))
      or (old.status in ('under_review', 'waiting_approval') and new.status in ('waiting_approval', 'approved', 'rejected', 'cancelled', 'blocked_by_legal_hold'))
      or (old.status = 'approved' and new.status in ('processing', 'rejected', 'blocked_by_legal_hold'))
      or (old.status in ('processing', 'in_progress') and new.status in ('completed', 'rejected', 'blocked_by_legal_hold'))
      or (old.status = 'blocked_by_legal_hold' and new.status = 'under_review')
    ) then
      raise exception 'Invalid Management privacy status transition' using errcode = '23514';
    end if;
  end if;

  if new.status = 'rejected' and length(btrim(coalesce(new.decision_reason, ''))) < 12 then
    raise exception 'Privacy rejection needs a documented reason' using errcode = '23514';
  end if;

  if new.status = 'blocked_by_legal_hold' and (
       new.legal_hold_checked_at is null
       or jsonb_typeof(new.legal_hold_conflicts) is distinct from 'array'
       or jsonb_array_length(new.legal_hold_conflicts) = 0
     ) then
    raise exception 'Privacy hold must be documented' using errcode = '23514';
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    if new.completed_at is null or new.scope_calculated_at is null
       or new.legal_hold_checked_at is null or new.execution_status <> 'completed'
       or new.reviewer_id is null
       or length(btrim(coalesce(new.decision_reason, ''))) < 12
       or length(btrim(coalesce(new.response_summary, ''))) < 12 then
      raise exception 'Privacy completion lacks review and fulfillment proof' using errcode = '23514';
    end if;
    if jsonb_typeof(new.retention_conflicts) is distinct from 'array'
       or jsonb_typeof(new.legal_hold_conflicts) is distinct from 'array'
       or jsonb_array_length(new.retention_conflicts) <> 0
       or jsonb_array_length(new.legal_hold_conflicts) <> 0 then
      raise exception 'Privacy completion has unresolved retention or hold conflicts' using errcode = '23514';
    end if;
    required_action := case new.request_type
      when 'access' then 'notify_user'
      when 'correction' then 'correct'
      when 'export' then 'export'
      when 'deletion' then 'delete'
      when 'anonymization' then 'anonymize'
      when 'restriction' then 'revoke_access'
      when 'objection' then 'revoke_access'
      else null end;
    if required_action is null then
      raise exception 'Privacy request type has no verified completion action' using errcode = '23514';
    end if;
    select exists (
      select 1 from public.privacy_execution_actions a
      join public.immutable_audit_events e on e.id = a.audit_event_id
      where a.privacy_request_id = new.id and a.action_type = required_action
        and a.status = 'completed' and a.executed_at is not null
        and a.executed_by is not null and length(btrim(coalesce(a.notes, ''))) >= 12
        and e.event_type = 'privacy_execution_completed'
        and e.target_type = 'privacy_request' and e.target_id = new.id
        and e.actor_profile_id = a.executed_by and e.event_hash is not null
    ) into has_proof;
    if not has_proof then
      raise exception 'Privacy completion lacks an audited fulfilled action' using errcode = '23514';
    end if;
    if new.request_type in ('deletion', 'anonymization', 'restriction', 'objection') then
      if new.legal_hold_checked_at < new.scope_calculated_at then
        raise exception 'Privacy legal hold check precedes current scope' using errcode = '23514';
      end if;
      select exists (
        select 1 from public.legal_holds h
        where h.status in ('active', 'pending_release')
          and (h.child_id = new.child_id or h.garden_id = new.garden_id
            or h.subject_user_id = new.subject_user_id)
      ) into has_hold;
      if has_hold then
        raise exception 'Active legal hold blocks privacy completion' using errcode = '23514';
      end if;
    end if;
  elsif new.status <> 'completed' and new.completed_at is not null then
    raise exception 'Incomplete privacy request cannot have completed_at' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.management_privacy_decision_guard() from public, anon, authenticated;
drop trigger if exists management_privacy_decision_guard on public.privacy_rights_requests;
create trigger management_privacy_decision_guard
before insert or update on public.privacy_rights_requests
for each row execute function public.management_privacy_decision_guard();

-- Documented execution remains a privileged, separately reviewed workflow.
-- The Admin page does not create these rows; direct Data API writes cannot
-- manufacture completion evidence.
revoke insert, update, delete on public.privacy_execution_actions from public, anon, authenticated;

commit;
