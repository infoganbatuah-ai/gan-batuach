-- PHASE 163: Real provider integrations activation.
-- Safe by default: no secrets in database, no broad sends, no live payments without env flags.

alter table public.production_integrations add column if not exists send_mode text not null default 'mock';
alter table public.production_integrations add column if not exists missing_configuration jsonb not null default '[]'::jsonb;
alter table public.production_integrations add column if not exists webhook_status text not null default 'not_configured';
alter table public.production_integrations add column if not exists disabled_at timestamptz;

alter table public.production_integrations drop constraint if exists production_integrations_type_check;
alter table public.production_integrations add constraint production_integrations_type_check
  check (integration_type in ('email','whatsapp','sms','push','payment','invoice','supabase','vercel','camera_gateway','ai_provider'));

alter table public.production_integrations drop constraint if exists production_integrations_status_check;
alter table public.production_integrations add constraint production_integrations_status_check
  check (status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed'));

alter table public.production_integrations drop constraint if exists production_integrations_send_mode_check;
alter table public.production_integrations add constraint production_integrations_send_mode_check
  check (send_mode in ('mock','test','production','disabled','sandbox','live'));

alter table public.production_integrations drop constraint if exists production_integrations_webhook_status_check;
alter table public.production_integrations add constraint production_integrations_webhook_status_check
  check (webhook_status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed'));

alter table public.production_integration_test_logs drop constraint if exists production_test_logs_type_check;
alter table public.production_integration_test_logs add constraint production_test_logs_type_check
  check (integration_type in ('email','whatsapp','sms','push','payment','invoice','supabase','vercel','camera_gateway','ai_provider'));

alter table public.production_webhook_readiness drop constraint if exists production_webhook_type_check;
alter table public.production_webhook_readiness add constraint production_webhook_type_check
  check (integration_type in ('email','whatsapp','sms','push','payment','invoice','camera_gateway','ai_provider'));

create table if not exists public.integration_safety_configuration (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique,
  config_value text not null,
  status text not null default 'active',
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint integration_safety_key_check check (config_key in ('COMMUNICATIONS_SEND_MODE','PAYMENT_MODE','INVOICE_MODE')),
  constraint integration_safety_status_check check (status in ('active','disabled')),
  constraint integration_safety_value_check check (
    (config_key = 'COMMUNICATIONS_SEND_MODE' and config_value in ('mock','test','production')) or
    (config_key = 'PAYMENT_MODE' and config_value in ('disabled','sandbox','live')) or
    (config_key = 'INVOICE_MODE' and config_value in ('disabled','mock','production'))
  )
);

create table if not exists public.provider_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  provider text not null,
  recipient text,
  recipient_hash text,
  template text,
  status text not null default 'queued',
  provider_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint provider_delivery_channel_check check (channel in ('email','whatsapp','sms','push','payment','invoice','supabase','vercel','camera_gateway','ai_provider')),
  constraint provider_delivery_status_check check (status in ('queued','sent','delivered','read','opened','failed','skipped','blocked'))
);

create table if not exists public.provider_integration_health (
  id uuid primary key default gen_random_uuid(),
  integration_type text not null,
  provider text not null,
  status text not null default 'not_configured',
  credentials_configured boolean not null default false,
  provider_reachable boolean,
  webhook_healthy boolean,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  rate_limit_warning boolean not null default false,
  failure_trend text,
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(integration_type, provider),
  constraint provider_integration_health_type_check check (integration_type in ('email','whatsapp','sms','push','payment','invoice','camera_gateway','ai_provider')),
  constraint provider_integration_health_status_check check (status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed'))
);

create table if not exists public.provider_webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_key text not null,
  integration_type text not null,
  provider text not null,
  event_type text,
  idempotency_key text,
  signature_valid boolean,
  replay_detected boolean not null default false,
  status text not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint provider_webhook_events_type_check check (integration_type in ('email','whatsapp','sms','push','payment','invoice','camera_gateway','ai_provider')),
  constraint provider_webhook_events_status_check check (status in ('received','verified','processed','failed','ignored','replayed'))
);

create table if not exists public.integration_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  integration_type text,
  provider text,
  actor_id uuid references public.profiles(id) on delete set null,
  severity text not null default 'info',
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint integration_audit_event_type_check check (event_type in ('provider_configured','provider_disabled','test_send_performed','webhook_received','payment_webhook_received','invoice_generated','provider_failure','integration_mode_changed')),
  constraint integration_audit_severity_check check (severity in ('info','warning','critical'))
);

create table if not exists public.integration_rate_limit_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  channel text not null,
  scope text not null,
  max_attempts integer not null,
  window_minutes integer not null,
  status text not null default 'active',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_rate_channel_check check (channel in ('email','whatsapp','sms','push','payment','invoice')),
  constraint integration_rate_scope_check check (scope in ('otp','invite','password_reset','payment_retry','test_send','webhook')),
  constraint integration_rate_status_check check (status in ('active','disabled'))
);

