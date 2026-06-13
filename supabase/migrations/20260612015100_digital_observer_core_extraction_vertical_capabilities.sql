-- PHASE 151: Digital Observer Core Extraction & Vertical Capability Management
-- Architecture preparation only. No repository split, infrastructure migration or code duplication.

alter table if exists public.regulatory_policy_modes
  drop constraint if exists regulatory_policy_mode_vertical_check;

alter table if exists public.regulatory_policy_modes
  add constraint regulatory_policy_mode_vertical_check
  check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer','enterprise_observer'));

alter table if exists public.vertical_capability_matrix
  drop constraint if exists vertical_capability_matrix_vertical_check;

alter table if exists public.vertical_capability_matrix
  add constraint vertical_capability_matrix_vertical_check
  check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer','enterprise_observer'));

alter table if exists public.vertical_capability_matrix
  drop constraint if exists vertical_capability_matrix_status_check;

alter table if exists public.vertical_capability_matrix
  add constraint vertical_capability_matrix_status_check
  check (capability_status in ('enabled','disabled','restricted','legal_review_required'));

alter table if exists public.ai_vertical_capability_matrix
  drop constraint if exists ai_capability_vertical_check;

alter table if exists public.ai_vertical_capability_matrix
  add constraint ai_capability_vertical_check
  check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer','enterprise_observer'));

create table if not exists public.digital_observer_core_capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null unique,
  capability_name text not null,
  core_module text not null,
  capability_category text not null,
  reusable boolean not null default true,
  current_owner_vertical text not null default 'gan_batuach',
  future_package_key text,
  service_key text,
  implementation_status text not null default 'mapped',
  data_boundary text not null default 'shared_boundary',
  privacy_level text not null default 'internal',
  extraction_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_core_capability_status_check check (implementation_status in ('existing','mapped','extract_ready','planned','blocked')),
  constraint observer_core_capability_boundary_check check (data_boundary in ('core_observer_data','vertical_data','shared_boundary','derived_anonymous')),
  constraint observer_core_capability_privacy_check check (privacy_level in ('public','internal','confidential','sensitive','regulated'))
);

create table if not exists public.observer_vertical_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null unique,
  vertical_key text not null,
  display_name text not null,
  profile_status text not null default 'future',
  description text,
  allowed_capabilities text[] not null default '{}'::text[],
  disabled_capabilities text[] not null default '{}'::text[],
  restricted_capabilities text[] not null default '{}'::text[],
  legal_review_required_capabilities text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_vertical_profile_vertical_check check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer','enterprise_observer')),
  constraint observer_vertical_profile_status_check check (profile_status in ('active','future','draft','restricted','retired'))
);

create table if not exists public.observer_core_services_registry (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique,
  service_name text not null,
  service_type text not null,
  current_module_path text,
  future_package_key text,
  extraction_status text not null default 'mapped',
  owner_vertical text not null default 'gan_batuach',
  service_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_core_service_type_check check (service_type in ('ai','camera','workflow','audit','analytics','risk','notification','incident','compliance','inspection')),
  constraint observer_core_service_status_check check (extraction_status in ('mapped','extract_ready','planned','blocked'))
);

create table if not exists public.observer_shared_package_mapping (
  id uuid primary key default gen_random_uuid(),
  package_key text not null unique,
  package_name text not null,
  future_path text not null,
  package_scope text not null,
  included_modules text[] not null default '{}'::text[],
  extraction_priority integer not null default 3,
  status text not null default 'mapped',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_package_priority_check check (extraction_priority between 1 and 5),
  constraint observer_package_status_check check (status in ('mapped','planned','extract_ready','blocked'))
);

create table if not exists public.observer_cross_vertical_policies (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique,
  feature_key text not null,
  allowed_verticals text[] not null default '{}'::text[],
  restricted_verticals text[] not null default '{}'::text[],
  disabled_verticals text[] not null default '{}'::text[],
  approval_required boolean not null default true,
  restriction_summary text,
  policy_status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_cross_vertical_policy_status_check check (policy_status in ('draft','active','needs_legal_review','retired'))
);

create table if not exists public.observer_data_boundary_map (
  id uuid primary key default gen_random_uuid(),
  boundary_key text not null unique,
  data_domain text not null,
  boundary_type text not null,
  owner_layer text not null,
  contains_pii boolean not null default false,
  contains_child_data boolean not null default false,
  contains_biometric_data boolean not null default false,
  retention_owner text not null,
  sharing_rule text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_data_boundary_type_check check (boundary_type in ('core_observer_data','vertical_data','shared_boundary','derived_anonymous'))
);

