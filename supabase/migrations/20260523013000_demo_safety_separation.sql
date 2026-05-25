-- Demo safety separation. Demo reset/delete must never target production rows.

do $$
declare
  table_name text;
  demo_tables text[] := array[
    'profiles',
    'generated_credentials',
    'gardens',
    'inspectors',
    'teachers',
    'staff',
    'parents',
    'children',
    'leads',
    'tasks',
    'inspection_forms',
    'inspection_form_questions',
    'inspection_form_assignments',
    'inspections',
    'inspection_answers',
    'inspection_signatures',
    'inspection_overrides',
    'violations',
    'messages',
    'complaints',
    'documents',
    'attendance',
    'camera_streams',
    'camera_view_logs',
    'parent_camera_permissions',
    'video_stream_sessions',
    'camera_snapshots',
    'restricted_areas',
    'ai_observer_rules',
    'ai_alerts',
    'incident_timeline',
    'notifications',
    'task_view_logs',
    'mandatory_procedures',
    'procedure_acknowledgements',
    'campaigns',
    'report_exports',
    'rate_limit_events',
    'staff_certificates',
    'staff_shifts',
    'gallery_items',
    'schedule_items',
    'medical_events',
    'pickup_confirmations',
    'child_daily_journals',
    'child_health_records',
    'medicine_given_logs',
    'incident_reports',
    'video_gateway_connections',
    'stream_health_checks',
    'ai_events',
    'audit_logs',
    'gps_verification_logs',
    'daily_operational_tasks',
    'daily_task_completions',
    'required_inspections',
    'late_inspections',
    'policies',
    'policy_acceptances',
    'passkey_credentials',
    'passkey_challenges'
  ];
begin
  foreach table_name in array demo_tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I add column if not exists is_demo boolean not null default false', table_name);
      execute format('alter table public.%I add column if not exists demo_batch_id text', table_name);
      execute format('create index if not exists idx_%I_demo_batch on public.%I(is_demo, demo_batch_id)', table_name, table_name);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
