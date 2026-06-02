-- Premium daily child operations: child journal, health/medicine, incidents and branding metadata.

alter table public.gardens
  add column if not exists logo_url text,
  add column if not exists brand_color text default '#123c8c';

alter table public.documents
  add column if not exists parent_id uuid references public.parents(id) on delete cascade,
  add column if not exists inspector_id uuid references public.inspectors(id) on delete cascade,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.messages
  add column if not exists linked_child_id uuid references public.children(id) on delete set null,
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null;

create table if not exists public.child_daily_journals (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  journal_date date not null default current_date,
  meals jsonb not null default '[]'::jsonb,
  sleep_summary text,
  sleep_minutes integer,
  mood text,
  bathroom text,
  medicine text,
  incidents text,
  notes_to_parents text,
  photo_urls text[] not null default '{}',
  staff_signature text,
  staff_id uuid references public.staff(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  parent_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, journal_date)
);

create table if not exists public.child_health_records (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  hmo text,
  allergies text,
  sensitivities text,
  medications text,
  emergency_contacts jsonb not null default '[]'::jsonb,
  medication_approval_url text,
  medication_approval_expires_at date,
  medical_notes text,
  missing_info boolean not null default false,
  allergy_warning boolean not null default false,
  medication_due_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id)
);

create table if not exists public.medicine_given_logs (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  medicine_name text not null,
  dosage text,
  given_at timestamptz not null default now(),
  approval_checked boolean not null default false,
  notes text,
  given_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_reports (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  incident_type text not null,
  title text not null,
  description text not null,
  photo_urls text[] not null default '{}',
  severity text not null default 'medium',
  reported_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'open',
  timeline jsonb not null default '[]'::jsonb,
  resolution text,
  parent_notified boolean not null default false,
  inspector_notified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_child_daily_journals_garden_date on public.child_daily_journals(garden_id, journal_date desc);
create index if not exists idx_child_health_records_garden on public.child_health_records(garden_id);
create index if not exists idx_medicine_given_logs_garden on public.medicine_given_logs(garden_id, given_at desc);
create index if not exists idx_incident_reports_garden_status on public.incident_reports(garden_id, status, created_at desc);

alter table public.child_daily_journals enable row level security;
alter table public.child_health_records enable row level security;
alter table public.medicine_given_logs enable row level security;
alter table public.incident_reports enable row level security;

drop policy if exists "child daily journals scoped read" on public.child_daily_journals;
create policy "child daily journals scoped read" on public.child_daily_journals
for select using (public.can_access_garden(garden_id));

drop policy if exists "child daily journals scoped write" on public.child_daily_journals;
create policy "child daily journals scoped write" on public.child_daily_journals
for all using (public.can_access_garden(garden_id)) with check (public.can_access_garden(garden_id));

drop policy if exists "child health scoped read" on public.child_health_records;
create policy "child health scoped read" on public.child_health_records
for select using (public.can_access_garden(garden_id));

drop policy if exists "child health scoped write" on public.child_health_records;
create policy "child health scoped write" on public.child_health_records
for all using (public.can_access_garden(garden_id)) with check (public.can_access_garden(garden_id));

drop policy if exists "medicine logs scoped read" on public.medicine_given_logs;
create policy "medicine logs scoped read" on public.medicine_given_logs
for select using (public.can_access_garden(garden_id));

drop policy if exists "medicine logs scoped write" on public.medicine_given_logs;
create policy "medicine logs scoped write" on public.medicine_given_logs
for all using (public.can_access_garden(garden_id)) with check (public.can_access_garden(garden_id));

drop policy if exists "incident reports scoped read" on public.incident_reports;
create policy "incident reports scoped read" on public.incident_reports
for select using (public.can_access_garden(garden_id));

drop policy if exists "incident reports scoped write" on public.incident_reports;
create policy "incident reports scoped write" on public.incident_reports
for all using (public.can_access_garden(garden_id)) with check (public.can_access_garden(garden_id));

notify pgrst, 'reload schema';
