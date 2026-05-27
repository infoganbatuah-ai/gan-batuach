-- Parent lead visibility and conversion flow for kindergarten managers.

alter table public.leads
  add column if not exists source text not null default 'public_kindergarten_page',
  add column if not exists missing_details jsonb not null default '[]'::jsonb,
  add column if not exists converted_parent_id uuid references public.parents(id) on delete set null,
  add column if not exists converted_child_id uuid references public.children(id) on delete set null,
  add column if not exists converted_at timestamptz;

alter table public.children
  drop constraint if exists at_least_one_parent_id;

alter table public.children
  add constraint at_least_one_parent_id
  check (
    status in ('pending_parent_completion', 'draft')
    or mother_identity_number is not null
    or father_identity_number is not null
    or identity_number is not null
  );

create index if not exists idx_leads_garden_parent_status
  on public.leads(garden_id, lead_type, status, created_at desc);

notify pgrst, 'reload schema';
