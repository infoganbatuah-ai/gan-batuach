create table if not exists public.kindergarten_fee_groups (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  group_name text not null,
  age_range text,
  monthly_fee numeric(10,2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id uuid
);

alter table public.kindergarten_fee_groups enable row level security;

drop policy if exists "fee groups garden scoped read" on public.kindergarten_fee_groups;
create policy "fee groups garden scoped read" on public.kindergarten_fee_groups
  for select using (public.can_access_garden(garden_id));

drop policy if exists "fee groups manager write" on public.kindergarten_fee_groups;
create policy "fee groups manager write" on public.kindergarten_fee_groups
  for all using (public.is_admin() or garden_id = public.current_garden_id())
  with check (public.is_admin() or garden_id = public.current_garden_id());

create index if not exists idx_kindergarten_fee_groups_garden on public.kindergarten_fee_groups(garden_id, active);

alter table public.children
  add column if not exists age_group text,
  add column if not exists classroom text,
  add column if not exists payment_group_id uuid,
  add column if not exists custom_monthly_fee numeric(10,2),
  add column if not exists arrangement_notes text,
  add column if not exists arrangement_valid_until date,
  add column if not exists last_amount_paid numeric(10,2),
  add column if not exists last_payment_method text;

do $$
begin
  alter table public.children
    add constraint children_payment_group_id_fkey
    foreign key (payment_group_id)
    references public.kindergarten_fee_groups(id)
    on delete set null;
exception
  when duplicate_object then null;
end $$;

alter table public.child_payment_history
  add column if not exists valid_from date,
  add column if not exists amount_paid numeric(10,2),
  add column if not exists payment_method text,
  add column if not exists previous_status text,
  add column if not exists new_status text;
