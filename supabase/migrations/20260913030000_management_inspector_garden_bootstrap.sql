-- GB-M21: Inspector-originated Gardens remain canonical pending Garden drafts.
-- GB-M10 uses this Garden column, but earlier migrations did not create it.
alter table public.gardens add column if not exists onboarding_status text not null default 'pending_completion';
update public.gardens set onboarding_status='active' where status::text='active' and onboarding_status='pending_completion';
alter table public.profiles drop constraint if exists profiles_self_service_role_check;
alter table public.profiles add constraint profiles_self_service_role_check
  check (self_service_role in ('parent','staff_candidate','inspector_candidate','kindergarten_manager','kindergarten_owner'));
alter table public.self_service_user_profiles drop constraint if exists self_service_user_profiles_requested_role_check;
alter table public.self_service_user_profiles add constraint self_service_user_profiles_requested_role_check
  check (requested_role in ('parent','staff_candidate','inspector_candidate','kindergarten_manager','kindergarten_owner'));
alter table public.gardens
  add column if not exists bootstrap_inspector_id uuid references public.profiles(id) on delete set null,
  add column if not exists bootstrap_cancelled_at timestamptz,
  add column if not exists bootstrap_assignment_status text
    check (bootstrap_assignment_status in ('pending','assigned','admin_reassignment_required'));
create index if not exists gardens_bootstrap_inspector_idx on public.gardens(bootstrap_inspector_id, status, created_at desc)
  where bootstrap_inspector_id is not null;
alter table public.gardens add constraint gardens_bootstrap_assignment_after_activation_check
  check (bootstrap_inspector_id is null or status::text='active' or inspector_id is null);

create or replace function public.create_inspector_preliminary_garden(p_name text,p_city text,p_address text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid(); existing public.gardens%rowtype; new_id uuid;
begin
  if actor_id is null or not public.is_approved_inspector(actor_id) then raise exception 'approved_inspector_required' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,'')))<2 or length(trim(coalesce(p_city,'')))<2 then raise exception 'garden_details_required' using errcode='23514'; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(p_name))||'|'||lower(trim(p_city)),21));
  select * into existing from public.gardens g
    where lower(trim(g.name))=lower(trim(p_name)) and lower(trim(g.city))=lower(trim(p_city))
      and g.status::text<>'archived' order by g.created_at limit 1;
  if existing.id is not null then
    if existing.bootstrap_inspector_id=actor_id and existing.status::text='pending' and existing.bootstrap_cancelled_at is null then
      return jsonb_build_object('garden_id',existing.id,'already_exists',true,'status','preliminary');
    end if;
    return jsonb_build_object('status','duplicate_review_required');
  end if;
  insert into public.gardens(name,city,address,status,approval_flow_status,final_approval_status,onboarding_status,
    activation_payment_status,public_profile_enabled,eligible_for_safe_status,safe_status,ages,bootstrap_inspector_id,bootstrap_assignment_status)
  values(trim(p_name),trim(p_city),nullif(trim(coalesce(p_address,'')),''),'pending','activation_in_progress',
    'activation_in_progress','activation_in_progress','not_started',false,false,'pending_review','{}'::text[],actor_id,'pending')
  returning id into new_id;
  insert into public.kindergarten_onboarding_records(garden_id,lifecycle_status,progress_percent,completed_steps,missing_fields,
    profile_data,activation_steps,payment_status,subscription_monthly_amount,started_at,current_step,registrant_type)
  values(new_id,'activation_in_progress',0,'{}'::text[],array['owner_invitation','garden_details','identity','documents','consents'],
    jsonb_build_object('registration_source','inspector_preliminary','bootstrap_inspector_id',actor_id),
    '{}'::text[],'not_started',700,now(),'garden_details','owner_only');
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(actor_id,'inspector',new_id,'gardens',new_id,'inspector_preliminary_garden_created',jsonb_build_object('city',trim(p_city)));
  return jsonb_build_object('garden_id',new_id,'already_exists',false,'status','preliminary');
end $$;

