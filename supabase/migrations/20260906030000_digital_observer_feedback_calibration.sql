-- PUSH 11: canonical, auditable feedback and calibration loop.
-- Feedback is data for review. It cannot mutate a live model, Risk weight,
-- Production rule, baseline, detector threshold, or external action.

create or replace function public.can_label_digital_observer_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and target_site_id is not null and (
    public.is_admin()
    or coalesce((auth.jwt()->'app_metadata'->>'digital_observer_admin')::boolean, false)
    or exists (
      select 1 from public.observer_sites site
      where site.id = target_site_id and site.owner_profile_id = auth.uid()
    )
    or exists (
      select 1 from public.observer_site_memberships membership
      where membership.observer_site_id = target_site_id
        and membership.profile_id = auth.uid()
        and membership.active = true
        and membership.member_role in ('owner','admin','operator','reviewer')
    )
  )
$$;

create or replace function public.can_review_digital_observer_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select auth.uid() is not null and target_site_id is not null and (
    public.is_admin()
    or coalesce((auth.jwt()->'app_metadata'->>'digital_observer_admin')::boolean, false)
    or exists (
      select 1 from public.observer_site_memberships membership
      where membership.observer_site_id = target_site_id
        and membership.profile_id = auth.uid()
        and membership.active = true
        and membership.member_role in ('admin','reviewer')
    )
  )
$$;

create table if not exists public.digital_observer_feedback_revisions (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  incident_id uuid not null references public.observer_correlated_events(id) on delete cascade,
  target_type text not null default 'INCIDENT',
  target_id uuid not null,
  camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  label text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_role text not null,
  reason_code text,
  note text,
  previous_feedback_id uuid references public.digital_observer_feedback_revisions(id) on delete set null,
  revision_number integer not null,
  feedback_version text not null default 'do-feedback-v1',
  source text not null default 'PRODUCT_UI',
  environment text not null default 'PRODUCTION',
  incident_provenance text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint digital_observer_feedback_target_check check (target_type in ('INCIDENT','EVENT','VERIFICATION','DECISION','EVIDENCE')),
  constraint digital_observer_feedback_label_check check (label in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION',
    'FALSE_SPATIAL_EVENT','UNCERTAIN','OTHER'
  )),
  constraint digital_observer_feedback_revision_check check (revision_number > 0),
  constraint digital_observer_feedback_source_check check (source in ('PRODUCT_UI','PRODUCT_API','INTERNAL_ADMIN')),
  constraint digital_observer_feedback_environment_check check (environment in ('PRODUCTION','TEST','CALIBRATION_FIXTURE')),
  constraint digital_observer_feedback_note_check check (note is null or char_length(note) <= 500),
  constraint digital_observer_feedback_reason_check check (reason_code is null or char_length(reason_code) <= 80),
  constraint digital_observer_feedback_provenance_check check (
    environment <> 'PRODUCTION' or incident_provenance = 'REAL_CAMERA_AI'
  ),
  unique (incident_id, revision_number),
  unique (actor_id, idempotency_key)
);

alter table public.observer_correlated_events
  add column if not exists current_feedback_label text,
  add column if not exists latest_feedback_revision_id uuid references public.digital_observer_feedback_revisions(id) on delete set null,
  add column if not exists feedback_updated_at timestamptz,
  add column if not exists current_ground_truth_label text,
  add column if not exists latest_ground_truth_review_id uuid,
  add column if not exists ground_truth_reviewed_at timestamptz;

alter table public.observer_correlated_events drop constraint if exists observer_incident_feedback_label_check;
alter table public.observer_correlated_events add constraint observer_incident_feedback_label_check
  check (current_feedback_label is null or current_feedback_label in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION',
    'FALSE_SPATIAL_EVENT','UNCERTAIN','OTHER'
  ));
alter table public.observer_correlated_events drop constraint if exists observer_incident_ground_truth_label_check;
alter table public.observer_correlated_events add constraint observer_incident_ground_truth_label_check
  check (current_ground_truth_label is null or current_ground_truth_label in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION',
    'FALSE_SPATIAL_EVENT','UNCERTAIN','OTHER'
  ));

