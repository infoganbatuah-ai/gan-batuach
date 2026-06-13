-- PHASE 149: AI Privacy-by-Design, DPIA & Responsible AI Governance Platform

alter table if exists public.ai_governance_reviews
  drop constraint if exists ai_governance_review_type_check;

alter table if exists public.ai_governance_reviews
  add constraint ai_governance_review_type_check
  check (review_type in ('privacy','safety','accuracy','deployment','rollback','regulatory','dpia','ethics','explainability','bias','fairness'));

alter table if exists public.ai_audit_events
  drop constraint if exists ai_audit_event_type_check;

alter table if exists public.ai_audit_events
  add constraint ai_audit_event_type_check
  check (event_type in (
    'model_created','model_changed','threshold_changed','dataset_changed','evaluation_recorded',
    'deployment_requested','deployment_approved','deployment_rejected','rollback_requested',
    'capability_changed','governance_reviewed','dpia_created','dpia_approved',
    'ai_output_reviewed','human_decision_recorded','restriction_applied'
  ));

alter table if exists public.ai_governance_reviews
  add column if not exists review_key text;

create unique index if not exists ai_governance_reviews_review_key_uidx
  on public.ai_governance_reviews(review_key);

create table if not exists public.ai_dpia_assessments (
  id uuid primary key default gen_random_uuid(),
  dpia_key text not null unique,
  ai_system_key text not null,
  ai_system_name text not null,
  vertical_key text not null default 'gan_batuach',
  purpose text not null,
  data_categories text[] not null default '{}'::text[],
  affected_users text[] not null default '{}'::text[],
  risk_level text not null default 'medium',
  mitigation_controls jsonb not null default '[]'::jsonb,
  residual_risk_level text not null default 'medium',
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  approval_status text not null default 'draft',
  approved_at timestamptz,
  next_review_due_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_dpia_vertical_check check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer')),
  constraint ai_dpia_risk_check check (risk_level in ('low','medium','high','restricted','legal_review_required')),
  constraint ai_dpia_residual_risk_check check (residual_risk_level in ('low','medium','high','restricted','legal_review_required')),
  constraint ai_dpia_approval_check check (approval_status in ('draft','in_review','approved','approved_with_restrictions','rejected','expired','needs_update'))
);

create table if not exists public.ai_capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null unique,
  capability_name text not null,
  category text not null,
  allowed_verticals text[] not null default '{}'::text[],
  restricted_verticals text[] not null default '{}'::text[],
  legal_status text not null default 'legal_review_required',
  privacy_status text not null default 'needs_review',
  risk_classification text not null default 'medium',
  reviewer_approval_status text not null default 'pending',
  human_review_required boolean not null default true,
  parent_visible_allowed boolean not null default false,
  automatic_action_allowed boolean not null default false,
  explanation_required boolean not null default true,
  dpia_required boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_capabilities_category_check check (category in ('vision','audio','biometric','motion','risk','recommendation','assistant','compliance','inspection','governance')),
  constraint ai_capabilities_legal_status_check check (legal_status in ('allowed','disabled','restricted','legal_review_required')),
  constraint ai_capabilities_privacy_status_check check (privacy_status in ('approved','restricted','blocked','needs_review')),
  constraint ai_capabilities_risk_check check (risk_classification in ('low','medium','high','restricted','legal_review_required')),
  constraint ai_capabilities_review_status_check check (reviewer_approval_status in ('pending','approved','approved_with_restrictions','rejected','needs_changes'))
);

create table if not exists public.ai_explainability_records (
  id uuid primary key default gen_random_uuid(),
  explanation_key text not null unique,
  source_type text not null,
  source_id uuid,
  capability_key text,
  model_key text,
  output_summary text not null,
  confidence numeric(5,2),
  contributing_factors jsonb not null default '[]'::jsonb,
  supporting_signals jsonb not null default '[]'::jsonb,
  limitations text,
  human_readable_explanation text,
  parent_visible boolean not null default false,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  review_status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  constraint ai_explainability_source_check check (source_type in ('ai_camera_event','observer_signal','risk_prediction','recommendation','assistant_response','compliance_alert','inspection_insight')),
  constraint ai_explainability_review_status_check check (review_status in ('pending_review','approved','approved_parent_summary','rejected','needs_changes')),
  constraint ai_explainability_confidence_check check (confidence is null or confidence between 0 and 100)
);

