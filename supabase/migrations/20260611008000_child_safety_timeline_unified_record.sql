-- PHASE 114: Child Safety Timeline & Unified Child Record
-- Safety/operations record only. Not a child profiling or scoring system.

create table if not exists public.child_unified_records (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  permanent_child_file_id uuid references public.permanent_child_files(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  current_safety_score integer not null default 100,
  attendance_trend jsonb not null default '{}'::jsonb,
  health_trend jsonb not null default '{}'::jsonb,
  timeline_activity_count integer not null default 0,
  parent_visible_event_count integer not null default 0,
  missing_update_count integer not null default 0,
  last_event_at timestamptz,
  daily_summary text,
  weekly_summary text,
  monthly_summary text,
  ai_summary_rules jsonb not null default '{"safe_language":true,"no_profiling":true,"existing_data_only":true}'::jsonb,
  no_profiling boolean not null default true,
  parent_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(child_id),
  constraint child_unified_safety_score_check check (current_safety_score between 0 and 100)
);

alter table public.child_timeline_events add column if not exists event_category text;
alter table public.child_timeline_events add column if not exists event_time timestamptz;
alter table public.child_timeline_events add column if not exists parent_visible boolean not null default false;
alter table public.child_timeline_events add column if not exists visibility text not null default 'internal';
alter table public.child_timeline_events add column if not exists source_type text;
alter table public.child_timeline_events add column if not exists source_id uuid;
alter table public.child_timeline_events add column if not exists summary_safe text;
alter table public.child_timeline_events add column if not exists ai_daily_summary text;
alter table public.child_timeline_events add column if not exists ai_weekly_summary text;
alter table public.child_timeline_events add column if not exists ai_monthly_summary text;
alter table public.child_timeline_events add column if not exists safety_relevance text not null default 'routine';
alter table public.child_timeline_events add column if not exists internal_only boolean not null default false;
alter table public.child_timeline_events add column if not exists approved_for_parent_at timestamptz;
alter table public.child_timeline_events add column if not exists approved_by uuid references public.profiles(id) on delete set null;
alter table public.child_timeline_events add column if not exists media_urls text[] not null default '{}';

update public.child_timeline_events
set
  event_category = case
    when coalesce(event_category, event_type) in ('attendance','meals','sleep','activities','health','incidents','pickup','documents','messages','ai_summaries','observer_approved_events','registration','operations') then coalesce(event_category, event_type)
    when event_type in ('created','approved','registration_submitted','status_changed','transfer_requested','transfer_approved') then 'registration'
    else 'operations'
  end,
  event_time = coalesce(event_time, created_at),
  visibility = coalesce(visibility, case when parent_visible then 'parent' else 'internal' end),
  internal_only = coalesce(internal_only, false)
where event_category is null
   or event_category not in ('attendance','meals','sleep','activities','health','incidents','pickup','documents','messages','ai_summaries','observer_approved_events','registration','operations')
   or event_time is null;

alter table public.child_timeline_events drop constraint if exists child_timeline_category_check;
alter table public.child_timeline_events add constraint child_timeline_category_check check (event_category in (
  'attendance',
  'meals',
  'sleep',
  'activities',
  'health',
  'incidents',
  'pickup',
  'documents',
  'messages',
  'ai_summaries',
  'observer_approved_events',
  'registration',
  'operations'
));

alter table public.child_timeline_events drop constraint if exists child_timeline_visibility_check;
alter table public.child_timeline_events add constraint child_timeline_visibility_check check (visibility in ('internal','manager','staff','inspector','parent','approved_parent'));

alter table public.child_timeline_events drop constraint if exists child_timeline_safety_relevance_check;
alter table public.child_timeline_events add constraint child_timeline_safety_relevance_check check (safety_relevance in ('routine','attention','safety','health','incident'));

create index if not exists child_unified_records_garden_idx on public.child_unified_records(garden_id, updated_at desc);
create index if not exists child_timeline_child_time_idx on public.child_timeline_events(child_id, event_time desc);
create index if not exists child_timeline_parent_visible_idx on public.child_timeline_events(child_id, parent_visible, event_time desc);
create unique index if not exists child_timeline_source_unique_idx
  on public.child_timeline_events(child_id, source_type, source_id, event_category)
  where source_id is not null and source_type is not null;

alter table public.child_unified_records enable row level security;
alter table public.child_timeline_events enable row level security;

alter table public.messages add column if not exists content text;
update public.messages
set content = body
where content is null;

drop policy if exists "child unified records scoped read" on public.child_unified_records;
create policy "child unified records scoped read" on public.child_unified_records
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or (
    parent_visible is true
    and exists (
      select 1 from public.permanent_child_files f
      where f.id = child_unified_records.permanent_child_file_id
        and f.primary_parent_profile_id = auth.uid()
    )
  )
);

