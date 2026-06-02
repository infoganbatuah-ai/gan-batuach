-- Production engines: monthly inspections, weighted scoring, camera permissions,
-- video session audit, AI observer events, snapshots and incident timeline.

alter table public.tasks
  add column if not exists task_type text not null default 'general',
  add column if not exists period_month date,
  add column if not exists source_entity_type text,
  add column if not exists source_entity_id uuid;

alter table public.inspections
  add column if not exists period_month date,
  add column if not exists due_at timestamptz,
  add column if not exists submitted_payload jsonb not null default '{}'::jsonb;

alter table public.camera_streams
  add column if not exists video_gateway_stream_id text,
  add column if not exists hls_playback_url text,
  add column if not exists webrtc_playback_url text,
  add column if not exists retention_hours integer not null default 72,
  add column if not exists parent_view_allowed boolean not null default false,
  add column if not exists viewing_hours jsonb not null default '{"from":"07:30","to":"16:30"}'::jsonb;

alter table public.ai_events
  add column if not exists event_key text,
  add column if not exists rule_id uuid,
  add column if not exists snapshot_id uuid,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists incident_id uuid;

create table if not exists public.parent_camera_permissions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  camera_stream_id uuid not null references public.camera_streams(id) on delete cascade,
  allowed boolean not null default true,
  reason text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(parent_id, camera_stream_id)
);

