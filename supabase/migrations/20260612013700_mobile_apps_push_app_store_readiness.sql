-- PHASE 137: Mobile apps, push infrastructure and app store readiness.
-- Readiness only. No real production push is enabled by this migration.

alter table if exists public.push_device_tokens
  add column if not exists device_model text,
  add column if not exists os_version text,
  add column if not exists build_number text,
  add column if not exists app_channel text not null default 'web',
  add column if not exists biometric_capable boolean,
  add column if not exists device_trust_status text not null default 'unknown';

alter table if exists public.push_device_tokens
  drop constraint if exists push_device_tokens_app_channel_check;

alter table if exists public.push_device_tokens
  add constraint push_device_tokens_app_channel_check check (app_channel in ('web','ios_app','android_app','tablet','unknown'));

alter table if exists public.push_device_tokens
  drop constraint if exists push_device_tokens_trust_status_check;

alter table if exists public.push_device_tokens
  add constraint push_device_tokens_trust_status_check check (device_trust_status in ('unknown','trusted','needs_review','blocked','revoked'));

alter table if exists public.push_templates
  drop constraint if exists push_templates_category_check;

alter table if exists public.push_templates
  add constraint push_templates_category_check check (category in (
    'registration',
    'parent_approval',
    'child_approval',
    'payment_reminder',
    'payment',
    'attendance',
    'message',
    'document',
    'compliance',
    'safety_alert',
    'observer_alert',
    'inspection_alert',
    'camera_alert',
    'system_notification'
  ));

alter table if exists public.push_category_preferences
  drop constraint if exists push_category_preferences_category_check;

alter table if exists public.push_category_preferences
  add constraint push_category_preferences_category_check check (category in (
    'registration',
    'parent_approval',
    'child_approval',
    'payment_reminder',
    'payment',
    'attendance',
    'message',
    'document',
    'compliance',
    'safety_alert',
    'observer_alert',
    'inspection_alert',
    'camera_alert',
    'system_notification'
  ));

create table if not exists public.mobile_app_readiness (
  id uuid primary key default gen_random_uuid(),
  platform text not null unique,
  app_name text not null default 'Gan Batuach',
  status text not null default 'not_ready',
  readiness_score integer not null default 0,
  bundle_identifier text,
  package_identifier text,
  store_listing_status text not null default 'not_started',
  privacy_disclosure_status text not null default 'not_started',
  permissions_status text not null default 'not_started',
  screenshots_status text not null default 'not_started',
  latest_build_number text,
  latest_app_version text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_app_platform_check check (platform in ('ios','android','web_pwa')),
  constraint mobile_app_status_check check (status in ('not_ready','in_progress','ready_for_internal_test','ready_for_store_review','approved','released','blocked')),
  constraint mobile_store_listing_status_check check (store_listing_status in ('not_started','draft','ready','submitted','approved','needs_changes')),
  constraint mobile_privacy_status_check check (privacy_disclosure_status in ('not_started','draft','ready','submitted','approved','needs_changes')),
  constraint mobile_permissions_status_check check (permissions_status in ('not_started','draft','ready','submitted','approved','needs_changes')),
  constraint mobile_screenshots_status_check check (screenshots_status in ('not_started','draft','ready','submitted','approved','needs_changes')),
  constraint mobile_readiness_score_check check (readiness_score between 0 and 100)
);

create table if not exists public.mobile_platform_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  platform text not null,
  category text not null,
  title text not null,
  status text not null default 'pending',
  readiness_score integer not null default 0,
  owner_role text not null default 'admin',
  required_for_release boolean not null default true,
  last_checked_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_check_platform_check check (platform in ('ios','android','web_pwa','all')),
  constraint mobile_check_category_check check (category in ('push','deep_links','security','offline','camera','store_assets','privacy','analytics','crash_monitoring','role_experience')),
  constraint mobile_check_status_check check (status in ('pending','in_progress','prepared','ready','blocked','needs_review','not_applicable')),
  constraint mobile_check_score_check check (readiness_score between 0 and 100)
);

alter table public.mobile_platform_checks
  drop constraint if exists mobile_check_status_check;

alter table public.mobile_platform_checks
  add constraint mobile_check_status_check check (status in ('pending','in_progress','prepared','ready','blocked','needs_review','not_applicable'));