drop policy if exists "child unified records scoped write" on public.child_unified_records;
create policy "child unified records scoped write" on public.child_unified_records
for all using (public.is_admin() or public.can_access_garden(garden_id))
with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "child timeline scoped read" on public.child_timeline_events;
create policy "child timeline scoped read" on public.child_timeline_events
for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or (
    parent_visible is true
    and internal_only is false
    and visibility in ('parent','approved_parent')
    and exists (
      select 1 from public.permanent_child_files f
      where f.id = child_timeline_events.permanent_child_file_id
        and f.primary_parent_profile_id = auth.uid()
    )
  )
);

drop policy if exists "child timeline scoped insert" on public.child_timeline_events;
create policy "child timeline scoped insert" on public.child_timeline_events
for insert with check (public.is_admin() or public.can_access_garden(garden_id) or actor_id = auth.uid());

insert into public.child_unified_records (child_id, permanent_child_file_id, garden_id, current_safety_score, metadata, created_at, updated_at)
select
  c.id,
  c.permanent_child_file_id,
  c.garden_id,
  case when coalesce(c.allergies, c.medical_notes, c.regular_medications) is not null then 92 else 98 end,
  jsonb_build_object('source', 'children', 'no_profiling', true),
  coalesce(c.created_at, now()),
  now()
from public.children c
where c.garden_id is not null
on conflict (child_id) do update set
  permanent_child_file_id = excluded.permanent_child_file_id,
  garden_id = excluded.garden_id,
  current_safety_score = excluded.current_safety_score,
  updated_at = now();

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, media_urls, metadata, created_at
)
select
  a.child_id,
  c.permanent_child_file_id,
  a.garden_id,
  a.updated_by,
  'staff',
  'attendance',
  'attendance',
  case when a.status::text = 'present' then 'הגעה לגן' when a.status::text = 'absent' then 'היעדרות' when a.status::text = 'picked_up' then 'איסוף' else 'עדכון נוכחות' end,
  coalesce(a.note, concat('סטטוס נוכחות: ', a.status::text)),
  case when a.status::text = 'present' then 'הילד/ה הגיע/ה לגן.' when a.status::text = 'absent' then 'סומנה היעדרות.' else 'נרשם עדכון נוכחות.' end,
  'attendance',
  a.id,
  coalesce(a.check_in_at, a.check_out_at, a.updated_at, a.created_at),
  true,
  'parent',
  'routine',
  '{}'::text[],
  jsonb_build_object('status', a.status::text, 'pickup_name', a.pickup_name),
  coalesce(a.created_at, now())
from public.attendance a
join public.children c on c.id = a.child_id
where a.child_id is not null
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  title = excluded.title,
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  event_time = excluded.event_time,
  metadata = excluded.metadata;

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, media_urls, metadata, created_at
)
select
  j.child_id,
  c.permanent_child_file_id,
  j.garden_id,
  j.updated_by,
  'staff',
  'daily_summary',
  'activities',
  'עדכון יומי מהגן',
  coalesce(j.notes_to_parents, j.sleep_summary, j.mood, 'עודכן יומן יומי.'),
  concat(
    case when j.mood is not null then concat('מצב רוח: ', j.mood, '. ') else '' end,
    case when jsonb_array_length(coalesce(j.meals, '[]'::jsonb)) > 0 then 'ארוחות עודכנו. ' else '' end,
    case when j.sleep_summary is not null then concat('שינה: ', j.sleep_summary, '. ') else '' end,
    coalesce(j.notes_to_parents, '')
  ),
  'child_daily_journal',
  j.id,
  coalesce(j.updated_at, j.created_at, j.journal_date::timestamptz),
  true,
  'parent',
  case when j.incidents is not null then 'attention' else 'routine' end,
  coalesce(j.photo_urls, '{}'::text[]),
  jsonb_build_object('journal_date', j.journal_date, 'meals', j.meals, 'sleep_summary', j.sleep_summary),
  coalesce(j.created_at, now())
