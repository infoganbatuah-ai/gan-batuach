-- PHASE 155: Mandatory MFA, Identity Hardening & Trusted Device Platform

alter table if exists public.mfa_enrollment_status
  drop constraint if exists mfa_enrollment_role_check;

alter table if exists public.mfa_enrollment_status
  add constraint mfa_enrollment_role_check
  check (role in ('admin','owner','manager','parent','staff','inspector','network_manager','observer_site_owner'));

alter table if exists public.mfa_enrollment_status
  add column if not exists enforcement_status text not null default 'optional',
  add column if not exists mfa_required_at timestamptz,
  add column if not exists mfa_grace_until timestamptz,
  add column if not exists mfa_enrolled_at timestamptz,
  add column if not exists mfa_last_verified_at timestamptz,
  add column if not exists supabase_totp_enrolled boolean not null default false,
  add column if not exists sms_provider_ready boolean not null default false,
  add column if not exists backup_codes_ready boolean not null default false,
  add column if not exists sensitive_actions_blocked boolean not null default false,
  add column if not exists blocked_reason text;

alter table if exists public.mfa_enrollment_status
  drop constraint if exists mfa_enforcement_status_check;

alter table if exists public.mfa_enrollment_status
  add constraint mfa_enforcement_status_check
  check (enforcement_status in ('optional','required','grace_period','enforced'));

alter table if exists public.trusted_devices
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists device_fingerprint text,
  add column if not exists device_name text,
  add column if not exists user_agent text,
  add column if not exists ip_address inet,
  add column if not exists browser text,
  add column if not exists os text,
  add column if not exists device_type text,
  add column if not exists risk_status text not null default 'new',
  add column if not exists last_mfa_verified_at timestamptz;

alter table if exists public.trusted_devices
  drop constraint if exists trusted_devices_risk_status_check;

alter table if exists public.trusted_devices
  add constraint trusted_devices_risk_status_check
  check (risk_status in ('new','trusted','suspicious','revoked','blocked'));

alter table if exists public.security_sessions
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null,
  add column if not exists revoke_reason text,
  add column if not exists mfa_verified_at timestamptz,
  add column if not exists sensitive_action_reauth_required boolean not null default false,
  add column if not exists ip_address inet,
  add column if not exists user_agent text;

alter table if exists public.security_events
  drop constraint if exists security_events_type_check;

alter table if exists public.security_events
  add constraint security_events_type_check check (event_type in (
    'failed_login','login_success','logout','password_reset_requested','password_changed',
    'mfa_enrolled','mfa_disabled','mfa_challenge_success','mfa_challenge_failure','mfa_failed',
    'backup_code_used','permission_violation','suspicious_access','account_lockout',
    'account_locked','account_recovered','new_device','new_device_login','trusted_device_added',
    'trusted_device_revoked','suspicious_device','suspicious_ip','forced_logout','session_revoked',
    'token_reuse','repeated_access_denied','medical_record_access','camera_viewing',
    'data_export_request','data_deletion_request','excessive_camera_viewing','suspicious_document_access'
  ));

create table if not exists public.mfa_enforcement_policies (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  enforcement_status text not null default 'optional',
  required_for_sensitive_actions boolean not null default true,
  required_for_login boolean not null default false,
  grace_period_days integer not null default 30,
  sensitive_actions jsonb not null default '[]'::jsonb,
  user_message_he text not null default 'אימות נוסף נדרש כדי להגן על המידע.',
  provider_readiness jsonb not null default '{}'::jsonb,
  rollout_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mfa_policy_role_check check (role_key in ('admin','owner','manager','staff','parent','inspector','observer_site_owner','network_manager')),
  constraint mfa_policy_status_check check (enforcement_status in ('optional','required','grace_period','enforced')),
  constraint mfa_policy_grace_check check (grace_period_days between 0 and 180)
);

create table if not exists public.account_security_locks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  lock_reason text not null,
  lock_status text not null default 'active',
  failed_attempt_count integer not null default 0,
  locked_at timestamptz not null default now(),
  unlock_at timestamptz,
  unlocked_at timestamptz,
  unlocked_by uuid references public.profiles(id) on delete set null,
  admin_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_lock_status_check check (lock_status in ('active','expired','admin_unlocked','auto_unlocked','cancelled'))
);

create table if not exists public.mfa_backup_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  code_hash text not null,
  code_label text,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(profile_id, code_hash)
);

