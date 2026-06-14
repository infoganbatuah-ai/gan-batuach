-- PHASE 168: first real kindergarten pilot deployment.
-- Controlled pilot readiness only: no automatic production activation, no broad real data ingestion,
-- and no parent camera/AI visibility without explicit legal/privacy approval.

create table if not exists public.pilot_kindergarten_profiles (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete set null,
  pilot_key text not null unique,
  kindergarten_name text not null,
  manager_contact_name text,
  manager_contact_phone text,
  manager_contact_email text,
  city text,
  number_of_children integer not null default 0,
  number_of_staff integer not null default 0,
  age_groups jsonb not null default '[]'::jsonb,
  camera_availability text not null default 'future_phase',
  pilot_start_date date,
  pilot_end_date date,
  pilot_status text not null default 'planned',
  pilot_mode text not null default 'pilot_mode',
  pilot_owner text,
  support_owner text,
  health_score integer not null default 0,
  open_blockers integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_kindergarten_profiles_status_check check (pilot_status in ('planned','preparing','onboarding','active_pilot','paused','completed','failed','cancelled')),
  constraint pilot_kindergarten_profiles_mode_check check (pilot_mode in ('test_mode','pilot_mode','production_mode')),
  constraint pilot_kindergarten_profiles_camera_check check (camera_availability in ('none','available','mock_only','gateway_ready','future_phase','blocked')),
  constraint pilot_kindergarten_profiles_score_check check (health_score >= 0 and health_score <= 100),
  constraint pilot_kindergarten_profiles_counts_check check (number_of_children >= 0 and number_of_staff >= 0)
);

create table if not exists public.pilot_approval_gates (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  gate_key text not null,
  gate_area text not null,
  title text not null,
  status text not null default 'missing',
  required boolean not null default true,
  blocks_activation boolean not null default true,
  evidence_required boolean not null default true,
  owner_role text not null default 'admin',
  evidence_summary text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_profile_id, gate_key),
  constraint pilot_approval_gates_area_check check (gate_area in ('admin','legal_privacy','security','agreement','manager_onboarding','parent_communication','support','data_policy')),
  constraint pilot_approval_gates_status_check check (status in ('missing','in_progress','ready','approved','blocked','not_required'))
);

create table if not exists public.pilot_data_policies (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  policy_key text not null,
  data_category text not null,
  allowed boolean not null default false,
  approval_status text not null default 'not_approved',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  restrictions text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_profile_id, policy_key),
  constraint pilot_data_policies_category_check check (data_category in ('real_data','test_data','parent_data','child_data','medical_data','camera_data','ai_processing','staff_data','payment_data')),
  constraint pilot_data_policies_status_check check (approval_status in ('not_approved','requested','approved','approved_with_conditions','blocked','revoked'))
);

create table if not exists public.pilot_agreement_checklist (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  checklist_key text not null,
  document_type text not null,
  title text not null,
  status text not null default 'missing',
  required boolean not null default true,
  sent_at timestamptz,
  signed_at timestamptz,
  approved_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_profile_id, checklist_key),
  constraint pilot_agreement_checklist_type_check check (document_type in ('pilot_agreement','privacy_notice','parent_notice','staff_notice','camera_notice','ai_observer_notice','support_terms','data_processing_terms')),
  constraint pilot_agreement_checklist_status_check check (status in ('missing','draft','sent','signed','approved','blocked','not_required'))
);

create table if not exists public.pilot_training_checklist (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  training_key text not null,
  training_track text not null,
  title text not null,
  status text not null default 'not_started',
  completed_at timestamptz,
  trainer text,
  notes text,
  issues_raised text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_profile_id, training_key),
  constraint pilot_training_track_check check (training_track in ('manager','staff','parent','inspector','admin_support')),
  constraint pilot_training_status_check check (status in ('not_started','scheduled','completed','needs_followup','blocked'))
);

create table if not exists public.pilot_issue_reports (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  issue_key text not null unique,
  title text not null,
  description text,
  affected_role text not null default 'admin',
  affected_module text not null default 'pilot',
  severity text not null default 'medium',
  status text not null default 'open',
  owner text,
  route text,
  reproduction_steps jsonb not null default '[]'::jsonb,
  expected_result text,
  actual_result text,
  screenshot_reference text,
  created_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_issue_reports_role_check check (affected_role in ('manager','staff','parent','inspector','admin','support','all')),
  constraint pilot_issue_reports_severity_check check (severity in ('critical','high','medium','low')),
  constraint pilot_issue_reports_status_check check (status in ('open','triaged','in_progress','fixed','verified','deferred'))
);

