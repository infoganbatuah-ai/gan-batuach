-- PHASE 152: Skeleton Analytics, Motion Intelligence & Anonymous Observer Platform
-- Privacy-preserving motion intelligence. No face recognition, no audio processing, no raw identity tracking.

alter table if exists public.observer_intelligence_signals
  drop constraint if exists observer_intelligence_signal_type_check;

alter table if exists public.observer_intelligence_signals
  add constraint observer_intelligence_signal_type_check check (signal_type in (
    'ai_camera',
    'legacy_ai',
    'audio',
    'correlated',
    'safety_incident',
    'complaint',
    'inspection',
    'compliance',
    'camera_health',
    'staff_attendance',
    'pattern',
    'skeleton_motion'
  ));

alter table if exists public.observer_intelligence_signals
  drop constraint if exists observer_intelligence_source_type_check;

alter table if exists public.observer_intelligence_signals
  add constraint observer_intelligence_source_type_check check (source_type in (
    'ai_camera_events',
    'ai_events',
    'audio_observer_events',
    'observer_correlated_events',
    'incident_reports',
    'complaints',
    'national_compliance_findings',
    'compliance_alerts',
    'camera_health_history',
    'camera_streams',
    'attendance',
    'required_inspections',
    'system',
    'skeleton_motion'
  ));

create table if not exists public.skeleton_observer_events (
  id uuid primary key default gen_random_uuid(),
  anonymized_skeleton_uuid uuid not null default gen_random_uuid(),
  camera_id uuid references public.camera_streams(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  zone_id uuid references public.camera_zones(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  event_type text not null,
  keypoint_metadata jsonb not null default '{}'::jsonb,
  skeleton_sequence_metadata jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  event_timestamp timestamptz not null default now(),
  severity text not null default 'medium',
  review_status text not null default 'detected',
  recommended_action text,
  retention_until timestamptz not null default (now() + interval '14 days'),
  legal_hold boolean not null default false,
  parent_visible boolean not null default false,
  raw_frame_stored boolean not null default false,
  face_data_present boolean not null default false,
  audio_data_present boolean not null default false,
  identity_fields_present boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skeleton_observer_event_type_check check (event_type in (
    'fall_suspected',
    'inactivity_suspected',
    'high_velocity_motion',
    'crowding_suspected',
    'supervision_attention_required',
    'restricted_area_presence',
    'unusual_motion_pattern',
    'person_down_suspected',
    'pose_sample',
    'motion_sample'
  )),
  constraint skeleton_observer_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint skeleton_observer_severity_check check (severity in ('info','low','medium','high','urgent','critical')),
  constraint skeleton_observer_review_status_check check (review_status in ('detected','pending_review','reviewing','dismissed','confirmed','needs_followup','escalated','resolved','closed')),
  constraint skeleton_observer_parent_boundary_check check (parent_visible = false),
  constraint skeleton_observer_no_raw_media_check check (raw_frame_stored = false and face_data_present = false and audio_data_present = false and identity_fields_present = false)
);

create table if not exists public.skeleton_model_readiness_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  model_provider text not null,
  capability_key text not null,
  vertical_key text not null default 'gan_batuach',
  readiness_status text not null default 'prepared',
  readiness_score integer not null default 0,
  human_review_required boolean not null default true,
  parent_visible_allowed boolean not null default false,
  legal_status text not null default 'allowed',
  privacy_status text not null default 'approved',
  expected_input text not null,
  expected_output text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skeleton_model_provider_check check (model_provider in ('yolov8_pose','mediapipe_pose','st_gcn','lstm','temporal_graph','future_pose_model')),
  constraint skeleton_model_readiness_status_check check (readiness_status in ('prepared','testing','needs_review','approved','blocked')),
  constraint skeleton_model_score_check check (readiness_score between 0 and 100),
  constraint skeleton_model_legal_status_check check (legal_status in ('allowed','disabled','restricted','legal_review_required')),
  constraint skeleton_model_privacy_status_check check (privacy_status in ('approved','restricted','blocked','needs_review'))
);

create table if not exists public.skeleton_motion_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  event_type text not null,
  zone_type text,
  enabled boolean not null default true,
  severity text not null default 'medium',
  confidence_threshold numeric(5,4) not null default 0.7000,
  duration_threshold_seconds integer not null default 10,
  velocity_threshold numeric(8,4),
  density_threshold integer,
  requires_human_review boolean not null default true,
  recommendation text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skeleton_motion_rule_event_check check (event_type in (
    'fall_suspected',
    'inactivity_suspected',
    'high_velocity_motion',
    'crowding_suspected',
    'supervision_attention_required',
    'restricted_area_presence',
    'unusual_motion_pattern',
    'person_down_suspected'
  )),
  constraint skeleton_motion_rule_severity_check check (severity in ('info','low','medium','high','urgent','critical')),
  constraint skeleton_motion_rule_confidence_check check (confidence_threshold between 0 and 1)
);

