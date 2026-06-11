create table if not exists public.early_warning_signals (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  source_signal_id uuid references public.predictive_risk_signals(id) on delete set null,
  warning_key text not null,
  warning_type text not null,
  severity text not null default 'medium',
  confidence_score integer not null default 60,
  supporting_signals jsonb not null default '[]'::jsonb,
  recommended_action text not null,
  review_status text not null default 'needs_review',
  parent_visible boolean not null default false,
  human_review_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, warning_key)
);

create table if not exists public.prevention_recommendation_actions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  warning_id uuid references public.early_warning_signals(id) on delete cascade,
  recommendation_type text not null,
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'open',
  requires_human_approval boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prediction_accuracy_reviews (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  warning_id uuid references public.early_warning_signals(id) on delete set null,
  prediction_made_at timestamptz not null default now(),
  outcome_observed_at timestamptz,
  validation_outcome text not null default 'pending',
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_note text,
  confidence_at_prediction integer not null default 60,
  supporting_signal_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prevention_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  snapshot_date date not null default current_date,
  prevention_readiness_score integer not null default 0,
  compliance_component integer not null default 0,
  inspections_component integer not null default 0,
  incident_history_component integer not null default 0,
  observer_readiness_component integer not null default 0,
  corrective_action_component integer not null default 0,
  human_review_required boolean not null default true,
  parent_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(garden_id, snapshot_date)
);

alter table public.early_warning_signals drop constraint if exists early_warning_type_check;
alter table public.early_warning_signals add constraint early_warning_type_check check (warning_type in (
  'rising_complaint_trend',
  'repeated_safety_events',
  'repeated_staffing_issues',
  'declining_compliance',
  'increasing_observer_alerts',
  'camera_outage_pattern',
  'attendance_anomaly_pattern',
  'unresolved_findings_pattern'
));

alter table public.early_warning_signals drop constraint if exists early_warning_severity_check;
alter table public.early_warning_signals add constraint early_warning_severity_check check (severity in ('low','medium','high','critical'));

alter table public.early_warning_signals drop constraint if exists early_warning_review_status_check;
alter table public.early_warning_signals add constraint early_warning_review_status_check check (review_status in ('needs_review','reviewing','confirmed','dismissed','escalated','resolved'));

alter table public.early_warning_signals drop constraint if exists early_warning_confidence_check;
alter table public.early_warning_signals add constraint early_warning_confidence_check check (confidence_score between 0 and 100);

alter table public.prevention_recommendation_actions drop constraint if exists prevention_action_type_check;
alter table public.prevention_recommendation_actions add constraint prevention_action_type_check check (recommendation_type in (
  'schedule_inspection',
  'increase_supervision',
  'review_staffing',
  'complete_compliance_actions',
  'review_safety_procedures',
  'follow_up_inspection',
  'urgent_review',
  'compliance_review',
  'management_action'
));

alter table public.prevention_recommendation_actions drop constraint if exists prevention_action_priority_check;
alter table public.prevention_recommendation_actions add constraint prevention_action_priority_check check (priority in ('low','medium','high','critical'));

alter table public.prevention_recommendation_actions drop constraint if exists prevention_action_status_check;
alter table public.prevention_recommendation_actions add constraint prevention_action_status_check check (status in ('open','in_progress','approved','completed','dismissed'));

alter table public.prediction_accuracy_reviews drop constraint if exists prediction_accuracy_outcome_check;
alter table public.prediction_accuracy_reviews add constraint prediction_accuracy_outcome_check check (validation_outcome in ('pending','accurate','inaccurate','inconclusive'));

alter table public.prevention_readiness_scores drop constraint if exists prevention_readiness_score_check;
alter table public.prevention_readiness_scores add constraint prevention_readiness_score_check check (
  prevention_readiness_score between 0 and 100
  and compliance_component between 0 and 100
  and inspections_component between 0 and 100
  and incident_history_component between 0 and 100
  and observer_readiness_component between 0 and 100
  and corrective_action_component between 0 and 100
);

