-- PHASE 113: Incident Investigation & Case Management Center
-- Evidence and case tracking only. No automatic conclusions, blame assignment, or disciplinary decisions.

create table if not exists public.incident_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  incident_type text not null,
  severity text not null default 'medium',
  status text not null default 'reported',
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  source_type text not null default 'manual',
  source_id uuid,
  title text not null,
  summary text,
  assigned_inspector_id uuid references public.profiles(id) on delete set null,
  assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  parent_visible_status text not null default 'received',
  parent_update_summary text,
  ai_summary text,
  ai_summary_reviewed boolean not null default false,
  no_automatic_conclusions boolean not null default true,
  no_blame_assigned boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_cases_type_check check (incident_type in (
    'injury',
    'safety_concern',
    'complaint',
    'pickup_incident',
    'health_incident',
    'observer_alert',
    'camera_incident',
    'staff_incident',
    'compliance_incident'
  )),
  constraint incident_cases_severity_check check (severity in ('low','medium','high','critical')),
  constraint incident_cases_status_check check (status in ('reported','under_review','investigating','evidence_collection','pending_decision','resolved','closed')),
  constraint incident_cases_source_check check (source_type in ('manual','incident_report','complaint','observer_signal','camera_snapshot','inspection_report')),
  constraint incident_cases_parent_status_check check (parent_visible_status in ('received','under_review','resolved','closed','not_visible'))
);

create table if not exists public.incident_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.incident_cases(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  evidence_type text not null,
  title text not null,
  description text,
  source_type text not null default 'manual',
  source_id uuid,
  storage_bucket text,
  storage_path text,
  external_reference text,
  captured_at timestamptz,
  uploaded_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  visibility text not null default 'internal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint incident_case_evidence_type_check check (evidence_type in ('photo','document','video','camera_clip','camera_snapshot','observer_event','inspection_report','witness_note','timeline_note')),
  constraint incident_case_evidence_source_check check (source_type in ('manual','incident_report','complaint','observer_signal','camera_snapshot','inspection_report','document','camera_stream')),
  constraint incident_case_evidence_visibility_check check (visibility in ('internal','inspector','manager','approved_parent_update'))
);

