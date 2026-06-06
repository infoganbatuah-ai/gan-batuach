-- Kindergarten lead approval and manager-owned onboarding flow.

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
  'lead_submitted',
  'lead_approved_credentials_sent',
  'profile_incomplete',
  'profile_submitted',
  'pending_final_admin_approval',
  'correction_required',
  'active',
  'suspended',
  'request_more_details',
  'parent_approved_pending_child_completion',
  'approved_pending_parent_completion'
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
  add column if not exists credentials_sent_at timestamptz;

alter table public.gardens drop constraint if exists gardens_approval_flow_status_check;
alter table public.gardens add constraint gardens_approval_flow_status_check check (approval_flow_status in (
  'lead_submitted',
  'lead_approved_credentials_sent',
  'profile_incomplete',
  'profile_submitted',
  'pending_final_admin_approval',
  'correction_required',
  'active',
  'rejected',
  'suspended'
));

alter table public.gardens drop constraint if exists gardens_final_approval_status_check;
alter table public.gardens add constraint gardens_final_approval_status_check check (final_approval_status in (
  'profile_incomplete',
  'pending_final_admin_approval',
  'correction_required',
  'active',
  'rejected',
  'suspended'
));

update public.leads
set status = 'lead_submitted'
where lead_type = 'garden' and status in ('new', 'new_garden_onboarding');

update public.gardens
set approval_flow_status = case
    when status::text = 'active' then 'active'
    when status::text in ('rejected', 'suspended') then status::text
    else approval_flow_status
  end,
  final_approval_status = case
    when status::text = 'active' then 'active'
    when status::text in ('rejected', 'suspended') then status::text
    else final_approval_status
  end;

create index if not exists idx_gardens_approval_flow_status
  on public.gardens(approval_flow_status, final_approval_status, created_at desc);

comment on column public.gardens.approval_flow_status is 'Lead-to-launch lifecycle for kindergarten approval.';
comment on column public.gardens.admin_correction_note is 'Admin note shown to manager when final profile corrections are required.';