create index if not exists early_warning_scope_idx on public.early_warning_signals(garden_id, review_status, severity, created_at desc);
create index if not exists prevention_actions_scope_idx on public.prevention_recommendation_actions(garden_id, status, priority);
create unique index if not exists prevention_actions_warning_type_key on public.prevention_recommendation_actions(warning_id, recommendation_type) where warning_id is not null;
create index if not exists prediction_accuracy_scope_idx on public.prediction_accuracy_reviews(garden_id, validation_outcome, prediction_made_at desc);
create unique index if not exists prediction_accuracy_warning_key on public.prediction_accuracy_reviews(warning_id) where warning_id is not null;
create index if not exists prevention_readiness_scope_idx on public.prevention_readiness_scores(garden_id, snapshot_date desc);

alter table public.early_warning_signals enable row level security;
alter table public.prevention_recommendation_actions enable row level security;
alter table public.prediction_accuracy_reviews enable row level security;
alter table public.prevention_readiness_scores enable row level security;

drop policy if exists "early warning signals scoped read" on public.early_warning_signals;
create policy "early warning signals scoped read" on public.early_warning_signals
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "early warning signals scoped write" on public.early_warning_signals;
create policy "early warning signals scoped write" on public.early_warning_signals
for all using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "prevention actions scoped read" on public.prevention_recommendation_actions;
create policy "prevention actions scoped read" on public.prevention_recommendation_actions
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "prevention actions scoped write" on public.prevention_recommendation_actions;
create policy "prevention actions scoped write" on public.prevention_recommendation_actions
for all using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "prediction accuracy admin read" on public.prediction_accuracy_reviews;
create policy "prediction accuracy admin read" on public.prediction_accuracy_reviews
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "prediction accuracy scoped write" on public.prediction_accuracy_reviews;
create policy "prediction accuracy scoped write" on public.prediction_accuracy_reviews
for all using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "prevention readiness scoped read" on public.prevention_readiness_scores;
create policy "prevention readiness scoped read" on public.prevention_readiness_scores
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "prevention readiness scoped write" on public.prevention_readiness_scores;
create policy "prevention readiness scoped write" on public.prevention_readiness_scores
for all using (public.is_admin()) with check (public.is_admin());

insert into public.early_warning_signals (
  garden_id, source_signal_id, warning_key, warning_type, severity, confidence_score, supporting_signals, recommended_action, review_status
)
select
  s.garden_id,
  s.id,
  concat('risk-signal-', s.id),
  case
    when s.signal_type = 'repeated_complaints' then 'rising_complaint_trend'
    when s.signal_type = 'repeated_incidents' then 'repeated_safety_events'
    when s.signal_type = 'repeated_staffing_issues' then 'repeated_staffing_issues'
    when s.signal_type = 'repeated_compliance_failures' then 'declining_compliance'
    when s.signal_type = 'repeated_observer_alerts' then 'increasing_observer_alerts'
    when s.signal_type = 'camera_outage_pattern' then 'camera_outage_pattern'
    when s.signal_type = 'attendance_anomaly_pattern' then 'attendance_anomaly_pattern'
    else 'unresolved_findings_pattern'
  end,
  s.severity,
  least(100, greatest(0, round(coalesce(s.confidence, 0.6) * 100)))::int,
  jsonb_build_array(jsonb_build_object('source', 'predictive_risk_signals', 'id', s.id, 'pattern_count', s.pattern_count)),
  coalesce(s.recommended_action, 'בדיקה אנושית של הדפוס לפני פעולה.'),
  case when s.review_status = 'acknowledged' then 'confirmed' when s.review_status = 'needs_review' then 'needs_review' else s.review_status end
from public.predictive_risk_signals s
where s.parent_visible is false
on conflict (garden_id, warning_key) do update set
  source_signal_id = excluded.source_signal_id,
  warning_type = excluded.warning_type,
  severity = excluded.severity,
  confidence_score = excluded.confidence_score,
  supporting_signals = excluded.supporting_signals,
  recommended_action = excluded.recommended_action,
  review_status = excluded.review_status,
  updated_at = now();

