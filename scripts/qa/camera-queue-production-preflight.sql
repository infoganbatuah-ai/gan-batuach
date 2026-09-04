-- Read-only metadata inspection. Run in the verified production project's SQL
-- Editor before applying the separately approved migration. No camera/user data.
select 'prerequisites' as section, jsonb_build_object(
  'queue', to_regclass('public.digital_observer_camera_action_requests'),
  'sources', to_regclass('public.digital_observer_camera_sources'),
  'sites', to_regclass('public.observer_sites'),
  'profiles', to_regclass('public.profiles'),
  'site_permission', to_regprocedure('public.can_manage_observer_site(uuid)'),
  'migration_history', to_regclass('supabase_migrations.schema_migrations')
) as details
union all
select 'queue_columns', coalesce(jsonb_agg(jsonb_build_object(
  'name', column_name, 'type', data_type, 'nullable', is_nullable,
  'default', column_default) order by ordinal_position), '[]'::jsonb)
from information_schema.columns
where table_schema = 'public' and table_name = 'digital_observer_camera_action_requests'
union all
select 'queue_constraints', coalesce(jsonb_agg(jsonb_build_object(
  'name', conname, 'definition', pg_get_constraintdef(oid)) order by conname), '[]'::jsonb)
from pg_constraint
where conrelid = to_regclass('public.digital_observer_camera_action_requests')
union all
select 'queue_policies', coalesce(jsonb_agg(jsonb_build_object(
  'name', policyname, 'command', cmd, 'using', qual, 'check', with_check)), '[]'::jsonb)
from pg_policies
where schemaname = 'public' and tablename = 'digital_observer_camera_action_requests';
