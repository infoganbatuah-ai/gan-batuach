-- PHASE 111: Parent Trust Network
-- Parent-safe transparency layer. No raw AI events, no internal investigations, no sensitive kindergarten information.

create table if not exists public.parent_trust_profiles (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  trust_score integer not null default 0,
  safety_score integer not null default 0,
  compliance_score integer not null default 0,
  inspection_score integer not null default 0,
  observer_readiness_score integer not null default 0,
  issue_resolution_score integer not null default 0,
  response_score integer not null default 0,
  trust_badge_status text not null default 'monitored',
  public_profile_ready boolean not null default false,
  parent_summary text,
  latest_inspection_summary text,
  approved_for_parent_visibility boolean not null default true,
  visibility_rules jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id),
  constraint parent_trust_scores_check check (
    trust_score between 0 and 100 and safety_score between 0 and 100 and compliance_score between 0 and 100
    and inspection_score between 0 and 100 and observer_readiness_score between 0 and 100
    and issue_resolution_score between 0 and 100 and response_score between 0 and 100
  ),
  constraint parent_trust_badge_status_check check (trust_badge_status in ('certified','monitored','probation','suspended'))
);

create table if not exists public.parent_trust_feed (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  feed_type text not null,
  title text not null,
  summary text not null,
  occurred_at timestamptz not null default now(),
  approved_for_parents boolean not null default true,
  source_type text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint parent_trust_feed_type_check check (feed_type in (
    'inspection_completed',
    'compliance_improved',
    'safety_milestone',
    'resolved_finding',
    'trust_badge_updated',
    'important_safety_update'
  ))
);

create table if not exists public.parent_trust_badges (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  badge_status text not null,
  badge_label text not null,
  public_label text not null,
  public_summary text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(garden_id, badge_status),
  constraint parent_trust_badges_status_check check (badge_status in ('certified','monitored','probation','suspended'))
);

create table if not exists public.parent_trust_education_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  category text not null,
  title text not null,
  summary text not null,
  body text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint parent_trust_education_category_check check (category in ('safety_guides','inspection_explanations','compliance_explanations','observer_explanations'))
);

create table if not exists public.parent_trust_analytics (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint parent_trust_analytics_event_check check (event_type in (
    'trust_center_view',
    'inspection_visibility_view',
    'complaint_status_view',
    'trust_badge_share',
    'public_profile_share',
    'education_item_view'
  ))
);

create index if not exists parent_trust_profiles_score_idx on public.parent_trust_profiles(trust_score desc, trust_badge_status);
create index if not exists parent_trust_feed_garden_idx on public.parent_trust_feed(garden_id, approved_for_parents, occurred_at desc);
create index if not exists parent_trust_badges_garden_idx on public.parent_trust_badges(garden_id, active, issued_at desc);
create index if not exists parent_trust_analytics_garden_idx on public.parent_trust_analytics(garden_id, event_date desc, event_type);

alter table public.parent_trust_profiles enable row level security;
alter table public.parent_trust_feed enable row level security;
alter table public.parent_trust_badges enable row level security;
alter table public.parent_trust_education_items enable row level security;
alter table public.parent_trust_analytics enable row level security;

drop policy if exists "parent trust profiles scoped read" on public.parent_trust_profiles;
create policy "parent trust profiles scoped read" on public.parent_trust_profiles
for select using (
  approved_for_parent_visibility = true
  and (
    public.is_admin()
    or public.can_access_garden(garden_id)
    or exists (select 1 from public.gardens g where g.id = garden_id and g.public_profile_enabled = true and public_profile_ready = true)
  )
);

drop policy if exists "parent trust profiles admin write" on public.parent_trust_profiles;
create policy "parent trust profiles admin write" on public.parent_trust_profiles
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parent trust feed scoped read" on public.parent_trust_feed;
create policy "parent trust feed scoped read" on public.parent_trust_feed
for select using (
  approved_for_parents = true
  and (public.is_admin() or public.can_access_garden(garden_id) or exists (select 1 from public.gardens g where g.id = garden_id and g.public_profile_enabled = true))
);

