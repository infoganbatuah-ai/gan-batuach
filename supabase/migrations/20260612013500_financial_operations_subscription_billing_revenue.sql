-- PHASE 135: Financial operations, subscription billing and revenue platform.
-- Extends the existing subscription billing foundation without storing raw card data.

alter table public.subscription_plans
  add column if not exists monthly_price numeric(12,2),
  add column if not exists annual_price numeric(12,2),
  add column if not exists features jsonb not null default '{}'::jsonb,
  add column if not exists limits jsonb not null default '{}'::jsonb,
  add column if not exists active_status text not null default 'active',
  add column if not exists plan_category text not null default 'standard',
  add column if not exists billing_cycle_options text[] not null default array['annual']::text[],
  add column if not exists public_purchase_enabled boolean not null default false,
  add column if not exists enterprise_contact_required boolean not null default false,
  add column if not exists promotional_until date;

alter table public.subscription_plans
  drop constraint if exists subscription_plans_active_status_check;

alter table public.subscription_plans
  add constraint subscription_plans_active_status_check check (active_status in ('active','inactive','archived'));

alter table public.subscription_plans
  drop constraint if exists subscription_plans_plan_category_check;

alter table public.subscription_plans
  add constraint subscription_plans_plan_category_check check (plan_category in ('standard','pilot','promotional','enterprise'));

update public.subscription_plans
set
  monthly_price = coalesce(monthly_price, case when plan_type::text in ('monthly','trial') then price_amount else null end, price_amount),
  annual_price = coalesce(annual_price, case when plan_type::text = 'annual' then price_amount else null end, price_amount * 12),
  features = case when features = '{}'::jsonb then coalesce(enabled_features, '{}'::jsonb) else features end,
  limits = limits || jsonb_strip_nulls(jsonb_build_object(
    'active_users_limit', active_users_limit,
    'active_children_limit', active_children_limit,
    'camera_limit', camera_limit,
    'storage_limit_mb', storage_limit_mb
  )),
  active_status = case when active then 'active' else 'inactive' end,
  billing_cycle_options = case
    when plan_type::text = 'annual' then array['annual']::text[]
    when plan_type::text = 'enterprise' then array['annual','custom']::text[]
    when plan_type::text = 'trial' then array['annual']::text[]
    else array['annual']::text[]
  end,
  public_purchase_enabled = case when plan_type::text in ('annual','trial') and active then true else false end,
  enterprise_contact_required = case when plan_type::text = 'enterprise' then true else enterprise_contact_required end,
  updated_at = now();

update public.subscription_plans
set
  active = false,
  active_status = 'inactive',
  public_purchase_enabled = false,
  billing_cycle_options = array['annual']::text[],
  updated_at = now()
where plan_type::text = 'monthly';

alter table public.kindergarten_subscriptions
  add column if not exists billing_status text not null default 'not_configured',
  add column if not exists payment_method text,
  add column if not exists billing_cycle text not null default 'annual',
  add column if not exists current_period_start date,
  add column if not exists current_period_end date,
  add column if not exists auto_renew boolean not null default true,
  add column if not exists trial_conversion_status text not null default 'not_applicable',
  add column if not exists cancellation_reason text,
  add column if not exists last_payment_at timestamptz,
  add column if not exists next_payment_attempt_at timestamptz,
  add column if not exists payment_failure_count integer not null default 0;

alter table public.kindergarten_subscriptions
  drop constraint if exists kindergarten_subscriptions_billing_status_check;

alter table public.kindergarten_subscriptions
  add constraint kindergarten_subscriptions_billing_status_check check (billing_status in ('not_configured','trial','active','pending_payment','past_due','failed','cancelled','suspended','manual_review'));

alter table public.kindergarten_subscriptions
  drop constraint if exists kindergarten_subscriptions_billing_cycle_check;

update public.kindergarten_subscriptions
set billing_cycle = 'annual'
where coalesce(billing_cycle, '') in ('', 'monthly');

alter table public.kindergarten_subscriptions
  add constraint kindergarten_subscriptions_billing_cycle_check check (billing_cycle in ('annual','custom'));

alter table public.kindergarten_subscriptions
  drop constraint if exists kindergarten_subscriptions_trial_conversion_check;

alter table public.kindergarten_subscriptions
  add constraint kindergarten_subscriptions_trial_conversion_check check (trial_conversion_status in ('not_applicable','trial_active','conversion_due','converted','expired','lost'));

update public.kindergarten_subscriptions
set
  billing_status = case
    when status::text = 'active' then 'active'
    when status::text = 'trial' then 'trial'
    when status::text = 'pending_payment' then 'pending_payment'
    when status::text = 'suspended' then 'suspended'
    when status::text = 'cancelled' then 'cancelled'
    when status::text = 'expired' then 'past_due'
    else billing_status
  end,
  billing_cycle = 'annual',
  current_period_start = coalesce(current_period_start, start_date),
  current_period_end = coalesce(current_period_end, renewal_date, expires_at::date, trial_ends_at::date),
  trial_conversion_status = case when status::text = 'trial' then 'trial_active' else trial_conversion_status end,
  updated_at = now();

