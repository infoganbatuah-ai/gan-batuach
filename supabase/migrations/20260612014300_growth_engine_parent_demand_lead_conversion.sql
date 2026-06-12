-- PHASE 143: Growth engine, parent demand, lead conversion and market expansion.
-- Creates a unified growth layer above existing public lead flows.

alter table public.leads
  add column if not exists source text,
  add column if not exists manager_name text,
  add column if not exists address text,
  add column if not exists campaign text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists funnel_stage text not null default 'visit',
  add column if not exists follow_up_at timestamptz,
  add column if not exists lead_score integer not null default 0,
  add column if not exists qualification jsonb not null default '{}'::jsonb,
  add column if not exists conversion_goal text;

create table if not exists public.growth_leads (
  id uuid primary key default gen_random_uuid(),
  source_lead_id uuid references public.leads(id) on delete set null,
  lead_source text not null,
  status text not null default 'new',
  funnel_stage text not null default 'lead',
  interest_score integer not null default 0,
  garden_name text,
  parent_name text,
  contact_name text,
  manager_name text,
  phone text,
  email text,
  city text,
  address text,
  campaign text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  parent_request_count integer not null default 0,
  high_demand boolean not null default false,
  assigned_to uuid references public.profiles(id) on delete set null,
  follow_up_at timestamptz,
  qualified_at timestamptz,
  approved_at timestamptz,
  converted_at timestamptz,
  rejected_at timestamptz,
  converted_garden_id uuid references public.gardens(id) on delete set null,
  qualification jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_leads_source_check check (lead_source in ('demo_booking','kindergarten_registration','parent_request','referral','campaign')),
  constraint growth_leads_status_check check (status in ('new','contacted','qualified','approved','converted','rejected')),
  constraint growth_leads_funnel_stage_check check (funnel_stage in ('visit','lead','demo','qualification','approval','conversion','activation','lost')),
  constraint growth_leads_interest_score_check check (interest_score between 0 and 100)
);

create unique index if not exists growth_leads_source_lead_unique_idx on public.growth_leads(source_lead_id);
create index if not exists growth_leads_source_status_idx on public.growth_leads(lead_source, status, created_at desc);
create index if not exists growth_leads_city_idx on public.growth_leads(city, lead_source, status);
create index if not exists growth_leads_interest_idx on public.growth_leads(interest_score desc, high_demand desc);

create table if not exists public.growth_parent_demand_clusters (
  id uuid primary key default gen_random_uuid(),
  garden_name text not null,
  garden_name_key text not null,
  city text,
  city_key text not null default '',
  address text,
  address_key text not null default '',
  request_count integer not null default 0,
  parent_contacts integer not null default 0,
  manager_contacts integer not null default 0,
  high_demand boolean not null default false,
  first_requested_at timestamptz,
  last_requested_at timestamptz,
  recommended_next_action text not null default 'contact_kindergarten',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_parent_demand_next_action_check check (recommended_next_action in ('contact_parent','contact_kindergarten','book_demo','convert_to_registration','monitor'))
);

alter table public.growth_parent_demand_clusters
  add column if not exists garden_name_key text,
  add column if not exists city_key text,
  add column if not exists address_key text;

update public.growth_parent_demand_clusters
set
  garden_name_key = lower(coalesce(nullif(trim(garden_name), ''), 'גן ללא שם')),
  city_key = lower(coalesce(nullif(trim(city), ''), '')),
  address_key = lower(coalesce(nullif(trim(address), ''), ''))
where garden_name_key is null
   or city_key is null
   or address_key is null;

alter table public.growth_parent_demand_clusters
  alter column garden_name_key set not null,
  alter column city_key set not null,
  alter column address_key set not null;

delete from public.growth_parent_demand_clusters older
using public.growth_parent_demand_clusters newer
where older.ctid < newer.ctid
  and older.garden_name_key = newer.garden_name_key
  and older.city_key = newer.city_key
  and older.address_key = newer.address_key;

create unique index if not exists growth_parent_demand_unique_idx on public.growth_parent_demand_clusters(garden_name_key, city_key, address_key);
create index if not exists growth_parent_demand_priority_idx on public.growth_parent_demand_clusters(high_demand desc, request_count desc, last_requested_at desc);

create table if not exists public.growth_conversion_events (
  id uuid primary key default gen_random_uuid(),
  growth_lead_id uuid references public.growth_leads(id) on delete cascade,
  source_lead_id uuid references public.leads(id) on delete set null,
  event_type text not null,
  from_stage text,
  to_stage text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint growth_conversion_event_type_check check (event_type in ('visit','lead_created','demo_booked','contacted','qualified','approved','converted','activated','rejected','follow_up_scheduled'))
);

