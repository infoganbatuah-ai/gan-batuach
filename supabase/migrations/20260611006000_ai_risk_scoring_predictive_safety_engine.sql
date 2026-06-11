-- PHASE 112: AI Risk Scoring & Predictive Safety Engine
-- Advisory risk detection only. No automatic accusations, no disciplinary decisions, no parent panic notifications.

create table if not exists public.kindergarten_risk_profiles (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  overall_risk_score integer not null default 0,
  safety_risk integer not null default 0,
  compliance_risk integer not null default 0,
  operational_risk integer not null default 0,
  staffing_risk integer not null default 0,
  observer_risk integer not null default 0,
  risk_trend text not null default 'stable',
  risk_level text not null default 'low',
  predicted_risk_level text not null default 'low',
  prediction_summary text,
  explanation jsonb not null default '{}'::jsonb,
  top_contributors jsonb not null default '[]'::jsonb,
  advisory_only boolean not null default true,
  human_review_required boolean not null default true,
  parent_visible boolean not null default false,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id),
  constraint kindergarten_risk_scores_check check (
    overall_risk_score between 0 and 100 and safety_risk between 0 and 100 and compliance_risk between 0 and 100
    and operational_risk between 0 and 100 and staffing_risk between 0 and 100 and observer_risk between 0 and 100
  ),
  constraint kindergarten_risk_trend_check check (risk_trend in ('rising','stable','declining','new')),
  constraint kindergarten_risk_level_check check (risk_level in ('low','medium','high','critical')),
  constraint kindergarten_predicted_risk_level_check check (predicted_risk_level in ('low','medium','high','critical'))
);

create table if not exists public.kindergarten_risk_history (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  snapshot_date date not null default current_date,
  snapshot_period text not null default 'daily',
  overall_risk_score integer not null default 0,
  safety_risk integer not null default 0,
  compliance_risk integer not null default 0,
  operational_risk integer not null default 0,
  staffing_risk integer not null default 0,
  observer_risk integer not null default 0,
  risk_level text not null default 'low',
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(garden_id, snapshot_date, snapshot_period),
  constraint kindergarten_risk_history_period_check check (snapshot_period in ('daily','weekly','monthly')),
  constraint kindergarten_risk_history_level_check check (risk_level in ('low','medium','high','critical'))
);

create table if not exists public.predictive_risk_signals (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  signal_key text not null,
  signal_type text not null,
  severity text not null default 'medium',
  confidence numeric(5,4),
  pattern_count integer not null default 0,
  lookback_days integer not null default 30,
  title text not null,
  explanation text,
  recommended_action text,
  review_status text not null default 'needs_review',
  parent_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, signal_key),
  constraint predictive_risk_signal_type_check check (signal_type in (
    'repeated_incidents',
    'repeated_complaints',
    'repeated_compliance_failures',
    'repeated_staffing_issues',
    'repeated_observer_alerts',
    'camera_outage_pattern',
    'attendance_anomaly_pattern',
    'pickup_anomaly_pattern',
    'child_safety_indicator',
    'staff_operational_indicator'
  )),
  constraint predictive_risk_signal_severity_check check (severity in ('low','medium','high','critical')),
  constraint predictive_risk_signal_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint predictive_risk_review_status_check check (review_status in ('needs_review','reviewing','acknowledged','dismissed','resolved','escalated'))
);

create table if not exists public.risk_prevention_recommendations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  signal_id uuid references public.predictive_risk_signals(id) on delete cascade,
  recommendation_key text not null,
  category text not null,
  title text not null,
  explanation text,
  priority text not null default 'medium',
  status text not null default 'open',
  requires_human_approval boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, recommendation_key),
  constraint risk_prevention_category_check check (category in ('supervision','compliance','inspection','staffing','camera_coverage','observer_review')),
  constraint risk_prevention_priority_check check (priority in ('low','medium','high','critical')),
  constraint risk_prevention_status_check check (status in ('open','in_progress','approved','completed','dismissed'))
);