create table if not exists public.pilot_feedback_collection (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  feedback_key text not null unique,
  feedback_source_role text not null,
  feedback_type text not null,
  title text not null,
  summary text,
  satisfaction_score integer,
  status text not null default 'open',
  owner text,
  collected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_feedback_source_role_check check (feedback_source_role in ('manager','staff','parent','inspector','admin_support')),
  constraint pilot_feedback_type_check check (feedback_type in ('ux_confusion','bug','missing_feature','performance_issue','training_issue','satisfaction_feedback')),
  constraint pilot_feedback_status_check check (status in ('open','reviewed','actioned','closed','deferred')),
  constraint pilot_feedback_score_check check (satisfaction_score is null or (satisfaction_score >= 0 and satisfaction_score <= 100))
);

create table if not exists public.pilot_daily_health_checks (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  check_key text not null unique,
  check_date date not null default current_date,
  manager_logged_in boolean not null default false,
  staff_used_system boolean not null default false,
  parents_used_system boolean not null default false,
  documents_uploaded boolean not null default false,
  child_updates_created boolean not null default false,
  messages_sent_read boolean not null default false,
  support_issues_reviewed boolean not null default false,
  critical_blockers_checked boolean not null default false,
  score integer not null default 0,
  status text not null default 'pending',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_daily_health_status_check check (status in ('pending','healthy','needs_attention','blocked','not_started')),
  constraint pilot_daily_health_score_check check (score >= 0 and score <= 100)
);

create table if not exists public.pilot_success_metrics (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  metric_key text not null,
  metric_area text not null,
  metric_name text not null,
  metric_value numeric not null default 0,
  target_value numeric,
  status text not null default 'tracking',
  measured_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_profile_id, metric_key),
  constraint pilot_success_metrics_area_check check (metric_area in ('activation','adoption','communication','support','quality','payments','compliance')),
  constraint pilot_success_metrics_status_check check (status in ('tracking','met','at_risk','missed','not_applicable'))
);

create table if not exists public.pilot_risks (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  risk_key text not null unique,
  risk_category text not null,
  risk_title text not null,
  risk_description text,
  severity text not null default 'medium',
  mitigation text,
  owner text,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pilot_risks_category_check check (risk_category in ('legal','privacy','security','UX','onboarding','camera','AI','payment','support','operational')),
  constraint pilot_risks_severity_check check (severity in ('critical','high','medium','low')),
  constraint pilot_risks_status_check check (status in ('open','mitigating','mitigated','accepted','closed'))
);

create table if not exists public.pilot_exit_criteria (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  criteria_key text not null,
  title text not null,
  status text not null default 'not_met',
  required boolean not null default true,
  evidence_required boolean not null default true,
  evidence_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(pilot_profile_id, criteria_key),
  constraint pilot_exit_criteria_status_check check (status in ('not_met','in_progress','met','blocked','not_required'))
);

create table if not exists public.first_pilot_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  pilot_profile_id uuid references public.pilot_kindergarten_profiles(id) on delete cascade,
  snapshot_key text not null unique,
  readiness_score integer not null default 0,
  onboarding_score integer not null default 0,
  staff_score integer not null default 0,
  parent_score integer not null default 0,
  document_score integer not null default 0,
  payment_score integer not null default 0,
  camera_score integer not null default 0,
  observer_score integer not null default 0,
  compliance_score integer not null default 0,
  support_score integer not null default 0,
  legal_privacy_score integer not null default 0,
  security_score integer not null default 0,
  open_blockers integer not null default 0,
  status text not null default 'preparing',
  notes text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint first_pilot_readiness_status_check check (status in ('not_ready','preparing','pilot_ready_with_blockers','pilot_ready','active_pilot','completed')),
  constraint first_pilot_readiness_score_check check (
    readiness_score between 0 and 100 and onboarding_score between 0 and 100 and staff_score between 0 and 100 and parent_score between 0 and 100 and
    document_score between 0 and 100 and payment_score between 0 and 100 and camera_score between 0 and 100 and observer_score between 0 and 100 and
    compliance_score between 0 and 100 and support_score between 0 and 100 and legal_privacy_score between 0 and 100 and security_score between 0 and 100
  )
);