insert into public.prevention_recommendation_actions (
  garden_id, warning_id, recommendation_type, title, description, priority, status
)
select
  w.garden_id,
  w.id,
  case
    when w.warning_type in ('rising_complaint_trend','repeated_safety_events','unresolved_findings_pattern') then 'schedule_inspection'
    when w.warning_type = 'repeated_staffing_issues' then 'review_staffing'
    when w.warning_type = 'declining_compliance' then 'complete_compliance_actions'
    when w.warning_type in ('increasing_observer_alerts','camera_outage_pattern') then 'increase_supervision'
    else 'review_safety_procedures'
  end,
  case
    when w.warning_type in ('rising_complaint_trend','repeated_safety_events','unresolved_findings_pattern') then 'לתאם בדיקה מונעת'
    when w.warning_type = 'repeated_staffing_issues' then 'לבדוק שיבוץ ונוכחות צוות'
    when w.warning_type = 'declining_compliance' then 'להשלים פעולות ציות'
    when w.warning_type in ('increasing_observer_alerts','camera_outage_pattern') then 'להגביר השגחה ולבדוק מצלמות'
    else 'לעבור על נהלי בטיחות'
  end,
  w.recommended_action,
  w.severity,
  'open'
from public.early_warning_signals w
on conflict do nothing;

insert into public.prediction_accuracy_reviews (
  garden_id, warning_id, confidence_at_prediction, supporting_signal_count
)
select
  w.garden_id,
  w.id,
  w.confidence_score,
  jsonb_array_length(w.supporting_signals)
from public.early_warning_signals w
on conflict do nothing;

insert into public.prevention_readiness_scores (
  garden_id,
  snapshot_date,
  prevention_readiness_score,
  compliance_component,
  inspections_component,
  incident_history_component,
  observer_readiness_component,
  corrective_action_component,
  metadata
)
select
  r.garden_id,
  current_date,
  least(100, greatest(0, round(
    (100 - coalesce(r.compliance_risk, 0)) * 0.24 +
    (100 - coalesce(r.safety_risk, 0)) * 0.22 +
    (100 - coalesce(r.operational_risk, 0)) * 0.20 +
    (100 - coalesce(r.observer_risk, 0)) * 0.18 +
    (case when r.risk_trend = 'declining' then 88 when r.risk_trend = 'rising' then 48 else 72 end) * 0.16
  )))::int,
  least(100, greatest(0, 100 - coalesce(r.compliance_risk, 0)))::int,
  least(100, greatest(0, 100 - coalesce(r.safety_risk, 0)))::int,
  least(100, greatest(0, 100 - coalesce(r.operational_risk, 0)))::int,
  least(100, greatest(0, 100 - coalesce(r.observer_risk, 0)))::int,
  (case when r.risk_trend = 'declining' then 88 when r.risk_trend = 'rising' then 48 else 72 end)::int,
  jsonb_build_object('source', 'kindergarten_risk_profiles', 'risk_level', r.risk_level, 'risk_trend', r.risk_trend)
from public.kindergarten_risk_profiles r
where r.parent_visible is false
on conflict (garden_id, snapshot_date) do update set
  prevention_readiness_score = excluded.prevention_readiness_score,
  compliance_component = excluded.compliance_component,
  inspections_component = excluded.inspections_component,
  incident_history_component = excluded.incident_history_component,
  observer_readiness_component = excluded.observer_readiness_component,
  corrective_action_component = excluded.corrective_action_component,
  metadata = excluded.metadata;

comment on table public.early_warning_signals is 'Early warning signals for prevention. Internal only, human review required, not parent visible.';
comment on table public.prevention_recommendation_actions is 'Recommended preventive actions. No automatic execution or enforcement.';
comment on table public.prediction_accuracy_reviews is 'Prediction validation tracking: accurate, inaccurate or inconclusive after human review.';
comment on table public.prevention_readiness_scores is '0-100 advisory readiness score for prevention, not public and not parent visible.';
