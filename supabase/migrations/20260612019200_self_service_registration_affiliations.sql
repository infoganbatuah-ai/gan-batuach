-- PHASE 190A: Self-service registration and affiliation requests.
-- Security stance: self-registered users remain profile.active=false until approved.
-- Existing invitation flows are not changed.

alter table public.profiles
  add column if not exists self_service_status text not null default 'active'
    check (self_service_status in ('registered','profile_incomplete','pending_affiliation','pending_approval','active','rejected','suspended')),
  add column if not exists self_service_role text
    check (self_service_role in ('parent','staff_candidate','inspector_candidate','kindergarten_manager')),
  add column if not exists self_service_registered_at timestamptz,
  add column if not exists self_service_approved_at timestamptz,
  add column if not exists self_service_approved_by uuid references public.profiles(id) on delete set null;

create table if not exists public.self_service_user_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  requested_role text not null check (requested_role in ('parent','staff_candidate','inspector_candidate','kindergarten_manager')),
  status text not null default 'registered'
    check (status in ('registered','profile_incomplete','pending_affiliation','pending_approval','active','rejected','suspended')),
  full_name text,
  phone text,
  email text,
  city text,
  area text,
  identity_number_hash text,
  duplicate_flags jsonb not null default '[]'::jsonb,
  verification_status jsonb not null default '{"email":"pending","phone":"pending","mfa":"not_required"}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.permanent_child_files
  add column if not exists child_first_name text,
  add column if not exists child_last_name text,
  add column if not exists gender text,
  add column if not exists address text,
  add column if not exists father_details jsonb not null default '{}'::jsonb,
  add column if not exists mother_details jsonb not null default '{}'::jsonb,
  add column if not exists emergency_contacts jsonb not null default '[]'::jsonb,
  add column if not exists source text not null default 'existing',
  add column if not exists owner_status text not null default 'active'
    check (owner_status in ('draft','active','submitted','archived')),
  add column if not exists duplicate_flags jsonb not null default '[]'::jsonb;

create table if not exists public.kindergarten_enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  child_profile_id uuid not null references public.permanent_child_files(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  requested_age_group text,
  requested_class_id uuid references public.kindergarten_fee_groups(id) on delete set null,
  published_price_snapshot numeric(10,2),
  parent_message text,
  status text not null default 'submitted'
    check (status in ('draft','submitted','under_review','more_information_requested','approved_pending_payment','approved','rejected','cancelled','expired')),
  manager_decision text,
  decision_reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  payment_required boolean not null default true,
  payment_status text not null default 'not_requested'
    check (payment_status in ('not_requested','pending','paid','failed','waived')),
  activated_at timestamptz,
  activated_child_id uuid references public.children(id) on delete set null,
  duplicate_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_id, child_profile_id, garden_id)
);

