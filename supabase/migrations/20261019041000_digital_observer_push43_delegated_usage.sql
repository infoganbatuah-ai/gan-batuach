-- DIGITAL OBSERVER PUSH 43: meter delegated OEM customer API usage without
-- weakening the PUSH 42 direct organization boundary.
--
-- Data owner: Digital Observer commercial/API platform.
-- Sensitivity: bounded hourly usage counters; no credentials, payloads, media,
-- or customer personal data.
-- Retention/volume/cost: unchanged from the PUSH 42 usage bucket contract.
-- Recovery: restore the prior function body from migration 20261019030000.

create or replace function public.record_digital_observer_external_api_usage(
  requested_service_account_id uuid,
  requested_site_id uuid,
  requested_operation text,
  requested_bucket_start timestamptz,
  requested_success boolean
) returns uuid language plpgsql security definer set search_path=public set row_security=off as $$
declare result_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'external api usage is server-only'; end if;

  if not exists (
    select 1
    from public.digital_observer_service_accounts a
    join public.observer_sites s on s.digital_observer_organization_id=a.organization_id
    where a.id=requested_service_account_id and s.id=requested_site_id
  ) and not exists (
    select 1
    from public.digital_observer_service_accounts a
    join public.digital_observer_partner_service_accounts psa
      on psa.service_account_id=a.id and psa.access_kind='customer_resources'
    join public.digital_observer_partners p
      on p.id=psa.partner_id and p.organization_id=a.organization_id and p.partner_status='sandbox'
    join public.digital_observer_partner_customers pc
      on pc.id=psa.partner_customer_id and pc.partner_id=p.id and pc.customer_status='active'
    join public.digital_observer_partner_customer_sites pcs
      on pcs.partner_customer_id=pc.id and pcs.observer_site_id=requested_site_id
    where a.id=requested_service_account_id
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
  'Records bounded hourly API usage for either a directly-owned Site or an active, explicitly mapped PUSH 43 OEM customer Site. Server-only and payload-free.';
