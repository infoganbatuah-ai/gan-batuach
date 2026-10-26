-- Reduced synthetic fixture using the exact PUSH39 column and unique-key names.
-- The three standard Supabase roles already exist in the isolated QA cluster.
create schema if not exists public;
create table public.digital_observer_notification_deliveries (
  id uuid primary key,
  observer_site_id uuid not null,
  recipient_profile_id uuid,
  channel text not null,
  provider_mode text not null,
  delivery_status text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  expires_at timestamptz,
  stable_delivery_id text,
  authorization_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  provider_message_id text,
  next_retry_at timestamptz,
  sent_at timestamptz,
  terminal_at timestamptz,
  unknown_outcome_at timestamptz,
  dead_lettered_at timestamptz,
  last_attempt_at timestamptz,
  failure_reason text,
  updated_at timestamptz not null default now(),
  constraint qa_delivery_retry_check check (max_attempts between 1 and 10 and
    attempt_count between 0 and max_attempts)
);
create table public.digital_observer_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.digital_observer_notification_deliveries(id),
  observer_site_id uuid not null,
  attempt_number integer not null,
  provider_key text not null,
  provider_mode text not null,
  request_id text not null,
  outcome text not null,
  provider_message_id text,
  retryable boolean not null default false,
  retry_after timestamptz,
  error_code text,
  usage_units numeric(14,4) not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint qa_attempt_number_check check (attempt_number between 1 and 10),
  constraint qa_attempt_mode_check check (provider_mode in ('disabled','sandbox','production')),
  constraint qa_attempt_outcome_check check (outcome in
    ('success','timeout','rate_limit','temporary_failure','permanent_failure',
     'unknown_outcome','acknowledged','expired','cancelled','blocked')),
  unique (delivery_id,attempt_number),
  unique (provider_key,request_id)
);
create function public.qa_dispatch_fault() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'digital_observer_delivery_attempts'
    and current_setting('qa.fail_insert',true) = 'on' then
    raise exception 'QA_ATTEMPT_INSERT_FAILED';
  end if;
  if tg_table_name = 'digital_observer_notification_deliveries'
    and current_setting('qa.fail_update',true) = 'on' then
    raise exception 'QA_DELIVERY_UPDATE_FAILED';
  end if;
  return new;
end $$;
create trigger qa_attempt_insert_fault before insert on public.digital_observer_delivery_attempts
for each row execute function public.qa_dispatch_fault();
create trigger qa_delivery_update_fault before update on public.digital_observer_notification_deliveries
for each row execute function public.qa_dispatch_fault();

grant usage on schema public to service_role,authenticated,anon;
grant select,insert on public.digital_observer_delivery_attempts to service_role;
grant select,update on public.digital_observer_notification_deliveries to service_role;

insert into public.digital_observer_notification_deliveries
  (id,observer_site_id,recipient_profile_id,channel,provider_mode,delivery_status,
   attempt_count,max_attempts,expires_at,stable_delivery_id,authorization_snapshot,metadata)
values
  ('11111111-1111-4111-8111-111111111111',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa',
   'email','sandbox','dispatching',0,3,'2100-01-01T00:00:00Z','stable-qa-a',
   '{"profile_id":"aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa"}',
   '{"provider_key":"digital-observer-sandbox-email","external_message_sent":false}'),
  ('22222222-2222-4222-8222-222222222222',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb',
   'email','sandbox','dispatching',0,3,'2100-01-01T00:00:00Z','stable-qa-b',
   '{"profile_id":"bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb"}',
   '{"provider_key":"digital-observer-sandbox-email","external_message_sent":false}');