-- Reuse the existing human Ground Truth table. Legacy rows remain intact;
-- canonical rows are distinguished by canonical_label/review_state/version.
alter table public.observer_ground_truth_reviews
  add column if not exists feedback_revision_id uuid references public.digital_observer_feedback_revisions(id) on delete set null,
  add column if not exists incident_id uuid references public.observer_correlated_events(id) on delete cascade,
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  add column if not exists canonical_label text,
  add column if not exists review_state text,
  add column if not exists environment text,
  add column if not exists reviewer_role text,
  add column if not exists reason_code text,
  add column if not exists previous_review_id uuid references public.observer_ground_truth_reviews(id) on delete set null,
  add column if not exists review_number integer,
  add column if not exists feedback_version text,
  add column if not exists review_version text,
  add column if not exists review_idempotency_key text,
  add column if not exists version_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists evidence_references uuid[] not null default '{}'::uuid[];

alter table public.observer_ground_truth_reviews drop constraint if exists observer_ground_truth_canonical_label_check;
alter table public.observer_ground_truth_reviews add constraint observer_ground_truth_canonical_label_check
  check (canonical_label is null or canonical_label in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION',
    'FALSE_SPATIAL_EVENT','UNCERTAIN','OTHER'
  ));
alter table public.observer_ground_truth_reviews drop constraint if exists observer_ground_truth_review_state_check;
alter table public.observer_ground_truth_reviews add constraint observer_ground_truth_review_state_check
  check (review_state is null or review_state in ('REVIEWED','CORRECTED','SUPERSEDED'));
alter table public.observer_ground_truth_reviews drop constraint if exists observer_ground_truth_environment_check;
alter table public.observer_ground_truth_reviews add constraint observer_ground_truth_environment_check
  check (environment is null or environment in ('PRODUCTION','TEST','CALIBRATION_FIXTURE'));

create unique index if not exists observer_ground_truth_feedback_review_uidx
  on public.observer_ground_truth_reviews(feedback_revision_id, review_number)
  where feedback_revision_id is not null and review_number is not null;
create unique index if not exists observer_ground_truth_reviewer_idempotency_uidx
  on public.observer_ground_truth_reviews(reviewed_by, review_idempotency_key)
  where reviewed_by is not null and review_idempotency_key is not null;

alter table public.observer_correlated_events drop constraint if exists observer_incident_latest_ground_truth_review_fk;
alter table public.observer_correlated_events add constraint observer_incident_latest_ground_truth_review_fk
  foreign key (latest_ground_truth_review_id) references public.observer_ground_truth_reviews(id) on delete set null;

create table if not exists public.digital_observer_calibration_samples (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  incident_id uuid not null references public.observer_correlated_events(id) on delete cascade,
  feedback_revision_id uuid not null references public.digital_observer_feedback_revisions(id) on delete cascade,
  ground_truth_review_id uuid not null references public.observer_ground_truth_reviews(id) on delete cascade,
  canonical_label text not null,
  environment text not null,
  incident_provenance text not null,
  event_ids uuid[] not null default '{}'::uuid[],
  event_types text[] not null default '{}'::text[],
  track_ids text[] not null default '{}'::text[],
  evidence_references uuid[] not null default '{}'::uuid[],
  model_provenance jsonb not null default '[]'::jsonb,
  detector_confidence numeric(5,4),
  spatial_result jsonb not null default '{}'::jsonb,
  risk_snapshot jsonb not null default '{}'::jsonb,
  verification_snapshot jsonb not null default '{}'::jsonb,
  decision_snapshot jsonb not null default '{}'::jsonb,
  version_snapshot jsonb not null default '{}'::jsonb,
  decision_quality text not null,
  calibration_signal_type text not null,
  dataset_version text not null default 'do-feedback-dataset-v1',
  training_eligible boolean not null default false,
  raw_media_copied boolean not null default false,
  privacy_metadata jsonb not null default '{"structured_metadata_only":true,"media_access_by_reference":true}'::jsonb,
  created_at timestamptz not null default now(),
  constraint digital_observer_calibration_label_check check (canonical_label in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION',
    'FALSE_SPATIAL_EVENT','UNCERTAIN','OTHER'
  )),
  constraint digital_observer_calibration_environment_check check (environment in ('PRODUCTION','TEST','CALIBRATION_FIXTURE')),
  constraint digital_observer_calibration_provenance_check check (
    environment <> 'PRODUCTION' or incident_provenance = 'REAL_CAMERA_AI'
  ),
  constraint digital_observer_calibration_detector_confidence_check check (
    detector_confidence is null or detector_confidence between 0 and 1
  ),
  constraint digital_observer_calibration_safe_gate_check check (
    training_eligible = false and raw_media_copied = false
  ),
  unique (ground_truth_review_id)
);

