# AUTH ACCESS FIX 1 - Safe Demo Account Creation Plan

## Decision

No destructive seed script was run in this phase.

## Safe Creation Rules

1. Create users only in local/demo/staging/pilot-safe environment.
2. Use synthetic data only.
3. Do not create production users.
4. Do not use real child or parent data.
5. Do not enable live payments, live camera, live AI, or production SMS/WhatsApp.
6. Do not expose service-role keys to browser/client code.
7. Do not commit passwords to the repository.
8. Use local env variables or a secure manual handoff for passwords.
9. Record created accounts and synthetic data links in a QA-only report.

## Minimum Account Set

- Parent A linked only to Child A and Kindergarten A.
- Manager A assigned only to Kindergarten A.
- Staff assigned A assigned only to Kindergarten A.
- Staff unassigned with no child/parent data access.
- Inspector assigned A assigned only to Kindergarten A.
- Inspector unassigned with no garden access.
- Admin demo account.
- Digital Observer scoped account if included.

## Script Safety Status

Existing scripts can create/update demo users, but they require Supabase admin/service-role configuration and may alter demo data. They are operational setup scripts, not safe UX-QA click helpers.

## Recommended Action

Daniel should confirm the target Supabase project and either:

- use existing seeded demo accounts, or
- create missing unassigned/Digital Observer demo accounts manually in Supabase Dashboard with synthetic profiles only.

