-- GB-M26: Garden -> Gan Batuach commercial subscription. Parent tuition is separate.

alter table public.subscription_plans
  add column if not exists code text,
  add column if not exists version integer not null default 1,
  add column if not exists effective_from date,
  add column if not exists effective_until date,
  add column if not exists is_default boolean not null default false,
  add column if not exists billing_interval text not null default 'annual',
  add column if not exists commitment_months integer not null default 12,
  add column if not exists grace_days integer,
  add constraint subscription_plan_commitment_positive check (commitment_months > 0),
  add constraint subscription_plan_interval_valid check (billing_interval in ('monthly','annual')),
  add constraint subscription_plan_grace_valid check (grace_days is null or grace_days >= 0);

create unique index if not exists subscription_plans_code_version_unique
  on public.subscription_plans(code, version) where code is not null;
create unique index if not exists subscription_plans_one_active_default
  on public.subscription_plans(is_default) where is_default and active;

-- Plan edits and subscription state changes must pass the version/transition RPCs.
revoke update, delete on public.subscription_plans from public, anon, authenticated;
revoke insert, update, delete on public.kindergarten_subscriptions from public, anon, authenticated;
drop policy if exists "kindergarten subscriptions by role" on public.kindergarten_subscriptions;
create policy "kindergarten subscriptions by role" on public.kindergarten_subscriptions
  for select to authenticated using (public.is_admin() or public.can_manage_garden(garden_id));
drop policy if exists "subscription payments by role" on public.subscription_payments;
create policy "subscription payments by role" on public.subscription_payments
  for select to authenticated using (public.is_admin() or public.can_manage_garden(garden_id));
drop policy if exists "billing invoices by role" on public.billing_invoices;
create policy "billing invoices by role" on public.billing_invoices
  for select to authenticated using (public.is_admin() or public.can_manage_garden(garden_id));
drop policy if exists "billing receipts by role" on public.billing_receipts;
create policy "billing receipts by role" on public.billing_receipts
  for select to authenticated using (public.is_admin() or public.can_manage_garden(garden_id));
drop policy if exists "subscription reminders by role" on public.subscription_reminders;
create policy "subscription reminders by role" on public.subscription_reminders
  for select to authenticated using (public.is_admin() or public.can_manage_garden(garden_id));

-- Prefer the existing exact 700/month, 8400/year Garden plan when present.
-- The 630/month annual-discount and other legacy plans remain historical.
update public.subscription_plans set code='garden_base',version=1,
  billing_interval='monthly',commitment_months=12,is_default=true,
  effective_from=coalesce(effective_from,current_date),updated_at=now()
where name='Gan Batuach Fixed Kindergarten Plan' and price_amount=700
  and monthly_price=700 and annual_price=8400 and active
  and not exists(select 1 from public.subscription_plans where is_default and active);

insert into public.subscription_plans
  (name, description, plan_type, price_amount, monthly_price, annual_price, currency,
   duration_days, trial_days, enabled_features, features, limits, active, active_status,
   plan_category, billing_cycle_options, public_purchase_enabled, sort_order,
   code, version, effective_from, is_default, billing_interval, commitment_months)
select 'Gan Batuach Base', '700 ILS monthly billing with a 12-month commitment',
  'annual', 700, 700, 8400, 'ILS', 365, 0,
  '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, true, 'active', 'standard',
  array['monthly']::text[], true, 1,
  'garden_base', 1, current_date, true, 'monthly', 12
where not exists (select 1 from public.subscription_plans where code = 'garden_base')
  and not exists (select 1 from public.subscription_plans where is_default and active);

alter table public.kindergarten_subscriptions
  add column if not exists plan_code_snapshot text,
  add column if not exists plan_version_snapshot integer,
  add column if not exists unit_price_snapshot numeric(12,2),
  add column if not exists currency_snapshot text,
  add column if not exists billing_interval text,
  add column if not exists commitment_months integer,
  add column if not exists commitment_start date,
  add column if not exists commitment_end date,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists cancellation_effective_at timestamptz,
  add column if not exists grace_until timestamptz,
  add column if not exists activation_source text,
  add constraint subscription_snapshot_price_valid check (unit_price_snapshot is null or unit_price_snapshot >= 0),
  add constraint subscription_billing_interval_valid check (billing_interval is null or billing_interval in ('monthly','annual')),
  add constraint subscription_commitment_valid check (commitment_months is null or commitment_months > 0);

