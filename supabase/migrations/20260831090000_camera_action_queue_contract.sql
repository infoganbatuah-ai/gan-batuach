-- Cloud-to-enrolled-Gateway queue. Secrets and camera credentials never enter
-- this table; the local Gateway receives only short-lived scoped work.
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
  constraint digital_observer_camera_action_confirmation_check check (
    action_status = 'awaiting_confirmation' or action_status in ('blocked','expired','cancelled')
    or (confirmed_by is not null and confirmed_at is not null)
  )
);
create index if not exists digital_observer_camera_action_queue_idx
  on public.digital_observer_camera_action_requests(observer_site_id, action_status, created_at);
create index if not exists digital_observer_camera_action_delivery_idx
  on public.digital_observer_camera_action_requests(camera_source_id, action_status, expires_at);
alter table public.digital_observer_camera_action_requests enable row level security;
alter table public.digital_observer_camera_action_requests
  drop constraint if exists digital_observer_camera_action_status_check;
alter table public.digital_observer_camera_action_requests
  add constraint digital_observer_camera_action_status_check check (
    action_status in ('awaiting_confirmation','approved','delivered','succeeded','failed','completed','blocked','expired','cancelled')
  );
revoke all on table public.digital_observer_camera_action_requests from anon, authenticated;
grant select on table public.digital_observer_camera_action_requests to authenticated;
