-- PHASE 110: National Kindergarten Rating System
-- Transparent rating model. No black-box scoring and no sensitive public exposure by default.

create table if not exists public.kindergarten_rating_profiles (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  overall_score integer not null default 0,
  safety_score integer not null default 0,
  compliance_score integer not null default 0,
  inspection_score integer not null default 0,
  parent_satisfaction_score integer not null default 0,
  observer_score integer not null default 0,
  rating_band text not null default 'new',
  trend text not null default 'stable',
  public_score integer,
  public_badge text,
  public_summary text,
  public_display_enabled boolean not null default false,
  explanation jsonb not null default '{}'::jsonb,
  improvement_recommendations jsonb not null default '[]'::jsonb,
  data_sources jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id),
  constraint kindergarten_rating_scores_check check (
    overall_score between 0 and 100 and safety_score between 0 and 100 and compliance_score between 0 and 100
    and inspection_score between 0 and 100 and parent_satisfaction_score between 0 and 100 and observer_score between 0 and 100
    and (public_score is null or public_score between 0 and 100)
  ),
  constraint kindergarten_rating_band_check check (rating_band in ('excellent','strong','stable','needs_attention','critical','new')),
  constraint kindergarten_rating_trend_check check (trend in ('improving','stable','declining','new'))
);

create table if not exists public.kindergarten_rating_history (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  snapshot_date date not null default current_date,
  snapshot_period text not null default 'daily',
  overall_score integer not null default 0,
  safety_score integer not null default 0,
  compliance_score integer not null default 0,
  inspection_score integer not null default 0,
  parent_satisfaction_score integer not null default 0,
  observer_score integer not null default 0,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(garden_id, snapshot_date, snapshot_period),
  constraint kindergarten_rating_history_period_check check (snapshot_period in ('daily','weekly','monthly')),
  constraint kindergarten_rating_history_scores_check check (
    overall_score between 0 and 100 and safety_score between 0 and 100 and compliance_score between 0 and 100
    and inspection_score between 0 and 100 and parent_satisfaction_score between 0 and 100 and observer_score between 0 and 100
  )
);

create table if not exists public.kindergarten_rating_recommendations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  recommendation_key text not null,
  category text not null,
  title text not null,
  explanation text,
  impact_level text not null default 'medium',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, recommendation_key),
  constraint kindergarten_rating_rec_category_check check (category in ('safety','compliance','inspection','parent_satisfaction','observer')),
  constraint kindergarten_rating_rec_impact_check check (impact_level in ('low','medium','high')),
  constraint kindergarten_rating_rec_status_check check (status in ('open','in_progress','completed','dismissed'))
);

create index if not exists kindergarten_rating_profiles_score_idx on public.kindergarten_rating_profiles(overall_score desc, calculated_at desc);
create index if not exists kindergarten_rating_profiles_public_idx on public.kindergarten_rating_profiles(public_display_enabled, public_score desc);
create index if not exists kindergarten_rating_history_garden_idx on public.kindergarten_rating_history(garden_id, snapshot_date desc, snapshot_period);
create index if not exists kindergarten_rating_recommendations_garden_idx on public.kindergarten_rating_recommendations(garden_id, status, impact_level);

alter table public.kindergarten_rating_profiles enable row level security;
alter table public.kindergarten_rating_history enable row level security;
alter table public.kindergarten_rating_recommendations enable row level security;

drop policy if exists "kindergarten ratings scoped read" on public.kindergarten_rating_profiles;
create policy "kindergarten ratings scoped read" on public.kindergarten_rating_profiles
for select using (
  public_display_enabled = true
  or public.is_admin()
  or public.can_access_garden(garden_id)
);

drop policy if exists "kindergarten ratings admin write" on public.kindergarten_rating_profiles;
create policy "kindergarten ratings admin write" on public.kindergarten_rating_profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kindergarten rating history scoped read" on public.kindergarten_rating_history;
create policy "kindergarten rating history scoped read" on public.kindergarten_rating_history
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "kindergarten rating history admin write" on public.kindergarten_rating_history;
create policy "kindergarten rating history admin write" on public.kindergarten_rating_history
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kindergarten rating recommendations scoped read" on public.kindergarten_rating_recommendations;
create policy "kindergarten rating recommendations scoped read" on public.kindergarten_rating_recommendations
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "kindergarten rating recommendations admin write" on public.kindergarten_rating_recommendations;
create policy "kindergarten rating recommendations admin write" on public.kindergarten_rating_recommendations
for all using (public.is_admin()) with check (public.is_admin());

