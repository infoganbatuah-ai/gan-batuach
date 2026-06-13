-- PHASE 145: Israeli Regulatory Mode, Privacy-by-Design & Legal Compliance Foundation

alter table if exists public.ai_vertical_capability_matrix
  drop constraint if exists ai_capability_vertical_check;

alter table if exists public.ai_vertical_capability_matrix
  add constraint ai_capability_vertical_check
  check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer'));

create table if not exists public.regulatory_policy_modes (
  id uuid primary key default gen_random_uuid(),
  mode_key text not null unique,
  vertical_key text not null,
  mode_name text not null,
  jurisdiction text not null default 'israel',
  status text not null default 'draft',
  effective_from timestamptz,
  policy_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint regulatory_policy_mode_vertical_check check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer')),
  constraint regulatory_policy_mode_status_check check (status in ('draft','enabled','disabled','retired'))
);

create table if not exists public.vertical_capability_matrix (
  id uuid primary key default gen_random_uuid(),
  vertical_key text not null,
  vertical_name text not null,
  capability_key text not null,
  capability_name text not null,
  capability_category text not null,
  capability_status text not null,
  is_core_capability boolean not null default false,
  regulatory_mode_key text references public.regulatory_policy_modes(mode_key) on delete set null,
  legal_status text not null default 'legal_review_required',
  legal_basis text,
  restriction_summary text,
  human_review_required boolean not null default true,
  parent_visible_allowed boolean not null default false,
  approval_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(vertical_key, capability_key),
  constraint vertical_capability_matrix_vertical_check check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer')),
  constraint vertical_capability_matrix_status_check check (capability_status in ('enabled','disabled','legal_review_required')),
  constraint vertical_capability_matrix_legal_status_check check (legal_status in ('allowed','disabled','restricted','legal_review_required'))
);

create table if not exists public.legal_feature_registry (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  feature_name text not null,
  feature_category text not null,
  legal_status text not null,
  allowed_verticals text[] not null default '{}'::text[],
  restricted_verticals text[] not null default '{}'::text[],
  approval_required boolean not null default true,
  restriction_summary text,
  parent_visibility_rule text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_feature_status_check check (legal_status in ('allowed','disabled','restricted','legal_review_required'))
);

create table if not exists public.privacy_by_design_controls (
  id uuid primary key default gen_random_uuid(),
  control_key text not null unique,
  vertical_key text not null,
  principle text not null,
  control_name text not null,
  status text not null default 'partial',
  readiness_score integer not null default 0,
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privacy_by_design_vertical_check check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer')),
  constraint privacy_by_design_principle_check check (principle in ('data_minimization','purpose_limitation','access_limitation','retention_limitation','parent_visibility','human_review','auditability')),
  constraint privacy_by_design_status_check check (status in ('implemented','partial','missing','legal_review_required')),
  constraint privacy_by_design_score_check check (readiness_score between 0 and 100)
);

create table if not exists public.parent_visibility_policy_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  vertical_key text not null,
  source_type text not null,
  visibility_status text not null,
  approval_required boolean not null default true,
  rule_summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_visibility_vertical_check check (vertical_key in ('gan_batuach','school_safe','home_observer')),
  constraint parent_visibility_status_check check (visibility_status in ('allowed_after_review','blocked','legal_review_required'))
);

create table if not exists public.regulatory_policy_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_key text unique,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  vertical_key text,
  capability_key text,
  feature_key text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint regulatory_policy_audit_type_check check (event_type in ('capability_changed','policy_changed','feature_activation','feature_restriction','restriction_override','legal_review_recorded','mode_enabled'))
);

create index if not exists regulatory_policy_modes_vertical_idx on public.regulatory_policy_modes(vertical_key, status);
create index if not exists vertical_capability_matrix_vertical_idx on public.vertical_capability_matrix(vertical_key, capability_status);
create index if not exists vertical_capability_matrix_category_idx on public.vertical_capability_matrix(capability_category, capability_status);
create index if not exists legal_feature_registry_status_idx on public.legal_feature_registry(legal_status, feature_category);
create index if not exists privacy_by_design_controls_vertical_idx on public.privacy_by_design_controls(vertical_key, principle);
create index if not exists parent_visibility_policy_rules_vertical_idx on public.parent_visibility_policy_rules(vertical_key, visibility_status);
create index if not exists regulatory_policy_audit_events_created_idx on public.regulatory_policy_audit_events(created_at desc);

