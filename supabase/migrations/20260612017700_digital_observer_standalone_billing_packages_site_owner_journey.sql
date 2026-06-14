-- PHASE 177: Digital Observer standalone billing, packages and site owner journey.
-- Digital Observer billing stays separate from Gan Batuach subscriptions and parent tuition payments.

do $$
begin
  if exists (select 1 from pg_type where typname = 'observer_site_subscription_status') then
    if not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'observer_site_subscription_status'
        and e.enumlabel = 'overdue'
    ) then
      alter type public.observer_site_subscription_status add value 'overdue';
    end if;
  end if;
end $$;

alter table public.observer_site_memberships
  drop constraint if exists observer_site_memberships_role_check;

alter table public.observer_site_memberships
  add constraint observer_site_memberships_role_check check (member_role in ('owner','admin','operator','viewer','billing','reviewer'));

alter table public.observer_site_onboarding_drafts
  drop constraint if exists observer_site_onboarding_site_type_check;

alter table public.observer_site_onboarding_drafts
  add constraint observer_site_onboarding_site_type_check check (site_type in (
    'home',
    'office',
    'business',
    'warehouse',
    'store',
    'parking_lot',
    'custom',
    'school_future',
    'municipality_future',
    'construction_site_future',
    'clinic_future',
    'factory_future'
  ));

alter table public.observer_sites
  drop constraint if exists observer_sites_type_check;

alter table public.observer_sites
  add constraint observer_sites_type_check check (site_type in (
    'kindergarten',
    'home',
    'office',
    'business',
    'warehouse',
    'store',
    'parking_lot',
    'school_future',
    'municipality_future',
    'construction_site_future',
    'clinic_future',
    'factory_future',
    'custom'
  ));

alter table public.observer_monitoring_packages
  add column if not exists live_view_enabled boolean not null default true,
  add column if not exists alert_channels jsonb not null default '["in_app"]'::jsonb,
  add column if not exists multi_user_access boolean not null default false,
  add column if not exists advanced_analytics boolean not null default false,
  add column if not exists recording_retention_readiness boolean not null default false,
  add column if not exists package_feature_matrix jsonb not null default '{}'::jsonb,
  add column if not exists payment_provider_mode text not null default 'readiness_only';

alter table public.observer_site_subscriptions
  add column if not exists subscription_status text,
  add column if not exists billing_cycle text not null default 'monthly',
  add column if not exists monthly_price numeric(12,2) not null default 0,
  add column if not exists annual_price numeric(12,2) not null default 0,
  add column if not exists cancelled_at timestamptz,
  add column if not exists grace_period_ends_at timestamptz,
  add column if not exists trial_reminders jsonb not null default '[]'::jsonb,
  add column if not exists billing_separation_key text not null default 'digital_observer',
  add column if not exists payment_provider text not null default 'mock',
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists package_limits_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists pending_package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  add column if not exists pending_change_effective_at date;

update public.observer_site_subscriptions
set subscription_status = status::text
where subscription_status is null;

alter table public.observer_site_subscriptions
  drop constraint if exists observer_site_subscriptions_status_text_check;

alter table public.observer_site_subscriptions
  add constraint observer_site_subscriptions_status_text_check check (subscription_status in ('trial','active','pending_payment','overdue','expired','suspended','cancelled'));

alter table public.observer_site_subscriptions
  drop constraint if exists observer_site_subscriptions_billing_cycle_check;

alter table public.observer_site_subscriptions
  add constraint observer_site_subscriptions_billing_cycle_check check (billing_cycle in ('monthly','annual','custom'));

alter table public.observer_usage_tracking
  add column if not exists alerts_sent integer not null default 0,
  add column if not exists users_invited integer not null default 0,
  add column if not exists failed_camera_checks integer not null default 0,
  add column if not exists live_view_sessions integer not null default 0,
  add column if not exists package_limit_status text not null default 'observe_only',
  add column if not exists billing_separation_key text not null default 'digital_observer';

alter table public.observer_site_usage_snapshots
  add column if not exists alerts_sent integer not null default 0,
  add column if not exists users_invited integer not null default 0,
  add column if not exists failed_camera_checks integer not null default 0,
  add column if not exists live_view_sessions integer not null default 0,
  add column if not exists billing_separation_key text not null default 'digital_observer';

