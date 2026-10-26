-- REVIEW ONLY. Never execute against a canonical database. The deliberate guard
-- is removed in memory by the disposable, networkless PostgreSQL QA runner only.
begin;
do $$ begin raise exception 'REVIEW_ONLY_PUSH39_CALLBACK_ATOMIC_MUST_NOT_RUN'; end $$;
-- CANDIDATE_START
create or replace function public.record_digital_observer_provider_callback_atomic(
  p_delivery_id uuid, p_provider_key text, p_provider_event_id text,
  p_outcome text, p_occurred_at timestamptz default null,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns table(replay boolean, ignored_terminal boolean, delivery_status text)
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_delivery public.digital_observer_notification_deliveries%rowtype;
  v_existing public.digital_observer_provider_callbacks%rowtype;
  v_now timestamptz := clock_timestamp();
  v_status text;
  v_retry_at timestamptz;
  v_terminal boolean := false;
  v_ignored boolean := false;
  v_attempt integer;
begin
  -- Only the server-side, signature-verifying callback route may invoke this
  -- service_role RPC. The database cannot independently verify the provider's
  -- HMAC; no client-supplied signature_valid flag is accepted.
  if current_user <> 'service_role' then
    raise exception 'CALLBACK_CALLER_DENIED';
  end if;
  if p_delivery_id is null or p_provider_key is null or length(btrim(p_provider_key)) not between 1 and 100
    or p_provider_event_id is null or length(btrim(p_provider_event_id)) not between 1 and 180
    or p_outcome is null or p_outcome not in
      ('success','timeout','rate_limit','temporary_failure','permanent_failure',
       'unknown_outcome','acknowledged','expired','cancelled')
    or p_safe_metadata is null or jsonb_typeof(p_safe_metadata) <> 'object' then
    raise exception 'CALLBACK_INPUT_INVALID';
  end if;
  if p_provider_key <> btrim(p_provider_key) or p_provider_event_id <> btrim(p_provider_event_id) then
    raise exception 'CALLBACK_INPUT_INVALID';
  end if;

  select * into v_delivery from public.digital_observer_notification_deliveries
    where id = p_delivery_id for update;
  if not found then raise exception 'CALLBACK_DELIVERY_NOT_FOUND'; end if;
  if v_delivery.provider_mode <> 'production' or v_delivery.channel = 'in_app'
    or v_delivery.metadata->>'provider_key' is distinct from p_provider_key
    or v_delivery.observer_site_id is null
    or coalesce(v_delivery.authorization_snapshot->>'profile_id', '') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (v_delivery.recipient_profile_id is not null and
      v_delivery.authorization_snapshot->>'profile_id' is distinct from v_delivery.recipient_profile_id::text) then
    raise exception 'CALLBACK_PROVIDER_OR_SCOPE_MISMATCH';
  end if;
  if not exists (
    select 1 from public.digital_observer_provider_channels c
    where c.observer_site_id = v_delivery.observer_site_id
      and c.channel = v_delivery.channel and c.provider_key = p_provider_key
      and c.provider_mode = 'production' and c.active and c.configuration_status = 'ready'
  ) then raise exception 'CALLBACK_PROVIDER_OR_SCOPE_MISMATCH'; end if;

  select * into v_existing from public.digital_observer_provider_callbacks
    where provider_key = p_provider_key and provider_event_id = p_provider_event_id;
  if found then
    if v_existing.delivery_id is distinct from v_delivery.id
      or v_existing.observer_site_id is distinct from v_delivery.observer_site_id
      or v_existing.callback_status is distinct from p_outcome
      or v_existing.signature_valid is distinct from true
      or v_existing.occurred_at is distinct from p_occurred_at
      or v_existing.safe_metadata is distinct from p_safe_metadata then
      raise exception 'CALLBACK_EVENT_ID_CONFLICT';
    end if;
    -- Safe only after historical preflight proves legacy callbacks are not
    -- orphaned by the pre-RPC two-write implementation.
    return query select true, false, v_delivery.delivery_status;
    return;
  end if;

  v_status := v_delivery.delivery_status;
  if v_status in ('acknowledged','cancelled','expired','terminal_failure','dead_letter','unknown_outcome')
    or (v_status = 'delivered' and p_outcome <> 'acknowledged') then
    v_ignored := true;
  elsif v_status not in ('sent','delivered') then
    raise exception 'CALLBACK_DELIVERY_NOT_ELIGIBLE';
  elsif v_delivery.expires_at is null then
    raise exception 'CALLBACK_EXPIRY_MISSING';
  elsif v_status = 'delivered' and v_delivery.expires_at <= v_now then
    v_ignored := true;
  else
    v_attempt := v_delivery.attempt_count;
    if v_attempt not between 1 and v_delivery.max_attempts then
      raise exception 'CALLBACK_ATTEMPT_INVALID';
    end if;
    if v_delivery.expires_at <= v_now or p_outcome = 'expired' then
      v_status := 'expired'; v_terminal := true;
    elsif p_outcome = 'cancelled' then
      v_status := 'cancelled'; v_terminal := true;
    elsif p_outcome = 'acknowledged' then
      v_status := 'acknowledged'; v_terminal := true;
    elsif p_outcome = 'success' then
      v_status := 'delivered';
    elsif p_outcome = 'unknown_outcome' then
      v_status := 'unknown_outcome'; v_terminal := true;
    elsif p_outcome = 'permanent_failure' then
      v_status := 'terminal_failure'; v_terminal := true;
    elsif v_attempt >= v_delivery.max_attempts then
      v_status := 'dead_letter'; v_terminal := true;
    else
      v_status := 'retry_scheduled';
      v_retry_at := v_now + (least(3600, 15 * power(2, v_attempt - 1))::integer * interval '1 second');
    end if;
  end if;

  -- Callback evidence and delivery state share this one PostgreSQL transaction.
  -- Any constraint/trigger/update failure rolls the INSERT back too.
  insert into public.digital_observer_provider_callbacks
    (observer_site_id, delivery_id, provider_key, provider_event_id,
     callback_status, signature_valid, replay_detected, occurred_at, safe_metadata)
  values (v_delivery.observer_site_id, v_delivery.id, p_provider_key, p_provider_event_id,
          p_outcome, true, false, p_occurred_at, p_safe_metadata);

  if not v_ignored then
    update public.digital_observer_notification_deliveries d set
      delivery_status = v_status,
      acknowledged_at = case when p_outcome = 'acknowledged' then v_now else null end,
      terminal_at = case when v_terminal then v_now else null end,
      unknown_outcome_at = case when p_outcome = 'unknown_outcome' then v_now else null end,
      next_retry_at = v_retry_at,
      updated_at = v_now
    where d.id = v_delivery.id and d.observer_site_id = v_delivery.observer_site_id
      and d.delivery_status = v_delivery.delivery_status
      and d.attempt_count = v_delivery.attempt_count;
    if not found then raise exception 'CALLBACK_DELIVERY_UPDATE_FAILED'; end if;
  end if;
  return query select false, v_ignored, v_status;
end;
$function$;

revoke all on function public.record_digital_observer_provider_callback_atomic(
  uuid,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.record_digital_observer_provider_callback_atomic(
  uuid,text,text,text,timestamptz,jsonb) to service_role;
commit;
