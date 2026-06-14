-- PHASE 161: Master QA, End-to-End Validation & Bug Stabilization

create extension if not exists "pgcrypto";

create table if not exists public.qa_test_cases (
  id uuid primary key default gen_random_uuid(),
  test_key text not null unique,
  test_area text not null,
  user_role text not null,
  test_name text not null,
  steps jsonb not null default '[]'::jsonb,
  expected_result text not null,
  actual_result text,
  status text not null default 'not_tested',
  severity text not null default 'medium',
  assigned_owner text not null default 'product',
  related_route text,
  last_tested_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qa_test_cases_status_check check (status in ('not_tested','passed','failed','blocked','needs_review')),
  constraint qa_test_cases_severity_check check (severity in ('critical','high','medium','low')),
  constraint qa_test_cases_role_check check (user_role in ('admin','manager','owner','parent','staff','inspector','public','all'))
);

create table if not exists public.qa_bug_reports (
  id uuid primary key default gen_random_uuid(),
  bug_key text not null unique,
  title text not null,
  description text not null,
  role text not null default 'all',
  route text,
  severity text not null default 'medium',
  steps_to_reproduce jsonb not null default '[]'::jsonb,
  expected_result text not null,
  actual_result text not null,
  screenshot_reference text,
  status text not null default 'open',
  launch_blocker boolean not null default false,
  assigned_owner text not null default 'engineering',
  fixed_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qa_bug_reports_status_check check (status in ('open','in_progress','fixed','verified','deferred')),
  constraint qa_bug_reports_severity_check check (severity in ('critical','high','medium','low')),
  constraint qa_bug_reports_role_check check (role in ('admin','manager','owner','parent','staff','inspector','public','all'))
);

create table if not exists public.qa_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  workflow_name text not null,
  workflow_area text not null,
  role_scope text not null default 'all',
  status text not null default 'not_tested',
  readiness_score integer not null default 0,
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  blocked_count integer not null default 0,
  needs_review_count integer not null default 0,
  last_run_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint qa_workflow_runs_status_check check (status in ('not_tested','passed','failed','blocked','needs_review','in_progress')),
  constraint qa_workflow_runs_score_check check (readiness_score between 0 and 100)
);

create index if not exists qa_test_cases_role_status_idx on public.qa_test_cases(user_role, status, severity);
create index if not exists qa_test_cases_area_idx on public.qa_test_cases(test_area, related_route);
create index if not exists qa_bug_reports_status_idx on public.qa_bug_reports(status, severity, launch_blocker);
create index if not exists qa_workflow_runs_area_idx on public.qa_workflow_runs(workflow_area, status);

alter table public.qa_test_cases enable row level security;
alter table public.qa_bug_reports enable row level security;
alter table public.qa_workflow_runs enable row level security;

drop policy if exists "qa test cases admin only" on public.qa_test_cases;
create policy "qa test cases admin only" on public.qa_test_cases for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "qa bug reports admin only" on public.qa_bug_reports;
create policy "qa bug reports admin only" on public.qa_bug_reports for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "qa workflow runs admin only" on public.qa_workflow_runs;
create policy "qa workflow runs admin only" on public.qa_workflow_runs for all using (public.is_admin()) with check (public.is_admin());

