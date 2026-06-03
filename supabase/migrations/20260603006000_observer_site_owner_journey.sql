create table if not exists public.observer_site_memberships (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'owner',
  active boolean not null default true,
  invited_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_site_memberships_role_check check (member_role in ('owner','admin','operator','viewer','billing')),
  unique(observer_site_id, profile_id)
);

create table if not exists public.observer_site_onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'draft',
  site_name text,
  site_type text not null default 'home',
  owner_type text not null default 'home_owner',
  address text,
  timezone text not null default 'Asia/Jerusalem',
  monitoring_schedule jsonb not null default '{}'::jsonb,
  camera_count_estimate integer,
  camera_system_types jsonb not null default '[]'::jsonb,
  desired_package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  preferred_channels jsonb not null default '["in_app"]'::jsonb,
  notes text,
  submitted_at timestamptz,
  activated_observer_site_id uuid references public.observer_sites(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_site_onboarding_status_check check (status in ('draft','submitted','ready_for_review','activated','cancelled')),
  constraint observer_site_onboarding_site_type_check check (site_type in ('home','office','business','warehouse','store','parking_lot','custom')),
  constraint observer_site_onboarding_owner_type_check check (owner_type in ('home_owner','business_owner','warehouse_owner','office_owner','enterprise_customer','custom'))
);

create index if not exists observer_site_memberships_profile_idx on public.observer_site_memberships(profile_id, active);
create index if not exists observer_site_memberships_site_idx on public.observer_site_memberships(observer_site_id, active);
create index if not exists observer_site_onboarding_profile_idx on public.observer_site_onboarding_drafts(profile_id, status, created_at desc);
create index if not exists observer_site_onboarding_status_idx on public.observer_site_onboarding_drafts(status, created_at desc);

alter table public.observer_site_memberships enable row level security;
alter table public.observer_site_onboarding_drafts enable row level security;

drop policy if exists "observer site memberships admin all" on public.observer_site_memberships;
create policy "observer site memberships admin all" on public.observer_site_memberships
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer site memberships own read" on public.observer_site_memberships;
create policy "observer site memberships own read" on public.observer_site_memberships
for select using (
  public.is_admin()
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_site_memberships.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin')
  )
);

drop policy if exists "observer onboarding drafts admin all" on public.observer_site_onboarding_drafts;
create policy "observer onboarding drafts admin all" on public.observer_site_onboarding_drafts
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "observer onboarding drafts owner all" on public.observer_site_onboarding_drafts;
create policy "observer onboarding drafts owner all" on public.observer_site_onboarding_drafts
for all using (profile_id = auth.uid())
with check (profile_id = auth.uid());

drop policy if exists "observer sites membership read" on public.observer_sites;
create policy "observer sites membership read" on public.observer_sites
for select using (
  public.is_admin()
  or owner_profile_id = auth.uid()
  or exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = observer_sites.id
      and m.profile_id = auth.uid()
      and m.active = true
  )
);

insert into public.observer_site_memberships (
  observer_site_id,
  profile_id,
  member_role,
  active,
  metadata
)
select
  s.id,
  s.owner_profile_id,
  'owner',
  true,
  jsonb_build_object('source', 'observer_site_owner_journey_migration')
from public.observer_sites s
where s.owner_profile_id is not null
  and not exists (
    select 1
    from public.observer_site_memberships m
    where m.observer_site_id = s.id
      and m.profile_id = s.owner_profile_id
  );

comment on table public.observer_site_memberships is 'Future standalone Digital Observer site owner/member relationship. Does not change Gan Batuach role model.';
comment on table public.observer_site_onboarding_drafts is 'Future public Digital Observer onboarding draft model for homes/businesses/warehouses/offices. Mock/readiness only.';

notify pgrst, 'reload schema';
