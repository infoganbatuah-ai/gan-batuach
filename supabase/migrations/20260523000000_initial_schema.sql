-- Gan Batuach production schema for Supabase/PostgreSQL.
-- Run in Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'inspector', 'manager', 'staff', 'parent');
create type public.garden_status as enum ('pending', 'active', 'blocked', 'archived');
create type public.safe_status as enum ('pending_review', 'safe', 'requires_fix', 'not_compliant');
create type public.task_status as enum ('open', 'in_progress', 'waiting_approval', 'done', 'overdue', 'rejected');
create type public.severity_level as enum ('low', 'medium', 'high', 'critical');
create type public.complaint_status as enum ('new', 'assigned', 'in_progress', 'waiting_garden', 'closed');
create type public.document_status as enum ('missing', 'pending_review', 'valid', 'expired', 'rejected');
create type public.attendance_status as enum ('present', 'absent', 'sick', 'late', 'left_early', 'not_updated');
create type public.camera_status as enum ('online', 'offline', 'covered', 'frozen', 'black_frame', 'disabled');

create table public.gardens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text,
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  framework_type text not null default 'mixed',
  ages text[] not null default '{}',
  children_capacity integer not null default 0 check (children_capacity >= 0),
  current_children_count integer not null default 0 check (current_children_count >= 0),
  staff_count integer not null default 0 check (staff_count >= 0),
  owner_name text,
  phone text,
  email text,
  status public.garden_status not null default 'pending',
  safe_status public.safe_status not null default 'pending_review',
  inspector_id uuid,
  manager_id uuid,
  public_profile_enabled boolean not null default false,
  eligible_for_safe_status boolean not null default false,
  last_inspection_score numeric(4, 2),
  last_inspection_at timestamptz,
  next_inspection_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  garden_id uuid references public.gardens(id) on delete set null,
  full_name text not null,
  phone text,
  active boolean not null default true,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gardens
  add constraint gardens_inspector_id_fkey foreign key (inspector_id) references public.profiles(id) on delete set null,
  add constraint gardens_manager_id_fkey foreign key (manager_id) references public.profiles(id) on delete set null;

create table public.inspectors (
  id uuid primary key references public.profiles(id) on delete cascade,
  service_cities text[] not null default '{}',
  certification_notes text,
  created_at timestamptz not null default now()
);

