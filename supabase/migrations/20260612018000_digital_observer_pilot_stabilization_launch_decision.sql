alter table public.digital_observer_pilot_feedback
  add column if not exists feedback_category text,
  add column if not exists status text not null default 'new',
  add column if not exists triage_owner text,
  add column if not exists resolution_notes text,
  add column if not exists verified_at timestamptz;

alter table public.digital_observer_pilot_feedback
  drop constraint if exists digital_observer_pilot_feedback_category_check,
  drop constraint if exists digital_observer_pilot_feedback_status_check;

alter table public.digital_observer_pilot_feedback
  add constraint digital_observer_pilot_feedback_category_check check (feedback_category is null or feedback_category in ('camera_setup','gateway_connection','playback','alerts','ai_accuracy','ux_confusion','pricing','support','onboarding','billing','feature_request')),
  add constraint digital_observer_pilot_feedback_status_check check (status in ('new','triaged','in_progress','fixed','verified','deferred','rejected'));

create table if not exists public.digital_observer_stabilization_actions (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete set null,
  area text not null,
  title text not null,
  issue_summary text not null,
  fix_summary text,
  severity text not null default 'medium',
  status text not null default 'open',
  owner text,
  recommended_next_step text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_stabilization_area_check check (area in ('camera','gateway','playback','alerts','ai_accuracy','ux','pricing','support','onboarding','billing','legal','domain','data_separation')),
  constraint digital_observer_stabilization_severity_check check (severity in ('critical','high','medium','low')),
  constraint digital_observer_stabilization_status_check check (status in ('open','triaged','in_progress','fixed','verified','deferred','rejected'))
);

create table if not exists public.digital_observer_false_positive_analysis (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete set null,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_key text,
  event_type text not null,
  lighting_issue boolean not null default false,
  camera_angle_issue boolean not null default false,
  motion_sensitivity_issue boolean not null default false,
  schedule_issue boolean not null default false,
  model_version text,
  false_positive_count integer not null default 0,
  recommendation text,
  status text not null default 'needs_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_fp_status_check check (status in ('needs_review','recommendation_created','calibration_updated','verified','deferred')),
  constraint digital_observer_fp_count_check check (false_positive_count >= 0)
);

create table if not exists public.digital_observer_false_negative_analysis (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete set null,
  camera_id uuid references public.camera_streams(id) on delete set null,
  zone_key text,
  event_type text not null,
  approximate_time timestamptz,
  expected_detection text,
  possible_cause text,
  calibration_recommendation text,
  false_negative_count integer not null default 0,
  status text not null default 'needs_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_fn_status_check check (status in ('needs_review','recommendation_created','calibration_updated','verified','deferred')),
  constraint digital_observer_fn_count_check check (false_negative_count >= 0)
);

create table if not exists public.digital_observer_support_playbooks (
  id uuid primary key default gen_random_uuid(),
  playbook_key text not null unique,
  title text not null,
  category text not null,
  trigger_condition text not null,
  steps jsonb not null default '[]'::jsonb,
  owner text,
  status text not null default 'ready_for_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_playbook_category_check check (category in ('camera','gateway','playback','alerts','billing','onboarding','support')),
  constraint digital_observer_playbook_status_check check (status in ('draft','ready_for_review','approved','needs_update','disabled'))
);

create table if not exists public.digital_observer_knowledge_base_articles (
  id uuid primary key default gen_random_uuid(),
  article_key text not null unique,
  title text not null,
  category text not null,
  summary text not null,
  body text not null,
  status text not null default 'draft',
  reviewed_by text,
  last_reviewed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_kb_category_check check (category in ('camera','gateway','playback','alerts','false_alerts','billing','onboarding','privacy')),
  constraint digital_observer_kb_status_check check (status in ('draft','ready_for_review','published','needs_update','archived'))
);

create table if not exists public.digital_observer_package_feedback (
  id uuid primary key default gen_random_uuid(),
  pilot_site_id uuid references public.digital_observer_pilot_sites(id) on delete set null,
  package_key text not null,
  package_confusion text,
  willingness_to_pay text,
  pricing_objection text,
  missing_limits text,
  upgrade_interest text,
  status text not null default 'new',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_package_feedback_status_check check (status in ('new','triaged','priced','deferred','verified'))
);

