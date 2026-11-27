-- PUSH 43: revalidate an external account's current Site scope when metering usage.
-- Replaces the function in 20261019041000. Existing usage buckets are preserved.

create or replace function public.record_digital_observer_external_api_usage(
  requested_service_account_id uuid,
  requested_site_id uuid,
  requested_operation text,
  requested_bucket_start timestamptz,
  requested_success boolean
) returns uuid language plpgsql security definer set search_path=public set row_security=off as $$
declare
  account_organization_id uuid;
  site_organization_id uuid;
  account_all_sites boolean;
  account_expires_at timestamptz;
  result_id uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'external api usage is server-only'; end if;

  -- Hold the applicable authorization rows until this usage write commits.
  select a.organization_id, s.digital_observer_organization_id, a.all_sites, a.expires_at
    into account_organization_id, site_organization_id, account_all_sites, account_expires_at
  from public.digital_observer_service_accounts a
  join public.observer_sites s on s.id=requested_site_id
  where a.id=requested_service_account_id and a.account_status='active' and a.revoked_at is null
    and s.digital_observer_organization_id is not null and s.garden_id is null and s.site_type <> 'kindergarten'
  for share of a,s;
  if not found then raise exception 'service account/site mismatch'; end if;

  if not account_all_sites then
    perform 1 from public.digital_observer_service_account_sites assigned
    where assigned.service_account_id=requested_service_account_id and assigned.observer_site_id=requested_site_id
    for share of assigned;
    if not found then raise exception 'service account/site mismatch'; end if;
  end if;

  if site_organization_id <> account_organization_id then
    perform 1 from public.digital_observer_partner_service_accounts psa
    join public.digital_observer_partners p
      on p.id=psa.partner_id and p.organization_id=account_organization_id and p.partner_status='sandbox'
    join public.digital_observer_partner_customers pc
      on pc.id=psa.partner_customer_id and pc.partner_id=p.id and pc.customer_status='active'
      and pc.customer_organization_id=site_organization_id
    join public.digital_observer_partner_customer_sites pcs
      on pcs.partner_customer_id=pc.id and pcs.observer_site_id=requested_site_id
    where psa.service_account_id=requested_service_account_id and psa.access_kind='customer_resources'
    for share of psa,p,pc,pcs;
    if not found then raise exception 'service account/site mismatch'; end if;
  end if;

  -- Use the current clock after lock acquisition. Request time cannot extend an account.
  if account_expires_at <= clock_timestamp() then raise exception 'service account/site mismatch'; end if;

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
  'Server-only, payload-free hourly accounting for an active account and its current directly owned or delegated Site.';
