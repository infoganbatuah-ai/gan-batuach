-- PHASE 108: Smart Compliance Engine
-- Additive monitoring layer over existing inspections, documents, staff records, policies, procedures and findings.

create table if not exists public.compliance_requirements (
  id uuid primary key default gen_random_uuid(),
  requirement_key text not null unique,
  category text not null,
  title text not null,
  description text,
  applies_to text not null default 'kindergarten',
  required boolean not null default true,
  warning_days integer[] not null default array[90,60,30,14,7],
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_requirement_category_check check (category in ('licenses','insurance','staff_certifications','first_aid','mandatory_training','safety_procedures','inspection_requirements','legal_documents')),
  constraint compliance_requirement_applies_check check (applies_to in ('kindergarten','staff','child','parent','inspector'))
);

create table if not exists public.compliance_alerts (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  staff_id uuid references public.staff(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  requirement_id uuid references public.compliance_requirements(id) on delete set null,
  source_table text,
  source_id uuid,
  category text not null,
  title text not null,
  description text,
  severity text not null default 'medium',
  alert_status text not null default 'open',
  due_at timestamptz,
  expiration_date date,
  warning_bucket text,
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  verified_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_alert_category_check check (category in ('licenses','insurance','staff_certifications','first_aid','mandatory_training','safety_procedures','inspection_requirements','legal_documents','findings','procedures','policies')),
  constraint compliance_alert_severity_check check (severity in ('low','medium','high','critical')),
  constraint compliance_alert_status_check check (alert_status in ('open','in_progress','resolved','verified','dismissed'))
);

create table if not exists public.compliance_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'kindergarten',
  garden_id uuid references public.gardens(id) on delete cascade,
  region text,
  score integer not null default 0,
  inspections_score integer not null default 0,
  documents_score integer not null default 0,
  staff_score integer not null default 0,
  procedures_score integer not null default 0,
  findings_score integer not null default 0,
  trend text not null default 'stable',
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint compliance_score_scope_check check (scope_type in ('national','region','kindergarten')),
  constraint compliance_score_range_check check (
    score between 0 and 100 and inspections_score between 0 and 100 and documents_score between 0 and 100
    and staff_score between 0 and 100 and procedures_score between 0 and 100 and findings_score between 0 and 100
  ),
  constraint compliance_score_trend_check check (trend in ('improving','stable','declining','unknown'))
);

create table if not exists public.compliance_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.compliance_alerts(id) on delete set null,
  finding_id uuid references public.national_compliance_findings(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  action_title text not null,
  action_description text,
  status text not null default 'identified',
  priority text not null default 'medium',
  due_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compliance_action_status_check check (status in ('identified','assigned','in_progress','ready_for_verification','verified','closed','cancelled')),
  constraint compliance_action_priority_check check (priority in ('low','medium','high','critical'))
);

create table if not exists public.compliance_report_requests (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  garden_id uuid references public.gardens(id) on delete set null,
  region text,
  period_start date,
  period_end date,
  status text not null default 'requested',
  requested_by uuid references public.profiles(id) on delete set null,
  file_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint compliance_report_type_check check (report_type in ('monthly','annual','kindergarten','regional','national')),
  constraint compliance_report_status_check check (status in ('requested','generating','ready','failed'))
);

create index if not exists compliance_alerts_scope_idx on public.compliance_alerts(garden_id, alert_status, severity, due_at);
create index if not exists compliance_alerts_expiration_idx on public.compliance_alerts(expiration_date, warning_bucket, alert_status);
create index if not exists compliance_score_snapshots_scope_idx on public.compliance_score_snapshots(scope_type, garden_id, calculated_at desc);
create index if not exists compliance_corrective_actions_scope_idx on public.compliance_corrective_actions(garden_id, status, priority, due_at);
create index if not exists compliance_report_requests_status_idx on public.compliance_report_requests(report_type, status, created_at desc);

alter table public.compliance_requirements enable row level security;
alter table public.compliance_alerts enable row level security;
alter table public.compliance_score_snapshots enable row level security;
alter table public.compliance_corrective_actions enable row level security;
alter table public.compliance_report_requests enable row level security;

