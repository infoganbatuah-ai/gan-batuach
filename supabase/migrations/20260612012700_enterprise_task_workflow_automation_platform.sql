-- PHASE 127: Enterprise task, workflow and automation platform.
-- Additive workflow layer that unifies tasks, approvals, escalations and auditability.

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  description text,
  workflow_type text not null default 'general',
  default_priority text not null default 'medium',
  default_sla_hours integer not null default 72,
  steps jsonb not null default '[]'::jsonb,
  automation_ready boolean not null default true,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_templates_type_check check (workflow_type in (
    'onboarding',
    'inspection',
    'complaint',
    'incident',
    'compliance',
    'document_renewal',
    'communication',
    'ai_recommendation',
    'observer_alert',
    'general'
  )),
  constraint workflow_templates_priority_check check (default_priority in ('low','medium','high','critical'))
);

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.workflow_templates(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  assigned_role public.app_role,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  workflow_type text not null default 'general',
  title text not null,
  summary text,
  trigger_type text not null default 'manual',
  source_entity_type text,
  source_entity_id uuid,
  priority text not null default 'medium',
  status text not null default 'active',
  sla_due_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflows_type_check check (workflow_type in (
    'onboarding',
    'inspection',
    'complaint',
    'incident',
    'compliance',
    'document_renewal',
    'communication',
    'ai_recommendation',
    'observer_alert',
    'general'
  )),
  constraint workflows_priority_check check (priority in ('low','medium','high','critical')),
  constraint workflows_status_check check (status in ('draft','active','waiting_approval','blocked','overdue','completed','closed','cancelled'))
);

create table if not exists public.workflow_tasks (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflows(id) on delete cascade,
  legacy_task_id uuid references public.tasks(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  staff_id uuid references public.staff(id) on delete set null,
  assigned_role public.app_role,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  task_type text not null default 'general',
  title text not null,
  description text,
  priority text not null default 'medium',
  status text not null default 'open',
  due_at timestamptz,
  response_target_at timestamptz,
  completion_target_at timestamptz,
  escalation_target_at timestamptz,
  requires_approval boolean not null default false,
  requires_verification boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  blocked_reason text,
  outcome_notes text,
  source_entity_type text,
  source_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_tasks_priority_check check (priority in ('low','medium','high','critical')),
  constraint workflow_tasks_status_check check (status in ('open','in_progress','waiting_approval','blocked','overdue','done','rejected','cancelled'))
);

create table if not exists public.workflow_approvals (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflows(id) on delete cascade,
  workflow_task_id uuid references public.workflow_tasks(id) on delete cascade,
  approval_type text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  approver_role public.app_role,
  approver_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  decision_note text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint workflow_approvals_status_check check (status in ('pending','approved','returned','rejected','cancelled'))
);

create table if not exists public.workflow_sla_rules (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null,
  priority text not null default 'medium',
  response_hours integer not null default 24,
  completion_hours integer not null default 72,
  escalation_hours integer not null default 96,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_type, priority),
  constraint workflow_sla_priority_check check (priority in ('low','medium','high','critical'))
);

create table if not exists public.workflow_automation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  name text not null,
  description text,
  trigger_event text not null,
  condition_payload jsonb not null default '{}'::jsonb,
  action_payload jsonb not null default '{}'::jsonb,
  priority text not null default 'medium',
  status text not null default 'testing',
  human_review_required boolean not null default true,
  active boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workflow_automation_priority_check check (priority in ('low','medium','high','critical')),
  constraint workflow_automation_status_check check (status in ('disabled','testing','ready','active','failed'))
);

