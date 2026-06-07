-- PHASE 103: Digital Observer calibration and training program.
-- Measurement and readiness only. No autonomous actions, accusations, parent contact, authority contact or disciplinary outcomes.

alter table public.observer_calibration_profiles
  add column if not exists motion_sensitivity numeric(5,4) not null default 0.60,
  add column if not exists crowd_sensitivity numeric(5,4) not null default 0.55,
  add column if not exists zone_sensitivity numeric(5,4) not null default 0.55,
  add column if not exists alert_threshold numeric(5,4) not null default 0.80,
  add column if not exists observer_model text not null default 'local_shadow',
  add column if not exists deployment_scope text not null default 'shadow',
  add column if not exists training_status text not null default 'collecting_reviews',
  add column if not exists reviewed_events_count integer not null default 0,
  add column if not exists confidence_stability numeric(5,4) not null default 0,
  add column if not exists false_positive_rate numeric(5,4) not null default 0,
  add column if not exists false_negative_rate numeric(5,4) not null default 0,
  add column if not exists last_reviewed_at timestamptz;

alter table public.observer_ground_truth_reviews
  add column if not exists camera_id uuid references public.camera_streams(id) on delete set null,
  add column if not exists zone_key text,
  add column if not exists observer_model text not null default 'local_shadow',
  add column if not exists confidence_bucket text,
  add column if not exists reviewer_decision_latency_seconds integer,
  add column if not exists production_action_blocked boolean not null default true;

alter table public.observer_event_replay_logs
  add column if not exists camera_id uuid references public.camera_streams(id) on delete set null,
  add column if not exists replay_reason text,
  add column if not exists event_timeline jsonb not null default '[]'::jsonb,
  add column if not exists observer_factors jsonb not null default '{}'::jsonb,
  add column if not exists human_review_required boolean not null default true,
  add column if not exists no_action_taken boolean not null default true;

create table if not exists public.observer_performance_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  scope_type text not null default 'global',
  kindergarten_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_key text,
  observer_model text not null default 'local_shadow',
  deployment_scope text not null default 'shadow',
  reviewed_events_count integer not null default 0,
  correct_detection_count integer not null default 0,
  missed_detection_count integer not null default 0,
  false_positive_count integer not null default 0,
  false_negative_count integer not null default 0,
  uncertain_count integer not null default 0,
  precision_score numeric(6,4) not null default 0,
  recall_score numeric(6,4) not null default 0,
  false_positive_rate numeric(6,4) not null default 0,
  false_negative_rate numeric(6,4) not null default 0,
  confidence_average numeric(6,4) not null default 0,
  confidence_stability numeric(6,4) not null default 0,
  maturity_score integer not null default 0,
  readiness_score integer not null default 0,
  calibration_status text not null default 'collecting',
  training_status text not null default 'not_ready',
  human_review_required boolean not null default true,
  autonomous_actions_blocked boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint observer_performance_scope_check check (scope_type in ('global','site','camera','zone','model','deployment')),
  constraint observer_performance_deployment_check check (deployment_scope in ('shadow','test','pilot','production_candidate')),
  constraint observer_performance_calibration_status_check check (calibration_status in ('collecting','calibrating','review_ready','stable','blocked')),
  constraint observer_performance_training_status_check check (training_status in ('not_ready','collecting','review_ready','candidate','blocked')),
  constraint observer_performance_scores_check check (
    precision_score between 0 and 1
    and recall_score between 0 and 1
    and false_positive_rate between 0 and 1
    and false_negative_rate between 0 and 1
    and confidence_average between 0 and 1
    and confidence_stability between 0 and 1
    and maturity_score between 0 and 100
    and readiness_score between 0 and 100
  )
);

create table if not exists public.observer_training_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  scope_type text not null default 'global',
  kindergarten_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  observer_model text not null default 'local_shadow',
  reviewed_events_count integer not null default 0,
  accepted_events_count integer not null default 0,
  rejected_events_count integer not null default 0,
  uncertain_events_count integer not null default 0,
  training_status text not null default 'not_ready',
  dataset_readiness_score integer not null default 0,
  cross_site_learning_allowed boolean not null default false,
  personal_data_shared boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint observer_training_scope_check check (scope_type in ('global','site','camera','zone','model','deployment')),
  constraint observer_training_status_check check (training_status in ('not_ready','collecting','review_ready','candidate','blocked')),
  constraint observer_training_score_check check (dataset_readiness_score between 0 and 100)
);

create table if not exists public.observer_model_readiness_catalog (
  id uuid primary key default gen_random_uuid(),
  model_key text not null unique,
  model_name text not null,
  provider_type text not null,
  activation_status text not null default 'architecture_only',
  supports_vision boolean not null default true,
  supports_audio boolean not null default false,
  requires_external_provider boolean not null default false,
  human_review_required boolean not null default true,
  autonomous_actions_blocked boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_model_activation_check check (activation_status in ('architecture_only','test_ready','disabled','blocked'))
);