create table if not exists public.observer_roadmap_registry (
  id uuid primary key default gen_random_uuid(),
  roadmap_key text not null unique,
  vertical_key text not null,
  module_name text not null,
  roadmap_status text not null default 'future',
  target_package_key text,
  dependency_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_roadmap_vertical_check check (vertical_key in ('school_safe','business_observer','home_observer','municipality_observer','enterprise_observer')),
  constraint observer_roadmap_status_check check (roadmap_status in ('future','discovery','planned','blocked'))
);

create index if not exists observer_core_capabilities_module_idx on public.digital_observer_core_capabilities(core_module, implementation_status);
create index if not exists observer_core_capabilities_package_idx on public.digital_observer_core_capabilities(future_package_key, reusable);
create index if not exists observer_vertical_profiles_vertical_idx on public.observer_vertical_profiles(vertical_key, profile_status);
create index if not exists observer_core_services_type_idx on public.observer_core_services_registry(service_type, extraction_status);
create index if not exists observer_package_mapping_status_idx on public.observer_shared_package_mapping(status, extraction_priority);
create index if not exists observer_cross_vertical_feature_idx on public.observer_cross_vertical_policies(feature_key, policy_status);
create index if not exists observer_data_boundary_type_idx on public.observer_data_boundary_map(boundary_type, owner_layer);
create index if not exists observer_roadmap_vertical_idx on public.observer_roadmap_registry(vertical_key, roadmap_status);

alter table public.digital_observer_core_capabilities enable row level security;
alter table public.observer_vertical_profiles enable row level security;
alter table public.observer_core_services_registry enable row level security;
alter table public.observer_shared_package_mapping enable row level security;
alter table public.observer_cross_vertical_policies enable row level security;
alter table public.observer_data_boundary_map enable row level security;
alter table public.observer_roadmap_registry enable row level security;

drop policy if exists "observer core capabilities admin only" on public.digital_observer_core_capabilities;
create policy "observer core capabilities admin only" on public.digital_observer_core_capabilities for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer vertical profiles admin only" on public.observer_vertical_profiles;
create policy "observer vertical profiles admin only" on public.observer_vertical_profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer core services admin only" on public.observer_core_services_registry;
create policy "observer core services admin only" on public.observer_core_services_registry for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer package mapping admin only" on public.observer_shared_package_mapping;
create policy "observer package mapping admin only" on public.observer_shared_package_mapping for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer cross vertical policies admin only" on public.observer_cross_vertical_policies;
create policy "observer cross vertical policies admin only" on public.observer_cross_vertical_policies for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer data boundary admin only" on public.observer_data_boundary_map;
create policy "observer data boundary admin only" on public.observer_data_boundary_map for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer roadmap admin only" on public.observer_roadmap_registry;
create policy "observer roadmap admin only" on public.observer_roadmap_registry for all using (public.is_admin()) with check (public.is_admin());

insert into public.regulatory_policy_modes (mode_key, vertical_key, mode_name, jurisdiction, status, effective_from, policy_summary, metadata)
values
  ('ENTERPRISE_OBSERVER_REVIEW_MODE', 'enterprise_observer', 'Enterprise Observer Legal Review Mode', 'future', 'draft', null, 'Future enterprise observer vertical requires privacy, labor and customer contract review before activation.', '{}'::jsonb)
