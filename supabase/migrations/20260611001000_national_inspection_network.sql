-- PHASE 107: National Inspection Network
-- Adds national inspection planning, assignment history, compliance and recommendation readiness.
-- Existing inspection, violation and complaint workflows remain intact.

create table if not exists public.inspection_regions (
  id uuid primary key default gen_random_uuid(),
  country text not null default 'ישראל',
  region_name text not null,
  municipality text,
  city text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(country, region_name, municipality, city)
);

create table if not exists public.inspector_assignment_history (
  id uuid primary key default gen_random_uuid(),
  inspector_id uuid not null references public.profiles(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  region_id uuid references public.inspection_regions(id) on delete set null,
  assignment_scope text not null default 'kindergarten',
  assignment_type text not null default 'primary',
  municipality text,
  city text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by uuid references public.profiles(id) on delete set null,
  reason text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspector_assignment_scope_check check (assignment_scope in ('kindergarten','region','municipality','city','country')),
  constraint inspector_assignment_type_check check (assignment_type in ('primary','temporary','backup','follow_up','complaint_response')),
  constraint inspector_assignment_target_check check (garden_id is not null or region_id is not null or city is not null or municipality is not null)
);

create table if not exists public.national_inspection_plans (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  region_id uuid references public.inspection_regions(id) on delete set null,
  inspector_id uuid references public.profiles(id) on delete set null,
  plan_type text not null default 'monthly',
  priority text not null default 'normal',
  scheduled_for timestamptz,
  due_at timestamptz,
  status text not null default 'planned',
  source_type text not null default 'manual',
  source_entity_type text,
  source_entity_id uuid,
  recommended_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_inspection_plan_type_check check (plan_type in ('monthly','surprise','follow_up','complaint_driven','ai_triggered','verification')),
  constraint national_inspection_plan_priority_check check (priority in ('low','normal','high','urgent')),
  constraint national_inspection_plan_status_check check (status in ('planned','assigned','in_progress','completed','cancelled','overdue')),
  constraint national_inspection_plan_source_check check (source_type in ('manual','schedule','complaint','observer','incident','risk_engine'))
);

create table if not exists public.national_compliance_findings (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  violation_id uuid references public.violations(id) on delete set null,
  complaint_id uuid references public.complaints(id) on delete set null,
  ai_event_id uuid references public.ai_events(id) on delete set null,
  severity text not null default 'medium',
  title text not null,
  description text,
  responsible_party text,
  due_at timestamptz,
  evidence jsonb not null default '[]'::jsonb,
  resolution_status text not null default 'open',
  resolved_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint national_finding_severity_check check (severity in ('low','medium','high','critical')),
  constraint national_finding_status_check check (resolution_status in ('open','in_progress','resolved','verified'))
);

create table if not exists public.inspection_follow_up_actions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid references public.national_compliance_findings(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  action_type text not null default 'corrective_action_request',
  status text not null default 'open',
  requested_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  verification_inspection_id uuid references public.inspections(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_follow_up_type_check check (action_type in ('corrective_action_request','verification_inspection','closure_verification','information_request')),
  constraint inspection_follow_up_status_check check (status in ('open','in_progress','resolved','verified','cancelled'))
);

create table if not exists public.complaint_inspection_escalations (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  escalation_type text not null default 'review',
  status text not null default 'open',
  requested_information text,
  inspection_plan_id uuid references public.national_inspection_plans(id) on delete set null,
  escalated_by uuid references public.profiles(id) on delete set null,
  escalated_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaint_inspection_escalation_type_check check (escalation_type in ('review','request_information','schedule_inspection','urgent_escalation')),
  constraint complaint_inspection_escalation_status_check check (status in ('open','in_progress','scheduled','resolved','closed'))
);

create table if not exists public.observer_inspection_recommendations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  ai_event_id uuid references public.ai_events(id) on delete set null,
  recommendation_type text not null default 'inspection_review',
  risk_reason text not null,
  risk_score integer not null default 0,
  status text not null default 'new',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  inspection_plan_id uuid references public.national_inspection_plans(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_inspection_risk_score_check check (risk_score between 0 and 100),
  constraint observer_inspection_recommendation_type_check check (recommendation_type in ('inspection_review','follow_up','urgent_safety_review','pattern_review')),
  constraint observer_inspection_recommendation_status_check check (status in ('new','reviewing','planned','dismissed','completed'))
);

create index if not exists inspection_regions_lookup_idx on public.inspection_regions(country, region_name, municipality, city);
create index if not exists inspector_assignment_active_idx on public.inspector_assignment_history(inspector_id, active, assignment_scope, starts_at desc);
create index if not exists inspector_assignment_garden_idx on public.inspector_assignment_history(garden_id, active, assignment_type);
create index if not exists national_inspection_plans_status_idx on public.national_inspection_plans(status, plan_type, due_at);
create index if not exists national_inspection_plans_garden_idx on public.national_inspection_plans(garden_id, priority, due_at);
create index if not exists national_compliance_findings_garden_idx on public.national_compliance_findings(garden_id, resolution_status, severity, due_at);
create index if not exists inspection_follow_up_actions_status_idx on public.inspection_follow_up_actions(status, due_at);
create index if not exists complaint_inspection_escalations_status_idx on public.complaint_inspection_escalations(status, escalation_type, escalated_at desc);
create index if not exists observer_inspection_recommendations_risk_idx on public.observer_inspection_recommendations(status, risk_score desc, created_at desc);

alter table public.inspection_regions enable row level security;
alter table public.inspector_assignment_history enable row level security;
alter table public.national_inspection_plans enable row level security;
alter table public.national_compliance_findings enable row level security;
alter table public.inspection_follow_up_actions enable row level security;
alter table public.complaint_inspection_escalations enable row level security;
alter table public.observer_inspection_recommendations enable row level security;

drop policy if exists "inspection regions admin read" on public.inspection_regions;
create policy "inspection regions admin read" on public.inspection_regions
for select using (public.is_admin() or public.current_role() = 'inspector');

drop policy if exists "inspection regions admin write" on public.inspection_regions;
create policy "inspection regions admin write" on public.inspection_regions
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "inspector assignments scoped read" on public.inspector_assignment_history;
create policy "inspector assignments scoped read" on public.inspector_assignment_history
for select using (
  public.is_admin()
  or inspector_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "inspector assignments admin write" on public.inspector_assignment_history;
create policy "inspector assignments admin write" on public.inspector_assignment_history
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "national inspection plans scoped read" on public.national_inspection_plans;
create policy "national inspection plans scoped read" on public.national_inspection_plans
for select using (
  public.is_admin()
  or inspector_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "national inspection plans admin write" on public.national_inspection_plans;
create policy "national inspection plans admin write" on public.national_inspection_plans
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "national findings scoped read" on public.national_compliance_findings;
create policy "national findings scoped read" on public.national_compliance_findings
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "national findings admin inspector write" on public.national_compliance_findings;
create policy "national findings admin inspector write" on public.national_compliance_findings
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "follow up actions scoped read" on public.inspection_follow_up_actions;
create policy "follow up actions scoped read" on public.inspection_follow_up_actions
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "follow up actions admin inspector write" on public.inspection_follow_up_actions;
create policy "follow up actions admin inspector write" on public.inspection_follow_up_actions
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "complaint inspection escalations scoped read" on public.complaint_inspection_escalations;
create policy "complaint inspection escalations scoped read" on public.complaint_inspection_escalations
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "complaint inspection escalations admin inspector write" on public.complaint_inspection_escalations;
create policy "complaint inspection escalations admin inspector write" on public.complaint_inspection_escalations
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "observer inspection recommendations scoped read" on public.observer_inspection_recommendations;
create policy "observer inspection recommendations scoped read" on public.observer_inspection_recommendations
for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "observer inspection recommendations admin inspector write" on public.observer_inspection_recommendations;
create policy "observer inspection recommendations admin inspector write" on public.observer_inspection_recommendations
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

insert into public.inspection_regions (country, region_name, municipality, city, metadata)
select 'ישראל', 'מרכז', null, g.city, jsonb_build_object('seeded_from', 'gardens')
from public.gardens g
where g.city is not null and btrim(g.city) <> ''
on conflict (country, region_name, municipality, city) do update set
  active = true,
  updated_at = now();

insert into public.inspector_assignment_history (
  inspector_id,
  garden_id,
  assignment_scope,
  assignment_type,
  city,
  starts_at,
  reason,
  active,
  metadata
)
select
  g.inspector_id,
  g.id,
  'kindergarten',
  'primary',
  g.city,
  coalesce(g.created_at, now()),
  'Existing kindergarten inspector assignment backfill.',
  true,
  jsonb_build_object('source', 'gardens.inspector_id')
from public.gardens g
where g.inspector_id is not null
on conflict do nothing;

insert into public.national_compliance_findings (
  garden_id,
  inspection_id,
  violation_id,
  severity,
  title,
  description,
  responsible_party,
  due_at,
  evidence,
  resolution_status,
  resolved_at,
  verified_at,
  verified_by,
  metadata
)
select
  v.garden_id,
  v.inspection_id,
  v.id,
  v.severity::text,
  v.title,
  v.description,
  'kindergarten',
  v.correction_due_at,
  v.correction_files,
  case
    when v.status::text in ('done', 'completed') and v.approved_at is not null then 'verified'
    when v.status::text in ('done', 'completed') then 'resolved'
    when v.status::text in ('in_progress') then 'in_progress'
    else 'open'
  end,
  case when v.status::text in ('done', 'completed') then v.updated_at else null end,
  v.approved_at,
  v.approved_by,
  jsonb_build_object('source', 'violations')
from public.violations v
where not exists (
  select 1 from public.national_compliance_findings f where f.violation_id = v.id
);

insert into public.observer_inspection_recommendations (
  garden_id,
  ai_event_id,
  recommendation_type,
  risk_reason,
  risk_score,
  status,
  metadata
)
select
  e.garden_id,
  e.id,
  case when e.severity::text = 'critical' then 'urgent_safety_review' else 'inspection_review' end,
  'Observer event requires human review before any inspection decision.',
  case e.severity::text
    when 'critical' then 90
    when 'high' then 76
    when 'medium' then 55
    else 35
  end,
  'new',
  jsonb_build_object('source', 'ai_events', 'autonomous_action', false)
from public.ai_events e
where e.status::text not in ('done', 'completed')
  and e.severity::text in ('medium','high','critical')
  and not exists (
    select 1 from public.observer_inspection_recommendations r where r.ai_event_id = e.id
  );

comment on table public.inspection_regions is 'National inspection hierarchy: country, region, municipality, city and kindergarten.';
comment on table public.inspector_assignment_history is 'Assignment history for inspectors by kindergarten, city, municipality, region, temporary and backup assignments.';
comment on table public.national_inspection_plans is 'Calendar/planning layer for monthly, surprise, follow-up, complaint-driven and observer-recommended inspections.';
comment on table public.national_compliance_findings is 'National findings lifecycle layered on top of existing violations, complaints, inspections and observer events.';
comment on table public.inspection_follow_up_actions is 'Corrective action and verification lifecycle for national compliance findings.';
comment on table public.complaint_inspection_escalations is 'Complaint escalation workflow connecting parent complaints to inspection review/planning.';
comment on table public.observer_inspection_recommendations is 'Human-review-only inspection recommendations from observer signals. No autonomous actions.';
