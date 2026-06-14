-- PHASE 187: Provider Production Activation Final
-- Controlled production activation readiness. No secrets, no broad sends, no live charges by default.

alter table public.production_integrations drop constraint if exists production_integrations_status_check;
alter table public.production_integrations add constraint production_integrations_status_check
  check (status in ('not_configured','configured','test_mode','production_pending','production_ready','production_active','active','degraded','failed','disabled'));

alter table public.production_integrations drop constraint if exists production_integrations_webhook_status_check;
alter table public.production_integrations add constraint production_integrations_webhook_status_check
  check (webhook_status in ('not_configured','configured','test_mode','production_pending','production_ready','production_active','active','degraded','failed','disabled'));

alter table public.provider_integration_health drop constraint if exists provider_integration_health_status_check;
alter table public.provider_integration_health add constraint provider_integration_health_status_check
  check (status in ('not_configured','configured','test_mode','production_pending','production_ready','production_active','active','degraded','failed','disabled'));

alter table public.provider_delivery_logs
  add column if not exists read_at timestamptz,
  add column if not exists opened_at timestamptz;

alter table public.provider_delivery_logs drop constraint if exists provider_delivery_status_check;
alter table public.provider_delivery_logs add constraint provider_delivery_status_check
  check (status in ('queued','sent','delivered','read','opened','failed','skipped','blocked','retried'));

alter table public.integration_safety_configuration drop constraint if exists integration_safety_key_check;
alter table public.integration_safety_configuration add constraint integration_safety_key_check
  check (config_key in ('COMMUNICATIONS_SEND_MODE','PAYMENT_MODE','INVOICE_MODE','PUSH_MODE','CAMERA_GATEWAY_MODE','AI_PROVIDER_MODE'));

alter table public.integration_safety_configuration drop constraint if exists integration_safety_value_check;
alter table public.integration_safety_configuration add constraint integration_safety_value_check check (
  (config_key = 'COMMUNICATIONS_SEND_MODE' and config_value in ('mock','test','production')) or
  (config_key = 'PAYMENT_MODE' and config_value in ('disabled','sandbox','live')) or
  (config_key = 'INVOICE_MODE' and config_value in ('disabled','mock','production')) or
  (config_key = 'PUSH_MODE' and config_value in ('disabled','test','production')) or
  (config_key = 'CAMERA_GATEWAY_MODE' and config_value in ('disabled','test','production')) or
  (config_key = 'AI_PROVIDER_MODE' and config_value in ('mock','shadow','production'))
);

alter table public.integration_audit_events drop constraint if exists integration_audit_event_type_check;
alter table public.integration_audit_events add constraint integration_audit_event_type_check
  check (event_type in ('provider_configured','provider_activated','provider_disabled','mode_changed','test_sent','test_send_performed','webhook_received','payment_webhook_received','payment_webhook_processed','invoice_generated','provider_failure','fallback_triggered','rollback_executed','integration_mode_changed'));