with latest_compliance as (
  select distinct on (garden_id) garden_id, score
  from public.compliance_score_snapshots
  where garden_id is not null
  order by garden_id, calculated_at desc
),
latest_observer as (
  select distinct on (kindergarten_id) kindergarten_id as garden_id, readiness_score
  from public.observer_network_score_snapshots
  where kindergarten_id is not null
  order by kindergarten_id, calculated_at desc
),
inspection_stats as (
  select garden_id,
    coalesce(round(avg(weighted_score))::int, 70) as avg_score,
    count(*) filter (where status::text in ('done','completed') or completed_at is not null) as completed_count
  from public.inspections
  group by garden_id
),
open_violations as (
  select garden_id,
    count(*) as open_count,
    count(*) filter (where severity::text = 'critical') as critical_count,
    count(*) filter (where severity::text = 'high') as high_count
  from public.violations
  where status::text not in ('done','resolved','verified','closed')
  group by garden_id
),
incident_stats as (
  select garden_id,
    count(*) filter (where status::text not in ('closed','resolved','done')) as open_count,
    count(*) filter (where severity::text in ('critical','urgent','high') and status::text not in ('closed','resolved','done')) as severe_count
  from public.incident_reports
  group by garden_id
),
complaint_stats as (
  select garden_id,
    count(*) filter (where status::text <> 'closed') as open_count,
    count(*) filter (where severity::text in ('critical','high') and status::text <> 'closed') as severe_count
  from public.complaints
  group by garden_id
),
feedback_stats as (
  select garden_id,
    avg(nullif(rating, 0)) filter (where user_role = 'parent' and rating > 0) as avg_parent_rating,
    count(*) filter (where user_role = 'parent') as parent_feedback_count
  from public.pilot_feedback
  group by garden_id
),
observer_signals as (
  select kindergarten_id as garden_id,
    count(*) filter (where review_status in ('needs_review','reviewing','escalated')) as open_count,
    count(*) filter (where severity in ('critical','urgent','high') and review_status in ('needs_review','reviewing','escalated')) as severe_count,
    count(*) filter (where review_status in ('confirmed','dismissed','resolved')) as reviewed_count,
    count(*) as total_count
  from public.observer_intelligence_signals
  where kindergarten_id is not null
  group by kindergarten_id
),
camera_stats as (
  select garden_id,
    count(*) as total_count,
    count(*) filter (where active is not false) as active_count,
    count(*) filter (where status::text in ('offline','disabled','failed','error') or health_status::text in ('offline','failed','unhealthy','degraded')) as unhealthy_count
  from public.camera_streams
  where garden_id is not null
  group by garden_id
),
required_stats as (
  select garden_id,
    count(*) filter (where due_at < now() and status::text not in ('done','completed','closed')) as overdue_count
  from public.required_inspections
  group by garden_id
),
rating_inputs as (
  select
    g.id as garden_id,
    g.last_inspection_score,
    coalesce(lc.score, 72) as compliance_base,
    coalesce(lo.readiness_score, 68) as observer_base,
    coalesce(ins.avg_score, round(g.last_inspection_score)::int, 70) as inspection_base,
    coalesce(v.open_count, 0) as open_violations,
    coalesce(v.critical_count, 0) as critical_violations,
    coalesce(v.high_count, 0) as high_violations,
    coalesce(inc.open_count, 0) as open_incidents,
    coalesce(inc.severe_count, 0) as severe_incidents,
    coalesce(c.open_count, 0) as open_complaints,
    coalesce(c.severe_count, 0) as severe_complaints,
    coalesce(f.avg_parent_rating, 0) as avg_parent_rating,
    coalesce(f.parent_feedback_count, 0) as parent_feedback_count,
    coalesce(os.open_count, 0) as open_observer_signals,
    coalesce(os.severe_count, 0) as severe_observer_signals,
    coalesce(os.reviewed_count, 0) as reviewed_observer_signals,
    coalesce(os.total_count, 0) as total_observer_signals,
    coalesce(cs.total_count, 0) as total_cameras,
    coalesce(cs.active_count, 0) as active_cameras,
    coalesce(cs.unhealthy_count, 0) as unhealthy_cameras,
    coalesce(rs.overdue_count, 0) as overdue_inspections
  from public.gardens g
  left join latest_compliance lc on lc.garden_id = g.id
  left join latest_observer lo on lo.garden_id = g.id
  left join inspection_stats ins on ins.garden_id = g.id
  left join open_violations v on v.garden_id = g.id
  left join incident_stats inc on inc.garden_id = g.id
  left join complaint_stats c on c.garden_id = g.id
  left join feedback_stats f on f.garden_id = g.id
  left join observer_signals os on os.garden_id = g.id
  left join camera_stats cs on cs.garden_id = g.id
  left join required_stats rs on rs.garden_id = g.id
),
scores as (
  select
    *,
    least(100, greatest(0, inspection_base - open_violations * 4 - critical_violations * 10 - high_violations * 6 - overdue_inspections * 8))::int as inspection_score,
    least(100, greatest(0, compliance_base))::int as compliance_score,
    least(100, greatest(0, 88 - open_incidents * 5 - severe_incidents * 8 - open_violations * 3 - severe_observer_signals * 5 - open_observer_signals * 2))::int as safety_score,
    least(100, greatest(0, case when parent_feedback_count > 0 then round(avg_parent_rating * 20)::int else 76 end - open_complaints * 3 - severe_complaints * 5))::int as parent_satisfaction_score,
    least(100, greatest(0,
      observer_base
      - open_observer_signals * 2
      - severe_observer_signals * 6
      - unhealthy_cameras * 5
      + case when total_observer_signals > 0 then round((reviewed_observer_signals::numeric / greatest(total_observer_signals, 1)) * 8)::int else 0 end
    ))::int as observer_score
  from rating_inputs
),
final_scores as (
  select
    *,
    least(100, greatest(0, round(
      safety_score * 0.28
      + compliance_score * 0.22
      + inspection_score * 0.20
      + parent_satisfaction_score * 0.12
      + observer_score * 0.18
    )))::int as overall_score
  from scores
)
insert into public.kindergarten_rating_profiles (
  garden_id,
  overall_score,
  safety_score,
  compliance_score,
  inspection_score,
  parent_satisfaction_score,
  observer_score,
  rating_band,
  trend,
  public_score,
  public_badge,
  public_summary,
  public_display_enabled,
  explanation,
  improvement_recommendations,
  data_sources,
  calculated_at,
  updated_at
)
select
  garden_id,
  overall_score,
  safety_score,
  compliance_score,
  inspection_score,
  parent_satisfaction_score,
  observer_score,
  case when overall_score >= 90 then 'excellent' when overall_score >= 80 then 'strong' when overall_score >= 68 then 'stable' when overall_score >= 50 then 'needs_attention' else 'critical' end,
  'new',
  overall_score,
  case when overall_score >= 90 then 'מצוין' when overall_score >= 80 then 'חזק' when overall_score >= 68 then 'יציב' when overall_score >= 50 then 'דורש שיפור' else 'דורש טיפול דחוף' end,
  'ציון שקוף המבוסס על בטיחות, ציות, פיקוח, שביעות רצון ותצפיתן.',
  false,
  jsonb_build_object(
    'weights', jsonb_build_object('safety', 28, 'compliance', 22, 'inspection', 20, 'parent_satisfaction', 12, 'observer', 18),
    'why_score_decreased', jsonb_build_array(
      case when open_violations > 0 then concat(open_violations, ' ליקויים פתוחים') end,
      case when open_incidents > 0 then concat(open_incidents, ' אירועי בטיחות פתוחים') end,
      case when overdue_inspections > 0 then concat(overdue_inspections, ' ביקורות באיחור') end,
      case when unhealthy_cameras > 0 then concat(unhealthy_cameras, ' מצלמות לא יציבות') end,
      case when open_complaints > 0 then concat(open_complaints, ' תלונות פתוחות') end
    ),
    'why_score_increased', jsonb_build_array('ציות תקין משפר את הציון', 'סגירת ליקויים משפרת את ציון הבטיחות', 'בדיקת תצפיתן אנושית משפרת אמינות'),
    'how_to_improve', jsonb_build_array('לסגור ליקויי פיקוח', 'לחדש מסמכים ותעודות', 'לטפל בתלונות פתוחות', 'לבדוק אירועי תצפיתן פתוחים')
  ),
  jsonb_build_array(
    case when compliance_score < 75 then 'להשלים חידוש תעודות, ביטוחים ומסמכים' end,
    case when inspection_score < 75 then 'לסגור ממצאי פיקוח ולבצע ביקורת המשך' end,
    case when safety_score < 75 then 'לטפל באירועי בטיחות וליקויים פתוחים' end,
    case when observer_score < 75 then 'לשפר בריאות מצלמות וקצב בדיקת אירועים' end,
    case when parent_satisfaction_score < 75 then 'לטפל בתלונות ולשפר תקשורת הורים' end
  ),
  jsonb_build_object(
    'inspections', inspection_base,
    'open_violations', open_violations,
    'open_incidents', open_incidents,
    'open_complaints', open_complaints,
    'observer_signals', total_observer_signals,
    'camera_count', total_cameras,
    'parent_feedback_count', parent_feedback_count
  ),
  now(),
  now()
