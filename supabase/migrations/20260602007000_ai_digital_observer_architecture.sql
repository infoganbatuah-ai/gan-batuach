create table if not exists public.ai_camera_events (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid not null references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  event_type text not null,
  severity text not null default 'medium',
  title text not null,
  description text,
  status text not null default 'open',
  confidence_score numeric(5, 4),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  clip_url text,
  snapshot_url text,
  pre_event_seconds integer,
  post_event_seconds integer,
  retention_days integer,
  detected_entities jsonb not null default '[]'::jsonb,
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  escalated_to_role text,
  parent_visible boolean not null default false,
  dedupe_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text,
  constraint ai_camera_events_type_check check (event_type in ('person_detected','unauthorized_person','child_missing_from_area','restricted_area_entry','fall_suspected','crowding_suspected','gate_or_door_open','pickup_mismatch','staff_behavior_concern','distress_suspected','violence_indicator','audio_anomaly','keyword_detected','camera_tampering','camera_offline')),
  constraint ai_camera_events_severity_check check (severity in ('info', 'low', 'medium', 'high', 'urgent', 'critical')),
  constraint ai_camera_events_status_check check (status in ('open', 'reviewing', 'confirmed', 'dismissed', 'escalated'))
);

create index if not exists idx_ai_camera_events_kindergarten_status on public.ai_camera_events(kindergarten_id, status, created_at desc);
create index if not exists idx_ai_camera_events_camera on public.ai_camera_events(camera_id, created_at desc);
create index if not exists idx_ai_camera_events_type on public.ai_camera_events(event_type, created_at desc);
create unique index if not exists idx_ai_camera_events_dedupe on public.ai_camera_events(dedupe_key) where dedupe_key is not null and btrim(dedupe_key) <> '';

alter table public.ai_camera_events enable row level security;

drop policy if exists "ai camera events scoped read" on public.ai_camera_events;
create policy "ai camera events scoped read" on public.ai_camera_events
for select using (
  public.is_admin()
  or (public.current_role() in ('manager', 'owner', 'inspector') and public.can_access_garden(kindergarten_id))
);

drop policy if exists "ai camera events scoped insert" on public.ai_camera_events;
create policy "ai camera events scoped insert" on public.ai_camera_events
for insert with check (
  public.is_admin()
  or (public.current_role() in ('manager', 'owner', 'inspector') and public.can_access_garden(kindergarten_id))
);

drop policy if exists "ai camera events scoped update" on public.ai_camera_events;
create policy "ai camera events scoped update" on public.ai_camera_events
for update using (
  public.is_admin()
  or (public.current_role() in ('manager', 'owner', 'inspector') and public.can_access_garden(kindergarten_id))
)
with check (
  public.is_admin()
  or (public.current_role() in ('manager', 'owner', 'inspector') and public.can_access_garden(kindergarten_id))
);

comment on table public.ai_camera_events is 'AI Digital Observer event readiness table. Events are suspected/indicator records and require human review before escalation.';
comment on column public.ai_camera_events.clip_url is 'Future secure event clip URL. Do not expose without signed access control.';
comment on column public.ai_camera_events.snapshot_url is 'Future secure snapshot URL. Do not expose without signed access control.';