create table public.teachers (
  id uuid primary key references public.profiles(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  title text not null default 'גננת',
  class_group text,
  background_check_status public.document_status not null default 'missing',
  police_clearance_status public.document_status not null default 'missing',
  approved_to_work boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  full_name text not null,
  role_title text not null,
  identity_number text,
  phone text,
  email text,
  address text,
  class_group text,
  start_date date,
  background_check_status public.document_status not null default 'missing',
  police_clearance_status public.document_status not null default 'missing',
  approved_to_work boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  full_name text not null,
  identity_number text,
  phone text not null,
  email text,
  address text,
  completed_profile boolean not null default false,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  primary_parent_id uuid references public.parents(id) on delete set null,
  full_name text not null,
  temporary_name text,
  birth_date date,
  identity_number text,
  hmo text,
  allergies text,
  sensitivities text,
  regular_medications text,
  medical_notes text,
  address text,
  mother_name text,
  mother_identity_number text,
  mother_phone text,
  father_name text,
  father_identity_number text,
  father_phone text,
  emergency_phone text,
  photo_url text,
  parent_photo_url text,
  pickup_authorized jsonb not null default '[]'::jsonb,
  photo_consent boolean,
  system_consent boolean,
  additional_consents jsonb not null default '{}'::jsonb,
  status text not null default 'pending_parent_completion',
  parent_completed boolean not null default false,
  manager_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint at_least_one_parent_id check (mother_identity_number is not null or father_identity_number is not null or identity_number is not null)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete set null,
  lead_type text not null check (lead_type in ('parent', 'garden')),
  parent_name text,
  child_name text,
  child_age text,
  garden_name text,
  owner_name text,
  city text,
  phone text not null,
  email text,
  children_count integer,
  staff_count integer,
  notes text,
  status text not null default 'new',
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  status public.task_status not null default 'open',
  files jsonb not null default '[]'::jsonb,
  viewed_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  framework_type text not null default 'mixed',
  active boolean not null default true,
  frequency_months integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.inspection_forms(id) on delete cascade,
  category text not null,
  question_text text not null,
  required boolean not null default true,
  critical boolean not null default false,
  weight numeric(5, 2) not null default 1,
  requires_note boolean not null default false,
  requires_photo boolean not null default false,
  requires_document boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid not null references public.profiles(id) on delete restrict,
  form_id uuid not null references public.inspection_forms(id) on delete restrict,
  task_id uuid references public.tasks(id) on delete set null,
  status public.task_status not null default 'open',
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  gps_verified boolean not null default false,
  gps_exception_approved_by uuid references public.profiles(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  weighted_score numeric(4, 2),
  critical_failures integer not null default 0,
  violation_count integer not null default 0,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inspection_answers (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  question_id uuid not null references public.inspection_form_questions(id) on delete restrict,
  score integer not null check (score between 1 and 10),
  note text,
  photo_url text,
  document_url text,
  created_at timestamptz not null default now(),
  unique (inspection_id, question_id)
);

create table public.violations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  question_id uuid references public.inspection_form_questions(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  title text not null,
  description text,
  category text,
  severity public.severity_level not null default 'medium',
  score integer check (score between 1 and 10),
  status public.task_status not null default 'open',
  correction_due_at timestamptz,
  correction_note text,
  correction_files jsonb not null default '[]'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  body text not null,
  read_at timestamptz,
  treatment_status text not null default 'open',
  created_at timestamptz not null default now()
);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  assigned_inspector_id uuid references public.profiles(id) on delete set null,
  subject text not null,
  description text not null,
  severity public.severity_level not null default 'medium',
  urgent boolean not null default false,
  attachment_url text,
  status public.complaint_status not null default 'new',
  response_due_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  name text not null,
  document_type text not null,
  file_url text not null,
  expires_at date,
  status public.document_status not null default 'pending_review',
  reminder_days_before integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  attendance_date date not null default current_date,
  status public.attendance_status not null default 'not_updated',
  check_in_at timestamptz,
  check_out_at timestamptz,
  pickup_by_parent_id uuid references public.parents(id) on delete set null,
  pickup_name text,
  pickup_authorized boolean,
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  note text,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_subject check (child_id is not null or staff_id is not null)
);

create table public.camera_streams (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  name text not null,
  area text not null,
  camera_type text,
  dvr_host_encrypted text,
  dvr_port integer,
  username_encrypted text,
  password_encrypted text,
  protocol text not null default 'RTSP',
  class_group text,
  age_group text,
  active boolean not null default true,
  status public.camera_status not null default 'offline',
  last_health_check_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.camera_view_logs (
  id uuid primary key default gen_random_uuid(),
  camera_stream_id uuid not null references public.camera_streams(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewer_role public.app_role,
  token_hash text,
  ip inet,
  user_agent text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer
);

create table public.ai_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  camera_stream_id uuid references public.camera_streams(id) on delete set null,
  event_type text not null,
  severity public.severity_level not null default 'medium',
  screenshot_url text,
  confidence numeric(5, 2),
  status public.task_status not null default 'open',
  true_positive boolean,
  notes text,
  detected_at timestamptz not null default now(),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role public.app_role,
  garden_id uuid references public.gardens(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_garden on public.profiles(garden_id);
create index idx_children_garden on public.children(garden_id);
create index idx_parents_garden on public.parents(garden_id);
create index idx_tasks_garden on public.tasks(garden_id);
create index idx_inspections_garden on public.inspections(garden_id);
create index idx_violations_garden on public.violations(garden_id);
create index idx_messages_garden on public.messages(garden_id);
create index idx_complaints_garden on public.complaints(garden_id);
create index idx_documents_garden on public.documents(garden_id);
create index idx_attendance_garden_date on public.attendance(garden_id, attendance_date);
create index idx_camera_streams_garden on public.camera_streams(garden_id);
create index idx_ai_events_garden on public.ai_events(garden_id);
create index idx_audit_logs_garden_created on public.audit_logs(garden_id, created_at desc);

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.current_garden_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select garden_id from public.profiles where id = auth.uid() and active = true
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'admin'
$$;

create or replace function public.can_access_garden(target_garden_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      left join public.gardens g on g.id = target_garden_id
      where p.id = auth.uid()
        and p.active = true
        and (
          p.garden_id = target_garden_id
          or (p.role = 'inspector' and g.inspector_id = p.id)
        )
    )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'parent'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'משתמש חדש'),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'gardens','profiles','inspectors','teachers','staff','parents','children','leads','tasks',
    'inspection_forms','inspection_form_questions','inspections','inspection_answers','violations',
    'messages','complaints','documents','attendance','camera_streams','camera_view_logs','ai_events','audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

-- Profiles
create policy "profiles self read or admin" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- Gardens
create policy "garden access by role" on public.gardens for select using (public.can_access_garden(id) or public.current_role() = 'parent');
create policy "admins manage gardens" on public.gardens for all using (public.is_admin()) with check (public.is_admin());
create policy "managers update own garden" on public.gardens for update using (public.current_role() = 'manager' and id = public.current_garden_id()) with check (id = public.current_garden_id());

-- Garden-scoped tables. Admin sees all; manager/staff/parent see own garden; inspector sees assigned gardens.
create policy "children garden scoped read" on public.children for select using (public.can_access_garden(garden_id));
create policy "children manager parent write" on public.children for insert with check (public.is_admin() or garden_id = public.current_garden_id());
create policy "children manager update" on public.children for update using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "parents garden scoped read" on public.parents for select using (public.can_access_garden(garden_id));
create policy "parents write own garden" on public.parents for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "staff garden scoped read" on public.staff for select using (public.can_access_garden(garden_id));
create policy "staff manager write" on public.staff for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "teachers garden scoped read" on public.teachers for select using (public.can_access_garden(garden_id));
create policy "teachers admin manager write" on public.teachers for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "leads readable by admin and garden" on public.leads for select using (public.is_admin() or garden_id is null or public.can_access_garden(garden_id));
create policy "leads public insert" on public.leads for insert with check (true);
create policy "leads admin garden update" on public.leads for update using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

create policy "tasks garden scoped" on public.tasks for select using (public.can_access_garden(garden_id) or assigned_to = auth.uid());
create policy "tasks write scoped" on public.tasks for all using (public.is_admin() or public.can_access_garden(garden_id) or assigned_to = auth.uid()) with check (public.is_admin() or public.can_access_garden(garden_id) or assigned_to = auth.uid());

create policy "forms read authenticated" on public.inspection_forms for select using (auth.uid() is not null);
create policy "forms admin write" on public.inspection_forms for all using (public.is_admin()) with check (public.is_admin());
create policy "form questions read authenticated" on public.inspection_form_questions for select using (auth.uid() is not null);
create policy "form questions admin write" on public.inspection_form_questions for all using (public.is_admin()) with check (public.is_admin());

create policy "inspections scoped read" on public.inspections for select using (public.can_access_garden(garden_id));
create policy "inspections inspector admin write" on public.inspections for all using (public.is_admin() or (public.current_role() = 'inspector' and public.can_access_garden(garden_id))) with check (public.is_admin() or (public.current_role() = 'inspector' and public.can_access_garden(garden_id)));
create policy "inspection answers scoped read" on public.inspection_answers for select using (exists (select 1 from public.inspections i where i.id = inspection_id and public.can_access_garden(i.garden_id)));
create policy "inspection answers inspector write" on public.inspection_answers for all using (exists (select 1 from public.inspections i where i.id = inspection_id and (public.is_admin() or (public.current_role() = 'inspector' and public.can_access_garden(i.garden_id))))) with check (exists (select 1 from public.inspections i where i.id = inspection_id and (public.is_admin() or (public.current_role() = 'inspector' and public.can_access_garden(i.garden_id)))));

create policy "violations scoped" on public.violations for select using (public.can_access_garden(garden_id));
create policy "violations inspector admin write" on public.violations for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

create policy "messages participant or garden" on public.messages for select using (sender_id = auth.uid() or recipient_id = auth.uid() or public.can_access_garden(garden_id));
create policy "messages authenticated insert" on public.messages for insert with check (auth.uid() = sender_id);
create policy "messages participant update" on public.messages for update using (recipient_id = auth.uid() or public.is_admin()) with check (recipient_id = auth.uid() or public.is_admin());

create policy "complaints scoped read" on public.complaints for select using (public.can_access_garden(garden_id));
create policy "complaints parent insert" on public.complaints for insert with check (public.can_access_garden(garden_id));
create policy "complaints admin inspector update" on public.complaints for update using (public.is_admin() or (public.current_role() = 'inspector' and public.can_access_garden(garden_id))) with check (public.is_admin() or (public.current_role() = 'inspector' and public.can_access_garden(garden_id)));

create policy "documents scoped read" on public.documents for select using (garden_id is null or public.can_access_garden(garden_id));
create policy "documents scoped write" on public.documents for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

create policy "attendance scoped read" on public.attendance for select using (public.can_access_garden(garden_id));
create policy "attendance scoped write" on public.attendance for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

create policy "cameras scoped read" on public.camera_streams for select using (public.can_access_garden(garden_id));
create policy "cameras admin manager write" on public.camera_streams for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());
create policy "camera logs admin read" on public.camera_view_logs for select using (public.is_admin() or public.can_access_garden(garden_id));
create policy "camera logs authenticated insert" on public.camera_view_logs for insert with check (auth.uid() = viewer_id);

create policy "ai events scoped read" on public.ai_events for select using (public.can_access_garden(garden_id));
create policy "ai events service/admin write" on public.ai_events for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

create policy "audit admin read" on public.audit_logs for select using (public.is_admin());
create policy "audit authenticated insert" on public.audit_logs for insert with check (auth.uid() = actor_id or public.is_admin());

create trigger touch_gardens before update on public.gardens for each row execute function public.touch_updated_at();
create trigger touch_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger touch_staff before update on public.staff for each row execute function public.touch_updated_at();
create trigger touch_parents before update on public.parents for each row execute function public.touch_updated_at();
create trigger touch_children before update on public.children for each row execute function public.touch_updated_at();
create trigger touch_leads before update on public.leads for each row execute function public.touch_updated_at();
create trigger touch_tasks before update on public.tasks for each row execute function public.touch_updated_at();
create trigger touch_inspection_forms before update on public.inspection_forms for each row execute function public.touch_updated_at();
create trigger touch_inspections before update on public.inspections for each row execute function public.touch_updated_at();
create trigger touch_violations before update on public.violations for each row execute function public.touch_updated_at();
create trigger touch_complaints before update on public.complaints for each row execute function public.touch_updated_at();
create trigger touch_documents before update on public.documents for each row execute function public.touch_updated_at();
create trigger touch_attendance before update on public.attendance for each row execute function public.touch_updated_at();
create trigger touch_camera_streams before update on public.camera_streams for each row execute function public.touch_updated_at();

insert into public.inspection_forms (name, description, framework_type, active, frequency_months)
values ('טופס פיקוח חודשי בסיסי - גן בטוח', 'טופס ברירת מחדל לפיקוח חודשי בגנים פרטיים בישראל', 'mixed', true, 1);

insert into public.inspection_form_questions (form_id, category, question_text, required, critical, weight, requires_note, requires_photo, sort_order)
select f.id, q.category, q.question_text, true, q.critical, q.weight, q.requires_note, q.requires_photo, q.sort_order
from public.inspection_forms f
cross join (values
  ('רישוי ומסמכים', 'האם קיימים אישור/רישיון הפעלה רלוונטיים, ביטוח ופרטי מפעיל מעודכנים?', true, 3, true, false, 10),
  ('בטיחות מבנה', 'האם המבנה, שערים, יציאות, חשמל וגישה לחירום תקינים ומתועדים?', true, 4, true, true, 20),
  ('בטיחות חצר', 'האם מתקני החצר תקינים, השער נעול ואין חפצים מסוכנים?', true, 4, true, true, 30),
  ('תברואה', 'האם מתקיימים ניקיון, הפרדת חומרי ניקוי, היגיינה ואחסון תקינים?', true, 4, true, true, 40),
  ('מטבח ותזונה', 'האם המטבח/ספק המזון, אחסון מזון ותפריט יומי מתועדים?', true, 3, true, false, 50),
  ('כוח אדם', 'האם יחס צוות-ילדים, שיוך כיתות ונוכחות צוות עומדים במדיניות הגן?', true, 4, true, false, 60),
  ('תעודות יושר ובדיקות רקע', 'האם לכל עובד יש בדיקות רקע ומסמכי חובה לפני עבודה עם ילדים?', true, 5, true, false, 70),
  ('נוכחות ילדים', 'האם נוכחות ילדים, היעדרויות ואיסוף מתועדים בלוג מלא?', true, 3, true, false, 80),
  ('פרטיות ואבטחת מידע', 'האם הרשאות, הסכמות הורים, מאגרי מידע ולוגי פעולה מנוהלים?', true, 5, true, false, 90),
  ('מצלמות', 'האם מצלמות, הרשאות צפייה, שמירה ולוגי צפייה מוגדרים ומאובטחים?', true, 4, true, true, 100),
  ('נהלי חירום ועזרה ראשונה', 'האם קיימים נהלי חירום, ציוד עזרה ראשונה והכשרות בתוקף?', true, 4, true, true, 110),
  ('טיפול בתלונות', 'האם תלונות מתועדות, משויכות לפקח ומטופלות לפי חומרה?', false, 2, true, false, 120),
  ('שקיפות מול הורים', 'האם מידע יומי, הודעות, לידים וסטטוסים מוצגים להורים לפי הרשאה?', false, 2, false, false, 130),
  ('תפעול יומי', 'האם לו"ז, תפריט, פעילויות, גלריה ומשימות מתועדים באופן רציף?', false, 2, false, false, 140)
) as q(category, question_text, critical, weight, requires_note, requires_photo, sort_order)
where f.name = 'טופס פיקוח חודשי בסיסי - גן בטוח';