create table if not exists public.incident_case_timeline (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.incident_cases(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  event_type text not null,
  title text not null,
  description text,
  actor_id uuid references public.profiles(id) on delete set null,
  related_evidence_id uuid references public.incident_case_evidence(id) on delete set null,
  old_status text,
  new_status text,
  parent_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint incident_case_timeline_type_check check (event_type in (
    'case_created',
    'status_changed',
    'evidence_added',
    'review_completed',
    'inspection_performed',
    'decision_recorded',
    'correction_assigned',
    'correction_completed',
    'case_closed',
    'parent_update_approved'
  ))
);

create table if not exists public.incident_case_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.incident_cases(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  action_title text not null,
  action_description text,
  severity text not null default 'medium',
  status text not null default 'assigned',
  responsible_profile_id uuid references public.profiles(id) on delete set null,
  assigned_by uuid references public.profiles(id) on delete set null,
  verified_by uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  evidence_required boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incident_case_action_severity_check check (severity in ('low','medium','high','critical')),
  constraint incident_case_action_status_check check (status in ('assigned','in_progress','waiting_verification','verified','closed','dismissed'))
);

create unique index if not exists incident_cases_source_unique_idx
  on public.incident_cases(source_type, source_id)
  where source_id is not null;
create index if not exists incident_cases_garden_status_idx on public.incident_cases(garden_id, status, severity, created_at desc);
create index if not exists incident_case_evidence_case_idx on public.incident_case_evidence(case_id, evidence_type, created_at desc);
create unique index if not exists incident_case_evidence_source_unique_idx
  on public.incident_case_evidence(case_id, evidence_type, source_type, source_id)
  where source_id is not null;
create index if not exists incident_case_timeline_case_idx on public.incident_case_timeline(case_id, created_at desc);
create unique index if not exists incident_case_timeline_case_created_unique_idx
  on public.incident_case_timeline(case_id, event_type)
  where event_type = 'case_created';
create unique index if not exists incident_case_timeline_evidence_unique_idx
  on public.incident_case_timeline(related_evidence_id, event_type)
  where related_evidence_id is not null;
create index if not exists incident_case_actions_case_idx on public.incident_case_corrective_actions(case_id, status, due_at);
create unique index if not exists incident_case_actions_seed_unique_idx
  on public.incident_case_corrective_actions(case_id, action_title);

alter table public.incident_cases enable row level security;
alter table public.incident_case_evidence enable row level security;
alter table public.incident_case_timeline enable row level security;
alter table public.incident_case_corrective_actions enable row level security;

drop policy if exists "incident cases scoped read" on public.incident_cases;
create policy "incident cases scoped read" on public.incident_cases
for select using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "incident cases scoped write" on public.incident_cases;
create policy "incident cases scoped write" on public.incident_cases
for all using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "incident case evidence scoped read" on public.incident_case_evidence;
create policy "incident case evidence scoped read" on public.incident_case_evidence
for select using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "incident case evidence scoped write" on public.incident_case_evidence;
create policy "incident case evidence scoped write" on public.incident_case_evidence
for all using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "incident case timeline scoped read" on public.incident_case_timeline;
create policy "incident case timeline scoped read" on public.incident_case_timeline
for select using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "incident case timeline scoped write" on public.incident_case_timeline;
create policy "incident case timeline scoped write" on public.incident_case_timeline
for all using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "incident case actions scoped read" on public.incident_case_corrective_actions;
create policy "incident case actions scoped read" on public.incident_case_corrective_actions
for select using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

drop policy if exists "incident case actions scoped write" on public.incident_case_corrective_actions;
create policy "incident case actions scoped write" on public.incident_case_corrective_actions
for all using (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or (public.current_role() in ('manager','owner','inspector') and public.can_access_garden(garden_id))
);

insert into public.incident_cases (
  case_number, incident_type, severity, status, garden_id, child_id, source_type, source_id, title, summary,
  assigned_reviewer_id, created_by, parent_visible_status, metadata, created_at, updated_at
)
select
  concat('IC-', to_char(coalesce(ir.created_at, now()), 'YYYYMMDD'), '-', left(ir.id::text, 8)),
  case
    when ir.incident_type::text in ('injury','health_incident','pickup_incident','camera_incident','staff_incident','compliance_incident') then ir.incident_type::text
    when ir.incident_type::text in ('medical','health') then 'health_incident'
    when ir.incident_type::text in ('pickup','pickup_issue') then 'pickup_incident'
    when ir.incident_type::text in ('camera','observer') then 'camera_incident'
    else 'safety_concern'
  end,
  case when ir.severity::text in ('low','medium','high','critical') then ir.severity::text else 'medium' end,
  case when ir.status::text in ('closed','resolved') then 'closed' when ir.status::text in ('in_progress','open') then 'investigating' else 'reported' end,
  ir.garden_id,
  ir.child_id,
  'incident_report',
  ir.id,
  ir.title,
  ir.description,
  ir.assigned_to,
  ir.reported_by,
  case when ir.parent_notified is true then 'under_review' else 'not_visible' end,
  jsonb_build_object('source_status', ir.status, 'source_timeline', ir.timeline, 'no_automatic_conclusions', true),
  ir.created_at,
  ir.updated_at
from public.incident_reports ir
where ir.garden_id is not null
on conflict (source_type, source_id) where source_id is not null do update set
  severity = excluded.severity,
  status = excluded.status,
  title = excluded.title,
  summary = excluded.summary,
  updated_at = now();

insert into public.incident_cases (
  case_number, incident_type, severity, status, garden_id, child_id, source_type, source_id, title, summary,
  assigned_reviewer_id, parent_visible_status, metadata, created_at, updated_at
)
select
  concat('IC-', to_char(coalesce(c.created_at, now()), 'YYYYMMDD'), '-', left(c.id::text, 8)),
  case
    when c.category::text in ('pickup') then 'pickup_incident'
    when c.category::text in ('medical','health') then 'health_incident'
    when c.category::text in ('camera') then 'camera_incident'
    when c.category::text in ('staff') then 'staff_incident'
    when c.category::text in ('safety','violence') then 'safety_concern'
    else 'complaint'
  end,
  case when c.severity::text in ('low','medium','high','critical') then c.severity::text else 'medium' end,
  case when c.status::text in ('closed','resolved') then 'closed' when c.status::text in ('in_progress','waiting_user') then 'under_review' else 'reported' end,
  c.garden_id,
  c.child_id,
  'complaint',
  c.id,
  coalesce(c.subject, 'פנייה לבדיקה'),
  coalesce(c.description, c.internal_notes),
  c.assigned_to,
  case when c.status::text in ('closed','resolved') then 'resolved' when c.status::text in ('in_progress','waiting_user') then 'under_review' else 'received' end,
  jsonb_build_object('source_status', c.status, 'parent_visible_source', true, 'internal_data_hidden_from_parent', true),
  c.created_at,
  coalesce(c.updated_at, c.last_response_at, c.created_at)
from public.complaints c
where c.garden_id is not null
on conflict (source_type, source_id) where source_id is not null do update set
  severity = excluded.severity,
  status = excluded.status,
  title = excluded.title,
  summary = excluded.summary,
  updated_at = now();

insert into public.incident_case_evidence (case_id, garden_id, evidence_type, title, description, source_type, source_id, visibility, metadata, created_at)
select c.id, c.garden_id, 'timeline_note', 'דיווח מקור', c.summary, c.source_type, c.source_id, 'internal', jsonb_build_object('source_type', c.source_type), c.created_at
from public.incident_cases c
where c.source_id is not null
on conflict do nothing;

insert into public.incident_case_evidence (case_id, garden_id, evidence_type, title, description, source_type, source_id, visibility, metadata, created_at)
select c.id, c.garden_id, 'observer_event', 'סימן תצפיתן מומלץ לבדיקה', s.recommended_action, 'observer_signal', s.id, 'internal', jsonb_build_object('risk_score', s.risk_score, 'review_status', s.review_status), s.created_at
from public.incident_cases c
join public.observer_intelligence_signals s on s.kindergarten_id = c.garden_id
where c.status in ('reported','under_review','investigating','evidence_collection')
  and s.review_status in ('needs_review','reviewing','escalated')
on conflict do nothing;

insert into public.incident_case_timeline (case_id, garden_id, event_type, title, description, actor_id, new_status, parent_visible, metadata, created_at)
select id, garden_id, 'case_created', 'נפתח תיק בדיקה', 'תיק נוצר ממקור קיים לצורך תיעוד, ראיות ומעקב אנושי.', created_by, status, false, jsonb_build_object('source_type', source_type), created_at
from public.incident_cases
on conflict do nothing;

insert into public.incident_case_timeline (case_id, garden_id, event_type, title, description, related_evidence_id, parent_visible, metadata, created_at)
select e.case_id, e.garden_id, 'evidence_added', 'ראיה נוספה', e.title, e.id, false, jsonb_build_object('evidence_type', e.evidence_type), e.created_at
from public.incident_case_evidence e
on conflict do nothing;

insert into public.incident_case_corrective_actions (case_id, garden_id, action_title, action_description, severity, status, due_at, metadata)
select id, garden_id,
  case when severity in ('high','critical') then 'בדיקה והחלטה אנושית' else 'השלמת תיעוד וסיכום' end,
  'פעולה ראשונית לתיק: לבדוק ראיות, להשלים ציר זמן ולתעד החלטה ללא הסקת מסקנות אוטומטית.',
  severity,
  'assigned',
  now() + case when severity = 'critical' then interval '24 hours' when severity = 'high' then interval '72 hours' else interval '7 days' end,
  jsonb_build_object('auto_seeded', true, 'requires_human_review', true)
from public.incident_cases
where status not in ('resolved','closed')
on conflict do nothing;

comment on table public.incident_cases is 'Human-review incident case management. No automatic conclusions, blame assignment, or disciplinary action.';
comment on table public.incident_case_evidence is 'Evidence linked to incident cases. Internal by default; parent visibility only through approved summaries.';
comment on table public.incident_case_timeline is 'Case lifecycle timeline for auditability and PDF-ready reporting.';
comment on table public.incident_case_corrective_actions is 'Corrective actions linked to incident cases and requiring verification.';