create index if not exists provider_delivery_logs_channel_status_idx on public.provider_delivery_logs(channel, status, created_at desc);
create index if not exists provider_integration_health_status_idx on public.provider_integration_health(integration_type, status);
create index if not exists provider_webhook_events_key_idx on public.provider_webhook_events(webhook_key, received_at desc);
create index if not exists integration_audit_events_type_idx on public.integration_audit_events(event_type, created_at desc);
create index if not exists integration_rate_limit_rules_channel_idx on public.integration_rate_limit_rules(channel, scope);

alter table public.integration_safety_configuration enable row level security;
alter table public.provider_delivery_logs enable row level security;
alter table public.provider_integration_health enable row level security;
alter table public.provider_webhook_events enable row level security;
alter table public.integration_audit_events enable row level security;
alter table public.integration_rate_limit_rules enable row level security;

drop policy if exists "integration safety admin only" on public.integration_safety_configuration;
create policy "integration safety admin only" on public.integration_safety_configuration for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "provider delivery logs admin only" on public.provider_delivery_logs;
create policy "provider delivery logs admin only" on public.provider_delivery_logs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "provider integration health admin only" on public.provider_integration_health;
create policy "provider integration health admin only" on public.provider_integration_health for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "provider webhook events admin only" on public.provider_webhook_events;
create policy "provider webhook events admin only" on public.provider_webhook_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "integration audit events admin only" on public.integration_audit_events;
create policy "integration audit events admin only" on public.integration_audit_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "integration rate limits admin only" on public.integration_rate_limit_rules;
create policy "integration rate limits admin only" on public.integration_rate_limit_rules for all using (public.is_admin()) with check (public.is_admin());

insert into public.integration_safety_configuration (config_key, config_value, description, metadata)
values
  ('COMMUNICATIONS_SEND_MODE','mock','Default communication mode. Broad real sends require explicit production env and admin approval.', '{"safe_default":true}'::jsonb),
  ('PAYMENT_MODE','disabled','Default payment mode. Live payments require explicit provider onboarding and env flags.', '{"safe_default":true,"revenue_streams_separated":true}'::jsonb),
  ('INVOICE_MODE','mock','Default invoice mode. Production invoice issuing requires explicit provider onboarding.', '{"safe_default":true}'::jsonb)
on conflict (config_key) do update set
  description = excluded.description,
  metadata = integration_safety_configuration.metadata || excluded.metadata,
  updated_at = now();

insert into public.production_integrations (integration_type, provider, status, environment, send_mode, missing_configuration, webhook_status, notes, metadata)
values
  ('payment','tranzila','not_configured','production','disabled','["PAYMENT_PROVIDER","TRANZILA_TERMINAL","PAYMENT_WEBHOOK_SECRET"]'::jsonb,'not_configured','Tranzila payment readiness. No raw card storage; provider tokenization only.', '{"stream_a":"gan_batuach_subscription","stream_b":"parent_to_kindergarten_routing","raw_card_storage":false}'::jsonb),
  ('payment','meshulam','not_configured','production','disabled','["PAYMENT_PROVIDER","MESHULAM_API_KEY","PAYMENT_WEBHOOK_SECRET"]'::jsonb,'not_configured','Meshulam payment readiness. Parent tuition routes to kindergarten account.', '{"stream_a":"gan_batuach_subscription","stream_b":"parent_to_kindergarten_routing","raw_card_storage":false}'::jsonb),
  ('payment','cardcom','not_configured','production','disabled','["PAYMENT_PROVIDER","CARDCOM_TERMINAL","PAYMENT_WEBHOOK_SECRET"]'::jsonb,'not_configured','Cardcom payment readiness. Provider tokenization only.', '{"stream_a":"gan_batuach_subscription","stream_b":"parent_to_kindergarten_routing","raw_card_storage":false}'::jsonb),
  ('payment','pelecard','not_configured','production','disabled','["PAYMENT_PROVIDER","PELECARD_TERMINAL","PAYMENT_WEBHOOK_SECRET"]'::jsonb,'not_configured','Pelecard payment readiness. Provider tokenization only.', '{"stream_a":"gan_batuach_subscription","stream_b":"parent_to_kindergarten_routing","raw_card_storage":false}'::jsonb),
  ('payment','stripe_future','disabled','production','disabled','["PAYMENT_PROVIDER","PAYMENT_WEBHOOK_SECRET"]'::jsonb,'disabled','Future Stripe readiness only.', '{"future_provider":true,"raw_card_storage":false}'::jsonb),
  ('invoice','green_invoice','not_configured','production','mock','["INVOICE_PROVIDER","INVOICE_API_KEY"]'::jsonb,'not_configured','Green Invoice / חשבונית ירוקה readiness.', '{"pdf_generation":true,"email_delivery":true,"archive_required":true}'::jsonb),
  ('invoice','icount','not_configured','production','mock','["INVOICE_PROVIDER","INVOICE_API_KEY"]'::jsonb,'not_configured','iCount invoice provider readiness.', '{"pdf_generation":true,"email_delivery":true,"archive_required":true}'::jsonb),
  ('invoice','morning','not_configured','production','mock','["INVOICE_PROVIDER","INVOICE_API_KEY"]'::jsonb,'not_configured','Morning / חשבונית אונליין readiness.', '{"pdf_generation":true,"email_delivery":true,"archive_required":true}'::jsonb),
  ('invoice','provider_neutral','test_mode','production','mock','[]'::jsonb,'not_configured','Provider-neutral invoice mock adapter.', '{"mock_only":true,"secrets_required":false}'::jsonb)