alter table public.kindergarten_subscriptions drop constraint if exists kindergarten_subscriptions_billing_cycle_check;
alter table public.kindergarten_subscriptions add constraint kindergarten_subscriptions_billing_cycle_check
  check (billing_cycle in ('monthly','annual','custom'));
alter table public.kindergarten_subscriptions drop constraint if exists kindergarten_subscriptions_billing_status_check;
alter table public.kindergarten_subscriptions add constraint kindergarten_subscriptions_billing_status_check
  check (billing_status in ('not_configured','trial','active','pending_payment','past_due','grace_period','failed','cancelled','suspended','manual_review'));

-- Existing subscriptions keep their original status and price metadata. Old
-- billing_cycle was forcibly annual in a legacy migration, so terms cannot be
-- safely backfilled from the current plan row. New writes get a real snapshot.

create or replace function public.snapshot_platform_subscription_terms()
returns trigger language plpgsql security definer set search_path=public as $$
declare p public.subscription_plans%rowtype;
begin
  if new.plan_id is null then
    select * into p from public.subscription_plans where is_default and active
      and (effective_from is null or effective_from<=current_date)
      and (effective_until is null or effective_until>current_date) limit 1;
    if p.id is null then return new; end if;
    new.plan_id:=p.id;
  else
    select * into p from public.subscription_plans where id=new.plan_id;
  end if;
  if p.id is null then raise exception 'plan_not_found'; end if;
  new.plan_code_snapshot:=coalesce(new.plan_code_snapshot,p.code);
  new.plan_version_snapshot:=coalesce(new.plan_version_snapshot,p.version);
  new.unit_price_snapshot:=coalesce(new.unit_price_snapshot,
    case when p.billing_interval='monthly' then coalesce(p.monthly_price,p.price_amount)
      else coalesce(p.annual_price,p.price_amount) end);
  new.currency_snapshot:=coalesce(new.currency_snapshot,p.currency);
  new.billing_interval:=coalesce(new.billing_interval,p.billing_interval);
  new.billing_cycle:=new.billing_interval;
  new.commitment_months:=coalesce(new.commitment_months,p.commitment_months);
  if new.commitment_start is not null then
    new.commitment_end:=coalesce(new.commitment_end,(new.commitment_start+(new.commitment_months||' months')::interval)::date);
  end if;
  new.current_period_start:=coalesce(new.current_period_start,new.start_date);
  new.current_period_end:=coalesce(new.current_period_end,(new.current_period_start+
    case when new.billing_interval='monthly' then interval '1 month' else interval '1 year' end)::date);
  new.renewal_date:=coalesce(new.renewal_date,new.current_period_end);
  return new;
end $$;
drop trigger if exists snapshot_platform_subscription_terms_trigger on public.kindergarten_subscriptions;
create trigger snapshot_platform_subscription_terms_trigger before insert on public.kindergarten_subscriptions
  for each row execute function public.snapshot_platform_subscription_terms();

create table if not exists public.platform_subscription_events (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.kindergarten_subscriptions(id),
  garden_id uuid not null references public.gardens(id),
  action text not null,
  previous_status text,
  next_status text,
  actor_id uuid references public.profiles(id),
  source text not null,
  reason text,
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);
create index if not exists platform_subscription_events_garden_idx on public.platform_subscription_events(garden_id,created_at desc);
alter table public.platform_subscription_events enable row level security;
create policy platform_subscription_events_read on public.platform_subscription_events
  for select to authenticated using (public.is_admin() or public.can_manage_garden(garden_id));
revoke all on public.platform_subscription_events from anon, authenticated;
grant select on public.platform_subscription_events to authenticated;

