-- PUSH 12: canonical, confirmed Natural-Language Watch Rules.
-- Natural language is only an input method. Runtime execution remains bounded,
-- deterministic, tenant-scoped and downstream of REAL_CAMERA_AI Events.

alter table public.observer_watch_requests
  add column if not exists original_natural_language text,
  add column if not exists structured_rule jsonb,
  add column if not exists validation_status text not null default 'LEGACY',
  add column if not exists compiler_version text,
  add column if not exists rule_version integer not null default 0,
  add column if not exists rule_state text not null default 'LEGACY',
  add column if not exists confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists last_matched_at timestamptz,
  add column if not exists match_count bigint not null default 0;

alter table public.observer_watch_requests drop constraint if exists observer_watch_rule_validation_status_check;
alter table public.observer_watch_requests add constraint observer_watch_rule_validation_status_check
  check (validation_status in ('LEGACY','VALID','INVALID','UNSUPPORTED','NEEDS_CLARIFICATION'));
alter table public.observer_watch_requests drop constraint if exists observer_watch_rule_state_check;
alter table public.observer_watch_requests add constraint observer_watch_rule_state_check
  check (rule_state in ('LEGACY','PENDING_CONFIRMATION','ACTIVE','DISABLED','ARCHIVED','INVALID'));
alter table public.observer_watch_requests drop constraint if exists observer_watch_rule_version_check;
alter table public.observer_watch_requests add constraint observer_watch_rule_version_check
  check (rule_version >= 0);
alter table public.observer_watch_requests drop constraint if exists observer_watch_rule_match_count_check;
alter table public.observer_watch_requests add constraint observer_watch_rule_match_count_check
  check (match_count >= 0);

create table if not exists public.digital_observer_watch_rule_versions (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  rule_id uuid not null references public.observer_watch_requests(id) on delete cascade,
  version integer not null,
  original_natural_language text not null,
  structured_rule jsonb not null,
  validation_status text not null,
  compiler_version text not null,
  candidate_fingerprint text not null,
  created_by uuid references public.profiles(id) on delete set null,
  change_type text not null,
  previous_version_id uuid references public.digital_observer_watch_rule_versions(id) on delete set null,
  environment text not null default 'PRODUCTION',
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  constraint digital_observer_watch_rule_version_positive check (version > 0),
  constraint digital_observer_watch_rule_validation_check check (validation_status = 'VALID'),
  constraint digital_observer_watch_rule_change_check check (change_type in ('CREATE','EDIT','DISABLE','ENABLE','ARCHIVE')),
  constraint digital_observer_watch_rule_environment_check check (environment in ('PRODUCTION','STAGING','TEST','DEMO')),
  constraint digital_observer_watch_rule_fingerprint_check check (length(candidate_fingerprint) = 64),
  constraint digital_observer_watch_rule_idempotency_length check (length(idempotency_key) between 8 and 160),
  unique (rule_id, version),
  unique (observer_site_id, idempotency_key)
);

create table if not exists public.digital_observer_watch_rule_evaluations (
  id uuid primary key default gen_random_uuid(),
  observer_site_id uuid not null references public.observer_sites(id) on delete cascade,
  rule_id uuid not null references public.observer_watch_requests(id) on delete cascade,
  rule_version integer not null,
  event_id uuid not null references public.observer_intelligence_signals(id) on delete cascade,
  incident_id uuid references public.observer_correlated_events(id) on delete cascade,
  risk_evaluation_id uuid references public.digital_observer_risk_evaluations(id) on delete set null,
  matched boolean not null,
  matched_conditions jsonb not null default '[]'::jsonb,
  non_match_reasons jsonb not null default '[]'::jsonb,
  input_fingerprint text not null,
  evaluation_version text not null default 'do-watch-evaluator-v1',
  event_provenance text not null,
  evaluated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint digital_observer_watch_rule_evaluation_version_check check (rule_version > 0),
  constraint digital_observer_watch_rule_evaluation_fingerprint_check check (length(input_fingerprint) = 64),
  constraint digital_observer_watch_rule_real_provenance_check check (event_provenance = 'REAL_CAMERA_AI'),
  unique (rule_id, rule_version, event_id)
);

create index if not exists digital_observer_watch_rule_versions_history_idx
  on public.digital_observer_watch_rule_versions(rule_id, version desc);
create index if not exists digital_observer_watch_rule_evaluations_rule_idx
  on public.digital_observer_watch_rule_evaluations(rule_id, evaluated_at desc);
