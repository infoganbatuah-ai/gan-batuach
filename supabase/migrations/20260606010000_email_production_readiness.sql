alter table if exists public.communication_preferences
  add column if not exists receive_email boolean not null default true;

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_name text not null unique,
  category text not null,
  language text not null default 'he',
  status text not null default 'active',
  variables jsonb not null default '[]'::jsonb,
  subject_template text not null,
  body_text_template text not null,
  body_html_template text,
  default_action_url text,
  provider text not null default 'mock',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_templates_category_check check (category in (
    'verification',
    'password_reset',
    'invitation',
    'parent_approval',
    'staff_invitation',
    'inspection_notice',
    'observer_notification',
    'billing_readiness',
    'report'
  )),
  constraint email_templates_status_check check (status in ('draft', 'active', 'paused', 'disabled'))
);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  communication_log_id uuid references public.communication_logs(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete set null,
  category text,
  recipient_email text,
  subject_preview text,
  message_preview text,
  status text not null default 'queued',
  provider text not null default 'mock_email',
  provider_message_id text,
  provider_reference text,
  failure_reason text,
  retry_attempts integer not null default 0,
  max_retry_attempts integer not null default 3,
  next_retry_at timestamptz,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  failed_at timestamptz,
  dead_letter_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_delivery_logs_status_check check (status in (
    'queued',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'failed',
    'dead_letter',
    'skipped_preferences',
    'deduped'
  ))
);

create table if not exists public.email_category_preferences (
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
  constraint email_category_preferences_category_check check (category in (
    'verification',
    'password_reset',
    'invitation',
    'parent_approval',
    'staff_invitation',
    'inspection_notice',
    'observer_notification',
    'billing_readiness',
    'report'
  ))
);

create table if not exists public.email_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique,
  enabled boolean not null default false,
  mode text not null default 'mock',
  from_email text,
  from_name text,
  api_key_configured boolean not null default false,
  webhook_configured boolean not null default false,
  last_health_status text,
  last_health_checked_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_provider_configs_provider_check check (provider in ('mock_email', 'resend', 'sendgrid', 'amazon_ses', 'custom')),
  constraint email_provider_configs_mode_check check (mode in ('mock', 'dry_run', 'real'))
);

create index if not exists email_templates_status_idx
  on public.email_templates (status, category, language);

create index if not exists email_delivery_logs_status_idx
  on public.email_delivery_logs (status, created_at desc);

create index if not exists email_delivery_logs_category_idx
  on public.email_delivery_logs (category, status, created_at desc);

create index if not exists email_delivery_logs_retry_idx
  on public.email_delivery_logs (next_retry_at, retry_attempts)
  where status = 'failed';

create index if not exists email_delivery_logs_recipient_idx
  on public.email_delivery_logs (recipient_profile_id, created_at desc);

create index if not exists email_delivery_logs_kindergarten_idx
  on public.email_delivery_logs (kindergarten_id, created_at desc);

create index if not exists email_category_preferences_profile_idx
  on public.email_category_preferences (profile_id, category);

alter table public.email_templates enable row level security;
alter table public.email_delivery_logs enable row level security;
alter table public.email_category_preferences enable row level security;
alter table public.email_provider_configs enable row level security;

drop policy if exists "email templates admin read" on public.email_templates;
create policy "email templates admin read" on public.email_templates
for select using (public.is_admin());

drop policy if exists "email templates admin write" on public.email_templates;
create policy "email templates admin write" on public.email_templates
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "email delivery logs scoped read" on public.email_delivery_logs;
create policy "email delivery logs scoped read" on public.email_delivery_logs
for select using (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or public.can_access_garden(kindergarten_id)
);

drop policy if exists "email delivery logs scoped insert" on public.email_delivery_logs;
create policy "email delivery logs scoped insert" on public.email_delivery_logs
for insert with check (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or public.can_access_garden(kindergarten_id)
);

drop policy if exists "email delivery logs admin update" on public.email_delivery_logs;
create policy "email delivery logs admin update" on public.email_delivery_logs
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "email category preferences own read" on public.email_category_preferences;
create policy "email category preferences own read" on public.email_category_preferences
for select using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "email category preferences own write" on public.email_category_preferences;
create policy "email category preferences own write" on public.email_category_preferences
for all using (public.is_admin() or profile_id = auth.uid())
with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "email provider configs admin only" on public.email_provider_configs;
create policy "email provider configs admin only" on public.email_provider_configs
for all using (public.is_admin())
with check (public.is_admin());

