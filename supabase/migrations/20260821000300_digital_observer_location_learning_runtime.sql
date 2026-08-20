-- Digital Observer location, learning and safe escalation foundations.
-- This migration does not activate a camera, AI, notification or emergency provider.

alter table public.observer_sites
  add column if not exists city text,
  add column if not exists street text,
  add column if not exists building_number text,
  add column if not exists apartment_number text,
  add column if not exists floor_kind text not null default 'floor',
  add column if not exists floor_number integer,
  add column if not exists postal_code text,
  add column if not exists country_code text not null default 'IL',
  add column if not exists formatted_address text,
  add column if not exists address_provider text,
  add column if not exists address_place_id text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists address_verification_status text not null default 'unverified',
  add column if not exists address_verified_at timestamptz,
  add column if not exists business_handles_children boolean not null default false,
  add column if not exists vision_privacy_mode text not null default 'standard_consent',
  add column if not exists observer_runtime_status text not null default 'setup',
  add column if not exists learning_started_at timestamptz,
  add column if not exists learning_target_days integer not null default 30;

alter table public.observer_sites
  drop constraint if exists observer_sites_floor_kind_check,
  drop constraint if exists observer_sites_address_verification_check,
  drop constraint if exists observer_sites_vision_privacy_mode_check,
  drop constraint if exists observer_sites_runtime_status_check,
  drop constraint if exists observer_sites_learning_target_check,
  drop constraint if exists observer_sites_coordinates_check;

alter table public.observer_sites
  add constraint observer_sites_floor_kind_check
    check (floor_kind in ('ground', 'floor')),
  add constraint observer_sites_address_verification_check
    check (address_verification_status in ('unverified', 'suggested', 'verified', 'failed', 'manual_review')),
  add constraint observer_sites_vision_privacy_mode_check
    check (vision_privacy_mode in ('standard_consent', 'skeleton_only')),
  add constraint observer_sites_runtime_status_check
    check (observer_runtime_status in ('setup', 'connection_testing', 'learning_readiness', 'learning_shadow', 'active', 'paused', 'provider_required', 'suspended')),
  add constraint observer_sites_learning_target_check
    check (learning_target_days between 1 and 90),
  add constraint observer_sites_coordinates_check
    check (
      (latitude is null and longitude is null)
      or (latitude between -90 and 90 and longitude between -180 and 180)
    );

create index if not exists observer_sites_geo_idx
  on public.observer_sites(latitude, longitude)
  where latitude is not null and longitude is not null;

create index if not exists observer_sites_city_runtime_idx
  on public.observer_sites(city, observer_runtime_status, active)
  where city is not null;

create table if not exists public.digital_observer_authorized_recipients (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  relationship_label text,
  channels jsonb not null default '["in_app"]'::jsonb,
  destination_hint text,
  provider_contact_reference text,
  receives_critical_alerts boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_recipient_channels_check check (jsonb_typeof(channels) = 'array'),
  constraint digital_observer_recipient_provider_guard check (
    provider_contact_reference is null
    or provider_contact_reference like 'secret://%'
  )
);

create table if not exists public.digital_observer_device_slots (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_label text not null,
  platform text not null default 'web',
  device_reference_hash text not null,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_device_platform_check check (platform in ('web', 'ios', 'android')),
  constraint digital_observer_device_reference_guard check (length(device_reference_hash) >= 32),
  unique (observer_site_id, device_reference_hash)
);

create index if not exists digital_observer_recipients_site_idx
  on public.digital_observer_authorized_recipients(observer_site_id, active, created_at);

create index if not exists digital_observer_device_slots_site_idx
  on public.digital_observer_device_slots(observer_site_id, active, last_seen_at desc);

alter table public.digital_observer_authorized_recipients enable row level security;
alter table public.digital_observer_device_slots enable row level security;

drop policy if exists "digital observer recipients scoped manage" on public.digital_observer_authorized_recipients;
create policy "digital observer recipients scoped manage" on public.digital_observer_authorized_recipients
for all using (public.can_manage_observer_site(observer_site_id))
with check (public.can_manage_observer_site(observer_site_id));

drop policy if exists "digital observer device slots scoped manage" on public.digital_observer_device_slots;
create policy "digital observer device slots scoped manage" on public.digital_observer_device_slots
for all using (public.can_manage_observer_site(observer_site_id))
with check (
  public.can_manage_observer_site(observer_site_id)
  and profile_id = auth.uid()
);

