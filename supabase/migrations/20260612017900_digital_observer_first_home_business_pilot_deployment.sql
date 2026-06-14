create table if not exists public.digital_observer_pilot_sites (
  id uuid primary key default gen_random_uuid(),
  pilot_key text not null unique,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  lead_id uuid references public.digital_observer_leads(id) on delete set null,
  site_name text not null,
  site_type text not null,
  owner_name text,
  owner_phone text,
  owner_email text,
  city text,
  number_of_cameras integer not null default 0,
  camera_system_type text not null default 'Demo Camera',
  pilot_start_date date,
  pilot_end_date date,
  pilot_status text not null default 'planned',
  package_interest text,
  support_owner text,
  gateway_provider text not null default 'custom',
  gateway_status text not null default 'not_configured',
  cameras_connected integer not null default 0,
  observer_alerts_count integer not null default 0,
  open_issues_count integer not null default 0,
  readiness_score integer not null default 0,
  calibration_status text not null default 'not_started',
  shadow_mode_enforced boolean not null default true,
  human_review_required boolean not null default true,
  restricted_capabilities_blocked boolean not null default true,
  gan_batuach_data_isolated boolean not null default true,
  rtsp_exposed boolean not null default false,
  credentials_exposed boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_pilot_site_type_check check (site_type in ('home','business','office','warehouse','store','parking_lot','custom')),
  constraint digital_observer_pilot_status_check check (pilot_status in ('planned','setup','camera_testing','observer_testing','active_pilot','paused','completed','failed','cancelled')),
  constraint digital_observer_pilot_camera_system_check check (camera_system_type in ('RTSP','ONVIF readiness','DVR','NVR','Hikvision','Dahua','Generic IP Camera','Demo Camera')),
  constraint digital_observer_pilot_gateway_status_check check (gateway_status in ('not_configured','checking','healthy','degraded','failed','gateway_required','registered','playback_ready')),
  constraint digital_observer_pilot_calibration_status_check check (calibration_status in ('not_started','collecting_data','needs_review','calibrated','unstable','paused')),
  constraint digital_observer_pilot_counts_check check (number_of_cameras >= 0 and cameras_connected >= 0 and observer_alerts_count >= 0 and open_issues_count >= 0),
  constraint digital_observer_pilot_readiness_score_check check (readiness_score between 0 and 100),
  constraint digital_observer_pilot_safety_check check (
    shadow_mode_enforced = true
    and human_review_required = true
    and restricted_capabilities_blocked = true
    and gan_batuach_data_isolated = true
    and rtsp_exposed = false
    and credentials_exposed = false
  )
);

create table if not exists public.digital_observer_pilot_gateway_checks (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  check_type text not null,
  provider text not null default 'custom',
  status text not null default 'planned',
  gateway_health text not null default 'not_checked',
  source_registration_status text not null default 'pending',
  stream_available boolean not null default false,
  playback_ready boolean not null default false,
  reconnect_ready boolean not null default false,
  rtsp_exposed boolean not null default false,
  credentials_exposed boolean not null default false,
  latency_ms integer,
  error_summary text,
  checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint digital_observer_gateway_check_type_check check (check_type in ('gateway_health','source_registration','stream_availability','playback_readiness','failed_stream_handling','reconnect_readiness')),
  constraint digital_observer_gateway_check_status_check check (status in ('planned','running','success','warning','failed','blocked')),
  constraint digital_observer_gateway_health_check check (gateway_health in ('not_checked','healthy','degraded','failed','unreachable','gateway_required')),
  constraint digital_observer_gateway_source_status_check check (source_registration_status in ('pending','testing','registered','failed','disabled')),
  constraint digital_observer_gateway_privacy_check check (rtsp_exposed = false and credentials_exposed = false)
);

create table if not exists public.digital_observer_pilot_alert_reviews (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  camera_id uuid references public.camera_streams(id) on delete set null,
  signal_id uuid references public.observer_intelligence_signals(id) on delete set null,
  event_type text not null,
  lifecycle_status text not null default 'detected',
  reviewer_role text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  outcome text,
  false_positive_reason text,
  false_negative_notes text,
  camera_quality_issue text,
  lighting_issue boolean not null default false,
  angle_issue boolean not null default false,
  zone_definition_issue boolean not null default false,
  confidence numeric(5,4),
  alert_threshold numeric(5,4),
  shadow_mode boolean not null default true,
  human_review_required boolean not null default true,
  automatic_action_taken boolean not null default false,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_alert_lifecycle_check check (lifecycle_status in ('detected','pending_review','dismissed','confirmed','needs_followup','uncertain','action_suggested','closed')),
  constraint digital_observer_alert_outcome_check check (outcome is null or outcome in ('correct_detection','false_positive','false_negative','missed_event','uncertain','needs_more_context')),
  constraint digital_observer_alert_safety_check check (shadow_mode = true and human_review_required = true and automatic_action_taken = false)
);

