-- PHASE 170: commercial launch readiness and sales operations.
-- Company-ready commercial operations only. No automatic charging, no final legal contract claim,
-- and no broad outbound communication activation.

create table if not exists public.commercial_pricing_models (
  id uuid primary key default gen_random_uuid(),
  pricing_key text not null unique,
  package_name text not null default 'Gan Batuach Standard',
  base_price_nis integer not null default 800,
  included_classes integer not null default 1,
  additional_class_price_nis integer not null default 200,
  annual_commitment_required boolean not null default true,
  monthly_billing_enabled boolean not null default true,
  pilot_pricing_notes text,
  enterprise_pricing_notes text,
  active boolean not null default true,
  effective_from date not null default current_date,
  effective_until date,
  approved_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_pricing_positive_check check (base_price_nis >= 0 and additional_class_price_nis >= 0 and included_classes >= 1)
);

create table if not exists public.commercial_pricing_audit_logs (
  id uuid primary key default gen_random_uuid(),
  pricing_model_id uuid references public.commercial_pricing_models(id) on delete set null,
  action text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now(),
  constraint commercial_pricing_audit_action_check check (action in ('created','updated','discount_changed','pilot_pricing_changed','enterprise_pricing_changed','approved','disabled'))
);

create table if not exists public.commercial_packages (
  id uuid primary key default gen_random_uuid(),
  package_key text not null unique,
  package_name text not null,
  positioning text not null,
  included_capabilities jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_packages_status_check check (status in ('draft','active','retired'))
);

