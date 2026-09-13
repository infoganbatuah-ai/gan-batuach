-- GB-M27: Parent-to-Garden tuition only. No platform subscription or provider charge.
alter table public.gardens add column if not exists tuition_due_day integer check (tuition_due_day between 1 and 31);
alter table public.child_kindergarten_enrollments
  add column if not exists tuition_unit_price_snapshot numeric(12,2) check (tuition_unit_price_snapshot >= 0),
  add column if not exists tuition_currency text not null default 'ILS',
  add column if not exists tuition_price_source text;

create table if not exists public.tuition_billing_periods (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id),
  enrollment_id uuid not null references public.child_kindergarten_enrollments(id),
  child_id uuid not null references public.children(id),
  period_start date not null,
  period_end date not null,
  due_at date,
  base_amount numeric(12,2) not null check (base_amount >= 0),
  currency text not null default 'ILS' check (currency = 'ILS'),
  price_source text not null,
  adjustment_total numeric(12,2) not null default 0,
  settled_total numeric(12,2) not null default 0 check (settled_total >= 0),
  unapplied_credit_total numeric(12,2) not null default 0 check (unapplied_credit_total >= 0),
  status text not null default 'pending' check (status in ('pending','partially_paid','paid','waived','reconciliation_required','cancelled')),
  reconciliation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(enrollment_id, period_start),
  check (period_end = (date_trunc('month',period_start)+interval '1 month - 1 day')::date),
  check (period_start = date_trunc('month',period_start)::date),
  check (base_amount + adjustment_total >= 0),
  check (settled_total <= base_amount + adjustment_total)
);
create index if not exists tuition_period_garden_due_idx on public.tuition_billing_periods(garden_id,due_at,status);
create index if not exists tuition_period_child_idx on public.tuition_billing_periods(child_id,period_start desc);

create table if not exists public.tuition_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  garden_id uuid not null references public.gardens(id),
  period_id uuid not null references public.tuition_billing_periods(id),
  entry_kind text not null check (entry_kind in ('manual_settlement','provider_settlement','adjustment','unapplied_credit','reversal')),
  amount numeric(12,2) not null,
  method text,
  evidence_reference text,
  source_key text not null,
  reason text,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(garden_id,source_key),
  check (amount <> 0),
  check (entry_kind <> 'adjustment' or reason is not null)
);
create index if not exists tuition_entry_period_idx on public.tuition_ledger_entries(period_id,created_at);

create or replace function public.check_tuition_period_scope()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.child_kindergarten_enrollments e where e.id=new.enrollment_id
    and e.garden_id=new.garden_id and e.child_id=new.child_id) then
    raise exception 'tuition_period_scope_mismatch' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists tuition_period_scope on public.tuition_billing_periods;
create trigger tuition_period_scope before insert or update of garden_id,enrollment_id,child_id on public.tuition_billing_periods
for each row execute function public.check_tuition_period_scope();

create or replace function public.check_tuition_entry_scope()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.tuition_billing_periods p where p.id=new.period_id and p.garden_id=new.garden_id) then
    raise exception 'tuition_entry_scope_mismatch' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists tuition_entry_scope on public.tuition_ledger_entries;
create trigger tuition_entry_scope before insert or update of garden_id,period_id on public.tuition_ledger_entries
for each row execute function public.check_tuition_entry_scope();

create or replace function public.tuition_period_projection(p public.tuition_billing_periods, as_of date default current_date)
returns jsonb language sql stable set search_path=public as $$
  select jsonb_build_object(
    'id',p.id,'garden_id',p.garden_id,'enrollment_id',p.enrollment_id,'child_id',p.child_id,
    'period_start',p.period_start,'period_end',p.period_end,'due_at',p.due_at,
    'base_amount',p.base_amount,'adjustment_total',p.adjustment_total,
    'amount_due',p.base_amount+p.adjustment_total,'amount_settled',p.settled_total,
    'unapplied_credit_total',p.unapplied_credit_total,
    'outstanding',greatest(0,p.base_amount+p.adjustment_total-p.settled_total),
    'currency',p.currency,'price_source',p.price_source,
    'status',case when p.status in ('pending','partially_paid') and p.due_at is not null and p.due_at<as_of and p.base_amount+p.adjustment_total>p.settled_total then 'overdue' else p.status end,
    'reconciliation_reason',p.reconciliation_reason
  );