on conflict (mode_key) do update set
  vertical_key = excluded.vertical_key,
  mode_name = excluded.mode_name,
  jurisdiction = excluded.jurisdiction,
  status = excluded.status,
  policy_summary = excluded.policy_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_core_capabilities (
  capability_key, capability_name, core_module, capability_category, reusable,
  current_owner_vertical, future_package_key, service_key, implementation_status,
  data_boundary, privacy_level, extraction_notes, metadata
)
values
  ('camera_platform', 'Camera Platform', 'cameras', 'camera', true, 'gan_batuach', 'camera-core', 'camera-service', 'existing', 'shared_boundary', 'sensitive', 'Reusable camera registry, health, permission and gateway layer.', '{"examples":["camera_streams","camera_gateways","parent_camera_policies"]}'::jsonb),
  ('secure_streaming', 'Secure Streaming', 'streaming', 'camera', true, 'gan_batuach', 'camera-core', 'streaming-service', 'mapped', 'shared_boundary', 'sensitive', 'WebRTC/gateway streaming should become vertical-neutral with policy checks per vertical.', '{"no_direct_rtsp":true}'::jsonb),
  ('observer_events', 'Observer Event Pipeline', 'observer', 'observer', true, 'gan_batuach', 'observer-core', 'observer-event-service', 'existing', 'core_observer_data', 'sensitive', 'Reusable event ingestion and human review queue.', '{"human_review_required":true}'::jsonb),
  ('ai_model_registry', 'AI Model Registry', 'ai', 'ai', true, 'gan_batuach', 'ai-core', 'ai-model-service', 'existing', 'core_observer_data', 'regulated', 'Model lifecycle and calibration registry.', '{"automatic_deployment":false}'::jsonb),
  ('pose_analytics', 'Pose Analytics', 'ai', 'ai_motion', true, 'gan_batuach', 'ai-core', 'ai-inference-service', 'mapped', 'derived_anonymous', 'regulated', 'Non-identifying pose keypoints usable by regulated verticals.', '{"raw_pixels_persisted":false}'::jsonb),
  ('skeleton_analytics', 'Skeleton Analytics', 'ai', 'ai_motion', true, 'gan_batuach', 'ai-core', 'ai-inference-service', 'mapped', 'derived_anonymous', 'regulated', 'Abstract skeleton vectors only; no persistent child identity.', '{"persistent_identity":false}'::jsonb),
  ('motion_analytics', 'Motion Analytics', 'ai', 'ai_motion', true, 'gan_batuach', 'ai-core', 'ai-inference-service', 'mapped', 'derived_anonymous', 'regulated', 'Motion patterns for safety recommendations with human review.', '{"recommendations_only":true}'::jsonb),
  ('anomaly_detection', 'Anomaly Detection', 'ai', 'ai_motion', true, 'gan_batuach', 'ai-core', 'anomaly-service', 'mapped', 'derived_anonymous', 'regulated', 'Pattern detection only. No automatic accusations.', '{"automatic_accusations":false}'::jsonb),
  ('risk_scoring', 'Risk Engine', 'risk', 'risk', true, 'gan_batuach', 'analytics-core', 'risk-service', 'existing', 'shared_boundary', 'confidential', 'Advisory risk scoring and prioritization.', '{"advisory_only":true}'::jsonb),
  ('incident_engine', 'Incident Engine', 'incidents', 'case_management', true, 'gan_batuach', 'workflow-core', 'incident-service', 'existing', 'vertical_data', 'sensitive', 'Incident and evidence workflow should stay vertical-aware.', '{"no_blame_assignment":true}'::jsonb),
  ('workflow_engine', 'Workflow Engine', 'workflows', 'workflow', true, 'gan_batuach', 'workflow-core', 'workflow-service', 'existing', 'shared_boundary', 'confidential', 'Trigger to task to review to closure engine.', '{"automation_requires_policy":true}'::jsonb),
  ('audit_engine', 'Audit Engine', 'audit', 'audit', true, 'gan_batuach', 'audit-core', 'audit-service', 'existing', 'core_observer_data', 'regulated', 'Immutable audit event model for every vertical.', '{"append_only":true}'::jsonb),
  ('notification_engine', 'Notification Engine', 'notifications', 'notification', true, 'gan_batuach', 'workflow-core', 'notification-service', 'existing', 'shared_boundary', 'confidential', 'Routing and priority engine with vertical-specific visibility rules.', '{"parent_panic_notifications":false}'::jsonb),
  ('analytics_engine', 'Analytics Engine', 'analytics', 'analytics', true, 'gan_batuach', 'analytics-core', 'analytics-service', 'existing', 'derived_anonymous', 'confidential', 'Aggregated benchmarking, trends and readiness analytics.', '{"aggregate_first":true}'::jsonb),
  ('inspection_engine', 'Inspection Engine', 'inspections', 'inspection', false, 'gan_batuach', 'observer-core', 'inspection-service', 'mapped', 'vertical_data', 'confidential', 'Reusable supervision workflow, but policy and legal content are vertical-specific.', '{"gan_batuach_enabled":true}'::jsonb),
  ('compliance_engine', 'Compliance Engine', 'compliance', 'compliance', false, 'gan_batuach', 'workflow-core', 'compliance-service', 'mapped', 'vertical_data', 'confidential', 'Compliance lifecycle is reusable with vertical-specific requirements.', '{"requirements_vertical_specific":true}'::jsonb),
  ('parent_portal', 'Parent Portal', 'parent', 'portal', false, 'gan_batuach', 'ui-core', 'parent-portal-service', 'mapped', 'vertical_data', 'sensitive', 'Kindergarten-specific family experience, not part of generic core.', '{"gan_batuach_specific":true}'::jsonb),
  ('child_timeline', 'Child Timeline', 'children', 'timeline', false, 'gan_batuach', 'ui-core', 'child-timeline-service', 'mapped', 'vertical_data', 'sensitive', 'Child operational record remains Gan Batuach-specific.', '{"child_data":true}'::jsonb),
  ('audio_analytics', 'Audio Analytics', 'audio', 'restricted_ai', true, 'digital_observer_core', 'ai-core', 'audio-ai-service', 'blocked', 'core_observer_data', 'regulated', 'Core capability mapping only. Disabled for Gan Batuach.', '{"gan_batuach_disabled":true}'::jsonb),
  ('face_recognition', 'Face Recognition', 'identity', 'restricted_ai', true, 'digital_observer_core', 'ai-core', 'identity-ai-service', 'blocked', 'core_observer_data', 'regulated', 'Core capability mapping only. Disabled for Gan Batuach.', '{"gan_batuach_disabled":true}'::jsonb),
  ('unrestricted_biometrics', 'Unrestricted Biometrics', 'identity', 'restricted_ai', true, 'digital_observer_core', 'ai-core', 'identity-ai-service', 'blocked', 'core_observer_data', 'regulated', 'No unrestricted biometric mode may be enabled without explicit legal approval.', '{"approval_required":true}'::jsonb),
  ('soft_biometrics', 'Soft Biometrics', 'identity', 'restricted_ai', true, 'digital_observer_core', 'ai-core', 'identity-ai-service', 'planned', 'core_observer_data', 'regulated', 'Future capability requires legal review per vertical.', '{"legal_review_required":true}'::jsonb),
  ('gait_analytics', 'Gait Analytics', 'identity', 'restricted_ai', true, 'digital_observer_core', 'ai-core', 'identity-ai-service', 'planned', 'core_observer_data', 'regulated', 'Future capability requires legal review per vertical.', '{"legal_review_required":true}'::jsonb)
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