create table if not exists public.mobile_deep_links (
  id uuid primary key default gen_random_uuid(),
  link_key text not null unique,
  link_type text not null,
  path_pattern text not null,
  target_role text not null default 'all',
  status text not null default 'ready',
  requires_auth boolean not null default true,
  permission_scope text,
  fallback_url text not null default '/login',
  app_route text,
  web_route text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_deep_link_type_check check (link_type in ('notification','document','child_profile','message','incident','inspection','camera','payment','task','timeline')),
  constraint mobile_deep_link_status_check check (status in ('ready','draft','disabled','needs_review')),
  constraint mobile_deep_link_role_check check (target_role in ('all','parent','staff','manager','owner','inspector','admin'))
);

create table if not exists public.mobile_security_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  role_key text not null,
  mfa_required boolean not null default false,
  biometric_unlock_allowed boolean not null default true,
  session_timeout_minutes integer not null default 720,
  device_validation_required boolean not null default true,
  camera_watermark_required boolean not null default false,
  status text not null default 'ready',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_security_role_check check (role_key in ('parent','staff','manager','owner','inspector','admin')),
  constraint mobile_security_status_check check (status in ('draft','ready','needs_review','disabled'))
);

create table if not exists public.mobile_offline_capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null unique,
  role_key text not null,
  workflow text not null,
  status text not null default 'prepared',
  sync_strategy text not null default 'queue_then_sync',
  max_offline_hours integer not null default 8,
  conflict_policy text not null default 'manager_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mobile_offline_role_check check (role_key in ('staff','manager','inspector')),
  constraint mobile_offline_workflow_check check (workflow in ('attendance','child_updates','inspections','incident_reports','tasks')),
  constraint mobile_offline_status_check check (status in ('planned','prepared','in_test','ready','disabled')),
  constraint mobile_offline_sync_strategy_check check (sync_strategy in ('queue_then_sync','read_only_cache','manual_review_sync'))
);

create table if not exists public.mobile_crash_reports (
  id uuid primary key default gen_random_uuid(),
  report_key text not null unique,
  platform text not null,
  app_version text,
  build_number text,
  profile_id uuid references public.profiles(id) on delete set null,
  role_key text,
  severity text not null default 'medium',
  status text not null default 'new',
  crash_type text not null default 'unknown',
  device_model text,
  os_version text,
  screen_name text,
  error_summary text,
  occurred_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint mobile_crash_platform_check check (platform in ('ios','android','web_pwa')),
  constraint mobile_crash_severity_check check (severity in ('low','medium','high','critical')),
  constraint mobile_crash_status_check check (status in ('new','triaged','in_progress','resolved','ignored')),
  constraint mobile_crash_type_check check (crash_type in ('crash','fatal_error','startup_failure','render_error','network_failure','unknown'))
);

create table if not exists public.mobile_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  platform text not null,
  active_devices integer not null default 0,
  daily_active_users integer not null default 0,
  push_open_rate numeric(5,2) not null default 0,
  crash_rate numeric(5,2) not null default 0,
  engagement_score integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(snapshot_date, platform),
  constraint mobile_analytics_platform_check check (platform in ('ios','android','web_pwa','all')),
  constraint mobile_engagement_score_check check (engagement_score between 0 and 100)
);

create index if not exists mobile_platform_checks_status_idx on public.mobile_platform_checks(platform, category, status);
create index if not exists mobile_deep_links_role_idx on public.mobile_deep_links(target_role, link_type, status);
create index if not exists mobile_security_role_idx on public.mobile_security_policies(role_key, status);
create index if not exists mobile_offline_role_idx on public.mobile_offline_capabilities(role_key, workflow, status);
create index if not exists mobile_crash_reports_status_idx on public.mobile_crash_reports(platform, severity, status, occurred_at desc);
create index if not exists mobile_analytics_snapshots_idx on public.mobile_analytics_snapshots(platform, snapshot_date desc);

alter table public.mobile_app_readiness enable row level security;
alter table public.mobile_platform_checks enable row level security;
alter table public.mobile_deep_links enable row level security;
alter table public.mobile_security_policies enable row level security;
alter table public.mobile_offline_capabilities enable row level security;
alter table public.mobile_crash_reports enable row level security;
alter table public.mobile_analytics_snapshots enable row level security;

