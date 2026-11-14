begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- A short-lived, authenticated in-app delivery grant. The profile data itself
-- remains in its canonical table; no duplicate export blob or public URL exists.
create table public.privacy_self_delivery_grants (
  privacy_request_id uuid primary key references public.privacy_rights_requests(id) on delete restrict,
  requester_profile_id uuid not null references public.profiles(id) on delete restrict,
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  access_count integer not null default 0 check (access_count between 0 and 3),
  last_access_at timestamptz,
  constraint privacy_self_delivery_expiry_check check (expires_at > issued_at and expires_at <= issued_at + interval '24 hours')
);
create index privacy_self_delivery_expiry_idx on public.privacy_self_delivery_grants(expires_at);
alter table public.privacy_self_delivery_grants enable row level security;
revoke all on public.privacy_self_delivery_grants from public, anon, authenticated;
grant select on public.privacy_self_delivery_grants to authenticated;
create policy "own or admin privacy delivery grant read"
on public.privacy_self_delivery_grants for select to authenticated
using (requester_profile_id = auth.uid() or public.is_admin());

create function public.management_issue_privacy_self_delivery(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.privacy_rights_requests%rowtype;
  v_grant public.privacy_self_delivery_grants%rowtype;
  v_inserted boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  select * into v_request from public.privacy_rights_requests
  where id=p_request_id for update;
  if not found or v_request.observer_site_id is not null
     or v_request.organization_id is not null or v_request.status <> 'approved'
     or v_request.request_type not in ('access','export')
     or v_request.requester_profile_id is null
     or v_request.requested_by is distinct from v_request.requester_profile_id
     or v_request.subject_user_id is distinct from v_request.requester_profile_id
     or v_request.data_subject_id is distinct from v_request.requester_profile_id
     or v_request.child_id is not null or v_request.garden_id is not null
     or v_request.scope_calculated_at is null
     or v_request.legal_hold_checked_at is null
     or not exists (select 1 from public.profiles p
       where p.id=v_request.requester_profile_id and p.active is true)
     or not exists (select 1 from public.privacy_request_scope_items s
       where s.privacy_request_id=p_request_id and s.table_name='profiles'
         and s.parent_export_allowed is true and s.estimated_record_count=1
         and s.blocked_by_legal_hold is false and s.blocked_by_retention is false)
     or exists (select 1 from public.legal_holds h
       where h.status in ('active','pending_release')
         and h.subject_user_id=v_request.requester_profile_id) then
    raise exception 'Approved self-profile request is not deliverable' using errcode='23514';
  end if;

  insert into public.privacy_self_delivery_grants
    (privacy_request_id,requester_profile_id,issued_by,expires_at)
  values (p_request_id,v_request.requester_profile_id,auth.uid(),now()+interval '24 hours')
  on conflict (privacy_request_id) do nothing
  returning * into v_grant;
  v_inserted := found;
  if not v_inserted then
    select * into v_grant from public.privacy_self_delivery_grants
    where privacy_request_id=p_request_id for update;
    if v_grant.revoked_at is not null or now() >= v_grant.expires_at then
      raise exception 'Delivery grant is expired or revoked' using errcode='23514';
    end if;
  else
    insert into public.immutable_audit_events
      (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,metadata,risk_level)
    values ('privacy_self_delivery_granted','regulatory',auth.uid(),'admin',
      'privacy_request',p_request_id,
      jsonb_build_object('coverage','self_profile_only','request_type',v_request.request_type,
        'expires_at',v_grant.expires_at),'high');
  end if;
  return jsonb_build_object('request_id',p_request_id,'expires_at',v_grant.expires_at,
    'remaining_reads',3-v_grant.access_count,'coverage','self_profile_only');
end;
$$;
revoke all on function public.management_issue_privacy_self_delivery(uuid) from public, anon;
grant execute on function public.management_issue_privacy_self_delivery(uuid) to authenticated;

create function public.management_revoke_privacy_self_delivery(p_request_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_grant public.privacy_self_delivery_grants%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  select * into v_grant from public.privacy_self_delivery_grants
  where privacy_request_id=p_request_id for update;
  if not found then return false; end if;
  if v_grant.revoked_at is null then
    update public.privacy_self_delivery_grants set revoked_at=now()
    where privacy_request_id=p_request_id;
    insert into public.immutable_audit_events
      (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,metadata,risk_level)
    values ('privacy_self_delivery_revoked','regulatory',auth.uid(),'admin',
      'privacy_request',p_request_id,
      jsonb_build_object('coverage','self_profile_only'),'high');
  end if;
  return true;
end;
$$;
revoke all on function public.management_revoke_privacy_self_delivery(uuid) from public, anon;
grant execute on function public.management_revoke_privacy_self_delivery(uuid) to authenticated;

create function public.management_read_privacy_self_delivery(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_grant public.privacy_self_delivery_grants%rowtype;
  v_request public.privacy_rights_requests%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authenticated requester required' using errcode='42501';
  end if;
  select * into v_grant from public.privacy_self_delivery_grants
  where privacy_request_id=p_request_id for update;
  if not found or v_grant.requester_profile_id is distinct from auth.uid()
     or v_grant.revoked_at is not null or now() >= v_grant.expires_at
     or v_grant.access_count >= 3 then
    raise exception 'Delivery unavailable to requester' using errcode='42501';
  end if;
  select * into v_request from public.privacy_rights_requests where id=p_request_id;
  if not found or v_request.status <> 'approved'
     or v_request.request_type not in ('access','export')
     or v_request.requester_profile_id is distinct from auth.uid()
     or v_request.requested_by is distinct from auth.uid()
     or v_request.subject_user_id is distinct from auth.uid()
     or v_request.data_subject_id is distinct from auth.uid()
     or v_request.child_id is not null or v_request.garden_id is not null
     or v_request.observer_site_id is not null or v_request.organization_id is not null
     or not exists (select 1 from public.privacy_request_scope_items s
       where s.privacy_request_id=p_request_id and s.table_name='profiles'
         and s.parent_export_allowed is true and s.estimated_record_count=1
         and s.blocked_by_legal_hold is false and s.blocked_by_retention is false)
     or exists (select 1 from public.legal_holds h
       where h.status in ('active','pending_release') and h.subject_user_id=auth.uid()) then
    raise exception 'Delivery no longer authorized' using errcode='42501';
  end if;
  select * into v_profile from public.profiles
  where id=auth.uid() and active is true;
  if not found then raise exception 'Requester profile unavailable' using errcode='42501'; end if;
  if octet_length(coalesce(v_profile.full_name,'')) > 512
     or octet_length(coalesce(v_profile.phone,'')) > 128 then
    raise exception 'Profile fields exceed bounded delivery size' using errcode='22001';
  end if;

  update public.privacy_self_delivery_grants
  set access_count=access_count+1,last_access_at=now()
  where privacy_request_id=p_request_id;
  insert into public.immutable_audit_events
    (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,metadata,risk_level)
  values ('privacy_self_delivery_accessed','regulatory',auth.uid(),v_profile.role::text,
    'privacy_request',p_request_id,
    jsonb_build_object('coverage','self_profile_only','request_type',v_request.request_type,
      'access_number',v_grant.access_count+1),'high');
  return jsonb_build_object('request_type',v_request.request_type,'coverage','self_profile_only',
    'expires_at',v_grant.expires_at,'remaining_reads',2-v_grant.access_count,
    'profile',jsonb_build_object('full_name',v_profile.full_name,'phone',v_profile.phone,
      'role',v_profile.role,'created_at',v_profile.created_at));
end;
$$;
revoke all on function public.management_read_privacy_self_delivery(uuid) from public, anon;
grant execute on function public.management_read_privacy_self_delivery(uuid) to authenticated;

commit;
