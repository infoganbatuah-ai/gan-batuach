# Digital Observer Separation Rollback Plan

## Purpose

Rollback must preserve Gan Batuach, Digital Observer customers, leads, billing records and existing `/digital-observer` access.

## Rollback Triggers

- custom domain fails
- SSL fails
- separate Vercel deploy fails
- environment variables are incomplete
- Digital Observer billing is mislabeled
- camera gateway fails
- QA detects Gan Batuach regression
- customer access breaks

## Immediate Rollback Steps

1. Disable `DIGITAL_OBSERVER_CUSTOM_DOMAIN_ENABLED`.
2. Keep `/digital-observer` available inside the Gan Batuach project.
3. Remove or pause custom domain routing.
4. Keep shared Supabase active.
5. Keep existing billing records in place.
6. Preserve all Digital Observer leads and beta customers.
7. Notify support/admin that route-only mode is active again.

## Data Safety

Do not delete:

- observer sites
- beta customers
- subscriptions
- invoices
- camera metadata
- audit logs
- support tickets
- leads

## Billing Safety

If separate billing fails:

- keep Digital Observer billing dashboard accessible
- block live charge changes
- keep invoices product-labeled
- do not mix Gan Batuach subscriptions or parent tuition payments

## Customer Access

Customers should continue using:

`/digital-observer`

until the custom domain is verified again.

## Final State After Rollback

- Gan Batuach remains operational
- Digital Observer remains available under `/digital-observer`
- shared Supabase remains the source of truth
- no data is moved
- no production customers are lost