drop policy if exists "parent trust feed admin write" on public.parent_trust_feed;
create policy "parent trust feed admin write" on public.parent_trust_feed
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parent trust badges scoped read" on public.parent_trust_badges;
create policy "parent trust badges scoped read" on public.parent_trust_badges
for select using (active = true and (public.is_admin() or public.can_access_garden(garden_id) or exists (select 1 from public.gardens g where g.id = garden_id and g.public_profile_enabled = true)));

drop policy if exists "parent trust badges admin write" on public.parent_trust_badges;
create policy "parent trust badges admin write" on public.parent_trust_badges
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parent trust education public read" on public.parent_trust_education_items;
create policy "parent trust education public read" on public.parent_trust_education_items
for select using (active = true);

drop policy if exists "parent trust education admin write" on public.parent_trust_education_items;
create policy "parent trust education admin write" on public.parent_trust_education_items
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parent trust analytics scoped insert" on public.parent_trust_analytics;
create policy "parent trust analytics scoped insert" on public.parent_trust_analytics
for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "parent trust analytics admin read" on public.parent_trust_analytics;
create policy "parent trust analytics admin read" on public.parent_trust_analytics
for select using (public.is_admin());

with latest_rating as (
  select garden_id, overall_score, safety_score, compliance_score, inspection_score, observer_score
  from public.kindergarten_rating_profiles
),
latest_observer as (
  select distinct on (kindergarten_id) kindergarten_id as garden_id, readiness_score
  from public.observer_network_score_snapshots
  where kindergarten_id is not null
  order by kindergarten_id, calculated_at desc
),
latest_inspection as (
  select distinct on (garden_id) garden_id, weighted_score, completed_at, violation_count
  from public.inspections
  where status::text in ('done','completed') or completed_at is not null
  order by garden_id, completed_at desc nulls last, created_at desc
),
complaint_stats as (
  select garden_id,
    count(*) filter (where status::text <> 'closed') as open_count,
    count(*) filter (where status::text = 'closed') as closed_count,
    count(*) as total_count
  from public.complaints
  group by garden_id
),
violation_stats as (
  select garden_id,
    count(*) filter (where status::text not in ('done','resolved','verified','closed')) as open_count,
    count(*) filter (where status::text in ('done','resolved','verified','closed')) as resolved_count,
    count(*) as total_count
  from public.violations
  group by garden_id
),
compliance_alerts as (
  select garden_id,
    count(*) filter (where alert_status in ('open','in_progress')) as open_count,
    count(*) filter (where alert_status in ('resolved','verified')) as resolved_count
  from public.compliance_alerts
  where garden_id is not null
  group by garden_id
),
scores as (
  select
    g.id as garden_id,
    coalesce(r.safety_score, round(g.last_inspection_score)::int, 76) as safety_score,
    coalesce(r.compliance_score, 72) as compliance_score,
    coalesce(r.inspection_score, round(i.weighted_score)::int, round(g.last_inspection_score)::int, 70) as inspection_score,
    coalesce(o.readiness_score, r.observer_score, 68) as observer_readiness_score,
    least(100, greatest(0, 78 + coalesce(v.resolved_count, 0) * 3 + coalesce(ca.resolved_count, 0) * 2 - coalesce(v.open_count, 0) * 6 - coalesce(ca.open_count, 0) * 4))::int as issue_resolution_score,
    least(100, greatest(0, 82 + coalesce(cs.closed_count, 0) * 3 - coalesce(cs.open_count, 0) * 7))::int as response_score,
    i.completed_at as latest_inspection_at,
    i.violation_count as latest_violation_count,
    coalesce(v.open_count, 0) as open_violations,
    coalesce(ca.open_count, 0) as open_compliance,
    coalesce(cs.open_count, 0) as open_complaints
  from public.gardens g
  left join latest_rating r on r.garden_id = g.id
  left join latest_observer o on o.garden_id = g.id
  left join latest_inspection i on i.garden_id = g.id
  left join complaint_stats cs on cs.garden_id = g.id
  left join violation_stats v on v.garden_id = g.id
  left join compliance_alerts ca on ca.garden_id = g.id
),
final_scores as (
  select *,
    least(100, greatest(0, round(
      safety_score * 0.26
      + compliance_score * 0.20
      + inspection_score * 0.20
      + observer_readiness_score * 0.16
      + issue_resolution_score * 0.10
      + response_score * 0.08
    )))::int as trust_score
  from scores
)
insert into public.parent_trust_profiles (
  garden_id,
  trust_score,
  safety_score,
  compliance_score,
  inspection_score,
  observer_readiness_score,
  issue_resolution_score,
  response_score,
  trust_badge_status,
  public_profile_ready,
  parent_summary,
  latest_inspection_summary,
  visibility_rules,
  explanation,
  calculated_at,
  updated_at
)
select
  garden_id,
  trust_score,
  safety_score,
  compliance_score,
  inspection_score,
  observer_readiness_score,
  issue_resolution_score,
  response_score,
  case when trust_score >= 86 and open_violations = 0 and open_compliance = 0 then 'certified' when trust_score >= 70 then 'monitored' when trust_score >= 50 then 'probation' else 'suspended' end,
  trust_score >= 70,
  case when trust_score >= 86 then 'הגן עומד ברמת אמון גבוהה וממשיך להיות מנוטר.' when trust_score >= 70 then 'הגן נמצא במעקב פעיל עם שקיפות להורים.' when trust_score >= 50 then 'הגן בתהליך שיפור ומעקב מוגבר.' else 'הגן דורש טיפול לפני הרחבת אמון ציבורי.' end,
  case when latest_inspection_at is not null then concat('ביקורת אחרונה הושלמה בתאריך ', latest_inspection_at::date, '. ליקויים שפורסמו להורים: ', coalesce(latest_violation_count, 0), '.') else 'עדיין אין ביקורת מאושרת לפרסום להורים.' end,
  jsonb_build_object('no_raw_ai_events', true, 'no_internal_investigations', true, 'no_sensitive_data', true, 'approved_information_only', true),
  jsonb_build_object(
    'weights', jsonb_build_object('safety', 26, 'compliance', 20, 'inspection', 20, 'observer_readiness', 16, 'issue_resolution', 10, 'response', 8),
    'safe_for_parents', true,
    'hidden_information', jsonb_build_array('raw_ai_events', 'internal_investigations', 'personal_information', 'sensitive_complaint_details')
  ),
  now(),
  now()