create index if not exists idx_pilot_kindergarten_profiles_status on public.pilot_kindergarten_profiles(pilot_status, pilot_mode, created_at desc);
create index if not exists idx_pilot_approval_gates_profile on public.pilot_approval_gates(pilot_profile_id, gate_area, status);
create index if not exists idx_pilot_data_policies_profile on public.pilot_data_policies(pilot_profile_id, data_category, approval_status);
create index if not exists idx_pilot_agreement_checklist_profile on public.pilot_agreement_checklist(pilot_profile_id, document_type, status);
create index if not exists idx_pilot_training_checklist_profile on public.pilot_training_checklist(pilot_profile_id, training_track, status);
create index if not exists idx_pilot_issue_reports_profile on public.pilot_issue_reports(pilot_profile_id, severity, status, created_at desc);
create index if not exists idx_pilot_feedback_collection_profile on public.pilot_feedback_collection(pilot_profile_id, feedback_source_role, status);
create index if not exists idx_pilot_daily_health_checks_date on public.pilot_daily_health_checks(pilot_profile_id, check_date desc);
create index if not exists idx_pilot_success_metrics_profile on public.pilot_success_metrics(pilot_profile_id, metric_area, status);
create index if not exists idx_pilot_risks_profile on public.pilot_risks(pilot_profile_id, risk_category, severity, status);
create index if not exists idx_pilot_exit_criteria_profile on public.pilot_exit_criteria(pilot_profile_id, status);
create index if not exists idx_first_pilot_readiness_scores_profile on public.first_pilot_readiness_scores(pilot_profile_id, calculated_at desc);

alter table public.pilot_kindergarten_profiles enable row level security;
alter table public.pilot_approval_gates enable row level security;
alter table public.pilot_data_policies enable row level security;
alter table public.pilot_agreement_checklist enable row level security;
alter table public.pilot_training_checklist enable row level security;
alter table public.pilot_issue_reports enable row level security;
alter table public.pilot_feedback_collection enable row level security;
alter table public.pilot_daily_health_checks enable row level security;
alter table public.pilot_success_metrics enable row level security;
alter table public.pilot_risks enable row level security;
alter table public.pilot_exit_criteria enable row level security;
alter table public.first_pilot_readiness_scores enable row level security;

drop policy if exists "pilot kindergarten profiles admin only" on public.pilot_kindergarten_profiles;
create policy "pilot kindergarten profiles admin only" on public.pilot_kindergarten_profiles for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot approval gates admin only" on public.pilot_approval_gates;
create policy "pilot approval gates admin only" on public.pilot_approval_gates for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot data policies admin only" on public.pilot_data_policies;
create policy "pilot data policies admin only" on public.pilot_data_policies for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot agreement checklist admin only" on public.pilot_agreement_checklist;
create policy "pilot agreement checklist admin only" on public.pilot_agreement_checklist for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot training checklist admin only" on public.pilot_training_checklist;
create policy "pilot training checklist admin only" on public.pilot_training_checklist for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot issue reports admin only" on public.pilot_issue_reports;
create policy "pilot issue reports admin only" on public.pilot_issue_reports for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot feedback collection admin only" on public.pilot_feedback_collection;
create policy "pilot feedback collection admin only" on public.pilot_feedback_collection for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot daily health checks admin only" on public.pilot_daily_health_checks;
create policy "pilot daily health checks admin only" on public.pilot_daily_health_checks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot success metrics admin only" on public.pilot_success_metrics;
create policy "pilot success metrics admin only" on public.pilot_success_metrics for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot risks admin only" on public.pilot_risks;
create policy "pilot risks admin only" on public.pilot_risks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "pilot exit criteria admin only" on public.pilot_exit_criteria;
create policy "pilot exit criteria admin only" on public.pilot_exit_criteria for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "first pilot readiness scores admin only" on public.first_pilot_readiness_scores;
create policy "first pilot readiness scores admin only" on public.first_pilot_readiness_scores for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.enforce_first_pilot_activation_gates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pilot_status = 'active_pilot' then
    if not exists (
      select 1
      from public.pilot_approval_gates gate
      where gate.pilot_profile_id = new.id
        and gate.required = true
        and gate.blocks_activation = true
    ) then
      raise exception 'Pilot activation blocked: approval gates have not been created';
    end if;

    if exists (
      select 1
      from public.pilot_approval_gates gate
      where gate.pilot_profile_id = new.id
        and gate.required = true
        and gate.blocks_activation = true
        and gate.status <> 'approved'
    ) then
      raise exception 'Pilot activation blocked: required approval gates are not approved';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_first_pilot_activation_gates on public.pilot_kindergarten_profiles;