create table if not exists public.digital_observer_package_recommendation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  condition_text text not null,
  recommended_package_key text not null,
  recommended_package_name text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_package_rule_status_check check (status in ('active','ready_for_review','disabled'))
);

create table if not exists public.digital_observer_launch_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  decision_state text not null default 'not_ready',
  readiness_score integer not null default 0,
  camera_stability_score integer not null default 0,
  alert_quality_score integer not null default 0,
  support_load_score integer not null default 0,
  ux_clarity_score integer not null default 0,
  billing_readiness_score integer not null default 0,
  legal_capability_score integer not null default 0,
  customer_willingness_score integer not null default 0,
  biggest_blockers jsonb not null default '[]'::jsonb,
  recommended_next_step text,
  decided_by text,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_launch_decision_state_check check (decision_state in ('not_ready','needs_more_pilots','pilot_ready','paid_beta_ready','standalone_launch_ready')),
  constraint digital_observer_launch_scores_check check (
    readiness_score between 0 and 100
    and camera_stability_score between 0 and 100
    and alert_quality_score between 0 and 100
    and support_load_score between 0 and 100
    and ux_clarity_score between 0 and 100
    and billing_readiness_score between 0 and 100
    and legal_capability_score between 0 and 100
    and customer_willingness_score between 0 and 100
  )
);

create table if not exists public.digital_observer_standalone_gaps (
  id uuid primary key default gen_random_uuid(),
  gap_key text not null unique,
  category text not null,
  gap_title text not null,
  gap_description text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  owner text,
  remediation_plan text,
  due_date date,
  evidence_after_fix text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_standalone_gap_category_check check (category in ('camera','gateway','AI','UX','billing','legal','support','marketing','infrastructure','domain','data_separation')),
  constraint digital_observer_standalone_gap_status_check check (status in ('open','in_progress','fixed','deferred','requires_external_provider','requires_legal_review')),
  constraint digital_observer_standalone_gap_severity_check check (severity in ('critical','high','medium','low'))
);

create table if not exists public.digital_observer_domain_separation_reviews (
  id uuid primary key default gen_random_uuid(),
  review_key text not null unique,
  domain_option text not null,
  route_ready boolean not null default true,
  depends_on_gan_batuach_project boolean not null default true,
  requires_future_extraction boolean not null default true,
  requires_separate_vercel boolean not null default false,
  requires_separate_supabase boolean not null default false,
  requires_separate_git boolean not null default false,
  status text not null default 'ready_for_review',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_domain_review_status_check check (status in ('ready','ready_for_review','partial','blocked','future_only'))
);

alter table public.digital_observer_stabilization_actions enable row level security;
alter table public.digital_observer_false_positive_analysis enable row level security;
alter table public.digital_observer_false_negative_analysis enable row level security;
alter table public.digital_observer_support_playbooks enable row level security;
alter table public.digital_observer_knowledge_base_articles enable row level security;
alter table public.digital_observer_package_feedback enable row level security;
alter table public.digital_observer_package_recommendation_rules enable row level security;
alter table public.digital_observer_launch_decisions enable row level security;
alter table public.digital_observer_standalone_gaps enable row level security;
alter table public.digital_observer_domain_separation_reviews enable row level security;