-- Self-heal legacy risk profile schemas. The learning foundation migration created
-- kindergarten_risk_profiles with kindergarten_id/overall_score, so CREATE TABLE IF NOT EXISTS
-- does not add the PHASE 112 risk columns on existing databases.
alter table public.kindergarten_risk_profiles add column if not exists id uuid default gen_random_uuid();
alter table public.kindergarten_risk_profiles add column if not exists garden_id uuid references public.gardens(id) on delete cascade;
alter table public.kindergarten_risk_profiles add column if not exists kindergarten_id uuid references public.gardens(id) on delete cascade;
alter table public.kindergarten_risk_profiles add column if not exists attendance_score integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists pickup_score integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists safety_score integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists supervision_score integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists camera_coverage_score integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists overall_score integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists risk_status text not null default 'baseline_ready';
alter table public.kindergarten_risk_profiles add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.kindergarten_risk_profiles add column if not exists overall_risk_score integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists safety_risk integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists compliance_risk integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists operational_risk integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists staffing_risk integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists observer_risk integer not null default 0;
alter table public.kindergarten_risk_profiles add column if not exists risk_trend text not null default 'stable';
alter table public.kindergarten_risk_profiles add column if not exists risk_level text not null default 'low';
alter table public.kindergarten_risk_profiles add column if not exists predicted_risk_level text not null default 'low';
alter table public.kindergarten_risk_profiles add column if not exists prediction_summary text;
alter table public.kindergarten_risk_profiles add column if not exists explanation jsonb not null default '{}'::jsonb;
alter table public.kindergarten_risk_profiles add column if not exists top_contributors jsonb not null default '[]'::jsonb;
alter table public.kindergarten_risk_profiles add column if not exists advisory_only boolean not null default true;
alter table public.kindergarten_risk_profiles add column if not exists human_review_required boolean not null default true;
alter table public.kindergarten_risk_profiles add column if not exists parent_visible boolean not null default false;
alter table public.kindergarten_risk_profiles add column if not exists calculated_at timestamptz not null default now();
alter table public.kindergarten_risk_profiles add column if not exists created_at timestamptz not null default now();
alter table public.kindergarten_risk_profiles add column if not exists updated_at timestamptz not null default now();

update public.kindergarten_risk_profiles
set
  id = coalesce(id, gen_random_uuid()),
  garden_id = coalesce(garden_id, kindergarten_id),
  kindergarten_id = coalesce(kindergarten_id, garden_id),
  overall_risk_score = coalesce(overall_risk_score, overall_score, 0),
  safety_risk = coalesce(safety_risk, safety_score, 0),
  operational_risk = coalesce(operational_risk, greatest(coalesce(attendance_score, 0), coalesce(pickup_score, 0))),
  observer_risk = coalesce(observer_risk, camera_coverage_score, 0),
  overall_score = coalesce(overall_score, overall_risk_score, 0),
  safety_score = coalesce(safety_score, safety_risk, 0),
  camera_coverage_score = coalesce(camera_coverage_score, observer_risk, 0),
  updated_at = now()
where garden_id is null
   or kindergarten_id is null
   or id is null
   or overall_risk_score is null
   or safety_risk is null
   or operational_risk is null
   or observer_risk is null
   or overall_score is null
   or safety_score is null
   or camera_coverage_score is null;

alter table public.kindergarten_risk_profiles alter column garden_id set not null;
alter table public.kindergarten_risk_profiles alter column kindergarten_id set not null;

alter table public.kindergarten_risk_profiles drop constraint if exists kindergarten_risk_scores_check;
alter table public.kindergarten_risk_profiles add constraint kindergarten_risk_scores_check check (
  overall_risk_score between 0 and 100
  and safety_risk between 0 and 100
  and compliance_risk between 0 and 100
  and operational_risk between 0 and 100
  and staffing_risk between 0 and 100
  and observer_risk between 0 and 100
  and coalesce(attendance_score, 0) between 0 and 100
  and coalesce(pickup_score, 0) between 0 and 100
  and coalesce(safety_score, 0) between 0 and 100
  and coalesce(supervision_score, 0) between 0 and 100
  and coalesce(camera_coverage_score, 0) between 0 and 100
  and coalesce(overall_score, 0) between 0 and 100
);