create table if not exists public.ai_decision_audit_trail (
  id uuid primary key default gen_random_uuid(),
  audit_key text not null unique,
  ai_output_type text not null,
  ai_output_id uuid,
  capability_key text,
  model_key text,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewer_role text,
  review_decision text not null,
  final_action text,
  action_owner_profile_id uuid references public.profiles(id) on delete set null,
  human_review_required boolean not null default true,
  automatic_action_taken boolean not null default false,
  parent_visible boolean not null default false,
  decision_summary text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint ai_decision_output_type_check check (ai_output_type in ('observer_event','observer_signal','risk_signal','recommendation','assistant_summary','compliance_insight','inspection_insight')),
  constraint ai_decision_review_decision_check check (review_decision in ('pending','confirmed','dismissed','needs_followup','escalated','approved_summary','rejected')),
  constraint ai_decision_no_automatic_action check (automatic_action_taken = false)
);

create table if not exists public.ai_privacy_impact_registry (
  id uuid primary key default gen_random_uuid(),
  impact_key text not null unique,
  capability_key text,
  ai_system_key text,
  privacy_risk text not null,
  affected_users text[] not null default '{}'::text[],
  data_categories text[] not null default '{}'::text[],
  risk_level text not null default 'medium',
  mitigation_measures jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending',
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  next_review_due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_privacy_impact_risk_check check (risk_level in ('low','medium','high','restricted','legal_review_required')),
  constraint ai_privacy_impact_status_check check (review_status in ('pending','in_review','mitigated','accepted_with_restrictions','rejected','needs_update'))
);

create table if not exists public.ai_ethics_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  subject_type text not null,
  subject_key text not null,
  review_area text not null,
  status text not null default 'pending',
  score integer not null default 0,
  findings text,
  mitigation_required boolean not null default true,
  reviewer_profile_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_ethics_subject_type_check check (subject_type in ('model','capability','dataset','assistant','observer_pipeline','risk_engine')),
  constraint ai_ethics_review_area_check check (review_area in ('fairness','bias','explainability','privacy','human_oversight','safety')),
  constraint ai_ethics_status_check check (status in ('pending','passed','passed_with_restrictions','failed','needs_changes')),
  constraint ai_ethics_score_check check (score between 0 and 100)
);

create table if not exists public.responsible_ai_scores (
  id uuid primary key default gen_random_uuid(),
  score_date date not null default current_date,
  vertical_key text not null default 'gan_batuach',
  responsible_ai_score integer not null default 0,
  review_coverage_score integer not null default 0,
  explainability_score integer not null default 0,
  dpia_completion_score integer not null default 0,
  audit_coverage_score integer not null default 0,
  governance_readiness_score integer not null default 0,
  readiness_status text not null default 'partial',
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(score_date, vertical_key),
  constraint responsible_ai_vertical_check check (vertical_key in ('digital_observer_core','gan_batuach','school_safe','business_observer','home_observer','municipality_observer')),
  constraint responsible_ai_score_check check (
    responsible_ai_score between 0 and 100
    and review_coverage_score between 0 and 100
    and explainability_score between 0 and 100
    and dpia_completion_score between 0 and 100
    and audit_coverage_score between 0 and 100
    and governance_readiness_score between 0 and 100
  ),
  constraint responsible_ai_status_check check (readiness_status in ('ready','partial','blocked','needs_review'))
);

create index if not exists ai_dpia_vertical_idx on public.ai_dpia_assessments(vertical_key, approval_status, risk_level);
create index if not exists ai_capabilities_status_idx on public.ai_capabilities(legal_status, privacy_status, risk_classification);
create index if not exists ai_explainability_source_idx on public.ai_explainability_records(source_type, source_id, review_status);
create index if not exists ai_decision_audit_created_idx on public.ai_decision_audit_trail(created_at desc, review_decision);
create index if not exists ai_privacy_impact_status_idx on public.ai_privacy_impact_registry(review_status, risk_level);
create index if not exists ai_ethics_reviews_subject_idx on public.ai_ethics_reviews(subject_type, subject_key, review_area);
create index if not exists responsible_ai_scores_vertical_idx on public.responsible_ai_scores(vertical_key, score_date desc);

alter table public.ai_dpia_assessments enable row level security;
alter table public.ai_capabilities enable row level security;
alter table public.ai_explainability_records enable row level security;
alter table public.ai_decision_audit_trail enable row level security;
alter table public.ai_privacy_impact_registry enable row level security;
alter table public.ai_ethics_reviews enable row level security;
alter table public.responsible_ai_scores enable row level security;

