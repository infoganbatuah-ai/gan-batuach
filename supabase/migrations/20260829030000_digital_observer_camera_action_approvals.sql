-- Evidence-gated camera operations for Digital Observer. Physical commands are
-- never auto-approved: a short-lived, site-scoped confirmation is mandatory.

create table if not exists public.digital_observer_camera_action_requests (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid not null references public.digital_observer_camera_sources(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_by uuid references public.profiles(id) on delete set null,
  action_type text not null,
  request_origin text not null default 'dashboard',
  action_status text not null default 'awaiting_confirmation',
  parameters jsonb not null default '{}'::jsonb,
  capability_evidence jsonb not null,
  idempotency_key text not null unique,
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  confirmed_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_camera_action_type_check check (
    action_type in ('talkback','ptz_pan','ptz_tilt','ptz_zoom','light_on','light_off','siren_on','siren_off','relay_on','relay_off')
  ),
  constraint digital_observer_camera_action_origin_check check (request_origin in ('dashboard','observer_chat')),
  constraint digital_observer_camera_action_status_check check (
    action_status in ('awaiting_confirmation','approved','delivered','succeeded','failed','blocked','expired','cancelled')
  ),
  constraint digital_observer_camera_action_evidence_check check (
    capability_evidence ->> 'supported' = 'true'
    and coalesce(capability_evidence ->> 'method', '') <> ''
    and coalesce(capability_evidence ->> 'tested_at', '') <> ''
  ),
  constraint digital_observer_camera_action_confirmation_check check (
    action_status = 'awaiting_confirmation'
    or action_status in ('blocked','expired','cancelled')
    or (confirmed_by is not null and confirmed_at is not null)
  )
);

create index if not exists digital_observer_camera_action_site_idx
  on public.digital_observer_camera_action_requests(observer_site_id, action_status, created_at desc);
create index if not exists digital_observer_camera_action_delivery_idx
  on public.digital_observer_camera_action_requests(camera_source_id, action_status, expires_at)
  where action_status = 'approved';

alter table public.digital_observer_camera_action_requests enable row level security;

drop policy if exists "digital observer camera actions scoped read" on public.digital_observer_camera_action_requests;
create policy "digital observer camera actions scoped read"
on public.digital_observer_camera_action_requests for select
using (public.can_manage_observer_site(observer_site_id));

drop policy if exists "digital observer camera actions scoped insert" on public.digital_observer_camera_action_requests;
drop policy if exists "digital observer camera actions scoped update" on public.digital_observer_camera_action_requests;

revoke all on table public.digital_observer_camera_action_requests from anon, authenticated;
grant select on table public.digital_observer_camera_action_requests to authenticated;

alter table public.observer_capability_audit_events
  drop constraint if exists observer_capability_audit_type_check;
alter table public.observer_capability_audit_events
  add constraint observer_capability_audit_type_check check (
    event_type in (
      'capability_enabled', 'capability_disabled', 'capability_blocked',
      'legal_review_required', 'override_requested', 'override_approved',
      'override_rejected', 'runtime_guard_blocked', 'consent_recorded',
      'consent_revoked', 'biometric_reference_deleted', 'camera_action_requested',
      'camera_action_confirmed', 'camera_action_cancelled', 'camera_action_result'
    )
  );

comment on table public.digital_observer_camera_action_requests is
  'Short-lived camera action approvals. Insertion requires tested per-source capability evidence; physical execution is handled only by the enrolled local Gateway.';

notify pgrst, 'reload schema';
