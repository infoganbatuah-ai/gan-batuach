-- Standalone Digital Observer runtime model.
-- No live provider, payment, camera or AI capability is activated by this migration.

alter table public.observer_monitoring_packages
  add column if not exists recording_retention_hours integer not null default 0,
  add column if not exists site_limit integer,
  add column if not exists user_limit integer,
  add column if not exists sms_quota integer not null default 0,
  add column if not exists voice_call_quota integer not null default 0,
  add column if not exists support_tier text not null default 'standard',
  add column if not exists add_ons jsonb not null default '[]'::jsonb,
  add column if not exists trial_days integer not null default 14,
  add column if not exists annual_discount_percent numeric(5,2) not null default 0;

alter table public.observer_monitoring_packages
  drop constraint if exists observer_monitoring_packages_commercial_limits_check;

alter table public.observer_monitoring_packages
  add constraint observer_monitoring_packages_commercial_limits_check check (
    coalesce(site_limit, 0) >= 0
    and coalesce(user_limit, 0) >= 0
    and sms_quota >= 0
    and voice_call_quota >= 0
    and trial_days between 0 and 90
    and annual_discount_percent between 0 and 100
  );

update public.observer_monitoring_packages
set
  monthly_price = case package_key
    when 'home_basic' then 49
    when 'home_plus' then 89
    when 'home_premium' then 149
    when 'business_basic' then 249
    when 'business_pro' then 549
    else monthly_price
  end,
  annual_price = case package_key
    when 'home_basic' then 499
    when 'home_plus' then 899
    when 'home_premium' then 1490
    when 'business_basic' then 2490
    when 'business_pro' then 5490
    else annual_price
  end,
  recording_retention_hours = case package_key
    when 'home_basic' then 24
    when 'home_plus' then 48
    when 'home_premium' then 48
    when 'business_basic' then 24
    when 'business_pro' then 48
    when 'enterprise_monitoring' then 48
    else least(coalesce(recording_retention_hours, 0), 48)
  end,
  recording_retention_days = case
    when package_key in ('home_basic','business_basic') then 1
    when package_key in ('home_plus','home_premium','business_pro','enterprise_monitoring') then 2
    else least(coalesce(recording_retention_days, 0), 2)
  end,
  payment_provider_mode = 'readiness_only',
  updated_at = now();