alter table public.kindergarten_risk_profiles drop constraint if exists kindergarten_risk_trend_check;
alter table public.kindergarten_risk_profiles add constraint kindergarten_risk_trend_check check (risk_trend in ('rising','stable','declining','new'));
alter table public.kindergarten_risk_profiles drop constraint if exists kindergarten_risk_level_check;
alter table public.kindergarten_risk_profiles add constraint kindergarten_risk_level_check check (risk_level in ('low','medium','high','critical'));
alter table public.kindergarten_risk_profiles drop constraint if exists kindergarten_predicted_risk_level_check;
alter table public.kindergarten_risk_profiles add constraint kindergarten_predicted_risk_level_check check (predicted_risk_level in ('low','medium','high','critical'));
alter table public.kindergarten_risk_profiles drop constraint if exists kindergarten_risk_status_check;
alter table public.kindergarten_risk_profiles add constraint kindergarten_risk_status_check check (risk_status in ('mock_baseline','needs_configuration','baseline_ready','review_required'));

create unique index if not exists kindergarten_risk_profiles_garden_id_key on public.kindergarten_risk_profiles(garden_id);

alter table public.kindergarten_risk_history add column if not exists overall_risk_score integer not null default 0;
alter table public.kindergarten_risk_history add column if not exists safety_risk integer not null default 0;
alter table public.kindergarten_risk_history add column if not exists compliance_risk integer not null default 0;
alter table public.kindergarten_risk_history add column if not exists operational_risk integer not null default 0;
alter table public.kindergarten_risk_history add column if not exists staffing_risk integer not null default 0;
alter table public.kindergarten_risk_history add column if not exists observer_risk integer not null default 0;
alter table public.kindergarten_risk_history add column if not exists risk_level text not null default 'low';
alter table public.kindergarten_risk_history add column if not exists explanation jsonb not null default '{}'::jsonb;

create index if not exists kindergarten_risk_profiles_score_idx on public.kindergarten_risk_profiles(overall_risk_score desc, risk_trend, calculated_at desc);
create index if not exists kindergarten_risk_history_garden_idx on public.kindergarten_risk_history(garden_id, snapshot_date desc, snapshot_period);
create index if not exists predictive_risk_signals_scope_idx on public.predictive_risk_signals(garden_id, review_status, severity, created_at desc);
create index if not exists risk_prevention_recommendations_scope_idx on public.risk_prevention_recommendations(garden_id, status, priority);

alter table public.kindergarten_risk_profiles enable row level security;
alter table public.kindergarten_risk_history enable row level security;
alter table public.predictive_risk_signals enable row level security;
alter table public.risk_prevention_recommendations enable row level security;

drop policy if exists "kindergarten risk profiles scoped read" on public.kindergarten_risk_profiles;
create policy "kindergarten risk profiles scoped read" on public.kindergarten_risk_profiles
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "kindergarten risk profiles admin write" on public.kindergarten_risk_profiles;
create policy "kindergarten risk profiles admin write" on public.kindergarten_risk_profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kindergarten risk history scoped read" on public.kindergarten_risk_history;
create policy "kindergarten risk history scoped read" on public.kindergarten_risk_history
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "kindergarten risk history admin write" on public.kindergarten_risk_history;
create policy "kindergarten risk history admin write" on public.kindergarten_risk_history
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "predictive risk signals scoped read" on public.predictive_risk_signals;
create policy "predictive risk signals scoped read" on public.predictive_risk_signals
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "predictive risk signals scoped write" on public.predictive_risk_signals;
create policy "predictive risk signals scoped write" on public.predictive_risk_signals
for all using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "risk prevention recommendations scoped read" on public.risk_prevention_recommendations;
create policy "risk prevention recommendations scoped read" on public.risk_prevention_recommendations
for select using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