create table if not exists public.workflow_escalations (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflows(id) on delete cascade,
  workflow_task_id uuid references public.workflow_tasks(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  escalation_type text not null,
  severity text not null default 'medium',
  reason text not null,
  escalated_to_role public.app_role,
  escalated_to uuid references public.profiles(id) on delete set null,
  status text not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint workflow_escalations_severity_check check (severity in ('low','medium','high','critical')),
  constraint workflow_escalations_status_check check (status in ('open','acknowledged','resolved','dismissed'))
);

create table if not exists public.workflow_audit_events (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid references public.workflows(id) on delete cascade,
  workflow_task_id uuid references public.workflow_tasks(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role public.app_role,
  garden_id uuid references public.gardens(id) on delete cascade,
  event_type text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists workflow_id uuid references public.workflows(id) on delete set null,
  add column if not exists workflow_task_id uuid references public.workflow_tasks(id) on delete set null,
  add column if not exists response_target_at timestamptz,
  add column if not exists completion_target_at timestamptz,
  add column if not exists escalation_target_at timestamptz;

create index if not exists workflows_status_idx on public.workflows(status, priority, sla_due_at);
create index if not exists workflows_garden_idx on public.workflows(garden_id, workflow_type, status);
create index if not exists workflow_tasks_assignee_idx on public.workflow_tasks(assigned_to, assigned_role, status, due_at);
create index if not exists workflow_tasks_garden_idx on public.workflow_tasks(garden_id, status, priority, due_at);
create index if not exists workflow_tasks_legacy_idx on public.workflow_tasks(legacy_task_id);
create index if not exists workflow_approvals_status_idx on public.workflow_approvals(status, approver_role, requested_at);
create index if not exists workflow_escalations_status_idx on public.workflow_escalations(status, severity, created_at desc);
create index if not exists workflow_audit_events_workflow_idx on public.workflow_audit_events(workflow_id, created_at desc);
create index if not exists tasks_workflow_task_idx on public.tasks(workflow_task_id);

alter table public.workflow_templates enable row level security;
alter table public.workflows enable row level security;
alter table public.workflow_tasks enable row level security;
alter table public.workflow_approvals enable row level security;
alter table public.workflow_sla_rules enable row level security;
alter table public.workflow_automation_rules enable row level security;
alter table public.workflow_escalations enable row level security;
alter table public.workflow_audit_events enable row level security;

drop policy if exists "workflow templates admin read" on public.workflow_templates;
create policy "workflow templates admin read" on public.workflow_templates
for select using (public.is_admin());

drop policy if exists "workflow templates admin write" on public.workflow_templates;
create policy "workflow templates admin write" on public.workflow_templates
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "workflows scoped read" on public.workflows;
create policy "workflows scoped read" on public.workflows
for select using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "workflows scoped write" on public.workflows;
create policy "workflows scoped write" on public.workflows
for all using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or assigned_to = auth.uid()
  or created_by = auth.uid()
) with check (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "workflow tasks scoped read" on public.workflow_tasks;
create policy "workflow tasks scoped read" on public.workflow_tasks
for select using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "workflow tasks scoped write" on public.workflow_tasks;
create policy "workflow tasks scoped write" on public.workflow_tasks
for all using (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or assigned_to = auth.uid()
  or created_by = auth.uid()
) with check (
  public.is_admin()
  or (garden_id is not null and public.can_access_garden(garden_id))
  or assigned_to = auth.uid()
  or created_by = auth.uid()
);

drop policy if exists "workflow approvals scoped" on public.workflow_approvals;
create policy "workflow approvals scoped" on public.workflow_approvals
for all using (
  public.is_admin()
  or approver_id = auth.uid()
  or requested_by = auth.uid()
  or exists (
    select 1 from public.workflow_tasks t
    where t.id = workflow_task_id
      and (t.assigned_to = auth.uid() or t.created_by = auth.uid() or (t.garden_id is not null and public.can_access_garden(t.garden_id)))
  )
) with check (
  public.is_admin()
  or approver_id = auth.uid()
  or requested_by = auth.uid()
  or exists (
    select 1 from public.workflow_tasks t
    where t.id = workflow_task_id
      and (t.assigned_to = auth.uid() or t.created_by = auth.uid() or (t.garden_id is not null and public.can_access_garden(t.garden_id)))
  )
);

drop policy if exists "workflow admin configuration" on public.workflow_sla_rules;
create policy "workflow admin configuration" on public.workflow_sla_rules
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "workflow automation admin configuration" on public.workflow_automation_rules;
create policy "workflow automation admin configuration" on public.workflow_automation_rules
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "workflow escalations scoped" on public.workflow_escalations;
create policy "workflow escalations scoped" on public.workflow_escalations
for all using (
  public.is_admin()
  or escalated_to = auth.uid()
  or created_by = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
) with check (
  public.is_admin()
  or escalated_to = auth.uid()
  or created_by = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "workflow audit scoped read" on public.workflow_audit_events;
create policy "workflow audit scoped read" on public.workflow_audit_events
for select using (
  public.is_admin()
  or actor_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

drop policy if exists "workflow audit scoped insert" on public.workflow_audit_events;
create policy "workflow audit scoped insert" on public.workflow_audit_events
for insert with check (
  public.is_admin()
  or actor_id = auth.uid()
  or (garden_id is not null and public.can_access_garden(garden_id))
);

insert into public.workflow_templates (template_key, name, description, workflow_type, default_priority, default_sla_hours, steps, automation_ready)
values
  ('kindergarten_onboarding', 'קליטת גן', 'ליווי גן מאישור ליד ועד פעילות מלאה.', 'onboarding', 'high', 120, '["אישור ליד","שליחת גישה","השלמת פרופיל","אישור סופי"]'::jsonb, true),
  ('monthly_inspection', 'פיקוח חודשי', 'תכנון, ביצוע, ליקויים וסגירה.', 'inspection', 'high', 168, '["תכנון","ביצוע","ליקויים","אימות"]'::jsonb, true),
  ('parent_complaint', 'טיפול בפנייה', 'קבלת פנייה, תגובה, בדיקה וסגירה.', 'complaint', 'high', 72, '["קבלה","תגובה","בדיקה","סגירה"]'::jsonb, true),
  ('incident_case', 'תיק אירוע', 'אירוע, ראיות, סקירה, החלטה וסגירה.', 'incident', 'critical', 48, '["דיווח","ראיות","סקירה","סגירה"]'::jsonb, true),
  ('compliance_action', 'פעולת ציות', 'חידוש מסמך, פעולה מתקנת או אימות.', 'compliance', 'medium', 168, '["זיהוי","הקצאה","ביצוע","אימות"]'::jsonb, true),
  ('document_renewal', 'חידוש מסמך', 'מסמך עומד לפוג, תזכורת, העלאה ואישור.', 'document_renewal', 'medium', 240, '["תזכורת","העלאה","בדיקה","אישור"]'::jsonb, true),
  ('observer_review', 'בדיקת תצפיתן', 'אינדיקציה, בדיקה אנושית, פעולה וסגירה.', 'observer_alert', 'high', 72, '["סקירה","החלטת אדם","פעולה","סגירה"]'::jsonb, true),
  ('ai_recommendation_review', 'המלצת מערכת', 'המלצה לבדיקה, פעולה ואימות ללא אכיפה אוטומטית.', 'ai_recommendation', 'medium', 96, '["המלצה","סקירה","פעולה","אימות"]'::jsonb, true)
on conflict (template_key) do update set
  name = excluded.name,
  description = excluded.description,
  workflow_type = excluded.workflow_type,
  default_priority = excluded.default_priority,
  default_sla_hours = excluded.default_sla_hours,
  steps = excluded.steps,
  automation_ready = excluded.automation_ready,
  updated_at = now();

insert into public.workflow_sla_rules (workflow_type, priority, response_hours, completion_hours, escalation_hours)
values
  ('incident', 'critical', 2, 24, 4),
  ('complaint', 'high', 8, 72, 24),
  ('inspection', 'high', 24, 168, 48),
  ('compliance', 'medium', 48, 168, 96),
  ('document_renewal', 'medium', 72, 240, 120),
  ('observer_alert', 'high', 12, 72, 24),
  ('ai_recommendation', 'medium', 24, 96, 48),
  ('onboarding', 'high', 24, 120, 72)
on conflict (workflow_type, priority) do update set
  response_hours = excluded.response_hours,
  completion_hours = excluded.completion_hours,
  escalation_hours = excluded.escalation_hours,
  updated_at = now();

insert into public.workflow_automation_rules (rule_key, name, description, trigger_event, condition_payload, action_payload, priority, status, human_review_required)
values
  ('inspection_score_followup', 'ציון פיקוח נמוך', 'אם ציון פיקוח נמוך, נפתחת משימת המשך לאישור אדם.', 'inspection_submitted', '{"score_below":70}'::jsonb, '{"create_task_type":"follow_up_inspection"}'::jsonb, 'high', 'ready', true),
  ('certification_expiry_30', 'תעודה עומדת לפוג', 'תזכורת ומשימה 30 יום לפני פקיעת תוקף.', 'document_expiring', '{"days_before":30}'::jsonb, '{"create_task_type":"document_renewal"}'::jsonb, 'medium', 'ready', true),
  ('critical_complaint_escalation', 'פנייה דחופה', 'פנייה קריטית מייצרת הסלמה לפקח ולאדמין.', 'complaint_created', '{"severity":"critical"}'::jsonb, '{"notify_roles":["inspector","admin"]}'::jsonb, 'critical', 'ready', true),
  ('observer_signal_review', 'אינדיקציית תצפיתן', 'אינדיקציה משמעותית עוברת לבדיקה אנושית לפני פעולה.', 'observer_signal_created', '{"human_review_required":true}'::jsonb, '{"create_task_type":"observer_review"}'::jsonb, 'high', 'testing', true)
on conflict (rule_key) do update set
  name = excluded.name,
  description = excluded.description,
  trigger_event = excluded.trigger_event,
  condition_payload = excluded.condition_payload,
  action_payload = excluded.action_payload,
  priority = excluded.priority,
  status = excluded.status,
  human_review_required = excluded.human_review_required,
  updated_at = now();

insert into public.workflows (garden_id, assigned_role, assigned_to, created_by, workflow_type, title, summary, trigger_type, source_entity_type, source_entity_id, priority, status, sla_due_at, metadata, created_at)
select
  t.garden_id,
  t.assigned_role::public.app_role,
  t.assigned_to,
  t.created_by,
  case
    when coalesce(t.task_type, 'general') in ('inspection','ai_event','observer_alert','compliance','incident','complaint','document_renewal','onboarding') then
      case
        when t.task_type = 'ai_event' then 'ai_recommendation'
        else t.task_type
      end
    else 'general'
  end,
  t.title,
  t.description,
  'legacy_task',
  coalesce(t.source_entity_type, 'tasks'),
  coalesce(t.source_entity_id, t.id),
  case when t.priority::text in ('low','medium','high','critical') then t.priority::text else 'medium' end,
  case
    when t.status::text in ('done') then 'completed'
    when t.status::text in ('overdue') then 'overdue'
    when t.status::text in ('waiting_approval') then 'waiting_approval'
    when t.status::text in ('rejected') then 'blocked'
    else 'active'
  end,
  t.due_at,
  jsonb_build_object('source', 'legacy_tasks_backfill', 'legacy_task_id', t.id),
  t.created_at
from public.tasks t
where t.workflow_id is null
  and (t.assigned_role is null or t.assigned_role in ('admin','inspector','manager','owner','staff','parent'))
on conflict do nothing;

insert into public.workflow_tasks (workflow_id, legacy_task_id, garden_id, assigned_role, assigned_to, created_by, task_type, title, description, priority, status, due_at, response_target_at, completion_target_at, escalation_target_at, requires_approval, requires_verification, completed_by, completed_at, source_entity_type, source_entity_id, metadata, created_at)
select
  w.id,
  t.id,
  t.garden_id,
  t.assigned_role::public.app_role,
  t.assigned_to,
  t.created_by,
  coalesce(nullif(t.task_type, ''), 'general'),
  t.title,
  t.description,
  case when t.priority::text in ('low','medium','high','critical') then t.priority::text else 'medium' end,
  t.status::text,
  t.due_at,
  coalesce(t.response_target_at, t.created_at + interval '24 hours'),
  coalesce(t.completion_target_at, t.due_at, t.created_at + interval '72 hours'),
  coalesce(t.escalation_target_at, t.due_at + interval '24 hours', t.created_at + interval '96 hours'),
  t.status::text = 'waiting_approval',
  coalesce(t.requires_proof, false),
  t.completed_by,
  t.completed_at,
  coalesce(t.source_entity_type, 'tasks'),
  coalesce(t.source_entity_id, t.id),
  jsonb_build_object('source', 'legacy_tasks_backfill'),
  t.created_at
from public.tasks t
join public.workflows w
  on w.source_entity_type = coalesce(t.source_entity_type, 'tasks')
 and w.source_entity_id = coalesce(t.source_entity_id, t.id)
where t.workflow_task_id is null
  and (t.assigned_role is null or t.assigned_role in ('admin','inspector','manager','owner','staff','parent'))
on conflict do nothing;

update public.tasks t
set
  workflow_id = wt.workflow_id,
  workflow_task_id = wt.id,
  response_target_at = coalesce(t.response_target_at, wt.response_target_at),
  completion_target_at = coalesce(t.completion_target_at, wt.completion_target_at),
  escalation_target_at = coalesce(t.escalation_target_at, wt.escalation_target_at)
from public.workflow_tasks wt
where wt.legacy_task_id = t.id
  and t.workflow_task_id is null;

insert into public.workflow_escalations (workflow_id, workflow_task_id, garden_id, escalation_type, severity, reason, escalated_to_role, escalated_to, status, created_at)
select
  wt.workflow_id,
  wt.id,
  wt.garden_id,
  'overdue_task',
  case when wt.priority = 'critical' then 'critical' when wt.priority = 'high' then 'high' else 'medium' end,
  'משימה באיחור ודורשת מעקב',
  wt.assigned_role,
  wt.assigned_to,
  'open',
  now()
from public.workflow_tasks wt
where wt.status <> 'done'
  and wt.due_at is not null
  and wt.due_at < now()
  and not exists (
    select 1 from public.workflow_escalations e
    where e.workflow_task_id = wt.id
      and e.escalation_type = 'overdue_task'
      and e.status in ('open','acknowledged')
  );

insert into public.workflow_audit_events (workflow_id, workflow_task_id, garden_id, event_type, after_data, metadata, created_at)
select
  wt.workflow_id,
  wt.id,
  wt.garden_id,
  'legacy_task_linked',
  jsonb_build_object('legacy_task_id', wt.legacy_task_id, 'status', wt.status),
  jsonb_build_object('source', 'phase_127_backfill'),
  wt.created_at
from public.workflow_tasks wt
where wt.legacy_task_id is not null
  and not exists (
    select 1 from public.workflow_audit_events e
    where e.workflow_task_id = wt.id
      and e.event_type = 'legacy_task_linked'
  );

comment on table public.workflow_tasks is 'Unified enterprise task layer for inspections, compliance, incidents, documents, communications, onboarding, observer alerts and AI recommendations.';
comment on table public.workflow_automation_rules is 'Automation readiness rules. Human review remains required unless explicitly and safely changed later.';
comment on table public.workflow_audit_events is 'Audit trail for workflow creation, assignment, approval, escalation and closure.';

notify pgrst, 'reload schema';
