-- PUSH 40: canonical Digital Observer commercial billing extension.
-- Reuses observer_site_subscriptions as the subscription owner. No provider is activated.

alter table public.observer_monitoring_packages
  add column if not exists catalog_version integer not null default 1,
  add column if not exists commercial_segment text not null default 'small_business',
  add column if not exists pricing_status text not null default 'unapproved',
  add column if not exists overage_policy text not null default 'deny',
  add column if not exists included_entitlements jsonb not null default '{}'::jsonb,
  add column if not exists commercially_approved_at timestamptz,
  add column if not exists commercially_approved_by uuid references public.profiles(id) on delete set null;

alter table public.observer_monitoring_packages drop constraint if exists observer_monitoring_packages_commercial_segment_check;
alter table public.observer_monitoring_packages add constraint observer_monitoring_packages_commercial_segment_check
  check (commercial_segment in ('consumer','small_business','enterprise','oem_reseller','white_label_partner'));
alter table public.observer_monitoring_packages drop constraint if exists observer_monitoring_packages_pricing_status_check;
alter table public.observer_monitoring_packages add constraint observer_monitoring_packages_pricing_status_check
  check (pricing_status in ('unapproved','approved','retired'));
alter table public.observer_monitoring_packages drop constraint if exists observer_monitoring_packages_overage_policy_check;
alter table public.observer_monitoring_packages add constraint observer_monitoring_packages_overage_policy_check
  check (overage_policy in ('deny','warn','contract'));

update public.observer_monitoring_packages
set commercial_segment = case package_type when 'home' then 'consumer' when 'enterprise' then 'enterprise' else 'small_business' end,
    pricing_status = 'unapproved',
    included_entitlements = jsonb_build_object(
      'sites', 1,
      'cameras', camera_limit,
      'ai_processing', coalesce((feature_flags->>'ai_shadow_detection')::boolean, false),
      'video_retention', recording_retention_days,
      'evidence_storage', coalesce((feature_flags->>'recording')::boolean, false),
      'investigation', coalesce((feature_flags->>'advanced_analytics')::boolean, false),
      'notifications', true,
      'api_access', false,
      'partner_features', false,
      'white_label_features', false
    ),
    metadata = coalesce(metadata, '{}'::jsonb) || '{"legacy_seed_price_unapproved":true}'::jsonb
where pricing_status <> 'approved';

alter table public.observer_site_subscriptions
  add column if not exists commercial_state text not null default 'trial',
  add column if not exists payment_provider_mode text not null default 'disabled',
  add column if not exists provider_outcome text not null default 'none',
  add column if not exists current_plan_version integer not null default 1,
  add column if not exists entitlement_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists grace_period_started_at timestamptz,
  add column if not exists payment_failure_count integer not null default 0,
  add column if not exists next_payment_retry_at timestamptz,
  add column if not exists last_provider_event_id uuid,
  add column if not exists last_provider_event_at timestamptz,
  add column if not exists scheduled_change jsonb not null default '{}'::jsonb,
  add column if not exists lifecycle_version integer not null default 1;

alter table public.observer_subscription_change_requests
  add column if not exists commercial_idempotency_key text;
create unique index if not exists observer_subscription_change_commercial_idempotency_idx
  on public.observer_subscription_change_requests(observer_site_id,commercial_idempotency_key);

alter table public.observer_site_subscriptions drop constraint if exists observer_site_subscriptions_commercial_state_check;
alter table public.observer_site_subscriptions add constraint observer_site_subscriptions_commercial_state_check
  check (commercial_state in ('trial','active','past_due','grace_period','suspended','cancelled','expired'));
alter table public.observer_site_subscriptions drop constraint if exists observer_site_subscriptions_payment_provider_mode_check;
alter table public.observer_site_subscriptions add constraint observer_site_subscriptions_payment_provider_mode_check
  check (payment_provider_mode in ('disabled','sandbox','production'));
alter table public.observer_site_subscriptions drop constraint if exists observer_site_subscriptions_provider_outcome_check;
alter table public.observer_site_subscriptions add constraint observer_site_subscriptions_provider_outcome_check
  check (provider_outcome in ('none','pending','confirmed','failed','unknown','cancelled','refunded'));
alter table public.observer_site_subscriptions drop constraint if exists observer_site_subscriptions_payment_failure_count_check;
alter table public.observer_site_subscriptions add constraint observer_site_subscriptions_payment_failure_count_check
  check (payment_failure_count between 0 and 3);

