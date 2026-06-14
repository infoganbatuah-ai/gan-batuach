create table if not exists public.digital_observer_production_setup_readiness (
  id uuid primary key default gen_random_uuid(),
  setup_key text not null,
  area text not null,
  title text not null,
  status text not null default 'planned',
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  selected_mode text,
  blocker text,
  next_action text,
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_production_setup_area_check check (area in ('domain','vercel','supabase','environment','billing','camera_gateway','deployment','qa','rollback','product_context')),
  constraint digital_observer_production_setup_status_check check (status in ('planned','ready_for_review','ready','blocked','future_only','disabled_by_default'))
);

create table if not exists public.digital_observer_production_env_readiness (
  id uuid primary key default gen_random_uuid(),
  env_key text not null,
  env_group text not null,
  required_for_mode text not null default 'route_only',
  server_only boolean not null default true,
  safe_public boolean not null default false,
  default_value text,
  status text not null default 'placeholder_only',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_env_group_check check (env_group in ('digital_observer','gan_batuach','shared')),
  constraint digital_observer_env_status_check check (status in ('placeholder_only','configured_later','shared_currently','blocked','ready'))
);

create table if not exists public.digital_observer_production_qa_checks (
  id uuid primary key default gen_random_uuid(),
  product_type text not null,
  check_area text not null,
  route_or_flow text not null,
  expected_result text not null,
  status text not null default 'not_tested',
  blocker text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_prod_qa_product_check check (product_type in ('gan_batuach','digital_observer')),
  constraint digital_observer_prod_qa_status_check check (status in ('not_tested','passed','failed','blocked','needs_review'))
);

create unique index if not exists digital_observer_prod_setup_key_idx on public.digital_observer_production_setup_readiness(setup_key);
create unique index if not exists digital_observer_prod_env_key_idx on public.digital_observer_production_env_readiness(env_key);
create unique index if not exists digital_observer_prod_qa_unique_idx on public.digital_observer_production_qa_checks(product_type, route_or_flow);

alter table public.digital_observer_production_setup_readiness enable row level security;
alter table public.digital_observer_production_env_readiness enable row level security;
alter table public.digital_observer_production_qa_checks enable row level security;

drop policy if exists "digital observer production setup admin" on public.digital_observer_production_setup_readiness;
create policy "digital observer production setup admin" on public.digital_observer_production_setup_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer production env admin" on public.digital_observer_production_env_readiness;
create policy "digital observer production env admin" on public.digital_observer_production_env_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer production qa admin" on public.digital_observer_production_qa_checks;
create policy "digital observer production qa admin" on public.digital_observer_production_qa_checks for all using (public.is_admin()) with check (public.is_admin());