-- Canonical current set includes all non-terminal commercial states. Do not
-- rewrite ambiguous historical rows; migration will fail if they conflict.
drop index if exists public.kindergarten_subscriptions_one_current_per_garden_idx;
create unique index kindergarten_subscriptions_one_current_per_garden_idx
  on public.kindergarten_subscriptions(garden_id)
  where status in ('active','trial','pending_payment','payment_failed','past_due','grace_period','suspended','frozen','demo_active');

create or replace function public.platform_subscription_entitlements(target_garden_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s public.kindergarten_subscriptions%rowtype; p public.subscription_plans%rowtype;
begin
  if public.is_admin() is distinct from true and public.can_manage_garden(target_garden_id) is distinct from true then
    raise exception 'garden_forbidden' using errcode='42501';
  end if;
  select * into s from public.kindergarten_subscriptions
    where garden_id=target_garden_id and status::text not in ('cancelled','expired')
    order by created_at desc limit 1;
  if s.id is null then
    return jsonb_build_object('status','not_configured','commercial_access','legacy_compatible','features','{}'::jsonb,'provider_readiness','not_configured');
  end if;
  select * into p from public.subscription_plans where id=s.plan_id;
  return jsonb_build_object(
    'status',s.status::text,'plan_id',s.plan_id,'plan_code',s.plan_code_snapshot,
    'commercial_access',case when s.admin_override or s.status::text in ('active','trial','demo_active','grace_period') then 'enabled'
      when s.status::text in ('pending_payment','payment_failed','past_due') then 'limited' else 'suspended' end,
    'features',coalesce(p.enabled_features,'{}'::jsonb),
    'provider_readiness',case when s.provider::text='manual' then 'manual_or_not_configured' else 'provider_not_verified' end,
    'billing_interval',s.billing_interval,'commitment_end',s.commitment_end,
    'current_period_end',s.current_period_end);
end $$;
revoke all on function public.platform_subscription_entitlements(uuid) from public;
grant execute on function public.platform_subscription_entitlements(uuid) to authenticated;

create or replace function public.request_platform_subscription_cancellation(target_garden_id uuid, requested_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.kindergarten_subscriptions%rowtype; effective_at timestamptz;
begin
  if public.can_manage_garden(target_garden_id) is distinct from true then raise exception 'garden_forbidden' using errcode='42501'; end if;
  select * into s from public.kindergarten_subscriptions where garden_id=target_garden_id
    and status::text not in ('cancelled','expired') order by created_at desc limit 1 for update;
  if s.id is null then raise exception 'subscription_not_found'; end if;
  if s.cancellation_requested_at is not null then return jsonb_build_object('id',s.id,'status',s.status,'cancellation_effective_at',s.cancellation_effective_at); end if;
  effective_at := greatest(coalesce(s.current_period_end::timestamptz,s.expires_at,now()),
    coalesce(s.commitment_end::timestamptz,now()));
  update public.kindergarten_subscriptions set cancellation_requested_at=now(),
    cancellation_effective_at=effective_at,auto_renew=false,
    cancellation_reason=left(requested_reason,500),updated_at=now(),updated_by=auth.uid()
    where id=s.id;
  insert into public.platform_subscription_events(subscription_id,garden_id,action,previous_status,next_status,actor_id,source,reason)
    values(s.id,target_garden_id,'cancellation_requested',s.status::text,s.status::text,auth.uid(),'garden',left(requested_reason,500));
  return jsonb_build_object('id',s.id,'status',s.status,'cancellation_effective_at',effective_at);
end $$;
revoke all on function public.request_platform_subscription_cancellation(uuid,text) from public;
grant execute on function public.request_platform_subscription_cancellation(uuid,text) to authenticated;

create or replace function public.admin_version_platform_plan(target_plan_id uuid, proposed_name text,
  proposed_price numeric, proposed_currency text default 'ILS', proposed_billing_interval text default 'monthly', proposed_grace_days integer default null,
  make_default boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare old_plan public.subscription_plans%rowtype; new_plan public.subscription_plans%rowtype; next_version integer;
begin
  if public.is_admin() is distinct from true then raise exception 'admin_required' using errcode='42501'; end if;
  if proposed_price < 0 or proposed_currency is null or length(proposed_currency) <> 3 or
     proposed_billing_interval not in ('monthly','annual') or
     proposed_grace_days < 0 or length(trim(proposed_name)) < 2 then raise exception 'invalid_plan_terms'; end if;
  select * into old_plan from public.subscription_plans where id=target_plan_id for update;
  if old_plan.id is null then raise exception 'plan_not_found'; end if;
  perform pg_advisory_xact_lock(hashtext(coalesce(old_plan.code,old_plan.id::text)));
  select coalesce(max(version),0)+1 into next_version from public.subscription_plans
    where code=coalesce(old_plan.code,old_plan.id::text);
  update public.subscription_plans set active=false,active_status='inactive',is_default=false,
    public_purchase_enabled=false,effective_until=current_date,updated_by=auth.uid(),updated_at=now()
    where id=old_plan.id;
  if make_default or old_plan.is_default then update public.subscription_plans set is_default=false,updated_at=now() where is_default; end if;
  insert into public.subscription_plans(name,description,plan_type,price_amount,monthly_price,annual_price,currency,
    duration_days,trial_days,enabled_features,features,limits,active,active_status,plan_category,
    billing_cycle_options,public_purchase_enabled,enterprise_contact_required,sort_order,
    code,version,effective_from,is_default,billing_interval,commitment_months,grace_days,created_by,updated_by)
  values(trim(proposed_name),old_plan.description,old_plan.plan_type,proposed_price,
    case when proposed_billing_interval='monthly' then proposed_price else null end,
    case when proposed_billing_interval='monthly' then proposed_price*12 else proposed_price end,
    upper(proposed_currency),old_plan.duration_days,old_plan.trial_days,
    old_plan.enabled_features,old_plan.features,old_plan.limits,true,'active',old_plan.plan_category,
    array[proposed_billing_interval]::text[],true,old_plan.enterprise_contact_required,old_plan.sort_order,
    coalesce(old_plan.code,old_plan.id::text),next_version,current_date,(make_default or old_plan.is_default),proposed_billing_interval,
    coalesce(old_plan.commitment_months,12),proposed_grace_days,auth.uid(),auth.uid())
  returning * into new_plan;
  return jsonb_build_object('id',new_plan.id,'code',new_plan.code,'version',new_plan.version,
    'unit_price',new_plan.price_amount,'currency',new_plan.currency,'is_default',new_plan.is_default);
end $$;
revoke all on function public.admin_version_platform_plan(uuid,text,numeric,text,text,integer,boolean) from public;
grant execute on function public.admin_version_platform_plan(uuid,text,numeric,text,text,integer,boolean) to authenticated;

create or replace function public.ensure_platform_subscription(target_garden_id uuid, requested_plan_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.kindergarten_subscriptions%rowtype; p public.subscription_plans%rowtype; today date:=current_date;
begin
  if public.can_manage_garden(target_garden_id) is distinct from true then raise exception 'garden_forbidden' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtext(target_garden_id::text));
  select * into s from public.kindergarten_subscriptions where garden_id=target_garden_id
    and status not in ('cancelled','expired') order by created_at desc limit 1 for update;
  if s.id is not null then return jsonb_build_object('id',s.id,'status',s.status,'existing',true); end if;
  select * into p from public.subscription_plans where id=coalesce(requested_plan_id,
    (select id from public.subscription_plans where is_default and active order by created_at desc limit 1))
    and active and (effective_from is null or effective_from<=today)
    and (effective_until is null or effective_until>today);
  if p.id is null then raise exception 'active_plan_not_found'; end if;
  insert into public.kindergarten_subscriptions(garden_id,plan_id,status,plan_type,start_date,
    billing_status,billing_cycle,provider,plan_code_snapshot,plan_version_snapshot,
    unit_price_snapshot,currency_snapshot,billing_interval,commitment_months,commitment_start,
    commitment_end,current_period_start,current_period_end,renewal_date,activation_source,created_by,updated_by)
  values(target_garden_id,p.id,'pending_payment',p.plan_type,today,'pending_payment',p.billing_interval,
    'manual',p.code,p.version,case when p.billing_interval='monthly' then coalesce(p.monthly_price,p.price_amount)
      else coalesce(p.annual_price,p.price_amount) end,p.currency,p.billing_interval,p.commitment_months,
    null,null,today,
    (today+case when p.billing_interval='monthly' then interval '1 month' else interval '1 year' end)::date,
    (today+case when p.billing_interval='monthly' then interval '1 month' else interval '1 year' end)::date,
    'pending_provider',auth.uid(),auth.uid()) returning * into s;
  insert into public.platform_subscription_events(subscription_id,garden_id,action,next_status,actor_id,source,period_start,period_end)
    values(s.id,target_garden_id,'created','pending_payment',auth.uid(),'garden',s.current_period_start,s.current_period_end);
  return jsonb_build_object('id',s.id,'status',s.status,'existing',false);
end $$;
revoke all on function public.ensure_platform_subscription(uuid,uuid) from public;
grant execute on function public.ensure_platform_subscription(uuid,uuid) to authenticated;

create or replace function public.admin_adopt_platform_plan(target_subscription_id uuid, target_plan_id uuid, action_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s public.kindergarten_subscriptions%rowtype; p public.subscription_plans%rowtype; agreed_price numeric;
begin
  if public.is_admin() is distinct from true then raise exception 'admin_required' using errcode='42501'; end if;
  if action_reason is null or length(trim(action_reason))<5 then raise exception 'plan_adoption_reason_required'; end if;
  select * into s from public.kindergarten_subscriptions where id=target_subscription_id for update;
  if s.id is null then raise exception 'subscription_not_found'; end if;
  if s.status::text not in ('trial','pending_payment','payment_failed','past_due','grace_period','suspended') then
    raise exception 'plan_change_requires_new_contract';
  end if;
  select * into p from public.subscription_plans where id=target_plan_id and active;
  if p.id is null then raise exception 'active_plan_not_found'; end if;
  agreed_price:=case when p.billing_interval='monthly' then coalesce(p.monthly_price,p.price_amount)
    else coalesce(p.annual_price,p.price_amount) end;
  if s.plan_id=p.id and s.unit_price_snapshot=agreed_price and s.billing_interval=p.billing_interval then
    return jsonb_build_object('id',s.id,'plan_id',p.id,'idempotent',true);
  end if;
  update public.kindergarten_subscriptions set plan_id=p.id,plan_type=p.plan_type,
    plan_code_snapshot=p.code,plan_version_snapshot=p.version,unit_price_snapshot=agreed_price,
    currency_snapshot=p.currency,billing_interval=p.billing_interval,billing_cycle=p.billing_interval,
    commitment_months=p.commitment_months,updated_by=auth.uid(),updated_at=now()
    where id=s.id;
  insert into public.platform_subscription_events(subscription_id,garden_id,action,previous_status,next_status,actor_id,source,reason)
    values(s.id,s.garden_id,'plan_adopted',s.status::text,s.status::text,auth.uid(),'manual_admin',left(action_reason,500));
  return jsonb_build_object('id',s.id,'plan_id',p.id,'idempotent',false,'unit_price',agreed_price);
end $$;
revoke all on function public.admin_adopt_platform_plan(uuid,uuid,text) from public;
grant execute on function public.admin_adopt_platform_plan(uuid,uuid,text) to authenticated;

create or replace function public.admin_transition_platform_subscription(target_subscription_id uuid,
  requested_action text, action_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.kindergarten_subscriptions%rowtype; next_status public.kindergarten_subscription_status;
  next_billing text; next_start date; next_end date; source_kind text;
begin
  if public.is_admin() is distinct from true then raise exception 'admin_required' using errcode='42501'; end if;
  select * into s from public.kindergarten_subscriptions where id=target_subscription_id for update;
  if s.id is null then raise exception 'subscription_not_found'; end if;
  if s.status::text in ('cancelled','expired') and requested_action <> 'cancel' then
    raise exception 'terminal_subscription_requires_new_contract';
  end if;
  if requested_action in ('manual_activate','reactivate') then
    if action_reason is null or length(trim(action_reason))<5 then raise exception 'manual_reason_required'; end if;
    if s.status::text='active' then return jsonb_build_object('id',s.id,'status','active','idempotent',true); end if;
    if s.status::text='cancelled' then raise exception 'cancelled_subscription_requires_new_contract'; end if;
    if s.plan_id is null or s.unit_price_snapshot is null or s.billing_interval is null then
      raise exception 'subscription_terms_not_snapshotted';
    end if;
    next_status:='active'; next_billing:='active'; source_kind:='manual_admin';
    next_start:=current_date;
    next_end:=(next_start+case when coalesce(s.billing_interval,'monthly')='monthly' then interval '1 month' else interval '1 year' end)::date;
  elsif requested_action='suspend' then
    if s.status::text='suspended' then return jsonb_build_object('id',s.id,'status','suspended','idempotent',true); end if;
    next_status:='suspended';next_billing:='suspended';source_kind:='admin';
  elsif requested_action='mark_past_due' then
    if s.status::text='past_due' then return jsonb_build_object('id',s.id,'status','past_due','idempotent',true); end if;
    next_status:='past_due';next_billing:='past_due';source_kind:='admin';
  elsif requested_action='enter_grace' then
    if s.status::text='grace_period' then return jsonb_build_object('id',s.id,'status','grace_period','idempotent',true); end if;
    if s.status::text not in ('past_due','payment_failed') then raise exception 'invalid_transition'; end if;
    if s.plan_id is null or (select grace_days from public.subscription_plans where id=s.plan_id) is null then raise exception 'grace_not_configured'; end if;
    next_status:='grace_period';next_billing:='grace_period';source_kind:='admin';
  elsif requested_action='cancel' then
    if s.status::text='cancelled' then return jsonb_build_object('id',s.id,'status','cancelled','idempotent',true); end if;
    if action_reason is null or length(trim(action_reason))<5 then raise exception 'admin_cancellation_reason_required'; end if;
    next_status:='cancelled';next_billing:='cancelled';source_kind:='admin';
  elsif requested_action='renew' then
    if s.status::text not in ('active','past_due','grace_period') then raise exception 'invalid_transition'; end if;
    if s.current_period_end is null then raise exception 'period_missing'; end if;
    if s.current_period_end>current_date then return jsonb_build_object('id',s.id,'status',s.status,'idempotent',true); end if;
    next_status:='pending_payment';next_billing:='pending_payment';source_kind:='system_readiness';
    next_start:=s.current_period_end;
    next_end:=(next_start+case when coalesce(s.billing_interval,'monthly')='monthly' then interval '1 month' else interval '1 year' end)::date;
  else raise exception 'unsupported_subscription_action'; end if;
  update public.kindergarten_subscriptions set status=next_status,billing_status=next_billing,
    current_period_start=coalesce(next_start,current_period_start),
    current_period_end=coalesce(next_end,current_period_end),
    commitment_start=case when requested_action in ('manual_activate','reactivate') then coalesce(commitment_start,next_start) else commitment_start end,
    commitment_end=case when requested_action in ('manual_activate','reactivate') then
      coalesce(commitment_end,(coalesce(commitment_start,next_start)+(coalesce(commitment_months,12)||' months')::interval)::date) else commitment_end end,
    renewal_date=case when next_end is null then renewal_date else next_end end,
    activation_source=case when requested_action in ('manual_activate','reactivate') then source_kind else activation_source end,
    grace_until=case when requested_action='enter_grace' then now()+((select grace_days from public.subscription_plans where id=s.plan_id)||' days')::interval else grace_until end,
    suspended_at=case when requested_action='suspend' then now() else suspended_at end,
    cancelled_at=case when requested_action='cancel' then now() else cancelled_at end,
    updated_at=now(),updated_by=auth.uid() where id=s.id;
  insert into public.platform_subscription_events(subscription_id,garden_id,action,previous_status,next_status,actor_id,source,reason,period_start,period_end)
    values(s.id,s.garden_id,requested_action,s.status::text,next_status::text,auth.uid(),source_kind,left(action_reason,500),next_start,next_end);
  return jsonb_build_object('id',s.id,'status',next_status,'idempotent',false,'source',source_kind);
end $$;
revoke all on function public.admin_transition_platform_subscription(uuid,text,text) from public;
grant execute on function public.admin_transition_platform_subscription(uuid,text,text) to authenticated;