create trigger enforce_first_pilot_activation_gates
before insert or update of pilot_status on public.pilot_kindergarten_profiles
for each row execute function public.enforce_first_pilot_activation_gates();

insert into public.pilot_kindergarten_profiles (
  pilot_key,
  kindergarten_name,
  manager_contact_name,
  city,
  number_of_children,
  number_of_staff,
  age_groups,
  camera_availability,
  pilot_status,
  pilot_mode,
  pilot_owner,
  support_owner,
  health_score,
  open_blockers,
  notes,
  metadata
)
values (
  'first-real-kindergarten-controlled-pilot',
  'גן פיילוט ראשון',
  'מנהלת הגן',
  'לא נבחר',
  0,
  0,
  '[]'::jsonb,
  'future_phase',
  'preparing',
  'pilot_mode',
  'Admin',
  'Customer Success',
  46,
  6,
  'Controlled pilot profile placeholder. Replace with the approved kindergarten only after legal, privacy and security gates are ready.',
  '{"phase":"168","real_data_default":"blocked","parent_camera_visibility_default":"disabled","observer_mode":"shadow_only"}'::jsonb
)
on conflict (pilot_key) do update set
  kindergarten_name = excluded.kindergarten_name,
  pilot_status = excluded.pilot_status,
  pilot_mode = excluded.pilot_mode,
  camera_availability = excluded.camera_availability,
  health_score = excluded.health_score,
  open_blockers = excluded.open_blockers,
  notes = excluded.notes,
  metadata = pilot_kindergarten_profiles.metadata || excluded.metadata,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_approval_gates (pilot_profile_id, gate_key, gate_area, title, status, required, blocks_activation, evidence_required, owner_role, evidence_summary)
select first_pilot.id, item.gate_key, item.gate_area, item.title, item.status, true, true, true, item.owner_role, item.evidence_summary
from first_pilot
cross join (values
  ('admin-approval','admin','Admin pilot approval','in_progress','admin','Admin must approve selected kindergarten and pilot owner before activation.'),
  ('legal-privacy-readiness','legal_privacy','Legal and privacy readiness checked','blocked','legal','External legal/privacy review must approve pilot data boundaries.'),
  ('security-readiness','security','Security readiness checked','in_progress','security','Security review and critical blocker review must be complete.'),
  ('pilot-agreement-readiness','agreement','Pilot agreement readiness','missing','legal','Pilot agreement, notices and data processing terms must be signed or approved.'),
  ('manager-onboarding-readiness','manager_onboarding','Manager onboarding readiness','in_progress','customer_success','Manager journey must be validated in pilot mode.'),
  ('parent-communication-readiness','parent_communication','Parent communication readiness','missing','customer_success','Parent notices and guidance must be prepared before parent invitations.'),
  ('support-plan-ready','support','Pilot support plan ready','in_progress','support','Named support owner, escalation route and daily check rhythm required.')
) as item(gate_key, gate_area, title, status, owner_role, evidence_summary)
on conflict (pilot_profile_id, gate_key) do update set
  gate_area = excluded.gate_area,
  title = excluded.title,
  status = excluded.status,
  owner_role = excluded.owner_role,
  evidence_summary = excluded.evidence_summary,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_data_policies (pilot_profile_id, policy_key, data_category, allowed, approval_status, restrictions)