alter table public.regulatory_policy_modes enable row level security;
alter table public.vertical_capability_matrix enable row level security;
alter table public.legal_feature_registry enable row level security;
alter table public.privacy_by_design_controls enable row level security;
alter table public.parent_visibility_policy_rules enable row level security;
alter table public.regulatory_policy_audit_events enable row level security;

drop policy if exists "regulatory policy modes admin only" on public.regulatory_policy_modes;
create policy "regulatory policy modes admin only" on public.regulatory_policy_modes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vertical capability matrix admin only" on public.vertical_capability_matrix;
create policy "vertical capability matrix admin only" on public.vertical_capability_matrix for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "legal feature registry admin only" on public.legal_feature_registry;
create policy "legal feature registry admin only" on public.legal_feature_registry for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "privacy controls admin only" on public.privacy_by_design_controls;
create policy "privacy controls admin only" on public.privacy_by_design_controls for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parent visibility rules admin only" on public.parent_visibility_policy_rules;
create policy "parent visibility rules admin only" on public.parent_visibility_policy_rules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "regulatory policy audit admin read" on public.regulatory_policy_audit_events;
create policy "regulatory policy audit admin read" on public.regulatory_policy_audit_events for select using (public.is_admin());

drop policy if exists "regulatory policy audit admin insert" on public.regulatory_policy_audit_events;
create policy "regulatory policy audit admin insert" on public.regulatory_policy_audit_events for insert with check (public.is_admin());

insert into public.regulatory_policy_modes (mode_key, vertical_key, mode_name, jurisdiction, status, effective_from, policy_summary, metadata)
values
  ('GAN_BATUACH_ISRAEL_MODE', 'gan_batuach', 'Gan Batuach Israel Regulatory Mode', 'israel', 'enabled', now(), 'Kindergarten-specific legal mode: audio, face recognition and child biometric profiling are disabled; motion safety analytics are allowed with human review.', '{"automatic_parent_alerts":false,"automatic_discipline":false,"human_review_required":true}'::jsonb),
  ('DIGITAL_OBSERVER_CORE_POLICY', 'digital_observer_core', 'Digital Observer Core Capability Policy', 'global', 'enabled', now(), 'Core platform keeps capabilities available, while vertical policy decides what is permitted.', '{"core_removed":false}'::jsonb),
  ('SCHOOL_SAFE_REVIEW_MODE', 'school_safe', 'School Safe Legal Review Mode', 'future', 'draft', null, 'Future school vertical requires separate legal review before activation.', '{}'::jsonb),
  ('BUSINESS_OBSERVER_REVIEW_MODE', 'business_observer', 'Business Observer Legal Review Mode', 'future', 'draft', null, 'Future workplace/business observer vertical requires legal review before activation.', '{}'::jsonb),
  ('HOME_OBSERVER_REVIEW_MODE', 'home_observer', 'Home Observer Legal Review Mode', 'future', 'draft', null, 'Future home observer vertical requires legal review before activation.', '{}'::jsonb),
  ('MUNICIPALITY_OBSERVER_REVIEW_MODE', 'municipality_observer', 'Municipality Observer Legal Review Mode', 'future', 'draft', null, 'Future municipal observer vertical requires legal and procurement review before activation.', '{}'::jsonb)
