-- PHASE 174: First commercial rollout, 10-25 kindergarten launch and revenue validation.
-- Controlled rollout only. No mass launch, no automatic onboarding, no automatic charging.

create table if not exists public.commercial_rollout_cohorts (
  id uuid primary key default gen_random_uuid(),
  cohort_key text not null unique,
  cohort_name text not null,
  target_kindergartens integer not null default 10,
  start_date date,
  end_date date,
  rollout_status text not null default 'planned',
  owner text,
  success_criteria jsonb not null default '{}'::jsonb,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_cohort_size_check check (target_kindergartens between 10 and 25),
  constraint commercial_rollout_cohort_status_check check (rollout_status in ('planned','recruiting','onboarding','active','stabilizing','completed','paused'))
);

create table if not exists public.commercial_rollout_kindergarten_profiles (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.commercial_rollout_cohorts(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  opportunity_id uuid references public.commercial_sales_pipeline(id) on delete set null,
  growth_lead_id uuid references public.growth_leads(id) on delete set null,
  profile_key text not null unique,
  kindergarten_name text not null,
  source text not null default 'manual_admin',
  city text,
  manager_name text,
  manager_phone text,
  age_groups_count integer not null default 1,
  expected_monthly_price_nis integer not null default 800,
  subscription_status text not null default 'not_configured',
  onboarding_status text not null default 'not_started',
  payment_status text not null default 'not_started',
  staff_invited integer not null default 0,
  parents_invited integer not null default 0,
  documents_uploaded integer not null default 0,
  inspection_scheduled boolean not null default false,
  support_owner text,
  risk_level text not null default 'medium',
  customer_health_score integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_source_check check (source in ('demo_booking','kindergarten_registration','parent_demand_request','referral','manual_admin_entry','sales_outreach')),
  constraint commercial_rollout_subscription_status_check check (subscription_status in ('not_configured','trial','active','pending_payment','failed','grace_period','suspended','cancelled')),
  constraint commercial_rollout_onboarding_status_check check (onboarding_status in ('not_started','manager_onboarding','staff_parent_setup','documents_payment','active_usage','completed','blocked')),
  constraint commercial_rollout_payment_status_check check (payment_status in ('not_started','method_missing','sandbox_ready','live_ready','paid','failed','grace_period','suspended')),
  constraint commercial_rollout_risk_level_check check (risk_level in ('low','medium','high','critical')),
  constraint commercial_rollout_profile_score_check check (customer_health_score between 0 and 100),
  constraint commercial_rollout_profile_counts_check check (age_groups_count >= 1 and expected_monthly_price_nis >= 0 and staff_invited >= 0 and parents_invited >= 0 and documents_uploaded >= 0)
);

create table if not exists public.commercial_rollout_activation_checklists (
  id uuid primary key default gen_random_uuid(),
  rollout_profile_id uuid references public.commercial_rollout_kindergarten_profiles(id) on delete cascade,
  checklist_key text not null,
  title text not null,
  category text not null,
  status text not null default 'pending',
  required boolean not null default true,
  owner_role text not null default 'admin',
  completed_at timestamptz,
  evidence_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(rollout_profile_id, checklist_key),
  constraint commercial_rollout_activation_category_check check (category in ('contract','subscription','payment','invoice','manager','staff','parents','documents','pricing','inspection','support')),
  constraint commercial_rollout_activation_status_check check (status in ('pending','in_progress','completed','blocked','not_required'))
);

create table if not exists public.commercial_rollout_payment_validation (
  id uuid primary key default gen_random_uuid(),
  rollout_profile_id uuid references public.commercial_rollout_kindergarten_profiles(id) on delete cascade,
  validation_key text not null unique,
  payment_stream text not null,
  status text not null default 'not_started',
  expected_amount_nis integer not null default 0,
  collected_amount_nis integer not null default 0,
  failed_amount_nis integer not null default 0,
  discount_amount_nis integer not null default 0,
  provider_mode text not null default 'sandbox',
  revenue_destination text not null,
  validation_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_payment_stream_check check (payment_stream in ('gan_batuach_subscription','parent_tuition')),
  constraint commercial_rollout_payment_status_check check (status in ('not_started','configured','sandbox_validated','live_validated','paid','failed','blocked')),
  constraint commercial_rollout_payment_provider_mode_check check (provider_mode in ('disabled','sandbox','live')),
  constraint commercial_rollout_payment_destination_check check (revenue_destination in ('gan_batuach_company_account','kindergarten_account_provider')),
  constraint commercial_rollout_payment_amounts_check check (expected_amount_nis >= 0 and collected_amount_nis >= 0 and failed_amount_nis >= 0 and discount_amount_nis >= 0)
);

create table if not exists public.commercial_rollout_adoption_metrics (
  id uuid primary key default gen_random_uuid(),
  rollout_profile_id uuid references public.commercial_rollout_kindergarten_profiles(id) on delete cascade,
  metric_key text not null,
  role_area text not null,
  invited_count integer not null default 0,
  activated_count integer not null default 0,
  weekly_active_count integer not null default 0,
  usage_signals jsonb not null default '{}'::jsonb,
  adoption_score integer not null default 0,
  status text not null default 'tracking',
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(rollout_profile_id, metric_key),
  constraint commercial_rollout_adoption_role_check check (role_area in ('manager','parent','staff')),
  constraint commercial_rollout_adoption_status_check check (status in ('tracking','healthy','at_risk','blocked','not_started')),
  constraint commercial_rollout_adoption_score_check check (adoption_score between 0 and 100),
  constraint commercial_rollout_adoption_counts_check check (invited_count >= 0 and activated_count >= 0 and weekly_active_count >= 0)
);

create table if not exists public.commercial_rollout_inspection_validation (
  id uuid primary key default gen_random_uuid(),
  rollout_profile_id uuid references public.commercial_rollout_kindergarten_profiles(id) on delete cascade,
  validation_key text not null unique,
  assigned_inspector_id uuid references public.inspectors(id) on delete set null,
  monthly_cycle_status text not null default 'not_started',
  inspection_due_date date,
  alerts_ready boolean not null default false,
  gps_validation_ready boolean not null default false,
  digital_signature_ready boolean not null default false,
  pdf_report_ready boolean not null default false,
  findings_workflow_ready boolean not null default false,
  corrective_actions_ready boolean not null default false,
  status text not null default 'not_started',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_inspection_cycle_check check (monthly_cycle_status in ('not_started','scheduled','active','completed','blocked')),
  constraint commercial_rollout_inspection_status_check check (status in ('not_started','ready','in_progress','completed','blocked'))
);

create table if not exists public.commercial_rollout_support_validation (
  id uuid primary key default gen_random_uuid(),
  rollout_profile_id uuid references public.commercial_rollout_kindergarten_profiles(id) on delete cascade,
  support_key text not null unique,
  tickets_count integer not null default 0,
  issue_category text not null default 'onboarding',
  avg_response_minutes integer,
  avg_resolution_minutes integer,
  repeated_issues integer not null default 0,
  training_needs text,
  satisfaction_score integer,
  status text not null default 'tracking',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_support_category_check check (issue_category in ('onboarding','login','parent','staff','manager','camera','payment','document','notification','inspection','bug','feature_request')),
  constraint commercial_rollout_support_status_check check (status in ('tracking','healthy','needs_attention','blocked','closed')),
  constraint commercial_rollout_support_counts_check check (tickets_count >= 0 and repeated_issues >= 0),
  constraint commercial_rollout_support_satisfaction_check check (satisfaction_score is null or satisfaction_score between 0 and 100)
);

create table if not exists public.commercial_rollout_risks (
  id uuid primary key default gen_random_uuid(),
  rollout_profile_id uuid references public.commercial_rollout_kindergarten_profiles(id) on delete cascade,
  risk_key text not null unique,
  risk_type text not null,
  title text not null,
  severity text not null default 'medium',
  mitigation text,
  owner text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_risk_type_check check (risk_type in ('onboarding','payment','support','legal_privacy','camera','ai_observer','parent_adoption','staff_adoption','churn')),
  constraint commercial_rollout_risk_severity_check check (severity in ('low','medium','high','critical')),
  constraint commercial_rollout_risk_status_check check (status in ('open','mitigating','mitigated','accepted','closed'))
);

create table if not exists public.commercial_rollout_success_criteria (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid references public.commercial_rollout_cohorts(id) on delete cascade,
  criteria_key text not null,
  title text not null,
  threshold_value numeric,
  actual_value numeric,
  status text not null default 'tracking',
  required boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(cohort_id, criteria_key),
  constraint commercial_rollout_success_status_check check (status in ('tracking','met','at_risk','missed','not_applicable'))
);

create table if not exists public.commercial_rollout_expansion_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  cohort_id uuid references public.commercial_rollout_cohorts(id) on delete set null,
  decision text not null default 'needs_stabilization',
  readiness_score integer not null default 0,
  report_summary text,
  blockers jsonb not null default '[]'::jsonb,
  recommended_next_actions jsonb not null default '[]'::jsonb,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_expansion_decision_check check (decision in ('not_ready','continue_stabilization','ready_for_50_gardens','ready_for_regional_rollout','ready_for_commercial_scale','needs_pricing_adjustment','needs_support_expansion','needs_technical_optimization')),
  constraint commercial_rollout_expansion_score_check check (readiness_score between 0 and 100)
);

