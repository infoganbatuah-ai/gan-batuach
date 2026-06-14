create table if not exists public.digital_observer_leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null default 'digital_observer_lead',
  source text not null default 'digital_observer_demo',
  status text not null default 'new',
  contact_name text,
  contact_email text,
  contact_phone text,
  company_name text,
  site_type text not null default 'custom',
  city text,
  estimated_cameras integer not null default 0,
  package_interest text,
  owner text,
  follow_up_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.digital_observer_leads
  add column if not exists product_type text not null default 'digital_observer',
  add column if not exists business_name text,
  add column if not exists camera_count integer not null default 0,
  add column if not exists lead_status text not null default 'new',
  add column if not exists interest_score integer not null default 0,
  add column if not exists preferred_contact_method text,
  add column if not exists current_camera_system text,
  add column if not exists conversion_status text not null default 'new',
  add column if not exists converted_observer_site_id uuid references public.observer_sites(id) on delete set null,
  add column if not exists converted_onboarding_draft_id uuid references public.observer_site_onboarding_drafts(id) on delete set null,
  add column if not exists desired_package_id uuid references public.observer_monitoring_packages(id) on delete set null,
  add column if not exists assigned_owner text,
  add column if not exists form_route text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term text,
  add column if not exists utm_content text;

update public.digital_observer_leads
set
  product_type = 'digital_observer',
  business_name = coalesce(business_name, company_name),
  camera_count = greatest(coalesce(camera_count, 0), coalesce(estimated_cameras, 0)),
  lead_status = coalesce(nullif(lead_status, ''), status),
  interest_score = greatest(coalesce(interest_score, 0), case when package_interest is not null then 65 else 35 end)
where product_type is distinct from 'digital_observer'
  or business_name is null
  or camera_count = 0
  or lead_status is null
  or interest_score = 0;

alter table public.digital_observer_leads
  drop constraint if exists digital_observer_leads_lead_type_check,
  drop constraint if exists digital_observer_leads_source_check,
  drop constraint if exists digital_observer_leads_status_check,
  drop constraint if exists digital_observer_leads_site_type_check,
  drop constraint if exists digital_observer_leads_product_type_check,
  drop constraint if exists digital_observer_leads_lead_status_check,
  drop constraint if exists digital_observer_leads_conversion_status_check,
  drop constraint if exists digital_observer_leads_preferred_contact_method_check,
  drop constraint if exists digital_observer_leads_interest_score_check;

alter table public.digital_observer_leads
  add constraint digital_observer_leads_lead_type_check check (lead_type = 'digital_observer_lead'),
  add constraint digital_observer_leads_product_type_check check (product_type = 'digital_observer'),
  add constraint digital_observer_leads_source_check check (source in (
    'digital_observer_home',
    'digital_observer_business',
    'digital_observer_office',
    'digital_observer_warehouse',
    'digital_observer_store',
    'digital_observer_parking',
    'digital_observer_demo',
    'digital_observer_pricing',
    'digital_observer_start',
    'referral',
    'campaign',
    'home',
    'business',
    'office',
    'warehouse',
    'store',
    'parking',
    'custom'
  )),
  add constraint digital_observer_leads_status_check check (status in ('new','contacted','demo_scheduled','qualified','proposal_sent','onboarding','converted','lost','deferred','rejected')),
  add constraint digital_observer_leads_site_type_check check (site_type in ('home','office','business','warehouse','store','parking_lot','parking','custom')),
  add constraint digital_observer_leads_lead_status_check check (lead_status in ('new','contacted','demo_scheduled','qualified','proposal_sent','onboarding','converted','lost','deferred','rejected')),
  add constraint digital_observer_leads_conversion_status_check check (conversion_status in ('new','contact_lead','qualified','rejected','converted_to_observer_site','onboarding_link_sent','trial_started','lost','deferred')),
  add constraint digital_observer_leads_preferred_contact_method_check check (preferred_contact_method is null or preferred_contact_method in ('phone','email','whatsapp','sms','any')),
  add constraint digital_observer_leads_interest_score_check check (interest_score between 0 and 100);