on conflict (mode_key) do update set
  vertical_key = excluded.vertical_key,
  mode_name = excluded.mode_name,
  jurisdiction = excluded.jurisdiction,
  status = excluded.status,
  policy_summary = excluded.policy_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.vertical_capability_matrix (
  vertical_key, vertical_name, capability_key, capability_name, capability_category, capability_status,
  is_core_capability, regulatory_mode_key, legal_status, legal_basis, restriction_summary,
  human_review_required, parent_visible_allowed, approval_required, metadata
)
values
  ('digital_observer_core', 'Digital Observer Core', 'audio_recording', 'Audio recording', 'audio', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'restricted', 'Core capability retained for vertical-specific policy control.', 'Core capability exists but must be disabled for Gan Batuach Israel Mode.', true, false, true, '{"core_available":true}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'audio_analysis', 'Audio analysis', 'audio', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'restricted', 'Core capability retained for vertical-specific policy control.', 'Core capability exists but must be disabled for Gan Batuach Israel Mode.', true, false, true, '{"core_available":true}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'face_recognition', 'Face recognition', 'face_recognition', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'restricted', 'Core capability retained for vertical-specific policy control.', 'Core capability exists but must be disabled for Gan Batuach Israel Mode.', true, false, true, '{"core_available":true}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'pose_estimation', 'Pose estimation', 'ai_motion', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'allowed', 'Non-identifying motion analysis capability.', 'Human review required before safety action.', true, false, false, '{"core_available":true}'::jsonb),
  ('digital_observer_core', 'Digital Observer Core', 'risk_recommendations', 'Risk recommendations', 'governance', 'enabled', true, 'DIGITAL_OBSERVER_CORE_POLICY', 'restricted', 'Recommendations are advisory only.', 'No autonomous action or enforcement.', true, false, true, '{"automatic_action":false}'::jsonb),

  ('gan_batuach', 'Gan Batuach', 'audio_recording', 'Audio recording', 'audio', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Audio recording is disabled system-wide for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'audio_analysis', 'Audio analysis', 'audio', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Audio analysis is disabled system-wide for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'keyword_detection', 'Keyword detection', 'audio', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Keyword detection is disabled system-wide for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'speech_recognition', 'Speech recognition', 'audio', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Speech recognition is disabled system-wide for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'sound_classification', 'Sound classification', 'audio', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Sound classification is disabled system-wide for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),

  ('gan_batuach', 'Gan Batuach', 'face_recognition', 'Face recognition', 'face_recognition', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Face recognition is disabled for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'facial_identification', 'Facial identification', 'face_recognition', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Facial identification is disabled for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'facial_embeddings', 'Facial embeddings', 'face_recognition', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Facial embeddings are disabled for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'facial_matching', 'Facial matching', 'face_recognition', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Israeli kindergarten privacy mode.', 'Facial matching is disabled for Gan Batuach.', true, false, true, '{"system_wide_disabled":true}'::jsonb),

  ('gan_batuach', 'Gan Batuach', 'child_biometric_profiles', 'Child biometric profiles', 'biometric', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Explicit legal approval required before any biometric profile use.', 'Persistent child biometric profiles are disabled.', true, false, true, '{"legal_approval_required":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'child_face_databases', 'Child face databases', 'biometric', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Explicit legal approval required before any biometric database use.', 'Child face databases are disabled.', true, false, true, '{"legal_approval_required":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'persistent_biometric_identifiers', 'Persistent biometric identifiers', 'biometric', 'disabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'disabled', 'Explicit legal approval required before persistent identifiers.', 'Persistent biometric identifiers are disabled.', true, false, true, '{"legal_approval_required":true}'::jsonb),

  ('gan_batuach', 'Gan Batuach', 'pose_estimation', 'Pose estimation', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Non-identifying motion analysis for safety review.', 'Allowed only as non-identifying signal with human review.', true, false, false, '{"non_identifying":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'skeleton_tracking', 'Skeleton tracking', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Non-identifying skeleton signal for safety review.', 'No persistent identity tracking.', true, false, false, '{"persistent_identity":false}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'motion_analytics', 'Motion analytics', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Non-identifying motion analysis.', 'Human review required for recommendations.', true, false, false, '{"recommendations_only":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'fall_detection', 'Fall detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Safety signal detection without automatic accusation.', 'Human review required before action or parent visibility.', true, false, false, '{"automatic_parent_alert":false}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'crowd_density_detection', 'Crowd density detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Area-level non-identifying density signal.', 'Human review required for any operational action.', true, false, false, '{"area_level_only":true}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'restricted_area_detection', 'Restricted area detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Area-level safety signal.', 'No identity inference; human review required.', true, false, false, '{"identity_inference":false}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'inactivity_detection', 'Inactivity detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Non-identifying safety signal.', 'Human review required before escalation.', true, false, false, '{}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'anomaly_detection', 'Anomaly detection', 'ai_motion', 'enabled', false, 'GAN_BATUACH_ISRAEL_MODE', 'allowed', 'Pattern detection for review only.', 'No automatic conclusions, accusations or parent panic notifications.', true, false, false, '{"automatic_conclusions":false}'::jsonb),

  ('gan_batuach', 'Gan Batuach', 'gait_recognition', 'Gait recognition', 'ai_identity', 'legal_review_required', false, 'GAN_BATUACH_ISRAEL_MODE', 'legal_review_required', 'Potential biometric identification risk.', 'Legal review required before activation.', true, false, true, '{}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'persistent_skeleton_identity_tracking', 'Persistent skeleton identity tracking', 'ai_identity', 'legal_review_required', false, 'GAN_BATUACH_ISRAEL_MODE', 'legal_review_required', 'Potential cross-session identity tracking risk.', 'Legal review required before activation.', true, false, true, '{}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'soft_biometric_identification', 'Soft biometric identification', 'ai_identity', 'legal_review_required', false, 'GAN_BATUACH_ISRAEL_MODE', 'legal_review_required', 'Potential indirect identification risk.', 'Legal review required before activation.', true, false, true, '{}'::jsonb),
  ('gan_batuach', 'Gan Batuach', 'cross_day_identity_matching', 'Cross-day identity matching', 'ai_identity', 'legal_review_required', false, 'GAN_BATUACH_ISRAEL_MODE', 'legal_review_required', 'Potential persistent identity risk.', 'Legal review required before activation.', true, false, true, '{}'::jsonb),

  ('school_safe', 'School Safe', 'school_observer_capabilities', 'School observer capabilities', 'governance', 'legal_review_required', false, 'SCHOOL_SAFE_REVIEW_MODE', 'legal_review_required', 'Future vertical.', 'Separate school legal review required.', true, false, true, '{}'::jsonb),
  ('business_observer', 'Business Observer', 'business_observer_capabilities', 'Business observer capabilities', 'governance', 'legal_review_required', false, 'BUSINESS_OBSERVER_REVIEW_MODE', 'legal_review_required', 'Future vertical.', 'Separate workplace legal review required.', true, false, true, '{}'::jsonb),
  ('home_observer', 'Home Observer', 'home_observer_capabilities', 'Home observer capabilities', 'governance', 'legal_review_required', false, 'HOME_OBSERVER_REVIEW_MODE', 'legal_review_required', 'Future vertical.', 'Separate home privacy review required.', true, false, true, '{}'::jsonb),
  ('municipality_observer', 'Municipality Observer', 'municipality_observer_capabilities', 'Municipality observer capabilities', 'governance', 'legal_review_required', false, 'MUNICIPALITY_OBSERVER_REVIEW_MODE', 'legal_review_required', 'Future municipal vertical.', 'Separate municipal legal review required.', true, false, true, '{}'::jsonb)
on conflict (vertical_key, capability_key) do update set
  vertical_name = excluded.vertical_name,
  capability_name = excluded.capability_name,
  capability_category = excluded.capability_category,
  capability_status = excluded.capability_status,
  regulatory_mode_key = excluded.regulatory_mode_key,
  legal_status = excluded.legal_status,
  legal_basis = excluded.legal_basis,
  restriction_summary = excluded.restriction_summary,
  human_review_required = excluded.human_review_required,
  parent_visible_allowed = excluded.parent_visible_allowed,
  approval_required = excluded.approval_required,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.legal_feature_registry (feature_key, feature_name, feature_category, legal_status, allowed_verticals, restricted_verticals, approval_required, restriction_summary, parent_visibility_rule, metadata)
values
  ('raw_ai_events_parent_visibility', 'Raw AI events shown to parents', 'parent_visibility', 'disabled', '{}'::text[], array['gan_batuach'], true, 'Parents may not see raw AI events or observer raw signals.', 'blocked', '{}'::jsonb),
  ('approved_parent_safety_summaries', 'Approved parent safety summaries', 'parent_visibility', 'allowed', array['gan_batuach'], '{}'::text[], true, 'Only human-reviewed and approved summaries may be shown to parents.', 'allowed_after_review', '{}'::jsonb),
  ('automatic_parent_panic_notifications', 'Automatic parent panic notifications', 'notification', 'disabled', '{}'::text[], array['gan_batuach'], true, 'AI cannot notify parents automatically about sensitive events.', 'blocked', '{"human_review_required":true}'::jsonb),
  ('automatic_disciplinary_decisions', 'Automatic disciplinary decisions', 'governance', 'disabled', '{}'::text[], array['gan_batuach','school_safe','business_observer'], true, 'No AI or automation may make disciplinary decisions.', 'blocked', '{}'::jsonb),
  ('camera_without_audio', 'Camera without audio', 'camera', 'allowed', array['gan_batuach'], '{}'::text[], false, 'Camera use is allowed only under explicit permission and without audio for Gan Batuach.', 'allowed_after_review', '{}'::jsonb),
  ('investigation_drafts_parent_visibility', 'Investigation drafts shown to parents', 'parent_visibility', 'disabled', '{}'::text[], array['gan_batuach'], true, 'Investigation drafts remain internal and are never parent-visible.', 'blocked', '{}'::jsonb)
on conflict (feature_key) do update set
  feature_name = excluded.feature_name,
  feature_category = excluded.feature_category,
  legal_status = excluded.legal_status,
  allowed_verticals = excluded.allowed_verticals,
  restricted_verticals = excluded.restricted_verticals,
  approval_required = excluded.approval_required,
  restriction_summary = excluded.restriction_summary,
  parent_visibility_rule = excluded.parent_visibility_rule,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.privacy_by_design_controls (control_key, vertical_key, principle, control_name, status, readiness_score, evidence_summary, recommended_action, metadata)
values
  ('gan-data-minimization', 'gan_batuach', 'data_minimization', 'Data minimization', 'partial', 72, 'Regulatory mode disables audio and biometric data paths; remaining data inventories still need legal sign-off.', 'Complete data inventory and retention review before first real deployment.', '{"privacy_by_design":true}'::jsonb),
  ('gan-purpose-limitation', 'gan_batuach', 'purpose_limitation', 'Purpose limitation', 'partial', 76, 'Capabilities are tied to safety, compliance and operational purposes.', 'Add purpose tags to all sensitive observer and camera events.', '{"privacy_by_design":true}'::jsonb),
  ('gan-access-limitation', 'gan_batuach', 'access_limitation', 'Access limitation', 'implemented', 84, 'Parent visibility policy blocks raw AI events and investigation drafts.', 'Continue browser QA for role boundaries.', '{"privacy_by_design":true}'::jsonb),
  ('gan-retention-limitation', 'gan_batuach', 'retention_limitation', 'Retention limitation', 'partial', 68, 'Retention policies exist across document and continuity modules but require final legal retention mapping.', 'Map legal retention per document, camera and observer evidence class.', '{"privacy_by_design":true}'::jsonb),
  ('gan-human-review', 'gan_batuach', 'human_review', 'Human review enforcement', 'implemented', 90, 'AI may detect, classify and recommend; it may not accuse, discipline or notify parents automatically.', 'Keep review-required defaults for all sensitive AI events.', '{"automatic_decisions":false}'::jsonb),
  ('gan-parent-visibility', 'gan_batuach', 'parent_visibility', 'Parent visibility controls', 'implemented', 88, 'Parents may see only approved summaries, approved incidents and approved notifications.', 'Add QA scripts for parent visibility edge cases.', '{"raw_ai_events_parent_visible":false}'::jsonb),
  ('gan-auditability', 'gan_batuach', 'auditability', 'Regulatory auditability', 'partial', 74, 'Capability, policy and restriction override audit table is in place.', 'Wire all future policy edit actions into regulatory audit events.', '{"audit_table":"regulatory_policy_audit_events"}'::jsonb)
on conflict (control_key) do update set
  vertical_key = excluded.vertical_key,
  principle = excluded.principle,
  control_name = excluded.control_name,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.parent_visibility_policy_rules (rule_key, vertical_key, source_type, visibility_status, approval_required, rule_summary, metadata)
values
  ('gan-approved-summary-visible', 'gan_batuach', 'approved_summary', 'allowed_after_review', true, 'Approved summaries may be visible to relevant parents only after human review.', '{"parent_scope_required":true}'::jsonb),
  ('gan-approved-incident-visible', 'gan_batuach', 'approved_incident', 'allowed_after_review', true, 'Approved incident updates may be visible only after review and scope validation.', '{"parent_scope_required":true}'::jsonb),
  ('gan-approved-notification-visible', 'gan_batuach', 'approved_notification', 'allowed_after_review', true, 'Approved notifications may be sent when reviewed and safe.', '{"no_panic_language":true}'::jsonb),
  ('gan-raw-ai-events-blocked', 'gan_batuach', 'raw_ai_event', 'blocked', true, 'Raw AI events are never parent-visible.', '{"raw":true}'::jsonb),
  ('gan-observer-raw-signals-blocked', 'gan_batuach', 'observer_raw_signal', 'blocked', true, 'Observer raw signals are internal review material only.', '{"raw":true}'::jsonb),
  ('gan-investigation-drafts-blocked', 'gan_batuach', 'investigation_draft', 'blocked', true, 'Investigation drafts are internal and not parent-visible.', '{"internal_only":true}'::jsonb)
on conflict (rule_key) do update set
  vertical_key = excluded.vertical_key,
  source_type = excluded.source_type,
  visibility_status = excluded.visibility_status,
  approval_required = excluded.approval_required,
  rule_summary = excluded.rule_summary,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.regulatory_policy_audit_events (event_key, event_type, vertical_key, capability_key, feature_key, before_data, after_data, reason, metadata)
values
  ('phase-145-gan-batuach-israel-mode-enabled', 'mode_enabled', 'gan_batuach', null, null, '{}'::jsonb, '{"mode_key":"GAN_BATUACH_ISRAEL_MODE","status":"enabled"}'::jsonb, 'Phase 145 created Israeli kindergarten regulatory mode.', '{"phase":145}'::jsonb),
  ('phase-145-audio-face-biometric-restrictions', 'feature_restriction', 'gan_batuach', 'audio_recording', null, '{}'::jsonb, '{"audio": "disabled", "face_recognition": "disabled", "biometric_profiles": "disabled"}'::jsonb, 'Gan Batuach Israel mode restricts audio, face recognition and child biometric processing.', '{"phase":145}'::jsonb),
  ('phase-145-parent-visibility-boundary', 'policy_changed', 'gan_batuach', null, 'raw_ai_events_parent_visibility', '{}'::jsonb, '{"parents_see":"approved summaries only","parents_do_not_see":"raw AI events, raw observer signals, investigation drafts"}'::jsonb, 'Parent visibility policy created for approved safe information only.', '{"phase":145}'::jsonb)
on conflict (event_key) do update set
  event_type = excluded.event_type,
  vertical_key = excluded.vertical_key,
  capability_key = excluded.capability_key,
  feature_key = excluded.feature_key,
  after_data = excluded.after_data,
  reason = excluded.reason,
  metadata = excluded.metadata;

insert into public.ai_vertical_capability_matrix (vertical_key, module_name, capability_key, capability_name, enabled, regulatory_mode, human_review_required, parent_visible_allowed, notes, metadata)
values
  ('gan_batuach', 'Gan Batuach Israel Mode', 'audio_recording', 'Audio recording', false, 'disabled', true, false, 'Disabled by GAN_BATUACH_ISRAEL_MODE.', '{"phase":145}'::jsonb),
  ('gan_batuach', 'Gan Batuach Israel Mode', 'audio_analysis', 'Audio analysis', false, 'disabled', true, false, 'Disabled by GAN_BATUACH_ISRAEL_MODE.', '{"phase":145}'::jsonb),
  ('gan_batuach', 'Gan Batuach Israel Mode', 'face_recognition', 'Face recognition', false, 'disabled', true, false, 'Disabled by GAN_BATUACH_ISRAEL_MODE.', '{"phase":145}'::jsonb),
  ('gan_batuach', 'Gan Batuach Israel Mode', 'pose_estimation', 'Pose estimation', true, 'human_review', true, false, 'Allowed as non-identifying motion analysis with human review.', '{"phase":145}'::jsonb),
  ('gan_batuach', 'Gan Batuach Israel Mode', 'fall_detection', 'Fall detection', true, 'human_review', true, false, 'Allowed as advisory detection only. No automatic parent alert.', '{"phase":145}'::jsonb),
  ('gan_batuach', 'Gan Batuach Israel Mode', 'gait_recognition', 'Gait recognition', false, 'restricted', true, false, 'Legal review required before activation.', '{"phase":145}'::jsonb),
  ('municipality_observer', 'Municipality Observer', 'municipality_observer_capabilities', 'Municipality observer capabilities', false, 'restricted', true, false, 'Future vertical legal review required.', '{"phase":145}'::jsonb)
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

comment on table public.regulatory_policy_modes is 'Legal and regulatory modes per vertical, including GAN_BATUACH_ISRAEL_MODE.';
comment on table public.vertical_capability_matrix is 'Policy-controlled capability matrix for Digital Observer Core and each vertical.';
comment on table public.legal_feature_registry is 'Feature legal status registry with allowed verticals and restrictions.';
comment on table public.privacy_by_design_controls is 'Privacy-by-design control readiness across data minimization, purpose, access and retention.';
comment on table public.parent_visibility_policy_rules is 'Parent visibility rules for approved summaries and blocked raw/internal information.';
comment on table public.regulatory_policy_audit_events is 'Append-only audit trail for policy, capability and restriction events.';
