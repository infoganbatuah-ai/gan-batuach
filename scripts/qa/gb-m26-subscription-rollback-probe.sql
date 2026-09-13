begin;
set local role authenticated;
do $$
begin
  if has_table_privilege('authenticated','public.kindergarten_subscriptions','INSERT')
     or has_table_privilege('authenticated','public.kindergarten_subscriptions','UPDATE')
     or has_table_privilege('authenticated','public.subscription_plans','UPDATE') then
    raise exception 'direct_billing_mutation_still_granted';
  end if;
  begin
    perform public.admin_transition_platform_subscription('00000000-0000-0000-0000-000000000000','manual_activate','synthetic test');
    raise exception 'admin_transition_unauthorized_allowed';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.ensure_platform_subscription('00000000-0000-0000-0000-000000000000',null);
    raise exception 'garden_creation_unauthorized_allowed';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.platform_subscription_entitlements('00000000-0000-0000-0000-000000000000');
    raise exception 'garden_entitlement_unauthorized_allowed';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.admin_version_platform_plan('00000000-0000-0000-0000-000000000000','Synthetic',700,'ILS','monthly',null,false);
    raise exception 'admin_plan_unauthorized_allowed';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.admin_adopt_platform_plan('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000000','synthetic test');
    raise exception 'admin_plan_adoption_unauthorized_allowed';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.request_platform_subscription_cancellation('00000000-0000-0000-0000-000000000000','synthetic test');
    raise exception 'garden_cancellation_unauthorized_allowed';
  exception when sqlstate '42501' then null; end;
end $$;
rollback;