$$;

create or replace function public.ensure_tuition_billing_period(target_enrollment_id uuid, target_month date,
  agreed_partial_amount numeric default null, partial_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.child_kindergarten_enrollments; p public.tuition_billing_periods; c public.children; g public.gardens;
  activation_evidence public.enrollment_payment_evidence;
  request_price numeric(12,2); group_price numeric(12,2); chosen_price numeric(12,2); chosen_source text;
  month_start date:=date_trunc('month',target_month)::date; month_end date:=(date_trunc('month',target_month)+interval '1 month - 1 day')::date;
  partial_period boolean; period_amount numeric(12,2);
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_enrollment_id::text,0));
  select * into e from public.child_kindergarten_enrollments where id=target_enrollment_id for update;
  if e.id is null or public.can_manage_garden(e.garden_id) is distinct from true then raise exception 'tuition_enrollment_denied' using errcode='42501'; end if;
  select * into p from public.tuition_billing_periods where enrollment_id=e.id and period_start=month_start;
  if p.id is not null then return public.tuition_period_projection(p); end if;
  if e.status<>'active' or e.start_date is null or month_end<e.start_date or (e.end_date is not null and month_start>e.end_date) then
    raise exception 'tuition_period_not_eligible' using errcode='23514';
  end if;
  partial_period:=e.start_date>month_start or (e.end_date is not null and e.end_date<month_end);
  if partial_period and (agreed_partial_amount is null or agreed_partial_amount<0 or partial_reason is null or length(trim(partial_reason))<3) then
    raise exception 'tuition_partial_period_review_required' using errcode='23514';
  end if;
  if not partial_period and agreed_partial_amount is not null then raise exception 'tuition_full_period_override_denied' using errcode='23514'; end if;
  select * into c from public.children where id=e.child_id and garden_id=e.garden_id;
  select * into g from public.gardens where id=e.garden_id;
  select * into activation_evidence from public.enrollment_payment_evidence where id=e.activation_payment_evidence_id and garden_id=e.garden_id;
  select r.published_price_snapshot into request_price from public.kindergarten_enrollment_requests r where r.id=e.enrollment_request_id;
  select fg.monthly_fee into group_price from public.kindergarten_fee_groups fg where fg.id=coalesce(c.payment_group_id,e.age_group_id) and fg.garden_id=e.garden_id;
  if e.tuition_unit_price_snapshot is null and request_price is null and month_start<date_trunc('month',current_date)::date then
    raise exception 'historical_tuition_price_requires_review' using errcode='23514';
  end if;
  if e.tuition_unit_price_snapshot is not null then chosen_price:=e.tuition_unit_price_snapshot; chosen_source:=e.tuition_price_source;
  elsif request_price is not null then chosen_price:=request_price; chosen_source:='enrollment_request_snapshot';
  elsif c.custom_monthly_fee is not null and (c.arrangement_valid_until is null or c.arrangement_valid_until>=month_start) then chosen_price:=c.custom_monthly_fee; chosen_source:='child_agreement';
  elsif group_price is not null and group_price>0 then chosen_price:=group_price; chosen_source:='garden_fee_group';
  elsif c.monthly_fee>0 then chosen_price:=c.monthly_fee; chosen_source:='child_legacy_fee';
  else raise exception 'tuition_price_not_configured' using errcode='23514'; end if;
  if e.tuition_unit_price_snapshot is null then
    update public.child_kindergarten_enrollments set tuition_unit_price_snapshot=chosen_price,tuition_price_source=chosen_source where id=e.id;
  end if;
  period_amount:=case when partial_period then agreed_partial_amount else chosen_price end;
  insert into public.tuition_billing_periods(garden_id,enrollment_id,child_id,period_start,period_end,due_at,base_amount,price_source,status,reconciliation_reason)
  values(e.garden_id,e.id,e.child_id,month_start,month_end,
    case when g.tuition_due_day is null then null else make_date(extract(year from month_start)::int,extract(month from month_start)::int,
      least(g.tuition_due_day,extract(day from month_end)::int)) end,period_amount,
    case when partial_period then 'manager_agreed_partial_period' else chosen_source end,
    case when period_amount=0 then 'waived'
      when partial_period or (activation_evidence.id is not null and activation_evidence.covered_from<=month_end and activation_evidence.covered_until>=month_start) then 'reconciliation_required' else 'pending' end,
    case when period_amount=0 then null
      when partial_period then 'partial_period_amount_requires_review'
      when activation_evidence.id is not null and activation_evidence.covered_from<=month_end and activation_evidence.covered_until>=month_start then 'activation_evidence_requires_period_allocation' else null end)
  returning * into p;
  if partial_period then
    insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
    values(auth.uid(),public.current_role()::text,e.garden_id,'tuition_billing_periods',p.id,'tuition_partial_period_agreed',
      jsonb_build_object('agreed_amount',agreed_partial_amount,'reason',left(partial_reason,500)));
  end if;
  return public.tuition_period_projection(p);
