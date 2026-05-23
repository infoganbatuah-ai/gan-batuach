-- Complete operational modules: dynamic question types, reminders, notifications,
-- admin procedures/campaigns/reports, parent/staff modules, rate limits and logs.

do $$
begin
  create type public.inspection_question_type as enum ('score_1_10', 'boolean', 'photo_upload', 'document_upload', 'text_note');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_channel as enum ('in_app', 'email', 'sms', 'push');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_status as enum ('pending', 'sent', 'failed', 'read');
exception when duplicate_object then null;
end $$;

alter table public.inspection_form_questions
  add column if not exists question_type public.inspection_question_type not null default 'score_1_10',
  add column if not exists options jsonb not null default '{}'::jsonb,
  add column if not exists min_score integer not null default 1,
  add column if not exists max_score integer not null default 10,
  add column if not exists violation_threshold integer not null default 4,
  add column if not exists help_text text;

alter table public.inspection_answers
  alter column score drop not null,
  add column if not exists boolean_value boolean,
  add column if not exists text_value text,
  add column if not exists answer_payload jsonb not null default '{}'::jsonb;

alter table public.tasks
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by uuid references public.profiles(id) on delete set null,
  add column if not exists escalation_reason text,
  add column if not exists priority public.severity_level not null default 'medium';

