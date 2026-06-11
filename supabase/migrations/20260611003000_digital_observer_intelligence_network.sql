-- PHASE 109: Digital Observer Intelligence Network
-- Unified safety signal layer. Advisory only: no automatic accusations, no disciplinary decisions, no parent panic notifications.

create table if not exists public.observer_intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null,
  source_type text not null,
  source_id uuid,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  camera_id uuid references public.camera_streams(id) on delete set null,
  severity text not null default 'medium',
  confidence numeric(5,4),
  review_status text not null default 'needs_review',
  recommended_action text,
  risk_score integer not null default 0,
  pattern_key text,
  repeated_count integer not null default 1,
  human_review_required boolean not null default true,
  parent_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_intelligence_signal_type_check check (signal_type in (
    'ai_camera',
    'legacy_ai',
    'audio',
    'correlated',
    'safety_incident',
    'complaint',
    'inspection',
    'compliance',
    'camera_health',
    'staff_attendance',
    'pattern'
  )),
  constraint observer_intelligence_source_type_check check (source_type in (
    'ai_camera_events',
    'ai_events',
    'audio_observer_events',
    'observer_correlated_events',
    'incident_reports',
    'complaints',
    'national_compliance_findings',
    'compliance_alerts',
    'camera_health_history',
    'camera_streams',
    'attendance',
    'required_inspections',
    'system'
  )),
  constraint observer_intelligence_severity_check check (severity in ('info','low','medium','high','urgent','critical')),
  constraint observer_intelligence_confidence_check check (confidence is null or confidence between 0 and 1),
  constraint observer_intelligence_review_status_check check (review_status in ('needs_review','reviewing','confirmed','dismissed','escalated','resolved')),
  constraint observer_intelligence_risk_check check (risk_score between 0 and 100),
  constraint observer_intelligence_parent_boundary_check check (parent_visible = false or review_status in ('confirmed','resolved'))
);

create table if not exists public.observer_signal_reviews (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.observer_intelligence_signals(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_role text not null,
  review_status text not null,
  review_note text,
  recommended_next_step text,
  escalated_to_role text,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint observer_signal_reviews_status_check check (review_status in ('needs_review','reviewing','confirmed','dismissed','escalated','resolved')),
  constraint observer_signal_reviews_role_check check (reviewer_role in ('admin','manager','owner','inspector','observer_site_owner'))
);

create table if not exists public.observer_safety_recommendations (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references public.observer_intelligence_signals(id) on delete cascade,
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  recommendation_type text not null,
  recommendation_text text not null,
  status text not null default 'open',
  requires_human_approval boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observer_safety_recommendation_type_check check (recommendation_type in (
    'review_camera_footage',
    'contact_manager',
    'schedule_follow_up_inspection',
    'verify_staff_presence',
    'request_document_update',
    'review_complaint',
    'check_camera_health'
  )),
  constraint observer_safety_recommendation_status_check check (status in ('open','approved','dismissed','completed','cancelled'))
);

create table if not exists public.observer_network_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'kindergarten',
  kindergarten_id uuid references public.gardens(id) on delete cascade,
  observer_site_id uuid references public.observer_sites(id) on delete cascade,
  readiness_score integer not null default 0,
  camera_coverage_score integer not null default 0,
  camera_health_score integer not null default 0,
  review_rate_score integer not null default 0,
  false_positive_score integer not null default 0,
  unresolved_signal_score integer not null default 0,
  compliance_integration_score integer not null default 0,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observer_network_score_scope_check check (scope_type in ('national','kindergarten','observer_site')),
  constraint observer_network_score_range_check check (
    readiness_score between 0 and 100 and camera_coverage_score between 0 and 100 and camera_health_score between 0 and 100
    and review_rate_score between 0 and 100 and false_positive_score between 0 and 100
    and unresolved_signal_score between 0 and 100 and compliance_integration_score between 0 and 100
  )
);

