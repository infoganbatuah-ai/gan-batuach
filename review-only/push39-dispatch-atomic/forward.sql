-- REVIEW ONLY. Not a migration and never for a canonical database.
begin;
do $$ begin raise exception 'REVIEW_ONLY_PUSH39_DISPATCH_ATOMIC_MUST_NOT_RUN'; end $$;
-- CANDIDATE_START
create or replace function public.persist_digital_observer_dispatch_result_atomic(
  p_delivery_id uuid,
  p_expected_site_id uuid,
  p_expected_recipient_id uuid,
  p_expected_attempt_number integer,
  p_provider_key text,
  p_provider_mode text,
  p_outcome text,
  p_provider_message_id text,
  p_retry_after_seconds integer,
  p_error_code text,
  p_confirmed_delivery boolean,
  p_usage_units numeric
)
returns table(delivery_id uuid, delivery_status text, attempt_number integer, retry_at timestamptz)
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_delivery public.digital_observer_notification_deliveries%rowtype;
  v_now timestamptz;
  v_status text;
  v_retry_at timestamptz;
  v_terminal boolean := false;
  v_request_id text;
  v_attempt_id uuid;
  v_backoff integer;
begin
  -- The caller is the trusted server-side dispatcher AFTER adapter.send.
  -- This RPC does not verify the external provider result and is not an
  -- exactly-once external send or recovery protocol.
  if current_user <> 'service_role' then raise exception 'DISPATCH_CALLER_DENIED'; end if;
  if p_delivery_id is null or p_expected_site_id is null or p_expected_recipient_id is null
    or p_expected_attempt_number is null or p_expected_attempt_number not between 1 and 10
    or p_provider_key is null or length(btrim(p_provider_key)) not between 1 and 100
    or p_provider_key <> btrim(p_provider_key)
    or p_provider_mode is null or p_provider_mode not in ('disabled','sandbox','production')
    or p_outcome is null or p_outcome not in ('success','timeout','rate_limit','temporary_failure',
      'permanent_failure','unknown_outcome','acknowledged','expired','cancelled','blocked')
    or p_confirmed_delivery is null or p_usage_units is null
    or p_usage_units < 0 or p_usage_units > 100000
    or p_retry_after_seconds is not null and p_retry_after_seconds not between 0 and 3600
    or length(coalesce(p_provider_message_id,'')) > 180
    or length(coalesce(p_error_code,'')) > 160 then
    raise exception 'DISPATCH_INPUT_INVALID';
  end if;
  if p_provider_mode = 'disabled' and p_outcome <> 'blocked' then
    raise exception 'DISPATCH_DISABLED_MODE_OUTCOME_INVALID';
  end if;

  select * into v_delivery from public.digital_observer_notification_deliveries
    where id = p_delivery_id for update;
  if not found then raise exception 'DISPATCH_DELIVERY_NOT_FOUND'; end if;
  if v_delivery.observer_site_id is distinct from p_expected_site_id
    or v_delivery.authorization_snapshot->>'profile_id' is distinct from p_expected_recipient_id::text
    or (v_delivery.recipient_profile_id is not null
      and v_delivery.recipient_profile_id is distinct from p_expected_recipient_id)
    or v_delivery.metadata->>'provider_key' is distinct from p_provider_key
    or jsonb_typeof(v_delivery.metadata) <> 'object'
    or v_delivery.delivery_status <> 'dispatching'
    or v_delivery.attempt_count + 1 <> p_expected_attempt_number
    or v_delivery.stable_delivery_id is null or length(v_delivery.stable_delivery_id) = 0
    or v_delivery.expires_at is null then
    raise exception 'DISPATCH_CLAIM_OR_SCOPE_MISMATCH';
  end if;
  if p_provider_mode <> v_delivery.provider_mode
    and not (p_provider_mode = 'disabled' and p_outcome = 'blocked') then
    raise exception 'DISPATCH_MODE_MISMATCH';
  end if;
  v_request_id := v_delivery.stable_delivery_id || ':' || p_expected_attempt_number::text;
  if exists (select 1 from public.digital_observer_delivery_attempts a
    where (a.delivery_id = v_delivery.id and a.attempt_number = p_expected_attempt_number)
      or (a.provider_key = p_provider_key and a.request_id = v_request_id)) then
    raise exception 'DISPATCH_ATTEMPT_DUPLICATE_UNVERIFIED';
  end if;
  v_now := clock_timestamp();
  if v_delivery.expires_at <= v_now or p_outcome = 'expired' then
    v_status := 'expired'; v_terminal := true;
  elsif p_outcome = 'cancelled' then
    v_status := 'cancelled'; v_terminal := true;
  elsif p_outcome = 'acknowledged' then
    v_status := 'acknowledged'; v_terminal := true;
  elsif p_outcome = 'success' then
    v_status := 'sent';
  elsif p_outcome = 'unknown_outcome' then
    v_status := 'unknown_outcome'; v_terminal := true;
  elsif p_outcome in ('permanent_failure','blocked') then
    v_status := 'terminal_failure'; v_terminal := true;
  elsif p_expected_attempt_number >= v_delivery.max_attempts then
    v_status := 'dead_letter'; v_terminal := true;
  else
    v_status := 'retry_scheduled';
    v_backoff := greatest(least(3600, 15 * power(2, p_expected_attempt_number - 1))::integer,
      coalesce(p_retry_after_seconds, 0));
    v_retry_at := v_now + (v_backoff * interval '1 second');
  end if;

  insert into public.digital_observer_delivery_attempts
    (delivery_id,observer_site_id,attempt_number,provider_key,provider_mode,
     request_id,outcome,provider_message_id,retryable,retry_after,error_code,
     usage_units,metadata)
  values
    (v_delivery.id,v_delivery.observer_site_id,p_expected_attempt_number,p_provider_key,
     p_provider_mode,v_request_id,p_outcome,p_provider_message_id,
     v_status='retry_scheduled',v_retry_at,p_error_code,p_usage_units,
     jsonb_build_object('confirmed_delivery',p_confirmed_delivery,
       'raw_provider_response_stored',false))
  returning id into v_attempt_id;
  if v_attempt_id is null then raise exception 'DISPATCH_ATTEMPT_INSERT_FAILED'; end if;

  update public.digital_observer_notification_deliveries d set
    delivery_status = v_status,
    attempt_count = p_expected_attempt_number,
    provider_message_id = p_provider_message_id,
    next_retry_at = v_retry_at,
    sent_at = case when p_outcome='success' then v_now else null end,
    terminal_at = case when v_terminal then v_now else null end,
    unknown_outcome_at = case when p_outcome='unknown_outcome' then v_now else null end,
    dead_lettered_at = case when v_status='dead_letter' then v_now else null end,
    failure_reason = p_error_code,
    updated_at = v_now,
    metadata = v_delivery.metadata || jsonb_build_object(
      'external_message_sent',p_confirmed_delivery,'last_outcome',p_outcome)
  where d.id = v_delivery.id and d.observer_site_id = v_delivery.observer_site_id
    and d.delivery_status = 'dispatching'
    and d.attempt_count = p_expected_attempt_number - 1;
  if not found then raise exception 'DISPATCH_DELIVERY_UPDATE_FAILED'; end if;
  return query select v_delivery.id, v_status, p_expected_attempt_number, v_retry_at;
end;
$function$;

revoke all on function public.persist_digital_observer_dispatch_result_atomic(
  uuid,uuid,uuid,integer,text,text,text,text,integer,text,boolean,numeric)
  from public,anon,authenticated;
grant execute on function public.persist_digital_observer_dispatch_result_atomic(
  uuid,uuid,uuid,integer,text,text,text,text,integer,text,boolean,numeric)
  to service_role;
commit;
