alter table public.ai_camera_events
  add column if not exists vision_provider text,
  add column if not exists vision_model_version text,
  add column if not exists model_confidence numeric(5, 4),
  add column if not exists review_confidence numeric(5, 4),
  add column if not exists learning_confidence numeric(5, 4),
  add column if not exists correlation_confidence numeric(5, 4),
  add column if not exists combined_confidence numeric(5, 4),
  add column if not exists calibration_mode boolean not null default true,
  add column if not exists detection_category text,
  add column if not exists recommended_action text,
  add column if not exists false_positive_calibrated_at timestamptz;

create table if not exists public.vision_provider_registry (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  provider_type text not null,
  capabilities jsonb not null default '{}'::jsonb,
  supported_categories jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  endpoint_required boolean not null default false,
  shadow_mode_required boolean not null default true,
  human_review_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vision_provider_registry_type_check check (provider_type in ('mock','opencv','yolo','ultralytics','local_http','custom'))
);

create table if not exists public.vision_frame_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  provider_key text not null default 'local_mock',
  status text not null default 'queued',
  priority integer not null default 5,
  shadow_mode boolean not null default true,
  requires_human_review boolean not null default true,
  calibration_mode boolean not null default true,
  sampled_at timestamptz,
  processed_at timestamptz,
  latency_ms integer,
  processing_time_ms integer,
  frame_source_type text not null default 'mock_frame',
  no_raw_frame_stored boolean not null default true,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vision_jobs_status_check check (status in ('queued','sampling','processing','completed','failed','skipped')),
  constraint vision_jobs_frame_source_check check (frame_source_type in ('gateway_snapshot','mock_frame','local_file','none')),
  constraint vision_jobs_scope_check check (kindergarten_id is not null or observer_site_id is not null)
);

create table if not exists public.vision_detection_results (
  id uuid primary key default gen_random_uuid(),
  analysis_job_id uuid references public.vision_frame_analysis_jobs(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  event_id uuid references public.ai_camera_events(id) on delete set null,
  detection_category text not null,
  model_confidence numeric(5, 4) not null default 0,
  review_confidence numeric(5, 4),
  learning_confidence numeric(5, 4),
  correlation_confidence numeric(5, 4),
  combined_confidence numeric(5, 4) not null default 0,
  bounding_boxes jsonb not null default '[]'::jsonb,
  object_labels jsonb not null default '[]'::jsonb,
  recommended_action text,
  shadow_mode boolean not null default true,
  requires_human_review boolean not null default true,
  calibration_mode boolean not null default true,
  parent_visible boolean not null default false,
  sanitized_provider_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint vision_detection_category_check check (detection_category in ('person_detected','multiple_persons_detected','occupancy','restricted_area_presence','unusual_activity','object_presence','obstruction_detection','camera_blocked','camera_frozen','camera_offline')),
  constraint vision_detection_confidence_check check (
    model_confidence between 0 and 1
    and coalesce(review_confidence, 0) between 0 and 1
    and coalesce(learning_confidence, 0) between 0 and 1
    and coalesce(correlation_confidence, 0) between 0 and 1
    and combined_confidence between 0 and 1
  ),
  constraint vision_detection_scope_check check (kindergarten_id is not null or observer_site_id is not null)
);

create table if not exists public.vision_diagnostics (
  id uuid primary key default gen_random_uuid(),
  kindergarten_id uuid references public.gardens(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  provider_key text not null default 'local_mock',
  model_name text,
  model_version text,
  model_health text not null default 'mock',
  detection_volume integer not null default 0,
  false_positive_rate numeric(5, 4) not null default 0,
  average_latency_ms numeric,
  average_processing_time_ms numeric,
  model_confidence_avg numeric(5, 4),
  review_confidence_avg numeric(5, 4),
  learning_confidence_avg numeric(5, 4),
  correlation_confidence_avg numeric(5, 4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint vision_diagnostics_health_check check (model_health in ('healthy','degraded','offline','unknown','mock')),
  constraint vision_diagnostics_rate_check check (false_positive_rate between 0 and 1)
);

create table if not exists public.vision_calibration_feedback (
  id uuid primary key default gen_random_uuid(),
  detection_result_id uuid references public.vision_detection_results(id) on delete cascade,
  event_id uuid references public.ai_camera_events(id) on delete set null,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_outcome text not null,
  confidence_adjustment numeric(5, 4) not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint vision_calibration_outcome_check check (review_outcome in ('confirmed','dismissed','false_positive','escalated','valid_detection','needs_more_data')),
  constraint vision_calibration_scope_check check (kindergarten_id is not null or observer_site_id is not null)
);

create index if not exists idx_ai_camera_events_vision_category on public.ai_camera_events(detection_category, created_at desc);
create index if not exists idx_ai_camera_events_vision_confidence on public.ai_camera_events(combined_confidence desc nulls last);
create index if not exists idx_vision_jobs_kindergarten on public.vision_frame_analysis_jobs(kindergarten_id, status, created_at desc);
create index if not exists idx_vision_jobs_site on public.vision_frame_analysis_jobs(observer_site_id, status, created_at desc);
create index if not exists idx_vision_jobs_camera on public.vision_frame_analysis_jobs(camera_id, created_at desc);
create index if not exists idx_vision_results_kindergarten on public.vision_detection_results(kindergarten_id, detection_category, created_at desc);
create index if not exists idx_vision_results_site on public.vision_detection_results(observer_site_id, detection_category, created_at desc);
create index if not exists idx_vision_results_event on public.vision_detection_results(event_id);
create index if not exists idx_vision_diagnostics_provider on public.vision_diagnostics(provider_key, created_at desc);
create index if not exists idx_vision_diagnostics_kindergarten on public.vision_diagnostics(kindergarten_id, created_at desc);
create index if not exists idx_vision_calibration_kindergarten on public.vision_calibration_feedback(kindergarten_id, review_outcome, created_at desc);
create index if not exists idx_vision_calibration_event on public.vision_calibration_feedback(event_id);

alter table public.vision_provider_registry enable row level security;
alter table public.vision_frame_analysis_jobs enable row level security;
alter table public.vision_detection_results enable row level security;
alter table public.vision_diagnostics enable row level security;
alter table public.vision_calibration_feedback enable row level security;

drop policy if exists "vision provider registry readable" on public.vision_provider_registry;
create policy "vision provider registry readable" on public.vision_provider_registry
for select using (active = true or public.is_admin());

drop policy if exists "vision provider registry admin write" on public.vision_provider_registry;
create policy "vision provider registry admin write" on public.vision_provider_registry
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vision jobs scoped read" on public.vision_frame_analysis_jobs;
create policy "vision jobs scoped read" on public.vision_frame_analysis_jobs
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "vision jobs scoped insert" on public.vision_frame_analysis_jobs;
create policy "vision jobs scoped insert" on public.vision_frame_analysis_jobs
for insert with check (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id))
);

drop policy if exists "vision jobs admin update" on public.vision_frame_analysis_jobs;
create policy "vision jobs admin update" on public.vision_frame_analysis_jobs
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vision results scoped read" on public.vision_detection_results;
create policy "vision results scoped read" on public.vision_detection_results
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "vision results scoped insert" on public.vision_detection_results;
create policy "vision results scoped insert" on public.vision_detection_results
for insert with check (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner') and public.can_access_garden(kindergarten_id))
);

drop policy if exists "vision diagnostics scoped read" on public.vision_diagnostics;
create policy "vision diagnostics scoped read" on public.vision_diagnostics
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "vision diagnostics admin write" on public.vision_diagnostics;
create policy "vision diagnostics admin write" on public.vision_diagnostics
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vision calibration scoped read" on public.vision_calibration_feedback;
create policy "vision calibration scoped read" on public.vision_calibration_feedback
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.can_access_garden(kindergarten_id))
);

