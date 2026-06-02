-- Smart Kindergarten Engine: persisted rule-based insights and deduped actions.

create table if not exists public.smart_insights (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  entity_type text,
  entity_id uuid,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'urgent', 'critical')),
  title text not null,
  description text,
  recommended_action text,
  action_url text,
  status text not null default 'open' check (status in ('open', 'handled', 'snoozed', 'dismissed')),
  dedupe_key text not null,
  generated_at timestamptz not null default now(),
  handled_at timestamptz,
  snoozed_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  is_demo boolean not null default false,
  demo_batch_id text
);

create unique index if not exists idx_smart_insights_open_dedupe
  on public.smart_insights(recipient_profile_id, dedupe_key)
  where status in ('open', 'snoozed');

create index if not exists idx_smart_insights_role_status
  on public.smart_insights(role, status, generated_at desc);

create index if not exists idx_smart_insights_kindergarten
  on public.smart_insights(kindergarten_id, status, severity);

alter table public.smart_insights enable row level security;

drop policy if exists "smart insights scoped read" on public.smart_insights;
create policy "smart insights scoped read"
on public.smart_insights
for select
using (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or kindergarten_id = public.current_garden_id()
);

drop policy if exists "smart insights scoped update" on public.smart_insights;
create policy "smart insights scoped update"
on public.smart_insights
for update
using (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or kindergarten_id = public.current_garden_id()
)
with check (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or kindergarten_id = public.current_garden_id()
);

drop policy if exists "smart insights scoped insert" on public.smart_insights;
create policy "smart insights scoped insert"
on public.smart_insights
for insert
with check (
  public.is_admin()
  or recipient_profile_id = auth.uid()
  or kindergarten_id = public.current_garden_id()
);

notify pgrst, 'reload schema';
