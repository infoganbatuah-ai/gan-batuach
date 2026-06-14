-- PHASE 165: Real AI Observer pilot, shadow mode and calibration.
-- Review-only. No automatic accusations, parent notifications, disciplinary actions or safety conclusions.

alter table public.ai_camera_events
  add column if not exists shadow_mode boolean not null default true,
  add column if not exists human_review_required boolean not null default true,
  add column if not exists parent_visible boolean not null default false,
  add column if not exists model_name text,
  add column if not exists model_version text,
  add column if not exists model_provider text not null default 'local_mock',
  add column if not exists model_mode text not null default 'shadow',
  add column if not exists confidence_threshold numeric(5,4),
  add column if not exists processing_latency_ms integer,
  add column if not exists gateway_latency_ms integer;

alter table if exists public.skeleton_observer_events
  add column if not exists shadow_mode boolean not null default true,
  add column if not exists human_review_required boolean not null default true,
  add column if not exists model_name text not null default 'skeleton_motion_engine',
  add column if not exists model_version text not null default '0.1.0',
  add column if not exists model_provider text not null default 'local_mock',
  add column if not exists model_mode text not null default 'shadow',
  add column if not exists confidence_threshold numeric(5,4),
  add column if not exists processing_latency_ms integer,
  add column if not exists gateway_latency_ms integer;

alter table public.observer_ground_truth_reviews
  add column if not exists expected_event_type text,
  add column if not exists approximate_event_time timestamptz,
  add column if not exists false_positive_reason text,
  add column if not exists missed_detection_notes text,
  add column if not exists threshold_used numeric(5,4),
  add column if not exists model_version text,
  add column if not exists model_provider text,
  add column if not exists zone_id uuid references public.camera_zones(id) on delete set null,
  add column if not exists reviewer_role text,
  add column if not exists parent_visible boolean not null default false;

alter table public.observer_ground_truth_reviews drop constraint if exists observer_ground_truth_source_check;
alter table public.observer_ground_truth_reviews add constraint observer_ground_truth_source_check
  check (event_source in ('ai_camera_event','audio_observer_event','observer_correlated_event','skeleton_observer_event','observer_intelligence_signal','missed_event_report'));

alter table public.observer_ground_truth_reviews drop constraint if exists observer_ground_truth_outcome_check;
alter table public.observer_ground_truth_reviews add constraint observer_ground_truth_outcome_check
  check (outcome in ('correct_detection','missed_detection','false_positive','false_negative','uncertain','needs_more_context'));

alter table public.observer_calibration_profiles
  add column if not exists camera_id uuid references public.camera_streams(id) on delete set null,
  add column if not exists zone_id uuid references public.camera_zones(id) on delete set null,
  add column if not exists event_type text,
  add column if not exists motion_sensitivity numeric(5,4) not null default 0.6000,
  add column if not exists inactivity_duration_threshold_seconds integer not null default 45,
  add column if not exists crowding_threshold integer not null default 18,
  add column if not exists restricted_area_sensitivity numeric(5,4) not null default 0.7000,
  add column if not exists last_calibrated_at timestamptz,
  add column if not exists false_positive_count integer not null default 0,
  add column if not exists false_negative_count integer not null default 0,
  add column if not exists reviewed_events_count integer not null default 0;

alter table public.observer_calibration_profiles drop constraint if exists observer_calibration_status_check;
alter table public.observer_calibration_profiles add constraint observer_calibration_status_check
  check (calibration_status in ('not_started','collecting','collecting_data','calibrating','needs_review','review_ready','calibrated','production_candidate','unstable','paused','blocked'));

