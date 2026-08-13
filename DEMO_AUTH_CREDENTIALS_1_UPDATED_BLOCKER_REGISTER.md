# DEMO AUTH CREDENTIALS 1 - Updated Blocker Register

| ID | Severity | Category | Status | Impact | Required action |
|---|---|---|---|---|---|
| DEMO-CRED-CRIT-001 | critical | auth_access | reduced | All local email/password variables are present, but full all-role QA still cannot run until Supabase users are created/confirmed. | Create/confirm missing unassigned and Digital Observer users in Supabase. |
| DEMO-CRED-HIGH-001 | high | missing_demo_user | open | Parent unassigned state cannot be tested until the Supabase user exists. | Create/confirm `qa.parent.unassigned@demo.ganbatuach.com`. |
| DEMO-CRED-HIGH-002 | high | missing_demo_user | open | Staff unassigned cannot be tested until the Supabase user exists. | Create/confirm `qa.staff.unassigned@demo.ganbatuach.com`. |
| DEMO-CRED-HIGH-003 | high | missing_demo_user | open | Inspector unassigned cannot be tested until the Supabase user exists. | Create/confirm `qa.inspector.unassigned@demo.ganbatuach.com`. |
| DEMO-CRED-HIGH-004 | high | missing_demo_user | open | Digital Observer authenticated dashboard cannot be tested until the app user/site exists. | Create/confirm `qa.digital.observer@demo.ganbatuach.com` and synthetic observer site. |
| DEMO-CRED-HIGH-005 | high | external_setup_required | open | Optional script cannot create missing users without Supabase URL/service role in local env. | Daniel must provide server-side Supabase setup credentials locally or create users manually in Supabase. |
| DEMO-CRED-MED-001 | medium | synthetic_data_required | open | Missing synthetic links may block visual QA even after login. | Verify data after users are created. |
| DEMO-CRED-MED-002 | medium | auth_access | partial | Logout route is ready but runtime multi-role switching was not tested. | Test after credentials exist. |
| DEMO-CRED-LOW-001 | low | native_required | open | Capacitor sync not run after previous layout/auth work. | Run `npx cap sync` before native/mobile QA. |

## Counts

- Critical blockers remaining: 1
- High blockers remaining: 5
- Medium blockers remaining: 2
- Low blockers remaining: 1
