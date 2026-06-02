alter table if exists public.communication_preferences
  add column if not exists receive_push boolean not null default true,
  add column if not exists critical_push_allowed boolean not null default true;

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  platform text not null,
  device_token text not null,
  device_id text,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint push_device_tokens_platform_check check (platform in ('web', 'android', 'ios'))
);

create unique index if not exists push_device_tokens_token_idx
  on public.push_device_tokens (device_token);

create index if not exists push_device_tokens_profile_idx
  on public.push_device_tokens (profile_id, is_active, last_seen_at desc);

create table if not exists public.push_notification_logs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  device_token_id uuid references public.push_device_tokens(id) on delete set null,
  platform text not null,
  title text not null,
  body text,
  action_url text,
  status text not null default 'queued_mock',
  provider text not null default 'mock',
  provider_message_id text,
  failure_reason text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint push_notification_logs_platform_check check (platform in ('web', 'android', 'ios')),
  constraint push_notification_logs_status_check check (status in ('queued_mock', 'sent_mock', 'queued', 'sent', 'failed', 'skipped_preferences', 'no_active_device', 'deduped'))
);

create index if not exists push_notification_logs_profile_idx
  on public.push_notification_logs (profile_id, created_at desc);

create index if not exists push_notification_logs_notification_idx
  on public.push_notification_logs (notification_id, created_at desc);

create index if not exists push_notification_logs_status_idx
  on public.push_notification_logs (status, created_at desc);

alter table public.push_device_tokens enable row level security;
alter table public.push_notification_logs enable row level security;

drop policy if exists "push tokens own read" on public.push_device_tokens;
create policy "push tokens own read" on public.push_device_tokens
for select using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "push tokens own insert" on public.push_device_tokens;
create policy "push tokens own insert" on public.push_device_tokens
for insert with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "push tokens own update" on public.push_device_tokens;
create policy "push tokens own update" on public.push_device_tokens
for update using (public.is_admin() or profile_id = auth.uid())
with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "push logs scoped read" on public.push_notification_logs;
create policy "push logs scoped read" on public.push_notification_logs
for select using (public.is_admin() or profile_id = auth.uid());

drop policy if exists "push logs scoped insert" on public.push_notification_logs;
create policy "push logs scoped insert" on public.push_notification_logs
for insert with check (public.is_admin() or profile_id = auth.uid());

drop policy if exists "push logs admin update" on public.push_notification_logs;
create policy "push logs admin update" on public.push_notification_logs
for update using (public.is_admin())
with check (public.is_admin());