insert into public.qa_test_cases (test_key, test_area, user_role, test_name, steps, expected_result, actual_result, status, severity, assigned_owner, related_route, metadata)
values
  ('admin-login-dashboard', 'admin', 'admin', 'Admin login and dashboard access', '["Login as admin","Open admin dashboard","Verify admin-only cards and nav"]'::jsonb, 'Admin reaches dashboard and sees only admin scope.', 'Requires seeded admin browser QA.', 'needs_review', 'high', 'qa', '/dashboard/admin', '{"suite":"admin"}'::jsonb),
  ('admin-capability-matrix', 'admin', 'admin', 'Capability matrix review', '["Open capability legal review","Verify Gan Batuach disabled capabilities","Verify legal review items"]'::jsonb, 'Restricted capabilities are visible and blocked or legal-review-required.', 'Dashboard and migration added in Phase 160; browser QA still required.', 'needs_review', 'high', 'qa', '/dashboard/admin/capability-legal-review', '{"suite":"admin"}'::jsonb),
  ('admin-security-audit', 'security', 'admin', 'Security and audit admin coverage', '["Open security center","Open audit logs","Check MFA/security findings"]'::jsonb, 'Security findings and audit coverage are visible to admin only.', 'Typecheck currently fails; security pages need live role QA.', 'blocked', 'critical', 'engineering', '/dashboard/admin/security', '{"suite":"admin","critical_rule":"build_or_typecheck_failure"}'::jsonb),
  ('admin-billing-subscriptions', 'payment', 'admin', 'Admin subscription billing flow', '["Open billing","Review subscriptions","Review invoices and failed payments"]'::jsonb, 'Gan Batuach subscription revenue is separated from parent tuition routing.', 'Needs payment provider sandbox QA.', 'needs_review', 'high', 'finance', '/dashboard/admin/billing', '{"suite":"admin"}'::jsonb),
  ('manager-command-center', 'manager', 'manager', 'Manager command center', '["Login as manager","Open command center","Review daily focus and widgets"]'::jsonb, 'Manager sees only own kindergarten operational status.', 'Requires seeded manager QA.', 'needs_review', 'high', 'qa', '/dashboard/garden/command-center', '{"suite":"manager"}'::jsonb),
  ('manager-onboarding-activation', 'onboarding', 'manager', 'Kindergarten activation wizard', '["Convert lead","Manager first login","Complete activation wizard","Reach payment","Activate"]'::jsonb, 'Kindergarten remains limited until documents and subscription payment complete.', 'End-to-end activation not verified in browser.', 'blocked', 'critical', 'engineering', '/dashboard/admin/kindergarten-activation', '{"suite":"manager","critical_rule":"onboarding_broken"}'::jsonb),
  ('manager-camera-setup', 'camera', 'manager', 'Manager camera setup and visibility controls', '["Open garden cameras","Register source","Test connection","Configure visibility and hours"]'::jsonb, 'Manager controls camera setup without exposing credentials or RTSP.', 'Needs real gateway/device QA.', 'needs_review', 'high', 'camera', '/dashboard/garden/cameras', '{"suite":"manager"}'::jsonb),
  ('parent-first-login-registration', 'onboarding', 'parent', 'Parent invitation and child registration completion', '["Receive invite","First login","Change password","Complete parent and child details"]'::jsonb, 'Parent can complete own child record and manager is notified.', 'Requires seeded parent invite QA.', 'needs_review', 'high', 'qa', '/dashboard/parent/family-home', '{"suite":"parent"}'::jsonb),
  ('parent-isolation-boundary', 'security', 'parent', 'Parent data isolation', '["Login as parent A","Attempt child B route","Attempt other garden camera/document/API"]'::jsonb, 'Parent cannot access other child, other garden, raw AI or investigations.', 'Not yet proven with live seeded negative tests.', 'blocked', 'critical', 'security', '/dashboard/parent', '{"suite":"parent","critical_rule":"parent_cross_access"}'::jsonb),
  ('parent-camera-token', 'camera', 'parent', 'Parent camera viewing authorization', '["Parent opens camera","Verify MFA","Verify child checked in","Verify token and watermark"]'::jsonb, 'Token is short-lived, no RTSP is exposed, and checked-out child blocks viewing.', 'Policy guard exists; needs browser and data QA.', 'needs_review', 'critical', 'camera', '/dashboard/parent/cameras', '{"suite":"parent","critical_rule":"camera_url_exposed"}'::jsonb),
  ('parent-payments', 'payment', 'parent', 'Parent-to-kindergarten payment view', '["Open parent payments","Review balance/invoices","Approve plan"]'::jsonb, 'Parent sees tuition history without raw card data.', 'Needs payment sandbox QA.', 'needs_review', 'high', 'finance', '/dashboard/parent/payments', '{"suite":"parent"}'::jsonb),
  ('staff-first-login-profile', 'onboarding', 'staff', 'Staff invitation and profile completion', '["Manager invites staff","Staff first login","Change password","Upload required documents"]'::jsonb, 'Staff profile completion is recorded and manager notified.', 'Requires seeded staff invite QA.', 'needs_review', 'high', 'qa', '/dashboard/staff', '{"suite":"staff"}'::jsonb),
  ('staff-gps-attendance', 'attendance', 'staff', 'Staff GPS attendance readiness', '["Open staff attendance","Validate location state","Review current shift"]'::jsonb, 'Staff can understand attendance status and anomalies require review.', 'Needs real device/GPS QA.', 'needs_review', 'high', 'mobile', '/dashboard/staff/attendance', '{"suite":"staff"}'::jsonb),
  ('staff-incident-fast-mode', 'incident', 'staff', 'Staff incident report fast mode', '["Open incident report","Attach photo/note/severity/child","Submit"]'::jsonb, 'Incident can be reported quickly and manager sees it.', 'Requires mobile browser QA.', 'needs_review', 'medium', 'qa', '/dashboard/staff/incidents', '{"suite":"staff"}'::jsonb),
  ('inspector-command-center', 'inspection', 'inspector', 'Inspector command center', '["Login as inspector","Open command center","Review assigned gardens and overdue inspections"]'::jsonb, 'Inspector sees only assigned scope and due inspections.', 'Requires seeded inspector QA.', 'needs_review', 'high', 'qa', '/dashboard/inspector/command-center', '{"suite":"inspector"}'::jsonb),
  ('inspector-inspection-lifecycle', 'inspection', 'inspector', 'Inspection lifecycle and PDF report', '["Start inspection","Answer sections","Attach evidence","Sign","Submit report"]'::jsonb, 'Inspection report contains questions, answers, findings, GPS and signature.', 'PDF/report generation needs live QA.', 'blocked', 'critical', 'inspection', '/dashboard/inspector/inspections', '{"suite":"inspector","critical_rule":"inspection_report_missing"}'::jsonb),
  ('public-homepage-cta', 'public_website', 'public', 'Public website CTA coverage', '["Open homepage","Verify demo, join kindergarten and parents CTA","Submit forms"]'::jsonb, 'All three acquisition flows create unified leads.', 'Needs browser QA and form submission QA.', 'needs_review', 'high', 'growth', '/', '{"suite":"public"}'::jsonb),
  ('public-parent-demand', 'public_website', 'public', 'Parent demand form', '["Open parents page","Submit parent demand","Verify lead source parent_request"]'::jsonb, 'Parent-origin lead appears in admin lead center.', 'Needs live form QA.', 'needs_review', 'high', 'growth', '/parents', '{"suite":"public"}'::jsonb),
  ('public-join-kindergarten', 'public_website', 'public', 'Kindergarten registration landing', '["Open join-kindergarten","Submit manager details","Verify lead/onboarding start"]'::jsonb, 'Kindergarten lead enters PHASE 139 onboarding.', 'Needs live form QA.', 'needs_review', 'high', 'growth', '/join-kindergarten', '{"suite":"public"}'::jsonb),
  ('digital-observer-parent-raw-block', 'ai_observer', 'parent', 'Parent raw AI visibility blocked', '["Login as parent","Open AI/safety pages","Attempt raw AI routes"]'::jsonb, 'Parent sees only approved summaries, not raw AI events.', 'Policy exists; negative tests still required.', 'blocked', 'critical', 'security', '/dashboard/parent/ai-events', '{"suite":"parent","critical_rule":"raw_ai_visible_to_parent"}'::jsonb),
  ('mobile-360-parent', 'mobile', 'parent', 'Parent 360px mobile review', '["Open parent family home at 360px","Review camera, payments, timeline and actions"]'::jsonb, 'No overlap, large touch targets, one-hand use.', 'Requires browser/device QA.', 'needs_review', 'medium', 'design', '/dashboard/parent/family-home', '{"viewport":"360"}'::jsonb),
  ('mobile-390-staff', 'mobile', 'staff', 'Staff 390px mobile review', '["Open staff operations at 390px","Review tasks, attendance, child updates"]'::jsonb, 'Common actions fit one-handed mobile flow.', 'Requires browser/device QA.', 'needs_review', 'medium', 'design', '/dashboard/staff/operations', '{"viewport":"390"}'::jsonb),
  ('mobile-414-manager', 'mobile', 'manager', 'Manager 414px mobile review', '["Open command center at 414px","Review alerts and widgets"]'::jsonb, 'Critical actions are reachable in 1-2 taps.', 'Requires browser/device QA.', 'needs_review', 'medium', 'design', '/dashboard/garden/command-center', '{"viewport":"414"}'::jsonb)
