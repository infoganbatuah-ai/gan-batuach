create table if not exists public.observer_subscriptions (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  status text not null default 'trial',
  billing_cycle text not null default 'monthly',
  starts_at timestamptz not null default now(),
  trial_starts_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start date,
  current_period_end date,
  renewal_date date,
  cancelled_at timestamptz,
  cancellation_reason text,
  suspended_at timestamptz,
  suspension_reason text,
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  payment_method_summary text,
  retry_schedule jsonb not null default '[]'::jsonb,
  reminder_schedule jsonb not null default '[]'::jsonb,
  limits_snapshot jsonb not null default '{}'::jsonb,
  admin_override boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_subscriptions_status_check check (status in ('trial','active','pending_payment','overdue','suspended','cancelled')),
  constraint observer_subscriptions_billing_cycle_check check (billing_cycle in ('monthly','annual','custom'))
);

create table if not exists public.observer_billing_events (
  id uuid primary key default gen_random_uuid(),
  observer_subscription_id uuid references public.observer_subscriptions(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  event_type text not null,
  status text not null default 'queued_mock',
  channel text not null default 'in_app',
  scheduled_for timestamptz,
  sent_at timestamptz,
  provider text not null default 'mock',
  provider_reference text,
  message_preview text,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_billing_events_status_check check (status in ('queued_mock','sent_mock','queued','sent','failed','cancelled')),
  constraint observer_billing_events_channel_check check (channel in ('in_app','email','sms','whatsapp','push'))
);

create table if not exists public.observer_usage_tracking (
  id uuid primary key default gen_random_uuid(),
  observer_subscription_id uuid references public.observer_subscriptions(id) on delete set null,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  period_start date not null,
  period_end date not null,
  active_cameras integer not null default 0,
  ai_events_count integer not null default 0,
  storage_used_mb numeric(12,2) not null default 0,
  monitoring_hours_used numeric(12,2) not null default 0,
  sms_alerts_sent integer not null default 0,
  whatsapp_alerts_sent integer not null default 0,
  push_alerts_sent integer not null default 0,
  email_alerts_sent integer not null default 0,
  playback_sessions integer not null default 0,
  enforcement_mode text not null default 'observe_only',
  limit_checks jsonb not null default '{}'::jsonb,
  exceeded_limits jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id, period_start, period_end),
  constraint observer_usage_tracking_enforcement_check check (enforcement_mode in ('observe_only','warn','enforce'))
);

create index if not exists observer_subscriptions_site_status_idx on public.observer_subscriptions(observer_site_id, status, renewal_date);
create index if not exists observer_subscriptions_status_renewal_idx on public.observer_subscriptions(status, renewal_date);
create index if not exists observer_billing_events_subscription_idx on public.observer_billing_events(observer_subscription_id, event_type, created_at desc);
create index if not exists observer_billing_events_site_status_idx on public.observer_billing_events(observer_site_id, status, scheduled_for);
create index if not exists observer_usage_tracking_site_period_idx on public.observer_usage_tracking(observer_site_id, period_start desc);
create index if not exists observer_usage_tracking_subscription_idx on public.observer_usage_tracking(observer_subscription_id, period_start desc);

alter table public.observer_subscriptions enable row level security;
alter table public.observer_billing_events enable row level security;
alter table public.observer_usage_tracking enable row level security;

drop policy if exists "observer subscriptions admin all" on public.observer_subscriptions;
create policy "observer subscriptions admin all" on public.observer_subscriptions
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer subscriptions owner read" on public.observer_subscriptions;
create policy "observer subscriptions owner read" on public.observer_subscriptions
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_subscriptions.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','billing')
  )
);

drop policy if exists "observer billing events admin all" on public.observer_billing_events;
create policy "observer billing events admin all" on public.observer_billing_events
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer billing events owner read" on public.observer_billing_events;
create policy "observer billing events owner read" on public.observer_billing_events
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_billing_events.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','billing')
  )
);

drop policy if exists "observer usage tracking admin all" on public.observer_usage_tracking;
create policy "observer usage tracking admin all" on public.observer_usage_tracking
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer usage tracking owner read" on public.observer_usage_tracking;
create policy "observer usage tracking owner read" on public.observer_usage_tracking
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_usage_tracking.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','billing')
  )
);

insert into public.observer_subscriptions (
  observer_site_id,
  package_id,
  status,
  billing_cycle,
  starts_at,
  trial_starts_at,
  trial_ends_at,
  renewal_date,
  limits_snapshot,
  metadata
)
select
  s.observer_site_id,
  s.package_id,
  case
    when s.status::text = 'expired' then 'overdue'
    when s.status::text in ('trial','active','pending_payment','suspended','cancelled') then s.status::text
    else 'trial'
  end,
  'monthly',
  coalesce(s.created_at, now()),
  s.trial_start,
  s.trial_end,
  s.renewal_date,
  coalesce(s.override_limits, '{}'::jsonb),
  jsonb_build_object('source', 'observer_site_subscriptions_sync', 'future_standalone_product', true)
from public.observer_site_subscriptions s
join public.observer_sites site on site.id = s.observer_site_id
where site.site_type <> 'kindergarten'
  and not exists (
    select 1
    from public.observer_subscriptions existing
    where existing.observer_site_id = s.observer_site_id
  );

insert into public.observer_billing_events (
  observer_subscription_id,
  observer_site_id,
  package_id,
  event_type,
  status,
  channel,
  scheduled_for,
  message_preview,
  metadata
)
select
  sub.id,
  sub.observer_site_id,
  sub.package_id,
  'renewal_reminder_ready',
  'queued_mock',
  'in_app',
  (sub.renewal_date::timestamptz - interval '7 days'),
  'תזכורת חידוש Digital Observer תהיה מוכנה לשליחה בעתיד.',
  jsonb_build_object('mock_only', true, 'future_channels', array['email','sms','whatsapp','push'])
from public.observer_subscriptions sub
join public.observer_sites site on site.id = sub.observer_site_id
where site.site_type <> 'kindergarten'
  and sub.renewal_date is not null
  and not exists (
    select 1
    from public.observer_billing_events event
    where event.observer_subscription_id = sub.id
      and event.event_type = 'renewal_reminder_ready'
  );

comment on table public.observer_subscriptions is 'Future standalone Digital Observer subscription lifecycle. Does not affect Gan Batuach kindergarten billing.';
comment on table public.observer_billing_events is 'Mock/readiness billing automation events for future standalone Digital Observer customers.';
comment on table public.observer_usage_tracking is 'Standalone Digital Observer usage tracking and package enforcement readiness. Gan Batuach flows remain excluded.';

notify pgrst, 'reload schema';
