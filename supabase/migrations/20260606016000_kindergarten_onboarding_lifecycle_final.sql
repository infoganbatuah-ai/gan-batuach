-- PHASE 100-2: final kindergarten lead -> onboarding -> approval lifecycle.
-- The detailed lifecycle intentionally lives outside the garden_status enum.

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in (
  'new',
  'contacted',
  'approved',
  'rejected',
  'converted',
  'new_parent_lead',
  'new_garden_onboarding',
  'new_inspector_lead',
  'request_more_details',
  'parent_approved_pending_child_completion',
  'approved_pending_parent_completion',
  'lead_submitted',
  'lead_review',
  'lead_approved',
  'credentials_sent',
  'onboarding_in_progress',
  'onboarding_submitted',
  'correction_required',
  'pending_final_approval',
  'active',
  'suspended',
  'archived'
));

alter table public.gardens
  add column if not exists approval_flow_status text not null default 'active',
  add column if not exists final_approval_status text not null default 'active',
  add column if not exists admin_correction_note text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists profile_submitted_at timestamptz,
  add column if not exists final_approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists suspended_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists credentials_sent_at timestamptz,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists lead_reviewed_at timestamptz,
  add column if not exists lead_approved_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists correction_history jsonb not null default '[]'::jsonb;

create table if not exists public.kindergarten_onboarding_records (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  manager_id uuid references public.profiles(id) on delete set null,
  lifecycle_status text not null default 'credentials_sent',
  progress_percent integer not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  completed_steps text[] not null default '{}'::text[],
  missing_fields text[] not null default '{}'::text[],
  required_fields text[] not null default array[
    'kindergarten_name',
    'logo',
    'profile_image',
    'address',
    'phone',
    'contact_details',
    'business_information',
    'operating_hours',
    'subscription_details',
    'documents',
    'camera_readiness'
  ],
  profile_data jsonb not null default '{}'::jsonb,
  correction_note text,
  correction_history jsonb not null default '[]'::jsonb,
  credentials_sent_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  archived_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindergarten_onboarding_lifecycle_status_check check (lifecycle_status in (
    'lead_submitted',
    'lead_review',
    'lead_approved',
    'credentials_sent',
    'onboarding_in_progress',
    'onboarding_submitted',
    'correction_required',
    'pending_final_approval',
    'active',
    'suspended',
    'archived'
  ))
);

create unique index if not exists kindergarten_onboarding_records_garden_unique_idx
  on public.kindergarten_onboarding_records(garden_id);

create index if not exists kindergarten_onboarding_records_status_idx
  on public.kindergarten_onboarding_records(lifecycle_status, updated_at desc);

create index if not exists kindergarten_onboarding_records_manager_idx
  on public.kindergarten_onboarding_records(manager_id, lifecycle_status);

update public.leads
set status = case
    when status in ('new', 'new_garden_onboarding') then 'lead_submitted'
    when status = 'contacted' then 'lead_review'
    when status = 'approved' then 'lead_approved'
    when status = 'converted' then 'active'
    when status = 'rejected' then 'archived'
    else status
  end
where lead_type = 'garden'
  and status in ('new', 'new_garden_onboarding', 'contacted', 'approved', 'converted', 'rejected');

update public.gardens
set approval_flow_status = case
    when approval_flow_status = 'lead_approved_credentials_sent' then 'credentials_sent'
    when approval_flow_status = 'profile_incomplete' then 'onboarding_in_progress'
    when approval_flow_status = 'profile_submitted' then 'onboarding_submitted'
    when approval_flow_status = 'pending_final_admin_approval' then 'pending_final_approval'
    when approval_flow_status = 'rejected' then 'archived'
    when approval_flow_status in (
      'lead_submitted',
      'lead_review',
      'lead_approved',
      'credentials_sent',
      'onboarding_in_progress',
      'onboarding_submitted',
      'correction_required',
      'pending_final_approval',
      'active',
      'suspended',
      'archived'
    ) then approval_flow_status
    when status::text = 'active' then 'active'
    when status::text = 'blocked' then 'suspended'
    else 'onboarding_in_progress'
  end,
  final_approval_status = case
    when final_approval_status = 'profile_incomplete' then 'onboarding_in_progress'
    when final_approval_status = 'profile_submitted' then 'onboarding_submitted'
    when final_approval_status = 'pending_final_admin_approval' then 'pending_final_approval'
    when final_approval_status = 'rejected' then 'archived'
    when final_approval_status in (
      'onboarding_in_progress',
      'onboarding_submitted',
      'correction_required',
      'pending_final_approval',
      'active',
      'suspended',
      'archived'
    ) then final_approval_status
    when status::text = 'active' then 'active'
    when status::text = 'blocked' then 'suspended'
    else 'onboarding_in_progress'
  end;

