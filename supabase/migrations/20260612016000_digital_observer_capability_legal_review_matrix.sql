-- PHASE 160: Digital Observer Capability Legal Review Matrix & Vertical Launch Decision

create extension if not exists "pgcrypto";

alter table if exists public.vertical_capability_matrix
  drop constraint if exists vertical_capability_matrix_status_check;

alter table if exists public.vertical_capability_matrix
  add constraint vertical_capability_matrix_status_check
  check (capability_status in ('enabled','disabled','restricted','legal_review_required','allowed','consent_required','external_provider_required','future_only'));

alter table if exists public.legal_review_items
  add column if not exists capability_key text,
  add column if not exists vertical_key text,
  add column if not exists reviewer_name text,
  add column if not exists decision text,
  add column if not exists decision_date date,
  add column if not exists expires_at date,
  add column if not exists supporting_documents jsonb not null default '[]'::jsonb,
  add column if not exists dpia_record_id uuid,
  add column if not exists ai_governance_review_id uuid,
  add column if not exists privacy_impact_reference text;

alter table if exists public.legal_review_items
  drop constraint if exists legal_review_decision_check;

alter table if exists public.legal_review_items
  add constraint legal_review_decision_check
  check (decision is null or decision in ('pending','approved','approved_with_restrictions','rejected','expired','accepted_risk'));

create table if not exists public.observer_capability_registry (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null unique,
  capability_name text not null,
  category text not null,
  capability_group text not null,
  description text,
  data_sensitivity text not null default 'internal',
  default_risk_level text not null default 'medium',
  default_parent_visibility text not null default 'internal_only',
  requires_human_review boolean not null default true,
  requires_dpia boolean not null default false,
  consent_requirement text not null default 'no_consent_required',
  core_available boolean not null default true,
  product_copy_guardrail text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_capability_category_check check (category in ('camera','ai_vision','audio','observer','data','security','workflow','analytics')),
  constraint observer_capability_group_check check (capability_group in ('streaming','recording','privacy','pose_motion','identity','audio_processing','risk','case_management','data_processing','audit','security')),
  constraint observer_capability_sensitivity_check check (data_sensitivity in ('public','internal','confidential','sensitive','medical','regulated')),
  constraint observer_capability_risk_check check (default_risk_level in ('critical','high','medium','low')),
  constraint observer_capability_parent_visibility_check check (default_parent_visibility in ('disabled','internal_only','approved_summary','approved_stream','approved_document')),
  constraint observer_capability_consent_check check (consent_requirement in ('no_consent_required','parent_consent_required','staff_consent_required','explicit_consent_required','legal_review_required_before_consent'))
);

create table if not exists public.observer_verticals (
  id uuid primary key default gen_random_uuid(),
  vertical_key text not null unique,
  vertical_name text not null,
  regulatory_profile text not null,
  country text not null default 'future',
  allowed_capabilities text[] not null default '{}'::text[],
  restricted_capabilities text[] not null default '{}'::text[],
  disabled_capabilities text[] not null default '{}'::text[],
  required_approvals text[] not null default '{}'::text[],
  launch_status text not null default 'not_ready',
  launch_decision_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_vertical_launch_status_check check (launch_status in ('not_ready','internal_testing','pilot_ready','legal_review_required','production_ready','blocked'))
);

create table if not exists public.observer_vertical_capability_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  vertical_key text not null references public.observer_verticals(vertical_key) on delete cascade,
  capability_key text not null references public.observer_capability_registry(capability_key) on delete cascade,
  capability_status text not null,
  legal_status text not null default 'legal_review_required',
  risk_level text not null default 'medium',
  enabled boolean not null default false,
  review_owner_role text not null default 'admin',
  external_legal_review_required boolean not null default true,
  consent_requirement text not null default 'legal_review_required_before_consent',
  parent_visibility_rule text not null default 'disabled',
  human_review_required boolean not null default true,
  automatic_action_allowed boolean not null default false,
  dpia_required boolean not null default false,
  dpia_record_id uuid,
  ai_governance_review_id uuid,
  legal_review_item_id uuid references public.legal_review_items(id) on delete set null,
  last_reviewed_at timestamptz,
  next_review_due_at timestamptz,
  decision_reason text,
  launch_blocker boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vertical_key, capability_key),
  constraint observer_vertical_capability_status_check check (capability_status in ('allowed','disabled','restricted','legal_review_required','consent_required','external_provider_required','future_only')),
  constraint observer_vertical_capability_legal_check check (legal_status in ('allowed','disabled','restricted','legal_review_required','consent_required','external_provider_required','future_only')),
  constraint observer_vertical_capability_risk_check check (risk_level in ('critical','high','medium','low')),
  constraint observer_vertical_capability_consent_check check (consent_requirement in ('no_consent_required','parent_consent_required','staff_consent_required','explicit_consent_required','legal_review_required_before_consent')),
  constraint observer_vertical_capability_parent_visibility_check check (parent_visibility_rule in ('disabled','internal_only','approved_summary','approved_stream','approved_document')),
  constraint observer_vertical_capability_no_auto check (automatic_action_allowed = false)
);