select first_pilot.id, item.policy_key, item.data_category, item.allowed, item.approval_status, item.restrictions
from first_pilot
cross join (values
  ('test-data-only','test_data',true,'approved','Use synthetic/demo data until pilot approval gates are complete.'),
  ('real-data-approval','real_data',false,'not_approved','No real kindergarten data before signed pilot approval.'),
  ('parent-data-approval','parent_data',false,'not_approved','No parent data ingestion before parent notices and opt-in process are approved.'),
  ('child-data-approval','child_data',false,'not_approved','No child data ingestion before legal/privacy approval and manager consent workflow.'),
  ('medical-data-approval','medical_data',false,'blocked','Medical data requires explicit pilot approval and encryption/audit validation.'),
  ('camera-data-approval','camera_data',false,'blocked','Camera data requires camera law review, no parent viewing by default.'),
  ('ai-processing-approval','ai_processing',false,'blocked','Observer is shadow-only; no parent visibility or automatic action.'),
  ('staff-data-approval','staff_data',false,'not_approved','Staff notices and required documents flow must be approved.'),
  ('payment-data-approval','payment_data',false,'not_approved','Sandbox/test payments only unless provider and contract review are approved.')
) as item(policy_key, data_category, allowed, approval_status, restrictions)
on conflict (pilot_profile_id, policy_key) do update set
  data_category = excluded.data_category,
  allowed = excluded.allowed,
  approval_status = excluded.approval_status,
  restrictions = excluded.restrictions,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_agreement_checklist (pilot_profile_id, checklist_key, document_type, title, status, required, notes)
select first_pilot.id, item.checklist_key, item.document_type, item.title, item.status, true, item.notes
from first_pilot
cross join (values
  ('pilot-agreement','pilot_agreement','Kindergarten pilot agreement','draft','Must be reviewed externally before signature.'),
  ('privacy-notice','privacy_notice','Pilot privacy notice','draft','Must explain pilot mode, data categories and rights.'),
  ('parent-notice','parent_notice','Parent notice','missing','Required before inviting parents.'),
  ('staff-notice','staff_notice','Staff notice','missing','Required before staff data collection.'),
  ('camera-notice','camera_notice','Camera notice','missing','Required if cameras are included.'),
  ('ai-observer-notice','ai_observer_notice','AI/Observer notice','draft','Must state shadow mode, no automatic decisions and no raw parent visibility.'),
  ('support-terms','support_terms','Pilot support terms','draft','Define support window and escalation.'),
  ('data-processing-terms','data_processing_terms','Data processing terms','draft','Clarify controller/processor responsibilities.')
) as item(checklist_key, document_type, title, status, notes)
on conflict (pilot_profile_id, checklist_key) do update set
  document_type = excluded.document_type,
  title = excluded.title,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_training_checklist (pilot_profile_id, training_key, training_track, title, status, trainer, notes)
select first_pilot.id, item.training_key, item.training_track, item.title, 'not_started', 'Customer Success', item.notes
from first_pilot
cross join (values
  ('manager-training','manager','Manager pilot training','Credentials, MFA, onboarding, staff/children, documents and pilot limitations.'),
  ('staff-training','staff','Staff pilot workflow training','Login, profile, GPS attendance, daily updates and incident reporting.'),
  ('parent-guidance','parent','Parent guidance session','Invitation, privacy boundaries, pickup contacts, payments and support.'),
  ('inspector-guidance','inspector','Inspector pilot readiness','Assigned garden, inspection, reports and observer boundaries.'),
  ('admin-support-training','admin_support','Admin/support pilot monitoring','Daily health checks, issue triage and escalation.')
) as item(training_key, training_track, title, notes)
on conflict (pilot_profile_id, training_key) do update set
  training_track = excluded.training_track,
  title = excluded.title,
  notes = excluded.notes,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_issue_reports (pilot_profile_id, issue_key, title, description, affected_role, affected_module, severity, status, owner, expected_result, actual_result)
select first_pilot.id, 'first-pilot-legal-approval-blocker', 'Legal/privacy approval is required before real pilot data', 'The pilot must not ingest real children, parent, staff, camera or AI data until external review gates are approved.', 'all', 'legal_privacy', 'critical', 'open', 'Legal / Admin', 'All high-risk data categories approved before activation.', 'Approval gate is currently blocked.'
from first_pilot
on conflict (issue_key) do update set
  title = excluded.title,
  description = excluded.description,
  severity = excluded.severity,
  status = excluded.status,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_feedback_collection (pilot_profile_id, feedback_key, feedback_source_role, feedback_type, title, summary, status, owner)