update public.observer_site_subscriptions set commercial_state = case
  when subscription_status in ('active') then 'active'
  when subscription_status in ('overdue','pending_payment') then 'past_due'
  when subscription_status in ('suspended') then 'suspended'
  when subscription_status in ('cancelled') then 'cancelled'
  when subscription_status in ('expired') then 'expired'
  else 'trial' end,
  payment_provider_mode = 'disabled',
  provider_outcome = 'none';

update public.observer_site_subscriptions s
set entitlement_snapshot = p.included_entitlements,
    package_limits_snapshot = p.included_entitlements,
    current_plan_version = p.catalog_version
from public.observer_monitoring_packages p
where p.id=s.package_id and s.entitlement_snapshot='{}'::jsonb;

create table if not exists public.digital_observer_plan_versions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.observer_monitoring_packages(id) on delete restrict,
  version integer not null,
  commercial_segment text not null check (commercial_segment in ('consumer','small_business','enterprise','oem_reseller','white_label_partner')),
  billing_period text not null check (billing_period in ('monthly','annual','contract')),
  price_minor bigint,
  currency text not null default 'ILS',
  pricing_status text not null default 'unapproved' check (pricing_status in ('unapproved','approved','retired')),
  included_entitlements jsonb not null default '{}'::jsonb,
  overage_policy text not null default 'deny' check (overage_policy in ('deny','warn','contract')),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(package_id, version, billing_period),
  check ((pricing_status <> 'approved') or (price_minor is not null and price_minor >= 0 and approved_at is not null and approved_by is not null))
);

create table if not exists public.digital_observer_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  account_key text not null unique,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  owner_profile_id uuid references public.profiles(id) on delete restrict,
  commercial_segment text not null check (commercial_segment in ('consumer','small_business','enterprise','oem_reseller','white_label_partner')),
  account_status text not null default 'active' check (account_status in ('active','suspended','closed')),
  partner_reference text,
  currency text not null default 'ILS',
  tax_metadata jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id)
);

