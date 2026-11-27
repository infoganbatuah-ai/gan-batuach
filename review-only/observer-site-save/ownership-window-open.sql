begin;
do $$ begin raise exception 'REVIEW ONLY: temporary ownership transfer prerequisite'; end $$;
grant create on schema public to observer_site_save_executor;
commit;
