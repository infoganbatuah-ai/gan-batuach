create table if not exists public.audio_observer_events (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  event_type text not null,
  severity text not null default 'medium',
  confidence numeric(5,4),
  review_status text not null default 'pending_review',
  recommended_action text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  audio_source_type text not null default 'future_audio_gateway',
  audio_window_metadata jsonb not null default '{}'::jsonb,
  keyword_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint audio_observer_events_type_check check (event_type in (
    'prolonged_crying_indicator',
    'distress_sound_indicator',
    'scream_indicator',
    'repeated_distress_indicator',
    'unusual_noise_indicator',
    'crowd_noise_spike',
    'argument_indicator',
    'impact_sound_indicator',
    'emergency_sound_indicator'
  )),
  constraint audio_observer_events_severity_check check (severity in ('info','low','medium','high','urgent','critical')),
  constraint audio_observer_events_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint audio_observer_events_review_status_check check (review_status in ('pending_review','reviewing','confirmed','dismissed','escalated','false_positive','needs_more_data')),
  constraint audio_observer_events_source_check check (audio_source_type in ('camera_microphone','nvr_audio_stream','dvr_audio_stream','future_audio_gateway','mock'))
);

create index if not exists audio_observer_events_site_status_idx on public.audio_observer_events(site_id, review_status, created_at desc);
create index if not exists audio_observer_events_kindergarten_status_idx on public.audio_observer_events(kindergarten_id, review_status, created_at desc);
create index if not exists audio_observer_events_type_idx on public.audio_observer_events(event_type, severity, created_at desc);
create index if not exists audio_observer_events_camera_idx on public.audio_observer_events(camera_id, created_at desc);

alter table public.audio_observer_events enable row level security;

drop policy if exists "audio observer events admin all" on public.audio_observer_events;
create policy "audio observer events admin all" on public.audio_observer_events
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "audio observer events scoped read" on public.audio_observer_events;
create policy "audio observer events scoped read" on public.audio_observer_events
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = audio_observer_events.site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "audio observer events scoped write" on public.audio_observer_events;
create policy "audio observer events scoped write" on public.audio_observer_events
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = audio_observer_events.site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
)
with check (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = audio_observer_events.site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

comment on table public.audio_observer_events is 'Future audio safety indicator events. No speech-to-text surveillance, no parent raw audio review, and human review is required.';
comment on column public.audio_observer_events.keyword_config is 'Future keyword/phrase readiness only. Speech-to-text is not implemented in this phase.';
comment on column public.audio_observer_events.audio_window_metadata is 'Metadata about a future sampled audio window. Raw audio paths should not be stored or exposed here.';

notify pgrst, 'reload schema';