drop policy if exists "risk prevention recommendations scoped write" on public.risk_prevention_recommendations;
create policy "risk prevention recommendations scoped write" on public.risk_prevention_recommendations
for all using (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)))
with check (public.is_admin() or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id)));

with complaints as (
  select garden_id,
    count(*) filter (where status::text <> 'closed') as open_count,
    count(*) filter (where severity::text in ('high','critical') and status::text <> 'closed') as severe_count,
    count(*) filter (where created_at >= now() - interval '30 days') as recent_count
  from public.complaints
  group by garden_id
),
incidents as (
  select garden_id,
    count(*) filter (where status::text not in ('closed','resolved','done')) as open_count,
    count(*) filter (where severity::text in ('high','urgent','critical') and status::text not in ('closed','resolved','done')) as severe_count,
    count(*) filter (where created_at >= now() - interval '30 days') as recent_count
  from public.incident_reports
  group by garden_id
),
violations as (
  select garden_id,
    count(*) filter (where status::text not in ('done','resolved','verified','closed')) as open_count,
    count(*) filter (where severity::text in ('high','critical') and status::text not in ('done','resolved','verified','closed')) as severe_count,
    count(*) filter (where created_at >= now() - interval '30 days') as recent_count
  from public.violations
  group by garden_id
),
compliance as (
  select garden_id,
    count(*) filter (where alert_status in ('open','in_progress')) as open_count,
    count(*) filter (where severity in ('high','critical') and alert_status in ('open','in_progress')) as severe_count,
    count(*) filter (where created_at >= now() - interval '30 days') as recent_count
  from public.compliance_alerts
  where garden_id is not null
  group by garden_id
),
observer as (
  select kindergarten_id as garden_id,
    count(*) filter (where review_status in ('needs_review','reviewing','escalated')) as open_count,
    count(*) filter (where severity in ('high','urgent','critical') and review_status in ('needs_review','reviewing','escalated')) as severe_count,
    count(*) filter (where created_at >= now() - interval '30 days') as recent_count
  from public.observer_intelligence_signals
  where kindergarten_id is not null
  group by kindergarten_id
),
cameras as (
  select garden_id,
    count(*) filter (where active is false or status::text in ('offline','disabled','failed','error') or health_status::text in ('offline','failed','unhealthy','degraded')) as outage_count,
    count(*) as total_count
  from public.camera_streams
  where garden_id is not null
  group by garden_id
),
attendance as (
  select garden_id,
    count(*) filter (where staff_id is not null and status::text in ('absent','late','not_updated') and attendance_date >= current_date - interval '14 days') as staff_anomalies,
    count(*) filter (where child_id is not null and status::text in ('absent','late','not_updated') and attendance_date >= current_date - interval '14 days') as child_anomalies
  from public.attendance
  group by garden_id
),
pickup as (
  select kindergarten_id as garden_id,
    count(*) filter (where status in ('unusual','parent_confirmation_requested') or authorization_type in ('manual_review','unauthorized') or face_match_status in ('not_matched','needs_review')) as anomaly_count
  from public.child_pickup_events
  group by kindergarten_id
),
rating as (
  select garden_id, safety_score, compliance_score, inspection_score, observer_score
  from public.kindergarten_rating_profiles
),
prev as (
  select distinct on (garden_id) garden_id, overall_risk_score
  from public.kindergarten_risk_history
  where snapshot_date < current_date
  order by garden_id, snapshot_date desc
),
inputs as (
  select
    g.id as garden_id,
    coalesce(c.open_count, 0) as complaints_open,
    coalesce(c.severe_count, 0) as complaints_severe,
    coalesce(c.recent_count, 0) as complaints_recent,
    coalesce(i.open_count, 0) as incidents_open,
    coalesce(i.severe_count, 0) as incidents_severe,
    coalesce(i.recent_count, 0) as incidents_recent,
    coalesce(v.open_count, 0) as violations_open,
    coalesce(v.severe_count, 0) as violations_severe,
    coalesce(v.recent_count, 0) as violations_recent,
    coalesce(co.open_count, 0) as compliance_open,
    coalesce(co.severe_count, 0) as compliance_severe,
    coalesce(co.recent_count, 0) as compliance_recent,
    coalesce(o.open_count, 0) as observer_open,
    coalesce(o.severe_count, 0) as observer_severe,
    coalesce(o.recent_count, 0) as observer_recent,
    coalesce(cam.outage_count, 0) as camera_outages,
    coalesce(cam.total_count, 0) as camera_total,
    coalesce(a.staff_anomalies, 0) as staff_anomalies,
    coalesce(a.child_anomalies, 0) as child_anomalies,
    coalesce(p.anomaly_count, 0) as pickup_anomalies,
    coalesce(r.safety_score, 80) as rating_safety,
    coalesce(r.compliance_score, 80) as rating_compliance,
    coalesce(r.inspection_score, 80) as rating_inspection,
    coalesce(r.observer_score, 75) as rating_observer,
    coalesce(prev.overall_risk_score, null) as previous_score
  from public.gardens g
  left join complaints c on c.garden_id = g.id
  left join incidents i on i.garden_id = g.id
  left join violations v on v.garden_id = g.id
  left join compliance co on co.garden_id = g.id
  left join observer o on o.garden_id = g.id
  left join cameras cam on cam.garden_id = g.id
  left join attendance a on a.garden_id = g.id
  left join pickup p on p.garden_id = g.id
  left join rating r on r.garden_id = g.id
  left join prev on prev.garden_id = g.id
),
scores as (
  select *,
    least(100, greatest(0, incidents_open * 8 + incidents_severe * 10 + violations_open * 7 + violations_severe * 9 + pickup_anomalies * 6 + greatest(0, 80 - rating_safety) * 0.45))::int as safety_risk,
    least(100, greatest(0, compliance_open * 7 + compliance_severe * 10 + greatest(0, 80 - rating_compliance) * 0.55))::int as compliance_risk,
    least(100, greatest(0, complaints_open * 5 + camera_outages * 7 + child_anomalies * 2 + greatest(0, 80 - rating_inspection) * 0.35))::int as operational_risk,
    least(100, greatest(0, staff_anomalies * 4 + violations_open * 2))::int as staffing_risk,
    least(100, greatest(0, observer_open * 5 + observer_severe * 10 + camera_outages * 5 + greatest(0, 80 - rating_observer) * 0.4))::int as observer_risk
  from inputs
),
final_scores as (
  select *,
    least(100, greatest(0, round(safety_risk * 0.28 + compliance_risk * 0.18 + operational_risk * 0.2 + staffing_risk * 0.14 + observer_risk * 0.2)))::int as overall_risk_score
  from scores
)
insert into public.kindergarten_risk_profiles (
  garden_id, kindergarten_id, overall_risk_score, safety_risk, compliance_risk, operational_risk, staffing_risk, observer_risk,
  risk_trend, risk_level, predicted_risk_level, prediction_summary, explanation, top_contributors, calculated_at, updated_at
)
select
  garden_id,
  garden_id,
  overall_risk_score,
  safety_risk,
  compliance_risk,
  operational_risk,
  staffing_risk,
  observer_risk,
  case when previous_score is null then 'new' when overall_risk_score >= previous_score + 8 then 'rising' when overall_risk_score <= previous_score - 8 then 'declining' else 'stable' end,
  case when overall_risk_score >= 80 then 'critical' when overall_risk_score >= 62 then 'high' when overall_risk_score >= 38 then 'medium' else 'low' end,
  case
    when complaints_recent + incidents_recent + compliance_recent + observer_recent >= 12 or overall_risk_score >= 75 then 'critical'
    when complaints_recent + incidents_recent + compliance_recent + observer_recent >= 7 or overall_risk_score >= 58 then 'high'
    when complaints_recent + incidents_recent + compliance_recent + observer_recent >= 3 or overall_risk_score >= 34 then 'medium'
    else 'low'
  end,
  case
    when complaints_recent + incidents_recent + compliance_recent + observer_recent >= 7 then 'יש דפוס חוזר ב-30 הימים האחרונים. מומלץ לבצע בדיקה אנושית ותוכנית מניעה.'
    when overall_risk_score >= 62 then 'רמת הסיכון גבוהה ודורשת טיפול מונע.'
    else 'רמת הסיכון במעקב שוטף.'
  end,
  jsonb_build_object(
    'why_increased', jsonb_build_array(
      case when incidents_recent > 1 then concat(incidents_recent, ' אירועים אחרונים') end,
      case when complaints_recent > 1 then concat(complaints_recent, ' תלונות אחרונות') end,
      case when compliance_recent > 1 then concat(compliance_recent, ' כשלים חוזרים בציות') end,
      case when observer_recent > 1 then concat(observer_recent, ' סימני תצפיתן אחרונים') end,
      case when camera_outages > 0 then concat(camera_outages, ' בעיות מצלמה') end,
      case when staff_anomalies > 0 then concat(staff_anomalies, ' חריגות נוכחות צוות') end
    ),
    'why_decreased', jsonb_build_array('סגירת אירועים, תלונות, ליקויים והתראות מורידה סיכון', 'בריאות מצלמות ובדיקת תצפיתן אנושית מורידות סיכון'),
    'how_to_improve', jsonb_build_array('להגביר השגחה זמנית', 'לסגור פעולות ציות', 'לקבוע ביקורת המשך', 'לבדוק נוכחות צוות', 'לבדוק כיסוי מצלמות'),
    'privacy', jsonb_build_object('no_child_labels', true, 'no_staff_public_score', true, 'no_parent_notifications', true, 'advisory_only', true)
  ),
  jsonb_build_array(
    jsonb_build_object('label', 'בטיחות', 'score', safety_risk),
    jsonb_build_object('label', 'ציות', 'score', compliance_risk),
    jsonb_build_object('label', 'תפעול', 'score', operational_risk),
    jsonb_build_object('label', 'צוות', 'score', staffing_risk),
    jsonb_build_object('label', 'תצפיתן', 'score', observer_risk)
  ),
  now(),
  now()
