-- Synthetic source-shaped PUSH 40 fixture for one disposable PostgreSQL DB.
-- No real payment, invoice, credential, Site or provider data.
create schema auth;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true),'')
$$;

create table public.profiles (id uuid primary key, active boolean not null default true);
create table public.observer_sites (
  id uuid primary key, owner_profile_id uuid references public.profiles(id),
  active boolean not null, site_type text not null, garden_id uuid
);
create table public.observer_site_memberships (
  id uuid primary key, observer_site_id uuid not null references public.observer_sites(id),
  profile_id uuid not null references public.profiles(id),
  active boolean not null, member_role text not null
    check (member_role in ('owner','admin','operator','viewer','billing')),
  unique(observer_site_id,profile_id)
);
create table public.digital_observer_payment_events (
  id uuid primary key,
  checkout_intent_id uuid,
  observer_site_id uuid references public.observer_sites(id),
  subscription_id uuid,
  payment_outcome text not null check (payment_outcome in
    ('pending','confirmed','failed','refunded','unknown','cancelled')),
  amount_minor bigint,
  currency text,
  signature_valid boolean not null default false
);
create table public.observer_invoices (
  id uuid primary key,
  observer_site_id uuid references public.observer_sites(id),
  invoice_state text not null,
  currency text not null,
  metadata jsonb not null default '{}'::jsonb
);
create table public.digital_observer_refunds (
  id uuid primary key default gen_random_uuid(),
  stable_refund_id text not null unique,
  idempotency_key text not null,
  observer_site_id uuid not null references public.observer_sites(id),
  subscription_id uuid,
  payment_event_id uuid references public.digital_observer_payment_events(id),
  invoice_id uuid references public.observer_invoices(id),
  refund_status text not null check (refund_status in
    ('requested','authorized','provider_pending','confirmed','failed','unknown','cancelled')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  requested_by uuid not null references public.profiles(id),
  authorized_by uuid references public.profiles(id),
  safe_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id,idempotency_key)
);
create table public.digital_observer_financial_audit (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id),
  actor_profile_id uuid references public.profiles(id),
  actor_type text not null,
  authorization_reference text,
  operation text not null,
  entity_type text not null,
  entity_id text not null,
  previous_state jsonb not null default '{}'::jsonb,
  new_state jsonb not null default '{}'::jsonb,
  provider_reference text,
  correlation_id text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.observer_sites enable row level security;
alter table public.observer_site_memberships enable row level security;
alter table public.digital_observer_payment_events enable row level security;
alter table public.observer_invoices enable row level security;
alter table public.digital_observer_refunds enable row level security;
alter table public.digital_observer_financial_audit enable row level security;
grant usage on schema public,auth to service_role,authenticated,anon;
grant select,insert,update on all tables in schema public to service_role;
grant execute on function auth.role() to service_role,authenticated,anon;

insert into public.profiles(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444'),
  ('55555555-5555-4555-8555-555555555555');
insert into public.observer_sites(id,owner_profile_id,active,site_type,garden_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',true,'home',null),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333',true,'office',null),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111',true,'kindergarten','dddddddd-dddd-4ddd-8ddd-dddddddddddd');
insert into public.observer_site_memberships(id,observer_site_id,profile_id,active,member_role) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '22222222-2222-4222-8222-222222222222',true,'admin'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '55555555-5555-4555-8555-555555555555',true,'viewer');
insert into public.digital_observer_payment_events
  (id,checkout_intent_id,observer_site_id,payment_outcome,amount_minor,currency,signature_valid) values
  ('66666666-6666-4666-8666-666666666666','77777777-7777-4777-8777-777777777777',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirmed',10000,'ILS',true),
  ('66666666-6666-4666-8666-666666666667','77777777-7777-4777-8777-777777777778',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirmed',8000,'ILS',true),
  ('66666666-6666-4666-8666-666666666668','77777777-7777-4777-8777-777777777779',
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','confirmed',10000,'ILS',true),
  ('66666666-6666-4666-8666-666666666669','77777777-7777-4777-8777-777777777780',
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','confirmed',5000,'ILS',true);
insert into public.observer_invoices(id,observer_site_id,invoice_state,currency,metadata) values
  ('88888888-8888-4888-8888-888888888888','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','paid','ILS',
   '{"source_payment_event_id":"66666666-6666-4666-8666-666666666666","checkout_intent_id":"77777777-7777-4777-8777-777777777777"}'),
  ('88888888-8888-4888-8888-888888888889','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','paid','ILS',
   '{"source_payment_event_id":"66666666-6666-4666-8666-666666666667","checkout_intent_id":"77777777-7777-4777-8777-777777777778"}'),
  ('88888888-8888-4888-8888-88888888888a','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','paid','ILS',
   '{"source_payment_event_id":"66666666-6666-4666-8666-666666666668","checkout_intent_id":"77777777-7777-4777-8777-777777777779"}');

create function public.qa_fail_financial_audit() returns trigger language plpgsql as $$
begin
  if current_setting('qa.audit_fail',true)='on' then
    raise exception 'QA_AUDIT_FAILURE';
  end if;
  return new;
end $$;
create trigger qa_audit_failure before insert on public.digital_observer_financial_audit
  for each row execute function public.qa_fail_financial_audit();