create table if not exists public.kindergarten_staff_openings (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  role_needed text not null,
  age_group text,
  description text,
  requirements text,
  employment_type text,
  active_status text not null default 'published'
    check (active_status in ('draft','published','paused','closed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_candidate_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  identity_number_hash text,
  profile_photo_url text,
  date_of_birth date,
  previous_kindergarten_experience boolean,
  previous_kindergarten_name text,
  work_experience text,
  document_status jsonb not null default '{}'::jsonb,
  duplicate_flags jsonb not null default '[]'::jsonb,
  status text not null default 'profile_incomplete'
    check (status in ('registered','profile_incomplete','pending_affiliation','pending_approval','active','rejected','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_job_applications (
  id uuid primary key default gen_random_uuid(),
  staff_candidate_id uuid not null references public.profiles(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  opening_id uuid references public.kindergarten_staff_openings(id) on delete set null,
  requested_role text,
  status text not null default 'submitted'
    check (status in ('draft','submitted','under_review','more_information_requested','approved_pending_completion','approved','rejected','cancelled')),
  manager_decision text,
  decision_reason text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  activated_at timestamptz,
  activated_staff_id uuid references public.staff(id) on delete set null,
  duplicate_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_candidate_id, garden_id, opening_id)
);

create table if not exists public.inspector_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  city text,
  preferred_regions text[] not null default '{}',
  experience_summary text,
  documents jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','submitted','under_review','more_information_requested','approved_pending_assignment','approved','rejected','suspended')),
  admin_decision text,
  decision_reason text,
  submitted_at timestamptz,
  decided_at timestamptz,
  activated_at timestamptz,
  duplicate_flags jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_id)
);

create table if not exists public.user_affiliation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('kindergarten','platform','region')),
  target_id uuid,
  request_type text not null check (request_type in ('parent_to_kindergarten','staff_to_kindergarten','inspector_to_platform','inspector_to_region','inspector_to_kindergarten')),
  status text not null default 'submitted'
    check (status in ('draft','submitted','under_review','more_information_requested','approved_pending_payment','approved','rejected','cancelled','expired')),
  decision_by uuid references public.profiles(id) on delete set null,
  decision_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  audit_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_enrollment_requests_parent on public.kindergarten_enrollment_requests(parent_id, status);
create index if not exists idx_enrollment_requests_garden on public.kindergarten_enrollment_requests(garden_id, status);
create index if not exists idx_staff_openings_garden on public.kindergarten_staff_openings(garden_id, active_status);
create index if not exists idx_staff_applications_candidate on public.staff_job_applications(staff_candidate_id, status);
create index if not exists idx_staff_applications_garden on public.staff_job_applications(garden_id, status);
create index if not exists idx_inspector_applications_profile on public.inspector_applications(profile_id, status);
create index if not exists idx_affiliation_requests_requester on public.user_affiliation_requests(requester_id, status);
create index if not exists idx_affiliation_requests_target on public.user_affiliation_requests(target_type, target_id, request_type, status);

alter table public.self_service_user_profiles enable row level security;
alter table public.kindergarten_enrollment_requests enable row level security;
alter table public.kindergarten_staff_openings enable row level security;
alter table public.staff_candidate_profiles enable row level security;
alter table public.staff_job_applications enable row level security;
alter table public.inspector_applications enable row level security;
alter table public.user_affiliation_requests enable row level security;

drop policy if exists "self service profile own read" on public.self_service_user_profiles;
create policy "self service profile own read" on public.self_service_user_profiles
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "self service profile own insert" on public.self_service_user_profiles;
create policy "self service profile own insert" on public.self_service_user_profiles
  for insert with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "self service profile own update" on public.self_service_user_profiles;
create policy "self service profile own update" on public.self_service_user_profiles
  for update using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "enrollment requests scoped read" on public.kindergarten_enrollment_requests;
create policy "enrollment requests scoped read" on public.kindergarten_enrollment_requests
  for select using (public.is_admin() or parent_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "enrollment requests parent insert" on public.kindergarten_enrollment_requests;
create policy "enrollment requests parent insert" on public.kindergarten_enrollment_requests
  for insert with check (
    parent_id = auth.uid()
    and exists (
      select 1 from public.permanent_child_files f
      where f.id = child_profile_id and f.primary_parent_profile_id = auth.uid()
    )
  );

drop policy if exists "enrollment requests scoped update" on public.kindergarten_enrollment_requests;
create policy "enrollment requests scoped update" on public.kindergarten_enrollment_requests
  for update using (public.is_admin() or public.can_access_garden(garden_id) or parent_id = auth.uid())
  with check (public.is_admin() or public.can_access_garden(garden_id) or parent_id = auth.uid());

drop policy if exists "staff openings public safe read" on public.kindergarten_staff_openings;
create policy "staff openings public safe read" on public.kindergarten_staff_openings
  for select using (active_status = 'published' or public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "staff openings manager write" on public.kindergarten_staff_openings;
create policy "staff openings manager write" on public.kindergarten_staff_openings
  for all using (public.is_admin() or public.can_access_garden(garden_id))
  with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "staff candidate own read" on public.staff_candidate_profiles;
create policy "staff candidate own read" on public.staff_candidate_profiles
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "staff candidate own write" on public.staff_candidate_profiles;
create policy "staff candidate own write" on public.staff_candidate_profiles
  for all using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "staff applications scoped read" on public.staff_job_applications;
create policy "staff applications scoped read" on public.staff_job_applications
  for select using (public.is_admin() or staff_candidate_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "staff applications candidate insert" on public.staff_job_applications;
create policy "staff applications candidate insert" on public.staff_job_applications
  for insert with check (staff_candidate_id = auth.uid());

drop policy if exists "staff applications scoped update" on public.staff_job_applications;
create policy "staff applications scoped update" on public.staff_job_applications
  for update using (public.is_admin() or staff_candidate_id = auth.uid() or public.can_access_garden(garden_id))
  with check (public.is_admin() or staff_candidate_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "inspector applications scoped read" on public.inspector_applications;
create policy "inspector applications scoped read" on public.inspector_applications
  for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "inspector applications own insert" on public.inspector_applications;
create policy "inspector applications own insert" on public.inspector_applications
  for insert with check (profile_id = auth.uid());

drop policy if exists "inspector applications scoped update" on public.inspector_applications;
create policy "inspector applications scoped update" on public.inspector_applications
  for update using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

drop policy if exists "affiliation requests scoped read" on public.user_affiliation_requests;
create policy "affiliation requests scoped read" on public.user_affiliation_requests
  for select using (
    requester_id = auth.uid()
    or public.is_admin()
    or (target_type = 'kindergarten' and target_id is not null and public.can_access_garden(target_id))
  );

drop policy if exists "affiliation requests own insert" on public.user_affiliation_requests;
create policy "affiliation requests own insert" on public.user_affiliation_requests
  for insert with check (requester_id = auth.uid());

drop policy if exists "affiliation requests scoped update" on public.user_affiliation_requests;
create policy "affiliation requests scoped update" on public.user_affiliation_requests
  for update using (
    requester_id = auth.uid()
    or public.is_admin()
    or (target_type = 'kindergarten' and target_id is not null and public.can_access_garden(target_id))
  )
  with check (
    requester_id = auth.uid()
    or public.is_admin()
    or (target_type = 'kindergarten' and target_id is not null and public.can_access_garden(target_id))
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'self_service_user_profiles',
    'kindergarten_enrollment_requests',
    'kindergarten_staff_openings',
    'staff_candidate_profiles',
    'staff_job_applications',
    'inspector_applications',
    'user_affiliation_requests'
  ]
  loop
    execute format('drop trigger if exists touch_%I on public.%I', table_name, table_name);
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', table_name, table_name);
  end loop;
end $$;

comment on table public.kindergarten_enrollment_requests is 'Self-service parent enrollment requests. Does not grant kindergarten access until manager approval and activation.';
comment on table public.staff_job_applications is 'Self-service staff applications. Does not grant staff access until manager approval.';
comment on table public.inspector_applications is 'Self-service inspector applications. Does not grant kindergarten access until admin approval and assignment.';

notify pgrst, 'reload schema';