insert into public.observer_monitoring_packages (
  name, package_key, description, package_type, camera_limit, site_limit, user_limit,
  monitoring_mode, event_retention_days, recording_retention_days, recording_retention_hours,
  ai_event_types_enabled, feature_flags, alert_channels, multi_user_access, advanced_analytics,
  human_review_required, sms_quota, voice_call_quota, support_tier, add_ons, trial_days,
  monthly_price, annual_price, annual_discount_percent, currency, payment_provider_mode,
  active, sort_order, package_feature_matrix, metadata
)
values
  ('ביתי בסיסי', 'home_basic', 'ניטור ביתי פשוט עד שתי מצלמות.', 'home', 2, 1, 2, 'event_only', 30, 1, 24,
   '["motion_detected","person_detected","animal_detected"]'::jsonb,
   '{"live_view":false,"recording":true,"known_people":false}'::jsonb,
   '["in_app","push"]'::jsonb, false, false, true, 0, 0, 'standard', '[]'::jsonb, 14,
   49, 499, 15, 'ILS', 'readiness_only', true, 10,
   '{"camera_limit":2,"retention_hours":24}'::jsonb, '{"product":"digital_observer"}'::jsonb),
  ('ביתי מתקדם', 'home_plus', 'ניטור ביתי מתקדם עד חמש מצלמות.', 'home', 5, 1, 5, 'night_only', 30, 2, 48,
   '["motion_detected","person_detected","animal_detected","unknown_person","camera_obstruction"]'::jsonb,
   '{"live_view":false,"recording":true,"known_people":true}'::jsonb,
   '["in_app","push","email","sms"]'::jsonb, true, false, true, 10, 0, 'standard', '["extra_camera","sms_pack"]'::jsonb, 14,
   89, 899, 16, 'ILS', 'readiness_only', true, 20,
   '{"camera_limit":5,"retention_hours":48}'::jsonb, '{"product":"digital_observer"}'::jsonb),
  ('ביתי Premium', 'home_premium', 'ניטור ביתי מלא עד עשר מצלמות.', 'home', 10, 1, 10, 'custom_schedule', 30, 2, 48,
   '["motion_detected","person_detected","animal_detected","unknown_person","entry_exit","restricted_area","camera_obstruction"]'::jsonb,
   '{"live_view":false,"recording":true,"known_people":true,"escalation":true}'::jsonb,
   '["in_app","push","email","sms","voice"]'::jsonb, true, true, true, 30, 5, 'priority', '["extra_camera","sms_pack","voice_pack"]'::jsonb, 14,
   149, 1490, 17, 'ILS', 'readiness_only', true, 30,
   '{"camera_limit":10,"retention_hours":48}'::jsonb, '{"product":"digital_observer"}'::jsonb),
  ('עסקי Start', 'business_basic', 'ניטור עסקי לאתר אחד ועד חמש מצלמות.', 'business', 5, 1, 5, 'business_hours', 30, 1, 24,
   '["camera_offline","after_hours_activity","restricted_area_entry"]'::jsonb,
   '{"live_view":false,"recording":true,"reports":true}'::jsonb,
   '["in_app","push","email"]'::jsonb, true, false, true, 10, 0, 'business', '["extra_camera","extra_user"]'::jsonb, 14,
   249, 2490, 17, 'ILS', 'readiness_only', true, 40,
   '{"camera_limit":5,"site_limit":1,"retention_hours":24}'::jsonb, '{"product":"digital_observer"}'::jsonb),
  ('עסקי Pro', 'business_pro', 'ניטור עסקי מתקדם עד חמש עשרה מצלמות.', 'business', 15, 3, 20, 'custom_schedule', 30, 2, 48,
   '["camera_offline","after_hours_activity","restricted_area_entry","crowding","camera_obstruction"]'::jsonb,
   '{"live_view":false,"recording":true,"reports":true,"advanced_zones":true}'::jsonb,
   '["in_app","push","email","sms","voice"]'::jsonb, true, true, true, 50, 10, 'priority', '["extra_camera","extra_site","extra_user","sms_pack","voice_pack"]'::jsonb, 14,
   549, 5490, 17, 'ILS', 'readiness_only', true, 50,
   '{"camera_limit":15,"site_limit":3,"retention_hours":48}'::jsonb, '{"product":"digital_observer"}'::jsonb),
  ('עסקי Multi-Site', 'enterprise_monitoring', 'חבילה ארגונית מותאמת למספר אתרים.', 'enterprise', null, null, null, 'always_on', 30, 2, 48,
   '[]'::jsonb, '{"live_view":false,"recording":true,"reports":true,"api":true}'::jsonb,
   '["in_app","push","email","sms","voice"]'::jsonb, true, true, true, 0, 0, 'managed',
   '["extra_camera","extra_site","extra_user","sms_pack","voice_pack","storage"]'::jsonb, 14,
   0, 0, 0, 'ILS', 'readiness_only', true, 60,
   '{"custom_limits":true,"retention_hours":48}'::jsonb, '{"product":"digital_observer","custom_pricing":true}'::jsonb)