drop policy if exists "compliance requirements authenticated read" on public.compliance_requirements;
create policy "compliance requirements authenticated read" on public.compliance_requirements for select using (auth.uid() is not null);
drop policy if exists "compliance requirements admin write" on public.compliance_requirements;
create policy "compliance requirements admin write" on public.compliance_requirements for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "compliance alerts scoped read" on public.compliance_alerts;
create policy "compliance alerts scoped read" on public.compliance_alerts
for select using (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)));
drop policy if exists "compliance alerts scoped write" on public.compliance_alerts;
create policy "compliance alerts scoped write" on public.compliance_alerts
for all using (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)))
with check (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)));

drop policy if exists "compliance scores scoped read" on public.compliance_score_snapshots;
create policy "compliance scores scoped read" on public.compliance_score_snapshots
for select using (public.is_admin() or garden_id is null or public.can_access_garden(garden_id));
drop policy if exists "compliance scores admin write" on public.compliance_score_snapshots;
create policy "compliance scores admin write" on public.compliance_score_snapshots for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "compliance actions scoped read" on public.compliance_corrective_actions;
create policy "compliance actions scoped read" on public.compliance_corrective_actions
for select using (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)) or assigned_to = auth.uid());
drop policy if exists "compliance actions scoped write" on public.compliance_corrective_actions;
create policy "compliance actions scoped write" on public.compliance_corrective_actions
for all using (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)) or assigned_to = auth.uid())
with check (public.is_admin() or (garden_id is not null and public.can_access_garden(garden_id)) or assigned_to = auth.uid());

drop policy if exists "compliance reports scoped read" on public.compliance_report_requests;
create policy "compliance reports scoped read" on public.compliance_report_requests
for select using (public.is_admin() or garden_id is null or public.can_access_garden(garden_id));
drop policy if exists "compliance reports scoped insert" on public.compliance_report_requests;
create policy "compliance reports scoped insert" on public.compliance_report_requests
for insert with check (public.is_admin() or garden_id is null or public.can_access_garden(garden_id));

insert into public.compliance_requirements (requirement_key, category, title, description, applies_to, required, warning_days, metadata)
values
  ('kindergarten-license', 'licenses', 'רישיון גן תקף', 'רישיון או אישור הפעלה תקף לגן.', 'kindergarten', true, array[90,60,30,14,7], '{}'::jsonb),
  ('kindergarten-insurance', 'insurance', 'ביטוח בתוקף', 'ביטוח אחריות וצד ג בתוקף.', 'kindergarten', true, array[90,60,30,14,7], '{}'::jsonb),
  ('staff-background-check', 'staff_certifications', 'בדיקת רקע לצוות', 'איש צוות חייב בדיקת רקע תקפה לפני עבודה.', 'staff', true, array[60,30,14,7], '{}'::jsonb),
  ('staff-police-clearance', 'staff_certifications', 'אישור יושר לצוות', 'אישור יושר/משטרה תקף לפי דרישות הגן.', 'staff', true, array[60,30,14,7], '{}'::jsonb),
  ('first-aid-certification', 'first_aid', 'עזרה ראשונה', 'תעודת עזרה ראשונה לצוות רלוונטי.', 'staff', true, array[90,60,30,14,7], '{}'::jsonb),
  ('mandatory-training', 'mandatory_training', 'הדרכת חובה', 'הדרכות בטיחות, פרטיות ונהלי גן.', 'staff', true, array[60,30,14,7], '{}'::jsonb),
  ('safety-procedures', 'safety_procedures', 'נהלי בטיחות מאושרים', 'נהלים מחייבים חייבים להיות פעילים ומאושרים.', 'kindergarten', true, array[30,14,7], '{}'::jsonb),
  ('inspection-current', 'inspection_requirements', 'פיקוח עדכני', 'גן חייב פיקוח פעיל וללא איחור.', 'kindergarten', true, array[30,14,7], '{}'::jsonb),
  ('legal-documents', 'legal_documents', 'מסמכים משפטיים', 'מסמכי הסכמה, פרטיות וציות בתוקף.', 'kindergarten', true, array[90,60,30,14,7], '{}'::jsonb)
