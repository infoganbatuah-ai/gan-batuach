-- REVIEW ONLY: not a migration; deliberately aborts before any lock or DDL.
begin;
do $$ begin raise exception 'REVIEW_ONLY_INVOICE_SOURCE_UNIQUENESS_MUST_NOT_RUN'; end $$;

-- CANDIDATE_START. Future reviewed Development migration only. This stronger
-- invariant allows at most one invoice row to cite any payment event, across
-- Site, checkout, currency and invoice lifecycle states. Drafts without a
-- source payment remain allowed; no legacy row is deleted or rewritten.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
lock table public.observer_invoices in share mode;

do $$
begin
  if to_regclass('public.observer_invoices_source_payment_event_unique_idx') is not null then
    raise exception 'REFUND_INVOICE_INDEX_NAME_COLLISION';
  end if;
  if exists (
    select 1 from public.observer_invoices
    where metadata ? 'source_payment_event_id'
      and (jsonb_typeof(metadata->'source_payment_event_id') is distinct from 'string'
        or metadata->>'source_payment_event_id' !~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  ) then
    raise exception 'REFUND_INVOICE_SOURCE_METADATA_INVALID';
  end if;
  if exists (
    select 1 from public.observer_invoices
    where metadata ? 'source_payment_event_id'
    group by (metadata->>'source_payment_event_id')::uuid
    having count(*) > 1
  ) then
    raise exception 'REFUND_INVOICE_SOURCE_DUPLICATE';
  end if;
end;
$$;

-- The UUID expression detects the same source even with different letter case.
-- NULL (the ordinary draft/legacy absence) remains non-unique; malformed
-- non-NULL values fail the cast rather than being accepted as proof.
create unique index observer_invoices_source_payment_event_unique_idx
  on public.observer_invoices (((metadata->>'source_payment_event_id')::uuid));

-- No automatic rollback: dropping this index while refund authorization is
-- enabled would reopen the insertion/update race. See DB-QUALIFICATION.md.
commit;