create or replace function public.accept_inspector_garden_invitation(p_invitation_id uuid,p_token_hash text,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor public.profiles%rowtype; invitation public.management_invitations%rowtype; garden public.gardens%rowtype;
  onboarding public.kindergarten_onboarding_records%rowtype; kind text; relationship text; now_at timestamptz:=now();
begin
  select * into actor from public.profiles where id=auth.uid() for update;
  if actor.id is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select * into invitation from public.management_invitations where id=p_invitation_id for update;
  if invitation.id is null or invitation.token_hash<>p_token_hash or invitation.invitation_type<>'garden_management'
    or invitation.payload->>'source'<>'inspector_preliminary' then raise exception 'invitation_invalid' using errcode='42501'; end if;
  if invitation.status='accepted' and invitation.accepted_by=actor.id and p_accept then
    return jsonb_build_object('garden_id',invitation.garden_id,'status','accepted','already_accepted',true);
  end if;
  if invitation.status not in ('pending','delivered') or invitation.expires_at<=now_at then raise exception 'invitation_unavailable' using errcode='42501'; end if;
  if invitation.target_profile_id is not null and invitation.target_profile_id<>actor.id then raise exception 'recipient_mismatch' using errcode='42501'; end if;
  if invitation.recipient_email is null or lower(invitation.recipient_email)<>lower(coalesce(actor.email,''))
    or actor.email_verified_at is null then raise exception 'verified_recipient_mismatch' using errcode='42501'; end if;
  select * into garden from public.gardens where id=invitation.garden_id for update;
  if garden.id is null or garden.bootstrap_inspector_id<>invitation.created_by or garden.bootstrap_cancelled_at is not null
    or garden.status::text<>'pending' then raise exception 'preliminary_garden_unavailable' using errcode='42501'; end if;
  if not p_accept then
    update public.management_invitations set status='rejected',rejected_at=now_at,rejected_by=actor.id,updated_at=now_at where id=invitation.id;
    insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action)
    values(actor.id,actor.role,garden.id,'management_invitations',invitation.id,'inspector_garden_invitation_rejected');
    return jsonb_build_object('garden_id',garden.id,'status','rejected');
  end if;
  kind:=invitation.payload->>'registrant_type';
  if kind not in ('owner_only','owner_teacher','teacher_operator') then raise exception 'invitation_role_invalid' using errcode='23514'; end if;
  relationship:=case when kind='teacher_operator' then 'manager' else 'owner' end;
  if invitation.intended_role<>(case when relationship='owner' then 'kindergarten_owner' else 'kindergarten_manager' end)
    then raise exception 'invitation_role_mismatch' using errcode='42501'; end if;
  if actor.role::text<>relationship then raise exception 'account_role_mismatch' using errcode='42501'; end if;
  select * into onboarding from public.kindergarten_onboarding_records where garden_id=garden.id for update;
  if onboarding.id is null or onboarding.manager_id is not null then raise exception 'onboarding_already_claimed' using errcode='23514'; end if;
  update public.gardens set manager_id=actor.id,owner_profile_id=case when relationship='owner' then actor.id else null end,
    owner_name=actor.full_name,ownership_type=case kind when 'owner_teacher' then 'teacher_is_owner' when 'owner_only' then 'owner_only' else 'teacher_only' end,
    updated_at=now_at where id=garden.id;
  -- The GB-M09 direct-column mirror may insert an active row; normalize it before commit.
  update public.garden_management_memberships set status='pending',activated_at=null,is_default=false,ended_at=null,updated_at=now_at
    where garden_id=garden.id and profile_id=actor.id;
  insert into public.garden_management_memberships(profile_id,garden_id,relationship_role,status,is_default,source,metadata)
  values(actor.id,garden.id,relationship,'pending',false,'self_service',jsonb_build_object('invitation_id',invitation.id,'source','inspector_invitation'))
  on conflict(profile_id,garden_id,relationship_role) do update set status='pending',activated_at=null,is_default=false,ended_at=null,updated_at=now_at;
  update public.kindergarten_onboarding_records set manager_id=actor.id,registrant_type=kind,
    profile_data=profile_data||jsonb_build_object('invitation_id',invitation.id,'registration_source','inspector_preliminary'),
    lifecycle_status='activation_in_progress',started_at=coalesce(started_at,now_at),updated_at=now_at where id=onboarding.id;
  update public.management_invitations set status='accepted',accepted_at=now_at,accepted_by=actor.id,target_profile_id=actor.id,updated_at=now_at
    where id=invitation.id;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(actor.id,actor.role,garden.id,'management_invitations',invitation.id,'inspector_garden_invitation_accepted',jsonb_build_object('registrant_type',kind));
  return jsonb_build_object('garden_id',garden.id,'status','accepted','already_accepted',false,'activation_key',onboarding.activation_key);
end $$;

