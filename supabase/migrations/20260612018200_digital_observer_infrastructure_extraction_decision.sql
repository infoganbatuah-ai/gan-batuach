create table if not exists public.digital_observer_separation_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_state text not null default 'keep_inside_gan_batuach',
  separation_readiness_score integer not null default 0 check (separation_readiness_score between 0 and 100),
  paid_beta_validation_status text not null default 'not_validated',
  product_readiness_score integer not null default 0 check (product_readiness_score between 0 and 100),
  revenue_readiness_score integer not null default 0 check (revenue_readiness_score between 0 and 100),
  technical_readiness_score integer not null default 0 check (technical_readiness_score between 0 and 100),
  data_separation_readiness_score integer not null default 0 check (data_separation_readiness_score between 0 and 100),
  vercel_readiness_score integer not null default 0 check (vercel_readiness_score between 0 and 100),
  supabase_readiness_score integer not null default 0 check (supabase_readiness_score between 0 and 100),
  github_readiness_score integer not null default 0 check (github_readiness_score between 0 and 100),
  domain_readiness_score integer not null default 0 check (domain_readiness_score between 0 and 100),
  paying_customers_count integer not null default 0,
  active_observer_sites_count integer not null default 0,
  cameras_connected_count integer not null default 0,
  alerts_reviewed_count integer not null default 0,
  support_load_status text not null default 'unknown',
  billing_separation_status text not null default 'ready_for_review',
  legal_readiness_status text not null default 'needs_external_review',
  final_recommendation text not null,
  reason text,
  blockers jsonb not null default '[]'::jsonb,
  next_phase_recommendation text,
  decided_by text,
  decided_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_separation_decision_state_check check (decision_state in ('not_ready','keep_inside_gan_batuach','monorepo_recommended','separate_vercel_ready','separate_supabase_ready','separate_repo_ready','full_separation_ready'))
);

create table if not exists public.digital_observer_strategy_reviews (
  id uuid primary key default gen_random_uuid(),
  strategy_area text not null,
  option_key text not null,
  option_title text not null,
  recommendation text not null default 'future_only',
  pros jsonb not null default '[]'::jsonb,
  cons jsonb not null default '[]'::jsonb,
  risk_summary text,
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_strategy_area_check check (strategy_area in ('github','vercel','supabase','auth','domain','support','camera_gateway','ai_observer')),
  constraint digital_observer_strategy_status_check check (status in ('draft','recommended','blocked','future_only','ready_for_review'))
);

create table if not exists public.digital_observer_data_boundary_map (
  id uuid primary key default gen_random_uuid(),
  boundary_group text not null,
  table_or_area text not null,
  product_owner text not null,
  future_action text not null default 'document_only',
  contains_sensitive_data boolean not null default false,
  requires_split boolean not null default false,
  garden_id_dependency boolean not null default false,
  observer_site_id_dependency boolean not null default false,
  storage_dependency text,
  migration_notes text,
  status text not null default 'mapped',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_boundary_group_check check (boundary_group in ('gan_batuach_only','digital_observer_only','shared_core')),
  constraint digital_observer_boundary_owner_check check (product_owner in ('gan_batuach','digital_observer','shared_core')),
  constraint digital_observer_boundary_status_check check (status in ('mapped','needs_review','split_required','keep_shared','ready_for_copy','blocked'))
);

create table if not exists public.digital_observer_shared_core_readiness (
  id uuid primary key default gen_random_uuid(),
  package_key text not null,
  package_name text not null,
  current_modules jsonb not null default '[]'::jsonb,
  target_path text not null,
  readiness_status text not null default 'needs_refactor',
  gan_batuach_specific_count integer not null default 0,
  digital_observer_specific_count integer not null default 0,
  unsafe_to_move_now boolean not null default false,
  refactor_notes text,
  owner text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_core_readiness_status_check check (readiness_status in ('already_reusable','needs_refactor','gan_batuach_specific','digital_observer_specific','unsafe_to_move_now'))
);

