-- PHASE 186: National Inspection Workforce Operations
-- Operational inspector workforce model. Human inspection remains mandatory.

create table if not exists public.inspection_workforce_profiles (
  id uuid primary key default gen_random_uuid(),
  inspector_profile_id uuid references public.profiles(id) on delete set null,
  region text,
  city_coverage text[] not null default '{}',
  active_status text not null default 'candidate' check (active_status in ('candidate', 'training', 'active', 'paused', 'suspended', 'inactive')),
  employment_type text not null default 'contractor' check (employment_type in ('employee', 'contractor', 'part_time', 'external_partner')),
  monthly_capacity integer not null default 0,
  assigned_kindergarten_count integer not null default 0,
  completed_inspections integer not null default 0,
  overdue_inspections integer not null default 0,
  compensation_model text not null default 'per_kindergarten_monthly' check (compensation_model in ('per_kindergarten_monthly', 'per_inspection_completed', 'fixed_monthly_salary', 'hybrid')),
  certification_status text not null default 'missing' check (certification_status in ('missing', 'uploaded', 'under_review', 'approved', 'expired', 'rejected')),
  training_status text not null default 'not_started' check (training_status in ('not_started', 'in_progress', 'completed', 'expired', 'blocked')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  primary_inspector_id uuid references public.profiles(id) on delete set null,
  backup_inspector_id uuid references public.profiles(id) on delete set null,
  regional_supervisor_id uuid references public.profiles(id) on delete set null,
  region text,
  city text,
  kindergarten_network text,
  assignment_method text not null default 'manual_admin_assignment' check (assignment_method in ('region', 'city', 'kindergarten_network', 'manual_admin_assignment', 'workload_balancing')),
  workload_score integer not null default 0 check (workload_score between 0 and 100),
  status text not null default 'active' check (status in ('planned', 'active', 'paused', 'needs_review', 'ended')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_capacity_models (
  id uuid primary key default gen_random_uuid(),
  model_key text not null unique,
  scenario_name text not null,
  inspections_per_month integer not null default 0,
  average_inspection_duration_minutes integer not null default 90,
  average_travel_time_minutes integer not null default 45,
  report_writing_minutes integer not null default 30,
  follow_up_inspection_rate numeric(6,2) not null default 0,
  complaint_inspection_rate numeric(6,2) not null default 0,
  urgent_inspection_buffer_percent numeric(6,2) not null default 10,
  work_days_per_month integer not null default 20,
  max_kindergartens_per_inspector numeric(8,2) not null default 0,
  overload_risk text not null default 'medium' check (overload_risk in ('low', 'medium', 'high', 'critical')),
  recommended_hiring_point text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_monthly_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  plan_month date not null,
  inspector_id uuid references public.profiles(id) on delete set null,
  region text,
  week_number integer,
  inspections_due integer not null default 0,
  inspections_scheduled integer not null default 0,
  overdue_inspections integer not null default 0,
  follow_up_inspections integer not null default 0,
  complaint_driven_inspections integer not null default 0,
  urgent_visits integer not null default 0,
  unassigned_kindergartens integer not null default 0,
  overload_status text not null default 'tracking' check (overload_status in ('healthy', 'tracking', 'overloaded', 'blocked')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  assigned_inspector_id uuid references public.profiles(id) on delete set null,
  backup_inspector_id uuid references public.profiles(id) on delete set null,
  inspection_type text not null default 'monthly_routine' check (inspection_type in ('monthly_routine', 'follow_up', 'surprise', 'urgent', 'complaint_driven')),
  scheduled_date timestamptz,
  expected_duration_minutes integer not null default 90,
  location_text text,
  status text not null default 'scheduled' check (status in ('planned', 'scheduled', 'in_progress', 'completed', 'cancelled', 'rescheduled', 'missed')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_routes (
  id uuid primary key default gen_random_uuid(),
  route_key text not null unique,
  inspector_id uuid references public.profiles(id) on delete set null,
  route_date date,
  region text,
  city text,
  kindergarten_addresses jsonb not null default '[]'::jsonb,
  travel_distance_estimate_km numeric(10,2) not null default 0,
  daily_inspection_route jsonb not null default '[]'::jsonb,
  time_window text,
  map_provider_readiness text not null default 'not_configured' check (map_provider_readiness in ('not_configured', 'google_maps_ready', 'waze_ready', 'mapbox_ready', 'manual_only')),
  status text not null default 'planning' check (status in ('planning', 'ready', 'in_progress', 'completed', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_compensation (
  id uuid primary key default gen_random_uuid(),
  compensation_key text not null unique,
  inspector_id uuid references public.profiles(id) on delete set null,
  compensation_model text not null default 'per_kindergarten_monthly' check (compensation_model in ('per_kindergarten_monthly', 'per_inspection_completed', 'fixed_monthly_salary', 'hybrid')),
  base_amount_nis numeric(12,2) not null default 0,
  per_kindergarten_amount_nis numeric(12,2) not null default 50,
  per_inspection_amount_nis numeric(12,2) not null default 0,
  bonus_nis numeric(12,2) not null default 0,
  deductions_nis numeric(12,2) not null default 0,
  assigned_kindergarten_count integer not null default 0,
  completed_inspections_count integer not null default 0,
  follow_up_inspections_count integer not null default 0,
  estimated_monthly_payout_nis numeric(12,2) not null default 0,
  payout_status text not null default 'estimated' check (payout_status in ('estimated', 'approved', 'paid', 'held', 'disputed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_financial_forecasts (
  id uuid primary key default gen_random_uuid(),
  forecast_key text not null unique,
  scenario_kindergartens integer not null check (scenario_kindergartens in (25, 50, 100, 250, 500, 1000)),
  inspectors_needed numeric(8,2) not null default 0,
  inspector_cost_nis numeric(12,2) not null default 0,
  expected_revenue_nis numeric(12,2) not null default 0,
  support_cost_estimate_nis numeric(12,2) not null default 0,
  infrastructure_cost_estimate_nis numeric(12,2) not null default 0,
  contribution_margin_nis numeric(12,2) not null default 0,
  operational_risk text not null default 'medium' check (operational_risk in ('low', 'medium', 'high', 'critical')),
  hiring_forecast text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_performance (
  id uuid primary key default gen_random_uuid(),
  performance_key text not null unique,
  inspector_id uuid references public.profiles(id) on delete cascade,
  metric_month date not null,
  inspections_assigned integer not null default 0,
  inspections_completed integer not null default 0,
  overdue_inspections integer not null default 0,
  average_completion_hours numeric(10,2) not null default 0,
  gps_validation_rate numeric(6,2) not null default 0,
  report_quality_score integer not null default 0 check (report_quality_score between 0 and 100),
  corrective_action_follow_up_score integer not null default 0 check (corrective_action_follow_up_score between 0 and 100),
  complaint_handling_score integer not null default 0 check (complaint_handling_score between 0 and 100),
  manager_feedback_score integer not null default 0 check (manager_feedback_score between 0 and 100),
  admin_review_score integer not null default 0 check (admin_review_score between 0 and 100),
  inspector_performance_score integer not null default 0 check (inspector_performance_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  inspector_id uuid references public.profiles(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  issue_type text not null check (issue_type in ('incomplete_form', 'missing_gps', 'missing_signature', 'weak_notes', 'missing_photos_evidence', 'late_report', 'repeated_corrections')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  quality_task text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'fixed', 'verified', 'deferred')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_training (
  id uuid primary key default gen_random_uuid(),
  training_key text not null unique,
  inspector_id uuid references public.profiles(id) on delete cascade,
  module_name text not null,
  module_type text not null check (module_type in ('inspection_standard', 'child_safety_basics', 'documentation_requirements', 'gps_validation', 'digital_forms', 'evidence_upload', 'complaint_handling', 'privacy_confidentiality', 'camera_ai_boundaries', 'professional_conduct')),
  completion_status text not null default 'not_started' check (completion_status in ('not_started', 'in_progress', 'completed', 'expired', 'blocked')),
  completed_at timestamptz,
  expires_at date,
  trainer text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_certifications (
  id uuid primary key default gen_random_uuid(),
  certification_key text not null unique,
  inspector_id uuid references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('id_verification', 'background_check_readiness', 'training_completion', 'confidentiality_agreement', 'service_agreement', 'professional_certification', 'insurance_contractor_documents')),
  status text not null default 'missing' check (status in ('missing', 'uploaded', 'under_review', 'approved', 'expired', 'rejected')),
  uploaded_at timestamptz,
  reviewed_at timestamptz,
  expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null unique,
  full_name text not null,
  phone text,
  email text,
  region text,
  availability text,
  experience text,
  expected_pay_nis numeric(12,2),
  status text not null default 'lead' check (status in ('lead', 'contacted', 'interview', 'documents_requested', 'training', 'approved', 'active', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_slas (
  id uuid primary key default gen_random_uuid(),
  sla_key text not null unique,
  sla_type text not null check (sla_type in ('monthly_inspection_completion', 'complaint_response_time', 'urgent_inspection_response', 'report_submission_deadline', 'corrective_action_follow_up')),
  target_hours integer not null,
  current_breaches integer not null default 0,
  status text not null default 'tracking' check (status in ('healthy', 'tracking', 'breached', 'blocked')),
  owner text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  recipient_type text not null check (recipient_type in ('inspector', 'admin')),
  inspector_id uuid references public.profiles(id) on delete set null,
  alert_type text not null check (alert_type in ('upcoming_inspection', 'overdue_inspection', 'new_complaint_assignment', 'follow_up_due', 'missing_report', 'gps_validation_issue', 'document_expiration', 'schedule_change', 'overloaded_inspector', 'region_without_coverage', 'sla_breach', 'repeated_late_reports', 'missing_inspector_documents', 'high_complaint_region', 'inspector_cost_exceeding_forecast')),
  channel_readiness jsonb not null default '{"in_app":true,"email":true,"sms_whatsapp_readiness":true,"push_readiness":true}'::jsonb,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'sent', 'acknowledged', 'resolved', 'skipped')),
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  inspector_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  event_type text not null check (event_type in ('assignment_changed', 'schedule_changed', 'inspection_submitted', 'gps_validated', 'evidence_uploaded', 'signature_added', 'report_edited', 'compensation_calculated', 'admin_override')),
  event_title text not null,
  event_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_risks (
  id uuid primary key default gen_random_uuid(),
  risk_key text not null unique,
  category text not null check (category in ('staffing', 'coverage', 'quality', 'cost', 'sla', 'legal_privacy', 'operational', 'reputation')),
  risk text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  mitigation text,
  owner text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'mitigated', 'accepted_risk', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inspection_workforce_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  active_inspectors integer not null default 0,
  assigned_kindergartens integer not null default 0,
  inspections_due_this_month integer not null default 0,
  overdue_inspections integer not null default 0,
  follow_up_inspections integer not null default 0,
  complaint_driven_inspections integer not null default 0,
  regional_coverage_score integer not null default 0 check (regional_coverage_score between 0 and 100),
  workload_score integer not null default 0 check (workload_score between 0 and 100),
  compensation_score integer not null default 0 check (compensation_score between 0 and 100),
  training_score integer not null default 0 check (training_score between 0 and 100),
  performance_score integer not null default 0 check (performance_score between 0 and 100),
  workforce_readiness_score integer not null default 0 check (workforce_readiness_score between 0 and 100),
  staffing_gaps jsonb not null default '[]'::jsonb,
  calculated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'inspection_workforce_profiles',
    'inspection_workforce_assignments',
    'inspection_workforce_capacity_models',
    'inspection_workforce_monthly_plans',
    'inspection_workforce_schedules',
    'inspection_workforce_routes',
    'inspection_workforce_compensation',
    'inspection_workforce_financial_forecasts',
    'inspection_workforce_performance',
    'inspection_workforce_quality_reviews',
    'inspection_workforce_training',
    'inspection_workforce_certifications',
    'inspection_workforce_candidates',
    'inspection_workforce_slas',
    'inspection_workforce_alerts',
    'inspection_workforce_audit_events',
    'inspection_workforce_risks',
    'inspection_workforce_readiness_scores'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%I admin manage" on public.%I', table_name, table_name);
    execute format('create policy "%I admin manage" on public.%I for all using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
  end loop;
end $$;

create index if not exists idx_workforce_profiles_status_region on public.inspection_workforce_profiles(active_status, region);
create index if not exists idx_workforce_assignments_region_city on public.inspection_workforce_assignments(region, city, status);
create index if not exists idx_workforce_monthly_plans_month on public.inspection_workforce_monthly_plans(plan_month, region, overload_status);
create index if not exists idx_workforce_schedules_inspector on public.inspection_workforce_schedules(assigned_inspector_id, scheduled_date, status);
create index if not exists idx_workforce_routes_inspector_date on public.inspection_workforce_routes(inspector_id, route_date, status);
create index if not exists idx_workforce_compensation_inspector on public.inspection_workforce_compensation(inspector_id, payout_status);
create index if not exists idx_workforce_performance_month on public.inspection_workforce_performance(metric_month desc, inspector_id);
create index if not exists idx_workforce_quality_status on public.inspection_workforce_quality_reviews(status, severity);
create index if not exists idx_workforce_training_status on public.inspection_workforce_training(completion_status, module_type);
create index if not exists idx_workforce_certifications_status on public.inspection_workforce_certifications(status, document_type);
create index if not exists idx_workforce_candidates_status_region on public.inspection_workforce_candidates(status, region);
create index if not exists idx_workforce_slas_status on public.inspection_workforce_slas(status, sla_type);
create index if not exists idx_workforce_alerts_status on public.inspection_workforce_alerts(status, severity);
create index if not exists idx_workforce_audit_created on public.inspection_workforce_audit_events(created_at desc);
create index if not exists idx_workforce_risks_status on public.inspection_workforce_risks(status, severity);
create index if not exists idx_workforce_readiness_calculated on public.inspection_workforce_readiness_scores(calculated_at desc);

insert into public.inspection_workforce_capacity_models (
  model_key,
  scenario_name,
  inspections_per_month,
  average_inspection_duration_minutes,
  average_travel_time_minutes,
  report_writing_minutes,
  follow_up_inspection_rate,
  complaint_inspection_rate,
  urgent_inspection_buffer_percent,
  work_days_per_month,
  max_kindergartens_per_inspector,
  overload_risk,
  recommended_hiring_point
) values
  ('capacity-25-kindergartens', '25 kindergarten workforce scenario', 25, 90, 45, 30, 12, 6, 10, 20, 18, 'medium', 'One lead inspector plus backup coverage.'),
  ('capacity-50-kindergartens', '50 kindergarten workforce scenario', 50, 90, 45, 30, 12, 6, 10, 20, 18, 'medium', 'Hire or contract at least three inspectors before 50 active gardens.'),
  ('capacity-100-kindergartens', '100 kindergarten workforce scenario', 100, 90, 45, 30, 12, 6, 12, 20, 18, 'high', 'Six inspectors or route-optimized equivalent before 100 active gardens.'),
  ('capacity-250-kindergartens', '250 kindergarten workforce scenario', 250, 90, 45, 30, 12, 6, 15, 20, 17, 'critical', 'Regional inspection operations team required.'),
  ('capacity-500-kindergartens', '500 kindergarten workforce scenario', 500, 90, 45, 30, 12, 6, 15, 20, 17, 'critical', 'National inspector workforce required.'),
  ('capacity-1000-kindergartens', '1000 kindergarten workforce scenario', 1000, 90, 45, 30, 12, 6, 18, 20, 16, 'critical', 'National workforce and supervisor hierarchy required.')
on conflict (model_key) do update set
  max_kindergartens_per_inspector = excluded.max_kindergartens_per_inspector,
  overload_risk = excluded.overload_risk,
  updated_at = now();

insert into public.inspection_workforce_financial_forecasts (
  forecast_key,
  scenario_kindergartens,
  inspectors_needed,
  inspector_cost_nis,
  expected_revenue_nis,
  support_cost_estimate_nis,
  infrastructure_cost_estimate_nis,
  contribution_margin_nis,
  operational_risk,
  hiring_forecast
) values
  ('workforce-financial-25', 25, 1.4, 1250, 27500, 3500, 1600, 21150, 'medium', 'Part-time inspector coverage with backup.'),
  ('workforce-financial-50', 50, 2.8, 2500, 55000, 7000, 3200, 42300, 'medium', 'At least three inspectors or mixed contractor coverage.'),
  ('workforce-financial-100', 100, 5.6, 5000, 110000, 14000, 6500, 84500, 'high', 'Six inspectors and regional scheduling owner.'),
  ('workforce-financial-250', 250, 14.0, 12500, 275000, 35000, 16000, 211500, 'critical', 'Dedicated regional workforce operations.'),
  ('workforce-financial-500', 500, 28.0, 25000, 550000, 70000, 32000, 423000, 'critical', 'National inspection operations team.'),
  ('workforce-financial-1000', 1000, 62.0, 50000, 1100000, 140000, 70000, 840000, 'critical', 'Supervisor hierarchy and workforce QA team required.')
on conflict (forecast_key) do update set
  inspectors_needed = excluded.inspectors_needed,
  contribution_margin_nis = excluded.contribution_margin_nis,
  updated_at = now();

insert into public.inspection_workforce_slas (
  sla_key, sla_type, target_hours, current_breaches, status, owner, notes
) values
  ('sla-monthly-inspection', 'monthly_inspection_completion', 720, 0, 'tracking', 'Inspection Ops', 'Every assigned kindergarten receives one monthly inspection.'),
  ('sla-complaint-response', 'complaint_response_time', 48, 0, 'tracking', 'Inspection Ops', 'High severity complaints require reviewed inspector response.'),
  ('sla-urgent-inspection', 'urgent_inspection_response', 24, 0, 'tracking', 'Inspection Ops', 'Urgent visits require human approval and assigned inspector.'),
  ('sla-report-submission', 'report_submission_deadline', 24, 0, 'tracking', 'Inspection Ops', 'Inspector report should be submitted within 24 hours of visit.'),
  ('sla-corrective-followup', 'corrective_action_follow_up', 168, 0, 'tracking', 'Compliance Ops', 'Corrective actions must be reviewed within one week after due date.')
on conflict (sla_key) do update set
  target_hours = excluded.target_hours,
  updated_at = now();

insert into public.inspection_workforce_candidates (
  candidate_key, full_name, phone, email, region, availability, experience, expected_pay_nis, status, notes
) values
  ('candidate-center-baseline', 'Inspector Candidate - Center', null, null, 'Center', '3 days/week', 'Childcare or inspection background preferred', 2500, 'lead', 'Baseline recruitment placeholder.'),
  ('candidate-sharon-baseline', 'Inspector Candidate - Sharon', null, null, 'Sharon', '2 days/week', 'Regional coverage candidate', 2000, 'lead', 'Needed before scaling beyond central region.')
on conflict (candidate_key) do update set
  status = excluded.status,
  updated_at = now();

insert into public.inspection_workforce_training (
  training_key, module_name, module_type, completion_status, trainer, notes
) values
  ('training-standard-baseline', 'Gan Batuach inspection standard', 'inspection_standard', 'not_started', 'Inspection Ops', 'Core standard for every inspector.'),
  ('training-child-safety-baseline', 'Child safety basics', 'child_safety_basics', 'not_started', 'Inspection Ops', 'Safety and professional conduct.'),
  ('training-documentation-baseline', 'Documentation requirements', 'documentation_requirements', 'not_started', 'Inspection Ops', 'Forms, evidence and report quality.'),
  ('training-gps-baseline', 'GPS validation', 'gps_validation', 'not_started', 'Inspection Ops', 'Location validation and edge cases.'),
  ('training-privacy-baseline', 'Privacy and confidentiality', 'privacy_confidentiality', 'not_started', 'Security', 'No child, medical, camera or complaint data leakage.'),
  ('training-camera-ai-boundaries-baseline', 'Camera and AI observer boundaries', 'camera_ai_boundaries', 'not_started', 'AI Governance', 'Observer assists prioritization only; no automatic regulatory decision.')
on conflict (training_key) do update set
  completion_status = excluded.completion_status,
  updated_at = now();

insert into public.inspection_workforce_certifications (
  certification_key, document_type, status, notes
) values
  ('cert-id-baseline', 'id_verification', 'missing', 'Required before active inspector status.'),
  ('cert-background-baseline', 'background_check_readiness', 'missing', 'Background check readiness for child safety environment.'),
  ('cert-confidentiality-baseline', 'confidentiality_agreement', 'missing', 'Confidentiality agreement required.'),
  ('cert-service-agreement-baseline', 'service_agreement', 'missing', 'Employment/contractor service agreement required.'),
  ('cert-insurance-baseline', 'insurance_contractor_documents', 'missing', 'Relevant for contractor model.')
on conflict (certification_key) do update set
  status = excluded.status,
  updated_at = now();

insert into public.inspection_workforce_quality_reviews (
  review_key, issue_type, severity, quality_task, status, due_date
) values
  ('quality-missing-gps-baseline', 'missing_gps', 'high', 'Create quality task when GPS validation is missing from submitted inspection.', 'open', current_date + 21),
  ('quality-weak-notes-baseline', 'weak_notes', 'medium', 'Review weak inspection notes and require inspector coaching.', 'open', current_date + 30),
  ('quality-late-report-baseline', 'late_report', 'medium', 'Track repeated late reports and route to supervisor review.', 'open', current_date + 30)
on conflict (review_key) do update set
  status = excluded.status,
  updated_at = now();

insert into public.inspection_workforce_alerts (
  alert_key, recipient_type, alert_type, severity, status, message
) values
  ('alert-admin-coverage-gap', 'admin', 'region_without_coverage', 'high', 'open', 'A region without inspector coverage blocks controlled scale.'),
  ('alert-admin-overloaded-inspector', 'admin', 'overloaded_inspector', 'high', 'open', 'Inspector workload exceeds the safe monthly capacity model.'),
  ('alert-admin-sla-breach', 'admin', 'sla_breach', 'critical', 'open', 'Inspection SLA breach requires admin review.'),
  ('alert-inspector-upcoming', 'inspector', 'upcoming_inspection', 'medium', 'open', 'Upcoming inspection reminder channel readiness.'),
  ('alert-inspector-document-expiration', 'inspector', 'document_expiration', 'medium', 'open', 'Inspector document expiration reminder readiness.')
on conflict (alert_key) do update set
  severity = excluded.severity,
  updated_at = now();

insert into public.inspection_workforce_risks (
  risk_key, category, risk, severity, mitigation, owner, status
) values
  ('workforce-risk-staffing-gap', 'staffing', 'Inspector hiring may lag behind kindergarten growth.', 'critical', 'Use capacity model and candidate pipeline before each scale cohort.', 'Inspection Ops', 'open'),
  ('workforce-risk-regional-coverage', 'coverage', 'Some regions may have no primary or backup inspector.', 'high', 'Track regional gaps and assign backup inspectors.', 'Inspection Ops', 'open'),
  ('workforce-risk-quality', 'quality', 'Incomplete forms, missing GPS or weak notes can reduce inspection reliability.', 'high', 'Admin quality reviews and training tasks for repeated issues.', 'Inspection QA', 'open'),
  ('workforce-risk-cost', 'cost', 'Inspector cost can exceed forecast and compress margins.', 'medium', 'Compare workforce financial forecast with subscription revenue by cohort.', 'Finance', 'open'),
  ('workforce-risk-sla', 'sla', 'Monthly inspections, complaint response or urgent visits may breach SLA.', 'high', 'Track SLA breaches and overload risk weekly.', 'Inspection Ops', 'open'),
  ('workforce-risk-ai-automation', 'operational', 'Observer recommendations might be mistaken for automatic regulatory decisions.', 'critical', 'Human review and admin/inspector approval remain mandatory.', 'AI Governance', 'open')
on conflict (risk_key) do update set
  severity = excluded.severity,
  mitigation = excluded.mitigation,
  updated_at = now();

insert into public.inspection_workforce_readiness_scores (
  snapshot_key,
  active_inspectors,
  assigned_kindergartens,
  inspections_due_this_month,
  overdue_inspections,
  follow_up_inspections,
  complaint_driven_inspections,
  regional_coverage_score,
  workload_score,
  compensation_score,
  training_score,
  performance_score,
  workforce_readiness_score,
  staffing_gaps
) values (
  'inspection-workforce-baseline',
  0,
  0,
  0,
  0,
  0,
  0,
  52,
  55,
  60,
  42,
  50,
  53,
  '["active inspector count not validated","regional coverage incomplete","training and certification readiness required","compensation model needs business approval"]'::jsonb
) on conflict (snapshot_key) do update set
  workforce_readiness_score = excluded.workforce_readiness_score,
  staffing_gaps = excluded.staffing_gaps,
  calculated_at = now();

comment on table public.inspection_workforce_profiles is 'Operational workforce profile for inspectors at national scale.';
comment on table public.inspection_workforce_capacity_models is 'Inspector capacity calculator inputs and outputs for scaling scenarios.';
comment on table public.inspection_workforce_compensation is 'Inspector compensation estimates and payout readiness. No payment execution.';
comment on table public.inspection_workforce_performance is 'Inspector performance score model from assignments, completions, GPS, report quality and feedback.';
comment on table public.inspection_workforce_risks is 'Risk register for national inspection workforce operations.';
