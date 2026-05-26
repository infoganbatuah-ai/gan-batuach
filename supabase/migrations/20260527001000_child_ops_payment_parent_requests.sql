alter table public.children
  add column if not exists has_change_clothes boolean,
  add column if not exists change_clothes_notes text,
  add column if not exists last_change_clothes_check date,
  add column if not exists payments_paused boolean not null default false,
  add column if not exists paused_reason text,
  add column if not exists debt_amount numeric(10,2) not null default 0,
  add column if not exists debt_notes text;

alter table public.child_payment_history
  add column if not exists transaction_type text;

create table if not exists public.parent_child_requests (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  request_type text not null default 'general',
  content text not null,
  status text not null default 'new',
  manager_response text,
  reminder_at timestamptz,
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id uuid
);

create index if not exists idx_parent_child_requests_garden_status on public.parent_child_requests(garden_id, status, created_at desc);
create index if not exists idx_parent_child_requests_child on public.parent_child_requests(child_id, created_at desc);

alter table public.parent_child_requests enable row level security;

drop policy if exists "parent child requests scoped read" on public.parent_child_requests;
create policy "parent child requests scoped read" on public.parent_child_requests
  for select using (public.can_access_garden(garden_id) or parent_profile_id = auth.uid());

drop policy if exists "parent child requests scoped write" on public.parent_child_requests;
create policy "parent child requests scoped write" on public.parent_child_requests
  for all using (public.can_access_garden(garden_id) or parent_profile_id = auth.uid())
  with check (public.can_access_garden(garden_id) or parent_profile_id = auth.uid());
