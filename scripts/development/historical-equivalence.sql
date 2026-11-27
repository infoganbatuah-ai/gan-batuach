BEGIN READ ONLY;
SELECT 'owner_enum_exists' AS check_name,
  EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
          JOIN pg_namespace n ON n.oid=t.typnamespace
          WHERE n.nspname='public' AND t.typname='app_role' AND e.enumlabel='owner')::text AS result;
SELECT 'pending_gateway_enum_exists' AS check_name,
  EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
          JOIN pg_namespace n ON n.oid=t.typnamespace
          WHERE n.nspname='public' AND t.typname='camera_status' AND e.enumlabel='pending_gateway')::text AS result;
SELECT 'vercel_subprocessor_rows' AS check_name,
  count(*)::text AS result FROM public.subprocessor_register WHERE provider_key='vercel';
SELECT 'media_backfill_base_rows' AS check_name,
  count(*)::text AS result FROM public.observer_intelligence_signals s
  WHERE s.observer_site_id IS NOT NULL AND s.source_type='system'
    AND coalesce(s.metadata,'{}'::jsonb) ? 'event_type'
    AND coalesce(s.metadata,'{}'::jsonb)->>'event_type'
      IN ('home_learning_started','home_learning_progress','home_activity_change')
    AND NOT (coalesce(s.metadata,'{}'::jsonb) ? 'camera_source_id');
SELECT 'media_backfill_matching_camera_rows' AS check_name,
  count(*)::text AS result FROM public.observer_intelligence_signals s
  WHERE s.observer_site_id IS NOT NULL AND s.source_type='system'
    AND coalesce(s.metadata,'{}'::jsonb) ? 'event_type'
    AND coalesce(s.metadata,'{}'::jsonb)->>'event_type'
      IN ('home_learning_started','home_learning_progress','home_activity_change')
    AND NOT (coalesce(s.metadata,'{}'::jsonb) ? 'camera_source_id')
    AND EXISTS (SELECT 1 FROM public.digital_observer_camera_sources cs
                WHERE cs.observer_site_id=s.observer_site_id
                  AND coalesce(cs.status,'') IN ('connected','active','ready')
                  AND coalesce(cs.health_status,'') IN ('healthy','unknown'));
SELECT 'authorized_home_site_rows' AS check_name,
  count(*)::text AS result FROM public.observer_sites
  WHERE id='cc1673b8-3eb0-4785-a12c-1fb88f425a41';
SELECT 'authorized_ch1_source_rows' AS check_name,
  count(*)::text AS result FROM public.digital_observer_camera_sources
  WHERE id='6fddc732-13df-4268-9f32-3357262ea997'
    AND observer_site_id='cc1673b8-3eb0-4785-a12c-1fb88f425a41';
SELECT 'authorized_home_automation_policy_rows' AS check_name,
  count(*)::text AS result FROM public.digital_observer_camera_automation_policies
  WHERE observer_site_id='cc1673b8-3eb0-4785-a12c-1fb88f425a41';
SELECT 'baseline_fingerprint_receipt' AS check_name,
  fingerprint AS result FROM development_metadata.baselines
  WHERE id='development-c0cf2de7-20260919-v1';
SELECT 'latest_migration_fingerprint_receipt' AS check_name,
  schema_fingerprint AS result FROM development_metadata.migrations
  ORDER BY applied_at DESC LIMIT 1;
ROLLBACK;
