create table if not exists public.digital_observer_beta_customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_type text not null default 'business',
  contact_person text,
  phone text,
  email text,
  city text,
  site_type text not null default 'business',
  package_selected text,
  trial_status text not null default 'not_started',
  payment_status text not null default 'not_configured',
  beta_status text not null default 'invited',
  support_owner text,
  onboarding_status text not null default 'not_started',
  feedback_status text not null default 'not_requested',
  lead_id uuid references public.digital_observer_leads(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_customers_type_check check (customer_type in ('home','business','office','warehouse','store','parking_lot','custom')),
  constraint digital_observer_beta_customers_site_type_check check (site_type in ('home','business','office','warehouse','store','parking_lot','custom')),
  constraint digital_observer_beta_customers_status_check check (beta_status in ('invited','onboarding','trial','payment_pending','paid_beta','active','paused','cancelled','churned','completed'))
);

create table if not exists public.digital_observer_beta_sites (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  site_name text,
  site_type text not null default 'business',
  camera_count integer not null default 0 check (camera_count >= 0),
  package_key text,
  monitoring_schedule jsonb not null default '{}'::jsonb,
  alert_channels jsonb not null default '[]'::jsonb,
  camera_health text not null default 'not_connected',
  gateway_health text not null default 'not_tested',
  observer_health text not null default 'shadow_mode',
  support_status text not null default 'not_started',
  beta_readiness integer not null default 0 check (beta_readiness between 0 and 100),
  payment_mode text not null default 'disabled' check (payment_mode in ('disabled','sandbox','live')),
  billing_stream text not null default 'digital_observer' check (billing_stream = 'digital_observer'),
  gan_batuach_billing_mixed boolean not null default false,
  parent_tuition_mixed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_sites_type_check check (site_type in ('home','business','office','warehouse','store','parking_lot','custom'))
);

create table if not exists public.digital_observer_beta_funnel_stages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  stage text not null,
  status text not null default 'not_started',
  occurred_at timestamptz,
  owner text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_funnel_stage_check check (stage in ('lead','demo','trial','camera_setup','first_alerts','customer_feedback','package_confirmation','payment','paid_beta')),
  constraint digital_observer_beta_funnel_status_check check (status in ('not_started','in_progress','completed','blocked','skipped'))
);

create table if not exists public.digital_observer_beta_package_validation (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  selected_package text,
  rejected_package text,
  requested_package_changes text,
  price_objection text,
  camera_limit_issue boolean not null default false,
  monitoring_hours_issue boolean not null default false,
  alert_channel_issue boolean not null default false,
  retention_issue boolean not null default false,
  upgrade_interest boolean not null default false,
  validation_status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_package_validation_status_check check (validation_status in ('open','reviewed','adjustment_needed','validated','rejected'))
);

create table if not exists public.digital_observer_beta_pricing_validation (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  proposed_monthly_price numeric(12,2) not null default 0,
  proposed_annual_price numeric(12,2) not null default 0,
  discount_offered numeric(12,2) not null default 0,
  accepted_price numeric(12,2),
  rejected_price numeric(12,2),
  reason_for_rejection text,
  expected_lifetime_value numeric(12,2),
  support_cost_estimate numeric(12,2),
  recommended_package_pricing text,
  recommended_discount_policy text,
  recommended_annual_pricing text,
  recommended_trial_length_days integer,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_pricing_validation_status_check check (status in ('open','accepted','rejected','needs_adjustment','validated'))
);

create table if not exists public.digital_observer_beta_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  observer_site_subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  subscription_status text not null default 'trial',
  payment_mode text not null default 'disabled',
  provider text,
  package_key text,
  trial_start timestamptz,
  trial_end timestamptz,
  next_charge_at timestamptz,
  monthly_price numeric(12,2) not null default 0,
  annual_price numeric(12,2) not null default 0,
  live_charge_allowed boolean not null default false,
  raw_card_storage_allowed boolean not null default false,
  audit_required boolean not null default true,
  separation_verified boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_subscriptions_status_check check (subscription_status in ('trial','active_paid_beta','overdue','cancelled','suspended')),
  constraint digital_observer_beta_subscriptions_payment_mode_check check (payment_mode in ('disabled','sandbox','live')),
  constraint digital_observer_beta_subscriptions_no_raw_card_check check (raw_card_storage_allowed = false)
);

