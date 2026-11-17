-- PUSH 43 — SDK, OEM and white-label partner integration foundations.
-- Additive Development schema only. Production activation and real partner provisioning remain prohibited.

create table if not exists public.digital_observer_partners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.digital_observer_organizations(id) on delete cascade,
  partner_key text not null unique,
  partner_type text not null,
  partner_status text not null default 'sandbox',
  billing_account_id uuid references public.digital_observer_partner_billing_accounts(id) on delete set null,
  sso_connection_id uuid references public.digital_observer_sso_connections(id) on delete set null,
  retail_pricing_controlled_by_partner boolean not null default true,
  allowed_embed_origins jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_partner_key_check check (partner_key ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  constraint do_partner_type_check check (partner_type in ('manufacturer','security_company','monitoring_center','vms_provider','smart_home','enterprise_software','reseller','oem','white_label')),
  constraint do_partner_status_check check (partner_status in ('draft','sandbox','suspended','revoked')),
  constraint do_partner_origins_check check (jsonb_typeof(allowed_embed_origins)='array')
);

create table if not exists public.digital_observer_partner_customers (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.digital_observer_partners(id) on delete cascade,
  customer_organization_id uuid not null references public.digital_observer_organizations(id) on delete restrict,
  external_customer_reference_hash text not null,
  external_customer_reference_hint text not null,
  idempotency_key text not null,
  customer_status text not null default 'provisioning',
  suspension_reason text,
  activated_at timestamptz,
  suspended_at timestamptz,
  deprovisioned_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id,customer_organization_id),
  unique(partner_id,idempotency_key),
  constraint do_partner_customer_status_check check (customer_status in ('provisioning','active','suspended','deprovisioned')),
  constraint do_partner_customer_reference_check check (length(external_customer_reference_hash)=64 and length(external_customer_reference_hint) between 2 and 80)
);