insert into public.observer_vertical_profiles (
  profile_key, vertical_key, display_name, profile_status, description,
  allowed_capabilities, disabled_capabilities, restricted_capabilities, legal_review_required_capabilities, metadata
)
values
  ('GAN_BATUACH_PROFILE', 'gan_batuach', 'Gan Batuach', 'active', 'Regulated kindergarten implementation in Israel. Enables safety, compliance, inspection and parent transparency workflows while disabling audio, face recognition and unrestricted biometrics.',
   array['inspections','compliance_engine','parent_portal','child_timeline','pose_analytics','skeleton_analytics','motion_analytics','anomaly_detection','risk_scoring','camera_platform','secure_streaming'],
   array['audio_analytics','face_recognition','unrestricted_biometrics'],
   array['soft_biometrics','gait_analytics'],
   array['persistent_skeleton_identity_tracking','cross_day_identity_matching'],
   '{"regulatory_mode":"GAN_BATUACH_ISRAEL_MODE","human_review_required":true}'::jsonb),
  ('SCHOOL_SAFE_PROFILE', 'school_safe', 'School Safe', 'future', 'Future school supervision vertical. Requires separate legal review for student privacy, school policy and parent visibility.',
   array['camera_platform','secure_streaming','observer_events','workflow_engine','audit_engine','analytics_engine'],
   '{}'::text[],
   array['pose_analytics','skeleton_analytics','motion_analytics','anomaly_detection'],
   array['audio_analytics','face_recognition','soft_biometrics','gait_analytics'],
   '{"future_vertical":true}'::jsonb),
  ('BUSINESS_OBSERVER_PROFILE', 'business_observer', 'Business Observer', 'future', 'Future workplace and business operations observer. Requires labor, employee privacy and customer notice review.',
   array['camera_platform','secure_streaming','observer_events','workflow_engine','audit_engine','analytics_engine','risk_scoring'],
   '{}'::text[],
   array['motion_analytics','anomaly_detection'],
   array['audio_analytics','face_recognition','soft_biometrics','gait_analytics'],
   '{"future_vertical":true}'::jsonb),
  ('HOME_OBSERVER_PROFILE', 'home_observer', 'Home Observer', 'future', 'Future residential safety vertical. Requires strict household privacy boundaries and consent model.',
   array['camera_platform','secure_streaming','observer_events','notification_engine'],
   '{}'::text[],
   array['motion_analytics','anomaly_detection'],
   array['audio_analytics','face_recognition','soft_biometrics','gait_analytics'],
   '{"future_vertical":true}'::jsonb),
  ('MUNICIPALITY_OBSERVER_PROFILE', 'municipality_observer', 'Municipality Observer', 'future', 'Future municipal supervision and public transparency vertical.',
   array['analytics_engine','audit_engine','workflow_engine','inspection_engine','compliance_engine'],
   '{}'::text[],
   array['camera_platform','observer_events','risk_scoring'],
   array['face_recognition','audio_analytics','soft_biometrics','gait_analytics'],
   '{"future_vertical":true}'::jsonb),
  ('ENTERPRISE_OBSERVER_PROFILE', 'enterprise_observer', 'Enterprise Observer', 'future', 'Future enterprise multi-site observer platform.',
   array['camera_platform','secure_streaming','observer_events','workflow_engine','audit_engine','analytics_engine','risk_scoring','notification_engine'],
   '{}'::text[],
   array['motion_analytics','anomaly_detection'],
   array['audio_analytics','face_recognition','soft_biometrics','gait_analytics'],
   '{"future_vertical":true}'::jsonb)