create table if not exists public.commercial_sales_pipeline (
  id uuid primary key default gen_random_uuid(),
  growth_lead_id uuid references public.growth_leads(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  opportunity_key text not null unique,
  kindergarten_name text not null,
  contact_name text,
  phone text,
  email text,
  city text,
  region text,
  lead_source text not null default 'manual_admin',
  stage text not null default 'new_lead',
  probability integer not null default 20,
  age_groups_count integer not null default 1,
  estimated_classes integer not null default 1,
  estimated_monthly_revenue_nis integer not null default 800,
  estimated_annual_revenue_nis integer not null default 9600,
  next_follow_up_at timestamptz,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  expected_close_date date,
  lost_reason text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_sales_pipeline_stage_check check (stage in ('new_lead','contacted','demo_scheduled','demo_completed','qualified','proposal_sent','approved','onboarding','active_customer','lost','deferred')),
  constraint commercial_sales_pipeline_source_check check (lead_source in ('demo_booking','kindergarten_registration','parent_demand','referral','campaign','partner','manual_admin')),
  constraint commercial_sales_pipeline_probability_check check (probability between 0 and 100),
  constraint commercial_sales_pipeline_counts_check check (age_groups_count >= 0 and estimated_classes >= 0)
);

create table if not exists public.commercial_demo_lifecycle (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.commercial_sales_pipeline(id) on delete cascade,
  demo_key text not null unique,
  status text not null default 'demo_booked',
  demo_date timestamptz,
  contact_person text,
  kindergarten_name text,
  city text,
  notes text,
  outcome text,
  next_step text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_demo_status_check check (status in ('demo_booked','demo_confirmed','demo_completed','follow_up_needed','converted','not_relevant'))
);

create table if not exists public.commercial_offer_summaries (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.commercial_sales_pipeline(id) on delete cascade,
  offer_key text not null unique,
  kindergarten_name text not null,
  selected_age_groups jsonb not null default '[]'::jsonb,
  selected_classes integer not null default 1,
  base_price_nis integer not null default 800,
  extra_class_price_nis integer not null default 200,
  discount_percent numeric(5,2) not null default 0,
  discount_amount_nis integer not null default 0,
  annual_commitment text not null default 'annual_subscription_paid_monthly',
  monthly_charge_nis integer not null default 800,
  total_annual_value_nis integer not null default 9600,
  valid_until date,
  status text not null default 'draft',
  pdf_ready boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_offer_status_check check (status in ('draft','sent','accepted','expired','rejected','cancelled')),
  constraint commercial_offer_prices_check check (selected_classes >= 0 and base_price_nis >= 0 and extra_class_price_nis >= 0 and monthly_charge_nis >= 0 and total_annual_value_nis >= 0)
);

create table if not exists public.commercial_contract_readiness (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.commercial_sales_pipeline(id) on delete set null,
  contract_key text not null unique,
  contract_type text not null,
  customer_name text not null,
  status text not null default 'draft',
  legal_review_status text not null default 'draft_for_legal_review',
  sent_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  document_path text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_contract_type_check check (contract_type in ('standard_kindergarten_agreement','pilot_agreement','enterprise_agreement','network_agreement')),
  constraint commercial_contract_status_check check (status in ('draft','sent','under_review','signed','expired','cancelled')),
  constraint commercial_contract_legal_status_check check (legal_review_status in ('draft_for_legal_review','under_legal_review','approved_for_use','needs_changes','blocked'))
);

create table if not exists public.commercial_sla_readiness (
  id uuid primary key default gen_random_uuid(),
  sla_key text not null unique,
  area text not null,
  title text not null,
  status text not null default 'draft',
  service_scope text,
  support_hours text,
  response_time text,
  escalation_rule text,
  uptime_target text,
  maintenance_notice_rule text,
  limitation_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_sla_area_check check (area in ('service_scope','support_hours','response_times','incident_escalation','uptime','maintenance','pilot_limitations','camera_ai_limitations','regulatory_limitations')),
  constraint commercial_sla_status_check check (status in ('draft','ready_for_review','approved','needs_changes'))
);

create table if not exists public.commercial_onboarding_checklists (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.commercial_sales_pipeline(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  checklist_key text not null,
  title text not null,
  status text not null default 'pending',
  required boolean not null default true,
  owner_role text not null default 'customer_success',
  completed_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(opportunity_id, checklist_key),
  constraint commercial_onboarding_status_check check (status in ('pending','in_progress','completed','blocked','not_required'))
);

create table if not exists public.customer_success_handoffs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.commercial_sales_pipeline(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  handoff_key text not null unique,
  customer_details jsonb not null default '{}'::jsonb,
  plan_summary text,
  expectations text,
  known_risks text,
  onboarding_deadline date,
  support_notes text,
  promised_features text,
  decision_maker text,
  status text not null default 'draft',
  handed_off_by uuid references public.profiles(id) on delete set null,
  handed_off_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_success_handoff_status_check check (status in ('draft','ready','completed','needs_followup','blocked'))
);

create table if not exists public.launch_collateral_items (
  id uuid primary key default gen_random_uuid(),
  collateral_key text not null unique,
  collateral_type text not null,
  title text not null,
  audience text not null,
  status text not null default 'draft',
  document_path text,
  owner text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint launch_collateral_type_check check (collateral_type in ('sales_deck','one_page_overview','pricing_sheet','demo_script','faq','parent_explanation_sheet','manager_onboarding_guide','staff_onboarding_guide','inspector_explanation','privacy_security_summary')),
  constraint launch_collateral_status_check check (status in ('draft','ready_for_review','approved','needs_update','missing'))
);

create table if not exists public.demo_script_library (
  id uuid primary key default gen_random_uuid(),
  script_key text not null unique,
  audience text not null,
  title text not null,
  story text,
  screens_to_show jsonb not null default '[]'::jsonb,
  key_value_points jsonb not null default '[]'::jsonb,
  common_objections jsonb not null default '[]'::jsonb,
  closing_question text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_script_audience_check check (audience in ('kindergarten_manager','parent','staff','inspector','admin','camera_observer','compliance','payments')),
  constraint demo_script_status_check check (status in ('draft','ready_for_review','approved','needs_update'))
);

create table if not exists public.commercial_objection_library (
  id uuid primary key default gen_random_uuid(),
  objection_key text not null unique,
  objection text not null,
  answer text not null,
  category text not null,
  status text not null default 'ready_for_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_objection_category_check check (category in ('price','competition','privacy','cameras','inspection','payments','legal','small_kindergarten','operations')),
  constraint commercial_objection_status_check check (status in ('draft','ready_for_review','approved','needs_legal_review'))
);

create table if not exists public.referral_program_readiness (
  id uuid primary key default gen_random_uuid(),
  referral_key text not null unique,
  referral_type text not null,
  reward_type text,
  reward_value text,
  status text not null default 'not_active',
  admin_configuration_required boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_program_type_check check (referral_type in ('kindergarten','parent','partner')),
  constraint referral_program_status_check check (status in ('not_active','draft','configured','active','paused'))
);

create table if not exists public.commercial_renewal_operations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete set null,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete set null,
  renewal_key text not null unique,
  customer_name text not null,
  renewal_date date,
  payment_status text not null default 'unknown',
  renewal_risk_level text not null default 'medium',
  customer_health_score integer not null default 0,
  reminder_90_sent boolean not null default false,
  reminder_60_sent boolean not null default false,
  reminder_30_sent boolean not null default false,
  reminder_14_sent boolean not null default false,
  reminder_7_sent boolean not null default false,
  recommended_action text,
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_renewal_payment_status_check check (payment_status in ('unknown','active','paid','pending','failed','past_due','cancelled')),
  constraint commercial_renewal_risk_check check (renewal_risk_level in ('low','medium','high','critical')),
  constraint commercial_renewal_health_check check (customer_health_score between 0 and 100)
);

create table if not exists public.commercial_churn_risk_signals (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete set null,
  signal_key text not null unique,
  customer_name text,
  risk_level text not null default 'medium',
  reason text not null,
  signal_source text not null,
  recommended_action text,
  status text not null default 'open',
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_churn_risk_level_check check (risk_level in ('low','medium','high','critical')),
  constraint commercial_churn_signal_source_check check (signal_source in ('low_usage','unresolved_tickets','failed_payments','poor_onboarding','low_parent_adoption','missing_documents','repeated_complaints')),
  constraint commercial_churn_status_check check (status in ('open','triaged','mitigating','resolved','accepted_risk'))
);

create table if not exists public.revenue_forecast_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  current_mrr_nis integer not null default 0,
  projected_mrr_nis integer not null default 0,
  current_arr_nis integer not null default 0,
  projected_arr_nis integer not null default 0,
  pipeline_value_nis integer not null default 0,
  expected_conversions integer not null default 0,
  renewal_risk_impact_nis integer not null default 0,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  lead_to_demo_conversion numeric(5,2) not null default 0,
  demo_to_customer_conversion numeric(5,2) not null default 0,
  registration_to_activation_conversion numeric(5,2) not null default 0,
  parent_demand_to_lead_conversion numeric(5,2) not null default 0,
  activation_time_days numeric(8,2) not null default 0,
  churn_rate numeric(5,2) not null default 0,
  renewal_rate numeric(5,2) not null default 0,
  average_revenue_per_kindergarten_nis integer not null default 0,
  average_classes_per_kindergarten numeric(8,2) not null default 1,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.commercial_sales_tasks (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.commercial_sales_pipeline(id) on delete cascade,
  task_key text not null unique,
  task_type text not null,
  title text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_at timestamptz,
  owner text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_sales_task_type_check check (task_type in ('follow_up_after_demo','call_high_demand_kindergarten','send_proposal','verify_payment','complete_onboarding','schedule_training','prepare_renewal')),
  constraint commercial_sales_task_status_check check (status in ('open','in_progress','completed','cancelled','overdue')),
  constraint commercial_sales_task_priority_check check (priority in ('low','medium','high','urgent'))
);

create table if not exists public.commercial_launch_checklist (
  id uuid primary key default gen_random_uuid(),
  checklist_key text not null unique,
  title text not null,
  category text not null,
  status text not null default 'pending',
  required boolean not null default true,
  evidence_summary text,
  owner text,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commercial_launch_checklist_category_check check (category in ('website','leads','demo','registration','payment','invoice','onboarding','support','terms','privacy','sales_materials','demo_environment')),
  constraint commercial_launch_checklist_status_check check (status in ('pending','in_progress','completed','blocked','not_required'))
);

create table if not exists public.commercial_launch_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  commercial_readiness_score integer not null default 0,
  pricing_score integer not null default 0,
  pipeline_score integer not null default 0,
  contract_score integer not null default 0,
  onboarding_score integer not null default 0,
  support_score integer not null default 0,
  renewal_score integer not null default 0,
  demo_score integer not null default 0,
  launch_operations_score integer not null default 0,
  status text not null default 'preparing',
  notes text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commercial_launch_readiness_status_check check (status in ('not_ready','preparing','commercial_ready_with_gaps','commercial_ready','active_sales')),
  constraint commercial_launch_readiness_score_check check (
    commercial_readiness_score between 0 and 100 and pricing_score between 0 and 100 and pipeline_score between 0 and 100 and
    contract_score between 0 and 100 and onboarding_score between 0 and 100 and support_score between 0 and 100 and
    renewal_score between 0 and 100 and demo_score between 0 and 100 and launch_operations_score between 0 and 100
  )
);

