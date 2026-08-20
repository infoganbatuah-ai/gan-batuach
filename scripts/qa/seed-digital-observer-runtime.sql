-- Synthetic Digital Observer runtime seed for the two dedicated QA accounts only.
-- Run only in the Gan Batuach demo/pilot-safe project. This script is idempotent,
-- does not change passwords, does not delete data and does not activate live providers.

do $$
declare
  qa record;
  site_row public.observer_sites;
  camera_id uuid;
  package_id uuid;
begin
  for qa in
    select
      u.id as profile_id,
      lower(u.email) as email,
      case when lower(u.email) = 'qa.digital.observer.home@demo.ganbatuach.com' then 'home' else 'business' end as observer_mode
    from auth.users u
    where lower(u.email) in (
      'qa.digital.observer.home@demo.ganbatuach.com',
      'qa.digital.observer@demo.ganbatuach.com'
    )
  loop
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
      'product', 'digital_observer',
      'qa_demo', true,
      'observer_account_type', qa.observer_mode
    ),
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
      'is_demo', true,
      'qa_demo', true
    )
    where id = qa.profile_id;

    for site_row in
      select s.*
      from public.observer_sites s
      where s.owner_profile_id = qa.profile_id
        and s.site_type = qa.observer_mode
        and s.site_type <> 'kindergarten'
      order by s.created_at
    loop

    update public.observer_sites
    set city = coalesce(city, 'תל אביב-יפו'),
        street = coalesce(street, case when qa.observer_mode = 'home' then 'רחוב הדוגמה' else 'דרך העסקים' end),
        building_number = coalesce(building_number, case when qa.observer_mode = 'home' then '10' else '12' end),
        floor_kind = coalesce(floor_kind, 'floor'),
        floor_number = coalesce(floor_number, case when qa.observer_mode = 'home' then 2 else 1 end),
        country_code = 'IL',
        address_verification_status = 'unverified',
        vision_privacy_mode = 'standard_consent',
        observer_runtime_status = 'learning_shadow',
        learning_started_at = coalesce(learning_started_at, now() - interval '7 days'),
        learning_target_days = 30,
        metadata = coalesce(metadata, '{}'::jsonb) || '{"qa_demo":true,"real_data":false,"live_providers":false}'::jsonb,
        updated_at = now()
    where id = site_row.id;

    insert into public.digital_observer_camera_sources (
      observer_site_id, display_name, location_label, connector_type,
      connector_provider, source_mode, status, health_status, preview_scene,
      capabilities, monitoring_targets, last_health_check_at, last_seen_at,
      created_by, metadata
    )
    select
      site_row.id,
      case when qa.observer_mode = 'home' then 'כניסה ראשית' else 'כניסת העסק' end,
      'כניסה', 'demo', 'synthetic_qa', 'demo', 'ready_to_test', 'healthy',
      case when qa.observer_mode = 'home' then 'home-entry' else 'business-entry' end,
      '{"preview":true,"live_view":false,"synthetic":true}'::jsonb,
      '["person","unknown_person","entry_exit"]'::jsonb,
      now(), now(), qa.profile_id,
      '{"qa_demo":true,"synthetic":true,"no_real_camera":true,"no_live_claim":true}'::jsonb
    where not exists (
      select 1 from public.digital_observer_camera_sources c where c.observer_site_id = site_row.id
    );

    select c.id into camera_id
    from public.digital_observer_camera_sources c
    where c.observer_site_id = site_row.id
    order by c.created_at
    limit 1;

    insert into public.observer_intelligence_signals (
      signal_type, source_type, observer_site_id, severity, confidence,
      review_status, recommended_action, risk_score, human_review_required,
      parent_visible, metadata, created_at
    )
    select
      'ai_camera', 'system', site_row.id, 'medium', 0.91,
      'needs_review', 'בדיקה אנושית של אירוע QA סינתטי', 35, true,
      false, '{"event_type":"person_detected","qa_demo":true,"synthetic":true,"no_real_ai":true}'::jsonb,
      now() - interval '35 minutes'
    where not exists (
      select 1 from public.observer_intelligence_signals s where s.observer_site_id = site_row.id
    );

    insert into public.digital_observer_known_people (
      observer_site_id, display_name, relationship_label, consent_status,
      recognition_status, notify_on_detection, created_by, metadata
    )
    select
      site_row.id, 'אדם מוכר לדוגמה',
      case when qa.observer_mode = 'home' then 'בן משפחה' else 'עובד מורשה' end,
      'approved', 'readiness', false, qa.profile_id,
      '{"qa_demo":true,"synthetic":true,"no_biometric_data":true}'::jsonb
    where not exists (
      select 1 from public.digital_observer_known_people p where p.observer_site_id = site_row.id
    );

    insert into public.digital_observer_event_clips (
      observer_site_id, camera_source_id, title, clip_status, captured_at,
      duration_seconds, retention_hours, delete_after, downloadable, metadata
    )
    select
      site_row.id, camera_id, 'מקטע אירוע סינתטי', 'readiness', now() - interval '35 minutes',
      20, 24, now() + interval '24 hours', false,
      '{"qa_demo":true,"synthetic":true,"no_media_file":true,"signed_url_required":true}'::jsonb
    where camera_id is not null
      and not exists (
        select 1 from public.digital_observer_event_clips c where c.observer_site_id = site_row.id
      );

    insert into public.digital_observer_notification_deliveries (
      observer_site_id, recipient_profile_id, channel, severity,
      provider_mode, delivery_status, attempt_count, metadata
    )
    select
      site_row.id, qa.profile_id, 'in_app', 'info', 'mock', 'mocked', 1,
      '{"qa_demo":true,"synthetic":true,"no_external_message_sent":true}'::jsonb
    where not exists (
      select 1 from public.digital_observer_notification_deliveries d where d.observer_site_id = site_row.id
    );

    select p.id into package_id
    from public.observer_monitoring_packages p
    where p.package_key = case when qa.observer_mode = 'home' then 'home_plus' else 'business_pro' end
      and p.active = true
    limit 1;

    insert into public.observer_site_subscriptions (
      observer_site_id, package_id, status, subscription_status, entitlement_status,
      purchase_channel, trial_start, trial_end, billing_cycle, payment_provider, metadata
    )
    select
      site_row.id, package_id, 'trial', 'trial', 'readiness', 'mock',
      now(), now() + interval '14 days', 'monthly', 'mock',
      '{"qa_demo":true,"no_charge":true,"live_provider":false}'::jsonb
    where package_id is not null
      and not exists (
        select 1 from public.observer_site_subscriptions sub where sub.observer_site_id = site_row.id
      );

    insert into public.observer_site_learning_profiles (
      observer_site_id, learning_status, learning_maturity, baseline_version,
      confidence_level, anomaly_readiness_score, routine_confidence, metadata
    ) values (
      site_row.id, 'collecting_baseline', 'learning', 'v1_30_day_readiness',
      0.18, 0.08, '{"status":"collecting","target_days":30}'::jsonb,
      '{"qa_demo":true,"synthetic":true,"human_review_required":true,"automatic_decisions":false}'::jsonb
    )
    on conflict (observer_site_id) do nothing;

    insert into public.site_behavior_baselines (
      observer_site_id, baseline_type, baseline_value, confidence_level,
      learning_maturity, anomaly_readiness_score, source_summary, metadata
    )
    select
      site_row.id, baseline_type, '{"status":"collecting"}'::jsonb, 0.18,
      'learning', 0.08,
      '{"source":"synthetic_qa","minimum_learning_days":30}'::jsonb,
      '{"qa_demo":true,"synthetic":true,"human_review_required":true}'::jsonb
    from (values
      ('normal_occupancy_patterns'),
      ('normal_movement_patterns'),
      ('normal_activity_levels'),
      ('normal_active_hours'),
      ('normal_camera_activity'),
      ('normal_zone_usage')
    ) as baselines(baseline_type)
    on conflict (observer_site_id, baseline_type) where observer_site_id is not null do nothing;
    end loop;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