create table if not exists public.video_stream_sessions (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  camera_stream_id uuid not null references public.camera_streams(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewer_role public.app_role,
  parent_id uuid references public.parents(id) on delete set null,
  playback_protocol text not null check (playback_protocol in ('HLS', 'WebRTC')),
  token_hash text not null,
  token_expires_at timestamptz not null,
  playback_url text not null,
  ip inet,
  user_agent text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.camera_snapshots (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  camera_stream_id uuid references public.camera_streams(id) on delete set null,
  storage_bucket text not null default 'camera-snapshots',
  storage_path text not null,
  captured_at timestamptz not null default now(),
  source text not null default 'camera_health',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.restricted_areas (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  camera_stream_id uuid references public.camera_streams(id) on delete cascade,
  name text not null,
  polygon jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_observer_rules (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  camera_stream_id uuid references public.camera_streams(id) on delete cascade,
  event_type text not null,
  enabled boolean not null default true,
  severity public.severity_level not null default 'medium',
  threshold numeric(5, 2) not null default 0.75,
  cooldown_seconds integer not null default 60,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  ai_event_id uuid not null references public.ai_events(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete set null,
  recipient_role public.app_role,
  channel text not null default 'in_app',
  title text not null,
  body text not null,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.incident_timeline (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  event_type text not null,
  title text not null,
  body text,
  severity public.severity_level,
  actor_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_parent_camera_permissions_parent on public.parent_camera_permissions(parent_id, camera_stream_id);
create index if not exists idx_video_stream_sessions_camera on public.video_stream_sessions(camera_stream_id, created_at desc);
create index if not exists idx_camera_snapshots_camera on public.camera_snapshots(camera_stream_id, captured_at desc);
create index if not exists idx_ai_alerts_garden on public.ai_alerts(garden_id, created_at desc);
create index if not exists idx_incident_timeline_garden on public.incident_timeline(garden_id, occurred_at desc);
create index if not exists idx_tasks_monthly_unique on public.tasks(garden_id, task_type, period_month) where task_type = 'monthly_inspection';
create unique index if not exists idx_inspections_monthly_unique on public.inspections(garden_id, period_month) where period_month is not null;

create or replace function public.distance_meters(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
as $$
  select 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((lat2 - lat1) / 2)), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians((lng2 - lng1) / 2)), 2)
    )
  )
$$;

create or replace function public.create_monthly_inspection_tasks(p_month date default date_trunc('month', now())::date)
returns table(task_id uuid, inspection_id uuid, garden_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  active_form_id uuid;
  new_task_id uuid;
  new_inspection_id uuid;
  due_date timestamptz;
begin
  select id into active_form_id
  from public.inspection_forms
  where active = true
  order by created_at desc
  limit 1;

  if active_form_id is null then
    raise exception 'No active inspection form exists';
  end if;

  due_date := (p_month + interval '1 month' - interval '1 day')::timestamptz;

  for g in
    select id, name, address, inspector_id
    from public.gardens
    where status = 'active' and inspector_id is not null
  loop
    insert into public.tasks (
      garden_id, title, description, assigned_to, due_at, task_type, period_month, status
    )
    values (
      g.id,
      'ביקורת חודשית - ' || to_char(p_month, 'MM/YYYY'),
      'משימת ביקורת חודשית אוטומטית לגן ' || g.name || coalesce(' בכתובת ' || g.address, ''),
      g.inspector_id,
      due_date,
      'monthly_inspection',
      p_month,
      'open'
    )
    on conflict (garden_id, task_type, period_month) where task_type = 'monthly_inspection'
    do update set due_at = excluded.due_at, assigned_to = excluded.assigned_to, updated_at = now()
    returning id into new_task_id;

    insert into public.inspections (
      garden_id, inspector_id, form_id, task_id, period_month, due_at, status
    )
    values (
      g.id, g.inspector_id, active_form_id, new_task_id, p_month, due_date, 'open'
    )
    on conflict (garden_id, period_month) where period_month is not null
    do update set task_id = excluded.task_id, inspector_id = excluded.inspector_id, updated_at = now()
    returning id into new_inspection_id;

    update public.tasks
    set source_entity_type = 'inspection', source_entity_id = new_inspection_id
    where id = new_task_id;

    task_id := new_task_id;
    inspection_id := new_inspection_id;
    garden_id := g.id;
    return next;
  end loop;
end;
$$;

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

    score_value := (answer->>'score')::integer;
    if score_value < 1 or score_value > 10 then
      raise exception 'Score must be between 1 and 10';
    end if;

    insert into public.inspection_answers (
      inspection_id, question_id, score, note, photo_url, document_url
    )
    values (
      p_inspection_id,
      question_record.id,
      score_value,
      answer->>'note',
      answer->>'photo_url',
      answer->>'document_url'
    );

    total_weight := total_weight + question_record.weight;
    weighted_sum := weighted_sum + (score_value * question_record.weight);

    if score_value <= 4 then
      violation_total := violation_total + 1;
      if question_record.critical then
        critical_total := critical_total + 1;
      end if;

      insert into public.tasks (
        garden_id, title, description, assigned_to, due_at, task_type, source_entity_type, status
      )
      values (
        inspection_record.garden_id,
        'תיקון ליקוי: ' || question_record.category,
        question_record.question_text,
        inspection_record.inspector_id,
        now() + interval '7 days',
        'violation_correction',
        'inspection_answer',
        'open'
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
        score_value,
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
        jsonb_build_object('score', score_value, 'inspection_id', p_inspection_id)
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

  return jsonb_build_object(
    'inspection_id', p_inspection_id,
    'weighted_score', weighted_average,
    'violations_created', violation_total,
    'critical_failures', critical_total,
    'safe_status', case when weighted_average < 8 or critical_total > 0 then 'requires_fix' else 'safe' end
  );
end;
$$;

create or replace view public.unsafe_gardens as
select
  g.*,
  coalesce(open_violations.count, 0) as open_violations_count
from public.gardens g
left join lateral (
  select count(*)::integer as count
  from public.violations v
  where v.garden_id = g.id and v.status <> 'done'
) open_violations on true
where g.safe_status in ('requires_fix', 'not_compliant')
   or coalesce(g.last_inspection_score, 10) < 8;

alter view public.unsafe_gardens set (security_invoker = true);

create or replace function public.can_parent_view_camera(p_parent_id uuid, p_camera_stream_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.parent_camera_permissions pcp
    join public.camera_streams cs on cs.id = pcp.camera_stream_id
    where pcp.parent_id = p_parent_id
      and pcp.camera_stream_id = p_camera_stream_id
      and pcp.allowed = true
      and cs.active = true
      and cs.parent_view_allowed = true
      and (pcp.valid_until is null or pcp.valid_until > now())
  )
$$;

create or replace function public.handle_ai_event_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  manager_profile uuid;
  inspector_profile uuid;
  timeline_id uuid;
begin
  select manager_id, inspector_id into manager_profile, inspector_profile
  from public.gardens
  where id = new.garden_id;

  insert into public.incident_timeline (
    garden_id, entity_type, entity_id, event_type, title, body, severity, metadata
  )
  values (
    new.garden_id,
    'ai_event',
    new.id,
    'ai_event_detected',
    'אירוע AI: ' || new.event_type,
    coalesce(new.notes, 'אירוע תצפיתן AI זוהה ונדרש טיפול'),
    new.severity,
    new.metadata
  )
  returning id into timeline_id;

  update public.ai_events set incident_id = timeline_id where id = new.id;

  if manager_profile is not null then
    insert into public.ai_alerts (ai_event_id, garden_id, recipient_id, recipient_role, title, body)
    values (new.id, new.garden_id, manager_profile, 'manager', 'התראת תצפיתן AI', new.event_type);
  end if;

  if inspector_profile is not null and new.severity in ('high', 'critical') then
    insert into public.ai_alerts (ai_event_id, garden_id, recipient_id, recipient_role, title, body)
    values (new.id, new.garden_id, inspector_profile, 'inspector', 'אירוע AI חמור', new.event_type);
  end if;

  if new.severity = 'critical' then
    insert into public.tasks (garden_id, title, description, assigned_to, due_at, task_type, source_entity_type, source_entity_id, status)
    values (new.garden_id, 'טיפול מיידי באירוע AI', new.event_type, inspector_profile, now() + interval '2 hours', 'ai_incident', 'ai_event', new.id, 'open');
  end if;

  return new;
end;
$$;

drop trigger if exists ai_event_after_insert on public.ai_events;
create trigger ai_event_after_insert
after insert on public.ai_events
for each row execute function public.handle_ai_event_after_insert();

alter table public.parent_camera_permissions enable row level security;
alter table public.video_stream_sessions enable row level security;
alter table public.camera_snapshots enable row level security;
alter table public.restricted_areas enable row level security;
alter table public.ai_observer_rules enable row level security;
alter table public.ai_alerts enable row level security;
alter table public.incident_timeline enable row level security;

create policy "parent camera permissions scoped" on public.parent_camera_permissions for select using (public.can_access_garden(garden_id));
create policy "parent camera permissions manager write" on public.parent_camera_permissions for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "video sessions scoped read" on public.video_stream_sessions for select using (public.can_access_garden(garden_id) or viewer_id = auth.uid());
create policy "video sessions insert self" on public.video_stream_sessions for insert with check (public.can_access_garden(garden_id) or viewer_id = auth.uid());
create policy "video sessions update self" on public.video_stream_sessions for update using (viewer_id = auth.uid() or public.is_admin()) with check (viewer_id = auth.uid() or public.is_admin());

create policy "snapshots scoped read" on public.camera_snapshots for select using (public.can_access_garden(garden_id));
create policy "snapshots scoped write" on public.camera_snapshots for insert with check (public.can_access_garden(garden_id) or public.is_admin());

create policy "restricted areas scoped" on public.restricted_areas for select using (public.can_access_garden(garden_id));
create policy "restricted areas manager write" on public.restricted_areas for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "ai observer rules scoped" on public.ai_observer_rules for select using (garden_id is null or public.can_access_garden(garden_id));
create policy "ai observer rules admin manager write" on public.ai_observer_rules for all using (public.is_admin() or garden_id = public.current_garden_id()) with check (public.is_admin() or garden_id = public.current_garden_id());

create policy "ai alerts scoped" on public.ai_alerts for select using (recipient_id = auth.uid() or public.can_access_garden(garden_id));
create policy "ai alerts update recipient" on public.ai_alerts for update using (recipient_id = auth.uid() or public.is_admin()) with check (recipient_id = auth.uid() or public.is_admin());

create policy "incident timeline scoped read" on public.incident_timeline for select using (public.can_access_garden(garden_id));
create policy "incident timeline scoped insert" on public.incident_timeline for insert with check (public.can_access_garden(garden_id) or public.is_admin());

create trigger touch_ai_observer_rules before update on public.ai_observer_rules for each row execute function public.touch_updated_at();

insert into public.ai_observer_rules (event_type, severity, threshold, cooldown_seconds, config)
values
  ('violence_detection', 'critical', 0.82, 30, '{"modalities":["vision"],"description":"physical aggression, hitting, pushing, rough handling"}'),
  ('child_alone_detection', 'high', 0.78, 60, '{"modalities":["vision"],"min_seconds_alone":45}'),
  ('restricted_area_detection', 'critical', 0.80, 15, '{"modalities":["vision"],"requires_restricted_area":true}'),
  ('cry_detection', 'medium', 0.76, 45, '{"modalities":["audio"],"min_seconds":20}'),
  ('staff_absence_detection', 'high', 0.80, 120, '{"modalities":["vision","attendance"],"min_seconds_without_staff":60}'),
  ('child_outside_allowed_zone', 'critical', 0.82, 20, '{"modalities":["vision"],"requires_allowed_zone":true}'),
  ('fall_detection', 'critical', 0.84, 20, '{"modalities":["vision"],"min_motion_drop":0.70}'),
  ('overcrowding_detection', 'high', 0.78, 60, '{"modalities":["vision"],"density_threshold":0.85}'),
  ('sleeping_anomaly', 'high', 0.76, 180, '{"modalities":["vision"],"nap_window_required":true}'),
  ('no_movement', 'high', 0.80, 90, '{"modalities":["vision"],"min_seconds_no_motion":60}'),
  ('panic_movement', 'high', 0.80, 45, '{"modalities":["vision"],"motion_spike_threshold":0.88}'),
  ('camera_covered', 'high', 0.82, 60, '{"modalities":["vision"],"black_or_occluded_ratio":0.90}'),
  ('camera_disconnected', 'high', 0.95, 60, '{"modalities":["stream_health"],"offline":true}')
on conflict do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'camera-snapshots',
  'camera-snapshots',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "camera snapshots storage authenticated read"
on storage.objects for select
using (
  bucket_id = 'camera-snapshots'
  and auth.uid() is not null
);

create policy "camera snapshots storage service insert"
on storage.objects for insert
with check (
  bucket_id = 'camera-snapshots'
  and auth.uid() is not null
);
