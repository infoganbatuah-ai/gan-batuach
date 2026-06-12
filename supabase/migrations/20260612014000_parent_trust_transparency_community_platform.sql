-- PHASE 140: Parent trust, transparency and community platform.
-- Parent-safe transparency only. No raw AI events, no internal investigations.

create table if not exists public.parent_transparency_scores (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  transparency_score integer not null default 0,
  update_frequency_score integer not null default 0,
  response_time_score integer not null default 0,
  inspection_visibility_score integer not null default 0,
  document_readiness_score integer not null default 0,
  communication_quality_score integer not null default 0,
  explanation text,
  calculated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_transparency_scores_range_check check (
    transparency_score between 0 and 100
    and update_frequency_score between 0 and 100
    and response_time_score between 0 and 100
    and inspection_visibility_score between 0 and 100
    and document_readiness_score between 0 and 100
    and communication_quality_score between 0 and 100
  )
);

create table if not exists public.parent_surveys (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  survey_type text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  questions jsonb not null default '[]'::jsonb,
  visible_to_parents boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_surveys_type_check check (survey_type in ('satisfaction','feedback','annual_review','special_questionnaire')),
  constraint parent_surveys_status_check check (status in ('draft','active','closed','archived'))
);

create table if not exists public.parent_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.parent_surveys(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  response_data jsonb not null default '{}'::jsonb,
  completion_status text not null default 'completed',
  submitted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint parent_survey_response_status_check check (completion_status in ('started','completed','skipped'))
);

create table if not exists public.parent_feedback_items (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  feedback_type text not null,
  title text not null,
  body text,
  lifecycle_status text not null default 'received',
  priority text not null default 'normal',
  manager_response text,
  responded_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_feedback_type_check check (feedback_type in ('suggestion','compliment','concern','complaint')),
  constraint parent_feedback_status_check check (lifecycle_status in ('received','under_review','in_progress','resolved','closed')),
  constraint parent_feedback_priority_check check (priority in ('low','normal','important','urgent'))
);

create table if not exists public.community_announcements (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  title text not null,
  body text not null,
  announcement_type text not null default 'update',
  audience text not null default 'parents',
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_announcement_type_check check (announcement_type in ('event','holiday','update','activity','important')),
  constraint community_announcement_audience_check check (audience in ('parents','staff','all'))
);

create table if not exists public.community_calendar_events (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  title text not null,
  description text,
  event_type text not null default 'activity',
  starts_at timestamptz not null,
  ends_at timestamptz,
  visible_to_parents boolean not null default true,
  participation_enabled boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_calendar_event_type_check check (event_type in ('event','holiday','activity','special_day','meeting'))
);

create table if not exists public.parent_request_center_items (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  request_type text not null,
  title text not null,
  body text,
  lifecycle_status text not null default 'received',
  response_text text,
  responded_at timestamptz,
  closed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_request_center_type_check check (request_type in ('document_request','information_request','meeting_request')),
  constraint parent_request_center_status_check check (lifecycle_status in ('received','under_review','answered','closed'))
);

create table if not exists public.parent_participation_items (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  calendar_event_id uuid references public.community_calendar_events(id) on delete set null,
  participation_type text not null,
  status text not null default 'registered',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_participation_type_check check (participation_type in ('event_participation','volunteering','activity_involvement')),
  constraint parent_participation_status_check check (status in ('registered','confirmed','cancelled','completed'))
);

create table if not exists public.parent_trust_reports (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  trust_score integer not null default 0,
  transparency_score integer not null default 0,
  communication_score integer not null default 0,
  engagement_score integer not null default 0,
  summary text,
  visible_to_manager boolean not null default true,
  visible_to_parents boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint parent_trust_report_type_check check (report_type in ('monthly_trust','communication','engagement')),
  constraint parent_trust_report_score_check check (
    trust_score between 0 and 100
    and transparency_score between 0 and 100
    and communication_score between 0 and 100
    and engagement_score between 0 and 100
  )
);

create index if not exists parent_transparency_scores_garden_idx on public.parent_transparency_scores(garden_id, calculated_at desc);
create index if not exists parent_surveys_garden_idx on public.parent_surveys(garden_id, status, visible_to_parents);
create index if not exists parent_survey_responses_parent_idx on public.parent_survey_responses(parent_profile_id, submitted_at desc);
create index if not exists parent_feedback_items_garden_idx on public.parent_feedback_items(garden_id, lifecycle_status, created_at desc);
create index if not exists community_announcements_garden_idx on public.community_announcements(garden_id, published, published_at desc);
create index if not exists community_calendar_events_garden_idx on public.community_calendar_events(garden_id, starts_at);
create index if not exists parent_request_center_items_parent_idx on public.parent_request_center_items(parent_profile_id, lifecycle_status, created_at desc);
create index if not exists parent_participation_items_parent_idx on public.parent_participation_items(parent_profile_id, created_at desc);
create index if not exists parent_trust_reports_garden_idx on public.parent_trust_reports(garden_id, report_type, period_end desc);