on conflict (profile_key) do update set
  vertical_key = excluded.vertical_key,
  display_name = excluded.display_name,
  profile_status = excluded.profile_status,
  description = excluded.description,
  allowed_capabilities = excluded.allowed_capabilities,
  disabled_capabilities = excluded.disabled_capabilities,
  restricted_capabilities = excluded.restricted_capabilities,
  legal_review_required_capabilities = excluded.legal_review_required_capabilities,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_core_services_registry (service_key, service_name, service_type, current_module_path, future_package_key, extraction_status, owner_vertical, service_summary, metadata)
values
  ('ai-model-service', 'AI Model Service', 'ai', 'lib/domain/ai-*', 'ai-core', 'mapped', 'gan_batuach', 'Model registry, calibration and governance services.', '{}'::jsonb),
  ('ai-inference-service', 'AI Inference Service', 'ai', 'lib/domain/ai-observer', 'ai-core', 'mapped', 'gan_batuach', 'Pose, skeleton and motion inference contracts.', '{"raw_frame_policy":"wipe_after_keypoints"}'::jsonb),
  ('anomaly-service', 'Anomaly Service', 'ai', 'lib/domain/observer-intelligence-engine.ts', 'ai-core', 'mapped', 'gan_batuach', 'Advisory anomaly and recommendation layer.', '{}'::jsonb),
  ('camera-service', 'Camera Service', 'camera', 'app/dashboard/*/cameras, lib/domain/camera-*', 'camera-core', 'mapped', 'gan_batuach', 'Camera registry, permissions, health and setup.', '{}'::jsonb),
  ('streaming-service', 'Streaming Service', 'camera', 'app/api/cameras/*, video gateway screens', 'camera-core', 'planned', 'gan_batuach', 'Secure streaming token and gateway abstraction.', '{}'::jsonb),
  ('workflow-service', 'Workflow Service', 'workflow', 'app/dashboard/tasks, workflow_tasks', 'workflow-core', 'mapped', 'gan_batuach', 'Unified task and workflow lifecycle.', '{}'::jsonb),
  ('audit-service', 'Audit Service', 'audit', 'audit_logs, regulatory_policy_audit_events', 'audit-core', 'mapped', 'gan_batuach', 'Append-only audit and policy event tracking.', '{"append_only":true}'::jsonb),
  ('analytics-service', 'Analytics Service', 'analytics', 'app/dashboard/admin/analytics-center', 'analytics-core', 'mapped', 'gan_batuach', 'Aggregated cross-kindergarten and observer intelligence analytics.', '{}'::jsonb),
  ('risk-service', 'Risk Service', 'risk', 'risk profiles and predictive safety engines', 'analytics-core', 'mapped', 'gan_batuach', 'Advisory risk scoring and trend detection.', '{"no_automatic_enforcement":true}'::jsonb),
  ('notification-service', 'Notification Service', 'notification', 'notifications, communication threads, push', 'workflow-core', 'mapped', 'gan_batuach', 'Notification routing with visibility rules.', '{}'::jsonb),
  ('incident-service', 'Incident Service', 'incident', 'incident_cases and evidence workflows', 'workflow-core', 'mapped', 'gan_batuach', 'Incident investigation and evidence case lifecycle.', '{}'::jsonb),
  ('inspection-service', 'Inspection Service', 'inspection', 'inspection center and reports', 'observer-core', 'mapped', 'gan_batuach', 'Inspection planning, findings and reports.', '{}'::jsonb),
  ('compliance-service', 'Compliance Service', 'compliance', 'compliance center and corrective actions', 'workflow-core', 'mapped', 'gan_batuach', 'Compliance scoring, expiration and corrective action workflows.', '{}'::jsonb)
on conflict (service_key) do update set
  service_name = excluded.service_name,
  service_type = excluded.service_type,
  current_module_path = excluded.current_module_path,
  future_package_key = excluded.future_package_key,
  extraction_status = excluded.extraction_status,
  owner_vertical = excluded.owner_vertical,
  service_summary = excluded.service_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_shared_package_mapping (package_key, package_name, future_path, package_scope, included_modules, extraction_priority, status, metadata)