from final_scores
on conflict (garden_id) do update set
  overall_risk_score = excluded.overall_risk_score,
  safety_risk = excluded.safety_risk,
  compliance_risk = excluded.compliance_risk,
  operational_risk = excluded.operational_risk,
  staffing_risk = excluded.staffing_risk,
  observer_risk = excluded.observer_risk,
  overall_score = excluded.overall_risk_score,
  safety_score = excluded.safety_risk,
  camera_coverage_score = excluded.observer_risk,
  risk_status = 'baseline_ready',
  risk_trend = excluded.risk_trend,
  risk_level = excluded.risk_level,
  predicted_risk_level = excluded.predicted_risk_level,
  prediction_summary = excluded.prediction_summary,
  explanation = excluded.explanation,
  top_contributors = excluded.top_contributors,
  calculated_at = now(),
  updated_at = now();

insert into public.kindergarten_risk_history (
  garden_id, snapshot_date, snapshot_period, overall_risk_score, safety_risk, compliance_risk, operational_risk, staffing_risk, observer_risk, risk_level, explanation
)
select garden_id, current_date, 'daily', overall_risk_score, safety_risk, compliance_risk, operational_risk, staffing_risk, observer_risk, risk_level, explanation
from public.kindergarten_risk_profiles
on conflict (garden_id, snapshot_date, snapshot_period) do update set
  overall_risk_score = excluded.overall_risk_score,
  safety_risk = excluded.safety_risk,
  compliance_risk = excluded.compliance_risk,
  operational_risk = excluded.operational_risk,
  staffing_risk = excluded.staffing_risk,
  observer_risk = excluded.observer_risk,
  risk_level = excluded.risk_level,
  explanation = excluded.explanation;