create table if not exists public.digital_observer_checkout_intents (
  id uuid primary key default gen_random_uuid(),
  stable_checkout_id text not null unique,
  idempotency_key text not null,
  billing_account_id uuid not null references public.digital_observer_billing_accounts(id) on delete restrict,
  observer_site_id uuid not null references public.observer_sites(id) on delete restrict,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  plan_version_id uuid not null references public.digital_observer_plan_versions(id) on delete restrict,
  provider_key text not null default 'disabled',
  provider_mode text not null default 'disabled' check (provider_mode in ('disabled','sandbox','production')),
  checkout_status text not null default 'quoted' check (checkout_status in ('quoted','provider_pending','provider_created','payment_pending','verified','failed','unknown','expired','cancelled')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null,
  quote_expires_at timestamptz not null,
  provider_checkout_reference text,
  provider_outcome text not null default 'none' check (provider_outcome in ('none','pending','confirmed','failed','unknown')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id,idempotency_key)
);

create table if not exists public.digital_observer_payment_events (
  id uuid primary key default gen_random_uuid(),
  stable_payment_event_id text not null unique,
  provider_key text not null,
  provider_event_id text not null,
  provider_mode text not null check (provider_mode in ('disabled','sandbox','production')),
  checkout_intent_id uuid references public.digital_observer_checkout_intents(id) on delete restrict,
  observer_site_id uuid references public.observer_sites(id) on delete restrict,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  event_type text not null,
  payment_outcome text not null check (payment_outcome in ('pending','confirmed','failed','refunded','unknown','cancelled')),
  amount_minor bigint,
  currency text,
  signature_valid boolean not null default false,
  replay_detected boolean not null default false,
  occurred_at timestamptz,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(provider_key, provider_event_id)
);

alter table public.observer_site_subscriptions drop constraint if exists observer_site_subscriptions_last_provider_event_fk;
alter table public.observer_site_subscriptions add constraint observer_site_subscriptions_last_provider_event_fk
  foreign key (last_provider_event_id) references public.digital_observer_payment_events(id) on delete set null;

alter table public.observer_invoices
  add column if not exists immutable_invoice_id text,
  add column if not exists invoice_state text not null default 'draft',
  add column if not exists provider_invoice_reference text,
  add column if not exists tax_document_status text not null default 'not_requested',
  add column if not exists finalized_at timestamptz,
  add column if not exists voided_at timestamptz,
  add column if not exists credited_amount_minor bigint not null default 0,
  add column if not exists credit_reference text;
alter table public.observer_invoices drop constraint if exists observer_invoices_invoice_state_check;
alter table public.observer_invoices add constraint observer_invoices_invoice_state_check
  check (invoice_state in ('draft','finalized','open','paid','past_due','void','credited','unknown'));
alter table public.observer_invoices drop constraint if exists observer_invoices_tax_document_status_check;
alter table public.observer_invoices add constraint observer_invoices_tax_document_status_check
  check (tax_document_status in ('not_requested','provider_pending','provider_confirmed','provider_failed','legal_review_required'));
alter table public.observer_invoices drop constraint if exists observer_invoices_credited_amount_check;
alter table public.observer_invoices add constraint observer_invoices_credited_amount_check check (credited_amount_minor >= 0);
create unique index if not exists observer_invoices_immutable_id_idx on public.observer_invoices(immutable_invoice_id) where immutable_invoice_id is not null;

create table if not exists public.digital_observer_refunds (
  id uuid primary key default gen_random_uuid(),
  stable_refund_id text not null unique,
  idempotency_key text not null,
  observer_site_id uuid not null references public.observer_sites(id) on delete restrict,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  payment_event_id uuid references public.digital_observer_payment_events(id) on delete restrict,
  invoice_id uuid references public.observer_invoices(id) on delete set null,
  refund_status text not null default 'requested' check (refund_status in ('requested','authorized','provider_pending','confirmed','failed','unknown','cancelled')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null,
  provider_reference text,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  authorized_by uuid references public.profiles(id) on delete restrict,
  safe_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id,idempotency_key)
);

create or replace function public.authorize_digital_observer_refund(
  p_stable_refund_id text, p_idempotency_key text, p_observer_site_id uuid, p_payment_event_id uuid,
  p_amount_minor bigint, p_currency text, p_safe_reason text, p_actor_profile_id uuid
) returns setof public.digital_observer_refunds
language plpgsql security definer set search_path=public set row_security=off as $$
declare
  payment public.digital_observer_payment_events%rowtype;
  prior_total bigint;
  invoice uuid;
  saved public.digital_observer_refunds%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'REFUND_SERVICE_ROLE_REQUIRED'; end if;
  select * into payment from public.digital_observer_payment_events where id=p_payment_event_id and observer_site_id=p_observer_site_id for update;
  if not found or payment.payment_outcome <> 'confirmed' then raise exception 'CONFIRMED_PAYMENT_REQUIRED'; end if;
  select * into saved from public.digital_observer_refunds where observer_site_id=p_observer_site_id and idempotency_key=p_idempotency_key;
  if found then return next saved; return; end if;
  if p_amount_minor <= 0 or p_currency <> payment.currency then raise exception 'REFUND_AMOUNT_INVALID'; end if;
  select coalesce(sum(amount_minor),0)::bigint into prior_total from public.digital_observer_refunds
    where payment_event_id=payment.id and refund_status in ('requested','authorized','provider_pending','confirmed','unknown');
  if prior_total + p_amount_minor > coalesce(payment.amount_minor,0) then raise exception 'REFUND_AMOUNT_INVALID'; end if;
  select id into invoice from public.observer_invoices
    where observer_site_id=p_observer_site_id and metadata @> jsonb_build_object('source_payment_event_id',payment.id) limit 1;
  insert into public.digital_observer_refunds(stable_refund_id,idempotency_key,observer_site_id,subscription_id,payment_event_id,invoice_id,
    refund_status,amount_minor,currency,requested_by,authorized_by,safe_reason)
  values(p_stable_refund_id,p_idempotency_key,p_observer_site_id,payment.subscription_id,payment.id,invoice,
    'authorized',p_amount_minor,p_currency,p_actor_profile_id,p_actor_profile_id,left(p_safe_reason,240)) returning * into saved;
  return next saved;
end;
$$;
revoke all on function public.authorize_digital_observer_refund(text,text,uuid,uuid,bigint,text,text,uuid) from public, anon, authenticated;
grant execute on function public.authorize_digital_observer_refund(text,text,uuid,uuid,bigint,text,text,uuid) to service_role;

create table if not exists public.digital_observer_entitlement_grants (
  id uuid primary key default gen_random_uuid(),
  stable_grant_id text not null unique,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  subscription_id uuid not null references public.observer_site_subscriptions(id) on delete cascade,
  plan_version_id uuid references public.digital_observer_plan_versions(id) on delete set null,
  entitlement_key text not null check (entitlement_key in ('sites','cameras','ai_processing','video_retention','evidence_storage','investigation','notifications','api_access','partner_features','white_label_features')),
  limit_value numeric,
  boolean_value boolean,
  grant_status text not null default 'active' check (grant_status in ('active','restricted','revoked','expired')),
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  source_payment_event_id uuid references public.digital_observer_payment_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subscription_id, entitlement_key)
);

