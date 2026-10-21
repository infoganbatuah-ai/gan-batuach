-- PR #235 preparation ONLY. Do not apply to Production without a separate
-- owner-approved change window. This does not create a login, approval or
-- comparison endpoint and does not mutate device records.
begin;

create role home_legacy_compare_reader nologin noinherit nobypassrls;
create schema private_home_legacy_compare;
revoke all on schema private_home_legacy_compare from public;
grant usage on schema private_home_legacy_compare to home_legacy_compare_reader;

-- No base-table grant. The fixed SQL predicate, not a caller-side filter,
-- restricts the only permitted verifier read to two exact Home registrations.
-- SECURITY DEFINER is necessary because the reader has no table privilege;
-- its owner, search_path and grants require review against live Production
-- before this migration can be authorized.
create function private_home_legacy_compare.read_exact_enrollment(p_gateway_id uuid)
returns table (
  id uuid, gateway_id uuid, observer_site_id uuid, tenant_id uuid,
  deployment_profile text, config_version integer, status text,
  lifecycle_state text, identity_scheme text, refresh_token_hash text
)
language sql stable security definer
set search_path = pg_catalog
as $$
  select e.id, e.gateway_id, e.observer_site_id, e.tenant_id,
    e.deployment_profile, e.config_version, e.status,
    e.lifecycle_state, e.identity_scheme, e.refresh_token_hash
  from public.video_gateway_device_enrollments e
  where e.gateway_id = p_gateway_id
    and e.gateway_id in (
      '62df97e2-3c0b-427f-9108-bde029bc10e7'::uuid,
      'db267b52-6282-4944-bcee-5d4857698fb0'::uuid
    )
    and e.observer_site_id = 'cc1673b8-3eb0-4785-a12c-1fb88f425a41'::uuid
  limit 2
$$;

revoke all on function private_home_legacy_compare.read_exact_enrollment(uuid) from public;
grant execute on function private_home_legacy_compare.read_exact_enrollment(uuid)
  to home_legacy_compare_reader;
comment on function private_home_legacy_compare.read_exact_enrollment(uuid) is
  'Private, exact-two-device verifier read for separately approved host-local comparison; never expose through PostgREST or logs.';

commit;