create unique index if not exists observer_intelligence_signals_source_unique
  on public.observer_intelligence_signals(source_type, source_id)
  where source_id is not null;
create index if not exists observer_intelligence_signals_scope_idx on public.observer_intelligence_signals(kindergarten_id, review_status, severity, created_at desc);
create index if not exists observer_intelligence_signals_site_idx on public.observer_intelligence_signals(observer_site_id, review_status, severity, created_at desc);
create index if not exists observer_intelligence_signals_risk_idx on public.observer_intelligence_signals(review_status, risk_score desc, created_at desc);
create index if not exists observer_intelligence_signals_pattern_idx on public.observer_intelligence_signals(pattern_key, repeated_count desc);
create index if not exists observer_signal_reviews_signal_idx on public.observer_signal_reviews(signal_id, created_at desc);
create index if not exists observer_safety_recommendations_scope_idx on public.observer_safety_recommendations(kindergarten_id, status, recommendation_type);
create index if not exists observer_network_scores_scope_idx on public.observer_network_score_snapshots(scope_type, kindergarten_id, calculated_at desc);

alter table public.observer_intelligence_signals enable row level security;
alter table public.observer_signal_reviews enable row level security;
alter table public.observer_safety_recommendations enable row level security;
alter table public.observer_network_score_snapshots enable row level security;

drop policy if exists "observer intelligence signals scoped read" on public.observer_intelligence_signals;
create policy "observer intelligence signals scoped read" on public.observer_intelligence_signals
for select using (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_intelligence_signals.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "observer intelligence signals scoped write" on public.observer_intelligence_signals;
create policy "observer intelligence signals scoped write" on public.observer_intelligence_signals
for all using (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_intelligence_signals.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
)
with check (
  public.is_admin()
  or (kindergarten_id is not null and public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id))
  or exists (
    select 1 from public.observer_site_memberships m
    where m.observer_site_id = observer_intelligence_signals.observer_site_id
      and m.profile_id = auth.uid()
      and m.active = true
      and m.member_role in ('owner','admin','operator')
  )
);

drop policy if exists "observer signal reviews scoped" on public.observer_signal_reviews;
create policy "observer signal reviews scoped" on public.observer_signal_reviews
for all using (
  public.is_admin()
  or exists (
    select 1 from public.observer_intelligence_signals s
    where s.id = signal_id
      and s.kindergarten_id is not null
      and public.current_role() in ('manager','owner','inspector')
      and public.can_access_garden(s.kindergarten_id)
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.observer_intelligence_signals s
    where s.id = signal_id
      and s.kindergarten_id is not null
      and public.current_role() in ('manager','owner','inspector')
      and public.can_access_garden(s.kindergarten_id)
  )
);

drop policy if exists "observer recommendations scoped" on public.observer_safety_recommendations;
create policy "observer recommendations scoped" on public.observer_safety_recommendations
for all using (public.is_admin() or (kindergarten_id is not null and public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id)))
with check (public.is_admin() or (kindergarten_id is not null and public.current_role() in ('manager','owner','inspector') and public.can_access_garden(kindergarten_id)));

drop policy if exists "observer network scores scoped read" on public.observer_network_score_snapshots;
create policy "observer network scores scoped read" on public.observer_network_score_snapshots
for select using (public.is_admin() or kindergarten_id is null or public.can_access_garden(kindergarten_id));
drop policy if exists "observer network scores admin write" on public.observer_network_score_snapshots;
create policy "observer network scores admin write" on public.observer_network_score_snapshots
for all using (public.is_admin()) with check (public.is_admin());

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, observer_site_id, camera_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'ai_camera',
  'ai_camera_events',
  e.id,
  e.kindergarten_id,
  e.observer_site_id,
  e.camera_id,
  e.severity,
  e.confidence_score,
  case when e.status in ('open') then 'needs_review' when e.status = 'reviewing' then 'reviewing' when e.status = 'confirmed' then 'confirmed' when e.status = 'dismissed' then 'dismissed' when e.status = 'escalated' then 'escalated' else 'needs_review' end,
  coalesce(e.recommended_action, e.observer_recommendation, 'בדיקת אדם מומלצת לפני כל פעולה.'),
  least(100, greatest(0,
    case e.severity when 'critical' then 90 when 'urgent' then 84 when 'high' then 72 when 'medium' then 52 when 'low' then 30 else 18 end
    + coalesce(round(e.confidence_score * 20), 0)::int
  )),
  concat('ai_camera:', e.kindergarten_id, ':', e.event_type),
  jsonb_build_object('title', e.title, 'description', e.description, 'parent_visible', false, 'human_review_required', true, 'no_automatic_accusation', true),
  e.created_at
