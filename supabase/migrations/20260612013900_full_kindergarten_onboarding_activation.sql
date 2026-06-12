-- PHASE 139: Full kindergarten onboarding, activation and registration flow.
-- Safe to rerun. Extends existing approval/onboarding without removing data.

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in (
  'new',
  'registration_pending',
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

alter table public.gardens
  add column if not exists activation_payment_status text not null default 'not_started',
  add column if not exists activation_progress_percent integer not null default 0,
  add column if not exists subscription_required boolean not null default true,
  add column if not exists payment_completed_at timestamptz,
  add column if not exists payment_grace_started_at timestamptz,
  add column if not exists payment_grace_ends_at timestamptz,
  add column if not exists frozen_at timestamptz,
  add column if not exists freeze_reason text;

alter table public.gardens drop constraint if exists gardens_approval_flow_status_check;
alter table public.gardens add constraint gardens_approval_flow_status_check check (approval_flow_status in (
  'registration_pending',
  'admin_approved',
  'lead_submitted',
  'lead_review',
  'lead_approved',
  'credentials_sent',
  'activation_in_progress',
  'payment_pending',
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
  'admin_approved',
  'activation_in_progress',
  'payment_pending',
  'onboarding_in_progress',
  'onboarding_submitted',
  'correction_required',
  'pending_final_approval',
  'active',
  'suspended',
  'archived'
));

alter table public.gardens drop constraint if exists gardens_activation_payment_status_check;
alter table public.gardens add constraint gardens_activation_payment_status_check check (activation_payment_status in (
  'not_started',
  'payment_pending',
  'paid',
  'failed',
  'grace_period',
  'debt',
  'frozen'
));

alter table public.kindergarten_onboarding_records
  add column if not exists activation_steps text[] not null default '{}'::text[],
  add column if not exists payment_status text not null default 'not_started',
  add column if not exists subscription_monthly_amount integer not null default 0,
  add column if not exists required_staff integer not null default 0,
  add column if not exists current_staff integer not null default 0,
  add column if not exists missing_staff integer not null default 0,
  add column if not exists first_login_completed_at timestamptz,
  add column if not exists password_changed_at timestamptz,
  add column if not exists staff_initialized_at timestamptz,
  add column if not exists children_initialized_at timestamptz,
  add column if not exists parents_invited_at timestamptz,
  add column if not exists payment_completed_at timestamptz;

alter table public.kindergarten_onboarding_records drop constraint if exists kindergarten_onboarding_lifecycle_status_check;
alter table public.kindergarten_onboarding_records add constraint kindergarten_onboarding_lifecycle_status_check check (lifecycle_status in (
  'registration_pending',
  'admin_approved',
  'lead_submitted',
  'lead_review',
  'lead_approved',
  'credentials_sent',
  'activation_in_progress',
  'payment_pending',
  'onboarding_in_progress',
  'onboarding_submitted',
  'correction_required',
  'pending_final_approval',
  'active',
  'suspended',
  'archived'
));

alter table public.kindergarten_onboarding_records drop constraint if exists kindergarten_onboarding_payment_status_check;
alter table public.kindergarten_onboarding_records add constraint kindergarten_onboarding_payment_status_check check (payment_status in (
  'not_started',
  'payment_pending',
  'paid',
  'failed',
  'grace_period',
  'debt',
  'frozen'
));

create table if not exists public.service_charters (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'אמנת השירות של גן בטוח',
  version text not null,
  content text not null,
  status text not null default 'draft',
  editable_by_admin boolean not null default true,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_charter_status_check check (status in ('draft','active','archived'))
);

create table if not exists public.kindergarten_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  manager_profile_id uuid references public.profiles(id) on delete set null,
  acceptance_type text not null,
  accepted boolean not null default true,
  version text not null,
  accepted_at timestamptz not null default now(),
  accepted_ip text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint kindergarten_legal_acceptance_type_check check (acceptance_type in ('platform_terms','privacy_terms','camera_rules','child_safety_terms','regulatory_declaration','service_charter'))
);

create table if not exists public.kindergarten_age_group_setups (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  age_group text not null,
  children_count integer not null default 0,
  max_children_per_class integer not null,
  required_staff integer not null default 0,
  current_staff integer not null default 0,
  monthly_child_price integer not null default 0,
  annual_child_price integer not null default 0,
  billing_day integer not null default 1,
  billing_cycle text not null default 'monthly',
  ratio_alert text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, age_group),
  constraint kindergarten_age_group_setup_check check (age_group in ('INFANT','TODDLER_YOUNG','TODDLER_MATURE','KINDERGARTEN')),
  constraint kindergarten_age_group_billing_cycle_check check (billing_cycle in ('monthly','annual')),
  constraint kindergarten_age_group_values_check check (children_count >= 0 and required_staff >= 0 and current_staff >= 0 and billing_day between 1 and 28)
);

