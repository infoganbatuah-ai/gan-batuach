-- PHASE 185: Gan Batuach 100 Kindergarten Scale Program
-- Controlled 100-kindergarten readiness program. No destructive operations.

create table if not exists public.kindergarten_scale_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null unique,
  cohort_name text not null,
  target_kindergarten_count integer not null default 25 check (target_kindergarten_count between 1 and 100),
  region text,
  city text,
  start_date date,
  end_date date,
  owner text,
  status text not null default 'planned' check (status in ('planned', 'recruiting', 'onboarding', 'active', 'stabilizing', 'completed', 'paused')),
  success_criteria jsonb not null default '{}'::jsonb,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kindergarten_scale_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null unique,
  cohort_id uuid references public.kindergarten_scale_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  kindergarten_name text not null,
  source text not null default 'manual_admin' check (source in ('demo_booking', 'kindergarten_registration', 'parent_demand_request', 'referral', 'manual_admin', 'sales_outreach')),
  city text,
  region text,
  manager_name text,
  age_groups_count integer not null default 1,
  subscription_amount_nis numeric(12,2) not null default 800,
  payment_status text not null default 'not_configured',
  onboarding_status text not null default 'not_started',
  parent_activation_percent numeric(6,2) not null default 0,
  staff_activation_percent numeric(6,2) not null default 0,
  document_status text not null default 'not_started',
  inspection_status text not null default 'not_scheduled',
  support_status text not null default 'normal',
  churn_risk text not null default 'low' check (churn_risk in ('low', 'medium', 'high', 'critical')),
  customer_health_score integer not null default 0 check (customer_health_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_onboarding_metrics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null unique,
  cohort_id uuid references public.kindergarten_scale_cohorts(id) on delete set null,
  average_kindergarten_activation_days numeric(8,2) not null default 0,
  average_staff_invite_hours numeric(8,2) not null default 0,
  average_parent_activation_days numeric(8,2) not null default 0,
  average_document_completion_days numeric(8,2) not null default 0,
  average_payment_completion_days numeric(8,2) not null default 0,
  support_touches_per_kindergarten numeric(8,2) not null default 0,
  blocked_onboarding_count integer not null default 0,
  capacity_status text not null default 'tracking' check (capacity_status in ('healthy', 'near_limit', 'overloaded', 'blocked', 'tracking')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_automation_tasks (
  id uuid primary key default gen_random_uuid(),
  task_key text not null unique,
  cohort_id uuid references public.kindergarten_scale_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  task_type text not null check (task_type in ('manager_onboarding_incomplete', 'missing_documents', 'staff_not_activated', 'parents_not_activated', 'payment_not_completed', 'pricing_not_configured', 'first_inspection_not_scheduled', 'training_not_completed')),
  channel_readiness jsonb not null default '{"in_app":true,"email":true,"sms_readiness":true,"whatsapp_readiness":true}'::jsonb,
  title text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'blocked', 'deferred')),
  owner text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_adoption_targets (
  id uuid primary key default gen_random_uuid(),
  target_key text not null unique,
  cohort_id uuid references public.kindergarten_scale_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  role_area text not null check (role_area in ('parent', 'staff', 'manager')),
  invited_count integer not null default 0,
  activated_count integer not null default 0,
  completed_registration_count integer not null default 0,
  login_rate_percent numeric(6,2) not null default 0,
  message_read_rate_percent numeric(6,2) not null default 0,
  notification_opt_in_percent numeric(6,2) not null default 0,
  payment_approval_rate_percent numeric(6,2) not null default 0,
  daily_usage_count integer not null default 0,
  adoption_score integer not null default 0 check (adoption_score between 0 and 100),
  threshold_status text not null default 'tracking' check (threshold_status in ('healthy', 'needs_attention', 'at_risk', 'critical', 'tracking')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_support_capacity (
  id uuid primary key default gen_random_uuid(),
  forecast_key text not null unique,
  kindergarten_count integer not null check (kindergarten_count in (25, 50, 100, 250)),
  tickets_per_kindergarten numeric(8,2) not null default 0,
  tickets_per_parent numeric(8,2) not null default 0,
  tickets_per_staff_member numeric(8,2) not null default 0,
  avg_response_minutes integer,
  avg_resolution_minutes integer,
  repeated_issue_categories jsonb not null default '[]'::jsonb,
  unresolved_critical_tickets integer not null default 0,
  overloaded_support_days integer not null default 0,
  recommended_staffing text not null default 'no_additional_support_needed' check (recommended_staffing in ('no_additional_support_needed', 'part_time_support_needed', 'full_time_support_needed', 'dedicated_onboarding_specialist_needed', 'technical_support_specialist_needed')),
  support_staff_needed numeric(8,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_inspector_capacity (
  id uuid primary key default gen_random_uuid(),
  forecast_key text not null unique,
  kindergarten_count integer not null check (kindergarten_count in (25, 50, 100, 250, 500)),
  monthly_inspections_required integer not null default 0,
  inspections_completed_this_month integer not null default 0,
  overdue_inspections integer not null default 0,
  followup_inspections integer not null default 0,
  complaint_driven_inspections integer not null default 0,
  average_inspection_duration_minutes integer not null default 90,
  travel_time_minutes integer not null default 45,
  admin_reporting_minutes integer not null default 30,
  gps_validation_completion_percent numeric(6,2) not null default 0,
  signature_completion_percent numeric(6,2) not null default 0,
  inspectors_needed numeric(8,2) not null default 0,
  overload_risk text not null default 'low' check (overload_risk in ('low', 'medium', 'high', 'critical')),
  recommended_hiring_point text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_revenue_unit_economics (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  cohort_id uuid references public.kindergarten_scale_cohorts(id) on delete set null,
  mrr_nis numeric(12,2) not null default 0,
  arr_nis numeric(12,2) not null default 0,
  collected_revenue_nis numeric(12,2) not null default 0,
  projected_revenue_nis numeric(12,2) not null default 0,
  failed_payments_nis numeric(12,2) not null default 0,
  overdue_payments_nis numeric(12,2) not null default 0,
  discounts_used_nis numeric(12,2) not null default 0,
  average_revenue_per_kindergarten_nis numeric(12,2) not null default 0,
  support_cost_nis numeric(12,2) not null default 0,
  inspector_cost_nis numeric(12,2) not null default 0,
  infrastructure_cost_nis numeric(12,2) not null default 0,
  communication_cost_nis numeric(12,2) not null default 0,
  payment_processing_cost_nis numeric(12,2) not null default 0,
  invoice_cost_nis numeric(12,2) not null default 0,
  camera_ai_cost_estimate_nis numeric(12,2) not null default 0,
  onboarding_cost_nis numeric(12,2) not null default 0,
  gross_margin_nis numeric(12,2) not null default 0,
  contribution_margin_nis numeric(12,2) not null default 0,
  break_even_kindergartens integer,
  profitability_by_cohort jsonb not null default '{}'::jsonb,
  status text not null default 'tracking' check (status in ('tracking', 'healthy', 'needs_review', 'negative_margin', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_payment_health (
  id uuid primary key default gen_random_uuid(),
  health_key text not null unique,
  cohort_id uuid references public.kindergarten_scale_cohorts(id) on delete set null,
  successful_payments integer not null default 0,
  failed_payments integer not null default 0,
  grace_period_accounts integer not null default 0,
  debt_accumulated_nis numeric(12,2) not null default 0,
  suspended_kindergartens integer not null default 0,
  renewal_reminders_due integer not null default 0,
  invoices_generated integer not null default 0,
  invoices_delivered integer not null default 0,
  parent_payment_setup_kindergartens integer not null default 0,
  unpaid_parent_balances_nis numeric(12,2) not null default 0,
  status text not null default 'tracking' check (status in ('healthy', 'tracking', 'needs_attention', 'at_risk', 'blocked')),
  alert_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_infrastructure_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  area text not null check (area in ('vercel', 'supabase', 'api_latency', 'database_load', 'storage', 'auth', 'realtime', 'build_health', 'background_jobs', 'provider_health', 'database_scale', 'communications_volume', 'camera_scale', 'ai_observer_scale')),
  metric_name text not null,
  current_value numeric(14,2),
  threshold_value numeric(14,2),
  readiness_status text not null default 'watch' check (readiness_status in ('healthy', 'watch', 'needs_optimization', 'blocked', 'readiness_only')),
  recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_privacy_security_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  area text not null check (area in ('mfa', 'sensitive_action_mfa', 'audit_coverage', 'medical_encryption', 'private_documents', 'camera_access_logs', 'parent_isolation', 'staff_isolation', 'inspector_scope', 'admin_audit', 'rls', 'service_role')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high', 'critical')),
  status text not null default 'tracking' check (status in ('healthy', 'tracking', 'needs_review', 'blocked')),
  alert_rule text,
  recommendation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_customer_health (
  id uuid primary key default gen_random_uuid(),
  score_key text not null unique,
  cohort_id uuid references public.kindergarten_scale_cohorts(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  customer_name text,
  manager_usage_score integer not null default 0 check (manager_usage_score between 0 and 100),
  parent_activation_score integer not null default 0 check (parent_activation_score between 0 and 100),
  staff_activation_score integer not null default 0 check (staff_activation_score between 0 and 100),
  payment_score integer not null default 0 check (payment_score between 0 and 100),
  support_score integer not null default 0 check (support_score between 0 and 100),
  document_score integer not null default 0 check (document_score between 0 and 100),
  inspection_score integer not null default 0 check (inspection_score between 0 and 100),
  compliance_score integer not null default 0 check (compliance_score between 0 and 100),
  satisfaction_score integer not null default 0 check (satisfaction_score between 0 and 100),
  customer_health_score integer not null default 0 check (customer_health_score between 0 and 100),
  health_status text not null default 'needs_attention' check (health_status in ('healthy', 'needs_attention', 'at_risk', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_churn_risk_signals (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null unique,
  garden_id uuid references public.gardens(id) on delete set null,
  signal_type text not null check (signal_type in ('low_usage', 'failed_payments', 'unresolved_tickets', 'low_parent_activation', 'staff_not_using_system', 'manager_not_logging_in', 'repeated_complaints', 'poor_onboarding', 'missing_value_realization')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  recommended_action text not null check (recommended_action in ('call_manager', 'schedule_training', 'offer_onboarding_help', 'review_payment_issue', 'resolve_support_blocker')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'mitigated', 'accepted_risk', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_training_knowledge (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  item_type text not null check (item_type in ('training_module', 'knowledge_base_article')),
  category text not null check (category in ('registration', 'login', 'payments', 'documents', 'staff_onboarding', 'parent_onboarding', 'manager_onboarding', 'camera_setup', 'notifications', 'inspections', 'privacy_security', 'daily_operations')),
  title text not null,
  completion_rate_percent numeric(6,2) not null default 0,
  article_views integer not null default 0,
  support_deflection_percent numeric(6,2) not null default 0,
  issue_reduction_percent numeric(6,2) not null default 0,
  status text not null default 'needed' check (status in ('needed', 'draft', 'published', 'measuring', 'deferred')),
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_sales_insights (
  id uuid primary key default gen_random_uuid(),
  insight_key text not null unique,
  city text,
  region text,
  leads_count integer not null default 0,
  parent_demand_count integer not null default 0,
  demo_conversion_percent numeric(6,2) not null default 0,
  sales_objections jsonb not null default '[]'::jsonb,
  lost_reasons jsonb not null default '[]'::jsonb,
  referral_sources jsonb not null default '{}'::jsonb,
  high_demand_kindergartens jsonb not null default '[]'::jsonb,
  competitor_mentions jsonb not null default '[]'::jsonb,
  recommended_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_risk_register (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  category text not null check (category in ('technical', 'support', 'inspection', 'payment', 'legal_privacy', 'security', 'camera', 'ai', 'onboarding', 'customer_success', 'reputation')),
  risk text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  mitigation text,
  owner text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'mitigated', 'accepted_risk', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_success_criteria (
  id uuid primary key default gen_random_uuid(),
  criteria_key text not null unique,
  metric_name text not null,
  target_value numeric(10,2) not null,
  current_value numeric(10,2) not null default 0,
  status text not null default 'not_met' check (status in ('not_met', 'tracking', 'met', 'blocked')),
  required boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_expansion_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  decision text not null check (decision in ('pause_and_stabilize', 'continue_to_250_kindergartens', 'expand_to_another_region', 'hire_inspectors', 'hire_support', 'improve_onboarding_automation', 'adjust_pricing', 'delay_camera_rollout', 'delay_ai_rollout', 'strengthen_infrastructure')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  rationale text not null,
  blockers jsonb not null default '[]'::jsonb,
  next_actions jsonb not null default '[]'::jsonb,
  status text not null default 'recommended' check (status in ('recommended', 'approved', 'rejected', 'deferred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scale_100_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  scale_readiness_score integer not null default 0 check (scale_readiness_score between 0 and 100),
  active_kindergartens integer not null default 0,
  onboarding_kindergartens integer not null default 0,
  paid_kindergartens integer not null default 0,
  suspended_kindergartens integer not null default 0,
  support_score integer not null default 0 check (support_score between 0 and 100),
  inspector_score integer not null default 0 check (inspector_score between 0 and 100),
  parent_activation_score integer not null default 0 check (parent_activation_score between 0 and 100),
  staff_activation_score integer not null default 0 check (staff_activation_score between 0 and 100),
  payment_health_score integer not null default 0 check (payment_health_score between 0 and 100),
  infrastructure_health_score integer not null default 0 check (infrastructure_health_score between 0 and 100),
  privacy_security_score integer not null default 0 check (privacy_security_score between 0 and 100),
  critical_blockers integer not null default 0,
  launch_decision text not null default 'pause_and_stabilize',
  calculated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'kindergarten_scale_cohorts',
    'kindergarten_scale_profiles',
    'scale_100_onboarding_metrics',
    'scale_100_automation_tasks',
    'scale_100_adoption_targets',
    'scale_100_support_capacity',
    'scale_100_inspector_capacity',
    'scale_100_revenue_unit_economics',
    'scale_100_payment_health',
    'scale_100_infrastructure_checks',
    'scale_100_privacy_security_checks',
    'scale_100_customer_health',
    'scale_100_churn_risk_signals',
    'scale_100_training_knowledge',
    'scale_100_sales_insights',
    'scale_100_risk_register',
    'scale_100_success_criteria',
    'scale_100_expansion_decisions',
    'scale_100_readiness_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%I admin manage" on public.%I', table_name, table_name);
    execute format('create policy "%I admin manage" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists idx_kindergarten_scale_cohorts_status on public.kindergarten_scale_cohorts(status);
create index if not exists idx_kindergarten_scale_profiles_cohort on public.kindergarten_scale_profiles(cohort_id, churn_risk);
create index if not exists idx_scale_100_automation_tasks_status on public.scale_100_automation_tasks(status, priority);
create index if not exists idx_scale_100_adoption_targets_role on public.scale_100_adoption_targets(role_area, threshold_status);
create index if not exists idx_scale_100_support_capacity_count on public.scale_100_support_capacity(kindergarten_count);
create index if not exists idx_scale_100_inspector_capacity_count on public.scale_100_inspector_capacity(kindergarten_count);
create index if not exists idx_scale_100_infra_area_status on public.scale_100_infrastructure_checks(area, readiness_status);
create index if not exists idx_scale_100_security_area_status on public.scale_100_privacy_security_checks(area, status);
create index if not exists idx_scale_100_customer_health_status on public.scale_100_customer_health(health_status, customer_health_score);
create index if not exists idx_scale_100_churn_status on public.scale_100_churn_risk_signals(status, severity);
create index if not exists idx_scale_100_risk_status on public.scale_100_risk_register(status, severity);
create index if not exists idx_scale_100_readiness_calculated on public.scale_100_readiness_scores(calculated_at desc);

insert into public.kindergarten_scale_cohorts (
  cohort_key, cohort_name, target_kindergarten_count, region, city, start_date, end_date, owner, status, success_criteria, notes
) values
  ('scale-100-first-25', 'First 25 Stabilization Cohort', 25, 'Center', 'Tel Aviv', current_date + 14, current_date + 75, 'Commercial Operations', 'planned', '{"manager_onboarding":85,"parent_activation":70,"staff_activation":80,"billing_configuration":95,"critical_security_incidents":0}'::jsonb, 'First controlled scale cohort after the initial commercial rollout stabilizes.'),
  ('scale-100-next-25', 'Next 25 Operating Cohort', 25, 'Center / Sharon', 'Gush Dan', current_date + 75, current_date + 135, 'Customer Success', 'planned', '{"support_load":"within_forecast","inspection_coverage":100,"positive_unit_economics":true}'::jsonb, 'Second cohort validates repeatable onboarding and support load.'),
  ('scale-100-next-50', 'Next 50 Expansion Cohort', 50, 'Selected Region', 'TBD', current_date + 135, current_date + 240, 'Scale Program Owner', 'planned', '{"total_target":100,"privacy_security_incidents":0,"churn_risk":"manageable"}'::jsonb, 'Final step to reach the 100-kindergarten readiness program.')
on conflict (cohort_key) do update set
  target_kindergarten_count = excluded.target_kindergarten_count,
  status = excluded.status,
  success_criteria = excluded.success_criteria,
  updated_at = now();

with first_cohort as (
  select id from public.kindergarten_scale_cohorts where cohort_key = 'scale-100-first-25'
)
insert into public.kindergarten_scale_profiles (
  profile_key, cohort_id, kindergarten_name, source, city, region, manager_name, age_groups_count, subscription_amount_nis, payment_status, onboarding_status, parent_activation_percent, staff_activation_percent, document_status, inspection_status, support_status, churn_risk, customer_health_score
) values
  ('scale-profile-demo-garden-01', (select id from first_cohort), 'Scale Readiness Garden A', 'demo_booking', 'Tel Aviv', 'Center', 'Manager TBD', 2, 1000, 'not_configured', 'not_started', 0, 0, 'not_started', 'not_scheduled', 'normal', 'medium', 52),
  ('scale-profile-demand-garden-02', (select id from first_cohort), 'Parent Demand Garden B', 'parent_demand_request', 'Ramat Gan', 'Center', 'Manager TBD', 3, 1200, 'not_configured', 'not_started', 0, 0, 'not_started', 'not_scheduled', 'normal', 'medium', 49)
on conflict (profile_key) do update set
  subscription_amount_nis = excluded.subscription_amount_nis,
  churn_risk = excluded.churn_risk,
  customer_health_score = excluded.customer_health_score,
  updated_at = now();

with first_cohort as (
  select id from public.kindergarten_scale_cohorts where cohort_key = 'scale-100-first-25'
)
insert into public.scale_100_onboarding_metrics (
  metric_key, cohort_id, average_kindergarten_activation_days, average_staff_invite_hours, average_parent_activation_days, average_document_completion_days, average_payment_completion_days, support_touches_per_kindergarten, blocked_onboarding_count, capacity_status, notes
) values (
  'scale-100-onboarding-baseline',
  (select id from first_cohort),
  16,
  36,
  12,
  10,
  7,
  4.8,
  0,
  'near_limit',
  'Manual onboarding must fall below five support touches per kindergarten before expanding beyond 100.'
) on conflict (metric_key) do update set
  capacity_status = excluded.capacity_status,
  support_touches_per_kindergarten = excluded.support_touches_per_kindergarten,
  updated_at = now();

with first_cohort as (
  select id from public.kindergarten_scale_cohorts where cohort_key = 'scale-100-first-25'
)
insert into public.scale_100_automation_tasks (
  task_key, cohort_id, task_type, title, priority, status, owner, due_date
) values
  ('scale100-auto-manager-onboarding', (select id from first_cohort), 'manager_onboarding_incomplete', 'Send manager onboarding reminder after 48 hours', 'high', 'open', 'Customer Success', current_date + 14),
  ('scale100-auto-missing-documents', (select id from first_cohort), 'missing_documents', 'Escalate missing documents by cohort and garden', 'high', 'open', 'Operations', current_date + 18),
  ('scale100-auto-parent-activation', (select id from first_cohort), 'parents_not_activated', 'Trigger parent activation nudges under 70%', 'high', 'open', 'Customer Success', current_date + 21),
  ('scale100-auto-first-inspection', (select id from first_cohort), 'first_inspection_not_scheduled', 'Create first inspection scheduling task after activation', 'medium', 'open', 'Inspection Ops', current_date + 21)
on conflict (task_key) do update set
  priority = excluded.priority,
  status = excluded.status,
  updated_at = now();

with first_cohort as (
  select id from public.kindergarten_scale_cohorts where cohort_key = 'scale-100-first-25'
)
insert into public.scale_100_adoption_targets (
  target_key, cohort_id, role_area, invited_count, activated_count, completed_registration_count, login_rate_percent, message_read_rate_percent, notification_opt_in_percent, payment_approval_rate_percent, daily_usage_count, adoption_score, threshold_status, metadata
) values
  ('scale100-parent-target-baseline', (select id from first_cohort), 'parent', 0, 0, 0, 0, 0, 0, 0, 0, 58, 'at_risk', '{"minimum":70,"healthy":80,"excellent":90,"tracked":"child registration, messages, payments, notifications, timeline"}'::jsonb),
  ('scale100-staff-target-baseline', (select id from first_cohort), 'staff', 0, 0, 0, 0, 0, 0, 0, 0, 62, 'needs_attention', '{"minimum":80,"tracked":"documents, attendance, tasks, child updates, incident readiness"}'::jsonb),
  ('scale100-manager-target-baseline', (select id from first_cohort), 'manager', 0, 0, 0, 0, 0, 0, 0, 0, 67, 'needs_attention', '{"tracked":"command center, children, staff, parent communication, payments, compliance, inspections"}'::jsonb)
on conflict (target_key) do update set
  adoption_score = excluded.adoption_score,
  threshold_status = excluded.threshold_status,
  updated_at = now();

insert into public.scale_100_support_capacity (
  forecast_key, kindergarten_count, tickets_per_kindergarten, tickets_per_parent, tickets_per_staff_member, avg_response_minutes, avg_resolution_minutes, repeated_issue_categories, unresolved_critical_tickets, overloaded_support_days, recommended_staffing, support_staff_needed, notes
) values
  ('scale100-support-25', 25, 4.8, 0.08, 0.18, 180, 1440, '["parent onboarding","login","documents"]'::jsonb, 0, 0, 'part_time_support_needed', 1.0, 'First 25 requires dedicated part-time support during onboarding weeks.'),
  ('scale100-support-50', 50, 4.4, 0.07, 0.16, 150, 1320, '["payments","parent onboarding","staff onboarding"]'::jsonb, 0, 1, 'full_time_support_needed', 2.0, 'At 50 gardens, support cannot remain founder-led.'),
  ('scale100-support-100', 100, 4.0, 0.06, 0.14, 120, 1080, '["payments","documents","camera setup","notifications"]'::jsonb, 0, 3, 'dedicated_onboarding_specialist_needed', 4.0, '100 gardens needs full-time support plus onboarding specialist and technical escalation.'),
  ('scale100-support-250', 250, 3.7, 0.05, 0.12, 90, 900, '["camera setup","payment issues","parent support"]'::jsonb, 0, 8, 'technical_support_specialist_needed', 9.0, 'Beyond 100 requires support organization, not ad hoc handling.')
on conflict (forecast_key) do update set
  recommended_staffing = excluded.recommended_staffing,
  support_staff_needed = excluded.support_staff_needed,
  updated_at = now();

insert into public.scale_100_inspector_capacity (
  forecast_key, kindergarten_count, monthly_inspections_required, inspections_completed_this_month, overdue_inspections, followup_inspections, complaint_driven_inspections, average_inspection_duration_minutes, travel_time_minutes, admin_reporting_minutes, gps_validation_completion_percent, signature_completion_percent, inspectors_needed, overload_risk, recommended_hiring_point
) values
  ('scale100-inspectors-25', 25, 25, 0, 0, 3, 2, 90, 45, 30, 0, 0, 1.4, 'medium', 'Assign at least two inspector days per week before first cohort.'),
  ('scale100-inspectors-50', 50, 50, 0, 0, 6, 3, 90, 45, 30, 0, 0, 2.8, 'medium', 'Hire or contract additional inspector capacity before 50 active gardens.'),
  ('scale100-inspectors-100', 100, 100, 0, 0, 12, 6, 90, 45, 30, 0, 0, 5.6, 'high', '100 gardens needs at least six inspectors or route-optimized regional scheduling.'),
  ('scale100-inspectors-250', 250, 250, 0, 0, 30, 15, 90, 45, 30, 0, 0, 14.0, 'critical', 'Do not expand to 250 without inspection operations team.'),
  ('scale100-inspectors-500', 500, 500, 0, 0, 60, 30, 90, 45, 30, 0, 0, 28.0, 'critical', 'National inspection organization required.')
on conflict (forecast_key) do update set
  inspectors_needed = excluded.inspectors_needed,
  overload_risk = excluded.overload_risk,
  updated_at = now();

with first_cohort as (
  select id from public.kindergarten_scale_cohorts where cohort_key = 'scale-100-first-25'
)
insert into public.scale_100_revenue_unit_economics (
  snapshot_key, cohort_id, mrr_nis, arr_nis, collected_revenue_nis, projected_revenue_nis, failed_payments_nis, overdue_payments_nis, discounts_used_nis, average_revenue_per_kindergarten_nis, support_cost_nis, inspector_cost_nis, infrastructure_cost_nis, communication_cost_nis, payment_processing_cost_nis, invoice_cost_nis, camera_ai_cost_estimate_nis, onboarding_cost_nis, gross_margin_nis, contribution_margin_nis, break_even_kindergartens, profitability_by_cohort, status
) values (
  'scale100-revenue-unit-economics-baseline',
  (select id from first_cohort),
  0,
  0,
  0,
  110000,
  0,
  0,
  0,
  1100,
  140,
  240,
  80,
  35,
  30,
  12,
  90,
  160,
  1020,
  313,
  58,
  '{"first_25":"validation","next_25":"repeatability","next_50":"scale pressure"}'::jsonb,
  'needs_review'
) on conflict (snapshot_key) do update set
  projected_revenue_nis = excluded.projected_revenue_nis,
  contribution_margin_nis = excluded.contribution_margin_nis,
  updated_at = now();

with first_cohort as (
  select id from public.kindergarten_scale_cohorts where cohort_key = 'scale-100-first-25'
)
insert into public.scale_100_payment_health (
  health_key, cohort_id, successful_payments, failed_payments, grace_period_accounts, debt_accumulated_nis, suspended_kindergartens, renewal_reminders_due, invoices_generated, invoices_delivered, parent_payment_setup_kindergartens, unpaid_parent_balances_nis, status, alert_notes
) values (
  'scale100-payment-health-baseline',
  (select id from first_cohort),
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  'tracking',
  'Gan Batuach subscription billing stays separate from parent-to-kindergarten tuition payments.'
) on conflict (health_key) do update set
  status = excluded.status,
  updated_at = now();

insert into public.scale_100_infrastructure_checks (
  check_key, area, metric_name, current_value, threshold_value, readiness_status, recommendation, metadata
) values
  ('scale100-vercel-p95', 'vercel', 'p95 route latency readiness', 0, 800, 'watch', 'Measure production p95 latency during the first 25 before moving to the next cohort.', '{}'::jsonb),
  ('scale100-supabase-load', 'supabase', 'pooled connection and query load', 0, 100, 'watch', 'Track pooled connections, slow queries and RLS overhead before 100 active gardens.', '{}'::jsonb),
  ('scale100-db-indexes', 'database_scale', 'missing index and slow query watchlist', 0, 0, 'watch', 'Review database integrity center for garden_id, child_id, parent_id, status and created_at indexes.', '{}'::jsonb),
  ('scale100-audit-growth', 'database_scale', 'audit and notification log growth', 0, 1000000, 'watch', 'Prepare archive/pagination strategy before audit and notification logs grow sharply.', '{}'::jsonb),
  ('scale100-comms-volume', 'communications_volume', 'monthly communications cost estimate', 0, 100, 'readiness_only', 'Estimate email/SMS/WhatsApp/push volume per 100 kindergartens before production sending.', '{"channels":["email","sms","whatsapp","push","in_app"]}'::jsonb),
  ('scale100-camera-scale', 'camera_scale', 'camera gateway readiness', 0, 100, 'readiness_only', 'Keep cameras readiness-only unless gateway load and support workflows are proven.', '{}'::jsonb),
  ('scale100-ai-observer-scale', 'ai_observer_scale', 'observer review queue readiness', 0, 100, 'readiness_only', 'AI Observer remains shadow mode with no raw parent visibility and human review required.', '{}'::jsonb)
on conflict (check_key) do update set
  readiness_status = excluded.readiness_status,
  recommendation = excluded.recommendation,
  updated_at = now();

insert into public.scale_100_privacy_security_checks (
  check_key, area, readiness_score, risk_level, status, alert_rule, recommendation
) values
  ('scale100-mfa-adoption', 'mfa', 55, 'medium', 'tracking', 'MFA adoption below target', 'Increase MFA adoption for managers/admins and sensitive actions before 100 gardens.'),
  ('scale100-parent-isolation', 'parent_isolation', 70, 'high', 'needs_review', 'Parent access boundary risk', 'Continue route/RLS checks that parents cannot access another child or garden.'),
  ('scale100-private-documents', 'private_documents', 68, 'high', 'needs_review', 'Sensitive file exposure', 'Verify private buckets and signed URL paths for child, medical, staff and inspection documents.'),
  ('scale100-admin-audit', 'admin_audit', 72, 'medium', 'tracking', 'Unaudited sensitive access', 'Audit admin access to children, medical, camera and payment areas.'),
  ('scale100-service-role', 'service_role', 64, 'critical', 'needs_review', 'Service role misuse risk', 'Keep service role server-only and review API routes before scaling.')
on conflict (check_key) do update set
  readiness_score = excluded.readiness_score,
  risk_level = excluded.risk_level,
  updated_at = now();

with first_cohort as (
  select id from public.kindergarten_scale_cohorts where cohort_key = 'scale-100-first-25'
)
insert into public.scale_100_customer_health (
  score_key, cohort_id, customer_name, manager_usage_score, parent_activation_score, staff_activation_score, payment_score, support_score, document_score, inspection_score, compliance_score, satisfaction_score, customer_health_score, health_status
) values
  ('scale100-health-baseline-a', (select id from first_cohort), 'Scale Readiness Garden A', 58, 45, 52, 50, 60, 55, 40, 50, 0, 51, 'needs_attention'),
  ('scale100-health-baseline-b', (select id from first_cohort), 'Parent Demand Garden B', 52, 38, 48, 50, 54, 50, 35, 48, 0, 47, 'at_risk')
on conflict (score_key) do update set
  customer_health_score = excluded.customer_health_score,
  health_status = excluded.health_status,
  updated_at = now();

insert into public.scale_100_churn_risk_signals (
  signal_key, signal_type, severity, recommended_action, status, notes
) values
  ('scale100-churn-low-parent-activation', 'low_parent_activation', 'high', 'schedule_training', 'open', 'Parent activation below 70% will block healthy scale.'),
  ('scale100-churn-payment-failed', 'failed_payments', 'high', 'review_payment_issue', 'open', 'Failed recurring payments must trigger grace-period workflow and manager contact.'),
  ('scale100-churn-unresolved-support', 'unresolved_tickets', 'medium', 'resolve_support_blocker', 'open', 'Repeated unresolved tickets are an early churn signal.')
on conflict (signal_key) do update set
  severity = excluded.severity,
  status = excluded.status,
  updated_at = now();

insert into public.scale_100_training_knowledge (
  item_key, item_type, category, title, completion_rate_percent, article_views, support_deflection_percent, issue_reduction_percent, status, owner
) values
  ('scale100-training-manager-onboarding', 'training_module', 'manager_onboarding', 'Manager onboarding for 100-kindergarten scale', 0, 0, 0, 0, 'needed', 'Customer Success'),
  ('scale100-training-parent-onboarding', 'training_module', 'parent_onboarding', 'Parent activation playbook and messages', 0, 0, 0, 0, 'needed', 'Customer Success'),
  ('scale100-kb-login-registration', 'knowledge_base_article', 'login', 'Login and registration troubleshooting', 0, 0, 0, 0, 'draft', 'Support'),
  ('scale100-kb-payments-documents', 'knowledge_base_article', 'payments', 'Payment setup and invoice basics', 0, 0, 0, 0, 'draft', 'Billing Ops'),
  ('scale100-kb-privacy', 'knowledge_base_article', 'privacy_security', 'Privacy and access boundaries at scale', 0, 0, 0, 0, 'needed', 'Security')
on conflict (item_key) do update set
  status = excluded.status,
  updated_at = now();

insert into public.scale_100_sales_insights (
  insight_key, city, region, leads_count, parent_demand_count, demo_conversion_percent, sales_objections, lost_reasons, referral_sources, high_demand_kindergartens, competitor_mentions, recommended_action
) values
  ('scale100-sales-center-baseline', 'Tel Aviv / Gush Dan', 'Center', 55, 236, 21.5, '["price","privacy","existing system","camera concerns"]'::jsonb, '["not ready","budget","needs owner approval"]'::jsonb, '{"demo_booking":22,"parent_demand":236,"referral":8}'::jsonb, '["High-demand Garden A","High-demand Garden B"]'::jsonb, '["generic management apps","camera-only providers"]'::jsonb, 'Prioritize high parent-demand gardens and privacy-safe demo script.')
on conflict (insight_key) do update set
  leads_count = excluded.leads_count,
  parent_demand_count = excluded.parent_demand_count,
  updated_at = now();

insert into public.scale_100_risk_register (
  risk_key, category, risk, severity, mitigation, owner, status
) values
  ('scale100-risk-support-overload', 'support', 'Support load may exceed capacity during parent activation waves.', 'high', 'Hire/assign support before 50 and create onboarding specialist before 100.', 'Customer Success', 'open'),
  ('scale100-risk-inspection-capacity', 'inspection', 'Monthly inspections may become overdue without enough inspectors.', 'critical', 'Assign regional inspector pool before activating 100-garden cohort.', 'Inspection Ops', 'open'),
  ('scale100-risk-payment-fragility', 'payment', 'Recurring subscription billing and parent payment support may create churn risk.', 'high', 'Monitor failed payments, grace periods and separated parent tuition flows.', 'Billing Ops', 'open'),
  ('scale100-risk-privacy-boundary', 'legal_privacy', 'Parent/staff/inspector data boundaries must hold under scale.', 'critical', 'Run RLS, route protection and sensitive file access checks before expansion.', 'Security', 'open'),
  ('scale100-risk-camera-ai-load', 'ai', 'Camera and AI Observer load can overwhelm support and review workflows.', 'high', 'Keep camera/AI rollout limited and shadow-mode until gateway and review capacity are proven.', 'Platform', 'open'),
  ('scale100-risk-infrastructure', 'technical', 'Database, storage, notifications and audit logs may grow faster than expected.', 'medium', 'Track slow queries, missing indexes, provider limits and log growth weekly.', 'Platform', 'open')
on conflict (risk_key) do update set
  severity = excluded.severity,
  mitigation = excluded.mitigation,
  updated_at = now();

insert into public.scale_100_success_criteria (
  criteria_key, metric_name, target_value, current_value, status, required, notes
) values
  ('scale100-criteria-kindergartens', '100 kindergartens onboarded or active rollout', 100, 0, 'tracking', true, 'Target can include active rollout, not uncontrolled national launch.'),
  ('scale100-criteria-manager-onboarding', 'Manager onboarding completed', 85, 0, 'tracking', true, 'Manager adoption must prove command center usage.'),
  ('scale100-criteria-parent-activation', 'Parent activation minimum', 70, 0, 'tracking', true, 'Healthy target is 80%, excellent is 90%.'),
  ('scale100-criteria-staff-activation', 'Staff activation minimum', 80, 0, 'tracking', true, 'Staff workflows should be used weekly.'),
  ('scale100-criteria-billing-config', 'Successful billing configuration', 95, 0, 'tracking', true, 'Gan Batuach subscriptions must remain separate from parent tuition payments.'),
  ('scale100-criteria-inspections', 'Monthly inspection coverage operational', 100, 0, 'tracking', true, 'No inspection model breakage at 100 gardens.'),
  ('scale100-criteria-critical-incidents', 'Critical privacy/security incidents', 0, 0, 'met', true, 'Any critical incident pauses expansion.'),
  ('scale100-criteria-unit-economics', 'Positive unit economics', 1, 0, 'tracking', true, 'Contribution margin must stay positive after support and inspection cost.')
on conflict (criteria_key) do update set
  target_value = excluded.target_value,
  current_value = excluded.current_value,
  updated_at = now();

insert into public.scale_100_expansion_decisions (
  decision_key, decision, readiness_score, rationale, blockers, next_actions, status
) values (
  'scale100-expansion-baseline',
  'pause_and_stabilize',
  61,
  'The 100-kindergarten program is ready as a controlled operating framework, but expansion beyond 100 should wait for support, inspection, billing and privacy/security validation.',
  '["support staffing not assigned","inspector pool not assigned","payment provider scale not proven","camera/AI remain readiness-only"]'::jsonb,
  '["run first 25 cohort","measure parent activation","assign support owner","assign inspector capacity","review privacy/security checks weekly"]'::jsonb,
  'recommended'
) on conflict (decision_key) do update set
  readiness_score = excluded.readiness_score,
  rationale = excluded.rationale,
  updated_at = now();

insert into public.scale_100_readiness_scores (
  snapshot_key, scale_readiness_score, active_kindergartens, onboarding_kindergartens, paid_kindergartens, suspended_kindergartens, support_score, inspector_score, parent_activation_score, staff_activation_score, payment_health_score, infrastructure_health_score, privacy_security_score, critical_blockers, launch_decision
) values (
  'scale100-baseline-readiness',
  61,
  0,
  0,
  0,
  0,
  58,
  54,
  58,
  62,
  64,
  66,
  63,
  0,
  'pause_and_stabilize'
) on conflict (snapshot_key) do update set
  scale_readiness_score = excluded.scale_readiness_score,
  support_score = excluded.support_score,
  inspector_score = excluded.inspector_score,
  privacy_security_score = excluded.privacy_security_score,
  calculated_at = now();

comment on table public.kindergarten_scale_cohorts is 'Phase 185 controlled 100-kindergarten rollout cohorts: first 25, next 25 and next 50.';
comment on table public.kindergarten_scale_profiles is 'Per-kindergarten operating profile for the controlled 100-kindergarten scale program.';
comment on table public.scale_100_risk_register is 'Risk register for 100-kindergarten scale readiness across technical, support, inspection, payment, privacy, security, camera, AI and reputation risks.';
comment on table public.scale_100_readiness_scores is 'Executive readiness score for Gan Batuach controlled 100-kindergarten scale program.';