select first_pilot.id, item.feedback_key, item.feedback_source_role, item.feedback_type, item.title, item.summary, 'open', 'Customer Success'
from first_pilot
cross join (values
  ('manager-week-one-feedback','manager','satisfaction_feedback','Manager week-one feedback','Collect what worked, what confused the manager, and what blocked daily work.'),
  ('staff-onboarding-feedback','staff','training_issue','Staff onboarding feedback','Collect friction around login, profile completion, documents and daily workflow.'),
  ('parent-guidance-feedback','parent','ux_confusion','Parent guidance feedback','Collect privacy-boundary clarity, invitation clarity and child registration friction.'),
  ('support-bug-feedback','admin_support','bug','Support issue feedback','Track repeated bugs or support patterns during controlled rollout.')
) as item(feedback_key, feedback_source_role, feedback_type, title, summary)
on conflict (feedback_key) do update set
  title = excluded.title,
  summary = excluded.summary,
  status = excluded.status,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_daily_health_checks (pilot_profile_id, check_key, check_date, status, score, notes)
select first_pilot.id, 'first-pilot-day-0-readiness', current_date, 'not_started', 0, 'Daily checks begin only after controlled onboarding starts.'
from first_pilot
on conflict (check_key) do update set
  check_date = excluded.check_date,
  status = excluded.status,
  score = excluded.score,
  notes = excluded.notes,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_success_metrics (pilot_profile_id, metric_key, metric_area, metric_name, metric_value, target_value, status)
select first_pilot.id, item.metric_key, item.metric_area, item.metric_name, 0, item.target_value, 'tracking'
from first_pilot
cross join (values
  ('manager-activation-complete','activation','Manager activation complete',1),
  ('staff-activation-rate','adoption','Staff activation rate',90),
  ('parent-activation-rate','adoption','Parent activation rate',75),
  ('daily-active-users','adoption','Daily active users',10),
  ('child-update-completion','communication','Child update completion',80),
  ('parent-message-open-rate','communication','Parent message open rate',70),
  ('support-ticket-volume','support','Support ticket volume under control',5),
  ('unresolved-critical-issues','quality','Unresolved critical issues',0),
  ('satisfaction-score','quality','Pilot satisfaction score',80)
) as item(metric_key, metric_area, metric_name, target_value)
on conflict (pilot_profile_id, metric_key) do update set
  metric_area = excluded.metric_area,
  metric_name = excluded.metric_name,
  target_value = excluded.target_value,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_risks (pilot_profile_id, risk_key, risk_category, risk_title, risk_description, severity, mitigation, owner, status)
select first_pilot.id, item.risk_key, item.risk_category, item.risk_title, item.risk_description, item.severity, item.mitigation, item.owner, 'open'
from first_pilot
cross join (values
  ('pilot-legal-review-not-complete','legal','External legal review not complete','Pilot cannot use real data until legal/privacy review is completed.','critical','Keep all real data categories blocked and run with demo data only.','Legal / Admin'),
  ('pilot-parent-camera-risk','privacy','Parent camera viewing risk','Parent viewing must remain disabled unless camera compliance is externally approved.','high','Use shadow/internal camera validation only.','Admin / Camera Owner'),
  ('pilot-ai-shadow-only','AI','Observer must remain shadow-only','AI cannot notify parents or trigger real actions automatically.','high','Enforce shadow mode and human review.','AI Governance'),
  ('pilot-support-load','support','Support capacity uncertainty','First pilot may reveal high support load.','medium','Assign named support owner and daily issue triage.','Customer Success'),
  ('pilot-payment-provider-mode','payment','Payment provider mode ambiguity','Sandbox/live payment mode must be explicit before real charges.','high','Use sandbox/test mode unless payment approval is signed.','Billing Owner')
) as item(risk_key, risk_category, risk_title, risk_description, severity, mitigation, owner)
on conflict (risk_key) do update set
  risk_category = excluded.risk_category,
  risk_title = excluded.risk_title,
  risk_description = excluded.risk_description,
  severity = excluded.severity,
  mitigation = excluded.mitigation,
  owner = excluded.owner,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.pilot_exit_criteria (pilot_profile_id, criteria_key, title, status, required, evidence_required, evidence_summary)