create table if not exists public.observer_ephemeral_context (
  id uuid primary key default gen_random_uuid(),
  context_id text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  camera_zone_id uuid references public.camera_zones(id) on delete set null,
  temporary_color_profile jsonb not null default '{}'::jsonb,
  temporary_height_estimate numeric(6,2),
  temporary_skeleton_proportion_estimate jsonb not null default '{}'::jsonb,
  check_in_timestamp timestamptz,
  expires_at timestamptz not null default (date_trunc('day', now()) + interval '1 day'),
  deleted_at timestamptz,
  policy_status text not null default 'legal_review_required',
  parent_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_ephemeral_context_policy_check check (policy_status in ('disabled','legal_review_required','approved_for_pilot','retired')),
  constraint observer_ephemeral_context_parent_check check (parent_visible = false)
);

create table if not exists public.skeleton_retention_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  data_type text not null,
  default_retention_days integer not null,
  reviewed_summary_retention_days integer not null,
  legal_hold_allowed boolean not null default true,
  anonymization_required boolean not null default true,
  parent_visible_allowed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skeleton_retention_days_check check (default_retention_days >= 1 and reviewed_summary_retention_days >= default_retention_days),
  constraint skeleton_retention_parent_check check (parent_visible_allowed = false)
);

create index if not exists skeleton_observer_events_scope_idx on public.skeleton_observer_events(garden_id, review_status, severity, event_timestamp desc);
create index if not exists skeleton_observer_events_camera_idx on public.skeleton_observer_events(camera_id, zone_id, event_timestamp desc);
create index if not exists skeleton_observer_events_retention_idx on public.skeleton_observer_events(retention_until, legal_hold);
create index if not exists skeleton_model_readiness_vertical_idx on public.skeleton_model_readiness_checks(vertical_key, capability_key, readiness_status);
create index if not exists skeleton_motion_rules_event_idx on public.skeleton_motion_rules(event_type, enabled);
create index if not exists observer_ephemeral_context_expiry_idx on public.observer_ephemeral_context(expires_at, deleted_at, policy_status);
create index if not exists skeleton_retention_controls_type_idx on public.skeleton_retention_controls(data_type);

alter table public.skeleton_observer_events enable row level security;
alter table public.skeleton_model_readiness_checks enable row level security;
alter table public.skeleton_motion_rules enable row level security;
alter table public.observer_ephemeral_context enable row level security;
alter table public.skeleton_retention_controls enable row level security;

drop policy if exists "skeleton events scoped review" on public.skeleton_observer_events;
create policy "skeleton events scoped review" on public.skeleton_observer_events
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and garden_id is not null and public.can_access_garden(garden_id)));

drop policy if exists "skeleton events admin insert" on public.skeleton_observer_events;
create policy "skeleton events admin insert" on public.skeleton_observer_events
for insert with check (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)));

drop policy if exists "skeleton events admin update" on public.skeleton_observer_events;
create policy "skeleton events admin update" on public.skeleton_observer_events
for update using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and garden_id is not null and public.can_access_garden(garden_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and garden_id is not null and public.can_access_garden(garden_id)));

