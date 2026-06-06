-- PHASE 100-4: real communication provider readiness center.
-- No production sending is enabled by this migration.

create table if not exists public.communication_provider_configs (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  provider text not null,
  display_name text not null,
  status text not null default 'not_configured',
  mode text not null default 'mock',
  enabled boolean not null default false,
  sender_name text,
  sender_email text,
  sender_phone text,
  environment text not null default 'sandbox',
  domain_verification_status text,
  credentials_configured boolean not null default false,
  webhook_configured boolean not null default false,
  templates_supported boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  last_tested_at timestamptz,
  last_health_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel, provider),
  constraint communication_provider_configs_channel_check check (channel in ('whatsapp','sms','email','push')),
  constraint communication_provider_configs_status_check check (status in ('not_configured','configured','testing','active','disabled')),
  constraint communication_provider_configs_mode_check check (mode in ('mock','dry_run','real'))
);

create table if not exists public.real_communication_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_kind text not null,
  channel text not null,
  provider text not null default 'any',
  language text not null default 'he',
  status text not null default 'draft',
  title text not null,
  body_preview text not null,
  variables jsonb not null default '[]'::jsonb,
  provider_template_id text,
  approval_status text not null default 'not_submitted',
  metadata jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint real_communication_templates_channel_check check (channel in ('whatsapp','sms','email','push')),
  constraint real_communication_templates_status_check check (status in ('draft','configured','testing','active','disabled')),
  constraint real_communication_templates_kind_check check (template_kind in (
    'welcome',
    'password_reset',
    'kindergarten_approval',
    'correction_required',
    'onboarding_completed',
    'parent_invitation',
    'staff_invitation',
    'alerts'
  )),
  constraint real_communication_templates_approval_check check (approval_status in ('not_submitted','pending','approved','rejected','not_required'))
);

create table if not exists public.communication_test_logs (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  provider text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  recipient_preview text,
  template_kind text,
  status text not null default 'queued_mock',
  mode text not null default 'mock',
  dry_run_payload jsonb not null default '{}'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint communication_test_logs_channel_check check (channel in ('whatsapp','sms','email','push')),
  constraint communication_test_logs_status_check check (status in ('queued_mock','sent_mock','failed_mock','queued_dry_run','sent_dry_run','failed_dry_run')),
  constraint communication_test_logs_mode_check check (mode in ('mock','dry_run'))
);

create index if not exists communication_provider_configs_channel_status_idx
  on public.communication_provider_configs(channel, status, provider);

create index if not exists real_communication_templates_channel_kind_idx
  on public.real_communication_templates(channel, template_kind, active);

create index if not exists communication_test_logs_channel_created_idx
  on public.communication_test_logs(channel, created_at desc);

alter table public.communication_provider_configs enable row level security;
alter table public.real_communication_templates enable row level security;
alter table public.communication_test_logs enable row level security;

drop policy if exists "communication provider configs admin only" on public.communication_provider_configs;
create policy "communication provider configs admin only"
on public.communication_provider_configs
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "real communication templates admin only" on public.real_communication_templates;
create policy "real communication templates admin only"
on public.real_communication_templates
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "communication test logs admin only" on public.communication_test_logs;
create policy "communication test logs admin only"
on public.communication_test_logs
for all using (public.is_admin())
with check (public.is_admin());

