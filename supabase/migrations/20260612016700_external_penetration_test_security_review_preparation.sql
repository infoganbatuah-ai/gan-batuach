-- PHASE 167: External Penetration Test & Security Review Preparation
-- Preparation only. Do not run destructive testing or expose production secrets.

create extension if not exists "pgcrypto";

create table if not exists public.penetration_test_scopes (
  id uuid primary key default gen_random_uuid(),
  scope_key text not null unique,
  scope_name text not null,
  included_routes jsonb not null default '[]'::jsonb,
  included_roles jsonb not null default '[]'::jsonb,
  included_systems jsonb not null default '[]'::jsonb,
  excluded_systems jsonb not null default '[]'::jsonb,
  environment text not null default 'staging',
  test_restrictions text not null,
  approval_status text not null default 'draft',
  owner_role text not null default 'admin',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint penetration_test_scope_env_check check (environment in ('staging','test','sandbox','production_readonly')),
  constraint penetration_test_scope_approval_check check (approval_status in ('draft','ready_for_external_tester','approved','blocked','completed'))
);

create table if not exists public.security_test_user_pack (
  id uuid primary key default gen_random_uuid(),
  user_key text not null unique,
  role_key text not null,
  display_name text not null,
  permissions_summary text not null,
  expected_access jsonb not null default '[]'::jsonb,
  forbidden_access jsonb not null default '[]'::jsonb,
  environment text not null default 'staging',
  mfa_state text not null default 'test_ready',
  account_state text not null default 'active',
  credential_delivery_status text not null default 'not_generated',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_test_user_role_check check (role_key in ('admin','manager','owner','parent','staff','inspector','suspended_user','inactive_user','limited_user')),
  constraint security_test_user_env_check check (environment in ('staging','test','sandbox')),
  constraint security_test_user_mfa_check check (mfa_state in ('test_ready','without_mfa','with_mfa','mfa_required','blocked')),
  constraint security_test_user_account_check check (account_state in ('active','suspended','inactive','limited','locked')),
  constraint security_test_user_credential_check check (credential_delivery_status in ('not_generated','generated','delivered_to_tester','revoked'))
);

create table if not exists public.security_review_test_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  test_area text not null,
  title text not null,
  severity text not null default 'medium',
  status text not null default 'ready_for_external_tester',
  objective text not null,
  test_steps jsonb not null default '[]'::jsonb,
  expected_result text not null,
  prohibited_actions jsonb not null default '[]'::jsonb,
  evidence_required text,
  related_scope_key text references public.penetration_test_scopes(scope_key) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint security_review_test_area_check check (test_area in (
    'authentication','authorization','rls','api','storage','camera','ai_observer','payments','webhooks','mobile','privacy','ci_cd','infrastructure'
  )),
  constraint security_review_test_severity_check check (severity in ('critical','high','medium','low','informational')),
  constraint security_review_test_status_check check (status in ('draft','ready_for_external_tester','under_test','passed','failed','blocked','accepted_risk'))
);

create table if not exists public.external_security_findings (
  id uuid primary key default gen_random_uuid(),
  finding_key text not null unique,
  finding_title text not null,
  severity text not null default 'medium',
  affected_system text not null,
  affected_route text,
  evidence text,
  reproduction_steps jsonb not null default '[]'::jsonb,
  recommendation text not null,
  owner_role text not null default 'admin',
  status text not null default 'open',
  due_date date,
  verified_at timestamptz,
  accepted_risk_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_security_finding_severity_check check (severity in ('critical','high','medium','low','informational')),
  constraint external_security_finding_status_check check (status in ('open','triaged','fixed','accepted_risk','verified','closed')),
  constraint external_security_finding_accepted_risk_check check (status <> 'accepted_risk' or accepted_risk_reason is not null)
);

create table if not exists public.external_tester_access_modes (
  id uuid primary key default gen_random_uuid(),
  mode_key text not null unique,
  status text not null default 'planned',
  allowed_resources jsonb not null default '[]'::jsonb,
  blocked_resources jsonb not null default '[]'::jsonb,
  testing_environment text not null default 'staging',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_tester_access_status_check check (status in ('planned','ready','active','disabled','completed')),
  constraint external_tester_access_env_check check (testing_environment in ('staging','test','sandbox'))
);