create table if not exists public.identity_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  recovery_status text not null default 'requested',
  identity_verification_status text not null default 'pending',
  recovery_action text,
  admin_actor_id uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_recovery_status_check check (recovery_status in ('requested','reviewing','approved','completed','rejected','cancelled')),
  constraint identity_recovery_verification_check check (identity_verification_status in ('pending','verified','failed','not_required'))
);

create table if not exists public.sensitive_action_mfa_rules (
  id uuid primary key default gen_random_uuid(),
  action_key text not null unique,
  action_category text not null,
  title_he text not null,
  required_roles text[] not null default array[]::text[],
  fresh_challenge_minutes integer not null default 30,
  enforcement_status text not null default 'grace_period',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sensitive_action_enforcement_status_check check (enforcement_status in ('optional','required','grace_period','enforced'))
);

create index if not exists mfa_enforcement_role_idx on public.mfa_enforcement_policies(role_key, enforcement_status);
create index if not exists account_security_locks_profile_idx on public.account_security_locks(profile_id, lock_status, locked_at desc);
create index if not exists mfa_backup_codes_profile_idx on public.mfa_backup_codes(profile_id, used_at, revoked_at);
create index if not exists identity_recovery_profile_idx on public.identity_recovery_requests(profile_id, recovery_status, created_at desc);
create index if not exists trusted_devices_user_risk_idx on public.trusted_devices((coalesce(user_id, profile_id)), risk_status, last_seen_at desc);
create index if not exists security_sessions_revoked_idx on public.security_sessions(profile_id, revoked_at, expires_at desc);

alter table public.mfa_enforcement_policies enable row level security;
alter table public.account_security_locks enable row level security;
alter table public.mfa_backup_codes enable row level security;
alter table public.identity_recovery_requests enable row level security;
alter table public.sensitive_action_mfa_rules enable row level security;

drop policy if exists "mfa enrollment owner read" on public.mfa_enrollment_status;
create policy "mfa enrollment owner read" on public.mfa_enrollment_status
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "mfa enrollment owner insert" on public.mfa_enrollment_status;
create policy "mfa enrollment owner insert" on public.mfa_enrollment_status
  for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "mfa enrollment owner update readiness" on public.mfa_enrollment_status;
create policy "mfa enrollment owner update readiness" on public.mfa_enrollment_status
  for update using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "trusted devices owner read" on public.trusted_devices;
create policy "trusted devices owner read" on public.trusted_devices
  for select using (profile_id = auth.uid() or user_id = auth.uid() or public.is_admin());

drop policy if exists "trusted devices owner insert" on public.trusted_devices;
create policy "trusted devices owner insert" on public.trusted_devices
  for insert with check (profile_id = auth.uid() or user_id = auth.uid() or public.is_admin());

drop policy if exists "trusted devices owner update" on public.trusted_devices;
create policy "trusted devices owner update" on public.trusted_devices
  for update using (profile_id = auth.uid() or user_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or user_id = auth.uid() or public.is_admin());

drop policy if exists "security sessions owner read" on public.security_sessions;
create policy "security sessions owner read" on public.security_sessions
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "security events owner read" on public.security_events;
create policy "security events owner read" on public.security_events
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "security events owner insert" on public.security_events;
create policy "security events owner insert" on public.security_events
  for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "mfa policies admin read" on public.mfa_enforcement_policies;
create policy "mfa policies admin read" on public.mfa_enforcement_policies for select using (public.is_admin());

drop policy if exists "mfa policies admin write" on public.mfa_enforcement_policies;
create policy "mfa policies admin write" on public.mfa_enforcement_policies for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "account locks admin read" on public.account_security_locks;
create policy "account locks admin read" on public.account_security_locks for select using (public.is_admin());

drop policy if exists "backup codes owner read" on public.mfa_backup_codes;
create policy "backup codes owner read" on public.mfa_backup_codes for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "identity recovery scoped read" on public.identity_recovery_requests;
create policy "identity recovery scoped read" on public.identity_recovery_requests for select using (profile_id = auth.uid() or requested_by = auth.uid() or public.is_admin());

drop policy if exists "sensitive action rules admin read" on public.sensitive_action_mfa_rules;
create policy "sensitive action rules admin read" on public.sensitive_action_mfa_rules for select using (public.is_admin());