from final_scores
on conflict (garden_id) do update set
  overall_score = excluded.overall_score,
  safety_score = excluded.safety_score,
  compliance_score = excluded.compliance_score,
  inspection_score = excluded.inspection_score,
  parent_satisfaction_score = excluded.parent_satisfaction_score,
  observer_score = excluded.observer_score,
  rating_band = excluded.rating_band,
  public_score = excluded.public_score,
  public_badge = excluded.public_badge,
  public_summary = excluded.public_summary,
  explanation = excluded.explanation,
  improvement_recommendations = excluded.improvement_recommendations,
  data_sources = excluded.data_sources,
  calculated_at = now(),
  updated_at = now();

insert into public.kindergarten_rating_history (
  garden_id, snapshot_date, snapshot_period, overall_score, safety_score, compliance_score, inspection_score, parent_satisfaction_score, observer_score, explanation
)
select garden_id, current_date, 'daily', overall_score, safety_score, compliance_score, inspection_score, parent_satisfaction_score, observer_score, explanation
from public.kindergarten_rating_profiles
on conflict (garden_id, snapshot_date, snapshot_period) do update set
  overall_score = excluded.overall_score,
  safety_score = excluded.safety_score,
  compliance_score = excluded.compliance_score,
  inspection_score = excluded.inspection_score,
  parent_satisfaction_score = excluded.parent_satisfaction_score,
  observer_score = excluded.observer_score,
  explanation = excluded.explanation;