create table if not exists public.digital_observer_calibration_recommendations (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  ground_truth_review_id uuid not null references public.observer_ground_truth_reviews(id) on delete cascade,
  scope_type text not null,
  scope_id text not null,
  recommendation_type text not null,
  status text not null,
  sample_size integer not null,
  recommendation_confidence numeric(5,4) not null,
  evidence_summary jsonb not null default '{}'::jsonb,
  affected_versions jsonb not null default '{}'::jsonb,
  recommendation_version text not null default 'do-calibration-recommendation-v1',
  requires_human_approval boolean not null default true,
  production_change_applied boolean not null default false,
  created_at timestamptz not null default now(),
  constraint digital_observer_recommendation_scope_check check (scope_type in ('GLOBAL','MODEL_VERSION','TENANT','SITE','CAMERA','RULE')),
  constraint digital_observer_recommendation_status_check check (status in ('INSUFFICIENT_SAMPLE','REVIEW_READY','APPROVED','REJECTED','SUPERSEDED')),
  constraint digital_observer_recommendation_confidence_check check (recommendation_confidence between 0 and 1),
  constraint digital_observer_recommendation_safe_gate_check check (
    requires_human_approval = true and production_change_applied = false
  ),
  unique (ground_truth_review_id)
);

create index if not exists digital_observer_feedback_incident_history_idx
  on public.digital_observer_feedback_revisions(incident_id, revision_number desc);
create index if not exists digital_observer_feedback_site_label_idx
  on public.digital_observer_feedback_revisions(observer_site_id, label, created_at desc);
create index if not exists digital_observer_calibration_scope_idx
  on public.digital_observer_calibration_samples(observer_site_id, camera_source_id, canonical_label, created_at desc);
create index if not exists digital_observer_calibration_version_idx
  on public.digital_observer_calibration_samples(dataset_version, created_at desc);
create index if not exists digital_observer_recommendation_scope_idx
  on public.digital_observer_calibration_recommendations(scope_type, scope_id, status, created_at desc);

alter table public.digital_observer_feedback_revisions enable row level security;
alter table public.digital_observer_calibration_samples enable row level security;
alter table public.digital_observer_calibration_recommendations enable row level security;

drop policy if exists "Digital Observer feedback scoped read" on public.digital_observer_feedback_revisions;
create policy "Digital Observer feedback scoped read" on public.digital_observer_feedback_revisions
for select using (public.can_access_observer_site(observer_site_id));

drop policy if exists "observer ground truth reviews admin only" on public.observer_ground_truth_reviews;
drop policy if exists "Digital Observer ground truth scoped read" on public.observer_ground_truth_reviews;
create policy "Digital Observer ground truth scoped read" on public.observer_ground_truth_reviews
for select using (
  public.is_admin()
  or (observer_site_id is not null and public.can_access_observer_site(observer_site_id))
);

drop policy if exists "Digital Observer calibration samples admin read" on public.digital_observer_calibration_samples;
create policy "Digital Observer calibration samples admin read" on public.digital_observer_calibration_samples
for select using (public.is_admin() or coalesce((auth.jwt()->'app_metadata'->>'digital_observer_admin')::boolean, false));

drop policy if exists "Digital Observer calibration recommendations admin read" on public.digital_observer_calibration_recommendations;
create policy "Digital Observer calibration recommendations admin read" on public.digital_observer_calibration_recommendations
for select using (public.is_admin() or coalesce((auth.jwt()->'app_metadata'->>'digital_observer_admin')::boolean, false));

