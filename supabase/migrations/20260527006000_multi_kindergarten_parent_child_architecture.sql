create table if not exists public.parent_kindergarten_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.parents(id) on delete cascade,
  parent_profile_id uuid references public.profiles(id) on delete cascade,
  garden_id  uuid not null references public.gardens(id) on delete cascade,
  kindergarten_id uuid generated always as (garden_id) stored,
  status text not null default 'active' check (status in ('pending', 'active', 'rejected', 'archived')),
  source text not null default 'legacy_backfill',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  notes text,
  is_demo boolean not null default false,
  demo_batch_id text,
  unique(parent_profile_id, garden_id)
);

create or replace function public.can_parent_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_garden_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.active = true
        and p.role = 'parent'
        and (
          p.garden_id = target_garden_id
          or exists (
            select 1
            from public.parents pr
            where (pr.profile_id = p.id or pr.user_id = p.id)
              and pr.garden_id = target_garden_id
          )
          or exists (
            select 1
            from public.parent_kindergarten_links pkl
            where pkl.parent_profile_id = p.id
              and pkl.garden_id = target_garden_id
              and pkl.status in ('pending', 'active')
          )
          or exists (
            select 1
            from public.children c
            join public.parents pr on pr.id = c.primary_parent_id
            where (pr.profile_id = p.id or pr.user_id = p.id)
              and c.garden_id = target_garden_id
          )
        )
    )
$$;

create index if not exists idx_parent_kindergarten_links_profile on public.parent_kindergarten_links(parent_profile_id, status);
create index if not exists idx_parent_kindergarten_links_parent on public.parent_kindergarten_links(parent_id, status);
create index if not exists idx_parent_kindergarten_links_garden on public.parent_kindergarten_links(garden_id, status);

create table if not exists public.permanent_child_files (
  id uuid primary key default gen_random_uuid(),
  primary_parent_profile_id uuid references public.profiles(id) on delete set null,
  primary_parent_id uuid references public.parents(id) on delete set null,
  full_name text not null,
  birth_date date,
  identity_number text,
  photo_url text,
  face_image_url text,
  hmo text,
  allergies text,
  sensitivities text,
  regular_medications text,
  medical_notes text,
  emergency_phone text,
  pickup_authorized jsonb not null default '[]'::jsonb,
  important_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create index if not exists idx_permanent_child_files_parent_profile on public.permanent_child_files(primary_parent_profile_id);
create index if not exists idx_permanent_child_files_identity on public.permanent_child_files(identity_number);

alter table public.children
  add column if not exists permanent_child_file_id uuid references public.permanent_child_files(id) on delete set null,
  add column if not exists failure_reason text,
  add column if not exists failed_at timestamptz,
  add column if not exists retry_required boolean not null default false,
  add column if not exists parent_notified boolean not null default false;

create table if not exists public.child_kindergarten_enrollments (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references public.children(id) on delete cascade,
  permanent_child_file_id uuid references public.permanent_child_files(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  kindergarten_id uuid generated always as (garden_id) stored,
  status text not null default 'pending_parent_completion' check (status in ('pending_parent_completion', 'pending_manager_approval', 'active', 'completed', 'transferred', 'archived', 'rejected')),
  start_date date,
  end_date date,
  age_group_id uuid references public.kindergarten_fee_groups(id) on delete set null,
  classroom_name text,
  manager_approved_at timestamptz,
  manager_approved_by uuid references public.profiles(id) on delete set null,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text,
  unique(child_id, garden_id)
);

create index if not exists idx_child_enrollments_child on public.child_kindergarten_enrollments(child_id, status);
create index if not exists idx_child_enrollments_file on public.child_kindergarten_enrollments(permanent_child_file_id, status);
create index if not exists idx_child_enrollments_garden on public.child_kindergarten_enrollments(garden_id, status);

create table if not exists public.child_timeline_events (
  id uuid primary key default gen_random_uuid(),
  child_id uuid references public.children(id) on delete cascade,
  permanent_child_file_id uuid references public.permanent_child_files(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'parent_kindergarten_links' and column_name = 'demo_batch_id' and data_type = 'uuid') then
    alter table public.parent_kindergarten_links alter column demo_batch_id type text using demo_batch_id::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'permanent_child_files' and column_name = 'demo_batch_id' and data_type = 'uuid') then
    alter table public.permanent_child_files alter column demo_batch_id type text using demo_batch_id::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'child_kindergarten_enrollments' and column_name = 'demo_batch_id' and data_type = 'uuid') then
    alter table public.child_kindergarten_enrollments alter column demo_batch_id type text using demo_batch_id::text;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'child_timeline_events' and column_name = 'demo_batch_id' and data_type = 'uuid') then
    alter table public.child_timeline_events alter column demo_batch_id type text using demo_batch_id::text;
  end if;