create index if not exists growth_conversion_events_lead_idx on public.growth_conversion_events(growth_lead_id, created_at desc);
create index if not exists growth_conversion_events_type_idx on public.growth_conversion_events(event_type, created_at desc);

create table if not exists public.growth_lead_communications (
  id uuid primary key default gen_random_uuid(),
  growth_lead_id uuid references public.growth_leads(id) on delete cascade,
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
  updated_at timestamptz not null default now(),
  constraint growth_lead_communications_channel_check check (channel in ('whatsapp','sms','email','phone','in_app')),
  constraint growth_lead_communications_status_check check (status in ('draft','scheduled','sent','failed','cancelled'))
);

create index if not exists growth_lead_communications_status_idx on public.growth_lead_communications(status, channel, created_at desc);

create table if not exists public.growth_follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  growth_lead_id uuid references public.growth_leads(id) on delete cascade,
  task_type text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  title text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_follow_up_task_type_check check (task_type in ('incomplete_registration','missed_demo','pending_activation','pending_payment','parent_demand_follow_up','campaign_follow_up','referral_follow_up')),
  constraint growth_follow_up_status_check check (status in ('open','in_progress','completed','cancelled','overdue')),
  constraint growth_follow_up_priority_check check (priority in ('low','medium','high','urgent'))
);

create index if not exists growth_follow_up_tasks_due_idx on public.growth_follow_up_tasks(status, due_at, priority);

create table if not exists public.growth_campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null,
  campaign_name text,
  source text not null default 'campaign',
  visits integer not null default 0,
  leads integer not null default 0,
  demos integer not null default 0,
  qualified integer not null default 0,
  conversions integer not null default 0,
  estimated_roi numeric(12,2) not null default 0,
  report_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_campaign_metrics_source_check check (source in ('demo_booking','kindergarten_registration','parent_request','referral','campaign'))
);

create unique index if not exists growth_campaign_metrics_unique_idx on public.growth_campaign_metrics(campaign_key, report_date);

create table if not exists public.growth_referrals (
  id uuid primary key default gen_random_uuid(),
  growth_lead_id uuid references public.growth_leads(id) on delete set null,
  referral_type text not null,
  referrer_name text,
  referrer_phone text,
  referrer_email text,
  referred_garden_name text,
  city text,
  status text not null default 'new',
  reward_status text not null default 'not_applicable',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint growth_referrals_type_check check (referral_type in ('kindergarten','parent','partner')),
  constraint growth_referrals_status_check check (status in ('new','contacted','qualified','converted','rejected')),
  constraint growth_referrals_reward_status_check check (reward_status in ('not_applicable','pending','approved','paid','cancelled'))
);

create index if not exists growth_referrals_status_idx on public.growth_referrals(referral_type, status, created_at desc);

create table if not exists public.growth_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  period_start date not null,
  period_end date not null,
  total_leads integer not null default 0,
  total_conversions integer not null default 0,
  parent_demand_count integer not null default 0,
  demo_count integer not null default 0,
  top_cities jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint growth_reports_type_check check (report_type in ('lead','conversion','city','parent_demand','campaign','weekly','monthly'))
);

create index if not exists growth_reports_type_period_idx on public.growth_reports(report_type, period_start desc, period_end desc);