on conflict (package_key) where package_key is not null do update set
  name = excluded.name,
  description = excluded.description,
  package_type = excluded.package_type,
  camera_limit = excluded.camera_limit,
  site_limit = excluded.site_limit,
  user_limit = excluded.user_limit,
  monitoring_mode = excluded.monitoring_mode,
  recording_retention_days = excluded.recording_retention_days,
  recording_retention_hours = excluded.recording_retention_hours,
  ai_event_types_enabled = excluded.ai_event_types_enabled,
  feature_flags = excluded.feature_flags,
  alert_channels = excluded.alert_channels,
  multi_user_access = excluded.multi_user_access,
  advanced_analytics = excluded.advanced_analytics,
  human_review_required = excluded.human_review_required,
  sms_quota = excluded.sms_quota,
  voice_call_quota = excluded.voice_call_quota,
  support_tier = excluded.support_tier,
  add_ons = excluded.add_ons,
  trial_days = excluded.trial_days,
  monthly_price = excluded.monthly_price,
  annual_price = excluded.annual_price,
  annual_discount_percent = excluded.annual_discount_percent,
  payment_provider_mode = 'readiness_only',
  active = true,
  sort_order = excluded.sort_order,
  package_feature_matrix = excluded.package_feature_matrix,
  metadata = coalesce(public.observer_monitoring_packages.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

alter table public.observer_monitoring_packages
  drop constraint if exists observer_monitoring_packages_recording_hours_check;

alter table public.observer_monitoring_packages
  add constraint observer_monitoring_packages_recording_hours_check
  check (recording_retention_hours between 0 and 48);

alter table public.observer_site_subscriptions
  add column if not exists entitlement_status text not null default 'readiness',
  add column if not exists purchase_channel text not null default 'mock',
  add column if not exists app_store_transaction_reference text;

alter table public.observer_site_subscriptions
  drop constraint if exists observer_site_subscriptions_purchase_channel_check;

alter table public.observer_site_subscriptions
  add constraint observer_site_subscriptions_purchase_channel_check
  check (purchase_channel in ('mock','web','apple_app_store','google_play','manual'));

create table if not exists public.digital_observer_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  organization_type text not null default 'business',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_organizations_type_check check (organization_type in ('business','family','enterprise','custom'))
);

alter table public.observer_sites
  add column if not exists digital_observer_organization_id uuid references public.digital_observer_organizations(id) on delete set null;

create table if not exists public.digital_observer_camera_sources (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_stream_id uuid references public.camera_streams(id) on delete set null,
  display_name text not null,
  location_label text,
  connector_type text not null default 'demo',
  connector_provider text not null default 'generic',
  source_mode text not null default 'readiness',
  status text not null default 'draft',
  health_status text not null default 'unknown',
  stream_protocol text,
  gateway_provider text,
  secret_reference text,
  preview_scene text,
  capabilities jsonb not null default '{}'::jsonb,
  monitoring_targets jsonb not null default '[]'::jsonb,
  last_health_check_at timestamptz,
  last_seen_at timestamptz,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_camera_connector_check check (connector_type in ('ip_camera','nvr','dvr','rtsp','onvif','cloud_provider','edge_gateway','demo')),
  constraint digital_observer_camera_mode_check check (source_mode in ('readiness','demo','sandbox','gateway_test','live')),
  constraint digital_observer_camera_status_check check (status in ('draft','ready_to_test','testing','connected','degraded','offline','blocked','disabled')),
  constraint digital_observer_camera_health_check check (health_status in ('unknown','healthy','degraded','offline','failed')),
  constraint digital_observer_camera_live_guard check (source_mode <> 'live' or secret_reference is not null)
);

create table if not exists public.digital_observer_known_people (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  display_name text not null,
  relationship_label text,
  consent_status text not null default 'draft',
  recognition_status text not null default 'disabled',
  image_storage_path text,
  biometric_reference text,
  camera_scope jsonb not null default '[]'::jsonb,
  notify_on_detection boolean not null default false,
  confidence_threshold numeric(5,4),
  last_confirmed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_known_people_consent_check check (consent_status in ('draft','pending','approved','revoked')),
  constraint digital_observer_known_people_status_check check (recognition_status in ('disabled','readiness','shadow','active','blocked')),
  constraint digital_observer_known_people_consent_guard check (recognition_status not in ('shadow','active') or consent_status = 'approved')
);

create table if not exists public.digital_observer_event_clips (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null,
  signal_id uuid references public.observer_intelligence_signals(id) on delete set null,
  title text not null,
  clip_status text not null default 'readiness',
  storage_bucket text,
  storage_path text,
  snapshot_storage_path text,
  captured_at timestamptz,
  duration_seconds integer,
  retention_hours integer not null default 24,
  delete_after timestamptz,
  downloadable boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_event_clips_status_check check (clip_status in ('readiness','processing','available','expired','failed','deleted')),
  constraint digital_observer_event_clips_retention_check check (retention_hours in (1, 6, 24, 48)),
  constraint digital_observer_event_clips_storage_guard check (clip_status <> 'available' or (storage_bucket is not null and storage_path is not null))
);