insert into public.mfa_enforcement_policies (role_key, enforcement_status, required_for_sensitive_actions, required_for_login, grace_period_days, sensitive_actions, provider_readiness, rollout_notes)
values
  ('admin', 'required', true, true, 0, '["role_change","security_settings","audit_export","billing_configuration","regulatory_settings","permission_override"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Admins require immediate MFA before sensitive administration.'),
  ('owner', 'required', true, false, 14, '["kindergarten_activation","payment_change","staff_role_management","camera_permission_change","data_export"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Owners have grace period before full sensitive-action blocking.'),
  ('manager', 'required', true, false, 14, '["kindergarten_activation","payment_change","staff_role_management","camera_permission_change","medical_view","data_export"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Managers have grace period before sensitive-action blocking.'),
  ('inspector', 'required', true, false, 7, '["inspection_submit","inspection_signature","evidence_download","complaint_access","camera_evidence","report_export"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Inspectors require MFA for field evidence and report actions.'),
  ('staff', 'required', true, false, 21, '["new_device","suspicious_location","manual_attendance_correction","attendance_override","identity_sensitive_action"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Normal GPS attendance should not prompt every time.'),
  ('parent', 'grace_period', true, false, 30, '["camera_view","medical_view","pickup_action","sensitive_document_download"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Parents require MFA before camera, medical, pickup and sensitive document actions.'),
  ('observer_site_owner', 'required', true, false, 14, '["camera_view","observer_settings","site_user_management"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Future Digital Observer site owners require MFA.'),
  ('network_manager', 'required', true, false, 14, '["network_export","role_change","security_settings"]'::jsonb, '{"totp":"supabase_ready","sms":"provider_required","backup_codes":"schema_ready"}'::jsonb, 'Network managers require MFA for cross-kindergarten access.')
on conflict (role_key) do update set
  enforcement_status = excluded.enforcement_status,
  required_for_sensitive_actions = excluded.required_for_sensitive_actions,
  required_for_login = excluded.required_for_login,
  grace_period_days = excluded.grace_period_days,
  sensitive_actions = excluded.sensitive_actions,
  provider_readiness = excluded.provider_readiness,
  rollout_notes = excluded.rollout_notes,
  updated_at = now();

insert into public.sensitive_action_mfa_rules (action_key, action_category, title_he, required_roles, fresh_challenge_minutes, enforcement_status, metadata)
values
  ('camera_view', 'camera', 'צפייה במצלמות', array['parent','manager','owner','inspector','admin'], 30, 'enforced', '{"message":"נדרש אימות נוסף לפני צפייה במצלמות."}'::jsonb),
  ('medical_view', 'medical', 'צפייה במידע רפואי', array['parent','staff','manager','owner','inspector','admin'], 30, 'grace_period', '{"message":"אימות נוסף נדרש כדי להגן על המידע הרפואי."}'::jsonb),
  ('document_download', 'document', 'הורדת מסמך רגיש', array['parent','staff','manager','owner','inspector','admin'], 30, 'grace_period', '{}'::jsonb),
  ('payment_change', 'payment', 'שינוי פרטי תשלום או בנק', array['manager','owner','admin'], 15, 'grace_period', '{}'::jsonb),
  ('role_change', 'admin', 'שינוי תפקידים והרשאות', array['admin','owner','manager'], 15, 'grace_period', '{}'::jsonb),
  ('data_export', 'privacy', 'ייצוא מידע', array['admin','owner','manager','inspector'], 15, 'grace_period', '{}'::jsonb),
  ('data_deletion', 'privacy', 'מחיקה או אנונימיזציה', array['admin','owner'], 15, 'grace_period', '{}'::jsonb),
  ('inspection_submit', 'inspection', 'הגשת דוח פיקוח', array['inspector','admin'], 30, 'grace_period', '{}'::jsonb),
  ('attendance_override', 'attendance', 'תיקון נוכחות ידני', array['staff','manager','owner','admin'], 30, 'grace_period', '{}'::jsonb)
on conflict (action_key) do update set
  action_category = excluded.action_category,
  title_he = excluded.title_he,
  required_roles = excluded.required_roles,
  fresh_challenge_minutes = excluded.fresh_challenge_minutes,
  enforcement_status = excluded.enforcement_status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('mfa', 'phase155-role-mfa-policy', 'Role-based MFA enforcement policies', 'partial', 'critical', 'mfa_enforcement_policies defines gradual MFA by role without locking users out.', 'Connect Supabase MFA factor verification and update mfa_last_verified_at on challenge success.', '{"phase":155}'::jsonb),
  ('device_trust', 'phase155-trusted-device-registry', 'Trusted device registry', 'partial', 'high', 'trusted_devices stores hashed fingerprints, IP, user agent, platform and risk status.', 'Wire login lifecycle to recordTrustedDevice for every successful login.', '{"phase":155}'::jsonb),
  ('session_security', 'phase155-sensitive-action-reauth', 'Sensitive action MFA gates', 'partial', 'critical', 'Sensitive action rule table and helper enforce camera MFA readiness without broad lockout.', 'Apply getMfaGateStatus to document downloads, payments, role changes, exports and inspection signing.', '{"phase":155}'::jsonb),
  ('authentication', 'phase155-account-lockout', 'Account lockout readiness', 'partial', 'high', 'account_security_locks supports temporary locks, cooldowns and admin recovery.', 'Wire failed login telemetry into account_security_locks.', '{"phase":155}'::jsonb)