create table if not exists public.digital_observer_data_migration_readiness (
  id uuid primary key default gen_random_uuid(),
  migration_area text not null,
  source_table_or_bucket text not null,
  future_destination text,
  migration_action text not null default 'copy',
  foreign_keys_to_replace jsonb not null default '[]'::jsonb,
  garden_id_dependencies jsonb not null default '[]'::jsonb,
  observer_site_id_preserved boolean not null default true,
  auth_mapping_required boolean not null default false,
  storage_split_required boolean not null default false,
  migration_risk text not null default 'medium',
  status text not null default 'planned',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_migration_action_check check (migration_action in ('copy','split','keep_shared','replace_fk','do_not_move_now')),
  constraint digital_observer_migration_risk_check check (migration_risk in ('critical','high','medium','low')),
  constraint digital_observer_migration_status_check check (status in ('planned','needs_review','blocked','ready_for_future_phase','do_not_migrate_now'))
);

create table if not exists public.digital_observer_extraction_risks (
  id uuid primary key default gen_random_uuid(),
  risk_category text not null,
  risk_title text not null,
  severity text not null default 'medium',
  risk_description text not null,
  mitigation text,
  owner text,
  status text not null default 'open',
  due_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_extraction_risk_category_check check (risk_category in ('data migration','auth','billing','camera gateway','shared packages','deployment','DNS/domain','Supabase','Vercel','support','legal','customer disruption')),
  constraint digital_observer_extraction_risk_severity_check check (severity in ('critical','high','medium','low')),
  constraint digital_observer_extraction_risk_status_check check (status in ('open','in_progress','mitigated','accepted_risk','blocked','deferred'))
);

