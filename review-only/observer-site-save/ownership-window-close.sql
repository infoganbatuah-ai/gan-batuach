begin;
do $$ begin raise exception 'REVIEW ONLY: close temporary ownership transfer prerequisite'; end $$;
revoke create on schema public from observer_site_save_executor restrict;
do $check$
begin
  if has_schema_privilege('observer_site_save_executor','public','CREATE') then
    raise exception 'EXECUTOR_STILL_HAS_SCHEMA_CREATE';
  end if;
end
$check$;
commit;
