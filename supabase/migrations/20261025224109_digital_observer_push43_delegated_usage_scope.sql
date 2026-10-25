-- PUSH 43 forward-only correction for the server-only hourly usage recorder.
-- The 20261019041000 migration is already recorded as applied in isolated
-- Development and must not be edited. This file is source-only: do not apply
-- without an authorized isolated PostgreSQL/RLS qualification and rollback.
-- No new data, indexes, provider traffic, or retention changes are introduced.
-- Direct PUSH 42 organization/Site ownership remains valid for active accounts;
-- delegated customer usage additionally requires the exact Model A ownership
-- chain and an explicitly linked, non-kindergarten Site.

create or replace function public.record_digital_observer_external_api_usage(
  requested_service_account_id uuid,
  requested_site_id uuid,
  requested_operation text,
  requested_bucket_start timestamptz,
  requested_success boolean
) returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare result_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'external api usage is server-only'; end if;

  if not exists (
    select 1
    from public.digital_observer_service_accounts a
    join public.observer_sites s on s.id=requested_site_id
    where a.id=requested_service_account_id
      and a.account_status='active'
      and a.revoked_at is null
      and a.expires_at>now()
      and (
        -- Preserve the direct PUSH 42 organization/Site ownership path.
        s.digital_observer_organization_id=a.organization_id
        or exists (
          select 1
          from public.digital_observer_partner_service_accounts psa
          join public.digital_observer_partners p
            on p.id=psa.partner_id
            and p.organization_id=a.organization_id
            and p.partner_status='sandbox'
          join public.digital_observer_organizations partner_org
            on partner_org.id=p.organization_id and partner_org.status='active'
          join public.digital_observer_partner_customers pc
            on pc.id=psa.partner_customer_id
            and pc.partner_id=p.id
            and pc.customer_status='active'
          join public.digital_observer_organizations customer_org
            on customer_org.id=pc.customer_organization_id
            and customer_org.status='active'
          join public.digital_observer_partner_customer_sites pcs
            on pcs.partner_customer_id=pc.id and pcs.observer_site_id=s.id
          where psa.service_account_id=a.id
            and psa.access_kind='customer_resources'
            and pc.customer_organization_id<>p.organization_id
            and s.digital_observer_organization_id=pc.customer_organization_id
            and s.garden_id is null
            and s.site_type<>'kindergarten'
        )
      )
  ) then
    raise exception 'service account/site mismatch';
  end if;

  insert into public.digital_observer_external_api_usage_buckets(
    service_account_id,observer_site_id,operation,bucket_start,request_count,success_count,failure_count
  ) values (
    requested_service_account_id,requested_site_id,left(requested_operation,160),date_trunc('hour',requested_bucket_start),1,
    case when requested_success then 1 else 0 end,case when requested_success then 0 else 1 end
  ) on conflict(service_account_id,observer_site_id,operation,bucket_start) do update set
    request_count=digital_observer_external_api_usage_buckets.request_count+1,
    success_count=digital_observer_external_api_usage_buckets.success_count+case when requested_success then 1 else 0 end,
    failure_count=digital_observer_external_api_usage_buckets.failure_count+case when requested_success then 0 else 1 end,
    updated_at=now()
  returning id into result_id;
  return result_id;
end;
$$;

revoke all on function public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean) to service_role;

comment on function public.record_digital_observer_external_api_usage(uuid,uuid,text,timestamptz,boolean) is
  'Server-only hourly usage: active service account, direct organization/Site ownership or active sandbox partner + active customer/organization + exact linked commercial Site. No payload or media.';