end $$;

create index if not exists idx_child_timeline_child on public.child_timeline_events(child_id, created_at desc);
create index if not exists idx_child_timeline_file on public.child_timeline_events(permanent_child_file_id, created_at desc);
create index if not exists idx_child_timeline_garden on public.child_timeline_events(garden_id, created_at desc);

alter table public.kindergarten_fee_groups
  add column if not exists capacity integer,
  add column if not exists show_price_public boolean not null default false,
  add column if not exists recommended_monthly_fee numeric(10,2),
  add column if not exists market_average_fee numeric(10,2),
  add column if not exists recommendation_updated_at timestamptz;

alter table public.child_payment_history
  add column if not exists failure_reason text,
  add column if not exists failed_at timestamptz,
  add column if not exists retry_required boolean not null default false,
  add column if not exists parent_notified boolean not null default false;

insert into public.parent_kindergarten_links (parent_id, parent_profile_id, garden_id, status, source, approved_at, is_demo, demo_batch_id)
select p.id, coalesce(p.profile_id, p.user_id), p.garden_id, 'active', 'legacy_parent_garden_id', now(), coalesce(p.is_demo, false), p.demo_batch_id::text
from public.parents p
where p.garden_id is not null
  and coalesce(p.profile_id, p.user_id) is not null
on conflict (parent_profile_id, garden_id) do nothing;

insert into public.permanent_child_files (
  primary_parent_profile_id,
  primary_parent_id,
  full_name,
  birth_date,
  identity_number,
  photo_url,
  face_image_url,
  hmo,
  allergies,
  sensitivities,
  regular_medications,
  medical_notes,
  emergency_phone,
  pickup_authorized,
  created_at,
  updated_at,
  is_demo,
  demo_batch_id
)
select
  coalesce(p.profile_id, p.user_id),
  c.primary_parent_id,
  c.full_name,
  c.birth_date,
  c.identity_number,
  c.photo_url,
  c.face_image_url,
  c.hmo,
  c.allergies,
  c.sensitivities,
  c.regular_medications,
  c.medical_notes,
  c.emergency_phone,
  coalesce(c.pickup_authorized, '[]'::jsonb),
  c.created_at,
  c.updated_at,
  coalesce(c.is_demo, false),
  c.demo_batch_id::text
from public.children c
left join public.parents p on p.id = c.primary_parent_id
where c.permanent_child_file_id is null;

update public.children c
set permanent_child_file_id = f.id
from public.permanent_child_files f
where c.permanent_child_file_id is null
  and f.primary_parent_id = c.primary_parent_id
  and f.full_name = c.full_name
  and (f.birth_date is not distinct from c.birth_date)
  and (f.identity_number is not distinct from c.identity_number);

insert into public.child_kindergarten_enrollments (
  child_id,
  permanent_child_file_id,
  garden_id,
  status,
  start_date,
  age_group_id,
  classroom_name,
  manager_approved_at,
  created_at,
  updated_at,
  is_demo,
  demo_batch_id
)
select
  c.id,
  c.permanent_child_file_id,
  c.garden_id,
  case
    when c.status in ('active', 'approved') then 'active'
    when c.status = 'pending_manager_approval' then 'pending_manager_approval'
    when c.status = 'rejected' then 'rejected'
    else 'pending_parent_completion'
  end,
  c.created_at::date,
  c.payment_group_id,
  coalesce(c.classroom, c.age_group),
  case when c.status in ('active', 'approved') then c.updated_at else null end,
  c.created_at,
  c.updated_at,
  coalesce(c.is_demo, false),
  c.demo_batch_id::text
