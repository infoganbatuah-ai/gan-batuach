-- PUSH 42 — External API, webhook and integration platform.
-- Additive Development schema only. No external provider, customer destination or Production activation.

alter table public.digital_observer_webhook_endpoints
  add column if not exists organization_id uuid references public.digital_observer_organizations(id) on delete cascade,
  add column if not exists service_account_id uuid references public.digital_observer_service_accounts(id) on delete set null;

create index if not exists do_webhook_endpoint_org_idx
  on public.digital_observer_webhook_endpoints(organization_id,observer_site_id,active)
  where organization_id is not null;

create table if not exists public.digital_observer_external_api_request_receipts (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  credential_id uuid not null references public.digital_observer_service_account_credentials(id) on delete cascade,
  service_account_id uuid not null references public.digital_observer_service_accounts(id) on delete cascade,
  request_nonce text not null,
  method text not null,
  request_path text not null,
  request_hash text not null,
  idempotency_key text,
  result_status text not null default 'accepted',
  response_status integer,
  response_hash text,
  created_at timestamptz not null default now(),
  delete_after timestamptz not null default (now() + interval '7 days'),
  unique(credential_id,request_nonce),
  constraint do_external_api_method_check check (method in ('GET','POST','PATCH','DELETE')),
  constraint do_external_api_hash_check check (request_hash ~ '^[a-f0-9]{64}$' and (response_hash is null or response_hash ~ '^[a-f0-9]{64}$')),
  constraint do_external_api_result_check check (result_status in ('accepted','completed','denied','failed','unknown')),
  constraint do_external_api_retention_check check (delete_after > created_at and delete_after <= created_at + interval '7 days')
);

create unique index if not exists do_external_api_idempotency_idx
  on public.digital_observer_external_api_request_receipts(service_account_id,method,request_path,idempotency_key)
  where idempotency_key is not null;
create index if not exists do_external_api_request_retention_idx
  on public.digital_observer_external_api_request_receipts(delete_after);
create index if not exists do_external_api_request_rate_idx
  on public.digital_observer_external_api_request_receipts(service_account_id,created_at desc);

create table if not exists public.digital_observer_external_api_usage_buckets (
  id uuid primary key default gen_random_uuid(),
  service_account_id uuid not null references public.digital_observer_service_accounts(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  operation text not null,
  bucket_start timestamptz not null,
  request_count bigint not null default 0,
  success_count bigint not null default 0,
  failure_count bigint not null default 0,
  measured boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_account_id,observer_site_id,operation,bucket_start),
  constraint do_external_api_usage_count_check check (request_count >= 0 and success_count >= 0 and failure_count >= 0),
  constraint do_external_api_usage_balance_check check (success_count + failure_count = request_count)
);
create index if not exists do_external_api_usage_site_idx
  on public.digital_observer_external_api_usage_buckets(observer_site_id,bucket_start desc);

create table if not exists public.digital_observer_external_integration_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.digital_observer_organizations(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  integration_kind text not null,
  display_name text not null,
  provider_key text not null,
  provider_mode text not null default 'disabled',
  connection_status text not null default 'not_configured',
  capability_manifest jsonb not null default '{}'::jsonb,
  deep_link_template text,
  credential_reference text,
  real_proof_status text not null default 'not_proven',
  last_health_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id,provider_key),
  constraint do_external_source_kind_check check (integration_kind in ('dvr','nvr','vms','vendor_cloud','vendor_p2p','manufacturer','recording_system','federated_api')),
  constraint do_external_source_mode_check check (provider_mode in ('disabled','sandbox')),
  constraint do_external_source_status_check check (connection_status in ('not_configured','configured_inactive','connected','degraded','revoked')),
  constraint do_external_source_proof_check check (real_proof_status in ('not_proven','sandbox_proven','real_proven')),
  constraint do_external_source_secret_check check (credential_reference is null or credential_reference like 'secret://%'),
  constraint do_external_source_link_check check (deep_link_template is null or deep_link_template like 'https://%')
);
create index if not exists do_external_source_org_idx
  on public.digital_observer_external_integration_sources(organization_id,observer_site_id,connection_status);

alter table public.digital_observer_external_api_request_receipts enable row level security;
alter table public.digital_observer_external_api_usage_buckets enable row level security;
alter table public.digital_observer_external_integration_sources enable row level security;

create policy "do external api usage scoped read" on public.digital_observer_external_api_usage_buckets for select to authenticated
  using (public.digital_observer_has_org_permission(
    (select s.digital_observer_organization_id from public.observer_sites s where s.id=observer_site_id),
    'audit.read', observer_site_id));
create policy "do external sources scoped read" on public.digital_observer_external_integration_sources for select to authenticated
  using (public.digital_observer_has_org_permission(organization_id,'camera.live.view',observer_site_id));

revoke all on public.digital_observer_external_api_request_receipts from anon, authenticated;
revoke all on public.digital_observer_external_api_usage_buckets from anon;
revoke insert, update, delete on public.digital_observer_external_api_usage_buckets from authenticated;
revoke all on public.digital_observer_external_integration_sources from anon;
revoke insert, update, delete on public.digital_observer_external_integration_sources from authenticated;
grant select on public.digital_observer_external_api_usage_buckets, public.digital_observer_external_integration_sources to authenticated;

create or replace function public.record_digital_observer_external_api_usage(
  requested_service_account_id uuid,
  requested_site_id uuid,
  requested_operation text,
  requested_bucket_start timestamptz,
  requested_success boolean
) returns uuid language plpgsql security definer set search_path=public set row_security=off as $$
declare result_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'external api usage is server-only'; end if;
  if not exists (
    select 1 from public.digital_observer_service_accounts a
    join public.observer_sites s on s.digital_observer_organization_id=a.organization_id
    where a.id=requested_service_account_id and s.id=requested_site_id
  ) then raise exception 'service account/site mismatch'; end if;
  insert into public.digital_observer_external_api_usage_buckets(
    service_account_id,observer_site_id,operation,bucket_start,request_count,success_count,failure_count
  ) values (
    requested_service_account_id,requested_site_id,left(requested_operation,160),date_trunc('hour',requested_bucket_start),1,
    case when requested_success then 1 else 0 end,case when requested_success then 0 else 1 end
  ) on conflict(service_account_id,observer_site_id,operation,bucket_start) do update set
    request_count=digital_observer_external_api_usage_buckets.request_count+1,
    success_count=digital_observer_external_api_usage_buckets.success_count+case when requested_success then 1 else 0 end,
    failure_count=digital_observer_external_api_usage_buckets.failure_count+case when requested_success then 0 else 1 end,
    updated_at=now()
  returning id into result_id;
  return result_id;
end;
$$;
revoke all on function public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean) to service_role;

comment on table public.digital_observer_external_api_request_receipts is 'Seven-day replay/idempotency receipts. No raw credential, payload, private media or customer secret is stored.';
comment on table public.digital_observer_external_api_usage_buckets is 'Hourly measured API usage for entitlement, rate and cost attribution; no fabricated provider usage.';
comment on table public.digital_observer_external_integration_sources is 'Truthful DVR/NVR/VMS/vendor/federation capability registry. Disabled by default and never implies universal compatibility or real proof.';