create index if not exists idx_commercial_sales_pipeline_stage on public.commercial_sales_pipeline(stage, next_follow_up_at, created_at desc);
create index if not exists idx_commercial_sales_pipeline_revenue on public.commercial_sales_pipeline(estimated_monthly_revenue_nis desc, probability desc);
create index if not exists idx_commercial_demo_lifecycle_status on public.commercial_demo_lifecycle(status, demo_date desc);
create index if not exists idx_commercial_offer_summaries_status on public.commercial_offer_summaries(status, valid_until);
create index if not exists idx_commercial_contract_readiness_status on public.commercial_contract_readiness(status, legal_review_status);
create index if not exists idx_commercial_onboarding_checklists_status on public.commercial_onboarding_checklists(status, owner_role);
create index if not exists idx_customer_success_handoffs_status on public.customer_success_handoffs(status, onboarding_deadline);
create index if not exists idx_commercial_renewal_operations_date on public.commercial_renewal_operations(renewal_date, renewal_risk_level);
create index if not exists idx_commercial_churn_risk_status on public.commercial_churn_risk_signals(risk_level, status, created_at desc);
create index if not exists idx_commercial_sales_tasks_due on public.commercial_sales_tasks(status, due_at, priority);
create index if not exists idx_commercial_launch_checklist_status on public.commercial_launch_checklist(category, status);