alter table public.kindergarten_fee_groups
  add column if not exists annual_fee numeric(12,2),
  add column if not exists enrollment_fee numeric(12,2) not null default 0,
  add column if not exists activity_fee numeric(12,2) not null default 0,
  add column if not exists parent_billing_cycle text not null default 'monthly',
  add column if not exists payment_approval_required boolean not null default true;

alter table public.kindergarten_fee_groups
  drop constraint if exists kindergarten_fee_groups_parent_billing_cycle_check;

alter table public.kindergarten_fee_groups
  add constraint kindergarten_fee_groups_parent_billing_cycle_check check (parent_billing_cycle in ('monthly','annual'));

update public.kindergarten_fee_groups
set annual_fee = coalesce(annual_fee, monthly_fee * 12)
where annual_fee is null;

alter table public.child_payment_history
  add column if not exists revenue_stream text not null default 'parent_tuition',
  add column if not exists provider_transaction_reference text,
  add column if not exists payout_destination_key text,
  add column if not exists routed_to_garden boolean not null default true,
  add column if not exists invoice_url text,
  add column if not exists receipt_url text;

alter table public.child_payment_history
  drop constraint if exists child_payment_history_revenue_stream_check;

alter table public.child_payment_history
  add constraint child_payment_history_revenue_stream_check check (revenue_stream in ('parent_tuition','enrollment_fee','activity_fee','other_kindergarten_income'));

alter table public.subscription_payments
  add column if not exists payment_gateway_key text,
  add column if not exists gateway_status text not null default 'not_sent',
  add column if not exists retry_count integer not null default 0,
  add column if not exists next_retry_at timestamptz,
  add column if not exists token_reference text,
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists wallet_type text,
  add column if not exists processor_fee_amount numeric(12,2) not null default 0,
  add column if not exists net_amount numeric(12,2);

alter table public.subscription_payments
  drop constraint if exists subscription_payments_gateway_status_check;

alter table public.subscription_payments
  add constraint subscription_payments_gateway_status_check check (gateway_status in ('not_sent','queued','authorized','captured','failed','retry_scheduled','refunded','cancelled'));

alter table public.billing_invoices
  add column if not exists invoice_type text not null default 'invoice',
  add column if not exists pdf_url text,
  add column if not exists emailed_at timestamptz,
  add column if not exists email_status text not null default 'not_sent',
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists subtotal_amount numeric(12,2),
  add column if not exists company_billing_settings_id uuid,
  add column if not exists accounting_export_status text not null default 'not_exported';

alter table public.billing_invoices
  drop constraint if exists billing_invoices_invoice_type_check;

alter table public.billing_invoices
  add constraint billing_invoices_invoice_type_check check (invoice_type in ('invoice','tax_invoice','receipt_invoice','credit_note','proforma'));

alter table public.billing_invoices
  drop constraint if exists billing_invoices_email_status_check;

alter table public.billing_invoices
  add constraint billing_invoices_email_status_check check (email_status in ('not_sent','queued','sent','failed','disabled'));

alter table public.billing_invoices
  drop constraint if exists billing_invoices_accounting_export_status_check;

alter table public.billing_invoices
  add constraint billing_invoices_accounting_export_status_check check (accounting_export_status in ('not_exported','queued','exported','failed'));

create table if not exists public.company_billing_settings (
  id uuid primary key default gen_random_uuid(),
  settings_key text not null unique default 'default',
  company_name text not null,
  vat_number text,
  billing_email text,
  support_email text,
  support_phone text,
  invoice_footer text,
  default_currency text not null default 'ILS',
  vat_rate numeric(5,2) not null default 17,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_billing_status_check check (status in ('draft','ready','needs_review','disabled'))
);

create table if not exists public.payment_gateway_readiness (
  id uuid primary key default gen_random_uuid(),
  gateway_key text not null unique,
  provider_name text not null,
  provider_type text not null,
  status text not null default 'not_configured',
  environment text not null default 'test',
  supports_recurring boolean not null default false,
  supports_tokenized_cards boolean not null default false,
  supports_apple_pay boolean not null default false,
  supports_google_pay boolean not null default false,
  supports_refunds boolean not null default false,
  supports_invoice_webhook boolean not null default false,
  secret_config_ref text,
  public_config jsonb not null default '{}'::jsonb,
  last_test_at timestamptz,
  last_test_status text,
  notes text,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_gateway_provider_type_check check (provider_type in ('credit_card_gateway','digital_wallet','manual','future')),
  constraint payment_gateway_status_check check (status in ('not_configured','configured','test_mode','production_ready','active','disabled','failed')),
  constraint payment_gateway_environment_check check (environment in ('test','production','sandbox','manual'))
);

create table if not exists public.payment_method_tokens (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid references public.gardens(id) on delete cascade,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  gateway_key text not null,
  token_reference text not null,
  payment_method_type text not null default 'card',
  display_label text,
  card_brand text,
  card_last4 text,
  exp_month integer,
  exp_year integer,
  wallet_type text,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint payment_method_type_check check (payment_method_type in ('card','apple_pay','google_pay','bank_transfer','manual')),
  constraint payment_method_status_check check (status in ('active','expired','removed','failed','pending_verification')),
  unique(gateway_key, token_reference)
);

