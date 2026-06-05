-- UX-4: first-time user onboarding progress foundation.

create table if not exists public.onboarding_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  garden_id uuid references public.gardens(id) on delete cascade,
  profile_completed boolean not null default false,
  setup_completed boolean not null default false,
  cameras_configured boolean not null default false,
  observer_configured boolean not null default false,
  notifications_configured boolean not null default false,
  documents_completed boolean not null default false,
  completed_steps text[] not null default '{}'::text[],
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  demo_batch_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_progress add column if not exists profile_id uuid references public.profiles(id) on delete cascade;
alter table public.onboarding_progress add column if not exists role text;
alter table public.onboarding_progress add column if not exists garden_id uuid references public.gardens(id) on delete cascade;
alter table public.onboarding_progress add column if not exists profile_completed boolean not null default false;
alter table public.onboarding_progress add column if not exists setup_completed boolean not null default false;
alter table public.onboarding_progress add column if not exists cameras_configured boolean not null default false;
alter table public.onboarding_progress add column if not exists observer_configured boolean not null default false;
alter table public.onboarding_progress add column if not exists notifications_configured boolean not null default false;
alter table public.onboarding_progress add column if not exists documents_completed boolean not null default false;
alter table public.onboarding_progress add column if not exists completed_steps text[] not null default '{}'::text[];
alter table public.onboarding_progress add column if not exists progress_percent integer not null default 0;
alter table public.onboarding_progress add column if not exists first_seen_at timestamptz not null default now();
alter table public.onboarding_progress add column if not exists last_seen_at timestamptz not null default now();
alter table public.onboarding_progress add column if not exists completed_at timestamptz;
alter table public.onboarding_progress add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.onboarding_progress add column if not exists is_demo boolean not null default false;
alter table public.onboarding_progress add column if not exists demo_batch_id text;
alter table public.onboarding_progress add column if not exists created_at timestamptz not null default now();
alter table public.onboarding_progress add column if not exists updated_at timestamptz not null default now();

create unique index if not exists onboarding_progress_profile_unique_idx
  on public.onboarding_progress(profile_id);

create index if not exists onboarding_progress_garden_idx
  on public.onboarding_progress(garden_id, role, setup_completed);

create index if not exists onboarding_progress_role_idx
  on public.onboarding_progress(role, setup_completed, last_seen_at desc);

alter table public.onboarding_progress enable row level security;

drop policy if exists "onboarding progress scoped read" on public.onboarding_progress;
create policy "onboarding progress scoped read"
on public.onboarding_progress
for select
using (
  public.is_admin()
  or profile_id = auth.uid()
  or public.can_access_garden(garden_id)
);

drop policy if exists "onboarding progress scoped insert" on public.onboarding_progress;
create policy "onboarding progress scoped insert"
on public.onboarding_progress
for insert
with check (
  public.is_admin()
  or profile_id = auth.uid()
  or public.can_access_garden(garden_id)
);

drop policy if exists "onboarding progress scoped update" on public.onboarding_progress;
create policy "onboarding progress scoped update"
on public.onboarding_progress
for update
using (
  public.is_admin()
  or profile_id = auth.uid()
  or public.can_access_garden(garden_id)
)
with check (
  public.is_admin()
  or profile_id = auth.uid()
  or public.can_access_garden(garden_id)
);

notify pgrst, 'reload schema';
