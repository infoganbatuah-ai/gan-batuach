-- GB-M10: canonical, resumable and atomic Garden onboarding activation.
-- Existing active Gardens are preserved. Digital Observer is not an activation dependency.

alter table public.kindergarten_onboarding_records
  add column if not exists current_step text not null default 'garden_details',
  add column if not exists registrant_type text not null default 'teacher_operator',
  add column if not exists activation_key uuid not null default gen_random_uuid(),
  add column if not exists activation_attempts integer not null default 0,
  add column if not exists last_activation_error text,
  add column if not exists completed_at timestamptz;

alter table public.kindergarten_onboarding_records
  drop constraint if exists kindergarten_onboarding_registrant_type_check;
alter table public.kindergarten_onboarding_records
  add constraint kindergarten_onboarding_registrant_type_check
  check (registrant_type in ('teacher_operator', 'owner_teacher', 'owner_only'));

create unique index if not exists kindergarten_onboarding_activation_key_unique_idx
  on public.kindergarten_onboarding_records(activation_key);
-- A teacher who opens and operates a Garden is distinct from owner-as-teacher.
alter table public.garden_teaching_assignments
  drop constraint if exists garden_teaching_assignments_kind_check;
alter table public.garden_teaching_assignments
  add constraint garden_teaching_assignments_kind_check
  check (assignment_kind in ('owner_teacher', 'operator_teacher', 'delegated_teacher'));
alter table public.garden_teaching_assignments
  drop constraint if exists garden_teaching_assignments_actor_shape_check;
alter table public.garden_teaching_assignments
  add constraint garden_teaching_assignments_actor_shape_check check (
    (assignment_kind in ('owner_teacher', 'operator_teacher') and staff_id is null)
    or (assignment_kind = 'delegated_teacher' and staff_id is not null)
  );

create or replace function public.validate_garden_teaching_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor_role text; actor_active boolean; garden_owner uuid; garden_manager uuid; garden_ownership text;
begin
  select role::text, active into actor_role, actor_active from public.profiles where id = new.profile_id;
  select owner_profile_id, manager_id, ownership_type into garden_owner, garden_manager, garden_ownership from public.gardens where id = new.garden_id;
  if new.status = 'active' and actor_active is not true then raise exception 'teaching_assignment_requires_active_profile' using errcode = '23514'; end if;
  if new.assignment_kind = 'owner_teacher' and new.status = 'active'
    and (actor_role <> 'owner' or garden_owner is distinct from new.profile_id or garden_ownership <> 'teacher_is_owner') then
    raise exception 'owner_teacher_identity_mismatch' using errcode = '23514';
  end if;
  if new.assignment_kind = 'operator_teacher' and new.status = 'active'
    and (actor_role not in ('manager','owner') or garden_manager is distinct from new.profile_id or garden_ownership <> 'teacher_only') then
    raise exception 'operator_teacher_identity_mismatch' using errcode = '23514';
  end if;
  if new.assignment_kind = 'delegated_teacher' and new.status = 'active' and not exists (
    select 1 from public.staff s join public.staff_kindergarten_employments e
      on e.staff_id=s.id and e.profile_id=s.profile_id and e.garden_id=s.garden_id and e.status='active'
    where s.id=new.staff_id and s.profile_id=new.profile_id and s.garden_id=new.garden_id
      and s.approved_to_work is true and s.onboarding_status='active' and actor_role='staff'
  ) then raise exception 'delegated_teacher_requires_active_staff_employment' using errcode = '23514'; end if;
  if new.access_scope - array['children','attendance','journal','communication'] <> '{}'::jsonb then
    raise exception 'teaching_assignment_scope_not_allowed' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_each(new.access_scope) entry where jsonb_typeof(entry.value) <> 'boolean') then
    raise exception 'teaching_assignment_scope_must_be_boolean' using errcode = '23514';
  end if;
  new.updated_at := now(); return new;
end $$;

create or replace function public.can_edit_garden_onboarding(target_garden_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_admin() or public.can_manage_garden(target_garden_id) or exists (
      select 1 from public.kindergarten_onboarding_records onboarding
      join public.garden_management_memberships membership
        on membership.garden_id=onboarding.garden_id and membership.profile_id=onboarding.manager_id
      join public.profiles profile on profile.id=onboarding.manager_id
      where onboarding.garden_id=target_garden_id and onboarding.manager_id=auth.uid()
        and onboarding.lifecycle_status in ('registration_pending','credentials_sent','activation_in_progress','onboarding_in_progress','correction_required')
        and membership.profile_id=auth.uid() and membership.status='pending'
        and membership.relationship_role in ('owner','manager')
    )
  )
