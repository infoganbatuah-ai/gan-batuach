-- PHASE 147: Legal Camera Streaming, Parent Viewing & Anti-Leak Protection Platform

alter table if exists public.camera_streams
  add column if not exists legal_streaming_status text not null default 'needs_review',
  add column if not exists direct_rtsp_exposure_blocked boolean not null default true,
  add column if not exists parent_mfa_required boolean not null default true,
  add column if not exists child_presence_required boolean not null default true,
  add column if not exists watermark_required boolean not null default true,
  add column if not exists anti_screenshot_required boolean not null default true,
  add column if not exists anti_recording_notice_required boolean not null default true,
  add column if not exists max_parent_session_minutes integer not null default 5,
  add column if not exists legal_viewing_notes text;

alter table if exists public.camera_playback_sessions
  add column if not exists child_id uuid references public.children(id) on delete set null,
  add column if not exists parent_id uuid references public.parents(id) on delete set null,
  add column if not exists watermark_text text,
  add column if not exists watermark_hash text,
  add column if not exists forced_disconnect_at timestamptz,
  add column if not exists termination_reason text,
  add column if not exists compliance_status text not null default 'logged',
  add column if not exists capture_detected boolean not null default false,
  add column if not exists suspicious_score integer not null default 0;

alter table if exists public.video_stream_sessions
  add column if not exists child_id uuid references public.children(id) on delete set null,
  add column if not exists watermark_text text,
  add column if not exists forced_disconnect_at timestamptz,
  add column if not exists termination_reason text;

create table if not exists public.parent_camera_policies (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  policy_key text not null,
  viewing_enabled boolean not null default false,
  approved_camera_ids uuid[] not null default '{}'::uuid[],
  viewing_hours jsonb not null default '{"window":"08:00-12:00"}'::jsonb,
  restricted_hours jsonb not null default '{}'::jsonb,
  max_session_minutes integer not null default 5,
  mfa_required boolean not null default true,
  child_presence_required boolean not null default true,
  watermark_required boolean not null default true,
  anti_screenshot_required boolean not null default true,
  anti_recording_notice_required boolean not null default true,
  status text not null default 'draft',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, policy_key),
  constraint parent_camera_policies_status_check check (status in ('draft','active','disabled','needs_legal_review')),
  constraint parent_camera_policies_session_check check (max_session_minutes between 1 and 30)
);

create table if not exists public.camera_streaming_gateway_compliance (
  id uuid primary key default gen_random_uuid(),
  gateway_key text not null unique,
  provider text not null,
  gateway_mode text not null,
  direct_camera_exposure_blocked boolean not null default true,
  supports_webrtc boolean not null default false,
  supports_hls boolean not null default true,
  supports_watermark boolean not null default false,
  supports_forced_disconnect boolean not null default false,
  status text not null default 'planned',
  readiness_score integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_gateway_compliance_provider_check check (provider in ('mediamtx','go2rtc','janus','custom','future_gateway')),
  constraint camera_gateway_compliance_mode_check check (gateway_mode in ('rtsp_to_hls','rtsp_to_webrtc','webrtc_gateway','hybrid','future')),
  constraint camera_gateway_compliance_status_check check (status in ('planned','configured','testing','ready','blocked')),
  constraint camera_gateway_compliance_score_check check (readiness_score between 0 and 100)
);

create table if not exists public.camera_viewing_authorization_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  parent_id uuid references public.parents(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  check_type text not null,
  status text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint camera_view_auth_type_check check (check_type in ('parent_verified','mfa_enabled','child_enrolled','child_present','kindergarten_enabled','viewing_window','camera_approved','token_issued','inspector_policy')),
  constraint camera_view_auth_status_check check (status in ('passed','failed','warning','not_applicable'))
);

