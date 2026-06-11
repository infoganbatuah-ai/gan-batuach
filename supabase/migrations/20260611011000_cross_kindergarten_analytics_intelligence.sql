create table if not exists public.cross_kindergarten_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  snapshot_period text not null default 'daily',
  total_kindergartens integer not null default 0,
  active_kindergartens integer not null default 0,
  active_inspectors integer not null default 0,
  active_children integer not null default 0,
  active_staff integer not null default 0,
  safety_average integer not null default 0,
  compliance_average integer not null default 0,
  inspection_average integer not null default 0,
  observer_average integer not null default 0,
  parent_engagement_events integer not null default 0,
  camera_view_events integer not null default 0,
  document_approval_events integer not null default 0,
  inspection_completion_rate integer not null default 0,
  unresolved_findings integer not null default 0,
  high_risk_kindergartens integer not null default 0,
  rising_risk_kindergartens integer not null default 0,
  anonymized boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(snapshot_date, snapshot_period)
);

create table if not exists public.kindergarten_benchmark_profiles (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  benchmark_date date not null default current_date,
  national_average_score integer not null default 0,
  regional_average_score integer not null default 0,
  percentile_rank integer not null default 0,
  safety_score integer not null default 0,
  compliance_score integer not null default 0,
  inspection_score integer not null default 0,
  parent_engagement_score integer not null default 0,
  staff_completion_score integer not null default 0,
  observer_readiness_score integer not null default 0,
  private_data_excluded boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, benchmark_date)
);

create table if not exists public.regional_analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  country text not null default 'Israel',
  region text not null default 'unknown',
  city text,
  kindergarten_count integer not null default 0,
  active_kindergarten_count integer not null default 0,
  inspection_activity_count integer not null default 0,
  incident_count integer not null default 0,
  observer_signal_count integer not null default 0,
  compliance_issue_count integer not null default 0,
  safety_average integer not null default 0,
  compliance_average integer not null default 0,
  observer_average integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_intelligence_insights (
  id uuid primary key default gen_random_uuid(),
  insight_key text not null unique,
  insight_type text not null,
  title text not null,
  summary text not null,
  severity text not null default 'info',
  confidence integer not null default 70,
  source_tables text[] not null default '{}',
  unsupported_claim boolean not null default false,
  recommended_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cross_kindergarten_analytics_snapshots drop constraint if exists cross_kindergarten_snapshot_period_check;
alter table public.cross_kindergarten_analytics_snapshots add constraint cross_kindergarten_snapshot_period_check check (snapshot_period in ('daily','weekly','monthly','quarterly','yearly'));

alter table public.analytics_intelligence_insights drop constraint if exists analytics_insight_type_check;
alter table public.analytics_intelligence_insights add constraint analytics_insight_type_check check (insight_type in ('benchmark','trend','safety','compliance','inspection','growth','risk','observer','engagement'));

alter table public.analytics_intelligence_insights drop constraint if exists analytics_insight_severity_check;
alter table public.analytics_intelligence_insights add constraint analytics_insight_severity_check check (severity in ('info','warning','critical'));

create index if not exists cross_analytics_snapshots_period_idx on public.cross_kindergarten_analytics_snapshots(snapshot_period, snapshot_date desc);
create index if not exists kindergarten_benchmark_rank_idx on public.kindergarten_benchmark_profiles(percentile_rank desc, benchmark_date desc);
create index if not exists regional_analytics_region_idx on public.regional_analytics_snapshots(region, snapshot_date desc);
create unique index if not exists regional_analytics_unique_idx on public.regional_analytics_snapshots(snapshot_date, region, coalesce(city, ''));
create index if not exists analytics_insights_type_idx on public.analytics_intelligence_insights(insight_type, severity, updated_at desc);

alter table public.cross_kindergarten_analytics_snapshots enable row level security;
alter table public.kindergarten_benchmark_profiles enable row level security;
alter table public.regional_analytics_snapshots enable row level security;
alter table public.analytics_intelligence_insights enable row level security;

drop policy if exists "cross analytics admin only" on public.cross_kindergarten_analytics_snapshots;
create policy "cross analytics admin only" on public.cross_kindergarten_analytics_snapshots for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "benchmark profiles admin only" on public.kindergarten_benchmark_profiles;
create policy "benchmark profiles admin only" on public.kindergarten_benchmark_profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "regional analytics admin only" on public.regional_analytics_snapshots;
create policy "regional analytics admin only" on public.regional_analytics_snapshots for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "analytics insights admin only" on public.analytics_intelligence_insights;
create policy "analytics insights admin only" on public.analytics_intelligence_insights for all using (public.is_admin()) with check (public.is_admin());

insert into public.analytics_intelligence_insights (insight_key, insight_type, title, summary, severity, confidence, source_tables, recommended_action)
values
  ('privacy-aggregate-only', 'trend', 'נתוני האנליטיקה מוצגים כאגרגציה', 'שכבת האנליטיקה מיועדת להשוואות ומגמות ללא חשיפת מידע אישי של ילדים או הורים.', 'info', 95, array['gardens','kindergarten_rating_profiles'], 'להמשיך להציג נתונים ברמת גן/אזור בלבד.'),
  ('benchmarking-ready', 'benchmark', 'Benchmarking מוכן להפעלה', 'פרופילי benchmarking יכולים למדוד ממוצע ארצי, ממוצע אזורי ודירוג אחוזוני לכל גן.', 'info', 85, array['kindergarten_benchmark_profiles'], 'להפעיל job תקופתי לעדכון המדדים.')
on conflict (insight_key) do update set
  title = excluded.title,
  summary = excluded.summary,
  severity = excluded.severity,
  confidence = excluded.confidence,
  source_tables = excluded.source_tables,
  recommended_action = excluded.recommended_action,
  updated_at = now();

comment on table public.cross_kindergarten_analytics_snapshots is 'National aggregated analytics snapshots. No private child or parent details.';
comment on table public.kindergarten_benchmark_profiles is 'Aggregated kindergarten benchmark profile with national/regional comparison.';
comment on table public.regional_analytics_snapshots is 'Regional/city analytics snapshots for national command center views.';
comment on table public.analytics_intelligence_insights is 'Admin-only analytics insights. Unsupported claims must remain false and evidence-based.';