create or replace view public.observer_packages as
select
  id,
  name,
  package_key,
  description,
  package_type,
  camera_limit,
  monitoring_mode,
  monitoring_hours,
  event_retention_days,
  recording_retention_days,
  recording_retention_readiness,
  ai_event_types_enabled,
  live_view_enabled,
  alert_channels,
  multi_user_access,
  advanced_analytics,
  human_review_required,
  monthly_price,
  annual_price,
  currency,
  active,
  sort_order,
  package_feature_matrix,
  metadata,
  created_at,
  updated_at
from public.observer_monitoring_packages;

create table if not exists public.observer_package_limit_checks (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  check_type text not null check (check_type in ('camera_limit','subscription_active','recording_allowed','advanced_analytics_allowed','alert_channel_allowed','monitoring_schedule_allowed')),
  status text not null default 'observe_only' check (status in ('observe_only','allowed','warning','blocked')),
  current_value numeric(12,2),
  limit_value numeric(12,2),
  recommended_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.observer_monitoring_schedules (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  schedule_mode text not null default 'event_only' check (schedule_mode in ('24_7','night_only','business_hours','custom_schedule','event_only')),
  timezone text not null default 'Asia/Jerusalem',
  active_days jsonb not null default '[]'::jsonb,
  active_hours jsonb not null default '{}'::jsonb,
  schedule jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','active','paused','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(observer_site_id)
);

create table if not exists public.observer_alert_channel_settings (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  member_profile_id uuid references public.profiles(id) on delete set null,
  recipient_name text,
  channel text not null check (channel in ('in_app','email','sms','whatsapp','push')),
  severity_levels jsonb not null default '["high","critical"]'::jsonb,
  enabled boolean not null default true,
  package_allowed boolean not null default true,
  provider_mode text not null default 'mock',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observer_payment_provider_readiness (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  provider_name text not null,
  status text not null default 'not_configured' check (status in ('not_configured','sandbox_ready','configured','live_ready','disabled')),
  mode text not null default 'sandbox' check (mode in ('disabled','sandbox','live')),
  raw_card_storage_allowed boolean not null default false,
  supported_flows jsonb not null default '[]'::jsonb,
  missing_configuration jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observer_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  site_owner_profile_id uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  billing_cycle text not null default 'monthly',
  status text not null default 'draft' check (status in ('draft','issued','paid','overdue','cancelled','void')),
  pdf_ready boolean not null default false,
  invoice_provider text not null default 'mock',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observer_subscription_change_requests (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  subscription_id uuid references public.observer_site_subscriptions(id) on delete set null,
  current_package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  requested_package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  change_type text not null check (change_type in ('upgrade','downgrade','cancel','resume','suspend')),
  status text not null default 'requested' check (status in ('requested','approved','scheduled','applied','rejected','cancelled')),
  prorated_billing_ready boolean not null default false,
  effective_at date,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observer_commercial_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  area text not null,
  status text not null default 'ready_for_review' check (status in ('ready','ready_for_review','partial','blocked','future_only')),
  title text not null,
  notes text,
  gan_batuach_impact text not null default 'none',
  billing_stream text not null default 'digital_observer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.observer_product_analytics (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in ('onboarding_started','site_created','package_selected','trial_started','camera_added','first_alert_created','billing_started','trial_converted','churn_risk')),
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  count_value integer not null default 0,
  status text not null default 'tracking' check (status in ('tracking','healthy','needs_attention','blocked')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.observer_package_limit_checks enable row level security;
alter table public.observer_monitoring_schedules enable row level security;
alter table public.observer_alert_channel_settings enable row level security;
alter table public.observer_payment_provider_readiness enable row level security;
alter table public.observer_invoices enable row level security;
alter table public.observer_subscription_change_requests enable row level security;
alter table public.observer_commercial_readiness enable row level security;
alter table public.observer_product_analytics enable row level security;

drop policy if exists "observer package limit checks admin all" on public.observer_package_limit_checks;
create policy "observer package limit checks admin all" on public.observer_package_limit_checks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer package limit checks member read" on public.observer_package_limit_checks;
create policy "observer package limit checks member read" on public.observer_package_limit_checks for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_package_limit_checks.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','billing')
  )
);

drop policy if exists "observer monitoring schedules admin all" on public.observer_monitoring_schedules;
create policy "observer monitoring schedules admin all" on public.observer_monitoring_schedules for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer monitoring schedules member read" on public.observer_monitoring_schedules;
create policy "observer monitoring schedules member read" on public.observer_monitoring_schedules for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_monitoring_schedules.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
  )
);

drop policy if exists "observer alert channel settings admin all" on public.observer_alert_channel_settings;
create policy "observer alert channel settings admin all" on public.observer_alert_channel_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer alert channel settings member read" on public.observer_alert_channel_settings;
create policy "observer alert channel settings member read" on public.observer_alert_channel_settings for select using (
  public.is_admin()
  or member_profile_id = auth.uid()
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_alert_channel_settings.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin')
  )
);