create table if not exists public.kindergarten_activation_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  status text not null default 'recorded',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint kindergarten_activation_event_type_check check (event_type in (
    'registration_submitted',
    'admin_approved',
    'credentials_sent',
    'first_login_completed',
    'password_changed',
    'staff_invited',
    'staff_completed_profile',
    'children_initialized',
    'parents_invited',
    'parent_completed_registration',
    'documents_uploaded',
    'payment_required',
    'payment_completed',
    'payment_failed',
    'activation_completed',
    'garden_frozen',
    'garden_reactivated'
  ))
);

create index if not exists kindergarten_legal_acceptances_garden_idx on public.kindergarten_legal_acceptances(garden_id, acceptance_type, accepted_at desc);
create index if not exists kindergarten_age_group_setups_garden_idx on public.kindergarten_age_group_setups(garden_id, age_group);
create index if not exists kindergarten_activation_events_garden_idx on public.kindergarten_activation_events(garden_id, created_at desc);
create unique index if not exists service_charters_active_unique_idx on public.service_charters(status) where status = 'active';

alter table public.service_charters enable row level security;
alter table public.kindergarten_legal_acceptances enable row level security;
alter table public.kindergarten_age_group_setups enable row level security;
alter table public.kindergarten_activation_events enable row level security;

drop policy if exists "service charters public read active" on public.service_charters;
create policy "service charters public read active" on public.service_charters for select using (status = 'active' or public.is_admin());
drop policy if exists "service charters admin manage" on public.service_charters;
create policy "service charters admin manage" on public.service_charters for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kindergarten legal acceptances admin read" on public.kindergarten_legal_acceptances;
create policy "kindergarten legal acceptances admin read" on public.kindergarten_legal_acceptances for select using (public.is_admin() or public.can_access_garden(garden_id));
drop policy if exists "kindergarten legal acceptances public insert" on public.kindergarten_legal_acceptances;
create policy "kindergarten legal acceptances public insert" on public.kindergarten_legal_acceptances for insert with check (true);

drop policy if exists "kindergarten age group setups scoped" on public.kindergarten_age_group_setups;
create policy "kindergarten age group setups scoped" on public.kindergarten_age_group_setups for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "kindergarten activation events scoped read" on public.kindergarten_activation_events;
create policy "kindergarten activation events scoped read" on public.kindergarten_activation_events for select using (public.is_admin() or public.can_access_garden(garden_id));
drop policy if exists "kindergarten activation events scoped insert" on public.kindergarten_activation_events;
create policy "kindergarten activation events scoped insert" on public.kindergarten_activation_events for insert with check (public.is_admin() or public.can_access_garden(garden_id));

insert into public.service_charters (title, version, content, status, published_at)
values (
  'אמנת השירות של גן בטוח',
  '2026-06-13',
  'אמנת השירות של גן בטוח מגדירה את האחריות המשותפת של מנהלת הגן, צוות הגן ופלטפורמת גן בטוח.

מנהלת הגן אחראית לשמירה על בטיחות הילדים, השלמת מסמכים, הזמנת צוות והורים, עדכון פרטי ילדים, עמידה בדרישות פיקוח ושיתוף פעולה עם תהליכי בדיקה.

גן בטוח מספקת מערכת לניהול, שקיפות, מסמכים, תיעוד, פיקוח, תשלומים, מצלמות בהרשאה ותובנות חכמות. המערכת אינה מחליפה אחריות ניהולית, ייעוץ משפטי או דרישות רגולטוריות.

מצלמות במערכת מיועדות לשקיפות ובקרה בלבד, ללא שמע, בהתאם להרשאות, שעות צפייה וכללי פרטיות. אירועי תצפיתן חכם מחייבים בדיקה אנושית לפני כל שימוש.

הגן מתחייב לשקיפות מול הורים, שמירה על פרטיות קטינים, טיפול במסמכים חסרים, השלמת הכשרות צוות ושיתוף פעולה עם בדיקות פיקוח ופעולות תיקון.',
  'active',
  now()
)
on conflict do nothing;

comment on table public.service_charters is 'Editable Gan Batuach service charter shown during kindergarten registration.';
comment on table public.kindergarten_age_group_setups is 'Fixed legal age-group setup with capacity, pricing and staff ratio readiness.';
comment on table public.kindergarten_activation_events is 'Audit trail for onboarding, payment, staff/parent invites and activation events.';