values
  ('observer-core', 'Observer Core', 'packages/observer-core', 'Observer events, reviews, recommendations and vertical-neutral contracts.', array['observer_events','inspection_engine'], 1, 'mapped', '{}'::jsonb),
  ('camera-core', 'Camera Core', 'packages/camera-core', 'Camera registry, health, gateway and secure streaming contracts.', array['camera_platform','secure_streaming'], 1, 'mapped', '{}'::jsonb),
  ('ai-core', 'AI Core', 'packages/ai-core', 'Model registry, pose/skeleton contracts and anomaly governance.', array['ai_model_registry','pose_analytics','skeleton_analytics','motion_analytics','anomaly_detection'], 1, 'mapped', '{"restricted_capabilities_stay_policy_controlled":true}'::jsonb),
  ('workflow-core', 'Workflow Core', 'packages/workflow-core', 'Tasks, approvals, corrective actions and notifications.', array['workflow_engine','incident_engine','notification_engine','compliance_engine'], 2, 'mapped', '{}'::jsonb),
  ('audit-core', 'Audit Core', 'packages/audit-core', 'Immutable audit and regulatory policy events.', array['audit_engine'], 1, 'mapped', '{"append_only":true}'::jsonb),
  ('analytics-core', 'Analytics Core', 'packages/analytics-core', 'Risk, readiness, benchmarking and aggregate analytics.', array['risk_scoring','analytics_engine'], 2, 'mapped', '{}'::jsonb),
  ('ui-core', 'UI Core', 'packages/ui-core', 'Shared dashboard widgets, status chips and role-safe components.', array['parent_portal','child_timeline'], 4, 'planned', '{"vertical_specific_components_must_remain_wrapped":true}'::jsonb)
on conflict (package_key) do update set
  package_name = excluded.package_name,
  future_path = excluded.future_path,
  package_scope = excluded.package_scope,
  included_modules = excluded.included_modules,
  extraction_priority = excluded.extraction_priority,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_cross_vertical_policies (policy_key, feature_key, allowed_verticals, restricted_verticals, disabled_verticals, approval_required, restriction_summary, policy_status, metadata)
values
  ('policy-pose-motion', 'pose_analytics', array['gan_batuach','digital_observer_core'], array['school_safe','business_observer','home_observer','municipality_observer','enterprise_observer'], '{}'::text[], true, 'Pose and motion analytics require vertical policy, non-identifying processing and human review.', 'active', '{}'::jsonb),
  ('policy-audio-analytics', 'audio_analytics', '{}'::text[], array['school_safe','business_observer','home_observer','municipality_observer','enterprise_observer'], array['gan_batuach'], true, 'Audio analytics are disabled for Gan Batuach and require legal review elsewhere.', 'active', '{}'::jsonb),
  ('policy-face-recognition', 'face_recognition', '{}'::text[], array['school_safe','business_observer','home_observer','municipality_observer','enterprise_observer'], array['gan_batuach'], true, 'Face recognition is disabled for Gan Batuach and legal-review-only for every future vertical.', 'active', '{}'::jsonb),
  ('policy-risk-recommendations', 'risk_scoring', array['gan_batuach','digital_observer_core'], array['school_safe','business_observer','municipality_observer','enterprise_observer'], '{}'::text[], true, 'Risk scores are advisory only and never automatic enforcement.', 'active', '{"automatic_enforcement":false}'::jsonb),
  ('policy-parent-visibility', 'parent_visibility', array['gan_batuach'], array['school_safe','home_observer'], array['business_observer','enterprise_observer'], true, 'Parents may see only approved summaries in child/family verticals; raw observer signals remain internal.', 'active', '{"raw_ai_events_parent_visible":false}'::jsonb)
on conflict (policy_key) do update set
  feature_key = excluded.feature_key,
  allowed_verticals = excluded.allowed_verticals,
  restricted_verticals = excluded.restricted_verticals,
  disabled_verticals = excluded.disabled_verticals,
  approval_required = excluded.approval_required,
  restriction_summary = excluded.restriction_summary,
  policy_status = excluded.policy_status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_data_boundary_map (boundary_key, data_domain, boundary_type, owner_layer, contains_pii, contains_child_data, contains_biometric_data, retention_owner, sharing_rule, metadata)
values
  ('boundary-camera-registry', 'Camera registry and health', 'shared_boundary', 'camera-core', false, false, false, 'vertical', 'Core contracts; vertical permission rules.', '{}'::jsonb),
  ('boundary-streaming-sessions', 'Streaming sessions and access logs', 'shared_boundary', 'camera-core', true, true, false, 'vertical', 'Every view remains vertical-scoped and audited.', '{"parent_access_requires_child_presence":true}'::jsonb),
  ('boundary-observer-events', 'Observer event metadata', 'core_observer_data', 'observer-core', false, false, false, 'core', 'Signals can be reused as anonymized metadata; vertical links stay scoped.', '{"human_review_required":true}'::jsonb),
  ('boundary-skeleton-keypoints', 'Skeleton keypoints and motion vectors', 'derived_anonymous', 'ai-core', false, false, false, 'core', 'Store abstract vectors only; no raw pixel grids or identity labels.', '{"raw_pixels_persisted":false}'::jsonb),
  ('boundary-child-records', 'Child timeline and parent-visible data', 'vertical_data', 'gan-batuach-app', true, true, false, 'vertical', 'Never extracted into core package without anonymization.', '{}'::jsonb),
  ('boundary-inspections', 'Inspection findings and compliance evidence', 'vertical_data', 'gan-batuach-app', true, false, false, 'vertical', 'Workflow patterns reusable; legal content remains vertical-specific.', '{}'::jsonb),
  ('boundary-audit-events', 'Audit and policy events', 'core_observer_data', 'audit-core', true, false, false, 'core', 'Append-only audit format reusable across verticals.', '{"append_only":true}'::jsonb),
  ('boundary-analytics-aggregates', 'Aggregated analytics and benchmarks', 'derived_anonymous', 'analytics-core', false, false, false, 'core', 'Aggregate and anonymize before cross-vertical analysis.', '{"aggregate_first":true}'::jsonb)