drop policy if exists "observer payment provider readiness admin all" on public.observer_payment_provider_readiness;
create policy "observer payment provider readiness admin all" on public.observer_payment_provider_readiness for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer invoices admin all" on public.observer_invoices;
create policy "observer invoices admin all" on public.observer_invoices for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer invoices billing read" on public.observer_invoices;
create policy "observer invoices billing read" on public.observer_invoices for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_invoices.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','billing')
  )
);

drop policy if exists "observer subscription changes admin all" on public.observer_subscription_change_requests;
create policy "observer subscription changes admin all" on public.observer_subscription_change_requests for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer subscription changes member read" on public.observer_subscription_change_requests;
create policy "observer subscription changes member read" on public.observer_subscription_change_requests for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_subscription_change_requests.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','billing')
  )
);

drop policy if exists "observer commercial readiness admin all" on public.observer_commercial_readiness;
create policy "observer commercial readiness admin all" on public.observer_commercial_readiness for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "observer product analytics admin all" on public.observer_product_analytics;
create policy "observer product analytics admin all" on public.observer_product_analytics for all using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_observer_package_limit_checks_site on public.observer_package_limit_checks(observer_site_id, check_type, status);
create index if not exists idx_observer_monitoring_schedules_site on public.observer_monitoring_schedules(observer_site_id, status);
create index if not exists idx_observer_alert_channel_settings_site on public.observer_alert_channel_settings(observer_site_id, channel, enabled);
create index if not exists idx_observer_invoices_site_status on public.observer_invoices(observer_site_id, status, due_at);
create index if not exists idx_observer_subscription_changes_site on public.observer_subscription_change_requests(observer_site_id, status, created_at desc);
create index if not exists idx_observer_product_analytics_type on public.observer_product_analytics(event_type, occurred_at desc);