create table if not exists public.commercial_rollout_feedback_loop (
  id uuid primary key default gen_random_uuid(),
  feedback_key text not null unique,
  cohort_id uuid references public.commercial_rollout_cohorts(id) on delete set null,
  feedback_type text not null,
  summary text not null,
  source_role text not null default 'sales',
  status text not null default 'open',
  recommended_update_target text,
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_feedback_type_check check (feedback_type in ('objection','pricing_objection','privacy_concern','camera_concern','parent_concern','onboarding_objection','competitor_comparison')),
  constraint commercial_rollout_feedback_status_check check (status in ('open','reviewed','actioned','deferred','closed')),
  constraint commercial_rollout_feedback_target_check check (recommended_update_target is null or recommended_update_target in ('website','demo_script','sales_materials','faq','onboarding_copy','pricing'))
);

create table if not exists public.commercial_rollout_pricing_insights (
  id uuid primary key default gen_random_uuid(),
  insight_key text not null unique,
  cohort_id uuid references public.commercial_rollout_cohorts(id) on delete set null,
  insight_type text not null,
  base_price_nis integer not null default 800,
  additional_class_price_nis integer not null default 200,
  annual_commitment_paid_monthly boolean not null default true,
  discount_usage_count integer not null default 0,
  willingness_to_pay_score integer not null default 0,
  churn_risk_by_price text,
  recommendation text,
  status text not null default 'tracking',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_pricing_type_check check (insight_type in ('base_price','additional_class','annual_commitment','discount_usage','willingness_to_pay','churn_risk')),
  constraint commercial_rollout_pricing_status_check check (status in ('tracking','validated','needs_adjustment','inconclusive')),
  constraint commercial_rollout_pricing_score_check check (willingness_to_pay_score between 0 and 100)
);