alter table public.commercial_pricing_models enable row level security;
alter table public.commercial_pricing_audit_logs enable row level security;
alter table public.commercial_packages enable row level security;
alter table public.commercial_sales_pipeline enable row level security;
alter table public.commercial_demo_lifecycle enable row level security;
alter table public.commercial_offer_summaries enable row level security;
alter table public.commercial_contract_readiness enable row level security;
alter table public.commercial_sla_readiness enable row level security;
alter table public.commercial_onboarding_checklists enable row level security;
alter table public.customer_success_handoffs enable row level security;
alter table public.launch_collateral_items enable row level security;
alter table public.demo_script_library enable row level security;
alter table public.commercial_objection_library enable row level security;
alter table public.referral_program_readiness enable row level security;
alter table public.commercial_renewal_operations enable row level security;
alter table public.commercial_churn_risk_signals enable row level security;
alter table public.revenue_forecast_snapshots enable row level security;
alter table public.commercial_metrics_snapshots enable row level security;
alter table public.commercial_sales_tasks enable row level security;
alter table public.commercial_launch_checklist enable row level security;
alter table public.commercial_launch_readiness_scores enable row level security;

drop policy if exists "commercial pricing models admin only" on public.commercial_pricing_models;
create policy "commercial pricing models admin only" on public.commercial_pricing_models for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial pricing audit admin only" on public.commercial_pricing_audit_logs;
create policy "commercial pricing audit admin only" on public.commercial_pricing_audit_logs for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial packages admin only" on public.commercial_packages;
create policy "commercial packages admin only" on public.commercial_packages for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial sales pipeline admin only" on public.commercial_sales_pipeline;
create policy "commercial sales pipeline admin only" on public.commercial_sales_pipeline for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial demo lifecycle admin only" on public.commercial_demo_lifecycle;
create policy "commercial demo lifecycle admin only" on public.commercial_demo_lifecycle for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial offer summaries admin only" on public.commercial_offer_summaries;
create policy "commercial offer summaries admin only" on public.commercial_offer_summaries for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial contract readiness admin only" on public.commercial_contract_readiness;
create policy "commercial contract readiness admin only" on public.commercial_contract_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial sla readiness admin only" on public.commercial_sla_readiness;
create policy "commercial sla readiness admin only" on public.commercial_sla_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial onboarding checklists admin only" on public.commercial_onboarding_checklists;
create policy "commercial onboarding checklists admin only" on public.commercial_onboarding_checklists for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "customer success handoffs admin only" on public.customer_success_handoffs;
create policy "customer success handoffs admin only" on public.customer_success_handoffs for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "launch collateral items admin only" on public.launch_collateral_items;
create policy "launch collateral items admin only" on public.launch_collateral_items for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "demo script library admin only" on public.demo_script_library;
create policy "demo script library admin only" on public.demo_script_library for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial objection library admin only" on public.commercial_objection_library;
create policy "commercial objection library admin only" on public.commercial_objection_library for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "referral program readiness admin only" on public.referral_program_readiness;
create policy "referral program readiness admin only" on public.referral_program_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial renewal operations admin only" on public.commercial_renewal_operations;
create policy "commercial renewal operations admin only" on public.commercial_renewal_operations for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial churn risk admin only" on public.commercial_churn_risk_signals;
create policy "commercial churn risk admin only" on public.commercial_churn_risk_signals for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "revenue forecast admin only" on public.revenue_forecast_snapshots;
create policy "revenue forecast admin only" on public.revenue_forecast_snapshots for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial metrics admin only" on public.commercial_metrics_snapshots;
create policy "commercial metrics admin only" on public.commercial_metrics_snapshots for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial sales tasks admin only" on public.commercial_sales_tasks;
create policy "commercial sales tasks admin only" on public.commercial_sales_tasks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial launch checklist admin only" on public.commercial_launch_checklist;
create policy "commercial launch checklist admin only" on public.commercial_launch_checklist for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "commercial launch readiness admin only" on public.commercial_launch_readiness_scores;
create policy "commercial launch readiness admin only" on public.commercial_launch_readiness_scores for all using (public.is_admin()) with check (public.is_admin());

insert into public.commercial_pricing_models (pricing_key, package_name, base_price_nis, included_classes, additional_class_price_nis, annual_commitment_required, monthly_billing_enabled, pilot_pricing_notes, enterprise_pricing_notes, metadata)
values ('gan-batuach-standard-2026', 'Gan Batuach Standard', 800, 1, 200, true, true, 'Pilot pricing requires admin approval and does not activate rewards automatically.', 'Enterprise/network pricing requires custom approval and contract review.', '{"phase":"170","currency":"ILS"}'::jsonb)
on conflict (pricing_key) do update set
  package_name = excluded.package_name,
  base_price_nis = excluded.base_price_nis,
  included_classes = excluded.included_classes,
  additional_class_price_nis = excluded.additional_class_price_nis,
  annual_commitment_required = excluded.annual_commitment_required,
  monthly_billing_enabled = excluded.monthly_billing_enabled,
  pilot_pricing_notes = excluded.pilot_pricing_notes,
  enterprise_pricing_notes = excluded.enterprise_pricing_notes,
  updated_at = now();