on conflict (requirement_key) do update set
  category = excluded.category,
  title = excluded.title,
  description = excluded.description,
  applies_to = excluded.applies_to,
  required = excluded.required,
  warning_days = excluded.warning_days,
  updated_at = now();

insert into public.compliance_alerts (garden_id, staff_id, source_table, source_id, category, title, description, severity, alert_status, expiration_date, warning_bucket, metadata)
select d.garden_id, d.staff_id, 'documents', d.id, 'legal_documents', d.name, d.document_type,
  case
    when d.expires_at < current_date then 'critical'
    when d.expires_at <= current_date + interval '7 days' then 'high'
    when d.expires_at <= current_date + interval '30 days' then 'medium'
    else 'low'
  end,
  'open',
  d.expires_at,
  case
    when d.expires_at < current_date then 'expired'
    when d.expires_at <= current_date + interval '7 days' then '7_days'
    when d.expires_at <= current_date + interval '14 days' then '14_days'
    when d.expires_at <= current_date + interval '30 days' then '30_days'
    when d.expires_at <= current_date + interval '60 days' then '60_days'
    when d.expires_at <= current_date + interval '90 days' then '90_days'
    else 'future'
  end,
  jsonb_build_object('source', 'documents')
from public.documents d
where d.garden_id is not null
  and d.expires_at is not null
  and d.expires_at <= current_date + interval '90 days'
  and not exists (select 1 from public.compliance_alerts a where a.source_table = 'documents' and a.source_id = d.id);

insert into public.compliance_alerts (garden_id, staff_id, source_table, source_id, category, title, description, severity, alert_status, expiration_date, warning_bucket, metadata)
select c.garden_id, c.staff_id, 'staff_certificates', c.id, 'staff_certifications', c.certificate_type, 'תעודת צוות עומדת לפוג או פגה.',
  case
    when c.expires_at < current_date then 'critical'
    when c.expires_at <= current_date + interval '7 days' then 'high'
    when c.expires_at <= current_date + interval '30 days' then 'medium'
    else 'low'
  end,
  'open',
  c.expires_at,
  case
    when c.expires_at < current_date then 'expired'
    when c.expires_at <= current_date + interval '7 days' then '7_days'
    when c.expires_at <= current_date + interval '14 days' then '14_days'
    when c.expires_at <= current_date + interval '30 days' then '30_days'
    when c.expires_at <= current_date + interval '60 days' then '60_days'
    when c.expires_at <= current_date + interval '90 days' then '90_days'
    else 'future'
  end,
  jsonb_build_object('source', 'staff_certificates')
from public.staff_certificates c
where c.expires_at is not null
  and c.expires_at <= current_date + interval '90 days'
  and not exists (select 1 from public.compliance_alerts a where a.source_table = 'staff_certificates' and a.source_id = c.id);

insert into public.compliance_corrective_actions (alert_id, garden_id, assigned_to, action_title, action_description, status, priority, due_at, metadata)
select a.id, a.garden_id, a.assigned_to, a.title, coalesce(a.description, 'נדרש טיפול בציות.'), 'identified', a.severity, coalesce(a.due_at, a.expiration_date::timestamptz), jsonb_build_object('source', 'compliance_alerts')
from public.compliance_alerts a
where a.alert_status in ('open','in_progress')
  and not exists (select 1 from public.compliance_corrective_actions ca where ca.alert_id = a.id);

comment on table public.compliance_requirements is 'Compliance catalog for licenses, insurance, staff certifications, training, procedures, inspections and legal documents.';
comment on table public.compliance_alerts is 'Proactive compliance alerts for expiring, expired, missing or unresolved requirements.';
comment on table public.compliance_score_snapshots is '0-100 compliance scores by national, region or kindergarten scope.';
comment on table public.compliance_corrective_actions is 'Corrective action lifecycle: identified, assigned, verification and closure.';
comment on table public.compliance_report_requests is 'Readiness table for monthly, annual, kindergarten, regional and national compliance reports.';
