# DEMO AUTH CREDENTIALS 1 - Login Smoke Test Results

No real users were used. No passwords were printed.

Smoke tests were not executed in this update because this turn focused on local credential completion, Supabase user readiness and a first UX/layout cleanup.

`.env.qa-demo.local` exists and contains all required role email/password variables by name only. Values were not printed.

| Role | Status | Reason |
|---|---|---|
| Parent assigned | READY_FOR_SMOKE_TEST | Password present by variable name; user exists |
| Parent unassigned | BLOCKED_MISSING_OR_UNKNOWN_SUPABASE_USER | Local credentials present; user may need creation/confirmation in Supabase |
| Manager | READY_FOR_SMOKE_TEST | Password present by variable name; user exists |
| Staff assigned | READY_FOR_SMOKE_TEST | Password present by variable name; user exists |
| Staff unassigned | BLOCKED_MISSING_OR_UNKNOWN_SUPABASE_USER | Local credentials present; user may need creation/confirmation in Supabase |
| Inspector assigned | READY_FOR_SMOKE_TEST | Password present by variable name; user exists |
| Inspector unassigned | BLOCKED_MISSING_OR_UNKNOWN_SUPABASE_USER | Local credentials present; user may need creation/confirmation in Supabase |
| Admin | READY_FOR_SMOKE_TEST | Password present by variable name; user exists |
| Digital Observer | BLOCKED_MISSING_OR_UNKNOWN_SUPABASE_USER | Local credentials present; user/site may need creation/confirmation in Supabase |

Automatic Supabase creation was not run because these local server-side setup variables are missing:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Result

DEMO_LOGIN_SMOKE_TEST_READY_AFTER_SUPABASE_USER_CONFIRMATION