drop policy if exists "vision calibration scoped insert" on public.vision_calibration_feedback;
create policy "vision calibration scoped insert" on public.vision_calibration_feedback
for insert with check (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id))
);

insert into public.vision_provider_registry (provider_key, provider_name, provider_type, capabilities, supported_categories, endpoint_required, metadata)
values
  ('local_mock', 'Local Mock Vision', 'mock', '{"real_processing":false,"external_ai":false,"shadow_mode":true,"human_review":true}'::jsonb, '["person_detected","multiple_persons_detected","occupancy","restricted_area_presence","unusual_activity","object_presence","obstruction_detection","camera_blocked","camera_frozen","camera_offline"]'::jsonb, false, '{"production_default":true,"safe_without_dependencies":true}'::jsonb),
  ('opencv', 'OpenCV Local Adapter', 'opencv', '{"real_processing":true,"external_ai":false,"requires_runtime":true,"shadow_mode":true,"human_review":true}'::jsonb, '["person_detected","multiple_persons_detected","occupancy","object_presence","obstruction_detection","camera_blocked","camera_frozen"]'::jsonb, false, '{"setup_required":"Install OpenCV runtime in the worker environment."}'::jsonb),
  ('yolo', 'YOLO Local Adapter', 'yolo', '{"real_processing":true,"external_ai":false,"requires_model":true,"shadow_mode":true,"human_review":true}'::jsonb, '["person_detected","multiple_persons_detected","occupancy","restricted_area_presence","object_presence","unusual_activity"]'::jsonb, false, '{"setup_required":"Install YOLO model weights in the worker environment."}'::jsonb),
  ('ultralytics', 'Ultralytics Local Adapter', 'ultralytics', '{"real_processing":true,"external_ai":false,"requires_model":true,"shadow_mode":true,"human_review":true}'::jsonb, '["person_detected","multiple_persons_detected","occupancy","restricted_area_presence","object_presence","unusual_activity"]'::jsonb, false, '{"setup_required":"Install Ultralytics and local model weights in the worker environment."}'::jsonb),
  ('local_http', 'Local HTTP Vision Endpoint', 'local_http', '{"real_processing":true,"external_ai":false,"local_endpoint":true,"shadow_mode":true,"human_review":true}'::jsonb, '["person_detected","multiple_persons_detected","occupancy","restricted_area_presence","unusual_activity","object_presence","obstruction_detection","camera_blocked","camera_frozen","camera_offline"]'::jsonb, true, '{"env":"LOCAL_VISION_ENDPOINT"}'::jsonb)
on conflict (provider_key) do update set
  provider_name = excluded.provider_name,
  provider_type = excluded.provider_type,
  capabilities = excluded.capabilities,
  supported_categories = excluded.supported_categories,
  endpoint_required = excluded.endpoint_required,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.vision_provider_registry is 'Production-ready vision provider registry. Providers stay in shadow mode and require human review.';
comment on table public.vision_frame_analysis_jobs is 'Frame analysis pipeline jobs. Raw frames/streams are not exposed or stored by default.';
comment on table public.vision_detection_results is 'Sanitized computer-vision detection results for human review and calibration.';
comment on table public.vision_diagnostics is 'Vision model health, latency, processing time, confidence and false-positive diagnostics.';
comment on table public.vision_calibration_feedback is 'Human review feedback used to calibrate confidence. No autonomous decisions.';