create table if not exists public.observer_pilot_runs (
  id uuid primary key default gen_random_uuid(),
  pilot_key text not null unique,
  pilot_name text not null,
  scope_type text not null default 'home_test',
  garden_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  home_test_site_id uuid references public.home_camera_test_sites(id) on delete set null,
  status text not null default 'draft',
  shadow_mode boolean not null default true,
  human_review_required boolean not null default true,
  parent_notifications_blocked boolean not null default true,
  automatic_actions_blocked boolean not null default true,
  started_at timestamptz,
  ended_at timestamptz,
  readiness_score integer not null default 0,
  calibration_score integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_pilot_scope_check check (scope_type in ('home_test','demo_camera','kindergarten_test','rtsp_gateway','observer_site')),
  constraint observer_pilot_status_check check (status in ('draft','running','reviewing','paused','completed','blocked')),
  constraint observer_pilot_safety_check check (shadow_mode = true and human_review_required = true and parent_notifications_blocked = true and automatic_actions_blocked = true),
  constraint observer_pilot_score_check check (readiness_score between 0 and 100 and calibration_score between 0 and 100)
);

create table if not exists public.observer_frame_sampling_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  pilot_run_id uuid references public.observer_pilot_runs(id) on delete set null,
  camera_id uuid references public.camera_streams(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  source_type text not null default 'gateway_snapshot',
  status text not null default 'prepared',
  sampling_interval_seconds integer not null default 10,
  raw_frame_persisted boolean not null default false,
  raw_frame_logged boolean not null default false,
  client_side_processing boolean not null default false,
  rtsp_exposed boolean not null default false,
  last_sampled_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_frame_source_check check (source_type in ('gateway_snapshot','secure_frame_sample','demo_frame','home_test_camera')),
  constraint observer_frame_status_check check (status in ('prepared','running','paused','failed','disabled')),
  constraint observer_frame_privacy_check check (raw_frame_persisted = false and raw_frame_logged = false and client_side_processing = false and rtsp_exposed = false)
);

create table if not exists public.observer_pose_adapter_readiness (
  id uuid primary key default gen_random_uuid(),
  adapter_key text not null unique,
  provider text not null,
  model_name text not null,
  model_version text not null default '0.1.0',
  status text not null default 'prepared',
  mode text not null default 'shadow',
  supports_keypoints boolean not null default true,
  raw_frame_storage_allowed boolean not null default false,
  human_review_required boolean not null default true,
  expected_output jsonb not null default '["keypoints","confidence","zone","timestamp","detection_type","model_version"]'::jsonb,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_pose_provider_check check (provider in ('local_mock','local_pose','local_http','future_yolo_pose','future_mediapipe')),
  constraint observer_pose_status_check check (status in ('prepared','configured','test_mode','needs_provider','disabled','failed')),
  constraint observer_pose_mode_check check (mode in ('shadow','test')),
  constraint observer_pose_privacy_check check (raw_frame_storage_allowed = false and human_review_required = true)
);

create table if not exists public.observer_pilot_quality_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  pilot_run_id uuid references public.observer_pilot_runs(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_id uuid references public.camera_zones(id) on delete set null,
  event_type text,
  reviewed_events_count integer not null default 0,
  detection_volume integer not null default 0,
  false_positive_count integer not null default 0,
  false_negative_count integer not null default 0,
  uncertain_count integer not null default 0,
  precision_readiness numeric(6,4) not null default 0,
  recall_readiness numeric(6,4) not null default 0,
  false_positive_rate numeric(6,4) not null default 0,
  false_negative_rate numeric(6,4) not null default 0,
  review_completion_rate numeric(6,4) not null default 0,
  confidence_average numeric(6,4) not null default 0,
  confidence_stability numeric(6,4) not null default 0,
  model_latency_ms integer,
  gateway_latency_ms integer,
  readiness_score integer not null default 0,
  calibration_score integer not null default 0,
  production_activation_blocked boolean not null default true,
  blocker_reason text,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint observer_pilot_quality_scores_check check (
    precision_readiness between 0 and 1
    and recall_readiness between 0 and 1
    and false_positive_rate between 0 and 1
    and false_negative_rate between 0 and 1
    and review_completion_rate between 0 and 1
    and confidence_average between 0 and 1
    and confidence_stability between 0 and 1
    and readiness_score between 0 and 100
    and calibration_score between 0 and 100
  )
);