from public.children c
where c.garden_id is not null
on conflict (child_id, garden_id) do nothing;

insert into public.child_timeline_events (child_id, permanent_child_file_id, garden_id, event_type, title, description, created_at, is_demo, demo_batch_id)
select c.id, c.permanent_child_file_id, c.garden_id, 'created', 'נפתח תיק ילד קבוע', 'נוצר מתוך נתוני הילד הקיימים במערכת.', c.created_at, coalesce(c.is_demo, false), c.demo_batch_id::text
from public.children c
where c.permanent_child_file_id is not null
on conflict do nothing;

alter table public.parent_kindergarten_links enable row level security;
alter table public.permanent_child_files enable row level security;
alter table public.child_kindergarten_enrollments enable row level security;
alter table public.child_timeline_events enable row level security;

drop policy if exists "parent kindergarten links scoped read" on public.parent_kindergarten_links;
create policy "parent kindergarten links scoped read" on public.parent_kindergarten_links
  for select using (public.is_admin() or public.can_access_garden(garden_id) or parent_profile_id = auth.uid());

drop policy if exists "parent kindergarten links scoped write" on public.parent_kindergarten_links;
create policy "parent kindergarten links scoped write" on public.parent_kindergarten_links
  for all using (public.is_admin() or public.can_access_garden(garden_id))
  with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "permanent child files scoped read" on public.permanent_child_files;
create policy "permanent child files scoped read" on public.permanent_child_files
  for select using (public.is_admin() or primary_parent_profile_id = auth.uid() or exists (
    select 1 from public.child_kindergarten_enrollments e
    where e.permanent_child_file_id = permanent_child_files.id
      and public.can_access_garden(e.garden_id)
  ));

drop policy if exists "permanent child files parent update" on public.permanent_child_files;
create policy "permanent child files parent update" on public.permanent_child_files
  for all using (public.is_admin() or primary_parent_profile_id = auth.uid())
  with check (public.is_admin() or primary_parent_profile_id = auth.uid());

drop policy if exists "child enrollments scoped read" on public.child_kindergarten_enrollments;
create policy "child enrollments scoped read" on public.child_kindergarten_enrollments
  for select using (public.is_admin() or public.can_access_garden(garden_id) or exists (
    select 1 from public.permanent_child_files f
    where f.id = child_kindergarten_enrollments.permanent_child_file_id
      and f.primary_parent_profile_id = auth.uid()
  ));

drop policy if exists "child enrollments scoped write" on public.child_kindergarten_enrollments;
create policy "child enrollments scoped write" on public.child_kindergarten_enrollments
  for all using (public.is_admin() or public.can_access_garden(garden_id) or exists (
    select 1 from public.permanent_child_files f
    where f.id = child_kindergarten_enrollments.permanent_child_file_id
      and f.primary_parent_profile_id = auth.uid()
  ))
  with check (public.is_admin() or public.can_access_garden(garden_id) or exists (
    select 1 from public.permanent_child_files f
    where f.id = child_kindergarten_enrollments.permanent_child_file_id
      and f.primary_parent_profile_id = auth.uid()
  ));

drop policy if exists "child timeline scoped read" on public.child_timeline_events;
create policy "child timeline scoped read" on public.child_timeline_events
  for select using (public.is_admin() or public.can_access_garden(garden_id) or exists (
    select 1 from public.permanent_child_files f
    where f.id = child_timeline_events.permanent_child_file_id
      and f.primary_parent_profile_id = auth.uid()
  ));

drop policy if exists "child timeline scoped insert" on public.child_timeline_events;
create policy "child timeline scoped insert" on public.child_timeline_events
  for insert with check (public.is_admin() or public.can_access_garden(garden_id) or actor_id = auth.uid());

notify pgrst, 'reload schema';