alter table public.parent_transparency_scores enable row level security;
alter table public.parent_surveys enable row level security;
alter table public.parent_survey_responses enable row level security;
alter table public.parent_feedback_items enable row level security;
alter table public.community_announcements enable row level security;
alter table public.community_calendar_events enable row level security;
alter table public.parent_request_center_items enable row level security;
alter table public.parent_participation_items enable row level security;
alter table public.parent_trust_reports enable row level security;

drop policy if exists "parent transparency scoped read" on public.parent_transparency_scores;
create policy "parent transparency scoped read" on public.parent_transparency_scores for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "parent surveys scoped read" on public.parent_surveys;
create policy "parent surveys scoped read" on public.parent_surveys for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or (garden_id is null and visible_to_parents = true and status = 'active')
);
drop policy if exists "parent surveys manager write" on public.parent_surveys;
create policy "parent surveys manager write" on public.parent_surveys for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "parent survey responses scoped" on public.parent_survey_responses;
create policy "parent survey responses scoped" on public.parent_survey_responses for all using (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id)) with check (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "parent feedback scoped" on public.parent_feedback_items;
create policy "parent feedback scoped" on public.parent_feedback_items for all using (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id)) with check (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "community announcements scoped read" on public.community_announcements;
create policy "community announcements scoped read" on public.community_announcements for select using (public.is_admin() or public.can_access_garden(garden_id));
drop policy if exists "community announcements manager write" on public.community_announcements;
create policy "community announcements manager write" on public.community_announcements for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "community calendar scoped read" on public.community_calendar_events;
create policy "community calendar scoped read" on public.community_calendar_events for select using (public.is_admin() or public.can_access_garden(garden_id));
drop policy if exists "community calendar manager write" on public.community_calendar_events;
create policy "community calendar manager write" on public.community_calendar_events for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "parent request center scoped" on public.parent_request_center_items;
create policy "parent request center scoped" on public.parent_request_center_items for all using (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id)) with check (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "parent participation scoped" on public.parent_participation_items;
create policy "parent participation scoped" on public.parent_participation_items for all using (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id)) with check (public.is_admin() or parent_profile_id = auth.uid() or public.can_access_garden(garden_id));

drop policy if exists "parent trust reports scoped read" on public.parent_trust_reports;
create policy "parent trust reports scoped read" on public.parent_trust_reports for select using (public.is_admin() or public.can_access_garden(garden_id));

insert into public.parent_surveys (survey_type, title, description, status, visible_to_parents, questions)
values
  ('satisfaction', 'סקר שביעות רצון קצר', 'איך הייתה החוויה שלכם החודש?', 'active', true, '[{"key":"satisfaction","label":"עד כמה אתם מרוצים?","type":"rating"},{"key":"comment","label":"מה חשוב לשפר?","type":"text"}]'::jsonb),
  ('feedback', 'משוב תקשורת', 'עוזר לגן לשפר תגובות ועדכונים.', 'draft', false, '[{"key":"clarity","label":"האם העדכונים ברורים?","type":"rating"}]'::jsonb)
on conflict do nothing;

insert into public.parent_trust_education_items (item_key, category, title, summary, body, display_order)
values
  ('community-emergency-readiness', 'safety_guides', 'מוכנות חירום בקהילה', 'מה הורים יכולים לדעת על נהלי חירום בלי לחשוף מידע רגיש.', 'גן בטוח מציג להורים מידע מאושר על נהלי חירום, הכנות ועדכונים חשובים.', 40),
  ('transparency-boundaries', 'inspection_explanations', 'גבולות שקיפות בריאים', 'שקיפות אינה חשיפת חקירות או מידע אישי.', 'הורים רואים סיכומים מאושרים, סטטוסי טיפול ומידע רלוונטי בלבד.', 41)
on conflict (item_key) do update set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  active = true;

comment on table public.parent_transparency_scores is 'Parent-safe kindergarten transparency score based on updates, response, inspections, documents and communication quality.';
comment on table public.parent_feedback_items is 'Parent suggestions, compliments, concerns and complaints lifecycle.';
comment on table public.community_announcements is 'Kindergarten community announcements visible only to scoped users.';
comment on table public.parent_trust_reports is 'Monthly parent trust, communication and engagement reports.';