create index if not exists digital_observer_watch_rule_evaluations_event_idx
  on public.digital_observer_watch_rule_evaluations(event_id, evaluated_at desc);
create index if not exists observer_watch_requests_compiled_active_idx
  on public.observer_watch_requests(observer_site_id, rule_state, active, priority desc)
  where compiler_version is not null;

alter table public.digital_observer_watch_rule_versions enable row level security;
alter table public.digital_observer_watch_rule_evaluations enable row level security;

drop policy if exists "Digital Observer watch rule versions scoped read" on public.digital_observer_watch_rule_versions;
create policy "Digital Observer watch rule versions scoped read" on public.digital_observer_watch_rule_versions
for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_sites site
    where site.id = digital_observer_watch_rule_versions.observer_site_id
      and site.owner_profile_id = auth.uid()
  )
  or exists (
    select 1 from public.observer_site_memberships membership
    where membership.observer_site_id = digital_observer_watch_rule_versions.observer_site_id
      and membership.profile_id = auth.uid()
      and membership.active = true
      and membership.member_role in ('owner','admin','operator','viewer')
  )
);

drop policy if exists "Digital Observer watch rule evaluations scoped read" on public.digital_observer_watch_rule_evaluations;
create policy "Digital Observer watch rule evaluations scoped read" on public.digital_observer_watch_rule_evaluations
for select using (
  public.is_admin()
  or exists (
    select 1 from public.observer_sites site
    where site.id = digital_observer_watch_rule_evaluations.observer_site_id
      and site.owner_profile_id = auth.uid()
  )
  or exists (
    select 1 from public.observer_site_memberships membership
    where membership.observer_site_id = digital_observer_watch_rule_evaluations.observer_site_id
      and membership.profile_id = auth.uid()
      and membership.active = true
      and membership.member_role in ('owner','admin','operator','viewer')
  )
);

