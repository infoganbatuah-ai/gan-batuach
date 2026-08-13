# DEMO AUTH CREDENTIALS 1 - AUTHED UX/UI QA 3 Role Access Readiness

| Role | QA 3 readiness | Reason |
|---|---|---|
| Parent assigned | ready for partial QA 3 | user exists/was previously known; local password present by name |
| Parent unassigned | blocked by missing/unknown Supabase user | local email/password variables are present; user must be created/confirmed in Supabase |
| Manager | ready for partial QA 3 | user exists; local password present by name |
| Staff assigned | ready for partial QA 3 | user exists; local password present by name |
| Staff unassigned | blocked by missing/unknown Supabase user | local email/password variables are present; user must be created/confirmed in Supabase |
| Inspector assigned | ready for partial QA 3 | user exists; local password present by name |
| Inspector unassigned | blocked by missing/unknown Supabase user | local email/password variables are present; user must be created/confirmed in Supabase |
| Admin | ready for partial QA 3 | user exists; local password present by name |
| Digital Observer | blocked by missing/unknown Supabase user/site | local email/password variables are present; user/site must be created or confirmed |

## Server-Side Creation Status

The local credential file now has all QA demo email/password variables by name only. Values were not printed.

Automatic creation is still blocked because these server-side variables are missing locally:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Decision

AUTHED UX/UI QA 3 full all-role scope is not ready yet.

Partial QA can be attempted for assigned Parent, Manager, Staff assigned, Inspector assigned and Admin. Full QA can run only after Parent unassigned, Staff unassigned, Inspector unassigned and Digital Observer are confirmed/created in Supabase.