on conflict (test_key) do update set
  test_area = excluded.test_area,
  user_role = excluded.user_role,
  test_name = excluded.test_name,
  steps = excluded.steps,
  expected_result = excluded.expected_result,
  actual_result = excluded.actual_result,
  status = excluded.status,
  severity = excluded.severity,
  assigned_owner = excluded.assigned_owner,
  related_route = excluded.related_route,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.qa_bug_reports (bug_key, title, description, role, route, severity, steps_to_reproduce, expected_result, actual_result, status, launch_blocker, assigned_owner, metadata)
values
  ('qa-typecheck-failing', 'Typecheck fails', 'The repository typecheck currently fails on existing TypeScript issues across API routes, Supabase typings and parent family typing.', 'all', null, 'critical', '["Run npm run typecheck"]'::jsonb, 'Typecheck passes before pilot readiness.', 'Typecheck exits with code 2.', 'open', true, 'engineering', '{"phase":161,"critical_rule":"build_fails"}'::jsonb),
  ('qa-build-missing-next-env', 'Build fails because @next/env module is missing', 'Next build cannot start because node_modules/@next/env/dist/index.js is missing locally.', 'all', null, 'critical', '["Run npm run build"]'::jsonb, 'Build completes successfully.', 'Build exits before app compilation with MODULE_NOT_FOUND for @next/env.', 'open', true, 'engineering', '{"phase":161,"critical_rule":"build_fails"}'::jsonb),
  ('qa-parent-isolation-unverified', 'Parent isolation negative tests not yet completed', 'Parent boundaries for other children, other gardens, raw AI events and internal investigations need seeded negative QA.', 'parent', '/dashboard/parent', 'critical', '["Create two gardens","Create parent A and child A","Attempt child B/garden B/raw AI/investigation routes"]'::jsonb, 'All unauthorized access attempts are blocked and audited.', 'Not verified with live seeded users in this phase.', 'open', true, 'security', '{"phase":161,"critical_rule":"parent_cross_access"}'::jsonb),
  ('qa-camera-real-gateway-unverified', 'Real camera gateway and parent token flow require device QA', 'Camera policy guards exist, but real DVR/RTSP/ONVIF/gateway, checked-in child and watermark behavior need live QA.', 'parent', '/dashboard/parent/cameras', 'high', '["Configure real or staging camera","Check child in","Open parent camera","Check child out","Retry token"]'::jsonb, 'Token works only when allowed and never exposes direct RTSP or credentials.', 'Not verified against a real gateway in this environment.', 'open', true, 'camera', '{"phase":161,"critical_rule":"rtsp_exposed"}'::jsonb),
  ('qa-payment-provider-unverified', 'Payment provider sandbox not verified', 'Kindergarten subscription and parent-to-kindergarten routing need payment provider sandbox validation.', 'all', '/dashboard/admin/billing', 'high', '["Create plan","Apply discount","Pay subscription","Generate invoice","Run failed payment scenario"]'::jsonb, 'Payments are tokenized, audited and revenue streams remain separated.', 'No external payment sandbox verification was run.', 'open', true, 'finance', '{"phase":161,"critical_rule":"payment_activation_broken"}'::jsonb),
  ('qa-inspection-pdf-unverified', 'Inspection PDF report not verified end-to-end', 'Inspector lifecycle and PDF report with all answers, findings, evidence, GPS and signature still need live QA.', 'inspector', '/dashboard/inspector/inspections', 'high', '["Start inspection","Submit answers","Attach evidence","Sign","Generate PDF"]'::jsonb, 'Report includes every required field and evidence link.', 'Not verified in browser with seeded inspection data.', 'open', false, 'inspection', '{"phase":161}'::jsonb),
  ('qa-mobile-device-unverified', 'Mobile QA not completed for target widths', '360px, 390px, 414px, tablet and desktop validation remain required for all major roles.', 'all', null, 'medium', '["Open major role dashboards at target widths","Check touch targets and scrolling"]'::jsonb, 'No overlap, readable Hebrew, clear actions and one-hand use.', 'No browser/device screenshots were completed in this environment.', 'open', false, 'design', '{"phase":161}'::jsonb)
