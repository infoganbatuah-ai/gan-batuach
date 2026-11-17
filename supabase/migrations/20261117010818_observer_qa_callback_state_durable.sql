-- Development-only proposal. Do not apply until the isolated QA database,
-- exact callback host and service-only Data API ACL have been qualified.
begin;

create schema observer_qa_private;
revoke all on schema observer_qa_private from public, anon, authenticated;
grant usage on schema observer_qa_private to service_role;

create table observer_qa_private.callback_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  product text not null check (product = 'digital_observer'),
  flow text not null check (flow in ('verify', 'recovery')),
  browser_binding_hash text not null check (browser_binding_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint observer_qa_callback_lifetime check (
    expires_at > created_at and expires_at <= created_at + interval '5 minutes'
  )
);
create index observer_qa_callback_expiry_idx on observer_qa_private.callback_states(expires_at);
alter table observer_qa_private.callback_states enable row level security;
revoke all on observer_qa_private.callback_states from public, anon, authenticated;
grant select, insert, update on observer_qa_private.callback_states to service_role;

create function public.observer_qa_callback_state_put_v1(
  p_state_hash text, p_product text, p_flow text,
  p_browser_binding_hash text, p_expires_at_ms bigint
) returns boolean language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare inserted_count integer;
declare deadline timestamptz;
begin
  if p_state_hash is null or p_state_hash !~ '^[a-f0-9]{64}$'
     or p_browser_binding_hash is null or p_browser_binding_hash !~ '^[a-f0-9]{64}$'
     or p_product is distinct from 'digital_observer'
     or p_flow is null or p_flow not in ('verify', 'recovery') or p_expires_at_ms is null then
    return false;
  end if;
  deadline := to_timestamp(p_expires_at_ms / 1000.0);
  if deadline <= clock_timestamp() or deadline > clock_timestamp() + interval '5 minutes' then
    return false;
  end if;
  insert into observer_qa_private.callback_states
    (state_hash, product, flow, browser_binding_hash, expires_at)
  values (p_state_hash, p_product, p_flow, p_browser_binding_hash, deadline)
  on conflict (state_hash) do nothing;
  get diagnostics inserted_count = row_count;
  return inserted_count = 1;
end $$;

create function public.observer_qa_callback_state_consume_v1(
  p_state_hash text, p_product text, p_flow text, p_browser_binding_hash text
) returns boolean language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare consumed_count integer;
begin
  if p_state_hash is null or p_state_hash !~ '^[a-f0-9]{64}$'
     or p_browser_binding_hash is null or p_browser_binding_hash !~ '^[a-f0-9]{64}$'
     or p_product is distinct from 'digital_observer'
     or p_flow is null or p_flow not in ('verify', 'recovery') then
    return false;
  end if;
  update observer_qa_private.callback_states
     set consumed_at = clock_timestamp()
   where state_hash = p_state_hash and product = p_product and flow = p_flow
     and browser_binding_hash = p_browser_binding_hash
     and consumed_at is null and expires_at > clock_timestamp();
  get diagnostics consumed_count = row_count;
  return consumed_count = 1;
end $$;

revoke all on function public.observer_qa_callback_state_put_v1(text,text,text,text,bigint)
  from public, anon, authenticated;
revoke all on function public.observer_qa_callback_state_consume_v1(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.observer_qa_callback_state_put_v1(text,text,text,text,bigint) to service_role;
grant execute on function public.observer_qa_callback_state_consume_v1(text,text,text,text) to service_role;

commit;
