create table if not exists public.push_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_name text not null unique,
  category text not null,
  language text not null default 'he',
  status text not null default 'active',
  variables jsonb not null default '[]'::jsonb,
  title_template text not null,
  body_template text,
  default_action_type text,
  default_action_url text,
  provider text not null default 'mock',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_templates_category_check check (category in (
    'registration',
    'parent_approval',
    'child_approval',
    'payment_reminder',
    'safety_alert',
    'observer_alert',
    'inspection_alert',
    'camera_alert',
    'system_notification'
  )),
  constraint push_templates_status_check check (status in ('draft', 'active', 'paused', 'disabled'))
);

alter table if exists public.push_device_tokens
  add column if not exists token_hash text,
  add column if not exists disabled_reason text,
  add column if not exists revoked_at timestamptz,
  add column if not exists provider text not null default 'mock',
  add column if not exists last_error text;

alter table if exists public.push_notification_logs
  add column if not exists template_id uuid references public.push_templates(id) on delete set null,
  add column if not exists category text,
  add column if not exists provider_reference text,
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists retry_attempts integer not null default 0,
  add column if not exists max_retry_attempts integer not null default 3,
  add column if not exists next_retry_at timestamptz,
  add column if not exists dead_letter_at timestamptz,
  add column if not exists deep_link_type text;

alter table if exists public.push_notification_logs
  drop constraint if exists push_notification_logs_status_check;

alter table if exists public.push_notification_logs
  add constraint push_notification_logs_status_check check (status in (
    'queued_mock',
    'sent_mock',
    'queued',
    'sent',
    'delivered',
    'opened',
    'failed',
    'dead_letter',
    'skipped_preferences',
    'no_active_device',
    'deduped'
  ));

create table if not exists public.push_category_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  critical_only boolean not null default false,
  role text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, category),
  constraint push_category_preferences_category_check check (category in (
    'registration',
    'parent_approval',
    'child_approval',
    'payment_reminder',
    'safety_alert',
    'observer_alert',
    'inspection_alert',
    'camera_alert',
    'system_notification'
  ))
);

create table if not exists public.push_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  enabled boolean not null default false,
  mode text not null default 'mock',
  credentials_configured boolean not null default false,
  webhook_configured boolean not null default false,
  last_health_status text,
  last_health_checked_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_provider_configs_provider_check check (provider in ('mock_push', 'fcm', 'apns', 'web_push', 'custom')),
  constraint push_provider_configs_mode_check check (mode in ('mock', 'dry_run', 'real'))
);

create index if not exists push_templates_status_idx
  on public.push_templates (status, category, language);

create index if not exists push_notification_logs_category_idx
  on public.push_notification_logs (category, status, created_at desc);

create index if not exists push_notification_logs_retry_idx
  on public.push_notification_logs (next_retry_at, retry_attempts)
  where status = 'failed';

create index if not exists push_notification_logs_template_idx
  on public.push_notification_logs (template_id, created_at desc);

create index if not exists push_device_tokens_active_platform_idx
  on public.push_device_tokens (platform, is_active, last_seen_at desc);

create index if not exists push_device_tokens_token_hash_idx
  on public.push_device_tokens (token_hash)
  where token_hash is not null;

create index if not exists push_category_preferences_profile_idx
  on public.push_category_preferences (profile_id, category);

alter table public.push_templates enable row level security;
alter table public.push_category_preferences enable row level security;
alter table public.push_provider_configs enable row level security;

drop policy if exists "push templates admin read" on public.push_templates;
create policy "push templates admin read" on public.push_templates
for select using (public.is_admin());

drop policy if exists "push templates admin write" on public.push_templates;
create policy "push templates admin write" on public.push_templates
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "push category preferences own read" on public.push_category_preferences;
create policy "push category preferences own read" on public.push_category_preferences
for select using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "push category preferences own write" on public.push_category_preferences;
create policy "push category preferences own write" on public.push_category_preferences
for all using (public.is_admin() or profile_id = auth.uid())
with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "push provider configs admin only" on public.push_provider_configs;
create policy "push provider configs admin only" on public.push_provider_configs
for all using (public.is_admin())
with check (public.is_admin());

