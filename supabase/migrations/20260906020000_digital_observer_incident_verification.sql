-- PUSH 10: canonical deterministic Incident verification and final Decision.
-- Verification is immutable history. It cannot execute external actions and it
-- cannot grant recording permission.

alter table public.observer_correlated_events
  add column if not exists current_verification_status text,
  add column if not exists verification_classification text,
  add column if not exists verification_confidence numeric(5,4),
  add column if not exists final_decision text,
  add column if not exists final_decision_confidence numeric(5,4),
  add column if not exists verification_updated_at timestamptz;

alter table public.observer_correlated_events drop constraint if exists observer_incident_verification_status_check;
alter table public.observer_correlated_events add constraint observer_incident_verification_status_check
  check (current_verification_status is null or current_verification_status in (
    'UNVERIFIED','LIKELY','CONFIRMED','UNCERTAIN','REJECTED_FALSE_POSITIVE','RESOLVED'
  ));
alter table public.observer_correlated_events drop constraint if exists observer_incident_verification_classification_check;
alter table public.observer_correlated_events add constraint observer_incident_verification_classification_check
  check (verification_classification is null or verification_classification in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION','OTHER_UNKNOWN'
  ));
alter table public.observer_correlated_events drop constraint if exists observer_incident_verification_confidence_check;
alter table public.observer_correlated_events add constraint observer_incident_verification_confidence_check
  check (verification_confidence is null or verification_confidence between 0 and 1);
alter table public.observer_correlated_events drop constraint if exists observer_incident_final_decision_check;
alter table public.observer_correlated_events add constraint observer_incident_final_decision_check
  check (final_decision is null or final_decision in ('IGNORE','LOG_ONLY','PRESERVE_EVIDENCE','VERIFY','NOTIFY_IN_APP','ESCALATION_CANDIDATE'));
alter table public.observer_correlated_events drop constraint if exists observer_incident_final_decision_confidence_check;
alter table public.observer_correlated_events add constraint observer_incident_final_decision_confidence_check
  check (final_decision_confidence is null or final_decision_confidence between 0 and 1);

create table if not exists public.digital_observer_incident_verifications (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  incident_id uuid not null references public.observer_correlated_events(id) on delete cascade,
  risk_evaluation_id uuid not null references public.digital_observer_risk_evaluations(id) on delete cascade,
  status text not null,
  classification text not null,
  verification_confidence numeric(5,4) not null,
  final_decision_confidence numeric(5,4) not null,
  confirmed_signals jsonb not null default '[]'::jsonb,
  contradictory_signals jsonb not null default '[]'::jsonb,
  verification_reasons text[] not null default '{}'::text[],
  required_followup text not null,
  final_decision text not null,
  fast_path boolean not null default false,
  metrics jsonb not null default '{}'::jsonb,
  verification_version text not null,
  final_decision_version text not null,
  input_fingerprint text not null,
  previous_verification_id uuid references public.digital_observer_incident_verifications(id) on delete set null,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint digital_observer_verification_status_check check (status in (
    'UNVERIFIED','LIKELY','CONFIRMED','UNCERTAIN','REJECTED_FALSE_POSITIVE','RESOLVED'
  )),
  constraint digital_observer_verification_classification_check check (classification in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION','OTHER_UNKNOWN'
  )),
  constraint digital_observer_verification_confidence_check check (
    verification_confidence between 0 and 1 and final_decision_confidence between 0 and 1
  ),
  constraint digital_observer_verification_followup_check check (required_followup in ('NONE','VERIFY','PRESERVE_EVIDENCE','HUMAN_REVIEW')),
  constraint digital_observer_verification_decision_check check (final_decision in ('IGNORE','LOG_ONLY','PRESERVE_EVIDENCE','VERIFY','NOTIFY_IN_APP','ESCALATION_CANDIDATE')),
  constraint digital_observer_verification_fingerprint_check check (length(input_fingerprint) = 64),
  unique (incident_id, risk_evaluation_id, verification_version)
);

alter table public.observer_correlated_events
  add column if not exists latest_verification_id uuid references public.digital_observer_incident_verifications(id) on delete set null;

create index if not exists digital_observer_verification_incident_history_idx
  on public.digital_observer_incident_verifications(incident_id, evaluated_at desc);
create index if not exists digital_observer_verification_site_metrics_idx
  on public.digital_observer_incident_verifications(observer_site_id, status, classification, evaluated_at desc);
create index if not exists observer_incident_verification_projection_idx
  on public.observer_correlated_events(observer_site_id, current_verification_status, verification_updated_at desc)
  where correlation_version = 'do-track-v1';

alter table public.digital_observer_incident_verifications enable row level security;

drop policy if exists "Digital Observer incident verifications scoped read" on public.digital_observer_incident_verifications;
create policy "Digital Observer incident verifications scoped read" on public.digital_observer_incident_verifications
for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships membership
    where membership.observer_site_id = digital_observer_incident_verifications.observer_site_id
      and membership.profile_id = auth.uid()
      and membership.active = true
      and membership.member_role in ('owner','admin','operator','viewer')
  )
);

comment on table public.digital_observer_incident_verifications is 'Immutable deterministic verification history downstream of canonical Incident and Risk; no LLM and no external action execution.';
comment on column public.digital_observer_incident_verifications.classification is 'Separates a true expected activity from a false detector/correlation result.';
comment on column public.digital_observer_incident_verifications.verification_confidence is 'Confidence that the factual incident is corroborated; distinct from detector confidence and Risk.';
comment on column public.digital_observer_incident_verifications.final_decision_confidence is 'Confidence in the policy-bounded final Decision after Risk and Verification.';

notify pgrst, 'reload schema';
