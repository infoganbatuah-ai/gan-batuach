begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- ci: destructive-reviewed — only the locked request's calculated scope rows
-- are replaced; any subsequent insert, update or audit failure rolls back the
-- deletion in this same transaction. No subject data or evidence is deleted.

-- The Admin action previously sent delete, insert, request update and audit as
-- independent Data API requests. Keep the whole replacement in one transaction.
create or replace function public.management_replace_privacy_scope(
  p_request_id uuid, p_items jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.privacy_rights_requests%rowtype;
  v_summary jsonb;
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 32 then
    raise exception 'Privacy scope must contain 1 to 32 items' using errcode = '22023';
  end if;

  select * into v_request from public.privacy_rights_requests
  where id = p_request_id for update;
  if not found or v_request.observer_site_id is not null
     or v_request.organization_id is not null
     or v_request.status in ('completed','rejected','cancelled','blocked_by_legal_hold') then
    raise exception 'Management privacy request cannot be scoped' using errcode = '23514';
  end if;

  delete from public.privacy_request_scope_items where privacy_request_id = p_request_id;
  insert into public.privacy_request_scope_items
    (privacy_request_id,data_category,table_name,estimated_record_count,
     action_recommendation,parent_export_allowed,blocked_by_retention,notes,metadata)
  select p_request_id, i.data_category, i.table_name, i.estimated_record_count,
    i.action_recommendation, coalesce(i.parent_export_allowed,false),
    i.action_recommendation = 'retain', i.notes,
    jsonb_build_object('source','phase156_scope_resolver')
  from jsonb_to_recordset(p_items) as i(
    data_category text, table_name text, estimated_record_count integer,
    action_recommendation text, parent_export_allowed boolean, notes text
  )
  where length(btrim(coalesce(i.data_category,''))) between 1 and 120
    and length(btrim(coalesce(i.table_name,''))) between 1 and 120
    and i.estimated_record_count between 0 and 10000000
    and length(coalesce(i.notes,'')) <= 1000;
  if (select count(*) from public.privacy_request_scope_items
      where privacy_request_id = p_request_id) <> jsonb_array_length(p_items) then
    raise exception 'Invalid or incomplete privacy scope items' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'totalRecords',coalesce(sum(estimated_record_count),0),
    'legalRetentionItems',count(*) filter (where action_recommendation='retain'),
    'exportableItems',count(*) filter (where parent_export_allowed),
    'deletionCandidates',count(*) filter (where action_recommendation in ('delete','anonymize')),
    'categories',to_jsonb(array(select distinct s.data_category
      from public.privacy_request_scope_items s
      where s.privacy_request_id=p_request_id order by s.data_category))
  ) into v_summary
  from public.privacy_request_scope_items where privacy_request_id=p_request_id;

  update public.privacy_rights_requests set
    status = case when status='submitted' then 'under_review' else status end,
    execution_status='scoped', scope_calculated_at=v_now,
    retention_conflicts=coalesce((select jsonb_agg(to_jsonb(s))
      from public.privacy_request_scope_items s
      where s.privacy_request_id=p_request_id and s.action_recommendation='retain'),'[]'::jsonb),
    metadata=jsonb_set(coalesce(metadata,'{}'::jsonb),'{scope_summary}',v_summary,true),
    updated_at=v_now
  where id=p_request_id;

  insert into public.immutable_audit_events
    (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
     garden_id,child_id,metadata,risk_level)
  values ('privacy_scope_calculated','regulatory',auth.uid(),'admin','privacy_request',
    p_request_id,v_request.garden_id,v_request.child_id,v_summary,'high');
  return v_summary;
end;
$$;
revoke all on function public.management_replace_privacy_scope(uuid,jsonb) from public, anon;
grant execute on function public.management_replace_privacy_scope(uuid,jsonb) to authenticated;
revoke insert, update, delete on public.privacy_request_scope_items from public, anon, authenticated;

-- A direct request update must not bypass the persisted-hold condition even if
-- its JSON conflict list is syntactically nonempty.
create or replace function public.management_privacy_hold_link_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.observer_site_id is not null or new.organization_id is not null
     or new.status <> 'blocked_by_legal_hold' then
    return new;
  end if;
  if not exists (
    select 1 from public.legal_holds h
    join lateral jsonb_array_elements(
      case when jsonb_typeof(new.legal_hold_conflicts)='array'
        then new.legal_hold_conflicts else '[]'::jsonb end
    ) c on c->>'hold_id'=h.id::text
    where h.status='active'
      and h.metadata->>'privacy_request_id'=new.id::text
  ) then
    raise exception 'Blocked Management privacy request needs a persisted active hold'
      using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function public.management_privacy_hold_link_guard() from public, anon, authenticated;
drop trigger if exists management_privacy_hold_link_guard on public.privacy_rights_requests;
create trigger management_privacy_hold_link_guard
before insert or update on public.privacy_rights_requests
for each row execute function public.management_privacy_hold_link_guard();

-- A blocked request must reference a persisted active hold. The row lock also
-- serializes retries so a repeated action reuses the same hold and audit event.
create or replace function public.management_create_privacy_hold(
  p_request_id uuid, p_reason text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.privacy_rights_requests%rowtype;
  v_hold_id uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason,''))) not between 12 and 400 then
    raise exception 'Documented hold reason required' using errcode = '22023';
  end if;
  select * into v_request from public.privacy_rights_requests
  where id=p_request_id for update;
  if not found or v_request.observer_site_id is not null
     or v_request.organization_id is not null
     or v_request.status in ('completed','rejected','cancelled') then
    raise exception 'Management privacy request cannot be held' using errcode = '23514';
  end if;

  select id into v_hold_id from public.legal_holds
  where metadata->>'privacy_request_id'=p_request_id::text and status='active'
  order by created_at,id limit 1 for update;
  if v_hold_id is not null and v_request.status='blocked_by_legal_hold'
     and v_request.legal_hold_conflicts @> jsonb_build_array(jsonb_build_object('hold_id',v_hold_id)) then
    return v_hold_id;
  end if;
  if v_hold_id is null then
    insert into public.legal_holds
      (hold_key,hold_reason,hold_type,status,garden_id,child_id,subject_user_id,
       created_by,metadata)
    values ('privacy:'||p_request_id::text||':'||gen_random_uuid()::text,
      btrim(p_reason),'audit_preservation','active',v_request.garden_id,
      v_request.child_id,coalesce(v_request.subject_user_id,v_request.requested_by),
      auth.uid(),jsonb_build_object('privacy_request_id',p_request_id,
        'source','admin_privacy_rights'))
    returning id into v_hold_id;
  end if;

  update public.privacy_rights_requests set
    status='blocked_by_legal_hold',execution_status='blocked',
    legal_hold_checked_at=v_now,
    legal_hold_conflicts=jsonb_build_array(jsonb_build_object(
      'hold_id',v_hold_id,'reason',btrim(p_reason))),updated_at=v_now
  where id=p_request_id;

  insert into public.immutable_audit_events
    (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
     garden_id,child_id,metadata,risk_level)
  values ('legal_hold_checked','regulatory',auth.uid(),'admin','privacy_request',
    p_request_id,v_request.garden_id,v_request.child_id,
    jsonb_build_object('hold_id',v_hold_id,'reason',btrim(p_reason)),'high');
  return v_hold_id;
end;
$$;
revoke all on function public.management_create_privacy_hold(uuid,text) from public, anon;
grant execute on function public.management_create_privacy_hold(uuid,text) to authenticated;

commit;
