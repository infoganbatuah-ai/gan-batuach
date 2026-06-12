-- PHASE 141: Enterprise administration, multi-network management and regional operations.
-- Adds network/franchise/municipality structures while preserving strict tenant isolation.

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.app_role'::regtype
      and enumlabel = 'network_manager'
  ) then
    alter type public.app_role add value 'network_manager';
  end if;
end $$;

alter table public.gardens add column if not exists network_id uuid;
alter table public.gardens add column if not exists region text;
alter table public.gardens add column if not exists municipality text;
alter table public.gardens add column if not exists enterprise_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if to_regclass('public.ai_assistant_sessions') is not null then
    alter table public.ai_assistant_sessions drop constraint if exists ai_assistant_sessions_role_check;
    alter table public.ai_assistant_sessions add constraint ai_assistant_sessions_role_check check (role in ('admin','network_manager','owner','manager','parent','staff','inspector'));
  end if;
end $$;

create table if not exists public.kindergarten_networks (
  id uuid primary key default gen_random_uuid(),
  network_name text not null,
  network_type text not null default 'private_network',
  legal_name text,
  brand_name text,
  headquarters_city text,
  default_region text,
  default_municipality text,
  status text not null default 'active',
  centralized_billing boolean not null default false,
  public_transparency_enabled boolean not null default false,
  contact_name text,
  contact_email text,
  contact_phone text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindergarten_network_type_check check (network_type in ('private_network','franchise','educational_group','municipal_group')),
  constraint kindergarten_network_status_check check (status in ('active','onboarding','paused','suspended','archived')),
  unique(network_name)
);

alter table public.gardens
  drop constraint if exists gardens_network_id_fkey;
alter table public.gardens
  add constraint gardens_network_id_fkey foreign key (network_id) references public.kindergarten_networks(id) on delete set null;

