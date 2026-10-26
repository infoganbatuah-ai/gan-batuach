-- Synthetic subset of exact PUSH39 delivery/provider/callback column contracts.
create schema if not exists public;
create table public.digital_observer_notification_deliveries (
  id uuid primary key,
  observer_site_id uuid not null,
  recipient_profile_id uuid,
  channel text not null,
  provider_mode text not null,
  delivery_status text not null,
  attempt_count integer not null,
  max_attempts integer not null,
  expires_at timestamptz,
  authorization_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  terminal_at timestamptz,
  unknown_outcome_at timestamptz,
  next_retry_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint qa_delivery_status_check check (delivery_status in
    ('sent','delivered','acknowledged','cancelled','expired','terminal_failure',
     'dead_letter','unknown_outcome','retry_scheduled','queued'))
);
create table public.digital_observer_provider_channels (
  observer_site_id uuid not null,
  channel text not null,
  provider_key text not null,
  provider_mode text not null,
  active boolean not null,
  configuration_status text not null,
  primary key (observer_site_id, channel)
);
create table public.digital_observer_provider_callbacks (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null,
  delivery_id uuid not null references public.digital_observer_notification_deliveries(id),
  provider_key text not null,
  provider_event_id text not null,
  callback_status text not null,
  signature_valid boolean not null,
  replay_detected boolean not null default false,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  safe_metadata jsonb not null default '{}'::jsonb,
  constraint qa_callback_status_check check (callback_status in
    ('success','timeout','rate_limit','temporary_failure','permanent_failure',
     'unknown_outcome','acknowledged','expired','cancelled')),
  unique (provider_key, provider_event_id)
);
create function public.qa_fail_delivery_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_setting('qa.fail_update', true) = 'on' then
    raise exception 'QA_DELIVERY_UPDATE_FAILED';
  end if;
  return new;
end $$;
create trigger qa_fail_delivery_update before update on public.digital_observer_notification_deliveries
for each row execute function public.qa_fail_delivery_update();
grant usage on schema public to service_role, authenticated, anon;
grant select, insert on public.digital_observer_provider_callbacks to service_role;
grant select, update on public.digital_observer_notification_deliveries to service_role;
grant select on public.digital_observer_provider_channels to service_role;

insert into public.digital_observer_provider_channels
  (observer_site_id,channel,provider_key,provider_mode,active,configuration_status)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','email','provider-a','production',true,'ready'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','email','provider-b','production',true,'ready');
insert into public.digital_observer_notification_deliveries
  (id,observer_site_id,recipient_profile_id,channel,provider_mode,delivery_status,
   attempt_count,max_attempts,expires_at,authorization_snapshot,metadata)
values
  ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa','email','production','sent',1,3,
   '2100-01-01T00:00:00Z','{"profile_id":"aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa"}',
   '{"provider_key":"provider-a"}'),
  ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb','email','production','sent',1,3,
   '2100-01-01T00:00:00Z','{"profile_id":"bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb"}',
   '{"provider_key":"provider-b"}');
