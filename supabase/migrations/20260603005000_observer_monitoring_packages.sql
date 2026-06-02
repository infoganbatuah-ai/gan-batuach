do $$ begin
  create type public.observer_site_subscription_status as enum ('trial', 'active', 'pending_payment', 'expired', 'suspended', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.observer_monitoring_mode as enum ('always_on', 'custom_schedule', 'night_only', 'business_hours', 'event_only');
exception when duplicate_object then null;
end $$;

create table if not exists public.observer_monitoring_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  package_key text,
  description text,
  package_type text not null default 'business',
  camera_limit integer,
  monitoring_mode public.observer_monitoring_mode not null default 'event_only',
  monitoring_hours jsonb not null default '{}'::jsonb,
  event_retention_days integer not null default 30,
  recording_retention_days integer not null default 0,
  ai_event_types_enabled jsonb not null default '[]'::jsonb,
  feature_flags jsonb not null default '{}'::jsonb,
  sms_alerts_enabled boolean not null default false,
  whatsapp_alerts_enabled boolean not null default false,
  human_review_required boolean not null default true,
  monthly_price numeric(12,2) not null default 0,
  annual_price numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  active boolean not null default true,
  sort_order integer not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_monitoring_packages_type_check check (package_type in ('home','business','enterprise','custom'))
);

alter table public.observer_monitoring_packages add column if not exists package_key text;
update public.observer_monitoring_packages
set package_key = regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')
where package_key is null or btrim(package_key) = '';

create table if not exists public.observer_site_subscriptions (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  status public.observer_site_subscription_status not null default 'trial',
  trial_start timestamptz,
  trial_end timestamptz,
  renewal_date date,
  suspended_at timestamptz,
  cancellation_reason text,
  override_limits jsonb not null default '{}'::jsonb,
  monitoring_schedule jsonb not null default '{}'::jsonb,
  timezone text not null default 'Asia/Jerusalem',
  active_days jsonb not null default '[]'::jsonb,
  active_hours jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists observer_site_subscriptions_one_current_idx
  on public.observer_site_subscriptions(observer_site_id)
  where status in ('trial', 'active', 'pending_payment', 'suspended');

create table if not exists public.observer_site_usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  period_start date not null,
  period_end date not null,
  active_cameras integer not null default 0,
  ai_events_count integer not null default 0,
  storage_used_mb numeric(12,2) not null default 0,
  monitoring_hours_used numeric(12,2) not null default 0,
  sms_alerts_sent integer not null default 0,
  whatsapp_alerts_sent integer not null default 0,
  playback_sessions integer not null default 0,
  limits_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id, period_start, period_end)
);

create index if not exists observer_monitoring_packages_active_idx on public.observer_monitoring_packages(active, package_type, sort_order);
create unique index if not exists observer_monitoring_packages_package_key_idx on public.observer_monitoring_packages(package_key) where package_key is not null;
create index if not exists observer_site_subscriptions_status_idx on public.observer_site_subscriptions(status, renewal_date);
create index if not exists observer_site_usage_site_period_idx on public.observer_site_usage_snapshots(observer_site_id, period_start desc);

alter table public.observer_sites add column if not exists observer_package_id uuid references public.observer_monitoring_packages(id) on delete set null;
alter table public.observer_sites add column if not exists observer_subscription_status public.observer_site_subscription_status not null default 'trial';
alter table public.observer_sites add column if not exists observer_trial_start timestamptz;
alter table public.observer_sites add column if not exists observer_trial_end timestamptz;
alter table public.observer_sites add column if not exists observer_renewal_date date;
alter table public.observer_sites add column if not exists observer_suspended_at timestamptz;
alter table public.observer_sites add column if not exists observer_cancellation_reason text;
alter table public.observer_sites add column if not exists observer_package_override_limits jsonb not null default '{}'::jsonb;
create index if not exists observer_sites_subscription_status_idx on public.observer_sites(observer_subscription_status, observer_renewal_date);

alter table public.observer_monitoring_packages enable row level security;
alter table public.observer_site_subscriptions enable row level security;
alter table public.observer_site_usage_snapshots enable row level security;

drop policy if exists "observer monitoring packages admin" on public.observer_monitoring_packages;
create policy "observer monitoring packages admin" on public.observer_monitoring_packages
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer site subscriptions admin" on public.observer_site_subscriptions;
create policy "observer site subscriptions admin" on public.observer_site_subscriptions
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer site usage admin" on public.observer_site_usage_snapshots;
create policy "observer site usage admin" on public.observer_site_usage_snapshots
for all using (public.is_admin())
with check (public.is_admin());

