-- Identity uniqueness support and permanent staff employment history.

alter table public.profiles
  add column if not exists identity_number text;

alter table public.leads
  add column if not exists parent_identity_number text,
  add column if not exists child_identity_number text,
  add column if not exists manager_identity_number text,
  add column if not exists owner_identity_number text;

alter table public.parents
  add column if not exists photo_url text;

alter table public.staff
  add column if not exists is_demo boolean not null default false,
  add column if not exists demo_batch_id text;

create table if not exists public.staff_permanent_files (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  full_name text not null,
  identity_number text,
  phone text,
  email text,
  profile_photo_url text,
  certification_notes text,
  document_summary jsonb not null default '{}'::jsonb,
  notes text,
  is_demo boolean not null default false,
  demo_batch_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_kindergarten_employments (
  id uuid primary key default gen_random_uuid(),
  staff_file_id uuid not null references public.staff_permanent_files(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  status text not null default 'active',
  role_title text,
  class_group text,
  start_date date,
  end_date date,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_timeline_events (
  id uuid primary key default gen_random_uuid(),
  staff_file_id uuid references public.staff_permanent_files(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from public.children where identity_number is not null and btrim(identity_number) <> '' group by identity_number having count(*) > 1) then
    create unique index if not exists idx_children_identity_unique on public.children (identity_number) where identity_number is not null and btrim(identity_number) <> '';
  end if;
  if not exists (select 1 from public.parents where identity_number is not null and btrim(identity_number) <> '' group by identity_number having count(*) > 1) then
    create unique index if not exists idx_parents_identity_unique on public.parents (identity_number) where identity_number is not null and btrim(identity_number) <> '';
  end if;
  if not exists (select 1 from public.staff where identity_number is not null and btrim(identity_number) <> '' group by identity_number having count(*) > 1) then
    create unique index if not exists idx_staff_identity_unique on public.staff (identity_number) where identity_number is not null and btrim(identity_number) <> '';
  end if;
  if not exists (select 1 from public.profiles where identity_number is not null and btrim(identity_number) <> '' group by identity_number having count(*) > 1) then
    create unique index if not exists idx_profiles_identity_unique on public.profiles (identity_number) where identity_number is not null and btrim(identity_number) <> '';
  end if;
  if not exists (select 1 from public.staff_permanent_files where identity_number is not null and btrim(identity_number) <> '' group by identity_number having count(*) > 1) then
    create unique index if not exists idx_staff_permanent_identity_unique on public.staff_permanent_files (identity_number) where identity_number is not null and btrim(identity_number) <> '';
  end if;
end $$;

insert into public.staff_permanent_files (
  profile_id,
  full_name,
  identity_number,
  phone,
  email,
  profile_photo_url,
  notes,
  is_demo,
  demo_batch_id
)
select
  s.profile_id,
  s.full_name,
  s.identity_number,
  s.phone,
  s.email,
  s.profile_photo_url,
  s.notes,
  coalesce(s.is_demo, false),
  s.demo_batch_id::text
from public.staff s
where s.identity_number is not null
  and btrim(s.identity_number) <> ''
  and not exists (
    select 1
    from public.staff_permanent_files f
    where f.identity_number = s.identity_number
  );

insert into public.staff_kindergarten_employments (
  staff_file_id,
  staff_id,
  profile_id,
  garden_id,
  status,
  role_title,
  class_group,
  start_date,
  approved_at,
  notes
)
select
  f.id,
  s.id,
  s.profile_id,
  s.garden_id,
  case when s.approved_to_work then 'active' else 'pending_approval' end,
  s.role_title,
  s.class_group,
  s.start_date,
  s.manager_approved_at,
  s.notes
from public.staff s
join public.staff_permanent_files f on f.identity_number = s.identity_number
where not exists (
  select 1
  from public.staff_kindergarten_employments e
  where e.staff_file_id = f.id
    and e.staff_id is not distinct from s.id
    and e.garden_id is not distinct from s.garden_id
);

notify pgrst, 'reload schema';