create table if not exists public.subscription_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  session_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  plan_id uuid references public.subscription_plans(id) on delete set null,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete set null,
  gateway_key text,
  billing_cycle text not null default 'annual',
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  status text not null default 'draft',
  checkout_url text,
  success_url text,
  cancel_url text,
  expires_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkout_billing_cycle_check check (billing_cycle in ('annual','custom')),
  constraint checkout_session_status_check check (status in ('draft','pending_payment','completed','expired','cancelled','failed'))
);

update public.subscription_checkout_sessions
set billing_cycle = 'annual'
where coalesce(billing_cycle, '') in ('', 'monthly');

alter table public.subscription_checkout_sessions
  drop constraint if exists checkout_billing_cycle_check;

alter table public.subscription_checkout_sessions
  add constraint checkout_billing_cycle_check check (billing_cycle in ('annual','custom'));

create table if not exists public.payment_retry_attempts (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.subscription_payments(id) on delete cascade,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  garden_id uuid references public.gardens(id) on delete cascade,
  attempt_number integer not null default 1,
  status text not null default 'scheduled',
  scheduled_for timestamptz not null default now(),
  attempted_at timestamptz,
  failure_reason text,
  next_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_retry_status_check check (status in ('scheduled','running','succeeded','failed','cancelled','manual_review'))
);

create table if not exists public.invoice_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  payment_id uuid references public.subscription_payments(id) on delete set null,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete cascade,
  status text not null default 'queued',
  pdf_status text not null default 'not_started',
  email_status text not null default 'not_sent',
  error_message text,
  scheduled_for timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_job_status_check check (status in ('queued','running','completed','failed','cancelled')),
  constraint invoice_job_pdf_status_check check (pdf_status in ('not_started','generated','failed','not_required')),
  constraint invoice_job_email_status_check check (email_status in ('not_sent','queued','sent','failed','disabled'))
);

create table if not exists public.billing_notifications (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  payment_id uuid references public.subscription_payments(id) on delete set null,
  notification_type text not null,
  channel text not null default 'in_app',
  status text not null default 'queued',
  title text not null,
  message text not null,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_notification_type_check check (notification_type in ('payment_success','payment_failed','renewal_upcoming','invoice_generated','subscription_cancelled','trial_expiring','refund_issued')),
  constraint billing_notification_channel_check check (channel in ('in_app','email','sms','whatsapp','push')),
  constraint billing_notification_status_check check (status in ('queued','sent','failed','cancelled','mock_sent'))
);

create table if not exists public.financial_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_key text,
  event_type text not null,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  garden_id uuid references public.gardens(id) on delete set null,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete set null,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  payment_id uuid references public.subscription_payments(id) on delete set null,
  severity text not null default 'medium',
  title text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint financial_audit_event_type_check check (event_type in ('subscription_created','plan_changed','invoice_generated','payment_received','payment_failed','refund_issued','credit_note_created','subscription_cancelled','billing_settings_changed','gateway_status_changed','payout_configuration_changed','parent_payment_authorized','parent_payment_received','parent_payment_failed','discount_applied','subscription_suspended','subscription_reactivated')),
  constraint financial_audit_severity_check check (severity in ('low','medium','high','critical'))
);

alter table public.financial_audit_events
  drop constraint if exists financial_audit_event_type_check;

alter table public.financial_audit_events
  add constraint financial_audit_event_type_check check (event_type in ('subscription_created','plan_changed','invoice_generated','payment_received','payment_failed','refund_issued','credit_note_created','subscription_cancelled','billing_settings_changed','gateway_status_changed','payout_configuration_changed','parent_payment_authorized','parent_payment_received','parent_payment_failed','discount_applied','subscription_suspended','subscription_reactivated'));

create table if not exists public.billing_refund_credit_notes (
  id uuid primary key default gen_random_uuid(),
  refund_key text not null unique,
  garden_id uuid references public.gardens(id) on delete cascade,
  subscription_id uuid references public.kindergarten_subscriptions(id) on delete cascade,
  payment_id uuid references public.subscription_payments(id) on delete set null,
  invoice_id uuid references public.billing_invoices(id) on delete set null,
  credit_invoice_id uuid references public.billing_invoices(id) on delete set null,
  refund_type text not null default 'refund',
  status text not null default 'draft',
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  reason text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  processed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint refund_type_check check (refund_type in ('refund','partial_refund','credit','adjustment')),
  constraint refund_status_check check (status in ('draft','pending_approval','approved','processed','rejected','cancelled'))
);

create table if not exists public.billing_network_accounts (
  id uuid primary key default gen_random_uuid(),
  account_key text not null unique,
  account_name text not null,
  billing_contact_name text,
  billing_contact_email text,
  centralized_invoicing boolean not null default true,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_network_status_check check (status in ('active','paused','archived'))
);

create table if not exists public.billing_network_gardens (
  id uuid primary key default gen_random_uuid(),
  network_account_id uuid not null references public.billing_network_accounts(id) on delete cascade,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  billing_role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(network_account_id, garden_id),
  constraint billing_network_garden_role_check check (billing_role in ('primary','member','trial'))
);