insert into public.commercial_packages (package_key, package_name, positioning, included_capabilities, status, notes)
values (
  'gan-batuach-standard',
  'Gan Batuach Standard',
  'All-in-one trust, management, compliance and safety-readiness package for kindergartens.',
  '["kindergarten management","parent portal","staff portal","inspector portal","monthly supervision readiness","compliance engine","documents","payments","AI observer readiness","camera readiness","trust center","support"]'::jsonb,
  'active',
  'Core value is not fragmented into feature add-ons.'
)
on conflict (package_key) do update set
  positioning = excluded.positioning,
  included_capabilities = excluded.included_capabilities,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.commercial_sales_pipeline (opportunity_key, kindergarten_name, contact_name, city, lead_source, stage, probability, age_groups_count, estimated_classes, estimated_monthly_revenue_nis, estimated_annual_revenue_nis, next_follow_up_at, notes)
values
  ('commercial-first-pilot-followup', 'גן פיילוט ראשון', 'מנהלת הגן', 'לא נבחר', 'manual_admin', 'onboarding', 55, 1, 1, 800, 9600, now() + interval '3 days', 'Post-pilot stabilization commercial follow-up placeholder.'),
  ('commercial-parent-demand-high', 'גן עם ביקוש הורים גבוה', 'טרם נקבע', 'לא נבחר', 'parent_demand', 'new_lead', 35, 1, 1, 800, 9600, now() + interval '1 day', 'Contact kindergarten when parent demand cluster is validated.')
on conflict (opportunity_key) do update set
  stage = excluded.stage,
  probability = excluded.probability,
  estimated_monthly_revenue_nis = excluded.estimated_monthly_revenue_nis,
  estimated_annual_revenue_nis = excluded.estimated_annual_revenue_nis,
  next_follow_up_at = excluded.next_follow_up_at,
  notes = excluded.notes,
  updated_at = now();

with first_opp as (
  select id, kindergarten_name, city from public.commercial_sales_pipeline where opportunity_key = 'commercial-first-pilot-followup'
)
insert into public.commercial_demo_lifecycle (opportunity_id, demo_key, status, demo_date, contact_person, kindergarten_name, city, notes, next_step)
select id, 'first-pilot-commercial-demo', 'follow_up_needed', now() + interval '7 days', 'מנהלת הגן', kindergarten_name, city, 'Demo script should focus on all-in-one management, trust, compliance and launch limitations.', 'Send commercial offer after pilot blockers are reviewed.'
from first_opp
on conflict (demo_key) do update set status = excluded.status, next_step = excluded.next_step, updated_at = now();

with first_opp as (
  select id, kindergarten_name from public.commercial_sales_pipeline where opportunity_key = 'commercial-first-pilot-followup'
)
insert into public.commercial_offer_summaries (opportunity_id, offer_key, kindergarten_name, selected_classes, monthly_charge_nis, total_annual_value_nis, valid_until, status, notes)
select id, 'first-pilot-standard-offer', kindergarten_name, 1, 800, 9600, current_date + interval '30 days', 'draft', 'PDF-ready commercial summary. Not a final legal contract.'
from first_opp
on conflict (offer_key) do update set monthly_charge_nis = excluded.monthly_charge_nis, total_annual_value_nis = excluded.total_annual_value_nis, valid_until = excluded.valid_until, updated_at = now();

with first_opp as (
  select id, kindergarten_name from public.commercial_sales_pipeline where opportunity_key = 'commercial-first-pilot-followup'
)
insert into public.commercial_contract_readiness (opportunity_id, contract_key, contract_type, customer_name, status, legal_review_status, document_path, notes)
select id, 'first-pilot-standard-contract-draft', 'standard_kindergarten_agreement', kindergarten_name, 'draft', 'draft_for_legal_review', 'KINDERGARTEN_COMMERCIAL_TERMS_REVIEW_PACK.md', 'DRAFT FOR LEGAL REVIEW only.'
from first_opp
on conflict (contract_key) do update set status = excluded.status, legal_review_status = excluded.legal_review_status, notes = excluded.notes, updated_at = now();