create table if not exists public.digital_observer_marketing_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'homepage_cta_click',
    'pricing_cta_click',
    'demo_form_started',
    'demo_form_submitted',
    'start_monitoring_clicked',
    'package_selected',
    'onboarding_started'
  )),
  source text,
  site_type text,
  package_interest text,
  lead_id uuid references public.digital_observer_leads(id) on delete set null,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  route text,
  utm jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.digital_observer_followup_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  channel text not null check (channel in ('in_app','email','sms','whatsapp','push')),
  title text not null,
  subject text,
  body text not null,
  provider_mode text not null default 'mock' check (provider_mode in ('mock','test','production_ready','active')),
  status text not null default 'draft' check (status in ('draft','ready_for_review','approved','disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_demo_content (
  id uuid primary key default gen_random_uuid(),
  demo_key text not null unique,
  site_type text not null,
  title text not null,
  scenario text not null,
  camera_health jsonb not null default '{}'::jsonb,
  observer_alerts jsonb not null default '[]'::jsonb,
  monitoring_schedule jsonb not null default '{}'::jsonb,
  uses_real_people boolean not null default false,
  uses_real_credentials boolean not null default false,
  status text not null default 'ready' check (status in ('ready','ready_for_review','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_lead_conversion_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  step_name text not null,
  target_record text not null,
  status text not null default 'ready_for_review' check (status in ('ready','ready_for_review','partial','blocked','future_only')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.digital_observer_leads enable row level security;
alter table public.digital_observer_marketing_events enable row level security;
alter table public.digital_observer_followup_templates enable row level security;
alter table public.digital_observer_demo_content enable row level security;
alter table public.digital_observer_lead_conversion_readiness enable row level security;

drop policy if exists "digital observer leads admin manage" on public.digital_observer_leads;
create policy "digital observer leads admin manage" on public.digital_observer_leads
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "digital observer marketing events admin manage" on public.digital_observer_marketing_events;
create policy "digital observer marketing events admin manage" on public.digital_observer_marketing_events
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "digital observer followup templates admin manage" on public.digital_observer_followup_templates;
create policy "digital observer followup templates admin manage" on public.digital_observer_followup_templates
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "digital observer demo content admin manage" on public.digital_observer_demo_content;
create policy "digital observer demo content admin manage" on public.digital_observer_demo_content
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "digital observer lead conversion readiness admin manage" on public.digital_observer_lead_conversion_readiness;
create policy "digital observer lead conversion readiness admin manage" on public.digital_observer_lead_conversion_readiness
for all using (public.is_admin()) with check (public.is_admin());

create index if not exists idx_digital_observer_leads_product_status on public.digital_observer_leads(product_type, lead_status, created_at desc);
create index if not exists idx_digital_observer_leads_source_site_type on public.digital_observer_leads(source, site_type);
create index if not exists idx_digital_observer_leads_interest_score on public.digital_observer_leads(interest_score desc, created_at desc);
create index if not exists idx_digital_observer_leads_utm on public.digital_observer_leads(utm_source, utm_campaign);
create index if not exists idx_digital_observer_marketing_events_type_time on public.digital_observer_marketing_events(event_type, occurred_at desc);
create index if not exists idx_digital_observer_marketing_events_source on public.digital_observer_marketing_events(source, site_type, package_interest);
create index if not exists idx_digital_observer_followup_templates_status on public.digital_observer_followup_templates(channel, status);
create index if not exists idx_digital_observer_demo_content_type on public.digital_observer_demo_content(site_type, status);
create index if not exists idx_digital_observer_conversion_readiness_status on public.digital_observer_lead_conversion_readiness(status, target_record);

insert into public.digital_observer_followup_templates (template_key, channel, title, subject, body, provider_mode, status, metadata)
values
  ('demo_request_received', 'email', 'Demo request received', 'Digital Observer demo request received', 'Thanks for requesting a Digital Observer demo. We will review your site type, cameras and monitoring goals before scheduling the next step.', 'mock', 'ready_for_review', '{"safe_send_only":true}'::jsonb),
  ('follow_up_reminder', 'whatsapp', 'Follow-up reminder', null, 'Hi, this is a reminder to complete the short Digital Observer setup call. No production monitoring is activated until you approve the setup.', 'mock', 'ready_for_review', '{"template_required":true}'::jsonb),
  ('onboarding_link', 'email', 'Onboarding link', 'Continue Digital Observer setup', 'Use this link to continue the Digital Observer standalone onboarding flow. This does not create Gan Batuach kindergarten records.', 'mock', 'ready_for_review', '{"requires_qualified_lead":true}'::jsonb),
  ('trial_started', 'email', 'Trial started', 'Digital Observer trial started', 'Your trial starts in test mode. Configure cameras, schedules, recipients and privacy settings before production activation.', 'mock', 'ready_for_review', '{"test_mode_first":true}'::jsonb),
  ('camera_setup_reminder', 'sms', 'Camera setup reminder', null, 'Digital Observer camera setup is still pending. Please finish the gateway/camera step before monitoring can start.', 'mock', 'ready_for_review', '{"rate_limit_required":true}'::jsonb),
  ('package_suggestion', 'email', 'Package suggestion', 'Suggested Digital Observer package', 'Based on your site type and camera count, we prepared a package suggestion. Final pricing remains provider/admin configured.', 'mock', 'ready_for_review', '{"pricing_not_final":true}'::jsonb)
on conflict (template_key) do update set
  channel = excluded.channel,
  title = excluded.title,
  subject = excluded.subject,
  body = excluded.body,
  provider_mode = excluded.provider_mode,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_demo_content (demo_key, site_type, title, scenario, camera_health, observer_alerts, monitoring_schedule, uses_real_people, uses_real_credentials, status)
values
  ('home-demo', 'home', 'Home demo site', 'Synthetic home monitoring demo with camera health and night monitoring examples.', '{"online":2,"offline":0,"degraded":0}'::jsonb, '[{"type":"motion_after_hours","status":"review_ready"}]'::jsonb, '{"mode":"night_only"}'::jsonb, false, false, 'ready'),
  ('business-demo', 'business', 'Business demo site', 'Synthetic business monitoring demo with restricted area and after-hours alerts.', '{"online":6,"offline":1,"degraded":0}'::jsonb, '[{"type":"restricted_area","status":"review_ready"},{"type":"camera_offline","status":"open"}]'::jsonb, '{"mode":"business_hours"}'::jsonb, false, false, 'ready'),
  ('warehouse-demo', 'warehouse', 'Warehouse demo site', 'Synthetic warehouse monitoring demo with zones, obstruction and unusual motion examples.', '{"online":12,"offline":0,"degraded":1}'::jsonb, '[{"type":"obstruction","status":"open"},{"type":"unusual_motion","status":"review_ready"}]'::jsonb, '{"mode":"custom_schedule"}'::jsonb, false, false, 'ready')
on conflict (demo_key) do update set
  site_type = excluded.site_type,
  title = excluded.title,
  scenario = excluded.scenario,
  camera_health = excluded.camera_health,
  observer_alerts = excluded.observer_alerts,
  monitoring_schedule = excluded.monitoring_schedule,
  uses_real_people = false,
  uses_real_credentials = false,
  status = excluded.status,
  updated_at = now();

insert into public.digital_observer_lead_conversion_readiness (readiness_key, step_name, target_record, status, notes, metadata)
values
  ('lead-to-observer-site', 'Convert lead to observer site', 'observer_sites', 'ready_for_review', 'Admin conversion must create observer_site, not garden/kindergarten records.', '{"product_type":"digital_observer"}'::jsonb),
  ('lead-to-site-owner', 'Create or link site owner', 'observer_site_members', 'ready_for_review', 'Site owner role remains separate from parent/staff/inspector roles.', '{"role":"observer_site_owner"}'::jsonb),
  ('lead-to-onboarding', 'Create onboarding draft', 'observer_site_onboarding_drafts', 'ready_for_review', 'Public start flow can hand off to onboarding readiness when account flow is enabled.', '{"route":"/digital-observer/onboarding"}'::jsonb),
  ('lead-to-package', 'Attach package interest', 'observer_monitoring_packages', 'ready', 'Package selection remains standalone and does not touch Gan Batuach subscriptions.', '{"billing_stream":"digital_observer"}'::jsonb),
  ('lead-to-trial', 'Prepare trial or subscription', 'observer_site_subscriptions', 'ready_for_review', 'No live charge until payment provider mode is explicitly configured.', '{"safe_mode":"trial_first"}'::jsonb)
on conflict (readiness_key) do update set
  step_name = excluded.step_name,
  target_record = excluded.target_record,
  status = excluded.status,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_analytics_events (event_key, event_type, source, site_type, package_key, count_value, status, metadata)
values
  ('phase-178-homepage-cta-readiness', 'package_interest', 'digital_observer_home', 'home', 'home_basic', 0, 'tracking', '{"route":"/digital-observer","phase":178}'::jsonb),
  ('phase-178-demo-flow-readiness', 'demo_request', 'digital_observer_demo', 'business', null, 0, 'tracking', '{"route":"/digital-observer/request-demo","phase":178}'::jsonb),
  ('phase-178-start-flow-readiness', 'onboarding_started', 'digital_observer_start', 'custom', null, 0, 'tracking', '{"route":"/digital-observer/start","phase":178}'::jsonb)
on conflict (event_key) do update set
  source = excluded.source,
  site_type = excluded.site_type,
  package_key = excluded.package_key,
  status = excluded.status,
  metadata = excluded.metadata;

comment on table public.digital_observer_marketing_events is 'Standalone Digital Observer CTA, demo, pricing and start flow analytics without external analytics provider.';
comment on table public.digital_observer_followup_templates is 'Provider-ready follow-up templates for Digital Observer leads. Real sending remains provider-mode gated.';
comment on table public.digital_observer_demo_content is 'Synthetic Digital Observer demo content. Must not contain real people, camera credentials or private data.';
comment on table public.digital_observer_lead_conversion_readiness is 'Readiness checklist for converting Digital Observer leads into observer sites, owners, onboarding records and package/trial setup.';