create table if not exists public.commercial_rollout_staffing_forecasts (
  id uuid primary key default gen_random_uuid(),
  forecast_key text not null unique,
  forecast_type text not null,
  garden_count integer not null,
  tickets_per_kindergarten numeric,
  onboarding_hours_per_kindergarten numeric,
  training_hours_per_kindergarten numeric,
  average_inspection_duration_minutes integer,
  travel_assumption_minutes integer,
  followup_rate numeric,
  recommended_staff_count numeric not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_rollout_staffing_type_check check (forecast_type in ('support','inspector')),
  constraint commercial_rollout_staffing_garden_count_check check (garden_count in (25,50,100,500))
);

create table if not exists public.commercial_rollout_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  cohort_id uuid references public.commercial_rollout_cohorts(id) on delete set null,
  rollout_readiness_score integer not null default 0,
  onboarding_score integer not null default 0,
  payment_score integer not null default 0,
  parent_activation_score integer not null default 0,
  staff_activation_score integer not null default 0,
  manager_adoption_score integer not null default 0,
  inspection_score integer not null default 0,
  support_score integer not null default 0,
  revenue_score integer not null default 0,
  churn_risk_score integer not null default 0,
  launch_decision text not null default 'not_ready',
  revenue_collected_nis integer not null default 0,
  expected_revenue_nis integer not null default 0,
  open_blockers integer not null default 0,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commercial_rollout_score_range_check check (
    rollout_readiness_score between 0 and 100 and onboarding_score between 0 and 100 and payment_score between 0 and 100 and
    parent_activation_score between 0 and 100 and staff_activation_score between 0 and 100 and manager_adoption_score between 0 and 100 and
    inspection_score between 0 and 100 and support_score between 0 and 100 and revenue_score between 0 and 100 and churn_risk_score between 0 and 100
  ),
  constraint commercial_rollout_launch_decision_check check (launch_decision in ('not_ready','continue_stabilization','ready_for_50_gardens','ready_for_regional_rollout','ready_for_commercial_scale'))
);