drop policy if exists "ai dpia admin only" on public.ai_dpia_assessments;
create policy "ai dpia admin only" on public.ai_dpia_assessments for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai capabilities admin only" on public.ai_capabilities;
create policy "ai capabilities admin only" on public.ai_capabilities for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai explainability admin only" on public.ai_explainability_records;
create policy "ai explainability admin only" on public.ai_explainability_records for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai decision audit admin read" on public.ai_decision_audit_trail;
create policy "ai decision audit admin read" on public.ai_decision_audit_trail for select using (public.is_admin());

drop policy if exists "ai decision audit admin insert" on public.ai_decision_audit_trail;
create policy "ai decision audit admin insert" on public.ai_decision_audit_trail for insert with check (public.is_admin());

drop policy if exists "ai privacy impact admin only" on public.ai_privacy_impact_registry;
create policy "ai privacy impact admin only" on public.ai_privacy_impact_registry for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ai ethics reviews admin only" on public.ai_ethics_reviews;
create policy "ai ethics reviews admin only" on public.ai_ethics_reviews for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "responsible ai scores admin only" on public.responsible_ai_scores;
create policy "responsible ai scores admin only" on public.responsible_ai_scores for select using (public.is_admin());

insert into public.ai_capabilities (
  capability_key, capability_name, category, allowed_verticals, restricted_verticals,
  legal_status, privacy_status, risk_classification, reviewer_approval_status,
  human_review_required, parent_visible_allowed, automatic_action_allowed, explanation_required, dpia_required, notes, metadata
)
values
  ('pose_estimation', 'Pose estimation', 'motion', array['gan_batuach','digital_observer_core'], '{}'::text[], 'allowed', 'approved', 'medium', 'approved_with_restrictions', true, false, false, true, true, 'Non-identifying pose signal; no persistent identity.', '{"non_identifying":true}'::jsonb),
  ('fall_detection', 'Fall detection', 'motion', array['gan_batuach','digital_observer_core'], '{}'::text[], 'allowed', 'approved', 'medium', 'approved_with_restrictions', true, false, false, true, true, 'Safety signal only; human review required before action.', '{"automatic_parent_alert":false}'::jsonb),
  ('risk_recommendations', 'Risk recommendations', 'risk', array['gan_batuach'], '{}'::text[], 'restricted', 'restricted', 'high', 'approved_with_restrictions', true, false, false, true, true, 'Advisory prioritization only; no legal or disciplinary decision.', '{"recommendations_only":true}'::jsonb),
  ('ai_assistant_summaries', 'AI assistant summaries', 'assistant', array['gan_batuach'], '{}'::text[], 'restricted', 'restricted', 'medium', 'approved_with_restrictions', true, false, false, true, true, 'Assistant must use source-backed role-scoped data only.', '{"no_hallucinated_data":true}'::jsonb),
  ('face_recognition', 'Face recognition', 'biometric', '{}'::text[], array['gan_batuach'], 'disabled', 'blocked', 'restricted', 'rejected', true, false, false, true, true, 'Disabled for Gan Batuach Israel mode.', '{"disabled_by":"GAN_BATUACH_ISRAEL_MODE"}'::jsonb),
  ('audio_analytics', 'Audio analytics', 'audio', '{}'::text[], array['gan_batuach'], 'disabled', 'blocked', 'restricted', 'rejected', true, false, false, true, true, 'Audio recording, speech and sound analysis are disabled for Gan Batuach.', '{"disabled_by":"GAN_BATUACH_ISRAEL_MODE"}'::jsonb),
  ('gait_recognition', 'Gait recognition', 'biometric', '{}'::text[], array['gan_batuach'], 'legal_review_required', 'needs_review', 'legal_review_required', 'pending', true, false, false, true, true, 'Potential biometric identification risk; not enabled.', '{"future_review_only":true}'::jsonb),
  ('soft_biometric_matching', 'Soft biometric matching', 'biometric', '{}'::text[], array['gan_batuach'], 'legal_review_required', 'needs_review', 'legal_review_required', 'pending', true, false, false, true, true, 'Potential indirect identity risk; not enabled.', '{"future_review_only":true}'::jsonb)
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

