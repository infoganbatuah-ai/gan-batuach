-- REVIEW ONLY. Not a migration; not applied. The guard aborts the transaction
-- if this entire file is run. Copy only after an authorized isolated-DB review.
begin;
do $$ begin raise exception 'REVIEW_ONLY_PARTNER_BRAND_SQL_MUST_NOT_RUN'; end $$;

-- Future forward-only candidate. One function call is one PostgreSQL transaction;
-- any exception, including audit failure, rolls back the brand write.
create or replace function public.save_digital_observer_partner_brand_atomic(
  requested_partner_id uuid,
  requested_organization_id uuid,
  requested_actor_profile_id uuid,
  requested_brand jsonb,
  requested_correlation_id text,
  expected_updated_at timestamptz default null
) returns public.digital_observer_partner_brand_profiles
language plpgsql security invoker set search_path = '' as $$
declare
  owner_org public.digital_observer_organizations%rowtype;
  partner public.digital_observer_partners%rowtype;
  member_id uuid;
  previous public.digital_observer_partner_brand_profiles%rowtype;
  saved public.digital_observer_partner_brand_profiles%rowtype;
  existed boolean;
  next_domain text;
  next_domain_status text;
  next_updated_at timestamptz;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'PARTNER_BRAND_SERVICE_ROLE_REQUIRED';
  end if;
  if requested_partner_id is null or requested_organization_id is null
    or requested_actor_profile_id is null or requested_correlation_id is null
    or length(btrim(requested_correlation_id)) < 3
    or length(requested_correlation_id) > 200 then
    raise exception 'PARTNER_BRAND_ARGUMENT_INVALID';
  end if;
  if requested_brand is null or jsonb_typeof(requested_brand) <> 'object' then
    raise exception 'PARTNER_BRAND_PAYLOAD_INVALID';
  end if;
  if exists (
    select 1 from jsonb_object_keys(requested_brand) as field(name)
    where field.name not in (
      'brand_name','product_name','logo_url','primary_color','accent_color',
      'support_url','privacy_url','terms_url','customer_domain',
      'notification_sender_label','legally_required_notices'
    )
  ) then
    raise exception 'PARTNER_BRAND_FIELD_DENIED';
  end if;
  if jsonb_typeof(requested_brand->'brand_name') is distinct from 'string'
    or length(btrim(requested_brand->>'brand_name')) not between 2 and 100
    or jsonb_typeof(requested_brand->'product_name') is distinct from 'string'
    or length(btrim(requested_brand->>'product_name')) not between 2 and 100
    or jsonb_typeof(requested_brand->'primary_color') is distinct from 'string'
    or (requested_brand->>'primary_color') !~ '^#[0-9A-Fa-f]{6}$'
    or jsonb_typeof(requested_brand->'accent_color') is distinct from 'string'
    or (requested_brand->>'accent_color') !~ '^#[0-9A-Fa-f]{6}$'
    or jsonb_typeof(requested_brand->'privacy_url') is distinct from 'string'
    or jsonb_typeof(requested_brand->'terms_url') is distinct from 'string'
    or jsonb_typeof(requested_brand->'legally_required_notices') is distinct from 'array'
    or jsonb_array_length(coalesce(requested_brand->'legally_required_notices','[]'::jsonb)) not between 1 and 20 then
    raise exception 'PARTNER_BRAND_PAYLOAD_INVALID';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_brand->'legally_required_notices') as notice(value)
    where jsonb_typeof(notice.value) <> 'string'
      or length(btrim(notice.value #>> '{}')) not between 2 and 500
  ) then
    raise exception 'PARTNER_BRAND_NOTICE_INVALID';
  end if;
  if exists (
    select 1 from jsonb_each(requested_brand) as field(name,value)
    where field.name in ('logo_url','support_url','customer_domain','notification_sender_label')
      and jsonb_typeof(field.value) not in ('string','null')
  ) then
    raise exception 'PARTNER_BRAND_OPTIONAL_TYPE_INVALID';
  end if;
  if (requested_brand->>'privacy_url') !~* '^https://[^[:space:]]+$|^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/[^[:space:]]*)?$'
    or (requested_brand->>'terms_url') !~* '^https://[^[:space:]]+$|^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/[^[:space:]]*)?$'
    or (requested_brand->>'logo_url' is not null and (requested_brand->>'logo_url') !~* '^https://[^[:space:]]+$|^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/[^[:space:]]*)?$')
    or (requested_brand->>'support_url' is not null and (requested_brand->>'support_url') !~* '^https://[^[:space:]]+$|^http://(localhost|127\.0\.0\.1)(:[0-9]+)?(/[^[:space:]]*)?$')
    or (requested_brand->>'customer_domain' is not null and (requested_brand->>'customer_domain') !~ '^[a-z0-9.-]{1,253}$')
    or (requested_brand->>'notification_sender_label' is not null
      and length(btrim(requested_brand->>'notification_sender_label')) not between 2 and 80) then
    raise exception 'PARTNER_BRAND_OPTIONAL_VALUE_INVALID';
  end if;

  -- Lock in a fixed order. Changes to status, ownership, or membership cannot
  -- pass through while the brand and mandatory audit are being committed.
  select * into owner_org from public.digital_observer_organizations
    where id = requested_organization_id and status = 'active' for share;
  if not found then raise exception 'PARTNER_BRAND_ORGANIZATION_DENIED'; end if;
  select * into partner from public.digital_observer_partners
    where id = requested_partner_id and organization_id = owner_org.id
      and partner_status = 'sandbox' for update;
  if not found then raise exception 'PARTNER_BRAND_SCOPE_DENIED'; end if;
  if owner_org.owner_profile_id <> requested_actor_profile_id then
    select id into member_id from public.digital_observer_organization_memberships
      where organization_id = owner_org.id and profile_id = requested_actor_profile_id
        and active = true and revoked_at is null
        and enterprise_role in ('organization_owner','organization_admin') for share;
    if member_id is null then raise exception 'PARTNER_BRAND_ACTOR_DENIED'; end if;
  end if;
  -- Platform-wide administration is intentionally not inferred from a supplied
  -- profile ID. A future separately verified contract is required for that case.

  select * into previous from public.digital_observer_partner_brand_profiles
    where partner_id = partner.id for update;
  existed := found;
  if existed and expected_updated_at is distinct from previous.updated_at then
    raise exception 'PARTNER_BRAND_STALE_WRITE';
  end if;
  if not existed and expected_updated_at is not null then
    raise exception 'PARTNER_BRAND_STALE_WRITE';
  end if;
  next_domain := case when requested_brand ? 'customer_domain'
    then requested_brand->>'customer_domain' else previous.customer_domain end;
  next_domain_status := case when existed and next_domain is not distinct from previous.customer_domain
    then previous.domain_status else 'unverified' end;
  next_updated_at := case when existed
    then greatest(clock_timestamp(), previous.updated_at + interval '1 microsecond')
    else clock_timestamp() end;

  if existed then
    update public.digital_observer_partner_brand_profiles b set
      brand_name = btrim(requested_brand->>'brand_name'),
      product_name = btrim(requested_brand->>'product_name'),
      logo_url = case when requested_brand ? 'logo_url' then requested_brand->>'logo_url' else previous.logo_url end,
      primary_color = requested_brand->>'primary_color',
      accent_color = requested_brand->>'accent_color',
      support_url = case when requested_brand ? 'support_url' then requested_brand->>'support_url' else previous.support_url end,
      privacy_url = requested_brand->>'privacy_url',
      terms_url = requested_brand->>'terms_url',
      customer_domain = next_domain,
      domain_status = next_domain_status,
      notification_sender_label = case when requested_brand ? 'notification_sender_label'
        then requested_brand->>'notification_sender_label' else previous.notification_sender_label end,
      legally_required_notices = requested_brand->'legally_required_notices',
      updated_by = requested_actor_profile_id,
      updated_at = next_updated_at
    where b.partner_id = partner.id and b.updated_at = expected_updated_at
    returning * into saved;
  else
    insert into public.digital_observer_partner_brand_profiles (
      partner_id,brand_name,product_name,logo_url,primary_color,accent_color,
      support_url,privacy_url,terms_url,customer_domain,domain_status,
      notification_sender_label,legally_required_notices,updated_by,updated_at
    ) values (
      partner.id,btrim(requested_brand->>'brand_name'),btrim(requested_brand->>'product_name'),
      requested_brand->>'logo_url',requested_brand->>'primary_color',requested_brand->>'accent_color',
      requested_brand->>'support_url',requested_brand->>'privacy_url',requested_brand->>'terms_url',
      next_domain,next_domain_status,requested_brand->>'notification_sender_label',
      requested_brand->'legally_required_notices',requested_actor_profile_id,next_updated_at
    ) returning * into saved;
  end if;
  if saved.partner_id is distinct from partner.id then raise exception 'PARTNER_BRAND_WRITE_FAILED'; end if;
  insert into public.digital_observer_enterprise_audit_events (
    organization_id,actor_profile_id,resource_type,resource_id,action,
    authorization_decision,result_status,correlation_id,safe_metadata
  ) values (
    owner_org.id,requested_actor_profile_id,'partner_brand',partner.id::text,'partner_brand.update',
    'allowed','success',requested_correlation_id,
    jsonb_build_object('domain_verified',next_domain_status='verified_sandbox')
  );
  return saved;
end;
$$;

revoke all on function public.save_digital_observer_partner_brand_atomic(uuid,uuid,uuid,jsonb,text,timestamptz)
  from public,anon,authenticated;
grant execute on function public.save_digital_observer_partner_brand_atomic(uuid,uuid,uuid,jsonb,text,timestamptz)
  to service_role;

-- No COMMIT: the deliberate guard above leaves this transaction aborted.