insert into public.observer_monitoring_packages (
  name,
  package_key,
  description,
  package_type,
  camera_limit,
  monitoring_mode,
  monitoring_hours,
  event_retention_days,
  recording_retention_days,
  ai_event_types_enabled,
  feature_flags,
  sms_alerts_enabled,
  whatsapp_alerts_enabled,
  monthly_price,
  annual_price,
  sort_order,
  metadata
)
values
  ('Home Basic', 'home_basic', 'Future standalone home monitoring package. Not used for Gan Batuach kindergartens.', 'home', 2, 'event_only', '{"mode":"event_only"}'::jsonb, 14, 0, '["camera_offline","motion_detected","person_detected"]'::jsonb, '{"live_view":true,"ai_shadow_detection":true,"snapshots":true,"recording":false,"advanced_analytics":false,"multi_user_access":false}'::jsonb, false, false, 0, 0, 10, '{"future_only":true}'::jsonb),
  ('Home Plus', 'home_plus', 'Future standalone home monitoring package with broader alerting.', 'home', 6, 'night_only', '{"mode":"night_only","hours":{"start":"22:00","end":"06:00"}}'::jsonb, 30, 7, '["camera_offline","motion_detected","person_detected","restricted_area_occupancy","camera_obstruction_suspected"]'::jsonb, '{"live_view":true,"ai_shadow_detection":true,"safety_event_detection":true,"snapshots":true,"recording":true,"advanced_analytics":false,"multi_user_access":true}'::jsonb, true, true, 0, 0, 20, '{"future_only":true}'::jsonb),
  ('Business Basic', 'business_basic', 'Future standalone package for small businesses, stores and offices.', 'business', 8, 'business_hours', '{"mode":"business_hours","hours":{"start":"08:00","end":"18:00"}}'::jsonb, 30, 7, '["camera_offline","motion_detected","person_detected","restricted_area_occupancy","gate_or_door_open"]'::jsonb, '{"live_view":true,"ai_shadow_detection":true,"safety_event_detection":true,"snapshots":true,"recording":true,"sms_alerts":true,"whatsapp_alerts":true,"advanced_analytics":false,"multi_user_access":true}'::jsonb, true, true, 0, 0, 30, '{"future_only":true}'::jsonb),
  ('Business Pro', 'business_pro', 'Future standalone package for higher monitoring needs.', 'business', 20, 'custom_schedule', '{"mode":"custom_schedule"}'::jsonb, 60, 14, '["camera_offline","motion_detected","person_detected","restricted_area_occupancy","gate_or_door_open","unusual_crowding","camera_tampering"]'::jsonb, '{"live_view":true,"ai_shadow_detection":true,"safety_event_detection":true,"snapshots":true,"recording":true,"sms_alerts":true,"whatsapp_alerts":true,"advanced_analytics":true,"multi_user_access":true}'::jsonb, true, true, 0, 0, 40, '{"future_only":true}'::jsonb),
  ('Enterprise Monitoring', 'enterprise_monitoring', 'Future standalone enterprise monitoring package.', 'enterprise', null, 'always_on', '{"mode":"always_on","hours":"24/7"}'::jsonb, 180, 30, '["camera_offline","motion_detected","person_detected","restricted_area_occupancy","gate_or_door_open","unusual_crowding","camera_tampering","emergency_behavior_indicator"]'::jsonb, '{"live_view":true,"ai_shadow_detection":true,"safety_event_detection":true,"snapshots":true,"recording":true,"sms_alerts":true,"whatsapp_alerts":true,"advanced_analytics":true,"multi_user_access":true,"custom_sla":true}'::jsonb, true, true, 0, 0, 50, '{"future_only":true,"custom_pricing":true}'::jsonb)
on conflict (name) do update set
  package_key = excluded.package_key,
  description = excluded.description,
  package_type = excluded.package_type,
  camera_limit = excluded.camera_limit,
  monitoring_mode = excluded.monitoring_mode,
  monitoring_hours = excluded.monitoring_hours,
  event_retention_days = excluded.event_retention_days,
  recording_retention_days = excluded.recording_retention_days,
  ai_event_types_enabled = excluded.ai_event_types_enabled,
  feature_flags = excluded.feature_flags,
  sms_alerts_enabled = excluded.sms_alerts_enabled,
  whatsapp_alerts_enabled = excluded.whatsapp_alerts_enabled,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

update public.observer_sites
set
  observer_subscription_status = 'active',
  observer_package_override_limits = jsonb_build_object(
    'gan_batuach_observer_included', true,
    'billing_model', 'gan_batuach_fixed_700_ils_month'
  )
where site_type = 'kindergarten'
  and observer_package_id is null
  and coalesce(observer_package_override_limits->>'gan_batuach_observer_included', '') <> 'true';

comment on table public.observer_monitoring_packages is 'Future standalone Digital Observer packages. Not used for Gan Batuach kindergarten subscriptions.';
comment on table public.observer_site_subscriptions is 'Future standalone observer site subscription relationship. Does not gate Gan Batuach kindergarten flows.';
comment on table public.observer_site_usage_snapshots is 'Usage snapshot foundation for standalone Digital Observer package limits and future billing.';

notify pgrst, 'reload schema';
