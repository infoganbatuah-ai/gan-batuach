begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Only the authenticated Parent's own display name. This stores the necessary
-- proposed value and a digest of the original, not a second copy of old PII.
-- Retention of request/proposal evidence remains subject to legal review.
create table public.privacy_parent_name_correction_proposals (
  privacy_request_id uuid primary key references public.privacy_rights_requests(id) on delete restrict,
  requester_profile_id uuid not null references public.profiles(id) on delete restrict,
  proposed_full_name text not null,
  original_name_sha256 bytea not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_by uuid references public.profiles(id) on delete restrict,
  constraint privacy_parent_name_length check (char_length(proposed_full_name) between 2 and 120),
  constraint privacy_parent_name_digest_length check (octet_length(original_name_sha256) = 32),
  constraint privacy_parent_name_applied_pair check ((applied_at is null) = (applied_by is null))
);
create index privacy_parent_name_requester_idx
  on public.privacy_parent_name_correction_proposals(requester_profile_id,created_at desc);
alter table public.privacy_parent_name_correction_proposals enable row level security;
revoke all on public.privacy_parent_name_correction_proposals from public, anon, authenticated;
grant select on public.privacy_parent_name_correction_proposals to authenticated;
create policy "parent self or admin reads proposed name"
  on public.privacy_parent_name_correction_proposals for select to authenticated
  using (requester_profile_id = auth.uid() or public.is_admin());