from public.ai_camera_events e
where not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'ai_camera_events' and s.source_id = e.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, camera_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'legacy_ai',
  'ai_events',
  e.id,
  e.garden_id,
  e.camera_stream_id,
  e.severity::text,
  case when e.confidence is null then null else least(1, greatest(0, e.confidence / 100)) end,
  case when e.status::text in ('open') then 'needs_review' when e.status::text = 'reviewing' then 'reviewing' when e.status::text in ('done','completed') then 'resolved' else 'needs_review' end,
  'בדיקת אירוע תצפיתן ישן לפני פעולה.',
  least(100, greatest(0,
    case e.severity::text when 'critical' then 88 when 'urgent' then 82 when 'high' then 70 when 'medium' then 48 when 'low' then 28 else 18 end
    + coalesce(round(e.confidence / 5), 0)::int
  )),
  concat('legacy_ai:', e.garden_id, ':', e.event_type),
  jsonb_build_object('event_type', e.event_type, 'human_review_required', true, 'no_parent_auto_notify', true),
  e.detected_at
from public.ai_events e
where not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'ai_events' and s.source_id = e.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, observer_site_id, camera_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'audio',
  'audio_observer_events',
  e.id,
  e.kindergarten_id,
  e.site_id,
  e.camera_id,
  e.severity,
  e.confidence,
  case when e.review_status = 'pending_review' then 'needs_review' when e.review_status = 'false_positive' then 'dismissed' when e.review_status in ('confirmed','dismissed','escalated','reviewing') then e.review_status else 'needs_review' end,
  coalesce(e.recommended_action, 'בדיקה זהירה של אינדיקציית שמע. אין להסיק מסקנות ללא אדם.'),
  least(100, greatest(0,
    case e.severity when 'critical' then 88 when 'urgent' then 82 when 'high' then 70 when 'medium' then 48 when 'low' then 28 else 18 end
    + coalesce(round(e.confidence * 18), 0)::int
  )),
  concat('audio:', coalesce(e.kindergarten_id::text, e.site_id::text), ':', e.event_type),
  jsonb_build_object('event_type', e.event_type, 'raw_audio_exposed', false, 'human_review_required', true),
  e.created_at
from public.audio_observer_events e
where not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'audio_observer_events' and s.source_id = e.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, observer_site_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'correlated',
  'observer_correlated_events',
  e.id,
  e.kindergarten_id,
  e.observer_site_id,
  e.severity,
  e.confidence,
  case when e.status = 'open' then 'needs_review' when e.status = 'false_positive' then 'dismissed' when e.status in ('reviewing','confirmed','dismissed','escalated') then e.status else 'needs_review' end,
  'בדיקת ציר זמן מקושר והקשר האירועים.',
  least(100, greatest(0,
    case e.severity when 'critical' then 90 when 'urgent' then 84 when 'high' then 74 when 'medium' then 55 when 'low' then 32 else 20 end
    + coalesce(round(e.confidence * 18), 0)::int
  )),
  concat('correlated:', coalesce(e.kindergarten_id::text, e.observer_site_id::text), ':', e.correlation_type),
  jsonb_build_object('correlation_type', e.correlation_type, 'identity_tracking', false, 'human_review_required', true),
  e.created_at