create table if not exists public.revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  period text not null default 'monthly',
  mrr numeric(12,2) not null default 0,
  arr numeric(12,2) not null default 0,
  active_customers integer not null default 0,
  trial_customers integer not null default 0,
  churned_customers integer not null default 0,
  failed_payment_count integer not null default 0,
  renewal_count integer not null default 0,
  collection_rate numeric(5,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(snapshot_date, period),
  constraint revenue_snapshot_period_check check (period in ('daily','weekly','monthly','quarterly','annual'))
);

create table if not exists public.accounting_export_batches (
  id uuid primary key default gen_random_uuid(),
  batch_key text not null unique,
  export_type text not null,
  status text not null default 'queued',
  period_start date,
  period_end date,
  invoice_count integer not null default 0,
  payment_count integer not null default 0,
  total_amount numeric(12,2) not null default 0,
  file_url text,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint accounting_export_type_check check (export_type in ('invoices','payments','receipts','refunds','full_bookkeeping')),
  constraint accounting_export_status_check check (status in ('queued','running','completed','failed','cancelled'))
);

create table if not exists public.financial_ai_insights (
  id uuid primary key default gen_random_uuid(),
  insight_key text not null unique,
  insight_type text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  title text not null,
  explanation text not null,
  recommended_action text,
  metric_value numeric(12,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_ai_insight_type_check check (insight_type in ('revenue_trend','churn_risk','renewal_forecast','payment_failure_analysis','collection_risk')),
  constraint financial_ai_insight_severity_check check (severity in ('low','medium','high','critical')),
  constraint financial_ai_insight_status_check check (status in ('open','reviewing','resolved','dismissed'))
);

create table if not exists public.kindergarten_payout_configurations (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id) on delete cascade,
  destination_key text not null unique,
  destination_type text not null default 'payment_provider',
  provider text not null default 'manual_bank',
  status text not null default 'not_configured',
  account_holder_name text,
  bank_name text,
  bank_branch text,
  bank_account_last4 text,
  provider_account_reference text,
  billing_email text,
  default_currency text not null default 'ILS',
  receives_parent_payments boolean not null default true,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  last_changed_by uuid references public.profiles(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kindergarten_payout_destination_type_check check (destination_type in ('bank_account','payment_provider')),
  constraint kindergarten_payout_provider_check check (provider in ('manual_bank','meshulam','tranzila','cardcom','pelecard','future_provider')),
  constraint kindergarten_payout_status_check check (status in ('not_configured','pending_verification','verified','needs_update','disabled'))
);

create table if not exists public.parent_payment_authorizations (
  id uuid primary key default gen_random_uuid(),
  authorization_key text not null unique,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete cascade,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  fee_group_id uuid references public.kindergarten_fee_groups(id) on delete set null,
  payout_configuration_id uuid references public.kindergarten_payout_configurations(id) on delete set null,
  billing_cycle text not null default 'monthly',
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  status text not null default 'pending_parent_approval',
  payment_method_type text,
  token_reference text,
  provider text,
  approved_at timestamptz,
  cancelled_at timestamptz,
  next_billing_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_payment_authorization_cycle_check check (billing_cycle in ('monthly','annual')),
  constraint parent_payment_authorization_status_check check (status in ('pending_parent_approval','approved','active','paused','cancelled','expired','failed')),
  constraint parent_payment_authorization_method_check check (payment_method_type is null or payment_method_type in ('card','apple_pay','google_pay','bank_transfer','manual'))
);

create table if not exists public.parent_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_key text not null unique,
  garden_id uuid not null references public.gardens(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  parent_profile_id uuid references public.profiles(id) on delete set null,
  authorization_id uuid references public.parent_payment_authorizations(id) on delete set null,
  payout_configuration_id uuid references public.kindergarten_payout_configurations(id) on delete set null,
  revenue_stream text not null default 'parent_tuition',
  billing_cycle text not null default 'monthly',
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  provider text not null default 'manual',
  provider_transaction_reference text,
  status text not null default 'pending',
  routed_directly_to_kindergarten boolean not null default true,
  platform_fee_amount numeric(12,2) not null default 0,
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  invoice_url text,
  receipt_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parent_payment_transaction_stream_check check (revenue_stream in ('parent_tuition','enrollment_fee','activity_fee','other_kindergarten_income')),
  constraint parent_payment_transaction_cycle_check check (billing_cycle in ('monthly','annual')),
  constraint parent_payment_transaction_status_check check (status in ('pending','authorized','paid','failed','refunded','cancelled','requires_action')),
  constraint parent_payment_direct_routing_check check (routed_directly_to_kindergarten = true and platform_fee_amount = 0)
);

create table if not exists public.subscription_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type text not null default 'percentage',
  discount_value numeric(12,2) not null default 0,
  free_months integer not null default 0,
  status text not null default 'active',
  valid_from date,
  valid_until date,
  max_redemptions integer,
  redemption_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_discount_type_check check (discount_type in ('percentage','fixed','free_months','enterprise_price')),
  constraint subscription_discount_status_check check (status in ('active','paused','expired','archived'))
);