create table if not exists public.observer_capability_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  vertical_key text,
  capability_key text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'logged',
  reason text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_capability_audit_type_check check (event_type in ('capability_enabled','capability_disabled','capability_blocked','legal_review_required','override_requested','override_approved','override_rejected','runtime_guard_blocked')),
  constraint observer_capability_audit_status_check check (status in ('logged','success','blocked','warning','failed'))
);

create table if not exists public.observer_product_copy_guardrails (
  id uuid primary key default gen_random_uuid(),
  guardrail_key text not null unique,
  vertical_key text not null,
  forbidden_claim text not null,
  approved_wording text not null,
  rationale text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_copy_guardrail_status_check check (status in ('draft','active','retired'))
);

create index if not exists observer_capability_registry_category_idx on public.observer_capability_registry(category, default_risk_level);
create index if not exists observer_verticals_launch_idx on public.observer_verticals(launch_status, country);
create index if not exists observer_vertical_capability_status_idx on public.observer_vertical_capability_decisions(vertical_key, capability_status, risk_level);
create index if not exists observer_vertical_capability_review_idx on public.observer_vertical_capability_decisions(external_legal_review_required, next_review_due_at);
create index if not exists observer_capability_audit_events_idx on public.observer_capability_audit_events(event_type, created_at desc);
create index if not exists observer_copy_guardrails_vertical_idx on public.observer_product_copy_guardrails(vertical_key, status);

alter table public.observer_capability_registry enable row level security;
alter table public.observer_verticals enable row level security;
alter table public.observer_vertical_capability_decisions enable row level security;
alter table public.observer_capability_audit_events enable row level security;
alter table public.observer_product_copy_guardrails enable row level security;

drop policy if exists "observer capability registry admin only" on public.observer_capability_registry;
create policy "observer capability registry admin only" on public.observer_capability_registry for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer verticals admin only" on public.observer_verticals;
create policy "observer verticals admin only" on public.observer_verticals for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer vertical capability decisions admin only" on public.observer_vertical_capability_decisions;
create policy "observer vertical capability decisions admin only" on public.observer_vertical_capability_decisions for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer capability audit admin read" on public.observer_capability_audit_events;
create policy "observer capability audit admin read" on public.observer_capability_audit_events for select using (public.is_admin());

drop policy if exists "observer capability audit authenticated insert" on public.observer_capability_audit_events;
create policy "observer capability audit authenticated insert" on public.observer_capability_audit_events for insert with check (auth.uid() is not null or public.is_admin());

drop policy if exists "observer copy guardrails admin only" on public.observer_product_copy_guardrails;
create policy "observer copy guardrails admin only" on public.observer_product_copy_guardrails for all using (public.is_admin()) with check (public.is_admin());