drop policy if exists "mobile app readiness admin only" on public.mobile_app_readiness;
create policy "mobile app readiness admin only" on public.mobile_app_readiness for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "mobile platform checks admin only" on public.mobile_platform_checks;
create policy "mobile platform checks admin only" on public.mobile_platform_checks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "mobile deep links admin read" on public.mobile_deep_links;
create policy "mobile deep links admin read" on public.mobile_deep_links for select using (public.is_admin());

drop policy if exists "mobile deep links admin write" on public.mobile_deep_links;
create policy "mobile deep links admin write" on public.mobile_deep_links for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "mobile security policies admin only" on public.mobile_security_policies;
create policy "mobile security policies admin only" on public.mobile_security_policies for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "mobile offline capabilities admin only" on public.mobile_offline_capabilities;
create policy "mobile offline capabilities admin only" on public.mobile_offline_capabilities for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "mobile crash reports admin read" on public.mobile_crash_reports;
create policy "mobile crash reports admin read" on public.mobile_crash_reports for select using (public.is_admin());

drop policy if exists "mobile crash reports scoped insert" on public.mobile_crash_reports;
create policy "mobile crash reports scoped insert" on public.mobile_crash_reports for insert with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "mobile analytics admin only" on public.mobile_analytics_snapshots;
create policy "mobile analytics admin only" on public.mobile_analytics_snapshots for all using (public.is_admin()) with check (public.is_admin());

insert into public.mobile_app_readiness (
  platform, app_name, status, readiness_score, bundle_identifier, package_identifier,
  store_listing_status, privacy_disclosure_status, permissions_status, screenshots_status, latest_app_version, notes, metadata
) values
  ('ios', 'Gan Batuach', 'in_progress', 72, 'app.ganbatuach.mobile', null, 'draft', 'draft', 'draft', 'draft', '1.0.0', 'iOS readiness for iPhone and iPad. APNs remains dry-run until credentials are configured.', '{"devices":["iphone","ipad"],"permissions":["camera","photos","location","notifications","biometrics"]}'::jsonb),
  ('android', 'Gan Batuach', 'in_progress', 74, null, 'app.ganbatuach.mobile', 'draft', 'draft', 'draft', 'draft', '1.0.0', 'Android readiness for phones and tablets. FCM remains dry-run until credentials are configured.', '{"devices":["phone","tablet"],"permissions":["camera","photos","location","notifications","biometrics"]}'::jsonb),
  ('web_pwa', 'Gan Batuach', 'ready_for_internal_test', 82, null, null, 'ready', 'draft', 'ready', 'ready', '1.0.0', 'PWA manifest and Web Push foundation are available.', '{"installable":true,"web_push":true}'::jsonb)
on conflict (platform) do update set
  readiness_score = excluded.readiness_score,
  status = excluded.status,
  bundle_identifier = excluded.bundle_identifier,
  package_identifier = excluded.package_identifier,
  store_listing_status = excluded.store_listing_status,
  privacy_disclosure_status = excluded.privacy_disclosure_status,
  permissions_status = excluded.permissions_status,
  screenshots_status = excluded.screenshots_status,
  latest_app_version = excluded.latest_app_version,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.mobile_platform_checks (check_key, platform, category, title, status, readiness_score, required_for_release, notes, metadata)