create table if not exists public.revenue_separation_ledger (
  id uuid primary key default gen_random_uuid(),
  ledger_key text not null unique,
  revenue_type text not null,
  source_table text not null,
  source_id uuid,
  garden_id uuid references public.gardens(id) on delete set null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  destination_account_type text not null,
  destination_label text,
  status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint revenue_separation_type_check check (revenue_type in ('gan_batuach_subscription','parent_tuition')),
  constraint revenue_separation_destination_check check (
    (revenue_type = 'gan_batuach_subscription' and destination_account_type = 'gan_batuach_company')
    or
    (revenue_type = 'parent_tuition' and destination_account_type = 'kindergarten_account')
  ),
  constraint revenue_separation_status_check check (status in ('recorded','reconciled','needs_review','void'))
);

create index if not exists kindergarten_subscriptions_billing_status_idx on public.kindergarten_subscriptions(billing_status, renewal_date);
create index if not exists subscription_payments_gateway_status_idx on public.subscription_payments(gateway_status, billing_status, created_at desc);
create index if not exists billing_invoices_email_status_idx on public.billing_invoices(email_status, billing_status, issued_at desc);
create index if not exists payment_gateway_readiness_status_idx on public.payment_gateway_readiness(status, provider_type);
create index if not exists payment_method_tokens_garden_idx on public.payment_method_tokens(garden_id, status);
create index if not exists checkout_sessions_garden_idx on public.subscription_checkout_sessions(garden_id, status, created_at desc);
create index if not exists payment_retry_attempts_status_idx on public.payment_retry_attempts(status, scheduled_for);
create index if not exists invoice_generation_jobs_status_idx on public.invoice_generation_jobs(status, scheduled_for);
create index if not exists billing_notifications_status_idx on public.billing_notifications(status, scheduled_for);
create index if not exists financial_audit_events_type_idx on public.financial_audit_events(event_type, created_at desc);
create index if not exists refund_credit_notes_status_idx on public.billing_refund_credit_notes(status, created_at desc);
create index if not exists revenue_snapshots_period_idx on public.revenue_snapshots(period, snapshot_date desc);
create index if not exists financial_ai_insights_status_idx on public.financial_ai_insights(status, severity, created_at desc);
create index if not exists kindergarten_payout_configurations_garden_idx on public.kindergarten_payout_configurations(garden_id, status);
create index if not exists parent_payment_authorizations_garden_idx on public.parent_payment_authorizations(garden_id, status, next_billing_date);
create index if not exists parent_payment_transactions_garden_idx on public.parent_payment_transactions(garden_id, status, created_at desc);
create index if not exists subscription_discount_codes_status_idx on public.subscription_discount_codes(status, valid_until);
create index if not exists revenue_separation_ledger_type_idx on public.revenue_separation_ledger(revenue_type, created_at desc);

alter table public.company_billing_settings enable row level security;
alter table public.payment_gateway_readiness enable row level security;
alter table public.payment_method_tokens enable row level security;
alter table public.subscription_checkout_sessions enable row level security;
alter table public.payment_retry_attempts enable row level security;
alter table public.invoice_generation_jobs enable row level security;
alter table public.billing_notifications enable row level security;
alter table public.financial_audit_events enable row level security;
alter table public.billing_refund_credit_notes enable row level security;
alter table public.billing_network_accounts enable row level security;
alter table public.billing_network_gardens enable row level security;
alter table public.revenue_snapshots enable row level security;
alter table public.accounting_export_batches enable row level security;
alter table public.financial_ai_insights enable row level security;
alter table public.kindergarten_payout_configurations enable row level security;
alter table public.parent_payment_authorizations enable row level security;
alter table public.parent_payment_transactions enable row level security;
alter table public.subscription_discount_codes enable row level security;
alter table public.revenue_separation_ledger enable row level security;

drop policy if exists "company billing settings admin only" on public.company_billing_settings;
create policy "company billing settings admin only" on public.company_billing_settings for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payment gateway readiness admin only" on public.payment_gateway_readiness;
create policy "payment gateway readiness admin only" on public.payment_gateway_readiness for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payment method tokens scoped read" on public.payment_method_tokens;
create policy "payment method tokens scoped read" on public.payment_method_tokens for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "payment method tokens admin write" on public.payment_method_tokens;
create policy "payment method tokens admin write" on public.payment_method_tokens for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "checkout sessions scoped read" on public.subscription_checkout_sessions;
create policy "checkout sessions scoped read" on public.subscription_checkout_sessions for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "checkout sessions scoped insert" on public.subscription_checkout_sessions;
create policy "checkout sessions scoped insert" on public.subscription_checkout_sessions for insert with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "checkout sessions admin update" on public.subscription_checkout_sessions;
create policy "checkout sessions admin update" on public.subscription_checkout_sessions for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "payment retry attempts scoped read" on public.payment_retry_attempts;
create policy "payment retry attempts scoped read" on public.payment_retry_attempts for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "payment retry attempts admin write" on public.payment_retry_attempts;
create policy "payment retry attempts admin write" on public.payment_retry_attempts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "invoice generation jobs scoped read" on public.invoice_generation_jobs;
create policy "invoice generation jobs scoped read" on public.invoice_generation_jobs for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "invoice generation jobs admin write" on public.invoice_generation_jobs;
create policy "invoice generation jobs admin write" on public.invoice_generation_jobs for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "billing notifications scoped read" on public.billing_notifications;
create policy "billing notifications scoped read" on public.billing_notifications for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "billing notifications admin write" on public.billing_notifications;
create policy "billing notifications admin write" on public.billing_notifications for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "financial audit events admin read" on public.financial_audit_events;
create policy "financial audit events admin read" on public.financial_audit_events for select using (public.is_admin());

