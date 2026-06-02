-- Homepage conversion flows and provisioning support.

alter table public.leads add column if not exists address text;
alter table public.leads add column if not exists manager_name text;
alter table public.leads add column if not exists age_groups text[] not null default '{}';
alter table public.leads add column if not exists capacity integer;
alter table public.leads add column if not exists experience text;
alter table public.leads add column if not exists certifications text;
alter table public.leads add column if not exists converted_entity_id uuid;
alter table public.leads add column if not exists converted_at timestamptz;

alter table public.leads drop constraint if exists leads_lead_type_check;
alter table public.leads add constraint leads_lead_type_check check (lead_type in ('parent', 'garden', 'inspector'));

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in ('new', 'contacted', 'approved', 'rejected', 'converted', 'new_parent_lead', 'new_garden_onboarding', 'new_inspector_lead'));

alter table public.inspection_form_questions add column if not exists question_type text not null default 'score_1_10';
alter table public.inspection_form_questions add column if not exists min_score integer not null default 1;
alter table public.inspection_form_questions add column if not exists max_score integer not null default 10;
alter table public.inspection_form_questions add column if not exists violation_threshold integer not null default 4;
alter table public.inspection_form_questions add column if not exists help_text text;
alter table public.inspection_form_questions add column if not exists options jsonb not null default '{}'::jsonb;

create table if not exists public.inspection_form_assignments (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.inspection_forms(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  active boolean not null default true,
  monthly_schedule boolean not null default true,
  created_at timestamptz not null default now(),
  unique(form_id, inspector_id, garden_id)
);

alter table public.inspection_form_assignments enable row level security;

do $$ begin
  create policy "inspection form assignments admin all"
    on public.inspection_form_assignments for all
    using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "inspection form assignments inspector read"
    on public.inspection_form_assignments for select
    using (auth.uid() = inspector_id);
exception when duplicate_object then null; end $$;
