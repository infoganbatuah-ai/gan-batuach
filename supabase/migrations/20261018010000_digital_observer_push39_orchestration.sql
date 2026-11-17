-- PUSH 39: provider-neutral external notification, action and escalation orchestration.
-- Data owner: Digital Observer Site owner. Sensitivity: operational/security metadata;
-- no raw video, credentials, child PII or biometric conclusions are permitted.
-- Retention: delivery/audit records follow the Site security/audit policy; payloads are
-- deliberately bounded. Expected volume is per reviewed action/delivery attempt, never
-- per frame. Recovery is additive: disable every provider/channel and retain history.

-- PUSH 39 requires an immediate human confirmation for siren/light and other
-- physical actions. Preserve historical policies for audit, but make every one
-- inactive and remove the service-role-only autonomous command entry point.
update public.digital_observer_camera_automation_policies
set enabled = false,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'push39_disabled_at', now(),
      'push39_reason', 'immediate_human_confirmation_required'
    ),
    updated_at = now()
where enabled = true;

revoke execute on function public.enqueue_digital_guard_camera_command_v1(uuid,text,jsonb,text) from service_role;

create table if not exists public.digital_observer_action_intents (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  incident_id uuid references public.observer_correlated_events(id) on delete set null,
  decision_intent_id uuid references public.digital_observer_decision_intents(id) on delete set null,
  signal_id uuid references public.observer_intelligence_signals(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  authorized_by uuid references public.profiles(id) on delete set null,
  confirmed_by uuid references public.profiles(id) on delete set null,
  intent_kind text not null,
  action_type text not null,
  severity text not null default 'info',
  priority smallint not null default 5,
  intent_status text not null default 'proposed',
  source_provenance text not null,
  human_confirmation_required boolean not null default false,
  human_confirmed_at timestamptz,
  lawful_use_approval_required boolean not null default false,
  policy_version text not null default 'do-action-policy-v1',
  policy_snapshot jsonb not null default '{}'::jsonb,
  proposed_action jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  expires_at timestamptz,
  cancelled_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_action_intent_kind_check check (intent_kind in ('notification','recommended_action','physical_action','emergency_escalation')),
  constraint do_action_intent_status_check check (intent_status in ('proposed','authorized','awaiting_confirmation','queued','executing','succeeded','failed','unknown_outcome','cancelled','expired','blocked','closed')),
  constraint do_action_intent_provenance_check check (source_provenance in ('REAL_CAMERA_AI','HUMAN_AUTHORIZED','SYSTEM_HEALTH','WATCH_RULE_REVIEWED')),
  constraint do_action_intent_priority_check check (priority between 0 and 10),
  constraint do_action_intent_confirmation_check check (human_confirmed_at is null or confirmed_by is not null),
  unique (observer_site_id, idempotency_key)
);

create table if not exists public.digital_observer_provider_channels (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  channel text not null,
  provider_key text not null default 'unconfigured',
  provider_mode text not null default 'disabled',
  active boolean not null default false,
  credential_reference text,
  callback_key_version integer not null default 1,
  allowed_destinations jsonb not null default '[]'::jsonb,
  rate_limit_per_minute integer not null default 10,
  rate_limit_per_day integer not null default 100,
  unit_cost_micros bigint,
  currency text not null default 'ILS',
  configuration_status text not null default 'not_configured',
  last_health_status text not null default 'unknown',
  last_health_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_provider_channel_check check (channel in ('push','email','sms','whatsapp','webhook','phone')),
  constraint do_provider_mode_check check (provider_mode in ('disabled','sandbox','production')),
  constraint do_provider_activation_check check (provider_mode <> 'disabled' or active = false),
  constraint do_provider_rate_check check (rate_limit_per_minute between 1 and 1000 and rate_limit_per_day between 1 and 1000000),
  constraint do_provider_cost_check check (unit_cost_micros is null or unit_cost_micros >= 0),
  constraint do_provider_configuration_check check (configuration_status in ('not_configured','ready','revoked','failed')),
  unique (observer_site_id, channel)
);

alter table public.observer_alert_channel_settings
  add column if not exists timezone text not null default 'Asia/Jerusalem',
  add column if not exists locale text not null default 'he-IL',
  add column if not exists quiet_hours_start time,
  add column if not exists quiet_hours_end time,
  add column if not exists consent_or_legal_basis boolean not null default false,
  add column if not exists channel_eligible boolean not null default false,
  add column if not exists emergency_override_authorized boolean not null default false,
  add column if not exists accessibility_preferences jsonb not null default '{}'::jsonb,
  add column if not exists rate_limit_per_hour integer not null default 20,
  add column if not exists revoked_at timestamptz;

alter table public.observer_alert_channel_settings
  drop constraint if exists observer_alert_channel_settings_channel_check,
  drop constraint if exists do_alert_channel_rate_check;
alter table public.observer_alert_channel_settings
  alter column provider_mode set default 'disabled',
  add constraint observer_alert_channel_settings_channel_check check (channel in ('in_app','email','sms','whatsapp','push','webhook','phone')),
  add constraint do_alert_channel_rate_check check (rate_limit_per_hour between 1 and 1000);

alter table public.digital_observer_notification_deliveries
  add column if not exists action_intent_id uuid references public.digital_observer_action_intents(id) on delete set null,
  add column if not exists stable_delivery_id text,
  add column if not exists priority smallint not null default 5,
  add column if not exists expires_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists terminal_at timestamptz,
  add column if not exists unknown_outcome_at timestamptz,
  add column if not exists dead_lettered_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists authorization_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists content_classification text not null default 'minimal',
  add column if not exists locale text not null default 'he-IL',
  add column if not exists timezone text not null default 'Asia/Jerusalem';

alter table public.digital_observer_notification_deliveries
  drop constraint if exists digital_observer_delivery_channel_check,
  drop constraint if exists digital_observer_delivery_mode_check,
  drop constraint if exists digital_observer_delivery_status_check,
  drop constraint if exists do_delivery_priority_check,
  drop constraint if exists do_delivery_content_check;

alter table public.digital_observer_notification_deliveries
  alter column provider_mode set default 'disabled',
  add constraint digital_observer_delivery_channel_check check (channel in ('in_app','push','email','sms','whatsapp','voice','phone','webhook')),
  add constraint digital_observer_delivery_mode_check check (provider_mode in ('disabled','mock','sandbox','live','production')),
  add constraint digital_observer_delivery_status_check check (delivery_status in ('queued','suppressed','awaiting_confirmation','mocked','dispatching','sent','delivered','acknowledged','retry_scheduled','unknown_outcome','failed','terminal_failure','dead_letter','expired','cancelled')),
  add constraint do_delivery_priority_check check (priority between 0 and 10),
  add constraint do_delivery_content_check check (content_classification in ('minimal','operational','sensitive_link_only'));

create unique index if not exists do_delivery_stable_id_idx
  on public.digital_observer_notification_deliveries(observer_site_id, stable_delivery_id)
  where stable_delivery_id is not null;
drop index if exists public.digital_observer_notification_dedupe_idx;
create unique index digital_observer_notification_dedupe_idx
  on public.digital_observer_notification_deliveries(observer_site_id, dedupe_key);
create index if not exists do_delivery_queue_idx
  on public.digital_observer_notification_deliveries(delivery_status, next_retry_at, priority desc, created_at)
  where delivery_status in ('queued','retry_scheduled');
create index if not exists do_delivery_recipient_idx
  on public.digital_observer_notification_deliveries(recipient_profile_id, created_at desc);

create table if not exists public.digital_observer_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.digital_observer_notification_deliveries(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  attempt_number integer not null,
  provider_key text not null,
  provider_mode text not null,
  request_id text not null,
  outcome text not null,
  provider_message_id text,
  retryable boolean not null default false,
  retry_after timestamptz,
  http_status integer,
  callback_event_id text,
  error_code text,
  safe_error_message text,
  usage_units numeric(14,4) not null default 1,
  projected_cost_micros bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint do_delivery_attempt_number_check check (attempt_number between 1 and 10),
  constraint do_delivery_attempt_mode_check check (provider_mode in ('disabled','sandbox','production')),
  constraint do_delivery_attempt_outcome_check check (outcome in ('success','timeout','rate_limit','temporary_failure','permanent_failure','unknown_outcome','acknowledged','expired','cancelled','blocked')),
  constraint do_delivery_attempt_cost_check check (projected_cost_micros is null or projected_cost_micros >= 0),
  unique (delivery_id, attempt_number),
  unique (provider_key, request_id)
);

create table if not exists public.digital_observer_escalations (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  action_intent_id uuid not null references public.digital_observer_action_intents(id) on delete cascade,
  primary_delivery_id uuid references public.digital_observer_notification_deliveries(id) on delete set null,
  operator_profile_id uuid references public.profiles(id) on delete set null,
  escalation_status text not null default 'pending',
  current_step integer not null default 0,
  acknowledgement_deadline timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  cancellation_reason text,
  closure_reason text,
  max_steps integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint do_escalation_status_check check (escalation_status in ('pending','active','acknowledged','escalated','cancelled','expired','failed','closed')),
  constraint do_escalation_step_check check (current_step between 0 and max_steps and max_steps between 1 and 10),
  unique (action_intent_id)
);

create table if not exists public.digital_observer_escalation_steps (
  id uuid primary key default gen_random_uuid(),
  escalation_id uuid not null references public.digital_observer_escalations(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  step_number integer not null,
  recipient_profile_id uuid not null references public.profiles(id) on delete restrict,
  channel text not null,
  delay_seconds integer not null default 0,
  step_status text not null default 'pending',
  delivery_id uuid references public.digital_observer_notification_deliveries(id) on delete set null,
  activated_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint do_escalation_step_channel_check check (channel in ('in_app','push','email','sms','whatsapp','webhook','phone')),
  constraint do_escalation_step_status_check check (step_status in ('pending','active','delivered','acknowledged','suppressed','failed','cancelled','expired')),
  constraint do_escalation_delay_check check (delay_seconds between 0 and 86400),
  unique (escalation_id, step_number),
  unique (escalation_id, recipient_profile_id, channel)
);

create table if not exists public.digital_observer_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  display_name text not null,
  destination_url text not null,
  destination_host text not null,
  destination_fingerprint text not null,
  provider_mode text not null default 'disabled',
  active boolean not null default false,
  signing_key_reference text not null,
  signing_key_version integer not null default 1,
  contract_version text not null default 'do-webhook-v1',
  allowed_event_types jsonb not null default '[]'::jsonb,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_webhook_mode_check check (provider_mode in ('disabled','sandbox','production')),
  constraint do_webhook_activation_check check (provider_mode <> 'disabled' or active = false),
  unique (observer_site_id, destination_fingerprint)
);

create table if not exists public.digital_observer_provider_callbacks (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  delivery_id uuid not null references public.digital_observer_notification_deliveries(id) on delete cascade,
  provider_key text not null,
  provider_event_id text not null,
  callback_status text not null,
  signature_valid boolean not null,
  replay_detected boolean not null default false,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  safe_metadata jsonb not null default '{}'::jsonb,
  constraint do_provider_callback_status_check check (callback_status in ('success','timeout','rate_limit','temporary_failure','permanent_failure','unknown_outcome','acknowledged','expired','cancelled')),
  unique (provider_key, provider_event_id)
);

create table if not exists public.digital_observer_action_audit (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  action_intent_id uuid references public.digital_observer_action_intents(id) on delete set null,
  delivery_id uuid references public.digital_observer_notification_deliveries(id) on delete set null,
  escalation_id uuid references public.digital_observer_escalations(id) on delete set null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  result_status text not null,
  reason_code text,
  policy_version text not null default 'do-action-policy-v1',
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint do_action_audit_result_check check (result_status in ('allowed','denied','pending','succeeded','failed','unknown','cancelled'))
);

create index if not exists do_action_intent_site_idx on public.digital_observer_action_intents(observer_site_id, intent_status, created_at desc);
create index if not exists do_delivery_attempt_site_idx on public.digital_observer_delivery_attempts(observer_site_id, created_at desc);
create index if not exists do_escalation_site_idx on public.digital_observer_escalations(observer_site_id, escalation_status, created_at desc);
create index if not exists do_escalation_steps_due_idx on public.digital_observer_escalation_steps(step_status, activated_at, step_number);
create index if not exists do_provider_callback_delivery_idx on public.digital_observer_provider_callbacks(delivery_id, received_at desc);
create index if not exists do_action_audit_site_idx on public.digital_observer_action_audit(observer_site_id, created_at desc);

alter table public.digital_observer_action_intents enable row level security;
alter table public.digital_observer_provider_channels enable row level security;
alter table public.digital_observer_delivery_attempts enable row level security;
alter table public.digital_observer_escalations enable row level security;
alter table public.digital_observer_escalation_steps enable row level security;
alter table public.digital_observer_webhook_endpoints enable row level security;
alter table public.digital_observer_provider_callbacks enable row level security;
alter table public.digital_observer_action_audit enable row level security;

create policy "do action intents scoped read" on public.digital_observer_action_intents for select using (public.can_access_observer_site(observer_site_id));
create policy "do provider channels scoped manage" on public.digital_observer_provider_channels for all using (public.can_manage_observer_site(observer_site_id)) with check (public.can_manage_observer_site(observer_site_id));
create policy "do delivery attempts scoped read" on public.digital_observer_delivery_attempts for select using (public.can_access_observer_site(observer_site_id));
create policy "do escalations scoped read" on public.digital_observer_escalations for select using (public.can_access_observer_site(observer_site_id));
create policy "do escalation steps scoped read" on public.digital_observer_escalation_steps for select using (public.can_access_observer_site(observer_site_id));
create policy "do webhook endpoints scoped manage" on public.digital_observer_webhook_endpoints for all using (public.can_manage_observer_site(observer_site_id)) with check (public.can_manage_observer_site(observer_site_id));
create policy "do provider callbacks scoped read" on public.digital_observer_provider_callbacks for select using (public.can_manage_observer_site(observer_site_id));
create policy "do action audit scoped read" on public.digital_observer_action_audit for select using (public.can_access_observer_site(observer_site_id));

revoke all on public.digital_observer_action_intents, public.digital_observer_delivery_attempts,
  public.digital_observer_escalations, public.digital_observer_escalation_steps,
  public.digital_observer_provider_callbacks, public.digital_observer_action_audit from anon, authenticated;
grant select on public.digital_observer_action_intents, public.digital_observer_delivery_attempts,
  public.digital_observer_escalations, public.digital_observer_escalation_steps,
  public.digital_observer_provider_callbacks, public.digital_observer_action_audit to authenticated;

revoke all on public.digital_observer_provider_channels, public.digital_observer_webhook_endpoints from anon, authenticated;
grant select on public.digital_observer_provider_channels, public.digital_observer_webhook_endpoints to authenticated;

revoke insert, update, delete on public.digital_observer_notification_deliveries from authenticated;

create or replace function public.block_digital_observer_push39_history_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Digital Observer PUSH 39 delivery/audit history is append-only';
end;
$$;

drop trigger if exists do_delivery_attempts_append_only on public.digital_observer_delivery_attempts;
create trigger do_delivery_attempts_append_only before update or delete on public.digital_observer_delivery_attempts
for each row execute function public.block_digital_observer_push39_history_mutation();
drop trigger if exists do_provider_callbacks_append_only on public.digital_observer_provider_callbacks;
create trigger do_provider_callbacks_append_only before update or delete on public.digital_observer_provider_callbacks
for each row execute function public.block_digital_observer_push39_history_mutation();
drop trigger if exists do_action_audit_append_only on public.digital_observer_action_audit;
create trigger do_action_audit_append_only before update or delete on public.digital_observer_action_audit
for each row execute function public.block_digital_observer_push39_history_mutation();

comment on table public.digital_observer_action_intents is 'PUSH 39 authorized intent boundary. Natural language and AI can propose only; policy and human confirmation remain separate.';
comment on table public.digital_observer_provider_channels is 'Provider-neutral channel configuration. Every new row defaults disabled and inactive; credentials are referenced, never stored.';
comment on table public.digital_observer_delivery_attempts is 'Append-only provider attempt and bounded cost evidence; unknown outcome is not success and is not blindly retried.';
comment on table public.digital_observer_escalations is 'Acknowledgement-driven bounded escalation state; max_steps prevents loops and alert storms.';
comment on table public.digital_observer_webhook_endpoints is 'Allowlisted signed webhook destination metadata. Private/internal destinations are rejected by application policy before persistence.';
comment on table public.digital_observer_action_audit is 'Append-only minimized audit trail; no raw media, credentials, child PII or biometric conclusions.';
