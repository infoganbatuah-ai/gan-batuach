alter table public.children
  add column if not exists monthly_fee numeric(10,2) not null default 0,
  add column if not exists payment_status text not null default 'unconfigured',
  add column if not exists last_payment_date date,
  add column if not exists next_payment_due date,
  add column if not exists valid_until date,
  add column if not exists payment_notes text;

create table if not exists public.child_payment_history (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  action text not null,
  payment_status text not null,
  paid_at date,
  valid_until date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id uuid
);

create index if not exists idx_child_payment_history_garden on public.child_payment_history(garden_id);
create index if not exists idx_child_payment_history_child on public.child_payment_history(child_id);

alter table public.child_payment_history enable row level security;

drop policy if exists "payment history garden scoped read" on public.child_payment_history;
create policy "payment history garden scoped read" on public.child_payment_history
  for select using (public.can_access_garden(garden_id));

drop policy if exists "payment history manager write" on public.child_payment_history;
create policy "payment history manager write" on public.child_payment_history
  for insert with check (public.is_admin() or garden_id = public.current_garden_id());
