-- Review only. The isolated qualification runner executes the marked statements in a transaction.
begin;
do $$ begin raise exception 'REVIEW ONLY: isolated schema and narrow writer required'; end $$;
-- BEGIN OWNER RLS CANDIDATE
-- Install only after confirming the pristine ACL and absence of inherited grants.
do $$ begin
  if has_function_privilege('observer_site_save_executor','public.can_access_observer_site(uuid)','EXECUTE')
    or has_function_privilege('observer_site_save_executor','public.can_manage_observer_site(uuid)','EXECUTE') then
    raise exception 'REVIEW REQUIRED: unexpected pre-existing predicate grants';
  end if;
end $$;
grant execute on function public.can_access_observer_site(uuid),public.can_manage_observer_site(uuid) to observer_site_save_executor;

-- Schedule RLS reads just these membership columns on upsert. Refuse to
-- assume ownership of existing privileges when preparing reversible grants.
do $$ begin
  if exists (select 1 from unnest(array['observer_site_id','profile_id','active']) c where
    has_column_privilege('observer_site_save_executor','public.observer_site_memberships',c,'SELECT')) then
    raise exception 'REVIEW REQUIRED: unexpected pre-existing membership read';
  end if;
end $$;
grant select(observer_site_id,profile_id,active) on public.observer_site_memberships to observer_site_save_executor;

-- A client may edit authorized settings through the existing policy. Standalone Site
-- creation, including the first Site, must go through the atomic writer.
create policy observer_standalone_insert_requires_writer on public.observer_sites as restrictive
  for insert to anon, authenticated with check (garden_id is not null or site_type = 'kindergarten');

-- PostgreSQL row locks also consult UPDATE policies. Permit lock visibility only.
create policy observer_writer_lock_account on public.digital_observer_accounts for update to observer_site_save_executor
  using (profile_id = auth.uid()) with check (false);
create policy observer_writer_lock_package on public.observer_monitoring_packages for update to observer_site_save_executor
  using (active) with check (false);

create policy observer_writer_read_subscription on public.observer_site_subscriptions for select to observer_site_save_executor
  using (exists (select 1 from public.observer_sites s where s.id=observer_site_id and s.owner_profile_id=auth.uid()
    and s.garden_id is null and s.site_type<>'kindergarten'));
create policy observer_writer_lock_subscription on public.observer_site_subscriptions for update to observer_site_save_executor
  using (exists (select 1 from public.observer_sites s where s.id=observer_site_id and s.owner_profile_id=auth.uid()
    and s.garden_id is null and s.site_type<>'kindergarten')) with check (false);
create policy observer_writer_start_trial on public.observer_site_subscriptions for insert to observer_site_save_executor
  with check (commercial_state='trial' and payment_provider_mode='disabled' and exists (
    select 1 from public.observer_sites s where s.id=observer_site_id and s.owner_profile_id=auth.uid()
      and s.garden_id is null and s.site_type<>'kindergarten'));
create policy observer_writer_trial_grant on public.digital_observer_entitlement_grants for insert to observer_site_save_executor
  with check (exists (select 1 from public.observer_site_subscriptions sub where sub.id=subscription_id
    and sub.observer_site_id=digital_observer_entitlement_grants.observer_site_id and sub.commercial_state='trial'));
create policy observer_writer_trial_audit on public.digital_observer_financial_audit for insert to observer_site_save_executor
  with check (actor_profile_id=auth.uid() and operation='trial_activated' and entity_type='subscription' and exists (
    select 1 from public.observer_site_subscriptions sub where sub.id::text=entity_id and sub.observer_site_id=digital_observer_financial_audit.observer_site_id
      and sub.commercial_state='trial'));
commit;