$$;

create or replace function public.start_garden_onboarding(details jsonb, requested_registrant_type text default 'teacher_operator')
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor public.profiles%rowtype; existing_record public.kindergarten_onboarding_records%rowtype;
  new_garden_id uuid; relationship text; ownership text; now_at timestamptz := now();
begin
  select * into actor from public.profiles where id=auth.uid() for update;
  if actor.id is null or actor.role::text not in ('manager','owner') then raise exception 'onboarding_actor_not_allowed' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text,1));
  if requested_registrant_type not in ('teacher_operator','owner_teacher','owner_only') then raise exception 'invalid_registrant_type' using errcode='22023'; end if;
  if requested_registrant_type in ('owner_teacher','owner_only') and actor.role::text <> 'owner' then raise exception 'owner_role_required' using errcode='42501'; end if;
  select * into existing_record from public.kindergarten_onboarding_records
    where manager_id=actor.id and lifecycle_status in ('registration_pending','credentials_sent','activation_in_progress','onboarding_in_progress','correction_required')
    order by created_at desc limit 1 for update;
  if existing_record.id is not null then return jsonb_build_object('garden_id',existing_record.garden_id,'already_exists',true,'activation_key',existing_record.activation_key); end if;
  relationship := case when requested_registrant_type in ('owner_teacher','owner_only') then 'owner' else 'manager' end;
  ownership := case requested_registrant_type when 'owner_teacher' then 'teacher_is_owner' when 'owner_only' then 'owner_only' else 'teacher_only' end;
  insert into public.gardens(name,city,address,phone,email,manager_id,owner_profile_id,owner_name,status,
    ownership_type,approval_flow_status,final_approval_status,onboarding_status,activation_payment_status,
    public_profile_enabled,eligible_for_safe_status,safe_status,public_description,ages,created_at,updated_at)
  values (nullif(trim(details->>'name'),''),nullif(trim(details->>'city'),''),nullif(trim(details->>'address'),''),
    nullif(trim(details->>'phone'),''),nullif(trim(details->>'email'),''),actor.id,
    case when relationship='owner' then actor.id else null end,nullif(trim(details->>'manager_name'),''),'pending',ownership,
    'activation_in_progress','activation_in_progress','activation_in_progress','not_started',false,false,'pending_review',
    nullif(trim(details->>'public_description'),''),'{}'::text[],now_at,now_at) returning id into new_garden_id;
  -- The GB-M09 Garden trigger mirrors direct owner/manager columns as active.
  -- A draft must not grant operational access, so normalize every mirrored row
  -- inside this same transaction before it becomes externally visible.
  update public.garden_management_memberships set status='pending',is_default=false,activated_at=null,ended_at=null,updated_at=now_at
  where profile_id=actor.id and garden_id=new_garden_id;
  insert into public.garden_management_memberships(profile_id,garden_id,relationship_role,status,is_default,source,metadata,updated_at)
  values(actor.id,new_garden_id,relationship,'pending',false,'self_service',jsonb_build_object('purpose','onboarding'),now_at)
  on conflict(profile_id,garden_id,relationship_role) do update set status='pending',is_default=false,activated_at=null,ended_at=null,updated_at=now_at;
  insert into public.kindergarten_onboarding_records(garden_id,manager_id,lifecycle_status,progress_percent,completed_steps,missing_fields,
    profile_data,activation_steps,payment_status,subscription_monthly_amount,started_at,current_step,registrant_type,updated_at)
  values(new_garden_id,actor.id,'activation_in_progress',10,array['account'],array['garden_details','identity','documents','consents'],
    details || jsonb_build_object('registration_source','manager_self_service'),array['account'],'not_started',700,now_at,'garden_details',requested_registrant_type,now_at)
  returning * into existing_record;
  insert into public.kindergarten_activation_events(garden_id,actor_id,event_type,status,metadata)
  values(new_garden_id,actor.id,'registration_submitted','recorded',jsonb_build_object('admin_approval_required',false,'registrant_type',requested_registrant_type));
  insert into public.audit_logs(actor_id,actor_role,performed_by_user,performed_by_role,garden_id,entity_type,entity_id,action,after_data)
  values(actor.id,actor.role,actor.id,actor.role,new_garden_id,'kindergarten_onboarding_records',existing_record.id,
    'garden_onboarding_started',jsonb_build_object('registrant_type',requested_registrant_type));
  return jsonb_build_object('garden_id',new_garden_id,'already_exists',false,'activation_key',existing_record.activation_key);
end $$;