create index if not exists idx_commercial_rollout_profiles_cohort on public.commercial_rollout_kindergarten_profiles(cohort_id, risk_level, onboarding_status);
create index if not exists idx_commercial_rollout_profiles_payment on public.commercial_rollout_kindergarten_profiles(payment_status, subscription_status);
create index if not exists idx_commercial_rollout_activation_status on public.commercial_rollout_activation_checklists(status, category);
create index if not exists idx_commercial_rollout_adoption_role on public.commercial_rollout_adoption_metrics(role_area, status, adoption_score);
create index if not exists idx_commercial_rollout_risks_status on public.commercial_rollout_risks(severity, status);
create index if not exists idx_commercial_rollout_scores_latest on public.commercial_rollout_readiness_scores(calculated_at desc);

alter table public.commercial_rollout_cohorts enable row level security;
alter table public.commercial_rollout_kindergarten_profiles enable row level security;
alter table public.commercial_rollout_activation_checklists enable row level security;
alter table public.commercial_rollout_payment_validation enable row level security;
alter table public.commercial_rollout_adoption_metrics enable row level security;
alter table public.commercial_rollout_inspection_validation enable row level security;
alter table public.commercial_rollout_support_validation enable row level security;
alter table public.commercial_rollout_risks enable row level security;
alter table public.commercial_rollout_success_criteria enable row level security;
alter table public.commercial_rollout_expansion_readiness enable row level security;
alter table public.commercial_rollout_feedback_loop enable row level security;
alter table public.commercial_rollout_pricing_insights enable row level security;
alter table public.commercial_rollout_staffing_forecasts enable row level security;
alter table public.commercial_rollout_readiness_scores enable row level security;

drop policy if exists "commercial rollout cohorts admin only" on public.commercial_rollout_cohorts;
create policy "commercial rollout cohorts admin only" on public.commercial_rollout_cohorts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout profiles admin only" on public.commercial_rollout_kindergarten_profiles;
create policy "commercial rollout profiles admin only" on public.commercial_rollout_kindergarten_profiles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout checklists admin only" on public.commercial_rollout_activation_checklists;
create policy "commercial rollout checklists admin only" on public.commercial_rollout_activation_checklists for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout payments admin only" on public.commercial_rollout_payment_validation;
create policy "commercial rollout payments admin only" on public.commercial_rollout_payment_validation for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout adoption admin only" on public.commercial_rollout_adoption_metrics;
create policy "commercial rollout adoption admin only" on public.commercial_rollout_adoption_metrics for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout inspections admin only" on public.commercial_rollout_inspection_validation;
create policy "commercial rollout inspections admin only" on public.commercial_rollout_inspection_validation for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout support admin only" on public.commercial_rollout_support_validation;
create policy "commercial rollout support admin only" on public.commercial_rollout_support_validation for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout risks admin only" on public.commercial_rollout_risks;
create policy "commercial rollout risks admin only" on public.commercial_rollout_risks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout success criteria admin only" on public.commercial_rollout_success_criteria;
create policy "commercial rollout success criteria admin only" on public.commercial_rollout_success_criteria for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout expansion admin only" on public.commercial_rollout_expansion_readiness;
create policy "commercial rollout expansion admin only" on public.commercial_rollout_expansion_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout feedback admin only" on public.commercial_rollout_feedback_loop;
create policy "commercial rollout feedback admin only" on public.commercial_rollout_feedback_loop for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout pricing insights admin only" on public.commercial_rollout_pricing_insights;
create policy "commercial rollout pricing insights admin only" on public.commercial_rollout_pricing_insights for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout staffing forecasts admin only" on public.commercial_rollout_staffing_forecasts;
create policy "commercial rollout staffing forecasts admin only" on public.commercial_rollout_staffing_forecasts for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial rollout scores admin only" on public.commercial_rollout_readiness_scores;
create policy "commercial rollout scores admin only" on public.commercial_rollout_readiness_scores for all using (public.is_admin()) with check (public.is_admin());