drop policy if exists "financial audit events append only" on public.financial_audit_events;
create policy "financial audit events append only" on public.financial_audit_events for insert with check (public.is_admin());

drop policy if exists "refund credit notes scoped read" on public.billing_refund_credit_notes;
create policy "refund credit notes scoped read" on public.billing_refund_credit_notes for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "refund credit notes admin write" on public.billing_refund_credit_notes;
create policy "refund credit notes admin write" on public.billing_refund_credit_notes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "billing network accounts admin only" on public.billing_network_accounts;
create policy "billing network accounts admin only" on public.billing_network_accounts for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "billing network gardens admin only" on public.billing_network_gardens;
create policy "billing network gardens admin only" on public.billing_network_gardens for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "revenue snapshots admin only" on public.revenue_snapshots;
create policy "revenue snapshots admin only" on public.revenue_snapshots for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "accounting exports admin only" on public.accounting_export_batches;
create policy "accounting exports admin only" on public.accounting_export_batches for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "financial ai insights admin only" on public.financial_ai_insights;
create policy "financial ai insights admin only" on public.financial_ai_insights for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "kindergarten payout scoped read" on public.kindergarten_payout_configurations;
create policy "kindergarten payout scoped read" on public.kindergarten_payout_configurations for select using (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "kindergarten payout manager write" on public.kindergarten_payout_configurations;
create policy "kindergarten payout manager write" on public.kindergarten_payout_configurations for all using (public.is_admin() or public.can_access_garden(garden_id)) with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "parent payment authorizations scoped read" on public.parent_payment_authorizations;
create policy "parent payment authorizations scoped read" on public.parent_payment_authorizations for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or parent_profile_id = auth.uid()
);

drop policy if exists "parent payment authorizations scoped write" on public.parent_payment_authorizations;
create policy "parent payment authorizations scoped write" on public.parent_payment_authorizations for all using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or parent_profile_id = auth.uid()
) with check (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or parent_profile_id = auth.uid()
);

drop policy if exists "parent payment transactions scoped read" on public.parent_payment_transactions;
create policy "parent payment transactions scoped read" on public.parent_payment_transactions for select using (
  public.is_admin()
  or public.can_access_garden(garden_id)
  or parent_profile_id = auth.uid()
);

drop policy if exists "parent payment transactions service write" on public.parent_payment_transactions;
create policy "parent payment transactions service write" on public.parent_payment_transactions for insert with check (public.is_admin() or public.can_access_garden(garden_id));

drop policy if exists "subscription discount codes admin only" on public.subscription_discount_codes;
create policy "subscription discount codes admin only" on public.subscription_discount_codes for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "revenue separation ledger admin read" on public.revenue_separation_ledger;
create policy "revenue separation ledger admin read" on public.revenue_separation_ledger for select using (public.is_admin());

drop policy if exists "revenue separation ledger append" on public.revenue_separation_ledger;
create policy "revenue separation ledger append" on public.revenue_separation_ledger for insert with check (public.is_admin());

insert into public.company_billing_settings (settings_key, company_name, vat_number, billing_email, support_email, support_phone, invoice_footer, status)
values ('default', 'Gan Batuach', null, 'billing@ganbatuach.local', 'support@ganbatuach.local', null, 'תודה שבחרתם בגן בטוח.', 'needs_review')
on conflict (settings_key)
do update set
  company_name = excluded.company_name,
  billing_email = excluded.billing_email,
  support_email = excluded.support_email,
  invoice_footer = excluded.invoice_footer,
  updated_at = now();

insert into public.payment_gateway_readiness (
  gateway_key,
  provider_name,
  provider_type,
  status,
  environment,
  supports_recurring,
  supports_tokenized_cards,
  supports_apple_pay,
  supports_google_pay,
  supports_refunds,
  supports_invoice_webhook,
  secret_config_ref,
  notes
)
values
  ('manual', 'Manual Billing', 'manual', 'active', 'manual', false, false, false, false, true, false, null, 'Manual billing remains available for pilots and special cases.'),
  ('tranzila', 'Tranzila', 'credit_card_gateway', 'not_configured', 'test', true, true, true, true, true, true, 'TRANZILA_*', 'Israeli gateway readiness. Secrets stay in server env.'),
  ('meshulam', 'Meshulam', 'credit_card_gateway', 'not_configured', 'test', true, true, true, true, true, true, 'MESHULAM_*', 'Israeli gateway readiness.'),
  ('cardcom', 'Cardcom', 'credit_card_gateway', 'not_configured', 'test', true, true, true, true, true, true, 'CARDCOM_*', 'Israeli gateway readiness.'),
  ('pelecard', 'Pelecard', 'credit_card_gateway', 'not_configured', 'test', true, true, true, true, true, true, 'PELECARD_*', 'Israeli gateway readiness.'),
  ('stripe', 'Stripe', 'credit_card_gateway', 'not_configured', 'test', true, true, true, true, true, true, 'STRIPE_*', 'Future international provider readiness.'),
  ('apple-pay', 'Apple Pay', 'digital_wallet', 'not_configured', 'test', true, true, true, false, true, false, 'APPLE_PAY_*', 'Wallet readiness only; recurring support depends on chosen gateway.'),
  ('google-pay', 'Google Pay', 'digital_wallet', 'not_configured', 'test', true, true, false, true, true, false, 'GOOGLE_PAY_*', 'Wallet readiness only; recurring support depends on chosen gateway.')
