-- PROD-2: SMS production readiness infrastructure.
-- This adds SMS template, opt-in, retry and delivery log models without enabling real sends.

do $$ begin
  create type public.sms_template_category as enum ('authentication', 'utility', 'alert', 'reminder', 'service');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sms_template_status as enum ('draft', 'active', 'paused', 'disabled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sms_delivery_status as enum ('queued', 'sent', 'delivered', 'failed', 'dead_letter');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sms_event_type as enum (
    'registration_verification',
    'password_reset',
    'parent_approval',
    'child_approval',
    'safety_alert',
    'payment_reminder',
    'inspection_reminder'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.sms_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_name text not null unique,
  category public.sms_template_category not null default 'utility',
  language text not null default 'he',
  status public.sms_template_status not null default 'draft',
  event_type public.sms_event_type not null,
  variables jsonb not null default '[]'::jsonb,
  body_template text not null,
  provider text not null default 'mock_sms',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_message_logs (
  id uuid primary key default gen_random_uuid(),
  communication_log_id uuid references public.communication_logs(id) on delete set null,
  template_id uuid references public.sms_templates(id) on delete set null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete set null,
  event_type public.sms_event_type not null,
  recipient_phone text,
  masked_phone text,
  message_preview text,
  status public.sms_delivery_status not null default 'queued',
  provider text not null default 'mock_sms',
  provider_message_id text,
  provider_reference text,
  variables jsonb not null default '{}'::jsonb,
  failure_reason text,
  retry_attempts integer not null default 0,
  max_retry_attempts integer not null default 3,
  next_retry_at timestamptz,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  dead_letter_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create table if not exists public.sms_opt_ins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  phone_e164 text not null,
  opted_in boolean not null default false,
  opt_in_source text not null default 'not_collected',
  consent_text text,
  consented_at timestamptz,
  revoked_at timestamptz,
  last_verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id, phone_e164)
);

create table if not exists public.sms_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique default 'mock_sms',
  enabled boolean not null default false,
  mode text not null default 'mock',
  sender_id text,
  api_key_configured boolean not null default false,
  webhook_configured boolean not null default false,
  last_health_status text not null default 'not_configured',
  last_health_checked_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_templates_status_idx on public.sms_templates(status, event_type, active);
create index if not exists sms_message_logs_status_idx on public.sms_message_logs(status, created_at desc);
create index if not exists sms_message_logs_retry_idx on public.sms_message_logs(status, next_retry_at) where status = 'failed';
create index if not exists sms_message_logs_kindergarten_idx on public.sms_message_logs(kindergarten_id, status, created_at desc);
create index if not exists sms_message_logs_recipient_idx on public.sms_message_logs(recipient_profile_id, created_at desc);
create index if not exists sms_opt_ins_profile_idx on public.sms_opt_ins(profile_id, opted_in);

alter table public.sms_templates enable row level security;
alter table public.sms_message_logs enable row level security;
alter table public.sms_opt_ins enable row level security;
alter table public.sms_provider_configs enable row level security;

drop policy if exists "sms templates readable" on public.sms_templates;
create policy "sms templates readable" on public.sms_templates
for select using (active = true or public.is_admin());

drop policy if exists "sms templates admin write" on public.sms_templates;
create policy "sms templates admin write" on public.sms_templates
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sms logs scoped read" on public.sms_message_logs;
create policy "sms logs scoped read" on public.sms_message_logs
for select using (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "sms logs scoped insert" on public.sms_message_logs;
create policy "sms logs scoped insert" on public.sms_message_logs
for insert with check (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "sms logs admin update" on public.sms_message_logs;
create policy "sms logs admin update" on public.sms_message_logs
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "sms opt ins own read" on public.sms_opt_ins;
create policy "sms opt ins own read" on public.sms_opt_ins
for select using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "sms opt ins own write" on public.sms_opt_ins;
create policy "sms opt ins own write" on public.sms_opt_ins
for all using (public.is_admin() or profile_id = auth.uid())
with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "sms provider configs admin only" on public.sms_provider_configs;
create policy "sms provider configs admin only" on public.sms_provider_configs
for all using (public.is_admin())
with check (public.is_admin());

insert into public.sms_templates (template_key, template_name, category, language, status, event_type, variables, body_template, active, metadata)
values
  ('sms_registration_verification', 'gan_batuach_registration_verification_he', 'authentication', 'he', 'draft', 'registration_verification', '["verificationCode"]'::jsonb, 'קוד האימות שלך לגן בטוח: {{verificationCode}}', true, '{"mock_only":true}'::jsonb),
  ('sms_password_reset', 'gan_batuach_password_reset_he', 'authentication', 'he', 'draft', 'password_reset', '["resetCode"]'::jsonb, 'קוד איפוס הסיסמה שלך לגן בטוח: {{resetCode}}', true, '{"mock_only":true}'::jsonb),
  ('sms_parent_approval', 'gan_batuach_parent_approved_he', 'utility', 'he', 'draft', 'parent_approval', '["kindergartenName"]'::jsonb, 'בקשת ההצטרפות שלך אושרה. אפשר להתחבר לגן בטוח ולהשלים פרטים.', true, '{"mock_only":true}'::jsonb),
  ('sms_child_approval', 'gan_batuach_child_approved_he', 'utility', 'he', 'draft', 'child_approval', '["childName"]'::jsonb, 'כרטיס הילד {{childName}} אושר בגן בטוח.', true, '{"mock_only":true}'::jsonb),
  ('sms_safety_alert', 'gan_batuach_safety_alert_he', 'alert', 'he', 'draft', 'safety_alert', '["alertTitle"]'::jsonb, 'יש עדכון בטיחות שדורש בדיקה במערכת גן בטוח.', true, '{"mock_only":true,"human_review_required":true}'::jsonb),
  ('sms_payment_reminder', 'gan_batuach_payment_reminder_he', 'reminder', 'he', 'draft', 'payment_reminder', '["amount","dueDate"]'::jsonb, 'תזכורת תשלום מהגן. פרטים מלאים זמינים במערכת גן בטוח.', true, '{"mock_only":true}'::jsonb),
  ('sms_inspection_reminder', 'gan_batuach_inspection_reminder_he', 'reminder', 'he', 'draft', 'inspection_reminder', '["kindergartenName","dueDate"]'::jsonb, 'תזכורת פיקוח קרובה לגן {{kindergartenName}}. פרטים במערכת.', true, '{"mock_only":true}'::jsonb)
on conflict (template_key) do update set
  template_name = excluded.template_name,
  category = excluded.category,
  language = excluded.language,
  event_type = excluded.event_type,
  variables = excluded.variables,
  body_template = excluded.body_template,
  active = excluded.active,
  updated_at = now();

insert into public.sms_provider_configs (provider, enabled, mode, last_health_status, metadata)
values
  ('mock_sms', false, 'mock', 'mock_only', '{"real_sending_disabled":true}'::jsonb),
  ('twilio', false, 'mock', 'not_configured', '{"future_provider":true}'::jsonb),
  ('messagebird', false, 'mock', 'not_configured', '{"future_provider":true}'::jsonb),
  ('israeli_local', false, 'mock', 'not_configured', '{"future_provider":true}'::jsonb)
on conflict (provider) do nothing;

notify pgrst, 'reload schema';
