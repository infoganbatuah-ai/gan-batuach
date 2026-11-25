begin;
do $$ begin raise exception 'REVIEW ONLY: separate authority for withdrawing the writer'; end $$;
revoke observer_site_save_caller from authenticator restrict;
do $membership$
begin
  if pg_has_role('authenticator','observer_site_save_caller','MEMBER') then
    raise exception 'CALLER_MEMBERSHIP_STILL_PRESENT';
  end if;
end
$membership$;
commit;
