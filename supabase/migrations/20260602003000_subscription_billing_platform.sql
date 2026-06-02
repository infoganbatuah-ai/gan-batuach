-- V2 Phase 2A: subscription and billing platform.

do $$ begin
  create type public.subscription_plan_type as enum ('trial', 'monthly', 'annual', 'enterprise');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.kindergarten_subscription_status as enum ('active', 'trial', 'pending_payment', 'suspended', 'expired', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.billing_provider_type as enum ('manual', 'credit_card', 'tranzila', 'meshulam', 'pelecard', 'grow', 'stripe');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.billing_record_status as enum ('draft', 'open', 'paid', 'failed', 'cancelled', 'refunded', 'void');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.subscription_reminder_channel as enum ('in_app', 'sms', 'whatsapp', 'push');
exception when duplicate_object then null;
end $$;

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  plan_type public.subscription_plan_type not null default 'monthly',
  price_amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  duration_days integer,
  trial_days integer not null default 0,
  active_users_limit integer,
  active_children_limit integer,
  camera_limit integer,
  storage_limit_mb integer,
  enabled_features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create table if not exists public.kindergarten_subscriptions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  status public.kindergarten_subscription_status not null default 'trial',
  trial_status text not null default 'not_started',
  plan_type public.subscription_plan_type not null default 'trial',
  start_date date not null default current_date,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  expires_at timestamptz,
  renewal_date date,
  cancelled_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  admin_override boolean not null default false,
  override_reason text,
  billing_contact_name text,
  billing_contact_email text,
  billing_contact_phone text,
  provider public.billing_provider_type not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create unique index if not exists kindergarten_subscriptions_one_current_per_garden_idx
on public.kindergarten_subscriptions(garden_id)
where status in ('active', 'trial', 'pending_payment', 'suspended');

create table if not exists public.billing_provider_configs (
  id uuid primary key default gen_random_uuid(),
  provider public.billing_provider_type not null unique,
  display_name text not null,
  enabled boolean not null default false,
  mode text not null default 'manual',
  public_config jsonb not null default '{}'::jsonb,
  secret_config_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  provider public.billing_provider_type not null default 'manual',
  provider_payment_id text,
  payment_reference text,
  payment_method text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  billing_status public.billing_record_status not null default 'open',
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create table if not exists public.billing_invoices (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  invoice_number text not null unique,
  payment_id uuid references public.subscription_payments(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  billing_status public.billing_record_status not null default 'open',
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create table if not exists public.billing_receipts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  payment_id uuid references public.subscription_payments(id) on delete set null,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  receipt_number text not null unique,
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  issued_at timestamptz not null default now(),
  payment_reference text,
  payment_method text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text
);

create table if not exists public.subscription_reminders (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  reminder_key text not null,
  scheduled_for timestamptz not null,
  channel public.subscription_reminder_channel not null default 'in_app',
  status text not null default 'pending',
  sent_at timestamptz,
  title text not null,
  message text not null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_demo boolean not null default false,
  demo_batch_id text,
  unique(subscription_id, reminder_key, channel)
);

create index if not exists subscription_plans_active_idx on public.subscription_plans(active, plan_type, sort_order);
create index if not exists kindergarten_subscriptions_garden_idx on public.kindergarten_subscriptions(garden_id, status);
create index if not exists kindergarten_subscriptions_renewal_idx on public.kindergarten_subscriptions(renewal_date, status);
create index if not exists subscription_payments_subscription_idx on public.subscription_payments(subscription_id, billing_status, created_at desc);
create index if not exists billing_invoices_subscription_idx on public.billing_invoices(subscription_id, billing_status, issued_at desc);
create index if not exists billing_receipts_subscription_idx on public.billing_receipts(subscription_id, issued_at desc);
create index if not exists subscription_reminders_due_idx on public.subscription_reminders(scheduled_for, status, channel);

alter table public.subscription_plans enable row level security;
alter table public.kindergarten_subscriptions enable row level security;
alter table public.billing_provider_configs enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_receipts enable row level security;
alter table public.subscription_reminders enable row level security;

drop policy if exists "subscription plans readable" on public.subscription_plans;
create policy "subscription plans readable" on public.subscription_plans
for select using (active = true or public.current_role() = 'admin');

drop policy if exists "subscription plans admin write" on public.subscription_plans;
create policy "subscription plans admin write" on public.subscription_plans
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "kindergarten subscriptions by role" on public.kindergarten_subscriptions;
create policy "kindergarten subscriptions by role" on public.kindergarten_subscriptions
for select using (
  public.current_role() = 'admin'
  or public.can_access_garden(garden_id)
);

drop policy if exists "kindergarten subscriptions admin write" on public.kindergarten_subscriptions;
create policy "kindergarten subscriptions admin write" on public.kindergarten_subscriptions
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "billing provider configs admin only" on public.billing_provider_configs;
create policy "billing provider configs admin only" on public.billing_provider_configs
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "subscription payments by role" on public.subscription_payments;
create policy "subscription payments by role" on public.subscription_payments
for select using (
  public.current_role() = 'admin'
  or public.can_access_garden(garden_id)
);

drop policy if exists "subscription payments admin write" on public.subscription_payments;
create policy "subscription payments admin write" on public.subscription_payments
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "billing invoices by role" on public.billing_invoices;
create policy "billing invoices by role" on public.billing_invoices
for select using (
  public.current_role() = 'admin'
  or public.can_access_garden(garden_id)
);

drop policy if exists "billing invoices admin write" on public.billing_invoices;
create policy "billing invoices admin write" on public.billing_invoices
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "billing receipts by role" on public.billing_receipts;
create policy "billing receipts by role" on public.billing_receipts
for select using (
  public.current_role() = 'admin'
  or public.can_access_garden(garden_id)
);

drop policy if exists "billing receipts admin write" on public.billing_receipts;
create policy "billing receipts admin write" on public.billing_receipts
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

drop policy if exists "subscription reminders by role" on public.subscription_reminders;
create policy "subscription reminders by role" on public.subscription_reminders
for select using (
  public.current_role() = 'admin'
  or public.can_access_garden(garden_id)
);

drop policy if exists "subscription reminders admin write" on public.subscription_reminders;
create policy "subscription reminders admin write" on public.subscription_reminders
for all using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

insert into public.subscription_plans (name, description, plan_type, price_amount, duration_days, trial_days, active_users_limit, active_children_limit, camera_limit, storage_limit_mb, enabled_features, sort_order)
values
  ('Gan Batuach Fixed Kindergarten Plan', 'Fixed Gan Batuach kindergarten plan: management system plus Digital Observer included.', 'monthly', 700, 30, 0, null, null, null, null, '{"core_dashboard":true,"finance":true,"parent_requests":true,"cameras":true,"smart_insights":true,"digital_observer_included":true}'::jsonb, 10),
  ('Custom Enterprise Plan', 'Future custom plan for large kindergarten chains only.', 'enterprise', 0, null, 0, null, null, null, null, '{"custom_limits":true,"large_chain":true,"advanced_support":true,"digital_observer_included":true}'::jsonb, 40)
on conflict do nothing;

insert into public.billing_provider_configs (provider, display_name, enabled, mode)
values
  ('manual', 'Manual billing', true, 'manual'),
  ('credit_card', 'Credit Card', false, 'future'),
  ('tranzila', 'Tranzila', false, 'future'),
  ('meshulam', 'Meshulam', false, 'future'),
  ('pelecard', 'Pelecard', false, 'future'),
  ('grow', 'Grow', false, 'future'),
  ('stripe', 'Stripe', false, 'future')
on conflict (provider) do nothing;

notify pgrst, 'reload schema';