create table if not exists public.camera_access_audit_trail (
  id uuid primary key default gen_random_uuid(),
  session_id uuid,
  camera_playback_session_id uuid references public.camera_playback_sessions(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  parent_id uuid references public.parents(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  viewer_role text,
  action text not null,
  status text not null default 'logged',
  ip inet,
  user_agent text,
  device_fingerprint_hash text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  watermark_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint camera_access_audit_action_check check (action in ('token_requested','token_created','view_started','view_ended','view_blocked','forced_disconnect','capture_warning','inspector_view','manager_policy_change')),
  constraint camera_access_audit_status_check check (status in ('logged','success','blocked','warning','failed'))
);

create table if not exists public.camera_security_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  alert_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint camera_security_alert_type_check check (alert_type in ('suspicious_viewing','excessive_viewing','repeated_failed_access','session_anomaly','capture_detected','policy_violation')),
  constraint camera_security_alert_severity_check check (severity in ('critical','high','medium','low')),
  constraint camera_security_alert_status_check check (status in ('open','reviewing','resolved','false_positive'))
);

create table if not exists public.camera_compliance_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  check_area text not null,
  title text not null,
  status text not null default 'partial',
  readiness_score integer not null default 0,
  severity text not null default 'medium',
  evidence_summary text,
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint camera_compliance_area_check check (check_area in ('parent_access','streaming_gateway','viewing_tokens','session_controls','watermark','anti_leak','audit','inspector_access','manager_controls')),
  constraint camera_compliance_status_check check (status in ('ready','partial','pending','blocked','needs_legal_review')),
  constraint camera_compliance_score_check check (readiness_score between 0 and 100),
  constraint camera_compliance_severity_check check (severity in ('critical','high','medium','low'))
);

create index if not exists parent_camera_policies_garden_idx on public.parent_camera_policies(garden_id, status);
create index if not exists camera_view_auth_camera_idx on public.camera_viewing_authorization_checks(camera_id, created_at desc);
create index if not exists camera_access_audit_camera_idx on public.camera_access_audit_trail(camera_id, created_at desc);
create index if not exists camera_access_audit_profile_idx on public.camera_access_audit_trail(profile_id, created_at desc);
create index if not exists camera_security_alerts_status_idx on public.camera_security_alerts(status, severity, created_at desc);
create index if not exists camera_compliance_checks_area_idx on public.camera_compliance_checks(check_area, status);
create index if not exists camera_playback_sessions_compliance_idx on public.camera_playback_sessions(compliance_status, started_at desc);

alter table public.parent_camera_policies enable row level security;
alter table public.camera_streaming_gateway_compliance enable row level security;
alter table public.camera_viewing_authorization_checks enable row level security;
alter table public.camera_access_audit_trail enable row level security;
alter table public.camera_security_alerts enable row level security;
alter table public.camera_compliance_checks enable row level security;

drop policy if exists "parent camera policies scoped read" on public.parent_camera_policies;
create policy "parent camera policies scoped read" on public.parent_camera_policies
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "parent camera policies manager write" on public.parent_camera_policies;
create policy "parent camera policies manager write" on public.parent_camera_policies
for all using (public.is_admin() or garden_id = public.current_garden_id())
with check (public.is_admin() or garden_id = public.current_garden_id());

drop policy if exists "camera gateway compliance admin only" on public.camera_streaming_gateway_compliance;
create policy "camera gateway compliance admin only" on public.camera_streaming_gateway_compliance for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "camera auth checks admin read" on public.camera_viewing_authorization_checks;
create policy "camera auth checks admin read" on public.camera_viewing_authorization_checks
for select using (public.is_admin() or public.can_access_garden(garden_id) or profile_id = auth.uid());

