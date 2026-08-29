-- Persistent Gateway device enrollment. Opaque refresh material is never stored in plaintext.
create table if not exists public.video_gateway_device_enrollments (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  device_name text not null,
  device_platform text not null,
  device_fingerprint text,
  poll_token_hash text not null,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  gateway_id uuid,
  refresh_token_hash text,
  expires_at timestamptz not null,
  approved_at timestamptz,
  delivered_at timestamptz,
  revoked_at timestamptz,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_gateway_device_enrollment_status_check check (status in ('pending','approved','delivered','expired','revoked')),
  constraint video_gateway_device_enrollment_refresh_check check ((status in ('approved','delivered') and observer_site_id is not null and gateway_id is not null and refresh_token_hash is not null) or status not in ('approved','delivered'))
);

create unique index if not exists video_gateway_device_enrollments_gateway_unique_idx
  on public.video_gateway_device_enrollments(gateway_id) where gateway_id is not null and status in ('approved','delivered');
create index if not exists video_gateway_device_enrollments_site_idx
  on public.video_gateway_device_enrollments(observer_site_id, status, created_at desc);
create index if not exists video_gateway_device_enrollments_expiry_idx
  on public.video_gateway_device_enrollments(status, expires_at);

alter table public.video_gateway_device_enrollments enable row level security;
drop policy if exists "gateway device enrollments admin only" on public.video_gateway_device_enrollments;
create policy "gateway device enrollments admin only" on public.video_gateway_device_enrollments
  for all using (public.is_admin()) with check (public.is_admin());

