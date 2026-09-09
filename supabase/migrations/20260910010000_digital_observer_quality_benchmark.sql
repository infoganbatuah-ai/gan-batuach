-- PUSH 28: immutable, tenant-safe quality benchmark dataset/run ledger.
create table if not exists public.digital_observer_benchmark_datasets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  observer_site_id uuid references public.observer_sites(id) on delete restrict,
  dataset_key text not null,
  dataset_version text not null,
  dataset_kind text not null check (dataset_kind in ('DETERMINISTIC_QA','REVIEWED_REAL_PRODUCT','PILOT','SYNTHETIC')),
  provenance jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  inclusion_policy text not null,
  exclusion_policy text not null,
  ground_truth_status text not null check (ground_truth_status in ('REVIEWED','PARTIAL','NONE')),
  sample_count integer not null check (sample_count >= 0),
  sealed_at timestamptz,
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dataset_key, dataset_version, tenant_id, observer_site_id)
);

create table if not exists public.digital_observer_benchmark_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  dataset_id uuid not null references public.digital_observer_benchmark_datasets(id) on delete restrict,
  tenant_id uuid,
  observer_site_id uuid references public.observer_sites(id) on delete restrict,
  benchmark_contract text not null,
  model_version text not null,
  benchmark_configuration jsonb not null,
  metrics jsonb not null,
  limitations jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists digital_observer_benchmark_datasets_scope_idx
  on public.digital_observer_benchmark_datasets (tenant_id, observer_site_id, dataset_kind, created_at desc);
create unique index if not exists digital_observer_benchmark_datasets_scope_version_uidx
  on public.digital_observer_benchmark_datasets (dataset_key, dataset_version, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(observer_site_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists digital_observer_benchmark_runs_scope_idx
  on public.digital_observer_benchmark_runs (tenant_id, observer_site_id, model_version, completed_at desc);

alter table public.digital_observer_benchmark_datasets enable row level security;
alter table public.digital_observer_benchmark_runs enable row level security;

-- Intentionally no authenticated direct-write policy. Benchmark publication is
-- performed only by the audited server-side quality service after authorization.
revoke all on public.digital_observer_benchmark_datasets from anon, authenticated;
revoke all on public.digital_observer_benchmark_runs from anon, authenticated;
grant all on public.digital_observer_benchmark_datasets, public.digital_observer_benchmark_runs to service_role;

create or replace function public.prevent_sealed_benchmark_dataset_mutation()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.sealed_at is not null then
    raise exception 'SEALED_BENCHMARK_DATASET_IMMUTABLE';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists digital_observer_benchmark_dataset_immutable on public.digital_observer_benchmark_datasets;
create trigger digital_observer_benchmark_dataset_immutable
before update or delete on public.digital_observer_benchmark_datasets
for each row execute function public.prevent_sealed_benchmark_dataset_mutation();

create or replace function public.prevent_benchmark_run_mutation()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  raise exception 'PUBLISHED_BENCHMARK_RUN_IMMUTABLE';
end;
$$;
drop trigger if exists digital_observer_benchmark_run_immutable on public.digital_observer_benchmark_runs;
create trigger digital_observer_benchmark_run_immutable before update or delete on public.digital_observer_benchmark_runs
for each row execute function public.prevent_benchmark_run_mutation();

comment on table public.digital_observer_benchmark_datasets is 'Versioned, sealable PUSH 28 dataset metadata; never stores raw video by default.';
comment on table public.digital_observer_benchmark_runs is 'Reproducible benchmark results keyed by dataset, model and configuration.';