on conflict (bug_key) do update set
  title = excluded.title,
  description = excluded.description,
  role = excluded.role,
  route = excluded.route,
  severity = excluded.severity,
  steps_to_reproduce = excluded.steps_to_reproduce,
  expected_result = excluded.expected_result,
  actual_result = excluded.actual_result,
  status = excluded.status,
  launch_blocker = excluded.launch_blocker,
  assigned_owner = excluded.assigned_owner,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.qa_workflow_runs (run_key, workflow_name, workflow_area, role_scope, status, readiness_score, passed_count, failed_count, blocked_count, needs_review_count, last_run_at, notes, metadata)
values
  ('master-admin-suite', 'Admin QA Suite', 'admin', 'admin', 'needs_review', 58, 0, 0, 1, 4, now(), 'Admin dashboards are broad, but typecheck and live seeded role QA remain blockers.', '{"phase":161}'::jsonb),
  ('master-manager-suite', 'Manager QA Suite', 'manager', 'manager', 'blocked', 46, 0, 0, 1, 4, now(), 'Manager command center exists; activation and payment must be verified end-to-end.', '{"phase":161}'::jsonb),
  ('master-parent-suite', 'Parent QA Suite', 'parent', 'parent', 'blocked', 42, 0, 0, 3, 4, now(), 'Parent isolation, camera token and onboarding flows require seeded QA before pilot.', '{"phase":161}'::jsonb),
  ('master-staff-suite', 'Staff QA Suite', 'staff', 'staff', 'needs_review', 55, 0, 0, 0, 3, now(), 'Staff flows require real mobile/GPS and document upload QA.', '{"phase":161}'::jsonb),
  ('master-inspector-suite', 'Inspector QA Suite', 'inspection', 'inspector', 'blocked', 44, 0, 0, 1, 2, now(), 'Inspection lifecycle and PDF generation need live seeded validation.', '{"phase":161}'::jsonb),
  ('master-public-website-suite', 'Public Website QA', 'public_website', 'public', 'needs_review', 52, 0, 0, 0, 3, now(), 'All acquisition flows need live form validation and lead creation checks.', '{"phase":161}'::jsonb),
  ('master-security-suite', 'Security and Permissions QA', 'security', 'all', 'blocked', 40, 0, 0, 3, 2, now(), 'Parent isolation and build/typecheck failures prevent pilot-ready recommendation.', '{"phase":161}'::jsonb),
  ('master-mobile-suite', 'Mobile QA Suite', 'mobile', 'all', 'needs_review', 45, 0, 0, 0, 3, now(), 'Real viewport/device QA remains required.', '{"phase":161}'::jsonb)
on conflict (run_key) do update set
  workflow_name = excluded.workflow_name,
  workflow_area = excluded.workflow_area,
  role_scope = excluded.role_scope,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  passed_count = excluded.passed_count,
  failed_count = excluded.failed_count,
  blocked_count = excluded.blocked_count,
  needs_review_count = excluded.needs_review_count,
  last_run_at = excluded.last_run_at,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.qa_test_cases is 'Master end-to-end QA matrix across roles, workflows, routes and expected outcomes.';
comment on table public.qa_bug_reports is 'Regression and launch-blocking QA bug register.';
comment on table public.qa_workflow_runs is 'Aggregated QA suite readiness across role and product workflows.';
