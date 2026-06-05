-- UX-5: pilot feedback and readiness foundation.

do $$ begin
  create type public.pilot_feedback_category as enum (
    'onboarding',
    'dashboard',
    'cameras',
    'observer',
    'finance',
    'staff',
    'children',
    'parent_experience',
    'inspections',
    'performance',
    'bug_report',
    'feature_request'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pilot_feedback_status as enum ('open', 'in_progress', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.pilot_issue_severity as enum ('critical', 'major', 'minor');
exception when duplicate_object then null;
end $$;

create table if not exists public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  user_role text not null,
  garden_id uuid references public.gardens(id) on delete set null,
  category public.pilot_feedback_category not null default 'dashboard',
  rating integer not null default 0 check (rating >= -1 and rating <= 5),
  sentiment text not null default 'neutral' check (sentiment in ('easy', 'confusing', 'neutral')),
  comment text,
  page_path text,
  status public.pilot_feedback_status not null default 'open',
  severity public.pilot_issue_severity not null default 'minor',
  metadata jsonb not null default '{}'::jsonb,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create index if not exists pilot_feedback_status_idx
  on public.pilot_feedback(status, severity, created_at desc);

create index if not exists pilot_feedback_role_category_idx
  on public.pilot_feedback(user_role, category, created_at desc);

create index if not exists pilot_feedback_garden_idx
  on public.pilot_feedback(garden_id, status, created_at desc);

create table if not exists public.pilot_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  onboarding_completion numeric(5,2) not null default 0,
  first_login_completion numeric(5,2) not null default 0,
  active_usage numeric(5,2) not null default 0,
  feature_adoption jsonb not null default '{}'::jsonb,
  unfinished_setup_count integer not null default 0,
  unresolved_feedback_count integer not null default 0,
  readiness_scores jsonb not null default '{}'::jsonb,
  friction_points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(snapshot_date)
);

alter table public.pilot_feedback enable row level security;
alter table public.pilot_readiness_snapshots enable row level security;

drop policy if exists "pilot feedback scoped read" on public.pilot_feedback;
create policy "pilot feedback scoped read"
on public.pilot_feedback
for select
using (
  public.is_admin()
  or profile_id = auth.uid()
  or public.can_access_garden(garden_id)
);

drop policy if exists "pilot feedback scoped insert" on public.pilot_feedback;
create policy "pilot feedback scoped insert"
on public.pilot_feedback
for insert
with check (
  profile_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "pilot feedback admin update" on public.pilot_feedback;
create policy "pilot feedback admin update"
on public.pilot_feedback
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "pilot readiness admin read" on public.pilot_readiness_snapshots;
create policy "pilot readiness admin read"
on public.pilot_readiness_snapshots
for select
using (public.is_admin());

drop policy if exists "pilot readiness admin write" on public.pilot_readiness_snapshots;
create policy "pilot readiness admin write"
on public.pilot_readiness_snapshots
for all
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';
