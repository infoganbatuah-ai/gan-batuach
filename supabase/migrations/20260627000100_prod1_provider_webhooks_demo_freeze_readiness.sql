-- PROD 1: provider webhook idempotency and demo/freeze readiness.
-- Safe to rerun. Does not activate live providers.

alter type public.kindergarten_subscription_status add value if not exists 'pending_admin_approval';
alter type public.kindergarten_subscription_status add value if not exists 'approved_pending_onboarding';
alter type public.kindergarten_subscription_status add value if not exists 'approved_pending_subscription';
alter type public.kindergarten_subscription_status add value if not exists 'demo_active';
alter type public.kindergarten_subscription_status add value if not exists 'payment_failed';
alter type public.kindergarten_subscription_status add value if not exists 'frozen';

alter table public.provider_webhook_events
  add column if not exists event_id text,
  add column if not exists related_entity_type text,
  add column if not exists related_entity_id uuid,
  add column if not exists raw_payload_reference text;

update public.provider_webhook_events
set event_id = coalesce(event_id, idempotency_key)
where event_id is null and idempotency_key is not null;

create unique index if not exists provider_webhook_events_idempotency_unique_idx
on public.provider_webhook_events(webhook_key, idempotency_key)
where idempotency_key is not null;

create index if not exists provider_webhook_events_event_idx
on public.provider_webhook_events(integration_type, provider, event_id)
where event_id is not null;

create index if not exists provider_webhook_events_related_entity_idx
on public.provider_webhook_events(related_entity_type, related_entity_id)
where related_entity_id is not null;

create index if not exists kindergarten_subscriptions_demo_expiration_idx
on public.kindergarten_subscriptions((status::text), trial_ends_at)
where status::text in ('demo_active', 'trial') and admin_override = false;

insert into public.production_webhook_readiness (webhook_key, integration_type, provider, endpoint_path, status, signing_secret_env, notes, metadata)
values
  ('payment-provider-events','payment','any','/api/webhooks/payment','configured','PAYMENT_WEBHOOK_SECRET','PROD 1 provider-agnostic payment webhook endpoint. Live side effects require PAYMENT_MODE live/production, configured provider credentials and valid HMAC signature.', '{"signature_required_for_live":true,"idempotency_index":"provider_webhook_events_idempotency_unique_idx","raw_payload_stored":false}'::jsonb),
  ('invoice-provider-events','invoice','any','/api/webhooks/invoice','configured','INVOICE_WEBHOOK_SECRET','PROD 1 provider-agnostic invoice webhook endpoint. Live side effects require INVOICE_MODE live/production, configured provider credentials and valid HMAC signature.', '{"signature_required_for_live":true,"idempotency_index":"provider_webhook_events_idempotency_unique_idx","raw_payload_stored":false}'::jsonb),
  ('demo-expiration-freeze','payment','internal','/api/cron/demo-expiration-freeze','configured','CRON_SECRET','Cron-ready endpoint freezes expired demo subscriptions when no paid subscription payment exists.', '{"requires_scheduler":true,"demo_days":3,"side_effects":"subscription_frozen,garden_suspended,notification,audit"}'::jsonb)
on conflict (webhook_key) do update set
  endpoint_path = excluded.endpoint_path,
  status = excluded.status,
  signing_secret_env = excluded.signing_secret_env,
  notes = excluded.notes,
  metadata = public.production_webhook_readiness.metadata || excluded.metadata,
  updated_at = now();

insert into public.provider_integration_health (integration_type, provider, status, credentials_configured, webhook_healthy, next_action, metadata)
values
  ('payment','provider_selected','configured',false,false,'Configure sandbox credentials, PAYMENT_WEBHOOK_SECRET and run signed webhook tests before live payment activation.', '{"prod1_endpoint":"/api/webhooks/payment","raw_card_storage":false,"streams_separated":true}'::jsonb),
  ('invoice','provider_selected','configured',false,false,'Configure invoice provider credentials, INVOICE_WEBHOOK_SECRET and signed webhook tests before production invoice issuing.', '{"prod1_endpoint":"/api/webhooks/invoice","streams_separated":true}'::jsonb)
on conflict (integration_type, provider) do update set
  status = excluded.status,
  credentials_configured = excluded.credentials_configured,
  webhook_healthy = excluded.webhook_healthy,
  next_action = excluded.next_action,
  metadata = public.provider_integration_health.metadata || excluded.metadata,
  updated_at = now();