insert into public.commercial_rollout_cohorts (cohort_key, cohort_name, target_kindergartens, start_date, end_date, rollout_status, owner, success_criteria, notes)
values (
  'first-commercial-cohort-10-25',
  'First Commercial Rollout Cohort',
  15,
  current_date + interval '14 days',
  current_date + interval '104 days',
  'planned',
  'Commercial / Customer Success',
  '{"manager_onboarding":80,"parent_activation":70,"staff_weekly_usage":true,"payment_flow":"works","critical_security_privacy_issues":0,"support_load":"manageable","satisfaction":"acceptable","renewal_risk":"low"}'::jsonb,
  'Controlled 10-25 kindergarten rollout. No mass launch.'
)
on conflict (cohort_key) do update set target_kindergartens = excluded.target_kindergartens, success_criteria = excluded.success_criteria, updated_at = now();

with cohort as (
  select id from public.commercial_rollout_cohorts where cohort_key = 'first-commercial-cohort-10-25'
),
opportunity as (
  select id, kindergarten_name, city, lead_source, estimated_classes, estimated_monthly_revenue_nis from public.commercial_sales_pipeline where opportunity_key = 'commercial-first-pilot-followup'
)
insert into public.commercial_rollout_kindergarten_profiles (
  cohort_id, opportunity_id, profile_key, kindergarten_name, source, city, manager_name,
  age_groups_count, expected_monthly_price_nis, subscription_status, onboarding_status, payment_status,
  staff_invited, parents_invited, documents_uploaded, inspection_scheduled, support_owner, risk_level,
  customer_health_score, notes
)
select
  cohort.id,
  opportunity.id,
  'rollout-kindergarten-001',
  coalesce(opportunity.kindergarten_name, 'Commercial rollout kindergarten 1'),
  case
    when opportunity.lead_source = 'parent_demand' then 'parent_demand_request'
    when opportunity.lead_source = 'manual_admin' then 'manual_admin_entry'
    when opportunity.lead_source in ('demo_booking','kindergarten_registration','referral') then opportunity.lead_source
    else 'sales_outreach'
  end,
  coalesce(opportunity.city, 'TBD'),
  'Manager',
  greatest(coalesce(opportunity.estimated_classes, 1), 1),
  coalesce(opportunity.estimated_monthly_revenue_nis, 800),
  'trial',
  'manager_onboarding',
  'sandbox_ready',
  4,
  20,
  8,
  true,
  'Customer Success',
  'medium',
  62,
  'Seeded rollout profile connected to commercial pipeline readiness.'
from cohort
left join opportunity on true
on conflict (profile_key) do update set
  expected_monthly_price_nis = excluded.expected_monthly_price_nis,
  customer_health_score = excluded.customer_health_score,
  updated_at = now();

with profile as (
  select id from public.commercial_rollout_kindergarten_profiles where profile_key = 'rollout-kindergarten-001'
)
insert into public.commercial_rollout_activation_checklists (rollout_profile_id, checklist_key, title, category, status, evidence_summary)
select profile.id, item.key, item.title, item.category, item.status, item.evidence
from profile,
(values
  ('terms-accepted','Contract / terms accepted','contract','in_progress','Draft terms sent; legal approval pending.'),
  ('subscription-configured','Subscription configured','subscription','in_progress','Gan Batuach Standard pricing model selected.'),
  ('payment-method','Payment method set','payment','pending','Provider sandbox validation required.'),
  ('invoice-details','Invoice details completed','invoice','pending','Company and kindergarten invoice details needed.'),
  ('manager-onboarded','Manager onboarded','manager','in_progress','Manager flow in progress.'),
  ('staff-invited','Staff invited','staff','completed','Initial staff invites prepared.'),
  ('parents-invited','Parents invited','parents','in_progress','Parent activation tracking started.'),
  ('documents-uploaded','Documents uploaded','documents','in_progress','Core docs uploaded; compliance gap review needed.'),
  ('pricing-configured','Pricing configured','pricing','completed','Base 800 NIS + 200 NIS additional class modeled.'),
  ('inspection-scheduled','First inspection scheduled','inspection','in_progress','Monthly inspection cycle scheduled.'),
  ('support-contact','Support contact assigned','support','completed','Named support owner assigned.')
) as item(key,title,category,status,evidence)
on conflict (rollout_profile_id, checklist_key) do update set status = excluded.status, evidence_summary = excluded.evidence_summary, updated_at = now();

