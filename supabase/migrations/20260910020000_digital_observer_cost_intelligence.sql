-- PUSH 33: operational cost intelligence. This is not customer pricing or billing.
create table if not exists public.digital_observer_cost_rate_catalogs (
  id uuid primary key default gen_random_uuid(),
  catalog_key text not null,
  version text not null,
  provider_id text not null,
  resource_type text not null,
  unit text not null,
  currency text not null,
  unit_cost numeric(24,12) not null check (unit_cost >= 0),
  attribution_quality text not null,
  source text not null,
  effective_at timestamptz not null,
  expires_at timestamptz,
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_cost_rate_resource_check check (resource_type in ('AI_INFERENCE','CPU_COMPUTE','GPU_COMPUTE','EDGE_COMPUTE','BANDWIDTH_INGRESS','BANDWIDTH_EGRESS','STORAGE','EVIDENCE_STORAGE','DATABASE','PLATFORM_HOSTING','NOTIFICATION','EXTERNAL_PROVIDER')),
  constraint observer_cost_rate_quality_check check (attribution_quality in ('DIRECTLY_METERED','PROVIDER_RECONCILED','ESTIMATED')),
  constraint observer_cost_rate_currency_check check (currency ~ '^[A-Z]{3}$'),
  unique(catalog_key, version, provider_id, resource_type, unit, currency)
);

create table if not exists public.digital_observer_cost_usage_events (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null default 'observer-cost-usage-v1',
  idempotency_key text not null unique,
  resource_type text not null,
  provider_id text not null,
  observer_tenant_id uuid not null,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  ai_job_id text,
  model text,
  model_version text,
  execution_target_id text,
  execution_target_class text,
  quantity numeric(24,8) not null check (quantity >= 0),
  unit text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  rate_catalog_id uuid references public.digital_observer_cost_rate_catalogs(id) on delete set null,
  rate_version text,
  unit_cost numeric(24,12),
  calculated_cost numeric(24,12),
  currency text not null,
  attribution_quality text not null,
  allocation_scope jsonb,
  reconciliation_id uuid,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_cost_usage_resource_check check (resource_type in ('AI_INFERENCE','CPU_COMPUTE','GPU_COMPUTE','EDGE_COMPUTE','BANDWIDTH_INGRESS','BANDWIDTH_EGRESS','STORAGE','EVIDENCE_STORAGE','DATABASE','PLATFORM_HOSTING','NOTIFICATION','EXTERNAL_PROVIDER')),
  constraint observer_cost_usage_quality_check check (attribution_quality in ('DIRECTLY_METERED','PROVIDER_RECONCILED','ALLOCATED','ESTIMATED','UNKNOWN')),
  constraint observer_cost_usage_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint observer_cost_usage_window_check check (window_end >= window_start),
  constraint observer_cost_usage_no_customer_price check (coalesce(provenance->>'customer_price', '') = '')
);

create table if not exists public.digital_observer_cost_reconciliations (
  id uuid primary key default gen_random_uuid(),
  provider_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  currency text not null,
  calculated_cost numeric(24,12) not null check (calculated_cost >= 0),
  actual_provider_cost numeric(24,12) not null check (actual_provider_cost >= 0),
  variance numeric(24,12) not null,
  approved_tolerance numeric(24,12),
  source_reference text not null,
  status text not null,
  reconciled_by uuid references public.profiles(id) on delete set null,
  reconciled_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint observer_cost_reconciliation_status_check check (status in ('RECONCILED','OUTSIDE_APPROVED_TOLERANCE','NOT_RECONCILED')),
  constraint observer_cost_reconciliation_period_check check (period_end >= period_start)
);

create index if not exists observer_cost_usage_tenant_window_idx on public.digital_observer_cost_usage_events(observer_tenant_id, window_start desc);
create index if not exists observer_cost_usage_site_window_idx on public.digital_observer_cost_usage_events(observer_site_id, window_start desc);
create index if not exists observer_cost_usage_source_window_idx on public.digital_observer_cost_usage_events(camera_source_id, window_start desc) where camera_source_id is not null;
create index if not exists observer_cost_usage_job_idx on public.digital_observer_cost_usage_events(ai_job_id) where ai_job_id is not null;
create index if not exists observer_cost_usage_target_idx on public.digital_observer_cost_usage_events(execution_target_id, window_start desc) where execution_target_id is not null;
create index if not exists observer_cost_rate_lookup_idx on public.digital_observer_cost_rate_catalogs(provider_id, resource_type, unit, currency, effective_at desc);

alter table public.digital_observer_cost_rate_catalogs enable row level security;
alter table public.digital_observer_cost_usage_events enable row level security;
alter table public.digital_observer_cost_reconciliations enable row level security;

drop policy if exists "observer cost rates platform admin read" on public.digital_observer_cost_rate_catalogs;
create policy "observer cost rates platform admin read" on public.digital_observer_cost_rate_catalogs for select using (public.is_admin());
drop policy if exists "observer cost rates platform admin write" on public.digital_observer_cost_rate_catalogs;
create policy "observer cost rates platform admin write" on public.digital_observer_cost_rate_catalogs for insert with check (public.is_admin());

drop policy if exists "observer cost usage platform admin read" on public.digital_observer_cost_usage_events;
create policy "observer cost usage platform admin read" on public.digital_observer_cost_usage_events for select using (public.is_admin());
drop policy if exists "observer cost usage platform admin ingest" on public.digital_observer_cost_usage_events;
create policy "observer cost usage platform admin ingest" on public.digital_observer_cost_usage_events for insert with check (public.is_admin());

drop policy if exists "observer cost reconciliation platform admin read" on public.digital_observer_cost_reconciliations;
create policy "observer cost reconciliation platform admin read" on public.digital_observer_cost_reconciliations for select using (public.is_admin());
drop policy if exists "observer cost reconciliation platform admin write" on public.digital_observer_cost_reconciliations;
create policy "observer cost reconciliation platform admin write" on public.digital_observer_cost_reconciliations for insert with check (public.is_admin());

comment on table public.digital_observer_cost_usage_events is 'Append-oriented operational resource usage and attributed infrastructure cost. Never customer price or billing action.';
comment on table public.digital_observer_cost_rate_catalogs is 'Versioned provider/measured/estimated operational cost rates; no signing or provider credentials.';
comment on table public.digital_observer_cost_reconciliations is 'Explicit calculated-versus-provider cost reconciliation evidence with approved tolerance when one exists.';

notify pgrst, 'reload schema';
