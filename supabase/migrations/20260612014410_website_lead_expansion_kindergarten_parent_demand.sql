-- PHASE 144A: Website lead expansion, kindergarten registration and parent demand platform.
-- Aligns commercial lead statuses, demand scoring and acquisition templates before launch.

alter table public.leads
  add column if not exists source text,
  add column if not exists campaign text,
  add column if not exists funnel_stage text not null default 'visit',
  add column if not exists lead_score integer not null default 0,
  add column if not exists qualification jsonb not null default '{}'::jsonb,
  add column if not exists conversion_goal text,
  add column if not exists follow_up_at timestamptz;

alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads
  add constraint leads_status_check check (status in (
    'new',
    'contacted',
    'qualified',
    'approved',
    'onboarding',
    'converted',
    'rejected',
    'not_relevant',
    'new_parent_lead',
    'new_garden_onboarding',
    'new_inspector_lead',
    'request_more_details',
    'parent_approved_pending_child_completion',
    'approved_pending_parent_completion',
    'lead_submitted',
    'lead_review',
    'lead_approved',
    'credentials_sent',
    'onboarding_in_progress',
    'onboarding_submitted',
    'correction_required',
    'pending_final_approval',
    'registration_pending',
    'admin_approved',
    'activation_in_progress',
    'payment_pending',
    'active',
    'suspended',
    'archived'
  ));

alter table public.leads drop constraint if exists leads_funnel_stage_check;
alter table public.leads
  add constraint leads_funnel_stage_check check (funnel_stage in (
    'visit',
    'learn',
    'lead',
    'book_demo',
    'demo',
    'qualification',
    'approval',
    'trial',
    'subscription',
    'parent_request',
    'conversion',
    'activation',
    'converted',
    'lost'
  ));

create table if not exists public.website_lead_entry_points (
  id uuid primary key default gen_random_uuid(),
  entry_key text not null unique,
  title text not null,
  route_path text not null,
  lead_source text not null,
  status text not null default 'active',
  primary_cta text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_lead_entry_source_check check (lead_source in ('demo_booking','kindergarten_registration','parent_request','referral')),
  constraint website_lead_entry_status_check check (status in ('active','paused','archived'))
);