with profile as (
  select id, expected_monthly_price_nis from public.commercial_rollout_kindergarten_profiles where profile_key = 'rollout-kindergarten-001'
)
insert into public.commercial_rollout_payment_validation (rollout_profile_id, validation_key, payment_stream, status, expected_amount_nis, collected_amount_nis, failed_amount_nis, discount_amount_nis, provider_mode, revenue_destination, validation_notes)
select id, 'gan-batuach-subscription-validation', 'gan_batuach_subscription', 'sandbox_validated', expected_monthly_price_nis, 0, 0, 0, 'sandbox', 'gan_batuach_company_account', 'Annual agreement paid monthly; live collection not activated.'
from profile
union all
select id, 'parent-tuition-routing-validation', 'parent_tuition', 'configured', 0, 0, 0, 0, 'sandbox', 'kindergarten_account_provider', 'Parent tuition routes to kindergarten account/provider. Gan Batuach does not hold tuition funds.'
from profile
on conflict (validation_key) do update set status = excluded.status, expected_amount_nis = excluded.expected_amount_nis, updated_at = now();

with profile as (
  select id from public.commercial_rollout_kindergarten_profiles where profile_key = 'rollout-kindergarten-001'
)
insert into public.commercial_rollout_adoption_metrics (rollout_profile_id, metric_key, role_area, invited_count, activated_count, weekly_active_count, usage_signals, adoption_score, status)
select profile.id, item.key, item.role_area, item.invited, item.activated, item.weekly_active, item.signals::jsonb, item.score, item.status
from profile,
(values
  ('manager-adoption','manager',1,1,1,'{"command_center":true,"child_management":true,"billing":false,"compliance":true}',72,'tracking'),
  ('parent-activation','parent',20,9,6,'{"login_rate":45,"timeline_usage":true,"messages":true,"payments":false,"notification_opt_in":40}',45,'at_risk'),
  ('staff-activation','staff',4,3,3,'{"profile_completion":75,"attendance_usage":true,"child_updates":true,"task_completion":60}',68,'tracking')
) as item(key,role_area,invited,activated,weekly_active,signals,score,status)
on conflict (rollout_profile_id, metric_key) do update set activated_count = excluded.activated_count, adoption_score = excluded.adoption_score, status = excluded.status, updated_at = now();

with profile as (
  select id from public.commercial_rollout_kindergarten_profiles where profile_key = 'rollout-kindergarten-001'
)
insert into public.commercial_rollout_inspection_validation (rollout_profile_id, validation_key, monthly_cycle_status, inspection_due_date, alerts_ready, gps_validation_ready, digital_signature_ready, pdf_report_ready, findings_workflow_ready, corrective_actions_ready, status, notes)
select id, 'first-monthly-inspection-validation', 'scheduled', current_date + interval '21 days', true, true, true, true, true, true, 'ready', 'First monthly cycle readiness prepared.'
from profile
on conflict (validation_key) do update set status = excluded.status, inspection_due_date = excluded.inspection_due_date, updated_at = now();

with profile as (
  select id from public.commercial_rollout_kindergarten_profiles where profile_key = 'rollout-kindergarten-001'
)
insert into public.commercial_rollout_support_validation (rollout_profile_id, support_key, tickets_count, issue_category, avg_response_minutes, avg_resolution_minutes, repeated_issues, training_needs, satisfaction_score, status, notes)
select id, 'support-readiness-rollout-001', 3, 'onboarding', 120, 1440, 1, 'Parent onboarding and payment explanation', 78, 'tracking', 'Support load manageable in controlled rollout.'
from profile
on conflict (support_key) do update set tickets_count = excluded.tickets_count, satisfaction_score = excluded.satisfaction_score, updated_at = now();

