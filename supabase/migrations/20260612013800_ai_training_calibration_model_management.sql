-- PHASE 138: AI training, calibration and model management platform.
-- Governance-only infrastructure. No automatic deployment or production promotion.

create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  model_key text not null unique,
  model_name text not null,
  model_version text not null default '0.1.0',
  model_type text not null,
  category text not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  deployment_date timestamptz,
  lifecycle_status text not null default 'draft',
  deployment_status text not null default 'not_deployed',
  accuracy numeric(5,2) not null default 0,
  precision_score numeric(5,2) not null default 0,
  recall_score numeric(5,2) not null default 0,
  drift_status text not null default 'not_measured',
  explainability_level text not null default 'basic',
  human_approval_required boolean not null default true,
  automatic_promotion_allowed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_model_category_check check (category in ('pose_estimation','skeleton_tracking','motion_analytics','anomaly_detection','risk_scoring','recommendation_engine','compliance_intelligence','inspection_intelligence')),
  constraint ai_model_lifecycle_check check (lifecycle_status in ('draft','testing','pilot','approved','production','retired')),
  constraint ai_model_deployment_status_check check (deployment_status in ('not_deployed','testing','pilot','approved_for_production','production_active','paused','retired','rollback_required')),
  constraint ai_model_drift_status_check check (drift_status in ('not_measured','stable','watch','degraded','critical')),
  constraint ai_model_score_check check (accuracy between 0 and 100 and precision_score between 0 and 100 and recall_score between 0 and 100)
);

create table if not exists public.ai_training_datasets (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null unique,
  dataset_name text not null,
  dataset_source text not null,
  dataset_version text not null default '0.1.0',
  dataset_purpose text not null,
  sample_count integer not null default 0,
  quality_score integer not null default 0,
  privacy_review_status text not null default 'pending_review',
  approval_status text not null default 'draft',
  allowed_for_training boolean not null default false,
  contains_personal_data boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_dataset_source_check check (dataset_source in ('internal','approved_external','synthetic','human_review_feedback','observer_shadow_mode')),
  constraint ai_dataset_privacy_check check (privacy_review_status in ('pending_review','approved','restricted','rejected')),
  constraint ai_dataset_approval_check check (approval_status in ('draft','review_ready','approved','restricted','retired')),
  constraint ai_dataset_quality_check check (quality_score between 0 and 100 and sample_count >= 0)
);

create table if not exists public.ai_model_calibrations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.ai_models(id) on delete cascade,
  model_key text not null,
  calibration_scope text not null default 'global',
  confidence_threshold numeric(4,3) not null default 0.700,
  alert_threshold numeric(4,3) not null default 0.850,
  false_positive_rate numeric(5,2) not null default 0,
  false_negative_rate numeric(5,2) not null default 0,
  calibration_status text not null default 'not_started',
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(model_key, calibration_scope),
  constraint ai_model_calibration_scope_check check (calibration_scope in ('global','gan_batuach','school_safe','business_observer','home_observer','site_specific','camera_specific')),
  constraint ai_model_calibration_status_check check (calibration_status in ('not_started','collecting','calibrating','review_ready','approved','blocked')),
  constraint ai_model_calibration_rate_check check (
    confidence_threshold between 0 and 1
    and alert_threshold between 0 and 1
    and false_positive_rate between 0 and 100
    and false_negative_rate between 0 and 100
  )
);

create table if not exists public.ai_model_evaluations (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.ai_models(id) on delete cascade,
  dataset_id uuid references public.ai_training_datasets(id) on delete set null,
  evaluation_name text not null,
  evaluation_environment text not null default 'testing',
  accuracy numeric(5,2) not null default 0,
  precision_score numeric(5,2) not null default 0,
  recall_score numeric(5,2) not null default 0,
  confidence_stability numeric(5,2) not null default 0,
  drift_indicator numeric(5,2) not null default 0,
  evaluation_status text not null default 'queued',
  evaluated_by uuid references public.profiles(id) on delete set null,
  evaluated_at timestamptz,
  findings jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  constraint ai_model_evaluation_environment_check check (evaluation_environment in ('testing','shadow','pilot','production_monitoring')),
  constraint ai_model_evaluation_status_check check (evaluation_status in ('queued','running','completed','failed','needs_review')),
  constraint ai_model_evaluation_score_check check (
    accuracy between 0 and 100
    and precision_score between 0 and 100
    and recall_score between 0 and 100
    and confidence_stability between 0 and 100
    and drift_indicator between 0 and 100
  )
);

create table if not exists public.ai_model_deployments (
  id uuid primary key default gen_random_uuid(),
  model_id uuid references public.ai_models(id) on delete cascade,
  deployment_stage text not null default 'draft',
  deployment_environment text not null default 'testing',
  approval_status text not null default 'pending_review',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  deployed_by uuid references public.profiles(id) on delete set null,
  deployed_at timestamptz,
  rollback_available boolean not null default true,
  rollback_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_model_deployment_stage_check check (deployment_stage in ('draft','testing','pilot','approved','production','retired')),
  constraint ai_model_deployment_environment_check check (deployment_environment in ('testing','shadow','pilot','production')),
  constraint ai_model_deployment_approval_check check (approval_status in ('pending_review','approved','rejected','rollback_required'))
);