drop policy if exists "digital observer stabilization admin manage" on public.digital_observer_stabilization_actions;
create policy "digital observer stabilization admin manage" on public.digital_observer_stabilization_actions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer false positive admin manage" on public.digital_observer_false_positive_analysis;
create policy "digital observer false positive admin manage" on public.digital_observer_false_positive_analysis for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer false negative admin manage" on public.digital_observer_false_negative_analysis;
create policy "digital observer false negative admin manage" on public.digital_observer_false_negative_analysis for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer support playbooks admin manage" on public.digital_observer_support_playbooks;
create policy "digital observer support playbooks admin manage" on public.digital_observer_support_playbooks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer kb admin manage" on public.digital_observer_knowledge_base_articles;
create policy "digital observer kb admin manage" on public.digital_observer_knowledge_base_articles for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer package feedback admin manage" on public.digital_observer_package_feedback;
create policy "digital observer package feedback admin manage" on public.digital_observer_package_feedback for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer package rules admin manage" on public.digital_observer_package_recommendation_rules;
create policy "digital observer package rules admin manage" on public.digital_observer_package_recommendation_rules for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer launch decisions admin manage" on public.digital_observer_launch_decisions;
create policy "digital observer launch decisions admin manage" on public.digital_observer_launch_decisions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer standalone gaps admin manage" on public.digital_observer_standalone_gaps;
create policy "digital observer standalone gaps admin manage" on public.digital_observer_standalone_gaps for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer domain separation admin manage" on public.digital_observer_domain_separation_reviews;
create policy "digital observer domain separation admin manage" on public.digital_observer_domain_separation_reviews for all using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_do_stabilization_area_status on public.digital_observer_stabilization_actions(area, status, severity);
create index if not exists idx_do_fp_analysis_site_event on public.digital_observer_false_positive_analysis(pilot_site_id, event_type, status);
create index if not exists idx_do_fn_analysis_site_event on public.digital_observer_false_negative_analysis(pilot_site_id, event_type, status);
create index if not exists idx_do_support_playbooks_category on public.digital_observer_support_playbooks(category, status);
create index if not exists idx_do_kb_category_status on public.digital_observer_knowledge_base_articles(category, status);
create index if not exists idx_do_package_feedback_package on public.digital_observer_package_feedback(package_key, status);
create index if not exists idx_do_launch_decisions_state on public.digital_observer_launch_decisions(decision_state, readiness_score desc);
create index if not exists idx_do_standalone_gaps_status on public.digital_observer_standalone_gaps(category, status, severity);
create index if not exists idx_do_domain_reviews_status on public.digital_observer_domain_separation_reviews(status, domain_option);

insert into public.digital_observer_stabilization_actions (action_key, area, title, issue_summary, fix_summary, severity, status, owner, recommended_next_step, evidence)
values
  ('camera-setup-copy-polish', 'camera', 'Simplify camera setup wording', 'Pilot flow needs clearer RTSP/DVR/NVR explanation and blocked reasons.', 'Onboarding copy simplified to monitor target, camera count, connection method, schedule, recipients and test mode.', 'medium', 'fixed', 'product', 'Validate with next pilot owner.', '{"route":"/digital-observer/onboarding"}'::jsonb),
  ('gateway-error-messages', 'gateway', 'Improve gateway error messages', 'Gateway failures need owner-friendly messages and admin diagnostics.', 'Added stabilization tracking and support playbook readiness.', 'high', 'in_progress', 'engineering', 'Connect real gateway and map provider errors.', '{"table":"digital_observer_pilot_gateway_checks"}'::jsonb),
  ('alert-copy-review', 'alerts', 'Review alert naming and severity labels', 'Avoid panic language and unsupported conclusions in observer alerts.', 'Alert lifecycle and review-first language documented.', 'medium', 'in_progress', 'product', 'Review live pilot alerts after first event batch.', '{"table":"digital_observer_pilot_alert_reviews"}'::jsonb),
  ('billing-separation-review', 'billing', 'Verify billing stream separation', 'Digital Observer subscriptions must not mix with Gan Batuach or parent tuition.', 'Billing separation is enforced in pilot/commercial validation records.', 'critical', 'verified', 'admin', 'Keep provider mode disabled/sandbox until paid beta.', '{"table":"digital_observer_pilot_commercial_validation"}'::jsonb)
on conflict (action_key) do update set
  area = excluded.area,
  title = excluded.title,
  issue_summary = excluded.issue_summary,
  fix_summary = excluded.fix_summary,
  severity = excluded.severity,
  status = excluded.status,
  owner = excluded.owner,
  recommended_next_step = excluded.recommended_next_step,
  evidence = excluded.evidence,
  updated_at = now();