insert into public.commercial_sla_readiness (sla_key, area, title, status, service_scope, support_hours, response_time, escalation_rule, uptime_target, maintenance_notice_rule, limitation_note)
values
  ('sla-service-scope','service_scope','Service scope readiness','ready_for_review','Gan Batuach Standard: management, trust, compliance readiness, documents, payments, portals and support readiness.','Business hours plus pilot escalation window','Initial response targets are draft.','Critical launch blockers escalate to admin/support owner.','Uptime target is readiness-only until external review.','Maintenance notice rules require approval.','Camera/AI/legal limitations apply.'),
  ('sla-camera-ai-limitations','camera_ai_limitations','Camera and AI limitations','ready_for_review','Camera and observer features are readiness-controlled and policy-gated.','Support only after approved deployment','Critical issues same day during pilot','Escalate privacy/security issues immediately.','No availability promise for unapproved camera gateway providers.','Notify customers before maintenance where possible.','No parent AI visibility or automatic decisions.')
on conflict (sla_key) do update set status = excluded.status, limitation_note = excluded.limitation_note, updated_at = now();

with first_opp as (
  select id from public.commercial_sales_pipeline where opportunity_key = 'commercial-first-pilot-followup'
)
insert into public.commercial_onboarding_checklists (opportunity_id, checklist_key, title, status, owner_role)
select first_opp.id, item.checklist_key, item.title, 'pending', item.owner_role
from first_opp
cross join (values
  ('contract-signed','Contract signed','sales'),
  ('subscription-active','Subscription active','billing'),
  ('payment-method-set','Payment method set','billing'),
  ('invoice-issued','Invoice issued','billing'),
  ('manager-onboarded','Manager onboarded','customer_success'),
  ('staff-invited','Staff invited','customer_success'),
  ('parents-invited','Parents invited','customer_success'),
  ('documents-uploaded','Documents uploaded','customer_success'),
  ('support-contact-assigned','Support contact assigned','support'),
  ('training-completed','Training completed','customer_success'),
  ('first-inspection-scheduled','First inspection scheduled','operations')
) as item(checklist_key, title, owner_role)
on conflict (opportunity_id, checklist_key) do update set title = excluded.title, owner_role = excluded.owner_role, updated_at = now();

with first_opp as (
  select id, kindergarten_name, estimated_monthly_revenue_nis from public.commercial_sales_pipeline where opportunity_key = 'commercial-first-pilot-followup'
)
insert into public.customer_success_handoffs (opportunity_id, handoff_key, customer_details, plan_summary, expectations, known_risks, onboarding_deadline, support_notes, promised_features, decision_maker, status)
select id, 'first-pilot-cs-handoff', jsonb_build_object('kindergarten_name', kindergarten_name), 'Gan Batuach Standard, estimated MRR ' || estimated_monthly_revenue_nis || ' NIS', 'Controlled onboarding after contract and data approval.', 'Legal/privacy/security approval remains required.', current_date + interval '21 days', 'Assign named support owner and daily first-week review.', 'No unapproved camera/AI parent visibility promised.', 'Manager', 'draft'
from first_opp
on conflict (handoff_key) do update set status = excluded.status, known_risks = excluded.known_risks, updated_at = now();

insert into public.launch_collateral_items (collateral_key, collateral_type, title, audience, status, document_path, owner, notes)
values
  ('sales-deck','sales_deck','Gan Batuach sales deck','manager','draft','COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM.md','Sales','Create polished deck before active selling.'),
  ('pricing-sheet','pricing_sheet','Gan Batuach Standard pricing sheet','manager','ready_for_review','COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM.md','Sales','800 NIS base + 200 NIS additional class.'),
  ('demo-script','demo_script','Commercial demo script','sales','ready_for_review','COMMERCIAL_LAUNCH_READINESS_AND_SALES_OPERATIONS_PLATFORM.md','Sales','Use clear story and non-technical claims.'),
  ('privacy-security-summary','privacy_security_summary','Privacy and security summary','manager','ready_for_review','EXTERNAL_LEGAL_PRIVACY_AND_REGULATORY_REVIEW_PACK.md','Legal','Must remain draft until legal review.')
on conflict (collateral_key) do update set status = excluded.status, document_path = excluded.document_path, updated_at = now();

insert into public.demo_script_library (script_key, audience, title, story, screens_to_show, key_value_points, common_objections, closing_question, status)
values
  ('manager-demo-script','kindergarten_manager','Manager commercial demo','Show how one workday becomes simpler, safer and more transparent.', '["Command center","Children","Parents","Staff","Documents","Compliance","Trust center"]'::jsonb, '["All-in-one package","Less manual chasing","Parent trust","Compliance readiness"]'::jsonb, '["זה יקר","כבר יש לי מערכת","מה עם פרטיות"]'::jsonb, 'מה צריך להיות נכון כדי שתתחילו פיילוט מסודר?', 'ready_for_review'),
  ('parent-demo-script','parent','Parent trust demo','Explain transparency without exposing everything.', '["Trust center","Messages","Child timeline","Approved safety updates"]'::jsonb, '["שקיפות מבוקרת","תקשורת טובה יותר","עדכונים מאושרים"]'::jsonb, '["הורים לא ירצו מצלמות","מה עם פרטיות"]'::jsonb, 'איזה מידע יעזור לכם להרגיש בטוחים יותר בלי לפגוע בפרטיות?', 'ready_for_review')