insert into public.predictive_risk_signals (garden_id, signal_key, signal_type, severity, confidence, pattern_count, title, explanation, recommended_action, metadata)
select garden_id, 'repeated_incidents_30d', 'repeated_incidents', case when incidents_recent >= 5 then 'critical' when incidents_recent >= 3 then 'high' else 'medium' end, least(0.95, incidents_recent / 10.0), incidents_recent, 'אירועים חוזרים', 'זוהו אירועים חוזרים בתקופה האחרונה. אין להסיק מסקנות ללא בדיקה אנושית.', 'להגביר השגחה זמנית ולבדוק דפוסי יום.', jsonb_build_object('advisory_only', true)
from (
  select garden_id, count(*) as incidents_recent
  from public.incident_reports
  where created_at >= now() - interval '30 days'
  group by garden_id
) x
where incidents_recent >= 2
on conflict (garden_id, signal_key) do update set severity = excluded.severity, confidence = excluded.confidence, pattern_count = excluded.pattern_count, explanation = excluded.explanation, recommended_action = excluded.recommended_action, updated_at = now();

insert into public.predictive_risk_signals (garden_id, signal_key, signal_type, severity, confidence, pattern_count, title, explanation, recommended_action, metadata)
select garden_id, 'repeated_complaints_30d', 'repeated_complaints', case when complaint_count >= 5 then 'critical' when complaint_count >= 3 then 'high' else 'medium' end, least(0.95, complaint_count / 10.0), complaint_count, 'תלונות חוזרות', 'זוהו תלונות חוזרות. יש לבדוק הקשר, לא לפרסם ולא להסיק מסקנה אוטומטית.', 'לבדוק תלונות פתוחות ולשוחח עם מנהלת הגן.', jsonb_build_object('parent_visible', false)
from (
  select garden_id, count(*) as complaint_count
  from public.complaints
  where created_at >= now() - interval '30 days'
  group by garden_id
) x
where complaint_count >= 2
on conflict (garden_id, signal_key) do update set severity = excluded.severity, confidence = excluded.confidence, pattern_count = excluded.pattern_count, explanation = excluded.explanation, recommended_action = excluded.recommended_action, updated_at = now();