drop policy if exists "skeleton readiness admin only" on public.skeleton_model_readiness_checks;
create policy "skeleton readiness admin only" on public.skeleton_model_readiness_checks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "skeleton rules admin only" on public.skeleton_motion_rules;
create policy "skeleton rules admin only" on public.skeleton_motion_rules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer ephemeral context admin only" on public.observer_ephemeral_context;
create policy "observer ephemeral context admin only" on public.observer_ephemeral_context for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "skeleton retention admin only" on public.skeleton_retention_controls;
create policy "skeleton retention admin only" on public.skeleton_retention_controls for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.create_skeleton_motion_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mapped_status text;
  mapped_risk integer;
begin
  if new.event_type in ('pose_sample','motion_sample') then
    return new;
  end if;

  mapped_status := case
    when new.review_status in ('confirmed','dismissed','escalated','resolved') then new.review_status
    when new.review_status = 'closed' then 'resolved'
    else 'needs_review'
  end;

  mapped_risk := case new.severity
    when 'critical' then 95
    when 'urgent' then 88
    when 'high' then 76
    when 'medium' then 55
    when 'low' then 30
    else 15
  end;

  insert into public.observer_intelligence_signals (
    signal_type,
    source_type,
    source_id,
    kindergarten_id,
    observer_site_id,
    camera_id,
    severity,
    confidence,
    review_status,
    recommended_action,
    risk_score,
    pattern_key,
    human_review_required,
    parent_visible,
    metadata
  )
  values (
    'skeleton_motion',
    'skeleton_motion',
    new.id,
    new.garden_id,
    new.observer_site_id,
    new.camera_id,
    new.severity,
    new.confidence,
    mapped_status,
    coalesce(new.recommended_action, 'Review motion signal and camera zone context'),
    mapped_risk,
    concat('skeleton_motion:', new.event_type, ':', coalesce(new.zone_id::text, 'no_zone')),
    true,
    false,
    jsonb_build_object(
      'skeleton_event_type', new.event_type,
      'zone_id', new.zone_id,
      'anonymous_only', true,
      'no_face_recognition', true,
      'no_audio_processing', true,
      'no_raw_frame_stored', true,
      'review_required', true
    ) || coalesce(new.metadata, '{}'::jsonb)
  )
  on conflict (source_type, source_id) do update set
    severity = excluded.severity,
    confidence = excluded.confidence,
    review_status = excluded.review_status,
    recommended_action = excluded.recommended_action,
    risk_score = excluded.risk_score,
    metadata = excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists skeleton_motion_signal_trigger on public.skeleton_observer_events;
create trigger skeleton_motion_signal_trigger
after insert or update of review_status, severity, confidence, recommended_action
on public.skeleton_observer_events
for each row execute function public.create_skeleton_motion_signal();

insert into public.skeleton_model_readiness_checks (
  check_key, model_provider, capability_key, vertical_key, readiness_status, readiness_score,
  legal_status, privacy_status, expected_input, expected_output, notes, metadata
)
values
  ('yolov8-pose-extraction', 'yolov8_pose', 'pose_estimation', 'gan_batuach', 'prepared', 74, 'allowed', 'approved', 'camera frame or gateway snapshot; raw pixels wiped after keypoint extraction', '17 skeleton keypoints, confidence, timestamp, camera UUID, zone UUID', 'YOLOv8-Pose adapter contract prepared; production runtime still needs QA.', '{"raw_frames_stored":false}'::jsonb),
  ('mediapipe-pose-extraction', 'mediapipe_pose', 'pose_estimation', 'gan_batuach', 'prepared', 72, 'allowed', 'approved', 'camera frame or gateway snapshot; raw pixels wiped after keypoint extraction', '17 skeleton keypoints, confidence, timestamp, camera UUID, zone UUID', 'MediaPipe Pose adapter contract prepared.', '{"raw_frames_stored":false}'::jsonb),
  ('st-gcn-temporal-readiness', 'st_gcn', 'temporal_skeleton_analysis', 'digital_observer_core', 'needs_review', 55, 'restricted', 'restricted', 'sequence of skeleton frames over time', 'anomaly type, confidence, movement features, review recommendation', 'Future ST-GCN readiness only. No real training or deployment in this phase.', '{"future_training":true}'::jsonb),
  ('lstm-temporal-readiness', 'lstm', 'temporal_skeleton_analysis', 'digital_observer_core', 'needs_review', 52, 'restricted', 'restricted', 'sequence of skeleton frames over time', 'anomaly type, confidence, movement features, review recommendation', 'Future temporal model readiness only.', '{"future_training":true}'::jsonb),
  ('contextual-child-association', 'temporal_graph', 'contextual_child_association', 'gan_batuach', 'blocked', 20, 'legal_review_required', 'needs_review', 'daily ephemeral context only after policy approval', 'temporary association confidence and expiry timestamp', 'Disabled by default for Gan Batuach until legal review approval.', '{"disabled_by_default":true,"expires_daily":true}'::jsonb)