with profile as (
  select id from public.commercial_rollout_kindergarten_profiles where profile_key = 'rollout-kindergarten-001'
)
insert into public.commercial_rollout_risks (rollout_profile_id, risk_key, risk_type, title, severity, mitigation, owner, status)
select profile.id, item.key, item.type, item.title, item.severity, item.mitigation, item.owner, item.status
from profile,
(values
  ('parent-activation-risk','parent_adoption','Parent activation below 70% target','high','Add parent explanation calls and WhatsApp/email reminders.','Customer Success','mitigating'),
  ('payment-live-validation-risk','payment','Live payment validation not complete','high','Complete sandbox/live provider test before active paid status.','Billing','open'),
  ('support-repeat-risk','support','Repeated onboarding questions','medium','Update FAQ and onboarding copy after first week.','Support','mitigating')
) as item(key,type,title,severity,mitigation,owner,status)
on conflict (risk_key) do update set severity = excluded.severity, mitigation = excluded.mitigation, status = excluded.status, updated_at = now();

with cohort as (
  select id from public.commercial_rollout_cohorts where cohort_key = 'first-commercial-cohort-10-25'
)
insert into public.commercial_rollout_success_criteria (cohort_id, criteria_key, title, threshold_value, actual_value, status, notes)
select cohort.id, item.key, item.title, item.threshold, item.actual, item.status, item.notes
from cohort,
(values
  ('manager-onboarding-80','80% managers complete onboarding',80,72,'tracking','Manager onboarding trending positive.'),
  ('parent-activation-70','70% parents activate',70,45,'at_risk','Parent activation needs focused work.'),
  ('staff-weekly-usage','Staff workflows used weekly',1,1,'met','Staff weekly usage observed in seed profile.'),
  ('payment-flow-works','Payment flow works',1,0,'tracking','Sandbox ready, live validation pending.'),
  ('no-critical-security-privacy','No critical privacy/security issues',0,0,'met','No critical issue seeded.'),
  ('support-load-manageable','Support load manageable',1,1,'tracking','Support load manageable but repeated issues exist.'),
  ('satisfaction-acceptable','Customer satisfaction acceptable',75,78,'met','Initial satisfaction above threshold.'),
  ('renewal-risk-low','Renewal risk low',1,0,'at_risk','Parent activation and payment validation affect renewal risk.')
) as item(key,title,threshold,actual,status,notes)
on conflict (cohort_id, criteria_key) do update set actual_value = excluded.actual_value, status = excluded.status, updated_at = now();

with cohort as (
  select id from public.commercial_rollout_cohorts where cohort_key = 'first-commercial-cohort-10-25'
)
insert into public.commercial_rollout_expansion_readiness (readiness_key, cohort_id, decision, readiness_score, report_summary, blockers, recommended_next_actions)
select id::text || '-expansion-readiness', id, 'continue_stabilization', 58, 'Controlled rollout is not ready for 50 gardens until parent activation and payment validation improve.', '["parent activation below target","live payment validation pending","support repeated onboarding questions"]'::jsonb, '["increase parent activation support","complete payment provider validation","update onboarding FAQ","review support staffing"]'::jsonb
from cohort
on conflict (readiness_key) do update set decision = excluded.decision, readiness_score = excluded.readiness_score, blockers = excluded.blockers, updated_at = now();

with cohort as (
  select id from public.commercial_rollout_cohorts where cohort_key = 'first-commercial-cohort-10-25'
)
insert into public.commercial_rollout_feedback_loop (feedback_key, cohort_id, feedback_type, summary, source_role, status, recommended_update_target, owner)
select cohort.id::text || '-pricing-objection', cohort.id, 'pricing_objection', 'Managers ask whether the 800 + 200 NIS model includes all core features.', 'sales', 'open', 'sales_materials', 'Sales'
from cohort
union all
select cohort.id::text || '-privacy-concern', cohort.id, 'privacy_concern', 'Parents and managers ask what cameras and AI can show.', 'sales', 'open', 'faq', 'Legal / Customer Success'
from cohort
on conflict (feedback_key) do update set summary = excluded.summary, status = excluded.status, updated_at = now();

