-- PHASE 132: Inspector command center, monthly supervision and regulatory operations.
-- Adds a monthly supervision layer on top of existing inspections, complaints,
-- findings, signatures and observer signals. Human review remains mandatory.

alter table public.required_inspections
  add column if not exists inspection_type text not null default 'monthly',
  add column if not exists monthly_cycle_date date,
  add column if not exists readiness_status text not null default 'pending',
  add column if not exists rescheduled_from timestamptz,
  add column if not exists rescheduled_reason text,
  add column if not exists alert_schedule jsonb not null default '{"14_days":false,"7_days":false,"3_days":false,"overdue":false}'::jsonb,
  add column if not exists last_alert_at timestamptz;

alter table public.inspections
  add column if not exists inspection_type text not null default 'monthly',
  add column if not exists regulatory_document_number text,
  add column if not exists regulatory_locked_at timestamptz,
  add column if not exists regulatory_locked_by uuid references public.profiles(id) on delete set null,
  add column if not exists regulatory_validation jsonb not null default '{}'::jsonb;

alter table public.inspection_answers
  add column if not exists video_url text,
  add column if not exists evidence_metadata jsonb not null default '{}'::jsonb;

create table if not exists public.monthly_inspection_cycles (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  cycle_month date not null,
  due_at date not null,
  required_inspection_id uuid references public.required_inspections(id) on delete set null,
  completed_inspection_id uuid references public.inspections(id) on delete set null,
  completion_status text not null default 'pending',
  readiness_status text not null default 'pending',
  completed_at timestamptz,
  rescheduled_from date,
  rescheduled_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_inspection_cycles_status_check check (completion_status in ('pending','completed','overdue','rescheduled')),
  constraint monthly_inspection_cycles_readiness_check check (readiness_status in ('pending','ready','needs_attention','blocked')),
  unique(garden_id, cycle_month)
);