on conflict (check_key) do update set
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.audit_event_catalog (event_key, category, title, required, implemented, source_table, notes, data_classification, metadata)
values
  ('mfa-enrolled', 'authentication', 'MFA enrolled', true, false, 'immutable_audit_events', 'Supabase MFA callback/challenge route should write immutable event.', 'sensitive', '{"phase":155}'::jsonb),
  ('mfa-challenge-failure', 'authentication', 'MFA challenge failure', true, false, 'security_events', 'Failed MFA challenges must create security and immutable audit events.', 'sensitive', '{"phase":155}'::jsonb),
  ('new-device-login', 'authentication', 'New device login', true, true, 'trusted_devices', 'recordTrustedDevice writes security audit event on new device.', 'sensitive', '{"phase":155}'::jsonb),
  ('account-locked', 'authentication', 'Account locked', true, false, 'account_security_locks', 'Repeated failed login lockout event readiness.', 'sensitive', '{"phase":155}'::jsonb),
  ('backup-code-used', 'authentication', 'Backup code used', true, false, 'mfa_backup_codes', 'Backup code usage must be one-time and audited.', 'sensitive', '{"phase":155}'::jsonb)
on conflict (event_key) do update set
  implemented = excluded.implemented,
  source_table = excluded.source_table,
  notes = excluded.notes,
  data_classification = excluded.data_classification,
  metadata = excluded.metadata;

insert into public.communication_templates (template_key, audience_role, title, body, whatsapp_template_name, approved_template_variables)
values
  ('mfa_setup_required', 'all', 'נדרש אימות נוסף', 'אימות נוסף נדרש כדי להגן על המידע. יש להשלים את ההגדרה במרכז האבטחה.', 'mfa_setup_required_he', '["userName"]'::jsonb),
  ('mfa_setup_completed', 'all', 'אימות נוסף הופעל', 'אימות נוסף הופעל בהצלחה בחשבון שלך.', 'mfa_setup_completed_he', '["userName"]'::jsonb),
  ('new_device_login', 'all', 'כניסה ממכשיר חדש', 'זוהתה כניסה ממכשיר חדש. אם זו לא הייתה פעולה שלך, יש לפנות לתמיכה.', 'new_device_login_he', '["userName","deviceName"]'::jsonb),
  ('suspicious_login', 'all', 'כניסה חשודה', 'זוהתה פעילות חריגה בחשבון. ייתכן שנדרש אימות נוסף.', 'suspicious_login_he', '["userName"]'::jsonb),
  ('account_locked', 'all', 'החשבון ננעל זמנית', 'החשבון ננעל זמנית להגנה על המידע. ניתן לפנות לתמיכה או להמתין לשחרור.', 'account_locked_he', '["userName"]'::jsonb),
  ('account_recovered', 'all', 'הגישה לחשבון שוחזרה', 'הגישה לחשבון שוחזרה לאחר בדיקה ואישור.', 'account_recovered_he', '["userName"]'::jsonb)
on conflict (template_key) do update set
  audience_role = excluded.audience_role,
  title = excluded.title,
  body = excluded.body,
  whatsapp_template_name = excluded.whatsapp_template_name,
  approved_template_variables = excluded.approved_template_variables,
  updated_at = now();

comment on table public.mfa_enforcement_policies is 'Role-based MFA rollout and sensitive-action enforcement policy.';
comment on table public.account_security_locks is 'Temporary account lockout and admin recovery readiness.';
comment on table public.mfa_backup_codes is 'Hashed one-time backup code registry. Raw backup codes must never be stored.';
comment on table public.identity_recovery_requests is 'Admin-assisted identity recovery workflow with verification and audit requirements.';
comment on table public.sensitive_action_mfa_rules is 'Sensitive action MFA challenge rules for camera, medical, document, payment, inspection and admin actions.';