with cohort as (
  select id from public.commercial_rollout_cohorts where cohort_key = 'first-commercial-cohort-10-25'
)
insert into public.commercial_rollout_pricing_insights (insight_key, cohort_id, insight_type, discount_usage_count, willingness_to_pay_score, churn_risk_by_price, recommendation, status)
select cohort.id::text || '-base-pricing-validation', cohort.id, 'base_price', 1, 64, 'medium if parent activation remains low', 'Validate willingness to pay after payment flow and onboarding stabilize.', 'tracking'
from cohort
on conflict (insight_key) do update set willingness_to_pay_score = excluded.willingness_to_pay_score, recommendation = excluded.recommendation, updated_at = now();

insert into public.commercial_rollout_staffing_forecasts (forecast_key, forecast_type, garden_count, tickets_per_kindergarten, onboarding_hours_per_kindergarten, training_hours_per_kindergarten, average_inspection_duration_minutes, travel_assumption_minutes, followup_rate, recommended_staff_count, notes)
values
  ('support-25-gardens','support',25,4,3,2,null,null,null,1.5,'One support/CS owner plus part-time onboarding support.'),
  ('support-50-gardens','support',50,3.5,2.5,1.5,null,null,null,3,'Dedicated CS and support coverage needed.'),
  ('support-100-gardens','support',100,3,2,1.2,null,null,null,5,'Add tiered support and training operations.'),
  ('support-500-gardens','support',500,2.2,1.2,0.8,null,null,null,18,'Requires support team, knowledge base and automation.'),
  ('inspectors-25-gardens','inspector',25,null,null,null,90,45,0.2,2,'Monthly inspections plus follow-up coverage.'),
  ('inspectors-50-gardens','inspector',50,null,null,null,90,45,0.25,4,'Regional scheduling needed.'),
  ('inspectors-100-gardens','inspector',100,null,null,null,90,45,0.25,8,'Dedicated inspection ops required.'),
  ('inspectors-500-gardens','inspector',500,null,null,null,90,45,0.3,38,'Regional inspector network required.')
on conflict (forecast_key) do update set recommended_staff_count = excluded.recommended_staff_count, notes = excluded.notes, updated_at = now();

with cohort as (
  select id from public.commercial_rollout_cohorts where cohort_key = 'first-commercial-cohort-10-25'
)
insert into public.commercial_rollout_readiness_scores (
  snapshot_key, cohort_id, rollout_readiness_score, onboarding_score, payment_score, parent_activation_score,
  staff_activation_score, manager_adoption_score, inspection_score, support_score, revenue_score, churn_risk_score,
  launch_decision, revenue_collected_nis, expected_revenue_nis, open_blockers, metadata
)
select
  'first-commercial-rollout-baseline',
  id,
  61,
  68,
  55,
  45,
  68,
  72,
  78,
  70,
  45,
  58,
  'continue_stabilization',
  0,
  12000,
  3,
  '{"phase":174,"cohort_size":"10-25","mass_launch_allowed":false}'::jsonb
from cohort
on conflict (snapshot_key) do update set
  rollout_readiness_score = excluded.rollout_readiness_score,
  launch_decision = excluded.launch_decision,
  expected_revenue_nis = excluded.expected_revenue_nis,
  open_blockers = excluded.open_blockers,
  calculated_at = now();

comment on table public.commercial_rollout_cohorts is 'Controlled commercial rollout batches for 10-25 kindergartens.';
comment on table public.commercial_rollout_kindergarten_profiles is 'Per-kindergarten commercial rollout profile connecting lead, pipeline, onboarding, payment, support, inspection and risk.';
comment on table public.commercial_rollout_payment_validation is 'Revenue validation for Gan Batuach subscription and parent-to-kindergarten tuition separation.';
comment on table public.commercial_rollout_adoption_metrics is 'Manager, parent and staff activation metrics per rollout kindergarten.';
comment on table public.commercial_rollout_readiness_scores is 'Executive readiness score and launch decision for controlled commercial rollout.';

notify pgrst, 'reload schema';