insert into public.digital_observer_support_playbooks (playbook_key, title, category, trigger_condition, steps, owner, status, metadata)
values
  ('camera_connection_failed', 'Camera connection failed', 'camera', 'Camera test returns unreachable, unauthorized or unsupported.', '["Confirm camera type","Check local network","Validate credentials server-side","Run gateway health check","Retry registration","Escalate if still failing"]'::jsonb, 'support', 'ready_for_review', '{"phase":180}'::jsonb),
  ('rtsp_not_working', 'RTSP not working', 'camera', 'RTSP candidate fails gateway registration.', '["Do not show RTSP to user","Validate path server-side","Check port","Check channel number","Try low-quality substream","Record blocked reason"]'::jsonb, 'support', 'ready_for_review', '{"phase":180}'::jsonb),
  ('dvr_channel_unknown', 'DVR channel unknown', 'camera', 'Owner does not know DVR/NVR channel number.', '["Explain channel in simple language","Ask for camera list screenshot if allowed","Try common channel pattern","Document selected channel"]'::jsonb, 'support', 'ready_for_review', '{"phase":180}'::jsonb),
  ('gateway_unavailable', 'Gateway unavailable', 'gateway', 'Gateway health check fails or times out.', '["Check provider status","Verify server-side gateway env","Retry health check","Mark pilot blocked if unavailable","Notify support owner"]'::jsonb, 'engineering', 'ready_for_review', '{"phase":180}'::jsonb),
  ('playback_not_loading', 'Playback not loading', 'playback', 'Token issued but stream does not load.', '["Check token expiration","Check stream availability","Check schedule/permission","Show unavailable camera message","Audit session attempt"]'::jsonb, 'engineering', 'ready_for_review', '{"phase":180}'::jsonb),
  ('alerts_too_noisy', 'Alerts too noisy', 'alerts', 'Owner reports too many alerts or false positives.', '["Review false positive analysis","Check schedule","Check zone boundaries","Lower sensitivity gradually","Keep shadow mode until verified"]'::jsonb, 'observer', 'ready_for_review', '{"phase":180}'::jsonb),
  ('subscription_issue', 'Subscription issue', 'billing', 'Trial/package confusion or payment readiness issue.', '["Verify Digital Observer billing stream","Do not touch Gan Batuach subscriptions","Check package selection","Keep live charge disabled unless approved"]'::jsonb, 'billing', 'ready_for_review', '{"phase":180}'::jsonb),
  ('onboarding_stuck', 'Onboarding stuck', 'onboarding', 'Site owner does not know next setup step.', '["Ask what they monitor","Confirm camera count","Confirm connection method","Choose monitoring schedule","Choose recipients","Start test mode"]'::jsonb, 'support', 'ready_for_review', '{"phase":180}'::jsonb)
on conflict (playbook_key) do update set
  title = excluded.title,
  category = excluded.category,
  trigger_condition = excluded.trigger_condition,
  steps = excluded.steps,
  owner = excluded.owner,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_knowledge_base_articles (article_key, title, category, summary, body, status, metadata)
values
  ('connect-camera', 'How to connect a camera', 'camera', 'Connect a camera through the secure gateway.', 'Choose camera type, enter details in the secure setup, test gateway health and verify playback. RTSP and credentials are never shown in the browser.', 'ready_for_review', '{"phase":180}'::jsonb),
  ('what-is-rtsp', 'What is RTSP?', 'camera', 'RTSP is a camera stream protocol.', 'RTSP helps the gateway read camera video. Digital Observer keeps RTSP details server-side and masked from users.', 'ready_for_review', '{"phase":180}'::jsonb),
  ('what-is-dvr-nvr', 'What is DVR/NVR?', 'camera', 'DVR/NVR devices manage multiple cameras.', 'A DVR/NVR may have channels for each camera. The setup flow asks for brand, address, port, username, password and channel.', 'ready_for_review', '{"phase":180}'::jsonb),
  ('what-is-onvif', 'What is ONVIF?', 'gateway', 'ONVIF helps discover camera capabilities.', 'ONVIF readiness means future or partial device discovery can help identify cameras and channels.', 'ready_for_review', '{"phase":180}'::jsonb),
  ('why-gateway', 'Why do I need a gateway?', 'gateway', 'The gateway protects camera credentials and stream access.', 'The gateway registers camera sources server-side, checks health and issues secure playback readiness without exposing RTSP.', 'ready_for_review', '{"phase":180}'::jsonb),
  ('camera-offline', 'Why is my camera offline?', 'playback', 'Offline cameras may need network, credential or gateway checks.', 'Check power, network, camera credentials, gateway health and stream registration status.', 'ready_for_review', '{"phase":180}'::jsonb),
  ('how-alerts-work', 'How alerts work', 'alerts', 'Alerts are review-first and careful.', 'Digital Observer can detect unusual activity, but pilot alerts start in shadow mode and require review before action.', 'ready_for_review', '{"phase":180}'::jsonb),
  ('reduce-false-alerts', 'How to reduce false alerts', 'false_alerts', 'Tune schedules, zones and sensitivity.', 'Review false positives by camera, zone, lighting, angle and motion sensitivity before changing thresholds.', 'ready_for_review', '{"phase":180}'::jsonb)
