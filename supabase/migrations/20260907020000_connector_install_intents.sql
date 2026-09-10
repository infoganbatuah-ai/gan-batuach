-- PUSH 17B: short-lived Product handoff, not a second device identity model.
-- Deploy only after integration/role tests. No change to existing device rows.
create table public.observer_connector_install_intents (
  id uuid primary key,
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete cascade,
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  state text not null default 'ISSUED' check (state in ('ISSUED','CLAIMED','APPROVED','CANCELLED')),
  expires_at timestamptz not null,
  enrollment_id uuid references public.video_gateway_device_enrollments(id),
  created_at timestamptz not null default now(),
  constraint bounded_install_intent check (expires_at > created_at and expires_at <= created_at + interval '15 minutes')
);
create index observer_connector_install_intents_scope_idx on public.observer_connector_install_intents(actor_profile_id, observer_site_id, created_at desc);
alter table public.observer_connector_install_intents enable row level security;
revoke all on public.observer_connector_install_intents from anon, authenticated;
grant select, insert, update, delete on public.observer_connector_install_intents to service_role;

create function public.claim_observer_connector_install_intent(
  p_id uuid, p_secret_hash text, p_site uuid, p_enrollment uuid,
  p_poll_hash text, p_installation text, p_platform text, p_version text, p_build text
) returns uuid language plpgsql security definer
set search_path = pg_catalog, pg_temp
as $$
declare intent public.observer_connector_install_intents%rowtype;
begin
  if p_installation !~ '^edge-[a-f0-9]{32}$' or p_poll_hash !~ '^[a-f0-9]{64}$'
    or p_platform not in ('macos-arm64','macos-x64','windows-x64')
    or length(p_version) not between 1 and 80 or length(p_build) not between 1 and 80
    or p_installation is null or p_poll_hash is null or p_platform is null
    or p_version is null or p_build is null then
    raise exception 'INSTALL_INPUT_INVALID';
  end if;
  select * into intent from public.observer_connector_install_intents where id = p_id for update;
  if not found or intent.state <> 'ISSUED' or intent.expires_at <= now()
    or intent.secret_hash is distinct from p_secret_hash or intent.observer_site_id is distinct from p_site then
    raise exception 'INSTALL_INTENT_UNAVAILABLE';
  end if;
  -- Re-evaluate membership at consumption, not only at issuance.
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
    intent.actor_profile_id, intent.expires_at, jsonb_build_object('protocol_version',2,
    'device_type','SOFTWARE_CONNECTOR','installation_id',p_installation,'install_intent_id',intent.id,
    'software_version',p_version,'build_sha',p_build,'connector_config_version',1,
    'outbound_only',true,'arbitrary_shell_commands',false));
  update public.observer_connector_install_intents set state = 'CLAIMED', enrollment_id = p_enrollment,
    secret_hash = repeat('0',64) where id = intent.id;
  return p_enrollment;
end $$;
revoke all on function public.claim_observer_connector_install_intent(uuid,text,uuid,uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_observer_connector_install_intent(uuid,text,uuid,uuid,text,text,text,text,text) to service_role;
