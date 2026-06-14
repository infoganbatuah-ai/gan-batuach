-- PHASE 175: Regional Scale-Up, Operational Scaling & 50-100 Kindergarten Expansion
-- Controlled regional rollout readiness. No destructive operations.

create table if not exists public.regional_rollout_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null unique,
  cohort_name text not null,
  city text,
  region text,
  cohort_source text not null default 'city' check (cohort_source in ('city', 'region', 'sales_source', 'kindergarten_network', 'parent_demand_cluster')),
  target_kindergartens integer not null default 50 check (target_kindergartens between 50 and 100),
  start_date date,
  end_date date,
  rollout_status text not null default 'planned' check (rollout_status in ('planned', 'recruiting', 'onboarding', 'active', 'stabilizing', 'completed', 'paused')),
  owner text,
  success_criteria jsonb not null default '{}'::jsonb,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_growth_plans (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  planning_key text not null unique,
  city text not null,
  region text not null,
  total_target_kindergartens integer not null default 0,
  active_kindergartens integer not null default 0,
  leads_count integer not null default 0,
  parent_demand_requests integer not null default 0,
  demo_bookings integer not null default 0,
  conversion_rate numeric(6,2) not null default 0,
  inspector_coverage_score integer not null default 0 check (inspector_coverage_score between 0 and 100),
  support_load_score integer not null default 0 check (support_load_score between 0 and 100),
  recommended_priority text not null default 'medium' check (recommended_priority in ('low', 'medium', 'high', 'critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_onboarding_capacity (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  capacity_key text not null unique,
  kindergartens_per_week numeric(8,2) not null default 0,
  average_activation_days numeric(8,2) not null default 0,
  manager_onboarding_hours numeric(8,2) not null default 0,
  staff_onboarding_hours numeric(8,2) not null default 0,
  parent_onboarding_rate numeric(6,2) not null default 0,
  document_completion_rate numeric(6,2) not null default 0,
  payment_setup_completion_rate numeric(6,2) not null default 0,
  support_interventions_required integer not null default 0,
  capacity_status text not null default 'tracking' check (capacity_status in ('healthy', 'near_limit', 'overloaded', 'blocked', 'tracking')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_onboarding_automation_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  task_type text not null check (task_type in ('incomplete_manager_onboarding', 'staff_not_activated', 'parents_not_activated', 'missing_documents', 'payment_not_completed', 'first_inspection_not_scheduled')),
  title text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'blocked', 'deferred')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  owner text,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_support_forecasts (
  id uuid primary key default gen_random_uuid(),
  forecast_key text not null unique,
  garden_count integer not null check (garden_count in (50, 100, 250, 500)),
  tickets_per_kindergarten numeric(8,2) not null default 0,
  parent_support_volume integer not null default 0,
  manager_support_volume integer not null default 0,
  staff_support_volume integer not null default 0,
  payment_support_volume integer not null default 0,
  camera_support_volume integer not null default 0,
  avg_response_minutes integer,
  avg_resolution_minutes integer,
  onboarding_complexity_score integer not null default 0 check (onboarding_complexity_score between 0 and 100),
  active_kindergarten_count integer not null default 0,
  recommended_support_staff numeric(8,2) not null default 0,
  recommendation text not null default 'no_hire_needed' check (recommendation in ('no_hire_needed', 'part_time_support_needed', 'full_time_support_needed', 'specialist_needed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_inspector_capacity (
  id uuid primary key default gen_random_uuid(),
  forecast_key text not null unique,
  garden_count integer not null check (garden_count in (50, 100, 250, 500)),
  monthly_inspections integer not null default 0,
  average_inspection_duration_minutes integer not null default 90,
  travel_time_minutes integer not null default 45,
  followup_inspection_rate numeric(6,2) not null default 0,
  complaint_inspection_rate numeric(6,2) not null default 0,
  urgent_inspection_rate numeric(6,2) not null default 0,
  inspectors_needed numeric(8,2) not null default 0,
  overload_risk text not null default 'low' check (overload_risk in ('low', 'medium', 'high', 'critical')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_inspector_workloads (
  id uuid primary key default gen_random_uuid(),
  workload_key text not null unique,
  inspector_id uuid references public.inspectors(id) on delete set null,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  assigned_kindergartens integer not null default 0,
  monthly_inspections_due integer not null default 0,
  overdue_inspections integer not null default 0,
  followup_inspections integer not null default 0,
  complaints_requiring_visit integer not null default 0,
  overload_risk text not null default 'low' check (overload_risk in ('low', 'medium', 'high', 'critical')),
  status text not null default 'healthy' check (status in ('healthy', 'near_capacity', 'overloaded', 'blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_revenue_scale_validation (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  mrr_nis numeric(12,2) not null default 0,
  arr_nis numeric(12,2) not null default 0,
  revenue_per_kindergarten_nis numeric(12,2) not null default 0,
  average_classes_per_kindergarten numeric(8,2) not null default 0,
  discounts_used_nis numeric(12,2) not null default 0,
  failed_payments_nis numeric(12,2) not null default 0,
  overdue_accounts_count integer not null default 0,
  renewal_risk_count integer not null default 0,
  forecast_mrr_nis numeric(12,2) not null default 0,
  forecast_variance_nis numeric(12,2) not null default 0,
  status text not null default 'tracking' check (status in ('tracking', 'on_forecast', 'below_forecast', 'blocked')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.regional_unit_economics (
  id uuid primary key default gen_random_uuid(),
  economics_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  subscription_price_nis numeric(12,2) not null default 800,
  extra_class_revenue_nis numeric(12,2) not null default 0,
  discounts_nis numeric(12,2) not null default 0,
  parent_payment_processing_readiness text not null default 'readiness_only',
  inspector_cost_nis numeric(12,2) not null default 0,
  support_cost_nis numeric(12,2) not null default 0,
  infrastructure_cost_nis numeric(12,2) not null default 0,
  communication_cost_nis numeric(12,2) not null default 0,
  payment_processing_cost_nis numeric(12,2) not null default 0,
  ai_camera_cost_estimate_nis numeric(12,2) not null default 0,
  gross_margin_nis numeric(12,2) not null default 0,
  contribution_margin_nis numeric(12,2) not null default 0,
  break_even_kindergartens integer,
  status text not null default 'tracking' check (status in ('tracking', 'healthy', 'needs_review', 'negative_margin', 'blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_infrastructure_scale_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  area text not null check (area in ('vercel', 'supabase', 'database', 'storage', 'api_latency', 'deployment', 'background_jobs', 'email_sms_whatsapp', 'push', 'rls', 'audit_logs', 'event_logs')),
  metric_name text not null,
  current_value numeric(12,2),
  threshold_value numeric(12,2),
  status text not null default 'healthy' check (status in ('healthy', 'watch', 'needs_optimization', 'blocked')),
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_camera_observer_scale_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  readiness_type text not null check (readiness_type in ('camera', 'ai_observer')),
  cameras_per_kindergarten numeric(8,2) not null default 0,
  active_streams integer not null default 0,
  offline_cameras integer not null default 0,
  gateway_load_score integer not null default 0 check (gateway_load_score between 0 and 100),
  parent_viewing_sessions integer not null default 0,
  token_creation_volume integer not null default 0,
  audit_log_volume integer not null default 0,
  bandwidth_estimate_mbps numeric(12,2) not null default 0,
  observer_events integer not null default 0,
  review_queue_volume integer not null default 0,
  false_positives integer not null default 0,
  false_negatives integer not null default 0,
  reviewer_workload_score integer not null default 0 check (reviewer_workload_score between 0 and 100),
  calibration_status text not null default 'not_started',
  shadow_mode_status text not null default 'enabled',
  parent_raw_ai_blocked boolean not null default true,
  status text not null default 'readiness_only' check (status in ('readiness_only', 'tracking', 'healthy', 'needs_attention', 'blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_adoption_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  city text,
  region text,
  role_area text not null check (role_area in ('parent', 'staff', 'manager')),
  invited_count integer not null default 0,
  activated_count integer not null default 0,
  daily_active_count integer not null default 0,
  usage_metrics jsonb not null default '{}'::jsonb,
  adoption_score integer not null default 0 check (adoption_score between 0 and 100),
  status text not null default 'tracking' check (status in ('tracking', 'healthy', 'at_risk', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_churn_risk_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  signal_type text not null check (signal_type in ('low_manager_usage', 'low_parent_activation', 'repeated_support_tickets', 'failed_payments', 'incomplete_onboarding', 'unresolved_bugs', 'poor_satisfaction', 'low_staff_adoption')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  recommended_action text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'mitigated', 'accepted', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_customer_health_scores (
  id uuid primary key default gen_random_uuid(),
  score_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  customer_name text,
  usage_score integer not null default 0 check (usage_score between 0 and 100),
  payment_score integer not null default 0 check (payment_score between 0 and 100),
  support_score integer not null default 0 check (support_score between 0 and 100),
  onboarding_score integer not null default 0 check (onboarding_score between 0 and 100),
  parent_adoption_score integer not null default 0 check (parent_adoption_score between 0 and 100),
  staff_adoption_score integer not null default 0 check (staff_adoption_score between 0 and 100),
  compliance_score integer not null default 0 check (compliance_score between 0 and 100),
  inspection_score integer not null default 0 check (inspection_score between 0 and 100),
  satisfaction_score integer not null default 0 check (satisfaction_score between 0 and 100),
  customer_health_score integer not null default 0 check (customer_health_score between 0 and 100),
  status text not null default 'watch' check (status in ('healthy', 'watch', 'at_risk', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_customer_success_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  task_type text not null check (task_type in ('low_adoption_kindergarten', 'high_support_kindergarten', 'payment_risk', 'missing_onboarding', 'staff_not_activated', 'parents_not_activated', 'inspection_overdue', 'renewal_risk')),
  title text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'blocked', 'deferred')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  owner text,
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_training_content_needs (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  issue_area text not null check (issue_area in ('manager_onboarding', 'parent_onboarding', 'staff_onboarding', 'payments', 'documents', 'camera_setup', 'inspections', 'privacy')),
  repeated_issue_count integer not null default 0,
  recommended_content text not null,
  status text not null default 'needed' check (status in ('needed', 'draft', 'published', 'deferred')),
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_sales_operations_metrics (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  leads_per_week integer not null default 0,
  demos_per_week integer not null default 0,
  followups_overdue integer not null default 0,
  conversion_rate numeric(6,2) not null default 0,
  lost_reasons jsonb not null default '[]'::jsonb,
  city_demand jsonb not null default '{}'::jsonb,
  referral_performance jsonb not null default '{}'::jsonb,
  status text not null default 'tracking' check (status in ('tracking', 'healthy', 'needs_attention', 'blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.regional_parent_demand_scaling (
  id uuid primary key default gen_random_uuid(),
  demand_key text not null unique,
  city text not null,
  region text not null,
  kindergarten_name text,
  parent_requests integer not null default 0,
  referral_source text,
  parent_demand_conversion_rate numeric(6,2) not null default 0,
  high_demand_kindergarten boolean not null default false,
  recommended_outreach_priority text not null default 'medium' check (recommended_outreach_priority in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_rollout_risks (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  risk_type text not null check (risk_type in ('technical', 'support', 'payment', 'legal_privacy', 'camera', 'ai', 'inspection_capacity', 'customer_success', 'churn', 'reputation')),
  title text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  mitigation text,
  owner text,
  status text not null default 'open' check (status in ('open', 'mitigating', 'mitigated', 'accepted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_expansion_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  decision text not null check (decision in ('pause_and_stabilize', 'continue_to_250', 'expand_to_new_city', 'hire_support', 'hire_inspectors', 'optimize_infrastructure', 'adjust_pricing', 'delay_camera_ai_rollout')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  rationale text not null,
  blockers jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  status text not null default 'recommended' check (status in ('recommended', 'approved', 'rejected', 'deferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regional_scale_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  cohort_id uuid references public.regional_rollout_cohorts(id) on delete set null,
  scale_readiness_score integer not null default 0 check (scale_readiness_score between 0 and 100),
  regional_growth_score integer not null default 0 check (regional_growth_score between 0 and 100),
  onboarding_capacity_score integer not null default 0 check (onboarding_capacity_score between 0 and 100),
  support_score integer not null default 0 check (support_score between 0 and 100),
  inspector_score integer not null default 0 check (inspector_score between 0 and 100),
  revenue_score integer not null default 0 check (revenue_score between 0 and 100),
  infrastructure_score integer not null default 0 check (infrastructure_score between 0 and 100),
  adoption_score integer not null default 0 check (adoption_score between 0 and 100),
  churn_prevention_score integer not null default 0 check (churn_prevention_score between 0 and 100),
  target_kindergartens integer not null default 50,
  active_kindergartens integer not null default 0,
  launch_decision text not null default 'continue_regional_stabilization' check (launch_decision in ('not_ready', 'continue_regional_stabilization', 'pause_and_stabilize', 'continue_to_250', 'expand_to_new_city', 'hire_support', 'hire_inspectors', 'optimize_infrastructure', 'adjust_pricing', 'delay_camera_ai_rollout')),
  calculated_at timestamptz not null default now()
);

alter table public.regional_rollout_cohorts enable row level security;
alter table public.regional_growth_plans enable row level security;
alter table public.regional_onboarding_capacity enable row level security;
alter table public.regional_onboarding_automation_tasks enable row level security;
alter table public.regional_support_forecasts enable row level security;
alter table public.regional_inspector_capacity enable row level security;
alter table public.regional_inspector_workloads enable row level security;
alter table public.regional_revenue_scale_validation enable row level security;
alter table public.regional_unit_economics enable row level security;
alter table public.regional_infrastructure_scale_checks enable row level security;
alter table public.regional_camera_observer_scale_readiness enable row level security;
alter table public.regional_adoption_metrics enable row level security;
alter table public.regional_churn_risk_signals enable row level security;
alter table public.regional_customer_health_scores enable row level security;
alter table public.regional_customer_success_tasks enable row level security;
alter table public.regional_training_content_needs enable row level security;
alter table public.regional_sales_operations_metrics enable row level security;
alter table public.regional_parent_demand_scaling enable row level security;
alter table public.regional_rollout_risks enable row level security;
alter table public.regional_expansion_decisions enable row level security;
alter table public.regional_scale_readiness_scores enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'regional_rollout_cohorts',
    'regional_growth_plans',
    'regional_onboarding_capacity',
    'regional_onboarding_automation_tasks',
    'regional_support_forecasts',
    'regional_inspector_capacity',
    'regional_inspector_workloads',
    'regional_revenue_scale_validation',
    'regional_unit_economics',
    'regional_infrastructure_scale_checks',
    'regional_camera_observer_scale_readiness',
    'regional_adoption_metrics',
    'regional_churn_risk_signals',
    'regional_customer_health_scores',
    'regional_customer_success_tasks',
    'regional_training_content_needs',
    'regional_sales_operations_metrics',
    'regional_parent_demand_scaling',
    'regional_rollout_risks',
    'regional_expansion_decisions',
    'regional_scale_readiness_scores'
  ]
  loop
    execute format('drop policy if exists "%I admin manage" on public.%I', table_name, table_name);
    execute format('create policy "%I admin manage" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists idx_regional_rollout_cohorts_status on public.regional_rollout_cohorts(rollout_status);
create index if not exists idx_regional_growth_plans_region_city on public.regional_growth_plans(region, city);
create index if not exists idx_regional_onboarding_tasks_status_priority on public.regional_onboarding_automation_tasks(status, priority);
create index if not exists idx_regional_support_forecasts_garden_count on public.regional_support_forecasts(garden_count);
create index if not exists idx_regional_inspector_capacity_garden_count on public.regional_inspector_capacity(garden_count);
create index if not exists idx_regional_inspector_workloads_cohort on public.regional_inspector_workloads(cohort_id);
create index if not exists idx_regional_revenue_scale_validation_cohort on public.regional_revenue_scale_validation(cohort_id, created_at desc);
create index if not exists idx_regional_unit_economics_cohort on public.regional_unit_economics(cohort_id);
create index if not exists idx_regional_infra_scale_checks_area_status on public.regional_infrastructure_scale_checks(area, status);
create index if not exists idx_regional_camera_observer_readiness_type on public.regional_camera_observer_scale_readiness(readiness_type, status);
create index if not exists idx_regional_adoption_metrics_role on public.regional_adoption_metrics(role_area, status);
create index if not exists idx_regional_churn_risk_signals_status on public.regional_churn_risk_signals(status, severity);
create index if not exists idx_regional_customer_health_scores_status on public.regional_customer_health_scores(status, customer_health_score);
create index if not exists idx_regional_customer_success_tasks_status on public.regional_customer_success_tasks(status, priority);
create index if not exists idx_regional_parent_demand_city on public.regional_parent_demand_scaling(region, city);
create index if not exists idx_regional_rollout_risks_status on public.regional_rollout_risks(status, severity);
create index if not exists idx_regional_scale_scores_calculated on public.regional_scale_readiness_scores(calculated_at desc);

insert into public.regional_rollout_cohorts (
  cohort_key, cohort_name, city, region, cohort_source, target_kindergartens, start_date, end_date, rollout_status, owner, success_criteria, notes
) values (
  'regional-center-50-100',
  'Central Region Controlled Scale-Up',
  'Tel Aviv',
  'Center',
  'region',
  75,
  current_date + 30,
  current_date + 150,
  'planned',
  'Commercial Operations',
  '{"manager_onboarding":80,"parent_activation":70,"critical_blockers":0,"support_load":"manageable"}'::jsonb,
  'Controlled regional scale-up after the first 10-25 commercial rollout stabilizes.'
) on conflict (cohort_key) do update set
  target_kindergartens = excluded.target_kindergartens,
  rollout_status = excluded.rollout_status,
  success_criteria = excluded.success_criteria,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_growth_plans (
  cohort_id, planning_key, city, region, total_target_kindergartens, active_kindergartens, leads_count, parent_demand_requests, demo_bookings, conversion_rate, inspector_coverage_score, support_load_score, recommended_priority, metadata
) values
  ((select id from cohort), 'growth-tel-aviv-center', 'Tel Aviv', 'Center', 28, 0, 34, 140, 12, 22.50, 62, 58, 'high', '{"recommended_next_region":"Gush Dan"}'::jsonb),
  ((select id from cohort), 'growth-ramat-gan-givatayim', 'Ramat Gan / Givatayim', 'Center', 22, 0, 21, 96, 8, 19.00, 55, 52, 'high', '{"recommended_next_region":"Inner metro"}'::jsonb),
  ((select id from cohort), 'growth-sharon', 'Herzliya / Raanana', 'Sharon', 25, 0, 18, 72, 7, 17.50, 48, 46, 'medium', '{"recommended_next_region":"Sharon"}'::jsonb)
on conflict (planning_key) do update set
  leads_count = excluded.leads_count,
  parent_demand_requests = excluded.parent_demand_requests,
  demo_bookings = excluded.demo_bookings,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_onboarding_capacity (
  cohort_id, capacity_key, kindergartens_per_week, average_activation_days, manager_onboarding_hours, staff_onboarding_hours, parent_onboarding_rate, document_completion_rate, payment_setup_completion_rate, support_interventions_required, capacity_status, notes
) values (
  (select id from cohort),
  'regional-center-capacity-baseline',
  6,
  18,
  2.5,
  4,
  62,
  68,
  55,
  18,
  'near_limit',
  'Capacity is workable for a controlled 50-100 rollout only if onboarding automation and support staffing improve.'
) on conflict (capacity_key) do update set
  kindergartens_per_week = excluded.kindergartens_per_week,
  capacity_status = excluded.capacity_status,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_onboarding_automation_tasks (
  task_key, cohort_id, task_type, title, status, priority, owner, due_date
) values
  ('regional-auto-manager-incomplete', (select id from cohort), 'incomplete_manager_onboarding', 'Create automatic reminder for incomplete manager onboarding', 'open', 'high', 'Customer Success', current_date + 14),
  ('regional-auto-parent-activation', (select id from cohort), 'parents_not_activated', 'Trigger parent activation nudges by garden and city', 'open', 'high', 'Customer Success', current_date + 21),
  ('regional-auto-payment-setup', (select id from cohort), 'payment_not_completed', 'Escalate payment setup not completed after 7 days', 'open', 'medium', 'Billing Ops', current_date + 21),
  ('regional-auto-inspection-schedule', (select id from cohort), 'first_inspection_not_scheduled', 'Create first-inspection scheduling task after activation', 'open', 'medium', 'Inspection Ops', current_date + 21)
on conflict (task_key) do update set
  status = excluded.status,
  priority = excluded.priority,
  updated_at = now();

insert into public.regional_support_forecasts (
  forecast_key, garden_count, tickets_per_kindergarten, parent_support_volume, manager_support_volume, staff_support_volume, payment_support_volume, camera_support_volume, avg_response_minutes, avg_resolution_minutes, onboarding_complexity_score, active_kindergarten_count, recommended_support_staff, recommendation, notes
) values
  ('support-forecast-50', 50, 4.5, 120, 55, 40, 25, 18, 120, 1440, 54, 50, 1.5, 'part_time_support_needed', '50 gardens likely requires dedicated part-time customer support plus onboarding owner.'),
  ('support-forecast-100', 100, 4.2, 260, 110, 82, 55, 45, 120, 1440, 68, 100, 3.0, 'full_time_support_needed', '100 gardens requires full-time support coverage and payment/camera escalation paths.'),
  ('support-forecast-250', 250, 3.8, 620, 250, 190, 120, 115, 90, 1080, 78, 250, 7.5, 'specialist_needed', 'Specialists needed for onboarding, payments, camera support and parent support.'),
  ('support-forecast-500', 500, 3.5, 1250, 480, 360, 260, 240, 60, 720, 86, 500, 15.0, 'specialist_needed', 'Regional support organization required before national launch.')
on conflict (forecast_key) do update set
  recommended_support_staff = excluded.recommended_support_staff,
  recommendation = excluded.recommendation,
  updated_at = now();

insert into public.regional_inspector_capacity (
  forecast_key, garden_count, monthly_inspections, average_inspection_duration_minutes, travel_time_minutes, followup_inspection_rate, complaint_inspection_rate, urgent_inspection_rate, inspectors_needed, overload_risk, notes
) values
  ('inspector-capacity-50', 50, 50, 90, 45, 12, 6, 2, 2.6, 'medium', 'Two inspectors plus backup can cover 50 gardens with travel assumptions.'),
  ('inspector-capacity-100', 100, 100, 90, 45, 12, 6, 2, 5.2, 'high', '100 gardens requires at least five inspectors or a regional scheduling model.'),
  ('inspector-capacity-250', 250, 250, 90, 45, 12, 6, 2, 13.0, 'critical', 'Inspector hiring and route optimization required.'),
  ('inspector-capacity-500', 500, 500, 90, 45, 12, 6, 2, 26.0, 'critical', 'National operations model required before this scale.')
on conflict (forecast_key) do update set
  inspectors_needed = excluded.inspectors_needed,
  overload_risk = excluded.overload_risk,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_inspector_workloads (
  workload_key, cohort_id, assigned_kindergartens, monthly_inspections_due, overdue_inspections, followup_inspections, complaints_requiring_visit, overload_risk, status, notes
) values (
  'center-inspector-pool-baseline',
  (select id from cohort),
  0,
  75,
  0,
  9,
  4,
  'high',
  'near_capacity',
  'Inspector pool must be assigned before activating the cohort.'
) on conflict (workload_key) do update set
  monthly_inspections_due = excluded.monthly_inspections_due,
  overload_risk = excluded.overload_risk,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_revenue_scale_validation (
  snapshot_key, cohort_id, mrr_nis, arr_nis, revenue_per_kindergarten_nis, average_classes_per_kindergarten, discounts_used_nis, failed_payments_nis, overdue_accounts_count, renewal_risk_count, forecast_mrr_nis, forecast_variance_nis, status, notes
) values (
  'regional-center-revenue-baseline',
  (select id from cohort),
  0,
  0,
  1100,
  2.5,
  0,
  0,
  0,
  0,
  82500,
  -82500,
  'tracking',
  'Forecast assumes 75 gardens with average 2.5 age groups/classes at 800 + 200 NIS per extra class.'
) on conflict (snapshot_key) do update set
  forecast_mrr_nis = excluded.forecast_mrr_nis,
  forecast_variance_nis = excluded.forecast_variance_nis;

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_unit_economics (
  economics_key, cohort_id, subscription_price_nis, extra_class_revenue_nis, discounts_nis, parent_payment_processing_readiness, inspector_cost_nis, support_cost_nis, infrastructure_cost_nis, communication_cost_nis, payment_processing_cost_nis, ai_camera_cost_estimate_nis, gross_margin_nis, contribution_margin_nis, break_even_kindergartens, status, notes
) values (
  'regional-center-unit-economics-baseline',
  (select id from cohort),
  800,
  300,
  80,
  'readiness_only',
  210,
  120,
  75,
  35,
  30,
  90,
  1020,
  460,
  42,
  'needs_review',
  'Margins depend on inspector routing, camera usage and communication provider cost.'
) on conflict (economics_key) do update set
  contribution_margin_nis = excluded.contribution_margin_nis,
  status = excluded.status,
  updated_at = now();

insert into public.regional_infrastructure_scale_checks (
  check_key, area, metric_name, current_value, threshold_value, status, recommendation
) values
  ('infra-vercel-latency', 'vercel', 'regional p95 latency readiness', 0, 800, 'watch', 'Measure p95 API latency during 50-garden pilot before expanding.'),
  ('infra-supabase-query-load', 'supabase', 'Supabase query load readiness', 0, 100, 'watch', 'Track pooled connections, slow queries and RLS overhead.'),
  ('infra-db-indexes', 'database', 'missing index review', 0, 0, 'healthy', 'Continue adding safe indexes for garden_id, parent_id, status and created_at.'),
  ('infra-storage-growth', 'storage', 'storage growth estimate', 0, 100, 'watch', 'Monitor documents, invoices and camera evidence storage growth.'),
  ('infra-audit-growth', 'audit_logs', 'audit log growth', 0, 1000000, 'watch', 'Prepare retention/export strategy for audit logs before 100 gardens.'),
  ('infra-communications-volume', 'email_sms_whatsapp', 'communication volume', 0, 50000, 'watch', 'Provider rate limits must be validated before parent activation campaigns.')
on conflict (check_key) do update set
  status = excluded.status,
  recommendation = excluded.recommendation,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_camera_observer_scale_readiness (
  readiness_key, cohort_id, readiness_type, cameras_per_kindergarten, active_streams, offline_cameras, gateway_load_score, parent_viewing_sessions, token_creation_volume, audit_log_volume, bandwidth_estimate_mbps, observer_events, review_queue_volume, false_positives, false_negatives, reviewer_workload_score, calibration_status, shadow_mode_status, parent_raw_ai_blocked, status, notes
) values
  ('regional-camera-scale-readiness', (select id from cohort), 'camera', 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'not_started', 'enabled', true, 'readiness_only', 'Camera scale remains readiness-only until gateway load and legal viewing approvals are validated.'),
  ('regional-observer-scale-readiness', (select id from cohort), 'ai_observer', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'not_started', 'shadow_mode_only', true, 'readiness_only', 'Observer remains shadow-mode with human review and no parent raw AI exposure.')
on conflict (readiness_key) do update set
  parent_raw_ai_blocked = true,
  status = excluded.status,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_adoption_metrics (
  metric_key, cohort_id, city, region, role_area, invited_count, activated_count, daily_active_count, usage_metrics, adoption_score, status
) values
  ('regional-parent-adoption-center', (select id from cohort), 'Tel Aviv', 'Center', 'parent', 0, 0, 0, '{"timeline_usage":0,"message_usage":0,"notification_opens":0,"payment_usage":0}'::jsonb, 0, 'tracking'),
  ('regional-staff-adoption-center', (select id from cohort), 'Tel Aviv', 'Center', 'staff', 0, 0, 0, '{"attendance_usage":0,"child_update_completion":0,"task_completion":0}'::jsonb, 0, 'tracking'),
  ('regional-manager-adoption-center', (select id from cohort), 'Tel Aviv', 'Center', 'manager', 0, 0, 0, '{"command_center_usage":0,"payment_setup":0,"compliance_actions":0}'::jsonb, 0, 'tracking')
on conflict (metric_key) do update set
  usage_metrics = excluded.usage_metrics,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_churn_risk_signals (
  signal_key, cohort_id, signal_type, severity, recommended_action, status
) values
  ('regional-churn-low-parent-activation', (select id from cohort), 'low_parent_activation', 'high', 'Create city-level parent activation playbook before cohort activation.', 'open'),
  ('regional-churn-repeated-support', (select id from cohort), 'repeated_support_tickets', 'medium', 'Build training content for repeated onboarding and payment questions.', 'open'),
  ('regional-churn-failed-payments', (select id from cohort), 'failed_payments', 'medium', 'Validate billing reminders and grace-period workflow at 50 gardens.', 'open')
on conflict (signal_key) do update set
  recommended_action = excluded.recommended_action,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_customer_health_scores (
  score_key, cohort_id, customer_name, usage_score, payment_score, support_score, onboarding_score, parent_adoption_score, staff_adoption_score, compliance_score, inspection_score, satisfaction_score, customer_health_score, status
) values (
  'regional-health-score-baseline',
  (select id from cohort),
  'Regional baseline',
  0,
  0,
  55,
  45,
  0,
  0,
  60,
  52,
  0,
  43,
  'watch'
) on conflict (score_key) do update set
  customer_health_score = excluded.customer_health_score,
  status = excluded.status,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_customer_success_tasks (
  task_key, cohort_id, task_type, title, status, priority, owner, due_date
) values
  ('regional-cs-low-adoption-playbook', (select id from cohort), 'low_adoption_kindergarten', 'Prepare low-adoption rescue playbook for regional cohorts', 'open', 'high', 'Customer Success', current_date + 21),
  ('regional-cs-payment-risk', (select id from cohort), 'payment_risk', 'Create payment-risk escalation workflow for 50-100 gardens', 'open', 'medium', 'Billing Ops', current_date + 21),
  ('regional-cs-inspection-overdue', (select id from cohort), 'inspection_overdue', 'Prepare regional inspection overdue escalation tasks', 'open', 'medium', 'Inspection Ops', current_date + 28)
on conflict (task_key) do update set
  status = excluded.status,
  updated_at = now();

insert into public.regional_training_content_needs (
  content_key, issue_area, repeated_issue_count, recommended_content, status, owner
) values
  ('training-manager-regional-onboarding', 'manager_onboarding', 0, 'Create short manager onboarding guide for first 7 days.', 'needed', 'Customer Success'),
  ('training-parent-activation', 'parent_onboarding', 0, 'Create parent activation explanation sheet with privacy boundaries.', 'needed', 'Customer Success'),
  ('training-payment-setup', 'payments', 0, 'Create manager payment setup walkthrough and FAQ.', 'needed', 'Billing Ops'),
  ('training-inspection-regional', 'inspections', 0, 'Create regional inspection scheduling guide for managers and inspectors.', 'needed', 'Inspection Ops')
on conflict (content_key) do update set
  recommended_content = excluded.recommended_content,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_sales_operations_metrics (
  snapshot_key, cohort_id, leads_per_week, demos_per_week, followups_overdue, conversion_rate, lost_reasons, city_demand, referral_performance, status
) values (
  'regional-sales-center-baseline',
  (select id from cohort),
  18,
  7,
  4,
  18.5,
  '["privacy concern","camera concern","price objection"]'::jsonb,
  '{"Tel Aviv":140,"Ramat Gan":96,"Herzliya":72}'::jsonb,
  '{"parent_demand":"strong","referral":"early"}'::jsonb,
  'tracking'
) on conflict (snapshot_key) do update set
  leads_per_week = excluded.leads_per_week;

insert into public.regional_parent_demand_scaling (
  demand_key, city, region, kindergarten_name, parent_requests, referral_source, parent_demand_conversion_rate, high_demand_kindergarten, recommended_outreach_priority
) values
  ('demand-tel-aviv-cluster', 'Tel Aviv', 'Center', null, 140, 'parent_demand', 12.5, true, 'high'),
  ('demand-ramat-gan-cluster', 'Ramat Gan / Givatayim', 'Center', null, 96, 'parent_demand', 10.2, true, 'high'),
  ('demand-sharon-cluster', 'Herzliya / Raanana', 'Sharon', null, 72, 'referral', 8.4, false, 'medium')
on conflict (demand_key) do update set
  parent_requests = excluded.parent_requests,
  recommended_outreach_priority = excluded.recommended_outreach_priority,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_rollout_risks (
  risk_key, cohort_id, risk_type, title, severity, mitigation, owner, status
) values
  ('regional-risk-support-load', (select id from cohort), 'support', 'Support load may exceed current owner capacity at 100 gardens', 'high', 'Hire or assign full-time support before 100 active gardens.', 'Operations', 'open'),
  ('regional-risk-inspector-capacity', (select id from cohort), 'inspection_capacity', 'Monthly inspection capacity is not assigned for 75 gardens', 'high', 'Assign inspector pool and route schedule before cohort activation.', 'Inspection Ops', 'open'),
  ('regional-risk-camera-scale', (select id from cohort), 'camera', 'Camera bandwidth and gateway capacity not validated for 50-100 gardens', 'medium', 'Keep camera rollout readiness-only until gateway load test is complete.', 'Camera Ops', 'mitigating'),
  ('regional-risk-ai-review-load', (select id from cohort), 'ai', 'Observer review queue may grow faster than reviewer capacity', 'medium', 'Keep observer in shadow mode and monitor review completion rate.', 'AI Governance', 'mitigating')
on conflict (risk_key) do update set
  severity = excluded.severity,
  mitigation = excluded.mitigation,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_expansion_decisions (
  decision_key, cohort_id, decision, readiness_score, rationale, blockers, next_actions, status
) values (
  'regional-center-expansion-decision-baseline',
  (select id from cohort),
  'pause_and_stabilize',
  59,
  'Regional scale-up is planned, but support staffing, inspector capacity, payment validation and infrastructure monitoring must mature before moving beyond the first cohort.',
  '["support staffing not assigned","inspector pool not finalized","camera scale not load-tested","parent activation not yet measured"]'::jsonb,
  '["complete first commercial rollout","assign regional support owner","hire/assign inspector capacity","validate payment provider load","keep camera and AI in readiness or shadow mode"]'::jsonb,
  'recommended'
) on conflict (decision_key) do update set
  readiness_score = excluded.readiness_score,
  rationale = excluded.rationale,
  updated_at = now();

with cohort as (
  select id from public.regional_rollout_cohorts where cohort_key = 'regional-center-50-100'
)
insert into public.regional_scale_readiness_scores (
  snapshot_key, cohort_id, scale_readiness_score, regional_growth_score, onboarding_capacity_score, support_score, inspector_score, revenue_score, infrastructure_score, adoption_score, churn_prevention_score, target_kindergartens, active_kindergartens, launch_decision
) values (
  'regional-center-readiness-baseline',
  (select id from cohort),
  59,
  68,
  58,
  52,
  48,
  55,
  61,
  0,
  54,
  75,
  0,
  'continue_regional_stabilization'
) on conflict (snapshot_key) do update set
  scale_readiness_score = excluded.scale_readiness_score,
  launch_decision = excluded.launch_decision,
  calculated_at = now();
