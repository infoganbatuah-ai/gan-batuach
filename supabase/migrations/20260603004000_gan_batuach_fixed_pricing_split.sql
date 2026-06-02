insert into public.subscription_plans (
  name,
  description,
  plan_type,
  price_amount,
  currency,
  duration_days,
  trial_days,
  active_users_limit,
  active_children_limit,
  camera_limit,
  storage_limit_mb,
  enabled_features,
  active,
  sort_order
)
select
  'Gan Batuach Fixed Kindergarten Plan',
  'Fixed Gan Batuach kindergarten plan: management system plus Digital Observer included.',
  'monthly',
  700,
  'ILS',
  30,
  0,
  null,
  null,
  null,
  null,
  '{"core_dashboard":true,"finance":true,"parent_requests":true,"cameras":true,"smart_insights":true,"digital_observer_included":true,"observer_upsell":false}'::jsonb,
  true,
  10
where not exists (
  select 1
  from public.subscription_plans
  where name = 'Gan Batuach Fixed Kindergarten Plan'
);

update public.subscription_plans
set
  description = 'Fixed Gan Batuach kindergarten plan: management system plus Digital Observer included.',
  price_amount = 700,
  currency = 'ILS',
  duration_days = 30,
  trial_days = 0,
  active_users_limit = null,
  active_children_limit = null,
  camera_limit = null,
  storage_limit_mb = null,
  enabled_features = coalesce(enabled_features, '{}'::jsonb)
    || '{"digital_observer_included":true,"observer_upsell":false,"kindergarten_management_system":true}'::jsonb,
  active = true,
  sort_order = 10,
  updated_at = now()
where name = 'Gan Batuach Fixed Kindergarten Plan';

update public.subscription_plans
set
  active = false,
  description = case
    when coalesce(description, '') like '%Deprecated for Gan Batuach fixed pricing model.%' then description
    else coalesce(description, '') || ' Deprecated for Gan Batuach fixed pricing model.'
  end,
  updated_at = now()
where name in ('Trial Plan', 'Monthly Plan', 'Annual Plan');

update public.subscription_plans
set
  description = 'Future custom plan for large kindergarten chains only. Digital Observer remains included for Gan Batuach kindergartens.',
  enabled_features = coalesce(enabled_features, '{}'::jsonb)
    || '{"large_chain":true,"digital_observer_included":true,"observer_upsell":false}'::jsonb,
  active = true,
  updated_at = now()
where name = 'Custom Enterprise Plan';

comment on table public.subscription_plans is 'Gan Batuach uses one fixed kindergarten plan at 700 ILS/month. Digital Observer is included in Gan Batuach; standalone observer packages are future-only and separate.';

notify pgrst, 'reload schema';