create table if not exists public.digital_observer_extraction_cost_estimates (
  id uuid primary key default gen_random_uuid(),
  scenario_key text not null,
  scenario_name text not null,
  vercel_monthly_cost numeric(12,2) not null default 0,
  supabase_monthly_cost numeric(12,2) not null default 0,
  storage_monthly_cost numeric(12,2) not null default 0,
  camera_gateway_monthly_cost numeric(12,2) not null default 0,
  ai_provider_monthly_cost numeric(12,2) not null default 0,
  communications_monthly_cost numeric(12,2) not null default 0,
  payment_provider_monthly_cost numeric(12,2) not null default 0,
  monitoring_logging_monthly_cost numeric(12,2) not null default 0,
  support_monthly_cost numeric(12,2) not null default 0,
  estimated_total_monthly_cost numeric(12,2) not null default 0,
  cost_notes text,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.digital_observer_extraction_timeline_estimates (
  id uuid primary key default gen_random_uuid(),
  workstream text not null,
  estimated_days integer not null default 0,
  complexity text not null default 'medium',
  dependencies jsonb not null default '[]'::jsonb,
  rollback_complexity text not null default 'medium',
  status text not null default 'planned',
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint digital_observer_timeline_complexity_check check (complexity in ('high','medium','low')),
  constraint digital_observer_timeline_status_check check (status in ('planned','ready_for_review','blocked','future_phase'))
);

create table if not exists public.digital_observer_rollback_plans (
  id uuid primary key default gen_random_uuid(),
  rollback_key text not null,
  rollback_step text not null,
  trigger_condition text not null,
  action_required text not null,
  preserves_customers boolean not null default true,
  preserves_billing boolean not null default true,
  preserves_data boolean not null default true,
  owner text,
  status text not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists digital_observer_strategy_reviews_area_option_idx on public.digital_observer_strategy_reviews(strategy_area, option_key);
create unique index if not exists digital_observer_data_boundary_unique_idx on public.digital_observer_data_boundary_map(boundary_group, table_or_area);
create unique index if not exists digital_observer_shared_core_package_idx on public.digital_observer_shared_core_readiness(package_key);
create unique index if not exists digital_observer_migration_area_source_idx on public.digital_observer_data_migration_readiness(migration_area, source_table_or_bucket);
create unique index if not exists digital_observer_cost_scenario_idx on public.digital_observer_extraction_cost_estimates(scenario_key);
create unique index if not exists digital_observer_timeline_workstream_idx on public.digital_observer_extraction_timeline_estimates(workstream);
create unique index if not exists digital_observer_rollback_key_step_idx on public.digital_observer_rollback_plans(rollback_key, rollback_step);
create index if not exists digital_observer_extraction_risks_status_idx on public.digital_observer_extraction_risks(status, severity);

alter table public.digital_observer_separation_decisions enable row level security;
alter table public.digital_observer_strategy_reviews enable row level security;
alter table public.digital_observer_data_boundary_map enable row level security;
alter table public.digital_observer_shared_core_readiness enable row level security;
alter table public.digital_observer_data_migration_readiness enable row level security;
alter table public.digital_observer_extraction_risks enable row level security;
alter table public.digital_observer_extraction_cost_estimates enable row level security;
alter table public.digital_observer_extraction_timeline_estimates enable row level security;
alter table public.digital_observer_rollback_plans enable row level security;

drop policy if exists "digital observer separation decisions admin" on public.digital_observer_separation_decisions;
create policy "digital observer separation decisions admin" on public.digital_observer_separation_decisions for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer strategy reviews admin" on public.digital_observer_strategy_reviews;
create policy "digital observer strategy reviews admin" on public.digital_observer_strategy_reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer data boundary admin" on public.digital_observer_data_boundary_map;
create policy "digital observer data boundary admin" on public.digital_observer_data_boundary_map for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer shared core readiness admin" on public.digital_observer_shared_core_readiness;
create policy "digital observer shared core readiness admin" on public.digital_observer_shared_core_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer migration readiness admin" on public.digital_observer_data_migration_readiness;
create policy "digital observer migration readiness admin" on public.digital_observer_data_migration_readiness for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer extraction risks admin" on public.digital_observer_extraction_risks;
create policy "digital observer extraction risks admin" on public.digital_observer_extraction_risks for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer cost estimates admin" on public.digital_observer_extraction_cost_estimates;
create policy "digital observer cost estimates admin" on public.digital_observer_extraction_cost_estimates for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer timeline estimates admin" on public.digital_observer_extraction_timeline_estimates;
create policy "digital observer timeline estimates admin" on public.digital_observer_extraction_timeline_estimates for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "digital observer rollback plans admin" on public.digital_observer_rollback_plans;
create policy "digital observer rollback plans admin" on public.digital_observer_rollback_plans for all using (public.is_admin()) with check (public.is_admin());

insert into public.digital_observer_strategy_reviews (strategy_area, option_key, option_title, recommendation, pros, cons, risk_summary, readiness_score, status)
values
  ('github', 'single_monorepo', 'Single Monorepo', 'recommended_next', '["shared packages","one source of truth","easier Codex context","easier shared engine development"]'::jsonb, '["larger repo","requires careful boundaries"]'::jsonb, 'Best next step before separate repositories.', 72, 'recommended'),
  ('github', 'separate_repositories', 'Separate Repositories', 'later', '["stronger product separation","cleaner permissions"]'::jsonb, '["shared package complexity","duplicated setup","harder synchronization"]'::jsonb, 'Too early until shared package contracts stabilize.', 38, 'future_only'),
  ('vercel', 'same_project_route_based', 'Same Vercel project, route-based separation', 'current', '["already working","lowest risk","simple rollback"]'::jsonb, '["less infrastructure separation","shared deployment blast radius"]'::jsonb, 'Keep current model until paid beta is validated.', 80, 'recommended'),
  ('vercel', 'separate_projects_same_monorepo', 'Separate Vercel projects from same monorepo', 'next_after_paid_beta', '["separate domains","separate deployment settings","shared code"]'::jsonb, '["requires app folder split","requires CI/env separation"]'::jsonb, 'Recommended first infrastructure split after traction.', 62, 'ready_for_review'),
  ('vercel', 'separate_projects_separate_repos', 'Separate Vercel projects and separate repos', 'future_only', '["strong separation"]'::jsonb, '["more operations","harder shared core changes"]'::jsonb, 'Only after monorepo package extraction.', 34, 'future_only'),
  ('supabase', 'same_project_product_type', 'Same Supabase project with product_type / observer_site_id separation', 'current', '["lowest migration risk","shared auth","fastest support"]'::jsonb, '["requires strict RLS","shared backup scope"]'::jsonb, 'Current model is acceptable while data volume is small.', 70, 'recommended'),
  ('supabase', 'separate_project', 'Separate Supabase project for Digital Observer', 'later', '["stronger data isolation","separate scaling"]'::jsonb, '["auth migration","data migration","higher rollback risk"]'::jsonb, 'Do not do before paid beta and migration rehearsals.', 42, 'future_only'),
  ('supabase', 'hybrid_transition', 'Hybrid transition model', 'recommended_for_extraction', '["controlled cutover","rollback path","table-by-table split"]'::jsonb, '["temporary complexity","requires bridge tooling"]'::jsonb, 'Best path when Supabase split becomes necessary.', 58, 'ready_for_review'),
  ('auth', 'shared_identity_layer', 'Shared identity layer with product access', 'recommended_for_extraction', '["cross-product login","central admin","less user friction"]'::jsonb, '["permission complexity","requires product access model"]'::jsonb, 'Prefer product access over separate auth at first.', 60, 'ready_for_review'),
  ('domain', 'observer_subdomain_first', 'observer.gan-batuach.co.il first', 'recommended_next', '["low DNS risk","brand bridge","simple rollback"]'::jsonb, '["less standalone brand"]'::jsonb, 'Use before fully standalone domain.', 74, 'recommended')
on conflict (strategy_area, option_key) do update set
  option_title = excluded.option_title,
  recommendation = excluded.recommendation,
  pros = excluded.pros,
  cons = excluded.cons,
  risk_summary = excluded.risk_summary,
  readiness_score = excluded.readiness_score,
  status = excluded.status,
  updated_at = now();

insert into public.digital_observer_data_boundary_map (boundary_group, table_or_area, product_owner, future_action, contains_sensitive_data, requires_split, garden_id_dependency, observer_site_id_dependency, storage_dependency, migration_notes, status)
values
  ('gan_batuach_only', 'children', 'gan_batuach', 'do_not_move', true, false, true, false, 'child documents', 'Remain in Gan Batuach only.', 'mapped'),
  ('gan_batuach_only', 'parents', 'gan_batuach', 'do_not_move', true, false, true, false, 'parent files', 'Remain in Gan Batuach only.', 'mapped'),
  ('gan_batuach_only', 'staff', 'gan_batuach', 'do_not_move', true, false, true, false, 'staff files', 'Remain in Gan Batuach only.', 'mapped'),
  ('gan_batuach_only', 'inspections', 'gan_batuach', 'do_not_move', true, false, true, false, 'inspection evidence', 'Kindergarten regulatory workflow.', 'mapped'),
  ('gan_batuach_only', 'kindergarten billing', 'gan_batuach', 'do_not_move', false, false, true, false, null, 'Gan Batuach subscriptions only.', 'mapped'),
  ('gan_batuach_only', 'parent tuition payments', 'gan_batuach', 'do_not_move', true, false, true, false, 'invoices', 'Parent money routes to kindergarten account.', 'mapped'),
  ('gan_batuach_only', 'child medical records', 'gan_batuach', 'do_not_move', true, false, true, false, 'medical documents', 'Never move to Digital Observer.', 'mapped'),
  ('digital_observer_only', 'observer_sites', 'digital_observer', 'copy_or_split_later', false, true, false, true, null, 'Preserve observer_site_id for standalone sites.', 'ready_for_copy'),
  ('digital_observer_only', 'observer_site_subscriptions', 'digital_observer', 'copy_or_split_later', false, true, false, true, null, 'Keep separate from Gan Batuach subscriptions.', 'ready_for_copy'),
  ('digital_observer_only', 'observer_usage_tracking', 'digital_observer', 'copy_or_split_later', false, true, false, true, null, 'Usage can move by observer_site_id.', 'ready_for_copy'),
  ('digital_observer_only', 'observer_site_members', 'digital_observer', 'copy_or_split_later', true, true, false, true, null, 'Needs auth mapping.', 'needs_review'),
  ('digital_observer_only', 'standalone observer billing', 'digital_observer', 'copy_or_split_later', true, true, false, true, 'observer invoices', 'Keep invoices product-labeled.', 'needs_review'),
  ('shared_core', 'camera infrastructure', 'shared_core', 'extract_package_later', true, false, true, true, 'camera snapshots', 'Needs per-product gateway policy.', 'needs_review'),
  ('shared_core', 'observer signals', 'shared_core', 'extract_package_later', true, false, true, true, null, 'Parent visibility stays Gan Batuach-specific.', 'needs_review'),
  ('shared_core', 'audit logs', 'shared_core', 'keep_shared_or_replicate', true, false, true, true, null, 'Immutable audit strategy needed before split.', 'needs_review'),
  ('shared_core', 'AI models', 'shared_core', 'extract_package_later', false, false, false, true, null, 'Model registry can become shared package.', 'mapped'),
  ('shared_core', 'workflows', 'shared_core', 'extract_package_later', false, false, true, true, null, 'Separate product workflows before moving.', 'needs_review'),
  ('shared_core', 'notifications', 'shared_core', 'extract_package_later', true, false, true, true, null, 'Provider keys and templates need product split.', 'needs_review'),
  ('shared_core', 'capability matrix', 'shared_core', 'extract_package_later', false, false, false, true, null, 'Core governance should remain shared.', 'mapped')
on conflict (boundary_group, table_or_area) do update set
  product_owner = excluded.product_owner,
  future_action = excluded.future_action,
  contains_sensitive_data = excluded.contains_sensitive_data,
  requires_split = excluded.requires_split,
  garden_id_dependency = excluded.garden_id_dependency,
  observer_site_id_dependency = excluded.observer_site_id_dependency,
  storage_dependency = excluded.storage_dependency,
  migration_notes = excluded.migration_notes,
  status = excluded.status,
  updated_at = now();

insert into public.digital_observer_shared_core_readiness (package_key, package_name, current_modules, target_path, readiness_status, gan_batuach_specific_count, digital_observer_specific_count, unsafe_to_move_now, refactor_notes, owner)
values
  ('observer-core', 'Observer Core', '["observer_intelligence_signals","observer review queue","capability matrix"]'::jsonb, 'packages/observer-core', 'needs_refactor', 2, 2, false, 'Separate Gan Batuach parent visibility and standalone site review states.', 'platform'),
  ('camera-core', 'Camera Core', '["camera_streams","camera_gateway_configs","playback tokens"]'::jsonb, 'packages/camera-core', 'needs_refactor', 2, 2, false, 'Gateway secrets and RTSP handling must remain server-only.', 'platform'),
  ('ai-core', 'AI Core', '["ai_camera_events","model registry","calibration"]'::jsonb, 'packages/ai-core', 'needs_refactor', 3, 2, false, 'Regulatory profiles must wrap capability execution.', 'platform'),
  ('workflow-core', 'Workflow Core', '["tasks","review flows","support flows"]'::jsonb, 'packages/workflow-core', 'needs_refactor', 4, 2, false, 'Separate child/staff/inspection workflows from generic observer workflows.', 'platform'),
  ('audit-core', 'Audit Core', '["audit_logs","immutable audit service"]'::jsonb, 'packages/audit-core', 'already_reusable', 1, 1, false, 'Keep product_type and subject scope.', 'security'),
  ('notification-core', 'Notification Core', '["email","SMS","WhatsApp","push"]'::jsonb, 'packages/notification-core', 'needs_refactor', 2, 2, false, 'Templates and provider keys need product/env separation.', 'platform'),
  ('billing-core', 'Billing Core', '["observer subscriptions","Gan Batuach subscriptions","parent payments"]'::jsonb, 'packages/billing-core', 'unsafe_to_move_now', 4, 3, true, 'Revenue streams are separate but provider integration still needs careful boundaries.', 'finance'),
  ('analytics-core', 'Analytics Core', '["usage tracking","growth dashboards","PMF signals"]'::jsonb, 'packages/analytics-core', 'already_reusable', 1, 2, false, 'Use product_type filters throughout.', 'growth'),
  ('ui-core', 'UI Core', '["DashboardShell","cards","public sections"]'::jsonb, 'packages/ui-core', 'needs_refactor', 2, 2, false, 'Avoid leaking Gan Batuach language into Digital Observer shell.', 'design')
on conflict (package_key) do update set
  package_name = excluded.package_name,
  current_modules = excluded.current_modules,
  target_path = excluded.target_path,
  readiness_status = excluded.readiness_status,
  gan_batuach_specific_count = excluded.gan_batuach_specific_count,
  digital_observer_specific_count = excluded.digital_observer_specific_count,
  unsafe_to_move_now = excluded.unsafe_to_move_now,
  refactor_notes = excluded.refactor_notes,
  owner = excluded.owner,
  updated_at = now();

insert into public.digital_observer_data_migration_readiness (migration_area, source_table_or_bucket, future_destination, migration_action, foreign_keys_to_replace, garden_id_dependencies, observer_site_id_preserved, auth_mapping_required, storage_split_required, migration_risk, status, notes)
values
  ('tables_to_copy', 'observer_sites', 'digital_observer.observer_sites', 'copy', '[]'::jsonb, '[]'::jsonb, true, true, false, 'medium', 'ready_for_future_phase', 'Copy standalone site rows only.'),
  ('tables_to_copy', 'observer_site_subscriptions', 'digital_observer.observer_site_subscriptions', 'copy', '["package_id"]'::jsonb, '[]'::jsonb, true, false, false, 'medium', 'ready_for_future_phase', 'Keep billing stream Digital Observer only.'),
  ('tables_to_split', 'camera_streams', 'digital_observer.camera_streams', 'split', '["garden_id"]'::jsonb, '["garden_id"]'::jsonb, true, false, true, 'high', 'needs_review', 'Split by observer_site_id and product type.'),
  ('tables_to_split', 'audit_logs', 'digital_observer.audit_logs', 'split', '["subject_id"]'::jsonb, '["garden_id","child_id"]'::jsonb, true, false, false, 'high', 'needs_review', 'Need immutable audit continuity plan.'),
  ('tables_to_keep_shared', 'capability_matrix', 'shared.capability_matrix', 'keep_shared', '[]'::jsonb, '[]'::jsonb, true, false, false, 'low', 'ready_for_future_phase', 'Governance can remain shared package.'),
  ('storage_to_split', 'camera snapshots', 'digital_observer-camera-snapshots', 'split', '[]'::jsonb, '["garden_id"]'::jsonb, true, false, true, 'high', 'needs_review', 'No file move in this phase.'),
  ('auth_mapping', 'auth.users/profiles', 'digital_observer auth mapping', 'replace_fk', '["profile_id","owner_profile_id"]'::jsonb, '[]'::jsonb, true, true, false, 'high', 'needs_review', 'Choose shared identity or separate auth before migration.')
on conflict (migration_area, source_table_or_bucket) do update set
  future_destination = excluded.future_destination,
  migration_action = excluded.migration_action,
  foreign_keys_to_replace = excluded.foreign_keys_to_replace,
  garden_id_dependencies = excluded.garden_id_dependencies,
  observer_site_id_preserved = excluded.observer_site_id_preserved,
  auth_mapping_required = excluded.auth_mapping_required,
  storage_split_required = excluded.storage_split_required,
  migration_risk = excluded.migration_risk,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.digital_observer_extraction_risks (risk_category, risk_title, severity, risk_description, mitigation, owner, status)
values
  ('data migration', 'Observer data split may miss shared camera/audit references', 'high', 'Camera and audit data currently include shared product context.', 'Run dry-run export and FK inventory before any migration.', 'platform', 'open'),
  ('auth', 'Separate auth can break cross-product access', 'high', 'Users may need access to both Gan Batuach and Digital Observer.', 'Prefer shared identity layer first.', 'security', 'open'),
  ('billing', 'Revenue stream confusion during split', 'critical', 'Gan Batuach, parent tuition and Digital Observer payments must never mix.', 'Keep product-labeled invoices and provider accounts.', 'finance', 'open'),
  ('camera gateway', 'Shared gateway may create customer isolation risk', 'high', 'Gateway load and credentials need per-product isolation.', 'Evaluate per-product gateway before paid scale.', 'platform', 'open'),
  ('shared packages', 'Premature package extraction can slow product work', 'medium', 'Core code still contains vertical-specific assumptions.', 'Extract only after module boundary audit.', 'engineering', 'open'),
  ('deployment', 'Separate Vercel project can diverge env config', 'medium', 'Digital Observer env vars need separate setup and preview behavior.', 'Create product-specific env checklist before separate deploy.', 'platform', 'open'),
  ('DNS/domain', 'Domain cutover may disrupt leads or beta customers', 'medium', 'Future domain must have rollback to /digital-observer.', 'Use observer subdomain first and keep route-based fallback.', 'growth', 'open'),
  ('Supabase', 'Separate project increases backup and migration complexity', 'high', 'Data, auth, RLS and storage require rehearsal.', 'Run dry-run migration and restore test before project split.', 'data', 'open'),
  ('Vercel', 'Separate project may require monorepo restructure first', 'medium', 'apps/digital-observer does not exist yet.', 'Prepare monorepo app boundary before creating Vercel project.', 'platform', 'open'),
  ('support', 'Support teams may confuse products', 'medium', 'Tickets need product_type, SLA and owner.', 'Add product context and support ownership to every ticket.', 'support', 'open'),
  ('legal', 'Standalone product terms still need review', 'high', 'Paid beta terms and privacy notice are drafts.', 'Complete external legal review before standalone launch.', 'legal', 'open'),
  ('customer disruption', 'Existing beta customers may be affected by split', 'high', 'Billing, login and camera tokens must continue working.', 'Keep existing route and database active until cutover is verified.', 'customer_success', 'open')
on conflict do nothing;

insert into public.digital_observer_extraction_cost_estimates (scenario_key, scenario_name, vercel_monthly_cost, supabase_monthly_cost, storage_monthly_cost, camera_gateway_monthly_cost, ai_provider_monthly_cost, communications_monthly_cost, payment_provider_monthly_cost, monitoring_logging_monthly_cost, support_monthly_cost, estimated_total_monthly_cost, cost_notes, status)
values
  ('keep_inside_gan_batuach', 'Keep inside Gan Batuach', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'Incremental cost stays in current stack; lower separation.', 'draft'),
  ('separate_vercel_only', 'Separate Vercel only', 25, 0, 0, 0, 0, 0, 0, 15, 0, 40, 'Separate deployment/domain while keeping Supabase shared.', 'draft'),
  ('separate_vercel_supabase', 'Separate Vercel + Supabase', 25, 50, 20, 100, 100, 30, 25, 25, 0, 350, 'Higher isolation, higher migration and operations cost.', 'draft'),
  ('full_repo_separation', 'Full repo separation', 25, 50, 20, 100, 100, 30, 25, 40, 250, 640, 'Adds support and engineering overhead for separate lifecycle.', 'draft')
on conflict (scenario_key) do update set
  scenario_name = excluded.scenario_name,
  vercel_monthly_cost = excluded.vercel_monthly_cost,
  supabase_monthly_cost = excluded.supabase_monthly_cost,
  storage_monthly_cost = excluded.storage_monthly_cost,
  camera_gateway_monthly_cost = excluded.camera_gateway_monthly_cost,
  ai_provider_monthly_cost = excluded.ai_provider_monthly_cost,
  communications_monthly_cost = excluded.communications_monthly_cost,
  payment_provider_monthly_cost = excluded.payment_provider_monthly_cost,
  monitoring_logging_monthly_cost = excluded.monitoring_logging_monthly_cost,
  support_monthly_cost = excluded.support_monthly_cost,
  estimated_total_monthly_cost = excluded.estimated_total_monthly_cost,
  cost_notes = excluded.cost_notes,
  updated_at = now();

insert into public.digital_observer_extraction_timeline_estimates (workstream, estimated_days, complexity, dependencies, rollback_complexity, status, notes)
values
  ('monorepo restructure', 8, 'medium', '["shared package map","route audit"]'::jsonb, 'medium', 'planned', 'Create apps/gan-batuach and apps/digital-observer later.'),
  ('shared package extraction', 14, 'high', '["core readiness","tests"]'::jsonb, 'high', 'planned', 'Extract observer/camera/audit/notification packages gradually.'),
  ('Vercel project creation', 3, 'low', '["domain plan","env split"]'::jsonb, 'low', 'ready_for_review', 'No real project in this phase.'),
  ('Supabase project creation', 5, 'high', '["data migration rehearsal","RLS audit"]'::jsonb, 'high', 'future_phase', 'Do after paid beta and dry run.'),
  ('data migration', 12, 'high', '["table map","storage split","auth strategy"]'::jsonb, 'high', 'future_phase', 'No data movement now.'),
  ('DNS/domain setup', 2, 'low', '["Vercel project","SSL"]'::jsonb, 'low', 'ready_for_review', 'Start with observer.gan-batuach.co.il.'),
  ('QA', 7, 'medium', '["staging deploy","test users"]'::jsonb, 'medium', 'planned', 'Verify both products independently.'),
  ('rollback', 2, 'medium', '["route fallback","shared DB retained"]'::jsonb, 'low', 'planned', 'Fallback to /digital-observer.')
on conflict (workstream) do update set
  estimated_days = excluded.estimated_days,
  complexity = excluded.complexity,
  dependencies = excluded.dependencies,
  rollback_complexity = excluded.rollback_complexity,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

insert into public.digital_observer_rollback_plans (rollback_key, rollback_step, trigger_condition, action_required, preserves_customers, preserves_billing, preserves_data, owner, status)
values
  ('domain_rollback', 'Keep /digital-observer active', 'New domain route fails or conversion drops', 'Route traffic back to current path.', true, true, true, 'platform', 'planned'),
  ('domain_rollback', 'Disable new domain route', 'DNS, SSL or app host issue', 'Remove host-based redirect and keep existing app.', true, true, true, 'platform', 'planned'),
  ('supabase_rollback', 'Keep data in original Supabase', 'Migration validation fails', 'Stop cutover and continue shared project.', true, true, true, 'data', 'planned'),
  ('app_rollback', 'Revert app routing', 'Separate Vercel deploy fails', 'Point domain back to current project and route.', true, true, true, 'platform', 'planned'),
  ('billing_rollback', 'Preserve Digital Observer subscriptions', 'Provider split fails', 'Keep current billing records and block live charge changes.', true, true, true, 'finance', 'planned')
on conflict (rollback_key, rollback_step) do update set
  trigger_condition = excluded.trigger_condition,
  action_required = excluded.action_required,
  preserves_customers = excluded.preserves_customers,
  preserves_billing = excluded.preserves_billing,
  preserves_data = excluded.preserves_data,
  owner = excluded.owner,
  status = excluded.status,
  updated_at = now();

insert into public.digital_observer_separation_decisions (
  decision_state,
  separation_readiness_score,
  paid_beta_validation_status,
  product_readiness_score,
  revenue_readiness_score,
  technical_readiness_score,
  data_separation_readiness_score,
  vercel_readiness_score,
  supabase_readiness_score,
  github_readiness_score,
  domain_readiness_score,
  support_load_status,
  billing_separation_status,
  legal_readiness_status,
  final_recommendation,
  reason,
  blockers,
  next_phase_recommendation,
  metadata
)
select
  'keep_inside_gan_batuach',
  54,
  'not_validated',
  62,
  35,
  66,
  58,
  70,
  45,
  72,
  76,
  'unknown_until_paid_beta_data',
  'separated_by_model_needs_real_revenue_evidence',
  'needs_external_review',
  'Do not fully separate yet. Keep Digital Observer inside Gan Batuach, validate paid beta, then prepare monorepo and separate Vercel as the next safe step.',
  'Paid beta is not yet validated, legal documents are still drafts, and Supabase/auth/data migration risks are high.',
  '["paid beta not validated","legal review pending","Supabase split not rehearsed","camera gateway isolation not proven","support load unknown"]'::jsonb,
  'PHASE 183 should focus on paid beta evidence collection and monorepo boundary hardening before any real infrastructure split.',
  '{"phase":182,"no_real_split":true}'::jsonb
where not exists (select 1 from public.digital_observer_separation_decisions);

comment on table public.digital_observer_separation_decisions is 'Digital Observer infrastructure extraction go/no-go decisions. This phase does not create repos, projects, or move data.';
comment on table public.digital_observer_data_boundary_map is 'Data boundary map for Gan Batuach-only, Digital Observer-only and shared core areas.';
comment on table public.digital_observer_extraction_risks is 'Risk register for future Digital Observer infrastructure extraction.';
comment on table public.digital_observer_extraction_cost_estimates is 'Cost estimate scenarios for keeping inside Gan Batuach, separate Vercel, separate Supabase and full repo split.';
comment on table public.digital_observer_rollback_plans is 'Rollback plan if future extraction fails; preserve customers, billing and data.';