create table if not exists public.digital_observer_partner_customer_sites (
  partner_customer_id uuid not null references public.digital_observer_partner_customers(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key(partner_customer_id,observer_site_id)
);

create table if not exists public.digital_observer_partner_customer_entitlements (
  partner_customer_id uuid not null references public.digital_observer_partner_customers(id) on delete cascade,
  entitlement_grant_id uuid not null references public.digital_observer_entitlement_grants(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(partner_customer_id,entitlement_grant_id)
);

create table if not exists public.digital_observer_partner_brand_profiles (
  partner_id uuid primary key references public.digital_observer_partners(id) on delete cascade,
  brand_name text not null,
  product_name text not null,
  logo_url text,
  primary_color text not null default '#0f766e',
  accent_color text not null default '#14b8a6',
  support_url text,
  privacy_url text,
  terms_url text,
  customer_domain text,
  domain_status text not null default 'unverified',
  notification_sender_label text,
  legally_required_notices jsonb not null default '[]'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint do_brand_color_check check (primary_color ~ '^#[0-9A-Fa-f]{6}$' and accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint do_brand_domain_status_check check (domain_status in ('unverified','verification_pending','verified_sandbox')),
  constraint do_brand_notices_check check (jsonb_typeof(legally_required_notices)='array')
);

create table if not exists public.digital_observer_partner_service_accounts (
  partner_id uuid not null references public.digital_observer_partners(id) on delete cascade,
  service_account_id uuid not null unique references public.digital_observer_service_accounts(id) on delete cascade,
  partner_customer_id uuid references public.digital_observer_partner_customers(id) on delete cascade,
  access_kind text not null,
  created_at timestamptz not null default now(),
  primary key(partner_id,service_account_id),
  constraint do_partner_service_access_check check (access_kind in ('partner_control','customer_resources')),
  constraint do_partner_service_customer_check check ((access_kind='partner_control' and partner_customer_id is null) or (access_kind='customer_resources' and partner_customer_id is not null))
);

create table if not exists public.digital_observer_partner_provisioning_receipts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.digital_observer_partners(id) on delete cascade,
  service_account_id uuid references public.digital_observer_service_accounts(id) on delete set null,
  idempotency_key text not null,
  operation text not null,
  request_hash text not null,
  result_status text not null default 'accepted',
  resource_type text,
  resource_id uuid,
  response_status integer,
  expires_at timestamptz not null default (now()+interval '90 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(partner_id,operation,idempotency_key),
  constraint do_partner_receipt_status_check check (result_status in ('accepted','completed','failed','unknown')),
  constraint do_partner_receipt_hash_check check (length(request_hash)=64),
  constraint do_partner_receipt_expiry_check check (expires_at>created_at and expires_at<=created_at+interval '91 days')
);

create table if not exists public.digital_observer_embedded_sessions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.digital_observer_partners(id) on delete cascade,
  partner_customer_id uuid not null references public.digital_observer_partner_customers(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  audience text not null,
  allowed_origin text not null,
  scopes jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revocation_reason text,
  last_used_at timestamptz,
  issued_by_profile_id uuid references public.profiles(id) on delete set null,
  issued_by_service_account_id uuid references public.digital_observer_service_accounts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint do_embedded_session_scope_check check (jsonb_typeof(scopes)='array' and jsonb_array_length(scopes)>0),
  constraint do_embedded_session_expiry_check check (expires_at>created_at and expires_at<=created_at+interval '60 minutes'),
  constraint do_embedded_session_origin_check check (allowed_origin ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' or allowed_origin ~ '^http://(localhost|127\\.0\\.0\\.1)(:[0-9]+)?$')
);

create index if not exists do_partner_customer_status_idx on public.digital_observer_partner_customers(partner_id,customer_status,created_at desc);
create index if not exists do_partner_customer_site_idx on public.digital_observer_partner_customer_sites(observer_site_id,partner_customer_id);
create index if not exists do_partner_service_customer_idx on public.digital_observer_partner_service_accounts(partner_customer_id) where partner_customer_id is not null;
create index if not exists do_partner_receipt_expiry_idx on public.digital_observer_partner_provisioning_receipts(expires_at);
create index if not exists do_embedded_session_active_idx on public.digital_observer_embedded_sessions(partner_customer_id,observer_site_id,expires_at) where revoked_at is null;

alter table public.digital_observer_partners enable row level security;
alter table public.digital_observer_partner_customers enable row level security;
alter table public.digital_observer_partner_customer_sites enable row level security;
alter table public.digital_observer_partner_customer_entitlements enable row level security;
alter table public.digital_observer_partner_brand_profiles enable row level security;
alter table public.digital_observer_partner_service_accounts enable row level security;
alter table public.digital_observer_partner_provisioning_receipts enable row level security;
alter table public.digital_observer_embedded_sessions enable row level security;

create or replace function public.digital_observer_can_manage_partner(requested_partner_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.digital_observer_partners p
    join public.digital_observer_organizations o on o.id=p.organization_id
    left join public.digital_observer_organization_memberships m on m.organization_id=o.id and m.profile_id=auth.uid()
    where p.id=requested_partner_id and p.partner_status in ('draft','sandbox','suspended')
      and (o.owner_profile_id=auth.uid() or (m.active=true and m.revoked_at is null and m.enterprise_role in ('organization_owner','organization_admin')))
  );
$$;
revoke all on function public.digital_observer_can_manage_partner(uuid) from public,anon;
grant execute on function public.digital_observer_can_manage_partner(uuid) to authenticated;

create policy "partner administrators read partner" on public.digital_observer_partners for select to authenticated
  using(public.digital_observer_can_manage_partner(id));
create policy "partner administrators read customers" on public.digital_observer_partner_customers for select to authenticated
  using(public.digital_observer_can_manage_partner(partner_id));
create policy "partner administrators read customer sites" on public.digital_observer_partner_customer_sites for select to authenticated
  using(exists(select 1 from public.digital_observer_partner_customers c where c.id=partner_customer_id and public.digital_observer_can_manage_partner(c.partner_id)));
create policy "partner administrators read customer entitlements" on public.digital_observer_partner_customer_entitlements for select to authenticated
  using(exists(select 1 from public.digital_observer_partner_customers c where c.id=partner_customer_id and public.digital_observer_can_manage_partner(c.partner_id)));
create policy "partner administrators read brand" on public.digital_observer_partner_brand_profiles for select to authenticated
  using(public.digital_observer_can_manage_partner(partner_id));
create policy "partner administrators read service mappings" on public.digital_observer_partner_service_accounts for select to authenticated
  using(public.digital_observer_can_manage_partner(partner_id));

revoke all on public.digital_observer_partners,public.digital_observer_partner_customers,
  public.digital_observer_partner_customer_sites,public.digital_observer_partner_customer_entitlements,
  public.digital_observer_partner_brand_profiles,public.digital_observer_partner_service_accounts,
  public.digital_observer_partner_provisioning_receipts,public.digital_observer_embedded_sessions from anon,authenticated;
grant select on public.digital_observer_partners,public.digital_observer_partner_customers,
  public.digital_observer_partner_customer_sites,public.digital_observer_partner_customer_entitlements,
  public.digital_observer_partner_brand_profiles,public.digital_observer_partner_service_accounts to authenticated;

comment on table public.digital_observer_partners is 'PUSH 43 partner overlay on canonical PUSH 41 organizations; sandbox only until an owner-approved external activation.';
comment on table public.digital_observer_partner_customers is 'Idempotent partner-to-customer organization mapping. External references are hashed; no duplicate tenant model.';
comment on table public.digital_observer_partner_customer_entitlements is 'Assignment references canonical PUSH 40 entitlement grants and does not create a parallel entitlement engine.';
comment on table public.digital_observer_partner_service_accounts is 'PUSH 41 service-account delegation boundary for partner control or one customer resource scope.';
comment on table public.digital_observer_embedded_sessions is 'Short-lived audience/origin/Site-scoped sessions for browser embedding; raw tokens are never stored.';