create table if not exists public.digital_observer_pilot_calibration_profiles (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_key text,
  event_type text not null default 'all',
  motion_sensitivity numeric(5,4) not null default 0.6000,
  after_hours_sensitivity numeric(5,4) not null default 0.6500,
  restricted_zone_sensitivity numeric(5,4) not null default 0.7000,
  inactivity_threshold_seconds integer not null default 300,
  alert_threshold numeric(5,4) not null default 0.7000,
  confidence_threshold numeric(5,4) not null default 0.6500,
  calibration_status text not null default 'not_started',
  last_calibrated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_pilot_calibration_status_check check (calibration_status in ('not_started','collecting_data','needs_review','calibrated','unstable','paused')),
  constraint digital_observer_pilot_calibration_values_check check (
    motion_sensitivity between 0 and 1
    and after_hours_sensitivity between 0 and 1
    and restricted_zone_sensitivity between 0 and 1
    and alert_threshold between 0 and 1
    and confidence_threshold between 0 and 1
    and inactivity_threshold_seconds >= 0
  )
);

create table if not exists public.digital_observer_pilot_support_issues (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  title text not null,
  description text,
  issue_category text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  owner text,
  expected_result text,
  actual_result text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint digital_observer_pilot_support_category_check check (issue_category in ('camera_connection','gateway_issue','playback_issue','alert_issue','billing_trial_issue','onboarding_issue','ux_confusion','feature_request')),
  constraint digital_observer_pilot_support_severity_check check (severity in ('critical','high','medium','low')),
  constraint digital_observer_pilot_support_status_check check (status in ('open','triaged','in_progress','fixed','verified','deferred','closed'))
);

create table if not exists public.digital_observer_pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  respondent_role text not null default 'site_owner',
  setup_difficulty integer,
  camera_connection_difficulty integer,
  alert_usefulness integer,
  false_alert_frustration integer,
  dashboard_clarity integer,
  willingness_to_pay text,
  preferred_package text,
  missing_features text,
  free_text_feedback text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint digital_observer_pilot_feedback_score_check check (
    (setup_difficulty is null or setup_difficulty between 1 and 5)
    and (camera_connection_difficulty is null or camera_connection_difficulty between 1 and 5)
    and (alert_usefulness is null or alert_usefulness between 1 and 5)
    and (false_alert_frustration is null or false_alert_frustration between 1 and 5)
    and (dashboard_clarity is null or dashboard_clarity between 1 and 5)
  )
);

create table if not exists public.digital_observer_pilot_commercial_validation (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  package_interest text,
  trial_to_paid_likelihood text not null default 'unknown',
  expected_monthly_price numeric(10,2),
  expected_annual_price numeric(10,2),
  support_effort_level text not null default 'unknown',
  camera_setup_complexity text not null default 'unknown',
  ideal_customer_type text,
  billing_separation_verified boolean not null default true,
  payment_mode text not null default 'disabled',
  real_charge_triggered boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_trial_likelihood_check check (trial_to_paid_likelihood in ('unknown','low','medium','high','committed')),
  constraint digital_observer_support_effort_check check (support_effort_level in ('unknown','low','medium','high')),
  constraint digital_observer_camera_complexity_check check (camera_setup_complexity in ('unknown','simple','moderate','complex','blocked')),
  constraint digital_observer_payment_mode_check check (payment_mode in ('disabled','sandbox','live_ready','live')),
  constraint digital_observer_billing_safety_check check (billing_separation_verified = true and real_charge_triggered = false)
);

create table if not exists public.digital_observer_pilot_legal_notes (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  site_type text not null,
  capabilities_enabled jsonb not null default '[]'::jsonb,
  legal_assumptions text,
  consent_needs text,
  camera_policy_needs text,
  audio_capability_status text not null default 'disabled',
  face_capability_status text not null default 'disabled',
  sensitive_capabilities_status text not null default 'blocked_unless_approved',
  external_review_required boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_pilot_audio_status_check check (audio_capability_status in ('disabled','legal_review_required','approved_for_vertical')),
  constraint digital_observer_pilot_face_status_check check (face_capability_status in ('disabled','legal_review_required','approved_for_vertical')),
  constraint digital_observer_pilot_sensitive_status_check check (sensitive_capabilities_status in ('blocked_unless_approved','legal_review_required','approved_for_vertical'))
);