on conflict (gateway_key)
do update set
  provider_name = excluded.provider_name,
  provider_type = excluded.provider_type,
  supports_recurring = excluded.supports_recurring,
  supports_tokenized_cards = excluded.supports_tokenized_cards,
  supports_apple_pay = excluded.supports_apple_pay,
  supports_google_pay = excluded.supports_google_pay,
  supports_refunds = excluded.supports_refunds,
  supports_invoice_webhook = excluded.supports_invoice_webhook,
  secret_config_ref = excluded.secret_config_ref,
  notes = excluded.notes,
  updated_at = now();

insert into public.subscription_plans (
  name,
  description,
  plan_type,
  price_amount,
  monthly_price,
  annual_price,
  currency,
  duration_days,
  trial_days,
  enabled_features,
  features,
  limits,
  active,
  active_status,
  plan_category,
  billing_cycle_options,
  public_purchase_enabled,
  enterprise_contact_required,
  sort_order
)
select
  'Gan Batuach Monthly',
  'מסלול ישן שאינו זמין לרכישה. מנוי גן בטוח מופעל שנתית בלבד.',
  'monthly',
  700,
  700,
  7560,
  'ILS',
  30,
  0,
  '{"core_dashboard":true,"communications":true,"documents":true,"cameras":true,"digital_observer_included":true}'::jsonb,
  '{"core_dashboard":true,"communications":true,"documents":true,"cameras":true,"digital_observer_included":true}'::jsonb,
  '{"gardens":1}'::jsonb,
  false,
  'inactive',
  'standard',
  array['annual']::text[],
  false,
  false,
  10
where not exists (select 1 from public.subscription_plans where name = 'Gan Batuach Monthly');

insert into public.subscription_plans (
  name, description, plan_type, price_amount, monthly_price, annual_price, currency, duration_days, trial_days,
  enabled_features, features, limits, active, active_status, plan_category, billing_cycle_options, public_purchase_enabled, enterprise_contact_required, sort_order
)
select
  'Gan Batuach Annual',
  'חבילה שנתית עם תשלום מראש והנחת התחייבות.',
  'annual',
  7560,
  630,
  7560,
  'ILS',
  365,
  0,
  '{"core_dashboard":true,"communications":true,"documents":true,"cameras":true,"digital_observer_included":true,"annual_discount":true}'::jsonb,
  '{"core_dashboard":true,"communications":true,"documents":true,"cameras":true,"digital_observer_included":true,"annual_discount":true}'::jsonb,
  '{"gardens":1}'::jsonb,
  true,
  'active',
  'standard',
  array['annual']::text[],
  true,
  false,
  20
where not exists (select 1 from public.subscription_plans where name = 'Gan Batuach Annual');

insert into public.subscription_plans (
  name, description, plan_type, price_amount, monthly_price, annual_price, currency, duration_days, trial_days,
  enabled_features, features, limits, active, active_status, plan_category, billing_cycle_options, public_purchase_enabled, enterprise_contact_required, sort_order
)
select
  'Pilot Trial',
  'מסלול פיילוט מוגבל בזמן לפני מעבר לתשלום.',
  'trial',
  0,
  0,
  0,
  'ILS',
  30,
  30,
  '{"core_dashboard":true,"onboarding":true,"support":true}'::jsonb,
  '{"core_dashboard":true,"onboarding":true,"support":true}'::jsonb,
  '{"gardens":1,"trial_days":30}'::jsonb,
  true,
  'active',
  'pilot',
  array['annual']::text[],
  true,
  false,
  5
where not exists (select 1 from public.subscription_plans where name = 'Pilot Trial');

insert into public.subscription_plans (
  name, description, plan_type, price_amount, monthly_price, annual_price, currency, duration_days, trial_days,
  enabled_features, features, limits, active, active_status, plan_category, billing_cycle_options, public_purchase_enabled, enterprise_contact_required, sort_order
)
select
  'Network Enterprise',
  'מסלול רשת גנים עם חשבונית מרכזית ותמחור מותאם.',
  'enterprise',
  0,
  0,
  0,
  'ILS',
  null,
  0,
  '{"multi_garden_network":true,"centralized_invoicing":true,"priority_support":true}'::jsonb,
  '{"multi_garden_network":true,"centralized_invoicing":true,"priority_support":true}'::jsonb,
  '{"gardens":"custom"}'::jsonb,
  true,
  'active',
  'enterprise',
  array['annual','custom']::text[],
  false,
  true,
  40
where not exists (select 1 from public.subscription_plans where name = 'Network Enterprise');

update public.subscription_plans
set
  active = false,
  active_status = 'inactive',
  public_purchase_enabled = false,
  billing_cycle_options = array['annual']::text[],
  updated_at = now()
where plan_type::text = 'monthly';