create table if not exists public.penetration_test_readiness_score (
  id uuid primary key default gen_random_uuid(),
  snapshot_key text not null unique,
  readiness_score integer not null default 0,
  scope_readiness integer not null default 0,
  test_environment_readiness integer not null default 0,
  test_user_readiness integer not null default 0,
  documentation_readiness integer not null default 0,
  audit_readiness integer not null default 0,
  remediation_workflow_readiness integer not null default 0,
  open_findings integer not null default 0,
  critical_findings integer not null default 0,
  high_findings integer not null default 0,
  external_review_status text not null default 'not_started',
  generated_from jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint penetration_test_score_range_check check (
    readiness_score between 0 and 100
    and scope_readiness between 0 and 100
    and test_environment_readiness between 0 and 100
    and test_user_readiness between 0 and 100
    and documentation_readiness between 0 and 100
    and audit_readiness between 0 and 100
    and remediation_workflow_readiness between 0 and 100
  ),
  constraint penetration_test_external_status_check check (external_review_status in ('not_started','ready_for_external_tester','scheduled','in_progress','retest_pending','completed','blocked'))
);

create index if not exists penetration_test_scopes_status_idx on public.penetration_test_scopes(approval_status, environment);
create index if not exists security_test_user_pack_role_idx on public.security_test_user_pack(role_key, account_state, mfa_state);
create index if not exists security_review_test_plans_area_idx on public.security_review_test_plans(test_area, severity, status);
create index if not exists external_security_findings_status_idx on public.external_security_findings(status, severity, due_date);
create index if not exists penetration_test_readiness_created_idx on public.penetration_test_readiness_score(created_at desc);

alter table public.penetration_test_scopes enable row level security;
alter table public.security_test_user_pack enable row level security;
alter table public.security_review_test_plans enable row level security;
alter table public.external_security_findings enable row level security;
alter table public.external_tester_access_modes enable row level security;
alter table public.penetration_test_readiness_score enable row level security;

drop policy if exists "penetration test scopes admin only" on public.penetration_test_scopes;
create policy "penetration test scopes admin only" on public.penetration_test_scopes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security test user pack admin only" on public.security_test_user_pack;
create policy "security test user pack admin only" on public.security_test_user_pack for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "security review test plans admin only" on public.security_review_test_plans;
create policy "security review test plans admin only" on public.security_review_test_plans for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "external security findings admin only" on public.external_security_findings;
create policy "external security findings admin only" on public.external_security_findings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "external tester access modes admin only" on public.external_tester_access_modes;
create policy "external tester access modes admin only" on public.external_tester_access_modes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "penetration test readiness admin only" on public.penetration_test_readiness_score;
create policy "penetration test readiness admin only" on public.penetration_test_readiness_score for all using (public.is_admin()) with check (public.is_admin());