create table if not exists public.inspection_alert_events (
  id uuid primary key default gen_random_uuid(),
  monthly_cycle_id uuid references public.monthly_inspection_cycles(id) on delete cascade,
  required_inspection_id uuid references public.required_inspections(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  alert_type text not null,
  recipient_role text not null,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'queued',
  message_title text not null,
  message_body text not null,
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inspection_alert_type_check check (alert_type in ('due_14_days','due_7_days','due_3_days','overdue')),
  constraint inspection_alert_recipient_role_check check (recipient_role in ('inspector','manager','owner','admin')),
  constraint inspection_alert_status_check check (status in ('queued','sent','skipped','failed')),
  unique(required_inspection_id, alert_type, recipient_role)
);

create table if not exists public.inspection_additional_requests (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  assigned_inspector_id uuid references public.profiles(id) on delete set null,
  request_type text not null default 'follow_up',
  status text not null default 'requested',
  priority text not null default 'normal',
  reason text,
  complaint_id uuid references public.complaints(id) on delete set null,
  observer_signal_id uuid references public.observer_intelligence_signals(id) on delete set null,
  required_inspection_id uuid references public.required_inspections(id) on delete set null,
  scheduled_for timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_additional_request_type_check check (request_type in ('follow_up','surprise','urgent','complaint_driven','observer_recommended')),
  constraint inspection_additional_request_status_check check (status in ('requested','approved','scheduled','completed','rejected','cancelled')),
  constraint inspection_additional_request_priority_check check (priority in ('low','normal','high','urgent'))
);

create table if not exists public.inspection_gps_validations (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  arrived_at timestamptz,
  departed_at timestamptz,
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  garden_lat numeric(10, 7),
  garden_lng numeric(10, 7),
  distance_meters numeric(10, 2),
  duration_minutes integer,
  validation_result text not null default 'pending',
  consistency_status text not null default 'requires_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inspection_gps_validation_result_check check (validation_result in ('valid','suspicious','failed','pending')),
  constraint inspection_gps_consistency_check check (consistency_status in ('consistent','inconsistent','requires_review'))
);

create table if not exists public.complaint_regulatory_actions (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  inspector_id uuid references public.profiles(id) on delete set null,
  action_type text not null default 'review',
  status text not null default 'open',
  message text,
  requested_information text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaint_regulatory_action_type_check check (action_type in ('review','reply','request_information','escalate','close')),
  constraint complaint_regulatory_action_status_check check (status in ('open','waiting_for_parent','waiting_for_kindergarten','escalated','closed'))
);

create table if not exists public.inspector_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  inspector_id uuid not null references public.profiles(id) on delete cascade,
  metric_month date not null,
  inspections_assigned integer not null default 0,
  inspections_completed integer not null default 0,
  overdue_inspections integer not null default 0,
  complaints_handled integer not null default 0,
  findings_verified integer not null default 0,
  average_completion_hours numeric(10, 2),
  response_time_hours numeric(10, 2),
  performance_score integer not null default 0 check (performance_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(inspector_id, metric_month)
);

create table if not exists public.regulatory_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  garden_id uuid references public.gardens(id) on delete cascade,
  inspection_id uuid references public.inspections(id) on delete set null,
  complaint_id uuid references public.complaints(id) on delete set null,
  finding_id uuid references public.violations(id) on delete set null,
  event_type text not null,
  event_title text not null,
  event_details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists monthly_inspection_cycles_inspector_idx on public.monthly_inspection_cycles(inspector_id, cycle_month, completion_status);
create index if not exists monthly_inspection_cycles_garden_idx on public.monthly_inspection_cycles(garden_id, cycle_month desc);
create index if not exists inspection_alert_events_cycle_idx on public.inspection_alert_events(monthly_cycle_id, alert_type, status);
create index if not exists inspection_additional_requests_inspector_idx on public.inspection_additional_requests(assigned_inspector_id, status, scheduled_for);
create index if not exists inspection_gps_validations_inspection_idx on public.inspection_gps_validations(inspection_id, created_at desc);
create index if not exists complaint_regulatory_actions_complaint_idx on public.complaint_regulatory_actions(complaint_id, created_at desc);
create index if not exists inspector_performance_metrics_month_idx on public.inspector_performance_metrics(metric_month desc, inspector_id);
create index if not exists regulatory_audit_events_garden_idx on public.regulatory_audit_events(garden_id, created_at desc);

alter table public.monthly_inspection_cycles enable row level security;
alter table public.inspection_alert_events enable row level security;
alter table public.inspection_additional_requests enable row level security;
alter table public.inspection_gps_validations enable row level security;
alter table public.complaint_regulatory_actions enable row level security;
alter table public.inspector_performance_metrics enable row level security;
alter table public.regulatory_audit_events enable row level security;

drop policy if exists "monthly inspection cycles scoped read" on public.monthly_inspection_cycles;
create policy "monthly inspection cycles scoped read" on public.monthly_inspection_cycles
for select using (public.is_admin() or inspector_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "monthly inspection cycles scoped write" on public.monthly_inspection_cycles;
create policy "monthly inspection cycles scoped write" on public.monthly_inspection_cycles
for all using (public.is_admin() or inspector_id = auth.uid())
with check (public.is_admin() or inspector_id = auth.uid());

drop policy if exists "inspection alert events scoped read" on public.inspection_alert_events;
create policy "inspection alert events scoped read" on public.inspection_alert_events
for select using (public.is_admin() or inspector_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "inspection alert events admin inspector write" on public.inspection_alert_events;
create policy "inspection alert events admin inspector write" on public.inspection_alert_events
for all using (public.is_admin() or inspector_id = auth.uid())
with check (public.is_admin() or inspector_id = auth.uid());

drop policy if exists "inspection additional requests scoped read" on public.inspection_additional_requests;
create policy "inspection additional requests scoped read" on public.inspection_additional_requests
for select using (public.is_admin() or assigned_inspector_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "inspection additional requests scoped write" on public.inspection_additional_requests;
create policy "inspection additional requests scoped write" on public.inspection_additional_requests
for all using (public.is_admin() or assigned_inspector_id = auth.uid() or public.can_access_garden(garden_id))
with check (public.is_admin() or assigned_inspector_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "inspection gps validations scoped read" on public.inspection_gps_validations;
create policy "inspection gps validations scoped read" on public.inspection_gps_validations
for select using (public.is_admin() or inspector_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "inspection gps validations admin inspector insert" on public.inspection_gps_validations;
create policy "inspection gps validations admin inspector insert" on public.inspection_gps_validations
for insert with check (public.is_admin() or inspector_id = auth.uid());

drop policy if exists "complaint regulatory actions scoped read" on public.complaint_regulatory_actions;
create policy "complaint regulatory actions scoped read" on public.complaint_regulatory_actions
for select using (public.is_admin() or inspector_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "complaint regulatory actions scoped write" on public.complaint_regulatory_actions;
create policy "complaint regulatory actions scoped write" on public.complaint_regulatory_actions
for all using (public.is_admin() or inspector_id = auth.uid() or public.can_access_garden(garden_id))
with check (public.is_admin() or inspector_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "inspector performance metrics scoped read" on public.inspector_performance_metrics;
create policy "inspector performance metrics scoped read" on public.inspector_performance_metrics
for select using (public.is_admin() or inspector_id = auth.uid());

drop policy if exists "inspector performance metrics admin write" on public.inspector_performance_metrics;
create policy "inspector performance metrics admin write" on public.inspector_performance_metrics
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "regulatory audit events scoped read" on public.regulatory_audit_events;
create policy "regulatory audit events scoped read" on public.regulatory_audit_events
for select using (public.is_admin() or actor_profile_id = auth.uid() or (garden_id is not null and public.can_access_garden(garden_id)));

drop policy if exists "regulatory audit events append only" on public.regulatory_audit_events;
create policy "regulatory audit events append only" on public.regulatory_audit_events
for insert with check (public.is_admin() or actor_profile_id = auth.uid() or (garden_id is not null and public.can_access_garden(garden_id)));

create or replace function public.sync_monthly_inspection_cycles(p_month date default date_trunc('month', current_date)::date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  insert into public.monthly_inspection_cycles (
    garden_id,
    inspector_id,
    cycle_month,
    due_at,
    required_inspection_id,
    completion_status,
    readiness_status,
    metadata
  )
  select
    g.id,
    g.inspector_id,
    date_trunc('month', p_month)::date,
    coalesce(g.next_inspection_at::date, (date_trunc('month', p_month)::date + interval '14 days')::date),
    r.id,
    case
      when i.id is not null then 'completed'
      when coalesce(g.next_inspection_at::date, (date_trunc('month', p_month)::date + interval '14 days')::date) < current_date then 'overdue'
      else 'pending'
    end,
    case
      when exists (
        select 1 from public.compliance_alerts ca
        where ca.garden_id = g.id and ca.alert_status not in ('resolved','verified','dismissed')
      ) then 'needs_attention'
      else 'ready'
    end,
    jsonb_build_object('source', 'phase_132_monthly_supervision')
  from public.gardens g
  left join lateral (
    select ri.id
    from public.required_inspections ri
    where ri.garden_id = g.id
      and coalesce(ri.monthly_cycle_date, date_trunc('month', ri.due_at)::date) = date_trunc('month', p_month)::date
    order by ri.due_at desc
    limit 1
  ) r on true
  left join lateral (
    select ins.id
    from public.inspections ins
    where ins.garden_id = g.id
      and date_trunc('month', coalesce(ins.completed_at, ins.created_at))::date = date_trunc('month', p_month)::date
      and ins.status::text in ('done','completed')
    order by coalesce(ins.completed_at, ins.created_at) desc
    limit 1
  ) i on true
  where g.inspector_id is not null
    and coalesce(g.status::text, '') not in ('archived','suspended','rejected')
  on conflict (garden_id, cycle_month)
  do update set
    inspector_id = excluded.inspector_id,
    due_at = excluded.due_at,
    required_inspection_id = coalesce(public.monthly_inspection_cycles.required_inspection_id, excluded.required_inspection_id),
    completed_inspection_id = coalesce(public.monthly_inspection_cycles.completed_inspection_id, excluded.completed_inspection_id),
    completion_status = case
      when public.monthly_inspection_cycles.completion_status = 'completed' then 'completed'
      else excluded.completion_status
    end,
    readiness_status = excluded.readiness_status,
    updated_at = now();

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

select public.sync_monthly_inspection_cycles(date_trunc('month', current_date)::date);

insert into public.inspection_alert_events (
  monthly_cycle_id,
  required_inspection_id,
  garden_id,
  inspector_id,
  alert_type,
  recipient_role,
  message_title,
  message_body,
  metadata
)
select
  c.id,
  c.required_inspection_id,
  c.garden_id,
  c.inspector_id,
  alert.alert_type,
  role_name,
  'תזכורת פיקוח חודשית',
  concat('ביקורת חודשית לגן ', coalesce(g.name, 'משויך'), ' מתוכננת ל-', to_char(c.due_at, 'DD/MM/YYYY')),
  jsonb_build_object('days_until_due', c.due_at - current_date, 'source', 'phase_132_seed')
from public.monthly_inspection_cycles c
join public.gardens g on g.id = c.garden_id
cross join lateral (
  select case
    when c.due_at < current_date then 'overdue'
    when c.due_at - current_date <= 3 then 'due_3_days'
    when c.due_at - current_date <= 7 then 'due_7_days'
    when c.due_at - current_date <= 14 then 'due_14_days'
    else null
  end as alert_type
) alert
cross join lateral (values ('inspector'), ('manager'), ('admin')) recipients(role_name)
where c.completion_status <> 'completed'
  and alert.alert_type is not null
  and c.required_inspection_id is not null
on conflict (required_inspection_id, alert_type, recipient_role) do nothing;

insert into public.inspector_performance_metrics (
  inspector_id,
  metric_month,
  inspections_assigned,
  inspections_completed,
  overdue_inspections,
  complaints_handled,
  findings_verified,
  performance_score,
  metadata
)
select
  p.id,
  date_trunc('month', current_date)::date,
  count(c.id)::integer,
  count(c.id) filter (where c.completion_status = 'completed')::integer,
  count(c.id) filter (where c.completion_status = 'overdue')::integer,
  coalesce(complaints.handled, 0)::integer,
  coalesce(findings.verified, 0)::integer,
  least(100, greatest(0, 70 + count(c.id) filter (where c.completion_status = 'completed')::integer * 3 - count(c.id) filter (where c.completion_status = 'overdue')::integer * 8))::integer,
  jsonb_build_object('source', 'phase_132_seed')
from public.profiles p
left join public.monthly_inspection_cycles c
  on c.inspector_id = p.id
  and c.cycle_month = date_trunc('month', current_date)::date
left join lateral (
  select count(*) as handled
  from public.complaint_regulatory_actions cra
  where cra.inspector_id = p.id
    and date_trunc('month', cra.created_at)::date = date_trunc('month', current_date)::date
) complaints on true
left join lateral (
  select count(*) as verified
  from public.national_compliance_findings ncf
  where ncf.verified_by = p.id
    and date_trunc('month', coalesce(ncf.verified_at, ncf.created_at))::date = date_trunc('month', current_date)::date
) findings on true
where p.role::text = 'inspector'
group by p.id, complaints.handled, findings.verified
on conflict (inspector_id, metric_month)
do update set
  inspections_assigned = excluded.inspections_assigned,
  inspections_completed = excluded.inspections_completed,
  overdue_inspections = excluded.overdue_inspections,
  complaints_handled = excluded.complaints_handled,
  findings_verified = excluded.findings_verified,
  performance_score = excluded.performance_score,
  updated_at = now();

comment on table public.monthly_inspection_cycles is 'Mandatory monthly supervision cycle for every assigned kindergarten.';
comment on table public.inspection_alert_events is 'Inspection reminders for 14, 7, 3 days before due date and overdue supervision.';
comment on table public.inspection_additional_requests is 'Follow-up, surprise, urgent and complaint-driven inspection requests.';
comment on table public.inspection_gps_validations is 'Regulatory GPS validation for inspection presence, duration and location consistency.';
comment on table public.regulatory_audit_events is 'Append-only regulatory audit trail for inspection, complaint, finding and supervision actions.';