create table if not exists public.observer_pilot_dataset_registry (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null unique,
  pilot_run_id uuid references public.observer_pilot_runs(id) on delete set null,
  dataset_scope text not null default 'review_metadata_only',
  reviewed_events_count integer not null default 0,
  confirmed_events_count integer not null default 0,
  dismissed_events_count integer not null default 0,
  uncertain_events_count integer not null default 0,
  false_positive_count integer not null default 0,
  false_negative_count integer not null default 0,
  raw_video_export_allowed boolean not null default false,
  sensitive_data_export_allowed boolean not null default false,
  legal_approval_required boolean not null default true,
  status text not null default 'collecting',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_pilot_dataset_scope_check check (dataset_scope in ('review_metadata_only','skeleton_vectors_only','aggregate_metrics')),
  constraint observer_pilot_dataset_status_check check (status in ('collecting','needs_review','approved_metadata_only','blocked')),
  constraint observer_pilot_dataset_privacy_check check (raw_video_export_allowed = false and sensitive_data_export_allowed = false)
);

create table if not exists public.observer_pilot_safety_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  title text not null,
  status text not null default 'enforced',
  blocks_production boolean not null default true,
  evidence_table text,
  minimum_required integer,
  current_value integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_pilot_safety_status_check check (status in ('enforced','needs_review','blocked','satisfied'))
);

create index if not exists observer_pilot_runs_status_idx on public.observer_pilot_runs(scope_type, status, created_at desc);
create index if not exists observer_frame_sampling_camera_idx on public.observer_frame_sampling_jobs(camera_id, status);
create index if not exists observer_pose_adapter_status_idx on public.observer_pose_adapter_readiness(provider, status);
create index if not exists observer_pilot_quality_score_idx on public.observer_pilot_quality_snapshots(readiness_score, calculated_at desc);
create index if not exists observer_pilot_dataset_status_idx on public.observer_pilot_dataset_registry(status, dataset_scope);
create index if not exists observer_pilot_safety_status_idx on public.observer_pilot_safety_rules(status, blocks_production);
create index if not exists observer_ground_truth_false_positive_idx on public.observer_ground_truth_reviews(false_positive_reason, created_at desc) where outcome = 'false_positive';
create index if not exists observer_ground_truth_false_negative_idx on public.observer_ground_truth_reviews(expected_event_type, approximate_event_time desc) where outcome in ('false_negative','missed_detection');

alter table public.observer_pilot_runs enable row level security;
alter table public.observer_frame_sampling_jobs enable row level security;
alter table public.observer_pose_adapter_readiness enable row level security;
alter table public.observer_pilot_quality_snapshots enable row level security;
alter table public.observer_pilot_dataset_registry enable row level security;
alter table public.observer_pilot_safety_rules enable row level security;

drop policy if exists "observer pilot runs admin manager inspector scoped" on public.observer_pilot_runs;
create policy "observer pilot runs admin manager inspector scoped" on public.observer_pilot_runs
for select using (
  public.is_admin()
  or garden_id = public.current_garden_id()
  or exists (select 1 from public.gardens g where g.id = observer_pilot_runs.garden_id and g.inspector_id = auth.uid())
);

drop policy if exists "observer pilot runs admin write" on public.observer_pilot_runs;
create policy "observer pilot runs admin write" on public.observer_pilot_runs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer frame sampling admin only" on public.observer_frame_sampling_jobs;
create policy "observer frame sampling admin only" on public.observer_frame_sampling_jobs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer pose adapters admin only" on public.observer_pose_adapter_readiness;
create policy "observer pose adapters admin only" on public.observer_pose_adapter_readiness for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer pilot quality scoped read" on public.observer_pilot_quality_snapshots;
create policy "observer pilot quality scoped read" on public.observer_pilot_quality_snapshots
for select using (
  public.is_admin()
  or garden_id = public.current_garden_id()
  or exists (select 1 from public.gardens g where g.id = observer_pilot_quality_snapshots.garden_id and g.inspector_id = auth.uid())
);

