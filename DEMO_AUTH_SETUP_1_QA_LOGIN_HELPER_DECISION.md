# DEMO AUTH SETUP 1 - QA Login Helper Decision

Decision: no client-side QA login helper was implemented.

Reason:

- A helper that logs users in could easily become an unsafe backdoor.
- Passwords must not be stored in the frontend bundle.
- Supabase auth/RLS must remain the only authentication path.
- The safer practical fix is normal login plus reliable logout/session switching.

What was implemented instead:

- `/api/auth/logout` now supports GET and POST sign-out. This allows a normal browser URL to clear the session between role tests.
- `.env.qa-demo.example` documents local-only credential handling.
- `scripts/qa/create-demo-role-users.mjs` can create missing synthetic users server-side when Daniel provides local env passwords.

If a login helper is ever added later, it must only pre-fill demo email addresses, never passwords, and must be gated by explicit demo/test env flags.