revoke insert, update, delete on public.digital_observer_feedback_revisions from authenticated;
revoke insert, update, delete on public.observer_ground_truth_reviews from authenticated;
revoke insert, update, delete on public.digital_observer_calibration_samples from authenticated;
revoke insert, update, delete on public.digital_observer_calibration_recommendations from authenticated;
grant select on public.digital_observer_feedback_revisions to authenticated;
grant select on public.observer_ground_truth_reviews to authenticated;
grant select on public.digital_observer_calibration_samples to authenticated;
grant select on public.digital_observer_calibration_recommendations to authenticated;

create or replace function public.record_digital_observer_incident_feedback(
  requested_incident_id uuid,
  requested_label text,
  requested_reason_code text default null,
  requested_note text default null,
  requested_source text default 'PRODUCT_API',
  requested_idempotency_key text default null,
  requested_target_type text default 'INCIDENT',
  requested_target_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  incident_row public.observer_correlated_events;
  previous_id uuid;
  existing_id uuid;
  next_revision integer;
  feedback_id uuid;
  actor_role_value text;
  target_id_value uuid;
begin
  if auth.uid() is null then raise exception 'FEEDBACK_AUTH_REQUIRED'; end if;
  if requested_label not in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION',
    'FALSE_SPATIAL_EVENT','UNCERTAIN','OTHER'
  ) then raise exception 'FEEDBACK_LABEL_INVALID'; end if;
  if requested_source not in ('PRODUCT_UI','PRODUCT_API','INTERNAL_ADMIN') then raise exception 'FEEDBACK_SOURCE_INVALID'; end if;
  if requested_target_type not in ('INCIDENT','EVENT','VERIFICATION','DECISION','EVIDENCE') then raise exception 'FEEDBACK_TARGET_INVALID'; end if;
  if requested_idempotency_key is null or char_length(requested_idempotency_key) < 8 or char_length(requested_idempotency_key) > 120 then
    raise exception 'FEEDBACK_IDEMPOTENCY_INVALID';
  end if;
  if requested_note is not null and char_length(requested_note) > 500 then raise exception 'FEEDBACK_NOTE_TOO_LONG'; end if;
  if requested_reason_code is not null and char_length(requested_reason_code) > 80 then raise exception 'FEEDBACK_REASON_TOO_LONG'; end if;

  select * into incident_row from public.observer_correlated_events
  where id = requested_incident_id for update;
  if incident_row.id is null or incident_row.correlation_version <> 'do-track-v1' then
    raise exception 'CANONICAL_INCIDENT_NOT_FOUND';
  end if;
  if incident_row.provenance <> 'REAL_CAMERA_AI' then raise exception 'PRODUCTION_REAL_PROVENANCE_REQUIRED'; end if;
  if not public.can_label_digital_observer_site(incident_row.observer_site_id) then raise exception 'FEEDBACK_SITE_ACCESS_DENIED'; end if;

  target_id_value := coalesce(requested_target_id, incident_row.id);
  if (requested_target_type = 'INCIDENT' and target_id_value <> incident_row.id)
    or (requested_target_type = 'EVENT' and not (incident_row.related_event_ids @> array[target_id_value]))
    or (requested_target_type = 'VERIFICATION' and not exists (
      select 1 from public.digital_observer_incident_verifications item
      where item.id = target_id_value and item.incident_id = incident_row.id
    ))
    or (requested_target_type = 'DECISION' and not exists (
      select 1 from public.digital_observer_decision_intents item
      where item.id = target_id_value and item.incident_id = incident_row.id
    ))
    or (requested_target_type = 'EVIDENCE' and not exists (
      select 1 from public.digital_observer_event_clips item
      where item.id = target_id_value and item.observer_site_id = incident_row.observer_site_id
        and item.signal_id = any(incident_row.related_event_ids)
    )) then
    raise exception 'FEEDBACK_TARGET_SCOPE_MISMATCH';
  end if;

  select id into existing_id from public.digital_observer_feedback_revisions
  where actor_id = auth.uid() and idempotency_key = requested_idempotency_key;
  if existing_id is not null then return existing_id; end if;

  previous_id := incident_row.latest_feedback_revision_id;
  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.digital_observer_feedback_revisions where incident_id = incident_row.id;
  select coalesce(profile.role::text, 'observer_member') into actor_role_value
  from public.profiles profile where profile.id = auth.uid();

  insert into public.digital_observer_feedback_revisions (
    observer_site_id, incident_id, target_type, target_id, camera_source_id, label,
    actor_id, actor_role, reason_code, note, previous_feedback_id, revision_number,
    feedback_version, source, environment, incident_provenance, idempotency_key, metadata
  ) values (
    incident_row.observer_site_id, incident_row.id, requested_target_type, target_id_value,
    incident_row.primary_camera_source_id, requested_label, auth.uid(), coalesce(actor_role_value, 'observer_member'),
    nullif(requested_reason_code, ''), nullif(requested_note, ''), previous_id, next_revision,
    'do-feedback-v1', requested_source, 'PRODUCTION', incident_row.provenance,
    requested_idempotency_key,
    jsonb_build_object(
      'raw_feedback', true,
      'reviewed_ground_truth', false,
      'automatic_learning_applied', false,
      'model_mutated', false,
      'risk_mutated', false,
      'rules_mutated', false,
      'baseline_mutated', false
    )
  ) returning id into feedback_id;

  update public.observer_correlated_events set
    current_feedback_label = requested_label,
    latest_feedback_revision_id = feedback_id,
    feedback_updated_at = now(),
    updated_at = now()
  where id = incident_row.id;

  return feedback_id;