from public.observer_correlated_events e
where not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'observer_correlated_events' and s.source_id = e.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'safety_incident',
  'incident_reports',
  i.id,
  i.garden_id,
  i.severity,
  null,
  case when i.status in ('closed','resolved','done') then 'resolved' else 'needs_review' end,
  'בדיקת אירוע בטיחות ותיעוד טיפול.',
  case i.severity when 'critical' then 92 when 'urgent' then 86 when 'high' then 74 when 'medium' then 52 when 'low' then 30 else 22 end,
  concat('incident:', i.garden_id, ':', i.incident_type),
  jsonb_build_object('title', i.title, 'human_review_required', true),
  i.created_at
from public.incident_reports i
where not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'incident_reports' and s.source_id = i.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'complaint',
  'complaints',
  c.id,
  c.garden_id,
  c.severity::text,
  null,
  case when c.status::text = 'closed' then 'resolved' else 'needs_review' end,
  'בדיקת תלונה בהקשר תצפיתן ופיקוח.',
  case c.severity::text when 'critical' then 88 when 'urgent' then 82 when 'high' then 68 when 'medium' then 46 when 'low' then 24 else 18 end,
  concat('complaint:', c.garden_id, ':', c.severity::text),
  jsonb_build_object('subject', c.subject, 'parent_raw_observer_access', false),
  c.created_at
from public.complaints c
where not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'complaints' and s.source_id = c.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'compliance',
  'compliance_alerts',
  a.id,
  a.garden_id,
  case a.severity when 'critical' then 'critical' when 'high' then 'high' when 'medium' then 'medium' else 'low' end,
  null,
  case when a.alert_status in ('resolved','verified','dismissed') then 'resolved' else 'needs_review' end,
  'בדיקת פער ציות המשפיע על מוכנות בטיחות.',
  case a.severity when 'critical' then 82 when 'high' then 68 when 'medium' then 45 else 24 end,
  concat('compliance:', a.garden_id, ':', a.category),
  jsonb_build_object('category', a.category, 'title', a.title),
  a.created_at
from public.compliance_alerts a
where a.garden_id is not null
  and not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'compliance_alerts' and s.source_id = a.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'inspection',
  'required_inspections',
  r.id,
  r.garden_id,
  case when r.due_at < now() then 'high' when r.due_at <= now() + interval '7 days' then 'medium' else 'low' end,
  null,
  case when r.status::text in ('done','completed','closed') then 'resolved' else 'needs_review' end,
  case when r.due_at < now() then 'ביקורת באיחור דורשת תיאום ובדיקה.' else 'מעקב אחר ביקורת קרובה.' end,
  case when r.due_at < now() then 70 when r.due_at <= now() + interval '7 days' then 48 else 24 end,
  concat('inspection:', r.garden_id, ':', date_trunc('month', r.due_at)::date),
  jsonb_build_object('due_at', r.due_at, 'status', r.status::text, 'human_review_required', true),
  r.created_at
from public.required_inspections r
where r.status::text not in ('done','completed','closed')
  and r.due_at <= now() + interval '30 days'
  and not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'required_inspections' and s.source_id = r.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, camera_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'camera_health',
  'camera_health_history',
  h.id,
  h.garden_id,
  h.camera_id,
  case when h.health_status in ('offline','disabled') then 'high' when h.health_status in ('degraded','reconnecting') then 'medium' else 'low' end,
  null,
  case when h.health_status = 'online' then 'resolved' else 'needs_review' end,
  'בדיקת מצלמה או Gateway לפני הסתמכות על התצפיתן.',
  case when h.health_status in ('offline','disabled') then 70 when h.health_status in ('degraded','reconnecting') then 48 else 20 end,
  concat('camera_health:', h.garden_id, ':', h.camera_id),
  jsonb_build_object('health_status', h.health_status, 'gateway_registration_status', h.gateway_registration_status, 'no_secrets_exposed', true),
  h.checked_at
