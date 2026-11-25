-- Review only. Close the write route before rollback; retain every Site and receipt.
begin;
do $$ begin raise exception 'REVIEW ONLY: confirm isolated target and forward receipt'; end $$;
-- BEGIN OWNER RLS ROLLBACK
drop policy observer_writer_trial_audit on public.digital_observer_financial_audit;
drop policy observer_writer_trial_grant on public.digital_observer_entitlement_grants;
drop policy observer_writer_start_trial on public.observer_site_subscriptions;
drop policy observer_writer_lock_subscription on public.observer_site_subscriptions;
drop policy observer_writer_read_subscription on public.observer_site_subscriptions;
drop policy observer_writer_lock_package on public.observer_monitoring_packages;
drop policy observer_writer_lock_account on public.digital_observer_accounts;
drop policy observer_standalone_insert_requires_writer on public.observer_sites;
revoke select(observer_site_id,profile_id,active) on public.observer_site_memberships from observer_site_save_executor;
revoke execute on function public.can_access_observer_site(uuid), public.can_manage_observer_site(uuid) from observer_site_save_executor;
commit;