create or replace function public.cancel_inspector_preliminary_garden(p_garden_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid(); garden public.gardens%rowtype; onboarding public.kindergarten_onboarding_records%rowtype;
begin
  if actor_id is null or not public.is_approved_inspector(actor_id) then raise exception 'approved_inspector_required' using errcode='42501'; end if;
  select * into garden from public.gardens where id=p_garden_id for update;
  if garden.id is null or garden.bootstrap_inspector_id<>actor_id then raise exception 'preliminary_garden_not_found' using errcode='42501'; end if;
  if garden.bootstrap_cancelled_at is not null then return jsonb_build_object('status','cancelled','already_cancelled',true); end if;
  select * into onboarding from public.kindergarten_onboarding_records where garden_id=p_garden_id for update;
  if garden.status::text<>'pending' or onboarding.manager_id is not null then raise exception 'recipient_onboarding_started' using errcode='23514'; end if;
  update public.gardens set bootstrap_cancelled_at=now(),updated_at=now() where id=p_garden_id;
  update public.management_invitations set status='revoked',revoked_at=now(),updated_at=now()
    where garden_id=p_garden_id and invitation_type='garden_management' and status in ('pending','delivered');
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action)
    values(actor_id,'inspector',p_garden_id,'gardens',p_garden_id,'inspector_preliminary_garden_cancelled');
  return jsonb_build_object('status','cancelled','already_cancelled',false);
end $$;

create or replace function public.assign_bootstrap_inspector_on_activation()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.bootstrap_inspector_id is null or new.bootstrap_cancelled_at is not null or new.status::text<>'active'
    or new.onboarding_status<>'active' or (old.status::text='active' and old.onboarding_status='active') then return new; end if;
  if new.inspector_id is not null then
    update public.gardens set bootstrap_assignment_status='assigned' where id=new.id;
  elsif public.is_approved_inspector(new.bootstrap_inspector_id) then
    update public.gardens set inspector_id=new.bootstrap_inspector_id,bootstrap_assignment_status='assigned' where id=new.id;
    insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action)
    values(new.bootstrap_inspector_id,'inspector',new.id,'gardens',new.id,'bootstrap_inspector_assigned');
  else
    update public.gardens set bootstrap_assignment_status='admin_reassignment_required' where id=new.id;
    insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action)
    values(new.manager_id,'manager',new.id,'gardens',new.id,'bootstrap_inspector_reassignment_required');
  end if;
  return new;
end $$;
drop trigger if exists garden_bootstrap_inspector_after_activation on public.gardens;
create trigger garden_bootstrap_inspector_after_activation after update of status,onboarding_status on public.gardens
for each row execute function public.assign_bootstrap_inspector_on_activation();

