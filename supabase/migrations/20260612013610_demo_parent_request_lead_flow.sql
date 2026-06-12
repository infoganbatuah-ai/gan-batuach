-- PHASE 136 continuation: demo booking and parent-origin lead conversion.
-- Safe to rerun. Keeps public lead flows aligned with admin conversion.

alter table public.demo_booking_requests
  add column if not exists preferred_demo_date date;

alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check check (status in (
    'new',
    'contacted',
    'approved',
    'rejected',
    'converted',
    'not_relevant',
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

create index if not exists leads_public_source_status_idx
  on public.leads(source, status, created_at desc);

comment on column public.demo_booking_requests.preferred_demo_date is
  'Preferred demo date requested from the public booking form.';