create table if not exists public.network_kindergartens (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.kindergarten_networks(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  membership_status text not null default 'active',
  membership_role text not null default 'member',
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint network_kindergarten_status_check check (membership_status in ('active','pending','paused','ended')),
  constraint network_kindergarten_role_check check (membership_role in ('primary','member','trial','franchise_location')),
  unique(network_id, garden_id)
);

create table if not exists public.network_manager_assignments (
  id uuid primary key default gen_random_uuid(),
  network_id uuid not null references public.kindergarten_networks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_scope text not null default 'network',
  city text,
  municipality text,
  region text,
  can_view_financials boolean not null default false,
  can_send_network_notices boolean not null default true,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint network_manager_scope_check check (assignment_scope in ('network','region','municipality','city','kindergarten'))
);

create table if not exists public.enterprise_regions (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'ישראל',
  region_name text not null,
  city text,
  municipality text,
  network_id uuid references public.kindergarten_networks(id) on delete set null,
  supervisor_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enterprise_region_status_check check (status in ('active','paused','archived'))
);

create table if not exists public.enterprise_supervisor_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  assignment_type text not null default 'regional_supervisor',
  network_id uuid references public.kindergarten_networks(id) on delete cascade,
  region_id uuid references public.enterprise_regions(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  city text,
  municipality text,
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enterprise_supervisor_type_check check (assignment_type in ('regional_supervisor','municipal_supervisor','network_supervisor','backup_supervisor','franchise_operator')),
  constraint enterprise_supervisor_target_check check (network_id is not null or region_id is not null or garden_id is not null or city is not null or municipality is not null)
);

create table if not exists public.enterprise_operational_metrics (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'network',
  network_id uuid references public.kindergarten_networks(id) on delete cascade,
  region_id uuid references public.enterprise_regions(id) on delete cascade,
  city text,
  municipality text,
  snapshot_date date not null default current_date,
  active_kindergartens integer not null default 0,
  health_score integer not null default 0,
  compliance_score integer not null default 0,
  safety_score integer not null default 0,
  inspection_score integer not null default 0,
  parent_engagement_score integer not null default 0,
  staffing_score integer not null default 0,
  financial_score integer not null default 0,
  open_incidents integer not null default 0,
  unresolved_findings integer not null default 0,
  overdue_inspections integer not null default 0,
  expiring_subscriptions integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint enterprise_metric_scope_check check (scope_type in ('network','region','municipality','city','national')),
  constraint enterprise_metric_score_check check (
    health_score between 0 and 100
    and compliance_score between 0 and 100
    and safety_score between 0 and 100
    and inspection_score between 0 and 100
    and parent_engagement_score between 0 and 100
    and staffing_score between 0 and 100
    and financial_score between 0 and 100
  )
);

create table if not exists public.enterprise_communication_notices (
  id uuid primary key default gen_random_uuid(),
  notice_type text not null default 'network_announcement',
  priority text not null default 'normal',
  network_id uuid references public.kindergarten_networks(id) on delete cascade,
  region_id uuid references public.enterprise_regions(id) on delete cascade,
  city text,
  municipality text,
  title text not null,
  body text not null,
  audience text not null default 'managers',
  delivery_status text not null default 'draft',
  created_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enterprise_notice_type_check check (notice_type in ('network_announcement','regional_update','compliance_notice','emergency_notice')),
  constraint enterprise_notice_priority_check check (priority in ('low','normal','important','urgent','critical')),
  constraint enterprise_notice_audience_check check (audience in ('managers','owners','inspectors','staff','parents','all')),
  constraint enterprise_notice_status_check check (delivery_status in ('draft','scheduled','sent','failed','cancelled'))
);

create table if not exists public.enterprise_task_rollups (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'network',
  network_id uuid references public.kindergarten_networks(id) on delete cascade,
  region_id uuid references public.enterprise_regions(id) on delete cascade,
  task_source text not null,
  open_count integer not null default 0,
  overdue_count integer not null default 0,
  critical_count integer not null default 0,
  snapshot_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint enterprise_task_scope_check check (scope_type in ('network','region','municipality','city','national')),
  constraint enterprise_task_source_check check (task_source in ('inspections','compliance','incidents','onboarding','documents','communications','observer','billing'))
);

create table if not exists public.enterprise_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  network_id uuid references public.kindergarten_networks(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.can_access_network(target_network_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.network_manager_assignments nma
      where nma.network_id = target_network_id
        and nma.profile_id = auth.uid()
        and nma.active = true
        and (nma.ends_at is null or nma.ends_at > now())
    )
$$;

create or replace function public.can_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      left join public.gardens g on g.id = target_garden_id
      left join public.network_manager_assignments nma
        on nma.network_id = g.network_id
        and nma.profile_id = p.id
        and nma.active = true
        and (nma.ends_at is null or nma.ends_at > now())
      where p.id = auth.uid()
        and p.active = true
        and (
          p.garden_id = target_garden_id
          or (p.role = 'inspector' and g.inspector_id = p.id)
          or (p.role::text = 'network_manager' and nma.id is not null)
        )
    )
$$;

create index if not exists kindergarten_networks_status_idx on public.kindergarten_networks(status, network_type);
create index if not exists gardens_network_idx on public.gardens(network_id, region, municipality, city);
create index if not exists network_kindergartens_network_idx on public.network_kindergartens(network_id, membership_status);
create index if not exists network_kindergartens_garden_idx on public.network_kindergartens(garden_id);
create index if not exists network_manager_assignments_profile_idx on public.network_manager_assignments(profile_id, active);
create index if not exists enterprise_regions_lookup_idx on public.enterprise_regions(country, region_name, municipality, city, network_id);
create unique index if not exists network_manager_assignments_unique_idx on public.network_manager_assignments(network_id, profile_id, assignment_scope, coalesce(city, ''), coalesce(municipality, ''), coalesce(region, ''));
create unique index if not exists enterprise_regions_unique_idx on public.enterprise_regions(country, region_name, coalesce(city, ''), coalesce(municipality, ''), coalesce(network_id::text, ''));
create index if not exists enterprise_supervisor_assignments_profile_idx on public.enterprise_supervisor_assignments(profile_id, active);
create index if not exists enterprise_metrics_scope_idx on public.enterprise_operational_metrics(scope_type, snapshot_date desc);
create index if not exists enterprise_notices_scope_idx on public.enterprise_communication_notices(network_id, region_id, delivery_status, created_at desc);
create index if not exists enterprise_task_rollups_scope_idx on public.enterprise_task_rollups(scope_type, snapshot_date desc);
create index if not exists enterprise_audit_logs_network_idx on public.enterprise_audit_logs(network_id, created_at desc);

alter table public.kindergarten_networks enable row level security;
alter table public.network_kindergartens enable row level security;
alter table public.network_manager_assignments enable row level security;
alter table public.enterprise_regions enable row level security;
alter table public.enterprise_supervisor_assignments enable row level security;
alter table public.enterprise_operational_metrics enable row level security;
alter table public.enterprise_communication_notices enable row level security;
alter table public.enterprise_task_rollups enable row level security;
alter table public.enterprise_audit_logs enable row level security;

drop policy if exists "kindergarten networks scoped read" on public.kindergarten_networks;
create policy "kindergarten networks scoped read" on public.kindergarten_networks
for select using (public.is_admin() or public.can_access_network(id));
drop policy if exists "kindergarten networks admin write" on public.kindergarten_networks;
create policy "kindergarten networks admin write" on public.kindergarten_networks
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "network kindergartens scoped read" on public.network_kindergartens;
create policy "network kindergartens scoped read" on public.network_kindergartens
for select using (public.is_admin() or public.can_access_network(network_id) or public.can_access_garden(garden_id));
drop policy if exists "network kindergartens admin write" on public.network_kindergartens;
create policy "network kindergartens admin write" on public.network_kindergartens
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "network manager assignments scoped read" on public.network_manager_assignments;
create policy "network manager assignments scoped read" on public.network_manager_assignments
for select using (public.is_admin() or profile_id = auth.uid() or public.can_access_network(network_id));
drop policy if exists "network manager assignments admin write" on public.network_manager_assignments;
create policy "network manager assignments admin write" on public.network_manager_assignments
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "enterprise regions scoped read" on public.enterprise_regions;
create policy "enterprise regions scoped read" on public.enterprise_regions
for select using (public.is_admin() or (network_id is not null and public.can_access_network(network_id)));
drop policy if exists "enterprise regions admin write" on public.enterprise_regions;
create policy "enterprise regions admin write" on public.enterprise_regions
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "enterprise supervisors scoped read" on public.enterprise_supervisor_assignments;
create policy "enterprise supervisors scoped read" on public.enterprise_supervisor_assignments
for select using (
  public.is_admin()
  or profile_id = auth.uid()
  or (network_id is not null and public.can_access_network(network_id))
  or (garden_id is not null and public.can_access_garden(garden_id))
);
drop policy if exists "enterprise supervisors admin write" on public.enterprise_supervisor_assignments;
create policy "enterprise supervisors admin write" on public.enterprise_supervisor_assignments
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "enterprise metrics scoped read" on public.enterprise_operational_metrics;
create policy "enterprise metrics scoped read" on public.enterprise_operational_metrics
for select using (public.is_admin() or (network_id is not null and public.can_access_network(network_id)));
drop policy if exists "enterprise metrics admin write" on public.enterprise_operational_metrics;
create policy "enterprise metrics admin write" on public.enterprise_operational_metrics
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "enterprise notices scoped read" on public.enterprise_communication_notices;
create policy "enterprise notices scoped read" on public.enterprise_communication_notices
for select using (public.is_admin() or (network_id is not null and public.can_access_network(network_id)));
drop policy if exists "enterprise notices scoped write" on public.enterprise_communication_notices;
create policy "enterprise notices scoped write" on public.enterprise_communication_notices
for all using (public.is_admin() or (network_id is not null and public.can_access_network(network_id)))
with check (public.is_admin() or (network_id is not null and public.can_access_network(network_id)));

drop policy if exists "enterprise task rollups scoped read" on public.enterprise_task_rollups;
create policy "enterprise task rollups scoped read" on public.enterprise_task_rollups
for select using (public.is_admin() or (network_id is not null and public.can_access_network(network_id)));
drop policy if exists "enterprise task rollups admin write" on public.enterprise_task_rollups;
create policy "enterprise task rollups admin write" on public.enterprise_task_rollups
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "enterprise audit logs scoped read" on public.enterprise_audit_logs;
create policy "enterprise audit logs scoped read" on public.enterprise_audit_logs
for select using (
  public.is_admin()
  or (network_id is not null and public.can_access_network(network_id))
  or actor_id = auth.uid()
);
drop policy if exists "enterprise audit logs insert" on public.enterprise_audit_logs;
create policy "enterprise audit logs insert" on public.enterprise_audit_logs
for insert with check (public.is_admin() or actor_id = auth.uid());

insert into public.enterprise_regions (country, region_name, municipality, city, status, metadata)
select
  source.country,
  source.region_name,
  source.municipality,
  source.city,
  'active',
  jsonb_build_object('seeded_from', 'gardens')
from (
  select distinct
    'ישראל'::text as country,
    coalesce(nullif(g.region, ''), 'לא משויך') as region_name,
    nullif(g.municipality, '') as municipality,
    nullif(g.city, '') as city
  from public.gardens g
  where coalesce(g.region, g.city, g.municipality) is not null
) source
where source.region_name is not null
  and not exists (
    select 1
    from public.enterprise_regions er
    where er.country = source.country
      and er.region_name = source.region_name
      and coalesce(er.city, '') = coalesce(source.city, '')
      and coalesce(er.municipality, '') = coalesce(source.municipality, '')
      and er.network_id is null
  );

insert into public.network_kindergartens (network_id, garden_id, membership_status, membership_role, metadata)
select
  g.network_id,
  g.id,
  'active',
  'member',
  jsonb_build_object('source', 'gardens.network_id')
from public.gardens g
where g.network_id is not null
on conflict (network_id, garden_id) do update set
  membership_status = 'active',
  updated_at = now();

comment on table public.kindergarten_networks is 'Enterprise networks, franchises, educational groups and municipal kindergarten groups.';
comment on table public.network_manager_assignments is 'Scoped network manager access; does not grant access outside assigned networks.';
comment on table public.enterprise_operational_metrics is 'Network, regional, municipal and national rollup metrics for enterprise operations.';
comment on table public.enterprise_audit_logs is 'Enterprise organizational change and permission audit log.';