create table if not exists public.digital_observer_beta_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete set null,
  package_key text,
  billing_cycle text not null default 'monthly',
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  tax_readiness text not null default 'needs_review',
  invoice_status text not null default 'draft',
  pdf_ready boolean not null default false,
  email_delivery_readiness text not null default 'mock',
  product_type text not null default 'digital_observer',
  gan_batuach_wording_reused boolean not null default false,
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_invoices_product_check check (product_type = 'digital_observer'),
  constraint digital_observer_beta_invoices_status_check check (invoice_status in ('draft','issued','sent','paid','overdue','cancelled','void')),
  constraint digital_observer_beta_invoices_no_gb_wording_check check (gan_batuach_wording_reused = false)
);

create table if not exists public.digital_observer_beta_usage_value_tracking (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  period_start date not null default current_date,
  period_end date,
  cameras_connected integer not null default 0,
  alerts_generated integer not null default 0,
  alerts_reviewed integer not null default 0,
  alerts_confirmed_useful integer not null default 0,
  camera_offline_alerts integer not null default 0,
  monitoring_hours numeric(10,2) not null default 0,
  playback_sessions integer not null default 0,
  support_interactions integer not null default 0,
  days_active integer not null default 0,
  value_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_beta_alert_value_feedback (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  alert_id uuid,
  feedback text not null default 'useful',
  notes text,
  sensitivity_recommendation text,
  reviewed_by text,
  created_at timestamptz not null default now(),
  constraint digital_observer_beta_alert_feedback_check check (feedback in ('useful','not_useful','false_alert','missed_event','too_many_alerts','needs_different_sensitivity'))
);

create table if not exists public.digital_observer_beta_onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  account_created boolean not null default false,
  package_selected boolean not null default false,
  camera_connected boolean not null default false,
  gateway_tested boolean not null default false,
  monitoring_schedule_configured boolean not null default false,
  alert_recipients_configured boolean not null default false,
  first_alert_generated boolean not null default false,
  first_review_completed boolean not null default false,
  payment_configured boolean not null default false,
  support_contact_assigned boolean not null default false,
  completion_score integer not null default 0 check (completion_score between 0 and 100),
  blocker text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.digital_observer_beta_camera_setup_costs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  setup_time_minutes integer not null default 0,
  support_calls integer not null default 0,
  camera_type text,
  dvr_nvr_complexity text,
  rtsp_difficulty text,
  gateway_difficulty text,
  failed_attempts integer not null default 0,
  final_success boolean,
  final_result text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_camera_setup_final_result_check check (final_result in ('pending','success','failed','deferred'))
);

