-- Offline fragment. Runtime admission must already be closed out of band.
begin;
do $$ begin raise exception 'REVIEW ONLY: independent closure receipt required'; end $$;
lock table observer_site_save_private.pair_pin in access exclusive mode nowait;
do $closed$
begin
  if exists(select from observer_site_save_private.pair_pin where expires_at>clock_timestamp()) then
    raise exception 'ACTIVE_ENROLLMENT_WINDOW';
  end if;
  if nullif(current_setting('observer_review.closure_receipt_sha256',true),'') is null or
    current_setting('observer_review.closure_receipt_sha256',true) !~ '^[0-9a-f]{64}$' then
    raise exception 'MISSING_ADMISSION_AND_CREDENTIAL_CLOSURE_RECEIPT';
  end if;
end
$closed$;
commit;