from public.camera_health_history h
where h.garden_id is not null
  and h.health_status in ('offline','degraded','reconnecting','disabled')
  and not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'camera_health_history' and s.source_id = h.id);

insert into public.observer_intelligence_signals (
  signal_type, source_type, source_id, kindergarten_id, severity, confidence, review_status,
  recommended_action, risk_score, pattern_key, metadata, created_at
)
select
  'staff_attendance',
  'attendance',
  a.id,
  a.garden_id,
  'medium',
  null,
  'needs_review',
  'אימות נוכחות צוות מול מנהלת לפני כל מסקנה.',
  44,
  concat('staff_attendance:', a.garden_id, ':', a.attendance_date),
  jsonb_build_object('status', a.status::text, 'staff_id', a.staff_id, 'human_review_required', true),
  a.created_at
from public.attendance a
where a.staff_id is not null
  and a.status::text in ('absent','late','not_updated')
  and a.attendance_date >= current_date - interval '7 days'
  and not exists (select 1 from public.observer_intelligence_signals s where s.source_type = 'attendance' and s.source_id = a.id);

update public.observer_intelligence_signals s
set repeated_count = repeats.count_value,
    risk_score = least(100, s.risk_score + least(20, repeats.count_value * 3)),
    updated_at = now()
from (
  select pattern_key, count(*)::integer as count_value
  from public.observer_intelligence_signals
  where pattern_key is not null
    and created_at >= now() - interval '30 days'
  group by pattern_key
) repeats
where s.pattern_key = repeats.pattern_key;

insert into public.observer_safety_recommendations (signal_id, kindergarten_id, observer_site_id, recommendation_type, recommendation_text, status, requires_human_approval, metadata)
select
  s.id,
  s.kindergarten_id,
  s.observer_site_id,
  case
    when s.signal_type = 'camera_health' then 'check_camera_health'
    when s.signal_type = 'compliance' then 'request_document_update'
    when s.signal_type = 'complaint' then 'review_complaint'
    when s.signal_type = 'staff_attendance' then 'verify_staff_presence'
    when s.risk_score >= 75 then 'schedule_follow_up_inspection'
    else 'review_camera_footage'
  end,
  case
    when s.signal_type = 'camera_health' then 'בדיקת חיבור מצלמה ושער וידאו.'
    when s.signal_type = 'compliance' then 'בדיקת מסמך או דרישת ציות חסרה.'
    when s.signal_type = 'complaint' then 'בדיקת תלונה מול הגן לפני כל החלטה.'
    when s.signal_type = 'staff_attendance' then 'אימות נוכחות צוות עם מנהלת.'
    when s.risk_score >= 75 then 'שקילת ביקורת המשך לאחר בדיקת אדם.'
    else 'סקירת המידע הזמין והקשר האירוע.'
  end,
  'open',
  true,
  jsonb_build_object('automatic_action', false, 'human_approval_required', true)
from public.observer_intelligence_signals s
where s.review_status in ('needs_review','reviewing','escalated')
  and not exists (select 1 from public.observer_safety_recommendations r where r.signal_id = s.id);

comment on table public.observer_intelligence_signals is 'Unified observer intelligence signals across cameras, AI, audio, incidents, complaints, compliance and inspections. Human review required.';
comment on column public.observer_intelligence_signals.parent_visible is 'Parents must not see raw observer signals. True is allowed only after human-confirmed/resolved workflow.';
comment on column public.observer_intelligence_signals.recommended_action is 'Careful operational recommendation only. No accusations, discipline or automatic parent alerts.';
comment on table public.observer_signal_reviews is 'Human review queue history for admin, manager and inspector review.';
comment on table public.observer_safety_recommendations is 'Safety recommendations requiring human approval. No autonomous decisions.';
comment on table public.observer_network_score_snapshots is 'Observer readiness scoring across camera coverage, health, review rate, false positives, unresolved signals and compliance integration.';