alter table public.gardens drop constraint if exists gardens_approval_flow_status_check;
alter table public.gardens add constraint gardens_approval_flow_status_check check (approval_flow_status in (
  'lead_submitted',
  'lead_review',
  'lead_approved',
  'credentials_sent',
  'onboarding_in_progress',
  'onboarding_submitted',
  'correction_required',
  'pending_final_approval',
  'active',
  'suspended',
  'archived'
));

alter table public.gardens drop constraint if exists gardens_final_approval_status_check;
alter table public.gardens add constraint gardens_final_approval_status_check check (final_approval_status in (
  'onboarding_in_progress',
  'onboarding_submitted',
  'correction_required',
  'pending_final_approval',
  'active',
  'suspended',
  'archived'
));

insert into public.kindergarten_onboarding_records (
  lead_id,
  garden_id,
  manager_id,
  lifecycle_status,
  progress_percent,
  credentials_sent_at,
  submitted_at,
  approved_at,
  activated_at,
  correction_note,
  correction_history,
  reviewed_by,
  approved_by
)
select
  l.id,
  g.id,
  g.manager_id,
  g.approval_flow_status,
  case when g.approval_flow_status = 'active' then 100 else 0 end,
  g.credentials_sent_at,
  g.profile_submitted_at,
  g.final_approved_at,
  g.final_approved_at,
  g.admin_correction_note,
  g.correction_history,
  g.reviewed_by,
  g.approved_by
from public.gardens g
left join public.leads l on l.converted_entity_id = g.id and l.lead_type = 'garden'
where g.manager_id is not null
on conflict (garden_id) do update set
  manager_id = excluded.manager_id,
  lifecycle_status = excluded.lifecycle_status,
  correction_note = excluded.correction_note,
  updated_at = now();

alter table public.kindergarten_onboarding_records enable row level security;

drop policy if exists "kindergarten onboarding admin read all" on public.kindergarten_onboarding_records;
create policy "kindergarten onboarding admin read all"
on public.kindergarten_onboarding_records
for select
using (public.current_role() = 'admin');

drop policy if exists "kindergarten onboarding manager read own" on public.kindergarten_onboarding_records;
create policy "kindergarten onboarding manager read own"
on public.kindergarten_onboarding_records
for select
using (
  public.current_role() in ('manager', 'owner')
  and public.can_access_garden(garden_id)
);

drop policy if exists "kindergarten onboarding manager update own draft" on public.kindergarten_onboarding_records;
create policy "kindergarten onboarding manager update own draft"
on public.kindergarten_onboarding_records
for update
using (
  public.current_role() in ('manager', 'owner')
  and public.can_access_garden(garden_id)
  and lifecycle_status in ('credentials_sent', 'onboarding_in_progress', 'correction_required')
)
with check (
  public.current_role() in ('manager', 'owner')
  and public.can_access_garden(garden_id)
);

drop policy if exists "kindergarten onboarding admin update all" on public.kindergarten_onboarding_records;
create policy "kindergarten onboarding admin update all"
on public.kindergarten_onboarding_records
for update
using (public.current_role() = 'admin')
with check (public.current_role() = 'admin');

comment on table public.kindergarten_onboarding_records is 'Manager-owned kindergarten onboarding lifecycle and approval audit state.';
comment on column public.gardens.approval_flow_status is 'Detailed kindergarten lifecycle. Not the garden_status enum.';