create function public.management_submit_parent_name_correction(
  p_new_full_name text, p_reason text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_name text := btrim(coalesce(p_new_full_name,''));
  v_reason text := btrim(coalesce(p_reason,''));
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Authenticated Parent required' using errcode='42501';
  end if;
  select * into v_profile from public.profiles where id=v_actor for share;
  if not found or v_profile.role<>'parent' or v_profile.active is not true then
    raise exception 'Active Parent required' using errcode='42501';
  end if;
  if char_length(v_name) not between 2 and 120 or v_name ~ '[[:cntrl:]]'
     or v_name is not distinct from v_profile.full_name
     or char_length(v_reason) not between 12 and 1200
     or v_reason ~ '[[:cntrl:]]' then
    raise exception 'Invalid Parent name correction proposal' using errcode='22023';
  end if;
  if exists (
    select 1 from public.privacy_parent_name_correction_proposals p
    join public.privacy_rights_requests r on r.id=p.privacy_request_id
    where p.requester_profile_id=v_actor
      and r.status not in ('completed','rejected','cancelled')
  ) then
    raise exception 'Parent name correction already pending' using errcode='23505';
  end if;
  insert into public.privacy_rights_requests
    (request_key,requester_profile_id,requested_by,subject_user_id,data_subject_id,
     data_subject_type,subject_type,request_type,status,due_at,request_reason,
     response_summary,metadata)
  values
    ('privacy-parent-name:'||gen_random_uuid(),v_actor,v_actor,v_actor,v_actor,
     'parent','parent','correction','submitted',now()+interval '30 days',v_reason,
     'בקשת תיקון השם האישי התקבלה לבדיקה ידנית.',
     jsonb_build_object('source','parent_self_name_correction','parent_visible',true))
  returning id into v_id;
  insert into public.privacy_parent_name_correction_proposals
    (privacy_request_id,requester_profile_id,proposed_full_name,original_name_sha256)
  values (v_id,v_actor,v_name,sha256(convert_to(v_profile.full_name,'UTF8')));
  insert into public.immutable_audit_events
    (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
     metadata,risk_level)
  values ('privacy_request_submitted','regulatory',v_actor,'parent','privacy_request',v_id,
    jsonb_build_object('request_type','correction','field','profiles.full_name','scope','self'),
    'medium');
  return v_id;
end;
$$;
revoke all on function public.management_submit_parent_name_correction(text,text)
  from public, anon, authenticated;
grant execute on function public.management_submit_parent_name_correction(text,text)
  to authenticated;

create function public.management_apply_parent_name_correction(p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := auth.uid();
  v_request public.privacy_rights_requests%rowtype;
  v_proposal public.privacy_parent_name_correction_proposals%rowtype;
  v_profile public.profiles%rowtype;
  v_audit_id uuid;
begin
  if v_admin is null or not public.is_admin() then
    raise exception 'Admin authorization required' using errcode='42501';
  end if;
  select * into v_request from public.privacy_rights_requests
    where id=p_request_id for update;
  select * into v_proposal from public.privacy_parent_name_correction_proposals
    where privacy_request_id=p_request_id for update;
  if not found or v_request.id is null or v_request.status<>'approved'
     or v_request.request_type<>'correction'
     or v_request.data_subject_type<>'parent' or v_request.subject_type<>'parent'
     or v_request.observer_site_id is not null or v_request.organization_id is not null
     or v_request.requester_profile_id is distinct from v_proposal.requester_profile_id
     or v_request.requested_by is distinct from v_proposal.requester_profile_id
     or v_request.subject_user_id is distinct from v_proposal.requester_profile_id
     or v_request.data_subject_id is distinct from v_proposal.requester_profile_id
     or v_request.child_id is not null or v_request.garden_id is not null
     or v_request.reviewer_id is null
     or v_request.scope_calculated_at is null or v_request.legal_hold_checked_at is null
     or v_request.retention_conflicts <> '[]'::jsonb
     or v_request.legal_hold_conflicts <> '[]'::jsonb
     or v_proposal.applied_at is not null
     or (select count(*) from public.privacy_request_scope_items s
         where s.privacy_request_id=p_request_id and s.table_name='profiles'
           and s.estimated_record_count=1
           and not s.blocked_by_legal_hold and not s.blocked_by_retention)<>1
     or exists (select 1 from public.legal_holds h
         where h.status in ('active','pending_release')
           and h.subject_user_id=v_proposal.requester_profile_id)
     or exists (select 1 from public.privacy_execution_actions a
         where a.privacy_request_id=p_request_id and a.action_type='correct') then
    raise exception 'Approved self-name correction not deliverable' using errcode='23514';
  end if;
  select * into v_profile from public.profiles
    where id=v_proposal.requester_profile_id for update;
  if not found or v_profile.role<>'parent' or v_profile.active is not true
     or sha256(convert_to(v_profile.full_name,'UTF8'))
        is distinct from v_proposal.original_name_sha256
     or v_profile.full_name is not distinct from v_proposal.proposed_full_name then
    raise exception 'Parent profile changed since proposal' using errcode='23514';
  end if;
  update public.privacy_rights_requests set
    status='processing',execution_status='processing',execution_started_at=now()
    where id=p_request_id;
  update public.profiles set full_name=v_proposal.proposed_full_name,updated_at=now()
    where id=v_profile.id;
  insert into public.immutable_audit_events
    (event_type,event_category,actor_profile_id,actor_role,target_type,target_id,
     metadata,risk_level)
  values ('privacy_execution_completed','regulatory',v_admin,'admin',
    'privacy_request',p_request_id,
    jsonb_build_object('action_type','correct','table','profiles','field','full_name',
      'subject_profile_id',v_profile.id), 'high')
  returning id into v_audit_id;
  insert into public.privacy_execution_actions
    (privacy_request_id,action_type,target_table,target_id,status,
     executed_by,executed_at,audit_event_id,notes,metadata)
  values (p_request_id,'correct','profiles',v_profile.id,'completed',v_admin,now(),v_audit_id,
    'Verified Parent self profile name correction',
    jsonb_build_object('field','full_name','scope','self'));
  update public.privacy_parent_name_correction_proposals set
    applied_at=now(),applied_by=v_admin where privacy_request_id=p_request_id;
  update public.privacy_rights_requests set
    status='completed',execution_status='completed',completed_at=now(),
    response_summary='השם בפרופיל האישי תוקן לאחר בדיקה ואישור מנהל המערכת.'
    where id=p_request_id;
  return jsonb_build_object('request_id',p_request_id,'status','completed',
    'field','profiles.full_name');
end;
$$;
revoke all on function public.management_apply_parent_name_correction(uuid)
  from public, anon, authenticated;
grant execute on function public.management_apply_parent_name_correction(uuid)
  to authenticated;

commit;