end $$;

create or replace function public.apply_manual_tuition_entry(target_period_id uuid, requested_kind text, requested_amount numeric,
  requested_method text, requested_reference text, requested_reason text, requested_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p public.tuition_billing_periods; existing public.tuition_ledger_entries; applied numeric(12,2); excess numeric(12,2); due numeric(12,2);
begin
  select * into p from public.tuition_billing_periods where id=target_period_id for update;
  if p.id is null or public.can_manage_garden(p.garden_id) is distinct from true then raise exception 'tuition_period_denied' using errcode='42501'; end if;
  if requested_key is null or length(requested_key)<8 then raise exception 'tuition_idempotency_key_required' using errcode='23514'; end if;
  select * into existing from public.tuition_ledger_entries where garden_id=p.garden_id and source_key=requested_key;
  if existing.id is not null then
    if existing.period_id<>p.id or existing.entry_kind<>requested_kind or existing.amount<>requested_amount then raise exception 'tuition_idempotency_conflict' using errcode='23505'; end if;
    return public.tuition_period_projection(p);
  end if;
  if p.status='cancelled' then raise exception 'tuition_period_cancelled' using errcode='23514'; end if;
  if requested_kind not in ('manual_settlement','adjustment') or requested_amount=0 then raise exception 'tuition_entry_invalid' using errcode='23514'; end if;
  if requested_kind='adjustment' then
    if requested_reason is null or length(trim(requested_reason))<3 or p.base_amount+p.adjustment_total+requested_amount<p.settled_total then raise exception 'tuition_adjustment_requires_credit_review' using errcode='23514'; end if;
    insert into public.tuition_ledger_entries(garden_id,period_id,entry_kind,amount,source_key,reason,actor_id)
    values(p.garden_id,p.id,'adjustment',requested_amount,requested_key,requested_reason,auth.uid());
    update public.tuition_billing_periods set adjustment_total=adjustment_total+requested_amount,updated_at=now() where id=p.id returning * into p;
  else
    if requested_amount<0 or requested_method not in ('bank_transfer','standing_order','checks','cash','external_other') then raise exception 'tuition_manual_method_invalid' using errcode='23514'; end if;
    due:=greatest(0,p.base_amount+p.adjustment_total-p.settled_total);
    applied:=least(requested_amount,due); excess:=requested_amount-applied;
    insert into public.tuition_ledger_entries(garden_id,period_id,entry_kind,amount,method,evidence_reference,source_key,reason,actor_id)
    values(p.garden_id,p.id,'manual_settlement',requested_amount,requested_method,requested_reference,requested_key,requested_reason,auth.uid());
    if excess>0 then
      insert into public.tuition_ledger_entries(garden_id,period_id,entry_kind,amount,method,evidence_reference,source_key,reason,actor_id)
      values(p.garden_id,p.id,'unapplied_credit',excess,requested_method,requested_reference,requested_key||':excess','overpayment_unapplied',auth.uid());
    end if;
    update public.tuition_billing_periods set settled_total=settled_total+applied,unapplied_credit_total=unapplied_credit_total+excess,updated_at=now() where id=p.id returning * into p;
  end if;
  update public.tuition_billing_periods set status=case when unapplied_credit_total>0 then 'reconciliation_required'
    when base_amount+adjustment_total=0 then 'waived'
    when settled_total>=base_amount+adjustment_total then 'paid'
    when p.status='reconciliation_required' then 'reconciliation_required'
    when settled_total>0 then 'partially_paid' else 'pending' end,
    reconciliation_reason=case when unapplied_credit_total>0 then 'unapplied_credit_pending_allocation'
      when settled_total>=base_amount+adjustment_total then null else reconciliation_reason end,
    updated_at=now() where id=p.id returning * into p;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),public.current_role()::text,p.garden_id,'tuition_billing_periods',p.id,'tuition_ledger_entry_recorded',
    jsonb_build_object('kind',requested_kind,'amount',requested_amount,'source_key',requested_key,'excess',coalesce(excess,0)));
  return public.tuition_period_projection(p);