on conflict (boundary_key) do update set
  data_domain = excluded.data_domain,
  boundary_type = excluded.boundary_type,
  owner_layer = excluded.owner_layer,
  contains_pii = excluded.contains_pii,
  contains_child_data = excluded.contains_child_data,
  contains_biometric_data = excluded.contains_biometric_data,
  retention_owner = excluded.retention_owner,
  sharing_rule = excluded.sharing_rule,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_roadmap_registry (roadmap_key, vertical_key, module_name, roadmap_status, target_package_key, dependency_summary, metadata)
values
  ('school-safe-core-readiness', 'school_safe', 'School safety supervision', 'future', 'observer-core', 'Requires school legal review, student privacy policy and role model.', '{}'::jsonb),
  ('school-safe-camera-policy', 'school_safe', 'School camera policy', 'future', 'camera-core', 'Requires school consent, viewing boundaries and parent visibility policy.', '{}'::jsonb),
  ('business-observer-operations', 'business_observer', 'Business operations observer', 'future', 'observer-core', 'Requires labor-law privacy review and employee notification model.', '{}'::jsonb),
  ('home-observer-privacy', 'home_observer', 'Home privacy observer', 'future', 'camera-core', 'Requires household consent, retention limits and emergency-only escalation model.', '{}'::jsonb),
  ('municipality-regional-oversight', 'municipality_observer', 'Municipal oversight', 'future', 'analytics-core', 'Requires municipal reporting, public transparency and procurement controls.', '{}'::jsonb),
  ('enterprise-multi-site', 'enterprise_observer', 'Enterprise multi-site observer', 'future', 'analytics-core', 'Requires tenant isolation, customer contract model and enterprise audit controls.', '{}'::jsonb)
