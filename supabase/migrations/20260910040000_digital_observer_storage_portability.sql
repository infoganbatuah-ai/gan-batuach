begin;

alter table public.digital_observer_event_clips
  add column if not exists storage_backend_id text,
  add column if not exists storage_backend_class text,
  add column if not exists clip_object_id text,
  add column if not exists thumbnail_object_id text,
  add column if not exists clip_sha256 text,
  add column if not exists thumbnail_sha256 text,
  add column if not exists storage_state text not null default 'LEGACY_COMPATIBILITY',
  add column if not exists legal_hold boolean not null default false,
  add column if not exists retention_policy_version integer not null default 1;

do $$ begin
  alter table public.digital_observer_event_clips add constraint digital_observer_event_clips_storage_backend_class_check
    check (storage_backend_class is null or storage_backend_class in ('CLOUD_OBJECT_STORAGE','LOCAL_NAS','ENTERPRISE_OBJECT_STORAGE','CUSTOMER_MANAGED_STORAGE'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.digital_observer_event_clips add constraint digital_observer_event_clips_storage_state_check
    check (storage_state in ('LEGACY_COMPATIBILITY','PENDING_UPLOAD','AVAILABLE','COPYING','VERIFYING','MIGRATED','FAILED','DELETED'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.digital_observer_event_clips add constraint digital_observer_event_clips_integrity_check
    check ((clip_sha256 is null or clip_sha256 ~ '^[a-f0-9]{64}$') and (thumbnail_sha256 is null or thumbnail_sha256 ~ '^[a-f0-9]{64}$'));
exception when duplicate_object then null; end $$;

create table if not exists public.observer_storage_backends (
  id text primary key,
  backend_class text not null,
  display_name text not null,
  tenant_id uuid references public.profiles(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  status text not null default 'ACTIVE',
  capabilities jsonb not null default '{}'::jsonb,
  policy jsonb not null default '{}'::jsonb,
  last_health_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_storage_backends_class_check check (backend_class in ('CLOUD_OBJECT_STORAGE','LOCAL_NAS','ENTERPRISE_OBJECT_STORAGE','CUSTOMER_MANAGED_STORAGE')),
  constraint observer_storage_backends_status_check check (status in ('ACTIVE','DEGRADED','OFFLINE','RETIRED')),
  constraint observer_storage_backends_scope_check check ((tenant_id is null and observer_site_id is null) or tenant_id is not null)
);

insert into public.observer_storage_backends (id, backend_class, display_name, capabilities, policy)
values ('supabase-private-evidence','CLOUD_OBJECT_STORAGE','Digital Observer private Evidence storage',
  '{"write":true,"read":true,"signed_access":true,"delete":true,"integrity":true}'::jsonb,
  '{"private":true,"fallback_requires_explicit_policy":true}'::jsonb)
on conflict (id) do update set backend_class=excluded.backend_class, display_name=excluded.display_name, capabilities=excluded.capabilities, policy=excluded.policy, updated_at=now();

create table if not exists public.observer_retention_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null,
  version integer not null,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  evidence_type text not null default 'EVENT_MEDIA',
  retention_days integer not null,
  legal_hold_allowed boolean not null default true,
  effective_at timestamptz not null default now(),
  retired_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(policy_key, version, tenant_id),
  constraint observer_retention_days_check check (retention_days between 1 and 3650)
);

create table if not exists public.observer_storage_migrations (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  evidence_clip_id uuid not null references public.digital_observer_event_clips(id) on delete cascade,
  source_backend_id text not null references public.observer_storage_backends(id),
  target_backend_id text not null references public.observer_storage_backends(id),
  state text not null default 'COPYING',
  source_object_id text not null,
  target_object_id text,
  expected_sha256 text not null,
  verified_at timestamptz,
  switched_at timestamptz,
  source_deleted_at timestamptz,
  failure_category text,
  attempts integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_storage_migrations_state_check check (state in ('COPYING','VERIFYING','MIGRATED','FAILED')),
  constraint observer_storage_migrations_backends_check check (source_backend_id <> target_backend_id),
  constraint observer_storage_migrations_hash_check check (expected_sha256 ~ '^[a-f0-9]{64}$')
);

create table if not exists public.observer_source_recording_references (
  id uuid primary key default gen_random_uuid(),
  contract_version text not null default 'observer-source-recording-reference-v1',
  tenant_id uuid not null references public.profiles(id) on delete cascade,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid not null references public.digital_observer_camera_sources(id) on delete cascade,
  source_system text not null,
  recording_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  retrieval_capability text not null,
  retention_available_until timestamptz,
  authorization_requirement text not null default 'TENANT_SITE_SOURCE_SCOPE',
  media_copied_to_digital_observer boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(tenant_id, source_system, recording_id),
  constraint observer_recording_reference_time_check check (ends_at > starts_at)
);

create index if not exists observer_storage_backends_scope_idx on public.observer_storage_backends(tenant_id,observer_site_id,status);
create index if not exists observer_retention_policy_scope_idx on public.observer_retention_policies(tenant_id,observer_site_id,evidence_type,effective_at desc);
create index if not exists observer_storage_migration_scope_idx on public.observer_storage_migrations(tenant_id,observer_site_id,state,updated_at);
create index if not exists observer_source_recording_time_idx on public.observer_source_recording_references(observer_site_id,camera_source_id,starts_at,ends_at);
create index if not exists digital_observer_event_clips_retention_portable_idx on public.digital_observer_event_clips(storage_backend_id,storage_state,legal_hold,delete_after);

alter table public.observer_storage_backends enable row level security;
alter table public.observer_retention_policies enable row level security;
alter table public.observer_storage_migrations enable row level security;
alter table public.observer_source_recording_references enable row level security;

create policy "observer storage backend scoped read" on public.observer_storage_backends for select using (
  public.is_admin() or (tenant_id=auth.uid()) or (observer_site_id is not null and public.can_access_observer_site(observer_site_id))
);
create policy "observer retention scoped read" on public.observer_retention_policies for select using (public.is_admin() or public.can_access_observer_site(observer_site_id));
create policy "observer storage migration scoped read" on public.observer_storage_migrations for select using (public.is_admin() or public.can_access_observer_site(observer_site_id));
create policy "observer source recording scoped read" on public.observer_source_recording_references for select using (public.is_admin() or public.can_access_observer_site(observer_site_id));

revoke all on public.observer_storage_backends, public.observer_retention_policies, public.observer_storage_migrations, public.observer_source_recording_references from anon;
grant select on public.observer_storage_backends, public.observer_retention_policies, public.observer_storage_migrations, public.observer_source_recording_references to authenticated;

comment on table public.observer_storage_backends is 'Safe provider registry for observer-storage-v1. Credentials and unrestricted paths are forbidden.';
comment on table public.observer_source_recording_references is 'Authorized reference to source-owned recordings; it is not Event Evidence and contains no retrieval credential.';
comment on column public.digital_observer_event_clips.legal_hold is 'A true value blocks retention deletion. Full legal case management is outside PUSH 34.';

commit;
