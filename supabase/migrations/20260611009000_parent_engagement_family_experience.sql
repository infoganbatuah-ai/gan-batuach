create table if not exists public.parent_engagement_events (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  event_type text not null,
  surface text not null,
  metשadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.parent_family_summary_snapshots (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  summary_period text not null,
  period_start date not null,
  period_end date not null,
  attendance_summary text,
  activity_summary text,
  meals_summary text,
  sleep_summary text,
  important_notes text,
  source_event_count integer not null default 0,
  approved_parent_visible_only boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_profile_id, child_id, summary_period, period_start)
);

alter table public.parent_engagement_events drop constraint if exists parent_engagement_events_type_check;
alter table public.parent_engagement_events add constraint parent_engagement_events_type_check check (event_type in (
  'daily_login',
  'timeline_view',
  'camera_view',
  'message_open',
  'document_approval',
  'notification_open',
  'gallery_view',
  'pickup_view',
  'payment_view',
  'trust_view'
));

alter table public.parent_family_summary_snapshots drop constraint if exists parent_family_summary_period_check;
alter table public.parent_family_summary_snapshots add constraint parent_family_summary_period_check check (summary_period in ('daily','weekly','monthly'));

create index if not exists parent_engagement_parent_time_idx on public.parent_engagement_events(parent_profile_id, occurred_at desc);
create index if not exists parent_engagement_child_time_idx on public.parent_engagement_events(child_id, occurred_at desc);
create index if not exists parent_family_summary_child_idx on public.parent_family_summary_snapshots(child_id, summary_period, period_start desc);

alter table public.parent_engagement_events enable row level security;
alter table public.parent_family_summary_snapshots enable row level security;

drop policy if exists "parent engagement own read" on public.parent_engagement_events;
create policy "parent engagement own read" on public.parent_engagement_events
  for select using (parent_profile_id = auth.uid() or public.is_admin());

drop policy if exists "parent engagement own insert" on public.parent_engagement_events;
create policy "parent engagement own insert" on public.parent_engagement_events
  for insert with check (parent_profile_id = auth.uid() or public.is_admin());

drop policy if exists "parent family summaries own read" on public.parent_family_summary_snapshots;
create policy "parent family summaries own read" on public.parent_family_summary_snapshots
  for select using (parent_profile_id = auth.uid() or public.is_admin());

drop policy if exists "parent family summaries scoped write" on public.parent_family_summary_snapshots;
create policy "parent family summaries scoped write" on public.parent_family_summary_snapshots
  for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

comment on table public.parent_engagement_events is 'Parent engagement readiness events. Stores product usage signals, never raw AI or internal investigation data.';
comment on table public.parent_family_summary_snapshots is 'Parent-friendly daily/weekly/monthly summaries generated from approved parent-visible child data only.';