insert into public.kindergarten_rating_recommendations (garden_id, recommendation_key, category, title, explanation, impact_level)
select garden_id, 'complete_compliance_documents', 'compliance', 'השלמת מסמכים ותעודות', 'חידוש מסמכים ותעודות משפר את ציון הציות ואת הדירוג הכללי.', 'high'
from public.kindergarten_rating_profiles
where compliance_score < 75
on conflict (garden_id, recommendation_key) do update set status = 'open', updated_at = now();

insert into public.kindergarten_rating_recommendations (garden_id, recommendation_key, category, title, explanation, impact_level)
select garden_id, 'resolve_inspection_findings', 'inspection', 'סגירת ליקויי פיקוח', 'סגירת ממצאים פתוחים וביקורת המשך מעלים את ציון הפיקוח והבטיחות.', 'high'
from public.kindergarten_rating_profiles
where inspection_score < 75
on conflict (garden_id, recommendation_key) do update set status = 'open', updated_at = now();

insert into public.kindergarten_rating_recommendations (garden_id, recommendation_key, category, title, explanation, impact_level)
select garden_id, 'review_observer_events', 'observer', 'בדיקת אירועי תצפיתן', 'בדיקה אנושית של אירועי תצפיתן ושיפור בריאות מצלמות משפרים את אמינות הדירוג.', 'medium'
from public.kindergarten_rating_profiles
where observer_score < 75
on conflict (garden_id, recommendation_key) do update set status = 'open', updated_at = now();

insert into public.kindergarten_rating_recommendations (garden_id, recommendation_key, category, title, explanation, impact_level)
select garden_id, 'resolve_parent_complaints', 'parent_satisfaction', 'טיפול בתלונות פתוחות', 'סגירת תלונות ושיפור תקשורת הורים מעלים את מדד שביעות הרצון.', 'medium'
from public.kindergarten_rating_profiles
where parent_satisfaction_score < 75
on conflict (garden_id, recommendation_key) do update set status = 'open', updated_at = now();

comment on table public.kindergarten_rating_profiles is 'Official Gan Batuach transparent kindergarten rating profile. Scores are explainable and category-based.';
comment on column public.kindergarten_rating_profiles.explanation is 'Includes weights, reasons for score decrease/increase and improvement guidance. No black-box scoring.';
comment on column public.kindergarten_rating_profiles.public_display_enabled is 'Future public display gate. Sensitive data is never exposed by default.';
comment on table public.kindergarten_rating_history is 'Daily, weekly and monthly rating history for transparent trend analysis.';
comment on table public.kindergarten_rating_recommendations is 'Explainable improvement recommendations tied to rating categories.';
