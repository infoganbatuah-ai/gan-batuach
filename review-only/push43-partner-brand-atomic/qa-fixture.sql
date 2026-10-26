-- Disposable PostgreSQL QA database ONLY. This is not a migration.
-- Minimal source-shaped fixture from PUSH 41/43; synthetic identities only.
create schema auth;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;

create table public.profiles (id uuid primary key);
create table public.digital_observer_organizations (
  id uuid primary key,
  owner_profile_id uuid not null references public.profiles(id),
  status text not null check (status in ('active','suspended','closed'))
);
create table public.digital_observer_organization_memberships (
  id uuid primary key,
  organization_id uuid not null references public.digital_observer_organizations(id),
  profile_id uuid not null references public.profiles(id),
  enterprise_role text not null check (enterprise_role in
    ('platform_admin','organization_owner','organization_admin','site_admin',
     'security_operator','investigator','viewer','billing_admin')),
  active boolean not null,
  revoked_at timestamptz,
  unique (organization_id,profile_id)
);
create table public.digital_observer_partners (
  id uuid primary key,
  organization_id uuid not null unique references public.digital_observer_organizations(id),
  partner_status text not null check (partner_status in ('draft','sandbox','suspended','revoked'))
);
create table public.digital_observer_partner_brand_profiles (
  partner_id uuid primary key references public.digital_observer_partners(id),
  brand_name text not null,
  product_name text not null,
  logo_url text,
  primary_color text not null check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_url text,
  privacy_url text,
  terms_url text,
  customer_domain text,
  domain_status text not null check (domain_status in ('unverified','verification_pending','verified_sandbox')),
  notification_sender_label text,
  legally_required_notices jsonb not null check (jsonb_typeof(legally_required_notices)='array'),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.digital_observer_enterprise_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id),
  actor_profile_id uuid references public.profiles(id),
  resource_type text not null,
  resource_id text,
  action text not null,
  authorization_decision text not null check (authorization_decision in ('allowed','denied')),
  result_status text not null check (result_status in ('success','failed','blocked','unknown')),
  correlation_id text not null,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.digital_observer_organizations enable row level security;
alter table public.digital_observer_organization_memberships enable row level security;
alter table public.digital_observer_partners enable row level security;
alter table public.digital_observer_partner_brand_profiles enable row level security;
alter table public.digital_observer_enterprise_audit_events enable row level security;
grant usage on schema public, auth to service_role, authenticated, anon;
grant select, insert, update on all tables in schema public to service_role;
grant execute on function auth.role() to service_role, authenticated, anon;

insert into public.profiles(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444444'),
  ('55555555-5555-4555-8555-555555555555');
insert into public.digital_observer_organizations(id,owner_profile_id,status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','active'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','33333333-3333-4333-8333-333333333333','active'),
  ('99999999-9999-4999-8999-999999999999','33333333-3333-4333-8333-333333333333','active');
insert into public.digital_observer_organization_memberships
  (id,organization_id,profile_id,enterprise_role,active) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '22222222-2222-4222-8222-222222222222','organization_admin',true),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '33333333-3333-4333-8333-333333333333','organization_admin',true);
insert into public.digital_observer_partners(id,organization_id,partner_status) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','sandbox'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','sandbox');

create function public.qa_fail_audit() returns trigger language plpgsql as $$
begin
  if current_setting('qa.audit_fail', true) = 'on' then
    raise exception 'QA_AUDIT_FAILURE';
  end if;
  return new;
end $$;
create trigger qa_audit_failure before insert on public.digital_observer_enterprise_audit_events
  for each row execute function public.qa_fail_audit();
