create table if not exists public.child_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid references public.profiles(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  target_child_id uuid references public.children(id) on delete set null,
  permanent_child_file_id uuid references public.permanent_child_files(id) on delete cascade,
  current_garden_id uuid references public.gardens(id) on delete set null,
  target_garden_id uuid not null references public.gardens(id) on delete cascade,
  target_enrollment_id uuid references public.child_kindergarten_enrollments(id) on delete set null,
  status text not null default 'pending_new_kindergarten_review' check (status in (
    'pending_new_kindergarten_review',
    'pending_current_kindergarten_response',
    'current_kindergarten_acknowledged',
    'current_kindergarten_requested_call',
    'current_kindergarten_flagged',
    'missing_details',
    'approved',
    'rejected',
    'cancelled'
  )),
  requested_start_date date,
  parent_notes text,
  current_kindergarten_response text,
  current_kindergarten_response_by uuid references public.profiles(id) on delete set null,
  current_kindergarten_responded_at timestamptz,
  new_kindergarten_response text,
  new_kindergarten_response_by uuid references public.profiles(id) on delete set null,
  new_kindergarten_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

alter table public.child_transfer_requests
  add column if not exists target_child_id uuid references public.children(id) on delete set null,
  add column if not exists target_enrollment_id uuid references public.child_kindergarten_enrollments(id) on delete set null,
  add column if not exists demo_batch_id text;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'child_transfer_requests' and column_name = 'demo_batch_id' and data_type = 'uuid') then
    alter table public.child_transfer_requests alter column demo_batch_id type text using demo_batch_id::text;
  end if;
end $$;

create index if not exists idx_child_transfer_parent_profile on public.child_transfer_requests(parent_profile_id, status);
create index if not exists idx_child_transfer_current_garden on public.child_transfer_requests(current_garden_id, status);
create index if not exists idx_child_transfer_target_garden on public.child_transfer_requests(target_garden_id, status);
create index if not exists idx_child_transfer_file on public.child_transfer_requests(permanent_child_file_id, created_at desc);

alter table public.child_transfer_requests enable row level security;

drop policy if exists "child transfer requests scoped read" on public.child_transfer_requests;
create policy "child transfer requests scoped read" on public.child_transfer_requests
  for select using (
    public.is_admin()
    or parent_profile_id = auth.uid()
    or public.can_access_garden(current_garden_id)
    or public.can_access_garden(target_garden_id)
  );

drop policy if exists "child transfer requests scoped write" on public.child_transfer_requests;
create policy "child transfer requests scoped write" on public.child_transfer_requests
  for all using (
    public.is_admin()
    or parent_profile_id = auth.uid()
    or public.can_access_garden(current_garden_id)
    or public.can_access_garden(target_garden_id)
  )
  with check (
    public.is_admin()
    or parent_profile_id = auth.uid()
    or public.can_access_garden(current_garden_id)
    or public.can_access_garden(target_garden_id)
  );

notify pgrst, 'reload schema';
