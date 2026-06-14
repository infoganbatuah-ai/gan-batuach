-- PHASE 176: Digital Observer dedicated domain and standalone product launch preparation.
-- Keeps Digital Observer inside the current Gan Batuach project. No new repo, Supabase project or Vercel project.

alter table public.digital_observer_product_readiness
  drop constraint if exists digital_observer_readiness_area_check;

alter table public.digital_observer_product_readiness
  add constraint digital_observer_readiness_area_check check (area in (
    'public_entry',
    'app_shell',
    'onboarding',
    'domain_routing',
    'vercel_setup',
    'product_switcher',
    'product_separation',
    'branding',
    'shared_core',
    'site_model',
    'site_dashboard',
    'roles',
    'capability_matrix',
    'packages',
    'camera_setup',
    'monitoring_goals',
    'admin_visibility',
    'navigation',
    'seo',
    'analytics',
    'lead_flow',
    'future_extraction'
  ));

create table if not exists public.digital_observer_use_case_pages (
  id uuid primary key default gen_random_uuid(),
  use_case_key text not null unique,
  route text not null unique,
  title text not null,
  target_audience text not null,
  problem text not null,
  solution text not null,
  camera_setup text not null,
  alert_model text not null,
  monitoring_benefits jsonb not null default '[]'::jsonb,
  package_suggestion text,
  seo_title text,
  seo_description text,
  status text not null default 'ready' check (status in ('draft', 'ready', 'ready_for_review', 'future_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_launch_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  area text not null,
  title text not null,
  status text not null default 'planned' check (status in ('planned', 'ready', 'ready_for_review', 'blocked', 'future_only')),
  current_route text,
  future_domain_support boolean not null default false,
  gan_batuach_impact text not null default 'none',
  restricted_capability_default text not null default 'not_enabled',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null default 'digital_observer_lead' check (lead_type = 'digital_observer_lead'),
  source text not null check (source in ('home', 'business', 'office', 'warehouse', 'store', 'custom')),
  status text not null default 'new' check (status in ('new', 'contacted', 'demo_scheduled', 'qualified', 'proposal_sent', 'onboarding', 'lost', 'deferred')),
  contact_name text,
  contact_email text,
  contact_phone text,
  company_name text,
  site_type text not null check (site_type in ('home', 'office', 'business', 'warehouse', 'store', 'parking_lot', 'custom')),
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

create table if not exists public.digital_observer_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type in ('visitor_source', 'demo_request', 'package_interest', 'onboarding_started', 'cameras_added', 'first_alert_created', 'active_observer_site', 'churn_risk')),
  source text,
  site_type text,
  package_key text,
  observer_site_id uuid references public.observer_sites(id) on delete set null,
  count_value integer not null default 0,
  status text not null default 'tracking' check (status in ('tracking', 'healthy', 'needs_attention', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.digital_observer_site_model_checks (
  id uuid primary key default gen_random_uuid(),
  check_key text not null unique,
  checked_table text not null,
  requirement text not null,
  status text not null default 'ready_for_review' check (status in ('ready', 'ready_for_review', 'partial', 'blocked', 'future_only')),
  should_require_garden_id boolean not null default false,
  should_require_child_id boolean not null default false,
  should_require_parent_id boolean not null default false,
  expected_scope_key text not null default 'observer_site_id',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_admin_product_overview (
  id uuid primary key default gen_random_uuid(),
  overview_key text not null unique,
  product_type text not null check (product_type in ('gan_batuach', 'digital_observer', 'shared_core')),
  area text not null,
  source_table text not null,
  visibility_notes text,
  status text not null default 'ready' check (status in ('ready', 'ready_for_review', 'partial', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.digital_observer_use_case_pages enable row level security;
alter table public.digital_observer_launch_readiness enable row level security;
alter table public.digital_observer_leads enable row level security;
alter table public.digital_observer_analytics_events enable row level security;
alter table public.digital_observer_site_model_checks enable row level security;
alter table public.digital_observer_admin_product_overview enable row level security;

drop policy if exists "digital observer use cases admin manage" on public.digital_observer_use_case_pages;
create policy "digital observer use cases admin manage" on public.digital_observer_use_case_pages
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "digital observer launch readiness admin manage" on public.digital_observer_launch_readiness;
create policy "digital observer launch readiness admin manage" on public.digital_observer_launch_readiness
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "digital observer leads admin manage" on public.digital_observer_leads;
create policy "digital observer leads admin manage" on public.digital_observer_leads
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "digital observer analytics admin manage" on public.digital_observer_analytics_events;
create policy "digital observer analytics admin manage" on public.digital_observer_analytics_events
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "digital observer site model checks admin manage" on public.digital_observer_site_model_checks;
create policy "digital observer site model checks admin manage" on public.digital_observer_site_model_checks
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "digital observer admin overview admin manage" on public.digital_observer_admin_product_overview;
create policy "digital observer admin overview admin manage" on public.digital_observer_admin_product_overview
for all using (public.is_admin())
with check (public.is_admin());

create index if not exists idx_digital_observer_use_cases_status on public.digital_observer_use_case_pages(status);
create index if not exists idx_digital_observer_launch_readiness_area on public.digital_observer_launch_readiness(area, status);
create index if not exists idx_digital_observer_leads_status_source on public.digital_observer_leads(status, source);
create index if not exists idx_digital_observer_analytics_event_type on public.digital_observer_analytics_events(event_type, occurred_at desc);
create index if not exists idx_digital_observer_site_model_checks_table on public.digital_observer_site_model_checks(checked_table, status);
create index if not exists idx_digital_observer_admin_product_overview_product on public.digital_observer_admin_product_overview(product_type, area);

insert into public.digital_observer_use_case_pages (
  use_case_key, route, title, target_audience, problem, solution, camera_setup, alert_model, monitoring_benefits, package_suggestion, seo_title, seo_description, status
) values
  ('home', '/digital-observer/home', 'Home Monitoring', 'Home owners', 'Home owners need visibility when away without exposing camera credentials or creating noisy alerts.', 'Connect home cameras through a gateway, monitor selected goals and keep alerts controlled by privacy settings.', 'Home camera, generic IP camera, RTSP or ONVIF readiness.', 'Camera offline, motion after hours, restricted area and obstruction.', '["Always-on visibility","Simple test mode","Privacy-first controls","Human-reviewed observer events"]'::jsonb, 'Home Basic or Home Plus', 'Digital Observer for Homes', 'AI camera monitoring readiness for private homes.', 'ready'),
  ('business', '/digital-observer/business', 'Business Monitoring', 'Business owners', 'Small businesses need camera health, after-hours awareness and operational alerts without building a security platform.', 'Reuse camera gateway and observer signals to monitor business goals, site health and recent events.', 'Business DVR/NVR, RTSP, ONVIF, Hikvision, Dahua or generic camera readiness.', 'Motion after hours, person detected, restricted area, obstruction and camera offline.', '["Multi-camera readiness","Package-based limits","Operations-friendly alerts","No direct RTSP exposure"]'::jsonb, 'Business Basic or Business Pro', 'Digital Observer for Businesses', 'AI camera monitoring readiness for businesses and organizations.', 'ready'),
  ('warehouse', '/digital-observer/warehouse', 'Warehouse Monitoring', 'Warehouse operators', 'Warehouses need coverage across larger zones, restricted areas and activity patterns.', 'Define zones, monitoring goals and schedules while keeping camera credentials server-side.', 'DVR/NVR, RTSP and ONVIF readiness with zone mapping.', 'Restricted area, crowding, no motion too long, unusual motion and obstruction.', '["Zone-based monitoring","Operational visibility","After-hours awareness","Scalable camera limits"]'::jsonb, 'Business Pro or Enterprise Monitoring', 'Digital Observer for Warehouses', 'AI camera monitoring readiness for warehouses and industrial spaces.', 'ready'),
  ('office', '/digital-observer/office', 'Office Monitoring', 'Office managers', 'Offices need after-hours visibility, access-area awareness and camera health without overcomplicating setup.', 'Configure office monitoring goals, alert channels and business-hours rules in test mode first.', 'Office IP cameras, generic camera, RTSP or ONVIF readiness.', 'Motion after hours, restricted area, camera offline and obstruction.', '["Business-hours rules","Simple alerts","Privacy settings","Package readiness"]'::jsonb, 'Business Basic', 'Digital Observer for Offices', 'AI camera monitoring readiness for offices.', 'ready'),
  ('store', '/digital-observer/store', 'Store Monitoring', 'Store owners', 'Stores need camera availability, after-hours activity and quick visibility across customer and staff areas.', 'Connect existing cameras and select monitoring goals that fit retail operations.', 'Store DVR/NVR, IP camera, RTSP or ONVIF readiness.', 'Camera offline, obstruction, motion after hours, crowding and restricted area.', '["Retail visibility","Camera health tracking","Alert readiness","Human-reviewed signals"]'::jsonb, 'Business Basic or Business Pro', 'Digital Observer for Stores', 'AI camera monitoring readiness for stores and retail spaces.', 'ready')
on conflict (use_case_key) do update set
  route = excluded.route,
  title = excluded.title,
  problem = excluded.problem,
  solution = excluded.solution,
  status = excluded.status,
  updated_at = now();

insert into public.digital_observer_launch_readiness (
  readiness_key, area, title, status, current_route, future_domain_support, gan_batuach_impact, restricted_capability_default, notes, metadata
) values
  ('product-home-standalone', 'public_entry', 'Digital Observer public home feels standalone', 'ready', '/digital-observer', true, 'none', 'not_enabled', 'Public copy avoids kindergarten-first language and unsupported claims.', '{"cta":["Start monitoring","Request demo","Connect cameras"]}'::jsonb),
  ('app-shell-standalone', 'app_shell', 'Digital Observer app shell without kindergarten language', 'ready', '/digital-observer/dashboard', true, 'none', 'not_enabled', 'Dashboard surfaces sites, cameras, alerts, health, packages and setup actions.', '{}'::jsonb),
  ('onboarding-standalone', 'onboarding', 'Standalone observer onboarding flow', 'ready', '/digital-observer/onboarding', true, 'none', 'not_enabled', 'Flow covers site type, details, package, cameras, goals, alerts, privacy and test mode.', '{}'::jsonb),
  ('domain-routing-env-ready', 'domain_routing', 'Optional host-based routing by environment variable', 'ready_for_review', '/digital-observer', true, 'none', 'not_enabled', 'Proxy can route configured observer hosts without requiring DNS changes now.', '{"env":["DIGITAL_OBSERVER_PUBLIC_HOST","DIGITAL_OBSERVER_APP_HOST","GAN_BATUACH_PUBLIC_HOST"]}'::jsonb),
  ('vercel-domain-docs', 'vercel_setup', 'Vercel custom domain setup documented', 'ready', null, true, 'none', 'not_enabled', 'Manual Vercel and DNS steps are documented with rollback plan.', '{}'::jsonb),
  ('product-switcher-ready', 'product_switcher', 'Product switcher readiness', 'ready', '/digital-observer', true, 'none', 'not_enabled', 'Admin/dev users can distinguish Gan Batuach from Digital Observer.', '{}'::jsonb),
  ('site-dashboard-ready', 'site_dashboard', 'Standalone observer site route readiness', 'ready', '/digital-observer/sites/[id]', true, 'none', 'not_enabled', 'Site dashboard uses observer_site_id and excludes parent/child/staff language.', '{}'::jsonb),
  ('lead-flow-ready', 'lead_flow', 'Digital Observer lead flow readiness', 'ready_for_review', '/digital-observer', true, 'none', 'not_enabled', 'Lead model supports home, business, office, warehouse, store and custom sources.', '{}'::jsonb),
  ('analytics-ready', 'analytics', 'Digital Observer analytics readiness', 'ready_for_review', '/digital-observer', true, 'none', 'not_enabled', 'Analytics model tracks source, demo requests, package interest, onboarding and first alert readiness.', '{}'::jsonb)
on conflict (readiness_key) do update set
  status = excluded.status,
  current_route = excluded.current_route,
  future_domain_support = excluded.future_domain_support,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_site_model_checks (
  check_key, checked_table, requirement, status, should_require_garden_id, should_require_child_id, should_require_parent_id, expected_scope_key, notes
) values
  ('site-model-observer-sites', 'observer_sites', 'Standalone sites must support observer_site_id without requiring kindergarten-specific fields.', 'ready_for_review', false, false, false, 'id', 'Gan Batuach may still use site_type=kindergarten, but standalone sites use home/business/office/warehouse/store/parking_lot/custom.'),
  ('site-model-observer-subscriptions', 'observer_site_subscriptions', 'Standalone subscriptions remain separate from Gan Batuach billing.', 'ready_for_review', false, false, false, 'observer_site_id', 'No real billing activation in this phase.'),
  ('site-model-usage-tracking', 'observer_site_usage_snapshots', 'Usage tracking should be scoped to observer_site_id and product type.', 'ready_for_review', false, false, false, 'observer_site_id', 'Tracks active cameras, playback, AI events and usage.'),
  ('site-model-camera-streams', 'camera_streams', 'Digital Observer cameras should scope to observer_site_id and avoid client credential exposure.', 'ready_for_review', false, false, false, 'observer_site_id', 'RTSP and credentials stay server-side.'),
  ('site-model-camera-zones', 'camera_zones', 'Standalone zones should work without child or classroom assumptions.', 'ready_for_review', false, false, false, 'observer_site_id', 'Use generic zones such as entrance, office, warehouse, restricted area.'),
  ('site-model-observer-signals', 'observer_intelligence_signals', 'Signals should stay review-required and scoped to observer_site_id.', 'ready_for_review', false, false, false, 'observer_site_id', 'No raw parent visibility in Gan Batuach; standalone visibility is policy-gated.')
on conflict (check_key) do update set
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.digital_observer_admin_product_overview (
  overview_key, product_type, area, source_table, visibility_notes, status
) values
  ('admin-gan-gardens', 'gan_batuach', 'gardens', 'gardens', 'Gan Batuach gardens remain kindergarten vertical data.', 'ready'),
  ('admin-do-sites', 'digital_observer', 'observer sites', 'observer_sites', 'Standalone Digital Observer sites are clearly product-typed.', 'ready'),
  ('admin-do-subscriptions', 'digital_observer', 'subscriptions', 'observer_site_subscriptions', 'Separate from Gan Batuach kindergarten subscription billing.', 'ready'),
  ('admin-do-usage', 'digital_observer', 'usage', 'observer_site_usage_snapshots', 'Tracks cameras, alerts and playback by observer site.', 'ready'),
  ('admin-shared-camera-health', 'shared_core', 'camera health', 'camera_streams', 'Shared camera infrastructure; scope by garden_id or observer_site_id.', 'ready'),
  ('admin-shared-observer-health', 'shared_core', 'observer health', 'observer_intelligence_signals', 'Human-reviewed signals only, policy-gated by vertical.', 'ready'),
  ('admin-do-leads', 'digital_observer', 'lead flow', 'digital_observer_leads', 'Digital Observer lead flow remains separate from kindergarten lead conversion.', 'ready_for_review')
on conflict (overview_key) do update set
  visibility_notes = excluded.visibility_notes,
  status = excluded.status,
  updated_at = now();

insert into public.digital_observer_analytics_events (
  event_key, event_type, source, site_type, package_key, count_value, status, metadata
) values
  ('analytics-visitor-source-baseline', 'visitor_source', 'organic', null, null, 0, 'tracking', '{"route":"/digital-observer"}'::jsonb),
  ('analytics-demo-request-baseline', 'demo_request', 'landing_page', null, null, 0, 'tracking', '{"route":"/book-demo?product=digital_observer"}'::jsonb),
  ('analytics-package-interest-baseline', 'package_interest', 'packages_section', 'business', 'business_pro', 0, 'tracking', '{"billing":"not_active"}'::jsonb),
  ('analytics-onboarding-started-baseline', 'onboarding_started', 'digital_observer', null, null, 0, 'tracking', '{"route":"/digital-observer/onboarding"}'::jsonb),
  ('analytics-first-alert-baseline', 'first_alert_created', 'observer_core', null, null, 0, 'tracking', '{"requires_site_and_camera":true}'::jsonb)
on conflict (event_key) do update set
  status = excluded.status,
  metadata = excluded.metadata;

update public.digital_observer_domain_routes
set routing_mode = 'middleware_ready',
    safety_notes = 'Optional host-based routing is ready through environment variables. DNS and Vercel custom domains remain manual.',
    updated_at = now()
where future_domain in ('observer.gan-batuach.co.il', 'app.digitalobserver.ai', 'digital-observer.co.il');

insert into public.digital_observer_domain_routes (route_key, current_route, future_domain, routing_mode, vercel_setup_status, dns_status, safety_notes, metadata)
values
  ('digital-observer-app-co-il','/digital-observer','app.digital-observer.co.il','middleware_ready','planned','planned','Future app domain option. No DNS change in this phase.','{"future":true}'::jsonb)
on conflict (route_key) do update set
  routing_mode = excluded.routing_mode,
  safety_notes = excluded.safety_notes,
  updated_at = now();

notify pgrst, 'reload schema';