values
  ('ios-apns-config', 'ios', 'push', 'APNs credentials and sandbox test', 'in_progress', 55, true, 'Requires APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID and APNS_PRIVATE_KEY.', '{}'::jsonb),
  ('android-fcm-config', 'android', 'push', 'FCM project and Android delivery test', 'in_progress', 60, true, 'Requires FCM project configuration and dry-run test.', '{}'::jsonb),
  ('push-categories', 'all', 'push', 'Push categories for safety, attendance, messages, inspections, compliance and payments', 'ready', 90, true, 'Categories and preferences are modeled.', '{}'::jsonb),
  ('deep-link-routing', 'all', 'deep_links', 'Deep links for notifications and direct screen open', 'ready', 84, true, 'Core routes are registered in mobile_deep_links.', '{}'::jsonb),
  ('mobile-security-baseline', 'all', 'security', 'MFA, biometric option, session timeout and device validation', 'ready', 78, true, 'Policies are modeled per role.', '{}'::jsonb),
  ('offline-staff-attendance', 'all', 'offline', 'Offline staff attendance and child update queue', 'ready', 80, true, 'Client-side staff queue exists; native persistence still needs QA.', '{}'::jsonb),
  ('offline-inspections', 'all', 'offline', 'Offline inspection form readiness', 'prepared', 65, true, 'Offline workflow modeled; native storage and sync QA still required.', '{}'::jsonb),
  ('camera-mobile-security', 'all', 'camera', 'Secure mobile camera viewing with token, permission and watermark readiness', 'in_progress', 72, true, 'Playback token architecture exists; watermark enforcement requires native QA.', '{}'::jsonb),
  ('app-store-assets', 'ios', 'store_assets', 'App Store screenshots, description and permission explanations', 'in_progress', 52, true, 'Needs final screenshots and privacy labels.', '{}'::jsonb),
  ('google-play-assets', 'android', 'store_assets', 'Google Play listing, screenshots and data safety', 'in_progress', 54, true, 'Needs final screenshots and data safety answers.', '{}'::jsonb),
  ('crash-monitoring', 'all', 'crash_monitoring', 'Crash monitoring model and severity workflow', 'prepared', 62, true, 'Model exists; external SDK not connected.', '{}'::jsonb),
  ('mobile-analytics', 'all', 'analytics', 'Mobile installs, active devices, push opens and engagement', 'prepared', 66, false, 'Snapshot model exists; external analytics SDK not connected.', '{}'::jsonb)
on conflict (check_key) do update set
  platform = excluded.platform,
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  required_for_release = excluded.required_for_release,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.mobile_deep_links (link_key, link_type, path_pattern, target_role, permission_scope, app_route, web_route, fallback_url, metadata)
values
  ('parent-child-timeline', 'timeline', '/dashboard/parent/children/:childId/timeline', 'parent', 'own_child', 'ganbatuach://parent/children/:childId/timeline', '/dashboard/parent/children/:childId/timeline', '/login', '{}'::jsonb),
  ('parent-payments', 'payment', '/dashboard/parent/payments', 'parent', 'own_payments', 'ganbatuach://parent/payments', '/dashboard/parent/payments', '/login', '{}'::jsonb),
  ('parent-messages', 'message', '/dashboard/parent/messages', 'parent', 'own_messages', 'ganbatuach://parent/messages', '/dashboard/parent/messages', '/login', '{}'::jsonb),
  ('staff-attendance', 'notification', '/dashboard/staff/attendance', 'staff', 'own_shift', 'ganbatuach://staff/attendance', '/dashboard/staff/attendance', '/login', '{}'::jsonb),
  ('staff-tasks', 'task', '/dashboard/staff/tasks', 'staff', 'assigned_tasks', 'ganbatuach://staff/tasks', '/dashboard/staff/tasks', '/login', '{}'::jsonb),
  ('manager-command-center', 'notification', '/dashboard/garden/command-center', 'manager', 'own_garden', 'ganbatuach://garden/command-center', '/dashboard/garden/command-center', '/login', '{}'::jsonb),
  ('manager-documents', 'document', '/dashboard/garden/documents', 'manager', 'own_garden', 'ganbatuach://garden/documents', '/dashboard/garden/documents', '/login', '{}'::jsonb),
  ('manager-cameras', 'camera', '/dashboard/garden/cameras', 'manager', 'own_garden_cameras', 'ganbatuach://garden/cameras', '/dashboard/garden/cameras', '/login', '{}'::jsonb),
  ('inspector-inspection', 'inspection', '/dashboard/inspector/inspections', 'inspector', 'assigned_gardens', 'ganbatuach://inspector/inspections', '/dashboard/inspector/inspections', '/login', '{}'::jsonb),
  ('inspector-complaints', 'incident', '/dashboard/inspector/violations', 'inspector', 'assigned_gardens', 'ganbatuach://inspector/violations', '/dashboard/inspector/violations', '/login', '{}'::jsonb)
on conflict (link_key) do update set
  link_type = excluded.link_type,
  path_pattern = excluded.path_pattern,
  target_role = excluded.target_role,
  permission_scope = excluded.permission_scope,
  app_route = excluded.app_route,
  web_route = excluded.web_route,
  fallback_url = excluded.fallback_url,
  updated_at = now();

