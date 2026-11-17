begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Management decisions are review milestones, never fulfillment. A decision
-- and its append-only audit event must commit or fail as one transaction.
-- Digital Observer requests keep their separate workflow.
create or replace function public.management_privacy_approval_audit_guard()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.observer_site_id is not null or new.organization_id is not null
     or new.status is not distinct from old.status
     or new.status not in ('approved','rejected') then
    return new;
  end if;

  if auth.uid() is null or not public.is_admin()
     or new.reviewer_id is distinct from auth.uid() then
    raise exception 'Admin reviewer authorization required' using errcode='42501';
  end if;
  if length(btrim(coalesce(new.decision_reason,''))) not between 12 and 1200 then
    raise exception 'Documented privacy decision reason required' using errcode='22023';
  end if;

  if new.status='approved' then
    if new.scope_calculated_at is null or not exists (
      select 1 from public.privacy_request_scope_items s
      where s.privacy_request_id=new.id
    ) then
      raise exception 'Privacy scope must be calculated before approval' using errcode='23514';
    end if;
    if exists (
      select 1 from public.legal_holds h
      where h.status in ('active','pending_release')
        and (h.child_id=new.child_id or h.garden_id=new.garden_id
          or h.subject_user_id=new.subject_user_id)
    ) then
      raise exception 'Active legal hold blocks approval pending human review' using errcode='23514';
    end if;
    if new.request_type in ('deletion','anonymization','restriction') and (
      jsonb_typeof(new.retention_conflicts) is distinct from 'array'
      or jsonb_array_length(new.retention_conflicts)>0
    ) then
      raise exception 'Retention conflict blocks destructive approval' using errcode='23514';
    end if;
    new.legal_hold_checked_at=now();
    new.legal_hold_conflicts='[]'::jsonb;
  end if;

  insert into public.immutable_audit_events
    (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
     garden_id,child_id,metadata,risk_level)
  values
    ('privacy_request_'||new.status,'regulatory',auth.uid(),'admin',
     'privacy_request',new.id,new.garden_id,new.child_id,
     jsonb_build_object('request_type',new.request_type,'decision_status',new.status),
     case when new.status='approved' then 'high' else 'medium' end);
  return new;
end;
$$;

revoke all on function public.management_privacy_approval_audit_guard() from public, anon, authenticated;
drop trigger if exists management_privacy_approval_audit_guard on public.privacy_rights_requests;
create trigger management_privacy_approval_audit_guard
before update on public.privacy_rights_requests
for each row execute function public.management_privacy_approval_audit_guard();

commit;
