# Supabase Payment RLS Migration Verification Plan

## Scope

This plan verifies:

- `20260616000100_parent_rls_scope_hardening.sql`
- `20260616000200_payment_provider_rls_scope_hardening.sql`
- `20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql`

The repository contains these migrations. This file does not prove they were applied to the live Supabase project.

## Manual Migration Steps

1. Open the target Supabase project.
2. Confirm the current environment is the intended staging/pilot environment.
3. Open SQL Editor.
4. Run pending migrations in timestamp order.
5. Save query results/screenshots for:
   - successful migration execution
   - `provider_webhook_events` columns
   - payment RLS policy list
   - helper function existence

## Required Schema Checks

Run:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'provider_webhook_events'
order by ordinal_position;
```

Expected added columns:

- `event_id`
- `related_entity_type`
- `related_entity_id`
- `raw_payload_reference`

Run:

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'provider_webhook_events'
  and indexname = 'provider_webhook_events_idempotency_unique_idx';
```

Expected:

- unique index on `webhook_key, idempotency_key`

## Required RLS Checks

Use test users for:

- parent
- manager for garden A
- manager for garden B
- staff
- inspector
- admin

Expected:

- parent cannot read `kindergarten_subscriptions`, `subscription_payments`, `billing_invoices` for Gan Batuach subscription records.
- staff cannot read provider/payment records.
- inspector cannot read provider/payment records.
- manager A can read only garden A subscription/payment/invoice records.
- manager B cannot read garden A records.
- admin can read platform payment/provider records.
- `provider_webhook_events` is admin-only.

## Webhook Idempotency Checks

1. Configure sandbox/test env only.
2. Send a payment webhook with event id `test-event-001`.
3. Send the same webhook again.
4. Confirm first row is logged and second attempt marks replay/duplicate behavior.

Expected:

- no duplicate subscription activation
- replay is recorded
- raw payload is not stored

## Demo Freeze Checks

1. Create a demo subscription with expired `trial_ends_at`.
2. Confirm no paid `subscription_payments` row exists.
3. Call `/api/cron/demo-expiration-freeze` with `CRON_SECRET`.

Expected:

- subscription status: `frozen`
- garden status: `suspended`
- notification created
- audit log created

## Rollback Considerations

- Do not drop RLS hardening policies in production.
- If a migration fails, stop and inspect the failing object.
- If enum extension has already run, do not attempt to remove enum values.
- If webhook idempotency index conflicts with duplicate historical rows, deduplicate or archive old duplicate readiness rows before creating the unique index.

## Production Approval Conditions

Payment/provider production remains blocked until:

- migrations are applied and documented
- RLS negative tests pass
- signed sandbox webhooks pass
- duplicate/replay test passes
- provider credentials are configured server-side only
- no raw card data is stored
- accounting/legal review approves invoice flow