insert into public.mobile_security_policies (policy_key, role_key, mfa_required, biometric_unlock_allowed, session_timeout_minutes, device_validation_required, camera_watermark_required, status, metadata)
values
  ('parent-mobile-security', 'parent', false, true, 10080, true, true, 'ready', '{"data_scope":"own_children"}'::jsonb),
  ('staff-mobile-security', 'staff', false, true, 720, true, false, 'ready', '{"data_scope":"assigned_garden"}'::jsonb),
  ('manager-mobile-security', 'manager', true, true, 720, true, true, 'ready', '{"data_scope":"own_garden"}'::jsonb),
  ('owner-mobile-security', 'owner', true, true, 720, true, true, 'ready', '{"data_scope":"own_garden"}'::jsonb),
  ('inspector-mobile-security', 'inspector', true, true, 480, true, true, 'ready', '{"data_scope":"assigned_gardens"}'::jsonb),
  ('admin-mobile-security', 'admin', true, true, 240, true, true, 'ready', '{"data_scope":"platform"}'::jsonb)
on conflict (policy_key) do update set
  mfa_required = excluded.mfa_required,
  biometric_unlock_allowed = excluded.biometric_unlock_allowed,
  session_timeout_minutes = excluded.session_timeout_minutes,
  device_validation_required = excluded.device_validation_required,
  camera_watermark_required = excluded.camera_watermark_required,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.mobile_offline_capabilities (capability_key, role_key, workflow, status, sync_strategy, max_offline_hours, conflict_policy, metadata)
values
  ('staff-attendance-offline', 'staff', 'attendance', 'ready', 'queue_then_sync', 8, 'manager_review', '{}'::jsonb),
  ('staff-child-updates-offline', 'staff', 'child_updates', 'ready', 'queue_then_sync', 8, 'manager_review', '{}'::jsonb),
  ('staff-incident-offline', 'staff', 'incident_reports', 'prepared', 'queue_then_sync', 8, 'manager_review', '{}'::jsonb),
  ('manager-tasks-offline', 'manager', 'tasks', 'prepared', 'queue_then_sync', 4, 'manual_review', '{}'::jsonb),
  ('inspector-inspections-offline', 'inspector', 'inspections', 'prepared', 'queue_then_sync', 24, 'manual_review', '{}'::jsonb),
  ('inspector-incident-offline', 'inspector', 'incident_reports', 'prepared', 'queue_then_sync', 24, 'manual_review', '{}'::jsonb)
on conflict (capability_key) do update set
  status = excluded.status,
  sync_strategy = excluded.sync_strategy,
  max_offline_hours = excluded.max_offline_hours,
  conflict_policy = excluded.conflict_policy,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.mobile_analytics_snapshots (snapshot_date, platform, active_devices, daily_active_users, push_open_rate, crash_rate, engagement_score, metadata)
select
  current_date,
  'all',
  (select count(*) from public.push_device_tokens where is_active = true),
  0,
  case
    when (select count(*) from public.push_notification_logs where created_at::date = current_date) = 0 then 0
    else round(((select count(*) from public.push_notification_logs where created_at::date = current_date and (status = 'opened' or opened_at is not null))::numeric / nullif((select count(*) from public.push_notification_logs where created_at::date = current_date), 0)) * 100, 2)
  end,
  0,
  65,
  '{"source":"seeded_readiness_snapshot"}'::jsonb
on conflict (snapshot_date, platform) do update set
  active_devices = excluded.active_devices,
  push_open_rate = excluded.push_open_rate,
  engagement_score = excluded.engagement_score,
  metadata = excluded.metadata;

comment on table public.mobile_app_readiness is 'Readiness tracking for iOS, Android and Web PWA release work.';
comment on table public.mobile_platform_checks is 'Mobile release checklist across push, deep links, security, offline, camera, store assets and analytics.';
comment on table public.mobile_deep_links is 'Role-scoped deep link registry. Links must still pass route-level authorization.';
comment on table public.mobile_security_policies is 'Mobile security requirements by role, including MFA, session timeout, biometrics and camera watermarking.';
comment on table public.mobile_offline_capabilities is 'Offline workflow readiness for staff, manager and inspector mobile operations.';
comment on table public.mobile_crash_reports is 'Crash and fatal error reporting model for future mobile SDK integration.';

notify pgrst, 'reload schema';