create table if not exists public.digital_observer_pilot_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete cascade,
  snapshot_key text not null unique,
  camera_stability_score integer not null default 0,
  gateway_stability_score integer not null default 0,
  alert_accuracy_score integer not null default 0,
  false_positive_rate numeric(5,4) not null default 0,
  review_completion_score integer not null default 0,
  site_owner_engagement_score integer not null default 0,
  package_readiness_score integer not null default 0,
  support_issue_score integer not null default 0,
  readiness_score integer not null default 0,
  production_activation_blocked boolean not null default true,
  blocker_reason text,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  constraint digital_observer_pilot_snapshot_score_check check (
    camera_stability_score between 0 and 100
    and gateway_stability_score between 0 and 100
    and alert_accuracy_score between 0 and 100
    and review_completion_score between 0 and 100
    and site_owner_engagement_score between 0 and 100
    and package_readiness_score between 0 and 100
    and support_issue_score between 0 and 100
    and readiness_score between 0 and 100
  )
);

alter table if exists public.camera_streams
  add column if not exists digital_observer_pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete set null,
  add column if not exists digital_observer_pilot_mode boolean not null default false,
  add column if not exists site_owner_visible boolean not null default false,
  add column if not exists advanced_diagnostics_visible boolean not null default false;

alter table public.digital_observer_pilot_sites enable row level security;
alter table public.digital_observer_pilot_gateway_checks enable row level security;
alter table public.digital_observer_pilot_alert_reviews enable row level security;
alter table public.digital_observer_pilot_calibration_profiles enable row level security;
alter table public.digital_observer_pilot_support_issues enable row level security;
alter table public.digital_observer_pilot_feedback enable row level security;
alter table public.digital_observer_pilot_commercial_validation enable row level security;
alter table public.digital_observer_pilot_legal_notes enable row level security;
alter table public.digital_observer_pilot_readiness_snapshots enable row level security;

drop policy if exists "digital observer pilot sites admin manage" on public.digital_observer_pilot_sites;
create policy "digital observer pilot sites admin manage" on public.digital_observer_pilot_sites for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot gateway admin manage" on public.digital_observer_pilot_gateway_checks;
create policy "digital observer pilot gateway admin manage" on public.digital_observer_pilot_gateway_checks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot alerts admin manage" on public.digital_observer_pilot_alert_reviews;
create policy "digital observer pilot alerts admin manage" on public.digital_observer_pilot_alert_reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot calibration admin manage" on public.digital_observer_pilot_calibration_profiles;
create policy "digital observer pilot calibration admin manage" on public.digital_observer_pilot_calibration_profiles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot support admin manage" on public.digital_observer_pilot_support_issues;
create policy "digital observer pilot support admin manage" on public.digital_observer_pilot_support_issues for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot feedback admin manage" on public.digital_observer_pilot_feedback;
create policy "digital observer pilot feedback admin manage" on public.digital_observer_pilot_feedback for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot commercial admin manage" on public.digital_observer_pilot_commercial_validation;
create policy "digital observer pilot commercial admin manage" on public.digital_observer_pilot_commercial_validation for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot legal admin manage" on public.digital_observer_pilot_legal_notes;
create policy "digital observer pilot legal admin manage" on public.digital_observer_pilot_legal_notes for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer pilot readiness admin manage" on public.digital_observer_pilot_readiness_snapshots;
create policy "digital observer pilot readiness admin manage" on public.digital_observer_pilot_readiness_snapshots for all using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_do_pilot_sites_status_type on public.digital_observer_pilot_sites(pilot_status, site_type, created_at desc);
create index if not exists idx_do_pilot_sites_observer_site on public.digital_observer_pilot_sites(observer_site_id);
create index if not exists idx_do_pilot_gateway_site on public.digital_observer_pilot_gateway_checks(pilot_site_id, status, created_at desc);
create unique index if not exists idx_do_pilot_gateway_unique_check on public.digital_observer_pilot_gateway_checks(pilot_site_id, check_type);
create index if not exists idx_do_pilot_alert_site on public.digital_observer_pilot_alert_reviews(pilot_site_id, lifecycle_status, created_at desc);
create index if not exists idx_do_pilot_calibration_site on public.digital_observer_pilot_calibration_profiles(pilot_site_id, calibration_status);
create unique index if not exists idx_do_pilot_calibration_unique_event on public.digital_observer_pilot_calibration_profiles(pilot_site_id, event_type, coalesce(zone_key, 'all'));
create index if not exists idx_do_pilot_support_site on public.digital_observer_pilot_support_issues(pilot_site_id, status, severity);
create unique index if not exists idx_do_pilot_support_unique_seed on public.digital_observer_pilot_support_issues(pilot_site_id, title);
create index if not exists idx_do_pilot_feedback_site on public.digital_observer_pilot_feedback(pilot_site_id, created_at desc);
create index if not exists idx_do_pilot_commercial_site on public.digital_observer_pilot_commercial_validation(pilot_site_id, trial_to_paid_likelihood);
create unique index if not exists idx_do_pilot_commercial_unique_site on public.digital_observer_pilot_commercial_validation(pilot_site_id);
create index if not exists idx_do_pilot_legal_site on public.digital_observer_pilot_legal_notes(pilot_site_id, external_review_required);
create unique index if not exists idx_do_pilot_legal_unique_site on public.digital_observer_pilot_legal_notes(pilot_site_id);
create index if not exists idx_do_pilot_readiness_site on public.digital_observer_pilot_readiness_snapshots(pilot_site_id, calculated_at desc);
create index if not exists idx_camera_streams_do_pilot_site on public.camera_streams(digital_observer_pilot_site_id, digital_observer_pilot_mode);