create or replace function public.garden_onboarding_status(target_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb; blockers text[] := '{}'; record public.kindergarten_onboarding_records%rowtype; garden public.gardens%rowtype; actor public.profiles%rowtype;
begin
  if not public.can_edit_garden_onboarding(target_garden_id) then raise exception 'onboarding_access_denied' using errcode='42501'; end if;
  select * into record from public.kindergarten_onboarding_records where garden_id=target_garden_id;
  select * into garden from public.gardens where id=target_garden_id;
  select * into actor from public.profiles where id=auth.uid();
  if record.id is null or garden.id is null then raise exception 'onboarding_not_found' using errcode='P0002'; end if;
  if coalesce(trim(garden.name),'')='' then blockers:=array_append(blockers,'garden_name'); end if;
  if coalesce(trim(garden.address),'')='' then blockers:=array_append(blockers,'address'); end if;
  if coalesce(trim(garden.phone),'')='' then blockers:=array_append(blockers,'phone'); end if;
  if actor.contact_verification_required and (actor.email_verified_at is null or actor.phone_verified_at is null) then blockers:=array_append(blockers,'identity_verification'); end if;
  if coalesce(jsonb_array_length(coalesce(record.profile_data->'selected_age_groups','[]'::jsonb)),0)=0 then blockers:=array_append(blockers,'age_groups'); end if;
  if coalesce(trim(record.profile_data->>'documents_summary'),'')='' then blockers:=array_append(blockers,'documents'); end if;
  if not exists(select 1 from public.kindergarten_legal_acceptances a where a.garden_id=target_garden_id and a.manager_profile_id=auth.uid() and a.accepted and a.acceptance_type='platform_terms') then blockers:=array_append(blockers,'platform_terms'); end if;
  if not exists(select 1 from public.kindergarten_legal_acceptances a where a.garden_id=target_garden_id and a.manager_profile_id=auth.uid() and a.accepted and a.acceptance_type='privacy_terms') then blockers:=array_append(blockers,'privacy_terms'); end if;
  result:=jsonb_build_object('garden_id',target_garden_id,'lifecycle_status',record.lifecycle_status,'current_step',record.current_step,
    'completed_stages',record.completed_steps,'progress_percent',record.progress_percent,'blockers',blockers,'can_activate',cardinality(blockers)=0,
    'registrant_type',record.registrant_type,'subscription',jsonb_build_object('provider','manual','status',record.payment_status,'live_collection',false));
  return result;
end $$;

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
  update public.profiles set garden_id=coalesce(garden_id,target_garden_id),active=true,self_service_status='active',self_service_approved_at=coalesce(self_service_approved_at,now_at),updated_at=now_at where id=actor.id;
  update public.self_service_user_profiles set status='active',metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('last_activated_garden_id',target_garden_id,'application_stage','trial_active'),updated_at=now_at where profile_id=actor.id;
  insert into public.kindergarten_activation_events(garden_id,actor_id,event_type,status,metadata) values(target_garden_id,actor.id,'activation_completed','recorded',jsonb_build_object('atomic',true,'admin_approval_required',false,'registrant_type',record.registrant_type)) on conflict do nothing;
  insert into public.audit_logs(actor_id,actor_role,performed_by_user,performed_by_role,garden_id,entity_type,entity_id,action,after_data)
  values(actor.id,actor.role,actor.id,actor.role,target_garden_id,'kindergarten_onboarding_records',record.id,'garden_onboarding_activated',jsonb_build_object('atomic',true,'registrant_type',record.registrant_type));
  return jsonb_build_object('garden_id',target_garden_id,'status','active','already_active',false);
end $$;

revoke all on function public.can_edit_garden_onboarding(uuid) from public;
revoke all on function public.start_garden_onboarding(jsonb,text) from public;
revoke all on function public.garden_onboarding_status(uuid) from public;
revoke all on function public.activate_garden_onboarding(uuid,uuid,boolean) from public;
grant execute on function public.can_edit_garden_onboarding(uuid) to authenticated;
grant execute on function public.start_garden_onboarding(jsonb,text) to authenticated;
grant execute on function public.garden_onboarding_status(uuid) to authenticated;
grant execute on function public.activate_garden_onboarding(uuid,uuid,boolean) to authenticated;

drop policy if exists "kindergarten legal acceptances public insert" on public.kindergarten_legal_acceptances;
create policy "kindergarten legal acceptances onboarding insert" on public.kindergarten_legal_acceptances for insert
with check (manager_profile_id=auth.uid() and public.can_edit_garden_onboarding(garden_id));

comment on function public.activate_garden_onboarding(uuid,uuid,boolean) is 'GB-M10 atomic and idempotent Garden activation. Locks one Garden and commits authority, teaching, subscription and lifecycle together.';
notify pgrst, 'reload schema';