select first_pilot.id, item.criteria_key, item.title, 'not_met', true, true, item.evidence_summary
from first_pilot
cross join (values
  ('no-critical-blockers','No critical blockers remain','Critical and high issues must be fixed, verified or formally deferred.'),
  ('manager-workflow-works','Manager workflow works','Manager login, onboarding, staff, children, documents and messages validated.'),
  ('staff-workflow-works','Staff workflow works','Staff login, profile, documents, attendance and daily tasks validated.'),
  ('parent-workflow-works','Parent workflow works','Parent invitation, child registration, messages, pickup contacts and payments understood.'),
  ('support-workflow-works','Support workflow works','Support tickets, escalation and daily review operate reliably.'),
  ('privacy-boundaries-validated','Privacy boundaries validated','No raw AI, no other child/garden access, no unapproved camera visibility.'),
  ('security-blockers-resolved','Security blockers resolved','No critical security, RLS, secret or sensitive-file blockers.'),
  ('feedback-collected','Feedback collected','Manager, staff, parent and support feedback collected and reviewed.'),
  ('next-action-decided','Next action decided','Decision recorded: pause, extend, second pilot or production review.')
) as item(criteria_key, title, evidence_summary)
on conflict (pilot_profile_id, criteria_key) do update set
  title = excluded.title,
  evidence_summary = excluded.evidence_summary,
  updated_at = now();

with first_pilot as (
  select id from public.pilot_kindergarten_profiles where pilot_key = 'first-real-kindergarten-controlled-pilot'
)
insert into public.first_pilot_readiness_scores (
  pilot_profile_id,
  snapshot_key,
  readiness_score,
  onboarding_score,
  staff_score,
  parent_score,
  document_score,
  payment_score,
  camera_score,
  observer_score,
  compliance_score,
  support_score,
  legal_privacy_score,
  security_score,
  open_blockers,
  status,
  notes
)
select
  first_pilot.id,
  'first-pilot-baseline-readiness',
  46,
  45,
  30,
  20,
  35,
  25,
  25,
  40,
  45,
  55,
  20,
  48,
  6,
  'preparing',
  'Controlled readiness baseline. Real pilot activation remains blocked until legal/privacy/security and agreement gates are approved.'
from first_pilot
on conflict (snapshot_key) do update set
  readiness_score = excluded.readiness_score,
  onboarding_score = excluded.onboarding_score,
  staff_score = excluded.staff_score,
  parent_score = excluded.parent_score,
  document_score = excluded.document_score,
  payment_score = excluded.payment_score,
  camera_score = excluded.camera_score,
  observer_score = excluded.observer_score,
  compliance_score = excluded.compliance_score,
  support_score = excluded.support_score,
  legal_privacy_score = excluded.legal_privacy_score,
  security_score = excluded.security_score,
  open_blockers = excluded.open_blockers,
  status = excluded.status,
  notes = excluded.notes,
  calculated_at = now();

comment on table public.pilot_kindergarten_profiles is 'Controlled first real kindergarten pilot profile. Does not activate production use automatically.';
comment on table public.pilot_approval_gates is 'Blocking pilot approval gates: admin, legal/privacy, security, agreement, onboarding, communication and support.';
comment on table public.pilot_data_policies is 'Per-category pilot data policy. Real child, parent, medical, camera and AI data are blocked by default.';
comment on table public.pilot_agreement_checklist is 'Pilot agreement and notice checklist for legal/privacy readiness.';
comment on table public.pilot_training_checklist is 'Training readiness for manager, staff, parents, inspector and admin/support.';
comment on table public.pilot_issue_reports is 'Pilot issue register with critical launch blocker tracking.';
comment on table public.pilot_feedback_collection is 'Pilot feedback collection from manager, staff, parents, inspector and support.';
comment on table public.pilot_daily_health_checks is 'Daily pilot health checks during controlled rollout.';
comment on table public.pilot_success_metrics is 'Pilot success metrics for activation, adoption, communication, support, quality, payments and compliance.';
comment on table public.pilot_risks is 'Pilot risk register across legal, privacy, security, UX, onboarding, camera, AI, payment, support and operations.';
comment on table public.pilot_exit_criteria is 'Criteria required before marking the first real kindergarten pilot completed.';
comment on table public.first_pilot_readiness_scores is 'Readiness score snapshots for the first real kindergarten pilot command center.';

notify pgrst, 'reload schema';
