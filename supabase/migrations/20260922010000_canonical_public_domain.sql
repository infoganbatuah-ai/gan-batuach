-- Retire stale provider-route metadata after ganbatuach.com became canonical.
-- Authentication provider settings remain an external dashboard control and
-- must be verified separately before an owner-authorized Production release.

do $$
begin
  if to_regclass('public.digital_observer_product_readiness') is not null then
    update public.digital_observer_product_readiness
       set status = 'ready',
           notes = 'The purchased Gan Batuach domain is the only public application origin.',
           metadata = jsonb_build_object('current', 'https://ganbatuach.com/digital-observer'),
           updated_at = now()
     where readiness_key = 'domain-routing';
  end if;

  if to_regclass('public.digital_observer_domain_routes') is not null then
    update public.digital_observer_domain_routes
       set route_key = 'current-canonical-route',
           current_route = '/digital-observer',
           future_domain = 'ganbatuach.com',
           routing_mode = 'active',
           vercel_setup_status = 'verified',
           dns_status = 'verified',
           safety_notes = 'Public paths, authentication callbacks and gateway cloud links use the purchased canonical domain.',
           metadata = jsonb_build_object('active_now', true, 'canonical_origin', 'https://ganbatuach.com'),
           updated_at = now()
     where route_key = 'current-vercel-route'
       and not exists (
         select 1
           from public.digital_observer_domain_routes
          where route_key = 'current-canonical-route'
       );

    update public.digital_observer_domain_routes
       set current_route = '/digital-observer',
           future_domain = 'ganbatuach.com',
           routing_mode = 'active',
           vercel_setup_status = 'verified',
           dns_status = 'verified',
           safety_notes = 'Public paths, authentication callbacks and gateway cloud links use the purchased canonical domain.',
           metadata = jsonb_build_object('active_now', true, 'canonical_origin', 'https://ganbatuach.com'),
           updated_at = now()
     where route_key = 'current-canonical-route';

    -- If a canonical row already existed before this migration, retire any
    -- duplicate legacy row without leaving stale public-origin metadata.
    update public.digital_observer_domain_routes
       set route_key = 'retired-provider-alias',
           future_domain = 'ganbatuach.com',
           routing_mode = 'documented',
           vercel_setup_status = 'verified',
           dns_status = 'verified',
           safety_notes = 'Retired compatibility record. Public traffic uses the purchased canonical domain.',
           metadata = jsonb_build_object('active_now', false, 'canonical_origin', 'https://ganbatuach.com'),
           updated_at = now()
     where route_key = 'current-vercel-route';
  end if;
end
$$;

notify pgrst, 'reload schema';