revoke all on table public.digital_observer_authorized_recipients from anon, authenticated;
grant select (
  id, observer_site_id, recipient_profile_id, display_name, relationship_label,
  channels, destination_hint, receives_critical_alerts, active, metadata,
  created_by, created_at, updated_at
) on public.digital_observer_authorized_recipients to authenticated;
grant insert (
  observer_site_id, recipient_profile_id, display_name, relationship_label,
  channels, destination_hint, provider_contact_reference,
  receives_critical_alerts, active, metadata, created_by
) on public.digital_observer_authorized_recipients to authenticated;
grant update (
  display_name, relationship_label, channels, destination_hint,
  provider_contact_reference, receives_critical_alerts, active, metadata, updated_at
) on public.digital_observer_authorized_recipients to authenticated;
grant delete on table public.digital_observer_authorized_recipients to authenticated;

revoke all on table public.digital_observer_device_slots from anon, authenticated;
grant select (
  id, observer_site_id, profile_id, device_label, platform, active,
  last_seen_at, metadata, created_at, updated_at
) on public.digital_observer_device_slots to authenticated;
grant insert (
  observer_site_id, profile_id, device_label, platform,
  device_reference_hash, active, last_seen_at, metadata
) on public.digital_observer_device_slots to authenticated;
grant update (
  device_label, platform, active, last_seen_at, metadata, updated_at
) on public.digital_observer_device_slots to authenticated;
grant delete on table public.digital_observer_device_slots to authenticated;

create or replace function public.enforce_digital_observer_device_limit()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  active_count integer;
begin
  if new.active is not true then
    return new;
  end if;

  select count(*)
  into active_count
  from public.digital_observer_device_slots d
  where d.observer_site_id = new.observer_site_id
    and d.active = true
    and d.id <> coalesce(new.id, gen_random_uuid());

  if active_count >= 2 then
    raise exception 'DIGITAL_OBSERVER_DEVICE_LIMIT_REACHED';
  end if;

  return new;
end;
$$;

drop trigger if exists digital_observer_device_limit on public.digital_observer_device_slots;
create trigger digital_observer_device_limit
before insert or update of active, observer_site_id on public.digital_observer_device_slots
for each row execute function public.enforce_digital_observer_device_limit();

alter table public.learning_feedback_signals
  drop constraint if exists learning_feedback_source_check;

alter table public.learning_feedback_signals
  add constraint learning_feedback_source_check check (source_type in (
    'ai_camera_event', 'audio_observer_event', 'pickup_event', 'watch_request',
    'safety_incident', 'camera_health', 'observer_signal', 'mock'
  ));

alter table public.observer_watch_requests
  add column if not exists camera_source_id uuid references public.digital_observer_camera_sources(id) on delete set null;

create index if not exists observer_watch_requests_camera_source_idx
  on public.observer_watch_requests(camera_source_id, active, created_at desc);

create or replace function public.initialize_digital_observer_learning(requested_site_id uuid)
returns public.observer_site_learning_profiles
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  profile_row public.observer_site_learning_profiles;
begin
  if not public.can_manage_observer_site(requested_site_id) then
    raise exception 'OBSERVER_SITE_ACCESS_DENIED';
  end if;

  insert into public.observer_site_learning_profiles (
    observer_site_id,
    learning_status,
    learning_maturity,
    baseline_version,
    confidence_level,
    anomaly_readiness_score,
    routine_confidence,
    metadata
  ) values (
    requested_site_id,
    'collecting_baseline',
    'new',
    'v1_30_day_readiness',
    0,
    0,
    '{"status":"collecting","target_days":30}'::jsonb,
    '{"human_review_required":true,"no_raw_video_in_profile":true,"automatic_decisions":false}'::jsonb
  )
  on conflict (observer_site_id) do update set
    learning_status = case
      when public.observer_site_learning_profiles.learning_status in ('not_started', 'paused') then 'collecting_baseline'
      else public.observer_site_learning_profiles.learning_status
    end,
    updated_at = now()
  returning * into profile_row;

  insert into public.site_behavior_baselines (
    observer_site_id,
    baseline_type,
    baseline_value,
    confidence_level,
    learning_maturity,
    anomaly_readiness_score,
    source_summary,
    metadata
  )
  select
    requested_site_id,
    baseline_type,
    baseline_value,
    0,
    'new',
    0,
    '{"source":"camera_and_reviewed_events","minimum_learning_days":30}'::jsonb,
    '{"human_review_required":true,"no_identity_transfer_between_tenants":true}'::jsonb
  from (values
    ('normal_occupancy_patterns', '{"status":"collecting"}'::jsonb),
    ('normal_movement_patterns', '{"status":"collecting"}'::jsonb),
    ('normal_activity_levels', '{"status":"collecting"}'::jsonb),
    ('normal_active_hours', '{"status":"collecting"}'::jsonb),
    ('normal_camera_activity', '{"status":"collecting"}'::jsonb),
    ('normal_zone_usage', '{"status":"collecting"}'::jsonb)
  ) as baseline(baseline_type, baseline_value)
  on conflict (observer_site_id, baseline_type) where observer_site_id is not null do nothing;

  update public.observer_sites
  set learning_started_at = coalesce(learning_started_at, now()),
      learning_target_days = 30,
      observer_runtime_status = case
        when observer_runtime_status in ('active', 'suspended') then observer_runtime_status
        else 'learning_readiness'
      end,
      updated_at = now()
  where id = requested_site_id;

  return profile_row;