insert into public.observer_monitoring_packages (
  name, package_key, description, package_type, camera_limit, monitoring_mode, monitoring_hours, event_retention_days, recording_retention_days, recording_retention_readiness, ai_event_types_enabled, feature_flags, alert_channels, sms_alerts_enabled, whatsapp_alerts_enabled, live_view_enabled, multi_user_access, advanced_analytics, human_review_required, monthly_price, annual_price, sort_order, package_feature_matrix, metadata
) values
  ('Home Basic', 'home_basic', 'Small home monitoring package with event-only mode and basic alerts.', 'home', 2, 'event_only', '{"mode":"event_only"}'::jsonb, 14, 0, false, '["camera_offline","motion_after_hours"]'::jsonb, '{"recording":false,"advanced_analytics":false,"multi_user_access":false}'::jsonb, '["in_app"]'::jsonb, false, false, true, false, false, true, 99, 990, 10, '{"camera_limit":2,"monitoring_hours":"event_only","event_retention_days":14,"recording_retention_readiness":false,"live_view_enabled":true,"alert_channels":["in_app"],"multi_user_access":false,"advanced_analytics":false,"human_review_required":true}'::jsonb, '{"billing_stream":"digital_observer","not_gan_batuach":true}'::jsonb),
  ('Home Plus', 'home_plus', 'Home monitoring with more cameras, longer retention and SMS/WhatsApp readiness.', 'home', 6, 'night_only', '{"mode":"night_only","hours":{"start":"22:00","end":"06:00"}}'::jsonb, 30, 7, true, '["camera_offline","motion_after_hours","person_detected","restricted_area","camera_obstruction"]'::jsonb, '{"recording":true,"advanced_analytics":false,"multi_user_access":true}'::jsonb, '["in_app","sms","whatsapp","push"]'::jsonb, true, true, true, true, false, true, 179, 1790, 20, '{"camera_limit":6,"monitoring_hours":"night_only","event_retention_days":30,"recording_retention_readiness":true,"live_view_enabled":true,"alert_channels":["in_app","sms","whatsapp","push"],"multi_user_access":true,"advanced_analytics":false,"human_review_required":true}'::jsonb, '{"billing_stream":"digital_observer","not_gan_batuach":true}'::jsonb),
  ('Business Basic', 'business_basic', 'Business monitoring with health checks, business hours and event review.', 'business', 8, 'business_hours', '{"mode":"business_hours","hours":{"start":"08:00","end":"18:00"}}'::jsonb, 30, 7, true, '["camera_offline","motion_after_hours","person_detected","restricted_area","business_hours_monitoring"]'::jsonb, '{"recording":true,"advanced_analytics":false,"multi_user_access":true,"health_monitoring":true}'::jsonb, '["in_app","email","sms","whatsapp","push"]'::jsonb, true, true, true, true, false, true, 299, 2990, 30, '{"camera_limit":8,"monitoring_hours":"business_hours","event_retention_days":30,"recording_retention_readiness":true,"live_view_enabled":true,"alert_channels":["in_app","email","sms","whatsapp","push"],"multi_user_access":true,"advanced_analytics":false,"human_review_required":true}'::jsonb, '{"billing_stream":"digital_observer","not_gan_batuach":true}'::jsonb),
  ('Business Pro', 'business_pro', 'Higher-capacity business monitoring with advanced analytics readiness and priority alerts.', 'business', 20, 'custom_schedule', '{"mode":"custom_schedule"}'::jsonb, 60, 14, true, '["camera_offline","motion_after_hours","person_detected","restricted_area","crowding","camera_obstruction","unusual_motion","night_monitoring"]'::jsonb, '{"recording":true,"advanced_analytics":true,"multi_user_access":true,"priority_alerts":true}'::jsonb, '["in_app","email","sms","whatsapp","push"]'::jsonb, true, true, true, true, true, true, 599, 5990, 40, '{"camera_limit":20,"monitoring_hours":"custom_schedule","event_retention_days":60,"recording_retention_readiness":true,"live_view_enabled":true,"alert_channels":["in_app","email","sms","whatsapp","push"],"multi_user_access":true,"advanced_analytics":true,"human_review_required":true}'::jsonb, '{"billing_stream":"digital_observer","not_gan_batuach":true}'::jsonb),
  ('Enterprise Monitoring', 'enterprise_monitoring', 'Custom monitoring package with SLA readiness and custom pricing.', 'enterprise', null, 'always_on', '{"mode":"always_on","hours":"24/7"}'::jsonb, 180, 30, true, '["camera_offline","motion_after_hours","person_detected","restricted_area","crowding","camera_obstruction","unusual_motion","business_hours_monitoring","night_monitoring"]'::jsonb, '{"recording":true,"advanced_analytics":true,"multi_user_access":true,"custom_sla":true,"custom_pricing":true}'::jsonb, '["in_app","email","sms","whatsapp","push"]'::jsonb, true, true, true, true, true, true, 0, 0, 50, '{"camera_limit":"custom","monitoring_hours":"custom","event_retention_days":"custom","recording_retention_readiness":true,"live_view_enabled":true,"alert_channels":["in_app","email","sms","whatsapp","push"],"multi_user_access":true,"advanced_analytics":true,"human_review_required":true}'::jsonb, '{"billing_stream":"digital_observer","not_gan_batuach":true,"custom_pricing":true}'::jsonb)
on conflict (name) do update set
  package_key = excluded.package_key,
  description = excluded.description,
  camera_limit = excluded.camera_limit,
  monitoring_mode = excluded.monitoring_mode,
  event_retention_days = excluded.event_retention_days,
  recording_retention_days = excluded.recording_retention_days,
  recording_retention_readiness = excluded.recording_retention_readiness,
  ai_event_types_enabled = excluded.ai_event_types_enabled,
  feature_flags = excluded.feature_flags,
  alert_channels = excluded.alert_channels,
  sms_alerts_enabled = excluded.sms_alerts_enabled,
  whatsapp_alerts_enabled = excluded.whatsapp_alerts_enabled,
  live_view_enabled = excluded.live_view_enabled,
  multi_user_access = excluded.multi_user_access,
  advanced_analytics = excluded.advanced_analytics,
  human_review_required = excluded.human_review_required,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  package_feature_matrix = excluded.package_feature_matrix,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.observer_payment_provider_readiness (provider_key, provider_name, status, mode, raw_card_storage_allowed, supported_flows, missing_configuration, notes)