create table if not exists public.ai_vertical_capability_matrix (
  id uuid primary key default gen_random_uuid(),
  vertical_key text not null,
  module_name text not null,
  capability_key text not null,
  capability_name text not null,
  enabled boolean not null default false,
  regulatory_mode text not null default 'restricted',
  human_review_required boolean not null default true,
  parent_visible_allowed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vertical_key, capability_key),
  constraint ai_capability_vertical_check check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer')),
  constraint ai_capability_regulatory_mode_check check (regulatory_mode in ('disabled','restricted','shadow_only','human_review','approved_use'))
);

create table if not exists public.ai_governance_reviews (
  id uuid primary key default gen_random_uuid(),
  review_subject_type text not null,
  review_subject_id uuid,
  review_type text not null,
  status text not null default 'pending',
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  decision_summary text,
  restrictions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ai_governance_subject_check check (review_subject_type in ('model','dataset','calibration','deployment','capability','assistant')),
  constraint ai_governance_review_type_check check (review_type in ('privacy','safety','accuracy','deployment','rollback','regulatory')),
  constraint ai_governance_status_check check (status in ('pending','approved','approved_with_restrictions','rejected','needs_changes'))
);

create table if not exists public.ai_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint ai_audit_event_type_check check (event_type in ('model_created','model_changed','threshold_changed','dataset_changed','evaluation_recorded','deployment_requested','deployment_approved','deployment_rejected','rollback_requested','capability_changed','governance_reviewed'))
);

create index if not exists ai_models_category_status_idx on public.ai_models(category, lifecycle_status, deployment_status);
create index if not exists ai_training_datasets_source_status_idx on public.ai_training_datasets(dataset_source, approval_status);
create index if not exists ai_model_calibrations_model_idx on public.ai_model_calibrations(model_key, calibration_status);
create unique index if not exists ai_model_calibrations_model_scope_uidx on public.ai_model_calibrations(model_key, calibration_scope);
create index if not exists ai_model_evaluations_model_idx on public.ai_model_evaluations(model_id, created_at desc);
create index if not exists ai_model_deployments_stage_idx on public.ai_model_deployments(deployment_stage, approval_status);
create index if not exists ai_capability_matrix_vertical_idx on public.ai_vertical_capability_matrix(vertical_key, enabled);
create index if not exists ai_governance_reviews_subject_idx on public.ai_governance_reviews(review_subject_type, review_subject_id, status);
create index if not exists ai_audit_events_entity_idx on public.ai_audit_events(entity_type, entity_id, created_at desc);

alter table public.ai_models enable row level security;
alter table public.ai_training_datasets enable row level security;
alter table public.ai_model_calibrations enable row level security;
alter table public.ai_model_evaluations enable row level security;
alter table public.ai_model_deployments enable row level security;
alter table public.ai_vertical_capability_matrix enable row level security;
alter table public.ai_governance_reviews enable row level security;
alter table public.ai_audit_events enable row level security;

drop policy if exists "ai models admin only" on public.ai_models;
create policy "ai models admin only" on public.ai_models for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ai datasets admin only" on public.ai_training_datasets;
create policy "ai datasets admin only" on public.ai_training_datasets for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ai calibrations admin only" on public.ai_model_calibrations;
create policy "ai calibrations admin only" on public.ai_model_calibrations for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ai evaluations admin only" on public.ai_model_evaluations;
create policy "ai evaluations admin only" on public.ai_model_evaluations for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ai deployments admin only" on public.ai_model_deployments;
create policy "ai deployments admin only" on public.ai_model_deployments for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ai capability matrix admin only" on public.ai_vertical_capability_matrix;
create policy "ai capability matrix admin only" on public.ai_vertical_capability_matrix for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ai governance reviews admin only" on public.ai_governance_reviews;
create policy "ai governance reviews admin only" on public.ai_governance_reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "ai audit events admin read" on public.ai_audit_events;
create policy "ai audit events admin read" on public.ai_audit_events for select using (public.is_admin());
drop policy if exists "ai audit events admin insert" on public.ai_audit_events;
create policy "ai audit events admin insert" on public.ai_audit_events for insert with check (public.is_admin());

