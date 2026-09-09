-- PUSH 22: bounded fleet command/control primitives. Device inventory remains the PUSH 18 enrollment principal.
begin;

create table if not exists public.observer_edge_fleet_commands (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (length(idempotency_key) between 16 and 160),
  tenant_id uuid not null,
  observer_site_id uuid not null references public.observer_sites(id),
  enrollment_id uuid not null references public.video_gateway_device_enrollments(id),
  command text not null check (command in ('REFRESH_CONFIGURATION','HEALTH_PROBE','REDISCOVER_CAMERAS','RECONNECT_CAMERAS','RESTART_SERVICE','ASSIGN_UPDATE_CHANNEL','INITIATE_APPROVED_UPDATE','PAUSE_ROLLOUT')),
  state text not null default 'REQUESTED' check (state in ('REQUESTED','TARGETED','DELIVERED','ACKNOWLEDGED','COMPLETED','FAILED','EXPIRED')),
  safe_parameters jsonb not null default '{}'::jsonb,
  requested_by uuid not null references public.profiles(id),
  support_access_id uuid,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  delivered_at timestamptz,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  result_category text,
  constraint observer_edge_fleet_command_ttl check (expires_at > requested_at and expires_at <= requested_at + interval '30 minutes')
);

create table if not exists public.observer_edge_support_access (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid not null references public.profiles(id),
  tenant_id uuid not null,
  observer_site_id uuid references public.observer_sites(id),
  enrollment_id uuid references public.video_gateway_device_enrollments(id),
  reason text not null check (length(reason) between 8 and 500),
  state text not null default 'ACTIVE' check (state in ('ACTIVE','EXPIRED','REVOKED')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint observer_edge_support_access_ttl check (expires_at > granted_at and expires_at <= granted_at + interval '4 hours')
);

alter table public.observer_edge_fleet_commands
  add constraint observer_edge_fleet_commands_support_fk foreign key (support_access_id) references public.observer_edge_support_access(id);
create index if not exists observer_edge_fleet_commands_device_state_idx on public.observer_edge_fleet_commands(enrollment_id,state,expires_at);
create index if not exists observer_edge_fleet_commands_tenant_site_idx on public.observer_edge_fleet_commands(tenant_id,observer_site_id,requested_at desc);
create index if not exists observer_edge_support_access_scope_idx on public.observer_edge_support_access(tenant_id,observer_site_id,enrollment_id,state,expires_at);
create index if not exists observer_managed_device_fleet_idx on public.video_gateway_device_enrollments(tenant_id,observer_site_id,deployment_profile,lifecycle_state,last_seen_at desc);

alter table public.observer_edge_fleet_commands enable row level security;
alter table public.observer_edge_support_access enable row level security;
revoke all on public.observer_edge_fleet_commands, public.observer_edge_support_access from anon, authenticated;
grant all on public.observer_edge_fleet_commands, public.observer_edge_support_access to service_role;

create or replace function public.claim_observer_edge_fleet_commands(p_enrollment uuid, p_limit integer default 20)
returns setof public.observer_edge_fleet_commands language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update public.observer_edge_fleet_commands set state='EXPIRED', result_category='COMMAND_TTL_EXPIRED'
    where enrollment_id=p_enrollment and state in ('REQUESTED','TARGETED') and expires_at <= now();
  return query
    update public.observer_edge_fleet_commands c set state='DELIVERED', delivered_at=now()
    where c.id in (select id from public.observer_edge_fleet_commands where enrollment_id=p_enrollment
      and state in ('REQUESTED','TARGETED') and expires_at > now() order by requested_at limit least(greatest(p_limit,1),20) for update skip locked)
    returning c.*;
end $$;
revoke all on function public.claim_observer_edge_fleet_commands(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_observer_edge_fleet_commands(uuid,integer) to service_role;

commit;