create table if not exists public.digital_observer_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  signal_id uuid references public.observer_intelligence_signals(id) on delete set null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  channel text not null,
  severity text not null default 'info',
  provider_mode text not null default 'mock',
  delivery_status text not null default 'queued',
  attempt_count integer not null default 0,
  provider_message_id text,
  sent_at timestamptz,
  acknowledged_at timestamptz,
  failure_reason text,
  dedupe_key text,
  max_attempts integer not null default 3,
  next_retry_at timestamptz,
  escalation_level integer not null default 0,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_delivery_channel_check check (channel in ('in_app','push','email','sms','whatsapp','voice')),
  constraint digital_observer_delivery_mode_check check (provider_mode in ('disabled','mock','sandbox','live')),
  constraint digital_observer_delivery_status_check check (delivery_status in ('queued','mocked','sent','delivered','acknowledged','failed','cancelled')),
  constraint digital_observer_delivery_retry_check check (max_attempts between 1 and 10 and attempt_count between 0 and max_attempts and escalation_level between 0 and 10)
);

create table if not exists public.digital_observer_integration_clients (
  id uuid primary key default gen_random_uuid(),
  client_key text not null unique,
  product_key text not null,
  display_name text not null,
  token_hash text,
  active boolean not null default false,
  allowed_scopes jsonb not null default '[]'::jsonb,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_integration_audit_logs (
  id uuid primary key default gen_random_uuid(),
  integration_client_id uuid not null references public.digital_observer_integration_clients(id) on delete restrict,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  request_id text not null,
  requested_scope text not null,
  action text not null,
  result_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint digital_observer_integration_audit_result_check check (result_status in ('allowed','denied','failed'))
);

create index if not exists digital_observer_camera_sources_site_idx on public.digital_observer_camera_sources(observer_site_id, status, created_at desc);
create index if not exists digital_observer_known_people_site_idx on public.digital_observer_known_people(observer_site_id, recognition_status);
create index if not exists digital_observer_event_clips_site_idx on public.digital_observer_event_clips(observer_site_id, captured_at desc);
create index if not exists digital_observer_notification_site_idx on public.digital_observer_notification_deliveries(observer_site_id, delivery_status, created_at desc);
create unique index if not exists digital_observer_notification_dedupe_idx on public.digital_observer_notification_deliveries(observer_site_id, dedupe_key) where dedupe_key is not null;
create index if not exists digital_observer_organizations_owner_idx on public.digital_observer_organizations(owner_profile_id, active);
create index if not exists digital_observer_integration_audit_client_idx on public.digital_observer_integration_audit_logs(integration_client_id, created_at desc);
create index if not exists digital_observer_integration_audit_site_idx on public.digital_observer_integration_audit_logs(observer_site_id, created_at desc);

alter table public.digital_observer_camera_sources enable row level security;
alter table public.digital_observer_known_people enable row level security;
alter table public.digital_observer_event_clips enable row level security;
alter table public.digital_observer_notification_deliveries enable row level security;
alter table public.digital_observer_integration_clients enable row level security;
alter table public.digital_observer_integration_audit_logs enable row level security;
alter table public.digital_observer_organizations enable row level security;

drop policy if exists "digital observer organizations scoped read" on public.digital_observer_organizations;
drop policy if exists "digital observer organizations owner create" on public.digital_observer_organizations;
drop policy if exists "digital observer organizations owner update" on public.digital_observer_organizations;
create policy "digital observer organizations scoped read" on public.digital_observer_organizations
for select using (
  public.is_admin()
  or owner_profile_id = auth.uid()
  or exists (
    select 1
    from public.observer_sites s
    join public.observer_site_memberships m on m.observer_site_id = s.id
    where s.digital_observer_organization_id = digital_observer_organizations.id
      and m.profile_id = auth.uid()
      and m.active = true
  )
);
create policy "digital observer organizations owner create" on public.digital_observer_organizations
for insert with check (owner_profile_id = auth.uid() and active = true);
create policy "digital observer organizations owner update" on public.digital_observer_organizations
for update using (public.is_admin() or owner_profile_id = auth.uid())
with check (public.is_admin() or owner_profile_id = auth.uid());

revoke all on table public.digital_observer_organizations from anon;
revoke all on table public.digital_observer_organizations from authenticated;
grant select, insert, update on table public.digital_observer_organizations to authenticated;

drop policy if exists "digital observer camera sources scoped read" on public.digital_observer_camera_sources;
drop policy if exists "digital observer camera sources scoped write" on public.digital_observer_camera_sources;
create policy "digital observer camera sources scoped read" on public.digital_observer_camera_sources
for select using (public.can_access_observer_site(observer_site_id));
create policy "digital observer camera sources scoped write" on public.digital_observer_camera_sources
for all using (public.can_manage_observer_site(observer_site_id))
with check (
  public.can_manage_observer_site(observer_site_id)
  and source_mode <> 'live'
  and secret_reference is null
);

drop policy if exists "digital observer known people scoped" on public.digital_observer_known_people;
create policy "digital observer known people scoped" on public.digital_observer_known_people
for all using (public.can_manage_observer_site(observer_site_id))
with check (
  public.can_manage_observer_site(observer_site_id)
  and recognition_status in ('disabled','readiness')
  and image_storage_path is null
  and biometric_reference is null
);

drop policy if exists "digital observer clips scoped read" on public.digital_observer_event_clips;
drop policy if exists "digital observer clips scoped write" on public.digital_observer_event_clips;
create policy "digital observer clips scoped read" on public.digital_observer_event_clips
for select using (public.can_access_observer_site(observer_site_id));

drop policy if exists "digital observer deliveries scoped read" on public.digital_observer_notification_deliveries;
drop policy if exists "digital observer deliveries scoped write" on public.digital_observer_notification_deliveries;
create policy "digital observer deliveries scoped read" on public.digital_observer_notification_deliveries
for select using (public.can_access_observer_site(observer_site_id));
create policy "digital observer deliveries scoped write" on public.digital_observer_notification_deliveries
for all using (public.can_manage_observer_site(observer_site_id))
with check (
  public.can_manage_observer_site(observer_site_id)
  and provider_mode in ('disabled','mock','sandbox')
  and delivery_status in ('queued','mocked','failed','cancelled')
);

drop policy if exists "digital observer integration clients admin only" on public.digital_observer_integration_clients;
create policy "digital observer integration clients admin only" on public.digital_observer_integration_clients
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "digital observer integration audit admin read" on public.digital_observer_integration_audit_logs;
create policy "digital observer integration audit admin read" on public.digital_observer_integration_audit_logs
for select using (public.is_admin());

create or replace function public.block_digital_observer_integration_audit_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'digital observer integration audit logs are append-only';
end;
$$;
drop trigger if exists digital_observer_integration_audit_block_update on public.digital_observer_integration_audit_logs;
create trigger digital_observer_integration_audit_block_update
before update on public.digital_observer_integration_audit_logs
for each row execute function public.block_digital_observer_integration_audit_mutation();
drop trigger if exists digital_observer_integration_audit_block_delete on public.digital_observer_integration_audit_logs;
create trigger digital_observer_integration_audit_block_delete
before delete on public.digital_observer_integration_audit_logs
for each row execute function public.block_digital_observer_integration_audit_mutation();

drop policy if exists "observer active packages public read" on public.observer_monitoring_packages;
create policy "observer active packages public read" on public.observer_monitoring_packages
for select using (active = true or public.is_admin());

drop policy if exists "observer sites standalone owner create" on public.observer_sites;
create policy "observer sites standalone owner create" on public.observer_sites
for insert with check (
  owner_profile_id = auth.uid()
  and garden_id is null
  and site_type <> 'kindergarten'
  and monitoring_enabled = false
);

drop policy if exists "observer sites standalone owner update" on public.observer_sites;
create policy "observer sites standalone owner update" on public.observer_sites
for update using (public.can_manage_observer_site(id))
with check (owner_profile_id = auth.uid() and garden_id is null and site_type <> 'kindergarten');

drop policy if exists "observer site memberships owner insert" on public.observer_site_memberships;
create policy "observer site memberships owner insert" on public.observer_site_memberships
for insert with check (profile_id = auth.uid() and public.can_manage_observer_site(observer_site_id));

drop policy if exists "observer subscriptions standalone member read" on public.observer_site_subscriptions;
create policy "observer subscriptions standalone member read" on public.observer_site_subscriptions
for select using (public.can_access_observer_site(observer_site_id));

drop policy if exists "observer signals standalone member read" on public.observer_intelligence_signals;
create policy "observer signals standalone member read" on public.observer_intelligence_signals
for select using (
  observer_site_id is not null
  and public.can_access_observer_site(observer_site_id)
);

drop policy if exists "observer monitoring schedules standalone manage" on public.observer_monitoring_schedules;
create policy "observer monitoring schedules standalone manage" on public.observer_monitoring_schedules
for all using (public.can_manage_observer_site(observer_site_id))
with check (public.can_manage_observer_site(observer_site_id));

drop policy if exists "observer alert settings standalone manage" on public.observer_alert_channel_settings;
create policy "observer alert settings standalone manage" on public.observer_alert_channel_settings
for all using (public.can_manage_observer_site(observer_site_id))
with check (public.can_manage_observer_site(observer_site_id));

drop policy if exists "observer subscription changes standalone request" on public.observer_subscription_change_requests;
create policy "observer subscription changes standalone request" on public.observer_subscription_change_requests
for insert with check (public.can_manage_observer_site(observer_site_id));

drop policy if exists "observer signal reviews standalone scoped" on public.observer_signal_reviews;
create policy "observer signal reviews standalone scoped" on public.observer_signal_reviews
for all using (
  public.is_admin()
  or exists (
    select 1 from public.observer_intelligence_signals s
    where s.id = signal_id
      and s.observer_site_id is not null
      and public.can_manage_observer_site(s.observer_site_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.observer_intelligence_signals s
    where s.id = signal_id
      and s.observer_site_id is not null
      and public.can_manage_observer_site(s.observer_site_id)
  )
);

revoke select on table public.digital_observer_camera_sources from anon, authenticated;
grant select (
  id, observer_site_id, camera_stream_id, display_name, location_label, connector_type,
  connector_provider, source_mode, status, health_status, stream_protocol, gateway_provider,
  preview_scene, capabilities, monitoring_targets, last_health_check_at, last_seen_at,
  last_error_code, last_error_message, metadata, created_by, created_at, updated_at
) on table public.digital_observer_camera_sources to authenticated;

revoke select on table public.digital_observer_known_people from anon, authenticated;
grant select (
  id, observer_site_id, display_name, relationship_label, consent_status, recognition_status,
  camera_scope, notify_on_detection, confidence_threshold, last_confirmed_at, metadata,
  created_by, created_at, updated_at
) on table public.digital_observer_known_people to authenticated;

revoke select on table public.digital_observer_event_clips from anon, authenticated;
grant select (
  id, observer_site_id, camera_source_id, signal_id, title, clip_status, captured_at,
  duration_seconds, retention_hours, delete_after, downloadable, metadata, created_at, updated_at
) on table public.digital_observer_event_clips to authenticated;

revoke select on table public.digital_observer_notification_deliveries from anon, authenticated;
grant select (
  id, observer_site_id, signal_id, recipient_profile_id, channel, severity, provider_mode,
  delivery_status, attempt_count, sent_at, acknowledged_at, failure_reason, metadata, created_at, updated_at
) on table public.digital_observer_notification_deliveries to authenticated;

revoke insert, update, delete on table public.digital_observer_camera_sources from authenticated;
grant insert (
  observer_site_id, camera_stream_id, display_name, location_label, connector_type,
  connector_provider, source_mode, status, health_status, stream_protocol, gateway_provider,
  preview_scene, capabilities, monitoring_targets, last_health_check_at, last_seen_at,
  last_error_code, last_error_message, metadata, created_by
) on table public.digital_observer_camera_sources to authenticated;
grant update (
  display_name, location_label, connector_type, connector_provider, source_mode, status,
  health_status, stream_protocol, gateway_provider, preview_scene, capabilities,
  monitoring_targets, last_health_check_at, last_seen_at, last_error_code,
  last_error_message, metadata, updated_at
) on table public.digital_observer_camera_sources to authenticated;
grant delete on table public.digital_observer_camera_sources to authenticated;

revoke insert, update, delete on table public.digital_observer_known_people from authenticated;
grant insert (
  observer_site_id, display_name, relationship_label, consent_status, recognition_status,
  camera_scope, notify_on_detection, confidence_threshold, last_confirmed_at, metadata, created_by
) on table public.digital_observer_known_people to authenticated;
grant update (
  display_name, relationship_label, consent_status, recognition_status, camera_scope,
  notify_on_detection, confidence_threshold, last_confirmed_at, metadata, updated_at
) on table public.digital_observer_known_people to authenticated;
grant delete on table public.digital_observer_known_people to authenticated;

revoke insert, update, delete on table public.digital_observer_event_clips from authenticated;

revoke insert, update, delete on table public.digital_observer_notification_deliveries from authenticated;
grant insert (
  observer_site_id, signal_id, recipient_profile_id, channel, severity, provider_mode,
  delivery_status, attempt_count, sent_at, acknowledged_at, failure_reason, metadata
) on table public.digital_observer_notification_deliveries to authenticated;

revoke all on table public.digital_observer_integration_clients from anon, authenticated;
grant select on table public.digital_observer_integration_clients to authenticated;
revoke all on table public.digital_observer_integration_audit_logs from anon, authenticated;
grant select on table public.digital_observer_integration_audit_logs to authenticated;
grant update (
  delivery_status, attempt_count, sent_at, acknowledged_at, failure_reason, metadata, updated_at
) on table public.digital_observer_notification_deliveries to authenticated;

create or replace function public.claim_digital_observer_profile(requested_name text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_profile public.profiles%rowtype;
begin
  if auth.uid() is null then return false; end if;
  select * into current_profile from public.profiles where id = auth.uid() for update;
  if current_profile.id is null then return false; end if;
  if current_profile.role::text = 'network_manager' then return true; end if;
  if current_profile.role::text <> 'parent' or current_profile.garden_id is not null then return false; end if;
  if exists (
    select 1 from public.parents p
    where p.profile_id = auth.uid() or p.user_id = auth.uid()
  ) then return false; end if;
  if exists (
    select 1 from public.observer_sites s
    where s.owner_profile_id = auth.uid() and s.site_type = 'kindergarten'
  ) then return false; end if;

  update public.profiles
  set role = 'network_manager',
      full_name = coalesce(nullif(btrim(requested_name), ''), full_name),
      must_change_password = false,
      updated_at = now()
  where id = auth.uid();
  return true;
end;
$$;

revoke all on function public.claim_digital_observer_profile(text) from public, anon;
grant execute on function public.claim_digital_observer_profile(text) to authenticated;

insert into public.digital_observer_integration_clients (
  client_key, product_key, display_name, active, allowed_scopes, metadata
)
values (
  'gan_batuach_readiness',
  'gan_batuach',
  'Gan Batuach secure integration readiness',
  false,
  '["camera.health:read","events.reviewed:read","snapshots.signed:read","clips.signed:read"]'::jsonb,
  '{"server_to_server_only":true,"audit_required":true,"parent_camera_access_not_implied":true}'::jsonb
)
on conflict (client_key) do update set
  allowed_scopes = excluded.allowed_scopes,
  metadata = public.digital_observer_integration_clients.metadata || excluded.metadata,
  updated_at = now();

comment on table public.digital_observer_camera_sources is 'Standalone camera connector inventory. Secret references are server-only and live mode requires a secret reference.';
comment on table public.digital_observer_known_people is 'Consent-gated known-person readiness. Biometric references and image paths are server-only.';
comment on table public.digital_observer_event_clips is 'Event clip metadata with a Digital Observer product maximum retention of 48 hours.';
comment on table public.digital_observer_integration_clients is 'Server-to-server client registry. Never expose token hashes to a browser.';
comment on table public.digital_observer_integration_audit_logs is 'Append-only metadata audit for scoped server-to-server integration calls. No tokens or media URLs.';

notify pgrst, 'reload schema';