insert into public.email_templates (
  template_key,
  template_name,
  category,
  language,
  status,
  variables,
  subject_template,
  body_text_template,
  body_html_template,
  default_action_url
) values
  ('email_verification', 'Verification Email', 'verification', 'he', 'active', '["name", "verification_link"]'::jsonb, 'אימות חשבון גן בטוח', 'שלום {{name}}, לאימות החשבון יש לפתוח את הקישור: {{verification_link}}', '<p>שלום {{name}},</p><p>לאימות החשבון יש לפתוח את הקישור: <a href="{{verification_link}}">אימות חשבון</a></p>', '/login'),
  ('email_password_reset', 'Password Reset Email', 'password_reset', 'he', 'active', '["name", "reset_link"]'::jsonb, 'איפוס סיסמה', 'שלום {{name}}, לאיפוס הסיסמה יש לפתוח את הקישור: {{reset_link}}', '<p>שלום {{name}},</p><p><a href="{{reset_link}}">איפוס סיסמה</a></p>', '/login'),
  ('email_invitation', 'Invitation Email', 'invitation', 'he', 'active', '["name", "kindergarten_name", "invite_link"]'::jsonb, 'הזמנה לגן בטוח', 'שלום {{name}}, הוזמנת ל-{{kindergarten_name}}. קישור: {{invite_link}}', '<p>שלום {{name}},</p><p>הוזמנת ל-{{kindergarten_name}}.</p><p><a href="{{invite_link}}">כניסה למערכת</a></p>', '/login'),
  ('email_parent_approval', 'Parent Approval Email', 'parent_approval', 'he', 'active', '["parent_name", "kindergarten_name"]'::jsonb, 'הרישום לגן אושר', 'שלום {{parent_name}}, הרישום ל-{{kindergarten_name}} אושר.', '<p>שלום {{parent_name}},</p><p>הרישום ל-{{kindergarten_name}} אושר.</p>', '/dashboard/parent'),
  ('email_staff_invitation', 'Staff Invitation Email', 'staff_invitation', 'he', 'active', '["staff_name", "kindergarten_name"]'::jsonb, 'הזמנה לצוות הגן', 'שלום {{staff_name}}, נוסף לך חשבון צוות ב-{{kindergarten_name}}.', '<p>שלום {{staff_name}},</p><p>נוסף לך חשבון צוות ב-{{kindergarten_name}}.</p>', '/dashboard/staff'),
  ('email_inspection_notice', 'Inspection Notice Email', 'inspection_notice', 'he', 'active', '["kindergarten_name", "inspection_date"]'::jsonb, 'עדכון פיקוח', 'עדכון פיקוח עבור {{kindergarten_name}} בתאריך {{inspection_date}}.', '<p>עדכון פיקוח עבור {{kindergarten_name}} בתאריך {{inspection_date}}.</p>', '/dashboard/garden/inspections'),
  ('email_observer_notification', 'Observer Notification Email', 'observer_notification', 'he', 'active', '["title"]'::jsonb, 'אירוע תצפיתן לבדיקה', '{{title}} ממתין לבדיקה.', '<p>{{title}} ממתין לבדיקה.</p>', '/dashboard/garden/ai-events'),
  ('email_billing_readiness', 'Billing Readiness Email', 'billing_readiness', 'he', 'active', '["title"]'::jsonb, 'עדכון חיוב', '{{title}}', '<p>{{title}}</p>', '/dashboard/garden/subscription'),
  ('email_report', 'Report Email', 'report', 'he', 'active', '["report_name"]'::jsonb, 'דוח גן בטוח', 'הדוח {{report_name}} מוכן לצפייה.', '<p>הדוח {{report_name}} מוכן לצפייה.</p>', '/dashboard')
on conflict (template_key) do update set
  template_name = excluded.template_name,
  category = excluded.category,
  language = excluded.language,
  variables = excluded.variables,
  subject_template = excluded.subject_template,
  body_text_template = excluded.body_text_template,
  body_html_template = excluded.body_html_template,
  default_action_url = excluded.default_action_url,
  updated_at = now();

insert into public.email_provider_configs (provider, enabled, mode, from_email, from_name, api_key_configured, webhook_configured, metadata)
values
  ('mock_email', true, 'mock', null, 'Gan Batuach', false, false, '{"real_send": false}'::jsonb),
  ('resend', false, 'dry_run', null, 'Gan Batuach', false, false, '{}'::jsonb),
  ('sendgrid', false, 'dry_run', null, 'Gan Batuach', false, false, '{}'::jsonb),
  ('amazon_ses', false, 'dry_run', null, 'Gan Batuach', false, false, '{}'::jsonb),
  ('custom', false, 'dry_run', null, 'Gan Batuach', false, false, '{}'::jsonb)
on conflict (provider) do update set
  metadata = public.email_provider_configs.metadata || excluded.metadata,
  updated_at = now();