insert into public.digital_observer_production_setup_readiness (setup_key, area, title, status, readiness_score, selected_mode, blocker, next_action, owner, metadata)
values
  ('domain-readiness', 'domain', 'Digital Observer domain readiness', 'ready_for_review', 74, 'domain_only_next', 'No real DNS configured in this phase.', 'Select observer.gan-batuach.co.il first and keep /digital-observer fallback.', 'platform', '{"domains":["observer.gan-batuach.co.il","digital-observer.co.il","app.digitalobserver.ai","app.digital-observer.co.il"]}'::jsonb),
  ('vercel-readiness', 'vercel', 'Vercel separation readiness', 'ready_for_review', 62, 'separate_vercel_later', 'No separate Vercel project yet.', 'Prepare same-repo Vercel project only after paid beta validation.', 'platform', '{"current":"same_project_route_based"}'::jsonb),
  ('supabase-readiness', 'supabase', 'Supabase separation strategy', 'future_only', 45, 'shared_supabase_now', 'Separate Supabase requires migration rehearsal.', 'Keep shared Supabase with observer_site_id/product_type until later split.', 'data', '{"no_data_migration":true}'::jsonb),
  ('environment-readiness', 'environment', 'Digital Observer environment readiness', 'disabled_by_default', 68, 'placeholder_only', 'Production flags default false.', 'Configure envs only after approval.', 'platform', '{"standalone_enabled":false}'::jsonb),
  ('billing-separation', 'billing', 'Billing separation readiness', 'ready_for_review', 78, 'separate_streams', 'Live provider not configured.', 'Keep Digital Observer invoices and revenue labels separate.', 'finance', '{"streams":["gan_batuach_subscription","parent_tuition","digital_observer_subscription"]}'::jsonb),
  ('camera-gateway-readiness', 'camera_gateway', 'Camera gateway production readiness', 'ready_for_review', 58, 'shared_gateway_now', 'Per-product gateway isolation not proven.', 'Assess separate gateway before paid scale.', 'platform', '{"rtsp_browser_exposure":false}'::jsonb),
  ('deployment-readiness', 'deployment', 'Deployment routing readiness', 'disabled_by_default', 66, 'route_only', 'Custom domain routing flag is off.', 'Enable DIGITAL_OBSERVER_CUSTOM_DOMAIN_ENABLED only after DNS/Vercel approval.', 'platform', '{}'::jsonb),
  ('qa-readiness', 'qa', 'Separated setup QA readiness', 'planned', 52, 'manual_qa_required', 'Separated setup has not been QA tested.', 'Run Gan Batuach and Digital Observer route QA before domain cutover.', 'qa', '{}'::jsonb),
  ('rollback-readiness', 'rollback', 'Rollback readiness', 'ready_for_review', 82, 'keep_current_route', 'Rollback is documented but not rehearsed.', 'Keep /digital-observer live and shared Supabase untouched.', 'platform', '{"preserve_customers":true,"preserve_billing":true}'::jsonb),
  ('product-context-guards', 'product_context', 'Product context guards', 'ready_for_review', 70, 'helper_ready', 'Not yet enforced across every route.', 'Use product-context helper in new routes and future APIs.', 'engineering', '{}'::jsonb)
on conflict (setup_key) do update set
  area = excluded.area,
  title = excluded.title,
  status = excluded.status,
  readiness_score = excluded.readiness_score,
  selected_mode = excluded.selected_mode,
  blocker = excluded.blocker,
  next_action = excluded.next_action,
  owner = excluded.owner,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.digital_observer_production_env_readiness (env_key, env_group, required_for_mode, server_only, safe_public, default_value, status, notes)
values
  ('DIGITAL_OBSERVER_STANDALONE_ENABLED', 'digital_observer', 'all', true, false, 'false', 'placeholder_only', 'Global standalone switch. Default false.'),
  ('DIGITAL_OBSERVER_CUSTOM_DOMAIN_ENABLED', 'digital_observer', 'domain_only', true, false, 'false', 'placeholder_only', 'Host routing switch. Default false.'),
  ('DIGITAL_OBSERVER_SEPARATE_BILLING_ENABLED', 'digital_observer', 'separate_billing', true, false, 'false', 'placeholder_only', 'Blocks accidental separate billing.'),
  ('DIGITAL_OBSERVER_SEPARATE_SUPABASE_ENABLED', 'digital_observer', 'separate_supabase', true, false, 'false', 'placeholder_only', 'No separate Supabase in this phase.'),
  ('DIGITAL_OBSERVER_PUBLIC_HOST', 'digital_observer', 'domain_only', true, false, null, 'configured_later', 'Marketing host.'),
  ('DIGITAL_OBSERVER_APP_HOST', 'digital_observer', 'domain_only', true, false, null, 'configured_later', 'App host.'),
  ('DIGITAL_OBSERVER_PRODUCT_MODE', 'digital_observer', 'all', true, false, 'route_only', 'placeholder_only', 'route_only/domain_only/separate_vercel readiness.'),
  ('DIGITAL_OBSERVER_PAYMENT_PROVIDER', 'digital_observer', 'paid_beta', true, false, null, 'configured_later', 'Separate from Gan Batuach and parent tuition.'),
  ('DIGITAL_OBSERVER_PAYMENT_MODE', 'digital_observer', 'paid_beta', true, false, 'disabled', 'placeholder_only', 'disabled/sandbox/live.'),
  ('DIGITAL_OBSERVER_INVOICE_PROVIDER', 'digital_observer', 'paid_beta', true, false, null, 'configured_later', 'Digital Observer invoice provider.'),
  ('DIGITAL_OBSERVER_CAMERA_GATEWAY_URL', 'digital_observer', 'camera_gateway', true, false, null, 'configured_later', 'Do not expose to client.'),
  ('DIGITAL_OBSERVER_AI_PROVIDER', 'digital_observer', 'observer_ai', true, false, null, 'configured_later', 'Provider key remains server-only.'),
  ('DIGITAL_OBSERVER_SUPPORT_EMAIL', 'digital_observer', 'support', true, false, null, 'configured_later', 'Support routing.'),
  ('DIGITAL_OBSERVER_DEFAULT_PACKAGE', 'digital_observer', 'onboarding', true, false, 'home_basic', 'placeholder_only', 'Default package key.'),
  ('NEXT_PUBLIC_SUPABASE_URL', 'shared', 'route_only', false, true, null, 'shared_currently', 'Public Supabase URL remains shared for now.'),
  ('SUPABASE_SERVICE_ROLE_KEY', 'shared', 'route_only', true, false, null, 'shared_currently', 'Server-only shared key. Never expose.')