drop policy if exists "observer pilot quality admin write" on public.observer_pilot_quality_snapshots;
create policy "observer pilot quality admin write" on public.observer_pilot_quality_snapshots for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer pilot dataset admin only" on public.observer_pilot_dataset_registry;
create policy "observer pilot dataset admin only" on public.observer_pilot_dataset_registry for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer pilot safety admin only" on public.observer_pilot_safety_rules;
create policy "observer pilot safety admin only" on public.observer_pilot_safety_rules for all using (public.is_admin()) with check (public.is_admin());

insert into public.observer_pose_adapter_readiness (adapter_key, provider, model_name, model_version, status, mode, notes, metadata)
values
  ('local-mock-pose', 'local_mock', 'Mock Pose Adapter', '0.1.0', 'test_mode', 'shadow', 'Safe deterministic fallback. No raw frame storage.', '{"real_processing":false}'::jsonb),
  ('local-http-pose', 'local_http', 'Local HTTP Pose Endpoint', '0.1.0', 'needs_provider', 'shadow', 'Future local endpoint for pose extraction. Requires LOCAL_VISION_ENDPOINT.', '{"required_env":["LOCAL_VISION_ENDPOINT"]}'::jsonb),
  ('future-yolov8-pose', 'future_yolo_pose', 'YOLOv8-Pose', 'future', 'prepared', 'shadow', 'Future worker-side pose model.', '{"raw_frame_persistence":false}'::jsonb),
  ('future-mediapipe-pose', 'future_mediapipe', 'MediaPipe Pose', 'future', 'prepared', 'shadow', 'Future worker-side MediaPipe pose model.', '{"raw_frame_persistence":false}'::jsonb)
on conflict (adapter_key) do update set
  provider = excluded.provider,
  model_name = excluded.model_name,
  model_version = excluded.model_version,
  status = excluded.status,
  mode = excluded.mode,
  notes = excluded.notes,
  metadata = public.observer_pose_adapter_readiness.metadata || excluded.metadata,
  updated_at = now();

insert into public.observer_pilot_runs (pilot_key, pilot_name, scope_type, status, shadow_mode, readiness_score, calibration_score, notes, metadata)
values
  ('daniel-home-camera-shadow-pilot', 'Daniel home camera shadow pilot', 'home_test', 'draft', true, 42, 30, 'First safe real-camera observer pilot. No parent access and no production actions.', '{"phase":165,"no_parent_visibility":true}'::jsonb),
  ('demo-camera-shadow-pilot', 'Demo camera shadow pilot', 'demo_camera', 'draft', true, 38, 25, 'Demo stream observer pilot for UI and workflow validation.', '{"phase":165}'::jsonb)
on conflict (pilot_key) do update set
  pilot_name = excluded.pilot_name,
  scope_type = excluded.scope_type,
  status = excluded.status,
  shadow_mode = true,
  human_review_required = true,
  parent_notifications_blocked = true,
  automatic_actions_blocked = true,
  readiness_score = excluded.readiness_score,
  calibration_score = excluded.calibration_score,
  notes = excluded.notes,
  metadata = public.observer_pilot_runs.metadata || excluded.metadata,
  updated_at = now();

insert into public.observer_pilot_quality_snapshots (snapshot_key, readiness_score, calibration_score, production_activation_blocked, blocker_reason, metadata)
values (
  'global-observer-pilot-shadow-baseline',
  40,
  28,
  true,
  'Production observer activation is blocked until enough reviewed events, acceptable false-positive rate, false-negative tracking and legal mode evidence exist.',
  '{"phase":165,"shadow_mode":true}'::jsonb
)
on conflict (snapshot_key) do update set
  readiness_score = excluded.readiness_score,
  calibration_score = excluded.calibration_score,
  production_activation_blocked = true,
  blocker_reason = excluded.blocker_reason,
  metadata = public.observer_pilot_quality_snapshots.metadata || excluded.metadata,
  calculated_at = now();