from final_scores
on conflict (garden_id) do update set
  trust_score = excluded.trust_score,
  safety_score = excluded.safety_score,
  compliance_score = excluded.compliance_score,
  inspection_score = excluded.inspection_score,
  observer_readiness_score = excluded.observer_readiness_score,
  issue_resolution_score = excluded.issue_resolution_score,
  response_score = excluded.response_score,
  trust_badge_status = excluded.trust_badge_status,
  public_profile_ready = excluded.public_profile_ready,
  parent_summary = excluded.parent_summary,
  latest_inspection_summary = excluded.latest_inspection_summary,
  visibility_rules = excluded.visibility_rules,
  explanation = excluded.explanation,
  calculated_at = now(),
  updated_at = now();

insert into public.parent_trust_badges (garden_id, badge_status, badge_label, public_label, public_summary, active)
select garden_id, trust_badge_status,
  case trust_badge_status when 'certified' then 'Gan Batuach Certified' when 'monitored' then 'Gan Batuach Monitored' when 'probation' then 'Gan Batuach Probation' else 'Gan Batuach Suspended' end,
  case trust_badge_status when 'certified' then 'גן בטוח מאושר' when 'monitored' then 'גן במעקב פעיל' when 'probation' then 'גן בתהליך שיפור' else 'פרסום אמון מושעה' end,
  parent_summary,
  true
from public.parent_trust_profiles
on conflict (garden_id, badge_status) do update set
  badge_label = excluded.badge_label,
  public_label = excluded.public_label,
  public_summary = excluded.public_summary,
  active = true;

insert into public.parent_trust_feed (garden_id, feed_type, title, summary, occurred_at, source_type, source_id, metadata)
select i.garden_id, 'inspection_completed', 'ביקורת הושלמה', 'פורסם סיכום ביקורת מאושר להורים.', coalesce(i.completed_at, i.created_at), 'inspections', i.id, jsonb_build_object('weighted_score', i.weighted_score, 'parent_safe', true)
from public.inspections i
where (i.status::text in ('done','completed') or i.completed_at is not null)
  and not exists (select 1 from public.parent_trust_feed f where f.source_type = 'inspections' and f.source_id = i.id);