on conflict (article_key) do update set
  title = excluded.title,
  category = excluded.category,
  summary = excluded.summary,
  body = excluded.body,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_package_recommendation_rules (rule_key, condition_text, recommended_package_key, recommended_package_name, status, metadata)
values
  ('home-1-2-cameras', '1-2 cameras at home', 'home_basic', 'Home Basic', 'active', '{"camera_min":1,"camera_max":2,"site_type":"home"}'::jsonb),
  ('home-3-6-cameras', '3-6 cameras at home', 'home_plus', 'Home Plus', 'active', '{"camera_min":3,"camera_max":6,"site_type":"home"}'::jsonb),
  ('business-night-monitoring', 'Business with night monitoring', 'business_basic', 'Business Basic', 'active', '{"site_type":"business","monitoring":"night"}'::jsonb),
  ('multi-user-analytics', 'Multiple users / advanced analytics', 'business_pro', 'Business Pro', 'active', '{"multi_user":true,"advanced_analytics":true}'::jsonb),
  ('custom-high-camera-count', 'Custom sites / high camera count', 'enterprise_monitoring', 'Enterprise Monitoring', 'ready_for_review', '{"camera_min":21,"custom":true}'::jsonb)
on conflict (rule_key) do update set
  condition_text = excluded.condition_text,
  recommended_package_key = excluded.recommended_package_key,
  recommended_package_name = excluded.recommended_package_name,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_standalone_gaps (gap_key, category, gap_title, gap_description, severity, status, owner, remediation_plan, metadata)
values
  ('real-gateway-validation', 'gateway', 'Real gateway validation incomplete', 'Pilot still needs successful MediaMTX/go2rtc/custom gateway health and playback validation.', 'high', 'requires_external_provider', 'engineering', 'Connect real gateway and record successful gateway checks.', '{"phase":180}'::jsonb),
  ('real-camera-playback', 'camera', 'Real camera playback not validated', 'A real home/business camera must pass secure token playback without RTSP exposure.', 'high', 'open', 'engineering', 'Run real camera pilot and document playback result.', '{"phase":180}'::jsonb),
  ('alert-quality-evidence', 'AI', 'Alert quality needs reviewed evidence', 'Need reviewed false positive/false negative data before paid beta.', 'high', 'open', 'observer', 'Collect reviewed pilot alerts and update calibration profiles.', '{"phase":180}'::jsonb),
  ('paid-billing-provider', 'billing', 'Paid billing provider not live', 'Digital Observer billing remains readiness/sandbox until provider mode is approved.', 'medium', 'requires_external_provider', 'billing', 'Configure payment provider when launch decision reaches paid_beta_ready.', '{"phase":180}'::jsonb),
  ('legal-capability-review', 'legal', 'Sensitive capability review required', 'Audio, face, gait and biometric features remain blocked or legal_review_required.', 'high', 'requires_legal_review', 'legal', 'Review capability matrix before any sensitive capability marketing or activation.', '{"phase":180}'::jsonb),
  ('domain-extraction', 'domain', 'Standalone domain still depends on Gan Batuach project', 'Routes are ready but product still runs inside current project.', 'medium', 'deferred', 'platform', 'Use future extraction plan when standalone traction is proven.', '{"phase":180}'::jsonb)