insert into public.digital_observer_pilot_sites (
  pilot_key, site_name, site_type, owner_name, city, number_of_cameras, camera_system_type,
  pilot_status, package_interest, support_owner, gateway_provider, gateway_status, cameras_connected,
  observer_alerts_count, open_issues_count, readiness_score, calibration_status, notes, metadata
) values
  ('first-home-observer-pilot', 'First Home Observer Pilot', 'home', 'Site owner TBD', 'TBD', 2, 'Demo Camera', 'setup', 'home_plus', 'Daniel', 'custom', 'gateway_required', 0, 0, 1, 38, 'not_started', 'Safe home pilot shell. No real camera credentials stored in this seed.', '{"phase":179,"test_data_only":true,"no_kindergarten_data":true}'::jsonb),
  ('first-business-observer-pilot', 'First Business Observer Pilot', 'business', 'Business owner TBD', 'TBD', 6, 'DVR', 'planned', 'business_basic', 'Daniel', 'MediaMTX', 'not_configured', 0, 0, 0, 35, 'not_started', 'Business pilot readiness shell for monitoring schedule, zones and alert recipients.', '{"phase":179,"test_data_only":true,"no_kindergarten_data":true}'::jsonb)
on conflict (pilot_key) do update set
  site_name = excluded.site_name,
  site_type = excluded.site_type,
  pilot_status = excluded.pilot_status,
  package_interest = excluded.package_interest,
  support_owner = excluded.support_owner,
  gateway_provider = excluded.gateway_provider,
  gateway_status = excluded.gateway_status,
  readiness_score = excluded.readiness_score,
  calibration_status = excluded.calibration_status,
  metadata = public.digital_observer_pilot_sites.metadata || excluded.metadata,
  updated_at = now();

insert into public.digital_observer_pilot_gateway_checks (pilot_site_id, check_type, provider, status, gateway_health, source_registration_status, stream_available, playback_ready, reconnect_ready, error_summary, metadata)
select id, 'gateway_health', gateway_provider, 'planned', 'gateway_required', 'pending', false, false, false, 'Real gateway not connected yet.', '{"phase":179}'::jsonb
from public.digital_observer_pilot_sites
where pilot_key in ('first-home-observer-pilot','first-business-observer-pilot')
on conflict do nothing;

insert into public.digital_observer_pilot_calibration_profiles (pilot_site_id, event_type, motion_sensitivity, after_hours_sensitivity, restricted_zone_sensitivity, inactivity_threshold_seconds, alert_threshold, confidence_threshold, calibration_status, metadata)
select id, 'motion_after_hours', 0.6000, 0.6500, 0.7000, 300, 0.7000, 0.6500, 'not_started', '{"phase":179,"shadow_mode":true}'::jsonb
from public.digital_observer_pilot_sites
where pilot_key in ('first-home-observer-pilot','first-business-observer-pilot')
on conflict do nothing;