create or replace function public.submit_inspection_with_answers(
  p_inspection_id uuid,
  p_answers jsonb,
  p_gps_lat numeric,
  p_gps_lng numeric,
  p_gps_radius_meters numeric default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inspection_record record;
  answer jsonb;
  question_record record;
  score_value integer;
  effective_score integer;
  bool_value boolean;
  total_weight numeric := 0;
  weighted_sum numeric := 0;
  weighted_average numeric := 0;
  violation_total integer := 0;
  critical_total integer := 0;
  distance numeric;
  task_id_created uuid;
  violation_id_created uuid;
begin
  select i.*, g.gps_lat as garden_lat, g.gps_lng as garden_lng, g.name as garden_name
  into inspection_record
  from public.inspections i
  join public.gardens g on g.id = i.garden_id
  where i.id = p_inspection_id
  for update;

  if inspection_record.id is null then
    raise exception 'Inspection not found';
  end if;

  if inspection_record.gps_exception_approved_by is null then
    if inspection_record.garden_lat is null or inspection_record.garden_lng is null then
      raise exception 'Garden GPS is missing. Admin exception is required.';
    end if;
    distance := public.distance_meters(inspection_record.garden_lat, inspection_record.garden_lng, p_gps_lat, p_gps_lng);
    if distance > p_gps_radius_meters then
      raise exception 'GPS verification failed. Distance: % meters', round(distance, 2);
    end if;
  end if;

  if exists (
    select 1
    from public.inspection_form_questions q
    where q.form_id = inspection_record.form_id
      and q.required = true
      and not exists (
        select 1
        from jsonb_array_elements(p_answers) submitted
        where (submitted->>'question_id')::uuid = q.id
      )
  ) then
    raise exception 'All required inspection questions must be answered';
  end if;

  delete from public.inspection_answers where inspection_id = p_inspection_id;

  for answer in select * from jsonb_array_elements(p_answers)
  loop
    select *
    into question_record
    from public.inspection_form_questions
    where id = (answer->>'question_id')::uuid
      and form_id = inspection_record.form_id;

    if question_record.id is null then
      raise exception 'Question does not belong to inspection form';
    end if;

    score_value := nullif(answer->>'score', '')::integer;
    bool_value := case when answer ? 'boolean_value' then (answer->>'boolean_value')::boolean else null end;

    if question_record.question_type = 'score_1_10' then
      if score_value is null or score_value < question_record.min_score or score_value > question_record.max_score then
        raise exception 'Score must be between % and %', question_record.min_score, question_record.max_score;
      end if;
      effective_score := score_value;
    elsif question_record.question_type = 'boolean' then
      if bool_value is null then
        raise exception 'Boolean answer is required';
      end if;
      effective_score := case when bool_value then 10 else 1 end;
      score_value := effective_score;
    elsif question_record.question_type = 'photo_upload' then
      if question_record.required and coalesce(answer->>'photo_url', '') = '' then
        raise exception 'Photo upload is required';
      end if;
      effective_score := coalesce(score_value, 10);
    elsif question_record.question_type = 'document_upload' then
      if question_record.required and coalesce(answer->>'document_url', '') = '' then
        raise exception 'Document upload is required';
      end if;
      effective_score := coalesce(score_value, 10);
    else
      if question_record.required and coalesce(answer->>'note', answer->>'text_value', '') = '' then
        raise exception 'Text note is required';
      end if;
      effective_score := coalesce(score_value, 10);
    end if;

    if effective_score < 1 or effective_score > 10 then
      raise exception 'Effective score must be between 1 and 10';
    end if;

    if question_record.requires_note and coalesce(answer->>'note', answer->>'text_value', '') = '' then
      raise exception 'Question requires a note';
    end if;

    if question_record.requires_photo and coalesce(answer->>'photo_url', '') = '' then
      raise exception 'Question requires a photo';
    end if;

    if question_record.requires_document and coalesce(answer->>'document_url', '') = '' then
      raise exception 'Question requires a document';
    end if;

    insert into public.inspection_answers (
      inspection_id, question_id, score, note, photo_url, document_url, boolean_value, text_value, answer_payload
    )
    values (
      p_inspection_id,
      question_record.id,
      score_value,
      answer->>'note',
      answer->>'photo_url',
      answer->>'document_url',
      bool_value,
      answer->>'text_value',
      answer
    );

    total_weight := total_weight + question_record.weight;
    weighted_sum := weighted_sum + (effective_score * question_record.weight);

    if effective_score <= question_record.violation_threshold then
      violation_total := violation_total + 1;
      if question_record.critical then
        critical_total := critical_total + 1;
      end if;

      insert into public.tasks (
        garden_id, title, description, assigned_to, due_at, task_type, source_entity_type, status, priority
      )
      values (
        inspection_record.garden_id,
        'תיקון ליקוי: ' || question_record.category,
        question_record.question_text,
        inspection_record.inspector_id,
        now() + interval '7 days',
        'violation_correction',
        'inspection_answer',
        'open',
        case when question_record.critical then 'critical'::public.severity_level else 'high'::public.severity_level end
      )
      returning id into task_id_created;

      insert into public.violations (
        garden_id, inspection_id, question_id, task_id, title, description,
        category, severity, score, status, correction_due_at
      )
      values (
        inspection_record.garden_id,
        p_inspection_id,
        question_record.id,
        task_id_created,
        'ליקוי ביקורת: ' || question_record.category,
        question_record.question_text,
        question_record.category,
        case when question_record.critical then 'critical'::public.severity_level else 'high'::public.severity_level end,
        effective_score,
        'open',
        now() + interval '7 days'
      )
      returning id into violation_id_created;

      update public.tasks
      set source_entity_id = violation_id_created
      where id = task_id_created;

      insert into public.incident_timeline (
        garden_id, entity_type, entity_id, event_type, title, body, severity, metadata
      )
      values (
        inspection_record.garden_id,
        'violation',
        violation_id_created,
        'inspection_violation_created',
        'נוצר ליקוי אוטומטי',
        question_record.question_text,
        case when question_record.critical then 'critical'::public.severity_level else 'high'::public.severity_level end,
        jsonb_build_object('score', effective_score, 'inspection_id', p_inspection_id, 'question_type', question_record.question_type)
      );
    end if;
  end loop;

  if total_weight = 0 then
    raise exception 'Cannot submit inspection without weighted questions';
  end if;

  weighted_average := round(weighted_sum / total_weight, 2);

  update public.inspections
  set
    status = 'done',
    gps_lat = p_gps_lat,
    gps_lng = p_gps_lng,
    gps_verified = true,
    completed_at = now(),
    weighted_score = weighted_average,
    critical_failures = critical_total,
    violation_count = violation_total,
    submitted_payload = p_answers,
    updated_at = now()
  where id = p_inspection_id;

  update public.gardens
  set
    last_inspection_score = weighted_average,
    last_inspection_at = now(),
    next_inspection_at = date_trunc('month', now()) + interval '2 months',
    safe_status = case
      when weighted_average < 8 or critical_total > 0 then 'requires_fix'::public.safe_status
      else 'safe'::public.safe_status
    end,
    eligible_for_safe_status = (weighted_average >= 8 and critical_total = 0),
    updated_at = now()
  where id = inspection_record.garden_id;

  update public.tasks
  set status = 'done', completed_at = now(), completed_by = inspection_record.inspector_id, updated_at = now()
  where id = inspection_record.task_id;

  insert into public.incident_timeline (
    garden_id, entity_type, entity_id, event_type, title, body, severity, metadata
  )
  values (
    inspection_record.garden_id,
    'inspection',
    p_inspection_id,
    'inspection_submitted',
    'ביקורת פקח הושלמה',
    'ציון משוקלל: ' || weighted_average || ', ליקויים: ' || violation_total,
    case when weighted_average < 8 or critical_total > 0 then 'high'::public.severity_level else 'low'::public.severity_level end,
    jsonb_build_object('weighted_score', weighted_average, 'violations', violation_total, 'critical_failures', critical_total)
  );

  if weighted_average < 8 or critical_total > 0 then
    insert into public.incident_timeline (
      garden_id, entity_type, entity_id, event_type, title, body, severity, metadata
    )
    values (
      inspection_record.garden_id,
      'garden',
      inspection_record.garden_id,
      'safe_badge_removed',
      'סטטוס גן בטוח הוסר',
      'הגן עבר לרשימת גנים הדורשים תיקון בעקבות ביקורת',
      'high',
      jsonb_build_object('weighted_score', weighted_average, 'critical_failures', critical_total)
    );
  end if;

  return jsonb_build_object(
    'inspection_id', p_inspection_id,
    'weighted_score', weighted_average,
    'violations_created', violation_total,
    'critical_failures', critical_total,
    'safe_status', case when weighted_average < 8 or critical_total > 0 then 'requires_fix' else 'safe' end
  );
end;
$$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_role public.app_role,
  channel public.notification_channel not null default 'in_app',
  status public.notification_status not null default 'pending',
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.task_view_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz not null default now(),
  ip inet,
  user_agent text
);

