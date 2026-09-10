-- PUSH 18: device-specific Ed25519 identity for Digital Observer-managed edge components.
-- Existing live devices remain explicitly LEGACY_HMAC until controlled migration.
begin;

alter table public.video_gateway_device_enrollments
  add column if not exists identity_scheme text not null default 'LEGACY_HMAC',
  add column if not exists deployment_profile text,
  add column if not exists tenant_id uuid,
  add column if not exists credential_version integer not null default 0,
  add column if not exists lifecycle_state text not null default 'ACTIVE',
  add column if not exists runtime_version text,
  add column if not exists config_version integer not null default 1,
  add column if not exists last_seen_at timestamptz,
  add column if not exists active_runtime_instance_id text,
  add column if not exists active_runtime_sequence bigint,
  add column if not exists clone_suspected_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists hardened_at timestamptz;

update public.video_gateway_device_enrollments enrollment
set deployment_profile = case when enrollment.metadata->>'device_type' = 'SOFTWARE_CONNECTOR'
    then 'SOFTWARE_CONNECTOR' else 'PHYSICAL_GATEWAY' end,
    lifecycle_state = case when enrollment.status = 'revoked' then 'REVOKED' else 'ACTIVE' end,
    runtime_version = nullif(enrollment.metadata->>'software_version',''),
    config_version = greatest(1, coalesce((enrollment.metadata->>'connector_config_version')::integer, 1)),
    last_seen_at = case when enrollment.metadata->>'last_heartbeat_at' is not null
      then (enrollment.metadata->>'last_heartbeat_at')::timestamptz else null end,
    tenant_id = coalesce(site.digital_observer_organization_id, site.id)
from public.observer_sites site
where enrollment.observer_site_id = site.id
  and enrollment.deployment_profile is null;

alter table public.video_gateway_device_enrollments
  add constraint video_gateway_device_identity_scheme_check
    check (identity_scheme in ('LEGACY_HMAC','ED25519_V1')),
  add constraint video_gateway_device_profile_check
    check (deployment_profile is null or deployment_profile in ('SOFTWARE_CONNECTOR','PHYSICAL_GATEWAY','ENTERPRISE_EDGE')),
  add constraint video_gateway_device_lifecycle_check
    check (lifecycle_state in ('ACTIVE','REVOKED','LOST','REPLACED','RETIRED')),
  add constraint video_gateway_device_credential_version_check check (credential_version >= 0),
  add constraint video_gateway_device_config_version_check check (config_version > 0);

alter table public.video_gateway_device_enrollments
  drop constraint if exists video_gateway_device_enrollment_refresh_check;
alter table public.video_gateway_device_enrollments
  add constraint video_gateway_device_enrollment_refresh_check check (
    status not in ('approved','delivered') or
    (observer_site_id is not null and gateway_id is not null and
      (identity_scheme = 'ED25519_V1' or refresh_token_hash is not null))
  );

