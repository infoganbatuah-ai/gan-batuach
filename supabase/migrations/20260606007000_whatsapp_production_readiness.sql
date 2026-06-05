-- PROD-1: WhatsApp Business production readiness infrastructure.
-- This adds template, opt-in and delivery log models without enabling real sends.

do $$ begin
  create type public.whatsapp_template_category as enum ('marketing', 'utility', 'authentication', 'service');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_template_status as enum ('draft', 'pending_approval', 'approved', 'rejected', 'paused', 'disabled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_delivery_status as enum ('queued', 'sent', 'delivered', 'read', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.whatsapp_event_type as enum (
    'registration',
    'verification',
    'parent_approval',
    'child_approval',
    'payment_reminder',
    'safety_alert',
    'inspection_alert'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_name text not null unique,
  category public.whatsapp_template_category not null default 'utility',
  language text not null default 'he',
  status public.whatsapp_template_status not null default 'draft',
  event_type public.whatsapp_event_type not null,
  variables jsonb not null default '[]'::jsonb,
  body_preview text,
  provider text not null default 'meta_whatsapp_business',
  provider_template_id text,
  approved_at timestamptz,
  rejected_reason text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  communication_log_id uuid references public.communication_logs(id) on delete set null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete set null,
  event_type public.whatsapp_event_type not null,
  recipient_phone text,
  masked_phone text,
  status public.whatsapp_delivery_status not null default 'queued',
  provider text not null default 'mock_whatsapp',
  provider_message_id text,
  template_name text,
  template_language text not null default 'he',
  variables jsonb not null default '{}'::jsonb,
  failure_reason text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create table if not exists public.whatsapp_opt_ins (
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

create table if not exists public.whatsapp_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider text not null unique default 'meta_whatsapp_business',
  enabled boolean not null default false,
  mode text not null default 'mock',
  phone_number_id text,
  business_account_id text,
  app_id text,
  webhook_verify_token_configured boolean not null default false,
  access_token_configured boolean not null default false,
  last_health_status text not null default 'not_configured',
  last_health_checked_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_templates_status_idx on public.whatsapp_templates(status, event_type, active);
create index if not exists whatsapp_message_logs_status_idx on public.whatsapp_message_logs(status, created_at desc);
create index if not exists whatsapp_message_logs_kindergarten_idx on public.whatsapp_message_logs(kindergarten_id, status, created_at desc);
create index if not exists whatsapp_message_logs_recipient_idx on public.whatsapp_message_logs(recipient_profile_id, created_at desc);
create index if not exists whatsapp_opt_ins_profile_idx on public.whatsapp_opt_ins(profile_id, opted_in);

alter table public.whatsapp_templates enable row level security;
alter table public.whatsapp_message_logs enable row level security;
alter table public.whatsapp_opt_ins enable row level security;
alter table public.whatsapp_provider_configs enable row level security;

drop policy if exists "whatsapp templates readable" on public.whatsapp_templates;
create policy "whatsapp templates readable" on public.whatsapp_templates
for select using (active = true or public.is_admin());

drop policy if exists "whatsapp templates admin write" on public.whatsapp_templates;
create policy "whatsapp templates admin write" on public.whatsapp_templates
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "whatsapp logs scoped read" on public.whatsapp_message_logs;
create policy "whatsapp logs scoped read" on public.whatsapp_message_logs
for select using (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "whatsapp logs scoped insert" on public.whatsapp_message_logs;
create policy "whatsapp logs scoped insert" on public.whatsapp_message_logs
for insert with check (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "whatsapp logs admin update" on public.whatsapp_message_logs;
create policy "whatsapp logs admin update" on public.whatsapp_message_logs
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "whatsapp opt ins own read" on public.whatsapp_opt_ins;
create policy "whatsapp opt ins own read" on public.whatsapp_opt_ins
for select using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "whatsapp opt ins own write" on public.whatsapp_opt_ins;
create policy "whatsapp opt ins own write" on public.whatsapp_opt_ins
for all using (public.is_admin() or profile_id = auth.uid())
with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "whatsapp provider configs admin only" on public.whatsapp_provider_configs;
create policy "whatsapp provider configs admin only" on public.whatsapp_provider_configs
for all using (public.is_admin())
with check (public.is_admin());

insert into public.whatsapp_templates (template_key, template_name, category, language, status, event_type, variables, body_preview, active, metadata)
values
  ('wa_registration', 'gan_batuach_registration_he', 'utility', 'he', 'draft', 'registration', '["userName","kindergartenName"]'::jsonb, 'ברוכים הבאים לגן בטוח. בקשת ההצטרפות התקבלה.', true, '{"mock_only":true}'::jsonb),
  ('wa_verification', 'gan_batuach_verification_he', 'authentication', 'he', 'draft', 'verification', '["verificationCode"]'::jsonb, 'קוד האימות שלך לגן בטוח הוא {{verificationCode}}.', true, '{"mock_only":true}'::jsonb),
  ('wa_parent_approval', 'gan_batuach_parent_approved_he', 'utility', 'he', 'draft', 'parent_approval', '["parentName","kindergartenName"]'::jsonb, 'בקשת ההצטרפות שלך אושרה. אפשר להתחבר ולהשלים פרטים.', true, '{"mock_only":true}'::jsonb),
  ('wa_child_approval', 'gan_batuach_child_approved_he', 'utility', 'he', 'draft', 'child_approval', '["childName","kindergartenName"]'::jsonb, 'כרטיס הילד אושר והילד פעיל בגן.', true, '{"mock_only":true}'::jsonb),
  ('wa_payment_reminder', 'gan_batuach_payment_reminder_he', 'utility', 'he', 'draft', 'payment_reminder', '["kindergartenName","amount","dueDate"]'::jsonb, 'תזכורת תשלום מהגן. פרטים מלאים זמינים במערכת.', true, '{"mock_only":true}'::jsonb),
  ('wa_safety_alert', 'gan_batuach_safety_alert_he', 'utility', 'he', 'draft', 'safety_alert', '["kindergartenName","alertTitle"]'::jsonb, 'יש עדכון בטיחות שדורש בדיקה במערכת.', true, '{"mock_only":true,"human_review_required":true}'::jsonb),
  ('wa_inspection_alert', 'gan_batuach_inspection_alert_he', 'utility', 'he', 'draft', 'inspection_alert', '["kindergartenName","dueDate"]'::jsonb, 'תזכורת פיקוח קרובה. פרטים מלאים במערכת.', true, '{"mock_only":true}'::jsonb)
on conflict (template_key) do update set
  template_name = excluded.template_name,
  category = excluded.category,
  language = excluded.language,
  event_type = excluded.event_type,
  variables = excluded.variables,
  body_preview = excluded.body_preview,
  active = excluded.active,
  updated_at = now();

insert into public.whatsapp_provider_configs (
  provider,
  enabled,
  mode,
  last_health_status,
  metadata
)
values (
  'meta_whatsapp_business',
  false,
  'mock',
  'mock_only',
  '{"real_sending_disabled":true}'::jsonb
)
on conflict (provider) do nothing;

notify pgrst, 'reload schema';
