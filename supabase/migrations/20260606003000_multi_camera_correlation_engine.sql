create table if not exists public.observer_correlated_events (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  correlation_type text not null,
  severity text not null default 'medium',
  confidence numeric(5, 4) not null default 0,
  status text not null default 'open',
  start_time timestamptz,
  end_time timestamptz,
  entry_zone_id uuid references public.camera_zones(id) on delete set null,
  destination_zone_id uuid references public.camera_zones(id) on delete set null,
  involved_camera_ids uuid[] not null default '{}'::uuid[],
  involved_zone_ids uuid[] not null default '{}'::uuid[],
  timeline_summary jsonb not null default '[]'::jsonb,
  confidence_factors jsonb not null default '{}'::jsonb,
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_correlated_events_scope_check check (observer_site_id is not null or kindergarten_id is not null),
  constraint observer_correlated_events_type_check check (correlation_type in (
    'multi_camera_timeline',
    'cross_camera_confirmation',
    'audio_video_correlation',
    'pickup_path_correlation',
    'watch_request_correlation',
    'safety_event_correlation',
    'camera_health_correlation',
    'mock_correlation'
  )),
  constraint observer_correlated_events_severity_check check (severity in ('info','low','medium','high','urgent','critical')),
  constraint observer_correlated_events_status_check check (status in ('open','reviewing','confirmed','dismissed','escalated','false_positive','needs_more_data')),
  constraint observer_correlated_events_confidence_check check (confidence between 0 and 1)
);

create table if not exists public.observer_correlated_event_links (
  id uuid primary key default gen_random_uuid(),
  correlated_event_id uuid not null references public.observer_correlated_events(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_id uuid references public.camera_zones(id) on delete set null,
  event_time timestamptz,
  confidence numeric(5, 4),
  sequence_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_correlated_event_links_source_check check (source_type in (
    'ai_camera_event',
    'audio_observer_event',
    'safety_incident',
    'pickup_event',
    'watch_request_event',
    'camera_health',
    'mock'
  )),
  constraint observer_correlated_event_links_confidence_check check (confidence is null or confidence between 0 and 1)
);

create unique index if not exists observer_correlated_event_links_unique
  on public.observer_correlated_event_links(correlated_event_id, source_type, source_id);

create index if not exists observer_correlated_events_kindergarten_status_idx
  on public.observer_correlated_events(kindergarten_id, status, created_at desc);

create index if not exists observer_correlated_events_site_status_idx
  on public.observer_correlated_events(observer_site_id, status, created_at desc);

create index if not exists observer_correlated_events_type_idx
  on public.observer_correlated_events(correlation_type, severity, created_at desc);

create index if not exists observer_correlated_event_links_event_idx
  on public.observer_correlated_event_links(correlated_event_id, sequence_order);

create index if not exists observer_correlated_event_links_source_idx
  on public.observer_correlated_event_links(source_type, source_id);

create index if not exists observer_correlated_event_links_camera_zone_idx
  on public.observer_correlated_event_links(camera_id, zone_id, event_time);

alter table public.observer_correlated_events enable row level security;
alter table public.observer_correlated_event_links enable row level security;

drop policy if exists "correlated events scoped read" on public.observer_correlated_events;
create policy "correlated events scoped read" on public.observer_correlated_events
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_correlated_events.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "correlated events scoped write" on public.observer_correlated_events;
create policy "correlated events scoped write" on public.observer_correlated_events
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_correlated_events.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
)
with check (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_correlated_events.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "correlated event links scoped read" on public.observer_correlated_event_links;
create policy "correlated event links scoped read" on public.observer_correlated_event_links
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_correlated_event_links.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "correlated event links scoped write" on public.observer_correlated_event_links;
create policy "correlated event links scoped write" on public.observer_correlated_event_links
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_correlated_event_links.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
)
with check (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_correlated_event_links.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

comment on table public.observer_correlated_events is 'Multi-camera and multi-sensor correlation readiness. Correlation is event-level only: no identity recognition, no biometric tracking, no child or staff profiling.';
comment on table public.observer_correlated_event_links is 'Links reviewed/source events into a single timeline. Source links must not imply identity tracking.';
comment on column public.observer_correlated_events.timeline_summary is 'Ordered event timeline for human review. No biometric path tracking.';
comment on column public.observer_correlated_events.confidence_factors is 'Mock confidence factors such as camera count and sensor diversity. Human review required.';

notify pgrst, 'reload schema';