on conflict (check_key) do update set
  model_provider = excluded.model_provider,
  capability_key = excluded.capability_key,
  vertical_key = excluded.vertical_key,
  readiness_status = excluded.readiness_status,
  readiness_score = excluded.readiness_score,
  legal_status = excluded.legal_status,
  privacy_status = excluded.privacy_status,
  expected_input = excluded.expected_input,
  expected_output = excluded.expected_output,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.skeleton_motion_rules (rule_key, event_type, zone_type, enabled, severity, confidence_threshold, duration_threshold_seconds, velocity_threshold, density_threshold, recommendation, metadata)
values
  ('fall-suspected-core', 'fall_suspected', null, true, 'high', 0.7600, 4, 0.3500, null, 'Review camera zone context for suspected fall signal.', '{"signals":["center_of_mass_drop","horizontal_orientation","low_post_motion"]}'::jsonb),
  ('inactivity-suspected-core', 'inactivity_suspected', null, true, 'medium', 0.7200, 45, 0.0400, null, 'Review prolonged inactivity signal and zone context.', '{"careful_language":true}'::jsonb),
  ('high-velocity-motion-core', 'high_velocity_motion', null, true, 'medium', 0.7400, 2, 0.8000, null, 'Review high velocity motion signal. Do not label as violence.', '{"no_violence_label":true}'::jsonb),
  ('crowding-classroom-core', 'crowding_suspected', 'classroom', true, 'medium', 0.7000, 20, null, 18, 'Review crowding and supervision context.', '{"zone_based":true}'::jsonb),
  ('sleeping-area-person-down', 'person_down_suspected', 'sleeping_area', true, 'high', 0.7600, 20, 0.0500, null, 'Review person down signal in sleeping area.', '{"zone_based":true}'::jsonb),
  ('restricted-area-presence-core', 'restricted_area_presence', 'restricted_area', true, 'high', 0.7800, 3, null, null, 'Review restricted area presence signal.', '{"zone_based":true}'::jsonb)
on conflict (rule_key) do update set
  event_type = excluded.event_type,
  zone_type = excluded.zone_type,
  enabled = excluded.enabled,
  severity = excluded.severity,
  confidence_threshold = excluded.confidence_threshold,
  duration_threshold_seconds = excluded.duration_threshold_seconds,
  velocity_threshold = excluded.velocity_threshold,
  density_threshold = excluded.density_threshold,
  recommendation = excluded.recommendation,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.skeleton_retention_controls (control_key, data_type, default_retention_days, reviewed_summary_retention_days, legal_hold_allowed, anonymization_required, parent_visible_allowed, notes, metadata)
values
  ('skeleton-raw-keypoint-short-retention', 'raw_skeleton_keypoints', 14, 90, true, true, false, 'Raw skeleton keypoint event data should be short-retention unless linked to incident legal hold.', '{"default_short_retention":true}'::jsonb),
  ('skeleton-reviewed-summary-retention', 'reviewed_motion_summary', 90, 365, true, true, false, 'Reviewed summaries may be retained longer for safety and audit, still not parent-visible by default.', '{"parent_visible_requires_approved_summary":true}'::jsonb),
  ('ephemeral-context-daily-expiry', 'ephemeral_context', 1, 7, false, true, false, 'Temporary context expires daily and is not a permanent child profile.', '{"no_cross_day_identity":true}'::jsonb)