insert into public.communication_provider_configs (
  channel,
  provider,
  display_name,
  status,
  mode,
  enabled,
  sender_name,
  sender_email,
  sender_phone,
  environment,
  domain_verification_status,
  credentials_configured,
  webhook_configured,
  metadata
)
values
  ('whatsapp','mock_whatsapp','Mock WhatsApp','testing','mock',true,null,null,null,'sandbox',null,false,false,'{"real_sending_disabled":true}'::jsonb),
  ('whatsapp','meta_whatsapp_business','Meta WhatsApp Business Cloud API','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{"supports_templates":true,"requires_template_approval":true}'::jsonb),
  ('whatsapp','twilio_whatsapp','Twilio WhatsApp','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{"supports_templates":true}'::jsonb),
  ('whatsapp','custom','Future WhatsApp Provider','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{"future_provider":true}'::jsonb),
  ('sms','mock_sms','Mock SMS','testing','mock',true,'GanBatuach',null,null,'sandbox',null,false,false,'{"real_sending_disabled":true}'::jsonb),
  ('sms','twilio','Twilio SMS','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{}'::jsonb),
  ('sms','messagebird','MessageBird','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{}'::jsonb),
  ('sms','vonage','Vonage','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{}'::jsonb),
  ('sms','israeli_local','Local SMS Provider','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{"local_provider_readiness":true}'::jsonb),
  ('email','mock_email','Mock Email','testing','mock',true,'Gan Batuach',null,null,'sandbox','not_required',false,false,'{"real_sending_disabled":true}'::jsonb),
  ('email','resend','Resend','not_configured','dry_run',false,'Gan Batuach',null,null,'sandbox','not_verified',false,false,'{}'::jsonb),
  ('email','sendgrid','SendGrid','not_configured','dry_run',false,'Gan Batuach',null,null,'sandbox','not_verified',false,false,'{}'::jsonb),
  ('email','amazon_ses','AWS SES','not_configured','dry_run',false,'Gan Batuach',null,null,'sandbox','not_verified',false,false,'{}'::jsonb),
  ('push','mock_push','Mock Push','testing','mock',true,null,null,null,'sandbox',null,false,false,'{"real_sending_disabled":true}'::jsonb),
  ('push','fcm','Firebase FCM','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{"platforms":["android","web"]}'::jsonb),
  ('push','apns','Apple APNs','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{"platforms":["ios"]}'::jsonb),
  ('push','web_push','Web Push','not_configured','dry_run',false,null,null,null,'sandbox',null,false,false,'{"platforms":["web"]}'::jsonb)
on conflict (channel, provider) do update set
  display_name = excluded.display_name,
  metadata = public.communication_provider_configs.metadata || excluded.metadata,
  updated_at = now();

insert into public.real_communication_templates (
  template_key,
  template_kind,
  channel,
  provider,
  language,
  status,
  title,
  body_preview,
  variables,
  approval_status,
  metadata
)
select
  channel || '_' || template_kind,
  template_kind,
  channel,
  'any',
  'he',
  'draft',
  title,
  body_preview,
  variables,
  case when channel = 'whatsapp' then 'not_submitted' else 'not_required' end,
  '{"real_sending_disabled":true}'::jsonb
from (
  values
    ('welcome','ברוכים הבאים','ברוכים הבאים לגן בטוח. החשבון מוכן, ויש להשלים את הצעדים הראשונים.','["name","login_url"]'::jsonb),
    ('password_reset','איפוס סיסמה','קוד או קישור לאיפוס סיסמה נשלח לבקשת המשתמש.','["name","reset_url","code"]'::jsonb),
    ('kindergarten_approval','הגן אושר','פרופיל הגן אושר והמערכת נפתחה לעבודה רגילה.','["kindergarten_name","login_url"]'::jsonb),
    ('correction_required','נדרש תיקון','נדרשת השלמה לפני אישור סופי. הערת האדמין מצורפת.','["name","note","login_url"]'::jsonb),
    ('onboarding_completed','הקליטה הושלמה','תהליך הקליטה הושלם בהצלחה.','["name","dashboard_url"]'::jsonb),
    ('parent_invitation','הזמנת הורה','נוצר חשבון הורה. יש להתחבר ולהשלים פרטי ילד והרשאות.','["parent_name","login_url","temporary_password"]'::jsonb),
    ('staff_invitation','הזמנת צוות','נוצר חשבון צוות. יש להתחבר ולהשלים פרטים ומסמכים.','["staff_name","login_url","temporary_password"]'::jsonb),
    ('alerts','התראה חשובה','יש התראה שדורשת בדיקה במערכת גן בטוח.','["title","severity","action_url"]'::jsonb)
) as template_catalog(template_kind, title, body_preview, variables)
cross join (values ('whatsapp'), ('sms'), ('email'), ('push')) as channel_catalog(channel)
on conflict (template_key) do update set
  title = excluded.title,
  body_preview = excluded.body_preview,
  variables = excluded.variables,
  updated_at = now();

-- Keep channel-specific provider config tables aligned with the unified center.
insert into public.whatsapp_provider_configs (provider, enabled, mode, last_health_status, metadata)
values
  ('mock_whatsapp', true, 'mock', 'mock_only', '{"real_sending_disabled":true}'::jsonb),
  ('twilio_whatsapp', false, 'mock', 'not_configured', '{"future_provider":true}'::jsonb),
  ('custom', false, 'mock', 'not_configured', '{"future_provider":true}'::jsonb)
on conflict (provider) do nothing;

insert into public.sms_provider_configs (provider, enabled, mode, last_health_status, metadata)
values
  ('vonage', false, 'mock', 'not_configured', '{"future_provider":true}'::jsonb)
on conflict (provider) do nothing;

notify pgrst, 'reload schema';