insert into public.parent_trust_feed (garden_id, feed_type, title, summary, occurred_at, source_type, source_id, metadata)
select v.garden_id, 'resolved_finding', 'ליקוי נסגר', 'פעולת תיקון אושרה ונסגרה.', coalesce(v.approved_at, v.updated_at), 'violations', v.id, jsonb_build_object('category', v.category, 'parent_safe', true)
from public.violations v
where v.status::text in ('done','resolved','verified','closed')
  and not exists (select 1 from public.parent_trust_feed f where f.source_type = 'violations' and f.source_id = v.id);

insert into public.parent_trust_feed (garden_id, feed_type, title, summary, occurred_at, source_type, source_id, metadata)
select a.garden_id, 'compliance_improved', 'שיפור ציות', 'מסמך, תעודה או דרישת ציות טופלו.', coalesce(a.verified_at, a.resolved_at, a.updated_at), 'compliance_alerts', a.id, jsonb_build_object('category', a.category, 'parent_safe', true)
from public.compliance_alerts a
where a.garden_id is not null
  and a.alert_status in ('resolved','verified')
  and not exists (select 1 from public.parent_trust_feed f where f.source_type = 'compliance_alerts' and f.source_id = a.id);

insert into public.parent_trust_feed (garden_id, feed_type, title, summary, occurred_at, source_type, source_id, metadata)
select p.garden_id, 'trust_badge_updated', 'תג אמון עודכן', p.parent_summary, p.calculated_at, 'parent_trust_profiles', p.id, jsonb_build_object('badge_status', p.trust_badge_status, 'trust_score', p.trust_score)
from public.parent_trust_profiles p
where not exists (
  select 1 from public.parent_trust_feed f
  where f.source_type = 'parent_trust_profiles'
    and f.source_id = p.id
    and f.metadata->>'badge_status' = p.trust_badge_status
);

insert into public.parent_trust_education_items (item_key, category, title, summary, body, display_order)
values
  ('how-inspections-work', 'inspection_explanations', 'איך ביקורת עובדת?', 'פקח בודק את הגן לפי טופס, ציונים ותיעוד מאושר.', 'הורים רואים רק סיכום מאושר. פרטי חקירה פנימית או מידע אישי אינם מוצגים.', 10),
  ('what-compliance-means', 'compliance_explanations', 'מה זה ציות?', 'מסמכים, ביטוחים, תעודות ונהלים שמחזקים את מוכנות הגן.', 'מערכת האמון מציגה שיפור וסטטוס כללי, בלי לחשוף מסמכים פרטיים.', 20),
  ('observer-boundaries', 'observer_explanations', 'מה התצפיתן מציג להורים?', 'רק סיכומים שאושרו בבדיקה אנושית.', 'אין חשיפה של אירועי AI גולמיים, שמע, מצלמות או חקירות פנימיות.', 30),
  ('parent-complaint-flow', 'safety_guides', 'איך מגישים פנייה?', 'פנייה נשמרת עם סטטוס טיפול ועדכונים.', 'אפשר לעקוב אחרי סטטוס הפנייה. מידע רגיש מטופל בערוצים מאובטחים בלבד.', 40)
on conflict (item_key) do update set
  category = excluded.category,
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  display_order = excluded.display_order,
  active = true;

comment on table public.parent_trust_profiles is 'Parent-safe trust score and badge readiness. No raw AI, no internal investigations, no sensitive data.';
comment on table public.parent_trust_feed is 'Approved transparency feed for parents: inspections, compliance improvements, resolved findings and safety milestones.';
comment on table public.parent_trust_badges is 'Gan Batuach Certified badge readiness for public and parent-safe usage.';
comment on table public.parent_trust_education_items is 'Parent education content explaining safety, inspections, compliance and observer boundaries.';
comment on table public.parent_trust_analytics is 'Parent trust engagement tracking without exposing sensitive content.';