create table if not exists public.mandatory_procedures (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  procedure_type text not null,
  body text not null,
  required_for_framework text not null default 'all',
  active boolean not null default true,
  requires_acknowledgement boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.procedure_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  procedure_id uuid not null references public.mandatory_procedures(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz not null default now(),
  notes text,
  unique(procedure_id, garden_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience jsonb not null default '{"roles":["manager"]}'::jsonb,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.report_exports (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  report_type text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  format text not null check (format in ('pdf', 'xlsx', 'csv')),
  filters jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  file_url text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  identifier text not null,
  route text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique(identifier, route, window_start)
);

create table if not exists public.staff_certificates (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  certificate_type text not null,
  file_url text,
  issued_at date,
  expires_at date,
  status public.document_status not null default 'pending_review',
  created_at timestamptz not null default now()
);

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  shift_date date not null,
  planned_start time,
  planned_end time,
  actual_start timestamptz,
  actual_end timestamptz,
  gps_start_lat numeric(10, 7),
  gps_start_lng numeric(10, 7),
  gps_end_lat numeric(10, 7),
  gps_end_lng numeric(10, 7),
  start_gps_verified boolean not null default false,
  end_gps_verified boolean not null default false,
  status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  title text not null,
  media_type text not null check (media_type in ('image', 'video')),
  file_url text not null,
  visible_to_parents boolean not null default false,
  watermark_applied boolean not null default false,
  child_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  visible_to_parents boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.medical_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  event_type text not null,
  description text not null,
  medication_given text,
  parent_notified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pickup_confirmations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid not null references public.children(id) on delete cascade,
  parent_id uuid references public.parents(id) on delete set null,
  picked_up_by_name text not null,
  authorized boolean not null,
  gps_lat numeric(10, 7),
  gps_lng numeric(10, 7),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.video_gateway_connections (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  camera_stream_id uuid references public.camera_streams(id) on delete cascade,
  connection_type text not null check (connection_type in ('rtsp', 'onvif', 'dvr', 'nvr')),
  endpoint_encrypted text not null,
  port integer,
  username_encrypted text,
  password_encrypted text,
  gateway_stream_id text,
  status text not null default 'pending',
  last_discovery_at timestamptz,
  last_ingest_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stream_health_checks (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  camera_stream_id uuid not null references public.camera_streams(id) on delete cascade,
  black_screen boolean not null default false,
  frozen boolean not null default false,
  offline boolean not null default false,
  covered boolean not null default false,
  frame_loss_percent numeric(5, 2),
  latency_ms integer,
  bitrate_kbps integer,
  checked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_notifications_recipient on public.notifications(recipient_id, status, scheduled_for);
create index if not exists idx_task_view_logs_task on public.task_view_logs(task_id, viewed_at desc);
create index if not exists idx_staff_shifts_garden_date on public.staff_shifts(garden_id, shift_date);
create unique index if not exists idx_staff_shifts_unique_day on public.staff_shifts(staff_id, garden_id, shift_date);
create index if not exists idx_gallery_garden on public.gallery_items(garden_id, created_at desc);
create index if not exists idx_schedule_garden on public.schedule_items(garden_id, starts_at);
create index if not exists idx_medical_child on public.medical_events(child_id, created_at desc);
create index if not exists idx_pickup_child on public.pickup_confirmations(child_id, confirmed_at desc);
create index if not exists idx_stream_health_camera on public.stream_health_checks(camera_stream_id, checked_at desc);

create or replace function public.notify_role(
  p_garden_id uuid,
  p_role public.app_role,
  p_title text,
  p_body text,
  p_entity_type text default null,
  p_entity_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  insert into public.notifications (garden_id, recipient_id, recipient_role, title, body, entity_type, entity_id)
  select p_garden_id, p.id, p.role, p_title, p_body, p_entity_type, p_entity_id
  from public.profiles p
  where p.active = true
    and p.role = p_role
    and (p_role = 'admin' or p.garden_id = p_garden_id or p.id in (
      select inspector_id from public.gardens where id = p_garden_id
    ));

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.process_monthly_inspection_reminders(p_now timestamptz default now())
returns table(task_id uuid, action text)
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  reminder_key text;
begin
  for t in
    select *
    from public.tasks
    where task_type = 'monthly_inspection'
      and status in ('open', 'in_progress')
      and due_at is not null
  loop
    if t.due_at < p_now then
      update public.tasks set status = 'overdue', updated_at = now() where id = t.id;
      perform public.notify_role(t.garden_id, 'inspector', 'ביקורת חודשית באיחור', t.title, 'task', t.id);
      perform public.notify_role(t.garden_id, 'admin', 'ביקורת חודשית באיחור', t.title, 'task', t.id);
      task_id := t.id;
      action := 'marked_overdue';
      return next;
    elsif t.due_at - p_now <= interval '24 hours' then
      reminder_key := '24h';
    elsif t.due_at - p_now <= interval '3 days' then
      reminder_key := '3d';
    elsif t.due_at - p_now <= interval '7 days' then
      reminder_key := '7d';
    else
      reminder_key := null;
    end if;

    if reminder_key is not null and not exists (
      select 1 from public.notifications n
      where n.entity_type = 'task'
        and n.entity_id = t.id
        and n.metadata->>'reminder_key' = reminder_key
    ) then
      insert into public.notifications (garden_id, recipient_id, recipient_role, title, body, entity_type, entity_id, metadata)
      values (t.garden_id, t.assigned_to, 'inspector', 'תזכורת ביקורת חודשית', t.title, 'task', t.id, jsonb_build_object('reminder_key', reminder_key));
      task_id := t.id;
      action := 'reminder_' || reminder_key;
      return next;
    end if;
  end loop;
end;
$$;

create or replace function public.escalate_task(p_task_id uuid, p_reason text, p_actor_id uuid default auth.uid())
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_task public.tasks;
begin
  update public.tasks
  set escalated_at = now(),
      escalated_by = p_actor_id,
      escalation_reason = p_reason,
      priority = 'critical',
      updated_at = now()
  where id = p_task_id
  returning * into updated_task;

  if updated_task.id is null then
    raise exception 'Task not found';
  end if;

  insert into public.incident_timeline (garden_id, entity_type, entity_id, event_type, title, body, severity, actor_id)
  values (updated_task.garden_id, 'task', updated_task.id, 'task_escalated', 'משימה הוסלמה', p_reason, 'critical', p_actor_id);

  perform public.notify_role(updated_task.garden_id, 'admin', 'משימה הוסלמה', updated_task.title, 'task', updated_task.id);
  return updated_task;
end;
$$;

create or replace function public.apply_stream_health_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_status public.camera_status;
  severity public.severity_level;
  event_type text;
begin
  if new.offline then
    new_status := 'offline';
    severity := 'high';
    event_type := 'camera_disconnected';
  elsif new.covered then
    new_status := 'covered';
    severity := 'high';
    event_type := 'camera_covered';
  elsif new.frozen then
    new_status := 'frozen';
    severity := 'medium';
    event_type := 'camera_frozen';
  elsif new.black_screen then
    new_status := 'black_frame';
    severity := 'medium';
    event_type := 'camera_black_screen';
  else
    new_status := 'online';
    severity := null;
    event_type := null;
  end if;

  update public.camera_streams
  set status = new_status, last_health_check_at = new.checked_at, updated_at = now()
  where id = new.camera_stream_id;

  if event_type is not null then
    insert into public.ai_events (garden_id, camera_stream_id, event_type, severity, confidence, metadata, notes)
    values (
      new.garden_id,
      new.camera_stream_id,
      event_type,
      severity,
      1,
      jsonb_build_object('health_check_id', new.id, 'latency_ms', new.latency_ms, 'frame_loss_percent', new.frame_loss_percent),
      'Stream health check detected ' || event_type
    );
  end if;

  return new;
end;
$$;

drop trigger if exists stream_health_after_insert on public.stream_health_checks;
create trigger stream_health_after_insert
after insert on public.stream_health_checks
for each row execute function public.apply_stream_health_check();

alter table public.notifications enable row level security;
alter table public.task_view_logs enable row level security;
alter table public.mandatory_procedures enable row level security;
alter table public.procedure_acknowledgements enable row level security;
alter table public.campaigns enable row level security;
alter table public.report_exports enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.staff_certificates enable row level security;
alter table public.staff_shifts enable row level security;
alter table public.gallery_items enable row level security;
alter table public.schedule_items enable row level security;
alter table public.medical_events enable row level security;
alter table public.pickup_confirmations enable row level security;
alter table public.video_gateway_connections enable row level security;
alter table public.stream_health_checks enable row level security;

create policy "notifications recipient scoped" on public.notifications for select using (recipient_id = auth.uid() or public.is_admin());
create policy "notifications system insert" on public.notifications for insert with check (auth.uid() is not null or public.is_admin());
create policy "notifications recipient update" on public.notifications for update using (recipient_id = auth.uid() or public.is_admin()) with check (recipient_id = auth.uid() or public.is_admin());

create policy "task view logs scoped" on public.task_view_logs for select using (public.is_admin() or viewer_id = auth.uid() or exists (select 1 from public.tasks t where t.id = task_id and public.can_access_garden(t.garden_id)));
create policy "task view logs insert self" on public.task_view_logs for insert with check (viewer_id = auth.uid());

create policy "mandatory procedures read authenticated" on public.mandatory_procedures for select using (auth.uid() is not null and active = true or public.is_admin());
create policy "mandatory procedures admin write" on public.mandatory_procedures for all using (public.is_admin()) with check (public.is_admin());

create policy "procedure acknowledgements scoped" on public.procedure_acknowledgements for select using (public.can_access_garden(garden_id));
create policy "procedure acknowledgements manager insert" on public.procedure_acknowledgements for insert with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "campaigns read authenticated" on public.campaigns for select using (auth.uid() is not null);
create policy "campaigns admin write" on public.campaigns for all using (public.is_admin()) with check (public.is_admin());

create policy "report exports scoped" on public.report_exports for select using (public.is_admin() or garden_id is null or public.can_access_garden(garden_id));
create policy "report exports create" on public.report_exports for insert with check (auth.uid() = requested_by and (garden_id is null or public.can_access_garden(garden_id)));
create policy "report exports admin update" on public.report_exports for update using (public.is_admin()) with check (public.is_admin());

create policy "rate limit admin only" on public.rate_limit_events for select using (public.is_admin());

create policy "staff certs scoped" on public.staff_certificates for select using (public.can_access_garden(garden_id));
create policy "staff certs manager write" on public.staff_certificates for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "staff shifts scoped" on public.staff_shifts for select using (public.can_access_garden(garden_id));
create policy "staff shifts write scoped" on public.staff_shifts for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

create policy "gallery scoped read" on public.gallery_items for select using (public.can_access_garden(garden_id));
create policy "gallery manager write" on public.gallery_items for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "schedule scoped read" on public.schedule_items for select using (public.can_access_garden(garden_id));
create policy "schedule manager write" on public.schedule_items for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "medical scoped read" on public.medical_events for select using (public.can_access_garden(garden_id));
create policy "medical manager write" on public.medical_events for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "pickup scoped read" on public.pickup_confirmations for select using (public.can_access_garden(garden_id));
create policy "pickup parent insert" on public.pickup_confirmations for insert with check (public.can_access_garden(garden_id));

create policy "gateway scoped read" on public.video_gateway_connections for select using (public.can_access_garden(garden_id));
create policy "gateway admin manager write" on public.video_gateway_connections for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "stream health scoped read" on public.stream_health_checks for select using (public.can_access_garden(garden_id));
create policy "stream health service insert" on public.stream_health_checks for insert with check (public.can_access_garden(garden_id) or public.is_admin());

create trigger touch_mandatory_procedures before update on public.mandatory_procedures for each row execute function public.touch_updated_at();
create trigger touch_staff_shifts before update on public.staff_shifts for each row execute function public.touch_updated_at();
create trigger touch_video_gateway_connections before update on public.video_gateway_connections for each row execute function public.touch_updated_at();