create table public.observer_managed_device_credentials (
  id uuid primary key,
  enrollment_id uuid not null references public.video_gateway_device_enrollments(id) on delete cascade,
  credential_version integer not null check (credential_version > 0),
  algorithm text not null check (algorithm = 'Ed25519'),
  public_key_spki text not null check (length(public_key_spki) between 40 and 256 and public_key_spki ~ '^[A-Za-z0-9_-]+$'),
  credential_state text not null check (credential_state in ('PENDING','ACTIVE','RETIRED','REVOKED')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  retired_at timestamptz,
  revoked_at timestamptz,
  unique(enrollment_id, credential_version),
  unique(public_key_spki)
);
create unique index observer_managed_device_one_active_credential_idx
  on public.observer_managed_device_credentials(enrollment_id) where credential_state = 'ACTIVE';

create table public.observer_managed_device_auth_nonces (
  enrollment_id uuid not null references public.video_gateway_device_enrollments(id) on delete cascade,
  credential_version integer not null,
  nonce_hash text not null check (nonce_hash ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  primary key(enrollment_id, credential_version, nonce_hash),
  constraint observer_managed_device_nonce_ttl check (expires_at > observed_at and expires_at <= observed_at + interval '5 minutes')
);
create index observer_managed_device_nonce_expiry_idx on public.observer_managed_device_auth_nonces(expires_at);

create table public.observer_managed_device_rotations (
  id uuid primary key,
  enrollment_id uuid not null references public.video_gateway_device_enrollments(id) on delete cascade,
  old_credential_version integer not null,
  new_credential_version integer not null,
  challenge_hash text not null check (challenge_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'PENDING' check (state in ('PENDING','CONFIRMED','EXPIRED','CANCELLED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint observer_managed_device_rotation_ttl check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  unique(enrollment_id, new_credential_version)
);

alter table public.observer_managed_device_credentials enable row level security;
alter table public.observer_managed_device_auth_nonces enable row level security;
alter table public.observer_managed_device_rotations enable row level security;
revoke all on public.observer_managed_device_credentials from anon, authenticated;
revoke all on public.observer_managed_device_auth_nonces from anon, authenticated;
revoke all on public.observer_managed_device_rotations from anon, authenticated;
grant select, insert, update, delete on public.observer_managed_device_credentials to service_role;
grant select, insert, update, delete on public.observer_managed_device_auth_nonces to service_role;
grant select, insert, update, delete on public.observer_managed_device_rotations to service_role;

create or replace function public.approve_observer_managed_device_enrollment(
  p_enrollment uuid, p_site uuid, p_gateway uuid, p_actor uuid
) returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare request public.video_gateway_device_enrollments%rowtype;
declare organization uuid;
declare public_key text;
declare profile text;
begin
  select * into request from public.video_gateway_device_enrollments where id = p_enrollment for update;
  if not found or request.status <> 'pending' or request.expires_at <= now() then
    raise exception 'MANAGED_DEVICE_ENROLLMENT_UNAVAILABLE';
  end if;
  select coalesce(digital_observer_organization_id, id) into organization from public.observer_sites where id = p_site;
  if not found then raise exception 'MANAGED_DEVICE_SITE_UNAVAILABLE'; end if;
  public_key := request.metadata->>'credential_public_key_spki';
  profile := request.metadata->>'device_type';
  if length(public_key) not between 40 and 256 or public_key !~ '^[A-Za-z0-9_-]+$' or request.metadata->>'credential_algorithm' <> 'Ed25519'
    or profile not in ('SOFTWARE_CONNECTOR','PHYSICAL_GATEWAY','ENTERPRISE_EDGE') then
    raise exception 'MANAGED_DEVICE_KEY_OR_PROFILE_INVALID';
  end if;
  insert into public.observer_managed_device_credentials(id,enrollment_id,credential_version,algorithm,public_key_spki,credential_state,activated_at)
    values(gen_random_uuid(),request.id,1,'Ed25519',public_key,'ACTIVE',now());
  update public.video_gateway_device_enrollments set status = 'approved', observer_site_id = p_site,
    gateway_id = p_gateway, created_by_profile_id = p_actor, approved_at = now(),
    identity_scheme = 'ED25519_V1', deployment_profile = profile, tenant_id = organization,
    credential_version = 1, lifecycle_state = 'ACTIVE', hardened_at = now(), refresh_token_hash = null,
    runtime_version = nullif(request.metadata->>'software_version',''), config_version = 1,
    metadata = request.metadata - 'credential_public_key_spki' where id = request.id;
  return true;
end $$;
revoke all on function public.approve_observer_managed_device_enrollment(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.approve_observer_managed_device_enrollment(uuid,uuid,uuid,uuid) to service_role;

drop function if exists public.claim_observer_connector_install_intent(uuid,text,uuid,uuid,text,text,text,text,text);
create function public.claim_observer_connector_install_intent(
  p_id uuid, p_secret_hash text, p_site uuid, p_enrollment uuid,
  p_poll_hash text, p_installation text, p_platform text, p_version text, p_build text,
  p_credential_algorithm text, p_credential_public_key_spki text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare intent public.observer_connector_install_intents%rowtype;
begin
  if p_installation !~ '^edge-[a-f0-9]{32}$' or p_poll_hash !~ '^[a-f0-9]{64}$'
    or p_platform not in ('macos-arm64','macos-x64','windows-x64')
    or length(p_version) not between 1 and 80 or length(p_build) not between 1 and 80
    or p_credential_algorithm <> 'Ed25519'
    or length(p_credential_public_key_spki) not between 40 and 256
    or p_credential_public_key_spki !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'INSTALL_INPUT_INVALID';
  end if;
  select * into intent from public.observer_connector_install_intents where id = p_id for update;
  if not found or intent.state <> 'ISSUED' or intent.expires_at <= now()
    or intent.secret_hash is distinct from p_secret_hash or intent.observer_site_id is distinct from p_site then
    raise exception 'INSTALL_INTENT_UNAVAILABLE';
  end if;
  if not exists (select 1 from public.observer_sites s where s.id = intent.observer_site_id and s.owner_profile_id = intent.actor_profile_id)
    and not exists (select 1 from public.observer_site_memberships m where m.observer_site_id = intent.observer_site_id
      and m.profile_id = intent.actor_profile_id and m.active and m.member_role in ('owner','admin')) then
    raise exception 'INSTALL_AUTHORIZATION_REVOKED';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_installation, 0));
  if exists (select 1 from public.video_gateway_device_enrollments e where e.metadata->>'installation_id' = p_installation
    and e.status in ('pending','approved','delivered') and (e.status <> 'pending' or e.expires_at > now())) then
    raise exception 'INSTALLATION_ALREADY_ENROLLED';
  end if;
  insert into public.video_gateway_device_enrollments(id, status, device_name, device_platform,
    poll_token_hash, observer_site_id, created_by_profile_id, expires_at, metadata)
  values(p_enrollment, 'pending', 'Digital Observer', p_platform, p_poll_hash, intent.observer_site_id,
    intent.actor_profile_id, intent.expires_at, jsonb_build_object('protocol_version',3,
    'device_type','SOFTWARE_CONNECTOR','installation_id',p_installation,'install_intent_id',intent.id,
    'software_version',p_version,'build_sha',p_build,'connector_config_version',1,
    'credential_algorithm',p_credential_algorithm,'credential_public_key_spki',p_credential_public_key_spki,
    'outbound_only',true,'arbitrary_shell_commands',false));
  update public.observer_connector_install_intents set state = 'CLAIMED', enrollment_id = p_enrollment,
    secret_hash = repeat('0',64) where id = intent.id;
  return p_enrollment;
end $$;
revoke all on function public.claim_observer_connector_install_intent(uuid,text,uuid,uuid,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_observer_connector_install_intent(uuid,text,uuid,uuid,text,text,text,text,text,text,text) to service_role;

create or replace function public.record_observer_managed_device_auth(
  p_enrollment uuid, p_credential_version integer, p_nonce_hash text,
  p_runtime_instance text, p_sequence bigint, p_observed_at timestamptz
) returns text language plpgsql security definer
set search_path = public, pg_temp
as $$
declare device public.video_gateway_device_enrollments%rowtype;
declare session_class text;
begin
  if p_nonce_hash !~ '^[a-f0-9]{64}$' or p_runtime_instance !~ '^[A-Za-z0-9._:-]{8,160}$'
    or p_sequence < 0 or abs(extract(epoch from (now() - p_observed_at))) > 120 then
    raise exception 'MANAGED_DEVICE_AUTH_INPUT_INVALID';
  end if;
  select * into device from public.video_gateway_device_enrollments where id = p_enrollment for update;
  if not found or device.identity_scheme <> 'ED25519_V1' or device.status <> 'delivered'
    or device.lifecycle_state <> 'ACTIVE' or device.credential_version <> p_credential_version then
    raise exception 'MANAGED_DEVICE_NOT_ACTIVE';
  end if;
  insert into public.observer_managed_device_auth_nonces(enrollment_id, credential_version, nonce_hash, observed_at, expires_at)
    values(p_enrollment, p_credential_version, p_nonce_hash, p_observed_at, p_observed_at + interval '5 minutes');
  if device.active_runtime_instance_id is null then session_class := 'FIRST_SEEN';
  elsif device.active_runtime_instance_id = p_runtime_instance then
    if p_sequence <= coalesce(device.active_runtime_sequence, -1) then return 'MANAGED_DEVICE_STALE_SESSION'; end if;
    session_class := 'CONTINUATION';
  elsif device.last_seen_at is not null and p_observed_at - device.last_seen_at < interval '2 minutes' then
    update public.video_gateway_device_enrollments set clone_suspected_at = p_observed_at, updated_at = now() where id = p_enrollment;
    return 'MANAGED_DEVICE_CLONE_SUSPECTED';
  else session_class := 'RESTART';
  end if;
  update public.video_gateway_device_enrollments set active_runtime_instance_id = p_runtime_instance,
    active_runtime_sequence = p_sequence, last_seen_at = p_observed_at, updated_at = now()
  where id = p_enrollment;
  return session_class;
end $$;
revoke all on function public.record_observer_managed_device_auth(uuid,integer,text,text,bigint,timestamptz) from public, anon, authenticated;
grant execute on function public.record_observer_managed_device_auth(uuid,integer,text,text,bigint,timestamptz) to service_role;

create or replace function public.confirm_observer_managed_device_rotation(
  p_rotation uuid, p_enrollment uuid, p_new_version integer, p_challenge_hash text
) returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare rotation public.observer_managed_device_rotations%rowtype;
begin
  select * into rotation from public.observer_managed_device_rotations where id = p_rotation and enrollment_id = p_enrollment for update;
  if not found or rotation.state <> 'PENDING' or rotation.expires_at <= now()
    or rotation.new_credential_version <> p_new_version or rotation.challenge_hash is distinct from p_challenge_hash then
    raise exception 'MANAGED_DEVICE_ROTATION_INVALID';
  end if;
  if not exists (select 1 from public.observer_managed_device_credentials where enrollment_id = p_enrollment
    and credential_version = p_new_version and credential_state = 'PENDING') then
    raise exception 'MANAGED_DEVICE_ROTATION_KEY_MISSING';
  end if;
  update public.observer_managed_device_credentials set credential_state = 'RETIRED', retired_at = now()
    where enrollment_id = p_enrollment and credential_state = 'ACTIVE';
  update public.observer_managed_device_credentials set credential_state = 'ACTIVE', activated_at = now()
    where enrollment_id = p_enrollment and credential_version = p_new_version and credential_state = 'PENDING';
  update public.video_gateway_device_enrollments set credential_version = p_new_version,
    identity_scheme = 'ED25519_V1', hardened_at = coalesce(hardened_at, now()), refresh_token_hash = null,
    active_runtime_instance_id = null, active_runtime_sequence = null, updated_at = now() where id = p_enrollment;
  update public.observer_managed_device_rotations set state = 'CONFIRMED', confirmed_at = now(),
    challenge_hash = repeat('0',64) where id = p_rotation;
  return true;
end $$;
revoke all on function public.confirm_observer_managed_device_rotation(uuid,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.confirm_observer_managed_device_rotation(uuid,uuid,integer,text) to service_role;

create or replace function public.mark_observer_managed_device_unavailable(
  p_site uuid, p_gateway uuid, p_state text
) returns integer language plpgsql security definer
set search_path = public, pg_temp
as $$
declare affected integer;
begin
  if p_state not in ('REVOKED','LOST','REPLACED','RETIRED') then raise exception 'MANAGED_DEVICE_STATE_INVALID'; end if;
  update public.digital_observer_camera_sources set status = 'readiness', health_status = 'offline',
    metadata = metadata || jsonb_build_object('active_monitoring',false,'managed_device_state',p_state,
      'managed_device_failure','DEVICE_CREDENTIAL_REVOKED'), updated_at = now()
  where observer_site_id = p_site and metadata->>'gateway_id' = p_gateway::text;
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function public.mark_observer_managed_device_unavailable(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.mark_observer_managed_device_unavailable(uuid,uuid,text) to service_role;

create or replace function public.replace_observer_managed_device(
  p_site uuid, p_old_gateway uuid, p_new_gateway uuid, p_actor uuid
) returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare old_device public.video_gateway_device_enrollments%rowtype;
declare new_device public.video_gateway_device_enrollments%rowtype;
declare affected integer;
begin
  if p_old_gateway = p_new_gateway then raise exception 'MANAGED_DEVICE_REPLACEMENT_UNCHANGED'; end if;
  select * into old_device from public.video_gateway_device_enrollments
    where observer_site_id = p_site and gateway_id = p_old_gateway and status = 'delivered' for update;
  select * into new_device from public.video_gateway_device_enrollments
    where observer_site_id = p_site and gateway_id = p_new_gateway and status = 'delivered'
      and identity_scheme = 'ED25519_V1' and lifecycle_state = 'ACTIVE' for update;
  if old_device.id is null or new_device.id is null or old_device.deployment_profile is distinct from new_device.deployment_profile then
    raise exception 'MANAGED_DEVICE_REPLACEMENT_SCOPE_INVALID';
  end if;
  update public.digital_observer_camera_sources set metadata = jsonb_set(metadata, '{gateway_id}', to_jsonb(p_new_gateway::text), true),
    updated_at = now() where observer_site_id = p_site and metadata->>'gateway_id' = p_old_gateway::text;
  get diagnostics affected = row_count;
  update public.video_gateway_device_enrollments set status = 'revoked', lifecycle_state = 'REPLACED',
    revocation_reason = 'AUTHORIZED_REPLACEMENT', revoked_at = now(), refresh_token_hash = null, updated_at = now()
    where id = old_device.id;
  update public.observer_managed_device_credentials set credential_state = 'REVOKED', revoked_at = now()
    where enrollment_id = old_device.id and credential_state in ('PENDING','ACTIVE');
  return jsonb_build_object('source_count',affected,'old_device_state','REPLACED','new_device_id',p_new_gateway);
end $$;
revoke all on function public.replace_observer_managed_device(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.replace_observer_managed_device(uuid,uuid,uuid,uuid) to service_role;

comment on table public.observer_managed_device_credentials is
  'Public Ed25519 credentials for DO-managed local components. Private keys never leave platform-protected local storage.';
comment on column public.video_gateway_device_enrollments.identity_scheme is
  'LEGACY_HMAC is migration-only; all newly enrolled managed components use ED25519_V1.';

notify pgrst, 'reload schema';
commit;