on conflict (control_key) do update set
  data_type = excluded.data_type,
  default_retention_days = excluded.default_retention_days,
  reviewed_summary_retention_days = excluded.reviewed_summary_retention_days,
  legal_hold_allowed = excluded.legal_hold_allowed,
  anonymization_required = excluded.anonymization_required,
  parent_visible_allowed = excluded.parent_visible_allowed,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.ai_capabilities (
  capability_key, capability_name, category, allowed_verticals, restricted_verticals,
  legal_status, privacy_status, risk_classification, reviewer_approval_status,
  human_review_required, parent_visible_allowed, automatic_action_allowed, explanation_required, dpia_required, notes, metadata
)
values
  ('skeleton_analytics', 'Skeleton analytics', 'motion', array['gan_batuach','digital_observer_core'], '{}'::text[], 'allowed', 'approved', 'medium', 'approved_with_restrictions', true, false, false, true, true, 'Anonymous skeleton vectors only; no child identity or raw frame storage.', '{"anonymous_only":true,"raw_frames_stored":false}'::jsonb),
  ('motion_anomaly_detection', 'Motion anomaly detection', 'motion', array['gan_batuach','digital_observer_core'], '{}'::text[], 'allowed', 'approved', 'medium', 'approved_with_restrictions', true, false, false, true, true, 'Uses careful anomaly language and requires review.', '{"careful_language":true}'::jsonb),
  ('inactivity_detection', 'Inactivity detection', 'motion', array['gan_batuach','digital_observer_core'], '{}'::text[], 'allowed', 'approved', 'medium', 'approved_with_restrictions', true, false, false, true, true, 'Prolonged low-motion signal only; no neglect accusation.', '{"no_accusation":true}'::jsonb),
  ('crowding_detection', 'Crowding detection', 'motion', array['gan_batuach','digital_observer_core'], '{}'::text[], 'allowed', 'approved', 'medium', 'approved_with_restrictions', true, false, false, true, true, 'Zone-level density and supervision attention signal.', '{"zone_level_only":true}'::jsonb),
  ('contextual_child_association', 'Contextual child association', 'biometric', '{}'::text[], array['gan_batuach'], 'legal_review_required', 'needs_review', 'legal_review_required', 'pending', true, false, false, true, true, 'Disabled by default. Daily ephemeral context only after legal approval.', '{"disabled_by_default":true,"expires_daily":true,"no_face_data":true}'::jsonb)
