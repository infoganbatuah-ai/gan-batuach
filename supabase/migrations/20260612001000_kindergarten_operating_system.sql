create table if not exists public.daily_operations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  operation_date date not null default current_date,
  attendance_completion integer not null default 0,
  staff_readiness integer not null default 0,
  child_updates_completion integer not null default 0,
  health_updates_completion integer not null default 0,
  inspections_due integer not null default 0,
  compliance_issues integer not null default 0,
  incidents_open integer not null default 0,
  observer_alerts integer not null default 0,
  payment_issues integer not null default 0,
  communication_items integer not null default 0,
  operational_status text not null default 'needs_attention',
  generated_from jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, operation_date)
);

create table if not exists public.kindergarten_operational_health_scores (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  snapshot_date date not null default current_date,
  kindergarten_operational_health_score integer not null default 0,
  attendance_component integer not null default 0,
  compliance_component integer not null default 0,
  inspection_component integer not null default 0,
  incident_component integer not null default 0,
  communication_component integer not null default 0,
  observer_component integer not null default 0,
  parent_engagement_component integer not null default 0,
  safety_component integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(garden_id, snapshot_date)
);

create table if not exists public.operational_workflow_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  workflow_key text not null,
  event_title text not null,
  event_status text not null default 'open',
  task_id uuid references public.tasks(id) on delete set null,
  notification_id uuid references public.notifications(id) on delete set null,
  review_status text not null default 'needs_review',
  closure_status text not null default 'open',
  assigned_role public.app_role,
  assigned_to uuid references public.profiles(id) on delete set null,
  due_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(garden_id, workflow_key)
);

alter table public.daily_operations drop constraint if exists daily_operations_scores_check;
alter table public.daily_operations add constraint daily_operations_scores_check check (
  attendance_completion between 0 and 100
  and staff_readiness between 0 and 100
  and child_updates_completion between 0 and 100
  and health_updates_completion between 0 and 100
);

alter table public.daily_operations drop constraint if exists daily_operations_status_check;
alter table public.daily_operations add constraint daily_operations_status_check check (operational_status in ('healthy','needs_attention','at_risk','blocked'));

alter table public.kindergarten_operational_health_scores drop constraint if exists kindergarten_operational_health_score_check;
alter table public.kindergarten_operational_health_scores add constraint kindergarten_operational_health_score_check check (
  kindergarten_operational_health_score between 0 and 100
  and attendance_component between 0 and 100
  and compliance_component between 0 and 100
  and inspection_component between 0 and 100
  and incident_component between 0 and 100
  and communication_component between 0 and 100
  and observer_component between 0 and 100
  and parent_engagement_component between 0 and 100
  and safety_component between 0 and 100
);

alter table public.operational_workflow_events drop constraint if exists operational_workflow_source_type_check;
alter table public.operational_workflow_events add constraint operational_workflow_source_type_check check (source_type in (
  'inspections',
  'compliance',
  'ai_recommendations',
  'incidents',
  'documents',
  'communications',
  'observer',
  'payments',
  'children',
  'staff',
  'parents'
));

alter table public.operational_workflow_events drop constraint if exists operational_workflow_event_status_check;
alter table public.operational_workflow_events add constraint operational_workflow_event_status_check check (event_status in ('open','in_progress','waiting_review','completed','dismissed'));

alter table public.operational_workflow_events drop constraint if exists operational_workflow_review_status_check;
alter table public.operational_workflow_events add constraint operational_workflow_review_status_check check (review_status in ('not_required','needs_review','reviewing','approved','returned','rejected'));

alter table public.operational_workflow_events drop constraint if exists operational_workflow_closure_status_check;
alter table public.operational_workflow_events add constraint operational_workflow_closure_status_check check (closure_status in ('open','ready_to_close','closed','reopened'));

create index if not exists daily_operations_garden_date_idx on public.daily_operations(garden_id, operation_date desc);
create index if not exists kindergarten_operational_health_garden_date_idx on public.kindergarten_operational_health_scores(garden_id, snapshot_date desc);
create index if not exists operational_workflow_events_garden_status_idx on public.operational_workflow_events(garden_id, event_status, created_at desc);
create index if not exists operational_workflow_events_source_idx on public.operational_workflow_events(source_type, source_id);