on conflict (script_key) do update set status = excluded.status, updated_at = now();

insert into public.commercial_objection_library (objection_key, objection, answer, category, status)
values
  ('too-expensive','זה יקר','המודל הוא חבילה אחת שמחליפה הרבה עבודה ידנית: ניהול, מסמכים, הורים, צוות, תשלומים, מוכנות פיקוח ושקיפות. מתחילים מהיקף ברור ומודדים ערך בפיילוט.', 'price', 'approved'),
  ('already-have-system','כבר יש לי מערכת','גן בטוח לא בא רק להיות תוכנת ניהול. הוא שכבת אמון, ציות, מוכנות פיקוח ותפעול מסודר סביב הגן.', 'competition', 'approved'),
  ('parents-do-not-want-cameras','הורים לא ירצו מצלמות','צפייה במצלמות אינה ברירת מחדל. היא כפופה לאישור, מדיניות, שעות צפייה, הרשאות ופרטיות.', 'cameras', 'needs_legal_review'),
  ('privacy-question','מה עם פרטיות?','השקיפות היא מבוקרת: הורים רואים רק מידע מאושר ורלוונטי. מידע פנימי, AI גולמי וחקירות לא נחשפים.', 'privacy', 'needs_legal_review'),
  ('is-it-legal','האם זה חוקי?','המערכת מוכנה לסקירה משפטית ומפעילה יכולות לפי מדיניות. אישור סופי דורש אנשי מקצוע חיצוניים ואינו נטען מראש.', 'legal', 'needs_legal_review'),
  ('small-kindergarten','האם זה מתאים לגנים קטנים?','כן, החבילה מתחילה בכיתה/קבוצת גיל אחת ומתאימה לגנים שרוצים סדר, אמון ותפעול מקצועי בלי לבנות צוות טכנולוגי.', 'small_kindergarten', 'approved')
on conflict (objection_key) do update set answer = excluded.answer, status = excluded.status, updated_at = now();

insert into public.referral_program_readiness (referral_key, referral_type, reward_type, reward_value, status, notes)
values
  ('kindergarten-referral','kindergarten','discount_or_credit','Admin configured only','draft','Reward cannot activate without admin configuration.'),
  ('parent-referral','parent','demand_request','Parent invites other parents to request Gan Batuach','draft','No monetary reward active by default.'),
  ('partner-referral','partner','custom','Consultants, inspectors, suppliers','draft','Requires partner agreement review.')
on conflict (referral_key) do update set status = excluded.status, notes = excluded.notes, updated_at = now();

insert into public.revenue_forecast_snapshots (snapshot_key, current_mrr_nis, projected_mrr_nis, current_arr_nis, projected_arr_nis, pipeline_value_nis, expected_conversions, renewal_risk_impact_nis, metadata)
values ('commercial-launch-baseline', 0, 1600, 0, 19200, 19200, 2, 0, '{"phase":"170","basis":"seeded_pipeline_readiness"}'::jsonb)
on conflict (snapshot_key) do update set
  projected_mrr_nis = excluded.projected_mrr_nis,
  projected_arr_nis = excluded.projected_arr_nis,
  pipeline_value_nis = excluded.pipeline_value_nis,
  expected_conversions = excluded.expected_conversions,
  calculated_at = now();

insert into public.commercial_metrics_snapshots (snapshot_key, lead_to_demo_conversion, demo_to_customer_conversion, registration_to_activation_conversion, parent_demand_to_lead_conversion, activation_time_days, churn_rate, renewal_rate, average_revenue_per_kindergarten_nis, average_classes_per_kindergarten)
values ('commercial-launch-baseline-metrics', 0, 0, 0, 0, 0, 0, 0, 800, 1)
on conflict (snapshot_key) do update set average_revenue_per_kindergarten_nis = excluded.average_revenue_per_kindergarten_nis, calculated_at = now();

insert into public.commercial_sales_tasks (task_key, task_type, title, status, priority, due_at, owner, notes)
values
  ('follow-up-first-pilot-commercial','follow_up_after_demo','Follow up after first pilot commercial demo','open','high',now() + interval '3 days','Sales','Review pilot blockers before sending proposal.'),
  ('call-high-demand-kindergarten','call_high_demand_kindergarten','Call high-demand kindergarten from parent requests','open','high',now() + interval '1 day','Sales','Use parent demand count, not pressure language.'),
  ('prepare-renewal-playbook','prepare_renewal','Prepare renewal reminder playbook','open','medium',now() + interval '14 days','Customer Success','90/60/30/14/7 day reminders.')