insert into public.push_templates (
  template_key,
  template_name,
  category,
  language,
  status,
  variables,
  title_template,
  body_template,
  default_action_type,
  default_action_url
) values
  ('push_registration', 'Registration Push', 'registration', 'he', 'active', '["name"]'::jsonb, 'ברוכים הבאים לגן בטוח', 'שלום {{name}}, החשבון שלך מוכן.', 'system', '/dashboard'),
  ('push_parent_approval', 'Parent Approval Push', 'parent_approval', 'he', 'active', '["parent_name", "kindergarten_name"]'::jsonb, 'הרישום אושר', '{{parent_name}}, אושרת ל-{{kindergarten_name}}.', 'dashboard', '/dashboard/parent'),
  ('push_child_approval', 'Child Approval Push', 'child_approval', 'he', 'active', '["child_name"]'::jsonb, 'הילד אושר', '{{child_name}} אושר/ה במערכת.', 'child_profile', '/dashboard/parent'),
  ('push_payment_reminder', 'Payment Reminder Push', 'payment_reminder', 'he', 'active', '["amount", "due_date"]'::jsonb, 'תזכורת תשלום', 'יש תשלום בסך {{amount}} לתאריך {{due_date}}.', 'payment', '/dashboard/parent'),
  ('push_safety_alert', 'Safety Alert Push', 'safety_alert', 'he', 'active', '["title"]'::jsonb, 'התראת בטיחות', '{{title}} דורש בדיקה.', 'incident', '/dashboard/garden/incidents'),
  ('push_observer_alert', 'Observer Alert Push', 'observer_alert', 'he', 'active', '["title"]'::jsonb, 'אירוע תצפיתן לבדיקה', '{{title}} ממתין לבדיקה.', 'observer_event', '/dashboard/garden/ai-events'),
  ('push_inspection_alert', 'Inspection Alert Push', 'inspection_alert', 'he', 'active', '["kindergarten_name"]'::jsonb, 'התראת פיקוח', 'נדרשת בדיקה עבור {{kindergarten_name}}.', 'inspection', '/dashboard/inspector/inspections'),
  ('push_camera_alert', 'Camera Alert Push', 'camera_alert', 'he', 'active', '["camera_name"]'::jsonb, 'מצלמה דורשת בדיקה', '{{camera_name}} ממתינה לטיפול.', 'camera', '/dashboard/garden/cameras'),
  ('push_system_notification', 'System Notification Push', 'system_notification', 'he', 'active', '["title"]'::jsonb, 'עדכון מערכת', '{{title}}', 'system', '/dashboard')
on conflict (template_key) do update set
  template_name = excluded.template_name,
  category = excluded.category,
  language = excluded.language,
  variables = excluded.variables,
  title_template = excluded.title_template,
  body_template = excluded.body_template,
  default_action_type = excluded.default_action_type,
  default_action_url = excluded.default_action_url,
  updated_at = now();

insert into public.push_provider_configs (provider, enabled, mode, credentials_configured, webhook_configured, metadata)
values
  ('mock_push', true, 'mock', false, false, '{"real_send": false}'::jsonb),
  ('fcm', false, 'dry_run', false, false, '{"platforms": ["android", "web"]}'::jsonb),
  ('apns', false, 'dry_run', false, false, '{"platforms": ["ios"]}'::jsonb),
  ('web_push', false, 'dry_run', false, false, '{"platforms": ["web"]}'::jsonb),
  ('custom', false, 'dry_run', false, false, '{}'::jsonb)
on conflict (provider) do update set
  metadata = public.push_provider_configs.metadata || excluded.metadata,
  updated_at = now();
