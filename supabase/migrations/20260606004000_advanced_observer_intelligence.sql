create table if not exists public.observer_situation_summaries (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  summary_type text not null,
  severity text not null default 'info',
  confidence numeric(5, 4) not null default 0,
  title text not null,
  summary text not null,
  recommended_actions jsonb not null default '[]'::jsonb,
  related_event_ids jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  dedupe_key text not null,
  context_snapshot jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_situation_summaries_scope_check check (observer_site_id is not null or kindergarten_id is not null),
  constraint observer_situation_summaries_type_check check (summary_type in (
    'needs_review_now',
    'camera_health_warning',
    'unresolved_safety_indicators',
    'correlated_event_attention',
    'audio_indicator_attention',
    'watch_request_attention',
    'pickup_verification_attention',
    'learning_readiness',
    'site_health',
    'mock_summary'
  )),
  constraint observer_situation_summaries_severity_check check (severity in ('info','low','medium','high','urgent','critical')),
  constraint observer_situation_summaries_status_check check (status in ('open','reviewing','handled','dismissed','escalated','snoozed')),
  constraint observer_situation_summaries_confidence_check check (confidence between 0 and 1)
);

create unique index if not exists observer_situation_summaries_open_dedupe_idx
  on public.observer_situation_summaries(dedupe_key)
  where status in ('open','reviewing','snoozed');

create index if not exists observer_situation_summaries_kindergarten_status_idx
  on public.observer_situation_summaries(kindergarten_id, status, severity, created_at desc);

create index if not exists observer_situation_summaries_site_status_idx
  on public.observer_situation_summaries(observer_site_id, status, severity, created_at desc);

create index if not exists observer_situation_summaries_type_idx
  on public.observer_situation_summaries(summary_type, severity, created_at desc);

alter table public.observer_situation_summaries enable row level security;

drop policy if exists "observer summaries scoped read" on public.observer_situation_summaries;
create policy "observer summaries scoped read" on public.observer_situation_summaries
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_situation_summaries.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "observer summaries scoped write" on public.observer_situation_summaries;
create policy "observer summaries scoped write" on public.observer_situation_summaries
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_situation_summaries.observer_site_id
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
    where m.observer_site_id = observer_situation_summaries.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

comment on table public.observer_situation_summaries is 'Unified Digital Observer situation summaries. Advisory only: no automatic accusations, no parent raw AI access, human review required.';
comment on column public.observer_situation_summaries.recommended_actions is 'Careful operational recommendations only. No legal or disciplinary wording.';
comment on column public.observer_situation_summaries.context_snapshot is 'Context used for safer interpretation: routines, zones, learning maturity, camera health and recent reviewed signals.';
comment on column public.observer_situation_summaries.related_event_ids is 'JSON list of related source ids. These ids are for review context, not identity tracking.';

notify pgrst, 'reload schema';
