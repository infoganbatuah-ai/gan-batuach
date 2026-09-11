-- PUSH 37: shared queue and fenced control-plane coordination.
-- Service-only RPCs are called after PUSH 18 managed-device authentication.

create table if not exists public.observer_ai_jobs_shared (
  job_id text primary key,
  idempotency_key text not null unique,
  tenant_id text not null,
  site_id text not null,
  source_id text not null,
  ordering_key text not null,
  priority text not null check (priority in ('CRITICAL','HIGH','NORMAL','LOW','LEARNING')),
  capability text not null,
  model_class text not null,
  observed_at timestamptz not null,
  expires_at timestamptz not null,
  payload jsonb not null,
  state text not null default 'PENDING' check (state in ('PENDING','CLAIMED','RETRY_WAIT','COMPLETED','EXPIRED','DEAD_LETTER')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists observer_ai_jobs_shared_ready_idx on public.observer_ai_jobs_shared(state, next_attempt_at, expires_at, priority, created_at);
create index if not exists observer_ai_jobs_shared_scope_idx on public.observer_ai_jobs_shared(tenant_id, site_id, source_id, state);
create index if not exists observer_ai_jobs_shared_order_idx on public.observer_ai_jobs_shared(ordering_key, observed_at, state);

create table if not exists public.observer_ai_results_shared (
  result_id text primary key,
  job_id text not null unique references public.observer_ai_jobs_shared(job_id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create table if not exists public.observer_control_leases (
  resource_id text primary key,
  tenant_id text not null,
  site_id text not null,
  owner_id text not null,
  epoch bigint not null check (epoch > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.observer_control_effects (
  effect_key text primary key,
  resource_id text not null references public.observer_control_leases(resource_id),
  tenant_id text not null,
  site_id text not null,
  owner_id text not null,
  epoch bigint not null,
  effect_type text not null,
  payload_digest text,
  completed_at timestamptz not null default now()
);

alter table public.observer_ai_jobs_shared enable row level security;
alter table public.observer_ai_results_shared enable row level security;
alter table public.observer_control_leases enable row level security;
alter table public.observer_control_effects enable row level security;
revoke all on public.observer_ai_jobs_shared, public.observer_ai_results_shared, public.observer_control_leases, public.observer_control_effects from anon, authenticated;
grant all on public.observer_ai_jobs_shared, public.observer_ai_results_shared, public.observer_control_leases, public.observer_control_effects to service_role;

create or replace function public.observer_ai_job_enqueue_v1(p_job jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare inserted_count integer; canonical_job_id text;
begin
  if p_job->>'contract' <> 'observer-ai-job-v1' or p_job->>'canonical_event' <> 'false' then raise exception 'observer_ai_job_contract_invalid'; end if;
  insert into public.observer_ai_jobs_shared(job_id,idempotency_key,tenant_id,site_id,source_id,ordering_key,priority,capability,model_class,observed_at,expires_at,payload)
  values (p_job->>'job_id',p_job->>'idempotency_key',p_job->>'tenant_id',p_job->>'site_id',p_job->>'source_id',p_job->>'ordering_key',p_job->>'priority',p_job->>'requested_capability',p_job->>'model_class',(p_job->>'observation_timestamp')::timestamptz,(p_job->>'expires_at')::timestamptz,p_job)
  on conflict (idempotency_key) do nothing;
  get diagnostics inserted_count = row_count;
  select job_id into canonical_job_id from public.observer_ai_jobs_shared where idempotency_key=p_job->>'idempotency_key';
  return jsonb_build_object('inserted', inserted_count = 1, 'job_id', canonical_job_id);
end $$;

create or replace function public.observer_ai_job_claim_v1(p_worker_id text, p_tenant_ids text[], p_site_ids text[], p_capabilities text[], p_model_classes text[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare claimed public.observer_ai_jobs_shared%rowtype;
begin
  update public.observer_ai_jobs_shared set state='PENDING',lease_owner=null,lease_expires_at=null where state='CLAIMED' and lease_expires_at <= clock_timestamp();
  update public.observer_ai_jobs_shared set state='EXPIRED',lease_owner=null,lease_expires_at=null,last_error='JOB_EXPIRED' where state in ('PENDING','RETRY_WAIT','CLAIMED') and expires_at <= clock_timestamp();
  select * into claimed from public.observer_ai_jobs_shared j
   where j.state in ('PENDING','RETRY_WAIT') and j.next_attempt_at <= clock_timestamp() and j.expires_at > clock_timestamp()
     and j.tenant_id = any(p_tenant_ids) and j.site_id = any(p_site_ids)
     and j.capability = any(p_capabilities) and j.model_class = any(p_model_classes)
     and not exists (select 1 from public.observer_ai_jobs_shared prior where prior.ordering_key=j.ordering_key and prior.observed_at<j.observed_at and prior.state in ('PENDING','RETRY_WAIT','CLAIMED'))
   order by case j.priority when 'CRITICAL' then 5 when 'HIGH' then 4 when 'NORMAL' then 3 when 'LOW' then 2 else 1 end desc, j.created_at
   for update skip locked limit 1;
  if claimed.job_id is null then return null; end if;
  update public.observer_ai_jobs_shared set state='CLAIMED',lease_owner=p_worker_id,lease_expires_at=clock_timestamp()+interval '30 seconds',attempts=attempts+1 where job_id=claimed.job_id;
  return jsonb_build_object('job',claimed.payload,'attempt',claimed.attempts+1,'lease_expires_at',clock_timestamp()+interval '30 seconds');
end $$;

create or replace function public.observer_ai_job_ack_v1(p_worker_id text, p_job_id text, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare accepted integer;
begin
  if p_result->>'contract' <> 'observer-inference-result-v1' or p_result->>'job_id' <> p_job_id then raise exception 'observer_ai_result_invalid'; end if;
  if not exists(select 1 from public.observer_ai_jobs_shared where job_id=p_job_id and tenant_id=p_result->>'tenant_id' and site_id=p_result->>'site_id' and source_id=p_result->>'source_id') then raise exception 'observer_ai_result_scope_invalid'; end if;
  if exists(select 1 from public.observer_ai_results_shared where job_id=p_job_id) then return jsonb_build_object('acknowledged',true,'duplicate',true); end if;
  if not exists(select 1 from public.observer_ai_jobs_shared where job_id=p_job_id and state='CLAIMED' and lease_owner=p_worker_id and lease_expires_at>clock_timestamp()) then raise exception 'observer_ai_lease_invalid'; end if;
  insert into public.observer_ai_results_shared(result_id,job_id,payload) values(p_result->>'result_id',p_job_id,p_result) on conflict(job_id) do nothing;
  get diagnostics accepted = row_count;
  update public.observer_ai_jobs_shared set state='COMPLETED',completed_at=clock_timestamp(),lease_owner=null,lease_expires_at=null where job_id=p_job_id;
  return jsonb_build_object('acknowledged',true,'duplicate',accepted=0);
end $$;

create or replace function public.observer_ai_job_fail_v1(p_worker_id text,p_job_id text,p_classification text,p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare pending public.observer_ai_jobs_shared%rowtype; max_attempts integer;
begin
  select * into pending from public.observer_ai_jobs_shared where job_id=p_job_id and state='CLAIMED' and lease_owner=p_worker_id and lease_expires_at>clock_timestamp() for update;
  if pending.job_id is null then raise exception 'observer_ai_lease_invalid'; end if;
  max_attempts := greatest(1,least(10,coalesce((pending.payload#>>'{retry_policy,max_attempts}')::integer,3)));
  if p_classification <> 'RETRYABLE' or pending.attempts >= max_attempts then
    update public.observer_ai_jobs_shared set state='DEAD_LETTER',lease_owner=null,lease_expires_at=null,last_error=left(p_reason,96) where job_id=p_job_id;
    return jsonb_build_object('state','DEAD_LETTER');
  end if;
  update public.observer_ai_jobs_shared set state='RETRY_WAIT',next_attempt_at=clock_timestamp()+interval '1 second',lease_owner=null,lease_expires_at=null,last_error=left(p_reason,96) where job_id=p_job_id;
  return jsonb_build_object('state','RETRY_WAIT');
end $$;

create or replace function public.observer_ai_job_result_v1(p_job_id text)
returns jsonb language sql security definer set search_path = public, pg_temp as $$ select payload from public.observer_ai_results_shared where job_id=p_job_id $$;
create or replace function public.observer_ai_queue_recover_v1()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare recovered integer;
begin update public.observer_ai_jobs_shared set state='PENDING',lease_owner=null,lease_expires_at=null where state='CLAIMED' and lease_expires_at<=clock_timestamp(); get diagnostics recovered=row_count; return jsonb_build_object('recovered',recovered); end $$;
create or replace function public.observer_ai_queue_snapshot_v1()
returns jsonb language sql security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('backend','POSTGRES_SHARED_TRANSACTIONAL','queue_depth',coalesce(sum(n) filter(where state in ('PENDING','RETRY_WAIT','CLAIMED')),0),'states',coalesce(jsonb_object_agg(state,n),'{}'::jsonb))
  from (select state,count(*) n from public.observer_ai_jobs_shared group by state) q $$;

create or replace function public.observer_control_lease_acquire_v1(p_resource_id text,p_tenant_id text,p_site_id text,p_owner_id text,p_lease_seconds integer default 30)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare current_lease public.observer_control_leases%rowtype;
begin
  select * into current_lease from public.observer_control_leases where resource_id=p_resource_id;
  if current_lease.resource_id is not null and (current_lease.tenant_id<>p_tenant_id or current_lease.site_id<>p_site_id) then raise exception 'observer_control_scope_mismatch'; end if;
  insert into public.observer_control_leases(resource_id,tenant_id,site_id,owner_id,epoch,expires_at,updated_at)
  values(p_resource_id,p_tenant_id,p_site_id,p_owner_id,1,clock_timestamp()+make_interval(secs=>greatest(1,least(300,p_lease_seconds))),clock_timestamp())
  on conflict(resource_id) do update set
    owner_id=excluded.owner_id,
    epoch=case when observer_control_leases.owner_id=excluded.owner_id and observer_control_leases.expires_at>clock_timestamp() then observer_control_leases.epoch else observer_control_leases.epoch+1 end,
    expires_at=excluded.expires_at,
    updated_at=excluded.updated_at
  where observer_control_leases.tenant_id=excluded.tenant_id and observer_control_leases.site_id=excluded.site_id
    and (observer_control_leases.expires_at<=clock_timestamp() or observer_control_leases.owner_id=excluded.owner_id)
  returning * into current_lease;
  if current_lease.resource_id is null then
    select * into current_lease from public.observer_control_leases where resource_id=p_resource_id;
    return jsonb_build_object('acquired',false,'owner_id',current_lease.owner_id,'epoch',current_lease.epoch);
  end if;
  return jsonb_build_object('acquired',true,'owner_id',current_lease.owner_id,'epoch',current_lease.epoch);
end $$;

create or replace function public.observer_control_effect_once_v1(p_resource_id text,p_tenant_id text,p_site_id text,p_owner_id text,p_epoch bigint,p_effect_key text,p_effect_type text,p_payload_digest text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare inserted_count integer; current_lease public.observer_control_leases%rowtype;
begin
  select * into current_lease from public.observer_control_leases where resource_id=p_resource_id for update;
  if current_lease.resource_id is null or current_lease.tenant_id<>p_tenant_id or current_lease.site_id<>p_site_id or current_lease.owner_id<>p_owner_id or current_lease.epoch<>p_epoch or current_lease.expires_at<=clock_timestamp() then raise exception 'observer_control_fence_rejected'; end if;
  insert into public.observer_control_effects(effect_key,resource_id,tenant_id,site_id,owner_id,epoch,effect_type,payload_digest) values(p_effect_key,p_resource_id,p_tenant_id,p_site_id,p_owner_id,p_epoch,p_effect_type,p_payload_digest) on conflict(effect_key) do nothing;
  get diagnostics inserted_count=row_count;
  return jsonb_build_object('accepted',inserted_count=1,'duplicate',inserted_count=0);
end $$;

revoke all on function public.observer_ai_job_enqueue_v1(jsonb), public.observer_ai_job_claim_v1(text,text[],text[],text[],text[]), public.observer_ai_job_ack_v1(text,text,jsonb), public.observer_ai_job_fail_v1(text,text,text,text), public.observer_ai_job_result_v1(text), public.observer_ai_queue_recover_v1(), public.observer_ai_queue_snapshot_v1(), public.observer_control_lease_acquire_v1(text,text,text,text,integer), public.observer_control_effect_once_v1(text,text,text,text,bigint,text,text,text) from public, anon, authenticated;
grant execute on function public.observer_ai_job_enqueue_v1(jsonb), public.observer_ai_job_claim_v1(text,text[],text[],text[],text[]), public.observer_ai_job_ack_v1(text,text,jsonb), public.observer_ai_job_fail_v1(text,text,text,text), public.observer_ai_job_result_v1(text), public.observer_ai_queue_recover_v1(), public.observer_ai_queue_snapshot_v1(), public.observer_control_lease_acquire_v1(text,text,text,text,integer), public.observer_control_effect_once_v1(text,text,text,text,bigint,text,text,text) to service_role;
