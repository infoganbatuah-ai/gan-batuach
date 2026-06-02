create table if not exists public.observer_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site_type text not null default 'kindergarten',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  address text,
  timezone text not null default 'Asia/Jerusalem',
  active boolean not null default true,
  monitoring_enabled boolean not null default false,
  camera_limit integer,
  monitoring_hours jsonb not null default '{}'::jsonb,
  event_retention_days integer not null default 30,
  ai_features jsonb not null default '{}'::jsonb,
  storage_limit_mb integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_sites_type_check check (site_type in ('kindergarten','home','office','business','warehouse','store','parking_lot','custom')),
  constraint observer_sites_kindergarten_unique unique (garden_id)
);

alter table public.camera_streams
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete set null;

alter table public.camera_zones
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete cascade;

alter table public.ai_camera_events
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete cascade,
  add column if not exists site_type text;

alter table public.observer_jobs
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete cascade;

alter table public.observer_rules
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete cascade;

alter table public.observer_job_logs
  add column if not exists observer_site_id uuid references public.observer_sites(id) on delete cascade;

alter table public.camera_zones
  drop constraint if exists camera_zones_type_check;

alter table public.camera_zones
  add constraint camera_zones_type_check check (zone_type in (
    'entrance',
    'exit',
    'lobby',
    'office',
    'classroom',
    'playground',
    'storage',
    'parking',
    'hallway',
    'restricted_area',
    'sleeping_area',
    'bathroom_entrance',
    'kitchen',
    'yard',
    'staff_only',
    'custom'
  ));

create index if not exists idx_observer_sites_type_active on public.observer_sites(site_type, active);
create index if not exists idx_observer_sites_owner on public.observer_sites(owner_profile_id, active);
create index if not exists idx_camera_streams_observer_site on public.camera_streams(observer_site_id, status);
create index if not exists idx_camera_zones_observer_site on public.camera_zones(observer_site_id, zone_type, is_active);
create index if not exists idx_ai_camera_events_observer_site on public.ai_camera_events(observer_site_id, status, created_at desc);
create index if not exists idx_observer_jobs_observer_site on public.observer_jobs(observer_site_id, status, created_at desc);

insert into public.observer_sites (
  name,
  site_type,
  owner_profile_id,
  garden_id,
  address,
  timezone,
  active,
  monitoring_enabled,
  camera_limit,
  event_retention_days,
  ai_features,
  metadata
)
select
  g.name,
  'kindergarten',
  coalesce(g.owner_profile_id, g.manager_id),
  g.id,
  concat_ws(', ', nullif(g.address, ''), nullif(g.city, '')),
  'Asia/Jerusalem',
  coalesce(g.status::text, 'active') not in ('archived', 'deleted', 'suspended'),
  false,
  null,
  30,
  '{"kindergarten_observer":true,"children_privacy_required":true}'::jsonb,
  jsonb_build_object('source', 'gan_batuach_kindergarten', 'created_by_migration', true)
from public.gardens g
where not exists (
  select 1 from public.observer_sites s
  where s.garden_id = g.id
);

update public.camera_streams c
set observer_site_id = s.id
from public.observer_sites s
where c.garden_id = s.garden_id
  and c.observer_site_id is null;

update public.camera_zones z
set observer_site_id = s.id
from public.observer_sites s
where z.kindergarten_id = s.garden_id
  and z.observer_site_id is null;

update public.ai_camera_events e
set observer_site_id = s.id,
    site_type = coalesce(e.site_type, s.site_type),
    metadata = coalesce(e.metadata, '{}'::jsonb) || jsonb_build_object('observer_site_ready', true, 'site_type', s.site_type)
from public.observer_sites s
where e.kindergarten_id = s.garden_id
  and e.observer_site_id is null;

update public.observer_jobs j
set observer_site_id = s.id
from public.observer_sites s
where j.kindergarten_id = s.garden_id
  and j.observer_site_id is null;

update public.observer_rules r
set observer_site_id = s.id
from public.observer_sites s
where r.kindergarten_id = s.garden_id
  and r.observer_site_id is null;

update public.observer_job_logs l
set observer_site_id = s.id
from public.observer_sites s
where l.kindergarten_id = s.garden_id
  and l.observer_site_id is null;

alter table public.observer_sites enable row level security;

drop policy if exists "observer sites admin read write" on public.observer_sites;
create policy "observer sites admin read write" on public.observer_sites
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer sites owner read" on public.observer_sites;
create policy "observer sites owner read" on public.observer_sites
for select using (
  public.is_admin()
  or owner_profile_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

comment on table public.observer_sites is 'Generic Digital Observer site abstraction. Kindergarten remains primary, future sites can be homes/offices/businesses/warehouses/stores/parking lots.';
comment on column public.observer_sites.monitoring_hours is 'Future monitoring schedule by site. No billing or monitoring daemon in this phase.';
comment on column public.observer_sites.ai_features is 'Future observer subscription feature flags. Does not enable real AI by itself.';
comment on column public.ai_camera_events.observer_site_id is 'Generic site link for future standalone Digital Observer product. Kindergarten_id remains for Gan Batuach compatibility.';

notify pgrst, 'reload schema';