create or replace function public.activate_digital_observer_watch_rule(
  requested_observer_site_id uuid,
  requested_rule_id uuid,
  requested_original_text text,
  requested_structured_rule jsonb,
  requested_compiler_version text,
  requested_candidate_fingerprint text,
  requested_idempotency_key text,
  requested_title text,
  requested_watch_type text,
  requested_priority integer,
  requested_schedule jsonb,
  requested_metadata jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  rule_row public.observer_watch_requests;
  version_row public.digital_observer_watch_rule_versions;
  prior_version public.digital_observer_watch_rule_versions;
  camera_id_value uuid;
  zone_id_value uuid;
  next_version integer;
  action_value text;
begin
  if auth.uid() is null or not public.can_manage_observer_site(requested_observer_site_id) then
    raise exception 'WATCH_RULE_ACCESS_DENIED';
  end if;
  if length(trim(requested_original_text)) not between 3 and 1200
    or length(requested_candidate_fingerprint) <> 64
    or length(requested_idempotency_key) not between 8 and 160
    or requested_compiler_version <> 'do-watch-compiler-v1'
    or requested_structured_rule->>'schemaVersion' <> 'do-watch-rule-v1'
    or requested_structured_rule->>'observerSiteId' <> requested_observer_site_id::text
    or requested_structured_rule->>'environment' not in ('PRODUCTION','STAGING','TEST','DEMO')
    or coalesce((requested_structured_rule#>>'{safety,externalExecutionEnabled}')::boolean, true) <> false
    or coalesce((requested_structured_rule#>>'{safety,requiresUserConfirmation}')::boolean, false) <> true
    or coalesce((requested_structured_rule#>>'{safety,realCameraEventsOnly}')::boolean, false) <> true
    or requested_watch_type not in ('movement_in_area','restricted_area_entry','after_hours_activity')
    or requested_priority not between 1 and 10 then
    raise exception 'WATCH_RULE_CONTRACT_INVALID';
  end if;

  action_value := requested_structured_rule#>>'{policyIntent,minimumDecision}';
  if action_value not in ('LOG_ONLY','PRESERVE_EVIDENCE','VERIFY','NOTIFY_IN_APP') then
    raise exception 'WATCH_RULE_ACTION_UNSUPPORTED';
  end if;
  if jsonb_array_length(coalesce(requested_structured_rule#>'{target,cameraSourceIds}', '[]'::jsonb)) < 1 then
    raise exception 'WATCH_RULE_CAMERA_REQUIRED';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(requested_structured_rule#>'{target,cameraSourceIds}') camera_ref
    left join public.digital_observer_camera_sources source
      on source.id = camera_ref::uuid and source.observer_site_id = requested_observer_site_id
    where source.id is null
  ) then
    raise exception 'WATCH_RULE_CAMERA_SCOPE_INVALID';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(requested_structured_rule#>'{target,zoneIds}', '[]'::jsonb)) zone_ref
    left join public.camera_zones zone
      on zone.id = zone_ref::uuid and zone.observer_site_id = requested_observer_site_id
    where zone.id is null
  ) then
    raise exception 'WATCH_RULE_ZONE_SCOPE_INVALID';
  end if;

  select * into version_row
  from public.digital_observer_watch_rule_versions
  where observer_site_id = requested_observer_site_id and idempotency_key = requested_idempotency_key;
  if found then
    select * into rule_row from public.observer_watch_requests where id = version_row.rule_id;
    return jsonb_build_object('rule_id', rule_row.id, 'version_id', version_row.id, 'version', version_row.version, 'idempotent', true, 'state', rule_row.rule_state);
  end if;

  select nullif(requested_structured_rule#>>'{target,cameraSourceIds,0}', '')::uuid into camera_id_value;
  select nullif(requested_structured_rule#>>'{target,zoneIds,0}', '')::uuid into zone_id_value;

  if requested_rule_id is null then
    insert into public.observer_watch_requests (
      observer_site_id, kindergarten_id, camera_id, camera_source_id, zone_id, created_by,
      title, description, watch_type, active, priority, schedule, notification_channels,
      requires_human_review, metadata, original_natural_language, structured_rule,
      validation_status, compiler_version, rule_version, rule_state, confirmed_by, confirmed_at
    ) values (
      requested_observer_site_id, null, null, camera_id_value, zone_id_value, auth.uid(),
      left(requested_title, 140), requested_original_text, requested_watch_type, true, requested_priority,
      requested_schedule,
      case when action_value = 'NOTIFY_IN_APP' then '["in_app"]'::jsonb else '[]'::jsonb end,
      true,
      coalesce(requested_metadata, '{}'::jsonb) || jsonb_build_object(
        'product', 'digital_observer',
        'canonical_compiled_rule', true,
        'compiler_version', requested_compiler_version,
        'rule_version', 1,
        'execution_state', 'production_real_event_policy',
        'no_external_action_execution', true,
        'risk_policy', jsonb_build_object(
          'event_types', requested_structured_rule#>'{conditions,eventTypes}',
          'minimum_decision', action_value,
          'minimum_risk_score', null,
          'contribution', coalesce((requested_structured_rule#>>'{policyIntent,riskContribution}')::integer, 0),
          'version', 'watch-rule-1',
          'reason', 'canonical_natural_language_watch_rule'
        )
      ),
      requested_original_text, requested_structured_rule, 'VALID', requested_compiler_version,
      1, 'ACTIVE', auth.uid(), now()
    ) returning * into rule_row;
    next_version := 1;
  else
    select * into rule_row from public.observer_watch_requests
    where id = requested_rule_id and observer_site_id = requested_observer_site_id for update;
    if not found or rule_row.compiler_version is null then raise exception 'WATCH_RULE_NOT_FOUND'; end if;
    next_version := rule_row.rule_version + 1;
    select * into prior_version from public.digital_observer_watch_rule_versions
      where rule_id = rule_row.id order by version desc limit 1;
    update public.observer_watch_requests set
      camera_source_id = camera_id_value,
      zone_id = zone_id_value,
      title = left(requested_title, 140),
      description = requested_original_text,
      watch_type = requested_watch_type,
      active = true,
      priority = requested_priority,
      schedule = requested_schedule,
      notification_channels = case when action_value = 'NOTIFY_IN_APP' then '["in_app"]'::jsonb else '[]'::jsonb end,
      metadata = coalesce(requested_metadata, '{}'::jsonb) || jsonb_build_object(
        'product', 'digital_observer',
        'canonical_compiled_rule', true,
        'compiler_version', requested_compiler_version,
        'rule_version', next_version,
        'execution_state', 'production_real_event_policy',
        'no_external_action_execution', true,
        'risk_policy', jsonb_build_object(
          'event_types', requested_structured_rule#>'{conditions,eventTypes}',
          'minimum_decision', action_value,
          'minimum_risk_score', null,
          'contribution', coalesce((requested_structured_rule#>>'{policyIntent,riskContribution}')::integer, 0),
          'version', 'watch-rule-' || next_version,
          'reason', 'canonical_natural_language_watch_rule'
        )
      ),
      original_natural_language = requested_original_text,
      structured_rule = requested_structured_rule,
      validation_status = 'VALID',
      compiler_version = requested_compiler_version,
      rule_version = next_version,
      rule_state = 'ACTIVE',
      confirmed_by = auth.uid(),
      confirmed_at = now(),
      archived_at = null,
      updated_at = now()
    where id = rule_row.id returning * into rule_row;
  end if;

  insert into public.digital_observer_watch_rule_versions (
    observer_site_id, rule_id, version, original_natural_language, structured_rule,
    validation_status, compiler_version, candidate_fingerprint, created_by, change_type,
    previous_version_id, environment, idempotency_key
  ) values (
    requested_observer_site_id, rule_row.id, next_version, requested_original_text, requested_structured_rule,
    'VALID', requested_compiler_version, requested_candidate_fingerprint, auth.uid(),
    case when requested_rule_id is null then 'CREATE' else 'EDIT' end,
    prior_version.id, requested_structured_rule->>'environment', requested_idempotency_key
  ) returning * into version_row;

  return jsonb_build_object('rule_id', rule_row.id, 'version_id', version_row.id, 'version', next_version, 'idempotent', false, 'state', rule_row.rule_state);
end;
$$;

create or replace function public.set_digital_observer_watch_rule_state(
  requested_rule_id uuid,
  requested_state text,
  requested_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  rule_row public.observer_watch_requests;
  version_row public.digital_observer_watch_rule_versions;
  prior_version public.digital_observer_watch_rule_versions;
  next_version integer;
  next_active boolean;
  change_value text;
begin
  select * into rule_row from public.observer_watch_requests where id = requested_rule_id for update;
  if not found or rule_row.observer_site_id is null or rule_row.compiler_version is null then raise exception 'WATCH_RULE_NOT_FOUND'; end if;
  if auth.uid() is null or not public.can_manage_observer_site(rule_row.observer_site_id) then raise exception 'WATCH_RULE_ACCESS_DENIED'; end if;
  if requested_state not in ('ACTIVE','DISABLED','ARCHIVED') or length(requested_idempotency_key) not between 8 and 160 then raise exception 'WATCH_RULE_STATE_INVALID'; end if;
  select * into version_row from public.digital_observer_watch_rule_versions
    where observer_site_id = rule_row.observer_site_id and idempotency_key = requested_idempotency_key;
  if found then return jsonb_build_object('rule_id', rule_row.id, 'version_id', version_row.id, 'version', version_row.version, 'idempotent', true, 'state', rule_row.rule_state); end if;
  next_version := rule_row.rule_version + 1;
  next_active := requested_state = 'ACTIVE';
  change_value := case requested_state when 'ACTIVE' then 'ENABLE' when 'DISABLED' then 'DISABLE' else 'ARCHIVE' end;
  select * into prior_version from public.digital_observer_watch_rule_versions where rule_id = rule_row.id order by version desc limit 1;
  update public.observer_watch_requests set
    active = next_active,
    rule_state = requested_state,
    rule_version = next_version,
    archived_at = case when requested_state = 'ARCHIVED' then now() else null end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('rule_version', next_version, 'state_changed_by', auth.uid()),
    updated_at = now()
  where id = rule_row.id returning * into rule_row;
  insert into public.digital_observer_watch_rule_versions (
    observer_site_id, rule_id, version, original_natural_language, structured_rule,
    validation_status, compiler_version, candidate_fingerprint, created_by, change_type,
    previous_version_id, environment, idempotency_key
  ) values (
    rule_row.observer_site_id, rule_row.id, next_version, rule_row.original_natural_language,
    rule_row.structured_rule, 'VALID', rule_row.compiler_version,
    encode(extensions.digest(rule_row.structured_rule::text, 'sha256'::text), 'hex'), auth.uid(), change_value,
    prior_version.id, coalesce(rule_row.structured_rule->>'environment', 'PRODUCTION'), requested_idempotency_key
  ) returning * into version_row;
  return jsonb_build_object('rule_id', rule_row.id, 'version_id', version_row.id, 'version', next_version, 'idempotent', false, 'state', rule_row.rule_state);
end;
$$;

create or replace function public.record_digital_observer_watch_rule_evaluation(
  requested_rule_id uuid,
  requested_rule_version integer,
  requested_event_id uuid,
  requested_incident_id uuid,
  requested_risk_evaluation_id uuid,
  requested_matched boolean,
  requested_matched_conditions jsonb,
  requested_non_match_reasons jsonb,
  requested_input_fingerprint text,
  requested_evaluated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  rule_row public.observer_watch_requests;
  event_row public.observer_intelligence_signals;
  incident_row public.observer_correlated_events;
  evaluation_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'WATCH_RULE_EVALUATION_SERVICE_ONLY'; end if;
  select * into rule_row from public.observer_watch_requests where id = requested_rule_id;
  select * into event_row from public.observer_intelligence_signals where id = requested_event_id;
  if rule_row.id is null or event_row.id is null or rule_row.observer_site_id is null or event_row.observer_site_id is distinct from rule_row.observer_site_id
    or event_row.source_type <> 'system'
    or event_row.metadata->>'observation_provenance' <> 'REAL_CAMERA_AI'
    or coalesce((event_row.metadata->>'validated_event')::boolean, false) <> true then
    raise exception 'WATCH_RULE_EVALUATION_SCOPE_INVALID';
  end if;
  if requested_incident_id is not null then
    select * into incident_row from public.observer_correlated_events where id = requested_incident_id;
    if not found or incident_row.observer_site_id is distinct from rule_row.observer_site_id or incident_row.provenance <> 'REAL_CAMERA_AI' then
      raise exception 'WATCH_RULE_INCIDENT_SCOPE_INVALID';
    end if;
  end if;
  insert into public.digital_observer_watch_rule_evaluations (
    observer_site_id, rule_id, rule_version, event_id, incident_id, risk_evaluation_id,
    matched, matched_conditions, non_match_reasons, input_fingerprint,
    evaluation_version, event_provenance, evaluated_at, metadata
  ) values (
    rule_row.observer_site_id, rule_row.id, requested_rule_version, event_row.id,
    requested_incident_id, requested_risk_evaluation_id, requested_matched,
    coalesce(requested_matched_conditions, '[]'::jsonb), coalesce(requested_non_match_reasons, '[]'::jsonb),
    requested_input_fingerprint, 'do-watch-evaluator-v1', 'REAL_CAMERA_AI',
    coalesce(requested_evaluated_at, now()), jsonb_build_object('external_action_executed', false)
  ) on conflict (rule_id, rule_version, event_id) do nothing returning id into evaluation_id;
  if evaluation_id is not null and requested_matched then
    update public.observer_watch_requests set
      last_matched_at = coalesce(requested_evaluated_at, now()),
      match_count = match_count + 1,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_real_event_id', requested_event_id, 'last_real_incident_id', requested_incident_id)
    where id = rule_row.id and rule_version = requested_rule_version and active = true and rule_state = 'ACTIVE';
  end if;
  return jsonb_build_object('evaluation_id', evaluation_id, 'inserted', evaluation_id is not null, 'matched', requested_matched);
end;
$$;

revoke all on function public.activate_digital_observer_watch_rule(uuid,uuid,text,jsonb,text,text,text,text,text,integer,jsonb,jsonb) from public;
grant execute on function public.activate_digital_observer_watch_rule(uuid,uuid,text,jsonb,text,text,text,text,text,integer,jsonb,jsonb) to authenticated;
revoke all on function public.set_digital_observer_watch_rule_state(uuid,text,text) from public;
grant execute on function public.set_digital_observer_watch_rule_state(uuid,text,text) to authenticated;
revoke all on function public.record_digital_observer_watch_rule_evaluation(uuid,integer,uuid,uuid,uuid,boolean,jsonb,jsonb,text,timestamptz) from public;
grant execute on function public.record_digital_observer_watch_rule_evaluation(uuid,integer,uuid,uuid,uuid,boolean,jsonb,jsonb,text,timestamptz) to service_role;

comment on table public.digital_observer_watch_rule_versions is 'Immutable versions of user-confirmed bounded Natural-Language Watch Rules. Text never executes directly.';
comment on table public.digital_observer_watch_rule_evaluations is 'Auditable deterministic match/non-match results for canonical REAL_CAMERA_AI Events.';
comment on column public.observer_watch_requests.structured_rule is 'Validated do-watch-rule-v1 contract used by the existing Risk/Decision engine; never arbitrary model output or executable code.';

notify pgrst, 'reload schema';