insert into public.digital_observer_entitlement_grants(
  stable_grant_id,observer_site_id,subscription_id,entitlement_key,limit_value,boolean_value,grant_status,metadata
)
select 'package-snapshot:'||s.id::text||':'||e.key, s.observer_site_id, s.id, e.key,
  case when jsonb_typeof(e.value)='number' then (e.value#>>'{}')::numeric else null end,
  case when jsonb_typeof(e.value)='boolean' then (e.value#>>'{}')::boolean else null end,
  case when e.value in ('false'::jsonb,'null'::jsonb) then 'restricted' else 'active' end,
  '{"source":"push40_package_snapshot","verified_payment":false}'::jsonb
from public.observer_site_subscriptions s
cross join lateral jsonb_each(s.entitlement_snapshot) e
where e.key in ('sites','cameras','ai_processing','video_retention','evidence_storage','investigation','notifications','api_access','partner_features','white_label_features')
on conflict (subscription_id,entitlement_key) do nothing;

create table if not exists public.digital_observer_commercial_usage_events (
  id uuid primary key default gen_random_uuid(),
  stable_usage_id text not null unique,
  idempotency_key text not null unique,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  plan_version_id uuid references public.digital_observer_plan_versions(id) on delete set null,
  partner_billing_account_id uuid,
  service text not null,
  execution_target text,
  usage_category text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null,
  evidence_class text not null check (evidence_class in ('measured','allocated','estimated','unknown')),
  billing_period_start date not null,
  billing_period_end date not null,
  source_cost_usage_id uuid references public.digital_observer_cost_usage_events(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.digital_observer_partner_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  partner_key text not null unique,
  display_name text not null,
  account_status text not null default 'contract_pending' check (account_status in ('contract_pending','sandbox','active','suspended','closed')),
  wholesale_rate_contract jsonb not null default '{}'::jsonb,
  retail_pricing_controlled_by_partner boolean not null default true,
  settlement_currency text not null default 'ILS',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.digital_observer_commercial_usage_events
  add constraint digital_observer_commercial_usage_partner_fk foreign key (partner_billing_account_id) references public.digital_observer_partner_billing_accounts(id) on delete set null;

create table if not exists public.digital_observer_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  stable_reconciliation_id text not null unique,
  observer_site_id uuid references public.observer_sites(id) on delete restrict,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  provider_key text not null,
  period_start date not null,
  period_end date not null,
  reconciliation_status text not null check (reconciliation_status in ('reconciled','needs_review','unknown','failed')),
  payment_total_minor bigint,
  invoice_total_minor bigint,
  usage_total numeric,
  entitlement_consistent boolean,
  issues jsonb not null default '[]'::jsonb,
  evidence_class text not null default 'unknown' check (evidence_class in ('measured','allocated','estimated','unknown')),
  created_at timestamptz not null default now()
);

create table if not exists public.digital_observer_financial_audit (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
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

create index if not exists do_plan_versions_lookup_idx on public.digital_observer_plan_versions(package_id, pricing_status, effective_from desc);
create index if not exists do_checkout_site_status_idx on public.digital_observer_checkout_intents(observer_site_id, checkout_status, created_at desc);
create index if not exists do_payment_events_site_idx on public.digital_observer_payment_events(observer_site_id, created_at desc);
create index if not exists do_entitlements_site_idx on public.digital_observer_entitlement_grants(observer_site_id, entitlement_key, grant_status);
create index if not exists do_usage_site_period_idx on public.digital_observer_commercial_usage_events(observer_site_id, billing_period_start, usage_category);
create index if not exists do_usage_camera_period_idx on public.digital_observer_commercial_usage_events(camera_source_id, billing_period_start) where camera_source_id is not null;
create index if not exists do_reconciliation_site_period_idx on public.digital_observer_reconciliation_runs(observer_site_id, period_start desc);
create index if not exists do_financial_audit_site_idx on public.digital_observer_financial_audit(observer_site_id, created_at desc);

insert into public.digital_observer_plan_versions(package_id,version,commercial_segment,billing_period,price_minor,currency,pricing_status,included_entitlements,overage_policy,metadata)
select id,catalog_version,commercial_segment,'monthly',round(monthly_price*100)::bigint,currency,'unapproved',included_entitlements,overage_policy,'{"source":"legacy_catalog_snapshot","checkout_allowed":false}'::jsonb
from public.observer_monitoring_packages on conflict do nothing;
insert into public.digital_observer_plan_versions(package_id,version,commercial_segment,billing_period,price_minor,currency,pricing_status,included_entitlements,overage_policy,metadata)
select id,catalog_version,commercial_segment,'annual',round(annual_price*100)::bigint,currency,'unapproved',included_entitlements,overage_policy,'{"source":"legacy_catalog_snapshot","checkout_allowed":false}'::jsonb
from public.observer_monitoring_packages on conflict do nothing;

alter table public.digital_observer_plan_versions enable row level security;
alter table public.digital_observer_billing_accounts enable row level security;
alter table public.digital_observer_checkout_intents enable row level security;
alter table public.digital_observer_payment_events enable row level security;
alter table public.digital_observer_refunds enable row level security;
alter table public.digital_observer_entitlement_grants enable row level security;
alter table public.digital_observer_commercial_usage_events enable row level security;
alter table public.digital_observer_partner_billing_accounts enable row level security;
alter table public.digital_observer_reconciliation_runs enable row level security;
alter table public.digital_observer_financial_audit enable row level security;

-- Close the deferred PUSH 25 role leak: a billing-only membership is not operational
-- Site access and therefore cannot inherit camera, event, evidence or playback reads.
create or replace function public.can_access_observer_site(target_site_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select target_site_id is not null and (
    public.is_admin()
    or exists (select 1 from public.observer_sites s where s.id=target_site_id and (
      s.owner_profile_id=auth.uid() or (s.garden_id is not null and public.can_access_garden(s.garden_id))))
    or exists (select 1 from public.observer_site_memberships m where m.observer_site_id=target_site_id
      and m.profile_id=auth.uid() and m.active=true and m.member_role in ('owner','admin','operator','viewer','reviewer'))
  );
$$;

revoke all on function public.can_access_observer_site(uuid) from public;
grant execute on function public.can_access_observer_site(uuid) to authenticated, service_role;

create or replace function public.digital_observer_can_read_billing_site(target_site_id uuid)
returns boolean language sql stable security definer set search_path=public set row_security=off as $$
  select public.is_admin() or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id=target_site_id and m.profile_id=auth.uid() and m.active=true and m.member_role in ('owner','admin','billing')
  ) or exists (select 1 from public.observer_sites s where s.id=target_site_id and s.owner_profile_id=auth.uid() and s.garden_id is null and s.site_type <> 'kindergarten');
$$;

create or replace function public.digital_observer_billing_site_summary(target_site_id uuid)
returns table(id uuid, name text, site_type text, owner_profile_id uuid, timezone text)
language sql stable security definer set search_path=public set row_security=off as $$
  select s.id,s.name,s.site_type,s.owner_profile_id,s.timezone
  from public.observer_sites s
  where s.id=target_site_id and s.garden_id is null and s.site_type <> 'kindergarten'
    and public.digital_observer_can_read_billing_site(s.id);
$$;

create or replace function public.digital_observer_billing_sites()
returns table(id uuid, name text, site_type text, owner_profile_id uuid, timezone text)
language sql stable security definer set search_path=public set row_security=off as $$
  select s.id,s.name,s.site_type,s.owner_profile_id,s.timezone
  from public.observer_sites s
  where s.garden_id is null and s.site_type <> 'kindergarten'
    and public.digital_observer_can_read_billing_site(s.id)
  order by s.created_at desc;
$$;

revoke all on function public.digital_observer_can_read_billing_site(uuid) from public;
revoke all on function public.digital_observer_billing_site_summary(uuid) from public;
revoke all on function public.digital_observer_billing_sites() from public;
grant execute on function public.digital_observer_can_read_billing_site(uuid) to authenticated, service_role;
grant execute on function public.digital_observer_billing_site_summary(uuid) to authenticated, service_role;
grant execute on function public.digital_observer_billing_sites() to authenticated, service_role;

alter table public.digital_observer_action_intents drop constraint if exists do_action_intent_provenance_check;
alter table public.digital_observer_action_intents add constraint do_action_intent_provenance_check
  check (source_provenance in ('REAL_CAMERA_AI','HUMAN_AUTHORIZED','SYSTEM_HEALTH','WATCH_RULE_REVIEWED','SYSTEM_BILLING'));

create policy "do plan versions authenticated approved read" on public.digital_observer_plan_versions for select to authenticated
  using (pricing_status='approved' or public.is_admin());
create policy "do plan versions admin write" on public.digital_observer_plan_versions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "do billing accounts scoped read" on public.digital_observer_billing_accounts for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));
create policy "do checkout scoped read" on public.digital_observer_checkout_intents for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));
create policy "do payment events scoped read" on public.digital_observer_payment_events for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));
create policy "do refunds scoped read" on public.digital_observer_refunds for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));
create policy "do entitlements scoped read" on public.digital_observer_entitlement_grants for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));
create policy "do commercial usage scoped read" on public.digital_observer_commercial_usage_events for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));
create policy "do partner billing admin only" on public.digital_observer_partner_billing_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "do reconciliation admin only" on public.digital_observer_reconciliation_runs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "do financial audit admin read" on public.digital_observer_financial_audit for select to authenticated
  using (public.is_admin());