end;
$$;

create or replace function public.record_digital_observer_feedback(
  requested_signal_id uuid,
  requested_outcome text,
  requested_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  signal_row public.observer_intelligence_signals;
  learning_row public.observer_site_learning_profiles;
  feedback_id uuid;
  normalized_outcome text;
  confidence_change numeric(5,4);
begin
  select * into signal_row
  from public.observer_intelligence_signals
  where id = requested_signal_id;

  if signal_row.id is null or signal_row.observer_site_id is null then
    raise exception 'OBSERVER_SIGNAL_NOT_FOUND';
  end if;

  if not public.can_manage_observer_site(signal_row.observer_site_id) then
    raise exception 'OBSERVER_SITE_ACCESS_DENIED';
  end if;

  normalized_outcome := case requested_outcome
    when 'confirmed' then 'valid_detection'
    when 'dismissed' then 'false_positive'
    when 'resolved' then 'confirmed'
    when 'escalated' then 'escalated'
    else 'needs_more_data'
  end;

  confidence_change := case normalized_outcome
    when 'valid_detection' then 0.02
    when 'false_positive' then -0.03
    when 'escalated' then 0.01
    else 0
  end;

  select * into learning_row
  from public.observer_site_learning_profiles
  where observer_site_id = signal_row.observer_site_id;

  insert into public.learning_feedback_signals (
    observer_site_id,
    camera_id,
    source_type,
    source_id,
    event_type,
    review_outcome,
    confidence_delta,
    confidence_after,
    maturity_after,
    anomaly_readiness_after,
    metadata
  ) values (
    signal_row.observer_site_id,
    signal_row.camera_id,
    'observer_signal',
    signal_row.id,
    coalesce(signal_row.metadata->>'event_type', signal_row.signal_type, 'observer_event'),
    normalized_outcome,
    confidence_change,
    greatest(0, least(1, coalesce(learning_row.confidence_level, 0) + confidence_change)),
    coalesce(learning_row.learning_maturity, 'new'),
    coalesce(learning_row.anomaly_readiness_score, 0),
    jsonb_build_object(
      'reviewer_id', auth.uid(),
      'note', nullif(requested_note, ''),
      'scope', 'event_pattern_only',
      'does_not_whitelist_globally', true,
      'human_review_required', true
    )
  ) returning id into feedback_id;

  return feedback_id;
end;
$$;

revoke all on function public.initialize_digital_observer_learning(uuid) from public;
revoke all on function public.record_digital_observer_feedback(uuid, text, text) from public;
grant execute on function public.initialize_digital_observer_learning(uuid) to authenticated, service_role;
grant execute on function public.record_digital_observer_feedback(uuid, text, text) to authenticated, service_role;

comment on column public.observer_sites.latitude is 'Verified or suggested site latitude for a future admin map and regional aggregates; never a browser-exposed provider secret.';
comment on column public.observer_sites.vision_privacy_mode is 'Child-focused businesses must use skeleton_only. Homes and other businesses require explicit consent before biometric recognition.';
comment on table public.digital_observer_authorized_recipients is 'Authorized alert recipients. External contact values must live behind an opaque server-side secret reference.';
comment on table public.digital_observer_device_slots is 'At most two active Digital Observer app devices per site. Stores a hash/reference, never a push secret.';
comment on function public.record_digital_observer_feedback(uuid, text, text) is 'Records site-scoped reviewed feedback. A dismissal never globally whitelists behavior and does not create an autonomous decision.';

notify pgrst, 'reload schema';