insert into public.predictive_risk_signals (garden_id, signal_key, signal_type, severity, confidence, pattern_count, title, explanation, recommended_action, metadata)
select garden_id, 'staff_attendance_14d', 'repeated_staffing_issues', case when anomaly_count >= 8 then 'high' else 'medium' end, least(0.9, anomaly_count / 12.0), anomaly_count, 'חריגות נוכחות צוות', 'זוהו איחורים או היעדרויות צוות חוזרות. מיועד למנהלת בלבד.', 'לבדוק שיבוץ, עומס צוות וחלוקת משמרות.', jsonb_build_object('manager_only', true, 'no_public_staff_scoring', true)
from (
  select garden_id, count(*) as anomaly_count
  from public.attendance
  where staff_id is not null
    and status::text in ('absent','late','not_updated')
    and attendance_date >= current_date - interval '14 days'
  group by garden_id
) x
where anomaly_count >= 3
on conflict (garden_id, signal_key) do update set severity = excluded.severity, confidence = excluded.confidence, pattern_count = excluded.pattern_count, explanation = excluded.explanation, recommended_action = excluded.recommended_action, updated_at = now();

insert into public.predictive_risk_signals (garden_id, signal_key, signal_type, severity, confidence, pattern_count, title, explanation, recommended_action, metadata)
select kindergarten_id, 'observer_alerts_30d', 'repeated_observer_alerts', case when signal_count >= 8 then 'high' else 'medium' end, least(0.9, signal_count / 12.0), signal_count, 'סימני תצפיתן חוזרים', 'זוהו סימני תצפיתן חוזרים שממתינים לבדיקה אנושית.', 'לבדוק את תור התצפיתן ולסגור false positives.', jsonb_build_object('no_raw_ai_public', true)
from (
  select kindergarten_id, count(*) as signal_count
  from public.observer_intelligence_signals
  where kindergarten_id is not null
    and created_at >= now() - interval '30 days'
  group by kindergarten_id
) x
where signal_count >= 3
on conflict (garden_id, signal_key) do update set severity = excluded.severity, confidence = excluded.confidence, pattern_count = excluded.pattern_count, explanation = excluded.explanation, recommended_action = excluded.recommended_action, updated_at = now();