insert into public.ai_models (model_key, model_name, model_version, model_type, category, lifecycle_status, deployment_status, accuracy, precision_score, recall_score, drift_status, notes, metadata)
values
  ('observer-fall-detection-shadow', 'Fall Detection Shadow Model', '0.1.0', 'vision', 'anomaly_detection', 'testing', 'testing', 0, 0, 0, 'not_measured', 'Shadow-mode model registry entry. Human review required before any action.', '{"automatic_action":false}'::jsonb),
  ('observer-motion-anomaly-shadow', 'Motion Anomaly Shadow Model', '0.1.0', 'vision', 'motion_analytics', 'testing', 'testing', 0, 0, 0, 'not_measured', 'Motion anomaly readiness only. No production promotion.', '{"automatic_action":false}'::jsonb),
  ('risk-recommendation-engine', 'Risk Recommendation Engine', '0.1.0', 'rules_ai', 'risk_scoring', 'draft', 'not_deployed', 0, 0, 0, 'not_measured', 'Advisory risk recommendations only.', '{"recommendations_only":true}'::jsonb),
  ('compliance-intelligence-assistant', 'Compliance Intelligence Assistant', '0.1.0', 'assistant', 'compliance_intelligence', 'draft', 'not_deployed', 0, 0, 0, 'not_measured', 'Compliance summaries require source-backed explanations.', '{"source_backed":true}'::jsonb),
  ('inspection-intelligence-assistant', 'Inspection Intelligence Assistant', '0.1.0', 'assistant', 'inspection_intelligence', 'draft', 'not_deployed', 0, 0, 0, 'not_measured', 'Inspection recommendations require inspector approval.', '{"human_approval_required":true}'::jsonb)
on conflict (model_key) do update set
  model_name = excluded.model_name,
  category = excluded.category,
  updated_at = now();

insert into public.ai_training_datasets (dataset_key, dataset_name, dataset_source, dataset_version, dataset_purpose, sample_count, quality_score, privacy_review_status, approval_status, allowed_for_training, notes, metadata)
values
  ('observer-human-review-feedback', 'Observer Human Review Feedback', 'human_review_feedback', '0.1.0', 'future model validation', 0, 0, 'pending_review', 'draft', false, 'Ground-truth feedback registry. Not approved for training yet.', '{"source":"observer_ground_truth_reviews"}'::jsonb),
  ('observer-shadow-events', 'Observer Shadow Events', 'observer_shadow_mode', '0.1.0', 'calibration and evaluation', 0, 0, 'pending_review', 'draft', false, 'Shadow mode events for evaluation only.', '{"source":"ai_camera_events"}'::jsonb),
  ('synthetic-safety-scenarios', 'Synthetic Safety Scenarios', 'synthetic', '0.1.0', 'safe testing scenarios', 0, 0, 'pending_review', 'draft', false, 'Future synthetic scenarios for validation.', '{}'::jsonb)
on conflict (dataset_key) do update set
  dataset_name = excluded.dataset_name,
  updated_at = now();

insert into public.ai_model_calibrations (model_key, calibration_scope, confidence_threshold, alert_threshold, calibration_status, notes)
values
  ('observer-fall-detection-shadow', 'gan_batuach', 0.700, 0.850, 'collecting', 'Fall detection thresholds require human validation.'),
  ('observer-motion-anomaly-shadow', 'gan_batuach', 0.650, 0.820, 'collecting', 'Motion anomaly calibration uses shadow review feedback.'),
  ('risk-recommendation-engine', 'global', 0.600, 0.800, 'not_started', 'Risk recommendation calibration is advisory only.')
on conflict (model_key, calibration_scope) do update set
  confidence_threshold = excluded.confidence_threshold,
  alert_threshold = excluded.alert_threshold,
  updated_at = now();

insert into public.ai_vertical_capability_matrix (vertical_key, module_name, capability_key, capability_name, enabled, regulatory_mode, human_review_required, parent_visible_allowed, notes)
values
  ('digital_observer_core', 'Digital Observer Core', 'shadow_analysis', 'Shadow analysis', true, 'shadow_only', true, false, 'Safe evaluation without autonomous action.'),
  ('gan_batuach', 'Gan Batuach', 'parent_safe_summaries', 'Parent-safe reviewed summaries', true, 'human_review', true, true, 'Only approved summaries may become parent-visible.'),
  ('gan_batuach', 'Gan Batuach', 'risk_recommendations', 'Risk recommendations', true, 'human_review', true, false, 'Recommendations only. No enforcement.'),
  ('school_safe', 'School Safe', 'school_motion_analytics', 'School motion analytics', false, 'disabled', true, false, 'Future vertical readiness.'),
  ('business_observer', 'Business Observer', 'business_anomaly_detection', 'Business anomaly detection', false, 'disabled', true, false, 'Future vertical readiness.'),
  ('home_observer', 'Home Observer', 'home_safety_monitoring', 'Home safety monitoring', false, 'disabled', true, false, 'Future vertical readiness.')
on conflict (vertical_key, capability_key) do update set
  module_name = excluded.module_name,
  capability_name = excluded.capability_name,
  regulatory_mode = excluded.regulatory_mode,
  human_review_required = excluded.human_review_required,
  parent_visible_allowed = excluded.parent_visible_allowed,
  updated_at = now();

comment on table public.ai_models is 'Controlled AI model registry. No automatic model promotion.';
comment on table public.ai_training_datasets is 'Training dataset readiness registry. Does not store raw datasets.';
comment on table public.ai_model_calibrations is 'Per-model threshold and false-positive/false-negative calibration state.';
comment on table public.ai_vertical_capability_matrix is 'Vertical-specific AI capability restrictions for Digital Observer, Gan Batuach and future modules.';
