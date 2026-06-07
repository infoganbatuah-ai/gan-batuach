-- PHASE 101: production integrations activation readiness.
-- No real sending is enabled and no provider secrets are stored.

create table if not exists public.production_integrations (
  id uuid primary key default gen_random_uuid(),
  integration_type text not null,
  provider text not null,
  status text not null default 'not_configured',
  environment text not null default 'sandbox',
  last_test_at timestamptz,
  last_test_status text,
  notes text,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(integration_type, provider, environment),
  constraint production_integrations_type_check check (integration_type in ('email','whatsapp','sms','push','supabase','vercel','camera_gateway','ai_provider')),
  constraint production_integrations_status_check check (status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed')),
  constraint production_integrations_environment_check check (environment in ('sandbox','staging','production'))
);

create table if not exists public.production_integration_test_recipients (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null,
  recipient_value text not null,
  label text,
  active boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recipient_type, recipient_value),
  constraint production_test_recipient_type_check check (recipient_type in ('email','phone','push_profile'))
);

create table if not exists public.production_integration_test_logs (
  id uuid primary key default gen_random_uuid(),
  integration_type text not null,
  provider text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  recipient_preview text,
  status text not null default 'sent_mock',
  mode text not null default 'mock',
  test_payload jsonb not null default '{}'::jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint production_test_logs_type_check check (integration_type in ('email','whatsapp','sms','push','supabase','vercel','camera_gateway','ai_provider')),
  constraint production_test_logs_status_check check (status in ('queued_mock','sent_mock','failed_mock','queued_dry_run','sent_dry_run','failed_dry_run')),
  constraint production_test_logs_mode_check check (mode in ('mock','dry_run'))
);