insert into public.predictive_risk_signals (garden_id, signal_key, signal_type, severity, confidence, pattern_count, title, explanation, recommended_action, metadata)
select kindergarten_id, 'pickup_anomalies_30d', 'pickup_anomaly_pattern', case when anomaly_count >= 4 then 'high' else 'medium' end, least(0.9, anomaly_count / 8.0), anomaly_count, 'חריגות איסוף חוזרות', 'זוהו חריגות איסוף שחייבות בדיקת צוות. לא נוצרת תווית לילד.', 'לבדוק הרשאות איסוף ותיעוד צוות.', jsonb_build_object('no_child_labeling', true)
from (
  select kindergarten_id, count(*) as anomaly_count
  from public.child_pickup_events
  where pickup_time >= now() - interval '30 days'
    and (status in ('unusual','parent_confirmation_requested') or authorization_type in ('manual_review','unauthorized') or face_match_status in ('not_matched','needs_review'))
  group by kindergarten_id
) x
where anomaly_count >= 2
on conflict (garden_id, signal_key) do update set severity = excluded.severity, confidence = excluded.confidence, pattern_count = excluded.pattern_count, explanation = excluded.explanation, recommended_action = excluded.recommended_action, updated_at = now();

insert into public.risk_prevention_recommendations (garden_id, signal_id, recommendation_key, category, title, explanation, priority)
select s.garden_id, s.id, concat('risk:', s.signal_key), 
  case
    when s.signal_type in ('repeated_compliance_failures') then 'compliance'
    when s.signal_type in ('repeated_staffing_issues') then 'staffing'
    when s.signal_type in ('camera_outage_pattern','repeated_observer_alerts') then 'observer_review'
    when s.signal_type in ('pickup_anomaly_pattern','repeated_incidents') then 'supervision'
    else 'inspection'
  end,
  case
    when s.signal_type = 'repeated_staffing_issues' then 'בדיקת שיבוץ צוות'
    when s.signal_type = 'repeated_observer_alerts' then 'בדיקת תור תצפיתן'
    when s.signal_type = 'pickup_anomaly_pattern' then 'בדיקת תהליך איסוף'
    when s.signal_type = 'repeated_complaints' then 'בדיקת תלונות חוזרות'
    else 'תוכנית מניעה'
  end,
  s.recommended_action,
  case when s.severity = 'critical' then 'critical' when s.severity = 'high' then 'high' else 'medium' end
from public.predictive_risk_signals s
where s.review_status in ('needs_review','reviewing','escalated')
on conflict (garden_id, recommendation_key) do update set
  signal_id = excluded.signal_id,
  category = excluded.category,
  title = excluded.title,
  explanation = excluded.explanation,
  priority = excluded.priority,
  status = 'open',
  updated_at = now();

comment on table public.kindergarten_risk_profiles is 'Advisory internal risk profile. Not parent visible and not an enforcement mechanism.';
comment on column public.kindergarten_risk_profiles.parent_visible is 'Must remain false. Parents do not see predictive risk scores.';
comment on table public.predictive_risk_signals is 'Early warning signals for human review. No accusations, labels, or automatic decisions.';
comment on table public.risk_prevention_recommendations is 'Prevention recommendations requiring human approval.';