insert into public.observer_pilot_dataset_registry (dataset_key, dataset_scope, status, notes, metadata)
values (
  'observer-pilot-review-metadata',
  'review_metadata_only',
  'collecting',
  'Safe pilot dataset registry. No raw video export and no sensitive data export.',
  '{"phase":165,"raw_video_export_allowed":false}'::jsonb
)
on conflict (dataset_key) do update set
  status = excluded.status,
  notes = excluded.notes,
  metadata = public.observer_pilot_dataset_registry.metadata || excluded.metadata,
  updated_at = now();

insert into public.observer_pilot_safety_rules (rule_key, title, status, blocks_production, evidence_table, minimum_required, current_value, notes, metadata)
values
  ('reviewed-events-minimum', 'Enough events reviewed before production mode', 'enforced', true, 'observer_ground_truth_reviews', 100, 0, 'Requires sufficient human reviewed events.', '{}'::jsonb),
  ('false-positive-rate-acceptable', 'False positive rate acceptable', 'enforced', true, 'observer_pilot_quality_snapshots', 1, 0, 'Threshold must be approved by admin/legal before production candidate.', '{}'::jsonb),
  ('false-negative-tracking-enabled', 'False negative tracking enabled', 'satisfied', true, 'observer_ground_truth_reviews', 1, 1, 'Missed detection and false_negative outcomes are supported.', '{}'::jsonb),
  ('human-review-working', 'Human review workflow working', 'enforced', true, 'observer_ground_truth_reviews', 20, 0, 'All detections must enter pending review.', '{}'::jsonb),
  ('legal-mode-enforced', 'Gan Batuach Israel mode enforced', 'satisfied', true, 'observer_pose_adapter_readiness', 1, 1, 'Audio, face recognition and parent raw visibility are blocked.', '{}'::jsonb),
  ('camera-health-stable', 'Camera health stable', 'enforced', true, 'camera_streams', 1, 0, 'Real pilot requires stable gateway/camera health.', '{}'::jsonb)
on conflict (rule_key) do update set
  title = excluded.title,
  status = excluded.status,
  blocks_production = excluded.blocks_production,
  evidence_table = excluded.evidence_table,
  minimum_required = excluded.minimum_required,
  notes = excluded.notes,
  metadata = public.observer_pilot_safety_rules.metadata || excluded.metadata,
  updated_at = now();

update public.ai_camera_events
set
  shadow_mode = true,
  observer_shadow_mode = true,
  human_review_required = true,
  parent_visible = false,
  model_mode = 'shadow'
where true;

do $$
begin
  if to_regclass('public.skeleton_observer_events') is not null then
    update public.skeleton_observer_events
    set
      shadow_mode = true,
      human_review_required = true,
      parent_visible = false,
      raw_frame_stored = false,
      face_data_present = false,
      audio_data_present = false,
      identity_fields_present = false,
      model_mode = 'shadow'
    where true;
  end if;
end $$;

comment on table public.observer_pilot_runs is 'Real AI Observer pilot registry. Shadow mode and human review are mandatory.';
comment on table public.observer_frame_sampling_jobs is 'Secure frame sampling pipeline readiness. Raw frames are not persisted or logged by default.';
comment on table public.observer_pose_adapter_readiness is 'Pose/skeleton adapter readiness for YOLOv8-Pose, MediaPipe, local HTTP and mock fallback.';
comment on table public.observer_pilot_quality_snapshots is 'Pilot quality metrics: false positives, false negatives, review rate, latency and readiness.';
comment on table public.observer_pilot_dataset_registry is 'Safe reviewed-event dataset registry. No raw video export in Gan Batuach without legal approval.';

notify pgrst, 'reload schema';