insert into public.ai_dpia_assessments (
  dpia_key, ai_system_key, ai_system_name, vertical_key, purpose, data_categories, affected_users,
  risk_level, mitigation_controls, residual_risk_level, approval_status, next_review_due_at, notes, metadata
)
values
  ('dpia-gan-observer-motion', 'gan-observer-motion-safety', 'Gan Batuach Motion Safety Observer', 'gan_batuach', 'Detect non-identifying safety signals for human review.', array['camera_metadata','motion_signals','review_notes'], array['children','staff','managers','inspectors'], 'high', '[{"control":"human_review_required"},{"control":"no_face_recognition"},{"control":"no_audio"},{"control":"parent_raw_visibility_blocked"}]'::jsonb, 'medium', 'in_review', now() + interval '180 days', 'DPIA required before production observer activation.', '{"automatic_decisions":false}'::jsonb),
  ('dpia-gan-ai-assistant', 'gan-ai-assistant', 'Gan Batuach Role-Scoped AI Assistant', 'gan_batuach', 'Provide role-scoped summaries and suggested actions from existing data.', array['messages','tasks','timeline','documents','inspection_summaries'], array['parents','staff','managers','inspectors','admins'], 'medium', '[{"control":"role_permissions"},{"control":"source_backed_answers"},{"control":"audit_history"}]'::jsonb, 'low', 'in_review', now() + interval '180 days', 'Assistant cannot make decisions or bypass permissions.', '{"no_hallucinated_data":true}'::jsonb),
  ('dpia-gan-risk-engine', 'gan-risk-recommendation-engine', 'Gan Batuach Risk Recommendation Engine', 'gan_batuach', 'Prioritize risks and recommend prevention actions for human review.', array['incidents','complaints','inspections','compliance','observer_signals'], array['children','staff','parents','kindergartens'], 'high', '[{"control":"recommendations_only"},{"control":"no_child_labels"},{"control":"human_approval_required"}]'::jsonb, 'medium', 'in_review', now() + interval '180 days', 'Risk indicators are advisory only and not disciplinary.', '{"recommendations_only":true}'::jsonb)
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

insert into public.ai_privacy_impact_registry (
  impact_key, capability_key, ai_system_key, privacy_risk, affected_users, data_categories,
  risk_level, mitigation_measures, review_status, next_review_due_at, metadata
)
values
  ('privacy-risk-raw-ai-parent-visibility', 'ai_assistant_summaries', 'gan-ai-assistant', 'Parents could see raw or unreviewed AI content.', array['parents','children'], array['ai_outputs','observer_signals'], 'high', '[{"measure":"parent_visibility_policy"},{"measure":"approved_summary_only"}]'::jsonb, 'mitigated', now() + interval '180 days', '{"raw_ai_parent_visible":false}'::jsonb),
  ('privacy-risk-biometric-identification', 'face_recognition', 'gan-observer-motion-safety', 'Biometric identification of children is not permitted for Gan Batuach.', array['children'], array['biometric_data'], 'restricted', '[{"measure":"capability_disabled"},{"measure":"regulatory_mode_enforced"}]'::jsonb, 'mitigated', now() + interval '180 days', '{"disabled":true}'::jsonb),
  ('privacy-risk-automated-decision', 'risk_recommendations', 'gan-risk-recommendation-engine', 'AI recommendation could be mistaken for a decision.', array['children','staff','managers'], array['risk_indicators','recommendations'], 'high', '[{"measure":"human_review_required"},{"measure":"automatic_action_false"},{"measure":"decision_audit"}]'::jsonb, 'mitigated', now() + interval '180 days', '{"automatic_decisions":false}'::jsonb)
on conflict (impact_key) do update set
  privacy_risk = excluded.privacy_risk,
  affected_users = excluded.affected_users,
  data_categories = excluded.data_categories,
  risk_level = excluded.risk_level,
  mitigation_measures = excluded.mitigation_measures,
  review_status = excluded.review_status,
  next_review_due_at = excluded.next_review_due_at,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.ai_ethics_reviews (review_key, subject_type, subject_key, review_area, status, score, findings, mitigation_required, metadata)
