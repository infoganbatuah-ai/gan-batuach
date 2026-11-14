begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- A bounded, metadata-only delivery window. No child data, media, or export
-- artifact is stored here. Revoked and expired rows remain as no-reissue proof.
create table public.privacy_child_garden_delivery_grants (
  privacy_request_id uuid primary key references public.privacy_rights_requests(id) on delete restrict,
  requester_profile_id uuid not null references public.profiles(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete restrict,
  garden_id uuid not null references public.gardens(id) on delete restrict,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  access_count integer not null default 0 check (access_count between 0 and 3),
  last_access_at timestamptz,
  constraint privacy_child_garden_delivery_expiry_check
    check (expires_at > issued_at and expires_at <= issued_at + interval '24 hours')
);
create index privacy_child_garden_delivery_expiry_idx
  on public.privacy_child_garden_delivery_grants(expires_at);
alter table public.privacy_child_garden_delivery_grants enable row level security;
revoke all on public.privacy_child_garden_delivery_grants from public, anon, authenticated;
grant select on public.privacy_child_garden_delivery_grants to authenticated;
create policy "requester or admin child delivery grant read"
  on public.privacy_child_garden_delivery_grants for select to authenticated
  using (requester_profile_id = auth.uid() or public.is_admin());

-- Only current, explicitly verified legal guardians with profile scope qualify.
-- This helper is callable only inside the audited SECURITY DEFINER functions.
create function public.management_privacy_child_delivery_authorized(
  p_child_id uuid, p_requester_id uuid, p_garden_id uuid
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.children c
    join public.profiles p on p.id=p_requester_id
    join public.child_guardian_links l
      on l.permanent_child_file_id=c.permanent_child_file_id
     and l.guardian_profile_id=p.id
    where c.id=p_child_id and c.garden_id=p_garden_id
      and p.active is true and p.role='parent'
      and l.status='active' and l.legal_authority is true
      and l.verified_at is not null
      and l.valid_from<=now() and (l.valid_until is null or l.valid_until>now())
      and l.access_scope->>'profile'='true'
  )
$$;
revoke all on function public.management_privacy_child_delivery_authorized(uuid,uuid,uuid)
  from public, anon, authenticated;

create function public.management_issue_privacy_child_garden_delivery(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.privacy_rights_requests%rowtype;
  v_grant public.privacy_child_garden_delivery_grants%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  select * into v_request from public.privacy_rights_requests
    where id=p_request_id for update;
  if not found or v_request.observer_site_id is not null
     or v_request.organization_id is not null
     or v_request.status<>'approved'
     or v_request.request_type not in ('access','export')
     or v_request.data_subject_type<>'child' or v_request.subject_type<>'child'
     or v_request.requester_profile_id is null
     or v_request.requested_by is distinct from v_request.requester_profile_id
     or v_request.subject_user_id is not null
     or v_request.child_id is null or v_request.garden_id is null
     or v_request.data_subject_id is distinct from v_request.child_id
     or v_request.scope_calculated_at is null
     or v_request.legal_hold_checked_at is null
     or not public.management_privacy_child_delivery_authorized(
       v_request.child_id,v_request.requester_profile_id,v_request.garden_id)
     or (select count(*) from public.privacy_request_scope_items s
         where s.privacy_request_id=p_request_id and s.table_name='children'
           and s.estimated_record_count=1 and s.parent_export_allowed is true
           and s.blocked_by_legal_hold is false and s.blocked_by_retention is false)<>1
     or (select count(*) from public.privacy_request_scope_items s
         where s.privacy_request_id=p_request_id and s.table_name='gardens'
           and s.estimated_record_count=1 and s.parent_export_allowed is true
           and s.blocked_by_legal_hold is false and s.blocked_by_retention is false)<>1
     or exists (select 1 from public.privacy_request_scope_items s
         where s.privacy_request_id=p_request_id
           and s.table_name in ('children','gardens')
           and (s.blocked_by_legal_hold is true or s.blocked_by_retention is true))
     or exists (select 1 from public.legal_holds h
         where h.status in ('active','pending_release')
           and (h.child_id=v_request.child_id or h.garden_id=v_request.garden_id
             or h.subject_user_id=v_request.requester_profile_id)) then
    raise exception 'Approved child/Garden identity request is not deliverable'
      using errcode='23514';
  end if;
  insert into public.privacy_child_garden_delivery_grants
    (privacy_request_id,requester_profile_id,child_id,garden_id,issued_by,expires_at)
  values (p_request_id,v_request.requester_profile_id,v_request.child_id,
    v_request.garden_id,auth.uid(),now()+interval '24 hours')
  on conflict (privacy_request_id) do nothing
  returning * into v_grant;
  if not found then
    select * into v_grant from public.privacy_child_garden_delivery_grants
      where privacy_request_id=p_request_id;
  else
    insert into public.immutable_audit_events
      (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
       garden_id,child_id,metadata,risk_level)
    values ('privacy_child_garden_delivery_granted','regulatory',auth.uid(),'admin',
      'privacy_request',p_request_id,v_request.garden_id,v_request.child_id,
      jsonb_build_object('coverage','child_garden_identity_only',
        'request_type',v_request.request_type),'high');
  end if;
  if v_grant.requester_profile_id is distinct from v_request.requester_profile_id
     or v_grant.child_id is distinct from v_request.child_id
     or v_grant.garden_id is distinct from v_request.garden_id
     or v_grant.revoked_at is not null or now()>=v_grant.expires_at
     or v_grant.access_count>=3 then
    raise exception 'Delivery cannot be reissued' using errcode='23514';
  end if;
  return jsonb_build_object('request_id',p_request_id,'coverage',
    'child_garden_identity_only','expires_at',v_grant.expires_at,
    'remaining_reads',3-v_grant.access_count);
end;
$$;
revoke all on function public.management_issue_privacy_child_garden_delivery(uuid)
  from public, anon;
grant execute on function public.management_issue_privacy_child_garden_delivery(uuid)
  to authenticated;

create function public.management_revoke_privacy_child_garden_delivery(p_request_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_grant public.privacy_child_garden_delivery_grants%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  select * into v_grant from public.privacy_child_garden_delivery_grants
    where privacy_request_id=p_request_id for update;
  if not found then raise exception 'Delivery unavailable' using errcode='23514'; end if;
  if v_grant.revoked_at is null then
    update public.privacy_child_garden_delivery_grants set revoked_at=now()
      where privacy_request_id=p_request_id;
    insert into public.immutable_audit_events
      (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
       garden_id,child_id,metadata,risk_level)
    values ('privacy_child_garden_delivery_revoked','regulatory',auth.uid(),'admin',
      'privacy_request',p_request_id,v_grant.garden_id,v_grant.child_id,
      jsonb_build_object('coverage','child_garden_identity_only'),'high');
  end if;
  return true;
end;
$$;
revoke all on function public.management_revoke_privacy_child_garden_delivery(uuid)
  from public, anon;
grant execute on function public.management_revoke_privacy_child_garden_delivery(uuid)
  to authenticated;

create function public.management_read_privacy_child_garden_delivery(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_grant public.privacy_child_garden_delivery_grants%rowtype;
  v_request public.privacy_rights_requests%rowtype;
  v_child public.children%rowtype;
  v_garden public.gardens%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authenticated requester required' using errcode='42501';
  end if;
  select * into v_grant from public.privacy_child_garden_delivery_grants
    where privacy_request_id=p_request_id for update;
  if not found or v_grant.requester_profile_id is distinct from auth.uid()
     or v_grant.revoked_at is not null or now()>=v_grant.expires_at
     or v_grant.access_count>=3 then
    raise exception 'Delivery unavailable to requester' using errcode='42501';
  end if;
  select * into v_request from public.privacy_rights_requests
    where id=p_request_id;
  if not found or v_request.status<>'approved'
     or v_request.request_type not in ('access','export')
     or v_request.data_subject_type<>'child' or v_request.subject_type<>'child'
     or v_request.requester_profile_id is distinct from auth.uid()
     or v_request.requested_by is distinct from auth.uid()
     or v_request.subject_user_id is not null
     or v_request.child_id is distinct from v_grant.child_id
     or v_request.garden_id is distinct from v_grant.garden_id
     or v_request.data_subject_id is distinct from v_grant.child_id
     or v_request.observer_site_id is not null or v_request.organization_id is not null
     or not public.management_privacy_child_delivery_authorized(
       v_grant.child_id,auth.uid(),v_grant.garden_id)
     or (select count(*) from public.privacy_request_scope_items s
         where s.privacy_request_id=p_request_id and s.table_name='children'
           and s.estimated_record_count=1 and s.parent_export_allowed is true
           and s.blocked_by_legal_hold is false and s.blocked_by_retention is false)<>1
     or (select count(*) from public.privacy_request_scope_items s
         where s.privacy_request_id=p_request_id and s.table_name='gardens'
           and s.estimated_record_count=1 and s.parent_export_allowed is true
           and s.blocked_by_legal_hold is false and s.blocked_by_retention is false)<>1
     or exists (select 1 from public.privacy_request_scope_items s
         where s.privacy_request_id=p_request_id
           and s.table_name in ('children','gardens')
           and (s.blocked_by_legal_hold is true or s.blocked_by_retention is true))
     or exists (select 1 from public.legal_holds h
         where h.status in ('active','pending_release')
           and (h.child_id=v_grant.child_id or h.garden_id=v_grant.garden_id
             or h.subject_user_id=auth.uid())) then
    raise exception 'Delivery no longer authorized' using errcode='42501';
  end if;
  select * into v_child from public.children where id=v_grant.child_id
    and garden_id=v_grant.garden_id;
  select * into v_garden from public.gardens where id=v_grant.garden_id;
  if v_child.id is null or v_garden.id is null
     or octet_length(v_child.full_name)>512
     or octet_length(v_garden.name)>512
     or octet_length(v_garden.city)>256 then
    raise exception 'Bounded child/Garden identity unavailable' using errcode='22001';
  end if;
  update public.privacy_child_garden_delivery_grants
    set access_count=access_count+1,last_access_at=now()
    where privacy_request_id=p_request_id;
  insert into public.immutable_audit_events
    (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
     garden_id,child_id,metadata,risk_level)
  values ('privacy_child_garden_delivery_accessed','regulatory',auth.uid(),'parent',
    'privacy_request',p_request_id,v_grant.garden_id,v_grant.child_id,
    jsonb_build_object('coverage','child_garden_identity_only',
      'request_type',v_request.request_type,
      'access_number',v_grant.access_count+1),'high');
  return jsonb_build_object('request_type',v_request.request_type,
    'coverage','child_garden_identity_only','expires_at',v_grant.expires_at,
    'remaining_reads',2-v_grant.access_count,
    'child',jsonb_build_object('full_name',v_child.full_name,
      'birth_date',v_child.birth_date),
    'garden',jsonb_build_object('name',v_garden.name,'city',v_garden.city));
end;
$$;
revoke all on function public.management_read_privacy_child_garden_delivery(uuid)
  from public, anon;
grant execute on function public.management_read_privacy_child_garden_delivery(uuid)
  to authenticated;

commit;
