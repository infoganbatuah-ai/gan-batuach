-- REVIEW ONLY: not a migration. The guard deliberately aborts this file.
begin;
do $$ begin raise exception 'REVIEW_ONLY_REFUND_ATOMIC_SQL_MUST_NOT_RUN'; end $$;

-- Proposed additive RPC. It MUST NOT replace the current RPC while the active
-- service still writes audit separately, or successful calls would double-audit.
-- No adapter uses this candidate until a separately reviewed Development change.
create function public.authorize_digital_observer_refund_atomic(
  p_stable_refund_id text, p_idempotency_key text, p_observer_site_id uuid, p_payment_event_id uuid,
  p_amount_minor bigint, p_currency text, p_safe_reason text, p_actor_profile_id uuid
) returns setof public.digital_observer_refunds
language plpgsql security invoker set search_path = '' as $$
declare
  site public.observer_sites%rowtype;
  payment public.digital_observer_payment_events%rowtype;
  invoice public.observer_invoices%rowtype;
  saved public.digital_observer_refunds%rowtype;
  invoice_ids uuid[];
  member_id uuid;
  prior_total numeric;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'REFUND_SERVICE_ROLE_REQUIRED';
  end if;
  if p_stable_refund_id is null or p_stable_refund_id !~ '^[0-9a-f]{64}$'
    or p_idempotency_key is null or length(p_idempotency_key) not between 12 and 160
    or p_idempotency_key ~ '[[:cntrl:]]'
    or p_observer_site_id is null or p_payment_event_id is null or p_actor_profile_id is null
    or p_amount_minor is null or p_amount_minor <= 0
    or p_currency is null or p_currency !~ '^[A-Z]{3}$'
    or p_safe_reason is null or p_safe_reason <> btrim(p_safe_reason)
    or length(p_safe_reason) not between 3 and 240 then
    raise exception 'REFUND_ARGUMENT_INVALID';
  end if;

  -- The service role is a transport privilege, not proof that the supplied
  -- actor owns this Site. Global administration is not a Site binding.
  select * into site from public.observer_sites
    where id=p_observer_site_id and active=true and garden_id is null
      and site_type <> 'kindergarten' for share;
  if not found then raise exception 'REFUND_SITE_DENIED'; end if;
  perform 1 from public.profiles where id=p_actor_profile_id and active=true for share;
  if not found then raise exception 'REFUND_ACTOR_DENIED'; end if;
  if site.owner_profile_id is distinct from p_actor_profile_id then
    select id into member_id from public.observer_site_memberships
      where observer_site_id=site.id and profile_id=p_actor_profile_id and active=true
        and member_role in ('owner','admin') for share;
    if member_id is null then raise exception 'REFUND_ACTOR_DENIED'; end if;
  end if;

  -- One payment row lock serializes all refund reservations for this payment,
  -- including distinct idempotency keys and concurrent callers.
  select * into payment from public.digital_observer_payment_events
    where id=p_payment_event_id and observer_site_id=site.id for update;
  if not found or payment.payment_outcome <> 'confirmed' or payment.signature_valid is distinct from true
    or payment.checkout_intent_id is null or payment.amount_minor is null or payment.amount_minor <= 0
    or payment.currency is null then
    raise exception 'REFUND_CONFIRMED_PAYMENT_REQUIRED';
  end if;

  -- A canonical paid invoice must identify this exact payment and checkout.
  -- The payment's subscription_id may predate subscription activation and is
  -- deliberately not used as an invoice equality check.
  select array_agg(candidate.id) into invoice_ids from (
    select i.id from public.observer_invoices i
      where i.observer_site_id=site.id and i.currency=payment.currency
        and i.invoice_state='paid'
        and i.metadata @> jsonb_build_object('source_payment_event_id',payment.id)
        and i.metadata->>'checkout_intent_id'=payment.checkout_intent_id::text
      limit 2
  ) candidate;
  if coalesce(cardinality(invoice_ids),0) <> 1 then
    raise exception 'REFUND_INVOICE_BINDING_REQUIRED';
  end if;
  select * into invoice from public.observer_invoices where id=invoice_ids[1] for share;
  if not found or invoice.observer_site_id is distinct from site.id
    or invoice.currency is distinct from payment.currency
    or invoice.invoice_state <> 'paid'
    or invoice.metadata->>'source_payment_event_id' is distinct from payment.id::text
    or invoice.metadata->>'checkout_intent_id' is distinct from payment.checkout_intent_id::text then
    raise exception 'REFUND_INVOICE_BINDING_REQUIRED';
  end if;

  select * into saved from public.digital_observer_refunds
    where observer_site_id=site.id and idempotency_key=p_idempotency_key for update;
  if found then
    if saved.stable_refund_id is distinct from p_stable_refund_id
      or saved.payment_event_id is distinct from payment.id
      or saved.invoice_id is distinct from invoice.id
      or saved.amount_minor is distinct from p_amount_minor
      or saved.currency is distinct from p_currency
      or saved.requested_by is distinct from p_actor_profile_id
      or saved.authorized_by is distinct from p_actor_profile_id
      or saved.safe_reason is distinct from p_safe_reason then
      raise exception 'REFUND_IDEMPOTENCY_CONFLICT';
    end if;
    if not exists (
      select 1 from public.digital_observer_financial_audit a
        where a.observer_site_id=site.id and a.actor_profile_id=p_actor_profile_id
          and a.operation='refund_authorized' and a.entity_type='refund'
          and a.entity_id=saved.id::text and a.correlation_id=p_stable_refund_id
          and a.new_state @> jsonb_build_object('refund_status','authorized',
            'amount_minor',p_amount_minor,'currency',p_currency)
    ) then
      raise exception 'REFUND_AUDIT_REPAIR_REQUIRED';
    end if;
    return next saved;
    return;
  end if;

  if payment.currency <> p_currency then raise exception 'REFUND_CURRENCY_MISMATCH'; end if;

  select coalesce(sum(amount_minor),0) into prior_total from public.digital_observer_refunds
    where payment_event_id=payment.id
      and refund_status in ('requested','authorized','provider_pending','confirmed','unknown');
  if prior_total + p_amount_minor::numeric > payment.amount_minor::numeric then
    raise exception 'REFUND_AMOUNT_INVALID';
  end if;

  insert into public.digital_observer_refunds (
    stable_refund_id,idempotency_key,observer_site_id,subscription_id,payment_event_id,
    invoice_id,refund_status,amount_minor,currency,requested_by,authorized_by,safe_reason
  ) values (
    p_stable_refund_id,p_idempotency_key,site.id,payment.subscription_id,payment.id,
    invoice.id,'authorized',p_amount_minor,p_currency,p_actor_profile_id,p_actor_profile_id,p_safe_reason
  ) returning * into saved;
  if saved.id is null then raise exception 'REFUND_INSERT_FAILED'; end if;

  -- Mandatory financial audit is inside the same PostgreSQL transaction.
  -- Any audit error rolls the refund row back before the RPC returns.
  insert into public.digital_observer_financial_audit (
    observer_site_id,actor_profile_id,actor_type,authorization_reference,
    operation,entity_type,entity_id,previous_state,new_state,
    provider_reference,correlation_id,safe_metadata
  ) values (
    site.id,p_actor_profile_id,'authenticated_user','site_billing_authorization',
    'refund_authorized','refund',saved.id::text,'{}'::jsonb,
    jsonb_build_object('refund_status','authorized','amount_minor',p_amount_minor,'currency',p_currency),
    null,p_stable_refund_id,
    jsonb_build_object('product','digital_observer','raw_payment_data_stored',false)
  );
  return next saved;
end;
$$;

revoke all on function public.authorize_digital_observer_refund_atomic(text,text,uuid,uuid,bigint,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.authorize_digital_observer_refund_atomic(text,text,uuid,uuid,bigint,text,text,uuid)
  to service_role;

-- The deliberate guard above prevents any operation in this file from applying.