drop policy if exists "camera auth checks insert" on public.camera_viewing_authorization_checks;
create policy "camera auth checks insert" on public.camera_viewing_authorization_checks
for insert with check (public.is_admin() or profile_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "camera access audit scoped read" on public.camera_access_audit_trail;
create policy "camera access audit scoped read" on public.camera_access_audit_trail
for select using (public.is_admin() or public.can_access_garden(garden_id) or profile_id = auth.uid());

drop policy if exists "camera access audit insert" on public.camera_access_audit_trail;
create policy "camera access audit insert" on public.camera_access_audit_trail
for insert with check (public.is_admin() or profile_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "camera security alerts admin manager read" on public.camera_security_alerts;
create policy "camera security alerts admin manager read" on public.camera_security_alerts
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "camera security alerts admin manager write" on public.camera_security_alerts;
create policy "camera security alerts admin manager write" on public.camera_security_alerts
for all using (public.is_admin() or garden_id = public.current_garden_id())
with check (public.is_admin() or garden_id = public.current_garden_id());

drop policy if exists "camera compliance checks admin only" on public.camera_compliance_checks;
create policy "camera compliance checks admin only" on public.camera_compliance_checks for all using (public.is_admin()) with check (public.is_admin());

insert into public.camera_streaming_gateway_compliance (gateway_key, provider, gateway_mode, direct_camera_exposure_blocked, supports_webrtc, supports_hls, supports_watermark, supports_forced_disconnect, status, readiness_score, notes, metadata)
values
  ('mediamtx-parent-viewing', 'mediamtx', 'hybrid', true, true, true, false, true, 'testing', 72, 'MediaMTX readiness for gateway-only parent viewing. Watermark is handled at UI/session layer until gateway overlay is available.', '{"no_rtsp_to_browser":true}'::jsonb),
  ('go2rtc-parent-viewing', 'go2rtc', 'hybrid', true, true, true, false, true, 'planned', 58, 'go2rtc future readiness for WebRTC/HLS conversion.', '{"no_rtsp_to_browser":true}'::jsonb),
  ('janus-future-webrtc', 'janus', 'webrtc_gateway', true, true, false, false, true, 'planned', 42, 'Future Janus WebRTC gateway option.', '{"future":true}'::jsonb),
  ('future-secure-gateway', 'future_gateway', 'future', true, true, true, true, true, 'planned', 40, 'Future provider with server-side watermark and capture hooks.', '{"future":true}'::jsonb)
on conflict (gateway_key) do update set
  provider = excluded.provider,
  gateway_mode = excluded.gateway_mode,
  direct_camera_exposure_blocked = excluded.direct_camera_exposure_blocked,
  supports_webrtc = excluded.supports_webrtc,
  supports_hls = excluded.supports_hls,
  supports_watermark = excluded.supports_watermark,
  supports_forced_disconnect = excluded.supports_forced_disconnect,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.camera_compliance_checks (check_key, check_area, title, status, readiness_score, severity, evidence_summary, recommended_action, metadata)
values
  ('parent-viewing-policy-engine', 'parent_access', 'Parent viewing policy engine', 'partial', 78, 'critical', 'parent_camera_policies controls viewing enabled, approved cameras, viewing hours and session limits.', 'Managers must configure and approve policies per kindergarten before parent viewing.', '{}'::jsonb),
  ('parent-mfa-authorization', 'parent_access', 'Parent MFA authorization', 'partial', 62, 'critical', 'Playback token path checks MFA enrollment status for parent viewers.', 'Complete MFA enrollment flow before enabling real parent viewing.', '{}'::jsonb),
  ('child-presence-validation', 'parent_access', 'Child presence validation', 'partial', 70, 'critical', 'Parent viewing requires a linked child with present attendance and no checkout for today.', 'Wire automatic forced disconnect when checkout event is recorded.', '{}'::jsonb),
  ('gateway-only-streaming', 'streaming_gateway', 'Gateway-only streaming', 'partial', 76, 'critical', 'Playback tokens use HLS/WebRTC gateway URLs and block direct RTSP exposure.', 'Deploy production gateway and verify no RTSP or credentials reach the browser.', '{}'::jsonb),
  ('short-lived-viewing-tokens', 'viewing_tokens', 'Short-lived viewing tokens', 'ready', 86, 'high', 'Tokens expire in minutes and are hashed in session records.', 'Keep token duration at or below policy limit.', '{}'::jsonb),
  ('session-termination-controls', 'session_controls', 'Automatic session termination controls', 'partial', 64, 'high', 'Session records support forced_disconnect_at and termination reason.', 'Wire checkout, viewing-hours-end and permission-revoked events to forced disconnect.', '{}'::jsonb),
  ('dynamic-watermark-readiness', 'watermark', 'Dynamic watermark readiness', 'partial', 68, 'high', 'Playback session stores watermark text/hash and UI can display session watermark.', 'Move watermark overlay into native/gateway layer for stronger protection.', '{}'::jsonb),
  ('anti-screenshot-readiness', 'anti_leak', 'Anti-screenshot readiness', 'partial', 52, 'medium', 'Policy tracks FLAG_SECURE/iOS capture detection/web warning requirements.', 'Implement native app capture controls and web warnings.', '{}'::jsonb),
  ('camera-access-audit-trail', 'audit', 'Camera access audit trail', 'ready', 88, 'critical', 'Viewing tokens, sessions and access audit records are tracked.', 'Keep append-only retention and review suspicious access alerts.', '{}'::jsonb),
  ('inspector-camera-access-rules', 'inspector_access', 'Inspector camera access rules', 'partial', 70, 'high', 'Inspector access requires assignment and reason when policy demands it.', 'Add inspection-case linkage to inspector camera sessions.', '{}'::jsonb),
  ('manager-camera-controls', 'manager_controls', 'Manager camera controls', 'partial', 72, 'high', 'Managers can enable/disable visibility and hours subject to policy.', 'Add explicit legal confirmation before activating parent viewing.', '{}'::jsonb)
on conflict (check_key) do update set
  check_area = excluded.check_area,
  title = excluded.title,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

update public.camera_streams
set
  legal_streaming_status = case
    when coalesce(parent_viewing_allowed, parent_view_allowed, false) = true and coalesce(gateway_stream_id, video_gateway_stream_id, hls_playback_url, webrtc_playback_url, sample_hls_url) is not null then 'ready_for_review'
    when coalesce(parent_viewing_allowed, parent_view_allowed, false) = true then 'needs_gateway'
    else 'parent_viewing_disabled'
  end,
  direct_rtsp_exposure_blocked = true,
  parent_mfa_required = true,
  child_presence_required = true,
  watermark_required = true,
  anti_screenshot_required = true,
  anti_recording_notice_required = true
where legal_streaming_status = 'needs_review';

insert into public.security_readiness_checks (category, check_key, title, status, severity, evidence_summary, recommended_action, metadata)
values
  ('privacy', 'legal-parent-camera-viewing', 'Legal parent camera viewing', 'partial', 'critical', 'Camera compliance policy, MFA gate, child presence gate, watermark readiness and audit trail exist.', 'Complete native anti-capture controls and forced disconnect hooks before production.', '{"phase":147}'::jsonb)
on conflict (check_key) do update set
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  severity = excluded.severity,
  evidence_summary = excluded.evidence_summary,
  recommended_action = excluded.recommended_action,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.parent_camera_policies is 'Kindergarten-level legal parent viewing policy: enabled cameras, viewing hours, MFA, child presence and session duration.';
comment on table public.camera_streaming_gateway_compliance is 'Gateway-only streaming compliance registry. No direct camera or RTSP exposure.';
comment on table public.camera_viewing_authorization_checks is 'Per-request authorization evidence for parent camera viewing.';
comment on table public.camera_access_audit_trail is 'Immutable camera access audit trail for tokens, viewing, blocking, forced disconnects and anti-leak warnings.';
comment on table public.camera_security_alerts is 'Camera security alerts for suspicious viewing, excessive access and capture anomalies.';
comment on table public.camera_compliance_checks is 'Camera compliance readiness checks for parent viewing, gateway streaming, watermarking and audit.';