values
  ('ethics-motion-privacy', 'observer_pipeline', 'gan-observer-motion-safety', 'privacy', 'passed_with_restrictions', 78, 'Allowed only as non-identifying motion signal with no audio and no face recognition.', true, '{"human_review_required":true}'::jsonb),
  ('ethics-risk-human-oversight', 'risk_engine', 'gan-risk-recommendation-engine', 'human_oversight', 'passed_with_restrictions', 74, 'Risk outputs must remain advisory and require human review.', true, '{"automatic_action":false}'::jsonb),
  ('ethics-assistant-explainability', 'assistant', 'gan-ai-assistant', 'explainability', 'needs_changes', 62, 'Assistant answers need source references and unresolved-request handling.', true, '{"source_backed_required":true}'::jsonb),
  ('ethics-biometric-restriction', 'capability', 'face_recognition', 'privacy', 'passed', 95, 'Face recognition disabled for Gan Batuach.', false, '{"disabled":true}'::jsonb)
on conflict (review_key) do update set
  subject_type = excluded.subject_type,
  subject_key = excluded.subject_key,
  review_area = excluded.review_area,
  status = excluded.status,
  score = excluded.score,
  findings = excluded.findings,
  mitigation_required = excluded.mitigation_required,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.ai_explainability_records (
  explanation_key, source_type, capability_key, model_key, output_summary, confidence,
  contributing_factors, supporting_signals, limitations, human_readable_explanation, parent_visible, review_status
)
values
  ('explainability-risk-recommendation-template', 'risk_prediction', 'risk_recommendations', 'risk-recommendation-engine', 'Risk recommendation template', 0, '["complaints","incidents","open_findings","compliance_alerts"]'::jsonb, '["existing platform records only"]'::jsonb, 'Template only; not a real prediction.', 'Risk recommendations must explain which source categories contributed and what action is suggested for human review.', false, 'pending_review'),
  ('explainability-parent-summary-template', 'assistant_response', 'ai_assistant_summaries', 'gan-ai-assistant', 'Parent-safe summary template', 0, '["approved_timeline_events","approved_messages","approved_documents"]'::jsonb, '["parent-visible data only"]'::jsonb, 'Template only; no raw AI events.', 'Parent summaries may use only approved parent-visible information and must avoid panic language.', false, 'pending_review')
on conflict (explanation_key) do update set
  output_summary = excluded.output_summary,
  contributing_factors = excluded.contributing_factors,
  supporting_signals = excluded.supporting_signals,
  limitations = excluded.limitations,
  human_readable_explanation = excluded.human_readable_explanation,
  parent_visible = excluded.parent_visible,
  review_status = excluded.review_status;

insert into public.ai_decision_audit_trail (
  audit_key, ai_output_type, capability_key, model_key, review_decision, final_action,
  human_review_required, automatic_action_taken, parent_visible, decision_summary, metadata
)
values
  ('decision-audit-policy-no-auto-action', 'recommendation', 'risk_recommendations', 'risk-recommendation-engine', 'pending', 'human_review_required', true, false, false, 'Policy baseline: AI recommendations never execute automatically.', '{"phase":149}'::jsonb),
  ('decision-audit-policy-parent-boundary', 'assistant_summary', 'ai_assistant_summaries', 'gan-ai-assistant', 'pending', 'approved_summary_required', true, false, false, 'Policy baseline: parent-visible AI content requires approval and scope validation.', '{"phase":149}'::jsonb)
on conflict (audit_key) do update set
  review_decision = excluded.review_decision,
  final_action = excluded.final_action,
  human_review_required = excluded.human_review_required,
  automatic_action_taken = false,
  parent_visible = excluded.parent_visible,
  decision_summary = excluded.decision_summary,
  metadata = excluded.metadata;

insert into public.ai_governance_reviews (review_key, review_subject_type, review_type, status, decision_summary, restrictions, metadata)
values
  ('phase-149-observer-dpia-review', 'capability', 'dpia', 'pending', 'DPIA review required before production use of observer motion safety.', '{"production_blocked_until_dpia":true}'::jsonb, '{"phase":149,"subject_key":"gan-observer-motion-safety"}'::jsonb),
  ('phase-149-assistant-only-ethics', 'capability', 'ethics', 'approved_with_restrictions', 'AI is assistant-only: recommendations, prioritization and summaries require human review.', '{"automatic_action":false,"discipline":false,"legal_decision":false}'::jsonb, '{"phase":149}'::jsonb),
  ('phase-149-assistant-explainability', 'assistant', 'explainability', 'needs_changes', 'AI assistant must expose source-backed explanations and unresolved request handling.', '{"source_backed_required":true}'::jsonb, '{"phase":149}'::jsonb)