end;
$$;

create or replace function public.review_digital_observer_incident_feedback(
  requested_feedback_id uuid,
  requested_label text default null,
  requested_reason_code text default null,
  requested_note text default null,
  requested_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  feedback_row public.digital_observer_feedback_revisions;
  incident_row public.observer_correlated_events;
  risk_row public.digital_observer_risk_evaluations;
  verification_row public.digital_observer_incident_verifications;
  decision_row public.digital_observer_decision_intents;
  previous_review uuid;
  existing_review uuid;
  next_review integer;
  canonical_label_value text;
  legacy_outcome text;
  review_id uuid;
  sample_id uuid;
  recommendation_id uuid;
  sample_count_value integer;
  event_types_value text[];
  model_provenance_value jsonb;
  detector_confidence_value numeric(5,4);
  evidence_references_value uuid[];
  decision_quality_value text;
  signal_type_value text;
  recommendation_type_value text;
  version_snapshot_value jsonb;
begin
  if auth.uid() is null then raise exception 'GROUND_TRUTH_AUTH_REQUIRED'; end if;
  if requested_idempotency_key is null or char_length(requested_idempotency_key) < 8 or char_length(requested_idempotency_key) > 120 then
    raise exception 'GROUND_TRUTH_IDEMPOTENCY_INVALID';
  end if;
  if requested_note is not null and char_length(requested_note) > 500 then raise exception 'GROUND_TRUTH_NOTE_TOO_LONG'; end if;

  select * into feedback_row from public.digital_observer_feedback_revisions
  where id = requested_feedback_id for update;
  if feedback_row.id is null then raise exception 'FEEDBACK_NOT_FOUND'; end if;
  if not public.can_review_digital_observer_site(feedback_row.observer_site_id) then raise exception 'GROUND_TRUTH_REVIEW_DENIED'; end if;

  select * into incident_row from public.observer_correlated_events
  where id = feedback_row.incident_id and observer_site_id = feedback_row.observer_site_id for update;
  if incident_row.id is null or incident_row.provenance <> 'REAL_CAMERA_AI' then raise exception 'CANONICAL_REAL_INCIDENT_REQUIRED'; end if;

  select id into existing_review from public.observer_ground_truth_reviews
  where reviewed_by = auth.uid() and review_idempotency_key = requested_idempotency_key;
  if existing_review is not null then
    return jsonb_build_object(
      'feedback_id', feedback_row.id,
      'ground_truth_review_id', existing_review,
      'calibration_sample_id', (select id from public.digital_observer_calibration_samples where ground_truth_review_id = existing_review),
      'recommendation_id', (select id from public.digital_observer_calibration_recommendations where ground_truth_review_id = existing_review),
      'idempotent', true
    );
  end if;

  canonical_label_value := coalesce(requested_label, feedback_row.label);
  if canonical_label_value not in (
    'TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY','FALSE_DETECTION','FALSE_CORRELATION',
    'FALSE_SPATIAL_EVENT','UNCERTAIN','OTHER'
  ) then raise exception 'GROUND_TRUTH_LABEL_INVALID'; end if;

  select * into risk_row from public.digital_observer_risk_evaluations
  where incident_id = incident_row.id order by evaluated_at desc limit 1;
  select * into verification_row from public.digital_observer_incident_verifications
  where incident_id = incident_row.id order by evaluated_at desc limit 1;
  select * into decision_row from public.digital_observer_decision_intents
  where incident_id = incident_row.id and metadata->>'decision_stage' = 'post_verification_final'
  order by created_at desc limit 1;

  select coalesce(array_agg(distinct coalesce(signal.metadata->>'event_type', signal.signal_type)), '{}'::text[]),
    coalesce(jsonb_agg(distinct signal.metadata->'model_provenance') filter (where signal.metadata ? 'model_provenance'), '[]'::jsonb),
    max(signal.confidence)
  into event_types_value, model_provenance_value, detector_confidence_value
  from public.observer_intelligence_signals signal
  where signal.id = any(incident_row.related_event_ids)
    and signal.observer_site_id = incident_row.observer_site_id;

  select coalesce(array_agg(clip.id), '{}'::uuid[]) into evidence_references_value
  from public.digital_observer_event_clips clip
  where clip.signal_id = any(incident_row.related_event_ids)
    and clip.observer_site_id = incident_row.observer_site_id;

  previous_review := incident_row.latest_ground_truth_review_id;
  select coalesce(max(review_number), 0) + 1 into next_review
  from public.observer_ground_truth_reviews where incident_id = incident_row.id and canonical_label is not null;
  legacy_outcome := case
    when canonical_label_value in ('TRUE_SECURITY_EVENT','TRUE_EXPECTED_ACTIVITY') then 'correct_detection'
    when canonical_label_value in ('FALSE_DETECTION','FALSE_CORRELATION','FALSE_SPATIAL_EVENT') then 'false_positive'
    else 'uncertain' end;

  version_snapshot_value := jsonb_build_object(
    'model', model_provenance_value,
    'risk_engine', risk_row.risk_engine_version,
    'risk_factors', risk_row.factor_version,
    'verification', verification_row.verification_version,
    'decision', verification_row.final_decision_version,
    'baseline', risk_row.baseline_context->>'version',
    'rules', coalesce(risk_row.matched_rules, '[]'::jsonb),
    'feedback', 'do-feedback-v1',
    'ground_truth', 'do-ground-truth-v1'
  );

  insert into public.observer_ground_truth_reviews (
    event_source, event_id, observer_site_id, reviewed_by, outcome,
    observer_recommendation, reviewer_note, confidence_at_review,
    updates_learning_profile, no_action_taken, metadata,
    feedback_revision_id, incident_id, target_type, target_id, camera_source_id,
    canonical_label, review_state, environment, reviewer_role, reason_code,
    previous_review_id, review_number, feedback_version, review_version,
    review_idempotency_key, version_snapshot, evidence_references
  ) values (
    'observer_correlated_event', incident_row.id, incident_row.observer_site_id, auth.uid(), legacy_outcome,
    'canonical_calibration_review', nullif(requested_note, ''), verification_row.verification_confidence,
    false, true,
    jsonb_build_object(
      'canonical_feedback', true,
      'automatic_learning_applied', false,
      'requires_versioned_release_approval', true,
      'historical_risk_rewritten', false
    ),
    feedback_row.id, incident_row.id, feedback_row.target_type, feedback_row.target_id,
    incident_row.primary_camera_source_id, canonical_label_value,
    case when previous_review is null then 'REVIEWED' else 'CORRECTED' end,
    'PRODUCTION', coalesce((select role::text from public.profiles where id = auth.uid()), 'reviewer'),
    nullif(requested_reason_code, ''), previous_review, next_review,
    feedback_row.feedback_version, 'do-ground-truth-v1', requested_idempotency_key,
    version_snapshot_value, evidence_references_value
  ) returning id into review_id;

  if previous_review is not null then
    update public.observer_ground_truth_reviews set review_state = 'SUPERSEDED'
    where id = previous_review;
  end if;

  decision_quality_value := case
    when canonical_label_value = 'TRUE_EXPECTED_ACTIVITY' and coalesce(verification_row.final_decision, risk_row.recommended_decision) in ('IGNORE','LOG_ONLY') then 'ALIGNED'
    when canonical_label_value = 'UNCERTAIN' and coalesce(verification_row.final_decision, risk_row.recommended_decision) = 'VERIFY' then 'ALIGNED'
    when canonical_label_value in ('FALSE_DETECTION','FALSE_CORRELATION','FALSE_SPATIAL_EVENT') and coalesce(verification_row.final_decision, risk_row.recommended_decision) in ('NOTIFY_IN_APP','ESCALATION_CANDIDATE') then 'POTENTIAL_OVER_ESCALATION'
    when canonical_label_value = 'TRUE_SECURITY_EVENT' and coalesce(verification_row.final_decision, risk_row.recommended_decision) in ('IGNORE','LOG_ONLY') then 'POTENTIAL_UNDER_RESPONSE'
    else 'REVIEW_REQUIRED' end;
  signal_type_value := case canonical_label_value
    when 'FALSE_DETECTION' then 'DETECTOR_REVIEW'
    when 'FALSE_SPATIAL_EVENT' then 'SPATIAL_GEOMETRY_REVIEW'
    when 'FALSE_CORRELATION' then 'INCIDENT_CORRELATION_REVIEW'
    when 'TRUE_EXPECTED_ACTIVITY' then 'CONTEXT_BASELINE_REVIEW'
    when 'TRUE_SECURITY_EVENT' then 'RISK_VERIFICATION_VALIDATION'
    when 'UNCERTAIN' then 'EVIDENCE_REVIEW'
    else 'MANUAL_CALIBRATION_REVIEW' end;

  insert into public.digital_observer_calibration_samples (
    observer_site_id, camera_source_id, incident_id, feedback_revision_id,
    ground_truth_review_id, canonical_label, environment, incident_provenance,
    event_ids, event_types, track_ids, evidence_references, model_provenance,
    detector_confidence, spatial_result, risk_snapshot, verification_snapshot,
    decision_snapshot, version_snapshot, decision_quality, calibration_signal_type,
    dataset_version, training_eligible, raw_media_copied, privacy_metadata
  ) values (
    incident_row.observer_site_id, incident_row.primary_camera_source_id, incident_row.id,
    feedback_row.id, review_id, canonical_label_value, 'PRODUCTION', incident_row.provenance,
    incident_row.related_event_ids, event_types_value, incident_row.involved_track_ids,
    evidence_references_value, model_provenance_value, detector_confidence_value,
    jsonb_build_object('event_types', event_types_value, 'track_ids', incident_row.involved_track_ids),
    jsonb_build_object('id', risk_row.id, 'score', risk_row.risk_score, 'band', risk_row.risk_band, 'confidence', risk_row.evaluation_confidence),
    jsonb_build_object('id', verification_row.id, 'status', verification_row.status, 'classification', verification_row.classification, 'confidence', verification_row.verification_confidence),
    jsonb_build_object('id', decision_row.id, 'decision', coalesce(verification_row.final_decision, risk_row.recommended_decision), 'confidence', verification_row.final_decision_confidence),
    version_snapshot_value, decision_quality_value, signal_type_value,
    'do-feedback-dataset-v1', false, false,
    jsonb_build_object(
      'structured_metadata_only', true,
      'media_access_by_reference', true,
      'raw_media_copied', false,
      'retention_policy_authoritative', true,
      'tenant_scope', incident_row.observer_site_id
    )
  ) returning id into sample_id;

  select count(*)::integer into sample_count_value
  from public.digital_observer_calibration_samples sample
  where sample.observer_site_id = incident_row.observer_site_id
    and sample.camera_source_id is not distinct from incident_row.primary_camera_source_id
    and sample.environment = 'PRODUCTION'
    and sample.incident_provenance = 'REAL_CAMERA_AI';

  recommendation_type_value := case canonical_label_value
    when 'FALSE_DETECTION' then 'REVIEW_PERSON_DETECTOR_FALSE_POSITIVES'
    when 'FALSE_SPATIAL_EVENT' then 'REVIEW_CAMERA_SPATIAL_GEOMETRY'
    when 'FALSE_CORRELATION' then 'REVIEW_INCIDENT_CORRELATION'
    when 'TRUE_EXPECTED_ACTIVITY' then 'REVIEW_EXPECTED_ACTIVITY_DECISION_ALIGNMENT'
    when 'TRUE_SECURITY_EVENT' then 'VALIDATE_RISK_AND_VERIFICATION_ALIGNMENT'
    when 'UNCERTAIN' then 'REVIEW_EVIDENCE_COVERAGE'
    else 'MANUAL_CALIBRATION_REVIEW' end;

  insert into public.digital_observer_calibration_recommendations (
    observer_site_id, camera_source_id, ground_truth_review_id, scope_type, scope_id,
    recommendation_type, status, sample_size, recommendation_confidence,
    evidence_summary, affected_versions, recommendation_version,
    requires_human_approval, production_change_applied
  ) values (
    incident_row.observer_site_id, incident_row.primary_camera_source_id, review_id,
    case when incident_row.primary_camera_source_id is null then 'SITE' else 'CAMERA' end,
    coalesce(incident_row.primary_camera_source_id::text, incident_row.observer_site_id::text),
    recommendation_type_value,
    case when sample_count_value < 10 then 'INSUFFICIENT_SAMPLE' else 'REVIEW_READY' end,
    sample_count_value, least(0.9000, sample_count_value::numeric / 20),
    jsonb_build_object(
      'canonical_label', canonical_label_value,
      'calibration_sample_id', sample_id,
      'decision_quality', decision_quality_value,
      'sample_size', sample_count_value,
      'no_accuracy_claim', sample_count_value < 10
    ),
    version_snapshot_value, 'do-calibration-recommendation-v1', true, false
  ) returning id into recommendation_id;

  update public.observer_correlated_events set
    current_ground_truth_label = canonical_label_value,
    latest_ground_truth_review_id = review_id,
    ground_truth_reviewed_at = now(),
    updated_at = now()
  where id = incident_row.id;

  return jsonb_build_object(
    'feedback_id', feedback_row.id,
    'ground_truth_review_id', review_id,
    'calibration_sample_id', sample_id,
    'recommendation_id', recommendation_id,
    'canonical_label', canonical_label_value,
    'sample_size', sample_count_value,
    'idempotent', false,
    'automatic_production_change', false
  );
end;
$$;

revoke all on function public.can_label_digital_observer_site(uuid) from public;
revoke all on function public.can_review_digital_observer_site(uuid) from public;
revoke all on function public.record_digital_observer_incident_feedback(uuid,text,text,text,text,text,text,uuid) from public;
revoke all on function public.review_digital_observer_incident_feedback(uuid,text,text,text,text) from public;
grant execute on function public.can_label_digital_observer_site(uuid) to authenticated, service_role;
grant execute on function public.can_review_digital_observer_site(uuid) to authenticated, service_role;
grant execute on function public.record_digital_observer_incident_feedback(uuid,text,text,text,text,text,text,uuid) to authenticated;
grant execute on function public.review_digital_observer_incident_feedback(uuid,text,text,text,text) to authenticated;

comment on table public.digital_observer_feedback_revisions is 'Immutable, attributable raw Digital Observer feedback history. A correction creates a new revision.';
comment on table public.observer_ground_truth_reviews is 'Canonical reviewed Ground Truth reuses this existing table; canonical rows are versioned and remain separate from raw feedback.';
comment on table public.digital_observer_calibration_samples is 'Reviewed structured calibration metadata. Raw media is referenced under retention policy, never copied automatically.';
comment on table public.digital_observer_calibration_recommendations is 'Deterministic offline recommendations requiring explicit human/release approval. Production mutation is forbidden.';
comment on function public.record_digital_observer_incident_feedback(uuid,text,text,text,text,text,text,uuid) is 'Records site-scoped raw Incident/Event/Verification/Decision/Evidence feedback without changing live model, Risk, rule, baseline, or Decision configuration.';
comment on function public.review_digital_observer_incident_feedback(uuid,text,text,text,text) is 'Promotes reviewed feedback into versioned Ground Truth and a structured calibration sample; never changes Production automatically.';

notify pgrst, 'reload schema';
