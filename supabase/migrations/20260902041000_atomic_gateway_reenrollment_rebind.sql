-- Atomically move an existing site's camera bindings to a newly enrolled
-- Gateway. Execution is intentionally restricted to service_role so a browser
-- session can never rebind cameras or revoke device credentials directly.
begin;

create or replace function public.rebind_video_gateway_enrollment(
  p_observer_site_id uuid,
  p_old_gateway_id uuid,
  p_new_gateway_id uuid,
  p_actor_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source_count integer := 0;
  v_expired_request_count integer := 0;
  v_revoked_enrollment_count integer := 0;
  v_distinct_source_gateways integer := 0;
begin
  if p_old_gateway_id = p_new_gateway_id then
    raise exception 'gateway_rebind_identity_unchanged' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.video_gateway_device_enrollments enrollment
    where enrollment.observer_site_id = p_observer_site_id
      and enrollment.gateway_id = p_new_gateway_id
      and enrollment.status = 'delivered'
      and enrollment.refresh_token_hash is not null
  ) then
    raise exception 'gateway_rebind_new_enrollment_not_ready' using errcode = '23514';
  end if;

  select count(distinct source.metadata ->> 'gateway_id')
  into v_distinct_source_gateways
  from public.digital_observer_camera_sources source
  where source.observer_site_id = p_observer_site_id
    and coalesce(source.metadata ->> 'gateway_id', '') <> '';

  if v_distinct_source_gateways <> 1 or not exists (
    select 1
    from public.digital_observer_camera_sources source
    where source.observer_site_id = p_observer_site_id
      and source.metadata ->> 'gateway_id' = p_old_gateway_id::text
  ) then
    raise exception 'gateway_rebind_source_scope_ambiguous' using errcode = '23514';
  end if;

  update public.digital_observer_camera_sources source
  set metadata = jsonb_set(source.metadata, '{gateway_id}', to_jsonb(p_new_gateway_id::text), true),
      updated_at = now()
  where source.observer_site_id = p_observer_site_id
    and source.metadata ->> 'gateway_id' = p_old_gateway_id::text;
  get diagnostics v_source_count = row_count;

  if v_source_count = 0 then
    raise exception 'gateway_rebind_no_sources_updated' using errcode = '23514';
  end if;

  update public.digital_observer_camera_action_requests request
  set action_status = 'expired', updated_at = now()
  where request.observer_site_id = p_observer_site_id
    and request.gateway_id = p_old_gateway_id::text
    and request.action_status in ('approved', 'delivered');
  get diagnostics v_expired_request_count = row_count;

  update public.video_gateway_device_enrollments enrollment
  set status = 'revoked',
      refresh_token_hash = null,
      revoked_at = coalesce(enrollment.revoked_at, now()),
      updated_at = now()
  where enrollment.observer_site_id = p_observer_site_id
    and enrollment.gateway_id is distinct from p_new_gateway_id
    and enrollment.status in ('approved', 'delivered');
  get diagnostics v_revoked_enrollment_count = row_count;

  insert into public.immutable_audit_events (
    event_type,
    event_category,
    actor_profile_id,
    target_type,
    target_id,
    risk_level,
    metadata
  ) values (
    'video_gateway_reenrollment_rebound',
    'security',
    p_actor_profile_id,
    'observer_site',
    p_observer_site_id,
    'medium',
    jsonb_build_object(
      'old_gateway_id', p_old_gateway_id,
      'new_gateway_id', p_new_gateway_id,
      'source_count', v_source_count,
      'expired_request_count', v_expired_request_count,
      'revoked_enrollment_count', v_revoked_enrollment_count,
      'physical_actions_enabled', false,
      'physical_action_executed', false
    )
  );

  return jsonb_build_object(
    'source_count', v_source_count,
    'expired_request_count', v_expired_request_count,
    'revoked_enrollment_count', v_revoked_enrollment_count
  );
end;
$$;

revoke all on function public.rebind_video_gateway_enrollment(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.rebind_video_gateway_enrollment(uuid, uuid, uuid, uuid) to service_role;

comment on function public.rebind_video_gateway_enrollment(uuid, uuid, uuid, uuid) is
  'Atomically rebinds one unambiguous site Gateway, expires old queued work, revokes stale enrollments, and appends an immutable audit event.';

notify pgrst, 'reload schema';
commit;