from public.child_daily_journals j
join public.children c on c.id = j.child_id
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  title = excluded.title,
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  event_time = excluded.event_time,
  media_urls = excluded.media_urls,
  metadata = excluded.metadata;

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, metadata, created_at
)
select
  m.child_id,
  c.permanent_child_file_id,
  m.garden_id,
  m.given_by,
  'staff',
  'medicine_given',
  'health',
  'תרופה ניתנה',
  concat(m.medicine_name, coalesce(concat(' · ', m.dosage), '')),
  concat('נרשם עדכון בריאות: ', m.medicine_name, '.'),
  'medicine_given_log',
  m.id,
  m.given_at,
  true,
  'parent',
  'health',
  jsonb_build_object('approval_checked', m.approval_checked, 'notes', m.notes),
  coalesce(m.created_at, now())
from public.medicine_given_logs m
join public.children c on c.id = m.child_id
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  event_time = excluded.event_time,
  metadata = excluded.metadata;

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, metadata, created_at
)
select
  p.child_id,
  c.permanent_child_file_id,
  p.kindergarten_id,
  p.verified_by,
  'staff',
  'pickup',
  'pickup',
  'איסוף הושלם',
  concat(p.pickup_person, ' · ', p.authorization_type),
  concat('האיסוף תועד עבור ', p.pickup_person, '.'),
  'child_pickup_event',
  p.id,
  p.pickup_time,
  true,
  'parent',
  case when p.status in ('unusual','parent_confirmation_requested') or p.authorization_type in ('manual_review','unauthorized') then 'safety' else 'routine' end,
  jsonb_build_object('status', p.status, 'authorization_type', p.authorization_type, 'face_match_status', p.face_match_status),
  coalesce(p.created_at, now())
from public.child_pickup_events p
join public.children c on c.id = p.child_id
where p.kindergarten_id is not null
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  title = excluded.title,
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  event_time = excluded.event_time,
  metadata = excluded.metadata;

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, metadata, created_at
)
select
  d.child_id,
  c.permanent_child_file_id,
  d.garden_id,
  d.uploaded_by,
  'system',
  'document',
  'documents',
  coalesce(d.name, d.document_type, 'מסמך ילד'),
  concat('סטטוס מסמך: ', d.status::text),
  concat('עודכן מסמך: ', coalesce(d.name, d.document_type, 'מסמך'), '.'),
  'document',
  d.id,
  coalesce(d.updated_at, d.created_at),
  true,
  'parent',
  case when d.status::text in ('rejected','expired','missing') then 'attention' else 'routine' end,
  jsonb_build_object('status', d.status::text, 'expires_at', d.expires_at),
  coalesce(d.created_at, now())
from public.documents d
join public.children c on c.id = d.child_id
where d.child_id is not null
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  title = excluded.title,
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  event_time = excluded.event_time,
  metadata = excluded.metadata;

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, metadata, created_at
)
select
  m.linked_child_id,
  c.permanent_child_file_id,
  m.garden_id,
  m.sender_id,
  'message',
  'message',
  'messages',
  coalesce(m.subject, 'הודעה מהגן'),
  coalesce(m.content, m.body),
  'נשלחה הודעה הקשורה לילד/ה.',
  'message',
  m.id,
  m.created_at,
  true,
  'parent',
  'routine',
  jsonb_build_object('treatment_status', m.treatment_status),
  m.created_at
from public.messages m
join public.children c on c.id = m.linked_child_id
where m.linked_child_id is not null
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  title = excluded.title,
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  event_time = excluded.event_time,
  metadata = excluded.metadata;

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, metadata, created_at
)
select
  ir.child_id,
  c.permanent_child_file_id,
  ir.garden_id,
  ir.reported_by,
  'staff',
  'incident',
  'incidents',
  ir.title,
  ir.description,
  'נרשם אירוע בטיחות. פרטים יוצגו רק לאחר בדיקה ואישור.',
  'incident_report',
  ir.id,
  ir.created_at,
  ir.parent_notified,
  case when ir.parent_notified then 'approved_parent' else 'internal' end,
  case when ir.severity in ('high','critical') then 'incident' else 'attention' end,
  jsonb_build_object('severity', ir.severity, 'status', ir.status),
  ir.created_at
from public.incident_reports ir
join public.children c on c.id = ir.child_id
where ir.child_id is not null
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  title = excluded.title,
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  parent_visible = excluded.parent_visible,
  visibility = excluded.visibility,
  event_time = excluded.event_time,
  metadata = excluded.metadata;