insert into public.digital_observer_pilot_support_issues (pilot_site_id, title, description, issue_category, severity, status, owner, expected_result, actual_result, metadata)
select id, 'Complete real gateway setup', 'Connect MediaMTX/go2rtc/custom gateway before real camera pilot.', 'gateway_issue', 'medium', 'open', support_owner, 'Gateway health check succeeds.', 'Gateway not connected in seed data.', '{"phase":179}'::jsonb
from public.digital_observer_pilot_sites
where pilot_key = 'first-home-observer-pilot'
on conflict do nothing;

insert into public.digital_observer_pilot_commercial_validation (pilot_site_id, package_interest, trial_to_paid_likelihood, expected_monthly_price, expected_annual_price, support_effort_level, camera_setup_complexity, ideal_customer_type, notes)
select id, package_interest, 'unknown', case when site_type = 'home' then 179 else 299 end, case when site_type = 'home' then 1790 else 2990 end, 'unknown', 'unknown', site_type, 'Commercial validation starts after real setup and feedback.'
from public.digital_observer_pilot_sites
where pilot_key in ('first-home-observer-pilot','first-business-observer-pilot')
on conflict do nothing;

insert into public.digital_observer_pilot_legal_notes (pilot_site_id, site_type, capabilities_enabled, legal_assumptions, consent_needs, camera_policy_needs, notes)
select id, site_type, '["camera_offline","motion_after_hours","restricted_area","camera_obstruction","unusual_motion"]'::jsonb, 'Non-kindergarten pilot. Capability matrix still applies.', 'Site owner must confirm lawful camera operation and alert recipients.', 'No RTSP exposure, no credential exposure, no audio/face by default.', 'External legal review still recommended before production expansion.'
from public.digital_observer_pilot_sites
where pilot_key in ('first-home-observer-pilot','first-business-observer-pilot')
on conflict do nothing;

insert into public.digital_observer_pilot_readiness_snapshots (
  pilot_site_id, snapshot_key, camera_stability_score, gateway_stability_score, alert_accuracy_score,
  false_positive_rate, review_completion_score, site_owner_engagement_score, package_readiness_score,
  support_issue_score, readiness_score, production_activation_blocked, blocker_reason, metadata
)
select id, pilot_key || '-baseline-readiness', 20, 15, 20, 0, 10, 25, 55, 40, readiness_score, true, 'Real gateway, camera playback, owner feedback and reviewed alerts are still required.', '{"phase":179}'::jsonb
from public.digital_observer_pilot_sites
where pilot_key in ('first-home-observer-pilot','first-business-observer-pilot')
on conflict (snapshot_key) do update set
  camera_stability_score = excluded.camera_stability_score,
  gateway_stability_score = excluded.gateway_stability_score,
  alert_accuracy_score = excluded.alert_accuracy_score,
  review_completion_score = excluded.review_completion_score,
  site_owner_engagement_score = excluded.site_owner_engagement_score,
  package_readiness_score = excluded.package_readiness_score,
  support_issue_score = excluded.support_issue_score,
  readiness_score = excluded.readiness_score,
  production_activation_blocked = true,
  blocker_reason = excluded.blocker_reason,
  metadata = public.digital_observer_pilot_readiness_snapshots.metadata || excluded.metadata,
  calculated_at = now();

comment on table public.digital_observer_pilot_sites is 'Standalone Digital Observer first home/business pilot registry. Isolated from Gan Batuach kindergarten data.';
comment on table public.digital_observer_pilot_gateway_checks is 'Gateway validation checks for Digital Observer pilots: MediaMTX, go2rtc, custom gateway, stream availability and playback readiness.';
comment on table public.digital_observer_pilot_alert_reviews is 'Review lifecycle for pilot observer alerts. Shadow mode and human review remain mandatory.';
comment on table public.digital_observer_pilot_calibration_profiles is 'Per pilot site calibration thresholds for motion, after-hours, restricted zones, inactivity and confidence.';
comment on table public.digital_observer_pilot_support_issues is 'Pilot support workflow for camera, gateway, playback, alert, billing, onboarding and UX issues.';
comment on table public.digital_observer_pilot_feedback is 'Pilot site owner feedback for setup difficulty, alert usefulness, dashboard clarity and willingness to pay.';
comment on table public.digital_observer_pilot_commercial_validation is 'Commercial validation for package interest, trial-to-paid likelihood, price expectations and support effort.';
comment on table public.digital_observer_pilot_legal_notes is 'Privacy/legal notes for non-kindergarten Digital Observer pilots. Sensitive capabilities remain blocked unless approved.';
comment on table public.digital_observer_pilot_readiness_snapshots is '0-100 readiness scoring for first standalone Digital Observer pilot sites.';