values
  ('stripe','Stripe','not_configured','sandbox',false,'["trial","subscription","invoice","webhook"]'::jsonb,'["STRIPE_SECRET_KEY","STRIPE_WEBHOOK_SECRET"]'::jsonb,'Future provider option. No live charge in this phase.'),
  ('cardcom','Cardcom','not_configured','sandbox',false,'["subscription","invoice","webhook"]'::jsonb,'["CARDCOM_TERMINAL"]'::jsonb,'Israeli provider readiness.'),
  ('tranzila','Tranzila','not_configured','sandbox',false,'["subscription","invoice","webhook"]'::jsonb,'["TRANZILA_TERMINAL"]'::jsonb,'Israeli provider readiness.'),
  ('meshulam','Meshulam','not_configured','sandbox',false,'["subscription","invoice","webhook"]'::jsonb,'["MESHULAM_API_KEY"]'::jsonb,'Israeli provider readiness.'),
  ('pelecard','Pelecard','not_configured','sandbox',false,'["subscription","invoice","webhook"]'::jsonb,'["PELECARD_TERMINAL"]'::jsonb,'Israeli provider readiness.')
on conflict (provider_key) do update set
  supported_flows = excluded.supported_flows,
  missing_configuration = excluded.missing_configuration,
  updated_at = now();

insert into public.observer_commercial_readiness (readiness_key, area, status, title, notes, gan_batuach_impact, billing_stream)
values
  ('billing-separation','billing_separation','ready','Digital Observer billing separated from Gan Batuach and parent tuition','Digital Observer customer pays Digital Observer product account. Kindergarten subscription and parent tuition remain separate streams.','none','digital_observer'),
  ('site-owner-journey','site_owner_journey','ready','Nine-step site owner journey prepared','Account, site type, package, site details, cameras, goals, alert channels, privacy/security and trial/subscription.','none','digital_observer'),
  ('package-limit-readiness','package_limits','ready_for_review','Package limit enforcement readiness','Camera limits, subscription status, recording, analytics and alert channels are modeled but not force-enforced for Gan Batuach.','none','digital_observer'),
  ('payment-provider-readiness','payment_provider','ready_for_review','Payment provider abstraction ready','Stripe, Cardcom, Tranzila, Meshulam and Pelecard are documented as provider-ready. No raw card data.','none','digital_observer'),
  ('cancellation-suspension','cancellation_suspension','ready_for_review','Cancellation and suspension readiness','Suspended sites should disable monitoring while preserving billing/support and retention-governed history.','none','digital_observer')
on conflict (readiness_key) do update set
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.observer_product_analytics (event_key, event_type, count_value, status, metadata)
values
  ('observer-analytics-onboarding-started','onboarding_started',0,'tracking','{"route":"/digital-observer/onboarding"}'::jsonb),
  ('observer-analytics-site-created','site_created',0,'tracking','{"source":"site_owner_journey"}'::jsonb),
  ('observer-analytics-package-selected','package_selected',0,'tracking','{"packages":["home_basic","home_plus","business_basic","business_pro","enterprise_monitoring"]}'::jsonb),
  ('observer-analytics-trial-started','trial_started',0,'tracking','{"production_monitoring":"not_unrestricted"}'::jsonb),
  ('observer-analytics-camera-added','camera_added',0,'tracking','{"gateway_required":true}'::jsonb),
  ('observer-analytics-first-alert','first_alert_created',0,'tracking','{"human_review_required":true}'::jsonb),
  ('observer-analytics-billing-started','billing_started',0,'tracking','{"provider_mode":"disabled_or_sandbox"}'::jsonb),
  ('observer-analytics-trial-converted','trial_converted',0,'tracking','{"conversion":"future"}'::jsonb),
  ('observer-analytics-churn-risk','churn_risk',0,'tracking','{"signals":["expired_trial","overdue_payment","low_usage"]}'::jsonb)
on conflict (event_key) do update set
  metadata = excluded.metadata,
  occurred_at = now();

comment on view public.observer_packages is 'Alias view for observer_monitoring_packages, aligned to the Phase 177 observer_packages naming requirement.';
comment on table public.observer_package_limit_checks is 'Digital Observer standalone package limit readiness. Applies to observer_site_id, not Gan Batuach garden billing.';
comment on table public.observer_invoices is 'Digital Observer invoices only. Separate from Gan Batuach kindergarten invoices and parent tuition receipts.';

notify pgrst, 'reload schema';
