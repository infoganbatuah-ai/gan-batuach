-- Review artifact only. The isolated in-memory test reads the marked candidate section.
do $$ begin raise exception 'REVIEW ONLY: site save requires separate schema and ACL qualification'; end $$;

-- BEGIN CANDIDATE
begin;
create function public.save_observer_onboarding_atomic(
  target_site uuid, target_package uuid, site_patch jsonb, schedule_mode_input text, monitoring_targets jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $body$
declare
  actor uuid := auth.uid();
  patch public.observer_sites%rowtype;
  site public.observer_sites%rowtype;
  pkg public.observer_monitoring_packages%rowtype;
  sub public.observer_site_subscriptions%rowtype;
  first_site uuid;
  used bigint;
  quota jsonb;
  draft_id uuid;
  entitlement text;
  ent_value jsonb;
  draft_metadata jsonb;
  trial_time timestamptz := date_trunc('milliseconds', statement_timestamp());
  trial_iso text := to_char(trial_time at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  preserve_trial boolean := false;
begin
  if actor is null or public.digital_observer_current_session_active() is not true then
    raise insufficient_privilege;
  end if;
  -- Serializes this actor's create/retry and draft selection. A denied lock is a failed save.
  perform 1 from public.digital_observer_accounts a join public.profiles p on p.id=a.profile_id
    where a.profile_id=actor and p.active is true
      and a.account_type=case when site_patch->>'site_type'='home' then 'home' else 'business' end
      and a.status in ('onboarding','trial','active')
    for update of a;
  if not found then raise insufficient_privilege; end if;
  patch := jsonb_populate_record(null::public.observer_sites, site_patch);
  if patch.name is null or length(trim(patch.name)) not between 2 and 100
    or patch.site_type is null or patch.site_type not in ('home','office','business','warehouse','store','parking_lot','custom')
    or coalesce(length(trim(patch.city)),0) not between 2 and 100
    or coalesce(length(trim(patch.street)),0) not between 2 and 140
    or coalesce(length(trim(patch.building_number)),0) not between 1 and 20
    or patch.camera_limit is null or patch.camera_limit not between 1 and 500
    or patch.floor_kind is null or patch.floor_kind not in ('ground','floor')
    or jsonb_typeof(patch.monitoring_hours) is distinct from 'object'
    or patch.monitoring_hours->>'mode' is distinct from schedule_mode_input
    or schedule_mode_input is null or schedule_mode_input not in ('24_7','night_only','business_hours','custom_schedule','event_only')
    or jsonb_typeof(monitoring_targets) is distinct from 'array' then
    raise check_violation using message='INVALID_ONBOARDING_INPUT';
  end if;
  select * into pkg from public.observer_monitoring_packages
    where id=target_package and active and
      ((patch.site_type='home' and package_type='home') or (patch.site_type<>'home' and package_type in ('business','enterprise','custom')))
    for share;
  if not found then raise check_violation using message='TRIAL_PACKAGE_UNAVAILABLE'; end if;

  if target_site is null then
    select count(*), (array_agg(id order by created_at,id))[1] into used,first_site
      from public.observer_sites where owner_profile_id=actor and garden_id is null and site_type<>'kindergarten';
    if used>0 then
      select * into strict sub from public.observer_site_subscriptions where observer_site_id=first_site for share;
      quota := sub.entitlement_snapshot->'sites';
      if sub.commercial_state is null or sub.commercial_state not in ('active','trial','past_due','grace_period')
        or (sub.commercial_state='trial' and (sub.trial_end is null or sub.trial_end<=trial_time))
        or (sub.commercial_state in ('past_due','grace_period') and (sub.grace_period_ends_at is null or sub.grace_period_ends_at<=trial_time))
        or not coalesce(quota='true'::jsonb or
           (case when jsonb_typeof(quota)='number' then (quota::text)::numeric>used else false end),false)
      then raise check_violation using message='SITE_ENTITLEMENT_DENIED'; end if;
    end if;
  else
    -- Owner edits only in this first review. Never upgrade a delegate to the billing writer.
    select * into site from public.observer_sites where id=target_site and owner_profile_id=actor
      and garden_id is null and site_type<>'kindergarten' for update;
    if not found then raise insufficient_privilege; end if;
    if site.site_type<>patch.site_type then raise check_violation using message='SITE_TYPE_CHANGE'; end if;
    -- Ambiguous subscription history fails before writes.
    if exists(select 1 from public.observer_site_subscriptions where observer_site_id=target_site) then
      select * into strict sub from public.observer_site_subscriptions where observer_site_id=target_site for update;
      preserve_trial := sub.trial_start is not null or sub.metadata->>'trial_ever_used'='true';
      if sub.package_id is distinct from target_package or not coalesce(preserve_trial,false)
        or sub.commercial_state is null or sub.commercial_state not in ('trial','active') then
        raise check_violation using message='TRIAL_NOT_ELIGIBLE';
      end if;
    end if;
  end if;

  select id into draft_id from public.observer_site_onboarding_drafts where profile_id=actor
    and ((target_site is null and activated_observer_site_id is null and status in ('draft','submitted','ready_for_review'))
      or (target_site is not null and activated_observer_site_id=target_site
        and status in ('activated','draft','submitted','ready_for_review')))
    order by created_at desc,id limit 1 for update;
  if target_site is null then
    insert into public.observer_sites(
      owner_profile_id,garden_id,name,site_type,address,city,street,building_number,apartment_number,
      floor_kind,floor_number,postal_code,country_code,formatted_address,address_provider,address_place_id,
      latitude,longitude,address_verification_status,address_verified_at,business_handles_children,vision_privacy_mode,
      timezone,active,monitoring_enabled,camera_limit,monitoring_hours,event_retention_days,ai_features,metadata)
    values(actor,null,patch.name,patch.site_type,patch.address,patch.city,patch.street,patch.building_number,patch.apartment_number,
      patch.floor_kind,patch.floor_number,patch.postal_code,patch.country_code,patch.formatted_address,patch.address_provider,patch.address_place_id,
      patch.latitude,patch.longitude,patch.address_verification_status,patch.address_verified_at,patch.business_handles_children,patch.vision_privacy_mode,
      'Asia/Jerusalem',true,false,patch.camera_limit,patch.monitoring_hours,2,patch.ai_features,patch.metadata)
    returning * into strict site;
    insert into public.observer_site_memberships(observer_site_id,profile_id,member_role,active,accepted_at,metadata)
      values(site.id,actor,'owner',true,trial_time,'{"source":"digital_observer_self_service"}');
    if not found then raise exception 'MEMBERSHIP_NOT_SAVED'; end if;
  else
    update public.observer_sites set
      name=patch.name,address=patch.address,city=patch.city,street=patch.street,building_number=patch.building_number,
      apartment_number=patch.apartment_number,floor_kind=patch.floor_kind,floor_number=patch.floor_number,
      postal_code=patch.postal_code,country_code=patch.country_code,formatted_address=patch.formatted_address,
      address_provider=patch.address_provider,address_place_id=patch.address_place_id,latitude=patch.latitude,longitude=patch.longitude,
      address_verification_status=patch.address_verification_status,address_verified_at=patch.address_verified_at,
      business_handles_children=patch.business_handles_children,vision_privacy_mode=patch.vision_privacy_mode,
      camera_limit=patch.camera_limit,monitoring_hours=patch.monitoring_hours,ai_features=patch.ai_features,
      metadata=patch.metadata,updated_at=trial_time
    where id=target_site and owner_profile_id=actor returning * into strict site;
  end if;

  draft_metadata := jsonb_build_object('monitoring_targets',monitoring_targets,'site_template',patch.metadata->'site_template',
    'branch_count',patch.metadata->'branch_count','high_risk_events_are_suspicions',true,'automatic_emergency_action',false,
    'safe_readiness_only',true,'address_verified',patch.address_verification_status='verified','vision_privacy_mode',patch.vision_privacy_mode);
  if draft_id is null then
    insert into public.observer_site_onboarding_drafts(profile_id,status,site_name,site_type,owner_type,address,timezone,
      monitoring_schedule,camera_count_estimate,desired_package_id,activated_observer_site_id,submitted_at,metadata,updated_at)
    values(actor,'activated',site.name,site.site_type,case when site.site_type='home' then 'home_owner' else 'business_owner' end,
      site.address,site.timezone,site.monitoring_hours,site.camera_limit,target_package,site.id,trial_time,draft_metadata,trial_time);
  else
    update public.observer_site_onboarding_drafts set status='activated',site_name=site.name,site_type=site.site_type,
      owner_type=case when site.site_type='home' then 'home_owner' else 'business_owner' end,address=site.address,timezone=site.timezone,
      monitoring_schedule=site.monitoring_hours,camera_count_estimate=site.camera_limit,desired_package_id=target_package,
      activated_observer_site_id=site.id,submitted_at=trial_time,metadata=draft_metadata,updated_at=trial_time
    where id=draft_id and profile_id=actor;
  end if;
  if not found then raise exception 'DRAFT_NOT_SAVED'; end if;
  insert into public.observer_monitoring_schedules(observer_site_id,schedule_mode,timezone,status,schedule,updated_at)
    values(site.id,schedule_mode_input,site.timezone,'draft',site.monitoring_hours||'{"readiness_only":true}'::jsonb,trial_time)
    on conflict(observer_site_id) do update set schedule_mode=excluded.schedule_mode,timezone=excluded.timezone,
      status=excluded.status,schedule=excluded.schedule,updated_at=excluded.updated_at;
  if not found then raise exception 'SCHEDULE_NOT_SAVED'; end if;

  if preserve_trial is not true then
    insert into public.observer_site_subscriptions(observer_site_id,package_id,status,subscription_status,commercial_state,
      payment_provider,payment_provider_mode,provider_outcome,trial_start,trial_end,package_limits_snapshot,entitlement_snapshot,
      current_plan_version,metadata,updated_at)
    values(site.id,pkg.id,'trial','trial','trial','disabled','disabled','none',trial_time,trial_time+interval '336 hours',
      pkg.included_entitlements,pkg.included_entitlements,pkg.catalog_version,
      jsonb_build_object('trial_ever_used',true,'trial_activated_by',actor),trial_time)
    returning * into strict sub;
    foreach entitlement in array array['sites','cameras','ai_processing','video_retention','evidence_storage',
        'investigation','notifications','api_access','partner_features','white_label_features'] loop
      ent_value := pkg.included_entitlements->entitlement;
      insert into public.digital_observer_entitlement_grants(stable_grant_id,observer_site_id,subscription_id,
        entitlement_key,limit_value,boolean_value,grant_status,metadata)
      values(encode(extensions.hmac(sub.id::text||chr(31)||entitlement,'digital-observer:grant:v1','sha256'),'hex'),
        site.id,sub.id,entitlement,case when jsonb_typeof(ent_value)='number' then (ent_value::text)::numeric end,
        case when jsonb_typeof(ent_value)='boolean' then (ent_value::text)::boolean end,
        case when ent_value is null or ent_value in ('false'::jsonb,'null'::jsonb) then 'restricted' else 'active' end,
        '{"server_enforced":true}');
      if not found then raise exception 'GRANT_NOT_SAVED'; end if;
    end loop;
    insert into public.digital_observer_financial_audit(observer_site_id,actor_profile_id,actor_type,authorization_reference,
      operation,entity_type,entity_id,new_state,correlation_id,safe_metadata)
    values(site.id,actor,'authenticated_user','site_billing_authorization','trial_activated','subscription',sub.id::text,
      jsonb_build_object('commercial_state','trial','trial_end',sub.trial_end,'package_id',pkg.id),
      encode(extensions.hmac(site.id::text||chr(31)||trial_iso,'digital-observer:trial:v1','sha256'),'hex'),
      '{"product":"digital_observer","raw_payment_data_stored":false}');
    if not found then raise exception 'AUDIT_NOT_SAVED'; end if;
  end if;
  return jsonb_build_object('site',jsonb_build_object('id',site.id,'name',site.name,'site_type',site.site_type,
    'address',site.address,'monitoring_enabled',site.monitoring_enabled),'trial',
    case when preserve_trial then jsonb_build_object('id',sub.id,'subscription_status',sub.subscription_status,
      'trial_start',sub.trial_start,'trial_end',sub.trial_end) else to_jsonb(sub) end);
end
$body$;
revoke all on function public.save_observer_onboarding_atomic(uuid,uuid,jsonb,text,jsonb)
  from public,anon,authenticated,service_role;
commit;
