-- A direct postgres ACL can survive ALTER OWNER on a newly created function.
-- Scope this adjustment to the new signature only; postgres is not its owner.
begin;
do $$ begin raise exception 'REVIEW ONLY: restricted generic writer ACL'; end $$;
revoke execute on function public.submit_observer_site_save(uuid,uuid,bigint,uuid,text,uuid,uuid,jsonb,text,jsonb) from postgres restrict;
commit;