insert into public.observer_capability_registry (capability_key, capability_name, category, capability_group, description, data_sensitivity, default_risk_level, default_parent_visibility, requires_human_review, requires_dpia, consent_requirement, core_available, product_copy_guardrail, metadata)
values
  ('live_streaming', 'Live streaming', 'camera', 'streaming', 'Live camera viewing through approved secure gateway only.', 'regulated', 'high', 'approved_stream', true, true, 'legal_review_required_before_consent', true, 'Secure viewing under approved policy; no direct camera access.', '{"phase":160}'::jsonb),
  ('playback', 'Playback', 'camera', 'streaming', 'Camera playback or replay capability.', 'regulated', 'high', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Playback only when policy and retention allow it.', '{"phase":160}'::jsonb),
  ('recording', 'Recording', 'camera', 'recording', 'Camera recording capability and retention.', 'regulated', 'high', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Recording governed by camera law and retention policy.', '{"phase":160}'::jsonb),
  ('snapshots', 'Snapshots', 'camera', 'recording', 'Still image capture from camera feed.', 'regulated', 'high', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Snapshots only as approved evidence.', '{"phase":160}'::jsonb),
  ('parent_viewing', 'Parent viewing', 'camera', 'streaming', 'Parent access to approved live camera streams.', 'regulated', 'high', 'approved_stream', true, true, 'legal_review_required_before_consent', true, 'Parent viewing is controlled, logged and policy-bound.', '{"phase":160}'::jsonb),
  ('watermarking', 'Dynamic watermarking', 'camera', 'privacy', 'Watermark overlay for stream leak deterrence.', 'internal', 'medium', 'internal_only', true, false, 'no_consent_required', true, 'Watermarking deters misuse but is not complete leak prevention.', '{"phase":160}'::jsonb),
  ('anti_screen_capture', 'Anti-screen-capture readiness', 'camera', 'privacy', 'Native/web capture defense readiness.', 'internal', 'medium', 'internal_only', true, false, 'no_consent_required', true, 'Capture defenses reduce risk where platform support exists.', '{"phase":160}'::jsonb),
  ('pose_estimation', 'Pose estimation', 'ai_vision', 'pose_motion', 'Extract non-identifying pose keypoints.', 'regulated', 'medium', 'internal_only', true, true, 'no_consent_required', true, 'Pose estimation supports review; it does not identify children.', '{"phase":160}'::jsonb),
  ('skeleton_analytics', 'Skeleton analytics', 'ai_vision', 'pose_motion', 'Analyze abstract skeleton vectors.', 'regulated', 'medium', 'internal_only', true, true, 'no_consent_required', true, 'Skeleton analytics uses abstract motion data and requires review.', '{"phase":160}'::jsonb),
  ('motion_analytics', 'Motion analytics', 'ai_vision', 'pose_motion', 'Analyze motion patterns and anomalies.', 'regulated', 'medium', 'internal_only', true, true, 'no_consent_required', true, 'Detects motion anomalies, not misconduct.', '{"phase":160}'::jsonb),
  ('fall_detection', 'Fall suspected detection', 'ai_vision', 'pose_motion', 'Signals suspected fall events.', 'regulated', 'medium', 'approved_summary', true, true, 'no_consent_required', true, 'Suspected fall requires human review.', '{"phase":160}'::jsonb),
  ('inactivity_detection', 'Inactivity suspected detection', 'ai_vision', 'pose_motion', 'Signals suspected inactivity patterns.', 'regulated', 'medium', 'approved_summary', true, true, 'no_consent_required', true, 'Suspected inactivity requires review and context.', '{"phase":160}'::jsonb),
  ('crowding_detection', 'Crowding suspected detection', 'ai_vision', 'pose_motion', 'Signals crowding or supervision attention.', 'regulated', 'medium', 'approved_summary', true, true, 'no_consent_required', true, 'Crowding signal supports supervision review.', '{"phase":160}'::jsonb),
  ('restricted_area_detection', 'Restricted area detection', 'ai_vision', 'pose_motion', 'Signals movement in restricted zones.', 'regulated', 'medium', 'approved_summary', true, true, 'no_consent_required', true, 'Restricted area alerts require review.', '{"phase":160}'::jsonb),
  ('object_detection', 'Object detection', 'ai_vision', 'pose_motion', 'Detects objects relevant to environment safety.', 'regulated', 'medium', 'internal_only', true, true, 'legal_review_required_before_consent', true, 'Object detection must be scoped to safety and privacy.', '{"phase":160}'::jsonb),
  ('face_recognition', 'Face recognition', 'ai_vision', 'identity', 'Facial recognition identity capability.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160}'::jsonb),
  ('face_matching', 'Face matching', 'ai_vision', 'identity', 'Face matching against known identity.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160}'::jsonb),
  ('gait_recognition', 'Gait recognition', 'ai_vision', 'identity', 'Gait-based identity inference.', 'regulated', 'high', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Legal-review-only for future verticals.', '{"phase":160}'::jsonb),
  ('soft_biometric_matching', 'Soft biometric matching', 'ai_vision', 'identity', 'Soft biometric identity inference.', 'regulated', 'high', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Legal-review-only for future verticals.', '{"phase":160}'::jsonb),
  ('audio_recording', 'Audio recording', 'audio', 'audio_processing', 'Microphone or audio recording capability.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160}'::jsonb),
  ('audio_analytics', 'Audio analytics', 'audio', 'audio_processing', 'Audio signal classification or analysis.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160}'::jsonb),
  ('keyword_detection', 'Keyword detection', 'audio', 'audio_processing', 'Keyword spotting from audio.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160}'::jsonb),
  ('speech_recognition', 'Speech recognition', 'audio', 'audio_processing', 'Speech-to-text or speech interpretation.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160}'::jsonb),
  ('distress_sound_detection', 'Distress sound detection', 'audio', 'audio_processing', 'Sound-based distress detection.', 'regulated', 'high', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Future-only outside Gan Batuach unless legally approved.', '{"phase":160}'::jsonb),
  ('risk_scoring', 'Risk scoring', 'observer', 'risk', 'Advisory risk score or prioritization.', 'confidential', 'high', 'internal_only', true, true, 'no_consent_required', true, 'Advisory risk indicator only; no enforcement.', '{"phase":160}'::jsonb),
  ('anomaly_scoring', 'Anomaly scoring', 'observer', 'risk', 'Advisory anomaly score.', 'confidential', 'high', 'internal_only', true, true, 'no_consent_required', true, 'Anomaly score requires review.', '{"phase":160}'::jsonb),
  ('incident_recommendations', 'Incident recommendations', 'observer', 'case_management', 'Recommended follow-up actions.', 'confidential', 'medium', 'internal_only', true, false, 'no_consent_required', true, 'Recommendations only; no automatic decisions.', '{"phase":160}'::jsonb),
  ('predictive_safety', 'Predictive safety', 'observer', 'risk', 'Predictive safety indicators.', 'confidential', 'high', 'internal_only', true, true, 'no_consent_required', true, 'Predictions are not accusations.', '{"phase":160}'::jsonb),
  ('human_review_queue', 'Human review queue', 'observer', 'case_management', 'Human review lifecycle.', 'confidential', 'low', 'internal_only', true, false, 'no_consent_required', true, 'Human review is mandatory for sensitive outcomes.', '{"phase":160}'::jsonb),
  ('investigation_linking', 'Investigation linking', 'observer', 'case_management', 'Link reviewed signals to cases.', 'sensitive', 'high', 'internal_only', true, false, 'no_consent_required', true, 'Only reviewed signals may link to cases.', '{"phase":160}'::jsonb),
  ('medical_data_processing', 'Medical data processing', 'data', 'data_processing', 'Medical data storage and processing.', 'medical', 'critical', 'disabled', true, true, 'explicit_consent_required', false, 'Medical data must be encrypted and audited.', '{"phase":160}'::jsonb),
  ('child_data_processing', 'Child data processing', 'data', 'data_processing', 'Child profile, attendance and timeline data.', 'regulated', 'critical', 'approved_document', true, true, 'legal_review_required_before_consent', false, 'Child data is vertical-scoped and parent-visible only where approved.', '{"phase":160}'::jsonb),
  ('parent_data_processing', 'Parent data processing', 'data', 'data_processing', 'Parent identity, contact and account data.', 'sensitive', 'high', 'approved_document', true, true, 'legal_review_required_before_consent', false, 'Parent data requires privacy rights support.', '{"phase":160}'::jsonb),
  ('staff_data_processing', 'Staff data processing', 'data', 'data_processing', 'Staff identity, attendance and compliance data.', 'sensitive', 'high', 'internal_only', true, true, 'staff_consent_required', false, 'Staff data requires employment/privacy review.', '{"phase":160}'::jsonb),
  ('ai_telemetry', 'AI telemetry', 'data', 'data_processing', 'AI telemetry and model signals.', 'regulated', 'high', 'internal_only', true, true, 'no_consent_required', true, 'Telemetry must not store direct PII.', '{"phase":160}'::jsonb),
  ('audit_logs', 'Audit logs', 'data', 'audit', 'Immutable audit evidence.', 'regulated', 'medium', 'internal_only', true, false, 'no_consent_required', true, 'Audit logs are append-only and access-limited.', '{"phase":160}'::jsonb)
on conflict (capability_key) do update set
  capability_name = excluded.capability_name,
  category = excluded.category,
  capability_group = excluded.capability_group,
  description = excluded.description,
  data_sensitivity = excluded.data_sensitivity,
  default_risk_level = excluded.default_risk_level,
  default_parent_visibility = excluded.default_parent_visibility,
  requires_human_review = excluded.requires_human_review,
  requires_dpia = excluded.requires_dpia,
  consent_requirement = excluded.consent_requirement,
  core_available = excluded.core_available,
  product_copy_guardrail = excluded.product_copy_guardrail,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_capability_registry (capability_key, capability_name, category, capability_group, description, data_sensitivity, default_risk_level, default_parent_visibility, requires_human_review, requires_dpia, consent_requirement, core_available, product_copy_guardrail, metadata)
values
  ('camera_health_monitoring', 'Camera health monitoring', 'camera', 'security', 'Camera availability, gateway status and stream health checks.', 'internal', 'low', 'internal_only', true, false, 'no_consent_required', true, 'Camera health is operational status, not child monitoring.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('reviewed_safety_summaries', 'Reviewed safety summaries', 'observer', 'case_management', 'Parent-safe or manager-safe summaries after human approval.', 'regulated', 'medium', 'approved_summary', true, true, 'no_consent_required', true, 'Only reviewed and approved summaries may be shared.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('contextual_child_association', 'Contextual child association', 'ai_vision', 'identity', 'Daily ephemeral context that may associate a signal with a child without face/audio data.', 'regulated', 'high', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled unless legal review explicitly approves the limited context model.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('persistent_skeleton_identity', 'Persistent skeleton identity', 'ai_vision', 'identity', 'Cross-session skeleton identity persistence.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('cross_day_identity_tracking', 'Cross-day identity tracking', 'ai_vision', 'identity', 'Identity tracking across days or sessions.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('child_biometric_face_profile', 'Child biometric face profile', 'ai_vision', 'identity', 'Persistent child face profile or biometric identifier.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('raw_ai_parent_visibility', 'Raw AI parent visibility', 'observer', 'risk', 'Raw or unreviewed AI events visible to parents.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled for Gan Batuach. Parents may see only approved summaries.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('automatic_ai_accusations', 'Automatic AI accusations', 'observer', 'risk', 'AI statements that accuse a person or assign blame.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Forbidden wording and workflow for Gan Batuach.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('automatic_disciplinary_actions', 'Automatic disciplinary actions', 'observer', 'case_management', 'AI-triggered disciplinary or regulatory action without human decision.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Disabled. AI may recommend; humans decide.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('occupancy_analytics', 'Occupancy analytics', 'analytics', 'pose_motion', 'Future occupancy or density analytics for non-kindergarten verticals.', 'internal', 'medium', 'internal_only', true, true, 'legal_review_required_before_consent', true, 'Future vertical capability only.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('regional_analytics', 'Regional analytics', 'analytics', 'risk', 'Aggregated regional analytics for future municipal deployments.', 'confidential', 'high', 'internal_only', true, true, 'legal_review_required_before_consent', true, 'Future municipal capability only.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('multi_site_observer', 'Multi-site observer', 'observer', 'risk', 'Future multi-site observation and aggregation workflows.', 'confidential', 'high', 'internal_only', true, true, 'legal_review_required_before_consent', true, 'Future enterprise capability only.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('raw_child_data_access', 'Raw child data access', 'data', 'data_processing', 'Direct raw child data access across sites.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', false, 'Disabled unless a vertical policy and legal basis approve it.', '{"phase":160,"registry_completion":true}'::jsonb),
  ('unreviewed_public_streaming', 'Unreviewed public streaming', 'camera', 'streaming', 'Public or unrestricted streaming without approval.', 'regulated', 'critical', 'disabled', true, true, 'legal_review_required_before_consent', true, 'Forbidden for Gan Batuach and blocked by policy.', '{"phase":160,"registry_completion":true}'::jsonb)
on conflict (capability_key) do update set
  capability_name = excluded.capability_name,
  category = excluded.category,
  capability_group = excluded.capability_group,
  description = excluded.description,
  data_sensitivity = excluded.data_sensitivity,
  default_risk_level = excluded.default_risk_level,
  default_parent_visibility = excluded.default_parent_visibility,
  requires_human_review = excluded.requires_human_review,
  requires_dpia = excluded.requires_dpia,
  consent_requirement = excluded.consent_requirement,
  core_available = excluded.core_available,
  product_copy_guardrail = excluded.product_copy_guardrail,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_verticals (vertical_key, vertical_name, regulatory_profile, country, allowed_capabilities, restricted_capabilities, disabled_capabilities, required_approvals, launch_status, launch_decision_summary, metadata)
values
  ('digital_observer_core', 'Digital Observer Core', 'DIGITAL_OBSERVER_CORE_PROFILE', 'technical_core', array['all_core_capabilities'], '{}'::text[], '{}'::text[], array['vertical_policy_before_use'], 'internal_testing', 'Technical core may contain capabilities disabled in product verticals.', '{"not_a_legal_product_profile":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'GAN_BATUACH_ISRAEL_PROFILE', 'Israel', array['pose_estimation','skeleton_analytics','motion_analytics','fall_detection','inactivity_detection','crowding_detection','restricted_area_detection','camera_health_monitoring','reviewed_safety_summaries','human_review_queue'], array['contextual_child_association','soft_biometric_matching','gait_recognition','persistent_skeleton_identity','cross_day_identity_tracking','parent_viewing'], array['audio_recording','audio_analytics','keyword_detection','speech_recognition','face_recognition','face_matching','child_biometric_face_profile','raw_ai_parent_visibility','automatic_ai_accusations','automatic_disciplinary_actions'], array['privacy_lawyer','camera_policy_review','iso_consultant','penetration_test'], 'pilot_ready', 'Allowed motion intelligence only; legal review remains required for parent streaming and identity-like signals.', '{"regulatory_mode":"GAN_BATUACH_ISRAEL_MODE"}'::jsonb),
  ('school_safe', 'School Safe', 'SCHOOL_SAFE_PROFILE', 'future', '{}'::text[], array['pose_estimation','skeleton_analytics','motion_analytics'], array['face_recognition','audio_recording'], array['privacy_lawyer','education_law_review'], 'legal_review_required', 'Future vertical only.', '{"future_vertical":true}'::jsonb),
  ('home_observer', 'Home Observer', 'HOME_OBSERVER_PROFILE', 'future', '{}'::text[], array['live_streaming','motion_analytics'], array['unreviewed_public_streaming'], array['privacy_lawyer','household_consent_review'], 'legal_review_required', 'Future vertical only.', '{"future_vertical":true}'::jsonb),
  ('business_observer', 'Business Observer', 'BUSINESS_OBSERVER_PROFILE', 'future', '{}'::text[], array['motion_analytics','risk_scoring'], array['child_data_processing'], array['labor_privacy_review'], 'legal_review_required', 'Future vertical only.', '{"future_vertical":true}'::jsonb),
  ('office_observer', 'Office Observer', 'OFFICE_OBSERVER_PROFILE', 'future', '{}'::text[], array['motion_analytics','occupancy_analytics'], array['child_data_processing'], array['labor_privacy_review'], 'legal_review_required', 'Future office vertical only.', '{"future_vertical":true}'::jsonb),
  ('warehouse_observer', 'Warehouse Observer', 'WAREHOUSE_OBSERVER_PROFILE', 'future', '{}'::text[], array['motion_analytics','restricted_area_detection'], array['child_data_processing'], array['labor_privacy_review','safety_review'], 'legal_review_required', 'Future warehouse vertical only.', '{"future_vertical":true}'::jsonb),
  ('municipality_observer', 'Municipality Observer', 'MUNICIPALITY_OBSERVER_PROFILE', 'future', '{}'::text[], array['regional_analytics','risk_scoring'], array['raw_child_data_access'], array['municipal_legal_review','procurement_review'], 'legal_review_required', 'Future municipal vertical only.', '{"future_vertical":true}'::jsonb),
  ('enterprise_observer', 'Enterprise Observer', 'ENTERPRISE_OBSERVER_PROFILE', 'future', '{}'::text[], array['multi_site_observer','risk_scoring'], array['child_data_processing'], array['customer_contract_review','privacy_review'], 'legal_review_required', 'Future enterprise vertical only.', '{"future_vertical":true}'::jsonb)
on conflict (vertical_key) do update set
  vertical_name = excluded.vertical_name,
  regulatory_profile = excluded.regulatory_profile,
  country = excluded.country,
  allowed_capabilities = excluded.allowed_capabilities,
  restricted_capabilities = excluded.restricted_capabilities,
  disabled_capabilities = excluded.disabled_capabilities,
  required_approvals = excluded.required_approvals,
  launch_status = excluded.launch_status,
  launch_decision_summary = excluded.launch_decision_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_vertical_capability_decisions (
  decision_key, vertical_key, capability_key, capability_status, legal_status, risk_level, enabled,
  review_owner_role, external_legal_review_required, consent_requirement, parent_visibility_rule,
  human_review_required, automatic_action_allowed, dpia_required, decision_reason, launch_blocker, metadata
)
select
  'gan-batuach-' || capability_key,
  'gan_batuach',
  capability_key,
  case
    when capability_key in ('pose_estimation','skeleton_analytics','motion_analytics','fall_detection','inactivity_detection','crowding_detection','restricted_area_detection','watermarking','anti_screen_capture','human_review_queue','incident_recommendations','audit_logs','ai_telemetry') then 'allowed'
    when capability_key in ('live_streaming','parent_viewing') then 'legal_review_required'
    when capability_key in ('contextual_child_association','soft_biometric_matching','gait_recognition','predictive_safety','object_detection','recording','playback','snapshots') then 'legal_review_required'
    when capability_key in ('audio_recording','audio_analytics','keyword_detection','speech_recognition','distress_sound_detection','face_recognition','face_matching') then 'disabled'
    else 'restricted'
  end as capability_status,
  case
    when capability_key in ('pose_estimation','skeleton_analytics','motion_analytics','fall_detection','inactivity_detection','crowding_detection','restricted_area_detection','watermarking','anti_screen_capture','human_review_queue','incident_recommendations','audit_logs','ai_telemetry') then 'allowed'
    when capability_key in ('audio_recording','audio_analytics','keyword_detection','speech_recognition','distress_sound_detection','face_recognition','face_matching') then 'disabled'
    else 'legal_review_required'
  end as legal_status,
  default_risk_level,
  capability_key in ('pose_estimation','skeleton_analytics','motion_analytics','fall_detection','inactivity_detection','crowding_detection','restricted_area_detection','watermarking','anti_screen_capture','human_review_queue','incident_recommendations','audit_logs','ai_telemetry') as enabled,
  'admin',
  capability_key not in ('pose_estimation','skeleton_analytics','motion_analytics','fall_detection','inactivity_detection','crowding_detection','restricted_area_detection','watermarking','anti_screen_capture','human_review_queue','incident_recommendations','audit_logs','ai_telemetry'),
  case when capability_key in ('parent_viewing','live_streaming') then 'legal_review_required_before_consent' else consent_requirement end,
  case
    when capability_key in ('fall_detection','inactivity_detection','crowding_detection','restricted_area_detection','incident_recommendations') then 'approved_summary'
    when capability_key in ('parent_viewing','live_streaming') then 'approved_stream'
    else 'internal_only'
  end,
  true,
  false,
  requires_dpia or default_risk_level in ('critical','high'),
  case
    when capability_key in ('audio_recording','audio_analytics','keyword_detection','speech_recognition','distress_sound_detection','face_recognition','face_matching') then 'Disabled for Gan Batuach Israel profile.'
    when capability_key in ('pose_estimation','skeleton_analytics','motion_analytics','fall_detection','inactivity_detection','crowding_detection','restricted_area_detection') then 'Allowed as non-identifying motion intelligence with mandatory human review.'
    when capability_key in ('parent_viewing','live_streaming') then 'Requires camera compliance and external legal policy review before production.'
    else 'Requires vertical legal review before activation.'
  end,
  capability_key in ('audio_recording','audio_analytics','keyword_detection','speech_recognition','distress_sound_detection','face_recognition','face_matching'),
  jsonb_build_object('phase',160,'profile','GAN_BATUACH_ISRAEL_PROFILE')
from public.observer_capability_registry
on conflict (vertical_key, capability_key) do update set
  capability_status = excluded.capability_status,
  legal_status = excluded.legal_status,
  risk_level = excluded.risk_level,
  enabled = excluded.enabled,
  review_owner_role = excluded.review_owner_role,
  external_legal_review_required = excluded.external_legal_review_required,
  consent_requirement = excluded.consent_requirement,
  parent_visibility_rule = excluded.parent_visibility_rule,
  human_review_required = excluded.human_review_required,
  automatic_action_allowed = excluded.automatic_action_allowed,
  dpia_required = excluded.dpia_required,
  decision_reason = excluded.decision_reason,
  launch_blocker = excluded.launch_blocker,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_vertical_capability_decisions (
  decision_key, vertical_key, capability_key, capability_status, legal_status, risk_level, enabled,
  review_owner_role, external_legal_review_required, consent_requirement, parent_visibility_rule,
  human_review_required, automatic_action_allowed, dpia_required, decision_reason, launch_blocker, metadata
)
select
  vertical_key || '-' || capability_key,
  vertical_key,
  capability_key,
  case when vertical_key = 'digital_observer_core' then 'allowed' else 'future_only' end,
  case when vertical_key = 'digital_observer_core' then 'allowed' else 'legal_review_required' end,
  default_risk_level,
  vertical_key = 'digital_observer_core',
  'admin',
  vertical_key <> 'digital_observer_core',
  consent_requirement,
  default_parent_visibility,
  true,
  false,
  requires_dpia,
  case when vertical_key = 'digital_observer_core' then 'Technical core availability. Product verticals must decide separately.' else 'Future vertical only. Requires legal and product review before launch.' end,
  false,
  jsonb_build_object('phase',160,'future_vertical',vertical_key <> 'digital_observer_core')
from public.observer_capability_registry
cross join (values
  ('digital_observer_core'),
  ('school_safe'),
  ('home_observer'),
  ('business_observer'),
  ('office_observer'),
  ('warehouse_observer'),
  ('municipality_observer'),
  ('enterprise_observer')
) as verticals(vertical_key)
on conflict (vertical_key, capability_key) do nothing;

insert into public.legal_review_items (item_key, item_title, risk_level, affected_module, legal_question, current_status, owner_role, required_external_review, target_review_date, capability_key, vertical_key, decision, supporting_documents, metadata)
values
  ('capability-parent-camera-streaming-gan-batuach', 'Parent camera streaming policy for Gan Batuach', 'high', 'Camera Platform', 'Which notices, consent, viewing windows, watermarking and session controls are required for parent camera streaming?', 'requires_external_review', 'admin', 'privacy_lawyer', current_date + 45, 'parent_viewing', 'gan_batuach', 'pending', '["LEGAL_CAMERA_STREAMING_PARENT_VIEWING_AND_ANTI_LEAK_PROTECTION_PLATFORM.md"]'::jsonb, '{"phase":160}'::jsonb),
  ('capability-contextual-child-association-gan-batuach', 'Contextual child association in Gan Batuach', 'high', 'AI Observer', 'Can contextual child association through daily ephemeral skeleton/context signals be used without biometric profiling?', 'requires_external_review', 'admin', 'privacy_lawyer', current_date + 45, 'contextual_child_association', 'gan_batuach', 'pending', '["SKELETON_ANALYTICS_MOTION_INTELLIGENCE_AND_ANONYMOUS_OBSERVER_PLATFORM.md"]'::jsonb, '{"phase":160}'::jsonb),
  ('capability-public-safety-score-gan-batuach', 'Parent/public safety score exposure', 'medium', 'Trust and Transparency', 'Which safety or trust scores may be exposed without certification, defamation or regulatory risk?', 'requires_external_review', 'admin', 'legal_counsel', current_date + 75, 'risk_scoring', 'gan_batuach', 'pending', '["PARENT_TRUST_TRANSPARENCY_AND_COMMUNITY_PLATFORM.md"]'::jsonb, '{"phase":160}'::jsonb)
on conflict (item_key) do update set
  item_title = excluded.item_title,
  risk_level = excluded.risk_level,
  affected_module = excluded.affected_module,
  legal_question = excluded.legal_question,
  current_status = excluded.current_status,
  owner_role = excluded.owner_role,
  required_external_review = excluded.required_external_review,
  target_review_date = excluded.target_review_date,
  capability_key = excluded.capability_key,
  vertical_key = excluded.vertical_key,
  decision = excluded.decision,
  supporting_documents = excluded.supporting_documents,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_product_copy_guardrails (guardrail_key, vertical_key, forbidden_claim, approved_wording, rationale, status, metadata)
values
  ('gan-no-ai-identifies-children', 'gan_batuach', 'AI identifies children', 'המערכת מנתחת תנועה ואירועים לבדיקה אנושית, ללא זיהוי פנים של ילדים.', 'Avoid biometric identification claims.', 'active', '{"phase":160}'::jsonb),
  ('gan-no-violence-certainty', 'gan_batuach', 'AI detects violence with certainty', 'המערכת מזהה חריגות תנועה שדורשות סקירה אנושית.', 'Avoid certainty, accusation and disciplinary claims.', 'active', '{"phase":160}'::jsonb),
  ('gan-no-replaces-supervision', 'gan_batuach', 'AI replaces human supervision', 'המערכת מסייעת לצוותי פיקוח ובטיחות ואינה מחליפה השגחה אנושית.', 'Human oversight remains mandatory.', 'active', '{"phase":160}'::jsonb),
  ('gan-no-automatic-decisions', 'gan_batuach', 'Automatic safety decisions', 'המערכת מייצרת תובנות בטיחות מאושרות לאחר בדיקה.', 'No automatic regulatory or disciplinary decisions.', 'active', '{"phase":160}'::jsonb)
on conflict (guardrail_key) do update set
  vertical_key = excluded.vertical_key,
  forbidden_claim = excluded.forbidden_claim,
  approved_wording = excluded.approved_wording,
  rationale = excluded.rationale,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_capability_audit_events (event_key, event_type, vertical_key, capability_key, status, reason, metadata)
values
  ('phase160-gan-batuach-profile-seeded', 'legal_review_required', 'gan_batuach', 'parent_viewing', 'logged', 'Gan Batuach capability decisions seeded for legal review matrix.', '{"phase":160}'::jsonb),
  ('phase160-core-profile-seeded', 'capability_enabled', 'digital_observer_core', 'observer_capability_registry', 'logged', 'Digital Observer Core capability registry seeded. Product verticals decide separately.', '{"phase":160}'::jsonb)
on conflict (event_key) do update set
  event_type = excluded.event_type,
  vertical_key = excluded.vertical_key,
  capability_key = excluded.capability_key,
  status = excluded.status,
  reason = excluded.reason,
  metadata = excluded.metadata;

comment on table public.observer_capability_registry is 'Legal and technical capability registry for Digital Observer Core and all product verticals.';
comment on table public.observer_verticals is 'Vertical launch registry with regulatory profile, country, capability groups, required approvals and launch decision.';
comment on table public.observer_vertical_capability_decisions is 'Per-vertical capability legal decision matrix. Restricted capabilities must not be silently enabled in Gan Batuach.';
comment on table public.observer_capability_audit_events is 'Capability governance audit events for enable, disable, block, legal review and override decisions.';
comment on table public.observer_product_copy_guardrails is 'Internal product wording guardrails to prevent unsafe AI, biometric or certification claims.';