drop policy if exists "observer subscriptions billing scoped read" on public.observer_site_subscriptions;
create policy "observer subscriptions billing scoped read" on public.observer_site_subscriptions for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));
drop policy if exists "observer invoices push40 billing scoped read" on public.observer_invoices;
create policy "observer invoices push40 billing scoped read" on public.observer_invoices for select to authenticated
  using (observer_site_id is not null and public.digital_observer_can_read_billing_site(observer_site_id));
drop policy if exists "observer subscription changes billing scoped read" on public.observer_subscription_change_requests;
create policy "observer subscription changes billing scoped read" on public.observer_subscription_change_requests for select to authenticated
  using (public.digital_observer_can_read_billing_site(observer_site_id));

revoke insert, update, delete on public.digital_observer_billing_accounts, public.digital_observer_checkout_intents,
  public.digital_observer_payment_events, public.digital_observer_refunds, public.digital_observer_entitlement_grants,
  public.digital_observer_commercial_usage_events, public.digital_observer_reconciliation_runs,
  public.digital_observer_financial_audit from authenticated, anon;
revoke all on public.digital_observer_partner_billing_accounts from anon;
revoke all on public.digital_observer_plan_versions, public.digital_observer_billing_accounts,
  public.digital_observer_checkout_intents, public.digital_observer_payment_events, public.digital_observer_refunds,
  public.digital_observer_entitlement_grants, public.digital_observer_commercial_usage_events,
  public.digital_observer_partner_billing_accounts, public.digital_observer_reconciliation_runs,
  public.digital_observer_financial_audit from anon;