insert into public.penetration_test_scopes (scope_key, scope_name, included_routes, included_roles, included_systems, excluded_systems, environment, test_restrictions, approval_status, metadata)
values
  ('auth-scope', 'Authentication', '["/login","/auth/callback","/api/passkeys/*","/api/security/trusted-device"]'::jsonb, '["admin","manager","parent","staff","inspector"]'::jsonb, '["Supabase Auth","session cookies","MFA readiness","trusted devices"]'::jsonb, '["production brute force","real user accounts"]'::jsonb, 'staging', 'No credential stuffing against production. Use provided test accounts only.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('authorization-scope', 'Authorization and role boundaries', '["/dashboard/*","/api/*"]'::jsonb, '["parent","staff","manager","inspector","admin"]'::jsonb, '["Next.js route guards","API authorization","role scopes"]'::jsonb, '["real child data","real parent data"]'::jsonb, 'staging', 'Test IDOR and role boundaries only against demo records.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('parent-portal-scope', 'Parent portal', '["/dashboard/parent/*","/api/parent/*"]'::jsonb, '["parent"]'::jsonb, '["children","messages","documents","payments","camera permissions"]'::jsonb, '["other families","raw AI events"]'::jsonb, 'staging', 'No access attempts against real children.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('manager-portal-scope', 'Manager portal', '["/dashboard/garden/*","/api/garden/*"]'::jsonb, '["manager","owner"]'::jsonb, '["garden operations","staff","children","payments","cameras"]'::jsonb, '["other gardens","platform admin routes"]'::jsonb, 'staging', 'Use demo kindergarten only.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('staff-portal-scope', 'Staff portal', '["/dashboard/staff/*","/api/staff/*"]'::jsonb, '["staff"]'::jsonb, '["tasks","attendance","documents","child updates"]'::jsonb, '["admin routes","other gardens"]'::jsonb, 'staging', 'No real staff data.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('inspector-portal-scope', 'Inspector portal', '["/dashboard/inspector/*","/api/inspections/*"]'::jsonb, '["inspector"]'::jsonb, '["assigned gardens","inspection reports","evidence metadata"]'::jsonb, '["unassigned gardens","parent private data"]'::jsonb, 'staging', 'Assigned garden scope only.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('admin-portal-scope', 'Admin portal', '["/dashboard/admin/*","/api/admin/*"]'::jsonb, '["admin"]'::jsonb, '["all admin dashboards","security","billing","legal review"]'::jsonb, '["secrets","production data export"]'::jsonb, 'staging', 'Admin testing must be audited and use test data only.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('api-scope', 'API routes', '["/api/*"]'::jsonb, '["all test roles"]'::jsonb, '["authentication","authorization","uploads","webhooks","payments"]'::jsonb, '["destructive production calls"]'::jsonb, 'staging', 'No destructive fuzzing or production load testing.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('rls-scope', 'Supabase RLS', '["database policies"]'::jsonb, '["parent","staff","manager","inspector","admin"]'::jsonb, '["children","parents","staff","documents","medical","camera","payments","AI","audit"]'::jsonb, '["service_role misuse","production tables"]'::jsonb, 'staging', 'Use test JWTs and demo data only.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('storage-scope', 'Supabase Storage', '["/api/storage/upload","/api/documents/*"]'::jsonb, '["parent","staff","manager","inspector","admin"]'::jsonb, '["documents","medical files","ID files","signatures","evidence","invoices"]'::jsonb, '["real sensitive files"]'::jsonb, 'staging', 'Do not upload malware or illegal content.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('camera-scope', 'Camera access', '["/dashboard/*/cameras","/api/camera-streams/*"]'::jsonb, '["parent","manager","inspector","admin"]'::jsonb, '["playback tokens","viewing hours","child checked-in","session audit","gateway"]'::jsonb, '["real RTSP credentials","live production streams"]'::jsonb, 'staging', 'Mock/demo camera only unless explicitly approved.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('ai-observer-scope', 'AI Observer', '["/dashboard/*/ai-events","/dashboard/*/observer-*","/api/ai-*"]'::jsonb, '["admin","manager","inspector","parent"]'::jsonb, '["raw AI visibility","review_required","parent_visible","restricted capabilities"]'::jsonb, '["face/audio activation","production AI actions"]'::jsonb, 'staging', 'No attempt to enable restricted capabilities in production.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('payments-scope', 'Payments', '["/api/garden/subscription","/api/garden/child-payments","/dashboard/*/payments"]'::jsonb, '["admin","manager","parent"]'::jsonb, '["sandbox payments","invoices","discounts","webhooks","revenue separation"]'::jsonb, '["live charges","raw card data"]'::jsonb, 'sandbox', 'Sandbox provider only. No real charges.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('webhooks-scope', 'Webhooks', '["payment webhooks","invoice webhooks","email/SMS/WhatsApp/push callbacks"]'::jsonb, '["system"]'::jsonb, '["signature verification","replay protection","idempotency","audit"]'::jsonb, '["real provider secrets"]'::jsonb, 'staging', 'Use test webhook secrets and replay-safe payloads.', 'ready_for_external_tester', '{"phase":167}'::jsonb),
  ('mobile-scope', 'Mobile apps', '["Capacitor app flows","deep links","push","camera viewing","GPS"]'::jsonb, '["parent","staff","manager","inspector"]'::jsonb, '["sessions","push tokens","device trust","offline queue","GPS spoofing"]'::jsonb, '["real device identifiers beyond test devices"]'::jsonb, 'staging', 'Use test devices and test accounts only.', 'draft', '{"phase":167}'::jsonb)
on conflict (scope_key) do update set
  scope_name = excluded.scope_name,
  included_routes = excluded.included_routes,
  included_roles = excluded.included_roles,
  included_systems = excluded.included_systems,
  excluded_systems = excluded.excluded_systems,
  environment = excluded.environment,
  test_restrictions = excluded.test_restrictions,
  approval_status = excluded.approval_status,
  metadata = public.penetration_test_scopes.metadata || excluded.metadata,
  updated_at = now();

insert into public.security_test_user_pack (user_key, role_key, display_name, permissions_summary, expected_access, forbidden_access, environment, mfa_state, account_state, credential_delivery_status, notes, metadata)
values
  ('pt-admin', 'admin', 'PT Admin Test User', 'Admin test account for security review. Sensitive actions must be audited.', '["admin dashboards","security review","findings register"]'::jsonb, '["production secrets","real payment data","real camera streams"]'::jsonb, 'staging', 'with_mfa', 'active', 'not_generated', 'Credentials must be generated out of band for authorized tester only.', '{"phase":167}'::jsonb),
  ('pt-manager', 'manager', 'PT Manager Test User', 'Manager scoped to demo kindergarten.', '["own garden","demo children","demo staff","demo cameras"]'::jsonb, '["other gardens","platform admin routes"]'::jsonb, 'staging', 'with_mfa', 'active', 'not_generated', 'Use demo kindergarten only.', '{"phase":167}'::jsonb),
  ('pt-parent', 'parent', 'PT Parent Test User', 'Parent scoped to own demo child.', '["own child","approved documents","permitted camera test"]'::jsonb, '["other children","other gardens","raw AI","investigations"]'::jsonb, 'staging', 'with_mfa', 'active', 'not_generated', 'Parent access isolation focus.', '{"phase":167}'::jsonb),
  ('pt-staff', 'staff', 'PT Staff Test User', 'Staff scoped to demo kindergarten.', '["staff tasks","attendance readiness","child updates"]'::jsonb, '["admin routes","other gardens","billing admin"]'::jsonb, 'staging', 'test_ready', 'active', 'not_generated', 'Normal GPS attendance should not require MFA every time.', '{"phase":167}'::jsonb),
  ('pt-inspector', 'inspector', 'PT Inspector Test User', 'Inspector assigned to demo garden only.', '["assigned inspections","assigned cameras metadata","reviewed observer signals"]'::jsonb, '["unassigned gardens","parent medical data outside scope"]'::jsonb, 'staging', 'with_mfa', 'active', 'not_generated', 'Scope bypass testing.', '{"phase":167}'::jsonb),
  ('pt-suspended', 'suspended_user', 'PT Suspended User', 'Suspended user should be blocked from sensitive app access.', '[]'::jsonb, '["all dashboards","all APIs"]'::jsonb, 'staging', 'blocked', 'suspended', 'not_generated', 'Suspension enforcement test.', '{"phase":167}'::jsonb),
  ('pt-inactive', 'inactive_user', 'PT Inactive User', 'Inactive user should not regain access silently.', '[]'::jsonb, '["all dashboards","all APIs"]'::jsonb, 'staging', 'blocked', 'inactive', 'not_generated', 'Inactive account test.', '{"phase":167}'::jsonb),
  ('pt-without-mfa', 'limited_user', 'PT User Without MFA', 'User missing MFA should be blocked from sensitive actions.', '["basic non-sensitive dashboard if allowed"]'::jsonb, '["cameras","medical data","exports","payment/bank changes","admin settings"]'::jsonb, 'staging', 'without_mfa', 'limited', 'not_generated', 'Sensitive action MFA gate test.', '{"phase":167}'::jsonb)
on conflict (user_key) do update set
  role_key = excluded.role_key,
  display_name = excluded.display_name,
  permissions_summary = excluded.permissions_summary,
  expected_access = excluded.expected_access,
  forbidden_access = excluded.forbidden_access,
  environment = excluded.environment,
  mfa_state = excluded.mfa_state,
  account_state = excluded.account_state,
  notes = excluded.notes,
  metadata = public.security_test_user_pack.metadata || excluded.metadata,
  updated_at = now();

insert into public.security_review_test_plans (plan_key, test_area, title, severity, objective, test_steps, expected_result, prohibited_actions, evidence_required, related_scope_key, metadata)
values
  ('auth-login-session-mfa', 'authentication', 'Login, MFA, session and trusted-device review', 'critical', 'Verify authentication hardening without brute force or production attack.', '["login with test users","verify MFA sensitive-action gate","test logout/session expiration","test new-device alert readiness"]'::jsonb, 'Only authorized test users can authenticate; sensitive actions require MFA where configured.', '["credential stuffing","production brute force","real user lockout"]'::jsonb, 'Screenshots/logs showing allowed and denied cases.', 'auth-scope', '{"phase":167}'::jsonb),
  ('authz-parent-isolation', 'authorization', 'Parent cannot access other child or garden', 'critical', 'Verify no IDOR between children, parents or gardens.', '["login as pt-parent","attempt own child access","attempt another child id","attempt other garden routes","attempt raw AI endpoint"]'::jsonb, 'Own child allowed; other child/garden/raw AI denied and audited.', '["real child IDs","production data"]'::jsonb, 'Request/response IDs redacted, denial evidence.', 'parent-portal-scope', '{"phase":167}'::jsonb),
  ('authz-manager-inspector-scope', 'authorization', 'Manager and inspector scope separation', 'critical', 'Verify manager cannot cross gardens and inspector cannot access unassigned gardens.', '["login as manager","attempt other garden","login as inspector","attempt unassigned garden"]'::jsonb, 'Cross-scope requests denied.', '["real garden data"]'::jsonb, 'Denied request evidence.', 'authorization-scope', '{"phase":167}'::jsonb),
  ('rls-sensitive-tables', 'rls', 'RLS coverage for sensitive tables', 'critical', 'Verify RLS blocks unauthorized direct Supabase access.', '["test children","parents","staff","documents","medical","camera","payments","AI","audit tables"]'::jsonb, 'Only role/garden/child scoped rows are returned.', '["service_role testing outside approved harness"]'::jsonb, 'RLS matrix with allowed/denied evidence.', 'rls-scope', '{"phase":167}'::jsonb),
  ('api-idors-injection-upload', 'api', 'API IDOR, injection and upload review', 'high', 'Review API routes for missing auth, IDOR, injection and upload abuse.', '["test unauthenticated","test wrong role","test object id tampering","test upload restrictions"]'::jsonb, 'Unauthorized requests denied; uploads constrained and audited.', '["destructive fuzzing","malware upload"]'::jsonb, 'Route list and sampled evidence.', 'api-scope', '{"phase":167}'::jsonb),
  ('storage-private-files', 'storage', 'Sensitive storage access review', 'critical', 'Verify no sensitive bucket/file is public or downloadable without scope.', '["test ID documents","medical docs","staff certificates","inspection evidence","incident evidence","invoices","signatures"]'::jsonb, 'Sensitive files require scoped signed access and audit readiness.', '["real sensitive files"]'::jsonb, 'Storage access matrix.', 'storage-scope', '{"phase":167}'::jsonb),
  ('camera-token-bypass', 'camera', 'Camera token and viewing policy bypass review', 'critical', 'Verify camera viewing cannot bypass permissions, hours, child presence or MFA.', '["test parent without permission","outside hours","child checked out","expired token","inspector unassigned"]'::jsonb, 'Viewing blocked unless all controls pass; sessions audited.', '["real RTSP","real production streams"]'::jsonb, 'Playback-token denial evidence.', 'camera-scope', '{"phase":167}'::jsonb),
  ('ai-parent-raw-block', 'ai_observer', 'Raw AI and restricted capability exposure review', 'critical', 'Verify parents cannot see raw AI and restricted capabilities cannot activate silently.', '["test parent raw AI routes","test parent_visible bypass","test review_required bypass","check audio/face disabled"]'::jsonb, 'Raw AI denied; legal_review_required capabilities blocked.', '["enable restricted AI in production"]'::jsonb, 'Denied access and policy guard evidence.', 'ai-observer-scope', '{"phase":167}'::jsonb),
  ('payments-separation-webhooks', 'payments', 'Payment separation and webhook review', 'high', 'Verify no raw card storage and revenue streams stay separated.', '["test sandbox payment","test webhook replay","test invoice access","test discount tampering"]'::jsonb, 'Raw card data absent; webhooks idempotent; tuition routes to kindergarten account model.', '["live charges","real card data"]'::jsonb, 'Sandbox-only evidence.', 'payments-scope', '{"phase":167}'::jsonb),
  ('webhook-signature-replay', 'webhooks', 'Webhook signature, replay and idempotency readiness', 'high', 'Verify webhook endpoints reject unsigned/replayed payloads where provider-ready.', '["send unsigned payload","send replay payload","send duplicate idempotency key"]'::jsonb, 'Invalid/replayed webhooks rejected or marked skipped; events audited.', '["real provider secrets"]'::jsonb, 'Webhook response and log evidence.', 'webhooks-scope', '{"phase":167}'::jsonb),
  ('mobile-session-camera-gps', 'mobile', 'Mobile session, push, camera and GPS abuse readiness', 'medium', 'Review mobile app controls and abuse scenarios.', '["test deep link auth","push token ownership","camera view session","GPS spoofing risk","offline queue replay"]'::jsonb, 'Sensitive actions are scoped and replay-resistant where implemented.', '["real device identifiers beyond test devices"]'::jsonb, 'Mobile test notes.', 'mobile-scope', '{"phase":167}'::jsonb),
  ('privacy-rights-abuse', 'privacy', 'Privacy request and medical data authorization review', 'high', 'Verify export/deletion/medical access cannot be abused.', '["submit request as parent","attempt other subject export","test legal hold block","test medical access audit"]'::jsonb, 'Requests are scoped, reviewed and audited; legal holds block unsafe deletion.', '["real subject data"]'::jsonb, 'Privacy workflow evidence.', null, '{"phase":167}'::jsonb)
on conflict (plan_key) do update set
  test_area = excluded.test_area,
  title = excluded.title,
  severity = excluded.severity,
  objective = excluded.objective,
  test_steps = excluded.test_steps,
  expected_result = excluded.expected_result,
  prohibited_actions = excluded.prohibited_actions,
  evidence_required = excluded.evidence_required,
  related_scope_key = excluded.related_scope_key,
  metadata = public.security_review_test_plans.metadata || excluded.metadata,
  updated_at = now();

insert into public.external_security_findings (finding_key, finding_title, severity, affected_system, affected_route, evidence, reproduction_steps, recommendation, owner_role, status, due_date, metadata)
values
  ('pt-no-external-test-yet', 'External penetration test not yet performed', 'high', 'security_review', '/dashboard/admin/security-review', 'Readiness package exists, but no authorized external PT report is attached yet.', '["Schedule authorized tester","Run approved scope","Attach report","Track findings"]'::jsonb, 'Schedule external security company and import findings into this register.', 'admin', 'open', current_date + 60, '{"phase":167,"blocks_production":true}'::jsonb),
  ('pt-staging-users-not-generated', 'Security test users not yet generated', 'medium', 'test_environment', null, 'Test user pack is documented; real staging credentials must be generated securely out of band.', '["Create staging accounts","Assign demo data","Enable required MFA states","Deliver credentials securely"]'::jsonb, 'Generate and revoke test credentials through approved process only.', 'admin', 'triaged', current_date + 30, '{"phase":167}'::jsonb),
  ('pt-mobile-dast-pending', 'Mobile security testing still pending', 'medium', 'mobile', null, 'Capacitor mobile test plan exists, but external mobile review has not been executed.', '["Build staging mobile app","Test deep links","Test push tokens","Test camera capture limitations"]'::jsonb, 'Run mobile-specific security review on staging app builds.', 'admin', 'open', current_date + 75, '{"phase":167}'::jsonb)
on conflict (finding_key) do update set
  finding_title = excluded.finding_title,
  severity = excluded.severity,
  affected_system = excluded.affected_system,
  affected_route = excluded.affected_route,
  evidence = excluded.evidence,
  reproduction_steps = excluded.reproduction_steps,
  recommendation = excluded.recommendation,
  owner_role = excluded.owner_role,
  status = excluded.status,
  due_date = excluded.due_date,
  metadata = public.external_security_findings.metadata || excluded.metadata,
  updated_at = now();

insert into public.external_tester_access_modes (mode_key, status, allowed_resources, blocked_resources, testing_environment, notes, metadata)
values (
  'external-pt-staging-access',
  'planned',
  '["penetration_test_scopes","security_test_user_pack","security_review_test_plans","external_security_findings","rules_of_engagement","architecture_pack"]'::jsonb,
  '["real_children","real_parents","real_medical_data","real_payment_data","live_camera_streams","production_secrets","service_role_keys"]'::jsonb,
  'staging',
  'External tester receives staging-only scope, test users and findings dashboard. No production data or secrets.',
  '{"phase":167}'::jsonb
)
on conflict (mode_key) do update set
  status = excluded.status,
  allowed_resources = excluded.allowed_resources,
  blocked_resources = excluded.blocked_resources,
  testing_environment = excluded.testing_environment,
  notes = excluded.notes,
  metadata = public.external_tester_access_modes.metadata || excluded.metadata,
  updated_at = now();

insert into public.penetration_test_readiness_score (
  snapshot_key,
  readiness_score,
  scope_readiness,
  test_environment_readiness,
  test_user_readiness,
  documentation_readiness,
  audit_readiness,
  remediation_workflow_readiness,
  open_findings,
  critical_findings,
  high_findings,
  external_review_status,
  generated_from,
  metadata
)
values (
  'phase167-pt-readiness-baseline',
  78,
  92,
  68,
  70,
  90,
  82,
  88,
  3,
  0,
  1,
  'ready_for_external_tester',
  '{"source":"seeded_phase167_readiness","phase":167}'::jsonb,
  '{"no_destructive_testing":true,"staging_only":true,"not_external_approval":true}'::jsonb
)
on conflict (snapshot_key) do update set
  readiness_score = excluded.readiness_score,
  scope_readiness = excluded.scope_readiness,
  test_environment_readiness = excluded.test_environment_readiness,
  test_user_readiness = excluded.test_user_readiness,
  documentation_readiness = excluded.documentation_readiness,
  audit_readiness = excluded.audit_readiness,
  remediation_workflow_readiness = excluded.remediation_workflow_readiness,
  open_findings = excluded.open_findings,
  critical_findings = excluded.critical_findings,
  high_findings = excluded.high_findings,
  external_review_status = excluded.external_review_status,
  generated_from = excluded.generated_from,
  metadata = excluded.metadata;

comment on table public.penetration_test_scopes is 'External penetration test scope register. Staging/sandbox only unless explicitly approved.';
comment on table public.security_test_user_pack is 'Test user pack for authorized external security testers. Credentials are not stored here.';
comment on table public.security_review_test_plans is 'Security test plans for authentication, authorization, RLS, API, storage, camera, AI, payments, webhooks, mobile and privacy.';
comment on table public.external_security_findings is 'External penetration test findings register. Evidence summaries only; do not store secrets or real sensitive data.';
comment on table public.external_tester_access_modes is 'Future external tester access mode. No real children, medical data, payment data, camera streams or secrets.';
comment on table public.penetration_test_readiness_score is 'Internal penetration-test readiness score. Not a penetration test result.';

notify pgrst, 'reload schema';
