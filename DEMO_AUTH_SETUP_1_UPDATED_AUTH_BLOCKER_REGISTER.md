# DEMO AUTH SETUP 1 - Updated Auth Blocker Register

| ID | Severity | Category | Status | Impact | Required action |
|---|---|---|---|---|---|
| DEMO-AUTH-CRIT-001 | critical | missing_credentials | reduced | All-role QA still cannot run without credentials, but a safe handling plan and local env example now exist. | Daniel provides credentials manually or in ignored `.env.qa-demo.local`. |
| DEMO-AUTH-HIGH-001 | high | missing_demo_user | reduced | Staff unassigned account was missing/unconfirmed. | Create via Supabase dashboard or `npm run qa:create-demo-role-users`. |
| DEMO-AUTH-HIGH-002 | high | missing_demo_user | reduced | Inspector unassigned account was missing/unconfirmed. | Create via Supabase dashboard or `npm run qa:create-demo-role-users`. |
| DEMO-AUTH-HIGH-003 | high | missing_demo_user | reduced | Digital Observer account/site was missing/unconfirmed. | Create via script/manual setup or exclude DO from next QA scope. |
| DEMO-AUTH-MED-001 | medium | auth_access | closed | Browser session switching was blocked by GET logout failure. | Fixed: `/api/auth/logout` supports GET redirect and POST JSON. |
| DEMO-AUTH-MED-002 | medium | backend_query | closed-static | Parent query no longer selects `children.pickup_status`. | Recheck in next live Parent QA. |
| DEMO-AUTH-MED-003 | medium | security_guardrail | closed | Full demo seed printed demo passwords. | Fixed: seed output now prints "password not printed". |
| DEMO-AUTH-MED-004 | medium | native_required | open | Capacitor sync not run after prior layout/auth changes. | Run `npx cap sync` before native/mobile QA. |

## Counts

- Critical blockers remaining: 1
- High blockers remaining: 3
- Medium blockers remaining: 1

This is an improvement from AUTHED UX/UI QA 2, but not enough for all-role QA until credentials/users are actually provided or created.