on conflict (roadmap_key) do update set
  vertical_key = excluded.vertical_key,
  module_name = excluded.module_name,
  roadmap_status = excluded.roadmap_status,
  target_package_key = excluded.target_package_key,
  dependency_summary = excluded.dependency_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vertical_capability_matrix (
  vertical_key, vertical_name, capability_key, capability_name, capability_category, capability_status,
  is_core_capability, regulatory_mode_key, legal_status, legal_basis, restriction_summary,
  human_review_required, parent_visible_allowed, approval_required, metadata
)
values
  ('digital_observer_core', 'Digital Observer Core', 'camera_platform', 'Camera platform', 'camera', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'allowed', 'Core reusable capability.', 'Verticals decide visibility and permission rules.', true, false, false, '{"future_package":"camera-core"}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'observer_events', 'Observer events', 'observer', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'allowed', 'Core reusable capability.', 'Human review required for sensitive event outcomes.', true, false, false, '{"future_package":"observer-core"}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'workflow_engine', 'Workflow engine', 'workflow', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'allowed', 'Core reusable capability.', 'Automation must obey vertical policy.', true, false, false, '{"future_package":"workflow-core"}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'audit_engine', 'Audit engine', 'audit', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'allowed', 'Core reusable capability.', 'Append-only audit model.', true, false, false, '{"future_package":"audit-core"}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'analytics_engine', 'Analytics engine', 'analytics', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'allowed', 'Core reusable capability.', 'Aggregated analytics only for cross-vertical insight.', true, false, false, '{"future_package":"analytics-core"}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'inspections', 'Inspections', 'inspection', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Kindergarten-specific regulated workflow.', 'Enabled for Gan Batuach.', true, false, false, '{"profile":"GAN_BATUACH_PROFILE"}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'compliance_engine', 'Compliance engine', 'compliance', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Kindergarten compliance workflow.', 'Enabled with manager and inspector review.', true, false, false, '{"profile":"GAN_BATUACH_PROFILE"}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'parent_portal', 'Parent portal', 'portal', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Parent transparency is kindergarten-specific.', 'Parents see approved information only.', true, true, false, '{"profile":"GAN_BATUACH_PROFILE"}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'child_timeline', 'Child timeline', 'timeline', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Operational child record.', 'Visible only by role and parent relationship.', true, true, false, '{"profile":"GAN_BATUACH_PROFILE"}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'audio_analytics', 'Audio analytics', 'audio', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Disabled for Gan Batuach.', true, false, true, '{"profile":"GAN_BATUACH_PROFILE"}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'unrestricted_biometrics', 'Unrestricted biometrics', 'biometric', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Explicit legal approval required.', 'Disabled for Gan Batuach.', true, false, true, '{"profile":"GAN_BATUACH_PROFILE"}'::jsonb),
  ('school_safe', 'School Safe', 'pose_analytics', 'Pose analytics', 'ai_motion', 'restricted', false, 'SCHOOL_SAFE_REVIEW_MODE', 'restricted', 'Future vertical requires legal review.', 'Future-ready only.', true, false, true, '{"profile":"SCHOOL_SAFE_PROFILE"}'::jsonb),
  ('business_observer', 'Business Observer', 'motion_analytics', 'Motion analytics', 'ai_motion', 'restricted', false, 'BUSINESS_OBSERVER_REVIEW_MODE', 'restricted', 'Future workplace vertical requires legal review.', 'Future-ready only.', true, false, true, '{"profile":"BUSINESS_OBSERVER_PROFILE"}'::jsonb),
  ('home_observer', 'Home Observer', 'motion_analytics', 'Motion analytics', 'ai_motion', 'restricted', false, 'HOME_OBSERVER_REVIEW_MODE', 'restricted', 'Future home vertical requires legal review.', 'Future-ready only.', true, false, true, '{"profile":"HOME_OBSERVER_PROFILE"}'::jsonb),
  ('municipality_observer', 'Municipality Observer', 'regional_analytics', 'Regional analytics', 'analytics', 'restricted', false, 'MUNICIPALITY_OBSERVER_REVIEW_MODE', 'restricted', 'Future municipal vertical requires legal and procurement review.', 'Future-ready only.', true, false, true, '{"profile":"MUNICIPALITY_OBSERVER_PROFILE"}'::jsonb),
  ('enterprise_observer', 'Enterprise Observer', 'multi_site_observer', 'Multi-site observer', 'analytics', 'restricted', false, 'ENTERPRISE_OBSERVER_REVIEW_MODE', 'restricted', 'Future enterprise vertical requires customer contract and privacy review.', 'Future-ready only.', true, false, true, '{"profile":"ENTERPRISE_OBSERVER_PROFILE"}'::jsonb)
on conflict (vertical_key, capability_key) do update set
  vertical_name = excluded.vertical_name,
  capability_name = excluded.capability_name,
  capability_category = excluded.capability_category,
  capability_status = excluded.capability_status,
  is_core_capability = excluded.is_core_capability,
  regulatory_mode_key = excluded.regulatory_mode_key,
  legal_status = excluded.legal_status,
  legal_basis = excluded.legal_basis,
  restriction_summary = excluded.restriction_summary,
  human_review_required = excluded.human_review_required,
  parent_visible_allowed = excluded.parent_visible_allowed,
  approval_required = excluded.approval_required,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.ai_vertical_capability_matrix (vertical_key, module_name, capability_key, capability_name, enabled, regulatory_mode, human_review_required, parent_visible_allowed, notes, metadata)
values
  ('enterprise_observer', 'future_vertical', 'anomaly_detection', 'Anomaly detection', false, 'restricted', true, false, 'Future enterprise observer capability. Requires legal review.', '{"phase":151}'::jsonb),
  ('municipality_observer', 'future_vertical', 'regional_risk_analytics', 'Regional risk analytics', false, 'restricted', true, false, 'Future municipal observer capability. Requires legal and procurement review.', '{"phase":151}'::jsonb),
  ('gan_batuach', 'ai_core', 'audio_analytics', 'Audio analytics', false, 'disabled', true, false, 'Disabled by Gan Batuach Israel Mode.', '{"phase":151,"disabled_for_gan_batuach":true}'::jsonb),
  ('gan_batuach', 'ai_core', 'face_recognition', 'Face recognition', false, 'disabled', true, false, 'Disabled by Gan Batuach Israel Mode.', '{"phase":151,"disabled_for_gan_batuach":true}'::jsonb),
  ('gan_batuach', 'ai_core', 'pose_analytics', 'Pose analytics', true, 'human_review', true, false, 'Allowed as non-identifying motion analytics with human review.', '{"phase":151,"non_identifying":true}'::jsonb)
on conflict (vertical_key, capability_key) do update set
  module_name = excluded.module_name,
  capability_name = excluded.capability_name,
  enabled = excluded.enabled,
  regulatory_mode = excluded.regulatory_mode,
  human_review_required = excluded.human_review_required,
  parent_visible_allowed = excluded.parent_visible_allowed,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();