alter table public.daily_operations enable row level security;
alter table public.kindergarten_operational_health_scores enable row level security;
alter table public.operational_workflow_events enable row level security;

drop policy if exists "daily operations scoped read" on public.daily_operations;
create policy "daily operations scoped read" on public.daily_operations
  for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "daily operations scoped write" on public.daily_operations;
create policy "daily operations scoped write" on public.daily_operations
  for all using (public.is_admin() or public.can_access_garden(garden_id))
  with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "operational health scoped read" on public.kindergarten_operational_health_scores;
create policy "operational health scoped read" on public.kindergarten_operational_health_scores
  for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "operational health scoped write" on public.kindergarten_operational_health_scores;
create policy "operational health scoped write" on public.kindergarten_operational_health_scores
  for all using (public.is_admin() or public.can_access_garden(garden_id))
  with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "operational workflow scoped read" on public.operational_workflow_events;
create policy "operational workflow scoped read" on public.operational_workflow_events
  for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "operational workflow scoped write" on public.operational_workflow_events;
create policy "operational workflow scoped write" on public.operational_workflow_events
  for all using (public.is_admin() or public.can_access_garden(garden_id))
  with check (public.is_admin() or public.can_access_garden(garden_id));

insert into public.daily_operations (
  garden_id,
  operation_date,
  attendance_completion,
  staff_readiness,
  child_updates_completion,
  health_updates_completion,
  inspections_due,
  compliance_issues,
  incidents_open,
  observer_alerts,
  payment_issues,
  communication_items,
  operational_status,
  generated_from
)
select
  g.id,
  current_date,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  'needs_attention',
  '{"source":"phase_119_seed","note":"live dashboard recalculates from operational tables"}'::jsonb
from public.gardens g
on conflict (garden_id, operation_date) do nothing;

insert into public.kindergarten_operational_health_scores (
  garden_id,
  snapshot_date,
  kindergarten_operational_health_score,
  attendance_component,
  compliance_component,
  inspection_component,
  incident_component,
  communication_component,
  observer_component,
  parent_engagement_component,
  safety_component,
  metadata
)
select
  g.id,
  current_date,
  60,
  60,
  60,
  60,
  60,
  60,
  60,
  60,
  60,
  '{"source":"phase_119_seed","explainable":true}'::jsonb
from public.gardens g
on conflict (garden_id, snapshot_date) do nothing;

insert into public.operational_workflow_events (
  garden_id,
  source_type,
  source_id,
  workflow_key,
  event_title,
  event_status,
  task_id,
  review_status,
  closure_status,
  assigned_role,
  due_at,
  metadata
)
select
  t.garden_id,
  case
    when t.source_entity_type in ('inspections','compliance','ai_recommendations','incidents','documents','communications','observer','payments','children','staff','parents') then t.source_entity_type
    when t.source_entity_type in ('inspection','required_inspections','violations') then 'inspections'
    when t.source_entity_type in ('document','policy','procedure') then 'documents'
    when t.source_entity_type in ('ai_events','audio_events','observer_signals','observer_intelligence_signals') then 'observer'
    when t.source_entity_type in ('incident','incident_cases','complaints') then 'incidents'
    else 'communications'
  end,
  t.source_entity_id,
  'task:' || t.id::text,
  t.title,
  case when t.status::text in ('done','completed','closed') then 'completed' else 'open' end,
  t.id,
  case when t.status::text in ('done','completed','closed') then 'approved' else 'needs_review' end,
  case when t.status::text in ('done','completed','closed') then 'closed' else 'open' end,
  null,
  t.due_at,
  jsonb_build_object('task_status', t.status::text, 'category', coalesce(t.task_type, 'general'))
from public.tasks t
where t.garden_id is not null
on conflict (garden_id, workflow_key) do nothing;

comment on table public.daily_operations is 'Daily kindergarten operating snapshot for the unified KOS command center.';
comment on table public.kindergarten_operational_health_scores is 'Explainable 0-100 kindergarten operating health score.';
comment on table public.operational_workflow_events is 'Unified workflow orchestration layer connecting events, tasks, notifications, review and closure.';