on conflict (capability_key) do update set
  capability_name = excluded.capability_name,
  category = excluded.category,
  allowed_verticals = excluded.allowed_verticals,
  restricted_verticals = excluded.restricted_verticals,
  legal_status = excluded.legal_status,
  privacy_status = excluded.privacy_status,
  risk_classification = excluded.risk_classification,
  reviewer_approval_status = excluded.reviewer_approval_status,
  human_review_required = excluded.human_review_required,
  parent_visible_allowed = excluded.parent_visible_allowed,
  automatic_action_allowed = excluded.automatic_action_allowed,
  explanation_required = excluded.explanation_required,
  dpia_required = excluded.dpia_required,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vertical_capability_matrix (
  vertical_key, vertical_name, capability_key, capability_name, capability_category, capability_status,
  is_core_capability, regulatory_mode_key, legal_status, legal_basis, restriction_summary,
  human_review_required, parent_visible_allowed, approval_required, metadata
)
values
  ('gan_batuach', 'Gan Batuach', 'skeleton_analytics', 'Skeleton analytics', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Anonymous non-identifying skeleton vectors for safety review.', 'No raw frames, no child identity, no parent raw visibility.', true, false, false, '{"phase":152,"anonymous_only":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'motion_anomaly_detection', 'Motion anomaly detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Careful motion signal only.', 'No automatic accusation or discipline.', true, false, false, '{"phase":152}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'inactivity_detection', 'Inactivity detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Low-motion signal for review.', 'No neglect accusation.', true, false, false, '{"phase":152}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'crowding_detection', 'Crowding detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Zone density signal.', 'Supervision attention recommendation only.', true, false, false, '{"phase":152}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'contextual_child_association', 'Contextual child association', 'ai_identity', 'legal_review_required', false, 'GAN_BATUACH_ISRAEL_MODE', 'legal_review_required', 'Potential identity inference risk.', 'Disabled by default; daily ephemeral context only after legal approval.', true, false, true, '{"phase":152,"disabled_by_default":true}'::jsonb)
on conflict (vertical_key, capability_key) do update set
  capability_name = excluded.capability_name,
  capability_category = excluded.capability_category,
  capability_status = excluded.capability_status,
  legal_status = excluded.legal_status,
  legal_basis = excluded.legal_basis,
  restriction_summary = excluded.restriction_summary,
  human_review_required = excluded.human_review_required,
  parent_visible_allowed = excluded.parent_visible_allowed,
  approval_required = excluded.approval_required,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.ai_dpia_assessments (
  dpia_key, ai_system_key, ai_system_name, vertical_key, purpose, data_categories, affected_users,
  risk_level, mitigation_controls, residual_risk_level, approval_status, next_review_due_at, notes, metadata
)
values
  ('dpia-skeleton-motion-gan-batuach', 'skeleton_motion_engine', 'Skeleton Motion Intelligence Engine', 'gan_batuach', 'Anonymous pose and motion safety signal detection with mandatory human review.', array['anonymous_skeleton_keypoints','camera_zone_metadata','review_metadata'], array['children','staff','managers','inspectors'], 'medium', '[{"control":"no_raw_frames"},{"control":"no_face_recognition"},{"control":"no_audio_processing"},{"control":"human_review_required"},{"control":"parent_visible_false"}]'::jsonb, 'medium', 'approved_with_restrictions', now() + interval '180 days', 'Approved as architecture readiness only; production runtime requires validation.', '{"phase":152}'::jsonb)
on conflict (dpia_key) do update set
  purpose = excluded.purpose,
  data_categories = excluded.data_categories,
  affected_users = excluded.affected_users,
  risk_level = excluded.risk_level,
  mitigation_controls = excluded.mitigation_controls,
  residual_risk_level = excluded.residual_risk_level,
  approval_status = excluded.approval_status,
  next_review_due_at = excluded.next_review_due_at,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_core_capabilities (
  capability_key, capability_name, core_module, capability_category, reusable,
  current_owner_vertical, future_package_key, service_key, implementation_status,
  data_boundary, privacy_level, extraction_notes, metadata
)
values
  ('skeleton_motion_engine', 'Skeleton Motion Engine', 'ai', 'ai_motion', true, 'gan_batuach', 'ai-core', 'ai-inference-service', 'mapped', 'derived_anonymous', 'regulated', 'Motion intelligence based on anonymous skeleton sequences only.', '{"phase":152,"st_gcn_ready":true}'::jsonb),
  ('ephemeral_context_store', 'Ephemeral Context Store', 'ai', 'restricted_ai', false, 'gan_batuach', 'ai-core', 'ai-inference-service', 'planned', 'vertical_data', 'regulated', 'Daily temporary context for future legal-review-only child association.', '{"phase":152,"disabled_by_default":true}'::jsonb)
on conflict (capability_key) do update set
  capability_name = excluded.capability_name,
  core_module = excluded.core_module,
  capability_category = excluded.capability_category,
  reusable = excluded.reusable,
  current_owner_vertical = excluded.current_owner_vertical,
  future_package_key = excluded.future_package_key,
  service_key = excluded.service_key,
  implementation_status = excluded.implementation_status,
  data_boundary = excluded.data_boundary,
  privacy_level = excluded.privacy_level,
  extraction_notes = excluded.extraction_notes,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.skeleton_observer_events is 'Anonymous skeleton and motion events. Stores no face image, facial embedding, audio, child name, parent name or direct identity fields.';
comment on table public.observer_ephemeral_context is 'Daily temporary context for future contextual child association. Disabled by default and legal-review-required for Gan Batuach.';
comment on function public.create_skeleton_motion_signal() is 'Creates review-required observer intelligence signals from skeleton motion events. No parent visibility and no automatic action.';