insert into public.child_timeline_events (
  child_id, permanent_child_file_id, garden_id, actor_id, actor_role, event_type, event_category, title, description,
  summary_safe, source_type, source_id, event_time, parent_visible, visibility, safety_relevance, metadata, created_at
)
select
  ic.child_id,
  c.permanent_child_file_id,
  ic.garden_id,
  ic.created_by,
  'reviewer',
  'incident_case',
  'incidents',
  concat('תיק בדיקה ', ic.case_number),
  ic.summary,
  coalesce(ic.parent_update_summary, 'תיק בדיקה נמצא במעקב צוות.'),
  'incident_case',
  ic.id,
  ic.created_at,
  ic.parent_update_summary is not null,
  case when ic.parent_update_summary is not null then 'approved_parent' else 'internal' end,
  case when ic.severity in ('high','critical') then 'incident' else 'attention' end,
  jsonb_build_object('status', ic.status, 'severity', ic.severity, 'no_automatic_conclusions', true),
  ic.created_at
from public.incident_cases ic
join public.children c on c.id = ic.child_id
where ic.child_id is not null
on conflict (child_id, source_type, source_id, event_category) where source_id is not null and source_type is not null do update set
  title = excluded.title,
  description = excluded.description,
  summary_safe = excluded.summary_safe,
  parent_visible = excluded.parent_visible,
  visibility = excluded.visibility,
  event_time = excluded.event_time,
  metadata = excluded.metadata;

with timeline_stats as (
  select
    child_id,
    max(event_time) as last_event_at,
    count(*)::int as total_count,
    count(*) filter (where parent_visible is true and internal_only is false)::int as parent_count,
    count(*) filter (where event_time >= now() - interval '1 day')::int as last_day_count
  from public.child_timeline_events
  where child_id is not null
  group by child_id
),
attendance_stats as (
  select child_id,
    count(*) filter (where status::text = 'present' and attendance_date >= current_date - interval '30 days') as present_days,
    count(*) filter (where status::text in ('absent','not_updated') and attendance_date >= current_date - interval '30 days') as missing_days
  from public.attendance
  where child_id is not null
  group by child_id
),
health_stats as (
  select child_id,
    count(*) as medicine_count,
    max(given_at) as last_medicine_at
  from public.medicine_given_logs
  group by child_id
),
incident_stats as (
  select child_id,
    count(*) filter (where status::text not in ('closed','resolved','done')) as open_incidents,
    count(*) filter (where severity::text in ('high','critical')) as severe_incidents
  from public.incident_reports
  where child_id is not null
  group by child_id
)
update public.child_unified_records r
set
  timeline_activity_count = coalesce(t.total_count, 0),
  parent_visible_event_count = coalesce(t.parent_count, 0),
  missing_update_count = greatest(0, 1 - coalesce(t.last_day_count, 0)),
  last_event_at = t.last_event_at,
  attendance_trend = jsonb_build_object('present_days_30d', coalesce(a.present_days, 0), 'missing_days_30d', coalesce(a.missing_days, 0)),
  health_trend = jsonb_build_object('medicine_events', coalesce(h.medicine_count, 0), 'last_medicine_at', h.last_medicine_at, 'open_incidents', coalesce(i.open_incidents, 0)),
  current_safety_score = greatest(0, least(100, 100 - coalesce(i.open_incidents, 0) * 8 - coalesce(i.severe_incidents, 0) * 12 - coalesce(a.missing_days, 0) * 2)),
  daily_summary = case
    when coalesce(i.open_incidents, 0) > 0 then 'יש אירוע בטיחות פתוח שממתין לסגירה אנושית.'
    when coalesce(t.last_day_count, 0) > 0 then 'היום עודכן בציר הזמן של הילד/ה.'
    else 'עדיין חסר עדכון יומי.'
  end,
  weekly_summary = 'סיכום שבועי ייווצר מנתוני ציר הזמן המאושרים בלבד.',
  monthly_summary = 'סיכום חודשי ייווצר מנתוני ציר הזמן המאושרים בלבד.',
  updated_at = now()
from timeline_stats t
left join attendance_stats a on a.child_id = t.child_id
left join health_stats h on h.child_id = t.child_id
left join incident_stats i on i.child_id = t.child_id
where r.child_id = t.child_id;

comment on table public.child_unified_records is 'Unified safety and operational child record. Not a profiling system.';
comment on table public.child_timeline_events is 'Unified child safety timeline. Parent visibility is explicit and internal events remain hidden.';
