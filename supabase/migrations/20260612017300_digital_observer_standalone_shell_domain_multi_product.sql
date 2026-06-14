-- PHASE 173: Digital Observer standalone shell, domain readiness and multi-product architecture.
-- This migration prepares product separation metadata only. It does not create a new repo,
-- Supabase project, Vercel project or duplicate observer engines.

alter table public.observer_sites
  drop constraint if exists observer_sites_type_check;

alter table public.observer_sites
  add constraint observer_sites_type_check check (site_type in (
    'kindergarten',
    'home',
    'office',
    'business',
    'warehouse',
    'store',
    'parking_lot',
    'school_future',
    'municipality_future',
    'custom'
  ));

alter table if exists public.observer_site_onboarding_drafts
  drop constraint if exists observer_site_onboarding_site_type_check;

alter table if exists public.observer_site_onboarding_drafts
  add constraint observer_site_onboarding_site_type_check check (site_type in (
    'home',
    'office',
    'business',
    'warehouse',
    'store',
    'parking_lot',
    'school_future',
    'custom'
  ));

create table if not exists public.digital_observer_product_readiness (
  id uuid primary key default gen_random_uuid(),
  readiness_key text not null unique,
  area text not null,
  title text not null,
  status text not null default 'planned',
  product_boundary text not null default 'digital_observer',
  shared_core_tables jsonb not null default '[]'::jsonb,
  gan_batuach_impact text not null default 'none',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_readiness_area_check check (area in ('public_entry','app_shell','onboarding','domain_routing','product_separation','branding','shared_core','site_model','roles','capability_matrix','packages','camera_setup','ai_goals','admin_visibility','navigation','seo','future_extraction')),
  constraint digital_observer_readiness_status_check check (status in ('planned','ready','ready_for_review','blocked','future_only')),
  constraint digital_observer_boundary_check check (product_boundary in ('digital_observer','gan_batuach','shared_core','future_vertical'))
);

create table if not exists public.digital_observer_domain_routes (
  id uuid primary key default gen_random_uuid(),
  route_key text not null unique,
  current_route text not null,
  future_domain text not null,
  routing_mode text not null default 'documented',
  vercel_setup_status text not null default 'not_configured',
  dns_status text not null default 'not_configured',
  safety_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_routing_mode_check check (routing_mode in ('documented','middleware_ready','active')),
  constraint digital_observer_vercel_status_check check (vercel_setup_status in ('not_configured','planned','configured','verified')),
  constraint digital_observer_dns_status_check check (dns_status in ('not_configured','planned','configured','verified'))
);

create index if not exists idx_digital_observer_product_readiness_area on public.digital_observer_product_readiness(area, status);
create index if not exists idx_digital_observer_domain_routes_status on public.digital_observer_domain_routes(routing_mode, vercel_setup_status, dns_status);

alter table public.digital_observer_product_readiness enable row level security;
alter table public.digital_observer_domain_routes enable row level security;

drop policy if exists "digital observer product readiness admin only" on public.digital_observer_product_readiness;
create policy "digital observer product readiness admin only" on public.digital_observer_product_readiness
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "digital observer domain routes admin only" on public.digital_observer_domain_routes;
create policy "digital observer domain routes admin only" on public.digital_observer_domain_routes
for all using (public.is_admin())
with check (public.is_admin());

insert into public.digital_observer_product_readiness (readiness_key, area, title, status, product_boundary, shared_core_tables, gan_batuach_impact, notes, metadata)
values
  ('public-entry','public_entry','Standalone public route /digital-observer','ready','digital_observer','[]'::jsonb,'none','Public route is separate from Gan Batuach kindergarten acquisition pages.','{"route":"/digital-observer"}'::jsonb),
  ('app-shell','app_shell','Standalone Digital Observer dashboard shell','ready','digital_observer','["observer_sites","camera_streams","observer_intelligence_signals","observer_site_subscriptions"]'::jsonb,'none','Dashboard uses observer site data and excludes kindergarten-specific flows.','{"route":"/digital-observer/dashboard"}'::jsonb),
  ('onboarding-flow','onboarding','Digital Observer onboarding readiness','ready','digital_observer','["observer_site_onboarding_drafts","observer_monitoring_packages"]'::jsonb,'none','Onboarding is separate from Gan Batuach kindergarten activation.','{"route":"/digital-observer/onboarding"}'::jsonb),
  ('domain-routing','domain_routing','Future observer domain routing readiness','ready_for_review','digital_observer','[]'::jsonb,'none','DNS and Vercel custom domains remain manual future setup.','{"current":"https://gan-batuach.vercel.app/digital-observer"}'::jsonb),
  ('product-separation','product_separation','Gan Batuach and Digital Observer boundary','ready','shared_core','["observer_sites","camera_streams","ai_camera_events","observer_intelligence_signals"]'::jsonb,'none','Digital Observer reuses core infrastructure without parent/child/staff flows.','{}'::jsonb),
  ('capability-matrix','capability_matrix','Vertical capability policy integration','ready_for_review','shared_core','["observer_vertical_capability_decisions","vertical_capability_matrix"]'::jsonb,'none','Restricted capabilities remain policy-gated and not auto-enabled.','{}'::jsonb),
  ('future-extraction','future_extraction','Future monorepo extraction plan','planned','future_vertical','[]'::jsonb,'none','Future apps/packages split is documented only.','{"apps":["gan-batuach","digital-observer"],"packages":["observer-core","camera-core","ai-core","workflow-core","audit-core","analytics-core","ui-core"]}'::jsonb)
on conflict (readiness_key) do update set
  status = excluded.status,
  product_boundary = excluded.product_boundary,
  shared_core_tables = excluded.shared_core_tables,
  gan_batuach_impact = excluded.gan_batuach_impact,
  notes = excluded.notes,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_domain_routes (route_key, current_route, future_domain, routing_mode, vercel_setup_status, dns_status, safety_notes, metadata)
values
  ('current-vercel-route','/digital-observer','gan-batuach.vercel.app','documented','configured','verified','Current route remains under existing Gan Batuach deployment.','{"active_now":true}'::jsonb),
  ('observer-subdomain','/digital-observer','observer.gan-batuach.co.il','documented','planned','planned','Future Vercel custom domain. Host-based routing should be enabled only after DNS verification.','{"future":true}'::jsonb),
  ('digitalobserver-ai','/digital-observer','app.digitalobserver.ai','documented','planned','planned','Future standalone brand domain. No DNS change in this phase.','{"future":true}'::jsonb),
  ('digital-observer-co-il','/digital-observer','digital-observer.co.il','documented','planned','planned','Future local domain option. No DNS change in this phase.','{"future":true}'::jsonb)
on conflict (route_key) do update set
  current_route = excluded.current_route,
  future_domain = excluded.future_domain,
  routing_mode = excluded.routing_mode,
  vercel_setup_status = excluded.vercel_setup_status,
  dns_status = excluded.dns_status,
  safety_notes = excluded.safety_notes,
  metadata = excluded.metadata,
  updated_at = now();

comment on table public.digital_observer_product_readiness is 'Phase 173 product separation and standalone shell readiness for Digital Observer inside the current Gan Batuach project.';
comment on table public.digital_observer_domain_routes is 'Future Digital Observer domain routing readiness. DNS and Vercel custom domains remain manual external setup.';

notify pgrst, 'reload schema';