on conflict (gap_key) do update set
  category = excluded.category,
  gap_title = excluded.gap_title,
  gap_description = excluded.gap_description,
  severity = excluded.severity,
  status = excluded.status,
  owner = excluded.owner,
  remediation_plan = excluded.remediation_plan,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_domain_separation_reviews (review_key, domain_option, route_ready, depends_on_gan_batuach_project, requires_future_extraction, requires_separate_vercel, requires_separate_supabase, requires_separate_git, status, notes, metadata)
values
  ('observer-gan-batuach-subdomain', 'observer.gan-batuach.co.il', true, true, true, false, false, false, 'ready_for_review', 'Can route to /digital-observer using current host-based routing readiness.', '{"phase":180}'::jsonb),
  ('digital-observer-il', 'digital-observer.co.il', true, true, true, true, false, false, 'partial', 'Standalone public domain likely needs separate Vercel project later for clean product separation.', '{"phase":180}'::jsonb),
  ('app-digitalobserver-ai', 'app.digitalobserver.ai', true, true, true, true, true, true, 'future_only', 'Future app domain can move to separate Vercel/Supabase/Git when extraction is approved.', '{"phase":180}'::jsonb)
on conflict (review_key) do update set
  domain_option = excluded.domain_option,
  route_ready = excluded.route_ready,
  depends_on_gan_batuach_project = excluded.depends_on_gan_batuach_project,
  requires_future_extraction = excluded.requires_future_extraction,
  requires_separate_vercel = excluded.requires_separate_vercel,
  requires_separate_supabase = excluded.requires_separate_supabase,
  requires_separate_git = excluded.requires_separate_git,
  status = excluded.status,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_launch_decisions (
  decision_key, decision_state, readiness_score, camera_stability_score, alert_quality_score,
  support_load_score, ux_clarity_score, billing_readiness_score, legal_capability_score,
  customer_willingness_score, biggest_blockers, recommended_next_step, metadata
) values (
  'phase-180-standalone-launch-decision',
  'needs_more_pilots',
  54,
  40,
  35,
  60,
  70,
  45,
  50,
  35,
  '["real gateway validation","real camera playback","alert quality evidence","paid billing provider","legal capability review"]'::jsonb,
  'Run one more controlled real home/business pilot after gateway and playback validation. Do not move to paid beta yet.',
  '{"phase":180,"do_not_mix_billing":true,"gan_batuach_separate":true}'::jsonb
)
on conflict (decision_key) do update set
  decision_state = excluded.decision_state,
  readiness_score = excluded.readiness_score,
  camera_stability_score = excluded.camera_stability_score,
  alert_quality_score = excluded.alert_quality_score,
  support_load_score = excluded.support_load_score,
  ux_clarity_score = excluded.ux_clarity_score,
  billing_readiness_score = excluded.billing_readiness_score,
  legal_capability_score = excluded.legal_capability_score,
  customer_willingness_score = excluded.customer_willingness_score,
  biggest_blockers = excluded.biggest_blockers,
  recommended_next_step = excluded.recommended_next_step,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.digital_observer_stabilization_actions is 'Digital Observer pilot stabilization action register for camera, gateway, playback, alerts, UX, pricing, support and billing.';
comment on table public.digital_observer_false_positive_analysis is 'False positive analysis by pilot site, camera, zone, event type, lighting, angle, sensitivity, schedule and model.';
comment on table public.digital_observer_false_negative_analysis is 'False negative and missed event analysis for calibration recommendations.';
comment on table public.digital_observer_support_playbooks is 'Support playbooks for Digital Observer pilot stabilization.';
comment on table public.digital_observer_knowledge_base_articles is 'Standalone Digital Observer knowledge base, separate from Gan Batuach help articles.';
comment on table public.digital_observer_package_recommendation_rules is 'Package recommendation logic for Digital Observer standalone packages.';
comment on table public.digital_observer_launch_decisions is 'Launch decision register for Digital Observer standalone readiness states.';
comment on table public.digital_observer_standalone_gaps is 'Standalone product gap register for Digital Observer.';
comment on table public.digital_observer_domain_separation_reviews is 'Future domain and product separation review for Digital Observer.';
