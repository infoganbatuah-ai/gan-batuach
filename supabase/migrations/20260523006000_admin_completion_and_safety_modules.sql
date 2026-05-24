-- Admin completion, persistent credentials, signature, GPS and daily operations.

create table if not exists public.generated_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  temporary_password text not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.generated_credentials enable row level security;

drop policy if exists "generated credentials admin only" on public.generated_credentials;
create policy "generated credentials admin only" on public.generated_credentials
for all using (public.is_admin()) with check (public.is_admin());

alter table public.profiles
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists username text,
  add column if not exists email text,
  add column if not exists profile_image_url text,
  add column if not exists deactivated_at timestamptz;

alter table public.gardens
  add column if not exists image_url text,
  add column if not exists rating numeric(3, 2),
  add column if not exists first_inspection_due_at timestamptz,
  add column if not exists first_inspection_grace_until timestamptz,
  add column if not exists onboarding_restricted_at timestamptz,
  add column if not exists inspection_required_status text not null default 'pending_first_inspection';

alter table public.tasks
  add column if not exists assigned_role text,
  add column if not exists assigned_group text,
  add column if not exists repeat_rule text,
  add column if not exists priority text not null default 'medium',
  add column if not exists rejection_reason text,
  add column if not exists completed_notes text,
  add column if not exists performed_by_user uuid references public.profiles(id) on delete set null,
  add column if not exists performed_by_role text;

alter table public.inspections
  add column if not exists signature_image text,
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by uuid references public.profiles(id) on delete set null,
  add column if not exists manually_completed boolean not null default false,
  add column if not exists override_reason text,
  add column if not exists override_notes text,
  add column if not exists performed_by_user uuid references public.profiles(id) on delete set null,
  add column if not exists performed_by_role text;

create table if not exists public.inspection_signatures (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  signature_image text not null,
  signed_at timestamptz not null default now(),
  signed_by uuid not null references public.profiles(id) on delete restrict,
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  gps_distance_meters numeric(10, 2),
  inspector_details jsonb not null default '{}'::jsonb,
  kindergarten_details jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.inspection_overrides (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete set null,
  reason text not null,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.gps_verification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  user_role text,
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  action text not null,
  gps_lat numeric(10, 7) not null,
  gps_lng numeric(10, 7) not null,
  distance_meters numeric(10, 2),
  valid boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.daily_operational_tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  title text not null,
  description text,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  role_scope text[] not null default array['manager','owner','staff'],
  category text not null default 'operations',
  required boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_task_completions (
  id uuid primary key default gen_random_uuid(),
  operational_task_id uuid not null references public.daily_operational_tasks(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_by_role text,
  completed_for_date date not null default current_date,
  status text not null default 'done',
  notes text,
  created_at timestamptz not null default now(),
  unique (operational_task_id, completed_for_date, completed_by)
);

create table if not exists public.required_inspections (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  due_at timestamptz not null,
  status text not null default 'required',
  countdown_day integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.late_inspections (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  due_at timestamptz not null,
  days_late integer not null default 0,
  status text not null default 'late',
  created_at timestamptz not null default now()
);

alter table public.audit_logs
  add column if not exists performed_by_user uuid references public.profiles(id) on delete set null,
  add column if not exists performed_by_role text,
  add column if not exists timestamp timestamptz not null default now();

alter table public.staff
  add column if not exists profile_photo_url text,
  add column if not exists sexual_offense_clearance_url text,
  add column if not exists criminal_clearance_url text,
  add column if not exists onboarding_status text not null default 'pending_completion',
  add column if not exists manager_approved_at timestamptz,
  add column if not exists inspector_verified_at timestamptz;

alter table public.children
  add column if not exists face_image_url text,
  add column if not exists face_attendance_enabled boolean not null default false;

alter table public.camera_streams
  add column if not exists host text,
  add column if not exists port integer,
  add column if not exists username text,
  add column if not exists rtsp_path text,
  add column if not exists onvif_path text,
  add column if not exists channel text,
  add column if not exists ai_enabled boolean not null default false;

create index if not exists idx_generated_credentials_user on public.generated_credentials(user_id, created_at desc);
create index if not exists idx_gps_logs_garden_action on public.gps_verification_logs(garden_id, action, created_at desc);
create index if not exists idx_required_inspections_due on public.required_inspections(status, due_at);
create index if not exists idx_late_inspections_garden on public.late_inspections(garden_id, due_at desc);

insert into public.daily_operational_tasks (title, description, frequency, category)
values
  ('נוכחות בוקר', 'סימון נוכחות ילדים ועדכון חריגים להורים.', 'daily', 'attendance'),
  ('בדיקת שירותים והיגיינה', 'בדיקת ניקיון, סבון, מגבות ומפגעים.', 'daily', 'hygiene'),
  ('בדיקת בטיחות חצר', 'סריקת חצר לפני יציאה: שערים, מתקנים, צל ומפגעים.', 'daily', 'safety'),
  ('אימות תרופות ורגישויות', 'בדיקת ילדים עם תרופות, אלרגיות או הנחיות רפואיות.', 'daily', 'health'),
  ('בדיקת ציוד חירום', 'עזרה ראשונה, מטפים, טלפוני חירום ודרכי מילוט.', 'weekly', 'emergency'),
  ('בדיקת מטבח ומזון', 'תוקף מזון, ניקיון מטבח, הפרדת אלרגנים ותפריט.', 'daily', 'kitchen'),
  ('עדכוני הורים', 'שליחת עדכון יומי/חריג להורים לפי צורך.', 'daily', 'parents'),
  ('בדיקת מסמכי צוות', 'מעקב תוקף אישורים, תעודות ובדיקות רקע.', 'monthly', 'staff')
on conflict do nothing;