on conflict (env_key) do update set
  env_group = excluded.env_group,
  required_for_mode = excluded.required_for_mode,
  server_only = excluded.server_only,
  safe_public = excluded.safe_public,
  default_value = excluded.default_value,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.digital_observer_production_qa_checks (product_type, check_area, route_or_flow, expected_result, status)
values
  ('gan_batuach', 'homepage', '/', 'Gan Batuach homepage still loads.', 'not_tested'),
  ('gan_batuach', 'login', '/login', 'Shared login remains functional.', 'not_tested'),
  ('gan_batuach', 'manager dashboard', '/dashboard/garden', 'Manager dashboard unaffected.', 'not_tested'),
  ('gan_batuach', 'parent dashboard', '/dashboard/parent', 'Parent dashboard unaffected.', 'not_tested'),
  ('gan_batuach', 'staff dashboard', '/dashboard/staff', 'Staff dashboard unaffected.', 'not_tested'),
  ('gan_batuach', 'inspector dashboard', '/dashboard/inspector', 'Inspector dashboard unaffected.', 'not_tested'),
  ('gan_batuach', 'admin dashboard', '/dashboard/admin', 'Admin dashboard unaffected.', 'not_tested'),
  ('gan_batuach', 'payments', 'Gan Batuach and parent payments', 'Revenue streams remain separate.', 'not_tested'),
  ('gan_batuach', 'onboarding', '/onboarding/kindergarten', 'Kindergarten onboarding unaffected.', 'not_tested'),
  ('digital_observer', 'public page', '/digital-observer', 'Standalone public surface loads.', 'not_tested'),
  ('digital_observer', 'onboarding', '/digital-observer/onboarding', 'Observer onboarding loads without kindergarten language.', 'not_tested'),
  ('digital_observer', 'dashboard', '/digital-observer/dashboard', 'Observer customer dashboard loads.', 'not_tested'),
  ('digital_observer', 'site creation', '/digital-observer/sites', 'Sites shell is available.', 'not_tested'),
  ('digital_observer', 'camera setup', '/digital-observer/cameras', 'Camera shell is available and hides RTSP/credentials.', 'not_tested'),
  ('digital_observer', 'alerts', '/digital-observer/alerts', 'Alerts shell is available and review-first.', 'not_tested'),
  ('digital_observer', 'billing', '/digital-observer/billing', 'Billing remains Digital Observer only.', 'not_tested'),
  ('digital_observer', 'admin view', '/dashboard/admin/digital-observer', 'Admin overview labels product type clearly.', 'not_tested')
on conflict (product_type, route_or_flow) do update set
  check_area = excluded.check_area,
  expected_result = excluded.expected_result,
  updated_at = now();

comment on table public.digital_observer_production_setup_readiness is 'Digital Observer separate production setup readiness. Does not create external resources or move data.';
comment on table public.digital_observer_production_env_readiness is 'Environment variable separation readiness with placeholders only and safe flags defaulting false.';
comment on table public.digital_observer_production_qa_checks is 'QA checklist for route-only/domain/separate Vercel readiness while preserving Gan Batuach.';
