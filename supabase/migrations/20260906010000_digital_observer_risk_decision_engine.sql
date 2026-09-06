-- PUSH 9: deterministic, explainable Incident-level Risk + Decision layer.
-- This migration does not execute external alerts or grant recording consent.

alter table public.observer_correlated_events
  add column if not exists current_risk_score integer,
  add column if not exists peak_risk_score integer,
  add column if not exists current_risk_band text,
  add column if not exists risk_evaluation_confidence numeric(5,4),
  add column if not exists current_decision text,
  add column if not exists risk_updated_at timestamptz;

alter table public.observer_correlated_events drop constraint if exists observer_incident_current_risk_score_check;
alter table public.observer_correlated_events add constraint observer_incident_current_risk_score_check
  check (current_risk_score is null or current_risk_score between 0 and 100);
alter table public.observer_correlated_events drop constraint if exists observer_incident_peak_risk_score_check;
alter table public.observer_correlated_events add constraint observer_incident_peak_risk_score_check
  check (peak_risk_score is null or peak_risk_score between 0 and 100);
alter table public.observer_correlated_events drop constraint if exists observer_incident_risk_band_check;
alter table public.observer_correlated_events add constraint observer_incident_risk_band_check
  check (current_risk_band is null or current_risk_band in ('LOW','GUARDED','ELEVATED','HIGH','CRITICAL'));
alter table public.observer_correlated_events drop constraint if exists observer_incident_risk_confidence_check;
alter table public.observer_correlated_events add constraint observer_incident_risk_confidence_check
  check (risk_evaluation_confidence is null or risk_evaluation_confidence between 0 and 1);
alter table public.observer_correlated_events drop constraint if exists observer_incident_decision_check;
alter table public.observer_correlated_events add constraint observer_incident_decision_check
  check (current_decision is null or current_decision in ('IGNORE','LOG_ONLY','PRESERVE_EVIDENCE','VERIFY','NOTIFY_IN_APP','ESCALATION_CANDIDATE'));

create table if not exists public.digital_observer_risk_evaluations (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  incident_id uuid not null references public.observer_correlated_events(id) on delete cascade,
  triggering_event_id uuid not null references public.observer_intelligence_signals(id) on delete cascade,
  risk_score integer not null,
  peak_risk_score integer not null,
  risk_band text not null,
  evaluation_confidence numeric(5,4) not null,
  contributing_factors jsonb not null default '[]'::jsonb,
  mitigating_factors jsonb not null default '[]'::jsonb,
  matched_rules jsonb not null default '[]'::jsonb,
  baseline_context jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  recommended_decision text not null,
  action_intents text[] not null default '{}'::text[],
  risk_engine_version text not null,
  factor_version text not null,
  decision_version text not null,
  input_fingerprint text not null,
  previous_evaluation_id uuid references public.digital_observer_risk_evaluations(id) on delete set null,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint digital_observer_risk_score_check check (risk_score between 0 and 100 and peak_risk_score between 0 and 100),
  constraint digital_observer_risk_band_check check (risk_band in ('LOW','GUARDED','ELEVATED','HIGH','CRITICAL')),
  constraint digital_observer_risk_confidence_check check (evaluation_confidence between 0 and 1),
  constraint digital_observer_risk_decision_check check (recommended_decision in ('IGNORE','LOG_ONLY','PRESERVE_EVIDENCE','VERIFY','NOTIFY_IN_APP','ESCALATION_CANDIDATE')),
  constraint digital_observer_risk_action_intents_check check (action_intents <@ array['IGNORE','LOG_ONLY','PRESERVE_EVIDENCE','VERIFY','NOTIFY_IN_APP','ESCALATION_CANDIDATE']::text[]),
  constraint digital_observer_risk_fingerprint_check check (length(input_fingerprint) = 64),
  unique (incident_id, input_fingerprint)
);

create table if not exists public.digital_observer_decision_intents (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  incident_id uuid not null references public.observer_correlated_events(id) on delete cascade,
  risk_evaluation_id uuid not null references public.digital_observer_risk_evaluations(id) on delete cascade,
  decision text not null,
  status text not null default 'proposed',
  dedupe_key text not null,
  cooldown_until timestamptz,
  requires_human_review boolean not null default true,
  external_execution_enabled boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_decision_intent_check check (decision in ('IGNORE','LOG_ONLY','PRESERVE_EVIDENCE','VERIFY','NOTIFY_IN_APP','ESCALATION_CANDIDATE')),
  constraint digital_observer_decision_status_check check (status in ('proposed','acknowledged','fulfilled','suppressed','expired','cancelled')),
  constraint digital_observer_external_execution_guard check (external_execution_enabled = false),
  unique (observer_site_id, dedupe_key)
);

alter table public.observer_correlated_events
  add column if not exists latest_risk_evaluation_id uuid references public.digital_observer_risk_evaluations(id) on delete set null;

create index if not exists digital_observer_risk_incident_history_idx
  on public.digital_observer_risk_evaluations(incident_id, evaluated_at desc);
create index if not exists digital_observer_risk_site_history_idx
  on public.digital_observer_risk_evaluations(observer_site_id, evaluated_at desc);
create index if not exists digital_observer_decision_incident_idx
  on public.digital_observer_decision_intents(incident_id, created_at desc);
create index if not exists observer_incident_risk_band_idx
  on public.observer_correlated_events(observer_site_id, current_risk_band, risk_updated_at desc)
  where correlation_version = 'do-track-v1';

alter table public.digital_observer_risk_evaluations enable row level security;
alter table public.digital_observer_decision_intents enable row level security;

drop policy if exists "Digital Observer risk evaluations scoped read" on public.digital_observer_risk_evaluations;
create policy "Digital Observer risk evaluations scoped read" on public.digital_observer_risk_evaluations
for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships membership
    where membership.observer_site_id = digital_observer_risk_evaluations.observer_site_id
      and membership.profile_id = auth.uid()
      and membership.active = true
      and membership.member_role in ('owner','admin','operator','viewer')
  )
);

drop policy if exists "Digital Observer decision intents scoped read" on public.digital_observer_decision_intents;
create policy "Digital Observer decision intents scoped read" on public.digital_observer_decision_intents
for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships membership
    where membership.observer_site_id = digital_observer_decision_intents.observer_site_id
      and membership.profile_id = auth.uid()
      and membership.active = true
      and membership.member_role in ('owner','admin','operator','viewer')
  )
);

comment on table public.digital_observer_risk_evaluations is 'Immutable deterministic Incident-level Digital Observer Risk history. Detection confidence is separate from risk score; no LLM or external action execution.';
comment on table public.digital_observer_decision_intents is 'Deduplicated advisory Decision intents downstream of Risk. External execution remains disabled in PUSH 9.';
comment on column public.digital_observer_risk_evaluations.contributing_factors is 'Auditable positive risk contributions with factual evidence.';
comment on column public.digital_observer_risk_evaluations.mitigating_factors is 'Auditable mitigating contributions; immature baselines are uncertainty, not threat evidence.';

notify pgrst, 'reload schema';