create index if not exists observer_performance_scope_idx on public.observer_performance_snapshots(scope_type, readiness_score, calculated_at desc);
create index if not exists observer_performance_site_idx on public.observer_performance_snapshots(observer_site_id, camera_id, calculated_at desc);
create index if not exists observer_training_status_idx on public.observer_training_readiness(scope_type, training_status, dataset_readiness_score);
create index if not exists observer_ground_truth_scope_idx on public.observer_ground_truth_reviews(observer_site_id, kindergarten_id, camera_id, observer_model, created_at desc);
create index if not exists observer_replay_scope_idx on public.observer_event_replay_logs(camera_id, event_source, created_at desc);

alter table public.observer_performance_snapshots enable row level security;
alter table public.observer_training_readiness enable row level security;
alter table public.observer_model_readiness_catalog enable row level security;

drop policy if exists "observer performance snapshots admin only" on public.observer_performance_snapshots;
create policy "observer performance snapshots admin only"
on public.observer_performance_snapshots
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer training readiness admin only" on public.observer_training_readiness;
create policy "observer training readiness admin only"
on public.observer_training_readiness
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer model readiness catalog admin only" on public.observer_model_readiness_catalog;
create policy "observer model readiness catalog admin only"
on public.observer_model_readiness_catalog
for all using (public.is_admin())
with check (public.is_admin());

insert into public.observer_model_readiness_catalog (
  model_key,
  model_name,
  provider_type,
  activation_status,
  supports_vision,
  supports_audio,
  requires_external_provider,
  notes,
  metadata
)
values
  ('yolo', 'YOLO', 'vision', 'architecture_only', true, false, false, 'Future object/action detection readiness only.', '{"activated":false}'::jsonb),
  ('opencv', 'OpenCV', 'vision', 'architecture_only', true, false, false, 'Future local computer vision pipeline readiness only.', '{"activated":false}'::jsonb),
  ('tensorflow', 'TensorFlow', 'vision', 'architecture_only', true, false, false, 'Future model runtime readiness only.', '{"activated":false}'::jsonb),
  ('gemini_vision', 'Gemini Vision', 'vision', 'architecture_only', true, false, true, 'Future cloud vision provider readiness only.', '{"activated":false}'::jsonb),
  ('gpt_vision', 'GPT Vision', 'vision', 'architecture_only', true, false, true, 'Future cloud vision provider readiness only.', '{"activated":false}'::jsonb),
  ('custom_model', 'Custom Model', 'custom', 'architecture_only', true, true, false, 'Future custom model readiness only.', '{"activated":false}'::jsonb)
on conflict (model_key) do update set
  model_name = excluded.model_name,
  provider_type = excluded.provider_type,
  activation_status = excluded.activation_status,
  supports_vision = excluded.supports_vision,
  supports_audio = excluded.supports_audio,
  requires_external_provider = excluded.requires_external_provider,
  notes = excluded.notes,
  metadata = public.observer_model_readiness_catalog.metadata || excluded.metadata,
  updated_at = now();

insert into public.observer_training_readiness (
  readiness_key,
  scope_type,
  observer_model,
  training_status,
  dataset_readiness_score,
  notes,
  metadata
)
values
  ('global_local_shadow', 'global', 'local_shadow', 'collecting', 35, 'Collect reviewed events before any model training dataset is created.', '{"personal_data_shared":false,"dataset_created":false}'::jsonb),
  ('site_specific_learning', 'site', 'local_shadow', 'collecting', 30, 'Prepare site-specific learning without sharing personal data across sites.', '{"personal_data_shared":false,"cross_site_learning_allowed":false}'::jsonb),
  ('global_pattern_learning', 'global', 'local_shadow', 'not_ready', 20, 'Future global improvements may use aggregate patterns only, not personal data.', '{"personal_data_shared":false,"aggregate_only":true}'::jsonb)
on conflict (readiness_key) do update set
  training_status = excluded.training_status,
  dataset_readiness_score = excluded.dataset_readiness_score,
  notes = excluded.notes,
  metadata = public.observer_training_readiness.metadata || excluded.metadata,
  updated_at = now();

insert into public.observer_performance_snapshots (
  snapshot_key,
  scope_type,
  observer_model,
  deployment_scope,
  reviewed_events_count,
  readiness_score,
  maturity_score,
  calibration_status,
  training_status,
  human_review_required,
  autonomous_actions_blocked,
  metadata
)
values (
  'global_shadow_baseline',
  'global',
  'local_shadow',
  'shadow',
  0,
  35,
  25,
  'collecting',
  'collecting',
  true,
  true,
  '{"baseline":true,"no_autonomous_actions":true,"no_accusations":true}'::jsonb
)
on conflict (snapshot_key) do update set
  human_review_required = true,
  autonomous_actions_blocked = true,
  metadata = public.observer_performance_snapshots.metadata || excluded.metadata,
  calculated_at = now();

comment on table public.observer_performance_snapshots is 'Measurable observer performance snapshots for precision, recall, false positive/negative rates and readiness. Human review remains required.';
comment on table public.observer_training_readiness is 'Training dataset readiness tracking only. No actual ML dataset is created in this phase.';
comment on table public.observer_model_readiness_catalog is 'Future model architecture catalog. Models are not activated by this migration.';
comment on column public.observer_training_readiness.personal_data_shared is 'Must remain false unless a future privacy-approved aggregate model is implemented.';
comment on column public.observer_performance_snapshots.autonomous_actions_blocked is 'Observer must not trigger actions, contact parents/authorities, or create disciplinary outcomes.';

notify pgrst, 'reload schema';