on conflict (task_key) do update set status = excluded.status, due_at = excluded.due_at, notes = excluded.notes, updated_at = now();

insert into public.commercial_launch_checklist (checklist_key, title, category, status, required, evidence_summary, owner)
values
  ('website-forms-working','Website forms working','website','in_progress',true,'Book demo, kindergarten registration and parent demand routes exist; production smoke test still required.','Growth'),
  ('leads-working','Leads working','leads','in_progress',true,'Growth lead model exists; conversion QA required.','Growth'),
  ('demo-booking-working','Demo booking working','demo','in_progress',true,'Demo lifecycle model added.','Sales'),
  ('registration-flow-working','Registration flow working','registration','in_progress',true,'Kindergarten onboarding exists; commercial handoff validation required.','Customer Success'),
  ('payment-flow-ready','Payment flow ready','payment','blocked',true,'Live mode requires explicit provider/legal/billing approval.','Billing'),
  ('invoices-ready','Invoices ready','invoice','in_progress',true,'Invoice readiness exists; provider activation remains external setup.','Billing'),
  ('onboarding-ready','Onboarding ready','onboarding','in_progress',true,'Commercial onboarding checklist added.','Customer Success'),
  ('support-ready','Support ready','support','in_progress',true,'Support and CS center exist; launch staffing confirmation required.','Support'),
  ('terms-drafted','Terms drafted','terms','in_progress',true,'Draft for legal review only.','Legal'),
  ('privacy-drafted','Privacy drafted','privacy','in_progress',true,'Draft for legal review only.','Legal'),
  ('sales-materials-ready','Sales materials ready','sales_materials','in_progress',true,'Collateral repository seeded.','Sales'),
  ('demo-environment-ready','Demo environment ready','demo_environment','pending',true,'Needs approved demo data and scripted flow.','Sales')
on conflict (checklist_key) do update set status = excluded.status, evidence_summary = excluded.evidence_summary, updated_at = now();

insert into public.commercial_launch_readiness_scores (snapshot_key, commercial_readiness_score, pricing_score, pipeline_score, contract_score, onboarding_score, support_score, renewal_score, demo_score, launch_operations_score, status, notes)
values ('commercial-launch-baseline-readiness', 58, 85, 60, 45, 55, 65, 40, 55, 50, 'preparing', 'Commercial readiness layer is prepared. Live sales requires legal contract approval, payment provider readiness, demo environment validation and staffed customer success.')
on conflict (snapshot_key) do update set
  commercial_readiness_score = excluded.commercial_readiness_score,
  pricing_score = excluded.pricing_score,
  pipeline_score = excluded.pipeline_score,
  contract_score = excluded.contract_score,
  onboarding_score = excluded.onboarding_score,
  support_score = excluded.support_score,
  renewal_score = excluded.renewal_score,
  demo_score = excluded.demo_score,
  launch_operations_score = excluded.launch_operations_score,
  status = excluded.status,
  notes = excluded.notes,
  calculated_at = now();

comment on table public.commercial_pricing_models is 'Commercial pricing model for Gan Batuach Standard: base 800 NIS/month plus 200 NIS/additional class.';
comment on table public.commercial_sales_pipeline is 'Commercial sales opportunities across leads, demos, proposals, onboarding, active customers and lost/deferred deals.';
comment on table public.commercial_demo_lifecycle is 'Demo lifecycle management: booked, confirmed, completed, follow-up, converted or not relevant.';
comment on table public.commercial_offer_summaries is 'PDF-ready commercial offer summaries. Not legal contracts.';
comment on table public.commercial_contract_readiness is 'Contract readiness workflow. Drafts remain DRAFT FOR LEGAL REVIEW until approved externally.';
comment on table public.commercial_sla_readiness is 'SLA readiness model for scope, support, response, escalation, uptime, maintenance and limitations.';
comment on table public.customer_success_handoffs is 'Sales to Customer Success handoff records after a sale closes.';
comment on table public.launch_collateral_items is 'Internal launch collateral repository for sales and onboarding materials.';
comment on table public.demo_script_library is 'Demo scripts by audience, including screens, story, objections and closing question.';
comment on table public.commercial_objection_library is 'Plain-language objection handling library for sales operations.';
comment on table public.commercial_renewal_operations is 'Renewal tracking, reminders and risk readiness.';
comment on table public.commercial_churn_risk_signals is 'Churn risk dashboard signals from usage, tickets, payments, onboarding and complaints.';
comment on table public.revenue_forecast_snapshots is 'MRR, ARR, pipeline and renewal risk forecast snapshots.';
comment on table public.commercial_launch_checklist is 'Pre-commercial launch checklist for website, leads, demos, payments, onboarding, support, terms and sales materials.';

notify pgrst, 'reload schema';
