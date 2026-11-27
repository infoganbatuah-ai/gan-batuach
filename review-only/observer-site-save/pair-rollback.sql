-- Review only. Isolated rollback retains both receipt histories and their rows.
begin;
do $$ begin raise exception 'REVIEW ONLY: confirm isolated pair rollback target'; end $$;
-- BEGIN PAIR ROLLBACK
-- RPCs hold this table lock through commit. Take the lock before changing
-- policies or grants so an admitted pair finishes with its original boundary.
lock table observer_site_save_private.pair_pin in access exclusive mode;
select observer_site_save_private.check_pair_acl(true);
revoke execute on function public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text)
  from observer_site_save_caller;
drop function public.submit_qa_site_source_pair(uuid,uuid,bigint,uuid,text);

drop policy pair_source_lock_only on public.digital_observer_camera_sources;
drop policy pair_source_inert on public.digital_observer_camera_sources;
drop policy pair_source_scope on public.digital_observer_camera_sources;
revoke select(id,observer_site_id),insert(id,observer_site_id,created_by,display_name,source_mode,status,engine_mode),update(id)
  on public.digital_observer_camera_sources from observer_site_save_executor;

revoke select,insert on observer_site_save_private.pair_receipts from observer_site_save_executor;
drop policy pair_history_insert on observer_site_save_private.pair_receipts;
drop policy pair_history_read on observer_site_save_private.pair_receipts;
-- The operator owns the retained pair history. #669 keeps its original
-- privileges on its own receipts, including the domain-separated pair entries.
drop function observer_site_save_private.lock_pair_pin(uuid,text);
drop table observer_site_save_private.pair_pin;
grant execute on function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb)
  to observer_site_save_caller;
select observer_site_save_private.check_pair_acl(false);
drop function observer_site_save_private.check_pair_acl(boolean);
commit;