on conflict (review_key) do update set
  review_subject_type = excluded.review_subject_type,
  review_type = excluded.review_type,
  status = excluded.status,
  decision_summary = excluded.decision_summary,
  restrictions = excluded.restrictions,
  metadata = excluded.metadata;

insert into public.responsible_ai_scores (
  score_date, vertical_key, responsible_ai_score, review_coverage_score, explainability_score,
  dpia_completion_score, audit_coverage_score, governance_readiness_score, readiness_status, findings, recommendations
)
select
  current_date,
  'gan_batuach',
  round((review_coverage + explainability + dpia_completion + audit_coverage + governance_readiness) / 5.0)::int,
  review_coverage,
  explainability,
  dpia_completion,
  audit_coverage,
  governance_readiness,
  case when round((review_coverage + explainability + dpia_completion + audit_coverage + governance_readiness) / 5.0) >= 80 then 'ready' else 'partial' end,
  jsonb_build_array('Responsible AI score generated from DPIA, capabilities, explainability, audit and governance reviews.'),
  jsonb_build_array('Complete DPIA approvals and source-backed assistant explanations before production.')
from (
  select
    least(100, (select count(*) from public.ai_governance_reviews where status in ('approved','approved_with_restrictions')) * 20)::int as review_coverage,
    least(100, (select count(*) from public.ai_explainability_records) * 35)::int as explainability,
    case
      when (select count(*) from public.ai_dpia_assessments) = 0 then 0
      else round(((select count(*) from public.ai_dpia_assessments where approval_status in ('approved','approved_with_restrictions','in_review'))::numeric / greatest((select count(*) from public.ai_dpia_assessments), 1)) * 100)::int
    end as dpia_completion,
    least(100, (select count(*) from public.ai_decision_audit_trail) * 35)::int as audit_coverage,
    least(100, (select count(*) from public.ai_capabilities where automatic_action_allowed = false and human_review_required = true) * 12)::int as governance_readiness
) s
on conflict (score_date, vertical_key) do update set
  responsible_ai_score = excluded.responsible_ai_score,
  review_coverage_score = excluded.review_coverage_score,
  explainability_score = excluded.explainability_score,
  dpia_completion_score = excluded.dpia_completion_score,
  audit_coverage_score = excluded.audit_coverage_score,
  governance_readiness_score = excluded.governance_readiness_score,
  readiness_status = excluded.readiness_status,
  findings = excluded.findings,
  recommendations = excluded.recommendations,
  updated_at = now();

insert into public.regulatory_policy_audit_events (event_key, event_type, vertical_key, capability_key, feature_key, before_data, after_data, reason, metadata)
values
  ('phase-149-responsible-ai-governance', 'policy_changed', 'gan_batuach', 'risk_recommendations', null, '{}'::jsonb, '{"ai_role":"assistant_only","automatic_action":false,"human_review_required":true}'::jsonb, 'Phase 149 established responsible AI governance and DPIA controls.', '{"phase":149}'::jsonb)
on conflict (event_key) do update set
  event_type = excluded.event_type,
  after_data = excluded.after_data,
  reason = excluded.reason,
  metadata = excluded.metadata;

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('privacy', 'responsible-ai-dpia-governance', 'Responsible AI DPIA governance', 'partial', 'critical', 'DPIA, capability registry, explainability records, decision audit and responsible AI score exist.', 'Complete DPIA approval and legal review before enabling production AI decisions.', '{"phase":149,"automatic_decisions":false}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.ai_dpia_assessments is 'Data Protection Impact Assessment registry for AI systems, risks, mitigations and approval status.';
comment on table public.ai_capabilities is 'Responsible AI capability registry with legal, privacy, risk and human review controls.';
comment on table public.ai_explainability_records is 'Explainability records for AI outputs: confidence, factors, supporting signals and limitations.';
comment on table public.ai_decision_audit_trail is 'Human decision audit trail for AI outputs. Automatic action is forbidden by check constraint.';
comment on table public.ai_privacy_impact_registry is 'Privacy risks, affected users, mitigation measures and review status for AI capabilities.';
comment on table public.ai_ethics_reviews is 'Fairness, bias, explainability, privacy, human oversight and safety review records.';
comment on table public.responsible_ai_scores is '0-100 responsible AI score based on reviews, explainability, DPIA, audit and governance readiness.';