create table if not exists public.digital_observer_beta_support_load (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  tickets_per_customer integer not null default 0,
  tickets_per_camera numeric(10,2) not null default 0,
  average_resolution_hours numeric(10,2) not null default 0,
  repeated_issues jsonb not null default '[]'::jsonb,
  onboarding_friction integer not null default 0 check (onboarding_friction between 0 and 100),
  camera_setup_friction integer not null default 0 check (camera_setup_friction between 0 and 100),
  billing_friction integer not null default 0 check (billing_friction between 0 and 100),
  alert_friction integer not null default 0 check (alert_friction between 0 and 100),
  support_cost_per_customer numeric(12,2) not null default 0,
  status text not null default 'tracking',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_customer_health_scores (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  score integer not null default 0 check (score between 0 and 100),
  setup_completion_score integer not null default 0 check (setup_completion_score between 0 and 100),
  camera_stability_score integer not null default 0 check (camera_stability_score between 0 and 100),
  alert_value_score integer not null default 0 check (alert_value_score between 0 and 100),
  usage_frequency_score integer not null default 0 check (usage_frequency_score between 0 and 100),
  support_load_score integer not null default 0 check (support_load_score between 0 and 100),
  payment_status_score integer not null default 0 check (payment_status_score between 0 and 100),
  satisfaction_score integer not null default 0 check (satisfaction_score between 0 and 100),
  churn_risk_score integer not null default 0 check (churn_risk_score between 0 and 100),
  status text not null default 'tracking',
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.digital_observer_beta_churn_risks (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  risk_type text not null,
  risk_level text not null default 'medium',
  trigger_reason text not null,
  recommended_action text,
  status text not null default 'open',
  owner text,
  due_at date,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_churn_risk_level_check check (risk_level in ('critical','high','medium','low')),
  constraint digital_observer_beta_churn_risk_status_check check (status in ('open','in_progress','resolved','accepted_risk','deferred'))
);

create table if not exists public.digital_observer_beta_feedback_interviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  why_try_it text,
  problem_solved text,
  confusing_parts text,
  setup_difficulty integer check (setup_difficulty between 1 and 5),
  alerts_useful boolean,
  would_pay_monthly boolean,
  fair_monthly_price numeric(12,2),
  missing_feature text,
  interviewer text,
  interview_at timestamptz,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_beta_success_criteria (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  label text not null,
  target_value numeric(12,2) not null default 0,
  current_value numeric(12,2) not null default 0,
  status text not null default 'not_met',
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.digital_observer_beta_capability_safety_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  capability text not null,
  capability_status text not null default 'disabled',
  review_required boolean not null default true,
  approved_by text,
  approved_at timestamptz,
  consent_requirement text not null default 'legal_review_required',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_capability_status_check check (capability_status in ('allowed','disabled','legal_review_required','consent_required','future_only'))
);

create table if not exists public.digital_observer_beta_communication_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,
  channel text not null,
  title text not null,
  purpose text not null,
  provider_mode text not null default 'mock',
  status text not null default 'draft',
  body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_product_market_fit_signals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.digital_observer_beta_customers(id) on delete cascade,
  beta_site_id uuid references public.digital_observer_beta_sites(id) on delete cascade,
  willingness_to_pay_score integer not null default 0 check (willingness_to_pay_score between 0 and 100),
  repeated_usage_score integer not null default 0 check (repeated_usage_score between 0 and 100),
  strong_use_case_score integer not null default 0 check (strong_use_case_score between 0 and 100),
  low_support_burden_score integer not null default 0 check (low_support_burden_score between 0 and 100),
  referral_interest_score integer not null default 0 check (referral_interest_score between 0 and 100),
  upgrade_interest_score integer not null default 0 check (upgrade_interest_score between 0 and 100),
  more_cameras_interest_score integer not null default 0 check (more_cameras_interest_score between 0 and 100),
  product_market_fit_readiness_score integer not null default 0 check (product_market_fit_readiness_score between 0 and 100),
  notes text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.digital_observer_beta_launch_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_state text not null default 'not_ready',
  revenue_score integer not null default 0 check (revenue_score between 0 and 100),
  usage_score integer not null default 0 check (usage_score between 0 and 100),
  setup_success_score integer not null default 0 check (setup_success_score between 0 and 100),
  support_load_score integer not null default 0 check (support_load_score between 0 and 100),
  alert_quality_score integer not null default 0 check (alert_quality_score between 0 and 100),
  pricing_acceptance_score integer not null default 0 check (pricing_acceptance_score between 0 and 100),
  legal_capability_score integer not null default 0 check (legal_capability_score between 0 and 100),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  recommended_next_step text,
  blocker_summary text,
  decided_by text,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_beta_launch_decision_state_check check (decision_state in ('not_ready','needs_more_beta','paid_beta_validated','ready_for_standalone_launch','ready_for_infrastructure_extraction'))
);

create unique index if not exists digital_observer_beta_customers_email_idx on public.digital_observer_beta_customers(email) where email is not null;
create index if not exists digital_observer_beta_customers_status_idx on public.digital_observer_beta_customers(beta_status, payment_status, trial_status);
create index if not exists digital_observer_beta_sites_customer_idx on public.digital_observer_beta_sites(customer_id, beta_readiness);
create index if not exists digital_observer_beta_sites_observer_site_idx on public.digital_observer_beta_sites(observer_site_id) where observer_site_id is not null;
create unique index if not exists digital_observer_beta_invoices_number_idx on public.digital_observer_beta_invoices(invoice_number);
create unique index if not exists digital_observer_beta_success_criteria_metric_idx on public.digital_observer_beta_success_criteria(metric_key);
create unique index if not exists digital_observer_beta_templates_key_idx on public.digital_observer_beta_communication_templates(template_key);
create index if not exists digital_observer_beta_health_score_idx on public.digital_observer_customer_health_scores(score, churn_risk_score);
create index if not exists digital_observer_beta_churn_status_idx on public.digital_observer_beta_churn_risks(status, risk_level);
create index if not exists digital_observer_pmf_score_idx on public.digital_observer_product_market_fit_signals(product_market_fit_readiness_score);

alter table public.digital_observer_beta_customers enable row level security;
alter table public.digital_observer_beta_sites enable row level security;
alter table public.digital_observer_beta_funnel_stages enable row level security;
alter table public.digital_observer_beta_package_validation enable row level security;
alter table public.digital_observer_beta_pricing_validation enable row level security;
alter table public.digital_observer_beta_subscriptions enable row level security;
alter table public.digital_observer_beta_invoices enable row level security;
alter table public.digital_observer_beta_usage_value_tracking enable row level security;
alter table public.digital_observer_beta_alert_value_feedback enable row level security;
alter table public.digital_observer_beta_onboarding_checklists enable row level security;
alter table public.digital_observer_beta_camera_setup_costs enable row level security;
alter table public.digital_observer_beta_support_load enable row level security;
alter table public.digital_observer_customer_health_scores enable row level security;
alter table public.digital_observer_beta_churn_risks enable row level security;
alter table public.digital_observer_beta_feedback_interviews enable row level security;
alter table public.digital_observer_beta_success_criteria enable row level security;
alter table public.digital_observer_beta_capability_safety_reviews enable row level security;
alter table public.digital_observer_beta_communication_templates enable row level security;
alter table public.digital_observer_product_market_fit_signals enable row level security;
alter table public.digital_observer_beta_launch_decisions enable row level security;

drop policy if exists "digital observer beta customers admin" on public.digital_observer_beta_customers;
create policy "digital observer beta customers admin" on public.digital_observer_beta_customers for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta sites admin" on public.digital_observer_beta_sites;
create policy "digital observer beta sites admin" on public.digital_observer_beta_sites for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta funnel admin" on public.digital_observer_beta_funnel_stages;
create policy "digital observer beta funnel admin" on public.digital_observer_beta_funnel_stages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta package validation admin" on public.digital_observer_beta_package_validation;
create policy "digital observer beta package validation admin" on public.digital_observer_beta_package_validation for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta pricing validation admin" on public.digital_observer_beta_pricing_validation;
create policy "digital observer beta pricing validation admin" on public.digital_observer_beta_pricing_validation for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta subscriptions admin" on public.digital_observer_beta_subscriptions;
create policy "digital observer beta subscriptions admin" on public.digital_observer_beta_subscriptions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta invoices admin" on public.digital_observer_beta_invoices;
create policy "digital observer beta invoices admin" on public.digital_observer_beta_invoices for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta usage value admin" on public.digital_observer_beta_usage_value_tracking;
create policy "digital observer beta usage value admin" on public.digital_observer_beta_usage_value_tracking for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta alert feedback admin" on public.digital_observer_beta_alert_value_feedback;
create policy "digital observer beta alert feedback admin" on public.digital_observer_beta_alert_value_feedback for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta onboarding admin" on public.digital_observer_beta_onboarding_checklists;
create policy "digital observer beta onboarding admin" on public.digital_observer_beta_onboarding_checklists for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta camera setup admin" on public.digital_observer_beta_camera_setup_costs;
create policy "digital observer beta camera setup admin" on public.digital_observer_beta_camera_setup_costs for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta support load admin" on public.digital_observer_beta_support_load;
create policy "digital observer beta support load admin" on public.digital_observer_beta_support_load for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer customer health admin" on public.digital_observer_customer_health_scores;
create policy "digital observer customer health admin" on public.digital_observer_customer_health_scores for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta churn admin" on public.digital_observer_beta_churn_risks;
create policy "digital observer beta churn admin" on public.digital_observer_beta_churn_risks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta interviews admin" on public.digital_observer_beta_feedback_interviews;
create policy "digital observer beta interviews admin" on public.digital_observer_beta_feedback_interviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta criteria admin" on public.digital_observer_beta_success_criteria;
create policy "digital observer beta criteria admin" on public.digital_observer_beta_success_criteria for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta capability admin" on public.digital_observer_beta_capability_safety_reviews;
create policy "digital observer beta capability admin" on public.digital_observer_beta_capability_safety_reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta templates admin" on public.digital_observer_beta_communication_templates;
create policy "digital observer beta templates admin" on public.digital_observer_beta_communication_templates for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pmf admin" on public.digital_observer_product_market_fit_signals;
create policy "digital observer pmf admin" on public.digital_observer_product_market_fit_signals for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer beta decisions admin" on public.digital_observer_beta_launch_decisions;
create policy "digital observer beta decisions admin" on public.digital_observer_beta_launch_decisions for all using (public.is_admin()) with check (public.is_admin());

insert into public.digital_observer_beta_success_criteria (metric_key, label, target_value, current_value, status, notes)
values
  ('paid_beta_customers', 'Paid beta customers', 5, 0, 'not_met', 'Target validates that real customers are willing to pay.'),
  ('camera_setup_completion', 'Camera setup completion rate', 70, 0, 'not_met', 'Measured across beta sites.'),
  ('alert_usefulness', 'Useful alert feedback rate', 60, 0, 'not_met', 'Customer-reported alert value.'),
  ('support_load_manageable', 'Support load manageable', 75, 0, 'not_met', 'Lower support cost and friction raise the score.'),
  ('paid_continuation', 'Willing to continue paid', 50, 0, 'not_met', 'Validates ongoing willingness to pay.'),
  ('critical_security_privacy_issues', 'Critical security/privacy issues', 0, 0, 'met', 'Any critical issue blocks launch.')
on conflict (metric_key) do update set
  label = excluded.label,
  target_value = excluded.target_value,
  notes = excluded.notes,
  updated_at = now();

insert into public.digital_observer_beta_communication_templates (template_key, channel, title, purpose, provider_mode, status, body)
values
  ('welcome_paid_beta', 'email', 'Welcome to Digital Observer paid beta', 'Set expectations, support contact and safe test mode rules.', 'mock', 'draft', 'DRAFT: Welcome to the Digital Observer paid beta. Monitoring starts in controlled mode.'),
  ('trial_ending', 'email', 'Your Digital Observer trial is ending', 'Explain package confirmation and payment readiness.', 'mock', 'draft', 'DRAFT: Your trial is ending soon. Confirm your package to continue.'),
  ('payment_required', 'whatsapp', 'Digital Observer payment required', 'Request payment setup only when provider mode allows it.', 'mock', 'draft', 'DRAFT: Payment setup is required to continue paid beta.'),
  ('payment_successful', 'email', 'Digital Observer payment received', 'Confirm paid beta activation and invoice readiness.', 'mock', 'draft', 'DRAFT: Payment was received. Your invoice is being prepared.'),
  ('camera_setup_reminder', 'sms', 'Camera setup reminder', 'Help the site owner complete camera/gateway setup.', 'mock', 'draft', 'DRAFT: Please complete camera setup to continue the beta.'),
  ('alert_calibration_reminder', 'in_app', 'Alert calibration reminder', 'Ask for feedback after noisy or missed alerts.', 'mock', 'draft', 'DRAFT: Tell us whether this alert was useful.'),
  ('feedback_request', 'email', 'Digital Observer feedback request', 'Collect setup, value, price and support feedback.', 'mock', 'draft', 'DRAFT: We would like your feedback on setup, alerts and pricing.'),
  ('upgrade_suggestion', 'email', 'Digital Observer package suggestion', 'Suggest a package only from observed usage and limits.', 'mock', 'draft', 'DRAFT: Based on your usage, a different package may fit better.'),
  ('cancellation_confirmation', 'email', 'Digital Observer cancellation confirmation', 'Confirm monitoring suspension and retention next steps.', 'mock', 'draft', 'DRAFT: Your cancellation request was received.')
on conflict (template_key) do update set
  channel = excluded.channel,
  title = excluded.title,
  purpose = excluded.purpose,
  body = excluded.body,
  updated_at = now();

insert into public.digital_observer_beta_launch_decisions (
  decision_state,
  revenue_score,
  usage_score,
  setup_success_score,
  support_load_score,
  alert_quality_score,
  pricing_acceptance_score,
  legal_capability_score,
  readiness_score,
  recommended_next_step,
  blocker_summary,
  metadata
)
select
  'needs_more_beta',
  20,
  25,
  35,
  40,
  30,
  25,
  70,
  35,
  'Run 5+ controlled paid beta customers before standalone launch.',
  'Revenue, alert value, support cost and camera setup success still need real beta evidence.',
  '{"source":"phase_181_seed","billing_separation":"digital_observer_only"}'::jsonb
where not exists (select 1 from public.digital_observer_beta_launch_decisions);

comment on table public.digital_observer_beta_customers is 'Digital Observer paid beta customers only. Do not mix with Gan Batuach kindergarten or parent tuition flows.';
comment on table public.digital_observer_beta_subscriptions is 'Digital Observer paid beta subscription readiness. Live charging requires explicit provider mode and no raw card storage.';
comment on table public.digital_observer_beta_invoices is 'Digital Observer invoices only. Wording and revenue stream are separate from Gan Batuach and parent tuition.';
comment on table public.digital_observer_customer_health_scores is 'Paid beta customer health score based on setup, stability, value, support, payment, satisfaction and churn.';
comment on table public.digital_observer_product_market_fit_signals is 'Digital Observer paid beta product-market fit evidence and standalone revenue validation.';