create or replace function public.block_digital_observer_financial_history_mutation()
returns trigger language plpgsql set search_path=public as $$
begin raise exception 'Digital Observer financial history is append-only'; end;
$$;
drop trigger if exists do_payment_events_block_update on public.digital_observer_payment_events;
create trigger do_payment_events_block_update before update or delete on public.digital_observer_payment_events
for each row execute function public.block_digital_observer_financial_history_mutation();
drop trigger if exists do_financial_audit_block_update on public.digital_observer_financial_audit;
create trigger do_financial_audit_block_update before update or delete on public.digital_observer_financial_audit
for each row execute function public.block_digital_observer_financial_history_mutation();

comment on table public.digital_observer_plan_versions is 'Versioned explicit Digital Observer commercial catalog. Legacy seeded prices remain unapproved and cannot activate checkout.';
comment on table public.digital_observer_checkout_intents is 'Idempotent server-created checkout lifecycle; client success never grants entitlements.';
comment on table public.digital_observer_payment_events is 'Authenticated provider event ledger. Unknown outcomes remain unknown until reconciliation.';
comment on table public.digital_observer_commercial_usage_events is 'Commercial attribution linked to PUSH 33 operational usage; measured/allocated/estimated/unknown remain distinct.';
comment on table public.digital_observer_partner_billing_accounts is 'Digital Observer wholesale/settlement boundary only; partner retail pricing remains partner-controlled and PUSH 43 owns hierarchy/provisioning.';

notify pgrst, 'reload schema';