-- Preserve GB-M10 atomic activation, ordering profile activation before its teaching guard.
create or replace function public.activate_garden_onboarding(target_garden_id uuid, requested_activation_key uuid, accept_required_consents boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare record public.kindergarten_onboarding_records%rowtype; garden public.gardens%rowtype; status_state jsonb;
  actor public.profiles%rowtype; now_at timestamptz:=now(); trial_end timestamptz:=now()+interval '14 days'; relationship text; assignment_kind text;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_garden_id::text,0));
  if not public.can_edit_garden_onboarding(target_garden_id) then raise exception 'onboarding_access_denied' using errcode='42501'; end if;
  select * into record from public.kindergarten_onboarding_records where garden_id=target_garden_id for update;
  select * into garden from public.gardens where id=target_garden_id for update;
  select * into actor from public.profiles where id=auth.uid() for update;
  if record.activation_key is distinct from requested_activation_key then raise exception 'activation_key_mismatch' using errcode='42501'; end if;
  if record.lifecycle_status='active' and garden.status::text='active' then return jsonb_build_object('garden_id',target_garden_id,'status','active','already_active',true); end if;
  if accept_required_consents then
    insert into public.kindergarten_legal_acceptances(garden_id,manager_profile_id,acceptance_type,accepted,version,accepted_at,metadata)
    select target_garden_id,actor.id,consent_type,true,'gb-m10-product-consent-v1',now_at,jsonb_build_object('source','garden_onboarding_activation')
    from unnest(array['platform_terms','privacy_terms']) consent_type
    where not exists(select 1 from public.kindergarten_legal_acceptances existing where existing.garden_id=target_garden_id
      and existing.manager_profile_id=actor.id and existing.acceptance_type=consent_type and existing.version='gb-m10-product-consent-v1');
  end if;
  status_state:=public.garden_onboarding_status(target_garden_id);
  if not coalesce((status_state->>'can_activate')::boolean,false) then
    update public.kindergarten_onboarding_records set activation_attempts=activation_attempts+1,last_activation_error='requirements_not_met',updated_at=now_at where id=record.id;
    raise exception 'onboarding_requirements_not_met:%',status_state->'blockers' using errcode='23514';
  end if;
  relationship:=case when record.registrant_type in ('owner_teacher','owner_only') then 'owner' else 'manager' end;
  update public.gardens set status='active',approval_flow_status='active',final_approval_status='active',onboarding_status='active',
    activation_progress_percent=100,activation_payment_status='payment_pending',onboarding_completed_at=now_at,
    profile_submitted_at=now_at,public_profile_enabled=true,updated_at=now_at where id=target_garden_id;
  update public.garden_management_memberships set status='active',activated_at=coalesce(activated_at,now_at),ended_at=null,updated_at=now_at
    where profile_id=actor.id and garden_id=target_garden_id and relationship_role=relationship;
  -- Activate the profile inside this transaction before the teaching-assignment guard runs.
  update public.profiles set garden_id=coalesce(garden_id,target_garden_id),active=true,self_service_status='active',self_service_approved_at=coalesce(self_service_approved_at,now_at),updated_at=now_at where id=actor.id;
  if record.registrant_type in ('owner_teacher','teacher_operator') then
    assignment_kind:=case when record.registrant_type='owner_teacher' then 'owner_teacher' else 'operator_teacher' end;
    insert into public.garden_teaching_assignments(garden_id,profile_id,staff_id,assignment_kind,title,status,granted_by,granted_at)
    values(target_garden_id,actor.id,null,assignment_kind,case when assignment_kind='owner_teacher' then 'בעלים וגננת' else 'גננת ומפעילת גן' end,'active',actor.id,now_at)
    on conflict(garden_id,profile_id) do update set assignment_kind=excluded.assignment_kind,status='active',revoked_at=null,updated_at=now_at;
  end if;
  if not exists(select 1 from public.kindergarten_subscriptions where garden_id=target_garden_id and status::text in ('active','trial','pending_payment','suspended')) then
    insert into public.kindergarten_subscriptions(garden_id,status,trial_status,plan_type,start_date,trial_started_at,trial_ends_at,expires_at,renewal_date,
      provider,billing_status,billing_cycle,current_period_start,current_period_end,trial_conversion_status,metadata,created_by,updated_by)
    values(target_garden_id,'trial','active','annual',current_date,now_at,trial_end,trial_end,trial_end::date,'manual','trial','annual',current_date,trial_end::date,
      'trial_active',jsonb_build_object('monthly_amount_nis',record.subscription_monthly_amount,'charge_today_nis',0,'payment_mode','manual_or_sandbox_until_provider_approval'),actor.id,actor.id);
  end if;
  update public.kindergarten_onboarding_records set lifecycle_status='active',progress_percent=100,current_step='activation',
    completed_steps=array(select distinct unnest(completed_steps||array['activation'])),activation_steps=array(select distinct unnest(activation_steps||array['activation_completed'])),
    payment_status='payment_pending',submitted_at=coalesce(submitted_at,now_at),activated_at=coalesce(activated_at,now_at),completed_at=coalesce(completed_at,now_at),
    activation_attempts=activation_attempts+1,last_activation_error=null,updated_at=now_at where id=record.id;
  update public.self_service_user_profiles set status='active',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('last_activated_garden_id',target_garden_id,'application_stage','trial_active'),updated_at=now_at where profile_id=actor.id;
  insert into public.kindergarten_activation_events(garden_id,actor_id,event_type,status,metadata) values(target_garden_id,actor.id,'activation_completed','recorded',jsonb_build_object('atomic',true,'admin_approval_required',false,'registrant_type',record.registrant_type)) on conflict do nothing;
  insert into public.audit_logs(actor_id,actor_role,performed_by_user,performed_by_role,garden_id,entity_type,entity_id,action,after_data)
  values(actor.id,actor.role,actor.id,actor.role,target_garden_id,'kindergarten_onboarding_records',record.id,'garden_onboarding_activated',jsonb_build_object('atomic',true,'registrant_type',record.registrant_type));
  return jsonb_build_object('garden_id',target_garden_id,'status','active','already_active',false);
end $$;

revoke all on function public.create_inspector_preliminary_garden(text,text,text),public.accept_inspector_garden_invitation(uuid,text,boolean),
  public.cancel_inspector_preliminary_garden(uuid),
  public.assign_bootstrap_inspector_on_activation() from public,anon;
grant execute on function public.create_inspector_preliminary_garden(text,text,text),
  public.accept_inspector_garden_invitation(uuid,text,boolean),public.cancel_inspector_preliminary_garden(uuid) to authenticated;
notify pgrst, 'reload schema';
