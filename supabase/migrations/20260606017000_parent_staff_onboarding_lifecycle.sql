-- PHASE 100-3: parent and staff guided onboarding lifecycle.

alter table public.parents
  add column if not exists onboarding_status text not null default 'profile_incomplete',
  add column if not exists invitation_status text not null default 'invited',
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists activated_by uuid references public.profiles(id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists account_created_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists correction_note text,
  add column if not exists verification_history jsonb not null default '[]'::jsonb;

alter table public.parents drop constraint if exists parents_onboarding_status_check;
alter table public.parents add constraint parents_onboarding_status_check check (onboarding_status in (
  'invited',
  'account_created',
  'profile_incomplete',
  'active'
));

alter table public.parents drop constraint if exists parents_invitation_status_check;
alter table public.parents add constraint parents_invitation_status_check check (invitation_status in (
  'invited',
  'account_created',
  'profile_incomplete',
  'active'
));

alter table public.staff
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists activated_by uuid references public.profiles(id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists account_created_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists correction_note text,
  add column if not exists verification_history jsonb not null default '[]'::jsonb,
  add column if not exists policy_acknowledged boolean not null default false,
  add column if not exists role_assignment_confirmed boolean not null default false;

alter table public.staff drop constraint if exists staff_onboarding_status_check;
alter table public.staff alter column onboarding_status set default 'profile_incomplete';

create table if not exists public.parent_onboarding_records (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.parents(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  status text not null default 'profile_incomplete',
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  completed_steps text[] not null default '{}'::text[],
  missing_items text[] not null default '{}'::text[],
  invited_by uuid references public.profiles(id) on delete set null,
  activated_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  account_created_at timestamptz,
  completed_at timestamptz,
  activated_at timestamptz,
  correction_note text,
  verification_history jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_onboarding_records_status_check check (status in (
    'invited',
    'account_created',
    'profile_incomplete',
    'active'
  ))
);

create table if not exists public.staff_onboarding_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  status text not null default 'profile_incomplete',
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  completed_steps text[] not null default '{}'::text[],
  missing_items text[] not null default '{}'::text[],
  invited_by uuid references public.profiles(id) on delete set null,
  activated_by uuid references public.profiles(id) on delete set null,
  invited_at timestamptz,
  account_created_at timestamptz,
  submitted_at timestamptz,
  activated_at timestamptz,
  correction_note text,
  verification_history jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_onboarding_records_status_check check (status in (
    'invited',
    'account_created',
    'profile_incomplete',
    'pending_verification',
    'correction_required',
    'active',
    'suspended'
  ))
);

create unique index if not exists parent_onboarding_records_parent_unique_idx
  on public.parent_onboarding_records(parent_id);

create unique index if not exists staff_onboarding_records_staff_unique_idx
  on public.staff_onboarding_records(staff_id);

create index if not exists parent_onboarding_records_status_idx
  on public.parent_onboarding_records(status, updated_at desc);

create index if not exists staff_onboarding_records_status_idx
  on public.staff_onboarding_records(status, updated_at desc);

update public.parents
set onboarding_status = case
    when completed_profile is true and status = 'active' then 'active'
    when status = 'invited' then 'invited'
    else 'profile_incomplete'
  end,
  invitation_status = case
    when completed_profile is true and status = 'active' then 'active'
    when status = 'invited' then 'invited'
    else 'profile_incomplete'
  end;

update public.staff
set onboarding_status = case
    when approved_to_work is true then 'active'
    when onboarding_status is null or btrim(onboarding_status) = '' then 'profile_incomplete'
    when lower(btrim(onboarding_status)) in ('active', 'approved') then 'active'
    when lower(btrim(onboarding_status)) in ('invited') then 'invited'
    when lower(btrim(onboarding_status)) in ('account_created') then 'account_created'
    when lower(btrim(onboarding_status)) in ('profile_incomplete', 'pending_completion', 'not_started', 'incomplete') then 'profile_incomplete'
    when lower(btrim(onboarding_status)) in ('pending', 'pending_approval', 'pending_documents', 'pending_review', 'submitted') then 'pending_verification'
    when lower(btrim(onboarding_status)) in ('rejected', 'correction_required', 'request_missing_details', 'missing_info') then 'correction_required'
    when lower(btrim(onboarding_status)) in ('blocked', 'suspended') then 'suspended'
    else 'profile_incomplete'
  end;

alter table public.staff add constraint staff_onboarding_status_check check (onboarding_status in (
  'invited',
  'account_created',
  'profile_incomplete',
  'pending_verification',
  'correction_required',
  'active',
  'suspended'
));

insert into public.parent_onboarding_records (
  parent_id,
  profile_id,
  garden_id,
  status,
  progress_percent,
  completed_steps,
  invited_by,
  activated_by,
  invited_at,
  account_created_at,
  completed_at,
  activated_at
)
select
  p.id,
  coalesce(p.profile_id, p.user_id),
  p.garden_id,
  p.onboarding_status,
  case when p.onboarding_status = 'active' then 100 else 25 end,
  case when p.onboarding_status = 'active' then array['profile_completed','child_linked','documents_completed','permissions_reviewed']::text[] else '{}'::text[] end,
  p.invited_by,
  p.activated_by,
  p.invited_at,
  p.account_created_at,
  p.onboarding_completed_at,
  p.activated_at
from public.parents p
on conflict (parent_id) do update set
  profile_id = excluded.profile_id,
  garden_id = excluded.garden_id,
  status = excluded.status,
  progress_percent = excluded.progress_percent,
  updated_at = now();

insert into public.staff_onboarding_records (
  staff_id,
  profile_id,
  garden_id,
  status,
  progress_percent,
  completed_steps,
  invited_by,
  activated_by,
  invited_at,
  account_created_at,
  submitted_at,
  activated_at,
  correction_note
)
select
  s.id,
  s.profile_id,
  s.garden_id,
  s.onboarding_status,
  case when s.onboarding_status = 'active' then 100 else 20 end,
  case when s.onboarding_status = 'active' then array['personal_details','role_assignment','emergency_contact','documents','policy_acknowledged']::text[] else '{}'::text[] end,
  s.invited_by,
  s.activated_by,
  s.invited_at,
  s.account_created_at,
  s.onboarding_completed_at,
  s.activated_at,
  s.correction_note
from public.staff s
on conflict (staff_id) do update set
  profile_id = excluded.profile_id,
  garden_id = excluded.garden_id,
  status = excluded.status,
  progress_percent = excluded.progress_percent,
  correction_note = excluded.correction_note,
  updated_at = now();

alter table public.parent_onboarding_records enable row level security;
alter table public.staff_onboarding_records enable row level security;

drop policy if exists "parent onboarding scoped read" on public.parent_onboarding_records;
create policy "parent onboarding scoped read"
on public.parent_onboarding_records
for select
using (
  public.current_role() = 'admin'
  or profile_id = auth.uid()
  or (garden_id is not null and public.current_role() in ('manager', 'owner') and public.can_access_garden(garden_id))
);

drop policy if exists "parent onboarding scoped update" on public.parent_onboarding_records;
create policy "parent onboarding scoped update"
on public.parent_onboarding_records
for update
using (profile_id = auth.uid() or public.current_role() = 'admin')
with check (profile_id = auth.uid() or public.current_role() = 'admin');

drop policy if exists "staff onboarding scoped read" on public.staff_onboarding_records;
create policy "staff onboarding scoped read"
on public.staff_onboarding_records
for select
using (
  public.current_role() = 'admin'
  or profile_id = auth.uid()
  or (garden_id is not null and public.current_role() in ('manager', 'owner') and public.can_access_garden(garden_id))
);

drop policy if exists "staff onboarding scoped update" on public.staff_onboarding_records;
create policy "staff onboarding scoped update"
on public.staff_onboarding_records
for update
using (
  profile_id = auth.uid()
  or public.current_role() = 'admin'
  or (garden_id is not null and public.current_role() in ('manager', 'owner') and public.can_access_garden(garden_id))
)
with check (
  profile_id = auth.uid()
  or public.current_role() = 'admin'
  or (garden_id is not null and public.current_role() in ('manager', 'owner') and public.can_access_garden(garden_id))
);
