-- GB-M35 scoped forward-only repair: audit_logs.actor_role is public.app_role.
-- The original GB-M27 migration is already applied; preserve history and replace only these three RPC bodies.
-- No customer balance or ledger row is changed by this migration.

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
    values(auth.uid(),public.current_role(),e.garden_id,'tuition_billing_periods',p.id,'tuition_partial_period_agreed',
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
  values(auth.uid(),public.current_role(),p.garden_id,'tuition_billing_periods',p.id,'tuition_ledger_entry_recorded',
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
  values(auth.uid(),public.current_role(),target_garden_id,'gardens',target_garden_id,'tuition_due_day_changed',jsonb_build_object('day',requested_day));
  return requested_day;
end $$;