create table if not exists public.provider_production_checklists (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  integration_type text not null,
  provider text not null,
  provider_selected boolean not null default false,
  required_env_vars jsonb not null default '[]'::jsonb,
  required_env_configured boolean not null default false,
  secrets_server_side_only boolean not null default true,
  webhook_secret_configured boolean not null default false,
  test_completed boolean not null default false,
  production_send_approved boolean not null default false,
  audit_logging_enabled boolean not null default true,
  rollback_option_exists boolean not null default true,
  owner_approved boolean not null default false,
  activation_status text not null default 'not_configured' check (activation_status in ('not_configured','configured','test_mode','production_pending','production_active','degraded','failed','disabled')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_production_costs (
  id uuid primary key default gen_random_uuid(),
  cost_key text not null unique,
  product text not null default 'gan_batuach' check (product in ('gan_batuach','digital_observer','shared')),
  garden_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  channel text not null check (channel in ('email','sms','whatsapp','push','payment','invoice','camera_gateway','ai_provider')),
  provider text not null,
  cost_month date not null default date_trunc('month', current_date)::date,
  unit_count integer not null default 0,
  estimated_cost_nis numeric(12,2) not null default 0,
  actual_cost_nis numeric(12,2) not null default 0,
  status text not null default 'estimated' check (status in ('estimated','reported','reconciled','needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_production_health_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null unique,
  integration_type text not null,
  provider text not null,
  last_successful_request_at timestamptz,
  last_failed_request_at timestamptz,
  error_rate_percent numeric(6,2) not null default 0,
  latency_ms integer,
  webhook_status text not null default 'not_configured',
  rate_limit_warning boolean not null default false,
  provider_status text not null default 'not_configured' check (provider_status in ('not_configured','configured','test_mode','production_pending','production_active','degraded','failed','disabled')),
  credentials_missing boolean not null default true,
  production_mode_enabled boolean not null default false,
  delivery_rate_percent numeric(6,2) not null default 0,
  rollback_status text not null default 'available' check (rollback_status in ('available','tested','not_ready','executed')),
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_production_incident_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  integration_type text not null,
  provider text not null,
  alert_type text not null check (alert_type in ('email_provider_down','whatsapp_provider_failed','sms_provider_failed','push_provider_failed','payment_provider_failed','invoice_provider_failed','camera_gateway_degraded','ai_provider_degraded','webhook_failures','high_delivery_failure_rate','rate_limit_reached')),
  severity text not null default 'medium' check (severity in ('low','medium','high','critical')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved','suppressed')),
  message text not null,
  fallback_action text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_fallback_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  trigger_channel text not null,
  trigger_condition text not null,
  fallback_action text not null,
  allowed_fallback_channels jsonb not null default '[]'::jsonb,
  requires_user_preference boolean not null default true,
  requires_admin_approval boolean not null default false,
  status text not null default 'active' check (status in ('active','disabled','needs_review')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_rollback_controls (
  id uuid primary key default gen_random_uuid(),
  rollback_key text not null unique,
  integration_type text not null,
  provider text not null,
  current_mode text not null default 'mock',
  rollback_mode text not null,
  preserves_logs boolean not null default true,
  preserves_invoices boolean not null default true,
  preserves_payment_records boolean not null default true,
  preserves_delivery_records boolean not null default true,
  preserves_customer_state boolean not null default true,
  rollback_status text not null default 'ready' check (rollback_status in ('ready','needs_review','executed','blocked')),
  executed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_production_runbooks (
  id uuid primary key default gen_random_uuid(),
  runbook_key text not null unique,
  incident_type text not null check (incident_type in ('email_provider_failure','whatsapp_provider_failure','sms_provider_failure','push_provider_failure','payment_provider_failure','invoice_provider_failure','camera_gateway_failure','ai_provider_failure','webhook_failure','accidental_mass_send_prevention','duplicate_payment_prevention')),
  title text not null,
  first_response_steps jsonb not null default '[]'::jsonb,
  escalation_owner text,
  rollback_reference text,
  status text not null default 'ready_for_review' check (status in ('draft','ready_for_review','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_production_test_center (
  id uuid primary key default gen_random_uuid(),
  test_key text not null unique,
  integration_type text not null,
  provider text not null,
  test_type text not null check (test_type in ('email','whatsapp','sms','push','payment_sandbox','payment_live_minimal','invoice','camera_gateway','ai_endpoint')),
  approved_internal_recipient_required boolean not null default true,
  admin_confirmation_required boolean not null default true,
  last_test_status text not null default 'not_tested' check (last_test_status in ('not_tested','passed','failed','blocked','skipped')),
  last_test_at timestamptz,
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_production_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  activation_readiness_score integer not null default 0 check (activation_readiness_score between 0 and 100),
  communications_score integer not null default 0 check (communications_score between 0 and 100),
  payments_score integer not null default 0 check (payments_score between 0 and 100),
  invoices_score integer not null default 0 check (invoices_score between 0 and 100),
  camera_gateway_score integer not null default 0 check (camera_gateway_score between 0 and 100),
  ai_provider_score integer not null default 0 check (ai_provider_score between 0 and 100),
  webhook_score integer not null default 0 check (webhook_score between 0 and 100),
  rollback_score integer not null default 0 check (rollback_score between 0 and 100),
  production_activation_status text not null default 'production_pending',
  blockers jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'provider_production_checklists',
    'provider_production_costs',
    'provider_production_health_metrics',
    'provider_production_incident_alerts',
    'provider_fallback_rules',
    'provider_rollback_controls',
    'provider_production_runbooks',
    'provider_production_test_center',
    'provider_production_readiness_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%I admin manage" on public.%I', table_name, table_name);
    execute format('create policy "%I admin manage" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists idx_provider_prod_checklists_status on public.provider_production_checklists(integration_type, activation_status);
create index if not exists idx_provider_prod_costs_month on public.provider_production_costs(cost_month desc, product, channel);
create index if not exists idx_provider_prod_health_status on public.provider_production_health_metrics(integration_type, provider_status);
create index if not exists idx_provider_prod_alerts_status on public.provider_production_incident_alerts(status, severity);
create index if not exists idx_provider_fallback_rules_channel on public.provider_fallback_rules(trigger_channel, status);
create index if not exists idx_provider_rollback_controls_status on public.provider_rollback_controls(integration_type, rollback_status);
create index if not exists idx_provider_runbooks_type on public.provider_production_runbooks(incident_type, status);
create index if not exists idx_provider_test_center_status on public.provider_production_test_center(integration_type, last_test_status);
create index if not exists idx_provider_readiness_calculated on public.provider_production_readiness_scores(calculated_at desc);

insert into public.integration_safety_configuration (config_key, config_value, description, metadata)
values
  ('PUSH_MODE','disabled','Default push mode. Production push requires FCM/APNs/Web Push setup and approved categories.', '{"safe_default":true}'::jsonb),
  ('CAMERA_GATEWAY_MODE','disabled','Default camera gateway mode. Production gateway requires health, token and audit validation.', '{"safe_default":true,"rtsp_exposed":false}'::jsonb),
  ('AI_PROVIDER_MODE','mock','Default AI provider mode. Gan Batuach starts mock/shadow with human review.', '{"safe_default":true,"human_review_required":true}'::jsonb)
on conflict (config_key) do update set
  description = excluded.description,
  metadata = integration_safety_configuration.metadata || excluded.metadata,
  updated_at = now();

insert into public.provider_production_checklists (
  checklist_key, integration_type, provider, provider_selected, required_env_vars, activation_status, notes, metadata
) values
  ('prod-email-resend', 'email', 'resend', true, '["EMAIL_PROVIDER","RESEND_API_KEY","EMAIL_FROM_ADDRESS","RESEND_WEBHOOK_SECRET"]'::jsonb, 'test_mode', 'Email production requires verified sender/domain, SPF/DKIM/DMARC readiness and bounce handling.', '{"use_cases":["manager credentials","staff invitation","parent invitation","password reset","MFA alerts","invoices","inspection reminders"]}'::jsonb),
  ('prod-email-sendgrid', 'email', 'sendgrid', true, '["EMAIL_PROVIDER","SENDGRID_API_KEY","EMAIL_FROM_ADDRESS","SENDGRID_WEBHOOK_SECRET"]'::jsonb, 'test_mode', 'SendGrid readiness with webhook and verified sender.', '{}'::jsonb),
  ('prod-whatsapp-meta', 'whatsapp', 'meta_cloud_api', true, '["WHATSAPP_PROVIDER","META_WHATSAPP_TOKEN","META_WHATSAPP_PHONE_NUMBER_ID","META_WHATSAPP_BUSINESS_ACCOUNT_ID","WHATSAPP_WEBHOOK_VERIFY_TOKEN"]'::jsonb, 'test_mode', 'WhatsApp production requires approved templates and opt-in readiness.', '{"bulk_free_text_blocked":true}'::jsonb),
  ('prod-whatsapp-twilio', 'whatsapp', 'twilio_whatsapp', true, '["TWILIO_WHATSAPP_SID","TWILIO_WHATSAPP_TOKEN","TWILIO_WHATSAPP_FROM"]'::jsonb, 'test_mode', 'Twilio WhatsApp readiness with approved templates.', '{}'::jsonb),
  ('prod-sms-twilio', 'sms', 'twilio', true, '["SMS_PROVIDER","TWILIO_ACCOUNT_SID","TWILIO_AUTH_TOKEN","SMS_SENDER_ID"]'::jsonb, 'test_mode', 'SMS production requires sender ID, rate limit and cost tracking.', '{}'::jsonb),
  ('prod-push-fcm-apns-web', 'push', 'fcm_apns_webpush', true, '["PUSH_MODE","FCM_PROJECT_ID","FCM_SERVER_KEY","APNS_KEY_ID","VAPID_PUBLIC_KEY"]'::jsonb, 'test_mode', 'Push readiness requires token registration, cleanup, categories, deep links and preferences.', '{}'::jsonb),
  ('prod-payment-provider', 'payment', 'provider_selected', false, '["PAYMENT_PROVIDER","PAYMENT_MODE","PAYMENT_WEBHOOK_SECRET"]'::jsonb, 'not_configured', 'Live payment mode requires explicit configuration and provider tokenization only.', '{"raw_card_data":false,"streams":["gan_batuach_subscription","parent_to_kindergarten","digital_observer"]}'::jsonb),
  ('prod-invoice-provider', 'invoice', 'provider_selected', false, '["INVOICE_PROVIDER","INVOICE_MODE","INVOICE_API_KEY","INVOICE_WEBHOOK_SECRET"]'::jsonb, 'not_configured', 'Invoice provider must keep Gan Batuach, parent tuition and Digital Observer streams separate.', '{}'::jsonb),
  ('prod-camera-gateway', 'camera_gateway', 'mediamtx_go2rtc_custom', true, '["CAMERA_GATEWAY_MODE","VIDEO_GATEWAY_URL","VIDEO_GATEWAY_API_KEY","VIDEO_GATEWAY_SIGNING_SECRET"]'::jsonb, 'test_mode', 'Gateway production requires no RTSP exposure, short-lived playback tokens and audit logs.', '{"audio_disabled_gan_batuach":true,"face_recognition_disabled_gan_batuach":true}'::jsonb),
  ('prod-ai-provider', 'ai_provider', 'local_or_external_model', true, '["AI_PROVIDER_MODE","LOCAL_VISION_ENDPOINT","CUSTOM_VISION_ENDPOINT","AI_PROVIDER_WEBHOOK_SECRET"]'::jsonb, 'test_mode', 'AI production must start shadow/human-review for Gan Batuach.', '{"no_auto_accusations":true,"no_parent_raw_ai":true}'::jsonb)
on conflict (checklist_key) do update set
  required_env_vars = excluded.required_env_vars,
  notes = excluded.notes,
  metadata = provider_production_checklists.metadata || excluded.metadata,
  updated_at = now();

insert into public.provider_fallback_rules (
  rule_key, trigger_channel, trigger_condition, fallback_action, allowed_fallback_channels, requires_user_preference, requires_admin_approval, notes
) values
  ('fallback-email-retry', 'email', 'email_failed', 'queue_retry', '["in_app"]'::jsonb, false, false, 'Email failure retries should not duplicate messages.'),
  ('fallback-whatsapp-sms-email', 'whatsapp', 'whatsapp_failed', 'fallback_sms_or_email_if_allowed', '["sms","email","in_app"]'::jsonb, true, false, 'Respect opt-in and channel preferences.'),
  ('fallback-sms-email-inapp', 'sms', 'sms_failed', 'fallback_email_or_in_app', '["email","in_app"]'::jsonb, true, false, 'Urgent fallback only when category allows it.'),
  ('fallback-push-inapp', 'push', 'push_failed', 'keep_in_app_notification', '["in_app"]'::jsonb, false, false, 'In-app remains source of truth.'),
  ('fallback-payment-retry-later', 'payment', 'payment_provider_failed', 'show_retry_later_no_duplicate_charge', '[]'::jsonb, false, true, 'Never duplicate charge. Use idempotency keys.'),
  ('fallback-invoice-pending', 'invoice', 'invoice_provider_failed', 'mark_invoice_pending_retry_alert_admin', '[]'::jsonb, false, true, 'Retry invoice generation and alert admin.'),
  ('fallback-ai-manual-review', 'ai_provider', 'ai_provider_failed', 'manual_review_mode', '[]'::jsonb, false, false, 'AI failure falls back to human review.'),
  ('fallback-camera-unavailable', 'camera_gateway', 'gateway_failed', 'camera_unavailable_message', '[]'::jsonb, false, false, 'Show safe unavailable message and keep audit record.')
on conflict (rule_key) do update set
  fallback_action = excluded.fallback_action,
  updated_at = now();

insert into public.provider_rollback_controls (
  rollback_key, integration_type, provider, current_mode, rollback_mode, rollback_status, notes
) values
  ('rollback-communications', 'email', 'all_communications', 'production', 'mock', 'ready', 'Can switch COMMUNICATIONS_SEND_MODE back to mock/test.'),
  ('rollback-payments', 'payment', 'selected_provider', 'live', 'sandbox', 'ready', 'Can switch PAYMENT_MODE back to sandbox/disabled while preserving payment records.'),
  ('rollback-invoices', 'invoice', 'selected_provider', 'production', 'mock', 'ready', 'Can switch INVOICE_MODE back to mock while preserving invoice records.'),
  ('rollback-push', 'push', 'all_push', 'production', 'disabled', 'ready', 'Can disable production push without deleting device tokens.'),
  ('rollback-camera-gateway', 'camera_gateway', 'selected_gateway', 'production', 'test', 'ready', 'Can disable custom domain/gateway production mode while preserving camera records.'),
  ('rollback-ai-provider', 'ai_provider', 'selected_model', 'production', 'shadow', 'ready', 'Can switch AI provider to shadow/mock with review queue preserved.')
on conflict (rollback_key) do update set
  rollback_mode = excluded.rollback_mode,
  updated_at = now();

insert into public.provider_production_runbooks (
  runbook_key, incident_type, title, first_response_steps, escalation_owner, rollback_reference, status
) values
  ('runbook-email-failure', 'email_provider_failure', 'Email provider failure', '["Pause non-critical email sends","Check provider dashboard","Queue retry","Use in-app fallback","Update provider health"]'::jsonb, 'Communications Owner', 'rollback-communications', 'ready_for_review'),
  ('runbook-whatsapp-failure', 'whatsapp_provider_failure', 'WhatsApp provider failure', '["Pause WhatsApp sends","Check template/provider status","Fallback SMS/email if allowed","Review rate limits"]'::jsonb, 'Communications Owner', 'rollback-communications', 'ready_for_review'),
  ('runbook-sms-failure', 'sms_provider_failure', 'SMS provider failure', '["Pause SMS sends","Check provider status","Fallback email/in-app","Review OTP rate limits"]'::jsonb, 'Communications Owner', 'rollback-communications', 'ready_for_review'),
  ('runbook-push-failure', 'push_provider_failure', 'Push provider failure', '["Disable production push","Clean failed tokens","Keep in-app notifications","Review APNs/FCM credentials"]'::jsonb, 'Mobile Owner', 'rollback-push', 'ready_for_review'),
  ('runbook-payment-failure', 'payment_provider_failure', 'Payment provider failure', '["Disable live charges","Verify webhook idempotency","Prevent duplicate charges","Show retry later","Reconcile provider dashboard"]'::jsonb, 'Finance Owner', 'rollback-payments', 'ready_for_review'),
  ('runbook-invoice-failure', 'invoice_provider_failure', 'Invoice provider failure', '["Mark invoices pending","Queue retry","Alert admin","Do not mix invoice streams"]'::jsonb, 'Finance Owner', 'rollback-invoices', 'ready_for_review'),
  ('runbook-camera-gateway-failure', 'camera_gateway_failure', 'Camera gateway failure', '["Mark cameras unavailable","Do not expose RTSP","Audit viewer sessions","Check gateway health","Retry registration"]'::jsonb, 'Camera Owner', 'rollback-camera-gateway', 'ready_for_review'),
  ('runbook-ai-provider-failure', 'ai_provider_failure', 'AI provider failure', '["Switch to manual review","Keep shadow mode","Do not notify parents automatically","Check model endpoint"]'::jsonb, 'AI Governance Owner', 'rollback-ai-provider', 'ready_for_review'),
  ('runbook-webhook-failure', 'webhook_failure', 'Webhook failure', '["Verify signature secret","Check replay/idempotency","Queue retry","Dead-letter failed events"]'::jsonb, 'Platform Owner', null, 'ready_for_review'),
  ('runbook-mass-send-prevention', 'accidental_mass_send_prevention', 'Accidental mass-send prevention', '["Disable production mode","Stop queued broadcast","Audit recipients","Notify admin owner","Preserve logs"]'::jsonb, 'Communications Owner', 'rollback-communications', 'ready_for_review'),
  ('runbook-duplicate-payment', 'duplicate_payment_prevention', 'Duplicate payment prevention', '["Use idempotency keys","Pause retries","Reconcile provider events","Refund only after finance review"]'::jsonb, 'Finance Owner', 'rollback-payments', 'ready_for_review')
on conflict (runbook_key) do update set
  first_response_steps = excluded.first_response_steps,
  updated_at = now();

insert into public.provider_production_test_center (
  test_key, integration_type, provider, test_type, next_action
) values
  ('test-email-production', 'email', 'selected_provider', 'email', 'Send only to approved internal recipient.'),
  ('test-whatsapp-production', 'whatsapp', 'selected_provider', 'whatsapp', 'Use approved template and approved internal recipient only.'),
  ('test-sms-production', 'sms', 'selected_provider', 'sms', 'Use approved internal recipient and rate limit.'),
  ('test-push-production', 'push', 'selected_provider', 'push', 'Use admin test device token only.'),
  ('test-payment-sandbox', 'payment', 'selected_provider', 'payment_sandbox', 'Sandbox only unless PAYMENT_MODE=live and finance approves minimal live test.'),
  ('test-invoice-provider', 'invoice', 'selected_provider', 'invoice', 'Generate test/mock invoice and verify archive/log.'),
  ('test-camera-gateway', 'camera_gateway', 'selected_gateway', 'camera_gateway', 'Check health, source registration and playback token without exposing RTSP.'),
  ('test-ai-endpoint', 'ai_provider', 'selected_model', 'ai_endpoint', 'Run shadow test and verify review queue only.')
on conflict (test_key) do update set
  next_action = excluded.next_action,
  updated_at = now();

insert into public.provider_production_health_metrics (
  metric_key, integration_type, provider, provider_status, webhook_status, credentials_missing, production_mode_enabled, delivery_rate_percent, rollback_status, next_action
) values
  ('health-email-selected', 'email', 'selected_provider', 'test_mode', 'not_configured', true, false, 0, 'available', 'Configure verified domain, sender, webhook and approved test.'),
  ('health-whatsapp-selected', 'whatsapp', 'selected_provider', 'test_mode', 'not_configured', true, false, 0, 'available', 'Configure approved templates, opt-in readiness and delivery webhook.'),
  ('health-sms-selected', 'sms', 'selected_provider', 'test_mode', 'not_configured', true, false, 0, 'available', 'Configure sender ID, rate limits and cost tracking.'),
  ('health-push-selected', 'push', 'selected_provider', 'test_mode', 'not_configured', true, false, 0, 'available', 'Configure FCM/APNs/Web Push and token cleanup.'),
  ('health-payment-selected', 'payment', 'selected_provider', 'not_configured', 'not_configured', true, false, 0, 'available', 'Configure sandbox first. Live requires explicit PAYMENT_MODE=live.'),
  ('health-invoice-selected', 'invoice', 'selected_provider', 'not_configured', 'not_configured', true, false, 0, 'available', 'Configure provider and test invoice stream separation.'),
  ('health-camera-gateway-selected', 'camera_gateway', 'selected_gateway', 'test_mode', 'not_configured', true, false, 0, 'available', 'Validate gateway health, token playback and audit logs.'),
  ('health-ai-provider-selected', 'ai_provider', 'selected_model', 'test_mode', 'not_configured', true, false, 0, 'available', 'Keep Gan Batuach in shadow/human-review mode.')
on conflict (metric_key) do update set
  next_action = excluded.next_action,
  updated_at = now();

insert into public.provider_production_incident_alerts (
  alert_key, integration_type, provider, alert_type, severity, message, fallback_action, owner
) values
  ('incident-email-down', 'email', 'selected_provider', 'email_provider_down', 'high', 'Email provider down or delivery failure rate high.', 'Queue retry and use in-app fallback.', 'Communications Owner'),
  ('incident-whatsapp-failed', 'whatsapp', 'selected_provider', 'whatsapp_provider_failed', 'high', 'WhatsApp provider failed or templates rejected.', 'Fallback SMS/email if allowed.', 'Communications Owner'),
  ('incident-sms-failed', 'sms', 'selected_provider', 'sms_provider_failed', 'high', 'SMS provider failed or rate limited.', 'Fallback email/in-app.', 'Communications Owner'),
  ('incident-payment-failed', 'payment', 'selected_provider', 'payment_provider_failed', 'critical', 'Payment provider failed.', 'Disable live retry, prevent duplicate charge.', 'Finance Owner'),
  ('incident-camera-degraded', 'camera_gateway', 'selected_gateway', 'camera_gateway_degraded', 'high', 'Camera gateway degraded.', 'Show unavailable message and audit sessions.', 'Camera Owner'),
  ('incident-ai-degraded', 'ai_provider', 'selected_model', 'ai_provider_degraded', 'medium', 'AI provider degraded.', 'Manual review mode.', 'AI Governance Owner')
on conflict (alert_key) do update set
  fallback_action = excluded.fallback_action,
  updated_at = now();

insert into public.provider_production_costs (
  cost_key, product, channel, provider, unit_count, estimated_cost_nis, status, metadata
) values
  ('cost-email-monthly-baseline', 'shared', 'email', 'selected_provider', 0, 0, 'estimated', '{"cost_basis":"messages"}'::jsonb),
  ('cost-sms-monthly-baseline', 'shared', 'sms', 'selected_provider', 0, 0, 'estimated', '{"cost_basis":"messages"}'::jsonb),
  ('cost-whatsapp-monthly-baseline', 'shared', 'whatsapp', 'selected_provider', 0, 0, 'estimated', '{"cost_basis":"conversations_or_templates"}'::jsonb),
  ('cost-payment-monthly-baseline', 'gan_batuach', 'payment', 'selected_provider', 0, 0, 'estimated', '{"streams_separated":true}'::jsonb),
  ('cost-invoice-monthly-baseline', 'shared', 'invoice', 'selected_provider', 0, 0, 'estimated', '{"invoice_streams_separated":true}'::jsonb),
  ('cost-camera-gateway-monthly-baseline', 'shared', 'camera_gateway', 'selected_gateway', 0, 0, 'estimated', '{"bandwidth_and_gateway_cost":true}'::jsonb),
  ('cost-ai-provider-monthly-baseline', 'shared', 'ai_provider', 'selected_model', 0, 0, 'estimated', '{"shadow_mode_first":true}'::jsonb)
on conflict (cost_key) do update set
  metadata = provider_production_costs.metadata || excluded.metadata,
  updated_at = now();

insert into public.provider_production_readiness_scores (
  snapshot_key, activation_readiness_score, communications_score, payments_score, invoices_score, camera_gateway_score, ai_provider_score, webhook_score, rollback_score, production_activation_status, blockers
) values (
  'provider-production-baseline',
  57,
  62,
  48,
  50,
  58,
  54,
  46,
  76,
  'production_pending',
  '["production env secrets not configured","live payment not approved","invoice provider not selected","webhook signature verification pending","approved-recipient test required"]'::jsonb
) on conflict (snapshot_key) do update set
  activation_readiness_score = excluded.activation_readiness_score,
  blockers = excluded.blockers,
  calculated_at = now();

insert into public.integration_audit_events (event_type, integration_type, provider, severity, description, metadata)
select 'mode_changed', null, null, 'info', 'Phase 187 provider production activation final readiness registered. Safe defaults remain active.', '{"phase":187,"safe_default":true}'::jsonb
where not exists (
  select 1 from public.integration_audit_events
  where event_type = 'mode_changed'
    and description = 'Phase 187 provider production activation final readiness registered. Safe defaults remain active.'
);

comment on table public.provider_production_checklists is 'Final provider production activation checklist per provider. Production active requires explicit env and owner approval.';
comment on table public.provider_production_costs is 'Provider cost tracking by product, garden, observer site, channel and month.';
comment on table public.provider_rollback_controls is 'Safe rollback controls preserving logs, invoices, payment records, delivery records and customer state.';
comment on table public.provider_production_runbooks is 'Production runbooks for provider failures, webhook failures, mass-send prevention and duplicate payment prevention.';