end $$;

create or replace function public.set_garden_tuition_due_day(target_garden_id uuid, requested_day integer)
returns integer language plpgsql security definer set search_path=public as $$
declare prior_day integer;
begin
  if public.can_manage_garden(target_garden_id) is distinct from true then raise exception 'tuition_due_policy_denied' using errcode='42501'; end if;
  if requested_day is not null and (requested_day<1 or requested_day>31) then raise exception 'tuition_due_day_invalid' using errcode='23514'; end if;
  select tuition_due_day into prior_day from public.gardens where id=target_garden_id for update;
  if prior_day is not distinct from requested_day then return requested_day; end if;
  update public.gardens set tuition_due_day=requested_day where id=target_garden_id;
  insert into public.audit_logs(actor_id,actor_role,garden_id,entity_type,entity_id,action,after_data)
  values(auth.uid(),public.current_role()::text,target_garden_id,'gardens',target_garden_id,'tuition_due_day_changed',jsonb_build_object('day',requested_day));
  return requested_day;
end $$;

alter table public.tuition_billing_periods enable row level security;
alter table public.tuition_ledger_entries enable row level security;
create policy tuition_period_authorized_read on public.tuition_billing_periods for select to authenticated using (
  public.can_manage_garden(garden_id) or public.is_admin() or
  exists(select 1 from public.child_kindergarten_enrollments e where e.id=tuition_billing_periods.enrollment_id and e.garden_id=tuition_billing_periods.garden_id
    and public.can_guardian_access_child(e.permanent_child_file_id,'profile')));
create policy tuition_entry_authorized_read on public.tuition_ledger_entries for select to authenticated using (
  exists(select 1 from public.tuition_billing_periods p where p.id=tuition_ledger_entries.period_id and p.garden_id=tuition_ledger_entries.garden_id and
    (public.can_manage_garden(p.garden_id) or public.is_admin())));
revoke all on public.tuition_billing_periods, public.tuition_ledger_entries from public,anon,authenticated;
grant select on public.tuition_billing_periods, public.tuition_ledger_entries to authenticated;
revoke all on function public.ensure_tuition_billing_period(uuid,date,numeric,text), public.apply_manual_tuition_entry(uuid,text,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function public.ensure_tuition_billing_period(uuid,date,numeric,text), public.apply_manual_tuition_entry(uuid,text,numeric,text,text,text,text) to authenticated;
revoke all on function public.set_garden_tuition_due_day(uuid,integer) from public,anon,authenticated;
grant execute on function public.set_garden_tuition_due_day(uuid,integer) to authenticated;
revoke all on function public.tuition_period_projection(public.tuition_billing_periods,date) from public,anon,authenticated;
-- Legacy direct child-payment history writes are not authoritative after GB-M27.
revoke insert,update,delete on public.child_payment_history from authenticated;