create table if not exists public.growth_lead_communications (
  id uuid primary key default gen_random_uuid(),
  growth_lead_id uuid,
  channel text not null,
  template_key text,
  subject text,
  message_preview text,
  status text not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parent_demand_interest_scores (
  id uuid primary key default gen_random_uuid(),
  garden_name text not null,
  garden_name_key text not null,
  city text,
  city_key text not null default '',
  address text,
  address_key text not null default '',
  request_count integer not null default 0,
  demand_tier text not null default 'normal',
  interest_score integer not null default 0,
  last_request_at timestamptz,
  recommended_action text not null default 'contact_parent',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_demand_tier_check check (demand_tier in ('normal','medium','high')),
  constraint parent_demand_interest_score_check check (interest_score between 0 and 100),
  constraint parent_demand_action_check check (recommended_action in ('contact_parent','contact_kindergarten','book_demo','convert_to_registration'))
);

alter table public.parent_demand_interest_scores
  add column if not exists city_key text,
  add column if not exists address_key text;

update public.parent_demand_interest_scores
set
  city_key = lower(coalesce(nullif(trim(city), ''), '')),
  address_key = lower(coalesce(nullif(trim(address), ''), ''))
where city_key is null
   or address_key is null;

alter table public.parent_demand_interest_scores
  alter column city_key set default '',
  alter column address_key set default '',
  alter column city_key set not null,
  alter column address_key set not null;

delete from public.parent_demand_interest_scores older
using public.parent_demand_interest_scores newer
where older.ctid < newer.ctid
  and older.garden_name_key = newer.garden_name_key
  and older.city_key = newer.city_key
  and older.address_key = newer.address_key;

create unique index if not exists parent_demand_interest_scores_unique_idx on public.parent_demand_interest_scores(garden_name_key, city_key, address_key);
create index if not exists parent_demand_interest_scores_priority_idx on public.parent_demand_interest_scores(demand_tier, interest_score desc, request_count desc);
create index if not exists leads_acquisition_source_status_idx on public.leads(source, status, lead_score desc, created_at desc);

alter table public.website_lead_entry_points enable row level security;
alter table public.parent_demand_interest_scores enable row level security;
alter table public.growth_lead_communications enable row level security;

drop policy if exists "website lead entry points public read" on public.website_lead_entry_points;
create policy "website lead entry points public read" on public.website_lead_entry_points for select using (status = 'active' or public.is_admin());

drop policy if exists "website lead entry points admin only" on public.website_lead_entry_points;
create policy "website lead entry points admin only" on public.website_lead_entry_points for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "parent demand interest admin only" on public.parent_demand_interest_scores;
create policy "parent demand interest admin only" on public.parent_demand_interest_scores for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth lead communications admin only" on public.growth_lead_communications;
create policy "growth lead communications admin only" on public.growth_lead_communications for all using (public.is_admin()) with check (public.is_admin());

insert into public.website_lead_entry_points (entry_key, title, route_path, lead_source, status, primary_cta, description)
values
  ('book-demo', 'קבע הדגמה', '/book-demo', 'demo_booking', 'active', 'קבע הדגמה', 'Demo booking lead source for managers who want a guided walkthrough.'),
  ('join-kindergarten', 'רישום גן ילדים', '/join-kindergarten', 'kindergarten_registration', 'active', 'רישום גן למערכת גן בטוח', 'Kindergarten registration lead source that starts Phase 139 after admin approval.'),
  ('parents', 'הורים? לחצו כאן', '/parents', 'parent_request', 'active', 'הגן שלי עדיין לא בגן בטוח', 'Parent demand request lead source that creates pressure and demand scoring.')
on conflict (entry_key) do update set
  title = excluded.title,
  route_path = excluded.route_path,
  lead_source = excluded.lead_source,
  status = excluded.status,
  primary_cta = excluded.primary_cta,
  description = excluded.description,
  updated_at = now();

insert into public.parent_demand_interest_scores (
  garden_name,
  garden_name_key,
  city,
  city_key,
  address,
  address_key,
  request_count,
  demand_tier,
  interest_score,
  last_request_at,
  recommended_action,
  metadata
)
select
  coalesce(nullif(trim(garden_name), ''), 'גן ללא שם'),
  lower(coalesce(nullif(trim(garden_name), ''), 'גן ללא שם')),
  nullif(trim(city), ''),
  lower(coalesce(nullif(trim(city), ''), '')),
  nullif(trim(address), ''),
  lower(coalesce(nullif(trim(address), ''), '')),
  count(*)::integer,
  case when count(*) >= 10 then 'high' when count(*) >= 5 then 'medium' else 'normal' end,
  least(100, 30 + count(*)::integer * 7),
  max(created_at),
  case when count(*) >= 5 then 'contact_kindergarten' else 'contact_parent' end,
  jsonb_build_object('source', 'phase_144a_parent_demand_rollup')
from public.leads
where source = 'parent_request'
group by coalesce(nullif(trim(garden_name), ''), 'גן ללא שם'), nullif(trim(city), ''), nullif(trim(address), '')
on conflict (garden_name_key, city_key, address_key)
do update set
  request_count = excluded.request_count,
  demand_tier = excluded.demand_tier,
  interest_score = excluded.interest_score,
  last_request_at = excluded.last_request_at,
  recommended_action = excluded.recommended_action,
  updated_at = now();

update public.leads l
set
  qualification = coalesce(l.qualification, '{}'::jsonb) || jsonb_build_object(
    'parent_request_count',
    p.request_count,
    'demand_tier',
    p.demand_tier
  ),
  lead_score = greatest(coalesce(l.lead_score, 0), p.interest_score),
  updated_at = now()
from public.parent_demand_interest_scores p
where l.source = 'parent_request'
  and lower(coalesce(nullif(trim(l.garden_name), ''), 'גן ללא שם')) = p.garden_name_key
  and lower(coalesce(nullif(trim(l.city), ''), '')) = p.city_key
  and lower(coalesce(nullif(trim(l.address), ''), '')) = p.address_key;

insert into public.growth_lead_communications (channel, template_key, subject, message_preview, status, metadata)
values
  ('email', 'demo_confirmation', 'בקשת הדגמה התקבלה', 'תודה שקבעתם הדגמה. צוות גן בטוח יצור קשר לתיאום.', 'draft', '{"phase":"144A"}'::jsonb),
  ('whatsapp', 'registration_received', 'רישום גן התקבל', 'הרישום התקבל. לאחר אישור תקבלו פרטי כניסה חד-פעמיים.', 'draft', '{"phase":"144A"}'::jsonb),
  ('sms', 'onboarding_invitation', 'הזמנה להפעלת גן', 'הגן אושר. היכנסו לקישור והשלימו את אשף ההפעלה.', 'draft', '{"phase":"144A"}'::jsonb),
  ('email', 'follow_up_reminder', 'תזכורת המשך רישום', 'נותרו פעולות להשלמת ההפעלה של הגן.', 'draft', '{"phase":"144A"}'::jsonb)
on conflict do nothing;

comment on table public.website_lead_entry_points is 'Public website acquisition entry points: demo, kindergarten registration and parent demand.';
comment on table public.parent_demand_interest_scores is 'Aggregated parent demand scoring by kindergarten, used for medium/high demand prioritization.';

notify pgrst, 'reload schema';