insert into public.subscription_discount_codes (code, description, discount_type, discount_value, free_months, status, metadata)
values
  ('PILOT100', 'קוד פיילוט להפעלה ראשונית מבוקרת.', 'free_months', 0, 1, 'active', '{"use_case":"pilot"}'::jsonb),
  ('ANNUAL10', 'הנחה שנתית לקמפיין פתיחה.', 'percentage', 10, 0, 'active', '{"use_case":"annual_subscription"}'::jsonb),
  ('ENTERPRISE', 'תמחור מותאם לרשת גנים.', 'enterprise_price', 0, 0, 'active', '{"use_case":"network"}'::jsonb)
on conflict (code)
do update set
  description = excluded.description,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  free_months = excluded.free_months,
  status = excluded.status,
  metadata = excluded.metadata,
  updated_at = now();

insert into public.financial_ai_insights (insight_key, insight_type, severity, status, title, explanation, recommended_action, metadata)
values
  ('payment-provider-not-configured', 'collection_risk', 'high', 'open', 'ספק תשלום אמיתי עדיין לא הופעל', 'המערכת מוכנה לספקי תשלום, אך אין gateway פעיל לייצור.', 'בחר ספק, הגדר env vars והרצת test charge לפני הפעלה.', '{}'::jsonb),
  ('restore-invoice-automation', 'revenue_trend', 'medium', 'open', 'חשבוניות מוכנות לאוטומציה', 'קיימת תשתית ליצירת חשבונית, PDF ושליחה, אך נדרש חיבור ספק חשבוניות/מסמכים.', 'הפעל job ליצירת PDF וחיבור מייל לאחר בחירת ספק.', '{}'::jsonb),
  ('renewal-forecast-ready', 'renewal_forecast', 'low', 'open', 'חיזוי חידושים מוכן', 'תאריכי renewal וסטטוסי trial זמינים לבניית תחזית הכנסות.', 'בדוק תאריכי חידוש לכל גן פעיל.', '{}'::jsonb)
on conflict (insight_key)
do update set
  insight_type = excluded.insight_type,
  severity = excluded.severity,
  status = excluded.status,
  title = excluded.title,
  explanation = excluded.explanation,
  recommended_action = excluded.recommended_action,
  updated_at = now();

insert into public.revenue_snapshots (
  snapshot_date,
  period,
  mrr,
  arr,
  active_customers,
  trial_customers,
  churned_customers,
  failed_payment_count,
  renewal_count,
  collection_rate,
  metadata
)
select
  current_date,
  'monthly',
  coalesce(sum(case
    when ks.status::text = 'active' then coalesce(sp.annual_price, sp.price_amount, 0) / 12
    else 0
  end), 0),
  coalesce(sum(case
    when ks.status::text = 'active' then coalesce(sp.annual_price, sp.price_amount, 0)
    else 0
  end), 0),
  count(*) filter (where ks.status::text = 'active'),
  count(*) filter (where ks.status::text = 'trial'),
  count(*) filter (where ks.status::text in ('cancelled','expired')),
  (select count(*) from public.subscription_payments spay where spay.billing_status::text = 'failed'),
  count(*) filter (where ks.renewal_date between current_date and current_date + interval '30 days'),
  case
    when count(*) filter (where ks.status::text in ('active','pending_payment')) = 0 then 0
    else round((count(*) filter (where ks.status::text = 'active')::numeric / nullif(count(*) filter (where ks.status::text in ('active','pending_payment')), 0)) * 100, 2)
  end,
  '{}'::jsonb
from public.kindergarten_subscriptions ks
left join public.subscription_plans sp on sp.id = ks.plan_id
on conflict (snapshot_date, period)
do update set
  mrr = excluded.mrr,
  arr = excluded.arr,
  active_customers = excluded.active_customers,
  trial_customers = excluded.trial_customers,
  churned_customers = excluded.churned_customers,
  failed_payment_count = excluded.failed_payment_count,
  renewal_count = excluded.renewal_count,
  collection_rate = excluded.collection_rate,
  metadata = excluded.metadata;

comment on table public.payment_gateway_readiness is 'Readiness registry for payment gateways and wallets. Secrets are stored in server environment, not in the database.';
comment on table public.payment_method_tokens is 'Tokenized payment method references only. Raw card data is never stored.';
comment on table public.subscription_checkout_sessions is 'Self-service subscription checkout sessions for kindergarten managers.';
comment on table public.financial_audit_events is 'Append-only financial audit trail for subscription, payment, invoice, refund and gateway actions.';
comment on table public.revenue_snapshots is 'Aggregated revenue metrics for MRR, ARR, churn, renewals and collections.';
comment on table public.kindergarten_payout_configurations is 'Kindergarten-owned payout destinations for parent tuition. Stores references and last four digits only, never raw bank or card secrets.';
comment on table public.parent_payment_authorizations is 'Parent approval records for tuition billing routed directly to the kindergarten payout destination.';
comment on table public.parent_payment_transactions is 'Parent-to-kindergarten payment records. Gan Batuach facilitates the transaction but does not receive tuition funds.';
comment on table public.revenue_separation_ledger is 'Audit ledger separating Gan Batuach subscription revenue from parent tuition routed to kindergarten accounts.';

notify pgrst, 'reload schema';