create table if not exists public.production_webhook_readiness (
  id uuid primary key default gen_random_uuid(),
  webhook_key text not null unique,
  integration_type text not null,
  provider text not null,
  endpoint_path text not null,
  status text not null default 'not_configured',
  signing_secret_env text,
  last_test_at timestamptz,
  last_test_status text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint production_webhook_type_check check (integration_type in ('email','whatsapp','sms','push')),
  constraint production_webhook_status_check check (status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed'))
);

create index if not exists idx_production_integrations_type_status on public.production_integrations(integration_type, status, provider);
create index if not exists idx_production_integration_test_logs_type_created on public.production_integration_test_logs(integration_type, created_at desc);
create index if not exists idx_production_webhook_readiness_status on public.production_webhook_readiness(integration_type, status);

alter table public.production_integrations enable row level security;
alter table public.production_integration_test_recipients enable row level security;
alter table public.production_integration_test_logs enable row level security;
alter table public.production_webhook_readiness enable row level security;

drop policy if exists "production integrations admin only" on public.production_integrations;
create policy "production integrations admin only" on public.production_integrations for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "production integration test recipients admin only" on public.production_integration_test_recipients;
create policy "production integration test recipients admin only" on public.production_integration_test_recipients for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "production integration test logs admin only" on public.production_integration_test_logs;
create policy "production integration test logs admin only" on public.production_integration_test_logs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "production webhook readiness admin only" on public.production_webhook_readiness;
create policy "production webhook readiness admin only" on public.production_webhook_readiness for all using (public.is_admin()) with check (public.is_admin());

insert into public.production_integrations (integration_type, provider, status, environment, notes, metadata)
values
  ('email','resend','not_configured','production','Email provider readiness. Secrets must stay in env vars.', '{"required_env":["EMAIL_PROVIDER","EMAIL_API_KEY","EMAIL_FROM_ADDRESS"],"sender_email_required":true,"domain_verification_required":true}'::jsonb),
  ('email','sendgrid','not_configured','production','Email provider readiness. Secrets must stay in env vars.', '{"required_env":["EMAIL_PROVIDER","EMAIL_API_KEY","EMAIL_FROM_ADDRESS","SENDGRID_WEBHOOK_SECRET"],"sender_email_required":true,"domain_verification_required":true}'::jsonb),
  ('email','amazon_ses','not_configured','production','Amazon SES readiness. Secrets must stay in env vars.', '{"required_env":["AWS_SES_REGION","AWS_SES_ACCESS_KEY_ID","AWS_SES_SECRET_ACCESS_KEY","EMAIL_FROM_ADDRESS"],"domain_verification_required":true}'::jsonb),
  ('whatsapp','meta_whatsapp_business','not_configured','production','Meta WhatsApp Cloud API readiness.', '{"required_env":["WHATSAPP_ACCESS_TOKEN","WHATSAPP_PHONE_NUMBER_ID","WHATSAPP_BUSINESS_ACCOUNT_ID","WHATSAPP_WEBHOOK_VERIFY_TOKEN"],"template_approval_required":true,"webhook_required":true}'::jsonb),
  ('whatsapp','twilio_whatsapp','not_configured','production','Twilio WhatsApp readiness.', '{"required_env":["TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","TWILIO_WHATSAPP_FROM"],"template_approval_required":true,"webhook_required":true}'::jsonb),
  ('sms','twilio','not_configured','production','Twilio SMS readiness.', '{"required_env":["SMS_PROVIDER","SMS_API_KEY","SMS_FROM_NUMBER"],"sender_name_required":true}'::jsonb),
  ('sms','messagebird','not_configured','production','MessageBird SMS readiness.', '{"required_env":["SMS_PROVIDER","SMS_API_KEY","SMS_FROM_NUMBER"],"sender_name_required":true}'::jsonb),
  ('sms','vonage','not_configured','production','Vonage SMS readiness.', '{"required_env":["VONAGE_API_KEY","VONAGE_API_SECRET","SMS_FROM_NUMBER"],"sender_name_required":true}'::jsonb),
  ('sms','israeli_local','not_configured','production','Israeli SMS provider readiness.', '{"required_env":["SMS_API_KEY","SMS_PROVIDER_ACCOUNT_ID","SMS_FROM_NUMBER"],"local_provider_readiness":true}'::jsonb),
  ('push','fcm','not_configured','production','Firebase FCM readiness for Android and Web.', '{"required_env":["FCM_PROJECT_ID","FCM_SERVER_KEY"],"android_ready":false,"web_ready":false}'::jsonb),
  ('push','apns','not_configured','production','Apple APNs readiness for iOS.', '{"required_env":["APNS_KEY_ID","APNS_TEAM_ID","APNS_BUNDLE_ID","APNS_PRIVATE_KEY"],"ios_ready":false}'::jsonb),
  ('push','web_push','not_configured','production','Web Push readiness.', '{"required_env":["VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY"],"web_ready":false}'::jsonb),
  ('supabase','supabase','configured','production','Supabase project readiness. Verify Auth, Storage and RLS before go-live.', '{"required_env":["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","SUPABASE_SERVICE_ROLE_KEY"],"secrets_in_env_only":true}'::jsonb),
  ('vercel','vercel','not_configured','production','Vercel deployment readiness.', '{"required_env":["NEXT_PUBLIC_APP_URL","APP_URL"],"domain_required":true,"ssl_required":true}'::jsonb),
  ('camera_gateway','mediamtx','not_configured','production','MediaMTX gateway readiness.', '{"required_env":["VIDEO_GATEWAY_URL","VIDEO_GATEWAY_API_KEY"],"rtsp_browser_exposure":false}'::jsonb),
  ('camera_gateway','go2rtc','not_configured','production','go2rtc gateway readiness.', '{"required_env":["VIDEO_GATEWAY_URL","VIDEO_GATEWAY_API_KEY"],"rtsp_browser_exposure":false}'::jsonb),
  ('camera_gateway','custom','not_configured','production','Custom camera gateway readiness.', '{"required_env":["VIDEO_GATEWAY_URL","VIDEO_GATEWAY_SIGNING_SECRET"],"rtsp_browser_exposure":false}'::jsonb),
  ('ai_provider','local_mock','test_mode','production','Safe mock provider. Human review remains mandatory.', '{"shadow_mode":true,"human_review_required":true,"real_processing":false}'::jsonb),
  ('ai_provider','local_http','not_configured','production','Local AI endpoint readiness.', '{"required_env":["LOCAL_VISION_ENDPOINT"],"shadow_mode":true,"human_review_required":true}'::jsonb),
  ('ai_provider','custom','not_configured','production','Custom AI provider readiness.', '{"required_env":["CUSTOM_VISION_ENDPOINT"],"shadow_mode":true,"human_review_required":true}'::jsonb)
on conflict (integration_type, provider, environment) do update set
  notes = excluded.notes,
  metadata = production_integrations.metadata || excluded.metadata,
  updated_at = now();

insert into public.production_webhook_readiness (webhook_key, integration_type, provider, endpoint_path, status, signing_secret_env, notes, metadata)
values
  ('whatsapp-meta-delivery','whatsapp','meta_whatsapp_business','/api/webhooks/whatsapp/meta','not_configured','WHATSAPP_WEBHOOK_VERIFY_TOKEN','Meta WhatsApp delivery/status webhook readiness.', '{"public_endpoint_requires_signature":true}'::jsonb),
  ('whatsapp-twilio-delivery','whatsapp','twilio_whatsapp','/api/webhooks/whatsapp/twilio','not_configured','TWILIO_AUTH_TOKEN','Twilio WhatsApp delivery webhook readiness.', '{"public_endpoint_requires_signature":true}'::jsonb),
  ('email-sendgrid-delivery','email','sendgrid','/api/webhooks/email/sendgrid','not_configured','SENDGRID_WEBHOOK_SECRET','SendGrid delivery webhook readiness.', '{"public_endpoint_requires_signature":true}'::jsonb),
  ('email-resend-delivery','email','resend','/api/webhooks/email/resend','not_configured','RESEND_WEBHOOK_SECRET','Resend delivery webhook readiness.', '{"public_endpoint_requires_signature":true}'::jsonb),
  ('sms-delivery','sms','any','/api/webhooks/sms/delivery','not_configured','SMS_WEBHOOK_SECRET','SMS delivery webhook readiness.', '{"public_endpoint_requires_signature":true}'::jsonb),
  ('push-feedback','push','any','/api/webhooks/push/feedback','not_configured','PUSH_WEBHOOK_SECRET','Push delivery feedback readiness.', '{"public_endpoint_requires_signature":true}'::jsonb)
on conflict (webhook_key) do update set
  integration_type = excluded.integration_type,
  provider = excluded.provider,
  endpoint_path = excluded.endpoint_path,
  status = excluded.status,
  signing_secret_env = excluded.signing_secret_env,
  notes = excluded.notes,
  metadata = production_webhook_readiness.metadata || excluded.metadata,
  updated_at = now();

notify pgrst, 'reload schema';
