create table if not exists public.digital_observer_launch_status (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'not_ready',
  launch_owner text,
  launch_date date,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  blockers jsonb not null default '[]'::jsonb,
  notes text,
  approved_by text,
  approved_at timestamptz,
  soft_launch_enabled boolean not null default false,
  commercial_launch_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_launch_status_check check (status in ('not_ready','internal_ready','beta_ready','paid_beta_ready','launch_ready','commercially_live','paused'))
);

create table if not exists public.digital_observer_launch_trials (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.digital_observer_leads(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  customer_id uuid references public.digital_observer_beta_customers(id) on delete set null,
  selected_package text,
  trial_status text not null default 'started',
  trial_start date not null default current_date,
  trial_end date,
  cameras_connected integer not null default 0,
  monitoring_goals jsonb not null default '[]'::jsonb,
  alert_channels jsonb not null default '[]'::jsonb,
  conversion_status text not null default 'not_converted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_launch_trial_status_check check (trial_status in ('started','active','ending_soon','expired','converted','cancelled')),
  constraint digital_observer_launch_trial_conversion_check check (conversion_status in ('not_converted','payment_pending','converted','lost','deferred'))
);

create table if not exists public.digital_observer_launch_risks (
  id uuid primary key default gen_random_uuid(),
  risk_category text not null,
  severity text not null default 'medium',
  title text not null,
  description text not null,
  mitigation text,
  owner text,
  status text not null default 'open',
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_launch_risk_category_check check (risk_category in ('camera','gateway','AI','billing','support','legal','privacy','security','UX','infrastructure','domain','product-market fit')),
  constraint digital_observer_launch_risk_severity_check check (severity in ('critical','high','medium','low')),
  constraint digital_observer_launch_risk_status_check check (status in ('open','in_progress','mitigated','accepted_risk','closed','deferred'))
);

create table if not exists public.digital_observer_launch_blockers (
  id uuid primary key default gen_random_uuid(),
  blocker_type text not null,
  title text not null,
  severity text not null default 'medium',
  affected_area text not null,
  status text not null default 'open',
  required_before_launch boolean not null default true,
  owner text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_launch_blocker_severity_check check (severity in ('critical','high','medium','low')),
  constraint digital_observer_launch_blocker_status_check check (status in ('open','in_progress','resolved','accepted_risk','deferred'))
);

create table if not exists public.digital_observer_launch_qa_checks (
  id uuid primary key default gen_random_uuid(),
  check_area text not null,
  route_or_flow text not null,
  expected_result text not null,
  status text not null default 'not_tested',
  blocker_id uuid references public.digital_observer_launch_blockers(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_launch_qa_status_check check (status in ('not_tested','passed','failed','blocked','needs_review'))
);

create table if not exists public.digital_observer_launch_analytics (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  metric_label text not null,
  metric_value numeric(14,2) not null default 0,
  period_start date,
  period_end date,
  source text not null default 'launch_dashboard',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_launch_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_state text not null default 'not_ready',
  package_readiness_score integer not null default 0 check (package_readiness_score between 0 and 100),
  billing_readiness_score integer not null default 0 check (billing_readiness_score between 0 and 100),
  camera_setup_score integer not null default 0 check (camera_setup_score between 0 and 100),
  support_readiness_score integer not null default 0 check (support_readiness_score between 0 and 100),
  legal_capability_score integer not null default 0 check (legal_capability_score between 0 and 100),
  customer_demand_score integer not null default 0 check (customer_demand_score between 0 and 100),
  launch_blocker_score integer not null default 0 check (launch_blocker_score between 0 and 100),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  recommendation text not null,
  decided_by text,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_launch_decision_state_check check (decision_state in ('not_ready','needs_more_beta','soft_launch_ready','commercial_launch_ready','pause_launch'))
);

alter table public.digital_observer_launch_decisions
  add column if not exists decision_state text not null default 'not_ready',
  add column if not exists package_readiness_score integer not null default 0,
  add column if not exists billing_readiness_score integer not null default 0,
  add column if not exists camera_setup_score integer not null default 0,
  add column if not exists support_readiness_score integer not null default 0,
  add column if not exists legal_capability_score integer not null default 0,
  add column if not exists customer_demand_score integer not null default 0,
  add column if not exists launch_blocker_score integer not null default 0,
  add column if not exists readiness_score integer not null default 0,
  add column if not exists recommendation text not null default 'Launch decision pending.',
  add column if not exists decided_by text,
  add column if not exists decided_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'digital_observer_launch_decision_state_check'
      and conrelid = 'public.digital_observer_launch_decisions'::regclass
  ) then
    alter table public.digital_observer_launch_decisions
      add constraint digital_observer_launch_decision_state_check
      check (decision_state in ('not_ready','needs_more_beta','soft_launch_ready','commercial_launch_ready','pause_launch'));
  end if;
end $$;

create unique index if not exists digital_observer_launch_analytics_metric_idx on public.digital_observer_launch_analytics(metric_key, source);
create unique index if not exists digital_observer_launch_qa_unique_idx on public.digital_observer_launch_qa_checks(route_or_flow);
create index if not exists digital_observer_launch_risks_status_idx on public.digital_observer_launch_risks(status, severity);
create index if not exists digital_observer_launch_trials_status_idx on public.digital_observer_launch_trials(trial_status, conversion_status);

alter table public.digital_observer_launch_status enable row level security;
alter table public.digital_observer_launch_trials enable row level security;
alter table public.digital_observer_launch_risks enable row level security;
alter table public.digital_observer_launch_blockers enable row level security;
alter table public.digital_observer_launch_qa_checks enable row level security;
alter table public.digital_observer_launch_analytics enable row level security;
alter table public.digital_observer_launch_decisions enable row level security;

drop policy if exists "digital observer launch status admin" on public.digital_observer_launch_status;
create policy "digital observer launch status admin" on public.digital_observer_launch_status for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer launch trials admin" on public.digital_observer_launch_trials;
create policy "digital observer launch trials admin" on public.digital_observer_launch_trials for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer launch risks admin" on public.digital_observer_launch_risks;
create policy "digital observer launch risks admin" on public.digital_observer_launch_risks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer launch blockers admin" on public.digital_observer_launch_blockers;
create policy "digital observer launch blockers admin" on public.digital_observer_launch_blockers for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer launch qa admin" on public.digital_observer_launch_qa_checks;
create policy "digital observer launch qa admin" on public.digital_observer_launch_qa_checks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer launch analytics admin" on public.digital_observer_launch_analytics;
create policy "digital observer launch analytics admin" on public.digital_observer_launch_analytics for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer launch decisions admin" on public.digital_observer_launch_decisions;
create policy "digital observer launch decisions admin" on public.digital_observer_launch_decisions for all using (public.is_admin()) with check (public.is_admin());

insert into public.digital_observer_launch_status (status, launch_owner, readiness_score, blockers, notes, soft_launch_enabled, commercial_launch_enabled)
select
  'paid_beta_ready',
  'platform',
  68,
  '["live billing not enabled","legal/capability review still required","camera gateway scale not proven"]'::jsonb,
  'Controlled standalone launch readiness. Soft/commercial flags remain disabled by default.',
  false,
  false
where not exists (select 1 from public.digital_observer_launch_status);

insert into public.digital_observer_launch_risks (risk_category, severity, title, description, mitigation, owner, status)
values
  ('camera', 'high', 'Camera setup friction can block conversion', 'RTSP/DVR/NVR setup may still require support.', 'Keep demo/support flow and gateway diagnostics ready.', 'support', 'open'),
  ('gateway', 'high', 'Gateway readiness not proven at commercial scale', 'Shared gateway may not support higher stream volume.', 'Use controlled customer limits and assess gateway capacity.', 'platform', 'open'),
  ('billing', 'critical', 'Revenue stream mixing risk', 'Digital Observer billing must not mix with Gan Batuach or parent tuition.', 'Keep product-labeled invoices and separate dashboards.', 'finance', 'open'),
  ('legal', 'high', 'Capability/legal approval pending', 'Sensitive capabilities cannot be marketed or enabled silently.', 'Use capability matrix and external review before activation.', 'legal', 'open'),
  ('security', 'critical', 'Camera credential or RTSP exposure', 'Commercial launch must not expose credentials to client.', 'Keep gateway/token-only playback and audit.', 'security', 'open'),
  ('product-market fit', 'medium', 'Paid demand still needs proof', 'Launch should remain controlled until PMF signals improve.', 'Track paid conversions and support cost.', 'growth', 'open')
on conflict do nothing;

insert into public.digital_observer_launch_qa_checks (check_area, route_or_flow, expected_result, status)
values
  ('website', '/digital-observer', 'Public website loads with safe claims and clear CTAs.', 'not_tested'),
  ('demo request', '/digital-observer/request-demo', 'Demo request creates Digital Observer lead only.', 'not_tested'),
  ('start monitoring', '/digital-observer/start', 'Start flow creates/continues Digital Observer onboarding only.', 'not_tested'),
  ('lead creation', '/api/digital-observer/leads', 'Lead uses product_type=digital_observer.', 'not_tested'),
  ('lead conversion', 'admin lead conversion', 'Conversion creates observer site, not garden/child/parent/staff.', 'not_tested'),
  ('site creation', '/digital-observer/sites', 'Site shell is available and non-kindergarten.', 'not_tested'),
  ('camera setup', '/digital-observer/cameras', 'Camera setup hides RTSP and credentials.', 'not_tested'),
  ('package selection', '/digital-observer/pricing', 'Packages show readiness values or contact-us language.', 'not_tested'),
  ('billing', '/digital-observer/billing', 'Billing is Digital Observer only.', 'not_tested'),
  ('alerts', '/digital-observer/alerts', 'Alerts are review-first and capability-gated.', 'not_tested'),
  ('dashboard', '/digital-observer/dashboard', 'Customer dashboard shows standalone observer context.', 'not_tested'),
  ('support', 'support workflows', 'Support workflows cover camera, gateway, alert, billing and cancellation.', 'not_tested'),
  ('admin view', '/dashboard/admin/digital-observer-launch', 'Admin launch dashboard shows blockers and go/no-go status.', 'not_tested')
on conflict (route_or_flow) do update set
  check_area = excluded.check_area,
  expected_result = excluded.expected_result,
  updated_at = now();

insert into public.digital_observer_launch_analytics (metric_key, metric_label, metric_value, source)
values
  ('visits', 'Visits', 0, 'launch_dashboard'),
  ('demo_requests', 'Demo requests', 0, 'launch_dashboard'),
  ('start_monitoring_clicks', 'Start monitoring clicks', 0, 'launch_dashboard'),
  ('leads', 'Leads', 0, 'launch_dashboard'),
  ('converted_leads', 'Converted leads', 0, 'launch_dashboard'),
  ('trial_starts', 'Trial starts', 0, 'launch_dashboard'),
  ('packages_selected', 'Packages selected', 0, 'launch_dashboard'),
  ('cameras_connected', 'Cameras connected', 0, 'launch_dashboard'),
  ('first_alert_created', 'First alert created', 0, 'launch_dashboard'),
  ('paid_conversions', 'Paid conversions', 0, 'launch_dashboard'),
  ('cancellations', 'Cancellations', 0, 'launch_dashboard')
on conflict (metric_key, source) do update set
  metric_label = excluded.metric_label,
  updated_at = now();

insert into public.digital_observer_launch_decisions (
  decision_state,
  package_readiness_score,
  billing_readiness_score,
  camera_setup_score,
  support_readiness_score,
  legal_capability_score,
  customer_demand_score,
  launch_blocker_score,
  readiness_score,
  recommendation,
  metadata
)
select
  'soft_launch_ready',
  76,
  62,
  58,
  70,
  58,
  54,
  50,
  64,
  'Proceed only with controlled soft launch: public site and lead forms active, admin-approved onboarding, no automatic live billing, no restricted capabilities.',
  '{"soft_launch_default":false,"commercial_launch_default":false}'::jsonb
where not exists (select 1 from public.digital_observer_launch_decisions);

comment on table public.digital_observer_launch_status is 'Standalone commercial launch status for Digital Observer. Does not activate launch flags automatically.';
comment on table public.digital_observer_launch_risks is 'Commercial launch risk register for camera, gateway, AI, billing, support, legal, privacy, security, UX, infrastructure, domain and PMF.';
comment on table public.digital_observer_launch_decisions is 'Go/no-go launch decision model. Commercial launch requires explicit approval and safe flags.';
