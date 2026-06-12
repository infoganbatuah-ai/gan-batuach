-- PHASE 136: Public website, marketing, lead generation and conversion platform.
-- Adds conversion tracking and demo booking readiness without external calendar activation.

alter table public.leads
  add column if not exists source text,
  add column if not exists campaign text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists funnel_stage text not null default 'visit',
  add column if not exists owner_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists follow_up_at timestamptz,
  add column if not exists lead_score integer not null default 0,
  add column if not exists qualification jsonb not null default '{}'::jsonb,
  add column if not exists conversion_goal text;

alter table public.leads
  drop constraint if exists leads_funnel_stage_check;

alter table public.leads
  add constraint leads_funnel_stage_check check (funnel_stage in ('visit','learn','book_demo','trial','subscription','parent_request','converted','lost'));

alter table public.leads
  drop constraint if exists leads_score_range_check;

alter table public.leads
  add constraint leads_score_range_check check (lead_score between 0 and 100);

create table if not exists public.demo_booking_requests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  garden_name text,
  contact_name text not null,
  contact_phone text not null,
  contact_email text,
  city text,
  children_count integer,
  staff_count integer,
  preferred_time text,
  qualification jsonb not null default '{}'::jsonb,
  status text not null default 'new',
  owner_profile_id uuid references public.profiles(id) on delete set null,
  follow_up_at timestamptz,
  calendar_event_ref text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_booking_status_check check (status in ('new','contacted','scheduled','completed','cancelled','lost'))
);

create table if not exists public.website_conversion_events (
  id uuid primary key default gen_random_uuid(),
  event_key text,
  session_key text,
  lead_id uuid references public.leads(id) on delete set null,
  event_type text not null,
  page_path text not null,
  audience text,
  campaign text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint website_conversion_event_type_check check (event_type in ('visit','cta_click','lead_submitted','demo_booked','roi_calculated','parent_request','trial_requested','subscription_started'))
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique,
  campaign_name text not null,
  audience text not null,
  status text not null default 'draft',
  primary_goal text not null,
  landing_page_path text,
  message_angle text,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaign_audience_check check (audience in ('parents','kindergartens','inspectors','networks','public')),
  constraint marketing_campaign_status_check check (status in ('draft','active','paused','completed','archived'))
);

create table if not exists public.marketing_content_ideas (
  id uuid primary key default gen_random_uuid(),
  idea_key text not null unique,
  content_type text not null,
  audience text not null,
  title text not null,
  brief text not null,
  status text not null default 'idea',
  priority text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_content_type_check check (content_type in ('blog','email_sequence','landing_page','social_post','case_study','campaign')),
  constraint marketing_content_status_check check (status in ('idea','draft','review','ready','published','archived')),
  constraint marketing_content_priority_check check (priority in ('low','medium','high','urgent'))
);

create index if not exists leads_marketing_stage_idx on public.leads(lead_type, funnel_stage, status, created_at desc);
create index if not exists demo_booking_status_idx on public.demo_booking_requests(status, created_at desc);
create index if not exists website_conversion_events_type_idx on public.website_conversion_events(event_type, page_path, created_at desc);
create index if not exists marketing_campaigns_status_idx on public.marketing_campaigns(status, audience);
create index if not exists marketing_content_status_idx on public.marketing_content_ideas(status, audience, priority);

alter table public.demo_booking_requests enable row level security;
alter table public.website_conversion_events enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.marketing_content_ideas enable row level security;

drop policy if exists "demo booking admin read" on public.demo_booking_requests;
create policy "demo booking admin read" on public.demo_booking_requests for select using (public.is_admin());

drop policy if exists "demo booking public insert" on public.demo_booking_requests;
create policy "demo booking public insert" on public.demo_booking_requests for insert with check (true);

drop policy if exists "demo booking admin update" on public.demo_booking_requests;
create policy "demo booking admin update" on public.demo_booking_requests for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "website events admin read" on public.website_conversion_events;
create policy "website events admin read" on public.website_conversion_events for select using (public.is_admin());

drop policy if exists "website events public insert" on public.website_conversion_events;
create policy "website events public insert" on public.website_conversion_events for insert with check (true);

drop policy if exists "marketing campaigns admin only" on public.marketing_campaigns;
create policy "marketing campaigns admin only" on public.marketing_campaigns for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "marketing content admin only" on public.marketing_content_ideas;
create policy "marketing content admin only" on public.marketing_content_ideas for all using (public.is_admin()) with check (public.is_admin());

insert into public.marketing_campaigns (campaign_key, campaign_name, audience, status, primary_goal, landing_page_path, message_angle)
values
  ('parent-pressure-safety', 'Parent pressure safety campaign', 'parents', 'active', 'parent_request', '/parents-demand-safety', 'דרשו שקיפות ובטיחות מהגן שלכם'),
  ('kindergarten-demo-funnel', 'Kindergarten demo booking funnel', 'kindergartens', 'active', 'book_demo', '/book-demo', 'ניהול, פיקוח ושקיפות במקום אחד'),
  ('safety-standard-authority', 'Gan Batuach Standard authority campaign', 'public', 'active', 'learn', '/safety-standard', 'תקן בטיחות ושקיפות חדש לגני ילדים')
on conflict (campaign_key)
do update set
  campaign_name = excluded.campaign_name,
  audience = excluded.audience,
  status = excluded.status,
  primary_goal = excluded.primary_goal,
  landing_page_path = excluded.landing_page_path,
  message_angle = excluded.message_angle,
  updated_at = now();

insert into public.marketing_content_ideas (idea_key, content_type, audience, title, brief, status, priority)
values
  ('blog-parent-transparency', 'blog', 'parents', 'איך יודעים שהגן באמת שקוף?', 'מדריך הורים לשאלות על פיקוח, עדכונים, מצלמות ונהלים.', 'idea', 'high'),
  ('email-kindergarten-demo', 'email_sequence', 'kindergartens', 'רצף מיילים אחרי demo', 'שלושה מיילים: כאב תפעולי, אמון הורים, מעבר לפיילוט.', 'idea', 'medium'),
  ('case-study-pilot-template', 'case_study', 'kindergartens', 'תבנית סיפור פיילוט', 'מסגרת לכתיבת סיפור הצלחה לאחר גן ראשון.', 'idea', 'medium'),
  ('campaign-parent-demand', 'campaign', 'parents', 'הגן שלכם עדיין לא בגן בטוח?', 'קמפיין שמניע הורים לבקש שקיפות מהגן.', 'idea', 'high')
on conflict (idea_key)
do update set
  content_type = excluded.content_type,
  audience = excluded.audience,
  title = excluded.title,
  brief = excluded.brief,
  status = excluded.status,
  priority = excluded.priority,
  updated_at = now();

comment on table public.demo_booking_requests is 'Public demo booking and qualification requests. Calendar integration is readiness-only.';
comment on table public.website_conversion_events is 'Website conversion analytics for visits, CTA clicks, leads, demo bookings and ROI calculations.';
comment on table public.marketing_campaigns is 'Marketing campaign registry for acquisition funnels and parent pressure strategy.';
comment on table public.marketing_content_ideas is 'AI marketing assistant content backlog: blogs, emails, campaigns and case studies.';

notify pgrst, 'reload schema';