create table if not exists public.growth_lead_audit_logs (
  id uuid primary key default gen_random_uuid(),
  growth_lead_id uuid references public.growth_leads(id) on delete cascade,
  action text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_lead_audit_logs_lead_idx on public.growth_lead_audit_logs(growth_lead_id, created_at desc);

alter table public.growth_leads enable row level security;
alter table public.growth_parent_demand_clusters enable row level security;
alter table public.growth_conversion_events enable row level security;
alter table public.growth_lead_communications enable row level security;
alter table public.growth_follow_up_tasks enable row level security;
alter table public.growth_campaign_metrics enable row level security;
alter table public.growth_referrals enable row level security;
alter table public.growth_reports enable row level security;
alter table public.growth_lead_audit_logs enable row level security;

drop policy if exists "growth leads admin read" on public.growth_leads;
create policy "growth leads admin read" on public.growth_leads for select using (public.is_admin());

drop policy if exists "growth leads public insert" on public.growth_leads;
create policy "growth leads public insert" on public.growth_leads for insert with check (true);

drop policy if exists "growth leads admin update" on public.growth_leads;
create policy "growth leads admin update" on public.growth_leads for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth leads admin delete" on public.growth_leads;
create policy "growth leads admin delete" on public.growth_leads for delete using (public.is_admin());

drop policy if exists "growth parent demand admin only" on public.growth_parent_demand_clusters;
create policy "growth parent demand admin only" on public.growth_parent_demand_clusters for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth conversion events admin only" on public.growth_conversion_events;
create policy "growth conversion events admin only" on public.growth_conversion_events for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth communications admin only" on public.growth_lead_communications;
create policy "growth communications admin only" on public.growth_lead_communications for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth follow up admin only" on public.growth_follow_up_tasks;
create policy "growth follow up admin only" on public.growth_follow_up_tasks for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth campaign metrics admin only" on public.growth_campaign_metrics;
create policy "growth campaign metrics admin only" on public.growth_campaign_metrics for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth referrals admin only" on public.growth_referrals;
create policy "growth referrals admin only" on public.growth_referrals for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth reports admin only" on public.growth_reports;
create policy "growth reports admin only" on public.growth_reports for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "growth audit admin read" on public.growth_lead_audit_logs;
create policy "growth audit admin read" on public.growth_lead_audit_logs for select using (public.is_admin());

drop policy if exists "growth audit admin insert" on public.growth_lead_audit_logs;
create policy "growth audit admin insert" on public.growth_lead_audit_logs for insert with check (public.is_admin());

insert into public.growth_leads (
  source_lead_id,
  lead_source,
  status,
  funnel_stage,
  interest_score,
  garden_name,
  parent_name,
  contact_name,
  manager_name,
  phone,
  email,
  city,
  address,
  campaign,
  utm_source,
  utm_medium,
  utm_campaign,
  follow_up_at,
  qualification,
  metadata,
  created_at,
  updated_at
)
select
  l.id,
  case
    when l.source = 'demo_booking' then 'demo_booking'
    when l.source = 'parent_request' then 'parent_request'
    when coalesce(l.source, '') ilike '%referral%' then 'referral'
    when l.lead_type = 'garden' then 'kindergarten_registration'
    else 'campaign'
  end,
  case
    when l.status in ('new','contacted','approved','converted','rejected') then l.status
    when l.status in ('active') then 'converted'
    when l.status in ('not_relevant','archived') then 'rejected'
    when l.status in ('lead_review','lead_approved','registration_pending','credentials_sent','onboarding_in_progress','onboarding_submitted','pending_final_approval') then 'qualified'
    else 'new'
  end,
  case
    when l.source = 'demo_booking' then 'demo'
    when l.source = 'parent_request' then 'lead'
    when l.status in ('approved','lead_approved') then 'approval'
    when l.status in ('converted','active') then 'conversion'
    else 'lead'
  end,
  greatest(0, least(100, coalesce(l.lead_score, 0))),
  l.garden_name,
  l.parent_name,
  coalesce(l.manager_name, l.owner_name, l.parent_name),
  l.manager_name,
  l.phone,
  l.email,
  l.city,
  l.address,
  l.campaign,
  l.utm_source,
  l.utm_medium,
  l.utm_campaign,
  l.follow_up_at,
  coalesce(l.qualification, '{}'::jsonb),
  jsonb_build_object('legacy_status', l.status, 'legacy_source', l.source, 'lead_type', l.lead_type, 'conversion_goal', l.conversion_goal),
  l.created_at,
  now()
from public.leads l
where l.lead_type = 'garden'
on conflict (source_lead_id)
do update set
  lead_source = excluded.lead_source,
  status = excluded.status,
  funnel_stage = excluded.funnel_stage,
  interest_score = excluded.interest_score,
  garden_name = excluded.garden_name,
  parent_name = excluded.parent_name,
  contact_name = excluded.contact_name,
  manager_name = excluded.manager_name,
  phone = excluded.phone,
  email = excluded.email,
  city = excluded.city,
  address = excluded.address,
  campaign = excluded.campaign,
  utm_source = excluded.utm_source,
  utm_medium = excluded.utm_medium,
  utm_campaign = excluded.utm_campaign,
  follow_up_at = excluded.follow_up_at,
  qualification = excluded.qualification,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.growth_conversion_events (growth_lead_id, source_lead_id, event_type, to_stage, metadata, created_at)
select gl.id, gl.source_lead_id, 'lead_created', gl.funnel_stage, jsonb_build_object('source', gl.lead_source), gl.created_at
from public.growth_leads gl
where not exists (
  select 1
  from public.growth_conversion_events gce
  where gce.growth_lead_id = gl.id
    and gce.event_type = 'lead_created'
);

insert into public.growth_parent_demand_clusters (
  garden_name,
  garden_name_key,
  city,
  city_key,
  address,
  address_key,
  request_count,
  parent_contacts,
  manager_contacts,
  high_demand,
  first_requested_at,
  last_requested_at,
  recommended_next_action,
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
  count(*) filter (where phone is not null or email is not null)::integer,
  count(*) filter (where manager_name is not null or qualification ? 'manager_phone')::integer,
  count(*) >= 3,
  min(created_at),
  max(created_at),
  case when count(*) >= 3 then 'contact_kindergarten' else 'contact_parent' end,
  jsonb_build_object('source', 'parent_request_rollup')
from public.growth_leads
where lead_source = 'parent_request'
group by coalesce(nullif(trim(garden_name), ''), 'גן ללא שם'), nullif(trim(city), ''), nullif(trim(address), '')
on conflict (garden_name_key, city_key, address_key)
do update set
  request_count = excluded.request_count,
  parent_contacts = excluded.parent_contacts,
  manager_contacts = excluded.manager_contacts,
  high_demand = excluded.high_demand,
  first_requested_at = excluded.first_requested_at,
  last_requested_at = excluded.last_requested_at,
  recommended_next_action = excluded.recommended_next_action,
  updated_at = now();

insert into public.growth_campaign_metrics (
  campaign_key,
  campaign_name,
  source,
  visits,
  leads,
  demos,
  qualified,
  conversions,
  report_date,
  metadata
)
select
  coalesce(nullif(campaign, ''), lead_source || '_organic'),
  coalesce(nullif(campaign, ''), lead_source || ' organic'),
  lead_source,
  0,
  count(*)::integer,
  count(*) filter (where lead_source = 'demo_booking')::integer,
  count(*) filter (where status in ('qualified','approved','converted'))::integer,
  count(*) filter (where status = 'converted')::integer,
  current_date,
  jsonb_build_object('rollup', 'phase_143')
from public.growth_leads
group by
  coalesce(nullif(campaign, ''), lead_source || '_organic'),
  coalesce(nullif(campaign, ''), lead_source || ' organic'),
  lead_source
on conflict (campaign_key, report_date)
do update set
  leads = excluded.leads,
  demos = excluded.demos,
  qualified = excluded.qualified,
  conversions = excluded.conversions,
  updated_at = now();

insert into public.growth_follow_up_tasks (growth_lead_id, task_type, status, priority, due_at, title, notes, metadata)
select
  gl.id,
  case
    when gl.lead_source = 'parent_request' then 'parent_demand_follow_up'
    when gl.lead_source = 'demo_booking' then 'missed_demo'
    else 'campaign_follow_up'
  end,
  'open',
  case when gl.high_demand or gl.interest_score >= 75 then 'high' else 'medium' end,
  now() + interval '2 days',
  case
    when gl.lead_source = 'parent_request' then 'יצירת קשר בעקבות ביקוש הורים'
    when gl.lead_source = 'demo_booking' then 'מעקב אחרי בקשת הדגמה'
    else 'מעקב ליד צמיחה'
  end,
  'נוצר אוטומטית כחלק ממנוע הצמיחה.',
  jsonb_build_object('automation', 'phase_143_follow_up')
from public.growth_leads gl
where gl.status in ('new','contacted','qualified')
  and not exists (
    select 1
    from public.growth_follow_up_tasks gft
    where gft.growth_lead_id = gl.id
      and gft.status in ('open','in_progress','overdue')
  );

comment on table public.growth_leads is 'Unified growth lead system for demo bookings, kindergarten registrations, parent requests, referrals and campaigns.';
comment on table public.growth_parent_demand_clusters is 'Parent pressure engine: groups parent-origin requests by kindergarten and city.';
comment on table public.growth_conversion_events is 'Growth funnel audit trail from visit to lead, demo, qualification, approval and activation.';
comment on table public.growth_lead_communications is 'Lead outreach readiness across WhatsApp, SMS, email, phone and in-app channels.';
comment on table public.growth_follow_up_tasks is 'Automated follow-up readiness for missed demos, incomplete registrations, pending activations and payments.';
comment on table public.growth_campaign_metrics is 'Campaign and source performance metrics for acquisition reporting.';
comment on table public.growth_referrals is 'Referral program readiness for kindergarten, parent and partner referrals.';
comment on table public.growth_reports is 'Growth reporting snapshots for leads, conversions, cities and parent demand.';
comment on table public.growth_lead_audit_logs is 'Immutable audit trail for lead lifecycle changes.';

notify pgrst, 'reload schema';
