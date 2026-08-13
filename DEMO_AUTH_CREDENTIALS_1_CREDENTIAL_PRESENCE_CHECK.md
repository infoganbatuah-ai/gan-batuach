# DEMO AUTH CREDENTIALS 1 - Credential Presence Check

No credential values were printed.

`.env.qa-demo.local` status: exists.

| Role | Email present | Password present | Safe to attempt login | Missing field | Blocker |
|---|---|---|---|---|---|
| Parent assigned | yes | yes | yes for login smoke test if Supabase user exists | none | READY_BY_LOCAL_CREDENTIALS |
| Parent unassigned | yes | yes | yes after Supabase user is created/confirmed | Supabase user may need creation | BLOCKED_MISSING_USER_OR_SERVER_CONFIRMATION |
| Manager | default exists in example | yes | yes for login smoke test | none | READY_FOR_PARTIAL_QA |
| Staff assigned | default exists in example | yes | yes for login smoke test | none | READY_FOR_PARTIAL_QA |
| Staff unassigned | yes | yes | yes after Supabase user is created/confirmed | Supabase user may need creation | BLOCKED_MISSING_USER_OR_SERVER_CONFIRMATION |
| Inspector assigned | yes | yes | yes for login smoke test | none | READY_FOR_PARTIAL_QA |
| Inspector unassigned | yes | yes | yes after Supabase user is created/confirmed | Supabase user may need creation | BLOCKED_MISSING_USER_OR_SERVER_CONFIRMATION |
| Admin | default exists in example | yes | yes for login smoke test | none | READY_FOR_PARTIAL_QA |
| Digital Observer | yes | yes | yes after Supabase user/site is created/confirmed | Supabase user/site may need creation | BLOCKED_MISSING_USER_OR_SERVER_CONFIRMATION |

Server-side setup variables for automatic user creation:

- `NEXT_PUBLIC_SUPABASE_URL`: missing locally.
- `SUPABASE_SERVICE_ROLE_KEY`: missing locally.

## Result

LOCAL_CREDENTIALS_PRESENT_SERVER_CREATION_BLOCKED

All required QA demo email/password variables are now present locally by variable name only. Values were not printed.

Full AUTHED UX/UI QA 3 remains blocked until the missing/unverified users are created or confirmed in Supabase. Codex cannot safely create those users yet because the local server-side Supabase setup variables are missing.
