-- PUSH 19: signed edge releases, staged rollout and device update state.
create table if not exists public.observer_edge_releases (
  id uuid primary key default gen_random_uuid(),
  release_id text not null unique check (release_id ~ '^[A-Za-z0-9._:-]{3,160}$'),
  version text not null, build_sha text not null,
  channel text not null check (channel in ('INTERNAL','CANARY','STABLE')),
  platform text not null, architecture text not null check (architecture in ('arm64','x64')),
  deployment_profile text not null check (deployment_profile in ('SOFTWARE_CONNECTOR','PHYSICAL_GATEWAY','ENTERPRISE_EDGE')),
  signed_manifest jsonb not null, artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  signing_key_id text not null, release_state text not null default 'PUBLISHED' check (release_state in ('PUBLISHED','RETIRED','DISABLED')),
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.observer_edge_rollouts (
  id uuid primary key default gen_random_uuid(), release_id uuid not null references public.observer_edge_releases(id),
  stage text not null check (stage in ('INTERNAL_QA','CANARY','SMALL_COHORT','BROADER_COHORT','GENERAL')),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','PAUSED','COMPLETED','FAILED')),
  cohort_percent integer not null check (cohort_percent between 0 and 100), target_filters jsonb not null default '{}'::jsonb,
  canary_failure_threshold integer not null default 1 check (canary_failure_threshold > 0),
  attempted_count integer not null default 0, healthy_count integer not null default 0, failed_count integer not null default 0,
  rollback_count integer not null default 0, paused_reason text, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.observer_edge_device_updates (
  id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references public.video_gateway_device_enrollments(id),
  release_id uuid not null references public.observer_edge_releases(id), rollout_id uuid references public.observer_edge_rollouts(id),
  state text not null check (state in ('IDLE','UPDATE_AVAILABLE','DOWNLOADING','VERIFYING','STAGED','INSTALLING','RESTARTING','VERIFYING_HEALTH','HEALTHY','ROLLBACK_REQUIRED','ROLLING_BACK','ROLLED_BACK','UPDATE_FAILED')),
  current_version text not null, target_version text, known_good_version text not null, failure_category text,
  safe_metadata jsonb not null default '{}'::jsonb, first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  unique (enrollment_id, release_id)
);

create index if not exists observer_edge_rollouts_active_idx on public.observer_edge_rollouts(status, stage, created_at desc);
create index if not exists observer_edge_updates_state_idx on public.observer_edge_device_updates(state, last_seen_at desc);

alter table public.observer_edge_releases enable row level security;
alter table public.observer_edge_rollouts enable row level security;
alter table public.observer_edge_device_updates enable row level security;
revoke all on public.observer_edge_releases, public.observer_edge_rollouts, public.observer_edge_device_updates from anon, authenticated;
grant all on public.observer_edge_releases, public.observer_edge_rollouts, public.observer_edge_device_updates to service_role;

create or replace function public.guard_published_edge_release()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.release_state = 'PUBLISHED' and (
    new.release_id is distinct from old.release_id or new.version is distinct from old.version or
    new.build_sha is distinct from old.build_sha or new.signed_manifest is distinct from old.signed_manifest or
    new.artifact_sha256 is distinct from old.artifact_sha256 or new.signing_key_id is distinct from old.signing_key_id or
    new.platform is distinct from old.platform or new.architecture is distinct from old.architecture or
    new.deployment_profile is distinct from old.deployment_profile
  ) then raise exception 'PUBLISHED_EDGE_RELEASE_IMMUTABLE'; end if;
  new.updated_at = now(); return new;
end $$;
drop trigger if exists guard_published_edge_release_trigger on public.observer_edge_releases;
create trigger guard_published_edge_release_trigger before update on public.observer_edge_releases
for each row execute function public.guard_published_edge_release();