on conflict (integration_type, provider, environment) do update set
  send_mode = excluded.send_mode,
  missing_configuration = excluded.missing_configuration,
  webhook_status = excluded.webhook_status,
  notes = excluded.notes,
  metadata = production_integrations.metadata || excluded.metadata,
  updated_at = now();

insert into public.production_webhook_readiness (webhook_key, integration_type, provider, endpoint_path, status, signing_secret_env, notes, metadata)
values
  ('payment-provider-events','payment','any','/api/webhooks/payments/provider','not_configured','PAYMENT_WEBHOOK_SECRET','Payment success/failure webhook readiness with idempotency.', '{"signature_required":true,"idempotency_required":true,"replay_protection_required":true}'::jsonb),
  ('invoice-provider-events','invoice','any','/api/webhooks/invoices/provider','not_configured','INVOICE_WEBHOOK_SECRET','Invoice issued/cancelled webhook readiness.', '{"signature_required":true,"idempotency_required":true}'::jsonb),
  ('camera-gateway-health','camera_gateway','any','/api/webhooks/camera-gateway/health','not_configured','VIDEO_GATEWAY_SIGNING_SECRET','Camera gateway health webhook readiness.', '{"signature_required":true}'::jsonb),
  ('ai-provider-events','ai_provider','any','/api/webhooks/ai-provider/events','not_configured','AI_PROVIDER_WEBHOOK_SECRET','AI provider callback readiness; no raw child PII allowed.', '{"signature_required":true,"raw_pii_allowed":false}'::jsonb)
on conflict (webhook_key) do update set
  integration_type = excluded.integration_type,
  provider = excluded.provider,
  endpoint_path = excluded.endpoint_path,
  signing_secret_env = excluded.signing_secret_env,
  notes = excluded.notes,
  metadata = production_webhook_readiness.metadata || excluded.metadata,
  updated_at = now();

insert into public.provider_integration_health (integration_type, provider, status, credentials_configured, webhook_healthy, next_action, metadata)
select integration_type, provider, status, false, false,
  case
    when integration_type = 'payment' then 'Configure sandbox provider credentials and webhook signature before payment testing.'
    when integration_type = 'invoice' then 'Configure invoice provider API key and issue a mock invoice test.'
    when integration_type in ('email','whatsapp','sms','push') then 'Run approved-recipient test before production readiness.'
    else 'Validate provider health endpoint and server-only credentials.'
  end,
  jsonb_build_object('source','phase_163_seed')
from public.production_integrations
where integration_type in ('email','whatsapp','sms','push','payment','invoice','camera_gateway','ai_provider')
on conflict (integration_type, provider) do update set
  status = excluded.status,
  next_action = excluded.next_action,
  metadata = provider_integration_health.metadata || excluded.metadata,
  updated_at = now();

insert into public.integration_rate_limit_rules (rule_key, channel, scope, max_attempts, window_minutes, notes, metadata)
values
  ('sms-otp-5-per-15','sms','otp',5,15,'OTP abuse prevention readiness.', '{}'::jsonb),
  ('whatsapp-invite-3-per-day','whatsapp','invite',3,1440,'Prevent repeated invite abuse.', '{}'::jsonb),
  ('email-password-reset-5-per-hour','email','password_reset',5,60,'Password reset rate limit readiness.', '{}'::jsonb),
  ('payment-retry-3-per-day','payment','payment_retry',3,1440,'Failed payment retry notification rate limit readiness.', '{}'::jsonb),
  ('integration-test-20-per-hour','email','test_send',20,60,'Admin test send rate limit readiness.', '{"applies_to_all_channels":true}'::jsonb)
on conflict (rule_key) do update set
  max_attempts = excluded.max_attempts,
  window_minutes = excluded.window_minutes,
  notes = excluded.notes,
  metadata = integration_rate_limit_rules.metadata || excluded.metadata,
  updated_at = now();

insert into public.integration_audit_events (event_type, integration_type, provider, severity, description, metadata)
select 'integration_mode_changed', null, null, 'info', 'Phase 163 integration safety defaults registered: communications mock, payments disabled, invoices mock.', '{"phase":163,"safe_default":true}'::jsonb
where not exists (
  select 1
  from public.integration_audit_events
  where event_type = 'integration_mode_changed'
    and description = 'Phase 163 integration safety defaults registered: communications mock, payments disabled, invoices mock.'
);

notify pgrst, 'reload schema';
