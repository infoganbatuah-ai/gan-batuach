# DEMO AUTH SETUP 1 - Auth Readiness Smoke Test

No real users were used. No passwords were printed.

| Role | Login attempt | Dashboard route | Result | Reason |
|---|---|---|---|---|
| Parent | not rerun in this phase | `/dashboard/parent` | PREVIOUS_PASS | AUTHED UX/UI QA 2 already proved real Parent login. |
| Manager | not run | `/dashboard/garden` | BLOCKED_MISSING_LOCAL_CREDENTIALS | Credential must be entered by Daniel or local ignored env. |
| Staff unassigned | not run | `/dashboard/staff` | BLOCKED_MISSING_USER_OR_CREDENTIALS | Can be created by safe script/manual Supabase setup. |
| Staff assigned | not run | `/dashboard/staff` | BLOCKED_MISSING_LOCAL_CREDENTIALS | Existing demo account found, credential not provided in safe local form. |
| Inspector unassigned | not run | `/dashboard/inspector/apply` | BLOCKED_MISSING_USER_OR_CREDENTIALS | Can be created by safe script/manual Supabase setup. |
| Inspector assigned | not run | `/dashboard/inspector` | BLOCKED_MISSING_LOCAL_CREDENTIALS | Existing demo account found, credential not provided in safe local form. |
| Admin | not run | `/dashboard/admin` | BLOCKED_MISSING_LOCAL_CREDENTIALS | Existing demo account found, credential not provided in safe local form. |
| Digital Observer | not run | `/digital-observer/dashboard` | BLOCKED_MISSING_USER_OR_CREDENTIALS | Can be created by safe script/manual Supabase setup. |

Smoke test conclusion: setup path is ready, but all-role authenticated QA still requires Daniel/local credentials and missing synthetic accounts.
